"use client";

import { useRef, useState } from "react";
import { Spinner } from "./ui/Spinner";
import { renderMarkdownWithLineBreaks } from "../utils/markdown";

export type DataBoxProps = {
  title: string;
  value: string;
  onChange: (v: string) => void;
  onImport?: (file: File) => void;
  onBlur?: () => void;
  isOutput?: boolean;
  isLoading?: boolean;
  placeholder?: string;
  minHeight?: string;
  titleColor?: string;
  compact?: boolean;
};

export function DataBox({
  title,
  value,
  onChange,
  onImport,
  onBlur,
  isOutput = false,
  isLoading = false,
  placeholder,
  minHeight = "min-h-[100px]",
  titleColor,
  compact = false,
}: DataBoxProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [isEditing, setIsEditing] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && onImport) onImport(file);
    if (e.target) e.target.value = "";
  };

  const handleStartEditing = () => {
    if (isOutput) {
      setIsEditing(true);
      setTimeout(() => textareaRef.current?.focus(), 0);
    }
  };

  const handleBlur = () => {
    setIsEditing(false);
    onBlur?.();
  };

  return (
    <div
      className={`flex flex-col rounded-xl transition-all duration-300 group
      ${compact ? "gap-1 p-3" : "gap-2 p-5"}
      ${
        isOutput
          ? "bg-slate-50/50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/60"
          : "bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] hover:shadow-[0_8px_20px_-8px_rgba(0,0,0,0.1)] dark:shadow-none hover:border-slate-200 dark:hover:border-slate-600"
      }
    `}
    >
      <div className="flex items-center justify-between">
        <span
          className={`font-bold uppercase tracking-wider ${compact ? "text-[9px]" : "text-[10px]"} ${
            titleColor ||
            (isOutput
              ? "text-emerald-600 dark:text-emerald-400"
              : "text-slate-400 dark:text-slate-500 group-hover:text-slate-600 dark:group-hover:text-slate-400 transition-colors")
          }`}
        >
          {title}
        </span>
        {!isOutput && onImport && (
          <div className="no-print">
            <input
              type="file"
              accept="application/pdf, image/jpeg, image/png, text/csv, .csv"
              className="hidden"
              ref={fileInputRef}
              onChange={handleFileChange}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isLoading}
              className={`flex items-center gap-1 font-medium text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors rounded hover:bg-slate-50 dark:hover:bg-slate-700 ${
                compact ? "text-[9px] px-1.5 py-0.5" : "text-[10px] px-2 py-1"
              }`}
            >
              {isLoading ? <Spinner /> : "📎 Import"}
            </button>
          </div>
        )}
      </div>

      {isOutput && !isEditing ? (
        <div
          onClick={handleStartEditing}
          className={`w-full leading-relaxed cursor-text ${
            compact ? "text-[11px] min-h-[70px]" : `text-[13px] ${minHeight}`
          } text-slate-700 dark:text-slate-300 font-medium`}
        >
          {value ? (
            renderMarkdownWithLineBreaks(value)
          ) : (
            <span className="text-slate-300 dark:text-slate-600">
              {placeholder || "Click to edit..."}
            </span>
          )}
        </div>
      ) : (
        <textarea
          ref={textareaRef}
          className={`w-full resize-none bg-transparent leading-relaxed outline-none placeholder:text-slate-200 dark:placeholder:text-slate-600 ${
            compact ? "text-[11px] min-h-[70px]" : `text-[13px] ${minHeight}`
          } ${isOutput ? "text-slate-700 dark:text-slate-300 font-medium" : "text-slate-600 dark:text-slate-300"}`}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={isOutput ? handleBlur : onBlur}
          placeholder={placeholder || "Paste or type here..."}
        />
      )}
    </div>
  );
}
