'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

async function main() {
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

vm.runInContext(sliceBetween(
    apiSource,
    '    globalThis.__tmGetTaskTitlePresentation = function',
    '    const __TM_WRITER_GUARD_STORAGE_KEY',
    'shared title presentation bridge',
), context);
vm.runInContext(read('src', 'task-horizon', 'main', '37-project-visibility-service.js'), context);
vm.runInContext(homepageSource.replace('    globalThis.__tmHomepage = {', `
    globalThis.__homepageProjectTitleTest = {
        renderProjectH2Card,
        renderProjectDocCard,
        renderProjectsDocScope,
        renderProjectTimingStatusHtml,
        renderProjectProgressHtml,
        renderProjectsSection,
        isProjectCardCompleted,
        setHomepageProjectCompleted,
        isHomepageProjectCompleted,
    };
    globalThis.__tmHomepage = {`), context);
const {
    renderProjectH2Card,
    renderProjectDocCard,
    renderProjectsDocScope,
    renderProjectTimingStatusHtml,
    renderProjectProgressHtml,
    renderProjectsSection,
    isProjectCardCompleted,
    setHomepageProjectCompleted,
    isHomepageProjectCompleted,
} = context.__homepageProjectTitleTest;
const savedHomepageSettings = [];
context.__tmHost = {
    async loadData() { return {}; },
    saveData(key, value) {
        savedHomepageSettings.push({ key, value });
        return Promise.resolve();
    },
};
const projectDoc = { id: 'doc-id', name: '示例文档', total: 17, done: 16, progress: 94 };
const projectHeading = { h2Id: 'heading-id', index: 13, total: 17, done: 16, progress: 94 };
const blockRefId = '20260820102422-qeltiuw';
assert.match(renderProjectTimingStatusHtml({ progress: 40, deadline: '2026-10-05' }, '2026-10-08'), /逾期3天/,
    'project deadline status must show the number of overdue days');
assert.match(renderProjectTimingStatusHtml({ progress: 40, deadline: '2026-10-10' }, '2026-10-08'), /剩余2天/,
    'project deadline status must show the number of remaining days');
assert.match(renderProjectTimingStatusHtml({ progress: 40, deadline: '2026-10-05' }, '2026-10-08', true), /已完成/,
    'a manually completed project must replace deadline warnings');
assert.equal(isProjectCardCompleted({ progress: 100 }), true,
    'an unmarked project must become complete automatically when all tasks are complete');
assert.match(renderProjectTimingStatusHtml({ progress: 100, deadline: '2026-10-05' }, '2026-10-08'), /已完成/,
    'an automatically completed project must replace deadline warnings');
assert.match(renderProjectProgressHtml({ progress: 40, expected: 70 }), /落后 30%/,
    'active cards must keep showing their schedule delta');
assert.doesNotMatch(renderProjectProgressHtml({ progress: 40, expected: 70 }, true), /落后|超前/,
    'completed cards must hide ahead/behind percentages');
await setHomepageProjectCompleted('doc', 'doc-id', true);
assert.equal(isHomepageProjectCompleted('doc', 'doc-id'), true);
assert.equal(savedHomepageSettings.at(-1)?.key, 'homepage-settings.json');
assert.equal(savedHomepageSettings.at(-1)?.value?.completedProjects?.['doc:doc-id'], true,
    'manual project completion must persist with homepage settings');
const completedDocCardHtml = renderProjectDocCard({ id: 'doc-id', name: '已完成文档', progress: 40 }, '2026-10-08');
assert.match(completedDocCardHtml, /tm-home-project-card[^\"]*is-completed/,
    'manually completed document cards must receive the stamp watermark state');
const autoCompletedDocCardHtml = renderProjectDocCard({ id: 'auto-doc-id', name: '自动完成文档', progress: 100 }, '2026-10-08');
assert.match(autoCompletedDocCardHtml, /tm-home-project-card[^\"]*is-completed/,
    'document cards at 100 percent must receive the stamp watermark automatically');
const sectionHtml = renderProjectsSection({
    label: '项目组',
    cards: [
        { id: 'doc-id', name: '已完成文档', overdueDays: 5, progress: 40 },
        { id: 'auto-doc-id', name: '自动完成文档', overdueDays: 4, progress: 100 },
        { id: 'other-doc-id', name: '逾期文档', overdueDays: 3, progress: 50 },
    ],
    agg: { overdueDocs: 3, total: 10, done: 4, pct: 40 },
});
assert.ok(sectionHtml.includes('1 个逾期'),
    'project groups must exclude manually completed documents from the overdue count');
await setHomepageProjectCompleted('doc', 'doc-id', false);
assert.equal(isHomepageProjectCompleted('doc', 'doc-id'), false, 'the context action must allow clearing completion');
assert.match(homepageSource, /\.tm-home-project-risk\s*\{[^}]*font-size:\s*10px/s);
assert.match(homepageSource, /\.tm-home-project-top \.days-remaining\s*\{[^}]*font-size:\s*10px/s,
    'remaining and overdue status badges must use the same font size');
const completedStampCss = homepageSource.match(/\.tm-home-project-card\.is-completed::after\s*\{([^}]*)\}/s)?.[1] || '';
assert.match(completedStampCss, /content:\s*""/);
assert.doesNotMatch(completedStampCss, /已完成|\\A|✓/, 'the stamp must not contain a text label or glyph checkmark');
assert.match(completedStampCss, /right:\s*-24px[\s\S]*width:\s*92px[\s\S]*height:\s*92px[\s\S]*border:\s*8px solid[\s\S]*transform:\s*translateY\(-50%\) rotate\(-20deg\)/,
    'the stamp must have one thick solid outer ring and a subtle counterclockwise rotation');
assert.doesNotMatch(completedStampCss, /box-shadow/,
    'the stamp must not draw an inner ring');
const completedStampTickCss = homepageSource.match(/\.tm-home-project-card\.is-completed::before\s*\{([^}]*)\}/s)?.[1] || '';
assert.match(completedStampTickCss, /top:\s*50%[\s\S]*right:\s*10px[\s\S]*width:\s*25px[\s\S]*height:\s*48px[\s\S]*border-right:\s*8px solid[\s\S]*border-bottom:\s*8px solid[\s\S]*translateY\(-58%\) rotate\(35deg\)/,
    'the thick straight-line checkmark must use a clockwise 35 degree rotation');
assert.match(homepageSource, /runtime\.projectPointerDownHandler\s*=\s*\(event\)\s*=>\s*\{[\s\S]*event\?\.pointerType\s*!==\s*"touch"/,
    'project cards must support a touch-only long-press gesture');
assert.match(homepageSource, /Math\.hypot\(x - point\.x, y - point\.y\) > 12/,
    'moving a finger to scroll must cancel the pending long-press');
assert.match(homepageSource, /\}, 520\);/,
    'holding a project card must open its context menu after a short delay');
assert.match(homepageSource, /runtime\.projectLongPressSuppressClick\s*=\s*\{ card, expiresAt:/,
    'the click following a long-press must not activate the underlying project card');
for (const quote of ['"', "'"]) {
    const name = `((${blockRefId} ${quote}项目计划${quote}))`;
    const html = renderProjectsDocScope({ doc: projectDoc, h2Cards: [{ ...projectHeading, name }] });
    assert.ok(html.includes(`class="tm-linked-text tm-task-title-block-ref" data-tm-block-ref-id="${blockRefId}"`),
        'single-document project cards must preserve the shared block-reference presentation');
    assert.ok(html.includes('<span class="tm-task-title-block-ref__text">项目计划</span>'));
    assert.ok(html.includes('title="「示例文档」/ 项目计划"'), 'card tooltips must use the readable heading label');
    assert.ok(html.includes('<span class="tm-home-project-cal-name">项目计划</span>'),
        'the date button must use the readable heading label');
    assert.ok(html.includes('data-tm-home-project-id="heading-id"'), 'date editing must still target the heading');
    assert.ok(html.includes('<span class="tm-home-project-h2-index">14</span>'));
    assert.doesNotMatch(html, /\(\(20260820102422-qeltiuw/, 'raw block-reference syntax must not leak into the card');
}
for (const [name, expectedHtml, expectedText] of [
    ['普通标题', '普通标题', '普通标题'],
    ['## **方案** / [文档](https://example.com) / `API`',
        '<strong>方案</strong> / <span class="tm-linked-text">文档</span> / <code>API</code>', '方案 / 文档 / API'],
    ['"发布日期" & <img src=x onerror=alert(1)>安全', '&quot;发布日期&quot; &amp; 安全', '&quot;发布日期&quot; &amp; 安全'],
    ['', '(空标题)', '(空标题)'],
]) {
    const html = renderProjectH2Card({ ...projectHeading, name }, projectDoc);
    assert.ok(html.includes(`<span class="tm-home-project-name">${expectedHtml}</span>`), name);
    assert.ok(html.includes(`title="「示例文档」/ ${expectedText}"`), name);
    assert.doesNotMatch(html, /<img\b|onerror=/, 'heading markup must use the shared safe renderer');
}
const noHeadingHtml = renderProjectH2Card({ ...projectHeading, h2Id: '', name: '未分类任务' }, projectDoc);
assert.ok(noHeadingHtml.includes('<span class="tm-home-project-name">未分类任务</span>'));
assert.doesNotMatch(noHeadingHtml, /data-tm-home-project-dates/, 'unclassified tasks must not get a heading date button');

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

}
main().catch((error) => { console.error(error); process.exitCode = 1; });
