import { cn } from '@/lib/utils';

/**
 * A single horizontal sweep across a plate — the "acquiring" gesture.
 *
 * Decorative and `aria-hidden`. It is the one motion primitive in the system:
 * there is no spinner, no bounce, no marquee. Absolutely positioned, so the
 * parent must be `relative` (and normally `overflow-hidden`).
 *
 * `prefers-reduced-motion` is honoured globally (globals.css collapses the
 * duration), which leaves the sweep parked out of frame — nothing flashes.
 */
export function ScanSweep({
  tone = 'paper',
  repeat = false,
  className,
}: {
  tone?: 'paper' | 'signal';
  /** Loop while a state is pending. Default is a single pass. */
  repeat?: boolean;
  className?: string;
}) {
  const color = tone === 'signal' ? 'var(--color-signal)' : 'var(--color-paper)';
  return (
    <span
      aria-hidden
      className={cn(
        'pointer-events-none absolute inset-y-0 left-0 z-10 w-full',
        repeat ? 'animate-sweep-loop' : 'animate-sweep-once',
        className,
      )}
      style={{
        backgroundImage: `linear-gradient(90deg, transparent 0%, color-mix(in srgb, ${color} 8%, transparent) 48%, color-mix(in srgb, ${color} 14%, transparent) 50%, color-mix(in srgb, ${color} 8%, transparent) 52%, transparent 100%)`,
      }}
    />
  );
}
