'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const names = ['task-capture', 'task-planning', 'task-review', 'task-template'];

for (const name of names) {
    const file = path.join(root, 'skills', name, 'SKILL.md');
    const content = fs.readFileSync(file, 'utf8').trim();
    const match = content.match(/^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]+)$/);
    assert.ok(match, `${name}: missing YAML frontmatter or body`);

    const metadata = Object.fromEntries(match[1].split(/\r?\n/).map((line) => {
        const index = line.indexOf(':');
        return index > 0 ? [line.slice(0, index).trim(), line.slice(index + 1).trim()] : ['', ''];
    }).filter(([key]) => key));

    assert.equal(metadata.name, name, `${name}: frontmatter name mismatch`);
    assert.ok(metadata.description, `${name}: description is empty`);
    assert.ok(match[2].trim().length >= 300, `${name}: body is unexpectedly short`);
    assert.match(match[2], /plugin__siyuan_plugin_task_horizon__/, `${name}: missing MCP tool prefix`);
    assert.match(match[2], /scopeToken/, `${name}: missing compact complete-scope guidance`);
    assert.match(match[2], /get_task_view_context[\s\S]*默认不传 `scope`/, `${name}: missing automatic active-tab scope guidance`);
    assert.match(match[2], /containerScopeToken[\s\S]*dateRange[\s\S]*includeVirtual/, `${name}: missing alternate structured-filter guidance`);
}

const workbench = fs.readFileSync(path.join(root, 'src/ai/agent-workbench.js'), 'utf8');
assert.match(workbench, /installedBlank[\s\S]*status = installedBlank \? 'repaired' : 'installed'/, 'empty installed skills must be repaired');
assert.match(workbench, /fetch\('\/api\/file\/getFile'/, 'bundled skills must use SiYuan file API');
assert.doesNotMatch(workbench, /fetch\(`\$\{SKILL_ROOT\}/, 'workspace paths must not be used as static URLs');

const template = fs.readFileSync(path.join(root, 'skills', 'task-template', 'SKILL.md'), 'utf8');
assert.match(template, /提醒意图选择/, 'template reminders must use the shared reminder intent choice');
assert.match(template, /manage_agent_schedules/, 'template must route Agent schedules to the kernel MCP');
assert.match(template, /configure_task_reminder/, 'template must route task reminders to the reminder MCP');
assert.match(template, /不要通过前端 Action/, 'template must not restore a frontend reminder chooser');

const capture = fs.readFileSync(path.join(root, 'skills', 'task-capture', 'SKILL.md'), 'utf8');
const planning = fs.readFileSync(path.join(root, 'skills', 'task-planning', 'SKILL.md'), 'utf8');
assert.match(planning, /durationCandidates[\s\S]*durationEstimates[\s\S]*确定性默认时长/, 'planning must ask the policy tool to resolve missing task durations');
assert.match(planning, /本次要求[\s\S]*任务已有预估时长[\s\S]*`durationEstimates`[\s\S]*不得写回任务 `duration`/, 'planning must preserve duration precedence without writing inferred values to tasks');
assert.match(planning, /60 分钟（写作规则）[\s\S]*25 分钟（默认）/, 'planning previews must disclose the source of inferred durations');
for (const [name, content] of [['task-capture', capture], ['task-planning', planning], ['task-template', template]]) {
    assert.match(content, /virtualTask: true[\s\S]*只读[\s\S]*repeatinst:[\s\S]*taskId[\s\S]*scopeToken/, `${name}: virtual recurring instances must remain read-only while supporting scoped schedule links`);
    assert.match(content, /create_schedule[\s\S]*update_schedule[\s\S]*(?:batch_schedules|批量)[\s\S]*(?:apply_task_operation_plan|组合操作)/, `${name}: virtual schedule guidance must cover direct, batch, and combined operations`);
}
for (const [name, content] of [['task-capture', capture], ['task-planning', planning]]) {
    assert.match(content, /follow\.date[\s\S]*同时写入任务截止日期[\s\S]*默认(?:在完成提醒时)?同步完成任务/, `${name}: follow reminders must derive and persist the requested deadline`);
    assert.match(content, /禁止(?:再)?询问是否设置截止日期/, `${name}: missing deadlines must not trigger another question`);
    assert.match(content, /今天\/今晚[\s\S]*唯一确定为当日[\s\S]*禁止生成“今天\/明天”或其他日期候选/, `${name}: explicit dates must not produce alternative-date questions`);
    assert.match(content, /action=apply[\s\S]*单次[\s\S]*不要(?:先)?预览[\s\S]*previewToken/, `${name}: reminders must use one direct write call`);
    assert.match(content, /没有由上下文明确绑定真实任务块时[\s\S]*query_tasks[\s\S]*filters\.keyword[\s\S]*检索全部任务/, `${name}: unbound reminders must query all tasks before creating one`);
    assert.match(content, /(?:不要沿用[\s\S]*scopeToken[\s\S]*filters[\s\S]*不要传[\s\S]*ids[\s\S]*documentIDs|filters[\s\S]*不传[\s\S]*scopeToken[\s\S]*ids[\s\S]*documentIDs)/, `${name}: reminder deduplication must not inherit a limited task scope`);
    assert.match(content, /优先使用未完成[\s\S]*(?:完全一致|语义明确对应)[\s\S]*有多个合理候选时[\s\S]*question/, `${name}: reminder candidate selection must prefer unfinished tasks and resolve ambiguity`);
    assert.match(content, /只有没有合理候选时[\s\S]*taskTitle[\s\S]*documentID[\s\S]*不要先调用 `create_task`/, `${name}: only a missing candidate may use the reminder creation fallback`);
    assert.match(content, /按可见标题[\s\S]*先精确、再模糊查重[\s\S]*允许少量错字[\s\S]*优先绑定未完成/, `${name}: the reminder tool must retain exact-first fuzzy visible-title matching`);
}
assert.match(template, /action=apply[\s\S]*单次[\s\S]*configure_task_reminder[\s\S]*不要预览/, 'template reminders must use one direct write call');
assert.match(template, /没有由上下文明确绑定真实任务块时[\s\S]*query_tasks[\s\S]*filters\.keyword[\s\S]*检索全部任务/, 'template reminders must query all tasks before creating one');
assert.match(template, /只有没有合理候选时[\s\S]*taskTitle[\s\S]*documentID[\s\S]*不要先调用 `create_task`/, 'template reminders may create a carrier task only after candidate lookup misses');
assert.match(template, /按可见标题[\s\S]*先精确、再模糊查重[\s\S]*允许少量错字[\s\S]*优先绑定未完成/, 'template reminders must retain exact-first fuzzy visible-title matching');
assert.match(capture, /单个任务不做额外预览或确认[\s\S]*直接使用 `create_task`/, 'single-task capture must use the fast direct-create path');

console.log('skill contract tests passed');
