"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Check,
  Mail,
  RefreshCw,
  ShieldCheck,
  UserPlus,
} from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { GradientThumb } from "@/components/brand/gradient-thumb";
import { Turnstile } from "@/components/auth/turnstile";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GALLERY } from "@/data/mock/gallery";
import {
  getStudioAuthConfig,
  loginWithPassword,
  registerStudioUser,
  sendStudioEmailVerification,
  verifyStudioTwoFactor,
  type StudioAuthConfig,
} from "@/lib/api/client";
import { useCurrentUserStore } from "@/lib/store/use-current-user";
import { cn } from "@/lib/utils";

const HIGHLIGHTS = [
  "全部图片与视频模型，影视级画质",
  "统一账号与余额，多端实时同步",
  "失败任务自动退款，消费记录可追踪",
  "作品云端同步，多端创作",
];

const DEFAULT_AUTH_CONFIG: StudioAuthConfig = {
  registerEnabled: true,
  passwordRegisterEnabled: true,
  emailVerificationEnabled: false,
  turnstileEnabled: false,
  turnstileSiteKey: "",
};

type AuthMode = "login" | "register" | "two-factor";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = React.useState<AuthMode>("login");
  const [config, setConfig] =
    React.useState<StudioAuthConfig>(DEFAULT_AUTH_CONFIG);
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [verificationCode, setVerificationCode] = React.useState("");
  const [twoFactorCode, setTwoFactorCode] = React.useState("");
  const [twoFactorFlowToken, setTwoFactorFlowToken] = React.useState("");
  const [turnstileToken, setTurnstileToken] = React.useState("");
  const [turnstileKey, setTurnstileKey] = React.useState(0);
  const [submitting, setSubmitting] = React.useState(false);
  const [sendingCode, setSendingCode] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);
  const refreshCurrentUser = useCurrentUserStore((state) => state.refresh);

  React.useEffect(() => {
    getStudioAuthConfig()
      .then(setConfig)
      .catch(() => setConfig(DEFAULT_AUTH_CONFIG));
  }, []);

  const resetTurnstile = React.useCallback(() => {
    setTurnstileToken("");
    setTurnstileKey((current) => current + 1);
  }, []);

  const finishLogin = React.useCallback(async () => {
    await refreshCurrentUser();
    const searchParams = new URLSearchParams(window.location.search);
    const next = searchParams.get("next");
    router.push(next?.startsWith("/studio") ? next : "/studio");
  }, [refreshCurrentUser, router]);

  const submitLogin = React.useCallback(async () => {
    const nextEmail = email.trim();
    if (!nextEmail || !password) {
      setError("请输入邮箱和密码");
      return;
    }
    if (config.turnstileEnabled && !turnstileToken) {
      setError("请先完成人机验证");
      return;
    }
    setSubmitting(true);
    setError(null);
    setNotice(null);
    try {
      const result = await loginWithPassword({
        email: nextEmail,
        password,
        turnstileToken,
      });
      if (result.kind === "two_factor_required") {
        setTwoFactorFlowToken(result.flowToken);
        setTwoFactorCode("");
        setMode("two-factor");
        return;
      }
      await finishLogin();
    } catch (err) {
      setError(err instanceof Error ? err.message : "登录失败，请稍后重试");
    } finally {
      setSubmitting(false);
      if (config.turnstileEnabled) resetTurnstile();
    }
  }, [
    config.turnstileEnabled,
    email,
    finishLogin,
    password,
    resetTurnstile,
    turnstileToken,
  ]);

  const submitTwoFactor = React.useCallback(async () => {
    if (!twoFactorFlowToken || !twoFactorCode.trim()) {
      setError("请输入两步验证码或备用码");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await verifyStudioTwoFactor({
        flowToken: twoFactorFlowToken,
        code: twoFactorCode.trim(),
      });
      await finishLogin();
    } catch (err) {
      setError(err instanceof Error ? err.message : "两步验证失败，请稍后重试");
    } finally {
      setSubmitting(false);
    }
  }, [finishLogin, twoFactorCode, twoFactorFlowToken]);

  const submitRegistration = React.useCallback(async () => {
    const nextEmail = email.trim();
    if (!nextEmail || !password) {
      setError("请输入邮箱和密码");
      return;
    }
    if (password.length < 8) {
      setError("密码至少需要 8 个字符");
      return;
    }
    if (config.emailVerificationEnabled && !verificationCode.trim()) {
      setError("请输入邮箱验证码");
      return;
    }
    if (config.turnstileEnabled && !turnstileToken) {
      setError("请先完成人机验证");
      return;
    }
    setSubmitting(true);
    setError(null);
    setNotice(null);
    try {
      const params = new URLSearchParams(window.location.search);
      await registerStudioUser({
        email: nextEmail,
        password,
        verificationCode: verificationCode.trim(),
        affCode: params.get("aff") ?? undefined,
        turnstileToken,
      });
      setMode("login");
      setVerificationCode("");
      setNotice("注册成功，请使用新账号登录");
    } catch (err) {
      setError(err instanceof Error ? err.message : "注册失败，请稍后重试");
    } finally {
      setSubmitting(false);
      if (config.turnstileEnabled) resetTurnstile();
    }
  }, [
    config.emailVerificationEnabled,
    config.turnstileEnabled,
    email,
    password,
    resetTurnstile,
    turnstileToken,
    verificationCode,
  ]);

  const sendVerificationCode = React.useCallback(async () => {
    const nextEmail = email.trim();
    if (!nextEmail) {
      setError("请先输入邮箱地址");
      return;
    }
    if (config.turnstileEnabled && !turnstileToken) {
      setError("请先完成人机验证");
      return;
    }
    setSendingCode(true);
    setError(null);
    setNotice(null);
    try {
      await sendStudioEmailVerification({
        email: nextEmail,
        turnstileToken,
      });
      setNotice("验证码已发送，请检查邮箱");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "验证码发送失败，请稍后重试",
      );
    } finally {
      setSendingCode(false);
      if (config.turnstileEnabled) resetTurnstile();
    }
  }, [config.turnstileEnabled, email, resetTurnstile, turnstileToken]);

  const submit = () => {
    if (mode === "two-factor") return submitTwoFactor();
    if (mode === "register") return submitRegistration();
    return submitLogin();
  };

  const switchMode = (nextMode: AuthMode) => {
    setMode(nextMode);
    setError(null);
    setNotice(null);
    setTwoFactorCode("");
    setTwoFactorFlowToken("");
    resetTurnstile();
  };

  const turnstileReady = !config.turnstileEnabled || Boolean(turnstileToken);

  return (
    <div className="flex min-h-screen">
      <div className="relative hidden w-1/2 overflow-hidden lg:block">
        <div className="absolute inset-0 grid grid-cols-3 gap-3 p-6 opacity-90">
          {[0, 1, 2].map((column) => (
            <div
              key={column}
              className={cn(
                "flex flex-col gap-3",
                column === 1 ? "animate-marquee-vertical" : "",
              )}
              style={{ ["--marquee-duration" as string]: "50s" }}
            >
              {[...GALLERY, ...GALLERY]
                .slice(column * 6, column * 6 + 10)
                .map((media, index) => (
                  <GradientThumb
                    key={`${media.id}-${index}`}
                    seed={media.seed}
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
            {HIGHLIGHTS.map((highlight) => (
              <li key={highlight} className="flex items-center gap-2.5 text-sm">
                <span className="grid h-5 w-5 place-items-center rounded-full bg-brand-gradient text-white">
                  <Check className="h-3 w-3" />
                </span>
                {highlight}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="relative flex w-full flex-col lg:w-1/2">
        <div className="flex items-center justify-between p-6">
          <Logo />
          <ThemeToggle />
        </div>
        <div className="flex flex-1 items-center justify-center px-6 pb-16">
          <div className="w-full max-w-sm">
            <h1 className="text-2xl font-bold tracking-tight">
              {mode === "register"
                ? "创建影织账号"
                : mode === "two-factor"
                  ? "完成两步验证"
                  : "欢迎回来"}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {mode === "register"
                ? "账号、余额与生成记录将由统一后端保存"
                : mode === "two-factor"
                  ? "请输入验证器代码或备用码"
                  : "登录以继续你的创作之旅"}
            </p>

            {mode !== "two-factor" &&
              config.registerEnabled &&
              config.passwordRegisterEnabled && (
                <div className="mt-6 grid grid-cols-2 rounded-lg border border-border bg-card/40 p-1">
                  <button
                    type="button"
                    onClick={() => switchMode("login")}
                    className={cn(
                      "rounded-md px-3 py-2 text-sm font-medium",
                      mode === "login"
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground",
                    )}
                  >
                    登录
                  </button>
                  <button
                    type="button"
                    onClick={() => switchMode("register")}
                    className={cn(
                      "rounded-md px-3 py-2 text-sm font-medium",
                      mode === "register"
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground",
                    )}
                  >
                    注册
                  </button>
                </div>
              )}

            <div className="mt-6 space-y-4">
              {mode === "two-factor" ? (
                <div className="space-y-2">
                  <Label htmlFor="two-factor-code">验证码或备用码</Label>
                  <Input
                    id="two-factor-code"
                    autoComplete="one-time-code"
                    placeholder="请输入 6 位验证码"
                    value={twoFactorCode}
                    onChange={(event) =>
                      setTwoFactorCode(event.currentTarget.value)
                    }
                    onKeyDown={(event) => {
                      if (event.key === "Enter") void submitTwoFactor();
                    }}
                  />
                </div>
              ) : (
                <>
                  <div className="inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-card/40 px-3 text-sm font-medium text-muted-foreground">
                    {mode === "register" ? (
                      <UserPlus className="h-4 w-4" />
                    ) : (
                      <Mail className="h-4 w-4" />
                    )}
                    邮箱{mode === "register" ? "注册" : "登录"}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">邮箱地址</Label>
                    <Input
                      id="email"
                      type="email"
                      autoComplete="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(event) => setEmail(event.currentTarget.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password">密码</Label>
                    <Input
                      id="password"
                      type="password"
                      autoComplete={
                        mode === "register"
                          ? "new-password"
                          : "current-password"
                      }
                      placeholder={
                        mode === "register" ? "至少 8 个字符" : "请输入密码"
                      }
                      value={password}
                      onChange={(event) =>
                        setPassword(event.currentTarget.value)
                      }
                      onKeyDown={(event) => {
                        if (event.key === "Enter") void submit();
                      }}
                    />
                  </div>
                  {mode === "register" && config.emailVerificationEnabled && (
                    <div className="space-y-2">
                      <Label htmlFor="verification-code">邮箱验证码</Label>
                      <div className="flex gap-2">
                        <Input
                          id="verification-code"
                          inputMode="numeric"
                          placeholder="验证码"
                          value={verificationCode}
                          onChange={(event) =>
                            setVerificationCode(event.currentTarget.value)
                          }
                        />
                        <Button
                          type="button"
                          variant="outline"
                          disabled={sendingCode || !turnstileReady}
                          onClick={() => void sendVerificationCode()}
                        >
                          {sendingCode ? (
                            <RefreshCw className="h-4 w-4 animate-spin" />
                          ) : (
                            "发送验证码"
                          )}
                        </Button>
                      </div>
                    </div>
                  )}
                  {config.turnstileEnabled && config.turnstileSiteKey && (
                    <Turnstile
                      key={turnstileKey}
                      siteKey={config.turnstileSiteKey}
                      onVerify={setTurnstileToken}
                      onExpire={() => setTurnstileToken("")}
                    />
                  )}
                </>
              )}
            </div>

            {notice && (
              <p className="mt-4 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-600">
                {notice}
              </p>
            )}
            {error && (
              <p className="mt-4 rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </p>
            )}

            <Button
              variant="brand"
              size="lg"
              className="mt-6 w-full"
              disabled={
                submitting || (mode !== "two-factor" && !turnstileReady)
              }
              onClick={() => void submit()}
            >
              {submitting
                ? "正在处理"
                : mode === "register"
                  ? "创建账号"
                  : mode === "two-factor"
                    ? "验证并登录"
                    : "登录"}
              {mode === "two-factor" ? (
                <ShieldCheck className="h-4 w-4" />
              ) : (
                <ArrowRight className="h-4 w-4" />
              )}
            </Button>

            {mode === "two-factor" && (
              <button
                type="button"
                className="mt-4 w-full text-center text-sm text-muted-foreground hover:text-foreground"
                onClick={() => switchMode("login")}
              >
                返回密码登录
              </button>
            )}

            <p className="mt-6 text-center text-xs text-muted-foreground/70">
              继续即表示同意平台的服务条款与隐私政策
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
