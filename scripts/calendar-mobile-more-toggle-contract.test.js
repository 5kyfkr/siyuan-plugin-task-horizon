'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'calendar-view.js'), 'utf8');

// A phone hides the soft keyboard on the first tap that leaves the focused
// title, so the editor is re-laid out before the browser dispatches click.
// 更多设置 must therefore run on the originating pointer event instead of
// waiting for a click that the reflow can swallow or re-target.
const inlineBindStart = source.indexOf('const toggleInlineMore = () => {');
const inlineBindEnd = source.indexOf("pop.querySelector('[data-tm-proto-edit-field=\"repeat\"]')?.addEventListener('change', syncInlineRepeatControls);", inlineBindStart);
assert.ok(inlineBindStart >= 0 && inlineBindEnd > inlineBindStart, 'inline 更多设置 binding must stay inspectable');
const inlineBind = source.slice(inlineBindStart, inlineBindEnd);
assert.match(
    inlineBind,
    /moreToggle\.addEventListener\('pointerdown', \(event\) => \{[\s\S]*if \(event\.pointerType === 'mouse'\) return;[\s\S]*event\.preventDefault\(\)[\s\S]*moreTogglePointerHandledAt = Date\.now\(\);[\s\S]*toggleInlineMore\(\);/,
    'inline 更多设置 must toggle on the touch origin so the keyboard reflow cannot swallow the tap',
);
assert.match(
    inlineBind,
    /moreToggle\.addEventListener\('click', \(\) => \{\s*if \(Date\.now\(\) - moreTogglePointerHandledAt < 700\) return;\s*toggleInlineMore\(\);\s*\}\);/,
    'inline 更多设置 click must stay for mouse and keyboard use without double toggling',
);

const modalPointerStart = source.indexOf("modal.addEventListener('pointerdown', (e) => {");
const modalClickStart = source.indexOf("modal.addEventListener('click', async (e) => {", modalPointerStart);
assert.ok(modalPointerStart >= 0 && modalClickStart > modalPointerStart, 'dialog 更多设置 pointer binding must stay inspectable');
const modalPointerBind = source.slice(modalPointerStart, modalClickStart);
assert.match(
    modalPointerBind,
    /if \(e\.pointerType === 'mouse'\) return;[\s\S]*'toggleMore'[\s\S]*e\.preventDefault\(\)[\s\S]*moreTogglePointerHandledAt = Date\.now\(\);[\s\S]*moreExpanded = !moreExpanded;/,
    'dialog 更多设置 must toggle on the touch origin as well',
);
const modalClickEnd = source.indexOf('if (action === \'cancel\')', modalClickStart);
assert.ok(modalClickEnd > modalClickStart, 'dialog action handler must stay inspectable');
assert.match(
    source.slice(modalClickStart, modalClickEnd),
    /if \(action === 'toggleMore'\) \{\s*if \(Date\.now\(\) - moreTogglePointerHandledAt < 700\) return;/,
    'dialog 更多设置 click must skip the pointer duplicate',
);
assert.match(
    source.slice(modalClickStart, modalClickEnd),
    /if \(isReTargetedModalClick\(e\?\.target\)\) return;/,
    'dialog must ignore a click that the keyboard reflow re-targeted onto another control',
);

// The floating card must not be repositioned while a gesture is running, and a
// re-targeted trailing click must not be mistaken for a tap on the calendar.
assert.match(
    source,
    /const onViewportChange = \(\) => \{\s*if \(!pop\.isConnected\) return;\s*if \(activePopoverPointers > 0\) \{[\s\S]*viewportRepositionPending = true;[\s\S]*return;\s*\}\s*try \{ position\(\); \}/,
    'inline editor must hold its layout while a pointer gesture is running',
);
assert.match(
    source,
    /pop\.addEventListener\('pointerdown', onPopoverPointerDownAt, true\);\s*window\.addEventListener\('pointerup', onPopoverPointerEndAt, true\);\s*window\.addEventListener\('pointercancel', onPopoverPointerEndAt, true\);/,
    'inline editor must track the running pointer gesture',
);
assert.match(
    source,
    /const onPopoverPointerEndAt = \(\) => \{[\s\S]*setTimeout\(\(\) => \{[\s\S]*position\(\);/,
    'inline editor must settle its position after the gesture click is dispatched',
);
assert.match(
    source,
    /if \(isReTargetedInsideTap\(event\)\) return;/,
    'inline editor must ignore the re-targeted trailing click of an in-card tap',
);
assert.match(
    source,
    /try \{ if \(current\.onPopoverPointerDownAt\) current\.el\?\.removeEventListener\?\.\('pointerdown', current\.onPopoverPointerDownAt, true\); \} catch \(e\) \{\}/,
    'inline editor gesture listeners must be released with the popover',
);
assert.match(
    source,
    /try \{ current\.onPopoverPointerDispose\?\.\(\); \} catch \(e\) \{\}/,
    'inline editor gesture state must be disposed with the popover',
);

console.log('calendar mobile more-toggle contract tests passed');
