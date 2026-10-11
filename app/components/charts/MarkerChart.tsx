"use client";

import { useState } from "react";
import { markerStatus, type LabPoint, type MarkerStatus } from "../../lib/labTrends";

export type MarkerChartSeries = {
  label: string;
  unit: string;
  refMin?: number;
  refMax?: number;
  points: LabPoint[];
};

// Chart geometry (viewBox units)
const W = 280;
const H = 120;
const PAD_X = 10;
const PAD_TOP = 12;
const PAD_BOTTOM = 24;

export const STATUS_COLORS: Record<MarkerStatus, { dot: string; line: string; text: string }> = {
  normal: {
    dot: "fill-emerald-500 dark:fill-emerald-400 stroke-white dark:stroke-slate-800",
    line: "stroke-emerald-500 dark:stroke-emerald-400",
    text: "text-emerald-600 dark:text-emerald-400",
  },
  warning: {
    dot: "fill-amber-500 dark:fill-amber-400 stroke-white dark:stroke-slate-800",
    line: "stroke-amber-500 dark:stroke-amber-400",
    text: "text-amber-600 dark:text-amber-400",
  },
  critical: {
    dot: "fill-red-500 dark:fill-red-400 stroke-white dark:stroke-slate-800",
    line: "stroke-red-500 dark:stroke-red-400",
    text: "text-red-600 dark:text-red-400",
  },
};

export function formatValue(v: number): string {
  return v % 1 === 0 ? String(v) : v.toFixed(v < 10 ? 2 : 1).replace(/\.?0+$/, "");
}

export function MarkerChart({ series }: { series: MarkerChartSeries }) {
  const [hovered, setHovered] = useState<number | null>(null);

  const { points } = series;
  const values = points.map((p) => p.value);

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

  const bandTop = y(Math.min(series.refMax ?? hi, hi));
  const bandBottom = y(Math.max(series.refMin ?? lo, lo));
  const hasBand = series.refMin !== undefined || series.refMax !== undefined;

  const hoveredPoint = hovered !== null ? points[hovered] : null;
  const latestStatus = markerStatus(points[points.length - 1].value, series);
  const colors = STATUS_COLORS[latestStatus];

  return (
    <div className="relative">
      <div className="absolute -top-5 right-0 text-[10px] text-slate-500 dark:text-slate-400 h-4">
        {hoveredPoint && (
          <span>
            {hoveredPoint.label} · {formatValue(hoveredPoint.value)} {series.unit}
          </span>
        )}
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label={series.label}>
        {hasBand && bandBottom > bandTop && (
          <rect
            x={PAD_X}
            y={bandTop}
            width={plotW}
            height={bandBottom - bandTop}
            className="fill-emerald-500/8 dark:fill-emerald-400/8"
          />
        )}

        <line x1={PAD_X} y1={PAD_TOP} x2={W - PAD_X} y2={PAD_TOP} strokeWidth="1" className="stroke-slate-200 dark:stroke-slate-700" />
        <line x1={PAD_X} y1={PAD_TOP + plotH} x2={W - PAD_X} y2={PAD_TOP + plotH} strokeWidth="1" className="stroke-slate-300 dark:stroke-slate-600" />

        <text x={PAD_X} y={PAD_TOP - 3} fontSize="8" className="fill-slate-400 dark:fill-slate-500">
          {formatValue(hi)}
        </text>
        <text x={PAD_X} y={PAD_TOP + plotH + 9} fontSize="8" className="fill-slate-400 dark:fill-slate-500">
          {formatValue(lo)}
        </text>

        {points.length > 1 && (
          <path d={path} fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={colors.line} />
        )}

        {points.map((p, i) => {
          const ptColors = STATUS_COLORS[markerStatus(p.value, series)];
          return (
            <g key={i}>
              <circle cx={x(i)} cy={y(p.value)} r="4" strokeWidth="2" className={ptColors.dot} />
              <circle
                cx={x(i)}
                cy={y(p.value)}
                r="11"
                fill="transparent"
                onMouseEnter={() => setHovered(i)}
                onMouseLeave={() => setHovered(null)}
              />
            </g>
          );
        })}

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
