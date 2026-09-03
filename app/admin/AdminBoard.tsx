'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { AdminMission } from '@/lib/admin';
import { formatPrice } from '@/lib/pricing';

const STATUS_COLOR: Record<string, string> = {
  UNPAID: '#c98a00',
  CANCELLED: '#8a8a8a',
  AWAITING_APPROVAL: '#ff4d1f',
  DELIVERED: '#1f8f4d',
};

export function AdminBoard({ missions }: { missions: AdminMission[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  async function act(code: string, action: 'approve' | 'advance' | 'refund') {
    if (action === 'refund' && !window.confirm(`Refund (if paid) and CANCEL mission ${code}?`)) return;
    if (action === 'approve' && !window.confirm(`Approve the final version of ${code} and place the Gelato print order?`)) return;
    setBusy(`${code}:${action}`);
    setMsg(null);
    try {
      const res = await fetch(`/api/admin/missions/${code}/${action}`, { method: 'POST' });
      const body = (await res.json()) as { detail?: string; error?: string; mission?: { state?: string } };
      if (!res.ok) {
        setMsg(`${code}: ${body.detail || body.error || `failed (${res.status})`}`);
      } else {
        setMsg(`${code}: ${action} → ${body.mission?.state ?? 'ok'}`);
        router.refresh();
      }
    } catch (e) {
      setMsg(`${code}: ${(e as Error).message}`);
    } finally {
      setBusy(null);
    }
  }

  const th: React.CSSProperties = { textAlign: 'left', padding: '8px 10px', fontWeight: 600, whiteSpace: 'nowrap' };
  const td: React.CSSProperties = { padding: '8px 10px', verticalAlign: 'top', borderTop: '1px solid #ddd' };
  const btn = (active: boolean, color = '#111'): React.CSSProperties => ({
    display: 'inline-block',
    marginRight: 6,
    marginBottom: 4,
    padding: '5px 9px',
    border: `1px solid ${active ? color : '#bbb'}`,
    background: active ? color : 'transparent',
    color: active ? '#fff' : '#999',
    cursor: active ? 'pointer' : 'not-allowed',
    fontSize: 11,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
  });

  return (
    <div>
      {msg ? <p style={{ padding: '8px 10px', background: '#fff3e8', border: '1px solid #ff4d1f' }}>{msg}</p> : null}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 12 }}>
          <thead>
            <tr style={{ background: '#111', color: '#fff' }}>
              <th style={th}>Mission</th>
              <th style={th}>Status</th>
              <th style={th}>Customer</th>
              <th style={th}>Target</th>
              <th style={th}>Order</th>
              <th style={th}>Amount</th>
              <th style={th}>Refs</th>
              <th style={th}>Last event</th>
              <th style={th}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {missions.map((m) => {
              const color = STATUS_COLOR[m.status] ?? '#111';
              const canApprove = m.status === 'AWAITING_APPROVAL';
              const canAdvance = Boolean(m.paidAt) && m.state !== 'CANCELLED' && m.state !== 'DELIVERED' && m.state !== 'PROCESSING';
              const canRefund = m.state !== 'CANCELLED';
              return (
                <tr key={m.code}>
                  <td style={td}>
                    <strong>{m.code}</strong>
                    {m.isDemo ? <span style={{ marginLeft: 6, color: '#999' }}>demo</span> : null}
                    <br />
                    <span style={{ color: '#666' }}>{new Date(m.createdAt).toLocaleString('en-GB')}</span>
                    <br />
                    <a href={m.ownerLink} target="_blank" rel="noreferrer" style={{ color: '#0645ad' }}>
                      owner link ↗
                    </a>
                    {' · '}
                    <a href={m.proofUrl} target="_blank" rel="noreferrer" style={{ color: '#0645ad' }}>
                      final version ↗
                    </a>
                  </td>
                  <td style={td}>
                    <span style={{ color, fontWeight: 700 }}>{m.status.replace('_', ' ')}</span>
                    <br />
                    <span style={{ color: '#666' }}>{m.state}</span>
                    {m.paidAt ? (
                      <>
                        <br />
                        <span style={{ color: '#666' }}>paid {new Date(m.paidAt).toLocaleString('en-GB')}</span>
                      </>
                    ) : null}
                  </td>
                  <td style={td}>{m.email}</td>
                  <td style={td}>
                    {m.locationLabel}
                    <br />
                    <span style={{ color: '#666' }}>{m.address}</span>
                    <br />
                    <span style={{ color: '#666' }}>
                      {m.lat.toFixed(5)}, {m.lon.toFixed(5)} · {m.areaKm} km
                    </span>
                  </td>
                  <td style={td}>
                    {m.tier}
                    <br />
                    {m.formatId} · {m.frame}
                    {m.quoteNote ? (
                      <>
                        <br />
                        <span style={{ color: '#666' }}>{m.quoteNote}</span>
                      </>
                    ) : null}
                  </td>
                  <td style={td}>
                    <strong>{formatPrice(m.amountMinor, m.currency)}</strong> {m.currency}
                  </td>
                  <td style={{ ...td, color: '#666', maxWidth: 220, wordBreak: 'break-all' }}>
                    {m.stripePaymentIntentId ? <>stripe {m.stripePaymentIntentId}<br /></> : null}
                    {m.skyfiOrderId ? <>skyfi {m.skyfiOrderId}<br /></> : null}
                    {m.gelatoOrderId ? <>gelato {m.gelatoOrderId}<br /></> : null}
                    {m.trackingUrl ? <a href={m.trackingUrl} target="_blank" rel="noreferrer">tracking ↗</a> : null}
                  </td>
                  <td style={{ ...td, maxWidth: 320 }}>
                    {m.lastEvent ? (
                      <>
                        <strong>{m.lastEvent.label}</strong>
                        <br />
                        <span style={{ color: '#666' }}>{m.lastEvent.detail}</span>
                      </>
                    ) : null}
                  </td>
                  <td style={{ ...td, whiteSpace: 'nowrap' }}>
                    <button type="button" style={btn(canApprove, '#ff4d1f')} disabled={!canApprove || busy !== null} onClick={() => act(m.code, 'approve')}>
                      {busy === `${m.code}:approve` ? '…' : 'Approve & print'}
                    </button>
                    <br />
                    <button type="button" style={btn(canAdvance)} disabled={!canAdvance || busy !== null} onClick={() => act(m.code, 'advance')}>
                      {busy === `${m.code}:advance` ? '…' : 'Advance stage'}
                    </button>
                    <br />
                    <button type="button" style={btn(canRefund, '#8a1f1f')} disabled={!canRefund || busy !== null} onClick={() => act(m.code, 'refund')}>
                      {busy === `${m.code}:refund` ? '…' : m.paidAt ? 'Refund & cancel' : 'Cancel'}
                    </button>
                  </td>
                </tr>
              );
            })}
            {missions.length === 0 ? (
              <tr>
                <td style={td} colSpan={9}>
                  No missions yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
