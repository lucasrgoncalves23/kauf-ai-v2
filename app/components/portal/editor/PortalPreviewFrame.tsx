"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { PortalReport } from "../PortalReport";
import type { PortalPayload } from "../../../lib/portal/payload";

const SHELL =
  '<!doctype html><html lang="pt-BR"><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body><div id="root"></div></body></html>';
const COPIED = "data-kai-preview-style";
// Matches the sticky section nav (scroll-mt-16)
const NAV_OFFSET = 64;

/**
 * Phone-sized preview of the patient page. The report is rendered by this React tree into an
 * iframe document (for a real phone-width viewport and isolated styles) instead of loading
 * /portal as a second Next.js page: under `next dev` that second page's hot-reload client made
 * the whole dashboard reload, and it also avoids a postMessage round trip on every keystroke.
 */
export function PortalPreviewFrame({
  payload,
  onSectionClick,
  scrollRequest,
}: {
  payload: PortalPayload;
  onSectionClick?: (sectionId: string) => void;
  scrollRequest: { sectionId: string; nonce: number } | null;
}) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [mount, setMount] = useState<HTMLElement | null>(null);

  // Mirror the dashboard's stylesheets (Tailwind, fonts) into the frame; minus dark mode,
  // since the patient page is always light
  const syncStyles = useCallback(() => {
    const doc = iframeRef.current?.contentDocument;
    if (!doc) return;
    doc.head.querySelectorAll(`[${COPIED}]`).forEach((el) => el.remove());
    document.head.querySelectorAll('link[rel="stylesheet"], style').forEach((el) => {
      const clone = el.cloneNode(true) as HTMLElement;
      clone.setAttribute(COPIED, "");
      doc.head.appendChild(clone);
    });
    doc.documentElement.className = [...document.documentElement.classList].filter((c) => c !== "dark").join(" ");
    doc.body.className = "font-sans antialiased";
  }, []);

  const onLoad = () => {
    syncStyles();
    setMount(iframeRef.current?.contentDocument?.getElementById("root") ?? null);
  };

  // Dev injects/replaces <style> tags on hot reload; keep the frame in step
  useEffect(() => {
    if (!mount) return;
    const observer = new MutationObserver(syncStyles);
    observer.observe(document.head, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [mount, syncStyles]);

  // Scroll the frame only (scrollIntoView would also scroll the dashboard around it)
  useEffect(() => {
    if (!scrollRequest || !mount) return;
    const win = iframeRef.current?.contentWindow;
    const el = win?.document.getElementById(scrollRequest.sectionId);
    if (!win || !el) return;
    win.scrollTo({ top: el.getBoundingClientRect().top + win.scrollY - NAV_OFFSET, behavior: "smooth" });
  }, [scrollRequest, mount]);

  return (
    <>
      <iframe ref={iframeRef} srcDoc={SHELL} onLoad={onLoad} title="Prévia do portal do paciente" className="block h-full w-[374px] bg-white" />
      {mount &&
        createPortal(
          <div className="min-h-screen bg-slate-50 text-slate-900">
            <PortalReport payload={payload} preview onSectionClick={onSectionClick} />
          </div>,
          mount
        )}
    </>
  );
}
