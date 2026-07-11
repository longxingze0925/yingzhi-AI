"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, Mail } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GradientThumb } from "@/components/brand/gradient-thumb";
import { GALLERY } from "@/data/mock/gallery";
import { loginWithPassword } from "@/lib/api/client";
import { useCurrentUserStore } from "@/lib/store/use-current-user";
import { cn } from "@/lib/utils";

const HIGHLIGHTS = [
  "全部图片与视频模型，影视级画质",
  "新用户注册即赠 100 算力点",
  "无水印导出与商用授权",
  "作品云端同步，多端创作",
];

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const refreshCurrentUser = useCurrentUserStore((s) => s.refresh);

  const submitLogin = React.useCallback(async () => {
    const nextEmail = email.trim();
    if (!nextEmail || !password) {
      setError("请输入邮箱和密码");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await loginWithPassword({ email: nextEmail, password });
      await refreshCurrentUser();
      const searchParams = new URLSearchParams(window.location.search);
      const next = searchParams.get("next");
      router.push(next?.startsWith("/studio") ? next : "/studio");
    } catch (err) {
      setError(err instanceof Error ? err.message : "登录失败，请稍后重试");
    } finally {
      setSubmitting(false);
    }
  }, [email, password, refreshCurrentUser, router]);

  return (
    <div className="flex min-h-screen">
      {/* 左侧品牌视觉 */}
      <div className="relative hidden w-1/2 overflow-hidden lg:block">
        <div className="absolute inset-0 grid grid-cols-3 gap-3 p-6 opacity-90">
          {[0, 1, 2].map((c) => (
            <div
              key={c}
              className={cn(
                "flex flex-col gap-3",
                c === 1 ? "animate-marquee-vertical" : ""
              )}
              style={{ ["--marquee-duration" as string]: "50s" }}
            >
              {[...GALLERY, ...GALLERY]
                .slice(c * 6, c * 6 + 10)
                .map((m, i) => (
                  <GradientThumb
                    key={`${m.id}-${i}`}
                    seed={m.seed}
                    className="aspect-[3/4] w-full shrink-0 rounded-xl"
                  />
                ))}
            </div>
          ))}
        </div>
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/70 to-background/30" />
        <div className="absolute inset-0 bg-gradient-to-r from-transparent to-background" />

        <div className="absolute bottom-0 left-0 right-0 p-12">
          <h2 className="text-3xl font-bold leading-tight">
            用一句话，<span className="text-gradient">编织影像</span>
          </h2>
          <ul className="mt-6 space-y-3">
            {HIGHLIGHTS.map((h) => (
              <li key={h} className="flex items-center gap-2.5 text-sm">
                <span className="grid h-5 w-5 place-items-center rounded-full bg-brand-gradient text-white">
                  <Check className="h-3 w-3" />
                </span>
                {h}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* 右侧表单 */}
      <div className="relative flex w-full flex-col lg:w-1/2">
        <div className="flex items-center justify-between p-6">
          <Logo />
          <ThemeToggle />
        </div>

        <div className="flex flex-1 items-center justify-center px-6 pb-16">
          <div className="w-full max-w-sm">
            <h1 className="text-2xl font-bold tracking-tight">
              欢迎回来
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              登录以继续你的创作之旅
            </p>

            <div className="mt-8 space-y-4">
              <div className="inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-card/40 px-3 text-sm font-medium text-muted-foreground">
                <Mail className="h-4 w-4" /> 邮箱登录
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">邮箱地址</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(event) => setEmail(event.currentTarget.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") void submitLogin();
                  }}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pwd">密码</Label>
                <Input
                  id="pwd"
                  type="password"
                  placeholder="请输入密码"
                  value={password}
                  onChange={(event) => setPassword(event.currentTarget.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") void submitLogin();
                  }}
                />
              </div>
            </div>

            {error && (
              <p className="mt-4 rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </p>
            )}

            <Button
              variant="brand"
              size="lg"
              className="mt-6 w-full"
              disabled={submitting}
              onClick={() => void submitLogin()}
            >
              {submitting ? "正在登录" : "登录"}
              <ArrowRight className="h-4 w-4" />
            </Button>

            <p className="mt-6 text-center text-xs text-muted-foreground/70">
              继续即表示同意
              <span className="mx-0.5 underline decoration-dotted" title="服务条款暂未开放">
                服务条款
              </span>
              与
              <span className="mx-0.5 underline decoration-dotted" title="隐私政策暂未开放">
                隐私政策
              </span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
