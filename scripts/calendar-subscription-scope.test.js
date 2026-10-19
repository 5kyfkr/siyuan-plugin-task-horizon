'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const calendar = read('calendar-view.js');
const loader = read('src/task-horizon/main/task-runtime/53c-document-loader-runtime.js');
const dialogs = read('src/task-horizon/main/30-dialogs-and-ui-foundation.js');
const taskDates = read('src/task-horizon/main/render/48-render-calendar-support-runtime.js');
function between(source, a, b) {
    const start = source.indexOf(a), end = source.indexOf(b, start + a.length);
    assert.ok(start >= 0 && end > start, a);
    return source.slice(start, end);
}
function declaration(source, name) {
    const start = source.indexOf(name), end = source.indexOf('\n    }', start);
    assert.ok(start >= 0 && end > start, name);
    return source.slice(start, end + 6);
}
const at = Date.UTC(2026, 9, 18, 9);
function projection(settings = {}, extra = {}) {
    const sandbox = {
        Map, Set, Date, state: { scheduleCache: {} },
        getSettings: () => ({ icsScope: 'selected', icsDocGroupIds: ['b', 'c'], icsIncludeTaskDates: true,
            icsIncludeTomatoReminders: true, ...settings }),
        buildCalendarSubscriptionRange: () => ({ start: new Date(at - 86400000), end: new Date(at + 86400000), startAt: at - 86400000, endAt: at + 86400000 }),
        loadScheduleAll: async () => [
            { id: 'linked', taskId: 'task', docId: 'old-document', calendarId: 'group:a', start: at, end: at + 60000 },
            { id: 'unselected', taskId: 'other-task', calendarId: 'group:b', start: at, end: at + 60000 },
            { id: 'independent', calendarId: 'group:b', start: at, end: at + 60000 },
            { id: 'default', calendarId: 'default', start: at, end: at + 60000 },
            { id: 'invalid-outside-scope', calendarId: 'group:a', start: 'bad', end: 'bad' },
        ],
        tmResolveCalendarSubscriptionScope: async () => ({ groupIds: ['b', 'c'], docIds: ['shared', 'shared'],
            blockDocIds: { task: 'shared', 'other-task': 'outside' } }),
        tmQueryCalendarTaskDateEvents: async (start, end, options) => {
            assert.deepEqual(Array.from(options.docIds), ['shared']);
            return [{ id: 'task', docId: 'shared', calendarId: 'group:a', start: '2026-10-18', end: '2026-10-19' },
                { id: 'other-task', docId: 'outside', start: '2026-10-18', end: '2026-10-19' }];
        },
        getScheduleLinkedTaskId: item => item.taskId || '', getScheduleLinkedBlockId: item => item.blockId || '',
        getCalendarTaskDocumentId: item => item.docId || item.rootId || item.root_id || '',
        toMs: value => Number(value), isAllDayRange: () => false,
        collectScheduleOccurrencesInRange: item => [{ startMs: item.start, endMs: item.end }],
        isScheduleOccurrenceDone: () => false, getScheduleSubscriptionAlarm: () => null,
        normalizeCalendarScheduleTitleText: (title, fallback) => title || fallback,
        formatDateKey: date => date.toISOString().slice(0, 10), parseDateOnly: value => new Date(`${value}T00:00:00Z`),
        isDockTomatoPluginLoaded: () => true,
        waitForDockTomatoSubscriptionBridge: async () => ({ capabilities: { documentScope: true },
            listOccurrences: async options => {
                assert.deepEqual(Array.from(options.docIds), ['shared']);
                return { occurrences: [{ blockId: 'task', docId: 'shared', occurrenceKey: '20261018-0900', startAt: at },
                    { blockId: 'other-task', docId: 'outside', occurrenceKey: '20261018-0900', startAt: at }], truncated: false };
            } }),
        CALENDAR_SUBSCRIPTION_EVENT_LIMIT: 20000,
        ...extra,
    };
    sandbox.window = sandbox;
    const context = vm.createContext(sandbox);
    vm.runInContext(between(calendar, '    async function buildCalendarSubscriptionEvents(', '    async function readKernelJsonResponse('), context);
    return () => context.buildCalendarSubscriptionEvents({}, { wait: async (stage, fn) => fn(), check() {} });
}

test('overlapping groups include every source once using live document ownership', async () => {
    const { events } = await projection()();
    assert.deepEqual(Array.from(events, event => event.uidSeed), [
        `schedule:linked:${at}`, `schedule:independent:${at}`, 'task-date:task', 'tomato:task:20261018-0900',
    ]);
});

test('empty or deleted selection publishes no scoped events and does not require Tomato', async () => {
    const { events } = await projection({}, {
        tmResolveCalendarSubscriptionScope: async () => ({ groupIds: [], docIds: [], blockDocIds: {} }),
        tmQueryCalendarTaskDateEvents: async (a, b, options) => { assert.equal(options.docIds.length, 0); return []; },
        waitForDockTomatoSubscriptionBridge: async () => { throw new Error('must not read Tomato'); },
    })();
    assert.equal(events.length, 0);
});

test('global holidays remain independent of the document scope', async () => {
    const { events } = await projection({ icsIncludeCustomHolidays: true }, {
        tmResolveCalendarSubscriptionScope: async () => ({ groupIds: [], docIds: [], blockDocIds: {} }),
        tmQueryCalendarTaskDateEvents: async () => [],
        buildCustomHolidaySubscriptionEvents: () => [{ uidSeed: 'holiday' }],
    })();
    assert.deepEqual(Array.from(events, event => event.uidSeed), ['holiday']);
});

test('an old Tomato bridge stops scoped publication instead of exporting every reminder', async () => {
    await assert.rejects(projection({}, { waitForDockTomatoSubscriptionBridge: async () => ({ capabilities: {} }) })(), /更新底栏番茄钟/);
});

test('all mode retains independent ungrouped schedules and never resolves a group scope', async () => {
    const { events } = await projection({ icsScope: 'all', icsIncludeTaskDates: false, icsIncludeTomatoReminders: false }, {
        loadScheduleAll: async () => [{ id: 'default', start: at, end: at + 60000 }],
        tmResolveCalendarSubscriptionScope: async () => { throw new Error('must not resolve'); },
    })();
    assert.equal(events[0].uidSeed, `schedule:default:${at}`);
});

test('scope resolver unions only selected groups and resolves current linked documents in batches', async () => {
    const calls = [], queries = [];
    const context = vm.createContext({ window: {}, Set, SettingsStore: { data: { docGroups: [{ id: 'a' }, { id: 'b' }, { id: 'c' }] } },
        resolveDocIdsFromGroups: async options => {
            calls.push(options); return options.groupId === 'b' ? ['shared', 'b-doc'] : ['shared', 'c-doc'];
        }, API: { call: async (endpoint, body) => { queries.push(body); return { code: 0, data: [{ id: '20261018000000-aaaaaaa', root_id: 'new-doc' }] }; } },
    });
    vm.runInContext(between(loader, '    window.tmResolveCalendarSubscriptionScope =', '    function __tmScheduleResolvedDocIdsPrewarm('), context);
    const result = await context.window.tmResolveCalendarSubscriptionScope(['b', 'c', 'deleted'], ['repeatinst:20261018000000-aaaaaaa:2026-10-18']);
    assert.deepEqual(Array.from(result.docIds), ['shared', 'b-doc', 'c-doc']);
    assert.equal(result.blockDocIds['repeatinst:20261018000000-aaaaaaa:2026-10-18'], 'new-doc');
    assert.equal(queries.length, 1);
    for (const call of calls) { assert.equal(call.includeQuickAddDoc, false); assert.equal(call.completeScope, true); }
    assert.deepEqual(Array.from((await context.window.tmResolveCalendarSubscriptionScope(['deleted'])).docIds), []);
    assert.equal(queries.length, 1);
});

test('complete scope ignores date windows and view limits while retaining entry and group exclusions', async () => {
    const context = vm.createContext({ Set, Map, Date, SettingsStore: { data: { recursiveDocLimit: 1 } },
        __tmNormalizeCalendarSearchOptimization: value => value || { enabled: false, days: 90 },
        __tmNormalizeDocGroupExcludedDocIds: value => value || [],
        __tmApplyCalendarSearchOptimizationToDocIds: async () => { throw new Error('must not apply date window'); },
        __tmDocExpandCache: new Map(), __TM_DOC_EXPAND_CACHE_TTL_MS: 600000,
        __tmRememberTimedCache: (map, key, value) => map.set(key, value),
        API: { getNotebookDocuments: async (id, options) => { assert.equal(options.limit, 0); return ['old', 'future', 'excluded'].map(id => ({ id })); },
            getSubDocIds: async (id, options) => { assert.equal(options.limit, 0); return ['old', 'future', 'excluded']; } },
        __tmFilterDocGroupExcludedIds: (ids, ctx) => ids.filter(id => !ctx.excludedDocIdSet.has(id)),
        __tmResolveOtherBlockSourceDocIdsForDocGroup: async () => [],
    });
    vm.runInContext(declaration(dialogs, '    async function __tmExpandSourceEntryDocIds(') + declaration(loader, '    async function __tmResolveDocGroupFreshIds('), context);
    for (const kind of ['notebook', 'doc']) {
        const ids = await context.__tmResolveDocGroupFreshIds({ opts: { completeScope: true }, group: { id: 'b' }, groupId: 'b',
            excludedDocIdSet: new Set(['old']), entries: [{ id: 'parent', kind, recursive: true,
                calendarOptimization: { enabled: true, days: 7 }, excludedDocIds: ['excluded'] }] });
        assert.deepEqual(Array.from(ids), kind === 'doc' ? ['parent', 'future'] : ['future']);
    }
});

test('scoped task date queries bypass view caches without replacing the shared snapshot', async () => {
    const snapshot = { tasks: [{ id: 'view-task' }] }, calls = [];
    const context = vm.createContext({ window: { __tmCalendarAllTasksCache: snapshot }, Map, Set, Date,
        __tmNormalizeDateOnly: value => String(value || ''), __tmIsCalendarTaskPendingDeletedSync: () => false,
        __tmBuildCalendarCheckinTaskDateEvents: () => null, __tmIsCalendarTaskDoneSync: task => task.done === true,
        __tmGetCalendarFlatTaskByIdSync: () => null, __tmIsTaskCanceled: () => false,
        __tmResolveCalendarTaskDisplayTitle: task => task.id, __tmNormalizeCalendarTaskRows: rows => rows,
        MetaStore: { load: async () => {} }, __TM_TASK_INDEX_QUERY_LIMIT: 20000,
        API: { getTasksByDocuments: async ids => { calls.push(Array.from(ids)); return { tasks: [
            { id: 'task', root_id: 'shared', startDate: '2026-10-18' },
            { id: 'done', root_id: 'shared', startDate: '2026-10-18', done: true },
        ] }; } },
    });
    vm.runInContext(between(taskDates, '    window.tmQueryCalendarTaskDateEvents =', '    window.tmRenderCalendarTaskTableHtml ='), context);
    const events = await context.window.tmQueryCalendarTaskDateEvents('2026-10-17', '2026-10-20', { docIds: ['shared'], excludeCompleted: true });
    assert.deepEqual(Array.from(events, item => item.id), ['task']);
    assert.equal(context.window.__tmCalendarAllTasksCache, snapshot);
    assert.deepEqual(calls, [['shared']]);
    assert.equal((await context.window.tmQueryCalendarTaskDateEvents('2026-10-17', '2026-10-20', { docIds: [] })).length, 0);
    assert.equal(calls.length, 1);
});

test('shared group refresh uses the existing snapshot merge and advances its baseline without changing the selected scope', () => {
    const stores = read('src/task-horizon/main/10-stores-rules-and-cache.js');
    const method = between(stores, '        applySharedDocGroupSettings(source) {', '        refreshCustomFieldSyncState(');
    const calls = [];
    const context = vm.createContext({
        __tmBuildDocGroupSyncFingerprint: data => JSON.stringify(data.docGroups),
        __tmApplyDocGroupSyncSnapshot: (source, options) => {
            calls.push(options); options.targetData.docGroups = source.docGroups;
        },
    });
    const store = vm.runInContext(`({${method}})`, context);
    store.data = { docGroups: [{ id: 'old' }], calendarIcsScope: 'selected', calendarIcsDocGroupIds: ['work'], docGroupSettingsUpdatedAt: 123 };
    store.refreshDocGroupSyncState = () => { store.loadedDocGroupFingerprint = JSON.stringify(store.data.docGroups); };
    assert.equal(store.applySharedDocGroupSettings({ docGroups: [{ id: 'work' }] }), true);
    assert.equal(store.loadedDocGroupFingerprint, JSON.stringify([{ id: 'work' }]));
    assert.equal(store.data.calendarIcsScope, 'selected');
    assert.deepEqual(store.data.calendarIcsDocGroupIds, ['work']);
    assert.equal(calls[0].syncOverallUpdatedAt, false);
    assert.equal(store.applySharedDocGroupSettings({ docGroups: [{ id: 'work' }] }), false);
});
