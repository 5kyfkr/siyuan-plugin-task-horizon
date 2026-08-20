'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

const detail = read('src/task-horizon/main/30-dialogs-and-ui-foundation.js');
const list = read('src/task-horizon/main/task-runtime/53-list-render-and-document-loader.js');
const render = read('src/task-horizon/main/40-render-runtime.js');
const styles = read('task-horizon.css');

const pickerSources = [
    ['task detail timer menu', detail, 'tm-task-detail-more-menu__timer-slider'],
    ['task context menu', list, 'tm-task-context-timer__slider'],
    ['block context menu', render, 'tm-task-context-timer__slider'],
];

for (const [label, source, className] of pickerSources) {
    assert.match(source, /durationSlider\.type = 'range'/, `${label} must use a range duration picker`);
    assert.match(source, /durationSlider\.min = '5'/, `${label} must start at five minutes`);
    assert.match(source, /durationSlider\.max = '180'/, `${label} must cap duration at 180 minutes`);
    assert.match(source, /durationSlider\.step = '5'/, `${label} must move in five-minute steps`);
    assert.match(source, /getDefaultDurationMinutes\?\./, `${label} must initialize from Tomato's configured default duration`);
    assert.doesNotMatch(source, /__dockTomato\?\.getDefaultTomatoTimeMinutes\?\./, `${label} must not fall back to the legacy default-button duration`);
    assert.match(source, new RegExp(`${className.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')}`), `${label} must expose the shared picker class`);
    assert.match(source, /durationSlider\.addEventListener\('click'[\s\S]*runTaskTimer|durationSlider\.addEventListener\('click'[\s\S]*__tmStartTaskDetailQuickTimer/, `${label} must start the selected duration from a non-drag slider click`);
    assert.match(source, /durationSliderDragged[\s\S]*pointermove[\s\S]*durationSliderDragged = true/, `${label} must distinguish a drag from a start click`);
    assert.doesNotMatch(source, /durationSlider[\s\S]{0,1800}setActiveCountdownDuration/, `${label} must not adjust a running timer`);
}

const detailTimer = detail.slice(detail.indexOf('function __tmBuildTaskDetailMoreTimerSection'));
assert.ok(
    detailTimer.indexOf('wrap.appendChild(row)') < detailTimer.indexOf('wrap.appendChild(sliderRow)'),
    'task detail presets must render above the duration slider'
);
for (const [label, source] of [['task context menu', list], ['block context menu', render]]) {
    assert.ok(
        source.indexOf('timerWrap.appendChild(btnRow)') < source.indexOf('timerWrap.appendChild(sliderRow)'),
        `${label} presets must render above the duration slider`
    );
}

assert.match(detail, /label: '正计时'/, 'task detail menu must keep the short stopwatch label');
assert.match(list, /sw\.textContent = '⏱️ 正计时'/, 'task context menu must keep the short stopwatch label');
assert.match(render, /sw\.textContent = '⏱️ 正计时'/, 'block context menu must keep the short stopwatch label');
assert.match(styles, /\.tm-task-context-timer__slider-row[\s\S]*\.tm-task-detail-more-menu__timer-slider-row/, 'both timer menu variants must have picker layout styles');
assert.match(styles, /slider::-webkit-slider-thumb[\s\S]*background-image: url\("data:image\/svg\+xml,[\s\S]*M8 5v14l11-7z/, 'the slider thumb must carry the play icon');
assert.match(styles, /slider\.is-pressed[\s\S]*transform: scale\(0\.82\)/, 'the slider must retain the pressed affordance');
assert.doesNotMatch(styles, /::-webkit-slider-thumb,[\s\S]{0,80}::-moz-range-thumb/, 'WebKit and Firefox slider pseudo-elements must use separate rules');
assert.match(detail, /pointerenter[\s\S]*is-hovered[\s\S]*pointerleave/, 'task detail slider must explicitly manage hover state');
assert.match(list, /pointerenter[\s\S]*is-hovered[\s\S]*pointerleave/, 'task context slider must explicitly manage hover state');
assert.match(render, /pointerenter[\s\S]*is-hovered[\s\S]*pointerleave/, 'block context slider must explicitly manage hover state');

console.log('Tomato menu duration picker contract tests passed');
