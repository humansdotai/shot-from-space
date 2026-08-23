/**
 * FUI primitives — the entire visual vocabulary of Shot from Space.
 *
 * Every surface in the product composes these. If a screen needs a new visual
 * idea, it is added here first, then consumed. Nothing outside this directory
 * defines colours, hairlines, corner marks or telemetry typography.
 *
 * ------------------------------------------------------------------------
 * TWO RULES THAT OVERRIDE EVERY OTHER DECISION (CONTRACT.md §2)
 * ------------------------------------------------------------------------
 *
 * 1. ONE IDENTITY, TWO JOBS. There IS a logo now (BRIEF-V2 supersedes
 *    CONTRACT.md §2.1 on this point): the lockup lives in
 *    <Wordmark /> (`components/site`) and appears in the header and the
 *    footer, nowhere else. <CreditBox /> keeps the job it always had —
 *    the bordered `[ SHOT FROM SPACE ]` print credit on a film frame or
 *    a poster — and is still capped at `md`. Do not set the name in
 *    plain type anywhere else, and do not use the credit box as a logo
 *    or the logo as a credit.
 *
 * 2. DENSITY. The satellite image is the hero; this layer frames it and never
 *    competes with it. Per viewport: at most ONE <OrbitDiagram />, at most
 *    ~SIX telemetry values around a single image, body copy in `font-sans`
 *    (a paragraph of monospace is a bug), and whitespace as the primary
 *    compositional tool. If a screen feels busy, delete telemetry, never
 *    imagery.
 *
 * Corollaries the primitives already enforce: one accent colour, used only
 * for live/active status; no spinners (<Skeleton /> and <ScanSweep /> are the
 * loading language); no decorative motion — there is no marquee or ticker in
 * this system and none is to be added.
 */

/* --- Layout ------------------------------------------------------------ */
export { Container } from './Container';
/**
 * Document-level smooth scrolling. One CSS declaration plus a history
 * guard; no scroll-jacking, no wrapper, inert under reduced motion.
 * <SiteHeader /> already renders it on every page — mount it again only
 * if the shell changes.
 */
export { SmoothScroll } from './SmoothScroll';

/* --- Typography & data ------------------------------------------------- */
export { TelemetryLabel } from './TelemetryLabel';
export type { TelemetryTone, TelemetrySize } from './TelemetryLabel';
export { SectionHeader } from './SectionHeader';
export { MissionCode } from './MissionCode';
export { FileTags } from './FileTags';
export { DataRow } from './DataRow';
export { KeyValueGrid } from './KeyValueGrid';
export type { KeyValueItem } from './KeyValueGrid';
export { NumberedList } from './NumberedList';
export type { NumberedItem } from './NumberedList';

/* --- Surfaces & marks -------------------------------------------------- */
export { HairlineFrame } from './HairlineFrame';
export { CropMarks } from './CropMarks';
export { Rule } from './Rule';
export { GrainOverlay } from './GrainOverlay';

/* --- Imagery ----------------------------------------------------------- */
export { ImagePlate } from './ImagePlate';
export { DossierCard } from './DossierCard';

/* --- Status, states & instruments -------------------------------------- */
export { StatusChip, StatusToken } from './StatusChip';
export type { ChipState, TokenTone } from './StatusChip';
export { MetaPill } from './MetaPill';
export type { MetaSegment } from './MetaPill';
export { OrbitDiagram } from './OrbitDiagram';
export { Skeleton } from './Skeleton';
export { EmptyState } from './EmptyState';
export { ScanSweep } from './ScanSweep';

/* --- Actions ----------------------------------------------------------- */
/**
 * <Button /> is the site's control. <ActionButton /> is the older
 * monospace/uppercase form and stays for the telemetry surfaces that
 * already speak in it; new work uses <Button />.
 */
export { Button, ButtonArrow } from './Button';
export type { ButtonProps, ButtonVariant, ButtonSize } from './Button';
export { ActionButton } from './ActionButton';

/* --- Hover vocabulary ---------------------------------------------------
 * <HoverCard /> is the bordered plate: a framed image with a caption and
 * optional footer under it, for grids that carry metadata.
 * <MediaCard /> is the full-bleed frame: nothing but a photograph and a
 * title until you hover, when the image scales, the scrim deepens and a
 * decoding subtitle rises under the title. Use it when the picture is
 * the argument.
 */
export { HoverCard } from './HoverCard';
export { MediaCard } from './MediaCard';
export { ScrambleText } from './ScrambleText';
export type { ScrambleTrigger, ScrambleTag } from './ScrambleText';

/* --- Proof -------------------------------------------------------------- */
export { Guarantee } from './Guarantee';
export type { GuaranteeIcon } from './Guarantee';

/* --- The brand element (see rule 1 above) ------------------------------ */
export { CreditBox } from './CreditBox';
export type { CreditBoxSize } from './CreditBox';
export { Spacer } from './Spacer';
export type { SpacerSize } from './Spacer';
export { Band } from './Band';
export type { BandRhythm, BandTone } from './Band';
export { Grid12 } from './Grid12';
