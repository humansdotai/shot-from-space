import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { normalizeEmail, sanitizeRedirect } from '@/lib/auth';
import { AuthShell } from '../AuthShell';
import { ResendControl } from './ResendControl';

export const metadata: Metadata = {
  title: 'Transmission sent',
  description: 'A single-use access link has been sent.',
  robots: { index: false, follow: false },
};

/**
 * Three things worth checking, and nothing more.
 *
 * These render as rows with a hairline between them and NO hover state: a
 * readout is not a control, and lighting one up under the pointer promises an
 * action that does not exist. Hover in this product belongs to links, buttons
 * and rows that open something.
 */
const CHECKS = [
  'Look in the spam and promotions folders. The sender is mission control.',
  'Confirm the address matches the one used on the order. Missions are filed against that address and no other.',
  'Give it a minute, then resend. Only the newest link works.',
];

export default async function CheckEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string; next?: string }>;
}) {
  const params = await searchParams;
  const email = params.email ? normalizeEmail(params.email) : '';
  const next = sanitizeRedirect(params.next);

  // Nothing was requested — there is no transmission to confirm.
  if (!email) redirect('/auth/sign-in');

  return (
    <AuthShell
      eyebrow="Access control"
      meta="AWAITING ACCESS"
      title="Transmission sent."
      intro="A single-use link is on its way. Open it on any device and the mission file opens with it."
      footer={
        <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-3">
          <p className="text-label uppercase text-[color:var(--ink-dim)]">Wrong address</p>
          <Link
            href="/auth/sign-in"
            className="link-underline inline-flex min-h-11 items-center text-action text-[color:var(--ink-dim)] transition-house hover:text-[color:var(--ink)]"
          >
            Use another one
          </Link>
        </div>
      }
    >
      <dl className="border-t border-[color:var(--rule)]">
        {[
          { label: 'Sent to', value: email },
          { label: 'Valid for', value: '15 minutes' },
          { label: 'Uses', value: 'One' },
        ].map((row) => (
          <div
            key={row.label}
            className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-b border-[color:var(--rule)] py-4"
          >
            <dt className="text-label uppercase text-[color:var(--ink-dim)]">{row.label}</dt>
            <dd data-telemetry className="text-action break-all text-[color:var(--ink)]">
              {row.value}
            </dd>
          </div>
        ))}
      </dl>

      <ResendControl email={email} next={next} />

      <div className="mt-8">
        <p className="text-label uppercase text-[color:var(--ink-dim)]">If it does not arrive</p>
        <ul className="mt-5 border-t border-[color:var(--rule)]">
          {CHECKS.map((check) => (
            <li
              key={check}
              className="flex gap-4 border-b border-[color:var(--rule)] py-4"
            >
              <span
                aria-hidden
                className="mt-3 h-px w-4 shrink-0 bg-[color:var(--rule-strong)]"
              />
              <span className="max-w-[var(--measure)] text-body text-[color:var(--ink-dim)]">{check}</span>
            </li>
          ))}
        </ul>
      </div>
    </AuthShell>
  );
}
