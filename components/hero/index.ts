/**
 * HERO — the signature moment.
 *
 * `MosaicHero` is the one component the landing page mounts: a satellite frame
 * under a sampling raster that lights up and cascades where it is touched. `MosaicField` is that raster on its own
 * for any other full-bleed frame. `AmbientMosaic` is the same geometry with the
 * cascade, the sampling and the pointer taken out — texture behind a dark band,
 * never an event. `VideoPlate` plays one of the supplied clips.
 */
export { MosaicHero } from './MosaicHero';
export { MosaicField } from './MosaicField';
export { AmbientMosaic } from './AmbientMosaic';
export { VideoPlate } from './VideoPlate';
export { buildMosaic, type MosaicTile } from './mosaic';
