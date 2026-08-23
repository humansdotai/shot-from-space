import { IconCalendar, IconFacility, IconFrame, IconParcel, IconSheet } from '@/components/fui/icons';
import { datestamp, eventAt, facilityCity } from '@/components/mission/telemetry';
import { MATERIALS, PACKAGING, guaranteeTerm } from '@/lib/guarantees';
import type { BriefCardProps } from './types';
import { Body, Lead, Note, Row, Rows } from './ui';

/**
 * CARD 06 · WHAT ARRIVES
 *
 * The object, the paper it is on, the box it travels in, where it is made
 * and when it is expected.
 *
 * EVERY VALUE:
 *   format     `mission.format` — metric, imperial and designation, as the
 *              order holds them; the catalogue itself is `lib/pricing.ts`
 *   finish     `MATERIALS.paperFramed` / `MATERIALS.paperUnframed`
 *   packaging  `PACKAGING.framedPhrase` / `PACKAGING.unframedPhrase`
 *   facility   `mission.printFacility` through `facilityCity()`
 *   delivery   the mission's own DELIVERED event once it exists, and
 *              `mission.estimatedDeliveryAt` until then
 *   guarantee  `guaranteeTerm('shipping').short`
 *
 * NOT ONE MATERIAL CLAIM IS TYPED HERE. `lib/guarantees.ts` exists because a
 * QA pass found fourteen contradictions, most of them a paper or a package
 * described one way on a product page and another in an email. The words
 * "archival", "museum-grade", "cotton" and "anti-glare" are not in the
 * catalogue and so are not on this card; what is on it is what
 * `lib/integrations/gelato.ts` actually orders.
 *
 * TWO FIELDS CAN BE ABSENT AND BOTH SAY SO.
 *   · `printFacility` is null until the job is released to production —
 *     `toMissionDTO` gates it on the PRINT stage — so before then the card
 *     says the facility is assigned at print, rather than guessing from the
 *     region. The region is on the file's specification block; a guess here
 *     would be a second, weaker source for the same fact.
 *   · `estimatedDeliveryAt` is null until the carrier gives one. The card
 *     says it is not estimated yet. It never counts down and it never
 *     borrows the quoted capture window as a delivery date.
 */
export function WhatArrives({ mission, className }: BriefCardProps) {
  const framed = mission.format.frame === 'FRAMED';
  const facility = facilityCity(mission);
  const delivered = eventAt(mission, 'DELIVERED');

  return (
    <Body className={className}>
      <Lead
        icon={<IconSheet size={18} />}
        label="Deliverable"
        mono
        value={mission.format.metric}
        sub={
          <span data-telemetry className="file">
            {mission.format.imperial} · {mission.format.designation}
          </span>
        }
      />

      <Rows className="mt-8">
        <Row
          icon={<IconFrame />}
          label="Mount"
          value={framed ? `Framed — ${MATERIALS.framedSpec}` : 'Unframed sheet'}
        />
        <Row label="Finish" value={framed ? MATERIALS.paperFramed : MATERIALS.paperUnframed} />
        {/* The label supplies the subject and `PACKAGING` supplies the
            predicate — those singular verb forms exist for exactly this
            ("the print …"), so the row reads as the sentence the rest of
            the product writes rather than as a re-typed fragment. */}
        <Row
          icon={<IconParcel />}
          label={framed ? 'The frame' : 'The print'}
          value={framed ? PACKAGING.framed : PACKAGING.unframed}
        />
        <Row
          icon={<IconFacility />}
          label="Printed at"
          tone={facility ? undefined : 'dim'}
          value={facility ?? 'Assigned when the print file is released'}
        />
        {/* Delivered missions state the day it actually arrived, from the
            mission's own DELIVERED event. Printing an ESTIMATE against a
            parcel that has already been handed over would be the file
            arguing with itself. */}
        {delivered ? (
          <Row icon={<IconCalendar />} label="Delivered" mono value={datestamp(delivered)} />
        ) : (
          <Row
            icon={<IconCalendar />}
            label="Estimated"
            mono={Boolean(mission.estimatedDeliveryAt)}
            tone={mission.estimatedDeliveryAt ? undefined : 'dim'}
            value={
              mission.estimatedDeliveryAt
                ? datestamp(mission.estimatedDeliveryAt)
                : 'Not estimated until the print ships'
            }
          />
        )}
      </Rows>

      <Note className="mt-7">{guaranteeTerm('shipping').short} — the number on the format is the
        number charged.</Note>
    </Body>
  );
}
