"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  PanelLeftClose,
  PanelLeftOpen,
  Sparkles,
  Zap,
} from "lucide-react";
import { Logo, LogoMark } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  STUDIO_NAV,
  STUDIO_NAV_BOTTOM,
  type NavItem,
} from "@/components/studio/nav-config";
import { useCurrentUser } from "@/lib/store/use-current-user";
import { cn, formatNumber } from "@/lib/utils";

function NavLink({
  item,
  collapsed,
  active,
  onNavigate,
}: {
  item: NavItem;
  collapsed: boolean;
  active: boolean;
  onNavigate?: () => void;
}) {
  const content = (
    <Link
      href={item.href}
      onClick={onNavigate}
      className={cn(
        "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
        collapsed && "justify-center px-0",
        active
          ? "bg-accent text-foreground"
          : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
      )}
    >
      {active && (
        <span className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-brand-gradient" />
      )}
      <item.icon
        className={cn(
          "h-[18px] w-[18px] shrink-0",
          active && "text-primary"
        )}
      />
      {!collapsed && <span className="flex-1">{item.label}</span>}
      {!collapsed && item.badge && (
        <span className="rounded-full bg-brand-gradient px-1.5 py-0.5 text-[10px] font-semibold text-white">
          {item.badge}
        </span>
      )}
    </Link>
  );

  if (collapsed) {
    return (
      <Tooltip delayDuration={0}>
        <TooltipTrigger asChild>{content}</TooltipTrigger>
        <TooltipContent side="right">{item.label}</TooltipContent>
      </Tooltip>
    );
  }
  return content;
}

export function Sidebar({
  collapsed,
  onToggleCollapse,
  onNavigate,
  mobile,
}: {
  collapsed: boolean;
  onToggleCollapse?: () => void;
  onNavigate?: () => void;
  mobile?: boolean;
}) {
  const pathname = usePathname();
  const { user } = useCurrentUser();
  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(href + "/");
  const creditPct = Math.round(
    ((user?.credits ?? 0) / Math.max(user?.creditsTotal ?? 0, 1)) * 100
  );

  return (
    <TooltipProvider>
      <div className="flex h-full flex-col bg-card/50">
        {/* 顶部 Logo */}
        <div
          className={cn(
            "flex h-16 items-center border-b border-border/60 px-4",
            collapsed && "justify-center px-0"
          )}
        >
          {collapsed ? (
            <Link
              href="/"
              className="grid h-9 w-9 place-items-center rounded-xl bg-brand-gradient text-white"
            >
              <LogoMark className="h-5 w-5" />
            </Link>
          ) : (
            <Logo />
          )}
        </div>

        {/* 新建创作 */}
        <div className={cn("p-3", collapsed && "px-2")}>
          {collapsed ? (
            <Tooltip delayDuration={0}>
              <TooltipTrigger asChild>
                <Button asChild variant="brand" size="icon" className="w-full">
                  <Link href="/studio/image">
                    <Sparkles className="h-4 w-4" />
                  </Link>
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">新建创作</TooltipContent>
            </Tooltip>
          ) : (
            <Button asChild variant="brand" className="w-full">
              <Link href="/studio/image">
                <Sparkles className="h-4 w-4" />
                新建创作
              </Link>
            </Button>
          )}
        </div>

        {/* 导航 */}
        <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-2">
          {STUDIO_NAV.map((group) => (
            <div key={group.title}>
              {!collapsed && (
                <p className="mb-1.5 px-3 text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">
                  {group.title}
                </p>
              )}
              <div className="space-y-1">
                {group.items.map((item) => (
                  <NavLink
                    key={item.href}
                    item={item}
                    collapsed={collapsed}
                    active={isActive(item.href)}
                    onNavigate={onNavigate}
                  />
                ))}
              </div>
            </div>
          ))}
        </nav>

        {/* 底部：算力 + 设置 + 折叠 */}
        <div className="space-y-1 border-t border-border/60 p-3">
          {STUDIO_NAV_BOTTOM.map((item) => (
            <NavLink
              key={item.href}
              item={item}
              collapsed={collapsed}
              active={isActive(item.href)}
              onNavigate={onNavigate}
            />
          ))}

          {!collapsed && (
            <div className="mt-2 rounded-xl border border-border/60 bg-background/50 p-3">
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5 font-medium">
                  <Zap className="h-3.5 w-3.5 text-primary" />
                  算力余额
                </span>
                <span className="text-muted-foreground">
                  {formatNumber(user?.credits ?? 0)}/{formatNumber(user?.creditsTotal ?? 0)}
                </span>
              </div>
              <Progress value={creditPct} className="mt-2 h-1.5" />
              <Button asChild size="sm" variant="outline" className="mt-3 w-full">
                <Link href="/studio/settings">升级套餐</Link>
              </Button>
            </div>
          )}

          {!mobile && onToggleCollapse && (
            <button
              onClick={onToggleCollapse}
              className={cn(
                "mt-1 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground",
                collapsed && "justify-center px-0"
              )}
            >
              {collapsed ? (
                <PanelLeftOpen className="h-[18px] w-[18px]" />
              ) : (
                <>
                  <PanelLeftClose className="h-[18px] w-[18px]" />
                  <span>收起侧栏</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </TooltipProvider>
  );
}
