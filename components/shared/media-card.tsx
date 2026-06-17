"use client";

import * as React from "react";
import { Download, Heart, Music2, Play, Sparkles, Trash2 } from "lucide-react";
import { GradientThumb } from "@/components/brand/gradient-thumb";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { CATEGORY_LABELS, type MediaItem } from "@/lib/api/types";
import { cn, formatNumber } from "@/lib/utils";

const RATIO_CLASS: Record<string, string> = {
  "1:1": "aspect-square",
  "3:4": "aspect-[3/4]",
  "4:3": "aspect-[4/3]",
  "16:9": "aspect-video",
  "9:16": "aspect-[9/16]",
  "21:9": "aspect-[21/9]",
  "3:2": "aspect-[3/2]",
  "2:3": "aspect-[2/3]",
  "2:1": "aspect-[2/1]",
  "1:2": "aspect-[1/2]",
  "3:1": "aspect-[3/1]",
  "1:3": "aspect-[1/3]",
  "9:21": "aspect-[9/21]",
};

function ratioStyle(ratio: string): React.CSSProperties | undefined {
  const [w, h] = ratio.split(":").map(Number);
  if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) {
    return undefined;
  }
  return { aspectRatio: `${w} / ${h}` };
}

function ratioClass(ratio: string) {
  return RATIO_CLASS[ratio] ?? "";
}

export function MediaCard({
  item,
  className,
  onUsePrompt,
  onClick,
  onDownload,
  onFavorite,
  onDelete,
  favorited = false,
  showAuthor = true,
}: {
  item: MediaItem;
  className?: string;
  onUsePrompt?: (item: MediaItem) => void;
  onClick?: (item: MediaItem) => void;
  onDownload?: (item: MediaItem) => void;
  onFavorite?: (item: MediaItem) => void;
  onDelete?: (item: MediaItem) => void;
  favorited?: boolean;
  /** 是否在悬浮层显示作者与点赞（灵感广场设为 false，纯作品展示） */
  showAuthor?: boolean;
}) {
  const hasActions = onDownload || onFavorite || onDelete;

  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-2xl border border-border/60 bg-card",
        "transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:shadow-xl hover:shadow-brand-violet/10",
        className
      )}
    >
      <div
        role="button"
        tabIndex={0}
        onClick={() => onClick?.(item)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onClick?.(item);
          }
        }}
        className="block w-full cursor-pointer text-left"
      >
        <GradientThumb
          seed={item.seed}
          src={item.url}
          alt={item.prompt}
          mediaType={item.type}
          className={cn("w-full", ratioClass(item.aspectRatio))}
          style={ratioStyle(item.aspectRatio)}
        >
          {/* 类型标记 */}
          <div className="absolute left-3 top-3 flex items-center gap-1.5">
            {item.type === "video" ? (
              <Badge className="gap-1 bg-black/50 text-white backdrop-blur">
                <Play className="h-3 w-3 fill-current" />
                {item.durationSec}s
              </Badge>
            ) : item.type === "audio" ? (
              <Badge className="gap-1 bg-black/50 text-white backdrop-blur">
                <Music2 className="h-3 w-3" />
                {item.durationSec ? `${item.durationSec}s` : "音频"}
              </Badge>
            ) : (
              <Badge className="bg-black/40 text-white backdrop-blur">图片</Badge>
            )}
          </div>

          {hasActions && (
            <div className="absolute right-3 top-3 flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
              {onFavorite && (
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    onFavorite(item);
                  }}
                  className="grid h-7 w-7 place-items-center rounded-lg bg-black/35 text-white backdrop-blur transition-colors hover:bg-black/55"
                  title={favorited ? "取消收藏" : "收藏"}
                >
                  <Heart className={cn("h-3.5 w-3.5", favorited && "fill-current text-rose-300")} />
                </button>
              )}
              {onDownload && (
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    onDownload(item);
                  }}
                  className="grid h-7 w-7 place-items-center rounded-lg bg-black/35 text-white backdrop-blur transition-colors hover:bg-black/55"
                  title="下载"
                >
                  <Download className="h-3.5 w-3.5" />
                </button>
              )}
              {onDelete && (
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    onDelete(item);
                  }}
                  className="grid h-7 w-7 place-items-center rounded-lg bg-black/35 text-white backdrop-blur transition-colors hover:bg-destructive"
                  title="删除"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          )}

          {/* 视频中央播放钮 */}
          {item.type === "video" && (
            <div className="absolute inset-0 grid place-items-center">
              <span className="grid h-12 w-12 place-items-center rounded-full bg-white/15 backdrop-blur-md transition-transform duration-300 group-hover:scale-110">
                <Play className="h-5 w-5 translate-x-0.5 fill-white text-white" />
              </span>
            </div>
          )}
          {item.type === "audio" && (
            <div className="absolute inset-0 grid place-items-center">
              <span className="grid h-12 w-12 place-items-center rounded-full bg-white/15 backdrop-blur-md transition-transform duration-300 group-hover:scale-110">
                <Music2 className="h-5 w-5 text-white" />
              </span>
            </div>
          )}

          {/* hover 信息蒙层 */}
          <div className="absolute inset-x-0 bottom-0 translate-y-2 bg-gradient-to-t from-black/85 via-black/40 to-transparent p-3 pt-10 opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100">
            <p className="line-clamp-2 text-xs leading-relaxed text-white/90">
              {item.prompt}
            </p>
            {showAuthor && (
              <div className="mt-2 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Avatar className="h-5 w-5">
                    <AvatarFallback className="text-[9px]">
                      {item.author.name.slice(0, 1)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-[11px] text-white/80">
                    {item.author.name}
                  </span>
                </div>
                <span className="flex items-center gap-1 text-[11px] text-white/70">
                  <Heart className="h-3 w-3" />
                  {formatNumber(item.likes)}
                </span>
              </div>
            )}
          </div>
        </GradientThumb>
      </div>

      {/* 底部操作条 */}
      <div className="flex items-center justify-between gap-2 px-3 py-2.5">
        <Badge variant="muted" className="shrink-0">
          {CATEGORY_LABELS[item.category]}
        </Badge>
        <span className="truncate text-xs text-muted-foreground">
          {item.model}
        </span>
        {onUsePrompt && (
          <button
            type="button"
            onClick={() => onUsePrompt(item)}
            className="flex shrink-0 items-center gap-1 rounded-md px-1.5 py-1 text-xs font-medium text-primary transition-colors hover:bg-primary/10"
          >
            <Sparkles className="h-3 w-3" />
            用此提示词
          </button>
        )}
      </div>
    </div>
  );
}

export { RATIO_CLASS, ratioClass, ratioStyle };
