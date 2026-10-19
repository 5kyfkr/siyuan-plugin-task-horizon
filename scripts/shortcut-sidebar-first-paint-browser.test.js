'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { execFileSync } = require('node:child_process');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '..');
execFileSync(process.execPath, [path.join(__dirname, 'shortcut-sidebar-browser-fixture.js')], { cwd: root });
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const fixture = read('output/playwright/shortcut-sidebar-plugin.html');
const boot = '__tmApplyAppearanceThemeVars();load();applyFilters();render();';
assert.ok(fixture.includes(boot));
const html = fixture.replace(boot, `
    const params=new URLSearchParams(location.search);
    globalThis.__taskHorizonRuntimeClientKind=params.get('native')==='1'?'mobile-app':'desktop-browser';
    host.dataset.tmUiMode=params.get('hostMobile')==='1'?'mobile':'desktop';
    SettingsStore.data.shortcutSidebarPreferences={
        mobile:{mode:params.get('mode')||'full'},desktop:{mode:params.get('mode')||'full'},
    };
    window.sidebarFrames=[];
    window.captureSidebar=()=>{
        const layout=state.modal.querySelector('.tm-shortcut-layout');
        const sidebar=layout.querySelector('.tm-shortcut-sidebar'),style=getComputedStyle(sidebar);
        return {mode:layout.dataset.shortcutMode,opacity:Number(style.opacity),
            right:sidebar.getBoundingClientRect().right,left:layout.getBoundingClientRect().left,
            stageLeft:layout.querySelector('.tm-main-stage').getBoundingClientRect().left,
            animations:sidebar.getAnimations().map(animation=>animation.transitionProperty||animation.animationName)};
    };
    const mountSidebar=__tmShortcutSidebar.mount;
    __tmShortcutSidebar.mount=modal=>{mountSidebar(modal);window.sidebarFrames.push(window.captureSidebar());};
    __tmApplyAppearanceThemeVars();load();applyFilters();render();
`);

async function run() {
    const server = http.createServer((req, res) => {
        if (req.url.endsWith('.css')) {
            res.setHeader('content-type', 'text/css');
            res.end(read(req.url.includes('basecoat') ? 'src/basecoat/basecoat.css' : 'task-horizon.css'));
        } else if (req.url.startsWith('/api/')) {
            res.setHeader('content-type', 'application/json');res.end(JSON.stringify({ code: 0, data: [] }));
        } else {
            res.setHeader('content-type', 'text/html; charset=utf-8');res.end(html);
        }
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    let browser;
    try {
        browser = await chromium.launch({ headless: true,
            ...(process.env.PLAYWRIGHT_EXECUTABLE ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE } : {}) });
        for (const device of [
            { name: 'phone', width: 390, native: true },
            { name: 'wide native tablet', width: 1024, native: true },
            { name: 'mobile UI in desktop host', width: 1024, hostMobile: true },
            { name: 'narrow desktop pane', width: 640 },
            { name: 'desktop saved hidden', width: 1440, mode: 'hidden' },
            { name: 'desktop saved expanded', width: 1440, mode: 'full', expanded: true },
        ]) {
            const page = await browser.newPage({ viewport: { width: device.width, height: 844 },
                isMobile: device.native === true, hasTouch: !!(device.native || device.hostMobile) });
            const errors = [];
            page.on('pageerror', error => errors.push(error.message));
            await page.goto('http://127.0.0.1:' + server.address().port
                + `/?native=${device.native ? 1 : 0}&hostMobile=${device.hostMobile ? 1 : 0}&mode=${device.mode || 'full'}`);
            assert.deepEqual(errors, [], device.name + ': fixture startup');
            await page.evaluate(async () => {
                for(let index=0;index<4;index++){
                    await new Promise(resolve=>requestAnimationFrame(resolve));
                    window.sidebarFrames.push(window.captureSidebar());
                }
                for(let index=0;index<3;index++)shortcutTest.render();
            });
            const frames = await page.evaluate(() => window.sidebarFrames);
            assert.ok(frames.length >= 8, device.name + ': capture mount, painted frames and repeated renders');
            for (const frame of frames) {
                assert.equal(frame.mode, device.expanded ? 'full' : 'hidden', device.name);
                assert.equal(frame.opacity, device.expanded ? 1 : 0,
                    device.name + ': the first frame must already have the intended visibility: ' + JSON.stringify(frame));
                assert.deepEqual(frame.animations, [], device.name + ': mounting must not start a closing animation');
                if (!device.expanded) {
                    assert.ok(frame.right <= frame.left + 1, device.name + ': the hidden sidebar stays outside the content');
                    assert.equal(frame.stageLeft, frame.left, device.name + ': startup does not shift the task content');
                }
            }
            if (!device.expanded) {
                await page.locator('.tm-shortcut-edge').click();
                const opening = await page.evaluate(() => window.captureSidebar());
                assert.equal(opening.mode, 'drawer', device.name + ': the edge button still opens the sidebar');
                assert.ok(opening.animations.includes('transform'), device.name + ': intentional opening keeps its slide transition');
                await page.waitForFunction(() => document.querySelector('.tm-shortcut-layout').dataset.shortcutMode === 'drawer'
                    && Number(getComputedStyle(document.querySelector('.tm-shortcut-sidebar')).opacity) === 1);
                await page.mouse.click(device.width - 12, 200);
                await page.waitForFunction(() => document.querySelector('.tm-shortcut-layout').dataset.shortcutMode === 'hidden'
                    && Number(getComputedStyle(document.querySelector('.tm-shortcut-sidebar')).opacity) === 0);
                await page.evaluate(() => shortcutTest.seed());
                await page.locator('.tm-shortcut-edge').click();
                await page.evaluate(() => Promise.all(document.querySelector('.tm-shortcut-sidebar').getAnimations().map(animation => animation.finished)));
                const closing = await page.evaluate(async () => {
                    const sidebar = document.querySelector('.tm-shortcut-sidebar');
                    const navigation = shortcutTest.shortcuts.open('today');
                    const mode = sidebar.parentElement.dataset.shortcutMode;
                    const slide = sidebar.getAnimations().find(animation => animation.transitionProperty === 'transform');
                    const outcome = slide?.finished.then(() => 'finished', () => 'cancelled');
                    const opened = await navigation;
                    return { mode, opened, animation: await outcome };
                });
                assert.equal(closing.mode, 'hidden', device.name + ': shortcut clicks close the drawer immediately');
                assert.equal(closing.opened, true, device.name + ': shortcut navigation succeeds');
                assert.equal(closing.animation, 'finished', device.name + ': rendering must not cancel the closing slide');
            }
            assert.deepEqual(errors, [], device.name);
            await page.close();
        }
        console.log('Shortcut first paint: mobile, tablet, narrow desktop, saved modes, repeated renders and drawer interaction passed.');
    } finally {
        await browser?.close();
        await new Promise(resolve => server.close(resolve));
    }
}

run().catch(error => { console.error(error); process.exitCode = 1; });
