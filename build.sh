#!/bin/bash
set -e

OUTPUT="package.zip"
PLUGIN_DIR="."

ORIGINAL_DIR="$(pwd)"
TEMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TEMP_DIR"' EXIT

cp -R "$PLUGIN_DIR"/. "$TEMP_DIR/"

rm -rf "$TEMP_DIR/.git"
rm -rf "$TEMP_DIR/.github"
rm -rf "$TEMP_DIR/.vscode"
rm -f  "$TEMP_DIR/.gitignore"
rm -f  "$TEMP_DIR/.impeccable.md"
rm -rf "$TEMP_DIR/.history"
rm -rf "$TEMP_DIR/.idea"
rm -f  "$TEMP_DIR/.DS_Store"
rm -rf "$TEMP_DIR/node_modules"
rm -rf "$TEMP_DIR/docs"
rm -f  "$TEMP_DIR/GUIDE_zh_CN.md"
rm -f  "$TEMP_DIR/REPRO_SYNC.md"
rm -f  "$TEMP_DIR/PRODUCT.md"
rm -f  "$TEMP_DIR/CHANGELOG.md"
rm -f  "$TEMP_DIR/LICENSE"
rm -f  "$TEMP_DIR/build.sh"
rm -f  "$TEMP_DIR/build.bat"
rm -f  "$TEMP_DIR/build.ps1"
rm -f  "$TEMP_DIR/.hotreload"
rm -f  "$TEMP_DIR/$OUTPUT"

# Concatenate src/task-horizon/manifest.main.json scripts into task.js,
# matching Build-TaskHorizonMainFromManifest in build.ps1.
SOURCE_ROOT="$TEMP_DIR/src/task-horizon"
MANIFEST="$SOURCE_ROOT/manifest.main.json"
if [ -f "$MANIFEST" ]; then
    SCRIPT_LIST="$(python3 - "$MANIFEST" <<'PYEOF'
import json, sys
with open(sys.argv[1], 'r', encoding='utf-8') as f:
    data = json.load(f)
scripts = data.get('scripts') or []
if not scripts:
    sys.stderr.write('src/task-horizon/manifest.main.json scripts missing\n')
    sys.exit(1)
for raw in scripts:
    s = (raw or '').strip().replace('\\', '/')
    if not s:
        continue
    parts = [p for p in s.split('/') if p]
    if not parts or '.' in parts or '..' in parts:
        sys.stderr.write('Invalid src/task-horizon manifest script path: ' + str(raw) + '\n')
        sys.exit(1)
    print('/'.join(parts))
PYEOF
)"

    OUT_TASK_JS="$TEMP_DIR/task.js"
    : > "$OUT_TASK_JS"
    while IFS= read -r rel_path; do
        [ -z "$rel_path" ] && continue
        candidate="$SOURCE_ROOT/$rel_path"
        if [ ! -f "$candidate" ]; then
            echo "Missing src/task-horizon manifest script: $rel_path" >&2
            exit 1
        fi
        printf '/* task-horizon build: begin %s */\n' "$rel_path" >> "$OUT_TASK_JS"
        cat "$candidate" >> "$OUT_TASK_JS"
        printf '\n\n/* task-horizon build: end %s */\n\n' "$rel_path" >> "$OUT_TASK_JS"
    done <<< "$SCRIPT_LIST"

    rm -rf "$SOURCE_ROOT"
fi

# Drop any stray .zip files at the temp root before packaging
find "$TEMP_DIR" -maxdepth 1 -type f -name '*.zip' -delete

# Reset file timestamps to UTC+8 (China time) for reproducible packaging
TZ_TIMESTAMP="$(TZ=Asia/Shanghai date '+%Y%m%d%H%M.%S')"
find "$TEMP_DIR" -type f -exec touch -t "$TZ_TIMESTAMP" {} +

if [ -f "$ORIGINAL_DIR/$OUTPUT" ]; then
    rm -f "$ORIGINAL_DIR/$OUTPUT"
fi

(cd "$TEMP_DIR" && zip -r "$ORIGINAL_DIR/$OUTPUT" .)

echo "Pack success: $ORIGINAL_DIR/$OUTPUT"
