import { modelOptionName, type AiConfig } from "@/stores/use-config-store";
import { getImageBlob } from "@/services/image-storage";
import { getMediaBlob, setMediaBlob, type UploadedFile } from "@/services/file-storage";
import { fetchStudioMedia, listStudioModels, studioCanvasFetch, studioJobContentPath, studioMediaUrlForStorageKey, studioStorageKeyFromUrl, studioStoragePath, uploadStudioAsset, type StudioModel } from "@/yingzhi/studio-api";
import { isYingzhiEmbedded, YINGZHI_MANAGED_BASE_URL } from "@/yingzhi/embedded-mode";

type MediaKind = "image" | "video" | "audio";
type StudioJobResult = { id?: string; type?: string; url?: string; assetId?: string };
type StudioJob = {
    id: string;
    type: MediaKind;
    status: "submitting" | "recovery_pending" | "queued" | "running" | "caching" | "succeeded" | "failed" | "review" | "cancelled";
    progress: number;
    results: StudioJobResult[];
    error?: string;
};
type StudioReference = { kind: MediaKind; role: "reference" | "first_frame" | "last_frame"; dataUrl?: string; url?: string; storageKey?: string; name?: string; mimeType?: string; type?: string };
type GenerateOptions = { signal?: AbortSignal; onProgress?: (progress: number) => void };

const modelsById = new Map<string, StudioModel>();
const managedAudioFiles = new WeakMap<Blob, UploadedFile>();

export function isYingzhiManagedConfig(config: Pick<AiConfig, "baseUrl">) {
    return isYingzhiEmbedded && config.baseUrl === YINGZHI_MANAGED_BASE_URL;
}

export function registerStudioModelCatalog(models: StudioModel[]) {
    modelsById.clear();
    models.forEach((model) => modelsById.set(model.id, model));
}

function configuredModel(config: AiConfig) {
    return modelOptionName(config.model || config.imageModel || config.videoModel || config.audioModel || config.textModel).trim();
}

function ratioFromSize(value: string | undefined) {
    const input = (value || "").trim().toLowerCase();
    const ratio = input.match(/^(\d+(?:\.\d+)?):(\d+(?:\.\d+)?)$/);
    if (ratio) return input;
    const dimensions = input.match(/^(\d+)x(\d+)$/);
    if (!dimensions) return input && input !== "auto" ? input : "1:1";
    const width = Number(dimensions[1]);
    const height = Number(dimensions[2]);
    const gcd = (left: number, right: number): number => right ? gcd(right, left % right) : left;
    const divisor = gcd(width, height) || 1;
    return `${width / divisor}:${height / divisor}`;
}

function modelRouteId(modelId: string) {
    return modelsById.get(modelId)?.defaultRouteId || "";
}

async function blobFromReference(reference: StudioReference) {
    if (reference.storageKey) {
        const local = reference.kind === "image" ? await getImageBlob(reference.storageKey) : await getMediaBlob(reference.storageKey);
        if (local) return local;
        const path = studioStoragePath(reference.storageKey);
        if (path) return fetchStudioMedia(path);
    }

    const source = reference.dataUrl || reference.url || "";
    if (!source) throw new Error("参考素材无法读取");
    const storageKey = studioStorageKeyFromUrl(source);
    if (storageKey) return fetchStudioMedia(studioStoragePath(storageKey));
    const response = await fetch(source);
    if (!response.ok) throw new Error(`参考素材读取失败（HTTP ${response.status}）`);
    return response.blob();
}

async function uploadReference(reference: StudioReference) {
    if (reference.storageKey?.startsWith("server:")) return reference.storageKey.slice("server:".length);
    const blob = await blobFromReference(reference);
    const filename = reference.name || `canvas-reference-${Date.now()}`;
    const result = await uploadStudioAsset(blob, filename, reference.kind);
    return result.assetId;
}

function videoResolution(value: string) {
    const normalized = value.trim().toLowerCase();
    if (!normalized || normalized === "auto") return "";
    return /^\d+$/.test(normalized) ? `${normalized}p` : normalized;
}

function boundedCount(value: string | undefined) {
    const count = Math.floor(Number(value));
    return Number.isFinite(count) ? Math.max(1, Math.min(16, count)) : 1;
}

async function submitStudioJob(type: MediaKind, config: AiConfig, prompt: string, references: StudioReference[], options: GenerateOptions = {}) {
    const model = configuredModel(config);
    if (!model) throw new Error("請先選擇影織模型");
    const uploadedReferences = await Promise.all(references.map(async (reference) => ({
        assetId: await uploadReference(reference),
        kind: reference.kind,
        role: reference.role,
    })));
    const frames = uploadedReferences.filter((item) => item.role === "first_frame" || item.role === "last_frame");
    const firstFrameAssetId = frames.find((item) => item.role === "first_frame")?.assetId;
    const lastFrameAssetId = frames.find((item) => item.role === "last_frame")?.assetId;
    const sourceMode = frames.length ? "frames" : uploadedReferences[0]?.kind || "text";
    const body = {
        type,
        prompt,
        model,
        routeId: modelRouteId(model),
        aspectRatio: ratioFromSize(config.size),
        resolution: type === "video" ? videoResolution(config.vquality) : undefined,
        count: type === "image" ? boundedCount(config.count) : 1,
        durationSec: type === "video" ? Math.max(1, Math.floor(Number(config.videoSeconds) || 1)) : undefined,
        voice: type === "audio" ? config.audioVoice : undefined,
        sourceMode,
        referenceAssets: uploadedReferences,
        referenceAssetIds: uploadedReferences.map((item) => item.assetId),
        firstFrameAssetId,
        lastFrameAssetId,
        idempotencyKey: typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `canvas-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    };
    const response = await studioCanvasFetch("/studio/canvas/generation/jobs", {
        method: "POST",
        body: JSON.stringify(body),
        signal: options.signal,
    });
    const payload = await response.json().catch(() => null) as { success?: boolean; data?: { job?: StudioJob }; message?: string; msg?: string } | null;
    if (!response.ok || payload?.success === false || !payload?.data?.job) throw new Error(payload?.message || payload?.msg || `生成任务创建失败（HTTP ${response.status}）`);
    const job = payload.data.job;
    options.onProgress?.(job.progress || 0);
    return job;
}

async function waitForStudioJob(job: StudioJob, options: GenerateOptions = {}) {
    let current = job;
    while (current.status !== "succeeded" && current.status !== "failed" && current.status !== "review" && current.status !== "cancelled") {
        if (options.signal?.aborted) throw options.signal.reason instanceof Error ? options.signal.reason : new DOMException("Aborted", "AbortError");
        await delay(1200, options.signal);
        current = await getStudioJob(current.id, options.signal);
        options.onProgress?.(current.progress || 0);
    }
    if (current.status !== "succeeded") throw new Error(current.error || (current.status === "review" ? "生成内容需要审核" : "生成任务失败"));
    return current;
}

async function createStudioJob(type: MediaKind, config: AiConfig, prompt: string, references: StudioReference[], options: GenerateOptions = {}) {
    return waitForStudioJob(await submitStudioJob(type, config, prompt, references, options), options);
}

export async function getStudioJob(jobId: string, signal?: AbortSignal) {
    const response = await fetchStudioJson<{ job: StudioJob }>(`/studio/canvas/generation/jobs/${encodeURIComponent(jobId)}`, signal);
    return response.job;
}

async function fetchStudioJson<T>(path: string, signal?: AbortSignal) {
    const response = await studioCanvasFetch(path, { signal });
    const payload = await response.json().catch(() => null) as { success?: boolean; data?: T; message?: string; msg?: string } | null;
    if (!response.ok || payload?.success === false || !payload || !Object.prototype.hasOwnProperty.call(payload, "data")) {
        throw new Error(payload?.message || payload?.msg || `请求失败（HTTP ${response.status}）`);
    }
    return payload.data as T;
}

function delay(ms: number, signal?: AbortSignal) {
    return new Promise<void>((resolve, reject) => {
        if (signal?.aborted) return reject(signal.reason || new DOMException("Aborted", "AbortError"));
        const finish = () => {
            signal?.removeEventListener("abort", abort);
            resolve();
        };
        const abort = () => {
            clearTimeout(timer);
            signal?.removeEventListener("abort", abort);
            reject(signal?.reason || new DOMException("Aborted", "AbortError"));
        };
        const timer = setTimeout(finish, ms);
        signal?.addEventListener("abort", abort, { once: true });
    });
}

function jobMediaUrl(job: StudioJob, index = 0) {
    const storedUrl = job.results[index]?.url || "";
    if (storedUrl.startsWith("data:")) return storedUrl;
    return `${"/api"}${studioJobContentPath(job.id, index)}`;
}

export async function generateStudioImages(config: AiConfig, prompt: string, references: Array<{ dataUrl?: string; url?: string; storageKey?: string; name?: string; type?: string }>, options: GenerateOptions = {}) {
    const prepared = references.map((reference): StudioReference => ({ ...reference, kind: "image", role: "reference" }));
    const job = await createStudioJob("image", config, prompt, prepared, options);
    return job.results.map((result, index) => ({ id: result.id || `${job.id}-${index}`, dataUrl: jobMediaUrl(job, index) }));
}

export async function generateStudioVideo(config: AiConfig, prompt: string, images: Array<{ dataUrl?: string; url?: string; storageKey?: string; name?: string; type?: string }>, videos: Array<{ url?: string; storageKey?: string; name?: string; type?: string }> = [], audios: Array<{ url?: string; storageKey?: string; name?: string; type?: string }> = [], options: GenerateOptions = {}) {
    const references: StudioReference[] = [];
    if (config.videoMode === "frames") {
        if (images[0]) references.push({ ...images[0], kind: "image", role: "first_frame" });
        if (images[1]) references.push({ ...images[1], kind: "image", role: "last_frame" });
        images.slice(2).forEach((image) => references.push({ ...image, kind: "image", role: "reference" }));
    } else {
        images.forEach((image) => references.push({ ...image, kind: "image", role: "reference" }));
    }
    videos.forEach((video) => references.push({ ...video, kind: "video", role: "reference" }));
    audios.forEach((audio) => references.push({ ...audio, kind: "audio", role: "reference" }));
    return createStudioJob("video", config, prompt, references, options);
}

export async function generateStudioAudio(config: AiConfig, prompt: string, options: GenerateOptions & { durationSec?: number } = {}) {
    const job = await createStudioJob("audio", config, prompt, [], options);
    const key = `studio-job:${job.id}:0`;
    const path = studioStoragePath(key) || studioJobContentPath(job.id, 0);
    const blob = await fetchStudioMedia(path, options.signal);
    const url = await setMediaBlob(key, blob);
    managedAudioFiles.set(blob, {
        url,
        storageKey: key,
        bytes: blob.size,
        mimeType: blob.type || "audio/mpeg",
    });
    return blob;
}

export function takeManagedAudioFile(blob: Blob) {
    const file = managedAudioFiles.get(blob);
    managedAudioFiles.delete(blob);
    return file;
}

export function studioVideoTask(job: StudioJob) {
    return { id: job.id, status: job.status, model: job.results[0]?.id || "" };
}

export async function createStudioVideoTask(
    config: AiConfig,
    prompt: string,
    images: Array<{ dataUrl?: string; url?: string; storageKey?: string; name?: string; type?: string }>,
    videos: Array<{ url?: string; storageKey?: string; name?: string; type?: string }> = [],
    audios: Array<{ url?: string; storageKey?: string; name?: string; type?: string }> = [],
    options: GenerateOptions = {},
) {
    const references: StudioReference[] = [];
    if (config.videoMode === "frames") {
        if (images[0]) references.push({ ...images[0], kind: "image", role: "first_frame" });
        if (images[1]) references.push({ ...images[1], kind: "image", role: "last_frame" });
        images.slice(2).forEach((image) => references.push({ ...image, kind: "image", role: "reference" }));
    } else {
        images.forEach((image) => references.push({ ...image, kind: "image", role: "reference" }));
    }
    videos.forEach((video) => references.push({ ...video, kind: "video", role: "reference" }));
    audios.forEach((audio) => references.push({ ...audio, kind: "audio", role: "reference" }));
    return submitStudioJob("video", config, prompt, references, options);
}

export async function pollStudioVideoTask(jobId: string, signal?: AbortSignal) {
    const job = await getStudioJob(jobId, signal);
    if (job.status === "failed" || job.status === "review" || job.status === "cancelled") {
        const error = new Error(job.error || "视频任务失败");
        error.name = "VideoTaskFailed";
        throw error;
    }
    if (job.status !== "succeeded") return { status: "pending" as const };
    if (!job.results.length) return { status: "failed" as const, error: "视频任务完成但没有可用的视频结果" };
    const storageKey = `studio-job:${job.id}:0`;
    return {
        status: "completed" as const,
        result: { url: studioMediaUrlForStorageKey(storageKey) || jobMediaUrl(job), mimeType: "video/mp4" },
    };
}

export async function requestStudioTextCompletion(
    config: AiConfig,
    messages: Array<{ role: string; content: unknown }>,
    onDelta: (text: string) => void,
    options: { signal?: AbortSignal } = {},
) {
    const model = configuredModel(config);
    if (!model) throw new Error("请先选择影织文本模型");
    const response = await studioCanvasFetch("/studio/canvas/text/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model, routeId: modelRouteId(model), messages, stream: true }),
        signal: options.signal,
    });
    if (!response.ok) {
        const body = await response.json().catch(() => null) as { message?: string; msg?: string; error?: { message?: string } } | null;
        throw new Error(body?.message || body?.msg || body?.error?.message || `文本生成失败（HTTP ${response.status}）`);
    }
    if (!response.body) {
        const body = await response.json() as { choices?: Array<{ message?: { content?: unknown } }>; output_text?: string };
        const content = body.output_text || body.choices?.[0]?.message?.content;
        const text = typeof content === "string" ? content : "";
        if (text) onDelta(text);
        return text;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let answer = "";
    const consume = (chunk: string) => {
        buffer += chunk;
        const events = buffer.split(/\r?\n\r?\n/);
        buffer = events.pop() || "";
        for (const event of events) {
            for (const line of event.split(/\r?\n/)) {
                if (!line.startsWith("data:")) continue;
                const data = line.slice(5).trim();
                if (!data || data === "[DONE]") continue;
                let payload: { choices?: Array<{ delta?: { content?: unknown }; message?: { content?: unknown } }>; error?: { message?: string } };
                try {
                    payload = JSON.parse(data) as typeof payload;
                } catch {
                    continue;
                }
                if (payload.error?.message) throw new Error(payload.error.message);
                const content = payload.choices?.[0]?.delta?.content ?? payload.choices?.[0]?.message?.content;
                const delta = typeof content === "string" ? content : Array.isArray(content) ? content.map((part) => typeof part === "object" && part && "text" in part ? String(part.text || "") : "").join("") : "";
                if (!delta) continue;
                answer += delta;
                onDelta(delta);
            }
        }
    };
    while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        consume(decoder.decode(value, { stream: true }));
    }
    consume(decoder.decode());
    if (!answer) throw new Error("模型没有返回内容");
    return answer;
}

export async function loadStudioModelCatalog() {
    const types: StudioModel["modality"][] = ["image", "video", "audio", "text"];
    const catalogs = await Promise.all(types.map((type) => listStudioModels(type)));
    return catalogs.flat();
}
