'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('./i18n-vm-fixture');
const source = fs.readFileSync(path.join(__dirname, '../calendar-view.js'), 'utf8');
function extract(name) {
    const match = new RegExp('^    (?:async )?function ' + name + '[(]', 'm').exec(source);
    assert.ok(match, name);
    const next = /^    (?:async )?function /m.exec(source.slice(match.index + 1));
    return source.slice(match.index, match.index + 1 + next.index);
}
const record = { recordId: 'manual-1', start: '2026-11-18T10:00:00Z', end: '2026-11-18T11:00:00Z', mode: 'countdown' };
const event = source => ({ extendedProps: { __tmSource: source } });
let rows = [record], reads = 0;
const refetches = [];
const state = {
    dockHistoryRangeVersion: 0, dockHistoryReadInFlight: 0,
    dockHistoryRangeCache: new Map(), dockHistoryRangeInflight: new Map(), dockHistoryDeferredRefetchAt: new Map(),
    calendarSourceEventSnapshots: new Map([['main', { events: [event('tomato'), event('cnHoliday')] }], ['side', { events: [event('tomato'), event('reminder')] }]]),
    _dockHistoryCache: { all: [record] }, _tomatoEventCache: { events: [event('tomato')] },
    calendar: { id: 'main' }, sideDay: { calendar: { id: 'side' } },
};
const context = vm.createContext({
    state, Date, Number, Map, Array, Promise, setTimeout, clearTimeout,
    window: {}, getSettings: () => ({ linkDockTomato: true }),
    toMs: value => new Date(value).getTime(), overlap: (a, b, c, d) => a < d && b > c,
    normalizeCalendarTomatoRecords: rows => Array.from(rows || []), shouldShowMode: () => true,
    DOCK_HISTORY_RANGE_CACHE_TTL_MS: 15000,
    getReminderCalendarRefetchSuppression: () => null,
    EVENT_SOURCE_IDS: { mainAux: 'main-aux', sideAux: 'side-aux' },
    __tmRefetchCalendarSource: (calendar, source) => { refetches.push([calendar.id, source]); },
    __dockTomato: { history: { loadRange: async () => { reads++; return structuredClone(rows); } } },
});
vm.runInContext(['findMaterializedDockHistoryRange', 'loadRecordsForRange', 'clearDockHistoryRangeCache', 'handleCalendarTomatoHistoryUpdated', 'scheduleTomatoRefetch'].map(extract).join('\n'), context);
const start = new Date('2026-11-18T00:00:00Z'), end = new Date('2026-11-19T00:00:00Z');
(async () => {
    assert.equal((await context.loadRecordsForRange(start, end)).length, 1);
    assert.equal((await context.loadRecordsForRange(start, end)).length, 1);
    assert.equal(reads, 1, 'same range still reuses its cache');
    rows = [];
    state.dockHistoryReadSuppressUntil = Date.now() + 10000;
    context.handleCalendarTomatoHistoryUpdated({ detail: { source: 'file', mutation: true } });
    context.handleCalendarTomatoHistoryUpdated({ detail: { source: 'file', mutation: true } });
    assert.equal((await context.loadRecordsForRange(start, end)).length, 0, 'successful empty history removes the last record immediately');
    assert.equal(state._dockHistoryCache, null);
    assert.deepEqual(state.calendarSourceEventSnapshots.get('main').events.map(event => event.extendedProps.__tmSource), ['cnHoliday']);
    assert.deepEqual(state.calendarSourceEventSnapshots.get('side').events.map(event => event.extendedProps.__tmSource), ['reminder']);
    await new Promise(resolve => setTimeout(resolve, 160));
    assert.deepEqual(refetches, [['main', 'main-aux'], ['side', 'side-aux']], 'burst writes refresh both calendars once');

    let releaseOldRead;
    context.clearDockHistoryRangeCache();
    context.__dockTomato.history.loadRange = async () => new Promise(resolve => { releaseOldRead = resolve; });
    const oldRead = context.loadRecordsForRange(start, end);
    const version = state.dockHistoryRangeVersion;
    context.handleCalendarTomatoHistoryUpdated({ detail: { source: 'file' } });
    assert.equal(state.dockHistoryRangeVersion, version + 1, 'even older explicit commit notifications invalidate during a read');
    let newReads = 0;
    context.__dockTomato.history.loadRange = async () => { newReads++; return []; };
    releaseOldRead([record]);
    assert.equal((await oldRead).length, 0, 'an obsolete read returns the new generation rather than old records');
    assert.equal(newReads, 1);
    assert.equal(Array.from(state.dockHistoryRangeCache.values()).every(entry => entry.records.length === 0), true, 'old reads cannot repopulate the cache');

    context.clearDockHistoryRangeCache();
    context.__dockTomato.history.loadRange = async () => { throw new Error('offline'); };
    context.loadDockTomatoHistoryFallbackAll = async () => { throw new Error('must not read stale legacy data'); };
    await assert.rejects(context.loadRecordsForRange(start, end), /offline/);
    assert.equal(state.dockHistoryRangeCache.size, 0, 'read failure is not cached as an authoritative empty result');

    // The production calendar delete action must invalidate before refetching.
    const a = source.indexOf("            if (action === 'delete') {", source.indexOf('    function openRecordModal('));
    const b = source.indexOf("            if (action === 'save')", a);
    let refreshed = false;
    Object.assign(context, { action: 'delete', recordKey: record, history: { delete: async () => true },
        closeModal() {}, toast() {}, refreshDockTomatoCalendarData() { refreshed = true; } });
    await vm.runInContext('(async () => {' + source.slice(a, b) + '})()', context);
    assert.equal(refreshed, true);
    clearTimeout(state.tomatoRefetchTimer);
    console.log('calendar history invalidation and concurrent-read tests passed');
})().catch(error => { clearTimeout(state.tomatoRefetchTimer); console.error(error); process.exitCode = 1; });
