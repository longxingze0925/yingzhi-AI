"use client";

import * as React from "react";
import { Copy, Download, Grid3x3, LayoutGrid } from "lucide-react";
import { PageHeader } from "@/components/studio/page-header";
import { MediaCard } from "@/components/shared/media-card";
import { MasonryGrid } from "@/components/shared/masonry-grid";
import { MediaGridSkeleton } from "@/components/shared/media-grid-skeleton";
import { MediaDetailDialog } from "@/components/studio/media-detail-dialog";
import { Button } from "@/components/ui/button";
import {
  deleteWorkRemote,
  downloadWorkRemote,
  favoriteWorkRemote,
  listMyFavorites,
  listMyWorks,
} from "@/lib/api/client";
import { downloadMediaItem } from "@/lib/local-actions";
import { useLocalWorkspaceStore } from "@/lib/store/use-local-workspace";
import { PageContainer } from "@/components/studio/page-container";
import type { MediaItem } from "@/lib/api/types";
import { cn } from "@/lib/utils";

type AssetTab = "all" | "image" | "video" | "audio" | "fav";

function Grid({
  items,
  loading,
  onOpen,
  onDelete,
  onFavorite,
  favoriteIds,
  onDownload,
}: {
  items: MediaItem[];
  loading: boolean;
  onOpen: (m: MediaItem) => void;
  onDelete: (m: MediaItem) => void;
  onFavorite: (m: MediaItem) => void;
  favoriteIds: Set<string>;
  onDownload: (m: MediaItem) => void;
}) {
  if (loading) {
    return <MediaGridSkeleton count={8} />;
  }
  if (items.length === 0) {
    return (
      <div className="py-20 text-center text-sm text-muted-foreground">
        这里还没有作品，去
        <a href="/studio/image" className="mx-1 text-primary hover:underline">
          创作
        </a>
        一个吧
      </div>
    );
  }
  return (
    <MasonryGrid>
      {items.map((m) => (
        <MediaCard
          key={m.id}
          item={m}
          onClick={onOpen}
          onDelete={onDelete}
          onFavorite={onFavorite}
          onDownload={onDownload}
          favorited={favoriteIds.has(m.id)}
          showAuthor={false}
        />
      ))}
    </MasonryGrid>
  );
}

export default function AssetsPage() {
  const [works, setWorks] = React.useState<MediaItem[]>([]);
  const [favs, setFavs] = React.useState<MediaItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [tab, setTab] = React.useState<AssetTab>("all");
  const [selected, setSelected] = React.useState<MediaItem | null>(null);
  const [open, setOpen] = React.useState(false);
  const favoriteItems = useLocalWorkspaceStore((s) => s.favoriteItems);
  const isFavorite = useLocalWorkspaceStore((s) => s.isFavorite);
  const deletedWorkIds = useLocalWorkspaceStore((s) => s.deletedWorkIds);
  const setFavorite = useLocalWorkspaceStore((s) => s.setFavorite);
  const deleteWork = useLocalWorkspaceStore((s) => s.deleteWork);
  const markDownloaded = useLocalWorkspaceStore((s) => s.markDownloaded);
  const addNotification = useLocalWorkspaceStore((s) => s.addNotification);

  React.useEffect(() => {
    let alive = true;
    const fallbackTimer = window.setTimeout(() => {
      if (alive) setLoading(false);
    }, 10000);

    async function load() {
      setLoadError(null);
      try {
        const [worksData, favsData] = await Promise.all([
          listMyWorks(),
          listMyFavorites(),
        ]);
        if (!alive) return;
        setWorks(worksData);
        setFavs(favsData);
      } catch (err) {
        if (!alive) return;
        setWorks([]);
        setFavs([]);
        setLoadError(err instanceof Error ? err.message : "作品加载失败");
      } finally {
        if (alive) setLoading(false);
      }
    }

    load();
    return () => {
      alive = false;
      window.clearTimeout(fallbackTimer);
    };
  }, []);

  const onOpen = (m: MediaItem) => {
    setSelected(m);
    setOpen(true);
  };

  const visibleWorks = React.useMemo(
    () => works.filter((work) => !deletedWorkIds.includes(work.id)),
    [deletedWorkIds, works]
  );
  const visibleFavs = React.useMemo(() => {
    const merged = new Map<string, MediaItem>();
    favs
      .filter((item) => isFavorite(item))
      .forEach((item) => merged.set(item.id, item));
    Object.values(favoriteItems).forEach((item) => merged.set(item.id, item));
    deletedWorkIds.forEach((id) => merged.delete(id));
    return Array.from(merged.values());
  }, [deletedWorkIds, favoriteItems, favs, isFavorite]);
  const images = visibleWorks.filter((w) => w.type === "image");
  const videos = visibleWorks.filter((w) => w.type === "video");
  const audios = visibleWorks.filter((w) => w.type === "audio");
  const favoriteIds = React.useMemo(
    () =>
      new Set([
        ...favs.filter((item) => isFavorite(item)).map((item) => item.id),
        ...Object.keys(favoriteItems),
      ]),
    [favoriteItems, favs, isFavorite]
  );

  const deleteItem = async (item: MediaItem) => {
    try {
      await deleteWorkRemote(item.id);
      setWorks((items) => items.filter((work) => work.id !== item.id));
      setFavs((items) => items.filter((work) => work.id !== item.id));
      addNotification("作品已删除", item.prompt);
      deleteWork(item.id);
      if (selected?.id === item.id) {
        setOpen(false);
        setSelected(null);
      }
    } catch {
      addNotification("删除失败", "EntitleHub 删除接口返回失败，请稍后重试。");
    }
  };

  const favoriteItem = async (item: MediaItem) => {
    const currentlyFavorite = favoriteIds.has(item.id);
    try {
      const remoteWork = await favoriteWorkRemote(item.id, !currentlyFavorite);
      const updated = remoteWork ?? {
        ...item,
        favoritedAt: currentlyFavorite ? null : Date.now(),
      };
      setWorks((items) =>
        items.map((work) => (work.id === item.id ? { ...work, ...updated } : work))
      );
      setFavs((items) => {
        if (currentlyFavorite) {
          return items.filter((work) => work.id !== item.id);
        }
        const next = items.filter((work) => work.id !== item.id);
        return [updated, ...next];
      });
      setFavorite(updated, !currentlyFavorite);
      addNotification(
        currentlyFavorite ? "已取消收藏" : "已加入收藏",
        item.prompt
      );
    } catch {
      addNotification(
        currentlyFavorite ? "取消收藏失败" : "收藏失败",
        "EntitleHub 收藏接口返回失败，请稍后重试。"
      );
    }
  };

  const downloadItem = async (item: MediaItem) => {
    try {
      const result = await downloadWorkRemote(item.id);
      const nextItem = result.work ?? {
        ...item,
        downloadedAt: result.downloadedAt ?? Date.now(),
      };
      setWorks((items) =>
        items.map((work) => (work.id === item.id ? { ...work, ...nextItem } : work))
      );
      await downloadMediaItem(nextItem, result.downloadUrl);
      addNotification("作品已开始下载", item.prompt);
      markDownloaded(item.id);
    } catch {
      addNotification("下载失败", "EntitleHub 下载登记失败，请稍后重试。");
    }
  };

  const exportList = async () => {
    const payload = visibleWorks.map((item) => ({
      id: item.id,
      type: item.type,
      prompt: item.prompt,
      fullPrompt: item.fullPrompt,
      model: item.model,
      aspectRatio: item.aspectRatio,
      resolution: item.resolution,
      durationSec: item.durationSec,
      createdAt: new Date(item.createdAt).toISOString(),
    }));
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `shadowweave-works-${Date.now()}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    addNotification("作品清单已导出", `共导出 ${payload.length} 条作品元数据。`);
  };

  const copyAllPrompts = async () => {
    await navigator.clipboard.writeText(visibleWorks.map((item) => item.fullPrompt ?? item.prompt).join("\n\n---\n\n"));
    addNotification("提示词已复制", `共复制 ${visibleWorks.length} 条作品提示词。`);
  };

  const tabItems: Array<{
    value: AssetTab;
    label: string;
    icon?: React.ElementType;
    count: number;
  }> = [
    { value: "all", label: "全部", icon: LayoutGrid, count: visibleWorks.length },
    { value: "image", label: "图片", count: images.length },
    { value: "video", label: "视频", count: videos.length },
    { value: "audio", label: "音频", count: audios.length },
    { value: "fav", label: "收藏", icon: Grid3x3, count: visibleFavs.length },
  ];

  const currentItems =
    tab === "image"
      ? images
      : tab === "video"
        ? videos
        : tab === "audio"
          ? audios
        : tab === "fav"
          ? visibleFavs
          : visibleWorks;

  return (
    <PageContainer>
      <PageHeader title="我的作品" description="管理你生成的全部图片、视频与音频">
        <Button
          variant="outline"
          size="sm"
          onClick={() => void exportList()}
          disabled={visibleWorks.length === 0}
        >
          <Download className="h-4 w-4" /> 批量导出
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => void copyAllPrompts()}
          disabled={visibleWorks.length === 0}
        >
          <Copy className="h-4 w-4" /> 复制提示词
        </Button>
      </PageHeader>

      <div className="mt-6">
        <div className="inline-flex h-10 items-center justify-center rounded-lg bg-muted/60 p-1 text-muted-foreground">
          {tabItems.map((item) => {
            const Icon = item.icon;
            const active = tab === item.value;
            return (
              <button
                key={item.value}
                type="button"
                onClick={() => setTab(item.value)}
                className={cn(
                  "inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  active
                    ? "bg-background text-foreground shadow-sm"
                    : "hover:text-foreground"
                )}
              >
                {Icon && <Icon className="h-4 w-4" />}
                {item.label} {!loading && `(${item.count})`}
              </button>
            );
          })}
        </div>

        <div className="mt-4">
          {loadError && !loading ? (
            <div className="py-20 text-center text-sm text-destructive">
              我的作品加载失败：{loadError}
            </div>
          ) : (
            <Grid
              items={currentItems}
              loading={loading}
              onOpen={onOpen}
              onDelete={deleteItem}
              onFavorite={favoriteItem}
              onDownload={downloadItem}
              favoriteIds={favoriteIds}
            />
          )}
        </div>
      </div>

      <MediaDetailDialog item={selected} open={open} onOpenChange={setOpen} />
    </PageContainer>
  );
}
