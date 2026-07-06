"use client";

import { useEffect } from "react";
import type { ToastType } from "../../types/clinical";

type ToastProps = {
  message: string;
  type: ToastType;
  onClose: () => void;
};

export function Toast({ message, type, onClose }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(onClose, 4000);
    return () => clearTimeout(timer);
  }, [onClose]);

  const bg =
    type === "success"
      ? "bg-emerald-100 text-emerald-800"
      : type === "error"
        ? "bg-red-100 text-red-800"
        : "bg-blue-100 text-blue-800";

  return (
    <div
      className={`fixed top-6 right-6 z-50 px-4 py-3 rounded shadow-lg ${bg} animate-slide-in font-medium text-sm flex items-center gap-3`}
    >
      <span>{message}</span>
      <button onClick={onClose} className="opacity-50 hover:opacity-100">
        ✕
      </button>
    </div>
  );
}
