'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useId, useRef, useState } from 'react';

import { Button, ButtonArrow } from '@/components/fui';
import { useBrowserLocation } from '@/components/purchase/UseMyLocation';
import { PRICE_FROM, SIZE_REFERENCE, tierPriceMinor } from '@/lib/mission-flow/config';
import { EARLIEST_HORIZON_DAYS } from '@/lib/mission-flow/state';
import { formatPrice } from '@/lib/pricing';
import type { GeoSuggestion } from '@/lib/types';
import { cn } from '@/lib/utils';

/**
 * THE ENTRY CONTROL — one address field, and the only way onto the funnel.
 *
 * It is mounted twice on the landing page: inside the hero, where a cold
 * visitor meets it before scrolling anything, and again in band 08
 * (<OrbitEntryBand />) on the photograph. Both mounts are this file, so the
 * two cannot drift: same debounce, same listbox semantics, same price line,
 * same destination.
 *
 * THE TWO MOUNTS USED TO BE ONE SCREEN APART — band 02 and band 03 — which
 * meant a reader met this field, this button and these three lines of fine
 * print twice inside a screen and a half. Band 03 has moved to 08; the two
 * are now 7,143px apart at 1440. See `app/page.tsx → WHERE ORBIT ENTRY
 * WENT`. Nothing in this file changed for it, which is the point of there
 * being one file.
 *
 * ------------------------------------------------------------------
 * WHERE IT GOES
 * ------------------------------------------------------------------
 * `/mission?address=…&lat=…&lon=…` — the configurator, which is the site's
 * funnel. All three parameters are optional at the far end
 * (`lib/mission-flow/entry.ts`); a submit with text but no fix still opens
 * the flow with the text as the target label.
 *
 * ------------------------------------------------------------------
 * THE FIELD
 * ------------------------------------------------------------------
 * Same behaviour as the target field in `components/purchase` — 250ms
 * debounce against `/api/geocode/autocomplete`, a keyboard-navigable
 * listbox, ARIA combobox roles — but written here rather than shared,
 * because that field belongs to another screen and lifting it out would be
 * a refactor of it. The only contract either one depends on is the public
 * route and the `GeoSuggestion` shape.
 *
 * Picking a suggestion does NOT navigate: this field ends in a button, so a
 * selection locks the fix and the reader presses on. Typing after a
 * selection releases it, and a submit with no selection geocodes the raw
 * text first.
 *
 * ------------------------------------------------------------------
 * THE CONTROL INSIDE THE FIELD
 * ------------------------------------------------------------------
 * `Your location` sits INSIDE the input, at its right edge, and fills the
 * field from the browser's own fix. The behaviour is
 * `useBrowserLocation()` in `components/purchase/UseMyLocation.tsx` — the
 * same code the purchase flow uses, including the two fixes recorded there
 * (re-arming the alive ref for StrictMode, and coarse accuracy so an indoor
 * device is not left waiting on a GPS lock that never comes).
 *
 * Three things this had to get right, and how:
 *
 *   IT NEVER SITS ON TYPED TEXT. The input reserves its width as padding
 *   (`--locate-pad`), so text scrolls under the caret and stops at the
 *   control's edge instead of running beneath it.
 *
 *   IT IS 44 x 44. `h-11 min-w-11`, inset 6px inside a 56px field.
 *
 *   ITS NAME IS ALWAYS CORRECT. Below 390px the field is too narrow to
 *   carry both the placeholder and a worded control — at 320 the input is
 *   256px wide — so the word is dropped and the mark stands alone, with
 *   `aria-label` and `title` carrying the same name it has at every wider
 *   width. Nothing about the target, the behaviour or the accessible name
 *   changes; only the visible word does.
 *
 * Geolocation needs a user gesture and a secure context. There is no
 * spinner-forever state: a refusal, a timeout, a fix with no street
 * address and an index that will not answer each produce one plain
 * sentence in the live region under the field, and the field stays typable
 * throughout. Where the capability does not exist at all the control is not
 * rendered, because a control that can never work is worse than none.
 */

/**
 * The cheapest COMMISSION the flow behind this button can actually charge —
 * `tierPriceMinor()` at the reference size, which is the same function
 * `app/api/orders/route.ts` prices an order with. Computed once at module
 * scope: it depends on nothing that changes per render.
 */
const COMMISSION_FROM_MINOR = tierPriceMinor(
  'COMMISSION',
  SIZE_REFERENCE.formatId,
  SIZE_REFERENCE.frame,
  'EUR',
);

/** Below this the address index is not worth querying. */
const MIN_QUERY = 3;
const DEBOUNCE_MS = 250;

/** The public route the purchase flow's target field calls. */
const AUTOCOMPLETE = '/api/geocode/autocomplete';

/**
 * One call to the address index. A failure is an empty list, never an
 * exception: the field must degrade to "type it and press the button", which
 * still opens a mission with the raw text as its target.
 */
async function lookup(q: string, signal?: AbortSignal): Promise<GeoSuggestion[]> {
  const res = await fetch(AUTOCOMPLETE, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ q }),
    signal,
  });
  if (!res.ok) return [];
  const body = (await res.json()) as { suggestions?: GeoSuggestion[] };
  return Array.isArray(body.suggestions) ? body.suggestions : [];
}

/**
 * `/mission?address=…&lat=…&lon=…&from=…`. The fix is omitted when there
 * isn't one, and `from` is omitted for "first available" — which is the
 * default, so the common URL is unchanged.
 *
 * `from` is a PREFERENCE, not an instruction. `/mission` re-validates it
 * on arrival (`earliestFromSearch`) and drops anything past, malformed or
 * beyond the horizon back to first-available, so a hand-typed URL cannot
 * put the flow into a state it cannot honour.
 */
export function missionHref(
  address: string,
  fix?: { lat: number; lon: number },
  earliest?: string | null,
): string {
  const params = new URLSearchParams({ address });
  if (fix) {
    params.set('lat', fix.lat.toFixed(6));
    params.set('lon', fix.lon.toFixed(6));
  }
  if (earliest) params.set('from', earliest);
  return `/mission?${params.toString()}`;
}

/**
 * 56px tall, 16px type — the threshold below which iOS zooms on focus.
 *
 * `--locate-pad` is the right inset the in-field control occupies. It is
 * declared once, on the field, and the control is positioned inside it; the
 * two therefore cannot disagree about where the text has to stop.
 */
const FIELD = cn(
  'block h-14 w-full rounded-[var(--radius-action)] border pl-4 text-[1rem] leading-none',
  /*
    THE RESERVATION HAS TO GROW WITH THE CONTROL, AND IT DID NOT.
    `Your location` is set in `text-label`, and that role steps 12 → 13 → 14
    → 15px up the scale (app/globals.css). Measured, the control is 152px
    wide at 390, 161 at 1280, 170 at 1920 and 178 at 2400, and it is inset
    6px from the field's right edge — so a single 9.75rem (156px) reservation
    was already 2px short at 390 and 28px short at 2400, where the
    placeholder ran under the control. Each step below is the measured
    control plus its inset plus 6px of air.
  */
  '[--locate-pad:3.75rem] min-[390px]:[--locate-pad:10.25rem]',
  'min-[1280px]:[--locate-pad:10.75rem] min-[1920px]:[--locate-pad:11.25rem]',
  'min-[2400px]:[--locate-pad:11.75rem]',
  'pr-[var(--locate-pad)]',
  'bg-[color:var(--ground)] border-[color:var(--rule)] text-[color:var(--ink)]',
  'placeholder:text-[color:var(--ink-faint)]',
  'transition-house hover:border-[color:var(--rule-strong)] focus:border-[color:var(--ink)]',
);

/** A locate mark: the reticle, drawn at 1px like every other glyph here. */
function LocateGlyph() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden className="shrink-0">
      <circle cx="7" cy="7" r="3.75" stroke="currentColor" strokeWidth="1.25" />
      <circle cx="7" cy="7" r="1" fill="currentColor" />
      <path
        d="M7 0v2.25M7 11.75V14M0 7h2.25M11.75 7H14"
        stroke="currentColor"
        strokeWidth="1.25"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

export function MissionEntry({
  className,
  inputId,
}: {
  className?: string;
  /** Stable id, so the two mounts never collide and either can be linked to. */
  inputId: string;
}) {
  const router = useRouter();
  const listId = useId();
  const statusId = useId();
  const privacyId = useId();
  const whenName = useId();
  const dateId = useId();
  const dateNoteId = useId();

  /* --- WHEN ------------------------------------------------------------
     "first" is the default and it is the honest one: the mission flies on
     the next clear pass, which is the only timing this system can speak
     about. "date" names the EARLIEST capture the buyer will accept, and
     every string attached to it says earliest rather than promising it —
     see the note on `MissionDraft.earliest`. */
  const [when, setWhen] = useState<'first' | 'date'>('first');
  const [fromDate, setFromDate] = useState('');
  /* Computed in an effect, never during render: `new Date()` differs
     between the server and the client and would put a hydration mismatch
     on the `min`/`max` attributes of the date field. */
  const [dateBounds, setDateBounds] = useState<{ min: string; max: string } | null>(null);

  useEffect(() => {
    const now = new Date();
    const day = (offset: number) =>
      new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + offset))
        .toISOString()
        .slice(0, 10);
    setDateBounds({ min: day(0), max: day(EARLIEST_HORIZON_DAYS) });
  }, []);

  /** What travels to `/mission`. Null unless a usable date was named. */
  const earliest = when === 'date' && fromDate ? fromDate : null;
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  /** Set when the field is filled by a selection rather than by typing. */
  const quietRef = useRef(false);

  const [query, setQuery] = useState('');
  const [picked, setPicked] = useState<GeoSuggestion | null>(null);
  const [suggestions, setSuggestions] = useState<GeoSuggestion[]>([]);
  const [highlight, setHighlight] = useState(-1);
  const [submitting, setSubmitting] = useState(false);

  const close = useCallback(() => {
    setSuggestions([]);
    setHighlight(-1);
  }, []);

  /**
   * A browser fix that resolved to a real address fills the field and locks
   * the target, exactly as picking a suggestion does. `quietRef` stops the
   * debounce from immediately re-querying the text it was just handed.
   */
  const onLocated = useCallback(
    (s: GeoSuggestion) => {
      abortRef.current?.abort();
      quietRef.current = true;
      setQuery(s.label);
      setPicked(s);
      close();
      inputRef.current?.focus();
    },
    [close],
  );

  const locate = useBrowserLocation(onLocated);

  /* Debounced query against the address index. Identical timing to the
     purchase flow's target field, so the two feel like one control. */
  useEffect(() => {
    if (quietRef.current) {
      quietRef.current = false;
      return;
    }

    const q = query.trim();
    if (q.length < MIN_QUERY) {
      abortRef.current?.abort();
      setSuggestions([]);
      setHighlight(-1);
      return;
    }

    const timer = window.setTimeout(async () => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      try {
        const data = await lookup(q, controller.signal);
        if (controller.signal.aborted) return;
        setSuggestions(data);
        setHighlight(-1);
      } catch {
        /* aborted, or the index is down — the button still opens a mission */
      }
    }, DEBOUNCE_MS);

    return () => window.clearTimeout(timer);
  }, [query]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const select = useCallback(
    (s: GeoSuggestion) => {
      abortRef.current?.abort();
      quietRef.current = true;
      setQuery(s.label);
      setPicked(s);
      close();
      inputRef.current?.focus();
    },
    [close],
  );

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!suggestions.length) {
      if (e.key === 'Escape') setQuery('');
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlight((h) => (h + 1) % suggestions.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlight((h) => (h <= 0 ? suggestions.length - 1 : h - 1));
    } else if (e.key === 'Enter') {
      if (highlight >= 0) {
        e.preventDefault();
        select(suggestions[highlight]);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      close();
    }
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    if (!q) {
      inputRef.current?.focus();
      return;
    }
    if (picked) {
      router.push(missionHref(picked.label, picked, earliest));
      return;
    }

    /* Typed but never selected: take the index's best answer for the raw
       text, and open the mission with the text alone if it has none. */
    setSubmitting(true);
    let top: GeoSuggestion | undefined;
    try {
      top = (await lookup(q))[0];
    } catch {
      /* index down — fall through with no fix */
    }
    router.push(top ? missionHref(top.label, top, earliest) : missionHref(q, undefined, earliest));
  };

  const expanded = suggestions.length > 0;

  /** Idle says what pressing it will do; every other phase says what happened. */
  const locateNote =
    locate.message ??
    (locate.phase === 'locating'
      ? 'Asking your browser for a fix.'
      : locate.phase === 'resolving'
        ? 'Turning that fix into a street address.'
        : 'Your browser asks before sharing your location.');

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      /*
        `@container`, NOT a viewport breakpoint. This control is mounted in
        two places whose widths do not follow the viewport in the same way:
        the hero's rail at 1280 and up is a 370–500px column inside a 1440px
        screen, where a field and a button side by side would leave the
        address 200px to be typed in. The row therefore flips on the FORM'S
        own width — 40rem, a 640px form — so the control reads its
        own space instead of guessing at the page's. 40rem is the width at
        which the field still has 230px to type in AFTER the button and the
        in-field control have taken theirs.
      */
      className={cn('group/entry @container max-w-[36rem] min-[768px]:max-w-[42rem]', className)}
    >
      <div className="flex flex-col gap-3 @min-[40rem]:flex-row @min-[40rem]:items-center">
        <div
          className="relative min-w-0 flex-1"
          onBlur={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget as Node | null)) close();
          }}
        >
          <input
            ref={inputRef}
            id={inputId}
            type="text"
            inputMode="text"
            autoComplete="street-address"
            autoCapitalize="words"
            autoCorrect="off"
            spellCheck={false}
            role="combobox"
            aria-expanded={expanded}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={highlight >= 0 ? `${listId}-${highlight}` : undefined}
            aria-label="Your address"
            aria-describedby={privacyId}
            placeholder="Enter your address"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPicked(null);
            }}
            onKeyDown={onKeyDown}
            className={FIELD}
          />

          {/* The control inside the field. Rendered only where geolocation
              can actually run — see the note at the top of this file. */}
          {locate.supported ? (
            <button
              type="button"
              onClick={locate.request}
              disabled={locate.busy}
              aria-describedby={statusId}
              aria-label="Use your location"
              title="Use your location"
              className={cn(
                'absolute right-1.5 top-1.5 inline-flex h-11 min-w-11 items-center justify-center gap-2 px-3',
                'rounded-[var(--radius-action)] border border-[color:var(--rule)]',
                'bg-[color:color-mix(in_srgb,var(--ink)_5%,transparent)] text-[color:var(--ink-dim)]',
                'text-label uppercase transition-house',
                'hover:border-[color:var(--rule-strong)] hover:bg-[color:color-mix(in_srgb,var(--ink)_10%,transparent)] hover:text-[color:var(--ink)]',
                'disabled:opacity-60 disabled:hover:bg-[color:color-mix(in_srgb,var(--ink)_5%,transparent)]',
              )}
            >
              <LocateGlyph />
              <span className="hidden whitespace-nowrap min-[390px]:inline">
                {locate.phase === 'locating'
                  ? 'Asking…'
                  : locate.phase === 'resolving'
                    ? 'Resolving…'
                    : 'Your location'}
              </span>
            </button>
          ) : null}

          <p aria-live="polite" className="sr-only">
            {expanded ? `${suggestions.length} address matches` : ''}
          </p>

          {/* Solid ground, one hairline, 64px rows. A list floating over a
              photograph has to be opaque; nothing else here is. */}
          {expanded ? (
            <ul
              id={listId}
              role="listbox"
              aria-label="Address matches"
              className="absolute inset-x-0 top-full z-20 mt-2 max-h-[19rem] overflow-y-auto rounded-[var(--radius-card)] border rule-ground bg-void"
            >
              {suggestions.map((s, i) => (
                <li key={s.id} role="none" className="border-t rule-ground first:border-t-0">
                  <button
                    type="button"
                    id={`${listId}-${i}`}
                    role="option"
                    aria-selected={i === highlight}
                    onMouseEnter={() => setHighlight(i)}
                    onClick={() => select(s)}
                    className={cn(
                      'flex min-h-16 w-full flex-col items-start justify-center gap-1.5 px-4 py-3 text-left transition-house',
                      'hover:bg-[color:color-mix(in_srgb,var(--ink)_6%,transparent)]',
                      i === highlight && 'bg-[color:color-mix(in_srgb,var(--ink)_8%,transparent)]',
                    )}
                  >
                    <span className="w-full truncate text-body ink">{s.line1}</span>
                    <span className="w-full truncate text-label uppercase ink-dim">
                      {[s.city, s.region, s.postalCode, s.country].filter(Boolean).join(' / ')}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        <Button
          type="submit"
          variant="primary"
          size="lg"
          loading={submitting}
          trailing={<ButtonArrow />}
          className="w-full @min-[40rem]:w-auto @min-[40rem]:shrink-0"
        >
          Begin your mission
        </Button>
      </div>

      {/* =================================================================
          WHEN — the second thing named at the door, after the place.

          THE DEFAULT IS "FIRST AVAILABLE" AND THAT IS NOT A UI PREFERENCE.
          It is the only timing this system can speak about: the pass
          geometry is fixed by the orbit, cloud decides the rest, and
          `lib/satellites/propagate.ts` can say when a spacecraft is over a
          coordinate but nothing can say when the sky will be clear. So the
          mode that promises nothing is the one selected on arrival.

          A NAMED DATE IS AN EARLIEST, NOT A DELIVERY DATE, and every
          string here says so — the control is labelled "Take it", the
          option reads "On or after", and the note under it states in one
          sentence that it selects among real computed windows rather than
          booking one. The Window section is where this lands: it opens on
          the first PROPAGATED window falling on or after this date, and
          says plainly when none of them does. It never invents a window.

          REAL RADIOS, not buttons wearing `role="radio"`. Two `<input
          type="radio">` in a `<fieldset>` give arrow-key traversal, the
          group's accessible name, and the checked state to assistive tech
          for free, and none of that has to be re-implemented or kept
          correct by hand. They are `sr-only` and the visible chip is the
          adjacent `<span>`, so the focus ring is drawn with
          `peer-focus-visible`.
          ================================================================= */}
      <fieldset className="mt-3 min-w-0 border-0 p-0">
        <legend className="sr-only">When the frame is taken</legend>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <span aria-hidden className="text-label uppercase ink-faint">
            Take it
          </span>

          {(
            [
              ['first', 'At the first pass'],
              ['date', 'On or after'],
            ] as const
          ).map(([value, label]) => (
            <label key={value} className="inline-flex cursor-pointer items-center">
              <input
                type="radio"
                name={whenName}
                value={value}
                checked={when === value}
                onChange={() => setWhen(value)}
                className="peer sr-only"
              />
              <span
                className={cn(
                  /* 44px tall so the target clears 2.5.8 even though the
                     label is 13px type. */
                  'inline-flex h-11 items-center rounded-[var(--radius-action)] border px-3',
                  'text-label uppercase transition-house',
                  'border-[color:var(--rule)] text-[color:var(--ink-dim)]',
                  'hover:border-[color:var(--rule-strong)] hover:text-[color:var(--ink)]',
                  'peer-checked:border-[color:var(--rule-strong)]',
                  'peer-checked:bg-[color:color-mix(in_srgb,var(--ink)_10%,transparent)]',
                  'peer-checked:text-[color:var(--ink)]',
                  'peer-focus-visible:outline peer-focus-visible:outline-2',
                  'peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[color:var(--accent)]',
                )}
              >
                {label}
              </span>
            </label>
          ))}

          {/* Rendered only once the buyer asks for it, which also means it
              is never server-rendered — so `min`/`max`, which are derived
              from today's date, cannot mismatch on hydration. */}
          {when === 'date' ? (
            <input
              type="date"
              id={dateId}
              aria-label="Earliest capture date"
              aria-describedby={dateNoteId}
              value={fromDate}
              min={dateBounds?.min}
              max={dateBounds?.max}
              onChange={(e) => setFromDate(e.target.value)}
              className={cn(
                /* 16px type: below that iOS zooms the whole page on focus. */
                'h-11 min-w-[10rem] rounded-[var(--radius-action)] border px-3 text-[1rem]',
                'border-[color:var(--rule)] bg-transparent text-[color:var(--ink)]',
                'hover:border-[color:var(--rule-strong)]',
                'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2',
                'focus-visible:outline-[color:var(--accent)]',
              )}
            />
          ) : null}
        </div>

        {/* THE HONESTY LINE, and it only appears in the mode that needs
            one. "First available" needs no caveat because it claims
            nothing. A named date does, and the caveat is the whole truth
            in one sentence: it chooses among real windows, it is not a
            booking, and nothing here knows what the sky will do. */}
        {when === 'date' ? (
          <p id={dateNoteId} className="mt-2 max-w-[52ch] text-label ink-dim">
            The earliest date you will accept, not a delivery date. The mission opens on the first
            computed pass on or after it; cloud decides the rest.
          </p>
        ) : null}
      </fieldset>

      {/* The location control's live region. It always holds a sentence, so
          nothing on the page moves when a fix fails — and the sentence in
          the resting state is the warning that pressing the control hands
          an OS-level prompt to a stranger's browser. */}
      {locate.supported ? (
        <p
          id={statusId}
          role="status"
          aria-live="polite"
          className={cn(
            /* AT REST IT IS THE BUTTON'S DESCRIPTION, NOT THE PAGE'S COPY.
               "Your browser asks before sharing your location" used to be a
               permanent paragraph in the first viewport — standing help
               text for one control, read by every visitor whether or not
               they ever look at that control. It is help, so it belongs to
               the thing it helps: the button already carries
               `aria-describedby={statusId}`, so `sr-only` keeps it
               announced on focus and takes it out of the reading.

               `sr-only` and NOT `hidden`: a `display: none` target is
               dropped from the accessibility tree and the description
               would be silently lost.

               The moment the control is actually used the phase leaves
               `idle` and the line becomes visible copy, which is when a
               sentence about the browser's permission prompt is worth
               anything. 8px below 360, 12px from there up — see THE 320
               CONCESSION under the price line. */
            locate.phase === 'idle' && !locate.message
              ? 'sr-only'
              : 'mt-2 max-w-[52ch] text-label min-[360px]:mt-3',
            locate.phase === 'idle' && !locate.message ? '' : locate.message ? 'ink' : 'ink-dim',
          )}
        >
          {locateNote}
        </p>
      ) : null}

      {/*
        BOTH LINES ARE READ FROM SOURCE, NOT TYPED.

        They used to be typed, and both were false. "Money-back guarantee"
        dropped the two conditions the actual guarantee carries — a usable
        frame, and a 60-day window — and read as refund-on-request;
        `lib/guarantees.ts` exists because that exact class of paraphrase was
        found fourteen times. And "Never shared" is contradicted by this
        site's own privacy page and by `lib/integrations/gelato.ts`, which
        posts the address to the print facility so the parcel can be
        addressed.

        THE PRICE LINE NAMES WHAT EACH NUMBER BUYS, and that is the whole
        point of it. It used to read "Missions from €79". €79 is real — it is
        `PRICE_FROM`, checked in `lib/mission-flow/config.ts` against every
        configuration the flow can charge — but it is the ARCHIVE tier at the
        reference size, and the flow this button opens defaults to COMMISSION
        at F50, which is €279. So a stranger read €79 under a photograph of a
        commissioned print, clicked, and watched the number multiply by three
        and a half before making a single choice. Unexpected cost at the step
        after the click is Baymard's most-cited stated reason for abandoning a
        basket, and one unqualified number was manufacturing it here.

        Two numbers, both derived, neither typed: `PRICE_FROM` for the
        archive, and `tierPriceMinor()` at `SIZE_REFERENCE` for a commission —
        the same function `app/api/orders/route.ts` charges with. This is
        `/how-it-works`'s construction exactly (see `PriceTerms` there); it
        was right on that page and this control is mounted twice on the
        landing page, so the two surfaces now say the same thing.

        NOT FIXED HERE, deliberately: `PricingBand` still publishes the print
        catalogue (€170 at 30 × 40) which `/mission` cannot charge at any
        size. Unifying the two price lists is INTEGRATIONS.md §10 and the
        owner's call, not this file's.
      */}
      {/*
        THE 320 CONCESSION — 8px between these three lines below 360, 12px
        from 360 up.

        This control's three trailing lines are the last thing in the hero's
        funnel, and CONFIGURATOR.md §3.1 puts all of it inside the first
        viewport at 320 x 568. That is the tightest cell on the whole site:
        the announcement strip has already taken 113 of the 568, and what is
        left has to carry a headline, a 56px field, a 52px button and these
        three paragraphs. Measured at 320 the price line wraps to four lines
        of 13px type, and with 12px gaps the privacy line ended at 569 — one
        pixel past the fold.

        Three gaps at 8px instead of 12 buys 12px back and the privacy line
        ends at 557. Nothing is dropped, no copy is shortened and no type
        gets smaller; the only thing that changes is the leading between
        three microlines on the narrowest phone there is. It joins the two
        concessions <HeroBand /> already documents for that one cell — the
        clause hidden below 360, the headline at `text-display` below 768 —
        and like both of those it is bought straight back at 360.

        WRAPPING IS FONT-DEPENDENT, so this is a floor rather than a fix for
        one measurement: the line runs to four rendered lines here and three
        on a stack with narrower digits, and the gap has to hold in the worse
        of the two.
      */}
      {/* THE TWO GUARANTEE CLAUSES ARE NO LONGER HERE, and nothing was
          dropped by removing them. This line used to run
          "… · Cloud-blocked passes re-tasked free · Full refund if no
          usable frame in 60 days", which put a four-fact sentence under
          the one control in the first viewport. Both promises are
          published IN FULL further down this same page — all five in
          `PricingBand`'s guarantee block, and again as `GuaranteeStrip`
          in `ClosingBand`, both from `lib/guarantees.ts` — so the fold
          was repeating, at its most expensive moment, something the page
          says properly twice.

          THE PRICES STAY, and they stay for the reason written at length
          above: two derived numbers, because one unqualified €79 under a
          photograph of a commissioned print manufactured exactly the
          sticker shock Baymard names as the most-cited reason a basket is
          abandoned. Sticker shock is a fold problem. A refund window is
          not. */}
      <p className="mt-2 max-w-[56ch] text-note ink-dim min-[360px]:mt-3">
        Archive frames from €{PRICE_FROM} · commissions from{' '}
        {formatPrice(COMMISSION_FROM_MINOR, 'EUR')}
      </p>

      {/* THE ADDRESS PROMISE, MOVED ONTO THE FIELD IT IS ABOUT.
          It was a standing paragraph too. It is the answer to a question
          nobody has yet been asked — "why does a print shop want my
          street?" — and it is only asked once someone is typing a street
          into the box. So it is the field's own description: announced
          the moment the field takes focus, and revealed visually at the
          same moment.

          `sr-only` rather than `hidden`, for the same reason as the
          location note: a `display: none` description is not announced.
          It un-clips on `focus-within` so it is legible to a sighted
          person exactly when a screen reader would be speaking it.

          Nothing about the promise itself is softened: the wording is
          unchanged, and it still says the address goes to the print
          facility, which is what `lib/integrations/gelato.ts` actually
          does with it. */}
      <p
        id={privacyId}
        className={cn(
          'max-w-[52ch] text-label ink-dim',
          'sr-only group-focus-within/entry:not-sr-only',
          'group-focus-within/entry:mt-2 min-[360px]:group-focus-within/entry:mt-3',
        )}
      >
        Your address locates the capture and addresses the parcel. It goes to the print facility
        for that, and nowhere else.
      </p>
    </form>
  );
}
