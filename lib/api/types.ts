/** 影织 · 领域类型定义（前端与统一后端契约） */

export type MediaType = "image" | "video" | "audio";
export type AiModelType = MediaType | "text";

export interface PlatformNavigation {
  sso_enabled: boolean;
  new_api: {
    enabled: boolean;
    url: string;
  };
  yingzhi: {
    enabled: boolean;
    url: string;
  };
}

export interface PlatformSSOStartResponse {
  redirect_url: string;
  expires_at: number;
}

export type SourceMode = "text" | "image" | "video" | "audio" | "frames";

export type WorkVisibility = "private" | "gallery";

export type MediaCategory =
  "portrait" | "landscape" | "product" | "anime" | "architecture" | "abstract";

export const CATEGORY_LABELS: Record<MediaCategory, string> = {
  portrait: "人像",
  landscape: "风景",
  product: "产品",
  anime: "动漫",
  architecture: "建筑",
  abstract: "抽象",
};

export interface Author {
  id: string;
  name: string;
  avatarSeed: string;
}

export interface MediaItem {
  id: string;
  type: MediaType;
  /** 统一素材 id，用于把作品作为下一次生成的参考素材 */
  assetId?: string | null;
  /** 占位渲染用的种子（替换为真实 url 后弃用） */
	seed: string;
	url?: string;
	/** 视频首帧缩略图；浏览器无法解码 HEVC 等编码时仍可展示真实画面 */
	thumbnailUrl?: string | null;
	prompt: string;
  /** 完整专业提示词（详情页展示、复制、用此提示词创作；缺省时回退到 prompt） */
  fullPrompt?: string;
  model: string;
  category: MediaCategory;
  aspectRatio: AspectRatio;
  resolution?: string;
  author: Author;
  likes: number;
  createdAt: number;
  /** 视频/音频参数 */
  durationSec?: number;
  /** 输入来源：文生、图生、参考视频、参考音频、首尾帧 */
  sourceMode?: SourceMode | null;
  referenceCount?: number | null;
  hasFirstFrame?: boolean | null;
  hasLastFrame?: boolean | null;
  visibility?: WorkVisibility | null;
  /** Whether the signed-in user owns this work. */
  isOwner?: boolean;
  publishedAt?: number | null;
  favoritedAt?: number | null;
  downloadedAt?: number | null;
  /** 示例占位标记（demo 数据，UI 上打「示例」角标） */
  demo?: boolean;
}

export type AspectRatio = string;

export interface AspectRatioOption {
  value: AspectRatio;
  label: string;
  /** tailwind aspect 比例，用于占位框 */
  w: number;
  h: number;
}

export interface ModelBilling {
  currency: string;
  mode: string;
  unit?: "second" | "request";
  unitPriceMinor?: number | null;
  secondPriceMinor?: number | null;
  requestPriceMinor?: number | null;
  /** 视频按请求计费时，按所选分辨率展示的单次请求价格。 */
  requestResolutionPricesMinor?: Record<string, number> | null;
  imagePriceMinor?: number | null;
  imageResolutionPricesMinor?: Record<string, number> | null;
  /** 视频按秒计费时，按所选分辨率展示的单价（人民币 quota/秒）。 */
  secondResolutionPricesMinor?: Record<string, number> | null;
}

export interface ModelCapabilities {
  ratios: AspectRatio[];
  resolutions: string[];
  durations: number[];
  defaultDurationSeconds?: number | null;
  imageCounts: number[];
  maxImages?: number | null;
  inputModes?: SourceMode[];
  maxReferenceImages?: number | null;
  maxReferenceVideos?: number | null;
  maxReferenceAudios?: number | null;
  supportsReferenceVideo?: boolean | null;
  supportsReferenceAudio?: boolean | null;
  supportsFirstFrame?: boolean | null;
  supportsLastFrame?: boolean | null;
  acceptedMimeTypes?: string[];
  maxAssetSizeMb?: number | null;
  maxImageAssetSizeMb?: number | null;
  maxVideoAssetSizeMb?: number | null;
  maxAudioAssetSizeMb?: number | null;
  minReferenceVideoSeconds?: number | null;
  maxReferenceVideoSeconds?: number | null;
  totalReferenceVideoSeconds?: number | null;
  minReferenceAudioSeconds?: number | null;
  maxReferenceAudioSeconds?: number | null;
  totalReferenceAudioSeconds?: number | null;
}

export interface AiModel {
  id: string;
  name: string;
  sortOrder?: number;
  modality: AiModelType;
  providerModel?: string | null;
  billing: ModelBilling;
  capabilities: ModelCapabilities;
  /** New API 用户可选的模型分组；具体渠道仍由服务端在分组内调度。 */
  routes?: AiModelRoute[];
  defaultRouteId?: string;
}

export interface AiModelRoute {
  id: string;
  name: string;
  description?: string;
  groupRatio?: number;
  billing: ModelBilling;
  capabilities: ModelCapabilities;
}

export interface StylePreset {
  id: string;
  name: string;
  seed: string;
}

export type JobStatus =
  "queued" | "running" | "review" | "succeeded" | "failed" | "cancelled";

export interface GenerationJob {
  id: string;
  /** 服务端持久化任务 id；本地提交占位卡保留自己的 id。 */
  serverId?: string;
  /** 用于在创建响应丢失时找回同一条服务端任务。 */
  idempotencyKey?: string;
  type: MediaType;
  status: JobStatus;
  progress: number; // 0 - 100
  prompt: string;
  negativePrompt?: string;
  /** 原始模型 id，重试本地任务时使用；model 字段可展示为名称 */
  modelId?: string;
  routeId?: string;
  routeName?: string;
  model: string;
  modelName?: string;
  aspectRatio: AspectRatio;
  resolution?: string;
  count: number;
  createdAt: number;
  results: MediaItem[];
  error?: string;
  /** 视频/音频参数 */
  durationSec?: number;
  sourceMode?: SourceMode | null;
  referenceCount?: number | null;
  hasFirstFrame?: boolean | null;
  hasLastFrame?: boolean | null;
  /** 客户端与服务端任务状态的同步阶段。 */
  syncState?: "submitting" | "polling" | "synced" | "retrying" | "lost";
  syncError?: string;
  syncAttempts?: number;
  syncDeadlineAt?: number;
}

export interface GenerateParams {
  type: MediaType;
  prompt: string;
  negativePrompt?: string;
  model: string;
  modelName?: string;
  routeId?: string;
  routeName?: string;
  aspectRatio: AspectRatio;
  resolution?: string;
  count: number;
  styleId?: string;
  durationSec?: number;
  voice?: string;
  sourceMode?: SourceMode;
  referenceAssets?: ReferenceAssetInput[];
  referenceAssetIds?: string[];
  firstFrameAssetId?: string;
  lastFrameAssetId?: string;
}

export interface ReferenceAssetInput {
  assetId: string;
  kind: "image" | "video" | "audio" | "file" | string;
  role: "reference" | "first_frame" | "last_frame" | string;
}

export interface PricingPlan {
  id: string;
  name: string;
  tagline: string;
  priceMonthly: number;
  priceYearly: number;
  credits: string;
  features: string[];
  highlighted?: boolean;
  cta: string;
}

export interface UsageStat {
  label: string;
  value: string;
  unit: string;
  trend?: string | null;
}

export interface UsageSummary {
  stats: UsageStat[];
  dailyCredits: number[];
}

export interface ApiKeyInfo {
  maskedKey: string;
  endpoint: string;
  enabled: boolean;
}

export interface AssetFolder {
  id: string;
  name: string;
  kind: "image" | "video" | "audio" | "style" | "folder" | string;
  count: number;
}

export interface AssetItem {
  id: string;
  seed: string;
  name: string;
  folderId: string;
  kind: "image" | "video" | "audio" | "style" | "folder" | string;
  url?: string | null;
  thumbnailUrl?: string | null;
  mimeType?: string | null;
  fileSize?: number | null;
  status?: string | null;
  duration?: number | null;
  durationSec?: number | null;
  durationSeconds?: number | null;
  role?: string | null;
  source?: string | null;
  sourceAlias?: string | null;
  width?: number | null;
  height?: number | null;
}

export interface AssetsLibrary {
  folders: AssetFolder[];
  materials: AssetItem[];
}

export interface AssetUpload {
  uploadId: string;
  method: string;
  url: string;
  uploadToken: string;
  tokenPrefix?: string | null;
  expiresAt?: string | null;
  maxBytes?: number | null;
  headers?: Record<string, string> | null;
}

export interface UploadedAsset {
  assetId: string;
  url?: string | null;
  type?: string | null;
  mimeType?: string | null;
  asset?: AssetItem | null;
}

export interface User {
  id: string;
  name: string;
  email: string;
  avatarSeed: string;
  avatarUrl?: string;
  plan: string;
  canvasEnabled?: boolean;
  quota: number;
  balanceDisplay: string;
  credits: number;
  creditsTotal: number;
}
