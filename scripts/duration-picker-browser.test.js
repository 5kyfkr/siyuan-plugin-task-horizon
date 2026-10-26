'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

const root = path.resolve(__dirname, '..');
const css = fs.readFileSync(path.join(root, 'task-horizon.css'), 'utf8');
const quickbarSource = fs.readFileSync(path.join(root, 'quickbar.js'), 'utf8');
const quickbarCssStart = quickbarSource.indexOf('style.textContent = `') + 'style.textContent = `'.length;
const quickbarCssEnd = quickbarSource.indexOf('`.trim();', quickbarCssStart);
assert.ok(quickbarCssStart > 0 && quickbarCssEnd > quickbarCssStart, 'quickbar styles must exist');
const quickbarCss = quickbarSource.slice(quickbarCssStart, quickbarCssEnd);
const utils = fs.readFileSync(path.join(root, 'src/task-horizon/main/06a-duration-utils.js'), 'utf8');
const picker = fs.readFileSync(path.join(root, 'src/task-horizon/main/20a-duration-picker.js'), 'utf8');
const outDir = path.join(root, 'output/playwright');

async function buildPage(browser) {
    const page = await browser.newPage({ viewport: { width: 900, height: 700 } });
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.setContent(`<!doctype html><html lang="zh-CN"><head><meta charset="utf-8">
        <style>:root{--b3-theme-surface:#fff;--b3-theme-on-surface:#333;--b3-theme-primary:#4285f4;--b3-theme-primary-light:#e8f0fe;--b3-border-color:#e2e8f0;--b3-theme-background:#fff;}
        body{margin:0;background:#f3f5f8;font-family:"Microsoft YaHei UI","Microsoft YaHei",sans-serif;}
        #wrap{display:flex;gap:28px;padding:28px;align-items:flex-start;}
        .panel{background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:12px;box-shadow:0 12px 28px -20px rgba(15,23,42,.35);}
        .panel h3{margin:0 0 8px;font-size:11px;letter-spacing:.08em;color:#8794a5;text-transform:uppercase;}
        </style></head><body><div id="wrap">
        <div class="panel tm-inline-editor--focus-summary" id="host" style="width:252px;"><h3>焦点弹层 252</h3>
            <div class="tm-duration-preset-list tm-duration-preset-list--compact" id="preset-row" style="margin-bottom:8px;"></div>
            <div class="tm-focus-summary-editor__field"><span>预计时长</span><div id="slot"></div></div>
            <div class="tm-focus-summary-editor__readonly" style="margin-top:8px;"><span>实际番茄 <b>0</b></span><span>实际耗时 <b>0m</b></span></div>
        </div>
        <div class="panel" id="quickbar-preset-panel" style="width:228px;"><h3>悬浮条选中态 228</h3>
            <div class="sy-custom-props-floatbar__input-editor is-focus-summary is-visible" style="position:relative;display:block;width:228px;padding:8px;border:1px solid #e2e8f0;border-radius:10px;background:#fff;box-shadow:none;">
                <div class="sy-custom-props-floatbar__input-extra-row is-active" data-duration-preset-value="0.5">
                    <span class="sy-custom-props-floatbar__input-extra-main"><span class="sy-custom-props-floatbar__input-extra-text"><span class="sy-custom-props-floatbar__input-extra-title">0.5h</span></span></span>
                    <span class="sy-custom-props-floatbar__input-extra-tail"><span class="tm-selection-check" aria-hidden="true"></span></span>
                </div>
                <div class="sy-custom-props-floatbar__input-extra-row" data-duration-preset-value="1">
                    <span class="sy-custom-props-floatbar__input-extra-main"><span class="sy-custom-props-floatbar__input-extra-text"><span class="sy-custom-props-floatbar__input-extra-title">1h</span></span></span>
                    <span class="sy-custom-props-floatbar__input-extra-tail"><span class="tm-selection-check" aria-hidden="true"></span></span>
                </div>
            </div>
        </div>
        <div class="panel" id="quickbar-host" style="width:228px;"><h3>悬浮条 228</h3>
            <input class="sy-custom-props-floatbar__input" id="quickbar-input" value="90" style="width:100%;height:32px;border:1px solid #d9e1ea;border-radius:7px;">
            <div id="quickbar-slot"></div>
        </div>
        </div></body></html>`);
    await page.addStyleTag({ content: css });
    await page.addStyleTag({ content: quickbarCss });
    await page.addScriptTag({ content: utils });
    await page.evaluate(() => { window.SettingsStore = { data: { durationFormat: 'hours' } }; });
    await page.addScriptTag({ content: picker });
    return { page, errors };
}

async function main() {
    fs.mkdirSync(outDir, { recursive: true });
    const browser = await chromium.launch({ headless: true });
    try {
        const { page, errors } = await buildPage(browser);
        await page.evaluate(() => {
            const presetRow = document.querySelector('#preset-row');
            presetRow.innerHTML = ['0.5', '1', '2'].map((value) => {
                const label = window.__tmDuration.formatPresetLabel(value, 'hours');
                const selected = value === '0.5' ? ' is-selected' : '';
                return `<button type="button" class="tm-duration-preset-option${selected}" data-tm-duration-preset-value="${value}">
                    <span class="tm-duration-preset-option__main"><span class="tm-duration-preset-option__title">${label}</span></span>
                    <span class="tm-duration-preset-option__check tm-selection-check" aria-hidden="true"></span>
                </button>`;
            }).join('');
            const picker = window.__tmCreateDurationPicker({
                value: '2.5',
                storageAttributes: { 'data-tm-duration-test': '' },
            });
            document.querySelector('#slot').appendChild(picker.root);
            window.__picker = picker;
            window.__enterCount = 0;
            picker.input.addEventListener('keydown', (event) => {
                if (event.key === 'Enter') window.__enterCount += 1;
            });
        });

        const initial = await page.evaluate(() => {
            const root = document.querySelector('#host .tm-duration-picker');
            const host = document.querySelector('#host');
            return {
                hours: document.querySelector('[data-tm-duration-hours]').value,
                minutes: document.querySelector('[data-tm-duration-minutes]').value,
                preview: root.querySelector('.tm-duration-picker__preview').textContent,
                storage: window.__picker.input.value,
                presets: [...document.querySelectorAll('#preset-row .tm-duration-preset-option__title')].map((el) => el.textContent),
                rootWidth: root.getBoundingClientRect().width,
                hostWidth: host.getBoundingClientRect().width,
                scrollWidth: root.scrollWidth,
                clientWidth: root.clientWidth,
            };
        });
        assert.equal(initial.hours, '2');
        assert.equal(initial.minutes, '30');
        assert.equal(initial.preview, '= 2h30m');
        assert.equal(initial.storage, '2.5');
        assert.deepEqual(initial.presets, ['0.5h', '1h', '2h'], 'hour presets must keep the h unit');
        assert.ok(initial.rootWidth <= initial.hostWidth, 'picker must fit the 252px panel');
        assert.ok(initial.scrollWidth <= initial.clientWidth + 1, 'picker must not scroll horizontally');

        await page.locator('#host').screenshot({ path: path.join(outDir, 'duration-picker-252.png') });

        await page.locator('[data-tm-duration-hours]').fill('3');
        await page.locator('[data-tm-duration-minutes]').fill('15');
        const edited = await page.evaluate(() => ({
            storage: window.__picker.input.value,
            preview: document.querySelector('#host .tm-duration-picker__preview').textContent,
            hours: document.querySelector('[data-tm-duration-hours]').value,
            minutes: document.querySelector('[data-tm-duration-minutes]').value,
        }));
        assert.equal(edited.storage, '3.25', '3h15m must write 3.25 hours');
        assert.equal(edited.preview, '= 3h15m');
        assert.equal(edited.hours, '3');
        assert.equal(edited.minutes, '15');

        await page.locator('[data-tm-duration-minutes]').press('Enter');
        assert.equal(await page.evaluate(() => window.__enterCount), 1, 'Enter must reach the storage input');

        await page.evaluate(() => {
            const picker = window.__picker;
            picker.input.value = '0.5';
            picker.input.dispatchEvent(new Event('input', { bubbles: true }));
        });
        const synced = await page.evaluate(() => ({
            hours: document.querySelector('[data-tm-duration-hours]').value,
            minutes: document.querySelector('[data-tm-duration-minutes]').value,
            preview: document.querySelector('#host .tm-duration-picker__preview').textContent,
        }));
        assert.equal(synced.hours, '0');
        assert.equal(synced.minutes, '30');
        assert.equal(synced.preview, '= 30m');

        await page.evaluate(() => {
            const input = document.querySelector('#quickbar-input');
            const picker = window.__tmCreateDurationPicker({
                value: String(input.value || ''),
                storageInput: input,
                unit: 'minutes',
            });
            document.querySelector('#quickbar-slot').appendChild(picker.root);
            window.__quickbarPicker = picker;
        });
        const quickbar = await page.evaluate(() => {
            const input = document.querySelector('#quickbar-input');
            const root = document.querySelector('#quickbar-host .tm-duration-picker');
            return {
                hidden: getComputedStyle(input).display === 'none',
                hours: document.querySelector('#quickbar-slot [data-tm-duration-hours]').value,
                minutes: document.querySelector('#quickbar-slot [data-tm-duration-minutes]').value,
                preview: root.querySelector('.tm-duration-picker__preview').textContent,
                storage: input.value,
                width: root.getBoundingClientRect().width,
                hostWidth: document.querySelector('#quickbar-host').getBoundingClientRect().width,
            };
        });
        assert.equal(quickbar.hidden, true, 'the quickbar storage input must be hidden');
        assert.equal(quickbar.hours, '1');
        assert.equal(quickbar.minutes, '30');
        assert.equal(quickbar.preview, '= 1h30m');
        assert.equal(quickbar.storage, '90');
        assert.ok(quickbar.width <= quickbar.hostWidth, 'picker must fit the 228px quickbar panel');
        await page.locator('#quickbar-host').screenshot({ path: path.join(outDir, 'duration-picker-quickbar-228.png') });
        await page.locator('#wrap').screenshot({ path: path.join(outDir, 'duration-preset-selected-compare.png') });

        assert.deepEqual(errors, [], 'the picker fixture must not raise page errors');
        console.log('duration picker browser tests passed');
        console.log('screenshots:', path.join(outDir, 'duration-picker-252.png'), path.join(outDir, 'duration-picker-quickbar-228.png'));
    } finally {
        await browser.close();
    }
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
