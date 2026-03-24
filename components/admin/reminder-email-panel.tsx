"use client";

import { useState } from "react";

type ApiResult = {
  recipientCount: number;
  recipients: string[];
  sentCount: number;
  failedCount: number;
  failedRecipients: string[];
  error?: string;
};

const DEFAULT_SUBJECT = "FantasyTrack contests are live";
const DEFAULT_BODY = `Hey —

FantasyTrack contests are live now, including tonight’s Wild contest, tomorrow’s Wolves contest, and NCAA contests coming Thursday.

Everyone gets $1,000 in free test funds at signup, and the current max wager is $100 per contest in $5 increments.

Get your picks in here:
https://www.fantasytrack.app/dashboard

Thanks for helping test FantasyTrack early.

– The Commish`;

export default function ReminderEmailPanel() {
  const [overrideEmail, setOverrideEmail] = useState("");
  const [subject, setSubject] = useState(DEFAULT_SUBJECT);
  const [message, setMessage] = useState(DEFAULT_BODY);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ApiResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(mode: "dryRun" | "sendTest" | "sendAll") {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const payload = {
        dryRun: mode === "dryRun",
        overrideEmail: mode === "sendTest" ? overrideEmail.trim() : undefined,
        subject: subject.trim(),
        message: message.trim(),
      };

      const res = await fetch("/api/admin/emails/reminder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json()) as ApiResult;
      if (!res.ok) {
        throw new Error(data?.error ?? "Request failed.");
      }
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-2">
      <input
        value={overrideEmail}
        onChange={(e) => setOverrideEmail(e.target.value)}
        placeholder="Override email (for Send test email)"
        className="w-full"
      />
      <input
        value={subject}
        onChange={(e) => setSubject(e.target.value)}
        placeholder="Subject"
        className="w-full"
      />
      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="Message"
        className="min-h-28 w-full"
      />

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={loading}
          onClick={() => run("dryRun")}
          className="rounded bg-track-100 px-3 py-1 text-track-700 disabled:opacity-60"
        >
          Dry run
        </button>
        <button
          type="button"
          disabled={loading || !overrideEmail.trim()}
          onClick={() => run("sendTest")}
          className="rounded bg-track-100 px-3 py-1 text-track-700 disabled:opacity-60"
        >
          Send test email
        </button>
        <button
          type="button"
          disabled={loading}
          onClick={() => run("sendAll")}
          className="rounded bg-track-800 px-3 py-1 text-white disabled:opacity-60"
        >
          Send to all
        </button>
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {result ? (
        <div className="rounded border border-track-200 bg-track-50 p-2 text-xs text-track-700">
          <p>Recipients matched: {result.recipientCount}</p>
          <p>Sent: {result.sentCount}</p>
          <p>Failed: {result.failedCount}</p>
          {result.recipients?.length ? (
            <p className="mt-1">
              Preview: {result.recipients.slice(0, 10).join(", ")}
              {result.recipients.length > 10 ? " ..." : ""}
            </p>
          ) : null}
          {result.failedRecipients?.length ? (
            <p className="mt-1 text-red-700">
              Failed recipients: {result.failedRecipients.join(", ")}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
