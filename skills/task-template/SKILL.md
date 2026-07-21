---
name: task-template
description: 为出差、晚间安排、周计划、发布流程或其他重复场景生成可调整的 Task Horizon 任务与日程。用户要求应用、修改或创建参数化任务模板时使用。
---

# 场景模板

调用任务工具时使用思源提供的完整名称，前缀为 `plugin__siyuan_plugin_task_horizon__`。

1. 确认场景目标和本次会变化的参数，例如日期、目的地、精力、交通方式、目标文档或外部天气信息。
   先调用 `get_task_view_context`，默认不传 `scope`：当前活动页签是任务管理器时使用其当前视图，是思源笔记时使用该文档的完整任务范围。默认使用 `scopeToken`；用户要求当前界面以外的时间、完成状态、优先级或状态范围时改用 `containerScopeToken`，并使用 `done`、`dateRange`、`overdue`、`priorities`、`customStatuses`、`includeVirtual` 等结构化筛选，不把完整 ID 列表放进对话。只有用户明确指定不同容器时才用 `scope: "current_view"` 或 `scope: "focused_document"` 覆盖自动识别；后者可同时传 `documentID`。
   范围中的 `virtualTask: true` 是只读循环记录：虚拟任务本体不能更新、移动、删除或配置任务提醒，但可以成为日程的关联目标。为某次记录排期时使用它的 `repeatinst:` ID 作为 `taskId`，并在 `create_schedule`、重新关联它的 `update_schedule`，以及 `batch_schedules` / `apply_task_operation_plan` 中对应的日程操作内传入本轮 `scopeToken`；修改来源任务时才改用 `sourceTaskID`。
2. 读取相关任务策略与现有日程，再决定分类和时间；缺少外部数据时标记假设，不编造事实。
   模板预览使用 `customStatusName`、`priorityName` 展示中文名称；保存操作仍使用 definitions 中对应的状态和重要性 ID。
3. 生成任务与日程预览，区分必选、可选和假设项。
4. 最多使用 `apply_task_operation_plan` 应用 50 个非删除操作。需要替换或删除时改用专用删除工具和预览令牌。
5. 返回逐项回执，只为失败项生成新的重试预览。

模板包含“提醒”或“定时”且用户没有明确类型时，写入前必须调用思源 `question` 工具进行“提醒意图选择”，单选项固定为 `AI 定时任务`、`跟随任务提醒`、`独立提醒`，并关闭自定义回答。选择 `AI 定时任务` 时调用 `manage_agent_schedules`；选择另外两项时用 `action=apply` 单次调用 `configure_task_reminder` 直接写入，不要预览或索要 `previewToken`。没有由上下文明确绑定真实任务块时，先从模板结果提炼任务核心词，用 `query_tasks` 的 `filters.keyword` 检索全部任务；这次查重的 `filters` 不传 `scopeToken`、`ids` 或 `documentIDs`。优先使用未完成且标题完全一致或语义明确对应的任务，有多个合理候选时用思源 `question` 选择。找到后把已有 `taskID` 传给 `configure_task_reminder`。只有没有合理候选时才省略 `taskID`，传入 `taskTitle` 和插件默认新建位置 `documentID`，且不要先调用 `create_task`；工具还会按可见标题在全部任务中先精确、再模糊查重，允许少量错字并优先绑定未完成项，只有两种匹配都找不到时才创建任务并立即设置提醒。提醒类型选择后不要再询问位置或写入确认。不要通过前端 Action 或普通文本选项代替这个选择流程。

## 配置方式

- 日期、地点、精力等变化值由本次指令传入，不持久化到 Skill。
- 时间地图、固定占用、分类、自定义要求、默认日历、文档规则和文档分组规则保存在任务策略中，由 `task-planning` 的策略流程调整。
- 个人长期模板应复制为新的 Skill 后修改，例如 `my-trip-template`；不要直接堆叠多个只差日期的内置 Skill。
- 用户明确说“以后都按这个模板”时，先总结稳定步骤与参数，再征得确认后保存或修改个人 Skill。

内置 Skill 被用户修改后不得自动覆盖；空白或损坏文件除外。
