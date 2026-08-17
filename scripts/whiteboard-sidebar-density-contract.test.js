'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const styles = fs.readFileSync(path.join(root, 'task-horizon.css'), 'utf8');
const bodySource = fs.readFileSync(path.join(root, 'src/task-horizon/main/render/44-render-whiteboard-body.js'), 'utf8');
const resizeSource = fs.readFileSync(path.join(root, 'src/task-horizon/main/render/45-render-shell-controls-and-resize.js'), 'utf8');
const renderRuntimeSource = fs.readFileSync(path.join(root, 'src/task-horizon/main/40-render-runtime.js'), 'utf8');
const apiRuntimeSource = fs.readFileSync(path.join(root, 'src/task-horizon/main/20-api-and-runtime-services.js'), 'utf8');

const segment = (startToken, endToken) => {
    const start = styles.indexOf(startToken);
    const end = styles.indexOf(endToken, start + startToken.length);
    assert.ok(start >= 0 && end > start, `missing CSS segment: ${startToken}`);
    return styles.slice(start, end);
};

const sidebar = segment('.tm-whiteboard-sidebar {', '.tm-whiteboard-sidebar-scroll {');
assert.match(sidebar, /position:\s*relative;[\s\S]*overflow:\s*hidden;/,
    'the sidebar must contain the floating scrollbar without becoming the scroll container');
assert.match(sidebar, /border-right:\s*1px solid color-mix\([\s\S]*?32%/,
    'the sidebar divider must remain visually light');
const sidebarScroll = segment('.tm-whiteboard-sidebar-scroll {', '.tm-whiteboard-sidebar-scroll::-webkit-scrollbar {');
assert.match(sidebarScroll, /overflow-x:\s*hidden;[\s\S]*overflow-y:\s*auto;/,
    'the task pool must scroll vertically without introducing a horizontal scrollbar');
assert.match(sidebarScroll, /scrollbar-width:\s*none;/,
    'the native scrollbar must not reserve horizontal space');
assert.match(sidebarScroll, /padding:\s*10px 8px/, 'the task pool must use equal horizontal insets');
assert.match(styles, /\.tm-whiteboard-sidebar-scroll::\-webkit-scrollbar\s*\{[\s\S]*?display:\s*none;[\s\S]*?width:\s*0;/,
    'the WebKit scrollbar must not reserve horizontal space');
assert.match(styles, /\.tm-whiteboard-sidebar\.tm-whiteboard-sidebar--scrolling \.tm-whiteboard-sidebar-scrollbar\s*\{[\s\S]*?opacity:\s*1;/,
    'the floating scrollbar must become visible only during scrolling');

const resizer = segment('.tm-whiteboard-sidebar-resizer {', '.tm-whiteboard-sidebar-resizer:hover {');
assert.match(resizer, /width:\s*1px;[\s\S]*min-width:\s*1px;/,
    'the sidebar resizer must occupy only a one-pixel visual column');
assert.match(resizer, /\.tm-whiteboard-sidebar-resizer::before\s*\{[\s\S]*?inset:\s*0 -6px;/,
    'the narrow divider must retain a forgiving invisible drag target');
assert.match(resizer, /background:\s*transparent;/, 'the resize target must not add a dark idle divider');

const poolList = segment('.tm-whiteboard-pool-list {', '.tm-whiteboard-pool-list[hidden] {');
assert.match(poolList, /padding:\s*4px;/, 'task cards must use more of the available sidebar width');
const poolSection = segment('.tm-whiteboard-pool-doc {', '.tm-whiteboard-pool-doc-head {');
assert.match(poolSection, /width:\s*100%;[\s\S]*?box-sizing:\s*border-box;/,
    'task pool sections must preserve equal left and right insets');

assert.match(bodySource, /<div class="tm-whiteboard-sidebar-scroll" onscroll="tmWhiteboardSidebarScroll\(event\)">/,
    'the task pool scroll container must report scroll activity');
assert.match(bodySource, /tm-whiteboard-sidebar-scrollbar[\s\S]*?tm-whiteboard-sidebar-scrollbar-thumb/,
    'the floating scrollbar must remain separate from task pool layout');
assert.match(resizeSource, /window\.tmWhiteboardSidebarScroll = function[\s\S]*?scrollingClass = 'tm-whiteboard-sidebar--scrolling'/,
    'scroll activity must use the class that reveals the overlay thumb');
assert.match(resizeSource, /clientHeight[\s\S]*?scrollHeight[\s\S]*?classList\.toggle\(scrollingClass, hasOverflow\)[\s\S]*?thumb\.style\.height[\s\S]*?thumb\.style\.transform[\s\S]*?setTimeout\([\s\S]*?, 650\)/,
    'the overlay thumb must appear only for overflowing content and hide shortly after scrolling');
assert.ok((renderRuntimeSource.match(/querySelector\('\.tm-whiteboard-sidebar-scroll'\)/g) || []).length >= 2,
    'full whiteboard renders must preserve the nested task pool scroll position');
assert.ok((apiRuntimeSource.match(/querySelector\('\.tm-whiteboard-sidebar-scroll'\)/g) || []).length >= 2,
    'in-place whiteboard renders must preserve the nested task pool scroll position');

console.log('whiteboard sidebar density contract tests passed');
