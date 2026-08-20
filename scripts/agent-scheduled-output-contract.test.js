'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'ai', 'agent-workbench.js'), 'utf8');
const helperStart = source.indexOf('function sanitizeAutomationOutput(markdown)');
const helperEnd = source.indexOf('\n    async function ensureAutomationTaskToolsReady', helperStart);
assert.ok(helperStart >= 0 && helperEnd > helperStart, 'scheduled output sanitizer must remain extractable');

const context = vm.createContext({ String });
vm.runInContext(`${source.slice(helperStart, helperEnd)}\nthis.sanitizeAutomationOutput = sanitizeAutomationOutput;`, context);

const leaked = '按无人值守模式执行：直接使用附带的 5 个任务，只读 SQL 补充统计字段： ## 📋 今日完成一览 · 2026-08-20\n\n实际完成 5 项。';
assert.equal(context.sanitizeAutomationOutput(leaked), '## 📋 今日完成一览 · 2026-08-20\n\n实际完成 5 项。');
const leakedVariant = '按无人值守模式执行：直接使用附带的 18 个任务，只读 SQL 复查统计字段： ## 📋 今日完成一览 · 2026-08-20\n\n实际完成 18 项。';
assert.equal(context.sanitizeAutomationOutput(leakedVariant), '## 📋 今日完成一览 · 2026-08-20\n\n实际完成 18 项。');
assert.equal(context.sanitizeAutomationOutput('## 正常报告\n\n没有内部说明。'), '## 正常报告\n\n没有内部说明。');

console.log('agent scheduled output contract tests passed');
