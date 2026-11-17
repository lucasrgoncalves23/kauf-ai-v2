"use client";

import type { PatientProfile } from "../types/clinical";
import { isValidSex } from "../lib/extraction";
import { isValidCpf } from "../lib/cpf";
import { crmPhone } from "../lib/crmPayload";
import { ageFromBirthDate, maskBirthDate } from "../lib/birthDate";
import { SectionLabel } from "./ui/SectionLabel";

type PatientSnapshotProps = {
  profile: PatientProfile;
  onProfileChange: (profile: PatientProfile) => void;
};

const inputClass =
  "w-full bg-white/50 dark:bg-slate-700/50 rounded-lg border border-slate-200 dark:border-slate-600 font-medium outline-none focus:ring-2 focus:ring-brand-100 dark:focus:ring-brand-900 focus:border-brand-300 dark:focus:border-brand-700 transition-all dark:text-white px-3 py-2.5 text-sm compact:px-2 compact:py-1.5 compact:text-xs";

const labelClass =
  "block text-[10px] uppercase tracking-wide text-slate-400 dark:text-slate-500 mb-1 font-semibold";

const SEX_OPTIONS = ["Feminino", "Masculino"] as const;

/** Seletor de dois botões. Tocar na opção já escolhida limpa o campo. */
function SexToggle({ value, onChange }: { value: string; onChange: (sex: string) => void }) {
  return (
    <div className="grid grid-cols-2 gap-1 rounded-lg border border-slate-200 dark:border-slate-600 bg-white/50 dark:bg-slate-700/50 p-1">
      {SEX_OPTIONS.map((option) => {
        const active = value === option;
        return (
          <button
            key={option}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(active ? "" : option)}
            className={`rounded-md px-2 py-1.5 text-xs font-medium transition-all outline-none focus-visible:ring-2 focus-visible:ring-brand-300 compact:py-1 ${
              active
                ? "bg-brand-600 text-white shadow-sm"
                : "text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-600/60 hover:text-slate-700 dark:hover:text-slate-200"
            }`}
          >
            {option}
          </button>
        );
      })}
    </div>
  );
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
              inputMode="numeric"
              maxLength={10}
              value={profile.birthDate}
              onChange={(e) => {
                const birthDate = maskBirthDate(e.target.value, profile.birthDate);
                onProfileChange({ ...profile, birthDate, age: ageFromBirthDate(birthDate) ?? "" });
              }}
            />
          </div>
          <div>
            <label className={labelClass}>Sexo</label>
            <SexToggle
              value={isValidSex(profile.sex) ? profile.sex : ""}
              onChange={(sex) => onProfileChange({ ...profile, sex })}
            />
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
          {!profile.phone?.trim() ? (
            <p className="mt-1 text-[10px] text-amber-600 dark:text-amber-400">
              Sem WhatsApp o paciente não aparece no CRM
            </p>
          ) : !crmPhone(profile.phone) ? (
            <p className="mt-1 text-[10px] text-amber-600 dark:text-amber-400">
              Celular incompleto: DDD + 9 dígitos
            </p>
          ) : null}
        </div>
      </div>
    </>
  );
}
