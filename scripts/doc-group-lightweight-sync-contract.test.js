'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const syncRuntime = fs.readFileSync(path.join(root, 'src/task-horizon/main/render/39-render-doc-group-sync-and-refresh.js'), 'utf8');

assert.match(syncRuntime, /function __tmShouldVerifyDocGroupScope\([\s\S]*?scopeVerifyTtlMs \|\| 60000/, 'recursive document scope verification must be throttled');
assert.match(syncRuntime, /remoteFingerprint && remoteFingerprint !== currentFingerprint[\s\S]*?const previousScopeFingerprint[\s\S]*?const refreshedScopeFingerprint[\s\S]*?skipTaskReload: !scopeChanged/, 'remote group changes must compare document scope before reloading tasks');
assert.match(syncRuntime, /if \(opt\.skipTaskReload === true\) \{[\s\S]*?__tmRecomputeTaskProjection\([\s\S]*?\} else \{[\s\S]*?await loadSelectedDocuments/, 'unchanged document scope must only refresh derived UI state');
assert.match(syncRuntime, /if \(!__tmShouldVerifyDocGroupScope\(currentGroupId, opt\)\) return false;/, 'unchanged group configuration must skip repeated scope queries within the TTL');
assert.match(syncRuntime, /source: 'doc-group-dropdown-scope-sync'[\s\S]*?\}\);/, 'scope changes must retain the existing full reload path');

console.log('doc group lightweight sync contract tests passed');
