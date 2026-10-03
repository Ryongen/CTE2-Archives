/**
 * Cloudflare's Turnstile check for uploads. Renders nothing when no site key is configured
 * (local dev), and the API skips the check when it has no secret, so the two are switched on
 * together at deploy.
 *
 * A token is good for one verification, so the parent bumps `resetKey` after a failed upload to
 * get a fresh one.
 */

import { useEffect, useRef, type ReactNode } from "react";

import { TURNSTILE_SITE_KEY } from "../config.ts";

type TurnstileApi = {
  render(
    element: HTMLElement,
    options: {
      sitekey: string;
      callback: (token: string) => void;
      "expired-callback": () => void;
      "error-callback": () => void;
      theme?: "auto" | "light" | "dark";
    },
  ): string;
  reset(widgetId: string): void;
  remove(widgetId: string): void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const SCRIPT_URL = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

let loading: Promise<TurnstileApi> | undefined;

function loadTurnstile(): Promise<TurnstileApi> {
  loading ??= new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = SCRIPT_URL;
    script.async = true;
    script.onload = () => (window.turnstile ? resolve(window.turnstile) : reject(new Error("Turnstile did not load")));
    script.onerror = () => {
      loading = undefined;
      reject(new Error("Turnstile did not load"));
    };
    document.head.appendChild(script);
  });
  return loading;
}

export const turnstileEnabled = TURNSTILE_SITE_KEY !== undefined;

export function Turnstile({ onToken, resetKey }: { onToken: (token: string | null) => void; resetKey: number }): ReactNode {
  const box = useRef<HTMLDivElement>(null);
  const widget = useRef<{ api: TurnstileApi; id: string } | null>(null);
  // The latest callback, so the widget doesn't have to be re-rendered when the parent re-renders.
  const report = useRef(onToken);
  report.current = onToken;

  useEffect(() => {
    if (TURNSTILE_SITE_KEY === undefined) return;
    let cancelled = false;
    loadTurnstile()
      .then((api) => {
        if (cancelled || box.current === null) return;
        const id = api.render(box.current, {
          sitekey: TURNSTILE_SITE_KEY!,
          callback: (token) => report.current(token),
          "expired-callback": () => report.current(null),
          "error-callback": () => report.current(null),
          theme: "auto",
        });
        widget.current = { api, id };
      })
      .catch(() => report.current(null));
    return () => {
      cancelled = true;
      if (widget.current !== null) widget.current.api.remove(widget.current.id);
      widget.current = null;
    };
  }, []);

  useEffect(() => {
    if (resetKey === 0 || widget.current === null) return;
    report.current(null);
    widget.current.api.reset(widget.current.id);
  }, [resetKey]);

  if (TURNSTILE_SITE_KEY === undefined) return null;
  return <div ref={box} className="turnstile" />;
}
