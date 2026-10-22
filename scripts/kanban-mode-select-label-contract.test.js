'use strict';

// 看板模式下拉在局部刷新后由 __tmSyncKanbanModeSelectUi 回写文案；
// 四象限等新增模式必须与菜单选项文案保持一致，不能回退成“状态”。
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');

const root = path.resolve(__dirname, '..');
const read = (name) => fs.readFileSync(path.join(root, 'src/task-horizon/main', name), 'utf8');

function section(source, start, end) {
    const from = source.indexOf(start);
    const to = source.indexOf(end, from + start.length);
    assert.ok(from >= 0 && to > from, `missing runtime segment: ${start}`);
    return source.slice(from, to);
}

const controls = read('render/45-render-shell-controls-and-resize.js');
const services = read('20-api-and-runtime-services.js');
const code = [
    section(controls, '    function __tmBuildKanbanModeMenuOptions()', '    function __tmBuildWhiteboardLayoutMenuOptions('),
    section(services, '    function __tmSyncKanbanModeSelectUi(modalEl)', '    function __tmSyncKanbanHeadingModeSegmentedUi(modalEl)'),
].join('\n');

class Element {}
class HTMLElement extends Element {}

function createSelectRoot() {
    const valueEl = { textContent: '' };
    const options = ['status', 'heading', 'time', 'quadrant'].map((value) => ({
        dataset: { tmOptionValue: value },
        attributes: {},
        classList: {
            names: new Set(),
            toggle(name, on) {
                if (on) this.names.add(name);
                else this.names.delete(name);
            },
        },
        setAttribute(name, next) {
            this.attributes[name] = next;
        },
    }));
    const rootEl = Object.assign(new HTMLElement(), {
        querySelector: (selector) => (selector === '.bc-select-trigger__value' ? valueEl : null),
        querySelectorAll: (selector) => (selector === '.bc-select-option' ? options : []),
    });
    return { rootEl, valueEl, options };
}

function fixture(mode) {
    const topbar = createSelectRoot();
    const mobile = createSelectRoot();
    const modal = Object.assign(new HTMLElement(), {
        querySelectorAll: (selector) => (/tmTopbarKanbanModeSelect/.test(selector) ? [topbar.rootEl, mobile.rootEl] : []),
    });
    const context = {
        state: { modal },
        Element,
        HTMLElement,
        __tmGetKanbanBoardMode: () => mode,
    };
    vm.createContext(context);
    vm.runInContext(code, context);
    return { context, modal, topbar, mobile };
}

for (const [mode, label] of [['status', '状态'], ['heading', '标题'], ['time', '时间'], ['quadrant', '四象限']]) {
    test(`in-place refresh keeps the ${mode} kanban mode select label`, () => {
        const { context, modal, topbar, mobile } = fixture(mode);
        assert.equal(context.__tmSyncKanbanModeSelectUi(modal), true);
        for (const select of [topbar, mobile]) {
            assert.equal(select.valueEl.textContent, label);
            for (const option of select.options) {
                assert.equal(
                    option.classList.names.has('is-selected'),
                    option.dataset.tmOptionValue === mode,
                    `${mode} select marks ${option.dataset.tmOptionValue}`
                );
                assert.equal(option.attributes['aria-selected'], option.dataset.tmOptionValue === mode ? 'true' : 'false');
            }
        }
    });
}

test('quadrant label never falls back to the status label', () => {
    const { context, modal, topbar } = fixture('quadrant');
    context.__tmSyncKanbanModeSelectUi(modal);
    assert.notEqual(topbar.valueEl.textContent, '状态');
});
