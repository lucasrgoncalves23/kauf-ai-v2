"use client";

import { useState, useEffect } from "react";
import type { PatientProfile, ClinicalOutputs } from "../types/clinical";

type MedicalReportPrintProps = {
  profile: PatientProfile;
  outputs: ClinicalOutputs;
  patientVersion: string | null;
  prescriptionVersion: string | null;
};

export function MedicalReportPrint({
  profile,
  outputs,
  patientVersion,
  prescriptionVersion,
}: MedicalReportPrintProps) {
  const [dateStr, setDateStr] = useState("");
  const [reportId, setReportId] = useState("");

  useEffect(() => {
    setDateStr(
      new Date().toLocaleDateString("pt-BR", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    );
    setReportId(Math.random().toString(36).slice(2, 8).toUpperCase());
  }, []);

  // Prescription version
  if (prescriptionVersion) {
    return (
      <div className="hidden print:block bg-white text-black p-10 max-w-[210mm] mx-auto min-h-screen">
        <div className="text-center border-b-2 border-slate-300 pb-6 mb-8">
          <h1 className="text-2xl font-bold text-slate-900 tracking-wide">RECEITUÁRIO</h1>
          <p className="text-sm text-slate-500 mt-1">Kauf - Medicina Integrativa</p>
        </div>

        <div className="text-sm leading-relaxed text-slate-800 whitespace-pre-wrap font-mono">
          {prescriptionVersion}
        </div>

        <div className="mt-16 pt-6 border-t border-slate-200 text-center break-inside-avoid">
          <p className="text-[10px] text-slate-400">Documento gerado em {dateStr}</p>
        </div>
      </div>
    );
  }

  // Patient-friendly version
  if (patientVersion) {
    return (
      <div className="hidden print:block bg-white text-black p-10 max-w-[210mm] mx-auto min-h-screen">
        <div className="flex justify-between items-end border-b-2 border-teal-500 pb-4 mb-10">
          <div>
            <h1 className="text-3xl font-serif font-bold text-teal-800 tracking-tight">
              Seu Plano de Saúde
            </h1>
            <p className="text-sm text-teal-600 mt-1 font-medium">Kauf - Medicina Integrativa</p>
          </div>
          <div className="text-right">
            <p className="text-sm font-bold text-slate-900">{dateStr}</p>
          </div>
        </div>

        <div className="bg-teal-50 border border-teal-100 rounded-lg p-6 mb-10">
          <span className="block text-xl font-serif font-medium text-teal-900">
            {profile.name || "Paciente"}
          </span>
        </div>

        <div
          className="text-sm leading-relaxed text-slate-800 whitespace-pre-wrap"
          style={{ fontFamily: "Georgia, serif" }}
        >
          {patientVersion}
        </div>

        <div className="mt-20 pt-8 border-t border-teal-200 text-center break-inside-avoid">
          <p className="text-[10px] text-slate-400 italic">
            Este documento foi preparado especialmente para você. Guarde-o e traga suas dúvidas na
            próxima consulta.
          </p>
        </div>
      </div>
    );
  }

  // Clinical version (original)
  return (
    <div className="hidden print:block bg-white text-black p-10 max-w-[210mm] mx-auto min-h-screen">
      {/* HEADER */}
      <div className="flex justify-between items-end border-b-2 border-slate-900 pb-4 mb-10">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/ik-logo.png" alt="Instituto Kaufmann" className="h-24 w-auto" />
        <div className="text-right">
          <p className="text-sm font-bold text-slate-900">{dateStr}</p>
          <p className="text-xs text-slate-500">ID: {reportId}</p>
        </div>
      </div>

      {/* PATIENT INFO */}
      <div className="bg-slate-50 border border-slate-200 rounded-lg p-6 mb-12 grid grid-cols-2 gap-8 break-inside-avoid">
        <div>
          <span className="block text-[10px] uppercase tracking-wider text-slate-400 mb-1">
            Paciente
          </span>
          <span className="block text-xl font-serif font-medium text-slate-900">
            {profile.name || "Paciente Não Identificado"}
          </span>
        </div>
        <div className="flex gap-12">
          <div>
            <span className="block text-[10px] uppercase tracking-wider text-slate-400 mb-1">
              Idade
            </span>
            <span className="block text-lg font-medium text-slate-800">
              {profile.age || "--"} anos
            </span>
          </div>
          <div>
            <span className="block text-[10px] uppercase tracking-wider text-slate-400 mb-1">
              Sexo
            </span>
            <span className="block text-lg font-medium text-slate-800 capitalize">
              {profile.sex || "--"}
            </span>
          </div>
        </div>
      </div>

      {/* SECTION 1: ANÁLISE */}
      <div className="mb-12">
        <h2 className="text-lg font-bold text-emerald-800 uppercase tracking-widest border-b border-emerald-100 pb-2 mb-6 break-after-avoid">
          1. Análise Clínica & Metabólica
        </h2>
        <div className="text-sm leading-relaxed text-justify text-slate-800 whitespace-pre-wrap font-serif">
          {outputs.analise || "Análise pendente..."}
        </div>
      </div>

      {/* SECTION 2: CONDUTA */}
      <div>
        <h2 className="text-lg font-bold text-indigo-800 uppercase tracking-widest border-b border-indigo-100 pb-2 mb-6 break-after-avoid">
          2. Conduta Terapêutica & Planejamento
        </h2>
        <div className="text-sm leading-relaxed text-justify text-slate-800 whitespace-pre-wrap font-serif">
          {outputs.conduta || "Conduta pendente..."}
        </div>
      </div>

      {/* SECTION 3: RECEITA (only if generated) */}
      {outputs.receita && (
        <div>
          <h2 className="text-lg font-bold text-rose-800 uppercase tracking-widest border-b border-rose-100 pb-2 mb-6 break-after-avoid">
            3. Receita Médica
          </h2>
          <div className="text-sm leading-relaxed text-slate-800 whitespace-pre-wrap font-mono">
            {outputs.receita}
          </div>
        </div>
      )}

      <div className="mt-20 pt-8 border-t border-slate-200 text-center break-inside-avoid">
        <p className="text-[10px] text-slate-400 italic">
          Relatório gerado por inteligência artificial (KAUAI v2.0). Documento para uso exclusivo
          médico.
        </p>
      </div>
    </div>
  );
}
