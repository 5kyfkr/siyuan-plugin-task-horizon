'use strict';

const assert = require('node:assert/strict');
const fs = require('./i18n-source-fixture');
const path = require('node:path');
const vm = require('./i18n-vm-fixture');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'src/task-horizon/main/settings/63-summary-runtime.js'), 'utf8');
const taskUtilsSource = fs.readFileSync(path.join(root, 'src/task-horizon/main/task-runtime/50-task-model-and-repeat-utils.js'), 'utf8');
const recurringRuntimeSource = fs.readFileSync(path.join(root, 'src/task-horizon/main/task-runtime/54-recurring-task-runtime.js'), 'utf8');
const cssSource = fs.readFileSync(path.join(root, 'task-horizon.css'), 'utf8');
const segment = (start, end) => {
    const from = source.indexOf(start);
    const to = source.indexOf(end, from + start.length);
    assert.notEqual(from, -1, `missing segment start: ${start}`);
    assert.notEqual(to, -1, `missing segment end: ${end}`);
    return source.slice(from, to);
};

const chinaTimeSource = segment('function __tmSummaryFormatChinaDateTime', 'function __tmSummaryRangeFromPreset');
const chinaTimeContext = {};
vm.createContext(chinaTimeContext);
vm.runInContext(`${chinaTimeSource}\nthis.formatChinaTime = __tmSummaryFormatChinaDateTime;`, chinaTimeContext);
assert.equal(
    vm.runInContext("formatChinaTime(new Date('2026-01-01T00:30:45Z'))", chinaTimeContext),
    '2026-01-01 08:30:45',
    'summary generation time must be formatted in Asia/Shanghai',
);
assert.doesNotMatch(source, /new Date\(\)\.toISOString\(\)/, 'summary generation time must not fall back to UTC ISO text');

const comparatorSource = segment('function __tmSummaryCompareTasksByCompletion', 'function __tmSummaryCollectTasks');
const comparatorContext = {};
vm.createContext(comparatorContext);
vm.runInContext(`${comparatorSource}\nthis.compareTasks = __tmSummaryCompareTasksByCompletion;`, comparatorContext);
assert.ok(
    comparatorContext.compareTasks({ completedAtTs: 200, content: '晚' }, { completedAtTs: 100, content: '早' }) > 0,
    'tasks completed later must sort after earlier tasks',
);
assert.ok(
    comparatorContext.compareTasks({ completedAtTs: 0, content: '无时间' }, { completedAtTs: 100, content: '有时间' }) < 0,
    'tasks without a completion time must keep a stable position before timed tasks',
);
assert.match(source, /completedAtTs,[\s\S]*out\.sort\(__tmSummaryCompareTasksByCompletion\)/, 'summary rows must retain and sort by the full completion timestamp');

assert.match(source, /<option value="date">按日期分组<\/option>/, 'summary grouping must offer the task date used for filtering');
assert.match(source, /groupBy === 'date'[\s\S]*未设置日期/, 'date grouping must retain tasks without a matching date');
assert.match(source, /const missingDate = '未设置日期'[\s\S]*localeCompare/, 'date sections must sort from missing and early dates to later dates');
assert.match(source, /data-tm-summary="fieldDueDate">截止日期<\/label>/, 'summary fields must expose due date independently');
assert.match(source, /data-tm-summary="fieldCompletionDate">完成日期<\/label>/, 'summary fields must expose completion date independently');
assert.match(source, /renderTaskDates[\s\S]*task\.dueDate[\s\S]*task\.completionDate/, 'summary rows must label due and completion dates separately');
assert.doesNotMatch(source, /日期口径：已完成按完成日期，未完成按截止日期。/, 'summary filters must not display a redundant date-rule explanation');
assert.match(source, /data-tm-summary="preview"[^>]*font-size:0\.875rem/, 'summary preview text must use the requested 14px-equivalent size');
assert.match(source, /function __tmSummaryExpandRecurringTasks[\s\S]*__tmNormalizeTaskRepeatHistory[\s\S]*__tmBuildRecurringInstanceTask/, 'summary loading must expand recurring task history through the shared virtual-instance builder');
assert.match(source, /currentCompletedAt[\s\S]*historyItem\?\.completedAt[\s\S]*return;/, 'a currently completed recurring task must not duplicate the matching history instance');
assert.match(source, /function __tmSummaryRecurringLabel[\s\S]*循环任务 · 第 [\s\S]* 次/, 'recurring task rows must expose their occurrence label');
const recurringExpandSource = segment('function __tmSummaryExpandRecurringTasks', 'async function __tmSummaryLoadTasksByDocs');
const recurringContext = {
    __tmNormalizeTaskRepeatHistory(value) { return Array.isArray(value) ? value : []; },
    __tmBuildRecurringInstanceTask(task, historyItem, index) {
        return {
            id: `repeatinst:${task.id}:${index}`,
            sourceTaskId: task.id,
            isRecurringInstance: true,
            recurringOccurrenceNumber: historyItem.occurrenceNumber,
            recurringTotalOccurrences: historyItem.totalOccurrences,
        };
    },
};
vm.createContext(recurringContext);
vm.runInContext(`${recurringExpandSource}\nthis.expandRecurring = __tmSummaryExpandRecurringTasks;`, recurringContext);
const expandedRecurring = recurringContext.expandRecurring([{
    id: 'source-task',
    done: true,
    taskCompleteAt: '2026-08-12 09:00:00',
    repeatHistory: [
        { completedAt: '2026-08-12 09:00:00', occurrenceNumber: 2, totalOccurrences: 3 },
        { completedAt: '2026-08-11 09:00:00', occurrenceNumber: 1, totalOccurrences: 3 },
    ],
}]);
assert.equal(expandedRecurring.length, 2, 'recurring summary expansion must include history without duplicating the current completed occurrence');
assert.equal(expandedRecurring[1].sourceTaskId, 'source-task', 'expanded recurring history must retain the source task identity');
assert.match(source, /focusDuration: __tmSummaryFormatFocusDuration\(task\)/, 'summary focus duration must use the actual Tomato duration formatter');
assert.doesNotMatch(source, /focusDuration: __tmFormatDurationDisplayValue\(task\.duration/, 'summary focus duration must not use the estimated task duration');
assert.match(source, /data-tm-summary="fieldFocusDuration">专注时长<\/label>/, 'summary field controls must offer focus duration');
assert.ok(source.includes('showFocusDuration && t.focusDuration') && source.includes('`专注时长:${t.focusDuration}`'), 'summary markdown must render enabled focus duration values');
assert.match(taskUtilsSource, /tomatoMinutes: String\(entry\.tomatoMinutes[\s\S]*tomatoHours: String\(entry\.tomatoHours/, 'recurring history must retain actual Tomato duration snapshots');
assert.match(taskUtilsSource, /tomatoMinutes: String\(history\.tomatoMinutes[\s\S]*tomatoHours: String\(history\.tomatoHours/, 'recurring virtual tasks must expose their own actual Tomato duration snapshot');
assert.match(recurringRuntimeSource, /tomatoMinutes:[\s\S]*tomatoHours:[\s\S]*__tmSettleTomatoAfterTaskDone[\s\S]*task = await __tmReadTaskMutationBaseline/, 'recurring completion must snapshot Tomato duration after the timer is settled');

const focusFormatterSource = segment('function __tmSummaryFormatFocusDuration', 'function __tmSummaryCollectTasks');
const focusFormatterContext = {
    SettingsStore: {
        data: {
            enableTomatoIntegration: true,
            tomatoSpentAttrMode: 'minutes',
            durationFormat: 'hours',
        },
    },
    __tmParseNumber(value) {
        const amount = Number(value);
        return Number.isFinite(amount) ? amount : Number.NaN;
    },
    __tmGetTaskTomatoFocusValues(task) {
        return {
            tomatoMinutes: Number(task?.tomatoMinutes ?? task?.tomato_minutes) || 0,
            tomatoHours: Number(task?.tomatoHours ?? task?.tomato_hours) || 0,
            tomatoCount: Number(task?.tomatoCount ?? task?.tomato_count) || 0,
        };
    },
    __tmFormatSpentHours(value) {
        const amount = Number(value);
        return Number.isFinite(amount) && amount > 0 ? `${Math.round(amount * 100) / 100}h` : '';
    },
};
vm.createContext(focusFormatterContext);
vm.runInContext(`${focusFormatterSource}\nthis.formatFocusDuration = __tmSummaryFormatFocusDuration;`, focusFormatterContext);
assert.equal(
    focusFormatterContext.formatFocusDuration({ tomatoMinutes: '90', tomatoHours: '8' }),
    '1.5h',
    'hour display format must convert the selected Tomato minute attribute without reading the hour attribute',
);
focusFormatterContext.SettingsStore.data.tomatoSpentAttrMode = 'hours';
focusFormatterContext.SettingsStore.data.durationFormat = 'minutes';
assert.equal(
    focusFormatterContext.formatFocusDuration({ tomatoMinutes: '999', tomatoHours: '1.25' }),
    '75min',
    'minute display format must convert the selected Tomato hour attribute without reading the minute attribute',
);
assert.match(source, /refreshedSourceIds[\s\S]*recurringSourceTaskId[\s\S]*merged\.delete/, 'refreshing a recurring source task must replace stale virtual instances in the summary cache');
assert.match(source, /const previousById = new Map\(\);[\s\S]*previousById\.get\(id\)/, 'summary refresh must preserve previously resolved display metadata without retaining stale recurring instances');
assert.match(source, /class="tm-summary-toolbar"/, 'summary filters must expose a scoped toolbar for plugin appearance');
assert.match(source, /const isMobileSummary = __tmIsMobileDevice\(\)/, 'summary mobile mode must use the same runtime device decision as the AI workbench host');
assert.match(source, /tm-summary-modal\$\{isMobileSummary \? ' tm-modal--mobile' : ''\}/, 'mobile summaries must opt into the shared full-screen modal state');
assert.match(source, /className = 'tm-box tm-summary-box'/, 'summary sizing must be scoped instead of relying on fixed inline dimensions');
assert.doesNotMatch(source, /width:min\(960px,95vw\);height:min\(88vh,860px\)/, 'inline desktop dimensions must not prevent the mobile modal from filling its host');
assert.match(source, /__tmApplyMobileBrowserViewportMetrics\(state\.summaryModal\)/, 'mobile browser summaries must use the shared visible viewport metrics');
assert.match(cssSource, /\.tm-box\.tm-summary-box \{[\s\S]*width: min\(960px, 95vw\);[\s\S]*height: min\(88vh, 860px\);/, 'desktop summaries must retain their existing bounded dimensions with precedence over the shared modal box');
assert.match(cssSource, /\.tm-summary-modal\.tm-modal--mobile \.tm-summary-box \{[\s\S]*width: 100%;[\s\S]*height: 100%;[\s\S]*border-radius: 0;/, 'mobile summary boxes must fill the available viewport without inset corners');
assert.match(cssSource, /\.tm-summary-modal\.tm-modal--mobile \.tm-summary-preview \{[\s\S]*min-height: 0;[\s\S]*resize: none/, 'mobile summary previews must shrink with the full-height layout');
assert.match(cssSource, /\.tm-summary-modal\.tm-modal--mobile \.tm-summary-footer \{[\s\S]*safe-area-inset-bottom/, 'mobile summary actions must respect the bottom safe area');
assert.equal((source.match(/class="tm-input" type="date"/g) || []).length, 2, 'both summary date inputs must retain the original native date control markup');
assert.match(cssSource, /\.tm-summary-toolbar \.tm-input\[type="date"\] \{[\s\S]*appearance: auto;[\s\S]*var\(--tm-input-bg\)[\s\S]*var\(--tm-text-color\)/, 'native summary date inputs must use plugin theme tokens without replacing the picker');
assert.match(cssSource, /\.tm-summary-toolbar \.tm-input\[type="date"\]:focus[\s\S]*var\(--tm-primary-color\)/, 'native summary date inputs must expose the plugin focus state');
assert.doesNotMatch(cssSource, /tm-summary[^\n]*calendar-picker-indicator/, 'summary styling must not replace the native date picker indicator');

const bulkLoader = segment('async function __tmSummaryLoadTasksByDocs', 'async function __tmSummaryLoadTasksByDocFallback');
const fallbackLoader = segment('async function __tmSummaryLoadTasksByDocFallback', 'async function __tmSummaryEnsureH2Contexts');
assert.doesNotMatch(`${bulkLoader}\n${fallbackLoader}`, /fetchH2Contexts/, 'opening the summary must not load heading context eagerly');
assert.match(source, /function __tmSummaryEnsureH2Contexts[\s\S]*groupBy[\s\S]*!== 'h2'[\s\S]*API\.fetchH2Contexts/, 'heading context must load only when grouping by heading');
assert.match(source, /ctx\.summaryH2ResolvedIds\.has\(id\)[\s\S]*t\.h2 =/, 'filtered task reloads must preserve already-resolved heading context');
assert.equal((source.match(/__tmExpandSourceEntryDocIds\(/g) || []).length, 1, 'summary opening must expand each configured document scope in one shared pass');
assert.match(source, /Promise\.all\(groups\.map[\s\S]*Promise\.all\(entries\.map/, 'independent summary document scopes must expand concurrently');
assert.match(source, /const __TM_SUMMARY_FILTER_STORAGE_KEY = 'tm_summary_filter'/, 'summary filters must use a dedicated Task Horizon local storage key');
assert.match(source, /function __tmSummaryLoadSavedFilter[\s\S]*Storage\.get\(__TM_SUMMARY_FILTER_STORAGE_KEY/, 'opening the summary must load the previous filter');
assert.match(source, /function __tmSummarySaveFilter[\s\S]*Storage\.set\(__TM_SUMMARY_FILTER_STORAGE_KEY/, 'summary filter changes must persist locally');
assert.match(source, /const savedFilter = __tmSummaryLoadSavedFilter\(\);[\s\S]*__tmSummaryApplySavedFilter\(root, savedFilter\)/, 'available summary controls must restore before data loading');
assert.match(source, /__tmSummaryRefreshDocOptions\(root, ctx\);[\s\S]*__tmSummaryApplySavedFilter\(root, savedFilter, \{ includeDoc: true \}\)/, 'the saved document must restore after its option list is available');
assert.match(source, /root\.addEventListener\('change'[\s\S]*__tmSummarySaveFilter\(filter\)/, 'every summary filter change must save the latest state');
assert.match(source, /control\.tagName === 'SELECT'[\s\S]*control\.value = exists \? next : fallback/, 'deleted groups, documents, or options must fall back to a valid filter value');
const savedFilterNormalizerSource = segment('function __tmSummaryNormalizeSavedFilter', 'function __tmSummaryLoadSavedFilter');
const savedFilterContext = {
    __tmNormalizeDateOnly(value) {
        const text = String(value || '').trim();
        return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : '';
    },
};
vm.createContext(savedFilterContext);
vm.runInContext(`${savedFilterNormalizerSource}\nthis.normalizeSavedFilter = __tmSummaryNormalizeSavedFilter;`, savedFilterContext);
assert.deepEqual(
    JSON.parse(JSON.stringify(savedFilterContext.normalizeSavedFilter({
        preset: 'custom',
        start: '2026-08-01',
        end: '2026-08-12',
        groupId: 'group-a',
        docId: 'doc-a',
        status: 'doing',
        priority: 'high',
        groupBy: 'date',
        fields: { taskName: true, docName: true, priority: false, status: true, dueDate: true, completionDate: false, focusDuration: true },
    }))),
    {
        preset: 'custom',
        start: '2026-08-01',
        end: '2026-08-12',
        groupId: 'group-a',
        docId: 'doc-a',
        status: 'doing',
        priority: 'high',
        groupBy: 'date',
        fields: { taskName: true, docName: true, priority: false, status: true, dueDate: true, completionDate: false, focusDuration: true },
    },
    'a valid custom summary range and all filter fields must survive normalization',
);
const legacyDateFilter = savedFilterContext.normalizeSavedFilter({ fields: { date: true } });
assert.equal(legacyDateFilter.fields.dueDate, true, 'legacy date-field selections must enable due date display');
assert.equal(legacyDateFilter.fields.completionDate, true, 'legacy date-field selections must enable completion date display');
const repairedFilter = savedFilterContext.normalizeSavedFilter({ preset: 'broken', priority: 'urgent', groupBy: 'broken', start: 'not-a-date' });
assert.equal(repairedFilter.preset, 'this_week', 'an invalid saved preset must fall back to the original weekly default');
assert.equal(repairedFilter.priority, '__all__', 'an invalid saved priority must fall back to all priorities');
assert.equal(repairedFilter.groupBy, 'status', 'an invalid saved grouping must fall back to status');
assert.equal(repairedFilter.start, '', 'an invalid saved custom date must be discarded');

const summaryDateHelpersSource = segment('function __tmSummaryDateKeyFromTs', 'async function __tmSummaryBuildDocNameMapByGroups');
const collectorSource = segment('function __tmSummaryCollectTasks', 'function __tmSummaryGenerateMarkdown');
const collectorContext = {
    __tmParseTimeToTs(value) {
        const ts = Date.parse(String(value || '').trim());
        return Number.isFinite(ts) ? ts : 0;
    },
    __tmSummaryGetGroupIds(filter) {
        return Array.isArray(filter?.groupIds) ? filter.groupIds : ['__all__'];
    },
    __tmIsTaskDoneEffective(task) {
        return task?.done === true;
    },
    __tmIsTaskActive(task) {
        return task?.done !== true && task?.customStatus !== 'canceled';
    },
    __tmResolveTaskStatusId(task) {
        return String(task?.customStatus || (task?.done ? 'done' : 'todo'));
    },
    __tmResolveTaskMarker(task) {
        return task?.done ? 'x' : ' ';
    },
    __tmSummaryRecurringLabel() {
        return '';
    },
    __tmSummaryFormatFocusDuration() {
        return '';
    },
    __tmSummaryCompareTasksByCompletion(a, b) {
        return (Number(a?.completedAtTs) || 0) - (Number(b?.completedAtTs) || 0)
            || String(a?.content || '').localeCompare(String(b?.content || ''), 'zh-Hans-CN');
    },
    __tmT(key) {
        return key;
    },
};
vm.createContext(collectorContext);
vm.runInContext(
    `${summaryDateHelpersSource}\n${collectorSource}\nthis.collectTasks = __tmSummaryCollectTasks;`,
    collectorContext,
);
const summaryFilter = {
    start: '2026-11-02',
    end: '2026-11-08',
    status: '__all__',
    priority: '__all__',
    docId: '__all__',
    groupIds: ['__all__'],
};
const summaryTaskContext = {
    docNameMap: { doc: 'Doc' },
    docGroupIdsMap: { doc: ['group'] },
    summaryTasks: [
        { id: 'active-in-range', content: 'Active', done: false, completionTime: '2026-11-05', docId: 'doc' },
        { id: 'done-in-range', content: 'Done', done: true, completionTime: '2026-10-20', taskCompleteAt: '2026-11-04T10:00:00+08:00', docId: 'doc' },
        { id: 'active-outside', content: 'Active outside', done: false, completionTime: '2026-11-09', docId: 'doc' },
        { id: 'done-outside', content: 'Done outside', done: true, completionTime: '2026-11-06', taskCompleteAt: '2026-10-20T10:00:00+08:00', docId: 'doc' },
        { id: 'active-no-date', content: 'No date', done: false, docId: 'doc' },
    ],
};
const collectedRangeTasks = collectorContext.collectTasks(summaryTaskContext, summaryFilter);
assert.deepEqual(
    Array.from(collectedRangeTasks, (task) => task.id).sort(),
    ['active-in-range', 'done-in-range'],
    'bounded summaries must filter unfinished tasks by due date and completed tasks by completion date',
);
assert.equal(collectedRangeTasks.find((task) => task.id === 'active-in-range')?.dueDate, '2026-11-05', 'summary rows must retain the due date');
assert.equal(collectedRangeTasks.find((task) => task.id === 'done-in-range')?.completionDate, '2026-11-04', 'summary rows must retain the completion date');
const collectedUndoneTasks = collectorContext.collectTasks(summaryTaskContext, { ...summaryFilter, status: '__undone__' });
assert.deepEqual(Array.from(collectedUndoneTasks, (task) => task.id), ['active-in-range'], 'unfinished status filtering must compose with due-date filtering');
const collectedAllTimeTasks = collectorContext.collectTasks(summaryTaskContext, { ...summaryFilter, start: '', end: '' });
assert.ok(collectedAllTimeTasks.some((task) => task.id === 'active-no-date'), 'all-time summaries must retain unfinished tasks without a due date');

const markdownSource = segment('function __tmSummaryGenerateMarkdown', 'const __TM_SUMMARY_FILTER_STORAGE_KEY');
const markdownContext = {
    __tmSummaryFormatChinaDateTime() {
        return '2026-11-02 10:00:00';
    },
    __tmSummaryGetGroupIds(filter) {
        return Array.isArray(filter?.groupIds) ? filter.groupIds : ['__all__'];
    },
    __tmSummaryGroupLabel() {
        return '全部分组';
    },
    __tmSummaryPriorityText() {
        return '无';
    },
    __tmSummaryDateFmt() {
        return '2026-11-02';
    },
    __tmIsTaskActive(task) {
        return task?.done !== true;
    },
    __tmResolveTaskMarker(task) {
        return task?.done ? 'x' : ' ';
    },
    __tmSummaryStatusName(task) {
        return task?.done ? '已完成' : '未完成';
    },
};
vm.createContext(markdownContext);
vm.runInContext(`${markdownSource}\nthis.generateMarkdown = __tmSummaryGenerateMarkdown;`, markdownContext);
const markdownTasks = [
    { content: '未完成任务', done: false, dueDate: '2026-11-05', completionDate: '', dateKey: '2026-11-05', docName: '文档', priority: 'none', level: 0 },
    { content: '已完成任务', done: true, dueDate: '2026-10-20', completionDate: '2026-11-04', dateKey: '2026-11-04', docName: '文档', priority: 'none', level: 0 },
];
const markdownFilter = {
    preset: 'this_week_report',
    start: '2026-11-02',
    end: '2026-11-08',
    groupIds: ['__all__'],
    docId: '__all__',
    status: '__all__',
    priority: '__all__',
    groupBy: 'status',
    fields: { taskName: true, docName: false, priority: false, status: false, dueDate: true, completionDate: false, focusDuration: false },
};
const dueOnlyMarkdown = markdownContext.generateMarkdown(markdownTasks, markdownFilter, {
    statusMap: new Map(),
    groupNameMap: { '__all__': '全部分组' },
    docNameMap: { doc: '文档' },
});
assert.match(dueOnlyMarkdown, /\[2026-11-05\]/, 'due-date display must be controlled independently');
assert.match(dueOnlyMarkdown, /未完成任务 \[2026-11-05\]/, 'due date must appear after the task name');
assert.doesNotMatch(dueOnlyMarkdown, /\[2026-11-05\] 未完成任务/, 'due date must not appear before the task name');
assert.doesNotMatch(dueOnlyMarkdown, /\[2026-11-04\]/, 'enabling due date must not implicitly enable completion date');
assert.doesNotMatch(dueOnlyMarkdown, /截止日期:|完成日期:/, 'summary output must not prefix date values with field names');
const completionOnlyMarkdown = markdownContext.generateMarkdown(markdownTasks, {
    ...markdownFilter,
    fields: { ...markdownFilter.fields, dueDate: false, completionDate: true },
}, {
    statusMap: new Map(),
    groupNameMap: { '__all__': '全部分组' },
    docNameMap: { doc: '文档' },
});
assert.match(completionOnlyMarkdown, /\[2026-11-04\]/, 'completion-date display must be controlled independently');
assert.match(completionOnlyMarkdown, /已完成任务 \[2026-11-04\]/, 'completion date must appear after the task name');
assert.doesNotMatch(completionOnlyMarkdown, /\[2026-11-04\] 已完成任务/, 'completion date must not appear before the task name');
assert.doesNotMatch(completionOnlyMarkdown, /\[2026-11-05\]/, 'enabling completion date must not implicitly enable due date');
const emptyDateMarkdown = markdownContext.generateMarkdown([{
    content: '无日期任务',
    done: false,
    dueDate: '',
    completionDate: '   ',
    dateKey: '',
    docName: '文档',
    priority: 'none',
    level: 0,
}], {
    ...markdownFilter,
    fields: { ...markdownFilter.fields, dueDate: true, completionDate: true },
}, {
    statusMap: new Map(),
    groupNameMap: { '__all__': '全部分组' },
    docNameMap: { doc: '文档' },
});
assert.doesNotMatch(emptyDateMarkdown, /\[\]/, 'empty dates must not render as empty square brackets');

const modalMountedAt = source.indexOf('document.body.appendChild(state.summaryModal);');
const firstPaintAt = source.indexOf('await new Promise((resolve) => requestAnimationFrame(resolve));');
const dataLoadAt = source.indexOf('const docNamesPromise = __tmSummaryBuildDocNameMapByGroups(docNameMap);');
assert.ok(modalMountedAt >= 0 && modalMountedAt < firstPaintAt && firstPaintAt < dataLoadAt, 'summary modal must paint before document and task loading starts');

console.log('summary runtime contract tests passed');
