'use strict';
// Real date-center renderers and handlers; host storage is covered by the kernel test.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const rootPath = path.resolve(__dirname, '..');
const read = name => fs.readFileSync(path.join(rootPath, 'src/task-horizon/main', name), 'utf8');
const detail = read('task-runtime/52-task-detail-runtime.js');
function section(from, to) {
    const start = detail.indexOf(from), end = detail.indexOf(to, start + from.length);
    assert.ok(start >= 0 && end > start, from);
    return detail.slice(start, end);
}
const production = read('09-task-field-schema.js') + '\n'
    + (() => {
        const icons = read('30-dialogs-and-ui-foundation.js');
        return icons.slice(icons.indexOf('    function __tmNormalizeLucideIconName('), icons.indexOf('    function __tmRenderInlineIcon('));
    })() + '\n'
    + read('task-runtime/50b-parent-date-rollup-runtime.js') + '\n'
    + section('    function __tmTaskDetailTimeHubIcon(', '    function __tmRenderTaskDetailPhosphorIcon(')
    + section('    function __tmShouldDismissTaskTimeHubEditor(', '    function __tmBuildTaskDetailWhiteboardOutlineChipHtml(')
    + section('        const openTaskTimeHubPopover =', "        on(document, 'pointerdown'")
    + (() => {
        const create = read('task-runtime/53b-task-create-and-quick-add-runtime.js');
        return create.slice(create.indexOf('    window.tmQuickAddOpenDatePicker ='), create.indexOf('    window.tmQuickAddOpenPriorityPicker ='));
    })()
    + '\nwindow.openDetailHub = openTaskTimeHubPopover;';

async function setup(page, entry, theme) {
    await page.goto('about:blank');
    await page.setContent('<meta charset="utf-8"><button id="anchor">任务日期</button><main id="detail"></main>');
    await page.addStyleTag({ path: path.join(rootPath, 'task-horizon.css') });
    await page.addStyleTag({ content: `:root{--tm-text-color:${theme === 'dark' ? '#e0e3e8' : '#242834'};--tm-secondary-text:${theme === 'dark' ? '#aeb4bf' : '#687080'};--tm-card-bg:${theme === 'dark' ? '#242830' : '#f8f9fb'};--tm-bg-color:var(--tm-card-bg);--tm-header-bg:${theme === 'dark' ? '#2c313a' : '#eef0f4'};--tm-primary-color:#528aa2;--tm-border-color:${theme === 'dark' ? '#464b55' : '#cfd3da'};--tm-input-bg:var(--tm-card-bg);--tm-input-border:var(--tm-border-color);--popover:var(--tm-card-bg);--radius:8px;--background:var(--tm-card-bg);--foreground:var(--tm-text-color)}body{margin:24px;font:14px system-ui;background:${theme === 'dark' ? '#181c22' : '#edf0f4'};color:var(--tm-text-color)}*{animation:none!important}` });
    await page.evaluate(() => {
        window.esc = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
        window.__tmEscAttr = window.esc;
        window.__tmNormalizeDateOnly = value => value instanceof Date ? `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}` : String(value || '').slice(0, 10);
        window.__tmGetTaskRepeatRule = task => task.repeatRule || { enabled: false, type: 'none' };
        window.__tmCollectTaskRepeatPreviewDates = () => [];
        window.__tmNormalizeTaskRepeatRule = value => value;
        window.__tmNormalizeTaskRepeatState = value => value || {};
        window.__tmIsCheckinTask = () => false;
        window.__tmBuildLocalNoonDateFromKey = value => new Date(`${value}T12:00:00`);
        window.__tmGetTaskRepeatSummary = () => '';
        window.SettingsStore = { data: {} };
        window.hint = message => { throw new Error(message); };
        window.root = document.querySelector('#detail');
        root.__tmTaskDetailTask = { id: 'parent', root_id: 'doc', content: '父任务', startDate: '2026-10-01', completionTime: '2026-10-31', start_date: '2026-10-01', completion_time: '2026-10-31' };
        window.getBoundTask = () => root.__tmTaskDetailTask;
        window.getBoundTaskId = () => 'parent';
        window.taskId = 'parent';
        window.readHiddenInputValue = field => getBoundTask()[field] || '';
        window.readReminderValue = () => false;
        window.readReminderDisplayValue = () => '';
        window.setHiddenInputValue = (field, value) => { getBoundTask()[field] = value; };
        window.syncMetaChipFaces = window.syncSerializedSnapshot = window.refreshTimeHubScheduleSummary = () => {};
        window.setTaskDetailActivePopover = window.positionInlinePopover = () => {};
        window.activeInlinePopover = window.activeInlinePopoverTrigger = null;
        window.inlinePopoverCommitting = false;
        window.closeInlinePopover = () => { activeInlinePopover?.__tmDateModeUnsubscribe?.(); activeInlinePopover?.remove(); activeInlinePopover = null; };
        window.on = (target, type, handler, options) => target.addEventListener(type, handler, options);
        window.__tmAnimatePopupOutAndRemove = element => element.remove();
        window.__tmReadTaskMutationBaseline = async () => structuredClone(getBoundTask());
        window.__tmUndoState = { applying: false };
        window.undos = []; window.dateWrites = [];
        window.__tmPushUndoRecord = record => undos.push(record);
        window.__tmApplyAttrPatchLocally = (id, patch) => Object.assign(getBoundTask(), patch);
        const listeners = new Set();
        window.__tmTaskMutationBus = { subscribe: listener => { listeners.add(listener); return () => listeners.delete(listener); }, publish: mutation => listeners.forEach(listener => listener(mutation)) };
        window.__tmTaskMutationBus.apply = window.__tmTaskMutationBus.publish;
        window.__tmDispatchTaskAttrPatchUpdated = () => {};
        window.__tmMarkLocalTimeTxSuppressionIds = () => {};
        window.__tmSplitTaskInputLines = value => String(value || '').split('\n').filter(Boolean);
        window.__tmApplyTaskMetaPatchWithUndo = async (id, patch, options) => {
            if (options.showErrorHint !== false) throw new Error('模式切换失败应只由日期中心提示一次');
            Object.assign(getBoundTask(), patch);
            if (patch.dateMode === 'rollup') Object.assign(getBoundTask(), { startDate: '2026-10-18', completionTime: '2026-10-25' });
            return { changed: true };
        };
        window.tmUpdateTaskDates = async (id, patch) => {
            dateWrites.push(patch); Object.assign(getBoundTask(), patch);
            __tmTaskMutationBus.publish({ taskId: id, patch });
        };
        window.__tmGetTaskDetailTaskById = () => getBoundTask();
    });
    await page.addScriptTag({ content: production });
    await page.evaluate(entry => {
        const options = { task: getBoundTask(), hideSchedule: true };
        if (entry === 'context') Object.assign(options, { contextDate: true, placement: 'right', source: 'context-menu-completion-time' });
        if (entry.startsWith('draft')) {
            window.state = { quickAdd: { ...getBoundTask(), dateMode: 'manual', relation: entry.split('-')[1] || '' } };
            return tmQuickAddOpenDatePicker(document.querySelector('#anchor'));
        }
        if (entry === 'detail') openDetailHub(document.querySelector('#anchor'), options);
        else return tmOpenTaskTimeHub('parent', document.querySelector('#anchor'), options).then(() => undefined);
    }, entry);
}

async function checkTimelineReceipts(page) {
    await page.goto('about:blank');
    await page.setContent('<main id="modal"><table id="tmTimelineLeftTable"><tbody></tbody></table><div id="header"></div><div id="tmGanttBody" style="width:600px;height:80px;overflow:auto"></div></main>');
    await page.evaluate(() => {
        Object.assign(window, {
            state: { modal: document.querySelector('#modal'), viewMode: 'timeline', flatTasks: {},
                taskTree: [], filteredTasks: [], otherBlocks: [], pendingInsertedTasks: {}, pendingDeletedTasks: {}, doneOverrides: {} },
            SettingsStore: { data: {} }, MetaStore: { set() {} },
            esc: value => String(value || ''), __tmIsDarkMode: () => false, __tmGetDocColorHex: () => '#888888',
            __tmGetTaskCardFieldList: () => [], __tmNormalizeTimelineCardFields: () => ['title'],
            __tmGetStatusOptions: () => [], __tmRenderLucideIcon: () => '', __tmPhosphorBoldSvg: () => '',
            __tmResolveTaskStatusDisplayOption: () => ({ name: 'todo', color: '#888888' }),
            API: { getTaskTitlePresentation: (_markdown, content) => ({ text: content, html: content }) },
            __tmIsTaskDoneEffective: task => !!task?.done, __tmGetAllTaskLinks: () => [],
            __tmIsTaskLinkEndpointSubtask: () => false, __tmBuildTooltipAttrs: () => '',
            __tmRuntimeEvents: { on: (target, event, fn, options) => target.addEventListener(event, fn, options),
                off: (target, event, fn, options) => target.removeEventListener(event, fn, options) },
            __tmClamp: (value, min, max) => Math.min(max, Math.max(min, value)),
            __tmFormatTaskDateFieldDisplayValue: (task, field) => task[field] || '未设置',
            __tmSyncTimelineDateColumnWidths() {}, __tmUpdateListTaskTimeInDOM: () => true,
            __tmDoesPatchAffectPriorityScore: () => false, __tmRefreshVisibleTaskDetailForTask: () => false,
            __tmPatchAffectsCalendar: () => false, __tmShouldSuppressChecklistDetailSaveRefresh: () => false,
            __tmIsPluginVisibleNow: () => true, __tmDispatchTaskAttrPatchUpdated() {},
            __tmApplyAttrPatchLocally: (id, patch) => __tmTaskStore.patchLocal(id, patch),
            fullRefreshes: 0,
            __tmScheduleTaskProjectionBatch: () => { fullRefreshes++; },
            __tmScheduleTaskProjectionRefresh: () => { fullRefreshes++; },
            __tmScheduleViewRefresh: () => { fullRefreshes++; },
            __tmAnalyzeTaskProjectionPatch: (_id, patch) => __tmTaskProjectionEngine.analyzePatch(patch, { viewMode: 'timeline', groupMode: 'none' }),
        });
    });
    const view = read('task-runtime/51-whiteboard-and-link-runtime.js');
    const fn = (source, name) => {
        const begin = source.indexOf(`    function ${name}(`), end = source.indexOf('\n    }', begin);
        assert.ok(begin >= 0 && end > begin, name);
        return source.slice(begin, end + 6);
    };
    const gantt = read('shell/82-gantt-runtime.js');
    await page.addScriptTag({ content: read('09-task-field-schema.js') + read('32-runtime-state-and-events.js')
        + read('34-task-projection-engine.js') + read('task-runtime/50b-parent-date-rollup-runtime.js')
        + gantt.slice(0, gantt.indexOf("    if (document.readyState === 'loading')"))
        + fn(read('render/46-render-local-task-time-refresh.js'), '__tmUpdateTimelineTaskInDOM')
        + view.slice(view.indexOf('    const __tmViewControllers = {'), view.indexOf('\n    };', view.indexOf('    const __tmViewControllers = {')) + 7)
        + fn(view, '__tmRefreshTaskFieldsAcrossViews') + fn(view, '__tmApplyTaskProjectionChangeSets')
        + '\n__tmTaskProjectionEngine.setRuntimeHandler(__tmApplyTaskProjectionChangeSets);' });
    await page.evaluate(() => {
        window.__tmTaskBoundary = { getTask: id => __tmTaskStore.getProjected(id) };
        const tasks = Object.fromEntries(['grandparent', 'parent', 'other'].map(id => [id,
            { id, root_id: 'doc', content: id, startDate: '2026-10-01', completionTime: '2026-10-05' }]));
        __tmTaskStore.replaceFlat(tasks, { authoritative: true });
        document.querySelector('tbody').innerHTML = Object.keys(tasks).map(id => `<tr data-id="${id}"><td data-tm-task-time-field="startDate">2026-10-01</td><td data-tm-task-time-field="completionTime">2026-10-05</td></tr>`).join('');
        const body = document.querySelector('#tmGanttBody');
        __TaskHorizonGanttView.render({ bodyEl: body, headerEl: document.querySelector('#header'),
            rowModel: Object.keys(tasks).map(id => ({ type: 'task', id, taskId: id, depth: 0 })),
            viewState: { scale: 'day', paddingDays: 2 }, getTaskById: id => __tmTaskStore.getProjected(id) });
        body.scrollLeft = 100; body.scrollTop = 20;
        window.beforeTimeline = { axis: document.querySelector('#header').firstElementChild,
            inner: body.firstElementChild, rows: [...body.querySelectorAll('.tm-gantt-row[data-id]')],
            otherBar: body.querySelector('[data-id="other"] .tm-gantt-bar'), left: body.scrollLeft, top: body.scrollTop,
            otherWidth: body.querySelector('[data-id="other"] .tm-gantt-bar').style.width,
            otherLeft: body.querySelector('[data-id="other"] .tm-gantt-bar').style.left,
            parentBar: body.querySelector('[data-id="parent"] .tm-gantt-bar'),
            oldWidth: body.querySelector('[data-id="parent"] .tm-gantt-bar').style.width };
    });
    for (const [startDate, completionTime] of [['2026-10-02', '2026-10-12'], ['2026-10-03', ''], ['', '2026-10-09'], ['', '']]) {
        const result = await page.evaluate(async ({ startDate, completionTime }) => {
            __tmApplyDateRollupReceipt({ dateRollupUpdates: ['parent', 'grandparent'].map(taskID => ({ taskID,
                documentID: 'doc', patch: { dateMode: 'rollup', startDate, completionTime } })) });
            await Promise.resolve();
            const body = document.querySelector('#tmGanttBody'), before = beforeTimeline;
            return { fullRefreshes, stable: before.axis === document.querySelector('#header').firstElementChild
                && before.inner === body.firstElementChild && before.rows.every(row => row === body.querySelector(`[data-id="${row.dataset.id}"]`))
                && before.otherBar === body.querySelector('[data-id="other"] .tm-gantt-bar')
                && before.otherWidth === before.otherBar.style.width && before.otherLeft === before.otherBar.style.left,
                scroll: [body.scrollLeft, body.scrollTop], expectedScroll: [before.left, before.top],
                cells: [...document.querySelectorAll('tr[data-id="parent"] td')].map(cell => cell.textContent),
                bars: body.querySelectorAll('.tm-gantt-bar').length,
                resized: !startDate || !completionTime || before.parentBar.style.width !== before.oldWidth,
                sameBar: !startDate && !completionTime || before.parentBar === body.querySelector('[data-id="parent"] .tm-gantt-bar') };
        }, { startDate, completionTime });
        assert.equal(result.fullRefreshes, 0, 'date receipts must not schedule an entire timeline render');
        assert.equal(result.stable && result.resized && result.sameBar, true, `axis, rows, unchanged task and existing parent bars must remain mounted: ${JSON.stringify(result)}`);
        assert.deepEqual(result.scroll, result.expectedScroll);
        assert.deepEqual(result.cells, [startDate || '未设置', completionTime || '未设置']);
        assert.equal(result.bars, startDate || completionTime ? 3 : 1);
    }
    console.log('PASS timeline: multilevel receipt, start-only, due-only and clear preserve rows, bars, axis and scroll');
}

async function run() {
    const browser = await chromium.launch({ headless: true });
    const output = path.join(rootPath, 'output/playwright');
    fs.mkdirSync(output, { recursive: true });
    try {
        const page = await browser.newPage();
        page.setDefaultTimeout(5000);
        const errors = [];
        page.on('pageerror', error => { errors.push(error.message); console.error(error.message); });
        for (const entry of ['standalone', 'detail', 'context']) {
            for (const [theme, width] of [['light', 1280], ['dark', 390], ['light', 320]]) {
                await page.setViewportSize({ width, height: 900 });
                await setup(page, entry, theme);
                const hub = page.locator('.tm-task-time-hub-popover');
                const mode = hub.locator('[data-tm-time-hub-date-mode]');
                const checkFooter = async () => {
                    const reminder = await hub.locator('[data-tm-time-hub-card="reminder"]').boundingBox();
                    const button = await mode.boundingBox();
                    const dates = await hub.locator('fieldset').boundingBox();
                    assert.ok(button.x > reminder.x && Math.abs(button.y - reminder.y) <= 1, 'mode button stays to the right of reminder on the same row');
                    assert.ok(Math.abs(button.height - reminder.height) <= 1 && button.y >= dates.y + dates.height, 'mode reuses the reminder row height below the dates');
                    assert.equal(await mode.evaluate(node => node.tagName), 'BUTTON');
                    assert.equal(await mode.locator('svg').count(), 1, 'mode uses an existing production icon');
                };
                await checkFooter();
                assert.equal(await mode.locator('strong').innerText(), '手动');
                await mode.click();
                await page.waitForFunction(() => getBoundTask().dateMode === 'rollup' && undos.length === 1);
                assert.equal(await mode.locator('strong').innerText(), '子任务');
                assert.equal(await mode.getAttribute('aria-pressed'), 'true');
                assert.match(await mode.getAttribute('title'), /开始取最早，截止取最晚/);
                await checkFooter();
                assert.equal(await hub.locator('fieldset').getAttribute('disabled'), '');
                assert.equal(await hub.locator('[data-tm-time-hub-date]').first().isDisabled(), true);
                assert.equal(await hub.locator('[data-tm-time-hub-clear-date]:visible').count(), 0);
                assert.deepEqual(await page.evaluate(() => undos[0].inversePatch), { dateMode: 'manual', startDate: '2026-10-01', completionTime: '2026-10-31' });
                // A committed child edit must update an already-open center.
                await page.evaluate(() => __tmApplyDateRollupReceipt({ dateRollupUpdates: [{ taskID: 'parent', documentID: 'doc', patch: { dateMode: 'rollup', startDate: '2026-10-19', completionTime: '2026-10-24' } }] }));
                assert.match(await hub.locator('[data-tm-time-hub-date-card="completionTime"]').innerText(), /10.*24/);
                assert.equal(await page.evaluate(() => dateWrites.length), 0);
                assert.equal(await hub.evaluate(node => node.scrollWidth <= node.clientWidth + 1), true, 'date center has no horizontal overflow');
                await hub.screenshot({ path: path.join(output, `parent-date-rollup-${entry}-${theme}-${width}.png`) });
                await page.evaluate(() => __tmApplyDateRollupReceipt({ dateRollupUpdates: [{ taskID: 'parent', documentID: 'doc', patch: { dateMode: 'rollup', startDate: '', completionTime: '2026-10-24' } }] }));
                assert.match(await hub.locator('[data-tm-time-hub-date-card="startDate"]').innerText(), /未设置/, 'an empty rollup clears legacy display aliases');
                await page.evaluate(() => __tmApplyDateRollupReceipt({ dateRollupUpdates: [{ taskID: 'parent', documentID: 'doc', patch: { dateMode: 'rollup', startDate: '2026-10-19', completionTime: '' } }] }));
                assert.match(await hub.locator('[data-tm-time-hub-date-card="startDate"]').innerText(), /10.*19/);
                assert.match(await hub.locator('[data-tm-time-hub-date-card="completionTime"]').innerText(), /未设置/);
                assert.match(await page.evaluate(() => __tmGetTaskDetailTimeHubLabel(getBoundTask())), /开始.*10.*19/, 'start-only tasks display their date in the detail summary');
                await page.evaluate(() => __tmApplyDateRollupReceipt({ dateRollupUpdates: [{ taskID: 'parent', documentID: 'doc', patch: { dateMode: 'rollup', startDate: '', completionTime: '2026-10-24' } }] }));
                await mode.focus();
                await page.keyboard.press('Enter');
                await page.waitForFunction(() => getBoundTask().dateMode === 'manual' && undos.length === 2);
                assert.equal(await hub.locator('fieldset').getAttribute('disabled'), null);
                assert.equal(await mode.locator('strong').innerText(), '手动');
                assert.equal(await mode.getAttribute('aria-pressed'), 'false');
                assert.equal(await page.evaluate(() => getBoundTask().completionTime), '2026-10-24');
                await hub.getByRole('button', { name: '清除截止日期', exact: true }).click();
                await page.waitForFunction(() => getBoundTask().completionTime === '');
                assert.equal(await page.evaluate(() => getBoundTask().dateMode), 'manual', 'clearing dates keeps manual mode');
                assert.equal(await page.evaluate(() => undos.length), 2);
                console.log(`PASS ${entry} ${theme}: explicit switch, live receipt, readonly, undo and manual clear`);
            }
        }
        for (const entry of ['draft', 'draft-subtask', 'draft-sibling']) {
            await setup(page, entry, 'light');
            const mode = page.locator('[data-tm-time-hub-date-mode]');
            assert.equal(await mode.locator('strong').innerText(), '手动');
            await mode.click();
            await page.waitForFunction(() => state.quickAdd.dateMode === 'rollup');
            assert.equal(await mode.locator('strong').innerText(), '子任务');
            assert.equal(await page.evaluate(() => undos.length + dateWrites.length), 0, 'draft mode switches never write an existing task');
            assert.deepEqual(await page.evaluate(() => [state.quickAdd.startDate, state.quickAdd.completionTime]), ['', '']);
            await page.locator('.tm-task-time-hub-popover').screenshot({ path: path.join(output, `parent-date-rollup-${entry}.png`) });
            await page.evaluate(() => __tmCloseStandaloneTaskTimeHub('test', { immediate: true }));
            await page.evaluate(() => tmQuickAddOpenDatePicker(document.querySelector('#anchor')));
            assert.equal(await mode.locator('strong').innerText(), '子任务', 'reopening a new-task date picker preserves mode');
            await mode.click();
            await page.waitForFunction(() => state.quickAdd.dateMode === 'manual');
            assert.equal(await mode.locator('strong').innerText(), '手动');
            console.log(`PASS ${entry}: mode button, local changes and reopening`);
        }
        await checkTimelineReceipts(page);
        assert.deepEqual(errors, [], 'date-center and timeline browser errors');
    } finally { await browser.close(); }
}
run().catch(error => { console.error(error); process.exitCode = 1; });
