import Link from "next/link";
import { getCurrentSession } from "@/lib/session";
import SignOutButton from "@/components/ui/signout-button";

/** Single canonical gold for nav brand + hovers */
const brandGold = "text-amber-400";
const navLink = "text-neutral-300 hover:text-amber-400";

export default async function Nav() {
  const session = await getCurrentSession();

  return (
    <header className="border-b border-neutral-800 bg-neutral-950/95 backdrop-blur-sm">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-4">
        <div className="flex flex-wrap items-center gap-4 sm:gap-6">
          <Link
            href="/"
            className={`text-lg font-semibold tracking-wide ${brandGold}`}
          >
            FantasyTrack
          </Link>

          <nav className="flex flex-wrap items-center gap-4 text-sm sm:gap-6">
            <Link href="/series" className={navLink}>
              Series
            </Link>
            <Link href="/me" className={navLink}>
              Profile
            </Link>
            <Link href="/how-to-play" className={navLink}>
              How it Works
            </Link>
            <Link href="/leaderboard" className={navLink}>
              Leaderboard
            </Link>
            {session?.user?.isAdmin && (
              <Link href="/admin" className={navLink}>
                Admin
              </Link>
            )}
          </nav>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-sm">
          {session?.user ? (
            <>
              <span className="text-neutral-300">{session.user.displayName}</span>
              <SignOutButton />
            </>
          ) : (
            <>
              <Link
                href="/auth/login"
                className="rounded border border-neutral-600 px-3 py-1 text-neutral-200 hover:border-amber-400 hover:text-amber-400"
              >
                Log in
              </Link>
              <Link
                href="/auth/signup"
                className="rounded bg-amber-400 px-3 py-1 font-semibold text-neutral-950 hover:bg-amber-300"
              >
                Sign up
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
