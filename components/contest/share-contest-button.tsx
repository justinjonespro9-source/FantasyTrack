"use client";

import { useState, useCallback } from "react";

type ShareContestButtonProps = {
  contestId: string;
  contestTitle?: string | null;
  className?: string;
};

function buildContestUrl(contestId: string): string {
  if (typeof window !== "undefined") {
    return `${window.location.origin}/contest/${contestId}`;
  }
  return `/contest/${contestId}`;
}

function buildShareText(contestUrl: string, contestTitle?: string | null): string {
  const headline = contestTitle?.trim()
    ? `Check out this ${contestTitle.trim()} race on FantasyTrack 👀`
    : "Check out this race on FantasyTrack 👀";
  return `${headline}

Player Performance Market powered by fantasy scoring.

Join here:
${contestUrl}`;
}

export function ShareContestButton({
  contestId,
  contestTitle,
  className = "",
}: ShareContestButtonProps) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const contestUrl = buildContestUrl(contestId);
  const shareText = buildShareText(contestUrl, contestTitle);

  const canNativeShare =
    typeof navigator !== "undefined" && typeof navigator.share === "function";

  const handleCopyLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(contestUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback for older browsers
      setCopied(false);
    }
  }, [contestUrl]);

  const handleNativeShare = useCallback(async () => {
    if (!canNativeShare) return;
    try {
      await navigator.share({
        title: contestTitle
          ? `${contestTitle} race on FantasyTrack`
          : "FantasyTrack race",
        text: shareText,
        url: contestUrl,
      });
      setOpen(false);
    } catch {
      // user canceled or share failed; do nothing
    }
  }, [canNativeShare, contestTitle, contestUrl, shareText]);

  const handleShareX = useCallback(() => {
    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}`;
    window.open(url, "_blank", "noopener,noreferrer");
    setOpen(false);
  }, [shareText]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={
          className ||
          "rounded border border-neutral-700 bg-neutral-950/80 px-3 py-2 text-sm font-medium text-neutral-200 hover:border-amber-300 hover:text-amber-200"
        }
      >
        Share Contest
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
          role="dialog"
          aria-labelledby="share-contest-title"
        >
          <div className="w-full max-w-sm rounded-xl border border-neutral-800 bg-neutral-950/95 p-5 shadow-2xl">
            <div className="mb-4 flex items-start justify-between gap-3">
              <h2 id="share-contest-title" className="text-base font-semibold text-neutral-50">
                Share this contest
              </h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-full border border-neutral-700 px-2 py-1 text-xs text-neutral-400 hover:border-neutral-500 hover:text-neutral-200"
                aria-label="Close"
              >
                Close
              </button>
            </div>

            <div className="space-y-3">
              {canNativeShare ? (
                <button
                  type="button"
                  onClick={handleNativeShare}
                  className="flex w-full items-center justify-between rounded-lg border border-amber-400/70 bg-amber-400 px-4 py-3 text-sm font-semibold text-neutral-950 hover:bg-amber-300"
                >
                  <span>Share</span>
                  <span className="text-xs text-neutral-900/80">Native share</span>
                </button>
              ) : null}

              <button
                type="button"
                onClick={handleCopyLink}
                className="flex w-full items-center justify-between rounded-lg border border-neutral-700 bg-neutral-900/80 px-4 py-3 text-sm font-medium text-neutral-100 hover:border-neutral-600 hover:bg-neutral-900"
              >
                <span>{copied ? "Contest link copied." : "Copy Link"}</span>
                {copied ? (
                  <span className="text-xs text-emerald-300">Copied</span>
                ) : null}
              </button>

              <button
                type="button"
                onClick={handleShareX}
                className="flex w-full items-center justify-between rounded-lg border border-neutral-700 bg-neutral-900/80 px-4 py-3 text-sm font-medium text-neutral-100 hover:border-neutral-600 hover:bg-neutral-900"
              >
                <span>Share to X</span>
                <span className="text-xs text-neutral-400">Opens X.com</span>
              </button>
            </div>

            <p className="mt-3 text-[11px] text-neutral-500">
              Invite friends to this race. The link goes directly to this page.
            </p>
          </div>
        </div>
      ) : null}
    </>
  );
}
