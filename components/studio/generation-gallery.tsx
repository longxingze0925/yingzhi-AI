"use client";

import * as React from "react";
import { Sparkles } from "lucide-react";
import {
  WorkCard,
  PendingCard,
  FailedCard,
} from "@/components/studio/work-card";
import { MediaDetailDialog } from "@/components/studio/media-detail-dialog";
import { MasonryGrid } from "@/components/shared/masonry-grid";
import { MediaGridSkeleton } from "@/components/shared/media-grid-skeleton";
import { useGenerationStore } from "@/lib/store/use-generation-store";
import { useLocalWorkspaceStore } from "@/lib/store/use-local-workspace";
import { deleteWorkRemote, listGallery } from "@/lib/api/client";
import type { GenerationJob, MediaItem, MediaType, SourceMode } from "@/lib/api/types";
import type {
  WorkFilterOptions,
  WorkFilters,
} from "@/components/studio/work-toolbar";

type Entry =
  | { kind: "pending"; job: GenerationJob; key: string }
  | { kind: "failed"; job: GenerationJob; key: string }
  | { kind: "done"; item: MediaItem; key: string };

const SOURCE_MODE_LABELS: Record<SourceMode, string> = {
  text: "文生",
  image: "图生",
  video: "参考视频",
  audio: "参考音频",
  frames: "首尾帧",
};

function sourceModeLabel(mode?: SourceMode | null) {
  return mode ? SOURCE_MODE_LABELS[mode] : undefined;
}

export function GenerationGallery({
  type,
  tab,
  search,
  filters,
  onFilterOptionsChange,
}: {
  type: MediaType;
  tab: "history" | "example";
  search: string;
  filters: WorkFilters;
  onFilterOptionsChange?: (options: WorkFilterOptions) => void;
}) {
  const jobs = useGenerationStore((s) => s.jobs);
  const historyLoaded = useGenerationStore((s) => s.historyLoaded);
  const historyError = useGenerationStore((s) => s.historyError);
  const loadHistory = useGenerationStore((s) => s.loadHistory);
  const cancel = useGenerationStore((s) => s.cancel);
  const retry = useGenerationStore((s) => s.retry);
  const removeResult = useGenerationStore((s) => s.removeResult);
  const deletedWorkIds = useLocalWorkspaceStore((s) => s.deletedWorkIds);
  const downloadedWorkIds = useLocalWorkspaceStore((s) => s.downloadedWorkIds);
  const deleteWork = useLocalWorkspaceStore((s) => s.deleteWork);
  const addNotification = useLocalWorkspaceStore((s) => s.addNotification);
  const [selected, setSelected] = React.useState<MediaItem | null>(null);
  const [open, setOpen] = React.useState(false);
  const [examples, setExamples] = React.useState<MediaItem[]>([]);
  const [examplesLoading, setExamplesLoading] = React.useState(true);
  const [examplesError, setExamplesError] = React.useState<string | null>(null);

  const openItem = (item: MediaItem) => {
    setSelected(item);
    setOpen(true);
  };

  const deleteItem = async (item: MediaItem) => {
    try {
      await deleteWorkRemote(item.id);
      addNotification("作品已删除", item.prompt);
      deleteWork(item.id);
      removeResult(item.id);
      if (selected?.id === item.id) {
        setOpen(false);
        setSelected(null);
      }
    } catch {
      addNotification("删除失败", "EntitleHub 删除接口返回失败，请稍后重试。");
    }
  };

  React.useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  React.useEffect(() => {
    let alive = true;
    setExamplesLoading(true);
    setExamplesError(null);
    listGallery(type)
      .then((items) => {
        if (alive) setExamples(items);
      })
      .catch((err) => {
        if (alive) setExamples([]);
        if (alive) {
          setExamplesError(err instanceof Error ? err.message : "示例作品加载失败");
        }
      })
      .finally(() => {
        if (alive) setExamplesLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [type]);

  // 把任务铺平成卡片条目（最新在前）
  const entries: Entry[] = React.useMemo(() => {
    if (tab === "example") {
      return examples
        .filter((item) => !deletedWorkIds.includes(item.id))
        .map((item) => ({
          kind: "done" as const,
          item,
          key: item.id,
        }));
    }
    const list: Entry[] = [];
    jobs
      .filter((j) => j.type === type)
      .forEach((job) => {
        if (job.status === "queued" || job.status === "running") {
          list.push({ kind: "pending", job, key: job.id });
        } else if (job.status === "failed") {
          list.push({ kind: "failed", job, key: job.id });
        } else {
          job.results
            .filter((item) => !deletedWorkIds.includes(item.id))
            .forEach((item) =>
              list.push({ kind: "done", item, key: item.id })
            );
        }
      });
    return list;
  }, [deletedWorkIds, examples, jobs, tab, type]);

  const filterOptions = React.useMemo<WorkFilterOptions>(() => {
    const models = new Set<string>();
    const resolutions = new Set<string>();
    const sourceModes = new Set<string>();
    const frameStates = new Set<string>();
    let hasDownloadMetadata = false;

    entries.forEach((entry) => {
      const source = entry.kind === "done" ? entry.item : entry.job;
      if (source.model) models.add(source.model);
      if (source.resolution) resolutions.add(source.resolution.toUpperCase());
      const sourceLabel = sourceModeLabel(source.sourceMode);
      if (sourceLabel) sourceModes.add(sourceLabel);
      if (source.hasFirstFrame) frameStates.add("有首帧");
      if (source.hasLastFrame) frameStates.add("有尾帧");
      if (
        entry.kind === "done" &&
        (entry.item.downloadedAt || downloadedWorkIds.includes(entry.item.id))
      ) {
        hasDownloadMetadata = true;
      }
    });

    return {
      models: Array.from(models).sort((a, b) => a.localeCompare(b, "zh-Hans-CN")),
      resolutions: Array.from(resolutions).sort(),
      sourceModes: Array.from(sourceModes),
      frameStates: Array.from(frameStates),
      hasDownloadMetadata,
    };
  }, [downloadedWorkIds, entries]);

  React.useEffect(() => {
    onFilterOptionsChange?.(filterOptions);
  }, [filterOptions, onFilterOptionsChange]);

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    return entries.filter((e) => {
      const source = e.kind === "done" ? e.item : e.job;
      const resolution = source.resolution?.toUpperCase() ?? "";
      const searchable = [
        source.prompt,
        source.model,
        source.aspectRatio,
        resolution,
      ]
        .join(" ")
        .toLowerCase();
      const matchesSearch = !q || searchable.includes(q);
      const matchesModel =
        filters.model === "全部模型" || source.model === filters.model;
      const matchesResolution =
        filters.resolution === "全部清晰度" ||
        resolution === filters.resolution;
      const sourceLabel = sourceModeLabel(source.sourceMode);
      const matchesRef =
        filters.ref === "全部" || sourceLabel === filters.ref;
      const matchesFrame =
        filters.frame === "全部" ||
        (filters.frame === "有首帧" && Boolean(source.hasFirstFrame)) ||
        (filters.frame === "有尾帧" && Boolean(source.hasLastFrame));
      const downloaded =
        e.kind === "done" &&
        (Boolean(e.item.downloadedAt) || downloadedWorkIds.includes(e.item.id));
      const matchesDownload =
        filters.download === "全部" ||
        (filters.download === "已下载" && downloaded) ||
        (filters.download === "未下载" && !downloaded);

      return (
        matchesSearch &&
        matchesModel &&
        matchesResolution &&
        matchesRef &&
        matchesFrame &&
        matchesDownload
      );
    });
  }, [
    downloadedWorkIds,
    entries,
    filters.download,
    filters.frame,
    filters.model,
    filters.ref,
    filters.resolution,
    search,
  ]);

  const hasActiveFilters =
    search.trim().length > 0 ||
    filters.model !== "全部模型" ||
    filters.resolution !== "全部清晰度" ||
    filters.ref !== "全部" ||
    filters.frame !== "全部" ||
    filters.download !== "全部";
  const loading = tab === "history" ? !historyLoaded : examplesLoading;
  const loadError = tab === "history" ? historyError : examplesError;

  if (loading) {
    return <MediaGridSkeleton count={8} />;
  }

  if (loadError) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
        <div className="relative grid h-20 w-20 place-items-center rounded-3xl bg-destructive/5">
          <Sparkles className="relative h-9 w-9 text-destructive" />
        </div>
        <h3 className="mt-6 text-lg font-semibold">
          {tab === "history" ? "生成历史加载失败" : "示例作品加载失败"}
        </h3>
        <p className="mt-2 max-w-sm text-sm text-muted-foreground">
          {loadError}
        </p>
      </div>
    );
  }

  if (filtered.length === 0) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
        <div className="relative grid h-20 w-20 place-items-center rounded-3xl bg-primary/5">
          <div className="absolute inset-0 rounded-3xl bg-brand-gradient opacity-15 blur-xl" />
          <Sparkles className="relative h-9 w-9 text-primary" />
        </div>
        <h3 className="mt-6 text-lg font-semibold">
          {hasActiveFilters
            ? "没有匹配的作品"
            : `开始你的${type === "audio" ? "音频" : type === "video" ? "视频" : "图片"}创作`}
        </h3>
        <p className="mt-2 max-w-sm text-sm text-muted-foreground">
          {hasActiveFilters
            ? "试试其他关键词或筛选条件"
            : "在下方输入提示词、选择模型与比例，点击生成，作品会在这里持续沉淀。"}
        </p>
      </div>
    );
  }

  return (
    <>
      <MasonryGrid>
        {filtered.map((e) =>
          e.kind === "pending" ? (
            <PendingCard key={e.key} job={e.job} onCancel={cancel} />
          ) : e.kind === "failed" ? (
            <FailedCard key={e.key} job={e.job} onRetry={retry} />
          ) : (
            <WorkCard
              key={e.key}
              item={e.item}
              onOpen={openItem}
              onDelete={(item) => void deleteItem(item)}
            />
          )
        )}
      </MasonryGrid>
      <MediaDetailDialog item={selected} open={open} onOpenChange={setOpen} />
    </>
  );
}
