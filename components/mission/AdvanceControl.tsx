'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { MISSION_STAGES, STAGE_LABEL, stageIndex, type MissionStage } from '@/lib/types';

/**
 * DEMO CONTROL — mock mode only.
 *
 * Walks a mission one stage forward through /api/dev/advance so the whole
 * nine-stage file can be reviewed without waiting on a satellite.
 *
 * Deliberately amber, outside the product palette: nothing else in this
 * product is this colour, so it can never be mistaken for a customer control.
 * The value is the darker amber because this block sits on the paper ground
 * of the file-actions band — the lighter one only reaches 3:1 there.
 *
 * It never renders when MOCK_MODE is off.
 */

const AMBER_INK = '#8a5a12';
const AMBER_RULE = '#c8862a';

export function AdvanceControl({ code, stage }: { code: string; stage: MissionStage }) {
  const router = useRouter();
  const [status, setStatus] = useState<'idle' | 'working' | 'error'>('idle');

  const i = stageIndex(stage);
  const next = i < MISSION_STAGES.length - 1 ? MISSION_STAGES[i + 1] : null;

  async function advance() {
    if (!next) return;
    setStatus('working');
    try {
      const res = await fetch('/api/dev/advance', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ code }),
      });
      if (!res.ok) throw new Error(String(res.status));
      router.refresh();
      setStatus('idle');
    } catch {
      setStatus('error');
    }
  }

  return (
    <section
      aria-label="Simulation control"
      className="rounded-[12px] border border-l-2 p-5"
      style={{ borderColor: `${AMBER_RULE}66`, backgroundColor: `${AMBER_RULE}12` }}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
        <h3 className="text-label uppercase" style={{ color: AMBER_INK }}>
          Simulation only
        </h3>
        <span className="text-label uppercase" style={{ color: AMBER_INK }}>
          Mock mode
        </span>
      </div>

      <p className="mt-4 max-w-[46ch] text-body" style={{ color: AMBER_INK }}>
        This control is not part of the product. Mock mode is on, so the file can be stepped
        through every stage of the timeline by hand. A live mission advances on real events from
        the constellation and the print facility.
      </p>

      <button
        type="button"
        onClick={advance}
        disabled={!next || status === 'working'}
        aria-busy={status === 'working' || undefined}
        className="mt-6 inline-flex h-11 select-none items-center justify-center rounded-[6px] border px-5 text-action transition-house hover:-translate-y-px disabled:pointer-events-none disabled:opacity-45"
        style={{ borderColor: `${AMBER_RULE}80`, color: AMBER_INK }}
      >
        {status === 'working' ? 'Advancing' : next ? 'Advance mission' : 'File closed'}
      </button>

      <dl className="mt-6 flex flex-col gap-2">
        <div className="flex flex-wrap items-baseline gap-x-3">
          <dt className="text-label uppercase" style={{ color: AMBER_INK }}>
            Current
          </dt>
          <dd className="text-label uppercase" style={{ color: AMBER_INK }}>
            {STAGE_LABEL[stage]}
          </dd>
        </div>
        <div className="flex flex-wrap items-baseline gap-x-3">
          <dt className="text-label uppercase" style={{ color: AMBER_INK }}>
            Next
          </dt>
          <dd className="text-label uppercase" style={{ color: AMBER_INK }}>
            {next ? STAGE_LABEL[next] : 'None — mission delivered'}
          </dd>
        </div>
      </dl>

      {status === 'error' ? (
        <p
          role="alert"
          className="mt-5 rounded-[6px] border border-l-2 border-[color:color-mix(in_srgb,var(--accent)_45%,transparent)] bg-[color:color-mix(in_srgb,var(--accent)_6%,transparent)] px-4 py-3 text-body text-[color:var(--ink-dim)]"
        >
          Advance rejected. The demo endpoint did not accept the request — check that the
          development server is running in mock mode.
        </p>
      ) : null}
    </section>
  );
}
