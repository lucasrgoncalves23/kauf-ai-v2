"use client";

import type { ComponentType } from "react";
import {
  AlertTriangle,
  CalendarDays,
  Check,
  Clock,
  Coffee,
  Dumbbell,
  FlaskConical,
  Moon,
  Phone,
  Soup,
  Sunrise,
  Utensils,
} from "lucide-react";
import { markerStatus, refRangeText, type MarkerStatus } from "../../lib/labTrends";
import { MarkerChart, formatValue } from "../charts/MarkerChart";
import { SLOTS, SLOT_LABELS, type PortalContent, type Slot } from "../../lib/portal/schema";
import type { PortalLabSeries, PortalMedication, PortalSchedule } from "../../lib/portal/payload";

export function formatLongDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric" });
}

export function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-16 print:break-inside-avoid">
      <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-400">{title}</h2>
      {children}
    </section>
  );
}

export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-slate-100 bg-white p-5 shadow-sm print:border-slate-300 print:shadow-none ${className}`}>
      {children}
    </div>
  );
}

// ---------- Resumo ----------

export function ResumoSection({ resumo }: { resumo: PortalContent["resumo"] }) {
  return (
    <Section id="resumo" title="O que a avaliação mostrou">
      <Card>
        <p className="text-[15px] leading-relaxed text-slate-700">{resumo.texto}</p>
        {resumo.prioridades.length > 0 && (
          <div className="mt-5">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Suas prioridades agora</p>
            <ol className="space-y-2">
              {resumo.prioridades.map((p, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-50 text-xs font-bold text-brand-700">
                    {i + 1}
                  </span>
                  <span className="text-[15px] leading-relaxed text-slate-800">{p}</span>
                </li>
              ))}
            </ol>
          </div>
        )}
      </Card>
    </Section>
  );
}

// ---------- Dia a dia ----------

type ChecklistApi = { isChecked: (id: string) => boolean; toggle: (id: string) => void };

export function DiaADiaSection({ modulos, checklist }: { modulos: PortalContent["modulos"]; checklist: ChecklistApi }) {
  const active = modulos.filter((m) => m.ativo && m.acoes.length > 0);
  const later = modulos.filter((m) => !m.ativo);
  if (active.length === 0 && later.length === 0) return null;

  return (
    <Section id="dia-a-dia" title="Seu dia a dia">
      <div className="space-y-3">
        {active.map((m) => (
          <Card key={m.id}>
            <h3 className="text-base font-semibold text-slate-900">{m.titulo}</h3>
            {m.porque && <p className="mt-1 text-sm leading-relaxed text-slate-500">{m.porque}</p>}
            <ul className="mt-3 space-y-2">
              {m.acoes.map((a, i) => {
                const id = `${m.id}:${i}`;
                const done = checklist.isChecked(id);
                return (
                  <li key={id}>
                    <button
                      type="button"
                      onClick={() => checklist.toggle(id)}
                      aria-pressed={done}
                      className="flex w-full items-start gap-3 rounded-xl px-2 py-1.5 text-left transition hover:bg-slate-50 print:hover:bg-transparent"
                    >
                      <span
                        className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition ${
                          done ? "border-emerald-500 bg-emerald-500 text-white" : "border-slate-300 bg-white"
                        }`}
                      >
                        {done && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
                      </span>
                      <span className={`text-[15px] leading-relaxed ${done ? "text-slate-400 line-through" : "text-slate-800"}`}>{a}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </Card>
        ))}
        {later.length > 0 && (
          <Card className="border-dashed bg-slate-50/60">
            <h3 className="text-base font-semibold text-slate-700">Mais adiante</h3>
            <p className="mt-1 text-sm text-slate-500">Áreas que entram no plano quando o momento for certo.</p>
            <ul className="mt-3 space-y-2.5">
              {later.map((m) => (
                <li key={m.id} className="text-sm leading-relaxed text-slate-600">
                  <span className="font-semibold text-slate-700">{m.titulo}:</span> {m.maisAdiante || "não indicado neste momento."}
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>
    </Section>
  );
}

// ---------- O que tomar ----------

const SLOT_ICONS: Record<Slot, ComponentType<{ className?: string }>> = {
  ao_acordar: Sunrise,
  cafe_da_manha: Coffee,
  almoco: Utensils,
  pre_treino: Dumbbell,
  jantar: Soup,
  ao_deitar: Moon,
  outro: Clock,
};

export function MedicamentosSection({
  medicamentos,
  receitaOriginal,
  expandAll,
}: {
  medicamentos: PortalMedication[];
  receitaOriginal: string;
  expandAll: boolean;
}) {
  if (medicamentos.length === 0 && !receitaOriginal.trim()) return null;
  const groups = SLOTS.map((slot) => ({ slot, items: medicamentos.filter((m) => m.slot === slot) })).filter((g) => g.items.length > 0);

  return (
    <Section id="o-que-tomar" title="O que tomar e quando">
      <Card>
        {groups.length > 0 ? (
          <div className="space-y-5">
            {groups.map(({ slot, items }) => {
              const Icon = SLOT_ICONS[slot];
              return (
                <div key={slot}>
                  <div className="mb-2 flex items-center gap-2 text-slate-500">
                    <Icon className="h-4 w-4" />
                    <span className="text-xs font-semibold uppercase tracking-wide">{SLOT_LABELS[slot]}</span>
                  </div>
                  <ul className="divide-y divide-slate-100">
                    {items.map((m, i) => (
                      <li key={i} className="flex items-baseline justify-between gap-4 py-2.5">
                        <div className="min-w-0">
                          <p className="text-[15px] font-medium text-slate-900">{m.nome}</p>
                          {m.observacao && <p className="text-sm text-slate-500">{m.observacao}</p>}
                        </div>
                        {m.dose && <span className="shrink-0 text-[15px] font-semibold tabular-nums text-brand-700">{m.dose}</span>}
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-slate-500">A sua receita completa está abaixo.</p>
        )}

        {receitaOriginal.trim() && (
          <details open={expandAll || undefined} className="group mt-5 rounded-xl border border-slate-100 bg-slate-50/60">
            <summary className="cursor-pointer select-none px-4 py-3 text-sm font-semibold text-slate-600 marker:hidden">
              Ver receita completa
              <span className="ml-1 font-normal text-slate-400">(texto original do médico)</span>
            </summary>
            <pre className="whitespace-pre-wrap px-4 pb-4 font-sans text-[13px] leading-relaxed text-slate-600">{receitaOriginal.trim()}</pre>
          </details>
        )}
      </Card>
    </Section>
  );
}

// ---------- Planos de 30 dias ----------

export function ScheduleSection({
  id,
  title,
  schedule,
  expandAll,
}: {
  id: string;
  title: string;
  schedule: PortalSchedule;
  expandAll: boolean;
}) {
  const bodyWithoutHeading = schedule.texto.split("\n").slice(1).join("\n").trim();
  return (
    <Section id={id} title={title}>
      <Card>
        {schedule.introducao && <p className="mb-4 text-[15px] leading-relaxed text-slate-700">{schedule.introducao}</p>}
        {schedule.dias ? (
          <div className="divide-y divide-slate-100">
            {schedule.dias.map((d, i) => (
              <details key={d.dia} open={expandAll || i === 0 || undefined} className="group py-1">
                <summary className="flex cursor-pointer select-none items-center justify-between py-2 text-[15px] font-semibold text-slate-800 marker:hidden">
                  Dia {d.dia}
                  <span className="text-xs font-normal text-slate-400 group-open:hidden">ver</span>
                </summary>
                <p className="whitespace-pre-wrap pb-3 text-[15px] leading-relaxed text-slate-700">{d.texto}</p>
              </details>
            ))}
          </div>
        ) : (
          <pre className="whitespace-pre-wrap font-sans text-[15px] leading-relaxed text-slate-700">{bodyWithoutHeading}</pre>
        )}
      </Card>
    </Section>
  );
}

// ---------- Exames ----------

const STATUS_CHIP: Record<MarkerStatus, { label: string; className: string }> = {
  normal: { label: "Dentro do esperado", className: "bg-emerald-50 text-emerald-700" },
  warning: { label: "Um pouco fora", className: "bg-amber-50 text-amber-700" },
  critical: { label: "Precisa de atenção", className: "bg-red-50 text-red-700" },
};

export function ExamesSection({ labSeries, exames }: { labSeries: PortalLabSeries[]; exames: PortalContent["exames"] }) {
  if (labSeries.length === 0) return null;
  const explanations = new Map(exames.map((e) => [e.marcador, e]));

  return (
    <Section id="exames" title="Seus exames">
      <div className="grid gap-3 sm:grid-cols-2">
        {labSeries.map((s) => {
          const latest = s.points[s.points.length - 1];
          const info = explanations.get(s.key);
          const hasRef = s.refMin !== undefined || s.refMax !== undefined;
          const status = hasRef ? markerStatus(latest.value, s) : null;
          const chip = status ? STATUS_CHIP[status] : null;
          const ref = refRangeText(s);
          return (
            <Card key={s.key} className="flex flex-col">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-[15px] font-semibold text-slate-900">{info?.nomePopular || s.label}</h3>
                  {info?.nomePopular && info.nomePopular !== s.label && <p className="text-xs text-slate-400">{s.label}</p>}
                </div>
                {chip && <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${chip.className}`}>{chip.label}</span>}
              </div>
              <div className="mt-2 flex items-baseline gap-1.5">
                <span className="text-2xl font-semibold tabular-nums text-slate-900">{formatValue(latest.value)}</span>
                <span className="text-sm text-slate-400">{s.unit}</span>
                {ref && <span className="ml-auto text-[11px] text-slate-400">faixa: {ref}</span>}
              </div>
              {info?.explicacao && <p className="mt-2 text-sm leading-relaxed text-slate-600">{info.explicacao}</p>}
              <div className="mt-4">
                {s.points.length > 1 ? (
                  <MarkerChart series={s} />
                ) : (
                  <p className="text-xs text-slate-400">Primeiro registro ({latest.label}). A evolução aparece a partir da próxima consulta.</p>
                )}
              </div>
            </Card>
          );
        })}
      </div>
      <p className="mt-3 text-xs leading-relaxed text-slate-400">
        As faixas são valores gerais de laboratório. O médico interpreta os seus resultados considerando o seu histórico e a sua fase do tratamento.
      </p>
    </Section>
  );
}

// ---------- Próximos passos ----------

export function ProximosPassosSection({
  proximos,
  nextVisit,
  contactLine,
}: {
  proximos: PortalContent["proximosPassos"];
  nextVisit: { date: string | null; label: string };
  contactLine: string;
}) {
  return (
    <Section id="proximos-passos" title="Próximos passos">
      <div className="space-y-3">
        <Card className="flex items-start gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
            <CalendarDays className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Retorno recomendado</p>
            <p className="mt-0.5 text-lg font-semibold text-slate-900">{nextVisit.date ? formatLongDate(nextVisit.date) : `Em cerca de ${nextVisit.label}`}</p>
            {nextVisit.date && <p className="text-sm text-slate-500">em cerca de {nextVisit.label}</p>}
            <p className="mt-2 text-xs text-slate-400">Combine a data com a clínica.</p>
          </div>
        </Card>

        {proximos.examesAntes.length > 0 && (
          <Card>
            <div className="mb-2 flex items-center gap-2 text-slate-500">
              <FlaskConical className="h-4 w-4" />
              <span className="text-xs font-semibold uppercase tracking-wide">Exames para fazer antes do retorno</span>
            </div>
            <ul className="flex flex-wrap gap-2">
              {proximos.examesAntes.map((e, i) => (
                <li key={i} className="rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-700">
                  {e}
                </li>
              ))}
            </ul>
          </Card>
        )}

        {proximos.sinaisDeAlerta.length > 0 && (
          <Card className="border-amber-100 bg-amber-50/40">
            <div className="mb-2 flex items-center gap-2 text-amber-700">
              <AlertTriangle className="h-4 w-4" />
              <span className="text-xs font-semibold uppercase tracking-wide">Procure a clínica antes do retorno se</span>
            </div>
            <ul className="list-disc space-y-1 pl-5 text-[15px] leading-relaxed text-slate-700">
              {proximos.sinaisDeAlerta.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ul>
          </Card>
        )}

        {proximos.observacoes && (
          <Card>
            <p className="text-[15px] leading-relaxed text-slate-700">{proximos.observacoes}</p>
          </Card>
        )}

        <Card className="flex items-start gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
            <Phone className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Dúvidas?</p>
            <p className="mt-0.5 text-[15px] leading-relaxed text-slate-800">{contactLine}</p>
          </div>
        </Card>
      </div>
    </Section>
  );
}
