'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { chromium } = require('./i18n-browser-fixture');
const root = path.resolve(__dirname, '..');
const resources = new Map();
const requests = [];
let version = 0, incomplete = false, conflict = false, lostAck = false;
const escapeXML = value => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const multi = body => `<d:multistatus xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav">${body}</d:multistatus>`;
const row = (href, properties, status = '200 OK') => `<d:response><d:href>${escapeXML(href)}</d:href><d:propstat><d:prop>${properties}</d:prop><d:status>HTTP/1.1 ${status}</d:status></d:propstat></d:response>`;
function dav(request) {
    const target = new URL(request.url).pathname;
    const headers = Object.assign({}, ...request.headers);
    const body = Buffer.from(request.payload, 'base64').toString('utf8');
    requests.push({ method: request.method, target, headers, body });
    assert.equal(headers.Authorization, `Basic ${Buffer.from('fixture-user:fixture-password').toString('base64')}`);
    assert.equal(request.payloadEncoding, 'base64');
    let status = 200, result = '';
    if (request.method === 'PROPFIND') {
        status = 207;
        if (target === '/dav/') result = multi(row(target, '<d:current-user-principal><d:href>/principal/</d:href></d:current-user-principal>'));
        else if (target === '/principal/') result = multi(row(target, '<c:calendar-home-set><d:href>/calendars/</d:href></c:calendar-home-set>'));
        else result = multi(['main', 'readonly', 'todo'].map(name => row(`/calendars/${name}/`, `<d:resourcetype><d:collection/><c:calendar/></d:resourcetype><d:displayname>${name}</d:displayname><c:supported-calendar-component-set><c:comp name="${name === 'todo' ? 'VTODO' : 'VEVENT'}"/></c:supported-calendar-component-set><d:current-user-privilege-set><d:privilege><d:${name === 'readonly' ? 'read' : 'write'}/></d:privilege></d:current-user-privilege-set>`)).join(''));
    } else if (request.method === 'REPORT') {
        assert.match(body, /calendar-query/);
        result = multi([...resources].map(([href, item]) => row(href, `<d:getetag>${escapeXML(item.etag)}</d:getetag><c:calendar-data>${escapeXML(item.ics)}</c:calendar-data>`)).join('')
            + (incomplete ? row('/calendars/main/missing.ics', '<c:calendar-data/>', '404 Not Found') : ''));
        status = 207;
    } else if (request.method === 'PUT') {
        assert.equal(request.contentType, 'text/calendar; charset=utf-8');
        assert.match(body, /BEGIN:VCALENDAR\r\n/);
        assert.equal((body.match(/BEGIN:VEVENT/g) || []).length, 1);
        const previous = resources.get(target);
        if ((headers['If-None-Match'] === '*' && previous) || (headers['If-Match'] && headers['If-Match'] !== previous?.etag) || conflict) status = 412;
        else {
            resources.set(target, { ics: body, etag: `"${++version}"` });
            status = previous ? 204 : 201;
            if (lostAck) { lostAck = false; status = 599; }
        }
    } else if (request.method === 'DELETE') {
        const previous = resources.get(target);
        assert.ok(headers['If-Match'], 'deletion must be conditional');
        if (!previous) status = 404;
        else if (headers['If-Match'] !== previous.etag) status = 412;
        else { resources.delete(target); status = 204; }
    } else throw new Error(`Unexpected method ${request.method}`);
    return { code: 0, data: { status, body: result, headers: {} } };
}
const server = http.createServer(async (req, res) => {
    if (req.url === '/api/network/forwardProxy') {
        let body = '';
        for await (const chunk of req) body += chunk;
        try { res.setHeader('content-type', 'application/json'); res.end(JSON.stringify(dav(JSON.parse(body)))); }
        catch (error) { res.statusCode = 500; res.end(String(error.stack)); }
    } else { res.setHeader('content-type', 'text/html'); res.end('<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><body></body>'); }
});
(async () => {
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(String(error)));
    try {
        await page.goto(`http://127.0.0.1:${server.address().port}`);
        await page.addScriptTag({ content: fs.readFileSync(path.join(root, 'calendar-subscription-core.js'), 'utf8') });
        await page.evaluate(() => {
            window.store = { data: { calendarIcsEnabled: false, calendarCaldav: { enabled: true, url: `${location.origin}/dav/`,
                username: 'fixture-user', password: 'fixture-password', calendarUrl: `${location.origin}/calendars/main/`, namespace: 'fixture-owner', mode: 'manual' } },
                save: async () => {} };
            window.events = [
                { uidSeed: 'task-date:a', source: 'task', title: '全天任务', allDay: true, startDate: '2026-11-03', endDate: '2026-11-04' },
                { uidSeed: 'schedule:b:100', caldavKey: 'schedule:b:single', source: 'schedule', title: '会议', description: '中文备注\n第二行', startAt: Date.UTC(2026, 10, 3, 1), endAt: Date.UTC(2026, 10, 3, 2), alarm: { trigger: '-PT15M' } },
            ];
            window.sourceFailure = false;
            window.statusUpdates = [];
            window.notifications = [];
            window.host = {
                getStore: () => store,
                statusChanged: () => statusUpdates.push(__tmCalendarCaldav.isRunning()),
                notify: (message, kind) => notifications.push({ message, kind }),
                async collect() { if (sourceFailure) throw new Error('fixture read failure'); return { events, calendarName: 'Fixture' }; },
                request: (url, method, options, run) => run.wait('', async signal => {
                    const response = await fetch('/api/network/forwardProxy', { method: 'POST', signal, headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ url, method, contentType: options.contentType, payloadEncoding: 'base64',
                            payload: btoa(Array.from(new TextEncoder().encode(options.body), byte => String.fromCharCode(byte)).join('')),
                            headers: [{ Authorization: options.authorization }, ...Object.entries(options.headers).map(([key, value]) => ({ [key]: value }))] }) });
                    if (!response.ok) throw new Error(await response.text());
                    return (await response.json()).data;
                }),
            };
            __tmCalendarCaldav.configure(host);
            window.upload = () => __tmCalendarCaldav.uploadNow();
        });
        const discovered = await page.evaluate(() => __tmCalendarCaldav.discover());
        assert.deepEqual(discovered.map(item => item.name), ['main'], 'discovery follows principal/home and excludes todo-only and read-only calendars');
        resources.set('/calendars/main/foreign.ics', { etag: '"foreign"', ics: 'BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nUID:foreign\r\nSUMMARY:Personal\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n' });
        assert.deepEqual(await page.evaluate(() => upload()), { created: 2, updated: 0, deleted: 0, unchanged: 0 });
        assert.equal(resources.size, 3);
        const original = [...resources].find(([, item]) => item.ics.includes('SUMMARY:会议'));
        assert.ok(original);
        assert.match(original[1].ics, /DESCRIPTION:中文备注\\n第二行/);
        assert.match(original[1].ics, /TRIGGER:-PT15M/);
        assert.deepEqual(await page.evaluate(() => upload()), { created: 0, updated: 0, deleted: 0, unchanged: 2 });
        assert.deepEqual(await page.evaluate(() => __tmCalendarCaldav.uploadNow({ interactive: true })), { created: 0, updated: 0, deleted: 0, unchanged: 2 });
        assert.equal(await page.evaluate(() => notifications.at(-1).kind), 'success');
        assert.equal(await page.evaluate(() => statusUpdates.includes(true) && statusUpdates.at(-1) === false), true, 'headless uploads notify the shared topbar when starting and finishing');
        await page.evaluate(() => { events[1].startAt += 3600000; events[1].endAt += 3600000; events[1].uidSeed = 'schedule:b:200'; events[1].title = '改期会议'; });
        assert.deepEqual(await page.evaluate(() => upload()), { created: 0, updated: 1, deleted: 0, unchanged: 1 });
        assert.ok(resources.get(original[0]).ics.includes('SUMMARY:改期会议'), 'rescheduling preserves the resource URL');
        assert.equal(resources.get(original[0]).ics.match(/UID:(.*)/)[1], original[1].ics.match(/UID:(.*)/)[1], 'rescheduling preserves UID');
        await page.evaluate(() => events.shift());
        assert.deepEqual(await page.evaluate(() => upload()), { created: 0, updated: 0, deleted: 1, unchanged: 1 });
        assert.ok(resources.has('/calendars/main/foreign.ics'), 'foreign events survive cleanup');
        incomplete = true;
        const beforeIncomplete = requests.length;
        assert.equal(await page.evaluate(() => upload().then(() => '', error => error.code)), 'incompleteResponse');
        assert.deepEqual(requests.slice(beforeIncomplete).map(item => item.method), ['REPORT'], 'incomplete multistatus performs no writes');
        incomplete = false;
        conflict = true;
        await page.evaluate(() => { events[0].title = 'Local edit'; });
        assert.equal(await page.evaluate(() => __tmCalendarCaldav.uploadNow({ interactive: true }).then(() => 0, error => error.status)), 412);
        assert.equal(await page.evaluate(() => notifications.at(-1).kind), 'error');
        assert.ok(!requests.some(item => item.method === 'PUT' && !item.headers['If-Match'] && !item.headers['If-None-Match']), 'conflicts never trigger unconditional PUT');
        conflict = false;
        lostAck = true;
        const beforeLost = requests.filter(item => item.method === 'PUT').length;
        assert.equal(await page.evaluate(() => upload().then(() => 0, error => error.status)), 599);
        assert.deepEqual(await page.evaluate(() => upload()), { created: 0, updated: 0, deleted: 0, unchanged: 1 });
        assert.equal(requests.filter(item => item.method === 'PUT').length, beforeLost + 1, 'retry reconciles a lost acknowledgement instead of creating or writing again');
        await page.evaluate(() => { sourceFailure = true; });
        const beforeFailure = requests.length;
        assert.equal(await page.evaluate(() => upload().then(() => false, () => true)), true);
        assert.equal(requests.length, beforeFailure, 'source failure never reaches remote deletion');
        await page.evaluate(() => {
            sourceFailure = false;
            host.collect = () => new Promise(resolve => { window.releaseSource = () => resolve({ events, calendarName: 'Fixture' }); });
            window.pendingUpload = upload().then(() => '', error => error.code);
        });
        await page.waitForFunction(() => typeof releaseSource === 'function');
        assert.equal(await page.evaluate(() => __tmCalendarCaldav.isRunning()), true);
        await page.evaluate(() => { __tmCalendarCaldav.markDirty(); releaseSource(); });
        assert.equal(await page.evaluate(() => pendingUpload), 'changed', 'a changed snapshot cannot publish or delete');
        assert.equal(await page.evaluate(() => __tmCalendarCaldav.isRunning()), false);
        await page.evaluate(() => {
            host.collect = async () => ({ events, calendarName: 'Fixture' });
            store.data.calendarCaldav.mode = 'auto'; store.data.calendarCaldav.writerDevice = 'another-device';
            __tmCalendarCaldav.reconcile();
        });
        assert.equal(await page.evaluate(() => __tmCalendarCaldav.automatic()), false, 'synced config does not enable automatic uploads on a second device');
        await page.evaluate(() => {
            document.body.innerHTML = __tmCalendarCaldav.renderSettings(store);
            window.binding = new AbortController();
            __tmCalendarCaldav.bind(document.body, store, binding.signal);
        });
        assert.equal(await page.locator('[data-tm-caldav-field="mode"]').inputValue(), 'manual');
        assert.equal(await page.locator('[data-tm-caldav-field="password"]').getAttribute('type'), 'password');
        await page.locator('[data-tm-caldav-field="url"]').fill(`${new URL(page.url()).origin}/dav/`);
        await page.locator('[data-tm-caldav-field="url"]').dispatchEvent('change');
        assert.equal(await page.evaluate(() => store.data.calendarCaldav.calendarUrl), '', 'changing a connection clears the old target');
        await page.locator('[data-tm-caldav-action="discover"]').click();
        await page.waitForFunction(() => store.data.calendarCaldav.calendarUrl.endsWith('/main/'));
        assert.equal(await page.locator('[data-tm-caldav-field="calendarUrl"]').inputValue(), discovered[0].url);
        await page.locator('[data-tm-caldav-field="mode"]').selectOption('auto');
        assert.equal(await page.evaluate(() => __tmCalendarCaldav.automatic()), true);
        await page.evaluate(() => { __tmCalendarCaldav.cleanup(); });
        assert.equal(await page.evaluate(() => __tmCalendarCaldav.automatic()), false);
        assert.deepEqual(errors, []);
        console.log('CalDAV browser behavior passed: discovery, Unicode/alarms, create/update/delete, stable identity, dedupe, partial reads, conflicts, lost responses, stale snapshots, device isolation and settings.');
    } finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
})().catch(error => { console.error(error); process.exitCode = 1; server.close(); });
