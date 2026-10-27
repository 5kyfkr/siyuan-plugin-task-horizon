# 插件公共接口 v1

Task Horizon 提供 `window.TaskHorizon`，不需要安装小驴快门或额外 npm 包。插件对象为冻结的公开门面，返回任务摘要副本，不暴露内部设置和存储对象。

```js
const th = window.TaskHorizon;
if (th?.protocol !== "task-horizon" || th.apiVersion !== 1) return;
if (!await th.whenReady()) return;
const tasks = await th.getTodayTasks();
```

`version` 为插件版本，`apiVersion` 为公共协议版本；`capabilities` 提供能力列表。`isReady()` 检查当前实例与设置是否就绪，`whenReady()` 等待设置加载。未安装时全局对象不存在，卸载后旧引用的方法会以 `UNAVAILABLE` 拒绝。

## 查询任务

- `getTodayTasks()`：当前任务分组中覆盖今天且未完成的任务，最多 10 项。
- `queryTasks({date?, scope?, limit?, includeCompleted?})`：返回 `{tasks, total, partial, truncated}`。
- `date`：省略表示不限日期；`"today"` 或合法的 `YYYY-MM-DD` 使用已有“覆盖今天”日期规则，包括跨日范围和打卡计划。
- `scope`：`"current"`（默认，当前配置的任务分组）或 `"all"`（所有配置的任务来源），均包含配置的收集箱。范围与当前选中的文档页签、搜索、临时筛选相互独立，不扫描未配置的整个工作空间。
- `limit`：1–100，默认 50。`includeCompleted`：默认 false，排除已完成和已放弃；true 包含二者。
- `total` 是读取到的匹配任务数。`truncated` 表示返回数量被 limit 截断或底层读取不完整；`partial` 仅表示底层读取触及现有每文档查询上限，此时 total 是下界。

每个摘要包含 `id`、`blockId`、`title`、`docId`、`status`、`done`、`priority`、`startDate`、`completionTime`、`tags`。`completionTime` 是截止日期；日期查询沿用宿主本地日历。打卡任务的 done 表示所查询日期的打卡情况。

查询不要求先打开主界面；使用现有文档范围解析、读取缓存、元数据和规则引擎。相同并发请求合并，返回值相互独立。

## 修改状态与打开视图

```js
const states = th.getStatusOptions(); // [{id, name, marker}]
await th.setTaskStatus(taskBlockId, "done");
await th.setTaskStatus(taskBlockId, "in_progress");
await th.openView("calendar");
```

`setTaskStatus(blockId, statusId)` 校验状态 ID 并进入现有任务写入队列，等待持久化结果，成功返回 true；失败拒绝 Promise。状态以用户配置的 `getStatusOptions()` 为准。完成／未完成沿用复选框写入，其他状态沿用状态写入。FSRS 完成使用现有“良好”默认评分；Task Horizon 自身的打卡任务沿用当天打卡流程，不派发永久完成事件。

`openView(viewType)` 支持 `list`、`checklist`、`timeline`、`kanban`、`calendar`、`whiteboard`，适配桌面标签页和移动端全屏入口；未知或被用户停用的视图会拒绝调用。

调用方负责用户动作与确认。错误保留 message；参数／生命周期／读取错误还提供 `INVALID_ARGUMENT`、`NOT_FOUND`、`UNAVAILABLE`、`READ_FAILED`、`WRITE_FAILED` 等 code，底层写入错误保留原错误。

## 任务完成事件

```js
const onCompleted = event => console.log(event.detail);
window.addEventListener("tm:task-completed", onCompleted);
// 调用方卸载时：
window.removeEventListener("tm:task-completed", onCompleted);
```

detail 包含指南约定的 `id`、`title`、`blockId`、`docId`、`completedAt`（毫秒时间戳）、`tags`；另有 `operationId`、`occurrenceId`、`source` 便于追踪和去重。

事件在任务完成提交成功后触发，与积分联动开关独立。循环任务完成当轮后即使已推进下一轮、最终复选框变回未完成，也会触发一次。取消完成、撤销／重做、后台历史修复和自动父任务完成不会触发。当前实例对重复操作回执做有界去重；消费者应自行持久化业务幂等身份。

DOM 事件只作用于当前窗口，不持久化、不跨窗口广播、不回放遗漏事件。`operationId` 可识别本次操作；小驴打卡现有 `taskhorizon:<blockId>:<localDate>` 协议仍是同任务每天一次，不能直接替换成 operationId。

## 雷切工作台

检测到 `siyuan-speed-switch` 且有 `registerHomeModule()` 时，注册 `task-horizon-today` 到组件商店：显示当前分组的今日待办数量和前 5 项，点击打开原生任务块。用户在雷切商店自行添加到布局。

仅注册摘要，不提供 done 字段，避免雷切现有 Markdown 勾选路径绕过任务视界写入队列。直接勾选需雷切增加提供方写入回调；届时调用本公共 `setTaskStatus()` 即可。

每 3 秒仅检查插件实例是否变化，不轮询任务数据；窗口聚焦、任务宿主挂载和布局就绪时也重新检测。支持后启用和重载雷切，替换实例时注销旧注册。卸载时清理组件、监听器、定时器和属于当前实例的全局门面。

## 指南三个配合点的对应关系

1. `tm:task-completed`：已提供同名完成事件和约定字段。
2. `window.TaskHorizon`：已提供 getTodayTasks/setTaskStatus/openView、版本和卸载清理，并增加查询、状态枚举和就绪检测。
3. 雷切组件注册：使用安装包实际存在的实例方法 registerHomeModule，替代指南中不存在的全局 registerRaikiriModuleSafely。

这些是 Task Horizon 的提供方接入点。当前小驴打卡 18.34.0 没有监听上述完成事件；习惯映射与 recordEventsBatch 消费适配尚需独立接入，不表示已实现自动入账。
