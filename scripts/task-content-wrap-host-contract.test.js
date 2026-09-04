const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');
const storesSource = read('src/task-horizon/main/10-stores-rules-and-cache.js');
const servicesSource = read('src/task-horizon/main/20-api-and-runtime-services.js');
const settingsSource = read('src/task-horizon/main/settings/60-settings-screen.js');
const actionsSource = read('src/task-horizon/main/task-runtime/51-whiteboard-and-link-runtime.js');
const stylesSource = read('task-horizon.css');

assert.match(storesSource, /taskContentWrapMaxLines:\s*2,/, 'desktop content lines must default to 2');
assert.match(storesSource, /taskContentWrapMaxLinesMobile:\s*2,/, 'mobile content lines must default to 2');
assert.doesNotMatch(storesSource, /taskContentWrapMaxLinesDock/, 'Dock must not maintain a separate content-line setting');

assert.match(
    storesSource,
    /Storage\.get\('tm_task_content_wrap_max_lines',\s*this\.data\.taskContentWrapMaxLines\)/,
    'the legacy content-line storage key must remain the desktop setting',
);
assert.match(storesSource, /Storage\.get\('tm_task_content_wrap_max_lines_mobile',\s*this\.data\.taskContentWrapMaxLinesMobile\)/);
assert.match(storesSource, /Storage\.set\('tm_task_content_wrap_max_lines_mobile',\s*Number\(this\.data\.taskContentWrapMaxLinesMobile\)/);
assert.match(storesSource, /cloudData\.taskContentWrapMaxLinesMobile/, 'the mobile setting must restore from synchronized settings');

assert.match(settingsSource, /'桌面端内容行数'/);
assert.match(settingsSource, /'移动端与 Dock 内容行数'/);
assert.match(actionsSource, /window\.updateTaskContentWrapMaxLinesMobile\s*=\s*async function/);
assert.doesNotMatch(actionsSource, /updateTaskContentWrapMaxLinesDock/);
assert.match(stylesSource, /--tm-task-content-wrap-lines:\s*2;/, 'the first-paint CSS default must match desktop');
assert.doesNotMatch(stylesSource, /var\(--tm-task-content-wrap-lines,\s*3\)/, 'content clamp fallbacks must not use the retired desktop default');

const start = servicesSource.indexOf('const __tmGetWrapConfig = () => {');
const end = servicesSource.indexOf('\n    };', start);
assert.ok(start >= 0 && end > start, 'wrap host resolver must be extractable');
const wrapFunctionSource = servicesSource.slice(start, end + 7);

function getWrapConfig(hostInfo, data) {
    return vm.runInNewContext(
        `(function () { ${wrapFunctionSource}; return __tmGetWrapConfig(); })()`,
        {
            SettingsStore: { data },
            __tmIsDockHost: () => false,
            __tmIsMobileDevice: () => false,
            __tmRuntimeHost: { getInfo: () => hostInfo },
        },
    );
}

const values = {
    taskAutoWrapEnabled: true,
    taskContentWrapMaxLines: 4,
    taskContentWrapMaxLinesMobile: 5,
    taskRemarkWrapMaxLines: 2,
};
assert.equal(getWrapConfig({ isDockHost: false, isMobileDevice: false }, values).contentLines, 4);
assert.equal(getWrapConfig({ isDockHost: false, isMobileDevice: true }, values).contentLines, 5);
assert.equal(getWrapConfig({ isDockHost: true, isMobileDevice: false }, values).contentLines, 5);
assert.equal(getWrapConfig({ isDockHost: true, isMobileDevice: true }, values).contentLines, 5, 'Dock must share the mobile content-line setting');

console.log('task content wrap host contract tests passed');
