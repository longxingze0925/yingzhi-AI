"use client";

import * as React from "react";
import { create } from "zustand";
import { getUser, logoutRemote } from "@/lib/api/client";
import type { User } from "@/lib/api/types";

interface CurrentUserState {
  user: User | null;
  loading: boolean;
  loaded: boolean;
  error: string | null;
  load: () => Promise<void>;
  refresh: () => Promise<void>;
  updateProfile: (patch: Pick<User, "name" | "email"> & { avatarUrl?: string }) => void;
  logout: () => Promise<void>;
}

export const useCurrentUserStore = create<CurrentUserState>((set, get) => ({
  user: null,
  loading: false,
  loaded: false,
  error: null,

  load: async () => {
    const { loaded, loading } = get();
    if (loaded || loading) return;

    await get().refresh();
  },

  refresh: async () => {
    set({ loading: true, error: null });
    try {
      const user = await getUser();
      set({ user, loading: false, loaded: true });
    } catch (err) {
      set({
        user: null,
        loading: false,
        loaded: true,
        error: err instanceof Error ? err.message : "用户信息加载失败",
      });
    }
  },

  updateProfile: (patch) =>
    set((state) => ({
      user: state.user ? { ...state.user, ...patch } : null,
    })),

  logout: async () => {
    try {
      await logoutRemote();
    } catch {
      // 本地仍然清理前端状态，后端 session 过期时退出不应阻塞用户。
    }
    set({
      user: null,
      loaded: true,
      loading: false,
      error: null,
    });
  },
}));

export function useCurrentUser() {
  const user = useCurrentUserStore((s) => s.user);
  const loading = useCurrentUserStore((s) => s.loading);
  const loaded = useCurrentUserStore((s) => s.loaded);
  const error = useCurrentUserStore((s) => s.error);
  const load = useCurrentUserStore((s) => s.load);
  const refresh = useCurrentUserStore((s) => s.refresh);
  const updateProfile = useCurrentUserStore((s) => s.updateProfile);
  const logout = useCurrentUserStore((s) => s.logout);

  React.useEffect(() => {
    void load();
  }, [load]);

  return {
    user,
    loading,
    loaded,
    error,
    authenticated: Boolean(user),
    refresh,
    updateProfile,
    logout,
  };
}
