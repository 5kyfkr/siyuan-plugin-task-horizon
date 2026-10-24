'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(
    path.resolve(__dirname, '..', 'src', 'task-horizon', 'main', 'task-runtime', '52-task-detail-runtime.js'),
    'utf8',
);
const storesSource = fs.readFileSync(
    path.resolve(__dirname, '..', 'src', 'task-horizon', 'main', '10-stores-rules-and-cache.js'),
    'utf8',
);
const cssSource = fs.readFileSync(
    path.resolve(__dirname, '..', 'task-horizon.css'),
    'utf8',
);

const buildStart = source.indexOf('function __tmBuildTaskDetailInnerHtml(');
const buildEnd = source.indexOf('function __tmBuildTaskDetailNoteViewInnerHtml(', buildStart);
assert.ok(buildStart >= 0 && buildEnd > buildStart, 'task detail markup must remain extractable');
const buildSource = source.slice(buildStart, buildEnd);

assert.match(
    buildSource,
    /__tmBuildTaskCheckinHistorySectionHtml\(task\)\}\s*\$\{__tmBuildTaskDetailCreatedAtFooterHtml\(task\)\}/,
    'the task creation time must render as the last block at the bottom of task details',
);
assert.doesNotMatch(
    buildSource,
    /__tmBuildTaskDetailCreatedAtFooterHtml\(task\)\}[\s\S]*?__tmBuildTaskCheckinHistorySectionHtml\(task\)\}/,
    'the creation time footer must not move above the repeat or check-in history sections',
);

const footerStart = source.indexOf('function __tmBuildTaskDetailCreatedAtFooterHtml(');
const footerEnd = source.indexOf('function __tmGetTaskDetailRemarkRaw(', footerStart);
assert.ok(footerStart >= 0 && footerEnd > footerStart, 'creation time footer builder must remain extractable');
const footerSource = source.slice(footerStart, footerEnd);
assert.match(footerSource, /data-tm-detail-footer/, 'the footer must expose a stable mount point for late hydration');
assert.match(footerSource, /hidden/, 'the footer must start hidden until a creation time is known');
assert.doesNotMatch(footerSource, /updated/, 'the footer must show the block creation time, not its last modification time');

assert.match(
    source,
    /function __tmBindTaskDetailEditor[\s\S]*?__tmHydrateTaskDetailCreatedAt\(root, initialTask\)/,
    'opening a detail must hydrate the creation time from the SiYuan block when the task object lacks it',
);
assert.match(
    source,
    /SELECT created FROM blocks WHERE id = '\$\{safeId\}' LIMIT 1/,
    'the fallback must read the creation time of exactly that SiYuan block',
);
assert.match(
    source,
    /const safeId = blockId\.replace\(\/'\/g, "''"\)/,
    'block ids must be escaped before they reach the SQL statement',
);

assert.match(
    storesSource,
    /created: String\(source\.created \|\| source\.created_at \|\| ''\)\.trim\(\)/,
    'the task index must persist the block creation time for cache-restored tasks',
);
assert.match(
    storesSource,
    /created: String\(item\.created \|\| item\.created_at \|\| ''\)\.trim\(\)/,
    'restoring a task from the index must keep the block creation time',
);
assert.match(
    cssSource,
    /\.tm-task-detail-footer\[hidden\]\s*\{\s*display:\s*none;/,
    'the hidden footer must not keep a flex box in the detail layout',
);
assert.match(
    cssSource,
    /\.tm-task-detail-footer\s*\{[^}]*justify-content:\s*center;[^}]*text-align:\s*center;/,
    'the creation time footer must sit centered at the bottom of the detail',
);
assert.doesNotMatch(
    cssSource,
    /\.tm-task-detail-footer\s*\{[^}]*border(?:-top)?\s*:/,
    'the creation time footer must not draw a divider above itself',
);
assert.match(
    cssSource,
    /\.tm-task-detail-footer\s*\{[^}]*color:\s*var\(--tm-secondary-text\)/,
    'the footer must share the muted detail meta color',
);
assert.doesNotMatch(
    cssSource,
    /\.tm-task-detail-footer__(?:value|label)\s*\{[^}]*color\s*:/,
    'the creation time value and its label must render in the same muted color',
);
assert.doesNotMatch(
    cssSource,
    /\.tm-task-detail-footer[^{]*\.tm-lucide-emoji/,
    'the footer must not keep styles for a removed leading icon',
);

class FakeElement {
    constructor(tag = 'div') {
        this.tag = tag;
        this.dataset = {};
        this.hidden = false;
        this.isConnected = true;
        this.textContent = '';
        this.children = new Map();
    }
    querySelector(selector) {
        return this.children.get(selector) || null;
    }
    append(selector, child) {
        this.children.set(selector, child);
        return child;
    }
}

const sqlCalls = [];
let sqlResult = { code: 0, data: [{ created: '20260123120000' }] };
const context = vm.createContext({
    Array,
    Date,
    Element: FakeElement,
    HTMLElement: FakeElement,
    Map,
    Number,
    Promise,
    String,
    API: {
        call: async (url, body) => {
            sqlCalls.push({ url, body });
            if (sqlResult instanceof Error) throw sqlResult;
            return sqlResult;
        },
    },
    esc: (value) => String(value ?? ''),
    __tmRenderLucideIcon: (name, extraClass = '', options = {}) => `<i data-icon="${name}" data-size="${options?.size || ''}"></i>`,
    __tmParseTimeToTs: (value) => {
        const raw = String(value || '').trim();
        if (/^\d{14}$/.test(raw)) {
            return new Date(
                Number(raw.slice(0, 4)),
                Number(raw.slice(4, 6)) - 1,
                Number(raw.slice(6, 8)),
                Number(raw.slice(8, 10)),
                Number(raw.slice(10, 12)),
                Number(raw.slice(12, 14)),
            ).getTime();
        }
        const ts = new Date(raw).getTime();
        return Number.isNaN(ts) ? 0 : ts;
    },
    __tmGetTaskDetailBlockId: (task) => String(task?.id || '').trim(),
});
context.globalThis = context;

const runtimeStart = source.indexOf('const __tmTaskDetailCreatedAtCache = new Map();');
const runtimeEnd = source.indexOf('function __tmGetTaskDetailRemarkRaw(', runtimeStart);
assert.ok(runtimeStart >= 0 && runtimeEnd > runtimeStart, 'creation time runtime must remain extractable as one block');
vm.runInContext(`${source.slice(runtimeStart, runtimeEnd)}\nthis.__tmTaskDetailCreatedAtCacheRef = __tmTaskDetailCreatedAtCache;`, context);

const footerWithValue = context.__tmBuildTaskDetailCreatedAtFooterHtml({ created: '20260123120000' });
assert.match(footerWithValue, /data-tm-detail-footer(?![^>]*\bhidden\b)/, 'a task block with created must render a visible footer');
assert.match(footerWithValue, /2026-01-23 12:00/, 'the footer must format the SiYuan yyyyMMddHHmmss creation time');
assert.doesNotMatch(
    footerWithValue,
    /calendar-clock|tm-lucide-emoji/,
    'the footer must not render an icon to the left of the creation label',
);

const footerWithoutValue = context.__tmBuildTaskDetailCreatedAtFooterHtml({ id: 'block-id' });
assert.match(footerWithoutValue, /data-tm-detail-footer[^>]*hidden/, 'a task without a known creation time must keep the footer hidden');
assert.match(footerWithoutValue, /data-tm-detail-created-at-value><\/span>/, 'the value slot must stay empty until hydration resolves');

assert.equal(context.__tmFormatTaskDetailCreatedAt('20260123120000'), '2026-01-23 12:00');
assert.equal(context.__tmFormatTaskDetailCreatedAt(''), '');
assert.equal(context.__tmFormatTaskDetailCreatedAt('not-a-time'), '');

(async () => {
    sqlCalls.length = 0;
    assert.equal(
        await context.__tmResolveTaskDetailCreatedAtRaw({ id: 'block-direct', created: '20250203040506' }),
        '20250203040506',
        'a task object that already carries the block creation time must be used as-is',
    );
    assert.equal(sqlCalls.length, 0, 'task objects with created must not trigger an extra SQL read');

    sqlCalls.length = 0;
    sqlResult = { code: 0, data: [{ created: '20240708112233' }] };
    assert.equal(await context.__tmResolveTaskDetailCreatedAtRaw({ id: "block'quote" }), '20240708112233');
    assert.equal(sqlCalls.length, 1, 'missing creation time must fall back to one block query');
    assert.equal(sqlCalls[0].url, '/api/query/sql');
    assert.match(sqlCalls[0].body.stmt, /WHERE id = 'block''quote'/, 'single quotes in block ids must be doubled');
    assert.match(sqlCalls[0].body.stmt, /LIMIT 1/, 'the fallback must read a single block row');

    assert.equal(
        await context.__tmResolveTaskDetailCreatedAtRaw({ id: "block'quote" }),
        '20240708112233',
        'resolved creation times must be cached per block',
    );
    assert.equal(sqlCalls.length, 1, 'reopening the same task must not repeat the block query');

    sqlCalls.length = 0;
    sqlResult = new Error('query failed');
    assert.equal(await context.__tmResolveTaskDetailCreatedAtRaw({ id: 'block-failure' }), '');
    assert.equal(sqlCalls.length, 1, 'a failed read must not be cached as a known value');
    sqlResult = { code: 1, data: [] };
    assert.equal(await context.__tmResolveTaskDetailCreatedAtRaw({ id: 'block-failure' }), '');

    const root = new FakeElement('aside');
    const footer = root.append('[data-tm-detail-footer]', new FakeElement('footer'));
    footer.hidden = true;
    const valueEl = footer.append('[data-tm-detail-created-at-value]', new FakeElement('span'));
    assert.equal(
        context.__tmApplyTaskDetailCreatedAt(root, '20260102030405'),
        true,
        'hydrating a resolved creation time must reveal the footer',
    );
    assert.equal(footer.hidden, false);
    assert.equal(footer.dataset.tmDetailCreatedAt, 'resolved');
    assert.equal(valueEl.textContent, '2026-01-02 03:04');
    assert.equal(context.__tmApplyTaskDetailCreatedAt(root, ''), false, 'an unknown creation time must not reveal the footer');

    assert.equal(
        context.__tmHydrateTaskDetailCreatedAt(new FakeElement('aside'), { id: 'block-no-footer' }),
        false,
        'details without a footer mount must skip hydration',
    );

    const hydrateRoot = new FakeElement('aside');
    const hydrateFooter = hydrateRoot.append('[data-tm-detail-footer]', new FakeElement('footer'));
    hydrateFooter.hidden = true;
    const hydrateValue = hydrateFooter.append('[data-tm-detail-created-at-value]', new FakeElement('span'));
    sqlCalls.length = 0;
    sqlResult = { code: 0, data: [{ created: '20261231235959' }] };
    assert.equal(
        context.__tmHydrateTaskDetailCreatedAt(hydrateRoot, { id: 'block-hydrate' }),
        true,
        'details opened for a cached task must start block hydration',
    );
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(hydrateFooter.hidden, false, 'hydration must reveal the footer once the block row arrives');
    assert.equal(hydrateValue.textContent, '2026-12-31 23:59');
    assert.equal(sqlCalls.length, 1);

    console.log('task-detail-created-at-contract: ok');
})().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
