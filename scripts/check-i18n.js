'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
assert.ok(fs.statSync(path.join(root, 'src/i18n/runtime.js')).isFile(), 'Missing language runtime');
const locales = ['en', 'zh-CN'];
function readDictionary(locale) {
    const source = fs.readFileSync(path.join(root, 'i18n', locale + '.json'), 'utf8');
    const keys = [...source.matchAll(/^  "([^"\\]+)":/gm)].map(match => match[1]);
    assert.equal(new Set(keys).size, keys.length, `Duplicate key in ${locale}`);
    const result = JSON.parse(source);
    assert.equal(result.__locale, locale);
    for (const [key, value] of Object.entries(result)) {
        assert.equal(typeof value, 'string', `${locale}: ${key} must be a string`);
        assert.ok(value.trim(), `${locale}: ${key} is empty`);
        assert.ok(!/^\?{2,}$/.test(value), `${locale}: ${key} has an encoding error`);
    }
    return result;
}
const dictionaries = Object.fromEntries(locales.map(locale => [locale, readDictionary(locale)]));
assert.deepEqual(Object.keys(dictionaries.en).sort(), Object.keys(dictionaries['zh-CN']).sort(), 'Language keys differ');
const parameters = value => [...new Set([...value.matchAll(/\{([A-Za-z_$][\w$]*)\}/g)].map(match => match[1]))].sort();
for (const key of Object.keys(dictionaries.en).filter(key => key !== '__locale')) {
    assert.deepEqual(parameters(dictionaries.en[key]), parameters(dictionaries['zh-CN'][key]), `Parameters differ: ${key}`);
}
const files = ['index.js', 'kernel.js', 'ai.js', 'homepage.js', 'calendar-view.js', 'quickbar.js'];
function collect(directory) {
    for (const item of fs.readdirSync(path.join(root, directory), { withFileTypes: true })) {
        const relative = directory + '/' + item.name;
        if (item.isDirectory() && relative !== 'src/vendor' && !relative.includes('/vendor/')) collect(relative);
        else if (item.isFile() && relative.endsWith('.js')) files.push(relative);
    }
}
collect('src');
let references = 0;
for (const file of files) {
    const source = fs.readFileSync(path.join(root, file), 'utf8');
    for (const match of source.matchAll(/(?:__tmT|i18n\.html)\(["']([\w.]+)["']\s*\)/g)) {
        assert.equal(parameters(dictionaries.en[match[1]] || '').length, 0, `${file}: translation ${match[1]} needs parameters`);
    }
    for (const match of source.matchAll(/\b(?:__tmT|globalThis\.__taskHorizonHostBridge\.i18n\.html)\(["']([\w.]+)["']\s*(?=[,)])/g)) {
        const key = match[1];
        assert.ok(key in dictionaries.en || key + '.other' in dictionaries.en, `${file}: unknown translation ${key}`);
        references++;
    }
}
const plugin = JSON.parse(fs.readFileSync(path.join(root, 'plugin.json'), 'utf8'));
assert.equal(plugin.readme.default, 'README.md');
assert.equal(plugin.readme['zh-CN'], 'README.zh-CN.md');
for (const file of Object.values(plugin.readme)) assert.ok(fs.statSync(path.join(root, file)).isFile(), `Missing README: ${file}`);
const english = fs.readFileSync(path.join(root, 'README.md'), 'utf8');
const chinese = fs.readFileSync(path.join(root, 'README.zh-CN.md'), 'utf8');
assert.match(english, /\]\(README\.zh-CN\.md\)/);
assert.match(chinese, /\]\(README\.md\)/);
assert.match(english, /Interface language/);
assert.match(english, /synchroniz/i);
assert.match(chinese, /界面语言/);
console.log(`i18n verified: ${Object.keys(dictionaries.en).length - 1} messages, ${references} references, two READMEs`);

module.exports = { dictionaries };
