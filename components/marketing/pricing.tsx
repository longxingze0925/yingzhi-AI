"use client";

import * as React from "react";
import Link from "next/link";
import { Check } from "lucide-react";
import { Reveal } from "@/components/shared/reveal";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { usePricingPlans } from "@/lib/store/use-pricing-plans";
import { cn } from "@/lib/utils";

export function Pricing() {
  const [yearly, setYearly] = React.useState(false);
  const { plans } = usePricingPlans();

  return (
    <section id="pricing" className="relative py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <Reveal className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-primary">
            Pricing
          </p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
            选择适合你的<span className="text-gradient">创作方案</span>
          </h2>
          <p className="mt-4 text-muted-foreground">
            按算力点数计费，灵活透明。随时升级或取消。
          </p>

          {/* 月付/年付切换 */}
          <div className="mt-8 inline-flex items-center gap-3 rounded-full border border-border bg-card/60 p-1 text-sm">
            <button
              onClick={() => setYearly(false)}
              className={cn(
                "rounded-full px-4 py-1.5 font-medium transition-colors",
                !yearly ? "bg-brand-gradient text-white" : "text-muted-foreground"
              )}
            >
              按月
            </button>
            <button
              onClick={() => setYearly(true)}
              className={cn(
                "flex items-center gap-1.5 rounded-full px-4 py-1.5 font-medium transition-colors",
                yearly ? "bg-brand-gradient text-white" : "text-muted-foreground"
              )}
            >
              按年
              <Badge
                variant={yearly ? "secondary" : "success"}
                className="px-1.5 py-0 text-[10px]"
              >
                省 2 个月
              </Badge>
            </button>
          </div>
        </Reveal>

        <div className="mt-14 grid items-stretch gap-6 lg:grid-cols-3">
          {plans.map((plan) => {
            const price = yearly ? plan.priceYearly : plan.priceMonthly;
            return (
              <Reveal key={plan.id}>
                <div
                  className={cn(
                    "relative flex h-full flex-col rounded-2xl border p-7",
                    plan.highlighted
                      ? "glow-border border-primary/40 bg-card shadow-xl shadow-brand-violet/10"
                      : "border-border/60 bg-card/40"
                  )}
                >
                  {plan.highlighted && (
                    <Badge variant="brand" className="absolute -top-3 left-7">
                      最受欢迎
                    </Badge>
                  )}
                  <h3 className="text-lg font-semibold">{plan.name}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {plan.tagline}
                  </p>

                  <div className="mt-6 flex items-baseline gap-1">
                    <span className="text-4xl font-bold tracking-tight">
                      ¥{price}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      /{yearly ? "年" : "月"}
                    </span>
                  </div>
                  <p className="mt-1.5 text-sm font-medium text-primary">
                    {plan.credits}
                  </p>

                  <Button
                    asChild
                    variant={plan.highlighted ? "brand" : "outline"}
                    className="mt-6 w-full"
                  >
                    <Link href="/login">{plan.cta}</Link>
                  </Button>

                  <ul className="mt-7 space-y-3">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-start gap-2.5 text-sm">
                        <span className="mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full bg-primary/15 text-primary">
                          <Check className="h-3 w-3" />
                        </span>
                        <span className="text-muted-foreground">{f}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}
