'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const calendar = fs.readFileSync(path.join(root, 'calendar-view.js'), 'utf8');
const stores = fs.readFileSync(path.join(root, 'src/task-horizon/main/10-stores-rules-and-cache.js'), 'utf8');
const dialogs = fs.readFileSync(path.join(root, 'src/task-horizon/main/30-dialogs-and-ui-foundation.js'), 'utf8');
const listLoader = fs.readFileSync(path.join(root, 'src/task-horizon/main/task-runtime/53-list-render-and-document-loader.js'), 'utf8');
const taskRuntime = fs.readFileSync(path.join(root, 'src/task-horizon/main/task-runtime/53b-task-create-and-quick-add-runtime.js'), 'utf8');
const exportRuntime = fs.readFileSync(path.join(root, 'src/task-horizon/main/settings/64-export-runtime.js'), 'utf8');

assert.match(stores, /calendarCreateTaskForIndependentSchedule:\s*false/, 'the new setting must default to disabled');
assert.match(stores, /calendarIndependentScheduleTaskLocation:\s*''/, 'the fixed calendar task location must default to empty');
assert.match(stores, /cloudData\.calendarCreateTaskForIndependentSchedule === 'boolean'/, 'the setting must merge from cloud data');
assert.match(stores, /tm_calendar_create_task_for_independent_schedule/, 'the setting must persist locally');
assert.match(stores, /this\.data\.calendarCreateTaskForIndependentSchedule = this\.data\.calendarCreateTaskForIndependentSchedule === true/, 'the setting must be normalized to a strict boolean');
assert.match(exportRuntime, /'calendarCreateTaskForIndependentSchedule'/, 'the setting must be included in calendar settings export');
assert.match(exportRuntime, /'calendarIndependentScheduleTaskLocation'/, 'the fixed location must be included in calendar settings export');

assert.match(calendar, /createTaskForIndependentSchedule:\s*readStoredBool\('tm_calendar_create_task_for_independent_schedule'/, 'calendar getSettings must expose the setting');
assert.match(calendar, /const parsed = JSON\.parse\(String\(raw\)\);[\s\S]*typeof parsed === 'string'/, 'stored calendar strings must be decoded before rendering');
assert.doesNotMatch(calendar, /data-tm-cal-setting="calendarCreateTaskForIndependentSchedule"/, 'calendar settings must not render a separate creation switch');
assert.match(calendar, /data-tm-cal-setting="calendarIndependentScheduleTaskCreateMode"/, 'calendar settings must render a creation mode dropdown');
assert.match(calendar, /data-tm-cal-setting-action="pickIndependentScheduleTaskDoc"/, 'calendar settings must render a searchable document picker');
assert.match(calendar, /globalThis\.__tmOpenDocSearchPrompt\('选择固定任务文档'/, 'calendar settings must use the shared document search prompt');
assert.match(calendar, /globalThis\.__tmEnsureAllDocumentsLoaded\(true\)/, 'calendar document picker must refresh the complete document list');
assert.match(dialogs, /window\.__tmOpenDocSearchPrompt\s*=\s*__tmOpenDocSearchPrompt/, 'document search prompt must be bridged to calendar settings');
assert.match(listLoader, /window\.__tmEnsureAllDocumentsLoaded\s*=\s*__tmEnsureAllDocumentsLoaded/, 'document loading helper must be bridged to calendar settings');
assert.match(calendar, /const independentScheduleTaskDocLabel = independentScheduleTaskDocId;/, 'calendar settings must display only the selected document id');
assert.doesNotMatch(calendar, /data-tm-cal-setting="calendarIndependentScheduleTaskLocationDocId"/, 'calendar settings must not require manual document id entry');
assert.match(calendar, /<option value="scheduleOnly"[^>]*>仅创建日程/, 'the creation mode dropdown must allow schedules without tasks');
assert.match(calendar, /<option value="dailyNote"[^>]*>创建任务到今天日记/, 'the creation mode dropdown must offer today diary');
assert.match(calendar, /<option value="doc"[^>]*>创建任务到固定文档/, 'the creation mode dropdown must offer a fixed document');
assert.match(calendar, /independentScheduleTaskCreateMode === 'doc' \? `<div[\s\S]*data-tm-cal-setting-action="pickIndependentScheduleTaskDoc"[\s\S]*: ''/, 'the document picker must render only for fixed-document mode');

const protoStart = calendar.indexOf('const showPrototypeScheduleEditorCard');
const protoEnd = calendar.indexOf('\n        const openPrototypeNewScheduleCard', protoStart);
assert.ok(protoStart >= 0 && protoEnd > protoStart, 'prototype schedule editor must remain inspectable');
const proto = calendar.slice(protoStart, protoEnd);
assert.match(proto, /isNew[\s\S]*createTaskForIndependentSchedule === true[\s\S]*!taskIdKeep[\s\S]*!blockIdKeep/, 'prototype editor must gate automatic creation to independent new schedules');
assert.match(proto, /__tmCreateTaskForCalendarSchedule\?\.\(titleValue,/, 'prototype editor must use the shared calendar task helper');
assert.match(proto, /const taskCompletionDate = \(\(\) => \{[\s\S]*?dueDate\.setDate\(dueDate\.getDate\(\) - 1\)[\s\S]*?return formatDateKey\(dueDate\);[\s\S]*?\}\)\(\);/, 'prototype editor must derive the task due date from the schedule end');
assert.match(proto, /__tmCreateTaskForCalendarSchedule\?\.\(titleValue,\s*\{\s*completionTime:\s*taskCompletionDate/, 'prototype editor must pass the schedule end date as task due date');
assert.match(proto, /if \(isNew\) \{[\s\S]*?titleField = pop\.querySelector\('\[data-tm-proto-edit-field="title"\]'\)[\s\S]*?titleField\.focus/, 'prototype new schedule editor must focus the title field');
assert.match(proto, /taskIdKeep = String\(createdCalendarTask\.taskId\)/, 'prototype editor must bind the created task id');
assert.match(proto, /blockIdKeep = taskIdKeep/, 'prototype editor must persist the block binding');
assert.match(proto, /linkedDocId = String\(createdCalendarTask\.docId/, 'prototype editor must persist the task document id');

const modalStart = calendar.indexOf('function openScheduleModal');
const modalEnd = calendar.indexOf('\n    function scheduleTomatoRefetch', modalStart);
assert.ok(modalStart >= 0 && modalEnd > modalStart, 'fallback schedule modal must remain inspectable');
const modal = calendar.slice(modalStart, modalEnd);
assert.match(modal, /!isEdit[\s\S]*!taskDateEditor[\s\S]*createTaskForIndependentSchedule === true[\s\S]*!taskIdKeep[\s\S]*!blockIdKeep/, 'fallback modal must gate automatic creation to independent new schedules');
assert.match(modal, /__tmCreateTaskForCalendarSchedule\?\.\(title \|\| '日程',/, 'fallback modal must use the shared calendar task helper');
assert.match(modal, /const taskCompletionDate = \(\(\) => \{[\s\S]*?dueDate\.setDate\(dueDate\.getDate\(\) - 1\)[\s\S]*?return formatDateKey\(dueDate\);[\s\S]*?\}\)\(\);/, 'fallback modal must derive the task due date from the schedule end');
assert.match(modal, /__tmCreateTaskForCalendarSchedule\?\.\(title \|\| '日程',\s*\{\s*completionTime:\s*taskCompletionDate/, 'fallback modal must pass the schedule end date as task due date');
assert.match(modal, /if \(!isEdit && !taskDateEditor\) \{[\s\S]*?titleField = modal\.querySelector\('\[data-tm-cal-field="title"\]'\)[\s\S]*?titleField\.focus/, 'fallback new schedule modal must focus the title field');
assert.match(modal, /taskIdKeep = String\(createdCalendarTask\.taskId\)/, 'fallback modal must bind the created task id');
assert.match(modal, /linkedDocIdDraft = String\(createdCalendarTask\.docId/, 'fallback modal must persist the task document id');

const helperStart = taskRuntime.indexOf('window.__tmCreateTaskForCalendarSchedule = async function');
const helperEnd = taskRuntime.indexOf('\n    window.tmQuickAddSubmit', helperStart);
assert.ok(helperStart >= 0 && helperEnd > helperStart, 'calendar task helper must remain inspectable');
const helper = taskRuntime.slice(helperStart, helperEnd);
assert.match(helper, /calendarIndependentScheduleTaskLocation/, 'calendar task creation must use its fixed calendar location setting');
assert.doesNotMatch(helper, /__tmResolveQuickAddInitialLocation\(\)/, 'calendar task creation must not follow the regular last-selected location');
assert.match(helper, /__tmResolveDefaultNewTaskInsertOptions\(targetDocId, mode/, 'calendar task creation must reuse regular insertion rules');
assert.match(helper, /API\.createDailyNote\(notebook\)/, 'calendar task creation must support today diary mode');
assert.match(helper, /createTaskInDoc\(\{[\s\S]*wait:\s*true[\s\S]*showErrorHint:\s*false/, 'calendar task creation must await the task write without a duplicate hint');
assert.match(helper, /opts\.completionTime[^\n]*completionTime:/, 'calendar task creation must forward the due date to task creation');

console.log('calendar independent schedule task contract tests passed');
