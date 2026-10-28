#!/usr/bin/env bash
# Check the production build before it is uploaded to GitHub Pages.
#
#   deploy/check-dist.sh [dir]           (default dir: dist)
#
# Fails (exit 1) if the site would be incomplete or wrong for the installed app:
# - files the offline part and the installed app rely on are missing
#   (sw.js at the prototype's address, manifest.webmanifest, icons/);
# - a font has no SIL OFL licence next to it, or LICENSE is missing;
# - the page is the source index.html (/src/main.tsx) or not built for /Slowo-dnia/;
# - the service worker still has the unreplaced precache placeholder;
# - source maps would be published.
# Exit 2 on wrong usage.
set -euo pipefail

BASE_PATH="/Slowo-dnia/"
dir="${1:-dist}"

if [ "$#" -gt 1 ] || [ ! -d "$dir" ]; then
  echo "Usage: deploy/check-dist.sh [dir]  (directory not found: $dir)" >&2
  exit 2
fi

fail=0
error() {
  echo "ERROR $*"
  fail=1
}

# Fixed paths: page, offline part, manifest, icons (manifest + index.html), licences.
required=(
  index.html
  sw.js
  manifest.webmanifest
  LICENSE
  icons/apple-touch-icon.png
  icons/icon-192.png
  icons/icon-512.png
  icons/icon-maskable-512.png
  fonts/OFL-caveat.txt
  fonts/OFL-nunito.txt
)
for f in "${required[@]}"; do
  if [ -s "$dir/$f" ]; then
    echo "OK    $f"
  else
    error "missing or empty: $f"
  fi
done

# Every font family ships with its licence: fonts/<family>-*.woff2 -> fonts/OFL-<family>.txt.
shopt -s nullglob
fonts=("$dir"/fonts/*.woff2)
if [ "${#fonts[@]}" -eq 0 ]; then
  error "no fonts in fonts/"
fi
# ${a[@]+...}: empty arrays are "unbound" under set -u in bash 3.2 (macOS).
for font in ${fonts[@]+"${fonts[@]}"}; do
  name="$(basename "$font")"
  family="${name%%-*}"
  if [ -s "$dir/fonts/OFL-$family.txt" ]; then
    echo "OK    fonts/$name (licence fonts/OFL-$family.txt)"
  else
    error "font without licence: fonts/$name (expected fonts/OFL-$family.txt)"
  fi
done

# Hashed bundles: code, styles and the adult course (loaded on demand, precached).
for pattern in 'assets/*.js' 'assets/*.css' 'assets/adult-*.json'; do
  # shellcheck disable=SC2206 # the glob is meant to expand here
  matches=("$dir"/$pattern)
  if [ "${#matches[@]}" -gt 0 ]; then
    echo "OK    $pattern (${#matches[@]})"
  else
    error "no files match $pattern"
  fi
done
shopt -u nullglob

if [ -f "$dir/index.html" ]; then
  if grep -q '/src/main.tsx' "$dir/index.html"; then
    error "index.html is the source page (/src/main.tsx), not the build"
  fi
  if ! grep -q "src=\"${BASE_PATH}assets/" "$dir/index.html"; then
    error "index.html does not load scripts from ${BASE_PATH}assets/ (check Vite base)"
  fi
fi

if [ -f "$dir/sw.js" ] && grep -q '__WB_MANIFEST' "$dir/sw.js"; then
  error "sw.js still contains self.__WB_MANIFEST (precache list not injected)"
fi

maps="$(find "$dir" -type f -name '*.map' | sort)"
if [ -n "$maps" ]; then
  error "source maps must not be published:"
  echo "$maps"
fi

if [ "$fail" -ne 0 ]; then
  echo "Build check failed: $dir"
  exit 1
fi
echo "Build check passed: $dir"
