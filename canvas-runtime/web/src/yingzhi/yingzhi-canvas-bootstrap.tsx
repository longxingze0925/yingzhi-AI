import { useEffect, useState, type ReactNode } from "react";
import { App } from "antd";
import { useTranslation } from "react-i18next";

import { CanvasRefreshShell } from "@/components/canvas/canvas-refresh-shell";
import { defaultConfig, encodeChannelModel, useConfigStore } from "@/stores/use-config-store";
import { useAssetStore, type Asset } from "@/stores/use-asset-store";
import { useCanvasStore, type CanvasProject } from "@/stores/canvas/use-canvas-store";
import { deleteCanvasProjects, getStudioUser, listCanvasProjects, listStudioAssets, listStudioModels, studioAssetPath, syncCanvasProjects, type StudioModel, type StudioProjectDocument } from "@/yingzhi/studio-api";
import { YINGZHI_MANAGED_BASE_URL } from "@/yingzhi/embedded-mode";
import { registerStudioModelCatalog } from "@/yingzhi/studio-generation";

type BootstrapStatus = { kind: "loading" } | { kind: "ready" } | { kind: "denied" } | { kind: "error"; message: string };

let activeCanvasSyncFlush: (() => Promise<void>) | null = null;

export function flushYingzhiCanvasSync() {
    return activeCanvasSyncFlush?.() || Promise.resolve();
}

function waitForHydration(store: typeof useCanvasStore | typeof useAssetStore) {
    if (store.getState().hydrated) return Promise.resolve();
    return new Promise<void>((resolve) => {
        const unsubscribe = store.subscribe((state) => {
            if (!state.hydrated) return;
            unsubscribe();
            resolve();
        });
    });
}

function normalizeProject(document: StudioProjectDocument): CanvasProject {
    const now = new Date().toISOString();
    const viewport = document.viewport;
    return {
        ...document,
        id: document.id,
        title: document.title || "",
        createdAt: document.createdAt || now,
        updatedAt: document.updatedAt || now,
        nodes: Array.isArray(document.nodes) ? document.nodes as CanvasProject["nodes"] : [],
        connections: Array.isArray(document.connections) ? document.connections as CanvasProject["connections"] : [],
        chatSessions: Array.isArray(document.chatSessions) ? document.chatSessions as CanvasProject["chatSessions"] : [],
        activeChatId: typeof document.activeChatId === "string" ? document.activeChatId : null,
        backgroundMode: document.backgroundMode === "dots" || document.backgroundMode === "blank" ? document.backgroundMode : "lines",
        showImageInfo: document.showImageInfo === true,
        viewport: viewport && Number.isFinite(viewport.x) && Number.isFinite(viewport.y) && Number.isFinite(viewport.k) ? viewport : { x: 0, y: 0, k: 1 },
    };
}

function studioAssetsToCanvasAssets(materials: Array<Record<string, unknown>>): Asset[] {
    return materials.flatMap((item): Asset[] => {
        const id = typeof item.id === "string" ? item.id : "";
        const kind = item.kind === "image" || item.kind === "video" ? item.kind : "";
        if (!id || !kind) return [];
        const now = new Date(typeof item.createdAt === "number" ? item.createdAt * 1000 : Date.now()).toISOString();
        const url = `/api${studioAssetPath(id)}`;
        const base = {
            id,
            title: typeof item.name === "string" ? item.name : id,
            coverUrl: url,
            tags: [] as string[],
            createdAt: now,
            updatedAt: now,
        };
        if (kind === "image") {
            return [{ ...base, kind, data: { dataUrl: url, storageKey: `server:${id}`, width: 0, height: 0, bytes: Number(item.bytes) || 0, mimeType: typeof item.mimeType === "string" ? item.mimeType : "image/png" } }];
        }
        return [{ ...base, kind, data: { url, storageKey: `server:${id}`, width: 0, height: 0, bytes: Number(item.bytes) || 0, mimeType: typeof item.mimeType === "string" ? item.mimeType : "video/mp4" } }];
    });
}

function configureManagedModels(models: StudioModel[]) {
    const channelId = "yingzhi";
    const channelModels = models.map((model) => ({ name: model.id, capability: model.modality }));
    const encoded = models.map((model) => encodeChannelModel(channelId, model.id));
    const firstModel = (type: StudioModel["modality"]) => {
        const model = models.find((item) => item.modality === type);
        return model ? encodeChannelModel(channelId, model.id) : "";
    };
    const channel = {
        id: channelId,
        name: "影织",
        baseUrl: YINGZHI_MANAGED_BASE_URL,
        apiKey: "",
        apiFormat: "openai" as const,
        models: channelModels,
    };
    useConfigStore.setState((state) => ({
        ...state,
        config: {
            ...defaultConfig,
            channelMode: "remote",
            baseUrl: YINGZHI_MANAGED_BASE_URL,
            apiKey: "",
            channels: [channel],
            models: encoded,
            model: firstModel("image") || firstModel("text"),
            imageModel: firstModel("image"),
            videoModel: firstModel("video"),
            audioModel: firstModel("audio"),
            textModel: firstModel("text"),
        },
    }));
}

function startCanvasSync(onError: (error: unknown) => void) {
    let saveTimer: ReturnType<typeof setTimeout> | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let inFlight: Promise<void> | null = null;
    let disposed = false;
    const pendingProjects = new Map<string, CanvasProject>();
    const pendingDeletes = new Set<string>();

    const flush = async () => {
        while (!disposed) {
            if (saveTimer) {
                clearTimeout(saveTimer);
                saveTimer = null;
            }
            if (retryTimer) {
                clearTimeout(retryTimer);
                retryTimer = null;
            }
            if (inFlight) {
                await inFlight;
                continue;
            }
            if (!pendingProjects.size && !pendingDeletes.size) return;

            const projects = [...pendingProjects.values()];
            const ids = [...pendingDeletes];
            pendingProjects.clear();
            pendingDeletes.clear();
            const request = (async () => {
                await deleteCanvasProjects(ids);
                if (projects.length) {
                    const documents = projects.map((project) => ({ ...project, canvasRuntime: "basketikun" as const })) as StudioProjectDocument[];
                    await syncCanvasProjects(documents);
                }
            })();
            inFlight = request;
            try {
                await request;
            } catch (error) {
                projects.forEach((project) => {
                    if (!pendingProjects.has(project.id)) pendingProjects.set(project.id, project);
                });
                ids.forEach((id) => pendingDeletes.add(id));
                if (!disposed) {
                    retryTimer = setTimeout(() => {
                        retryTimer = null;
                        void flush().catch(onError);
                    }, 5000);
                }
                throw error;
            } finally {
                if (inFlight === request) inFlight = null;
            }
        }
    };

    const scheduleFlush = () => {
        if (saveTimer) clearTimeout(saveTimer);
        saveTimer = setTimeout(() => void flush().catch(onError), 400);
    };

    const unsubscribe = useCanvasStore.subscribe((state, previous) => {
        const previousProjects = new Map(previous.projects.map((project) => [project.id, project]));
        state.projects.forEach((project) => {
            if (previousProjects.get(project.id) !== project) pendingProjects.set(project.id, project);
        });
        const previousDeletedIds = new Set(previous.deletedProjects.map((item) => item.id));
        state.deletedProjects.forEach((item) => {
            if (!previousDeletedIds.has(item.id)) {
                pendingProjects.delete(item.id);
                pendingDeletes.add(item.id);
            }
        });
        scheduleFlush();
    });

    const stop = () => {
        disposed = true;
        unsubscribe();
        if (saveTimer) clearTimeout(saveTimer);
        if (retryTimer) clearTimeout(retryTimer);
    };

    return { flush, stop };
}

export function YingzhiCanvasBootstrap({ children }: { children: ReactNode }) {
    const { message } = App.useApp();
    const { t } = useTranslation();
    const [status, setStatus] = useState<BootstrapStatus>({ kind: "loading" });

    useEffect(() => {
        let active = true;
        let stopSync: (() => void) | undefined;

        const bootstrap = async () => {
            await Promise.all([waitForHydration(useCanvasStore), waitForHydration(useAssetStore)]);

            try {
                const currentUser = await getStudioUser();
                if (currentUser.user?.canvas_enabled !== true) {
                    if (active) setStatus({ kind: "denied" });
                    return;
                }

                const [rawProjects, imageModels, videoModels, audioModels, textModels, assetLibrary] = await Promise.all([
                    listCanvasProjects(),
                    listStudioModels("image"),
                    listStudioModels("video"),
                    listStudioModels("audio"),
                    listStudioModels("text"),
                    listStudioAssets(),
                ]);
                if (!active) return;

                // Keep IndexedDB untouched until auth and canvas permission succeed and the server snapshot is available.
                // Only documents written by this runtime are loaded; legacy canvas JSON is not schema-compatible.
                const projects = rawProjects.filter((project) => project.canvasRuntime === "basketikun").map(normalizeProject);
                const models = [...imageModels, ...videoModels, ...audioModels, ...textModels];
                registerStudioModelCatalog(models);
                configureManagedModels(models);
                useCanvasStore.getState().replaceProjects(projects, []);
                useAssetStore.getState().replaceAssets(studioAssetsToCanvasAssets(assetLibrary.materials || []));
                const canvasSync = startCanvasSync((error) => {
                    if (active) message.error(error instanceof Error ? error.message : t("apiErrors.requestFailed"));
                });
                activeCanvasSyncFlush = canvasSync.flush;
                stopSync = () => {
                    if (activeCanvasSyncFlush === canvasSync.flush) activeCanvasSyncFlush = null;
                    canvasSync.stop();
                };
                setStatus({ kind: "ready" });
            } catch (error) {
                const statusCode = (error as { status?: number })?.status;
                if (statusCode === 401 && typeof window !== "undefined") {
                    const target = window.parent === window ? window : window.parent;
                    target.location.assign("/login");
                    return;
                }
                if (statusCode === 403) {
                    if (active) setStatus({ kind: "denied" });
                    return;
                }
                if (active) setStatus({ kind: "error", message: error instanceof Error ? error.message : t("apiErrors.requestFailed") });
            }
        };

        void bootstrap();
        return () => {
            active = false;
            stopSync?.();
        };
    }, [message, t]);

    if (status.kind === "loading") return <CanvasRefreshShell />;
    if (status.kind === "denied") {
        return <div className="flex h-dvh items-center justify-center p-6 text-center text-sm text-destructive" role="alert">{t("apiErrors.authenticationFailed")}</div>;
    }
    if (status.kind === "error") {
        return <div className="flex h-dvh items-center justify-center p-6 text-center text-sm text-destructive" role="alert">{status.message}</div>;
    }
    return <>{children}</>;
}
