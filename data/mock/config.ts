import type {
  AspectRatioOption,
  PricingPlan,
  StylePreset,
  User,
} from "@/lib/api/types";

export const ASPECT_RATIOS: AspectRatioOption[] = [
  { value: "1:1", label: "1:1 方形", w: 1, h: 1 },
  { value: "3:4", label: "3:4 竖图", w: 3, h: 4 },
  { value: "4:3", label: "4:3 横图", w: 4, h: 3 },
  { value: "16:9", label: "16:9 宽屏", w: 16, h: 9 },
  { value: "9:16", label: "9:16 竖屏", w: 9, h: 16 },
  { value: "21:9", label: "21:9 电影", w: 21, h: 9 },
  { value: "3:2", label: "3:2 横图", w: 3, h: 2 },
  { value: "2:3", label: "2:3 竖图", w: 2, h: 3 },
  { value: "2:1", label: "2:1 长横", w: 2, h: 1 },
  { value: "1:2", label: "1:2 长竖", w: 1, h: 2 },
  { value: "3:1", label: "3:1 横幅", w: 3, h: 1 },
  { value: "1:3", label: "1:3 长幅", w: 1, h: 3 },
  { value: "9:21", label: "9:21 竖影", w: 9, h: 21 },
];

export const STYLE_PRESETS: StylePreset[] = [
  { id: "none", name: "无风格", seed: "style-none" },
  { id: "cinematic", name: "电影质感", seed: "style-cinema" },
  { id: "ink", name: "东方水墨", seed: "style-ink" },
  { id: "cyberpunk", name: "赛博朋克", seed: "style-cyber" },
  { id: "film", name: "胶片颗粒", seed: "style-film" },
  { id: "3d", name: "3D 渲染", seed: "style-3d" },
  { id: "watercolor", name: "水彩", seed: "style-water" },
  { id: "lowpoly", name: "低多边形", seed: "style-poly" },
];

export const VIDEO_DURATIONS = [4, 6, 8, 10];

export const CAMERA_MOVES = [
  { id: "none", name: "静止" },
  { id: "push", name: "推近" },
  { id: "pull", name: "拉远" },
  { id: "pan", name: "横移" },
  { id: "orbit", name: "环绕" },
  { id: "crane", name: "升降" },
];

export const PRICING_PLANS: PricingPlan[] = [
  {
    id: "free",
    name: "体验版",
    tagline: "适合个人尝鲜与轻量创作",
    priceMonthly: 0,
    priceYearly: 0,
    credits: "每月 100 算力",
    features: [
      "标准图片模型",
      "基础视频模型（带水印）",
      "公开作品至灵感广场",
      "社区标准队列",
    ],
    cta: "免费开始",
  },
  {
    id: "pro",
    name: "专业版",
    tagline: "为高频创作者与设计师打造",
    priceMonthly: 68,
    priceYearly: 680,
    credits: "每月 3,000 算力",
    features: [
      "全部图片与视频模型",
      "无水印 · 商用授权",
      "优先生成队列",
      "高清放大与批量导出",
      "私有作品空间",
    ],
    highlighted: true,
    cta: "升级专业版",
  },
  {
    id: "team",
    name: "团队版",
    tagline: "面向工作室与品牌团队",
    priceMonthly: 298,
    priceYearly: 2980,
    credits: "每月 20,000 算力 · 多席位",
    features: [
      "包含专业版全部能力",
      "5 个协作席位起",
      "团队素材资产库",
      "API 接入与 Webhook",
      "专属客户成功支持",
    ],
    cta: "联系销售",
  },
];

export const MOCK_USER: User = {
  id: "u_001",
  name: "林一川",
  email: "creator@shadowweave.ai",
  avatarSeed: "user-linyichuan",
  plan: "专业版",
  credits: 2480,
  creditsTotal: 3000,
};
