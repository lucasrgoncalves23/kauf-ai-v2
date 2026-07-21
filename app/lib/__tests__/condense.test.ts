import { describe, it, expect, beforeEach, vi } from "vitest";
import { condenseInputs } from "../condense";
import type { ClinicalData } from "../../types/clinical";

// localStorage mock for getPinHeaders
const store: Record<string, string> = {};
vi.stubGlobal("localStorage", {
  getItem: (k: string) => store[k] ?? null,
  setItem: (k: string, v: string) => {
    store[k] = v;
  },
  removeItem: (k: string) => {
    delete store[k];
  },
});

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

function makeInputs(overrides: Partial<ClinicalData> = {}): ClinicalData {
  return {
    anamnese: "Paciente com fadiga.",
    bioimpedancia: "",
    laboratoriais: "",
    genetica: "",
    wearable: "",
    ...overrides,
  };
}

const BIG_TEXT = "Hemoglobina 14.2 g/dL ".repeat(1000); // > 15k chars

beforeEach(() => {
  fetchMock.mockReset();
});

describe("condenseInputs", () => {
  it("leaves small inputs untouched without calling the API", async () => {
    const inputs = makeInputs();
    const result = await condenseInputs(inputs);
    expect(result).toEqual(inputs);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("replaces oversized fields with the condensed summary", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ text: "HEMOGRAMA\nHemoglobina: 14.2 g/dL" }),
    });

    const inputs = makeInputs({ laboratoriais: BIG_TEXT });
    const result = await condenseInputs(inputs);

    expect(result.laboratoriais).toBe("HEMOGRAMA\nHemoglobina: 14.2 g/dL");
    expect(result.anamnese).toBe(inputs.anamnese);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("falls back to the raw text when the API fails", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 502, json: async () => ({}) });

    const inputs = makeInputs({ laboratoriais: BIG_TEXT + "unique-failure" });
    const result = await condenseInputs(inputs);

    expect(result.laboratoriais).toBe(BIG_TEXT + "unique-failure");
  });

  it("caches by content so repeated generations reuse the summary", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ text: "resumo" }),
    });

    const inputs = makeInputs({ genetica: BIG_TEXT + "unique-cache" });
    await condenseInputs(inputs);
    const second = await condenseInputs(inputs);

    expect(second.genetica).toBe("resumo");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("does not mutate the original inputs object", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ text: "resumo" }),
    });

    const inputs = makeInputs({ bioimpedancia: BIG_TEXT + "unique-mutate" });
    await condenseInputs(inputs);

    expect(inputs.bioimpedancia).toBe(BIG_TEXT + "unique-mutate");
  });
});
