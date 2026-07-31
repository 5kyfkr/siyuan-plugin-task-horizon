'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const index = fs.readFileSync(path.join(root, 'index.js'), 'utf8');
const shellEntrances = fs.readFileSync(path.join(root, 'src/task-horizon/main/shell/72-shell-entrances-and-native-doc-hooks.js'), 'utf8');

const taskId = index.match(/const WINDOW_TOPBAR_ELEMENT_ID = "([^"]+)";/)?.[1];
const calendarId = index.match(/const CALENDAR_SUBSCRIPTION_TOPBAR_ELEMENT_ID = "([^"]+)";/)?.[1];
assert.ok(taskId, 'task manager topbar must define a stable element ID');
assert.ok(calendarId, 'calendar subscription topbar must define a stable element ID');
assert.notEqual(taskId, calendarId, 'task manager and calendar subscription topbars must not share an ID');

const identityStart = index.indexOf('applyStableTopBarIdentity(element, stableId)');
const identityEnd = index.indexOf('\n    applyEntryIconPreset', identityStart);
const identityBlock = index.slice(identityStart, identityEnd);
assert.match(identityBlock, /element\.id = stableId/, 'stable identity must replace SiYuan positional topbar IDs');
assert.match(identityBlock, /SIYUAN_UNPINNED_TOPBAR_STORAGE_KEY[\s\S]*ids\.includes\(stableId\)/, 'native unpin state must be read by stable ID');
assert.match(identityBlock, /classList\.toggle\("fn__none", unpinned\)/, 'desktop visibility must be reapplied after replacing the positional ID');
assert.match(identityBlock, /#menuConfigAbout[\s\S]*after\(element\)/, 'mobile visibility must recover when a legacy positional ID blocked insertion');

const taskMarkStart = index.indexOf('markWindowTopBarElement(element)');
const taskMarkEnd = index.indexOf('\n    removeWindowTopBarElement', taskMarkStart);
assert.match(index.slice(taskMarkStart, taskMarkEnd), /applyStableTopBarIdentity\(element, WINDOW_TOPBAR_ELEMENT_ID\)/, 'task manager topbar must apply its stable ID');
const calendarMarkStart = index.indexOf('markCalendarSubscriptionTopBarElement(element)');
const calendarMarkEnd = index.indexOf('\n    removeCalendarSubscriptionTopBar', calendarMarkStart);
assert.match(index.slice(calendarMarkStart, calendarMarkEnd), /applyStableTopBarIdentity\(element, CALENDAR_SUBSCRIPTION_TOPBAR_ELEMENT_ID\)/, 'calendar subscription topbar must apply its stable ID');
assert.match(shellEntrances, /__tmMarkManagedTopBarEntry[\s\S]*__taskHorizonApplyWindowTopBarIdentity\?\.\(el\)/, 'mobile task manager registration must reuse the stable ID path');

console.log('topbar stable identity contract tests passed');
