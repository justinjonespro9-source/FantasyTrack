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
          ? "rounded-lg border border-emerald-400/60 bg-emerald-500/10 px-4 py-2.5 text-sm text-emerald-100"
          : "rounded-lg border border-amber-400/50 bg-amber-500/10 px-4 py-2.5 text-sm text-amber-100"
      }
    >
      {copy}
    </div>
  );
}
