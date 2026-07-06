"use client";

import { useState, useRef, useEffect } from "react";

type PinLoginProps = {
  onSuccess: () => void;
};

export function PinLogin({ onSuccess }: PinLoginProps) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pin.trim()) return;

    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/verify-pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin: pin.trim() }),
      });

      const data = await res.json();

      if (data.valid) {
        // Store PIN so API calls include it
        localStorage.setItem("kai-clinic-pin", pin.trim());
        sessionStorage.setItem("kai-authenticated", "true");
        onSuccess();
      } else {
        setError(data.error || "PIN incorreto");
        setPin("");
        inputRef.current?.focus();
      }
    } catch {
      setError("Erro de conexao com o servidor");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white dark:bg-slate-900 flex items-center justify-center">
      <div className="w-full max-w-xs">
        <div className="text-center mb-10 flex justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/ik-logo.png"
            alt="Instituto Kaufmann"
            className="h-16 w-auto block dark:hidden"
          />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/ik-logo-white.png"
            alt="Instituto Kaufmann"
            className="h-16 w-auto hidden dark:block"
          />
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <input
              ref={inputRef}
              type="password"
              inputMode="numeric"
              placeholder="Digite o PIN"
              value={pin}
              onChange={(e) => { setPin(e.target.value); setError(""); }}
              className="w-full text-center text-lg tracking-[0.5em] px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent placeholder:text-slate-300 dark:placeholder:text-slate-600 placeholder:tracking-normal placeholder:text-sm transition-all"
              autoComplete="off"
            />
          </div>

          {error && (
            <p className="text-xs text-red-500 dark:text-red-400 text-center font-medium">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading || !pin.trim()}
            className={`w-full py-3 rounded-xl text-sm font-bold transition-all ${
              loading || !pin.trim()
                ? "bg-slate-100 dark:bg-slate-800 text-slate-300 dark:text-slate-600 cursor-not-allowed"
                : "bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-100 shadow-lg shadow-slate-200 dark:shadow-slate-900/30"
            }`}
          >
            {loading ? "Verificando..." : "Entrar"}
          </button>
        </form>
      </div>
    </div>
  );
}
