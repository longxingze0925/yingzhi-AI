"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { X } from "lucide-react";
import { Sidebar } from "@/components/studio/sidebar";
import { Topbar } from "@/components/studio/topbar";
import { useCurrentUser } from "@/lib/store/use-current-user";
import { cn } from "@/lib/utils";

export function StudioShell({ children }: { children: React.ReactNode }) {
  return (
    <React.Suspense
      fallback={
        <div className="grid h-screen place-items-center bg-background text-sm text-muted-foreground">
          正在加载工作台...
        </div>
      }
    >
      <StudioShellInner>{children}</StudioShellInner>
    </React.Suspense>
  );
}

function StudioShellInner({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { user, loading, loaded } = useCurrentUser();
  const [collapsed, setCollapsed] = React.useState(false);
  const [mobileOpen, setMobileOpen] = React.useState(false);

  React.useEffect(() => {
    if (loaded && !loading && !user) {
      const query = searchParams.toString();
      const next = query ? `${pathname}?${query}` : pathname;
      router.replace(`/login?next=${encodeURIComponent(next)}`);
    }
  }, [loaded, loading, pathname, router, searchParams, user]);

  if (!user) {
    return (
      <div className="grid h-screen place-items-center bg-background text-sm text-muted-foreground">
        {loading || !loaded ? "正在确认登录状态..." : "正在跳转登录..."}
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* 桌面侧栏 */}
      <aside
        className={cn(
          "hidden shrink-0 border-r border-border/60 transition-[width] duration-300 lg:block",
          collapsed ? "w-[76px]" : "w-[264px]"
        )}
      >
        <Sidebar
          collapsed={collapsed}
          onToggleCollapse={() => setCollapsed((v) => !v)}
        />
      </aside>

      {/* 移动端抽屉 */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          <div className="absolute left-0 top-0 h-full w-[280px] border-r border-border bg-card shadow-2xl">
            <button
              onClick={() => setMobileOpen(false)}
              className="absolute right-3 top-4 z-10 grid h-9 w-9 place-items-center rounded-lg text-muted-foreground hover:bg-accent"
              aria-label="关闭菜单"
            >
              <X className="h-5 w-5" />
            </button>
            <Sidebar
              collapsed={false}
              mobile
              onNavigate={() => setMobileOpen(false)}
            />
          </div>
        </div>
      )}

      {/* 主区 */}
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar onOpenMobile={() => setMobileOpen(true)} />
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
