"use client";

import React from "react";
import { Hourglass } from "lucide-react";

/**
 * Structured renderer for AI-generated clinical text (análise, conduta, receita).
 *
 * The generated text is markdown-free by design (NO_MARKDOWN_RULES), but has a
 * predictable line structure this renderer surfaces visually:
 * - "1. SONO" / all-caps lines            → section headings
 * - "AGUARDANDO: [critério]"              → amber waiting callout (phase engine)
 * - "Melatonina: 3mg, sublingual"         → bolded key before the colon
 * - "- item" / "• item"                   → bullet items
 */

type Block =
  | { kind: "heading"; text: string }
  | { kind: "aguardando"; text: string }
  | { kind: "bullet"; text: string }
  | { kind: "kv"; label: string; text: string }
  | { kind: "line"; text: string }
  | { kind: "blank" };

// Uppercase letters incl. accented; a heading line has no lowercase letters
const LOWERCASE = /[a-zà-öø-ÿ]/;
const NUMBERED_HEADING = /^\s*\d{1,2}[.)]\s+\S/;
const AGUARDANDO = /^\s*AGUARDANDO:?\s*(.*)$/;
const BULLET = /^\s*[-•]\s+(.*)$/;
const KEY_VALUE = /^([^:\n]{2,60}?):\s+(\S.*)$/;

function isHeading(line: string): boolean {
  const trimmed = line.trim();
  if (trimmed.length < 3 || trimmed.length > 90) return false;
  if (!/[A-ZÀ-ÖØ-Þ]/.test(trimmed)) return false;
  if (LOWERCASE.test(trimmed)) return false;
  return NUMBERED_HEADING.test(trimmed) || /^[A-ZÀ-ÖØ-Þ]/.test(trimmed);
}

export function parseOutputBlocks(text: string): Block[] {
  return text.split("\n").map((line): Block => {
    if (!line.trim()) return { kind: "blank" };
    const aguardando = line.match(AGUARDANDO);
    if (aguardando) return { kind: "aguardando", text: aguardando[1].trim() };
    if (isHeading(line)) return { kind: "heading", text: line.trim() };
    const bullet = line.match(BULLET);
    if (bullet) return { kind: "bullet", text: bullet[1] };
    const kv = line.match(KEY_VALUE);
    if (kv) return { kind: "kv", label: kv[1], text: kv[2] };
    return { kind: "line", text: line };
  });
}

const Caret = () => (
  <span
    aria-hidden
    className="animate-caret inline-block w-0.5 h-[1.05em] translate-y-[0.18em] bg-brand-500 ml-0.5"
  />
);

type OutputRendererProps = {
  text: string;
  streaming?: boolean;
};

export function OutputRenderer({ text, streaming = false }: OutputRendererProps) {
  const blocks = parseOutputBlocks(text);

  // Collapse trailing blank lines so the caret hugs the last real content
  let lastContent = blocks.length - 1;
  while (lastContent >= 0 && blocks[lastContent].kind === "blank") lastContent--;

  let firstHeadingSeen = false;

  return (
    <div className="space-y-0.5">
      {blocks.slice(0, lastContent + 1).map((block, i) => {
        const caret = streaming && i === lastContent ? <Caret /> : null;

        switch (block.kind) {
          case "heading": {
            const mt = firstHeadingSeen ? "mt-5" : "mt-0";
            firstHeadingSeen = true;
            return (
              <h4
                key={i}
                className={`${mt} mb-1.5 pb-1 border-b border-slate-200/70 dark:border-slate-700/70 text-xs font-bold uppercase tracking-wide text-slate-800 dark:text-slate-100`}
              >
                {block.text}
                {caret}
              </h4>
            );
          }
          case "aguardando":
            return (
              <div
                key={i}
                className="my-1.5 flex items-start gap-2.5 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200/70 dark:border-amber-800/50 px-3 py-2"
              >
                <Hourglass className="w-3.5 h-3.5 mt-0.5 shrink-0 text-amber-500 dark:text-amber-400" />
                <div className="min-w-0">
                  <span className="text-2xs font-bold uppercase tracking-wide text-amber-700 dark:text-amber-300 mr-1.5">
                    Aguardando
                  </span>
                  <span className="text-amber-800 dark:text-amber-200">
                    {block.text}
                    {caret}
                  </span>
                </div>
              </div>
            );
          case "bullet":
            return (
              <div key={i} className="flex items-start gap-2 pl-1">
                <span className="text-slate-300 dark:text-slate-600 select-none">•</span>
                <span className="min-w-0">
                  {block.text}
                  {caret}
                </span>
              </div>
            );
          case "kv":
            return (
              <div key={i}>
                <span className="font-semibold text-slate-800 dark:text-slate-100">
                  {block.label}:
                </span>{" "}
                {block.text}
                {caret}
              </div>
            );
          case "line":
            return (
              <div key={i}>
                {block.text}
                {caret}
              </div>
            );
          case "blank":
            return <div key={i} className="h-2" aria-hidden />;
        }
      })}
      {streaming && lastContent < 0 && <Caret />}
    </div>
  );
}
