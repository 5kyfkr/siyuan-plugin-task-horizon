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

const loadPluginForFrontend = (frontend) => {
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
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
            userAgentData: { mobile: false },
            maxTouchPoints: 10,
        },
        document: {},
        console,
        setTimeout,
        clearTimeout,
        fetch: async () => ({ ok: false }),
    };
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

assert.doesNotMatch(indexSource, /width\s*<=\s*900/, 'entry client detection must not depend on viewport width');
assert.doesNotMatch(runtimeSource, /width\s*<=\s*900/, 'runtime client detection must not depend on viewport width');
assert.match(runtimeSource, /const isEmbeddedHost = modal\.classList\.contains\('tm-modal--tab'\)[\s\S]*modal\.classList\.contains\('tm-modal--dock'\)[\s\S]*\|\| isEmbeddedHost\)/, 'embedded tab and Dock hosts must reject full-viewport mobile dimensions');
assert.match(runtimeSource, /frontend: __tmGetOfficialFrontend\(\)/, 'About diagnostics must report the same official frontend used by runtime detection');

console.log('device recognition and viewport contract tests passed');
