"use client";

import { useEffect } from "react";

/**
 * While `busy` is true, makes the browser ask before the tab is closed, reloaded or
 * navigated away — so an in-flight generation or import can't be silently cut off.
 * Safari, Chrome and Firefox all show their own confirmation dialog for this.
 */
export function useUnloadGuard(busy: boolean): void {
  useEffect(() => {
    if (!busy) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      // Legacy browsers need a non-empty returnValue to show the prompt
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [busy]);
}
