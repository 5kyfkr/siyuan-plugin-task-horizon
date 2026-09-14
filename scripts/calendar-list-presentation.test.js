'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'calendar-view.js'), 'utf8');
const styles = fs.readFileSync(path.join(root, 'calendar-view.css'), 'utf8');
const sharedStyles = fs.readFileSync(path.join(root, 'task-horizon.css'), 'utf8');
const start = source.indexOf('const protoListTaskDocumentName =');
const end = source.indexOf('const protoListEventRow =', start);
assert.ok(start >= 0 && end > start);
const sandbox = {
    state: { settingsStore: { data: { docGroups: [{ docs: [{ id: 'doc-b', name: '外部分组文档' }] }] } } },
    esc: (text) => String(text).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char])),
    getCalendarTaskRelationMeta: (task) => task?.docName || '',
    getCalendarTaskDocumentId: (task) => task?.docId || '',
    protoListTaskFieldEnabled: () => false,
    protoListTaskDone: (task) => task.done === true,
    protoListTaskChildren: (task) => task.children || [],
    protoListTaskTitleStyle: () => '',
    protoListTaskTitleHtml: (task) => task.content || '',
    protoEventColor: () => 'var(--tm-cal-primary)',
    prototypeListState: { collapsedSubtasks: new Set() },
    __tmCalendarKanbanCardHelpers: {
        renderBadgeIcon: (name, size) => '<svg data-shared-icon="' + name + '" width="' + size + '" height="' + size + '"></svg>',
    },
};
const context = vm.createContext(sandbox);
vm.runInContext(source.slice(start, end) + '\nthis.renderCard = protoListTaskCard;', context);
const event = { id: 'taskdate-task', title: '任务', extendedProps: { __tmDocId: 'doc-b' } };
const task = { id: 'task', content: '独立任务', docId: 'doc-b', docName: '来源文档' };
const standalone = context.renderCard(event, task, { isParent: false });
assert.match(standalone, /tm-kanban-chip--doc/);
assert.match(standalone, /来源文档/);
const withChildren = context.renderCard(event, { ...task, children: [{ id: 'child', content: '子任务', docName: '来源文档' }] }, { isParent: true });
assert.equal((withChildren.match(/tm-kanban-chip--doc/g) || []).length, 1, 'Document source belongs to the outer card, not repeated subtask rows');
assert.match(withChildren, /tm-kanban-subtask-row/);
assert.match(withChildren, /tm-kanban-subtasks-label"><svg data-shared-icon="clipboard-list" width="14" height="14"><\/svg><span>子任务/);
assert.doesNotMatch(styles, /\.tm-proto-list-subtasks \.tm-kanban-subtasks-(?:head|label)\s*\{/);
const sharedCardScope = ':is(.tm-kanban.tm-kanban--clean, .tm-whiteboard.tm-kanban--clean, .tm-proto-list)';
for (const metadata of ['.tm-kanban-card-meta', '.tm-kanban-subtask-meta']) {
    for (const field of ['.tm-status-tag', '.tm-kanban-priority-chip', '.tm-kanban-chip.tm-kanban-chip--muted', '.tm-kanban-chip--date', '.tm-kanban-chip--date-empty', '.tm-kanban-chip--date-overdue']) {
        for (const interaction of ['hover', 'focus-visible']) {
            assert.ok(sharedStyles.includes(`${sharedCardScope} ${metadata} ${field}:${interaction}`), `${metadata} ${field} shares kanban ${interaction} feedback`);
        }
    }
}
const fallback = context.renderCard(event, { id: 'task', content: '独立任务' }, { isParent: false });
assert.match(fallback, /外部分组文档/);
const escaped = context.renderCard(event, { ...task, docName: '<文档&名称>' }, { isParent: false });
assert.match(escaped, /&lt;文档&amp;名称&gt;/);
const unknown = context.renderCard({ id: 'taskdate-unknown' }, { id: 'unknown' }, { isParent: false });
assert.doesNotMatch(unknown, /tm-kanban-chip--doc/);
assert.match(styles, /\.tm-proto-list-week-picker \.tm-proto-list-date-cell\s*\{[^}]*grid-template-rows:\s*12px 18px 4px;/);
assert.match(styles, /\.tm-proto-list-month-grid \.tm-proto-list-date-cell\s*\{[^}]*grid-template-rows:\s*18px 4px;/);
assert.match(styles, /\.tm-proto-list-picker\s*\{[^}]*border:\s*0;[^}]*box-shadow:\s*none;/);
assert.match(styles, /\.tm-proto-list-week-picker\s*\{[^}]*grid-template-columns:\s*28px minmax\(0, 1fr\) 28px;/);
assert.match(styles, /\.tm-proto-list-calendar-toggle\s*\{[^}]*width:\s*48px;[^}]*height:\s*24px;/);
assert.match(source, /tm-proto-list-date-weekday">\$\{protoWeekLabels\[date\.getDay\(\)\]\}</);
assert.doesNotMatch(source, /tm-proto-list-date-weekday">周\$\{protoWeekLabels/);
assert.match(styles, /\.tm-proto-list:not\(\.is-calendar-expanded\) \.tm-proto-list-picker::after\{[\s\S]*bottom:\s*2px;/);
assert.match(styles, /\.tm-proto-list\{[\s\S]*container-type:\s*inline-size;[\s\S]*container-name:\s*tm-proto-list;/);
assert.match(styles, /@container tm-proto-list \(min-width:\s*900px\)[\s\S]*\.tm-proto-list-days\{ grid-template-columns: repeat\(3/);
assert.match(styles, /\.tm-proto-list-group-chevron::after\{[\s\S]*transform:\s*translateY\(-1px\) rotate\(45deg\)/);
assert.match(styles, /\.tm-proto-list-group\.is-collapsed \.tm-proto-list-group-chevron::after\{ transform: translate\(-1px, 0\.5px\) rotate\(-45deg\); \}/);
assert.doesNotMatch(styles, /\.tm-proto-list-group-chevron\{[\s\S]*transform:\s*translateY\(2px\);/);
assert.match(styles, /\.tm-proto-list-group-toggle:hover\{[\s\S]*background:\s*color-mix\(/);
assert.match(styles, /\.tm-proto-list-group-toggle:hover \.tm-proto-list-group-chevron\{[\s\S]*background:\s*color-mix\(/);
assert.match(styles, /\.tm-proto-list-group-toggle\{[\s\S]*border-radius:\s*8px;/);
assert.match(styles, /\.tm-proto-list-group--expired \.tm-proto-list-group-toggle:hover\{[\s\S]*var\(--tm-proto-list-danger\)/);
assert.match(styles, /\.tm-calendar-wrap--mobile \.tm-proto-list,[\s\S]*\.tm-calendar-root--dock \.tm-proto-list\{[\s\S]*var\(--tm-view-bottom-inset/);
assert.match(styles, /\.tm-proto-list-time\{[^}]*width:\s*40px;[^}]*max-width:\s*40px;/);
assert.match(source, /const eventApi = getCalendarEventById\(activeCalendar, eventId\)[\s\S]*?\|\| null;\s*if \(openPrototypeListTaskDetail\(event, eventApi, eventEl\)\) return;\s*if \(!eventApi\) return;/);
console.log('calendar list presentation regression tests passed');
