/**
 * Public link to a published patient portal report, built on the server so
 * the CRM can send it on WhatsApp. Needs PORTAL_PUBLIC_URL (the production
 * origin, e.g. https://kai-oskar.vercel.app); without it the link is unknown
 * and the CRM is not notified. Pure: safe to test.
 */
export function portalPublicUrl(token: string, base: string | undefined = process.env.PORTAL_PUBLIC_URL): string | null {
  const origin = base?.trim().replace(/\/+$/, "");
  if (!origin || !/^https?:\/\//.test(origin)) return null;
  return `${origin}/portal#${token}`;
}
