'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'calendar-view.js'), 'utf8');
const styles = fs.readFileSync(path.join(root, 'calendar-view.css'), 'utf8');

assert.match(source, /const compactHeader = settings\.showLunar !== true/);
assert.match(source, /tm-proto-timeline-head\$\{compactHeader \? ' tm-proto-timeline-head--compact' : ''\}/);
assert.match(styles, /\.tm-proto-timeline-head--compact \.tm-proto-timeline-day\s*\{[\s\S]*min-height:\s*42px;[\s\S]*padding:\s*4px 0 3px;/);
assert.match(styles, /\.tm-proto-timeline-head--compact \.tm-proto-timeline-day small:empty\s*\{[\s\S]*display:\s*none;/);
assert.match(styles, /@media \(max-width: 768px\)[\s\S]*\.tm-proto-timeline-head--compact \.tm-proto-timeline-day\s*\{[\s\S]*min-height:\s*38px;[\s\S]*padding:\s*3px 0 2px;/);

console.log('calendar timeline header contract tests passed');
