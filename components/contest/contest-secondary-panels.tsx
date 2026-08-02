import { ContestMessageBoard } from "@/components/contest-message-board";
import { ScoringRulesCard } from "@/components/scoring-rules-card";
import { LiveActivitySection } from "@/components/contest/live-activity-section";
import { ResponsiveSecondarySections } from "@/components/contest/responsive-secondary-sections";

type ContestSecondaryPanelsProps = {
  contestId: string;
  sport: string;
  revalidatePath: string;
};

/**
 * Server Component: secondary panels mount once.
 * Live Activity is a dedicated client section (polls only when open on mobile).
 */
export function ContestSecondaryPanels({
  contestId,
  sport,
  revalidatePath,
}: ContestSecondaryPanelsProps) {
  return (
    <div className="flex flex-col gap-2 md:gap-4">
      <LiveActivitySection contestId={contestId} />
      <ResponsiveSecondarySections
        sections={[
          {
            id: "discussion",
            title: "Discussion",
            children: (
              <ContestMessageBoard contestId={contestId} revalidatePath={revalidatePath} />
            ),
          },
          {
            id: "rules",
            title: "Scoring Rules",
            children: <ScoringRulesCard sport={sport} />,
          },
          {
            id: "details",
            title: "Race Details",
            children: (
              <p className="text-sm leading-relaxed text-neutral-400">
                Rankings organize the field; the pool sets the odds. Amounts are free-play currency —
                not real-money wagering. Closing odds are preserved at lock.
              </p>
            ),
          },
        ]}
      />
    </div>
  );
}
