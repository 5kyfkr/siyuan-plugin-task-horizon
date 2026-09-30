'use strict';

// PLAYWRIGHT_MODULE / PLAYWRIGHT_EXECUTABLE can use an existing installation.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '..');
const calendar = fs.readFileSync(path.join(root, 'calendar-view.js'), 'utf8').replace(/\r\n/g, '\n');
const detail = fs.readFileSync(path.join(root, 'src/task-horizon/main/task-runtime/52-task-detail-runtime.js'), 'utf8');
const styles = fs.readFileSync(path.join(root, 'calendar-view.css'), 'utf8');
const openers = [...detail.matchAll(/const openScheduleEditorFromHub = async \(\) => \{[\s\S]*?\n {8,12}\};/g)].map(match => match[0]);
assert.equal(openers.length, 2, 'cover both standalone and task-detail time hubs');
function between(start, end, offset = 0) {
    const from = calendar.indexOf(start, offset);
    const to = calendar.indexOf(end, from + start.length);
    assert.ok(from >= 0 && to > from, start);
    return calendar.slice(from, to);
}
const viewport = between('        const getPrototypePopoverViewport =', '\n        const showPrototypeScheduleEditorCard =');
const positioner = between('            const position = () => {', '\n            let inlineMonthDays', calendar.indexOf('const showPrototypeScheduleEditorCard ='));

async function run() {
    const browser = await chromium.launch({ headless: true,
        ...(process.env.PLAYWRIGHT_EXECUTABLE ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE } : {}) });
    try {
        const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
        for (const theme of ['light', 'dark']) {
            for (let entry = 0; entry < openers.length; entry++) {
                await page.setViewportSize({ width: 1440, height: 900 });
                // Deliberately omit all calendar containers and --tm-cal-* tokens.
                await page.setContent(`<style>${styles}</style><style>
                    :root{--b3-theme-background:${theme === 'dark' ? '#20242b' : '#f8f9fb'};
                        --b3-theme-surface:${theme === 'dark' ? '#292e36' : '#f0f2f5'};
                        --b3-theme-on-background:${theme === 'dark' ? '#e4e8ef' : '#20242b'};
                        --b3-theme-on-surface:${theme === 'dark' ? '#aeb7c5' : '#646a73'};
                        --b3-theme-primary:#528aa2;--b3-theme-on-primary:#f8f9fb}
                    body{margin:0;font:14px system-ui;background:var(--b3-theme-background)}
                    #hub{position:fixed;right:24px;top:240px;width:320px;height:560px;
                        background:var(--b3-theme-surface);color:var(--b3-theme-on-background);border-radius:12px}
                    #hub h3,#hub button{margin:18px}
                    .tm-proto-event-popover{animation:none!important}
                </style><div id="hub"><h3>日期 / 日程</h3><button>新增日程</button></div>`);
                await page.evaluate(value => document.documentElement.setAttribute('data-theme-mode', value), theme);
                await page.addScriptTag({ content: `(() => {
                    const popover = document.querySelector('#hub');
                    const rootEl = document.createElement('div'); // parked calendar from an earlier view
                    const isMobileDevice = false;
                    const isLikelyMobileRuntime = () => false;
                    const isCompactDockLayout = () => false;
                    ${viewport}
                    const hideSchedule = false, taskId = 'task-1', todayKey = '2026-09-30';
                    const getEffectiveTaskId = () => taskId, getBoundTaskId = () => taskId;
                    const readTaskDate = () => '', readHiddenInputValue = () => '';
                    const getTimeFromSchedules = () => '', getTaskTitle = () => '关联日程测试';
                    const makeDateTime = (date, time) => new Date(date + 'T' + time);
                    const hint = message => { throw new Error(message); };
                    const loadHubSchedules = async () => {
                        // The production refresh rebuilds the hub's contents after opening.
                        popover.innerHTML = '<h3>日期 / 日程</h3><button>新增日程</button><p>暂无日程</p>';
                    };
                    globalThis.__tmCalendar = { openScheduleEditor: async extra => {
                        window.openedSchedule = extra;
                        const anchorEl = extra.anchorEl || rootEl;
                        const isNew = true, isMobileFullscreen = false;
                        const pop = document.createElement('div');
                        pop.className = 'tm-proto-event-popover tm-proto-inline-schedule-editor is-new';
                        pop.setAttribute('role', 'dialog');
                        pop.innerHTML = '<div class="hd tm-proto-inline-editor-head"><span class="entity-badge linked">关联日程</span><h3>关联日程测试</h3><p>开始　9月30日　09:00</p><p>结束　9月30日　10:00</p></div><div class="bd tm-proto-inline-editor-body"><p>日历　未分组</p><button>更多设置</button></div><div class="ft quick-new-foot tm-proto-inline-editor-actions"><button>取消</button><button class="primary tm-proto-inline-save">创建日程</button></div>';
                        document.body.appendChild(pop);
                        ${positioner}
                        window.repositionSchedule = position;
                        position();
                        return true;
                    }};
                    ${openers[entry]}
                    window.openFromHub = openScheduleEditorFromHub;
                })();` });
                await page.evaluate(async () => { await window.openFromHub(); window.repositionSchedule(); });
                const geometry = () => page.evaluate(() => {
                    const pop = document.querySelector('[role="dialog"]');
                    const computed = getComputedStyle(pop);
                    const hub = document.querySelector('#hub');
                    const rect = pop.getBoundingClientRect();
                    return { pop: rect.toJSON(), hub: hub.getBoundingClientRect().toJSON(),
                        background: computed.backgroundColor, color: computed.color,
                        panel: computed.getPropertyValue('--tm-cal-panel').trim(),
                        primary: getComputedStyle(pop.querySelector('.primary')).backgroundColor,
                        anchorIsHub: window.openedSchedule.anchorEl === hub,
                        anchorConnected: window.openedSchedule.anchorEl?.isConnected === true,
                        forceNew: window.openedSchedule.forceNew,
                        hit: document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2)?.closest('[role="dialog"]') === pop };
                });
                let result = await geometry();
                assert.equal(result.anchorIsHub, true, 'use the mounted hub rather than a parked calendar');
                assert.equal(result.anchorConnected, true, 'schedule refresh must not detach the anchor');
                assert.equal(result.forceNew, true);
                assert.ok(result.pop.left > 500 && result.pop.right <= result.hub.left,
                    `desktop editor opens alongside the time hub: ${JSON.stringify(result)}`);
                assert.equal(Math.round(result.pop.top), Math.round(result.hub.top));
                assert.equal(result.background, theme === 'dark' ? 'rgb(41, 46, 54)' : 'rgb(248, 249, 251)', 'body portal has an opaque theme surface');
                assert.equal(result.color, theme === 'dark' ? 'rgb(228, 232, 239)' : 'rgb(32, 36, 43)', 'text follows the host theme');
                assert.equal(result.primary, 'rgb(82, 138, 162)', 'create action retains the host primary color');
                assert.equal(result.hit, true, 'the editor is visible and hit-testable');

                await page.setViewportSize({ width: 720, height: 540 });
                await page.evaluate(() => window.repositionSchedule());
                result = await geometry();
                assert.ok(result.pop.left >= 0 && result.pop.right <= 720 && result.pop.top >= 0 && result.pop.bottom <= 540,
                    `editor stays visible after resize: ${JSON.stringify(result.pop)}`);
                assert.equal(result.anchorConnected, true);
                console.log(`${theme} ${entry === 0 ? 'standalone' : 'task-detail'} schedule position and theme passed`);
            }
        }
        fs.mkdirSync(path.join(root, 'output/playwright'), { recursive: true });
        await page.screenshot({ path: path.join(root, 'output/playwright/task-time-hub-schedule-popover.png') });
    } finally {
        await browser.close();
    }
}
run().catch(error => { console.error(error); process.exitCode = 1; });
