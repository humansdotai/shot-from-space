/**
 * Film grain. One fixed layer over the whole document, generated as an inline
 * SVG feTurbulence so nothing is fetched. Kept subtle — the imagery is the hero.
 */
const GRAIN = `data:image/svg+xml;utf8,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="180" height="180"><filter id="n"><feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="3" stitchTiles="stitch"/><feColorMatrix type="saturate" values="0"/></filter><rect width="180" height="180" filter="url(%23n)" opacity="0.55"/></svg>`,
)}`;

export function GrainOverlay() {
  return (
    <div
      aria-hidden
      className="grain-overlay"
      style={{ backgroundImage: `url("${GRAIN}")` }}
    />
  );
}
