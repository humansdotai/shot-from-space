/**
 * THE LANDING PAGE, BAND BY BAND.
 *
 * Each band is one of the section archetypes in SYSTEM-V3 §5, built here
 * rather than borrowed. The archetypes themselves are the three small files
 * at the bottom of this list — a media plate, a feature row and an arrow —
 * plus `<MediaCard />` from the FUI layer, which the mosaic and the
 * media-link panel both compose.
 *
 * The page alternates ground, dark and light, roughly half and half,
 * because that is the poster's construction: the photograph on the void,
 * the record on the paper. Imagery and film live in the dark bands;
 * specification, price and proof live on the paper.
 */

/* --- The bands, in page order ------------------------------------------ */
export { AnnounceBand } from './AnnounceBand';
export { HeroBand } from './HeroBand';
export { OrbitEntryBand } from './OrbitEntryBand';
export { ReachBand } from './ReachBand';
export { GlobeBand } from './GlobeBand';
export { FleetBand } from './FleetBand';
export { FilmBand } from './FilmBand';
export { PassBand } from './PassBand';
export { ResultBand } from './ResultBand';
export { RecordBand } from './RecordBand';
export { ObjectBand } from './ObjectBand';
export { AnswersBand } from './AnswersBand';
export { ArchiveBand } from './ArchiveBand';
export { MissionCarousel } from './MissionCarousel';
export { FounderBand } from './FounderBand';
export { PricingBand } from './PricingBand';
export { ClosingBand } from './ClosingBand';

/* --- The pieces the bands are built from ------------------------------- */
export { BandHead } from './BandHead';
export { FeatureRow } from './FeatureRow';
export { FeaturedMosaic } from './FeaturedMosaic';
export { Guarantees, GuaranteeStrip } from './Guarantees';
export { Plate } from './Plate';
export { Arrow } from './Arrow';
export { MissionEntry } from './MissionEntry';
export { PosterPreview } from './PosterPreview';
export { MEASURE } from './geometry';
export { EXAMPLE, PRINT_EXAMPLE } from './example-mission';
