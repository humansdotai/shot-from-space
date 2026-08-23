/**
 * MISSION CONDITIONS — the meteorological block of the flight report.
 *
 * ==================================================================
 * WHAT IS REAL HERE AND WHAT IS NOT — read this before using it
 * ==================================================================
 *
 * A flight report carries the conditions the frame was taken under. This
 * module produces that block for a mission. It is made of three kinds of
 * number and they are not equally true:
 *
 *   1. READ OFF THE MISSION RECORD, unchanged.
 *      `cloudPct` comes from `mission.orbit.cloudPct` — the forecast before
 *      capture and the measured value after it. Sky state and okta count are
 *      that one number expressed the way an aviation observation expresses
 *      it. Nothing here ever contradicts the record.
 *
 *   2. COMPUTED — real astronomy, not demo data.
 *      Sun elevation, sun azimuth, solar declination and local apparent
 *      solar time come from the NOAA solar position algorithm applied to the
 *      capture timestamp and the target's latitude and longitude. Give it a
 *      different date, a different latitude or a different hour and it moves
 *      the way the sun moves. These numbers are as correct as the timestamp
 *      they are given (±0.5° over the 21st century), and they are the reason
 *      this block reads as instrumentation rather than as decoration.
 *
 *   3. DERIVED DEMO DATA — plausible, deterministic, NOT observed.
 *      Air temperature, dew point, humidity, ground wind, visibility and
 *      surface pressure. There is no observation behind them. Each is a
 *      published-climatology shape (latitude profile, seasonal cycle,
 *      diurnal cycle, prevailing-wind band) evaluated at the mission's own
 *      latitude, day of year and local solar time, then nudged by a
 *      deterministic per-mission offset seeded from the mission code so one
 *      target is not the textbook average of its latitude. Same code and
 *      coordinates in, same numbers out — across reloads, restarts, a
 *      reseed and a screenshot taken three days apart, and identically on
 *      the server and in the browser, so this can never cause a hydration
 *      mismatch.
 *
 * WHAT REPLACES CATEGORY 3
 * ------------------------------------------------------------------
 * A weather API queried for the capture instant at the capture coordinates —
 * a historical/reanalysis endpoint, not a forecast one, because the block is
 * stated for a moment in the past. Open-Meteo's ERA5 archive
 * (`archive-api.open-meteo.com/v1/archive`) and Meteomatics both answer the
 * exact query this block needs: `latitude`, `longitude`, `start`/`end` at the
 * capture hour, and the hourly fields `temperature_2m`, `dew_point_2m`,
 * `relative_humidity_2m`, `wind_speed_10m`, `wind_direction_10m`,
 * `visibility`, `pressure_msl`, `cloud_cover`. That is a one-for-one
 * replacement of `surfaceConditions()` below — every field in
 * `MissionConditions` already has a name in that response. The provider goes
 * behind `lib/integrations/` beside the other adapters and is mocked out
 * under `MOCK_MODE=true`, at which point this file becomes the mock.
 *
 * Categories 1 and 2 stay exactly as they are when that lands: the record is
 * the record, and the sun's position is not something a vendor knows better.
 */

import type { MissionDTO } from '@/lib/types';
import { seededUnit } from '@/lib/utils';

/* ------------------------------------------------------------------ */
/* Small maths                                                        */
/* ------------------------------------------------------------------ */

const RAD = Math.PI / 180;
const DEG = 180 / Math.PI;

/** Rounded to `dp` decimals. Every exported number goes through this. */
function round(value: number, dp = 1): number {
  const f = 10 ** dp;
  return Math.round(value * f) / f;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Day of the year, 1..366, from a UTC instant. */
function dayOfYear(at: Date): number {
  const start = Date.UTC(at.getUTCFullYear(), 0, 1);
  return Math.floor((at.getTime() - start) / 86_400_000) + 1;
}

/** Fractional UTC hour, 0..24. */
function utcHour(at: Date): number {
  return at.getUTCHours() + at.getUTCMinutes() / 60 + at.getUTCSeconds() / 3600;
}

/** 16-point compass abbreviation for a bearing in degrees. */
export function compassPoint(bearingDeg: number): string {
  const points = [
    'N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE',
    'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW',
  ];
  const i = Math.round((((bearingDeg % 360) + 360) % 360) / 22.5) % 16;
  return points[i];
}

/** `10:32` from minutes past local solar midnight. */
function clockFromMinutes(minutes: number): string {
  const m = ((minutes % 1440) + 1440) % 1440;
  const hh = Math.floor(m / 60);
  const mm = Math.round(m % 60);
  const pad = (n: number) => String(n).padStart(2, '0');
  return mm === 60 ? `${pad((hh + 1) % 24)}:00` : `${pad(hh)}:${pad(mm)}`;
}

/* ------------------------------------------------------------------ */
/* Solar position — COMPUTED, not demo data                           */
/* ------------------------------------------------------------------ */

export interface SolarPosition {
  /** Degrees above the horizon. Negative means the sun has set. */
  elevationDeg: number;
  /** True bearing of the sun, degrees clockwise from north. */
  azimuthDeg: number;
  /** Solar declination at the instant, degrees. */
  declinationDeg: number;
  /** Local apparent solar time at the target longitude, minutes past midnight. */
  solarTimeMin: number;
  /** Equation of time, minutes. Kept because it explains the solar clock. */
  equationOfTimeMin: number;
}

/**
 * Sun elevation and azimuth for an instant and a place.
 *
 * The NOAA solar position algorithm (the one behind their published solar
 * calculator), to the accuracy that matters here — better than half a degree.
 * `lon` is used twice and both uses are real: once in the time offset that
 * turns UTC into local APPARENT solar time (4 minutes per degree of
 * longitude, plus the equation of time), and once through the hour angle that
 * follows from it. There is no timezone database in this product and none is
 * needed: the sun keeps solar time, not civil time.
 *
 * Consistency with the mission is therefore automatic. A February capture at
 * 60° N returns a low sun; the same instant at 10° S returns a high one; a
 * capture six hours of longitude away returns a different hour angle. None of
 * it is seeded and none of it can drift from the capture timestamp.
 */
export function solarPosition(at: Date, lat: number, lon: number): SolarPosition {
  const n = dayOfYear(at);
  const hour = utcHour(at);

  // Fractional year, radians.
  const y = ((2 * Math.PI) / 365) * (n - 1 + (hour - 12) / 24);

  // Equation of time, minutes.
  const eqTime =
    229.18 *
    (0.000075 +
      0.001868 * Math.cos(y) -
      0.032077 * Math.sin(y) -
      0.014615 * Math.cos(2 * y) -
      0.040849 * Math.sin(2 * y));

  // Solar declination, radians.
  const decl =
    0.006918 -
    0.399912 * Math.cos(y) +
    0.070257 * Math.sin(y) -
    0.006758 * Math.cos(2 * y) +
    0.000907 * Math.sin(2 * y) -
    0.002697 * Math.cos(3 * y) +
    0.00148 * Math.sin(3 * y);

  // True solar time in minutes. The input is UTC, so the timezone term of
  // the NOAA formula is zero and the longitude term carries the whole offset.
  const trueSolarMin = ((hour * 60 + eqTime + 4 * lon) % 1440 + 1440) % 1440;

  // Hour angle, degrees: negative before local solar noon.
  const hourAngle = trueSolarMin / 4 - 180;

  const phi = lat * RAD;
  const ha = hourAngle * RAD;

  const cosZenith = clamp(
    Math.sin(phi) * Math.sin(decl) + Math.cos(phi) * Math.cos(decl) * Math.cos(ha),
    -1,
    1,
  );
  const zenith = Math.acos(cosZenith);
  const elevation = 90 - zenith * DEG;

  // Azimuth clockwise from north. The denominator vanishes at the pole and at
  // the zenith; both are guarded rather than allowed to produce NaN.
  const denom = Math.cos(phi) * Math.sin(zenith);
  let azimuth: number;
  if (Math.abs(denom) < 1e-9) {
    azimuth = hourAngle > 0 ? 180 : 0;
  } else {
    const cosAz = clamp((Math.sin(phi) * cosZenith - Math.sin(decl)) / denom, -1, 1);
    azimuth = 180 - Math.acos(cosAz) * DEG;
    if (hourAngle > 0) azimuth = 360 - azimuth;
  }

  return {
    elevationDeg: round(elevation, 1),
    azimuthDeg: round(((azimuth % 360) + 360) % 360, 1),
    declinationDeg: round(decl * DEG, 2),
    solarTimeMin: round(trueSolarMin, 0),
    equationOfTimeMin: round(eqTime, 1),
  };
}

/* ------------------------------------------------------------------ */
/* Sky state — the mission's own cloud number, expressed properly      */
/* ------------------------------------------------------------------ */

export type SkyState = 'CLEAR' | 'SCATTERED' | 'BROKEN' | 'OVERCAST';

/**
 * Cloud cover in oktas — eighths of the sky — which is how a surface
 * observation actually records it. `mission.orbit.cloudPct` is the only
 * input; nothing is invented and nothing is smoothed.
 */
export function oktasFor(cloudPct: number): number {
  return clamp(Math.round((cloudPct / 100) * 8), 0, 8);
}

/**
 * Sky state from cover, on the aviation boundaries: SKC at nothing, FEW/SCT
 * to about half, BKN to seven eighths, OVC above it. The four names the
 * report uses map onto those bands one for one.
 */
export function skyStateFor(cloudPct: number): SkyState {
  const oktas = oktasFor(cloudPct);
  if (oktas <= 0) return 'CLEAR';
  if (oktas <= 4) return 'SCATTERED';
  if (oktas <= 7) return 'BROKEN';
  return 'OVERCAST';
}

/** The long form used under the value, e.g. `3/8 — FEW TO SCATTERED`. */
const SKY_NOTE: Record<SkyState, string> = {
  CLEAR: 'Unobstructed sky over the target.',
  SCATTERED: 'Partial cover, below half the sky. Usable frame expected.',
  BROKEN: 'Majority cover. Frame quality depends on the gap at the capture point.',
  OVERCAST: 'Full cover. A pass under this sky is re-tasked at no cost.',
};

/* ------------------------------------------------------------------ */
/* Surface fields — DERIVED DEMO DATA (see the header)                 */
/* ------------------------------------------------------------------ */

/**
 * Annual mean surface temperature by latitude, °C.
 * A quadratic fit through the standard zonal-mean profile: 26.5 at the
 * equator, 19.6 at 34°, 12.2 at 49°, −22 at the pole. Latitude only — there
 * is no land/sea mask and no elevation in this model, and there is not meant
 * to be one.
 */
function annualMeanC(latDeg: number): number {
  const a = Math.abs(latDeg);
  return 26.5 - 0.006 * a * a;
}

/**
 * Half-range of the seasonal cycle, °C. Near zero in the tropics and growing
 * roughly linearly with latitude — the reason a February frame of Oslo and a
 * February frame of Nairobi cannot come back at the same temperature. 7.0 at
 * 34°, 9.5 at 49°, 11.4 at 60°, which is what those latitudes actually swing.
 */
function seasonalAmplitudeC(latDeg: number): number {
  return 1.2 + 0.17 * Math.abs(latDeg);
}

/**
 * Prevailing surface wind bearing (the direction it blows FROM) for a
 * latitude band: the trade easterlies inside 30°, the mid-latitude
 * westerlies from 30 to 60, the polar easterlies beyond. Hemisphere sets the
 * deflection.
 */
function prevailingBearing(latDeg: number): number {
  const a = Math.abs(latDeg);
  const north = latDeg >= 0;
  if (a < 30) return north ? 75 : 105;
  if (a < 60) return north ? 255 : 285;
  return north ? 45 : 135;
}

/**
 * Dew point from temperature and relative humidity — the Magnus-Tetens
 * approximation, valid across the range this block ever reports. Not seeded:
 * given the two inputs, this is the answer.
 */
function dewPointC(tempC: number, humidityPct: number): number {
  const rh = clamp(humidityPct, 1, 100);
  const g = Math.log(rh / 100) + (17.625 * tempC) / (243.04 + tempC);
  return (243.04 * g) / (17.625 - g);
}

export interface SurfaceConditions {
  temperatureC: number;
  temperatureF: number;
  dewPointC: number;
  humidityPct: number;
  windSpeedMs: number;
  windSpeedKmh: number;
  windBearingDeg: number;
  windCompass: string;
  visibilityKm: number;
  pressureHpa: number;
}

/**
 * The six derived surface fields, plus the two that follow from them.
 *
 * DEMO DATA. Every line below is a climatological shape evaluated at the
 * mission's own latitude, day of year and local solar time, offset by a
 * deterministic per-mission constant so two targets at the same latitude do
 * not report identical weather. Replaced wholesale by the weather API named
 * in the file header.
 */
export function surfaceConditions(input: {
  code: string;
  lat: number;
  at: Date;
  cloudPct: number;
  /** Local apparent solar hour, 0..24 — from solarPosition(). */
  solarHour: number;
}): SurfaceConditions {
  const seed = input.code.toUpperCase();
  const lat = input.lat;
  const n = dayOfYear(input.at);
  const clearness = 1 - clamp(input.cloudPct, 0, 100) / 100;

  // Seasonal term. The northern peak is around 20 July (day 202); the
  // southern hemisphere is half a year out of phase with it.
  const peakDay = lat >= 0 ? 202 : 202 - 182.6;
  const seasonal =
    seasonalAmplitudeC(lat) * Math.cos((2 * Math.PI * (n - peakDay)) / 365.25);

  // Diurnal term, peaking at 14:30 local solar time. A clear sky swings
  // further between night and afternoon than a covered one does.
  const diurnalAmp = 2 + 3.2 * clearness;
  const diurnal = diurnalAmp * Math.cos((2 * Math.PI * (input.solarHour - 14.5)) / 24);

  // Per-target offset: ±2.5 °C of microclimate, stable for the life of the
  // mission code.
  const micro = (seededUnit(`temp:${seed}`) - 0.5) * 5;

  const temperatureC = clamp(annualMeanC(lat) + seasonal + diurnal + micro, -62, 54);

  // Humidity rises with cover and falls as the air warms through the day.
  const humidityPct = clamp(
    58 + 0.3 * input.cloudPct - 1.6 * diurnal + (seededUnit(`rh:${seed}`) - 0.5) * 16,
    15,
    99,
  );

  // Visibility is haze-limited: humid air scatters, cover adds a little more.
  const visibilityKm = clamp(
    42 - 0.3 * humidityPct - 0.06 * input.cloudPct + (seededUnit(`vis:${seed}`) - 0.5) * 10,
    2,
    48,
  );

  // Surface wind. The band function peaks in the mid-latitude westerlies and
  // falls off toward the equator and the pole.
  const band = 2 + 3.2 * Math.exp(-(((Math.abs(lat) - 50) / 28) ** 2));
  const windSpeedMs = clamp(band + (seededUnit(`wind:${seed}`) - 0.5) * 3.2, 0.2, 16);
  const windBearingDeg =
    (((prevailingBearing(lat) + (seededUnit(`winddir:${seed}`) - 0.5) * 70) % 360) + 360) % 360;

  // Sea-level pressure. Covered skies sit low, clear skies sit high.
  const pressureHpa = clamp(
    1016 - 0.1 * input.cloudPct + (seededUnit(`pres:${seed}`) - 0.5) * 22,
    968,
    1044,
  );

  return {
    temperatureC: round(temperatureC, 1),
    temperatureF: round(temperatureC * 1.8 + 32, 1),
    dewPointC: round(dewPointC(temperatureC, humidityPct), 1),
    humidityPct: round(humidityPct, 0),
    windSpeedMs: round(windSpeedMs, 1),
    windSpeedKmh: round(windSpeedMs * 3.6, 1),
    windBearingDeg: round(windBearingDeg, 0),
    windCompass: compassPoint(windBearingDeg),
    visibilityKm: round(visibilityKm, 1),
    pressureHpa: round(pressureHpa, 0),
  };
}

/* ------------------------------------------------------------------ */
/* The block                                                          */
/* ------------------------------------------------------------------ */

/** Where the reference instant came from. Shown on the panel, never guessed. */
export type ConditionsBasis = 'CAPTURE' | 'PLANNED_PASS' | 'TASKING';

export interface MissionConditions {
  /** ISO instant the whole block is stated for. */
  at: string;
  /** CAPTURE means observed-time geometry; the others are a planned pass. */
  basis: ConditionsBasis;
  /** True only when the mission actually holds a capture timestamp. */
  measured: boolean;

  /** Straight off `mission.orbit.cloudPct`. Never modified here. */
  cloudPct: number;
  oktas: number;
  sky: SkyState;
  skyNote: string;

  sun: {
    elevationDeg: number;
    azimuthDeg: number;
    compass: string;
    declinationDeg: number;
    /** `10:32` local apparent solar time at the target longitude. */
    solarTime: string;
    /** False when the sun is below the horizon at the reference instant. */
    daylight: boolean;
  };

  surface: SurfaceConditions;
}

/**
 * The instant the conditions block is stated for.
 *
 * A capture timestamp if the mission has one, otherwise the opening of the
 * scheduled window, otherwise the moment the mission was created. It is never
 * `Date.now()` — the block has to render identically on the server and on the
 * client, and a report whose numbers move while nobody is looking is not a
 * report.
 */
export function conditionsReference(mission: MissionDTO): { at: Date; basis: ConditionsBasis } {
  if (mission.capturedAt) return { at: new Date(mission.capturedAt), basis: 'CAPTURE' };
  if (mission.windowOpensAt) return { at: new Date(mission.windowOpensAt), basis: 'PLANNED_PASS' };
  return { at: new Date(mission.createdAt), basis: 'TASKING' };
}

/**
 * The conditions block for a mission. Pure, deterministic and safe to call on
 * both sides of hydration.
 *
 * `at` moves the reference instant — pass the next predicted pass while a
 * capture window is open and the block becomes a forecast for that pass
 * rather than for the window's opening. It is IGNORED once the mission holds
 * a real capture timestamp: a frame that exists was taken at one instant and
 * the report states the conditions at that instant.
 */
export function missionConditions(
  mission: MissionDTO,
  options: { at?: Date | string | null } = {},
): MissionConditions {
  const fallback = conditionsReference(mission);
  const override = !mission.capturedAt && options.at ? new Date(options.at) : null;
  const valid = override !== null && !Number.isNaN(override.getTime());
  const at = valid ? (override as Date) : fallback.at;
  const basis: ConditionsBasis = valid ? 'PLANNED_PASS' : fallback.basis;

  const sun = solarPosition(at, mission.lat, mission.lon);
  const cloudPct = clamp(Math.round(mission.orbit.cloudPct), 0, 100);
  const sky = skyStateFor(cloudPct);

  const surface = surfaceConditions({
    code: mission.code,
    lat: mission.lat,
    at,
    cloudPct,
    solarHour: sun.solarTimeMin / 60,
  });

  return {
    at: at.toISOString(),
    basis,
    measured: basis === 'CAPTURE',
    cloudPct,
    oktas: oktasFor(cloudPct),
    sky,
    skyNote: SKY_NOTE[sky],
    sun: {
      elevationDeg: sun.elevationDeg,
      azimuthDeg: sun.azimuthDeg,
      compass: compassPoint(sun.azimuthDeg),
      declinationDeg: sun.declinationDeg,
      solarTime: clockFromMinutes(sun.solarTimeMin),
      daylight: sun.elevationDeg > 0,
    },
    surface,
  };
}

/* ------------------------------------------------------------------ */
/* Orbital period — COMPUTED, used by the orbit plot                   */
/* ------------------------------------------------------------------ */

/** Mean Earth radius, km. */
export const EARTH_RADIUS_KM = 6371;

/** Earth's gravitational parameter, km³/s². */
const MU_EARTH = 398_600.4418;

/**
 * Orbital period in minutes for a circular orbit at `altitudeKm`, from
 * Kepler's third law. Real physics on a real field of the mission record:
 * 520 km returns 94.9 minutes, which is what a 520 km orbit does.
 */
export function orbitalPeriodMin(altitudeKm: number): number {
  const a = EARTH_RADIUS_KM + Math.max(0, altitudeKm);
  const seconds = 2 * Math.PI * Math.sqrt((a * a * a) / MU_EARTH);
  return round(seconds / 60, 1);
}

/**
 * Earth-central angle between the target and the sub-satellite point for a
 * given off-nadir look angle — the cross-track miss distance, in degrees.
 * Standard slant-range geometry, so the orbit plot can place the ground track
 * beside the target by exactly as much as `offNadirDeg` says it should be.
 */
export function crossTrackAngleDeg(offNadirDeg: number, altitudeKm: number): number {
  const eta = clamp(offNadirDeg, 0, 60) * RAD;
  const ratio = (EARTH_RADIUS_KM + Math.max(0, altitudeKm)) / EARTH_RADIUS_KM;
  const inner = clamp(ratio * Math.sin(eta), -1, 1);
  return round((Math.asin(inner) - eta) * DEG, 3);
}
