// Run after generating/opening timeline-link-drop-browser-fixture.js:
// playwright-cli run-code --filename scripts/timeline-link-drop-browser-check.js
async (page) => {
    await page.reload();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const results = [];
    for (const side of ['out', 'in']) {
        await page.evaluate(() => timelineLinkTest.reset());
        const targetSide = side === 'out' ? 'in' : 'out';
        const points = await page.evaluate(({ side, targetSide }) => {
            const source = timelineLinkTest.point('a', side);
            const target = timelineLinkTest.point('b', targetSide);
            target.x += targetSide === 'in' ? 12 : -12;
            return { source, target };
        }, { side, targetSide });
        await page.mouse.move(points.source.x, points.source.y);
        await page.mouse.down();
        await page.mouse.move(points.target.x, points.target.y, { steps: 12 });
        const hover = await page.evaluate(({ x, y }) => ({
            task: timelineLinkTest.state.timelineLinkHoverTaskId,
            dot: document.elementFromPoint(x, y)?.closest('.tm-task-link-dot') !== null,
        }), points.target);
        await page.mouse.up();
        await page.waitForFunction(() => timelineLinkTest.links().length === 1);
        if (hover.task !== 'b' || !hover.dot) throw new Error('Short connector did not resolve the target dot');
        results.push({ mode: 'pointer', side, links: await page.evaluate(() => timelineLinkTest.links()) });
    }
    for (const side of ['out', 'in']) {
        for (const location of ['connector', 'dot']) {
            const result = await page.evaluate(async ({ side, location }) => {
                timelineLinkTest.reset();
                const source = document.querySelector('.tm-gantt-row[data-id="a"] .tm-task-link-dot--' + side);
                const transfer = new DataTransfer();
                const origin = timelineLinkTest.point('a', side);
                const send = (target, type, point) => target.dispatchEvent(new DragEvent(type, {
                    bubbles: true, cancelable: true, dataTransfer: transfer, clientX: point.x, clientY: point.y,
                }));
                send(source, 'dragstart', origin);
                const targetSide = side === 'out' ? 'in' : 'out';
                const point = timelineLinkTest.point('b', targetSide);
                if (location === 'connector') point.x += targetSide === 'in' ? 12 : -12;
                let hit = document.elementFromPoint(point.x, point.y);
                send(hit, 'dragover', point);
                // Row hover exposes the target circle. Resolve it once more before dropping.
                hit = document.elementFromPoint(point.x, point.y);
                send(hit, 'drop', point);
                send(source, 'dragend', point);
                await new Promise(resolve => setTimeout(resolve, 30));
                const connectorEvents = getComputedStyle(source, '::before').pointerEvents;
                if (connectorEvents !== 'none') throw new Error('Connector still intercepts idle resize events');
                return { mode: 'native', side, location, links: timelineLinkTest.links() };
            }, { side, location });
            results.push(result);
        }
    }
    for (const result of results) {
        const expectedFrom = result.side === 'out' ? 'a' : 'b';
        const expectedTo = result.side === 'out' ? 'b' : 'a';
        if (result.links.length !== 1 || result.links[0].from !== expectedFrom || result.links[0].to !== expectedTo) {
            throw new Error('Incorrect link: ' + JSON.stringify(result));
        }
    }
    // A cancelled native drag must also restore the original idle hit testing.
    const cancelled = await page.evaluate(() => {
        timelineLinkTest.reset();
        const source = document.querySelector('.tm-gantt-row[data-id="a"] .tm-task-link-dot--out');
        source.dispatchEvent(new DragEvent('dragstart', { bubbles: true, dataTransfer: new DataTransfer() }));
        source.dispatchEvent(new DragEvent('dragend', { bubbles: true }));
        return !document.querySelector('.tm-gantt-body--linking') && timelineLinkTest.links().length === 0;
    });
    if (!cancelled) throw new Error('Cancelled drag did not clear the active link state');
    if (errors.length) throw new Error(errors.join('\n'));
    return { passed: results.length + 1, checks: results.map(({ mode, side, location }) => ({ mode, side, location })) };
}
