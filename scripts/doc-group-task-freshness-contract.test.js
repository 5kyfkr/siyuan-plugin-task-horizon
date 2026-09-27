'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const apiRuntime = fs.readFileSync(path.join(root, 'src/task-horizon/main/20-api-and-runtime-services.js'), 'utf8');
const dialogRuntime = fs.readFileSync(path.join(root, 'src/task-horizon/main/30-dialogs-and-ui-foundation.js'), 'utf8');

assert.match(apiRuntime, /async getTaskFreshnessByDocuments\(docIds\)[\s\S]*?d\.updated AS doc_updated[\s\S]*?COUNT\(DISTINCT t\.id\) AS task_count[\s\S]*?MAX\(t\.updated\) AS task_updated/, 'task freshness must count logical task IDs in its compact aggregate query');
assert.match(dialogRuntime, /async function __tmProbeCurrentGroupTaskFreshness\(\)[\s\S]*?API\.getTaskFreshnessByDocuments\(docIds\)[\s\S]*?changedDocIds/, 'group switching must compare the rendered snapshot with live task freshness');
assert.match(dialogRuntime, /status: 'unknown',[\s\S]*?unavailable: true/, 'an unavailable freshness probe must return an explicit unknown state');
assert.match(dialogRuntime, /__tmDocGroupFreshnessFallbackAtByGroup[\s\S]*?now - lastFallbackAt < 60000/, 'unknown freshness must use a per-group cooldown instead of being treated as unchanged');
assert.match(dialogRuntime, /const refreshGate = __tmGetBackgroundRefreshGateMeta[\s\S]*?if \(!refreshGate\.allowRun\)[\s\S]*?await __tmVerifyCachedTaskScope\(\{/, 'a deferred fallback must enter the shared verifier only when the refresh can actually run');
assert.match(dialogRuntime, /freshness\?\.status === 'changed'[\s\S]*?__tmRefreshAffectedDocsIncrementally\(/, 'changed freshness must refresh only the affected documents');
assert.match(dialogRuntime, /const refreshGate = __tmGetBackgroundRefreshGateMeta\(`\$\{source\}:task-refresh`\);[\s\S]*?if \(!refreshGate\.allowRun\)/, 'changed-task refresh must still yield to active interaction and scrolling');
assert.match(dialogRuntime, /'switch-doc-group:task-freshness-changed'[\s\S]*?__tmRerenderCurrentViewInPlace\(modal\)/, 'refreshed tasks must update the current view without requiring manual refresh');

console.log('doc group task freshness contract tests passed');
