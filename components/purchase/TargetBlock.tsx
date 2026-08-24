'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { Button } from '@/components/fui';
import type { GeoSuggestion, TargetAddress } from '@/lib/types';
import { clsx as cn } from 'clsx';
import { fetchSuggestions } from './api';
import { COUNTRIES } from './countries';
import {
  ErrorPlate,
  FieldError,
  FieldLabel,
  INK,
  INK_DIM,
  INPUT_CLASS,
  QUIET_BUTTON,
  RULE,
} from './fields';
import { isLatitude, isLongitude } from './state';
import { StepAction } from './StepAction';
import { UseMyLocation } from './UseMyLocation';

/** Below this the index is not worth querying. */
const MIN_QUERY = 3;
const DEBOUNCE_MS = 250;

interface ManualForm {
  line1: string;
  line2: string;
  city: string;
  region: string;
  postalCode: string;
  countryCode: string;
  lat: string;
  lon: string;
}

const EMPTY_MANUAL: ManualForm = {
  line1: '',
  line2: '',
  city: '',
  region: '',
  postalCode: '',
  countryCode: 'US',
  lat: '',
  lon: '',
};

/**
 * TARGET — the one gate in the briefing.
 *
 * A whole screen for one field. It is debounced against the geocoder, with a
 * keyboard-navigable list of results underneath; taking a result locks the
 * target and the sequence advances on that selection, with no confirm step in
 * between. Results are rows, not cards: a 64px row is a faster and more
 * forgiving target on a phone than a tile in a grid, and it does not need a
 * box drawn round it to read as a list.
 *
 * A quiet manual path is always available for addresses the index does not
 * carry, and it doubles as the recovery path when the index is down. That
 * path is a nine-field form, so its control is pinned to the foot of the
 * viewport rather than parked under the last field, where it was below the
 * fold at every width. The search path needs no pinned control — the first
 * match IS the control, and the list is tightened just enough that its first
 * row lands inside a 568px screen. See <StepAction />.
 *
 * The screen's own heading is the question, so the field carries an
 * `aria-label` rather than a second visible label saying the same thing.
 */
export function TargetBlock({
  initialQuery = '',
  onLock,
}: {
  /** Pre-fills the field when an already-locked target is re-opened for editing. */
  initialQuery?: string;
  onLock: (address: TargetAddress) => void;
}) {
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  /* A pre-filled field must not fire a query before the reader has typed. */
  const typedRef = useRef(initialQuery.length === 0);

  const [query, setQuery] = useState(initialQuery);
  const [suggestions, setSuggestions] = useState<GeoSuggestion[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [indexError, setIndexError] = useState<string | null>(null);
  const [highlight, setHighlight] = useState(-1);

  const [manual, setManual] = useState(false);
  const [form, setForm] = useState<ManualForm>(EMPTY_MANUAL);
  const [manualErrors, setManualErrors] = useState<Partial<Record<keyof ManualForm, string>>>({});
  const [resolving, setResolving] = useState(false);
  const [resolveNote, setResolveNote] = useState<string | null>(null);

  /* Autofocus on pointer devices only. Never steal focus on a phone: it
     raises the keyboard over the page before the reader has seen it. */
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const pointer = window.matchMedia('(min-width: 768px) and (pointer: fine)');
    if (pointer.matches) inputRef.current?.focus();
  }, []);

  /* Debounced query against the address index. */
  useEffect(() => {
    if (!typedRef.current) return;
    const q = query.trim();
    if (q.length < MIN_QUERY) {
      abortRef.current?.abort();
      setSuggestions([]);
      setSearching(false);
      setSearched(false);
      setIndexError(null);
      setHighlight(-1);
      return;
    }

    setSearching(true);
    const timer = window.setTimeout(async () => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      try {
        const result = await fetchSuggestions(q, controller.signal);
        if (controller.signal.aborted) return;
        if (result.ok) {
          setSuggestions(result.data);
          setIndexError(null);
        } else {
          setSuggestions([]);
          setIndexError(result.message);
        }
        setHighlight(-1);
        setSearched(true);
        setSearching(false);
      } catch {
        /* aborted — a newer keystroke owns the field now */
      }
    }, DEBOUNCE_MS);

    return () => window.clearTimeout(timer);
  }, [query]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const select = useCallback(
    (s: GeoSuggestion) => {
      abortRef.current?.abort();
      onLock({
        line1: s.line1,
        city: s.city,
        region: s.region,
        postalCode: s.postalCode,
        countryCode: s.countryCode,
        country: s.country,
        lat: s.lat,
        lon: s.lon,
      });
    },
    [onLock],
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
      setSuggestions([]);
      setHighlight(-1);
    }
  };

  /* ---------------- manual entry ---------------- */

  const setField = (key: keyof ManualForm, value: string) => {
    setForm((f) => ({ ...f, [key]: value }));
    setManualErrors((e) => ({ ...e, [key]: undefined }));
  };

  /** Ask the geocoder for the coordinates of whatever has been typed so far. */
  const resolveCoords = async () => {
    const parts = [form.line1, form.city, form.region, form.postalCode, form.countryCode]
      .filter(Boolean)
      .join(', ');
    if (parts.length < MIN_QUERY) {
      setResolveNote('Enter a street and a city first.');
      return;
    }
    setResolving(true);
    setResolveNote(null);
    const result = await fetchSuggestions(parts);
    setResolving(false);
    if (!result.ok || result.data.length === 0) {
      setResolveNote('No fix from the index. Enter the coordinates by hand.');
      return;
    }
    const top = result.data[0];
    setForm((f) => ({ ...f, lat: top.lat.toFixed(6), lon: top.lon.toFixed(6) }));
    setResolveNote(`Fix acquired from ${top.label}.`);
  };

  const submitManual = (e: React.FormEvent) => {
    e.preventDefault();
    const errors: Partial<Record<keyof ManualForm, string>> = {};
    if (!form.line1.trim()) errors.line1 = 'A street line is required to print and ship.';
    if (!form.city.trim()) errors.city = 'A city is required.';
    if (!form.postalCode.trim()) errors.postalCode = 'A postal code is required.';
    const lat = Number(form.lat);
    const lon = Number(form.lon);
    if (!form.lat.trim() || !isLatitude(lat)) errors.lat = 'Latitude must be between -90 and 90.';
    if (!form.lon.trim() || !isLongitude(lon)) errors.lon = 'Longitude must be between -180 and 180.';
    setManualErrors(errors);
    if (Object.keys(errors).length > 0) {
      /* The control is pinned to the foot of the viewport, so the field it
         refuses can be off screen when it refuses. Put the first one in front
         of the reader; `role="alert"` on <FieldError /> covers the rest. */
      const FIELD_ID: Partial<Record<keyof ManualForm, string>> = {
        line1: 'm-line1',
        city: 'm-city',
        postalCode: 'm-postal',
        lat: 'm-lat',
        lon: 'm-lon',
      };
      const first = (Object.keys(errors) as (keyof ManualForm)[])[0];
      const el = document.getElementById(FIELD_ID[first] ?? '');
      if (el) {
        const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        el.scrollIntoView({ block: 'center', behavior: still ? 'auto' : 'smooth' });
        (el as HTMLInputElement).focus({ preventScroll: true });
      }
      return;
    }

    const country = COUNTRIES.find((c) => c.code === form.countryCode);
    onLock({
      line1: form.line1.trim(),
      line2: form.line2.trim() || undefined,
      city: form.city.trim(),
      region: form.region.trim() || undefined,
      postalCode: form.postalCode.trim(),
      countryCode: form.countryCode,
      country: country?.name ?? form.countryCode,
      lat,
      lon,
    });
  };

  const expanded = suggestions.length > 0;

  if (manual) {
    return (
      <form onSubmit={submitManual} noValidate>
        <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2 pb-6">
          <p className={cn('text-label uppercase', INK_DIM)}>Target by hand</p>
          <button type="button" onClick={() => setManual(false)} className={QUIET_BUTTON}>
            Back to search
          </button>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <div className="md:col-span-2">
            <FieldLabel htmlFor="m-line1">Address line 1</FieldLabel>
            <input
              id="m-line1"
              className={INPUT_CLASS}
              autoComplete="address-line1"
              inputMode="text"
              value={form.line1}
              onChange={(e) => setField('line1', e.target.value)}
              aria-invalid={Boolean(manualErrors.line1)}
              aria-describedby={manualErrors.line1 ? 'm-line1-err' : undefined}
            />
            {manualErrors.line1 ? <FieldError id="m-line1-err">{manualErrors.line1}</FieldError> : null}
          </div>

          <div className="md:col-span-2">
            <FieldLabel htmlFor="m-line2" hint="Optional">
              Address line 2
            </FieldLabel>
            <input
              id="m-line2"
              className={INPUT_CLASS}
              autoComplete="address-line2"
              inputMode="text"
              value={form.line2}
              onChange={(e) => setField('line2', e.target.value)}
            />
          </div>

          <div>
            <FieldLabel htmlFor="m-city">City</FieldLabel>
            <input
              id="m-city"
              className={INPUT_CLASS}
              autoComplete="address-level2"
              inputMode="text"
              value={form.city}
              onChange={(e) => setField('city', e.target.value)}
              aria-invalid={Boolean(manualErrors.city)}
              aria-describedby={manualErrors.city ? 'm-city-err' : undefined}
            />
            {manualErrors.city ? <FieldError id="m-city-err">{manualErrors.city}</FieldError> : null}
          </div>

          <div>
            <FieldLabel htmlFor="m-region" hint="Optional">
              Region or state
            </FieldLabel>
            <input
              id="m-region"
              className={INPUT_CLASS}
              autoComplete="address-level1"
              inputMode="text"
              value={form.region}
              onChange={(e) => setField('region', e.target.value)}
            />
          </div>

          <div>
            <FieldLabel htmlFor="m-postal">Postal code</FieldLabel>
            <input
              id="m-postal"
              className={INPUT_CLASS}
              autoComplete="postal-code"
              inputMode="text"
              autoCapitalize="characters"
              value={form.postalCode}
              onChange={(e) => setField('postalCode', e.target.value)}
              aria-invalid={Boolean(manualErrors.postalCode)}
              aria-describedby={manualErrors.postalCode ? 'm-postal-err' : undefined}
            />
            {manualErrors.postalCode ? (
              <FieldError id="m-postal-err">{manualErrors.postalCode}</FieldError>
            ) : null}
          </div>

          <div>
            <FieldLabel htmlFor="m-country">Country</FieldLabel>
            <select
              id="m-country"
              className={cn(INPUT_CLASS, 'appearance-none')}
              autoComplete="country"
              value={form.countryCode}
              onChange={(e) => setField('countryCode', e.target.value)}
            >
              {COUNTRIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className={cn('mt-8 border-t pt-6', RULE)}>
          <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2 pb-5">
            <p className={cn('text-label uppercase', INK_DIM)}>Target coordinates</p>
            <button
              type="button"
              onClick={resolveCoords}
              disabled={resolving}
              className={QUIET_BUTTON}
            >
              {resolving ? 'Resolving' : 'Resolve from address'}
            </button>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <div>
              <FieldLabel htmlFor="m-lat" hint="−90 → 90">
                Latitude
              </FieldLabel>
              <input
                id="m-lat"
                className={cn(INPUT_CLASS, 'font-mono tabular-nums')}
                inputMode="decimal"
                placeholder="51.5237"
                value={form.lat}
                onChange={(e) => setField('lat', e.target.value)}
                aria-invalid={Boolean(manualErrors.lat)}
                aria-describedby={manualErrors.lat ? 'm-lat-err' : undefined}
              />
              {manualErrors.lat ? <FieldError id="m-lat-err">{manualErrors.lat}</FieldError> : null}
            </div>
            <div>
              <FieldLabel htmlFor="m-lon" hint="−180 → 180">
                Longitude
              </FieldLabel>
              <input
                id="m-lon"
                className={cn(INPUT_CLASS, 'font-mono tabular-nums')}
                inputMode="decimal"
                placeholder="-0.1585"
                value={form.lon}
                onChange={(e) => setField('lon', e.target.value)}
                aria-invalid={Boolean(manualErrors.lon)}
                aria-describedby={manualErrors.lon ? 'm-lon-err' : undefined}
              />
              {manualErrors.lon ? <FieldError id="m-lon-err">{manualErrors.lon}</FieldError> : null}
            </div>
          </div>

          {resolveNote ? (
            <p className={cn('pt-5 text-body', INK_DIM)} aria-live="polite">
              {resolveNote}
            </p>
          ) : null}
        </div>

        <StepAction note="Nothing is charged yet.">
          <Button type="submit" variant="primary" size="lg">
            Lock the target
          </Button>
        </StepAction>
      </form>
    );
  }

  return (
    <div>
      <input
        ref={inputRef}
        id="target-address"
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
        aria-label="Target address"
        aria-describedby="target-help"
        placeholder="221B Baker Street, London"
        value={query}
        onChange={(e) => {
          typedRef.current = true;
          setQuery(e.target.value);
        }}
        onKeyDown={onKeyDown}
        className={cn(INPUT_CLASS, 'md:h-16 md:text-[1.125rem]')}
      />

      <p id="target-help" className={cn('pt-3 text-body md:pt-4', INK_DIM)}>
        {searching
          ? 'Searching the address index.'
          : 'The satellite is aimed here. The print ships here.'}
      </p>

      {searching && !expanded ? (
        <ul className="mt-4 md:mt-6" aria-busy="true" aria-live="polite">
          {[0, 1, 2].map((i) => (
            <li key={i} className={cn('flex h-16 flex-col justify-center gap-2 border-t', RULE)}>
              <span className="block h-3.5 w-2/3 bg-[color:color-mix(in_srgb,var(--ink)_9%,transparent)]" />
              <span className="block h-2.5 w-1/3 bg-[color:color-mix(in_srgb,var(--ink)_6%,transparent)]" />
            </li>
          ))}
        </ul>
      ) : null}

      {expanded ? (
        <ul
          id={listId}
          role="listbox"
          aria-label="Address matches"
          className="mt-4 max-h-[22rem] overflow-y-auto md:mt-6"
        >
          {suggestions.map((s, i) => (
            <li key={s.id} role="none">
              <button
                type="button"
                id={`${listId}-${i}`}
                role="option"
                aria-selected={i === highlight}
                onMouseEnter={() => setHighlight(i)}
                onClick={() => select(s)}
                className={cn(
                  'flex min-h-16 w-full flex-col items-start justify-center gap-1.5 border-t px-1 py-3 text-left transition-house',
                  'hover:bg-[color:color-mix(in_srgb,var(--ink)_4%,transparent)]',
                  RULE,
                  i === highlight && 'bg-[color:color-mix(in_srgb,var(--ink)_5%,transparent)]',
                )}
              >
                <span className={cn('w-full truncate text-body', INK)}>{s.line1}</span>
                <span className={cn('w-full truncate text-label uppercase', INK_DIM)}>
                  {[s.city, s.region, s.postalCode, s.country].filter(Boolean).join(' / ')}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {indexError ? (
        <div className="mt-6">
          <ErrorPlate title="Address index unreachable">
            {indexError} Enter the address by hand below and the target is recorded directly.
          </ErrorPlate>
        </div>
      ) : null}

      {!searching && searched && !expanded && !indexError ? (
        <p className={cn('pt-5 text-body', INK_DIM)}>
          No match in the index. Refine the query, or enter the address by hand.
        </p>
      ) : null}

      <UseMyLocation onResolved={select} className="pt-6" />

      <div className="pt-6">
        <button type="button" onClick={() => setManual(true)} className={QUIET_BUTTON}>
          Enter the address by hand
        </button>
      </div>
    </div>
  );
}
