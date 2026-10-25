'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const source = fs.readFileSync(path.join(__dirname, '../quickbar.js'), 'utf8');
const styles = source.match(/style\.textContent = `([\s\S]*?)`\.trim\(\);/)[1];
const prefix = 'sy-custom-props-floatbar__';
const tag = text => `<span class="${prefix}option-label ${prefix}option-label--status">${text}</span>`;
const custom = (id, labels, inline = false) => `<span class="${inline ? 'sy-custom-props-inline-chip sy-custom-props-inline-chip--custom-field' : prefix + 'prop ' + prefix + 'prop--custom-field'}"><span class="${prefix}custom-tags" id="${id}">${labels.map(tag).join('')}</span></span>`;

async function run() {
    const browser = await chromium.launch({ headless: true,
        ...(process.env.PLAYWRIGHT_EXECUTABLE ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE } : {}) });
    try {
        const page = await browser.newPage({ viewport: { width: 1000, height: 500 } });
        await page.setContent(`<style>${styles}</style><style>
            :root{--b3-theme-background:#fafafa;--b3-theme-surface:#f2f3f5;--b3-theme-on-surface:#444;
                --b3-theme-primary:#3877c9;--b3-border-color:#d5d9df;--b3-dialog-shadow:0 3px 12px #2222}
            body{font:16px system-ui;padding:30px}
            .sy-custom-props-floatbar{display:flex;position:static;width:max-content}
            .${prefix}option-label--status{--qb-status-fg:#a75e17;--qb-status-bg:#fcf0dc;--qb-status-border:#ebbd7f}
        </style><div class="sy-custom-props-floatbar"><div class="${prefix}row">
            <span class="${prefix}prop" id="status"><span class="${prefix}prop-value">新增</span></span>
            ${custom('single', ['需资源'])}${custom('multi', ['需资源', '等待确认', '+2'])}
        </div></div><div style="margin-top:20px">
            <span class="sy-custom-props-inline-chip sy-custom-props-inline-chip--status" id="inline-status">${tag('新增')}</span>
            ${custom('inline-single', ['需资源'], true)}${custom('inline-multi', ['需资源', '等待确认'], true)}
        </div>`);
        for (const fontSize of [12, 16, 22]) {
            await page.evaluate(size => { document.body.style.fontSize = size + 'px'; }, fontSize);
            const result = await page.evaluate(() => {
                const info = el => ({ font: getComputedStyle(el).fontSize, height: el.getBoundingClientRect().height });
                return {
                    status: { font: getComputedStyle(document.querySelector('#status .sy-custom-props-floatbar__prop-value')).fontSize,
                        height: document.querySelector('#status').getBoundingClientRect().height },
                    floating: [...document.querySelectorAll('#single > span, #multi > span')].map(info),
                    inlineStatus: info(document.querySelector('#inline-status > span')),
                    inline: [...document.querySelectorAll('#inline-single > span, #inline-multi > span')].map(info),
                };
            });
            result.floating.forEach(label => assert.deepEqual(label, result.status, 'floating custom tags match status font and height'));
            result.inline.forEach(label => assert.deepEqual(label, result.inlineStatus, 'inline custom tags retain the inline status size'));
        }
        fs.mkdirSync(path.join(__dirname, '../output/playwright'), { recursive: true });
        await page.locator('.sy-custom-props-floatbar').screenshot({ path: path.join(__dirname, '../output/playwright/quickbar-custom-tags.png') });
        console.log('quickbar single/multi tags match status font and height; inline labels remain consistent');
    } finally {
        await browser.close();
    }
}

run().catch(error => { console.error(error); process.exitCode = 1; });
