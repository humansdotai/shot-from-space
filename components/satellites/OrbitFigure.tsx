import type { CSSProperties } from 'react';
import { cn } from '@/lib/utils';

/**
 * ORBIT FIGURE — the large sibling of <OrbitGlyph />.
 *
 * <OrbitGlyph /> is an icon: 54px, one dot, no globe detail, and it stays
 * exactly as it is because <FleetTracker /> mounts eight of them on
 * `/missions` and `/m/[code]`. THIS is the object that sits in the middle of
 * a fleet card, where a hardware photograph would normally go, and it is
 * drawn instead of photographed for a reason worth stating: the spacecraft
 * renders belonging to other operators are theirs, and a picture of somebody
 * else's satellite on our card is a claim we cannot defend. A plot of the
 * real element set is ours, and it says more.
 *
 * ------------------------------------------------------------------------
 * WHAT IS REAL IN THIS DRAWING
 * ------------------------------------------------------------------------
 * Five things, and every one of them comes from the CelesTrak element set:
 *
 *   1. THE RING'S TILT is the orbit's INCLINATION, in degrees, applied as a
 *      rotation. Every satellite this site tracks is sun-synchronous at
 *      97-99 degrees, so their rings stand nearly upright and lean the same
 *      way. Eight near-identical leans is not a bug — it is what an
 *      Earth-observation fleet actually looks like from the side.
 *
 *   2. THE RING'S RADIUS IS TO SCALE against the globe. The semi-major axis
 *      is `R * (1 + altitude / 6378 km)`, so the 450 km orbit hugs the limb
 *      and the 780 km one clears it, in the same proportion they do in
 *      reality. This is why the ring sits so close to the Earth: that is
 *      what low Earth orbit is, and the usual diagram — a ring twice the
 *      planet's width — is the lie of convenience this one refuses.
 *
 *   3. THE MARKER IS THE PROPAGATED POSITION, from the mean anomaly advanced
 *      to the caller's instant. It moves because the satellite moves, at the
 *      satellite's own rate: about one per cent of a revolution a minute.
 *
 *   4. THE TRAIL is where it has been, sampled backwards at real intervals
 *      over the last half hour. It is what makes the direction of travel
 *      legible without animating anything.
 *
 *   5. THE GLOBE IS TURNED TO THE SUB-POINT. The graticule is an orthographic
 *      projection centred on the satellite's current sub-satellite longitude
 *      and viewed from the equator, so the meridians slide as the Earth turns
 *      under the orbit and the sub-point marker rides the central meridian at
 *      its true latitude.
 *
 * ------------------------------------------------------------------------
 * THE ONE THING THAT IS NOT A MEASUREMENT
 * ------------------------------------------------------------------------
 * The faint hollow tick that sweeps the ring on a fixed twenty-second loop.
 * It is a DIRECTION INDICATOR and nothing else — it is not where anything
 * is, and it is drawn deliberately unlike the position marker (hollow, thin,
 * a quarter opacity) so the two can never be confused. It exists because a
 * true-rate orbit moves about one pixel in ten seconds at this size, and a
 * figure that appears frozen invites the reader to assume it is a picture
 * rather than a readout. The popup says all of this in words.
 *
 * It rides `.orbit-marker` (app/globals.css), the house motion-path utility,
 * so `prefers-reduced-motion` stops it exactly the way it stops
 * <OrbitDiagram />; here it is hidden outright under that preference rather
 * than parked, because a parked hollow tick beside the real marker would
 * read as a second satellite.
 *
 * ------------------------------------------------------------------------
 * OCCLUSION
 * ------------------------------------------------------------------------
 * Half of an orbit is behind the planet, and the drawing says which half in
 * two ways at once. The ring is split at the line of nodes: the near arc is
 * SOLID, the far arc is DASHED, and the satellite marker is FILLED on the
 * near side and HOLLOW on the far. Trail dots are sorted the same way and
 * are the one thing genuinely occluded — they go under the opaque disc and
 * disappear behind it.
 *
 * Strict occlusion of the arc and the marker was the first version and it was
 * wrong for a card: half of every revolution vanished, so three cards in
 * eight showed nothing and read as broken rather than as accurate.
 * Dashed-and-hollow-means-behind is the convention every serious tracker
 * uses, it carries the same depth information, and it means the one mark the
 * card exists to show is always on screen.
 *
 * Every stroke is `vector-effect="non-scaling-stroke"`, so the hairlines stay
 * 1px whether this renders at 120px or 420px; every colour is `--rule` /
 * `--ink` / `--accent`, so it draws correctly on void and on paper.
 */

/** Kilometres. WGS-84 equatorial radius, for the to-scale ring. */
const EARTH_RADIUS_KM = 6378.137;

/**
 * How far the orbital plane is tipped away from edge-on, as a ratio of the
 * minor axis to the major. Purely a viewing angle — the one free parameter
 * in the drawing — chosen so the near arc crosses the disc rather than
 * grazing it, which is what makes the depth readable.
 */
const VIEW_FORESHORTENING = 0.26;

/** Trail: eleven samples, three minutes apart. Half an hour of travel. */
const TRAIL_SAMPLES = 11;
const TRAIL_STEP_MINUTES = 3;

/** Fixed precision, so the server and the client emit identical markup. */
function round(n: number): string {
  return (Math.round(n * 1000) / 1000).toFixed(3);
}

const DEG = Math.PI / 180;

/** Longitude difference wrapped to -180..180. */
function wrapDelta(deg: number): number {
  return ((((deg + 180) % 360) + 360) % 360) - 180;
}

export type OrbitFigureProps = {
  /** Orbital inclination, degrees. Rotates the ring. */
  inclination: number;
  /** 0..1 around the orbit, from the mean anomaly at the current instant. */
  phase: number;
  /** Orbital period, minutes. Sets how far back the trail reaches. */
  periodMinutes: number;
  /** Height above the ellipsoid, km. Scales the ring against the globe. */
  altitudeKm: number | null;
  /** Current sub-satellite latitude, degrees north. */
  subLatitude: number | null;
  /** Current sub-satellite longitude, degrees east. Turns the globe. */
  subLongitude: number | null;
  /** Rendered width in px. The figure is square. */
  size?: number;
  /** Draw the marker in the accent rather than the ink. Live/overhead only. */
  live?: boolean;
  className?: string;
};

export function OrbitFigure({
  inclination,
  phase,
  periodMinutes,
  altitudeKm,
  subLatitude,
  subLongitude,
  size = 320,
  live = true,
  className,
}: OrbitFigureProps) {
  const C = 66; // viewBox centre, both axes
  const R = 46; // globe radius

  /* --- The ring, to scale --------------------------------------------- */

  // A satellite whose elements will not propagate still gets a ring, drawn
  // at a nominal 700 km, because a card with a hole in it is worse than a
  // card whose one unavailable number is printed as unavailable in the
  // table underneath. Nothing in the copy reads a distance off this figure.
  const altitude = altitudeKm !== null && Number.isFinite(altitudeKm) ? altitudeKm : 700;
  const RX = R * (1 + Math.max(120, Math.min(2000, altitude)) / EARTH_RADIUS_KM);
  const RY = RX * VIEW_FORESHORTENING;

  /* --- Positions on the ring ------------------------------------------ */

  const tilt = inclination * DEG;

  /**
   * Ring-frame parameter -> viewBox coordinates.
   *
   * `theta` runs the same way the SVG arc below is swept, so the marker and
   * the motion path share one parameterisation and the sweeping tick can
   * never drift off the arc it is meant to be running along.
   */
  const at = (theta: number) => {
    const ex = RX * Math.cos(theta);
    const ey = RY * Math.sin(theta);
    return {
      x: C + ex * Math.cos(tilt) - ey * Math.sin(tilt),
      y: C + ex * Math.sin(tilt) + ey * Math.cos(tilt),
      /** Positive is the near side — the half drawn over the globe. */
      near: Math.sin(theta) > 0,
    };
  };

  const theta = phase * Math.PI * 2;
  const marker = at(theta);

  const period = periodMinutes > 0 ? periodMinutes : 95;
  const trail = Array.from({ length: TRAIL_SAMPLES }, (_, i) => {
    const minutesBack = (i + 1) * TRAIL_STEP_MINUTES;
    const point = at(theta - (minutesBack / period) * Math.PI * 2);
    return {
      ...point,
      // Oldest sample is barely there; the newest is nearly the marker.
      opacity: 0.5 * (1 - i / TRAIL_SAMPLES),
      radius: 1.9 - (1.3 * i) / TRAIL_SAMPLES,
    };
  });

  /* --- The two halves of the ring ------------------------------------- */

  // Both arcs are written in the ring's own frame and rotated together by a
  // single <g>, which is also the frame the motion path is resolved in.
  const near = `M ${round(C + RX)},${round(C)} A ${round(RX)},${round(RY)} 0 0 1 ${round(C - RX)},${round(C)}`;
  const far = `M ${round(C - RX)},${round(C)} A ${round(RX)},${round(RY)} 0 0 1 ${round(C + RX)},${round(C)}`;
  const full = `${near} A ${round(RX)},${round(RY)} 0 0 1 ${round(C + RX)},${round(C)}`;

  /* --- The globe, turned to the sub-point ------------------------------ */

  const lon0 = subLongitude !== null && Number.isFinite(subLongitude) ? subLongitude : 0;
  const lat = subLatitude !== null && Number.isFinite(subLatitude) ? subLatitude : 0;

  // Viewed from the equator, an orthographic parallel is a horizontal chord:
  //   x = R cos(lat) sin(dLon)   y = R sin(lat)
  const parallels = [-60, -30, 0, 30, 60].map((deg) => ({
    deg,
    y: C - R * Math.sin(deg * DEG),
    halfWidth: R * Math.cos(deg * DEG),
  }));

  // …and a meridian is a half-ellipse from pole to pole whose semi-minor
  // axis is R|sin(dLon)|. The centre meridian degenerates to a straight
  // line, which SVG draws correctly from a zero radius.
  const meridians: { key: number; d: string }[] = [];
  for (let lonM = -180; lonM < 180; lonM += 30) {
    const d = wrapDelta(lonM - lon0);
    if (Math.abs(d) >= 89.5) continue; // on the limb; nothing to draw
    const rx = R * Math.abs(Math.sin(d * DEG));
    const sweep = d >= 0 ? 1 : 0;
    meridians.push({
      key: lonM,
      d: `M ${round(C)},${round(C - R)} A ${round(rx)},${round(R)} 0 0 ${sweep} ${round(C)},${round(C + R)}`,
    });
  }

  // The sub-point sits on the central meridian by construction, at its true
  // latitude. It is the one mark on the globe and it is a real coordinate.
  const subY = C - R * Math.sin(lat * DEG);

  const sweepStyle = {
    offsetPath: `path("${full}")`,
    '--orbit-period': '20s',
  } as CSSProperties;

  const markerInk = live ? 'var(--accent)' : 'var(--ink)';

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 132 132"
      fill="none"
      aria-hidden
      className={cn('block shrink-0', className)}
    >
      {/* ---- Behind the planet ---------------------------------------- */}
      {/* Only the trail lives back here. The far ARC is drawn once, dashed,
          over the globe further down — drawing it twice made the part of it
          that clears the limb read solid, which is the one thing the
          dashed/solid pair is supposed to distinguish. */}
      {trail
        .filter((t) => !t.near)
        .map((t, i) => (
          <circle
            key={`far-${i}`}
            cx={round(t.x)}
            cy={round(t.y)}
            r={round(t.radius)}
            fill={markerInk}
            opacity={round(t.opacity * 0.55)}
          />
        ))}

      {/* ---- The planet ------------------------------------------------ */}
      {/* An opaque disc, because it is what does the occluding. */}
      <circle cx={C} cy={C} r={R} fill="var(--ground)" />

      <g stroke="var(--rule)" strokeWidth="1" vectorEffect="non-scaling-stroke">
        {parallels.map((p) => (
          <line
            key={p.deg}
            x1={round(C - p.halfWidth)}
            y1={round(p.y)}
            x2={round(C + p.halfWidth)}
            y2={round(p.y)}
            opacity={p.deg === 0 ? '0.9' : '0.5'}
            vectorEffect="non-scaling-stroke"
          />
        ))}
        {meridians.map((m) => (
          <path key={m.key} d={m.d} opacity="0.5" vectorEffect="non-scaling-stroke" />
        ))}
      </g>

      {/* The limb, over the graticule so the edge stays crisp. */}
      <circle
        cx={C}
        cy={C}
        r={R}
        stroke="var(--ink)"
        strokeWidth="1"
        opacity="0.55"
        vectorEffect="non-scaling-stroke"
      />

      {/* The sub-satellite point, on the meridian the globe is centred on. */}
      {subLatitude !== null && subLongitude !== null ? (
        /* An open cross, never a filled dot. The one filled mark in this
           drawing is the satellite; giving the ground point the same
           treatment made the two compete and the wrong one won. */
        <g stroke={markerInk} strokeWidth="1" opacity="0.75">
          <line
            x1={round(C - 4.5)}
            y1={round(subY)}
            x2={round(C + 4.5)}
            y2={round(subY)}
            vectorEffect="non-scaling-stroke"
          />
          <line
            x1={round(C)}
            y1={round(subY - 4.5)}
            x2={round(C)}
            y2={round(subY + 4.5)}
            vectorEffect="non-scaling-stroke"
          />
        </g>
      ) : null}

      {/* ---- In front of the planet ------------------------------------ */}
      <g transform={`rotate(${inclination.toFixed(2)} ${C} ${C})`}>
        {/*
          The hidden half, ghosted back in as a dashed line over the globe.

          Without it the far arc vanishes completely behind the disc, and the
          hollow marker that rides it appears to float unattached to
          anything. Dashed-means-behind is the same convention as
          hollow-means-behind and it costs one hairline at a sixth opacity:
          the ellipse closes, the reader can see the whole orbit, and the
          depth is still unambiguous.
        */}
        <path
          d={far}
          stroke="var(--ink)"
          strokeWidth="1"
          strokeDasharray="2 3"
          opacity="0.16"
          vectorEffect="non-scaling-stroke"
        />

        <path
          d={near}
          stroke="var(--ink)"
          strokeWidth="1"
          opacity="0.85"
          vectorEffect="non-scaling-stroke"
        />

        {/* The direction indicator. Not a position — see the header note. */}
        <g className="orbit-marker motion-reduce:hidden" style={sweepStyle}>
          <circle
            cx="0"
            cy="0"
            r="2.4"
            fill="none"
            stroke="var(--ink)"
            strokeWidth="1"
            opacity="0.24"
            vectorEffect="non-scaling-stroke"
          />
        </g>
      </g>

      {trail
        .filter((t) => t.near)
        .map((t, i) => (
          <circle
            key={`near-${i}`}
            cx={round(t.x)}
            cy={round(t.y)}
            r={round(t.radius)}
            fill={markerInk}
            opacity={round(t.opacity)}
          />
        ))}

      {marker.near ? (
        <g>
          <circle cx={round(marker.x)} cy={round(marker.y)} r="3" fill={markerInk} />
          <circle
            cx={round(marker.x)}
            cy={round(marker.y)}
            r="7"
            fill="none"
            stroke={markerInk}
            strokeWidth="1"
            opacity="0.7"
            vectorEffect="non-scaling-stroke"
          />
        </g>
      ) : null}

      {/*
        THE SATELLITE WHEN IT IS ROUND THE FAR SIDE — hollow, and drawn over
        the globe rather than under it.

        Strict occlusion was the first version and it was wrong for this
        card: half of every revolution is behind the planet, so three cards
        in eight showed no satellite at all and read as broken rather than as
        accurate. Hollow-means-behind is the convention every serious tracker
        uses, it keeps the depth information the solid/hollow pair carries,
        and it means the one mark the card exists to show is always on
        screen. The trail stays properly occluded underneath, which is what
        keeps the depth legible.
      */}
      {!marker.near ? (
        <g>
          <circle
            cx={round(marker.x)}
            cy={round(marker.y)}
            r="3"
            fill="none"
            stroke={markerInk}
            strokeWidth="1"
            opacity="0.85"
            vectorEffect="non-scaling-stroke"
          />
          <circle
            cx={round(marker.x)}
            cy={round(marker.y)}
            r="7"
            fill="none"
            stroke={markerInk}
            strokeWidth="1"
            opacity="0.35"
            vectorEffect="non-scaling-stroke"
          />
        </g>
      ) : null}
    </svg>
  );
}
