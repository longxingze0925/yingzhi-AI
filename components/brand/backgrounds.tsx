import { cn } from "@/lib/utils";

/**
 * 全局氛围光晕背景 —— 固定铺底的径向渐变光斑 + 噪点，营造电影感。
 */
export function AuroraBackground({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "pointer-events-none fixed inset-0 -z-10 overflow-hidden",
        className
      )}
      aria-hidden="true"
    >
      <div className="absolute -left-[10%] -top-[10%] h-[45rem] w-[45rem] rounded-full bg-[hsl(var(--primary))] opacity-[0.04] blur-[150px] dark:opacity-[0.07]" />
      <div className="absolute right-[-5%] top-[20%] h-[38rem] w-[38rem] rounded-full bg-[hsl(var(--primary))] opacity-[0.03] blur-[150px] dark:opacity-[0.05]" />
    </div>
  );
}

/**
 * 网格底纹 —— 用于英雄区/区块背景的极细网格。
 */
export function GridPattern({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "pointer-events-none absolute inset-0 -z-10",
        "[background-size:40px_40px]",
        "[background-image:linear-gradient(to_right,hsl(var(--border)/0.5)_1px,transparent_1px),linear-gradient(to_bottom,hsl(var(--border)/0.5)_1px,transparent_1px)]",
        "[mask-image:radial-gradient(ellipse_70%_60%_at_50%_0%,#000_60%,transparent_100%)]",
        className
      )}
      aria-hidden="true"
    />
  );
}
