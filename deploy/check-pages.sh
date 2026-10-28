#!/usr/bin/env bash
# Check the published GitHub Pages site.
#
#   deploy/check-pages.sh hashes [ref]   prototype site (before the React release): compare
#                                        live files with the files in a git ref (default:
#                                        origin/main; "origin/*" refs are fetched first)
#   deploy/check-pages.sh sums <file|->  React site (after a deploy): compare every file
#                                        listed in sha256sum lines (the "Published files"
#                                        block of the pages run summary; other lines are
#                                        ignored, "-" reads stdin) with the live site
#   deploy/check-pages.sh dir <path>     same as "sums" for a local build directory
#                                        (dist/ or the unpacked github-pages artifact)
#   deploy/check-pages.sh watch [sec]    poll the site every <sec> seconds (default: 5),
#                                        print a timestamped line whenever the HTTP status
#                                        changes; stop with Ctrl+C
#
# hashes/sums/dir: exit 1 on any mismatch or missing file, 2 on wrong usage.
# Env: SITE_URL (default https://trajgiel.github.io/Slowo-dnia/), FILES (space-separated
# list for "hashes", default: the prototype files "index.html sw.js courses/adult.js
# manifest.webmanifest"; "sums" and "dir" check every file of the build).
# Every request carries a unique query string so the CDN cache is bypassed.
set -euo pipefail

SITE_URL="${SITE_URL:-https://trajgiel.github.io/Slowo-dnia/}"
FILES="${FILES:-index.html sw.js courses/adult.js manifest.webmanifest}"

usage() {
  sed -n '2,23p' "$0" | sed 's/^# \{0,1\}//'
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

# live_sha256 <path relative to SITE_URL>: hash of the live file or "(download failed)".
live_sha256() {
  local h
  if h="$(curl -fsS -H 'Cache-Control: no-cache' "$(bust "$SITE_URL$1")" | sha256)"; then
    printf '%s' "$h"
  else
    printf '(download failed)'
  fi
}

# compare_sums: read "<sha256>  [./|*]<path>" lines on stdin, compare each file with the
# live site; for index.html also the page address itself (SITE_URL). Other lines are skipped.
compare_sums() {
  local fail=0 count=0 line hash path live
  while IFS= read -r line || [ -n "$line" ]; do
    line="${line%$'\r'}"
    # Site file names only: letters, digits, "._-" and "/"; no "..".
    [[ "$line" =~ ^([0-9a-f]{64})\ [\ \*](\./)?([A-Za-z0-9._/-]+)$ ]] || continue
    hash="${BASH_REMATCH[1]}"
    path="${BASH_REMATCH[3]}"
    case "$path" in
      *..* | /*)
        echo "Skipped unsafe path: $path" >&2
        continue
        ;;
    esac
    count=$((count + 1))
    live="$(live_sha256 "$path")"
    if [ "$hash" = "$live" ]; then
      printf 'OK    %s  %s\n' "$hash" "$path"
    else
      printf 'DIFF  %s  %s (live: %s)\n' "$hash" "$path" "$live"
      fail=1
    fi
    if [ "$path" = "index.html" ]; then
      live="$(live_sha256 "")"
      if [ "$hash" = "$live" ]; then
        printf 'OK    %s  (page address %s)\n' "$hash" "$SITE_URL"
      else
        printf 'DIFF  %s  (page address %s, live: %s)\n' "$hash" "$SITE_URL" "$live"
        fail=1
      fi
    fi
  done
  if [ "$count" -eq 0 ]; then
    echo "No sha256 lines found" >&2
    return 2
  fi
  echo "Checked $count files"
  return "$fail"
}

cmd_sums() {
  local src="${1:-}"
  if [ -z "$src" ] || { [ "$src" != "-" ] && [ ! -f "$src" ]; }; then
    usage
  fi
  echo "Site: $SITE_URL"
  if [ "$src" = "-" ]; then
    compare_sums
  else
    compare_sums <"$src"
  fi
}

cmd_dir() {
  local dir="${1:-}"
  [ -n "$dir" ] && [ -d "$dir" ] || usage
  echo "Site: $SITE_URL"
  echo "Build: $dir"
  # Same "<sha256>  ./<path>" lines as the run summary, computed locally.
  (cd "$dir" && find . -type f | LC_ALL=C sort | while IFS= read -r f; do
    printf '%s  %s\n' "$(sha256 <"$f")" "$f"
  done) | compare_sums
}

cmd_hashes() {
  local ref="${1:-origin/main}"
  git rev-parse --verify --quiet "$ref^{commit}" >/dev/null || {
    echo "Unknown git ref: $ref" >&2
    exit 2
  }
  case "$ref" in
    origin/*)
      git fetch --quiet origin || echo "Warning: git fetch origin failed, comparing with the local $ref" >&2
      ;;
  esac
  local fail=0 f local_hash live_hash
  echo "Site: $SITE_URL"
  echo "Ref:  $ref ($(git rev-parse --short "$ref"))"
  for f in $FILES; do
    if ! git cat-file -e "$ref:$f" 2>/dev/null; then
      printf 'MISSING %s (not in %s)\n' "$f" "$ref"
      fail=1
      continue
    fi
    local_hash="$(git show "$ref:$f" | sha256)"
    live_hash="$(live_sha256 "$f")"
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
  sums) shift; cmd_sums "$@" ;;
  dir) shift; cmd_dir "$@" ;;
  watch) shift; cmd_watch "$@" ;;
  *) usage ;;
esac
