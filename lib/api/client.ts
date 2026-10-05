/**
 * 影织 · 前端数据访问层（单一替换点）
 *
 * 浏览器只通过影织同源代理访问 New API Studio 接口。
 */
import { MOCK_USER } from "@/data/mock/config";
import { GALLERY, getGalleryByType, DEMO_FAVORITES } from "@/data/mock/gallery";
import {
  normalizeStudioCardShopOptions,
  type StudioCardShopOption,
} from "@/lib/api/topup-options";
import type {
  ApiKeyInfo,
  AiModelType,
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
  PlatformNavigation,
  PlatformSSOStartResponse,
  StylePreset,
  UsageSummary,
  UploadedAsset,
  User,
} from "@/lib/api/types";

const configuredApiBase = process.env.NEXT_PUBLIC_API_BASE_URL?.replace(
  /\/$/,
  "",
);
const API_BASE =
  configuredApiBase ??
  "/api";
const DEFAULT_API_TIMEOUT_MS = 8000;
const DEMO_FALLBACK_ENABLED = process.env.NEXT_PUBLIC_DEMO_FALLBACK === "1";
const NEW_ACCESS_TOKEN_KEY = "shadowweave.new_api.access_token";
const QUOTA_PER_UNIT = 500_000;
const GENERATION_CREATE_TIMEOUT_MS = 120_000;
let refreshPromise: Promise<boolean> | null = null;

function getNewAccessToken() {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(NEW_ACCESS_TOKEN_KEY) ?? "";
}

function setNewAccessToken(token: string) {
  if (typeof window === "undefined") return;
  if (token) window.localStorage.setItem(NEW_ACCESS_TOKEN_KEY, token);
  else window.localStorage.removeItem(NEW_ACCESS_TOKEN_KEY);
}

function studioPath(path: string) {
  return `/api/studio${path}`;
}

function apiUrl(path: string) {
  if (API_BASE.endsWith("/api") && path.startsWith("/api/")) {
    return `${API_BASE}${path.slice(4)}`;
  }
  return `${API_BASE}${path}`;
}

type BackendJobStatus =
  | "submitting"
  | "recovery_pending"
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
  routeId?: string;
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

interface BackendOptionalJobResponse {
  job: BackendJob | null;
}

interface BackendJobsResponse {
  jobs: BackendJob[];
}

interface NewUserProjection {
  id?: number | string;
  username?: string;
  display_name?: string;
  displayName?: string;
  email?: string;
  quota?: number;
  used_quota?: number;
  usedQuota?: number;
  canvas_enabled?: boolean;
}

type QuotaDisplayType = "USD" | "CNY" | "TOKENS" | "CUSTOM";

interface StudioQuotaDisplayConfig {
  quotaPerUnit: number;
  quotaDisplayType: QuotaDisplayType;
  usdExchangeRate: number;
  customCurrencySymbol: string;
  customCurrencyExchangeRate: number;
}

const DEFAULT_QUOTA_DISPLAY_CONFIG: StudioQuotaDisplayConfig = {
  quotaPerUnit: QUOTA_PER_UNIT,
  quotaDisplayType: "USD",
  usdExchangeRate: 1,
  customCurrencySymbol: "¤",
  customCurrencyExchangeRate: 1,
};

let currentQuotaDisplayConfig = DEFAULT_QUOTA_DISPLAY_CONFIG;

function positiveNumber(value: unknown, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function quotaDisplayConfig(status?: BackendAuthStatus): StudioQuotaDisplayConfig {
  if (!status) return currentQuotaDisplayConfig;
  const displayType = status.quota_display_type;
  currentQuotaDisplayConfig = {
    quotaPerUnit: positiveNumber(status.quota_per_unit, QUOTA_PER_UNIT),
    quotaDisplayType:
      displayType === "CNY" ||
      displayType === "TOKENS" ||
      displayType === "CUSTOM"
        ? displayType
        : "USD",
    usdExchangeRate: positiveNumber(status.usd_exchange_rate, 1),
    customCurrencySymbol:
      status.custom_currency_symbol?.trim() ||
      DEFAULT_QUOTA_DISPLAY_CONFIG.customCurrencySymbol,
    customCurrencyExchangeRate: positiveNumber(
      status.custom_currency_exchange_rate,
      1,
    ),
  };
  return currentQuotaDisplayConfig;
}

function studioQuotaAmount(
  quota: number,
  config: StudioQuotaDisplayConfig,
): number {
  const amountUsd = quota / config.quotaPerUnit;
  if (config.quotaDisplayType === "CNY") {
    return amountUsd * config.usdExchangeRate;
  }
  if (config.quotaDisplayType === "CUSTOM") {
    return amountUsd * config.customCurrencyExchangeRate;
  }
  return amountUsd;
}

function studioQuotaMaximumFractionDigits(amount: number): number {
  return Math.abs(amount) >= 1 ? 2 : 4;
}

function studioQuotaCurrencySymbol(config: StudioQuotaDisplayConfig): string {
  if (config.quotaDisplayType === "CUSTOM") {
    return config.customCurrencySymbol;
  }
  if (config.quotaDisplayType === "TOKENS") return "";

  return (
    new Intl.NumberFormat("zh-CN", {
      style: "currency",
      currency: config.quotaDisplayType,
      currencyDisplay: "narrowSymbol",
    })
      .formatToParts(0)
      .find((part) => part.type === "currency")?.value ?? config.quotaDisplayType
  );
}

export function formatStudioQuota(
  quota: number,
  config = currentQuotaDisplayConfig,
): string {
  if (!Number.isFinite(quota)) return "-";
  if (config.quotaDisplayType === "TOKENS") {
    return new Intl.NumberFormat("zh-CN", {
      maximumFractionDigits: 0,
    }).format(quota);
  }

  const amount = studioQuotaAmount(quota, config);
  const maximumFractionDigits = studioQuotaMaximumFractionDigits(amount);
  if (config.quotaDisplayType === "CUSTOM") {
    return `${config.customCurrencySymbol} ${new Intl.NumberFormat("zh-CN", {
      maximumFractionDigits,
    }).format(amount)}`;
  }
  return new Intl.NumberFormat("zh-CN", {
    style: "currency",
    currency: config.quotaDisplayType,
    currencyDisplay: "narrowSymbol",
    minimumFractionDigits: 0,
    maximumFractionDigits,
  }).format(amount);
}

/** 格式化为金额在前、币种符号在后的显示形式，供紧凑价格标签使用。 */
export function formatStudioQuotaWithSuffix(
  quota: number,
  config = currentQuotaDisplayConfig,
): string {
  if (!Number.isFinite(quota)) return "-";
  if (config.quotaDisplayType === "TOKENS") {
    return new Intl.NumberFormat("zh-CN", {
      maximumFractionDigits: 0,
    }).format(quota);
  }

  const amount = studioQuotaAmount(quota, config);
  const amountLabel = new Intl.NumberFormat("zh-CN", {
    maximumFractionDigits: studioQuotaMaximumFractionDigits(amount),
  }).format(amount);
  return `${amountLabel}${studioQuotaCurrencySymbol(config)}`;
}

function normalizeNewUser(
  raw: NewUserProjection,
  status?: BackendAuthStatus,
): User {
  const id = String(raw.id ?? raw.username ?? "");
  const name =
    raw.display_name?.trim() ||
    raw.displayName?.trim() ||
    raw.username?.trim() ||
    raw.email?.split("@", 1)[0] ||
    "影织用户";
  const quota = Number(raw.quota ?? 0);
  const usedQuota = Number(raw.used_quota ?? raw.usedQuota ?? 0);
  const displayConfig = quotaDisplayConfig(status);
  const credits = quota / displayConfig.quotaPerUnit;
  const used = usedQuota / displayConfig.quotaPerUnit;
  return {
    id,
    name,
    email: raw.email ?? "",
    avatarSeed: id || name,
    plan: "New API 用户",
    canvasEnabled: raw.canvas_enabled === true,
    quota,
    balanceDisplay: formatStudioQuota(quota, displayConfig),
    credits: Number.isFinite(credits) ? credits : 0,
    creditsTotal: Number.isFinite(credits + used) ? credits + used : 0,
  };
}

function normalizeTimestamp(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return Date.now();
  return value < 1_000_000_000_000 ? value * 1000 : value;
}

function defaultAspectRatio(type: MediaType): AspectRatio {
  return type === "video" ? "16:9" : "1:1";
}

function normalizeMediaItem(
  item: MediaItem,
  fallback: Partial<
    Pick<MediaItem, "aspectRatio" | "resolution" | "durationSec">
  > = {},
): MediaItem {
  const aspectRatio =
    item.aspectRatio?.trim() ||
    fallback.aspectRatio?.trim() ||
    defaultAspectRatio(item.type);
  return {
    ...item,
    seed: item.seed || item.id,
    category: item.category ?? "abstract",
    aspectRatio,
    resolution: item.resolution || fallback.resolution,
    durationSec: item.durationSec || fallback.durationSec,
    likes: Number.isFinite(item.likes) ? item.likes : 0,
    createdAt: normalizeTimestamp(item.createdAt),
    author: item.author ?? {
      id: "studio",
      name: "影织用户",
      avatarSeed: "studio",
    },
  };
}

interface BackendAuthResponse {
  user?: NewUserProjection;
  access_token?: string;
  require_2fa?: boolean;
  flow_token?: string;
  requires_2fa?: boolean;
  temp_token?: string;
  user_email_masked?: string;
}

export interface StudioAuthConfig {
  registerEnabled: boolean;
  passwordRegisterEnabled: boolean;
  emailVerificationEnabled: boolean;
  turnstileEnabled: boolean;
  turnstileSiteKey: string;
}

export type StudioLoginResult =
  | { kind: "authenticated"; user: User }
  | { kind: "two_factor_required"; flowToken: string };

interface BackendAuthStatus {
  register_enabled?: boolean;
  password_register_enabled?: boolean;
  email_verification?: boolean;
  registration_enabled?: boolean;
  email_verify_enabled?: boolean;
  turnstile_enabled?: boolean;
  turnstile_check?: boolean;
  turnstile_site_key?: string;
  quota_per_unit?: number;
  quota_display_type?: string;
  usd_exchange_rate?: number;
  custom_currency_symbol?: string;
  custom_currency_exchange_rate?: number;
}

interface PasswordEncryptionKey {
  enabled: boolean;
  kid?: string;
  public_key?: string;
}

export interface StudioTopUpInfo {
  enableRedemption: boolean;
  cardShopOptions: StudioCardShopOption[];
  usdExchangeRate: number;
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

export interface StudioVideoRetention {
  retentionDays: number;
  expiresAt: number;
}

type BackendGalleryResponse = BackendWorksResponse;

interface BackendModelsResponse {
  data: AiModel[];
}

interface BackendPricingPlansResponse {
  plans: PricingPlan[];
}

type BackendUsageResponse = UsageSummary;

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
      { once: true },
    );
  });

function billingUnit(model?: AiModel): "second" | "request" {
  if (!model) return "request";
  if (model.billing.unit === "second" || model.billing.unit === "request") {
    return model.billing.unit;
  }

  const mode = model.billing.mode.toLowerCase();
  return mode.includes("second") || mode.includes("minute")
    ? "second"
    : "request";
}

function billingUnitCost(
  model?: AiModel,
  type?: MediaType,
  resolution?: string,
): number {
  if (!model) return 0;

  const billing = model.billing;
  if (billingUnit(model) === "second") {
    const normalizedResolution = resolution?.trim().toLowerCase();
    const resolutionPrice =
      type === "video" && normalizedResolution
        ? billing.secondResolutionPricesMinor?.[normalizedResolution] ??
          Object.entries(billing.secondResolutionPricesMinor ?? {}).find(
            ([key]) => key.trim().toLowerCase() === normalizedResolution,
          )?.[1]
        : undefined;

    if (resolutionPrice !== undefined) return resolutionPrice;

    // New API exposes UnitPriceMinor with the selected group ratio already
    // applied. It is the amount for one second, not the whole task. Use it
    // when no per-resolution video price is configured for the selection.
    return (
      billing.unitPriceMinor ??
      billing.secondPriceMinor ??
      billing.requestPriceMinor ??
      0
    );
  }

  if (type === "video" && resolution) {
    const normalizedResolution = resolution.trim().toLowerCase();
    const resolutionPrice =
      billing.requestResolutionPricesMinor?.[normalizedResolution] ??
      Object.entries(billing.requestResolutionPricesMinor ?? {}).find(
        ([key]) => key.trim().toLowerCase() === normalizedResolution,
      )?.[1];
    if (resolutionPrice !== undefined) return resolutionPrice;
  }

  if (type === "image") {
    const resolutionPrice = resolution
      ? billing.imageResolutionPricesMinor?.[resolution.toUpperCase()]
      : undefined;
    return (
      resolutionPrice ??
      billing.imagePriceMinor ??
      billing.unitPriceMinor ??
      billing.requestPriceMinor ??
      0
    );
  }

  return (
    billing.requestPriceMinor ??
    billing.unitPriceMinor ??
    billing.imagePriceMinor ??
    0
  );
}

function toGenerationStatus(status: BackendJobStatus): JobStatus {
  if (
    status === "succeeded" ||
    status === "failed" ||
    status === "queued" ||
    status === "review" ||
    status === "cancelled"
  ) {
    return status;
  }
  return "running";
}

function normalizeGenerationJob(
  job: BackendJob,
  fallback: Partial<
    Pick<GenerationJob, "model" | "aspectRatio" | "resolution" | "durationSec">
  > = {},
): GenerationJob {
  return {
    ...job,
    serverId: job.id,
    status: toGenerationStatus(job.status),
    model: fallback.model ?? job.model,
    aspectRatio: job.aspectRatio || fallback.aspectRatio || "1:1",
    resolution: job.resolution || fallback.resolution,
    durationSec: job.durationSec || fallback.durationSec,
    createdAt: normalizeTimestamp(job.createdAt),
    results: job.results.map((item) =>
      normalizeMediaItem(
        {
          ...item,
          model: fallback.model ?? item.model,
          resolution: fallback.resolution ?? item.resolution,
        },
        {
          aspectRatio: job.aspectRatio || fallback.aspectRatio,
          resolution: job.resolution || fallback.resolution,
          durationSec: job.durationSec || fallback.durationSec,
        },
      ),
    ),
    syncState: "synced",
    syncError: undefined,
  };
}

function withGenerationPresentation(
  job: GenerationJob,
  params: GenerateParams,
): GenerationJob {
  return {
    ...job,
    modelId: params.model,
    model: params.modelName ?? params.model,
    modelName: params.modelName,
    routeId: params.routeId ?? job.routeId,
    routeName: params.routeName ?? job.routeName,
    aspectRatio: params.aspectRatio,
    resolution: params.resolution ?? job.resolution,
    durationSec: params.durationSec ?? job.durationSec,
    sourceMode: params.sourceMode,
    referenceCount:
      params.referenceAssets?.length ?? params.referenceAssetIds?.length ?? 0,
    hasFirstFrame:
      Boolean(params.firstFrameAssetId) ||
      Boolean(
        params.referenceAssets?.some((asset) => asset.role === "first_frame"),
      ),
    hasLastFrame:
      Boolean(params.lastFrameAssetId) ||
      Boolean(
        params.referenceAssets?.some((asset) => asset.role === "last_frame"),
      ),
    results: job.results.map((item) => ({
      ...item,
      model: params.modelName ?? item.model,
      resolution: params.resolution ?? item.resolution,
    })),
  };
}

function isTerminalGenerationStatus(status: JobStatus) {
  return ["succeeded", "failed", "review", "cancelled"].includes(status);
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

export class ApiClientError extends Error {
  status: number;
  code?: string;
  requestId?: string;
  upstreamStatus?: number;

  constructor(
    message: string,
    options: {
      status: number;
      code?: string;
      requestId?: string;
      upstreamStatus?: number;
    },
  ) {
    super(message);
    this.name = "ApiClientError";
    this.status = options.status;
    this.code = options.code;
    this.requestId = options.requestId;
    this.upstreamStatus = options.upstreamStatus;
  }
}

export class GenerationSyncError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GenerationSyncError";
  }
}

async function refreshNewAccessToken(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  if (!refreshPromise) {
    refreshPromise = (async () => {
      try {
        const res = await fetch(apiUrl(studioPath("/auth/refresh")), {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
        });
        const body = await res.json().catch(() => null);
        const token = body?.data?.access_token;
        if (
          !res.ok ||
          body?.success === false ||
          typeof token !== "string" ||
          !token
        ) {
          setNewAccessToken("");
          return false;
        }
        setNewAccessToken(token);
        return true;
      } catch {
        return false;
      }
    })().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

function sessionAccessToken() {
  return getNewAccessToken();
}

async function api<T>(
  path: string,
  init: ApiInit = {},
  allowRefresh = true,
): Promise<T> {
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
    res = await fetch(apiUrl(path), {
      ...requestInit,
      credentials: "include",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        ...(sessionAccessToken()
          ? { Authorization: `Bearer ${sessionAccessToken()}` }
          : {}),
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
  if (
    res.status === 401 &&
    allowRefresh &&
    !path.endsWith("/auth/login") &&
    !path.endsWith("/auth/refresh") &&
    !path.endsWith("/auth/logout") &&
    (await refreshNewAccessToken())
  ) {
    return api<T>(path, init, false);
  }
  if (!res.ok || body?.success === false) {
    const rawMessage =
      body?.message ?? body?.error ?? `请求失败：HTTP ${res.status}`;
    const message =
      res.status === 429 ? "当前请求过多，请稍后再试" : rawMessage;
    throw new ApiClientError(message, {
      status: res.status,
      code: body?.code ?? body?.errorCode ?? body?.error_code,
      requestId: body?.requestId ?? body?.request_id,
      upstreamStatus: body?.upstreamStatus ?? body?.upstream_status,
    });
  }
  if (
    body?.success === true &&
    Object.prototype.hasOwnProperty.call(body, "data")
  ) {
    return body.data as T;
  }
  return body as T;
}

export async function fetchStudioMedia(sourceUrl: string): Promise<Response> {
  const request = () =>
    fetch(apiUrl(sourceUrl), {
      credentials: "include",
      headers:
        sessionAccessToken()
          ? { Authorization: `Bearer ${sessionAccessToken()}` }
          : undefined,
    });
  let response = await request();
  if (response.status === 401) {
    const refreshed = await refreshNewAccessToken();
    if (refreshed) response = await request();
  }
  return response;
}

/** Resolve a Studio media path for native browser media elements. */
export function studioMediaUrl(sourceUrl: string): string {
  return apiUrl(sourceUrl);
}

/** 灵感广场列表 */
export async function listGallery(type?: MediaType): Promise<MediaItem[]> {
  try {
    const query = type ? `?type=${encodeURIComponent(type)}` : "";
    const { works } = await api<BackendGalleryResponse>(
      `${studioPath("/gallery")}${query}`,
    );
    return works.map((item) => normalizeMediaItem(item));
  } catch (err) {
    if (DEMO_FALLBACK_ENABLED) return getGalleryByType(type);
    throw err;
  }
}

/** 当前用户 */
export async function getUser(): Promise<User> {
  const [{ user, wallet }, status] = await Promise.all([
    api<{
      user: NewUserProjection;
      wallet?: Pick<NewUserProjection, "quota" | "used_quota">;
    }>(studioPath("/bootstrap")),
    api<BackendAuthStatus>("/api/status").catch(() => undefined),
  ]);
  return normalizeNewUser(
    {
      ...user,
      quota: wallet?.quota ?? user.quota,
      used_quota: wallet?.used_quota ?? user.used_quota,
    },
    status,
  );
}

export async function getPublicPlatformNavigation(): Promise<PlatformNavigation> {
  return api<PlatformNavigation>("/api/public/navigation");
}

export async function startNewApiSSO(): Promise<PlatformSSOStartResponse> {
  return api<PlatformSSOStartResponse>(studioPath("/sso/start"), {
    method: "POST",
  });
}

export async function getStudioAuthConfig(): Promise<StudioAuthConfig> {
  const status = await api<BackendAuthStatus>("/api/status");
  quotaDisplayConfig(status);
  return {
    registerEnabled: status.register_enabled !== false,
    passwordRegisterEnabled: status.password_register_enabled !== false,
    emailVerificationEnabled: status.email_verification === true,
    turnstileEnabled:
      status.turnstile_check === true && Boolean(status.turnstile_site_key),
    turnstileSiteKey: status.turnstile_site_key ?? "",
  };
}

async function encryptStudioPassword(password: string) {
  const key = await api<PasswordEncryptionKey>(
    studioPath("/auth/encryption-key"),
  );
  if (!key.enabled) return { password };
  if (!key.kid || !key.public_key) {
    throw new Error("安全登录密钥暂时不可用，请稍后重试");
  }
  if (!globalThis.crypto?.subtle) {
    throw new Error("当前浏览器不支持安全密码登录");
  }
  const pem = key.public_key
    .replace("-----BEGIN PUBLIC KEY-----", "")
    .replace("-----END PUBLIC KEY-----", "")
    .replace(/\s+/g, "");
  const binary = atob(pem);
  const der = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    der[index] = binary.charCodeAt(index);
  }
  const publicKey = await globalThis.crypto.subtle.importKey(
    "spki",
    der.buffer,
    { name: "RSA-OAEP", hash: "SHA-256" },
    false,
    ["encrypt"],
  );
  const ciphertext = await globalThis.crypto.subtle.encrypt(
    { name: "RSA-OAEP" },
    publicKey,
    new TextEncoder().encode(password),
  );
  const bytes = new Uint8Array(ciphertext);
  let encoded = "";
  for (const byte of bytes) encoded += String.fromCharCode(byte);
  return {
    password_encrypted: btoa(encoded),
    encryption_key_id: key.kid,
  };
}

function finishStudioLogin(data: BackendAuthResponse): StudioLoginResult {
  if (data.require_2fa && data.flow_token) {
    return { kind: "two_factor_required", flowToken: data.flow_token };
  }
  if (data.requires_2fa && data.temp_token) {
    return { kind: "two_factor_required", flowToken: data.temp_token };
  }
  if (!data.user) throw new Error("登录响应缺少用户信息");
  if (data.access_token) setNewAccessToken(data.access_token);
  return {
    kind: "authenticated",
    user: normalizeNewUser(data.user),
  };
}

/** 使用 New API 统一账号登录；刷新凭据保存在 HttpOnly Cookie 中。 */
export async function loginWithPassword(input: {
  email: string;
  password: string;
  turnstileToken?: string;
}): Promise<StudioLoginResult> {
  const passwordFields = await encryptStudioPassword(input.password);
  const query = input.turnstileToken
    ? `?turnstile=${encodeURIComponent(input.turnstileToken)}`
    : "";
  const data = await api<BackendAuthResponse>(
    `${studioPath("/auth/login")}${query}`,
    {
      method: "POST",
      body: JSON.stringify({ email: input.email, ...passwordFields }),
    },
  );
  return finishStudioLogin(data);
}

export async function verifyStudioTwoFactor(input: {
  flowToken: string;
  code: string;
}): Promise<User> {
  const data = await api<BackendAuthResponse>(studioPath("/auth/login/2fa"), {
    method: "POST",
    body: JSON.stringify({
      flow_token: input.flowToken,
      code: input.code,
    }),
  });
  const result = finishStudioLogin(data);
  if (result.kind !== "authenticated") {
    throw new Error("两步验证未完成");
  }
  return result.user;
}

export async function registerStudioUser(input: {
  email: string;
  password: string;
  verificationCode?: string;
  affCode?: string;
  turnstileToken?: string;
}): Promise<void> {
  const query = input.turnstileToken
    ? `?turnstile=${encodeURIComponent(input.turnstileToken)}`
    : "";
  await api(`${studioPath("/auth/register")}${query}`, {
    method: "POST",
    body: JSON.stringify({
      email: input.email,
      password: input.password,
      verification_code: input.verificationCode,
      aff_code: input.affCode,
    }),
  });
}

export async function sendStudioEmailVerification(input: {
  email: string;
  turnstileToken?: string;
}): Promise<void> {
  const params = new URLSearchParams({ email: input.email });
  if (input.turnstileToken) params.set("turnstile", input.turnstileToken);
  await api(`/api/verification?${params.toString()}`);
}

export async function logoutRemote(): Promise<void> {
  try {
    await api<{ ok: boolean }>(studioPath("/auth/logout"), {
      method: "POST",
    });
  } finally {
    setNewAccessToken("");
  }
}

/** 当前用户用量统计 */
export async function getUsageSummary(): Promise<UsageSummary> {
  const data = await api<BackendUsageResponse & { daily_credits?: number[] }>(
    studioPath("/usage"),
  );
  return {
    ...data,
    dailyCredits: data.dailyCredits ?? data.daily_credits ?? [],
  };
}

/** 当前用户 API Key 展示信息，只返回脱敏密钥。 */
export async function getApiKeyInfo(): Promise<ApiKeyInfo> {
  const data = await api<{ managed?: boolean }>(studioPath("/credential"));
  return {
    maskedKey: data.managed ? "由平台托管" : "暂未创建",
    endpoint: "",
    enabled: data.managed === true,
  };
}

export async function getStudioTopUpInfo(): Promise<StudioTopUpInfo> {
  const [data, status] = await Promise.all([
    api<{
      enable_redemption?: boolean;
      card_shop_options?: unknown;
    }>(studioPath("/topup/info")),
    api<BackendAuthStatus>("/api/status").catch(() => undefined),
  ]);
  const enableRedemption = data.enable_redemption !== false;
  const cardShopOptions = normalizeStudioCardShopOptions(
    data.enable_redemption,
    data.card_shop_options,
  );

  return {
    enableRedemption,
    cardShopOptions,
    usdExchangeRate:
      status?.quota_display_type === "USD"
        ? 1
        : positiveNumber(status?.usd_exchange_rate, 1),
  };
}

export async function redeemStudioCode(code: string): Promise<number> {
  return api<number>(studioPath("/topup"), {
    method: "POST",
    body: JSON.stringify({ key: code.trim() }),
  });
}

/** 可用套餐：以 New API 配置为数据源，前端只展示。 */
export async function listPricingPlans(): Promise<PricingPlan[]> {
  const { plans } = await api<BackendPricingPlansResponse>(
    studioPath("/billing/plans"),
  );
  return plans;
}

/** 素材资产库 */
export async function listAssets(
  filters: {
    kind?: "image" | "video" | "audio" | "file" | string;
    source?: string;
    assetRole?: string;
    page?: number;
    pageSize?: number;
  } = {},
): Promise<AssetsLibrary> {
  const params = new URLSearchParams();
  if (filters.kind) params.set("type", filters.kind);
  if (filters.source) params.set("source", filters.source);
  if (filters.assetRole) params.set("asset_role", filters.assetRole);
  if (filters.page) params.set("page", String(filters.page));
  if (filters.pageSize) params.set("page_size", String(filters.pageSize));
  const query = params.toString();
  return api<BackendAssetsResponse>(
    `${studioPath("/assets")}${query ? `?${query}` : ""}`,
  );
}

export async function createAssetFolder(input: {
  name: string;
  parentId?: string;
  kind?: string;
}): Promise<AssetFolder> {
  const { folder } = await api<BackendAssetFolderResponse>(
    studioPath("/assets/folders"),
    {
      method: "POST",
      body: JSON.stringify(input),
    },
  );
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
  const { upload } = await api<BackendAssetUploadResponse>(
    studioPath("/assets/upload-url"),
    {
      method: "POST",
      body: JSON.stringify(input),
    },
  );
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
    `${studioPath("/assets/upload-file")}?${params.toString()}`,
    {
      method: "POST",
      headers: {
        "Content-Type": input.file.type || "application/octet-stream",
      },
      body: input.file,
      timeoutMs: 60_000,
    },
  );
}

export async function getAsset(id: string): Promise<AssetItem> {
  return api<BackendAssetResponse>(
    studioPath(`/assets/${encodeURIComponent(id)}`),
  );
}

export async function waitForAssetReady(
  assetId: string,
  options: {
    initialAsset?: AssetItem | null;
    signal?: AbortSignal;
    timeoutMs?: number;
    intervalMs?: number;
  } = {},
): Promise<AssetItem> {
  const timeoutMs = options.timeoutMs ?? 45_000;
  const intervalMs = options.intervalMs ?? 1500;
  const startedAt = Date.now();
  let asset = options.initialAsset ?? null;

  while (true) {
    if (
      !asset ||
      asset.status === "uploading" ||
      asset.status === "processing"
    ) {
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
  await api<{ ok: boolean }>(
    studioPath(`/assets/${encodeURIComponent(id)}`),
    {
      method: "DELETE",
    },
  );
}

/** 风格预设：以后端配置为数据源，前端仅展示与提交 id。 */
export async function listStylePresets(): Promise<StylePreset[]> {
  const { styles } = await api<BackendStylePresetsResponse>(
    studioPath("/ai/styles"),
  );
  return styles;
}

/** 我的作品 */
export async function listMyWorks(): Promise<MediaItem[]> {
  try {
    const { works } = await api<BackendWorksResponse>(studioPath("/works"));
    if (works.length === 0) return [];

    const types = Array.from(new Set(works.map((work) => work.type)));
    const models = (
      await Promise.all(
        types.map((type) =>
          listAiModels(type)
            .then((models) => models)
            .catch(() => []),
        ),
      )
    ).flat();
    const modelNameById = new Map(
      models.map((model) => [model.id, model.name]),
    );

    return works.map((work) =>
      normalizeMediaItem({
        ...work,
        model: modelNameById.get(work.model) ?? work.model,
      }),
    );
  } catch (err) {
    if (DEMO_FALLBACK_ENABLED) return demoMyWorks();
    throw err;
  }
}

/** 我的收藏 */
export async function listMyFavorites(): Promise<MediaItem[]> {
  try {
    const { works } = await api<BackendWorksResponse>(
      studioPath("/favorites"),
    );
    return works.map((item) => normalizeMediaItem(item));
  } catch (err) {
    if (DEMO_FALLBACK_ENABLED) return DEMO_FAVORITES;
    throw err;
  }
}

export async function favoriteWorkRemote(
  id: string,
  favorite: boolean,
): Promise<MediaItem | null> {
  const { work } = await api<BackendWorkResponse>(
    `${studioPath("/works")}/${encodeURIComponent(id)}/favorite`,
    {
      method: favorite ? "POST" : "DELETE",
    },
  );
  return work ?? null;
}

export async function getStudioVideoRetention(
  id: string,
): Promise<StudioVideoRetention> {
  return api<StudioVideoRetention>(
    `${studioPath("/works")}/${encodeURIComponent(id)}/retention`,
  );
}

export async function setStudioVideoRetention(
  id: string,
  retentionDays: number,
): Promise<StudioVideoRetention> {
  return api<StudioVideoRetention>(
    `${studioPath("/works")}/${encodeURIComponent(id)}/retention`,
    {
      method: "PUT",
      body: JSON.stringify({ retentionDays }),
    },
  );
}

export async function deleteWorkRemote(id: string): Promise<void> {
  await api<{ ok: boolean }>(
    `${studioPath("/works")}/${encodeURIComponent(id)}`,
    {
      method: "DELETE",
    },
  );
}

export async function downloadWorkRemote(
  id: string,
): Promise<BackendWorkDownloadResponse> {
  return api<BackendWorkDownloadResponse>(
    `${studioPath("/works")}/${encodeURIComponent(id)}/download`,
    {
      method: "POST",
    },
  );
}

export async function publishWorkRemote(
  id: string,
  tags: string[] = [],
): Promise<MediaItem | null> {
  const { work } = await api<BackendWorkResponse>(
    `${studioPath("/works")}/${encodeURIComponent(id)}/publish`,
    {
      method: "POST",
      body: JSON.stringify({ tags }),
    },
  );
  return work ?? null;
}

export async function unpublishWorkRemote(
  id: string,
): Promise<MediaItem | null> {
  const { work } = await api<BackendWorkResponse>(
    `${studioPath("/works")}/${encodeURIComponent(id)}/unpublish`,
    {
      method: "POST",
    },
  );
  return work ?? null;
}

export function isDemoFallbackEnabled() {
  return DEMO_FALLBACK_ENABLED;
}

/** 生成历史 */
export async function listGenerationJobs(): Promise<GenerationJob[]> {
  const { jobs } = await api<BackendJobsResponse>(
    studioPath("/generation/jobs"),
  );
  return jobs.map((job) => normalizeGenerationJob(job));
}

/** 查询一个已持久化的生成任务。 */
export async function getGenerationJob(
  jobId: string,
  signal?: AbortSignal,
): Promise<GenerationJob> {
  const { job } = await api<BackendJobResponse>(
    studioPath(`/generation/jobs/${encodeURIComponent(jobId)}`),
    { signal },
  );
  return normalizeGenerationJob(job);
}

/**
 * 用创建请求的幂等键找回服务端任务。创建请求仍在等待上游时，任务行已经存在，
 * 因而卡片不需要等原始请求结束就能开始同步真实状态。
 */
export async function findGenerationJobByIdempotencyKey(
  idempotencyKey: string,
  signal?: AbortSignal,
): Promise<GenerationJob | null> {
  const params = new URLSearchParams({ idempotencyKey });
  const { job } = await api<BackendOptionalJobResponse>(
    `${studioPath("/generation/jobs/lookup")}?${params.toString()}`,
    { signal },
  );
  return job ? normalizeGenerationJob(job) : null;
}

function copyModelBilling(billing: AiModel["billing"]): AiModel["billing"] {
  return {
    ...billing,
    secondResolutionPricesMinor: billing.secondResolutionPricesMinor
      ? { ...billing.secondResolutionPricesMinor }
      : billing.secondResolutionPricesMinor,
    requestResolutionPricesMinor: billing.requestResolutionPricesMinor
      ? { ...billing.requestResolutionPricesMinor }
      : billing.requestResolutionPricesMinor,
  };
}

/** 可用 AI 模型：以 New API 配置为唯一数据源。 */
export async function listAiModels(type: AiModelType): Promise<AiModel[]> {
  const { data } = await api<BackendModelsResponse>(
    `${studioPath("/ai/models")}?type=${encodeURIComponent(type)}`,
  );
  const ordered = [...data].sort((left, right) => {
    const leftOrder = left.sortOrder ?? 0;
    const rightOrder = right.sortOrder ?? 0;
    if (leftOrder !== rightOrder) {
      if (leftOrder === 0) return 1;
      if (rightOrder === 0) return -1;
      return leftOrder - rightOrder;
    }
    const leftName = left.name.trim().toLowerCase();
    const rightName = right.name.trim().toLowerCase();
    if (leftName !== rightName) return leftName < rightName ? -1 : 1;
    return left.id < right.id ? -1 : left.id > right.id ? 1 : 0;
  });
  return ordered.map((model) => ({
    ...model,
    billing: copyModelBilling(model.billing),
    routes: model.routes?.map((route) => ({
      ...route,
      billing: copyModelBilling(route.billing),
    })),
  }));
}

export interface GenerateHandlers {
  onProgress?: (progress: number) => void;
  onRequest?: (idempotencyKey: string) => void;
  onJob?: (job: GenerationJob) => void;
  onSyncError?: (message: string) => void;
  signal?: AbortSignal;
}

/** 生成图片/视频/音频：创建 New API Studio 任务，然后轮询到最终状态。 */
export async function generate(
  params: GenerateParams,
  handlers: GenerateHandlers = {},
): Promise<MediaItem[]> {
  const { onProgress, onRequest, onJob, onSyncError, signal } = handlers;
  const idempotencyKey =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `studio-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  onRequest?.(idempotencyKey);
  const createBody = {
    type: params.type,
    prompt: params.prompt,
    model: params.model,
    routeId: params.routeId,
    aspectRatio: params.aspectRatio as AspectRatio,
    resolution: params.resolution,
    count: params.count,
    durationSec:
      params.type === "video" || params.type === "audio"
        ? params.durationSec
        : undefined,
    styleId:
      params.styleId && params.styleId !== "none" ? params.styleId : undefined,
    sourceMode: params.sourceMode,
    referenceAssets: params.referenceAssets,
    referenceAssetIds: params.referenceAssetIds,
    firstFrameAssetId: params.firstFrameAssetId,
    lastFrameAssetId: params.lastFrameAssetId,
    voice: params.voice,
    idempotencyKey,
  };

  const createJob = api<BackendJobResponse>(
    studioPath("/generation/jobs"),
    {
      method: "POST",
      body: JSON.stringify(createBody),
      signal,
      timeoutMs: GENERATION_CREATE_TIMEOUT_MS,
    },
  ).then(({ job }) => normalizeGenerationJob(job));

  const lookupController = new AbortController();
  const abortLookup = () => lookupController.abort(signal?.reason);
  if (signal?.aborted) abortLookup();
  else signal?.addEventListener("abort", abortLookup, { once: true });

  const lookupJob = (async () => {
    while (true) {
      await delay(800, lookupController.signal);
      try {
        const job = await findGenerationJobByIdempotencyKey(
          idempotencyKey,
          lookupController.signal,
        );
        if (job) return job;
      } catch (err) {
        if (lookupController.signal.aborted) throw err;
        onSyncError?.(
          err instanceof Error ? err.message : "任务状态同步暂时中断",
        );
      }
    }
  })();

  const createOutcome = createJob.then(
    (job) => ({ kind: "job" as const, job }),
    (error: unknown) => ({ kind: "error" as const, error }),
  );

  let job: GenerationJob;
  try {
    const first = await Promise.race([
      createOutcome,
      lookupJob.then((job) => ({ kind: "job" as const, job })),
    ]);
    if (first.kind === "job") {
      job = first.job;
    } else {
      const message =
        first.error instanceof Error
          ? first.error.message
          : "创建响应丢失，正在找回任务";
      onSyncError?.(message);
      const uncertain =
        !(first.error instanceof ApiClientError) ||
        first.error.status === 408 ||
        first.error.status >= 500;
      const recovered = await Promise.race([
        lookupJob,
        delay(uncertain ? 15_000 : 1500, signal).then(() => null),
      ]);
      if (recovered) {
        job = recovered;
      } else if (!uncertain) {
        throw first.error;
      } else {
        throw new GenerationSyncError(
          "创建响应丢失，任务状态将在网络恢复后自动同步",
        );
      }
    }
  } finally {
    lookupController.abort();
    signal?.removeEventListener("abort", abortLookup);
  }

  job = withGenerationPresentation(job, params);
  onProgress?.(job.progress);
  onJob?.(job);

  while (!isTerminalGenerationStatus(job.status)) {
    await delay(1200, signal);
    try {
      job = await getGenerationJob(job.serverId ?? job.id, signal);
    } catch (err) {
      if (signal?.aborted) throw err;
      onSyncError?.(
        err instanceof Error ? err.message : "任务状态同步暂时中断",
      );
      continue;
    }
    job = withGenerationPresentation(job, params);
    onProgress?.(job.progress);
    onJob?.(job);
  }

  if (job.status === "succeeded") {
    onProgress?.(100);
    return job.results;
  }

  throw new Error(job.error ?? "生成失败，请重试");
}

export function estimateCostForModel(params: {
  model?: AiModel;
  type: MediaType;
  count: number;
  durationSec?: number;
  resolution?: string;
}): number {
  const unitCost = billingUnitCost(
    params.model,
    params.type,
    params.resolution,
  );
  if (billingUnit(params.model) === "second") {
    return (
      unitCost *
      (params.durationSec ??
        params.model?.capabilities.defaultDurationSeconds ??
        1)
    );
  }

  // Image pricing is per generated image. Video/audio request pricing is one
  // charge for the request, regardless of the selected duration or count.
  return params.type === "image" ? unitCost * params.count : unitCost;
}
