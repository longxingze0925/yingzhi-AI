"use client";

import * as React from "react";
import { fetchStudioMedia, studioMediaUrl } from "@/lib/api/client";
import {
  Maximize2,
  Pause,
  Play,
  Volume2,
  VolumeX,
} from "lucide-react";
import { cn } from "@/lib/utils";

/** 确定性渐变兜底；真实媒体或视频首帧存在时优先展示真实内容。 */
const PALETTES = [
  ["#5a7df0", "#8aa0f5", "#cdd8fb"],
  ["#6f86e0", "#9b86e8", "#d3c9f4"],
  ["#4fb6c9", "#7fcbd0", "#c2e7e6"],
  ["#6aa0e8", "#a7c2f0", "#dbe7f8"],
  ["#7e8cf0", "#aab0f3", "#dadcfb"],
  ["#5fb0a8", "#92c9bf", "#cbe6df"],
  ["#e8a98a", "#f0c0a3", "#f6dcc8"],
  ["#9aa3b8", "#bcc3d4", "#e0e4ec"],
];
const thumbnailBlobPromises = new Map<string, Promise<Blob>>();
const MAX_CACHED_THUMBNAILS = 32;

function hashSeed(seed: string): number {
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash << 5) - hash + seed.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash);
}

function useMediaSource(
  sourceUrl?: string | null,
  onLoadError?: () => void,
  directMedia = false,
) {
  const [resolvedUrl, setResolvedUrl] = React.useState<string | null>(() =>
    sourceUrl?.startsWith("/api/studio/") ? null : (sourceUrl ?? null),
  );

  React.useEffect(() => {
    let disposed = false;
    let objectUrl = "";
    if (!sourceUrl || !sourceUrl.startsWith("/api/studio/")) {
      setResolvedUrl(sourceUrl ?? null);
      return;
    }

    setResolvedUrl(null);
    if (directMedia) {
      setResolvedUrl(studioMediaUrl(sourceUrl));
      return;
    }
    const isThumbnail = sourceUrl.includes("/thumbnail");
    let blobPromise = isThumbnail ? thumbnailBlobPromises.get(sourceUrl) : null;
    if (!blobPromise) {
      blobPromise = fetchStudioMedia(sourceUrl)
        .then((response) => {
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          return response.blob();
        })
      .catch((error) => {
        if (isThumbnail) thumbnailBlobPromises.delete(sourceUrl);
        if (!disposed) onLoadError?.();
        throw error;
      });
      if (isThumbnail) {
        thumbnailBlobPromises.set(sourceUrl, blobPromise);
        if (thumbnailBlobPromises.size > MAX_CACHED_THUMBNAILS) {
          const oldestUrl = thumbnailBlobPromises.keys().next().value;
          if (oldestUrl) thumbnailBlobPromises.delete(oldestUrl);
        }
      }
    }
    blobPromise
      .then((blob) => {
        if (disposed) return;
        objectUrl = URL.createObjectURL(blob);
        setResolvedUrl(objectUrl);
      })
      .catch(() => {
        if (!disposed) setResolvedUrl(null);
      });

    return () => {
      disposed = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [sourceUrl, onLoadError, directMedia]);

  return resolvedUrl;
}

function useMediaVisibility(eager = false) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [visible, setVisible] = React.useState(eager);

  React.useEffect(() => {
    if (eager) {
      setVisible(true);
      return;
    }
    const element = containerRef.current;
    if (!element || typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "240px" },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [eager]);

  return { containerRef, visible };
}

function formatVideoTime(seconds: number) {
  const safeSeconds = Number.isFinite(seconds) ? Math.max(seconds, 0) : 0;
  const minutes = Math.floor(safeSeconds / 60);
  const remainder = Math.floor(safeSeconds % 60);
  return `${minutes}:${String(remainder).padStart(2, "0")}`;
}

/** Detail-page player with an independent control row below the video frame. */
export function StudioVideoPlayer({
  src,
  thumbnailSrc,
  alt,
  aspectRatio,
}: {
  src?: string | null;
  thumbnailSrc?: string | null;
  alt?: string;
  aspectRatio: string;
}) {
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const autoplayStartedRef = React.useRef(false);
  const [videoError, setVideoError] = React.useState(false);
  const [hasVideoFrame, setHasVideoFrame] = React.useState(false);
  const [isPlaying, setIsPlaying] = React.useState(false);
  const [isMuted, setIsMuted] = React.useState(true);
  const [duration, setDuration] = React.useState(0);
  const [currentTime, setCurrentTime] = React.useState(0);
  const handleMediaError = React.useCallback(() => setVideoError(true), []);
  const videoUrl = useMediaSource(src, handleMediaError, true);
  const posterUrl = useMediaSource(thumbnailSrc);
  const [ratioWidth, ratioHeight] = aspectRatio.split(":").map(Number);
  const validRatio =
    Number.isFinite(ratioWidth) &&
    Number.isFinite(ratioHeight) &&
    ratioWidth > 0 &&
    ratioHeight > 0;
  const isPortrait = validRatio && ratioWidth / ratioHeight < 0.85;
  const frameStyle: React.CSSProperties | undefined = validRatio
    ? { aspectRatio: `${ratioWidth} / ${ratioHeight}` }
    : undefined;
  const frameClass = isPortrait
    ? "h-[calc(100%_-_3rem)] w-auto max-w-full"
    : "h-auto max-h-[calc(100%_-_3rem)] w-full";

  React.useEffect(() => {
    setVideoError(false);
    setHasVideoFrame(false);
    setIsPlaying(false);
    setIsMuted(true);
    autoplayStartedRef.current = false;
    const video = videoRef.current;
    video?.pause();
    if (video) {
      video.currentTime = 0;
      video.muted = true;
    }
    const hasMetadata = video && video.readyState >= HTMLMediaElement.HAVE_METADATA;
    const nextDuration = hasMetadata ? video.duration : 0;
    setDuration(
      Number.isFinite(nextDuration) && nextDuration > 0 ? nextDuration : 0,
    );
    setCurrentTime(hasMetadata ? video.currentTime : 0);
  }, [videoUrl]);

  const revealVideoFrame = React.useCallback(
    (video: HTMLVideoElement) => {
      window.requestAnimationFrame(() => {
        if (video.error || video.videoWidth <= 0 || video.videoHeight <= 0) {
          return;
        }
        setHasVideoFrame(true);
        setVideoError(false);
      });
    },
    [],
  );

  const startAutoplay = React.useCallback(
    (video: HTMLVideoElement) => {
      if (
        autoplayStartedRef.current ||
        video.error ||
        video.videoWidth <= 0 ||
        video.videoHeight <= 0
      ) {
        return;
      }

      autoplayStartedRef.current = true;
      video.muted = true;
      setIsMuted(true);
      void video.play().catch(() => {
        // 浏览器拦截自动播放时保留首帧，用户仍可点击播放。
        autoplayStartedRef.current = false;
        setIsPlaying(false);
      });
    },
    [],
  );

  const handleVideoData = React.useCallback(
    (event: React.SyntheticEvent<HTMLVideoElement>) => {
      const video = event.currentTarget;
      if (video.error || video.videoWidth <= 0 || video.videoHeight <= 0) return;

      setVideoError(false);
      if (Number.isFinite(video.duration) && video.duration > 0) {
        setDuration(video.duration);
      }
      setCurrentTime(video.currentTime);
      startAutoplay(video);
    },
    [startAutoplay],
  );

  const togglePlayback = () => {
    const video = videoRef.current;
    if (!video || videoError) return;
    if (video.paused) {
      void video.play().catch(() => setVideoError(true));
    } else {
      video.pause();
    }
  };

  const toggleMute = () => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    setIsMuted(video.muted);
  };

  const seekTo = (value: string) => {
    const video = videoRef.current;
    const nextTime = Number(value);
    if (!video || !Number.isFinite(nextTime)) return;
    video.currentTime = nextTime;
    setCurrentTime(nextTime);
  };

  const enterFullscreen = () => {
    const video = videoRef.current;
    if (!video?.requestFullscreen) return;
    void video.requestFullscreen().catch(() => undefined);
  };

  return (
    <div className="relative z-10 flex h-full min-h-0 w-full flex-col items-center justify-center gap-2">
      {videoUrl ? (
        <div
          className={cn(
            "relative shrink-0 overflow-hidden rounded-xl shadow-2xl",
            frameClass,
          )}
          style={frameStyle}
        >
          {posterUrl && !hasVideoFrame && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={posterUrl}
              alt={alt ?? "视频首帧"}
              className="pointer-events-none absolute inset-0 z-10 h-full w-full object-contain"
            />
          )}
          <video
            ref={videoRef}
            src={videoUrl}
            poster={posterUrl ?? undefined}
            muted={isMuted}
            className={cn(
              "relative z-20 block h-full w-full bg-transparent object-contain transition-opacity duration-150",
              !hasVideoFrame && "opacity-0",
            )}
            playsInline
            preload="metadata"
            aria-label={alt ?? "视频预览"}
            onClick={togglePlayback}
            onLoadedMetadata={(event) => {
              const video = event.currentTarget;
              if (Number.isFinite(video.duration) && video.duration > 0) {
                setDuration(video.duration);
              }
              setCurrentTime(video.currentTime);
            }}
            onLoadedData={handleVideoData}
            onCanPlay={handleVideoData}
            onDurationChange={(event) => {
              const nextDuration = event.currentTarget.duration;
              if (Number.isFinite(nextDuration) && nextDuration > 0) {
                setDuration(nextDuration);
              }
            }}
            onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
            onPlay={() => setIsPlaying(true)}
            onPlaying={(event) => revealVideoFrame(event.currentTarget)}
            onPause={() => setIsPlaying(false)}
            onEnded={(event) => {
              setIsPlaying(false);
              setCurrentTime(event.currentTarget.duration);
            }}
            onError={() => setVideoError(true)}
          />
        </div>
      ) : posterUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={posterUrl}
          alt={alt ?? "视频首帧"}
          className={cn(
            "block shrink-0 rounded-xl bg-black object-contain shadow-2xl",
            frameClass,
          )}
          style={frameStyle}
        />
      ) : (
        <div
          className={cn(
            "shrink-0 rounded-xl bg-black/80",
            frameClass,
          )}
          style={frameStyle}
          role="status"
        >
          视频加载中…
        </div>
      )}

      <div className="flex w-full shrink-0 items-center gap-2 rounded-full border border-border/60 bg-card/90 px-3 py-2 text-foreground shadow-md backdrop-blur">
        <button
          type="button"
          aria-label={isPlaying ? "暂停视频" : "播放视频"}
          title={isPlaying ? "暂停" : "播放"}
          disabled={!videoUrl || videoError}
          onClick={togglePlayback}
          className="grid size-8 shrink-0 place-items-center rounded-full transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
        >
          {isPlaying ? <Pause className="size-4" /> : <Play className="ml-0.5 size-4 fill-current" />}
        </button>
        <span className="min-w-[5.5rem] shrink-0 text-center font-mono text-xs tabular-nums text-muted-foreground">
          {formatVideoTime(currentTime)} / {formatVideoTime(duration)}
        </span>
        <input
          type="range"
          aria-label="视频进度"
          min={0}
          max={Math.max(duration, 1)}
          step={0.1}
          value={Math.min(currentTime, duration)}
          disabled={!videoUrl || videoError || duration <= 0}
          onChange={(event) => seekTo(event.currentTarget.value)}
          className="h-1.5 min-w-0 flex-1 cursor-pointer accent-primary disabled:cursor-not-allowed"
        />
        <button
          type="button"
          aria-label={isMuted ? "取消静音" : "静音"}
          title={isMuted ? "取消静音" : "静音"}
          disabled={!videoUrl || videoError}
          onClick={toggleMute}
          className="grid size-8 shrink-0 place-items-center rounded-full transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
        >
          {isMuted ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
        </button>
        <button
          type="button"
          aria-label="全屏播放"
          title="全屏"
          disabled={!videoUrl || videoError}
          onClick={enterFullscreen}
          className="grid size-8 shrink-0 place-items-center rounded-full transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Maximize2 className="size-4" />
        </button>
      </div>
      {videoError && (
        <p role="alert" className="text-center text-xs text-destructive">
          视频暂时无法播放，请检查网络或尝试下载原视频。
        </p>
      )}
    </div>
  );
}

export function GradientThumb(props: {
  seed: string;
  src?: string | null;
  thumbnailSrc?: string | null;
  alt?: string;
  mediaType?: "image" | "video" | "audio";
  videoPreview?: boolean;
  eagerMedia?: boolean;
  className?: string;
  children?: React.ReactNode;
  angle?: number;
  style?: React.CSSProperties;
}) {
  const mediaType = props.mediaType ?? "image";
  const mediaVisibility = useMediaVisibility(props.eagerMedia);
  const [videoError, setVideoError] = React.useState(false);
  const handleVideoLoadError = React.useCallback(
    () => setVideoError(true),
    [],
  );
  const sourceUrl = useMediaSource(
    mediaVisibility.visible &&
      (mediaType !== "video" || props.videoPreview)
      ? props.src
      : null,
    mediaType === "video" && props.videoPreview
      ? handleVideoLoadError
      : undefined,
    mediaType === "video" && props.videoPreview,
  );
  const thumbnailUrl = useMediaSource(
    mediaVisibility.visible ? props.thumbnailSrc : null,
  );
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const [videoReady, setVideoReady] = React.useState(false);
  const [videoPlaying, setVideoPlaying] = React.useState(false);
  const hash = hashSeed(props.seed);
  const palette = PALETTES[hash % PALETTES.length];
  const degrees = props.angle ?? hash % 360;
  const x = 20 + (hash % 60);
  const y = 20 + ((hash >> 3) % 60);

  React.useEffect(() => {
    setVideoReady(false);
    setVideoPlaying(false);
    setVideoError(false);
  }, [sourceUrl]);

  return (
    <div
      ref={mediaVisibility.containerRef}
      className={cn("relative overflow-hidden", props.className)}
      style={{
        ...props.style,
        backgroundColor: palette[0],
        backgroundImage: `radial-gradient(120% 120% at ${x}% ${y}%, ${palette[2]} 0%, transparent 45%), linear-gradient(${degrees}deg, ${palette[0]}, ${palette[1]})`,
      }}
    >
      <div className="absolute inset-0 bg-gradient-to-t from-black/15 via-transparent to-transparent" />
      {thumbnailUrl && mediaType === "video" && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={thumbnailUrl}
          alt={props.alt ?? ""}
          className="absolute inset-0 h-full w-full object-cover"
          loading="lazy"
        />
      )}
      {sourceUrl && mediaType === "video" && (
        <video
          ref={videoRef}
          src={sourceUrl}
          className={cn(
            "absolute inset-0 h-full w-full object-cover",
            !videoReady && "opacity-0",
          )}
          controls={props.videoPreview}
          playsInline
          preload="metadata"
          aria-label={props.alt ?? "视频预览"}
          onLoadedMetadata={(event) => {
            const video = event.currentTarget;
            setVideoReady(video.videoWidth > 0 && video.videoHeight > 0);
          }}
          onCanPlay={() => {
            setVideoReady(true);
            setVideoError(false);
          }}
          onPlay={() => setVideoPlaying(true)}
          onPause={() => setVideoPlaying(false)}
          onEnded={() => setVideoPlaying(false)}
          onError={() => {
            setVideoReady(false);
            setVideoPlaying(false);
            setVideoError(true);
          }}
        />
      )}
      {sourceUrl &&
        mediaType === "video" &&
        props.videoPreview &&
        videoReady &&
        !videoPlaying &&
        !videoError && (
          <button
            type="button"
            aria-label="播放视频"
            className="absolute left-1/2 top-1/2 z-10 grid -translate-x-1/2 -translate-y-1/2 place-items-center"
            onClick={(event) => {
              event.stopPropagation();
              videoRef.current?.play().catch(() => setVideoError(true));
            }}
          >
            <span className="grid h-14 w-14 place-items-center rounded-full bg-black/55 text-white shadow-lg backdrop-blur transition-transform hover:scale-105">
              <Play className="ml-0.5 h-6 w-6 fill-current" />
            </span>
          </button>
        )}
      {videoError && props.videoPreview && (
        <div
          role="status"
          className="absolute inset-0 z-20 grid place-items-center bg-black/65 p-6 text-center text-sm text-white"
        >
          视频暂时无法播放，请检查网络或尝试下载原视频。
        </div>
      )}
      {sourceUrl && mediaType === "image" && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={sourceUrl}
          alt={props.alt ?? ""}
          className="absolute inset-0 h-full w-full object-cover"
          loading="lazy"
        />
      )}
      {props.children}
    </div>
  );
}
