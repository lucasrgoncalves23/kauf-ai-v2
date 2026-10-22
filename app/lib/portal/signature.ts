// Server-only: simple electronic signature (Lei 14.063/2020, art. 4º, I) of a portal publication.
// The doctor's drawn signature plus a SHA-256 of the exact payload the patient will see.
import { createHash } from "crypto";
import { safeCompare } from "../auth";
import { CLINIC } from "../clinic";
import type { PortalPayload, PortalSignature } from "./payload";

const MAX_IMAGE_BYTES = 150_000;
const PNG_DATA_URL = /^data:image\/png;base64,[A-Za-z0-9+/]+=*$/;

/** JSON with sorted keys, so the hash survives JSONB's key reordering and can be re-verified later. */
export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(",")}}`;
  }
  return JSON.stringify(value ?? null);
}

/** Hash of what the doctor signed. The link expiry is excluded so a reissued link keeps the same signature. */
export function payloadHash(payload: PortalPayload): string {
  const { signature: _signature, expiresAt: _expiresAt, ...signed } = payload;
  void _signature;
  void _expiresAt;
  return createHash("sha256").update(canonicalJson(signed)).digest("hex");
}

/** "A7F3-9C2B-41DE-08F5": first 64 bits of the hash, grouped for reading aloud or typing. */
export function verificationCode(hash: string): string {
  return (hash.slice(0, 16).toUpperCase().match(/.{4}/g) ?? []).join("-");
}

export function isValidSignatureImage(image: unknown): image is string {
  return typeof image === "string" && image.length <= MAX_IMAGE_BYTES && PNG_DATA_URL.test(image);
}

/** Optional personal code for Dr. Oskar, separate from the shared clinic PIN. */
export function signingPinRequired(): boolean {
  return Boolean(process.env.DOCTOR_SIGNING_PIN?.trim());
}

export function verifySigningPin(pin: unknown): boolean {
  const expected = process.env.DOCTOR_SIGNING_PIN?.trim();
  if (!expected) return true;
  return typeof pin === "string" && safeCompare(pin.trim(), expected);
}

export function signPayload(payload: PortalPayload, image: string, signedAt: string): PortalPayload {
  const hash = payloadHash(payload);
  const signature: PortalSignature = {
    signer: CLINIC.doctor,
    crm: CLINIC.crm,
    signedAt,
    hash,
    code: verificationCode(hash),
    image,
  };
  return { ...payload, signature };
}
