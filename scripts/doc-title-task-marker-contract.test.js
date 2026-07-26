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

const markerRender = segment(
    hooks,
    'function __tmRenderDocTitleMarker(controller, target, durationText = \'\')',
    'function __tmRequestDocTitleMarkerMembership',
);
assert.match(markerRender, /iconTaskHorizon/, 'the marker must use the Task Horizon icon');
assert.match(markerRender, /tm-doc-title-marker__group/, 'the marker must show the managed group name');
assert.match(markerRender, /tm-doc-title-marker__duration/, 'the marker must support optional focus duration');
assert.match(markerRender, /requireTasks:\s*false/, 'marker clicks must work for managed documents without tasks');
assert.match(markerRender, /forceLocate:\s*true/, 'marker clicks must locate the managed document group');

assert.match(services, /async function __tmTryApplyDocTopbarManagerTarget\(options = \{\}\)/, 'the existing locator must accept marker options');
assert.match(services, /if \(opts\.requireTasks !== false\)/, 'the existing breadcrumb must retain its default task guard');
assert.match(stores, /__tmMarkDocTitleMarkersDirty\?\.\(\[did\], \{ tasks: true \}\)/, 'task cache invalidation must refresh the matching document marker');
assert.match(stores, /__tmMarkDocTitleMarkersDirty\?\.\(null, \{ scope: true \}\)/, 'scope cache invalidation must refresh marker membership');
assert.match(settings, /updateEnableTomatoIntegration[\s\S]*__tmMarkDocTitleMarkersDirty\?\.\(null, \{ duration: true \}\)/, 'tomato setting changes must refresh marker duration');
assert.match(lifecycle, /__tmBindDocTitleMarkers\(\)/, 'marker lifecycle must be initialized after settings load');
assert.match(lifecycle, /__tmDestroyDocTitleMarkers\(\)/, 'marker lifecycle must be cleaned up on unload');

assert.match(css, /\.tm-doc-title-marker__group[\s\S]*text-overflow:\s*ellipsis/, 'long group names must be truncated safely');
assert.match(css, /\.tm-doc-title-attr--plugin-only\s*>\s*div/, 'native attribute divs must be hidden when native attributes are disabled');
assert.doesNotMatch(css, /\.tm-doc-title-attr--plugin-only\s*>\s*:\s*not/, 'plugin-only mode must not hide other plugins\' non-div controls');

const formatterSource = segment(
    hooks,
    'function __tmFormatDocTitleFocusDuration(tasks, mode = \'minutes\')',
    'function __tmRefreshDocTitleMarkerControllers',
);
const formatterContext = {
    __tmParseNumber: Number,
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
