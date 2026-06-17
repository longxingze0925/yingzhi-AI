import { create } from "zustand";
import {
  generate,
  isDemoFallbackEnabled,
  listGenerationJobs,
} from "@/lib/api/client";
import { buildDemoHistory } from "@/data/mock/gallery";
import type { GenerateParams, GenerationJob } from "@/lib/api/types";

interface GenerationState {
  jobs: GenerationJob[];
  historyLoaded: boolean;
  historyLoading: boolean;
  historyError: string | null;
  loadHistory: () => Promise<void>;
  /** 提交一个生成任务，返回 jobId */
  submit: (params: GenerateParams) => string;
  cancel: (jobId: string) => void;
  retry: (jobId: string) => string | null;
  removeResult: (itemId: string) => void;
  clear: () => void;
  /** 最近一次完成任务的结果（便于画布展示） */
  activeJobId: string | null;
  setActiveJob: (id: string | null) => void;
}

const controllers = new Map<string, AbortController>();

const DEMO_JOBS: GenerationJob[] = [
  ...buildDemoHistory("image"),
  ...buildDemoHistory("video"),
  ...buildDemoHistory("audio"),
];

export const useGenerationStore = create<GenerationState>((set, get) => ({
  jobs: [],
  historyLoaded: false,
  historyLoading: false,
  historyError: null,
  activeJobId: null,

  setActiveJob: (id) => set({ activeJobId: id }),

  loadHistory: async () => {
    const { historyLoaded, historyLoading } = get();
    if (historyLoaded || historyLoading) return;

    set({ historyLoading: true, historyError: null });
    try {
      const jobs = await listGenerationJobs();
      set({ jobs, historyLoaded: true, historyError: null });
    } catch (err) {
      set({
        jobs: isDemoFallbackEnabled() ? DEMO_JOBS : [],
        historyLoaded: true,
        historyError:
          err instanceof Error ? err.message : "生成历史加载失败",
      });
    } finally {
      set({ historyLoading: false });
    }
  },

  submit: (params) => {
    const id = `job_${Date.now()}`;
    const job: GenerationJob = {
      id,
      type: params.type,
      status: "queued",
      progress: 0,
      prompt: params.prompt,
      negativePrompt: params.negativePrompt,
      modelId: params.model,
      model: params.modelName ?? params.model,
      modelName: params.modelName,
      aspectRatio: params.aspectRatio,
      resolution: params.resolution,
      count: params.count,
      durationSec: params.durationSec,
      sourceMode: params.sourceMode ?? "text",
      referenceCount:
        params.referenceAssets?.length ?? params.referenceAssetIds?.length ?? 0,
      hasFirstFrame:
        Boolean(params.firstFrameAssetId) ||
        Boolean(params.referenceAssets?.some((asset) => asset.role === "first_frame")),
      hasLastFrame:
        Boolean(params.lastFrameAssetId) ||
        Boolean(params.referenceAssets?.some((asset) => asset.role === "last_frame")),
      createdAt: Date.now(),
      results: [],
    };

    set((s) => ({ jobs: [job, ...s.jobs], activeJobId: id }));

    const update = (patch: Partial<GenerationJob>) =>
      set((s) => ({
        jobs: s.jobs.map((j) => (j.id === id ? { ...j, ...patch } : j)),
      }));

    const controller = new AbortController();
    controllers.set(id, controller);

    // 短暂排队态，再进入生成中
    setTimeout(() => {
      if (controller.signal.aborted) return;
      update({ status: "running" });
    }, 400);

    generate(params, {
      signal: controller.signal,
      onProgress: (progress) => update({ progress, status: "running" }),
    })
      .then((results) => {
        update({ status: "succeeded", progress: 100, results });
      })
      .catch((err) => {
        if (err?.name === "AbortError") return;
        update({
          status: "failed",
          error: err instanceof Error ? err.message : "生成失败，请重试",
        });
      })
      .finally(() => controllers.delete(id));

    return id;
  },

  cancel: (jobId) => {
    controllers.get(jobId)?.abort();
    controllers.delete(jobId);
    set((s) => ({
      jobs: s.jobs.filter((j) => j.id !== jobId),
      activeJobId: s.activeJobId === jobId ? null : s.activeJobId,
    }));
  },

  retry: (jobId) => {
    const job = get().jobs.find((item) => item.id === jobId);
    if (!job) return null;
    return get().submit({
      type: job.type,
      prompt: job.prompt,
      negativePrompt: job.negativePrompt,
      model: job.modelId ?? job.model,
      modelName: job.modelName ?? job.model,
      aspectRatio: job.aspectRatio,
      resolution: job.resolution,
      count: job.count,
      durationSec: job.durationSec,
      sourceMode: job.sourceMode ?? "text",
    });
  },

  removeResult: (itemId) =>
    set((s) => ({
      jobs: s.jobs
        .map((job) => ({
          ...job,
          results: job.results.filter((item) => item.id !== itemId),
        }))
        .filter((job) => job.status !== "succeeded" || job.results.length > 0),
      activeJobId: s.activeJobId,
    })),

  clear: () => {
    controllers.forEach((c) => c.abort());
    controllers.clear();
    set({ jobs: [], activeJobId: null, historyLoaded: true, historyError: null });
  },
}));
