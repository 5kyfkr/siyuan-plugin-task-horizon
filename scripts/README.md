# 测试与发布检查

默认发布检查运行 `release-tests.json` 中的 **55 个核心测试＋6 个浏览器冒烟测试**，同时检查任务写入边界、运行时语法、manifest 路径与 Git 跟踪状态、版本号一致性。

```powershell
# 日常发布检查（已有 Chromium 时，本机约 23 秒）
pwsh -File scripts/verify-release.ps1

# 完整回归，包含全部界面矩阵和视图切换压力检查
pwsh -File scripts/verify-release.ps1 -Suite full

# 修改相关模块后运行该模块的完整检查
pwsh -File scripts/verify-release.ps1 -Suite kanban
```

模块可选：`calendar`、`checklist`、`kanban`、`settings`、`task`、`ai`、`whiteboard`、`mobile`。模块检查按文件名前缀选择，会有交叉覆盖；修改任务存储、写入、同步等跨模块逻辑时，运行 `full`。

Windows 未安装 PowerShell 7 时，用 `powershell.exe -NoProfile -ExecutionPolicy Bypass -File` 替换 `pwsh -File`。测试需要 Node（支持 `node:sqlite`）及 Playwright 1.63.0；脚本按需安装 Playwright 和 Chromium。已有依赖时可将 `PLAYWRIGHT_MODULE` 指向 `playwright` 或 `playwright-core` 的目录。CI 缓存浏览器及测试依赖，第一次运行仍需要安装。

## 发布与完整测试的区别

- 核心测试保留写入、归档、删除、并发回退、字段清空、置顶、循环、打卡、快照、索引、可见性、日历订阅、通知、定时事件等数据行为。
- 清单冒烟验证桌面与手机布局、备注展开及修改、子任务进度、复选框与折叠；完整模式继续运行字号、宽度、行高、主题和宿主矩阵。
- 看板冒烟运行 5 个完成、层级移动、局部更新与删除案例；完整模式运行全部回归和 250 / 1000 次视图切换压力检查。
- 设置冒烟验证打开、修改、保存、重载、关闭和重开；完整模式继续检查所有分类、搜索、主题及异步保存。
- 日历编辑冒烟保留桌面 Dock、手机和平板三种代表设备；完整模式检查全部设备组合。
- 其他测试仍保留，直接 `node scripts/<名称>.test.js` 或使用对应模块套件运行。直接运行浏览器文件默认使用完整模式，`TM_TEST_SMOKE=1` 才使用冒烟分支。

定时事件测试只让短异步操作使用真实计时器。长后台计时器由测试主动推进，并验证三次会话清理请求，结束时释放所有测试计时器；不再等真实的 45 秒后台清理。

已删除两个只禁止旧调试字符串的文件、重复的 manifest 语法测试，以及已迁移到清单浏览器行为检查的备注源码断言。其他尚有独有覆盖的源码检查保留在完整套件中；清单换行和局部刷新文件仅去除重复的外观常量断言。

## 检查最终安装包

```powershell
pwsh -File scripts/verify-release.ps1
pwsh -File build.ps1
pwsh -File scripts/verify-package.ps1
```

包检查必须在打包后运行。Python 3 和 Node 校验最终 ZIP 的原始路径、重复路径、开发文件泄漏、必需文件、版本号、当前 JS/CSS 源码、全部任务运行时片段的内容与顺序，以及拼接后的语法。可通过 `-PackagePath <路径>` 检查其他包；包必须来自当前源码。

GitHub 的 `release` workflow 使用上述顺序。完整或模块检查可在 Actions 的 `tests` workflow 中手动选择运行。

## 维护发布清单

新增独有行为回归默认纳入完整套件。涉及任务数据或基本操作的测试，再加入 `release-tests.json`；新增耗时界面矩阵时保留一个快速冒烟分支。不要只为源码变量名、某个 CSS 字符串或旧调试名称创建新的发布门禁。
