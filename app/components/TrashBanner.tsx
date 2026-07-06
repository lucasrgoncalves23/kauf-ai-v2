"use client";

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
      <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-slate-800 dark:bg-slate-700 text-white shadow-lg border border-slate-700 dark:border-slate-600">
        <svg className="w-4 h-4 text-slate-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
        <span className="text-sm">
          Esse perfil foi jogado na lixeira. Deseja voltar atras?{" "}
          <button
            onClick={onUndo}
            className="font-semibold text-blue-400 hover:text-blue-300 underline underline-offset-2 transition-colors"
          >
            Voltar atras
          </button>
        </span>
      </div>
    </div>
  );
}
