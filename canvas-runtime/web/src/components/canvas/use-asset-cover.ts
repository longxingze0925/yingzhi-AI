import { useEffect, useState } from "react";

import { ensureImagePreview, previewUrlFor, resolveImageUrl } from "@/services/image-storage";
import { assetCoverUrl, type Asset } from "@/stores/use-asset-store";

function initialCoverUrl(asset: Asset) {
    if (asset.kind === "image" && asset.data.storageKey && (asset.data.storageKey.startsWith("server:") || asset.data.storageKey.startsWith("studio-job:"))) {
        return previewUrlFor(asset.data.storageKey) || "";
    }
    return assetCoverUrl(asset);
}

export function useAssetCoverUrl(asset: Asset) {
    const [resolvedUrl, setResolvedUrl] = useState(() => initialCoverUrl(asset));
    const isImage = asset.kind === "image";
    const storageKey = isImage ? asset.data.storageKey : undefined;
    const dataUrl = isImage ? asset.data.dataUrl : "";
    const fallbackUrl = assetCoverUrl(asset);

    useEffect(() => {
        let active = true;
        if (!storageKey) {
            setResolvedUrl(fallbackUrl);
            return () => {
                active = false;
            };
        }

        void resolveImageUrl(storageKey, dataUrl)
            .then((url) => {
                if (!active) return;
                setResolvedUrl(url);
                void ensureImagePreview(storageKey);
            })
            .catch(() => {
                if (active) setResolvedUrl("");
            });
        return () => {
            active = false;
        };
    }, [dataUrl, fallbackUrl, storageKey]);

    if (isImage && storageKey) return previewUrlFor(storageKey) || resolvedUrl;
    return fallbackUrl;
}
