export const CLINIC = {
  doctor: "Dr. Oskar Kaufmann",
  crm: "CRM-SP 104.028",
  name: "Instituto Kaufmann",
  tagline: "Medicina Integrativa",
} as const;

export function getClinicContactLine(): string | null {
  const value = process.env.CLINIC_CONTACT_LINE?.trim();
  return value ? value : null;
}
