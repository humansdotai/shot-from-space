# STRUCTURE — anduril.com home page, section by section

Measured in document order from a live capture at 1440×900. Positions are
absolute `y` offsets; heights and padding are computed values.
Total page height: **≈5432px** — roughly six viewports.

**Structural reference only.** No text, image, video, font or logo from the
source appears in this product. What is recorded here is layout architecture:
order, proportion, density and rhythm.

---

## The band sequence

| # | y | height | pt / pb | media | grid | links | type roles |
|---|---|---|---|---|---|---|---|
| 1 | 0 | 864 | 0 / 0 | VIDEO | — | 0 | label 12px + display 40px |
| 2 | 864 | 479 | 20 / 0 | VIDEO | — | 1 | display 40px |
| 3 | 1343 | 1441 | 20 / 32 | IMG ×3 | — | 7 | 3 × heading 24px |
| 4 | 2784 | 850 | 48 / 48 | IMG | 12col | 1 | — |
| 5 | 2900 | 604 | 0 / 0 | IMG | — | 0 | (nested full-bleed plate) |
| 6 | 3633 | 612 | 48 / 48 | IMG | 12col | 3 | — |
| 7 | 3780 | 386 | 0 / 0 | IMG | 12col | 2 | (nested) |
| 8 | 4246 | 652 | 0 / 0 | IMG ×2 | 2col | 2 | — |
| 9 | 4898 | 534 | 56 / 56 | — | 12col | 21 | footer links |

---

## 01 · HERO — full-bleed motion, 864px (≈96vh)

A single video filling the band edge to edge. Zero padding top and bottom.
Over it: a **12px uppercase eyebrow label** (+0.04em) and a **40px display
headline** at weight 400 with −0.02em tracking. Copy sits low-left, not
centred.

**Zero links in this band.** There is no button pair. The page does not open
with "headline + two CTAs + floating screenshot" — the media *is* the argument,
and navigation happens in the bar above and the bands below.

> Adapted as: the satellite hero. Same proportions, same low-left copy block,
> same eyebrow-over-display pairing, one primary action rather than two.

## 02 · SECONDARY MOTION BAND — 479px, linked

A shorter full-bleed media band, the whole band a single link, carrying one
40px heading. Butts directly against the hero: `padding-top: 20px`,
`padding-bottom: 0`.

> Adapted as: the featured mission / archive teaser.

## 03 · EDITORIAL CARD BAND — 1441px, the tallest band on the page

Three image cards, each with a **24px heading** (a step down from the 40px
display role) and its own link. Seven links total. This is the densest
information block and it is ~1.7× the height of the hero.

> Adapted as: the three-step process band and the archive grid.

## 04–07 · SPEC BANDS — 850px and 612px, each with a nested full-bleed plate

The repeating pattern of the lower page:
- an outer band on the **12-column grid** with `48px` top and bottom padding,
  carrying one image and 1–3 links;
- a **nested plate at `padding: 0`** (604px, then 386px) that breaks full-bleed
  inside its parent.

Padded band → unpadded full-bleed plate → padded band. That alternation is what
produces the rhythm; it is not achievable with a uniform section spacer.

> Adapted as: the deliverable band and the specification band, each with a
> full-bleed capture plate nested inside.

## 08 · TWO-UP SPLIT — 652px, 2-column

Two images side by side on a 2-column grid, zero padding, two links. The last
content band before the footer.

> Adapted as: the two-up format / print comparison.

## 09 · FOOTER — 534px, 12-column, 21 links

Tall and link-dense. `56px` top and bottom padding — the largest padding value
on the page, and the only place 56px appears. No top border; it is separated by
mass, not by a rule. Links are set at the 12px label size in grouped columns.

> Adapted as: the SFS footer, already link-dense, re-set to the measured scale.

---

## The rules this page obeys

1. **Every band contains media.** There is no text-only band above the footer.
2. **Padding is 0, 20, 32, 48 or 56 — never uniform.** Full-bleed bands have
   zero padding and touch their neighbours directly.
3. **Bands are large.** The smallest content band is 386px; the median is
   ~650px. Nothing is a 200px strip.
4. **Type has exactly four roles**: 12px uppercase label, 40px display, 24px
   sub-heading, 15px body. No fifth size appears.
5. **Links are scarce above the footer** (0–7 per band) and dense within it
   (21).
6. **The header never changes on scroll.**
7. **One accent, used once on the entire page.**

## Mobile (390px)

Same band order, same 12-column grid with changed spans. Display drops 40→32px
while label and body rise 12→13px and 15→16px. Media aspect ratios square up;
the hero stays full-bleed.
