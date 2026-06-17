"use client";

import {
  ImageIcon,
  Video,
  Layers,
  Maximize2,
  Palette,
  ShieldCheck,
  Wand2,
  Gauge,
} from "lucide-react";
import { Reveal, RevealStagger, RevealItem } from "@/components/shared/reveal";

const FEATURES = [
  {
    icon: ImageIcon,
    title: "文生图 · 图生图",
    desc: "一句话直出高清画面，或上传参考图进行风格迁移、扩图与重绘。",
  },
  {
    icon: Video,
    title: "文生视频 · 图生视频",
    desc: "由文字或首帧生成影视级动态视频，支持运镜与时长控制。",
  },
  {
    icon: Palette,
    title: "丰富风格模型",
    desc: "电影质感、东方水墨、赛博朋克、3D 渲染等数十种预设风格随心切换。",
  },
  {
    icon: Maximize2,
    title: "高清放大",
    desc: "一键将作品放大至 4K，细节锐利，满足印刷与大屏投放需求。",
  },
  {
    icon: Gauge,
    title: "极速出图",
    desc: "Turbo 模型秒级响应，优先队列让专业用户的创作永不等待。",
  },
  {
    icon: Layers,
    title: "批量与工作流",
    desc: "一次生成多张候选，配合素材资产库管理你的全部创作资产。",
  },
  {
    icon: ShieldCheck,
    title: "商用授权",
    desc: "专业版及以上作品支持商业使用授权，放心用于品牌与产品。",
  },
  {
    icon: Wand2,
    title: "智能提示词",
    desc: "内置提示词灵感与优化建议，新手也能写出专业级 Prompt。",
  },
];

export function Features() {
  return (
    <section id="features" className="relative py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <Reveal className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-primary">
            Capabilities
          </p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
            一个平台，覆盖全部
            <span className="text-gradient">视觉创作</span>
          </h2>
          <p className="mt-4 text-muted-foreground">
            从静态图片到动态视频，从灵感构思到成片交付，影织提供端到端的专业能力。
          </p>
        </Reveal>

        <RevealStagger className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((f) => (
            <RevealItem key={f.title}>
              <div className="group h-full rounded-2xl border border-border/60 bg-card/50 p-6 transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:bg-card hover:shadow-lg hover:shadow-brand-violet/5">
                <div className="grid h-11 w-11 place-items-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-brand-gradient group-hover:text-white">
                  <f.icon className="h-5 w-5" />
                </div>
                <h3 className="mt-4 font-semibold">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {f.desc}
                </p>
              </div>
            </RevealItem>
          ))}
        </RevealStagger>
      </div>
    </section>
  );
}
