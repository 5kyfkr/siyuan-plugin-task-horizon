'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.resolve(__dirname, '..', 'calendar-view.js'), 'utf8');
const readFunction = (sourceText, name, context) => {
    const start = sourceText.indexOf(`function ${name}(`);
    assert.ok(start >= 0, `${name} must remain inspectable`);
    const signatureEnd = sourceText.indexOf(') {', start);
    const bodyStart = signatureEnd >= 0 ? signatureEnd + 2 : sourceText.indexOf('{', start);
    let depth = 0;
    for (let index = bodyStart; index < sourceText.length; index += 1) {
        if (sourceText[index] === '{') depth += 1;
        if (sourceText[index] === '}') depth -= 1;
        if (depth === 0) return vm.runInNewContext(`(${sourceText.slice(start, index + 1)})`, context);
    }
    assert.fail(`${name} must have a complete function body`);
};

const pad2 = (value) => String(value).padStart(2, '0');
const normalizeCalendarVisibleTime = readFunction(source, 'normalizeCalendarVisibleTime', { pad2 });
const getCalendarVisibleSlotRange = readFunction(source, 'getCalendarVisibleSlotRange', {
    normalizeCalendarVisibleTime,
    pad2,
});
const getPrototypeTimelineMetrics = readFunction(source, 'getPrototypeTimelineMetrics', {
    getCalendarVisibleSlotRange,
    getPrototypeHourHeight: () => 48,
    getSettings: () => ({}),
    PROTOTYPE_TIME_COLLAPSE_BAND_HEIGHT: 28,
});

const fullDay = getPrototypeTimelineMetrics({ visibleStartTime: '00:00', visibleEndTime: '24:00' }, {
    hourHeight: 48,
    availableHeight: 1200,
});
assert.equal(fullDay.hourHeight, 50, 'a tall full-day timeline should increase its hour height to fill the viewport');
assert.equal(fullDay.canvasHeight, 1200, 'a tall full-day timeline should consume the available viewport height');

const shortViewport = getPrototypeTimelineMetrics({ visibleStartTime: '00:00', visibleEndTime: '24:00' }, {
    hourHeight: 48,
    availableHeight: 900,
});
assert.equal(shortViewport.hourHeight, 48, 'a short viewport must keep the configured density');
assert.equal(shortViewport.canvasHeight, 1152, 'a short viewport must retain a scrollable full-day canvas');

const collapsedWindow = getPrototypeTimelineMetrics({ visibleStartTime: '07:30', visibleEndTime: '24:00' }, {
    hourHeight: 48,
    availableHeight: 1000,
});
assert.ok(collapsedWindow.hourHeight > 48, 'a collapsed timeline should stretch only its visible ranges and reserve the fold control');
assert.equal(Math.round(collapsedWindow.canvasHeight), 1000, 'collapsed timeline fitting should include its fold-control band');

const overnight = getPrototypeTimelineMetrics({ visibleStartTime: '22:00', visibleEndTime: '06:00' }, {
    hourHeight: 48,
    availableHeight: 300,
});
assert.equal(overnight.hourHeight, 48, 'an overnight window that cannot fit must remain scrollable');

assert.match(source, /const timelineNeedsHeightFit = Array\.from\(prototypeSurface\.querySelectorAll\('\.tm-proto-time-scroll'\)\)/,
    'timeline height fitting must re-render after the first measured paint');
assert.match(source, /availableHeight: options\.availableHeight/,
    'shared timeline markup must pass the measured viewport height into timeline metrics');

console.log('calendar timeline height contract tests passed');
