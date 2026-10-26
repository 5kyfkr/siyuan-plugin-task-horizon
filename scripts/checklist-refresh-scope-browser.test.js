'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.join(__dirname, '../src/task-horizon/main');
const runtime = fs.readFileSync(path.join(root, '20-api-and-runtime-services.js'), 'utf8');
const removal = fs.readFileSync(path.join(root, 'task-runtime/53b-task-create-and-quick-add-runtime.js'), 'utf8');
const projection = fs.readFileSync(path.join(root, 'task-runtime/51-whiteboard-and-link-runtime.js'), 'utf8');
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
    '__tmGetListRowStableKey', '__tmReconcileKeyedViewRows', '__tmCaptureViewScrollAnchor', '__tmRerenderListInPlace',
];
const code = helperNames.map((name) => extract(runtime, name)).join('\n') + '\n' + extract(removal, '__tmRemoveTaskDomNodes')
    + '\n' + ['__tmCollectChecklistProjectionDomBlock', '__tmSetChecklistProjectionDomBlockVisibility',
        '__tmTryApplyChecklistOptimisticProjectionInPlace', '__tmTryApplyListProjectionBatchInPlace']
        .map((name) => extract(projection, name)).join('\n');

(async () => {
    const browser = await chromium.launch({
        headless: true,
        ...(process.env.PLAYWRIGHT_EXECUTABLE ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE } : {}),
    });
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
        for (const compact of [false, true]) {
            for (const action of ['filter', 'move', 'delete']) {
                const result = await page.evaluate(({ compact, action }) => {
                    const row = (id) => `<div class="tm-checklist-item" data-id="${id}" data-depth="0">${id}</div>`;
                    const group = (key, ids) => {
                        const header = `<div class="tm-checklist-group" data-group-key="${key}">${key}<span class="tm-badge--count">${ids.length}</span></div>`;
                        return compact ? `<section class="tm-checklist-group-card">${header}<div class="tm-checklist-group-card-items">${ids.map(row).join('')}</div></section>`
                            : header + ids.map(row).join('');
                    };
                    const bodyHtml = (fresh) => `<div class="tm-body tm-body--checklist"><div class="tm-checklist-pane${compact ? ' tm-checklist-pane--compact' : ''}"><div class="tm-checklist-items">${
                        (fresh ? '' : group('source', ['last'])) + group('destination', fresh && action === 'move' ? ['last', 'kept'] : ['kept'])}</div></div></div>`;
                    state.modal.innerHTML = bodyHtml(false);
                    state.viewMode = 'checklist';
                    const body = state.modal.firstElementChild;
                    const kept = body.querySelector('[data-id="kept"]');
                    const header = body.querySelector('[data-group-key="destination"]');
                    const rows = [{ type: 'group', key: 'destination', kind: 'task', count: action === 'move' ? 2 : 1 },
                        ...(action === 'move' ? [{ type: 'task', id: 'last', depth: 0 }] : []), { type: 'task', id: 'kept', depth: 0 }];
                    window.__tmBuildTaskRowModel = () => rows;
                    if (action === 'delete') __tmRemoveTaskDomNodes('last');
                    const fast = __tmTryApplyChecklistOptimisticProjectionInPlace('last', {}, { filtersApplied: true });
                    let ok = fast;
                    if (!fast) {
                        const template = document.createElement('template'); template.innerHTML = bodyHtml(true);
                        ok = __tmTryRefreshChecklistProjectionGroups(state.modal, body, template.content.firstElementChild, ['last']);
                    }
                    return { ok, sourceGone: !body.querySelector('[data-group-key="source"]'),
                        kept: kept === body.querySelector('[data-id="kept"]'), header: header === body.querySelector('[data-group-key="destination"]'),
                        count: body.querySelector('[data-group-key="destination"] .tm-badge--count').textContent,
                        ids: Array.from(body.querySelectorAll('.tm-checklist-item')).filter((node) => !node.hidden).map((node) => node.dataset.id) };
                }, { compact, action });
                assert.equal(result.ok, true, JSON.stringify({ compact, action, result }));
                assert.equal(result.sourceGone, true, 'the last task must not leave an empty group header or compact card');
                assert.equal(result.kept, true);
                if (action === 'filter') assert.equal(result.header, true);
                assert.equal(result.count, action === 'move' ? '2' : '1');
                assert.deepEqual(result.ids, action === 'move' ? ['last', 'kept'] : ['kept']);
            }
        }
        for (const compact of [false, true]) {
            const result = await page.evaluate((compact) => {
                state.viewMode = 'checklist';
                const rows = '<div class="tm-checklist-group" data-group-key="visible">Group</div><div class="tm-checklist-item" data-id="kept">Kept</div>';
                state.modal.innerHTML = '<div class="tm-body tm-body--checklist"><div class="tm-checklist-items">'
                    + (compact ? '<section class="tm-checklist-group-card">' + rows + '</section>' : rows) + '</div></div>';
                const body = state.modal.firstElementChild;
                const kept = body.querySelector('[data-id="kept"]');
                const next = body.cloneNode(true);
                const ok = __tmTryRefreshChecklistProjectionGroups(state.modal, body, next, ['hidden-completed'], { renderSignature: 'same-rows' });
                next.querySelector('[data-id="kept"]').textContent = 'Changed';
                const changed = __tmTryRefreshChecklistProjectionGroups(state.modal, body, next, ['hidden-completed']);
                return { ok, changed, kept: kept === body.querySelector('[data-id="kept"]'), text: kept.textContent };
            }, compact);
            assert.deepEqual(result, { ok: true, changed: false, kept: true, text: 'Kept' }, 'excluded-task refresh must retain identical checklist items while real changes still reconcile');
        }
        const table = await page.evaluate(() => {
            state.viewMode = 'list';
            state.modal.innerHTML = '<table id="tmTaskTable"><tbody><tr data-group-key="source"></tr><tr data-id="last"></tr><tr data-group-key="destination"></tr><tr data-id="kept"></tr></tbody></table>';
            window.SettingsStore = { data: {} };
            const before = state.modal.innerHTML;
            const kept = state.modal.querySelector('[data-id="kept"]');
            const destination = state.modal.querySelector('[data-group-key="destination"]');
            window.__tmBuildTaskRowModel = () => [{ type: 'group', key: 'destination', count: 1 }, { type: 'task', id: 'kept' }];
            const fast = __tmTryApplyListProjectionBatchInPlace(['last']);
            const unchanged = before === state.modal.innerHTML;
            window.renderTaskList = () => '<tr data-group-key="destination"></tr><tr data-id="kept"></tr>';
            const ok = __tmRerenderListInPlace(state.modal, { taskIds: ['last'] });
            return { fast, unchanged, ok, sourceGone: !state.modal.querySelector('[data-group-key="source"]'),
                kept: kept === state.modal.querySelector('[data-id="kept"]'), destination: destination === state.modal.querySelector('[data-group-key="destination"]') };
        });
        assert.deepEqual(table, { fast: false, unchanged: true, ok: true, sourceGone: true, kept: true, destination: true },
            'table rows already defer disappearing tasks and groups to their renderer');
        const headingBoundary = await page.evaluate(() => {
            state.viewMode = 'checklist';
            const item = (id, content) => `<div class="tm-checklist-item" data-id="${id}" data-depth="0">${content}</div>`;
            const heading = (key, label) => `<div class="tm-checklist-group" data-group-key="${key}" data-group-kind="h2">${label}</div>`;
            state.modal.innerHTML = `<div class="tm-body tm-body--checklist"><div class="tm-checklist-pane tm-checklist-pane--compact"><div class="tm-checklist-items"><section class="tm-checklist-group-card">`
                + `<div class="tm-checklist-group-card-items">`
                + heading('chest', '胸肌训练')
                + item('chest-task', '宽距俯卧撑')
                + heading('core', '腹肌训练')
                + item('core-one', '长杆平板撑')
                + item('core-two', '空体卷腹')
                + heading('daily', '每天健康打卡')
                + item('daily-task', '蹲墙功')
                + `</div></section></div></div></div>`;
            window.__tmBuildTaskRowModel = () => [
                { type: 'group', key: 'chest', kind: 'h2', count: 1 },
                { type: 'task', id: 'chest-task', depth: 0 },
                { type: 'group', key: 'core', kind: 'h2', count: 2 },
                { type: 'task', id: 'core-one', depth: 0 },
                { type: 'task', id: 'core-two', depth: 0 },
                { type: 'group', key: 'daily', kind: 'h2', count: 1 },
                { type: 'task', id: 'daily-task', depth: 0 },
            ];
            const ok = __tmTryApplyChecklistOptimisticProjectionInPlace('chest-task', { repeatRule: {} }, { filtersApplied: true });
            const container = state.modal.querySelector('.tm-checklist-group-card-items');
            return {
                ok,
                order: Array.from(container.children).map((node) => node.getAttribute('data-id') || node.getAttribute('data-group-key')),
                coreSameContainer: state.modal.querySelector('[data-group-key="core"]').parentElement === container,
            };
        });
        assert.deepEqual(headingBoundary, {
            ok: true,
            order: ['chest', 'chest-task', 'core', 'core-one', 'core-two', 'daily', 'daily-task'],
            coreSameContainer: true,
        }, 'a last task in a compact heading group must stay before the next heading');
        assert.deepEqual(errors, []);
        console.log('checklist refresh scope browser regressions: 14 passed, 0 failed');
    } finally { await browser.close(); }
})().catch((error) => { console.error(error); process.exitCode = 1; });
