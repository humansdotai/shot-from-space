'use client';

import { useState } from 'react';
import { clsx as cn } from 'clsx';
import { FieldError, INK, INK_DIM, INPUT_CLASS } from '@/components/purchase/fields';
import { MISSION_NAME_MAX, defaultMissionName } from '@/lib/mission-flow/config';
import { PanelGroup } from './Panel';

/**
 * NAME THE MISSION (was screen 4, now a group inside the Mission section).
 *
 * ------------------------------------------------------------------
 * WHY THERE IS NO LONGER A `NEXT` BUTTON HERE
 * ------------------------------------------------------------------
 * There used to be one, and the reason given was sound for a wizard:
 * typing has no moment of commitment the way a card tap does, so the
 * commitment had to be a control.
 *
 * In a configurator it does not need one, because the name is not being
 * submitted — it is being SET. The single primary action for the whole
 * surface lives in the panel foot, where it is the only button on the
 * screen, and a second one here would be competing with it.
 *
 * `Mission registered.` survives, as the live confirmation it always
 * read as, shown as soon as the name is one the flow will accept rather
 * than after a timed hold. It is the echo, and it is deliberately the
 * only one: the PRINT does not carry the mission name — <StyledPoster />
 * sets `MISSION / <code>` because that is what `sheetCopy()` puts on the
 * sheet that goes to the press. The name is on the file, the dossier and
 * every message about the mission, which is what the copy below says and
 * all it says.
 *
 * THE PREFILL. `MISSION [LASTNAME]-001` needs a surname, and this flow
 * deliberately has none — no account, no email, no name is collected
 * before payment. So the prefill is the documented fallback,
 * `MISSION 001`. `defaultMissionName()` takes a surname the moment one
 * exists; see the note in `lib/mission-flow/config.ts`.
 */
export function NameGroup({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const [draft, setDraft] = useState(value || defaultMissionName());
  const clean = draft.trim().replace(/\s+/g, ' ');
  const [touched, setTouched] = useState(false);
  const tooShort = clean.length < 3;

  const commit = (next: string) => {
    setDraft(next);
    const tidy = next.trim().replace(/\s+/g, ' ');
    // Only a name the flow would accept reaches the draft, so the print
    // and the file can never carry a two-character fragment mid-keystroke.
    if (tidy.length >= 3) onChange(tidy);
  };

  return (
    <PanelGroup
      label="Mission name"
      hint={`${draft.length} / ${MISSION_NAME_MAX}`}
      note={
        <span id="mission-name-note">
          It goes on the mission file, the dossier and every message about the mission — not on the
          print, which carries the mission code. The default is a sequence number: there is no name
          on file to build one from, because nothing is asked of you before payment.
        </span>
      }
    >
      {/* No <FieldLabel> here. <PanelGroup label="Mission name"> two lines
          above already names this field, and printing it twice read as a
          heading followed by its own echo. The input keeps a real accessible
          name via aria-label — dropping the visible label must not drop the
          association. */}
      <input
        id="mission-name"
        name="mission-name"
        aria-label="Mission name"
        type="text"
        className={cn(INPUT_CLASS, 'font-mono uppercase tracking-[0.08em]')}
        value={draft}
        maxLength={MISSION_NAME_MAX}
        autoComplete="off"
        aria-invalid={touched && tooShort ? true : undefined}
        aria-describedby={touched && tooShort ? 'mission-name-error' : 'mission-name-note'}
        onChange={(e) => commit(e.target.value)}
        onBlur={() => setTouched(true)}
      />

      {touched && tooShort ? (
        <FieldError id="mission-name-error">
          A mission needs a name of at least three characters.
        </FieldError>
      ) : (
        <p role="status" aria-live="polite" className={cn('pt-3 text-label uppercase', INK_DIM)}>
          Mission registered. <span data-telemetry className={cn('font-mono', INK)}>{clean}</span>
        </p>
      )}

    </PanelGroup>
  );
}
