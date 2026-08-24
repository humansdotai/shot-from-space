'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/fui';

/**
 * Closes the session and returns to the surface. The server deletes the
 * session row, so the cookie is worthless afterwards even if it is kept.
 */
export function SignOutButton({ className }: { className?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function signOut() {
    if (busy) return;
    setBusy(true);
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch {
      // The cookie is cleared server-side on the next request either way.
    }
    router.replace('/');
    router.refresh();
  }

  return (
    <Button variant="ghost" onClick={signOut} loading={busy} className={className}>
      {busy ? 'Closing' : 'Sign out'}
    </Button>
  );
}
