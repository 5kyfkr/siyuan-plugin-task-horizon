'use strict';
const assert = require('node:assert/strict');
const { chromium } = require('./i18n-browser-fixture');
const { fixture } = require('./calendar-tomato-rail-hosts-browser.test');
(async () => {
    const browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_EXECUTABLE ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE } : {}) });
    try {
        for (const kind of ['side', 'month']) {
            const { page, errors } = await fixture(browser, kind);
            try {
                if (kind === 'month') {
                    await page.locator('.tm-proto-month-cell[data-tm-proto-day="2026-11-16"] .tm-proto-day-number').first().click();
                    await page.evaluate(() => releaseHistory());
                }
                await page.locator('.tm-proto-tomato-rail').first().waitFor();
                if (kind === 'month') {
                    const mounted = await page.evaluate(() => {
                        const side = document.createElement('div'); side.id = 'simultaneous-side';
                        side.style.cssText = 'position:fixed;left:0;top:0;width:240px;height:900px'; document.body.appendChild(side);
                        return __tmCalendar.mountSideDayTimeline(side, { settingsStore: hostStore, date: '2026-11-16', enableExternalDrag: false });
                    });
                    assert.equal(mounted, true);
                    await page.waitForFunction(() => document.querySelectorAll('.tm-proto-tomato-rail').length === 2);
                }
                await page.evaluate(() => {
                    window.originalRow = { ...historyRows[0] };
                    __dockTomato.history.updateTime = async () => true;
                    __dockTomato.history.delete = async key => {
                        historyRows = historyRows.filter(row => row.recordId !== key.recordId);
                        return true; // Older bridge without a notification: local delete must still refresh.
                    };
                });
                await page.locator('.tm-proto-tomato-rail').first().click();
                await page.locator('.tm-proto-popover-edit').click();
                await page.locator('[data-tm-cal-action="delete"]').click();
                await page.waitForFunction(() => document.querySelectorAll('.tm-proto-tomato-rail').length === 0);
                assert.equal(await page.evaluate(() => historyRows.length), 0, kind + ' deletes the backing record');
                await page.evaluate(() => {
                    historyRows = [{ ...originalRow }];
                    __railHosts.state.dockHistoryReadSuppressUntil = Date.now() + 10000;
                    window.dispatchEvent(new CustomEvent('tomato:history-updated', { detail: { source: 'file', mutation: true } }));
                });
                await page.locator('.tm-proto-tomato-rail').first().waitFor();
                await page.evaluate(() => {
                    historyRows = [];
                    window.dispatchEvent(new CustomEvent('tomato:history-updated', { detail: { source: 'file', mutation: true } }));
                });
                await page.waitForFunction(() => document.querySelectorAll('.tm-proto-tomato-rail').length === 0);
                assert.equal(await page.evaluate(() => {
                    const calendar = __railHosts.state.calendar || __railHosts.state.sideDay.calendar;
                    return calendar.getEvents().filter(event => event.extendedProps.__tmSource === 'tomato').length;
                }), 0, kind + ' accepts clear-all as a successful empty result');

                await page.evaluate(() => {
                    historyRows = [{ ...originalRow }];
                    window.dispatchEvent(new CustomEvent('tomato:history-updated', { detail: { source: 'file', mutation: true } }));
                });
                await page.locator('.tm-proto-tomato-rail').first().waitFor();
                await page.evaluate(() => {
                    const loadRange = __dockTomato.history.loadRange;
                    let blockNextRead = true;
                    __dockTomato.history.loadRange = async (...args) => {
                        if (!blockNextRead) return loadRange(...args);
                        blockNextRead = false;
                        const oldSnapshot = historyRows.map(row => ({ ...row }));
                        await new Promise(resolve => { window.releaseOldHistory = resolve; });
                        return oldSnapshot;
                    };
                    window.dispatchEvent(new CustomEvent('tomato:history-updated', { detail: { source: 'file', mutation: true } }));
                });
                await page.waitForFunction(() => typeof releaseOldHistory === 'function');
                await page.evaluate(() => {
                    historyRows = [];
                    window.dispatchEvent(new CustomEvent('tomato:history-updated', { detail: { source: 'file', mutation: true } }));
                    releaseOldHistory();
                });
                await page.waitForFunction(() => __railHosts.state.dockHistoryReadInFlight === 0 && document.querySelectorAll('.tm-proto-tomato-rail').length === 0);
                assert.equal(await page.evaluate(() => [...__railHosts.state.dockHistoryRangeCache.values()].every(entry => entry.records.length === 0)), true, kind + ' ignores the late pre-delete read');
                assert.deepEqual(errors, [], kind + ' runtime errors');
                console.log(kind + ': calendar delete, external clear and deletion during a read passed');
            } finally { await page.close(); }
        }
    } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
