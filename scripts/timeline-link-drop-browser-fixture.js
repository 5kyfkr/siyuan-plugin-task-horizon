'use strict';

// Isolated regression fixture using the production Gantt renderer, link handlers
// and styles. Run with Playwright CLI; task writes stay in this page's memory.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const interactions = read('src/task-horizon/main/render/49-render-whiteboard-interactions.js');
const start = interactions.indexOf('    function __tmNormalizeTaskLinkSide(');
const end = interactions.indexOf('    window.tmWhiteboardRemoveLink =', start);
assert.ok(start >= 0 && end > start);
const gantt = read('src/task-horizon/main/shell/82-gantt-runtime.js');
const startup = gantt.indexOf("    if (document.readyState === 'loading')");
assert.ok(startup > 0);
const script = `
const state = { viewMode: 'timeline', activeDocId: 'doc', modal: document.querySelector('main') };
const SettingsStore = { data: {}, save: async () => {} };
let manualLinks = [];
const tasks = Object.fromEntries(['a', 'b', 'c'].map((id, index) => [id, {
    id, content: 'Task ' + id.toUpperCase(), root_id: 'doc',
    startDate: '2026-10-' + (12 + index), completionTime: '2026-10-' + (14 + index),
}]));
Object.assign(window, {
    esc: value => String(value || ''),
    __tmIsDarkMode: () => false, __tmGetDocColorHex: () => '#888888',
    __tmGetTaskCardFieldList: () => [], __tmNormalizeTimelineCardFields: () => ['title'],
    __tmGetStatusOptions: () => [], __tmRenderLucideIcon: () => '', __tmPhosphorBoldSvg: () => '',
    __tmResolveTaskStatusDisplayOption: () => ({ name: 'todo', color: '#888888' }),
    API: { getTaskTitlePresentation: (_markdown, content) => ({ text: content, html: content }) },
    __tmIsTaskDoneEffective: task => !!task?.done,
    __tmIsTaskLinkEndpointSubtask: () => false, __tmBuildTooltipAttrs: () => '',
    __tmGetAllTaskLinks: () => manualLinks.map(link => ({ ...link, manual: true })),
    __tmGetManualTaskLinks: () => manualLinks, __tmSetManualTaskLinks: links => { manualLinks = links; },
    __tmGetTaskDocIdById: id => tasks[id]?.root_id || '',
    __tmScheduleWhiteboardEdgeRedraw() {}, __tmGetWhiteboardGlobalBodyFromElement: () => null,
    __tmIsWhiteboardGlobalCanvasActive: () => false,
    __tmResolveTimelineDependencyScope: () => ({ boardKey: '' }), __tmGetWhiteboardActiveBoardKey: () => 'doc',
    __tmCanLinkTasks: () => ({ ok: true, docId: 'doc' }),
    __tmEnqueueTimelineMutation: operation => Promise.resolve().then(operation),
    __tmPushWhiteboardHistorySnapshot() {}, hint() {}, render() { throw new Error('Unexpected full render'); },
    __tmRuntimeEvents: {
        on: (target, type, listener, options) => target.addEventListener(type, listener, options),
        off: (target, type, listener, options) => target.removeEventListener(type, listener, options),
    },
});
${interactions.slice(start, end)}
${gantt.slice(0, startup)}
const body = document.querySelector('#tmGanttBody');
const rows = Object.keys(tasks).map(id => ({ type: 'task', id, taskId: id, depth: 0 }));
__TaskHorizonGanttView.render({ headerEl: document.querySelector('header'), bodyEl: body,
    rowModel: rows, rangeRowModel: rows, viewState: { scale: 'day', paddingDays: 2 },
    getTaskById: id => tasks[id] });
body.querySelector('.tm-gantt-bar').scrollIntoView({ block: 'nearest', inline: 'center' });
body.querySelector('.tm-gantt-row[data-id="a"]').classList.add('tm-gantt-row--dot-open');
window.timelineLinkTest = {
    state, links: () => manualLinks,
    reset(links = []) {
        __tmClearTaskLinkPointerFallback(); __tmResetLinkDragState();
        manualLinks = links; state.__tmTimelineRenderDeps();
    },
    point(id, side = 'in') {
        const dot = body.querySelector('.tm-gantt-row[data-id="' + id + '"] .tm-task-link-dot--' + side);
        const rect = dot.getBoundingClientRect();
        return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    },
};
`;
const output = path.join(root, 'output/playwright');
fs.mkdirSync(output, { recursive: true });
const file = path.join(output, 'timeline-link-drop.html');
fs.writeFileSync(file, `<!doctype html><html lang="en"><meta charset="utf-8">
<title>Timeline link drop regression</title><link rel="icon" href="data:,">
<link rel="stylesheet" href="../../task-horizon.css?v=${Date.now()}">
<style>
body{margin:24px;font:14px/1.5 system-ui}
main.tm-modal{position:relative;display:block;inset:auto;transform:none;width:100%;height:480px;
    --tm-row-height:48px;--tm-font-size:14px;--tm-primary-color:#307baa;--tm-border-color:#d6dfe3;
    --tm-bg-color:#f8fafb;--tm-header-bg:#eef2f4;--tm-text-color:#29353b;--tm-secondary-text:#64747b}
#tmGanttBody{position:relative;overflow:auto;height:300px}
</style><h1>Timeline link drop regression</h1><main class="tm-modal"><header></header><div id="tmGanttBody"></div></main>
<script>${script.replace(/<\/script/gi, '<\\/script')}</script></html>`);
console.log(file);
