import { cn } from '@/lib/utils';

/**
 * ORBIT GLYPH — an icon that is also a readout.
 *
 * Small, one per satellite card. It is NOT <OrbitDiagram />, which is the
 * large single-instance figure the density rule caps at one per viewport;
 * this is icon scale and carries a different job.
 *
 * Two things in it are real, and that is the whole reason it exists rather
 * than a generic satellite pictogram:
 *
 *   1. THE RING'S TILT IS THE ORBIT'S INCLINATION. The ellipse is rotated by
 *      the satellite's actual inclination, so an equatorial orbit lies flat
 *      and a polar one stands upright. Every satellite this site tracks is
 *      sun-synchronous at 97-99 degrees, so their rings all stand nearly
 *      vertical and lean the same way — which is not a bug, it is the single
 *      most characteristic fact about an imaging orbit, and eight identical
 *      leans is what an Earth-observation fleet actually looks like.
 *
 *   2. THE DOT'S POSITION IS THE ORBITAL PHASE. Not an animation loop — the
 *      caller passes the phase computed from the mean anomaly advanced to
 *      the current instant, so the marker is where the satellite is in its
 *      revolution. It moves because the satellite moves.
 *
 * This is why the motion here does not break the house rule against
 * decorative movement: nothing in this glyph moves on a timer of its own. It
 * is a plot of a value that is changing, which is the same category as a
 * clock, and the opposite of a marquee.
 *
 * Drawn in `currentColor` throughout, so it takes the ink of whatever ground
 * it lands on and never introduces a colour.
 */
/** Fixed precision, so the server and client emit byte-identical markup. */
function round(n: number): string {
  return n.toFixed(3);
}

export function OrbitGlyph({
  /** Orbital inclination in degrees. Rotates the ring. */
  inclination,
  /** 0..1 around the orbit, from the mean anomaly at the current instant. */
  phase,
  size = 54,
  className,
}: {
  inclination: number;
  phase: number;
  size?: number;
  className?: string;
}) {
  const CX = 32;
  const CY = 32;
  const RX = 27;
  const RY = 8.5;

  // The marker in the ring's own frame, then rotated into the glyph's frame
  // by the inclination. Doing it here rather than with a nested <g rotate>
  // keeps the dot a plain <circle> at an absolute position, which is what
  // lets the trailing arc be drawn from the same two numbers.
  const theta = phase * Math.PI * 2;
  const tilt = inclination * (Math.PI / 180);
  const ex = RX * Math.cos(theta);
  const ey = RY * Math.sin(theta);

  /*
     ROUNDED, AND THAT IS A HYDRATION FIX, NOT A TIDY-UP.

     These coordinates are derived from a clock. The server computes them at
     request time and the client recomputes them a moment later, and React
     serialises a raw JS number with full precision — so the two runs printed
     cy="29.078159854119935" and cy="29.07815985411994", differing in the last
     digit, and React reported a hydration mismatch on the first paint of
     every page carrying the tracker.

     Three decimals on a 64-unit viewBox is a sixteen-thousandth of the
     glyph's width: far past what any display can resolve, and now a stable
     string on both sides of the boundary. The same rule already governs
     <FramedPoster />'s transform values for exactly this reason.
  */
  const x = round(CX + ex * Math.cos(tilt) - ey * Math.sin(tilt));
  const y = round(CY + ex * Math.sin(tilt) + ey * Math.cos(tilt));

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      aria-hidden
      className={cn('shrink-0', className)}
    >
      <g stroke="currentColor" strokeWidth="1" vectorEffect="non-scaling-stroke">
        {/* The body. A circle and two graticules — enough to read as a globe
            at 44px, and nothing more, because at this size a coastline is
            just noise. */}
        <circle cx={CX} cy={CY} r="12.5" opacity="0.7" />
        <ellipse cx={CX} cy={CY} rx="12.5" ry="4.6" opacity="0.42" />
        <line x1={CX} y1={CY - 12.5} x2={CX} y2={CY + 12.5} opacity="0.42" />

        {/* The orbit, inclined. */}
        <ellipse
          cx={CX}
          cy={CY}
          rx={RX}
          ry={RY}
          opacity="0.85"
          transform={`rotate(${inclination.toFixed(2)} ${CX} ${CY})`}
        />
      </g>

      {/* The satellite. Filled, so it reads against the ring it sits on. */}
      <circle cx={x} cy={y} r="3" fill="currentColor" />
      <circle
        cx={x}
        cy={y}
        r="5.6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1"
        opacity="0.42"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
