"use client";

import { useRef, useState } from "react";
import { Paperclip, Pencil, Check, Maximize2 } from "lucide-react";
import { Spinner } from "./ui/Spinner";
import { OutputRenderer } from "./OutputRenderer";

export type DataBoxProps = {
  title: string;
  value: string;
  onChange: (v: string) => void;
  onImport?: (files: File[]) => void;
  onBlur?: () => void;
  onMaximize?: () => void;
  isOutput?: boolean;
  isLoading?: boolean;
  isStreaming?: boolean;
  placeholder?: string;
  minHeight?: string;
  titleColor?: string;
};

export function DataBox({
  title,
  value,
  onChange,
  onImport,
  onBlur,
  onMaximize,
  isOutput = false,
  isLoading = false,
  isStreaming = false,
  placeholder,
  minHeight = "min-h-[100px]",
  titleColor,
}: DataBoxProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [isEditing, setIsEditing] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length > 0 && onImport) onImport(files);
    if (e.target) e.target.value = "";
  };

  const handleStartEditing = () => {
    if (isOutput && !isStreaming) {
      setIsEditing(true);
      setTimeout(() => textareaRef.current?.focus(), 0);
    }
  };

  const handleBlur = () => {
    setIsEditing(false);
    onBlur?.();
  };

  // Streaming always shows the rendered view; edit mode is unavailable until done
  const showReadView = isOutput && (isStreaming || !isEditing);

  return (
    <div
      className={`flex flex-col rounded-xl transition-all duration-300 group gap-2 p-5 compact:gap-1 compact:p-3
      ${
        isOutput
          ? "bg-slate-50/50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/60"
          : "bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] hover:shadow-[0_8px_20px_-8px_rgba(0,0,0,0.1)] dark:shadow-none hover:border-slate-200 dark:hover:border-slate-600"
      }
    `}
    >
      <div className="flex items-center justify-between">
        <span
          className={`font-semibold uppercase tracking-wider text-2xs ${
            titleColor ||
            (isOutput
              ? "text-emerald-600 dark:text-emerald-400"
              : "text-slate-400 dark:text-slate-500 group-hover:text-slate-600 dark:group-hover:text-slate-400 transition-colors")
          }`}
        >
          {title}
        </span>
        <div className="no-print flex items-center gap-1.5">
          {isOutput && isStreaming && (
            <span className="flex items-center gap-1.5 text-2xs font-medium text-brand-600 dark:text-brand-400">
              <span className="w-1.5 h-1.5 rounded-full bg-brand-500 animate-pulse" />
              Gerando…
            </span>
          )}
          {isOutput && !isStreaming && value.trim() && (
            <button
              onClick={isEditing ? handleBlur : handleStartEditing}
              className="flex items-center gap-1 text-2xs font-medium text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 px-2 py-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
              title={isEditing ? "Concluir edição" : "Editar texto"}
            >
              {isEditing ? <Check className="w-3.5 h-3.5" /> : <Pencil className="w-3 h-3" />}
              {isEditing ? "Concluir" : "Editar"}
            </button>
          )}
          {!isOutput && onMaximize && (
            <button
              onClick={onMaximize}
              className="flex items-center gap-1 text-2xs font-medium text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 px-2 py-1"
              title="Tela cheia"
            >
              <Maximize2 className="w-3 h-3" />
              Expandir
            </button>
          )}
          {!isOutput && onImport && (
            <>
              <input
                type="file"
                multiple
                accept="application/pdf, image/jpeg, image/png, text/csv, .csv"
                className="hidden"
                ref={fileInputRef}
                onChange={handleFileChange}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isLoading}
                className="flex items-center gap-1 text-2xs font-medium text-slate-400 hover:text-brand-600 dark:hover:text-brand-400 transition-colors rounded-md hover:bg-slate-50 dark:hover:bg-slate-700 px-2 py-1 compact:px-1.5 compact:py-0.5"
              >
                {isLoading ? <Spinner /> : <Paperclip className="w-3 h-3" />}
                Importar
              </button>
            </>
          )}
        </div>
      </div>

      {showReadView ? (
        <div
          onClick={handleStartEditing}
          className={`w-full leading-relaxed text-sm compact:text-xs compact:min-h-[70px] ${minHeight} text-slate-700 dark:text-slate-300 ${
            isStreaming ? "" : "cursor-text"
          }`}
        >
          {value ? (
            <OutputRenderer text={value} streaming={isStreaming} />
          ) : (
            <span className="text-slate-300 dark:text-slate-600">
              {placeholder || "Clique para editar..."}
            </span>
          )}
        </div>
      ) : (
        <textarea
          ref={textareaRef}
          className={`w-full resize-none bg-transparent leading-relaxed outline-none placeholder:text-slate-300 dark:placeholder:text-slate-600 text-sm compact:text-xs compact:min-h-[70px] ${minHeight} ${
            isOutput ? "text-slate-700 dark:text-slate-300" : "text-slate-600 dark:text-slate-300"
          }`}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={isOutput ? handleBlur : onBlur}
          placeholder={placeholder || "Cole ou digite aqui..."}
        />
      )}
    </div>
  );
}
