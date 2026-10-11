import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  hkdfSync,
  randomBytes,
  timingSafeEqual,
} from "crypto";

export class PortalNotConfiguredError extends Error {
  constructor() {
    super("PORTAL_SECRET não configurado no servidor");
    this.name = "PortalNotConfiguredError";
  }
}

const HKDF_SALT = "kauf-ai-portal-v1";
const TOKEN_SHAPE = /^[A-Za-z0-9_-]{43}$/;

let cache: { secret: string; hash: Buffer; enc: Buffer } | null = null;

function keys(): { hash: Buffer; enc: Buffer } {
  const secret = process.env.PORTAL_SECRET?.trim();
  if (!secret || secret.length < 32) throw new PortalNotConfiguredError();
  if (cache?.secret !== secret) {
    const ikm = Buffer.from(secret, "utf8");
    cache = {
      secret,
      hash: Buffer.from(hkdfSync("sha256", ikm, HKDF_SALT, "hash", 32)),
      enc: Buffer.from(hkdfSync("sha256", ikm, HKDF_SALT, "enc", 32)),
    };
  }
  return cache;
}

export function isPortalConfigured(): boolean {
  try {
    keys();
    return true;
  } catch {
    return false;
  }
}

export function newToken(): string {
  return randomBytes(32).toString("base64url");
}

export function isTokenShaped(value: unknown): value is string {
  return typeof value === "string" && TOKEN_SHAPE.test(value);
}

function hmac(purpose: string, value: string): string {
  return createHmac("sha256", keys().hash).update(`${purpose}\u0000${value}`).digest("hex");
}

export const hashToken = (token: string): string => hmac("token", token);
export const hashCpf = (cpfDigits: string): string => hmac("cpf", cpfDigits);
export const hashIp = (ip: string): string => hmac("ip", ip);

export function hmacEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a, "hex");
  const bb = Buffer.from(b, "hex");
  return ba.length > 0 && ba.length === bb.length && timingSafeEqual(ba, bb);
}

export function encryptToken(token: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", keys().enc, iv);
  const ciphertext = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), ciphertext]).toString("base64url");
}

export function decryptToken(encoded: string): string {
  const buf = Buffer.from(encoded, "base64url");
  const decipher = createDecipheriv("aes-256-gcm", keys().enc, buf.subarray(0, 12));
  decipher.setAuthTag(buf.subarray(12, 28));
  return Buffer.concat([decipher.update(buf.subarray(28)), decipher.final()]).toString("utf8");
}
