import { afterEach, beforeEach, expect, test } from "bun:test";

import {
    getStudioUser,
    listCanvasProjects,
    studioAssetPath,
    studioCanvasFetch,
    studioJobContentPath,
    studioMediaUrlForStorageKey,
    studioStorageKeyFromUrl,
    studioStoragePath,
} from "./studio-api";

const originalWindow = globalThis.window;
const originalFetch = globalThis.fetch;
let requests;

beforeEach(() => {
    requests = [];
    globalThis.window = {
        location: {
            href: "http://localhost:13000/canvas-runtime/index-embedded.html",
            origin: "http://localhost:13000",
        },
        localStorage: {
            getItem: () => null,
            setItem: () => undefined,
            removeItem: () => undefined,
        },
    };
    globalThis.fetch = async (input, init) => {
        const url = String(input);
        requests.push({ url, init });
        if (url === "/api/studio/bootstrap") {
            return Response.json({ success: true, data: { user: { id: 1, canvas_enabled: requests.bootstrapEnabled } } });
        }
        return Response.json({ success: true, data: [] });
    };
});

afterEach(() => {
    globalThis.window = originalWindow;
    globalThis.fetch = originalFetch;
});

test("拒绝画布权限时不发送项目或生成请求", async () => {
    requests.bootstrapEnabled = false;

    await getStudioUser();
    await expect(listCanvasProjects()).rejects.toMatchObject({ status: 403 });
    await expect(studioCanvasFetch("/studio/canvas/generation/jobs", { method: "POST" })).rejects.toMatchObject({ status: 403 });

    expect(requests.map((request) => request.url)).toEqual(["/api/studio/bootstrap"]);
});

test("允许画布权限时项目请求只走 Canvas 专属 API", async () => {
    requests.bootstrapEnabled = true;

    await getStudioUser();
    await listCanvasProjects();

    expect(requests.map((request) => request.url)).toEqual([
        "/api/studio/bootstrap",
        "/api/studio/canvas/projects",
    ]);
});

test("素材与生成结果的内容地址使用 Canvas 专属路由", () => {
    expect(studioAssetPath("asset/1")).toBe("/studio/canvas/assets/asset%2F1/content");
    expect(studioJobContentPath("job 1", 2)).toBe("/studio/canvas/generation/jobs/job%201/content?index=2");
    expect(studioStoragePath("server:asset-1")).toBe("/studio/canvas/assets/asset-1/content");
    expect(studioStoragePath("studio-job:job-1:3")).toBe("/studio/canvas/generation/jobs/job-1/content?index=3");
});

test("旧内容地址会解析为存储键并重新生成 Canvas 专属地址", () => {
    expect(studioStorageKeyFromUrl("/api/studio/assets/asset-1/content")).toBe("server:asset-1");
    expect(studioStorageKeyFromUrl("/api/studio/generation/jobs/job-1/content?index=2")).toBe("studio-job:job-1:2");
    expect(studioMediaUrlForStorageKey("server:asset-1")).toBe("/api/studio/canvas/assets/asset-1/content");
    expect(studioMediaUrlForStorageKey("studio-job:job-1:2")).toBe("/api/studio/canvas/generation/jobs/job-1/content?index=2");
});
