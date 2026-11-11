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
const taskCountBadgeSettingsSource = fs.readFileSync(path.join(settingsRoot, '69-task-count-badge-settings.js'), 'utf8');
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
assert.match(storeSource,
    /this\.data = __tmCloneJsonSafe\(__tmDefaultSettingsData,[\s\S]*if \(cloudData\.taskCountBadge && typeof cloudData\.taskCountBadge === 'object'[\s\S]*this\.data\.taskCountBadge = __tmNormalizeTaskCountBadge\(cloudData\.taskCountBadge\)/,
    'a valid synchronized file must replace local settings before applying its values');
assert.doesNotMatch(taskCountBadgeSettingsSource,
    /settingsFieldUpdatedAt/,
    'task count badge edits must not maintain a separate synchronization clock');
assert.match(storeSource,
    /whiteboardNavigatorHidden:\s*!!src\.whiteboardNavigatorHidden/,
    'the whiteboard navigator preference must participate in versioned whiteboard synchronization');
assert.doesNotMatch(storeSource,
    /__tmApplySettingsFieldUpdatesByMap\(this\.data, cloudData/,
    'shared settings must not merge individual fields over a valid synchronized file');
assert.match(storeSource,
    /delete payload\.settingsFieldUpdatedAt/,
    'new settings writes must remove the legacy field timestamp map');
assert.match(storeSource,
    /this\.data\.taskSearchFields = __tmGetTaskSearchFields\(cloudData\.taskSearchFields\)/,
    'the synchronized task search scope must load from the authoritative file');
assert.match(storeSource,
    /this\.data\.docDefaultTaskHeadingByDocId = __tmNormalizeDocDefaultTaskHeadingMap\(cloudData\.docDefaultTaskHeadingByDocId\)/,
    'the synchronized document heading map must load from the authoritative file');
assert.doesNotMatch(storeSource,
    /shouldApplyCloudDocGroupState && cloudData\.docDefaultTaskHeadingByDocId/,
    'document heading preferences must not be gated by unrelated group changes');

console.log(`settings runtime wiring contract tests passed (${handlerNames.size} handlers, ${assignedSettingKeys.size} stored keys)`);
