'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { test, before, after } = require('node:test');
const { chromium } = require('./i18n-browser-fixture');

const root = path.resolve(__dirname, '..');
const dialogs = fs.readFileSync(path.join(root, 'src/task-horizon/main/30-dialogs-and-ui-foundation.js'), 'utf8');
const groupActions = fs.readFileSync(path.join(root, 'src/task-horizon/main/settings/62-settings-columns-and-rules.js'), 'utf8');
const styles = fs.readFileSync(path.join(root, 'task-horizon.css'), 'utf8');
const section = (source, startText, endText) => {
    const start = source.indexOf(startText);
    const end = source.indexOf(endText, start + startText.length);
    assert.ok(start >= 0 && end > start, startText);
    return source.slice(start, end);
};
const functionSection = (source, startText) => {
    const start = source.indexOf(startText);
    const end = source.indexOf('\n    };', start + startText.length);
    assert.ok(start >= 0 && end > start, startText);
    return source.slice(start, end + 7);
};
const runtime = [
    `window.SettingsStore = {
        data: { currentGroupId: 'work', docGroups: [{ id: 'work', name: 'Work', docs: [] }] },
        updateDocGroups: async groups => { SettingsStore.data.docGroups = groups; },
        updateCurrentGroupId: async id => { SettingsStore.data.currentGroupId = id; },
    };
    window.__tmT = key => key;
    window.esc = value => String(value || '').replace(/[&<>"']/g, '');
    window.__tmApplyPopupOpenAnimation = () => {};
    window.__tmModalStackBind = () => () => {};
    window.__tmResolveDocGroupName = group => group?.name || '';
    window.showSettings = () => {};
    window.hint = () => {};`,
    section(dialogs, '    function showConfirm(', '    function __tmNormalizeDurationInputValue('),
    functionSection(groupActions, '    window.deleteCurrentGroup = async function('),
].join('\n');

let server;
let browser;
let origin;
before(async () => {
    server = http.createServer((_req, res) => { res.setHeader('content-type', 'text/html'); res.end('<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><div>Test</div>'); });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    origin = 'http://127.0.0.1:' + server.address().port;
    browser = await chromium.launch({ headless: true });
});
after(async () => { await browser?.close(); await new Promise(resolve => server?.close(resolve)); });

for (const width of [320, 390]) {
    test(`document-group delete confirmation is tappable at ${width}px`, async () => {
        const context = await browser.newContext({ viewport: { width, height: 640 }, isMobile: true, hasTouch: true });
        const page = await context.newPage();
        try {
            await page.goto(origin);
            await page.addStyleTag({ content: styles });
            await page.addScriptTag({ content: runtime });
            await page.evaluate(() => { window.deletePromise = window.deleteCurrentGroup(); });
            const confirm = page.locator('#tm-confirm-ok');
            await confirm.waitFor({ state: 'visible' });
            const box = await confirm.boundingBox();
            assert.ok(box && box.x >= 0 && box.x + box.width <= width);
            await confirm.click();
            await page.evaluate(() => window.deletePromise);
            assert.deepEqual(await page.evaluate(() => SettingsStore.data.docGroups), []);
        } finally {
            await context.close();
        }
    });
}

test('cancelling document-group deletion leaves the group intact', async () => {
    const context = await browser.newContext({ viewport: { width: 320, height: 640 }, isMobile: true, hasTouch: true });
    const page = await context.newPage();
    try {
        await page.goto(origin);
        await page.addStyleTag({ content: styles });
        await page.addScriptTag({ content: runtime });
        await page.evaluate(() => { window.deletePromise = window.deleteCurrentGroup(); });
        const cancel = page.locator('#tm-confirm-cancel');
        await cancel.waitFor({ state: 'visible' });
        const box = await cancel.boundingBox();
        assert.ok(box && box.x >= 0 && box.x + box.width <= 320);
        await cancel.click();
        await page.evaluate(() => window.deletePromise);
        assert.deepEqual(await page.evaluate(() => SettingsStore.data.docGroups.map(group => group.id)), ['work']);
    } finally {
        await context.close();
    }
});
