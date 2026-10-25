#!/usr/bin/env bash
# Check the published GitHub Pages site.
#
#   deploy/check-pages.sh hashes [ref]   compare live files with the files in a git ref
#                                        (default: origin/main); exit 1 on any mismatch
#   deploy/check-pages.sh watch [sec]    poll the site every <sec> seconds (default: 5),
#                                        print a timestamped line whenever the HTTP status
#                                        changes; stop with Ctrl+C
#
# Env: SITE_URL (default https://trajgiel.github.io/Slowo-dnia/), FILES (space-separated
# list for "hashes", default "index.html sw.js courses/adult.js manifest.webmanifest").
# Every request carries a unique query string so the CDN cache is bypassed.
set -euo pipefail

SITE_URL="${SITE_URL:-https://trajgiel.github.io/Slowo-dnia/}"
FILES="${FILES:-index.html sw.js courses/adult.js manifest.webmanifest}"

usage() {
  sed -n '2,12p' "$0" | sed 's/^# \{0,1\}//'
  exit 2
}

sha256() {
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum | cut -d' ' -f1
  else
    shasum -a 256 | cut -d' ' -f1
  fi
}

bust() {
  printf '%s?nocache=%s%s' "$1" "$(date +%s)" "$RANDOM"
}

cmd_hashes() {
  local ref="${1:-origin/main}"
  git rev-parse --verify --quiet "$ref^{commit}" >/dev/null || {
    echo "Unknown git ref: $ref" >&2
    exit 2
  }
  local fail=0 f local_hash live_hash
  echo "Site: $SITE_URL"
  echo "Ref:  $ref ($(git rev-parse --short "$ref"))"
  for f in $FILES; do
    local_hash="$(git show "$ref:$f" | sha256)"
    if ! live_hash="$(curl -fsS -H 'Cache-Control: no-cache' "$(bust "$SITE_URL$f")" | sha256)"; then
      live_hash="(download failed)"
    fi
    if [ "$local_hash" = "$live_hash" ]; then
      printf 'OK    %s  %s\n' "$local_hash" "$f"
    else
      printf 'DIFF  %s  %s (live: %s)\n' "$local_hash" "$f" "$live_hash"
      fail=1
    fi
  done
  return "$fail"
}

cmd_watch() {
  local interval="${1:-5}" prev="" code
  case "$interval" in '' | *[!0-9]*) usage ;; esac
  echo "Watching $SITE_URL every ${interval}s (Ctrl+C to stop)"
  while true; do
    code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 \
      -H 'Cache-Control: no-cache' "$(bust "$SITE_URL")" || true)"
    if [ "$code" != "$prev" ]; then
      printf '%s  HTTP %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$code"
      prev="$code"
    fi
    sleep "$interval"
  done
}

case "${1:-}" in
  hashes) shift; cmd_hashes "$@" ;;
  watch) shift; cmd_watch "$@" ;;
  *) usage ;;
esac
