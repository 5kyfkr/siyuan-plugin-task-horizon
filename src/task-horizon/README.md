# Task Horizon Source Root

`src/task-horizon/` is the development source root for the main task manager runtime.

- Development mode: [index.js](/abs/path/d:/AI/trae/siyuan-plugin-task-horizon/index.js:1) loads scripts from `manifest.main.json` in order.
- Root [task-horizon.css](/abs/path/d:/AI/trae/siyuan-plugin-task-horizon/task-horizon.css:1) is loaded before the main runtime so bootstrap styles stay outside the concatenated JS payload and survive release packaging.
- Release mode: [build.ps1](/abs/path/d:/AI/trae/siyuan-plugin-task-horizon/build.ps1:1) concatenates those scripts into the root `task.js` inside the temporary packaging directory.
- Root `task.js` remains the published/fallback entry and should not be treated as the long-term source of truth.

## Recurring task lifecycle

- Both `due` and `complete` task rules require a committed completion before advancing. Keep the configured rule and existing next-date calculation unchanged.
- Loading, refreshing, switching groups, or crossing a date boundary must not advance an incomplete occurrence or consume its remaining occurrence count.
- Each completion advances one occurrence. If the next occurrence is already overdue, it remains incomplete until separately completed.
- Native checkbox hold/reset and recovery of a previously committed completion remain supported; resetting the held checkbox must not advance dates again. Calendar date previews remain read-only.

Current active layout:

- `main/00-bootstrap-and-styles.js`
  Responsibility: namespace bootstrap, explicit global-export registry helpers, top-level shared helpers.
- `main/05-siyuan-host-adapter.js`
  Responsibility: official SiYuan host bridge, plugin/app/eventBus/openTab/openMobileFileById access.
- `main/06-siyuan-compat-adapter.js`
  Responsibility: fragile SiYuan DOM and legacy layout fallback encapsulation with soft-degrade behavior.
- `main/07-siyuan-capabilities.js`
  Responsibility: centralized capability detection so shell features can degrade instead of hard-failing.
- `main/10-stores-rules-and-cache.js`
  Responsibility: storage, meta/settings/whiteboard stores, rule engine, cache helpers.
- `main/20-api-and-runtime-services.js`
  Responsibility: API layer, runtime services, data-side shared logic.
- `main/30-dialogs-and-ui-foundation.js`
  Responsibility: dialogs, pickers, UI helper foundation before the main render pipeline.
- `main/31-view-host-policies.js`
  Responsibility: view and interaction policy facade for checklist, calendar sidebar, host-mode-specific title-click behavior, and sheet-mode rules.
- `main/32-runtime-state-and-events.js`
  Responsibility: thin runtime state/event facade for modal liveness, open-token/view-mode reads, task lookup, and safe event bind/unbind helpers.
- `main/render/40-render-list-context-helpers.js`
  Responsibility: shared list/table render context helpers used by split render files and document-loading runtime.
- `main/40-render-runtime.js`
  Responsibility: main render pipeline orchestration, final modal template, core render runtime.
- `main/render/41-render-scene-context.js`
  Responsibility: render scene context builder, render-mode dispatch, dock/toolbar/mobile-sheet HTML assembly used by `render()`.
- `main/render/42-render-list-and-checklist-body.js`
  Responsibility: list body and checklist body HTML builders for the main render scene.
- `main/render/43-render-timeline-kanban-calendar-body.js`
  Responsibility: timeline, kanban, and calendar body HTML builders for the main render scene.
- `main/render/44-render-whiteboard-body.js`
  Responsibility: whiteboard body HTML builder for the main render scene.
- `main/render/45-render-shell-controls-and-resize.js`
  Responsibility: timeline indicator timer, desktop/mobile menu shell controls, popup animation, topbar select, close flow, resize handlers.
- `main/render/46-render-local-task-time-refresh.js`
  Responsibility: cross-view task time field local refresh and optimistic DOM patch helpers.
- `main/render/47-render-side-panels-and-view-switching.js`
  Responsibility: calendar side dock, AI/sidebar mounting, homepage toggles, and view-mode switching runtime.
- `main/render/48-render-calendar-support-runtime.js`
  Responsibility: calendar task cache, fallback task table, calendar query helpers, floating drag helpers, and task date update bridge.
- `main/render/49-render-whiteboard-interactions.js`
  Responsibility: whiteboard viewport interactions, marquee selection, note editor runtime, whiteboard edge rendering, task-link drag/drop, and whiteboard action handlers.
- `main/render/39-render-doc-group-sync-and-refresh.js`
  Responsibility: doc-group dropdown sync, collapsed-session sync, manual refresh session preservation, and refresh-core orchestration helpers.

Task runtime:

- `main/task-runtime/50-task-model-and-repeat-utils.js`
  Responsibility: task time/priority/repeat normalization, task-detail session and refresh primitives.
- `main/task-runtime/51-whiteboard-and-link-runtime.js`
  Responsibility: whiteboard state snapshots, manual-link data helpers, and whiteboard card state helpers.
- `main/task-runtime/52-task-detail-runtime.js`
  Responsibility: task detail HTML, detail binding, visible detail refresh, kanban detail panel behavior.
- `main/task-runtime/53-list-render-and-document-loader.js`
  Responsibility: list rendering, selected-document loading, settings section anchor helpers.
- `main/task-runtime/54-recurring-task-runtime.js`
  Responsibility: recurring task apply/delete/advance flow, repeat-history maintenance, and recurring-task load reconciliation.

Settings runtime:

- `main/settings/60-settings-screen.js`
  Responsibility: settings modal rendering and top-level settings UI shell.
- `main/settings/61-settings-appearance-and-import.js`
  Responsibility: device recognition helpers, appearance controls, TickTick/theme import flows.
- `main/settings/62-settings-columns-and-rules.js`
  Responsibility: column controls, rules, custom fields, group management helpers before summary/export.
- `main/settings/63-summary-runtime.js`
  Responsibility: summary modal data collection and markdown preview generation.
- `main/settings/64-export-runtime.js`
  Responsibility: export runtime, Excel helpers, export dialog/output generation.
- `main/settings/70-doc-group-and-settings-actions.js`
  Responsibility: doc-group actions and general settings mutation handlers.
- `main/settings/71-ai-settings-and-save.js`
  Responsibility: AI settings mutation handlers and save entry points.

Shell and integrations:

- `main/shell/72-shell-entrances-and-native-doc-hooks.js`
  Responsibility: shell entrances, breadcrumb/topbar hooks, native doc checkbox sync.
- `main/shell/80-shell-lifecycle.js`
  Responsibility: init, openManager, cleanup, shell lifecycle orchestration.
- `main/shell/81-ai-bridge-runtime.js`
  Responsibility: AI bridge helpers and AI-facing task/document operations.
- `main/shell/82-gantt-runtime.js`
  Responsibility: gantt/timeline runtime and final boot-time appendices.

Migration note:

- `legacy-task.js` is kept as a snapshot baseline from phase 1.
- `manifest.main.json` is the only active source order contract for development and release builds.
- Runtime code that touches SiYuan host/runtime boundaries should prefer `__tmHost`, `__tmCompat`, and `__tmCaps` before reaching for raw `window.siyuan` or internal DOM selectors.
- Runtime code that needs host context such as `dock/tab` mode, host mobile UI, navigation `app/topWin/topDoc`, or mobile close-after-open behavior should prefer `__tmRuntimeHost`.
- Host policy branches such as `desktop dock`, `desktop tab`, `scoped mobile host`, and `mobile interaction UI` should be derived from `__tmRuntimeHost` helpers instead of repeating raw boolean combinations.
- View and interaction rules such as checklist title-click behavior, calendar sidebar checklist handling, compact checklist field selection, and checklist sheet-mode selection should prefer `__tmViewPolicy`.
- High-frequency runtime reads such as `modal` liveness, `openToken`, `viewMode`, and `flatTasks/pendingInsertedTasks` lookups should prefer `__tmRuntimeState`.
- Safe DOM/event-bus binding and unbinding should prefer `__tmRuntimeEvents` where the same listener lifecycle is repeated.

Task data boundary:

- Local task projections must read/write through `globalThis.__tmTaskStore`; new code should not directly write `state.flatTasks`, `state.pendingInsertedTasks`, or `state.pendingDeletedTasks`.
- Backend task writes must go through `globalThis.__tmTaskMutations` / `__tmRequireTaskMutation('patchTask')` and related mutation entries; UI code should not persist task fields by bypassing the queue.
- Task snapshots must be scheduled through `globalThis.__tmTaskSnapshotService`; ordinary UI code should not call the lower-level snapshot store directly.

New feature rule:

- 本地任务镜像走 `globalThis.__tmTaskStore`。
- 后端任务写入走 `globalThis.__tmTaskMutations`。
- 快照加载、恢复和保存走 `globalThis.__tmTaskSnapshotService`。

Derived cache persistence:

- 思源块数据仍是真实来源；保留任务写入队列、写后校验和 SQL 刷新屏障。快照和任务索引只用于读取加速。
- 启动读取现有 v4 快照时，校验版本、期限、文档池引用及容量，不展开或重新压缩所有范围；只在恢复指定范围时克隆并展开任务，随后沿用文档加载器的静默校验。
- 缺失、过期、不兼容或引用不完整的范围走正常数据加载，再由现有快照服务延迟保存；保留分组快照原有的保留规则，不按每次启动全量重建。
- 文档范围、任务索引、快照分别保留现有文件格式，共用 `__tmWithDerivedCacheWriteLock` 的每文件串行机制；不新增另一套 TaskStore。锁内重读磁盘、合并与裁剪、写入成功后发布缓存，延迟压缩也必须重读，不能写回旧文件副本。
- 文档范围更新先进入有容量限制的 pending Map，防抖一次合并所有待写项；保存成功只清除本次写入的原版本，写入期间的新版本继续保留。失败不清除待写项，由后续更新再次触发；没有无限重试定时器。
- 索引定时保存、预热合并和延迟压缩统一经过 `__tmPersistTaskIndexEntries`。索引和快照复用 TaskStore 的 `captureRead/isReadCurrent` 校验异步等待前后的数据版本；缓存失效取消旧代际，过时的结果不能重新发布进内存。
- 文件不存在与读取失败必须区分。思源可能用 HTTP 202 携带 `code: 404` 表示不存在；HTTP 202 其他错误、权限或网络错误不能当空文件写回。派生缓存读取设置 15 秒取消期限，写成功必须同时满足 HTTP 成功和 `code: 0`。
- 只有三个派生缓存允许自动恢复损坏 JSON：先将原文备份至同路径的 `.corrupt.json` 文件，确认成功后清空损坏缓存，再由既有加载器重建。每个缓存只保留一个备份位置；原文件超过该缓存容量上限、备份失败或重置失败时停止恢复。设置、任务属性及其他用户数据不使用此恢复逻辑。
- `putFile` 已在思源内核中创建父目录，不额外发送建目录请求。辅助缓存限制条目数量，过期清扫按时间摊销，不在批量插入时逐条扫描整个缓存。
- 快照容量包含文档池和辅助块，共享池仅计入一次总容量。加载时根据版本、引用和裁剪结果判断压缩，不为此序列化整个原文件和结果各一次；范围缓存容量也按单项累计，避免逐项序列化不断扩大的整个缓存。
- 当前范围只打包一次，直接比较实际持久化记录和其引用的文档/辅助块内容，忽略快照及视图生成时间，不忽略任务字段、文档版本或视图内容。删除手工字段签名及窗口摘要缓存，避免日期颜色等字段遗漏，以及只看池键却漏掉池内容变化。未变更时不构建整库或写文件，变更时只构建一次整库。
- Web Locks 只协调支持该 API 的同源窗口；不支持时仅保证本窗口串行，不提供跨设备或云同步事务。JSON 文件仍整文件读写，idle 调度也不代表后台线程。
- 写请求不使用超时后自动释放锁并重试的方式：超时不代表内核未写入，不能为表面响应速度制造重复写入或乱序覆盖。
- 回归入口：`node scripts/task-doc-scope-persistence-behavior.test.js`、`node scripts/task-index-write-consistency-contract.test.js`、`node scripts/task-snapshot-pool-behavior.test.js`、`node scripts/task-storage-io-cache-behavior.test.js`。

Completion projection and incremental reads:

- 清单普通顶层叶子任务完成后，仍由既有字段控制器更新复选框和字段；投影只移除该行，或在同一分组内移动原节点。先验证其余行、分组、深度与新行模型一致，再修改 DOM；计数和已有时长徽标原位更新，成功后同步 DOM 签名。
- 后续权威文档刷新也保持节点复用：普通分段、无分组清单和紧凑分组卡片共用节点选择与协调函数，未变任务不随整组替换；已经与目标 DOM 相同的受影响行也不重建。更新组头或拖放间隙时，不为此逐一移动所有未变行。
- 父子联动、新增/消失分组、需要补入尚未挂载的行、跨分组移动等结构变化继续走既有协调器，不用局部更新掩盖结构变化。完成投影前保留已加载的渲染窗口，过滤后恢复；滚动锚点记录多个可见行，优先保留未变行，原锚点消失时选择仍在场的邻行。内容高度缩短到不足一屏时仍受浏览器滚动边界约束。
- 文档增量刷新及可定位文档的属性事务传入 `changedDocIds`。同一范围待写文档合并，最多保留 20 个范围、每范围 32 个文档 ID，超过单范围阈值或信息不足退回原有整范围打包。只保留脏 ID，不复制另一份任务树；失败保留待写项，新到达的版本不会被旧保存清除。
- v4 文档池原位合并只打包变更文档一次，并更新所有兼容查询上限的已存在范围引用；不展开各范围的其他任务。保留未变池对象，清除受影响范围的视图/排序派生状态，不续期未重新验证的整个范围。旧文档水位不能覆盖新水位；缺失范围、旧格式或坏引用走既有整范围恢复路径，容量裁剪不能丢掉本次更新范围后仍报告成功。
- 新建任务补偿保存复用同一文档池合并函数和写锁。失败、过期或截断的文档读取不作为完整文档写进快照。快照仍是一个 JSON 文件：减少的是打包、克隆和重复保存，不是按字节局部写文件，也不新增每次启动重建。
- `API.getTasksByDocument/getTasksByDocuments/getTasksByIds/getTaskById` 共用最多 64 项的在途读取表，相同语义的请求合并整个读取及属性补全过程。文档集合、查询上限、所有选项、属性配置及 TaskStore 版本参与识别；轻量与完整读取、强制新读与普通读取保持隔离。
- 在途表不保存结果；结束即释放，超出容量的请求正常执行而不入表。共享消费者取得独立结果；各读取链在补充属性前拥有自己的 SQL 行对象。结果缓存仍只有原来的有界查询缓存，增加读取代际及 TaskStore 校验；删除或其他事务使读取过期时，结果可返回给当前调用方，但不会回填缓存或提交到已变化的状态，旧请求结束不能删除新请求。
- 新增/扩展回归入口：`node scripts/checklist-completion-row-behavior.test.js`、`node scripts/task-snapshot-pool-behavior.test.js`、`node scripts/task-read-coalescing-behavior.test.js`。行为测试不能替代思源内真实数据、长任务和滚动录屏验收。
