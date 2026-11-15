import { describe, expect, it } from "vitest";
import {
  buildCrmPatientPayload,
  buildRetornoPayload,
  crmBirthDate,
  crmIdentityChanged,
  crmPhone,
  spDate,
} from "../crmPayload";
import type { PatientRecord } from "../../types/clinical";

function patient(profile: Partial<PatientRecord["profile"]>, name = "Bruno Purcino"): PatientRecord {
  return {
    id: "p-1",
    name,
    createdAt: "",
    updatedAt: "",
    inputs: { anamnese: "", bioimpedancia: "", laboratoriais: "", genetica: "", wearable: "" },
    outputs: { analise: "", conduta: "", receita: "" },
    profile: { name, age: "", sex: "", cpf: "", birthDate: "", ...profile },
    chatMessages: [],
    engineStatus: null,
  } as PatientRecord;
}

describe("crmPhone", () => {
  it("accepts complete mobiles with or without country code", () => {
    expect(crmPhone("+55 11 99999-8888")).toBe("+5511999998888");
    expect(crmPhone("(11) 99999-8888")).toBe("+5511999998888");
    expect(crmPhone("5511999998888")).toBe("+5511999998888");
    expect(crmPhone("55 99999-8888")).toBe("+5555999998888"); // DDD 55
  });

  it("rejects numbers still being typed", () => {
    for (const partial of ["+55 11 9", "+55 11 99999-888", "11 99999-888", "551199999888", "55119999988"]) {
      expect(crmPhone(partial)).toBeNull();
    }
  });

  it("rejects landlines and empty values", () => {
    expect(crmPhone("(11) 3333-4444")).toBeNull();
    expect(crmPhone("")).toBeNull();
    expect(crmPhone(undefined)).toBeNull();
  });
});

describe("crmBirthDate", () => {
  it("converts DD/MM/AAAA to ISO", () => {
    expect(crmBirthDate("15/03/1980")).toBe("1980-03-15");
  });
  it("rejects partial or impossible dates", () => {
    expect(crmBirthDate("15/03/19")).toBeNull();
    expect(crmBirthDate("31/02/1980")).toBeNull();
    expect(crmBirthDate("")).toBeNull();
  });
});

describe("buildCrmPatientPayload", () => {
  it("is null without a complete phone or a name", () => {
    expect(buildCrmPatientPayload(patient({ phone: "" }))).toBeNull();
    expect(buildCrmPatientPayload(patient({ phone: "+55 11 9999" }))).toBeNull();
    expect(buildCrmPatientPayload(patient({ phone: "11999998888" }, ""))).toBeNull();
  });

  it("sends only valid optional fields", () => {
    expect(
      buildCrmPatientPayload(
        patient({ phone: "11999998888", cpf: "529.982.247-25", birthDate: "15/03/1980" })
      )
    ).toEqual({
      kauf_id: "p-1",
      nome: "Bruno Purcino",
      telefone: "+5511999998888",
      cpf: "52998224725",
      nascimento: "1980-03-15",
    });
    expect(
      buildCrmPatientPayload(patient({ phone: "11999998888", cpf: "123", birthDate: "15/03" }))
    ).toEqual({ kauf_id: "p-1", nome: "Bruno Purcino", telefone: "+5511999998888" });
  });
});

describe("crmIdentityChanged", () => {
  const base = patient({ phone: "11999998888" });
  it("fires when the phone becomes complete", () => {
    expect(crmIdentityChanged(patient({ phone: "1199999" }), base)).toBe(true);
  });
  it("ignores saves that do not touch identity", () => {
    const sameIdentity = { ...base, inputs: { ...base.inputs, anamnese: "nova anamnese" } };
    expect(crmIdentityChanged(base, sameIdentity)).toBe(false);
  });
  it("fires for new patients that are already syncable", () => {
    expect(crmIdentityChanged(null, base)).toBe(true);
  });
});

describe("buildRetornoPayload", () => {
  it("maps the follow-up recommendation to the CRM contract with a São Paulo date", () => {
    const payload = buildRetornoPayload({
      interval: { days: 21, label: "2-3 semanas", reason: "Fase A — instabilidade autonômica requer acompanhamento próximo" },
      suggestedLabs: [
        { marker: "TSH", reason: "Fora da faixa de referência", priority: "medium" },
        { marker: "Vitamina D", reason: "Sem registro — solicitar", priority: "low" },
      ],
      lastConsultaDate: "2026-11-05T01:30:00.000Z", // 22:30 de 04/11 em São Paulo
      nextDate: "2026-11-26T01:30:00.000Z",
    });
    expect(payload).toEqual({
      dias: 21,
      data: "2026-11-25",
      motivo: "Fase A — instabilidade autonômica requer acompanhamento próximo",
      exames: [
        { marcador: "TSH", motivo: "Fora da faixa de referência", prioridade: "medium" },
        { marcador: "Vitamina D", motivo: "Sem registro — solicitar", prioridade: "low" },
      ],
    });
  });
  it("omits the date when there is no consulta yet and caps labs at 10", () => {
    const payload = buildRetornoPayload({
      interval: { days: 42, label: "4-6 semanas", reason: "Sem dados de fase — intervalo padrão" },
      suggestedLabs: Array.from({ length: 12 }, (_, i) => ({ marker: `M${i}`, reason: "", priority: "low" as const })),
      lastConsultaDate: null,
      nextDate: null,
    });
    expect(payload.data).toBeUndefined();
    expect(payload.exames).toHaveLength(10);
  });
  it("spDate converts an instant to the clinic's calendar day", () => {
    expect(spDate("2026-11-05T01:30:00.000Z")).toBe("2026-11-04");
    expect(spDate("2026-11-05T12:00:00.000Z")).toBe("2026-11-05");
  });
});
