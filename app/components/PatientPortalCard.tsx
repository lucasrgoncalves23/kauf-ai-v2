"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Ban, Copy, Globe, Loader2, Lock, QrCode, RefreshCw } from "lucide-react";
import type { ClinicalOutputs, Consulta, PatientProfile, ToastState } from "../types/clinical";
import { getPinHeaders } from "../lib/api-client";
import { portalUrl, type PublicationSummary } from "../lib/portal/types";
import { SectionLabel } from "./ui/SectionLabel";
import { ConfirmDialog } from "./ui/ConfirmDialog";
import { PublishPortalModal, QrImage, copyToClipboard } from "./PublishPortalModal";

type PatientPortalCardProps = {
  patientId: string | null;
  profile: PatientProfile;
  outputs: ClinicalOutputs;
  consultas: Consulta[];
  onSaveConsulta: () => Promise<void> | void;
  isSavingConsulta: boolean;
  setToast: (toast: ToastState) => void;
};

function fmtDate(iso: string | null | undefined, withTime = false): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return withTime
    ? d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })
    : d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" });
}

const btn =
  "flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-600 px-2 py-2 text-[11px] font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50 transition-colors whitespace-nowrap";

// The sidebar uses backdrop-blur, which turns it into the containing block for
// position:fixed descendants; overlays must escape to <body>.
function BodyPortal({ children }: { children: React.ReactNode }) {
  if (typeof document === "undefined") return null;
  return createPortal(children, document.body);
}

export function PatientPortalCard({ patientId, profile, outputs, consultas, onSaveConsulta, isSavingConsulta, setToast }: PatientPortalCardProps) {
  const [publications, setPublications] = useState<PublicationSummary[]>([]);
  const [configured, setConfigured] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmRevoke, setConfirmRevoke] = useState<PublicationSummary | null>(null);

  const refresh = useCallback(async (id: string, signal?: AbortSignal) => {
    try {
      const res = await fetch(`/api/portal/publications?patientId=${encodeURIComponent(id)}`, { headers: getPinHeaders(), signal, cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as { publications?: PublicationSummary[]; configured?: boolean };
      setPublications(data.publications || []);
      setConfigured(data.configured !== false);
    } catch {
      /* offline or aborted; the card just shows the publish button */
    }
  }, []);

  useEffect(() => {
    setPublications([]);
    setShowQr(false);
    if (!patientId) return;
    const controller = new AbortController();
    refresh(patientId, controller.signal);
    return () => controller.abort();
  }, [patientId, refresh]);

  if (!patientId) return null;

  const active = publications.find((p) => p.status === "active") ?? null;
  const last = publications[0] ?? null;
  const now = Date.now();
  const expired = active ? new Date(active.expiresAt).getTime() <= now : false;
  const tempLocked = active?.lockedUntil ? new Date(active.lockedUntil).getTime() > now : false;
  const url = active?.token ? portalUrl(active.token) : null;

  const act = async (label: string, run: () => Promise<Response>, success: (data: Record<string, unknown>) => Promise<void> | void) => {
    setBusy(label);
    try {
      const res = await run();
      const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      if (!res.ok) throw new Error((data.error as string) || `Erro ${res.status}`);
      await success(data);
      await refresh(patientId);
    } catch (err) {
      setToast({ message: err instanceof Error ? err.message : "Falha na operação", type: "error" });
    } finally {
      setBusy(null);
    }
  };

  const reissue = (p: PublicationSummary) =>
    act("reissue", () => fetch(`/api/portal/publications/${p.id}/reissue`, { method: "POST", headers: getPinHeaders() }), async (data) => {
      const token = data.token as string | undefined;
      if (token) {
        const copied = await copyToClipboard(portalUrl(token));
        setToast({ message: copied ? "Novo link gerado e copiado. O link anterior deixou de funcionar." : "Novo link gerado. O anterior deixou de funcionar.", type: "success" });
      }
    });

  const revoke = (p: PublicationSummary) =>
    act("revoke", () => fetch(`/api/portal/publications/${p.id}/revoke`, { method: "POST", headers: getPinHeaders() }), () => {
      setToast({ message: "Link revogado. O paciente não consegue mais abrir o plano.", type: "success" });
    });

  return (
    <div className="mt-4 compact:mt-2">
      <SectionLabel>Portal do Paciente</SectionLabel>
      <div className="rounded-xl bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] p-4 compact:p-3 space-y-3">
        {!configured && (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-[10px] text-amber-700 dark:bg-amber-950/30 dark:text-amber-300">
            Portal não configurado no servidor (PORTAL_SECRET). Publicação indisponível.
          </p>
        )}

        {active ? (
          <>
            <div className="flex items-start gap-3">
              <Globe className={`mt-0.5 h-4 w-4 shrink-0 ${expired ? "text-slate-400" : "text-emerald-600 dark:text-emerald-400"}`} />
              <div className="min-w-0 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
                <p className="text-sm font-semibold text-slate-900 dark:text-white">{expired ? "Link expirado" : "Link ativo"}</p>
                <p>
                  Publicado em {fmtDate(active.createdAt)} · válido até {fmtDate(active.expiresAt)}
                </p>
                <p>
                  {active.openCount > 0
                    ? `Aberto ${active.openCount}× · último acesso ${fmtDate(active.lastOpenedAt, true)}`
                    : "Ainda não foi aberto pelo paciente"}
                </p>
                {tempLocked && (
                  <p className="mt-1 flex items-center gap-1 text-amber-600 dark:text-amber-400">
                    <Lock className="h-3 w-3" /> Bloqueado até {fmtDate(active.lockedUntil, true)} ({active.failedAttempts} tentativas de CPF erradas)
                  </p>
                )}
              </div>
            </div>

            {showQr && url && (
              <div className="flex justify-center rounded-lg bg-slate-50 p-3 dark:bg-slate-900">
                <QrImage url={url} size={180} />
              </div>
            )}

            <div className="grid grid-cols-2 gap-2">
              <button
                className={btn}
                disabled={!url}
                onClick={async () => url && setToast({ message: (await copyToClipboard(url)) ? "Link copiado" : "Não foi possível copiar", type: "info" })}
              >
                <Copy className="h-3.5 w-3.5" /> Copiar
              </button>
              <button className={btn} disabled={!url} onClick={() => setShowQr((v) => !v)}>
                <QrCode className="h-3.5 w-3.5" /> {showQr ? "Ocultar QR" : "QR code"}
              </button>
              <button className={btn} disabled={busy !== null} onClick={() => reissue(active)}>
                {busy === "reissue" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />} Novo link
              </button>
              <button className={`${btn} text-red-600 dark:text-red-400`} disabled={busy !== null} onClick={() => setConfirmRevoke(active)}>
                {busy === "revoke" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Ban className="h-3.5 w-3.5" />} Revogar
              </button>
            </div>
            <button
              onClick={() => setModalOpen(true)}
              disabled={!configured}
              className="w-full rounded-lg bg-slate-900 px-3 py-2 text-[11px] font-semibold text-white hover:bg-slate-700 disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900"
            >
              Publicar nova versão
            </button>
          </>
        ) : (
          <>
            {last && last.status !== "active" && (
              <div className="flex items-start gap-3 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
                {last.status === "locked" ? <Lock className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" /> : <Globe className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />}
                <p>
                  {last.status === "locked" && "Último link bloqueado por tentativas erradas de CPF. Publique novamente para gerar um novo."}
                  {last.status === "revoked" && `Último link revogado em ${fmtDate(last.createdAt)}.`}
                  {last.status === "superseded" && "Link anterior substituído."}
                </p>
              </div>
            )}
            <button
              onClick={() => setModalOpen(true)}
              disabled={!configured}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-brand-600 px-3 py-2.5 text-xs font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
            >
              <Globe className="h-4 w-4" /> Publicar para o paciente
            </button>
            <p className="text-[10px] leading-relaxed text-slate-400 dark:text-slate-500">
              Gera um link pessoal, protegido pelo CPF, com o plano em linguagem simples.
            </p>
          </>
        )}
      </div>

      <BodyPortal>
        <PublishPortalModal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          patientId={patientId}
          sex={profile.sex}
          cpf={profile.cpf}
          outputs={outputs}
          latestConsulta={consultas[0] ?? null}
          onSaveConsulta={onSaveConsulta}
          isSavingConsulta={isSavingConsulta}
          onPublished={() => refresh(patientId)}
          setToast={setToast}
        />
        <ConfirmDialog
          open={confirmRevoke !== null}
          title="Revogar o link do paciente?"
          message="O paciente deixa de conseguir abrir o plano imediatamente e o conteúdo publicado é apagado. Você pode publicar novamente depois."
          confirmLabel="Revogar"
          danger
          onConfirm={() => {
            if (confirmRevoke) revoke(confirmRevoke);
            setConfirmRevoke(null);
          }}
          onCancel={() => setConfirmRevoke(null)}
        />
      </BodyPortal>
    </div>
  );
}
