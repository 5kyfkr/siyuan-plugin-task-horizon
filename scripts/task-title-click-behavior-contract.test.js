'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const read = (...parts) => fs.readFileSync(path.join(root, ...parts), 'utf8');
const stores = read('src', 'task-horizon', 'main', '10-stores-rules-and-cache.js');
const services = read('src', 'task-horizon', 'main', '20-api-and-runtime-services.js');
const foundation = read('src', 'task-horizon', 'main', '30-dialogs-and-ui-foundation.js');
const navigation = read('src', 'task-horizon', 'main', 'task-runtime', '51-whiteboard-and-link-runtime.js');
const settingsScreen = read('src', 'task-horizon', 'main', 'settings', '60-settings-screen.js');
const settingsActions = read('src', 'task-horizon', 'main', 'settings', '70-doc-group-and-settings-actions.js');
const calendar = read('calendar-view.js');
const whiteboardInteractions = read('src', 'task-horizon', 'main', 'render', '49-render-whiteboard-interactions.js');

function segment(source, start, end) {
    const from = source.indexOf(start);
    const to = source.indexOf(end, from + start.length);
    assert.notEqual(from, -1, `missing segment start: ${start}`);
    assert.notEqual(to, -1, `missing segment end: ${end}`);
    return source.slice(from, to);
}

const migrationSource = segment(
    stores,
    'const __TM_LEGACY_TASK_TITLE_SETTING_KEYS',
    'function __tmIsSettingsFieldSyncKey',
);
const migrationSandbox = {
    __tmParseUpdatedAtNumber: (value) => Math.max(0, Number(value) || 0),
};
vm.runInNewContext(`${migrationSource}\nthis.migrate = __tmMigrateLegacyTaskTitleClickSettings;this.normalizeAction = __tmNormalizeTaskTitleClickAction;this.normalizeOverride = __tmNormalizeTaskTitleClickOverride;`, migrationSandbox);

for (const openDetail of [false, true]) {
    for (const dockJump of [false, true]) {
        for (const mobileJump of [false, true]) {
            const data = {
                checklistCompactTitleOpenDetailPage: openDetail,
                dockChecklistCompactTitleJump: dockJump,
                mobileChecklistCompactTitleJump: mobileJump,
                settingsFieldUpdatedAt: {
                    checklistCompactTitleOpenDetailPage: 10,
                    dockChecklistCompactTitleJump: 20,
                    mobileChecklistCompactTitleJump: 30,
                },
            };
            assert.equal(migrationSandbox.migrate(data, data), true);
            const globalAction = openDetail ? 'detail' : 'jump';
            const dockAction = openDetail ? 'detail' : (dockJump ? 'jump' : 'detail');
            const mobileAction = openDetail ? 'detail' : (mobileJump ? 'jump' : 'detail');
            assert.equal(data.taskTitleClickAction, globalAction);
            assert.equal(data.dockTaskTitleClickAction, dockAction === globalAction ? 'inherit' : dockAction);
            assert.equal(data.mobileTaskTitleClickAction, mobileAction === globalAction ? 'inherit' : mobileAction);
            assert.equal(data.settingsFieldUpdatedAt.taskTitleClickAction, 10);
            assert.equal(data.settingsFieldUpdatedAt.dockTaskTitleClickAction, 20);
            assert.equal(data.settingsFieldUpdatedAt.mobileTaskTitleClickAction, 30);
            for (const key of ['checklistCompactTitleOpenDetailPage', 'dockChecklistCompactTitleJump', 'mobileChecklistCompactTitleJump']) {
                assert.equal(Object.hasOwn(data, key), false, `${key} must be removed after migration`);
                assert.equal(Object.hasOwn(data.settingsFieldUpdatedAt, key), false, `${key} timestamp must be removed`);
            }
        }
    }
}

const newSettingsWin = {
    taskTitleClickAction: 'detail',
    dockTaskTitleClickAction: 'jump',
    mobileTaskTitleClickAction: 'inherit',
    checklistCompactTitleOpenDetailPage: false,
    dockChecklistCompactTitleJump: false,
    mobileChecklistCompactTitleJump: false,
    settingsFieldUpdatedAt: {},
};
assert.equal(migrationSandbox.migrate(newSettingsWin, newSettingsWin), true, 'legacy keys beside new settings must be scheduled for cleanup');
assert.equal(newSettingsWin.taskTitleClickAction, 'detail', 'new settings must win over legacy values');
assert.equal(newSettingsWin.dockTaskTitleClickAction, 'jump');

for (const [key, defaultValue, storageKey] of [
    ['taskTitleClickAction', 'jump', 'tm_task_title_click_action'],
    ['dockTaskTitleClickAction', 'inherit', 'tm_dock_task_title_click_action'],
    ['mobileTaskTitleClickAction', 'inherit', 'tm_mobile_task_title_click_action'],
]) {
    assert.match(stores, new RegExp(`${key}: '${defaultValue}'`), `${key} must have a stable default`);
    assert.match(stores, new RegExp(`cloudData\\.${key}`), `${key} must load from cloud settings`);
    assert.match(stores, new RegExp(`'${storageKey}', '${key}'`), `${key} must load from local storage`);
    assert.match(stores, new RegExp(`Storage\\.set\\('${storageKey}'`), `${key} must persist locally`);
}
assert.match(stores, /__TM_LEGACY_TASK_TITLE_SETTING_KEYS[\s\S]*delete out\[key\][\s\S]*delete fieldMap\[key\]/,
    'legacy settings and their field timestamps must be removed from future payloads');
assert.match(stores, /Storage\.remove\('tm_dock_checklist_compact_title_jump'\)[\s\S]*Storage\.remove\('tm_mobile_checklist_compact_title_jump'\)[\s\S]*Storage\.remove\('tm_checklist_compact_title_open_detail_page'\)/,
    'legacy local keys must be removed after migration');

assert.match(settingsScreen, /任务标题点击[\s\S]*默认动作[\s\S]*updateTaskTitleClickAction[\s\S]*!__tmIsRuntimeMobileClient\(\) \? renderSingleFieldSetting\([\s\S]*'Dock'[\s\S]*updateDockTaskTitleClickAction[\s\S]*'移动端'[\s\S]*updateMobileTaskTitleClickAction/,
    'settings UI must show global/mobile actions while hiding only Dock on mobile');
assert.doesNotMatch(settingsScreen, /updateDockChecklistCompactTitleJump|updateMobileChecklistCompactTitleJump|updateChecklistCompactTitleOpenDetailPage/,
    'settings UI must not expose legacy boolean switches');
for (const handler of ['updateTaskTitleClickAction', 'updateDockTaskTitleClickAction', 'updateMobileTaskTitleClickAction']) {
    assert.match(settingsActions, new RegExp(`window\\.${handler} = async function`), `${handler} must persist its select value`);
}

const resolverSource = segment(
    services,
    'window.__tmResolveTaskTitleClickAction = function',
    'const __tmGetConfiguredDefaultViewMode',
);
const host = { dock: false, mobile: false };
const resolverSandbox = {
    window: {},
    SettingsStore: { data: {} },
    __tmNormalizeTaskTitleClickAction: migrationSandbox.normalizeAction,
    __tmNormalizeTaskTitleClickOverride: migrationSandbox.normalizeOverride,
    __tmIsDesktopDockHost: () => host.dock,
    __tmIsScopedMobileHost: () => host.mobile,
};
vm.runInNewContext(resolverSource, resolverSandbox);

const resolve = resolverSandbox.window.__tmResolveTaskTitleClickAction;
for (const globalAction of ['jump', 'detail']) {
    for (const hostKind of ['desktop', 'dock', 'mobile']) {
        for (const override of ['inherit', 'jump', 'detail']) {
            resolverSandbox.SettingsStore.data = {
                taskTitleClickAction: globalAction,
                dockTaskTitleClickAction: override,
                mobileTaskTitleClickAction: override,
            };
            host.dock = hostKind === 'dock';
            host.mobile = hostKind === 'mobile';
            const expected = hostKind === 'desktop' || override === 'inherit' ? globalAction : override;
            for (const ctrlKey of [false, true]) {
                for (const metaKey of [false, true]) {
                    for (const altKey of [false, true]) {
                        for (const shiftKey of [false, true]) {
                            const reverse = (ctrlKey || metaKey) && !altKey && !shiftKey;
                            const resolved = reverse ? (expected === 'jump' ? 'detail' : 'jump') : expected;
                            assert.equal(resolve({ ctrlKey, metaKey, altKey, shiftKey }), resolved);
                        }
                    }
                }
            }
        }
    }
}

const dispatcherSource = segment(
    foundation,
    "const __TM_TASK_TITLE_SURFACES",
    'window.tmChecklistTitleClick',
);
const calls = [];
let suppressClick = false;
let multiSelectActive = false;
const dispatcherSandbox = {
    window: {
        __tmResolveTaskTitleClickAction: () => 'jump',
        tmJumpToTask: (id) => calls.push(['jump', id]),
        tmOpenTaskDetail: (id, event, options) => calls.push(['detail', id, options?.source]),
        tmChecklistSelectTask: (id) => calls.push(['checklist-detail', id]),
    },
    __tmConsumeDockPointerSuppressedClick: () => suppressClick,
    __tmIsMultiSelectActive: () => multiSelectActive,
    __tmToggleTaskMultiSelection: (id) => calls.push(['multi', id]),
    Set,
};
vm.runInNewContext(dispatcherSource, dispatcherSandbox);
for (const surface of ['table', 'checklist', 'timeline', 'kanban', 'calendar', 'whiteboard', 'whiteboard-pool']) {
    calls.length = 0;
    dispatcherSandbox.window.__tmResolveTaskTitleClickAction = () => 'jump';
    assert.equal(dispatcherSandbox.window.tmTaskTitleClick('task-1', {}, { surface }), true);
    assert.deepEqual(calls, [['jump', 'task-1']]);

    calls.length = 0;
    dispatcherSandbox.window.__tmResolveTaskTitleClickAction = () => 'detail';
    dispatcherSandbox.window.tmTaskTitleClick('task-1', {}, { surface });
    assert.deepEqual(calls, surface === 'checklist'
        ? [['checklist-detail', 'task-1']]
        : [['detail', 'task-1', `${surface}-title-click`]]);
}
calls.length = 0;
assert.equal(dispatcherSandbox.window.tmTaskTitleClick('task-1', {}, { surface: 'unknown' }), false);
assert.deepEqual(calls, []);
calls.length = 0;
multiSelectActive = true;
assert.equal(dispatcherSandbox.window.tmTaskTitleClick('task-1', {}, { surface: 'table' }), true);
assert.deepEqual(calls, [['multi', 'task-1']], 'active multi-select must take priority over title actions');
multiSelectActive = false;
calls.length = 0;
suppressClick = true;
assert.equal(dispatcherSandbox.window.tmTaskTitleClick('task-1', {}, { surface: 'table' }), undefined);
assert.deepEqual(calls, [], 'a click suppressed after dragging must not run a title action');
suppressClick = false;

const jumpSource = segment(navigation, 'window.tmJumpToTask = async function', 'function __tmInvalidateFilteredTaskDerivedStateCache');
assert.doesNotMatch(jumpSource, /TaskTitleClickAction|taskTitleClickAction|tmOpenTaskDetail|__tmIsMultiSelectActive/,
    'programmatic task navigation must remain independent from title-click preferences');

assert.match(calendar, /tmTaskTitleClick\(tid, ev, \{ surface: 'calendar' \}\)/,
    'calendar task titles must use the unified dispatcher');
assert.doesNotMatch(calendar, /checklistCompactTitleOpenDetailPage|tm_checklist_compact_title_open_detail_page/,
    'calendar must not read legacy title settings');
assert.match(whiteboardInteractions, /if \(ev\?\.ctrlKey \|\| ev\?\.metaKey\)[\s\S]*return false;[\s\S]*surface: 'whiteboard-pool'/,
    'whiteboard pool Ctrl/Cmd multi-select must take priority over title action reversal');

const titleSurfaceContracts = [
    ['src/task-horizon/main/render/42-render-list-and-checklist-body.js', 'tmChecklistTitleClick'],
    ['src/task-horizon/main/render/43-render-timeline-kanban-calendar-body.js', "surface: 'timeline'"],
    ['src/task-horizon/main/render/43-render-timeline-kanban-calendar-body.js', "surface: 'kanban'"],
    ['src/task-horizon/main/render/44-render-whiteboard-body.js', "surface: 'whiteboard'"],
    ['src/task-horizon/main/render/48-render-calendar-support-runtime.js', "surface: 'calendar'"],
    ['src/task-horizon/main/shell/82-gantt-runtime.js', "surface: 'timeline'"],
];
for (const [file, contract] of titleSurfaceContracts) {
    assert.match(read(...file.split('/')), new RegExp(contract.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `${file} must declare ${contract}`);
}
const listRenderer = read('src', 'task-horizon', 'main', 'task-runtime', '53-list-render-and-document-loader.js');
assert.match(listRenderer, /const titleSurface = \['table', 'calendar'\][\s\S]*: 'table'/,
    'shared table rendering must default titles to the table surface');
assert.match(listRenderer, /surface: '\$\{titleSurface\}'/,
    'shared table rendering must pass its explicit title surface to the dispatcher');
const calendarSupport = read('src', 'task-horizon', 'main', 'render', '48-render-calendar-support-runtime.js');
assert.match(calendarSupport, /renderTaskList\(null, \{ titleSurface: 'calendar' \}\)/,
    'calendar table reuse must explicitly override the title surface');

console.log('task title click behavior contract tests passed');
