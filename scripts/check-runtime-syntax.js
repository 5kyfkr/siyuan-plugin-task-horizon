'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { execFileSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const sourceRoot = path.join(root, 'src/task-horizon');
const manifest = JSON.parse(fs.readFileSync(path.join(sourceRoot, 'manifest.main.json'), 'utf8'));
assert.ok(Array.isArray(manifest.scripts) && manifest.scripts.length, 'Runtime manifest is empty');
const tracked = new Set(execFileSync('git', ['ls-files', '-z'], { cwd: root, encoding: 'utf8' }).split('\0'));
const seen = new Set();
const source = manifest.scripts.map(relativePath => {
    assert.equal(typeof relativePath, 'string', 'Invalid manifest path');
    const normalized = relativePath.replace(/\\/g, '/');
    assert.ok(normalized && !normalized.split('/').some(part => !part || part === '.' || part === '..'), `Invalid manifest path: ${relativePath}`);
    const file = path.resolve(sourceRoot, normalized);
    assert.ok(file.startsWith(sourceRoot + path.sep), `Manifest script escaped source root: ${relativePath}`);
    assert.ok(!seen.has(normalized), `Duplicate manifest script: ${relativePath}`);
    seen.add(normalized);
    assert.ok(tracked.has('src/task-horizon/' + normalized), `Manifest script is not tracked by Git: ${relativePath}`);
    return fs.readFileSync(file, 'utf8');
}).join('\n');
new vm.Script(source, { filename: 'task-horizon.main.js' });

for (const file of ['index.js', 'ai.js', 'calendar-view.js', 'homepage.js', 'quickbar.js', 'kernel.js', 'calendar-subscription-core.js', 'src/ai/agent-workbench.js']) {
    new vm.Script(fs.readFileSync(path.join(root, file), 'utf8'), { filename: file });
}
const plugin = JSON.parse(fs.readFileSync(path.join(root, 'plugin.json'), 'utf8'));
const version = source.match(/^\/\/ @version\s+(\S+)/m)?.[1];
assert.equal(version, plugin.version, 'Runtime and plugin versions differ');
console.log(`Runtime syntax, manifest paths and version verified (${manifest.scripts.length} fragments)`);
