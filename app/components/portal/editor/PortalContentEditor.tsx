"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, ChevronDown, ChevronUp, Lock, Plus, Sparkles, Trash2, X } from "lucide-react";
import { checkClinicalRules } from "../../../lib/clinicalRules";
import { unverifiedDoseMentions } from "../../../lib/portal/validate";
import { MODULE_LABELS, SLOT_LABELS, type ContentKey, type PortalContent } from "../../../lib/portal/schema";
import type { PortalPayload } from "../../../lib/portal/payload";
import type { PortalEditorApi } from "./usePortalEditor";

// ---------- Section map (editor ↔ preview ↔ content keys) ----------

export type EditorSectionId = "resumo" | "modulos" | "medicamentos" | "planos" | "exames" | "proximosPassos";

export const EDITOR_SECTIONS: { id: EditorSectionId; title: string; keys: ContentKey[]; previewIds: string[] }[] = [
  { id: "resumo", title: "Resumo e prioridades", keys: ["resumo"], previewIds: ["resumo"] },
  { id: "modulos", title: "Dia a dia", keys: ["modulos"], previewIds: ["dia-a-dia"] },
  { id: "medicamentos", title: "O que tomar", keys: ["medicamentos"], previewIds: ["o-que-tomar"] },
  { id: "planos", title: "Alimentação e treino", keys: ["dieta", "treino"], previewIds: ["alimentacao", "treino"] },
  { id: "exames", title: "Exames", keys: ["exames"], previewIds: ["exames"] },
  { id: "proximosPassos", title: "Próximos passos", keys: ["proximosPassos"], previewIds: ["proximos-passos"] },
];

export function editorSectionForPreview(previewId: string): EditorSectionId | null {
  return EDITOR_SECTIONS.find((s) => s.previewIds.includes(previewId))?.id ?? null;
}

// ---------- Inline checks ----------

type CheckFn = (text: string) => string[];

export function useTextCheck(sex: string, sourceText: string): CheckFn {
  return useMemo(() => {
    return (text: string) => {
      if (!text.trim()) return [];
      const out = checkClinicalRules(text, sex).map((v) => `Termo bloqueado pelas regras clínicas: "${v.matchedTerm}"`);
      for (const dose of unverifiedDoseMentions(text, sourceText)) out.push(`"${dose}" não está escrito assim na receita/conduta. Doses só aparecem pela receita.`);
      return out;
    };
  }, [sex, sourceText]);
}

// ---------- Field primitives ----------

const inputBase =
  "w-full resize-none rounded-lg border bg-white px-3 py-2 text-sm leading-relaxed text-slate-800 outline-none transition placeholder:text-slate-300 focus:border-brand-400 focus:ring-2 focus:ring-brand-100 disabled:opacity-60 dark:bg-slate-900 dark:text-slate-100 dark:focus:ring-brand-900/40";

function AutoTextarea({
  value,
  onChange,
  maxLength,
  placeholder,
  invalid,
  rows = 1,
}: {
  value: string;
  onChange: (v: string) => void;
  maxLength: number;
  placeholder?: string;
  invalid?: boolean;
  rows?: number;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight + 2}px`;
  }, [value]);
  return (
    <textarea
      ref={ref}
      rows={rows}
      value={value}
      maxLength={maxLength}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className={`${inputBase} ${invalid ? "border-amber-400 dark:border-amber-600" : "border-slate-200 dark:border-slate-700"}`}
    />
  );
}

function Warnings({ items }: { items: string[] }) {
  if (!items.length) return null;
  return (
    <ul className="mt-1 space-y-0.5">
      {items.map((w, i) => (
        <li key={i} className="flex items-start gap-1.5 text-xs text-amber-700 dark:text-amber-400">
          <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
          {w}
        </li>
      ))}
    </ul>
  );
}

function TextField({
  label,
  value,
  onChange,
  max,
  min = 0,
  check,
  placeholder,
  rows,
}: {
  label?: string;
  value: string;
  onChange: (v: string) => void;
  max: number;
  min?: number;
  check: CheckFn;
  placeholder?: string;
  rows?: number;
}) {
  const warnings = check(value);
  const tooShort = min > 0 && value.trim().length < min;
  return (
    <div>
      {label && (
        <div className="mb-1 flex items-baseline justify-between gap-2">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">{label}</span>
          <span className={`text-[10px] tabular-nums ${tooShort ? "text-amber-600" : "text-slate-300 dark:text-slate-600"}`}>
            {value.length}/{max}
          </span>
        </div>
      )}
      <AutoTextarea value={value} onChange={onChange} maxLength={max} placeholder={placeholder} invalid={warnings.length > 0 || tooShort} rows={rows} />
      {tooShort && <Warnings items={[`Escreva pelo menos ${min} caracteres.`]} />}
      <Warnings items={warnings} />
    </div>
  );
}

function ListField({
  label,
  items,
  onChange,
  maxItems,
  maxLen,
  minItems = 0,
  addLabel,
  check,
  numbered,
}: {
  label: string;
  items: string[];
  onChange: (items: string[], kind: "type" | "structure") => void;
  maxItems: number;
  maxLen: number;
  minItems?: number;
  addLabel: string;
  check: CheckFn;
  numbered?: boolean;
}) {
  const set = (i: number, v: string) => onChange(items.map((x, j) => (j === i ? v : x)), "type");
  const remove = (i: number) => onChange(items.filter((_, j) => j !== i), "structure");
  const move = (i: number, d: -1 | 1) => {
    const next = [...items];
    [next[i], next[i + d]] = [next[i + d], next[i]];
    onChange(next, "structure");
  };
  const filled = items.filter((x) => x.trim().length >= 2).length;

  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">{label}</span>
        <span className="text-[10px] tabular-nums text-slate-300 dark:text-slate-600">
          {items.length}/{maxItems}
        </span>
      </div>
      <ul className="space-y-1.5">
        {items.map((item, i) => (
          <li key={i} className="group">
            <div className="flex items-start gap-1.5">
              {numbered && <span className="mt-2 w-4 shrink-0 text-right text-xs font-bold text-slate-300">{i + 1}</span>}
              <div className="min-w-0 flex-1">
                <AutoTextarea value={item} onChange={(v) => set(i, v)} maxLength={maxLen} invalid={check(item).length > 0} />
              </div>
              <div className="flex shrink-0 flex-col opacity-40 transition group-focus-within:opacity-100 group-hover:opacity-100">
                <button type="button" title="Subir" disabled={i === 0} onClick={() => move(i, -1)} className="rounded p-0.5 text-slate-400 hover:text-slate-700 disabled:invisible">
                  <ChevronUp className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  title="Descer"
                  disabled={i === items.length - 1}
                  onClick={() => move(i, 1)}
                  className="rounded p-0.5 text-slate-400 hover:text-slate-700 disabled:invisible"
                >
                  <ChevronDown className="h-3.5 w-3.5" />
                </button>
              </div>
              <button type="button" title="Remover" onClick={() => remove(i)} className="mt-1.5 shrink-0 rounded p-1 text-slate-300 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className={numbered ? "pl-5" : ""}>
              <Warnings items={check(item)} />
            </div>
          </li>
        ))}
      </ul>
      {items.length < maxItems && (
        <button
          type="button"
          onClick={() => onChange([...items, ""], "structure")}
          className="mt-1.5 flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold text-brand-600 hover:bg-brand-50 dark:text-brand-400 dark:hover:bg-brand-950/30"
        >
          <Plus className="h-3.5 w-3.5" /> {addLabel}
        </button>
      )}
      {filled < minItems && <Warnings items={[`Inclua pelo menos ${minItems} item.`]} />}
    </div>
  );
}

function LockedNote({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex items-start gap-1.5 text-xs text-slate-400 dark:text-slate-500">
      <Lock className="mt-0.5 h-3 w-3 shrink-0" />
      <span>{children}</span>
    </p>
  );
}

// ---------- Section shell ----------

function SectionShell({
  id,
  title,
  open,
  onToggle,
  highlighted,
  onAskAi,
  aiDisabled,
  children,
  sectionRef,
  onFocusInside,
}: {
  onFocusInside: () => void;
  id: EditorSectionId;
  title: string;
  open: boolean;
  onToggle: () => void;
  highlighted: boolean;
  onAskAi: () => void;
  aiDisabled: boolean;
  children: React.ReactNode;
  sectionRef: (el: HTMLElement | null) => void;
}) {
  return (
    <section
      ref={sectionRef}
      data-editor-section={id}
      onFocusCapture={onFocusInside}
      className={`scroll-mt-2 rounded-xl border transition ${
        highlighted ? "border-amber-300 bg-amber-50/40 ring-2 ring-amber-200 dark:border-amber-700 dark:bg-amber-950/20 dark:ring-amber-900/50" : "border-slate-200 dark:border-slate-700"
      }`}
    >
      <div className="flex items-center gap-1 px-3 py-2">
        <button type="button" onClick={onToggle} className="flex min-w-0 flex-1 items-center gap-2 text-left">
          <ChevronDown className={`h-4 w-4 shrink-0 text-slate-400 transition ${open ? "" : "-rotate-90"}`} />
          <span className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">{title}</span>
          {highlighted && <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold uppercase text-amber-700 dark:bg-amber-900/50 dark:text-amber-300">IA</span>}
        </button>
        <button
          type="button"
          onClick={onAskAi}
          disabled={aiDisabled}
          title="Pedir à IA para alterar só esta seção"
          className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold text-brand-600 hover:bg-brand-50 disabled:opacity-40 dark:text-brand-400 dark:hover:bg-brand-950/30"
        >
          <Sparkles className="h-3.5 w-3.5" /> IA
        </button>
      </div>
      {open && <div className="space-y-4 border-t border-slate-100 px-4 pb-4 pt-3 dark:border-slate-700/60">{children}</div>}
    </section>
  );
}

// ---------- Editor ----------

type PortalContentEditorProps = {
  editor: PortalEditorApi;
  base: PortalPayload;
  check: CheckFn;
  disabled: boolean;
  focus: { section: EditorSectionId; nonce: number } | null;
  onAskAi: (section: EditorSectionId) => void;
  onSectionOpened: (section: EditorSectionId) => void;
  onEditReceita: () => void;
};

export function PortalContentEditor({ editor, base, check, disabled, focus, onAskAi, onSectionOpened, onEditReceita }: PortalContentEditorProps) {
  const { content, update, aiChange } = editor;
  const [closed, setClosed] = useState<Set<EditorSectionId>>(new Set());
  const refs = useRef<Partial<Record<EditorSectionId, HTMLElement | null>>>({});
  const lastFocused = useRef<EditorSectionId | null>(null);
  const selectSection = (id: EditorSectionId) => {
    if (lastFocused.current === id) return;
    lastFocused.current = id;
    onSectionOpened(id);
  };

  // Click in the phone preview: open and bring the matching section into view
  useEffect(() => {
    if (!focus) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setClosed((c) => {
      if (!c.has(focus.section)) return c;
      const next = new Set(c);
      next.delete(focus.section);
      return next;
    });
    requestAnimationFrame(() => refs.current[focus.section]?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }, [focus]);

  const patch = <K extends keyof PortalContent>(key: K, value: PortalContent[K], kind: "type" | "structure" = "type") =>
    update({ ...content, [key]: value }, kind);

  const markerLabel = (key: string) => base.labSeries.find((s) => s.key === key)?.label ?? key;
  const visible = EDITOR_SECTIONS.filter((s) => {
    if (s.id === "planos") return Boolean(base.schedules.dieta || base.schedules.treino);
    if (s.id === "medicamentos") return base.medicamentos.length > 0 || Boolean(base.receitaOriginal.trim());
    if (s.id === "exames") return content.exames.length > 0;
    return true;
  });

  const body = (id: EditorSectionId) => {
    switch (id) {
      case "resumo":
        return (
          <>
            <TextField
              label="O que a avaliação mostrou"
              value={content.resumo.texto}
              onChange={(v) => patch("resumo", { ...content.resumo, texto: v })}
              max={1200}
              min={20}
              rows={4}
              check={check}
            />
            <ListField
              label="Prioridades agora"
              items={content.resumo.prioridades}
              onChange={(items, kind) => patch("resumo", { ...content.resumo, prioridades: items }, kind)}
              maxItems={4}
              maxLen={120}
              minItems={1}
              addLabel="Adicionar prioridade"
              check={check}
              numbered
            />
          </>
        );

      case "modulos":
        return content.modulos.length === 0 ? (
          <p className="text-xs text-slate-400">Nenhuma área do dia a dia. Peça à IA para incluir uma, se quiser.</p>
        ) : (
          <div className="space-y-3">
            {content.modulos.map((m, i) => {
              const setMod = (next: PortalContent["modulos"][number], kind: "type" | "structure" = "type") =>
                patch(
                  "modulos",
                  content.modulos.map((x, j) => (j === i ? next : x)),
                  kind
                );
              return (
                <div key={`${m.id}-${i}`} className="rounded-lg border border-slate-100 bg-slate-50/60 p-3 dark:border-slate-700/60 dark:bg-slate-900/40">
                  <div className="mb-3 flex items-center gap-2">
                    <input
                      value={m.titulo}
                      maxLength={60}
                      onChange={(e) => setMod({ ...m, titulo: e.target.value })}
                      placeholder={MODULE_LABELS[m.id]}
                      className={`${inputBase} border-slate-200 font-semibold dark:border-slate-700`}
                    />
                    <div className="flex shrink-0 rounded-lg border border-slate-200 p-0.5 text-[11px] font-semibold dark:border-slate-700">
                      <button
                        type="button"
                        onClick={() => !m.ativo && setMod({ ...m, ativo: true, maisAdiante: undefined }, "structure")}
                        className={`rounded-md px-2 py-1 ${m.ativo ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300" : "text-slate-400"}`}
                      >
                        Ativo
                      </button>
                      <button
                        type="button"
                        title="Mostra a área como 'mais adiante', sem ações"
                        onClick={() => m.ativo && setMod({ ...m, ativo: false, acoes: [], porque: undefined }, "structure")}
                        className={`rounded-md px-2 py-1 ${!m.ativo ? "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300" : "text-slate-400"}`}
                      >
                        Aguardando
                      </button>
                    </div>
                    <button
                      type="button"
                      title="Remover esta área"
                      onClick={() =>
                        patch(
                          "modulos",
                          content.modulos.filter((_, j) => j !== i),
                          "structure"
                        )
                      }
                      className="shrink-0 rounded p-1.5 text-slate-300 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  {m.ativo ? (
                    <div className="space-y-3">
                      <ListField
                        label="O que fazer"
                        items={m.acoes}
                        onChange={(acoes, kind) => setMod({ ...m, acoes }, kind)}
                        maxItems={6}
                        maxLen={200}
                        minItems={1}
                        addLabel="Adicionar ação"
                        check={check}
                      />
                      <TextField label="Por que isso importa" value={m.porque ?? ""} onChange={(v) => setMod({ ...m, porque: v || undefined })} max={240} check={check} />
                    </div>
                  ) : (
                    <TextField
                      label="O que precisa melhorar antes"
                      value={m.maisAdiante ?? ""}
                      onChange={(v) => setMod({ ...m, maisAdiante: v || undefined })}
                      max={240}
                      check={check}
                    />
                  )}
                </div>
              );
            })}
          </div>
        );

      case "medicamentos":
        return (
          <>
            <div className="flex items-start justify-between gap-3">
              <LockedNote>Nome, dose e horário vêm da receita e não podem ser editados aqui. Você pode ajustar a explicação de cada item.</LockedNote>
              <button
                type="button"
                onClick={onEditReceita}
                className="shrink-0 rounded-md border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
              >
                Editar na receita
              </button>
            </div>
            {base.medicamentos.length === 0 ? (
              <p className="text-xs text-slate-400">Nenhum item reconhecido na receita; o paciente verá a receita completa.</p>
            ) : (
              <ul className="space-y-3">
                {base.medicamentos.map((med, i) => {
                  const note = content.medicamentos.find((x) => x.nome === med.nome)?.observacao ?? "";
                  const setNote = (v: string) => {
                    const others = content.medicamentos.filter((x) => x.nome !== med.nome);
                    const entry = v ? { nome: med.nome, observacao: v } : { nome: med.nome };
                    // Keep receita order so the payload merge and the editor stay aligned
                    const order = base.medicamentos.map((b) => b.nome);
                    patch(
                      "medicamentos",
                      [...others, entry].sort((a, b) => order.indexOf(a.nome) - order.indexOf(b.nome))
                    );
                  };
                  return (
                    // The same item can appear twice in a receita (e.g. two phases), so the name alone isn't unique
                    <li key={`${i}-${med.slot}-${med.nome}`}>
                      <div className="mb-1 flex flex-wrap items-baseline gap-x-2 text-sm">
                        <span className="font-medium text-slate-800 dark:text-slate-100">{med.nome}</span>
                        <span className="font-semibold text-brand-700 dark:text-brand-400">{med.dose}</span>
                        <span className="text-[11px] text-slate-400">· {SLOT_LABELS[med.slot]}</span>
                      </div>
                      <TextField value={note} onChange={setNote} max={200} check={check} placeholder="Explicação para o paciente (opcional)" />
                    </li>
                  );
                })}
              </ul>
            )}
          </>
        );

      case "planos":
        return (
          <>
            <LockedNote>Os planos de 30 dias são copiados da conduta sem alteração. Aqui você edita só a introdução de cada um.</LockedNote>
            {base.schedules.dieta && (
              <TextField
                label="Introdução da alimentação"
                value={content.dieta?.introducao ?? ""}
                onChange={(v) => patch("dieta", v ? { introducao: v } : undefined)}
                max={400}
                check={check}
              />
            )}
            {base.schedules.treino && (
              <TextField
                label="Introdução do treino"
                value={content.treino?.introducao ?? ""}
                onChange={(v) => patch("treino", v ? { introducao: v } : undefined)}
                max={400}
                check={check}
              />
            )}
          </>
        );

      case "exames":
        return (
          <div className="space-y-3">
            <LockedNote>Valores e gráficos vêm dos exames. Aqui você edita o nome simples, a explicação e a situação.</LockedNote>
            {content.exames.map((ex, i) => {
              const setEx = (next: PortalContent["exames"][number], kind: "type" | "structure" = "type") =>
                patch(
                  "exames",
                  content.exames.map((x, j) => (j === i ? next : x)),
                  kind
                );
              return (
                <div key={`${i}-${ex.marcador}`} className="rounded-lg border border-slate-100 bg-slate-50/60 p-3 dark:border-slate-700/60 dark:bg-slate-900/40">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{markerLabel(ex.marcador)}</span>
                    <div className="flex items-center gap-1">
                      <div className="flex rounded-lg border border-slate-200 p-0.5 text-[11px] font-semibold dark:border-slate-700">
                        {(
                          [
                            ["bem", "Bem", "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300"],
                            ["atencao", "Atenção", "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300"],
                            ["cuidado", "Cuidado", "bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300"],
                          ] as const
                        ).map(([value, label, on]) => (
                          <button
                            key={value}
                            type="button"
                            onClick={() => setEx({ ...ex, situacao: value }, "structure")}
                            className={`rounded-md px-2 py-0.5 ${ex.situacao === value ? on : "text-slate-400"}`}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                      <button
                        type="button"
                        title="Remover explicação"
                        onClick={() =>
                          patch(
                            "exames",
                            content.exames.filter((_, j) => j !== i),
                            "structure"
                          )
                        }
                        className="rounded p-1 text-slate-300 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <TextField label="Nome simples" value={ex.nomePopular} onChange={(v) => setEx({ ...ex, nomePopular: v })} max={60} min={2} check={check} />
                    <TextField label="Explicação" value={ex.explicacao} onChange={(v) => setEx({ ...ex, explicacao: v })} max={300} min={5} check={check} />
                  </div>
                </div>
              );
            })}
          </div>
        );

      case "proximosPassos": {
        const p = content.proximosPassos;
        return (
          <>
            <ListField
              label="Exames antes do próximo retorno"
              items={p.examesAntes}
              onChange={(items, kind) => patch("proximosPassos", { ...p, examesAntes: items }, kind)}
              maxItems={12}
              maxLen={120}
              addLabel="Adicionar exame"
              check={check}
            />
            <ListField
              label="Sinais para falar com a clínica antes do retorno"
              items={p.sinaisDeAlerta}
              onChange={(items, kind) => patch("proximosPassos", { ...p, sinaisDeAlerta: items }, kind)}
              maxItems={8}
              maxLen={160}
              addLabel="Adicionar sinal"
              check={check}
            />
            <TextField label="Observações" value={p.observacoes ?? ""} onChange={(v) => patch("proximosPassos", { ...p, observacoes: v || undefined })} max={400} check={check} />
            <LockedNote>A data sugerida do retorno vem do motor de acompanhamento.</LockedNote>
          </>
        );
      }
    }
  };

  return (
    <fieldset disabled={disabled} className="space-y-3">
      {visible.map((s) => (
        <SectionShell
          key={s.id}
          id={s.id}
          title={s.title}
          open={!closed.has(s.id)}
          onToggle={() => {
            const opening = closed.has(s.id);
            setClosed((c) => {
              const next = new Set(c);
              if (opening) next.delete(s.id);
              else next.add(s.id);
              return next;
            });
            if (opening) {
              lastFocused.current = null;
              selectSection(s.id);
            }
          }}
          onFocusInside={() => selectSection(s.id)}
          highlighted={Boolean(aiChange?.keys.some((k) => s.keys.includes(k)))}
          onAskAi={() => onAskAi(s.id)}
          aiDisabled={disabled}
          sectionRef={(el) => {
            refs.current[s.id] = el;
          }}
        >
          {body(s.id)}
        </SectionShell>
      ))}
    </fieldset>
  );
}
