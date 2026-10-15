'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const manifest = JSON.parse(read('src/task-horizon/manifest.main.json'));
let runtime = manifest.scripts.map(file => read('src/task-horizon/' + file)).join('\n');
const startup = runtime.lastIndexOf("    if (document.readyState === 'loading') {");
assert.ok(startup > 0);
runtime = runtime.slice(0, startup) + `
    window.wheelTest = { state, bind(body) { __tmSyncKanbanSnapMetrics(body); __tmBindKanbanSnapSettle(body); },
        reset(left = 0) {
            const board = document.querySelector('#board');
            board.scrollLeft = left === 'end' ? board.scrollWidth - board.clientWidth : left;
            board.querySelector('.tm-kanban-col-body').scrollTop = 0;
            board.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
            board.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
        }
    };
})();`;

async function run() {
    const server = http.createServer((req, res) => {
        res.setHeader('Content-Type', 'text/html'); res.end('<!doctype html><html><body></body></html>');
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const browser = await chromium.launch({ headless: true,
        ...(process.env.PLAYWRIGHT_EXECUTABLE ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE } : {}) });
    try {
        const page = await browser.newPage({ viewport: { width: 1200, height: 800 } });
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.goto('http://127.0.0.1:' + server.address().port);
        await page.addStyleTag({ content: read('task-horizon.css') + `
            body{margin:0;font:14px system-ui}
            #manager{position:relative;display:block;width:900px;height:500px;left:20px;top:20px}
            #board{width:900px;height:440px;padding:0;box-sizing:border-box}
            #board>.tm-kanban{display:flex;position:relative;width:max-content;min-width:100%;height:100%;gap:10px}
            #board .tm-kanban-col{flex:0 0 320px!important;width:320px!important;min-width:320px!important;max-width:320px!important;box-sizing:border-box}
            .fixture-blank{height:800px;flex:none}
        ` });
        await page.addScriptTag({ content: runtime });
        const snapshot = () => page.evaluate(() => {
            const board = document.querySelector('#board');
            return { left: board.scrollLeft, max: board.scrollWidth - board.clientWidth,
                top: board.querySelector('.tm-kanban-col-body').scrollTop, nested: window.nestedWheelCalls };
        });
        const wheel = async (selector, options = {}) => {
            const prevented = await page.evaluate(({ selector, options }) => {
                const event = new WheelEvent('wheel', { bubbles: true, cancelable: true, shiftKey: true, deltaY: 120, ...options });
                document.querySelector(selector).dispatchEvent(event);
                return event.defaultPrevented;
            }, { selector, options });
            await page.waitForTimeout(300);
            await page.waitForFunction(() => !document.querySelector('#board').__tmKanbanSnapAnimRaf);
            return prevented;
        };
        for (const appearance of ['lanes', 'classic']) {
            for (const mode of ['tab', 'dock']) {
                await page.evaluate(({ appearance, mode }) => {
                    document.querySelector('#manager')?.remove();
                    const manager = document.createElement('main');
                    manager.id = 'manager'; manager.className = 'tm-modal tm-modal--' + mode;
                    manager.innerHTML = '<div id="board" class="tm-body tm-body--kanban" data-kanban-appearance="' + appearance + '"><div class="tm-kanban">'
                        + Array.from({ length: 6 }, (_, i) => '<section class="tm-kanban-col"><header class="tm-kanban-col-header">分组 ' + i + '</header><div class="tm-kanban-col-body"><article class="tm-kanban-card"><span>任务</span><button>操作</button></article><div class="fixture-blank"></div></div></section>').join('') + '</div></div>';
                    document.body.append(manager); wheelTest.state.modal = manager;
                    const board = manager.querySelector('#board');
                    window.nestedWheelCalls = 0;
                    board.querySelectorAll('.tm-kanban-col-body').forEach(column => column.addEventListener('wheel', event => {
                        if (!event.shiftKey || event.ctrlKey) return;
                        window.nestedWheelCalls++; column.scrollTop += event.deltaY;
                        event.preventDefault(); event.stopPropagation();
                    }, { passive: false }));
                    wheelTest.bind(board); wheelTest.bind(board);
                }, { appearance, mode });
                await page.waitForTimeout(100);
                assert.ok((await snapshot()).max > 500, 'the fixture has horizontal overflow');
                for (const selector of ['.fixture-blank', '.tm-kanban-card span', '.tm-kanban-card button', '.tm-kanban-col-header']) {
                    await page.evaluate(() => wheelTest.reset());
                    assert.equal(await wheel(selector), true, 'Shift+wheel is claimed by the board');
                    const result = await snapshot();
                    assert.ok(result.left > 0, `${mode}/${appearance}/${selector}: Shift+wheel moves the whole board`);
                    assert.equal(result.top, 0, 'Shift+wheel does not move the column vertically');
                    assert.equal(result.nested, 0, 'the board claims Shift+wheel before nested wheel handlers');
                    if (mode === 'tab') assert.equal(result.left, 120, 'rebinding does not apply the delta twice');
                }
                const previous = await snapshot();
                assert.equal(await wheel('.fixture-blank', { deltaX: -120, deltaY: 0 }), true);
                assert.ok((await snapshot()).left < previous.left, 'horizontal deltas also work with Shift');
                assert.equal(await wheel('.fixture-blank', { shiftKey: false, deltaX: 120, deltaY: 0 }), true);
                assert.ok((await snapshot()).left > 0, 'trackpad horizontal wheel reaches the board');

                await page.evaluate(() => wheelTest.reset());
                assert.equal(await wheel('.fixture-blank', { deltaY: 3, deltaMode: 1 }), true);
                if (mode === 'tab') assert.equal((await snapshot()).left, 48, 'line deltas are converted to pixels');
                assert.equal(await wheel('.fixture-blank', { deltaY: 1, deltaMode: 2 }), true);
                if (mode === 'tab') assert.equal((await snapshot()).left, 948, 'page deltas use board width');

                await page.evaluate(() => wheelTest.reset('end'));
                assert.equal(await wheel('.fixture-blank'), true, 'horizontal overflow is consumed at the board edge');
                const edge = await snapshot();
                assert.equal(Math.round(edge.left), edge.max);
                assert.equal(edge.top, 0);
                assert.equal(await wheel('.fixture-blank', { ctrlKey: true }), false, 'Ctrl+wheel retains its existing zoom behavior');

                await page.evaluate(() => wheelTest.reset());
                await page.locator('.fixture-blank').first().hover({ position: { x: 40, y: 40 } });
                await page.mouse.wheel(0, 120);
                await page.waitForFunction(() => document.querySelector('.tm-kanban-col-body').scrollTop > 0);
                assert.equal((await snapshot()).left, 0, 'ordinary wheel still scrolls the column vertically');
                const beforeShift = await snapshot();
                await page.keyboard.down('Shift');
                await page.mouse.wheel(0, 120);
                await page.keyboard.up('Shift');
                await page.waitForTimeout(300);
                const afterShift = await snapshot();
                assert.ok(afterShift.left > beforeShift.left, 'a real mouse Shift+wheel scrolls the board from blank column space');
                assert.equal(afterShift.top, beforeShift.top, 'real Shift+wheel leaves vertical scroll unchanged');
                console.log(`${mode}/${appearance}: nested targets, directions, units, edges and native wheel passed`);
            }
        }
        assert.deepEqual(errors, []);
    } finally {
        await browser.close();
        await new Promise(resolve => server.close(resolve));
    }
}
run().catch(error => { console.error(error); process.exitCode = 1; });
