'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('./i18n-browser-fixture');
const read = file => fs.readFileSync(path.resolve(__dirname, file), 'utf8');
const section = (source, first, last) => {
    const start = source.indexOf(first);
    const end = source.indexOf(last, start + first.length);
    assert.ok(start >= 0 && end > start, first);
    return source.slice(start, end);
};

const main = '../src/task-horizon/main/';
const dialogs = read(main + '30-dialogs-and-ui-foundation.js');
const taskRuntime = [
    section(dialogs, '    function __tmIsWhiteboardTaskDragSource(', '    window.tmRowClick ='),
    section(read(main + '40-render-runtime.js'), '    window.tmKanbanDragStart =', '    window.tmKanbanDragOver ='),
    section(read(main + '20-api-and-runtime-services.js'), '__tmTomatoAssociationChangedHandler = (event)', '__tmTomatoAssociationHandler = __tmTomatoAssociationChangedHandler;'),
].join('\n');
const dockRoot = '../../siyuan-plugin-docktomato/';
const dock = read(dockRoot + 'tomato.js').replace('injectInitTimeout = setTimeout(inject, 1000);', 'injectInitTimeout = null;');
const end = dock.lastIndexOf('})();');
const timerRuntime = dock.slice(0, end) + `
    // Keep the real association, publication and display path, with a fake writer.
    commitTimerState = async (mutate, _reason, { validate }) => {
        validate(syncState);
        if (window.failCommit) throw new Error('Rejected write');
        syncState = mutate(cloneSyncState(syncState));
        window.associationWrites++;
    };
    window.timerTest = {
        setReady: value => { __tomatoTimerReady = value; },
        mount: () => { __tomatoTimerReady = true; createWidget(document.querySelector('.status')); },
        start: () => { isRunning = true; currentSessionId = 'running'; },
        state: () => ({ id: currentTaskBlockId, segmentId: segmentTaskBlockId, sessionId: currentSessionId, running: isRunning }),
    };
` + dock.slice(end);

async function moveTask(page, source, target) {
    const from = await source.boundingBox();
    const to = await target.boundingBox();
    await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
    await page.mouse.down();
    const x = to.x + to.width / 2;
    const y = to.y + to.height / 2;
    await page.mouse.move(x, y, { steps: 12 });
    await page.mouse.move(x, y);
}

(async () => {
    const browser = await chromium.launch({ headless: true });
    try {
        const page = await browser.newPage({ viewport: { width: 1100, height: 800 } });
        page.setDefaultTimeout(5000);
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.route('https://timer.test/**', route => route.fulfill({ contentType: 'text/html', body: `
            <style>
                body{font:14px system-ui;--b3-theme-surface:#fafafa;--b3-theme-on-background:#222;--b3-theme-primary:#3574bd}
                .source,#move-target{min-height:34px;width:170px;margin:10px;padding:10px}
                .status{position:fixed;bottom:0;left:0;right:0}
                #siyuan-tomato-timer{width:max-content}
            </style>
            <div id="tab">
                <div id="native" class="source" draggable="true" ondragstart="tmDragTaskStart(event, 'a')" ondragend="tmDragTaskEnd(event)">Release notes</div>
                <div id="kanban" class="source tm-kanban-card" data-id="b" draggable="true" ondragstart="tmKanbanDragStart(event, 'b')" ondragend="tmKanbanDragEnd(event, 'b')">Review issues</div>
                <div id="unrelated" class="source" draggable="true" ondragstart="event.dataTransfer.setData('text/plain', 'x')">Plain text</div>
            </div>
            <div id="dock">
                <div class="tm-checklist-item source" data-id="c">Draft checklist</div>
                <div class="tm-checklist-item source" data-id="d">Update roadmap</div>
            </div>
            <div id="move-target">Calendar drop target</div>
            <div class="status"></div>` }));
        await page.goto('https://timer.test');
        await page.addScriptTag({ content: read(dockRoot + 'i18n/runtime.js') });
        await page.evaluate(messages => {
            window.__dockTomatoI18n = __dockTomatoI18nRuntime.createI18n(messages, { preference: 'en' });
            window.siyuan = { config: { appearance: { lang: 'en' }, system: { container: 'windows' } } };
            window.fetch = async () => ({ ok: true, text: async () => '', json: async () => ({ code: 0, data: [] }) });
            window.associationWrites = 0;
            window.state = { modal: document.querySelector('#dock'), timerFocusTaskId: '' };
            window.SettingsStore = { data: {} };
            window.__tmViewPolicy = { shouldUseDockPointerTaskDrag: () => true };
            window.API = { getTaskTitlePresentation: (_markdown, title) => ({ text: title }) };
            window.tmCalendarGetTaskDragMeta = id => ({ title: { a: 'Release notes', b: 'Review issues', c: 'Draft checklist', d: 'Update roadmap' }[id] });
            window.__tmBuildTaskDragSelectionIds = id => window.multi ? [id, 'another-task'] : [id];
            window.__tmNormalizeDraggedTaskIds = ids => ids || [];
            window.__tmResolveKanbanEffectiveDragTarget = (id, sourceEl) => ({ taskId: id, cardEl: sourceEl });
            window.__tmSyncTomatoFocusInPlace = id => { state.timerFocusTaskId = id; };
            const noop = () => {};
            for (const name of ['__tmClearKanbanChildDropCandidate', '__tmSetCalendarSideDockDragHidden', '__tmClearDocTabDropTarget',
                '__tmCalendarFloatingDragEnd', '__tmBindKanbanDocumentAutoScroll', '__tmUnbindKanbanDocumentAutoScroll',
                '__tmKanbanClearDragOver']) window[name] = noop;
            for (const name of ['__tmResolveDocHeadingGroupDropElementFromTarget', '__tmResolveQuadrantGroupDropElementFromTarget',
                '__tmResolveTimeGroupDropElementFromTarget', '__tmResolveTaskRowOrDropGapFromTarget']) window[name] = () => null;
            window.__tmIsMultiSelectActive = () => false;
            window.__tmGetFloatingMiniDragMode = () => 'desktop';
            window.__tmCalendar = { finalizeFloatingMiniCalendarTouchDrop: async ({ target }) => {
                if (target?.id !== 'move-target') return false;
                window.calendarPointerDrop = state.draggingTaskId;
                return true;
            } };
            const moveTarget = document.querySelector('#move-target');
            moveTarget.addEventListener('dragover', event => {
                event.preventDefault();
                event.dataTransfer.dropEffect = 'move';
            });
            moveTarget.addEventListener('drop', event => {
                event.preventDefault();
                window.calendarNativeDrop = event.dataTransfer.getData('application/x-tm-task-id');
            });
        }, JSON.parse(read(dockRoot + 'i18n/en.json')));
        await page.addScriptTag({ content: '(function(){const MutationObserver = class { observe() {} disconnect() {} };' + timerRuntime + '})();' });
        await page.addScriptTag({ content: 'var __tmTomatoAssociationChangedHandler;\n' + taskRuntime + '\nwindow.addEventListener("tomato:association-changed", __tmTomatoAssociationChangedHandler);\n__tmBindDockPointerTaskDrag(state.modal);' });
        await page.evaluate(() => timerTest.mount());
        const widget = page.locator('[data-tomato-task-drop]');
        const timer = widget.locator('[data-tomato-role="time"]');
        const native = page.locator('#native');
        const kanban = page.locator('#kanban');
        const dockTask = page.locator('#dock [data-id="c"]');
        const anotherDockTask = page.locator('#dock [data-id="d"]');
        const move = page.locator('#move-target');
        const toast = page.locator('#tomy-mini-toast');
        const linked = id => page.waitForFunction(id => timerTest.state().id === id, id);

        await moveTask(page, native, timer);
        await page.waitForFunction(() => document.querySelector('[data-tomato-task-drop]').dataset.tomatoTaskDrop === 'Drop to link task');
        await page.mouse.up();
        await linked('a');
        assert.equal(await page.evaluate(() => state.timerFocusTaskId), '', 'idle drops do not enter focus mode');
        assert.equal(await widget.getAttribute('data-tomato-task-drop'), '');

        await page.locator('#tomy-task-block-icon').hover();
        await page.locator('#tomy-tooltip-delete-btn').click();
        await linked(null);
        await page.evaluate(() => timerTest.start());
        await kanban.dragTo(timer);
        await linked('b');
        assert.deepEqual(await page.evaluate(() => timerTest.state()), { id: 'b', segmentId: 'b', sessionId: 'running', running: true });
        assert.equal(await page.evaluate(() => state.timerFocusTaskId), 'b', 'the first running association establishes focus');

        await moveTask(page, dockTask, timer);
        await page.waitForFunction(() => document.querySelector('[data-tomato-task-drop]').dataset.tomatoTaskDrop === 'Drop to change linked task');
        await page.mouse.up();
        await linked('c');
        assert.deepEqual(await page.evaluate(() => timerTest.state()), { id: 'c', segmentId: 'c', sessionId: 'running', running: true });
        assert.equal(await page.evaluate(() => state.timerFocusTaskId), 'c');
        await page.waitForFunction(() => !state.draggingTaskId);

        const writesAfterLink = await page.evaluate(() => associationWrites);
        await dockTask.dragTo(timer);
        await page.waitForFunction(() => !state.draggingTaskId);
        assert.equal(await page.evaluate(() => associationWrites), writesAfterLink, 'dropping the current task is a no-op');

        for (const event of ['blur', 'pointercancel', 'Escape']) {
            await anotherDockTask.evaluate(source => {
                source.addEventListener('pointerdown', event => { window.dragPointerId = event.pointerId; }, { once: true });
            });
            await moveTask(page, anotherDockTask, timer);
            await page.waitForFunction(() => document.querySelector('[data-tomato-task-drop]').dataset.tomatoTaskDrop !== '');
            if (event === 'pointercancel') {
                await anotherDockTask.evaluate(source => source.dispatchEvent(new PointerEvent('pointercancel', {
                    bubbles: true, pointerId: window.dragPointerId, pointerType: 'mouse',
                })));
            } else if (event === 'Escape') {
                await page.keyboard.press('Escape');
            } else {
                await page.evaluate(() => window.dispatchEvent(new Event('blur')));
            }
            await page.mouse.up();
            assert.equal(await widget.getAttribute('data-tomato-task-drop'), '', `${event} clears the preview`);
            assert.equal(await page.evaluate(() => associationWrites), writesAfterLink, `${event} must not commit a drop`);
        }

        await page.evaluate(() => timerTest.setReady(false));
        await native.dragTo(timer);
        await toast.filter({ hasText: /being restored/i }).waitFor();
        assert.equal(await page.evaluate(() => associationWrites), writesAfterLink);
        await page.evaluate(() => timerTest.setReady(true));

        await page.evaluate(() => { window.multi = true; });
        await kanban.dragTo(timer);
        await toast.filter({ hasText: 'Link one task at a time' }).waitFor();
        assert.equal(await page.evaluate(() => associationWrites), writesAfterLink);
        await page.evaluate(() => { window.multi = false; window.failCommit = true; });
        await native.dragTo(timer);
        await toast.filter({ hasText: 'Task link was not saved' }).waitFor();
        assert.equal(await page.evaluate(() => state.timerFocusTaskId), 'c');
        assert.equal(await page.evaluate(() => timerTest.state().id), 'c');
        await page.evaluate(() => { window.failCommit = false; });

        await moveTask(page, native, timer);
        await page.waitForFunction(() => document.querySelector('[data-tomato-task-drop]').dataset.tomatoTaskDrop !== '');
        await page.keyboard.press('Escape');
        await page.mouse.up();
        assert.equal(await widget.getAttribute('data-tomato-task-drop'), '', 'native Escape clears the preview');
        assert.equal(await page.evaluate(() => associationWrites), writesAfterLink);

        await page.locator('#unrelated').dragTo(timer);
        await native.dragTo(move);
        await page.waitForFunction(() => window.calendarNativeDrop === 'a');
        await moveTask(page, dockTask, move);
        await page.mouse.up();
        await page.waitForFunction(() => window.calendarPointerDrop === 'c');
        assert.equal(await page.evaluate(() => associationWrites), writesAfterLink);
        assert.deepEqual(errors, []);
        console.log('Native list and kanban drops, Dock pointer drops, timer focus, rejection and existing move drops passed');
    } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
