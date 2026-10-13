import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Kauf AI",
  description: "Clinical Cognition Engine",
  applicationName: "Kaufmann AI",
  icons: { apple: "/apple-touch-icon.png" },
  // Standalone window when installed via Safari "Add to Dock" / iOS "Add to Home Screen"
  appleWebApp: { capable: true, title: "Kaufmann AI", statusBarStyle: "default" },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" className={inter.variable}>
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
