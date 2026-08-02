import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Inter } from "next/font/google";
import "./globals.css";
import Providers from "@/app/providers";
import Nav from "@/components/nav";
import FeedbackWidget from "@/components/feedback-widget";
import SiteFooter from "@/components/footer";
import SplashScreen from "@/components/splash-screen";
import { getSeoBaseUrl } from "@/lib/site-url";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

const siteName = "FantasyTrack";
const defaultDescription =
  "Free-to-play fantasy sports where athlete performance drives a live parimutuel market. Pick runners, follow the leaderboard, and win on the podium.";

export const metadata: Metadata = {
  metadataBase: new URL(getSeoBaseUrl()),
  title: {
    default: siteName,
    template: `%s | ${siteName}`,
  },
  description: defaultDescription,
  applicationName: siteName,
  openGraph: {
    type: "website",
    locale: "en_US",
    siteName,
    title: siteName,
    description: defaultDescription,
    images: [
      {
        url: "/fantasytrack-wordmark-gold-clean.png",
        alt: "FantasyTrack",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: siteName,
    description: defaultDescription,
    images: ["/fantasytrack-wordmark-gold-clean.png"],
  },
  icons: {
    icon: "/fantasytrack-wordmark-gold-clean.png",
    apple: "/fantasytrack-wordmark-gold-clean.png",
  },
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
          <main className="mx-auto max-w-6xl px-4 py-5 sm:px-5 sm:py-6 md:py-7">{children}</main>
          <SiteFooter />
          <FeedbackWidget />
        </Providers>
      </body>
    </html>
  );
}
