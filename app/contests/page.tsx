import { redirect } from "next/navigation";

/** Legacy public discovery → canonical Races hub */
export default function LegacyContestsRedirect() {
  redirect("/races");
}
