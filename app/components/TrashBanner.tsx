"use client";

import { Trash2 } from "lucide-react";

type TrashBannerProps = {
  patientName: string;
  onUndo: () => void;
};

export function TrashBanner({ patientName, onUndo }: TrashBannerProps) {
  return (
    <div
      className="fixed top-4 left-1/2 -translate-x-1/2 z-[100]"
      style={{ animation: "trashBannerSlideIn 0.3s ease-out" }}
    >
      <style>{`
        @keyframes trashBannerSlideIn {
          from { opacity: 0; transform: translateX(-50%) translateY(-12px); }
          to { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
      `}</style>
      <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-slate-800 dark:bg-slate-700 text-white shadow-xl border border-slate-700 dark:border-slate-600">
        <Trash2 className="w-4 h-4 text-slate-400 flex-shrink-0" />
        <span className="text-sm">
          <span className="font-semibold">{patientName || "Paciente"}</span> foi para a lixeira.
        </span>
        <button
          onClick={onUndo}
          className="text-sm font-semibold text-brand-300 hover:text-brand-200 underline underline-offset-2 transition-colors"
        >
          Desfazer
        </button>
      </div>
    </div>
  );
}
