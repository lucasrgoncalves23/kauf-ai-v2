"use client";

import type { PatientProfile } from "../types/clinical";
import { isValidSex } from "../lib/extraction";
import { isValidCpf } from "../lib/cpf";
import { SectionLabel } from "./ui/SectionLabel";

type PatientSnapshotProps = {
  profile: PatientProfile;
  onProfileChange: (profile: PatientProfile) => void;
};

const inputClass =
  "w-full bg-white/50 dark:bg-slate-700/50 rounded-lg border border-slate-200 dark:border-slate-600 font-medium outline-none focus:ring-2 focus:ring-brand-100 dark:focus:ring-brand-900 focus:border-brand-300 dark:focus:border-brand-700 transition-all dark:text-white px-3 py-2.5 text-sm compact:px-2 compact:py-1.5 compact:text-xs";

const labelClass =
  "block text-[10px] uppercase tracking-wide text-slate-400 dark:text-slate-500 mb-1 font-semibold";

function ageFromBirthDate(raw: string, today: Date = new Date()): string | null {
  const m = raw.trim().match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2}|\d{4})$/);
  if (!m) return null;
  const day = Number(m[1]);
  const month = Number(m[2]);
  let year = Number(m[3]);
  if (m[3].length === 2) year += year > today.getFullYear() % 100 ? 1900 : 2000;
  const birth = new Date(year, month - 1, day);
  if (birth.getFullYear() !== year || birth.getMonth() !== month - 1 || birth.getDate() !== day) return null;
  if (birth > today) return null;
  let age = today.getFullYear() - year;
  const monthDiff = today.getMonth() - (month - 1);
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < day)) age--;
  return String(age);
}

export function PatientSnapshot({ profile, onProfileChange }: PatientSnapshotProps) {
  const derivedAge = ageFromBirthDate(profile.birthDate);

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
            <label className={labelClass}>Data Nasc.</label>
            <input
              className={inputClass}
              placeholder="DD/MM/AAAA"
              value={profile.birthDate}
              onChange={(e) => {
                const birthDate = e.target.value;
                onProfileChange({ ...profile, birthDate, age: ageFromBirthDate(birthDate) ?? "" });
              }}
            />
          </div>
          <div>
            <label className={labelClass}>Sexo</label>
            <select
              className={inputClass}
              value={isValidSex(profile.sex) ? profile.sex : ""}
              onChange={(e) => onProfileChange({ ...profile, sex: e.target.value })}
            >
              <option value="">— Selecionar —</option>
              <option value="Masculino">Masculino</option>
              <option value="Feminino">Feminino</option>
            </select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 compact:gap-2">
          <div>
            <label className={labelClass}>Idade</label>
            <input
              className={`${inputClass} bg-slate-100/60 dark:bg-slate-800/60 cursor-not-allowed text-slate-500 dark:text-slate-400`}
              placeholder="--"
              value={derivedAge ?? profile.age}
              readOnly
              tabIndex={-1}
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
            {profile.cpf.trim() && !isValidCpf(profile.cpf) && (
              <p className="mt-1 text-[10px] text-amber-600 dark:text-amber-400">CPF inválido</p>
            )}
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
