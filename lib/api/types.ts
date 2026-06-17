/** 影织 · 领域类型定义（前端契约，后续与 Rust 后端对齐） */

export type MediaType = "image" | "video" | "audio";

export type SourceMode = "text" | "image" | "video" | "audio" | "frames";

export type WorkVisibility = "private" | "gallery";

export type MediaCategory =
  | "portrait"
  | "landscape"
  | "product"
  | "anime"
  | "architecture"
  | "abstract";

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
  /** EntitleHub 资产 id，用于把作品作为下一次生成的参考素材 */
  assetId?: string | null;
  /** 占位渲染用的种子（替换为真实 url 后弃用） */
  seed: string;
  url?: string;
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
  secondPriceMinor?: number | null;
  requestPriceMinor?: number | null;
  imagePriceMinor?: number | null;
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
  modality: MediaType;
  providerModel?: string | null;
  billing: ModelBilling;
  capabilities: ModelCapabilities;
}

export interface StylePreset {
  id: string;
  name: string;
  seed: string;
}

export type JobStatus = "queued" | "running" | "succeeded" | "failed";

export interface GenerationJob {
  id: string;
  type: MediaType;
  status: JobStatus;
  progress: number; // 0 - 100
  prompt: string;
  negativePrompt?: string;
  /** 原始模型 id，重试本地任务时使用；model 字段可展示为名称 */
  modelId?: string;
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
}

export interface GenerateParams {
  type: MediaType;
  prompt: string;
  negativePrompt?: string;
  model: string;
  modelName?: string;
  aspectRatio: AspectRatio;
  resolution?: string;
  count: number;
  styleId?: string;
  durationSec?: number;
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
  credits: number;
  creditsTotal: number;
}
