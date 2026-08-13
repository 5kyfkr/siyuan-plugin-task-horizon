'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const mainRoot = path.join(root, 'src/task-horizon/main');
const settingsRoot = path.join(mainRoot, 'settings');
const storeSource = fs.readFileSync(path.join(mainRoot, '10-stores-rules-and-cache.js'), 'utf8');

function readJavaScriptFiles(directory, recursive = true) {
    const files = [];
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        const target = path.join(directory, entry.name);
        if (entry.isDirectory()) {
            if (recursive) files.push(...readJavaScriptFiles(target, true));
        } else if (entry.isFile() && entry.name.endsWith('.js')) {
            files.push(target);
        }
    }
    return files;
}

const settingsSource = readJavaScriptFiles(settingsRoot)
    .map((file) => fs.readFileSync(file, 'utf8'))
    .join('\n');
const runtimeSource = [
    ...readJavaScriptFiles(mainRoot),
    ...fs.readdirSync(root)
        .filter((name) => name.endsWith('.js'))
        .map((name) => path.join(root, name)),
].map((file) => fs.readFileSync(file, 'utf8')).join('\n');

const handlerNames = new Set(
    Array.from(settingsSource.matchAll(/(?:onchange|onclick|oninput|onblur)="([A-Za-z_$][A-Za-z0-9_$]*)\(/g))
        .map((match) => match[1]),
);
for (const name of handlerNames) {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    assert.match(runtimeSource, new RegExp(`(?:window\\.|globalThis\\.)?${escaped}\\s*=|function\\s+${escaped}\\s*\\(`),
        `settings UI handler ${name} must exist`);
}

const assignedSettingKeys = new Set(
    Array.from(settingsSource.matchAll(/SettingsStore\.data\.([A-Za-z0-9_]+)\s*=/g))
        .map((match) => match[1]),
);
for (const key of assignedSettingKeys) {
    const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const occurrences = storeSource.match(new RegExp(`\\b(?:this\\.)?data\\.${escaped}\\b|\\b${escaped}\\s*:`, 'g')) || [];
    assert.ok(occurrences.length >= 3,
        `settings key ${key} must retain default/load/save coverage in SettingsStore`);
}

assert.doesNotMatch(settingsSource, /showCompletionTime/,
    'removed settings must not be silently recreated by the generic save action');

console.log(`settings runtime wiring contract tests passed (${handlerNames.size} handlers, ${assignedSettingKeys.size} stored keys)`);
