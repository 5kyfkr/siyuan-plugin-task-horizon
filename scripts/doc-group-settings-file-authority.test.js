'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const storeSource = fs.readFileSync(path.join(root, 'src/task-horizon/main/10-stores-rules-and-cache.js'), 'utf8');
const syncSource = fs.readFileSync(path.join(root, 'src/task-horizon/main/render/39-render-doc-group-sync-and-refresh.js'), 'utf8');

assert.match(storeSource,
    /applySharedDocGroupSettings\(source\) \{[\s\S]*__tmApplyDocGroupSyncSnapshot\(source, \{ targetData: this\.data, syncOverallUpdatedAt: false \}\)[\s\S]*refreshDocGroupSyncState/,
    'shared document groups must be copied from the authoritative settings snapshot');
assert.match(syncSource,
    /remoteFingerprint && remoteFingerprint !== currentFingerprint[\s\S]*__tmApplyDocGroupSyncSnapshot\(remoteSettings, \{[\s\S]*targetData: SettingsStore\.data,[\s\S]*syncOverallUpdatedAt: false/,
    'document group refresh must copy the synchronized file instead of merging field clocks');
assert.doesNotMatch(syncSource,
    /__tmApplySettingsFieldUpdatesByMap|settingsFieldUpdatedAt/,
    'document group refresh must not contain a second field-level merge path');

console.log('document group settings file authority tests passed');
