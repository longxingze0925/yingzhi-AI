# 影织 Shadowweave · AI 图片与视频创作平台

> 用一句话，编织影像。专业级 AI 文生图 / 图生图 / 文生视频创作平台。

明暗双主题、电影感高级视觉，完整可运行的前端骨架。后端已在 `backend/` 下启动 Rust 第一版，用于承接前端并调用 EntitleHub Server API。

## 技术栈

- **框架**：Next.js 14（App Router）+ React 18 + TypeScript
- **样式**：Tailwind CSS + shadcn/ui 风格组件（Radix 原子组件）
- **主题**：next-themes（暗色优先，支持跟随系统）
- **动效**：framer-motion
- **状态**：zustand（生成任务队列）
- **图标**：lucide-react
- **后端**：Rust + Axum（`backend/`）

## 快速开始

```bash
npm install      # 安装依赖
npm run dev      # 本地开发：http://localhost:3000
npm run build    # 生产构建
npm start        # 运行生产构建
```

前端默认请求本地后端 `http://127.0.0.1:18777`。如需改地址：

```bash
NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:18777 npm run dev
```

后端本地启动：

```bash
cd backend
cargo run        # 默认 mock EntitleHub：http://127.0.0.1:18777
```

## 镜像一键安装

推荐生产部署走 GitHub Actions 构建镜像，服务器只拉 GHCR 镜像运行：

```bash
bash <(curl -Ls https://raw.githubusercontent.com/longxingze0925/yingzhi-AI/main/ops/install.sh)
```

运行后会进入交互安装，提示填写 EntitleHub Server Key；不填写则按 mock 模式启动。默认拉取 GHCR 上已经构建好的 `yingzhi-AI-web` / `yingzhi-AI-backend` 镜像。

如果 GHCR 镜像是私有的，执行前提供一个只有 `read:packages` 权限的 GitHub token：

```bash
GHCR_USERNAME='longxingze0925' \
GHCR_TOKEN='github_pat_xxx' \
bash <(curl -Ls https://raw.githubusercontent.com/longxingze0925/yingzhi-AI/main/ops/install.sh)
```

后续更新：

```bash
sudo bash /opt/shadowweave/update-image.sh
```

## 源码一键安装

备用方案：服务器直接拉源码并本机编译。服务器建议使用 Debian/Ubuntu，脚本会安装 Node.js 20、Rust、构建前后端、写入 systemd 服务，并默认用 Nginx 做同域反代。

```bash
ENTITLEHUB_SERVER_KEY='ehsk_xxx' \
SHADOWWEAVE_DOMAIN='your-domain.com' \
bash <(curl -Ls https://raw.githubusercontent.com/longxingze0925/yingzhi-AI/main/ops/install.sh) source
```

如果仓库名或分支不同：

```bash
SHADOWWEAVE_REPO='your-github-user/your-repo' \
SHADOWWEAVE_REF='main' \
ENTITLEHUB_SERVER_KEY='ehsk_xxx' \
SHADOWWEAVE_DOMAIN='your-domain.com' \
bash <(curl -Ls https://raw.githubusercontent.com/your-github-user/your-repo/main/ops/install.sh) source
```

常用维护命令：

```bash
sudo bash /opt/shadowweave/ops/shadowweavectl.sh status
sudo bash /opt/shadowweave/ops/shadowweavectl.sh logs
sudo bash /opt/shadowweave/ops/shadowweavectl.sh restart
```

## 页面结构

| 路由 | 说明 |
| --- | --- |
| `/` | 首页营销页：Hero / 作品墙 / 能力 / 工作流 / 定价 / CTA |
| `/login` | 登录 / 注册（邮箱、手机号、第三方占位） |
| `/studio` | 工作台入口（重定向至灵感广场） |
| `/studio/explore` | 灵感广场：分类筛选 + 瀑布流 + 作品详情 |
| `/studio/image` | 图片生成：文生图 / 图生图，参数面板 + 生成画布 |
| `/studio/video` | 视频生成：文生视频 / 图生视频，时长 / 运镜 |
| `/studio/assets` | 我的作品：图片 / 视频 / 收藏 |
| `/studio/library` | 素材资产库：文件夹 + 上传 + 素材网格 |
| `/studio/settings` | 账号与会员：资料 / 套餐算力 / 用量 / API |

## 目录概览

```
app/                  # 路由与页面（App Router）
backend/              # Rust 后端：影织业务 API -> EntitleHub Server API
components/
  ui/                 # 基础组件（button/card/dialog/select…）
  brand/              # Logo、渐变占位、光晕背景
  marketing/          # 首页区块
  studio/             # 工作台：侧栏/顶栏/参数面板/生成画布…
  shared/             # 通用组件（MediaCard / Reveal）
  theme/              # 主题 Provider 与切换
lib/
  api/                # 数据访问层（types / client）—— 对接后端的单一替换点
  store/              # zustand 状态
data/mock/            # 占位数据（作品、模型、定价、用户）
```

## 对接 Rust 后端

前端所有真实数据请求集中在 **`lib/api/client.ts`**，浏览器只请求影织 Rust 后端；EntitleHub Server Key 只放在后端环境变量里。真实模式下登录、余额、模型、生成任务、资产、作品、收藏、发布、下载登记都经由后端代理到 EntitleHub。

Rust 后端当前提供：

- `GET /healthz`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `POST /api/auth/logout`
- `GET /api/me`
- `GET /api/me/usage`
- `GET /api/ai/models?type=image|video|audio`
- `GET /api/gallery?type=image|video|audio`
- `GET /api/assets`
- `POST /api/assets/upload-file`
- `POST /api/generation/jobs`
- `GET /api/generation/jobs`
- `GET /api/generation/jobs/{id}`
- `GET /api/works`

## 设计说明

- 品牌色：紫电 → 品红 渐变，青蓝高光（CSS 变量 `--brand-*`，明暗各一套）
- 占位图：`components/brand/gradient-thumb.tsx` 用确定性渐变 + 噪点生成，无外链依赖
- 真实支付、个人资料保存、API Key 轮换仍需 EntitleHub 对应业务接口开放后接入
