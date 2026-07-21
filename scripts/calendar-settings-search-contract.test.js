const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const settingsSource = fs.readFileSync(
    path.join(root, 'src/task-horizon/main/settings/60-settings-screen.js'),
    'utf8',
);
const calendarSource = fs.readFileSync(path.join(root, 'calendar-view.js'), 'utf8');

const registryMatch = settingsSource.match(
    /const TM_SETTINGS_SEARCH_CALENDAR_TITLES = Object\.freeze\(\[([\s\S]*?)\]\);/,
);
assert.ok(registryMatch, 'calendar settings search title registry must exist');

const indexedTitles = Array.from(registryMatch[1].matchAll(/'([^']+)'/g), (match) => match[1]);
assert.ok(indexedTitles.length > 0, 'calendar settings search title registry must not be empty');

const renderStart = calendarSource.indexOf('function renderSettings(');
const renderEnd = calendarSource.indexOf('\n    function cleanup()', renderStart);
assert.ok(renderStart >= 0 && renderEnd > renderStart, 'calendar settings renderer must be discoverable');

const renderSource = calendarSource.slice(renderStart, renderEnd);
const renderedTitles = Array.from(
    renderSource.matchAll(/<div class="tm-calendar-settings-label"[^>]*>\s*([^<]+?)\s*(?=<)/g),
    (match) => match[1].replace(/\s+/g, ' ').trim(),
);
assert.ok(renderedTitles.length > 0, 'calendar settings renderer must expose labeled rows');
assert.deepEqual(
    [...new Set(indexedTitles)].sort(),
    [...new Set(renderedTitles)].sort(),
    'every rendered calendar setting row must be available to cross-tab settings search',
);

assert.match(
    settingsSource,
    /TM_SETTINGS_SEARCH_CALENDAR_TITLES\.forEach\(\(title\) => \{[\s\S]*?tab: 'calendar'/,
    'calendar setting titles must be added to the static search index',
);
assert.match(
    settingsSource,
    /function __tmDecorateCalendarSettingsSearchRows\(root\)[\s\S]*?row\.dataset\.tmSettingsSearchKey[\s\S]*?row\.dataset\.tmSettingsSearchTitle/,
    'rendered calendar rows must receive searchable target metadata',
);
assert.match(
    settingsSource,
    /__tmDecorateCalendarSettingsSearchRows\(state\.settingsModal\);\s*__tmCollectRenderedSettingsSearchEntries/,
    'calendar row metadata must be refreshed before collecting rendered settings',
);
assert.match(
    settingsSource,
    /targetTab === 'calendar'[\s\S]*?!root\.querySelector\('\.tm-calendar-settings-row'\)[\s\S]*?return null;/,
    'calendar search focus must wait for the dynamic settings rows to render',
);

console.log('calendar settings search contract tests passed');
