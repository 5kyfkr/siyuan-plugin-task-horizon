const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const render = fs.readFileSync(path.join(root, 'src/task-horizon/main/render/43-render-timeline-kanban-calendar-body.js'), 'utf8');
const styles = fs.readFileSync(path.join(root, 'task-horizon.css'), 'utf8');

const start = render.indexOf('const renderCard =');
const end = render.indexOf('const renderTree =', start);
assert.ok(start >= 0 && end > start, 'kanban card renderer must exist');
const renderCard = render.slice(start, end);

assert.match(renderCard, /const docChipHtml = \(isAllTabsView && !headingMode && docName\)/, 'heading board cards must omit the document chip because the column already identifies the document');
assert.match(renderCard, /const cardMetaParts = docChipHtml \? \[\.\.\.metaParts, docChipHtml\] : metaParts/, 'status and time boards must keep the existing document chip in the card metadata');
assert.match(renderCard, /const subtaskMetaHtml = metaParts\.length/, 'subtask metadata must remain independent from the root-card document chip');
assert.match(styles, /\.tm-kanban-more\s*\{[^}]*display:\s*inline-flex;[^}]*align-items:\s*center;[^}]*justify-content:\s*center;/s, 'kanban detail buttons must center the more icon on both axes');

console.log('kanban heading card metadata contract tests passed');
