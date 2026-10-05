"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  User as UserIcon,
  CreditCard,
  BarChart3,
  KeyRound,
  Zap,
  Check,
  Copy,
  TicketCheck,
} from "lucide-react";
import { PageHeader } from "@/components/studio/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Switch } from "@/components/ui/switch";
import {
  getApiKeyInfo,
  getStudioTopUpInfo,
  getUsageSummary,
  redeemStudioCode,
} from "@/lib/api/client";
import type { StudioTopUpInfo } from "@/lib/api/client";
import type { ApiKeyInfo, UsageSummary, User } from "@/lib/api/types";
import { useCurrentUser } from "@/lib/store/use-current-user";
import { useLocalWorkspaceStore } from "@/lib/store/use-local-workspace";
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
  quota: 0,
  balanceDisplay: "$0",
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
  { value: "plan", label: "充值与算力", icon: CreditCard },
  { value: "usage", label: "用量统计", icon: BarChart3 },
  { value: "api", label: "API", icon: KeyRound },
];

export default function SettingsPage() {
  return (
    <React.Suspense
      fallback={
        <div className="mx-auto max-w-5xl px-4 py-8 text-sm text-muted-foreground sm:px-6 lg:px-8">
          正在打开账号设置...
        </div>
      }
    >
      <SettingsPageContent />
    </React.Suspense>
  );
}

function SettingsPageContent() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, refresh } = useCurrentUser();
  const currentUser = user ?? EMPTY_USER;
  const [usage, setUsage] = React.useState<UsageSummary>(FALLBACK_USAGE);
  const [apiKey, setApiKey] = React.useState<ApiKeyInfo>(FALLBACK_API_KEY);
  const [apiCopied, setApiCopied] = React.useState(false);
  const [topupInfo, setTopupInfo] = React.useState<StudioTopUpInfo>({
    enableRedemption: false,
    cardShopOptions: [],
    usdExchangeRate: 1,
  });
  const [topupInfoLoading, setTopupInfoLoading] = React.useState(true);
  const [topupInfoError, setTopupInfoError] = React.useState(false);
  const [redemptionCode, setRedemptionCode] = React.useState("");
  const [redeeming, setRedeeming] = React.useState(false);
  const [redemptionMessage, setRedemptionMessage] = React.useState<
    string | null
  >(null);
  const [redemptionError, setRedemptionError] = React.useState<string | null>(
    null,
  );
  const [profileName, setProfileName] = React.useState(currentUser.name);
  const [profileEmail, setProfileEmail] = React.useState(currentUser.email);
  const [avatarUrl, setAvatarUrl] = React.useState(currentUser.avatarUrl ?? "");
  const requestedTab = searchParams.get("tab");
  const tab =
    SETTINGS_TABS.find((item) => item.value === requestedTab)?.value ??
    "profile";
  const avatarInputRef = React.useRef<HTMLInputElement | null>(null);
  const preferences = useLocalWorkspaceStore((s) => s.preferences);
  const setPreference = useLocalWorkspaceStore((s) => s.setPreference);
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

    getStudioTopUpInfo()
      .then((info) => {
        if (alive) setTopupInfo(info);
      })
      .catch(() => {
        if (alive) setTopupInfoError(true);
      })
      .finally(() => {
        if (alive) setTopupInfoLoading(false);
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

  const redeemCode = React.useCallback(async () => {
    const code = redemptionCode.trim();
    if (!code) {
      setRedemptionError("请输入兑换码");
      return;
    }
    setRedeeming(true);
    setRedemptionError(null);
    setRedemptionMessage(null);
    try {
      await redeemStudioCode(code);
      setRedemptionCode("");
      setRedemptionMessage("兑换成功，余额已更新");
      await refresh();
    } catch (error) {
      setRedemptionError(
        error instanceof Error ? error.message : "兑换失败，请检查兑换码",
      );
    } finally {
      setRedeeming(false);
    }
  }, [redemptionCode, refresh]);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader
        title="账号与会员"
        description="管理你的个人资料、充值与算力"
      />

      <div className="mt-6">
        <div className="inline-flex flex-wrap items-center gap-1 rounded-lg bg-muted/60 p-1 text-muted-foreground">
          {SETTINGS_TABS.map((item) => {
            const Icon = item.icon;
            const active = tab === item.value;
            return (
              <button
                key={item.value}
                type="button"
                onClick={() => {
                  const nextSearchParams = new URLSearchParams(
                    searchParams.toString(),
                  );
                  if (item.value === "profile") {
                    nextSearchParams.delete("tab");
                  } else {
                    nextSearchParams.set("tab", item.value);
                  }
                  const query = nextSearchParams.toString();
                  router.replace(`${pathname}${query ? `?${query}` : ""}`, {
                    scroll: false,
                  });
                }}
                className={cn(
                  "inline-flex h-9 items-center justify-center gap-1.5 whitespace-nowrap rounded-md px-3 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  active
                    ? "bg-background text-foreground shadow-sm"
                    : "hover:text-foreground",
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
                    <p className="text-xs text-muted-foreground">
                      当前资料由统一账号系统提供
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
                      onChange={(event) =>
                        setProfileName(event.currentTarget.value)
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">邮箱</Label>
                    <Input
                      id="email"
                      type="email"
                      value={profileEmail}
                      readOnly
                      onChange={(event) =>
                        setProfileEmail(event.currentTarget.value)
                      }
                    />
                  </div>
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
                      onCheckedChange={(checked) =>
                        setPreference(item.label, checked)
                      }
                    />
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        )}

        {/* 充值与算力 */}
        {tab === "plan" && (
          <div className="mt-6 space-y-6">
            <Card className="glow-border overflow-hidden">
              <CardHeader>
                <CardTitle>充值算力</CardTitle>
                <p className="text-sm text-muted-foreground">
                  充值与兑换使用统一账户，生成任务按实际消耗扣除算力。
                </p>
              </CardHeader>
              <CardContent className="space-y-6 p-6 pt-0">
                <div className="rounded-xl border border-border/60 bg-background/40 p-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-1.5 font-medium">
                      <Zap className="h-4 w-4 text-primary" /> 可用算力
                    </span>
                    <span className="text-lg font-semibold">
                      {formatNumber(currentUser.credits)}
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    生成任务会按实际计费实时扣除，失败任务自动退款。
                  </p>
                </div>

                {topupInfoLoading ? (
                  <p className="text-sm text-muted-foreground">
                    正在读取充值档位...
                  </p>
                ) : topupInfoError ? (
                  <p className="text-sm text-destructive">
                    充值信息暂时无法加载，请刷新页面重试。
                  </p>
                ) : topupInfo.enableRedemption ? (
                  <section
                    className="space-y-3"
                    aria-labelledby="topup-amount-title"
                  >
                    <h3 id="topup-amount-title" className="text-sm font-medium">
                      选择充值金额
                    </h3>
                    {topupInfo.cardShopOptions.length > 0 ? (
                      <>
                        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                          {topupInfo.cardShopOptions.map((option) => (
                            <Button
                              key={`${option.amount}-${option.url}`}
                              asChild
                              variant="outline"
                              className="h-auto min-h-20 w-full flex-col items-start justify-center rounded-xl p-4 text-left whitespace-normal"
                            >
                              <a
                                href={option.url}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                <span className="text-base font-semibold sm:text-lg">
                                  {formatNumber(
                                    option.amount * topupInfo.usdExchangeRate,
                                  )}
                                </span>
                                <span className="mt-1.5 text-xs text-muted-foreground">
                                  购买兑换码
                                </span>
                              </a>
                            </Button>
                          ))}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          购买后复制发卡网提供的兑换码，在下方完成充值。
                        </p>
                      </>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        暂无可用充值档位，请联系管理员。
                      </p>
                    )}
                  </section>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    充值功能暂未开放，请联系管理员。
                  </p>
                )}

                {topupInfo.enableRedemption && (
                  <div className="rounded-xl border border-border/60 bg-background/40 p-4">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <TicketCheck className="h-4 w-4 text-primary" />
                      兑换码充值
                    </div>
                    <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                      <Input
                        value={redemptionCode}
                        onChange={(event) => {
                          setRedemptionCode(event.currentTarget.value);
                          setRedemptionError(null);
                          setRedemptionMessage(null);
                        }}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") void redeemCode();
                        }}
                        placeholder="请输入兑换码"
                        autoComplete="off"
                      />
                      <Button
                        variant="brand"
                        className="w-full sm:w-auto"
                        disabled={redeeming || !redemptionCode.trim()}
                        onClick={() => void redeemCode()}
                      >
                        {redeeming ? "兑换中" : "立即兑换"}
                      </Button>
                    </div>
                    {redemptionMessage && (
                      <p className="mt-2 text-xs text-emerald-500">
                        {redemptionMessage}
                      </p>
                    )}
                    {redemptionError && (
                      <p className="mt-2 text-xs text-destructive">
                        {redemptionError}
                      </p>
                    )}
                  </div>
                )}
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
                            Math.round((value / maxDailyCredit) * 100),
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
                  影织使用平台托管密钥调用统一网关，浏览器不会接触真实密钥。
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
                    <span className="text-primary">POST</span> {apiKey.endpoint}
                  </div>
                )}
                <div
                  className={cn(
                    "flex items-center gap-2 text-sm",
                    apiKey.enabled
                      ? "text-emerald-500"
                      : "text-muted-foreground",
                  )}
                >
                  <Check className="h-4 w-4" /> API 访问
                  {apiKey.enabled ? "已启用" : "未启用"}
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
