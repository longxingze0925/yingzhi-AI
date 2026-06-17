"use client";

import * as React from "react";
import Link from "next/link";
import { Menu, X, ArrowRight } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const NAV = [
  { label: "功能", href: "/#features" },
  { label: "灵感广场", href: "/studio/explore" },
  { label: "定价", href: "/#pricing" },
  { label: "工作流", href: "/#workflow" },
];

export function Navbar() {
  const [scrolled, setScrolled] = React.useState(false);
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className="fixed inset-x-0 top-0 z-50">
      <div
        className={cn(
          "mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 transition-all duration-300 sm:px-6",
          scrolled &&
            "mt-2 max-w-6xl rounded-2xl border border-border/60 bg-background/70 px-4 shadow-lg backdrop-blur-xl sm:px-5"
        )}
      >
        <Logo />

        <nav className="hidden items-center gap-1 md:flex">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <ThemeToggle className="hidden sm:inline-flex" />
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="hidden sm:inline-flex"
          >
            <Link href="/login">登录</Link>
          </Button>
          <Button asChild variant="brand" size="sm" className="hidden sm:inline-flex">
            <Link href="/studio">
              进入工作台 <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>

          <button
            className="grid h-10 w-10 place-items-center rounded-lg text-foreground md:hidden"
            onClick={() => setOpen((v) => !v)}
            aria-label="菜单"
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* 移动端菜单 */}
      {open && (
        <div className="mx-4 mt-2 rounded-2xl border border-border bg-card/95 p-3 shadow-xl backdrop-blur-xl md:hidden">
          <nav className="flex flex-col">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className="rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                {item.label}
              </Link>
            ))}
            <div className="my-2 h-px bg-border" />
            <div className="flex items-center justify-between px-1">
              <ThemeToggle />
              <div className="flex gap-2">
                <Button asChild variant="outline" size="sm">
                  <Link href="/login">登录</Link>
                </Button>
                <Button asChild variant="brand" size="sm">
                  <Link href="/studio">进入工作台</Link>
                </Button>
              </div>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
