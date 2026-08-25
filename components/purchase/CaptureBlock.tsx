'use client';

import { useEffect, useState } from 'react';
import { CreditBox, CropMarks } from '@/components/fui';
import type { TargetAddress } from '@/lib/types';
import { clsx as cn } from 'clsx';
import { formatCoords, formatTelemetryTimestamp } from '@/lib/utils';
import { groundResolution } from '@/lib/tiles';
import { Segmented } from './fields';
import { TileMap } from './TileMap';
import { AREA_NOTE, AREA_OPTIONS, AREA_ZOOM, type AreaKm } from './state';

/**
 * LAYOUT NOTE — this block carries no container of its own.
 * It fills whatever column the aim screen hands it; the frame breaks out to the
 * screen edge below 768.
 */
const BLEED_FRAME = cn(
  '-mx-[var(--gutter-shell)] w-[calc(100%+2*var(--gutter-shell))]',
  'md:mx-0 md:w-full',
);

interface TileMeta {
  attribution: string;
  attributionHref: string;
  maxZoom: number;
  nativeMetres: number;
  label: string;
}

function Readout({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <dt className="text-label uppercase text-paper-dim">{label}</dt>
      <dd data-telemetry className="min-w-0 truncate font-mono text-tele uppercase text-paper-dim">
        {value}
      </dd>
    </div>
  );
}

/**
 * CAPTURE AREA — the target, aimed on a live satellite map.
 *
 * This is a real, draggable basemap of the customer's own coordinates, served
 * through /api/tiles. The crosshair is fixed at the centre and the ground moves
 * under it: drag to reposition the target, and the coordinates update live. The
 * footprint square is drawn true to the metres it claims, from the same
 * web-Mercator maths the tiles are addressed by. Changing the footprint changes
 * the zoom, so the square the satellite is pointed at is always shown against
 * the picture it changes.
 */
export function CaptureBlock({
  address,
  areaKm,
  onAreaChange,
  onRecenter,
}: {
  address: TargetAddress;
  areaKm: AreaKm;
  onAreaChange: (v: AreaKm) => void;
  onRecenter?: (lat: number, lon: number) => void;
}) {
  const [center, setCenter] = useState({ lat: address.lat, lon: address.lon });
  const [now, setNow] = useState<Date | null>(null);
  const [meta, setMeta] = useState<TileMeta | null>(null);

  // Keep the local readout in sync when the target changes from elsewhere
  // (a new address, or the +/- footprint re-aim).
  useEffect(() => {
    setCenter({ lat: address.lat, lon: address.lon });
  }, [address.lat, address.lon]);

  useEffect(() => {
    setNow(new Date());
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);

  // Which provider is actually serving, for a truthful attribution line and the
  // real zoom ceiling.
  useEffect(() => {
    let live = true;
    fetch('/api/tiles/meta')
      .then((r) => r.json())
      .then((d: TileMeta) => {
        if (live) setMeta(d);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);

  const zoom = AREA_ZOOM[areaKm];
  const maxZoom = meta?.maxZoom ?? 17;

  const recenter = (lat: number, lon: number) => {
    setCenter({ lat, lon });
    onRecenter?.(lat, lon);
  };

  return (
    <div>
      <div className={BLEED_FRAME}>
        <div
          className={cn(
            'relative aspect-square w-full overflow-hidden bg-deck-2 md:rounded-[var(--radius-action)]',
          )}
        >
          <TileMap
            lat={address.lat}
            lon={address.lon}
            zoom={zoom}
            maxZoom={maxZoom}
            onMove={(lat, lon) => setCenter({ lat, lon })}
            onRecenter={recenter}
          />

          {/* Footprint square + crosshair, fixed at centre. */}
          <FrameOverlay areaKm={areaKm} lat={center.lat} zoom={Math.min(maxZoom, zoom)} />

          {/* Registration marks sit on the frame edge, always. */}
          <CropMarks length={16} inset={10} />

          {/* Brand credit + a legibility scrim. */}
          <span
            aria-hidden
            className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-24 bg-linear-to-t from-void/75 via-void/25 to-transparent"
          />
          <div className="pointer-events-none absolute bottom-4 left-4 z-20">
            <CreditBox size="xs" />
          </div>

          {/* Drag hint + basemap attribution (a licence condition). */}
          <div className="pointer-events-none absolute inset-x-4 top-4 z-20 flex items-start justify-between gap-3">
            <span data-telemetry className="font-mono text-tele-xs uppercase text-paper-dim">
              Drag to reposition
            </span>
          </div>
          {meta ? (
            <span className="pointer-events-none absolute bottom-3 right-3 z-20 max-w-[60%] truncate text-right font-mono text-tele-xs text-paper-dim/80">
              {meta.attribution}
            </span>
          ) : null}
        </div>
      </div>

      <dl className="mt-7 grid grid-cols-2 gap-x-6 gap-y-6 xl:mt-8">
        <Readout label="Coordinates" value={formatCoords(center.lat, center.lon)} />
        <Readout label="Time" value={now ? formatTelemetryTimestamp(now) : '--:--—— --.--.----'} />
      </dl>

      {/* Footprint selection ------------------------------------------ */}
      <div className="mt-8 xl:mt-10">
        <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 pb-3">
          <p className="text-label uppercase text-paper-dim">Ground footprint</p>
          <p className="hidden text-label uppercase text-paper-dim md:block">
            Square, centred on the target
          </p>
        </div>
        <Segmented
          name="area"
          label="Capture area footprint"
          value={areaKm}
          onChange={onAreaChange}
          options={AREA_OPTIONS.map((a) => ({ value: a, label: `${a} km` }))}
        />
        <p className="max-w-[52ch] pt-4 text-body text-paper-dim">{AREA_NOTE[areaKm]}</p>
        <p className="max-w-[52ch] pt-2 text-body text-paper-dim">
          {meta && meta.nativeMetres > 2
            ? 'A reference basemap for aiming, not the frame the satellite will return. The tasked capture resolves far finer.'
            : 'A reference basemap for aiming. The tasked capture is composed from the fresh frame the satellite returns.'}
        </p>
      </div>
    </div>
  );
}

/**
 * The aiming reticle and the true-to-scale footprint square, centred on the
 * map. Both are drawn from the live pixel size so the square really is the
 * footprint it names.
 */
function FrameOverlay({ areaKm, lat, zoom }: { areaKm: AreaKm; lat: number; zoom: number }) {
  const ref = useState<HTMLDivElement | null>(null);
  const [box, setBox] = useState<number>(0);
  const [el, setEl] = ref;

  useEffect(() => {
    if (!el) return;
    const measure = () => {
      const px = el.clientWidth;
      const mpp = groundResolution(lat, zoom); // metres per pixel
      const side = (areaKm * 1000) / mpp; // footprint side in px
      setBox(Math.max(0, Math.min(px, side)));
    };
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    measure();
    return () => ro.disconnect();
  }, [el, areaKm, lat, zoom]);

  return (
    <div ref={setEl} aria-hidden className="pointer-events-none absolute inset-0 z-10">
      {/* Footprint square */}
      {box > 0 ? (
        <span
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 border border-[color:var(--color-signal)] opacity-90"
          style={{ width: box, height: box }}
        />
      ) : null}
      {/* Crosshair */}
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        className="absolute inset-0 h-full w-full"
      >
        <g stroke="var(--color-paper)" strokeWidth="0.35" opacity="0.85">
          <line x1="50" y1="42" x2="50" y2="48" vectorEffect="non-scaling-stroke" />
          <line x1="50" y1="52" x2="50" y2="58" vectorEffect="non-scaling-stroke" />
          <line x1="42" y1="50" x2="48" y2="50" vectorEffect="non-scaling-stroke" />
          <line x1="52" y1="50" x2="58" y2="50" vectorEffect="non-scaling-stroke" />
        </g>
      </svg>
    </div>
  );
}
