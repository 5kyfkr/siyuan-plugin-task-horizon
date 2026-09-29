# -*- coding: utf-8 -*-
"""把 chip 勾选类设置处理器从整窗 showSettings() 改为轻量刷新（计数/选中态/预览）。

- 60-settings-screen.js: 新增 state.__tmSettingsChipLightRefresh（showSettings 闭包内定义）。
- 70-doc-group-and-settings-actions.js: 8 个字段勾选处理器替换整窗重渲染。
"""
import io
import sys

ROOT = r'D:\AI\trae\siyuan-plugin-task-horizon'
SCREEN = ROOT + r'\src\task-horizon\main\settings\60-settings-screen.js'
ACTIONS = ROOT + r'\src\task-horizon\main\settings\70-doc-group-and-settings-actions.js'

LIGHT_CALL = "if (state.settingsModal) { try { state.__tmSettingsChipLightRefresh?.(); } catch (e) {} }"


def read(path):
    with io.open(path, 'r', encoding='utf-8', newline='') as f:
        return f.read().replace('\r\n', '\n').replace('\r', '\n')


def write(path, text):
    with io.open(path, 'w', encoding='utf-8', newline='') as f:
        f.write(text.replace('\n', '\r\n'))


def rep(text, old, new, label):
    count = text.count(old)
    assert count == 1, f'{label}: expected 1 occurrence, got {count}'
    return text.replace(old, new, 1)


# ---------- 60-settings-screen.js ----------
screen = read(SCREEN)

anchor = """        const __tmBindSettingsFieldPreviewRefresh = (modal) => {
            if (!modal || modal.__tmFieldPreviewRefreshBound) return;
            modal.__tmFieldPreviewRefreshBound = true;
            modal.addEventListener('change', () => {
                setTimeout(() => { try { __tmRefreshSettingsFieldPreviews(modal); } catch (e) {} }, 0);
            });
        };
"""
insert = anchor + """        // 轻量刷新：chip 勾选类设置不改动设置页结构，跳过整窗重渲染，只同步选中态、计数与字段预览。
        state.__tmSettingsChipLightRefresh = () => {
            const modal = state.settingsModal;
            if (!(modal instanceof HTMLElement) || !document.body.contains(modal)) return;
            modal.querySelectorAll('.tm-settings-chip-group').forEach((section) => {
                const inputs = Array.from(section.querySelectorAll('.tm-settings-chip__input'));
                if (!inputs.length) return;
                inputs.forEach((input) => {
                    const chip = input.closest('.tm-settings-chip');
                    if (chip) chip.classList.toggle('is-selected', !!input.checked);
                });
                const countEl = section.querySelector('.tm-settings-chip-group-count');
                if (countEl) countEl.textContent = `已选 ${inputs.filter((input) => input.checked).length}/${inputs.length}`;
            });
            try { __tmRefreshSettingsFieldPreviews(modal); } catch (e) {}
        };
"""
screen = rep(screen, anchor, insert, 'insert light refresh helper')
write(SCREEN, screen)

# ---------- 70-doc-group-and-settings-actions.js ----------
actions = read(ACTIONS)

OLD_TAIL = "if (state.settingsModal) showSettings();"

pairs = [
    (
        """        if (scopeKey === 'dock') {
            __tmDispatchDockSettingsChanged('dock-checklist-compact-meta-fields');
        }
        """ + OLD_TAIL,
        'compact-meta-fields',
    ),
    (
        """        SettingsStore.data.timelineCardFields = __tmNormalizeTimelineCardFields(Array.from(current), []);
        await SettingsStore.save();
        """ + OLD_TAIL,
        'timeline-card-fields',
    ),
    (
        """        SettingsStore.data.quickbarInlineFields = next;
        await SettingsStore.save();
        try { globalThis.__taskHorizonQuickbarRefreshInline?.(); } catch (e) {}
        """ + OLD_TAIL,
        'quickbar-inline-fields',
    ),
    (
        """        SettingsStore.data.quickbarVisibleItems = __tmSetQuickbarSettingItemEnabled(prev, key, !!enabled, allow, defaults, key === 'taskCompleteAt' ? 'custom-completion-time' : '');
        await SettingsStore.save();
        try { globalThis.__taskHorizonQuickbarRefresh?.(); } catch (e) {}
        """ + OLD_TAIL,
        'quickbar-visible-items',
    ),
    (
        """        SettingsStore.data[viewKey] = __tmNormalizeTaskCardFieldList(Array.from(current), ['priority', 'status', 'date']);
        await SettingsStore.save();
        """ + OLD_TAIL,
        'task-card-fields',
    ),
    (
        """        SettingsStore.data.taskCardDateOnlyWithValue = !SettingsStore.data.taskCardAlwaysShowFields.includes('date');
        await SettingsStore.save();
        """ + OLD_TAIL,
        'task-card-always-show',
    ),
    (
        """        SettingsStore.data.subtaskInheritedFields = __tmNormalizeSubtaskInheritedFields(Array.from(current), []);
        await SettingsStore.save();
        """ + OLD_TAIL,
        'subtask-inherited-fields',
    ),
    (
        """                void resolveDocIdsFromGroups({
                    groupId: gid,
                    includeQuickAddDoc: false,
                    skipPersistedScope: true,
                    forceRefreshScope: true,
                });
            } catch (e) {}
        }
        """ + OLD_TAIL,
        'points-reward-excluded-group',
    ),
]

for old, label in pairs:
    new = old.replace(OLD_TAIL, LIGHT_CALL)
    actions = rep(actions, old, new, label)

write(ACTIONS, actions)
print('OK: light refresh applied to 8 chip handlers')
