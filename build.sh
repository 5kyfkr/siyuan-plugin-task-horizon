#!/bin/bash
set -e

OUTPUT="package.zip"
PLUGIN_DIR="."

ORIGINAL_DIR="$(pwd)"
TEMP_DIR="$(mktemp -d)"

cp -R "$PLUGIN_DIR"/. "$TEMP_DIR/"

rm -rf "$TEMP_DIR/.git"
rm -rf "$TEMP_DIR/.github"
rm -rf "$TEMP_DIR/.vscode"
rm -f  "$TEMP_DIR/.gitignore"
rm -rf "$TEMP_DIR/.history"
rm -rf "$TEMP_DIR/.idea"
rm -f  "$TEMP_DIR/.DS_Store"
rm -rf "$TEMP_DIR/node_modules"
rm -f  "$TEMP_DIR/GUIDE_zh_CN.md"
rm -f  "$TEMP_DIR/REPRO_SYNC.md"
rm -f  "$TEMP_DIR/CHANGELOG.md"
rm -f  "$TEMP_DIR/LICENSE"
rm -f  "$TEMP_DIR/build.sh"
rm -f  "$TEMP_DIR/build.bat"
rm -f  "$TEMP_DIR/build.ps1"
rm -f  "$TEMP_DIR/.hotreload"
rm -f  "$TEMP_DIR/$OUTPUT"

(cd "$TEMP_DIR" && zip -r "$ORIGINAL_DIR/$OUTPUT" .)
rm -rf "$TEMP_DIR"
