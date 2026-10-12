import { describe, it, expect } from "vitest";
import { lastConsultaAt, groupByLastConsulta } from "../patientSort";
import type { Consulta, PatientRecord } from "../../types/clinical";

const NOW = new Date("2026-10-12T15:00:00-03:00").getTime();
const DAY = 24 * 60 * 60 * 1000;

function patient(id: string, name: string): PatientRecord {
  return {
    id,
    name,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
  } as PatientRecord;
}

function consulta(patientId: string, timestamp: string): Consulta {
  return { id: `${patientId}-${timestamp}`, patientId, timestamp } as Consulta;
}

describe("lastConsultaAt", () => {
  it("returns null without consultas", () => {
    expect(lastConsultaAt(undefined)).toBeNull();
    expect(lastConsultaAt([])).toBeNull();
  });

  it("picks the most recent timestamp regardless of order", () => {
    const list = [
      consulta("a", "2026-09-01T10:00:00Z"),
      consulta("a", "2026-10-05T10:00:00Z"),
      consulta("a", "2026-03-01T10:00:00Z"),
    ];
    expect(lastConsultaAt(list)).toBe(new Date("2026-10-05T10:00:00Z").getTime());
  });

  it("ignores unparseable timestamps", () => {
    const list = [consulta("a", "not-a-date"), consulta("a", "2026-10-05T10:00:00Z")];
    expect(lastConsultaAt(list)).toBe(new Date("2026-10-05T10:00:00Z").getTime());
    expect(lastConsultaAt([consulta("a", "garbage")])).toBeNull();
  });
});

describe("groupByLastConsulta", () => {
  const patients = [
    patient("old", "Zelia"),
    patient("none2", "Bruno"),
    patient("today", "Maria"),
    patient("week", "Carlos"),
    patient("none1", "Ana"),
    patient("month", "Pedro"),
    patient("week2", "Joana"),
  ];
  const consultas: Record<string, Consulta[]> = {
    today: [consulta("today", new Date(NOW - 2 * 60 * 60 * 1000).toISOString())],
    week: [consulta("week", new Date(NOW - 3 * DAY).toISOString())],
    week2: [
      consulta("week2", new Date(NOW - 90 * DAY).toISOString()),
      consulta("week2", new Date(NOW - 1 * DAY).toISOString()),
    ],
    month: [consulta("month", new Date(NOW - 20 * DAY).toISOString())],
    old: [consulta("old", new Date(NOW - 200 * DAY).toISOString())],
  };

  it("orders buckets from most recent to oldest, then patients without consultas", () => {
    const groups = groupByLastConsulta(patients, consultas, NOW);
    expect(groups.map((g) => g.label)).toEqual([
      "Hoje",
      "Últimos 7 dias",
      "Últimos 30 dias",
      "Mais de 30 dias",
      "Sem consultas",
    ]);
  });

  it("sorts patients inside a bucket by latest consulta, newest first", () => {
    const groups = groupByLastConsulta(patients, consultas, NOW);
    const week = groups.find((g) => g.label === "Últimos 7 dias")!;
    expect(week.patients.map((p) => p.id)).toEqual(["week2", "week"]);
  });

  it("uses the most recent consulta when a patient has several", () => {
    const groups = groupByLastConsulta(patients, consultas, NOW);
    const older = groups.find((g) => g.label === "Mais de 30 dias")!;
    expect(older.patients.map((p) => p.id)).toEqual(["old"]);
  });

  it("sorts patients without consultas alphabetically", () => {
    const groups = groupByLastConsulta(patients, consultas, NOW);
    const none = groups.find((g) => g.label === "Sem consultas")!;
    expect(none.patients.map((p) => p.name)).toEqual(["Ana", "Bruno"]);
  });

  it("omits empty buckets", () => {
    const groups = groupByLastConsulta([patient("x", "X")], {}, NOW);
    expect(groups.map((g) => g.label)).toEqual(["Sem consultas"]);
    expect(groupByLastConsulta([], {}, NOW)).toEqual([]);
  });

  it("treats a consulta earlier today as 'Hoje' even if more than a few hours ago", () => {
    const morning = new Date(NOW);
    morning.setHours(0, 30, 0, 0);
    const groups = groupByLastConsulta(
      [patient("m", "M")],
      { m: [consulta("m", morning.toISOString())] },
      NOW
    );
    expect(groups[0].label).toBe("Hoje");
  });
});
