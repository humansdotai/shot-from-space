'use client';

import { useMemo, useState } from 'react';
import { Button } from '@/components/fui';
import type { ArchiveRegion } from '@/lib/gallery';
import { ArchiveLead } from './ArchiveLead';
import { ArchiveRow } from './ArchiveRow';
import { SegmentedControl, type Segment } from './SegmentedControl';

/**
 * One row of the index, flattened on the server.
 *
 * Deliberately not `ExampleMission`: this component is the only client-side
 * code in the archive, and passing a plain row keeps `lib/gallery` (and with
 * it the whole imagery catalogue) out of the browser bundle. Everything here
 * is already in the RSC payload that renders the list.
 */
export interface ArchiveEntry {
  code: string;
  src: string;
  alt: string;
  /** `PARIS / ÎLE-DE-FRANCE / FRANCE` — the string the location sort reads. */
  locationLabel: string;
  city: string;
  country: string;
  /** The written record, shown on the lead item only. */
  summary: string;
  /** Display form of the acquisition date, at the source record's precision. */
  acquiredLabel: string;
  /** ISO form for <time datetime>, or null when the record states no date. */
  acquiredDate: string | null;
  lat: number;
  lon: number;
  tags: string[];
  classification: string;
  region: ArchiveRegion;
}

type RegionFilter = ArchiveRegion | 'ALL';
type SortKey = 'CAPTURE' | 'LOCATION';

/** Filter order is west to east, the way the index is read. */
const REGION_ORDER: readonly ArchiveRegion[] = ['AMERICAS', 'EUROPE', 'AFRICA', 'ASIA'];

/** Values stay the archive's own uppercase keys; only the face is sentence case. */
const REGION_LABEL: Record<ArchiveRegion, string> = {
  AMERICAS: 'Americas',
  EUROPE: 'Europe',
  AFRICA: 'Africa',
  ASIA: 'Asia',
};

const SORTS: ReadonlyArray<Segment<SortKey>> = [
  { value: 'CAPTURE', label: 'Capture date' },
  { value: 'LOCATION', label: 'Location' },
];

/** What put the head of the list where it is. Printed above the lead item. */
const LEAD_CAPTION: Record<SortKey, string> = {
  CAPTURE: 'Most recent capture',
  LOCATION: 'First by location',
};

/**
 * THE INDEX — a lead item and a dated list (SYSTEM-V3 §5.6).
 *
 * The date the list is ordered by is the capture timestamp: the moment the
 * sensor was over the target, not the moment the file was written. The lead
 * item is simply the head of the current list, so filtering or re-sorting
 * promotes a new one rather than leaving a fixed feature stranded at the top.
 *
 * State starts at ALL / CAPTURE, which is exactly the order the server sends,
 * so the first paint already contains every file. The controls only ever
 * narrow a list that is on the page — with JavaScript off the full archive
 * still renders and every entry still links.
 */
export function ArchiveIndex({ entries }: { entries: ArchiveEntry[] }) {
  const [region, setRegion] = useState<RegionFilter>('ALL');
  const [sort, setSort] = useState<SortKey>('CAPTURE');

  // Only offer regions the archive actually holds.
  const regionSegments = useMemo<ReadonlyArray<Segment<RegionFilter>>>(() => {
    const present = new Set(entries.map((e) => e.region));
    return [
      { value: 'ALL', label: 'All' },
      ...REGION_ORDER.filter((r) => present.has(r)).map((r) => ({
        value: r as RegionFilter,
        label: REGION_LABEL[r],
      })),
    ];
  }, [entries]);

  const visible = useMemo(() => {
    const filtered = region === 'ALL' ? entries : entries.filter((e) => e.region === region);

    // Never mutate the prop array.
    return [...filtered].sort((a, b) =>
      sort === 'CAPTURE'
        ? (b.acquiredDate ?? '').localeCompare(a.acquiredDate ?? '')
        : a.locationLabel.localeCompare(b.locationLabel),
    );
  }, [entries, region, sort]);

  const [lead, ...rest] = visible;

  return (
    <div className="flex flex-col gap-12 min-[1280px]:gap-16 min-[1920px]:gap-20">
      <div className="flex flex-col gap-8 min-[768px]:flex-row min-[768px]:items-end min-[768px]:justify-between min-[768px]:gap-12">
        <div className="flex flex-col gap-8 min-[768px]:flex-row min-[768px]:gap-12 min-[1920px]:gap-16">
          <SegmentedControl label="Region" segments={regionSegments} value={region} onChange={setRegion} />
          <SegmentedControl label="Sort" segments={SORTS} value={sort} onChange={setSort} />
        </div>
        <span aria-live="polite" className="text-label uppercase ink-dim">
          {String(visible.length).padStart(2, '0')} of {String(entries.length).padStart(2, '0')} files
          {region === 'ALL' ? '' : ` — ${REGION_LABEL[region]}`}
        </span>
      </div>

      {lead ? (
        <>
          <ArchiveLead
            key={lead.code}
            code={lead.code}
            src={lead.src}
            alt={lead.alt}
            city={lead.city}
            country={lead.country}
            region={REGION_LABEL[lead.region]}
            summary={lead.summary}
            acquiredLabel={lead.acquiredLabel}
            lat={lead.lat}
            lon={lead.lon}
            caption={LEAD_CAPTION[sort]}
          />

          {rest.length > 0 ? (
            <div className="flex flex-col gap-6">
              <p className="text-label uppercase ink-faint">
                {sort === 'CAPTURE' ? 'Earlier captures' : 'The rest of the index'}
              </p>
              <ul className="flex flex-col border-b rule-ground">
                {rest.map((e) => (
                  <ArchiveRow
                    key={e.code}
                    code={e.code}
                    city={e.city}
                    region={REGION_LABEL[e.region]}
                    acquiredLabel={e.acquiredLabel}
                    acquiredDate={e.acquiredDate}
                    lat={e.lat}
                    lon={e.lon}
                  />
                ))}
              </ul>
            </div>
          ) : null}
        </>
      ) : (
        <div className="flex max-w-[52ch] flex-col items-start gap-5">
          <h3 className="text-heading ink">No files in this region.</h3>
          <p className="text-body ink-dim">
            The reference archive does not hold a frame over this part of the world yet. Every
            other region is one control away — or run a mission and put your own coordinates on
            the record.
          </p>
          <Button variant="secondary" size="md" onClick={() => setRegion('ALL')}>
            Show all files
          </Button>
        </div>
      )}
    </div>
  );
}
