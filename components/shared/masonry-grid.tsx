"use client";

import * as React from "react";

/**
 * 按列分桶的瀑布流容器。
 * 卡片按位置固定分配到列：第 i 张进第 (i mod 列数) 列。
 * 宽屏 5 列时，1-5 是第一行、6-10 是第二行；
 * 每列内部卡片从上到下垂直紧贴堆叠 —— 6 紧贴 1 底、7 紧贴 2 底……
 * 行号严格不乱、无留白、保留完整比例不裁剪。
 *
 * 列数随容器宽自适应（ResizeObserver），窄屏自动降 4/3/2 列。
 * 是正常文档流，不存在 grid row-span 那种刷新瞬间覆盖闪烁的问题。
 */

const COL_WIDTH = 320; // 单列目标宽度（px）
const GAP = 16; // 卡片 / 列间距（px）

function computeCols(width: number): number {
  return Math.max(1, Math.floor((width + GAP) / (COL_WIDTH + GAP)));
}

export function MasonryGrid({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const ref = React.useRef<HTMLDivElement>(null);
  const [cols, setCols] = React.useState(0); // 0 = 尚未测量

  React.useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setCols(computeCols(el.clientWidth));
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const items = React.Children.toArray(children);

  // 按 round-robin 分到各列：第 i 张 -> 第 (i % cols) 列
  const buckets: React.ReactNode[][] = React.useMemo(() => {
    if (cols < 1) return [];
    const b: React.ReactNode[][] = Array.from({ length: cols }, () => []);
    items.forEach((child, i) => b[i % cols].push(child));
    return b;
  }, [items, cols]);

  return (
    <div
      ref={ref}
      className={className}
      style={{ display: "flex", gap: `${GAP}px`, alignItems: "flex-start" }}
    >
      {buckets.map((col, ci) => (
        <div
          key={ci}
          style={{
            flex: "1 1 0",
            minWidth: 0,
            display: "flex",
            flexDirection: "column",
            gap: `${GAP}px`,
          }}
        >
          {col}
        </div>
      ))}
    </div>
  );
}
