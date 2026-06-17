"use client";

import * as React from "react";
import { ChevronDown, Search, CheckSquare } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { MediaType } from "@/lib/api/types";

export interface WorkFilters {
  model: string;
  resolution: string;
  ref: string;
  frame: string;
  download: string;
}

export interface WorkFilterOptions {
  models: string[];
  resolutions: string[];
  sourceModes: string[];
  frameStates: string[];
  hasDownloadMetadata: boolean;
}

export const DEFAULT_WORK_FILTERS: WorkFilters = {
  model: "全部模型",
  resolution: "全部清晰度",
  ref: "全部",
  frame: "全部",
  download: "全部",
};

interface FilterDef {
  key: keyof WorkFilters;
  label: string;
  options: string[];
  disabled?: boolean;
}

function FilterChip({
  def,
  value,
  onChange,
}: {
  def: FilterDef;
  value: string;
  onChange: (v: string) => void;
}) {
  const active = value !== def.options[0];
  const disabled = def.disabled || def.options.length <= 1;
  const button = (
    <button
      disabled={disabled}
      title={
        disabled
          ? def.disabled
            ? `当前作品没有${def.label}元数据`
            : `暂无${def.label}可筛选项`
          : undefined
      }
      className={cn(
        "flex h-8 items-center gap-1 rounded-lg border px-2.5 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50",
        active
          ? "border-primary/40 bg-primary/10 text-primary"
          : "border-border bg-card/40 text-muted-foreground hover:text-foreground"
      )}
    >
      {active ? value : def.label}
      <ChevronDown className="h-3.5 w-3.5" />
    </button>
  );

  if (disabled) return button;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {button}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-[8rem]">
        {def.options.map((opt) => (
          <DropdownMenuItem key={opt} onClick={() => onChange(opt)}>
            {opt}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function WorkToolbar({
  type,
  tab,
  onTab,
  search,
  onSearch,
  filters,
  onFiltersChange,
  filterOptions = {
    models: [],
    resolutions: [],
    sourceModes: [],
    frameStates: [],
    hasDownloadMetadata: false,
  },
}: {
  type: MediaType;
  tab: "history" | "example";
  onTab: (t: "history" | "example") => void;
  search: string;
  onSearch: (v: string) => void;
  filters: WorkFilters;
  onFiltersChange: (filters: WorkFilters) => void;
  filterOptions?: WorkFilterOptions;
}) {
  const isVideo = type === "video";
  const filterDefs = React.useMemo<FilterDef[]>(
    () => {
      const defs: FilterDef[] = [];

      if (filterOptions.models.length > 1) {
        defs.push({
          key: "model",
          label: "模型",
          options: ["全部模型", ...filterOptions.models],
        });
      }

      if (filterOptions.resolutions.length > 1) {
        defs.push({
          key: "resolution",
          label: "清晰度",
          options: ["全部清晰度", ...filterOptions.resolutions],
        });
      }

      if (filterOptions.sourceModes.length > 1) {
        defs.push({
          key: "ref",
          label: "输入来源",
          options: ["全部", ...filterOptions.sourceModes],
        });
      }

      if (isVideo && filterOptions.frameStates.length > 1) {
        defs.push({
          key: "frame",
          label: "首尾帧",
          options: ["全部", ...filterOptions.frameStates],
        });
      }

      if (filterOptions.hasDownloadMetadata) {
        defs.push({
          key: "download",
          label: "是否下载",
          options: ["全部", "已下载", "未下载"],
        });
      }

      return defs;
    },
    [
      filterOptions.frameStates,
      filterOptions.hasDownloadMetadata,
      filterOptions.models,
      filterOptions.resolutions,
      filterOptions.sourceModes,
      isVideo,
    ]
  );

  React.useEffect(() => {
    const next = { ...filters };
    let changed = false;
    const activeKeys = new Set(filterDefs.map((def) => def.key));

    (Object.keys(DEFAULT_WORK_FILTERS) as Array<keyof WorkFilters>).forEach(
      (key) => {
        if (!activeKeys.has(key) && next[key] !== DEFAULT_WORK_FILTERS[key]) {
          next[key] = DEFAULT_WORK_FILTERS[key];
          changed = true;
        }
      }
    );

    for (const def of filterDefs) {
      if (!def.options.includes(next[def.key])) {
        next[def.key] = def.options[0];
        changed = true;
      }
    }
    if (changed) onFiltersChange(next);
  }, [filterDefs, filters, onFiltersChange]);

  const hasActiveFilters =
    search.trim().length > 0 ||
    Object.entries(filters).some(([key, value]) => {
      const def = filterDefs.find((item) => item.key === key);
      return Boolean(def && value !== def.options[0]);
    });

  const resetFilters = () => {
    onSearch("");
    onFiltersChange(DEFAULT_WORK_FILTERS);
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* 历史 / 示例 */}
      <div className="flex rounded-lg border border-border bg-card/40 p-0.5">
        {(["history", "example"] as const).map((t) => (
          <button
            key={t}
            onClick={() => onTab(t)}
            className={cn(
              "rounded-md px-3 py-1 text-xs font-medium transition-colors",
              tab === t
                ? "bg-brand-gradient text-white"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {t === "history" ? "历史" : "示例"}
          </button>
        ))}
      </div>

      {/* 筛选条 */}
      {filterDefs.map((f) => (
        <FilterChip
          key={f.key}
          def={f}
          value={filters[f.key]}
          onChange={(v) => onFiltersChange({ ...filters, [f.key]: v })}
        />
      ))}

      {/* 搜索 */}
      <div className="relative ml-auto w-44 sm:w-56">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <input
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          placeholder="搜索提示词…"
          className="h-8 w-full rounded-lg border border-border bg-card/40 pl-8 pr-2.5 text-xs outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring"
        />
      </div>

    <button
      onClick={resetFilters}
      disabled={!hasActiveFilters}
      title={hasActiveFilters ? "清空当前筛选" : "暂无筛选条件"}
      className="flex h-8 items-center gap-1 rounded-lg border border-border bg-card/40 px-2.5 text-xs font-medium text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
    >
      <CheckSquare className="h-3.5 w-3.5" />
      清空筛选
    </button>
    </div>
  );
}
