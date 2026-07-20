"use client";

import type { PatientProfile } from "../types/clinical";
import { SectionLabel } from "./ui/SectionLabel";

type PatientSnapshotProps = {
  profile: PatientProfile;
  onProfileChange: (profile: PatientProfile) => void;
};

const inputClass =
  "w-full bg-white/50 dark:bg-slate-700/50 rounded-lg border border-slate-200 dark:border-slate-600 font-medium outline-none focus:ring-2 focus:ring-brand-100 dark:focus:ring-brand-900 focus:border-brand-300 dark:focus:border-brand-700 transition-all dark:text-white px-3 py-2.5 text-sm compact:px-2 compact:py-1.5 compact:text-xs";

const labelClass =
  "block text-[10px] uppercase tracking-wide text-slate-400 dark:text-slate-500 mb-1 font-semibold";

export function PatientSnapshot({ profile, onProfileChange }: PatientSnapshotProps) {
  return (
    <>
      <SectionLabel>Paciente</SectionLabel>
      <div className="text-sm space-y-4 compact:space-y-2">
        <div className="group">
          <label className={labelClass}>Nome</label>
          <input
            className={inputClass}
            placeholder="Ex: João Silva"
            value={profile.name}
            onChange={(e) => onProfileChange({ ...profile, name: e.target.value })}
          />
        </div>
        <div className="grid grid-cols-2 gap-3 compact:gap-2">
          <div>
            <label className={labelClass}>Idade</label>
            <input
              className={inputClass}
              placeholder="--"
              value={profile.age}
              onChange={(e) => onProfileChange({ ...profile, age: e.target.value })}
            />
          </div>
          <div>
            <label className={labelClass}>Sexo</label>
            <input
              className={`${inputClass} capitalize`}
              placeholder="--"
              value={profile.sex}
              onChange={(e) => onProfileChange({ ...profile, sex: e.target.value })}
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 compact:gap-2">
          <div>
            <label className={labelClass}>Data Nasc.</label>
            <input
              className={inputClass}
              placeholder="DD/MM/AAAA"
              value={profile.birthDate}
              onChange={(e) => onProfileChange({ ...profile, birthDate: e.target.value })}
            />
          </div>
          <div>
            <label className={labelClass}>CPF</label>
            <input
              className={inputClass}
              placeholder="000.000.000-00"
              value={profile.cpf}
              onChange={(e) => onProfileChange({ ...profile, cpf: e.target.value })}
            />
          </div>
        </div>
        <div className="group">
          <label className={labelClass}>WhatsApp</label>
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
