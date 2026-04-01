"use client";

import { useEffect, useState } from "react";

type Status = "idle" | "submitting" | "success" | "error";

export default function FeedbackWidget() {
  const [mounted, setMounted] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [likes, setLikes] = useState("");
  const [changes, setChanges] = useState("");
  const [ideas, setIdeas] = useState("");
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (status === "success") {
      const timeout = setTimeout(() => {
        setStatus("idle");
      }, 3500);
      return () => clearTimeout(timeout);
    }
  }, [status]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (status === "submitting") return;

    setStatus("submitting");
    setError(null);

    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ likes, changes, ideas, email }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to submit feedback.");
      }

      setStatus("success");
      setIsOpen(false);
      setLikes("");
      setChanges("");
      setIdeas("");
      setEmail("");
    } catch (err: any) {
      setStatus("error");
      setError(err?.message || "Failed to submit feedback.");
    }
  }

  if (!mounted) return null;

  const fieldClass = "mt-1 w-full ft-input";

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="fixed bottom-4 right-4 z-40 rounded-full bg-ft-cta px-4 py-2.5 text-sm font-bold text-neutral-950 shadow-ft-card transition duration-ft hover:brightness-110 active:scale-[0.98] ft-focus-ring sm:bottom-6 sm:right-6"
      >
        Give feedback
      </button>

      {isOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 px-4 backdrop-blur-[2px]">
          <div className="w-full max-w-md rounded-ft-lg border border-white/[0.1] bg-ft-charcoal/98 p-5 shadow-ft-card backdrop-blur-md sm:p-6">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <p className="ft-label text-neutral-500">Beta</p>
                <h2 className="mt-1 text-base font-bold tracking-tight text-neutral-50">
                  Share your feedback
                </h2>
                <p className="mt-2 text-xs leading-relaxed text-neutral-500">
                  Help shape the FantasyTrack experience. Coins are test-only during beta.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="rounded-full border border-white/10 px-3 py-1 text-xs font-semibold text-neutral-500 transition hover:border-white/25 hover:text-neutral-200 ft-focus-ring"
              >
                Close
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-medium text-neutral-400">What do you like?</label>
                <textarea
                  value={likes}
                  onChange={(e) => setLikes(e.target.value)}
                  rows={3}
                  className={fieldClass}
                />
              </div>

              <div>
                <label className="text-xs font-medium text-neutral-400">What should change?</label>
                <textarea
                  value={changes}
                  onChange={(e) => setChanges(e.target.value)}
                  rows={3}
                  className={fieldClass}
                />
              </div>

              <div>
                <label className="text-xs font-medium text-neutral-400">Feature ideas?</label>
                <textarea
                  value={ideas}
                  onChange={(e) => setIdeas(e.target.value)}
                  rows={3}
                  className={fieldClass}
                />
              </div>

              <div>
                <label className="text-xs font-medium text-neutral-400">
                  Email (optional, for follow-up)
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={fieldClass}
                  placeholder="you@example.com"
                />
              </div>

              {error ? <p className="text-xs text-red-400">{error}</p> : null}

              <div className="flex flex-col gap-3 border-t border-white/[0.06] pt-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-[11px] text-neutral-600">
                  We read every note, but may not respond individually.
                </p>
                <button
                  type="submit"
                  disabled={status === "submitting"}
                  className="shrink-0 rounded-full bg-ft-cta px-5 py-2 text-xs font-bold text-neutral-950 shadow-ft-inner transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60 ft-focus-ring"
                >
                  {status === "submitting" ? "Sending…" : "Submit"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {status === "success" ? (
        <div className="fixed bottom-4 right-4 z-50 rounded-ft border border-emerald-500/35 bg-emerald-950/90 px-4 py-2.5 text-xs text-emerald-100 shadow-ft-card sm:bottom-6 sm:right-6">
          Thanks — your feedback helps shape FantasyTrack.
        </div>
      ) : null}
    </>
  );
}
