'use client';

import Image from 'next/image';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Button, CreditBox, CropMarks, ScanSweep } from '@/components/fui';
import type { TargetAddress } from '@/lib/types';
import { clsx as cn } from 'clsx';
import { formatCoords, formatTelemetryTimestamp } from '@/lib/utils';
import { staticPreviewUrl } from './api';
import { Segmented } from './fields';
import { AREA_NOTE, AREA_OPTIONS, AREA_ZOOM, type AreaKm } from './state';

/**
 * LAYOUT NOTE — this block carries no container of its own.
 *
 * It fills whatever column the aim screen hands it, so the horizontal inset
 * belongs to the parent. The one exception is the frame itself, which breaks
 * back out to the screen edge below 768 — a photograph on a phone is worth
 * more than a 32px margin.
 */
const BLEED_FRAME = cn(
  '-mx-[var(--gutter-shell)] w-[calc(100%+2*var(--gutter-shell))]',
  'md:mx-0 md:w-full',
);

/* ------------------------------------------------------------------ */
/* The acquisition sequence                                            */
/* ------------------------------------------------------------------ */

/**
 * Four stages, in the order the pipeline would actually run them, with the
 * timings tuned so the whole thing is over in well under a second. This is
 * the moment the flow is built around — the address stops being a string and
 * becomes a square of ground — so it is staged rather than faded in.
 *
 * The stages are not filler and they are not a fake progress bar: the frame
 * genuinely is being requested for those coordinates at that zoom, and the
 * overlay clears only when the tile has actually arrived. If the network is
 * slower than the sequence, the sequence waits; it never reports ready before
 * the picture is.
 */
const STAGE_MS = [0, 260, 560, 820] as const;

type Stage = 0 | 1 | 2 | 3;

function useAcquisition(key: string): { stage: Stage; still: boolean } {
  const [stage, setStage] = useState<Stage>(0);
  const [still, setStill] = useState(false);

  useEffect(() => {
    /* Reduced motion gets the end state immediately: the sequence is a
       gesture, and a reader who has asked for no gestures is owed the
       picture, not a slower picture. */
    const reduce =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    setStill(reduce);
    if (reduce) {
      setStage(3);
      return;
    }

    setStage(0);
    const timers = STAGE_MS.slice(1).map((ms, i) =>
      window.setTimeout(() => setStage((i + 1) as Stage), ms),
    );
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [key]);

  return { stage, still };
}

/**
 * The coordinate settling onto its value.
 *
 * The last three decimals run for a few hundred milliseconds and then stop on
 * the real number — a lock-on, not a readout of anything. The whole figure is
 * always the buyer's own coordinate; only the tail is in motion, and only
 * while the frame is being fetched. Under reduced motion it never moves.
 */
function useSettling(value: number, active: boolean, still: boolean): number {
  const [shown, setShown] = useState(value);
  const raf = useRef<number | null>(null);

  useEffect(() => {
    if (still || !active) {
      setShown(value);
      return;
    }
    const started = performance.now();
    const DURATION = 520;
    const tick = (t: number) => {
      const progress = Math.min(1, (t - started) / DURATION);
      // Amplitude collapses to zero, so the last frame is the true value.
      const spread = 0.004 * (1 - progress) ** 2;
      setShown(value + (Math.random() * 2 - 1) * spread);
      if (progress < 1) raf.current = window.requestAnimationFrame(tick);
      else setShown(value);
    };
    raf.current = window.requestAnimationFrame(tick);
    return () => {
      if (raf.current !== null) window.cancelAnimationFrame(raf.current);
      setShown(value);
    };
  }, [value, active, still]);

  return shown;
}

/**
 * The tasking log, printed into the corner of the frame while it resolves.
 *
 * Every line states something the request actually contains: the coordinates
 * being aimed at, the footprint asked for, the tile being fetched. It is a
 * log, not a loading message, so it accumulates rather than replacing itself.
 */
function AimLog({ stage, coords, areaKm }: { stage: Stage; coords: string; areaKm: AreaKm }) {
  const lines = [
    `TARGET ACCEPTED / ${coords}`,
    `FOOTPRINT ${areaKm} × ${areaKm} KM`,
    'AIMING CAPTURE AREA',
    'RESOLVING FRAME',
  ];
  return (
    <div className="pointer-events-none absolute inset-x-7 bottom-7 z-20 flex flex-col gap-1 md:inset-x-8 md:bottom-8">
      {lines.slice(0, stage + 1).map((line) => (
        <span
          key={line}
          data-telemetry
          className="truncate font-mono text-tele-xs uppercase text-paper-dim"
        >
          {line}
        </span>
      ))}
    </div>
  );
}

/**
 * The aiming reticle.
 *
 * A square that starts at the edge of the frame and closes onto the centre,
 * with the crosshair arms extending in behind it. It is the same reticle the
 * finished frame carries — it is not added and removed, it arrives. That is
 * the difference between a field validating and an instrument being pointed.
 */
function Reticle({ stage }: { stage: Stage }) {
  const closed = stage >= 1;
  const armed = stage >= 2;
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 z-10">
      <span
        className={cn(
          'absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 border',
          'border-[color:var(--color-signal)] transition-all duration-500 ease-house',
          closed ? 'h-[16%] w-[16%] opacity-90' : 'h-[88%] w-[88%] opacity-40',
        )}
      />
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        className={cn(
          'absolute inset-0 h-full w-full transition-opacity duration-house ease-house',
          armed ? 'opacity-100' : 'opacity-0',
        )}
      >
        <g stroke="var(--color-paper)" strokeWidth="0.35" opacity="0.75">
          <line x1="50" y1="38" x2="50" y2="46" vectorEffect="non-scaling-stroke" />
          <line x1="50" y1="54" x2="50" y2="62" vectorEffect="non-scaling-stroke" />
          <line x1="38" y1="50" x2="46" y2="50" vectorEffect="non-scaling-stroke" />
          <line x1="54" y1="50" x2="62" y2="50" vectorEffect="non-scaling-stroke" />
        </g>
      </svg>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Readouts                                                            */
/* ------------------------------------------------------------------ */

/**
 * One reading beside the frame. Monospace here is not decoration: a
 * coordinate and a running clock are the two values on this page that are
 * read as instrument output, and they are the only two set in the mono face.
 */
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
 * CAPTURE AREA — the emotional centre of the purchase.
 *
 * The moment the target stops being a string and becomes a frame. Below 768
 * the picture runs edge to edge, the way the top half of the poster does;
 * from 768 it insets and takes the house curve.
 *
 * It is composed as a capture — registration marks, a centre reticle, the
 * print credit in the corner — with two readings underneath and nothing more.
 * No map controls, no pins: this is a photograph being aimed, not a map being
 * browsed. Changing the footprint re-runs the whole acquisition, because it
 * genuinely is a different capture, and that is the point of putting the
 * footprint on this screen rather than on a list of options somewhere else:
 * the choice is made against the picture it changes.
 *
 * The screen around it owns the heading and the control that closes it; this
 * component owns the frame, its two readings and the footprint.
 */
export function CaptureBlock({
  address,
  areaKm,
  onAreaChange,
}: {
  address: TargetAddress;
  areaKm: AreaKm;
  onAreaChange: (v: AreaKm) => void;
}) {
  const src = useMemo(
    () => staticPreviewUrl(address.lat, address.lon, AREA_ZOOM[areaKm]),
    [address.lat, address.lon, areaKm],
  );

  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [now, setNow] = useState<Date | null>(null);

  const key = `${src}#${attempt}`;
  const { stage, still } = useAcquisition(key);

  // A new target or a new footprint is a new acquisition.
  useEffect(() => {
    setLoaded(false);
    setFailed(false);
  }, [key]);

  // Running clock beside the frame. This is the only live element here.
  useEffect(() => {
    setNow(new Date());
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);

  /* Ready means both things: the sequence has run its course AND the tile has
     actually arrived. Whichever is slower is the one that holds the frame. */
  const ready = loaded && stage >= 3;
  const acquiring = !ready && !failed;

  const lat = useSettling(address.lat, acquiring, still);
  const lon = useSettling(address.lon, acquiring, still);

  return (
    <div>
      <div className={BLEED_FRAME}>
        <div
          className={cn(
            'relative aspect-square w-full overflow-hidden bg-deck-2 md:rounded-[var(--radius-action)]',
            !ready && !failed && 'fui-loading',
          )}
          aria-busy={acquiring}
        >
          {!failed ? (
            <Image
              key={key}
              src={src}
              alt={`Simulated satellite capture of ${address.city}, a ${areaKm} kilometre square centred on ${formatCoords(address.lat, address.lon)}`}
              fill
              unoptimized
              sizes="(min-width: 1280px) 44vw, (min-width: 768px) 700px, 100vw"
              className={cn(
                'object-cover transition-opacity duration-house ease-house',
                ready ? 'opacity-100' : 'opacity-0',
              )}
              onLoad={() => setLoaded(true)}
              onError={() => setFailed(true)}
            />
          ) : null}

          {/* Registration marks sit on the frame edge, always. */}
          <CropMarks length={16} inset={10} />

          {/* The reticle is the same drawing acquiring and ready — it closes
              onto the centre and then stays there. */}
          {!failed ? <Reticle stage={stage} /> : null}

          {acquiring && !still ? <ScanSweep repeat /> : null}

          {/* The brand element: a print credit in the corner of a frame, over
              a short legibility scrim. Never anywhere else. */}
          {ready ? (
            <>
              <span
                aria-hidden
                className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-24 bg-linear-to-t from-void/75 via-void/25 to-transparent"
              />
              <div className="pointer-events-none absolute bottom-4 left-4 z-20">
                <CreditBox size="xs" />
              </div>
            </>
          ) : null}

          {acquiring ? (
            <AimLog
              stage={stage}
              coords={formatCoords(address.lat, address.lon)}
              areaKm={areaKm}
            />
          ) : null}

          {failed ? (
            <div className="fui-hatch absolute inset-0 z-10 flex flex-col items-center justify-center gap-5 px-6 text-center">
              <p className="text-label uppercase text-signal">Preview unavailable</p>
              <p className="max-w-[32ch] text-body text-paper-dim">
                The target is locked and the order can proceed. Only the preview frame
                failed to resolve.
              </p>
              <Button variant="secondary" size="md" onClick={() => setAttempt((a) => a + 1)}>
                Retry acquisition
              </Button>
            </div>
          ) : null}
        </div>
      </div>

      {/* The one live announcement: assistive tech is told the frame landed,
          not read the whole sequence. */}
      <p className="sr-only" aria-live="polite">
        {ready
          ? `Capture area resolved over ${address.city}. ${areaKm} by ${areaKm} kilometres.`
          : failed
            ? 'Preview frame unavailable. The target is still locked.'
            : 'Resolving the capture area.'}
      </p>

      <dl className="mt-7 grid grid-cols-2 gap-x-6 gap-y-6 xl:mt-8">
        <Readout label="Coordinates" value={formatCoords(lat, lon)} />
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
          A simulated preview, not the frame the satellite will return. The tasked capture
          resolves about sixty times finer.
        </p>
      </div>
    </div>
  );
}
