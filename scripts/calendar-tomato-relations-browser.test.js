'use strict';
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const { chromium } = require('./i18n-browser-fixture');
const { fixture } = require('./calendar-tomato-rail-hosts-browser.test');

async function check(browser, kind) {
    const { page, errors } = await fixture(browser, kind);
    try {
        await page.evaluate(kind => {
            if (window.releaseHistory) releaseHistory();
            const owner = kind === 'side' ? __railHosts.state.sideDay.calendar : __railHosts.state.calendar;
            if (kind === 'main') owner.changeView('timeGrid3Day', new Date('2026-11-16T00:00:00'));
            const add = (id, source, task, day, start, end, mode) => owner.addEvent({
                id, title:id, start:new Date(`2026-11-${day}T${start}:00`), end:new Date(`2026-11-${day}T${end}:00`), backgroundColor:'#3576aa',
                extendedProps: { __tmSource:source, __tmScheduleId: source === 'schedule' ? id : '',
                    ...(source === 'tomato' ? {taskBlockId:task, mode, __tmDayPanelOnly:kind === 'month'} : {__tmTaskId:task}) },
            });
            add('plan-a', 'schedule','task-a','16','09:00','09:30');
            add('plan-a-later','schedule','task-a','16','14:00','14:30');
            add('plan-b','schedule','task-b','16','15:00','15:30');
            add('plan-unlinked','schedule','','16','16:00','16:30');
            add('plan-next','schedule','task-a','17','09:00','09:30');
            add('focus-a','tomato','task-a','16','10:00','10:25','countdown');
            add('stopwatch-a','tomato','task-a','16','12:00','12:20','stopwatch');
            add('focus-b','tomato','task-b','16','15:00','15:25','countdown');
            add('break-a','tomato','task-a','16','10:25','10:30','break');
            add('focus-next','tomato','task-a','17','10:00','10:25','countdown');
            if (kind === 'side') __railHosts.state.sideDay.prototypeRender();
            else __railHosts.state.queuePrototypeSurfaceRender();
        }, kind);
        if (kind === 'month') await page.locator('.tm-proto-month-cell[data-tm-proto-day="2026-11-16"] .tm-proto-day-number').first().click();
        const surface = kind === 'side' ? page.locator('[data-tm-side-proto-surface]') : page.locator('[data-tm-cal-surface]');
        const scope = kind === 'month' ? surface.locator('.tm-proto-day-panel[data-tm-proto-panel-date="2026-11-16"]') : surface;
        const plan = scope.locator('[data-tm-proto-event="plan-a"]').first();
        await plan.waitFor();
        const highlightedRecords = () => surface.locator('.tm-proto-tomato-related').evaluateAll(nodes => nodes.filter(node => node.matches('.tm-proto-tomato-rail') || node.getAttribute('data-tm-proto-event')?.startsWith('focus-') || node.getAttribute('data-tm-proto-event')?.startsWith('stopwatch-')).map(node => node.getAttribute('data-tm-proto-event')).sort());
        await plan.hover();
        assert.deepEqual(await highlightedRecords(), ['focus-a','stopwatch-a'], `${kind}: hover matches task/date, excludes rest and other days, ignores time overlap`);
        assert.equal(await page.locator('.tm-proto-event-popover').count(), 0, 'schedule hover only highlights, without opening another popup');
        await page.mouse.move(20, 20);
        assert.deepEqual(await highlightedRecords(), [], 'leaving unselected schedule clears the indicator');
        if (kind === 'month') {
            await surface.locator('.tm-proto-month-cell[data-tm-proto-day="2026-11-16"] [data-tm-proto-event="plan-a"]').first().hover();
            assert.deepEqual(await highlightedRecords(), ['focus-a','stopwatch-a'], 'month grid schedule can indicate records in its open day panel');
        }
        await scope.locator('[data-tm-proto-event="plan-unlinked"]').first().hover();
        assert.deepEqual(await highlightedRecords(), [], 'unlinked schedule has no inferred relation');
        await plan.click();
        await page.mouse.move(20,20);
        assert.deepEqual(await highlightedRecords(), ['focus-a','stopwatch-a'], 'selected schedule keeps focus indicators after mouse leaves');
        await page.evaluate(kind => {
            if (kind === 'side') __railHosts.state.sideDay.prototypeRender();
            else __railHosts.state.queuePrototypeSurfaceRender();
        }, kind);
        await page.waitForFunction(() => document.querySelectorAll('.tm-proto-tomato-related.tm-proto-tomato-rail').length === 2);
        await scope.locator('[data-tm-proto-event="plan-b"]').first().hover();
        assert.deepEqual(await highlightedRecords(), ['focus-b'], 'hover temporarily takes precedence over the selected schedule');
        await page.mouse.move(20,20);
        assert.deepEqual(await highlightedRecords(), ['focus-a','stopwatch-a'], 'leaving another schedule restores the selected relation');
        fs.mkdirSync(path.join(__dirname,'../output/playwright'), {recursive:true});
        await page.screenshot({path:path.join(__dirname,`../output/playwright/tomato-relations-${kind}.png`)});
        await page.locator('.tm-proto-event-popover-close').click();
        await page.mouse.move(20, 20);
        assert.deepEqual(await highlightedRecords(), ['focus-a','stopwatch-a'], 'closing the editor preserves the selected schedule relation');
        await scope.locator('.tm-proto-time-col').first().dispatchEvent('pointerdown', {button:0,pointerType:'mouse',pointerId:31,clientX:0,clientY:0});
        await scope.locator('.tm-proto-time-col').first().dispatchEvent('pointercancel', {pointerId:31});
        await page.mouse.move(20,20);
        assert.deepEqual(await highlightedRecords(), [], 'clearing selection removes its related indicators');
        await scope.locator('[data-tm-proto-event="focus-a"]').first().hover();
        await page.locator('.tm-proto-event-popover').waitFor();
        const plans = await surface.locator('.tm-proto-tomato-related').evaluateAll(nodes => nodes.map(node => node.getAttribute('data-tm-proto-event')).sort());
        assert.deepEqual(plans, kind === 'month' ? ['plan-a','plan-a','plan-a-later','plan-a-later'] : ['plan-a','plan-a-later'], 'record-to-schedule highlight still works');
        await page.locator('.tm-proto-event-popover-close').click();
        if (kind === 'main') {
            await page.locator('[data-tm-cal-tomato-style="card"]').click();
            await scope.locator('[data-tm-proto-event="plan-a"]').first().hover();
            assert.deepEqual(await highlightedRecords(), ['focus-a','stopwatch-a'], 'card style shares the same reverse relation');
        }
        assert.deepEqual(errors, []);
        console.log(`${kind}: bidirectional task/date relation, selection and repaint passed`);
    } finally { await page.close(); }
}

(async () => {
    const browser = await chromium.launch({headless:true, ...(process.env.PLAYWRIGHT_EXECUTABLE ? {executablePath:process.env.PLAYWRIGHT_EXECUTABLE} : {})});
    try { for (const kind of ['main','side','month']) await check(browser,kind); }
    finally { await browser.close(); }
})().catch(error => {console.error(error);process.exitCode=1;});
