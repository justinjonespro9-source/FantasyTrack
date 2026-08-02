import Image from "next/image";
import Link from "next/link";
import { getCurrentSession } from "@/lib/session";
import SignOutButton from "@/components/ui/signout-button";
import { NavLinks } from "@/components/nav-links";

export default async function Nav() {
  const session = await getCurrentSession();
  const isAdmin = Boolean(session?.user?.isAdmin);

  return (
    <header className="sticky top-0 z-50 border-b border-white/[0.06] bg-ft-ink/80 shadow-ft-card backdrop-blur-xl">
      <div className="mx-auto hidden max-w-6xl items-center justify-between gap-4 px-4 py-3.5 sm:px-5 md:flex">
        <Link
          href="/"
          className="flex shrink-0 items-center rounded-sm transition duration-ft hover:opacity-95 ft-focus-ring"
        >
          <span className="relative block h-[44px] w-[260px] overflow-hidden sm:h-[48px] sm:w-[320px] lg:h-[60px] lg:w-[380px]">
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
          <NavLinks isAdmin={isAdmin} />

          <div className="flex items-center gap-3 border-l border-white/[0.08] pl-4 text-sm">
            {session?.user ? (
              <>
                <span className="max-w-[10rem] truncate text-neutral-300">
                  {session.user.displayName}
                </span>
                <SignOutButton />
              </>
            ) : (
              <>
                <Link
                  href="/auth/login"
                  className="rounded-full border border-white/10 px-3 py-1.5 text-neutral-200 transition duration-ft hover:border-ft-gold/40 hover:text-ft-gold ft-focus-ring"
                >
                  Log in
                </Link>
                <Link
                  href="/auth/signup"
                  className="rounded-full bg-ft-cta px-3 py-1.5 text-sm font-semibold text-neutral-950 shadow-ft-inner transition duration-ft hover:brightness-110 active:scale-[0.98] ft-focus-ring"
                >
                  Sign up
                </Link>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-3 sm:px-5 md:hidden">
        <div className="flex items-center justify-between gap-3">
          <Link href="/" className="flex shrink-0 items-center rounded-sm ft-focus-ring">
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
                <span className="max-w-[7rem] truncate text-neutral-300">
                  {session.user.displayName}
                </span>
                <SignOutButton />
              </>
            ) : (
              <>
                <Link
                  href="/auth/login"
                  className="rounded-full border border-white/10 px-2.5 py-1 text-neutral-200 transition hover:border-ft-gold/40 ft-focus-ring"
                >
                  Log in
                </Link>
                <Link
                  href="/auth/signup"
                  className="rounded-full bg-ft-cta px-2.5 py-1 text-xs font-semibold text-neutral-950 shadow-ft-inner transition hover:brightness-110 ft-focus-ring"
                >
                  Sign up
                </Link>
              </>
            )}
          </div>
        </div>

        <div className="border-t border-white/[0.05] pt-2">
          <NavLinks isAdmin={isAdmin} compact />
        </div>
      </div>
    </header>
  );
}
