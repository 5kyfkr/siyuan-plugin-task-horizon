'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const kernelSource = fs.readFileSync(path.join(root, 'kernel.js'), 'utf8');
const workbenchSource = fs.readFileSync(path.join(root, 'src', 'ai', 'agent-workbench.js'), 'utf8');
const bridgeSource = fs.readFileSync(path.join(root, 'src', 'task-horizon', 'main', 'shell', '81-ai-bridge-runtime.js'), 'utf8');
const calendarSource = fs.readFileSync(path.join(root, 'calendar-view.js'), 'utf8');

assert.match(kernelSource, /function taskMutationRefresh\(action, taskIDs, documentIDs\)/, 'task mutations must share one refresh metadata builder');
for (const action of ['create', 'update', 'move', 'delete', 'reminder']) {
    assert.match(kernelSource, new RegExp(`taskMutationRefresh\\('${action}'`), `${action} must publish task mutation refresh metadata`);
}

const collectorStart = workbenchSource.indexOf('function collectTaskMutationRefresh');
const collectorEnd = workbenchSource.indexOf('\n    async function applyDomainResultEffects', collectorStart);
assert.ok(collectorStart >= 0 && collectorEnd > collectorStart, 'task mutation result collector must remain extractable');
const collectorBlock = workbenchSource.slice(collectorStart, collectorEnd);
assert.match(collectorBlock, /visit\(value\.changes\)/, 'batch receipt changes must be collected');
assert.match(collectorBlock, /visit\(value\.data\)/, 'undo payloads must be collected');
assert.match(collectorBlock, /visit\(value\.items\)/, 'grouped task results must be collected');
assert.match(workbenchSource, /await aiBridge\(\)\?\.refreshTaskMutation\?\.\(refresh\)/, 'all collected task mutations must enter one bridge method');
assert.match(workbenchSource, /taskHorizonUndoLastMutation[\s\S]*?applyDomainResultEffects\('undo_last_mutation', result\)/, 'undo results must use the same refresh effects');
const collectTaskMutationRefresh = new Function('text', `${collectorBlock}; return collectTaskMutationRefresh;`)((value) => String(value || '').trim());
const collected = collectTaskMutationRefresh({
    items: [
        { changes: { task: { id: 'task-created', title: 'Created' }, refresh: { kind: 'task-mutation', action: 'create', taskIDs: ['task-created'], documentIDs: ['doc-a'] } } },
        { changes: { refresh: { kind: 'task-mutation', action: 'delete', taskIDs: ['task-deleted'], documentIDs: ['doc-b'] } } },
    ],
    data: { task: { id: 'task-undone', title: 'Undone' }, refresh: { kind: 'task-mutation', action: 'update', taskIDs: ['task-undone'], documentIDs: ['doc-a'] } },
});
assert.deepEqual(collected.taskIDs.slice().sort(), ['task-created', 'task-deleted', 'task-undone']);
assert.deepEqual(collected.documentIDs.slice().sort(), ['doc-a', 'doc-b']);
assert.deepEqual(collected.deletedTaskIDs, ['task-deleted']);
assert.deepEqual(collected.tasks.map((task) => task.id).sort(), ['task-created', 'task-undone']);
assert.equal(collected.requiresDocumentReload, true);
assert.equal(collectTaskMutationRefresh({ refresh: { kind: 'task-mutation', action: 'update', taskIDs: ['task-a'], documentIDs: ['doc-a'] } }).requiresDocumentReload, false);

const refreshStart = bridgeSource.indexOf('async function __tmAiRefreshTaskMutation');
const refreshEnd = bridgeSource.indexOf('\n    __tmNs.aiBridge = {', refreshStart);
assert.ok(refreshStart >= 0 && refreshEnd > refreshStart, 'AI mutation refresh bridge must remain extractable');
const refreshBlock = bridgeSource.slice(refreshStart, refreshEnd);
assert.match(refreshBlock, /__tmCacheTaskInState\(/, 'changed tasks must update local state first');
assert.match(refreshBlock, /removeLocal\?\.\(taskID/, 'deleted tasks must leave local state immediately');
assert.match(refreshBlock, /__tmInvalidateTasksQueryCacheByDocId\(docId\)/, 'affected document query caches must be invalidated');
assert.match(refreshBlock, /index \+= 12/, 'large mutation receipts must be split into bounded document refreshes');
assert.match(refreshBlock, /__tmRefreshAffectedDocsIncrementally\(/, 'affected documents must use the existing incremental loader');
assert.match(refreshBlock, /forcePositionRank:\s*requiresDocumentReload/, 'only creates, moves, and deletes should rebuild document placement');
assert.match(refreshBlock, /__tmRefreshViewsAfterTaskMutation\(/, 'the existing view scheduler must remain the fallback');
assert.match(bridgeSource, /async refreshTaskMutation\(payload\)[\s\S]*?__tmAiRefreshTaskMutation\(payload\)/, 'the AI bridge must expose the unified refresh method');
assert.match(workbenchSource, /SCHEDULE_MUTATION_TOOLS[\s\S]*refreshScheduleMutation/, 'schedule tool results must trigger the schedule refresh bridge');
assert.match(bridgeSource, /async function __tmAiRefreshScheduleMutation[\s\S]*refreshSchedulesFromSharedFile[\s\S]*side: true/, 'AI schedule writes must reload shared data and refresh the side-day calendar');
assert.match(bridgeSource, /tm:calendar-schedule-updated[\s\S]*source: 'ai-schedule-mutation'/, 'AI schedule writes must notify other schedule consumers');
assert.match(bridgeSource, /async refreshScheduleMutation\(payload\)[\s\S]*__tmAiRefreshScheduleMutation\(payload\)/, 'the AI bridge must publish schedule refreshes');
assert.match(calendarSource, /async function refreshSchedulesFromSharedFile[\s\S]*refreshScheduleCacheFromSharedFile\(\)[\s\S]*side: true/, 'calendar refresh must replace its stale schedule cache before refetching the side calendar');
assert.match(calendarSource, /refreshSchedulesFromSharedFile,/, 'the calendar API must expose shared schedule cache refresh');

process.stdout.write('agent task mutation refresh contract tests passed\n');
