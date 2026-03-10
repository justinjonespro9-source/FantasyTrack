"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type ProfileEditFormProps = {
  initialDisplayName: string;
  initialEmail: string;
  initialPhone: string;
};

export default function ProfileEditForm({
  initialDisplayName,
  initialEmail,
  initialPhone,
}: ProfileEditFormProps) {
  const router = useRouter();
  const [displayName, setDisplayName] = useState(initialDisplayName);
  const [email, setEmail] = useState(initialEmail);
  const [phone, setPhone] = useState(initialPhone);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setMessage(null);

    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName,
          email,
          phone,
        }),
      });

      const data = (await res.json().catch(() => ({}))) as { error?: string };

      if (!res.ok) {
        throw new Error(data.error || "Unable to update profile.");
      }

      setMessage("Profile updated.");
      router.refresh();
      router.push("/me");
    } catch (err: any) {
      setError(err?.message || "Unable to update profile.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="flex-shrink-0">
          <div className="flex h-24 w-24 items-center justify-center rounded-full border border-neutral-700 bg-neutral-950 text-lg font-semibold uppercase text-neutral-200">
            {displayName
              .split(" ")
              .filter(Boolean)
              .slice(0, 2)
              .map((part) => part.charAt(0))
              .join("")}
          </div>
        </div>

        <div className="flex-1 space-y-2">
          <h1 className="text-xl font-semibold text-neutral-50">Edit profile</h1>
          <p className="text-sm text-neutral-400">
            Update how you appear across FantasyTrack. Profile photos and richer identity options are
            coming soon.
          </p>

          <div className="mt-2 rounded-lg border border-neutral-800 bg-neutral-950/80 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
              Profile photo
            </p>
            <p className="mt-1 text-xs text-neutral-400">
              Photo uploads are not enabled yet for this beta. When available, you&apos;ll be able to
              upload an image here.
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-1">
          <label className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
            Display name
          </label>
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            minLength={2}
            maxLength={40}
            required
            className="w-full rounded-md border border-neutral-700 bg-neutral-950/80 px-3 py-2 text-sm text-neutral-100 outline-none focus:ring-2 focus:ring-amber-400/60"
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
            Email
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full rounded-md border border-neutral-700 bg-neutral-950/80 px-3 py-2 text-sm text-neutral-100 outline-none focus:ring-2 focus:ring-amber-400/60"
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
            Phone
          </label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="w-full rounded-md border border-neutral-700 bg-neutral-950/80 px-3 py-2 text-sm text-neutral-100 outline-none focus:ring-2 focus:ring-amber-400/60"
          />
        </div>
      </div>

      {error ? <p className="text-sm text-red-300">{error}</p> : null}
      {message ? <p className="text-sm text-emerald-300">{message}</p> : null}

      <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => router.push("/me")}
          className="rounded-full border border-neutral-700 bg-neutral-900 px-4 py-1.5 text-sm font-semibold text-neutral-200 hover:border-neutral-500 hover:text-neutral-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving}
          className="rounded-full border border-amber-400/70 bg-amber-400 px-5 py-1.5 text-sm font-semibold text-neutral-950 hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {saving ? "Saving..." : "Save changes"}
        </button>
      </div>
    </form>
  );
}

