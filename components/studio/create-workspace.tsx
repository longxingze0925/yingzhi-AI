"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/studio/page-header";
import {
  DEFAULT_WORK_FILTERS,
  WorkToolbar,
  type WorkFilterOptions,
} from "@/components/studio/work-toolbar";
import { GenerationGallery } from "@/components/studio/generation-gallery";
import { PromptDock } from "@/components/studio/prompt-dock";
import { CONTENT_MAX_W } from "@/components/studio/page-container";
import { cn } from "@/lib/utils";
import type { MediaType } from "@/lib/api/types";

const PAGE_META: Record<MediaType, { title: string; description: string }> = {
  image: { title: "图片生成", description: "文生图 / 图生图，描述画面即可生成作品" },
  video: { title: "视频生成", description: "文生视频 / 图生视频，描述画面内容与运镜" },
  audio: { title: "音频生成", description: "文生音频 / 参考音频，描述声音、音色与节奏" },
};

function WorkspaceInner({ type }: { type: MediaType }) {
  const searchParams = useSearchParams();
  const initialPrompt = searchParams.get("prompt") ?? "";
  const initialReferenceAssetId = searchParams.get("refAssetId");
  const initialReferenceKind = searchParams.get("refKind");

  const [tab, setTab] = React.useState<"history" | "example">("history");
  const [search, setSearch] = React.useState("");
  const [filters, setFilters] = React.useState(DEFAULT_WORK_FILTERS);
  const [filterOptions, setFilterOptions] = React.useState<WorkFilterOptions>({
    models: [],
    resolutions: [],
    sourceModes: [],
    frameStates: [],
    hasDownloadMetadata: false,
  });

  const meta = PAGE_META[type];

  return (
    <div className="relative flex h-full flex-col">
      {/* 标题 → 操作行 → 内容网格：与浏览页共用 CONTENT_MAX_W，宽度单一来源 */}
      <div className="flex-1 overflow-y-auto">
        <div
          className={cn(
            "mx-auto w-full px-4 py-8 pb-48 sm:px-6 lg:px-8",
            CONTENT_MAX_W
          )}
        >
          <PageHeader title={meta.title} description={meta.description} />
          <div className="mt-6">
            <WorkToolbar
              type={type}
              tab={tab}
              onTab={setTab}
              search={search}
              onSearch={setSearch}
              filters={filters}
              onFiltersChange={setFilters}
              filterOptions={filterOptions}
            />
          </div>
          <div className="mt-6">
            <GenerationGallery
              type={type}
              tab={tab}
              search={search}
              filters={filters}
              onFilterOptionsChange={setFilterOptions}
            />
          </div>
        </div>
      </div>

      {/* 底部悬浮提示词栏 */}
      <PromptDock
        type={type}
        initialPrompt={initialPrompt}
        initialReferenceAssetId={initialReferenceAssetId}
        initialReferenceKind={initialReferenceKind}
      />
    </div>
  );
}

export function CreateWorkspace({ type }: { type: MediaType }) {
  return (
    <React.Suspense
      fallback={<div className="p-6 text-muted-foreground">加载中…</div>}
    >
      <WorkspaceInner type={type} />
    </React.Suspense>
  );
}
