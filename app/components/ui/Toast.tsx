"use client";

import { useEffect } from "react";
import { CheckCircle2, AlertCircle, Info, X } from "lucide-react";
import type { ToastType } from "../../types/clinical";

type ToastProps = {
  message: string;
  type: ToastType;
  onClose: () => void;
};

const TOAST_UI = {
  success: {
    icon: CheckCircle2,
    iconColor: "text-emerald-500 dark:text-emerald-400",
    accent: "border-l-emerald-500",
  },
  error: {
    icon: AlertCircle,
    iconColor: "text-red-500 dark:text-red-400",
    accent: "border-l-red-500",
  },
  info: {
    icon: Info,
    iconColor: "text-brand-500 dark:text-brand-400",
    accent: "border-l-brand-500",
  },
} as const;

export function Toast({ message, type, onClose }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(onClose, type === "error" ? 6000 : 4000);
    return () => clearTimeout(timer);
  }, [onClose, type]);

  const ui = TOAST_UI[type];
  const Icon = ui.icon;

  return (
    <div
      role="status"
      className={`fixed top-6 right-6 z-[100] flex items-start gap-3 max-w-sm px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 border-l-4 ${ui.accent} bg-white dark:bg-slate-800 shadow-xl shadow-slate-900/10 dark:shadow-black/30 animate-slide-in`}
    >
      <Icon className={`w-5 h-5 shrink-0 mt-px ${ui.iconColor}`} />
      <span className="text-sm font-medium text-slate-700 dark:text-slate-200 leading-snug">
        {message}
      </span>
      <button
        onClick={onClose}
        aria-label="Fechar"
        className="shrink-0 p-0.5 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
