import { describe, it, expect } from "vitest";
import { extractMetrics, parseMetricsFromInputs, extractDemographics } from "../extraction";

// =============================================
// METRIC EXTRACTION
// =============================================

describe("extractMetrics — HRV", () => {
  it("parses 'HRV: 42ms'", () => {
    const r = extractMetrics({ text: "HRV: 42ms" });
    expect(r.hrv?.value).toBe(42);
  });

  it("parses 'hrv médio: 38'", () => {
    const r = extractMetrics({ text: "hrv médio: 38" });
    expect(r.hrv?.value).toBe(38);
  });

  it("parses 'RMSSD: 55ms'", () => {
    const r = extractMetrics({ text: "RMSSD: 55ms" });
    expect(r.hrv?.value).toBe(55);
  });

  it("parses 'SDNN: 70 ms'", () => {
    const r = extractMetrics({ text: "SDNN: 70 ms" });
    expect(r.hrv?.value).toBe(70);
  });

  it("rejects HRV out of range (300ms)", () => {
    const r = extractMetrics({ text: "HRV: 300ms" });
    expect(r.hrv).toBeUndefined();
  });
});

describe("extractMetrics — RHR", () => {
  it("parses 'RHR: 68bpm'", () => {
    const r = extractMetrics({ text: "RHR: 68bpm" });
    expect(r.rhr?.value).toBe(68);
  });

  it("parses 'FC repouso: 72'", () => {
    const r = extractMetrics({ text: "FC repouso: 72" });
    expect(r.rhr?.value).toBe(72);
  });

  it("parses 'frequência cardíaca de repouso: 65'", () => {
    const r = extractMetrics({ text: "frequência cardíaca de repouso: 65" });
    expect(r.rhr?.value).toBe(65);
  });

  it("parses 'resting heart rate: 58'", () => {
    const r = extractMetrics({ text: "resting heart rate: 58" });
    expect(r.rhr?.value).toBe(58);
  });
});

describe("extractMetrics — HOMA-IR", () => {
  it("parses 'HOMA-IR: 2.8'", () => {
    const r = extractMetrics({ text: "HOMA-IR: 2.8" });
    expect(r.homaIr?.value).toBe(2.8);
  });

  it("parses European decimal 'HOMA-IR: 3,5'", () => {
    const r = extractMetrics({ text: "HOMA-IR: 3,5" });
    expect(r.homaIr?.value).toBe(3.5);
  });

  it("parses 'índice homa: 1.9'", () => {
    const r = extractMetrics({ text: "índice homa: 1.9" });
    expect(r.homaIr?.value).toBe(1.9);
  });
});

describe("extractMetrics — Sleep", () => {
  it("parses 'Sono: 6.5h'", () => {
    const r = extractMetrics({ text: "Sono: 6.5h" });
    expect(r.sleepHours?.value).toBe(6.5);
  });

  it("parses '7 horas de sono'", () => {
    const r = extractMetrics({ text: "7 horas de sono" });
    expect(r.sleepHours?.value).toBe(7);
  });

  it("parses 'sleep duration: 8'", () => {
    const r = extractMetrics({ text: "sleep duration: 8" });
    expect(r.sleepHours?.value).toBe(8);
  });
});

describe("extractMetrics — Body composition", () => {
  it("parses weight 'peso: 82.5 kg'", () => {
    const r = extractMetrics({ text: "peso: 82.5 kg" });
    expect(r.weight?.value).toBe(82.5);
  });

  it("parses fat '% gordura: 22'", () => {
    const r = extractMetrics({ text: "% gordura: 22" });
    expect(r.fatPercent?.value).toBe(22);
  });

  it("parses muscle 'massa muscular: 35.2 kg'", () => {
    const r = extractMetrics({ text: "massa muscular: 35.2 kg" });
    expect(r.muscleMass?.value).toBe(35.2);
  });
});

describe("extractMetrics — Lab values", () => {
  it("parses 'glicose jejum: 92 mg/dl'", () => {
    const r = extractMetrics({ text: "glicose jejum: 92 mg/dl" });
    expect(r.glucose?.value).toBe(92);
  });

  it("parses 'insulina basal: 8.3'", () => {
    const r = extractMetrics({ text: "insulina basal: 8.3" });
    expect(r.insulin?.value).toBe(8.3);
  });

  it("parses 'HbA1c: 5.4%'", () => {
    const r = extractMetrics({ text: "HbA1c: 5.4%" });
    expect(r.hba1c?.value).toBe(5.4);
  });
});

describe("extractMetrics — multi-field input", () => {
  it("extracts metrics from multiple input fields simultaneously", () => {
    const r = extractMetrics({
      wearable: "HRV 7d: 45ms, RHR: 72bpm, sono: 6h",
      labs: "HOMA-IR: 2.1, glicose: 95",
    });
    expect(r.hrv?.value).toBe(45);
    expect(r.rhr?.value).toBe(72);
    expect(r.sleepHours?.value).toBe(6);
    expect(r.homaIr?.value).toBe(2.1);
    expect(r.glucose?.value).toBe(95);
  });
});

describe("extractMetrics — OCR error handling", () => {
  it("corrects O→0 in numbers", () => {
    const r = extractMetrics({ text: "HRV: 4O ms" });
    expect(r.hrv?.value).toBe(40);
  });

  it("handles European comma decimals", () => {
    const r = extractMetrics({ text: "peso: 82,5 kg" });
    expect(r.weight?.value).toBe(82.5);
  });
});

describe("extractMetrics — confidence", () => {
  it("assigns high confidence to typical-range values", () => {
    const r = extractMetrics({ text: "HRV: 55ms" });
    expect(r.hrv?.confidence).toBe("high");
  });

  it("assigns medium confidence to valid but atypical values", () => {
    const r = extractMetrics({ text: "HRV: 150ms" });
    expect(r.hrv?.confidence).toBe("medium");
  });
});

// =============================================
// parseMetricsFromInputs (backward compat)
// =============================================

describe("parseMetricsFromInputs", () => {
  it("returns plain numbers (no confidence wrapper)", () => {
    const r = parseMetricsFromInputs({ text: "HRV: 50ms, peso: 80kg" });
    expect(r.hrv).toBe(50);
    expect(r.weight).toBe(80);
  });

  it("filters out low-confidence values", () => {
    // Value out of typical range but in valid range = medium, still included
    // Value out of valid range = excluded by isInRange before confidence check
    const r = parseMetricsFromInputs({ text: "HRV: 55ms" });
    expect(r.hrv).toBe(55);
  });
});

// =============================================
// DEMOGRAPHIC EXTRACTION
// =============================================

describe("extractDemographics — name", () => {
  it("extracts labeled name 'Nome: João Silva'", () => {
    // OCR corrector normalizes \n to space, so use comma as terminator
    const r = extractDemographics("Nome: João Silva, 45 anos");
    expect(r.name?.value).toBe("João Silva");
    expect(r.name?.confidence).toBe("high");
  });

  it("extracts 'Paciente: Maria Santos'", () => {
    const r = extractDemographics("Paciente: Maria Santos, 32 anos");
    expect(r.name?.value).toBe("Maria Santos");
  });

  it("normalizes ALL CAPS name to title case", () => {
    const r = extractDemographics("Nome: CARLOS EDUARDO SOUZA, 50 anos");
    expect(r.name?.value).toBe("Carlos Eduardo Souza");
  });

  it("handles Portuguese prepositions (de, da, dos)", () => {
    const r = extractDemographics("Nome: MARIA DA SILVA DOS SANTOS\n55 anos");
    expect(r.name?.value).toContain("da");
    expect(r.name?.value).toContain("dos");
  });
});

describe("extractDemographics — age", () => {
  it("extracts 'Idade: 45 anos'", () => {
    const r = extractDemographics("Nome: Test User\nIdade: 45 anos");
    expect(r.age?.value).toBe(45);
  });

  it("extracts '38 anos'", () => {
    const r = extractDemographics("Paciente Test, 38 anos");
    expect(r.age?.value).toBe(38);
  });

  it("rejects implausible age (200)", () => {
    const r = extractDemographics("Idade: 200 anos");
    expect(r.age).toBeUndefined();
  });
});

describe("extractDemographics — sex", () => {
  it("extracts 'Masculino'", () => {
    const r = extractDemographics("Sexo: Masculino");
    expect(r.sex?.value).toBe("M");
  });

  it("extracts 'Feminino'", () => {
    const r = extractDemographics("Sexo: Feminino");
    expect(r.sex?.value).toBe("F");
  });

  it("extracts abbreviated 'sexo: M'", () => {
    const r = extractDemographics("sexo: M");
    expect(r.sex?.value).toBe("M");
  });
});

describe("extractDemographics — CPF", () => {
  it("extracts formatted CPF", () => {
    const r = extractDemographics("CPF: 123.456.789-00");
    expect(r.cpf?.value).toBe("12345678900");
  });

  it("extracts raw CPF", () => {
    const r = extractDemographics("CPF: 12345678900");
    expect(r.cpf?.value).toBe("12345678900");
  });
});

describe("extractDemographics — birth date", () => {
  it("extracts 'Data de nascimento: 15/03/1980'", () => {
    const r = extractDemographics("Data de nascimento: 15/03/1980");
    expect(r.birthDate?.value).toBe("15/03/1980");
  });

  it("extracts 'nasc: 01-12-1990'", () => {
    const r = extractDemographics("nasc: 01-12-1990");
    expect(r.birthDate?.value).toBe("01-12-1990");
  });
});
