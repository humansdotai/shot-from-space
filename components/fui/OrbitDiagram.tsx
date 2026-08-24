import type { CSSProperties } from 'react';
import { cn } from '@/lib/utils';

/**
 * Orbit schematic — instrumentation, not illustration.
 *
 * A body with a graticule, a bearing ring with real tick marks, the ground
 * track across the disc, the inclined orbit and a pass marker with a
 * crosshair. `track` is the house string, e.g. `//ELIPSE 33°`; the number in
 * it drives the tilt, so the drawing always agrees with the label.
 *
 * ANIMATED: the marker travels the ellipse it is drawn on. `offset-path`
 * takes the *same path string* that strokes the track, so the object can
 * never drift off its own orbit — which is the only way this reads as a
 * readout rather than a decoration. One slow revolution (default 16s, tuned
 * so the marker crosses the disc at roughly a walking pace at 132px) and no
 * easing: an orbit has constant angular character, so `linear` is the honest
 * curve here and the one place the house ease does not apply.
 *
 * `offset-rotate: 0deg` pins the crosshair square to the drawing while the
 * object moves. Under `prefers-reduced-motion` the animation is removed
 * outright and the marker parks at `phase` — a static diagram, not a frozen
 * frame at 100%. See `app/globals.css` → `.orbit-marker`.
 *
 * DENSITY: at most ONE of these per viewport (CONTRACT.md §2). It is a
 * garnish on a page whose hero is a photograph.
 *
 * Every stroke uses `vector-effect="non-scaling-stroke"`, so the hairlines
 * stay exactly 1px whether the diagram is rendered at 96px or 220px, and
 * every colour comes from `--rule` / `--ink` / `--accent` rather than from a
 * named value — the diagram belongs to the LIGHT half of the poster, so it
 * has to draw itself correctly on paper as well as on void.
 */
export function OrbitDiagram({
  track = '//ELIPSE 33°',
  inclination,
  size = 132,
  animated = false,
  altitudeKm,
  phase = 0.12,
  periodMs = 16000,
  className,
}: {
  track?: string;
  inclination?: string;
  size?: number;
  /** The marker travels the track on a slow loop. Live passes only. */
  animated?: boolean;
  /** Adds an `ALT:` readout under the diagram. */
  altitudeKm?: number;
  /** Marker position on the track, 0..1. The rest phase when animated. */
  phase?: number;
  /** One revolution, in ms. Slower reads calmer; never under 10s. */
  periodMs?: number;
  className?: string;
}) {
  const deg = Number(track.match(/(\d+(?:\.\d+)?)/)?.[1] ?? 33);
  const c = 100;
  const R = 40; // body radius
  const RING = 56; // bearing ring radius
  const RX = 84; // orbit semi-major
  const RY = 30; // orbit semi-minor

  /**
   * Trigonometric results are rounded before they reach an attribute.
   *
   * Math.sin/Math.cos are allowed to differ in the final ULP between the
   * server's V8 and the browser's, so an unrounded coordinate serialises as
   * `51.502577388071444` on one side and `51.50257738807145` on the other —
   * a hydration mismatch React refuses to patch. Three decimals is far below
   * a subpixel at any size this renders at.
   */
  const px = (n: number) => Math.round(n * 1000) / 1000;

  // Pass marker on the (unrotated) ellipse; the parent <g> applies the tilt.
  const t = Math.PI * 2 * phase;
  const mx = px(c + RX * Math.cos(t));
  const my = px(c + RY * Math.sin(t));

  // Bearing ring ticks: 24 marks, long every 90°.
  const ticks = Array.from({ length: 24 }, (_, i) => {
    const a = (Math.PI * 2 * i) / 24;
    const long = i % 6 === 0;
    const r1 = RING;
    const r2 = RING + (long ? 7 : 3.5);
    return {
      x1: px(c + r1 * Math.cos(a)),
      y1: px(c + r1 * Math.sin(a)),
      x2: px(c + r2 * Math.cos(a)),
      y2: px(c + r2 * Math.sin(a)),
      long,
    };
  });

  const orbitPath = `M ${c + RX},${c} A ${RX},${RY} 0 1,1 ${c - RX},${c} A ${RX},${RY} 0 1,1 ${c + RX},${c}`;

  /**
   * The marker, drawn about its own origin so a motion path can carry it.
   * The inner rotation cancels the tilt applied by the parent group, which
   * keeps the crosshair square to the page while the ellipse stays inclined.
   */
  const marker = (
    <g transform={`rotate(${deg})`}>
      <g stroke="var(--accent)" strokeWidth="1" vectorEffect="non-scaling-stroke">
        <line x1={-9} y1={0} x2={-4} y2={0} vectorEffect="non-scaling-stroke" />
        <line x1={4} y1={0} x2={9} y2={0} vectorEffect="non-scaling-stroke" />
        <line x1={0} y1={-9} x2={0} y2={-4} vectorEffect="non-scaling-stroke" />
        <line x1={0} y1={4} x2={0} y2={9} vectorEffect="non-scaling-stroke" />
      </g>
      <circle cx={0} cy={0} r="2.6" fill="var(--accent)" />
    </g>
  );

  const markerStyle = {
    offsetPath: `path("${orbitPath}")`,
    '--orbit-period': `${periodMs}ms`,
    '--orbit-phase': `${px(phase * 100)}%`,
  } as CSSProperties;

  return (
    <div className={cn('inline-flex flex-col gap-2.5', className)}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 200 200"
        fill="none"
        role="img"
        aria-label={`Orbit schematic. Track ${track}${inclination ? `, inclination ${inclination}` : ''}.`}
        className="overflow-visible"
      >
        {/* bearing ring + ticks */}
        <g stroke="var(--rule)" strokeWidth="1" vectorEffect="non-scaling-stroke">
          <circle cx={c} cy={c} r={RING} opacity="0.7" />
          {ticks.map((k, i) => (
            <line
              key={i}
              x1={k.x1}
              y1={k.y1}
              x2={k.x2}
              y2={k.y2}
              stroke={k.long ? 'var(--ink-faint)' : 'var(--rule)'}
              vectorEffect="non-scaling-stroke"
            />
          ))}
        </g>

        {/* body + graticule */}
        <circle cx={c} cy={c} r={R} fill="color-mix(in srgb, var(--ink) 12%, transparent)" opacity="0.6" />
        <g stroke="var(--rule)" strokeWidth="1" vectorEffect="non-scaling-stroke">
          <circle cx={c} cy={c} r={R} stroke="var(--ink-faint)" opacity="0.8" />
          <ellipse cx={c} cy={c} rx={R} ry={R * 0.34} />
          <ellipse cx={c} cy={c} rx={R * 0.5} ry={R} />
          <line x1={c - R} y1={c - R * 0.62} x2={c + R} y2={c - R * 0.62} opacity="0.6" />
          <line x1={c - R} y1={c + R * 0.62} x2={c + R} y2={c + R * 0.62} opacity="0.6" />
        </g>

        {/* ground track across the disc — the curve is built inside the
            disc by construction (its control hull stays within r=R), so no
            clip path and therefore no duplicated SVG ids on a page. */}
        <g>
          <path
            d={`M ${c - R * 0.98},${c + 8} C ${c - 18},${c - 26} ${c + 18},${c + 26} ${c + R * 0.98},${c - 8}`}
            stroke="var(--accent)"
            strokeWidth="1"
            strokeDasharray="2 3"
            opacity="0.75"
            vectorEffect="non-scaling-stroke"
          />
        </g>

        {/* orbit track + pass marker */}
        <g transform={`rotate(${-deg} ${c} ${c})`}>
          {/* The track is a dashed hairline: a plotted path, not a ring. */}
          <path
            d={orbitPath}
            stroke="var(--ink-faint)"
            strokeWidth="1"
            strokeDasharray="3 4"
            opacity="0.7"
            vectorEffect="non-scaling-stroke"
          />
          {animated ? (
            <g className="orbit-marker" style={markerStyle}>
              {marker}
            </g>
          ) : (
            <g transform={`translate(${mx} ${my})`}>{marker}</g>
          )}
        </g>
      </svg>

      <div className="flex flex-col gap-1">
        <span className="font-mono text-[0.625rem] uppercase leading-[1.4] tracking-[0.16em] ink-dim">
          ORBIT: {track}
        </span>
        {inclination ? (
          <span
            data-telemetry
            className="font-mono text-[0.625rem] uppercase leading-[1.4] tracking-[0.16em] ink-faint"
          >
            INC: {inclination}
          </span>
        ) : null}
        {typeof altitudeKm === 'number' ? (
          <span
            data-telemetry
            className="font-mono text-[0.625rem] uppercase leading-[1.4] tracking-[0.16em] ink-faint"
          >
            ALT: {altitudeKm} KM
          </span>
        ) : null}
      </div>
    </div>
  );
}
