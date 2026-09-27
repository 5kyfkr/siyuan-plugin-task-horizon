'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const sourceRoot = path.join(__dirname, '../src/task-horizon');
const manifest = JSON.parse(fs.readFileSync(path.join(sourceRoot, 'manifest.main.json'), 'utf8'));
const forbidden = /__tmMovePerf|movePerf(?:End|Refs|OpIds|WaitMs|Phases|EntryCount)|\[task-horizon:move-perf\]|two-raf-delay|uiInlineLoadingReason/;
for (const relativePath of manifest.scripts) {
    const source = fs.readFileSync(path.join(sourceRoot, relativePath), 'utf8');
    assert.doesNotMatch(source, forbidden, `${relativePath} must not install or invoke temporary move tracing`);
}
console.log(`Move diagnostics removal contract passed for ${manifest.scripts.length} runtime fragments`);
