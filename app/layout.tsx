import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Inter } from "next/font/google";
import "./globals.css";
import Providers from "@/app/providers";
import Nav from "@/components/nav";
import FeedbackWidget from "@/components/feedback-widget";
import SiteFooter from "@/components/footer";
import SplashScreen from "@/components/splash-screen";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "FantasyTrack MVP",
  description: "Free-to-play parimutuel fantasy player market"
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} scroll-smooth`}>
      <body
        className={`${inter.className} min-h-screen bg-ft-ink bg-ft-radial-gold text-neutral-100 antialiased`}
      >
        <SplashScreen />
        <Providers>
          <Nav />
          <main className="mx-auto max-w-6xl px-4 py-8 sm:px-5 sm:py-10">{children}</main>
          <SiteFooter />
          <FeedbackWidget />
        </Providers>
      </body>
    </html>
  );
}
