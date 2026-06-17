"use client";

import { PenLine, SlidersHorizontal, Sparkles, Download } from "lucide-react";
import { Reveal, RevealStagger, RevealItem } from "@/components/shared/reveal";

const STEPS = [
  {
    icon: PenLine,
    step: "01",
    title: "描述你的想法",
    desc: "用自然语言写下你想要的画面，或上传一张参考图作为起点。",
  },
  {
    icon: SlidersHorizontal,
    step: "02",
    title: "选择模型与风格",
    desc: "挑选合适的生成模型、画面比例与风格预设，精细调节参数。",
  },
  {
    icon: Sparkles,
    step: "03",
    title: "一键生成",
    desc: "提交后实时查看生成进度，秒级至分钟级获得多张高质量候选。",
  },
  {
    icon: Download,
    step: "04",
    title: "导出与商用",
    desc: "高清放大、批量导出，专业版作品可直接用于商业项目。",
  },
];

export function Workflow() {
  return (
    <section id="workflow" className="relative py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <Reveal className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-primary">
            Workflow
          </p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
            四步，从灵感到<span className="text-gradient">成片</span>
          </h2>
          <p className="mt-4 text-muted-foreground">
            极致顺滑的创作流程，让你专注表达，把繁琐交给影织。
          </p>
        </Reveal>

        <RevealStagger className="relative mt-16 grid gap-6 md:grid-cols-4">
          {/* 连接线 */}
          <div className="pointer-events-none absolute left-0 right-0 top-7 hidden h-px bg-gradient-to-r from-transparent via-border to-transparent md:block" />
          {STEPS.map((s) => (
            <RevealItem key={s.step}>
              <div className="relative flex flex-col items-center text-center">
                <div className="relative grid h-14 w-14 place-items-center rounded-2xl border border-border bg-card shadow-sm">
                  <s.icon className="h-6 w-6 text-primary" />
                  <span className="absolute -right-2 -top-2 grid h-6 w-6 place-items-center rounded-full bg-brand-gradient text-[10px] font-bold text-white">
                    {s.step}
                  </span>
                </div>
                <h3 className="mt-5 font-semibold">{s.title}</h3>
                <p className="mt-2 max-w-[15rem] text-sm leading-relaxed text-muted-foreground">
                  {s.desc}
                </p>
              </div>
            </RevealItem>
          ))}
        </RevealStagger>
      </div>
    </section>
  );
}
