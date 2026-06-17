"use client";

import * as React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, Sparkles, Wand2, Play, ImageOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { GridPattern } from "@/components/brand/backgrounds";
import { GradientThumb } from "@/components/brand/gradient-thumb";
import { listGallery } from "@/lib/api/client";
import { GALLERY } from "@/data/mock/gallery";

const SAMPLE_PROMPTS = [
  "霓虹雨夜的赛博都市，电影级广角",
  "东方水墨意境的孤舟与远山",
  "悬浮于云海之上的水晶城堡，黄昏暖光",
  "未来感银色金属妆容人像，杂志封面",
];

function MarqueeRow({
  items,
  reverse,
}: {
  items: typeof GALLERY;
  reverse?: boolean;
}) {
  return (
    <div className="flex mask-fade-x">
      <div
        className={`flex shrink-0 ${
          reverse ? "animate-marquee [animation-direction:reverse]" : "animate-marquee"
        }`}
        style={{ ["--marquee-duration" as string]: "55s" }}
      >
        {[...items, ...items].map((m, i) => (
          <div
            key={`${m.id}-${i}`}
            className="relative mr-4 h-44 w-32 shrink-0 overflow-hidden rounded-xl border border-border/50 sm:h-52 sm:w-40"
          >
            <GradientThumb seed={m.seed} className="h-full w-full">
              {m.type === "video" && (
                <span className="absolute right-2 top-2 grid h-6 w-6 place-items-center rounded-full bg-black/40 backdrop-blur">
                  <Play className="h-3 w-3 fill-white text-white" />
                </span>
              )}
            </GradientThumb>
          </div>
        ))}
      </div>
    </div>
  );
}

function EmptyGalleryMarquee() {
  return (
    <div className="mx-auto flex min-h-[220px] max-w-5xl flex-col items-center justify-center rounded-2xl border border-dashed border-border/70 bg-card/30 px-6 text-center">
      <span className="grid h-12 w-12 place-items-center rounded-xl bg-muted text-muted-foreground">
        <ImageOff className="h-5 w-5" />
      </span>
      <p className="mt-4 text-sm font-medium text-foreground">灵感广场暂无公开作品</p>
      <p className="mt-1 max-w-md text-xs leading-5 text-muted-foreground">
        发布到广场的作品会自动出现在这里。
      </p>
    </div>
  );
}

export function Hero() {
  const [promptIdx, setPromptIdx] = React.useState(0);
  const [gallery, setGallery] = React.useState<typeof GALLERY>([]);
  React.useEffect(() => {
    const t = setInterval(
      () => setPromptIdx((i) => (i + 1) % SAMPLE_PROMPTS.length),
      2800
    );
    return () => clearInterval(t);
  }, []);
  React.useEffect(() => {
    let alive = true;
    listGallery()
      .then((items) => {
        if (alive) setGallery(items);
      })
      .catch(() => {
        if (alive) setGallery([]);
      });
    return () => {
      alive = false;
    };
  }, []);

  // 每行用全部 24 张，单份宽度远超任何屏宽（含超宽屏），无缝不露白
  const rowA = gallery;
  const rowB = [...gallery].reverse();

  return (
    <section className="relative overflow-hidden pt-32 sm:pt-40">
      <GridPattern />

      <div className="mx-auto max-w-4xl px-4 text-center sm:px-6">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <Badge
            variant="outline"
            className="mb-6 gap-1.5 border-primary/30 bg-primary/5 py-1 pl-2 pr-3 text-primary"
          >
            <Sparkles className="h-3.5 w-3.5" />
            全新织影 X 模型 · 影视级画质上线
          </Badge>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.05 }}
          className="text-balance text-4xl font-bold leading-[1.1] tracking-tight sm:text-6xl md:text-7xl"
        >
          用一句话
          <span className="text-gradient">编织影像</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.12 }}
          className="mx-auto mt-6 max-w-2xl text-pretty text-base leading-relaxed text-muted-foreground sm:text-lg"
        >
          影织 Shadowweave 是面向创作者与品牌的专业级 AI 视觉平台。
          文生图、图生图、文生视频，一站完成从灵感到成片的全流程创作。
        </motion.p>

        {/* 模拟提示词输入条 */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.2 }}
          className="glow-border mx-auto mt-9 flex max-w-xl items-center gap-2 rounded-2xl border border-border bg-card/70 p-2 pl-4 shadow-xl backdrop-blur-xl"
        >
          <Wand2 className="h-5 w-5 shrink-0 text-primary" />
          <div className="flex-1 overflow-hidden text-left">
            <span className="text-sm text-muted-foreground">
              试试：
              <span className="text-foreground">
                {SAMPLE_PROMPTS[promptIdx]}
              </span>
              <span className="ml-0.5 inline-block h-4 w-0.5 animate-pulse bg-primary align-middle" />
            </span>
          </div>
          <Button asChild variant="brand" size="sm" className="shrink-0">
            <Link href="/studio/image">
              开始生成 <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.28 }}
          className="mt-8 flex flex-wrap items-center justify-center gap-x-8 gap-y-2 text-sm text-muted-foreground"
        >
          <span className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            已生成 1,200 万+ 作品
          </span>
          <span className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-brand-violet" />
            服务 35 万+ 创作者
          </span>
          <span className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-brand-cyan" />
            支持商用授权
          </span>
        </motion.div>
      </div>

      {/* 作品滚动墙 */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1, delay: 0.4 }}
        className="relative mt-16 space-y-4 sm:mt-20"
      >
        {gallery.length > 0 ? (
          <>
            <MarqueeRow items={rowA} />
            <MarqueeRow items={rowB} reverse />
          </>
        ) : (
          <EmptyGalleryMarquee />
        )}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-background to-transparent" />
      </motion.div>
    </section>
  );
}
