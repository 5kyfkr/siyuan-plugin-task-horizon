'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '..');
const read = name => fs.readFileSync(path.join(root, name), 'utf8');
const output = path.join(root, 'output/playwright/agent-composer-controls');

// 原生 Menu 是宿主边界；测试保留工作台的真实事件、布局、会话及 SSE 请求链路。
function installHost() {
    window.siyuan = {
        config: { ai: { agent: { modelId: 'model-default' }, providers: [
            { id: '20260630122652-r5hagj8', baseURL: 'https://api.deepseek.com/v1/', enabled: true, models: [
                { id: 'model-default', name: 'deepseek-flash', enabled: true },
                { id: 'disabled', name: 'disabled-model', enabled: false },
            ] },
            { id: 'proxy', displayName: '备用配置', enabled: true, models: [
                { id: 'model-proxy', name: 'deepseek-flash', enabled: true },
            ] },
            { id: 'off', displayName: '已停用', enabled: false, models: [{ id: 'off', name: 'off-model', enabled: true }] },
        ] }, appearance: { lang: 'zh_CN' } },
        storage: { 'siyuan-agent-reasoning-effort': 'medium' }, languages: {}, zIndex: 10,
    };
    window.__hostState = { confirmAccepted: true, confirms: [], notices: [], settingsOpened: 0 };
    let savedStore = { toolsOnboardingDismissed: true };
    class Menu {
        constructor(id, closeCB) {
            this.closeCB = closeCB;
            this.element = document.createElement('div');
            this.element.className = 'b3-menu';
            this.element.dataset.name = id;
            this.element.innerHTML = '<div class="fn__none"></div><div class="b3-menu__items"></div>';
        }
        addItem(item) {
            const button = document.createElement(item.type === 'readonly' ? 'div' : 'button');
            button.className = 'b3-menu__item';
            button.innerHTML = item.label;
            if (item.type !== 'readonly') {
                button.setAttribute('aria-label', button.textContent);
                button.setAttribute('role', 'menuitemradio');
                button.setAttribute('aria-checked', String(!!item.current));
                button.addEventListener('click', () => { this.close(); item.click?.(); });
            }
            this.element.lastElementChild.append(button);
        }
        addSeparator() { this.element.lastElementChild.append(document.createElement('hr')); }
        open({ x, y }) {
            this.element.style.cssText = `position:fixed;left:${x}px;top:${y}px`;
            if (__hostState.nativeMenuSheet) {
                document.activeElement?.blur();
                this.scrim = document.createElement('div');
                this.scrim.id = 'commonMenuScrim';
                this.scrim.style.cssText = `position:fixed;inset:0;background:rgba(0,0,0,.3);z-index:${++siyuan.zIndex}`;
                this.scrim.addEventListener('click', () => this.close());
                document.body.append(this.scrim);
                this.element.classList.add('b3-menu--fullscreen', 'b3-menu--sheet');
                this.element.style.cssText = 'position:fixed;bottom:0;left:0;width:100%';
                this.element.style.transform = 'translateY(100%)';
                this.openFrame = requestAnimationFrame(() => {
                    if (__hostState.nativeMenuResize) window.dispatchEvent(new Event('resize'));
                    this.element.style.transform = 'translateY(0px)';
                });
            }
            this.element.style.zIndex = String(++siyuan.zIndex);
            document.body.append(this.element);
        }
        close() { cancelAnimationFrame(this.openFrame); this.element.remove(); this.scrim?.remove(); this.closeCB?.(); }
    }
    window.__taskHorizonHostBridge = {
        app: { appId: 'agent-controls-test' }, Menu,
        loadData: async () => structuredClone(savedStore),
        saveData: async (_name, value) => { savedStore = structuredClone(value); },
        confirm: (_title, message, yes, no) => { __hostState.confirms.push(message); (__hostState.confirmAccepted ? yes : no)(); },
        openSetting: () => { __hostState.settingsOpened++; },
        kernel: { rpc: { call: {
            taskHorizonGetCapabilities: async () => ({ ok: true, data: { kernelAvailable: true, mcpAvailable: true, mcpEnabled: false } }),
            taskHorizonGetCustomFieldDefinitions: async () => ({ ok: true, data: [] }),
        } } },
    };
    window['siyuan-plugin-task-horizon'] = { aiBridge: {
        getSettings: () => ({ agentMcpEnabled: false, agentMcpAllowed: true }),
        hint: (message, type) => __hostState.notices.push({ message, type }),
    } };
}

(async () => {
    const requests = [];
    const sessions = new Map();
    let failSave = false;
    let failPermission = false;
    let failReasoning = false;
    let finishChat;
    let pushChat;
    const server = http.createServer(async (req, res) => {
        if (req.method === 'GET') {
            res.setHeader('Content-Type', 'text/html; charset=utf-8');
            res.end('<!doctype html><html lang="zh-CN"><body><div id="host"></div><div id="status">视图　▣　⏱ 00:02　Ⅱ</div></body></html>');
            return;
        }
        let input = '';
        for await (const chunk of req) input += chunk;
        const body = JSON.parse(input || '{}');
        requests.push({ url: req.url, body });
        let data = null;
        let error = '';
        if (req.url.endsWith('/lsSessions')) data = { sessions: [...sessions.values()], total: sessions.size };
        else if (req.url.endsWith('/getSession')) { data = sessions.get(body.id); if (!data) error = 'session not found'; }
        else if (req.url.endsWith('/saveSession')) {
            if (failSave) error = 'save unavailable';
            else {
                data = { ...body, revision: (sessions.get(body.id)?.revision || 0) + 1 };
                delete data.expectedRevision;
                sessions.set(body.id, data);
                data = { session: data };
            }
        } else if (req.url.endsWith('/setPermission')) {
            if (failPermission) error = 'permission unavailable';
            else { sessions.get(body.sessionID).permissionMode = body.permissionMode; data = { permissionMode: body.permissionMode }; }
        } else if (req.url.endsWith('/setLocalStorageVal') && failReasoning) error = 'storage unavailable';
        else if (req.url.endsWith('/title')) data = '下一步安排';
        else if (req.url.endsWith('/chat')) {
            res.writeHead(200, { 'Content-Type': 'text/event-stream' });
            res.write('event: content\ndata: {"token":"这是测试回复。"}\n\n');
            pushChat = () => res.write('event: content\ndata: {"token":"新增流式内容"}\n\n');
            finishChat = () => res.end('event: done\ndata: {}\n\n');
            return;
        }
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ code: error ? -1 : 0, msg: error, data }));
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1200, height: 800 }, hasTouch: true });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const control = kind => page.locator(`[data-agent-setting="${kind}"]`);
    const choose = async (kind, label) => {
        await control(kind).click();
        await page.getByRole('menuitemradio', { name: label, exact: true }).first().click();
    };
    const waitLabel = (kind, label) => page.waitForFunction(({ kind, label }) => document.querySelector(`[data-agent-setting="${kind}"]`)?.getAttribute('aria-label')?.includes(label), { kind, label });
    const inset = () => page.locator('.tm-agent-workbench').evaluate(el => parseFloat(el.style.getPropertyValue('--tm-agent-bottom-inset')) || 0);
    try {
        await page.goto('http://127.0.0.1:' + server.address().port);
        await page.addStyleTag({ content: `
          :root { --b3-theme-background:#fafbfc; --b3-theme-surface:#edf0f2; --b3-theme-on-background:#252c35; --b3-theme-on-surface:#485260; --b3-theme-on-surface-light:#68717e; --b3-theme-primary:#438caa; --b3-border-color:#cbd0d6; }
          body { margin:0; font-family:system-ui,sans-serif; background:var(--b3-theme-background); }
          #host { width:460px; height:100vh; margin-left:auto; }
          #status { position:fixed; right:12px; bottom:12px; height:32px; width:208px; box-sizing:border-box; padding:4px 10px; background:#edf0f2; border:1px solid #cbd0d6; border-radius:18px; z-index:100; }
          .block__icon { cursor:pointer; padding:4px; border:0; background:transparent; }
          .block__icon svg { width:16px; height:16px; }
          .b3-text-field { font:inherit; color:inherit; border:0; background:transparent; }
          .b3-button { font:inherit; color:inherit; cursor:pointer; border:1px solid #cbd0d6; border-radius:6px; background:transparent; }
          .b3-button--text { background:var(--b3-theme-primary); color:#fafbfc; }
          .fn__none { display:none; }
          .b3-menu { box-sizing:border-box; padding:4px; border:1px solid #cbd0d6; border-radius:6px; background:var(--b3-theme-background); z-index:200; min-width:160px; }
          .b3-menu__items { overflow:auto; }
          .b3-menu__item { box-sizing:border-box; display:block; width:100%; padding:6px 12px; border:0; background:transparent; color:inherit; font:inherit; text-align:left; }
          button.b3-menu__item:hover { background:var(--b3-theme-surface); }
          .b3-menu__item[aria-checked=true]::after { content:' ✓'; color:var(--b3-theme-primary); }
        ` + read('src/ai/agent-workbench.css') });
        const iconFile = path.resolve(root, '../siyuan-3.8.7/app/appearance/icons/litheness/icon.js');
        if (fs.existsSync(iconFile)) {
            const nativeIcons = fs.readFileSync(iconFile, 'utf8');
            const symbols = ['iconAtom', 'iconBrain', 'iconShieldCheck', 'iconSettings', 'iconAdd', 'iconHistory', 'iconForward', 'iconSquareStop', 'iconClose'].map(id => nativeIcons.match(new RegExp(`<symbol id="${id}"[\\s\\S]*?</symbol>`))?.[0] || '').join('');
            await page.locator('body').evaluate((body, symbols) => body.insertAdjacentHTML('afterbegin', `<svg style="display:none">${symbols}</svg>`), symbols);
        }
        await page.addScriptTag({ content: '(' + installHost.toString() + ')();' });
        await page.addScriptTag({ content: read('src/ai/agent-workbench.js') });
        await page.evaluate(() => __tmAI.mountSidebar(document.getElementById('host'), { mobile: false }));
        assert.deepEqual(await page.locator('.tm-agent-composer-tools button').evaluateAll(nodes => nodes.map(el => el.dataset.agentSetting || 'presets')), ['presets', 'model', 'reasoning', 'permission']);
        await waitLabel('model', 'DeepSeek / deepseek-flash');
        await waitLabel('reasoning', '中');
        await waitLabel('permission', '按批准设置');
        await page.waitForFunction(() => parseFloat(document.querySelector('.tm-agent-workbench').style.getPropertyValue('--tm-agent-bottom-inset')) > 0);
        assert.ok(await page.locator('.tm-agent-composer').evaluate(el => el.getBoundingClientRect().bottom <= document.getElementById('status').getBoundingClientRect().top - 4), 'composer and status text must clear the floating status bar');
        assert.equal(await page.locator('.tm-agent-suggestions__items').isVisible(), false);
        assert.ok(await page.locator('.tm-agent-composer-tools').evaluate(el => Math.abs(el.getBoundingClientRect().top - document.querySelector('[data-agent-preset-menu]').getBoundingClientRect().top) < 2), 'narrow sidebar must keep one preset button and the controls on the same row');
        assert.equal(await page.locator('.tm-agent-composer__status').count(), 0, 'idle composer must not reserve a tool-count status row');
        await page.locator('[data-agent-preset-menu]').click();
        assert.equal(await page.locator('.b3-menu button').count(), 3);
        await page.getByRole('menuitemradio', { name: '创建任务', exact: true }).click();
        assert.equal(await page.locator('.tm-agent-preset > span').textContent(), '创建任务');
        await page.locator('[data-agent-action=clear-preset]').click();
        await page.locator('[data-agent-preset-menu]').click();
        await page.getByRole('menuitemradio', { name: '打开最近会话', exact: true }).click();
        await page.locator('[data-agent-action=close-history]').click();
        fs.mkdirSync(output, { recursive: true });
        await page.screenshot({ path: path.join(output, 'narrow.png') });

        await control('model').click();
        assert.equal(await page.locator('.b3-menu button').count(), 3, 'only two enabled models and the settings entry are shown');
        assert.ok((await page.locator('.b3-menu').textContent()).includes('DeepSeek'));
        assert.ok(!(await page.locator('.b3-menu').textContent()).includes('20260630122652-r5hagj8'), 'provider registry IDs must never appear as names');
        assert.ok(await page.locator('.b3-menu').evaluate(el => el.getBoundingClientRect().bottom < document.querySelector('[data-agent-setting=model]').getBoundingClientRect().top), 'menu must open above the controls');
        await page.locator('.b3-menu button').nth(1).click();
        await waitLabel('model', '备用配置 / deepseek-flash');
        await page.evaluate(() => { Object.assign(siyuan.config.ai.providers[1], { displayName: '', baseURL: 'https://example.com/gateway/v1' }); });
        await control('model').click();
        assert.ok((await page.locator('.b3-menu').textContent()).includes('https://example.com/gateway/v1'), 'custom endpoints without a display name use their address');
        await page.keyboard.press('Escape');
        await page.evaluate(() => { siyuan.config.ai.providers[1].authType = 'chatgpt'; });
        await control('model').click();
        assert.ok((await page.locator('.b3-menu').textContent()).includes('ChatGPT'));
        await page.keyboard.press('Escape');
        await page.evaluate(() => { siyuan.config.ai.providers[1].displayName = '备用配置'; delete siyuan.config.ai.providers[1].authType; window.dispatchEvent(new Event('focus')); });
        await choose('reasoning', '高');
        await waitLabel('reasoning', '高');
        assert.equal(requests.find(item => item.url.endsWith('/setLocalStorageVal')).body.val, 'high');
        failReasoning = true;
        await choose('reasoning', '低');
        await page.waitForFunction(() => __hostState.notices.some(item => item.message.includes('思考强度保存失败')));
        await waitLabel('reasoning', '高');
        failReasoning = false;
        await choose('permission', '本会话自动批准');
        await waitLabel('permission', '本会话自动批准');
        assert.equal(requests.filter(item => item.url.endsWith('/setPermission')).length, 0, 'empty session permission is saved with its first turn');

        await page.locator('[data-agent-draft]').fill('请帮我归纳下一步');
        await page.locator('[data-agent-action=send]').click();
        await page.waitForFunction(() => __tmAI.isBusy());
        await page.waitForFunction(() => document.querySelector('.tm-agent-message--assistant') || document.querySelector('[data-agent-action=stop]'));
        assert.equal(await control('model').isDisabled(), true);
        assert.equal(await control('reasoning').isDisabled(), true);
        assert.equal(await control('permission').isEnabled(), true);
        await control('permission').click();
        pushChat();
        await page.waitForFunction(() => document.querySelector('.tm-agent-messages')?.textContent.includes('新增流式内容'));
        assert.equal(await page.locator('.b3-menu').count(), 1, 'streaming updates must keep the approval menu usable');
        await page.getByRole('menuitemradio', { name: '按批准设置', exact: true }).click();
        await waitLabel('permission', '按批准设置');
        const chat = requests.find(item => item.url.endsWith('/chat'));
        assert.equal(chat.body.model, 'model-proxy');
        assert.equal(chat.body.reasoningEffort, 'high');
        assert.ok(requests.some(item => item.url.endsWith('/saveSession') && item.body.model === 'model-proxy' && item.body.permissionMode === 'allowSession'));
        assert.ok(requests.some(item => item.url.endsWith('/setPermission') && item.body.permissionMode === 'confirm'));
        finishChat();
        await page.waitForFunction(() => !__tmAI.isBusy());
        await page.waitForFunction(() => document.querySelector('.tm-agent-header__title')?.textContent.includes('下一步安排'));
        assert.equal(requests.find(item => item.url.endsWith('/title')).body.model, 'model-proxy');
        const sessionID = chat.body.sessionID;
        await page.evaluate(id => __tmAIAutomationTest.loadSession(id), sessionID);
        await waitLabel('model', '备用配置 / deepseek-flash');

        failSave = true;
        await choose('model', 'deepseek-flash');
        await page.waitForFunction(() => __hostState.notices.some(item => item.message.includes('模型切换失败')));
        await waitLabel('model', '备用配置 / deepseek-flash');
        failSave = false;
        failPermission = true;
        await choose('permission', '本会话自动批准');
        await page.waitForFunction(() => __hostState.notices.some(item => item.message.includes('批准设置更新失败')));
        await waitLabel('permission', '按批准设置');
        failPermission = false;

        sessions.get(sessionID).entries.push({ type: 'assistant', reasoningContent: '已有推理上下文', content: '完成' });
        await page.evaluate(id => __tmAIAutomationTest.loadSession(id), sessionID);
        await page.evaluate(() => { __hostState.confirmAccepted = false; });
        await choose('model', 'deepseek-flash');
        await page.waitForFunction(() => __hostState.confirms.length === 1);
        await waitLabel('model', '备用配置 / deepseek-flash');
        await page.evaluate(() => { __hostState.confirmAccepted = true; });
        await choose('model', 'deepseek-flash');
        await waitLabel('model', 'DeepSeek / deepseek-flash');

        await page.evaluate(() => { document.getElementById('status').style.display = 'none'; });
        await page.waitForFunction(() => document.querySelector('.tm-agent-workbench').style.getPropertyValue('--tm-agent-bottom-inset') === '0px');
        assert.equal(await inset(), 0);
        await page.evaluate(() => { document.getElementById('status').style.cssText += ';display:block;right:auto;left:0'; });
        await page.waitForTimeout(50);
        assert.equal(await inset(), 0, 'floating bars outside the sidebar must not reserve space');
        await page.evaluate(() => { document.getElementById('status').style.cssText += ';right:12px;left:auto;height:60px'; });
        await page.waitForFunction(() => parseFloat(document.querySelector('.tm-agent-workbench').style.getPropertyValue('--tm-agent-bottom-inset')) >= 64);
        await page.evaluate(() => {
            document.getElementById('status').style.display = 'none';
            document.body.insertAdjacentHTML('beforeend', '<div class="tm-mobile-bottom-viewbar" style="position:fixed;right:12px;bottom:12px;width:420px;height:68px;display:flex;align-items:flex-end"><div class="tm-mobile-bottom-viewbar__inner" style="height:36px;width:100%;box-sizing:border-box;padding:6px 12px;background:var(--b3-theme-surface);border:1px solid var(--b3-border-color);border-radius:20px">表格　清单　看板　时间轴　白板　日历</div></div>');
        });
        await page.waitForFunction(() => {
            const bar = document.querySelector('.tm-mobile-bottom-viewbar__inner').getBoundingClientRect();
            const composer = document.querySelector('.tm-agent-composer').getBoundingClientRect();
            return Math.abs(bar.top - composer.bottom - 4) <= 1;
        });
        await page.screenshot({ path: path.join(output, 'bottom-viewbar.png') });
        await page.evaluate(() => { document.querySelector('.tm-mobile-bottom-viewbar').remove(); document.getElementById('status').style.display = 'block'; });

        await page.evaluate(() => { siyuan.config.ai.providers[0].enabled = false; });
        await control('model').click();
        await page.waitForFunction(() => __hostState.notices.some(item => item.message.includes('原模型已不可用')));
        await page.keyboard.press('Escape');
        await waitLabel('model', '备用配置 / deepseek-flash');
        await page.evaluate(() => { siyuan.config.ai.providers.forEach(item => { item.enabled = false; }); window.dispatchEvent(new Event('focus')); });
        assert.equal(await page.locator('[data-agent-action=send]').isDisabled(), true);
        await control('model').click();
        await page.locator('.b3-menu button').filter({ hasText: '配置思源模型' }).click();
        assert.equal(await page.evaluate(() => __hostState.settingsOpened), 1);

        await page.evaluate(() => { siyuan.config.ai.providers[0].enabled = true; document.getElementById('host').style.width = '760px'; });
        await page.evaluate(() => __tmAI.createConversation());
        await waitLabel('model', 'DeepSeek / deepseek-flash');
        assert.equal(await page.locator('[data-agent-preset-menu]').isVisible(), false);
        assert.ok(await page.locator('.tm-agent-composer-tools').evaluate(el => Math.abs(el.getBoundingClientRect().top - document.querySelector('.tm-agent-suggestions__items').getBoundingClientRect().top) < 2), 'wide sidebar must keep suggestions and controls on one row');
        await page.screenshot({ path: path.join(output, 'wide.png') });
        await page.setViewportSize({ width: 320, height: 640 });
        await page.evaluate(() => { document.getElementById('host').style.width = '100%'; return __tmAI.mountSidebar(document.getElementById('host'), { mobile: true }); });
        assert.deepEqual(await control('permission').evaluate(el => ({ width: el.getBoundingClientRect().width, height: el.getBoundingClientRect().height })), { width: 30, height: 30 }, 'mobile controls must use the desktop tab size');
        assert.equal(await page.locator('[data-agent-preset-menu]').evaluate(el => el.getBoundingClientRect().height), 30, 'mobile preset button must use the desktop tab height');
        assert.ok(await page.locator('.tm-agent-composer-tools').evaluate(el => Math.abs(el.getBoundingClientRect().top - document.querySelector('[data-agent-preset-menu]').getBoundingClientRect().top) < 2));
        assert.equal(await page.locator('body').evaluate(el => el.scrollWidth <= window.innerWidth), true);
        const mobileInset = await inset();
        await page.evaluate(() => document.body.insertAdjacentHTML('beforeend', '<div id="siyuan-tomato-float-bar" style="position:fixed;right:16px;top:200px;width:52px;height:52px;background:var(--b3-theme-surface);z-index:100">00:02</div>'));
        await page.waitForTimeout(100);
        assert.equal(await inset(), mobileInset, 'a draggable mobile timer in the conversation area must not lift the input into the upper half of the screen');
        assert.ok(await page.locator('.tm-agent-composer').evaluate(el => el.getBoundingClientRect().top > window.innerHeight / 2), 'idle mobile input must stay in the lower half with a floating timer');
        await page.screenshot({ path: path.join(output, 'mobile-floating-timer.png') });
        await page.evaluate(() => { document.getElementById('siyuan-tomato-float-bar').style.cssText += ';top:auto;bottom:12px'; });
        await page.waitForFunction(() => {
            const bar = document.getElementById('siyuan-tomato-float-bar').getBoundingClientRect();
            return document.querySelector('.tm-agent-composer').getBoundingClientRect().bottom <= bar.top - 4;
        });
        await page.evaluate(() => document.getElementById('siyuan-tomato-float-bar').remove());
        await page.waitForFunction(expected => parseFloat(document.querySelector('.tm-agent-workbench').style.getPropertyValue('--tm-agent-bottom-inset')) === expected, mobileInset);
        await page.screenshot({ path: path.join(output, 'mobile.png') });
        await control('reasoning').focus();
        await page.keyboard.press('Enter');
        assert.equal(await page.locator('.b3-menu').count(), 1);
        await page.screenshot({ path: path.join(output, 'reasoning-menu.png') });
        await page.keyboard.press('Escape');
        assert.equal(await page.locator('.b3-menu').count(), 0);
        await page.keyboard.press('ArrowDown');
        assert.equal(await page.locator('.b3-menu').count(), 1);
        await page.keyboard.press('Escape');
        await page.evaluate(() => {
            const style = document.documentElement.style;
            for (const [key, value] of Object.entries({ background: '#252931', surface: '#303641', 'on-background': '#e2e7ee', 'on-surface': '#c2cbd6', 'on-surface-light': '#a0abba', primary: '#7bb8cf' })) style.setProperty('--b3-theme-' + key, value);
            style.setProperty('--b3-border-color', '#4c5664');
        });
        await page.screenshot({ path: path.join(output, 'mobile-dark.png') });
        const shellSource = read('src/task-horizon/main/40-render-runtime.js');
        const shellStyles = ['.tm-ai-mobile-shell', '.tm-ai-mobile-panel'].map(selector => {
            const start = shellSource.indexOf(selector + ' {');
            return shellSource.slice(start, shellSource.indexOf('}', start) + 1);
        }).join('\n');
        const hostStyles = ['.tm-modal', '.tm-modal.tm-modal--mobile', '.tm-modal.tm-modal--dock', '.tm-main-stage', '.tm-main-stage:has(> .tm-ai-mobile-shell)'].map(selector => {
            const source = read('task-horizon.css');
            const start = source.indexOf(selector + ' {');
            return source.slice(start, source.indexOf('}', start) + 1);
        }).join('\n');
        await page.addStyleTag({ content: hostStyles + shellStyles + '\n.tm-box { display:flex;flex-direction:column;width:100%;height:100%;background:var(--b3-theme-background); }' });
        await page.evaluate(() => {
            document.getElementById('status').style.display = 'none';
            const shell = document.createElement('div');
            shell.className = 'tm-modal tm-modal--mobile';
            shell.innerHTML = '<div class="tm-box"><div class="tm-main-stage"><div class="tm-ai-mobile-shell"><div class="tm-ai-mobile-panel"></div></div></div></div>';
            document.body.append(shell);
            shell.querySelector('.tm-ai-mobile-panel').append(document.getElementById('host'));
        });
        await page.waitForTimeout(50);
        await page.evaluate(() => { __hostState.nativeMenuSheet = true; });
        const sheetHitTarget = () => page.locator('.b3-menu button').first().evaluate(el => {
            const rect = el.getBoundingClientRect();
            return el.contains(document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2));
        });
        for (const kind of ['model', 'reasoning', 'permission']) {
            await control(kind).tap();
            await page.waitForTimeout(50);
            assert.equal(await page.locator('.b3-menu').evaluate(el => el.style.top), '', 'native mobile sheets must retain their host positioning');
            assert.equal(await sheetHitTarget(), true, `${kind} sheet must receive taps above the full-screen AI workspace`);
            await page.locator('.b3-menu button').first().tap();
        }
        await page.evaluate(() => { __hostState.nativeMenuResize = true; });
        await page.locator('[data-agent-draft]').focus();
        await control('reasoning').tap();
        await page.waitForTimeout(100);
        assert.equal(await page.locator('.b3-menu').count(), 1, 'native sheet must survive keyboard and viewport resize while opening');
        await page.evaluate(() => { document.getElementById('host').style.height = '580px'; });
        await page.waitForTimeout(50);
        assert.equal(await page.locator('.b3-menu').count(), 1, 'native sheet must also survive its workspace host being resized');
        assert.equal(await sheetHitTarget(), true);
        await page.screenshot({ path: path.join(output, 'mobile-native-menu.png') });
        await page.locator('.b3-menu button').filter({ hasText: '低' }).click();
        await waitLabel('reasoning', '低');
        await control('permission').click();
        await page.waitForTimeout(50);
        await page.locator('#commonMenuScrim').click({ position: { x: 8, y: 8 } });
        assert.equal(await page.locator('.b3-menu').count(), 0);
        await page.evaluate(() => {
            const shell = document.querySelector('.tm-modal');
            shell.classList.add('tm-modal--dock');
            shell.style.height = '100vh';
        });
        await control('model').tap();
        await page.waitForTimeout(50);
        assert.equal(await sheetHitTarget(), true, 'native mobile menu must also be tappable in Dock');
        await page.locator('.b3-menu button').first().click();
        await page.evaluate(() => __tmAI.cleanup());
        assert.deepEqual(errors, [], 'controls must not emit browser errors');
        console.log('Agent composer controls browser tests passed: model, reasoning, permission, request consistency, failure rollback, responsive layout and floating-bar avoidance');
    } finally {
        finishChat?.();
        await browser.close();
        await new Promise(resolve => server.close(resolve));
    }
})().catch(error => { console.error(error); process.exitCode = 1; });
