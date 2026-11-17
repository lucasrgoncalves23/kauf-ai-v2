import { describe, it, expect } from "vitest";
import { ageFromBirthDate, maskBirthDate } from "../birthDate";

describe("maskBirthDate", () => {
  it("adds the slashes while typing digits", () => {
    let v = "";
    for (const d of "23022002") v = maskBirthDate(v + d, v);
    expect(v).toBe("23/02/2002");
  });

  it("shows the slash as soon as day or month is complete", () => {
    expect(maskBirthDate("23", "2")).toBe("23/");
    expect(maskBirthDate("23/02", "23/0")).toBe("23/02/");
  });

  it("backspacing over an auto slash removes it", () => {
    expect(maskBirthDate("23", "23/")).toBe("23");
    expect(maskBirthDate("23/02", "23/02/")).toBe("23/02");
    expect(maskBirthDate("23/", "23/0")).toBe("23");
  });

  it("pads a single digit when a separator is typed", () => {
    expect(maskBirthDate("5/", "5")).toBe("05/");
    expect(maskBirthDate("5/3/1990", "")).toBe("05/03/1990");
  });

  it("formats pasted dates and ignores extra digits and letters", () => {
    expect(maskBirthDate("23022002", "")).toBe("23/02/2002");
    expect(maskBirthDate("23-02-2002", "")).toBe("23/02/2002");
    expect(maskBirthDate("23/02/20021", "23/02/2002")).toBe("23/02/2002");
    expect(maskBirthDate("2a", "2")).toBe("2");
  });
});

describe("ageFromBirthDate", () => {
  const today = new Date(2026, 10, 17);
  it("computes age from a full date", () => {
    expect(ageFromBirthDate("23/02/2002", today)).toBe("24");
    expect(ageFromBirthDate("18/11/2002", today)).toBe("23");
  });
  it("is null for incomplete or invalid dates", () => {
    expect(ageFromBirthDate("23/02/", today)).toBeNull();
    expect(ageFromBirthDate("31/02/2002", today)).toBeNull();
  });
});
