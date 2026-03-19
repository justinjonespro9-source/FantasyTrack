"use client";

import { useState } from "react";

export function ImportNBAButton() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleClick() {
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch("/api/internal/import-nba", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage(data.error ?? `Error ${res.status}`);
        return;
      }
      setMessage(data.message ?? "Import complete.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Request failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        className="rounded bg-amber-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-amber-500 disabled:opacity-60"
      >
        {loading ? "Importing…" : "Import NBA (SportsDataIO)"}
      </button>
      {message && (
        <span className="text-xs text-neutral-300 max-w-md truncate" title={message}>
          {message}
        </span>
      )}
    </span>
  );
}
