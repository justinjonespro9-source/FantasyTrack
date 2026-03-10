"use client";

import { signOut } from "next-auth/react";

export default function SignOutButton() {
  return (
    <button
      type="button"
      className="rounded border border-neutral-600 px-3 py-1 text-neutral-200 hover:border-amber-300 hover:text-amber-200"
      onClick={() => signOut({ callbackUrl: "/" })}
    >
      Sign out
    </button>
  );
}
