# 影织画布连线功能全面测试报告

**测试日期：** 2026-10-03  
**测试环境：** 影织前端 `http://localhost:3002`；New API `http://localhost:3000`；Google Chrome；视口 1920×1080。Chrome/Playwright 的精确版本未写入运行记录。  
**测试入口：** `http://localhost:3002/studio/canvas`  
**执行方式：** Playwright 真实浏览器交互；没有用 mock 请求代替画布流程。

> **结论先行：本轮不能判定验收通过。** 最后一次运行登录请求返回 HTTP 429“当前请求过多，请稍后再试”，浏览器停留在登录页；按阻断规则停止，最新一轮 26 项均为 BLOCKED。此前的多轮真实 UI 证据中，修复 1、2、3 曾通过；修复 4 在菜单修复前失败，菜单代码随后有更新，但更新后的行为被登录限流阻断，尚未验证。不要把历史阶段性通过误读为 26/26 通过。

## 一、环境和阻断情况

- 影织 UI 可以加载到登录页；New API `/api/status` 在运行记录中返回 HTTP 200。
- 未登录时 bootstrap/refresh 请求返回 401；注册请求在一次执行中返回 200，但随后登录请求返回 HTTP 429。
- 阻断请求：`POST /api/studio/auth/login`，页面提示“当前请求过多，请稍后再试”。没有继续尝试账号、注册、登录，也没有修改限流配置或清理数据。
- 最新轮次时间：`2026-10-03T14:08:34Z` 至 `2026-10-03T14:08:56Z`（运行记录为 UTC）。
- 最新运行记录：26 项总计，PASS 0、FAIL 0、BLOCKED 26。此处 BLOCKED 表示未能执行，不代表功能失败。

## 二、26 项测试结果

| # | 测试项 | 最新轮次 | 实际结果 / 已有证据 |
|---:|---|---|---|
| 1 | 修复 1：导出/导入包含连线 | BLOCKED | 当前登录页无法重测。此前真实 UI 导出 JSON 含 `connections` 及所需字段，导入往返恢复节点和连线（attempt-07 记录 PASS）；最初轮次曾发现导入后连线数组为空，之后已有修复。 |
| 2 | 修复 2：连接点不被调整手柄遮挡 | BLOCKED | 当前无法重测。此前左右连接点都能触发连线创建，hover 计算样式为 `scale(1.25)`（attempt-07 记录 PASS）。更早一次自动化点击被节点本身拦截，属于当轮测试定位/交互失败，后续轮次已通过。 |
| 3 | 修复 3：4 个方向贝塞尔曲线 | BLOCKED | 当前无法重测。此前四种连接侧组合及终点箭头检查通过（attempt-07 记录 PASS）。attempt-06 曾发现箭头 marker 缺失，后续修复后通过。 |
| 4 | 修复 4：删除节点自动清理连线 | BLOCKED | 当前无法重测。修复前右键节点没有出现“删除”菜单项（attempt-07/08 记录 FAIL）；之后代码中已能看到节点右键菜单/删除项，但新行为尚未通过真实 UI 重测。 |
| 5 | 两次点击创建连线 | BLOCKED | 最新轮次停留登录页；无本轮结果。 |
| 6 | 贝塞尔曲线和箭头视觉效果 | BLOCKED | 最新轮次停留登录页；基础渲染仅在修复 3 的历史检查中有部分覆盖。 |
| 7 | 点击选中连线、点击空白取消 | BLOCKED | 未执行。 |
| 8 | Delete/Backspace 删除连线 | BLOCKED | 未执行。 |
| 9 | Escape 取消连线/选择 | BLOCKED | 未执行。 |
| 10 | 同一连接点创建多条连线 | BLOCKED | 未执行。 |
| 11 | 节点拖动时连线跟随 | BLOCKED | 未执行。 |
| 12 | 调整节点大小时连线跟随 | BLOCKED | 未执行。 |
| 13 | 多选节点拖动时连线跟随 | BLOCKED | 未执行。 |
| 14 | 拒绝自连接 | BLOCKED | 未执行。 |
| 15 | 复制节点不复制连线 | BLOCKED | 未执行。 |
| 16 | 撤销/重做包含连线操作 | BLOCKED | 未执行。 |
| 17 | 刷新后连线保留 | BLOCKED | 未执行。 |
| 18 | 导出/导入连线（二次功能用例） | BLOCKED | 最新轮次未执行；修复 1 的历史证据有覆盖，但不替代本轮完整 26 项验收。 |
| 19 | 未选中灰色、选中蓝色 | BLOCKED | 未执行。 |
| 20 | 未选中 2px、选中 3px | BLOCKED | 未执行。 |
| 21 | 箭头颜色随连线状态变化 | BLOCKED | 未执行；历史修复 3 检查了箭头存在和曲线方向，不足以证明颜色切换。 |
| 22 | 删除源节点清理连线 | BLOCKED | 未执行。 |
| 23 | 删除目标节点清理连线 | BLOCKED | 未执行。 |
| 24 | 空画布新建节点并连线 | BLOCKED | 未执行。 |
| 25 | 节点堆叠时连线不乱 | BLOCKED | 未执行。 |
| 26 | 20+ 连线性能及拖动帧率 | BLOCKED | 未执行；未测渲染时间或 FPS。 |

### 修复验证阶段性结论

| 修复 | 阶段性真实 UI 结果 | 最终结论 |
|---|---|---|
| 导入/导出 connections | 后续轮次导出结构正确，导入往返通过；JSON 实物见 `test_canvas_with_connections.json` | 历史验证通过；本轮因登录阻断未复验 |
| 连接点点击/hover | 左右端口点击及 `scale(1.25)` 曾通过 | 历史验证通过；本轮因登录阻断未复验 |
| 四方向曲线/箭头 | 后续轮次四方向曲线和箭头检查曾通过 | 历史验证通过；本轮因登录阻断未复验 |
| 删除节点清理关联线 | 修复前右键菜单测试失败；之后代码增加菜单，但重测触发 429 | **未验证，不能判通过** |

## 三、发现的问题和风险

### 阻断问题：登录限流（P0 - 本次验收阻断）

- **复现：** 访问画布后进入登录页；本轮在之前的浏览器执行中提交登录请求。
- **实际：** `POST /api/studio/auth/login` 返回 HTTP 429，界面提示“当前请求过多，请稍后再试”；不能进入编辑器。
- **预期：** 已有有效会话/账号可以登录并进入画布。
- **处理：** 按要求停止，不再重试登录/注册、不调整限流、不操作账户或画布数据。需要在限流冷却并由用户确认可继续后再完成测试。
- **证据：** `screenshots/00-login-blocker.png`，以及 `test-results.json` 和 `console_errors.txt`。

### 其他已观察项

- 修复 4 早期测试未找到右键“删除”菜单；目前源码已有右键菜单项，但缺少修复后的浏览器证据。
- 初始轮次发现导入时没有恢复连线；后续轮次记载导入往返成功，保留初始失败截图作为问题修复历史。
- 一轮中箭头 marker 未渲染，之后修复 3 的验证记录通过；仍需完整回归颜色、选中态等独立用例。
- 性能阈值、控制台全程无错误和完整 22 个功能用例均未完成验证。

## 四、截图与控制台

- `screenshots/` 中目前有 **23 张** 1920×1080 屏幕截图，覆盖登录阻断、画布初始状态、连接创建、导入导出、连接点、贝塞尔曲线、删除菜单等；截图来自多轮尝试，文件名前缀标明历史轮次。它们不是 26 项完整测试的逐项证据。
- 当前最新轮次的截图包括 `00-login-blocker.png` 等；修复 1–3 的 PASS 证据来自 `history-attempt07-*` 或同名历史图；修复 4 现有截图显示的是菜单修复前的失败状态。
- `console_errors.txt` 记录了资源 401、登录 429 和被导航取消的 RSC 请求。最新记录中没有 JavaScript `pageError`；但网络错误并非“控制台无错误”。

## 五、测试数据和性能

- 导出样本：`test_canvas_with_connections.json`，由真实 UI 导出；包含 `projects[0].connections`，有 `id`、`sourceNodeId`、`sourceSide`、`targetNodeId`、`targetSide`、`createdAt`。
- `test-results.json` 是最新一次被限流阻断的记录；`run-history/` 中附有较早轮次原始结果，供追溯。
- 连线创建响应、20 条连线渲染耗时、拖动 FPS：未测量。不得据此宣称达标。

## 六、结论和后续

**整体评价：⚠️ 部分验证，验收未通过/未完成。** 最新一轮 0/26 完成；阶段性修复验证 1–3 曾通过，修复 4 的最新实现未验证。建议先等待登录限流解除并获得继续测试确认，然后从修复 4 开始完成全部剩余用例；若仍有限流，停止而不是重试。

## 附录：截图文件

- `screenshots/00-canvas-list-authenticated.png`
- `screenshots/00-login-blocker.png`
- `screenshots/01-empty-canvas.png`
- `screenshots/02-two-text-nodes.png`
- `screenshots/fix-01-created-connection.png`
- `screenshots/fix-01-export-json.png`
- `screenshots/fix-01-exported-editor.png`
- `screenshots/fix-01-import-connections-missing.png`
- `screenshots/fix-01-import-result.png`
- `screenshots/fix-02-connection-point-hover.png`
- `screenshots/fix-02-connection-point.png`
- `screenshots/fix-02-connection-points-clickable.png`
- `screenshots/fix-03-bezier-curves.png`
- `screenshots/fix-04-right-click-delete-menu.png`
- `screenshots/history-attempt02-connection-point-harness-failure.png`
- `screenshots/history-attempt03-created-connection.png`
- `screenshots/history-attempt03-two-text-nodes.png`
- `screenshots/history-attempt05-connection-points-clickable.png`
- `screenshots/history-attempt06-bezier-arrow-failure.png`
- `screenshots/history-attempt07-bezier-pass.png`
- `screenshots/history-attempt07-delete-menu-failure.png`
- `screenshots/history-initial-import-connections-missing.png`
- `screenshots/preflight-current.png`


## 附录：交付物

- `CANVAS_FIXES_TEST_REPORT_2026-10-03.md`：本报告
- `screenshots/`：真实浏览器截图（多轮，来源已在文件名区分）
- `test_canvas_with_connections.json`：真实 UI 导出样本
- `console_errors.txt`：最新运行控制台/网络错误摘要
- `test-results.json`：最新 26 项阻断记录
- `run-history/`：前序测试原始 JSON 记录
- `test-canvas-fixes.mjs`：本地 Playwright 测试脚本
