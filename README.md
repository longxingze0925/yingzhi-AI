# 影织 Shadowweave · AI 图片、视频与音频创作平台

> 用一句话，编织影像。

影织是创作前端；账户、登录注册、余额、兑换码、代理分润、租户隔离、模型路由、生成计费与失败退款统一由 New API 提供。浏览器只访问影织同源的 `/api/*`，入口代理再把这些请求转发到 New API，总站上游地址和密钥不会下发给浏览器。

## 技术栈

- Next.js 14（App Router）+ React 18 + TypeScript
- Tailwind CSS + Radix UI
- Zustand
- New API Studio API（统一后端）

## 本地开发

```bash
npm ci
NEXT_PUBLIC_API_BASE_URL=https://new.0000.icu \
npm run dev
```

如果使用跨域直连，New API 必须允许对应前端 Origin。更接近生产的做法是让本地反向代理把 `/api/*` 转发至 New API，并保持 `NEXT_PUBLIC_API_BASE_URL=/api`。

## 生产请求路径

```text
用户浏览器
  -> 影织域名
  -> Caddy / Nginx
       /       -> 影织 Web
       /api/*  -> New API
  -> New API 的同一用户、余额、租户与计费数据
```

生产镜像默认使用：

```text
NEXT_PUBLIC_API_BASE_URL=/api
NEXT_PUBLIC_DEMO_FALLBACK=0
```

反向代理必须配置：

```env
NEW_API_UPSTREAM=https://new.0000.icu
NEW_API_HOST=new.0000.icu
```

`NEW_API_HOST` 必须填写 New API 总站域名，不能填写影织域名。这样 New API 会按总站身份读取同一份用户和余额数据，而不会把影织域名误判成另一个代理租户。

New API 开启安全刷新 Cookie 时，还必须把影织公网 Origin 加入 New API 的 `SESSION_COOKIE_TRUSTED_URL`，例如：

```env
SESSION_COOKIE_TRUSTED_URL=https://studio.example.com
```

## 镜像安装

GitHub Actions 只构建 Web 镜像：

```text
ghcr.io/<owner>/<repo>-web
```

安装命令：

```bash
NEW_API_UPSTREAM='https://new.0000.icu' \
NEW_API_HOST='new.0000.icu' \
bash <(curl -Ls https://raw.githubusercontent.com/longxingze0925/yingzhi-AI/main/ops/install.sh)
```

安装器支持：本机、IP、自动 HTTPS、自有证书、已有反向代理。Caddy 模式会自动把 `/api/*` 转发到 New API；外部反代模式会生成 `reverse-proxy.nginx.example.conf`。

常用命令：

```bash
yingzhi status
yingzhi logs
yingzhi smoke
yingzhi change-upstream
yingzhi update
```

## 源码安装

```bash
SHADOWWEAVE_DOMAIN='studio.example.com' \
NEW_API_UPSTREAM='https://new.0000.icu' \
NEW_API_HOST='new.0000.icu' \
bash <(curl -Ls https://raw.githubusercontent.com/longxingze0925/yingzhi-AI/main/ops/install.sh) source
```

源码安装只编译并运行 Next.js Web，不安装或运行旧 Rust 后端。

## 页面结构

| 路由 | 说明 |
| --- | --- |
| `/` | 首页 |
| `/login` | New API 统一账号登录 |
| `/studio/explore` | 灵感广场 |
| `/studio/image` | 图片生成 |
| `/studio/video` | 视频生成 |
| `/studio/audio` | 音频生成 |
| `/studio/assets` | 我的作品 |
| `/studio/library` | 素材库 |
| `/studio/settings` | 账号、余额与用量 |

## 当前 Studio API

影织当前使用以下 New API 路径：

- `/api/studio/auth/*`
- `/api/studio/bootstrap`
- `/api/studio/wallet`、`/groups`、`/usage`、`/credential`
- `/api/studio/ai/models`、`/ai/styles`
- `/api/studio/generation/jobs*`
- `/api/studio/assets*`
- `/api/studio/works*`、`/gallery`、`/favorites`
- `/api/studio/topup*`

生成时由 New API 在服务端创建和持有影织专属 Token；Token 明文不会返回浏览器。生成、扣费、退款、日志和租户归属均沿用 New API 的真实链路。
