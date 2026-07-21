'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const workbench = fs.readFileSync(path.join(root, 'src/ai/agent-workbench.js'), 'utf8');
const styles = fs.readFileSync(path.join(root, 'src/ai/agent-workbench.css'), 'utf8');
const renderConversationStart = workbench.indexOf('function renderConversation(entries, live)');
const renderConversationEnd = workbench.indexOf('\n    function settleLiveBeforeInteraction()', renderConversationStart);
const renderConversationSource = workbench.slice(renderConversationStart, renderConversationEnd);

assert.match(workbench, /copy: 'M216,28H88A12/, 'copy action must use the Phosphor Bold copy path');
assert.match(workbench, /check: 'M232\.49,80\.49l-128,128/, 'copy feedback must use the Phosphor Bold check path');
assert.match(workbench, /data-agent-action="copy-message" data-index="\$\{Number\(index\)\}"/, 'message copy actions must address the rendered conversation entry');
assert.match(workbench, /tm-agent-message--user"><div class="tm-agent-message__body">[\s\S]*renderMessageActions\(index, text\(entry\.content\)\)/, 'user copy actions must follow the message body');
assert.match(workbench, /tm-agent-message--assistant">\$\{todo\}\$\{tools\}<div class="tm-agent-message__body tm-agent-markdown b3-typography">[\s\S]*renderMessageActions\(index, text\(entry\.content\)\)/, 'Agent execution cards must precede the response while copy actions remain at the end');
assert.match(workbench, /function renderToolGroup\(calls, completedResponse\)[\s\S]*class="tm-agent-tool-group" \$\{completed \? '' : 'open'\}/, 'tool calls must share one expandable execution group');
assert.match(workbench, /renderToolGroup\(calls\.filter[\s\S]*true\);[\s\S]*renderToolGroup\(calls\.filter[\s\S]*live\.done === true\)/, 'history tool groups must start collapsed while live tool groups stay open until the response completes');
assert.ok(renderConversationStart >= 0 && renderConversationEnd > renderConversationStart, 'conversation renderer must remain extractable');
assert.match(renderConversationSource, /type === 'user'[\s\S]*flushInteractions\(\);[\s\S]*type === 'confirm' \|\| type === 'question'[\s\S]*deferredInteractions\.push[\s\S]*renderLiveMessage\(live\);[\s\S]*flushInteractions\(\);/, 'confirm and question cards must render below all persisted and live output in their user turn');
const renderContext = vm.createContext({
    text: (value) => String(value == null ? '' : value).trim(),
    renderEntry: (entry, index) => `[${index}:${entry.type}:${entry.content || entry.confirmID || entry.questionID}]`,
    renderLiveMessage: (live) => live ? `[live:${live.content}]` : '',
});
vm.runInContext(`${renderConversationSource}\nthis.renderConversation = renderConversation;`, renderContext);
assert.equal(renderContext.renderConversation([
    { type: 'user', content: 'u1' },
    { type: 'question', questionID: 'q1' },
    { type: 'assistant', content: 'a1' },
    { type: 'confirm', confirmID: 'c1' },
    { type: 'user', content: 'u2' },
    { type: 'assistant', content: 'a2' },
    { type: 'question', questionID: 'q2' },
], { content: 'stream' }), '[0:user:u1][2:assistant:a1][1:question:q1][3:confirm:c1][4:user:u2][5:assistant:a2][live:stream][6:question:q2]', 'each turn must keep assistant output above its interaction cards');
const confirmEventSource = workbench.slice(workbench.indexOf("else if (event.type === 'confirm')"), workbench.indexOf("else if (event.type === 'question')"));
const questionEventSource = workbench.slice(workbench.indexOf("else if (event.type === 'question')"), workbench.indexOf("else if (event.type === 'frontend_tool_call')"));
assert.doesNotMatch(confirmEventSource, /settleLiveBeforeInteraction/, 'manual confirmations must not consume the live output that renders above them');
assert.doesNotMatch(questionEventSource, /settleLiveBeforeInteraction/, 'question cards must not consume the live output that renders above them');
assert.doesNotMatch(workbench, /tm-agent-message__label/, 'messages must not render redundant user or Agent labels');
assert.match(workbench, /navigator\?\.clipboard\?\.writeText[\s\S]*document\.execCommand\('copy'\)/, 'copy must support both modern and fallback clipboard APIs');
assert.match(workbench, /action === 'copy-message'[\s\S]*copyMessage\(target\.dataset\.index, target\)/, 'copy actions must be handled by the workbench event delegate');
assert.match(workbench, /function failedRetryPayload\(call\)[\s\S]*batch_tasks[\s\S]*batch_schedules[\s\S]*apply_task_operation_plan/, 'batch receipts must derive retries from failed operations only');
assert.match(workbench, /data-agent-action="retry-failed"[\s\S]*只重试失败项/, 'partial-failure receipts must expose a compact retry action');
assert.match(workbench, /action === 'retry-failed'[\s\S]*retryFailedToolCall\(id\)/, 'failed-item retry actions must be handled by the workbench event delegate');
assert.match(workbench, /event\.key === 'Enter' && !event\.isComposing && event\.keyCode !== 229 && !event\.shiftKey && !event\.altKey[\s\S]*event\.preventDefault\(\);[\s\S]*void sendMessage\(\);/, 'plain Enter must send while IME composition, Shift+Enter, and Alt+Enter remain available for text input');
assert.match(workbench, /function reminderIntentInstruction\(value\)[\s\S]*思源 question 工具[\s\S]*AI 定时任务[\s\S]*跟随任务提醒[\s\S]*独立提醒[\s\S]*custom=false/, 'ambiguous reminder requests must use the shared native Agent question flow');
assert.match(workbench, /跟随任务提醒（根据要求时间直接设置截止日期并默认同步完成任务）/, 'follow reminder guidance must reflect automatic deadline creation');
assert.match(workbench, /直接从用户原话解析日期和时间并传入 follow\.date[\s\S]*禁止调用 question 询问截止日期/, 'the Agent must derive and write the deadline without another question');
assert.match(workbench, /今天\/今晚[\s\S]*唯一确定为当日[\s\S]*禁止生成“今天\/明天”或任何其他日期候选/, 'explicit relative dates must never produce contradictory date choices');
assert.match(workbench, /configure_task_reminder 使用 action=apply 单次直接写入[\s\S]*不要先调用预览[\s\S]*previewToken/, 'reminder guidance must require one direct tool call');
assert.doesNotMatch(workbench, /\{ label: '同步完成'/, 'reminder confirmations must not display a redundant completion-sync choice');
assert.match(workbench, /parsed\.completionChanged === true[\s\S]*attrKey: 'custom-completion-time'[\s\S]*parsed\.completionTime \|\| ''/, 'follow reminder deadline changes, including clears, must refresh the task UI');
const parseDomainResultStart = workbench.indexOf('function parseDomainResult(result)');
const parseDomainResultEnd = workbench.indexOf('\n    function collectTaskMutationRefresh', parseDomainResultStart);
assert.ok(parseDomainResultStart >= 0 && parseDomainResultEnd > parseDomainResultStart, 'domain result parser must remain extractable');
const parseContext = vm.createContext({});
vm.runInContext(`${workbench.slice(parseDomainResultStart, parseDomainResultEnd)}\nthis.parseDomainResult = parseDomainResult;`, parseContext);
const wrappedReminderResult = parseContext.parseDomainResult('[tool_output]\n{"ok":true,"data":{"taskID":"task-1","hasReminder":true}}\n[/tool_output]');
assert.equal(wrappedReminderResult.taskID, 'task-1', 'wrapped Agent tool output must still drive reminder completion effects');
assert.equal(wrappedReminderResult.hasReminder, true);
const settleStart = workbench.indexOf('function settleLiveBeforeInteraction()');
const settleEnd = workbench.indexOf('\n    function contextLabels()', settleStart);
assert.ok(settleStart >= 0 && settleEnd > settleStart, 'live interaction settlement helper must remain extractable');
const settleRuntime = {
    session: { entries: [] },
    live: {
        content: '请先选择提醒类型：',
        status: '正在思考',
        toolCalls: [
            { name: 'done', completed: true, result: '{}' },
            { name: 'pending', completed: false, result: '' },
        ],
    },
};
const settleContext = vm.createContext({
    Date,
    JSON,
    runtime: settleRuntime,
    text: (value) => String(value == null ? '' : value).trim(),
    clone: (value) => JSON.parse(JSON.stringify(value)),
    newID: () => 'settled-entry',
    toolCallCompleted: (call) => call.completed === true,
});
vm.runInContext(`${workbench.slice(settleStart, settleEnd)}\nthis.settle = settleLiveBeforeInteraction;`, settleContext);
assert.equal(settleContext.settle(), true);
assert.equal(settleRuntime.session.entries[0].content, '请先选择提醒类型：');
assert.deepEqual(settleRuntime.session.entries[0].toolCalls.map((call) => call.name), ['done']);
assert.equal(settleRuntime.live.content, '');
assert.equal(settleRuntime.live.status, '');
assert.deepEqual(settleRuntime.live.toolCalls.map((call) => call.name), ['pending'], 'unfinished calls must remain live for their later tool_result');
assert.match(workbench, /任务提醒创建完成/, 'successful reminder execution must show explicit completion feedback');
assert.match(workbench, /type === 'question'[\s\S]*const card = `<div class="agent-chat__question-card">[\s\S]*agent-chat__question-item[\s\S]*agent-chat__question-options/, 'question cards must use SiYuan Agent native DOM nesting');
assert.match(workbench, /type="\$\{inputType\}"[\s\S]*agent-chat__question-option-label[\s\S]*agent-chat__question-option-desc/, 'the workbench must render native Agent question options and descriptions');
assert.match(workbench, /const answers = new Set[\s\S]*answers\.has\(option\.label\) \? 'checked'[\s\S]*customAnswer/, 'submitted native Agent questions must restore selected and custom answers');
assert.match(workbench, /function interactionArguments\(event\)[\s\S]*event\?\.arguments[\s\S]*JSON\.parse/, 'question events must accept serialized Agent arguments');
assert.match(workbench, /function normalizeQuestions\(value\)[\s\S]*source\.questions[\s\S]*question\?\.choices[\s\S]*typeof option === 'string'/, 'question cards must normalize direct questions, choices, and string options');
assert.match(workbench, /action === 'submit-question'[\s\S]*input:checked[\s\S]*data-question-custom[\s\S]*postQuestion\(id, answers\)/, 'question choices must be submitted through the native Agent question API');
assert.match(workbench, /return custom \? selected\.concat\(custom\) : selected/, 'custom question answers must be submitted alongside selected options like SiYuan');
assert.match(workbench, /questionOptionMouseState[\s\S]*wasChecked[\s\S]*questionInput\.checked = false/, 'native radio options must allow a selected choice to be cleared');
assert.match(workbench, /data-agent-action="stop"[\s\S]*xlink:href="#iconSquareStop"/, 'the streaming stop button must use SiYuan\'s native square-stop symbol');
assert.doesNotMatch(workbench, /xlink:href="#iconStop"/, 'the removed non-existent stop symbol must not be referenced');
assert.match(workbench, /type === 'confirm'[\s\S]*const card = `<div class="agent-chat__confirm-card">[\s\S]*agent-chat__confirm-header[\s\S]*agent-chat__confirm-args[\s\S]*agent-chat__confirm-actions/, 'confirmation cards must use SiYuan Agent native DOM nesting');
assert.match(workbench, /agent-chat__confirm-reject[\s\S]*agent-chat__confirm-approve[\s\S]*agent-chat__confirm-always/, 'confirmation cards must expose SiYuan reject, approve, and session-allow actions');
assert.match(workbench, /function renderConfirmEffects[\s\S]*agentEffectDataEgress[\s\S]*agentEffectExternalCost[\s\S]*agentEffectLocalWrite[\s\S]*agent-chat__confirm-effects/, 'SiYuan 3.7.3 confirmation effects must be preserved and rendered');
assert.match(workbench, /type === 'confirm'[\s\S]*processed[\s\S]*<details class="agent-chat__msg agent-chat__msg--confirm agent-chat__msg--confirmed tm-agent-interaction"/, 'completed confirmations must default to a native expandable summary');
assert.match(workbench, /type === 'question'[\s\S]*submitted[\s\S]*<details class="agent-chat__msg agent-chat__msg--question agent-chat__msg--confirmed tm-agent-interaction"/, 'submitted questions must default to a native expandable summary');
assert.match(workbench, /async function postConfirm\(confirmID, approved, always = false\)[\s\S]*await postAgentInteraction\('\/confirm'[\s\S]*entry\.status = always[\s\S]*saveSession/, 'confirm cards must persist their final state only after SiYuan accepts the interaction');
assert.match(workbench, /postConfirm\(confirmID[\s\S]*catch \(error\)[\s\S]*return false/, 'failed confirmations must remain retryable');
assert.match(workbench, /function automaticConfirmKind[\s\S]*TASK_HORIZON_READ_ONLY_TOOLS[\s\S]*name === 'configure_task_reminder'[\s\S]*name === 'create_task'[\s\S]*text\(args\.action\) === 'create'/, 'Task Horizon reads, direct reminders, and single-task creation must use automatic confirmation');
assert.doesNotMatch(workbench, /\.replace\(\/\^\.\*__\//, 'tool normalization must not trust an arbitrary plugin namespace');
assert.match(workbench, /TASK_HORIZON_TOOL_PREFIXES[\s\S]*isTaskHorizonToolName/, 'automatic approval must verify the Task Horizon plugin namespace');
assert.match(workbench, /const immediateKind = automaticConfirmKind\(event\)[\s\S]*await autoApproveImmediateWriteConfirm\(event\)[\s\S]*正在读取任务数据[\s\S]*正在新建任务[\s\S]*正在写入提醒/, 'read-only task calls and quick writes must continue without rendering a manual confirmation card');
assert.match(workbench, /没有由上下文明确绑定真实任务块时[\s\S]*调用 query_tasks[\s\S]*filters\.keyword=核心词[\s\S]*检索全部任务/, 'unbound reminders must query existing tasks before any creation fallback');
assert.match(workbench, /filters 不传 scopeToken、ids 或 documentIDs[\s\S]*不要沿用当前视图的范围令牌/, 'reminder deduplication must search globally instead of inheriting the current view scope');
assert.match(workbench, /优先选择未完成且标题完全一致[\s\S]*语义明确对应的未完成任务[\s\S]*taskID 传给 configure_task_reminder/, 'unbound reminder guidance must reuse a clear unfinished candidate');
assert.match(workbench, /有多个合理候选时用 question[\s\S]*只有没有合理候选时才省略 taskID[\s\S]*不要先调用 create_task/, 'ambiguous reminder targets must be resolved before the create fallback');
assert.match(workbench, /按可见标题在全部任务中先精确、再模糊兜底匹配[\s\S]*少量错字[\s\S]*两种匹配都找不到时才创建任务/, 'the reminder tool must retain exact-first fuzzy visible-title matching before creation');
assert.match(workbench, /任务来源'[\s\S]*taskMatchType === 'fuzzy' \? '已绑定相似任务' : '已绑定同名任务'/, 'reminder receipts must distinguish fuzzy and exact task reuse');
assert.match(workbench, /async function postQuestion[\s\S]*await postAgentInteraction\('\/question'[\s\S]*entry\.status = 'submitted'[\s\S]*saveSession/, 'question cards must persist their submitted state only after SiYuan accepts the interaction');
assert.match(workbench, /postQuestion\(questionID[\s\S]*catch \(error\)[\s\S]*return false/, 'failed questions must remain retryable');
assert.match(workbench, /invokeFrontendTool[\s\S]*postAgentInteraction\('\/frontendToolResult'/, 'frontend tool results must validate the SiYuan Agent API response');
assert.match(workbench, /buffer \+= decoder\.decode\(\);[\s\S]*for \(const raw of buffer\.split\('\\n'\)\)/, 'the SSE client must flush a final event without a trailing newline');
assert.match(workbench, /terminalReceived[\s\S]*完整终态/, 'the SSE client must reject a connection that closes without a terminal event');
assert.match(workbench, /function shouldFollowConversation[\s\S]*function restoreConversationScroll[\s\S]*function render\(options = \{\}\)[\s\S]*restoreConversationScroll\(messages/, 'full renders must preserve user-controlled conversation scrolling');
assert.match(workbench, /function scheduleStreamRender[\s\S]*requestAnimationFrame/, 'streaming events must be coalesced instead of rebuilding the DOM for every token');
assert.match(workbench, /conversationFollowBottom[\s\S]*target\.matches\('\.tm-agent-messages'\)[\s\S]*shouldFollowConversation\(target\)/, 'manual conversation scrolling must update one persistent follow-bottom state');
assert.match(workbench, /data-agent-action="scroll-to-bottom"[\s\S]*phosphorBoldContextIcon\('caretDown'\)/, 'the conversation must expose a familiar floating return-to-bottom action');
assert.match(workbench, /action === 'scroll-to-bottom'[\s\S]*scrollConversationToBottom\(\)/, 'the return-to-bottom action must restore automatic following');
assert.match(workbench, /tm-agent-undo-bar[\s\S]*data-agent-action="undo-last-mutation"[\s\S]*data-agent-action="dismiss-undo"[\s\S]*#iconClose/, 'the undo bar must expose a compact native close action');
assert.match(workbench, /action === 'dismiss-undo'[\s\S]*clearUndoAvailability\(\)[\s\S]*render\(\)/, 'dismissing the undo bar must hide only the current notice');
assert.match(workbench, /roundUndoIDs[\s\S]*taskHorizonGroupUndoMutations[\s\S]*本轮 AI 操作/, 'all reversible writes from one AI turn must be grouped behind one undo token');
{
    const restoreStart = workbench.indexOf('function restoreConversationScroll(messages, snapshot, follow)');
    const restoreEnd = workbench.indexOf('\n    function scheduleStreamRender()', restoreStart);
    const frames = [];
    class MockElement {
        constructor() { this._scrollTop = 0; this.scrollHeight = 300; this.clientHeight = 300; this.isConnected = true; }
        set scrollTop(value) { this._scrollTop = Math.max(0, Math.min(Number(value) || 0, this.scrollHeight - this.clientHeight)); }
        get scrollTop() { return this._scrollTop; }
    }
    const context = vm.createContext({
        HTMLElement: MockElement,
        requestAnimationFrame: (callback) => frames.push(callback),
        Math,
        runtime: { conversationFollowBottom: false },
        updateConversationBottomButton() {},
    });
    vm.runInContext(`${workbench.slice(restoreStart, restoreEnd)}\nthis.restore = restoreConversationScroll;`, context);
    const messages = new MockElement();
    context.restore(messages, { scrollTop: 480 }, false);
    assert.equal(messages.scrollTop, 0, 'the first layout may temporarily have no scroll range');
    messages.scrollHeight = 1000;
    frames.shift()();
    assert.equal(messages.scrollTop, 480, 'the second layout frame must restore the user position instead of leaving the conversation at the top');
}
assert.match(workbench, /hostListenerController\?\.abort[\s\S]*delete runtime\.host\.dataset\.tmAgentWorkbenchBound/, 'AI runtime cleanup must release delegated host listeners and its binding marker');
assert.doesNotMatch(workbench, /reminderIntentChoice|choose-reminder-kind|renderReminderIntentChoice/, 'the removed frontend reminder dialog must not remain');
assert.match(styles, /\.tm-agent-messages\s*\{[\s\S]*-webkit-user-select: text !important;[\s\S]*user-select: text !important;/, 'the conversation surface must allow text selection');
assert.match(styles, /\.tm-agent-message__body,[\s\S]*\.tm-agent-message__body \*[\s\S]*user-select: text !important;/, 'rendered message content must override host selection restrictions');
assert.match(styles, /\.tm-agent-message__actions\s*\{[\s\S]*justify-content: flex-end;[\s\S]*opacity: 0;/, 'message actions must match the native Agent end-of-message placement');
assert.match(styles, /\.tm-agent-message:hover \.tm-agent-message__actions,[\s\S]*focus-within[\s\S]*opacity: 1;/, 'message actions must reveal on hover and keyboard focus');
assert.match(styles, /\.tm-agent-message__copy\s*\{[\s\S]*width: 20px;[\s\S]*height: 20px;/, 'copy controls must remain compact');
assert.match(styles, /\.tm-agent-composer__row\s*\{[\s\S]*align-items: center;/, 'send and stop buttons must stay vertically centered beside the composer');
assert.match(styles, /\.tm-agent-tool-group\s*\{[\s\S]*border: 1px solid var\(--b3-border-color\)/, 'the execution group must use the native Agent tool-card surface');
assert.doesNotMatch(styles, /\.tm-agent-(?:confirm|question)/, 'confirm and question cards must not override SiYuan Agent native styles');
assert.match(styles, /\.tm-agent-interaction__summary[\s\S]*grid-template-columns:[\s\S]*\.tm-agent-interaction\[open\][\s\S]*rotate\(90deg\)/, 'completed interaction summaries must expose a compact keyboard-accessible disclosure');
assert.match(styles, /\.tm-agent-result__actions\s*\{[\s\S]*justify-content: flex-end;/, 'failed-item retry actions must follow the native compact result layout');
assert.match(styles, /\.tm-agent-undo-bar__close\s*\{[\s\S]*width: 28px;[\s\S]*height: 28px;/, 'the undo dismiss action must remain a compact icon button');
assert.match(styles, /\.tm-agent-scroll-bottom\s*\{[\s\S]*border-radius: 50%;[\s\S]*box-shadow:/, 'the return-to-bottom control must be a compact floating circle');
assert.match(workbench, /catch \(error\) \{[\s\S]*clearUndoAvailability\(\);[\s\S]*整体撤销准备失败/, 'failed undo grouping must not silently fall back to the latest mutation');

console.log('agent message action contract tests passed');
