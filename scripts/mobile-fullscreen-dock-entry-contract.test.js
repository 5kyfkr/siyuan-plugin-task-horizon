'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'index.js'), 'utf8');

const PLUGIN_NAME = 'siyuan-plugin-task-horizon';
const FULLSCREEN_TAB_TYPE = `sidebar-${PLUGIN_NAME}::task-horizon-fullscreen-tab`;

// 方法体按类缩进取到下一个 4 空格缩进的收尾大括号；方法内部更深的块都带额外缩进。
const sliceMethod = (name) => {
    const start = source.indexOf(`    ${name}(`);
    assert.notEqual(start, -1, `missing method: ${name}`);
    const end = source.indexOf('\n    }\n', source.indexOf('{', start));
    assert.notEqual(end, -1, `missing method end: ${name}`);
    return source.slice(start, end + '\n    }'.length);
};

const METHOD_NAMES = [
    'ensureMobileFullscreenDockRegistered',
    'bindMobileFullscreenDockClick',
    'handleMobileFullscreenDockTrigger',
    'closeMobileSidePanel',
    'openTaskHorizonFullscreen',
    'applyMobileFullscreenDockStyle',
    'removeMobileFullscreenDock',
];

const constBlock = source.slice(
    source.indexOf('const TASK_FULLSCREEN_DOCK_TYPE'),
    source.indexOf('const TASK_DOCK_ROOT_ATTR'),
);
assert.match(constBlock, /TASK_FULLSCREEN_DOCK_TYPE/, '全屏入口 Dock 的常量必须集中声明');
assert.match(constBlock, /TASK_FULLSCREEN_DOCK_ICON = ICON_ID/, '底部栏图标必须复用任务管理器图标');
assert.doesNotMatch(source, /TASK_FULLSCREEN_DOCK_ICON_SVG|ensureMobileFullscreenDockIcon/,
    '复用入口图标后不得再注册独立 symbol');
assert.doesNotMatch(source, /TASK_FULLSCREEN_DOCK_HIDE_SIDEBAR_TAB/, '隐藏页签是固定行为，不再做成开关');

class FakeHTMLElement {}

const createDocument = () => {
    const calls = [];
    const applied = [];
    const removed = [];
    const makePanel = (id) => Object.assign(new FakeHTMLElement(), {
        id,
        style: { removeProperty: (name) => calls.push(`${id}:${name}`) },
    });
    const mask = Object.assign(new FakeHTMLElement(), {
        style: { opacity: '0.4' },
        classList: { values: [], add(value) { this.values.push(value); } },
    });
    const document = {
        calls,
        applied,
        removed,
        mask,
        listeners: [],
        panels: {sidebar: makePanel('sidebar'), sidebarRight: makePanel('sidebarRight')},
        head: {appendChild: (element) => applied.push(element)},
        body: {appendChild: (element) => applied.push(element)},
        addEventListener(type, handler, capture) {
            this.listeners.push({type, handler, capture});
        },
        removeEventListener(type, handler) {
            this.listeners = this.listeners.filter((item) => item.handler !== handler);
        },
        getElementById(id) {
            if (id === 'tm-fullscreen-dock-style') return null;
            return this.panels[id] || null;
        },
        querySelector(selector) {
            return selector === '.side-mask' ? mask : null;
        },
        createElement() {
            return {
                id: '',
                textContent: '',
                remove() { removed.push(this.id); },
            };
        },
    };
    return document;
};

const createPlugin = (options = {}) => {
    const document = options.document || createDocument();
    const sandbox = {
        console,
        window: {},
        document,
        HTMLElement: FakeHTMLElement,
        Element: FakeHTMLElement,
        ICON_ID: 'iconTaskHorizon',
        clearTimeout: () => {},
        setTimeout: options.setTimeout || ((callback) => {
            callback();
            return 1;
        }),
        hasTaskMainRuntime: options.hasTaskMainRuntime || (() => true),
    };
    const api = vm.runInNewContext(
        `${constBlock}\n({ ${METHOD_NAMES.map(sliceMethod).join(',\n')} })`,
        sandbox,
    );
    api.name = PLUGIN_NAME;
    api.isRuntimeMobileClient = () => options.mobile !== false;
    api.addDock = options.addDock || (() => {});
    api.addIcons = options.addIcons || (() => {});
    api.removeDock = options.removeDock || (() => {});
    api.openTaskHorizonTab = options.openTaskHorizonTab || (() => {});
    api.scheduleTaskMainRuntimeRecovery = options.scheduleTaskMainRuntimeRecovery || (() => true);
    return {api, sandbox, document};
};

// 1. 注册入口不能挂在「移动端侧栏」开关下，否则不开侧栏的用户看不到底部栏选项。
const initMobileDock = sliceMethod('initMobileTaskDock');
const registerIndex = initMobileDock.indexOf('ensureMobileFullscreenDockRegistered');
const sidebarGateIndex = initMobileDock.indexOf('if (readMobileSidebarEnabled())');
assert.ok(registerIndex > 0, 'initMobileTaskDock 必须注册全屏入口 Dock');
assert.ok(sidebarGateIndex > 0 && registerIndex < sidebarGateIndex, '全屏入口不能挂在移动端侧栏开关下');

// 2. 卸载时必须回收 Dock 与注入的样式。
assert.match(sliceMethod('onunload'), /removeMobileFullscreenDock/, 'onunload 必须回收全屏入口 Dock');

// 3. 桌面端不注册：不能影响现有桌面 Dock 与布局。
{
    const added = [];
    const {api} = createPlugin({mobile: false, addDock: (options) => added.push(options)});
    assert.equal(api.ensureMobileFullscreenDockRegistered('desktop'), false);
    assert.equal(added.length, 0, '桌面端不得注册移动端全屏入口');
    assert.equal(api._taskFullscreenDockAdded, undefined);
}

// 4. 移动端注册参数与幂等性。
{
    const added = [];
    const icons = [];
    const {api, document} = createPlugin({addDock: (options) => added.push(options), addIcons: (svg) => icons.push(svg)});
    assert.equal(api.ensureMobileFullscreenDockRegistered('startup'), true);
    assert.equal(api.ensureMobileFullscreenDockRegistered('again'), true);
    assert.equal(added.length, 1, '重复调用只能注册一次');
    const [dock] = added;
    assert.equal(dock.id, 'fullscreen');
    assert.equal(dock.type, '::task-horizon-fullscreen');
    assert.equal(dock.config.position, 'RightBottom');
    assert.equal(dock.config.icon, 'iconTaskHorizon', '底部栏图标必须与任务管理器一致');
    assert.equal(dock.config.title, '全屏打开');
    assert.equal(dock.config.index, 0, '底部栏下拉里要排在插件项前面');
    assert.equal(icons.length, 0, '复用入口图标，不再额外注册 symbol');
    assert.equal(document.applied.length, 1, '必须注入隐藏页签的样式');
    assert.ok(document.applied[0].textContent.includes(FULLSCREEN_TAB_TYPE));
    assert.match(document.applied[0].textContent, /\.side-panel \[data-type=/, '隐藏规则要覆盖左右两侧面板');
    assert.match(document.applied[0].textContent, /display:none !important/, '隐藏不能被面板自身样式盖掉');
    assert.ok(!document.applied[0].textContent.includes('sidebar-siyuan-plugin-task-horizon::task-horizon-dock-tab'),
        '不能连带隐藏「任务侧栏」Dock 的页签');
}

// 5. 点开图标后必须收起侧边面板并打开全屏宿主。
{
    const closed = [];
    const opened = [];
    const {api} = createPlugin();
    api.closeMobileSidePanel = () => closed.push(true);
    api.openTaskHorizonFullscreen = (reason) => {
        opened.push(reason);
        return true;
    };
    assert.equal(api.handleMobileFullscreenDockTrigger(null, 'tap'), true);
    assert.deepEqual(closed, [true]);
    assert.deepEqual(opened, ['tap']);
}

// 6. 全屏打开复用宿主已有的入口，并声明来源，便于宿主区分 Dock 与全屏。
{
    const calls = [];
    const {api, sandbox} = createPlugin();
    sandbox.__taskHorizonOpenManagerFromTopbarEntry = (options) => {
        calls.push(options);
        return Promise.resolve();
    };
    assert.equal(api.openTaskHorizonFullscreen('tap'), true);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].restoreDocTopbarContext, false);
    assert.match(calls[0].source, /^mobile-fullscreen-dock:tap/);
}

// 7. 运行时尚未就绪时重试，等宿主入口出现后打开一次。
{
    let reads = 0;
    const opened = [];
    const {api, sandbox} = createPlugin({hasTaskMainRuntime: () => false});
    Object.defineProperty(sandbox, '__taskHorizonOpenManagerFromTopbarEntry', {
        configurable: true,
        get() {
            reads += 1;
            if (reads < 3) return undefined;
            return (options) => {
                opened.push(options);
                return Promise.resolve();
            };
        },
    });
    assert.equal(api.openTaskHorizonFullscreen('retry'), false);
    assert.equal(reads, 3, '前两次取不到入口时应继续重试');
    assert.equal(opened.length, 1);
    assert.match(opened[0].source, /^mobile-fullscreen-dock:retry/);
}

// 8. 收起面板：两侧面板都清除内联 transform，遮罩一并隐藏。
{
    const {api, document} = createPlugin();
    api.closeMobileSidePanel();
    assert.deepEqual(document.calls, ['sidebar:transform', 'sidebarRight:transform']);
    assert.deepEqual([...document.mask.classList.values], ['fn__none']);
}

// 9. 卸载回收：移除 Dock、样式与待执行的重试计时器。
{
    const removedDocks = [];
    const {api, document} = createPlugin({removeDock: (id) => removedDocks.push(id)});
    api._taskFullscreenDockAdded = true;
    api.removeMobileFullscreenDock();
    assert.deepEqual(removedDocks, ['fullscreen']);
    assert.equal(api._taskFullscreenDockAdded, false);
    assert.equal(api._taskFullscreenDockElement, null);
}

// 10. 底部栏点按在捕获阶段拦下：面板不滑入、不切页签，直接开全屏。
{
    const opened = [];
    const {api, document} = createPlugin();
    api.openTaskHorizonFullscreen = (reason) => {
        opened.push(reason);
        return true;
    };
    api.bindMobileFullscreenDockClick();
    api.bindMobileFullscreenDockClick();
    assert.equal(document.listeners.length, 1, '捕获监听只能绑定一次');
    assert.equal(document.listeners[0].capture, true, '必须在捕获阶段拦在思源 openDock 之前');

    const fire = (buttonType) => {
        const button = Object.assign(new FakeHTMLElement(), {dataset: {mobilePluginDock: buttonType}});
        const target = Object.assign(new FakeHTMLElement(), {closest: () => button});
        const flags = [];
        api._taskFullscreenDockClickHandler({
            target,
            preventDefault: () => flags.push('prevent'),
            stopPropagation: () => flags.push('stop'),
        });
        return flags;
    };

    assert.deepEqual(fire(`${PLUGIN_NAME}::task-horizon-fullscreen`), ['prevent', 'stop']);
    assert.deepEqual(opened, ['bottom-bar']);

    // 其它按钮（内置动作、「任务侧栏」Dock）不拦，保持思源原本行为。
    assert.deepEqual(fire(`${PLUGIN_NAME}::task-horizon-dock`), []);
    assert.deepEqual(fire('search'), []);
    assert.deepEqual(opened, ['bottom-bar']);

    api.removeMobileFullscreenDock();
    assert.equal(api._taskFullscreenDockClickHandler, null);
    assert.equal(document.listeners.length, 0, '卸载时必须移除捕获监听');
}

console.log('Mobile fullscreen dock entry contract tests passed');
