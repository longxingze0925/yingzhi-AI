import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * studio 主区最大内容宽度 —— 全站宽度的唯一来源。
 * 1760 让 320px 列宽的作品网格在宽屏稳定排 5 列、不溢出到 6 列。
 * 普通浏览页用 <PageContainer>；带悬浮栏的生成页结构特殊，
 * 自写容器但直接引用此常量对齐，避免数值漂移。
 */
export const CONTENT_MAX_W = "max-w-[1760px]";

/**
 * 统一内容容器 —— 全站 studio 浏览页共用的宽度原语。
 * 满宽铺开，居中，宽度上限取 CONTENT_MAX_W。
 * 杜绝各页各写 max-w-7xl / 满宽 导致的宽度漂移。
 */
export function PageContainer({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "mx-auto w-full px-4 py-8 sm:px-6 lg:px-8",
        CONTENT_MAX_W,
        className
      )}
    >
      {children}
    </div>
  );
}

/**
 * 作品卡网格 —— 广场 / 我的作品 / 生成结果统一使用。
 * 目标卡宽 280px，列数随容器宽度自适应 → 各页列数自动一致。
 */
export const WORK_GRID =
  "grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(280px,1fr))]";

/** 素材小图网格 —— 轻量缩略图更密一档，目标卡宽 180px。 */
export const TILE_GRID =
  "grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(180px,1fr))]";
