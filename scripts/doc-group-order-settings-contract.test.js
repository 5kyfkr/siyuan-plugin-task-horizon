'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const settingsScreen = fs.readFileSync(path.join(root, 'src/task-horizon/main/settings/60-settings-screen.js'), 'utf8');
const settingsActions = fs.readFileSync(path.join(root, 'src/task-horizon/main/settings/62-settings-columns-and-rules.js'), 'utf8');

assert.match(
    settingsScreen,
    /data-tm-call="tmMoveCurrentDocGroup" data-tm-args='\$\{esc\(JSON\.stringify\(\[-1\]\)\)\}'[\s\S]*?currentGroupIndex > 0 \? '' : ' disabled'/,
    'document-group settings must expose an up action disabled at the first group'
);
assert.match(
    settingsScreen,
    /data-tm-call="tmMoveCurrentDocGroup" data-tm-args='\$\{esc\(JSON\.stringify\(\[1\]\)\)\}'[\s\S]*?currentGroupIndex < groups\.length - 1 \? '' : ' disabled'/,
    'document-group settings must expose a down action disabled at the last group'
);
assert.match(
    settingsActions,
    /window\.tmMoveCurrentDocGroup = async function\(direction\)[\s\S]*?const targetIndex = currentIndex \+ \(Number\(direction\) < 0 \? -1 : 1\);[\s\S]*?const nextGroups = groups\.slice\(\);[\s\S]*?\[nextGroups\[currentIndex\], nextGroups\[targetIndex\]\] = \[nextGroups\[targetIndex\], nextGroups\[currentIndex\]\];[\s\S]*?await SettingsStore\.updateDocGroups\(nextGroups\);/,
    'document-group sorting must swap adjacent groups and persist through updateDocGroups'
);

console.log('document group order settings contract tests passed');
