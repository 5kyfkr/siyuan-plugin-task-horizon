'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.join(__dirname, '../src/task-horizon/main');
const runtime = fs.readFileSync(path.join(root, '20-api-and-runtime-services.js'), 'utf8');
const removal = fs.readFileSync(path.join(root, 'task-runtime/53b-task-create-and-quick-add-runtime.js'), 'utf8');
function extract(source, name) {
    const start = source.indexOf('    function ' + name + '(');
    const end = source.indexOf('\n    }', start) + '\n    }'.length;
    assert.ok(start >= 0 && end > start, name);
    return source.slice(start, end);
}
const helperNames = [
    '__tmGetChecklistGroupKeyFromCard', '__tmFindChecklistCardByTask', '__tmBuildChecklistCardMap',
    '__tmInsertChecklistCardByNextOrder', '__tmIsChecklistGroupHeader', '__tmGetChecklistGroupKeyFromHeader',
    '__tmBuildChecklistSegmentMap', '__tmFindChecklistSegmentKeyByTask', '__tmCloneChecklistSegmentNodes',
    '__tmReplaceChecklistSegment', '__tmRemoveChecklistSegment', '__tmInsertChecklistSegmentByNextOrder',
    '__tmSelectChecklistProjectionNodes', '__tmReconcileChecklistProjectionNodeList',
    '__tmReconcileChecklistProjectionSegment', '__tmTryRefreshChecklistProjectionSegments',
    '__tmReconcileChecklistProjectionCard', '__tmTryRefreshChecklistProjectionGroups',
    '__tmCollectChecklistDocumentRefreshTaskIds',
];
const code = helperNames.map((name) => extract(runtime, name)).join('\n') + '\n' + extract(removal, '__tmRemoveTaskDomNodes');

(async () => {
    const browser = await chromium.launch({ headless: true });
    try {
        const page = await browser.newPage();
        const errors = [];
        page.on('pageerror', (error) => errors.push(error.message));
        await page.setContent('<main id="manager"></main>');
        await page.evaluate(() => {
            window.state = { modal: document.querySelector('#manager'), viewMode: 'checklist', flatTasks: {}, pendingInsertedTasks: {} };
            window.__tmClearChecklistProjectionGroupRefresh = () => {};
            window.__tmBindFloatingTooltipsAfterLocalRerender = () => {};
        });
        await page.addScriptTag({ content: code });
        for (const grouped of [true, false]) {
            for (const documentOnly of [false, true]) {
                const result = await page.evaluate(({ grouped, documentOnly }) => {
                    const row = (id, title = id) => `<div class="tm-checklist-item" data-id="${id}">${title}</div>`;
                    const group = (key, rows) => {
                        const header = `<div class="tm-checklist-group" data-group-key="${key}">${key}: ${rows.length}</div>`;
                        return grouped ? `<section class="tm-checklist-group-card">${header}<div class="tm-checklist-group-card-items">${rows.join('')}</div></section>`
                            : header + rows.join('');
                    };
                    const bodyHtml = (fresh) => `<div class="tm-body tm-body--checklist"><div class="tm-checklist-scroll"><div class="tm-checklist-items">${
                        group('source', fresh ? [row('kept', documentOnly ? 'fresh title' : 'kept')] : [row('deleted'), row('kept')])
                        + group('other', [row('other')])}</div></div></div>`;
                    state.modal.innerHTML = bodyHtml(false);
                    state.flatTasks = { kept: { id: 'kept', root_id: 'doc' }, other: { id: 'other', root_id: 'doc2' } };
                    const body = state.modal.firstElementChild;
                    const other = body.querySelector('[data-id="other"]');
                    const otherHeader = body.querySelector('[data-group-key="other"]');
                    const kept = body.querySelector('[data-id="kept"]');
                    if (!documentOnly) __tmRemoveTaskDomNodes('deleted');
                    const template = document.createElement('template'); template.innerHTML = bodyHtml(true);
                    const nextBody = template.content.firstElementChild;
                    const ids = documentOnly ? __tmCollectChecklistDocumentRefreshTaskIds(body, nextBody, [], ['doc']) : ['deleted'];
                    const ok = __tmTryRefreshChecklistProjectionGroups(state.modal, body, nextBody, ids);
                    return { ok, bodyKept: body === state.modal.firstElementChild,
                        otherKept: other === body.querySelector('[data-id="other"]'),
                        otherHeaderKept: otherHeader === body.querySelector('[data-group-key="other"]'),
                        siblingKept: kept === body.querySelector('[data-id="kept"]'),
                        title: body.querySelector('[data-id="kept"]').textContent,
                        removed: !body.querySelector('[data-id="deleted"]'),
                        count: body.querySelector('[data-group-key="source"]').textContent };
                }, { grouped, documentOnly });
                assert.equal(result.ok, true, JSON.stringify({ grouped, documentOnly, result }));
                assert.equal(result.bodyKept, true); assert.equal(result.otherKept, true);
                assert.equal(result.otherHeaderKept, true); assert.equal(result.removed, true);
                assert.equal(result.count, 'source: 1');
                assert.equal(result.title, documentOnly ? 'fresh title' : 'kept');
                if (!documentOnly) assert.equal(result.siblingKept, true);
            }
        }
        assert.deepEqual(errors, []);
        console.log('checklist refresh scope browser regressions: 4 passed, 0 failed');
    } finally { await browser.close(); }
})().catch((error) => { console.error(error); process.exitCode = 1; });
