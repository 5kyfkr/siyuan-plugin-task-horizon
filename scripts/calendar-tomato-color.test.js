'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'calendar-view.js'), 'utf8');
const start = source.indexOf('    function resolveModeColor(');
const end = source.indexOf('    function buildRecordKey(', start);
assert.ok(start > 0 && end > start);

function harness() {
    const tasks = new Map();
    const groups = new Map([['doc-work', 'work']]);
    const requests = [];
    let refreshes = 0;
    const context = {
        Map, Date, Promise, String, Array,
        calendarTomatoDocCache: new Map(),
        CALENDAR_LINKED_DOC_CACHE_MAX: 2000,
        state: { calendar: {} },
        window: {},
        EVENT_SOURCE_IDS: { mainAux: 'aux' },
        getCalendarTaskSnapshotById: (id) => tasks.get(id),
        getCalendarTaskDocumentId: (task) => task?.root_id || '',
        loadBlockLinkedMetadataMapShared: (ids) => new Promise((resolve, reject) => requests.push({ ids, resolve, reject })),
        __tmRefetchCalendarSource: () => { refreshes += 1; },
        getCalendarDocsToGroupMapSnapshot: () => groups,
        getCalendarDefs: () => [{ id: 'default', color: '#999999' }, { id: 'group:work', color: '#335577' }],
        calendarIdForGroup: (id) => `group:${id}`,
        resolveCalendarDocColor: (id) => id === 'doc-work' ? '#118855' : '#bb8822',
    };
    vm.createContext(context);
    vm.runInContext(source.slice(start, end), context);
    return { context, tasks, groups, requests, refreshes: () => refreshes };
}

const settings = { colorFocus: '#ff5555', colorBreak: '#bbbbbb', colorStopwatch: '#00bbbb', colorIdle: '#777777' };
const event = (id, mode = 'countdown') => ({
    id: `record-${id}-${mode}`, start: '2026-09-21T10:00:00Z', end: '2026-09-21T10:25:00Z',
    backgroundColor: 'old', borderColor: 'old',
    extendedProps: { __tmSource: 'tomato', taskBlockId: id, mode, durationMin: 25 },
});
const settle = async () => { for (let i = 0; i < 6; i += 1) await Promise.resolve(); };

(async () => {
    const h = harness();
    const paint = (events, mode) => h.context.colorCalendarTomatoEvents(events, { ...settings, tomatoColorMode: mode });
    h.tasks.set('task-a', { root_id: 'doc-work' });
    h.tasks.set('task-b', { root_id: 'doc-other' });
    const records = ['countdown', 'break', 'stopwatch-break', 'stopwatch', 'idle'].map((mode) => event('task-a', mode));
    assert.deepEqual(Array.from(paint(records, 'type'), (e) => e.backgroundColor), ['#ff5555', '#bbbbbb', '#bbbbbb', '#00bbbb', '#777777']);
    assert.equal(h.requests.length, 0, 'type coloring must not query task documents');
    for (const mode of [undefined, '', 'invalid']) assert.equal(paint(records, mode)[0].backgroundColor, '#ff5555');
    for (const e of paint(records, 'document')) {
        assert.equal(e.backgroundColor, '#118855');
        assert.equal(e.borderColor, '#118855');
        assert.equal(e.extendedProps.__tmDocId, 'doc-work');
    }
    const grouped = paint([event('task-a'), event('task-b'), event('')], 'group');
    assert.deepEqual(Array.from(grouped, (e) => e.backgroundColor), ['#335577', '#999999', '#ff5555']);
    assert.equal(records[0].backgroundColor, 'old', 'coloring must not mutate cached inputs');
    assert.equal(paint(paint(records, 'document'), 'type')[0].backgroundColor, '#ff5555', 'retained snapshots must adopt the newly selected mode');
    h.tasks.set('task-a', { root_id: 'doc-other' });
    assert.equal(paint(records, 'document')[0].backgroundColor, '#bb8822', 'task moves must follow the current document');
    const schedule = { extendedProps: { __tmSource: 'schedule' }, backgroundColor: 'keep' };
    assert.equal(paint([schedule, event('')], 'document')[0], schedule);

    const unknown = [event('missing-a'), event('missing-a', 'break'), event('missing-b')];
    assert.equal(paint(unknown, 'document')[0].backgroundColor, '#ff5555', 'cold queries must paint fallback immediately');
    assert.equal(h.requests.length, 1);
    assert.deepEqual(Array.from(h.requests[0].ids), ['missing-a', 'missing-b'], 'documents must load in one deduplicated batch');
    paint(unknown, 'document');
    assert.equal(h.requests.length, 1, 'pending queries must be reused');
    h.requests[0].resolve(new Map([['missing-a', { docId: 'doc-work' }]]));
    await settle();
    assert.equal(h.refreshes(), 1);
    assert.deepEqual(Array.from(paint(unknown, 'document'), (e) => e.backgroundColor), ['#118855', '#118855', '#ff5555']);
    assert.equal(h.requests.length, 1, 'missing or deleted tasks must be negatively cached');

    h.context.calendarTomatoDocCache.get('missing-a').loadedAt = 0;
    paint(unknown, 'document');
    h.requests[1].resolve(new Map());
    await settle();
    assert.equal(paint(unknown, 'document')[0].backgroundColor, '#ff5555', 'a deleted block must drop its old document color');

    paint([event('failed')], 'document');
    h.requests[2].reject(new Error('offline'));
    await settle();
    assert.equal(paint([event('failed')], 'document')[0].backgroundColor, '#ff5555');
    assert.equal(h.requests.length, 3, 'failed queries must not retry on every paint');

    paint([event('unmounted')], 'document');
    const beforeUnmount = h.refreshes();
    h.context.calendarTomatoDocCache.clear();
    h.requests[3].resolve(new Map([['unmounted', { docId: 'doc-work' }]]));
    await settle();
    assert.equal(h.context.calendarTomatoDocCache.size, 0, 'late queries must not repopulate an unmounted calendar');
    assert.equal(h.refreshes(), beforeUnmount);

    const large = harness();
    large.context.CALENDAR_LINKED_DOC_CACHE_MAX = 2;
    const largeRecords = ['large-a', 'large-b', 'large-c'].map((id) => event(id));
    large.context.colorCalendarTomatoEvents(largeRecords, { ...settings, tomatoColorMode: 'document' });
    large.requests[0].resolve(new Map(largeRecords.map((e) => [e.extendedProps.taskBlockId, { docId: 'doc-work' }])));
    await settle();
    large.context.colorCalendarTomatoEvents(largeRecords, { ...settings, tomatoColorMode: 'document' });
    assert.equal(large.requests.length, 1, 'a visible range larger than the cache cap must not create a refetch loop');

    const warmed = harness();
    warmed.tasks.set('task-a', { root_id: 'notebook-doc' });
    warmed.context.window.tmCalendarWarmDocsToGroupCache = async () => {
        warmed.context.getCalendarDocsToGroupMapSnapshot = () => new Map([['notebook-doc', 'work']]);
    };
    const groupSettings = { ...settings, tomatoColorMode: 'group' };
    assert.equal(warmed.context.colorCalendarTomatoEvents([event('task-a')], groupSettings)[0].backgroundColor, '#999999');
    await settle();
    assert.equal(warmed.refreshes(), 1, 'notebook membership loaded in the background must refresh the initial fallback');
    assert.equal(warmed.context.colorCalendarTomatoEvents([event('task-a')], groupSettings)[0].backgroundColor, '#335577');
    await settle();
    assert.equal(warmed.refreshes(), 1, 'unchanged group membership must not create a refetch loop');

    // Exercise real settings persistence statements, including legacy default.
    const storeSource = fs.readFileSync(path.join(root, 'src/task-horizon/main/10-stores-rules-and-cache.js'), 'utf8');
    const loadLine = storeSource.split('\n').find((line) => line.includes("Storage.get('tm_calendar_tomato_color_mode'"));
    const saveLine = storeSource.split('\n').find((line) => line.includes("Storage.set('tm_calendar_tomato_color_mode'"));
    const normalizeLine = storeSource.split('\n').find((line) => line.includes("if (!['group', 'document'].includes(this.data.calendarTomatoColorMode))"));
    const saved = new Map();
    const store = { data: {}, Storage: { get: (key, fallback) => saved.get(key) ?? fallback, set: (key, value) => saved.set(key, value) } };
    for (const mode of ['type', 'group', 'document', 'invalid']) {
        store.data.calendarTomatoColorMode = mode;
        vm.runInNewContext(saveLine, store);
        store.data.calendarTomatoColorMode = 'type';
        vm.runInNewContext(loadLine + '\n' + normalizeLine, store);
        assert.equal(store.data.calendarTomatoColorMode, mode === 'invalid' ? 'type' : mode);
    }
    console.log('calendar tomato color tests passed');
})().catch((error) => { console.error(error); process.exitCode = 1; });
