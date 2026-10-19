'use strict';

// Run with PLAYWRIGHT_MODULE pointing to playwright when not installed locally.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '..');
const runtime = fs.readFileSync(path.join(root, 'src/task-horizon/main/20-api-and-runtime-services.js'), 'utf8').replace(/\r\n/g, '\n');
const render = fs.readFileSync(path.join(root, 'src/task-horizon/main/40-render-runtime.js'), 'utf8').replace(/\r\n/g, '\n');
function between(source, start, end) {
    const from = source.indexOf(start), to = source.indexOf(end, from + start.length);
    assert.ok(from >= 0 && to > from, start);
    return source.slice(from, to);
}
const helpers = between(runtime, '    function __tmClearKeepaliveSnapshots(', '    // ===== 全局清理句柄');
const laneCleanup = between(render, '    function __tmCleanupKanbanLaneAppearance(', '    function __tmPaintKanbanLaneBackground(');
const renderPreparation = between(render, '    function __tmRenderNow(renderCleanup = {}) {', "        const kind0 = String(state.uiAnimKind").replace('    function __tmRenderNow(renderCleanup = {}) {', '');
const cleanupStart = render.lastIndexOf('        if (prevModalSnapshot) {', render.indexOf('globalThis.__tmCleanupTitleWrapObservers'));
assert.ok(cleanupStart >= 0);
const handoff = render.slice(cleanupStart, render.indexOf('        // 应用字体大小', cleanupStart));
const views = ['timeGridDay', 'timeGrid3Day', 'timeGridWorkdays', 'timeGridWeek', 'dayGridWeek', 'dayGridMonth', 'listMonth'];

async function run() {
    const browser = await chromium.launch({ headless: true });
    try {
        const page = await browser.newPage();
        await page.route('**/*', route => route.abort());
        await page.setContent('<main id="old"></main><main id="active"></main>');
        await page.addScriptTag({ content: helpers + laneCleanup + `
            window.__tmIsTomatoFocusModeEnabled = () => true;
            window.handoff = function(kind, softSwap) {
                ${renderPreparation}
                const prevMountRoot = document.querySelector('#old');
                const nextMountRoot = document.querySelector('#active');
                const prevModalSnapshot = prevMountRoot.firstElementChild;
                const keepMountSnapshot = true, snapshotKind = kind, useSoftSwap = softSwap, useOverlaySoftSwap = false;
                let prevModalEl = prevModalSnapshot, preservedCalendarSideDockTransfer = null;
                ${handoff}
            };
        ` });
        for (const view of views) {
            for (const { kind, softSwap } of ['tab', 'dock'].flatMap(kind => [false, true].map(softSwap => ({ kind, softSwap })))) {
                const result = await page.evaluate(({ view, kind, softSwap }) => {
                    const old = document.querySelector('#old'), active = document.querySelector('#active');
                    old.style.cssText = active.style.cssText = 'display:inline-block;width:600px;height:360px;vertical-align:top';
                    old.innerHTML = `<div class="tm-modal"><div class="tm-box"><div class="tm-body">
                        <div id="tmCalendarRoot" class="tm-calendar-root tm-calendar-root--month-fit" style="--tm-calendar-month-fit-row-height:100px">
                        <button onclick="window.inlineClicks++">Next day</button><header>September 2026</header>
                        <div class="scroller ${view === 'listMonth' ? 'tm-proto-list' : 'tm-proto-time-scroll'}" ${view === 'dayGridMonth' ? 'data-tm-proto-month-scroll' : ''}
                            style="overflow:auto;width:560px;height:220px;scroll-behavior:auto">
                            <div style="height:1200px;width:900px"></div><div class="visible-row" style="height:60px;width:900px">September tasks</div>
                            <div style="height:500px;width:900px"></div></div></div>
                        <aside class="tm-calendar-side-dock"><div style="overflow:auto;height:50px"><div style="height:500px">Side tasks</div></div></aside>
                        </div></div></div>`;
                    const scroller = old.querySelector('.scroller');
                    scroller.scrollTop = 1200;
                    scroller.scrollLeft = 140;
                    old.querySelector('aside > div').scrollTop = 80;
                    window.inlineClicks = 0; window.mounts = 0;
                    window.state = { __tmPreserveShellDuringViewSwitchRender: softSwap };
                    window.__taskHorizonMount = root => { if (root === old) window.mounts++; };
                    window.__tmDisposeDocTabsRuntime = () => {};
                    window.__tmPrepareCalendarSideDockFullRenderTransfer = modal => {
                        modal.querySelector('aside').replaceChildren();
                        return null;
                    };
                    window.__tmCalendar = { unmount() {
                        const calendarRoot = old.querySelector('#tmCalendarRoot');
                        calendarRoot.classList.remove('tm-calendar-root--month-fit');
                        calendarRoot.style.removeProperty('--tm-calendar-month-fit-row-height');
                        // Production teardown restores serialized HTML, which
                        // resets scroller positions even when markup survives.
                        calendarRoot.innerHTML = calendarRoot.innerHTML;
                    } };
                    window.handoff(kind, softSwap);
                    const snapshot = old.querySelector('[data-task-horizon-dock-snapshot]');
                    const frozenScroll = snapshot.querySelector('.scroller');
                    const beforeHtml = snapshot.innerHTML;
                    // The newly active host navigates to another date.
                    active.innerHTML = '<header>October 1</header><div>October tasks</div>';
                    const viewport = frozenScroll.getBoundingClientRect();
                    const row = snapshot.querySelector('.visible-row').getBoundingClientRect();
                    const output = {
                        top: frozenScroll.scrollTop, left: frozenScroll.scrollLeft,
                        visible: row.bottom > viewport.top && row.top < viewport.bottom,
                        layout: snapshot.querySelector('.tm-calendar-root').classList.contains('tm-calendar-root--month-fit'),
                        rowHeight: snapshot.querySelector('.tm-calendar-root').style.getPropertyValue('--tm-calendar-month-fit-row-height'),
                        sideTop: snapshot.querySelector('aside > div')?.scrollTop,
                        stable: snapshot.innerHTML === beforeHtml,
                        duplicateIds: snapshot.querySelectorAll('[id]').length,
                    };
                    snapshot.querySelector('button').click();
                    return { ...output, mounts: window.mounts, inlineClicks: window.inlineClicks, removed: !snapshot.isConnected };
                }, { view, kind, softSwap });
                assert.deepEqual(result, { top: 1200, left: 140, visible: true, layout: true, rowHeight: '100px',
                    sideTop: 80, stable: true, duplicateIds: 0, mounts: 1, inlineClicks: 0, removed: true }, `${view} -> frozen ${kind}, softSwap=${softSwap}`);
            }
        }
        console.log('calendar host snapshots: all 7 views retain layout, scroll and click-to-restore in both hosts');
        for (const kind of ['tab', 'dock']) {
            for (const softSwap of [false, true]) {
                const result = await page.evaluate(({kind, softSwap}) => {
                    const old = document.querySelector('#old'), active = document.querySelector('#active');
                    old.innerHTML = `<div class="tm-modal"><div class="tm-box"><div class="tm-body tm-body--kanban" data-kanban-appearance="lanes" style="width:560px;height:280px;overflow:auto">
                        <div class="tm-kanban" style="position:relative;width:900px;height:700px">
                            <div class="tm-kanban-lane-background" style="position:absolute;inset:0;pointer-events:none"><canvas id="live-lane-background" width="900" height="700"></canvas></div>
                            <button style="position:relative" onclick="window.inlineClicks++">演示任务</button>
                        </div></div></div></div>`;
                    const source = old.firstElementChild;
                    const layer = source.querySelector('.tm-kanban-lane-background');
                    const canvas = layer.querySelector('canvas');
                    const paint = canvas.getContext('2d');
                    const gradient = paint.createLinearGradient(0, 0, 900, 0);
                    gradient.addColorStop(0, '#dbefdf'); gradient.addColorStop(.5, '#e5dcef'); gradient.addColorStop(1, '#f0e6db');
                    paint.fillStyle = gradient; paint.fillRect(0, 0, 900, 700);
                    const sourcePixels = canvas.toDataURL();
                    const scroller = source.querySelector('.tm-body');
                    scroller.scrollLeft = 180; scroller.scrollTop = 75;
                    window.disconnections = 0; window.inlineClicks = 0; window.mounts = 0;
                    window.state = {modal:source,viewMode:'kanban',__tmPreserveShellDuringViewSwitchRender:softSwap,
                        __tmKanbanLaneAppearance:{layer,frame:0,progressFrame:0,
                            resize:{disconnect(){window.disconnections++;}},mutations:{disconnect(){window.disconnections++;}},
                            unsubscribe(){window.disconnections++;}}};
                    window.__tmPrepareCalendarSideDockFullRenderTransfer = () => null;
                    window.__taskHorizonMount = root => {if(root===old)window.mounts++;};
                    handoff(kind, softSwap);
                    const snapshot = old.querySelector('[data-task-horizon-dock-snapshot]');
                    const copiedCanvas = snapshot?.querySelector('.tm-kanban-lane-background canvas');
                    const initialPixels = copiedCanvas?.toDataURL();
                    active.innerHTML = '<div>实时 Dock 看板</div>';
                    paint.clearRect(0, 0, canvas.width, canvas.height);
                    const output = {samePixels:initialPixels===sourcePixels,independent:copiedCanvas!==canvas,
                        stable:copiedCanvas?.toDataURL()===initialPixels,top:snapshot.querySelector('.tm-body').scrollTop,
                        left:snapshot.querySelector('.tm-body').scrollLeft,disconnections:window.disconnections,
                        sessionCleared:state.__tmKanbanLaneAppearance===null,sourceRemoved:!source.isConnected,
                        duplicateIds:snapshot.querySelectorAll('[id]').length};
                    snapshot.querySelector('button').click();
                    return {...output,mounts:window.mounts,inlineClicks:window.inlineClicks,removed:!snapshot.isConnected};
                }, {kind, softSwap});
                assert.deepEqual(result, {samePixels:true,independent:true,stable:true,top:75,left:180,
                    disconnections:3,sessionCleared:true,sourceRemoved:true,duplicateIds:0,mounts:1,inlineClicks:0,removed:true},
                    `kanban background survives frozen ${kind}, softSwap=${softSwap}`);
            }
        }
        console.log('kanban host snapshots: canvas pixels, scroll, cleanup and click-to-restore retained in both hosts');
    } finally { await browser.close(); }
}
run().catch(error => { console.error(error); process.exitCode = 1; });
