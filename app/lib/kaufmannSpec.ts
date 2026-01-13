// app/lib/kaufmannSpec.ts

export type Phase = "A" | "B" | "C";

export const SECTION_ORDER = [
  "Diagnóstico Integrativo",
  "Gargalo Primário",
  "Camadas Ativas",
  "Programas",
  "KPIs",
] as const;

export const PROGRAM_BLOCKS = [
  "Sono",
  "Nutrição",
  "Exercício",
  "Suplementação",
  "Manipulados",
  "Soroterapia",
  "Metabolismo / GLP-1",
  "Hormonal",
  "Peptídeos",
] as const;

export const PHASE_RULES: Record<
  Phase,
  {
    allowedPrograms: string[];
    blockedPrograms: string[];
    description: string;
  }
> = {
  A: {
    description: "Desaceleração terapêutica — foco em recuperação e base biológica",
    allowedPrograms: [
      "Sono",
      "Nutrição",
      "Exercício",
      "Suplementação",
      "Manipulados",
      "Soroterapia",
    ],
    blockedPrograms: ["Hormonal", "Peptídeos", "Metabolismo / GLP-1"],
  },
  B: {
    description: "Reconstrução / recondicionamento — performance gradual",
    allowedPrograms: [
      "Sono",
      "Nutrição",
      "Exercício",
      "Suplementação",
      "Manipulados",
      "Soroterapia",
      "Hormonal",
    ],
    blockedPrograms: ["Peptídeos"],
  },
  C: {
    description: "Otimização / manutenção — ajuste fino",
    allowedPrograms: [
      "Sono",
      "Nutrição",
      "Exercício",
      "Suplementação",
      "Manipulados",
      "Soroterapia",
      "Hormonal",
      "Peptídeos",
      "Metabolismo / GLP-1",
    ],
    blockedPrograms: [],
  },
};

export const KPI_TEMPLATE = {
  d30: "Redução de sintomas autonômicos, melhora da recuperação subjetiva.",
  d60: "Estabilização de HRV, normalização de sono e energia.",
  d90: "Retorno progressivo de performance com estabilidade fisiológica.",
};

export const STYLE_CONSTRAINTS = [
  "Linguagem objetiva e clínica.",
  "Sem emojis, sem metáforas.",
  "Frases curtas e afirmativas.",
  "Nunca sugerir módulos bloqueados.",
  "Sempre justificar bloqueios no Engine State.",
];
