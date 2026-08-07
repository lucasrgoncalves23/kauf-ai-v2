"use client";

/**
 * WhatsApp Inbox — /inbox
 *
 * The clinic's patient-channel console after the Cloud API migration:
 * threads grouped by phone (patient-linked AND unlinked), full history,
 * and a reply composer. Inside the 24h window the doctor sends free-form
 * text; outside it, only approved templates (linked patients only).
 * Polling refresh, no websockets. PIN-authed like the rest of the app.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { PinLogin } from "../components/PinLogin";
import { getPinHeaders } from "../lib/api-client";
import { listTemplates } from "../lib/whatsappTemplates";
import { waErrorMessagePtBr } from "../lib/whatsappErrors";
import type { WaConversationSummary, WaMessageRecord } from "../lib/db";

interface ThreadData {
  messages: WaMessageRecord[];
  window: { open: boolean; expiresAt: string | null };
  patient: { id: string; name: string } | null;
  optIn: { consented: boolean } | null;
}

const LIST_POLL_MS = 12_000;
const THREAD_POLL_MS = 6_000;

function formatPhone(digits: string): string {
  const d = digits.replace(/\D/g, "");
  if (d.startsWith("55") && d.length >= 12) {
    const local = d.slice(2);
    return `+55 (${local.slice(0, 2)}) ${local.slice(2, -4)}-${local.slice(-4)}`;
  }
  return `+${d}`;
}

function formatTime(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();
  return sameDay
    ? date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
    : date.toLocaleString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      });
}

function windowRemaining(expiresAt: string | null): string {
  if (!expiresAt) return "";
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (ms <= 0) return "";
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return h > 0 ? `${h}h${m.toString().padStart(2, "0")}` : `${m}min`;
}

const STATUS_LABEL: Record<string, string> = {
  queued: "enviando…",
  sent: "enviado",
  delivered: "entregue",
  read: "lido",
  failed: "falhou",
};

const TEMPLATES = listTemplates();

export default function InboxPage() {
  const [authenticated, setAuthenticated] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);

  const [conversations, setConversations] = useState<WaConversationSummary[]>([]);
  const [listLoaded, setListLoaded] = useState(false);
  const [listError, setListError] = useState("");

  const [selectedPhone, setSelectedPhone] = useState<string | null>(null);
  const [thread, setThread] = useState<ThreadData | null>(null);
  const [threadLoading, setThreadLoading] = useState(false);

  const [replyText, setReplyText] = useState("");
  const [templateName, setTemplateName] = useState(TEMPLATES[0]?.name ?? "");
  const [tplDate, setTplDate] = useState("");
  const [tplTime, setTplTime] = useState("");
  const [tplMessage, setTplMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState("");
  const [sendOk, setSendOk] = useState("");

  const bottomRef = useRef<HTMLDivElement>(null);
  const messageCountRef = useRef(0);

  useEffect(() => {
    setAuthenticated(sessionStorage.getItem("kai-authenticated") === "true");
    setAuthChecked(true);
  }, []);

  const fetchConversations = useCallback(async () => {
    try {
      const res = await fetch("/api/whatsapp/conversations", {
        headers: getPinHeaders(),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setConversations(data.conversations ?? []);
      setListError("");
    } catch {
      setListError("Falha ao carregar conversas — tentando novamente…");
    } finally {
      setListLoaded(true);
    }
  }, []);

  const fetchThread = useCallback(async (phone: string) => {
    try {
      const res = await fetch(
        `/api/whatsapp/messages?phone=${encodeURIComponent(phone)}&limit=200`,
        { headers: getPinHeaders() }
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setThread({
        messages: [...(data.messages ?? [])].reverse(),
        window: data.window ?? { open: false, expiresAt: null },
        patient: data.patient ?? null,
        optIn: data.optIn ?? null,
      });
    } catch {
      // keep the last good thread on poll failure
    } finally {
      setThreadLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!authenticated) return;
    fetchConversations();
    const t = setInterval(fetchConversations, LIST_POLL_MS);
    return () => clearInterval(t);
  }, [authenticated, fetchConversations]);

  useEffect(() => {
    if (!authenticated || !selectedPhone) return;
    setThreadLoading(true);
    setThread(null);
    setSendError("");
    setSendOk("");
    fetchThread(selectedPhone);
    const t = setInterval(() => fetchThread(selectedPhone), THREAD_POLL_MS);
    return () => clearInterval(t);
  }, [authenticated, selectedPhone, fetchThread]);

  useEffect(() => {
    const count = thread?.messages.length ?? 0;
    if (count !== messageCountRef.current) {
      messageCountRef.current = count;
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [thread]);

  async function handleSend() {
    if (!selectedPhone || !thread || sending) return;
    const windowOpen = thread.window.open;

    if (windowOpen && !replyText.trim()) return;
    if (!windowOpen && templateName === "lembrete_consulta" && (!tplDate.trim() || !tplTime.trim())) {
      setSendError("Informe data e horário para o lembrete de consulta.");
      return;
    }

    setSending(true);
    setSendError("");
    setSendOk("");

    const payload = windowOpen
      ? { phone: selectedPhone, type: "text", text: replyText.trim() }
      : {
          phone: selectedPhone,
          type: "template",
          templateName,
          templateContext: {
            ...(templateName === "lembrete_consulta"
              ? { appointmentDate: tplDate.trim(), appointmentTime: tplTime.trim() }
              : {}),
            ...(templateName === "retorno_fase" && tplMessage.trim()
              ? { customMessage: tplMessage.trim() }
              : {}),
          },
        };

    try {
      const res = await fetch("/api/whatsapp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getPinHeaders() },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setSendError(
          (data.error ?? "Falha ao enviar a mensagem.") +
            (data.code ? ` (código ${data.code})` : "")
        );
      } else {
        setReplyText("");
        setTplMessage("");
        setSendOk(windowOpen ? "" : `Template "${templateName}" enviado.`);
        await fetchThread(selectedPhone);
        fetchConversations();
      }
    } catch {
      setSendError("Erro de conexão ao enviar. Verifique a internet e tente novamente.");
    } finally {
      setSending(false);
    }
  }

  if (!authChecked) {
    return <div className="min-h-screen bg-white dark:bg-slate-900" />;
  }
  if (!authenticated) {
    return <PinLogin onSuccess={() => setAuthenticated(true)} />;
  }

  const selected = conversations.find((c) => c.phone === selectedPhone) ?? null;
  const windowOpen = thread?.window.open ?? false;
  const patientLinked = !!thread?.patient;

  return (
    <div className="h-screen flex flex-col bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 font-sans">
      {/* Header */}
      <header className="flex items-center gap-3 px-4 py-3 border-b border-slate-200 dark:border-slate-700 shrink-0">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/ik-logo.png" alt="Instituto Kaufmann" className="h-7 w-auto block dark:hidden" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/ik-logo-white.png" alt="Instituto Kaufmann" className="h-7 w-auto hidden dark:block" />
        <h1 className="text-sm font-semibold">WhatsApp — Caixa de Entrada</h1>
        <a
          href="/"
          className="ml-auto text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
        >
          ← Voltar ao painel
        </a>
      </header>

      <div className="flex flex-1 min-h-0">
        {/* Thread list */}
        <aside className="w-80 shrink-0 border-r border-slate-200 dark:border-slate-700 overflow-y-auto">
          {listError && (
            <p className="p-3 text-xs text-red-500 dark:text-red-400">{listError}</p>
          )}
          {listLoaded && !listError && conversations.length === 0 && (
            <p className="p-4 text-xs text-slate-400 dark:text-slate-500">
              Nenhuma conversa ainda. Quando um paciente enviar mensagem para o
              número da clínica, ela aparece aqui.
            </p>
          )}
          {conversations.map((c) => {
            const active = c.phone === selectedPhone;
            return (
              <button
                key={c.phone}
                onClick={() => setSelectedPhone(c.phone)}
                className={`w-full text-left px-4 py-3 border-b border-slate-100 dark:border-slate-800 transition-colors ${
                  active
                    ? "bg-slate-100 dark:bg-slate-800"
                    : "hover:bg-slate-50 dark:hover:bg-slate-800/50"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold truncate">
                    {c.patientName ?? "Não identificado"}
                  </span>
                  <span className="text-[10px] text-slate-400 shrink-0">
                    {formatTime(c.lastMessageAt)}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2 mt-0.5">
                  <span className="text-xs text-slate-500 dark:text-slate-400 truncate">
                    {c.lastDirection === "outbound" ? "Você: " : ""}
                    {c.lastBody ?? `[${c.lastType}]`}
                  </span>
                  {c.windowExpiresAt ? (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 shrink-0">
                      janela {windowRemaining(c.windowExpiresAt)}
                    </span>
                  ) : (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 shrink-0">
                      fechada
                    </span>
                  )}
                </div>
                <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
                  {formatPhone(c.phone)}
                </div>
              </button>
            );
          })}
        </aside>

        {/* Thread view */}
        <main className="flex-1 min-w-0 flex flex-col">
          {!selectedPhone ? (
            <div className="flex-1 flex items-center justify-center text-sm text-slate-400 dark:text-slate-500">
              Selecione uma conversa
            </div>
          ) : (
            <>
              {/* Thread header */}
              <div className="px-4 py-2.5 border-b border-slate-200 dark:border-slate-700 flex items-center gap-3 shrink-0">
                <div className="min-w-0">
                  <div className="text-sm font-semibold truncate">
                    {thread?.patient?.name ?? selected?.patientName ?? "Não identificado"}
                  </div>
                  <div className="text-xs text-slate-400">{formatPhone(selectedPhone)}</div>
                </div>
                <div className="ml-auto flex items-center gap-2">
                  {thread &&
                    (windowOpen ? (
                      <span className="text-[11px] px-2 py-1 rounded-full bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300">
                        Janela de 24h aberta
                        {thread.window.expiresAt
                          ? ` — ${windowRemaining(thread.window.expiresAt)} restantes`
                          : ""}
                      </span>
                    ) : (
                      <span className="text-[11px] px-2 py-1 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300">
                        Janela fechada — apenas templates
                      </span>
                    ))}
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
                {threadLoading && !thread && (
                  <p className="text-xs text-slate-400 text-center py-8">Carregando…</p>
                )}
                {thread?.messages.map((m) => {
                  const outbound = m.direction === "outbound";
                  const failed = m.status === "failed";
                  const failureText = failed
                    ? waErrorMessagePtBr(m.errorCode) ??
                      m.errorMessage ??
                      "falha no envio"
                    : null;
                  return (
                    <div
                      key={m.id}
                      className={`flex ${outbound ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`max-w-[75%] rounded-xl px-3 py-2 text-sm whitespace-pre-wrap break-words ${
                          outbound
                            ? "bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-100 dark:border-emerald-900"
                            : "bg-slate-100 dark:bg-slate-800"
                        }`}
                      >
                        {m.templateName && (
                          <div className="text-[10px] uppercase tracking-wide text-slate-400 mb-0.5">
                            template: {m.templateName}
                          </div>
                        )}
                        <div>{m.body ?? `[${m.type}]`}</div>
                        {m.mediaId && (
                          <div className="text-[10px] text-slate-400 mt-1">
                            mídia recebida (ID {m.mediaId}) — download ainda não disponível no painel
                          </div>
                        )}
                        <div
                          className={`text-[10px] mt-1 ${
                            failed ? "text-red-500 dark:text-red-400" : "text-slate-400"
                          }`}
                        >
                          {formatTime(m.createdAt)}
                          {outbound && m.status
                            ? ` · ${STATUS_LABEL[m.status] ?? m.status}`
                            : ""}
                          {failureText ? ` — ${failureText}` : ""}
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div ref={bottomRef} />
              </div>

              {/* Composer */}
              <div className="border-t border-slate-200 dark:border-slate-700 p-3 shrink-0 space-y-2">
                {sendError && (
                  <p className="text-xs font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-lg px-3 py-2">
                    {sendError}
                  </p>
                )}
                {sendOk && (
                  <p className="text-xs font-medium text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg px-3 py-2">
                    {sendOk}
                  </p>
                )}

                {thread && windowOpen && (
                  <div className="flex gap-2 items-end">
                    <textarea
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          handleSend();
                        }
                      }}
                      rows={2}
                      placeholder="Escreva a resposta… (Enter envia, Shift+Enter quebra linha)"
                      className="flex-1 resize-none px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent"
                    />
                    <button
                      onClick={handleSend}
                      disabled={sending || !replyText.trim()}
                      className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                        sending || !replyText.trim()
                          ? "bg-slate-100 dark:bg-slate-800 text-slate-300 dark:text-slate-600 cursor-not-allowed"
                          : "bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-100"
                      }`}
                    >
                      {sending ? "Enviando…" : "Enviar"}
                    </button>
                  </div>
                )}

                {thread && !windowOpen && patientLinked && (
                  <div className="space-y-2">
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      A janela de 24h está fechada. Envie um template aprovado para
                      reabrir a conversa:
                    </p>
                    <div className="flex gap-2 items-center flex-wrap">
                      <select
                        value={templateName}
                        onChange={(e) => setTemplateName(e.target.value)}
                        className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm outline-none"
                      >
                        {TEMPLATES.map((t) => (
                          <option key={t.name} value={t.name}>
                            {t.name}
                          </option>
                        ))}
                      </select>
                      {templateName === "lembrete_consulta" && (
                        <>
                          <input
                            value={tplDate}
                            onChange={(e) => setTplDate(e.target.value)}
                            placeholder="Data (ex: 12/08)"
                            className="w-32 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm outline-none"
                          />
                          <input
                            value={tplTime}
                            onChange={(e) => setTplTime(e.target.value)}
                            placeholder="Hora (ex: 14:30)"
                            className="w-28 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm outline-none"
                          />
                        </>
                      )}
                      {templateName === "retorno_fase" && (
                        <input
                          value={tplMessage}
                          onChange={(e) => setTplMessage(e.target.value)}
                          placeholder="Mensagem (opcional)"
                          className="flex-1 min-w-40 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm outline-none"
                        />
                      )}
                      <button
                        onClick={handleSend}
                        disabled={sending}
                        className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                          sending
                            ? "bg-slate-100 dark:bg-slate-800 text-slate-300 dark:text-slate-600 cursor-not-allowed"
                            : "bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-100"
                        }`}
                      >
                        {sending ? "Enviando…" : "Enviar template"}
                      </button>
                    </div>
                    <p className="text-[10px] text-slate-400">
                      {TEMPLATES.find((t) => t.name === templateName)?.description}
                    </p>
                  </div>
                )}

                {thread && !windowOpen && !patientLinked && (
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Janela fechada e número sem paciente vinculado — não é possível
                    responder até o paciente enviar nova mensagem. Para enviar
                    templates, cadastre este número no perfil de um paciente:{" "}
                    <span className="font-mono">{formatPhone(selectedPhone)}</span>
                  </p>
                )}
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
}
