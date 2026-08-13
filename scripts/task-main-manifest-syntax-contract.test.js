'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..', 'src', 'task-horizon');
const repositoryRoot = path.resolve(root, '..', '..');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.main.json'), 'utf8'));
const releaseVerification = fs.readFileSync(path.join(repositoryRoot, 'scripts', 'verify-release.ps1'), 'utf8');
assert.ok(Array.isArray(manifest.scripts) && manifest.scripts.length > 0,
    'task runtime manifest must list source files');

const source = manifest.scripts.map((relativePath) => {
    const scriptPath = path.resolve(root, relativePath);
    assert.ok(scriptPath.startsWith(`${root}${path.sep}`),
        `manifest script must stay inside the task runtime: ${relativePath}`);
    return fs.readFileSync(scriptPath, 'utf8');
}).join('\n');

assert.doesNotThrow(() => new vm.Script(source, { filename: 'task-horizon.dev-main.js' }),
    'concatenated task runtime must be valid JavaScript');
assert.match(releaseVerification, /git -C \$root ls-files -- \$repoRelativePath/);
assert.match(releaseVerification, /Manifest script is not tracked by Git/);

console.log(`task main manifest syntax contract tests passed (${manifest.scripts.length} files)`);
