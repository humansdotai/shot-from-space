# /start — MISSION BRIEFING, not checkout

## THE DIAGNOSIS
`/start` today is one long scrolling page: four blocks, radio buttons, a
running-total table, and copy that narrates its own mechanics back at the user
("The profile writes itself from the target, the footprint and the format",
"The last step. It opens as soon as there is a target to authorise").

That is a checkout. It sells a poster: size, finish, tube, black oak, print
subtotal, shipping line.

**We are not selling a poster.** We are selling a satellite pass over a place
that matters to someone. The print is how the mission is *delivered*. Every
screen must behave as though the mission is the product and the object is its
receipt.

## THE RESEARCHED SHAPE
Cal AI (~20–25% of completers convert) and Bible Chat share one structure:

1. Open by **demonstrating**, not asking. Cal AI opens on a short demo.
2. **One decision per screen.** Never a wall of fields. This is the single
   biggest structural difference from what we have.
3. Every answer **visibly changes something** on screen.
4. Questions that raise time investment lift conversion **even when they do not
   change the product** — but see the honesty rule below.
5. Build toward a **named, personal artifact**: Cal AI generates a personalised
   plan, Bible Chat reveals a custom-named plan. Reveal it as a moment.
6. **Soft paywall only after value is shown.**
7. **Identity last.** Cal AI's single biggest drop-off reduction was moving
   sign-in to the end. Ours already does this — do not regress it.

## THE FLOW TO BUILD
One decision per screen, advancing on selection. Progress visible. Back always
available. Nothing asks who you are until the end.

1. **OPEN — demonstrate.** A capture resolving, or `/video/intro.mp4`. One
   line: this is a satellite pass over an address you choose. One action:
   BEGIN. No form.
2. **TARGET.** "Where do you want us to look?" Address entry, full screen, one
   field. This is the emotional centre — the map resolving onto their own roof.
3. **THE AIM.** The capture area resolving over the real coordinates, with the
   footprint choice made here as a consequence of what they can see. Coordinates
   settling. This is the moment they own it.
4. **WHY.** "What is this place?" — home / first house / where we met / a place
   that is gone / something else. **This must change the object**: it sets the
   dedication line printed on the mission sheet. If the schema cannot store it,
   say so and cut the screen. Do not ship a question whose answer is discarded.
5. **THE BRIEF.** The named artifact: MISSION / CODE, their target, capture
   window, pass geometry, sun angle at the node, the facility, delivery
   estimate. This is the reveal. It should feel like being handed a file.
6. **DELIVERY.** Size and finish framed as how the mission comes back — not a
   product grid. Price appears here, once, plainly.
7. **AUTHORISE.** Email + pay. Guarantees at the button.

## COPY RULES
- **Never describe the interface.** No "this opens when…", no "the profile
  writes itself". The screen does the explaining by working.
- Mission language, second person, present tense. Short.
- The word "poster" should be rare. "Print" is fine where it is literally the
  object. The subject is the mission.
- No exclamation marks, no lorem ipsum, no invented numbers.

## HONESTY — unchanged and binding
No countdown timers, fake scarcity, "N people viewing", invented reviews,
ratings or customer names. No question whose answer is thrown away. Every
number shown must be real or clearly derived. The five guarantees must match
`/legal/terms` exactly, including the word "usable".

## VISUAL LANGUAGE (measured from the reference clone)
Root 16px · body ~16.8px / 400 / 1.2 line-height / −0.144px tracking ·
**radius 2px** · grid gap 20px column, 18px row · one accent used as a *state*
colour only, never a fill · hairlines at low alpha · no layout shadows.
Uppercase labels carry positive tracking; headings and body negative.

## KEEP
All logic: autocomplete, capture preview, region pricing, order creation, mock
checkout → `/m/{code}`, sessionStorage restore, double-submit guard, and email
collected last. This is a re-shaping of the experience, not a rewrite of
behaviour.

## VERIFY
`npx tsc --noEmit`, `npx eslint .`, and `npm test` all clean. Dev server on
**:3200** — do not start another, do not run `npm run build`. Port 3000 is a
different project. Check 390 / 768 / 1280 / 1440 / 1920.
