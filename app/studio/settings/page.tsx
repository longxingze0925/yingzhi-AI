"use client";

import * as React from "react";
import {
  User as UserIcon,
  CreditCard,
  BarChart3,
  KeyRound,
  Zap,
  Check,
  Copy,
  Sparkles,
  Upload,
  Lock,
} from "lucide-react";
import { PageHeader } from "@/components/studio/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import { getApiKeyInfo, getUsageSummary } from "@/lib/api/client";
import type { ApiKeyInfo, UsageSummary, User } from "@/lib/api/types";
import { useCurrentUser } from "@/lib/store/use-current-user";
import { useLocalWorkspaceStore } from "@/lib/store/use-local-workspace";
import { usePricingPlans } from "@/lib/store/use-pricing-plans";
import { cn, formatNumber } from "@/lib/utils";

const FALLBACK_USAGE: UsageSummary = {
  stats: [
    { label: "本月生成", value: "0", unit: "次", trend: "本月" },
    { label: "已用算力", value: "0", unit: "点", trend: "本月" },
    { label: "图片作品", value: "0", unit: "张" },
    { label: "视频作品", value: "0", unit: "条" },
  ],
  dailyCredits: Array.from({ length: 30 }, () => 0),
};

const FALLBACK_API_KEY: ApiKeyInfo = {
  maskedKey: "暂未开放",
  endpoint: "",
  enabled: false,
};

const EMPTY_USER: User = {
  id: "",
  name: "未登录",
  email: "",
  avatarSeed: "anonymous",
  plan: "未登录",
  credits: 0,
  creditsTotal: 0,
};

type SettingsTab = "profile" | "plan" | "usage" | "api";

const SETTINGS_TABS: Array<{
  value: SettingsTab;
  label: string;
  icon: React.ElementType;
}> = [
  { value: "profile", label: "个人资料", icon: UserIcon },
  { value: "plan", label: "套餐与算力", icon: CreditCard },
  { value: "usage", label: "用量统计", icon: BarChart3 },
  { value: "api", label: "API", icon: KeyRound },
];

function UpgradeDialog() {
  const { plans, loading } = usePricingPlans();
  const hasPlans = plans.length > 0;

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="brand" size="sm">
          <Sparkles className="h-4 w-4" /> 升级套餐
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>升级你的创作方案</DialogTitle>
          <DialogDescription>解锁更多算力、模型与商用授权</DialogDescription>
        </DialogHeader>
        {!hasPlans ? (
          <div className="rounded-lg border border-border/60 bg-muted/40 px-4 py-8 text-center text-sm text-muted-foreground">
            {loading ? "正在读取套餐..." : "EntitleHub 暂未开放 Web 套餐购买接口。"}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-3">
            {plans.map((plan) => (
            <div
              key={plan.id}
              className={cn(
                "flex flex-col rounded-xl border p-4",
                plan.highlighted
                  ? "border-primary/50 bg-primary/5"
                  : "border-border"
              )}
            >
              <p className="text-sm font-semibold">{plan.name}</p>
              <p className="mt-2 text-2xl font-bold">
                ¥{plan.priceMonthly}
                <span className="text-xs font-normal text-muted-foreground">
                  /月
                </span>
              </p>
              <p className="mt-1 text-xs text-primary">{plan.credits}</p>
              <Button
                variant={plan.highlighted ? "brand" : "outline"}
                size="sm"
                className="mt-4"
                disabled
              >
                {plan.cta}
              </Button>
            </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default function SettingsPage() {
  const { user } = useCurrentUser();
  const currentUser = user ?? EMPTY_USER;
  const [usage, setUsage] = React.useState<UsageSummary>(FALLBACK_USAGE);
  const [apiKey, setApiKey] = React.useState<ApiKeyInfo>(FALLBACK_API_KEY);
  const [apiCopied, setApiCopied] = React.useState(false);
  const [profileName, setProfileName] = React.useState(currentUser.name);
  const [profileEmail, setProfileEmail] = React.useState(currentUser.email);
  const [avatarUrl, setAvatarUrl] = React.useState(currentUser.avatarUrl ?? "");
  const [tab, setTab] = React.useState<SettingsTab>("profile");
  const avatarInputRef = React.useRef<HTMLInputElement | null>(null);
  const preferences = useLocalWorkspaceStore((s) => s.preferences);
  const setPreference = useLocalWorkspaceStore((s) => s.setPreference);
  const creditPct = Math.round(
    (currentUser.credits / Math.max(currentUser.creditsTotal, 1)) * 100
  );
  const maxDailyCredit = Math.max(...usage.dailyCredits, 1);

  React.useEffect(() => {
    setProfileName(currentUser.name);
    setProfileEmail(currentUser.email);
    setAvatarUrl(currentUser.avatarUrl ?? "");
  }, [currentUser.avatarUrl, currentUser.email, currentUser.name]);

  React.useEffect(() => {
    let alive = true;

    getUsageSummary()
      .then((nextUsage) => {
        if (alive) setUsage(nextUsage);
      })
      .catch(() => {
        if (alive) setUsage(FALLBACK_USAGE);
      });

    getApiKeyInfo()
      .then((nextApiKey) => {
        if (alive) setApiKey(nextApiKey);
      })
      .catch(() => {
        if (alive) setApiKey(FALLBACK_API_KEY);
      });

    return () => {
      alive = false;
    };
  }, []);

  const pickAvatar = React.useCallback((file?: File) => {
    if (!file || !file.type.startsWith("image/")) return;
    const nextUrl = URL.createObjectURL(file);
    setAvatarUrl((current) => {
      if (current.startsWith("blob:")) URL.revokeObjectURL(current);
      return nextUrl;
    });
  }, []);

  const copyApiKeyInfo = React.useCallback(async () => {
    if (!apiKey.enabled || !apiKey.endpoint) return;
    const text = `${apiKey.maskedKey}\n${apiKey.endpoint}`;
    try {
      await navigator.clipboard.writeText(text);
      setApiCopied(true);
      window.setTimeout(() => setApiCopied(false), 1600);
    } catch {
      setApiCopied(false);
    }
  }, [apiKey.enabled, apiKey.endpoint, apiKey.maskedKey]);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader title="账号与会员" description="管理你的个人资料、套餐与算力" />

      <div className="mt-6">
        <div className="inline-flex flex-wrap items-center gap-1 rounded-lg bg-muted/60 p-1 text-muted-foreground">
          {SETTINGS_TABS.map((item) => {
            const Icon = item.icon;
            const active = tab === item.value;
            return (
              <button
                key={item.value}
                type="button"
                onClick={() => setTab(item.value)}
                className={cn(
                  "inline-flex h-9 items-center justify-center gap-1.5 whitespace-nowrap rounded-md px-3 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  active
                    ? "bg-background text-foreground shadow-sm"
                    : "hover:text-foreground"
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </button>
            );
          })}
        </div>

        {/* 个人资料 */}
        {tab === "profile" && (
        <div className="mt-6 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>基本信息</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="flex items-center gap-4">
                <Avatar className="h-16 w-16 text-lg">
                  {avatarUrl && <AvatarImage src={avatarUrl} alt="" />}
                  <AvatarFallback>{profileName.slice(0, 1)}</AvatarFallback>
                </Avatar>
                <div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => avatarInputRef.current?.click()}
                    disabled
                  >
                    <Upload className="h-4 w-4" /> 更换头像
                  </Button>
                  <input
                    ref={avatarInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(event) => {
                      pickAvatar(event.currentTarget.files?.[0]);
                      event.currentTarget.value = "";
                    }}
                  />
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    资料保存接口暂未开放，当前仅展示 EntitleHub 登录资料
                  </p>
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="name">昵称</Label>
                  <Input
                    id="name"
                    value={profileName}
                    readOnly
                    onChange={(event) => setProfileName(event.currentTarget.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">邮箱</Label>
                  <Input
                    id="email"
                    type="email"
                    value={profileEmail}
                    readOnly
                    onChange={(event) => setProfileEmail(event.currentTarget.value)}
                  />
                </div>
              </div>
              <div className="flex justify-end">
                <Button variant="brand" disabled>
                  <Lock className="h-4 w-4" /> 等待后台接口
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>偏好设置</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {[
                { label: "作品默认公开到灵感广场", checked: false },
                { label: "生成完成邮件通知", checked: true },
                { label: "新模型与活动推送", checked: true },
              ].map((item) => (
                <div
                  key={item.label}
                  className="flex items-center justify-between"
                >
                  <span className="text-sm">{item.label}</span>
                  <Switch
                    checked={preferences[item.label] ?? item.checked}
                    onCheckedChange={(checked) => setPreference(item.label, checked)}
                  />
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
        )}

        {/* 套餐与算力 */}
        {tab === "plan" && (
        <div className="mt-6 space-y-6">
          <Card className="glow-border overflow-hidden">
            <CardContent className="p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <Badge variant="brand">{currentUser.plan}</Badge>
                    <span className="text-sm text-muted-foreground">
                      当前套餐
                    </span>
                  </div>
                  <p className="mt-3 text-sm text-muted-foreground">
                    套餐状态以 EntitleHub 返回为准
                  </p>
                </div>
                <UpgradeDialog />
              </div>

              <div className="mt-6 rounded-xl border border-border/60 bg-background/40 p-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-1.5 font-medium">
                    <Zap className="h-4 w-4 text-primary" /> 算力余额
                  </span>
                  <span>
                    {formatNumber(currentUser.credits)} /{" "}
                    {formatNumber(currentUser.creditsTotal)}
                  </span>
                </div>
                <Progress value={creditPct} className="mt-3" />
                <div className="mt-3 flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">
                    每月 1 日重置 · 剩余 {creditPct}%
                  </p>
                  <Button variant="outline" size="sm" disabled>
                    等待购买接口
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
        )}

        {/* 用量统计 */}
        {tab === "usage" && (
        <div className="mt-6 space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {usage.stats.map((s) => (
              <Card key={s.label}>
                <CardContent className="p-5">
                  <p className="text-sm text-muted-foreground">{s.label}</p>
                  <div className="mt-2 flex items-baseline gap-1">
                    <span className="text-3xl font-bold">{s.value}</span>
                    <span className="text-sm text-muted-foreground">
                      {s.unit}
                    </span>
                  </div>
                  {s.trend && (
                    <Badge variant="success" className="mt-2">
                      {s.trend}
                    </Badge>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
          <Card>
            <CardHeader>
              <CardTitle>近 30 天算力消耗</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex h-40 items-end gap-1.5">
                {usage.dailyCredits.map((value, i) => {
                  const h =
                    value === 0
                      ? 4
                      : Math.max(
                          8,
                          Math.round((value / maxDailyCredit) * 100)
                        );
                  return (
                    <div
                      key={i}
                      className="flex-1 rounded-t bg-brand-gradient opacity-80 transition-opacity hover:opacity-100"
                      style={{ height: `${h}%` }}
                    />
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>
        )}

        {/* API */}
        {tab === "api" && (
        <div className="mt-6 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>API 密钥</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                使用 API 将影织的生成能力接入你自己的应用（后端基于 Rust 提供高并发服务）。
              </p>
              <div className="flex items-center gap-2">
                <Input
                  readOnly
                  value={apiKey.maskedKey}
                  className="font-mono"
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={copyApiKeyInfo}
                  disabled={!apiKey.enabled || !apiKey.endpoint}
                  title="复制 API 信息"
                  aria-label="复制 API 信息"
                >
                  {apiCopied ? (
                    <Check className="h-4 w-4 text-emerald-500" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
              {apiKey.endpoint && (
                <div className="rounded-lg border border-border/60 bg-muted/40 p-4 font-mono text-xs text-muted-foreground">
                  <span className="text-primary">POST</span>{" "}
                  {apiKey.endpoint}
                </div>
              )}
              <div
                className={cn(
                  "flex items-center gap-2 text-sm",
                  apiKey.enabled ? "text-emerald-500" : "text-muted-foreground"
                )}
              >
                <Check className="h-4 w-4" /> API 访问{apiKey.enabled ? "已启用" : "未启用"}
              </div>
            </CardContent>
          </Card>
        </div>
        )}
      </div>
    </div>
  );
}
