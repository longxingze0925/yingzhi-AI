/**
 * 影织 · 前端数据访问层（单一替换点）
 *
 * 浏览器只请求影织 Rust 后端；EntitleHub Server Key 只放在 Rust 后端。
 */
import { MOCK_USER } from "@/data/mock/config";
import { GALLERY, getGalleryByType, DEMO_FAVORITES } from "@/data/mock/gallery";
import type {
  ApiKeyInfo,
  AssetItem,
  AssetFolder,
  AssetUpload,
  AssetsLibrary,
  AiModel,
  AspectRatio,
  GenerateParams,
  GenerationJob,
  JobStatus,
  MediaItem,
  MediaType,
  PricingPlan,
  StylePreset,
  UsageSummary,
  UploadedAsset,
  User,
} from "@/lib/api/types";

const configuredApiBase = process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "");
const API_BASE =
  configuredApiBase ??
  (typeof window === "undefined"
    ? "http://127.0.0.1:18777"
    : `${window.location.protocol}//${window.location.hostname}:18777`);
const DEFAULT_API_TIMEOUT_MS = 8000;
const DEMO_FALLBACK_ENABLED = process.env.NEXT_PUBLIC_DEMO_FALLBACK === "1";

type BackendJobStatus =
  | "queued"
  | "running"
  | "caching"
  | "succeeded"
  | "failed"
  | "review"
  | "cancelled";

interface BackendJob {
  id: string;
  type: MediaType;
  status: BackendJobStatus;
  progress: number;
  prompt: string;
  model: string;
  aspectRatio: AspectRatio;
  resolution?: string;
  count: number;
  createdAt: number;
  results: MediaItem[];
  error?: string;
  durationSec?: number;
}

interface BackendJobResponse {
  job: BackendJob;
}

interface BackendJobsResponse {
  jobs: BackendJob[];
}

interface BackendUserResponse {
  user: User;
}

interface BackendAuthResponse {
  user: User;
}

interface BackendWorksResponse {
  works: MediaItem[];
}

interface BackendWorkResponse {
  work?: MediaItem | null;
}

interface BackendWorkDownloadResponse {
  downloadUrl: string;
  downloadedAt?: number | null;
  work?: MediaItem | null;
}

type BackendGalleryResponse = BackendWorksResponse;

interface BackendModelsResponse {
  data: AiModel[];
}

interface BackendPricingPlansResponse {
  plans: PricingPlan[];
}

type BackendUsageResponse = UsageSummary;

type BackendApiKeyResponse = ApiKeyInfo;

type BackendAssetsResponse = AssetsLibrary;

interface BackendAssetFolderResponse {
  folder: AssetFolder;
}

interface BackendAssetUploadResponse {
  upload: AssetUpload;
}

type BackendUploadedAssetResponse = UploadedAsset;

type BackendAssetResponse = AssetItem;

interface BackendStylePresetsResponse {
  styles: StylePreset[];
}

const delay = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException("已取消", "AbortError"));
      return;
    }

    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        reject(new DOMException("已取消", "AbortError"));
      },
      { once: true }
    );
  });

function billingUnitCost(model?: AiModel): number {
  if (!model) return 0;
  if (model.billing.mode.includes("second")) {
    return model.billing.secondPriceMinor ?? 0;
  }
  return model.billing.imagePriceMinor ?? 0;
}

function billingBaseCost(model?: AiModel): number {
  return model?.billing.requestPriceMinor ?? 0;
}

function toGenerationStatus(status: BackendJobStatus): JobStatus {
  if (status === "succeeded" || status === "failed" || status === "queued") {
    return status;
  }
  return "running";
}

function demoMyWorks(): MediaItem[] {
  // 优先覆盖各种比例（每种比例先取一条），再按原序补足到 ~16 条，
  // 让「我的作品」也展示全比例分布。
  const seen = new Set<string>();
  const byRatio: MediaItem[] = [];
  const rest: MediaItem[] = [];
  for (const m of GALLERY) {
    if (!seen.has(m.aspectRatio)) {
      seen.add(m.aspectRatio);
      byRatio.push(m);
    } else {
      rest.push(m);
    }
  }
  return [...byRatio, ...rest].slice(0, 16).map((m, i) => ({
    ...m,
    id: `my_${i}`,
    author: {
      id: MOCK_USER.id,
      name: MOCK_USER.name,
      avatarSeed: MOCK_USER.avatarSeed,
    },
    demo: true,
  }));
}

type ApiInit = RequestInit & {
  signal?: AbortSignal;
  timeoutMs?: number;
};

async function api<T>(path: string, init: ApiInit = {}): Promise<T> {
  const { signal, timeoutMs = DEFAULT_API_TIMEOUT_MS, ...requestInit } = init;
  const controller = new AbortController();
  let timedOut = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const abortFromCaller = () => controller.abort(signal?.reason);

  if (signal?.aborted) {
    controller.abort(signal.reason);
  } else {
    signal?.addEventListener("abort", abortFromCaller, { once: true });
  }

  if (timeoutMs > 0) {
    timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, timeoutMs);
  }

  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      ...requestInit,
      credentials: "include",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        ...requestInit.headers,
      },
    });
  } catch (err) {
    if (timedOut && !signal?.aborted) {
      throw new Error("请求超时，请稍后重试");
    }
    throw err;
  } finally {
    if (timer) clearTimeout(timer);
    signal?.removeEventListener("abort", abortFromCaller);
  }

  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const message =
      body?.message ?? body?.error ?? `请求失败：HTTP ${res.status}`;
    throw new Error(message);
  }
  return body as T;
}

/** 灵感广场列表 */
export async function listGallery(type?: MediaType): Promise<MediaItem[]> {
  try {
    const query = type ? `?type=${encodeURIComponent(type)}` : "";
    const { works } = await api<BackendGalleryResponse>(`/api/gallery${query}`);
    return works;
  } catch (err) {
    if (DEMO_FALLBACK_ENABLED) return getGalleryByType(type);
    throw err;
  }
}

/** 当前用户 */
export async function getUser(): Promise<User> {
  const { user } = await api<BackendUserResponse>("/api/me");
  return user;
}

/** EntitleHub Web 登录：浏览器只拿影织后端 session cookie。 */
export async function loginWithPassword(input: {
  email: string;
  password: string;
}): Promise<User> {
  const { user } = await api<BackendAuthResponse>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify(input),
  });
  return user;
}

export async function logoutRemote(): Promise<void> {
  await api<{ ok: boolean }>("/api/auth/logout", {
    method: "POST",
  });
}

/** 当前用户用量统计 */
export async function getUsageSummary(): Promise<UsageSummary> {
  return api<BackendUsageResponse>("/api/me/usage");
}

/** 当前用户 API Key 展示信息，只返回脱敏密钥。 */
export async function getApiKeyInfo(): Promise<ApiKeyInfo> {
  return api<BackendApiKeyResponse>("/api/me/api-key");
}

/** 可用套餐：以后端配置为数据源，前端只展示。 */
export async function listPricingPlans(): Promise<PricingPlan[]> {
  const { plans } = await api<BackendPricingPlansResponse>("/api/billing/plans");
  return plans;
}

/** 素材资产库 */
export async function listAssets(filters: {
  kind?: "image" | "video" | "audio" | "file" | string;
  source?: string;
  assetRole?: string;
  page?: number;
  pageSize?: number;
} = {}): Promise<AssetsLibrary> {
  const params = new URLSearchParams();
  if (filters.kind) params.set("kind", filters.kind);
  if (filters.source) params.set("source", filters.source);
  if (filters.assetRole) params.set("asset_role", filters.assetRole);
  if (filters.page) params.set("page", String(filters.page));
  if (filters.pageSize) params.set("page_size", String(filters.pageSize));
  const query = params.toString();
  return api<BackendAssetsResponse>(query ? `/api/assets?${query}` : "/api/assets");
}

export async function createAssetFolder(input: {
  name: string;
  parentId?: string;
  kind?: string;
}): Promise<AssetFolder> {
  const { folder } = await api<BackendAssetFolderResponse>("/api/assets/folders", {
    method: "POST",
    body: JSON.stringify(input),
  });
  return folder;
}

export async function createAssetUpload(input: {
  folderId?: string;
  fileName: string;
  assetType: string;
  assetRole?: string;
  mimeType: string;
  fileSize: number;
}): Promise<AssetUpload> {
  const { upload } = await api<BackendAssetUploadResponse>("/api/assets/upload-url", {
    method: "POST",
    body: JSON.stringify(input),
  });
  return upload;
}

export async function uploadAssetFile(input: {
  file: File;
  folderId?: string;
  assetType: string;
  assetRole?: string;
}): Promise<UploadedAsset> {
  const params = new URLSearchParams({
    fileName: input.file.name,
    assetType: input.assetType,
    assetRole: input.assetRole ?? "reference",
    mimeType: input.file.type || "application/octet-stream",
  });
  if (input.folderId) params.set("folderId", input.folderId);
  return api<BackendUploadedAssetResponse>(
    `/api/assets/upload-file?${params.toString()}`,
    {
      method: "POST",
      headers: {
        "Content-Type": input.file.type || "application/octet-stream",
      },
      body: input.file,
      timeoutMs: 60_000,
    }
  );
}

export async function getAsset(id: string): Promise<AssetItem> {
  return api<BackendAssetResponse>(`/api/assets/${encodeURIComponent(id)}`);
}

export async function waitForAssetReady(
  assetId: string,
  options: {
    initialAsset?: AssetItem | null;
    signal?: AbortSignal;
    timeoutMs?: number;
    intervalMs?: number;
  } = {}
): Promise<AssetItem> {
  const timeoutMs = options.timeoutMs ?? 45_000;
  const intervalMs = options.intervalMs ?? 1500;
  const startedAt = Date.now();
  let asset = options.initialAsset ?? null;

  while (true) {
    if (!asset || asset.status === "uploading" || asset.status === "processing") {
      if (Date.now() - startedAt > timeoutMs) {
        throw new Error("素材仍在处理中，请稍后在资产库中选择");
      }
      if (asset) await delay(intervalMs, options.signal);
      asset = await getAsset(assetId);
      continue;
    }

    if (!asset.status || asset.status === "ready") return asset;
    if (asset.status === "failed") {
      throw new Error("素材处理失败，请重新上传");
    }
    throw new Error(`素材状态不可用：${asset.status}`);
  }
}

export async function deleteAssetRemote(id: string): Promise<void> {
  await api<{ ok: boolean }>(`/api/assets/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

/** 风格预设：以后端配置为数据源，前端仅展示与提交 id。 */
export async function listStylePresets(): Promise<StylePreset[]> {
  const { styles } = await api<BackendStylePresetsResponse>("/api/ai/styles");
  return styles;
}

/** 我的作品 */
export async function listMyWorks(): Promise<MediaItem[]> {
  try {
    const { works } = await api<BackendWorksResponse>("/api/works");
    if (works.length === 0) return [];

    const types = Array.from(new Set(works.map((work) => work.type)));
    const models = (
      await Promise.all(
        types.map((type) =>
          listAiModels(type)
            .then((models) => models)
            .catch(() => [])
        )
      )
    ).flat();
    const modelNameById = new Map(models.map((model) => [model.id, model.name]));

    return works.map((work) => ({
      ...work,
      model: modelNameById.get(work.model) ?? work.model,
    }));
  } catch (err) {
    if (DEMO_FALLBACK_ENABLED) return demoMyWorks();
    throw err;
  }
}

/** 我的收藏 */
export async function listMyFavorites(): Promise<MediaItem[]> {
  try {
    const { works } = await api<BackendWorksResponse>("/api/me/favorites");
    return works;
  } catch (err) {
    if (DEMO_FALLBACK_ENABLED) return DEMO_FAVORITES;
    throw err;
  }
}

export async function favoriteWorkRemote(
  id: string,
  favorite: boolean
): Promise<MediaItem | null> {
  const { work } = await api<BackendWorkResponse>(
    `/api/works/${encodeURIComponent(id)}/favorite`,
    {
      method: favorite ? "POST" : "DELETE",
    }
  );
  return work ?? null;
}

export async function deleteWorkRemote(id: string): Promise<void> {
  await api<{ ok: boolean }>(`/api/works/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

export async function downloadWorkRemote(
  id: string
): Promise<BackendWorkDownloadResponse> {
  return api<BackendWorkDownloadResponse>(
    `/api/works/${encodeURIComponent(id)}/download`,
    {
      method: "POST",
    }
  );
}

export async function publishWorkRemote(
  id: string,
  tags: string[] = []
): Promise<MediaItem | null> {
  const { work } = await api<BackendWorkResponse>(
    `/api/works/${encodeURIComponent(id)}/publish`,
    {
      method: "POST",
      body: JSON.stringify({ tags }),
    }
  );
  return work ?? null;
}

export async function unpublishWorkRemote(
  id: string
): Promise<MediaItem | null> {
  const { work } = await api<BackendWorkResponse>(
    `/api/works/${encodeURIComponent(id)}/unpublish`,
    {
      method: "POST",
    }
  );
  return work ?? null;
}

export function isDemoFallbackEnabled() {
  return DEMO_FALLBACK_ENABLED;
}

/** 生成历史 */
export async function listGenerationJobs(): Promise<GenerationJob[]> {
  const { jobs } = await api<BackendJobsResponse>("/api/generation/jobs");
  return jobs.map((job) => ({
    ...job,
    status: toGenerationStatus(job.status),
  }));
}

/** 可用 AI 模型：以后端 EntitleHub 配置为唯一数据源。 */
export async function listAiModels(type: MediaType): Promise<AiModel[]> {
  const { data } = await api<BackendModelsResponse>(
    `/api/ai/models?type=${encodeURIComponent(type)}`
  );
  return data;
}

export interface GenerateHandlers {
  onProgress?: (progress: number) => void;
  signal?: AbortSignal;
}

/** 生成图片/视频/音频：创建 Rust 后端任务，然后轮询到最终状态。 */
export async function generate(
  params: GenerateParams,
  handlers: GenerateHandlers = {}
): Promise<MediaItem[]> {
  const { onProgress, signal } = handlers;
  const createBody = {
    type: params.type,
    prompt: params.prompt,
    model: params.model,
    aspectRatio: params.aspectRatio as AspectRatio,
    resolution: params.resolution,
    count: params.count,
    durationSec:
      params.type === "video" || params.type === "audio"
        ? params.durationSec
        : undefined,
    styleId: params.styleId,
    sourceMode: params.sourceMode,
    referenceAssets: params.referenceAssets,
    referenceAssetIds: params.referenceAssetIds,
    firstFrameAssetId: params.firstFrameAssetId,
    lastFrameAssetId: params.lastFrameAssetId,
  };

  let { job } = await api<BackendJobResponse>("/api/generation/jobs", {
    method: "POST",
    body: JSON.stringify(createBody),
    signal,
  });

  onProgress?.(job.progress);

  while (!["succeeded", "failed", "review", "cancelled"].includes(job.status)) {
    await delay(1200, signal);
    ({ job } = await api<BackendJobResponse>(`/api/generation/jobs/${job.id}`, {
      signal,
    }));
    onProgress?.(job.progress);
  }

  if (job.status === "succeeded") {
    onProgress?.(100);
    return job.results.map((item) => ({
      ...item,
      model: params.modelName ?? item.model,
      resolution: params.resolution ?? item.resolution,
    }));
  }

  throw new Error(job.error ?? "生成失败，请重试");
}

export function estimateCostForModel(params: {
  model?: AiModel;
  type: MediaType;
  count: number;
  durationSec?: number;
}): number {
  const unit = billingUnitCost(params.model);
  const base = billingBaseCost(params.model);
  if (
    params.type === "video" ||
    params.type === "audio" ||
    params.model?.billing.mode.includes("second") ||
    params.model?.billing.mode.includes("minute")
  ) {
    return base + unit * (params.durationSec ?? params.model?.capabilities.defaultDurationSeconds ?? 1);
  }
  return base + unit * params.count;
}
