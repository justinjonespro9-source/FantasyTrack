import Image from "next/image";
import Link from "next/link";
import { getCurrentSession } from "@/lib/session";
import SignOutButton from "@/components/ui/signout-button";

const navLink = "whitespace-nowrap text-neutral-300 hover:text-amber-400";

export default async function Nav() {
  const session = await getCurrentSession();

  return (
    <header className="border-b border-neutral-800 bg-black">
      {/* Desktop / tablet header */}
      <div className="mx-auto hidden max-w-7xl items-center justify-between gap-4 px-4 py-2 md:flex">
        <Link href="/" className="shrink-0 flex items-center">
          <span className="relative block h-[44px] sm:h-[48px] lg:h-[60px] w-[260px] sm:w-[320px] lg:w-[380px] overflow-hidden">
            <Image
              src="/fantasytrack-wordmark-header-clean.png"
              alt="FantasyTrack"
              fill
              priority
              className="object-cover"
              style={{
                objectPosition: "left center",
                transform: "translateY(6px)",
              }}
            />
          </span>
        </Link>

        <div className="flex flex-1 items-center justify-end gap-4 lg:gap-6">
          <nav className="flex items-center gap-5 text-sm lg:gap-7">
            <Link href="/dashboard" className={navLink}>
              Enter the Track
            </Link>
            <Link href="/how-to-play" className={navLink}>
              How it Works
            </Link>
            <Link href="/leaderboard" className={navLink}>
              Leaderboard
            </Link>
            <Link href="/me" className={navLink}>
              Profile
            </Link>
            {session?.user?.isAdmin && (
              <Link href="/admin" className={navLink}>
                Admin
              </Link>
            )}
          </nav>

          <div className="flex items-center gap-3 text-sm">
            {session?.user ? (
              <>
                <span className="whitespace-nowrap text-neutral-300">
                  {session.user.displayName}
                </span>
                <SignOutButton />
              </>
            ) : (
              <>
                <Link
                  href="/auth/login"
                  className="rounded border border-neutral-600 px-2.5 py-0.5 text-neutral-200 hover:border-amber-400 hover:text-amber-400"
                >
                  Log in
                </Link>
                <Link
                  href="/auth/signup"
                  className="rounded bg-amber-400 px-2.5 py-0.5 font-semibold text-neutral-950 hover:bg-amber-300"
                >
                  Sign up
                </Link>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Mobile header */}
      <div className="mx-auto flex max-w-7xl flex-col gap-1 px-4 py-2 md:hidden">
        <div className="flex items-center justify-between gap-3">
          <Link href="/" className="shrink-0 flex items-center">
            <span className="relative block h-[34px] w-[220px] overflow-hidden">
              <Image
                src="/fantasytrack-wordmark-header-clean.png"
                alt="FantasyTrack"
                fill
                priority
                className="object-cover"
                style={{
                  objectPosition: "left center",
                  transform: "translateY(4px)",
                }}
              />
            </span>
          </Link>

          <div className="flex items-center gap-2 text-xs">
            {session?.user ? (
              <>
                <span className="whitespace-nowrap text-neutral-300">
                  {session.user.displayName}
                </span>
                <SignOutButton />
              </>
            ) : (
              <>
                <Link
                  href="/auth/login"
                  className="rounded border border-neutral-600 px-2 py-0.5 text-neutral-200 hover:border-amber-400 hover:text-amber-400"
                >
                  Log in
                </Link>
                <Link
                  href="/auth/signup"
                  className="rounded bg-amber-400 px-2 py-0.5 font-semibold text-neutral-950 hover:bg-amber-300"
                >
                  Sign up
                </Link>
              </>
            )}
          </div>
        </div>

        <nav className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs">
          <Link href="/dashboard" className={navLink}>
            Enter the Track
          </Link>
          <Link href="/how-to-play" className={navLink}>
            How it Works
          </Link>
          <Link href="/leaderboard" className={navLink}>
            Leaderboard
          </Link>
          <Link href="/me" className={navLink}>
            Profile
          </Link>
          {session?.user?.isAdmin && (
            <Link href="/admin" className={navLink}>
              Admin
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}