import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { SiteHeader } from "@/components/SiteHeader";
import { createClient } from "@/lib/supabase/server";
import { I18nProvider } from "@/lib/i18n/context";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "MutfakAI — Dolabını yönet, şef AI ile pişir",
  description:
    "Mutfak envanteri, tarif önerileri ve stoktan otomatik düşüm ile mutfağını akıllıca yönet.",
  icons: {
    icon: "/logo.png",
    apple: "/logo.png",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const meta = user?.user_metadata as { first_name?: string; last_name?: string } | undefined;
  const displayName = [meta?.first_name, meta?.last_name].filter(Boolean).join(" ") || null;

  return (
    <html
      lang="tr"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-[var(--background)] font-sans text-[var(--foreground)]">
        <I18nProvider>
          <SiteHeader email={user?.email ?? null} displayName={displayName} />
          <main className="flex-1">{children}</main>
        </I18nProvider>
      </body>
    </html>
  );
}
