import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSessionUser, sanitizeRedirect, DEFAULT_REDIRECT } from '@/lib/auth';
import { AuthShell } from '../AuthShell';
import { SignInForm } from './SignInForm';

export const metadata: Metadata = {
  title: 'Access file',
  description: 'Open your mission file with a single-use link. No password.',
  robots: { index: false, follow: false },
};

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; redirectTo?: string; error?: string }>;
}) {
  const params = await searchParams;
  // `next` is canonical; `redirectTo` is accepted as an alias so links
  // written against either spelling resolve to the same destination.
  const next = sanitizeRedirect(params.next ?? params.redirectTo);

  // Already carrying a session? There is nothing to do here.
  const user = await getSessionUser();
  if (user) redirect(next ?? DEFAULT_REDIRECT);

  const expired = params.error === 'expired';

  return (
    <AuthShell
      eyebrow="Access control"
      meta="PASSWORDLESS"
      title="Open your file."
      intro="Missions are filed against the address the order was placed with. Enter it and a single-use link opens the file — there is no password on this account, and no account to create."
      footer={
        <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-3">
          <p className="text-label uppercase text-[color:var(--ink-dim)]">
            No mission on file yet
          </p>
          <Link
            href="/start"
            className="link-underline inline-flex min-h-11 items-center text-action text-[color:var(--ink-dim)] transition-house hover:text-[color:var(--ink)]"
          >
            Start a mission
          </Link>
        </div>
      }
    >
      {expired ? (
        <div
          role="alert"
          className="mb-10 rounded-[6px] border border-l-2 border-[color:color-mix(in_srgb,var(--accent)_45%,transparent)] bg-[color:color-mix(in_srgb,var(--accent)_6%,transparent)] px-4 py-4"
        >
          <p className="text-label uppercase text-[color:var(--accent)]">Link dead</p>
          <p className="mt-2 max-w-[var(--measure)] text-body text-[color:var(--ink-dim)]">
            That link had already been used, or its fifteen minutes ran out. Request another below
            — the old one stays dead.
          </p>
        </div>
      ) : null}

      <SignInForm next={next} />
    </AuthShell>
  );
}
