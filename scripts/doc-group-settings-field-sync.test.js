'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');

const root = path.resolve(__dirname, '..');
const storeSource = fs.readFileSync(path.join(root, 'src/task-horizon/main/10-stores-rules-and-cache.js'), 'utf8').replace(/\r\n/g, '\n');
const slice = (source, startText, endText) => {
    const start = source.indexOf(startText);
    const end = source.indexOf(endText, start + startText.length);
    assert.ok(start >= 0 && end > start, startText);
    return source.slice(start, end);
};

function createHarness() {
    const context = vm.createContext({
        JSON, Math, Map, Set, Number, String, Object, Array,
        __tmCloneJsonSafe: value => JSON.parse(JSON.stringify(value)),
        __tmParseUpdatedAtNumber: value => Number(value) || 0,
    });
    vm.runInContext(slice(storeSource,
        '    const __TM_DOC_GROUP_SETTINGS_KEYS',
        '    function __tmNormalizeWhiteboardLinkArray('), context);
    vm.runInContext(`Object.assign(globalThis, {
        markChanged: __tmMarkChangedSettingsFields,
        applyFields: __tmApplySettingsFieldUpdatesByMap,
        buildFieldSnapshot: __tmBuildSettingsFieldSyncSnapshot,
        normalizeMap: __tmNormalizeSettingsFieldUpdatedAtMap,
    });`, context);
    return context;
}

function settings(groups, { settingsAt, groupAt, groupFieldAt = groupAt }) {
    return {
        settingsUpdatedAt: settingsAt,
        docGroupSettingsUpdatedAt: groupAt,
        settingsFieldUpdatedAt: { docGroups: groupFieldAt },
        docGroups: groups.map(group => ({ id: group.id, name: group.name, docs: [] })),
        selectedDocIds: [],
        defaultDocId: '',
        defaultDocIdByGroup: {},
        showCompletedTasksByGroup: {},
        allDocsExcludedDocIds: [],
        docTabCustomGroups: [],
        otherBlockRefs: [],
        docPinnedByGroup: {},
        docTabsManualArchivedByGroup: {},
        docTabsManualUnarchivedByGroup: {},
    };
}

test('a newer group field applies even when the other device has a newer overall settings timestamp', () => {
    const h = createHarness();
    const local = settings([{ id: 'daily', name: 'Daily' }], { settingsAt: 3000, groupAt: 100 });
    const remote = settings([
        { id: 'daily', name: 'Renamed' },
        { id: 'new', name: 'New group' },
    ], { settingsAt: 2500, groupAt: 200 });

    const applied = h.applyFields(local, remote);

    assert.deepEqual(Array.from(applied), ['docGroups']);
    assert.deepEqual(local.docGroups.map(group => group.name), ['Renamed', 'New group']);
    assert.equal(local.settingsFieldUpdatedAt.docGroups, 200);
});

test('an old group field cannot overwrite newer groups just because its overall settings timestamp advanced', () => {
    const h = createHarness();
    const local = settings([{ id: 'daily', name: 'Renamed' }, { id: 'new', name: 'New group' }], { settingsAt: 2000, groupAt: 200 });
    const remote = settings([{ id: 'daily', name: 'Daily' }], { settingsAt: 9000, groupAt: 100 });

    const applied = h.applyFields(local, remote);

    assert.deepEqual(Array.from(applied), []);
    assert.deepEqual(local.docGroups.map(group => group.name), ['Renamed', 'New group']);
    assert.equal(local.settingsFieldUpdatedAt.docGroups, 200);
});

test('adding or renaming a group marks the actual docGroups setting as changed', () => {
    const h = createHarness();
    const baseline = settings([{ id: 'daily', name: 'Daily' }], { settingsAt: 100, groupAt: 100 });
    const local = settings([
        { id: 'daily', name: 'Renamed' },
        { id: 'new', name: 'New group' },
    ], { settingsAt: 100, groupAt: 100 });

    const result = h.markChanged(local, h.buildFieldSnapshot(baseline), 300);

    assert.deepEqual(Array.from(result.changedKeys), ['docGroups']);
    assert.equal(local.settingsFieldUpdatedAt.docGroups, 300);
});

test('legacy group clocks are ignored instead of being promoted into normal setting clocks', () => {
    const h = createHarness();
    const local = {
        ...settings([{ id: 'daily', name: 'Daily' }], { settingsAt: 9000, groupAt: 8000 }),
        settingsFieldUpdatedAt: { currentRule: 7000, docGroupSyncState: 9000 },
    };
    const remote = {
        ...settings([{ id: 'daily', name: 'Renamed' }], { settingsAt: 200, groupAt: 150 }),
    };

    const applied = h.applyFields(local, remote);

    assert.deepEqual(Array.from(applied), ['docGroups']);
    assert.equal(Object.hasOwn(local.settingsFieldUpdatedAt, 'docGroupSyncState'), false);
    assert.equal(local.settingsFieldUpdatedAt.docGroups, 150);
    assert.equal(local.docGroups[0].name, 'Renamed');
});

test('deleting every group synchronizes an empty array and a later ordinary setting save cannot resurrect it', () => {
    const h = createHarness();
    const old = settings([{ id: 'daily', name: 'Daily' }], { settingsAt: 100, groupAt: 100 });
    const deleted = settings([], { settingsAt: 200, groupAt: 200 });
    const result = h.markChanged(deleted, h.buildFieldSnapshot(old), 300);
    assert.deepEqual(Array.from(result.changedKeys), ['docGroups']);
    h.applyFields(old, deleted);
    assert.deepEqual(Array.from(old.docGroups), []);
    const stale = settings([{ id: 'daily', name: 'Daily' }], { settingsAt: 9000, groupAt: 100 });
    stale.settingsFieldUpdatedAt.currentRule = 9000;
    stale.currentRule = 'changed-filter';
    h.applyFields(old, stale);
    assert.deepEqual(Array.from(old.docGroups), []);
    assert.equal(old.currentRule, 'changed-filter');
});
