"use client";

import * as React from "react";
import { create } from "zustand";
import { PRICING_PLANS } from "@/data/mock/config";
import { isDemoFallbackEnabled, listPricingPlans } from "@/lib/api/client";
import type { PricingPlan } from "@/lib/api/types";

interface PricingPlansState {
  plans: PricingPlan[];
  loading: boolean;
  loaded: boolean;
  error: string | null;
  load: () => Promise<void>;
}

export const usePricingPlansStore = create<PricingPlansState>((set, get) => ({
  plans: [],
  loading: false,
  loaded: false,
  error: null,

  load: async () => {
    const { loaded, loading } = get();
    if (loaded || loading) return;

    set({ loading: true, error: null });
    try {
      const plans = await listPricingPlans();
      set({ plans, loading: false, loaded: true });
    } catch (err) {
      set({
        plans: isDemoFallbackEnabled() ? PRICING_PLANS : [],
        loading: false,
        loaded: true,
        error: err instanceof Error ? err.message : "套餐列表加载失败",
      });
    }
  },
}));

export function usePricingPlans() {
  const plans = usePricingPlansStore((s) => s.plans);
  const loading = usePricingPlansStore((s) => s.loading);
  const error = usePricingPlansStore((s) => s.error);
  const load = usePricingPlansStore((s) => s.load);

  React.useEffect(() => {
    void load();
  }, [load]);

  return { plans, loading, error };
}
