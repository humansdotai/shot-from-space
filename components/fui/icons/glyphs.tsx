import { Icon, IconMotionStyles, type IconProps, type LiveIconProps } from './Icon';

/**
 * THE TYPE MARKS.
 *
 * Thirty-one glyphs, grouped by what they mark rather than by what
 * they look like. Every one is drawn on the same 16-grid at the same
 * hairline (see ./Icon.tsx for the drawing rules and for the motion
 * policy), and every one means exactly one kind of value.
 *
 * WHY THESE AND NOT MORE. The set is closed by the data, not by taste:
 * it is the list of value TYPES that actually appear on a mission file
 * and in a conditions report. There is no "info", no "chevron" and no
 * general-purpose ornament, because a mark that does not name a type
 * cannot help anyone find a fact.
 *
 * NEAR-NEIGHBOURS ARE DELIBERATE, AND THEY ARE DISTINCT.
 *   <IconCrosshair> is a coordinate — a point measured on the ground.
 *   <IconPin>       is a postal address — a place someone can stand.
 *   <IconClock>     is an instant on the clock.
 *   <IconCalendar>  is a date with no time in the record.
 *   <IconCapture>   is the frame being taken, which is an event and not
 *                   merely a timestamp.
 * Reading a pin as a coordinate or a calendar as a clock would be a
 * small lie about the data, so the drawings are kept far apart.
 *
 * THE ONE MARK THAT IS NOT A TYPE MARK is <IconLock />, and it is in a
 * section of its own at the foot of this file with the argument for it.
 */

/* ================================================================== */
/* GROUND — where on the earth                                        */
/* ================================================================== */

/** A measured point: reticle and centre fix. Coordinates only. */
export function IconCrosshair({ size, className }: IconProps) {
  return (
    <Icon size={size} className={className}>
      <circle cx="8" cy="8" r="4.4" />
      <path d="M8 1.2v2.2M8 12.6v2.2M1.2 8h2.2M12.6 8h2.2" />
      <circle cx="8" cy="8" r="0.9" fill="currentColor" stroke="none" />
    </Icon>
  );
}

/** A postal address — somewhere a parcel is delivered. */
export function IconPin({ size, className }: IconProps) {
  return (
    <Icon size={size} className={className}>
      <path d="M8 14.4c3-3.3 4.6-5.9 4.6-8a4.6 4.6 0 1 0-9.2 0c0 2.1 1.6 4.7 4.6 8Z" />
      <circle cx="8" cy="6.3" r="1.7" />
    </Icon>
  );
}

/** A capture footprint: the square of ground the frame covers. */
export function IconArea({ size, className }: IconProps) {
  return (
    <Icon size={size} className={className}>
      <path d="M2 5.4V2h3.4M10.6 2H14v3.4M14 10.6V14h-3.4M5.4 14H2v-3.4" />
      <path d="M6.4 8h3.2M8 6.4v3.2" />
    </Icon>
  );
}

/* ================================================================== */
/* TIME — when                                                        */
/* ================================================================== */

/** An instant the record holds to the minute. */
export function IconClock({ size, className }: IconProps) {
  return (
    <Icon size={size} className={className}>
      <circle cx="8" cy="8" r="6.2" />
      <path d="M8 4.4V8l2.6 1.6" />
    </Icon>
  );
}

/** A date with no time in the record — an estimate, a settlement day. */
export function IconCalendar({ size, className }: IconProps) {
  return (
    <Icon size={size} className={className}>
      <rect x="2" y="3.4" width="12" height="10.6" rx="1" />
      <path d="M2 6.8h12M5.4 1.8v2.6M10.6 1.8v2.6" />
    </Icon>
  );
}

/**
 * A CAPTURE WINDOW — a span with two stops and a pass inside it.
 *
 * ANIMATES when `live`: the pass marker pulses for as long as the window
 * is genuinely open. Once the frame exists the window is history and the
 * marker is still. See ./Icon.tsx.
 */
export function IconPassWindow({ size, className, live = false }: LiveIconProps) {
  return (
    <>
      {live ? <IconMotionStyles /> : null}
      <Icon size={size} className={className}>
        <path d="M2.6 3.6v8.8M13.4 3.6v8.8M2.6 8h10.8" />
        <circle
          cx="8"
          cy="8"
          r="1.9"
          fill="currentColor"
          stroke="none"
          className={live ? 'sfs-icon-pulse' : undefined}
        />
      </Icon>
    </>
  );
}

/* ================================================================== */
/* THE PASS — the spacecraft and the frame it takes                   */
/* ================================================================== */

/** The sensor: a body with two panels and a boom. */
export function IconSatellite({ size, className }: IconProps) {
  return (
    <Icon size={size} className={className}>
      <rect x="6.2" y="6.2" width="3.6" height="3.6" />
      <path d="M6.2 6.6H2.4v2.8h3.8M9.8 6.6h3.8v2.8H9.8" />
      <path d="M8 6.2V3.4" />
      <path d="M6.2 3.4a2.4 2.4 0 0 1 3.6 0" />
    </Icon>
  );
}

/**
 * THE GROUND TRACK — the inclined plane, the body, and a bearing tick.
 *
 * ANIMATES when `live`: the tick turns once every 24 seconds for as long
 * as the pass is still ahead of the mission. After IMAGE_ACQUIRED the
 * pass has happened, the track is a record rather than a forecast, and
 * the tick parks. Linear, because an orbit has constant angular
 * character — the one place the house ease does not apply, exactly as
 * <OrbitDiagram /> argues it.
 */
export function IconOrbit({ size, className, live = false }: LiveIconProps) {
  return (
    <>
      {live ? <IconMotionStyles /> : null}
      <Icon size={size} className={className}>
        <ellipse cx="8" cy="8" rx="6.4" ry="2.9" transform="rotate(-24 8 8)" />
        <circle cx="8" cy="8" r="1.5" fill="currentColor" stroke="none" />
        <path
          d="M8 0.9v2.1"
          className={live ? 'sfs-icon-bearing' : undefined}
        />
      </Icon>
    </>
  );
}

/** Ground sample distance: one pixel against the grid it sits in. */
export function IconResolution({ size, className }: IconProps) {
  return (
    <Icon size={size} className={className}>
      <rect x="2.4" y="2.4" width="11.2" height="11.2" />
      <path d="M8 2.4v11.2M2.4 8h11.2" />
      <rect x="4.2" y="4.2" width="2.2" height="2.2" fill="currentColor" stroke="none" />
    </Icon>
  );
}

/** The downlink: a dish on a mast, and the signal it is taking. */
export function IconAntenna({ size, className }: IconProps) {
  return (
    <Icon size={size} className={className}>
      <path d="M2.2 14h5.6M5 14V9.2" />
      <path d="M1.8 9.2a3.2 3.2 0 0 1 6.4 0Z" />
      <path d="M10.2 7.4a4.2 4.2 0 0 0-1.4-3.1M13 8a7.6 7.6 0 0 0-2.5-5.6" />
    </Icon>
  );
}

/** The frame being taken — an event, not a timestamp. */
export function IconCapture({ size, className }: IconProps) {
  return (
    <Icon size={size} className={className}>
      <path d="M5.6 4 6.6 2h2.8l1 2" />
      <rect x="1.8" y="4" width="12.4" height="9.6" rx="1" />
      <circle cx="8" cy="8.8" r="2.6" />
    </Icon>
  );
}

/**
 * AN ANGLE ABOVE THE HORIZON — a baseline, a ray off it, and the arc
 * that measures the angle between them.
 *
 * Distinct from <IconOrbit /> on purpose: the orbit is the whole path,
 * this is the ONE number that decides whether a pass is worth imaging.
 * "Highest point 72°" and "Inclination 97.4°" are both degrees and are
 * not the same kind of fact.
 */
export function IconElevation({ size, className }: IconProps) {
  return (
    <Icon size={size} className={className}>
      <path d="M1.6 12.4h12.8" />
      <path d="M2.6 12.4 12.4 4.2" />
      <path d="M8.4 12.4a5.9 5.9 0 0 0-1.6-4" />
    </Icon>
  );
}

/** A measured distance: two stops and the span between them. */
export function IconRange({ size, className }: IconProps) {
  return (
    <Icon size={size} className={className}>
      <path d="M2.6 4.4v7.2M13.4 4.4v7.2" />
      <path d="M2.6 8h3.1M10.3 8h3.1" />
      <circle cx="8" cy="8" r="1.4" fill="currentColor" stroke="none" />
    </Icon>
  );
}

/** Height above the ground: the limb of the earth and a mark over it. */
export function IconAltitude({ size, className }: IconProps) {
  return (
    <Icon size={size} className={className}>
      <path d="M1.4 13.4a9.4 9.4 0 0 1 13.2 0" />
      <path d="M8 3.2v6.4" />
      <path d="M6.2 5 8 3.2 9.8 5" />
      <circle cx="8" cy="2.4" r="0.9" fill="currentColor" stroke="none" />
    </Icon>
  );
}

/* ================================================================== */
/* SKY — the conditions over the target                               */
/* ================================================================== */

/** Cloud cover. */
export function IconCloud({ size, className }: IconProps) {
  return (
    <Icon size={size} className={className}>
      <path d="M4.7 12.6h6.6a3 3 0 0 0 .4-5.9 4.3 4.3 0 0 0-8.1-1.1A3 3 0 0 0 4.7 12.6Z" />
    </Icon>
  );
}

/** Solar geometry — elevation, azimuth, the local solar clock. */
export function IconSun({ size, className }: IconProps) {
  return (
    <Icon size={size} className={className}>
      <circle cx="8" cy="8" r="3" />
      <path d="M8 1.4v1.6M8 13v1.6M1.4 8h1.6M13 8h1.6M3.3 3.3l1.2 1.2M11.5 11.5l1.2 1.2M12.7 3.3l-1.2 1.2M4.5 11.5l-1.2 1.2" />
    </Icon>
  );
}

/** How far you can see through the air. */
export function IconEye({ size, className }: IconProps) {
  return (
    <Icon size={size} className={className}>
      <path d="M1.4 8s2.6-4.2 6.6-4.2S14.6 8 14.6 8s-2.6 4.2-6.6 4.2S1.4 8 1.4 8Z" />
      <circle cx="8" cy="8" r="1.8" />
    </Icon>
  );
}

/** Air in motion at the surface. */
export function IconWind({ size, className }: IconProps) {
  return (
    <Icon size={size} className={className}>
      <path d="M1.8 5.6h6.6a2 2 0 1 0-2-2" />
      <path d="M1.8 9.1h8.4a2 2 0 1 1-2 2" />
      <path d="M1.8 12.6h4.4" />
    </Icon>
  );
}

/** A bearing — the direction a wind is coming from. */
export function IconCompass({ size, className }: IconProps) {
  return (
    <Icon size={size} className={className}>
      <circle cx="8" cy="8" r="6.2" />
      <path d="M10.8 5.2 9 9 5.2 10.8 7 7Z" />
    </Icon>
  );
}

/** Air temperature. */
export function IconThermometer({ size, className }: IconProps) {
  return (
    <Icon size={size} className={className}>
      <path d="M6.4 9.3V3.6a1.6 1.6 0 0 1 3.2 0v5.7a3 3 0 1 1-3.2 0Z" />
      <path d="M8 6.4v4.2" />
    </Icon>
  );
}

/** Water in the air — relative humidity. */
export function IconDroplet({ size, className }: IconProps) {
  return (
    <Icon size={size} className={className}>
      <path d="M8 2.2c2.6 3 4 5.2 4 6.9a4 4 0 0 1-8 0c0-1.7 1.4-3.9 4-6.9Z" />
    </Icon>
  );
}

/** A dial reading — barometric pressure. */
export function IconGauge({ size, className }: IconProps) {
  return (
    <Icon size={size} className={className}>
      <path d="M2 11.8a6 6 0 1 1 12 0" />
      <path d="M8 11.8 11 7.6" />
      <circle cx="8" cy="11.8" r="0.9" fill="currentColor" stroke="none" />
    </Icon>
  );
}

/* ================================================================== */
/* THE OBJECT — what is printed, where, and how it travels            */
/* ================================================================== */

/** A print format: the sheet, with its measurement stated under it. */
export function IconSheet({ size, className }: IconProps) {
  return (
    <Icon size={size} className={className}>
      <rect x="4" y="1.4" width="8" height="10.8" />
      <path d="M4 14.4h8M4 13.6v1.6M12 13.6v1.6" />
    </Icon>
  );
}

/**
 * A COMPOSITION — how the sheet is divided between the picture and the
 * record. <IconSheet /> is the sheet's SIZE; this is what is on it.
 */
export function IconComposition({ size, className }: IconProps) {
  return (
    <Icon size={size} className={className}>
      <rect x="2.6" y="1.8" width="10.8" height="12.4" />
      <path d="M2.6 10.4h10.8" />
      <path d="M4.6 12.1h4.4M4.6 13.4h2.6" />
    </Icon>
  );
}

/** A mount: the print inside its frame. */
export function IconFrame({ size, className }: IconProps) {
  return (
    <Icon size={size} className={className}>
      <rect x="1.8" y="2.4" width="12.4" height="11.2" />
      <rect x="4.4" y="4.9" width="7.2" height="6.2" />
    </Icon>
  );
}

/** The production facility the sheet is printed at. */
export function IconFacility({ size, className }: IconProps) {
  return (
    <Icon size={size} className={className}>
      <path d="M1.8 13.8V8.2l4-2.4v2.4l4-2.4v2.4l4.4-2.4v8Z" />
      <path d="M1.4 13.8h13.2" />
    </Icon>
  );
}

/** A parcel in the carrier's hands. */
export function IconParcel({ size, className }: IconProps) {
  return (
    <Icon size={size} className={className}>
      <path d="M8 1.8 14 5v6l-6 3.2L2 11V5Z" />
      <path d="M2 5l6 3.2L14 5M8 8.2v6" />
    </Icon>
  );
}

/**
 * THE GRADE — the frame with its tonal range laid across it, one half
 * carried to solid. Marks the work done to a downlinked frame before it is
 * a print: colour grade, composition, telemetry overlay.
 *
 * Distinct from <IconFrame> (a mount: a rectangle inside a rectangle) and
 * from <IconResolution> (a grid with one pixel in it) — this one is the
 * only mark in the set that carries a filled area, which is the point.
 */
export function IconGrade({ size, className }: IconProps) {
  return (
    <Icon size={size} className={className}>
      <path d="M13.4 2.6v10.8H2.6Z" fill="currentColor" stroke="none" />
      <rect x="2.6" y="2.6" width="10.8" height="10.8" />
      <path d="M13.4 2.6 2.6 13.4" />
    </Icon>
  );
}

/**
 * THE HAND-OFF — the delivery sheet, signed off. Marks arrival, and closes
 * the file: the same docket <IconDocket /> opens the sequence with, now
 * carrying the mark that says the parcel was received.
 *
 * The two are deliberately a PAIR, because the two stages are a pair — the
 * file opening and the file closing — and reading the sequence's first and
 * last marks side by side should say exactly that. <IconParcel /> stays the
 * package in transit; this is the record of it arriving.
 */
export function IconHandoff({ size, className }: IconProps) {
  return (
    <Icon size={size} className={className}>
      <path d="M3.4 1.8h6.3l2.9 2.9v9.5H3.4Z" />
      <path d="M9.7 1.8v2.9h2.9" />
      <path d="m5.5 9.2 1.7 1.9 3.4-4" />
    </Icon>
  );
}

/* ================================================================== */
/* THE RECORD — the file's own references                             */
/* ================================================================== */

/**
 * THE FILED ORDER — a docket sheet with the cut corner a mission file
 * carries, and two ruled entries on it. Marks the moment the order became
 * a record: the target written down and queued.
 *
 * Deliberately NOT <IconSheet>, which is a print FORMAT — a sheet with its
 * measurement stated under it. This one is paperwork.
 */
export function IconDocket({ size, className }: IconProps) {
  return (
    <Icon size={size} className={className}>
      <path d="M3.4 1.8h6.3l2.9 2.9v9.5H3.4Z" />
      <path d="M9.7 1.8v2.9h2.9" />
      <path d="M5.8 8.6h4.4M5.8 11.1h3" />
    </Icon>
  );
}

/** A URL the file can be reached at. */
export function IconLink({ size, className }: IconProps) {
  return (
    <Icon size={size} className={className}>
      <path d="M6.6 9.4a2.8 2.8 0 0 0 4.1.3l2-2a2.8 2.8 0 0 0-4-4l-1.1 1.1" />
      <path d="M9.4 6.6a2.8 2.8 0 0 0-4.1-.3l-2 2a2.8 2.8 0 0 0 4 4l1.1-1.1" />
    </Icon>
  );
}

/** The address the file is filed to. */
export function IconMail({ size, className }: IconProps) {
  return (
    <Icon size={size} className={className}>
      <rect x="1.8" y="3.6" width="12.4" height="8.8" rx="1" />
      <path d="M1.8 4.6 8 9.2l6.2-4.6" />
    </Icon>
  );
}

/** A receipt — a printed slip with a torn foot. */
export function IconReceipt({ size, className }: IconProps) {
  return (
    <Icon size={size} className={className}>
      <path d="M3.4 1.8h9.2v12.6l-1.5-1.1-1.5 1.1-1.6-1.1-1.5 1.1-1.5-1.1-1.6 1.1Z" />
      <path d="M5.8 5.4h4.4M5.8 8.2h4.4" />
    </Icon>
  );
}

/* ================================================================== */
/* STATE — the one mark in the set that names a state, not a type      */
/* ================================================================== */

/**
 * NOT REACHABLE YET.
 *
 * The set's rule is that a mark names the KIND of a value, and this one
 * breaks it deliberately and exactly once. The section rail says a phase
 * is locked with a fainter track and a visually hidden word — which for
 * a sighted reader is state carried by HUE ALONE, the one thing the
 * rail's own header says it will never do. A padlock on a locked phase
 * is that state given a shape.
 *
 * It is used on the rail and nowhere else. A second state mark would be
 * a set of state marks, and then every row would want one.
 */
export function IconLock({ size, className }: IconProps) {
  return (
    <Icon size={size} className={className}>
      <rect x="3.4" y="7" width="9.2" height="7" rx="0.6" />
      <path d="M5.6 7V4.9a2.4 2.4 0 0 1 4.8 0V7" />
    </Icon>
  );
}
