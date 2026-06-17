"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Menu,
  Bell,
  Zap,
  LogOut,
  User as UserIcon,
  Settings,
  Home,
  CreditCard,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { useCurrentUser } from "@/lib/store/use-current-user";
import { useLocalWorkspaceStore } from "@/lib/store/use-local-workspace";
import { formatNumber, timeAgo } from "@/lib/utils";

export function Topbar({ onOpenMobile }: { onOpenMobile: () => void }) {
  const router = useRouter();
  const { user, logout } = useCurrentUser();
  const notifications = useLocalWorkspaceStore((s) => s.notifications);
  const markNotificationsRead = useLocalWorkspaceStore((s) => s.markNotificationsRead);
  const clearNotifications = useLocalWorkspaceStore((s) => s.clearNotifications);
  const addNotification = useLocalWorkspaceStore((s) => s.addNotification);
  const unreadCount = notifications.filter((notice) => !notice.read).length;

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border/60 bg-background/80 px-4 backdrop-blur-xl sm:px-6">
      <button
        onClick={onOpenMobile}
        className="grid h-9 w-9 place-items-center rounded-lg text-muted-foreground hover:bg-accent lg:hidden"
        aria-label="打开菜单"
      >
        <Menu className="h-5 w-5" />
      </button>

      <div className="flex flex-1 items-center justify-end gap-1.5">
        {/* 算力 */}
        <Link
          href="/studio/settings"
          className="flex items-center gap-1.5 rounded-full border border-border bg-card/60 px-3 py-1.5 text-sm font-medium transition-colors hover:border-primary/40"
        >
          <Zap className="h-3.5 w-3.5 text-primary" />
          {formatNumber(user?.credits ?? 0)}
          <span className="hidden text-muted-foreground sm:inline">算力</span>
        </Link>

        <ThemeToggle />

        <DropdownMenu onOpenChange={(open) => open && markNotificationsRead()}>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="relative"
              aria-label="通知"
            >
              <Bell className="h-[1.15rem] w-[1.15rem]" />
              {unreadCount > 0 && (
                <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-primary" />
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80">
            <div className="flex items-center justify-between px-2 py-1.5">
              <p className="text-sm font-medium">通知</p>
              <button
                onClick={clearNotifications}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                清空
              </button>
            </div>
            <DropdownMenuSeparator />
            {notifications.length === 0 ? (
              <div className="px-2 py-8 text-center text-sm text-muted-foreground">
                暂无通知
              </div>
            ) : (
              <div className="max-h-80 overflow-y-auto">
                {notifications.map((notice) => (
                  <div key={notice.id} className="rounded-lg px-2.5 py-2">
                    <div className="flex items-center gap-2">
                      {!notice.read ? (
                        <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                      ) : (
                        <Check className="h-3 w-3 text-muted-foreground" />
                      )}
                      <p className="truncate text-sm font-medium">{notice.title}</p>
                      <span className="ml-auto shrink-0 text-[11px] text-muted-foreground">
                        {timeAgo(notice.createdAt)}
                      </span>
                    </div>
                    <p className="mt-1 line-clamp-2 pl-5 text-xs text-muted-foreground">
                      {notice.body}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* 头像菜单 */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="ml-1 rounded-full outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring">
              <Avatar className="h-9 w-9 ring-2 ring-border">
                <AvatarFallback>{user?.name.slice(0, 1) ?? "影"}</AvatarFallback>
              </Avatar>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-60">
            <div className="flex items-center gap-3 p-2">
              <Avatar className="h-10 w-10">
                <AvatarFallback>{user?.name.slice(0, 1) ?? "影"}</AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{user?.name ?? "未登录"}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {user?.email ?? "请先登录"}
                </p>
              </div>
            </div>
            <div className="px-2 pb-2">
              <Badge variant="brand" className="gap-1">
                <CreditCard className="h-3 w-3" />
                {user?.plan ?? "未登录"}
              </Badge>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/studio/settings">
                <UserIcon /> 个人资料
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/studio/settings">
                <Settings /> 账号设置
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/">
                <Home /> 返回首页
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onSelect={() => {
                void logout();
                addNotification("已退出登录", "已清理当前影织登录态。");
                router.push("/login");
              }}
            >
              <LogOut /> 退出登录
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
