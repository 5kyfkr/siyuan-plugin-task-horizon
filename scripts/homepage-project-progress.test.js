'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { DatabaseSync } = require('node:sqlite');
const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'src/task-horizon/main/20-api-and-runtime-services.js'), 'utf8');
const between = (start, end) => {
    const from = source.indexOf(start), to = source.indexOf(end, from + start.length);
    assert.ok(from >= 0 && to > from, start);
    return source.slice(from, to);
};

(async () => {
    // Isolated synthetic index snapshots can lag behind the live task projection.
    const db = new DatabaseSync(':memory:');
    try {
        db.exec('CREATE TABLE blocks (id TEXT, root_id TEXT, type TEXT, subtype TEXT, markdown TEXT)');
        const insert = db.prepare("INSERT INTO blocks VALUES (?, 'project', 'i', 't', ?)");
        const snapshot = (total, done) => {
            db.exec('DELETE FROM blocks');
            for (let i = 0; i < total; i++) insert.run(String(i), i < done ? '- [x] Synthetic done' : '- [ ] Synthetic todo');
        };
        const context = vm.createContext({
            console, Date, Map, Set, Promise, setTimeout, clearTimeout, HTMLElement: class {},
            state: { activeDocId: 'all', taskTree: [{ id: 'project', name: 'Synthetic project' }], filterRules: [] },
            SettingsStore: { data: { currentGroupId: 'all' } },
            async fetch(_url, request) { return { json: async () => ({ code: 0, data: db.prepare(JSON.parse(request.body).stmt).all() }) }; },
            __tmRememberSmallCache: (map, key, value) => map.set(key, value),
            __tmNormalizeDateOnly: value => String(value),
            __tmIsDarkMode: () => false,
            __tmSortDocEntriesForTabs: docs => docs,
            __tmDocShouldShowInDocTabs: () => true,
            __tmBuildDocTabGroupedView: docs => ({ groups: [], normalDocs: docs }),
            __tmGetCachedDocExpectedMeta: () => ({ startDate: '2026-01-25', deadline: '2026-12-31' }),
            __tmComputeDocExpectedProgressPercent: () => 80,
            __tmGetDocColorHex: () => '',
            __tmScheduleHomepageRefresh() {},
        });
        context.window = context;
        vm.runInContext(between('    function __tmCreateTaskStatusRules()', '    const API =')
            + between('    const __TM_DOC_PROGRESS_CACHE_TTL_MS', '    const __TM_DOC_EXPECTED_START_ATTR')
            + between('    function __tmGetFreshDocProgress(', '    window.__tmUpdateDocTabProgress')
            + between("    let __tmHomepageProjectsWarmupKey = ''", '    function __tmBuildHomepageCtx('), context);
        const homepage = fs.readFileSync(path.join(root, 'homepage.js'), 'utf8');
        vm.runInContext(homepage.replace('    globalThis.__tmHomepage = {', `
            globalThis.projectRenderTest = { renderProjectDocCard, isProjectCardCompleted };
            globalThis.__tmHomepage = {`), context);
        const tasks = (total, done) => Array.from({ length: total }, (_, i) => ({
            id: String(i), root_id: 'project', done: i < done,
        }));
        const card = list => context.__tmBuildHomepageProjects(list, '2026-10-25').sections[0].cards[0];
        const refresh = async (total, done) => {
            snapshot(total, done);
            context.__tmInvalidateDocProgressCache('project');
            await context.__tmLoadDocProgressBatch(['project']);
        };

        // Reproduce the reported numbers while the mobile SQL cache still says 100%.
        await refresh(1077, 1077);
        const live = tasks(1077, 1021);
        const mobile = card(live);
        assert.equal(mobile.progress, 95, 'known unfinished tasks must override an obsolete 100 percent SQL snapshot');
        assert.equal(mobile.total, 1077);
        assert.equal(mobile.done, 1021);
        const mobileHtml = context.projectRenderTest.renderProjectDocCard(mobile, '2026-10-25');
        assert.doesNotMatch(mobileHtml, /class="tm-home-project-card[^\"]*is-completed/);
        assert.doesNotMatch(mobileHtml, /tm-home-project-completed/);
        assert.match(mobileHtml, /class="pct">95%/);
        await refresh(1077, 1021);
        assert.equal(card(live).progress, mobile.progress, 'desktop and mobile must agree despite different SQL cache timing');
        await refresh(1100, 1100);
        assert.equal(card(live).progress, 95, 'even a larger SQL snapshot cannot declare completion while live unfinished tasks are known');

        await refresh(100, 80);
        const partial = card(tasks(75, 45));
        assert.equal(partial.total, 100, 'an incomplete local snapshot must use the authoritative count with its percentage');
        assert.equal(partial.done, 80);
        assert.equal(partial.progress, 80);
        context.__tmInvalidateDocProgressCache('project');
        const uncached = card(live);
        assert.equal(uncached.total, 1077);
        assert.equal(uncached.progress, 95, 'invalidating progress must invalidate its count snapshot too');

        await refresh(1000, 999);
        const almostDone = card(tasks(1000, 999));
        assert.equal(almostDone.progress, 99);
        assert.equal(context.projectRenderTest.isProjectCardCompleted(almostDone), false);
        assert.equal(context.projectRenderTest.isProjectCardCompleted({ total: 1000, done: 999, progress: 100 }), false,
            'a contradictory percentage must not stamp a known unfinished project as complete');
        await refresh(1000, 1000);
        const completed = card(tasks(1000, 1000));
        assert.equal(completed.progress, 100);
        assert.equal(context.projectRenderTest.isProjectCardCompleted(completed), true);
        context.__tmProjectVisibility = { isCompleted: () => true };
        assert.match(context.projectRenderTest.renderProjectDocCard(mobile, '2026-10-25'), /class="tm-home-project-card[^\"]*is-completed/,
            'explicit manual completion remains available without changing task counts or percentages');
        console.log('homepage project progress consistency tests passed');
    } finally {
        db.close();
    }
})().catch(error => { console.error(error); process.exitCode = 1; });
