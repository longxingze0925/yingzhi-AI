"use client";

import * as React from "react";
import {
  Upload,
  FolderPlus,
  Folder,
  ImageIcon,
  Film,
  Music2,
  Palette,
  Trash2,
} from "lucide-react";
import { PageHeader } from "@/components/studio/page-header";
import { PageContainer, TILE_GRID } from "@/components/studio/page-container";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { GradientThumb } from "@/components/brand/gradient-thumb";
import {
  createAssetFolder,
  createAssetUpload,
  deleteAssetRemote,
  listAssets,
} from "@/lib/api/client";
import type { AssetItem, AssetsLibrary } from "@/lib/api/types";
import { useLocalWorkspaceStore } from "@/lib/store/use-local-workspace";
import { cn } from "@/lib/utils";

const EMPTY_LIBRARY: AssetsLibrary = {
  folders: [],
  materials: [],
};
const MAX_LOCAL_ASSET_MB = 50;
const MAX_LOCAL_ASSET_BYTES = MAX_LOCAL_ASSET_MB * 1024 * 1024;

const FOLDER_ICONS = {
  image: ImageIcon,
  video: Film,
  audio: Music2,
  style: Palette,
  folder: Folder,
};

export default function LibraryPage() {
  const [library, setLibrary] = React.useState<AssetsLibrary>(EMPTY_LIBRARY);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [selectedFolder, setSelectedFolder] = React.useState("all");
  const [folderDialogOpen, setFolderDialogOpen] = React.useState(false);
  const [folderName, setFolderName] = React.useState("");
  const [dragging, setDragging] = React.useState(false);
  const uploadInputRef = React.useRef<HTMLInputElement | null>(null);
  const addNotification = useLocalWorkspaceStore((s) => s.addNotification);

  React.useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    listAssets()
      .then((nextLibrary) => {
        if (alive) setLibrary(nextLibrary);
      })
      .catch((err) => {
        if (!alive) return;
        setLibrary(EMPTY_LIBRARY);
        setError(err instanceof Error ? err.message : "素材资产加载失败");
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  const folders = React.useMemo(
    () =>
      library.folders.map((folder) => ({
        ...folder,
        count: library.materials.filter((item) => item.folderId === folder.id).length,
      })),
    [library.folders, library.materials]
  );
  const materials = library.materials;
  const activeFolderId =
    selectedFolder === "all"
      ? folders[0]?.id ?? "local"
      : selectedFolder;
  const visibleMaterials =
    selectedFolder === "all"
      ? materials
      : materials.filter((item) => item.folderId === selectedFolder);

  const reloadLibrary = React.useCallback(async () => {
    const nextLibrary = await listAssets();
    setLibrary(nextLibrary);
  }, []);

  const createFolder = async () => {
    const name = folderName.trim();
    if (!name) return;
    try {
      const folder = await createAssetFolder({ name, kind: "folder" });
      setLibrary((current) => ({
        ...current,
        folders: [folder, ...current.folders.filter((item) => item.id !== folder.id)],
      }));
      setSelectedFolder(folder.id);
      addNotification("已新建文件夹", name);
      setFolderName("");
      setFolderDialogOpen(false);
    } catch {
      addNotification("新建文件夹失败", "EntitleHub 文件夹接口返回失败，请稍后重试。");
    }
  };

  const assetTypeForFile = (file: File): AssetItem["kind"] => {
    if (file.type.startsWith("audio/")) return "audio";
    if (file.type.startsWith("video/")) return "video";
    if (file.name.toLowerCase().endsWith(".safetensors")) return "style";
    return "image";
  };

  const uploadRemoteFile = async (file: File, folderId?: string) => {
    const upload = await createAssetUpload({
      folderId,
      fileName: file.name,
      assetType: assetTypeForFile(file),
      assetRole: "reference",
      mimeType: file.type || "application/octet-stream",
      fileSize: file.size,
    });
    if (!/^https?:\/\//i.test(upload.url)) {
      throw new Error("upload url unavailable");
    }
    const headers = Object.fromEntries(
      Object.entries(upload.headers ?? {}).filter(
        (entry): entry is [string, string] => typeof entry[1] === "string"
      )
    );
    const res = await fetch(upload.url, {
      method: upload.method || "PUT",
      headers,
      body: file,
    });
    if (!res.ok) {
      throw new Error(`upload failed: ${res.status}`);
    }
  };

  const uploadFiles = async (fileList: FileList | File[]) => {
    const candidates = Array.from(fileList);
    const oversized = candidates.filter((file) => file.size > MAX_LOCAL_ASSET_BYTES);
    const files = candidates.filter((file) => {
      const name = file.name.toLowerCase();
      const supported =
        file.type.startsWith("image/") ||
        file.type.startsWith("video/") ||
        file.type.startsWith("audio/") ||
        name.endsWith(".webp") ||
        name.endsWith(".safetensors");
      return file.size <= MAX_LOCAL_ASSET_BYTES && supported;
    });
    if (oversized.length > 0) {
      addNotification(
        "部分素材超过大小限制",
        `已跳过 ${oversized.length} 个超过 ${MAX_LOCAL_ASSET_MB}MB 的文件。`
      );
    }
    if (files.length === 0) {
      addNotification("没有可上传的素材", "支持图片、视频、音频、WebP 与 safetensors 文件。");
      return;
    }

    const folderId =
      activeFolderId && activeFolderId !== "all" ? activeFolderId : undefined;

    try {
      await Promise.all(files.map((file) => uploadRemoteFile(file, folderId)));
      await reloadLibrary();
      addNotification("素材已上传", `新增 ${files.length} 个素材`);
    } catch {
      addNotification("素材上传失败", "EntitleHub 上传接口返回失败，请稍后重试。");
    }
  };

  const deleteMaterial = async (item: AssetItem) => {
    try {
      await deleteAssetRemote(item.id);
      setLibrary((current) => ({
        ...current,
        materials: current.materials.filter((material) => material.id !== item.id),
      }));
      addNotification("素材已删除", item.name);
    } catch {
      addNotification("素材删除失败", "请稍后重试，或确认 EntitleHub 素材删除接口配置。");
    }
  };

  return (
    <PageContainer>
      <PageHeader title="素材资产库" description="集中管理参考图、参考视频、参考音频、首尾帧与品牌资产">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setFolderDialogOpen(true)}
        >
          <FolderPlus className="h-4 w-4" /> 新建文件夹
        </Button>
        <Button
          variant="brand"
          size="sm"
          onClick={() => uploadInputRef.current?.click()}
        >
          <Upload className="h-4 w-4" /> 上传素材
        </Button>
        <input
          ref={uploadInputRef}
          type="file"
          multiple
          className="hidden"
          accept="image/*,video/*,audio/*,.webp,.safetensors"
          onChange={(event) => {
            if (event.currentTarget.files) {
              void uploadFiles(event.currentTarget.files);
              event.currentTarget.value = "";
            }
          }}
        />
      </PageHeader>

      {/* 文件夹 */}
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {folders.map((f) => {
          const Icon =
            FOLDER_ICONS[f.kind as keyof typeof FOLDER_ICONS] ?? Folder;
          return (
            <button
              key={f.id}
              onClick={() => setSelectedFolder(f.id)}
              className={cn(
                "flex items-center gap-3 rounded-xl border p-4 text-left transition-colors",
                selectedFolder === f.id
                  ? "border-primary/50 bg-primary/10"
                  : "border-border/60 bg-card/40 hover:border-primary/30"
              )}
            >
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                <Icon className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{f.name}</p>
                <p className="text-xs text-muted-foreground">
                  {f.count} 个文件
                </p>
              </div>
            </button>
          );
        })}
      </div>
      {!loading && folders.length === 0 && (
        <div className="mt-4 rounded-xl border border-border/60 bg-card/30 px-4 py-8 text-center text-sm text-muted-foreground">
          还没有素材文件夹。上传素材时会自动创建文件夹，也可以先新建文件夹。
        </div>
      )}
      {!loading && error && (
        <div className="mt-4 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          素材资产加载失败，当前显示空素材库。
        </div>
      )}
      {loading && (
        <div className="mt-4 rounded-xl border border-border/60 bg-card/40 px-4 py-3 text-sm text-muted-foreground">
          正在加载素材资产…
        </div>
      )}

      {/* 上传区 */}
      <button
        onClick={() => uploadInputRef.current?.click()}
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          void uploadFiles(event.dataTransfer.files);
        }}
        className={cn(
          "mt-6 flex w-full flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border bg-background/40 py-10 transition-colors",
          dragging
            ? "border-primary bg-primary/10"
            : "hover:border-primary/50 hover:bg-primary/5"
        )}
      >
        <span className="grid h-12 w-12 place-items-center rounded-full bg-primary/10 text-primary">
          <Upload className="h-5 w-5" />
        </span>
        <p className="text-sm font-medium">拖拽文件到此处，或点击上传</p>
        <p className="text-xs text-muted-foreground">
          支持 JPG / PNG / WebP / MP4 / MP3 / WAV，单文件最大 {MAX_LOCAL_ASSET_MB}MB
        </p>
      </button>

      {/* 素材网格 */}
      <div className="mt-8">
        <div className="mb-4 flex items-center gap-2">
          <h2 className="text-sm font-semibold">全部素材</h2>
          <Badge variant="muted">{visibleMaterials.length}</Badge>
          {selectedFolder !== "all" && (
            <button
              onClick={() => setSelectedFolder("all")}
              className="ml-auto text-xs text-primary hover:underline"
            >
              查看全部
            </button>
          )}
        </div>
        {visibleMaterials.length === 0 ? (
          <div className="rounded-xl border border-border/60 bg-card/30 py-14 text-center text-sm text-muted-foreground">
            暂无素材
          </div>
        ) : (
          <div className={TILE_GRID}>
            {visibleMaterials.map((m) => (
              <div
                key={m.id}
                className="group overflow-hidden rounded-xl border border-border/60 bg-card/40"
              >
                <div className="relative">
                  <GradientThumb
                    seed={m.seed}
                    src={m.url}
                    alt={m.name}
                    mediaType={
                      m.kind === "audio" ? "audio" : m.kind === "video" ? "video" : "image"
                    }
                    className="aspect-square w-full"
                  >
                    {m.kind === "audio" && (
                      <span className="absolute inset-0 grid place-items-center text-white">
                        <span className="grid h-11 w-11 place-items-center rounded-full bg-black/35 backdrop-blur">
                          <Music2 className="h-5 w-5" />
                        </span>
                      </span>
                    )}
                  </GradientThumb>
                  <button
                    type="button"
                    onClick={() => void deleteMaterial(m)}
                    className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-lg bg-black/35 text-white opacity-0 backdrop-blur transition-opacity hover:bg-destructive group-hover:opacity-100"
                    title="删除素材"
                    aria-label="删除素材"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="flex items-center justify-between gap-2 px-2 py-1.5">
                  <p className="truncate text-xs text-muted-foreground">{m.name}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Dialog open={folderDialogOpen} onOpenChange={setFolderDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>新建文件夹</DialogTitle>
            <DialogDescription>
              文件夹会创建到 EntitleHub 素材库。
            </DialogDescription>
          </DialogHeader>
          <Input
            autoFocus
            value={folderName}
            onChange={(event) => setFolderName(event.currentTarget.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") void createFolder();
            }}
            placeholder="例如：品牌参考图"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setFolderDialogOpen(false)}>
              取消
            </Button>
            <Button variant="brand" onClick={() => void createFolder()} disabled={!folderName.trim()}>
              创建
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}
