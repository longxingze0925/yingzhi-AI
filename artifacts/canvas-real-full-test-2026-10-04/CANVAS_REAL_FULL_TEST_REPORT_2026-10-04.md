# 影织无限画布真实全功能测试报告

**测试日期：** 2026-10-04  
**测试环境：** Playwright 1.47.2、Chromium/Chrome 154.0.8037.97、1920×1080  
**影织地址：** http://localhost:13000/studio/canvas  
**New API 地址：** http://localhost:3000  
**测试方式：** 使用真实账号登录、真实前后端、真实网络请求；未使用模拟数据或拦截返回值  
**账号安全：** 报告及打包文件未保存登录密码

## 一、结论

**整体评价：⚠️ 部分通过。** 核心画布编辑、节点操作、连线、持久化、导入导出基本可用；但真实生成闭环未全部打通，不能认定为“全部功能通过”。

- 测试项：**45**
- 通过：**39**
- 失败：**6**
- 通过率：**86.7%**
- 高清截图：**13 张**
- Console/Page error：**15 条**
- HTTP 4xx/5xx：**14 条**
- 两个服务复核：影织 **HTTP 200**，New API **HTTP 200**

## 二、已通过的核心能力

1. 画布列表、新建画布和登录态正常。
2. 文本、图片、视频、音频、全景图、导演台、生成配置共 7 种节点可创建。
3. 文本编辑、节点拖动、四角缩放、Shift 多选、多选同步拖动可用。
4. 复制粘贴、撤销重做、分组、右键菜单复制可用。
5. 缩放滑块、滚轮缩放、Space 平移、主题、网格、小地图、快捷键面板可用。
6. 左右连接点、虚线连接预览、cubic Bézier 连线、选择、Escape、Delete/Backspace 可用。
7. 节点移动和调整大小时连线跟随；自连接会被拒绝；支持多条交叉连线。
8. 删除节点会清理关联连线；刷新后节点和连线恢复。
9. ZIP 导出、ZIP 导入、图片上传、素材弹窗和 Agent 面板可用。
10. 导出 JSON 实测包含 `connections` 数组，样本中包含 1 条连接。

## 三、详细测试结果

| # | 测试项 | 结果 | 优先级 | 说明 |
|---:|---|---|---|---|
| 1 | 真实账号登录态有效 | ✅ 通过 | — | — |
| 2 | New API 与影织服务可访问 | ✅ 通过 | — | {"canvas":200,"api":200} |
| 3 | 文本节点创建 | ✅ 通过 | — | — |
| 4 | 文本节点拖动 | ✅ 通过 | — | — |
| 5 | 文本节点双击编辑 | ✅ 通过 | — | — |
| 6 | 节点四角调整大小 | ✅ 通过 | — | — |
| 7 | 7 种节点类型可创建 | ✅ 通过 | — | — |
| 8 | 画布缩放滑块 | ✅ 通过 | — | — |
| 9 | 鼠标滚轮缩放 | ✅ 通过 | — | — |
| 10 | Space 临时平移 | ✅ 通过 | — | — |
| 11 | 画布外观：主题与网格 | ✅ 通过 | — | — |
| 12 | 小地图打开关闭 | ✅ 通过 | — | — |
| 13 | 快捷键面板 | ✅ 通过 | — | — |
| 14 | 左侧面板三个标签 | ✅ 通过 | — | — |
| 15 | Shift 多选 | ✅ 通过 | — | — |
| 16 | 多选同步拖动 | ✅ 通过 | — | — |
| 17 | Ctrl/Cmd+C、V 复制粘贴 | ✅ 通过 | — | — |
| 18 | 撤销与重做 | ✅ 通过 | — | — |
| 19 | 右键菜单复制 | ✅ 通过 | — | 补测通过：右键菜单复制后节点数从 1 增加到 2；证据 screenshots/11_右键菜单复制.png |
| 20 | Ctrl/Cmd+G 创建组 | ✅ 通过 | — | — |
| 21 | Ctrl/Cmd+D 快速复制 | ❌ 失败 | P2 | 当前未实现 Ctrl/Cmd+D |
| 22 | 连接点左右各一个且 cursor=crosshair | ✅ 通过 | — | — |
| 23 | 拖出连线时显示虚线预览 | ✅ 通过 | — | — |
| 24 | 创建连线并渲染 cubic Bézier | ✅ 通过 | — | — |
| 25 | 连线末端箭头 | ❌ 失败 | P1 | SVG 未设置 marker-end，当前没有箭头 |
| 26 | 连线选中与 Escape 取消 | ✅ 通过 | — | — |
| 27 | Delete 删除选中连线 | ✅ 通过 | — | — |
| 28 | Backspace 删除选中连线 | ✅ 通过 | — | — |
| 29 | 节点拖动时连线跟随 | ✅ 通过 | — | — |
| 30 | 节点调整大小时连线跟随 | ✅ 通过 | — | — |
| 31 | 拒绝自连接 | ✅ 通过 | — | — |
| 32 | 支持多条连线交叉渲染 | ✅ 通过 | — | — |
| 33 | 删除节点自动清理相关连线 | ✅ 通过 | — | — |
| 34 | 刷新后节点和连线恢复 | ✅ 通过 | — | — |
| 35 | 导出画布 ZIP | ✅ 通过 | — | connections=1 |
| 36 | 导入画布 ZIP | ✅ 通过 | — | — |
| 37 | 上传图片素材并创建节点 | ✅ 通过 | — | — |
| 38 | 素材库弹窗 | ✅ 通过 | — | — |
| 39 | 我的素材弹窗 | ✅ 通过 | — | — |
| 40 | Agent 面板打开 | ✅ 通过 | — | — |
| 41 | 真实模型目录加载 | ✅ 通过 | — | {"image":0,"video":1,"audio":0,"text":1} |
| 42 | 图片模型可用 | ❌ 失败 | P1 | 当前 New API 没有可用图片模型 |
| 43 | 音频模型可用 | ❌ 失败 | P1 | 当前 New API 没有可用音频模型 |
| 44 | 真实文本生成请求 | ❌ 失败 | P1 | HTTP 500: {"error":{"message":"upstream error: do request failed (request id: 202610040026250709570208268d9d6j9gUzeOS)","type":"new_api_error","param":"","code":"do_request_failed"}} |
| 45 | 真实视频生成提交 | ❌ 失败 | P1 | 改为模型允许的 30 秒后，POST /api/studio/generation/jobs 虽返回 HTTP 200，但业务返回 success:false、message=生成请求失败；查询任务状态为 failed |

## 四、失败与问题清单

### P1 — 重要问题

1. **连线没有终点箭头**
   - 实际：连线为平滑 cubic Bézier，但 SVG 路径没有 `marker-end`。
   - 影响：连接方向不够直观。
   - 建议：为普通、选中、预览状态统一增加 SVG marker，并验证缩放下箭头尺寸。

2. **视频节点默认时长与模型能力不匹配**
   - 实际：画布默认显示并提交 `6s`；当前模型 `seedance-2-5` 的目录能力仅允许 `30s`。
   - 默认请求结果：`success:false`，提示“生成时长不符合该模型的能力范围”。
   - 建议：加载模型能力后自动选择合法时长，不要写死 6 秒。

3. **视频改为合法的 30 秒后仍生成失败**
   - 实际：接口 HTTP 200，但业务体为 `{"message":"生成请求失败","success":false}`；任务查询状态为 `failed`。
   - 影响：视频真实生成闭环不可用。
   - 建议：检查 New API 视频渠道、模型映射、上游凭证与错误透传，前端必须以 `success` 而非 HTTP 状态判断成功。

4. **文本真实生成失败**
   - 接口：`POST /api/studio/text/completions`
   - 实际：HTTP 500，`upstream error: do request failed`。
   - 影响：文本节点无法完成真实生成。

5. **图片和音频没有可用模型**
   - 实测模型目录：图片 0、视频 1、音频 0、文本 1。
   - 影响：图片、音频真实生成入口存在，但无法选择可用模型。
   - 建议：在 New API 配置并启用对应模型；无模型时前端显示明确空状态并禁用生成。

6. **上游遗留接口仍返回 404**
   - `/api/prompts?page=1&pageSize=1`
   - `/api/prompts?category=system&page=1&pageSize=500`
   - `/api/v1/agent-skills`
   - `/api/agent-skills`
   - 影响：提示词库/Agent Skill 数据不完整，控制台持续报错。
   - 建议：接入影织/New API 的正式接口，或删除无效的兼容请求。

### P2 — 次要问题

1. **Ctrl/Cmd+D 快速复制未实现**，目前可通过 Ctrl/Cmd+C、V 或右键“复制”完成。
2. **`/icons/openai.svg` 404**，本轮出现 9 次；不阻断核心交互，但造成图标缺失和控制台噪声。

## 五、真实生成验证

| 类型 | 模型/配置 | 结果 |
|---|---|---|
| 文本 | 当前文本模型 | ❌ HTTP 500，上游请求失败 |
| 图片 | 无可用模型 | ❌ 无法提交 |
| 音频 | 无可用模型 | ❌ 无法提交 |
| 视频默认 | seedance-2-5、6 秒 | ❌ 时长不在模型能力范围 |
| 视频合法配置 | seedance-2-5、30 秒 | ❌ HTTP 200 但 `success:false`，任务状态 `failed` |

## 六、持久化与导出数据验证

导出文件：`test_canvas_export.json` / `test_canvas_export.zip`

- `app`: `infinite-canvas`
- `version`: `3`
- `projects`: 1
- 样本节点：2
- 样本连接：1
- 连接字段：`id`、`fromNodeId`、`toNodeId`
- 刷新恢复：通过
- ZIP 导入恢复：通过

说明：当前上游格式没有持久化 `sourceSide/targetSide`，连接侧由布局动态计算；本轮导出/导入后连线可以恢复。

## 七、控制台与接口错误

| 错误 | 次数 | 影响 |
|---|---:|---|
| `404 /icons/openai.svg` | 9 | 图标缺失、控制台噪声 |
| `404 /api/prompts...` | 2 | 提示词相关数据无法加载 |
| `404 /api/v1/agent-skills`、`/api/agent-skills` | 2 | Agent Skill 数据无法加载 |
| `500 /api/studio/text/completions` | 1 | 文本真实生成失败 |
| 资产清理阶段 Skill key 请求异常 | 1 条 Console error | 与无效 Agent Skill 接口相关 |

## 八、截图证据

1. `screenshots/01_画布列表.png`
2. `screenshots/02_七种节点.png`
3. `screenshots/03_画布控件.png`
4. `screenshots/04_选择复制分组.png`
5. `screenshots/05_连接预览.png`
6. `screenshots/06_多条连线.png`
7. `screenshots/07_刷新持久化.png`
8. `screenshots/08_导出导入.png`
9. `screenshots/09_素材与Agent.png`
10. `screenshots/10_真实生成结果.png`
11. `screenshots/11_右键菜单复制.png`
12. `screenshots/12_视频生成默认配置.png`
13. `screenshots/13_视频30秒真实提交.png`

## 九、附件

- `test-results.json`：45 项完整结果、网络错误和生成响应
- `targeted-retest-results.json`：右键复制与视频生成补测
- `targeted-context-menu-video-settings.json`：补测原始页面数据
- `targeted-video-submit.json`：30 秒视频请求与任务状态原始响应
- `console_errors.txt`：控制台及 HTTP 错误
- `test_canvas_export.json`：导出数据
- `test_canvas_export.zip`：真实导出包
- `screenshots/`：13 张 1920×1080 截图

## 十、风险与清理说明

- 本轮自动化测试在测试账号内新建了多张测试画布，**未自动删除**，避免误删用户原有数据。
- 本轮没有修改业务代码，只生成测试产物。
- 登录状态文件保存在 `/tmp`，没有放入交付包。
