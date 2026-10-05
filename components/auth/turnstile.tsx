"use client";

import * as React from "react";

declare global {
  interface Window {
    turnstile?: {
      render: (
        element: HTMLElement,
        options: Record<string, unknown>,
      ) => string;
      remove?: (widgetId: string) => void;
    };
  }
}

export function Turnstile(props: {
  siteKey: string;
  onVerify: (token: string) => void;
  onExpire?: () => void;
}) {
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const verifyRef = React.useRef(props.onVerify);
  const expireRef = React.useRef(props.onExpire);

  React.useEffect(() => {
    verifyRef.current = props.onVerify;
    expireRef.current = props.onExpire;
  }, [props.onExpire, props.onVerify]);

  React.useEffect(() => {
    let widgetId = "";
    let disposed = false;

    const render = () => {
      if (disposed || widgetId || !containerRef.current || !window.turnstile) {
        return;
      }
      widgetId = window.turnstile.render(containerRef.current, {
        sitekey: props.siteKey,
        callback: (token: string) => verifyRef.current(token),
        "error-callback": () => expireRef.current?.(),
        "expired-callback": () => expireRef.current?.(),
      });
    };

    if (window.turnstile) {
      render();
    } else {
      const scriptId = "shadowweave-turnstile";
      let script = document.getElementById(
        scriptId,
      ) as HTMLScriptElement | null;
      if (!script) {
        script = document.createElement("script");
        script.id = scriptId;
        script.src =
          "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
        script.async = true;
        script.defer = true;
        document.head.appendChild(script);
      }
      script.addEventListener("load", render, { once: true });
    }

    return () => {
      disposed = true;
      if (widgetId && window.turnstile?.remove) {
        window.turnstile.remove(widgetId);
      }
    };
  }, [props.siteKey]);

  return <div ref={containerRef} className="min-h-[65px]" />;
}
