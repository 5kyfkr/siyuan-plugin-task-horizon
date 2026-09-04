'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const calendar = fs.readFileSync(path.join(root, 'calendar-view.js'), 'utf8');
const styles = fs.readFileSync(path.join(root, 'calendar-view.css'), 'utf8');
const settings = fs.readFileSync(path.join(root, 'src/task-horizon/main/10-stores-rules-and-cache.js'), 'utf8');
const exportRuntime = fs.readFileSync(path.join(root, 'src/task-horizon/main/settings/64-export-runtime.js'), 'utf8');

assert.match(settings, /calendarCustomHolidayOverrides:\s*\{\}/, 'overrides must default to an empty object');
assert.match(settings, /calendarIcsIncludeCustomHolidays:\s*false/, 'custom holiday ICS publishing must default off');
assert.match(settings, /__tmNormalizeCalendarCustomHolidayOverrides/, 'settings must normalize persisted override data');
assert.match(settings, /Storage\.get\('tm_calendar_custom_holiday_overrides'/, 'overrides must load from the local shadow');
assert.match(settings, /Storage\.set\('tm_calendar_custom_holiday_overrides'/, 'overrides must save to the local shadow');
assert.match(settings, /typeof cloudData\.calendarIcsIncludeCustomHolidays === 'boolean'/, 'ICS switch must merge from cloud settings');
assert.match(settings, /cloudData\.calendarCustomHolidayOverrides[\s\S]*__tmNormalizeCalendarCustomHolidayOverrides/, 'overrides must merge and normalize from cloud settings');
assert.match(exportRuntime, /'calendarCustomHolidayOverrides'/, 'overrides must be included in the calendar settings backup');
assert.match(exportRuntime, /'calendarIcsIncludeCustomHolidays'/, 'ICS switch must be included in the calendar settings backup');

assert.match(calendar, /data-tm-cal-setting-action="manageCustomHolidays"/, 'calendar settings must expose the editor');
assert.match(calendar, /data-tm-holiday-editor-mode="rest"[\s\S]*data-tm-holiday-editor-mode="work"/, 'editor must provide rest/work modes');
assert.match(calendar, /data-tm-holiday-editor-name[\s\S]*placeholder="节假日名称（可选）"/, 'editor must support optional custom names');
assert.match(calendar, /data-tm-holiday-editor-restore/, 'editor must support restoring the official value per date');
assert.match(calendar, /有未保存的个人节假日修改/, 'dirty editor close must request confirmation');
assert.match(calendar, /const close = \(force = false\) => \{\s*if \(!force && saving\) return false;/, 'editor must not close while a save is in flight');
assert.match(calendar, /overlay\.addEventListener\('click', async \(event\) => \{\s*if \(saving\) return;/, 'editor clicks must freeze while saving');
assert.match(calendar, /overlay\.addEventListener\('input', \(event\) => \{\s*if \(saving\) return;/, 'editor name input must freeze while saving');
assert.match(calendar, /设置文件回读校验未通过/, 'editor saves must verify persistence and keep draft on failure');
assert.match(calendar, /applyCalendarCustomHolidayOverrides\(officialHolidayDays, settings\.customHolidayOverrides\)/, 'official holiday data must be overlaid before calendar rendering');

assert.match(calendar, /calendarIcsIncludeCustomHolidays: 'boolean'/, 'publisher must refresh the synchronized custom holiday switch');
assert.match(calendar, /data-tm-cal-setting="calendarIcsIncludeCustomHolidays"/, 'ICS settings must expose the custom holiday switch');
assert.match(calendar, /仅同步你明确设置的休息日和调休工作日，不包含未修改的官方节假日/, 'ICS help text must state that official holidays are excluded');
assert.match(calendar, /buildCustomHolidaySubscriptionEvents\(settings\.customHolidayOverrides, range\)/, 'ICS events must be sourced from explicit overrides');
assert.match(calendar, /uidSeed: `custom-holiday:\$\{date\}`/, 'custom holiday UID seeds must be stable per date');
assert.match(calendar, /source: 'holiday'/, 'custom holiday ICS events must use the holiday source');
assert.match(calendar, /allDay: true,[\s\S]*startDate: date,[\s\S]*endDate: formatDateKey\(end\)/, 'custom holidays must serialize as exclusive-end all-day events');

assert.match(styles, /\.tm-calendar-holiday-editor__day\{[^}]*min-height:58px/, 'desktop date targets must be comfortably tappable');
assert.match(styles, /@media \(max-width:640px\)[\s\S]*\.tm-calendar-holiday-editor\{padding:0;align-items:stretch\}/, 'mobile editor must become full screen');
assert.match(styles, /\.tm-calendar-holiday-editor__day\{min-height:54px\}/, 'mobile date targets must remain at least 44px');

console.log('calendar custom holiday contract tests passed');
