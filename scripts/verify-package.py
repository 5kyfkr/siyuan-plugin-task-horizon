"""Validate the final release artifact with Python's raw ZIP entry names."""
import json
import re
import subprocess
import sys
import tempfile
import zipfile
from pathlib import Path, PurePosixPath

ROOT = Path(__file__).resolve().parent.parent


def verify(package_path):
    plugin = json.loads((ROOT / 'plugin.json').read_text(encoding='utf-8-sig'))
    with zipfile.ZipFile(package_path) as archive:
        names = set()
        for entry in archive.infolist():
            name = entry.orig_filename
            if '\x00' in name or '\\' in name or name.startswith('/') or ':' in name or any(part in ('.', '..') for part in name.split('/')):
                raise ValueError('Invalid ZIP entry path: ' + name)
            if name in names:
                raise ValueError('Duplicate ZIP entry: ' + name)
            names.add(name)
            if re.match(r'^(\.git(?:/|$)|\.github/|\.codex-tmp/|\.playwright-cli/|output/|scripts/|docs/|node_modules/|src/task-horizon/|build\.(ps1|sh|bat)$|package\.zip$)', name):
                raise ValueError('Development file leaked into package: ' + name)

        def read(name):
            if name not in names:
                raise ValueError('Package entry missing: ' + name)
            return archive.read(name)

        packaged_plugin = json.loads(read('plugin.json'))
        if (packaged_plugin.get('name'), packaged_plugin.get('version')) != (plugin['name'], plugin['version']):
            raise ValueError('Packaged plugin name/version differs from source')
        required = ['plugin.json', 'README.md', 'index.js', 'ai.js', 'homepage.js', 'quickbar.js', 'kernel.js',
                    'calendar-view.js', 'calendar-subscription-core.js', 'calendar-view.css', 'task-horizon.css', 'icon.png', 'preview.png']
        required.extend(file.relative_to(ROOT).as_posix() for file in (ROOT / 'src').rglob('*')
                        if file.is_file() and not file.is_relative_to(ROOT / 'src/task-horizon'))
        # Check every packaged JS/CSS asset too, including lazy AI/calendar modules.
        assets = {name for name in names if name != 'task.js' and name.endswith(('.js', '.css'))}
        for name in set(required) | assets:
            source = ROOT.joinpath(*PurePosixPath(name).parts)
            if read(name) != source.read_bytes():
                raise ValueError('Package entry differs from current source: ' + name)

        runtime = read('task.js').decode('utf-8-sig').replace('\r\n', '\n')
        version = re.search(r'^// @version\s+(\S+)', runtime, re.MULTILINE)
        if not version or version[1] != plugin['version']:
            raise ValueError('Packaged task runtime version differs from plugin.json')
        source_root = ROOT / 'src/task-horizon'
        manifest = json.loads((source_root / 'manifest.main.json').read_text(encoding='utf-8-sig'))
        cursor = 0
        for name in manifest['scripts']:
            content = (source_root / name).read_text(encoding='utf-8-sig')
            position = runtime.find(content, cursor)
            if position < 0:
                raise ValueError('Packaged runtime fragment missing, stale or reordered: ' + name)
            cursor = position + len(content)
        with tempfile.TemporaryDirectory(prefix='task-horizon-package-') as temporary:
            runtime_path = Path(temporary) / 'task.js'
            runtime_path.write_text(runtime, encoding='utf-8')
            result = subprocess.run(['node', '--check', str(runtime_path)], capture_output=True, text=True)
            if result.returncode:
                raise ValueError('Packaged task runtime syntax check failed: ' + result.stderr)
    print(f"Package verified: {plugin['name']} {plugin['version']}, current sources, runtime order, syntax and ZIP contents")


if __name__ == '__main__':
    try:
        verify(Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / 'package.zip')
    except (ValueError, OSError, zipfile.BadZipFile, KeyError) as error:
        print(str(error), file=sys.stderr)
        sys.exit(1)
