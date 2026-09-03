'use client';

/**
 * EXISTING CAPTURES — the historical scenes on file over the target.
 *
 * Listed newest first from /api/archives with the total each one would
 * cost at the chosen size and finish. Picking one makes the mission an
 * ARCHIVE order for exactly that capture; the date, resolution and cloud
 * figures are the scene's own.
 */
import { useEffect, useState } from 'react';
import { clsx as cn } from 'clsx';
import { INK, INK_DIM, RULE } from '@/components/purchase/fields';
import type { ChosenArchive } from '@/lib/mission-flow/state';
import { formatPrice } from '@/lib/pricing';
import type { Currency, FormatId, FrameOption } from '@/lib/types';
import { PanelGroup, PanelNote } from './Panel';

interface SceneRow {
  id: string;
  capturedAt: string | null;
  gsdCm: number | null;
  resolution: string;
  cloudPct: number | null;
  offNadirDeg: number | null;
  openData: boolean;
  totalMinor: number;
  currency: Currency;
  thumb: string | null;
}

export function captureDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  return d
    .toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    .toUpperCase();
}

export function ExistingCaptures({
  lat,
  lon,
  areaKm,
  currency,
  formatId,
  frame,
  chosen,
  onSelect,
}: {
  lat: number;
  lon: number;
  areaKm: number;
  currency: Currency;
  formatId: FormatId;
  frame: FrameOption;
  chosen: ChosenArchive | null;
  onSelect: (scene: ChosenArchive) => void;
}) {
  const [scenes, setScenes] = useState<SceneRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    setScenes(null);
    setError(null);
    const q = new URLSearchParams({
      lat: lat.toFixed(4),
      lon: lon.toFixed(4),
      area: String(areaKm),
      currency,
      formatId,
      frame,
    });
    fetch(`/api/archives?${q.toString()}`)
      .then((r) => r.json())
      .then((d: { scenes?: SceneRow[]; detail?: string }) => {
        if (!live) return;
        if (!d.scenes) setError(d.detail ?? 'The archive could not be read.');
        else setScenes(d.scenes);
      })
      .catch(() => live && setError('The archive could not be read. Check the connection and retry.'));
    return () => {
      live = false;
    };
  }, [lat, lon, areaKm, currency, formatId, frame]);

  return (
    <PanelGroup label="Existing captures" hint={scenes ? `${scenes.length} on file` : undefined}>
      {scenes === null && !error ? (
        <p role="status" className={cn('py-6 text-note', INK_DIM)}>
          Reading the archive over your coordinates…
        </p>
      ) : null}
      {error ? <PanelNote>{error}</PanelNote> : null}
      {scenes && scenes.length === 0 ? (
        <PanelNote>No priced capture is on file over these coordinates. Choose a new capture instead.</PanelNote>
      ) : null}

      {scenes && scenes.length > 0 ? (
        <ul role="radiogroup" aria-label="Existing captures" className="flex flex-col">
          {scenes.map((s) => {
            const on = chosen?.id === s.id;
            const cloudy = (s.cloudPct ?? 0) >= 40;
            return (
              <li key={s.id} className={cn('border-b', RULE)}>
                <button
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() =>
                    onSelect({
                      id: s.id,
                      capturedAt: s.capturedAt ?? new Date().toISOString(),
                      gsdCm: s.gsdCm,
                      cloudPct: s.cloudPct,
                      resolution: s.resolution,
                    })
                  }
                  className={cn(
                    'flex w-full items-center gap-4 py-3 text-left transition-colors',
                    on ? 'bg-[color:var(--accent)]/10' : 'hover:bg-[color:var(--ink)]/5',
                  )}
                >
                  <span
                    aria-hidden
                    className={cn(
                      'block h-14 w-14 shrink-0 overflow-hidden border bg-black',
                      RULE,
                      on ? 'outline outline-2 outline-[color:var(--accent)]' : '',
                    )}
                  >
                    {s.thumb ? (
                      <img src={s.thumb} alt="" loading="lazy" className="block h-full w-full object-cover" />
                    ) : null}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={cn('block font-mono text-tele uppercase tabular-nums', INK)}>
                      {s.capturedAt ? captureDate(s.capturedAt) : 'UNDATED'}
                    </span>
                    <span className={cn('block pt-1 text-note', cloudy ? INK_DIM : INK)}>
                      {s.gsdCm ? `${s.gsdCm} cm per pixel` : s.resolution}
                      {s.cloudPct !== null ? ` · ${s.cloudPct}% cloud` : ''}
                      {s.offNadirDeg !== null ? ` · ${s.offNadirDeg}° off-nadir` : ''}
                    </span>
                  </span>
                  <span className={cn('shrink-0 font-mono text-tele tabular-nums', INK)} data-telemetry>
                    {formatPrice(s.totalMinor, s.currency)}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </PanelGroup>
  );
}
