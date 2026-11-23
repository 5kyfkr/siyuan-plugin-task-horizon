# 拖延分升级接入方案（精简版）

2026-11-23。对应原型 `docs/project-health-homepage-integration-prototype.html`。原型只定信息和交互，接入时以插件现有组件、样式变量和响应式机制为准，不照搬原型的 DOM、配色和断点。

## 1. 结论

- 不新增首页模块，不新增独立评分。只升级现有拖延分 `__tmGetProcrastinationMetricsForTasks`，结果接到页签、项目进度、完成摘要、完成趋势、风险提醒五处。
- 算法只在 kernel 实现一份，页签与首页共用；首页只展示，不再自带等级判断。
- 拖延程度只用现有红色深浅（`buildProcrastinationRowStyle` / `__tmBuildDocProcrastinationStyle`），不引入四色。
- 处理任务复用现有任务右键菜单，不新造按钮组；模块之间不做联动跳转。
- 设置只加两项；常数集中在一个配置对象里。
- 分两期，每期独立可发布。

## 2. 现有可复用的部分

| 能力 | 现有实现 |
|---|---|
| 拖延分计算、等级 | `20-api-and-runtime-services.js` `__tmGetProcrastinationMetricsForTasks`、`__tmGetProcrastinationLevel` |
| 改期账本 | `__tmRecordProcrastinationRescheduleEntry`、`__tmCountRecentProcrastinationReschedules`（已逾期截止日改到未来记一次，按天去重） |
| 页签底色与提示 | `__tmBuildDocProcrastinationStyle`、`__tmFormatProcrastinationTip` + `__tmBuildTooltipAttrs`（`40-render-runtime.js:905`） |
| 首页拖延分行 | `homepage.js` `renderSummaryCard`、`.tm-homepage-summary-row.is-procrastination` |
| 首页响应式 | `resolveProfile` → `tm-homepage--desktop / dock / mobile`（<760 为 mobile） |
| 分段切换 | `tm-homepage-range-switch` / `tm-homepage-range-btn.is-active` |
| 任务列表 | `renderTaskList`（整行 `<button>`，点击走 `onOpenTask`） |
| 任务右键菜单 | `tmShowTaskContextMenu`（今天 / 明天 / 下周 / 选择日期 / 状态等） |
| 长按 | 项目卡片已有长按菜单与 `@media (pointer: coarse)` 44px 规则 |
| 创建时间 | 任务对象带 `blocks.created`（`yyyyMMddHHmmss`） |

## 3. 算法（kernel）

### 3.1 单任务拖延天（实际天数，不加倍）
- 有截止日期且已逾期：逾期天数。
- 无截止日期：`存在天数 − 起始保护`，大于 0 才算；起始保护设为“不计入”时为 0。
- 开始日期在未来、循环任务、已取消、父任务已完成：不计（沿用现有过滤）。

抽成一个辅助函数 `__tmGetTaskDelayDays(task, todayKey, opts)`，返回 `{ days, overdue } | null`。

### 3.2 分数
```js
const PROCRASTINATION_CONFIG = {
    weights: { age: 40, over: 25, resched: 15, flow: 20, penalty: 20 },
    ageHalfDays: 15,    // 平均拖延 15 天 ≈ 该项 63%
    reschedCap: 5,      // 改期次数 ÷ max(5, 未完成数 / 4)
    styleDragLine: 0.4, // 做事风格上下分界（首页用）
};
```
- 拖得多久：`1 − e^(−所有未完成任务平均拖延天 / 15)`
- 逾期占比：沿用现有 `overdueCount / dueTaskCount`
- 反复改期：`改期次数 / max(5, 未完成数 / 4)`，封顶 1
- 完成跟不上：`1 − 窗口内完成 / 窗口内新建`，限制在 0–1；窗口内无新建也无完成且有未完成时记 1
- 积分扣分：沿用现有，仅开启积分扣分联动时计入
- 加权平均后 ×100；等级分界不变（≥75 严重、≥50 高风险、≥25 关注）

### 3.3 返回结构
保留现有全部字段，只新增 4 个：

```
draggingCount     拖着的任务数
avgDelayDays      拖着的任务平均天数（展示用）
createdInWindow   窗口内新建数
doneInWindow      窗口内完成数
```

构成明细（四项各得几分）和“拖得最久”列表不进返回值，由需要的地方按需计算：页签提示取 1 项，风险提醒取 6 项，都用同一个 `__tmGetTaskDelayDays`；构成明细由首页用返回字段和 `PROCRASTINATION_CONFIG` 复算。

### 3.4 其他
- 完成数：kernel 用现有完成时间字段统计窗口内完成数；首页完成趋势继续用 `resolveTaskDoneMetricKey`。两者不在同一处并排展示，不强制统一口径。
- 不加缓存。页签按文档调用时为一次遍历，等出现性能问题再加。
- 首页 `getProcrastinationLevel` 删除，改用 kernel 返回的 `levelLabel`。

## 4. 界面

### 4.1 文档页签
- 底色与开关不变，只换分数来源。
- 提示文案（多行纯文本，仍用 `__tmBuildTooltipAttrs`）：
  `拖延分 52 · 高风险` / `10 项拖着，逾期 7 项` / `近 14 天新增 15、完成 4` / `拖得最久：定橱柜 #4（逾期 42 天）`

### 4.2 项目进度
- `renderProjectStatsHtml` 统计行末尾加一项 `52 拖延`，写法同现有 `<span class="n">`，数字颜色用同一套红色 mix；分数为 0 不显示。
- 构成明细放在该项的 `title`。
- 只给文档卡片显示；二级标题卡片不显示。
- 不加排序切换，不加菜单跳转。

### 4.3 完成摘要
- 今日完成：主数字不变，`summary-main-note` 补“今天计划 N 项”。
- 连续完成：不变。
- 拖延分行：样式不变，note 改为“47 项拖着 · 平均 35 天”，构成明细放 `title`。
- 新增“做事风格”格子，与摘要行同边框、底色：标题 + 当前格名称、2×2 四象限、一句描述。大点为当前范围，小点为各文档（停滞文档不上图，在描述下列名）。坐标：横轴 `完成 / 新建`（中线 1），纵轴“拖得多久”分项（中线 0.4），点限制在格子名之外。
- 版式：hero 区由等宽两栏改为任务状态 : 完成摘要 ≈ 2 : 3；摘要内部为“今日完成 | 做事风格 | 摘要行”。
- mobile：沿用现有规则（今日完成占满一行），做事风格与摘要行两列；dock：摘要行在下。

### 4.4 完成趋势
- 固定叠加“新增”虚线（按 `created` 统计每日新建），跟随现有 7 / 30 / 90 天切换；图例加“新增”，不做开关、不持久化。
- 窄宽沿用现有 `is-narrow` 与 `bindTrendResizeObserver`。

### 4.5 风险提醒
- 头部加 `tm-homepage-range-switch`：`逾期 / 临期 N` | `拖延 N`，默认停在逾期 / 临期；切换状态只存运行时，不持久化。
- 「拖延」页沿用 `renderTaskList` 行样式，徽标写原因（“逾期 42 天” / “放了 99 天”），按拖延天降序，最多 6 项，底部一行提示“右键或长按可改日期、完成或放弃”。
- 点击行：`onOpenTask`；右键 / 长按：首页 ctx 新增 `onTaskContextMenu(event, taskId)`，转发到 `tmShowTaskContextMenu`。长按复用项目卡片现有处理。
- 两页都支持右键，逾期 / 临期页也顺带获得这个能力。

### 4.6 窄屏
全部挂在现有 `tm-homepage--dock` / `tm-homepage--mobile` 下，与现有 mobile 摘要规则写在一起；不使用容器查询。

## 5. 设置

- 新增“设置 › 规则 › 拖延分”子页（`68-settings-v2.js` `algo`，排在优先级评分之后），两项：
  - 统计窗口：7 / 14 / 30 天，默认 14（现有 `__TM_PROCRASTINATION_WINDOW_DAYS` 改为读设置）
  - 没有截止日期的任务：创建 3 天 / 1 周 / 2 周 / 1 个月后开始算拖延，或不计入；默认 1 周
- 子页底部两行只读说明，各带一个跳转：积分扣分跟随“日历 › 专注与联动”；页签拖延底色开关在“视图 › 启动与入口”（开关不搬家）。
- 底部附一段算法说明。
- 两个新字段按 settings v2 惯例接入默认值、本地存储、云同步、导入导出。

## 6. 分期与改动量

| 期 | 内容 | 文件 |
|---|---|---|
| 一 | kernel 新算法与 4 个字段、`__tmGetTaskDelayDays`、`PROCRASTINATION_CONFIG`；页签提示新文案；摘要拖延分行 note；删除首页重复等级函数；设置子页 | `20-api-and-runtime-services.js`、`10-stores-rules-and-cache.js`、`60-settings-screen.js`、`68-settings-v2.js`、`homepage.js`（摘要行）、`i18n` |
| 二 | 完成摘要做事风格与 hero 比例；完成趋势新增曲线；风险提醒拖延页与 `onTaskContextMenu`；项目卡片拖延分 | `homepage.js`、`20-api-and-runtime-services.js`（ctx） |

估计：kernel 改 1 个函数，加 1 个辅助函数和 1 个配置对象；首页改 4 处渲染、删 1 个函数；设置加 1 个子页 2 个字段；首页 ctx 加 1 个回调。

第一期发布后分数整体会变（新增“拖得多久”“完成跟不上”两项），更新日志需说明。

## 7. 已知限制（不处理）

- 创建时间取 `blocks.created`。任务跨文档复制、移动后 `created` 会变成操作时间，滴答导入的任务也可能是导入时间。不另存创建时间，影响如下：
  - 无截止日期任务的“放了多久”会归零、重新进入起始保护期，拖延偏小，不会误判成拖延。
  - 这些任务会被算进窗口内“新建”：一次整理大量任务后，“完成跟不上”分项和完成趋势的“新增”曲线会短期偏高，过了统计窗口自然恢复。
- 打卡任务、FSRS 复习任务不单独处理，沿用拖延分现有的任务过滤。
