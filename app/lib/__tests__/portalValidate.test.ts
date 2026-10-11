import { describe, it, expect } from "vitest";
import { unverifiedDoseMentions, lockoutAfter, decideOpen, GENERIC_DENIED, type OpenRow } from "../portal/validate";
import { mergeMedications, firstName } from "../portal/payload";
import { validateContent } from "../portal/assemble";

const SOURCE = `Vitamina D3: 10.000 UI
Ômega-3: 2 g
Magnésio bisglicinato: 400mg
Cipionato de testosterona: 100mg, intramuscular, 2x/semana
Tirzepatida: 2,5mg SC 1x/semana por 4 semanas
Proteína 1,8 g/kg/dia
Uso: 2 cápsulas no almoço`;

describe("unverifiedDoseMentions", () => {
  it("accepts doses written exactly as in the doctor's documents, ignoring spacing, case and accents", () => {
    expect(
      unverifiedDoseMentions(
        "Tome 10.000 ui de vitamina D, 2g de ômega-3, 400 MG de magnésio, 2 capsulas no almoço e 1,8 g de proteína por quilo.",
        SOURCE
      )
    ).toEqual([]);
  });

  it("flags AI-composed doses that are not in the source — the real failure from production", () => {
    const ai =
      "Tirzepatida 2,5mg (semanas 1-4), titular até 12,5mg. Cipionato de Testosterona 100mg (semanas 1-8), 125mg (semanas 9-16). Ipamorelin 200mcg.";
    expect(unverifiedDoseMentions(ai, SOURCE)).toEqual(["12,5mg", "125mg", "200mcg"]);
  });

  it("does not treat durations, counts or percentages as doses", () => {
    expect(unverifiedDoseMentions("Caminhe 40 minutos, durma 7 horas, 3 vezes por semana, gordura em 28%.", SOURCE)).toEqual([]);
  });

  it("does not match a unit inside a longer word", () => {
    expect(unverifiedDoseMentions("Faça 2 grupos de exercícios e 3 gomas de mascar.", SOURCE)).toEqual([]);
  });
});


describe("lockoutAfter", () => {
  const now = new Date("2026-10-11T12:00:00Z");
  it("escalates 15 min -> 24 h -> permanent", () => {
    expect(lockoutAfter(4, now)).toEqual({ lockedUntil: null, permanent: false });
    expect(lockoutAfter(5, now).lockedUntil?.toISOString()).toBe("2026-10-11T12:15:00.000Z");
    expect(lockoutAfter(9, now).lockedUntil?.toISOString()).toBe("2026-10-11T12:15:00.000Z");
    expect(lockoutAfter(10, now).lockedUntil?.toISOString()).toBe("2026-10-12T12:00:00.000Z");
    expect(lockoutAfter(20, now)).toEqual({ lockedUntil: null, permanent: true });
  });
});

describe("decideOpen", () => {
  const now = new Date("2026-10-11T12:00:00Z");
  const active: OpenRow = {
    status: "active",
    expiresAt: "2027-01-01T00:00:00Z",
    lockedUntil: null,
    failedAttempts: 0,
    hasPayload: true,
    patientActive: true,
  };

  it("treats missing rows and trashed patients identically to a wrong CPF", () => {
    const missing = decideOpen(null, now, true);
    const trashed = decideOpen({ ...active, patientActive: false }, now, true);
    const wrong = decideOpen(active, now, false);
    expect(missing.http).toBe(401);
    expect(trashed.http).toBe(401);
    expect(wrong.http).toBe(401);
    expect(missing.message).toBe(GENERIC_DENIED);
    expect(trashed.message).toBe(GENERIC_DENIED);
    expect(wrong.message).toBe(GENERIC_DENIED);
    expect(missing.mutation).toBeNull();
    expect(wrong.mutation).toBe("increment");
  });

  it("grants access and resets the counter on a correct CPF", () => {
    const d = decideOpen({ ...active, failedAttempts: 3 }, now, true);
    expect(d).toMatchObject({ kind: "ok", http: 200, mutation: "reset" });
  });

  it("does not count attempts against expired, revoked, superseded or locked links", () => {
    for (const row of [
      { ...active, expiresAt: "2026-10-11T11:59:59Z" },
      { ...active, status: "revoked" },
      { ...active, hasPayload: false },
      { ...active, status: "superseded" },
      { ...active, status: "locked" },
      { ...active, lockedUntil: "2026-10-11T12:10:00Z" },
    ]) {
      const d = decideOpen(row, now, false);
      expect(d.http).toBe(410);
      expect(d.mutation).toBeNull();
    }
    expect(decideOpen({ ...active, status: "revoked" }, now, true).http).toBe(410);
    expect(decideOpen({ ...active, expiresAt: "2026-10-11T11:59:59Z" }, now, true).kind).toBe("expired");
  });

  it("computes the lockout that the failed attempt triggers", () => {
    const fourth = decideOpen({ ...active, failedAttempts: 3 }, now, false);
    expect(fourth.lockedUntil).toBeNull();
    const fifth = decideOpen({ ...active, failedAttempts: 4 }, now, false);
    expect(fifth.lockedUntil?.toISOString()).toBe("2026-10-11T12:15:00.000Z");
    expect(fifth.permanentLock).toBe(false);
    const twentieth = decideOpen({ ...active, failedAttempts: 19 }, now, false);
    expect(twentieth.permanentLock).toBe(true);
  });

  it("lets the patient back in once a temporary lock has elapsed", () => {
    const d = decideOpen({ ...active, failedAttempts: 5, lockedUntil: "2026-10-11T11:00:00Z" }, now, true);
    expect(d.kind).toBe("ok");
    const stillLocked = decideOpen({ ...active, failedAttempts: 5, lockedUntil: "2026-10-11T12:05:00Z" }, now, true);
    expect(stillLocked.kind).toBe("locked_temp");
    expect(stillLocked.message).toContain("5 minutos");
  });
});

describe("mergeMedications", () => {
  it("keeps parsed names, doses and slots and takes only the note from the AI", () => {
    const merged = mergeMedications(
      [
        { slot: "cafe_da_manha", nome: "Vitamina D3", dose: "10.000 UI" },
        { slot: "almoco", nome: "Ômega-3", dose: "2g" },
      ],
      [
        { nome: "vitamina d3", observacao: "Com a primeira refeição." },
        { nome: "Creatina", observacao: "Invented" },
      ]
    );
    expect(merged).toEqual([
      { slot: "cafe_da_manha", nome: "Vitamina D3", dose: "10.000 UI", observacao: "Com a primeira refeição." },
      { slot: "almoco", nome: "Ômega-3", dose: "2g" },
    ]);
  });

  it("never produces items from the AI alone, even when nothing was parsed", () => {
    expect(mergeMedications([], [{ nome: "Tirzepatida", observacao: "uma vez por semana" }])).toEqual([]);
  });
});

describe("firstName", () => {
  it("takes the first word and falls back to Paciente", () => {
    expect(firstName("  Maria da Silva ")).toBe("Maria");
    expect(firstName("")).toBe("Paciente");
  });
});

describe("validateContent", () => {
  const parts = {
    analise: "",
    condutaSemPlanos: "4. SUPLEMENTAÇÃO\nVitamina D3: 10.000 UI",
    receita: "1) Vitamina D3 10.000 UI\nCRONOGRAMA DIÁRIO\nCAFÉ DA MANHÃ\nVitamina D3: 10.000 UI",
    parsedMedications: [{ slot: "cafe_da_manha" as const, nome: "Vitamina D3", dose: "10.000 UI" }],
  };
  const base = {
    resumo: { texto: "Sua vitamina D está baixa e vamos repor com cuidado.", prioridades: ["Tomar a vitamina D conforme a lista"] },
    modulos: [],
    medicamentos: [],
    exames: [
      { marcador: "vitaminaD" as const, nomePopular: "Vitamina D", explicacao: "Está baixa.", situacao: "cuidado" as const },
      { marcador: "pcr" as const, nomePopular: "Inflamação", explicacao: "Sem exame.", situacao: "bem" as const },
    ],
    proximosPassos: { examesAntes: [], sinaisDeAlerta: [] },
  };
  const labSeries = [{ key: "vitaminaD" }] as unknown as Parameters<typeof validateContent>[2];

  it("drops explanations for markers the patient has no result for instead of failing", () => {
    const out = validateContent(base, parts, labSeries, "Masculino");
    expect(out.exames.map((e) => e.marcador)).toEqual(["vitaminaD"]);
  });

  it("blocks AI text that cites a dose not written in the receita/conduta", () => {
    const bad = { ...base, resumo: { ...base.resumo, prioridades: ["Tomar 50.000 UI de vitamina D por semana"] } };
    expect(() => validateContent(bad, parts, labSeries, "Masculino")).toThrow(/doses/);
  });
});

describe("mergeMedications note dedupe", () => {
  it("drops a note that only repeats the receita line", () => {
    const merged = mergeMedications(
      [{ slot: "outro", nome: "Ondansetrona 4mg", dose: "se náusea da tirzepatida" }],
      [{ nome: "Ondansetrona 4mg", observacao: "Se náusea da tirzepatida" }]
    );
    expect(merged).toEqual([{ slot: "outro", nome: "Ondansetrona 4mg", dose: "se náusea da tirzepatida" }]);
  });

  it("keeps a plain-language explanation", () => {
    const merged = mergeMedications(
      [{ slot: "outro", nome: "Ondansetrona 4mg", dose: "se náusea da tirzepatida" }],
      [{ nome: "Ondansetrona", observacao: "Só tome se sentir enjoo por causa da tirzepatida." }]
    );
    expect(merged[0].observacao).toBe("Só tome se sentir enjoo por causa da tirzepatida.");
  });
});
