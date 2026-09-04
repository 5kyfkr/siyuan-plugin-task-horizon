'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(
    path.join(root, 'src/task-horizon/main/40-render-runtime.js'),
    'utf8'
);
const start = source.indexOf('async function __tmSetDocManualArchivedForGroup');
const end = source.indexOf('function __tmNormalizeOtherBlockRefs', start);
assert.ok(start >= 0 && end > start, 'manual archive helpers must remain extractable');
const helpers = source.slice(start, end);

function buildRuntime({ archiveMode, activeDocId, manualArchivedByGroup = {}, manualUnarchivedByGroup = {} }) {
    const context = {
        state: { docTabsArchiveMode: archiveMode, activeDocId },
        SettingsStore: {
            data: {
                currentGroupId: 'all',
                docTabsManualArchivedByGroup: manualArchivedByGroup,
                docTabsManualUnarchivedByGroup: manualUnarchivedByGroup,
            },
            save: async () => {},
        },
        __tmNormalizeDocTabsManualArchivedByGroup: (value) => value && typeof value === 'object' ? value : {},
        __tmNormalizeDocGroupExcludedDocIds: (value) => Array.from(new Set(value || [])).filter(Boolean),
        __tmClearDocManualArchivedInGroups: () => {},
        __tmClearDocManualUnarchivedInGroups: () => {},
        __tmResetArchiveCompletedRootGroupCollapse: () => {},
        __tmApplyCurrentContextViewProfile: async () => {},
        __tmRecomputeTaskProjection: () => {},
        render: () => {},
        window: {},
    };
    vm.runInNewContext(`${helpers}\nthis.archive = __tmSetDocManualArchivedForGroup;\nthis.unarchive = __tmSetDocManualUnarchivedForGroup;`, context);
    return context;
}

assert.doesNotMatch(helpers, /state\.docTabsArchiveMode\s*=(?!=)/, 'manual tab mutations must not switch archive mode');

(async () => {
    const activeArchive = buildRuntime({ archiveMode: false, activeDocId: 'doc-a' });
    await activeArchive.archive('doc-a', true, 'all');
    assert.equal(activeArchive.state.docTabsArchiveMode, false, 'archiving a tab must keep normal mode');
    assert.equal(activeArchive.state.activeDocId, 'all', 'archiving the active tab must release the hidden tab');

    const archiveModeArchive = buildRuntime({ archiveMode: true, activeDocId: 'doc-a' });
    await archiveModeArchive.archive('doc-a', true, 'all');
    assert.equal(archiveModeArchive.state.docTabsArchiveMode, true, 'archiving in archive mode must keep archive mode');
    assert.equal(archiveModeArchive.state.activeDocId, 'doc-a', 'a tab that remains in the archive must stay active');

    const archiveView = buildRuntime({ archiveMode: true, activeDocId: 'doc-a' });
    await archiveView.unarchive('doc-a', true, 'all');
    assert.equal(archiveView.state.docTabsArchiveMode, true, 'moving a tab out must keep archive mode');
    assert.equal(archiveView.state.activeDocId, 'all', 'moving the active archived tab out must select all archived tabs');

    const clearOverride = buildRuntime({
        archiveMode: false,
        activeDocId: 'doc-a',
        manualUnarchivedByGroup: { all: ['doc-a'] },
    });
    await clearOverride.unarchive('doc-a', false, 'all');
    assert.equal(clearOverride.state.docTabsArchiveMode, false, 'clearing an unarchive override must keep normal mode');
    assert.equal(clearOverride.state.activeDocId, 'all', 'clearing an unarchive override must release a tab that returns to the archive');

    console.log('manual document-tab archive mode contract tests passed');
})().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
