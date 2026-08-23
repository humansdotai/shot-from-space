import type { Metadata } from 'next';
import { MissionFlow } from '@/components/mission-flow';

export const metadata: Metadata = {
  title: 'Commission a mission',
  description:
    'A satellite is tasked over your coordinates and returns a frame that did not exist before you asked. One surface: the print on the left, the decisions and the price on the right.',
};

/**
 * /mission — THE CONFIGURATOR.
 *
 * A persistent split: the object on the left, the controls and the price
 * and the primary action on the right, both halves filling the viewport.
 * Everything the surface knows lives in <MissionFlow />; this page holds
 * the two facts that belong to the ROUTE rather than to the component.
 *
 * ENTRY: `/mission?address=…&lat=…&lon=…`. All three are optional; with
 * none of them the Target section asks for a place instead of revealing
 * one. `?step=` names the open tab.
 */
export default function MissionPage() {
  return (
    <>
      {/*
        THE PAGE DOES NOT SCROLL — CONFIGURATOR.md §2.

        The root layout puts two things after every page: <SiteFooter />
        and, while every integration is mocked, the amber MOCK MODE strip.
        A full-height surface with either of them under it is a page that
        scrolls, and one whose bottom 30–70px can never be reached.

        So on this route the document itself becomes the column:

          · the FOOTER is taken out. Everything it links to — terms,
            privacy, the archive — is in the site header, which stays.
          · the MOCK MODE strip is NOT taken out. It is an honesty notice
            naming every simulated integration, and hiding it to win a
            layout argument is exactly the trade this project does not
            make. It keeps its natural height at the foot of the viewport
            and the configurator takes what is left.

        Scoped by `:has()` on the configurator's own class rather than by
        a route name, so it cannot leak: the rule only matches a document
        that actually contains the configurator, and it stops matching the
        moment a client-side navigation replaces it.

        A <style> element rather than a rule in `app/globals.css` because
        globals.css is shared by five parallel builds and a rule only one
        route needs does not belong in it.
      */}
      <style>{`
        html:has(.mission-configurator) { overflow: hidden; }
        body:has(.mission-configurator) {
          display: flex;
          flex-direction: column;
          height: 100dvh;
          overflow: hidden;
        }
        body:has(.mission-configurator) > footer { display: none; }
        body:has(.mission-configurator) > main {
          display: flex;
          flex: 1 1 auto;
          min-height: 0;
        }
        body:has(.mission-configurator) > main > * {
          flex: 1 1 auto;
          min-height: 0;
        }
      `}</style>
      <main>
        <MissionFlow />
      </main>
    </>
  );
}
