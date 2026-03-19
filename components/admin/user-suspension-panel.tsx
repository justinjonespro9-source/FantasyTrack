"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type UserRow = {
  id: string;
  displayName: string;
  email: string;
  isSuspended: boolean;
  suspendedAt?: string | null;
  suspensionReason?: string | null;
};

export default function UserSuspensionPanel({
  users,
  currentAdminId,
}: {
  users: UserRow[];
  currentAdminId: string;
}) {
  const router = useRouter();

  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submittingIds, setSubmittingIds] = useState<Record<string, boolean>>({});
  const [reasonByUserId, setReasonByUserId] = useState<Record<string, string>>({});

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) => {
      const dn = u.displayName?.toLowerCase() ?? "";
      const em = u.email?.toLowerCase() ?? "";
      return dn.includes(q) || em.includes(q);
    });
  }, [query, users]);

  async function suspendUser(userId: string) {
    const reason = reasonByUserId[userId]?.trim() ?? undefined;

    setError(null);
    setSubmittingIds((prev) => ({ ...prev, [userId]: true }));
    try {
      const res = await fetch("/api/admin/users/suspend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ suspend: { userId, reason } }),
      });

      const data = (await res.json().catch(() => ({}))) as { error?: string; ok?: boolean };
      if (!res.ok || !data.ok) {
        throw new Error(data.error ?? "Failed to suspend user");
      }

      router.refresh();
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to suspend user";
      setError(message);
    } finally {
      setSubmittingIds((prev) => ({ ...prev, [userId]: false }));
    }
  }

  async function reactivateUser(userId: string) {
    setError(null);
    setSubmittingIds((prev) => ({ ...prev, [userId]: true }));
    try {
      const res = await fetch("/api/admin/users/reactivate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reactivate: { userId } }),
      });

      const data = (await res.json().catch(() => ({}))) as { error?: string; ok?: boolean };
      if (!res.ok || !data.ok) {
        throw new Error(data.error ?? "Failed to reactivate user");
      }

      router.refresh();
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to reactivate user";
      setError(message);
    } finally {
      setSubmittingIds((prev) => ({ ...prev, [userId]: false }));
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <input
          className="w-full rounded border border-track-200 bg-white px-2 py-1 text-xs text-track-800"
          placeholder="Search users by name or email..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <div className="space-y-2">
        {filtered.length === 0 ? (
          <p className="text-sm text-track-600">No users found.</p>
        ) : null}

        {filtered.map((u) => {
          const isSelf = u.id === currentAdminId;
          const isBusy = Boolean(submittingIds[u.id]);

          return (
            <div key={u.id} className="rounded border border-track-200 bg-track-50 p-2">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-medium text-neutral-100">{u.displayName}</p>
                  <p className="text-xs text-track-600">{u.email}</p>
                  {u.isSuspended ? (
                    <div className="mt-1 text-xs">
                      <span className="rounded bg-red-600/10 px-1 py-0.5 text-red-200">SUSPENDED</span>
                      {u.suspendedAt ? (
                        <span className="ml-2 text-track-600">· {u.suspendedAt}</span>
                      ) : null}
                      {u.suspensionReason ? (
                        <p className="mt-1 text-[11px] text-red-200/90">
                          Reason: {u.suspensionReason}
                        </p>
                      ) : null}
                    </div>
                  ) : (
                    <div className="mt-1 text-xs">
                      <span className="rounded bg-green-600/10 px-1 py-0.5 text-green-200">
                        ACTIVE
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex flex-col items-end gap-2">
                  {u.isSuspended ? (
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => reactivateUser(u.id)}
                      className="rounded bg-track-800 px-2 py-1 text-xs font-semibold text-white disabled:opacity-50"
                    >
                      {isBusy ? "Reactivating..." : "Reactivate"}
                    </button>
                  ) : (
                    <div className="w-full min-w-[12rem] space-y-2">
                      <input
                        type="text"
                        placeholder="Reason (optional)"
                        value={reasonByUserId[u.id] ?? ""}
                        onChange={(e) =>
                          setReasonByUserId((prev) => ({ ...prev, [u.id]: e.target.value }))
                        }
                        disabled={isSelf || isBusy}
                        className="w-full rounded border border-track-200 bg-white px-2 py-1 text-xs text-track-800 disabled:opacity-60"
                      />
                      <button
                        type="button"
                        disabled={isSelf || isBusy}
                        onClick={() => suspendUser(u.id)}
                        className="w-full rounded bg-red-700 px-2 py-1 text-xs font-semibold text-white disabled:opacity-60"
                      >
                        {isSelf ? "Cannot suspend yourself" : isBusy ? "Suspending..." : "Suspend"}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

