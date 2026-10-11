export function normalizeCpf(input: string | null | undefined): string {
  return (input ?? "").replace(/\D/g, "");
}

function checkDigit(digits: string, length: number): number {
  let sum = 0;
  for (let i = 0; i < length; i++) sum += Number(digits[i]) * (length + 1 - i);
  const rest = (sum * 10) % 11;
  return rest === 10 ? 0 : rest;
}

export function isValidCpf(input: string | null | undefined): boolean {
  const d = normalizeCpf(input);
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  return checkDigit(d, 9) === Number(d[9]) && checkDigit(d, 10) === Number(d[10]);
}

/** Progressive input mask: "529982" -> "529.982", full -> "529.982.247-25". */
export function formatCpf(input: string): string {
  const d = normalizeCpf(input).slice(0, 11);
  const groups = [d.slice(0, 3), d.slice(3, 6), d.slice(6, 9), d.slice(9, 11)].filter(Boolean);
  if (groups.length <= 3) return groups.join(".");
  return `${groups.slice(0, 3).join(".")}-${groups[3]}`;
}

/** Display form that hides the first six digits: "***.***.247-25". */
export function maskCpf(input: string): string {
  const d = normalizeCpf(input);
  if (d.length !== 11) return "";
  return `***.***.${d.slice(6, 9)}-${d.slice(9)}`;
}
