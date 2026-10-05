import React from "react";
import { createRoot } from "react-dom/client";
import { HashRouter } from "react-router-dom";
import "antd/dist/reset.css";
import "streamdown/styles.css";
import "@/styles/globals.css";

import { AppProviders } from "@/components/layout/app-providers";
import "@/i18n";
import { EmbeddedCanvasRouter } from "@/yingzhi/embedded-router";

document.body.style.fontFamily = '"SF Pro Display","SF Pro Text","PingFang SC","Microsoft YaHei","Helvetica Neue",sans-serif';

createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
        <AppProviders>
            <HashRouter>
                <EmbeddedCanvasRouter />
            </HashRouter>
        </AppProviders>
    </React.StrictMode>,
);
