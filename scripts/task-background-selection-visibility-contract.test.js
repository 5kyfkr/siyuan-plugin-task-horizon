'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const css = fs.readFileSync(path.resolve(__dirname, '..', 'task-horizon.css'), 'utf8');
const tintStart = css.lastIndexOf('/* Keep task tints visible after each view');
assert.ok(tintStart >= 0, 'final task tint rules must exist');
const tintCss = css.slice(tintStart);
const readRule = (needle) => {
    const start = tintCss.indexOf(needle);
    assert.ok(start >= 0, `missing tint selector: ${needle}`);
    const open = tintCss.indexOf('{', start);
    const close = tintCss.indexOf('}', open);
    assert.ok(open > start && close > open, `invalid tint rule: ${needle}`);
    return { selector: tintCss.slice(start, open), body: tintCss.slice(open + 1, close) };
};

const checklist = readRule('.tm-checklist-item[data-tm-task-background]');
assert.doesNotMatch(checklist.selector, /:not\(\.tm-checklist-item--active\)|:not\(\.tm-task-row--multi-selected\)/,
    'checklist selected and active rows must keep their assigned task tint');
assert.match(checklist.body, /background:\s*var\(--tm-task-background-fill\)\s*!important/,
    'checklist task tint must override the selected background fill');

const whiteboardCard = readRule('.tm-kanban-card[data-tm-task-background]');
assert.doesNotMatch(whiteboardCard.selector, /:not\(\.tm-task-row--multi-selected\)|:not\(\.tm-whiteboard-card--selected\)|:not\(\.tm-whiteboard-multi-selected\)/,
    'whiteboard selected cards must keep their assigned task tint');
assert.match(whiteboardCard.body, /background:\s*var\(--tm-task-background-fill,\s*var\(--card\)\)\s*!important/,
    'whiteboard task tint must override the selected background fill');

const whiteboardRow = readRule('.tm-whiteboard-stream-task-head[data-tm-task-background]');
assert.doesNotMatch(whiteboardRow.selector, /:not\(\.tm-task-row--multi-selected\)/,
    'whiteboard selected task rows must keep their assigned task tint');


const darkAccents = {
    pink: '#d78fa5',
    amber: '#bc8b3f',
    teal: '#458a7c',
    blue: '#527eaf',
    purple: '#8064ac',
};
for (const [key, accent] of Object.entries(darkAccents)) {
    const selector = `:root[data-theme-mode=\"dark\"] [data-tm-task-background=\"${key}\"]`;
    const start = css.indexOf(selector);
    assert.ok(start >= 0, `dark mode must define ${key} task tint`);
    const open = css.indexOf('{', start);
    const close = css.indexOf('}', open);
    const rule = css.slice(start, close + 1);
    assert.ok(rule.includes('76%') && rule.includes(`${accent} 24%`),
        `dark mode ${key} tint must be darker and more saturated`);
    assert.ok(css.includes(`[data-tm-task-background=\"${key}\"] { --tm-task-background-fill:`),
        `light mode ${key} tint must remain defined`);
}

console.log('task background selection visibility contract tests passed');
