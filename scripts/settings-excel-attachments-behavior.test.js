'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const vm = require('node:vm');
const { pathToFileURL } = require('node:url');
const { test } = require('node:test');
const XLSX = require('../src/vendor/xlsx.full.min.js');
const JSZip = require('../src/vendor/jszip.min.js');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const exportSource = read('src/task-horizon/main/settings/64-export-runtime.js');
const storeSource = read('src/task-horizon/main/10-stores-rules-and-cache.js');
const attachmentSource = read('src/task-horizon/main/task-runtime/51-whiteboard-and-link-runtime.js');
function fragment(source, start, end) {
    const from = source.indexOf(start);
    const to = source.indexOf(end, from + start.length);
    assert.ok(from >= 0 && to > from, `missing production fragment: ${start}`);
    return source.slice(from, to);
}
const helpers = fragment(storeSource, '    function __tmGetTaskAttachmentAttrIndex(', '    function __tmBuildTaskAttachmentAttrPayload(');
const query = fragment(attachmentSource, '    async function __tmQueryAttachmentLibraryAttachmentAttrRows(', '    function __tmResolveAttachmentLibraryAttrSource(');
const href = fragment(attachmentSource, '    function __tmResolveTaskAttachmentHref(', '    const __TM_TASK_ATTACHMENT_VIEWER_Z_INDEX');

const id = (n) => `20261021000000-task${n}`;
const task = (n, paths = [], extra = {}) => ({
    id: id(n), content: `任务 ${n}`, attachments: paths, __attachmentAttrsLoaded: true, ...extra,
});

function fixture(tasks, assets = new Map(), attrs = new Map()) {
    const downloads = [], messages = [], requests = [], queries = [], timers = [];
    const blobs = new Map();
    let nextUrl = 0;
    const context = vm.createContext({
        Blob, URL, Date, Uint8Array, ArrayBuffer, Map, Set,
        console: { error() {} },
        __TM_TASK_ATTACHMENT_ATTR_PREFIX: 'custom-data-assets-th-',
        __TM_TASK_ATTACHMENT_META_ATTR: 'custom-data-assets-th-meta',
        __TM_TASK_ATTACHMENT_BLOCK_PREFIX: 'block:',
        __TM_TASK_ATTACHMENT_BLOCK_ID_PATTERN: /^[0-9]{14}-[A-Za-z0-9]+$/,
        __tmTaskAttachmentBlockMetaCache: new Map(),
        __tmRememberSmallCache: (map, key, value) => map.set(key, value),
        state: {
            viewMode: 'list', activeDocId: 'all', filteredTasks: tasks,
            flatTasks: Object.fromEntries(tasks.map((item) => [item.id, item])),
            collapsedTaskIds: new Set(['preserved']), collapsedGroups: new Set(['group']),
            expandedCompletedGroups: new Set(['complete']),
        },
        SettingsStore: { data: { columnOrder: ['content', 'startDate', 'custom:tag', 'attachments'] } },
        __tmGetDefaultColumnOrder: () => ['content', 'startDate', 'custom:tag', 'attachments'],
        __tmGetCustomFieldDefs: () => [{ id: 'tag', name: '标签', type: 'multi' }],
        __tmBuildCustomFieldColumnKey: (key) => `custom:${key}`,
        __tmGetTaskCustomFieldValue: (item, key) => item.customFields?.[key],
        __tmResolveCustomFieldSelectedOptions: (_, values) => (values || []).map((value) => ({ name: value })),
        __tmBuildTaskRowModel: () => tasks.map((item) => ({ type: 'task', id: item.id, depth: item.depth || 0 })),
        __tmBuildCompletedRootGroupKey: () => 'completed',
        __tmFormatTaskTime: (value) => String(value || ''),
        __tmIsOtherBlockTabId: () => false,
        hint: (message, kind) => messages.push({ message, kind }),
        window: {},
        document: {
            body: { appendChild() {} },
            getElementById: () => null,
            createElement: () => ({
                click() { downloads.push({ filename: this.download, blob: blobs.get(this.href) }); },
                remove() {},
            }),
        },
        setTimeout: (callback) => { timers.push(callback); },
        fetch: async (url) => {
            requests.push(url);
            const value = assets.get(url);
            if (typeof value === 'function') return await value();
            return new Response(value ?? 'missing', { status: value == null ? 404 : 200 });
        },
        API: { call: async (_, { stmt }) => {
            const ids = [...stmt.matchAll(/'(\d{14}-[A-Za-z0-9]+)'/g)].map((match) => match[1]);
            queries.push(ids);
            if (context.failQuery) return { code: -1 };
            return { code: 0, data: ids.flatMap((blockId) => Object.entries(attrs.get(blockId) || {})
                .map(([name, value]) => ({ block_id: blockId, name, value }))) };
        } },
        XLSX: {
            ...XLSX,
            writeFileXLSX(wb, filename) {
                downloads.push({ filename, data: XLSX.write(wb, { type: 'buffer', bookType: 'xlsx', cellStyles: true }) });
            },
        },
        __taskHorizonEnsureZipModuleLoaded: async () => { context.JSZip = JSZip; },
    });
    // Attachment URI parsing uses the real URL constructor; download URLs use the fixture methods.
    context.URL = class extends URL {
        static createObjectURL(blob) { const key = `blob:export-${++nextUrl}`; blobs.set(key, blob); return key; }
        static revokeObjectURL(key) { blobs.delete(key); }
    };
    vm.runInContext(helpers + query + href + exportSource, context);
    return { context, downloads, messages, requests, queries, timers, run: () => context.window.tmExportCurrentTableExcel() };
}

async function unpack(download) {
    const data = download.data || new Uint8Array(await download.blob.arrayBuffer());
    let workbookData = data, zip;
    if (download.filename.endsWith('.zip')) {
        zip = await JSZip.loadAsync(data);
        const filename = Object.keys(zip.files).find((name) => name.endsWith('.xlsx'));
        workbookData = await zip.file(filename).async('uint8array');
    }
    const wb = XLSX.read(workbookData, { cellNF: true, cellStyles: true });
    // Inspect saved relationships directly: SheetJS's reader misdecodes UTF-8 hyperlink targets.
    const packageZip = await JSZip.loadAsync(workbookData);
    const relationships = packageZip.file('xl/worksheets/_rels/sheet1.xml.rels');
    const byId = new Map();
    if (relationships) {
        const xml = await relationships.async('string');
        for (const match of xml.matchAll(/<Relationship\b([^>]+)\/>/g)) {
            const attrs = Object.fromEntries([...match[1].matchAll(/(\w+)="([^"]*)"/g)]
                .map((item) => [item[1], item[2].replace(/&(amp|quot|apos|lt|gt);/g,
                    (_, entity) => ({ amp: '&', quot: '"', apos: "'", lt: '<', gt: '>' })[entity])]));
            byId.set(attrs.Id, attrs.Target);
        }
    }
    const mainLinks = Object.fromEntries(Object.entries(wb.Sheets['任务导出'])
        .filter(([, cell]) => cell?.l?.id).map(([ref, cell]) => [ref, byId.get(cell.l.id)]));
    return { zip, wb, data, mainLinks };
}

test('ZIP preserves original bytes, Unicode names, relative links, deduplication and existing columns', async () => {
    const first = task(1, ['assets/a/合同.pdf', 'assets/b/合同.pdf'], { startDate: '2026-10-21', customFields: { tag: ['工作', '重要'] } });
    const second = task(2, ['assets/a/合同.pdf'], { parentTaskId: first.id, depth: 1 });
    const originals = new Map([
        ['/assets/a/合同.pdf', Uint8Array.from([0, 1, 2, 255])],
        ['/assets/b/合同.pdf', Uint8Array.from([3, 4, 5])],
    ]);
    const h = fixture([first, second], originals);
    const before = JSON.stringify(h.context.state);
    await h.run();
    assert.equal(h.downloads.length, 1);
    assert.match(h.downloads[0].filename, /\.zip$/);
    const { zip, wb, data, mainLinks } = await unpack(h.downloads[0]);
    const main = wb.Sheets['任务导出'];
    const names = Object.keys(zip.files).filter((name) => !zip.files[name].dir && !name.endsWith('.xlsx'));
    assert.deepEqual(names, ['附件/a/合同.pdf', '附件/b/合同.pdf']);
    assert.deepEqual(await zip.file(names[0]).async('uint8array'), originals.get('/assets/a/合同.pdf'));
    assert.deepEqual(await zip.file(names[1]).async('uint8array'), originals.get('/assets/b/合同.pdf'));
    assert.equal(h.requests.length, 2, 'shared attachment is read and copied once');
    assert.deepEqual(wb.SheetNames, ['任务导出']);
    assert.equal(main.G1.v, '附件');
    assert.equal(mainLinks.G2, names[0]);
    assert.equal(mainLinks.H2, names[1]);
    assert.equal(mainLinks.G3, names[0]);
    assert.equal(main.G2.v, '合同.pdf');
    assert.equal(main.H2.v, '合同.pdf');
    assert.equal(main.D2.v, first.content);
    assert.equal(main.D3.v, second.content);
    assert.equal(main.E2.t, 'n');
    assert.equal(main.E2.z, 'yyyy-mm-dd');
    assert.equal(main.F2.v, '工作, 重要');
    assert.equal(main['!rows'][2].level, 1);
    assert.equal(main['!autofilter'].ref, 'A1:H3');
    assert.equal(JSON.stringify(h.context.state), before, 'export must not change task or collapse state');
    assert.equal(h.messages.at(-1).kind, 'success');
    assert.match(h.messages.at(-1).message, /请解压/);
    if (process.env.TM_EXCEL_EXPORT_ARTIFACT_DIR) {
        fs.mkdirSync(process.env.TM_EXCEL_EXPORT_ARTIFACT_DIR, { recursive: true });
        fs.writeFileSync(path.join(process.env.TM_EXCEL_EXPORT_ARTIFACT_DIR, '任务附件导出.zip'), data);
    }
});

test('missing files are reported without interrupting copied files; all-missing export remains readable', async () => {
    const h = fixture([task(1, ['assets/missing.pdf', 'assets/ok.png'])], new Map([['/assets/ok.png', Uint8Array.from([9, 8, 7])]]));
    await h.run();
    const { wb, zip, mainLinks } = await unpack(h.downloads[0]);
    assert.equal(mainLinks.H2, '附件/ok.png');
    assert.match(wb.Sheets['任务导出'].G2.v, /未导出.*404/);
    assert.equal(wb.Sheets['任务导出'].G2.l, undefined);
    assert.ok(zip.file('附件/ok.png'));
    assert.equal(h.messages.at(-1).kind, 'warning');
    const missing = fixture([task(1, ['assets/missing.pdf'])]);
    await missing.run();
    assert.match(missing.downloads[0].filename, /\.xlsx$/);
    const { wb: missingWb } = await unpack(missing.downloads[0]);
    assert.match(missingWb.Sheets['任务导出'].G2.v, /未导出/);
    assert.equal(missing.messages.at(-1).kind, 'warning');
});

test('copies readable local files and retains directory, web and SiYuan references', async () => {
    const h = fixture([task(1, [
        'file:///C:/资料/合同.pdf', 'file:///C:/资料/目录',
        'https://example.com/reference.pdf', `block:${id(7)}`,
    ])]);
    const reads = [];
    h.context.__taskHorizonReadLocalAttachmentFile = async (uri) => {
        reads.push(uri);
        return uri.endsWith('/%E7%9B%AE%E5%BD%95') ? { isDirectory: true } : { data: Uint8Array.from([6]) };
    };
    await h.run();
    const { wb, zip } = await unpack(h.downloads[0]);
    const rows = XLSX.utils.sheet_to_json(wb.Sheets['任务导出'], { header: 1 });
    assert.equal(reads.length, 2);
    assert.equal(rows[1][6], '合同.pdf');
    assert.match(wb.Sheets['任务导出'].H2.l.Target, /^file:/);
    assert.equal(wb.Sheets['任务导出'].I2.l.Target, 'https://example.com/reference.pdf');
    assert.equal(wb.Sheets['任务导出'].J2.l.Target, `siyuan://blocks/${id(7)}`);
    assert.equal(Object.keys(zip.files).filter((name) => name.startsWith('附件/') && !zip.files[name].dir).length, 1);
    assert.deepEqual(h.requests, [], 'references must not trigger remote downloads');
});

test('hydrates only incomplete attachment snapshots without overwriting projected task state', async () => {
    const incomplete = task(1, [], { __attachmentAttrsLoaded: false });
    const pending = task(2, ['assets/projected.pdf']);
    const attrs = new Map([
        [id(1), { 'custom-data-assets-th-0': 'assets/hydrated.pdf' }],
        [id(2), { 'custom-data-assets-th-0': 'assets/stale.pdf' }],
    ]);
    const h = fixture([incomplete, pending], new Map([
        ['/assets/hydrated.pdf', Uint8Array.of(1)], ['/assets/projected.pdf', Uint8Array.of(2)],
    ]), attrs);
    await h.run();
    assert.deepEqual(h.queries, [[id(1)]]);
    assert.deepEqual(incomplete.attachments, []);
    assert.equal(incomplete.__attachmentAttrsLoaded, false);
    assert.equal(h.requests.includes('/assets/stale.pdf'), false);
    assert.equal(h.downloads.length, 1);
});

test('metadata or ZIP loader failure produces no partial download and allows retry', async () => {
    const h = fixture([task(1, [], { __attachmentAttrsLoaded: false })]);
    h.context.failQuery = true;
    await h.run();
    assert.equal(h.downloads.length, 0);
    assert.equal(h.messages.at(-1).kind, 'error');
    h.context.failQuery = false;
    await h.run();
    assert.equal(h.downloads.length, 1);
    assert.match(h.downloads[0].filename, /\.xlsx$/);
    const zip = fixture([task(1, ['assets/a.pdf'])], new Map([['/assets/a.pdf', Uint8Array.of(1)]]));
    zip.context.__taskHorizonEnsureZipModuleLoaded = async () => {};
    await zip.run();
    assert.equal(zip.downloads.length, 0);
    assert.equal(zip.messages.at(-1).kind, 'error');
    zip.context.__taskHorizonEnsureZipModuleLoaded = async () => { zip.context.JSZip = JSZip; };
    await zip.run();
    assert.equal(zip.downloads.length, 1);
});

test('prevents duplicate exports during asynchronous attachment reads', async () => {
    let release;
    const gate = new Promise((resolve) => { release = resolve; });
    const h = fixture([task(1, ['assets/a.pdf'])], new Map([['/assets/a.pdf', async () => {
        await gate;
        return new Response(Uint8Array.of(1));
    }]]));
    const running = h.run();
    await Promise.resolve();
    await h.run();
    release();
    await running;
    assert.equal(h.requests.length, 1);
    assert.equal(h.downloads.length, 1);
});

test('rejects traversal paths and retains plain workbook export for empty attachments', async () => {
    const h = fixture([task(1, ['assets/%2e%2e/private.pdf', 'assets/%2fsecret.pdf'])]);
    await h.run();
    assert.deepEqual(h.requests, []);
    assert.match(h.messages.at(-1).message, /2 个附件未导出/);
    const plain = fixture([task(1)]);
    await plain.run();
    const { wb } = await unpack(plain.downloads[0]);
    assert.deepEqual(wb.SheetNames, ['任务导出']);
    assert.match(plain.downloads[0].filename, /\.xlsx$/);
    const empty = fixture([]);
    await empty.run();
    assert.equal(empty.downloads.length, 0);
});

test('long and reserved filenames remain extractable with their original extension', async () => {
    const longName = `${'合同'.repeat(90)}.pdf`;
    const h = fixture([task(1, [`assets/${longName}`, 'assets/CON.pdf'])], new Map([
        [`/assets/${longName}`, Uint8Array.of(1)], ['/assets/CON.pdf', Uint8Array.of(2)],
    ]));
    await h.run();
    const { zip, wb } = await unpack(h.downloads[0]);
    const files = Object.keys(zip.files).filter((name) => name.startsWith('附件/') && !zip.files[name].dir);
    assert.equal(files.length, 2);
    assert.ok(files.some((name) => name.endsWith(`/${'合同'.repeat(58)}.pdf`)));
    assert.ok(files.includes('附件/_CON.pdf'));
    assert.ok(wb.Sheets['任务导出'].G2.l.Tooltip.length <= 255);
});

test('main-sheet attachment cells use literal local filenames with no internal jumps or UTF-8 URI encoding', async () => {
    const paths = ['assets/新建 文本文档2.xlsx', 'assets/截图.png', 'assets/report%231%25.xlsx'];
    const targetBook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(targetBook, XLSX.utils.aoa_to_sheet([['Attachment hyperlink verified']]), 'Target');
    const targetData = XLSX.write(targetBook, { type: 'buffer', bookType: 'xlsx' });
    const h = fixture([task(1, paths)], new Map(paths.map((item) => [`/${item}`, targetData])));
    await h.run();
    const { zip, wb, data, mainLinks } = await unpack(h.downloads[0]);
    const sheet = wb.Sheets['任务导出'];
    assert.deepEqual(wb.SheetNames, ['任务导出']);
    for (const ref of ['G2', 'H2', 'I2']) {
        assert.ok(mainLinks[ref].startsWith('附件/'));
        assert.ok(!mainLinks[ref].includes('%'));
        assert.ok(zip.file(mainLinks[ref]), 'hyperlink target must exactly match an archive filename');
    }
    assert.equal(mainLinks.G2, '附件/新建 文本文档2.xlsx');
    assert.equal(sheet.G2.v, '新建 文本文档2.xlsx');
    assert.equal(mainLinks.I2, '附件/report_1_.xlsx');
    if (process.env.TM_EXCEL_EXPORT_ARTIFACT_DIR) {
        fs.mkdirSync(process.env.TM_EXCEL_EXPORT_ARTIFACT_DIR, { recursive: true });
        fs.writeFileSync(path.join(process.env.TM_EXCEL_EXPORT_ARTIFACT_DIR, 'excel-direct-links.zip'), data);
    }
});

test('same-name local attachments keep distinct bytes without introducing global sequence numbers', async () => {
    const h = fixture([task(1, ['file:///C:/one/report.txt', 'file:///C:/two/report.txt'])]);
    h.context.__taskHorizonReadLocalAttachmentFile = async (uri) => ({ data: Uint8Array.of(uri.includes('/one/') ? 1 : 2) });
    await h.run();
    const { zip, wb, mainLinks } = await unpack(h.downloads[0]);
    assert.equal(mainLinks.G2, '附件/本地/report.txt');
    assert.equal(mainLinks.H2, '附件/本地/report (2).txt');
    assert.equal(wb.Sheets['任务导出'].H2.v, 'report (2).txt');
    assert.deepEqual(await zip.file('附件/本地/report.txt').async('uint8array'), Uint8Array.of(1));
    assert.deepEqual(await zip.file('附件/本地/report (2).txt').async('uint8array'), Uint8Array.of(2));
});

test('expanded attachment columns preserve configured order, later dates and custom fields', async () => {
    const h = fixture([task(1, ['assets/a.pdf', 'assets/b.pdf'], {
        startDate: '2026-10-21', customFields: { tag: ['重要'] },
    })], new Map([['/assets/a.pdf', Uint8Array.of(1)], ['/assets/b.pdf', Uint8Array.of(2)]]));
    h.context.SettingsStore.data.columnOrder = ['attachments', 'content', 'startDate', 'custom:tag'];
    await h.run();
    const { wb, mainLinks } = await unpack(h.downloads[0]);
    const sheet = wb.Sheets['任务导出'];
    assert.equal(sheet.D1.v, '附件');
    assert.equal(sheet.E1.v, '附件 2');
    assert.equal(sheet.F2.v, '任务 1');
    assert.equal(sheet.G2.z, 'yyyy-mm-dd');
    assert.equal(sheet.H2.v, '重要');
    assert.equal(sheet['!ref'], 'A1:H2');
    assert.deepEqual(mainLinks, { D2: '附件/a.pdf', E2: '附件/b.pdf' });
});

test('every task retains one row regardless of attachment count', async () => {
    const h = fixture([task(1, ['assets/a.pdf', 'assets/b.pdf']), task(2)], new Map([
        ['/assets/a.pdf', Uint8Array.of(1)], ['/assets/b.pdf', Uint8Array.of(2)],
    ]));
    await h.run();
    const { wb, mainLinks } = await unpack(h.downloads[0]);
    const sheet = wb.Sheets['任务导出'];
    assert.equal(sheet.D3.v, '任务 2');
    assert.equal(sheet.G3.v, '');
    assert.equal(sheet.G3.l, undefined);
    assert.equal(sheet.H3.v, '');
    assert.equal(sheet.H3.l, undefined);
    assert.equal(sheet['!ref'], 'A1:H3');
    assert.deepEqual(mainLinks, { G2: '附件/a.pdf', H2: '附件/b.pdf' });
    assert.match(h.messages.at(-1).message, /2 条任务/);
});

test('vendored ZIP loads in a browser global and native bridge reads files without copying folders', { skip: process.platform !== 'win32' }, async (t) => {
    const browser = vm.createContext({ setTimeout, clearTimeout, Uint8Array, ArrayBuffer });
    vm.runInContext(read('src/vendor/jszip.min.js'), browser);
    assert.equal(typeof browser.JSZip, 'function');
    const source = read('index.js');
    const bridge = vm.runInNewContext(fragment(source, 'const decodeTaskHorizonFilePathPart =', 'const normalizeTaskDevScriptPath =')
        + '\nreadTaskHorizonLocalAttachmentFile;', { require, URL, Uint8Array });
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'task-horizon-excel-'));
    const filename = path.join(directory, '合同 #1.txt');
    fs.writeFileSync(filename, Uint8Array.from([1, 2, 255]));
    t.after(() => { fs.unlinkSync(filename); fs.rmdirSync(directory); });
    assert.deepEqual((await bridge(pathToFileURL(filename).href)).data, Uint8Array.from([1, 2, 255]));
    assert.equal((await bridge(pathToFileURL(directory).href)).isDirectory, true);
    await assert.rejects(bridge('https://example.com/file.pdf'), /无效的本地文件路径/);
});
