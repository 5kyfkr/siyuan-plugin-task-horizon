# 移动后刷新复核与诊断清理

手机 Harmony App 的修复后记录覆盖两次移动：0 次整板替换、0 次局部刷新拒绝、0 次原生复选框同步引发的视图刷新。原有持续闪烁链路已消失。记录另有 4 次无关文档列的渐进替换，因此补查了折叠分组的加载窗口，以及其他视图的刷新兜底。

## 本轮修复

- 看板折叠时间分组中的卡片仍占渐进渲染名额。此前恢复窗口按可见节点计数，遗漏折叠分组的已挂载卡片，后续补载会把 35 张已加载卡片缩成 10 张并整列替换。现在保留分组中的已加载窗口；折叠父任务的隐藏子任务仍按原规则排除。局部刷新、整板刷新与视图切换共用相同的计数规则。
- 清单普通分组与紧凑卡片布局在任务不属于当前视图、且新旧列表完全一致时，直接保留现有节点并清除待刷新标记。生成结果确实变化时仍进入原有协调/结构兜底，不吞掉更新。
- 删除临时日志模块、所有调用点、监听器、定时器、清单项以及诊断专用测试和说明。保留原生同步去重、标题进度原位更新及隐藏完成任务不触发整板重绘的修复。
- 删除工作空间 petal 下 2 份诊断日志和本地 1 份日志副本；不添加启动清理或自动删除逻辑。

## 检查范围与验证

看板列刷新覆盖移动、缩进/移出子任务、完成可见性、滚动位置、折叠分组、渐进加载与视图切换。清单覆盖普通/紧凑分组、相同结果、任务隐藏、移动、删除和完成行。表格、时间轴及白板继续按键复用未变节点；日历任务变更、完成刷新和番茄焦点隔离检查未发现需要额外修改的同类问题。

主要入口：

- `node scripts/kanban-column-refresh-browser.test.js`
- `node scripts/kanban-appearance-browser.test.js`
- `node scripts/checklist-refresh-scope-browser.test.js`
- `node scripts/checklist-style-integration-browser.test.js`
- `node scripts/view-scoped-refresh-browser.test.js`
- `node scripts/checklist-completion-row-behavior.test.js`
- `node scripts/task-completion-consistency.test.js`
- `node scripts/task-auto-refresh-coalescing-behavior.test.js`
- `node scripts/calendar-task-mutation-refresh-isolation-contract.test.js`
- `node scripts/calendar-completion-refresh-regression.test.js`
- `node scripts/task-refresh-logging.test.js`

浏览器测试在隔离数据下运行，不替代手机真实数据验收。本轮后两处修复需安装无日志版本后复测；未操作用户的实际任务。
