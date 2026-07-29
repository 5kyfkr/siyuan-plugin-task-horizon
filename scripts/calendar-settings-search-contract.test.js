const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const settingsSource = fs.readFileSync(
    path.join(root, 'src/task-horizon/main/settings/60-settings-screen.js'),
    'utf8',
);
const calendarSource = fs.readFileSync(path.join(root, 'calendar-view.js'), 'utf8');

const renderStart = calendarSource.indexOf('function renderSettings(');
const renderEnd = calendarSource.indexOf('\n    function cleanup()', renderStart);
assert.ok(renderStart >= 0 && renderEnd > renderStart, 'calendar settings renderer must be discoverable');

const renderSource = calendarSource.slice(renderStart, renderEnd);
const renderedTitles = Array.from(
    renderSource.matchAll(/<div class="tm-calendar-settings-label"[^>]*>\s*([^<]+?)\s*(?=<)/g),
    (match) => match[1].replace(/\s+/g, ' ').trim(),
);
assert.ok(renderedTitles.length > 0, 'calendar settings renderer must expose labeled rows');
assert.ok(renderedTitles.length >= 20, 'calendar settings renderer must expose its complete settings surface');

assert.doesNotMatch(
    settingsSource,
    /TM_SETTINGS_SEARCH_(?:PAGE_ITEMS|MAIN_GROUPS|CALENDAR_TITLES)|__tmGetSettingsSearchStaticEntries/,
    'cross-tab settings search must not depend on manually maintained title registries',
);
assert.match(
    settingsSource,
    /TM_SETTINGS_SEARCH_INDEX_TABS[\s\S]*?renderSettingsModalMarkup\(\)[\s\S]*?state\.settingsSearchGeneratedEntries/,
    'settings search must build its cross-tab index from the real settings renderer',
);
assert.match(
    calendarSource,
    /function renderSettings\(containerEl, settingsStore, options = \{\}\)[\s\S]*?const indexOnly = options\?\.indexOnly === true[\s\S]*?if \(indexOnly\) return true;[\s\S]*?state\.settingsAbort\?\.abort\(\)/,
    'calendar settings must support an index-only render that exits before event binding and runtime side effects',
);
assert.match(
    settingsSource,
    /calendarRenderer\(calendarProbe, SettingsStore, \{ indexOnly: true \}\);[\s\S]*?__tmDecorateCalendarSettingsSearchRows\(calendarProbe\);[\s\S]*?__tmCollectRenderedSettingsSearchEntries\(calendarProbe\)/,
    'calendar search entries must be collected from the index-only rendered rows',
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
