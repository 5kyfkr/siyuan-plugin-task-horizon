'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(
    path.join(__dirname, '../src/task-horizon/main/10-stores-rules-and-cache.js'),
    'utf8',
);

assert.doesNotMatch(source, /\[Task Horizon doc-group sync\]/,
    'settings persistence must not emit developer diagnostic logs');
assert.doesNotMatch(source, /doc-group-sync-debug\.json|__tmLogDocGroupSync/,
    'settings persistence must not write a diagnostic log file');

console.log('document-group sync diagnostics removal tests passed');
