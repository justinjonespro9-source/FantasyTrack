"use client";

import { type FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  initialDisplayName: string;
};

export default function DisplayNameForm({ initialDisplayName }: Props) {
  const router = useRouter();
  const [displayName, setDisplayName] = useState(initialDisplayName);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);

    const response = await fetch("/api/profile", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ displayName })
    });

    const payload = (await response.json().catch(() => ({}))) as { error?: string };
    setLoading(false);

    if (!response.ok) {
      setError(payload.error ?? "Unable to update display name.");
      return;
    }

    setMessage("Display name updated.");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-2">
      <div className="space-y-1">
        <label className="text-[11px] font-medium uppercase tracking-wide text-neutral-400">
          Display name
        </label>
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            className="w-full max-w-xs rounded-md border border-neutral-700 bg-neutral-950/80 px-2 py-1.5 text-sm text-neutral-100 outline-none focus:ring-2 focus:ring-amber-400/60"
            minLength={2}
            maxLength={40}
            required
          />
          <button
            type="submit"
            disabled={loading}
            className="rounded-md border border-amber-400/70 bg-amber-400 px-3 py-1.5 text-xs font-semibold text-neutral-950 hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {loading ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
      {error && <p className="text-xs text-red-300">{error}</p>}
      {message && <p className="text-xs text-emerald-300">{message}</p>}
    </form>
  );
}

