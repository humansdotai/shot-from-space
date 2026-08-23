import { cn } from '@/lib/utils';

/**
 * The Shot from Space lockup: the stepped bracket mark, its register
 * square, and the name set in three lines of mono.
 *
 * ------------------------------------------------------------------
 * WHY THIS IS INLINE SVG AND NOT <img src="/brand/logo-wordmark.svg">
 * ------------------------------------------------------------------
 * The delivered file sets the name as live SVG <text> in "Typestar-OCR"
 * — a font that is not installed and not licensed here, and which an
 * <img> could not load even if it were, because an image-referenced SVG
 * cannot reach the page's @font-face rules. Rendered as a file it falls
 * back to the browser's default serif: the logo would arrive broken.
 * The export also carries a 596-wide artboard around ~280px of artwork,
 * so more than half of any box it is placed in is empty, and clips the
 * third baseline (126) against a 124-tall viewBox.
 *
 * So the geometry is transcribed exactly — the two bracket paths and the
 * 7×7 register square are byte-for-byte the delivered curves — the
 * artboard is cropped to the artwork, and the name is set in IBM Plex
 * Mono, the typeface this site already loads and already speaks in.
 *
 * The dividend: `fill="currentColor"` means the mark inverts with its
 * ground for free. No `filter: invert()`, no light/dark twin asset, no
 * white PNG glowing on a paper band.
 *
 * Sized by height only — `className="h-14 w-auto"`. The viewBox is
 * cropped to the ink (282 × 102, ratio 2.77) so a height utility sets
 * the artwork's real height rather than the height of an empty box.
 */
export function Wordmark({
  title,
  className,
}: {
  /** Accessible name. Omit when an ancestor link already labels it. */
  title?: string;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 26 282 102"
      fill="currentColor"
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : true}
      className={cn('block h-8 w-auto overflow-visible', className)}
    >
      {title ? <title>{title}</title> : null}

      {/*
        The mark, dropped 41.6 so its centre sits on the optical centre
        of the three-line stack (cap-top 30.2 to baseline 126, centre
        78.1). The export left it top-aligned against a 596-wide
        artboard, which opens a hole under it the moment the artboard is
        cropped to the artwork. Same curves, same spacing to the name,
        one axis corrected.
      */}
      <g transform="translate(0, 41.6)">
        {/* Lower bracket — mirrored in x about 105.5, as delivered. */}
        <path
          d="M125,34 C136.045695,34 145,42.954305 145,54 L145,73 L140,73 L140,49 L131,39 L66,39 L66,34 L125,34 Z"
          transform="translate(105.5, 53.5) scale(-1, 1) translate(-105.5, -53.5)"
        />
        {/* Upper bracket — mirrored in y about 19.5, as delivered. */}
        <path
          d="M59,0 C70.045695,0 79,8.954305 79,20 L79,39 L74,39 L74,15 L65,5 L0,5 L0,0 L59,0 Z"
          transform="translate(39.5, 19.5) scale(1, -1) translate(-39.5, -19.5)"
        />
        {/* Register square. */}
        <rect x="39" y="13" width="7" height="7" />
      </g>

      {/* The name. Three lines, 35px leading on 37px caps — the tight
          stack is the lockup, not a wrap. */}
      <text
        fontFamily="var(--font-mono)"
        fontSize="37"
        fontWeight="500"
        letterSpacing="1.3"
        xmlSpace="preserve"
      >
        <tspan x="161" y="56">SHOT</tspan>
        <tspan x="161" y="91">FROM</tspan>
        <tspan x="161" y="126">SPACE</tspan>
      </text>
    </svg>
  );
}
