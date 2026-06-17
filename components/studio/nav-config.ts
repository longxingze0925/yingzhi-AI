import {
  Compass,
  Image as ImageIcon,
  Music2,
  Video,
  FolderOpen,
  Library,
  Settings,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  badge?: string;
}

export interface NavGroup {
  title: string;
  items: NavItem[];
}

export const STUDIO_NAV: NavGroup[] = [
  {
    title: "探索",
    items: [{ label: "灵感广场", href: "/studio/explore", icon: Compass }],
  },
  {
    title: "创作",
    items: [
      { label: "图片生成", href: "/studio/image", icon: ImageIcon },
      { label: "视频生成", href: "/studio/video", icon: Video, badge: "New" },
      { label: "音频生成", href: "/studio/audio", icon: Music2 },
    ],
  },
  {
    title: "资源",
    items: [
      { label: "我的作品", href: "/studio/assets", icon: FolderOpen },
      { label: "素材资产库", href: "/studio/library", icon: Library },
    ],
  },
];

export const STUDIO_NAV_BOTTOM: NavItem[] = [
  { label: "账号与会员", href: "/studio/settings", icon: Settings },
];
