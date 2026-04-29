import type { Metadata } from "next";
import { Epilogue, JetBrains_Mono, Noto_Nastaliq_Urdu } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import { routing } from "@/i18n/routing";
import { notFound } from "next/navigation";
import "../globals.css";

const epilogue = Epilogue({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-epilogue",
});
const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["500"],
  variable: "--font-jetbrains-mono",
});
const notoNastaliq = Noto_Nastaliq_Urdu({
  subsets: ["arabic"],
  variable: "--font-noto-nastaliq",
});

export const metadata: Metadata = {
  title: "WattHai | وَٹ ہے ",
  description: "Understand your bill. Save money.",
  manifest: "/manifest.json",
};

export const viewport = {
  themeColor: "#F59E0B",
};

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  if (!routing.locales.includes(locale as any)) {
    notFound();
  }

  const messages = await getMessages();

  return (
    <html
      lang={locale}
      dir={locale === "ur" ? "rtl" : "ltr"}
      className={`${epilogue.variable} ${jetbrainsMono.variable} ${notoNastaliq.variable}`}
    >
      <head>
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, viewport-fit=cover"
        />
      </head>
      <body className="bg-[var(--bg-base)] text-[var(--text-primary)] antialiased min-h-screen">
        <NextIntlClientProvider messages={messages}>
          <div className="mx-auto w-full max-w-5xl min-h-screen relative pb-[env(safe-area-inset-bottom)] md:pb-0">
            {children}
          </div>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
