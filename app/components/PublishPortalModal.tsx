"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { AlertTriangle, Check, Copy, ExternalLink, Loader2, RefreshCw, Save, X } from "lucide-react";
import type { ClinicalOutputs, Consulta, ToastState } from "../types/clinical";
import { getPinHeaders } from "../lib/api-client";
import { isValidCpf } from "../lib/cpf";
import { checkClinicalRules } from "../lib/clinicalRules";
import type { PortalContent } from "../lib/portal/schema";
import type { PortalPayload } from "../lib/portal/payload";
import { portalUrl } from "../lib/portal/types";

type Step =
  | { kind: "checks"; error?: string }
  | { kind: "generating" }
  | { kind: "preview"; content: PortalContent; payload: PortalPayload; publishing: boolean; error?: string }
  | { kind: "published"; url: string; expiresAt: string };

type PublishPortalModalProps = {
  open: boolean;
  onClose: () => void;
  patientId: string;
  sex: string;
  cpf: string;
  outputs: ClinicalOutputs;
  latestConsulta: Consulta | null;
  onSaveConsulta: () => Promise<void> | void;
  isSavingConsulta: boolean;
  onPublished: () => void;
  setToast: (toast: ToastState) => void;
};

const same = (a: string | undefined, b: string | undefined) => (a || "").trim() === (b || "").trim();

export function QrImage({ url, size = 220 }: { url: string; size?: number }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(url, { width: size, margin: 1, color: { dark: "#0f172a", light: "#ffffff" } })
      .then((data) => {
        if (!cancelled) setSrc(data);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [url, size]);
  if (!src) return <div style={{ width: size, height: size }} className="rounded-xl bg-slate-100" />;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} width={size} height={size} alt="QR code do link do paciente" className="rounded-xl" />;
}

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export function PublishPortalModal({
  open,
  onClose,
  patientId,
  sex,
  cpf,
  outputs,
  latestConsulta,
  onSaveConsulta,
  isSavingConsulta,
  onPublished,
  setToast,
}: PublishPortalModalProps) {
  const [step, setStep] = useState<Step>({ kind: "checks" });
  const [confirmed, setConfirmed] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  const close = useCallback(() => {
    abortRef.current?.abort();
    setStep({ kind: "checks" });
    setConfirmed(false);
    onClose();
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        close();
      }
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [open, close]);

  // Feed the preview iframe once it says it is ready (and again on load, whichever comes first)
  const postPayload = useCallback(() => {
    if (step.kind !== "preview") return;
    iframeRef.current?.contentWindow?.postMessage({ type: "kai-portal-preview", payload: step.payload }, window.location.origin);
  }, [step]);

  useEffect(() => {
    if (step.kind !== "preview") return;
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== window.location.origin || e.source !== iframeRef.current?.contentWindow) return;
      if ((e.data as { type?: string } | null)?.type === "kai-portal-preview-ready") postPayload();
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [step, postPayload]);

  if (!open) return null;

  const hasOutputs = Boolean(outputs.analise?.trim() || outputs.conduta?.trim());
  const cpfOk = isValidCpf(cpf);
  const saved =
    !!latestConsulta &&
    same(latestConsulta.outputs?.analise, outputs.analise) &&
    same(latestConsulta.outputs?.conduta, outputs.conduta) &&
    same(latestConsulta.outputs?.receita, outputs.receita);
  const violations = [outputs.analise, outputs.conduta, outputs.receita].flatMap((t) => checkClinicalRules(t || "", sex));
  const rulesOk = violations.length === 0;
  const ready = hasOutputs && cpfOk && saved && rulesOk && confirmed && !!latestConsulta;

  const generate = async () => {
    if (!latestConsulta) return;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setStep({ kind: "generating" });
    try {
      const res = await fetch("/api/portal/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getPinHeaders() },
        body: JSON.stringify({ patientId, consultaId: latestConsulta.id }),
        signal: controller.signal,
      });
      const data = (await res.json().catch(() => ({}))) as { content?: PortalContent; payload?: PortalPayload; error?: string };
      if (!res.ok || !data.content || !data.payload) throw new Error(data.error || `Erro ${res.status}`);
      setStep({ kind: "preview", content: data.content, payload: data.payload, publishing: false });
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        setStep({ kind: "checks" });
      } else {
        setStep({ kind: "checks", error: err instanceof Error ? err.message : "Falha ao gerar a versão do paciente." });
      }
    }
  };

  const publish = async () => {
    if (step.kind !== "preview" || !latestConsulta) return;
    setStep({ ...step, publishing: true, error: undefined });
    try {
      const res = await fetch("/api/portal/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getPinHeaders() },
        body: JSON.stringify({ patientId, consultaId: latestConsulta.id, content: step.content, doctorConfirmed: true }),
      });
      const data = (await res.json().catch(() => ({}))) as { token?: string; expiresAt?: string; error?: string };
      if (!res.ok || !data.token) throw new Error(data.error || `Erro ${res.status}`);
      const url = portalUrl(data.token);
      const copied = await copyToClipboard(url);
      setToast({ message: copied ? "Link publicado e copiado" : "Link publicado", type: "success" });
      setStep({ kind: "published", url, expiresAt: data.expiresAt || "" });
      onPublished();
    } catch (err) {
      setStep({ ...step, publishing: false, error: err instanceof Error ? err.message : "Falha ao publicar." });
    }
  };

  const CheckRow = ({ ok, label, hint, action }: { ok: boolean; label: string; hint?: string; action?: React.ReactNode }) => (
    <li className="flex items-start gap-3 py-2.5">
      <span
        className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${
          ok ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300" : "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
        }`}
      >
        {ok ? <Check className="h-3 w-3" strokeWidth={3} /> : <AlertTriangle className="h-3 w-3" />}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm text-slate-800 dark:text-slate-200">{label}</p>
        {!ok && hint && <p className="text-xs text-slate-500 dark:text-slate-400">{hint}</p>}
      </div>
      {!ok && action}
    </li>
  );

  return (
    <div className="no-print fixed inset-0 z-[120] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-fade-in" onClick={close} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Publicar para o paciente"
        className="relative flex max-h-full w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl animate-scale-in dark:border-slate-700 dark:bg-slate-800"
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 dark:border-slate-700">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-widest text-slate-700 dark:text-slate-200">Portal do Paciente</h2>
            <p className="mt-0.5 text-xs text-slate-400 dark:text-slate-500">
              {step.kind === "checks" && "Antes de gerar a versão do paciente"}
              {step.kind === "generating" && "Gerando a versão do paciente"}
              {step.kind === "preview" && "Confira como o paciente vai ver"}
              {step.kind === "published" && "Link pronto para enviar"}
            </p>
          </div>
          <button onClick={close} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-700" title="Fechar (Esc)">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          {step.kind === "checks" && (
            <>
              {step.error && (
                <div className="mb-4 flex items-start gap-2 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{step.error}</span>
                </div>
              )}
              <ul className="divide-y divide-slate-100 dark:divide-slate-700">
                <CheckRow ok={hasOutputs} label="Análise ou conduta gerada" hint="Gere a análise e a conduta antes de publicar." />
                <CheckRow ok={cpfOk} label="CPF válido no cadastro do paciente" hint="O paciente usa o CPF para abrir o link. Corrija no painel Paciente." />
                <CheckRow
                  ok={saved}
                  label="Consulta salva com os textos atuais"
                  hint={latestConsulta ? "Os textos na tela são diferentes da última consulta salva." : "Nenhuma consulta salva para este paciente."}
                  action={
                    <button
                      onClick={() => onSaveConsulta()}
                      disabled={isSavingConsulta || !hasOutputs}
                      className="flex shrink-0 items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-700 disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900"
                    >
                      {isSavingConsulta ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                      Salvar agora
                    </button>
                  }
                />
                <CheckRow
                  ok={rulesOk}
                  label="Sem termos bloqueados pelas regras clínicas"
                  hint={violations.map((v) => `"${v.matchedTerm}" (regra ${v.rule.id})`).join(", ")}
                />
              </ul>

              <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 p-4 dark:border-slate-700">
                <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} className="mt-0.5 h-4 w-4 accent-brand-600" />
                <span className="text-sm leading-relaxed text-slate-700 dark:text-slate-300">
                  O paciente pediu acesso digital ao plano e sabe que receberá um link pessoal, protegido pelo CPF, válido por 90 dias.
                </span>
              </label>

              <p className="mt-4 text-xs leading-relaxed text-slate-400 dark:text-slate-500">
                A versão do paciente é escrita em linguagem simples a partir da análise, da conduta e da receita. Doses, dieta e treino são copiados
                exatamente; nada é publicado até você confirmar na prévia.
              </p>
            </>
          )}

          {step.kind === "generating" && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Loader2 className="h-8 w-8 animate-spin text-brand-600" />
              <p className="mt-4 text-sm font-medium text-slate-700 dark:text-slate-200">Traduzindo a consulta para a linguagem do paciente…</p>
              <p className="mt-1 text-xs text-slate-400">Isso leva cerca de 1 minuto.</p>
            </div>
          )}

          {step.kind === "preview" && (
            <div className="grid gap-6 md:grid-cols-[390px_1fr]">
              <div className="mx-auto overflow-hidden rounded-[2rem] border-8 border-slate-900 bg-slate-900 shadow-xl">
                <iframe
                  ref={iframeRef}
                  src="/portal?preview=1"
                  title="Prévia do portal do paciente"
                  onLoad={postPayload}
                  className="block h-[640px] w-[374px] bg-white"
                />
              </div>
              <div className="space-y-4 text-sm text-slate-600 dark:text-slate-300">
                <p>
                  É assim que <span className="font-semibold text-slate-900 dark:text-white">{step.payload.patientFirstName}</span> vai ver o plano
                  no celular. Role a prévia e confira doses, orientações e tom.
                </p>
                <ul className="list-disc space-y-1 pl-5 text-xs text-slate-500 dark:text-slate-400">
                  <li>Medicamentos, dieta e treino vêm da receita e da conduta sem alteração.</li>
                  <li>Os textos explicativos foram escritos pela IA e passaram pelas regras clínicas.</li>
                  <li>Se algo não estiver bom, gere novamente. Nada foi publicado ainda.</li>
                </ul>
                {step.error && (
                  <div className="flex items-start gap-2 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>{step.error}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {step.kind === "published" && (
            <div className="flex flex-col items-center gap-5 py-4 text-center md:flex-row md:text-left">
              <QrImage url={step.url} />
              <div className="min-w-0 flex-1 space-y-3">
                <p className="text-sm text-slate-700 dark:text-slate-200">
                  Envie este link ao paciente ou mostre o QR code para ele escanear. Para abrir, ele confirma o CPF.
                </p>
                <code className="block break-all rounded-xl bg-slate-100 px-3 py-2 text-xs text-slate-700 dark:bg-slate-900 dark:text-slate-300">{step.url}</code>
                <p className="text-xs text-slate-400">
                  Válido até {step.expiresAt ? new Date(step.expiresAt).toLocaleDateString("pt-BR") : "90 dias"}. Você pode revogar ou gerar um
                  novo link a qualquer momento no painel.
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={async () => setToast({ message: (await copyToClipboard(step.url)) ? "Link copiado" : "Não foi possível copiar", type: "info" })}
                    className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-2 text-xs font-semibold text-white hover:bg-brand-700"
                  >
                    <Copy className="h-3.5 w-3.5" /> Copiar link
                  </button>
                  <button
                    onClick={() => window.open(step.url, "_blank", "noopener")}
                    className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700"
                  >
                    <ExternalLink className="h-3.5 w-3.5" /> Abrir
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-6 py-4 dark:border-slate-700">
          {step.kind === "checks" && (
            <>
              <button onClick={close} className="rounded-lg px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700">
                Cancelar
              </button>
              <button
                onClick={generate}
                disabled={!ready}
                className="rounded-lg bg-brand-600 px-4 py-2 text-xs font-semibold text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-slate-300 dark:disabled:bg-slate-600"
              >
                Gerar versão do paciente
              </button>
            </>
          )}
          {step.kind === "generating" && (
            <button onClick={() => abortRef.current?.abort()} className="rounded-lg px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700">
              Cancelar
            </button>
          )}
          {step.kind === "preview" && (
            <>
              <button
                onClick={generate}
                disabled={step.publishing}
                className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-50 dark:text-slate-300 dark:hover:bg-slate-700"
              >
                <RefreshCw className="h-3.5 w-3.5" /> Gerar novamente
              </button>
              <button
                onClick={publish}
                disabled={step.publishing}
                className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2 text-xs font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
              >
                {step.publishing && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Publicar e gerar link
              </button>
            </>
          )}
          {step.kind === "published" && (
            <button onClick={close} className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-900">
              Concluir
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
