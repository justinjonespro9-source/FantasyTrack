type SeriesStatusBannerProps = {
  status: "joined" | "alreadyMember";
  seriesName?: string | null;
};

function getBannerCopy(status: "joined" | "alreadyMember", seriesName?: string | null): string {
  const name = typeof seriesName === "string" ? seriesName.trim() : "";
  if (status === "joined") {
    return name ? `Joined ${name} successfully.` : "Series updated successfully.";
  }
  return name ? `You're already in ${name}.` : "You're already in this series.";
}

export function SeriesStatusBanner({ status, seriesName }: SeriesStatusBannerProps) {
  const copy = getBannerCopy(status, seriesName);
  const isJoined = status === "joined";

  return (
    <div
      role="status"
      className={
        isJoined
          ? "rounded-ft-lg border border-emerald-500/35 bg-emerald-500/[0.08] px-4 py-3 text-sm leading-relaxed text-emerald-100 shadow-inner"
          : "rounded-ft-lg border border-ft-gold/30 bg-ft-gold/[0.08] px-4 py-3 text-sm leading-relaxed text-ft-gold-bright shadow-inner"
      }
    >
      {copy}
    </div>
  );
}
