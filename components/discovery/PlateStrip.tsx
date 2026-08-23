import { Band } from '@/components/fui';
import { CapturePanel } from './CapturePanel';

/**
 * A full-bleed plate at zero padding — the dark band that breaks the rhythm
 * between two paper ones. The section opts out of the content column
 * (SYSTEM-V3 §1); the readouts inside it keep the page gutter.
 *
 * The height is set at each breakpoint rather than interpolated, because a
 * strip that simply grows with the window stops being a horizon and starts
 * being a picture: 300 → 380 → 440 → 480 → 540 → 620.
 */
const HEIGHT =
  'h-[300px] min-[768px]:h-[380px] min-[1280px]:h-[440px] min-[1440px]:h-[480px]' +
  ' min-[1920px]:h-[540px] min-[2400px]:h-[620px]';

export function PlateStrip({
  src,
  alt,
  label,
  meta,
  magnify,
}: {
  src: string;
  alt: string;
  /** Label printed low-left over the plate. */
  label?: string;
  /** One line of telemetry, printed low-right. Monospace. */
  meta?: string;
  /** Display magnification, e.g. 1.75. Omit for the plain crop. */
  magnify?: number;
}) {
  return (
    <Band top="flush" bottom="flush" tone="dark">
      <CapturePanel
        src={src}
        alt={alt}
        label={label}
        meta={meta}
        magnify={magnify}
        sizes={magnify ? `${Math.round(magnify * 100)}vw` : '100vw'}
        className={`w-full ${HEIGHT}`}
      />
    </Band>
  );
}
