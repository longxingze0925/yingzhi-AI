import localforage from "localforage";
import type { StateStorage } from "zustand/middleware";
import { canvasDatabaseName, canvasPersistPrefix } from "@/yingzhi/embedded-mode";

localforage.config({
    name: canvasDatabaseName,
    storeName: "app_state",
});

function storageName(name: string) {
    return `${canvasPersistPrefix}${name}`;
}

export const localForageStorage: StateStorage = {
    getItem: async (name) => {
        if (typeof window === "undefined") return null;
        try {
            return (await localforage.getItem<string>(storageName(name))) || null;
        } catch {
            return window.localStorage.getItem(storageName(name));
        }
    },
    setItem: async (name, value) => {
        if (typeof window === "undefined") return;
        try {
            await localforage.setItem(storageName(name), value);
        } catch {
            window.localStorage.setItem(storageName(name), value);
        }
    },
    removeItem: async (name) => {
        if (typeof window === "undefined") return;
        try {
            await localforage.removeItem(storageName(name));
        } catch {
            window.localStorage.removeItem(storageName(name));
        }
    },
};
