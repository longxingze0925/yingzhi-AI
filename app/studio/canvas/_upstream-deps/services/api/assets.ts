import { listAssets } from "@/lib/api/client";

export type AssetLibraryItem = {
    id: string;
    title: string;
    type: "text" | "image" | "video" | "audio";
    coverUrl: string;
    tags: string[];
    category: string;
    description: string;
    content: string;
    url: string;
    createdAt: string;
    updatedAt: string;
};

export type AssetLibraryResponse = {
    items: AssetLibraryItem[];
    tags: string[];
    categories: string[];
    total: number;
};

export type AssetLibraryQuery = {
    keyword?: string;
    type?: string;
    category?: string;
    tag?: string[];
    page?: number;
    pageSize?: number;
};

export async function fetchAssetLibrary(query: AssetLibraryQuery = {}): Promise<AssetLibraryResponse> {
    const library = await listAssets({
        kind: query.type && query.type !== "text" ? query.type : undefined,
        page: query.page,
        pageSize: query.pageSize,
    });
    const items: AssetLibraryItem[] = library.materials.map((item) => ({
            id: item.id,
            title: item.name,
            type: item.kind === "image" || item.kind === "video" || item.kind === "audio" ? item.kind : "text",
            coverUrl: item.thumbnailUrl || item.url || "",
            tags: [],
            category: item.folderId || "",
            description: item.source || "",
            content: item.url || "",
            url: item.url || "",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        }));
    return {
        items,
        tags: [],
        categories: library.folders.map((folder) => folder.name),
        total: items.length,
    } satisfies AssetLibraryResponse;
}
