import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "@fontsource/koulen";
import "./globals.css";
import { AppLayout } from "@/components/layout/AppLayout";
import { FocusProvider } from "@/components/focus/FocusProvider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "BeeSmart",
  description: "BeeSmart Learning Platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        style={{ fontFamily: "'Koulen', sans-serif" }}
      >
        <FocusProvider>
          <AppLayout>{children}</AppLayout>
        </FocusProvider>
      </body>
    </html>
  );
}
