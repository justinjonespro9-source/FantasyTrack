"use client";

import { useState, type ReactNode } from "react";

type Section = {
  id: string;
  title: string;
  children: ReactNode;
};

type ResponsiveSecondarySectionsProps = {
  sections: Section[];
};

/**
 * Single-mount secondary panels.
 * - Mobile: collapsed accordion (content `hidden` until opened)
 * - Desktop (md+): always visible via `md:block` — no second component instance
 */
function SecondarySection({ title, children }: { title: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <section className="overflow-hidden rounded-xl border border-white/[0.08] bg-black/25 md:overflow-visible md:rounded-none md:border-0 md:bg-transparent">
      <button
        type="button"
        className="flex h-11 w-full items-center px-3 text-left text-sm font-semibold text-neutral-100 md:hidden"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="flex-1">{title}</span>
        <span className="text-ft-gold/90" aria-hidden>
          {open ? "−" : "+"}
        </span>
      </button>
      {/*
        SSR + hydration safe:
        - mobile: hidden until toggled (`hidden` / `block`)
        - md+: always shown (`md:block` overrides `hidden`)
        Children mount once — no duplicate tape/discussion instances.
      */}
      <div
        className={[
          open ? "block" : "hidden",
          "border-t border-white/[0.06] p-3 md:block md:border-0 md:p-0",
        ].join(" ")}
      >
        {children}
      </div>
    </section>
  );
}

export function ResponsiveSecondarySections({ sections }: ResponsiveSecondarySectionsProps) {
  return (
    <div className="flex flex-col gap-2 md:gap-4">
      {sections.map((section) => (
        <SecondarySection key={section.id} title={section.title}>
          {section.children}
        </SecondarySection>
      ))}
    </div>
  );
}
