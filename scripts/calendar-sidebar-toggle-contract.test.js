'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'src/task-horizon/main/render/47-render-side-panels-and-view-switching.js'), 'utf8');
const runtimeSource = fs.readFileSync(path.join(root, 'src/task-horizon/main/40-render-runtime.js'), 'utf8');
const shellStyles = fs.readFileSync(path.join(root, 'task-horizon.css'), 'utf8');
const calendarStyles = fs.readFileSync(path.join(root, 'calendar-view.css'), 'utf8');
const start = source.indexOf('function __tmRenderBodyOnlyViewToolbarExtra');
const end = source.indexOf('function __tmSyncBodyOnlyViewSwitcherButtons', start);

assert.ok(start >= 0 && end > start, 'body-only toolbar renderer must exist');
const toolbarRenderer = source.slice(start, end);

assert.match(toolbarRenderer, /mode === 'calendar'\) return '';/, 'body-only calendar switches must not inject a duplicate sidebar toggle');

assert.match(runtimeSource, /data-tm-calendar-compact-toggle="1"/, 'calendar compact toggle must expose a stable sync hook');
assert.match(runtimeSource, /__tmPhosphorBoldSvg\('sidebar'/, 'topbar calendar toggle must use the calendar sidebar icon');
assert.match(runtimeSource, /id === 'calendarSidebar'[\s\S]*__tmPhosphorBoldSvg\('sidebar'/, 'all topbar calendar sidebar actions must share the calendar icon style');
assert.match(source, /const __TM_CALENDAR_SIDE_DOCK_VIEW_MODES = new Set\(\[[\s\S]*?'comboBoard'[\s\S]*?\]\);/, 'calendar side dock modes must include comboBoard');
assert.match(source, /function __tmShouldShowCalendarSideDock\(\)[\s\S]*__tmCalendarSideDockSupportsViewMode\(mode\)/, 'calendar side dock mounting must use the shared view-mode policy');
assert.match(source, /function __tmSyncCalendarTopbarActionForView[\s\S]*__tmCalendarSideDockSupportsViewMode\(mode\)/, 'calendar topbar sync must use the shared view-mode policy');
assert.match(runtimeSource, /const showCalendarSideDockTopbarAction = !!\([\s\S]*?__tmCalendarSideDockSupportsViewMode\(renderMode\)/, 'calendar topbar render visibility must use the shared view-mode policy');
assert.match(shellStyles, /\.tm-filter-rule-bar \.tm-calendar-sidebar-toggle__icon\s*\{[^}]*transform:\s*scaleX\(-1\);[^}]*\}/, 'topbar calendar sidebar icons must point toward the right-side drawer');
assert.match(runtimeSource, /\$\{calendarSidebarCompactButtonHtml\}/, 'compact toggle placeholder must stay mounted while host metadata settles');
assert.doesNotMatch(runtimeSource, /\$\{showCalendarSidebarCompactToggle \? calendarSidebarCompactButtonHtml : ''\}/, 'compact toggle must not be conditionally omitted on the first render');
assert.match(source, /const hostUsesMobileUI = !!__tmHostUsesMobileUI\(\)[\s\S]*showCompact = mode === 'calendar'[\s\S]*isRuntimeMobile/, 'late mobile runtime detection must reveal the compact toggle');
assert.doesNotMatch(shellStyles, /\.tm-modal:not\(\.tm-modal--dock\) \.tm-calendar-sidebar-toggle-compact\s*\{\s*display:\s*inline-flex\s*!important;/, 'narrow desktop must not force-show the mobile compact toggle');
assert.match(calendarStyles, /\.tm-modal--dock[\s\S]*\[data-tm-host-mode="dock"\][\s\S]*display:\s*none\s*!important;/, 'late dock metadata must hide the calendar toolbar duplicate');

const policyStart = source.indexOf('    function __tmShouldShowCalendarSideDock');
const policyEnd = source.indexOf('    function __tmHasMountedCalendarSideDock', policyStart);
assert.ok(policyStart >= 0 && policyEnd > policyStart, 'calendar side dock view-mode policy must remain inspectable');
const state = {
    homepageOpen: false,
    viewMode: 'comboBoard',
};
const context = {
    state,
    SettingsStore: { data: { calendarSideDockEnabled: true } },
};
vm.createContext(context);
vm.runInContext(source.slice(policyStart, policyEnd), context);

assert.equal(context.__tmCalendarSideDockSupportsViewMode('comboBoard'), true, 'comboBoard must support the calendar side dock');
assert.equal(context.__tmShouldShowCalendarSideDock(), true, 'an enabled calendar side dock must mount in comboBoard');
state.viewMode = 'kanban';
assert.equal(context.__tmShouldShowCalendarSideDock(), true, 'kanban must retain calendar side dock support');
state.viewMode = 'calendar';
assert.equal(context.__tmShouldShowCalendarSideDock(), false, 'calendar view must keep ownership of its own sidebar');

console.log('calendar sidebar toggle contract tests passed');
