'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const kernel = fs.readFileSync(path.join(root, 'kernel.js'), 'utf8');
const calendar = fs.readFileSync(path.join(root, 'calendar-view.js'), 'utf8');
const workbench = fs.readFileSync(path.join(root, 'src/ai/agent-workbench.js'), 'utf8');
const bridge = fs.readFileSync(path.join(root, 'src/task-horizon/main/shell/81-ai-bridge-runtime.js'), 'utf8');

assert.match(kernel, /copy\('reminderMode', \['reminderMode'\]\)/, 'AI schedules must persist the per-schedule reminder mode');
assert.match(kernel, /copy\('reminderEnabled', \['reminderEnabled'\]\)/, 'AI schedules must persist the per-schedule reminder switch');
assert.match(kernel, /copy\('reminderOffsetMin', \['reminderOffsetMin'\]\)/, 'AI schedules must persist the per-schedule reminder offset');
assert.match(kernel, /reminderOffsetMin:[\s\S]*仅支持 0、5、10、15、30、60[\s\S]*minimum: 0[\s\S]*maximum: 60/, 'the MCP schema must advertise supported reminder offsets without a numeric enum');
assert.doesNotMatch(kernel, /enum:\s*SCHEDULE_REMINDER_OFFSETS/, 'SiYuan Kernel only accepts string-valued JSON Schema enums');

assert.match(workbench, /SCHEDULE_MUTATION_TOOLS[\s\S]*refreshScheduleMutation/, 'AI schedule writes must enter the shared refresh bridge');
assert.match(bridge, /refreshSchedulesFromSharedFile[\s\S]*tm:calendar-schedule-updated/, 'the refresh bridge must reload schedules before notifying reminder consumers');
assert.match(calendar, /scheduleUpdatedListener[\s\S]*scheduleScheduleReminderRefresh/, 'schedule mutations must refresh the reminder engine');

assert.match(calendar, /function buildScheduleReminderRuntimeTimerKey\([\s\S]*meta\.title/, 'desktop timer identity must include notification content');
assert.match(calendar, /desiredTimers\.set\(buildScheduleReminderRuntimeTimerKey\(key, pack\), pack\)/, 'desktop timers must use the content-aware runtime key');
assert.match(calendar, /reconcileSingleScheduleMobileNotification[\s\S]*cancelScheduleMobileNotificationEntries\(validExistingEntries\)/, 'mobile schedule edits must cancel outdated appointments');
assert.match(calendar, /const existing = registry\[scheduleId\] \|\| getScheduleDeviceSchedule\(item\) \|\| null/, 'mobile reconciliation must prefer the latest local appointment registry');
assert.match(calendar, /cleanupOrphanScheduleMobileRegistry[\s\S]*cancelScheduleMobileNotificationEntries\(entry\?\.entries\)/, 'mobile schedule deletes must cancel orphaned appointments');
assert.match(calendar, /diffWechatReminderTargets[\s\S]*removals:[\s\S]*upserts:/, 'WeChat reminders must reconcile removals and updates');

console.log('agent schedule notification contract tests passed');
