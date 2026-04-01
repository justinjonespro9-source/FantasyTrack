import Image from "next/image";
import Link from "next/link";
import { getCurrentSession } from "@/lib/session";
import SignOutButton from "@/components/ui/signout-button";

const navLink =
  "whitespace-nowrap text-sm text-neutral-400 transition duration-ft hover:text-ft-gold";

export default async function Nav() {
  const session = await getCurrentSession();

  return (
    <header className="sticky top-0 z-50 border-b border-white/[0.06] bg-ft-ink/80 shadow-ft-card backdrop-blur-xl">
      {/* Desktop / tablet header */}
      <div className="mx-auto hidden max-w-7xl items-center justify-between gap-4 px-4 py-3 md:flex">
        <Link href="/" className="shrink-0 flex items-center transition duration-ft hover:opacity-95">
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

        <div className="flex flex-1 items-center justify-end gap-4 lg:gap-8">
          <nav className="flex items-center gap-6 text-sm lg:gap-8">
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

          <div className="flex items-center gap-3 border-l border-white/[0.08] pl-4 text-sm">
            {session?.user ? (
              <>
                <span className="max-w-[10rem] truncate text-neutral-300">{session.user.displayName}</span>
                <SignOutButton />
              </>
            ) : (
              <>
                <Link
                  href="/auth/login"
                  className="rounded-full border border-white/10 px-3 py-1.5 text-neutral-200 transition duration-ft hover:border-ft-gold/40 hover:text-ft-gold"
                >
                  Log in
                </Link>
                <Link
                  href="/auth/signup"
                  className="rounded-full bg-ft-cta px-3 py-1.5 text-sm font-semibold text-neutral-950 shadow-ft-inner transition duration-ft hover:brightness-110 active:scale-[0.98]"
                >
                  Sign up
                </Link>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Mobile header */}
      <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-3 md:hidden">
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
                <span className="max-w-[7rem] truncate text-neutral-300">{session.user.displayName}</span>
                <SignOutButton />
              </>
            ) : (
              <>
                <Link
                  href="/auth/login"
                  className="rounded-full border border-white/10 px-2.5 py-1 text-neutral-200 hover:border-ft-gold/40"
                >
                  Log in
                </Link>
                <Link
                  href="/auth/signup"
                  className="rounded-full bg-ft-cta px-2.5 py-1 text-xs font-semibold text-neutral-950"
                >
                  Sign up
                </Link>
              </>
            )}
          </div>
        </div>

        <nav className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 border-t border-white/[0.05] pt-2 text-xs">
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
