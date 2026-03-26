"use client";

import { FormEvent, useMemo, useState } from "react";

const MAX_X_POST_CHARS = 280;

export default function XPostComposer({
  connectedUsername,
}: {
  connectedUsername?: string | null;
}) {
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const remaining = useMemo(() => MAX_X_POST_CHARS - text.length, [text.length]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    const trimmed = text.trim();
    if (!trimmed) {
      setError("Post text is required.");
      return;
    }
    if (trimmed.length > MAX_X_POST_CHARS) {
      setError("Post text must be 280 characters or fewer.");
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch("/api/admin/x/post", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: trimmed }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        postId?: string | null;
      };

      if (!response.ok) {
        setError(payload.error ?? "Failed to publish to X.");
        return;
      }

      setText("");
      setSuccess(payload.postId ? `Posted to X. Post ID: ${payload.postId}` : "Posted to X.");
    } catch {
      setError("Network error while posting to X.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="text-sm text-neutral-300">
        Connected account:{" "}
        <span className="font-semibold text-amber-200">
          {connectedUsername ? `@${connectedUsername}` : "Unknown account"}
        </span>
      </div>

      <form onSubmit={onSubmit} className="space-y-2">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={4}
          maxLength={MAX_X_POST_CHARS}
          placeholder="Write your post..."
          className="w-full rounded border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-100 placeholder:text-neutral-500 focus:border-amber-400 focus:outline-none"
        />
        <div className="flex items-center justify-between">
          <span
            className={`text-xs ${remaining < 20 ? "text-amber-300" : "text-neutral-400"}`}
          >
            {text.length}/{MAX_X_POST_CHARS}
          </span>
          <button
            type="submit"
            disabled={submitting}
            className="rounded border border-amber-500/70 bg-amber-500/10 px-3 py-1.5 text-sm font-semibold text-amber-200 hover:bg-amber-500/20 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? "Posting..." : "Post to X"}
          </button>
        </div>
      </form>

      {error ? (
        <p className="rounded border border-red-500/70 bg-red-900/30 px-2 py-1 text-xs text-red-200">
          {error}
        </p>
      ) : null}
      {success ? (
        <p className="rounded border border-emerald-500/70 bg-emerald-900/30 px-2 py-1 text-xs text-emerald-200">
          {success}
        </p>
      ) : null}
    </div>
  );
}
