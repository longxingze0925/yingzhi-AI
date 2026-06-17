import Link from "next/link";
import { Logo } from "@/components/brand/logo";

const GROUPS = [
  {
    title: "产品",
    links: [
      { label: "文生图", href: "/studio/image" },
      { label: "文生视频", href: "/studio/video" },
      { label: "灵感广场", href: "/studio/explore" },
      { label: "定价", href: "/#pricing" },
    ],
  },
  {
    title: "资源",
    links: [
      { label: "使用指南", href: "#" },
      { label: "提示词手册", href: "#" },
      { label: "API 文档", href: "#" },
      { label: "更新日志", href: "#" },
    ],
  },
  {
    title: "公司",
    links: [
      { label: "关于我们", href: "#" },
      { label: "加入我们", href: "#" },
      { label: "联系销售", href: "#" },
      { label: "商务合作", href: "#" },
    ],
  },
  {
    title: "法律",
    links: [
      { label: "服务条款", href: "#" },
      { label: "隐私政策", href: "#" },
      { label: "内容规范", href: "#" },
      { label: "授权说明", href: "#" },
    ],
  },
];

export function Footer() {
  return (
    <footer className="relative border-t border-border/60 bg-card/30">
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <div className="grid gap-10 lg:grid-cols-[1.5fr_repeat(4,1fr)]">
          <div className="max-w-xs">
            <Logo />
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
              影织 Shadowweave —— 用一句话编织影像。
              为创作者与品牌提供专业级 AI 图片与视频生成能力。
            </p>
          </div>

          {GROUPS.map((group) => (
            <div key={group.title}>
              <h4 className="text-sm font-semibold">{group.title}</h4>
              <ul className="mt-4 space-y-2.5">
                {group.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-border/60 pt-8 text-xs text-muted-foreground sm:flex-row">
          <p>© 2026 影织 Shadowweave. 保留所有权利。</p>
          <p className="opacity-70">
            所有生成内容请遵守平台内容规范与相关法律法规 · 沪ICP备 0000000 号
          </p>
        </div>
      </div>
    </footer>
  );
}
