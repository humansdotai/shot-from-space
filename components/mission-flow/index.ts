/**
 * /mission — the persistent configurator.
 *
 * <MissionFlow /> is the only export a PAGE needs. Everything else here
 * is either the shell it composes (`Configurator`, `SectionRail`,
 * `PanelFoot`, `PreviewStage`) or one of the sections the ten original
 * screens were re-housed into (`S1Reveal` … `S10Confirmation`).
 *
 * ==================================================================
 * THE PANEL VOCABULARY — what a SECTION is built from
 * ==================================================================
 * The right-hand column is a shared instrument, not six private
 * layouts. A section composes these and nothing else; anything it
 * invents locally is a divergence and will show as one.
 *
 *   <PanelStack>                 the section's vertical rhythm
 *   <PanelHead>                  eyebrow · title · standfirst · rule
 *   <PanelGroup>                 a named block — INVERTED CHIP, rule, state
 *   <PanelTag>                   a state or a count — OUTLINED chip
 *   <FieldTable> / <FieldRow>    the ruled label/value instrument table
 *   <StatGrid>  / <StatCell>     figures with their labels above them
 *   <PanelNote>                  small print, sentence case, ruled left
 *   <PhaseBreak>                 one clip between two phases
 *   <PreviewDisclosure>          what the poster in the preview IS
 *   <CardGroup>                  the option group — see CardOption
 *
 * FIVE KINDS, FIVE SHAPES. A heading is a filled chip or a sans title; a
 * state is an outlined chip; a reading is a dim label, a type mark and a
 * full-ink value; a control is a bordered card that inverts whole when
 * it is chosen; small print sits behind a left hairline. Inversion is
 * rationed to two places — the name of a block and the option that has
 * been taken — and means the same thing in both.
 *
 * Read the head of `Panel.tsx` for the type rules these encode: a label
 * is monospace/uppercase/dim, a value is monospace/uppercase/ink at the
 * SAME size, a unit is a separate span, and body copy is sans. The type
 * marks come from `markFor()` in `components/fui/icons/marks.tsx` — a
 * closed dictionary keyed on the written label, which answers `null`
 * for every label that does not name a kind of value.
 */
export { MissionFlow } from './MissionFlow';

/* --- The panel's shared furniture ---------------------------------- */
export {
  PanelStack,
  PanelHead,
  PanelGroup,
  PanelTag,
  PanelNote,
  FieldTable,
  FieldRow,
  StatGrid,
  StatCell,
  PhaseBreak,
  PreviewDisclosure,
} from './Panel';
export type { PhaseClip } from './Panel';

export { CardGroup } from './CardGroup';
export type { CardOption } from './CardGroup';

export { SectionRail, ClosedRail } from './SectionRail';
export { PanelFoot } from './PanelFoot';
export type { PrimaryAction } from './PanelFoot';
