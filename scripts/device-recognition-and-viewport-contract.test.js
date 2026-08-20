'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const indexPath = path.join(root, 'index.js');
const runtimePath = path.join(root, 'src/task-horizon/main/20-api-and-runtime-services.js');
const indexSource = fs.readFileSync(indexPath, 'utf8');
const runtimeSource = fs.readFileSync(runtimePath, 'utf8');

const loadPluginForFrontend = (frontend, options = {}) => {
    class Plugin {}
    const context = {
        module: { exports: {} },
        exports: {},
        require(id) {
            if (id !== 'siyuan') throw new Error(`unexpected module: ${id}`);
            return {
                Plugin,
                Protyle: function Protyle() {},
                openTab() {},
                openMobileFileById() {},
                platformUtils: {},
                getFrontend: () => frontend,
            };
        },
        window: {
            innerWidth: 700,
            matchMedia: () => ({ matches: false }),
        },
        navigator: {
            userAgent: options.userAgent || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
            userAgentData: { mobile: false },
            maxTouchPoints: 10,
        },
        document: { documentElement: { dataset: {} } },
        siyuan: { config: { system: { container: options.container || '' } } },
        console,
        setTimeout,
        clearTimeout,
        fetch: async () => ({ ok: false }),
    };
    if (options.harmonyBridge) context.JSHarmony = {};
    if (options.androidBridge) context.JSAndroid = {};
    context.globalThis = context;
    vm.runInNewContext(indexSource, context, { filename: indexPath });
    const TaskHorizonPlugin = context.module.exports;
    return new TaskHorizonPlugin().isRuntimeMobileClient();
};

for (const frontend of ['desktop', 'desktop-window', 'browser-desktop']) {
    assert.equal(loadPluginForFrontend(frontend), false, `${frontend} must stay desktop in a narrow touch-capable window`);
}
for (const frontend of ['mobile', 'browser-mobile']) {
    assert.equal(loadPluginForFrontend(frontend), true, `${frontend} must use mobile client logic`);
}

const harmonyDesktopUa = 'Mozilla/5.0 (PC; OpenHarmony 6.1; Windows NT 10.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36 ArkWeb/6.1.0.130 HuaweiBrowser/6.1.7.302';
assert.equal(
    loadPluginForFrontend('browser-desktop', { container: 'harmony', userAgent: harmonyDesktopUa }),
    false,
    'HarmonyOS PC ArkWeb browser must stay desktop without the native Harmony bridge',
);
assert.equal(
    loadPluginForFrontend('mobile', { container: 'harmony', harmonyBridge: true }),
    true,
    'HarmonyOS native client must use mobile logic when the Harmony bridge is present',
);
assert.equal(
    loadPluginForFrontend('desktop', { container: 'harmony', harmonyBridge: true }),
    false,
    'Harmony 2in1 desktop bundle must stay desktop even when the native bridge is present',
);

assert.doesNotMatch(indexSource, /width\s*<=\s*900/, 'entry client detection must not depend on viewport width');
assert.doesNotMatch(runtimeSource, /width\s*<=\s*900/, 'runtime client detection must not depend on viewport width');
assert.match(indexSource, /container === "harmony"[\s\S]*JSHarmony/, 'Harmony native detection must require the Harmony container and bridge');
assert.match(runtimeSource, /container === 'harmony'[\s\S]*JSHarmony/, 'runtime Harmony detection must require the Harmony container and bridge');
assert.match(runtimeSource, /const isEmbeddedHost = modal\.classList\.contains\('tm-modal--tab'\)[\s\S]*modal\.classList\.contains\('tm-modal--dock'\)[\s\S]*\|\| isEmbeddedHost\)/, 'embedded tab and Dock hosts must reject full-viewport mobile dimensions');
assert.match(runtimeSource, /frontend: __tmGetOfficialFrontend\(\)/, 'About diagnostics must report the same official frontend used by runtime detection');

console.log('device recognition and viewport contract tests passed');
