"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Reveal } from "@/components/shared/reveal";
import { Button } from "@/components/ui/button";

export function CtaSection() {
  return (
    <section className="relative py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <Reveal>
          <div className="glow-border noise relative overflow-hidden rounded-3xl border border-primary/30 bg-card px-6 py-16 text-center sm:px-12 sm:py-20">
            <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(60%_120%_at_50%_0%,hsl(var(--brand-violet)/0.25),transparent)]" />
            <h2 className="mx-auto max-w-2xl text-balance text-3xl font-bold tracking-tight sm:text-5xl">
              现在开始，
              <span className="text-gradient">编织你的第一帧</span>
            </h2>
            <p className="mx-auto mt-5 max-w-xl text-muted-foreground">
              免费注册即赠 100 算力点，无需信用卡。让想象力即刻成像。
            </p>
            <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button asChild variant="brand" size="xl">
                <Link href="/studio">
                  免费开始创作 <ArrowRight className="h-5 w-5" />
                </Link>
              </Button>
              <Button asChild variant="glass" size="xl">
                <Link href="/#pricing">查看定价</Link>
              </Button>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
