'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const calendar = fs.readFileSync(path.join(root, 'calendar-view.js'), 'utf8');
const dialogs = fs.readFileSync(path.join(root, 'src/task-horizon/main/30-dialogs-and-ui-foundation.js'), 'utf8');
const services = fs.readFileSync(path.join(root, 'src/task-horizon/main/20-api-and-runtime-services.js'), 'utf8');
const support = fs.readFileSync(path.join(root, 'src/task-horizon/main/render/48-render-calendar-support-runtime.js'), 'utf8');
const loader = fs.readFileSync(path.join(root, 'src/task-horizon/main/task-runtime/53-list-render-and-document-loader.js'), 'utf8');

const targetResolverSource = calendar.match(/function getScheduleDateFollowTargetId\(item\) \{[\s\S]*?\n    \}/)?.[0] || '';
assert.ok(targetResolverSource, 'schedule date-follow target resolver must exist');

const getScheduleDateFollowTargetId = Function(
    'getScheduleLinkedTaskId',
    'getScheduleLinkedBlockId',
    `return (${targetResolverSource});`
)(
    (item) => String(item?.taskId || '').trim(),
    (item) => String(item?.blockId || '').trim()
);

assert.equal(
    getScheduleDateFollowTargetId({ taskId: '', blockId: '20260722000000-paragraph' }),
    '',
    'ordinary block schedules must not enter task date-follow updates'
);
assert.equal(
    getScheduleDateFollowTargetId({ taskId: '20260722000000-task', blockId: '20260722000000-block' }),
    '20260722000000-task',
    'task schedules must continue to update dates through the real task ID'
);
assert.match(
    services,
    /async getTaskById\(id\)[\s\S]*?WHERE \$\{compatTaskAliasTypeCondition\('task'\)\}[\s\S]*?AND task\.subtype = 't'[\s\S]*?AND task\.id = '\$\{tid\}'/,
    'getTaskById must not return ordinary blocks as tasks'
);
assert.match(
    calendar,
    /window\.tmUpdateTaskDates\(target\.targetId,[\s\S]*?requireTaskIdentity: true,[\s\S]*?ignoreMissingTask: true,[\s\S]*?if \(result\?\.skipped === true\) continue;/,
    'date-follow updates must silently skip stale schedule links that no longer resolve to tasks'
);
assert.match(
    support,
    /opts\.requireTaskIdentity === true[\s\S]*?__tmResolveTaskIdFromAnyBlockId\(requestedId, \{ preferLocal: false \}\)[\s\S]*?opts\.ignoreMissingTask === true[\s\S]*?skipped: true, reason: 'not-task'/,
    'calendar date updates must verify task identity without trusting task-like local cache entries'
);
assert.match(
    loader,
    /async function __tmResolveTaskBindingFromAnyBlockId\(id, options = \{\}\)[\s\S]*?opts\.preferLocal === false \? null : __tmResolveLocalTaskBindingFromAnyBlockId\(bid\)[\s\S]*?async function __tmResolveTaskIdFromAnyBlockId\(id, options = \{\}\)[\s\S]*?__tmResolveTaskBindingFromAnyBlockId\(id, options\)/,
    'task binding resolution must support bypassing polluted local task-like caches'
);
assert.match(
    dialogs,
    /__tmResolveScheduleDraftForBlock[\s\S]*?__tmResolveTaskIdFromAnyBlockId\(rawId, \{ preferLocal: false \}\)/,
    'schedule drafts for native blocks must resolve task identity from the real block structure'
);
assert.match(
    dialogs,
    /await calendarApi\.addTaskSchedule\([\s\S]*?await __tmTryAddOtherBlockToScheduleGroup\(linkedBlockId, taskId, calendarId\)/,
    'ordinary blocks must still be added to the matching Other Blocks group after schedule creation'
);

console.log('schedule other-block date-follow contract tests passed');
