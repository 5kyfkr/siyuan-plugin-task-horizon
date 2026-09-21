'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../src/task-horizon/main/20-api-and-runtime-services.js'), 'utf8');
const styles = fs.readFileSync(path.join(__dirname, '../task-horizon.css'), 'utf8');
assert.match(styles, /\.tm-task-detail-remark-preview \.tm-task-detail-remark-blank\s*\{[\s\S]*?min-height:\s*1\.6em;[\s\S]*?line-height:\s*1\.6;/, 'preview blank lines must occupy a full editor line');
assert.match(styles, /\.tm-task-detail-remark-shell \.bc-textarea\.tm-task-detail-remark-editor\s*\{[\s\S]*?padding:\s*0;[\s\S]*?line-height:\s*1\.6;/, 'editor content must share the preview inset and line height');
const start = source.indexOf('    const __tmRemarkRenderCache = new Map();');
const end = source.indexOf('    function __tmStripRemarkMarkdown(', start);
assert.ok(start >= 0 && end > start, 'remark renderer must remain extractable');
const context = vm.createContext({
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
