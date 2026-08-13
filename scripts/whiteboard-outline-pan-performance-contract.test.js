const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'src/task-horizon/main/task-runtime/52-task-detail-runtime.js'), 'utf8');
const start = source.indexOf('const applyWhiteboardOutlinePanFrame = (drag) => {');
const end = source.indexOf("on(document, 'pointerup', finishWhiteboardOutlinePan", start);
assert.ok(start >= 0 && end > start, 'whiteboard outline pan handlers must remain extractable');
const handlers = source.slice(start, end);

const pointerMoveStart = handlers.indexOf("on(document, 'pointermove', (ev) => {");
const pointerMoveEnd = handlers.indexOf('const finishWhiteboardOutlinePan');
const pointerMove = handlers.slice(pointerMoveStart, pointerMoveEnd);
assert.match(pointerMove, /drag\.latestX =/);
assert.match(pointerMove, /if \(drag\.panRaf\) return;/, 'pointer events must coalesce behind a single pending frame');
assert.match(pointerMove, /drag\.panRaf = requestAnimationFrame/, 'scroll writes must run at most once per animation frame');
assert.doesNotMatch(pointerMove.split('requestAnimationFrame')[0], /scroll\.scroll(?:Left|Top)\s*=/, 'pointermove must not synchronously write scroll position');

const finish = handlers.slice(pointerMoveEnd);
assert.match(finish, /cancelAnimationFrame\(drag\.panRaf\)/, 'finishing a drag must cancel its pending frame');
assert.match(finish, /applyWhiteboardOutlinePanFrame\(drag\)/, 'finishing a drag must preserve the latest position');
assert.match(source, /latestX: Number\(ev\.clientX\) \|\| 0,[\s\S]*panRaf: 0/, 'new drags must initialize their frame state');
const closeStart = source.indexOf('const closeInlinePopover = (force = false');
const closeEnd = source.indexOf('const positionInlinePopover', closeStart);
const close = source.slice(closeStart, closeEnd);
assert.match(close, /cancelAnimationFrame\(panDrag\.panRaf\)/, 'closing the popover must cancel pending pan work');
assert.match(close, /whiteboardOutlinePanDrag = null/, 'closing the popover must release drag references');

console.log('whiteboard outline pan performance contract tests passed');
