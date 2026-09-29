# -*- coding: utf-8 -*-
# 去嵌入感：对齐原型的开敞布局
# JS：修根目录路径 bug、徽章移到名称行、徽章文案「连同子文档」、笔记本行不渲染空 meta
# CSS：nav/detail/source-list 去盒子、行紧凑化、选中态去描边、徽章弱化
import io

ROOT = r'D:\AI\trae\siyuan-plugin-task-horizon'

def load(path):
    return io.open(path, encoding='utf-8', newline='').read().replace('\r\n', '\n')

def save(path, s):
    io.open(path, 'w', encoding='utf-8', newline='').write(s.replace('\n', '\r\n'))

# ============================ JS ============================
JP = ROOT + r'\src\task-horizon\main\settings\60-settings-screen.js'
js = load(JP)

def jrep(old, new, tag):
    global js
    n = js.count(old)
    assert n == 1, f'JS {tag}: 命中 {n} 次'
    js = js.replace(old, new)
    print('ok js:', tag)

# ---- J1. 路径 bug：单段路径（根目录文档）也要 pop 掉文档名 ----
jrep("            if (segs.length > 1) segs.pop();",
     "            if (segs.length) segs.pop();",
     'root path pop fix')

# ---- J2. 来源行重组：名称+徽章一行，路径独占一行；笔记本行无空 meta ----
old_copy = """                                    <div class="tm-doc-group-manager__source-copy">
                                        <div class="tm-doc-group-manager__source-name" title="${esc(docName)}">${esc(docName)}</div>
                                        <div class="tm-doc-group-manager__source-meta">
                                            ${isNotebook ? '' : `<span class="tm-doc-group-manager__source-path" title="${esc(pathLabel.title)}">${esc(pathLabel.text)}</span>`}
                                            ${isNotebook ? '<span class="tm-doc-group-manager__badge">笔记本</span>' : ''}
                                            ${isRecursive ? '<span class="tm-doc-group-manager__badge">含子文档</span>' : ''}
                                            ${hasOtherBlockSource ? `<span class="tm-doc-group-manager__badge tm-doc-group-manager__badge--warning" title="${esc(otherBlockBadgeTitle)}">其他块${otherBlockCount > 1 ? ` ${otherBlockCount}` : ''}</span>` : ''}
                                        </div>
                                    </div>"""
new_copy = """                                    <div class="tm-doc-group-manager__source-copy">
                                        <div class="tm-doc-group-manager__source-top">
                                            <div class="tm-doc-group-manager__source-name" title="${esc(docName)}">${esc(docName)}</div>
                                            ${isNotebook ? '<span class="tm-doc-group-manager__badge">笔记本</span>' : ''}
                                            ${isRecursive ? '<span class="tm-doc-group-manager__badge">连同子文档</span>' : ''}
                                            ${hasOtherBlockSource ? `<span class="tm-doc-group-manager__badge tm-doc-group-manager__badge--warning" title="${esc(otherBlockBadgeTitle)}">其他块${otherBlockCount > 1 ? ` ${otherBlockCount}` : ''}</span>` : ''}
                                        </div>
                                        ${isNotebook ? '' : `<div class="tm-doc-group-manager__source-meta"><span class="tm-doc-group-manager__source-path" title="${esc(pathLabel.title)}">${esc(pathLabel.text)}</span></div>`}
                                    </div>"""
jrep(old_copy, new_copy, 'source row regroup')

save(JP, js)
print('JS saved')

# ============================ CSS ============================
CP = ROOT + r'\task-horizon.css'
css = load(CP)

def crep(old, new, tag):
    global css
    n = css.count(old)
    assert n == 1, f'CSS {tag}: 命中 {n} 次'
    css = css.replace(old, new)
    print('ok css:', tag)

# ---- C1. nav 去灰底，只留细分隔线 ----
crep("""    padding: 12px 10px;
    border-right: 1px solid var(--tm-border-color);
    background: color-mix(in srgb, var(--tm-sidebar-bg, var(--tm-section-bg)) 72%, var(--tm-bg-color));
}""",
"""    padding: 12px 4px 12px 0;
    border-right: 1px solid color-mix(in srgb, var(--tm-border-color) 60%, transparent);
}""",
    'nav de-box')

# ---- C2. detail 背景透明融入 ----
crep(""".tm-doc-group-manager__detail {
    min-width: 0;
    background: var(--tm-bg-color);
    transition: opacity 0.18s cubic-bezier(0.16, 1, 0.3, 1);
}""",
""".tm-doc-group-manager__detail {
    min-width: 0;
    transition: opacity 0.18s cubic-bezier(0.16, 1, 0.3, 1);
}""",
    'detail transparent')

# ---- C3. 分组项：紧凑、hover/选中去描边 ----
crep("""    min-height: 52px;
    display: grid;
    grid-template-columns: 26px minmax(0, 1fr);
    align-items: center;
    gap: 7px;
    padding: 7px 8px;
    border: 1px solid transparent;
    border-radius: 7px;""",
"""    min-height: 46px;
    display: grid;
    grid-template-columns: 22px minmax(0, 1fr);
    align-items: center;
    gap: 7px;
    padding: 6px 8px;
    border: 1px solid transparent;
    border-radius: 7px;""",
    'group compact')

crep(""".tm-doc-group-manager__group:hover,
.tm-doc-group-manager__group:focus-visible {
    border-color: var(--tm-border-color);
    background: var(--tm-hover-bg);
    outline: none;
}""",
""".tm-doc-group-manager__group:hover,
.tm-doc-group-manager__group:focus-visible {
    background: var(--tm-hover-bg);
    outline: none;
}""",
    'group hover no-border')

crep(""".tm-doc-group-manager__group.is-active {
    border-color: color-mix(in srgb, var(--tm-primary-color) 36%, var(--tm-border-color));
    background: color-mix(in srgb, var(--tm-primary-color) 11%, var(--tm-bg-color));
    color: var(--tm-primary-color);
}""",
""".tm-doc-group-manager__group.is-active {
    background: color-mix(in srgb, var(--tm-primary-color) 11%, var(--tm-bg-color));
    color: var(--tm-primary-color);
}""",
    'group active no-border')

crep(""".tm-doc-group-manager__group-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 26px;
    height: 26px;
    border-radius: 6px;
    background: color-mix(in srgb, currentColor 8%, transparent);
}""",
""".tm-doc-group-manager__group-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 22px;
    height: 22px;
    border-radius: 6px;
    background: color-mix(in srgb, currentColor 8%, transparent);
}""",
    'group icon smaller')

# ---- C4. 来源列表去盒子（去边框/圆角/限高，行分隔线保留）----
crep(""".tm-doc-group-manager__source-list {
    max-height: min(42vh, 330px);
    overflow-y: auto;
    border: 1px solid var(--tm-border-color);
    border-radius: 7px;
    overscroll-behavior: contain;
}""",
""".tm-doc-group-manager__source-list {
    min-width: 0;
}""",
    'source-list de-box')

# ---- C5. 来源行紧凑化 + 图标缩小 ----
crep(""".tm-doc-group-manager__source-row {
    min-height: 54px;
    display: grid;
    grid-template-columns: 26px minmax(0, 1fr) auto;
    align-items: center;
    gap: 8px;
    padding: 8px 10px;
    background: var(--tm-bg-color);
}""",
""".tm-doc-group-manager__source-row {
    min-height: 46px;
    display: grid;
    grid-template-columns: 22px minmax(0, 1fr) auto;
    align-items: center;
    gap: 8px;
    padding: 7px 2px;
}""",
    'source-row compact')

crep(""".tm-doc-group-manager__source-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 26px;
    height: 26px;
    border-radius: 6px;
    background: var(--tm-hover-bg);
    color: var(--tm-primary-color);
}""",
""".tm-doc-group-manager__source-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 22px;
    height: 22px;
    border-radius: 6px;
    background: var(--tm-hover-bg);
    color: var(--tm-primary-color);
}""",
    'source icon smaller')

# ---- C6. 名称行 flex 容器 + meta 字号 ----
crep(""".tm-doc-group-manager__source-meta {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 4px;
    margin-top: 3px;
    color: var(--tm-secondary-text);
    font-size: 10px;
    line-height: 1.35;
}""",
""".tm-doc-group-manager__source-top {
    display: flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
}

.tm-doc-group-manager__source-meta {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 4px;
    margin-top: 2px;
    color: var(--tm-secondary-text);
    font-size: 11px;
    line-height: 1.35;
}""",
    'source-top + meta')

# ---- C7. 徽章弱化为中性灰 ----
crep(""".tm-doc-group-manager__badge {
    padding: 1px 5px;
    border-radius: 999px;
    background: color-mix(in srgb, var(--tm-primary-color) 10%, transparent);
    color: var(--tm-primary-color);
}""",
""".tm-doc-group-manager__badge {
    flex: 0 0 auto;
    padding: 1px 5px;
    border-radius: 999px;
    background: var(--tm-hover-bg);
    color: var(--tm-secondary-text);
    font-size: 10.5px;
}""",
    'badge neutral')

save(CP, css)
print('CSS saved')
print('ALL DONE')
