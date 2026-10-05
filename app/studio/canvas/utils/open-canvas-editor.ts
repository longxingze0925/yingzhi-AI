import { flushCanvasStore } from "../stores/use-canvas-store";

export async function openCanvasEditorInNewTab(projectId: string) {
    if (typeof window === "undefined") return;

    const editorWindow = window.open("about:blank", "_blank");
    if (!editorWindow) return;

    editorWindow.opener = null;
    try {
        await flushCanvasStore(projectId);
        if (!editorWindow.closed) {
            editorWindow.location.replace(
                `/canvas/${encodeURIComponent(projectId)}`,
            );
        }
    } catch (error) {
        if (!editorWindow.closed) editorWindow.close();
        throw error;
    }
}
