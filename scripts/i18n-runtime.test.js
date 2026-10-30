'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('./i18n-vm-fixture');
const { test } = require('node:test');
const { createI18n, normalizeLanguage, normalizePreference } = require('../src/i18n/runtime');
const messages = { en: require('../i18n/en.json'), 'zh-CN': require('../i18n/zh-CN.json') };
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

test('normalizes SiYuan language codes and only accepts supported saved overrides', () => {
    assert.deepEqual(['zh-CN', 'zh_CN', 'zh-TW', 'en', 'en_US', 'fr', ''].map(normalizeLanguage),
        ['zh-CN', 'zh-CN', 'zh-CN', 'en', 'en', 'en', 'en']);
    assert.deepEqual(['zh-CN', 'en', 'system', 'fr', null].map(normalizePreference),
        ['zh-CN', 'en', 'system', 'system', 'system']);
});

test('named parameters are literal data, repeated placeholders work and plurals retain counts', () => {
    const t = createI18n({ __locale: 'en', sample: '{title}: {count}; {title}' }).t;
    assert.equal(t('sample', { title: '$& ${neverRun()} <b>"', count: 3 }), '$& ${neverRun()} <b>": 3; $& ${neverRun()} <b>"');
    assert.equal(t('sample', { title: 'Task' }), 'Task: {count}; Task');
    const escaped = createI18n({ __locale: 'en', sample: 'Open "{title}"' }).html('sample', { title: '<img src=x onerror=alert(1)>' });
    assert.equal(escaped, 'Open &quot;&lt;img src=x onerror=alert(1)&gt;&quot;');
    const en = createI18n(messages.en), zh = createI18n(messages['zh-CN']);
    assert.equal(en.t('task.selectedCount', { count: 1 }), '1 item selected');
    assert.equal(en.t('task.selectedCount', { count: 2 }), '2 items selected');
    assert.equal(zh.t('task.selectedCount', { count: 1 }), '已选 1 项');
});

test('built-in display names follow the UI without rewriting or translating custom content', () => {
    const en = createI18n(messages.en), item = { id: 'todo', name: '待办', marker: ' ' };
    assert.equal(en.builtinName('status', item), 'To do');
    assert.equal(item.name, '待办');
    assert.equal(en.builtinName('status', { id: 'todo', name: '等待客户回复' }), '等待客户回复');
    assert.equal(en.builtinName('status', { id: 'custom', name: '待办' }), '待办');
    assert.equal(en.builtinName('rule', { id: 'default_today', name: '今日' }), 'Today');
    assert.equal(en.builtinName('rule', { id: 'custom', name: '今日' }), '今日');
    assert.equal(en.weekday(1), 'Mon');
    assert.equal(createI18n(messages['zh-CN']).weekday(1), '周一');
});

test('plugin bootstrap selects a synchronized override before loading dependent scripts', async () => {
    const source = read('index.js');
    const start = source.indexOf('    async initializeTaskLanguage()');
    const end = source.indexOf('    async onload()', start);
    for (const [preference, host, expected] of [['en', 'zh_CN', 'en'], ['zh-CN', 'en', 'zh-CN'], ['system', 'fr', 'en'], ['system', 'zh-CN', 'zh-CN']]) {
        const bridge = {}, fetched = [], css = [];
        const context = { console, PLUGIN_ID: 'siyuan-plugin-task-horizon', __taskHorizonHostBridge: bridge,
            siyuan: { config: { appearance: { lang: host } } },
            document: { documentElement: { style: { setProperty: (...args) => css.push(args) } } },
            loadScriptText: async () => { bridge.i18nRuntime = { createI18n, normalizeLanguage, normalizePreference }; return true; },
            fetchPluginResourceText: async file => { fetched.push(file); return JSON.stringify(messages[expected]); },
        };
        vm.runInNewContext(`class Plugin { ${source.slice(start, end)} }; this.plugin = new Plugin();`, context);
        context.plugin.i18n = messages[normalizeLanguage(host)];
        context.plugin.loadData = async file => { assert.equal(file, 'task-settings.json'); return { uiLanguage: preference }; };
        await context.plugin.initializeTaskLanguage();
        assert.equal(bridge.i18n.locale, expected);
        assert.equal(bridge.i18n.preference, preference);
        assert.equal(css.length, 5);
        assert.equal(fetched.length, normalizeLanguage(host) === expected ? 0 : 1);
    }
});

test('language preference participates in cloud load and the existing field-clock merge', () => {
    const source = read('src/task-horizon/main/10-stores-rules-and-cache.js');
    assert.match(source, /uiLanguage: 'system'/);
    assert.match(source, /cloudData\.uiLanguage[\s\S]{0,160}this\.data\.uiLanguage/);
    assert.match(source, /Storage\.set\('tm_ui_language', this\.data\.uiLanguage\)/);
    assert.match(source, /cachedLanguage[\s\S]{0,180}this\.data\.uiLanguage/);
    assert.match(read('index.js'), /loadData\('task-settings\.json'\)/);
});

test('kernel language overrides reuse dictionaries and preserve custom status names', async () => {
    const source = read('kernel.js');
    const start = source.indexOf('    let __tmKernelMessages');
    const end = source.indexOf('    function createTaskStatusRules', start);
    const calls = [];
    const context = { Map, JSON, Object, String, console, siyuan: {
        plugin: { i18n: messages['zh-CN'] },
        client: { fetch: async (_url, options) => {
            const request = JSON.parse(options.body); calls.push(request.path);
            return { ok: true, text: async () => JSON.stringify(messages.en) };
        } },
    } };
    vm.createContext(context);
    vm.runInContext(source.slice(start, end), context);
    assert.equal(context.__tmT('common.save'), '保存');
    await context.__tmLoadKernelLanguage('en');
    assert.equal(context.__tmT('common.save'), 'Save');
    await context.__tmLoadKernelLanguage('system');
    assert.equal(context.__tmT('common.save'), '保存');
    await context.__tmLoadKernelLanguage('en');
    assert.equal(calls.length, 1, 'repeat calls reuse the loaded override');
    assert.ok(calls[0].endsWith('/i18n/en.json'));
    context.DEFAULT_STATUS_OPTIONS = [{ id: 'todo', name: '待办' }];
    context.text = value => String(value ?? '').trim();
    const fnStart = source.indexOf('    function statusDisplayName(');
    const fnEnd = source.indexOf('    function statusDefinitions(', fnStart);
    vm.runInContext(source.slice(fnStart, fnEnd), context);
    assert.equal(context.statusDisplayName({ id: 'todo', name: '待办' }), 'To do');
    assert.equal(context.statusDisplayName({ id: 'todo', name: '等客户反馈' }), '等客户反馈');
});

test('switching the UI cannot change stored Chinese parser keywords', () => {
    const source = read('ai.js');
    const start = source.indexOf('        const cleanPriority =');
    const end = source.indexOf('\n        };', start) + 11;
    assert.ok(start >= 0 && end > start);
    const context = { __tmT() { throw new Error('Input parsing cannot depend on the UI language'); } };
    vm.runInNewContext(source.slice(start, end) + '\nthis.cleanPriority = cleanPriority;', context);
    assert.equal(context.cleanPriority('高'), 'high');
    assert.equal(context.cleanPriority('medium'), 'medium');
    for (const file of ['kernel.js', 'src/task-horizon/main/settings/67-agent-policy-settings.js']) {
        const text = read(file);
        assert.match(text, /keywords: \['会议', '例会', '周会'\]/);
        assert.match(text, /keywords: \['报告', '周报', '复盘', '方案', '文档', '撰写'\]/);
    }
});
