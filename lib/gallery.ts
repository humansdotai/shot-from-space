import { MISSION_CODE_PATTERN } from './codes';
import { CATALOGUE, acquisitionLabel, acquisitionSortKey, type Acquisition, type CatalogueFrame } from './imagery';
import { PRINT_FACILITY, regionForCountry } from './pricing';
import { seededUnit } from './utils';
import type { FormatId, FrameOption, OrbitData } from './types';

/**
 * THE MISSION ARCHIVE.
 *
 * Thirteen reference frames from the public Landsat archive, filed exactly the
 * way a customer mission is filed. Everything here is derived deterministically
 * from `CATALOGUE` — the same slug always produces the same mission code, so
 * `/missions/{code}` links are stable across builds, deployments and machines.
 *
 * This module is pure data. It touches no database and no network, so it is
 * safe to import from `generateStaticParams`, from metadata generation and from
 * client components alike.
 */

/* ------------------------------------------------------------------ */
/* Shape                                                               */
/* ------------------------------------------------------------------ */

export interface ExampleMission {
  /** 2 digits + 2 letters. Derived from `slug`, stable forever. */
  code: string;
  /** Catalogue slug this mission was built from. */
  slug: string;
  src: string;
  width: number;
  height: number;
  /** `PARIS / ÎLE-DE-FRANCE / FRANCE` — the archive index line. */
  locationLabel: string;
  city: string;
  admin: string;
  country: string;
  countryCode: string;
  lat: number;
  lon: number;
  /**
   * When the frame was really acquired, at the precision its source record
   * supports. These are archive scenes from 1986 onwards, not captures made
   * to order — see the note at the top of lib/imagery.ts.
   */
  acquired: Acquisition;
  /** Display form of `acquired`. Never more precise than the record. */
  acquiredLabel: string;
  orbit: OrbitData;
  /** File tags for the card: aspect, instrument, GSD, cloud state. */
  tags: string[];
  /** NASA / USGS credit line. Rendering this is a licensing requirement. */
  credit: string;
  /** Canonical source URL for the frame. */
  source: string;
  classification: string;
  /** The print format this reference sheet is composed at. */
  formatId: FormatId;
  frame: FrameOption;
  /** Facility that would run this job, from the target country. */
  printFacility: string;
  /** One or two sentences about this specific place and this specific frame. */
  summary: string;
}

/** Archive regions. The only filter axis on `/missions`. */
export const ARCHIVE_REGIONS = ['AMERICAS', 'EUROPE', 'AFRICA', 'ASIA'] as const;
export type ArchiveRegion = (typeof ARCHIVE_REGIONS)[number];

/* ------------------------------------------------------------------ */
/* Deterministic mission codes                                         */
/* ------------------------------------------------------------------ */

// Same alphabet as lib/codes: I and O are excluded, they read as 1 and 0.
const LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';

/**
 * Codes seeded into the database by Agent 8 for the four demo missions.
 * The archive must never mint one of these — `/m/32BF` and `/missions/32BF`
 * are different files and must stay distinguishable.
 */
const RESERVED_CODES: ReadonlySet<string> = new Set(['32BF', '74KL', '18QD', '55RA']);

/** 32-bit FNV-1a. Same construction as `seededUnit`, kept local so the code
 *  derivation cannot drift if that helper is ever retuned. */
function hash32(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** One candidate code for `slug` at collision-resolution round `attempt`. */
function candidateCode(slug: string, attempt: number): string {
  const h = hash32(attempt === 0 ? slug : `${slug}#${attempt}`);
  const digits = String(h % 100).padStart(2, '0');
  const a = LETTERS[Math.floor(h / 100) % LETTERS.length];
  const b = LETTERS[Math.floor(h / (100 * LETTERS.length)) % LETTERS.length];
  return `${digits}${a}${b}`;
}

/**
 * Stable code for a catalogue slug. Rehashes deterministically until the code
 * is free, so the result depends only on the catalogue order — never on
 * insertion timing or randomness.
 */
function missionCodeForSlug(slug: string, taken: Set<string>): string {
  for (let attempt = 0; attempt < 64; attempt++) {
    const code = candidateCode(slug, attempt);
    if (RESERVED_CODES.has(code) || taken.has(code)) continue;
    if (!MISSION_CODE_PATTERN.test(code)) continue;
    taken.add(code);
    return code;
  }
  // Unreachable for a 13-entry catalogue against a 2,400-code space, but a
  // silent duplicate would break routing, so fail loudly at module load.
  throw new Error(`Could not derive a unique mission code for "${slug}"`);
}

/* ------------------------------------------------------------------ */
/* Derived file metadata                                               */
/* ------------------------------------------------------------------ */

const RATIOS: Array<[string, number]> = [
  ['21:9', 21 / 9],
  ['16:9', 16 / 9],
  ['3:2', 3 / 2],
  ['4:3', 4 / 3],
  ['5:4', 5 / 4],
  ['1:1', 1],
  ['4:5', 4 / 5],
  ['3:4', 3 / 4],
  ['5:7', 5 / 7],
  ['2:3', 2 / 3],
];

/** Nearest house aspect tag for the real pixel dimensions of a frame. */
function aspectTag(width: number, height: number): string {
  const r = width / height;
  let best = RATIOS[0];
  for (const entry of RATIOS) {
    if (Math.abs(entry[1] - r) < Math.abs(best[1] - r)) best = entry;
  }
  return best[0];
}

/** `LANDSAT-8 / OLI` → `OLI`. The instrument, not the platform. */
function instrumentTag(sensor: string): string {
  const parts = sensor.split('/').map((p) => p.trim());
  return (parts[parts.length - 1] || sensor).toUpperCase();
}

/** Cloud state in file voice. Landsat calls anything under ~5% clear. */
function cloudTag(cloudPct: number): string {
  if (cloudPct <= 1) return 'CLEAR';
  if (cloudPct <= 10) return `${cloudPct}% CLOUD`;
  return `${cloudPct}% CLOUD / PARTIAL`;
}

/** Tags shown on the card. Every value comes from the frame's own telemetry. */
function tagsFor(frame: CatalogueFrame): string[] {
  return [
    aspectTag(frame.width, frame.height),
    instrumentTag(frame.orbit.sensor),
    `${frame.orbit.gsdM} M GSD`,
    cloudTag(frame.orbit.cloudPct),
  ];
}

const FORMAT_IDS: FormatId[] = ['F30', 'F50', 'F70'];

/** Which print format this reference sheet is composed at. Deterministic. */
function formatForSlug(slug: string): FormatId {
  return FORMAT_IDS[Math.floor(seededUnit(`format:${slug}`) * FORMAT_IDS.length) % FORMAT_IDS.length];
}

function frameForSlug(slug: string): FrameOption {
  return seededUnit(`frame:${slug}`) < 0.5 ? 'FRAMED' : 'UNFRAMED';
}

/** Continent bucket used by the archive filter. */
const REGION_BY_COUNTRY: Record<string, ArchiveRegion> = {
  US: 'AMERICAS',
  BR: 'AMERICAS',
  AR: 'AMERICAS',
  CA: 'AMERICAS',
  MX: 'AMERICAS',
  FR: 'EUROPE',
  DE: 'EUROPE',
  GB: 'EUROPE',
  NL: 'EUROPE',
  ES: 'EUROPE',
  IT: 'EUROPE',
  ZA: 'AFRICA',
  EG: 'AFRICA',
  MA: 'AFRICA',
  KE: 'AFRICA',
  RU: 'ASIA',
  UZ: 'ASIA',
  JP: 'ASIA',
  CN: 'ASIA',
  IN: 'ASIA',
};

export function archiveRegionFor(countryCode: string): ArchiveRegion {
  return REGION_BY_COUNTRY[countryCode.toUpperCase()] ?? 'AMERICAS';
}

/* ------------------------------------------------------------------ */
/* The written record                                                  */
/* ------------------------------------------------------------------ */

/**
 * One or two sentences per frame. This is the only long-form copy in the
 * archive and the reason the pages are worth reading: what is actually in
 * this picture, of this place, at this resolution. Sans-serif, never mono.
 */
const SUMMARIES: Record<string, string> = {
  'hero-los-angeles':
    'The Los Angeles basin from 705 kilometres up, the street grid running unbroken from the Santa Monica Mountains down to the Pacific. At 30 metres per pixel the freeway corridors and the concrete channel of the Los Angeles River stay legible across the whole width of the frame.',
  'paris-fr':
    'Paris in false colour, the band assignment that returns living vegetation as red: the Bois de Boulogne and the Bois de Vincennes read as two dark lobes on either side of the city. The Seine crosses from southeast to northwest and the Périphérique closes a hard ring around the dense grey core.',
  'berlin-de':
    'Berlin sits in a ring of lakes and pine forest, the Havel widening to the west and the Spree threading through the centre. Past the built edge the Brandenburg plain resolves into a mosaic of field blocks and managed woodland.',
  'las-vegas-us':
    'Las Vegas spread across the floor of the Mojave, the valley ending in a hard line where irrigated development meets bare desert. The Strip runs as a straight bright axis through the middle of the basin, and Lake Mead sits off the eastern edge of the built area.',
  'london-uk':
    'The Thames estuary opening into the North Sea, sediment plumes fanning off the Essex and Kent shores. Offshore, the regular point grids of the estuary wind farms are visible on the water — turbine arrays resolved as individual bright dots.',
  'sao-paulo-br':
    'São Paulo filling the frame outward from the Tietê valley, one of the largest continuous urban areas in the southern hemisphere. The grey mass breaks only where the forested ridges of the Serra do Mar rise between the city and the coast.',
  'rio-de-janeiro-br':
    'Rio de Janeiro built into the gaps between granite massifs, with Guanabara Bay opening north and the lagoons and beaches of the Zona Sul along the Atlantic edge. The dark forested block of Tijuca sits in the middle of the city rather than outside it.',
  'buenos-aires-ar':
    'Buenos Aires on the southern bank of the Río de la Plata, the estuary carrying enough suspended sediment to turn the water opaque brown across the top of the frame. Beyond the built edge the Pampas start immediately: flat, rectangular, agricultural.',
  'lisse-nl':
    'The bulb fields around Lisse in flower, laid out as narrow coloured strips on the reclaimed sand between Haarlem and Leiden. At 30 metres per pixel a single block of tulips or hyacinths registers as one saturated band of colour.',
  'seattle-us':
    'Seattle on the isthmus between Puget Sound and Lake Washington, the two water bodies squeezing the city into a north–south strip. Elliott Bay, the ship canal and the Duwamish industrial flats all fall inside one frame.',
  'cape-town-za':
    'The Cape Peninsula reaching south from Table Mountain, the city wrapped around its northern and eastern flanks. Cold Atlantic water on the west side and the warmer shallows of False Bay to the east meet at Cape Point at the foot of the frame.',
  'lena-delta-ru':
    'The Lena delta discharging into the Laptev Sea — a fan of channels and thaw lakes roughly 400 kilometres across, and one of the largest protected wetlands in the Arctic. The braided pattern is meltwater, frozen for most of the year and resolved here during the short northern summer.',
  'samarkand-uz':
    'Samarkand on the Zarafshan river, where irrigation draws a green corridor through dry loess country. The edge of the oasis is abrupt: cultivation stops exactly where the canal network stops.',
};

/**
 * Real alt text, specific to each frame: the opening sentence of that
 * mission's written record, which describes what is actually visible in the
 * picture, plus the resolution it was resolved at. Never "a satellite image".
 */
export function frameAlt(m: ExampleMission): string {
  const stop = m.summary.indexOf('. ');
  const first = stop === -1 ? m.summary : m.summary.slice(0, stop + 1);
  return `${first} Landsat frame, ${m.orbit.gsdM} metres per pixel.`;
}

/** `LOS ANGELES` → `Los Angeles`. The catalogue stores caps; prose needs case. */
/**
 * Place names carry particles that stay lowercase unless they lead: the
 * catalogue stores "RIO DE JANEIRO" and "ÎLE-DE-FRANCE", which a naive
 * word-by-word capitalisation renders as "Rio De Janeiro" and "Île-De-France".
 * Hyphenated segments are treated as words so the rule reaches inside them.
 */
const LOWER_PARTICLES = new Set([
  'de', 'del', 'della', 'der', 'des', 'di', 'do', 'dos', 'du',
  'la', 'las', 'le', 'les', 'los', 'van', 'von', 'y',
  'and', 'of', 'the', 'upon',
]);

export function titleCase(value: string): string {
  const cap = (w: string) => (w.length ? w[0].toUpperCase() + w.slice(1) : w);
  let index = 0;
  return value
    .toLowerCase()
    .split(' ')
    .map((word) =>
      word
        .split('-')
        .map((part) => {
          const isFirst = index === 0;
          index += 1;
          if (!isFirst && LOWER_PARTICLES.has(part)) return part;
          return cap(part);
        })
        .join('-'),
    )
    .join(' ');
}

/* ------------------------------------------------------------------ */
/* Build                                                               */
/* ------------------------------------------------------------------ */

function build(): ExampleMission[] {
  const taken = new Set<string>();

  const missions = CATALOGUE.map<ExampleMission>((frame) => {
    const region = regionForCountry(frame.countryCode);
    const summary = SUMMARIES[frame.slug];
    if (!summary) {
      // A frame added to the catalogue without a written record would ship an
      // empty dossier. Better to know at build time.
      throw new Error(`No archive summary written for catalogue frame "${frame.slug}"`);
    }
    return {
      code: missionCodeForSlug(frame.slug, taken),
      slug: frame.slug,
      src: frame.src,
      width: frame.width,
      height: frame.height,
      locationLabel: `${frame.city} / ${frame.admin} / ${frame.country}`,
      city: frame.city,
      admin: frame.admin,
      country: frame.country,
      countryCode: frame.countryCode,
      lat: frame.lat,
      lon: frame.lon,
      acquired: frame.acquired,
      acquiredLabel: acquisitionLabel(frame.acquired),
      orbit: frame.orbit,
      tags: tagsFor(frame),
      credit: frame.credit,
      source: frame.source,
      classification: 'DECLASSIFIED',
      formatId: formatForSlug(frame.slug),
      frame: frameForSlug(frame.slug),
      printFacility: PRINT_FACILITY[region],
      summary,
    };
  });

  // Canonical archive order: most recent acquisition first. Prev/next follows
  // it. An undated frame sorts last rather than being given a position.
  missions.sort((a, b) => acquisitionSortKey(b.acquired).localeCompare(acquisitionSortKey(a.acquired)));
  return missions;
}

const MISSIONS: ExampleMission[] = build();
const BY_CODE = new Map(MISSIONS.map((m) => [m.code, m]));

/** Every example mission, most recent capture first. */
export function listExampleMissions(): ExampleMission[] {
  return MISSIONS;
}

/** Lookup by mission code. Case-insensitive; tolerates a leading `M`. */
export function getExampleMission(code: string): ExampleMission | undefined {
  return BY_CODE.get(code.trim().toUpperCase().replace(/^M/, ''));
}

/** Lookup by catalogue slug, for surfaces that already hold a frame. */
export function getExampleMissionBySlug(slug: string): ExampleMission | undefined {
  return MISSIONS.find((m) => m.slug === slug);
}

/** The two neighbours of a mission in archive order. Wraps at both ends. */
export function archiveNeighbours(code: string): {
  prev: ExampleMission | null;
  next: ExampleMission | null;
} {
  const i = MISSIONS.findIndex((m) => m.code === code.toUpperCase());
  if (i === -1) return { prev: null, next: null };
  const n = MISSIONS.length;
  if (n < 2) return { prev: null, next: null };
  return {
    prev: MISSIONS[(i - 1 + n) % n],
    next: MISSIONS[(i + 1) % n],
  };
}

/** Index-header telemetry: what the archive currently holds. */
export function archiveIndexMeta() {
  // Undated frames are excluded from the span rather than dragged to one end.
  const dated = MISSIONS.filter((m) => m.acquired.date).sort((a, b) =>
    acquisitionSortKey(a.acquired).localeCompare(acquisitionSortKey(b.acquired)),
  );
  const countries = new Set(MISSIONS.map((m) => m.countryCode));
  return {
    count: MISSIONS.length,
    countries: countries.size,
    earliest: dated[0]?.acquiredLabel ?? null,
    latest: dated[dated.length - 1]?.acquiredLabel ?? null,
    gsdM: MISSIONS[0]?.orbit.gsdM ?? 30,
  };
}
