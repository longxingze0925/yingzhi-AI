export const isYingzhiEmbedded = typeof window !== "undefined" && window.location.pathname.startsWith("/canvas-runtime/");

export function navigateToYingzhi(path: "/studio" | "/studio/canvas", searchParams?: URLSearchParams) {
    if (typeof window === "undefined" || window.parent === window) return false;

    try {
        if (window.parent.location.origin !== window.location.origin) return false;
        const query = searchParams?.toString();
        window.parent.location.assign(query ? `${path}?${query}` : path);
        return true;
    } catch {
        return false;
    }
}

// Keep the shared media object stores readable when a project is imported from
// the host library; embedded Zustand state remains isolated by the key prefix.
export const canvasDatabaseName = "infinite-canvas";

export const canvasPersistPrefix = isYingzhiEmbedded ? "yingzhi-canvas:" : "";

export const YINGZHI_MANAGED_BASE_URL = "yingzhi://new-api";
