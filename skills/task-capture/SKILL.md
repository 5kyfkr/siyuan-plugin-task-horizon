---
name: task-capture
description: 将思源文档、收集箱、自然语言想法或目标整理为 Task Horizon 任务。用户要求收集任务、拆分下一步、批量建任务、设置提醒、自动分类或从文档提取行动项时使用。
---

# 任务收集

调用任务工具时使用思源提供的完整名称，前缀为 `plugin__siyuan_plugin_task_horizon__`。

1. 读取用户引用的思源块和当前任务范围。已有明确上下文时不要重复询问，也不要无差别读取整篇文档。任务工具省略 `fields` 会返回完整字段；使用投影时按需包含日期、状态、重要性、番茄、备注、附件和 `customFieldValues`。
   先调用 `get_task_view_context`，默认不传 `scope`：当前活动页签是任务管理器时使用其当前视图，是思源笔记时使用该文档的完整任务范围。默认把 `scopeToken` 传给任务查询；用户要求当前界面以外的时间、完成状态、优先级或状态范围时改用 `containerScopeToken`，并使用 `done`、`dateRange`、`overdue`、`priorities`、`customStatuses`、`includeVirtual` 等结构化筛选，不索取或复述完整任务 ID 列表。只有用户明确指定不同容器时才用 `scope: "current_view"` 或 `scope: "focused_document"` 覆盖自动识别；后者可同时传 `documentID`。
2. 只提取可执行的结果和下一步。标题保持简短，背景信息写入 `remark`。
   读取和展示状态、重要性时优先使用 `customStatusName`、`priorityName`；筛选或写入仍使用 `statusDefinitions`、`priorityDefinitions` 中对应的稳定 ID，不向用户展示 `finish`、`risk`、`high` 等内部值。
3. 需要分类时读取 `get_task_policy`，按“本次要求 > 文档规则 > 文档分组规则 > 全局规则 > 内置默认”决定目标位置，并遵守有效规则中非空的 `customInstructions`。目标仍不明确时只问一个关键问题。
   对话可能附带本轮实时的“创建任务位置”，其中包含插件默认新建位置和当前分组的置顶文档。用户明确目标时使用对应 `documentID`；没有明确目标且存在插件默认新建位置时直接使用默认 `documentID`，不要询问位置。只有默认位置不可用时才调用思源 `question` 工具让用户选择固定文档或手动输入其他文档名；手动名称必须先解析真实文档 ID。不要打开独立的前端位置选择界面，也不要把“创建任务”误解为必须拆分多个任务。
   查询结果中 `virtualTask: true` 的循环记录必须保持只读，不能更新、移动、删除或配置任务提醒；但可以把某次记录关联到日程。排期时使用它的 `repeatinst:` ID 作为 `taskId`，并在 `create_schedule`、重新关联它的 `update_schedule`，以及批量或组合操作中的对应日程项内传入本轮 `scopeToken`。修改来源任务本身时才使用 `sourceTaskID` 重新读取真实任务并向用户说明目标。
4. 单个任务不做额外预览或确认，直接使用 `create_task`；多个任务才预览标题、目标位置和字段并使用 `batch_tasks`，让同一意图只确认一次。
6. 返回逐项回执，分开说明成功和失败；只为失败项生成新的重试预览。

## 提醒

- 用户提到“提醒”或“定时”且没有明确类型时，写入前必须调用思源 `question` 工具进行“提醒意图选择”，单选项固定为：`AI 定时任务`、`跟随任务提醒`、`独立提醒`，关闭自定义回答。不要用普通文本列选项，也不要自行猜测。
- 用户选择 `AI 定时任务` 时调用 `manage_agent_schedules`；选择另外两项时调用 `configure_task_reminder`。
- 用户选择跟随任务提醒时使用 `configure_task_reminder` 的 `follow_task` 模式。直接从用户原话解析提醒日期和时间并传入 `follow.date`（YYYY-MM-DD）与 `follow.times`。用户说“今天/今晚”时日期唯一确定为当日，只有说“明天/明晚”时才使用次日；禁止调用 `question` 询问截止日期，禁止生成“今天/明天”或其他日期候选。工具执行时会把该日期同时写入任务截止日期，日期偏移固定为 0，并默认在完成提醒时同步完成任务。即使任务当前没有截止日期，也禁止再询问是否设置截止日期、是否改为独立提醒、开始日期、日期偏移或是否同步完成。
- 用户要求提醒按自己的日期重复且不随任务变化时使用 `independent` 模式；独立提醒始终不修改任务完成状态。
- 跟随任务提醒或独立提醒没有由上下文明确绑定真实任务块时，先从用户原话提炼不含日期、时间和“提醒我”等命令词的任务核心词，用 `query_tasks` 的 `filters.keyword` 检索全部任务。这次查重不要沿用当前视图的 `scopeToken`，`filters` 也不要传 `ids` 或 `documentIDs`。优先使用未完成且标题完全一致的任务，其次使用语义明确对应的未完成任务；有多个合理候选时用思源 `question` 让用户选择目标任务。找到明确匹配后，把已有 `taskID` 传给 `configure_task_reminder`。只有没有合理候选时才省略 `taskID`，传入提炼后的 `taskTitle` 和对话提供的插件默认新建位置 `documentID`，且不要先调用 `create_task`。工具还会按可见标题在全部任务中先精确、再模糊查重，允许少量错字并优先绑定未完成项，只有两种匹配都找不到时才在默认位置创建承载任务并立即设置提醒；提醒类型选择后不要再询问位置或写入确认。
- 使用 `action=apply` 单次调用 `configure_task_reminder` 直接写入；不要先预览，不要索要 `previewToken`，也不要直接写 `custom-tomato-reminder`。

## 可配置项

- 文档规则和文档分组规则保存在任务策略中，不写进 Skill。
- 本次对话中的临时分类或日期要求默认只作用于本次，不自动持久化。

不要传入任意 SQL、任意属性名或完整属性对象。自定义字段只使用已注册字段 ID，不臆造日期、优先级或分类。
