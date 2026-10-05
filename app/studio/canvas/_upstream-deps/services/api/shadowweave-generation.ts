import { getGenerationJob, generate, listAiModels } from "@/lib/api/client";
import type { GenerateParams, GenerationJob, MediaItem } from "@/lib/api/types";
import type { AiConfig } from "@/app/studio/canvas/_upstream-deps/stores/use-config-store";
import type { ReferenceAudio, ReferenceVideo } from "@/app/studio/canvas/_upstream-deps/types/media";
import type { ReferenceImage } from "@/app/studio/canvas/_upstream-deps/types/image";
import type { CanvasImageTask } from "./image";
import type { CanvasAudioTask } from "./audio";
import type { VideoResponse } from "./video";
import { uploadAssetFile } from "@/lib/api/client";

type ShadowweaveTaskKind = "image" | "video" | "audio";

type CanvasReference = ReferenceImage | ReferenceVideo | ReferenceAudio;

type ManagedTask = {
    jobId: string;
    result: MediaItem;
    results: MediaItem[];
};

const managedTaskIds = new Map<string, string>();

function configuredModel(config: AiConfig, type: ShadowweaveTaskKind) {
    if (type === "image") return config.imageModel || config.model;
    if (type === "video") return config.videoModel || config.model;
    return config.audioModel || config.model;
}

function ratioFromSize(size: string | undefined, type: ShadowweaveTaskKind) {
    const value = (size || "").trim().toLowerCase();
    if (value.includes(":")) return value;
    const match = value.match(/^(\d+)x(\d+)$/);
    if (match) {
        const width = Number(match[1]);
        const height = Number(match[2]);
        if (width > 0 && height > 0) {
            const divisor = gcd(width, height);
            return `${width / divisor}:${height / divisor}`;
        }
    }
    return type === "video" ? "16:9" : "1:1";
}

function gcd(left: number, right: number): number {
    let a = Math.abs(left);
    let b = Math.abs(right);
    while (b) {
        const next = a % b;
        a = b;
        b = next;
    }
    return a || 1;
}

function referenceSource(reference: CanvasReference) {
    const candidate = reference as CanvasReference & { dataUrl?: string; url?: string };
    return candidate.dataUrl || candidate.url || "";
}

async function uploadReference(reference: CanvasReference, role: "reference" | "first_frame" | "last_frame") {
    const storageKey = (reference as CanvasReference & { storageKey?: string }).storageKey || "";
    if (storageKey.startsWith("server:")) {
        return { assetId: storageKey.slice("server:".length), role };
    }

    const source = referenceSource(reference);
    if (!source) return null;
    const response = await fetch(source);
    if (!response.ok) return null;
    const blob = await response.blob();
    const type = blob.type.startsWith("video/") ? "video" : blob.type.startsWith("audio/") ? "audio" : "image";
    const name = (reference as CanvasReference & { name?: string }).name || `canvas-reference-${Date.now()}`;
    const file = new File([blob], name, { type: blob.type || "application/octet-stream" });
    const uploaded = await uploadAssetFile({ file, assetType: type, assetRole: role });
    return { assetId: uploaded.assetId, role };
}

async function referenceInputs(
    references: CanvasReference[],
    firstFrame?: ReferenceImage | null,
    lastFrame?: ReferenceImage | null,
) {
    const inputs: Array<{ assetId: string; kind: string; role: string }> = [];
    const add = async (reference: CanvasReference | null | undefined, role: "reference" | "first_frame" | "last_frame") => {
        if (!reference) return;
        const uploaded = await uploadReference(reference, role);
        if (!uploaded) return;
        const type = (reference as CanvasReference & { type?: string }).type || "image";
        inputs.push({ assetId: uploaded.assetId, kind: type, role });
    };

    for (const reference of references) await add(reference, "reference");
    await add(firstFrame, "first_frame");
    await add(lastFrame, "last_frame");
    return inputs;
}

async function resolveModel(config: AiConfig, type: ShadowweaveTaskKind) {
    const current = configuredModel(config, type).trim();
    try {
        const available = await listAiModels(type);
        const selected = (current && available.find((item) => item.id === current)) || available[0];
        if (selected?.id) {
            return {
                id: selected.id,
                durations: selected.capabilities?.durations || [],
            };
        }
    } catch {
        // The generation endpoint remains the source of truth if model discovery is temporarily unavailable.
    }
    if (!current) throw new Error(`影织暂时没有可用的${type === "image" ? "图片" : type === "video" ? "视频" : "音频"}模型`);
    return {
        id: current,
        durations: type === "video" ? config.videoModelDurations?.[current] || [] : [],
    };
}

function jobId(job: GenerationJob | null, fallback: string) {
    return job?.serverId || job?.id || fallback;
}

async function runManagedGeneration(
    config: AiConfig,
    type: ShadowweaveTaskKind,
    prompt: string,
    options: {
        clientTaskId?: string;
        references?: CanvasReference[];
        firstFrame?: ReferenceImage | null;
        lastFrame?: ReferenceImage | null;
        durationSec?: number;
        aspectRatio?: string;
        onProgress?: (progress: number) => void;
    } = {},
): Promise<ManagedTask> {
    const resolvedModel = await resolveModel(config, type);
    const referenceInputsList = await referenceInputs(options.references || [], options.firstFrame, options.lastFrame);
    const configuredDuration = Number(type === "video" ? config.videoSeconds : 10) || 10;
    const requestedDuration = options.durationSec ?? configuredDuration;
    const durationSec = type === "video" && resolvedModel.durations.length
        ? resolvedModel.durations.includes(requestedDuration)
            ? requestedDuration
            : resolvedModel.durations[0]
        : requestedDuration;
    const params: GenerateParams = {
        type,
        prompt,
        model: resolvedModel.id,
        routeId: config.routeId || undefined,
        routeName: config.routeName || undefined,
        aspectRatio: options.aspectRatio || ratioFromSize(type === "video" ? config.videoSize : config.size, type),
        count: 1,
        durationSec: type === "video" || type === "audio" ? durationSec : undefined,
        referenceAssets: referenceInputsList.length ? referenceInputsList : undefined,
        referenceAssetIds: referenceInputsList.length ? referenceInputsList.map((item) => item.assetId) : undefined,
        sourceMode: referenceInputsList.length ? (type === "video" ? "frames" : type) : "text",
    };

    let latestJob: GenerationJob | null = null;
    const results = await generate(params, {
        onProgress: options.onProgress,
        onJob: (job) => {
            latestJob = job;
        },
    });
    const result = results[0];
    if (!result?.url) throw new Error("影织生成完成但没有返回素材地址");
    const resolvedJobId = jobId(latestJob, options.clientTaskId || `${type}-${Date.now()}`);
    if (options.clientTaskId) managedTaskIds.set(options.clientTaskId, resolvedJobId);
    managedTaskIds.set(resolvedJobId, resolvedJobId);
    return { jobId: resolvedJobId, result, results };
}

function managedJobId(taskId: string) {
    return managedTaskIds.get(taskId) || taskId;
}

function taskTime(job: GenerationJob | null) {
    return new Date(job?.createdAt || Date.now()).toISOString();
}

export async function createManagedImageTask(config: AiConfig, prompt: string, options: { clientTaskId?: string; references?: ReferenceImage[]; onProgress?: (progress: number) => void } = {}): Promise<CanvasImageTask> {
    const task = await runManagedGeneration(config, "image", prompt, options);
    return {
        id: task.jobId,
        status: "completed",
        progress: 100,
        url: task.result.url,
        image_url: task.result.url,
        image_urls: task.results.map((item) => item.url).filter((url): url is string => Boolean(url)),
        mimeType: "image/png",
    };
}

export async function pollManagedImageTask(taskId: string): Promise<CanvasImageTask> {
    const job = await getGenerationJob(managedJobId(taskId));
    const result = job.results[0];
    if (job.status === "failed") throw new Error(job.error || "图片生成失败");
    return {
        id: managedJobId(taskId),
        status: job.status === "succeeded" ? "completed" : job.status,
        progress: job.progress,
        url: result?.url,
        image_url: result?.url,
        image_urls: job.results.map((item) => item.url).filter((url): url is string => Boolean(url)),
    };
}

export async function createManagedAudioTask(config: AiConfig, prompt: string, options: { clientTaskId?: string; referenceAudio?: ReferenceAudio; durationSec?: number; onProgress?: (progress: number) => void } = {}): Promise<CanvasAudioTask> {
    const task = await runManagedGeneration(config, "audio", prompt, { ...options, references: options.referenceAudio ? [options.referenceAudio] : [] });
    return {
        id: task.jobId,
        status: "completed",
        progress: 100,
        url: task.result.url,
        audio_url: task.result.url,
        mimeType: task.result.type === "audio" ? "audio/mpeg" : undefined,
        started_at: taskTime(null),
        completed_at: new Date().toISOString(),
    };
}

export async function pollManagedAudioTask(taskId: string): Promise<CanvasAudioTask> {
    const job = await getGenerationJob(managedJobId(taskId));
    const result = job.results[0];
    if (job.status === "failed") throw new Error(job.error || "音频生成失败");
    return {
        id: managedJobId(taskId),
        status: job.status === "succeeded" ? "completed" : job.status,
        progress: job.progress,
        url: result?.url,
        audio_url: result?.url,
    };
}

export async function createManagedVideoTask(
    config: AiConfig,
    prompt: string,
    input: { references?: ReferenceImage[]; firstFrame?: ReferenceImage | null; lastFrame?: ReferenceImage | null; videoReferences?: ReferenceVideo[]; audioReferences?: ReferenceAudio[] } = {},
    options: { clientTaskId?: string; onProgress?: (progress: number) => void } = {},
): Promise<{ task: VideoResponse; pollId: string; startedAt: number; requestBody: unknown }> {
    const startedAt = Date.now();
    const task = await runManagedGeneration(config, "video", prompt, {
        ...options,
        references: [...(input.references || []), ...(input.videoReferences || []), ...(input.audioReferences || [])],
        firstFrame: input.firstFrame,
        lastFrame: input.lastFrame,
    });
    const videoTask: VideoResponse = {
        id: task.jobId,
        status: "succeeded",
        progress: 100,
        model: task.result.model,
        url: task.result.url,
        video_url: task.result.url,
    };
    return { task: videoTask, pollId: task.jobId, startedAt, requestBody: { prompt, model: task.result.model } };
}

export async function pollManagedVideoTask(config: AiConfig, task: VideoResponse): Promise<VideoResponse> {
    const job = await getGenerationJob(managedJobId(task.id));
    const result = job.results[0];
    if (job.status === "failed") throw new Error(job.error || "视频生成失败");
    return {
        ...task,
        id: managedJobId(task.id),
        status: job.status === "succeeded" ? "succeeded" : job.status,
        progress: job.progress,
        url: result?.url,
        video_url: result?.url,
    };
}

export function isManagedCanvasTask(taskId: string) {
    return managedTaskIds.has(taskId) || taskId.startsWith("studio_");
}
