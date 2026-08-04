'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const settingsScreen = fs.readFileSync(path.join(root, 'src/task-horizon/main/settings/60-settings-screen.js'), 'utf8');
const settingsActions = fs.readFileSync(path.join(root, 'src/task-horizon/main/settings/62-settings-columns-and-rules.js'), 'utf8');
const docGroupActions = fs.readFileSync(path.join(root, 'src/task-horizon/main/settings/70-doc-group-and-settings-actions.js'), 'utf8');
const styles = fs.readFileSync(path.join(root, 'task-horizon.css'), 'utf8');

function extractFunction(source, name) {
    const start = source.indexOf(`function ${name}`);
    assert.notEqual(start, -1, `missing function ${name}`);
    const braceStart = source.indexOf('{', start);
    let depth = 0;
    for (let index = braceStart; index < source.length; index += 1) {
        if (source[index] === '{') depth += 1;
        if (source[index] === '}') depth -= 1;
        if (depth === 0) return source.slice(start, index + 1);
    }
    throw new Error(`unterminated function ${name}`);
}

const pickerFunctions = [
    '__tmNormalizeSettingsDocPickerText',
    '__tmSettingsDocPickerMatches',
    '__tmNormalizeSettingsDocPickerPath',
    '__tmBuildSettingsDocPickerTree'
].map((name) => extractFunction(settingsScreen, name)).join('\n');
const pickerContext = {};
vm.runInNewContext(`${pickerFunctions}\nthis.buildTree = __tmBuildSettingsDocPickerTree; this.matches = __tmSettingsDocPickerMatches;`, pickerContext);

const pickerTree = pickerContext.buildTree([
    { id: 'parent', notebook: 'box-a', name: 'Parent', path: '/Parent', sort: 1 },
    { id: 'child-b', notebook: 'box-a', name: 'Child B', alias: 'Beta', path: '/Parent/Child B', sort: 2 },
    { id: 'child-a', notebook: 'box-a', name: 'Child A', path: '/Parent/Child A', sort: 1 },
    { id: 'orphan', notebook: 'box-a', name: 'Orphan', path: '/Missing/Orphan', sort: 3 },
    { id: 'solo', notebook: 'box-b', name: 'Solo', path: '/Solo', sort: 1 }
], [
    { id: 'box-b', name: 'Notebook B' },
    { id: 'box-a', name: 'Notebook A' }
]);

assert.deepEqual(Array.from(pickerTree, (group) => group.id), ['box-b', 'box-a'], 'document picker must follow notebook order');
assert.deepEqual(Array.from(pickerTree[1].roots, (node) => node.id), ['parent', 'orphan'], 'missing parents must remain selectable roots');
assert.deepEqual(Array.from(pickerTree[1].roots[0].children, (node) => node.id), ['child-a', 'child-b'], 'document picker must nest and sort child documents');
assert.equal(pickerContext.matches('Child B Beta /Parent/Child B 20260101-doc', 'beta'), true, 'document picker search must include aliases');
assert.equal(pickerContext.matches('Child B Beta /Parent/Child B 20260101-doc', 'missing'), false, 'document picker search must reject unrelated text');

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
assert.match(settingsScreen, /<details class="tm-doc-group-manager__picker-notebook"/, 'document-group settings must group documents with native details');
assert.match(settingsScreen, /data-tm-doc-picker[\s\S]*?data-tm-doc-picker-checkbox/, 'document-group settings must render a searchable checkbox picker');
assert.doesNotMatch(settingsScreen, /data-tm-doc-picker-item\$\{depth === 0 \? ' open' : ''\}/, 'document branches must be collapsed by default');
assert.doesNotMatch(settingsScreen, /data-tm-doc-picker-notebook\$\{index === 0 \? ' open' : ''\}/, 'notebooks must be collapsed by default');
assert.match(settingsScreen, /data-tm-action="tmOpenSettingsDocPicker"[\s\S]*?<span>选择文档<\/span>/, 'document-group settings must open the picker from a compact trigger');
assert.match(settingsScreen, /data-tm-doc-picker-dialog hidden aria-hidden="true"[\s\S]*?role="dialog" aria-modal="true"/, 'document picker must render as a hidden modal dialog');
assert.doesNotMatch(settingsScreen, /id="manualDocId"/, 'document-group settings must no longer expose the manual ID field');
assert.match(docGroupActions, /window\.tmCloseSettingsDocPicker = function\(options = \{\}\)/, 'document picker modal must expose a close action');
assert.match(styles, /\.tm-doc-group-manager__picker-dialog\s*\{[^}]*z-index:\s*100;/, 'document picker modal must stay above settings sidebar layers');
assert.match(styles, /\.tm-doc-group-manager__add-button\s*\{[^}]*white-space:\s*nowrap;/, 'document picker add button label must not wrap');
assert.match(docGroupActions, /group\.docs\.push\(\{ id: docId, recursive: options\.recursive === true \}\)/, 'batch document adds must preserve recursive source semantics');
assert.match(docGroupActions, /SettingsStore\.updateDocIds\(nextIds\)/, 'all-documents picker adds must persist selectedDocIds in one batch');
assert.match(docGroupActions, /window\.addManualDoc = async function\(\)/, 'legacy manual document action must remain available');

console.log('document group order settings contract tests passed');
