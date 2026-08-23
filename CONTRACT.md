# BUILD CONTRACT — SHOT FROM SPACE

Read this completely before writing a line. Every agent builds against this
document. It is the only source of truth for shared interfaces and ownership.

---

## 1. THE PRODUCT

Shot from Space sells one thing: **a photograph of your home captured from
space, delivered as a premium art object** (framed or unframed print).

Every order is a **MISSION** with a unique code — 2 digits + 2 letters, e.g.
`32BF`, rendered as `MISSION / 32BF`. The customer gives an address, a
satellite is tasked (provider: SkyFi), the frame is composed into a designed
poster with telemetry overlays, printed locally via Gelato (US orders print in
the US, EU orders in the EU) and shipped.

Zero employees. The whole pipeline is designed to be operated by AI agents.
First portfolio company of 0humans.

---

## 2. BRAND RULES — NON-NEGOTIABLE

1. **"SHOT FROM SPACE" IS NEVER A LOGO.** It appears only as a print credit
   and film-frame element: a small bordered box `[ SHOT FROM SPACE ]` paired
   with telemetry (timestamp, coordinates), like a credit on a film frame.
   Use `<CreditBox />`. Never centre it as a hero. Never enlarge it. Never
   style it as a wordmark, monogram or icon.
2. **Aesthetic: declassified intelligence dossier / FUI.** Reference only —
   use **zero** third-party names, logos, imagery or copyrighted assets from
   any film or company. Nothing from Anduril. Nothing from any film franchise.
3. **Structural reference: anduril.com** for layout architecture, section
   rhythm, navigation patterns and density calibration only. See
   `/reference/STRUCTURE.md`. Copy nothing: no copy, images, logos or brand
   elements.
4. **Density rule.** Film UI lives 3 seconds on screen; a website carries
   ~20% of that density. **The satellite image is the hero; the FUI layer
   frames it, never competes with it.** If a screen feels busy, delete
   telemetry, not imagery.
5. **Visual vocabulary:** small monospace labels, 1px hairline rules,
   registration/crop corner marks, coordinates + timestamps beside imagery,
   numbered sections (`01.` `02.` `03.`), file tags (`16:9`, `JPEG`,
   `ORIGINAL`, `DECLASSIFIED`), subtle film grain, orbit diagrams
   (`ORBIT: //ELIPSE 33°`).
6. **Typography:** monospace = IBM Plex Mono (`font-mono`); display/body =
   Inter (`font-sans`). Labels are ALL CAPS with letterspacing.
7. **Palette:** near-black background (`bg-void`), paper-white text
   (`text-paper`), one restrained accent (`text-signal`, signal orange
   `#ff4d1c`) **only for status / live elements**. The satellite imagery
   provides all the colour. No second accent. No gradients as decoration.
8. **Telemetry formats:** timestamp `21:34PM 02.10.2026`
   (`formatTelemetryTimestamp`), mission short link `shot.space/M32BF`
   (`missionShortLink`), coordinates in decimal degrees (`formatCoords`).
9. **Copy voice:** English, restrained, technical, mission language. No
   marketing fluff. **No exclamation marks.** No "amazing", "stunning",
   "unlock", "elevate". Write ALL real copy — **zero lorem ipsum**, zero
   placeholder boxes. Short declarative sentences.

### Density calibration, concretely
- Max **one** orbit diagram per viewport.
- Max **~6** telemetry values visible around a single image.
- Body copy is `font-sans`, not monospace. Monospace is for labels and data
  only — a paragraph of monospace is a bug.
- Whitespace is the primary compositional tool. Sections breathe.

---

## 3. STACK & CONVENTIONS

- Next.js 15.5 App Router, React 19, TypeScript strict, Tailwind CSS v4.
- Path alias: `@/*` → repo root. No `src/` directory.
- Tailwind v4 is **CSS-first**: tokens live in `app/globals.css` under
  `@theme`. There is no `tailwind.config.ts` and none should be added.
- Server Components by default. Add `'use client'` only where you need state,
  effects or event handlers.
- Data access happens on the server (`lib/db.ts`, `lib/missions/*`). Client
  components talk to `/api/*` routes.
- SQLite via Prisma 6 (`prisma/schema.prisma`). Client is generated on
  `postinstall`. `npm run dev` runs `db:push` + idempotent `db:seed` first.
- **MOCK_MODE=true by default.** A fresh clone runs the whole product with no
  keys. Never require a key. Never throw because a key is missing.
- Every external service sits behind an adapter in `lib/integrations/`.
- Accessibility: real semantics, `aria-label` on icon-only controls, visible
  focus (already styled globally), tap targets ≥ 44px, respect
  `prefers-reduced-motion` (already handled globally).
- **Mobile first.** The reviewer reviews on a phone. Design at 390px, then
  scale up. No horizontal scroll, ever.

---

## 4. FILE OWNERSHIP — STRICT

You may create and edit **only** files under your paths. If you need a change
in someone else's file, describe it in your final report instead — the
orchestrator will apply it. Never edit files listed under "Locked".

| Agent | Owns |
|---|---|
| 0 REFERENCE | `reference/**` |
| 1 DESIGN SYSTEM | `components/fui/**`, `app/globals.css`, `app/system/**` |
| 2 LANDING | `app/(site)/page.tsx` → **actually `app/page.tsx`**, `components/landing/**`, `app/how-it-works/**` |
| 3 DISCOVERY | `app/missions/**`, `components/discovery/**` |
| 4 PURCHASE | `app/start/**`, `app/checkout/**`, `components/purchase/**` |
| 5 MISSION CONTROL | `app/m/**`, `app/s/**`, `components/mission/**` |
| 6 COMMS | `components/comms/**`, `app/api/comms/**`, `lib/integrations/llm.ts`, `lib/integrations/voice.ts` |
| 7 ACCOUNT + AUTH | `app/account/**`, `app/auth/**`, `app/api/auth/**`, `app/api/account/**`, `lib/auth.ts` |
| 8 BACKEND | `prisma/**`, `lib/db.ts`, `lib/missions/**`, `lib/integrations/{stripe,skyfi,gelato,email,geocode}.ts`, `lib/integrations/index.ts`, `app/api/missions/**`, `app/api/orders/**`, `app/api/checkout/**`, `app/api/geocode/**`, `app/api/webhooks/**`, `app/api/dev/**` |
| 9 PRINT PIPELINE | `lib/poster/**`, `app/api/poster/**`, `PIPELINE.md` |
| 10 QA | everything, last |

**Locked for everyone except the orchestrator:**
`app/layout.tsx`, `components/site/**`, `lib/types.ts`, `lib/utils.ts`,
`lib/codes.ts`, `lib/pricing.ts`, `lib/imagery.ts`, `lib/env.ts`,
`lib/fonts.ts`, `package.json`, `next.config.ts`, `tsconfig.json`,
`.env.example`, root markdown files.

---

## 5. SHARED MODULES (already written — import, don't reinvent)

### `@/lib/types`
`MISSION_STAGES`, `MissionStage`, `MissionState`, `STAGE_LABEL`,
`STAGE_DESCRIPTION`, `stageIndex()`, `stageReached()`, `PrintFormat`,
`FormatId` (`F30|F50|F70`), `FrameOption` (`FRAMED|UNFRAMED`), `Currency`,
`Region` (`US|EU`), `GeoSuggestion`, `TargetAddress`, `MissionDTO`,
`MissionEventDTO`, `OrbitData`, `CommsMessageDTO`, `CommsRole`,
`VoiceLinkState`, `SessionUser`, `ApiError`.

### `@/lib/codes`
`isMissionCode`, `normalizeMissionCode`, `generateMissionCode`,
`missionShortLink`, `missionPath`, `missionSharePath`.

### `@/lib/pricing`
`FORMATS`, `getFormat`, `priceMinor`, `formatPrice`, `regionForCountry`,
`currencyForRegion`, `PRINT_FACILITY`, `FULFILMENT_NOTE`.

### `@/lib/imagery`
`CATALOGUE` (13 public-domain NASA/USGS frames with city, coordinates,
capture timestamp and full orbit telemetry), `HERO_FRAME`, `frameBySlug`.
**All example imagery must come from here.** Never invent an image path.

### `@/lib/utils`
`cn`, `formatTelemetryTimestamp`, `formatTelemetryDate`, `formatCoords`,
`formatCoordsHemisphere`, `seededUnit`, `sleep`.

### `@/lib/env`
`MOCK_MODE`, `PUBLIC_MOCK_MODE`, `SITE_URL`, `INTEGRATIONS`, `isLive()`.

### `@/components/fui`
```
TelemetryLabel  {children, tone: 'faint'|'dim'|'bright'|'signal', size: 'sm'|'xs', as}
HairlineFrame   {children, label?, tag?, corners?, className, innerClassName, as}
CropMarks       {length?, inset?, tone?}          // needs a `relative` parent
MissionCode     {code, size: 'sm'|'md'|'lg', tone?}
CreditBox       {timestamp?, lat?, lon?, align?, size?}   // THE brand element
StatusChip      {label, state: 'done'|'active'|'pending'|'alert'}
OrbitDiagram    {track?, inclination?, size?, animated?}
DossierCard     {code, src, alt, locationLabel, capturedAt, lat, lon, tags?, href?, status?, statusState?, aspect?, priority?, sizes?}
SectionHeader   {index, title, meta?}
FileTags        {tags: string[]}
DataRow         {label, value, tone?}
ActionButton    {children, variant: 'primary'|'ghost'|'quiet', size, href?, trailing?, ...button props}
Rule            {tone?: 'default'|'soft'}
GrainOverlay    // already mounted in app/layout.tsx — do not mount again
```
Tailwind token classes available: `bg-void`, `bg-deck`, `bg-deck-2`,
`border-hairline`, `border-hairline-soft`, `text-paper`, `text-paper-dim`,
`text-paper-faint`, `text-signal`, `bg-signal`.

---

## 6. ROUTE MAP

| Route | Owner | Purpose |
|---|---|---|
| `/` | 2 | Landing. Hero as a declassified file, product in one screen, CTA START MISSION |
| `/how-it-works` | 2 | The process, expanded |
| `/missions` | 3 | Mission discovery gallery |
| `/missions/[code]` | 3 | Example mission dossier |
| `/start` | 4 | Purchase: address → preview → format → email + pay |
| `/checkout/mock/[id]` | 4 | Mock hosted checkout (mock mode only) |
| `/m/[code]` | 5 | MISSION CONTROL (owner view) |
| `/s/[code]` | 5 | Read-only shared mission view |
| `/account` | 7 | Missions list |
| `/account/missions/[code]` | 7 | Order detail + receipt |
| `/auth/*` | 7 | Magic link request / verify screens |
| `/system` | 1 | Internal design-system reference page |
| `/legal/*` | orchestrator | Terms, privacy, imagery credits |

### API contract (Agent 8 implements; everyone else consumes)

```
POST /api/geocode/autocomplete   {q}                 → {suggestions: GeoSuggestion[]}
GET  /api/geocode/static?lat&lon&zoom                → image/jpeg (capture-area preview)
POST /api/orders                 {address, formatId, frame, email}
                                                     → {missionCode, checkoutUrl}
POST /api/checkout/complete      {missionCode}       → {ok, missionCode}   (mock only)
GET  /api/missions                                   → {missions: MissionDTO[]}   (public gallery)
GET  /api/missions/[code]                            → {mission: MissionDTO}
GET  /api/missions/[code]/share?k=token              → {mission: MissionDTO}      (redacted)
POST /api/dev/advance            {code, to?}         → {mission: MissionDTO}      (demo control)
POST /api/comms/[code]           {body}              → {messages: CommsMessageDTO[]}
GET  /api/comms/[code]                               → {messages: CommsMessageDTO[]}
POST /api/comms/[code]/voice     {action}            → {state: VoiceLinkState, ...}
POST /api/auth/magic-link        {email, redirectTo} → {ok, devLink?}
GET  /api/auth/verify?token=                         → redirect + session cookie
POST /api/auth/logout                                → {ok}
GET  /api/account/missions                           → {missions: MissionDTO[]}
GET  /api/poster/[code]                              → image/png  (watermarked preview)
POST /api/webhooks/{stripe,skyfi,gelato}             → 200 stub
```

All responses are JSON `{...}` on 2xx, `{error, detail?}` on 4xx/5xx.

---

## 7. DEMO DATA (seeded by Agent 8, relied on by everyone)

Four demo missions, each in a different stage so every screen is reviewable:

| Code | Stage | Frame | Region |
|---|---|---|---|
| `32BF` | `FINAL_APPROACH` (FINAL DELIVERABLE APPROACHING) | `hero-los-angeles` | US |
| `74KL` | `IMAGE_ACQUIRED` | `paris-fr` | EU |
| `18QD` | `CAPTURE_WINDOW` | `berlin-de` | EU |
| `55RA` | `DELIVERED` | `seattle-us` | US |

Demo account email: `operator@shotfromspace.com` owns all four.
The public gallery is built from `CATALOGUE` plus these demo missions.

---

## 8. WHAT "DONE" MEANS

- `npm install && npm run dev` on a fresh clone: every screen clickable end to
  end, no keys, no errors in the console.
- `npx tsc --noEmit` clean. `npm run lint` clean.
- Mobile-first flawless at 390px; desktop excellent at 1440px.
- No lorem ipsum. No unframed placeholder boxes. No third-party assets.
- Every image has real dimensions and `alt` text.
- Every loading state is designed (skeletons in the FUI language, not spinners).
- Every error state is designed and written in mission voice.

## 9. REPORTING

Finish by reporting, in plain text:
1. Files you created or changed.
2. Anything you need from a locked file.
3. Anything you stubbed and where the real implementation plugs in.
4. Known gaps.

---

## 10. SERVER MODULE CONTRACT (exact signatures)

### `@/lib/db` — Agent 8
```ts
export const prisma: PrismaClient   // singleton, dev-safe
```

### `@/lib/missions` — Agent 8
```ts
getMissionByCode(code: string, opts?: { includePrivate?: boolean }): Promise<MissionDTO | null>
getMissionByShareToken(code: string, token: string): Promise<MissionDTO | null>
listMissionsForUser(userId: string): Promise<MissionDTO[]>
listMissionsForEmail(email: string): Promise<MissionDTO[]>
createMission(input: CreateMissionInput): Promise<MissionDTO>
markMissionPaid(missionCode: string, payment: {...}): Promise<MissionDTO>
advanceMission(code: string, to?: MissionStage): Promise<MissionDTO>   // demo control
toMissionDTO(row): MissionDTO
```
`MissionDTO.previewUrl` is `/api/poster/{code}` once `stage >= IMAGE_ACQUIRED`,
otherwise `null`. `MissionDTO.deliverableUrl` is set at `DELIVERED`.

### `@/lib/auth` — Agent 7
```ts
getSessionUser(): Promise<SessionUser | null>          // reads the session cookie
requireUser(): Promise<SessionUser>                    // redirects to /auth/sign-in
createMagicLink(email: string, redirectTo?: string): Promise<{ url: string }>
consumeMagicLink(token: string): Promise<{ userId: string } | null>
signOut(): Promise<void>
```

### `@/lib/gallery` — Agent 3
```ts
export interface ExampleMission { code, slug, src, width, height, locationLabel,
  city, country, countryCode, lat, lon, capturedAt, orbit, tags, credit, source }
listExampleMissions(): ExampleMission[]      // deterministic, built from CATALOGUE
getExampleMission(code: string): ExampleMission | undefined
```
Codes are derived deterministically from the catalogue slug so links are stable.
They must not collide with the seeded demo codes `32BF 74KL 18QD 55RA`.

### `@/components/comms` — Agent 6
```tsx
<MissionComms missionCode={string} stage={MissionStage} readOnly?={boolean} />
```
Self-contained: renders the transcript, the composer, and the REQUEST VOICE
LINK control. Agent 5 mounts exactly this and nothing else.

### `@/lib/poster` + `/api/poster/[code]` — Agent 9
`GET /api/poster/{code}` → `image/png`, the watermarked low-res dossier
exhibit: satellite frame + mission code + capture timestamp +
`[ SHOT FROM SPACE ]` credit box + coordinates + orbit data. Also accepts
`?slug=` to render any catalogue frame (used by the gallery and by Agent 4's
capture-area preview if needed).

### `/api/geocode/static` — Agent 8
`GET /api/geocode/static?lat&lon&zoom&w&h` → `image/jpeg`. In mock mode this
deterministically selects and crops a `CATALOGUE` frame based on the
coordinates, so the purchase preview always shows plausible imagery for any
address. Document precisely where a real tile provider plugs in.

---

## 11. CONCURRENCY RULES WHILE THE 10 AGENTS RUN

- **Do not** run `npm install`, `npm run dev`, `prisma db push`, `db:seed`, or
  edit `prisma/dev.db` — except Agent 8, which owns the database.
- Verify your work with `npx tsc --noEmit` only.
- If you need a package that is not installed, do not install it: state the
  need in your report. Available: `next`, `react`, `zod`, `clsx`,
  `tailwind-merge`, `sharp`, `nanoid`, `@prisma/client`, `prisma`, `tsx`.
- Do not create `tailwind.config.*`. Tailwind v4 is configured in
  `app/globals.css`.
- Do not add a `src/` directory.

---

## 12. LAYOUT GRID (use verbatim)

Standard page gutter — every top-level section uses exactly this:
```
mx-auto w-full max-w-[1600px] px-4 sm:px-6 lg:px-8
```
Narrow reading column (prose, forms, dossier bodies):
```
mx-auto w-full max-w-[760px] px-4 sm:px-6
```
Vertical section rhythm: `py-16 sm:py-24 lg:py-32` for major sections,
`py-10 sm:py-14` for minor ones. The fixed header is `h-14`; `app/layout.tsx`
already applies `pt-14`, so pages start at `y = 0`.

Breakpoints: design at **390px** first, check **768px**, finish at **1440px**.
