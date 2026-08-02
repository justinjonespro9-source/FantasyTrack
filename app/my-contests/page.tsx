import { redirect } from "next/navigation";

/** Legacy personalized label → My Track (not public discovery) */
export default function LegacyMyContestsRedirect() {
  redirect("/dashboard");
}
