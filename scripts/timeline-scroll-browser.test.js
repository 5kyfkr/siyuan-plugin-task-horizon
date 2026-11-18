'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '..');
const services = fs.readFileSync(path.join(root, 'src/task-horizon/main/20-api-and-runtime-services.js'), 'utf8');
const sections = [
    ['__tmShouldUseGlobalTimelineScroll', '__tmSyncTimelineDateColumnWidths'],
    ['__tmBindTimelineStageInteractions', '__tmRerenderTimelineInPlace'],
];
const runtime = sections.map(([from, to]) => {
    const start = services.indexOf(`function ${from}(`);
    const end = services.indexOf(`function ${to}(`, start);
    assert.ok(start >= 0 && end > start);
    return services.slice(start, end);
}).join('\n');
const ids = Array.from({ length: 360 }, (_, i) => `task-${i}`);
const table = `<div class="tm-timeline-left"><div class="tm-timeline-left-body" id="tmTimelineLeftBody">
    <table class="tm-table tm-timeline-table-left" id="tmTimelineLeftTable" style="width:520px">
        <thead><tr><th>Task</th></tr></thead><tbody>${ids.map(id => `<tr class="tm-timeline-row" data-id="${id}"><td>${id}</td></tr>`).join('')}</tbody>
    </table></div></div>`;
const canvas = `<div class="tm-timeline-right"><div class="tm-timeline-right-header"><div id="tmGanttHeader"><div class="tm-gantt-header-inner">Dates</div></div></div>
    <div class="tm-timeline-right-body" id="tmGanttBody" data-tm-gantt-total-width="3600"><div class="tm-gantt-body-inner" style="width:3600px">
        ${ids.map(id => `<div class="tm-gantt-row" data-id="${id}">${id}</div>`).join('')}</div></div></div>`;

async function mount(page, compact) {
    await page.setContent(`<main class="tm-modal ${compact ? 'tm-modal--dock' : ''}" style="position:relative;inset:auto;transform:none;width:1000px;height:450px;display:flex;flex-direction:column;--tm-row-height:32px">
        <div class="tm-body tm-body--timeline ${compact ? 'tm-body--timeline-compact' : ''}">${compact
            ? `<div class="tm-timeline-scroll-host"><div class="tm-timeline-split tm-timeline-split--compact-canvas">${canvas}</div></div><div class="tm-timeline-sidebar-overlay tm-timeline-sidebar-overlay--hidden">${table}</div>`
            : `<div class="tm-timeline-split">${table}<div class="tm-timeline-splitter"></div>${canvas}</div>`}</div></main>`);
    await page.addStyleTag({ path: path.join(root, 'task-horizon.css') });
    await page.addScriptTag({ content: `${runtime}
        const state = { modal: document.querySelector('main') };
        const __tmBindTimelineScrollVisibility = () => {};
        const __tmResetTimelineGestureState = () => {};
        const left = document.querySelector('#tmTimelineLeftBody');
        const right = __tmGetTimelineGlobalScrollHost(state.modal) || document.querySelector('#tmGanttBody');
        const header = document.querySelector('#tmGanttHeader');
        const frames = () => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        const stats = { headerUpdates: 0, hoverScans: 0, rangeShifts: [], desync: [] };
        header.__tmSyncGanttStickyPeriod = () => stats.headerUpdates++;
        window.tmGanttExtendRange = direction => stats.rangeShifts.push(direction);
        const query = state.modal.querySelectorAll.bind(state.modal);
        state.modal.querySelectorAll = selector => {
            if (selector === '.tm-timeline-task-row--hovered') stats.hoverScans++;
            return query(selector);
        };
        __tmBindTimelineStageInteractions(state.modal);
        if (!right.matches('.tm-timeline-scroll-host')) {
            const sampleFrame = () => {
                if (left.scrollTop !== right.scrollTop) stats.desync.push(Math.abs(left.scrollTop - right.scrollTop));
                requestAnimationFrame(sampleFrame);
            };
            requestAnimationFrame(sampleFrame);
        }
    ` });
}

(async () => {
    const browser = await chromium.launch({ headless: true, ignoreDefaultArgs: ['--hide-scrollbars'] });
    try {
        const page = await browser.newPage({ viewport: { width: 1100, height: 550 } });
        await mount(page, false);
        for (const selector of ['#tmGanttBody', '#tmTimelineLeftBody']) {
            const box = await page.locator(selector).boundingBox();
            await page.mouse.move(box.x + 20, box.y + 90);
            const before = await page.evaluate(() => right.scrollTop);
            for (let i = 0; i < 12; i++) await page.mouse.wheel(0, i < 8 ? 30 : -18);
            await page.waitForFunction(top => left.scrollTop === top && right.scrollTop === top, before + 168);
        }
        const desktop = await page.evaluate(async () => {
            await frames();
            return stats;
        });
        console.log('Desktop wheel scroll:', desktop);
        assert.deepEqual(desktop.desync, [], 'the other pane must follow before the browser paints the frame');
        assert.equal(desktop.hoverScans, 0, 'clearing hover must not scan the whole timeline');
        assert.equal(desktop.headerUpdates, 1, 'vertical scrolling must not refresh horizontal headers');
        assert.deepEqual(desktop.rangeShifts, [], 'vertical scrolling at a range edge must not rebuild the date range');
        const horizontal = await page.evaluate(async () => {
            right.scrollLeft = 40;
            await frames();
            return { updates: stats.headerUpdates, transform: header.firstElementChild.style.transform, shifts: stats.rangeShifts };
        });
        assert.deepEqual(horizontal, { updates: 2, transform: 'translateX(-40px)', shifts: [-1] });
        const boundaries = await page.evaluate(async () => {
            left.querySelector('table').style.width = '720px';
            left.scrollLeft = 60;
            const scrollPositions = () => [left.scrollTop, right.scrollTop];
            right.scrollTop = right.scrollHeight;
            await frames();
            const bottom = scrollPositions();
            left.scrollTop = 0;
            await frames();
            return { bottom, top: scrollPositions(), horizontal: [left.scrollLeft, right.scrollLeft], desync: stats.desync };
        });
        assert.ok(boundaries.bottom[0] > 10000);
        assert.equal(boundaries.bottom[0], boundaries.bottom[1]);
        assert.deepEqual(boundaries.top, [0, 0]);
        assert.deepEqual(boundaries.horizontal, [60, 40], 'each pane keeps its own horizontal scroll');
        assert.deepEqual(boundaries.desync, []);
        const checkBottomRows = async (scrollbarHeight) => {
            const theme = await page.addStyleTag({ content: `.tm-modal #tmGanttBody::-webkit-scrollbar { height: ${scrollbarHeight}px; }` });
            const geometry = await page.evaluate(async () => {
                await frames();
                const lastLeft = left.querySelector('tbody').lastElementChild;
                const lastRight = right.querySelector('.tm-gantt-row:last-child');
                const rowBottom = row => row.getBoundingClientRect().bottom;
                const results = [];
                for (const pane of [right, left]) {
                    pane.scrollTop = 0;
                    await frames();
                    pane.scrollTop = pane.scrollHeight;
                    await frames();
                    results.push({
                        rowDifference: rowBottom(lastLeft) - rowBottom(lastRight),
                        remaining: [left, right].map(el => el.scrollHeight - el.clientHeight - el.scrollTop),
                    });
                }
                return { gutter: right.offsetHeight - right.clientHeight, results };
            });
            assert.equal(geometry.gutter, scrollbarHeight, 'the test must exercise the actual horizontal scrollbar gutter');
            for (const result of geometry.results) {
                assert.equal(result.rowDifference, 0, 'the last task and timeline grid row must align at the bottom');
                assert.deepEqual(result.remaining, [0, 0]);
            }
            await theme.evaluate(element => element.remove());
            await page.evaluate(() => frames());
        };
        await checkBottomRows(14);
        await checkBottomRows(0);
        const clamped = await page.evaluate(async () => {
            // A shorter left scroll range must not pull the right pane back.
            left.querySelector('tbody').lastElementChild.remove();
            right.scrollTop = right.scrollHeight;
            await frames();
            return [left, right].map(pane => pane.scrollHeight - pane.clientHeight - pane.scrollTop);
        });
        assert.deepEqual(clamped, [0, 0]);
        await page.close();

        const compact = await browser.newPage();
        await mount(compact, true);
        const restored = await compact.evaluate(async () => {
            right.scrollTop = 130;
            await frames();
            const overlay = left.closest('.tm-timeline-sidebar-overlay');
            overlay.classList.remove('tm-timeline-sidebar-overlay--hidden');
            __tmBindTimelineStageInteractions(state.modal);
            await frames();
            const fromCanvas = left.scrollTop;
            left.scrollTop = 275;
            await frames();
            return [fromCanvas, right.scrollTop, stats.headerUpdates];
        });
        assert.deepEqual(restored, [130, 275, 2], 'compact overlay and canvas must preserve bidirectional scroll');
        console.log('timeline scroll browser tests passed');
    } finally {
        await browser.close();
    }
})().catch(error => { console.error(error); process.exitCode = 1; });
