'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '..');
const detail = fs.readFileSync(path.join(root, 'src/task-horizon/main/task-runtime/52-task-detail-runtime.js'), 'utf8');
const start = detail.indexOf('    let __tmKanbanDetailOutsideClickHandler =');
const end = detail.indexOf('    function __tmScheduleKanbanDetailFloatSettledPosition(', start);
assert.ok(start >= 0 && end > start, 'floating detail helpers must remain extractable');
const helpers = detail.slice(start, end);

async function run() {
    const browser = await chromium.launch({ headless: true,
        ...(process.env.PLAYWRIGHT_EXECUTABLE ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE } : {}) });
    try {
        const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
        await page.setContent(`<style>${fs.readFileSync(path.join(root, 'task-horizon.css'), 'utf8')}</style>
            <style>
                body{margin:0;font:14px system-ui;background:#eef1f4}
                #manager{position:absolute;display:block;--card:#f8fafb;--tm-border-color:#ccd5dc;--tm-text-color:#29353b}
                .tm-kanban-card{position:absolute;margin:0;width:220px;height:100px;box-sizing:border-box}
                #tmKanbanDetailPanel{height:680px}
            </style>
            <main id="manager" class="tm-modal tm-modal--tab">
                <article class="tm-kanban-card" data-id="task-1">分屏定位测试</article>
                <aside id="tmKanbanDetailFloat" class="tm-kanban-detail-float">
                    <div id="tmKanbanDetailPanel" class="tm-kanban-detail-float__body">任务详情</div>
                </aside>
            </main>`);
        await page.addScriptTag({ content: `(() => {
            const state = { modal: document.querySelector('#manager'), viewMode: 'kanban',
                kanbanDetailTaskId: 'task-1', kanbanDetailAnchorTaskId: '' };
            const __tmResolveTaskDetailEventElement = node => node instanceof Element ? node : null;
            const __tmIsTaskDetailNoteViewEventTarget = () => false;
            globalThis.__tmRuntimeEvents = {
                on: (target, type, handler, options) => target.addEventListener(type, handler, options),
                off: (target, type, handler, options) => target.removeEventListener(type, handler, options),
            };
            ${helpers}
            const position = __tmPositionKanbanDetailFloat;
            window.positionCalls = 0;
            __tmPositionKanbanDetailFloat = modal => { window.positionCalls++; return position(modal); };
            window.detailTest = {
                position: () => __tmPositionKanbanDetailFloat(state.modal),
                bind: () => __tmBindKanbanDetailFloatingHandlers(state.modal),
                clear: __tmClearKanbanDetailFloatingHandlers,
                setHost({ left, top, width, height, cardLeft, cardTop = 140, transformed = false }) {
                    Object.assign(state.modal.style, { left: left + 'px', top: top + 'px',
                        width: width + 'px', height: height + 'px', transform: transformed ? 'translateZ(0)' : '' });
                    Object.assign(state.modal.querySelector('.tm-kanban-card').style,
                        { left: cardLeft + 'px', top: cardTop + 'px' });
                },
                geometry() {
                    const panel = state.modal.querySelector('#tmKanbanDetailFloat');
                    const rect = panel.getBoundingClientRect();
                    return { host: state.modal.getBoundingClientRect().toJSON(), panel: rect.toJSON(),
                        card: state.modal.querySelector('.tm-kanban-card').getBoundingClientRect().toJSON(),
                        hit: document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2)?.closest('#tmKanbanDetailFloat') === panel };
                },
            };
        })();` });

        const contained = result => {
            const { host, panel } = result;
            assert.ok(panel.left >= host.left + 11 && panel.right <= host.right - 11
                && panel.top >= host.top + 11 && panel.bottom <= host.bottom - 11,
            `detail stays inside its task-manager pane: ${JSON.stringify(result)}`);
            assert.equal(result.hit, true, 'detail is visible and hit-testable inside the pane');
        };
        const cases = [
            { name: 'left split flips left', left: 180, top: 84, width: 900, height: 780, cardLeft: 640, side: 'left' },
            { name: 'right split opens left', left: 820, top: 84, width: 760, height: 780, cardLeft: 500, side: 'left' },
            { name: 'left split has room on right', left: 180, top: 84, width: 900, height: 780, cardLeft: 20, side: 'right' },
            { name: 'full window', left: 0, top: 0, width: 1600, height: 900, cardLeft: 100, side: 'right' },
            { name: 'neither side fits', left: 180, top: 84, width: 560, height: 780, cardLeft: 200 },
            { name: 'narrow split constrains width', left: 180, top: 84, width: 360, height: 780, cardLeft: 120 },
            { name: 'horizontal split constrains height', left: 180, top: 480, width: 1320, height: 360, cardLeft: 700, cardTop: 180 },
            { name: 'transformed pane origin', left: 180, top: 84, width: 900, height: 780, cardLeft: 640, transformed: true, side: 'left' },
        ];
        for (const scenario of cases) {
            await page.evaluate(value => { detailTest.setHost(value); detailTest.position(); }, scenario);
            const result = await page.evaluate(() => detailTest.geometry());
            contained(result);
            if (scenario.side === 'left') assert.ok(result.panel.right <= result.card.left - 11, scenario.name);
            if (scenario.side === 'right') assert.ok(result.panel.left >= result.card.right + 11, scenario.name);
            console.log(`${scenario.name} passed`);
        }

        await page.evaluate(() => {
            detailTest.setHost({ left: 180, top: 84, width: 900, height: 780, cardLeft: 640 });
            detailTest.position(); detailTest.bind();
        });
        await page.waitForTimeout(100);
        const beforeResize = await page.evaluate(() => positionCalls);
        await page.evaluate(() => detailTest.setHost({ left: 180, top: 84, width: 560, height: 780, cardLeft: 300 }));
        await page.waitForFunction(value => positionCalls > value, beforeResize);
        contained(await page.evaluate(() => detailTest.geometry()));
        await page.evaluate(() => detailTest.clear());
        const afterCleanup = await page.evaluate(() => positionCalls);
        await page.evaluate(() => detailTest.setHost({ left: 180, top: 84, width: 800, height: 780, cardLeft: 500 }));
        await page.waitForTimeout(100);
        assert.equal(await page.evaluate(() => positionCalls), afterCleanup, 'closing the detail disconnects its pane resize observer');
        console.log('split resize and observer cleanup passed');
        fs.mkdirSync(path.join(root, 'output/playwright'), { recursive: true });
        await page.evaluate(() => { detailTest.setHost({ left: 180, top: 84, width: 900, height: 780, cardLeft: 640 }); detailTest.position(); });
        await page.screenshot({ path: path.join(root, 'output/playwright/kanban-detail-left-split.png') });
    } finally {
        await browser.close();
    }
}
run().catch(error => { console.error(error); process.exitCode = 1; });
