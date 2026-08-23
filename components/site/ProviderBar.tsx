import { cn } from '@/lib/utils';

/**
 * THE IMAGERY PROVIDER BAR.
 *
 * ------------------------------------------------------------------------
 * WHY THIS IS SET IN TYPE AND NOT IN LOGOS — read before changing it
 * ------------------------------------------------------------------------
 * Shot from Space does not buy imagery from any of the operators named here.
 * It buys capture capacity through **SkyFi**, a marketplace that aggregates
 * archive and tasking across third-party constellations. There is no
 * commercial relationship, partnership or endorsement between this company
 * and any operator on this list, and the bar must never suggest one.
 *
 * Two consequences, both deliberate:
 *
 *  1. NO LOGO FILES. Every one of these names is a registered trademark and
 *     every logo is a copyrighted work. We hold no licence to any of them.
 *     Reproducing a company's mark on a commercial page is the thing that
 *     reads as "official partner" whatever the caption says. If the business
 *     ever wants real marks here, it needs WRITTEN PERMISSION FROM EACH
 *     OPERATOR (and typically their brand-guideline compliance sign-off)
 *     before a single asset is committed. Until that exists: type only.
 *
 *  2. THE LABEL STATES THE ACTUAL RELATIONSHIP. "Sourced via SkyFi from" —
 *     not "our partners", not "powered by", not "trusted by". The footnote
 *     says out loud that these operators are not partners and do not endorse
 *     us, because a row of company names under a product page implies exactly
 *     that unless it is denied in the same breath.
 *
 * ------------------------------------------------------------------------
 * PROVENANCE OF THE LIST
 * ------------------------------------------------------------------------
 * Every name below is published by SkyFi itself as a source available on its
 * platform (skyfi.com "Satellite Imagery Details & Specs", and SkyFi's own
 * announcements for Umbra and Satellogic). The list is deliberately SHORT: a
 * shorter true list beats a longer guessed one.
 *
 * Names on SkyFi's public list that are OMITTED here on purpose, because the
 * bar claims "constellation operators" and these are not that:
 *   · Vexcel, Near Space Labs, Urban Sky — aerial and stratospheric imaging,
 *     not satellites.
 *   · ESA Copernicus — a public programme, not a commercial operator.
 *   · IMPRO — appears on SkyFi's list as a reseller of a government sensor
 *     (GÖKTÜRK-1) rather than as the operator; we could not confirm the
 *     relationship well enough to print it.
 *   · Pixxel — reported as being onboarded; not confirmed as live.
 *
 * ------------------------------------------------------------------------
 * CONFIRM BEFORE THIS SHIPS  (all of it, with the business, in writing)
 * ------------------------------------------------------------------------
 *  [ ] Each operator below is still available through the SkyFi account this
 *      company actually holds — the public platform list is not the same as
 *      one customer's entitlements, and it changes.
 *  [ ] SkyFi's own terms permit naming its upstream operators on a customer's
 *      commercial site, and permit naming SkyFi itself as our supplier.
 *  [ ] Legal has read the label and the footnote as printed and agrees they
 *      do not constitute an implied endorsement or a comparative claim.
 *  [ ] Trademark check on each name as SET IN TYPE (nominative fair use is
 *      the basis we are relying on: plain text, no styling that imitates a
 *      logotype, no colour, no mark).
 *  [ ] "ICEYE" is the operator; SkyFi's platform lists the entity as
 *      "ICEYE US". Confirm which name is correct for our jurisdiction.
 *  [ ] "Vantor" is the current name of the former Maxar commercial imagery
 *      business. Re-confirm it has not changed again before launch.
 *  [ ] If any name is dropped from our SkyFi entitlements, it comes off this
 *      bar the same day. Nobody's name stays up for decoration.
 */

/**
 * Operators SkyFi publishes as sources on its platform. Order is by nothing
 * meaningful — deliberately not "most important first", which would itself be
 * a claim about relationships we do not have.
 */
const OPERATORS = [
  'PLANET',
  'VANTOR',
  'SATELLOGIC',
  'ICEYE',
  'UMBRA',
  'GEOSAT',
] as const;

/**
 * Grey at rest, ink-black on hover, on whatever light ground it is dropped
 * into, hung under a single hairline rule. The names read as data — the same
 * monospaced uppercase the plate sets its telemetry in — which is the visual
 * argument that these are *references*, not badges.
 *
 * One full-measure row from 1024, flush left to flush right; three cells on a
 * tablet and two at 390, where a six-across row would set the names at four
 * characters a line. The layout does the spacing, so the bar never goes ragged.
 */
export function ProviderBar({ className }: { className?: string }) {
  return (
    <section
      aria-labelledby="provider-bar-label"
      className={cn(
        'flex flex-col border-t rule-ground',
        // The bar breathes with the viewport like every other band.
        'gap-6 pt-8 xl:gap-7 xl:pt-10 xl2:gap-9 xl2:pt-14 xl3:pt-16',
        className,
      )}
    >
      <h2 id="provider-bar-label" className="measure-tight text-label uppercase ink-dim lg:max-w-none">
        Missions are tasked through SkyFi, which brokers commercial constellation operators
      </h2>

      {/* Two up at 390, three on a tablet, and one full-measure row from
          1024 — flush left to flush right, so the bar sits on the rule as a
          single line of names rather than a ragged grid. */}
      <ul className="grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-3 lg:flex lg:justify-between lg:gap-x-8 xl2:gap-y-7">
        {OPERATORS.map((name) => (
          <li
            key={name}
            className={cn(
              // Sized off the label role so it steps with everything
              // else at 1280 / 1920 / 2400 instead of freezing at 14px
              // on a display twice the width it was drawn for.
              'font-mono text-[0.875rem] uppercase tracking-[0.12em]',
              'xl2:text-[1rem] xl3:text-[1.0625rem]',
              'text-[var(--ink-dim)] transition-house hover:text-[var(--ink)]',
            )}
          >
            {name}
          </li>
        ))}
      </ul>

      <p className="measure-wide text-body ink-faint">
        Set in type, not in marks. SkyFi is our supplier; the operators above are listed by
        SkyFi as sources on its platform. None of them is a partner of Shot from Space, and
        none of them endorses it. Every frame shown on this site is public-domain NASA / USGS
        Landsat imagery, not an operator capture — see the imagery credits.
      </p>
    </section>
  );
}
