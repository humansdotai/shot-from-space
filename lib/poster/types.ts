import type { FormatId, OrbitData } from '@/lib/types';

/** Aspect ratios the composer can lay out. Mirrors `FORMATS[].ratio`. */
export type PosterRatio = '3:4' | '5:7' | '7:10' | '1:1';

/**
 * The compositions the catalogue holds — how the paper is divided between the
 * picture and the record.
 *
 * DECLARED HERE, of all places, because three files need it and two of them
 * must not import the third: `lib/poster/layout.ts` takes it as the division
 * to lay out, `lib/poster/styles.ts` re-exports it as `PosterStyleId` and
 * hangs the whole catalogue off it, and `PosterOptions` below carries it into
 * the composer. `types.ts` is the one module in this directory that imports
 * nothing from its own siblings, so putting the union here is what keeps
 * layout → styles from becoming styles → layout as well.
 *
 * The names and the argument for each division live in `lib/poster/styles.ts`.
 */
export type PosterStyleId = 'full-frame' | 'dossier' | 'record' | 'plate';

export interface PosterOptions {
  /** A `CATALOGUE` slug. Ignored when `imageBuffer` is supplied. */
  slug?: string;
  /** A raw frame (a downlinked capture) to compose instead of a catalogue slug. */
  imageBuffer?: Buffer;
  /** `32BF`. Rendered as `MISSION / 32BF`. */
  missionCode: string;
  /** ISO 8601 capture timestamp. Rendered as `21:34PM 02.10.2026`. */
  capturedAt: string;
  lat: number;
  lon: number;
  /** City level only. `LOS ANGELES / CALIFORNIA / UNITED STATES`. */
  locationLabel: string;
  orbit: OrbitData;
  /** Drives the aspect ratio and the print-intent footer. */
  formatId?: FormatId;
  /** Diagonal `PREVIEW / NOT FOR PRINT` wash plus a `LOW RESOLUTION` tag. */
  watermark?: boolean;
  /** Output width in px. Height follows from `ratio`. */
  width?: number;
  /** Overrides the ratio implied by `formatId`. */
  ratio?: PosterRatio;
  /**
   * How the paper is divided — see `lib/poster/styles.ts`. Omitted, the
   * composer lays out `dossier`, which is what it has always laid out, so an
   * existing caller's file does not move by a pixel.
   *
   * Part of the pixels, therefore part of the cache key.
   */
  styleId?: PosterStyleId;
  /**
   * Provenance line under the frame. Defaults to the public-domain archive
   * credit; a real capture passes its tasking provider here.
   */
  sourceLabel?: string;
  /**
   * Render at the print-intent pixel geometry for `formatId` (300 DPI),
   * clamped by `MAX_RENDER_WIDTH`. See PIPELINE.md for what this is and is not.
   */
  print?: boolean;
  /**
   * `[role, holder]` rows for the MISSION PERSONNEL block. Omitted, the sheet
   * prints the two standing roles against the organisations that hold them.
   * Never populated with invented names — see lib/poster/sheet.ts.
   */
  personnel?: Array<[string, string]>;
  /**
   * The customer's own words for what this place is, printed at the foot of
   * the sheet. Free text authored by a person, so it MUST arrive already put
   * through `sanitizeDedication` (lib/missions/dedication.ts) — the plate is
   * XML, and a raw control character in it fails the whole document rather
   * than one line. The composer re-sanitises defensively; see `resolveData`.
   * Omitted or empty, the sheet simply does not print the line.
   */
  dedication?: string | null;
  /**
   * Decimal places for the coordinates printed on the sheet.
   *
   * FOUR is the product. The plate is a record of a place and 4 dp is ~11 m,
   * which is the fix the customer bought; the print file that goes to the
   * press is composed at 4 dp and always will be.
   *
   * TWO is what any surface that is not the owner's may show — ~1.1 km, the
   * same order as the capture footprint, so the sheet still says truthfully
   * where the frame was taken without handing over a doorstep. It is the same
   * rule `toMissionDTO` applies to the JSON (`PUBLIC_COORD_DP`), and the
   * reason it has to be stated HERE too is that a plate leaks as pixels: no
   * amount of redaction in the DTO helps if the image says it anyway.
   *
   * Defaults to 4. The caller that knows who is asking — `/api/poster/[code]`
   * — is the caller that decides.
   */
  coordDp?: 2 | 4;
}

/** Everything the plate renderer needs, with no optional fields left. */
export interface ResolvedPoster {
  missionCode: string;
  capturedAt: string;
  lat: number;
  lon: number;
  locationLabel: string;
  orbit: OrbitData;
  formatId: FormatId | null;
  sourceLabel: string;
  watermark: boolean;
  /**
   * No frame and no telemetry to show. The plate renders dashes instead of
   * zeroes so a failed render never reads as real data that happens to be 0.
   */
  degraded: boolean;
  personnel?: Array<[string, string]>;
  /** Sanitised, or null when there is no dedication to print. */
  dedication: string | null;
  /** Decimal places for the printed fix. See `PosterOptions.coordDp`. */
  coordDp: 2 | 4;
}
