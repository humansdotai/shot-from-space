'use client';

import { useCallback, useEffect, useRef } from 'react';
import { FrameOnMap } from '@/components/frame/FrameOnMap';
import { CAPTURE_AREA_KM } from './capture';

/**
 * THE FRAMING TOOL, IN THE PREVIEW COLUMN.
 *
 * `components/frame/FrameOnMap.tsx` is another build's component and is
 * mounted here by import path and nothing else — this file adds no
 * geometry, no basemap and no attribution of its own, because all three
 * belong to it and it carries them.
 *
 * ------------------------------------------------------------------
 * WHY THE COMMIT IS DEBOUNCED
 * ------------------------------------------------------------------
 * `onChange` fires ONCE PER ANIMATION FRAME while the buyer drags or the
 * view glides — its own documentation says so, and says a consumer doing
 * real work per call should debounce on its side. Here the work is real:
 * the frame centre is the capture's coordinates, and writing it into the
 * draft re-keys the reveal's scene lookup and the poster's tile URL. A
 * one-second flick would otherwise open a hundred requests.
 *
 * So the tool's own view stays live — it owns it, and it redraws every
 * frame — and the DRAFT takes the value once the gesture has settled.
 * The last value always lands: the timer is trailing, and a pending one
 * is flushed on unmount rather than dropped.
 */
export function FramingStage({
  lat,
  lon,
  onCentre,
}: {
  lat: number;
  lon: number;
  /** The committed frame centre. Debounced — see above. */
  onCentre: (next: { lat: number; lon: number }) => void;
}) {
  const timer = useRef<number | null>(null);
  const pending = useRef<{ lat: number; lon: number } | null>(null);
  const sink = useRef(onCentre);
  sink.current = onCentre;

  const flush = useCallback(() => {
    if (timer.current !== null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
    const next = pending.current;
    pending.current = null;
    if (next) sink.current(next);
  }, []);

  useEffect(() => flush, [flush]);

  const onChange = useCallback(
    (next: { lat: number; lon: number; areaKm: number }) => {
      pending.current = { lat: next.lat, lon: next.lon };
      if (timer.current !== null) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(flush, 250);
    },
    [flush],
  );

  return (
    <FrameOnMap
      lat={lat}
      lon={lon}
      areaKm={CAPTURE_AREA_KM}
      onChange={onChange}
      className="h-full w-full"
    />
  );
}
