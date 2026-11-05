'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '..');
const output = path.join(root, 'output/playwright/task-title-underline-paint');

function customFontCss() {
    const directory = process.env.TITLE_UNDERLINE_FONT_DIR
        || path.join(process.env.LOCALAPPDATA || '', 'Microsoft/Windows/Fonts');
    const fonts = [
        ['TitlePaintAiry', 'FTAiry-Regular.OTF'],
        ['TitlePaintHarmony', 'HarmonyOS_Sans_SC_Medium.ttf'],
    ];
    return fonts.filter(([, file]) => fs.existsSync(path.join(directory, file)))
        .map(([family, file]) => `@font-face{font-family:${family};src:url(data:font/otf;base64,${fs.readFileSync(path.join(directory, file)).toString('base64')})}`)
        .join('\n');
}

async function paintCounts(page, screenshot, records) {
    return page.evaluate(async ({ png, records }) => {
        const image = new Image(); image.src = 'data:image/png;base64,' + png; await image.decode();
        const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height;
        const context = canvas.getContext('2d'); context.drawImage(image, 0, 0);
        const data = context.getImageData(0, 0, canvas.width, canvas.height).data;
        return records.map(record => ({ ...record, visible: record.fragments.map(fragment => {
            let widest = 0;
            // 检查每一行文字下方真正绘制的红色下划线，不能仅检查 computedStyle。
            const start = Math.floor(fragment.y + fragment.height * 0.65);
            const end = Math.ceil(Math.min(record.bottom, fragment.y + fragment.height + 5));
            for (let y = start; y < end; y++) {
                let count = 0;
                for (let x = Math.floor(fragment.x); x < Math.ceil(fragment.x + fragment.width); x++) {
                    const offset = (y * canvas.width + x) * 4;
                    if (data[offset] > 150 && data[offset + 1] < 140 && data[offset + 2] < 140) count++;
                }
                widest = Math.max(widest, count);
            }
            return widest >= Math.min(8, fragment.width * 0.4);
        }) }));
    }, { png: screenshot.toString('base64'), records });
}

async function main() {
    const browser = await chromium.launch({ headless: true,
        ...(process.env.PLAYWRIGHT_EXECUTABLE ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE } : {}) });
    fs.mkdirSync(output, { recursive: true });
    try {
        const page = await browser.newPage({ viewport: { width: 1000, height: 900 }, deviceScaleFactor: 1 });
        const cases = [
            ['short', '测试<span class="tm-linked-text">链接</span>'],
            ['wrapped', '循环功能使用介绍<span class="tm-linked-text tm-task-title-block-ref"><span class="tm-task-title-block-ref__text">个人节假日界面优化</span></span>'],
            ['mixed', '323232<span class="tm-linked-text">链接111</span>111'],
            ['native', '测试<span class="tm-native-title"><span data-type="a strong" class="tm-linked-text">链接</span></span>'],
        ];
        const column = (kind, surface) => `<section class="paint-column ${kind}"><h3>${surface} / ${kind}</h3>${cases.map(([name, html]) => `<div class="paint-row"><span data-case="${name}" data-surface="${surface}" data-kind="${kind}" class="paint-title ${surface === 'kanban' ? 'tm-kanban-card-title-inline tm-task-content-clickable' : 'tm-checklist-title-text'}">${html}</span></div>`).join('')}</section>`;
        await page.setContent(`<style>${fs.readFileSync(path.join(root, 'task-horizon.css'), 'utf8')}</style><style>
            ${customFontCss()}
            body{margin:20px;background:white;color:black;text-underline-position:under;text-decoration-skip-ink:all;font:16px/21.6px TitlePaintAiry,TitlePaintHarmony,Arial,sans-serif}
            .paint-fixture.tm-modal{position:static;inset:auto;display:block;width:auto;height:auto;max-width:none;min-width:0;margin:0;padding:0;box-shadow:none;background:white;--tm-font-size:17px;--tm-task-content-wrap-lines:2}
            .paint-columns{display:flex;gap:32px}.paint-column{width:200px}h3{font:14px Arial,sans-serif;margin:12px 0}
            .paint-row{margin:12px 0 24px}.paint-title{font:16px/21.6px TitlePaintAiry,TitlePaintHarmony,Arial,sans-serif;display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;overflow:hidden;white-space:normal;overflow-wrap:anywhere;width:145px;max-width:145px;color:black}
            .paint-title .tm-linked-text{text-decoration-color:rgb(255,0,0)}
            .legacy .tm-linked-text{text-underline-position:under}
        </style><main class="paint-fixture tm-modal tm-modal--task-wrap"><div class="paint-columns">${column('legacy', 'kanban')}${column('current', 'kanban')}${column('legacy', 'checklist')}${column('current', 'checklist')}</div></main>`);
        await page.evaluate(() => document.fonts.ready);
        await page.mouse.move(0, 0);
        const records = await page.locator('.paint-title').evaluateAll(titles => titles.map(title => {
            const link = title.querySelector('.tm-linked-text');
            const parentRect = title.getBoundingClientRect();
            return { name: title.dataset.case, kind: title.dataset.kind, surface: title.dataset.surface,
                height: parentRect.height, bottom: parentRect.bottom,
                position: getComputedStyle(link).textUnderlinePosition,
                fragments: Array.from(link.getClientRects(), rect => ({ x: rect.x, y: rect.y, width: rect.width, height: rect.height }))
                    .filter(rect => rect.y < parentRect.bottom),
            };
        }));
        const screenshot = await page.screenshot({ path: path.join(output, 'inherited-under-position.png') });
        const results = await paintCounts(page, screenshot, records);
        fs.writeFileSync(path.join(output, 'paint-results.json'), JSON.stringify(results, null, 2));
        assert.ok(results.some(record => record.kind === 'legacy' && record.visible.includes(false)), 'control reproduces underline clipping even though text-decoration is underline');
        for (const record of results.filter(record => record.kind === 'current')) {
            assert.equal(record.position, 'auto', 'task link owns its underline position instead of inheriting the theme position');
            assert.ok(record.visible.length > 0 && record.visible.every(Boolean), `every visible line paints an underline: ${record.surface}/${record.name}`);
            const previous = results.find(item => item.kind === 'legacy' && item.surface === record.surface && item.name === record.name);
            assert.equal(record.height, previous.height, 'fix must not change row height or two-line truncation');
        }
        console.log('8 native underline paint cases passed; legacy control reproduces clipping, row heights remain unchanged');
    } finally { await browser.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
