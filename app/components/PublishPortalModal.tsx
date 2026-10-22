"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import QRCode from "qrcode";
import { AlertTriangle, ArrowLeft, Check, Copy, ExternalLink, History, Loader2, PenLine, Save, Undo2, X } from "lucide-react";
import type { ClinicalOutputs, Consulta, ToastState } from "../types/clinical";
import { getPinHeaders } from "../lib/api-client";
import { isValidCpf } from "../lib/cpf";
import { checkClinicalRules } from "../lib/clinicalRules";
import { CONTENT_KEY_LABELS, flattenContentText, normalizePortalContent, parsePortalContent, type ContentKey, type PortalContent } from "../lib/portal/schema";
import { applyContent, type PortalPayload } from "../lib/portal/payload";
import { unverifiedDoseMentions } from "../lib/portal/validate";
import { portalUrl } from "../lib/portal/types";
import { EDITOR_SECTIONS, PortalContentEditor, editorSectionForPreview, useTextCheck, type EditorSectionId } from "./portal/editor/PortalContentEditor";
import { PortalCopilot } from "./portal/editor/PortalCopilot";
import { PortalPreviewFrame } from "./portal/editor/PortalPreviewFrame";
import { SignaturePad, loadSavedSignature, saveSignature } from "./portal/editor/SignaturePad";
import { usePortalEditor } from "./portal/editor/usePortalEditor";

type Step =
  | { kind: "checks"; error?: string }
  | { kind: "generating"; resuming: boolean }
  | { kind: "edit" }
  | { kind: "sign"; publishing: boolean; error?: string }
  | { kind: "published"; url: string; expiresAt: string; code?: string };

type Draft = { base: PortalPayload; signingPinRequired: boolean };

type StoredDraft = { consultaId: string; content: PortalContent; savedAt: string };

const DRAFT_PREFIX = "kai-portal-draft:";

// Editing drafts live for the browser tab only (health data; nothing to clean up later)
function readDraft(patientId: string): StoredDraft | null {
  try {
    const raw = sessionStorage.getItem(DRAFT_PREFIX + patientId);
    return raw ? (JSON.parse(raw) as StoredDraft) : null;
  } catch {
    return null;
  }
}

function writeDraft(patientId: string, draft: StoredDraft | null) {
  try {
    if (draft) sessionStorage.setItem(DRAFT_PREFIX + patientId, JSON.stringify(draft));
    else sessionStorage.removeItem(DRAFT_PREFIX + patientId);
  } catch {
    /* storage blocked: the draft just won't survive closing the modal */
  }
}

const EMPTY_CONTENT: PortalContent = {
  resumo: { texto: "", prioridades: [] },
  modulos: [],
  medicamentos: [],
  exames: [],
  proximosPassos: { examesAntes: [], sinaisDeAlerta: [] },
};

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
  const [draft, setDraft] = useState<Draft | null>(null);
  const editor = usePortalEditor(EMPTY_CONTENT);
  const [copilotBusy, setCopilotBusy] = useState(false);
  const [copilotScope, setCopilotScope] = useState<EditorSectionId | null>(null);
  const [copilotFocus, setCopilotFocus] = useState(0);
  const [editorFocus, setEditorFocus] = useState<{ section: EditorSectionId; nonce: number } | null>(null);
  const [signatureImage, setSignatureImage] = useState<string | null>(null);
  const [rememberSignature, setRememberSignature] = useState(true);
  const [reviewed, setReviewed] = useState(false);
  const [signingPin, setSigningPin] = useState("");
  const [previewScroll, setPreviewScroll] = useState<{ sectionId: string; nonce: number } | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const editing = step.kind === "edit" || step.kind === "sign";

  const close = useCallback(() => {
    abortRef.current?.abort();
    setStep({ kind: "checks" });
    setConfirmed(false);
    setReviewed(false);
    setSigningPin("");
    setCopilotScope(null);
    onClose();
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      // Esc inside a field shouldn't throw away the editing session
      const target = e.target as HTMLElement | null;
      if (editing && target?.closest("input, textarea, [contenteditable]")) return;
      e.stopPropagation();
      close();
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [open, close, editing]);

  // ---------- Live preview ----------

  // Same normalization the server applies, so the phone shows exactly what would be published
  const previewContent = useMemo(() => normalizePortalContent(editor.content) as PortalContent, [editor.content]);
  const livePayload = useMemo<PortalPayload | null>(() => {
    if (!draft) return null;
    const payload = applyContent(draft.base, previewContent);
    if (step.kind !== "sign" || !signatureImage) return payload;
    return {
      ...payload,
      signature: {
        signer: payload.clinic.doctor,
        crm: payload.clinic.crm,
        signedAt: new Date().toISOString(),
        hash: "",
        code: "gerado ao publicar",
        image: signatureImage,
      },
    };
  }, [draft, previewContent, step.kind, signatureImage]);

  const scrollPreviewTo = useCallback((sectionId: string) => setPreviewScroll({ sectionId, nonce: Date.now() }), []);

  const onPreviewSectionClick = useCallback(
    (sectionId: string) => {
      if (step.kind !== "edit") return;
      const section = editorSectionForPreview(sectionId);
      if (section) setEditorFocus({ section, nonce: Date.now() });
    },
    [step.kind]
  );

  // ---------- Draft persistence ----------

  useEffect(() => {
    if (!open || !editing || !latestConsulta) return;
    const t = setTimeout(
      () => writeDraft(patientId, { consultaId: latestConsulta.id, content: editor.content, savedAt: new Date().toISOString() }),
      400
    );
    return () => clearTimeout(t);
  }, [open, editing, latestConsulta, patientId, editor.content]);

  // Read on open / when returning to the checks step
  const storedDraft = useMemo(() => (open && step.kind === "checks" ? readDraft(patientId) : null), [open, step.kind, patientId]);

  // ---------- Checks on the edited content ----------

  const sourceText = `${outputs.receita || ""}\n${outputs.conduta || ""}`;
  const check = useTextCheck(sex, sourceText);
  const contentProblems = useMemo(() => {
    if (!editing) return [];
    const problems: string[] = [];
    const parsed = parsePortalContent(editor.content);
    if (!parsed.success) {
      const keys = new Set(parsed.error.issues.map((i) => String(i.path[0])));
      for (const k of keys) problems.push(`${CONTENT_KEY_LABELS[k as ContentKey] ?? k}: campo obrigatório vazio ou curto demais.`);
    }
    const flat = flattenContentText(previewContent);
    const rules = checkClinicalRules(flat, sex);
    if (rules.length) problems.push(`Termos bloqueados pelas regras clínicas: ${[...new Set(rules.map((r) => `"${r.matchedTerm}"`))].join(", ")}.`);
    const doses = unverifiedDoseMentions(flat, sourceText);
    if (doses.length) problems.push(`Doses que não estão na receita/conduta: ${doses.join(", ")}.`);
    return problems;
  }, [editing, editor.content, previewContent, sex, sourceText]);

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
  const hasReceita = Boolean(outputs.receita?.trim());
  const ready = hasOutputs && hasReceita && cpfOk && saved && rulesOk && confirmed && !!latestConsulta;

  // ---------- Actions ----------

  const loadDraft = async (resume: StoredDraft | null) => {
    if (!latestConsulta) return;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setStep({ kind: "generating", resuming: Boolean(resume) });
    try {
      const res = await fetch(resume ? "/api/portal/assemble" : "/api/portal/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getPinHeaders() },
        body: JSON.stringify({ patientId, consultaId: latestConsulta.id, ...(resume ? { content: resume.content } : {}) }),
        signal: controller.signal,
      });
      const data = (await res.json().catch(() => ({}))) as {
        content?: PortalContent;
        payload?: PortalPayload;
        signingPinRequired?: boolean;
        error?: string;
      };
      if (!res.ok || !data.content || !data.payload) throw new Error(data.error || `Erro ${res.status}`);
      setDraft({ base: data.payload, signingPinRequired: Boolean(data.signingPinRequired) });
      editor.reset(data.content);
      setCopilotScope(null);
      setStep({ kind: "edit" });
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        setStep({ kind: "checks" });
      } else {
        setStep({ kind: "checks", error: err instanceof Error ? err.message : "Falha ao gerar a versão do paciente." });
      }
    }
  };

  const editReceita = () => {
    setToast({ message: "Rascunho guardado. Edite a receita, salve a consulta e abra o portal de novo para retomar.", type: "info" });
    close();
  };

  const askAi = (section: EditorSectionId) => {
    setCopilotScope(section);
    setCopilotFocus(Date.now());
  };

  const goToSign = () => {
    setSignatureImage(loadSavedSignature());
    setReviewed(false);
    setStep({ kind: "sign", publishing: false });
    // Show where the signature lands on the patient's page
    setTimeout(() => scrollPreviewTo("assinatura"), 250);
  };

  const publish = async () => {
    if (step.kind !== "sign" || !latestConsulta || !signatureImage) return;
    setStep({ kind: "sign", publishing: true });
    try {
      const res = await fetch("/api/portal/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getPinHeaders() },
        body: JSON.stringify({
          patientId,
          consultaId: latestConsulta.id,
          content: editor.content,
          doctorConfirmed: true,
          signature: { image: signatureImage, reviewed: true, pin: signingPin || undefined },
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { token?: string; expiresAt?: string; signatureCode?: string; error?: string };
      if (!res.ok || !data.token) throw new Error(data.error || `Erro ${res.status}`);
      saveSignature(rememberSignature ? signatureImage : null);
      writeDraft(patientId, null);
      setSigningPin("");
      const url = portalUrl(data.token);
      const copied = await copyToClipboard(url);
      setToast({ message: copied ? "Plano assinado, publicado e link copiado" : "Plano assinado e publicado", type: "success" });
      setStep({ kind: "published", url, expiresAt: data.expiresAt || "", code: data.signatureCode });
      onPublished();
    } catch (err) {
      setStep({ kind: "sign", publishing: false, error: err instanceof Error ? err.message : "Falha ao publicar." });
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

  const ErrorBox = ({ message }: { message: string }) => (
    <div className="flex items-start gap-2 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      <span>{message}</span>
    </div>
  );

  const signer = draft?.base.clinic;
  const canSign = Boolean(signatureImage) && reviewed && (!draft?.signingPinRequired || signingPin.trim().length > 0);

  return (
    <div className="no-print fixed inset-0 z-[120] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-fade-in" onClick={editing ? undefined : close} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Publicar para o paciente"
        className={`relative flex max-h-full w-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl animate-scale-in dark:border-slate-700 dark:bg-slate-800 ${
          editing ? "h-[94vh] max-w-6xl" : "max-w-3xl"
        }`}
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 dark:border-slate-700">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-widest text-slate-700 dark:text-slate-200">Portal do Paciente</h2>
            <p className="mt-0.5 text-xs text-slate-400 dark:text-slate-500">
              {step.kind === "checks" && "Antes de gerar a versão do paciente"}
              {step.kind === "generating" && (step.resuming ? "Retomando o rascunho" : "Gerando a versão do paciente")}
              {step.kind === "edit" && "Revise e edite. Clique numa parte da prévia para ir ao campo correspondente."}
              {step.kind === "sign" && "Assinatura eletrônica"}
              {step.kind === "published" && "Link pronto para enviar"}
            </p>
          </div>
          <button onClick={close} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-700" title="Fechar (Esc)">
            <X className="h-5 w-5" />
          </button>
        </div>

        {editing && draft ? (
          <div className="grid min-h-0 flex-1 md:grid-cols-[minmax(0,1fr)_420px]">
            {/* Left: editor + copilot, or the signing form */}
            <div className="flex min-h-0 flex-col border-slate-100 md:border-r dark:border-slate-700">
              {step.kind === "edit" ? (
                <>
                  {editor.aiChange && (
                    <div className="flex items-center gap-3 border-b border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
                      <span className="min-w-0 flex-1">
                        <span className="font-semibold">IA alterou {editor.aiChange.keys.map((k) => CONTENT_KEY_LABELS[k]).join(", ")}:</span> {editor.aiChange.summary}
                      </span>
                      <button onClick={editor.revertAi} className="shrink-0 rounded-md px-2 py-1 font-semibold hover:bg-amber-100 dark:hover:bg-amber-900/40">
                        Desfazer
                      </button>
                      <button onClick={editor.keepAi} className="shrink-0 rounded-md bg-amber-600 px-2 py-1 font-semibold text-white hover:bg-amber-700">
                        Manter
                      </button>
                    </div>
                  )}
                  <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
                    <PortalContentEditor
                      editor={editor}
                      base={draft.base}
                      check={check}
                      disabled={copilotBusy}
                      focus={editorFocus}
                      onAskAi={askAi}
                      onSectionOpened={(id) => {
                        const target = EDITOR_SECTIONS.find((s) => s.id === id)?.previewIds[0];
                        if (target) scrollPreviewTo(target);
                      }}
                      onEditReceita={editReceita}
                    />
                  </div>
                  {latestConsulta && (
                    <PortalCopilot
                      editor={editor}
                      patientId={patientId}
                      consultaId={latestConsulta.id}
                      scope={copilotScope}
                      onClearScope={() => setCopilotScope(null)}
                      busy={copilotBusy}
                      setBusy={setCopilotBusy}
                      focusNonce={copilotFocus}
                    />
                  )}
                </>
              ) : (
                <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-5">
                  <div>
                    <p className="text-sm text-slate-700 dark:text-slate-200">
                      Você assina como <span className="font-semibold">{signer?.doctor}</span> ({signer?.crm}).
                    </p>
                    <p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                      A assinatura fica vinculada a este conteúdo exato: a data, a hora e um código de verificação aparecem no fim do plano do paciente.
                      Qualquer alteração depois exige publicar e assinar de novo.
                    </p>
                  </div>

                  {/* Remount when entering the step so the saved signature is painted */}
                  <SignaturePad key={step.kind} value={signatureImage} onChange={setSignatureImage} />

                  <label className="flex cursor-pointer items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
                    <input type="checkbox" checked={rememberSignature} onChange={(e) => setRememberSignature(e.target.checked)} className="h-3.5 w-3.5 accent-brand-600" />
                    Lembrar esta assinatura neste computador
                  </label>

                  {draft.signingPinRequired && (
                    <label className="block">
                      <span className="mb-1 block text-xs font-semibold text-slate-500 dark:text-slate-400">Código pessoal de assinatura</span>
                      <input
                        type="password"
                        autoComplete="off"
                        value={signingPin}
                        onChange={(e) => setSigningPin(e.target.value)}
                        className="w-48 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100 dark:border-slate-600 dark:bg-slate-900"
                      />
                    </label>
                  )}

                  <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 p-4 dark:border-slate-700">
                    <input type="checkbox" checked={reviewed} onChange={(e) => setReviewed(e.target.checked)} className="mt-0.5 h-4 w-4 accent-brand-600" />
                    <span className="text-sm leading-relaxed text-slate-700 dark:text-slate-300">
                      Revisei todo o conteúdo que o paciente vai ver e assino eletronicamente como médico responsável.
                    </span>
                  </label>

                  {step.error && <ErrorBox message={step.error} />}
                </div>
              )}
            </div>

            {/* Right: phone preview, kept mounted across edit and sign */}
            <div className="hidden min-h-0 items-center justify-center bg-slate-100 p-4 md:flex dark:bg-slate-900/60">
              <div className="flex h-full max-h-[720px] overflow-hidden rounded-[2rem] border-8 border-slate-900 bg-slate-900 shadow-xl">
                {livePayload && <PortalPreviewFrame payload={livePayload} onSectionClick={onPreviewSectionClick} scrollRequest={previewScroll} />}
              </div>
            </div>
          </div>
        ) : (
          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
            {step.kind === "checks" && (
              <>
                {step.error && (
                  <div className="mb-4">
                    <ErrorBox message={step.error} />
                  </div>
                )}
                <ul className="divide-y divide-slate-100 dark:divide-slate-700">
                  <CheckRow ok={hasOutputs} label="Análise ou conduta gerada" hint="Gere a análise e a conduta antes de publicar." />
                  <CheckRow
                    ok={hasReceita}
                    label="Receita gerada"
                    hint="O que o paciente toma, com doses e horários, vem só da receita. Gere a receita antes de publicar."
                  />
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

                {storedDraft && (
                  <p className="mt-4 flex items-start gap-2 rounded-xl bg-brand-50 px-4 py-3 text-xs leading-relaxed text-brand-800 dark:bg-brand-950/30 dark:text-brand-200">
                    <History className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    Há um rascunho editado de {new Date(storedDraft.savedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}. Retome para manter
                    suas edições; a receita, a dieta e o treino são atualizados a partir da consulta salva.
                  </p>
                )}

                <p className="mt-4 text-xs leading-relaxed text-slate-400 dark:text-slate-500">
                  A versão do paciente é escrita em linguagem simples a partir da análise, da conduta e da receita. Você revisa, edita e assina antes de
                  publicar. Doses, dieta e treino são copiados exatamente da consulta.
                </p>
              </>
            )}

            {step.kind === "generating" && (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <Loader2 className="h-8 w-8 animate-spin text-brand-600" />
                <p className="mt-4 text-sm font-medium text-slate-700 dark:text-slate-200">
                  {step.resuming ? "Montando a prévia com as suas edições…" : "Traduzindo a consulta para a linguagem do paciente…"}
                </p>
                {!step.resuming && <p className="mt-1 text-xs text-slate-400">Isso leva de 1 a 2 minutos.</p>}
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
                  {step.code && (
                    <p className="flex items-center gap-1.5 text-xs text-emerald-700 dark:text-emerald-400">
                      <PenLine className="h-3.5 w-3.5" /> Assinado eletronicamente · código <span className="font-mono font-semibold">{step.code}</span>
                    </p>
                  )}
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
        )}

        <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-6 py-4 dark:border-slate-700">
          {step.kind === "checks" && (
            <>
              <button onClick={close} className="rounded-lg px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700">
                Cancelar
              </button>
              {storedDraft && (
                <button
                  onClick={() => loadDraft(storedDraft)}
                  disabled={!ready}
                  className="flex items-center gap-1.5 rounded-lg border border-brand-200 px-4 py-2 text-xs font-semibold text-brand-700 hover:bg-brand-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-brand-800 dark:text-brand-300 dark:hover:bg-brand-950/30"
                >
                  <History className="h-3.5 w-3.5" /> Retomar rascunho
                </button>
              )}
              <button
                onClick={() => (storedDraft && !window.confirm("Gerar uma nova versão descarta o rascunho editado. Continuar?") ? undefined : loadDraft(null))}
                disabled={!ready}
                className="rounded-lg bg-brand-600 px-4 py-2 text-xs font-semibold text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-slate-300 dark:disabled:bg-slate-600"
              >
                {storedDraft ? "Gerar nova versão" : "Gerar versão do paciente"}
              </button>
            </>
          )}
          {step.kind === "generating" && (
            <button onClick={() => abortRef.current?.abort()} className="rounded-lg px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700">
              Cancelar
            </button>
          )}
          {step.kind === "edit" && (
            <>
              <button
                onClick={editor.undo}
                disabled={!editor.canUndo || copilotBusy}
                title="Desfazer a última alteração"
                className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-40 dark:text-slate-300 dark:hover:bg-slate-700"
              >
                <Undo2 className="h-3.5 w-3.5" /> Desfazer
              </button>
              <div className="min-w-0 flex-1 px-2 text-right">
                {contentProblems.length > 0 && (
                  <p className="truncate text-xs text-amber-700 dark:text-amber-400" title={contentProblems.join("\n")}>
                    <AlertTriangle className="mr-1 inline h-3.5 w-3.5 align-[-3px]" />
                    {contentProblems[0]}
                    {contentProblems.length > 1 && ` (+${contentProblems.length - 1})`}
                  </p>
                )}
              </div>
              <button
                onClick={goToSign}
                disabled={contentProblems.length > 0 || copilotBusy}
                className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2 text-xs font-semibold text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-slate-300 dark:disabled:bg-slate-600"
              >
                <PenLine className="h-3.5 w-3.5" /> Continuar para assinatura
              </button>
            </>
          )}
          {step.kind === "sign" && (
            <>
              <button
                onClick={() => setStep({ kind: "edit" })}
                disabled={step.publishing}
                className="mr-auto flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-50 dark:text-slate-300 dark:hover:bg-slate-700"
              >
                <ArrowLeft className="h-3.5 w-3.5" /> Voltar para edição
              </button>
              <button
                onClick={publish}
                disabled={!canSign || step.publishing}
                className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2 text-xs font-semibold text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-slate-300 dark:disabled:bg-slate-600"
              >
                {step.publishing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <PenLine className="h-3.5 w-3.5" />}
                Assinar e publicar
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
