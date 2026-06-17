import type {
  Author,
  GenerationJob,
  MediaCategory,
  MediaItem,
  MediaType,
  SourceMode,
} from "@/lib/api/types";

const AUTHORS: Author[] = [
  { id: "a1", name: "苏野", avatarSeed: "author-suye" },
  { id: "a2", name: "Mira", avatarSeed: "author-mira" },
  { id: "a3", name: "陈墨", avatarSeed: "author-chenmo" },
  { id: "a4", name: "Kade", avatarSeed: "author-kade" },
  { id: "a5", name: "若水", avatarSeed: "author-ruoshui" },
  { id: "a6", name: "Nova", avatarSeed: "author-nova" },
  { id: "a7", name: "白川", avatarSeed: "author-baichuan" },
  { id: "a8", name: "Iris", avatarSeed: "author-iris" },
];

/** 固定基准时间，避免 SSR/CSR 水合不一致 */
const BASE = 1749000000000;

function demoSourceMode(index: number): SourceMode {
  if (index % 11 === 6) return "audio";
  if (index % 9 === 3) return "frames";
  if (index % 7 === 5) return "video";
  if (index % 4 === 1) return "image";
  return "text";
}

function demoReferenceCount(sourceMode: SourceMode) {
  if (sourceMode === "frames") return 2;
  if (sourceMode === "image" || sourceMode === "video" || sourceMode === "audio") return 1;
  return 0;
}

/** 按主题生成专业结构化长提示词（贴近真实创作场景） */
function buildFullPrompt(s: { prompt: string; type: MediaType }): string {
  if (s.type === "audio") {
    return [
      `[Audio Brief] ${s.prompt}`,
      `[Voice / Texture] Clear timbre, controlled dynamics, clean transient detail`,
      `[Pacing] Natural rhythm with balanced pauses and no abrupt volume jumps`,
      `[Mix] Studio-clean output, centered presence, no clipping, low noise floor`,
      `[Delivery] Preserve the intended mood and keep the result ready for direct use.`,
    ].join("\n");
  }
  if (s.type === "video") {
    return [
      `[Equipment] Cinema-grade virtual camera, shallow depth of field`,
      `[Scene] ${s.prompt}`,
      `[Camera Movement] Slow dolly-in with subtle parallax, ending on a steady hero framing`,
      `[Lighting] Motivated cinematic lighting, soft key with rim separation, volumetric atmosphere`,
      `[Pacing] Smooth 24fps motion, no abrupt cuts, gentle easing on every move`,
      `[Color] Filmic color grade, balanced highlights and rich shadow detail`,
      `[Audio Mood] Ambient cinematic underscore, low-frequency presence`,
      `[Consistency] Preserve subject shape, proportion, and material across every frame — do NOT reimagine the subject. 720P, 9:16 ready.`,
    ].join("\n");
  }
  return [
    `Cinematic key visual: ${s.prompt}.`,
    `CRITICAL: preserve the subject's exact shape, color, texture, and every detail — do NOT alter or reimagine it.`,
    `Composition: deliberate angles, strategic cropping, balanced negative space reserved for text overlay.`,
    `Lighting: studio-grade cinematic lighting with soft falloff and crisp specular highlights.`,
    `Finish: refined styled background, true-to-life materials, high micro-contrast, 8K resolution.`,
  ].join("\n");
}

type Seed = {
  prompt: string;
  type: MediaType;
  category: MediaCategory;
  ratio: MediaItem["aspectRatio"];
  model: string;
};

const SEEDS: Seed[] = [
  { prompt: "霓虹雨夜的赛博都市，反光的街道与悬浮广告牌，电影级广角", type: "image", category: "architecture", ratio: "16:9", model: "织影 X" },
  { prompt: "东方水墨意境的孤舟与远山，留白极简，淡彩晕染", type: "image", category: "landscape", ratio: "3:4", model: "织影 X" },
  { prompt: "未来感人像，银色金属妆容，柔和棚拍光，杂志封面", type: "image", category: "portrait", ratio: "3:4", model: "织影 X" },
  { prompt: "悬浮于云海之上的水晶城堡，黄昏暖光，奇幻史诗", type: "video", category: "landscape", ratio: "16:9", model: "织影动境 Pro" },
  { prompt: "极简产品摄影，香氛瓶置于水面，柔光倒影，高级质感", type: "image", category: "product", ratio: "1:1", model: "织影 · 商业设计" },
  { prompt: "二次元少女站在樱花树下，风吹花瓣，清新赛璐璐", type: "image", category: "anime", ratio: "9:16", model: "织影 · 二次元" },
  { prompt: "抽象流体艺术，紫金与青蓝交融的丝绸质感，4K 微距", type: "image", category: "abstract", ratio: "1:1", model: "织影 X" },
  { prompt: "雪山脚下的极光帐篷，星空璀璨，长曝光银河", type: "image", category: "landscape", ratio: "21:9", model: "织影 X" },
  { prompt: "复古胶片人像，逆光金色发丝，颗粒质感，70 年代", type: "image", category: "portrait", ratio: "4:3", model: "织影 X" },
  { prompt: "未来主义运动鞋广告，悬浮分解结构，工作室硬光", type: "image", category: "product", ratio: "4:3", model: "织影 · 商业设计" },
  { prompt: "机甲战士在废土中行走，沙尘与夕阳，史诗运镜", type: "video", category: "abstract", ratio: "21:9", model: "织影动境 Pro" },
  { prompt: "玻璃幕墙摩天楼仰拍，几何线条与蓝天，极简建筑", type: "image", category: "architecture", ratio: "9:16", model: "织影 X" },
  { prompt: "梦核风格的粉色房间，柔焦超现实，胶片光晕", type: "image", category: "abstract", ratio: "1:1", model: "织影 X" },
  { prompt: "森系少年肖像，斑驳树影光斑，自然柔光", type: "image", category: "portrait", ratio: "3:4", model: "织影 X" },
  { prompt: "潜水视角的珊瑚礁与光束，海水通透，纪录片质感", type: "video", category: "landscape", ratio: "16:9", model: "织影动境 Lite" },
  { prompt: "国风插画 · 月下白衣剑客，工笔与水墨结合", type: "image", category: "anime", ratio: "3:4", model: "织影 · 二次元" },
  { prompt: "悬浮的低多边形小岛，瀑布流入云端，等距视角", type: "image", category: "abstract", ratio: "1:1", model: "织影 X" },
  { prompt: "高级腕表微距特写，金属反光与水珠，黑金背景", type: "image", category: "product", ratio: "1:1", model: "织影 · 商业设计" },
  { prompt: "雨中撑伞的女子背影，霓虹倒影湿地面，电影感", type: "video", category: "portrait", ratio: "9:16", model: "织影动境 Pro" },
  { prompt: "极地科考站夜景，绿色极光下的圆顶建筑，科幻", type: "image", category: "architecture", ratio: "16:9", model: "织影 X" },
  { prompt: "抽象烟雾舞动，紫红到青蓝渐变，黑底高对比", type: "image", category: "abstract", ratio: "9:16", model: "织影 X" },
  { prompt: "盛开的多肉植物微观世界，露珠晶莹，柔焦背景", type: "image", category: "product", ratio: "4:3", model: "织影 X" },
  { prompt: "古风庭院中撑伞而行，飘雪与红墙，长卷构图", type: "video", category: "landscape", ratio: "21:9", model: "织影动境 Lite" },
  { prompt: "未来都市天际线延时，车流光轨，蓝调时刻", type: "video", category: "architecture", ratio: "16:9", model: "织影动境 Pro" },
  { prompt: "竖屏短片 · 都市夜骑，霓虹拖影掠过镜头", type: "video", category: "architecture", ratio: "9:16", model: "织影动境 Pro" },
  { prompt: "咖啡拉花特写慢动作，奶泡缓缓旋开，暖光", type: "video", category: "product", ratio: "1:1", model: "织影动境 Lite" },
  { prompt: "宽幅航拍冰川裂隙，缓慢推进，纪录片级", type: "video", category: "landscape", ratio: "2:1", model: "织影动境 Pro" },
  { prompt: "竖版人像运镜，发丝随风，柔焦背景虚化", type: "video", category: "portrait", ratio: "2:3", model: "织影动境 Pro" },
  { prompt: "横版抽象流体，金属液滴融合分裂，微距", type: "video", category: "abstract", ratio: "3:2", model: "织影动境 Lite" },
  { prompt: "电影宽幅 · 沙漠落日驼队剪影，长焦压缩", type: "video", category: "landscape", ratio: "21:9", model: "织影动境 Pro" },
  { prompt: "超竖长幅瀑布全景，水流自顶倾泻，云雾缭绕", type: "video", category: "landscape", ratio: "9:21", model: "织影动境 Pro" },
  { prompt: "竖屏舞蹈片段，旋转裙摆，舞台追光", type: "video", category: "portrait", ratio: "9:16", model: "织影动境 Pro" },
  { prompt: "横图厨房料理过程，食材入锅升腾热气，4:3", type: "video", category: "product", ratio: "4:3", model: "织影动境 Lite" },
  { prompt: "温柔女声旁白，适合产品短片，语速自然，情绪克制", type: "audio", category: "product", ratio: "1:1", model: "织影音频 TTS" },
  { prompt: "未来科技感界面提示音，清脆短促，带轻微空间混响", type: "audio", category: "abstract", ratio: "1:1", model: "织影音频 FX" },
  { prompt: "纪录片开场氛围音乐，低频稳定，弦乐缓慢铺陈", type: "audio", category: "landscape", ratio: "1:1", model: "织影音频 Music" },
  // —— 图片补全比例（3:2 / 2:3 / 2:1 / 1:2 / 3:1 / 1:3 / 9:21）——
  { prompt: "黄金时刻的海岸公路，胶片质感，3:2 经典画幅", type: "image", category: "landscape", ratio: "3:2", model: "织影 X" },
  { prompt: "竖构图都市人像，玻璃幕墙倒影，冷调通勤感", type: "image", category: "portrait", ratio: "2:3", model: "织影 X" },
  { prompt: "超宽全景雪山脉络，晨雾横铺，2:1 大画幅", type: "image", category: "landscape", ratio: "2:1", model: "织影 X" },
  { prompt: "长竖海报 · 极简香水主视觉，留白与光斑", type: "image", category: "product", ratio: "1:2", model: "织影 · 商业设计" },
  { prompt: "横幅 banner · 抽象渐变光带，科技发布会主视觉", type: "image", category: "abstract", ratio: "3:1", model: "织影 · 商业设计" },
  { prompt: "竖长幅卷轴 · 山水层峦由近及远，工笔晕染", type: "image", category: "landscape", ratio: "1:3", model: "织影 X" },
  { prompt: "极致竖影 · 高塔仰望直入云端，9:21 沉浸构图", type: "image", category: "architecture", ratio: "9:21", model: "织影 X" },
];

export const GALLERY: MediaItem[] = SEEDS.map((s, i) => {
  const author = AUTHORS[i % AUTHORS.length];
  const sourceMode = demoSourceMode(i);
  const hasFirstFrame = s.type === "video" && sourceMode === "frames";
  const hasLastFrame = s.type === "video" && sourceMode === "frames" && i % 2 === 1;
  return {
    id: `m_${(i + 1).toString().padStart(3, "0")}`,
    type: s.type,
    seed: `gallery-${i}-${s.category}`,
    prompt: s.prompt,
    fullPrompt: buildFullPrompt(s),
    model: s.model,
    category: s.category,
    aspectRatio: s.ratio,
    author,
    likes: 120 + ((i * 37) % 880),
    createdAt: BASE - i * 1000 * 60 * 47,
    durationSec:
      s.type === "video"
        ? 4 + (i % 3) * 2
        : s.type === "audio"
          ? 8 + (i % 4) * 4
          : undefined,
    sourceMode,
    referenceCount: demoReferenceCount(sourceMode),
    hasFirstFrame,
    hasLastFrame,
    visibility: i % 3 === 0 ? "gallery" : "private",
    publishedAt: i % 3 === 0 ? BASE - i * 1000 * 60 * 40 : null,
    favoritedAt: i % 8 === 0 ? BASE - i * 1000 * 60 * 20 : null,
    downloadedAt: i % 6 === 0 ? BASE - i * 1000 * 60 * 15 : null,
  };
});

export function getGalleryByType(type?: MediaType): MediaItem[] {
  if (!type) return GALLERY;
  return GALLERY.filter((m) => m.type === type);
}

/**
 * 示例生成历史 —— 让图片/视频生成页打开即有内容。
 * 复用 GALLERY（固定 createdAt，避免水合不一致），标记为 demo。
 * 一条 job 可含多张结果，模拟「一次生成多图/多镜头」。
 */
export function buildDemoHistory(type: MediaType): GenerationJob[] {
  const pool = getGalleryByType(type).map((m) => ({ ...m, demo: true }));
  if (pool.length === 0) return [];

  // 按比例分组：image 拆多条任务（含多图与单图、覆盖多种比例）；video/audio 拆多条任务
  const groups: MediaItem[][] =
    type === "image"
      ? [
          pool.slice(0, 4),
          pool.slice(4, 5),
          pool.slice(18, 21),
          pool.slice(21, 23),
          pool.slice(23, 25),
        ]
      : type === "audio"
        ? [pool.slice(0, 1), pool.slice(1, 2), pool.slice(2, 3)]
      : [
          pool.slice(0, 2),
          pool.slice(2, 3),
          pool.slice(3, 5),
          pool.slice(5, 6),
          pool.slice(6, 8),
        ];

  return groups
    .filter((g) => g.length > 0)
    .map((results, gi) => {
      const head = results[0];
      return {
        id: `demo_${type}_${gi}`,
        type,
        status: "succeeded" as const,
        progress: 100,
        prompt: head.prompt,
        model: head.model,
        aspectRatio: head.aspectRatio,
        count: results.length,
        createdAt: head.createdAt,
        results,
        durationSec: head.durationSec,
        sourceMode: head.sourceMode,
        referenceCount: head.referenceCount,
        hasFirstFrame: head.hasFirstFrame,
        hasLastFrame: head.hasLastFrame,
      };
    });
}

/** 示例收藏 —— 我的作品「收藏」tab 占位，取点赞较高的若干条 */
export const DEMO_FAVORITES: MediaItem[] = [...GALLERY]
  .sort((a, b) => b.likes - a.likes)
  .slice(0, 6)
  .map((m, i) => ({ ...m, id: `fav_${i}`, demo: true }));
