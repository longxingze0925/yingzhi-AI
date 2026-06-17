"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Sparkles,
  Download,
  Copy,
  Check,
  Heart,
  Share2,
  Ratio,
  MonitorPlay,
  ImagePlus,
  Film,
  Music2,
  Globe2,
  Lock,
  Pencil,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { GradientThumb } from "@/components/brand/gradient-thumb";
import { ratioClass, ratioStyle } from "@/components/shared/media-card";
import {
  downloadMediaItem,
  shareMediaItem,
} from "@/lib/local-actions";
import {
  downloadWorkRemote,
  favoriteWorkRemote,
  publishWorkRemote,
  unpublishWorkRemote,
} from "@/lib/api/client";
import { useLocalWorkspaceStore } from "@/lib/store/use-local-workspace";
import { type MediaItem } from "@/lib/api/types";
import { cn } from "@/lib/utils";

export function MediaDetailDialog({
  item,
  open,
  onOpenChange,
}: {
  item: MediaItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [copied, setCopied] = React.useState(false);
  const [shared, setShared] = React.useState(false);
  const [downloaded, setDownloaded] = React.useState(false);
  const [published, setPublished] = React.useState(item?.visibility === "gallery");
  const [busyAction, setBusyAction] = React.useState<string | null>(null);
  const setFavorite = useLocalWorkspaceStore((s) => s.setFavorite);
  const isFavorite = useLocalWorkspaceStore((s) =>
    item ? s.isFavorite(item) : false
  );
  const markDownloaded = useLocalWorkspaceStore((s) => s.markDownloaded);
  const markShared = useLocalWorkspaceStore((s) => s.markShared);
  const addNotification = useLocalWorkspaceStore((s) => s.addNotification);

  React.useEffect(() => {
    if (!open) {
      setCopied(false);
      setShared(false);
      setDownloaded(false);
      setBusyAction(null);
    }
  }, [open]);

  React.useEffect(() => {
    setPublished(item?.visibility === "gallery");
  }, [item?.id, item?.visibility]);

  if (!item) return null;

  const fullPrompt = item.fullPrompt ?? item.prompt;
  const resolution =
    item.resolution?.toUpperCase() ??
    (item.type === "audio" ? "AUDIO" : item.type === "video" ? "720P" : "1K");

  // 预览区按朝向 contain：宽图限宽、高图限高（容器近似比例 0.85）
  const [rw, rh] = item.aspectRatio.split(":").map(Number);
  const fitClass = rw / rh >= 0.85 ? "w-full" : "h-full";
  const sourceLabels = [
    item.sourceMode === "image" ? "图生" : null,
    item.sourceMode === "video" ? "参考视频" : null,
    item.sourceMode === "audio" ? "参考音频" : null,
    item.sourceMode === "frames" ? "首尾帧" : null,
    item.referenceCount ? `${item.referenceCount} 个参考素材` : null,
    item.hasFirstFrame ? "首帧" : null,
    item.hasLastFrame ? "尾帧" : null,
  ].filter((label): label is string => Boolean(label));

  const usePrompt = () => {
    const target =
      item.type === "audio"
        ? "/studio/audio"
        : item.type === "video"
          ? "/studio/video"
          : "/studio/image";
    router.push(`${target}?prompt=${encodeURIComponent(fullPrompt)}`);
  };

  const editWithReference = () => {
    if (!item.assetId) {
      addNotification("无法编辑", "这个作品没有关联 EntitleHub 素材，不能自动填入参考。");
      return;
    }
    const target =
      item.type === "audio"
        ? "/studio/audio"
        : item.type === "video"
          ? "/studio/video"
          : "/studio/image";
    const params = new URLSearchParams({
      refAssetId: item.assetId,
      refKind: item.type,
      prompt: fullPrompt,
    });
    router.push(`${target}?${params.toString()}`);
  };

  const copyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(fullPrompt);
      setCopied(true);
      addNotification("提示词已复制", item.prompt);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* 剪贴板不可用时静默 */
    }
  };

  const shareItem = async () => {
    try {
      const result = await shareMediaItem(item);
      markShared(item.id);
      addNotification(
        result === "shared" ? "作品已分享" : "分享信息已复制",
        item.prompt
      );
      setShared(true);
      setTimeout(() => setShared(false), 1600);
    } catch {
      setShared(false);
    }
  };

  const downloadItem = async () => {
    setBusyAction("download");
    try {
      const result = await downloadWorkRemote(item.id);
      await downloadMediaItem(result.work ?? item, result.downloadUrl);
      markDownloaded(item.id);
      addNotification("作品已开始下载", item.prompt);
      setDownloaded(true);
      setTimeout(() => setDownloaded(false), 1600);
    } catch {
      addNotification("下载失败", "EntitleHub 下载登记失败，请稍后重试。");
    } finally {
      setBusyAction(null);
    }
  };

  const favoriteItem = async () => {
    setBusyAction("favorite");
    try {
      await favoriteWorkRemote(item.id, !isFavorite);
      setFavorite(item, !isFavorite);
      addNotification(isFavorite ? "已取消收藏" : "已加入收藏", item.prompt);
    } catch {
      addNotification(
        isFavorite ? "取消收藏失败" : "收藏失败",
        "EntitleHub 收藏接口返回失败，请稍后重试。"
      );
    } finally {
      setBusyAction(null);
    }
  };

  const togglePublish = async () => {
    setBusyAction("publish");
    try {
      if (published) {
        await unpublishWorkRemote(item.id);
        setPublished(false);
        addNotification("作品已取消发布", item.prompt);
      } else {
        await publishWorkRemote(item.id, [item.category, item.type]);
        setPublished(true);
        addNotification("作品已发布到灵感广场", item.prompt);
      }
    } catch {
      addNotification("发布状态更新失败", "请稍后重试，或确认 EntitleHub 发布接口配置。");
    } finally {
      setBusyAction(null);
    }
  };

  const metaInline = [
    item.type === "audio"
      ? { icon: Music2, value: "音频" }
      : { icon: Ratio, value: item.aspectRatio },
    { icon: MonitorPlay, value: resolution },
    { icon: Sparkles, value: item.model },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="h-[720px] max-h-[92vh] w-[1040px] max-w-[94vw] gap-0 overflow-hidden p-0">
        <DialogTitle className="sr-only">作品详情</DialogTitle>
        <div className="grid h-full grid-cols-1 md:grid-cols-[1.25fr_1fr]">
          {/* 预览：固定区域，模糊背景填充 + 原图按比例 contain 居中 */}
          <div className="relative hidden items-center justify-center overflow-hidden bg-muted/30 p-6 md:flex">
            {/* 模糊背景层：同 seed 放大模糊铺满 */}
            <div className="pointer-events-none absolute inset-0 scale-125 opacity-50 blur-2xl">
              <GradientThumb
                seed={item.seed}
                src={item.url}
                alt={item.prompt}
                mediaType={item.type}
                className="h-full w-full"
              />
            </div>
            {/* 前景清晰层：按比例 contain（宽图限宽、高图限高） */}
            <GradientThumb
              seed={item.seed}
              src={item.url}
              alt={item.prompt}
              mediaType={item.type}
              className={cn(
                ratioClass(item.aspectRatio),
                "relative max-h-full max-w-full rounded-xl shadow-2xl",
                fitClass
              )}
              style={ratioStyle(item.aspectRatio)}
            >
              {item.type === "audio" && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-5 p-6 text-white">
                  <span className="grid h-16 w-16 place-items-center rounded-full bg-black/30 backdrop-blur">
                    <Music2 className="h-7 w-7" />
                  </span>
                  {item.url && (
                    <audio
                      src={item.url}
                      controls
                      className="h-10 w-full max-w-[360px]"
                    />
                  )}
                </div>
              )}
            </GradientThumb>
          </div>

          {/* 信息 */}
          <div className="flex min-h-0 flex-col p-6">
            {/* 标题：提示词短句（右上角留给 ✕） */}
            <h2 className="line-clamp-2 pr-8 text-base font-semibold leading-snug">
              {item.prompt}
            </h2>

            {/* 元信息 + 分享/下载 同行 */}
            <div className="mt-2.5 flex items-center gap-x-3 text-xs text-muted-foreground">
              {metaInline.map((m, i) => (
                <span key={i} className="flex shrink-0 items-center gap-1">
                  <m.icon className="h-3.5 w-3.5" />
                  {m.value}
                </span>
              ))}
              <div className="ml-auto flex shrink-0 items-center gap-0.5">
                <button
                  onClick={shareItem}
                  className="grid h-7 w-7 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                  title={shared ? "已分享" : "分享"}
                >
                  {shared ? <Check className="h-4 w-4 text-emerald-500" /> : <Share2 className="h-4 w-4" />}
                </button>
                <button
                  onClick={downloadItem}
                  disabled={busyAction === "download"}
                  className="grid h-7 w-7 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                  title={downloaded ? "已开始下载" : "下载"}
                >
                  {downloaded ? <Check className="h-4 w-4 text-emerald-500" /> : <Download className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {sourceLabels.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {sourceLabels.map((label) => (
                  <span
                    key={label}
                    className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-card/40 px-2.5 text-xs text-muted-foreground"
                  >
                    {String(label).includes("音频") ? (
                      <Music2 className="h-3.5 w-3.5" />
                    ) : String(label).includes("视频") || String(label).includes("帧") ? (
                      <Film className="h-3.5 w-3.5" />
                    ) : (
                      <ImagePlus className="h-3.5 w-3.5" />
                    )}
                    {label}
                  </span>
                ))}
              </div>
            )}

            {/* 提示词主体 */}
            <div className="mt-5 flex min-h-0 flex-1 flex-col">
              <div className="flex min-h-0 flex-1 flex-col rounded-xl bg-muted/50">
                <pre className="min-h-0 flex-1 overflow-y-auto whitespace-pre-wrap p-3.5 font-mono text-[13px] leading-relaxed text-foreground/90">
                  {fullPrompt}
                </pre>
              </div>
            </div>

            {/* 底部操作：复制 / 收藏 并排 + 做同款独占一行 */}
            <div className="mt-5 space-y-2.5">
              <div className="flex gap-2.5">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={copyPrompt}
                >
                  {copied ? (
                    <>
                      <Check className="h-4 w-4" /> 已复制
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4" /> 复制
                    </>
                  )}
                </Button>
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={favoriteItem}
                  disabled={busyAction === "favorite"}
                >
                  <Heart className={cn("h-4 w-4", isFavorite && "fill-current text-rose-500")} />
                  {isFavorite ? "已收藏" : "收藏"}
                </Button>
              </div>
              <Button
                variant="outline"
                className="w-full"
                onClick={togglePublish}
                disabled={busyAction === "publish"}
              >
                {published ? (
                  <>
                    <Lock className="h-4 w-4" /> 取消发布
                  </>
                ) : (
                  <>
                    <Globe2 className="h-4 w-4" /> 发布到广场
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                className="w-full"
                onClick={editWithReference}
                disabled={!item.assetId}
              >
                <Pencil className="h-4 w-4" /> 编辑
              </Button>
              <Button variant="brand" className="w-full" onClick={usePrompt}>
                <Sparkles className="h-4 w-4" /> 用此提示词创作
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
