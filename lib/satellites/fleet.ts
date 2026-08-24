/**
 * THE FLEET — the Earth-observation satellites this site tracks.
 *
 * Eight real spacecraft, chosen because between them they cover the whole
 * range of what "a photograph of your house from space" can mean: three
 * sub-metre commercial imagers, a half-metre smallsat constellation member,
 * and the open-data workhorses whose frames this site actually prints.
 *
 * ------------------------------------------------------------------------
 * WHAT IS TRUE HERE, AND WHAT IS NOT CLAIMED
 * ------------------------------------------------------------------------
 * These are NOT "the satellites that take your picture". Tasking is brokered
 * through SkyFi, which selects a provider and a spacecraft at tasking time
 * against the window, the weather and the resolution ordered. The satellite
 * that flies a given mission is not named on the file, is not chosen by this
 * site, and is very often none of the eight below.
 *
 * What they are is the fleet overhead: real objects, with real published
 * orbital elements, which this page propagates and draws. Every copy that
 * accompanies this list has to keep that distinction, because "here are the
 * satellites, start a mission" implies a link that does not exist.
 *
 * ------------------------------------------------------------------------
 * THE NUMBERS
 * ------------------------------------------------------------------------
 * Everything numeric on a satellite card — sub-point, altitude, speed,
 * inclination, period, element age — is COMPUTED from the live CelesTrak
 * element set at render time. Nothing in this file is a number that also
 * appears as a live readout, so the two can never disagree.
 *
 * `gsd` is the exception and the one figure taken on trust: it is the
 * operator-published ground sample distance at nadir, and it is here because
 * it is the single fact that makes the fleet legible to somebody buying a
 * picture of a roof. It is not measured by anything in this codebase.
 *
 * HANDOVER: verify every `gsd` against the operator's current spec sheet
 * before launch. They are public figures and stable, but they are the only
 * unverified constants on the page, and a resolution claim next to a product
 * that sells resolution is worth ten minutes of somebody's time.
 */
export type FleetMember = {
  /** NORAD catalogue number. The join key against CelesTrak. */
  noradId: number;
  /** Display name. CelesTrak's OBJECT_NAME is used if this is absent. */
  name: string;
  /** Who flies it. */
  operator: string;
  /** One line: what it is for. Never marketing. */
  role: string;
  /** Operator-published ground sample distance at nadir. See note above. */
  gsd: string;
  /** Open data, or commercially tasked. */
  access: 'Open data' | 'Commercial tasking';
};

export const FLEET: FleetMember[] = [
  {
    noradId: 40115,
    name: 'WorldView-3',
    operator: 'Maxar',
    role: 'Sub-metre optical imager. The sharpest commercial optical sensor in orbit.',
    gsd: '31 cm panchromatic',
    access: 'Commercial tasking',
  },
  {
    noradId: 48268,
    name: 'Pléiades Neo 3',
    operator: 'Airbus',
    role: 'Very-high-resolution optical imager, tasked in short revisit windows.',
    gsd: '30 cm panchromatic',
    access: 'Commercial tasking',
  },
  {
    noradId: 44804,
    name: 'Cartosat-3',
    operator: 'ISRO',
    role: 'High-resolution cartographic imager.',
    gsd: '25 cm panchromatic',
    access: 'Commercial tasking',
  },
  {
    noradId: 33331,
    name: 'GeoEye-1',
    operator: 'Maxar',
    role: 'Long-serving sub-metre optical imager.',
    gsd: '41 cm panchromatic',
    access: 'Commercial tasking',
  },
  {
    noradId: 42987,
    name: 'SkySat-C11',
    operator: 'Planet',
    role: 'One of a smallsat constellation flown for rapid revisit.',
    gsd: '50 cm panchromatic',
    access: 'Commercial tasking',
  },
  {
    noradId: 49260,
    name: 'Landsat 9',
    operator: 'NASA / USGS',
    role: 'Open Earth-observation record. The example frames on this site are Landsat.',
    gsd: '15 m panchromatic',
    access: 'Open data',
  },
  {
    noradId: 60989,
    name: 'Sentinel-2C',
    operator: 'ESA Copernicus',
    role: 'Open multispectral survey on a five-day global revisit.',
    gsd: '10 m multispectral',
    access: 'Open data',
  },
  {
    noradId: 25994,
    name: 'Terra',
    operator: 'NASA',
    role: 'Flying since 1999. The long baseline every newer sensor is compared against.',
    gsd: '15 m (ASTER VNIR)',
    access: 'Open data',
  },
];

export const FLEET_IDS = FLEET.map((f) => f.noradId);

export function fleetMember(noradId: number): FleetMember | undefined {
  return FLEET.find((f) => f.noradId === noradId);
}
