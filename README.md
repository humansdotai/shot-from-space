# SHOT FROM SPACE

A photograph of your home, taken from orbit on request, delivered as a framed
print. Every order is a **mission** with a code — `MISSION / 32BF`.

This repository is the complete product: landing, mission archive, purchase
flow, Mission Control, comms, account, transactional email, and the poster
composer that turns a satellite frame into the printed object.

---

## Run it

```bash
npm install
npm run dev
```

Open http://localhost:3000.

That is the whole setup. **No API keys are required.** The app boots in
`MOCK_MODE`, creates a local SQLite database, seeds four demo missions in
different stages, and runs every external service — Stripe, SkyFi, Gelato,
ElevenLabs, email, geocoding — against deterministic mock adapters with
realistic latency. A thin amber strip in the footer shows mock mode is active.

## Walk the demo

| Screen | Path |
|---|---|
| Landing | `/` |
| Process | `/how-it-works` |
| Mission archive | `/missions` |
| Example dossier | `/missions/[code]` |
| Purchase (one page) | `/start` |
| Mission Control | `/m/32BF` — final deliverable approaching |
| | `/m/74KL` — image acquired, preview released |
| | `/m/18QD` — capture window, re-tasked for cloud |
| | `/m/55RA` — delivered, file closed |
| Shared read-only view | share control on any mission page |
| Account | `/account` (sign in as `operator@shotfromspace.com`) |
| Design system | `/system` |

Sign-in is passwordless. Request a link at `/auth/sign-in`; in mock mode the
link is printed to the server console and rendered on the page.

Inside Mission Control, the amber `ADVANCE MISSION` control walks a mission
through every stage of the state machine. It exists only while `MOCK_MODE` is
true.

## Scripts

```bash
npm run dev        # db push + seed, then next dev
npm run build      # production build
npm run typecheck  # tsc --noEmit
npm run lint       # eslint
npm run db:reset   # drop and rebuild the demo database
npm run db:studio  # inspect the database
```

## Structure

```
app/            routes (App Router)
  api/          REST endpoints — missions, orders, checkout, comms, auth, poster, webhooks
  m/[code]/     Mission Control
  s/[code]/     read-only shared mission view
  start/        purchase
  missions/     archive + dossiers
  account/      orders, receipts
  system/       design system reference
components/
  fui/          the entire visual vocabulary — everything else composes these
  site/         header, footer, shell
  landing/ discovery/ purchase/ mission/ comms/ account/
lib/
  types.ts      domain model + mission state machine
  missions/     state machine, transitions, DTOs
  integrations/ Stripe · SkyFi · Gelato · ElevenLabs · email · geocode · LLM
  poster/       server-side poster composer
  imagery.ts    public-domain NASA/USGS frame catalogue
prisma/         schema + idempotent seed
reference/      structural analysis notes
```

## Documents

| File | What it is |
|---|---|
| `INTEGRATIONS.md` | Every service: what to provide, where to get it, where to paste it, what flips to live |
| `PIPELINE.md` | The real capture → composition → print pipeline and where each stub plugs in |
| `DECISIONS.md` | Judgement calls made during the build and why |
| `REVIEW.md` | What exists, what is mocked, what needs keys, known gaps |
| `CONTRACT.md` | The build contract — brand rules, ownership, shared interfaces |
| `IMAGERY.md` | Attribution for every example frame |

## Stack

Next.js 15 (App Router) · React 19 · TypeScript · Tailwind CSS v4 · Prisma 6 +
SQLite · sharp. Deployable to Vercel; see `REVIEW.md` for the one change
required (SQLite → Postgres).
