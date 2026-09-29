# -*- coding: utf-8 -*-
"""Restructure embedded priority-score settings into flat divider-separated modules.

- customFieldSection / titleOpacitySection: module markup when embedded, legacy when standalone.
- embedded branch: tm-rule-section boxes -> .tm-priority-module list (hairline separators).
All data-tm-call / data-tm-args handlers are preserved verbatim.
"""
import io
import re
import sys

PATH = "src/task-horizon/main/30-dialogs-and-ui-foundation.js"

with io.open(PATH, "r", encoding="utf-8", newline="") as f:
    src = f.read()
src = src.replace("\r\n", "\n")

reps = []

# --- Block A: customFieldSection -------------------------------------------
old_a = """        const customFieldSection = `
            <div class="${embedded ? 'tm-rule-section ' : ''}tm-priority-section" style="margin-bottom:${embedded ? '0' : '14px'};">
                <div class="tm-priority-section__title">自定义列加减分</div>
                <div class="tm-priority-custom-fields">
                    ${customFieldGroups || '<div class="tm-priority-empty">暂无单选或多选自定义列</div>'}
                </div>
            </div>
        `;"""
new_a = """        const customFieldSection = embedded ? `
            <div class="tm-priority-module">
                <div class="tm-priority-module__head">
                    <div class="tm-priority-module__copy">
                        <div class="tm-priority-module__title">自定义列加减分</div>
                        <div class="tm-priority-module__desc">单选 / 多选自定义列按选项加分，展开列名逐项设置。</div>
                    </div>
                </div>
                <div class="tm-priority-custom-fields">
                    ${customFieldGroups || '<div class="tm-priority-empty">暂无单选或多选自定义列</div>'}
                </div>
            </div>
        ` : `
            <div class="tm-priority-section" style="margin-bottom:14px;">
                <div class="tm-priority-section__title">自定义列加减分</div>
                <div class="tm-priority-custom-fields">
                    ${customFieldGroups || '<div class="tm-priority-empty">暂无单选或多选自定义列</div>'}
                </div>
            </div>
        `;"""
reps.append((old_a, new_a, "customFieldSection"))

# --- Block B: titleOpacitySection ------------------------------------------
old_b = """        const titleOpacitySection = `
            <div class="${embedded ? 'tm-rule-section' : ''}" style="margin-bottom:${embedded ? '0' : '14px'};">
                <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:10px;flex-wrap:wrap;">
                    <label style="display:flex;align-items:center;gap:8px;font-weight:700;">
                        <input class="b3-switch fn__flex-center" type="checkbox" ${titleOpacityEnabled ? 'checked' : ''} data-tm-call="tmTogglePriorityTitleOpacity">
                        分值分段显示任务名称颜色和透明度
                    </label>
                    <button class="tm-btn tm-btn-secondary" data-tm-call="tmAddPriorityTitleOpacityRange">+ 添加</button>
                </div>
                <div style="font-size:12px;color:var(--tm-secondary-text);margin-bottom:8px;">按优先级分值匹配区间，只改变任务名称颜色和透明度，不影响排序和奖励分值。</div>
                ${titleOpacityRows || '<div style="color: var(--tm-secondary-text);">暂无配置</div>'}
            </div>
        `;"""
new_b = """        const titleOpacitySection = embedded ? `
            <div class="tm-priority-module">
                <div class="tm-priority-module__head">
                    <div class="tm-priority-module__copy">
                        <div class="tm-priority-module__title">分值分段显示任务名称颜色和透明度</div>
                        <div class="tm-priority-module__desc">按优先级分值匹配区间，只改变任务名称颜色和透明度，不影响排序和奖励分值。</div>
                    </div>
                    <div class="tm-priority-module__actions">
                        <input class="b3-switch fn__flex-center" type="checkbox" ${titleOpacityEnabled ? 'checked' : ''} data-tm-call="tmTogglePriorityTitleOpacity" aria-label="分值分段显示任务名称颜色和透明度">
                        <button class="tm-btn tm-btn-secondary" data-tm-call="tmAddPriorityTitleOpacityRange">+ 添加</button>
                    </div>
                </div>
                ${titleOpacityRows || '<div style="color: var(--tm-secondary-text);">暂无配置</div>'}
            </div>
        ` : `
            <div style="margin-bottom:14px;">
                <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:10px;flex-wrap:wrap;">
                    <label style="display:flex;align-items:center;gap:8px;font-weight:700;">
                        <input class="b3-switch fn__flex-center" type="checkbox" ${titleOpacityEnabled ? 'checked' : ''} data-tm-call="tmTogglePriorityTitleOpacity">
                        分值分段显示任务名称颜色和透明度
                    </label>
                    <button class="tm-btn tm-btn-secondary" data-tm-call="tmAddPriorityTitleOpacityRange">+ 添加</button>
                </div>
                <div style="font-size:12px;color:var(--tm-secondary-text);margin-bottom:8px;">按优先级分值匹配区间，只改变任务名称颜色和透明度，不影响排序和奖励分值。</div>
                ${titleOpacityRows || '<div style="color: var(--tm-secondary-text);">暂无配置</div>'}
            </div>
        `;"""
reps.append((old_b, new_b, "titleOpacitySection"))

# --- Block C: embedded return ----------------------------------------------
old_c_start = "        if (embedded) {\n            return `\n                <div class=\"tm-priority-settings\" style=\"display:flex;flex-direction:column;gap:12px;\">"
old_c_end = "                </div>\n            `;\n        }\n\n        return `\n            <div class=\"tm-box tm-priority-settings\""
i_start = src.find(old_c_start)
i_end = src.find(old_c_end)
assert i_start != -1, "embedded return start not found"
assert i_end != -1, "embedded return end not found"
i_end += len("                </div>\n            `;\n        }")
old_c = src[i_start:i_end]
assert old_c.count('data-tm-call="tmSwitchSettingsTab"') == 0

new_c = """        if (embedded) {
            return `
                <div class="tm-priority-settings tm-priority-modules">
                    <div class="tm-priority-embedded-title" style="font-weight: 700; font-size: 15px;">⚙️ 优先级算法</div>

                    <div class="tm-priority-module">
                        <div class="tm-priority-module__head">
                            <div class="tm-priority-module__copy">
                                <div class="tm-priority-module__title">基础分</div>
                                <div class="tm-priority-module__desc">用于所有任务的起始分，之后按下面的加减分累加。</div>
                            </div>
                            <div class="tm-priority-module__actions">
                                <input class="b3-text-field tm-priority-number-input tm-priority-number-input--base" type="number" value="${Number(cfg.base) || 100}" data-tm-call="tmSetPriorityBase">
                            </div>
                        </div>
                    </div>

                    <div class="tm-priority-module">
                        <div class="tm-priority-module__head">
                            <div class="tm-priority-module__copy">
                                <div class="tm-priority-module__title">权重（微调）</div>
                                <div class="tm-priority-module__desc">调整重要性、状态、截止日期、时长和文档的相对权重，默认均为 1。</div>
                            </div>
                        </div>
                        <div class="tm-priority-field-grid">${weightRows}</div>
                    </div>

                    <div class="tm-priority-module">
                        <div class="tm-priority-module__head">
                            <div class="tm-priority-module__copy">
                                <div class="tm-priority-module__title">重要性加减分</div>
                                <div class="tm-priority-module__desc">任务上直接标注的重要性对应的加减分。</div>
                            </div>
                        </div>
                        <div class="tm-priority-field-grid">${importanceRows}</div>
                    </div>

                    <div class="tm-priority-module">
                        <div class="tm-priority-module__head">
                            <div class="tm-priority-module__copy">
                                <div class="tm-priority-module__title">状态加减分</div>
                                <div class="tm-priority-module__desc">为每个自定义状态设置加分或减分。</div>
                            </div>
                        </div>
                        <div class="tm-priority-field-grid">${statusRows}</div>
                        ${statuses.length === 0 ? '<div style="color: var(--tm-secondary-text); font-size: 12px;">暂无自定义状态</div>' : ''}
                    </div>

                    ${customFieldSection}

                    <div class="tm-priority-module">
                        <div class="tm-priority-module__head">
                            <div class="tm-priority-module__copy">
                                <div class="tm-priority-module__title">截止日期接近度（按“≤ 天数”匹配）</div>
                                <div class="tm-priority-module__desc">离截止日期越近加分越多，每行可改天数或加分，也可以删除。</div>
                            </div>
                            <div class="tm-priority-module__actions">
                                <button class="tm-btn tm-btn-secondary" data-tm-call="tmAddPriorityDueRange">+ 添加</button>
                            </div>
                        </div>
                        ${dueRows || '<div style="color: var(--tm-secondary-text);">暂无配置</div>'}
                    </div>

                    <div class="tm-priority-module">
                        <div class="tm-priority-module__head">
                            <div class="tm-priority-module__copy">
                                <div class="tm-priority-module__title">时长分段</div>
                                <div class="tm-priority-module__desc">按预计时长分档加减分，单位可选分钟或小时（支持小数）。</div>
                            </div>
                            <div class="tm-priority-module__actions">
                                <select class="b3-select tm-priority-select" data-tm-call="tmSetPriorityDurationUnit">
                                    <option value="minutes" ${durationUnit === 'minutes' ? 'selected' : ''}>分钟</option>
                                    <option value="hours" ${durationUnit === 'hours' ? 'selected' : ''}>小时（可小数）</option>
                                </select>
                                <button class="tm-btn tm-btn-secondary" data-tm-call="tmAddPriorityDurationBucket">+ 添加</button>
                            </div>
                        </div>
                        ${durRows || '<div style="color: var(--tm-secondary-text);">暂无配置</div>'}
                    </div>

                    ${titleOpacitySection}

                    <div class="tm-priority-module">
                        <div class="tm-priority-module__head">
                            <div class="tm-priority-module__copy">
                                <div class="tm-priority-module__title">文档加减分</div>
                                <div class="tm-priority-module__desc">对单个文档统一加分或减分。</div>
                            </div>
                            <div class="tm-priority-module__actions">
                                <button class="tm-btn tm-btn-secondary" data-tm-call="tmAddPriorityDocDelta">+ 添加</button>
                            </div>
                        </div>
                        ${docRows || '<div style="color: var(--tm-secondary-text);">暂无配置</div>'}
                    </div>

                    <div class="tm-priority-module">
                        <div class="tm-priority-module__head">
                            <div class="tm-priority-module__copy">
                                <div class="tm-priority-module__title">文档分组加减分</div>
                                <div class="tm-priority-module__desc">给整个文档分组内的文档统一加减分，支持笔记本分组和包含子文档的分组。</div>
                            </div>
                            <div class="tm-priority-module__actions">
                                <button class="tm-btn tm-btn-secondary" data-tm-call="tmAddPriorityGroupDelta">+ 添加</button>
                            </div>
                        </div>
                        ${groupRows || '<div style="color: var(--tm-secondary-text);">暂无配置</div>'}
                    </div>
                </div>
            `;
        }"""
reps.append((old_c, new_c, "embedded-return"))

for old, new, name in reps:
    count = src.count(old)
    assert count == 1, f"{name}: expected 1 occurrence, got {count}"
    src = src.replace(old, new)

# Handler preservation check: every data-tm-call name in old block C must still exist.
old_calls = sorted(set(re.findall(r'data-tm-call="([^"]+)"', old_c)))
new_calls = set(re.findall(r'data-tm-call="([^"]+)"', new_c + new_a + new_b))
missing = [c for c in old_calls if c not in new_calls]
assert not missing, f"lost handlers: {missing}"

with io.open(PATH, "w", encoding="utf-8", newline="") as f:
    f.write(src.replace("\n", "\r\n"))

print("priority module restructure applied OK")
