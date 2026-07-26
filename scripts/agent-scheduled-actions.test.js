const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'index.js'), 'utf8');
const registered = [];
const removedSkills = [];
const removedFiles = [];

function fallbackHash(value) {
    const content = String(value || '');
    let first = 0x811c9dc5;
    let second = 0x9e3779b9;
    for (let index = 0; index < content.length; index += 1) {
        const code = content.charCodeAt(index);
        first = Math.imul(first ^ code, 0x01000193) >>> 0;
        second = Math.imul(second ^ (code + index), 0x85ebca6b) >>> 0;
    }
    return `fallback:${first.toString(16).padStart(8, '0')}${second.toString(16).padStart(8, '0')}:${content.length}`;
}

const installedSkills = {
    'task-capture': 'plugin-owned-content',
    'task-planning': 'user-modified-content',
};

class PluginStub {
    constructor() {
        this.name = 'siyuan-plugin-task-horizon';
        this.app = {};
    }

    addAgentAction(options) {
        registered.push(options);
        return `plugin__${this.name}__${options.name}`;
    }

    async loadData(name) {
        if (name !== 'agent-workbench.json') return null;
        return {
            builtinSkills: {
                'task-capture': { hash: fallbackHash('plugin-owned-content') },
                'task-planning': { hash: fallbackHash('original-plugin-content') },
            },
        };
    }
}

const context = {
    console,
    module: { exports: {} },
    exports: {},
    require(name) {
        if (name !== 'siyuan') throw new Error(`unexpected module: ${name}`);
        return {
            Plugin: PluginStub,
            Protyle: class Protyle {},
            openTab() {},
            openMobileFileById() {},
            platformUtils: null,
        };
    },
    window: {},
    document: {},
    localStorage: { getItem: () => null, setItem() {} },
    navigator: { userAgent: '' },
    setTimeout,
    clearTimeout,
    Promise,
    Map,
    Set,
    JSON,
    async fetch(url, options = {}) {
        const body = JSON.parse(options.body || '{}');
        if (url === '/api/ai/agent/getSkill') {
            const content = installedSkills[body.name];
            return { ok: true, async json() { return content == null ? { code: -1, msg: 'skill not found' } : { code: 0, data: { content } }; } };
        }
        if (url === '/api/ai/agent/removeSkill') {
            removedSkills.push(body.name);
            return { ok: true, async json() { return { code: 0 }; } };
        }
        if (url === '/api/file/removeFile') {
            removedFiles.push(body.path);
            return { ok: true, async json() { return { code: 0 }; } };
        }
        throw new Error(`unexpected fetch: ${url}`);
    },
};
context.globalThis = context;
vm.createContext(context);
vm.runInContext(source, context, { filename: 'index.js' });

const TaskHorizonPlugin = context.module.exports;
const plugin = new TaskHorizonPlugin();
assert.equal(plugin.registerTaskHorizonAgentActions(), true);
const create = registered.find((item) => item.name === 'create_scheduled_event');
const list = registered.find((item) => item.name === 'list_scheduled_events');
assert.equal(create, undefined, 'scheduled creation must not use a confirm-gated SiYuan frontend action');
assert.equal(list, undefined, 'scheduled listing must use the shared kernel MCP, not a frontend action');
assert.equal(registered.some((item) => /scheduled event|定时事件/i.test(item.description)), false);

const workbench = fs.readFileSync(path.join(__dirname, '..', 'src', 'ai', 'agent-workbench.js'), 'utf8');
assert.doesNotMatch(workbench, /handleScheduledEventMessage|scheduledEventsApi/, 'the workbench must not intercept scheduled-event requests');
assert.match(workbench, /reminderIntentInstruction/, 'the workbench must request the native Agent reminder intent choice');
assert.match(workbench, /phosphorBoldContextIcon\('calendarDots'\)/, 'scheduled-event management must use the Phosphor calendar-dots icon');

plugin.uninstall().then(() => {
    assert.deepEqual(removedSkills, ['task-capture'], 'uninstall must remove only unchanged plugin-owned Agent skills');
    assert.ok(removedFiles.includes('/data/storage/petal/siyuan-plugin-task-horizon/agent-scheduled-events.json'), 'uninstall must remove persisted Agent schedules');
    assert.ok(removedFiles.includes('/data/storage/petal/siyuan-plugin-task-horizon/diagnostic-logs.json'), 'uninstall must remove diagnostic logs');
    assert.equal(removedFiles.includes('/data/storage/petal/siyuan-plugin-task-horizon/task-license.json'), false, 'uninstall must preserve the activation license');
    assert.equal(removedFiles.includes('/data/storage/petal/siyuan-plugin-task-horizon/task-settings.json'), false, 'uninstall must preserve task settings');
    assert.equal(removedFiles.includes('/data/storage/petal/siyuan-plugin-task-horizon/calendar-events.json'), false, 'uninstall must preserve calendar events');
    console.log('Agent scheduled action tests passed');
}).catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
