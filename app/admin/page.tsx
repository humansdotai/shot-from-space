import type { Metadata } from 'next';
import { adminEnabled, isAdminRequest, listMissionsForAdmin } from '@/lib/admin';
import { AdminBoard } from './AdminBoard';

/**
 * /admin — the orders board.
 *
 * Every mission with its payment status, the live quote it was charged,
 * the composition that will print, the SkyFi / Gelato / Stripe references,
 * the owner's keyed link, downloads of the print file and the delivered
 * capture, a "new version" print file, and the operations: APPROVE the
 * final version (which is what places the Gelato print — nothing places it
 * automatically), ADVANCE a stage by hand when a webhook did not, SEND a
 * new version to Gelato, and REFUND & CANCEL.
 */
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Admin / Orders',
  robots: { index: false, follow: false },
};

const CSS = `
.adm{--bg:#0c0c0c;--panel:#141414;--line:#262626;--ink:#ececec;--dim:#8f8f8f;--hot:#ff4d1f;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;background:var(--bg);color:var(--ink);min-height:100dvh;padding:calc(var(--site-bar-h,70px) + 28px) 22px 60px;font-size:12.5px;line-height:1.45}
.adm a{color:#9cc4ff;text-decoration:none}.adm a:hover{text-decoration:underline}
.adm h1{font-size:13px;letter-spacing:.14em;text-transform:uppercase;margin:0}
.adm .head{display:flex;flex-wrap:wrap;align-items:baseline;gap:18px;margin-bottom:18px}
.adm .head .dim{font-size:12px}
.adm .dim{color:var(--dim)}.adm .mono{font-family:inherit}.adm .small{font-size:11px;word-break:break-all}
.adm .toolbar{display:flex;flex-wrap:wrap;gap:12px;align-items:center;margin-bottom:12px}
.adm .chips{display:flex;flex-wrap:wrap;gap:6px}
.adm .chip{background:transparent;border:1px solid var(--line);color:var(--dim);padding:6px 10px;font:inherit;font-size:11.5px;letter-spacing:.04em;cursor:pointer}
.adm .chip.on{border-color:var(--ink);color:var(--ink)}.adm .chip .n{opacity:.7;margin-left:4px}
.adm .search{background:var(--panel);border:1px solid var(--line);color:var(--ink);padding:8px 10px;font:inherit;min-width:260px;flex:1}
.adm .flash{padding:8px 12px;border:1px solid var(--line);margin:0 0 12px}.adm .flash.ok{border-color:#39b36a}.adm .flash.err{border-color:var(--hot)}
.adm .layout{display:grid;grid-template-columns:minmax(0,1fr);gap:18px}
@media(min-width:1200px){.adm .layout{grid-template-columns:minmax(0,1fr) 420px}}
.adm .tablewrap{overflow-x:auto;border:1px solid var(--line);background:var(--panel)}
.adm table{border-collapse:collapse;width:100%}
.adm th{text-align:left;font-weight:500;color:var(--dim);font-size:11px;letter-spacing:.08em;text-transform:uppercase;padding:10px 12px;border-bottom:1px solid var(--line);white-space:nowrap}
.adm td{padding:10px 12px;border-bottom:1px solid var(--line);vertical-align:top}
.adm tbody tr{cursor:pointer}.adm tbody tr:hover{background:#1a1a1a}.adm tbody tr.on{background:#1f1f1f;outline:1px solid #333}
.adm td.r,.adm th.r{text-align:right;white-space:nowrap}
.adm td.thumb{width:56px;padding-right:0}.adm td.thumb img{width:44px;height:58px;object-fit:cover;display:block;border:1px solid var(--line);background:#000}
.adm .nothumb{display:inline-block;width:44px;height:58px;border:1px dashed var(--line);color:var(--dim);text-align:center;line-height:58px}
.adm .code{font-weight:700;letter-spacing:.06em}.adm .code.big{font-size:20px}
.adm .tag{margin-left:6px;font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:var(--dim);border:1px solid var(--line);padding:1px 5px}
.adm .dot{display:inline-block;width:7px;height:7px;border-radius:50%;margin-right:6px;vertical-align:1px}
.adm .status{font-weight:600}
.adm .btn{background:var(--ink);color:#0c0c0c;border:1px solid var(--ink);padding:7px 11px;font:inherit;font-size:11.5px;letter-spacing:.06em;text-transform:uppercase;cursor:pointer}
.adm .btn:disabled{opacity:.35;cursor:not-allowed}
.adm .btn.hot{background:var(--hot);border-color:var(--hot);color:#0c0c0c}
.adm .btn.ghost{background:transparent;color:var(--ink)}
.adm .btn.danger{background:transparent;border-color:#a33;color:#ff8a8a}
.adm .detail{border:1px solid var(--line);background:var(--panel);padding:16px;position:sticky;top:calc(var(--site-bar-h,70px) + 16px);align-self:start;max-height:calc(100dvh - var(--site-bar-h,70px) - 32px);overflow:auto}
.adm .detailhead{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;margin-bottom:12px}
.adm .preview{background:#000;border:1px solid var(--line);display:flex;justify-content:center;margin-bottom:12px}
.adm .preview img{max-width:100%;max-height:360px;display:block}
.adm .nopreview{padding:40px 20px;color:var(--dim);text-align:center}
.adm .links{display:flex;flex-wrap:wrap;gap:6px 16px;margin-bottom:14px}
.adm .facts{display:grid;grid-template-columns:96px minmax(0,1fr);gap:6px 12px;margin:0 0 16px}
.adm .facts dt{color:var(--dim);font-size:11px;letter-spacing:.08em;text-transform:uppercase;padding-top:2px}.adm .facts dd{margin:0;word-break:break-word}
.adm section h3{font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:var(--dim);margin:0 0 8px;padding-top:12px;border-top:1px solid var(--line)}
.adm .row{display:flex;flex-wrap:wrap;gap:8px;margin:8px 0}
.adm .timeline ol{list-style:none;margin:0;padding:0}.adm .timeline li{padding:8px 0;border-top:1px solid var(--line)}.adm .evlabel{font-weight:600;letter-spacing:.04em}
.adm form.login{display:flex;gap:8px;margin-top:14px}
`;

export default async function AdminPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = (await searchParams) ?? {};

  if (!adminEnabled()) {
    return (
      <main className="adm">
        <style dangerouslySetInnerHTML={{ __html: CSS }} />
        <h1>Admin</h1>
        <p className="dim">Admin is closed: set ADMIN_SECRET in the environment.</p>
      </main>
    );
  }

  if (!(await isAdminRequest())) {
    return (
      <main className="adm">
        <style dangerouslySetInnerHTML={{ __html: CSS }} />
        <h1>Admin · sign in</h1>
        {sp.denied ? <p style={{ color: '#ff8a8a' }}>That key was not accepted.</p> : null}
        <form action="/api/admin/login" method="get" className="login">
          <input type="password" name="key" placeholder="ADMIN_SECRET" autoComplete="off" className="search" />
          <button type="submit" className="btn">
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
    revenue: missions
      .filter((m) => m.paidAt && m.state !== 'CANCELLED')
      .reduce((acc, m) => ({ ...acc, [m.currency]: (acc[m.currency] ?? 0) + m.amountMinor }), {} as Record<string, number>),
  };

  return (
    <main className="adm">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <header className="head">
        <h1>Shot From Space · Orders</h1>
        <span className="dim">
          {missions.length} missions · {counts.active} in flight · {counts.approval} awaiting print approval ·{' '}
          {counts.unpaid} unpaid
          {Object.entries(counts.revenue).length
            ? ` · paid ${Object.entries(counts.revenue)
                .map(([c, v]) => `${(v / 100).toFixed(2)} ${c}`)
                .join(' + ')}`
            : ''}
        </span>
        <a href="/api/admin/login?out=1" style={{ marginLeft: 'auto' }}>
          sign out
        </a>
      </header>
      <p className="dim" style={{ marginBottom: 14, maxWidth: 900 }}>
        Nothing goes to Gelato by itself. A paid mission stops at PROCESSING with its composition ready; open it and
        press Approve &amp; print. Replace the print file with a new version and Send to Gelato at any time.
      </p>
      <AdminBoard missions={missions} />
    </main>
  );
}
