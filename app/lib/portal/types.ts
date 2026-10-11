export type PublicationSummary = {
  id: string;
  status: string;
  createdAt: string;
  expiresAt: string;
  openCount: number;
  firstOpenedAt: string | null;
  lastOpenedAt: string | null;
  failedAttempts: number;
  lockedUntil: string | null;
  token?: string;
};

export function portalUrl(token: string): string {
  return `${window.location.origin}/portal#${token}`;
}
