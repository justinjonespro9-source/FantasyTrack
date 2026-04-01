import Link from "next/link";
import { SUPPORT_EMAIL } from "@/lib/support";

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="ft-surface p-5 sm:p-6">
      <h2 className="text-lg font-semibold text-neutral-50">{title}</h2>
      <div className="mt-3 space-y-3 text-sm leading-6 text-neutral-200">{children}</div>
    </section>
  );
}

export default function CookiesPage() {
  return (
    <div className="space-y-6">
      <section className="ft-surface p-6 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
              FantasyTrack
            </p>
            <h1 className="mt-1 text-2xl font-semibold text-neutral-50">Cookies Policy</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-neutral-300">
              This Cookies Policy explains how FantasyTrack uses cookies and similar technologies
              in connection with our free-to-play fantasy contest experience. This document is a
              first-pass policy for testing and MVP evaluation and does not replace a final
              production legal review.
            </p>
          </div>

          <Link
            href="/"
            className="rounded border border-neutral-700 px-3 py-2 text-sm text-neutral-200 hover:border-amber-300 hover:text-amber-200"
          >
            Back to contests
          </Link>
        </div>
      </section>

      <Section title="What are cookies?">
        <p>
          Cookies are small text files stored on your device when you visit a website or use an
          online service. They help the service remember information about your visit, such as your
          session, preferences, and certain usage patterns.
        </p>
      </Section>

      <Section title="How FantasyTrack uses cookies">
        <p>We currently use cookies and similar technologies to:</p>
        <ul className="list-disc space-y-2 pl-5">
          <li>Keep you signed in to your FantasyTrack account between page loads.</li>
          <li>Maintain basic session state while you browse contests and profile pages.</li>
          <li>Support security features such as CSRF protection and authentication.</li>
          <li>
            Collect limited, aggregated usage information to understand which parts of the product
            are most active.
          </li>
        </ul>
        <p>
          We do not use cookies in this MVP environment to show ads or sell your browsing data to
          third parties.
        </p>
      </Section>

      <Section title="Types of cookies we may use">
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <span className="font-semibold text-neutral-100">Strictly necessary cookies</span> that
            are required to operate FantasyTrack, such as those that keep you logged in.
          </li>
          <li>
            <span className="font-semibold text-neutral-100">Performance and analytics cookies</span>{" "}
            that help us understand aggregate usage patterns (for example, which screens are most
            frequently viewed).
          </li>
        </ul>
      </Section>

      <Section title="Managing cookies">
        <p>
          Most browsers allow you to control cookies through their settings, including blocking or
          deleting them. If you disable certain cookies, some features of FantasyTrack—such as
          signing in or staying logged in—may not work correctly.
        </p>
      </Section>

      <Section title="Changes to this Cookies Policy">
        <p>
          As FantasyTrack evolves, we may update this Cookies Policy from time to time. When we make
          material changes, we will adjust the “last updated” date and may provide additional notice
          within the product.
        </p>
      </Section>

      <Section title="Contact information">
        <p>
          If you have questions about this Cookies Policy or how FantasyTrack uses cookies and
          similar technologies, you can reach us at:
        </p>
        <p className="text-sm text-neutral-300">
          <span className="font-semibold text-neutral-50">Email:</span> {SUPPORT_EMAIL}
        </p>
      </Section>
    </div>
  );
}

