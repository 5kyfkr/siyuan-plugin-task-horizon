const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'homepage.js'), 'utf8');
const context = vm.createContext({ HTMLElement: class {} });
vm.runInContext(source.replace('    globalThis.__tmHomepage = {', `
    globalThis.__homepageStatusTest = { buildOverview, buildGaugeSegments, renderOverviewGauge };
    globalThis.__tmHomepage = {`), context);
const { buildOverview, buildGaugeSegments, renderOverviewGauge } = context.__homepageStatusTest;
const todayKey = '2026-09-27';

function overviewFor(tasks) {
    return buildOverview({ tasks, todayKey, containerWidth: 1200 });
}

function assertCounts(overview, expected) {
    for (const [key, value] of Object.entries(expected)) {
        assert.equal(overview.kpis[key], value, key);
    }
    const { total, doneCount, overdueCount, pendingCount } = overview.kpis;
    assert.equal(doneCount + overdueCount + pendingCount, total, 'each task must belong to exactly one status');
}

for (const field of ['taskMarker', 'task_marker', 'marker']) {
    for (const completionTime of ['', '2026-09-26', todayKey, '2026-09-28', '2026-10-04']) {
        const task = Object.freeze({ id: 'cancelled', done: false, [field]: '-', completionTime });
        assertCounts(overviewFor([task]), {
            total: 1, doneCount: 1, overdueCount: 0, overdue: 0, pendingCount: 0, completionRate: 100,
        });
        assert.equal(task.done, false, 'statistical grouping must not mark a cancelled task as actually completed');
        assert.equal(overviewFor([task]).riskList.length, 0, 'cancelled tasks must not appear in risk reminders');
    }
    assert.equal(overviewFor([{ id: 'cancelled-spaced', done: false, [field]: ' - ', completionTime: todayKey }]).riskList.length, 0,
        'cancelled markers must tolerate surrounding whitespace');
}

const cancelledChild = Object.freeze({ id: 'cancelled-child', done: false, taskMarker: '-', customStatus: 'abandoned', completionTime: todayKey });
const tasks = Object.freeze([
    Object.freeze({ id: 'done', done: true, taskMarker: 'X', taskCompleteAt: todayKey }),
    Object.freeze({ id: 'cancelled-overdue', done: false, taskMarker: '-', completionTime: '2026-09-26', taskCompleteAt: todayKey }),
    Object.freeze({ id: 'todo', done: false, taskMarker: ' ', children: Object.freeze([cancelledChild]) }),
    Object.freeze({ id: 'doing', done: false, taskMarker: '/', completionTime: '2026-09-28' }),
    Object.freeze({ id: 'overdue', done: false, taskMarker: ' ', completionTime: '2026-09-26' }),
    cancelledChild,
]);
const overview = overviewFor(tasks);
assertCounts(overview, { total: 6, doneCount: 3, overdueCount: 1, overdue: 1, pendingCount: 2, completionRate: 50 });
assert.equal(overview.kpis.todayDone, 1, 'cancelled tasks must not become successful daily completions');
assert.equal(overview.kpis.weekDone, 1, 'completion history must retain actual completion semantics');
assert.equal(overview.subtitle, '近 30 天完成 1 项，逾期 1 项');
assert.equal(overview.recentDone.length, 1);
assert.deepEqual(Array.from(overview.riskList, (task) => task.id), ['overdue', 'doing'],
    'risk reminders must keep active overdue and upcoming tasks while excluding cancelled tasks and children');
assert.deepEqual(
    JSON.parse(JSON.stringify(buildGaugeSegments(overview).map(({ key, value, pct }) => ({ key, value, pct })))),
    [
        { key: 'done', value: 3, pct: 50 },
        { key: 'overdue', value: 1, pct: 17 },
        { key: 'pending', value: 2, pct: 33 },
    ],
);
assert.match(renderOverviewGauge(overview), /完成率 50%/);

assertCounts(overviewFor([]), { total: 0, doneCount: 0, overdueCount: 0, overdue: 0, pendingCount: 0, completionRate: 0 });
assertCounts(overviewFor([{ id: 'done', done: true, taskMarker: '-', completionTime: '2026-09-26' }]), {
    total: 1, doneCount: 1, overdueCount: 0, overdue: 0, pendingCount: 0, completionRate: 100,
});
assertCounts(overviewFor([
    { id: 'todo', done: false, taskMarker: ' ', task_marker: '-' },
    { id: 'doing', done: false, taskMarker: '/' },
    { id: 'legacy-done', done: true },
]), { total: 3, doneCount: 1, overdueCount: 0, overdue: 0, pendingCount: 2, completionRate: 33 });

const reopenedTask = { id: 'reopened', done: false, taskMarker: '-', completionTime: todayKey };
assert.equal(overviewFor([reopenedTask]).riskList.length, 0);
reopenedTask.taskMarker = ' ';
assert.deepEqual(Array.from(overviewFor([reopenedTask]).riskList, (task) => task.id), ['reopened'],
    'restoring a cancelled task to todo must restore its risk reminder');

const limitedRiskTasks = [
    ...Array.from({ length: 6 }, (_, index) => ({
        id: `cancelled-${index}`, done: false, taskMarker: '-', completionTime: '2026-09-26',
    })),
    ...Array.from({ length: 7 }, (_, index) => ({
        id: `active-${index}`, title: `active-${index}`, done: false, taskMarker: '/', completionTime: todayKey,
    })),
];
assert.deepEqual(Array.from(overviewFor(limitedRiskTasks).riskList, (task) => task.id),
    Array.from({ length: 6 }, (_, index) => `active-${index}`),
    'cancelled tasks must not occupy the six available risk reminder slots');

console.log('homepage task status tests passed');
