import { canvasDatabaseName } from "@/yingzhi/embedded-mode";

const ACCESS_TOKEN_KEY = "shadowweave.new_api.access_token";
const API_BASE = "/api";
const CANVAS_API_PREFIX = "/studio/canvas";
let refreshRequest: Promise<boolean> | null = null;
let canvasAccessEnabled = false;

export type StudioModel = {
    id: string;
    name: string;
    modality: "image" | "video" | "audio" | "text";
    defaultRouteId?: string;
    routes?: Array<{ id: string; name: string }>;
};

export type StudioProjectDocument = {
    id: string;
    title: string;
    createdAt: string;
    updatedAt: string;
    nodes: unknown[];
    connections: unknown[];
    chatSessions: unknown[];
    activeChatId: string | null;
    backgroundMode: string;
    showImageInfo: boolean;
    viewport: { x: number; y: number; k: number };
    canvasRuntime: "basketikun";
    [key: string]: unknown;
};

type StudioUserResponse = { user: { id: string | number; canvas_enabled?: boolean } };
type ApiEnvelope<T> = { success?: boolean; data?: T; message?: string; msg?: string };

function accessToken() {
    if (typeof window === "undefined") return "";
    return window.localStorage.getItem(ACCESS_TOKEN_KEY) || "";
}

function storeAccessToken(token: string) {
    if (typeof window === "undefined") return;
    if (token) window.localStorage.setItem(ACCESS_TOKEN_KEY, token);
    else window.localStorage.removeItem(ACCESS_TOKEN_KEY);
}

async function refreshAccessToken() {
    if (!refreshRequest) {
        refreshRequest = (async () => {
            try {
                const response = await fetch(`${API_BASE}/studio/auth/refresh`, {
                    method: "POST",
                    credentials: "include",
                    headers: { "Content-Type": "application/json" },
                });
                const envelope = (await response.json().catch(() => null)) as ApiEnvelope<{ access_token?: string }> | null;
                const token = envelope?.data?.access_token;
                if (!response.ok || envelope?.success === false || typeof token !== "string" || !token) {
                    storeAccessToken("");
                    return false;
                }
                storeAccessToken(token);
                return true;
            } catch {
                return false;
            }
        })().finally(() => {
            refreshRequest = null;
        });
    }
    return refreshRequest;
}

async function studioFetch(path: string, init: RequestInit = {}, canRefresh = true): Promise<Response> {
    const headers = new Headers(init.headers);
    if (accessToken()) headers.set("Authorization", `Bearer ${accessToken()}`);
    if (typeof init.body === "string" && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");

    const response = await fetch(`${API_BASE}${path}`, { ...init, headers, credentials: "include" });
    if (response.status === 401 && canRefresh && !path.endsWith("/auth/refresh") && (await refreshAccessToken())) {
        return studioFetch(path, init, false);
    }
    return response;
}

function canvasPath(path: string) {
    const normalized = path.startsWith("/") ? path : `/${path}`;
    return normalized.startsWith(`${CANVAS_API_PREFIX}/`) ? normalized : `${CANVAS_API_PREFIX}${normalized}`;
}

export async function studioCanvasFetch(path: string, init: RequestInit = {}, canRefresh = true): Promise<Response> {
    if (!canvasAccessEnabled) {
        throw Object.assign(new Error("Canvas access is not enabled for this account"), { status: 403 });
    }
    const endpoint = canvasPath(path);
    if (!endpoint.startsWith(`${CANVAS_API_PREFIX}/`)) throw new Error("Invalid canvas API path");
    return studioFetch(endpoint, init, canRefresh);
}

async function studioJson<T>(path: string, init: RequestInit = {}): Promise<T> {
    const response = path.startsWith(`${CANVAS_API_PREFIX}/`)
        ? await studioCanvasFetch(path, init)
        : await studioFetch(path, init);
    const body = (await response.json().catch(() => null)) as ApiEnvelope<T> | T | null;
    const envelope = body && typeof body === "object" ? (body as ApiEnvelope<T>) : null;
    if (!response.ok || envelope?.success === false) {
        const message = envelope?.message || envelope?.msg || `请求失败（HTTP ${response.status}）`;
        throw Object.assign(new Error(message), { status: response.status });
    }
    if (envelope && envelope.success === true && Object.prototype.hasOwnProperty.call(envelope, "data")) return envelope.data as T;
    return body as T;
}

export async function getStudioUser() {
    const response = await studioJson<StudioUserResponse>("/studio/bootstrap");
    canvasAccessEnabled = response.user?.canvas_enabled === true;
    return response;
}

export async function listCanvasProjects() {
    return studioJson<StudioProjectDocument[]>(canvasPath("/projects"));
}

export async function syncCanvasProjects(projects: StudioProjectDocument[]) {
    return studioJson<StudioProjectDocument[]>(canvasPath("/projects/sync"), {
        method: "POST",
        body: JSON.stringify({ projects }),
    });
}

export async function deleteCanvasProjects(ids: string[]) {
    if (!ids.length) return;
    await studioJson<{ deleted: boolean }>(canvasPath("/projects/delete"), {
        method: "POST",
        body: JSON.stringify({ ids }),
    });
}

export async function listStudioModels(type: StudioModel["modality"]) {
    const result = await studioJson<{ data: StudioModel[] }>(canvasPath(`/ai/models?type=${encodeURIComponent(type)}`));
    return Array.isArray(result.data) ? result.data : [];
}

export async function listStudioAssets() {
    return studioJson<{ materials?: Array<Record<string, unknown>> }>(canvasPath("/assets?metadataOnly=true"));
}

export async function uploadStudioAsset(file: Blob, filename: string, type: "image" | "video" | "audio" | "file", signal?: AbortSignal) {
    const params = new URLSearchParams({
        fileName: filename,
        assetType: type,
        assetRole: "canvas",
        mimeType: file.type || "application/octet-stream",
    });
    const response = await studioJson<{ assetId: string; url: string; mimeType?: string }>(canvasPath(`/assets/upload-file?${params}`), {
        method: "POST",
        headers: { "Content-Type": file.type || "application/octet-stream" },
        body: file,
        signal,
    });
    return response;
}

export function studioAssetPath(assetId: string) {
    return `${CANVAS_API_PREFIX}/assets/${encodeURIComponent(assetId)}/content`;
}

export function studioJobContentPath(jobId: string, index = 0) {
    return `${CANVAS_API_PREFIX}/generation/jobs/${encodeURIComponent(jobId)}/content?index=${index}`;
}

export function studioStoragePath(storageKey: string) {
    if (storageKey.startsWith("server:")) return studioAssetPath(storageKey.slice("server:".length));
    if (storageKey.startsWith("studio-job:")) {
        const [, jobId, index = "0"] = storageKey.split(":");
        return studioJobContentPath(jobId, Number(index) || 0);
    }
    return "";
}

export function studioMediaUrlForStorageKey(storageKey: string) {
    const path = studioStoragePath(storageKey);
    return path ? `${API_BASE}${path}` : "";
}

export function studioStorageKeyFromUrl(source: string) {
    if (typeof window === "undefined" || !source) return "";
    let url: URL;
    try {
        url = new URL(source, window.location.href);
    } catch {
        return "";
    }
    if (url.origin !== window.location.origin) return "";
    const assetId = url.pathname.match(/\/api\/studio\/(?:canvas\/)?assets\/([^/]+)\/content$/)?.[1];
    if (assetId) return `server:${decodeURIComponent(assetId)}`;
    const jobId = url.pathname.match(/\/api\/studio\/(?:canvas\/)?generation\/jobs\/([^/]+)\/content$/)?.[1];
    if (!jobId) return "";
    return `studio-job:${decodeURIComponent(jobId)}:${url.searchParams.get("index") || "0"}`;
}

export async function fetchStudioMedia(path: string, signal?: AbortSignal) {
    const response = await studioCanvasFetch(path, { signal });
    if (!response.ok) {
        const body = await response.json().catch(() => null) as { message?: string; msg?: string } | null;
        throw new Error(body?.message || body?.msg || `读取素材失败（HTTP ${response.status}）`);
    }
    return response.blob();
}

export function managedStorageDatabaseName() {
    return canvasDatabaseName;
}
