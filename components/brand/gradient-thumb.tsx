import { cn } from "@/lib/utils";

/**
 * 占位媒体缩略图 —— 用确定性的渐变 + 网格/噪点生成有质感的封面，
 * 避免依赖外链图片。后续对接 Rust 后端后替换为真实 <img>/<video>。
 */
const PALETTES = [
  ["#5a7df0", "#8aa0f5", "#cdd8fb"], // 蓝
  ["#6f86e0", "#9b86e8", "#d3c9f4"], // 蓝紫
  ["#4fb6c9", "#7fcbd0", "#c2e7e6"], // 青
  ["#6aa0e8", "#a7c2f0", "#dbe7f8"], // 天蓝
  ["#7e8cf0", "#aab0f3", "#dadcfb"], // 长春花
  ["#5fb0a8", "#92c9bf", "#cbe6df"], // 蓝绿
  ["#e8a98a", "#f0c0a3", "#f6dcc8"], // 暖驼
  ["#9aa3b8", "#bcc3d4", "#e0e4ec"], // 中性蓝灰
];

function hashSeed(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (h << 5) - h + seed.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

export function GradientThumb({
  seed,
  src,
  alt,
  mediaType = "image",
  className,
  children,
  angle,
  style,
}: {
  seed: string;
  src?: string | null;
  alt?: string;
  mediaType?: "image" | "video" | "audio";
  className?: string;
  children?: React.ReactNode;
  angle?: number;
  style?: React.CSSProperties;
}) {
  const h = hashSeed(seed);
  const palette = PALETTES[h % PALETTES.length];
  const deg = angle ?? (h % 360);
  const x = 20 + (h % 60);
  const y = 20 + ((h >> 3) % 60);

  return (
    <div
      className={cn("relative overflow-hidden", className)}
      style={{
        ...style,
        backgroundColor: palette[0],
        backgroundImage: `radial-gradient(120% 120% at ${x}% ${y}%, ${palette[2]} 0%, transparent 45%), linear-gradient(${deg}deg, ${palette[0]}, ${palette[1]})`,
      }}
    >
      <div className="absolute inset-0 bg-gradient-to-t from-black/15 via-transparent to-transparent" />
      {src && mediaType === "video" && (
        <video
          src={src}
          className="absolute inset-0 h-full w-full object-cover"
          muted
          playsInline
          preload="metadata"
        />
      )}
      {src && mediaType === "image" && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={alt ?? ""}
          className="absolute inset-0 h-full w-full object-cover"
          loading="lazy"
        />
      )}
      {children}
    </div>
  );
}
