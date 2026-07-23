'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const apiRuntime = fs.readFileSync(path.join(root, 'src/task-horizon/main/20-api-and-runtime-services.js'), 'utf8');
const dialogRuntime = fs.readFileSync(path.join(root, 'src/task-horizon/main/30-dialogs-and-ui-foundation.js'), 'utf8');

assert.match(apiRuntime, /async getTaskFreshnessByDocuments\(docIds\)[\s\S]*?d\.updated AS doc_updated[\s\S]*?COUNT\(\*\) AS task_count[\s\S]*?MAX\(t\.updated\) AS task_updated/, 'task freshness must use a compact aggregate query');
assert.match(dialogRuntime, /async function __tmProbeCurrentGroupTaskFreshness\(\)[\s\S]*?API\.getTaskFreshnessByDocuments\(docIds\)[\s\S]*?changedDocIds/, 'group switching must compare the rendered snapshot with live task freshness');
assert.match(dialogRuntime, /status: 'unknown',[\s\S]*?unavailable: true/, 'an unavailable freshness probe must return an explicit unknown state');
assert.match(dialogRuntime, /freshnessStatus === 'unchanged'[\s\S]*?__tmDocGroupFreshnessFallbackAtByGroup[\s\S]*?now - lastFallbackAt < 60000/, 'unknown freshness must use a per-group cooldown instead of being treated as unchanged');
assert.match(dialogRuntime, /const refreshGate = __tmGetBackgroundRefreshGateMeta[\s\S]*?if \(!refreshGate\.allowRun\)[\s\S]*?unknownFallbackAtByGroup\[groupId\] = Date\.now\(\)/, 'a deferred unknown fallback must start its cooldown only when the refresh can actually run');
assert.match(dialogRuntime, /forceFreshTasks: true,[\s\S]*?source: freshnessStatus === 'unknown'[\s\S]*?'switch-doc-group:task-freshness-unknown'[\s\S]*?'switch-doc-group:task-freshness-changed'/, 'changed and unknown freshness states must both reach the bounded full-refresh path');
assert.match(dialogRuntime, /const refreshGate = __tmGetBackgroundRefreshGateMeta\(`\$\{source\}:task-refresh`\);[\s\S]*?if \(!refreshGate\.allowRun\)/, 'changed-task refresh must still yield to active interaction and scrolling');
assert.match(dialogRuntime, /'switch-doc-group:task-freshness-changed'[\s\S]*?__tmRerenderCurrentViewInPlace\(modal\)/, 'refreshed tasks must update the current view without requiring manual refresh');

console.log('doc group task freshness contract tests passed');
