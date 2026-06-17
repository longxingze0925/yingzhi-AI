"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, ImageOff } from "lucide-react";
import { Reveal } from "@/components/shared/reveal";
import { MediaCard } from "@/components/shared/media-card";
import { Button } from "@/components/ui/button";
import { listGallery } from "@/lib/api/client";
import { GALLERY } from "@/data/mock/gallery";

export function ShowcaseWall() {
  const [gallery, setGallery] = React.useState<typeof GALLERY>([]);

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

  // 取部分作品分三列瀑布流
  const items = gallery.slice(0, 15);
  const columns: typeof items[] = [[], [], []];
  items.forEach((item, i) => columns[i % 3].push(item));

  return (
    <section className="relative py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <Reveal className="flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-end">
          <div className="max-w-xl">
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-primary">
              Gallery
            </p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
              来自社区的
              <span className="text-gradient">无限灵感</span>
            </h2>
            <p className="mt-4 text-muted-foreground">
              探索创作者们用影织生成的作品，一键复用提示词，开启你的创作。
            </p>
          </div>
          <Button asChild variant="outline" className="shrink-0">
            <Link href="/studio/explore">
              进入灵感广场 <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </Reveal>

        {items.length > 0 ? (
          <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {columns.map((col, ci) => (
              <div key={ci} className="flex flex-col gap-4">
                {col.map((item) => (
                  <MediaCard key={item.id} item={item} showAuthor={false} />
                ))}
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-12 flex min-h-[260px] flex-col items-center justify-center rounded-2xl border border-dashed border-border/70 bg-card/30 px-6 text-center">
            <span className="grid h-12 w-12 place-items-center rounded-xl bg-muted text-muted-foreground">
              <ImageOff className="h-5 w-5" />
            </span>
            <p className="mt-4 text-sm font-medium text-foreground">灵感广场暂无公开作品</p>
            <p className="mt-1 max-w-md text-xs leading-5 text-muted-foreground">
              当用户发布作品后，这里会展示真实的公开作品。
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
