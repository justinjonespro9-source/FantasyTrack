"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { formatDateTime } from "@/lib/format";

type UserRow = {
  id: string;
  displayName: string;
  email: string;
  isSuspended: boolean;
  suspendedAt?: string | null;
  suspensionReason?: string | null;
};

export default function UserSuspensionPanel({
  users: _users,
  currentAdminId,
}: {
  users?: UserRow[];
  currentAdminId: string;
}) {
  const router = useRouter();

  const [queryInput, setQueryInput] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"all" | "active" | "suspended">("all");
  const [sort, setSort] = useState<"newest" | "oldest" | "name_asc" | "email_asc">("newest");
  const [page, setPage] = useState(1);
  const [pageSize] = useState(25);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [submittingIds, setSubmittingIds] = useState<Record<string, boolean>>({});
  const [reasonByUserId, setReasonByUserId] = useState<Record<string, string>>({});
  const [users, setUsers] = useState<UserRow[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setPage(1);
      setQuery(queryInput.trim());
    }, 250);
    return () => window.clearTimeout(timer);
  }, [queryInput]);

  const fetchUsers = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const params = new URLSearchParams({
        q: query,
        status,
        sort,
        page: String(page),
        pageSize: String(pageSize),
      });
      const res = await fetch(`/api/admin/users?${params.toString()}`, { cache: "no-store" });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        users?: UserRow[];
        total?: number;
        totalPages?: number;
      };
      if (!res.ok) throw new Error(data.error ?? "Failed to load users.");
      setUsers(Array.isArray(data.users) ? data.users : []);
      setTotal(typeof data.total === "number" ? data.total : 0);
      setTotalPages(
        typeof data.totalPages === "number" && data.totalPages > 0 ? data.totalPages : 1
      );
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to load users.";
      setError(message);
      setUsers([]);
      setTotal(0);
      setTotalPages(1);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, query, sort, status]);

  useEffect(() => {
    void fetchUsers();
  }, [fetchUsers]);

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

      await fetchUsers();
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

      await fetchUsers();
      router.refresh();
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to reactivate user";
      setError(message);
    } finally {
      setSubmittingIds((prev) => ({ ...prev, [userId]: false }));
    }
  }

  const pageLabel = useMemo(() => {
    if (total === 0) return "No users";
    const start = (page - 1) * pageSize + 1;
    const end = Math.min(page * pageSize, total);
    return `Showing ${start}-${end} of ${total}`;
  }, [page, pageSize, total]);

  return (
    <div className="space-y-3">
      <div className="grid gap-2 md:grid-cols-4">
        <input
          className="w-full rounded border border-track-200 bg-white px-2 py-1 text-xs text-track-800 md:col-span-2"
          placeholder="Search users by name or email..."
          value={queryInput}
          onChange={(e) => setQueryInput(e.target.value)}
        />
        <select
          value={status}
          onChange={(e) => {
            setPage(1);
            setStatus(e.target.value as "all" | "active" | "suspended");
          }}
          className="w-full rounded border border-track-200 bg-white px-2 py-1 text-xs text-track-800"
        >
          <option value="all">All statuses</option>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
        </select>
        <select
          value={sort}
          onChange={(e) => {
            setPage(1);
            setSort(e.target.value as "newest" | "oldest" | "name_asc" | "email_asc");
          }}
          className="w-full rounded border border-track-200 bg-white px-2 py-1 text-xs text-track-800"
        >
          <option value="newest">Newest created</option>
          <option value="oldest">Oldest created</option>
          <option value="name_asc">Name A-Z</option>
          <option value="email_asc">Email A-Z</option>
        </select>
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <div className="overflow-x-auto rounded border border-track-200">
        <table className="min-w-full border-collapse text-xs">
          <thead className="bg-track-100 text-track-700">
            <tr>
              <th className="border-b border-track-200 px-2 py-2 text-left font-semibold">Name</th>
              <th className="border-b border-track-200 px-2 py-2 text-left font-semibold">Email</th>
              <th className="border-b border-track-200 px-2 py-2 text-left font-semibold">Status</th>
              <th className="border-b border-track-200 px-2 py-2 text-left font-semibold">
                Suspended At
              </th>
              <th className="border-b border-track-200 px-2 py-2 text-left font-semibold">
                Suspension Reason
              </th>
              <th className="border-b border-track-200 px-2 py-2 text-left font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td className="px-2 py-3 text-track-600" colSpan={6}>
                  Loading users...
                </td>
              </tr>
            ) : users.length === 0 ? (
              <tr>
                <td className="px-2 py-3 text-track-600" colSpan={6}>
                  No users found.
                </td>
              </tr>
            ) : null}

            {users.map((u) => {
          const isSelf = u.id === currentAdminId;
          const isBusy = Boolean(submittingIds[u.id]);

          return (
            <tr key={u.id} className="border-b border-track-200 bg-track-50 align-top last:border-b-0">
              <td className="px-2 py-2 text-neutral-100">{u.displayName}</td>
              <td className="px-2 py-2 text-track-600">{u.email}</td>
              <td className="px-2 py-2">
                {u.isSuspended ? (
                  <span className="rounded bg-red-600/10 px-1 py-0.5 text-red-200">Suspended</span>
                ) : (
                  <span className="rounded bg-green-600/10 px-1 py-0.5 text-green-200">Active</span>
                )}
              </td>
              <td className="px-2 py-2 text-track-600">
                {u.suspendedAt ? formatDateTime(new Date(u.suspendedAt)) : "—"}
              </td>
              <td className="px-2 py-2 text-track-600">{u.suspensionReason || "—"}</td>
              <td className="px-2 py-2">
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
                  <div className="min-w-[13rem] space-y-1">
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
              </td>
            </tr>
          );
        })}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-track-600">{pageLabel}</p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={loading || page <= 1}
            className="rounded border border-track-200 bg-white px-2 py-1 text-xs text-track-700 disabled:opacity-50"
          >
            Previous
          </button>
          <span className="text-xs text-track-600">
            Page {page} of {Math.max(totalPages, 1)}
          </span>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={loading || page >= totalPages}
            className="rounded border border-track-200 bg-white px-2 py-1 text-xs text-track-700 disabled:opacity-50"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}

