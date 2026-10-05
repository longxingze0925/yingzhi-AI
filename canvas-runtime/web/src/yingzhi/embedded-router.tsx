import { Navigate, Route, Routes } from "react-router-dom";

import CanvasPage from "@/pages/canvas";
import CanvasProjectPage from "@/pages/canvas/project";
import { YingzhiCanvasBootstrap } from "@/yingzhi/yingzhi-canvas-bootstrap";

export function EmbeddedCanvasRouter() {
    return (
        <Routes>
            <Route path="/canvas" element={<YingzhiCanvasBootstrap><CanvasPage /></YingzhiCanvasBootstrap>} />
            <Route path="/canvas/:id" element={<YingzhiCanvasBootstrap><CanvasProjectPage /></YingzhiCanvasBootstrap>} />
            <Route path="*" element={<Navigate to="/canvas" replace />} />
        </Routes>
    );
}
