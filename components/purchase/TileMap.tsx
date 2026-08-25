'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  TILE_SIZE,
  clampLat,
  latToWorldY,
  lonToWorldX,
  worldXToLon,
  worldYToLat,
  wrapLon,
} from '@/lib/tiles';

/**
 * An interactive satellite basemap for the aim step.
 *
 * It renders real tiles of the ACTUAL coordinates from `/api/tiles/{z}/{x}/{y}`
 * — the same server proxy the rest of the product uses, so attribution stays
 * honest and a MAPTILER_KEY / MAPBOX_ACCESS_TOKEN upgrades every pixel here
 * with no client change. Drag to reposition the target: the crosshair is fixed
 * at the centre and the ground moves under it, and on release the new centre is
 * reported up as lat/lon.
 *
 * Web-Mercator maths comes from lib/tiles.ts so the footprint square drawn over
 * it stays true to the metres it claims.
 */

const MIN_Z = 1;
const MAX_Z = 19;

interface Props {
  lat: number;
  lon: number;
  /** Integer web-mercator zoom. Clamped to the provider ceiling. */
  zoom: number;
  maxZoom?: number;
  /** Fired continuously while dragging, with the live centre. */
  onMove?: (lat: number, lon: number) => void;
  /** Fired once, on drag release, with the settled centre. */
  onRecenter: (lat: number, lon: number) => void;
  className?: string;
}

export function TileMap({ lat, lon, zoom, maxZoom = 17, onMove, onRecenter, className }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [drag, setDrag] = useState({ dx: 0, dy: 0 });
  const gesture = useRef<{ id: number; x: number; y: number } | null>(null);

  const z = Math.max(MIN_Z, Math.min(MAX_Z, maxZoom, Math.round(zoom)));

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      setSize({ w: el.clientWidth, h: el.clientHeight });
    });
    ro.observe(el);
    setSize({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  // Absolute world-pixel centre of the target at this zoom, offset by the live
  // drag so the ground tracks the finger without a re-fetch per frame.
  const centreX = lonToWorldX(lon, z) - drag.dx;
  const centreY = latToWorldY(clampLat(lat), z) - drag.dy;

  const centreFromDrag = useCallback(
    (dx: number, dy: number) => {
      const cx = lonToWorldX(lon, z) - dx;
      const cy = latToWorldY(clampLat(lat), z) - dy;
      return { lat: worldYToLat(cy, z), lon: wrapLon(worldXToLon(cx, z)) };
    },
    [lat, lon, z],
  );

  const onPointerDown = (e: React.PointerEvent) => {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    gesture.current = { id: e.pointerId, x: e.clientX, y: e.clientY };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const g = gesture.current;
    if (!g || g.id !== e.pointerId) return;
    const dx = e.clientX - g.x;
    const dy = e.clientY - g.y;
    setDrag({ dx, dy });
    if (onMove) {
      const c = centreFromDrag(dx, dy);
      onMove(c.lat, c.lon);
    }
  };

  const endGesture = (e: React.PointerEvent) => {
    const g = gesture.current;
    if (!g || g.id !== e.pointerId) return;
    const dx = e.clientX - g.x;
    const dy = e.clientY - g.y;
    gesture.current = null;
    setDrag({ dx: 0, dy: 0 });
    if (dx !== 0 || dy !== 0) {
      const c = centreFromDrag(dx, dy);
      onRecenter(c.lat, c.lon);
    }
  };

  // Tiles covering the viewport.
  const tiles: { key: string; x: number; y: number; left: number; top: number }[] = [];
  if (size.w > 0 && size.h > 0) {
    const originX = centreX - size.w / 2;
    const originY = centreY - size.h / 2;
    const span = 2 ** z;
    const tx0 = Math.floor(originX / TILE_SIZE);
    const tx1 = Math.floor((originX + size.w) / TILE_SIZE);
    const ty0 = Math.floor(originY / TILE_SIZE);
    const ty1 = Math.floor((originY + size.h) / TILE_SIZE);
    for (let ty = ty0; ty <= ty1; ty++) {
      if (ty < 0 || ty >= span) continue; // no vertical wrap
      for (let tx = tx0; tx <= tx1; tx++) {
        const wx = ((tx % span) + span) % span; // wrap longitude
        tiles.push({
          key: `${z}/${wx}/${ty}`,
          x: wx,
          y: ty,
          left: Math.round(tx * TILE_SIZE - originX),
          top: Math.round(ty * TILE_SIZE - originY),
        });
      }
    }
  }

  return (
    <div
      ref={ref}
      className={className}
      style={{ position: 'absolute', inset: 0, overflow: 'hidden', touchAction: 'none', cursor: gesture.current ? 'grabbing' : 'grab' }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endGesture}
      onPointerCancel={endGesture}
      role="application"
      aria-label="Draggable satellite map. Drag to reposition the capture target."
    >
      {tiles.map((t) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={t.key}
          src={`/api/tiles/${z}/${t.x}/${t.y}`}
          alt=""
          draggable={false}
          width={TILE_SIZE}
          height={TILE_SIZE}
          style={{
            position: 'absolute',
            left: t.left,
            top: t.top,
            width: TILE_SIZE,
            height: TILE_SIZE,
            userSelect: 'none',
            pointerEvents: 'none',
          }}
        />
      ))}
    </div>
  );
}
