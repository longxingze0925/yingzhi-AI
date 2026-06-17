"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { AssetFolder, AssetItem, MediaItem } from "@/lib/api/types";

export interface WorkspaceNotification {
  id: string;
  title: string;
  body: string;
  createdAt: number;
  read: boolean;
}

interface LocalWorkspaceState {
  favoriteItems: Record<string, MediaItem>;
  unfavoritedWorkIds: string[];
  deletedWorkIds: string[];
  downloadedWorkIds: string[];
  sharedWorkIds: string[];
  localFolders: AssetFolder[];
  localMaterials: AssetItem[];
  notifications: WorkspaceNotification[];
  preferences: Record<string, boolean>;
  isFavorite: (item: MediaItem) => boolean;
  toggleFavorite: (item: MediaItem) => boolean;
  setFavorite: (item: MediaItem, favorite: boolean) => void;
  deleteWork: (id: string) => void;
  restoreWork: (id: string) => void;
  markDownloaded: (id: string) => void;
  markShared: (id: string) => void;
  addLocalFolder: (name: string, kind?: string) => AssetFolder;
  addLocalMaterials: (files: File[], folderId: string) => AssetItem[];
  deleteLocalMaterial: (id: string) => void;
  setPreference: (key: string, value: boolean) => void;
  addNotification: (title: string, body: string) => void;
  markNotificationsRead: () => void;
  clearNotifications: () => void;
}

function uid(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function fileKind(file: File): AssetItem["kind"] {
  if (file.type.startsWith("audio/")) return "audio";
  if (file.type.startsWith("video/")) return "video";
  if (file.name.toLowerCase().endsWith(".safetensors")) return "style";
  return "image";
}

function initialNotifications(): WorkspaceNotification[] {
  const now = Date.now();
  return [
    {
      id: "welcome",
      title: "本地工作区已就绪",
      body: "页面通知和偏好设置会保存在当前浏览器；作品与素材以 EntitleHub 为准。",
      createdAt: now - 1000 * 60 * 8,
      read: false,
    },
  ];
}

function isItemFavorited(state: LocalWorkspaceState, item: MediaItem) {
  if (state.favoriteItems[item.id]) return true;
  if (state.unfavoritedWorkIds.includes(item.id)) return false;
  return Boolean(item.favoritedAt);
}

export const useLocalWorkspaceStore = create<LocalWorkspaceState>()(
  persist(
    (set, get) => ({
      favoriteItems: {},
      unfavoritedWorkIds: [],
      deletedWorkIds: [],
      downloadedWorkIds: [],
      sharedWorkIds: [],
      localFolders: [],
      localMaterials: [],
      notifications: initialNotifications(),
      preferences: {
        "作品默认公开到灵感广场": false,
        "生成完成邮件通知": true,
        "新模型与活动推送": true,
      },

      isFavorite: (item) => isItemFavorited(get(), item),

      toggleFavorite: (item) => {
        const exists = isItemFavorited(get(), item);
        set((state) => {
          const favoriteItems = { ...state.favoriteItems };
          const unfavoritedWorkIds = state.unfavoritedWorkIds.filter(
            (id) => id !== item.id
          );
          if (exists) {
            delete favoriteItems[item.id];
            unfavoritedWorkIds.push(item.id);
          } else {
            favoriteItems[item.id] = {
              ...item,
              favoritedAt: item.favoritedAt ?? Date.now(),
            };
          }
          return { favoriteItems, unfavoritedWorkIds };
        });
        return !exists;
      },

      setFavorite: (item, favorite) =>
        set((state) => {
          const favoriteItems = { ...state.favoriteItems };
          let unfavoritedWorkIds = state.unfavoritedWorkIds.filter(
            (id) => id !== item.id
          );
          if (favorite) {
            favoriteItems[item.id] = {
              ...item,
              favoritedAt: item.favoritedAt ?? Date.now(),
            };
          } else {
            delete favoriteItems[item.id];
            unfavoritedWorkIds = [...unfavoritedWorkIds, item.id];
          }
          return { favoriteItems, unfavoritedWorkIds };
        }),

      deleteWork: (id) =>
        set((state) => {
          const favoriteItems = { ...state.favoriteItems };
          delete favoriteItems[id];
          return {
            favoriteItems,
            deletedWorkIds: state.deletedWorkIds.includes(id)
              ? state.deletedWorkIds
              : [...state.deletedWorkIds, id],
          };
        }),

      restoreWork: (id) =>
        set((state) => ({
          deletedWorkIds: state.deletedWorkIds.filter((workId) => workId !== id),
        })),

      markDownloaded: (id) =>
        set((state) => ({
          downloadedWorkIds: state.downloadedWorkIds.includes(id)
            ? state.downloadedWorkIds
            : [...state.downloadedWorkIds, id],
        })),

      markShared: (id) =>
        set((state) => ({
          sharedWorkIds: state.sharedWorkIds.includes(id)
            ? state.sharedWorkIds
            : [...state.sharedWorkIds, id],
        })),

      addLocalFolder: (name, kind = "folder") => {
        const folder: AssetFolder = {
          id: uid("folder"),
          name,
          kind,
          count: 0,
        };
        set((state) => ({ localFolders: [folder, ...state.localFolders] }));
        return folder;
      },

      addLocalMaterials: (files, folderId) => {
        const items = files.map((file) => ({
          id: uid("asset"),
          seed: `${file.name}-${file.size}-${file.lastModified}`,
          name: file.name,
          folderId,
          kind: fileKind(file),
        }));
        set((state) => ({
          localMaterials: [...items, ...state.localMaterials],
          localFolders: state.localFolders.map((folder) =>
            folder.id === folderId
              ? { ...folder, count: folder.count + items.length }
              : folder
          ),
        }));
        return items;
      },

      deleteLocalMaterial: (id) =>
        set((state) => {
          const item = state.localMaterials.find((material) => material.id === id);
          return {
            localMaterials: state.localMaterials.filter(
              (material) => material.id !== id
            ),
            localFolders: item
              ? state.localFolders.map((folder) =>
                  folder.id === item.folderId
                    ? { ...folder, count: Math.max(0, folder.count - 1) }
                    : folder
                )
              : state.localFolders,
          };
        }),

      setPreference: (key, value) =>
        set((state) => ({
          preferences: { ...state.preferences, [key]: value },
        })),

      addNotification: (title, body) =>
        set((state) => ({
          notifications: [
            {
              id: uid("notice"),
              title,
              body,
              createdAt: Date.now(),
              read: false,
            },
            ...state.notifications,
          ].slice(0, 20),
        })),

      markNotificationsRead: () =>
        set((state) => ({
          notifications: state.notifications.map((notice) => ({
            ...notice,
            read: true,
          })),
        })),

      clearNotifications: () => set({ notifications: [] }),
    }),
    {
      name: "shadowweave-local-workspace",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        notifications: state.notifications,
        preferences: state.preferences,
      }),
      merge: (persistedState, currentState) => {
        const persisted = persistedState as Partial<LocalWorkspaceState> | null;
        return {
          ...currentState,
          notifications: Array.isArray(persisted?.notifications)
            ? persisted.notifications
            : currentState.notifications,
          preferences:
            persisted?.preferences && typeof persisted.preferences === "object"
              ? persisted.preferences
              : currentState.preferences,
        };
      },
    }
  )
);
