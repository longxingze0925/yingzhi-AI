"use client";

import type { MediaItem, MediaType } from "@/lib/api/types";

type ShareResult = "shared" | "copied";

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function hashString(value: string) {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash);
}

function seededPalette(seed: string) {
  const hash = hashString(seed);
  return [
    `hsl(${hash % 360} 78% 56%)`,
    `hsl(${(hash >> 5) % 360} 74% 48%)`,
    `hsl(${(hash >> 11) % 360} 68% 38%)`,
  ];
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1200);
}

function safeFilename(value: string) {
  return value
    .trim()
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, "-")
    .slice(0, 42) || "shadowweave";
}

function itemSummary(item: MediaItem) {
  const typeLabel =
    item.type === "audio" ? "音频" : item.type === "video" ? "视频" : "图片";
  return [
    item.prompt,
    "",
    `模型：${item.model}`,
    `类型：${typeLabel}`,
    item.type === "audio" ? null : `比例：${item.aspectRatio}`,
    item.resolution ? `分辨率：${item.resolution}` : null,
    item.durationSec ? `时长：${item.durationSec}s` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

function fallbackSvg(item: MediaItem) {
  const [from, via, to] = seededPalette(item.seed || item.id);
  const title = escapeXml(item.prompt.slice(0, 38));
  const label =
    item.type === "audio"
      ? "Shadowweave Audio"
      : item.type === "video"
        ? "Shadowweave Video Cover"
        : "Shadowweave Image";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="1280" viewBox="0 0 1280 1280">
  <defs>
    <linearGradient id="g" x1="0" x2="1" y1="0" y2="1">
      <stop offset="0%" stop-color="${from}"/>
      <stop offset="52%" stop-color="${via}"/>
      <stop offset="100%" stop-color="${to}"/>
    </linearGradient>
    <filter id="noise"><feTurbulence baseFrequency="0.85" numOctaves="3" stitchTiles="stitch" opacity="0.2"/></filter>
  </defs>
  <rect width="1280" height="1280" fill="url(#g)"/>
  <rect width="1280" height="1280" filter="url(#noise)" opacity="0.18"/>
  <circle cx="1040" cy="220" r="220" fill="#fff" opacity="0.12"/>
  <circle cx="180" cy="1010" r="260" fill="#000" opacity="0.16"/>
  <text x="72" y="104" fill="#fff" font-family="Arial, sans-serif" font-size="34" font-weight="700">${label}</text>
  <text x="72" y="1160" fill="#fff" font-family="Arial, sans-serif" font-size="42" font-weight="700">${title}</text>
</svg>`;
}

export async function copyMediaPrompt(item: MediaItem) {
  await navigator.clipboard.writeText(item.fullPrompt ?? item.prompt);
}

export async function shareMediaItem(item: MediaItem): Promise<ShareResult> {
  const text = itemSummary(item);
  if (navigator.share) {
    await navigator.share({
      title: item.prompt.slice(0, 32),
      text,
      url: window.location.href,
    });
    return "shared";
  }
  await navigator.clipboard.writeText(`${text}\n\n${window.location.href}`);
  return "copied";
}

export async function downloadMediaItem(item: MediaItem, overrideUrl?: string) {
  const base = safeFilename(item.prompt);
  const sourceUrl = overrideUrl || item.url;

  if (sourceUrl) {
    try {
      const res = await fetch(sourceUrl);
      if (!res.ok) throw new Error("download failed");
      const blob = await res.blob();
      const ext =
        blob.type.split("/")[1]?.replace("jpeg", "jpg") ??
        (item.type === "audio" ? "mp3" : item.type === "video" ? "mp4" : "png");
      downloadBlob(blob, `${base}.${ext}`);
      return;
    } catch {
      window.open(sourceUrl, "_blank", "noopener,noreferrer");
      return;
    }
  }

  const svg = fallbackSvg(item);
  downloadBlob(new Blob([svg], { type: "image/svg+xml;charset=utf-8" }), `${base}.svg`);
}

export function enhancePromptLocally(params: {
  prompt: string;
  type: MediaType;
  styleName?: string;
}) {
  const prompt = params.prompt.trim();
  if (!prompt) return prompt;

  const base = params.type === "audio"
    ? [
        `[Audio Brief] ${prompt}`,
        "[Voice / Sound] define timbre, texture, language, and emotional delivery",
        "[Pacing] natural rhythm, clean pauses, no abrupt volume changes",
        "[Mix] studio-clean output, balanced loudness, no clipping or background noise",
        "[Quality] consistent tone, clear intelligibility, production-ready master",
      ]
    : params.type === "video"
    ? [
        `[Scene] ${prompt}`,
        "[Camera] slow cinematic motion with clear subject tracking",
        "[Lighting] layered key light, rim light, and natural atmosphere",
        "[Motion] smooth pacing, stable composition, no abrupt cuts",
        "[Quality] high detail, consistent subject, clean background separation",
      ]
    : [
        `Cinematic key visual: ${prompt}`,
        "Composition: clear subject hierarchy, balanced negative space, refined framing",
        "Lighting: studio-grade soft key light with realistic highlights and shadows",
        "Details: high micro-contrast, clean materials, coherent color palette",
        "Quality: sharp focus, premium finish, no artifacts",
      ];

  if (params.styleName && params.styleName !== "无风格") {
    base.push(`Style reference: ${params.styleName}`);
  }

  return base.join("\n");
}
