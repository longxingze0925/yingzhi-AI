import Link from "next/link";
import { ArrowLeft, Construction } from "lucide-react";

import { Button } from "@/components/ui/button";

export function CanvasComingSoon({ standalone = false }: { standalone?: boolean }) {
  return (
    <div
      className={
        standalone
          ? "flex min-h-dvh w-full items-center justify-center bg-background px-6 py-12"
          : "flex min-h-full w-full flex-1 items-center justify-center bg-background px-6 py-12"
      }
    >
      <section
        aria-labelledby="canvas-coming-soon-title"
        className="flex w-full max-w-xl flex-col items-center text-center"
      >
        <div className="mb-6 grid h-16 w-16 place-items-center rounded-2xl border border-border/70 bg-card text-primary shadow-sm">
          <Construction aria-hidden="true" className="h-8 w-8" />
        </div>
        <p className="mb-3 rounded-full border border-border/70 bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
          功能开发中
        </p>
        <h1
          id="canvas-coming-soon-title"
          className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl"
        >
          无限画布正在开发中
        </h1>
        <p className="mt-4 max-w-lg text-sm leading-6 text-muted-foreground sm:text-base">
          我们正在重新整理无限画布，暂时无法进入、编辑或调用模型。影织的其他创作功能可以照常使用。
        </p>
        <Button asChild className="mt-8" variant="brand">
          <Link href="/studio">
            <ArrowLeft aria-hidden="true" className="mr-2 h-4 w-4" />
            返回工作台
          </Link>
        </Button>
      </section>
    </div>
  );
}
