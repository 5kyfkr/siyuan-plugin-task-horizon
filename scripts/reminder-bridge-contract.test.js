'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const apiSource = fs.readFileSync(path.join(root, 'src', 'task-horizon', 'main', '20-api-and-runtime-services.js'), 'utf8');
const lifecycleSource = fs.readFileSync(path.join(root, 'src', 'task-horizon', 'main', 'shell', '80-shell-lifecycle.js'), 'utf8');
const calendarSource = fs.readFileSync(path.join(root, 'calendar-view.js'), 'utf8');
const repeatRuntimeSource = fs.readFileSync(path.join(root, 'src', 'task-horizon', 'main', 'task-runtime', '54-recurring-task-runtime.js'), 'utf8');
const taskDetailSource = fs.readFileSync(path.join(root, 'src', 'task-horizon', 'main', 'task-runtime', '52-task-detail-runtime.js'), 'utf8');

const saveStart = apiSource.indexOf('async function __tmSaveTaskReminderForTask');
const saveEnd = apiSource.indexOf('\n    function __tmInvalidateTaskReminderMark', saveStart);
assert.ok(saveStart >= 0 && saveEnd > saveStart, 'Task Horizon reminder save block must remain extractable');
const saveBlock = apiSource.slice(saveStart, saveEnd);

assert.match(saveBlock, /__tmGetTomatoReminderBridgeV1\(\)/, 'Task Horizon must require the versioned Tomato writer');
assert.match(saveBlock, /reminderBridge\.upsert\(/, 'Task Horizon must save through Tomato upsert');
assert.match(saveBlock, /__tmApplyFollowReminderDraft\(/, 'Task Horizon reminder saves must backfill canonical task fields first');
assert.ok(saveBlock.indexOf('reminderBridge.get(') < saveBlock.indexOf('__tmApplyFollowReminderDraft('), 'existing reminders must be detected before task fields are changed');
assert.doesNotMatch(saveBlock, /\/api\/attr\/setBlockAttrs/, 'Task Horizon reminder save must not write the reminder attribute directly');
assert.doesNotMatch(saveBlock, /tomato-reminder-updated/, 'Task Horizon save must not emit a second business event');

const bridgeStart = apiSource.indexOf('__tmNs.reminderBridge = {');
const bridgeEnd = apiSource.indexOf('\n    function __tmApplyReminderTaskNameMarks', bridgeStart);
assert.ok(bridgeStart >= 0 && bridgeEnd > bridgeStart, 'Task Horizon reminder bridge must remain extractable');
const bridgeBlock = apiSource.slice(bridgeStart, bridgeEnd);
assert.match(bridgeBlock, /version:\s*1/, 'Task Horizon reminder bridge must publish a version');
assert.match(bridgeBlock, /completeFromReminder[\s\S]*?__tmMaybeAdvanceRecurringTaskFromReminderRecord\(/, 'Tomato completion must enter the existing Task Horizon completion path once');
assert.match(repeatRuntimeSource, /version:\s*3/, 'Task Horizon must upgrade the reminder bridge to v3 after recurrence services load');
assert.match(repeatRuntimeSource, /taskOwnsRepeatSchedule:\s*true/, 'bridge v3 must declare task-owned recurrence');
assert.match(repeatRuntimeSource, /applyFollowDraft:\s*__tmApplyFollowReminderDraft/, 'bridge v3 must expose follow-draft writes');
assert.match(repeatRuntimeSource, /clearFollowDraft:\s*__tmClearFollowReminderDraft/, 'bridge v3 must expose ownership-safe reminder cleanup');

const followDraftStart = repeatRuntimeSource.indexOf('async function __tmApplyFollowReminderDraft');
const followDraftEnd = repeatRuntimeSource.indexOf('\n    async function __tmClearFollowReminderDraft', followDraftStart);
assert.ok(followDraftStart >= 0 && followDraftEnd > followDraftStart, 'follow-draft writer must remain extractable');
const followDraftBlock = repeatRuntimeSource.slice(followDraftStart, followDraftEnd);
assert.match(followDraftBlock, /__tmApplyTaskMetaPatchWithUndo\(task\.id, \{\s*completionTime,\s*\}/, 'reminder edits may update the current task due date');
assert.doesNotMatch(followDraftBlock, /repeatPatch|repeatRule:\s*source\.|repeatState:\s*source\./, 'reminder edits must not write task-owned repeat fields');

const clearDraftStart = followDraftEnd + 1;
const clearDraftEnd = repeatRuntimeSource.indexOf('\n    try {\n        const previousBridge', clearDraftStart);
assert.ok(clearDraftStart > 0 && clearDraftEnd > clearDraftStart, 'follow-draft cleanup must remain extractable');
const clearDraftBlock = repeatRuntimeSource.slice(clearDraftStart, clearDraftEnd);
assert.match(clearDraftBlock, /changed:\s*false/, 'deleting a reminder must not mutate the task schedule');
assert.doesNotMatch(clearDraftBlock, /__tmApplyTaskMetaPatchWithUndo/, 'deleting a reminder must not clear task dates or recurrence');

for (const removed of [
    '__TM_REMINDER_UPDATE_EVENT_NAMES',
    '__tmReminderFollowTaskRepeatUpdateHandler',
    '__tmMaybeAdvanceRecurringTaskFromReminderAttr',
    '__tmMaybeAdvanceRecurringTaskFromReminderUpdateEvent',
]) {
    assert.doesNotMatch(apiSource + lifecycleSource, new RegExp(removed), `${removed} must not restore generic-event business processing`);
}

assert.match(lifecycleSource, /attrKey === 'custom-tomato-reminder'[\s\S]*?__tmClearReminderSnapshotCache/, 'reminder attribute events must still invalidate display caches');
assert.match(apiSource, /excludedOccurrences:[\s\S]*?raw\.excludedOccurrences/, 'Task Horizon reminder projection must preserve deleted occurrence exceptions');
assert.match(apiSource, /__tmIsReminderOccurrenceSuppressed[\s\S]*?__tmGetReminderExcludedSet/, 'Task Horizon reminder projection must suppress deleted occurrences');
assert.match(apiSource, /hasDeletedCurrentOccurrence[\s\S]*?__tmGetNextFollowTaskReminderPreviewDateTime/, 'deleted follow occurrences must project the next task recurrence');
assert.match(taskDetailSource, /case 'custom-tomato-reminder':[\s\S]*?scheduleReminderButtonStateRefresh\(\)/, 'an open task detail must refresh after a reminder occurrence is deleted');

const calendarDoneStart = calendarSource.indexOf('async function setCalendarReminderOccurrenceDone');
const calendarDoneEnd = calendarSource.indexOf('\n    function shouldHideCompletedAllDayCalendarEvent', calendarDoneStart);
assert.ok(calendarDoneStart >= 0 && calendarDoneEnd > calendarDoneStart, 'calendar reminder completion block must remain extractable');
const calendarDoneBlock = calendarSource.slice(calendarDoneStart, calendarDoneEnd);
assert.match(calendarDoneBlock, /api\.setOccurrenceDone/, 'calendar completion must call the Tomato occurrence API');
assert.doesNotMatch(calendarDoneBlock, /\/api\/attr\/setBlockAttrs/, 'calendar completion must not fall back to direct reminder writes');
