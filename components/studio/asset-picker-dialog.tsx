"use client";

import * as React from "react";
import { Check, Film, ImagePlus, Loader2, Music2, Upload } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { GradientThumb } from "@/components/brand/gradient-thumb";
import { listAssets } from "@/lib/api/client";
import {
  validateAssetAgainstModel,
  validateFileAgainstModel,
  type ReferenceAssetKind,
} from "@/lib/model-capabilities";
import type { AssetItem, AssetsLibrary, ModelCapabilities } from "@/lib/api/types";
import { cn } from "@/lib/utils";

type AssetPickerType = "image" | "video" | "audio";

const EMPTY_LIBRARY: AssetsLibrary = {
  folders: [],
  materials: [],
};

const SOURCE_FILTERS = [
  { value: "all", label: "全部资产" },
  { value: "upload", label: "上传资产" },
  { value: "ai", label: "AI 生成" },
  { value: "digital-human", label: "数字人" },
  { value: "product", label: "商品" },
] as const;

type SourceFilter = (typeof SOURCE_FILTERS)[number]["value"];

function assetMatchesType(asset: AssetItem, type: AssetPickerType) {
  const kind = asset.kind?.toLowerCase();
  const mimeType = asset.mimeType?.toLowerCase() ?? "";
  if (type === "image") {
    return kind === "image" || mimeType.startsWith("image/");
  }
  if (type === "video") {
    return kind === "video" || mimeType.startsWith("video/");
  }
  return kind === "audio" || mimeType.startsWith("audio/");
}

function assetMatchesSource(asset: AssetItem, source: SourceFilter) {
  if (source === "all") return true;
  const value =
    `${asset.source ?? ""} ${asset.sourceAlias ?? ""} ${asset.role ?? ""} ${asset.folderId ?? ""}`.toLowerCase();
  if (source === "upload") {
    return value.includes("upload") || value.includes("reference");
  }
  if (source === "ai") {
    return value.includes("ai") || value.includes("generate");
  }
  if (source === "digital-human") {
    return value.includes("digital") || value.includes("human") || value.includes("avatar");
  }
  return value.includes("product");
}

function assetMatchesOwner(asset: AssetItem, onlyMine: boolean) {
  if (!onlyMine) return true;
  const value = `${asset.source ?? ""} ${asset.role ?? ""}`.toLowerCase();
  return !value.includes("gallery") && !value.includes("public");
}

function formatDuration(asset: AssetItem) {
  const seconds = asset.durationSec ?? asset.durationSeconds ?? asset.duration;
  if (!seconds || seconds <= 0) return null;
  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  return mins > 0 ? `${mins}:${String(secs).padStart(2, "0")}` : `${secs}s`;
}

function assetStatusLabel(status?: string | null) {
  if (!status || status === "ready") return null;
  if (status === "processing") return "处理中";
  if (status === "uploading") return "上传中";
  if (status === "failed") return "处理失败";
  if (status === "deleted") return "已删除";
  return status;
}

function formatFileSize(bytes?: number | null) {
  if (!bytes || bytes <= 0) return null;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)}KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}

function fileMatchesType(file: File, type: AssetPickerType) {
  if (type === "image") return file.type.startsWith("image/");
  if (type === "video") return file.type.startsWith("video/");
  return file.type.startsWith("audio/");
}

export function AssetPickerDialog({
  open,
  type,
  selectedAssetId,
  capabilities,
  onOpenChange,
  onSelectAsset,
  onUploadFile,
}: {
  open: boolean;
  type: AssetPickerType;
  selectedAssetId?: string | null;
  capabilities?: ModelCapabilities;
  onOpenChange: (open: boolean) => void;
  onSelectAsset: (asset: AssetItem) => void;
  onUploadFile: (file: File) => void;
}) {
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const [library, setLibrary] = React.useState<AssetsLibrary>(EMPTY_LIBRARY);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [localError, setLocalError] = React.useState<string | null>(null);
  const [sourceFilter, setSourceFilter] = React.useState<SourceFilter>("all");
  const [onlyMine, setOnlyMine] = React.useState(false);
  const [dragActive, setDragActive] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    let alive = true;
    setLoading(true);
    setError(null);
    listAssets({
      kind: type,
      source: sourceFilter === "all" ? undefined : sourceFilter,
      page: 1,
      pageSize: 100,
    })
      .then((nextLibrary) => {
        if (alive) setLibrary(nextLibrary);
      })
      .catch((err) => {
        if (!alive) return;
        setLibrary(EMPTY_LIBRARY);
        setError(err instanceof Error ? err.message : "素材加载失败");
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [open, sourceFilter, type]);

  React.useEffect(() => {
    if (open) {
      setSourceFilter("all");
      setLocalError(null);
      setDragActive(false);
    }
  }, [open, type]);

  const typedAssets = React.useMemo(
    () => library.materials.filter((asset) => assetMatchesType(asset, type)),
    [library.materials, type]
  );

  const visibleAssets = React.useMemo(
    () =>
      typedAssets.filter(
        (asset) =>
          assetMatchesSource(asset, sourceFilter) && assetMatchesOwner(asset, onlyMine)
      ),
    [onlyMine, sourceFilter, typedAssets]
  );

  const title =
    type === "image" ? "选择参考图片" : type === "video" ? "选择参考视频" : "选择参考音频";
  const uploadText =
    type === "image" ? "从本地上传图片" : type === "video" ? "从本地上传视频" : "从本地上传音频";
  const dropText =
    type === "image" ? "松开以上传图片" : type === "video" ? "松开以上传视频" : "松开以上传音频";
  const emptyText =
    type === "image" ? "图片" : type === "video" ? "视频" : "音频";
  const accept =
    type === "image" ? "image/*" : type === "video" ? "video/*" : "audio/*";
  const Icon = type === "image" ? ImagePlus : type === "video" ? Film : Music2;
  const kind = type as ReferenceAssetKind;
  const uploadDisabledReason =
    type === "image" && capabilities?.maxReferenceImages === 0
      ? "当前模型不支持参考图片"
      : type === "video" && capabilities?.maxReferenceVideos === 0
        ? "当前模型不支持参考视频"
        : type === "audio" && capabilities?.maxReferenceAudios === 0
          ? "当前模型不支持参考音频"
          : null;
  const handleUploadFile = React.useCallback(
    (file: File) => {
      if (!fileMatchesType(file, type)) {
        setLocalError(`请上传${emptyText}文件`);
        return;
      }

      const error = validateFileAgainstModel(file, kind, capabilities);
      if (!error) {
        setLocalError(null);
        onUploadFile(file);
      } else {
        setLocalError(error);
      }
    },
    [capabilities, emptyText, kind, onUploadFile, type]
  );
  const handleUploadDrop = React.useCallback(
    (event: React.DragEvent<HTMLButtonElement>) => {
      event.preventDefault();
      setDragActive(false);
      if (uploadDisabledReason) {
        setLocalError(uploadDisabledReason);
        return;
      }

      const files = Array.from(event.dataTransfer.files);
      if (files.length === 0) return;
      if (files.length > 1) {
        setLocalError("当前仅支持选择 1 个素材");
        return;
      }

      handleUploadFile(files[0]);
    },
    [handleUploadFile, uploadDisabledReason]
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="h-[min(620px,calc(100vh-56px))] w-[min(1080px,calc(100vw-32px))] max-w-none overflow-hidden rounded-2xl border-border bg-popover/95 p-0 text-foreground shadow-2xl backdrop-blur-xl">
        <div className="flex h-full flex-col">
          <div className="flex h-12 shrink-0 items-center gap-3 border-b border-border/70 px-4">
            <span className="grid h-6 w-6 place-items-center rounded-md bg-muted text-muted-foreground">
              <Icon className="h-3.5 w-3.5" />
            </span>
            <DialogTitle className="text-sm font-semibold">{title}</DialogTitle>
            <DialogDescription className="sr-only">
              从素材资产库选择一个{emptyText}素材，或从本地上传。
            </DialogDescription>
          </div>

          <div className="flex min-h-0 flex-1 flex-col gap-4 p-4 sm:flex-row">
            <button
              type="button"
              disabled={Boolean(uploadDisabledReason)}
              title={uploadDisabledReason ?? (dragActive ? dropText : uploadText)}
              onClick={() => inputRef.current?.click()}
              onDragEnter={(event) => {
                event.preventDefault();
                if (!uploadDisabledReason) setDragActive(true);
              }}
              onDragOver={(event) => {
                event.preventDefault();
                event.dataTransfer.dropEffect = uploadDisabledReason ? "none" : "copy";
                if (!uploadDisabledReason) setDragActive(true);
              }}
              onDragLeave={(event) => {
                event.preventDefault();
                const nextTarget = event.relatedTarget;
                if (!(nextTarget instanceof Node) || !event.currentTarget.contains(nextTarget)) {
                  setDragActive(false);
                }
              }}
              onDrop={handleUploadDrop}
              className={cn(
                "flex min-h-36 w-full shrink-0 flex-col items-center justify-center gap-3 rounded-xl border border-dashed bg-background/40 px-5 text-center text-sm text-muted-foreground transition-colors hover:border-primary/50 hover:bg-primary/5 hover:text-primary disabled:cursor-not-allowed disabled:opacity-55 disabled:hover:border-border disabled:hover:bg-background/40 disabled:hover:text-muted-foreground sm:h-full sm:w-56 lg:w-60",
                dragActive
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border"
              )}
            >
              <span className="grid h-12 w-12 place-items-center rounded-full bg-muted">
                <Upload className="h-5 w-5" />
              </span>
              <span className="max-w-40 leading-5">
                {dragActive ? dropText : uploadText}
              </span>
            </button>
            <input
              ref={inputRef}
              type="file"
              accept={accept}
              className="hidden"
              onChange={(event) => {
                const file = event.currentTarget.files?.[0] ?? null;
                if (file) handleUploadFile(file);
                event.currentTarget.value = "";
              }}
            />

            <div className="flex min-w-0 flex-1 flex-col">
              <div className="mb-3 flex min-h-8 shrink-0 flex-wrap items-center gap-2">
                {SOURCE_FILTERS.map((filter) => (
                  <button
                    key={filter.value}
                    type="button"
                    onClick={() => setSourceFilter(filter.value)}
                    className={cn(
                      "flex h-8 shrink-0 items-center justify-center rounded-lg px-2.5 text-xs transition-colors",
                      sourceFilter === filter.value
                        ? "bg-accent text-foreground"
                        : "text-muted-foreground hover:bg-accent/70 hover:text-foreground"
                    )}
                  >
                    {filter.label}
                  </button>
                ))}
                <label className="ml-auto flex h-8 shrink-0 items-center gap-2 text-xs text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={onlyMine}
                    onChange={(event) => setOnlyMine(event.currentTarget.checked)}
                    className="h-3.5 w-3.5 rounded border-border bg-background"
                  />
                  只看我的
                </label>
                <Badge variant="muted" className="h-6 shrink-0 rounded-md px-2 text-[11px]">
                  {selectedAssetId ? 1 : 0}/1
                </Badge>
              </div>
              {localError && (
                <p className="mb-2 shrink-0 rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                  {localError}
                </p>
              )}

              <div className="min-h-0 flex-1 overflow-hidden rounded-xl bg-background/20">
                {loading ? (
                  <div className="flex h-full items-center justify-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    正在加载素材
                  </div>
                ) : error ? (
                  <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center text-sm text-muted-foreground">
                    <p className="font-medium text-foreground">素材加载失败</p>
                    <p className="max-w-md text-xs leading-5">{error}</p>
                  </div>
                ) : visibleAssets.length === 0 ? (
                  <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-sm text-muted-foreground">
                    <span className="grid h-10 w-10 place-items-center rounded-full bg-muted">
                      <Icon className="h-5 w-5" />
                    </span>
                    <p>暂无可用{emptyText}素材</p>
                  </div>
                ) : (
                  <ScrollArea className="h-full">
                    <div className="grid grid-cols-3 gap-2 p-0.5 sm:grid-cols-4 lg:grid-cols-6">
                      {visibleAssets.map((asset) => {
                        const selected = asset.id === selectedAssetId;
                        const duration = formatDuration(asset);
                        const fileSize = formatFileSize(asset.fileSize);
                        const statusLabel = assetStatusLabel(asset.status);
                        const disabledReason = validateAssetAgainstModel(
                          asset,
                          kind,
                          capabilities
                        );
                        const selectable = !disabledReason;
                        return (
                          <button
                            key={asset.id}
                            type="button"
                            disabled={!selectable}
                            onClick={() => {
                              if (selectable) onSelectAsset(asset);
                            }}
                            title={disabledReason ?? asset.name}
                            className={cn(
                              "group relative overflow-hidden rounded-lg border bg-card text-left transition-colors",
                              selected
                                ? "border-primary ring-1 ring-primary"
                                : "border-border/60 hover:border-primary/50",
                              !selectable &&
                                "cursor-not-allowed opacity-60 hover:border-border/60"
                            )}
                          >
                            <GradientThumb
                              seed={asset.seed || asset.id}
                              src={asset.thumbnailUrl ?? asset.url}
                              alt={asset.name}
                              mediaType={type}
                              className="aspect-square w-full"
                            >
                              {type !== "image" && (
                                <span className="absolute left-1.5 top-1.5 grid h-6 w-6 place-items-center rounded-md bg-black/45 text-white backdrop-blur">
                                  <Icon className="h-3.5 w-3.5" />
                                </span>
                              )}
                              {selected && (
                                <span className="absolute right-1.5 top-1.5 grid h-6 w-6 place-items-center rounded-full bg-primary text-primary-foreground">
                                  <Check className="h-3.5 w-3.5" />
                                </span>
                              )}
                              {(duration || fileSize) && (
                                <span className="absolute bottom-1.5 left-1.5 rounded bg-black/55 px-1.5 py-0.5 text-[10px] font-medium text-white">
                                  {duration ?? fileSize}
                                </span>
                              )}
                              {(statusLabel || disabledReason) && (
                                <span className="absolute bottom-1.5 right-1.5 rounded bg-black/65 px-1.5 py-0.5 text-[10px] font-medium text-white">
                                  {statusLabel ?? "不可用"}
                                </span>
                              )}
                            </GradientThumb>
                            <div className="px-2 py-1.5">
                              <p className="truncate text-[11px] text-muted-foreground">
                                {asset.name}
                              </p>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </ScrollArea>
                )}
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
