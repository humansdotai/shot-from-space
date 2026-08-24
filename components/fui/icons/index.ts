/**
 * TYPE MARKS — the icon set for the readout blocks.
 *
 * A mark names the KIND of value on a row: a coordinate, an instant, an
 * orbit, a cloud fraction, a facility, a format, a resolution. Rows whose
 * value has no type carry no mark. The drawing rules, the accessibility
 * position and the motion policy are all stated in ./Icon.tsx; the set
 * itself and what each mark means are in ./glyphs.tsx.
 *
 * `markFor()` is the closed dictionary that turns a written label into
 * the mark for it — see ./marks.tsx for why the mapping is central and
 * why it answers `null` far more often than it answers a glyph.
 *
 * Import from here, never from ./Icon — the bare frame is the set's own
 * business and a consumer that reaches for it is about to add a glyph
 * outside the set.
 */

export type { IconProps, LiveIconProps } from './Icon';
export { markFor } from './marks';
export type { Mark } from './marks';

export {
  /* Ground — where on the earth */
  IconCrosshair,
  IconPin,
  IconArea,
  /* Time — when */
  IconClock,
  IconCalendar,
  IconPassWindow,
  /* The pass — the spacecraft and the frame it takes */
  IconSatellite,
  IconOrbit,
  IconResolution,
  IconAntenna,
  IconCapture,
  IconElevation,
  IconRange,
  IconAltitude,
  /* Sky — the conditions over the target */
  IconCloud,
  IconSun,
  IconEye,
  IconWind,
  IconCompass,
  IconThermometer,
  IconDroplet,
  IconGauge,
  /* The object — what is printed, where, and how it travels */
  IconSheet,
  IconComposition,
  IconFrame,
  IconGrade,
  IconFacility,
  IconParcel,
  IconHandoff,
  /* The record — the file's own references */
  IconDocket,
  IconLink,
  IconMail,
  IconReceipt,
  /* State — the one mark that names a state and not a type */
  IconLock,
} from './glyphs';
