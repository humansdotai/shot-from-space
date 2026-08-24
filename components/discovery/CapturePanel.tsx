import Image from 'next/image';
import { cn } from '@/lib/utils';

/**
 * A CAPTURE, ON ITS OWN GROUND.
 *
 * The dark half of everything in the archive: one frame filling its panel,
 * a legibility gradient at the foot and at most two readouts sitting on it —
 * a sans label on the left, one line of telemetry on the right.
 *
 * It carries `surface-dark` itself rather than relying on its band, so it can
 * be dropped into the paper half of a split section (SYSTEM-V3 §5.5) and
 * still obey the rule that photographs are shown on the dark ground.
 *
 * `magnify` scales the source inside the crop: the same capture, read closer.
 * It is a display magnification and the readout says so.
 */
export function CapturePanel({
  src,
  alt,
  label,
  meta,
  magnify,
  position = 'center',
  priority = false,
  sizes = '100vw',
  className,
}: {
  src: string;
  alt: string;
  /** Sans label, low left. */
  label?: string;
  /** One line of telemetry, low right. Monospace. */
  meta?: string;
  /** Display magnification, e.g. 1.75. Omit for the plain crop. */
  magnify?: number;
  /** `object-position`, for a detail that is not at the centre of the frame. */
  position?: string;
  priority?: boolean;
  sizes?: string;
  className?: string;
}) {
  return (
    <div className={cn('surface-dark relative isolate overflow-hidden', className)}>
      <Image
        src={src}
        alt={alt}
        fill
        priority={priority}
        sizes={sizes}
        className="object-cover"
        style={{
          objectPosition: position,
          ...(magnify ? { transform: `scale(${magnify})` } : null),
        }}
      />

      {label || meta ? (
        <>
          <div
            aria-hidden
            className="absolute inset-x-0 bottom-0 h-28 bg-linear-to-t from-void/85 to-transparent min-[1280px]:h-36"
          />
          {/* The gutter is 32px; a notched device in landscape has 47-59px
              of side inset, so this rail's place name and date sat under the
              sensor housing. `max()` keeps the designed gutter on every
              device that has no cutout. */}
          <div className="absolute inset-x-0 bottom-0 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 pl-[max(var(--gutter-shell),var(--safe-inset-left))] pr-[max(var(--gutter-shell),var(--safe-inset-right))] pb-6 min-[1280px]:px-12 min-[1280px]:pb-8 min-[1920px]:px-16 min-[1920px]:pb-10">
            {label ? <p className="text-label uppercase text-paper/75">{label}</p> : null}
            {meta ? (
              <span
                data-telemetry
                className="font-mono text-[0.75rem] uppercase tracking-[0.12em] text-paper/70"
              >
                {meta}
              </span>
            ) : null}
          </div>
        </>
      ) : null}
    </div>
  );
}
