const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'homepage.js'), 'utf8');
const observers = [];
class MockElement {
    constructor() {
        this.renderCount = 0;
        this.html = '';
    }
    set innerHTML(html) {
        this.html = html;
        this.renderCount += 1;
    }
}
class MockResizeObserver {
    constructor(callback) {
        this.callback = callback;
        this.disconnected = false;
        observers.push(this);
    }
    observe(target) {
        this.target = target;
    }
    disconnect() {
        this.disconnected = true;
    }
    resize(width, height) {
        this.callback([{ target: this.target, contentRect: { width, height } }]);
    }
}
const context = vm.createContext({ HTMLElement: MockElement, ResizeObserver: MockResizeObserver });
vm.runInContext(source.replace('    globalThis.__tmHomepage = {', `
    globalThis.__trendTest = { buildTrendSvg, bindTrendResizeObserver, renderTrendAxis, runtime };
    globalThis.__tmHomepage = {`), context);
const { buildTrendSvg, bindTrendResizeObserver, renderTrendAxis, runtime } = context.__trendTest;
const ctx = { containerWidth: 1200 };
const viewportSizes = [
    { width: 1146, height: 480 },
    { width: 1440, height: 700 },
    { width: 600, height: 190 },
    { width: 320, height: 142 },
    { width: 360.5, height: 400.25 },
];

function readCircle(svg, className) {
    const match = svg.match(new RegExp(`<circle cx="([\\d.]+)" cy="([\\d.]+)" r="([\\d.]+)" class="[^"]*${className}"`));
    assert.ok(match, `${className} must be rendered`);
    return { x: Number(match[1]), y: Number(match[2]), radius: Number(match[3]) };
}

for (const days of [7, 30, 90]) {
    const trend = { points: Array.from({ length: days }, (_, index) => ({
        label: `day-${index + 1}`,
        value: index === 2 ? 42 : (index % 4 ? index % 12 : 0),
    })) };
    for (const viewport of viewportSizes) {
        const svg = buildTrendSvg(trend, ctx, viewport.width < 400 ? 'mobile' : 'desktop', 'wide', viewport);
        assert.ok(svg.includes(`viewBox="0 0 ${viewport.width} ${viewport.height}"`), 'coordinates must match the measured content box');
        assert.doesNotMatch(svg, /preserveAspectRatio="none"/, 'text and circles must never be stretched non-uniformly');
        const peak = readCircle(svg, 'tm-homepage-trend-dot--peak');
        assert.ok(Math.abs(peak.y - viewport.height / 4) < 0.001, 'the peak must sit one quarter down the chart at every height');
        assert.ok(svg.includes(`y1="${viewport.height - 10}"`), 'zero gridline must stay near the bottom');
        const labels = [...svg.matchAll(/<text x="([\d.]+)" y="([\d.]+)"[^>]*>(\d+)<\/text>/g)];
        assert.equal(labels.length, trend.points.filter((point) => point.value > 0).length);
        assert.ok(labels.every((label) => Number(label[2]) < viewport.height - 10), 'labels must remain above the baseline');
        assert.doesNotMatch(renderTrendAxis(trend), /trend-axis-value/, 'the date axis must not duplicate the point values');
    }
}

for (const values of [[0, 0, 0], [42], [2, 0, 0], [3, 3, 3]]) {
    const trend = { points: values.map((value, index) => ({ label: `day-${index}`, value })) };
    const svg = buildTrendSvg(trend, ctx, 'desktop', 'wide', { width: 1146, height: 480 });
    assert.doesNotMatch(svg, /NaN|Infinity/);
    const last = readCircle(svg, 'tm-homepage-trend-dot--last');
    assert.ok(last.y + 10 <= 480, 'the latest marker and ring must remain visible even at zero');
    if (values.every((value) => value === 0)) {
        assert.equal(last.y, 470);
        assert.doesNotMatch(svg, /<text /, 'zero-only data must retain its quiet baseline');
    }
}
assert.doesNotMatch(buildTrendSvg({ points: [] }, ctx, 'desktop'), /<svg/, 'empty data must keep the empty state');

const wrap = new MockElement();
const root = new MockElement();
root.querySelector = () => wrap;
root.contains = (element) => element === wrap;
runtime.root = root;
runtime.ctx = ctx;
const trend = { points: [{ label: 'peak', value: 42 }, { label: 'zero', value: 0 }] };
bindTrendResizeObserver(trend);
const observer = observers.at(-1);
assert.equal(observer.target, wrap, 'observe the chart itself, not just the page width');
observer.resize(1146, 480);
assert.equal(wrap.renderCount, 1);
assert.equal(readCircle(wrap.html, 'tm-homepage-trend-dot--peak').y, 120);
observer.resize(1146, 480);
assert.equal(wrap.renderCount, 1, 'unchanged dimensions must not rebuild the chart');
observer.resize(1146, 660);
assert.equal(wrap.renderCount, 2, 'height-only changes must update the chart');
assert.equal(readCircle(wrap.html, 'tm-homepage-trend-dot--peak').y, 165);
observer.resize(0, 0);
assert.equal(wrap.renderCount, 2, 'hidden charts must not overwrite usable geometry');
bindTrendResizeObserver({ points: [{ label: 'new-range', value: 5 }] });
assert.equal(observer.disconnected, true, 'range and layout changes must disconnect the previous observer');
observers.at(-1).resize(320, 190);
assert.ok(wrap.html.includes('new-range'), 'range updates must render current data');
root.contains = () => false;
observers.at(-1).resize(500, 500);
assert.equal(wrap.renderCount, 3, 'detached charts must not be rendered');
context.__tmHomepage.unmount();
assert.equal(observers.at(-1).disconnected, true, 'unmount must release the chart observer');
assert.equal(runtime.trendResizeObserver, null);

console.log('homepage trend layout tests passed');
