"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CpfGate } from "../components/portal/CpfGate";
import { PortalReport } from "../components/portal/PortalReport";
import type { PortalPayload } from "../lib/portal/payload";

type Phase =
  | { kind: "booting" }
  | { kind: "no_token" }
  | { kind: "gate"; error: string | null; loading: boolean }
  | { kind: "blocked"; message: string }
  | { kind: "report"; payload: PortalPayload; preview: boolean };

const HIDDEN_RELOCK_MS = 10 * 60 * 1000;
const PREVIEW_MESSAGE = "kai-portal-preview";

export default function PortalPage() {
  const [phase, setPhase] = useState<Phase>({ kind: "booting" });
  const tokenRef = useRef<string | null>(null);
  const hiddenTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const relock = useCallback(() => {
    setPhase((p) => (p.kind === "report" && !p.preview ? { kind: "gate", error: null, loading: false } : p));
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const isPreview = params.get("preview") === "1" && window.parent !== window;

    if (isPreview) {
      const onMessage = (event: MessageEvent) => {
        if (event.origin !== window.location.origin || event.source !== window.parent) return;
        const data = event.data as { type?: string; payload?: PortalPayload } | null;
        if (data?.type === PREVIEW_MESSAGE && data.payload) {
          setPhase({ kind: "report", payload: data.payload, preview: true });
        }
      };
      window.addEventListener("message", onMessage);
      window.parent.postMessage({ type: `${PREVIEW_MESSAGE}-ready` }, window.location.origin);
      return () => window.removeEventListener("message", onMessage);
    }

    const token = window.location.hash.slice(1);
    tokenRef.current = token || null;
    // The token only exists in the browser (URL fragment), so it can't be read before mount
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPhase(token ? { kind: "gate", error: null, loading: false } : { kind: "no_token" });

    const onPageShow = (e: PageTransitionEvent) => {
      if (e.persisted) relock();
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        hiddenTimer.current = setTimeout(relock, HIDDEN_RELOCK_MS);
      } else if (hiddenTimer.current) {
        clearTimeout(hiddenTimer.current);
        hiddenTimer.current = null;
      }
    };
    window.addEventListener("pageshow", onPageShow);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("pageshow", onPageShow);
      document.removeEventListener("visibilitychange", onVisibility);
      if (hiddenTimer.current) clearTimeout(hiddenTimer.current);
    };
  }, [relock]);

  const submit = async (cpf: string) => {
    const token = tokenRef.current;
    if (!token) return;
    setPhase({ kind: "gate", error: null, loading: true });
    try {
      const res = await fetch("/api/portal/open", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({ token, cpf }),
      });
      const data = (await res.json().catch(() => ({}))) as { payload?: PortalPayload; error?: string; blocked?: boolean };
      if (res.ok && data.payload) {
        setPhase({ kind: "report", payload: data.payload, preview: false });
      } else if (data.blocked) {
        setPhase({ kind: "blocked", message: data.error || "Este link não está mais disponível." });
      } else {
        setPhase({ kind: "gate", error: data.error || "Não foi possível acessar. Tente novamente.", loading: false });
      }
    } catch {
      setPhase({ kind: "gate", error: "Sem conexão. Verifique a internet e tente novamente.", loading: false });
    }
  };

  if (phase.kind === "booting") return null;

  if (phase.kind === "no_token" || phase.kind === "blocked") {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-6 py-10 text-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/ik-logo.png" alt="Instituto Kaufmann" className="mx-auto mb-8 h-10 w-auto" />
        <h1 className="text-xl font-semibold">Link indisponível</h1>
        <p className="mt-3 text-sm leading-relaxed text-slate-500">
          {phase.kind === "blocked"
            ? phase.message
            : "Este endereço não contém um link de acesso válido. Abra o link exatamente como foi enviado pela clínica."}
        </p>
      </main>
    );
  }

  if (phase.kind === "gate") {
    return <CpfGate onSubmit={submit} loading={phase.loading} error={phase.error} />;
  }

  return <PortalReport payload={phase.payload} preview={phase.preview} onExit={phase.preview ? undefined : relock} />;
}
