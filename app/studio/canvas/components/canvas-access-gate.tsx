"use client";

import type { ReactNode } from "react";
import { useCurrentUser } from "@/lib/store/use-current-user";

export function CanvasAccessGate({ children }: { children: ReactNode }) {
    const { user, loading, loaded } = useCurrentUser();

    if (!loaded || loading) {
        return <div className="grid min-h-[240px] place-items-center text-sm text-muted-foreground" role="status">正在验证画布权限…</div>;
    }
    if (!user) return null;
    if (!user.canvasEnabled) {
        return <div className="grid min-h-[240px] place-items-center p-6 text-center text-sm text-muted-foreground" role="alert">当前账号未开通无限画布使用权限，请联系管理员。</div>;
    }

    return <>{children}</>;
}
