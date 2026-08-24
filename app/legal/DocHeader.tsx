import { formatTelemetryDate } from '@/lib/utils';

/**
 * File header for a legal document: a numbered eyebrow, a revision stamp in
 * telemetry, the title at the display role and a one-paragraph summary.
 *
 * Local to /legal — these three documents are the only place it applies, and
 * it composes nothing but shell type roles and one hairline.
 */
export function DocHeader({
  index,
  title,
  revised,
  summary,
}: {
  index: string;
  title: string;
  revised: string;
  summary: string;
}) {
  return (
    <header className="border-b border-hairline pb-8">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
        <p className="text-label uppercase text-paper-faint">Legal file {index}</p>
        <span data-telemetry className="font-mono text-tele-s uppercase text-paper-faint">
          REVISED {formatTelemetryDate(revised)}
        </span>
      </div>
      <h1 className="mt-6 max-w-[20ch] text-display text-paper">{title}</h1>
      <p className="mt-5 max-w-[62ch] text-prose text-paper-dim">{summary}</p>
    </header>
  );
}
