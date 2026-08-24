import { Artifact3D } from '@/components/artifact';
import { cn } from '@/lib/utils';

/**
 * THE SEAL — the maker's mark, as an object rather than a picture.
 *
 * White hard enamel over the mission mark, reading ORIGINALLY LICENSED
 * PRODUCT around a horizon curve. It sits at the foot of the footer and again
 * at the foot of a mission file, which are the two places a reader has
 * finished reading and is deciding whether this is a real operation.
 *
 * It is drawn through <Artifact3D /> rather than as an <img> for one reason:
 * everywhere else on this site a physical object tilts toward the pointer and
 * casts its own shape-accurate shadow, and a seal that sat flat would be the
 * one object that reads as a sticker. `material="metal"` is correct here —
 * hard enamel is glossy and genuinely travels a highlight, unlike the
 * embroidered patch, which is thread and stays matte.
 *
 * `surface="wall"` gives the lighter, wider cast of something mounted proud
 * of a surface. On the near-black footer a tight contact shadow is invisible
 * anyway; the wall cast at least reads as depth at the seal's own edge.
 *
 * ------------------------------------------------------------------
 * WHAT THE SEAL CLAIMS
 * ------------------------------------------------------------------
 * It is a MAKER'S mark: Shot from Space applying its own mark to its own
 * product, in the way a manufacturer stamps a case back. It is not a
 * third-party certification, no external body issues it, and nothing on the
 * site says otherwise. The accessible name says "maker's seal" outright so
 * that a screen reader is not told the product has been certified by
 * somebody. See the note in the handover: the wording reads like an
 * accreditation to some readers, and that is a brand decision, not a
 * technical one.
 */
/**
 * DEFAULT SIZE — set by the wording, not by the composition.
 *
 * The artwork is 448 x 462 and the words ORIGINALLY LICENSED PRODUCT have a
 * cap height of ~35px in it, i.e. 7.6 % of the seal's width. Below roughly a
 * 10px cap the line is a texture rather than a sentence, which is what the
 * old 68px seal rendered: a 5px cap, unreadable at any viewing distance. The
 * floor is therefore ~132px and the ramp starts just above it.
 *
 * The top of the ramp is capped by the raster, not by taste: 448px of source
 * covers 224 CSS px on a 2x display exactly, so 224 is the largest width the
 * seal can be drawn at without inventing detail.
 *
 * Passing `size` REPLACES this string outright (it is a default parameter,
 * not a merge), so a caller that wants one fixed width gets exactly that and
 * none of these breakpoints leak into it.
 */
const SEAL_SIZE = 'w-[136px] md:w-[152px] xl:w-[176px] xl2:w-[200px] xl3:w-[224px]';

export function LicensedSeal({
  className,
  size = SEAL_SIZE,
}: {
  className?: string;
  /** Tailwind width class. The seal is square, so width sets it. */
  size?: string;
}) {
  return (
    <Artifact3D
      src="/brand/licensed-seal.webp"
      alt="Shot from Space maker's seal: originally licensed product"
      material="metal"
      surface="wall"
      tilt={16}
      className={cn(size, className)}
    />
  );
}
