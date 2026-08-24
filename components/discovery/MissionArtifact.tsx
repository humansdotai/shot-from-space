import { Artifact3D } from '@/components/artifact';
import { cn } from '@/lib/utils';

/**
 * A physical mission artifact on a dossier page.
 *
 * Delegates entirely to `Artifact3D` so the tilt, the damping and the cast
 * shadow are one implementation rather than two that drift apart. The
 * difference here is the light: on a dossier the object reads as mounted
 * proud of a white wall, so it takes the `wall` cast — dropped further,
 * spread much wider and far lighter than the contact shadow used where the
 * object is lying on a surface.
 */
export function MissionArtifact({
  src,
  alt,
  label,
  detail,
  className,
  priority = false,
}: {
  src: string;
  alt: string;
  label: string;
  detail: string;
  className?: string;
  /** Accepted for call-site compatibility; the artifact sizes itself. */
  sizes?: string;
  priority?: boolean;
}) {
  return (
    <Artifact3D
      src={src}
      alt={alt}
      label={label}
      caption={detail}
      surface="wall"
      priority={priority}
      className={cn('max-w-[300px]', className)}
    />
  );
}
