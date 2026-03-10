"use client";

import { type FormEvent, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";

type SignupState = {
  displayName: string;
  realName: string;
  email: string;
  phone: string;
  password: string;
};

const initialState: SignupState = {
  displayName: "",
  realName: "",
  email: "",
  phone: "",
  password: ""
};

export default function SignupForm() {
  const router = useRouter();
  const [form, setForm] = useState(initialState);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function updateField(field: keyof SignupState, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");

    const response = await fetch("/api/register", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(form)
    });

    const payload = (await response.json().catch(() => ({}))) as { error?: string };

    if (!response.ok) {
      setLoading(false);
      setError(payload.error ?? "Unable to register.");
      return;
    }

    const signInResult = await signIn("credentials", {
      email: form.email,
      password: form.password,
      redirect: false
    });

    setLoading(false);

    if (signInResult?.error) {
      router.push("/auth/login");
      return;
    }

    router.push("/");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-1">
          <label className="text-sm font-medium text-track-700">Display name</label>
          <input
            required
            value={form.displayName}
            onChange={(event) => updateField("displayName", event.target.value)}
            className="w-full"
          />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium text-track-700">Real name</label>
          <input
            required
            value={form.realName}
            onChange={(event) => updateField("realName", event.target.value)}
            className="w-full"
          />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-1">
          <label className="text-sm font-medium text-track-700">Email</label>
          <input
            required
            type="email"
            value={form.email}
            onChange={(event) => updateField("email", event.target.value)}
            className="w-full"
          />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium text-track-700">Phone</label>
          <input
            required
            value={form.phone}
            onChange={(event) => updateField("phone", event.target.value)}
            className="w-full"
          />
        </div>
      </div>

      <div className="space-y-1">
        <label className="text-sm font-medium text-track-700">Password</label>
        <input
          required
          type="password"
          minLength={8}
          value={form.password}
          onChange={(event) => updateField("password", event.target.value)}
          className="w-full"
        />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button type="submit" disabled={loading} className="w-full bg-track-800 text-white">
        {loading ? "Creating account..." : "Create account"}
      </button>
    </form>
  );
}
