import { create } from "zustand";
import {
  findGenerationJobByIdempotencyKey,
  generate,
  GenerationSyncError,
  getGenerationJob,
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
  loadHistory: (force?: boolean) => Promise<void>;
  syncActiveJobs: () => Promise<void>;
  resync: (jobId: string) => void;
  resetSession: () => void;
  /** 提交一个生成任务，返回本地 jobId */
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
let activeSyncPromise: Promise<void> | null = null;
const ORPHAN_SYNC_WINDOW_MS = 60_000;
const MAX_ORPHAN_SYNC_ATTEMPTS = 10;

const DEMO_JOBS: GenerationJob[] = [
  ...buildDemoHistory("image"),
  ...buildDemoHistory("video"),
  ...buildDemoHistory("audio"),
];

const TERMINAL_STATUSES = new Set([
  "succeeded",
  "failed",
  "review",
  "cancelled",
]);

function isActiveJob(job: GenerationJob) {
  return job.syncState !== "lost" && !TERMINAL_STATUSES.has(job.status);
}

function mergeServerJobs(
  currentJobs: GenerationJob[],
  serverJobs: GenerationJob[],
): GenerationJob[] {
  const merged = [...currentJobs];

  for (const serverJob of serverJobs) {
    const index = merged.findIndex(
      (job) =>
        job.id === serverJob.id ||
        job.serverId === serverJob.id ||
        job.id === serverJob.serverId,
    );
    if (index === -1) {
      merged.push(serverJob);
      continue;
    }
    merged[index] = {
      ...merged[index],
      ...serverJob,
      id: merged[index].id,
      serverId: serverJob.serverId ?? serverJob.id,
      modelId: merged[index].modelId ?? serverJob.modelId,
      modelName: merged[index].modelName ?? serverJob.modelName,
      model: merged[index].modelName ?? serverJob.model,
      routeId: serverJob.routeId ?? merged[index].routeId,
      routeName: merged[index].routeName ?? serverJob.routeName,
      sourceMode: merged[index].sourceMode ?? serverJob.sourceMode,
      referenceCount:
        merged[index].referenceCount ?? serverJob.referenceCount,
      hasFirstFrame: merged[index].hasFirstFrame ?? serverJob.hasFirstFrame,
      hasLastFrame: merged[index].hasLastFrame ?? serverJob.hasLastFrame,
      syncState: "synced",
      syncError: undefined,
    };
  }

  return merged.sort((a, b) => b.createdAt - a.createdAt);
}

export const useGenerationStore = create<GenerationState>((set, get) => ({
  jobs: [],
  historyLoaded: false,
  historyLoading: false,
  historyError: null,
  activeJobId: null,

  setActiveJob: (id) => set({ activeJobId: id }),

  loadHistory: async (force = false) => {
    const { historyLoaded, historyLoading } = get();
    if ((!force && historyLoaded) || historyLoading) return;

    set({ historyLoading: true, historyError: null });
    try {
      const jobs = await listGenerationJobs();
      set((state) => ({
        jobs: mergeServerJobs(state.jobs, jobs),
        historyLoaded: true,
        historyError: null,
      }));
    } catch (err) {
      set((state) => ({
        jobs:
          !state.historyLoaded && isDemoFallbackEnabled()
            ? DEMO_JOBS
            : state.jobs,
        historyLoaded: true,
        historyError:
          err instanceof Error ? err.message : "生成历史加载失败",
      }));
    } finally {
      set({ historyLoading: false });
    }
  },

  syncActiveJobs: async () => {
    if (activeSyncPromise) return activeSyncPromise;
    activeSyncPromise = (async () => {
      const activeJobs = get().jobs.filter(
        (job) => isActiveJob(job) && !controllers.has(job.id),
      );
      if (activeJobs.length === 0) return;

      const updates = await Promise.all(
        activeJobs.map(async (job) => {
          try {
            let serverJob: GenerationJob | null = null;
            if (job.serverId) {
              serverJob = await getGenerationJob(job.serverId);
            } else if (job.idempotencyKey) {
              serverJob = await findGenerationJobByIdempotencyKey(
                job.idempotencyKey,
              );
            }
            return serverJob
              ? { localId: job.id, job: serverJob }
              : { localId: job.id, job: null };
          } catch (err) {
            return {
              localId: job.id,
              job: null,
              error:
                err instanceof Error ? err.message : "任务状态同步暂时中断",
            };
          }
        }),
      );

      set((state) => ({
        jobs: state.jobs.map((job) => {
          const update = updates.find((item) => item.localId === job.id);
          if (!update) return job;
          if (!update.job) {
            if (!job.serverId) {
              const syncAttempts = (job.syncAttempts ?? 0) + 1;
              const syncDeadlineAt =
                job.syncDeadlineAt ?? Date.now() + ORPHAN_SYNC_WINDOW_MS;
              const lost =
                Date.now() >= syncDeadlineAt ||
                syncAttempts >= MAX_ORPHAN_SYNC_ATTEMPTS;
              return {
                ...job,
                syncState: lost ? ("lost" as const) : ("retrying" as const),
                syncError: lost
                  ? "未找到服务端任务，状态同步已停止"
                  : (update.error ?? "正在查找服务端任务"),
                syncAttempts,
                syncDeadlineAt,
              };
            }
            return {
              ...job,
              syncState: "retrying" as const,
              syncError: update.error ?? job.syncError,
            };
          }
          return {
            ...job,
            ...update.job,
            id: job.id,
            serverId: update.job.serverId ?? update.job.id,
            modelId: job.modelId ?? update.job.modelId,
            modelName: job.modelName ?? update.job.modelName,
            model: job.modelName ?? update.job.model,
            routeId: update.job.routeId ?? job.routeId,
            routeName: job.routeName ?? update.job.routeName,
            sourceMode: job.sourceMode ?? update.job.sourceMode,
            referenceCount: job.referenceCount ?? update.job.referenceCount,
            hasFirstFrame: job.hasFirstFrame ?? update.job.hasFirstFrame,
            hasLastFrame: job.hasLastFrame ?? update.job.hasLastFrame,
            syncState: "synced",
            syncError: undefined,
            syncAttempts: undefined,
            syncDeadlineAt: undefined,
          };
        }),
      }));
    })().finally(() => {
      activeSyncPromise = null;
    });
    return activeSyncPromise;
  },

  submit: (params) => {
    const id = `job_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
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
      routeId: params.routeId,
      routeName: params.routeName,
      aspectRatio: params.aspectRatio,
      resolution: params.resolution,
      count: params.count,
      durationSec: params.durationSec,
      sourceMode: params.sourceMode ?? "text",
      referenceCount:
        params.referenceAssets?.length ?? params.referenceAssetIds?.length ?? 0,
      hasFirstFrame:
        Boolean(params.firstFrameAssetId) ||
        Boolean(
          params.referenceAssets?.some(
            (asset) => asset.role === "first_frame",
          ),
        ),
      hasLastFrame:
        Boolean(params.lastFrameAssetId) ||
        Boolean(
          params.referenceAssets?.some((asset) => asset.role === "last_frame"),
        ),
      createdAt: Date.now(),
      results: [],
      syncState: "submitting",
      syncAttempts: 0,
      syncDeadlineAt: Date.now() + ORPHAN_SYNC_WINDOW_MS,
    };

    set((state) => ({ jobs: [job, ...state.jobs], activeJobId: id }));

    const update = (patch: Partial<GenerationJob>) =>
      set((state) => ({
        jobs: state.jobs.map((item) =>
          item.id === id ? { ...item, ...patch } : item,
        ),
      }));

    const controller = new AbortController();
    controllers.set(id, controller);

    generate(params, {
      signal: controller.signal,
      onRequest: (idempotencyKey) => update({ idempotencyKey }),
      onProgress: (progress) =>
        update({ progress, status: "running", syncState: "polling" }),
      onJob: (serverJob) =>
        update({
          ...serverJob,
          id,
          serverId: serverJob.serverId ?? serverJob.id,
          modelId: params.model,
          modelName: params.modelName,
          model: params.modelName ?? params.model,
          routeId: params.routeId ?? serverJob.routeId,
          routeName: params.routeName ?? serverJob.routeName,
          syncState: "synced",
          syncError: undefined,
          syncAttempts: undefined,
          syncDeadlineAt: undefined,
        }),
      onSyncError: (syncError) =>
        update({ syncState: "retrying", syncError }),
    })
      .then((results) => {
        update({
          status: "succeeded",
          progress: 100,
          results,
          syncState: "synced",
          syncError: undefined,
          syncAttempts: undefined,
          syncDeadlineAt: undefined,
        });
      })
      .catch((err) => {
        if (err?.name === "AbortError") return;
        if (err instanceof GenerationSyncError) {
          update({ syncState: "retrying", syncError: err.message });
          return;
        }
        update({
          status: "failed",
          error: err instanceof Error ? err.message : "生成失败，请重试",
          syncState: "synced",
          syncError: undefined,
        });
      })
      .finally(() => controllers.delete(id));

    return id;
  },

  resync: (jobId) => {
    set((state) => ({
      jobs: state.jobs.map((job) =>
        job.id === jobId
          ? {
              ...job,
              syncState: "retrying",
              syncError: "正在重新查找服务端任务",
              syncAttempts: 0,
              syncDeadlineAt: Date.now() + ORPHAN_SYNC_WINDOW_MS,
            }
          : job,
      ),
    }));
    void get().syncActiveJobs();
  },

  cancel: (jobId) => {
    controllers.get(jobId)?.abort();
    controllers.delete(jobId);
    set((state) => ({
      jobs: state.jobs.filter((job) => job.id !== jobId),
      activeJobId: state.activeJobId === jobId ? null : state.activeJobId,
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
      routeId: job.routeId,
      routeName: job.routeName,
      aspectRatio: job.aspectRatio,
      resolution: job.resolution,
      count: job.count,
      durationSec: job.durationSec,
      sourceMode: job.sourceMode ?? "text",
    });
  },

  removeResult: (itemId) =>
    set((state) => ({
      jobs: state.jobs
        .map((job) => ({
          ...job,
          results: job.results.filter((item) => item.id !== itemId),
        }))
        .filter((job) => job.status !== "succeeded" || job.results.length > 0),
      activeJobId: state.activeJobId,
    })),

  clear: () => {
    controllers.forEach((controller) => controller.abort());
    controllers.clear();
    set({ jobs: [], activeJobId: null, historyLoaded: true, historyError: null });
  },

  resetSession: () => {
    controllers.forEach((controller) => controller.abort());
    controllers.clear();
    activeSyncPromise = null;
    set({
      jobs: [],
      activeJobId: null,
      historyLoaded: false,
      historyLoading: false,
      historyError: null,
    });
  },
}));
