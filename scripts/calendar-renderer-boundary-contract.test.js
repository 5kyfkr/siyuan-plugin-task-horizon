const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'calendar-view.js'), 'utf8');
const index = fs.readFileSync(path.join(root, 'index.js'), 'utf8');
const calendarCss = fs.readFileSync(path.join(root, 'calendar-view.css'), 'utf8');
const formaTheme = fs.readFileSync(path.join(root, 'src/fullcalendar/themes/forma/global.js'), 'utf8');
const stateIndex = source.indexOf('    const state = {');
assert.ok(stateIndex > 0, 'calendar state boundary must remain discoverable');

const businessSource = source.slice(stateIndex);
const rawCalendarApiPattern = /\b(?:calendar|cal|targetCalendar|mainCalendar|sideCalendar|calendarForRoot|state\.calendar|state\.sideDay\.calendar)\??\.(?:view|changeView|gotoDate|refetchEvents|setOption|rerenderEvents|getDate|getOption|getEvents|getEventById|getEventSourceById|addEvent|batchRendering|updateSize|destroy)\b/g;
assert.deepEqual(
    businessSource.match(rawCalendarApiPattern) || [],
    [],
    'business calendar code must use Calendar Renderer Adapter helpers instead of raw FullCalendar APIs',
);

assert.match(source, /function createFullCalendarAdapter\(/, 'FullCalendar renderer adapter must exist');
assert.match(source, /function getCalendarView\(/, 'calendar view reads must have an adapter helper');
assert.match(source, /function callCalendarAdapter\(/, 'calendar commands must have an adapter helper');
assert.equal((source.match(/locale: CALENDAR_ZH_CN_LOCALE/g) || []).length, 2, 'main and side calendars must share the inline locale');
assert.doesNotMatch(index, /locales-all|FULLCALENDAR_LOCALES/, 'all-locale asset must stay out of the runtime loader');
assert.doesNotMatch(index, /CALENDAR_KERNEL_SCRIPT_PATH|calendar-kernel\.js|__tmCreateCalendarKernel/, 'calendar kernel must not be loaded or exposed as a separate asset');
assert.match(index, /async loadTaskHorizonCalendarAssets\(\)/, 'calendar assets must have a dedicated loader');
const commonLoaderStart = index.indexOf('async loadTaskHorizonPostMainAssets()');
const calendarLoaderStart = index.indexOf('async loadTaskHorizonCalendarAssets()');
assert.ok(commonLoaderStart >= 0 && calendarLoaderStart > commonLoaderStart, 'common and calendar loaders must be ordered');
const commonLoader = index.slice(commonLoaderStart, calendarLoaderStart);
assert.doesNotMatch(commonLoader, /FULLCALENDAR_|CALENDAR_KERNEL_SCRIPT_PATH|CALENDAR_VIEW_SCRIPT_PATH|CALENDAR_SUBSCRIPTION_CORE_SCRIPT_PATH/, 'shared asset loader must keep calendar loading isolated');
assert.match(index, /__taskHorizonEnsureCalendarAssets\s*=\s*\(\)\s*=>\s*this\.loadTaskHorizonCalendarAssets\(\)/, 'runtime must expose one shared calendar asset loader');
assert.match(index, /async activateTaskMainRuntime\([\s\S]*?await this\.loadTaskHorizonPostMainAssets\(\);[\s\S]*?await this\.loadTaskHorizonCalendarAssets\(\);/, 'main runtime activation must eagerly preload calendar assets');
const viewSwitching = fs.readFileSync(path.join(root, 'src/task-horizon/main/render/47-render-side-panels-and-view-switching.js'), 'utf8');
assert.match(viewSwitching, /function __tmMountCalendarViewRoot[\s\S]*__taskHorizonEnsureCalendarAssets/, 'calendar view must request assets before mounting');
assert.match(viewSwitching, /function __tmCalendarDockMount[\s\S]*__taskHorizonEnsureCalendarAssets/, 'calendar side dock must request assets before mounting');
assert.doesNotMatch(index, /calendar-style-bridge|CALENDAR_STYLE_BRIDGE_CSS_PATH/, 'calendar styles must not add a separate bridge asset');
assert.match(calendarCss, /\.tm-calendar-host \.fc,\s*\.tm-calendar-host\.fc\s*\{[\s\S]*height: 100%/, 'existing calendar CSS must own the FullCalendar host boundary');
const fullCalendarBundle = fs.readFileSync(path.join(root, 'src/fullcalendar/fullcalendar.global.js'), 'utf8');
assert.match(fullCalendarBundle, /FullCalendar \(Vanilla JS\) v7\.0\.0/, 'plugin-owned FullCalendar bundle must remain pinned to the known-compatible runtime');
assert.doesNotMatch(fullCalendarBundle, /multiMonthPlugin|MultiMonthView|exports\.MultiMonth|name: 'multimonth'/, 'plugin-owned FullCalendar bundle must exclude the unused multiMonth runtime');
assert.doesNotMatch(fullCalendarBundle, /\[['"]resources['"]\]|resourceTimeline|timelinePlugin/, 'plugin-owned FullCalendar bundle must not carry scheduler-only option validation');
assert.match(fullCalendarBundle, /var pluginClassNames = \{[\s\S]*viewHarness: 'fc-view-harness'[\s\S]*timeGridAllDayLane: 'fc-timegrid-all-day tm-cal-timegrid-allday-lane'/, 'plugin-owned FullCalendar core must emit stable selectors at render time');
assert.doesNotMatch(source, /applyFullCalendarV7LegacyDomClasses|scheduleFullCalendarV7LegacyDomClasses|addFullCalendarLegacyClassesByProtectedClass/, 'calendar views must not rescan rendered DOM to reconstruct stable core classes');
assert.doesNotMatch(formaTheme, /resourceDayHeader|resourceColumn|resourceGroup|resourceLane|timelineBottom|views:\s*\{[\s\S]*timeline:/, 'Forma theme must only register the calendar views used by the plugin');
assert.match(formaTheme, /index\.optionRefiners\s*=\s*Object\.fromEntries\([\s\S]*Object\.keys\(index\.optionDefaults\)/, 'Forma theme class hooks must be declared as owned FullCalendar options');

const nativeViewBlock = source.slice(source.indexOf('    const MAIN_CALENDAR_CUSTOM_VIEWS = {'), source.indexOf('    const MAIN_CALENDAR_ALLOWED_VIEWS =', source.indexOf('    const MAIN_CALENDAR_CUSTOM_VIEWS = {')));
assert.doesNotMatch(nativeViewBlock, /component\s*:/, 'month/week/list view declarations must keep FullCalendar native view components');
assert.equal((source.match(/moreLinkClick:\s*'popover'/g) || []).length, 2, 'main and side calendars must use the native +N popover');
assert.ok((source.match(/selectable:\s*true/g) || []).length >= 2, 'calendar selection must stay on the native FullCalendar interaction path');
assert.ok((source.match(/droppable:\s*true/g) || []).length >= 2, 'calendar drag/drop must stay on the native FullCalendar interaction path');
assert.ok((source.match(/eventDrop:\s*async/g) || []).length >= 2, 'plugin callbacks must consume native FullCalendar event-drop payloads');
assert.ok((source.match(/eventResize:\s*async/g) || []).length >= 2, 'plugin callbacks must consume native FullCalendar resize payloads');
assert.match(fullCalendarBundle, /role:\s*['"]grid['"]/, 'FullCalendar bundle must retain its native accessible grid output');
assert.match(fullCalendarBundle, /aria-labelledby/, 'FullCalendar bundle must retain its native accessible labels');

console.log('calendar renderer boundary contract tests passed');
