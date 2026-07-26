'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');
const vendorSource = read('src/task-horizon/vendor/ts-fsrs-5.4.1.umd.js');
const adapterSource = read('src/task-horizon/main/task-runtime/50a-fsrs-runtime.js');
assert.match(vendorSource, /Copyright \(c\) 2026 Open Spaced Repetition[\s\S]*?Permission is hereby granted/, 'vendored FSRS source must retain its MIT notice without a separate license file');
const modelSource = read('src/task-horizon/main/task-runtime/50-task-model-and-repeat-utils.js');
const recurringSource = read('src/task-horizon/main/task-runtime/54-recurring-task-runtime.js');
const manifest = JSON.parse(read('src/task-horizon/manifest.main.json'));

const normalizeDateOnly = (value) => {
    const text = String(value || '').trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    const pad = (number) => String(number).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};
const buildNoon = (value) => {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(normalizeDateOnly(value));
    if (!match) return null;
    return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12, 0, 0, 0);
};
const shiftDateKey = (value, days) => {
    const date = buildNoon(value);
    date.setDate(date.getDate() + Number(days || 0));
    return normalizeDateOnly(date);
};
const normalizeCard = (value) => {
    if (!value || typeof value !== 'object') return null;
    const due = new Date(value.due || '');
    if (Number.isNaN(due.getTime())) return null;
    const lastReview = value.last_review ? new Date(value.last_review) : null;
    return {
        due: due.toISOString(),
        stability: Math.max(0, Number(value.stability) || 0),
        difficulty: Math.max(0, Number(value.difficulty) || 0),
        elapsed_days: Math.max(0, Number.parseInt(value.elapsed_days, 10) || 0),
        scheduled_days: Math.max(0, Number.parseInt(value.scheduled_days, 10) || 0),
        reps: Math.max(0, Number.parseInt(value.reps, 10) || 0),
        lapses: Math.max(0, Number.parseInt(value.lapses, 10) || 0),
        state: Math.max(0, Math.min(3, Number.parseInt(value.state, 10) || 0)),
        last_review: lastReview && !Number.isNaN(lastReview.getTime()) ? lastReview.toISOString() : '',
    };
};
const normalizeState = (value) => {
    const source = value && typeof value === 'object' ? value : {};
    const fsrsCard = normalizeCard(source.fsrsCard);
    return {
        version: fsrsCard ? 2 : 1,
        occurrenceCount: Math.max(1, Number.parseInt(source.occurrenceCount, 10) || 1),
        lastCompletedAt: String(source.lastCompletedAt || '').trim(),
        lastAdvancedAt: String(source.lastAdvancedAt || '').trim(),
        lastInstanceStart: normalizeDateOnly(source.lastInstanceStart),
        lastInstanceDue: normalizeDateOnly(source.lastInstanceDue),
        fsrsCard,
    };
};

const context = vm.createContext({
    Date,
    Math,
    Number,
    Object,
    String,
    SettingsStore: {
        data: {
            fsrsDesiredRetention: 0.9,
            fsrsMaximumIntervalDays: 3650,
            fsrsEnableFuzz: false,
        },
    },
    __tmNormalizeDateOnly: normalizeDateOnly,
    __tmBuildLocalNoonDateFromKey: buildNoon,
    __tmShiftTaskRepeatDateKey: shiftDateKey,
    __tmNormalizeFsrsCardState: normalizeCard,
    __tmNormalizeTaskRepeatState: normalizeState,
});
vm.runInContext(`${vendorSource}\n${adapterSource}\nthis.buildReview = __tmBuildFsrsReviewPatch; this.getSettings = __tmGetFsrsSettings;`, context);

const reviewedAt = '2026-07-25T09:00:00+08:00';
const makeTask = () => ({
    id: 'task-1',
    startDate: '2026-07-25',
    completionTime: '2026-07-25',
    repeatState: normalizeState(null),
});

const again = context.buildReview(makeTask(), 1, { reviewedAt });
assert.equal(again.completionTime, '2026-07-26');
assert.equal(again.repeatState.occurrenceCount, 1, 'Again must not count as a completed occurrence');
assert.equal(again.review.successful, false);
assert.equal(again.repeatState.fsrsCard.reps, 1);

const hard = context.buildReview(makeTask(), 2, { reviewedAt, completedAt: reviewedAt });
const good = context.buildReview(makeTask(), 3, { reviewedAt, completedAt: reviewedAt });
const easy = context.buildReview(makeTask(), 4, { reviewedAt, completedAt: reviewedAt });
assert.equal(hard.completionTime, '2026-07-27');
assert.equal(good.completionTime, '2026-07-28');
assert.equal(easy.completionTime, '2026-08-02');
assert.equal(good.repeatState.occurrenceCount, 2);
assert.equal(good.review.rating, 3);
assert.ok(good.review.beforeCard);
assert.ok(good.review.afterCard);

context.SettingsStore.data.fsrsDesiredRetention = 2;
context.SettingsStore.data.fsrsMaximumIntervalDays = 5;
assert.deepEqual(JSON.parse(JSON.stringify(context.getSettings())), {
    desiredRetention: 0.97,
    maximumIntervalDays: 30,
    enableFuzz: false,
});

let task = makeTask();
for (let index = 0; index < 12; index += 1) {
    const at = task.repeatState.fsrsCard?.due || `${task.completionTime}T09:00:00+08:00`;
    const patch = context.buildReview(task, 4, { reviewedAt: at, completedAt: at });
    assert.ok(patch.repeatState.fsrsCard.scheduled_days <= 30, 'configured maximum interval must be enforced');
    task = { ...task, startDate: patch.startDate, completionTime: patch.completionTime, repeatState: patch.repeatState };
}

assert.ok(modelSource.includes("rule.type === 'fsrs') return []"), 'fixed future preview must exclude FSRS');
assert.ok(recurringSource.includes("rule.type === 'fsrs') return null"), 'due-trigger advance must exclude FSRS');
assert.ok(manifest.scripts.indexOf('vendor/ts-fsrs-5.4.1.umd.js') < manifest.scripts.indexOf('main/task-runtime/50a-fsrs-runtime.js'));

console.log('FSRS runtime tests passed');
