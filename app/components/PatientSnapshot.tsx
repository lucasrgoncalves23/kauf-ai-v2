"use client";

import type { PatientProfile } from "../types/clinical";
import { SectionLabel } from "./ui/SectionLabel";

type PatientSnapshotProps = {
  profile: PatientProfile;
  onProfileChange: (profile: PatientProfile) => void;
  compact?: boolean;
};

export function PatientSnapshot({ profile, onProfileChange, compact = false }: PatientSnapshotProps) {
  const inputClass = `w-full bg-white/50 dark:bg-slate-700/50 rounded-lg border border-slate-200 dark:border-slate-600 font-medium outline-none focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900 transition-all dark:text-white ${
    compact ? "px-2 py-1.5 text-xs" : "px-3 py-2.5"
  }`;

  return (
    <>
      <SectionLabel>Patient Snapshot</SectionLabel>
      <div className={`text-sm ${compact ? "space-y-2" : "space-y-4"}`}>
        <div className="group">
          <label className="block text-[10px] uppercase text-slate-400 dark:text-slate-500 mb-1 font-bold">
            Nome
          </label>
          <input
            className={inputClass}
            placeholder="Ex: João Silva"
            value={profile.name}
            onChange={(e) => onProfileChange({ ...profile, name: e.target.value })}
          />
        </div>
        <div className={`grid grid-cols-2 ${compact ? "gap-2" : "gap-3"}`}>
          <div>
            <label className="block text-[10px] uppercase text-slate-400 dark:text-slate-500 mb-1 font-bold">
              Idade
            </label>
            <input
              className={inputClass}
              placeholder="--"
              value={profile.age}
              onChange={(e) => onProfileChange({ ...profile, age: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-[10px] uppercase text-slate-400 dark:text-slate-500 mb-1 font-bold">
              Sexo
            </label>
            <input
              className={`${inputClass} capitalize`}
              placeholder="--"
              value={profile.sex}
              onChange={(e) => onProfileChange({ ...profile, sex: e.target.value })}
            />
          </div>
        </div>
        <div className={`grid grid-cols-2 ${compact ? "gap-2" : "gap-3"}`}>
          <div>
            <label className="block text-[10px] uppercase text-slate-400 dark:text-slate-500 mb-1 font-bold">
              Data Nasc.
            </label>
            <input
              className={inputClass}
              placeholder="DD/MM/AAAA"
              value={profile.birthDate}
              onChange={(e) => onProfileChange({ ...profile, birthDate: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-[10px] uppercase text-slate-400 dark:text-slate-500 mb-1 font-bold">
              CPF
            </label>
            <input
              className={inputClass}
              placeholder="000.000.000-00"
              value={profile.cpf}
              onChange={(e) => onProfileChange({ ...profile, cpf: e.target.value })}
            />
          </div>
        </div>
        <div className="group">
          <label className="block text-[10px] uppercase text-slate-400 dark:text-slate-500 mb-1 font-bold">
            WhatsApp
          </label>
          <input
            className={inputClass}
            placeholder="+55 11 99999-8888"
            value={profile.phone ?? ""}
            onChange={(e) => onProfileChange({ ...profile, phone: e.target.value })}
          />
        </div>
      </div>
    </>
  );
}
