import { getScoringRules } from "@/lib/scoring-rules";

type ScoringRulesCardProps = {
  sport: string | null | undefined;
};

export function ScoringRulesCard({ sport }: ScoringRulesCardProps) {
  const sections = getScoringRules(sport);

  return (
    <section className="rounded-lg border border-neutral-800 bg-neutral-900/80 p-5 shadow-sm">
      <h2 className="text-lg font-semibold text-neutral-50">Scoring Rules</h2>
      <div className="mt-4 space-y-4">
        {sections.map((section) => (
          <div key={section.title}>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-neutral-400">
              {section.title}
            </h3>
            <ul className="mt-2 list-disc space-y-2 pl-5 text-sm leading-6 text-neutral-200">
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