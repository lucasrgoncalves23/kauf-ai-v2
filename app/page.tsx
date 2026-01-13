"use client";

import { useMemo, useRef, useState } from "react";


type ProgramKey =
  | "Sono"
  | "Nutrição"
  | "Exercício"
  | "Suplementação"
  | "Manipulados"
  | "Soroterapia"
  | "Metabolismo / GLP-1"
  | "Hormonal"
  | "Peptídeos";

const PROGRAMS: ProgramKey[] = [
  "Sono",
  "Nutrição",
  "Exercício",
  "Suplementação",
  "Manipulados",
  "Soroterapia",
  "Metabolismo / GLP-1",
  "Hormonal",
  "Peptídeos",
];

function SectionLabel({ children }: { children: string }) {
  return (
    <div className="text-[11px] tracking-[0.14em] uppercase text-slate-500">
      {children}
    </div>
  );
}

function FieldRow({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-start justify-between gap-4 py-1">
      <div className="text-[11px] tracking-[0.14em] uppercase text-slate-500">
        {k}
      </div>
      <div className="text-[13px] text-slate-900 text-right">{v}</div>
    </div>
  );
}

function StatusRow({
  label,
  status,
  note,
}: {
  label: string;
  status: "ok" | "warn" | "none";
  note?: string;
}) {
  const icon = status === "ok" ? "✓" : status === "warn" ? "!" : "—";
  const color =
    status === "ok"
      ? "text-emerald-600"
      : status === "warn"
      ? "text-amber-600"
      : "text-slate-500";

  return (
    <div className="flex items-center justify-between py-1">
      <div className="text-[12px] text-slate-800">{label}</div>
      <div className="flex items-center gap-2">
        {note ? (
          <div className="text-[11px] text-slate-500 whitespace-nowrap">
            {note}
          </div>
        ) : null}
        <div className={`text-[12px] font-semibold ${color}`}>{icon}</div>
      </div>
    </div>
  );
}

function EditableBlock({
  title,
  value,
  onChange,
}: {
  title: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <section className="pb-6">
      <div className="flex items-end justify-between gap-4">
        <h2 className="text-[15px] font-semibold text-slate-900">{title}</h2>
        <div className="h-px flex-1 bg-slate-200" />
      </div>

      <div className="mt-3 rounded-md border border-slate-200 bg-white">
        <textarea
          className="w-full resize-none bg-transparent p-3 text-[13px] leading-5 text-slate-900 outline-none"
          rows={4}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Digite aqui…"
        />
      </div>
    </section>
  );
}

function ProgramAccordion({
  name,
  open,
  onToggle,
  value,
  onChange,
}: {
  name: ProgramKey;
  open: boolean;
  onToggle: () => void;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="border-b border-slate-200">
      <button
        type="button"
        onClick={onToggle}
        className="w-full px-3 py-3 text-left flex items-center justify-between"
      >
        <div className="text-[13px] font-medium text-slate-900">{name}</div>
        <div className="text-[12px] text-slate-500">{open ? "▾" : "▸"}</div>
      </button>

      {open ? (
        <div className="px-3 pb-4">
          <textarea
            className="w-full resize-none rounded-md border border-slate-200 bg-white p-3 text-[13px] leading-5 text-slate-900 outline-none"
            rows={5}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={`Conteúdo do programa: ${name}`}
          />
        </div>
      ) : null}
    </div>
  );
}

export default function Home() {
  const pdfInputRef = useRef<HTMLInputElement | null>(null);
  function exportPDF() {
  // Opens print dialog; doctor chooses "Save as PDF"
  window.print();
}

  // Left panel mock snapshot
  
  function formatTimeAgo(date: Date) {
  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);

  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;

  const hours = Math.floor(diffMin / 60);
  const minutes = diffMin % 60;

  return minutes === 0 ? `${hours}h ago` : `${hours}h ${minutes}m ago`;
}

  const snapshot = useMemo(
    () => ({
      age: "47",
      sex: "M",
      height: "178 cm",
      weight: "91 kg",
      objective: "Fat loss + energy restoration",
      primaryRisk: "Metabolic rigidity",
      discipline: "7 / 10",
      phase: "B",
    }),
    []
  );

  // Right panel mock alerts/state
  const alerts = useMemo(

    
    () => ["HRV ↓ há 5 dias", "RHR ↑ há 4 dias", "Sleep debt crescente"],
    []
  );

  const [integrativeDx, setIntegrativeDx] = useState("");
  const [primaryBottleneck, setPrimaryBottleneck] = useState("");
  const [activeLayers, setActiveLayers] = useState(
    "Base\nPerformance\nHormonal\nLongevidade"
  );
  const [kpis, setKpis] = useState("30 dias:\n60 dias:\n90 dias:");

  const [openProgram, setOpenProgram] = useState<ProgramKey | null>(null);
  const [programText, setProgramText] = useState<Record<ProgramKey, string>>(
    () =>
      PROGRAMS.reduce((acc, k) => {
        acc[k] = "";
        return acc;
      }, {} as Record<ProgramKey, string>)
  );

const [engineAlerts, setEngineAlerts] = useState<string[]>([]);
const [enginePhase, setEnginePhase] = useState<string>("—");
const [engineBlocked, setEngineBlocked] = useState<
  { module: string; reason: string }[]
>([]);

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-[1400px] px-6 py-6">
        <div className="grid grid-cols-[260px_1fr_280px] gap-6">
          {/* LEFT: Patient Snapshot */}
          <aside className="no-print sticky top-6 h-[calc(100vh-48px)] rounded-lg border border-slate-200 bg-slate-100 p-4">

            <SectionLabel>Patient Snapshot</SectionLabel>

            <div className="mt-3 rounded-md border border-slate-200 bg-white p-3">
              <FieldRow k="Age" v={snapshot.age} />
              <FieldRow k="Sex" v={snapshot.sex} />
              <FieldRow k="Height" v={snapshot.height} />
              <FieldRow k="Weight" v={snapshot.weight} />
              <div className="mt-3 border-t border-slate-200 pt-3" />
              <div className="text-[11px] tracking-[0.14em] uppercase text-slate-500">
                Objective
              </div>
              <div className="mt-1 text-[13px] text-slate-900">
                {snapshot.objective}
              </div>

              <div className="mt-3 text-[11px] tracking-[0.14em] uppercase text-slate-500">
                Primary Biological Risk
              </div>
              <div className="mt-1 text-[13px] text-slate-900">
                {snapshot.primaryRisk}
              </div>

              <div className="mt-3 border-t border-slate-200 pt-3" />
              <FieldRow k="Discipline" v={snapshot.discipline} />
              <FieldRow k="Active Phase" v={snapshot.phase} />
            </div>

            <div className="mt-6">
              <SectionLabel>Data Status</SectionLabel>
              <div className="mt-3 rounded-md border border-slate-200 bg-white p-3">
                <StatusRow label="Labs" status="ok" />
                <StatusRow label="Bioimpedance" status="ok" />
                <StatusRow
                  label="Wearable"
                  status="warn"
                  note="last sync 3d"
                />
                <StatusRow label="Genetics" status="none" />
              </div>
            </div>
          </aside>

          {/* CENTER: Cognition Core */}
         <main className="print-report rounded-lg border border-slate-200 bg-white">

    <div className="border-b border-slate-200 px-6 py-5 grid grid-cols-[1fr_auto_1fr] items-center">
  {/* IMPORT (left) */}
 <div className="no-print flex items-center gap-3">
  <input
    ref={pdfInputRef}
    type="file"
    accept="application/pdf"
    className="hidden"
    onChange={async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;

  try {
    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch("/api/import-pdf", {
      method: "POST",
      body: formData,
    });

    const raw = await res.text();


    if (!res.ok) {
      alert("Import failed. Raw response is in console.");
      return;
    }

    let data: any;
    try {
      data = JSON.parse(raw);
    } catch {
      alert("Import returned non-JSON. Raw response is in console.");
      return;
    }

    console.log("Extracted text length:", (data?.text || "").length);
    // For now, keep your alert:
    alert("✅ PDF imported. Text length logged in console.");
  } catch (err) {
    console.error("IMPORT-PDF client error:", err);
    alert("Import crashed. Check console.");
  } finally {
    // Safari-safe reset (do NOT use currentTarget)
    e.target.value = "";
  }
}}

  />

  <button
    type="button"
    onClick={() => pdfInputRef.current?.click()}
    className="rounded-md border border-slate-300 bg-white px-4 py-2 text-[12px] font-semibold text-slate-900 hover:bg-slate-50"
  >
    Import Data
  </button>
</div>



  {/* CENTER TITLE */}
  <div className="text-center">
    <div className="text-[18px] font-semibold text-slate-900">
      Kauf AI
    </div>
  </div>

  {/* EXPORT (right) */}
  <div className="no-print flex justify-end">
    <button
      type="button"
      onClick={exportPDF}
      className="rounded-md border border-slate-300 bg-white px-4 py-2 text-[12px] font-semibold text-slate-900 hover:bg-slate-50"
    >
      Export PDF
    </button>
  </div>
</div>




            <div className="px-6 py-6">
              <EditableBlock
                title="Diagnóstico Integrativo"
                value={integrativeDx}
                onChange={setIntegrativeDx}
              />

              <EditableBlock
                title="Gargalo Primário"
                value={primaryBottleneck}
                onChange={setPrimaryBottleneck}
              />

              <EditableBlock
                title="Camadas Ativas"
                value={activeLayers}
                onChange={setActiveLayers}
              />

              <section className="pb-6">
                <div className="flex items-end justify-between gap-4">
                  <h2 className="text-[15px] font-semibold text-slate-900">
                    Programas
                  </h2>
                  <div className="h-px flex-1 bg-slate-200" />
                </div>

                <div className="mt-3 overflow-hidden rounded-md border border-slate-200 bg-white">
                  {PROGRAMS.map((p) => (
                    <ProgramAccordion
                      key={p}
                      name={p}
                      open={openProgram === p}
                      onToggle={() => setOpenProgram(openProgram === p ? null : p)}
                      value={programText[p]}
                      onChange={(v) =>
                        setProgramText((prev) => ({ ...prev, [p]: v }))
                      }
                    />
                  ))}
                </div>
              </section>

              <EditableBlock
                title="KPIs + Checkpoints (30 / 60 / 90 dias)"
                value={kpis}
                onChange={setKpis}
              />
            </div>
          </main>

       {/* RIGHT: System Status */}
<aside className="no-print sticky top-6 h-[calc(100vh-48px)] rounded-lg border border-slate-200 bg-slate-100 p-4 text-sm">
  <h3 className="font-semibold mb-4 text-slate-700">System Alerts</h3>

  {engineAlerts.length === 0 && (
    <div className="text-slate-500 mb-6">No active alerts.</div>
  )}

  {engineAlerts.map((a, i) => (
    <div key={i} className="mb-2 text-slate-700">
      • {a}
    </div>
  ))}

  <div className="mt-8">
    <h3 className="font-semibold mb-2 text-slate-700">Engine State</h3>
    <div className="mb-2 text-slate-600">Current phase: {enginePhase}</div>

    {engineBlocked.length === 0 && (
      <div className="text-slate-500">No modules blocked.</div>
    )}

    {engineBlocked.map((b, i) => (
      <div key={i} className="mb-2 text-slate-700">
        Phase blocked: <span className="font-medium">{b.module}</span>
        <div className="text-slate-500 text-xs">Reason: {b.reason}</div>
      </div>
    ))}
  </div>
</aside>

        </div>
      </div>
    </div>
  );
}

