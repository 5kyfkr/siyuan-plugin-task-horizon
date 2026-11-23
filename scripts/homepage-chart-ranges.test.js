'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('./i18n-vm-fixture');

const source = fs.readFileSync(path.join(__dirname, '../homepage.js'), 'utf8');
const { resolveChartRange, buildOverview, buildTrendSummary, normalizeHomepageSettings, saveHomepageSettings, runtime } = vm.runInNewContext(source.replace(
    '    globalThis.__tmHomepage = {',
    '    return { resolveChartRange, buildOverview, buildTrendSummary, normalizeHomepageSettings, saveHomepageSettings, runtime };\n    globalThis.__tmHomepage = {',
), {});

function assertRange(selection, today, start, end, count) {
    const range = resolveChartRange(selection, today);
    assert.deepEqual([range.startKey, range.endKey, range.dayCount], [start, end, count]);
}

assertRange('7d', '2026-01-05', '2025-12-30', '2026-01-05', 7);
assertRange('30d', '2026-01-05', '2025-12-07', '2026-01-05', 30);
assertRange('90d', '2024-04-15', '2024-01-17', '2024-04-15', 90);
assertRange('6m', '2026-11-23', '2026-06-01', '2026-11-23', 176);
assertRange('6m', '2024-02-29', '2023-09-01', '2024-02-29', 182);
assertRange('12m', '2026-11-23', '2025-12-01', '2026-11-23', 358);
assertRange('year-2024', '2026-11-23', '2024-01-01', '2024-12-31', 366);
assertRange('year-2025', '2026-11-23', '2025-01-01', '2025-12-31', 365);
assertRange('year-2024', '2024-03-30', '2024-01-01', '2024-03-30', 90);
assertRange('year-2024', '2024-03-31', '2024-01-01', '2024-03-31', 91);

const tasks = [
    { id: 'leap', done: true, taskCompleteAt: '2024-02-29', created: '2024-02-01' },
    { id: 'first', done: true, taskCompleteAt: '2025-01-01', created: '2024-12-31' },
    { id: 'second', done: true, updated: '20250130120000', created: '2025-01-04' },
    { id: 'year-end', done: true, taskCompleteAt: '2025-12-31', created: '2025-12-01' },
    { id: 'old', done: true, taskCompleteAt: '2026-10-24', created: '2026-10-24' },
    { id: 'recent', done: true, taskCompleteAt: '2026-10-25', created: '2026-10-25' },
    { id: 'week', done: true, taskCompleteAt: '2026-11-17', created: '2026-11-17' },
    { id: 'today', done: true, taskCompleteAt: '2026-11-23', created: '2026-11-23' },
    { id: 'future', done: true, taskCompleteAt: '2026-11-24', created: '2026-11-24' },
    ...Array.from({ length: 8 }, (_, i) => ({ id: `today-${i}`, done: true, taskCompleteAt: '2026-11-23' })),
];
const todayKey = '2026-11-23';
runtime.ctx = { todayKey };
const invalid = normalizeHomepageSettings({ trendRange: 'year-2027', heatmapRange: '7d' });
assert.equal(invalid.trendRange, '30d');
assert.equal(invalid.heatmapRange, '6m');
const overview = () => buildOverview({ tasks, todayKey, containerWidth: 1200 });
const defaults = overview();
assert.equal(defaults.trend.points.length, 30);
assert.equal(defaults.trend.points[0].key, '2026-10-25');
assert.equal(defaults.heatmap.months.length, 6);
assert.equal(defaults.heatmap.months[0].key, '2026-06');
assert.equal(defaults.heatmap.months.at(-1).cells.at(-1).key, todayKey);
assert.deepEqual(Array.from(defaults.chartYears), [2026, 2025, 2024]);

saveHomepageSettings({ trendRange: 'year-2025', heatmapRange: 'year-2025' });
const past = overview();
assert.equal(past.trend.monthly, true);
assert.equal(past.trend.points.length, 12);
assert.deepEqual(Array.from(past.trend.points, point => [point.value, point.created]), [
    [2, 1], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0],
    [0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [1, 1],
]);
assert.equal(buildTrendSummary(past.trend).average, 3 / 12);
assert.equal(past.heatmap.months[0].cells[0].key, '2025-01-01');
assert.equal(past.heatmap.months.at(-1).cells.at(-1).key, '2025-12-31');
assert.equal(past.heatmap.months[0].cells[0].level, 4, 'events outside the selected range must not dilute the heatmap');
assert.equal(past.kpis.todayDone, 9);
assert.equal(past.kpis.weekDone, 10);
assert.equal(past.subtitle, defaults.subtitle);

saveHomepageSettings({ trendRange: '90d', heatmapRange: '30d' });
const recent = overview();
assert.equal(recent.trend.monthly, false);
assert.equal(recent.trend.points.length, 90);
assert.equal(recent.heatmap.months[0].cells[0].key, '2026-10-25');
assert.equal(recent.heatmap.months.reduce((sum, month) => sum + month.cells.length, 0), 30);

saveHomepageSettings({ heatmapRange: 'year-2024' });
assert.equal(overview().heatmap.months[1].cells[28].count, 1, 'February 29 is a real day cell');

console.log('homepage chart range tests passed');
