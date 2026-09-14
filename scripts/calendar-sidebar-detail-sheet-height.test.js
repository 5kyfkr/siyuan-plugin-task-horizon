'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const gestureSource = fs.readFileSync(path.join(root, 'src/task-horizon/main/30-dialogs-and-ui-foundation.js'), 'utf8');
const calendarStyle = fs.readFileSync(path.join(root, 'calendar-view.css'), 'utf8');
const functionStart = gestureSource.indexOf('    function __tmMeasureChecklistSheetDragTrack(sheet) {');
assert.ok(functionStart >= 0);
const measureSource = gestureSource.slice(functionStart, gestureSource.indexOf('\n    }', functionStart) + 6);

class SheetElement {
    constructor(collapsedRect, fullRect, classes = []) {
        this.classes = new Set(classes);
        this.classList = {
            contains: (name) => this.classes.has(name),
            add: (...names) => names.forEach((name) => this.classes.add(name)),
            remove: (...names) => names.forEach((name) => this.classes.delete(name)),
        };
        this.style = { transform: 'translateY(12px)' };
        this.collapsedRect = collapsedRect;
        this.fullRect = fullRect;
    }

    getBoundingClientRect() {
        return this.classList.contains('tm-checklist-sheet--fullscreen') ? this.fullRect : this.collapsedRect;
    }
}

const context = vm.createContext({
    HTMLElement: SheetElement,
    window: { innerHeight: 900 },
    document: { documentElement: { clientHeight: 900 } },
});
vm.runInContext(measureSource, context);

const scenarios = [
    { name: 'calendar sidebar above the window bottom', top: 188, bottom: 640, collapsedTop: 220 },
    { name: 'short calendar sidebar', top: 188, bottom: 300, collapsedTop: 188 },
    { name: 'Dock checklist', top: 108, bottom: 876, collapsedTop: 300 },
    { name: 'full-window mobile sheet', top: 8, bottom: 900, collapsedTop: 216 },
];

for (const scenario of scenarios) {
    for (const classes of [[], ['tm-checklist-sheet--open'], ['tm-checklist-sheet--open', 'tm-checklist-sheet--fullscreen'], ['tm-checklist-sheet--open', 'tm-checklist-sheet--dragging']]) {
        const sheet = new SheetElement(
            { top: scenario.collapsedTop, bottom: scenario.bottom, height: scenario.bottom - scenario.collapsedTop },
            { top: scenario.top, bottom: scenario.bottom, height: scenario.bottom - scenario.top },
            classes,
        );
        const metrics = context.__tmMeasureChecklistSheetDragTrack(sheet);
        assert.equal(metrics.fullHeight, scenario.bottom - scenario.top, scenario.name + ': expanded height must end at the actual host bottom');
        assert.equal(metrics.collapsedOffset, scenario.collapsedTop - scenario.top, scenario.name + ': preserve the collapsed snap position');
        assert.equal(metrics.closeOffset, Math.max(metrics.collapsedOffset + 96, metrics.fullHeight + 24));
        assert.deepEqual([...sheet.classes].sort(), [...classes].sort(), scenario.name + ': measurement must restore sheet classes');
        assert.equal(sheet.style.transform, 'translateY(12px)', scenario.name + ': measurement must restore the drag transform');
    }
}

const throwingSheet = new SheetElement({}, {});
throwingSheet.getBoundingClientRect = () => { throw new Error('measurement failed'); };
assert.equal(context.__tmMeasureChecklistSheetDragTrack(throwingSheet), null);
assert.equal(throwingSheet.classes.size, 0);
assert.equal(throwingSheet.style.transform, 'translateY(12px)');
assert.equal(context.__tmMeasureChecklistSheetDragTrack(null), null);

const sidebarSheetRule = calendarStyle.match(/\.tm-calendar-task-page-list\.tm-calendar-task-page-list--checklist \.tm-checklist-sheet:not\(\.tm-checklist-sheet--fullscreen\)\s*\{([^}]+)\}/);
assert.ok(sidebarSheetRule, 'the embedded calendar sheet must have a host-height limit without changing fullscreen layout');
assert.match(sidebarSheetRule[1], /max-height:\s*min\(76vh,\s*680px,\s*calc\(100% - 8px\)\);/, 'normal sheets must resize with the sidebar while retaining existing window and pixel caps');
assert.match(sidebarSheetRule[1], /box-sizing:\s*border-box;/, 'the height cap must include the sheet border');

console.log('calendar sidebar detail sheet height tests passed');
