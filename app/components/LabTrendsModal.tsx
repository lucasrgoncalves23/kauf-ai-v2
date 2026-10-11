"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Sparkles, Square } from "lucide-react";
import type { ClinicalData, Consulta } from "../types/clinical";
import { getPinHeaders } from "../lib/api-client";
import { processStream } from "../utils/stream";
import {
  buildLabSeries,
  refRangeText,
  markerStatus,
  LAB_CATEGORIES,
  type LabSeries,
} from "../lib/labTrends";
import { MarkerChart, STATUS_COLORS, formatValue } from "./charts/MarkerChart";

type LabTrendsModalProps = {
  isOpen: boolean;
  onClose: () => void;
  consultas: Consulta[];
  currentLabText: string;
  currentInputs?: ClinicalData;
  patientName: string;
  patientSex?: string;
  patientAge?: string;
  phase?: string;
};

function useTrendInterpretation(
  allSeries: LabSeries[],
  context: { patientSex?: string; patientAge?: string; phase?: string },
  isOpen: boolean,
) {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const signature = useMemo(
    () => JSON.stringify(allSeries.map((s) => [s.key, s.points.map((p) => p.value)])),
    [allSeries]
  );

  // Stale once the modal closes or the underlying data changes
  useEffect(() => {
    abortRef.current?.abort();
    setText("");
    setError(null);
    setLoading(false);
  }, [signature, isOpen]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const run = async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setText("");
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/interpret-trends", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getPinHeaders() },
        signal: controller.signal,
        body: JSON.stringify({
          ...context,
          series: allSeries.map((s) => ({
            label: s.label,
            unit: s.unit,
            ref: refRangeText(s),
            points: s.points.map((p) => ({ label: p.label, value: p.value })),
          })),
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Erro ${res.status}`);
      }
      await processStream(res, (chunk) => setText((t) => t + chunk), controller.signal);
    } catch (err) {
      if (!(err instanceof Error && err.name === "AbortError")) {
        setError(err instanceof Error ? err.message : "Falha na interpretação");
      }
    } finally {
      if (abortRef.current === controller) setLoading(false);
    }
  };

  const stop = () => {
    abortRef.current?.abort();
    setLoading(false);
  };

  return { text, loading, error, run, stop };
}

function MarkerPanel({ series }: { series: LabSeries }) {
  const latest = series.points[series.points.length - 1];
  const previous = series.points.length > 1 ? series.points[series.points.length - 2] : null;
  const delta = previous ? latest.value - previous.value : null;
  const refText = refRangeText(series);
  const status = markerStatus(latest.value, series);
  const colors = STATUS_COLORS[status];

  return (
    <div className="rounded-xl border border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 p-4">
      <div className="flex items-baseline justify-between mb-1">
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
          {series.label}
        </span>
        {refText && (
          <span className="text-[9px] text-slate-400 dark:text-slate-500">Ref: {refText}</span>
        )}
      </div>
      <div className="flex items-baseline gap-2 mb-3">
        <span className={`text-xl font-semibold ${status === "normal" ? "text-slate-900 dark:text-white" : colors.text}`}>
          {formatValue(latest.value)}
        </span>
        <span className="text-[10px] text-slate-400 dark:text-slate-500">{series.unit}</span>
        {delta !== null && delta !== 0 && (
          <span className="text-[10px] text-slate-500 dark:text-slate-400">
            {delta > 0 ? "+" : "−"}
            {formatValue(Math.abs(delta))} vs anterior
          </span>
        )}
      </div>
      {series.points.length > 1 ? (
        <MarkerChart series={series} />
      ) : (
        <p className="text-[10px] text-slate-400 dark:text-slate-500">
          Registrado em {latest.label} — salve mais consultas para ver a evolução.
        </p>
      )}
    </div>
  );
}

export function LabTrendsModal({
  isOpen,
  onClose,
  consultas,
  currentLabText,
  currentInputs,
  patientName,
  patientSex,
  patientAge,
  phase,
}: LabTrendsModalProps) {
  const allSeries = useMemo(
    () => (isOpen ? buildLabSeries(consultas, currentLabText, currentInputs) : []),
    [isOpen, consultas, currentLabText, currentInputs]
  );
  const ai = useTrendInterpretation(allSeries, { patientSex, patientAge, phase }, isOpen);

  if (!isOpen) return null;

  const seriesMap = new Map(allSeries.map((s) => [s.key, s]));

  const categorized = LAB_CATEGORIES
    .map((cat) => ({
      ...cat,
      series: cat.markers.map((k) => seriesMap.get(k)).filter(Boolean) as LabSeries[],
    }))
    .filter((cat) => cat.series.length > 0);

  const uncategorized = allSeries.filter(
    (s) => !LAB_CATEGORIES.some((cat) => cat.markers.includes(s.key))
  );

  const totalMarkers = allSeries.length;
  const outOfRange = allSeries.filter(
    (s) => markerStatus(s.points[s.points.length - 1].value, s) !== "normal"
  ).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-8">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-5xl max-h-full overflow-y-auto rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-2xl p-6">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-widest text-slate-700 dark:text-slate-200">
              Evolução Laboratorial
            </h2>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
              {patientName || "Paciente"} · {totalMarkers} marcador(es)
              {outOfRange > 0 && (
                <span className="text-amber-500 dark:text-amber-400 ml-1">
                  · {outOfRange} fora da faixa
                </span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {totalMarkers > 0 && (
              <button
                onClick={ai.loading ? ai.stop : ai.run}
                className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold bg-brand-600 hover:bg-brand-700 text-white transition-colors"
              >
                {ai.loading ? <Square className="w-3.5 h-3.5" /> : <Sparkles className="w-3.5 h-3.5" />}
                {ai.loading ? "Parar" : ai.text ? "Reinterpretar" : "Interpretar com IA"}
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              title="Fechar (Esc)"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {(ai.text || ai.loading || ai.error) && (
          <div className="mb-6 rounded-xl border border-brand-100 dark:border-brand-900/40 bg-white dark:bg-slate-800 p-4">
            <div className="flex items-center gap-1.5 mb-2">
              <Sparkles className="w-3.5 h-3.5 text-brand-600 dark:text-brand-400" />
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                Interpretação da Evolução
              </span>
            </div>
            {ai.text && (
              <p className="text-xs leading-relaxed text-slate-700 dark:text-slate-300 whitespace-pre-wrap">{ai.text}</p>
            )}
            {ai.loading && !ai.text && (
              <p className="text-xs text-slate-400 dark:text-slate-500 animate-pulse">Analisando marcadores…</p>
            )}
            {ai.error && <p className="text-xs text-red-600 dark:text-red-400 mt-2">{ai.error}</p>}
            {ai.text && !ai.loading && (
              <p className="text-[9px] text-slate-400 dark:text-slate-500 mt-3">
                Gerado por IA a partir dos valores extraídos — confira os dados antes de usar clinicamente.
              </p>
            )}
          </div>
        )}

        {totalMarkers === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400 py-10 text-center">
            Nenhum marcador laboratorial reconhecido. Importe ou cole exames no campo
            &quot;laboratoriais&quot; e salve consultas para acompanhar a evolução.
          </p>
        ) : (
          <div className="space-y-6">
            {categorized.map((cat) => (
              <div key={cat.key}>
                <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-2">
                  {cat.label}
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {cat.series.map((s) => (
                    <MarkerPanel key={s.key} series={s} />
                  ))}
                </div>
              </div>
            ))}
            {uncategorized.length > 0 && (
              <div>
                <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-2">
                  Outros
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {uncategorized.map((s) => (
                    <MarkerPanel key={s.key} series={s} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
