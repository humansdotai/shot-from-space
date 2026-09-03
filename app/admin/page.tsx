import type { Metadata } from 'next';
import { adminEnabled, isAdminRequest, listMissionsForAdmin } from '@/lib/admin';
import { AdminBoard } from './AdminBoard';

/**
 * /admin — the orders board.
 *
 * Every mission with its payment status, the live quote it was charged,
 * the SkyFi / Gelato / Stripe references, the owner's keyed link, the final
 * composed version, and the three operations: APPROVE the final version
 * (which is what places the Gelato print — nothing places it automatically),
 * ADVANCE a stage by hand when a webhook did not, and REFUND & CANCEL.
 */
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Admin / Orders',
  robots: { index: false, follow: false },
};

export default async function AdminPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = (await searchParams) ?? {};
  const wrap: React.CSSProperties = {
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
    background: '#f4f4f2',
    color: '#111',
    minHeight: '100dvh',
    padding: '24px 20px',
  };

  if (!adminEnabled()) {
    return (
      <main style={wrap}>
        <h1 style={{ fontSize: 16, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Admin</h1>
        <p>Admin is closed: set <code>ADMIN_SECRET</code> in the environment.</p>
      </main>
    );
  }

  if (!(await isAdminRequest())) {
    return (
      <main style={wrap}>
        <h1 style={{ fontSize: 16, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Admin · sign in</h1>
        {sp.denied ? <p style={{ color: '#8a1f1f' }}>That key was not accepted.</p> : null}
        <form action="/api/admin/login" method="get" style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <input
            type="password"
            name="key"
            placeholder="ADMIN_SECRET"
            autoComplete="off"
            style={{ padding: '8px 10px', border: '1px solid #999', minWidth: 280, fontFamily: 'inherit' }}
          />
          <button type="submit" style={{ padding: '8px 14px', background: '#111', color: '#fff', border: 0, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Enter
          </button>
        </form>
      </main>
    );
  }

  const missions = await listMissionsForAdmin();
  const counts = {
    unpaid: missions.filter((m) => m.status === 'UNPAID').length,
    approval: missions.filter((m) => m.status === 'AWAITING_APPROVAL').length,
    active: missions.filter((m) => m.paidAt && m.state !== 'CANCELLED' && m.state !== 'DELIVERED').length,
  };

  return (
    <main style={wrap}>
      <header style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: 16, marginBottom: 16 }}>
        <h1 style={{ fontSize: 16, textTransform: 'uppercase', letterSpacing: '0.1em', margin: 0 }}>
          Admin · Orders
        </h1>
        <span style={{ color: '#666', fontSize: 12 }}>
          {missions.length} missions · {counts.active} in flight · {counts.approval} awaiting print approval ·{' '}
          {counts.unpaid} unpaid
        </span>
        <a href="/api/admin/login?out=1" style={{ marginLeft: 'auto', fontSize: 12, color: '#0645ad' }}>
          sign out
        </a>
      </header>
      <p style={{ fontSize: 12, color: '#666', marginBottom: 12 }}>
        Nothing is sent to Gelato automatically. A paid mission stops at PROCESSING with its final version
        composed; <strong>Approve &amp; print</strong> places the print order. <strong>Refund &amp; cancel</strong>{' '}
        refunds the Stripe payment and cancels the mission.
      </p>
      <AdminBoard missions={missions} />
    </main>
  );
}
