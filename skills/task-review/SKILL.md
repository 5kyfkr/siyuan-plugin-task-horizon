---
name: task-review
description: 复盘 Task Horizon 在日、周、月、年、项目、文档或任务范围内的完成与时间数据。用户要求完成次数、趋势、坚持情况、时间投入、计划与实际对比或生成图表时使用。
---

# 任务复盘

调用任务工具时使用思源提供的完整名称，前缀为 `plugin__siyuan_plugin_task_horizon__`。

1. 确认复盘时间范围和任务范围；当前上下文已经明确时直接复用。
   先调用 `get_task_view_context`，默认不传 `scope`：当前活动页签是任务管理器时使用其当前视图，是思源笔记时使用该文档的完整任务范围。默认把 `scopeToken` 传给聚合工具；需要列出当前界面以外的时间、完成状态、优先级或状态明细时改用 `containerScopeToken` 调用 `query_tasks`，并使用 `done`、`dateRange`、`overdue`、`priorities`、`customStatuses`、`includeVirtual` 等结构化筛选，不要读取完整任务 ID 列表。只有用户明确指定不同容器时才用 `scope: "current_view"` 或 `scope: "focused_document"` 覆盖自动识别；后者可同时传 `documentID`。
2. 调用 `aggregate_task_stats` 获取完成数、趋势和分组。年度或大范围复盘禁止拉取全部原始任务让模型自行计数。
   状态和重要性分组直接使用聚合结果的中文 `key`；其中 `value` 是筛选和写入所需的稳定 ID，不应作为面向用户的名称。
3. 用户询问投入时长时调用 `aggregate_time_usage`，分开呈现预估、日程计划和番茄实际时长，并保留可用性与缺失数据标记。
   只有用户明确要求按某个自定义列分组时，才把对应的已注册字段 ID 放入 `aggregate_task_stats.customFieldIDs`；默认不聚合全部自定义列，以减少结果体积和 token 消耗。
4. 说明最显著的趋势、数据缺口和少量可执行调整，不从相关计数推断因果。
5. 图表只消费聚合 DTO，不重新计算原始任务。

## 可调参数

- 每次可指定日期范围、文档、清单、状态、优先级或已注册自定义字段分组。
- “日报、周报、月报、年报”共用本 Skill，只改变范围和分组，不需要创建新的 Skill。
- 输出格式、重点和图表类型属于本次要求，默认不写入任务策略。

普通任务完成统计使用 `done + taskCompleteAt`，不使用循环任务历史。
当前视图明细可能包含 `virtualTask: true` 的循环完成记录。它们可用于解释单次循环完成情况，但聚合工具明确排除这些记录；不要把明细中的循环记录再次加到聚合总数中。
