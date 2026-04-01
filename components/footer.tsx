import Link from "next/link";

export default function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-white/[0.06] bg-ft-charcoal/90">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-6 pb-8 text-xs text-neutral-500 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <p className="ft-label text-neutral-500">FantasyTrack</p>
          <p className="text-[11px] text-neutral-600">
            © {new Date().getFullYear()} SNG LABS. All rights reserved.
          </p>
        </div>

        <div className="flex flex-col gap-4 sm:items-end">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px]">
            <Link
              href="https://www.snglabs.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-neutral-500 transition hover:text-ft-gold"
            >
              SNG LABS
            </Link>
            <Link
              href="https://www.linkedin.com/company/sng-labs/?viewAsMember=true"
              target="_blank"
              rel="noopener noreferrer"
              className="text-neutral-500 transition hover:text-ft-gold"
            >
              LinkedIn
            </Link>
            <Link
              href="https://www.instagram.com/fantasytrackhq/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-neutral-500 transition hover:text-ft-gold"
            >
              Instagram
            </Link>
            <Link
              href="https://x.com/FantasyTrackHQ"
              target="_blank"
              rel="noopener noreferrer"
              className="text-neutral-500 transition hover:text-ft-gold"
            >
              X
            </Link>
            <Link
              href="https://discord.gg/JUshZthE"
              target="_blank"
              rel="noopener noreferrer"
              className="text-neutral-500 transition hover:text-ft-gold"
            >
              Join our Discord
            </Link>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-[11px]">
            <Link href="/terms" className="text-neutral-500 transition hover:text-ft-gold">
              Terms
            </Link>
            <span className="text-white/10">·</span>
            <Link href="/privacy" className="text-neutral-500 transition hover:text-ft-gold">
              Privacy
            </Link>
            <span className="text-white/10">·</span>
            <Link href="/cookies" className="text-neutral-500 transition hover:text-ft-gold">
              Cookies
            </Link>
            <span className="text-white/10">·</span>
            <Link href="/disclaimer" className="text-neutral-500 transition hover:text-ft-gold">
              Disclaimer
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
