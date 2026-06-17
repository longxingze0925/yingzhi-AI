"use client";

import * as React from "react";
import {
  Sparkles,
  Wand2,
  ImagePlus,
  Film,
  Music2,
  UserPlus,
  SlidersHorizontal,
  ArrowRight,
  ArrowUp,
  Zap,
  Check,
  RefreshCw,
  Pencil,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AssetPickerDialog } from "@/components/studio/asset-picker-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import * as SelectPrimitive from "@radix-ui/react-select";
import { ASPECT_RATIOS } from "@/data/mock/config";
import {
  estimateCostForModel,
  listAiModels,
  listStylePresets,
  getAsset,
  uploadAssetFile,
  waitForAssetReady,
} from "@/lib/api/client";
import { enhancePromptLocally } from "@/lib/local-actions";
import { useLocalWorkspaceStore } from "@/lib/store/use-local-workspace";
import {
  useGenerationStore,
} from "@/lib/store/use-generation-store";
import type {
  AiModel,
  AssetItem,
  AspectRatio,
  MediaType,
  ReferenceAssetInput,
  SourceMode,
  StylePreset,
} from "@/lib/api/types";
import {
  validateAssetAgainstModel,
  validateFileAgainstModel,
  validateReferenceTotals,
  type ReferenceAssetKind,
} from "@/lib/model-capabilities";
import { cn } from "@/lib/utils";

const MAX = 8000;
const RATIO_LABELS = new Map(ASPECT_RATIOS.map((r) => [r.value, r.label]));
const DEFAULT_STYLE_PRESETS: StylePreset[] = [
  { id: "none", name: "无风格", seed: "style-none" },
];
const CONTROL_TRIGGER_CLASS =
  "h-9 shrink-0 justify-between gap-1.5 rounded-xl border-border bg-card/40 px-3 text-xs";
type DockMode = "text" | "reference" | "frames" | "edit";
type AssetPickerType = "image" | "video" | "audio" | "firstFrame" | "lastFrame";

function ratioLabel(ratio: string) {
  return RATIO_LABELS.get(ratio) ?? ratio;
}

function defaultRatio(type: MediaType, model?: AiModel) {
  const ratios = model?.capabilities.ratios ?? [];
  if (type === "audio") return ratios[0] ?? "1:1";
  return ratios[0] ?? (type === "video" ? "9:16" : "1:1");
}

function defaultResolution(model?: AiModel) {
  return model?.capabilities.resolutions[0] ?? "";
}

function defaultDuration(model?: AiModel) {
  return (
    model?.capabilities.defaultDurationSeconds ??
    model?.capabilities.durations[0] ??
    8
  );
}

function defaultCount(model?: AiModel) {
  return model?.capabilities.imageCounts[0] ?? 1;
}

function imageCounts(model?: AiModel) {
  if (!model) return [1];
  if (model.capabilities.imageCounts.length > 0) {
    return model.capabilities.imageCounts;
  }
  const max = model.capabilities.maxImages ?? 1;
  return Array.from({ length: max }, (_, i) => i + 1);
}

function supportsInputMode(model: AiModel | undefined, mode: SourceMode) {
  return Boolean(model?.capabilities.inputModes?.includes(mode));
}

function canUseReferenceVideo(model: AiModel | undefined) {
  if (!model || model.modality !== "video") return false;
  if (model.capabilities.supportsReferenceVideo === false) return false;
  const modes = model.capabilities.inputModes ?? [];
  return modes.length === 0 || modes.includes("video");
}

function canUseReferenceImage(model: AiModel | undefined) {
  if (!model) return false;
  const modes = model.capabilities.inputModes ?? [];
  if (modes.length === 0) {
    return true;
  }
  return modes.includes("image") || (model.capabilities.maxReferenceImages ?? 0) > 0;
}

function canUseReferenceAudio(model: AiModel | undefined) {
  if (!model) return false;
  if (model.capabilities.supportsReferenceAudio === false) return false;
  const modes = model.capabilities.inputModes ?? [];
  return (
    modes.length === 0 ||
    modes.includes("audio") ||
    (model.capabilities.maxReferenceAudios ?? 0) > 0
  );
}

function pickerKind(type: AssetPickerType): ReferenceAssetKind {
  if (type === "video") return "video";
  if (type === "audio") return "audio";
  return "image";
}

function SourceSlot({
  icon: Icon,
  label,
  active = false,
  disabled = false,
  tilt,
  title,
  onClick,
}: {
  icon: React.ElementType;
  label: string;
  active?: boolean;
  disabled?: boolean;
  tilt?: string;
  title?: string;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      title={title ?? label}
      className={cn(
        "flex h-12 w-12 shrink-0 flex-col items-center justify-center gap-0.5 rounded-xl border border-dashed border-border text-[10px] text-muted-foreground transition-colors",
        "hover:border-primary/50 hover:text-primary disabled:cursor-not-allowed disabled:opacity-55 disabled:hover:border-border disabled:hover:text-muted-foreground",
        active && "border-primary/50 text-primary",
        tilt
      )}
    >
      <Icon className="h-4 w-4" />
      <span className="max-w-full truncate px-1 leading-none">{label}</span>
    </button>
  );
}

export function PromptDock({
  type,
  initialPrompt = "",
  initialReferenceAssetId,
  initialReferenceKind,
}: {
  type: MediaType;
  initialPrompt?: string;
  initialReferenceAssetId?: string | null;
  initialReferenceKind?: string | null;
}) {
  const isVideo = type === "video";
  const isAudio = type === "audio";

  const [mode, setMode] = React.useState<DockMode>("reference");
  const [prompt, setPrompt] = React.useState(initialPrompt);
  const [models, setModels] = React.useState<AiModel[]>([]);
  const [modelsLoading, setModelsLoading] = React.useState(true);
  const [modelsError, setModelsError] = React.useState<string | null>(null);
  const [model, setModel] = React.useState("");
  const [ratio, setRatio] = React.useState<AspectRatio>(isVideo ? "9:16" : "1:1");
  const [resolution, setResolution] = React.useState("");
  const [count, setCount] = React.useState(1);
  const [duration, setDuration] = React.useState(8);
  const [style, setStyle] = React.useState("none");
  const [stylePresets, setStylePresets] =
    React.useState<StylePreset[]>(DEFAULT_STYLE_PRESETS);
  const [advanced, setAdvanced] = React.useState(false);
  const [enhanced, setEnhanced] = React.useState(false);
  const [referenceFile, setReferenceFile] = React.useState<File | null>(null);
  const [referenceVideoFile, setReferenceVideoFile] = React.useState<File | null>(null);
  const [referenceAudioFile, setReferenceAudioFile] = React.useState<File | null>(null);
  const [firstFrameFile, setFirstFrameFile] = React.useState<File | null>(null);
  const [lastFrameFile, setLastFrameFile] = React.useState<File | null>(null);
  const [referenceAsset, setReferenceAsset] = React.useState<AssetItem | null>(null);
  const [referenceVideoAsset, setReferenceVideoAsset] =
    React.useState<AssetItem | null>(null);
  const [referenceAudioAsset, setReferenceAudioAsset] =
    React.useState<AssetItem | null>(null);
  const [firstFrameAsset, setFirstFrameAsset] = React.useState<AssetItem | null>(null);
  const [lastFrameAsset, setLastFrameAsset] = React.useState<AssetItem | null>(null);
  const [assetPickerType, setAssetPickerType] =
    React.useState<AssetPickerType | null>(null);
  const [uploadingReference, setUploadingReference] = React.useState(false);

  const submit = useGenerationStore((s) => s.submit);
  const addNotification = useLocalWorkspaceStore((s) => s.addNotification);
  const selectedModel = React.useMemo(
    () => models.find((m) => m.id === model),
    [model, models]
  );
  const ratioOptions = selectedModel?.capabilities.ratios ?? [];
  const resolutionOptions = selectedModel?.capabilities.resolutions ?? [];
  const durationOptions = selectedModel?.capabilities.durations ?? [];
  const imageModeSupported = supportsInputMode(selectedModel, "image");
  const framesModeSupported = supportsInputMode(selectedModel, "frames");
  const canUseImageReference = canUseReferenceImage(selectedModel);
  const canUseVideoReference = canUseReferenceVideo(selectedModel);
  const canUseAudioReference = canUseReferenceAudio(selectedModel);
  const canUseAnyReference = isVideo
    ? canUseImageReference || canUseVideoReference || canUseAudioReference
    : canUseImageReference || imageModeSupported || framesModeSupported;
  const canUseFramesMode =
    isVideo &&
    (framesModeSupported ||
      selectedModel?.capabilities.inputModes?.length === 0 ||
      selectedModel?.capabilities.supportsFirstFrame === true ||
      selectedModel?.capabilities.supportsLastFrame === true);
  const isReferenceMode = mode === "reference";
  const isFramesMode = mode === "frames";
  const isEditMode = mode === "edit";
  const hasReferenceImage = Boolean(referenceAsset || referenceFile);
  const hasReferenceVideo = Boolean(referenceVideoAsset || referenceVideoFile);
  const hasReferenceAudio = Boolean(referenceAudioAsset || referenceAudioFile);
  const hasFirstFrame = Boolean(firstFrameAsset || firstFrameFile);
  const hasLastFrame = Boolean(lastFrameAsset || lastFrameFile);
  const hasReferenceMaterial = hasReferenceImage || hasReferenceVideo || hasReferenceAudio;
  const referenceValidationError = React.useMemo(() => {
    if (!selectedModel) return null;

    const checks: Array<{
      asset: AssetItem | null;
      file: File | null;
      kind: ReferenceAssetKind;
      enabled: boolean;
    }> = [
      {
        asset: referenceAsset,
        file: referenceFile,
        kind: "image",
        enabled: isReferenceMode,
      },
      {
        asset: referenceVideoAsset,
        file: referenceVideoFile,
        kind: "video",
        enabled: isReferenceMode,
      },
      {
        asset: referenceAudioAsset,
        file: referenceAudioFile,
        kind: "audio",
        enabled: isReferenceMode,
      },
      {
        asset: firstFrameAsset,
        file: firstFrameFile,
        kind: "image",
        enabled: isFramesMode,
      },
      {
        asset: lastFrameAsset,
        file: lastFrameFile,
        kind: "image",
        enabled: isFramesMode,
      },
    ];

    for (const item of checks) {
      if (!item.enabled) continue;
      if (item.file) {
        const fileError = validateFileAgainstModel(
          item.file,
          item.kind,
          selectedModel.capabilities
        );
        if (fileError) return fileError;
      }
      if (item.asset) {
        const assetError = validateAssetAgainstModel(
          item.asset,
          item.kind,
          selectedModel.capabilities
        );
        if (assetError) return assetError;
      }
    }

    return validateReferenceTotals(
      checks
        .filter((item) => item.enabled)
        .map((item) => ({ asset: item.asset, kind: item.kind })),
      selectedModel.capabilities
    );
  }, [
    firstFrameAsset,
    firstFrameFile,
    isFramesMode,
    isReferenceMode,
    lastFrameAsset,
    lastFrameFile,
    referenceAsset,
    referenceAudioAsset,
    referenceAudioFile,
    referenceFile,
    referenceVideoAsset,
    referenceVideoFile,
    selectedModel,
  ]);
  const countOptions = React.useMemo(
    () => imageCounts(selectedModel),
    [selectedModel]
  );
  const modelStatusLabel = modelsError
    ? "加载失败"
    : modelsLoading
      ? "加载模型..."
      : models.length === 0
        ? "暂无模型"
        : "选择模型";
  const modeTabs = React.useMemo(
    () => {
      const tabs: Array<{
        v: Exclude<DockMode, "text">;
        label: string;
        disabled: boolean;
        title: string;
      }> = [];

      if (isAudio) {
        tabs.push({
          v: "reference",
          label: "参考",
          disabled: !canUseAudioReference,
          title: canUseAudioReference ? "参考音频" : "当前模型未声明支持参考音频",
        });
        return tabs;
      }

      tabs.push({
        v: "reference",
        label: "参考",
        disabled: isVideo ? !canUseAnyReference : !canUseImageReference,
        title: isVideo
          ? canUseAnyReference
            ? "参考素材"
            : "当前模型未声明支持参考素材"
          : canUseImageReference
            ? "参考图片"
            : "当前模型未声明支持参考图片",
      });

      if (isVideo) {
        tabs.push(
          {
            v: "frames",
            label: "首尾帧",
            disabled: !canUseFramesMode,
            title: canUseFramesMode ? "首尾帧" : "当前模型未声明支持首尾帧",
          },
          {
            v: "edit",
            label: "编辑",
            disabled: false,
            title: "编辑模式待接入",
          }
        );
      }

      return tabs;
    },
    [
      canUseAnyReference,
      canUseAudioReference,
      canUseFramesMode,
      canUseImageReference,
      isAudio,
      isVideo,
    ]
  );

  React.useEffect(() => {
    if (initialPrompt) setPrompt(initialPrompt);
  }, [initialPrompt]);

  React.useEffect(() => {
    if (!initialReferenceAssetId) return;
    const expectedKind =
      initialReferenceKind === "video" ||
      initialReferenceKind === "audio" ||
      initialReferenceKind === "image"
        ? initialReferenceKind
        : type;
    let alive = true;
    getAsset(initialReferenceAssetId)
      .then((asset) => {
        if (!alive) return;
        setMode("reference");
        if (expectedKind === "video") {
          setReferenceVideoAsset(asset);
          setReferenceVideoFile(null);
        } else if (expectedKind === "audio") {
          setReferenceAudioAsset(asset);
          setReferenceAudioFile(null);
        } else {
          setReferenceAsset(asset);
          setReferenceFile(null);
        }
        addNotification("已填入参考素材", asset.name);
      })
      .catch((err) => {
        if (!alive) return;
        addNotification(
          "参考素材加载失败",
          err instanceof Error ? err.message : "请稍后重试"
        );
      });
    return () => {
      alive = false;
    };
  }, [addNotification, initialReferenceAssetId, initialReferenceKind, type]);

  React.useEffect(() => {
    let alive = true;
    setModelsLoading(true);
    setModelsError(null);
    listAiModels(type)
      .then((nextModels) => {
        if (!alive) return;
        setModels(nextModels);
        setModel(nextModels[0]?.id ?? "");
      })
      .catch((err) => {
        if (!alive) return;
        setModels([]);
        setModel("");
        setModelsError(err instanceof Error ? err.message : "模型列表加载失败");
      })
      .finally(() => {
        if (alive) setModelsLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [type]);

  React.useEffect(() => {
    let alive = true;
    listStylePresets()
      .then((presets) => {
        if (!alive) return;
        const nextPresets = presets.length > 0 ? presets : DEFAULT_STYLE_PRESETS;
        setStylePresets(nextPresets);
        setStyle((current) =>
          nextPresets.some((preset) => preset.id === current)
            ? current
            : nextPresets[0]?.id ?? "none"
        );
      })
      .catch(() => {
        if (alive) setStylePresets(DEFAULT_STYLE_PRESETS);
      });
    return () => {
      alive = false;
    };
  }, []);

  React.useEffect(() => {
    if (!selectedModel) return;
    if (isVideo && isReferenceMode && !canUseAnyReference) setMode("frames");
    if (isVideo && isFramesMode && !canUseFramesMode) setMode("text");
    if (isAudio && isReferenceMode && !canUseAudioReference) setMode("text");
    if (!isVideo && !isAudio && isReferenceMode && !canUseAnyReference) setMode("text");
    if (!isVideo && !isAudio && (isFramesMode || isEditMode)) setMode("text");
    if (isAudio && (isFramesMode || isEditMode)) setMode("text");
    const nextRatio = selectedModel.capabilities.ratios.includes(ratio)
      ? ratio
      : defaultRatio(type, selectedModel);
    const nextResolution = selectedModel.capabilities.resolutions.includes(resolution)
      ? resolution
      : defaultResolution(selectedModel);
    const nextDuration = selectedModel.capabilities.durations.includes(duration)
      ? duration
      : defaultDuration(selectedModel);
    const nextCount = countOptions.includes(count)
      ? count
      : defaultCount(selectedModel);

    if (nextRatio !== ratio) setRatio(nextRatio);
    if (nextResolution !== resolution) setResolution(nextResolution);
    if (nextDuration !== duration) setDuration(nextDuration);
    if (nextCount !== count) setCount(nextCount);
  }, [
    canUseAnyReference,
    canUseAudioReference,
    canUseFramesMode,
    count,
    countOptions,
    duration,
    isReferenceMode,
    isFramesMode,
    isEditMode,
    mode,
    ratio,
    resolution,
    selectedModel,
    isAudio,
    isVideo,
    type,
  ]);

  const cost = estimateCostForModel({
    type,
    model: selectedModel,
    count,
    durationSec: duration,
  });
  const canGenerate =
    prompt.trim().length > 0 &&
    Boolean(selectedModel) &&
    Boolean(ratio) &&
    (resolutionOptions.length === 0 || Boolean(resolution)) &&
    (!(isVideo || isAudio) || Boolean(duration)) &&
    (!isReferenceMode || !hasReferenceVideo || canUseVideoReference) &&
    (!isReferenceMode || !hasReferenceAudio || canUseAudioReference) &&
    !referenceValidationError &&
    !uploadingReference;

  const handlePromptInput = (
    e: React.ChangeEvent<HTMLTextAreaElement> | React.FormEvent<HTMLTextAreaElement>
  ) => {
    setPrompt(e.currentTarget.value.slice(0, MAX));
  };

  const handleGenerate = async () => {
    if (!canGenerate) return;
    if (referenceValidationError) {
      addNotification("参考素材不可用", referenceValidationError);
      return;
    }
    const referenceAssetIds: string[] = [];
    const referenceAssets: ReferenceAssetInput[] = [];
    const appendReferenceAsset = (
      assetId: string,
      kind: ReferenceAssetKind,
      role: ReferenceAssetInput["role"]
    ) => {
      referenceAssetIds.push(assetId);
      referenceAssets.push({ assetId, kind, role });
    };
    const readyAssetsForTotal: Array<{
      asset: AssetItem | null;
      kind: ReferenceAssetKind;
    }> = [];

    if (isReferenceMode) {
      if (referenceAsset) {
        appendReferenceAsset(referenceAsset.id, "image", "reference");
        readyAssetsForTotal.push({ asset: referenceAsset, kind: "image" });
      }
      if (referenceVideoAsset) {
        appendReferenceAsset(referenceVideoAsset.id, "video", "reference");
        readyAssetsForTotal.push({ asset: referenceVideoAsset, kind: "video" });
      }
      if (referenceAudioAsset) {
        appendReferenceAsset(referenceAudioAsset.id, "audio", "reference");
        readyAssetsForTotal.push({ asset: referenceAudioAsset, kind: "audio" });
      }
    }
    if (isFramesMode) {
      if (firstFrameAsset) {
        appendReferenceAsset(firstFrameAsset.id, "image", "first_frame");
        readyAssetsForTotal.push({ asset: firstFrameAsset, kind: "image" });
      }
      if (lastFrameAsset) {
        appendReferenceAsset(lastFrameAsset.id, "image", "last_frame");
        readyAssetsForTotal.push({ asset: lastFrameAsset, kind: "image" });
      }
    }

    if (
      (isReferenceMode && hasReferenceMaterial) ||
      (isFramesMode && (hasFirstFrame || hasLastFrame))
    ) {
      try {
        setUploadingReference(true);
        if (isReferenceMode && referenceFile) {
          const uploaded = await uploadAssetFile({
            file: referenceFile,
            assetType: "image",
            assetRole: "reference",
          });
          const ready = await waitForAssetReady(uploaded.assetId, {
            initialAsset: uploaded.asset,
          });
          const error = validateAssetAgainstModel(
            ready,
            "image",
            selectedModel?.capabilities
          );
          if (error) throw new Error(error);
          readyAssetsForTotal.push({ asset: ready, kind: "image" });
          appendReferenceAsset(uploaded.assetId, "image", "reference");
        }
        if (isReferenceMode && referenceVideoFile) {
          const uploaded = await uploadAssetFile({
            file: referenceVideoFile,
            assetType: "video",
            assetRole: "reference",
          });
          const ready = await waitForAssetReady(uploaded.assetId, {
            initialAsset: uploaded.asset,
          });
          const error = validateAssetAgainstModel(
            ready,
            "video",
            selectedModel?.capabilities
          );
          if (error) throw new Error(error);
          readyAssetsForTotal.push({ asset: ready, kind: "video" });
          appendReferenceAsset(uploaded.assetId, "video", "reference");
        }
        if (isReferenceMode && referenceAudioFile) {
          const uploaded = await uploadAssetFile({
            file: referenceAudioFile,
            assetType: "audio",
            assetRole: "reference",
          });
          const ready = await waitForAssetReady(uploaded.assetId, {
            initialAsset: uploaded.asset,
          });
          const error = validateAssetAgainstModel(
            ready,
            "audio",
            selectedModel?.capabilities
          );
          if (error) throw new Error(error);
          readyAssetsForTotal.push({ asset: ready, kind: "audio" });
          appendReferenceAsset(uploaded.assetId, "audio", "reference");
        }
        if (isFramesMode && firstFrameFile) {
          const uploaded = await uploadAssetFile({
            file: firstFrameFile,
            assetType: "image",
            assetRole: "first_frame",
          });
          const ready = await waitForAssetReady(uploaded.assetId, {
            initialAsset: uploaded.asset,
          });
          const error = validateAssetAgainstModel(
            ready,
            "image",
            selectedModel?.capabilities
          );
          if (error) throw new Error(error);
          readyAssetsForTotal.push({ asset: ready, kind: "image" });
          appendReferenceAsset(uploaded.assetId, "image", "first_frame");
        }
        if (isFramesMode && lastFrameFile) {
          const uploaded = await uploadAssetFile({
            file: lastFrameFile,
            assetType: "image",
            assetRole: "last_frame",
          });
          const ready = await waitForAssetReady(uploaded.assetId, {
            initialAsset: uploaded.asset,
          });
          const error = validateAssetAgainstModel(
            ready,
            "image",
            selectedModel?.capabilities
          );
          if (error) throw new Error(error);
          readyAssetsForTotal.push({ asset: ready, kind: "image" });
          appendReferenceAsset(uploaded.assetId, "image", "last_frame");
        }
        const totalError = validateReferenceTotals(
          readyAssetsForTotal,
          selectedModel?.capabilities
        );
        if (totalError) throw new Error(totalError);
      } catch (err) {
        addNotification(
          "参考素材上传失败",
          err instanceof Error ? err.message : "请稍后重试"
        );
        return;
      } finally {
        setUploadingReference(false);
      }
    }
    const hasSubmittedAudioReference = referenceAssets.some(
      (asset) => asset.kind === "audio" && asset.role === "reference"
    );
    const hasSubmittedVideoReference = referenceAssets.some(
      (asset) => asset.kind === "video" && asset.role === "reference"
    );
    const hasSubmittedImageReference = referenceAssets.some(
      (asset) => asset.kind === "image" && asset.role === "reference"
    );
    const nextSourceMode: SourceMode =
      referenceAssets.length === 0
        ? "text"
        : isFramesMode
          ? "frames"
          : hasSubmittedAudioReference &&
              !hasSubmittedImageReference &&
              !hasSubmittedVideoReference
            ? "audio"
            : hasSubmittedVideoReference && !hasSubmittedImageReference
              ? "video"
              : "image";

    submit({
      type,
      prompt: prompt.trim(),
      model,
      modelName: selectedModel?.name ?? model,
      aspectRatio: ratio,
      resolution: resolution || undefined,
      count,
      styleId: style,
      durationSec: isVideo || isAudio ? duration : undefined,
      sourceMode: nextSourceMode,
      referenceAssets:
        referenceAssets.length > 0 ? referenceAssets : undefined,
      referenceAssetIds:
        referenceAssetIds.length > 0 ? referenceAssetIds : undefined,
      firstFrameAssetId: isFramesMode ? firstFrameAsset?.id : undefined,
      lastFrameAssetId: isFramesMode ? lastFrameAsset?.id : undefined,
    });
  };

  const openAssetPicker = (nextType: AssetPickerType) => {
    setAssetPickerType(nextType);
  };

  const handleLocalReferenceFile = (file: File, fileType: AssetPickerType) => {
    const kind = pickerKind(fileType);
    const error = validateFileAgainstModel(file, kind, selectedModel?.capabilities);
    if (error) {
      addNotification("参考素材不可用", error);
      return;
    }
    if (fileType === "image") {
      setReferenceFile(file);
      setReferenceAsset(null);
    } else if (fileType === "video") {
      setReferenceVideoFile(file);
      setReferenceVideoAsset(null);
    } else if (fileType === "audio") {
      setReferenceAudioFile(file);
      setReferenceAudioAsset(null);
    } else if (fileType === "firstFrame") {
      setFirstFrameFile(file);
      setFirstFrameAsset(null);
    } else {
      setLastFrameFile(file);
      setLastFrameAsset(null);
    }
    setAssetPickerType(null);
  };

  const handleReferenceAsset = (asset: AssetItem, fileType: AssetPickerType) => {
    const kind = pickerKind(fileType);
    const error = validateAssetAgainstModel(asset, kind, selectedModel?.capabilities);
    if (error) {
      addNotification("参考素材不可用", error);
      return;
    }
    if (fileType === "image") {
      setReferenceAsset(asset);
      setReferenceFile(null);
    } else if (fileType === "video") {
      setReferenceVideoAsset(asset);
      setReferenceVideoFile(null);
    } else if (fileType === "audio") {
      setReferenceAudioAsset(asset);
      setReferenceAudioFile(null);
    } else if (fileType === "firstFrame") {
      setFirstFrameAsset(asset);
      setFirstFrameFile(null);
    } else {
      setLastFrameAsset(asset);
      setLastFrameFile(null);
    }
    setAssetPickerType(null);
  };

  const enhancePrompt = () => {
    const styleName = stylePresets.find((preset) => preset.id === style)?.name;
    const nextPrompt = enhancePromptLocally({
      prompt,
      type,
      styleName,
    }).slice(0, MAX);
    if (nextPrompt === prompt) return;
    setPrompt(nextPrompt);
    setEnhanced(true);
    addNotification("提示词已增强", "已使用前端辅助规则补充构图、光线与质量控制描述。");
    window.setTimeout(() => setEnhanced(false), 1600);
  };

  const promptPlaceholder = isAudio
    ? isReferenceMode
      ? "描述音频内容、音色、语气、语言、节奏，可选择参考音频..."
      : "描述音频内容、音色、语气、语言、节奏或配乐风格..."
    : isVideo
    ? isFramesMode
      ? "描述首尾帧之间的运动、镜头和变化..."
      : isEditMode
        ? "描述要编辑的画面内容、动作和风格..."
        : "描述画面内容、动态过程和镜头变化，可选择参考素材..."
    : "描述你想要的画面，可选择参考图片…";

  return (
    <>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30 flex justify-center px-4 pb-5">
      <div className="pointer-events-auto w-full max-w-[980px]">
        {/* 高级设置展开（风格） */}
        {advanced && (
          <div className="mb-2 rounded-2xl border border-border bg-popover/95 p-4 shadow-xl backdrop-blur-xl">
            <p className="mb-2 text-xs font-medium text-muted-foreground">风格预设</p>
            <div className="grid grid-cols-8 gap-2">
              {stylePresets.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setStyle(s.id)}
                  className={cn(
                    "rounded-md border px-2 py-1.5 text-[11px] transition-colors",
                    style === s.id
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:border-primary/40"
                  )}
                >
                  {s.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 主面板 */}
        <div className="min-h-[160px] rounded-2xl border border-border bg-popover/90 p-4 shadow-2xl backdrop-blur-xl">
          {/* 模式标签 */}
          <div className="mb-3 flex items-center gap-1.5">
            {modeTabs.map((m) => {
              const disabled = m.disabled;
              return (
              <button
                key={m.v}
                disabled={disabled}
                title={m.title}
                onClick={() => setMode((current) => (current === m.v ? "text" : m.v))}
                className={cn(
                  "inline-flex h-7 items-center justify-center rounded-full px-3 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50",
                  mode === m.v
                    ? "bg-accent text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {m.label}
              </button>
              );
            })}
            <span className="ml-auto text-[11px] text-muted-foreground">
              {prompt.length}/{MAX}
            </span>
          </div>

          {/* 输入区 */}
          <div className="flex min-h-[54px] gap-3">
            {/* 素材模式 */}
            {isReferenceMode && (
              <div className="flex shrink-0 gap-2">
                {!isAudio && (
                  <SourceSlot
                    icon={ImagePlus}
                    label={hasReferenceImage ? "已选" : "参考"}
                    active={hasReferenceImage}
                    disabled={!canUseImageReference}
                    title={canUseImageReference ? "参考图片" : "当前模型未声明支持参考图片"}
                    onClick={() => openAssetPicker("image")}
                  />
                )}
                {isVideo && (
                  <SourceSlot
                    icon={Film}
                    label={hasReferenceVideo ? "已选" : "视频"}
                    active={hasReferenceVideo}
                    disabled={!canUseVideoReference}
                    title={
                      canUseVideoReference
                        ? hasReferenceVideo
                          ? "已选参考视频"
                          : "参考视频"
                        : "当前模型未声明支持参考视频"
                    }
                    onClick={() => openAssetPicker("video")}
                  />
                )}
                {isAudio || isVideo ? (
                  <SourceSlot
                    icon={Music2}
                    label={hasReferenceAudio ? "已选" : "音频"}
                    active={hasReferenceAudio}
                    disabled={!canUseAudioReference}
                    title={
                      canUseAudioReference
                        ? hasReferenceAudio
                          ? "已选参考音频"
                          : "参考音频"
                        : "当前模型未声明支持参考音频"
                    }
                    onClick={() => openAssetPicker("audio")}
                  />
                ) : (
                  <SourceSlot icon={UserPlus} label="主体" disabled />
                )}
              </div>
            )}
            {isFramesMode && (
              <div className="flex shrink-0 items-center gap-2">
                <SourceSlot
                  icon={ImagePlus}
                  label={hasFirstFrame ? "已选" : "首帧"}
                  active={hasFirstFrame}
                  tilt="-rotate-6"
                  disabled={selectedModel?.capabilities.supportsFirstFrame === false}
                  title={
                    selectedModel?.capabilities.supportsFirstFrame === false
                      ? "当前模型未声明支持首帧"
                      : "选择首帧图片"
                  }
                  onClick={() => openAssetPicker("firstFrame")}
                />
                <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <SourceSlot
                  icon={ImagePlus}
                  label={hasLastFrame ? "已选" : "尾帧"}
                  active={hasLastFrame}
                  tilt="rotate-6"
                  disabled={selectedModel?.capabilities.supportsLastFrame === false}
                  title={
                    selectedModel?.capabilities.supportsLastFrame === false
                      ? "当前模型未声明支持尾帧"
                      : "选择尾帧图片"
                  }
                  onClick={() => openAssetPicker("lastFrame")}
                />
              </div>
            )}
            {isEditMode && (
              <div className="flex shrink-0 gap-2">
                <SourceSlot icon={Pencil} label="素材" disabled />
              </div>
            )}
            <textarea
              value={prompt}
              onChange={handlePromptInput}
              onInput={handlePromptInput}
              rows={2}
              placeholder={promptPlaceholder}
              className="min-h-[54px] flex-1 resize-none bg-transparent pt-1 text-sm outline-none placeholder:text-muted-foreground"
            />
            {isVideo && (
              <button
                type="button"
                disabled
                title="提示词向导待接入"
                className="hidden h-9 shrink-0 items-center gap-1 rounded-xl bg-accent px-3 text-xs font-medium text-accent-foreground opacity-80 disabled:cursor-not-allowed sm:flex"
              >
                <Wand2 className="h-3.5 w-3.5" />
                提示词向导
              </button>
            )}
          </div>

          {/* 控制行 */}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {/* 模型 */}
            <Select
              value={model}
              onValueChange={setModel}
              disabled={modelsLoading || models.length === 0}
            >
              <SelectTrigger
                className={cn(CONTROL_TRIGGER_CLASS, "w-36 sm:w-40")}
                title={selectedModel?.name ?? modelStatusLabel}
              >
                <Sparkles className="h-3.5 w-3.5 shrink-0 text-primary" />
                <span className="min-w-0 flex-1 truncate text-left">
                  {selectedModel?.name ?? modelStatusLabel}
                </span>
              </SelectTrigger>
              <SelectContent className="w-[min(22rem,calc(100vw-2rem))]">
                {models.map((m) => (
                  <SelectPrimitive.Item
                    key={m.id}
                    value={m.id}
                    className={cn(
                      "relative flex w-full cursor-pointer select-none items-center rounded-md py-2 pl-8 pr-3 text-sm outline-none",
                      "focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50"
                    )}
                  >
                    <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
                      <SelectPrimitive.ItemIndicator>
                        <Check className="h-4 w-4" />
                      </SelectPrimitive.ItemIndicator>
                    </span>
                    <SelectPrimitive.ItemText asChild>
                      <span className="sr-only">{m.name}</span>
                    </SelectPrimitive.ItemText>
                    <span aria-hidden className="min-w-0 truncate font-medium">
                      {m.name}
                    </span>
                  </SelectPrimitive.Item>
                ))}
              </SelectContent>
            </Select>

            {/* 分辨率 · 比例 · 时长 概要 */}
            <Select
              value={ratio}
              onValueChange={(v) => setRatio(v as AspectRatio)}
              disabled={!selectedModel || ratioOptions.length === 0}
            >
              <SelectTrigger className={cn(CONTROL_TRIGGER_CLASS, "w-28")}>
                <SelectValue placeholder="比例" />
              </SelectTrigger>
              <SelectContent>
                {ratioOptions.map((r) => (
                  <SelectItem key={r} value={r}>
                    {ratioLabel(r)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {resolutionOptions.length > 0 && (
              <Select
                value={resolution}
                onValueChange={setResolution}
                disabled={!selectedModel}
              >
                <SelectTrigger className={cn(CONTROL_TRIGGER_CLASS, "w-[5.5rem]")}>
                  <SelectValue placeholder="分辨率" />
                </SelectTrigger>
                <SelectContent>
                  {resolutionOptions.map((r) => (
                    <SelectItem key={r} value={r}>
                      {r.toUpperCase()}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {isVideo || isAudio ? (
              <Select
                value={String(duration)}
                onValueChange={(v) => setDuration(Number(v))}
                disabled={!selectedModel || durationOptions.length === 0}
              >
                <SelectTrigger className={cn(CONTROL_TRIGGER_CLASS, "w-[4.75rem]")}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {durationOptions.map((d) => (
                    <SelectItem key={d} value={String(d)}>
                      {d} 秒
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Select
                value={String(count)}
                onValueChange={(v) => setCount(Number(v))}
                disabled={!selectedModel}
              >
                <SelectTrigger className={cn(CONTROL_TRIGGER_CLASS, "w-28")}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {countOptions.map((n) => (
                    <SelectItem key={n} value={String(n)}>
                      生成 {n} 张
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {modelsError && (
              <button
                onClick={() => {
                  setModelsLoading(true);
                  setModelsError(null);
                  listAiModels(type)
                    .then((nextModels) => {
                      setModels(nextModels);
                      setModel(nextModels[0]?.id ?? "");
                    })
                    .catch((err) => {
                      setModels([]);
                      setModel("");
                      setModelsError(
                        err instanceof Error ? err.message : "模型列表加载失败"
                      );
                    })
                    .finally(() => setModelsLoading(false));
                }}
                className="hidden h-9 w-28 shrink-0 items-center justify-center gap-1 rounded-xl border border-border bg-card/40 px-3 text-xs text-muted-foreground transition-colors hover:text-foreground sm:flex"
                title={modelsError}
              >
                <RefreshCw className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">重试模型</span>
              </button>
            )}
            {!modelsLoading && !modelsError && models.length === 0 && (
              <Badge
                variant="muted"
                className="hidden h-9 w-24 shrink-0 items-center justify-center overflow-hidden rounded-xl px-3 sm:flex"
              >
                <span className="truncate">暂无模型</span>
              </Badge>
            )}
            {/* 提示词增强 / 预设 */}
            <button
              onClick={enhancePrompt}
              disabled={prompt.trim().length === 0}
              title="提示词增强"
              className="flex h-9 w-28 shrink-0 items-center justify-center gap-1 rounded-xl border border-border bg-card/40 px-3 text-xs text-muted-foreground transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:text-muted-foreground"
            >
              {enhanced ? <Check className="h-3.5 w-3.5 shrink-0 text-emerald-500" /> : <Wand2 className="h-3.5 w-3.5 shrink-0" />}
              <span className="hidden min-w-0 truncate sm:inline">{enhanced ? "已增强" : "提示词增强"}</span>
            </button>
            <button
              onClick={() => setAdvanced((v) => !v)}
              className={cn(
                "flex h-9 w-20 shrink-0 items-center justify-center gap-1 rounded-xl border px-3 text-xs transition-colors",
                advanced
                  ? "border-primary/40 bg-primary/10 text-primary"
                  : "border-border bg-card/40 text-muted-foreground hover:text-foreground"
              )}
            >
              <SlidersHorizontal className="h-3.5 w-3.5 shrink-0" />
              <span className="hidden min-w-0 truncate sm:inline">预设</span>
            </button>

            {/* 生成按钮 */}
            <div className="ml-auto flex items-center gap-2">
              <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                <Zap className="h-3 w-3 text-primary" />
                {cost}
              </span>
              <Button
                variant="brand"
                size="icon"
                className="h-10 w-10 rounded-xl"
                disabled={!canGenerate}
                onClick={() => void handleGenerate()}
                title={
                  modelsError
                    ? "模型加载失败"
                    : !modelsLoading && models.length === 0
                      ? "EntitleHub 暂未配置该类型模型"
                      : referenceValidationError
                        ? referenceValidationError
                      : isFramesMode
                        ? hasFirstFrame || hasLastFrame
                          ? "生成"
                          : "未选择首尾帧，将按文生视频生成"
                      : isEditMode
                        ? "编辑模式待接入"
                      : uploadingReference
                          ? "正在上传参考素材"
                      : "生成"
                }
              >
                <ArrowUp className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
      </div>
      {assetPickerType && (
        <AssetPickerDialog
          open={Boolean(assetPickerType)}
          type={
            assetPickerType === "firstFrame" || assetPickerType === "lastFrame"
              ? "image"
              : assetPickerType
          }
          selectedAssetId={
            assetPickerType === "image"
              ? referenceAsset?.id
              : assetPickerType === "video"
                ? referenceVideoAsset?.id
                : assetPickerType === "audio"
                  ? referenceAudioAsset?.id
                  : assetPickerType === "firstFrame"
                    ? firstFrameAsset?.id
                    : lastFrameAsset?.id
          }
          capabilities={selectedModel?.capabilities}
          onOpenChange={(nextOpen) => {
            if (!nextOpen) setAssetPickerType(null);
          }}
          onSelectAsset={(asset) => handleReferenceAsset(asset, assetPickerType)}
          onUploadFile={(file) => handleLocalReferenceFile(file, assetPickerType)}
        />
      )}
    </>
  );
}
