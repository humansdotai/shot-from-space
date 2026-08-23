# TOKENS — measured from anduril.com

Every value below was read with `getComputedStyle` from a live Playwright
capture on 2026-08-20, at viewport widths 1440 and 390. Nothing here is an
impression or an estimate. Raw capture: `/tmp/sfs-qa/p0-report.json`.

**These are measurements, not assets.** No text, image, video, font file or
logo from the source is reused anywhere in this product. The proprietary
display face is substituted (see §3).

---

## 1 · CONTAINER & GRID

| Property | Measured |
|---|---|
| Container max-width | **1440px** |
| Page gutter (padding-left/right) | **32px** (8 occurrences — the dominant value) |
| Grid | **12 columns** |
| Column gap | **20px** |
| Row gap | **18px** |
| Secondary grid | 2-column, same 20px/18px gaps |

The 12-column grid holds at every width — it is not swapped for a 4- or
6-column grid on mobile; spans change instead.

## 2 · VERTICAL RHYTHM — the single most important finding

Section `padding-top` / `padding-bottom`, in document order on the home page:

| # | Height | padding-top | padding-bottom | Media |
|---|---|---|---|---|
| 0 | 864px | 0 | 0 | VIDEO |
| 1 | 479px | 20px | 0 | VIDEO |
| 2 | 1441px | 20px | 32px | IMG |
| 3 | 850px | 48px | 48px | IMG |
| 4 | 612px | 48px | 48px | IMG |
| 5 | 652px | 0 | 0 | IMG |

**Padding is 0, 20px, 32px or 48px. It is never uniform.** Sections are sized
by their media, not by a repeating spacer. The rhythm comes from the height of
the imagery and from full-bleed sections butting directly against each other
with zero padding — which is why a uniform `py-24` everywhere reads instantly
as a template.

Every section on the page contains a `<video>` or `<img>`. There is no
text-only section above the footer.

## 3 · TYPOGRAPHY

Source uses one proprietary grotesk across the whole site. Substitution:
**Inter**, carrying the measured metrics below. Monospace has no equivalent in
the source and is our own addition (IBM Plex Mono) for the telemetry layer.

### Display / section heading (`h2` role)
| | 1440 | 390 |
|---|---|---|
| font-size | 40px | 32px |
| line-height | 50px (**1.25**) | 40px (1.25) |
| letter-spacing | −0.8px (**−0.02em**) | −0.322px (−0.01em) |
| font-weight | **400** | 400 |
| text-transform | none | none |

Note the weight: **400, not 700.** Large type is set at regular weight with
negative tracking. Bold display type is a template tell.

### Label / eyebrow (`h1`, `h3`, small caps role) — the workhorse
| | 1440 | 390 |
|---|---|---|
| font-size | 12px | **13px** |
| line-height | 12.6px (**1.05**) | 13.66px |
| letter-spacing | +0.48px (**+0.04em**) | +0.518px |
| font-weight | **500** | 500 |
| text-transform | **uppercase** | uppercase |

### Body
| | 1440 | 390 |
|---|---|---|
| font-size | 15px | **16px** |
| line-height | 18px (**1.2**) | 19.2px |
| letter-spacing | −0.144px (−0.0096em) | −0.154px |
| font-weight | 400 | 400 |

Body line-height is **1.2**, not 1.6. Copy is set tight and in short blocks.

### Button / action
| | 1440 | 390 |
|---|---|---|
| font-size | 14px | 15px |
| line-height | 14.7px (1.05) | 15.74px |
| letter-spacing | −0.144px | −0.154px |

### The mobile inversion
Label 12→13px, body 15→16px, button 14→15px. **Small text gets larger on a
phone**, while display type shrinks 40→32px. The scale compresses from both
ends rather than scaling uniformly.

## 4 · COLOUR

| Role | Measured | SFS substitution |
|---|---|---|
| Page ground | `rgb(1,1,1)` / `rgb(0,0,0)` | `--color-void` `#08090b` |
| Primary text | `rgb(255,255,255)` — 437 uses | `--color-paper` `#eeede8` |
| Inverted panels | `rgb(255,255,255)` ground, `rgb(1,1,1)` text | `--color-paper` / `--color-void` |
| Muted | `rgb(142,146,145)` | `--color-paper-dim` |
| Accent | `rgb(223,241,64)` (yellow-green) — **1 use on the entire page** | `--color-signal` `#ff4d1c` |

The accent appears **once** on a full home page. That is the discipline to
copy — not the hue, which is ours.

## 5 · BORDERS

| Property | Measured |
|---|---|
| Width | **1px**, always |
| Colour | `rgb(255,255,255)` at full opacity on dark |
| Radius | **0px** — no rounded corners anywhere |
| Shadows | none |

## 6 · HEADER

The `<header>` element is a 0-height wrapper; the visible navigation is a
separate positioned bar. Measured behaviour:

- **Does not react to scroll.** Sampled at scrollY 0, 600, 2000, and while
  scrolling back up: identical geometry, transparent background, no backdrop
  filter, no transform, no shadow, no border appearing.
- No hide-on-scroll, no shrink, no colour swap.
- Nav items sit at body size (15px), regular weight, sentence case — **not**
  uppercase micro-labels.

## 7 · FOOTER

| Property | Measured |
|---|---|
| Height | 534px |
| padding-top / bottom | **56px** / 56px |
| Link count | 21 |
| Border-top | none |
| Background | inherits the page ground |

A tall, link-dense footer — 21 links in grouped columns, set at label size.

## 8 · MOTION

No keyframe animation on the home page. One transition idiom: opacity and
transform on scroll-into-view, ~1s, heavily eased. Hover changes colour only —
no transform, no scale, no shadow.

---

## 9 · WHAT WE TAKE / WHAT WE DON'T

**Take:** the 1440/32px/12-col/20px grid; non-uniform 0–48px section padding;
media-dominant sections; 1.25 display line-height at weight 400 with −0.02em;
the 12/13px +0.04em uppercase label role; 1.2 body line-height; 1px borders and
0px radius; a single accent used once per page; a static header; a tall
link-dense footer; the mobile type inversion.

**Don't take:** any text, image, video, font file, logo, product name, or
colour value. The palette, the content, the monospace telemetry layer and the
entire FUI vocabulary are Shot from Space's own.
