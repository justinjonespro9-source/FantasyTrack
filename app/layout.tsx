import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import Providers from "@/app/providers";
import Nav from "@/components/nav";
import FeedbackWidget from "@/components/feedback-widget";
import SiteFooter from "@/components/footer";

export const metadata: Metadata = {
  title: "FantasyTrack MVP",
  description: "Free-to-play parimutuel fantasy player market"
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-neutral-950 text-neutral-100 antialiased">
        <Providers>
          <Nav />
          <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
          <SiteFooter />
          <FeedbackWidget />
        </Providers>
      </body>
    </html>
  );
}
