'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const os = require('node:os');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');

// Use SiYuan's actual parser; SIYUAN_LUTE_PATH supports a checkout in another location.
const workspace = path.resolve(__dirname, '../..');
const lutePaths = process.env.SIYUAN_LUTE_PATH ? [path.resolve(process.env.SIYUAN_LUTE_PATH)] : process.env.CI ? [] :
    fs.readdirSync(workspace, { withFileTypes: true })
        .filter((entry) => entry.isDirectory() && /^siyuan(?:-\d|$)/.test(entry.name))
        .map((entry) => entry.name)
        .sort((a, b) => b.localeCompare(a, undefined, { numeric: true }))
        .map((name) => path.join(workspace, name, 'app/stage/protyle/js/lute/lute.min.js'));
let lutePath = lutePaths.find((candidate) => fs.existsSync(candidate));
if (!lutePath && !process.env.SIYUAN_LUTE_PATH) {
    // CI has no sibling SiYuan checkout. Pin its real parser and verify the cached/downloaded bytes.
    const commit = '158812497497c6fa8a6d1031bfa2f025a61ee5c2';
    const expectedHash = '936f8e9278ef6645287cbd8e7f0d12b6d23dc63b488a4354c36343d079026eda';
    const cacheDir = path.join(os.tmpdir(), `task-horizon-test-lute-${commit}`);
    lutePath = path.join(cacheDir, 'lute.min.js');
    if (!fs.existsSync(lutePath)) {
        const url = `https://raw.githubusercontent.com/siyuan-note/siyuan/${commit}/app/stage/protyle/js/lute/lute.min.js`;
        const bytes = execFileSync(process.execPath, ['-e', `
            fetch(process.argv[1], { signal: AbortSignal.timeout(60000) })
                .then(response => { if (!response.ok) throw new Error('Lute download: HTTP ' + response.status); return response.arrayBuffer(); })
                .then(bytes => process.stdout.write(Buffer.from(bytes)))
                .catch(error => { console.error(error.message); process.exitCode = 1; });
        `, url], { timeout: 65000, maxBuffer: 10 * 1024 * 1024 });
        assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'), expectedHash, 'downloaded Lute must match the pinned SiYuan parser');
        fs.mkdirSync(cacheDir, { recursive: true });
        fs.writeFileSync(lutePath, bytes);
    }
    assert.equal(crypto.createHash('sha256').update(fs.readFileSync(lutePath)).digest('hex'), expectedHash, 'cached Lute must match the pinned SiYuan parser');
}
assert.ok(lutePath, 'Set SIYUAN_LUTE_PATH to SiYuan app/stage/protyle/js/lute/lute.min.js');
require(lutePath);
const Lute = globalThis.Lute;

const source = fs.readFileSync(path.join(__dirname, '../src/task-horizon/main/20-api-and-runtime-services.js'), 'utf8');
const styles = fs.readFileSync(path.join(__dirname, '../task-horizon.css'), 'utf8');
assert.match(styles, /\.tm-task-detail-remark-preview \.tm-task-detail-remark-blank\s*\{[\s\S]*?min-height:\s*1\.6em;[\s\S]*?line-height:\s*1\.6;/, 'preview blank lines must occupy a full editor line');
assert.match(styles, /\.tm-task-detail-remark-shell \.bc-textarea\.tm-task-detail-remark-editor\s*\{[\s\S]*?padding:\s*0;[\s\S]*?line-height:\s*1\.6;/, 'editor content must share the preview inset and line height');
const start = source.indexOf('    const __tmRemarkRenderCache = new Map();');
const end = source.indexOf('    function __tmGetTextareaSelectionRange(', start);
assert.ok(start >= 0 && end > start, 'remark renderer must remain extractable');
const context = vm.createContext({
    Lute,
    esc: (value) => String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;')
        .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'),
});
vm.runInContext(source.slice(start, end), context);
const normalize = context.__tmNormalizeRemarkMarkdown;
const render = context.__tmRenderRemarkMarkdown;
const blank = '<div class="tm-task-detail-remark-blank" aria-hidden="true"><br></div>';
const paragraph = (text) => `<p><span class="tm-task-detail-remark-inline">${text}</span></p>`;

for (const count of [1, 2]) {
    const value = `第一段${'\n'.repeat(count + 1)}第二段`;
    assert.equal(normalize(value), value, `${count} blank lines must survive saving and reopening`);
    const expected = paragraph('第一段') + blank.repeat(count) + paragraph('第二段');
    assert.equal(render(value), expected, `${count} blank lines must remain separate from paragraph spacing`);
    assert.equal(render(value), expected, 'cached previews must preserve the same blank lines');
}

const outer = '\n\n正文\n\n\n';
assert.equal(normalize(outer), '正文', 'outer blank lines keep the existing normalization rule');
assert.equal(render(outer), paragraph('正文'));
assert.equal(normalize(`第一段${'\n'.repeat(4)}第二段`), `第一段${'\n'.repeat(3)}第二段`, 'the existing two-blank-line cap remains intact');
assert.equal(normalize('第一段  \r\n \t\r\n第二段\t'), '第一段\n\n第二段', 'line endings and trailing spaces stay normalized');
assert.equal(render('第一行\n第二行'), '<p><span class="tm-task-detail-remark-inline">第一行</span><br><span class="tm-task-detail-remark-inline">第二行</span></p>', 'ordinary line breaks must not gain blank lines');
assert.equal(normalize(' \n\t\n'), '', 'whitespace-only remarks stay empty');
assert.equal(render(' \n\t\n'), '<div class="tm-task-detail-remark-empty">点击添加备注</div>');

const formatted = render('**粗体**\n\n> 引用\n\n- 列表\n\n1. 有序列表');
assert.equal(formatted.split(blank).length - 1, 3, 'blank lines must survive transitions between Markdown block types');
assert.match(formatted, /<strong>粗体<\/strong>/);
assert.match(formatted, /<blockquote>.*引用.*<\/blockquote>/);
assert.match(formatted, /<ul><li>.*列表.*<\/li><\/ul>/);
assert.match(formatted, /<ol><li>.*有序列表.*<\/li><\/ol>/);
assert.equal(render('<script>alert(1)</script>\n\n尾行'), paragraph('&lt;script&gt;alert(1)&lt;/script&gt;') + blank + paragraph('尾行'), 'blank-line preservation must retain HTML escaping');

console.log('remark blank line behavior tests passed');

const inlineRender = context.__tmRenderRemarkInlineHtml;
const preview = render;
const strip = context.__tmStripRemarkMarkdown;

const product = '油枪_ORVR油气回收_红色_734-02G3R FS_富兰克林(喜力)';
for (const input of [product, product.replace(/_/g, '\\_')]) {
    assert.equal(inlineRender(input), product, 'product separators must stay literal, including escaped underscores');
    assert.equal(strip(input), product, 'plain-text summaries must preserve the same separators');
    const note = `TOK-982567-169\n${input}`;
    const expected = `<p><span class="tm-task-detail-remark-inline">TOK-982567-169</span><br><span class="tm-task-detail-remark-inline">${product}</span></p>`;
    assert.equal(preview(note), expected, 'the reported two-line note must not contain accidental emphasis');
    assert.equal(preview(note), expected, 'cached previews must retain literal underscores');
}

for (const input of ['part_model_red', 'part__model__red', '油枪_ORVR_红色', '油枪__ORVR__红色', 'e\u0301_model_e\u0301', '𠮷_model_𠮷', '前缀_斜体_', '_斜体_后缀']) {
    assert.equal(inlineRender(input), input, 'underscores inside identifiers must not act as formatting markers');
    assert.equal(strip(input), input, 'summaries must not remove underscores inside identifiers');
}

for (const [input, html, text] of [
    ['_斜体_', '<em>斜体</em>', '斜体'],
    ['__粗体__', '<strong>粗体</strong>', '粗体'],
    ['说明：_斜体_。', '说明：<em>斜体</em>。', '说明：斜体。'],
    ['**粗体** 与 *斜体*', '<strong>粗体</strong> 与 <em>斜体</em>', '粗体 与 斜体'],
    ['_ 不格式化 _', '_ 不格式化 _', '_ 不格式化 _'],
    ['__ 不格式化 __', '__ 不格式化 __', '__ 不格式化 __'],
    [String.raw`\_普通文字\_`, '_普通文字_', '_普通文字_'],
    [String.raw`\_不闭合_ 与 _斜体_`, '_不闭合_ 与 <em>斜体</em>', '_不闭合_ 与 斜体'],
    [String.raw`_不闭合\_ 与 _斜体_`, '_不闭合_ 与 <em>斜体</em>', '_不闭合_ 与 斜体'],
    [String.raw`\*普通文字\*`, '*普通文字*', '*普通文字*'],
    [String.raw`\\_斜体_`, '\\<em>斜体</em>', '\\斜体'],
    [String.raw`\\\_普通文字\_`, '\\_普通文字_', '\\_普通文字_'],
    [String.raw`\__普通文字_`, '_<em>普通文字</em>', '_普通文字'],
    [String.raw`C:\temp\model_red`, String.raw`C:\temp\model_red`, String.raw`C:\temp\model_red`],
    ['**油枪_ORVR_红色**', '<strong>油枪_ORVR_红色</strong>', '油枪_ORVR_红色'],
    [String.raw`**\_普通文字\_**`, '<strong>_普通文字_</strong>', '_普通文字_'],
    ['`_普通文字_`', '<code>_普通文字_</code>', '_普通文字_'],
    ['**`_普通文字_`**', '<strong><code>_普通文字_</code></strong>', '_普通文字_'],
    ['`\\_普通文字\\_`', '<code>\\_普通文字\\_</code>', '\\_普通文字\\_'],
    ['\\`_斜体_\\`', '`<em>斜体</em>`', '`斜体`'],
    [String.raw`\<img src=x\>`, '&lt;img src=x&gt;', '<img src=x>'],
    ['<img src=x onerror=alert(1)>', '&lt;img src=x onerror=alert(1)&gt;', '<img src=x onerror=alert(1)>'],
    ['[链接](javascript:evil)', '链接', '链接'],
    ['**[链接](https://example.com)**', '<strong><a class="tm-task-detail-remark-link" href="https://example.com" target="_blank" rel="noopener noreferrer">链接</a></strong>', '链接'],
    ['[油枪_ORVR_红色](https://example.com/model_red)', '<a class="tm-task-detail-remark-link" href="https://example.com/model_red" target="_blank" rel="noopener noreferrer">油枪_ORVR_红色</a>', '油枪_ORVR_红色'],
    ['***粗斜体***', '<em><strong>粗斜体</strong></em>', '粗斜体'],
    ['___粗斜体___', '<em><strong>粗斜体</strong></em>', '粗斜体'],
    ['*斜体 **粗体** 尾部*', '<em>斜体 <strong>粗体</strong> 尾部</em>', '斜体 粗体 尾部'],
    ['**粗体 *斜体* 尾部**', '<strong>粗体 <em>斜体</em> 尾部</strong>', '粗体 斜体 尾部'],
    ['a*斜体*b', 'a<em>斜体</em>b', 'a斜体b'],
    ['``a`b``', '<code>a`b</code>', 'a`b'],
    ['` foo `', '<code>foo</code>', 'foo'],
    [String.raw`\! \? \; \: \/`, '! ? ; : /', '! ? ; : /'],
    ['~~删除线~~', '<del>删除线</del>', '删除线'],
    ['==高亮==', '<mark>高亮</mark>', '高亮'],
    ['^上标^ ~下标~', '<sup>上标</sup> <sub>下标</sub>', '上标 下标'],
    ['++下划线++', '++下划线++', '++下划线++'],
    ['&amp; &lt; &#95;', '&amp; &lt; _', '& < _'],
    ['[**粗体**](https://example.com/a_(b) "标题")', '<a class="tm-task-detail-remark-link" href="https://example.com/a_(b)" title="标题" target="_blank" rel="noopener noreferrer"><strong>粗体</strong></a>', '粗体'],
]) {
    assert.equal(inlineRender(input), html, `inline rendering: ${input}`);
    assert.equal(strip(input), text, `plain-text summary: ${input}`);
}

// Compare marker combinations with Lute's HTML renderer independently of our AST adapter.
const oracle = Lute.New();
oracle.SetAutoSpace(false);
oracle.SetFixTermTypo(false);
oracle.SetGFMStrikethrough1(false);
oracle.SetMark(true);
oracle.SetSup(true);
oracle.SetSub(true);
const markers = ['*', '**', '***', '_', '__', '___', '`', '``', '~~', '==', '^', '~'];
let comparisons = 0;
for (const marker of markers) {
    for (const body of ['文字', ' word ', 'a_b', 'a*b', '**内层**', '_内层_', '`a_b`']) {
        for (const [before, after] of [['', ''], ['前缀', '后缀'], ['(', ')'], ['\\', '']]) {
            const input = `${before}${marker}${body}${marker}${after}`;
            const expected = oracle.Md2HTML(`text ${input}`).trim().replace(/^<p>text /, '').replace(/<\/p>$/, '');
            assert.equal(inlineRender(input), expected, `Lute delimiter parity: ${input}`);
            comparisons += 1;
        }
    }
}

const fallback = vm.createContext({ esc: context.esc });
vm.runInContext(source.slice(start, end), fallback);
assert.equal(fallback.__tmRenderRemarkInlineHtml('<img src=x>_文字_'), '&lt;img src=x&gt;_文字_');
assert.equal(fallback.__tmStripRemarkMarkdown('**粗体**'), '**粗体**');
assert.match(fallback.__tmRenderRemarkMarkdown('**粗体**'), /\*\*粗体\*\*/);
fallback.Lute = Lute;
assert.equal(fallback.__tmStripRemarkMarkdown('**粗体**'), '粗体', 'an unavailable parser must not poison the summary cache');
assert.match(fallback.__tmRenderRemarkMarkdown('**粗体**'), /<strong>粗体<\/strong>/, 'previews must recover when Lute becomes available');
console.log(`remark inline markdown behavior tests passed (${comparisons} comparisons with SiYuan Lute ${Lute.Version})`);
