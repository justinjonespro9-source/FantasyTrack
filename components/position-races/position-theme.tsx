import type { PositionRaceKey } from "@/lib/position-races/types";

export const POSITION_THEME: Record<
  PositionRaceKey,
  {
    label: string;
    chip: string;
    border: string;
    glow: string;
    accentText: string;
    iconPath: string;
  }
> = {
  QB: {
    label: "QB",
    chip: "border-violet-400/50 bg-violet-500/15 text-violet-200",
    border: "border-violet-400/35",
    glow: "shadow-[0_0_32px_-12px_rgba(167,139,250,0.45)]",
    accentText: "text-violet-300",
    iconPath:
      "M12 3l2.2 4.5L19 8.2l-3.5 3.4.8 4.9L12 14.2 7.7 16.5l.8-4.9L5 8.2l4.8-.7L12 3z",
  },
  RB: {
    label: "RB",
    chip: "border-emerald-400/50 bg-emerald-500/15 text-emerald-200",
    border: "border-emerald-400/35",
    glow: "shadow-[0_0_32px_-12px_rgba(52,211,153,0.4)]",
    accentText: "text-emerald-300",
    iconPath:
      "M4 12c2-4 5-6 8-6s6 2 8 6c-2 4-5 6-8 6s-6-2-8-6zm8-3a3 3 0 100 6 3 3 0 000-6z",
  },
  WR: {
    label: "WR",
    chip: "border-sky-400/50 bg-sky-500/15 text-sky-200",
    border: "border-sky-400/35",
    glow: "shadow-[0_0_32px_-12px_rgba(56,189,248,0.4)]",
    accentText: "text-sky-300",
    iconPath: "M3 12h4l2-6 3 12 2-8 2 4h5",
  },
  TE: {
    label: "TE",
    chip: "border-amber-400/50 bg-amber-500/15 text-amber-200",
    border: "border-amber-400/40",
    glow: "shadow-[0_0_32px_-12px_rgba(251,191,36,0.4)]",
    accentText: "text-amber-300",
    iconPath: "M6 18V8l6-4 6 4v10H6zm6-9a2 2 0 100 4 2 2 0 000-4z",
  },
};

export function PositionIcon({
  position,
  className = "h-4 w-4",
}: {
  position: PositionRaceKey;
  className?: string;
}) {
  const theme = POSITION_THEME[position];
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden fill="currentColor">
      <path d={theme.iconPath} />
    </svg>
  );
}
