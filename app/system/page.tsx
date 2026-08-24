import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import {
  ActionButton,
  Band,
  Container,
  CreditBox,
  CropMarks,
  DataRow,
  DossierCard,
  EmptyState,
  FileTags,
  Grid12,
  HairlineFrame,
  ImagePlate,
  KeyValueGrid,
  MissionCode,
  NumberedList,
  OrbitDiagram,
  Rule,
  ScanSweep,
  SectionHeader,
  Skeleton,
  Spacer,
  StatusChip,
  TelemetryLabel,
  type BandRhythm,
} from '@/components/fui';
import { frameBySlug, HERO_FRAME } from '@/lib/imagery';
import { formatCoordsHemisphere } from '@/lib/utils';

export const metadata: Metadata = {
  title: 'System reference',
  description: 'Internal reference for the visual system: tokens, primitives and states.',
  robots: { index: false, follow: false },
};

const HERO = HERO_FRAME;
const BERLIN = frameBySlug('berlin-de') ?? HERO;
const SEATTLE = frameBySlug('seattle-us') ?? HERO;

/* ------------------------------------------------------------------ */
/* Local scaffolding. These helpers exist only to lay out this page —  */
/* they are deliberately NOT exported into the system.                 */
/* ------------------------------------------------------------------ */

/**
 * A documented section. It composes <Band>, so this page is itself built on
 * the band rhythm it documents — and its padding varies section by section
 * rather than repeating one spacer, which is the point of §04.
 */
function Section({
  index,
  title,
  meta,
  note,
  top = 'open',
  bottom = 'snug',
  children,
}: {
  index: string;
  title: string;
  meta?: string;
  note: string;
  top?: BandRhythm;
  bottom?: BandRhythm;
  children: ReactNode;
}) {
  return (
    <Band top={top} bottom={bottom}>
      <SectionHeader index={index} title={title} meta={meta} id={`s${index}`} />
      <p className="mt-4 max-w-[68ch] text-body text-paper-dim">{note}</p>
      <div className="mt-8">{children}</div>
    </Band>
  );
}

/**
 * A measured note under a demonstration.
 *
 * NOT telemetry. This used to be `font-mono text-tele-s uppercase` on a
 * 68ch measure, which made it the one place in the codebase where a
 * prose style was BUILT out of a label style — nine call sites, every
 * one of them two or three full sentences, on the page whose own copy
 * says "shell UI is sentence case; uppercase belongs to the label
 * eyebrow and the monospace telemetry layer — nowhere else". The
 * design system's documentation was breaking the rule it documents.
 *
 * A 68ch measure was the giveaway: a label is never 68 characters
 * wide. It is the `note` role now — sans, sentence case, negative
 * tracking (§A2).
 */
function Spec({ children }: { children: ReactNode }) {
  return (
    <p className="mt-4 max-w-[68ch] text-note text-paper-faint">{children}</p>
  );
}

function Swatch({ token, hex, use }: { token: string; hex: string; use: string }) {
  return (
    <div className="flex items-stretch gap-3 border border-hairline">
      <div
        className="w-14 shrink-0 border-r border-hairline"
        style={{ backgroundColor: `var(--color-${token})` }}
        aria-hidden
      />
      <div className="flex min-w-0 flex-col justify-center gap-1.5 py-3 pr-3">
        <span className="font-mono text-tele-s uppercase text-paper">{token}</span>
        <span data-telemetry className="font-mono text-tele-s uppercase text-paper-faint">
          {hex}
        </span>
        <span className="text-body text-paper-dim">{use}</span>
      </div>
    </div>
  );
}

/**
 * One type role, rendered at its own class with the measured values beside it.
 * The values are getComputedStyle readings from reference/TOKENS.md §3, not
 * design intentions — if a role stops matching its row, the row is wrong.
 */
function TypeRow({
  token,
  spec,
  className,
  sample,
  mono = false,
}: {
  token: string;
  spec: string;
  className: string;
  sample: string;
  mono?: boolean;
}) {
  return (
    <div className="border-t border-hairline py-6">
      <div className="flex flex-wrap items-baseline gap-x-5 gap-y-1">
        <span className="font-mono text-tele-s uppercase text-paper-dim">{token}</span>
        <span data-telemetry className="font-mono text-tele-s uppercase text-paper-faint">
          {spec}
        </span>
      </div>
      <p className={`mt-4 max-w-[46ch] ${className} ${mono ? 'font-mono uppercase' : ''} text-paper`}>
        {sample}
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */

const PALETTE = [
  { token: 'void', hex: '#08090B', use: 'Page ground. Every screen starts here.' },
  { token: 'deck', hex: '#0D0F13', use: 'Raised panel. Frames, cards, rails.' },
  { token: 'deck-2', hex: '#14171C', use: 'Inset well and hover fill.' },
  { token: 'hairline', hex: '#23262C', use: 'The 1px rule. The only divider.' },
  { token: 'hairline-soft', hex: '#171A1F', use: 'Rule inside a panel, one step quieter.' },
  { token: 'hairline-strong', hex: '#363B44', use: 'Active or focused frame.' },
  { token: 'paper', hex: '#EEEDE8', use: 'Primary text and the credit rule.' },
  { token: 'paper-dim', hex: '#9AA0A6', use: 'Body copy, secondary labels.' },
  { token: 'paper-faint', hex: '#5F656C', use: 'Metadata, disabled, rule text.' },
  { token: 'signal', hex: '#FF4D1C', use: 'Status and live only. Never decoration.' },
  { token: 'signal-dim', hex: '#8C2C11', use: 'Signal held back — pressed, resolved.' },
  { token: 'signal-faint', hex: '#3A1409', use: 'Signal wash behind an alert rule.' },
];

/** The five measured padding values. There is no sixth, and no uniform one. */
const RHYTHM: { name: BandRhythm; px: string; use: string }[] = [
  { name: 'flush', px: '0 px', use: 'Full-bleed media. Butts against its neighbour.' },
  { name: 'tight', px: '20 px', use: 'A band following a full-bleed one.' },
  { name: 'snug', px: '32 px', use: 'Closing padding under a dense band.' },
  { name: 'open', px: '48 px', use: 'The standard padded content band.' },
  { name: 'footer', px: '56 px', use: 'The footer, and nothing else.' },
];

const PROCESS = [
  {
    index: '01',
    title: 'TARGET FILED',
    body: 'An address is resolved to decimal coordinates and a capture area. The customer sees the area, not a street pin.',
  },
  {
    index: '02',
    title: 'SATELLITE TASKED',
    body: 'The coordinates go to the imaging provider. A capture window opens; passes are attempted until the frame clears cloud.',
  },
  {
    index: '03',
    title: 'FRAME COMPOSED',
    body: 'The capture is graded and composed with its telemetry: coordinates, timestamp, orbit, mission code, credit.',
  },
  {
    index: '04',
    title: 'PRINTED LOCALLY',
    body: 'US orders print in the US, EU orders in the EU. The print ships from the facility nearest the address on file.',
  },
];

/** Every primitive exported by components/fui, and where it is demonstrated. */
const INVENTORY: { name: string; section: string }[] = [
  { name: 'Band', section: '04' },
  { name: 'Container', section: '03' },
  { name: 'Grid12', section: '03' },
  { name: 'Spacer', section: '04' },
  { name: 'TelemetryLabel', section: '07' },
  { name: 'SectionHeader', section: 'Every head on this page' },
  { name: 'MissionCode', section: '07' },
  { name: 'FileTags', section: '07' },
  { name: 'DataRow', section: '07' },
  { name: 'KeyValueGrid', section: '07' },
  { name: 'NumberedList', section: '12' },
  { name: 'HairlineFrame', section: '06' },
  { name: 'CropMarks', section: '06' },
  { name: 'Rule', section: '06' },
  { name: 'GrainOverlay', section: '14' },
  { name: 'ImagePlate', section: '05' },
  { name: 'DossierCard', section: '11' },
  { name: 'StatusChip', section: '08' },
  { name: 'OrbitDiagram', section: '08' },
  { name: 'Skeleton', section: '09' },
  { name: 'EmptyState', section: '09' },
  { name: 'ScanSweep', section: '09' },
  { name: 'ActionButton', section: '10' },
  { name: 'CreditBox', section: '13' },
];

export default function SystemPage() {
  return (
    <main>
      {/* Clears the absolute site bar, which scrolls with the page.
          `--site-bar-h` is the ONE number the bar publishes for this — 70px
          to 1024 and 90px above it. The hard-coded `h-14` that stood here
          was a copy of a 56px bar that no longer exists, so from 1024 up the
          masthead's first line rendered underneath the plate. Never re-type
          this height; read the token. */}
      <div aria-hidden className="h-[var(--site-bar-h)]" />

      {/* ---------------- Masthead ---------------- */}
      <Band top="tight" bottom="snug">
        <Container>
          <Grid12>
            <div className="col-span-12 lg:col-span-6">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                {/* §A5: a masthead badge is not a state. Was `signal`. */}
                <TelemetryLabel tone="dim" size="xs">
                  INTERNAL
                </TelemetryLabel>
                <TelemetryLabel tone="faint" size="xs">
                  DESIGN SYSTEM / REV 03
                </TelemetryLabel>
                <TelemetryLabel tone="faint" size="xs">
                  NOT INDEXED
                </TelemetryLabel>
              </div>

              <h1 className="mt-5 max-w-[16ch] text-display text-paper">Field manual</h1>
              <p className="mt-5 max-w-[54ch] text-body text-paper-dim">
                Every token, primitive and state in the product, rendered once so the team can
                audit it in one pass. The values on this page are measurements from
                reference/TOKENS.md, not preferences. If a screen needs a visual idea that is
                not here, it is added here first and consumed second.
              </p>
            </div>

            <div className="col-span-12 self-end lg:col-span-5 lg:col-start-8">
              <KeyValueGrid
                columns={2}
                items={[
                  { label: 'PRIMITIVES', value: '24' },
                  { label: 'TYPE ROLES', value: '06' },
                  { label: 'CONTAINER', value: '1440 PX' },
                  { label: 'GUTTER', value: '32 PX' },
                  { label: 'BAND VALUES', value: '0 / 20 / 32 / 48 / 56' },
                  { label: 'ACCENT COLOURS', value: '01' },
                  { label: 'CORNER RADIUS', value: '2 PX' },
                  /* §A5: decorative emphasis on a static spec value. */
                  { label: 'SPINNERS', value: 'NONE' },
                ]}
              />
            </div>
          </Grid12>
        </Container>
      </Band>

      <Container>
        {/* ---------------- 01 Palette ---------------- */}
        <Section
          index="01"
          title="Palette"
          meta="12 tokens"
          note="Near-black ground, paper ink, one accent. The satellite image supplies all other colour, which is why the interface holds none. Signal orange marks status and live elements only — measured discipline is one accent, used once on a page. A signal-coloured element that is not reporting a state is a bug."
          top="tight"
        >
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {PALETTE.map((p) => (
              <Swatch key={p.token} {...p} />
            ))}
          </div>
          <Spec>
            Use as Tailwind utilities — <code>bg-void</code> / <code>border-hairline</code> /{' '}
            <code>text-paper-dim</code> / <code>text-signal</code>. Never hard-code a hex outside{' '}
            <code>app/globals.css</code>.
          </Spec>
        </Section>

        {/* ---------------- 02 Type ---------------- */}
        <Section
          index="02"
          title="Type roles"
          meta="Inter / IBM Plex Mono"
          note="Six roles and no seventh. Display and body are Inter; labels and data are IBM Plex Mono, uppercase and letterspaced. Note the two findings that are easy to get wrong: display is set at weight 400, not bold, and body line-height is 1.2, not 1.6. The scale compresses from both ends on a phone — display shrinks while label, body and action grow."
        >
          <div>
            <TypeRow
              token="text-display"
              spec="40 PX @1440 → 32 PX @390 · W400 · −0.02EM · LH 1.25"
              className="text-display"
              sample="A photograph of your home, taken from orbit."
            />
            <TypeRow
              token="text-heading"
              spec="24 PX @1440 → 20 PX @390 · W400 · −0.02EM · LH 1.25"
              className="text-heading"
              sample="The capture window opens for six days."
            />
            <TypeRow
              token="text-body"
              spec="15 PX @1440 → 16 PX @390 · LH 1.2 · SHORT BLOCKS ONLY"
              className="text-body"
              sample="Give an address. A satellite is tasked. The frame is composed with its telemetry, printed in your region and shipped as a finished object."
            />
            <TypeRow
              token="text-prose"
              spec="15 PX · LH 1.55 · LONG-FORM READING ONLY — /LEGAL"
              className="text-prose"
              sample="A mission is a request to photograph a single address from orbit and to deliver that photograph as a finished print. The digital file is a by-product of producing it."
            />
            <TypeRow
              token="text-label"
              spec="12 PX @1440 → 13 PX @390 · W500 · +0.04EM · UPPERCASE"
              className="text-label uppercase"
              sample="Capture window open"
            />
            <TypeRow
              token="text-action"
              spec="14 PX @1440 → 15 PX @390 · LH 1.05 · SENTENCE CASE"
              className="text-action"
              sample="Start mission"
            />
            <TypeRow
              token="text-tele"
              spec="11 PX · +0.14EM · TELEMETRY LAYER"
              className="text-tele"
              sample="Mission 32BF / capture window open"
              mono
            />
            <TypeRow
              token="text-tele-s"
              spec="10 PX · +0.16EM"
              className="text-tele-s"
              sample="34.0522, -118.2437 · 18:42 11.02.2026"
              mono
            />
            <TypeRow
              token="text-tele-xs"
              spec="9 PX · +0.20EM · CROP RAIL AND CREDIT ONLY"
              className="text-tele-xs"
              sample="Shot from Space / print credit"
              mono
            />
          </div>
          <Spec>
            Shell UI is sentence case. Uppercase belongs to the label eyebrow and the monospace
            telemetry layer — nowhere else, and never to a sentence. Readouts carry{' '}
            <code>data-telemetry</code> for tabular figures.
          </Spec>
        </Section>

        {/* ---------------- 03 Container and grid ---------------- */}
        <Section
          index="03"
          title="Container and grid"
          meta="1440 / 32 / 12 col"
          note="One container, three widths, one grid. Wide carries every top-level band; narrow carries prose and forms; flush is for media that must reach the viewport edge. The 12-column grid holds at every width — the column count never drops to four on a phone, spans change instead, which is what keeps the layout reading as one system rather than three breakpoint designs."
        >
          <div className="flex flex-col gap-4">
            <div className="border border-hairline bg-deck/30 px-4 py-5">
              <TelemetryLabel tone="dim" size="xs">
                CONTAINER SIZE=&quot;WIDE&quot; — MAX 1440, GUTTER 32
              </TelemetryLabel>
            </div>
            <div className="mx-auto w-full max-w-[760px] border border-hairline bg-deck/30 px-4 py-5">
              <TelemetryLabel tone="dim" size="xs">
                CONTAINER SIZE=&quot;NARROW&quot; — MAX 760, GUTTER 32
              </TelemetryLabel>
            </div>
            <div className="border border-hairline bg-deck/30 px-4 py-5">
              <TelemetryLabel tone="dim" size="xs">
                CONTAINER SIZE=&quot;FLUSH&quot; — NO MAX, NO GUTTER
              </TelemetryLabel>
            </div>
          </div>

          <div className="mt-8">
            <TelemetryLabel tone="faint" size="xs" as="p">
              GRID12 — 12 COLUMNS, 20 PX COLUMN GAP, 18 PX ROW GAP
            </TelemetryLabel>
            <Grid12 className="mt-3">
              {Array.from({ length: 12 }).map((_, i) => (
                <div
                  key={i}
                  className="col-span-1 border border-hairline bg-deck/40 py-6 text-center"
                >
                  <span data-telemetry className="font-mono text-tele-xs uppercase text-paper-faint">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                </div>
              ))}
              <div className="col-span-12 border border-hairline bg-deck/40 px-3 py-3 lg:col-span-7">
                <TelemetryLabel tone="dim" size="xs">
                  COL-SPAN-12 LG:COL-SPAN-7
                </TelemetryLabel>
              </div>
              <div className="col-span-12 border border-hairline bg-deck/40 px-3 py-3 lg:col-span-4 lg:col-start-9">
                <TelemetryLabel tone="dim" size="xs">
                  LG:COL-SPAN-4 LG:COL-START-9
                </TelemetryLabel>
              </div>
            </Grid12>
          </div>
          <Spec>
            No screen sets its own max-width and no screen declares its own gutter. Both come
            from <code>Container</code>.
          </Spec>
        </Section>

        {/* ---------------- 04 Band rhythm ---------------- */}
        <Section
          index="04"
          title="Band rhythm"
          meta="0 / 20 / 32 / 48 / 56"
          note="The single most important measurement in the system. Section padding on the reference page is 0, 20, 32, 48 or 56 — never one repeated value. Sections are sized by their media; the rhythm comes from padded bands alternating with full-bleed plates that butt directly against their neighbours. A uniform py-12 on every section is the fastest way to make a page read as a template."
          bottom="open"
        >
          <div className="grid gap-4 lg:grid-cols-2">
            <div>
              {RHYTHM.map((r) => (
                <div
                  key={r.name}
                  className="flex items-baseline justify-between gap-6 border-t border-hairline py-3"
                >
                  <span className="text-label uppercase text-paper">{r.name}</span>
                  <span className="flex-1 text-body text-paper-dim">{r.use}</span>
                  <span
                    data-telemetry
                    className="shrink-0 font-mono text-tele-s uppercase tabular-nums text-paper-dim"
                  >
                    {r.px}
                  </span>
                </div>
              ))}
            </div>

            <div className="border border-hairline">
              <div className="bg-deck/40 pt-[var(--band-open)] pb-[var(--band-open)]">
                <p className="px-4 text-body text-paper-dim">
                  Padded band — top and bottom at 48.
                </p>
              </div>
              <div className="relative h-24 bg-deck-2">
                <CropMarks length={12} inset={6} />
                <p className="absolute bottom-3 left-4 font-mono text-tele-s uppercase text-paper-faint">
                  FLUSH PLATE — 0 / 0
                </p>
              </div>
              <div className="bg-deck/40 pt-[var(--band-tight)] pb-[var(--band-snug)]">
                <p className="px-4 text-body text-paper-dim">
                  Following band — 20 above, 32 below.
                </p>
              </div>
            </div>
          </div>

          <div className="mt-8">
            <TelemetryLabel tone="faint" size="xs" as="p">
              SPACER — BASE 32 / LG 48 / XXL 80—112, FOR GAPS INSIDE A BAND
            </TelemetryLabel>
            <div className="mt-3 border border-hairline bg-deck/30 px-4">
              <Rule />
              <Spacer size="base" />
              <Rule />
              <Spacer size="lg" />
              <Rule />
            </div>
          </div>
          <Spec>
            <code>Band</code> takes top and bottom separately and they are rarely the same
            value. There is no uniform section spacer token and none is to be added.
          </Spec>
        </Section>

        {/* ---------------- 05 Image plate ---------------- */}
        <Section
          index="05"
          title="Image plate"
          meta="The hero"
          note="The most important component on the site. A hairline frame, registration marks, and one telemetry rail beneath the picture. The rail holds at most six values: coordinates, timestamp and up to four file tags. Extra tags are dropped, never wrapped into a second band."
          top="tight"
        >
          <div className="flex flex-col gap-10">
            <ImagePlate
              src={HERO.src}
              alt={`Satellite frame of ${HERO.city}, ${HERO.country}, captured from orbit`}
              width={HERO.width}
              height={HERO.height}
              lat={HERO.lat}
              lon={HERO.lon}
              capturedAt={HERO.acquired.date ?? undefined}
              tags={['16:9', 'JPEG', 'ORIGINAL', 'DECLASSIFIED']}
              priority
              sizes="(min-width: 1024px) 1100px, 100vw"
              caption="Default plate. Intrinsic ratio, full rail, no credit. This is the form used inside a mission dossier."
            />

            <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
              <ImagePlate
                src={BERLIN.src}
                alt={`Satellite frame of ${BERLIN.city}, ${BERLIN.country}`}
                width={BERLIN.width}
                height={BERLIN.height}
                lat={BERLIN.lat}
                lon={BERLIN.lon}
                capturedAt={BERLIN.acquired.date ?? undefined}
                aspect="4 / 3"
                credit
                label="EXHIBIT / A"
                tags={['4:3', 'PRINT PROOF']}
                sizes="(min-width: 1024px) 50vw, 100vw"
                caption="Credit, label and a fixed crop. The credit box sits in the frame corner, at its smallest size, and is the only thing ever printed over the picture."
              />
              <ImagePlate
                src={SEATTLE.src}
                alt={`Satellite frame of ${SEATTLE.city}, ${SEATTLE.country}`}
                width={SEATTLE.width}
                height={SEATTLE.height}
                aspect="1 / 1"
                sizes="(min-width: 1024px) 50vw, 100vw"
                caption="No telemetry at all. When a plate sits beside a block of readouts, the rail is dropped so the two do not repeat each other."
              />
            </div>
          </div>
          <Spec>
            Props — <code>src alt width height lat lon capturedAt tags caption aspect priority
            sizes credit label creditAlign className</code>.
          </Spec>
        </Section>

        {/* ---------------- 06 Surfaces ---------------- */}
        <Section
          index="06"
          title="Surfaces and marks"
          meta="Frame / crop / rule"
          note="A dossier has no drop shadows and no rounded corners. Depth is a 1px hairline and a darker well. Corner marks are registration marks — they say the thing is a frame, not that it is clickable."
        >
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <HairlineFrame label="FRAME" tag="DEFAULT" innerClassName="p-4">
              <p className="text-body text-paper-dim">
                The base surface. A label bar appears only when the frame is holding a named
                block.
              </p>
            </HairlineFrame>
            <HairlineFrame tone="active" label="FRAME" tag="ACTIVE" corners innerClassName="p-4">
              <p className="text-body text-paper-dim">
                Active tone plus registration marks. Used for the block a screen is currently
                acting on.
              </p>
            </HairlineFrame>
            <HairlineFrame tone="alert" label="FRAME" tag="ALERT" innerClassName="p-4">
              <p className="text-body text-paper-dim">
                Alert tone. Reserved for a block reporting a failed or blocked step.
              </p>
            </HairlineFrame>
          </div>

          <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="relative h-28 border border-hairline bg-deck/30">
              <CropMarks length={14} inset={8} />
              <span className="absolute bottom-3 left-4 font-mono text-tele-xs uppercase text-paper-faint">
                CROPMARKS TONE=PAPER
              </span>
            </div>
            <div className="relative h-28 border border-hairline bg-deck/30">
              <CropMarks length={14} inset={8} tone="signal" />
              <span className="absolute bottom-3 left-4 font-mono text-tele-xs uppercase text-paper-faint">
                CROPMARKS TONE=SIGNAL
              </span>
            </div>
          </div>

          <div className="mt-8">
            <Rule />
            <p className="py-3 font-mono text-tele-s uppercase text-paper-faint">RULE — DEFAULT</p>
            <Rule tone="soft" />
            <p className="py-3 font-mono text-tele-s uppercase text-paper-faint">RULE — SOFT</p>
          </div>
        </Section>

        {/* ---------------- 07 Data ---------------- */}
        <Section
          index="07"
          title="Data readouts"
          meta="Row / grid / tags"
          note="Label left, dotted lead, value right. The lead shrinks before the value does, so a long value wraps under its own label instead of forcing a horizontal scroll at 390px."
          bottom="open"
        >
          <div className="grid grid-cols-1 gap-10 lg:grid-cols-2">
            <div>
              <TelemetryLabel tone="faint" size="xs" as="p">
                DATAROW — THREE TONES
              </TelemetryLabel>
              <div className="mt-3 border-t border-hairline">
                <DataRow label="SENSOR" value={HERO.orbit.sensor} className="border-b border-hairline-soft" />
                <DataRow
                  label="GROUND SAMPLE"
                  value={`${HERO.orbit.gsdM} M / PX`}
                  tone="dim"
                  className="border-b border-hairline-soft"
                />
                <DataRow
                  label="STATUS"
                  value="CAPTURE WINDOW OPEN"
                  tone="signal"
                  className="border-b border-hairline-soft"
                />
              </div>
            </div>

            <div>
              <TelemetryLabel tone="faint" size="xs" as="p">
                KEYVALUEGRID — COLUMNS=2
              </TelemetryLabel>
              <div className="mt-3">
                <KeyValueGrid
                  columns={2}
                  items={[
                    { label: 'MISSION', value: '32BF' },
                    { label: 'REGION', value: 'US / RENO, NV' },
                    { label: 'COORDINATES', value: formatCoordsHemisphere(HERO.lat, HERO.lon) },
                    { label: 'CLOUD', value: `${HERO.orbit.cloudPct}%` },
                    { label: 'OFF-NADIR', value: `${HERO.orbit.offNadirDeg}°` },
                    { label: 'ALTITUDE', value: `${HERO.orbit.altitudeKm} KM` },
                  ]}
                />
              </div>
            </div>
          </div>

          <div className="mt-10 flex flex-col gap-6">
            <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
              <MissionCode code="32BF" size="sm" />
              <MissionCode code="74KL" size="md" />
              <MissionCode code="18QD" size="lg" tone="signal" />
            </div>
            <FileTags tags={['16:9', 'JPEG', 'ORIGINAL', 'DECLASSIFIED']} />
            <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2">
              <TelemetryLabel tone="bright">BRIGHT</TelemetryLabel>
              <TelemetryLabel tone="dim">DIM</TelemetryLabel>
              <TelemetryLabel tone="faint">FAINT</TelemetryLabel>
              <TelemetryLabel tone="signal">SIGNAL</TelemetryLabel>
              <TelemetryLabel tone="dim" size="xs">
                SIZE XS
              </TelemetryLabel>
            </div>
          </div>
        </Section>

        {/* ---------------- 08 Status + instrument ---------------- */}
        <Section
          index="08"
          title="Status and instruments"
          meta="One diagram per viewport"
          note="Chips report a stage; the orbit diagram reports a pass. The diagram is instrumentation — bearing ring, graticule, ground track, pass marker — and the rule is one per viewport. Two of them on a screen is the fastest way to make the page look like a toy."
          top="tight"
        >
          <div className="flex flex-wrap items-center gap-3">
            <StatusChip label="FILED" state="done" />
            <StatusChip label="CAPTURE WINDOW OPEN" state="active" />
            <StatusChip label="PRINT QUEUED" state="pending" />
            <StatusChip label="PASS MISSED" state="alert" />
          </div>

          <div className="mt-10 flex flex-wrap items-start gap-10">
            <OrbitDiagram
              track={HERO.orbit.track}
              inclination={HERO.orbit.inclination}
              altitudeKm={HERO.orbit.altitudeKm}
              size={168}
            />
            <div className="max-w-[42ch]">
              <p className="text-body text-paper-dim">
                The tilt is read from the track string, so the drawing always agrees with its
                label. Strokes are non-scaling: hairlines stay 1px whether the diagram is drawn
                at 96px or 220px. Pass <code className="font-mono text-paper">animated</code>{' '}
                only when a pass is genuinely live.
              </p>
              <Spec>
                Props — <code>track inclination altitudeKm size phase animated</code>.
              </Spec>
            </div>
          </div>
        </Section>

        {/* ---------------- 09 States ---------------- */}
        <Section
          index="09"
          title="States"
          meta="Loading / empty / error / disabled"
          note="There is no spinner in this product. A pending thing is a plate being scanned, an unavailable thing is hatched like a struck-out field, and a failure states what failed and what happens next, in mission voice."
        >
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div>
              <TelemetryLabel tone="faint" size="xs" as="p">
                SKELETON — ASPECT
              </TelemetryLabel>
              <div className="mt-3">
                <Skeleton aspect="4 / 3" lines={2} />
              </div>
            </div>
            <div>
              <TelemetryLabel tone="faint" size="xs" as="p">
                SKELETON — LINES
              </TelemetryLabel>
              <div className="mt-3">
                <Skeleton lines={5} label="RESOLVING" />
              </div>
            </div>
            <div>
              <TelemetryLabel tone="faint" size="xs" as="p">
                SCANSWEEP — REPEATING
              </TelemetryLabel>
              <div className="relative mt-3 h-[7.5rem] overflow-hidden border border-hairline bg-deck/40">
                <ScanSweep repeat tone="signal" />
                <span className="absolute bottom-3 left-4 font-mono text-tele-s uppercase text-paper-faint">
                  ACQUIRING FRAME
                </span>
              </div>
            </div>
          </div>

          <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
            <EmptyState
              title="NO MISSIONS ON FILE"
              detail="This account has not filed a target yet. Start a mission and the record will appear here as soon as the address is resolved."
              action={<ActionButton href="/start" size="sm">START MISSION</ActionButton>}
            />
            <div className="flex flex-col gap-6">
              <div className="fui-error px-4 py-4">
                <p className="font-mono text-tele-s uppercase text-signal">CAPTURE FAILED</p>
                <p className="mt-3 max-w-[52ch] text-body text-paper-dim">
                  Cloud cover exceeded the threshold on three consecutive passes. The window has
                  been reopened at no cost. No action is required.
                </p>
              </div>
              <div className="fui-disabled border border-hairline px-4 py-4">
                <p className="font-mono text-tele-s uppercase">
                  FORMAT F70 — UNAVAILABLE IN THIS REGION
                </p>
              </div>
            </div>
          </div>
        </Section>

        {/* ---------------- 10 Actions ---------------- */}
        <Section
          index="10"
          title="Actions"
          meta="Three variants"
          note="One control, everywhere: 3px radius, a self-coloured 1px border, 44/44/52px tall on 20/32/40px of inline padding, and a monospace uppercase label at 12px on positive tracking. Primary is ink on ground and recedes one step on hover; secondary is a 45% hairline; ghost is text. Every size clears a 44px tap target — small means narrower, never shorter. <Button>, <ActionButton> and <CommsButton> are three APIs over this one anatomy."
          bottom="open"
        >
          <div className="flex flex-wrap items-center gap-3">
            <ActionButton size="lg">START MISSION</ActionButton>
            <ActionButton variant="ghost">VIEW DOSSIER</ActionButton>
            <ActionButton variant="quiet" size="sm">
              DOWNLOAD RECEIPT
            </ActionButton>
          </div>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <ActionButton loading>TASKING SATELLITE</ActionButton>
            <ActionButton disabled>PAYMENT PENDING</ActionButton>
            <ActionButton
              variant="ghost"
              trailing={
                <span aria-hidden className="text-paper-faint">
                  →
                </span>
              }
            >
              CONTINUE
            </ActionButton>
          </div>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <ActionButton size="sm" variant="ghost">
              Narrow
            </ActionButton>
            <ActionButton variant="ghost">Default</ActionButton>
            <ActionButton size="lg" variant="ghost">
              Wide
            </ActionButton>
          </div>
          <Spec>
            Loading keeps the label at full strength, dims the words and runs a sweep. Disabled
            withdraws the whole face to 35% rather than rebuilding it, so a disabled primary can
            never be mistaken for an enabled secondary. Neither uses a spinner.
          </Spec>
        </Section>

        {/* ---------------- 11 Cards ---------------- */}
        <Section
          index="11"
          title="Dossier card"
          meta="Gallery unit"
          note="A mission, filed: image plate on top, telemetry block beneath. The whole card is one link, so the tap target is the card, not the code."
          top="tight"
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <DossierCard
              code="32BF"
              src={HERO.src}
              alt={`Satellite frame of ${HERO.city}`}
              locationLabel={`${HERO.city}, ${HERO.admin}`}
              capturedAt={HERO.acquired.date ?? ''}
              lat={HERO.lat}
              lon={HERO.lon}
              tags={['16:9', 'ORIGINAL']}
              status="FINAL APPROACH"
              statusState="active"
              href="/missions"
            />
            <DossierCard
              code="18QD"
              src={BERLIN.src}
              alt={`Satellite frame of ${BERLIN.city}`}
              locationLabel={`${BERLIN.city}, ${BERLIN.country}`}
              capturedAt={BERLIN.acquired.date ?? ''}
              lat={BERLIN.lat}
              lon={BERLIN.lon}
              tags={['3:2', 'DECLASSIFIED']}
              status="CAPTURE WINDOW"
              statusState="pending"
              href="/missions"
            />
            <DossierCard
              code="55RA"
              src={SEATTLE.src}
              alt={`Satellite frame of ${SEATTLE.city}`}
              locationLabel={`${SEATTLE.city}, ${SEATTLE.admin}`}
              capturedAt={SEATTLE.acquired.date ?? ''}
              lat={SEATTLE.lat}
              lon={SEATTLE.lon}
              tags={['1:1', 'JPEG']}
              status="DELIVERED"
              statusState="done"
              href="/missions"
            />
          </div>
        </Section>

        {/* ---------------- 12 Numbered list ---------------- */}
        <Section
          index="12"
          title="Numbered procedure"
          meta="The spine"
          note="Numbered sections are the spine of the site. Index in the accent, title in monospace, body in sans, hairline between every step."
        >
          <NumberedList items={PROCESS} />
        </Section>

        {/* ---------------- 13 Credit box ---------------- */}
        <Section
          index="13"
          title="The credit"
          meta="Never a logo"
          note="The name is a print credit on a film frame — a small bordered box paired with telemetry. It is set in type in exactly one component, which caps itself at md and refuses anything larger. It is never centred as a hero, never coloured with the accent, never enlarged."
        >
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <div className="border border-hairline bg-deck/30 p-4">
              <TelemetryLabel tone="faint" size="xs" as="p">
                SIZE XS — FRAME CORNER
              </TelemetryLabel>
              <div className="mt-4">
                <CreditBox
                  size="xs"
                  orientation="stack"
                  timestamp={HERO.acquired.date ?? undefined}
                  lat={HERO.lat}
                  lon={HERO.lon}
                />
              </div>
            </div>
            <div className="border border-hairline bg-deck/30 p-4">
              <TelemetryLabel tone="faint" size="xs" as="p">
                SIZE SM — DEFAULT
              </TelemetryLabel>
              <div className="mt-4">
                <CreditBox size="sm" timestamp={HERO.acquired.date ?? undefined} lat={HERO.lat} lon={HERO.lon} />
              </div>
            </div>
            <div className="border border-hairline bg-deck/30 p-4">
              <TelemetryLabel tone="faint" size="xs" as="p">
                SIZE MD — CEILING
              </TelemetryLabel>
              <div className="mt-4">
                <CreditBox size="md" align="right" timestamp={HERO.acquired.date ?? undefined} />
              </div>
            </div>
          </div>
          <Spec>
            There is no larger size. A caller passing one gets <code>sm</code>. If a screen needs
            a big line of type, it needs a headline.
          </Spec>
        </Section>

        {/* ---------------- 14 Grain ---------------- */}
        <Section
          index="14"
          title="Grain"
          meta="0.035 opacity"
          note="One fixed layer over the document, mounted once in the root layout. It sits below the header so it never films over navigation, it is pointer-events none, and it drops further on 2x displays. At this strength it reads as emulsion on the page, not as noise on the photograph. If you can see it on an image, it is too strong."
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="h-20 border border-hairline bg-void" />
            <div className="h-20 border border-hairline bg-deck" />
            <div className="h-20 border border-hairline bg-deck-2" />
          </div>
          <Spec>
            <code>GrainOverlay</code> is mounted in <code>app/layout.tsx</code>. Never mount a
            second one — two layers double the opacity.
          </Spec>
        </Section>

        {/* ---------------- 15 Inventory ---------------- */}
        <Section
          index="15"
          title="Inventory"
          meta="24 primitives"
          note="Everything components/fui exports, and the section of this page that demonstrates it. If a primitive is added to the index, it is added here in the same commit — an undocumented primitive is one nobody will find, and the second implementation of it is what breaks the system."
          bottom="footer"
        >
          <div className="grid gap-x-[var(--grid-gap-x)] sm:grid-cols-2">
            {INVENTORY.map((item) => (
              <DataRow
                key={item.name}
                label={item.name}
                value={item.section}
                tone="dim"
                className="border-b border-hairline-soft"
              />
            ))}
          </div>
        </Section>
      </Container>
    </main>
  );
}
