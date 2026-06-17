import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** 简单的相对时间格式化（mock 展示用） */
export function timeAgo(date: Date | number): string {
  const d = typeof date === "number" ? date : date.getTime();
  const diff = Date.now() - d;
  const min = Math.floor(diff / 60000);
  if (min < 1) return "刚刚";
  if (min < 60) return `${min} 分钟前`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} 小时前`;
  const day = Math.floor(h / 24);
  return `${day} 天前`;
}

/** 数字千分位 */
export function formatNumber(n: number): string {
  return n.toLocaleString("zh-CN");
}
