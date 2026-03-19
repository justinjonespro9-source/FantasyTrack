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
    <section className="mb-3 rounded-xl border border-neutral-800 bg-neutral-900/80 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-neutral-50">
            Welcome to FantasyTrack
          </h2>
          <ul className="mt-2 space-y-1 text-xs text-neutral-300">
            <li>Pick runners in active contests.</li>
            <li>Bet Win / Place / Show as odds move.</li>
            <li>Track your results and climb the board.</li>
          </ul>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link
              href="/dashboard"
              className="rounded-full bg-amber-400 px-3 py-1.5 text-xs font-semibold text-neutral-950 hover:bg-amber-300"
            >
              Enter the Track
            </Link>
            <Link
              href="/how-to-play"
              className="rounded-full border border-neutral-600 px-3 py-1.5 text-xs font-semibold text-neutral-100 hover:border-amber-400 hover:text-amber-400"
            >
              How It Works
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

