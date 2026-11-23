'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('./i18n-browser-fixture');
const source = fs.readFileSync(path.join(__dirname, '../homepage.js'), 'utf8');
const styles = fs.readFileSync(path.join(__dirname, '../task-horizon.css'), 'utf8');
const settingsService = fs.readFileSync(path.join(__dirname, '../src/task-horizon/main/37-project-visibility-service.js'), 'utf8');

(async () => {
    const browser = await chromium.launch({ headless: true });
    try {
        for (const width of [1280, 320]) {
            const page = await browser.newPage({ viewport: { width, height: 900 } });
            const errors = [];
            page.on('pageerror', error => errors.push(error.message));
            await page.goto('data:text/html,<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><main id="homepage"></main>');
            const initialOrder = ['overview', 'projects', 'trend', 'heatmap'];
            let saved = { moduleOrder: initialOrder, moduleLayout: { trend: 'wide' }, completedProjects: { 'doc:closed': true } };
            await page.exposeFunction('loadHomepageSettingsFixture', key => {
                assert.equal(key, 'homepage-settings.json');
                return saved;
            });
            await page.exposeFunction('saveHomepageSettingsFixture', (key, value) => {
                assert.equal(key, 'homepage-settings.json');
                saved = value;
                return true;
            });
            const mount = async () => {
                await page.addStyleTag({ content: styles });
                await page.addStyleTag({ content: 'body { margin: 0; }' });
                await page.evaluate(() => {
                    window.__tmHost = {
                        loadData: window.loadHomepageSettingsFixture,
                        saveData: window.saveHomepageSettingsFixture,
                    };
                });
                await page.addScriptTag({ content: settingsService });
                await page.addScriptTag({ content: source });
                await page.evaluate(async () => {
                    window.__tmHomepage.mount(document.getElementById('homepage'), {
                        todayKey: '2026-11-23',
                        animateOnMount: false,
                        tasks: [
                            { id: 'start', created: '2025-01-01', done: true, taskCompleteAt: '2025-01-01' },
                            { id: 'end', created: '2024-02-29', done: true, taskCompleteAt: '2025-12-31' },
                            { id: 'today', done: true, taskCompleteAt: '2026-11-23' },
                        ],
                    });
                    await window.__tmProjectVisibility.load();
                });
            };
            await mount();

            const trend = page.locator('.tm-homepage-card--trend');
            const heatmap = page.locator('.tm-homepage-card--heatmap');
            const trendRange = trend.locator('select');
            const heatmapRange = heatmap.locator('select');
            const today = page.locator('.tm-homepage-summary-main-value');
            const shell = heatmap.locator('.tm-homepage-heatmap-shell');
            const latestMonthVisible = () => shell.evaluate(node => {
                const bounds = node.getBoundingClientRect();
                const last = node.querySelector('.tm-homepage-heatmap-month:last-child').getBoundingClientRect();
                return last.right <= bounds.right + 1 && last.left >= bounds.left - 1;
            });
            assert.equal(await trendRange.inputValue(), '30d');
            assert.equal(await heatmapRange.inputValue(), '6m');
            assert.equal(await heatmap.locator('.tm-homepage-heatmap-month').count(), 6);
            assert.equal(await today.first().textContent(), '1');
            assert.equal(await latestMonthVisible(), true, 'initial view must show the latest month');
            await heatmapRange.evaluate(node => { node.dataset.retained = 'true'; });
            await trendRange.focus();
            await trendRange.selectOption('7d');
            const trendDates = trend.locator('.tm-homepage-trend-axis-date');
            assert.equal(await trendDates.count(), 7);
            assert.equal(await trendDates.first().textContent(), '11/17');
            assert.equal(await trendDates.last().textContent(), '11/23');
            await trendRange.selectOption('year-2025');
            assert.equal(await trendRange.evaluate(node => node === document.activeElement), true, 'retain focus after switching');
            assert.equal(await heatmapRange.inputValue(), '6m');
            assert.equal(await heatmapRange.getAttribute('data-retained'), 'true', 'switching trend must not rerender the heatmap');
            assert.equal(await trend.locator('.tm-homepage-trend-stat-value').first().textContent(), '1');
            assert.match(await trend.locator('.tm-homepage-trend-stat-note').first().textContent(), /2025/);

            await heatmapRange.selectOption('year-2025');
            assert.equal(await trendRange.inputValue(), 'year-2025');
            assert.equal(await today.first().textContent(), '1');
            const cells = heatmap.locator('.tm-homepage-heatmap-month-grid [title]');
            assert.equal(await cells.count(), 365);
            assert.match(await cells.first().getAttribute('title'), /^2025-01-01/);
            assert.match(await cells.last().getAttribute('title'), /^2025-12-31/);
            assert.equal(await latestMonthVisible(), true, 'switching ranges must show the latest month in that range');
            assert.equal(await shell.evaluate(node => {
                node.scrollBy({ left: -node.scrollWidth, behavior: 'instant' });
                const bounds = node.getBoundingClientRect();
                const first = node.querySelector('.tm-homepage-heatmap-month').getBoundingClientRect();
                return first.left >= bounds.left - 1 && first.right <= bounds.right + 1;
            }), true, 'first month must remain accessible by scrolling left');

            await trendRange.selectOption('90d');
            assert.equal(await trendRange.inputValue(), '90d');
            assert.equal(await heatmapRange.inputValue(), 'year-2025');
            assert.equal(await latestMonthVisible(), false, 'changing the trend must not reset heatmap scrolling');
            assert.ok(await trend.locator('.tm-homepage-trend-axis-date').count() <= 7);
            await heatmapRange.selectOption('6m');
            assert.equal(await trendRange.inputValue(), '90d');
            assert.equal(await heatmap.locator('.tm-homepage-heatmap-month').count(), 6);
            assert.equal(await cells.count(), 176);
            assert.match(await cells.first().getAttribute('title'), /^2026-06-01/);
            assert.match(await cells.last().getAttribute('title'), /^2026-11-23/);
            assert.equal(await latestMonthVisible(), true, 'six-month view must show the latest month');

            await trendRange.selectOption('6m');
            assert.match(await trend.locator('.tm-homepage-trend-axis').getAttribute('style'), /--tm-home-trend-points:6;/);
            assert.equal(await heatmapRange.inputValue(), '6m');
            for (const card of [trend, heatmap]) {
                assert.equal(await card.evaluate(node => {
                    const head = node.querySelector('.tm-homepage-card-head').getBoundingClientRect();
                    const title = node.querySelector('.tm-homepage-card-title');
                    const text = document.createRange();
                    text.selectNodeContents(title);
                    const select = node.querySelector('select').getBoundingClientRect();
                    return select.right <= head.right + 1 && text.getBoundingClientRect().right <= select.left;
                }), true, `the range control must fit the ${width}px layout without overlapping the title`);
            }
            if (process.env.CHART_RANGE_SCREENSHOTS) {
                await shell.evaluate(node => { node.scrollBy({ left: node.scrollWidth, behavior: 'instant' }); });
                await trend.screenshot({ path: path.join(process.env.CHART_RANGE_SCREENSHOTS, `trend-${width}.png`) });
                await heatmap.screenshot({ path: path.join(process.env.CHART_RANGE_SCREENSHOTS, `heatmap-${width}.png`) });
            }
            await trendRange.selectOption('7d');
            await heatmapRange.selectOption('year-2025');
            await page.waitForFunction(() => {
                const settings = window.__tmProjectVisibility.getSettings();
                return settings.trendRange === '7d' && settings.heatmapRange === 'year-2025';
            });
            assert.deepEqual(saved.moduleOrder, initialOrder);
            assert.deepEqual(saved.moduleLayout, { trend: 'wide' });
            assert.deepEqual(saved.completedProjects, { 'doc:closed': true });

            await page.reload();
            await mount();
            assert.equal(await trendRange.inputValue(), '7d');
            assert.equal(await trendDates.count(), 7);
            assert.equal(await heatmapRange.inputValue(), 'year-2025');
            assert.equal(await cells.count(), 365);
            assert.equal(await latestMonthVisible(), true);
            assert.deepEqual(errors, []);
            await page.close();
        }
    } finally {
        await browser.close();
    }
    console.log('homepage chart range browser tests passed');
})().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
