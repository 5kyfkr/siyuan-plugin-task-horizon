'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const styles = fs.readFileSync(path.join(root, 'task-horizon.css'), 'utf8');
const runtime = fs.readFileSync(path.join(root, 'src/task-horizon/main/30-dialogs-and-ui-foundation.js'), 'utf8');

const portalStyles = styles.match(/\.tm-inline-searchbar--portal\s*\{([^}]*)\}/)?.[1] || '';
const inputStyles = styles.match(/\.tm-inline-searchbar__input\s*\{([^}]*)\}/)?.[1] || '';
const portalZIndex = Number(portalStyles.match(/z-index:\s*(\d+)/)?.[1] || 0);

assert.ok(portalZIndex > 100001, 'the search portal must render above the full-screen mobile manager');
assert.match(portalStyles, /max-width:\s*100vw;/, 'the search portal must not exceed the viewport');
assert.match(portalStyles, /box-sizing:\s*border-box;/, 'the search portal width must include its horizontal padding');
assert.match(inputStyles, /min-width:\s*0;/, 'the search input must shrink inside narrow mobile and Dock hosts');
assert.match(runtime, /stageWidth[\s\S]*Math\.min\(stageWidth, viewportWidth\)[\s\S]*maxLeft[\s\S]*Math\.min\(Math\.round\(stageLeft\), Math\.round\(maxLeft\)\)/, 'search portal geometry must stay within the visible viewport');

console.log('inline searchbar responsive contract tests passed');
