import type { AssetItem, ModelCapabilities } from "@/lib/api/types";

export type ReferenceAssetKind = "image" | "video" | "audio";

export function assetDurationSeconds(asset: AssetItem) {
  return asset.durationSec ?? asset.durationSeconds ?? asset.duration ?? null;
}

export function maxAssetSizeMbFor(
  capabilities: ModelCapabilities | undefined,
  kind: ReferenceAssetKind
) {
  if (!capabilities) return null;
  if (kind === "image") {
    return capabilities.maxImageAssetSizeMb ?? capabilities.maxAssetSizeMb ?? null;
  }
  if (kind === "video") {
    return capabilities.maxVideoAssetSizeMb ?? capabilities.maxAssetSizeMb ?? null;
  }
  return capabilities.maxAudioAssetSizeMb ?? capabilities.maxAssetSizeMb ?? null;
}

export function acceptedMimeMatches(
  capabilities: ModelCapabilities | undefined,
  mimeType?: string | null
) {
  const accepted = capabilities?.acceptedMimeTypes ?? [];
  if (accepted.length === 0 || !mimeType) return true;
  return accepted.some((item) => item.toLowerCase() === mimeType.toLowerCase());
}

export function validateFileAgainstModel(
  file: File,
  kind: ReferenceAssetKind,
  capabilities: ModelCapabilities | undefined
) {
  if (!acceptedMimeMatches(capabilities, file.type)) {
    return "当前模型不支持这个文件类型";
  }

  const maxMb = maxAssetSizeMbFor(capabilities, kind);
  if (maxMb && file.size > maxMb * 1024 * 1024) {
    return `当前模型限制单个${kindLabel(kind)}不超过 ${maxMb}MB`;
  }

  return null;
}

export function validateAssetAgainstModel(
  asset: AssetItem,
  kind: ReferenceAssetKind,
  capabilities: ModelCapabilities | undefined
) {
  if (asset.status && asset.status !== "ready") {
    return asset.status === "processing"
      ? "素材处理中，完成后才能使用"
      : "素材状态不可用";
  }

  if (!acceptedMimeMatches(capabilities, asset.mimeType)) {
    return "当前模型不支持这个文件类型";
  }

  const maxMb = maxAssetSizeMbFor(capabilities, kind);
  if (maxMb && asset.fileSize && asset.fileSize > maxMb * 1024 * 1024) {
    return `当前模型限制单个${kindLabel(kind)}不超过 ${maxMb}MB`;
  }

  const duration = assetDurationSeconds(asset);
  if (kind === "video") {
    const min = capabilities?.minReferenceVideoSeconds ?? null;
    const max = capabilities?.maxReferenceVideoSeconds ?? null;
    if (duration && min && duration < min) return `参考视频不能短于 ${min} 秒`;
    if (duration && max && duration > max) return `参考视频不能超过 ${max} 秒`;
  }
  if (kind === "audio") {
    const min = capabilities?.minReferenceAudioSeconds ?? null;
    const max = capabilities?.maxReferenceAudioSeconds ?? null;
    if (duration && min && duration < min) return `参考音频不能短于 ${min} 秒`;
    if (duration && max && duration > max) return `参考音频不能超过 ${max} 秒`;
  }

  return null;
}

export function validateReferenceTotals(
  assets: Array<{ asset: AssetItem | null; kind: ReferenceAssetKind }>,
  capabilities: ModelCapabilities | undefined
) {
  let videoSeconds = 0;
  let audioSeconds = 0;
  assets.forEach(({ asset, kind }) => {
    if (!asset) return;
    const duration = assetDurationSeconds(asset) ?? 0;
    if (kind === "video") videoSeconds += duration;
    if (kind === "audio") audioSeconds += duration;
  });

  const maxVideo = capabilities?.totalReferenceVideoSeconds ?? null;
  if (maxVideo && videoSeconds > maxVideo) {
    return `参考视频总时长不能超过 ${maxVideo} 秒`;
  }

  const maxAudio = capabilities?.totalReferenceAudioSeconds ?? null;
  if (maxAudio && audioSeconds > maxAudio) {
    return `参考音频总时长不能超过 ${maxAudio} 秒`;
  }

  return null;
}

function kindLabel(kind: ReferenceAssetKind) {
  if (kind === "image") return "图片";
  if (kind === "video") return "视频";
  return "音频";
}
