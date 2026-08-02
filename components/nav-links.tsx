"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const base =
  "whitespace-nowrap rounded-sm text-sm transition duration-ft ft-focus-ring";

function linkClass(active: boolean) {
  return [
    base,
    active ? "font-semibold text-ft-gold" : "text-neutral-400 hover:text-ft-gold focus-visible:text-ft-gold",
  ].join(" ");
}

export function NavLinks({
  isAdmin,
  compact = false,
}: {
  isAdmin?: boolean;
  compact?: boolean;
}) {
  const pathname = usePathname() || "/";
  const onRaces = pathname === "/races" || pathname.startsWith("/races/");
  const onTrack = pathname === "/dashboard" || pathname.startsWith("/dashboard/");
  const onLeaderboard = pathname === "/leaderboard" || pathname.startsWith("/leaderboard/");
  const onHow = pathname === "/how-to-play";
  const onMe = pathname === "/me" || pathname.startsWith("/profile");
  const onAdmin = pathname.startsWith("/admin");

  const wrap = compact
    ? "flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs"
    : "flex items-center gap-6 text-sm lg:gap-8";

  return (
    <nav className={wrap} aria-label="Primary">
      <Link href="/races" className={linkClass(onRaces)} aria-current={onRaces ? "page" : undefined}>
        Races
      </Link>
      <Link href="/dashboard" className={linkClass(onTrack)} aria-current={onTrack ? "page" : undefined}>
        My Track
      </Link>
      <Link
        href="/leaderboard"
        className={linkClass(onLeaderboard)}
        aria-current={onLeaderboard ? "page" : undefined}
      >
        Leaderboard
      </Link>
      <Link href="/how-to-play" className={linkClass(onHow)} aria-current={onHow ? "page" : undefined}>
        How It Works
      </Link>
      <Link href="/me" className={linkClass(onMe)} aria-current={onMe ? "page" : undefined}>
        Profile
      </Link>
      {isAdmin ? (
        <Link href="/admin" className={linkClass(onAdmin)} aria-current={onAdmin ? "page" : undefined}>
          Admin
        </Link>
      ) : null}
    </nav>
  );
}
