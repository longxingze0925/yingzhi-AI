"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  Loader2,
  AlertCircle,
  X,
  Download,
  Share2,
  Heart,
  Sparkles,
  Scissors,
  Pencil,
  Copy,
  Trash2,
  Play,
  Clock,
  Maximize2,
  RotateCw,
  Music2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { GradientThumb } from "@/components/brand/gradient-thumb";
import { LogoMark } from "@/components/brand/logo";
import { ratioClass, ratioStyle } from "@/components/shared/media-card";
import {
  copyMediaPrompt,
  downloadMediaItem,
  shareMediaItem,
} from "@/lib/local-actions";
import { downloadWorkRemote, favoriteWorkRemote } from "@/lib/api/client";
import { useLocalWorkspaceStore } from "@/lib/store/use-local-workspace";
import type { GenerationJob, MediaItem } from "@/lib/api/types";
import { cn } from "@/lib/utils";

function fmtTime(ts: number) {
  const d = new Date(ts);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${mm}/${dd} ${hh}:${mi}`;
}

function resolutionLabel(item: { type: string; resolution?: string }) {
  if (item.resolution) return item.resolution.toUpperCase();
  if (item.type === "audio") return "AUDIO";
  return item.type === "video" ? "720P" : "1K";
}

function typeLabel(type: string) {
  if (type === "audio") return "音频";
  if (type === "video") return "视频";
  return "图片";
}

/** 卡片外壳 */
function CardShell({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "group flex flex-col overflow-hidden rounded-xl border border-border/60 bg-card/40 transition-colors hover:border-border",
        className
      )}
    >
      {children}
    </div>
  );
}

/** 头部：时间 + 模型 + 状态 */
function CardHeader({
  time,
  model,
  status,
}: {
  time: number;
  model: string;
  status: "succeeded" | "running" | "queued" | "failed";
}) {
  const statusMap = {
    succeeded: { label: "已完成", cls: "bg-emerald-500/15 text-emerald-500", icon: Check },
    running: { label: "生成中", cls: "bg-primary/15 text-primary", icon: Loader2 },
    queued: { label: "排队中", cls: "bg-amber-500/15 text-amber-500", icon: Clock },
    failed: { label: "失败", cls: "bg-destructive/15 text-destructive", icon: AlertCircle },
  }[status];
  const Icon = statusMap.icon;
  return (
    <div className="flex items-center gap-2 px-2.5 py-2 text-xs">
      <span className="font-mono text-muted-foreground">{fmtTime(time)}</span>
      <span className="truncate font-medium text-foreground/80">{model}</span>
      <span
        className={cn(
          "ml-auto flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 font-medium",
          statusMap.cls
        )}
      >
        <Icon className={cn("h-3 w-3", status === "running" && "animate-spin")} />
        {statusMap.label}
      </span>
    </div>
  );
}

/** 元信息行：比例 / 时长 / 分辨率 + 下载分享 */
function MetaRow({
  item,
  muted,
  onDownload,
  onShare,
}: {
  item: { type: string; aspectRatio: string; durationSec?: number; resolution?: string };
  muted?: boolean;
  onDownload?: () => void;
  onShare?: () => void;
}) {
  return (
    <div className="flex items-center gap-3 px-2.5 pb-1.5 text-[11px] text-muted-foreground">
      {item.type !== "audio" ? (
        <span className="flex items-center gap-1">
          <Maximize2 className="h-3 w-3" />
          {item.aspectRatio}
        </span>
      ) : (
        <span className="flex items-center gap-1">
          <Music2 className="h-3 w-3" />
          {typeLabel(item.type)}
        </span>
      )}
      {(item.type === "video" || item.type === "audio") && item.durationSec && (
        <span className="flex items-center gap-1">
          <Clock className="h-3 w-3" />
          {item.durationSec}s
        </span>
      )}
      <span>{resolutionLabel(item)}</span>
      {!muted && (
        <span className="ml-auto flex items-center gap-1.5 opacity-0 transition-opacity group-hover:opacity-100">
          <button
            onClick={onDownload}
            className="transition-colors hover:text-foreground"
            aria-label="下载"
            title="下载"
          >
            <Download className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={onShare}
            className="transition-colors hover:text-foreground"
            aria-label="分享"
            title="分享"
          >
            <Share2 className="h-3.5 w-3.5" />
          </button>
        </span>
      )}
    </div>
  );
}

/** 提示词行：头像 + 文本 */
function PromptRow({ prompt }: { prompt: string }) {
  return (
    <div className="flex items-start gap-2 px-2.5 pb-2">
      <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded bg-brand-gradient text-[8px] text-white">
        <Sparkles className="h-2.5 w-2.5" />
      </span>
      <p className="line-clamp-2 text-[11px] leading-relaxed text-muted-foreground">
        {prompt}
      </p>
    </div>
  );
}

/** 已完成作品卡 */
export function WorkCard({
  item,
  onOpen,
  onDelete,
}: {
  item: MediaItem;
  onOpen?: (item: MediaItem) => void;
  onDelete?: (item: MediaItem) => void;
}) {
  const router = useRouter();
  const setFavorite = useLocalWorkspaceStore((s) => s.setFavorite);
  const isFavorite = useLocalWorkspaceStore((s) => s.isFavorite(item));
  const markDownloaded = useLocalWorkspaceStore((s) => s.markDownloaded);
  const markShared = useLocalWorkspaceStore((s) => s.markShared);
  const addNotification = useLocalWorkspaceStore((s) => s.addNotification);
  const [copied, setCopied] = React.useState(false);

  const handleCopy = async () => {
    try {
      await copyMediaPrompt(item);
      setCopied(true);
      addNotification("提示词已复制", item.prompt);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      setCopied(false);
    }
  };

  const handleShare = async () => {
    try {
      const result = await shareMediaItem(item);
      markShared(item.id);
      addNotification(
        result === "shared" ? "作品已分享" : "分享信息已复制",
        item.prompt
      );
    } catch {
      /* 用户取消系统分享时无需提示 */
    }
  };

  const handleDownload = async () => {
    try {
      const result = await downloadWorkRemote(item.id);
      await downloadMediaItem(result.work ?? item, result.downloadUrl);
      markDownloaded(item.id);
      addNotification("作品已开始下载", item.prompt);
    } catch {
      addNotification("下载失败", "EntitleHub 下载登记失败，请稍后重试。");
    }
  };

  const handleFavorite = async () => {
    try {
      await favoriteWorkRemote(item.id, !isFavorite);
      setFavorite(item, !isFavorite);
      addNotification(isFavorite ? "已取消收藏" : "已加入收藏", item.prompt);
    } catch {
      addNotification(
        isFavorite ? "取消收藏失败" : "收藏失败",
        "EntitleHub 收藏接口返回失败，请稍后重试。"
      );
    }
  };

  const handleEdit = () => {
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
      prompt: item.fullPrompt ?? item.prompt,
    });
    router.push(`${target}?${params.toString()}`);
  };

  return (
    <CardShell>
      <CardHeader time={item.createdAt} model={item.model} status="succeeded" />
      <MetaRow
        item={item}
        onDownload={() => void handleDownload()}
        onShare={() => void handleShare()}
      />
      <PromptRow prompt={item.prompt} />

      {/* 媒体 */}
      <button
        type="button"
        onClick={() => onOpen?.(item)}
        className="relative block"
      >
        <GradientThumb
          seed={item.seed}
          src={item.url}
          alt={item.prompt}
          mediaType={item.type}
          className={cn("w-full", ratioClass(item.aspectRatio))}
          style={ratioStyle(item.aspectRatio)}
        >
          {item.type === "video" && (
            <span className="absolute inset-0 grid place-items-center">
              <span className="grid h-11 w-11 place-items-center rounded-full bg-black/40 backdrop-blur-md transition-transform group-hover:scale-110">
                <Play className="h-4 w-4 translate-x-0.5 fill-white text-white" />
              </span>
            </span>
          )}
          {item.type === "audio" && (
            <span className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-4 text-white">
              <span className="grid h-12 w-12 place-items-center rounded-full bg-black/35 backdrop-blur-md transition-transform group-hover:scale-110">
                <Music2 className="h-5 w-5" />
              </span>
              {item.url && (
                <audio
                  src={item.url}
                  controls
                  className="h-8 w-[82%] min-w-0"
                  onClick={(event) => event.stopPropagation()}
                />
              )}
            </span>
          )}
          {/* 水印 */}
          <span className="absolute bottom-2 right-2 grid h-5 w-5 place-items-center rounded bg-black/30 backdrop-blur">
            <LogoMark className="h-3 w-3 text-white/80" />
          </span>
          {/* 示例占位角标 */}
          {item.demo && (
            <span className="absolute left-2 top-2 rounded bg-black/30 px-1.5 py-0.5 text-[10px] font-medium text-white/90 backdrop-blur">
              示例
            </span>
          )}
        </GradientThumb>
      </button>

      {/* 操作条 */}
      <div className="flex items-center gap-0.5 px-1.5 py-1.5 text-muted-foreground">
        <button
          onClick={() => void handleFavorite()}
          title={isFavorite ? "取消收藏" : "收藏"}
          className={cn(
            "grid h-7 w-7 place-items-center rounded-md transition-colors hover:bg-accent hover:text-foreground",
            isFavorite && "text-rose-500"
          )}
        >
          <Heart className={cn("h-3.5 w-3.5", isFavorite && "fill-current")} />
        </button>
        {[
          { icon: Maximize2, label: "高清放大" },
          { icon: Scissors, label: "剪辑" },
        ].map((a) => (
          <button
            key={a.label}
            disabled
            title={`${a.label}暂未开放`}
            className="grid h-7 w-7 place-items-center rounded-md disabled:cursor-not-allowed disabled:opacity-50"
          >
            <a.icon className="h-3.5 w-3.5" />
          </button>
        ))}
        <button
          onClick={handleEdit}
          disabled={!item.assetId}
          aria-label="编辑"
          title={item.assetId ? "编辑" : "缺少参考素材，无法编辑"}
          className="grid h-7 w-7 place-items-center rounded-md transition-colors hover:bg-accent hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent disabled:hover:text-muted-foreground"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
        <div className="ml-auto flex items-center gap-0.5">
          <button
            onClick={handleCopy}
            title={copied ? "已复制" : "复制提示词"}
            className="grid h-7 w-7 place-items-center rounded-md transition-colors hover:bg-accent hover:text-foreground"
          >
            {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
          </button>
          <button
            onClick={() => onDelete?.(item)}
            title="删除"
            className="grid h-7 w-7 place-items-center rounded-md transition-colors hover:bg-destructive/10 hover:text-destructive"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </CardShell>
  );
}

/** 生成中 / 排队中 占位卡 */
export function PendingCard({
  job,
  onCancel,
}: {
  job: GenerationJob;
  onCancel: (id: string) => void;
}) {
  const status = job.status === "queued" ? "queued" : "running";
  return (
    <CardShell>
      <CardHeader time={job.createdAt} model={job.model} status={status} />
      <MetaRow item={job} muted />
      <PromptRow prompt={job.prompt} />
      <div
        className={cn("relative", ratioClass(job.aspectRatio))}
        style={ratioStyle(job.aspectRatio)}
      >
        <Skeleton className="h-full w-full rounded-none" />
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-4">
          <Loader2 className="h-6 w-6 animate-spin text-primary/70" />
          <span className="text-xs text-muted-foreground">
            {job.status === "queued" ? "正在排队…" : "正在编织影像…"}
          </span>
          <div className="w-full max-w-[80%]">
            <Progress value={job.progress} className="h-1" />
          </div>
          <span className="text-[11px] text-muted-foreground">{job.progress}%</span>
        </div>
      </div>
      <div className="flex items-center justify-end px-1.5 py-1.5">
        <button
          onClick={() => onCancel(job.id)}
          className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
          title="取消"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </CardShell>
  );
}

/** 失败卡 */
export function FailedCard({
  job,
  onRetry,
}: {
  job: GenerationJob;
  onRetry?: (id: string) => void;
}) {
  return (
    <CardShell className="border-destructive/30">
      <CardHeader time={job.createdAt} model={job.model} status="failed" />
      <MetaRow item={job} muted />
      <PromptRow prompt={job.prompt} />
      <div
        className={cn(
          "grid place-items-center bg-destructive/5",
          ratioClass(job.aspectRatio)
        )}
        style={ratioStyle(job.aspectRatio)}
      >
        <div className="flex flex-col items-center gap-2 p-4 text-center">
          <AlertCircle className="h-6 w-6 text-destructive" />
          <span className="text-xs text-muted-foreground">{job.error}</span>
          <Button
            variant="outline"
            size="sm"
            className="mt-1"
            onClick={() => onRetry?.(job.id)}
          >
            <RotateCw className="h-3.5 w-3.5" /> 重试
          </Button>
        </div>
      </div>
    </CardShell>
  );
}
