"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Props = {
  hasHistory: boolean;
};

const STORAGE_KEY = "ft_onboarding_seen";

export function DashboardOnboardingCard({ hasHistory }: Props) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || hasHistory) return;
    const seen = window.localStorage.getItem(STORAGE_KEY);
    if (!seen) {
      setShow(true);
    }
  }, [hasHistory]);

  const dismiss = () => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, "1");
    }
    setShow(false);
  };

  if (!show) return null;

  return (
    <section className="mb-2 ft-surface rounded-ft-lg p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="ft-label text-neutral-500">Start here</p>
          <h2 className="mt-1 text-base font-bold tracking-tight text-neutral-50">
            Welcome to FantasyTrack
          </h2>
          <ul className="mt-3 space-y-1.5 text-xs leading-relaxed text-neutral-400">
            <li>Pick runners in active contests.</li>
            <li>Bet Win / Place / Show as odds move.</li>
            <li>Track your results and climb the board.</li>
          </ul>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              href="/dashboard"
              className="rounded-full bg-ft-cta px-4 py-2 text-xs font-bold text-neutral-950 shadow-ft-inner transition hover:brightness-110"
            >
              Enter the track
            </Link>
            <Link
              href="/how-to-play"
              className="rounded-full border border-white/[0.12] px-4 py-2 text-xs font-semibold text-neutral-200 transition hover:border-ft-gold/40 hover:text-ft-gold"
            >
              How it works
            </Link>
          </div>
        </div>
        <button
          type="button"
          onClick={dismiss}
          className="text-xs text-neutral-500 hover:text-neutral-200"
          aria-label="Dismiss onboarding"
        >
          ✕
        </button>
      </div>
    </section>
  );
}

