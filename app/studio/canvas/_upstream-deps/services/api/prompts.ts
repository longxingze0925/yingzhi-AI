export type Prompt = {
    id: string;
    title: string;
    coverUrl: string;
    prompt: string;
    tags: string[];
    category: string;
    githubUrl: string;
    preview: string;
    createdAt: string;
    updatedAt: string;
};

export const ALL_PROMPTS_OPTION = "全部";

export type PromptListResponse = {
    items: Prompt[];
    tags: string[];
    categories: string[];
    total: number;
};

const BUILT_IN_PROMPTS: Prompt[] = [
    createPrompt("portrait-cinema", "电影感人像", "人像", ["电影感", "人像", "光影"], "电影感近景人像，自然肤感，柔和侧逆光，浅景深，背景虚化，克制的色彩分级，真实镜头质感，人物眼神清晰，细节丰富。", "#2563eb"),
    createPrompt("product-studio", "高级产品广告", "产品", ["产品", "广告", "棚拍"], "高级产品广告摄影，主体居中，深色渐变背景，边缘轮廓光，柔和顶光，材质细节清晰，简洁构图，商业级精修，无文字无水印。", "#7c3aed"),
    createPrompt("landscape-concept", "史诗风景概念图", "场景", ["风景", "概念艺术", "大场景"], "广角史诗风景，远处山体和云海，黄金时刻体积光，前中后景层次分明，空气透视，尺度感强，电影级色彩，高细节。", "#059669"),
    createPrompt("storyboard-shot", "电影分镜画面", "分镜", ["分镜", "镜头", "叙事"], "电影分镜单帧，明确的人物调度和视线关系，前景遮挡增加空间层次，主体在三分线交点，光线引导视线，统一色调，适合后续镜头连续性。", "#ea580c"),
    createPrompt("video-camera", "平滑运镜视频", "视频", ["视频", "运镜", "电影感"], "镜头从中景缓慢推进主体，运动平滑稳定，主体动作自然，环境微风和光影变化连续，保持人物外观、空间方向和色调一致，无突变无闪烁。", "#0891b2"),
    createPrompt("product-turntable", "产品环绕展示", "视频", ["产品", "视频", "环绕运镜"], "产品保持在画面中心，摄像机以恒定速度环绕主体，棚拍灯光稳定，高光沿材质表面平滑移动，尺寸和结构不变形，背景简洁，商业广告质感。", "#db2777"),
    createPrompt("voice-narration", "温暖纪录片旁白", "音频", ["旁白", "纪录片", "温暖"], "使用温暖、沉稳、自然的纪录片旁白语气朗读。语速稍慢，停顿清晰，情绪克制而有感染力，发音清楚，不夸张，保留真实的呼吸感。", "#ca8a04"),
    createPrompt("script-ad", "15 秒产品短片脚本", "文案", ["脚本", "广告", "短片"], "为产品撰写 15 秒竖屏广告脚本，按照“前 3 秒吸引注意—核心卖点演示—使用场景—明确行动号召”编排，输出镜头、画面、旁白和时长。", "#475569"),
];

export async function fetchPrompts({ keyword = "", tag = [], category = ALL_PROMPTS_OPTION, page = 1, pageSize = 20 }: { keyword?: string; tag?: string[]; category?: string; page?: number; pageSize?: number } = {}): Promise<PromptListResponse> {
    const normalizedKeyword = keyword.trim().toLowerCase();
    const filtered = BUILT_IN_PROMPTS.filter((item) => {
        if (category !== ALL_PROMPTS_OPTION && item.category !== category) return false;
        if (tag.length && !tag.every((value) => item.tags.includes(value))) return false;
        if (!normalizedKeyword) return true;
        return `${item.title}\n${item.prompt}\n${item.tags.join(" ")}`.toLowerCase().includes(normalizedKeyword);
    });
    const safePage = Math.max(1, Math.floor(page));
    const safePageSize = Math.max(1, Math.floor(pageSize));
    const start = (safePage - 1) * safePageSize;
    return {
        items: filtered.slice(start, start + safePageSize),
        tags: Array.from(new Set(BUILT_IN_PROMPTS.flatMap((item) => item.tags))),
        categories: Array.from(new Set(BUILT_IN_PROMPTS.map((item) => item.category))),
        total: filtered.length,
    };
}

export function formatPromptDate(value: string) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "" : new Intl.DateTimeFormat("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

function createPrompt(id: string, title: string, category: string, tags: string[], prompt: string, color: string): Prompt {
    const date = "2026-10-04T00:00:00.000Z";
    const cover = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${color}"/><stop offset="1" stop-color="#111827"/></linearGradient></defs><rect width="800" height="600" fill="url(#g)"/><circle cx="650" cy="120" r="180" fill="white" opacity=".08"/><circle cx="120" cy="520" r="220" fill="white" opacity=".06"/><text x="56" y="500" fill="white" font-family="sans-serif" font-size="48" font-weight="700">${title}</text></svg>`;
    return { id, title, coverUrl: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(cover)}`, prompt, tags, category, githubUrl: "", preview: prompt, createdAt: date, updatedAt: date };
}
