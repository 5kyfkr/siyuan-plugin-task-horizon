'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const kernel = fs.readFileSync(path.join(root, 'kernel.js'), 'utf8');
const calendar = fs.readFileSync(path.join(root, 'calendar-view.js'), 'utf8');
const support = fs.readFileSync(path.join(root, 'src/task-horizon/main/render/48-render-calendar-support-runtime.js'), 'utf8');
const workbench = fs.readFileSync(path.join(root, 'src/ai/agent-workbench.js'), 'utf8');
const dialogs = fs.readFileSync(path.join(root, 'src/task-horizon/main/30-dialogs-and-ui-foundation.js'), 'utf8');
const render = fs.readFileSync(path.join(root, 'src/task-horizon/main/40-render-runtime.js'), 'utf8');
const routing = fs.readFileSync(path.join(root, 'src/task-horizon/main/41-external-task-drag-routing.js'), 'utf8');
const aiBridge = fs.readFileSync(path.join(root, 'src/task-horizon/main/shell/81-ai-bridge-runtime.js'), 'utf8');

assert.match(kernel, /function resolveDurationCandidates\([\s\S]*normalizeDurationMatchText[\s\S]*source: 'fallback'/, 'duration matching must stay in one deterministic kernel function');
assert.match(kernel, /taskHorizonResolveDurationDefaults[\s\S]*resolveTaskDurationDefaults/, 'manual drag must use a read-only kernel RPC');
assert.doesNotMatch(kernel, /\['taskHorizonResolveDurationDefaults',/, 'the internal duration RPC must not be registered as an MCP tool');
assert.match(kernel, /durationCandidates:[\s\S]*maxItems: 200[\s\S]*getTaskPolicy/, 'the policy tool must accept bounded duration candidates');

assert.match(support, /durationExplicit[\s\S]*durationMin = durationExplicit \? Math\.round/, 'calendar task metadata must distinguish real duration from the 60-minute placeholder');
assert.match(support, /durationSource !== 'schedule' && Number\.isFinite\(Number\(mins\)\)/, 'schedule-derived task estimates must not become the next manual calendar drag duration');
assert.match(dialogs, /function __tmResolveTaskDragSnapshot[\s\S]*durationSource !== 'schedule'[\s\S]*durationMin: durationExplicit \? Math\.round\(durationMin\) : 60/, 'fallback task snapshots must also use the placeholder for schedule-derived estimates');
assert.match(calendar, /const hasMetaDurationMarker[\s\S]*safeMeta\.durationExplicit === true[\s\S]*: 60/, 'current task metadata must override stale drag payload provenance');
assert.match(calendar, /async function resolveManualDragDurationMin[\s\S]*mode: 'manual-drag'[\s\S]*clampNewScheduleDurationMin\(60, settings\)/, 'manual drag must resolve defaults and retain the 60-minute failure fallback');
assert.equal((calendar.match(/await resolveManualDragDurationMin\(/g) || []).length >= 3, true, 'desktop, side, and touch drop paths must use the shared resolver');
assert.match(calendar, /__tmDurationExplicit[\s\S]*durationExplicit/, 'FullCalendar drag payloads must preserve explicit-duration provenance');
assert.match(calendar, /const durationLabel = durationExplicit \? formatCalendarTaskDurationLabel\(safeDuration\) : ''/, 'the task list must not present the 60-minute placeholder as an explicit estimate');
assert.match(calendar, /async function addTaskSchedule\(input\)[\s\S]*plannedMinutes: Math\.max\(1, Math\.round\(\(endMs - startMs\) \/ 60000\)\)/, 'new task schedules must persist plannedMinutes');
assert.doesNotMatch(calendar, /resolveManualDragDurationMin[\s\S]{0,1800}(?:tmUpdateTask|duration:\s*[^,}]+)/, 'manual duration resolution must not write inferred duration back to tasks');
assert.match(workbench, /source\.policy\.durationDefaults[\s\S]*\{ durationDefaults: source\.policy\.durationDefaults \}/, 'AI data import must preserve duration defaults');
assert.match(dialogs, /function __tmResolveTaskDragSnapshot[\s\S]*state\.filteredTasks\.find[\s\S]*\.tm-checklist-title-button[\s\S]*window\.tmDragTaskStart[\s\S]*meta\?\.title \|\| fallback\.title/, 'HTML5 drags must recover recurring virtual task titles from runtime state or the visible row');
assert.match(dialogs, /window\.tmDragTaskStart[\s\S]*durationExplicit,[\s\S]*documentID: String\(meta\?\.documentID \|\| meta\?\.docId \|\| fallback\.documentID/, 'checklist and table HTML5 drags must preserve duration provenance and fallback metadata');
assert.match(dialogs, /function __tmBuildDockPointerTaskDragPayload[\s\S]*__tmResolveTaskDragSnapshot\(id, sourceEl\)[\s\S]*durationExplicit,[\s\S]*function __tmBuildDockPointerTaskSyntheticTransfer[\s\S]*durationExplicit: safePayload\.durationExplicit === true/, 'Dock and touch drags must reuse recurring-task title and duration fallback metadata');
assert.match(render, /window\.tmKanbanDragStart[\s\S]*durationExplicit: meta\?\.durationExplicit === true/, 'kanban drags must preserve duration provenance');
assert.match(routing, /durationMin: 60,[\s\S]*durationExplicit: false/, 'fallback external drag payloads must identify 60 minutes as a placeholder');
assert.match(aiBridge, /function __tmAiVirtualTaskDTO[\s\S]*title: String\(task\?\.content \|\| task\?\.raw_content \|\| task\?\.title/, 'AI virtual task candidates must expose the recurring instance title used by duration matching');

const dragPayloadStart = calendar.indexOf('    function buildCalendarDropPayloadFromTaskId(');
const dragPayloadEnd = calendar.indexOf('\n    async function addTaskScheduleFromCalendarDropPayload(', dragPayloadStart);
assert.ok(dragPayloadStart >= 0 && dragPayloadEnd > dragPayloadStart, 'calendar task drag payload normalizer must exist');
const dragPayloadContext = vm.createContext({
    window: {
        tmCalendarGetTaskDragMeta(id) {
            return id === 'schedule-derived'
                ? { durationMin: 195, durationExplicit: false }
                : { durationMin: 45, durationExplicit: true };
        },
    },
    __tmT: (key) => key,
});
vm.runInContext(`${calendar.slice(dragPayloadStart, dragPayloadEnd)}\nthis.normalizeDragPayload = buildCalendarDropPayloadFromTaskId;`, dragPayloadContext);
assert.deepEqual(
    JSON.parse(JSON.stringify(dragPayloadContext.normalizeDragPayload('schedule-derived', { durationMin: 195, durationExplicit: true }))),
    JSON.parse(JSON.stringify({ taskId: 'schedule-derived', title: 'schedule-derived', durationMin: 60, durationExplicit: false, calendarId: '', documentID: '', startDate: '', completionTime: '', dateFieldsKnown: false })),
    'a schedule-derived aggregate must create a default-length event even when an old drag payload marks it explicit',
);
assert.equal(dragPayloadContext.normalizeDragPayload('manual', { durationMin: 45, durationExplicit: true }).durationMin, 45, 'a manually entered estimate must size the dragged schedule');

console.log('duration defaults contract tests passed');
