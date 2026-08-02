"use client";

import { useState } from "react";
import { ContestLiveTape } from "@/components/contest-live-tape";
import { useHydratedMobile } from "@/lib/hooks/use-hydrated-mobile";

/** Single-mount Live Activity: accordion on mobile, always open on desktop; polls only when visible/needed. */
export function LiveActivitySection({ contestId }: { contestId: string }) {
  const [open, setOpen] = useState(false);
  const viewport = useHydratedMobile(768);
  const pollActive = !viewport.ready || !viewport.isMobile || open;

  return (
    <section className="overflow-hidden rounded-xl border border-white/[0.08] bg-black/25 md:overflow-visible md:rounded-none md:border-0 md:bg-transparent">
      <button
        type="button"
        className="flex h-11 w-full items-center px-3 text-left text-sm font-semibold text-neutral-100 md:hidden"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="flex-1">Live Activity</span>
        <span className="text-ft-gold/90" aria-hidden>
          {open ? "−" : "+"}
        </span>
      </button>
      <div
        className={[
          open ? "block" : "hidden",
          "border-t border-white/[0.06] p-3 md:block md:border-0 md:p-0",
        ].join(" ")}
      >
        <ContestLiveTape contestId={contestId} enabled={pollActive} />
      </div>
    </section>
  );
}
