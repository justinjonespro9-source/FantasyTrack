import { redirect } from "next/navigation";

type PageProps = {
  searchParams?: Record<string, string | string[] | undefined>;
};

/** Legacy URL: forward query string to canonical /reset-password (selector, token, email). */
export default function LegacyResetPasswordRedirectPage({ searchParams }: PageProps) {
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams ?? {})) {
    if (value === undefined) continue;
    if (typeof value === "string") {
      qs.set(key, value);
    } else if (Array.isArray(value)) {
      for (const v of value) {
        if (v) qs.append(key, v);
      }
    }
  }
  const suffix = qs.toString();
  redirect(suffix ? `/reset-password?${suffix}` : "/reset-password");
}
