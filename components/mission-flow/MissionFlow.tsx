'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { clsx as cn } from 'clsx';
import { INK_DIM, RULE } from '@/components/purchase/fields';
import { formatPrice, getFormat } from '@/lib/pricing';
import { earliestFromSearch, PARAM_STEP, targetFromSearch } from '@/lib/mission-flow/entry';
import {
  DEFAULT_DRAFT,
  loadFlow,
  saveFlow,
  type MissionDraft,
  type MissionTarget,
} from '@/lib/mission-flow/state';
import {
  furthestLegalSection,
  isSectionId,
  nextUnanswered,
  sectionAnswered,
  sectionById,
  type SectionId,
} from '@/lib/mission-flow/steps';
import { track } from '@/lib/mission-flow/track';
import {
  currencyForTarget,
  effectiveFrame,
  TIER_COPY,
  tierPriceMinor,
} from '@/lib/mission-flow/config';
import { resolveAddress, toTargetAddress } from '@/lib/mission-flow/api';
import { Configurator } from './Configurator';
import { ClosedRail, SectionRail } from './SectionRail';
import { PanelFoot, type PrimaryAction } from './PanelFoot';
import { PreviewStage } from './PreviewStage';
import { TargetSection } from './S1Reveal';
import type { WhyAnswer } from './S2Why';
import { MissionSection } from './MissionSection';
import { FramingSection } from './S5How';
import { DesignSection } from './S6Configure';
import { WindowSection } from './S7Windows';
import { ReviewSection, useCommission } from './S9Offer';
import { ConfirmationSection } from './S10Confirmation';

/**
 * /mission — THE CONFIGURATOR.
 *
 * The single stateful component. Seven sections, one draft that describes
 * the whole purchase, one price, and one primary action pinned to the
 * foot of the control panel.
 *
 * ------------------------------------------------------------------
 * WHAT THIS REPLACED, AND WHY
 * ------------------------------------------------------------------
 * Ten sequential full-page screens. At 1440 × 820 the first of them
 * showed a header, a progress rail, an eyebrow, a headline, an address
 * and the top of a picture — and no button anywhere in the viewport.
 * Every screen after it had the same shape. See CONFIGURATOR.md §1.
 *
 * The fix is structural, not cosmetic: the surface is one viewport tall
 * and does not scroll, the panel scrolls inside its own column, and the
 * button is a sibling of that scroller rather than something inside it.
 * Sections are TABS, so a buyer can change the size after choosing a
 * window without losing the window.
 *
 * ------------------------------------------------------------------
 * WHERE STATE LIVES
 * ------------------------------------------------------------------
 * THE SECTION is in the URL (`?step=`) and in history, so Back and
 * Forward walk the surface instead of leaving it, and a refresh lands on
 * the tab that was open. It is moved with `history.pushState` rather than
 * the router: nothing on the server depends on it, and a full navigation
 * per tab would throw away the mounted preview.
 *
 * THE ANSWERS are in localStorage, which is the only place they can live
 * — there is no account and no email before payment, by design. A corrupt
 * or outdated stored value degrades to the default rather than to a blank
 * screen; see `loadFlow()`.
 *
 * "WHY THIS PLACE" is in memory only, deliberately. It is an analytics
 * property and storing it would be the first step towards it quietly
 * becoming something else.
 *
 * ------------------------------------------------------------------
 * WHICH SECTIONS ARE MOUNTED
 * ------------------------------------------------------------------
 * The one that is open, plus every one that has been open. A tab is
 * hidden with `display: none` rather than torn down, because the pass
 * search on the Window tab is the slow step of the whole flow and
 * re-running it every time somebody glances back at the size would
 * punish the buyer for using the tabs. Nothing is mounted before it is
 * asked for, so arriving at `/mission` still fetches only the reveal.
 *
 * ------------------------------------------------------------------
 * HYDRATION
 * ------------------------------------------------------------------
 * Nothing is rendered until the query string and the stored draft have
 * both been read. The alternative is a first paint of the Target tab with
 * no target, replaced a frame later by Review — which is worse than a
 * moment of nothing.
 */
export function MissionFlow() {
  const [ready, setReady] = useState(false);

  /* --- WHICH SHAPE ------------------------------------------------
     Below 1024 the configurator is one scrolling document with every
     section stacked down it — see THE PHONE SHAPE in Configurator.tsx.

     COMPUTED IN THE INITIALISER, NOT IN AN EFFECT, and that matters: an
     effect runs after paint, so a phone would render the split shape for
     one frame and then jump. There is no hydration risk in reading
     `matchMedia` here because this component renders the same
     "Restoring the mission" placeholder on the server AND on the first
     client render — `ready` is false in both — so the markup React
     compares is identical either way. */
  const [stacked, setStacked] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(max-width: 1023.98px)').matches,
  );
  useEffect(() => {
    const q = window.matchMedia('(max-width: 1023.98px)');
    const sync = () => setStacked(q.matches);
    sync();
    q.addEventListener('change', sync);
    return () => q.removeEventListener('change', sync);
  }, []);
  const [draft, setDraft] = useState<MissionDraft>(DEFAULT_DRAFT);
  const [section, setSection] = useState<SectionId>('target');
  const [why, setWhy] = useState<WhyAnswer | null>(null);
  const [visited, setVisited] = useState<SectionId[]>(['target']);

  /* --- Arrival ---------------------------------------------------- */
  useEffect(() => {
    const search = new URLSearchParams(window.location.search);
    const stored = loadFlow();

    // A target in the URL is the newest intent and wins over a stored one,
    // unless it is the same place — in which case the stored record may
    // carry a resolved address the URL never had.
    const fromUrl = targetFromSearch(search);
    const storedTarget = stored?.draft.target ?? null;
    const sameSpot =
      fromUrl && storedTarget
        ? Math.abs(fromUrl.lat - storedTarget.lat) < 1e-6 &&
          Math.abs(fromUrl.lon - storedTarget.lon) < 1e-6
        : false;

    const base = stored?.draft ?? DEFAULT_DRAFT;
    const target = fromUrl ? (sameSpot ? storedTarget : fromUrl) : storedTarget;

    // A new target means the old windows and the old payment do not apply.
    const restarted = Boolean(fromUrl && storedTarget && !sameSpot);

    // THE EARLIEST-DATE PREFERENCE, carried from the homepage entry.
    // A value in the URL is the newest intent and wins; when the URL is
    // silent the stored preference stands, because a reload is not a
    // change of mind. `earliestFromSearch` has already rejected anything
    // past, malformed or beyond the horizon and returned null, which is
    // "first available".
    const earliestFromUrl = earliestFromSearch(search);

    const nextDraft: MissionDraft = restarted
      ? { ...DEFAULT_DRAFT, target, earliest: earliestFromUrl }
      : { ...base, target, earliest: earliestFromUrl ?? base.earliest };

    const requested = search.get(PARAM_STEP);
    const wanted: SectionId = restarted
      ? 'target'
      : isSectionId(requested)
        ? requested
        : (stored?.step ?? 'target');

    const clamped = furthestLegalSection(wanted, nextDraft);

    setDraft(nextDraft);
    sectionRef.current = clamped;
    draftRef.current = nextDraft;
    setSection(clamped);
    setVisited((v) => (v.includes(clamped) ? v : [...v, clamped]));
    setReady(true);

    // Normalise the address bar to the tab actually being shown, without
    // adding a history entry for a redirect the reader did not ask for.
    const url = new URL(window.location.href);
    url.searchParams.set(PARAM_STEP, clamped);
    window.history.replaceState(null, '', url.toString());
  }, []);

  /* --- The two refs, and why they exist ---------------------------
   * React calls a state UPDATER function more than once — the eager
   * evaluation on dispatch, then again during render — so an updater is
   * the wrong place for anything that is not pure. Putting `track()` or
   * `history.pushState()` inside one fires the event twice and mutates
   * the router mid-render.
   *
   * So movement reads the current section and draft from refs and does
   * its side effects in the handler, where they belong, and `setSection`
   * only ever receives a value.
   * ---------------------------------------------------------------- */
  const sectionRef = useRef<SectionId>('target');
  const draftRef = useRef<MissionDraft>(DEFAULT_DRAFT);
  const visitedRef = useRef<readonly SectionId[]>(['target']);

  /*
     RESOLVE THE POSTAL RECORD EARLY.

     It used to be resolved at pay time, inside the offer screen, which had
     two consequences: the flow could not know which currency to quote in
     (a US target was shown euros and charged dollars), and the customer
     never saw the address their print would be posted to — it was derived
     from coordinates and filed silently. Doing it here means the country is
     known long before the price in the panel foot is read, and the resolved
     address is on the draft where any section can show it.

     It is best-effort. A failure leaves `address` null and the commission's
     existing resolve-and-block path still runs, so nothing regresses.
  */
  const resolvingRef = useRef<string | null>(null);
  useEffect(() => {
    const t = draft.target;
    if (!t || t.address) return;
    const key = `${t.lat},${t.lon}`;
    if (resolvingRef.current === key) return;
    resolvingRef.current = key;

    let cancelled = false;
    void resolveAddress(t.lat, t.lon).then((resolved) => {
      if (cancelled || !resolved) return;
      setDraft((prev) => {
        const current = prev.target;
        // The target may have changed while the geocoder was answering.
        if (!current || current.lat !== t.lat || current.lon !== t.lon) return prev;
        /* The postal record keeps the geocoder's own coordinates for the
           address; the TARGET's coordinates are what the reader aimed at and
           are what the capture uses. Overwriting one with the other would
           move the aim point to the middle of the nearest matched street. */
        return {
          ...prev,
          target: {
            ...current,
            address: { ...toTargetAddress(resolved), lat: current.lat, lon: current.lon },
          },
        };
      });
    });
    return () => {
      cancelled = true;
    };
  }, [draft.target]);

  useEffect(() => {
    sectionRef.current = section;
  }, [section]);
  useEffect(() => {
    draftRef.current = draft;
  }, [draft]);
  useEffect(() => {
    visitedRef.current = visited;
  }, [visited]);

  /* --- Back and Forward ------------------------------------------- */
  useEffect(() => {
    const onPop = () => {
      const requested = new URLSearchParams(window.location.search).get(PARAM_STEP);
      if (!isSectionId(requested)) return;
      const target = furthestLegalSection(requested, draftRef.current);
      sectionRef.current = target;
      setSection(target);
      setVisited((v) => (v.includes(target) ? v : [...v, target]));
      // The gate may have refused where the history entry pointed — after
      // payment, all of them. Correct the address bar rather than leaving
      // it naming a tab that is not open.
      if (target !== requested) {
        const url = new URL(window.location.href);
        url.searchParams.set(PARAM_STEP, target);
        window.history.replaceState(null, '', url.toString());
      }
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  /* --- Persistence ------------------------------------------------ */
  useEffect(() => {
    if (!ready) return;
    saveFlow({ draft, step: section });
  }, [draft, section, ready]);

  /* --- Analytics -------------------------------------------------- */
  useEffect(() => {
    if (!ready) return;
    track('step_viewed', section);
  }, [section, ready]);

  /* --- Movement --------------------------------------------------- */
  const openSection = useCallback((id: SectionId) => {
    sectionRef.current = id;
    setSection(id);
    setVisited((v) => (v.includes(id) ? v : [...v, id]));
    const url = new URL(window.location.href);
    url.searchParams.set(PARAM_STEP, id);
    window.history.pushState(null, '', url.toString());
  }, []);

  const patch = useCallback((changes: Partial<MissionDraft>) => {
    setDraft((d) => ({ ...d, ...changes }));
  }, []);

  /**
   * The panel foot's action on every section but the last two: fire the
   * completion events for the screens this section re-houses, then open
   * the next tab that still needs an answer.
   */
  const advance = useCallback(
    (props?: Record<string, string | number | boolean>) => {
      const current = sectionRef.current;
      for (const screen of sectionById(current).completesOnAdvance) {
        track('step_completed', screen, props);
      }
      openSection(nextUnanswered(current, draftRef.current, visitedRef.current));
    },
    [openSection],
  );

  const onPaid = useCallback(
    (missionCode: string) => {
      track('step_completed', 'dossier');
      track('step_completed', 'offer', { tier: draftRef.current.tier });
      setDraft((d) => ({ ...d, missionCode, paidAt: new Date().toISOString() }));
      sectionRef.current = 'confirmation';
      setSection('confirmation');
      setVisited((v) => (v.includes('confirmation') ? v : [...v, 'confirmation']));
      const url = new URL(window.location.href);
      url.searchParams.set(PARAM_STEP, 'confirmation');
      window.history.pushState(null, '', url.toString());
    },
    [],
  );

  /*
     ONE CURRENCY FOR THE WHOLE FLOW, and it is the one the card will be
     debited in. `currencyForTarget` is the same derivation the order route
     uses (country -> region -> currency), so the number on the button and
     the number in the receipt cannot diverge.

     Until the postal record resolves there is no country and this falls back
     to EUR; the effect above resolves it as soon as a target exists.
  */
  const target = draft.target;
  const currency = currencyForTarget(target?.address?.countryCode);
  const activeFrame = effectiveFrame(draft.tier, draft.frame);

  const commission = useCommission({
    target,
    formatId: draft.formatId,
    frame: draft.frame,
    tier: draft.tier,
    gift: draft.gift,
    giftNote: draft.giftNote,
    receiptEmail: draft.receiptEmail,
    onPaid,
  });

  if (!ready) {
    return (
      <div className="mission-configurator surface-dark flex h-[100dvh] max-h-full w-full items-center justify-center">
        <p className={cn('text-label uppercase', INK_DIM)} role="status">
          Restoring the mission
        </p>
      </div>
    );
  }

  /* --- The one price, and the one action -------------------------- */
  /* `tierPriceMinor` and nothing else. Display and charge come from one
     function; that was a real defect once (a €79 button recorded €170)
     and it must not return. */
  const totalMinor = tierPriceMinor(draft.tier, draft.formatId, activeFrame, currency);
  const footLabel = `${TIER_COPY[draft.tier].name} · ${getFormat(draft.formatId).metric}`;
  const action = primaryAction();

  /* =================================================================
     THE PHONE SHAPE — one scrolling document, every section stacked.

     `preview`, `rail` and `foot` are not passed as frame here: in a
     linear document their position is part of the reading order, so
     they are placed in `children` where they belong. The tab rail is
     not rendered at all — there is nothing to switch between when
     everything is already on the page, and a row of tabs over a
     document that contains all of them is a control that lies.
     ================================================================= */
  if (stacked) {
    const ids: SectionId[] = draft.missionCode
      ? (['confirmation'] as SectionId[])
      : (['target', 'framing', 'mission', 'design', 'window', 'review'] as SectionId[]);

    return (
      <Configurator
        stacked
        sectionKey={section}
        previewKind={sectionById(section).preview}
        preview={null}
        rail={null}
        foot={null}
      >
        {ids.map((id, i) => {
          const meta = sectionById(id);
          /* THE PREVIEW IS RENDERED ONLY WHEN IT CHANGES. Three of the
             six sections share the `poster` stage, and stacking them
             would print the same poster three times down one page —
             which reads as a bug, and costs three mounts of the same
             work. So a stage appears at the first section that uses it
             and is not repeated by the ones that follow. */
          const prev = i > 0 ? sectionById(ids[i - 1]).preview : null;
          const showPreview = meta.preview !== prev;

          return (
            <section key={id} aria-labelledby={`stacked-head-${id}`} className={cn('border-t first:border-t-0', RULE)}>
              {showPreview ? (
                <LazyStage>
                  <div className="h-[56svh] min-h-[280px] w-full">
                    <PreviewStage
                      active={meta.preview}
                      draft={draft}
                      currency={currency}
                      onCentre={({ lat, lon }) =>
                        setDraft((d) =>
                          d.target && (d.target.lat !== lat || d.target.lon !== lon)
                            ? { ...d, target: { ...d.target, lat, lon } }
                            : d,
                        )
                      }
                    />
                  </div>
                </LazyStage>
              ) : null}

              <div className="px-5 py-8 sm:px-6">
                {/* SCREEN-READER ONLY, and that is not a downgrade.
                    Every section body already opens with its own
                    <PanelHead />, which prints the same number and the
                    same name — "PHASE 03 · MISSION", "CAPTURE · 02" —
                    followed by the question it asks. Rendering this one
                    visibly put the section name on the page twice in a
                    row, and in the framing section three times counting
                    the stage's own title.

                    It stays in the DOM because the <section> is labelled
                    by it: taking it out would leave six unnamed regions,
                    and a landmark list of six identical blanks is worse
                    than a duplicated line. */}
                <h2 id={`stacked-head-${id}`} className="sr-only">
                  {`${String(meta.index).padStart(2, '0')} · ${meta.label}`}
                </h2>
                {body(id)}
              </div>
            </section>
          );
        })}

        {/* THE PRICE AND THE ACTION, AS THE LAST THING IN THE DOCUMENT.
            Not a bar over it — the owner's instruction was explicit that
            nothing is fixed on this shape. It is reached by finishing the
            page, which on a single linear path is where the decision
            actually completes. */}
        {draft.missionCode ? null : (
          <div className={cn('border-t px-5 py-8 sm:px-6', RULE)}>
            <PanelFoot
              stacked
              label={footLabel}
              totalMinor={totalMinor}
              currency={currency}
              action={stackedAction()}
            />
          </div>
        )}
      </Configurator>
    );
  }

  return (
    <Configurator
      sectionKey={section}
      previewKind={sectionById(section).preview}
      preview={
        <PreviewStage
          active={sectionById(section).preview}
          draft={draft}
          currency={currency}
          onCentre={({ lat, lon }) =>
            setDraft((d) =>
              d.target && (d.target.lat !== lat || d.target.lon !== lon)
                ? /* The postal record keeps the address it resolved; only
                     the AIM POINT moves, and the aim point is what the
                     capture uses. */
                  { ...d, target: { ...d.target, lat, lon } }
                : d,
            )
          }
        />
      }
      rail={
        draft.missionCode ? (
          <ClosedRail missionCode={draft.missionCode} />
        ) : (
          <SectionRail
            active={section}
            draft={draft}
            visited={visited}
            onSelect={openSection}
          />
        )
      }
      foot={
        <PanelFoot
          label={footLabel}
          totalMinor={totalMinor}
          currency={currency}
          action={action}
        />
      }
    >
      {/* Once the mission is paid for the configurator is closed, so the
          sections it was configured with come OUT of the document rather
          than staying in it hidden. A receipt page with a live email
          field and a tier group behind `display: none` is a purchase
          surface pretending to be finished. */}
      {(draft.missionCode ? (['confirmation'] as SectionId[]) : visited).map((id) => (
        <Panel
          key={id}
          id={id}
          active={id === section}
          /* Once the mission is paid for the rail is <ClosedRail /> and
             there are no tabs at all — so this panel is not a tabpanel
             any more, and `aria-labelledby="section-tab-confirmation"`
             pointed at an element that no longer exists. A dangling
             label leaves the region with no accessible name, which is
             worse than the plain region it actually is. */
          tabbed={!draft.missionCode}
        >
          {body(id)}
        </Panel>
      ))}
    </Configurator>
  );

  /* ---------------------------------------------------------------- */

  function body(id: SectionId): ReactNode {
    switch (id) {
      case 'target':
        return (
          <TargetSection
            target={target}
            onTarget={(t: MissionTarget) => patch({ target: t })}
            /* Only so the section can say what the figure in the foot is
               one of — see <PriceRange /> in S1Reveal.tsx. It prices with
               `tierPriceMinor`, the same call this component makes for the
               foot, so the two cannot disagree. */
            formatId={draft.formatId}
            frame={draft.frame}
            currency={currency}
          />
        );

      case 'framing':
        /* The section names the next real crossing of these coordinates, so
           it needs them. `target` is already the guard on this branch. */
        return target ? <FramingSection target={target} /> : null;

      case 'mission':
        return (
          <MissionSection
            why={why}
            gift={draft.gift}
            missionName={draft.missionName}
            onWhy={(answer) => {
              setWhy(answer);
              track('step_completed', 'why', { answer });
            }}
            onGift={(gift) => {
              patch({ gift });
              track('step_completed', 'who', { gift });
            }}
            onName={(missionName) => patch({ missionName })}
          />
        );

      case 'design':
        return (
          <DesignSection
            currency={currency}
            draft={draft}
            formatId={draft.formatId}
            frame={draft.frame}
            onFormat={(formatId) => patch({ formatId })}
            onFrame={(frame) => patch({ frame })}
            onStyle={(posterStyle) => patch({ posterStyle })}
          />
        );

      case 'window':
        return target ? (
          <WindowSection
            lat={target.lat}
            lon={target.lon}
            earliest={draft.earliest}
            chosen={draft.window}
            onSelect={(w) => {
              patch({ window: w });
              track('step_completed', 'windows', { window: w.date, indicative: w.indicative });
            }}
          />
        ) : null;

      case 'review':
        return (
          <ReviewSection
            currency={currency}
            /* The Review section propagates the tracked fleet over these
               coordinates to show what a commission actually buys, and
               reads the archive scene to show what an archive one does.
               Both are per-point, so the point has to reach it. */
            target={target}
            missionName={draft.missionName}
            formatId={draft.formatId}
            frame={draft.frame}
            tier={draft.tier}
            window={draft.window}
            gift={draft.gift}
            giftNote={draft.giftNote}
            receiptEmail={draft.receiptEmail}
            onTier={(tier) => patch({ tier })}
            onGiftNote={(giftNote) => patch({ giftNote })}
            onEmail={(receiptEmail) => {
              patch({ receiptEmail });
              commission.clearEmailError();
            }}
            phase={commission.phase}
            error={commission.error}
            emailError={commission.emailError}
          />
        );

      case 'confirmation':
        return target && draft.missionCode ? (
          <ConfirmationSection
            missionCode={draft.missionCode}
            missionName={draft.missionName}
            lat={target.lat}
            lon={target.lon}
            formatId={draft.formatId}
            frame={draft.frame}
            /* The tier decides the route the mission travels: an archive
               order is never tasked, so it is not shown waiting on a
               tasking it will not have. */
            tier={draft.tier}
            window={draft.window}
            gift={draft.gift}
            giftNote={draft.giftNote}
            paidAt={draft.paidAt}
            receiptEmail={draft.receiptEmail}
          />
        ) : null;
    }
  }

  /**
   * THE ONE ACTION ON THE STACKED DOCUMENT.
   *
   * A linear page has a single ending, so it has a single button, and
   * that button is the purchase. It is NOT `primaryAction()` with the
   * section forced to `review`: that function's branches are ordered for
   * a tabbed surface, where `review` is only reachable once a target
   * exists, so asking it for the review action with no target returns
   * "Pay" with a hint about capture windows — advice about the wrong
   * missing thing.
   *
   * The order here is the order the page is read in, so the hint always
   * names the FIRST unanswered decision above it. A disabled button that
   * does not say what is missing is a dead end, and on this shape the
   * missing thing is somewhere up the page rather than behind a tab.
   */
  function stackedAction(): PrimaryAction {
    if (draft.missionCode) {
      return { label: 'Open the mission file', href: `/m/${draft.missionCode}` };
    }
    if (!target) {
      return {
        label: 'Continue',
        disabled: true,
        hint: 'Name a place above. Everything after it is measured from those coordinates.',
      };
    }
    if (draft.gift === null) {
      return {
        label: 'Continue',
        disabled: true,
        hint: 'Say who the mission is for, under Mission.',
      };
    }
    if (!sectionAnswered('window', draft)) {
      return {
        label: 'Continue',
        disabled: true,
        hint: 'Choose a capture window above — the order needs a tasking day.',
      };
    }
    return {
      label:
        commission.phase === 'paying'
          ? 'Authorising'
          : `Pay ${formatPrice(totalMinor, currency)}`,
      onClick: () => void commission.pay(),
      loading: commission.phase === 'paying',
      arrow: false,
    };
  }

  /**
   * What the one button on the surface does, on the section that is open.
   *
   * A blocked action always says what is missing — `hint` is rendered
   * above the button and is its `aria-describedby`. A disabled control
   * with no reason given is a dead end.
   */
  function primaryAction(): PrimaryAction {
    if (section === 'confirmation' && draft.missionCode) {
      return { label: 'Open the mission file', href: `/m/${draft.missionCode}` };
    }

    if (section === 'review') {
      return {
        label: commission.phase === 'paying' ? 'Authorising' : `Pay ${formatPrice(totalMinor, currency)}`,
        onClick: () => void commission.pay(),
        loading: commission.phase === 'paying',
        arrow: false,
        hint: sectionAnswered('window', draft)
          ? undefined
          : 'No capture window is chosen yet. Pick one in Window — the order needs a tasking day.',
        disabled: !sectionAnswered('window', draft),
      };
    }

    if (!target) {
      return {
        label: 'Continue',
        disabled: true,
        hint: 'Name a place. Everything after this is measured from those coordinates.',
      };
    }

    if (section === 'window' && !draft.window) {
      return {
        label: 'Continue',
        disabled: true,
        hint: 'Choose a capture window — the order needs a tasking day.',
      };
    }

    if (section === 'mission' && draft.gift === null) {
      return {
        label: 'Continue',
        disabled: true,
        hint: 'Say who the mission is for. A gift adds a note at checkout and a certificate.',
      };
    }

    // The Design tab's completion event carried the size and the finish
    // when it was screen 6. It still does.
    return {
      label: 'Continue',
      onClick: () =>
        advance(
          section === 'design'
            ? { format: draft.formatId, finish: draft.frame }
            : undefined,
        ),
    };
  }
}

/**
 * Mounts its child only once it is near the viewport, and keeps it
 * mounted afterwards.
 *
 * THIS EXISTS BECAUSE STACKING CHANGED WHAT "A PREVIEW" COSTS. On the
 * tabbed shape exactly one stage is ever mounted, and the next is built
 * when the buyer asks for it. Stacked, four of them are in the document
 * at once — the archive descent, the basemap framing tool, the poster and
 * the dossier — and mounting all four on arrival means a phone fetches
 * map tiles and runs a pass search for stages that are two and three
 * screens below the fold, before the buyer has read the first one.
 *
 * `rootMargin` is a full viewport, so a stage is built while it is still
 * one screen away and is finished by the time it is looked at. Once
 * mounted it is never unmounted: scrolling back up must not throw away a
 * framing the buyer has already adjusted.
 *
 * NO IntersectionObserver — no problem: the stage mounts immediately.
 * Degrading to "everything loads" is right for a capability check on a
 * purchase surface; degrading to "nothing loads" would hide the product.
 */
function LazyStage({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    if (shown) return;
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') {
      setShown(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) setShown(true);
      },
      { rootMargin: '100% 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [shown]);

  return (
    <div ref={ref}>
      {shown ? children : <div aria-hidden className="h-[56svh] min-h-[280px] w-full" />}
    </div>
  );
}

/**
 * One section's controls. Kept in the tree once visited and hidden with
 * `hidden` when another tab is open — see the note on mounting above.
 */
function Panel({
  id,
  active,
  tabbed,
  children,
}: {
  id: SectionId;
  active: boolean;
  /** False once the configurator is closed — see the note at the call site. */
  tabbed: boolean;
  children: ReactNode;
}) {
  return (
    <div
      role={tabbed ? 'tabpanel' : 'region'}
      id={`section-panel-${id}`}
      {...(tabbed
        ? { 'aria-labelledby': `section-tab-${id}` }
        : { 'aria-label': sectionById(id).label })}
      hidden={!active}
      tabIndex={active ? 0 : -1}
    >
      {children}
    </div>
  );
}
