"use client";

import { MasonryGrid } from "@/components/shared/masonry-grid";
import { Skeleton } from "@/components/ui/skeleton";

const SKELETON_RATIOS = [
  "aspect-[3/4]",
  "aspect-[4/3]",
  "aspect-[1/1]",
  "aspect-[16/9]",
  "aspect-[9/16]",
  "aspect-[3/4]",
  "aspect-[4/3]",
  "aspect-[1/1]",
];

export function MediaGridSkeleton({
  count = 8,
  className,
}: {
  count?: number;
  className?: string;
}) {
  return (
    <MasonryGrid className={className}>
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton
          key={i}
          className={`${SKELETON_RATIOS[i % SKELETON_RATIOS.length]} w-full rounded-2xl`}
        />
      ))}
    </MasonryGrid>
  );
}
