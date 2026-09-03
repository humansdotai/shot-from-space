'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { AdminMission } from '@/lib/admin';
import { formatPrice } from '@/lib/pricing';

type Filter = 'ALL' | 'UNPAID' | 'AWAITING_APPROVAL' | 'IN_FLIGHT' | 'DELIVERED' | 'CANCELLED';

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'ALL', label: 'All' },
  { id: 'AWAITING_APPROVAL', label: 'Awaiting approval' },
  { id: 'IN_FLIGHT', label: 'In flight' },
  { id: 'UNPAID', label: 'Unpaid' },
  { id: 'DELIVERED', label: 'Delivered' },
  { id: 'CANCELLED', label: 'Cancelled' },
];

const STATUS: Record<string, { label: string; tone: string }> = {
  UNPAID: { label: 'Unpaid', tone: '#d9a400' },
  CANCELLED: { label: 'Cancelled', tone: '#7a7a7a' },
  AWAITING_APPROVAL: { label: 'Awaiting approval', tone: '#ff4d1f' },
  DELIVERED: { label: 'Delivered', tone: '#39b36a' },
};

function statusOf(m: AdminMission) {
  return STATUS[m.status] ?? { label: m.state.replace(/_/g, ' ').toLowerCase(), tone: '#8fb7ff' };
}

function inFilter(m: AdminMission, f: Filter) {
  switch (f) {
    case 'ALL':
      return true;
    case 'UNPAID':
      return m.status === 'UNPAID';
    case 'AWAITING_APPROVAL':
      return m.status === 'AWAITING_APPROVAL';
    case 'DELIVERED':
      return m.state === 'DELIVERED';
    case 'CANCELLED':
      return m.state === 'CANCELLED';
    case 'IN_FLIGHT':
      return Boolean(m.paidAt) && m.state !== 'CANCELLED' && m.state !== 'DELIVERED';
  }
}

const when = (iso: string) =>
  new Date(iso).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });

export function AdminBoard({ missions }: { missions: AdminMission[] }) {
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>('ALL');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null);
  const [fileUrl, setFileUrl] = useState('');

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return missions.filter(
      (m) =>
        inFilter(m, filter) &&
        (!q ||
          m.code.toLowerCase().includes(q) ||
          m.email.toLowerCase().includes(q) ||
          m.locationLabel.toLowerCase().includes(q) ||
          (m.missionName ?? '').toLowerCase().includes(q)),
    );
  }, [missions, filter, query]);

  const current = missions.find((m) => m.code === selected) ?? null;

  async function act(code: string, action: 'approve' | 'advance' | 'refund' | 'reprint' | 'print', body?: unknown) {
    const confirmText: Partial<Record<typeof action, string>> = {
      approve: `Approve the final version of ${code} and place the Gelato print order?`,
      refund: `Refund (if paid) and CANCEL mission ${code}?`,
      reprint: `Send the current print file of ${code} to Gelato as a NEW order?`,
    };
    if (confirmText[action] && !window.confirm(confirmText[action])) return;
    setBusy(`${code}:${action}`);
    setMsg(null);
    try {
      const res = await fetch(`/api/admin/missions/${code}/${action}`, {
        method: 'POST',
        headers: body !== undefined ? { 'content-type': 'application/json' } : undefined,
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
      const json = (await res.json()) as { detail?: string; error?: string; mission?: { state?: string } };
      if (!res.ok) setMsg({ tone: 'err', text: `${code}: ${json.detail || json.error || `failed (${res.status})`}` });
      else {
        setMsg({ tone: 'ok', text: `${code}: ${action} → ${json.mission?.state ?? 'ok'}` });
        router.refresh();
      }
    } catch (e) {
      setMsg({ tone: 'err', text: `${code}: ${(e as Error).message}` });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="board">
      <div className="toolbar">
        <div className="chips" role="tablist" aria-label="Filter">
          {FILTERS.map((f) => {
            const n = missions.filter((m) => inFilter(m, f.id)).length;
            return (
              <button
                key={f.id}
                type="button"
                role="tab"
                aria-selected={filter === f.id}
                className={`chip${filter === f.id ? ' on' : ''}`}
                onClick={() => setFilter(f.id)}
              >
                {f.label} <span className="n">{n}</span>
              </button>
            );
          })}
        </div>
        <input
          className="search"
          placeholder="Search code, email, place, name…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search missions"
        />
      </div>

      {msg ? <p className={`flash ${msg.tone}`}>{msg.text}</p> : null}

      <div className={`layout${current ? ' with-detail' : ''}`}>
        <div className="tablewrap">
          <table>
            <thead>
              <tr>
                <th></th>
                <th>Mission</th>
                <th>Status</th>
                <th>Customer · target</th>
                <th>Order</th>
                <th className="r">Amount</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((m) => {
                const st = statusOf(m);
                const on = m.code === selected;
                return (
                  <tr
                    key={m.code}
                    className={on ? 'on' : ''}
                    onClick={() => {
                      setSelected(on ? null : m.code);
                      setFileUrl(m.printFileUrl ?? '');
                    }}
                  >
                    <td className="thumb">
                      {m.previewUrl ? (
                        <img src={`${m.previewUrl.replace('variant=full', 'w=160')}`} alt="" loading="lazy" />
                      ) : (
                        <span className="nothumb">—</span>
                      )}
                    </td>
                    <td>
                      <div className="code">
                        {m.code}
                        {m.isDemo ? <span className="tag">demo</span> : null}
                      </div>
                      <div className="dim">{m.missionName ?? '—'}</div>
                      <div className="dim">{when(m.createdAt)}</div>
                    </td>
                    <td>
                      <span className="dot" style={{ background: st.tone }} />
                      <span className="status" style={{ color: st.tone }}>
                        {st.label}
                      </span>
                      <div className="dim">{m.state.replace(/_/g, ' ').toLowerCase()}</div>
                    </td>
                    <td>
                      <div>{m.email}</div>
                      <div className="dim">{m.locationLabel}</div>
                    </td>
                    <td>
                      <div>{m.tier.replace(/_/g, ' ').toLowerCase()}</div>
                      <div className="dim">
                        {m.formatId} · {m.frame.toLowerCase()} · {m.areaKm} km
                      </div>
                    </td>
                    <td className="r">
                      <strong>{formatPrice(m.amountMinor, m.currency)}</strong>
                      <div className="dim">{m.paidAt ? `paid ${when(m.paidAt)}` : 'unpaid'}</div>
                    </td>
                    <td className="r">
                      {m.status === 'AWAITING_APPROVAL' ? (
                        <button
                          type="button"
                          className="btn hot"
                          disabled={busy !== null}
                          onClick={(e) => {
                            e.stopPropagation();
                            void act(m.code, 'approve');
                          }}
                        >
                          {busy === `${m.code}:approve` ? '…' : 'Approve & print'}
                        </button>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="dim" style={{ padding: 24 }}>
                    No missions match.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        {current ? (
          <aside className="detail" aria-label={`Mission ${current.code}`}>
            <div className="detailhead">
              <div>
                <div className="code big">{current.code}</div>
                <div className="dim">{current.missionName ?? 'unnamed mission'}</div>
              </div>
              <button type="button" className="btn ghost" onClick={() => setSelected(null)}>
                Close
              </button>
            </div>

            <div className="preview">
              {current.previewUrl ? (
                <a href={current.printUrl} target="_blank" rel="noreferrer" title="Open the print file">
                  <img src={current.previewUrl} alt={`Composition for mission ${current.code}`} />
                </a>
              ) : (
                <div className="nopreview">
                  No composition yet — the print is composed once a frame is acquired.
                </div>
              )}
            </div>

            <div className="links">
              <a href={current.ownerLink} target="_blank" rel="noreferrer">
                Owner page ↗
              </a>
              <a href={`${current.printUrl}?download=1`}>Download print file</a>
              {current.hasCapture ? (
                <a href={current.captureUrl}>Download captured image</a>
              ) : (
                <span className="dim" title="Available once SkyFi delivers the frame">
                  Captured image · not delivered yet
                </span>
              )}
            </div>

            <dl className="facts">
              <dt>Customer</dt>
              <dd>{current.email}</dd>
              <dt>Address</dt>
              <dd>{current.address}</dd>
              <dt>Coordinates</dt>
              <dd>
                {current.lat.toFixed(5)}, {current.lon.toFixed(5)} · {current.areaKm} km frame
              </dd>
              <dt>Order</dt>
              <dd>
                {current.tier} · {current.formatId} · {current.frame}
                {current.posterStyle ? ` · ${current.posterStyle}` : ''}
              </dd>
              <dt>Charged</dt>
              <dd>
                {formatPrice(current.amountMinor, current.currency)} {current.currency}
                {current.quoteNote ? <div className="dim">{current.quoteNote}</div> : null}
              </dd>
              <dt>References</dt>
              <dd className="mono">
                {current.stripePaymentIntentId ? <div>stripe {current.stripePaymentIntentId}</div> : null}
                {current.skyfiOrderId ? <div>skyfi {current.skyfiOrderId}</div> : null}
                {current.gelatoOrderId ? <div>gelato {current.gelatoOrderId}</div> : null}
                {current.trackingUrl ? (
                  <a href={current.trackingUrl} target="_blank" rel="noreferrer">
                    tracking ↗
                  </a>
                ) : null}
                {!current.stripePaymentIntentId && !current.skyfiOrderId && !current.gelatoOrderId ? '—' : null}
              </dd>
            </dl>

            <section className="printfile">
              <h3>Print file</h3>
              <p className="dim">
                Gelato is sent {current.printFileUrl ? 'the replacement below' : 'the composed print'}. Paste
                an absolute URL to a full-bleed 300 DPI PNG/JPEG/PDF to send a new version instead.
              </p>
              <div className="mono dim small">{current.printFileUrl ?? current.composedPrintFileUrl}</div>
              <div className="row">
                <input
                  className="search"
                  placeholder="https://…/mission-final.png"
                  value={fileUrl}
                  onChange={(e) => setFileUrl(e.target.value)}
                  aria-label="Replacement print file URL"
                />
                <button
                  type="button"
                  className="btn"
                  disabled={busy !== null || !fileUrl.trim()}
                  onClick={() => act(current.code, 'print', { fileUrl: fileUrl.trim() })}
                >
                  Save version
                </button>
                {current.printFileUrl ? (
                  <button
                    type="button"
                    className="btn ghost"
                    disabled={busy !== null}
                    onClick={() => act(current.code, 'print', { fileUrl: null })}
                  >
                    Reset
                  </button>
                ) : null}
              </div>
              <div className="row">
                <button
                  type="button"
                  className="btn"
                  disabled={busy !== null || !current.paidAt || current.state === 'CANCELLED'}
                  onClick={() => act(current.code, 'reprint')}
                  title="Places a new Gelato order with the current print file"
                >
                  {busy === `${current.code}:reprint` ? '…' : 'Send to Gelato'}
                </button>
              </div>
            </section>

            <section className="actions">
              <h3>Mission</h3>
              <div className="row">
                <button
                  type="button"
                  className="btn hot"
                  disabled={busy !== null || current.status !== 'AWAITING_APPROVAL'}
                  onClick={() => act(current.code, 'approve')}
                >
                  Approve & print
                </button>
                <button
                  type="button"
                  className="btn"
                  disabled={
                    busy !== null ||
                    !current.paidAt ||
                    current.state === 'CANCELLED' ||
                    current.state === 'DELIVERED' ||
                    current.state === 'PROCESSING'
                  }
                  onClick={() => act(current.code, 'advance')}
                >
                  Advance stage
                </button>
                <button
                  type="button"
                  className="btn danger"
                  disabled={busy !== null || current.state === 'CANCELLED'}
                  onClick={() => act(current.code, 'refund')}
                >
                  {current.paidAt ? 'Refund & cancel' : 'Cancel'}
                </button>
              </div>
            </section>

            <section className="timeline">
              <h3>Timeline</h3>
              <ol>
                {current.events
                  .slice()
                  .reverse()
                  .map((e, i) => (
                    <li key={`${e.at}-${i}`}>
                      <div className="mono dim small">{when(e.at)}</div>
                      <div className="evlabel">{e.label}</div>
                      {e.detail ? <div className="dim">{e.detail}</div> : null}
                    </li>
                  ))}
              </ol>
            </section>
          </aside>
        ) : null}
      </div>
    </div>
  );
}
