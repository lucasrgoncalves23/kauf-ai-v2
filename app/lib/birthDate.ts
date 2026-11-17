// Birth date helpers for the "Data Nasc." field (DD/MM/AAAA).

/** Age in whole years from a DD/MM/YYYY (or DD/MM/YY) date, or null if the date isn't valid/complete. */
export function ageFromBirthDate(raw: string, today: Date = new Date()): string | null {
  const m = raw.trim().match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2}|\d{4})$/);
  if (!m) return null;
  const day = Number(m[1]);
  const month = Number(m[2]);
  let year = Number(m[3]);
  if (m[3].length === 2) year += year > today.getFullYear() % 100 ? 1900 : 2000;
  const birth = new Date(year, month - 1, day);
  if (birth.getFullYear() !== year || birth.getMonth() !== month - 1 || birth.getDate() !== day) return null;
  if (birth > today) return null;
  let age = today.getFullYear() - year;
  const monthDiff = today.getMonth() - (month - 1);
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < day)) age--;
  return String(age);
}

const MAX_LEN = [2, 2, 4];

/**
 * Formats what the user typed into DD/MM/AAAA as they type: "23022002" →
 * "23/02/2002", and the slash appears as soon as the day or month is complete
 * ("23" → "23/"). A separator typed after one digit pads it ("5/" → "05/").
 * Pass the previous value so that backspacing over an auto slash removes it
 * instead of it being re-added.
 */
export function maskBirthDate(raw: string, prev = ""): string {
  const parts = ["", "", ""];
  let i = 0;
  for (const ch of raw) {
    if (/\d/.test(ch)) {
      if (parts[i].length === MAX_LEN[i]) {
        if (i === 2) break;
        i++;
      }
      parts[i] += ch;
    } else if (/[\/\-.\s]/.test(ch) && i < 2 && parts[i]) {
      parts[i] = parts[i].padStart(2, "0");
      i++;
    }
  }
  let out = parts[0];
  if (i >= 1) out += "/" + parts[1];
  if (i >= 2) out += "/" + parts[2];
  const deleting = raw.length < prev.length;
  if (!deleting && i < 2 && parts[i].length === MAX_LEN[i]) out += "/";
  else if (deleting && out.endsWith("/")) out = out.slice(0, -1);
  return out;
}
