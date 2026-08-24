import { cn } from '@/lib/utils';

/**
 * Registration / crop corner marks. Absolutely positioned inside a
 * `relative` parent. Purely decorative — hidden from assistive tech.
 */
export function CropMarks({
  className,
  length = 14,
  inset = 0,
  tone = 'paper',
}: {
  className?: string;
  /** Arm length in px. */
  length?: number;
  /** Distance from the parent edge in px. */
  inset?: number;
  tone?: 'paper' | 'signal';
}) {
  const color = tone === 'signal' ? 'var(--color-signal)' : 'var(--color-paper)';
  const corners = [
    { top: inset, left: inset, rotate: 0 },
    { top: inset, right: inset, rotate: 90 },
    { bottom: inset, right: inset, rotate: 180 },
    { bottom: inset, left: inset, rotate: 270 },
  ];
  return (
    <div aria-hidden className={cn('pointer-events-none absolute inset-0 z-10', className)}>
      {corners.map((c, i) => (
        <span
          key={i}
          style={{
            position: 'absolute',
            top: c.top,
            left: c.left,
            right: c.right,
            bottom: c.bottom,
            width: length,
            height: length,
            transform: `rotate(${c.rotate}deg)`,
            transformOrigin: 'center',
            borderTop: `1px solid ${color}`,
            borderLeft: `1px solid ${color}`,
            opacity: 0.55,
          }}
        />
      ))}
    </div>
  );
}
