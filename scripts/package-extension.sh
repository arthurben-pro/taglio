#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
EXT_DIR="$ROOT_DIR/extension"
DIST_DIR="$ROOT_DIR/dist"
OUTPUT="$DIST_DIR/taglio-extension.zip"
MANIFEST="$EXT_DIR/manifest.json"

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1" >&2
    exit 1
  fi
}

check_path() {
  local relative_path="$1"
  if [ ! -f "$EXT_DIR/$relative_path" ]; then
    echo "Missing manifest asset: $relative_path" >&2
    exit 1
  fi
}

require_command jq
require_command zip

if [ ! -f "$MANIFEST" ]; then
  echo "Missing manifest.json in $EXT_DIR" >&2
  exit 1
fi

manifest_version="$(jq -r '.manifest_version' "$MANIFEST")"
name="$(jq -r '.name' "$MANIFEST")"
description="$(jq -r '.description' "$MANIFEST")"
version="$(jq -r '.version' "$MANIFEST")"

if [ "$manifest_version" != "3" ]; then
  echo "manifest_version must be 3" >&2
  exit 1
fi

if [ "$name" != "Taglio" ]; then
  echo "Extension name must be Taglio" >&2
  exit 1
fi

if [ -z "$description" ] || [ "$description" = "null" ]; then
  echo "Extension description is required" >&2
  exit 1
fi

if [ -z "$version" ] || [ "$version" = "null" ]; then
  echo "Extension version is required" >&2
  exit 1
fi

while IFS= read -r icon_path; do
  check_path "$icon_path"
done < <(jq -r '.icons | to_entries[] | .value' "$MANIFEST")

popup_path="$(jq -r '.action.default_popup // empty' "$MANIFEST")"
if [ -n "$popup_path" ]; then
  check_path "$popup_path"
fi

while IFS= read -r script_path; do
  check_path "$script_path"
done < <(jq -r '.content_scripts[]?.js[]?' "$MANIFEST")

mkdir -p "$DIST_DIR"
rm -f "$OUTPUT"

(
  cd "$EXT_DIR"
  zip -qr "$OUTPUT" .
)

echo "Packaged extension at $OUTPUT"
