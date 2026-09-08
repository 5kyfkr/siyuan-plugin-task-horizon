const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const storesSource = fs.readFileSync(path.join(root, 'src/task-horizon/main/10-stores-rules-and-cache.js'), 'utf8');
const calendarSource = fs.readFileSync(path.join(root, 'calendar-view.js'), 'utf8');
const runtimeSource = fs.readFileSync(path.join(root, 'src/task-horizon/main/render/48-render-calendar-support-runtime.js'), 'utf8');
const mutationSource = fs.readFileSync(path.join(root, 'src/task-horizon/main/20-api-and-runtime-services.js'), 'utf8');

const sources = [storesSource, calendarSource, runtimeSource, mutationSource];
sources.forEach((source) => {
    assert.doesNotMatch(
        source,
        /\[Task Horizon\]\[Perf\]|\[task-horizon\]\[calendar-perf\]|performance\.(?:mark|measure)|PerformanceObserver/,
    );
});
assert.doesNotMatch(storesSource, /console\.(?:log|info|debug|time|timeEnd)\(/);
assert.doesNotMatch(runtimeSource, /console\.(?:log|info|debug|time|timeEnd)\(/);
assert.doesNotMatch(mutationSource, /console\.(?:log|info|debug|time|timeEnd)\(/);

console.log('calendar performance trace contract tests passed');
