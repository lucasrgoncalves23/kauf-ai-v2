import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: "Seu plano de saúde · Instituto Kaufmann",
  description: "Acesso seguro ao seu plano de saúde.",
  robots: { index: false, follow: false, nocache: true },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#ffffff",
};

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-slate-50 text-slate-900">{children}</div>;
}
