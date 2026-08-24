import { FORMATS } from '@/lib/pricing';
import type { PrintFormat } from '@/lib/types';
import { cn } from '@/lib/utils';

/**
 * THE THREE FORMATS, DRAWN AT TRUE RELATIVE PROPORTION.
 *
 * A buyer choosing between 30 × 40, 50 × 70 and 70 × 100 is choosing how big
 * an object arrives on a wall, and until now the product expressed that
 * difference only as two numbers and a price. Numbers are the wrong
 * instrument for it: nobody reads "70 × 100" and pictures 5.8 times the paper
 * of a 30 × 40. A drawing does it in one look.
 *
 * ------------------------------------------------------------------
 * WHY THE SCALE IS SHARED AND NOT PER-SHEET
 * ------------------------------------------------------------------
 * Every silhouette in a set is drawn inside ONE viewBox — `FORMAT_FIELD`,
 * the bounding box of the largest sheet in `lib/pricing` — with the sheet
 * placed against the bottom-left corner of that box. Give the three <svg>
 * elements the same rendered height and the proportion between them is true
 * by construction rather than by a table of hand-picked heights that would
 * drift the moment the catalogue changed. There is no number in this file
 * that describes a print: the centimetres are parsed out of
 * `PrintFormat.metric`, which is the same string the page prints.
 *
 * The drawing is 1px line work in `currentColor` with a wash of the same
 * colour inside it — the hand that draws the crop marks and the orbit
 * diagram. It carries no accent: on the size screen the accent is the
 * product's state colour and selection there is already marked in ink, and a
 * tinted rectangle would read as a swatch rather than as paper.
 */

export interface Sheet {
  widthCm: number;
  heightCm: number;
}

/** How dark the drawing sits. Selection is ink, everything else steps back. */
export type SilhouetteTone = 'faint' | 'dim' | 'ink';

const TONE: Record<SilhouetteTone, string> = {
  faint: 'ink-faint',
  dim: 'ink-dim',
  ink: 'ink',
};

/**
 * `'30 × 40 CM'` → `{ widthCm: 30, heightCm: 40 }`.
 *
 * Returns null rather than a guess if the catalogue ever stops speaking in
 * centimetres — a caller then draws nothing, which is the honest failure. An
 * invented fallback rectangle would be a lie about a physical object.
 */
export function sheetFromMetric(metric: string): Sheet | null {
  const m = /^\s*(\d+(?:[.,]\d+)?)\s*[×x]\s*(\d+(?:[.,]\d+)?)\s*cm\s*$/i.exec(metric);
  if (!m) return null;
  const widthCm = Number(m[1].replace(',', '.'));
  const heightCm = Number(m[2].replace(',', '.'));
  if (!Number.isFinite(widthCm) || !Number.isFinite(heightCm)) return null;
  if (widthCm <= 0 || heightCm <= 0) return null;
  return { widthCm, heightCm };
}

/** The sheet a catalogue entry describes. */
export function sheetOf(format: PrintFormat): Sheet | null {
  return sheetFromMetric(format.metric);
}

/** The box that holds every sheet in a set — the shared scale. */
export function sheetField(sheets: readonly Sheet[]): Sheet {
  if (sheets.length === 0) return { widthCm: 1, heightCm: 1 };
  return {
    widthCm: Math.max(...sheets.map((s) => s.widthCm)),
    heightCm: Math.max(...sheets.map((s) => s.heightCm)),
  };
}

/**
 * The field the whole product draws formats in: the largest sheet the
 * catalogue sells. Every surface reads this one constant, so the landing
 * page and the purchase flow render the same object at the same scale.
 */
export const FORMAT_FIELD: Sheet = sheetField(
  FORMATS.map(sheetOf).filter((s): s is Sheet => s !== null),
);

/**
 * The moulding drawn around a framed sheet, and the padding that keeps it
 * inside the viewBox. Both are fractions of a dimension rather than
 * millimetre figures, because the frame's real profile is not in the
 * catalogue and drawing a measured one would be inventing a spec.
 */
const MOULDING_FRACTION = 0.05;
const PAD_FRACTION = 0.075;

export function FormatSilhouette({
  sheet,
  field = FORMAT_FIELD,
  framed = false,
  tone = 'dim',
  className,
}: {
  sheet: Sheet;
  /** The shared scale. Leave it alone unless drawing outside the catalogue. */
  field?: Sheet;
  /** Draw the moulding around the sheet — the finish screen's second option. */
  framed?: boolean;
  tone?: SilhouetteTone;
  className?: string;
}) {
  const pad = Math.max(field.widthCm, field.heightCm) * PAD_FRACTION;
  const moulding = Math.max(sheet.widthCm, sheet.heightCm) * MOULDING_FRACTION;

  const boxW = field.widthCm + pad * 2;
  const boxH = field.heightCm + pad * 2;

  // Bottom-left of the field: the sheets stand on one line, the way three
  // prints leaning against a wall would.
  const x = pad;
  const y = pad + (field.heightCm - sheet.heightCm);

  return (
    <svg
      aria-hidden
      focusable="false"
      viewBox={`0 0 ${boxW} ${boxH}`}
      fill="none"
      stroke="currentColor"
      strokeWidth="1"
      className={cn('transition-house', TONE[tone], className)}
    >
      {framed ? (
        <rect
          x={x - moulding}
          y={y - moulding}
          width={sheet.widthCm + moulding * 2}
          height={sheet.heightCm + moulding * 2}
          fill="currentColor"
          fillOpacity="0.16"
          vectorEffect="non-scaling-stroke"
        />
      ) : null}
      <rect
        x={x}
        y={y}
        width={sheet.widthCm}
        height={sheet.heightCm}
        fill="currentColor"
        fillOpacity="0.07"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
