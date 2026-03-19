import Link from "next/link";

export default function SiteFooter() {
  return (
    <footer className="border-t border-neutral-800 bg-neutral-950/95">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-3 pb-4 text-xs text-neutral-400 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
            FantasyTrack
          </p>
          <p className="text-[11px] text-neutral-500">
            © {new Date().getFullYear()} SNG LABS. All rights reserved.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <div className="flex flex-wrap items-center gap-3 text-[11px]">
            <Link
              href="https://www.snglabs.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-neutral-400 hover:text-amber-300"
            >
              SNG LABS
            </Link>
            <Link
              href="https://www.linkedin.com/company/sng-labs/?viewAsMember=true"
              target="_blank"
              rel="noopener noreferrer"
              className="text-neutral-400 hover:text-amber-300"
            >
              LinkedIn
            </Link>
            <Link
              href="https://www.instagram.com/fantasytrackhq/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-neutral-400 hover:text-amber-300"
            >
              Instagram
            </Link>
            <Link
              href="https://x.com/FantasyTrackHQ"
              target="_blank"
              rel="noopener noreferrer"
              className="text-neutral-400 hover:text-amber-300"
            >
              X
            </Link>
            <Link
              href="https://discord.gg/UYHWmy8j"
              target="_blank"
              rel="noopener noreferrer"
              className="text-neutral-400 hover:text-amber-300"
            >
              Join our Discord
            </Link>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-[11px]">
            <Link href="/terms" className="text-neutral-400 hover:text-amber-300">
              Terms
            </Link>
            <span className="text-neutral-700">•</span>
            <Link href="/privacy" className="text-neutral-400 hover:text-amber-300">
              Privacy
            </Link>
            <span className="text-neutral-700">•</span>
            <Link href="/cookies" className="text-neutral-400 hover:text-amber-300">
              Cookies
            </Link>
            <span className="text-neutral-700">•</span>
            <Link href="/disclaimer" className="text-neutral-400 hover:text-amber-300">
              Disclaimer
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}

