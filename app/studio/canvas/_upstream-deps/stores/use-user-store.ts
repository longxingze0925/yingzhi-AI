"use client";

import { create } from "zustand";
import { useCurrentUserStore } from "@/lib/store/use-current-user";
import type { User as ShadowweaveUser } from "@/lib/api/types";

const SHADOWWEAVE_ACCESS_TOKEN_KEY = "shadowweave.new_api.access_token";

type CanvasUser = {
    id: string;
    username: string;
    displayName: string;
    email: string;
    role: "user" | "admin" | "guest";
    credits: number;
    avatarUrl?: string;
};

type UserStore = {
    token: string;
    user: CanvasUser | null;
    isReady: boolean;
    isLoading: boolean;
    setSession: (token: string, user: CanvasUser) => void;
    clearSession: () => void;
    hydrateUser: () => Promise<void>;
    login: never;
    register: never;
};

function readShadowweaveToken() {
    if (typeof window === "undefined") return "";
    return window.localStorage.getItem(SHADOWWEAVE_ACCESS_TOKEN_KEY) ?? "";
}

function mapUser(user: ShadowweaveUser | null): CanvasUser | null {
    if (!user) return null;
    return {
        id: user.id,
        username: user.name,
        displayName: user.name,
        email: user.email,
        role: "user",
        credits: user.credits,
        avatarUrl: user.avatarUrl,
    };
}

function readShadowweaveState() {
    const state = useCurrentUserStore.getState();
    return {
        token: readShadowweaveToken(),
        user: mapUser(state.user),
        isReady: state.loaded,
        isLoading: state.loading,
    };
}

export const useUserStore = create<UserStore>((set) => ({
    ...readShadowweaveState(),
    setSession: (token, user) => set({ token, user, isReady: true, isLoading: false }),
    clearSession: () => {
        void useCurrentUserStore.getState().logout();
        set({ token: "", user: null, isReady: true, isLoading: false });
    },
    hydrateUser: async () => {
        await useCurrentUserStore.getState().load();
        set(readShadowweaveState());
    },
    login: undefined as never,
    register: undefined as never,
}));

useCurrentUserStore.subscribe((state) => {
    useUserStore.setState({
        token: readShadowweaveToken(),
        user: mapUser(state.user),
        isReady: state.loaded,
        isLoading: state.loading,
    });
});
