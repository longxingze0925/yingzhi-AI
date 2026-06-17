"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/studio/page-header";
import { PageContainer } from "@/components/studio/page-container";
import { MediaCard } from "@/components/shared/media-card";
import { MasonryGrid } from "@/components/shared/masonry-grid";
import { MediaGridSkeleton } from "@/components/shared/media-grid-skeleton";
import { MediaDetailDialog } from "@/components/studio/media-detail-dialog";
import { listGallery } from "@/lib/api/client";
import {
  CATEGORY_LABELS,
  type MediaCategory,
  type MediaItem,
  type MediaType,
} from "@/lib/api/types";
import { cn } from "@/lib/utils";

type TypeFilter = "all" | MediaType;
type CatFilter = "all" | MediaCategory;

const TYPE_FILTERS: { value: TypeFilter; label: string }[] = [
  { value: "all", label: "全部" },
  { value: "image", label: "图片" },
  { value: "video", label: "视频" },
  { value: "audio", label: "音频" },
];

const CAT_FILTERS: { value: CatFilter; label: string }[] = [
  { value: "all", label: "全部分类" },
  ...(Object.keys(CATEGORY_LABELS) as MediaCategory[]).map((c) => ({
    value: c,
    label: CATEGORY_LABELS[c],
  })),
];

export default function ExplorePage() {
  const router = useRouter();
  const [type, setType] = React.useState<TypeFilter>("all");
  const [cat, setCat] = React.useState<CatFilter>("all");
  const [gallery, setGallery] = React.useState<MediaItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [selected, setSelected] = React.useState<MediaItem | null>(null);
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    listGallery()
      .then((items) => {
        if (alive) setGallery(items);
      })
      .catch((err) => {
        if (alive) setGallery([]);
        if (alive) {
          setError(err instanceof Error ? err.message : "灵感广场加载失败");
        }
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  const items = React.useMemo(
    () =>
      gallery.filter(
        (m) =>
          (type === "all" || m.type === type) &&
          (cat === "all" || m.category === cat)
      ),
    [gallery, type, cat]
  );

  const openItem = (item: MediaItem) => {
    setSelected(item);
    setOpen(true);
  };

  const usePrompt = (item: MediaItem) => {
    const target =
      item.type === "audio"
        ? "/studio/audio"
        : item.type === "video"
          ? "/studio/video"
          : "/studio/image";
    const prompt = item.fullPrompt ?? item.prompt;
    router.push(`${target}?prompt=${encodeURIComponent(prompt)}`);
  };

  return (
    <PageContainer>
      <PageHeader
        title="灵感广场"
        description="探索社区精选作品，一键复用提示词开启创作"
      />

      {/* 筛选 —— 与工作台 chips 统一语言：同高、同圆角、同激活态 */}
      <div className="mt-6 flex flex-wrap items-center gap-2">
        {/* 类型 segmented */}
        <div className="flex rounded-lg border border-border bg-card/40 p-0.5">
          {TYPE_FILTERS.map((t) => (
            <button
              key={t.value}
              onClick={() => setType(t.value)}
              className={cn(
                "rounded-md px-3 py-1 text-xs font-medium transition-colors",
                type === t.value
                  ? "bg-brand-gradient text-white"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="mx-0.5 h-5 w-px bg-border/70" />

        {/* 分类 chips */}
        {CAT_FILTERS.map((c) => (
          <button
            key={c.value}
            onClick={() => setCat(c.value)}
            className={cn(
              "h-8 rounded-lg border px-3 text-xs font-medium transition-colors",
              cat === c.value
                ? "border-primary/40 bg-primary/10 text-primary"
                : "border-border bg-card/40 text-muted-foreground hover:text-foreground"
            )}
          >
            {c.label}
          </button>
        ))}
      </div>

      {/* 作品瀑布流 —— CSS columns 自适应，列宽与 WORK_GRID 的 280px 对齐 */}
      {loading ? (
        <MediaGridSkeleton className="mt-6" count={10} />
      ) : error ? (
        <div className="mt-20 text-center text-sm text-destructive">
          灵感广场加载失败：{error}
        </div>
      ) : items.length === 0 ? (
        <div className="mt-20 text-center text-muted-foreground">
          暂无符合条件的作品
        </div>
      ) : (
        <MasonryGrid className="mt-6">
          {items.map((item) => (
            <MediaCard
              key={item.id}
              item={item}
              onClick={openItem}
              onUsePrompt={usePrompt}
              showAuthor={false}
            />
          ))}
        </MasonryGrid>
      )}

      <MediaDetailDialog item={selected} open={open} onOpenChange={setOpen} />
    </PageContainer>
  );
}
