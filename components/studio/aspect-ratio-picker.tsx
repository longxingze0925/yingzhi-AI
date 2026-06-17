"use client";

import { ASPECT_RATIOS } from "@/data/mock/config";
import type { AspectRatio } from "@/lib/api/types";
import { cn } from "@/lib/utils";

export function AspectRatioPicker({
  value,
  onChange,
}: {
  value: AspectRatio;
  onChange: (v: AspectRatio) => void;
}) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {ASPECT_RATIOS.map((r) => {
        const active = r.value === value;
        // 在 28px 盒子内按比例缩放预览
        const max = 24;
        const scale = max / Math.max(r.w, r.h);
        const w = r.w * scale;
        const h = r.h * scale;
        return (
          <button
            key={r.value}
            onClick={() => onChange(r.value)}
            className={cn(
              "flex flex-col items-center gap-1.5 rounded-lg border p-2 transition-colors",
              active
                ? "border-primary bg-primary/10"
                : "border-border hover:border-primary/40"
            )}
          >
            <span className="grid h-7 place-items-center">
              <span
                className={cn(
                  "rounded-[3px] border",
                  active ? "border-primary bg-primary/30" : "border-muted-foreground/50"
                )}
                style={{ width: w, height: h }}
              />
            </span>
            <span
              className={cn(
                "text-[11px] font-medium",
                active ? "text-primary" : "text-muted-foreground"
              )}
            >
              {r.value}
            </span>
          </button>
        );
      })}
    </div>
  );
}
