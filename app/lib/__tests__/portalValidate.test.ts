import { describe, it, expect } from "vitest";
import { dosesMatchSource, markersExist, lockoutAfter, decideOpen, GENERIC_DENIED, type OpenRow } from "../portal/validate";
import { mergeMedications, firstName } from "../portal/payload";

const RECEITA = "Vitamina D3: 10.000 UI\nÔmega-3: 2 g\nMagnésio bisglicinato: 400mg";

describe("dosesMatchSource", () => {
  it("accepts doses present in the source regardless of spacing, case and accents", () => {
    const r = dosesMatchSource(
      [
        { nome: "Vitamina D3", dose: "10.000 UI" },
        { nome: "Ômega-3", dose: "2g" },
        { nome: "Magnesio", dose: "400 MG" },
      ],
      RECEITA
    );
    expect(r.ok).toBe(true);
  });

  it("flags a dose that is not in the source and ignores empty doses", () => {
    const r = dosesMatchSource([{ nome: "Vitamina D3", dose: "50.000 UI" }, { nome: "Água", dose: "" }], RECEITA);
    expect(r.ok).toBe(false);
    expect(r.missing).toEqual([{ nome: "Vitamina D3", dose: "50.000 UI" }]);
  });
});

describe("markersExist", () => {
  it("reports markers the lab series does not contain", () => {
    const exames = [
      { marcador: "glicose", nomePopular: "x", explicacao: "y", situacao: "bem" },
      { marcador: "tsh", nomePopular: "x", explicacao: "y", situacao: "bem" },
    ] as const;
    const r = markersExist([...exames], new Set(["glicose"]));
    expect(r.ok).toBe(false);
    expect(r.unknown).toEqual(["tsh"]);
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
        { nome: "vitamina d3", dose: "50.000 UI", slot: "jantar", observacao: "Com a primeira refeição." },
        { nome: "Creatina", dose: "5g", slot: "pre_treino", observacao: "Invented" },
      ]
    );
    expect(merged).toEqual([
      { slot: "cafe_da_manha", nome: "Vitamina D3", dose: "10.000 UI", observacao: "Com a primeira refeição." },
      { slot: "almoco", nome: "Ômega-3", dose: "2g" },
    ]);
  });

  it("uses the AI list only when nothing could be parsed", () => {
    const ai = [{ nome: "Creatina", dose: "5g", slot: "pre_treino" as const }];
    expect(mergeMedications([], ai)).toEqual(ai);
  });
});

describe("firstName", () => {
  it("takes the first word and falls back to Paciente", () => {
    expect(firstName("  Maria da Silva ")).toBe("Maria");
    expect(firstName("")).toBe("Paciente");
  });
});
