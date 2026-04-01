import { getScoringRules } from "@/lib/scoring-rules";

type ScoringRulesCardProps = {
  sport: string | null | undefined;
  /** Flatten styles when nested inside another surface (e.g. mobile accordion). */
  plain?: boolean;
};

export function ScoringRulesCard({ sport, plain }: ScoringRulesCardProps) {
  const sections = getScoringRules(sport);

  return (
    <section className={plain ? "space-y-5" : "ft-surface p-5 sm:p-6"}>
      <h2 className="text-base font-bold tracking-tight text-neutral-50">Scoring rules</h2>
      <div className="mt-5 space-y-5">
        {sections.map((section) => (
          <div key={section.title}>
            <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-neutral-500">
              {section.title}
            </h3>
            <ul className="mt-2 list-disc space-y-2 pl-5 text-sm leading-relaxed text-neutral-300">
              {section.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}