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

  return (
    <>
      {/* Floating button */}
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="fixed bottom-4 right-4 z-40 rounded-full border border-amber-400/70 bg-amber-400 px-4 py-2 text-sm font-semibold text-neutral-950 shadow-lg shadow-amber-400/20 hover:bg-amber-300"
      >
        Give Feedback
      </button>

      {/* Modal */}
      {isOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <div className="w-full max-w-md rounded-xl border border-neutral-800 bg-neutral-950/95 p-5 shadow-2xl">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-neutral-50">Share your feedback</h2>
                <p className="mt-1 text-xs text-neutral-400">
                  Help shape the FantasyTrack experience. Coins are test-only during beta.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="rounded-full border border-neutral-700 px-2 py-1 text-xs text-neutral-400 hover:border-neutral-500 hover:text-neutral-200"
              >
                Close
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-medium text-neutral-200">
                  What do you like?
                </label>
                <textarea
                  value={likes}
                  onChange={(e) => setLikes(e.target.value)}
                  rows={3}
                  className="mt-1 w-full rounded-md border border-neutral-700 bg-neutral-950/80 p-2 text-sm text-neutral-100 outline-none focus:ring-2 focus:ring-amber-400/60"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-neutral-200">
                  What should change?
                </label>
                <textarea
                  value={changes}
                  onChange={(e) => setChanges(e.target.value)}
                  rows={3}
                  className="mt-1 w-full rounded-md border border-neutral-700 bg-neutral-950/80 p-2 text-sm text-neutral-100 outline-none focus:ring-2 focus:ring-amber-400/60"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-neutral-200">Feature ideas?</label>
                <textarea
                  value={ideas}
                  onChange={(e) => setIdeas(e.target.value)}
                  rows={3}
                  className="mt-1 w-full rounded-md border border-neutral-700 bg-neutral-950/80 p-2 text-sm text-neutral-100 outline-none focus:ring-2 focus:ring-amber-400/60"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-neutral-200">
                  Email (optional, for follow-up)
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-1 w-full rounded-md border border-neutral-700 bg-neutral-950/80 p-2 text-sm text-neutral-100 outline-none focus:ring-2 focus:ring-amber-400/60"
                  placeholder="you@example.com"
                />
              </div>

              {error ? (
                <p className="text-xs text-red-400">
                  {error}
                </p>
              ) : null}

              <div className="flex items-center justify-between pt-1">
                <p className="text-[11px] text-neutral-500">
                  We read every note, but may not respond individually.
                </p>
                <button
                  type="submit"
                  disabled={status === "submitting"}
                  className="rounded-full border border-amber-400/70 bg-amber-400 px-4 py-1.5 text-xs font-semibold text-neutral-950 hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {status === "submitting" ? "Sending..." : "Submit"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {/* Success toast */}
      {status === "success" ? (
        <div className="fixed bottom-4 right-4 z-50 rounded-md border border-emerald-400/70 bg-neutral-900/95 px-4 py-2 text-xs text-neutral-50 shadow-lg">
          Thanks — your feedback helps shape FantasyTrack.
        </div>
      ) : null}
    </>
  );
}

