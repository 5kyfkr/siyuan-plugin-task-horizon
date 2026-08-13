'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');
const hooks = read('src/task-horizon/main/shell/72-shell-entrances-and-native-doc-hooks.js');
const services = read('src/task-horizon/main/20-api-and-runtime-services.js');
const stores = read('src/task-horizon/main/10-stores-rules-and-cache.js');
const settingsScreen = read('src/task-horizon/main/settings/60-settings-screen.js');
const settings = read('src/task-horizon/main/settings/70-doc-group-and-settings-actions.js');
const lifecycle = read('src/task-horizon/main/shell/80-shell-lifecycle.js');
const css = read('task-horizon.css');

const segment = (source, start, end) => {
    const from = source.indexOf(start);
    assert.notEqual(from, -1, `missing segment start: ${start}`);
    const to = source.indexOf(end, from + start.length);
    assert.notEqual(to, -1, `missing segment end: ${end}`);
    return source.slice(from, to);
};

const focusRequest = segment(
    hooks,
    'function __tmRequestDocTitleMarkerFocus(controller)',
    'function __tmObserveDocTitleMarkerController',
);
assert.ok(
    focusRequest.indexOf('__tmDocHasTaskBlocks(docId)') < focusRequest.indexOf('API.getTasksByDocument'),
    'the marker must check for task blocks before querying focus duration',
);
assert.match(focusRequest, /__tmDocTitleMarkerFocusInFlight\.has\(docId\)/, 'focus loading must allow at most one in-flight request per document');
assert.ok(
    focusRequest.indexOf('if (isStale())') < focusRequest.indexOf('__tmDocHasTaskBlocks(docId)'),
    'stale focus work must stop before querying task data',
);
assert.match(focusRequest, /fullTree:\s*true/, 'focus duration must cover the complete document task tree');
assert.match(focusRequest, /customFieldIds:\s*\[\]/, 'focus duration must not load unrelated custom fields');

const membershipRequest = segment(
    hooks,
    'function __tmRequestDocTitleMarkerMembership(controller)',
    'function __tmRequestDocTitleMarkerFocus',
);
assert.match(membershipRequest, /__tmResolveDocTopbarTargetGroup\(docId\)/, 'managed scope must reuse the existing group resolver');
assert.match(membershipRequest, /__tmScheduleIdleTask/, 'managed scope resolution must not block document rendering');

const observerSource = segment(
    hooks,
    'function __tmObserveDocTitleMarkerController(controller, context)',
    'function __tmSyncDocTitleMarkerController',
);
assert.match(observerSource, /observe\(controller\.attr, \{ childList: true \}\)/, 'the observer must watch only direct title-attribute children');
assert.match(observerSource, /observe\(controller\.title, \{ attributes: true, attributeFilter: \['class'\] \}\)/, 'the observer must track native attribute visibility');
assert.doesNotMatch(observerSource, /subtree:\s*true/, 'the marker must not observe the full Protyle subtree');

const dirtySource = segment(
    hooks,
    'function __tmMarkDocTitleMarkersDirty(docIds = null, options = {})',
    'function __tmRemoveDocTitleMarker',
);
assert.match(dirtySource, /const clearDurationCache = opts\.duration === true/, 'only duration configuration changes may clear the displayed focus cache');
assert.match(dirtySource, /if \(clearDurationCache\) __tmDocTitleMarkerFocusCache\.clear\(\)/, 'global task refreshes must preserve the displayed focus duration');
assert.match(dirtySource, /if \(clearDurationCache\) __tmDocTitleMarkerFocusCache\.delete\(docId\)/, 'document task refreshes must preserve the displayed focus duration');

const markerSync = segment(
    hooks,
    'function __tmSyncDocTitleMarkerController(controller)',
    'function __tmScheduleDocTitleMarkerSync',
);
const durationDisplay = segment(markerSync, 'const durationText =', '__tmRenderDocTitleMarker');
assert.match(durationDisplay, /focus\?\.signature === focusSignature/, 'cached duration must remain visible while compatible task data refreshes');
assert.doesNotMatch(durationDisplay, /focus\?\.(?:epoch|revision)/, 'task revisions must not temporarily hide a compatible cached duration');

const markerRender = segment(
    hooks,
    'function __tmRenderDocTitleMarker(controller, target, durationText = \'\')',
    'function __tmRequestDocTitleMarkerMembership',
);
assert.match(markerRender, /iconTaskHorizon/, 'the marker must use the Task Horizon icon');
assert.match(markerRender, /tm-doc-title-marker__group/, 'the marker must show the managed group name');
assert.match(markerRender, /tm-doc-title-marker__duration/, 'the marker must support optional focus duration');
assert.match(markerRender, /groupId === 'all'[\s\S]*?groupEl\.hidden = !groupName/, 'documents only in All Documents must hide the group label');
assert.match(markerRender, /separatorEl\.hidden = !groupName \|\| !duration/, 'icon-only markers must not leave a separator before focus duration');
assert.match(markerRender, /requireTasks:\s*false/, 'marker clicks must work for managed documents without tasks');
assert.match(markerRender, /forceLocate:\s*true/, 'marker clicks must locate the managed document group');

assert.match(services, /async function __tmTryApplyDocTopbarManagerTarget\(options = \{\}\)/, 'the existing locator must accept marker options');
assert.match(services, /if \(!openAll && opts\.requireTasks !== false\)/, 'the existing breadcrumb must retain its default task guard outside the embedded All Documents path');
const targetResolver = segment(
    services,
    'async function __tmResolveDocTopbarTargetGroup(docId)',
    'async function __tmTryApplyDocTopbarManagerTarget',
);
assert.match(targetResolver, /SettingsStore\.data\.selectedDocIds/, 'All Documents membership must reuse the configured selected document scope');
assert.match(targetResolver, /return \{ groupId: 'all', group: null, matchedBy: 'selected' \}/, 'documents only in All Documents must resolve to the icon-only target');
assert.match(stores, /__tmMarkDocTitleMarkersDirty\?\.\(\[did\], \{ tasks: true \}\)/, 'task cache invalidation must refresh the matching document marker');
assert.match(stores, /__tmMarkDocTitleMarkersDirty\?\.\(null, \{ scope: true \}\)/, 'scope cache invalidation must refresh marker membership');
assert.match(settings, /updateEnableTomatoIntegration[\s\S]*__tmMarkDocTitleMarkersDirty\?\.\(null, \{ duration: true \}\)/, 'tomato setting changes must refresh marker duration');
assert.match(lifecycle, /__tmBindDocTitleMarkers\(\)/, 'marker lifecycle must be initialized after settings load');
assert.match(lifecycle, /__tmDestroyDocTitleMarkers\(\)/, 'marker lifecycle must be cleaned up on unload');

assert.match(css, /\.tm-doc-title-marker__group[\s\S]*text-overflow:\s*ellipsis/, 'long group names must be truncated safely');
assert.match(css, /\.tm-doc-title-marker__group\[hidden\],[\s\S]*display:\s*none/, 'the All Documents marker must not reserve group-label space');
assert.match(css, /\.tm-doc-title-attr--plugin-only\s*>\s*div/, 'native attribute divs must be hidden when native attributes are disabled');
assert.doesNotMatch(css, /\.tm-doc-title-attr--plugin-only\s*>\s*:\s*not/, 'plugin-only mode must not hide other plugins\' non-div controls');

assert.match(stores, /docTitleEmbeddedTaskFocusEnabled:\s*false/, 'embedded task focus aggregation must default to disabled');
assert.match(stores, /Storage\.get\('tm_doc_title_embedded_task_focus_enabled'/, 'the embedded aggregation preference must load from local storage');
assert.match(stores, /Storage\.set\('tm_doc_title_embedded_task_focus_enabled'/, 'the embedded aggregation preference must persist locally');
assert.match(stores, /cloudData\.docTitleEmbeddedTaskFocusEnabled/, 'the embedded aggregation preference must restore from synced settings');
assert.match(settingsScreen, /统计嵌入待办专注时长/, 'the topbar settings screen must expose the embedded aggregation switch');
assert.match(settingsScreen, /任务管理器范围内的待办通过嵌入块显示在其他文档中时，也会在该文档右上角汇总显示专注时长/, 'the switch description must explain the source tasks, embed destination, and document-level result');
assert.match(settingsScreen, /docTitleEmbeddedTaskFocusEnabled[\s\S]*enableTomatoIntegration[\s\S]*updateDocTitleEmbeddedTaskFocusEnabled/, 'the switch must depend on tomato integration and bind its settings action');
assert.match(settings, /updateDocTitleEmbeddedTaskFocusEnabled[\s\S]*\{ scope: true, duration: true \}/, 'changing the switch must fully reevaluate open document markers');

const batchTaskRead = segment(
    services,
    'async getTasksByIds(ids)',
    'async getTaskById(id)',
);
assert.match(batchTaskRead, /const chunkSize = 300/, 'embedded task lookup must split large ID lists into bounded batches');
assert.match(batchTaskRead, /task\.id IN \(\$\{idList\}\)/, 'embedded task lookup must query all IDs in each batch');
assert.match(batchTaskRead, /task\.type = 'i'[\s\S]*task\.subtype = 't'/, 'embedded block candidates must be filtered to actual task blocks by SQL');
assert.match(batchTaskRead, /__tmApplyTaskAttrHostOverrides\(rows\)/, 'embedded duration lookup must honor stable task attribute hosts');
assert.doesNotMatch(batchTaskRead, /getTaskById\(/, 'embedded task lookup must not issue one query per task');

const embeddedGate = segment(
    hooks,
    'function __tmIsDocTitleEmbeddedTaskFocusEnabled()',
    'function __tmCollectDocTitleEmbeddedBlockIds',
);
assert.match(embeddedGate, /enableTomatoIntegration[\s\S]*docTitleEmbeddedTaskFocusEnabled/, 'embedded aggregation must require both feature switches');

const embeddedCollector = segment(
    hooks,
    'function __tmCollectDocTitleEmbeddedBlockIds(controller)',
    'function __tmDoesDocTitleEmbedMutationAffectResults',
);
assert.match(embeddedCollector, /NodeBlockQueryEmbed/, 'embedded aggregation must inspect rendered query embed blocks only');
assert.match(embeddedCollector, /protyle-wysiwyg__embed/, 'embedded aggregation must use rendered embed results');
assert.match(embeddedCollector, /data-node-id/, 'embedded aggregation must collect real rendered block IDs');
assert.match(embeddedCollector, /new Set\(\)/, 'rendered block IDs must be deduplicated');

const embeddedObserver = segment(
    hooks,
    'function __tmObserveDocTitleEmbeddedTasks(controller, context)',
    'function __tmPrepareDocTitleEmbeddedCandidates',
);
assert.match(embeddedObserver, /__tmIsDocTitleEmbeddedTaskFocusEnabled\(\)/, 'the embed observer must be gated before it is attached');
assert.match(embeddedObserver, /__tmDoesDocTitleEmbedMutationAffectResults\(records\)/, 'ordinary document mutations must be ignored');
assert.match(embeddedObserver, /250/, 'embed result changes must be debounced');
assert.match(embeddedObserver, /\{ childList: true, subtree: true \}/, 'the separate embed observer must see asynchronously rendered results');

const embeddedRequest = segment(
    hooks,
    'function __tmRequestDocTitleEmbeddedFocus(controller, candidateTaskIds = null)',
    'function __tmObserveDocTitleMarkerController',
);
assert.match(embeddedRequest, /API\.getTasksByIds\(taskIds\)/, 'embedded aggregation must use the batch task API');
assert.match(embeddedRequest, /resolveDocIdsFromGroups\(\{ groupId: 'all', includeQuickAddDoc: true \}\)/, 'embedded tasks must be filtered through the complete managed document scope');
assert.match(embeddedRequest, /managedSet\.has\(sourceDocId\)/, 'out-of-scope embedded tasks must be excluded');
assert.match(embeddedRequest, /__tmFormatDocTitleFocusDuration\(managedTasks, mode\)/, 'qualifying embedded tasks must reuse the existing duration formatter');

assert.match(markerSync, /if \(!target\?\.groupId\)[\s\S]*__tmObserveDocTitleEmbeddedTasks\(controller, context\)/, 'only unmanaged host documents may enter embedded aggregation');
assert.match(markerSync, /__tmResetDocTitleEmbeddedFocusController\(controller\)[\s\S]*__tmDocTitleMarkerFocusCache/, 'managed host documents must retain their existing focus aggregation path');
assert.match(markerRender, /openAll:\s*marker\?\.dataset\?\.embeddedOnly === '1'/, 'embedded-only markers must open All Documents');
assert.match(services, /const openAll = opts\.openAll === true[\s\S]*groupId: 'all'[\s\S]*matchedBy: 'embedded'/, 'the document marker locator must support the embedded All Documents target');

const formatterSource = segment(
    hooks,
    'function __tmFormatDocTitleFocusDuration(tasks, mode = \'minutes\')',
    'function __tmRefreshDocTitleMarkerControllers',
);
const formatterContext = {
    __tmParseNumber: Number,
    __tmGetTaskTomatoFocusValues(task) {
        return {
            tomatoMinutes: Number(task?.tomatoMinutes ?? task?.tomato_minutes) || 0,
            tomatoHours: Number(task?.tomatoHours ?? task?.tomato_hours) || 0,
            tomatoCount: Number(task?.tomatoCount ?? task?.tomato_count) || 0,
        };
    },
    __tmFormatSpentHours(value) {
        if (!(value > 0)) return '';
        return `${Math.round(value * 100) / 100}h`;
    },
    __tmFormatSpentMinutes(value) {
        if (!(value > 0)) return '';
        const total = Math.round(value);
        const hours = Math.floor(total / 60);
        const minutes = total % 60;
        if (hours && minutes) return `${hours}h${minutes}m`;
        if (hours) return `${hours}h`;
        return `${minutes}m`;
    },
};
vm.createContext(formatterContext);
vm.runInContext(`${formatterSource}\nthis.formatDuration = __tmFormatDocTitleFocusDuration;`, formatterContext);
assert.equal(formatterContext.formatDuration([
    { tomatoMinutes: '35' },
    { tomato_minutes: '45' },
    { tomatoMinutes: '0' },
], 'minutes'), '1h20m');
assert.equal(formatterContext.formatDuration([
    { tomatoHours: '1.25' },
    { tomato_hours: '0.5' },
], 'hours'), '1.75h');
assert.equal(formatterContext.formatDuration([], 'minutes'), '', 'documents without focus data must omit duration text');

console.log('document title task marker contract tests passed');
