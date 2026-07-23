---
name: task-planning
description: 根据 Task Horizon 任务、现有日程和安排规则生成无冲突计划。用户要求每日计划、晚间安排、逾期重排、工作量平衡、时间块或修改时间地图时使用。
---

# 任务计划

调用任务工具时使用思源提供的完整名称，前缀为 `plugin__siyuan_plugin_task_horizon__`。

1. 用结构化条件读取目标任务，再把返回任务中去重后的 `documentID` 作为 `documentIDs` 传给 `get_task_policy`，读取当前安排规则及各文档的最终有效规则。对于 `duration` 为空的任务，同时把 `taskID`、`title`、`documentID` 放入 `durationCandidates`，使用返回的 `durationEstimates` 作为确定性默认时长。规划至少读取 `priority`、`priorityScore`、`customStatus`、`startDate`、`completionTime`、`duration`、`tomatoEstimateCount` 和 `customFieldValues`；需要备注或附件时再投影 `remark`、`attachments`。
   面向用户输出时使用 `priorityName` 和 `customStatusName`；调用筛选或写入工具时再使用 `priority`、`customStatus` 的稳定 ID，并从返回的 definitions 获取映射。
   先调用 `get_task_view_context`，默认不传 `scope`：当前活动页签是任务管理器时使用其当前视图，是思源笔记时使用该文档的完整任务范围。默认把 `scopeToken` 传给 `query_tasks.filters.scopeToken`；用户要求当前界面以外的时间、完成状态、优先级或状态范围时改用 `containerScopeToken`，并使用 `done`、`dateRange`、`overdue`、`priorities`、`customStatuses`、`includeVirtual` 等结构化筛选，通过游标按需分页。只有用户明确指定不同容器时才用 `scope: "current_view"` 或 `scope: "focused_document"` 覆盖自动识别；后者可同时传 `documentID`。
   `virtualTask: true` 表示循环任务的只读完成记录。虚拟任务本体不能更新、移动、删除或配置任务提醒，但可以把某次记录关联到日程：使用它的 `repeatinst:` ID 作为 `taskId`，并在 `create_schedule`、重新关联它的 `update_schedule`，以及 `batch_schedules` / `apply_task_operation_plan` 中对应的日程操作内传入本轮 `scopeToken`。只有修改来源任务本身时才使用 `sourceTaskID` 重新读取真实任务。
2. 查询目标日期范围的日程，把固定占用和已有日程视为不可用时间。
3. 按“本次要求 > 任务已有预估时长 > `durationEstimates` > 时长缺失”决定排程块长度；默认时长只用于日程的开始、结束和 `plannedMinutes`，不得写回任务 `duration`。预览中把规则结果标为“60 分钟（写作规则）”，把兜底结果标为“25 分钟（默认）”。再按“本次要求 > 文档规则 > 文档分组规则 > 全局规则 > 内置默认”应用其他规则。每个任务必须按自身 `documentID` 只使用 `effectiveByDocument[documentID].config`；禁止直接遍历或套用顶层 `groupOverrides`，因为其中包含其他文档分组的规则。`documentGroups` 表示文档实际所属分组，`appliedGroupRuleID` 表示本次真正参与合并的分组规则。把有效配置中非空的 `customInstructions` 作为当前文档的补充安排要求；它不能覆盖用户本次对话中的明确要求。文档同时属于多个分组时，使用设置顺序中首个配置了安排规则的匹配分组。只有 `durationEstimates.source` 为 `missing` 时才说明时长缺失，不把预估、计划和番茄实际时长混为一谈。
4. 生成任务、开始时间、结束时间、日历和冲突处理结果的紧凑预览。
5. 任务字段使用 `batch_tasks`，日程使用 `batch_schedules`，跨任务与日程的非删除操作使用 `apply_task_operation_plan`。
6. 返回逐项回执和可用的单步撤销；删除必须改用专用删除工具并单独确认。

任务排期同时包含提醒或定时要求时，如果用户没有明确类型，写入前必须调用思源 `question` 工具进行“提醒意图选择”，单选项固定为 `AI 定时任务`、`跟随任务提醒`、`独立提醒`，并关闭自定义回答。选择 `AI 定时任务` 时调用 `manage_agent_schedules`；另外两项调用 `configure_task_reminder`。跟随任务提醒直接从用户要求解析 `follow.date`（YYYY-MM-DD）与 `follow.times`。用户说“今天/今晚”时日期唯一确定为当日，只有说“明天/明晚”时才使用次日；禁止调用 `question` 询问截止日期，禁止生成“今天/明天”或其他日期候选。执行时工具会同时写入任务截止日期，日期偏移固定为 0，并默认同步完成任务。即使当前没有截止日期，也禁止询问是否设置截止日期、是否改为独立提醒、开始日期、日期偏移或是否同步完成。固定日期或独立重复选择 `independent`。没有由上下文明确绑定真实任务块时，先从用户要求提炼任务核心词，用 `query_tasks` 的 `filters.keyword` 检索全部任务；这次查重的 `filters` 不传 `scopeToken`、`ids` 或 `documentIDs`。优先使用未完成且标题完全一致或语义明确对应的任务，有多个合理候选时用思源 `question` 选择。找到后把已有 `taskID` 传给 `configure_task_reminder`。只有没有合理候选时才省略 `taskID`，传入 `taskTitle` 和插件默认新建位置 `documentID`，且不要先调用 `create_task`；工具还会按可见标题在全部任务中先精确、再模糊查重，允许少量错字并优先绑定未完成项，只有两种匹配都找不到时才创建任务并立即设置提醒。使用 `action=apply` 单次直接写入，不要预览、索要 `previewToken` 或追加确认。

## 安排规则

- `durationDefaults`：全局默认时长规则；`enabled` 控制 AI 使用，`syncToManualDrag` 只控制手动拖拽，关键词规则按数组顺序首个命中。
- `weeklyAvailability`：每周可安排时段，也就是时间地图。
- `fixedOccupancy`：固定会议、通勤等不可占用时段。
- `deadlinePriority`：有截止时间时的优先级规则。
- `defaultCalendarID`：默认写入的日历。
- `customInstructions`：用户为当前规则作用域填写的补充安排或处理要求。
- `documentOverrides`：特定文档覆盖文档分组和全局规则。
- `groupOverrides`：文档分组内任务使用的规则；文档规则优先于分组规则。

用户说“把周四晚上设为固定会议”或“以后工作任务默认排到工作日”时，读取当前 revision，调用 `preview_task_policy_patch` 展示字段差异，确认后再调用 `apply_task_policy_patch`。一次性要求不要自动保存为规则。

更新日程时保留提醒、循环和未知扩展字段，不把删除混入组合操作。
