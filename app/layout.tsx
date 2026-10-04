import { getLocale } from "next-intl/server";
import { resolveLocale } from "@/i18n/config";
import { LanguageProvider } from "@/components/i18n/LanguageProvider";
import type { Metadata } from "next";
import { Barlow_Condensed, Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { SessionProvider } from "next-auth/react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin", "latin-ext"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin", "latin-ext"],
});

const barlowCondensed = Barlow_Condensed({
  variable: "--font-barlow-condensed",
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600", "700", "800", "900"],
});

export const metadata: Metadata = {
  title: "BeeSmart",
  description: "BeeSmart Learning Platform",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = resolveLocale(await getLocale());
  return (
    <html lang={locale} suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var s=localStorage.getItem("beesmart-settings");if(s){var t=JSON.parse(s).theme;if(t==="ocean")t="blue";if(t==="forest")t="pink";if(t&&t!=="bee"){document.documentElement.setAttribute("data-theme",t);}}}catch(e){}})();`,
          }}
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${barlowCondensed.variable} antialiased`}
      >
        <LanguageProvider initialLocale={locale}>
          <TooltipProvider>
            <SessionProvider>
              <Toaster />
              {children}
            </SessionProvider>
          </TooltipProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}
