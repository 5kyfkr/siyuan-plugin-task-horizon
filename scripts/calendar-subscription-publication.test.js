'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const { createHash } = require('node:crypto');
// Keep hashing deterministic under the fake clock. Native WebCrypto runs on a
// worker and is not drained by setImmediate; the core has its own hash tests.
const core = {
    ...require('../calendar-subscription-core'),
    hashText: async (value) => createHash('sha256').update(String(value ?? '')).digest('hex'),
};

const source = fs.readFileSync(path.join(__dirname, '..', 'calendar-view.js'), 'utf8');
function between(start, end) {
    const from = source.indexOf(start);
    const to = source.indexOf(end, from + start.length);
    assert.ok(from >= 0 && to > from, start);
    return source.slice(from, to);
}
const publisherCode = between('    const calendarSubscriptionPublisher =', '    async function pickCalendarIndependentScheduleTaskDoc');
const fileReadCode = between('    async function postJSON(', '    async function putFileText(');
const constants = between('    const STORAGE =', '    const CN_HOLIDAY_CACHE_VERSION');
const flush = () => new Promise((resolve) => setImmediate(resolve));
async function drain() {
    for (let index = 0; index < 8; index += 1) await flush();
}
function deferred() {
    let resolve;
    let reject;
    const promise = new Promise((ok, fail) => { resolve = ok; reject = fail; });
    return { promise, resolve, reject };
}
function response(data = null) {
    return { ok: true, status: 200, json: async () => ({ code: 0, data }), text: async () => '{}' };
}

function harness(overrides = {}) {
    let now = Date.UTC(2026, 8, 27, 12);
    let nextTimer = 1;
    const timers = new Map();
    const storage = new Map();
    const requests = [];
    const taskReads = [];
    const notices = [];
    const uiStates = [];
    const eventListeners = new Map();
    const mutationListeners = new Set();
    const settings = {
        icsEnabled: true, icsPublishMode: 'auto', icsProvider: 'webdav',
        icsWebdavUrl: 'https://calendar.example.test/dav/',
        icsWebdavUsername: 'test', icsWebdavPassword: 'test',
        icsCalendarName: 'Test', icsIncludeTaskDates: false,
        icsIncludeTomatoReminders: false, icsIncludeTaskNotes: false,
        icsChainPublicConfirmed: true, icsChainFileName: 'test.ics',
        ...overrides.settings,
    };
    let remoteText = '';
    const data = {};
    for (const key of Object.keys(settings)) {
        Object.defineProperty(data, `calendar${key[0].toUpperCase()}${key.slice(1)}`, {
            enumerable: true,
            get: () => settings[key],
            set: (value) => { settings[key] = value; },
        });
    }
    const state = { scheduleCache: {}, settingsStore: { data, loaded: true, saveDirty: false } };
    class ClockDate extends Date {
        constructor(...args) { super(...(args.length ? args : [now])); }
        static now() { return now; }
    }
    const sandbox = {
        Date: ClockDate, console, AbortController, URL, TextEncoder, Uint8Array, FormData, Blob,
        btoa: (value) => Buffer.from(value, 'binary').toString('base64'),
        localStorage: { getItem: (key) => storage.get(key), setItem: (key, value) => storage.set(key, value) },
        setTimeout(fn, ms) { const id = nextTimer++; timers.set(id, { fn, at: now + ms, ms }); return id; },
        clearTimeout(id) { timers.delete(id); },
        state,
        Element: class {}, HTMLButtonElement: class {}, HTMLInputElement: class {},
        document: { contains: () => false },
        getSettings: () => settings,
        __tmCalendarSubscriptionCore: core,
        __taskHorizonSyncCalendarSubscriptionTopBar: (meta) => uiStates.push(meta.running),
        toast: (message, kind) => notices.push({ message, kind }),
        loadScheduleAll: async () => [],
        formatDateKey: (date) => date.toISOString().slice(0, 10),
        parseDateOnly: (value) => new ClockDate(`${value}T00:00:00Z`),
        addEventListener(type, listener) {
            if (!eventListeners.has(type)) eventListeners.set(type, new Set());
            eventListeners.get(type).add(listener);
        },
        removeEventListener(type, listener) { eventListeners.get(type)?.delete(listener); },
        __tmTaskMutationBus: {
            subscribe(listener) { mutationListeners.add(listener); return () => mutationListeners.delete(listener); },
        },
        tmQueryCalendarTaskDateEvents: async (start, end, options) => { taskReads.push(options); return []; },
        siyuan: { user: { userId: 'test-user', userSiYuanSubscriptionStatus: 0, userSiYuanProExpireTime: -1 } },
    };
    sandbox.window = sandbox;
    const defaultFetch = async (url, init) => {
        if (url === '/api/file/getFile') return { ...response(), text: async () => JSON.stringify(state.settingsStore.data) };
        if (url === '/api/setting/getCloudUser') return response(sandbox.siyuan.user);
        if (url === '/api/network/forwardProxy') {
            const body = JSON.parse(init.body);
            if (body.method === 'PUT') remoteText = Buffer.from(body.payload, 'base64').toString('utf8');
            return response({ status: 200, body: body.method === 'GET' ? remoteText : '' });
        }
        if (url === '/api/file/putFile') {
            if (init.body.get('path')?.startsWith('/data/assets/') && init.body.get('file')) {
                remoteText = await init.body.get('file').text();
            }
            return response();
        }
        if (url === '/api/asset/uploadCloudByAssetsPaths') return response();
        throw new Error(`Unexpected fetch ${url}`);
    };
    sandbox.fetch = async (url, init) => {
        requests.push({ url, init });
        return overrides.fetch ? overrides.fetch(url, init, defaultFetch) : defaultFetch(url, init);
    };
    const context = vm.createContext(sandbox);
    vm.runInContext(constants + fileReadCode + publisherCode + `
        calendarSubscriptionPublisher.bound = true;
        globalThis.publisher = calendarSubscriptionPublisher;
        globalThis.api = calendarSubscriptionApi;
    `, context);
    return {
        context, settings, state, requests, notices, taskReads, uiStates, timers, mutationListeners,
        api: context.api, publisher: context.publisher,
        bind() {
            context.publisher.bound = false;
            context.bindCalendarSubscriptionPublisher();
            context.publisher.startupPending = false;
            sandbox.clearTimeout(context.publisher.startupTimer);
            sandbox.clearTimeout(context.publisher.dailyTimer);
            context.publisher.startupTimer = null;
            context.publisher.dailyTimer = null;
        },
        dispatch(type, detail = {}) { for (const listener of eventListeners.get(type) || []) listener({ type, detail }); },
        mutate(mutation) { for (const listener of mutationListeners) listener(mutation); },
        async advance(ms) {
            const end = now + ms;
            while (true) {
                const next = [...timers].filter(([, item]) => item.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
                if (!next) break;
                now = next[1].at;
                timers.delete(next[0]);
                next[1].fn();
                await drain();
            }
            now = end;
            await drain();
        },
    };
}

test('a pending settings response times out, aborts its request and cannot affect a later publication', async () => {
    const lateBody = deferred();
    let first = true;
    const h = harness({ fetch: async (url, init, next) => {
        if (url === '/api/file/getFile' && first) {
            first = false;
            return { ok: true, text: () => lateBody.promise };
        }
        return next(url, init);
    } });
    const job = h.api.publishNow({ automatic: true, source: 'startup' });
    await flush();
    assert.equal(h.api.isRunning(), true);
    assert.equal(h.api.getStatus().phase, '读取上传设置');
    await h.advance(180000);
    assert.equal((await job).ok, false);
    assert.equal(h.api.isRunning(), false);
    assert.equal(h.uiStates.at(-1), false);
    assert.equal(h.requests[0].init.signal.aborted, true);
    assert.match(h.api.getStatus().lastError, /读取上传设置超时/);
    assert.equal(h.requests.length, 1);
    assert.equal(h.timers.size, 0);
    assert.equal((await h.api.publishNow({ force: true })).skipped, false);
    const status = h.api.getStatus();
    const requestCount = h.requests.length;
    lateBody.resolve('{"calendarIcsEnabled":false}');
    await flush();
    assert.equal(h.requests.length, requestCount);
    assert.equal(h.state.settingsStore.data.calendarIcsEnabled, true);
    assert.deepEqual(h.api.getStatus(), status);
});

test('shared schedule reads remain reusable after the publisher stops waiting', async () => {
    const read = deferred();
    const h = harness();
    h.state.scheduleCache.inflight = read.promise;
    const job = h.api.publishNow({ automatic: true });
    await flush();
    await h.advance(180000);
    assert.equal((await job).ok, false);
    assert.match(h.api.getStatus().lastError, /等待日程读取超时/);
    read.resolve([]);
    assert.deepEqual(await h.state.scheduleCache.inflight, []);
    await flush();
    assert.equal(h.requests.length, 1, 'late read must not advance to an upload');
});

for (const provider of ['webdav', 'chain']) {
    test(`${provider} upload timeout discards queued retries and late responses cannot write success`, async () => {
        const upload = deferred();
        let uploadRequest;
        const h = harness({ settings: { icsProvider: provider }, fetch: (url, init, next) => {
            if (url === '/api/asset/uploadCloudByAssetsPaths'
                || (url === '/api/network/forwardProxy' && JSON.parse(init.body).method === 'PUT')) {
                uploadRequest = { url, init };
                return upload.promise;
            }
            return next(url, init);
        } });
        const job = h.api.publishNow({ automatic: true, source: 'startup' });
        await drain();
        assert.ok(uploadRequest);
        h.api.markDirty('task-list-updated');
        await h.advance(180000);
        assert.equal((await job).ok, false);
        assert.equal(h.api.isRunning(), false);
        assert.match(h.api.getStatus().lastError, /远端结果未确认/);
        assert.equal(uploadRequest.init.signal.aborted, true);
        assert.equal(h.publisher.pendingRequest, null);
        assert.equal(h.timers.size, 0, 'timeout must not immediately retry a possibly ongoing server write');
        const count = h.requests.length;
        upload.resolve(response({ status: 200, body: '' }));
        await drain();
        assert.equal(h.requests.length, count, 'no verification or local snapshot write after timeout');
        assert.equal(h.api.getStatus().lastSuccessAt, undefined);
    });
}

test('continuous mutations stop after three attempts and reuse the debounce timer', async () => {
    const h = harness();
    let reads = 0;
    h.context.loadScheduleAll = async () => { reads++; h.api.markDirty('schedule-updated'); return []; };
    const result = await h.api.publishNow({ automatic: true });
    assert.equal(result.stale, true);
    assert.equal(reads, 3);
    assert.equal(h.api.isRunning(), false);
    assert.equal(h.timers.size, 1);
    assert.equal([...h.timers.values()][0].ms, 30000);
    h.context.loadScheduleAll = async () => [];
    await h.advance(30000);
    assert.equal(h.api.isRunning(), false);
    assert.ok(h.api.getStatus().lastSuccessAt);
    assert.equal(h.timers.size, 0);
});

test('all attempts share a deadline instead of restarting the timeout on each retry', async () => {
    const h = harness();
    let reads = 0;
    h.context.loadScheduleAll = () => {
        reads++;
        return new Promise((resolve) => h.context.setTimeout(() => {
            h.api.markDirty('schedule-updated');
            resolve([]);
        }, 70000));
    };
    const job = h.api.publishNow({ automatic: true });
    await drain();
    await h.advance(180000);
    assert.equal((await job).ok, false);
    assert.equal(reads, 3);
    assert.equal(h.api.isRunning(), false);
    assert.equal(h.publisher.debounceTimer, null);
    h.context.loadScheduleAll = async () => [];
});

test('queued mutations refresh task dates while unchanged content still skips the upload', async () => {
    const h = harness({ settings: { icsIncludeTaskDates: true } });
    await h.api.publishNow({ force: true });
    const putsBefore = h.requests.filter((r) => r.url === '/api/network/forwardProxy' && JSON.parse(r.init.body).method === 'PUT').length;
    h.taskReads.length = 0;
    h.context.tmQueryCalendarTaskDateEvents = async (start, end, options) => {
        h.taskReads.push(options);
        if (h.taskReads.length === 1) h.api.markDirty('task-list-updated');
        return [];
    };
    const result = await h.api.publishNow({ automatic: true, source: 'schedule-updated' });
    assert.equal(h.taskReads.length, 2);
    assert.equal(h.taskReads[0].forceFresh, false);
    assert.equal(h.taskReads[1].forceFresh, true);
    assert.equal(h.taskReads[1].fastFirst, false);
    assert.equal(result.skipped, true);
    const putsAfter = h.requests.filter((r) => r.url === '/api/network/forwardProxy' && JSON.parse(r.init.body).method === 'PUT').length;
    assert.equal(putsAfter, putsBefore);
});

test('switching to manual stops automatic follow-ups and still accepts an explicit manual request', async () => {
    const read = deferred();
    const h = harness();
    h.context.loadScheduleAll = () => read.promise;
    const auto = h.api.publishNow({ automatic: true });
    await drain();
    h.api.markDirty('task-list-updated');
    h.settings.icsPublishMode = 'manual';
    h.api.reconcile();
    assert.equal(h.publisher.pendingRequest, null);
    read.resolve([]);
    await auto;
    assert.equal(h.requests.filter((r) => r.url === '/api/network/forwardProxy').length, 0);
    assert.equal(h.timers.size, 0);
    assert.equal((await h.api.publishNow({ force: true, interactive: true })).skipped, false);
    assert.equal(h.notices.at(-1).kind, 'success');
});

test('an explicit request queued immediately after start is not lost or downgraded by automatic changes', async () => {
    const h = harness();
    const first = h.api.publishNow({ automatic: true });
    const manual = h.api.publishNow({ force: true, interactive: true, source: 'topbar' });
    h.api.markDirty('task-list-updated');
    assert.equal(h.publisher.pendingRequest.automatic, false);
    assert.equal(h.publisher.pendingRequest.force, true);
    await Promise.all([first, manual]);
    assert.equal(h.requests.filter((r) => r.url === '/api/network/forwardProxy' && JSON.parse(r.init.body).method === 'PUT').length, 2);
    assert.equal(h.notices.at(-1).kind, 'success');
});

test('normal remote verification failures report their stage and release the publisher', async () => {
    const h = harness({ fetch: (url, init, next) => {
        if (url === '/api/network/forwardProxy' && JSON.parse(init.body).method === 'GET') {
            return response({ status: 200, body: 'old-content' });
        }
        return next(url, init);
    } });
    const job = h.api.publishNow({ force: true, interactive: true });
    await drain();
    await h.advance(1200);
    const result = await job;
    assert.equal(result.ok, false);
    assert.match(result.error, /校验远端 ICS/);
    assert.equal(h.api.isRunning(), false);
    assert.equal(h.api.getStatus().lastSuccessAt, undefined);
    assert.equal(h.notices.at(-1).kind, 'error');
    assert.equal(h.timers.size, 0);
});

test('unchanged filter refreshes do not invalidate any publication attempt', async () => {
    const h = harness({ settings: { icsIncludeTaskDates: true } });
    h.bind();
    h.context.tmQueryCalendarTaskDateEvents = async () => {
        h.taskReads.push({});
        h.dispatch('tm:filtered-tasks-updated');
        return [];
    };
    const result = await h.api.publishNow({ force: true, interactive: true });
    assert.equal(result.skipped, false);
    assert.equal(h.taskReads.length, 1);
    assert.equal(h.notices.some((notice) => notice.kind === 'warning'), false);
    assert.equal(h.requests.filter((r) => r.url === '/api/network/forwardProxy' && JSON.parse(r.init.body).method === 'PUT').length, 1);
    h.context.tmQueryCalendarTaskDateEvents = async (start, end, options) => { h.taskReads.push(options); return []; };
    await h.advance(30000);
    assert.equal(h.taskReads.at(-1).forceFresh, true);
    assert.equal(h.requests.filter((r) => r.url === '/api/network/forwardProxy' && JSON.parse(r.init.body).method === 'PUT').length, 1);
    assert.equal(h.timers.size, 0);
});

test('real task mutations invalidate the old snapshot and publish the latest task date', async () => {
    const h = harness({ settings: { icsIncludeTaskDates: true } });
    h.bind();
    h.context.tmQueryCalendarTaskDateEvents = async (start, end, options) => {
        h.taskReads.push(options);
        if (h.taskReads.length === 1) {
            h.mutate({ type: 'taskPatch', phase: 'commit', taskId: 'task-1', patch: { startDate: '2026-09-28' } });
            return [{ id: 'task-1', title: 'Old date', start: '2026-09-27', endExclusive: '2026-09-28' }];
        }
        return [{ id: 'task-1', title: 'New date', start: '2026-09-28', endExclusive: '2026-09-29' }];
    };
    const result = await h.api.publishNow({ force: true, interactive: true });
    assert.equal(result.skipped, false);
    assert.equal(h.taskReads.length, 2);
    assert.equal(h.taskReads[1].forceFresh, true);
    const puts = h.requests.filter((r) => r.url === '/api/network/forwardProxy' && JSON.parse(r.init.body).method === 'PUT');
    assert.equal(puts.length, 1);
    const ics = Buffer.from(JSON.parse(puts[0].init.body).payload, 'base64').toString('utf8');
    assert.match(ics, /DTSTART;VALUE=DATE:20260928/);
    assert.doesNotMatch(ics, /Old date/);
    h.settings.icsPublishMode = 'manual';
    h.api.reconcile();
    assert.equal(h.mutationListeners.size, 0);
});

for (const shape of ['bom', 'object-envelope', 'text-envelope', 'content-envelope', 'setting-named-content']) {
    test(`settings reader accepts ${shape} without losing synchronized settings`, async () => {
        const shared = { calendarIcsEnabled: true, calendarIcsCalendarName: 'Synced calendar' };
        let raw = JSON.stringify(shared);
        if (shape === 'bom') raw = '\uFEFF' + raw;
        if (shape === 'object-envelope') raw = JSON.stringify({ code: 0, msg: '', data: shared });
        if (shape === 'text-envelope') raw = JSON.stringify({ code: 0, msg: '', data: raw });
        if (shape === 'content-envelope') raw = JSON.stringify({ code: 0, msg: '', data: { content: raw } });
        if (shape === 'setting-named-content') raw = JSON.stringify({ ...shared, content: 'ordinary setting', data: 'another setting' });
        const h = harness({ fetch: (url, init, next) => url === '/api/file/getFile'
            ? { ...response(), text: async () => raw } : next(url, init) });
        const result = await h.api.publishNow({ force: true });
        assert.equal(result.skipped, false);
        assert.equal(h.settings.icsCalendarName, 'Synced calendar');
    });
}

test('transient incomplete settings are retried once before publication', async () => {
    let reads = 0;
    const h = harness({ fetch: (url, init, next) => {
        if (url === '/api/file/getFile' && ++reads === 1) return { ...response(), text: async () => '{' };
        return next(url, init);
    } });
    const job = h.api.publishNow({ force: true });
    await drain();
    await h.advance(220);
    assert.equal((await job).skipped, false);
    assert.equal(reads, 2);
});

for (const [kind, settingsResponse, expected] of [
    ['missing', { ok: true, status: 202, text: async () => '{"code":404,"msg":"missing"}' }, /尚未同步/],
    ['forbidden', { ok: false, status: 403 }, /HTTP 403/],
    ['corrupt', { ok: true, status: 200, text: async () => '{"calendarIcsEnabled":' }, /JSON 格式不完整/],
    ['empty', { ok: true, status: 200, text: async () => '{}' }, /缺少日历 ICS 配置/],
]) {
    test(`${kind} settings report the cause and never upload with cached credentials`, async () => {
        const h = harness({ fetch: (url, init, next) => url === '/api/file/getFile' ? settingsResponse : next(url, init) });
        const job = h.api.publishNow({ force: true });
        await drain();
        await h.advance(220);
        const result = await job;
        assert.equal(result.ok, false);
        assert.match(result.error, expected);
        assert.equal(h.requests.length, 2);
        assert.equal(h.api.isRunning(), false);
        assert.equal(h.timers.size, 0);
    });
}

test('a synchronized disabled setting prevents publication', async () => {
    const h = harness({ fetch: (url, init, next) => url === '/api/file/getFile'
        ? { ...response(), text: async () => '{"calendarIcsEnabled":false}' } : next(url, init) });
    const result = await h.api.publishNow({ force: true });
    assert.equal(result.stale, true);
    assert.equal(h.settings.icsEnabled, false);
    assert.equal(h.requests.length, 1);
});

test('publication waits for an existing settings save before reading the file', async () => {
    const saved = deferred();
    const h = harness();
    h.state.settingsStore.saving = true;
    h.state.settingsStore.saveNow = () => saved.promise;
    const job = h.api.publishNow({ force: true });
    await drain();
    assert.equal(h.requests.length, 0);
    h.state.settingsStore.saving = false;
    saved.resolve();
    assert.equal((await job).skipped, false);
});

for (const provider of ['webdav', 'chain']) {
    for (const failure of ['kernel-timeout', 'lost-response']) {
        test(`${provider} ${failure} stops queued uploads and marks the result unconfirmed`, async () => {
            let uploads = 0;
            let h;
            h = harness({ settings: { icsProvider: provider }, fetch: (url, init, next) => {
                if (url === '/api/asset/uploadCloudByAssetsPaths'
                    || (url === '/api/network/forwardProxy' && JSON.parse(init.body).method === 'PUT')) {
                    uploads++;
                    h.api.markDirty('task-list-updated');
                    if (failure === 'lost-response') throw new TypeError('Failed to fetch');
                    return { ...response(), json: async () => ({ code: -1, msg: 'context deadline exceeded' }) };
                }
                return next(url, init);
            } });
            const result = await h.api.publishNow({ automatic: true });
            assert.equal(result.ok, false);
            assert.match(result.error, /结果未确认/);
            assert.equal(uploads, 1);
            assert.equal(h.timers.size, 0);
            assert.equal(h.publisher.pendingRequest, null);
            assert.equal(h.api.getStatus().lastSuccessAt, undefined);
        });
    }
}
