'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const viewSwitch = fs.readFileSync(path.join(root, 'src/task-horizon/main/render/47-render-side-panels-and-view-switching.js'), 'utf8');
const calendar = fs.readFileSync(path.join(root, 'calendar-view.js'), 'utf8');
const workbench = fs.readFileSync(path.join(root, 'src/ai/agent-workbench.js'), 'utf8');

const segment = (source, start, end) => {
    const from = source.indexOf(start);
    const to = source.indexOf(end, from + start.length);
    assert.notEqual(from, -1, `missing segment start: ${start}`);
    assert.notEqual(to, -1, `missing segment end: ${end}`);
    return source.slice(from, to);
};

const bodySwitch = segment(viewSwitch, 'function __tmTrySwitchViewBodyInPlace', 'window.tmHandleCalendarViewButtonContextMenu');
const dockTransfer = segment(viewSwitch, 'const __TM_PERSISTENT_SIDE_DOCKS', 'function __tmTrySwitchViewBodyInPlace');
const switchView = segment(viewSwitch, 'window.tmSwitchViewMode = function', '\n    };');
const reusedSideDay = segment(calendar, 'if (state.sideDay.calendar) {', '\n        state.sideDay.rootEl = rootEl;');
const viewNotification = segment(workbench, 'function notifyTaskViewChanged', '\n    async function enrichContextLabels');

assert.match(dockTransfer, /key: 'calendar'[\s\S]*selector: '\.tm-calendar-side-dock'[\s\S]*hostSelector: '#tmCalendarSideDockPanel'/, 'calendar dock must use the shared persistent-dock transfer');
assert.match(dockTransfer, /key: 'ai'[\s\S]*selector: '\.tm-ai-side-dock'[\s\S]*hostSelector: '#tmAiSidebarPanel'/, 'AI dock must use the shared persistent-dock transfer');
assert.match(dockTransfer, /currentNodes\.length !== expectedCount \|\| nextNodes\.length !== expectedCount/, 'dock visibility or structure mismatches must fall back before moving nodes');
assert.match(dockTransfer, /placeholderNode\.replaceWith\(transfer\.currentNode\)/, 'the live dock node must replace the new stage placeholder');
assert.match(dockTransfer, /scrollSelector: '#tmCalendarSideDockTimeline'/, 'calendar dock must register its live FullCalendar scroll root');
assert.match(dockTransfer, /scrollSelector: '\.tm-agent-messages'/, 'AI dock must register its live conversation scroller');
assert.match(dockTransfer, /scrollSnapshot: __tmCapturePersistentSideDockScroll\(config, currentNode\)/, 'dock scroll positions must be captured before moving live nodes');
assert.match(dockTransfer, /__tmCalendarDockMountTimeline\(timelineRoot\)[\s\S]*__tmRestorePersistentSideDockScroll\(transfers\)/, 'calendar rebinding must finish before persistent dock scroll positions are restored');
assert.match(dockTransfer, /scrollHost\.scrollTop = Number\(transfer\.scrollSnapshot\.top\)[\s\S]*scrollHost\.scrollLeft = Number\(transfer\.scrollSnapshot\.left\)[\s\S]*requestAnimationFrame\(apply\)/, 'dock scroll positions must be restored immediately and after the next layout frame');
assert.match(bodySwitch, /\.tm-ai-mobile-shell/, 'mobile and Dock AI overlays must stay out of the desktop dock transfer path');
assert.doesNotMatch(bodySwitch, /scene\.showCalendarSideDock\s*\|\||scene\.showAiSideDock\s*\|\|/, 'visible desktop docks must not disable the fast switch path');
assert.match(bodySwitch, /__tmPreparePersistentSideDockTransfers\(stage, nextStage, scene\)[\s\S]*__tmCommitPersistentSideDockTransfers\(persistentDockTransfers\)[\s\S]*stage\.replaceWith\(nextStage\)/, 'all dock checks must finish before the atomic stage commit');
assert.match(bodySwitch, /__tmBindBodyOnlyViewAfterSwitch[\s\S]*__tmSyncPersistentSideDocksAfterViewSwitch/, 'dock-specific rebinding must run only after the new task view is bound');
assert.match(dockTransfer, /__tmCalendarDockMountTimeline\(timelineRoot\)/, 'the reused calendar must only update its existing timeline binding');
assert.match(dockTransfer, /notifyTaskViewChanged/, 'the reused AI dock must receive a lightweight view notification');
assert.doesNotMatch(switchView, /refreshDock|relayoutSideDayDate/, 'view switching must not schedule repeated calendar relayout passes');

assert.match(reusedSideDay, /prevDate !== nextDateKey[\s\S]*gotoDate/, 'the reused side calendar must change date only when the date key changes');
assert.match(reusedSideDay, /requestAnimationFrame\(syncReusedSideDayLayout\)/, 'the reused side calendar must settle layout on the next frame');
assert.match(viewNotification, /runtime\.mounted[\s\S]*runtime\.host\.isConnected[\s\S]*scopeType !== 'current_view'[\s\S]*scheduleCurrentViewContextSync\(\)/, 'AI view notifications must be a no-op unless a live dynamic view context needs syncing');
assert.match(workbench, /globalThis\.__tmAI = \{[\s\S]*notifyTaskViewChanged,/, 'the AI runtime must expose the narrow view-change lifecycle hook');

console.log('persistent side dock view switch contract tests passed');
