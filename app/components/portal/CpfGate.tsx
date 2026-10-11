"use client";

import { useState } from "react";
import { formatCpf, isValidCpf, normalizeCpf } from "../../lib/cpf";

type CpfGateProps = {
  onSubmit: (cpfDigits: string) => Promise<void>;
  loading: boolean;
  error: string | null;
};

export function CpfGate({ onSubmit, loading, error }: CpfGateProps) {
  const [value, setValue] = useState("");
  const digits = normalizeCpf(value);
  const complete = digits.length === 11;
  const valid = isValidCpf(digits);
  const showInvalid = complete && !valid;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid || loading) return;
    await onSubmit(digits);
  };

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-6 py-10">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/ik-logo.png" alt="Instituto Kaufmann" className="mx-auto mb-8 h-10 w-auto" />
      <h1 className="text-center text-2xl font-semibold tracking-tight">Olá! Vamos ver o seu plano.</h1>
      <p className="mt-2 text-center text-sm text-slate-500">
        Para proteger as suas informações, confirme o seu CPF.
      </p>

      <form onSubmit={submit} className="mt-8 space-y-4">
        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">CPF</span>
          <input
            type="text"
            inputMode="numeric"
            autoComplete="off"
            autoFocus
            placeholder="000.000.000-00"
            value={value}
            onChange={(e) => setValue(formatCpf(e.target.value))}
            disabled={loading}
            aria-invalid={showInvalid || Boolean(error)}
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3.5 text-lg tracking-wider outline-none transition focus:border-brand-400 focus:ring-4 focus:ring-brand-100 disabled:opacity-60"
          />
        </label>

        {showInvalid && <p className="text-sm text-amber-600">Este CPF parece incompleto ou digitado errado.</p>}
        {error && (
          <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={!valid || loading}
          className="w-full rounded-xl bg-brand-600 px-4 py-3.5 text-base font-semibold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          {loading ? "Verificando…" : "Acessar meu plano"}
        </button>

        <p className="text-center text-xs leading-relaxed text-slate-400">
          Ao continuar, confirmo que sou o paciente ou seu responsável legal. O acesso é registrado para a sua
          segurança.
        </p>
      </form>
    </main>
  );
}
