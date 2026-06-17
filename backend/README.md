# 影织 Rust 后端

第一版后端用于承接 Next.js 前端，并由服务端调用 EntitleHub Server API。

## 启动

默认走本地 mock EntitleHub，方便先联调前端：

```bash
cargo run
```

服务默认监听：

```text
http://127.0.0.1:18777
```

## 接真实 EntitleHub

```bash
set ENTITLEHUB_MOCK=false
set ENTITLEHUB_BASE_URL=https://entitlehub.example.com
set ENTITLEHUB_SERVER_KEY=ehsk_xxx
set DEMO_ENTITLEHUB_CUSTOMER_ID=00000000-0000-0000-0000-000000000001
cargo run
```

PowerShell：

```powershell
$env:ENTITLEHUB_MOCK="false"
$env:ENTITLEHUB_BASE_URL="https://entitlehub.example.com"
$env:ENTITLEHUB_SERVER_KEY="ehsk_xxx"
$env:DEMO_ENTITLEHUB_CUSTOMER_ID="00000000-0000-0000-0000-000000000001"
cargo run
```

## 已实现接口

```http
GET  /healthz
GET  /api/me
GET  /api/me/usage
GET  /api/me/api-key
GET  /api/me/favorites
GET  /api/billing/plans
GET  /api/ai/models?type=image|video
GET  /api/ai/styles
GET  /api/gallery?type=image|video
GET  /api/assets
POST /api/generation/jobs
GET  /api/generation/jobs
GET  /api/generation/jobs/{id}
GET  /api/works
```

## 当前取舍

- 真实模式下登录、余额、用量、模型、任务、资产、作品来自 EntitleHub；影织后端只维护 Web Cookie session。
- mock 模式下任务和作品暂时保存在内存，方便本地离线调试。
- EntitleHub 未配置时会用 mock 模型和 mock 任务推进，方便本地调通前端。
- Server Key 只允许放在 Rust 后端环境变量里，不能进入前端。
- Web 登录使用 `POST /api/server/web/v1/customers/login`，再由影织后端维护自己的 Cookie session。
