'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const kernel = fs.readFileSync(path.resolve(__dirname, '..', 'kernel.js'), 'utf8');

assert.match(kernel, /function normalizeTaskScope\(input\)[\s\S]*taskIDs:[\s\S]*documentIDs:/, 'statistics must normalize structured task scope fields');
assert.match(kernel, /function registerTaskScope\(input\)[\s\S]*taskIDs[\s\S]*scopeToken[\s\S]*taskCount/, 'the kernel must register complete task scopes behind opaque tokens');
assert.match(kernel, /resolveTaskScopeToken\(source\.scopeToken\)/, 'task scope normalization must fail closed through the registry');
assert.match(kernel, /appendTaskScopeConditions\(conditions, scope, 't'\)/, 'completion statistics must apply task and document scope to SQL');
assert.match(kernel, /appendTaskScopeConditions\(taskConditions, scope, 't'\)/, 'time statistics must apply task and document scope to SQL');
assert.match(kernel, /const scopedTaskIDs = new Set\(rows\.map[\s\S]*await loadSchedules\(\)\)\.filter/, 'planned time aggregation must scan all schedules and restrict them to the complete task scope');
assert.doesNotMatch(kernel, /LIMIT 100000/, 'internal aggregations must not truncate large task scopes');
assert.match(kernel, /'aggregate_task_stats'[\s\S]*scopeToken:[\s\S]*taskIDs:[\s\S]*documentIDs:/, 'task statistics schema must publish the compact scope token');
assert.match(kernel, /'aggregate_task_stats'[\s\S]*customFieldIDs:[\s\S]*maxItems: 20/, 'custom-field grouping must be explicit and bounded to limit result tokens');
assert.match(kernel, /function customFieldBreakdown[\s\S]*directCount:[\s\S]*totalCount:[\s\S]*byCustomField:[\s\S]*\.\.\.customFieldBreakdown/, 'task statistics must return direct custom-field counts and deduplicated hierarchy rollups');
assert.match(kernel, /customFieldDefinitions: customFieldDefinitions\(completed\.registry\)/, 'task statistics must expose hierarchy definitions even before a custom grouping is requested');
assert.match(kernel, /byStatus: countByLabeled[\s\S]*resolveStatusName/, 'status statistics must use configured display names instead of raw IDs');
assert.match(kernel, /byPriority: countByLabeled[\s\S]*resolvePriorityName/, 'priority statistics must use localized display names instead of raw IDs');
assert.match(kernel, /missingCompletionTime: completed\.missingCompletionTime/, 'task statistics must expose missing completion-time coverage');
assert.match(kernel, /substr\(completed_at, 1, 10\)[\s\S]*SELECT \* FROM \([\s\S]*completed_tasks/, 'task statistics must push date-range filtering into SQLite');
assert.match(kernel, /'aggregate_time_usage'[\s\S]*scopeToken:[\s\S]*taskIDs:[\s\S]*documentIDs:/, 'time statistics schema must publish the compact scope token');
assert.doesNotMatch(kernel, /coverage: \{[^\n]*taskIDs: scope\.taskIDs/, 'aggregate results must not echo the complete ID set back into model context');

console.log('kernel statistics scope contract tests passed');
