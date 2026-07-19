"use client";

import { useMemo, useState } from "react";
import type { Consulta } from "../types/clinical";
import { buildLabSeries, refRangeText, type LabSeries } from "../lib/labTrends";

type LabTrendsModalProps = {
  isOpen: boolean;
  onClose: () => void;
  consultas: Consulta[];
  currentLabText: string;
  patientName: string;
};

// Chart geometry (viewBox units)
const W = 280;
const H = 120;
const PAD_X = 10;
const PAD_TOP = 12;
const PAD_BOTTOM = 24;

function formatValue(v: number): string {
  return v % 1 === 0 ? String(v) : v.toFixed(v < 10 ? 2 : 1).replace(/\.?0+$/, "");
}

function MarkerChart({ series }: { series: LabSeries }) {
  const [hovered, setHovered] = useState<number | null>(null);

  const { points } = series;
  const values = points.map((p) => p.value);

  // Scale domain: data plus reference bounds, padded
  let lo = Math.min(...values, series.refMin ?? Infinity, series.refMax ?? Infinity);
  let hi = Math.max(...values, series.refMin ?? -Infinity, series.refMax ?? -Infinity);
  if (lo === hi) {
    lo -= Math.max(1, Math.abs(lo) * 0.1);
    hi += Math.max(1, Math.abs(hi) * 0.1);
  }
  const range = hi - lo;
  lo -= range * 0.08;
  hi += range * 0.08;

  const plotW = W - PAD_X * 2;
  const plotH = H - PAD_TOP - PAD_BOTTOM;
  const x = (i: number) =>
    points.length === 1 ? PAD_X + plotW / 2 : PAD_X + (i / (points.length - 1)) * plotW;
  const y = (v: number) => PAD_TOP + plotH - ((v - lo) / (hi - lo)) * plotH;

  const path = points.map((p, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(p.value)}`).join(" ");

  // Reference band (clamped to plot area)
  const bandTop = y(Math.min(series.refMax ?? hi, hi));
  const bandBottom = y(Math.max(series.refMin ?? lo, lo));
  const hasBand = series.refMin !== undefined || series.refMax !== undefined;

  const hoveredPoint = hovered !== null ? points[hovered] : null;

  return (
    <div className="relative">
      {/* Hover readout (fixed slot so the layout never jumps) */}
      <div className="absolute -top-5 right-0 text-[10px] text-slate-500 dark:text-slate-400 h-4">
        {hoveredPoint && (
          <span>
            {hoveredPoint.label} · {formatValue(hoveredPoint.value)} {series.unit}
          </span>
        )}
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label={series.label}>
        {/* Reference range band — recessive wash */}
        {hasBand && bandBottom > bandTop && (
          <rect
            x={PAD_X}
            y={bandTop}
            width={plotW}
            height={bandBottom - bandTop}
            className="fill-slate-500/10 dark:fill-slate-400/10"
          />
        )}

        {/* Hairline gridlines: top / bottom of plot */}
        <line x1={PAD_X} y1={PAD_TOP} x2={W - PAD_X} y2={PAD_TOP} strokeWidth="1" className="stroke-slate-200 dark:stroke-slate-700" />
        <line x1={PAD_X} y1={PAD_TOP + plotH} x2={W - PAD_X} y2={PAD_TOP + plotH} strokeWidth="1" className="stroke-slate-300 dark:stroke-slate-600" />

        {/* Y extremes (muted) */}
        <text x={PAD_X} y={PAD_TOP - 3} fontSize="8" className="fill-slate-400 dark:fill-slate-500">
          {formatValue(hi)}
        </text>
        <text x={PAD_X} y={PAD_TOP + plotH + 9} fontSize="8" className="fill-slate-400 dark:fill-slate-500">
          {formatValue(lo)}
        </text>

        {/* Series line */}
        {points.length > 1 && (
          <path d={path} fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="stroke-[#2a78d6] dark:stroke-[#3987e5]" />
        )}

        {/* Dots with surface ring */}
        {points.map((p, i) => (
          <g key={i}>
            <circle
              cx={x(i)}
              cy={y(p.value)}
              r="4"
              strokeWidth="2"
              className="fill-[#2a78d6] dark:fill-[#3987e5] stroke-white dark:stroke-slate-800"
            />
            {/* Oversized invisible hit target */}
            <circle
              cx={x(i)}
              cy={y(p.value)}
              r="11"
              fill="transparent"
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
            />
          </g>
        ))}

        {/* X labels: first and last */}
        <text x={PAD_X} y={H - 6} fontSize="8" className="fill-slate-400 dark:fill-slate-500">
          {points[0].label}
        </text>
        {points.length > 1 && (
          <text x={W - PAD_X} y={H - 6} fontSize="8" textAnchor="end" className="fill-slate-400 dark:fill-slate-500">
            {points[points.length - 1].label}
          </text>
        )}
      </svg>
    </div>
  );
}

function MarkerPanel({ series }: { series: LabSeries }) {
  const latest = series.points[series.points.length - 1];
  const previous = series.points.length > 1 ? series.points[series.points.length - 2] : null;
  const delta = previous ? latest.value - previous.value : null;
  const refText = refRangeText(series);

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
        <span className="text-xl font-semibold text-slate-900 dark:text-white">
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
  patientName,
}: LabTrendsModalProps) {
  const allSeries = useMemo(
    () => (isOpen ? buildLabSeries(consultas, currentLabText) : []),
    [isOpen, consultas, currentLabText]
  );

  if (!isOpen) return null;

  const charted = allSeries.filter((s) => s.points.length > 1);
  const single = allSeries.filter((s) => s.points.length === 1);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-8">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-4xl max-h-full overflow-y-auto rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-2xl p-6">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-widest text-slate-700 dark:text-slate-200">
              Evolução Laboratorial
            </h2>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
              {patientName || "Paciente"} · {allSeries.length} marcador(es) identificado(s)
            </p>
          </div>
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

        {allSeries.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400 py-10 text-center">
            Nenhum marcador laboratorial reconhecido. Importe ou cole exames no campo
            &quot;laboratoriais&quot; e salve consultas para acompanhar a evolução.
          </p>
        ) : (
          <>
            {charted.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
                {charted.map((s) => (
                  <MarkerPanel key={s.key} series={s} />
                ))}
              </div>
            )}
            {single.length > 0 && (
              <>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-2">
                  Registro único (sem histórico ainda)
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                  {single.map((s) => (
                    <MarkerPanel key={s.key} series={s} />
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
