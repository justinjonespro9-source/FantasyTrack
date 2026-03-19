"use client";

import { type FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

type Props = { token: string };

export default function ResetPasswordForm({ token }: Props) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setMessage("");

    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    if (!token) {
      setError("Missing reset link. Use the link from your email or request a new one.");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data.error ?? "Something went wrong.");
        return;
      }

      setMessage(data.message ?? "Password reset. You can now sign in.");
      setPassword("");
      setConfirm("");
      setTimeout(() => router.push("/auth/login"), 2000);
    } catch {
      setError("Request failed. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {!token && (
        <p className="text-sm text-amber-600">
          No reset token in URL. Open the link from your email or go to{" "}
          <a href="/auth/forgot-password" className="underline">
            Forgot password
          </a>{" "}
          to request a new link.
        </p>
      )}
      <div className="space-y-1">
        <label className="text-sm font-medium text-track-700">New password</label>
        <input
          required
          type="password"
          minLength={8}
          maxLength={128}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full"
        />
      </div>
      <div className="space-y-1">
        <label className="text-sm font-medium text-track-700">Confirm new password</label>
        <input
          required
          type="password"
          minLength={8}
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          className="w-full"
        />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {message && <p className="text-sm text-track-600">{message}</p>}
      <button
        type="submit"
        disabled={loading || !token}
        className="w-full bg-track-800 text-white"
      >
        {loading ? "Resetting…" : "Reset password"}
      </button>
    </form>
  );
}
