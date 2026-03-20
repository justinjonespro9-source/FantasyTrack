"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { formatDateTime } from "@/lib/format";

type SeriesRow = { id: string; name: string };
type ContestRow = { id: string; title: string };
type ShoutoutRow = {
  id: string;
  scope: "GLOBAL" | "SERIES";
  message: string;
  createdAt: string;
  seriesId: string | null;
  seriesName: string | null;
  contestId: string | null;
  contestTitle: string | null;
};

export default function CommishNotesManager({
  seriesList,
  activeContests,
}: {
  seriesList: SeriesRow[];
  activeContests: ContestRow[];
}) {
  const [shoutouts, setShoutouts] = useState<ShoutoutRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [scope, setScope] = useState<"GLOBAL" | "SERIES">("GLOBAL");
  const [seriesId, setSeriesId] = useState("");
  const [contestId, setContestId] = useState("");
  const [message, setMessage] = useState("");
  const [posting, setPosting] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editScope, setEditScope] = useState<"GLOBAL" | "SERIES">("GLOBAL");
  const [editSeriesId, setEditSeriesId] = useState("");
  const [editContestId, setEditContestId] = useState("");
  const [editMessage, setEditMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadShoutouts = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/admin/shoutouts", { cache: "no-store" });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        shoutouts?: ShoutoutRow[];
      };
      if (!res.ok) throw new Error(data.error ?? "Failed to load notes.");
      setShoutouts(Array.isArray(data.shoutouts) ? data.shoutouts : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load notes.");
      setShoutouts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadShoutouts();
  }, [loadShoutouts]);

  async function createNote() {
    if (!message.trim()) return;
    if (scope === "SERIES" && !seriesId) {
      setError("Series is required for series posts.");
      return;
    }

    setError(null);
    setPosting(true);
    try {
      const res = await fetch("/api/admin/shoutouts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scope,
          seriesId: scope === "SERIES" ? seriesId : null,
          contestId: contestId || null,
          message: message.trim(),
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; ok?: boolean };
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Failed to create note.");

      setMessage("");
      setContestId("");
      if (scope === "GLOBAL") setSeriesId("");
      await loadShoutouts();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create note.");
    } finally {
      setPosting(false);
    }
  }

  function startEdit(s: ShoutoutRow) {
    setEditingId(s.id);
    setEditScope(s.scope);
    setEditSeriesId(s.seriesId ?? "");
    setEditContestId(s.contestId ?? "");
    setEditMessage(s.message);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditScope("GLOBAL");
    setEditSeriesId("");
    setEditContestId("");
    setEditMessage("");
  }

  async function saveEdit() {
    if (!editingId) return;
    if (!editMessage.trim()) {
      setError("Message is required.");
      return;
    }
    if (editScope === "SERIES" && !editSeriesId) {
      setError("Series is required for series posts.");
      return;
    }

    setError(null);
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/shoutouts/${editingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scope: editScope,
          seriesId: editScope === "SERIES" ? editSeriesId : null,
          contestId: editContestId || null,
          message: editMessage.trim(),
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; ok?: boolean };
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Failed to update note.");

      cancelEdit();
      await loadShoutouts();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update note.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteNote(id: string) {
    if (!window.confirm("Delete this Commish Note?")) return;
    setError(null);
    setDeletingId(id);
    try {
      const res = await fetch(`/api/admin/shoutouts/${id}`, { method: "DELETE" });
      const data = (await res.json().catch(() => ({}))) as { error?: string; ok?: boolean };
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Failed to delete note.");
      if (editingId === id) cancelEdit();
      await loadShoutouts();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete note.");
    } finally {
      setDeletingId(null);
    }
  }

  const activeContestsOptions = useMemo(
    () => [{ id: "", title: "Optional contest" }, ...activeContests],
    [activeContests]
  );

  return (
    <div className="space-y-3">
      <div className="rounded border border-track-200 p-3 space-y-2">
        <div className="grid gap-2 md:grid-cols-3">
          <select
            value={scope}
            onChange={(e) => setScope(e.target.value as "GLOBAL" | "SERIES")}
            className="w-full"
          >
            <option value="GLOBAL">Main / Global post</option>
            <option value="SERIES">Series-specific post</option>
          </select>

          <select
            value={seriesId}
            onChange={(e) => setSeriesId(e.target.value)}
            disabled={scope !== "SERIES"}
            className="w-full disabled:opacity-60"
          >
            <option value="">Select series</option>
            {seriesList.map((series) => (
              <option key={series.id} value={series.id}>
                {series.name}
              </option>
            ))}
          </select>

          <select value={contestId} onChange={(e) => setContestId(e.target.value)} className="w-full">
            {activeContestsOptions.map((contest) => (
              <option key={contest.id || "none"} value={contest.id}>
                {contest.title}
              </option>
            ))}
          </select>
        </div>

        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Note"
          className="min-h-24 w-full"
        />

        <button
          type="button"
          onClick={createNote}
          disabled={posting}
          className="rounded bg-track-800 px-3 py-1 text-white disabled:opacity-60"
        >
          {posting ? "Posting..." : "Post note"}
        </button>
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <div className="overflow-x-auto rounded border border-track-200">
        <table className="min-w-full border-collapse text-xs">
          <thead className="bg-track-100 text-track-700">
            <tr>
              <th className="border-b border-track-200 px-2 py-2 text-left font-semibold">Preview</th>
              <th className="border-b border-track-200 px-2 py-2 text-left font-semibold">Scope</th>
              <th className="border-b border-track-200 px-2 py-2 text-left font-semibold">Series</th>
              <th className="border-b border-track-200 px-2 py-2 text-left font-semibold">Contest</th>
              <th className="border-b border-track-200 px-2 py-2 text-left font-semibold">Created</th>
              <th className="border-b border-track-200 px-2 py-2 text-left font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="px-2 py-3 text-track-600">
                  Loading notes...
                </td>
              </tr>
            ) : shoutouts.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-2 py-3 text-track-600">
                  No notes posted.
                </td>
              </tr>
            ) : null}

            {shoutouts.map((s) => {
              const isEditing = editingId === s.id;
              return (
                <tr key={s.id} className="border-b border-track-200 bg-track-50 align-top last:border-b-0">
                  <td className="px-2 py-2 max-w-[28rem]">
                    {isEditing ? (
                      <textarea
                        value={editMessage}
                        onChange={(e) => setEditMessage(e.target.value)}
                        className="min-h-20 w-full"
                      />
                    ) : (
                      <span>{s.message.length > 160 ? `${s.message.slice(0, 160)}...` : s.message}</span>
                    )}
                  </td>
                  <td className="px-2 py-2">
                    {isEditing ? (
                      <select
                        value={editScope}
                        onChange={(e) => setEditScope(e.target.value as "GLOBAL" | "SERIES")}
                        className="w-full"
                      >
                        <option value="GLOBAL">GLOBAL</option>
                        <option value="SERIES">SERIES</option>
                      </select>
                    ) : (
                      s.scope
                    )}
                  </td>
                  <td className="px-2 py-2">
                    {isEditing ? (
                      <select
                        value={editSeriesId}
                        onChange={(e) => setEditSeriesId(e.target.value)}
                        disabled={editScope !== "SERIES"}
                        className="w-full disabled:opacity-60"
                      >
                        <option value="">Select series</option>
                        {seriesList.map((series) => (
                          <option key={series.id} value={series.id}>
                            {series.name}
                          </option>
                        ))}
                      </select>
                    ) : (
                      s.seriesName ?? "—"
                    )}
                  </td>
                  <td className="px-2 py-2">
                    {isEditing ? (
                      <select
                        value={editContestId}
                        onChange={(e) => setEditContestId(e.target.value)}
                        className="w-full"
                      >
                        {activeContestsOptions.map((contest) => (
                          <option key={contest.id || "none"} value={contest.id}>
                            {contest.title}
                          </option>
                        ))}
                      </select>
                    ) : (
                      s.contestTitle ?? "—"
                    )}
                  </td>
                  <td className="px-2 py-2 text-track-600">{formatDateTime(new Date(s.createdAt))}</td>
                  <td className="px-2 py-2">
                    {isEditing ? (
                      <div className="flex gap-1">
                        <button
                          type="button"
                          onClick={saveEdit}
                          disabled={saving}
                          className="rounded bg-track-800 px-2 py-1 text-white disabled:opacity-60"
                        >
                          {saving ? "Saving..." : "Save"}
                        </button>
                        <button
                          type="button"
                          onClick={cancelEdit}
                          className="rounded border border-track-200 bg-white px-2 py-1 text-track-700"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <div className="flex gap-1">
                        <button
                          type="button"
                          onClick={() => startEdit(s)}
                          className="rounded border border-track-200 bg-white px-2 py-1 text-track-700"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteNote(s.id)}
                          disabled={deletingId === s.id}
                          className="rounded bg-red-700 px-2 py-1 text-white disabled:opacity-60"
                        >
                          {deletingId === s.id ? "Deleting..." : "Delete"}
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

