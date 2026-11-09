'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { chromium } = require('./i18n-browser-fixture');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const browserPrelude = `window.siyuan={config:{system:{kernelVersion:'3.7.3',container:'desktop'},appearance:{mode:0}},languages:{}};
window.__tmSuppressStorageWrites=true;
window.fetch=async()=>({ok:true,status:200,json:async()=>({code:0,data:[]}),text:async()=>'',blob:async()=>new Blob()});`;
const i18nSetup = `${read('src/i18n/runtime.js')}
window.__taskHorizonHostBridge.i18n = window.__taskHorizonHostBridge.i18nRuntime.createI18n(${read('i18n/zh-CN.json')}, { locale: 'zh-CN' });
window.__tmT = window.__taskHorizonHostBridge.i18n.t;`;
const manifest = JSON.parse(read('src/task-horizon/manifest.main.json'));
let runtime = manifest.scripts.map(file => read(`src/task-horizon/${file}`)).join('\n');
const bootstrap = runtime.lastIndexOf("    if (document.readyState === 'loading') {");
assert.ok(bootstrap > 0);
runtime = runtime.slice(0, bootstrap) + `
    window.__relativeDateFilterTest = { state, SettingsStore, RuleManager };
    const cached = localStorage.getItem('relative-date-filter-test');
    if (cached) Object.assign(SettingsStore.data, JSON.parse(cached));
    SettingsStore.loaded = true;
    SettingsStore.save = async () => localStorage.setItem('relative-date-filter-test', JSON.stringify(SettingsStore.data));
    state.notebooks = [{ id: 'notebook-test', name: '测试笔记本' }];
    state.notebooksFetchedAt = Date.now();
    state.allDocuments = [{ id: '20260924000000-abcdefg', name: '测试项目', notebook: 'notebook-test', path: '/test.sy' }];
    state.filterRules = SettingsStore.data.filterRules || [];
    __tmAgentPolicyApplyLoaded(__tmAgentPolicyNormalize(null));
    window.__hasPro = true;
    window.tmLicenseHasFeature = () => true;
})();`;

const server = http.createServer((req, res) => {
    if (req.url === '/runtime.js') {
        res.setHeader('content-type', 'text/javascript');
        res.end(i18nSetup + browserPrelude + runtime);
        return;
    }
    if (req.url === '/task.css') {
        res.setHeader('content-type', 'text/css');
        res.end(read('task-horizon.css'));
        return;
    }
    if (req.url === '/basecoat.css') {
        res.setHeader('content-type', 'text/css');
        res.end(read('src/basecoat/basecoat.css'));
        return;
    }
    res.setHeader('content-type', 'text/html; charset=utf-8');
    res.end(`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1">
        <link rel="stylesheet" href="/task.css"><link rel="stylesheet" href="/basecoat.css">
        </head><body><script src="/runtime.js"></script></body></html>`);
});

(async () => {
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    let browser = null;
    const errors = [];
    try {
        browser = await chromium.launch({ headless: true });
        const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
        page.on('pageerror', error => errors.push(error.message));
        page.on('console', message => {
            if (message.type() === 'error') errors.push(message.text());
        });
        await page.goto(`http://127.0.0.1:${server.address().port}`, { waitUntil: 'load', timeout: 15000 });
        await page.evaluate(() => { showSettings(); });
        await page.locator('.tm-settings-v2').waitFor({ timeout: 15000 });
        await page.evaluate(() => {
            tmOpenSettingsV2Page('algo', 'r-rules');
            addNewRule();
            addCondition();
        });
        await page.locator('input[placeholder="规则名称"]').fill('相对日期范围测试');

        const field = page.locator('[data-tm-change="updateConditionField"][data-index="0"]');
        const operator = page.locator('[data-tm-change="updateConditionOperator"][data-index="0"]');
        await field.selectOption('completionTime');
        const dateOperators = await operator.locator('option').allTextContents();
        for (const label of ['明天', '后天', '相对日期范围']) {
            assert.ok(dateOperators.some(text => text.trim() === label), `missing date operator: ${label}`);
        }

        await operator.selectOption('range_relative_days');
        const start = page.locator('[data-range-key="fromDays"]');
        const end = page.locator('[data-range-key="toDays"]');
        assert.deepEqual(await Promise.all([start.inputValue(), end.inputValue()]), ['1', '7']);

        await start.fill('2');
        await start.dispatchEvent('change');
        await end.fill('9');
        await end.dispatchEvent('change');
        assert.deepEqual(await page.evaluate(() => __relativeDateFilterTest.state.editingRule.conditions[0].value),
            { fromDays: 2, toDays: 9 });

        await page.locator('[data-tm-action="addCondition"]').click();
        await page.locator('[data-tm-change="updateConditionField"][data-index="1"]').selectOption('taskDateRange');
        const rangeOperator = page.locator('[data-tm-change="updateConditionOperator"][data-index="1"]');
        assert.equal(await rangeOperator.inputValue(), 'range_contains_relative_days');
        assert.equal((await rangeOperator.locator('option').textContent()).trim(), '包含相对范围');
        assert.deepEqual(await page.evaluate(() => __relativeDateFilterTest.state.editingRule.conditions[1].value),
            { fromDays: 1, toDays: 7 });
        const rangeStart = page.locator('[data-index="1"][data-range-key="fromDays"]');
        const rangeEnd = page.locator('[data-index="1"][data-range-key="toDays"]');
        assert.deepEqual(await Promise.all([rangeStart.inputValue(), rangeEnd.inputValue()]), ['1', '7']);
        await rangeEnd.fill('3');
        await rangeEnd.dispatchEvent('change');
        assert.deepEqual(await page.evaluate(() => __relativeDateFilterTest.state.editingRule.conditions[1].value),
            { fromDays: 1, toDays: 3 });

        fs.mkdirSync(path.join(root, 'output/playwright'), { recursive: true });
        await page.screenshot({ path: path.join(root, 'output/playwright/settings-relative-date-filter.png') });
        await page.setViewportSize({ width: 390, height: 844 });
        const condition = page.locator('.tm-rule-condition').first();
        assert.equal(await condition.evaluate(el => el.scrollWidth <= el.clientWidth + 1), true,
            'relative date controls must fit the mobile rule row');
        await page.setViewportSize({ width: 1280, height: 900 });

        await page.evaluate(() => saveEditRule());
        await page.waitForFunction(() => {
            const saved = JSON.parse(localStorage.getItem('relative-date-filter-test'));
            return saved?.filterRules?.some(rule => rule.name === '相对日期范围测试'
                && rule.conditions?.[0]?.operator === 'range_relative_days'
                && rule.conditions?.[0]?.value?.fromDays === 2
                && rule.conditions?.[0]?.value?.toDays === 9
                && rule.conditions?.[1]?.field === 'taskDateRange'
                && rule.conditions?.[1]?.operator === 'range_contains_relative_days'
                && rule.conditions?.[1]?.value?.fromDays === 1
                && rule.conditions?.[1]?.value?.toDays === 3);
        });
        assert.deepEqual(errors, []);
        console.log('Relative date filter browser: operators, containment ranges, persistence and mobile layout passed');
    } finally {
        if (browser) await browser.close();
        await new Promise(resolve => server.close(resolve));
    }
})().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
