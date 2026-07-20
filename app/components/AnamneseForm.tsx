"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { ChevronRight, Mic, Paperclip } from "lucide-react";
import { Spinner } from "./ui/Spinner";
import { useDictation } from "../hooks/useDictation";

// --- Section Definitions ---

type FieldDef = { key: string; label: string };
type FieldSection = { num: number; title: string; type: "fields"; fields: FieldDef[] };
type CheckboxSection = { num: number; title: string; type: "checkbox"; options: string[] };
type Section = FieldSection | CheckboxSection;

const SECTIONS: Section[] = [
  {
    num: 0,
    title: "IDENTIFICAÇÃO & CONTEXTO",
    type: "fields",
    fields: [
      { key: "nome", label: "Nome" },
      { key: "sexo", label: "Sexo biológico" },
      { key: "idade", label: "Idade" },
      { key: "altura", label: "Altura" },
      { key: "peso", label: "Peso" },
      { key: "profissao", label: "Profissão" },
      { key: "rotinaTrabalho", label: "Rotina de trabalho" },
      { key: "estadoCivil", label: "Estado civil" },
      { key: "filhos", label: "Filhos" },
      { key: "objetivoPrincipal", label: "Objetivo principal" },
    ],
  },
  {
    num: 1,
    title: "OBJETIVOS TERAPÊUTICOS",
    type: "checkbox",
    options: [
      "Mais energia",
      "Melhor sono",
      "Redução de estresse",
      "Ganho de massa muscular",
      "Redução de gordura",
      "Performance cognitiva",
      "Performance sexual",
      "Longevidade / prevenção",
      "Estética corporal",
      "Estética íntima",
      "Otimização hormonal",
      "Biohacking avançado",
    ],
  },
  {
    num: 2,
    title: "QUEIXA PRINCIPAL & SINTOMAS",
    type: "fields",
    fields: [
      { key: "queixaPrincipal", label: "Queixa principal" },
      { key: "inicio", label: "Início" },
      { key: "evolucao", label: "Evolução" },
      { key: "intensidade", label: "Intensidade (0–10)" },
      { key: "fadiga", label: "Fadiga (0–10)" },
      { key: "ansiedade", label: "Ansiedade (0–10)" },
      { key: "humorDeprimido", label: "Humor deprimido (0–10)" },
      { key: "irritabilidade", label: "Irritabilidade (0–10)" },
      { key: "dorCronica", label: "Dor crônica (0–10)" },
    ],
  },
  {
    num: 3,
    title: "HISTÓRIA CLÍNICA",
    type: "fields",
    fields: [
      { key: "hipertensao", label: "Hipertensão" },
      { key: "diabetes", label: "Diabetes" },
      { key: "dislipidemia", label: "Dislipidemia" },
      { key: "doencaCardiovascular", label: "Doença cardiovascular" },
      { key: "doencaTireoidiana", label: "Doença tireoidiana" },
      { key: "apneiaSono", label: "Apneia do sono" },
      { key: "doencaAutoimune", label: "Doença autoimune" },
      { key: "cancer", label: "Câncer" },
      { key: "cirurgiasPrevias", label: "Cirurgias prévias" },
      { key: "medicamentosUso", label: "Medicamentos de uso contínuo" },
    ],
  },
  {
    num: 4,
    title: "HORMÔNIOS & TRATAMENTOS PRÉVIOS",
    type: "fields",
    fields: [
      { key: "usouTestosterona", label: "Já usou testosterona" },
      { key: "tipoTesto", label: "Tipo" },
      { key: "doseTesto", label: "Dose" },
      { key: "tempoUsoTesto", label: "Tempo de uso" },
      { key: "ultimoExame", label: "Último exame" },
      { key: "usouGH", label: "Já usou GH" },
      { key: "usouPeptideos", label: "Já usou peptídeos" },
      { key: "usouGLP1", label: "Já usou GLP-1" },
    ],
  },
  {
    num: 5,
    title: "SEXUALIDADE",
    type: "fields",
    fields: [
      { key: "libido", label: "Libido (0–10)" },
      { key: "erecao", label: "Ereção (0–10)" },
      { key: "rigidezPeniana", label: "Rigidez peniana (0–10)" },
      { key: "ejaculacaoPrecoce", label: "Ejaculação precoce" },
      { key: "usoPDE5", label: "Uso de PDE5" },
    ],
  },
  {
    num: 6,
    title: "SONO & EIXO HPA",
    type: "fields",
    fields: [
      { key: "horasSono", label: "Horas de sono" },
      { key: "qualidadeSono", label: "Qualidade (0–10)" },
      { key: "dificuldadeDormir", label: "Dificuldade para dormir" },
      { key: "ronco", label: "Ronco" },
      { key: "acordaCansado", label: "Acorda cansado" },
    ],
  },
  {
    num: 7,
    title: "ESTRESSE & SAÚDE MENTAL",
    type: "fields",
    fields: [
      { key: "estresseDiario", label: "Estresse diário (0–10)" },
      { key: "burnout", label: "Burnout" },
      { key: "ansiedadeDiagnosticada", label: "Ansiedade diagnosticada" },
      { key: "depressaoDiagnosticada", label: "Depressão diagnosticada" },
      { key: "medicamentosPsiquiatricos", label: "Medicamentos psiquiátricos" },
    ],
  },
  {
    num: 8,
    title: "NUTRIÇÃO",
    type: "fields",
    fields: [
      { key: "refeicoesDia", label: "Refeições/dia" },
      { key: "dieta", label: "Dieta" },
      { key: "alcool", label: "Álcool" },
      { key: "compulsaoAlimentar", label: "Compulsão alimentar" },
    ],
  },
  {
    num: 9,
    title: "ATIVIDADE FÍSICA",
    type: "fields",
    fields: [
      { key: "frequenciaSemanal", label: "Frequência semanal" },
      { key: "tipoExercicio", label: "Tipo" },
      { key: "lesoes", label: "Lesões" },
      { key: "recuperacao", label: "Recuperação (0–10)" },
    ],
  },
  {
    num: 10,
    title: "GENÉTICA",
    type: "fields",
    fields: [
      { key: "painelGenetico", label: "Painel genético realizado" },
      { key: "eixosRelevantes", label: "Eixos relevantes" },
    ],
  },
  {
    num: 11,
    title: "FLAGS CLÍNICAS",
    type: "checkbox",
    options: [
      "Alto risco cardiovascular",
      "Alto risco hormonal",
      "Baixa adesão",
      "Distúrbio do sono grave",
      "Burnout ativo",
      "Obesidade metabólica",
      "Hipogonadismo provável",
    ],
  },
  {
    num: 12,
    title: "CONSENTIMENTO & EXPECTATIVAS",
    type: "fields",
    fields: [
      { key: "expectativaPaciente", label: "Expectativa do paciente" },
      { key: "comprometimento", label: "Comprometimento (0–10)" },
      { key: "autorizaProtocolos", label: "Autoriza protocolos avançados" },
    ],
  },
];

// --- Serialization / Parsing ---

const LABEL_TO_KEY: Record<string, string> = {};
for (const section of SECTIONS) {
  if (section.type === "fields") {
    for (const field of section.fields) {
      LABEL_TO_KEY[field.label.toLowerCase()] = field.key;
    }
  }
}

function serialize(
  fields: Record<string, string>,
  checks: Record<string, string[]>,
  notes: string
): string {
  const parts: string[] = [];

  for (const section of SECTIONS) {
    const header = `CAMADA ${section.num} – ${section.title}`;
    const lines: string[] = [];

    if (section.type === "checkbox") {
      const selected = checks[section.num] || [];
      for (const opt of section.options) {
        if (selected.includes(opt)) lines.push(`[x] ${opt}`);
      }
    } else {
      for (const field of section.fields) {
        const val = fields[field.key]?.trim();
        if (val) lines.push(`${field.label}: ${val}`);
      }
    }

    if (lines.length > 0) {
      parts.push(header + "\n" + lines.join("\n"));
    }
  }

  if (notes.trim()) {
    parts.push("OBSERVAÇÕES\n" + notes.trim());
  }

  return parts.join("\n\n");
}

function parseFields(text: string): Record<string, string> {
  const result: Record<string, string> = {};
  if (!text || !text.includes("CAMADA ")) return result;

  for (const line of text.split("\n")) {
    const match = line.match(/^([^[\n]+?):\s+(.*)/);
    if (match) {
      const label = match[1].trim().toLowerCase();
      const value = match[2].trim();
      if (LABEL_TO_KEY[label] && value) {
        result[LABEL_TO_KEY[label]] = value;
      }
    }
  }

  return result;
}

function parseChecks(text: string): Record<number, string[]> {
  const result: Record<number, string[]> = {};
  if (!text || !text.includes("CAMADA ")) return result;

  for (const line of text.split("\n")) {
    const match = line.match(/^\[x\]\s+(.*)/i);
    if (match) {
      const option = match[1].trim();
      for (const section of SECTIONS) {
        if (section.type === "checkbox") {
          const found = section.options.find(
            (o) => o.toLowerCase() === option.toLowerCase()
          );
          if (found) {
            if (!result[section.num]) result[section.num] = [];
            result[section.num].push(found);
          }
        }
      }
    }
  }

  return result;
}

function parseNotes(text: string): string {
  if (!text) return "";
  if (!text.includes("CAMADA ")) return text;
  const idx = text.indexOf("OBSERVAÇÕES");
  if (idx === -1) return "";
  return text
    .slice(idx + "OBSERVAÇÕES".length)
    .replace(/^\n+/, "")
    .trim();
}

// --- Component ---

export type AnamneseFormProps = {
  value: string;
  onChange: (v: string) => void;
  onImport?: (files: File[]) => void;
  isLoading?: boolean;
};

export function AnamneseForm({
  value,
  onChange,
  onImport,
  isLoading,
}: AnamneseFormProps) {
  const [fields, setFields] = useState<Record<string, string>>(() =>
    parseFields(value)
  );
  const [checks, setChecks] = useState<Record<number, string[]>>(() =>
    parseChecks(value)
  );
  const [notes, setNotes] = useState(() => parseNotes(value));
  const [expanded, setExpanded] = useState<Record<number, boolean>>({ 0: true });
  const lastSerialized = useRef(value);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync from external value changes (session restore, PDF import)
  useEffect(() => {
    if (value !== lastSerialized.current) {
      setFields(parseFields(value));
      setChecks(parseChecks(value));
      setNotes(parseNotes(value));
      lastSerialized.current = value;
    }
  }, [value]);

  const emitChange = useCallback(
    (f: Record<string, string>, c: Record<number, string[]>, n: string) => {
      const serialized = serialize(f, c, n);
      lastSerialized.current = serialized;
      onChange(serialized);
    },
    [onChange]
  );

  const handleFieldChange = (key: string, val: string) => {
    const next = { ...fields, [key]: val };
    setFields(next);
    emitChange(next, checks, notes);
  };

  const handleCheckToggle = (sectionNum: number, option: string) => {
    const current = checks[sectionNum] || [];
    const next = current.includes(option)
      ? current.filter((o) => o !== option)
      : [...current, option];
    const newChecks = { ...checks, [sectionNum]: next };
    setChecks(newChecks);
    emitChange(fields, newChecks, notes);
  };

  const handleNotesChange = (val: string) => {
    setNotes(val);
    emitChange(fields, checks, val);
  };

  // Voice dictation appends to Observações (survives serialization)
  const notesRef = useRef(notes);
  notesRef.current = notes;
  const {
    isSupported: dictationSupported,
    isRecording,
    interim,
    toggle: toggleDictation,
  } = useDictation((text) => {
    const current = notesRef.current.trim();
    handleNotesChange(current ? `${current} ${text}` : text);
  });

  const toggleSection = (num: number) => {
    setExpanded((prev) => ({ ...prev, [num]: !prev[num] }));
  };

  const expandAll = () => {
    const all: Record<number, boolean> = {};
    for (const s of SECTIONS) all[s.num] = true;
    setExpanded(all);
  };

  const collapseAll = () => setExpanded({});

  const allExpanded = SECTIONS.every((s) => expanded[s.num]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length > 0 && onImport) onImport(files);
    if (e.target) e.target.value = "";
  };

  const getSectionCount = (section: Section): [number, number] => {
    if (section.type === "checkbox") {
      return [(checks[section.num] || []).length, section.options.length];
    }
    return [
      section.fields.filter((f) => fields[f.key]?.trim()).length,
      section.fields.length,
    ];
  };

  const inputClass =
    "w-full bg-white/50 dark:bg-slate-700/50 rounded-lg border border-slate-200 dark:border-slate-600 font-medium outline-none focus:ring-2 focus:ring-brand-100 dark:focus:ring-brand-900 focus:border-brand-300 dark:focus:border-brand-700 transition-all dark:text-white px-2.5 py-1.5 text-sm compact:px-2 compact:py-1 compact:text-xs";

  return (
    <div
      className="flex flex-col rounded-xl transition-all duration-300 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] hover:shadow-[0_8px_20px_-8px_rgba(0,0,0,0.1)] dark:shadow-none hover:border-slate-200 dark:hover:border-slate-600 gap-2 p-5 compact:gap-1 compact:p-3"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 text-2xs">
          Anamnese Multicamadas
        </span>
        <div className="flex items-center gap-2 no-print">
          <button
            onClick={allExpanded ? collapseAll : expandAll}
            className="font-medium text-slate-400 hover:text-brand-600 dark:hover:text-brand-400 transition-colors rounded-md hover:bg-slate-50 dark:hover:bg-slate-700 text-2xs px-2 py-1 compact:px-1.5 compact:py-0.5"
          >
            {allExpanded ? "Recolher" : "Expandir"}
          </button>
          {dictationSupported && (
            <button
              onClick={toggleDictation}
              title={isRecording ? "Parar ditado" : "Ditar (voz → Observações)"}
              className={`flex items-center gap-1 font-medium transition-colors rounded-md text-2xs px-2 py-1 compact:px-1.5 compact:py-0.5 ${
                isRecording
                  ? "text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30"
                  : "text-slate-400 hover:text-brand-600 dark:hover:text-brand-400 hover:bg-slate-50 dark:hover:bg-slate-700"
              }`}
            >
              <Mic className="w-3 h-3" />
              {isRecording ? "Gravando..." : "Ditar"}
            </button>
          )}
          {onImport && (
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
                className="flex items-center gap-1 font-medium text-slate-400 hover:text-brand-600 dark:hover:text-brand-400 transition-colors rounded-md hover:bg-slate-50 dark:hover:bg-slate-700 text-2xs px-2 py-1 compact:px-1.5 compact:py-0.5"
              >
                {isLoading ? <Spinner /> : <Paperclip className="w-3 h-3" />}
                Importar
              </button>
            </>
          )}
        </div>
      </div>

      {/* Dictation live feedback */}
      {isRecording && (
        <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/40">
          <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse shrink-0"></span>
          <span className="text-2xs text-red-700 dark:text-red-300 truncate">
            {interim || "Ouvindo... fale para adicionar às Observações"}
          </span>
        </div>
      )}

      {/* Sections */}
      <div className="space-y-2 compact:space-y-1">
        {SECTIONS.map((section) => {
          const [filled, total] = getSectionCount(section);
          const isExpanded = !!expanded[section.num];

          return (
            <div key={section.num}>
              {/* Section Header */}
              <button
                onClick={() => toggleSection(section.num)}
                className="flex items-center w-full rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors py-2 px-3 gap-3 compact:py-1.5 compact:px-2 compact:gap-2"
              >
                <ChevronRight
                  className={`w-3 h-3 text-slate-400 transition-transform ${isExpanded ? "rotate-90" : ""}`}
                />
                <span className="font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 text-2xs">
                  C{section.num} – {section.title}
                </span>
                {filled > 0 && (
                  <span className="ml-auto rounded-full bg-brand-50 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400 font-bold text-2xs px-2 py-0.5 compact:px-1.5 compact:py-0">
                    {filled}/{total}
                  </span>
                )}
              </button>

              {/* Section Content */}
              {isExpanded && (
                <div className="px-3 pb-3 pt-1 compact:px-2 compact:pb-2">
                  {section.type === "fields" ? (
                    <div className="grid grid-cols-2 gap-x-4 gap-y-2 compact:gap-x-3 compact:gap-y-1.5">
                      {section.fields.map((field) => (
                        <div key={field.key}>
                          <label className="block uppercase tracking-wide text-slate-400 dark:text-slate-500 font-semibold text-[10px] mb-1 compact:mb-0.5">
                            {field.label}
                          </label>
                          <input
                            type="text"
                            className={inputClass}
                            value={fields[field.key] || ""}
                            onChange={(e) =>
                              handleFieldChange(field.key, e.target.value)
                            }
                            placeholder="—"
                          />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 compact:gap-x-3 compact:gap-y-1">
                      {section.options.map((option) => {
                        const checked = (checks[section.num] || []).includes(
                          option
                        );
                        return (
                          <label
                            key={option}
                            className="flex items-center gap-2 cursor-pointer rounded-md hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors py-1 px-1.5 compact:py-0.5 compact:px-1"
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() =>
                                handleCheckToggle(section.num, option)
                              }
                              className="rounded border-slate-300 dark:border-slate-600 text-brand-600 focus:ring-brand-500 dark:bg-slate-700"
                            />
                            <span
                              className={`text-slate-600 dark:text-slate-300 text-xs compact:text-2xs ${checked ? "font-medium" : ""}`}
                            >
                              {option}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Observações */}
      <div className="pt-2 compact:pt-1">
        <button
          onClick={() =>
            setExpanded((prev) => ({ ...prev, notes: !prev[notes as never] }))
          }
          className="hidden"
        />
        <label className="block uppercase tracking-wide text-slate-400 dark:text-slate-500 font-semibold text-[10px] mb-1 compact:mb-0.5">
          Observações / Dados Importados
        </label>
        <textarea
          className="w-full resize-none bg-white/50 dark:bg-slate-700/50 rounded-lg border border-slate-200 dark:border-slate-600 font-medium outline-none focus:ring-2 focus:ring-brand-100 dark:focus:ring-brand-900 focus:border-brand-300 dark:focus:border-brand-700 transition-all dark:text-white px-2.5 py-1.5 text-sm min-h-[70px] compact:px-2 compact:py-1 compact:text-xs compact:min-h-[50px]"
          value={notes}
          onChange={(e) => handleNotesChange(e.target.value)}
          placeholder="Texto livre, dados de PDF importado..."
        />
      </div>
    </div>
  );
}
