'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'calendar-view.js'), 'utf8');
const styles = fs.readFileSync(path.join(root, 'calendar-view.css'), 'utf8');

assert.match(source, /isNarrowDesktopLayout: false/);
assert.match(source, /NARROW_LAYOUT_ENTER_WIDTH = 760/);
assert.match(source, /NARROW_LAYOUT_EXIT_WIDTH = 800/);
assert.match(source, /narrowDesktopSourceWidth = 0/);
assert.match(source, /const shellChanged = isNarrowDesktopLayout/);
assert.match(source, /isNarrowDesktopLayout && narrowDesktopSourceWidth > 0/);
assert.match(source, /rootEl\.clientWidth \|\| wrap\.clientWidth/);
assert.match(source, /calendarLayoutResizeObserver\.observe\(rootEl\)/);
assert.match(source, /calendarLayoutResizeObserver\.observe\(wrap\)/);
assert.match(source, /rootEl\.classList\.toggle\('tm-calendar-root--narrow-tab', next\)/);
assert.match(source, /rootEl\.classList\.toggle\('tm-calendar-root--dock', next \|\| isDockHost\)/);
assert.match(source, /tm-main-body-with-cal-dock--narrow-calendar/);
assert.match(source, /const desiredScrollTop = Math\.max\(0, weekIndex \* geometry\.rowHeight\)/);
assert.match(source, /setPrototypeMonthPendingScrollRestore\(monthStart, desiredScrollTop\)/);
assert.match(source, /const sanitizeMonthAnchor = \(value\) =>/);
assert.match(source, /anchor\.getFullYear\(\) === 1970/);
assert.match(source, /const compactToolbar = isCompactDockLayout\(\)/);
assert.match(source, /const sidebarToggleMarkup = \(isMobileDevice \|\| isDockHost\) \? ''/);
assert.match(source, /function toggleMobileSidebar\(wrap, open, page\)[\s\S]*const isDrawerLayout = isMobile \|\| state\.isDockHost === true \|\| state\.isNarrowDesktopLayout === true/);
assert.match(source, /state\.isNarrowDesktopLayout === true/);
assert.match(styles, /\.tm-calendar-root--narrow-tab \.tm-proto-toolbar--dock > \[data-tm-proto-action="toggleSidebar"\]/);
assert.match(styles, /\.tm-main-body-with-cal-dock--narrow-calendar > \.tm-calendar-side-dock/);
assert.match(styles, /\.tm-calendar-root--narrow-tab \.tm-calendar-main/);
assert.match(styles, /\.tm-calendar-root--narrow-tab\.tm-calendar-root--month-view/);
assert.match(styles, /\.tm-calendar-root--narrow-tab(?:\.tm-calendar-root--month-view)? \.tm-proto-month-cell/);

// Width adaptation must stay container-driven; a viewport breakpoint would
// miss narrow desktop tabs inside a wide SiYuan window.
assert.doesNotMatch(source, /syncNarrowDesktopLayout[\s\S]{0,500}window\.innerWidth/);

console.log('calendar narrow-tab layout contract tests passed');
