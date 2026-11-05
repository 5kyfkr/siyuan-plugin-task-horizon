'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const runtime = fs.readFileSync(
    path.join(root, 'src/task-horizon/main/task-runtime/51-whiteboard-and-link-runtime.js'),
    'utf8',
);
const start = runtime.indexOf('window.tmEditTaskCompleteAt = function');
const end = runtime.indexOf('window.tmBeginCellEdit = function', start);
assert.ok(start >= 0 && end > start, 'tmEditTaskCompleteAt must be defined before tmBeginCellEdit');
const editorSource = runtime.slice(start, end);

function makeHarness(overrides = {}) {
    const state = {
        closed: true,
        checkin: false,
        recurring: false,
        editable: true,
        current: '2026-11-04T10:00:00.000+08:00',
        inputs: [],
        patchCalls: [],
        hints: [],
        closeCount: 0,
        showPickerCalls: 0,
        ...overrides,
    };
    const task = {
        id: 'task-1',
        done: true,
        taskMarker: 'X',
        taskCompleteAt: state.current,
    };
    const context = vm.createContext({
        console,
        Promise,
        Map,
        Set,
        Element: class Element {},
        document: {
            createElement() {
                const input = {
                    value: '',
                    setAttribute() {},
                    appendChild() {},
                    showPicker() { state.showPickerCalls += 1; },
                };
                state.inputs.push(input);
                return input;
            },
        },
        __tmTaskStateKernel: { getTask: () => task },
        __tmTaskBoundary: { getTask: () => task },
        __tmEnsureEditableTaskLike: () => state.editable,
        __tmIsCheckinTask: () => state.checkin,
        __tmGetTaskRepeatRule: () => ({ enabled: state.recurring }),
        __tmIsTaskClosedForDisplay: () => state.closed,
        __tmResolveTaskCompletedAtRaw: () => state.current,
        __tmNormalizeTaskCompleteAtValue: (value) => {
            const text = String(value || '');
            if (text.startsWith('2026-11-04T02:30')) return '2026-11-04T10:30:00.000+08:00';
            if (text.startsWith('2026-11-04T10:00')) return state.current;
            return '';
        },
        __tmNowInChinaTimezoneIso: () => '2026-11-04T10:00:00.000+08:00',
        __tmToDatetimeLocalValue: () => '2026-11-04T10:00',
        __tmIsNativeDateInputValueReady: () => true,
        __tmParseDatetimeLocalToISO: (value) => (
            String(value || '').includes('10:30')
                ? '2026-11-04T02:30:00.000Z'
                : '2026-11-04T02:00:00.000Z'
        ),
        __tmRequireTaskMutation: () => (id, patch, options) => {
            state.patchCalls.push({ id, patch, options });
            return Promise.resolve(true);
        },
        __tmOpenInlineEditor: (anchor, build) => {
            build({
                editor: { appendChild() {}, classList: { add() {} } },
                close: () => { state.closeCount += 1; },
            });
        },
        hint: (message, type) => state.hints.push({ message, type }),
        __tmT: (key) => key,
    });
    context.window = context;
    vm.runInContext(editorSource, context);
    return { context, state };
}

function openEditor(harness) {
    const anchor = vm.runInContext('new Element()', harness.context);
    harness.context.window.tmEditTaskCompleteAt('task-1', anchor);
    assert.equal(harness.state.inputs.length, 1, 'editor input must be created');
    return harness.state.inputs[0];
}

async function run() {
    {
        const harness = makeHarness({ closed: false });
        const anchor = vm.runInContext('new Element()', harness.context);
        harness.context.window.tmEditTaskCompleteAt('task-1', anchor);
        assert.equal(harness.state.inputs.length, 0, 'open tasks must not open the editor');
        assert.deepEqual(
            harness.state.hints.map((item) => item.message),
            ['task.completeTimeRequiresClosedTask'],
            'open tasks must explain why editing is blocked',
        );
    }

    {
        const harness = makeHarness({ checkin: true });
        const anchor = vm.runInContext('new Element()', harness.context);
        harness.context.window.tmEditTaskCompleteAt('task-1', anchor);
        assert.equal(harness.state.inputs.length, 0, 'check-in tasks must not open the editor');
        assert.equal(harness.state.hints[0]?.message, 'task.completeTimeUnsupportedCheckin');
    }

    {
        const harness = makeHarness({ recurring: true });
        const anchor = vm.runInContext('new Element()', harness.context);
        harness.context.window.tmEditTaskCompleteAt('task-1', anchor);
        assert.equal(harness.state.inputs.length, 0, 'recurring tasks must not open the editor');
        assert.equal(harness.state.hints[0]?.message, 'task.completeTimeUnsupportedRecurring');
    }

    {
        const harness = makeHarness();
        const input = openEditor(harness);
        assert.equal(input.value, '2026-11-04T10:00', 'editor must prefill the current completion time');
        assert.equal(harness.state.showPickerCalls, 1, 'clicking must open the native picker immediately');
        input.value = '2026-11-04T10:30';
        input.onchange();
        await Promise.resolve();
        assert.equal(harness.state.patchCalls.length, 1, 'changed value must be written once');
        assert.equal(harness.state.patchCalls[0].id, 'task-1');
        assert.equal(
            harness.state.patchCalls[0].patch.taskCompleteAt,
            '2026-11-04T10:30:00.000+08:00',
        );
        assert.equal(harness.state.patchCalls[0].options.source, 'inline-task-complete-at');
        assert.equal(harness.state.closeCount, 1, 'editor must close after saving');
    }

    {
        const harness = makeHarness();
        const input = openEditor(harness);
        input.value = '';
        input.onchange();
        await Promise.resolve();
        assert.equal(harness.state.patchCalls.length, 0, 'clearing must not write a value');
        assert.equal(harness.state.closeCount, 1, 'clearing must close the editor');
    }

    {
        const harness = makeHarness();
        const input = openEditor(harness);
        input.onchange();
        await Promise.resolve();
        assert.equal(harness.state.patchCalls.length, 0, 'unchanged values must not write');
        assert.equal(harness.state.closeCount, 1);
    }

    {
        const harness = makeHarness({ editable: false });
        const anchor = vm.runInContext('new Element()', harness.context);
        harness.context.window.tmEditTaskCompleteAt('task-1', anchor);
        assert.equal(harness.state.inputs.length, 0, 'non-editable task sources must not open the editor');
    }

    console.log('task complete-at editor behavior tests passed');
}

run().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
