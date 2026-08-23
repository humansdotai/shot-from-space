# SPEC V4 — design system + conversion

Binding. Read fully before writing code.

## PART A — DESIGN SYSTEM (from anduril-design-spec.md)

Take the **structural rules**. Do NOT take their palette — `#dff140` acid green
and `#f1f0ea` bone are their identity. Ours stays: `--color-void`,
`--color-paper`, one signal accent.

### A1 · Fluid root font-size — the highest-value item
The whole layout is authored in `rem` against a scaling root. This is what
makes every measurement correct at every width instead of only one.

```css
html { font-size: 14px; }                                /* < 1280      */
@media (min-width:1280px){ html{ font-size: calc(1.25vw - 2px); } }      /* 14→16 */
@media (min-width:1440px){ html{ font-size: calc(0.416667vw + 10px); } } /* 16→18 */
@media (min-width:1920px){ html{ font-size: calc(1.25vw - 6px); } }      /* 18→24 */
@media (min-width:2400px){ html{ font-size: 24px; } }
```
Stops are continuous — each expression meets the next at its breakpoint.
Also: `html { scrollbar-gutter: stable; }`

**WARNING — migrate carefully.** Our type tokens are `clamp()` in px/rem tuned
against a 16px root. Dropping the root to 14px shrinks everything below 1280
by 12.5%. Convert deliberately and re-measure; do not just paste the ladder in.
Also re-check every `min-h-11` style tap target — 44px must stay 44 CSS px, so
tap targets and inputs should stay in px, not rem.

### A2 · The tracking sign flip — the typographic signature
Headings and body carry **negative** tracking. Uppercase labels carry
**positive** tracking (~+0.03rem). Tight display against spaced-out labels is
the whole signature.

**A label style is never a sentence.** Uppercasing prose is the most common way
to get this wrong. Audit for it.

### A3 · Motion
```css
@theme { --ease-out: cubic-bezier(0, 0, 0.58, 1); }
```
Tailwind's built-in `ease-out` is `cubic-bezier(0,0,0.2,1)` — a different,
snappier curve. Override it.
Durations: `.2s` media · `.25s` reveals · `.3s` links · `.35s` icons · `.5s`
large images.

### A4 · Card hover staging — do not collapse to one duration
- media `scale(1.03)` over `.2s` (above ~1.05 looks like a different site)
- description reveals over `.25s`
- arrow waits **`.15s`**, then fades over `.35s`
The offset is what makes it read as engineered rather than animated.

### A5 · Surfaces
Radius **2px everywhere** — essentially square. Hairline rules
`rgba(255,255,255,0.2)` on dark (use the equivalent alpha on paper).
**No shadows in the layout system.** The exceptions already agreed stay:
buttons, the 3D artifacts, and the framed poster.
The accent is a **state colour** — selection, focus, active. Never a button
fill, never a heading, never a badge.

---

## PART B — CONVERSION

Researched, not invented. Cal AI's onboarding converts ~20–25% of completers;
the mechanics below are the ones with evidence behind them.

### B1 · Order of the flow
**Ask for the email/account LAST.** Moving sign-in to the end of onboarding was
their single largest drop-off reduction. Our `/start` already collects email
late — keep it there and do not regress it.

### B2 · Investment before the ask
Questions that increase a user's time investment measurably lift conversion
**even when they do not change what the product does**. For us the honest
version already exists: typing the address and watching the capture area
resolve. Strengthen that moment rather than adding filler — the target
resolving on screen is the investment.

One extra step is justified if it genuinely personalises the object: what the
mission is for (a home, a first house, a gift, a place that mattered). It can
set the mission's dedication line. If it changes nothing, do not add it.

### B3 · Personalised plan before the paywall
Cal AI generates a personalised plan just before asking for money. Ours is a
**mission profile**: the resolved target, the capture window, the pass
geometry, the facility that will print it, the delivery estimate — assembled
and shown as a summary the buyer recognises as *theirs* before the price.

### B4 · Risk reversal at the point of payment
The five guarantees are contractual and true — full refund if no frame in 60
days, free re-tasking on cloud, replacement on damage, duties included, free
cancellation before tasking. Put them **at** the button, not in a footer.

### B5 · Objection handling
Answer the real hesitations near the decision: what resolution shows, how long
it takes, what happens if it is cloudy, where it prints, who sees the address.

### B6 · What is NOT allowed
No countdown timers, fake scarcity, fake "N people viewing", invented review
counts, star ratings, or customer names. If a claim is not true, it does not
ship. This product is bought by people who will check.

---

## PART C — THE FOUNDER'S NOTE (not a testimonial)

The owner, **Sabin Dima**, wants to vouch for the product having tested it.
That is legitimate **only if it is unmistakably the founder speaking**.

Build it as a signed founder's note:
- Attributed by name and role — Sabin Dima, founder — in the visible copy.
- Written in the first person about building and testing the pipeline himself.
- Placed as its own block. **Never** inside a customer-reviews section, never
  beside stars, a rating, a review count, or anything implying an independent
  verdict.

Do not create a testimonials carousel, a "what customers say" heading, or any
second voice. There is exactly one voice here and it is the owner's, clearly
labelled. A founder vouching for his own product is honest; the same words
dressed as an independent review are not.

---

## KEEP
Mosaic hero and cascade · 3D artifacts (patch matte, coin gloss) · framed
poster · redaction · light/dark alternation · all logic in `lib/`, `app/api/`,
`prisma/`.

## VERIFY
`npx tsc --noEmit` and `npx eslint .` clean. Dev server on **:3200** — do not
start another, do not run `npm run build`. Port 3000 is a different project.
Check 390 / 768 / 1280 / 1440 / 1920 / 2400.
