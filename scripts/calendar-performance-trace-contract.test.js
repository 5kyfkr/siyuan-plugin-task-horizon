const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const storesSource = fs.readFileSync(path.join(root, 'src/task-horizon/main/10-stores-rules-and-cache.js'), 'utf8');
const calendarSource = fs.readFileSync(path.join(root, 'calendar-view.js'), 'utf8');
const runtimeSource = fs.readFileSync(path.join(root, 'src/task-horizon/main/render/48-render-calendar-support-runtime.js'), 'utf8');
const mutationSource = fs.readFileSync(path.join(root, 'src/task-horizon/main/20-api-and-runtime-services.js'), 'utf8');

assert.doesNotMatch(storesSource, /__TM_CALENDAR_PERF_PREFIX|\[task-horizon\]\[calendar-perf\]/);
assert.match(storesSource, /function __tmTaskHorizonPerfCreate\(kind, meta = \{\}\)/);
assert.match(storesSource, /function __tmTaskHorizonPerfMark\(traceOrId, stage, detail = \{\}\)/);
assert.match(storesSource, /function __tmTaskHorizonPerfFinish\(traceOrId, detail = \{\}\)/);
assert.match(storesSource, /globalThis\.__tmTaskHorizonPerfCreate = __tmTaskHorizonPerfCreate/);
assert.doesNotMatch(storesSource, /console\.(log|info)\(/);
assert.doesNotMatch(storesSource, /tm_calendar_perf/);
assert.doesNotMatch(storesSource, /__tmCalendarPerf\s*===\s*true/);

assert.match(calendarSource, /__tmCalendarPerfSourceCreate\('main', EVENT_SOURCE_IDS\.mainAux/);
assert.match(calendarSource, /__tmCalendarPerfSourceCreate\('main', EVENT_SOURCE_IDS\.mainSchedule/);
assert.match(calendarSource, /__tmCalendarPerfSourceCreate\('main', EVENT_SOURCE_IDS\.mainTaskDate/);
assert.match(calendarSource, /__tmCalendarPerfSourceCreate\('side', EVENT_SOURCE_IDS\.sideAux/);
assert.match(calendarSource, /__tmCalendarPerfSourceCreate\('side', EVENT_SOURCE_IDS\.sideSchedule/);
assert.match(calendarSource, /__tmCalendarPerfSourceCreate\('side', EVENT_SOURCE_IDS\.sideTaskDate/);
assert.match(calendarSource, /schedule-kernel-read-start/);
assert.match(calendarSource, /schedule-request-reuse/);
assert.match(calendarSource, /schedule-optimistic-cache/);
assert.match(calendarSource, /schedule-optimistic-rollback/);

assert.match(runtimeSource, /__tmTaskHorizonPerfCreate\('taskDateQuery'/);
assert.match(runtimeSource, /taskdate-(?:cache|memory|full)/);
assert.match(runtimeSource, /taskdate-index-read-start/);
assert.match(runtimeSource, /__tmTaskHorizonPerfCreate\('taskDateWrite'/);
assert.match(runtimeSource, /taskdate-optimistic/);
assert.match(runtimeSource, /taskdate-write-confirmed/);
assert.match(mutationSource, /taskdate-kernel-write-start/);
assert.match(mutationSource, /taskdate-kernel-write-confirmed/);
assert.match(mutationSource, /taskdate-kernel-write-error/);

console.log('calendar performance trace contract tests passed');
