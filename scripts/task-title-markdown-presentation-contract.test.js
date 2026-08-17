'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const read = (...parts) => fs.readFileSync(path.join(root, ...parts), 'utf8');
const apiSource = read('src', 'task-horizon', 'main', '20-api-and-runtime-services.js');
const ganttSource = read('src', 'task-horizon', 'main', 'shell', '82-gantt-runtime.js');
const calendarSource = read('calendar-view.js');
const calendarSupportSource = read('src', 'task-horizon', 'main', 'render', '48-render-calendar-support-runtime.js');
const homepageSource = read('homepage.js');
const aiSource = read('ai.js');
const quickbarSource = read('quickbar.js');
const detailSource = read('src', 'task-horizon', 'main', 'task-runtime', '52-task-detail-runtime.js');
const liveSource = read('src', 'task-horizon', 'main', 'task-runtime', '51-whiteboard-and-link-runtime.js');

const sliceBetween = (source, startToken, endToken, label) => {
    const start = source.indexOf(startToken);
    const end = source.indexOf(endToken, start + startToken.length);
    assert.ok(start >= 0 && end > start, `${label} must remain extractable`);
    return source.slice(start, end);
};

const taskLineHelpers = sliceBetween(
    apiSource,
    '    function __tmGetTaskListItemMarkerPrefixMatch',
    '    function __tmNormalizeTaskListItemMarkdownMarker',
    'task content line helpers',
);
const inlineHelpers = sliceBetween(
    apiSource,
    '    function __tmIsTaskInlineEscaped',
    '    function __tmRememberTaskContentHtml',
    'task title inline renderer',
);
const rememberHtml = sliceBetween(
    apiSource,
    '    function __tmRememberTaskContentHtml',
    '    function __tmRememberTaskStatusParse',
    'task title renderer cache helper',
);
const textHelper = sliceBetween(
    apiSource,
    '    function __tmExtractTaskContentTextFromHtml',
    '    function __tmResolveTaskContentRenderSource',
    'task title text extraction',
);
const apiMethods = sliceBetween(
    apiSource,
    '        renderTaskContentHtml(markdown, fallback = \'\')',
    '        parseTaskStatus(markdown)',
    'task title API methods',
);

const decodeText = (html) => String(html || '')
    .replace(/<[^>]*>/g, '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&');
const context = vm.createContext({
    Map,
    String,
    document: {
        createElement() {
            const content = { textContent: '' };
            return {
                content,
                set innerHTML(value) {
                    content.textContent = decodeText(value);
                },
            };
        },
    },
});
vm.runInContext(`
    const esc = (value) => String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    const __tmTaskContentHtmlCache = new Map();
    ${taskLineHelpers}
    ${inlineHelpers}
    ${rememberHtml}
    ${textHelper}
    const API = {
        extractTaskContentLine(markdown) { return __tmExtractTaskOwnContentLine(markdown); },
        normalizeTaskContent(content) { return String(content || '').replace(/\\s+/g, ' ').trim(); },
        ${apiMethods}
    };
    this.API = API;
`, context);

const renderer = context.API;
assert.equal(
    renderer.renderTaskContentHtml('- [ ] ## 标题 **粗体**', ''),
    '标题 <strong>粗体</strong>',
    'the existing renderer must keep heading removal and strong rendering',
);
assert.equal(
    renderer.renderTaskContentHtml('- [ ] [链接](https://example.com)', ''),
    '<span class="tm-linked-text">链接</span>',
    'the existing renderer must keep safe markdown-link labels',
);
assert.equal(
    renderer.renderTaskContentHtml('- [ ] ((20260817000000-abcdefg "块标题"))', ''),
    '<span class="tm-linked-text tm-task-title-block-ref" data-tm-block-ref-id="20260817000000-abcdefg"><span class="tm-task-title-block-ref__text">块标题</span></span>',
    'the existing renderer must keep block-reference rendering',
);
assert.equal(renderer.renderTaskContentHtml('- [ ] \\# 字面标题', ''), '# 字面标题');
assert.equal(renderer.renderTaskContentHtml('- [ ] 使用 `code()`', ''), '使用 <code>code()</code>');
assert.equal(renderer.renderTaskContentHtml('- [ ] <img src=x onerror=alert(1)>安全', ''), '安全');
assert.equal(renderer.renderTaskContentHtml('', ''), '(无内容)');
assert.equal(renderer.renderTaskContentHtml('', '## 备用 **标题**'), '备用 <strong>标题</strong>');

const presentation = renderer.getTaskTitlePresentation('- [ ] ## 标题 **粗体**', '');
assert.equal(presentation.html, '标题 <strong>粗体</strong>');
assert.equal(presentation.text, '标题 粗体');
const dangerousPresentation = renderer.getTaskTitlePresentation('- [ ] <img src=x onerror=alert(1)>安全', '备用');
assert.equal(dangerousPresentation.html, '安全');
assert.equal(dangerousPresentation.text, '安全');

assert.match(apiSource, /globalThis\.__tmGetTaskTitlePresentation\s*=\s*function/,
    'standalone modules must receive one lifecycle-managed title bridge');
assert.match(ganttSource, /taskTitleHtml:\s*taskTitlePresentation\.html/);
assert.match(ganttSource, /tm-gantt-bar__title[^\n]*\$\{visual\.taskTitleHtml\}/,
    'Gantt cards must use the safe task-title HTML');
assert.match(calendarSource, /function buildTaskEventTitleNode[\s\S]*options\?\.rich === true[\s\S]*titleText\.innerHTML = presentation\.html/);
assert.match(calendarSource, /buildTaskEventTitleNode\([\s\S]*rich:\s*!!taskLikeId/,
    'calendar schedules must enable rich titles only when linked to a task');
assert.match(calendarSource, /data-task-title="\$\{esc\(titlePresentation\.text\)\}"/,
    'calendar task drag metadata must use plain presentation text');
assert.match(calendarSupportSource, /titleMarkdown:\s*String\(t\?\.markdown \|\| t\?\.content \|\| title/,
    'task-date events must retain their markdown source for custom rendering');
assert.match(homepageSource, /tm-homepage-list-title[^\n]*\$\{titlePresentation\.html\}/);
assert.match(aiSource, /currentTitle = getTaskTitlePresentation\(item\.currentTitle[\s\S]*\$\{currentTitle\.html\}/,
    'AI SMART results must render existing task labels through the shared presentation');
const quickbarNormalizer = sliceBetween(
    quickbarSource,
    '        function normalizeReminderTaskName',
    '        async function openReminderDialogForCurrentTask',
    'quickbar task title adapter',
);
assert.match(quickbarNormalizer, /__tmGetTaskTitlePresentation/);
assert.doesNotMatch(quickbarNormalizer, /\.replace\s*\(/,
    'standalone title adapters must not maintain another markdown regex parser');
assert.match(detailSource, /tm-task-detail-parent-line[\s\S]*\$\{titleHtml\}/,
    'the detail parent line must render the shared safe HTML');
assert.match(liveSource, /hasContentPatch && viewMode === 'timeline'[\s\S]*__tmUpdateTimelineTaskInDOM\(tid\)/,
    'live title edits must rebuild the matching Gantt bar');
assert.match(liveSource, /closest\('\.tm-cal-task-event--schedule'\)\) return/,
    'task title edits must not overwrite a linked schedule custom title');
assert.match(detailSource, /<textarea[^>]*data-tm-detail="content"/,
    'the task detail editor must remain a raw markdown textarea');

console.log('task title markdown presentation contract tests passed');
