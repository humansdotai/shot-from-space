/**
 * PURCHASE — the measurements of the briefing.
 *
 * /start is a sequence of single-decision screens. Three measurements are
 * shared across all of them and are kept here so no screen can invent its
 * own: the clearance under the site bar, the column a screen is composed in,
 * and the reading width a screen's copy stops at.
 *
 * WIDTH. Every screen sits on `.column`, the same width the site bar's lockup
 * sits on, so the briefing hangs off one left margin from the wordmark down.
 * The column is capped at 1376px and stops growing at 1440; wider displays
 * spend the extra pixels on margin, which is what keeps 1920 composed rather
 * than stretched. Nothing that is read runs past `--measure`.
 */

/**
 * THE BAR'S OWN BAND.
 *
 * The site bar is `absolute` over the first band of every page, it is drawn
 * in paper ink, and it lays a short void scrim under itself so paper-white
 * type clears contrast over a bright frame. Both of those assume the band
 * underneath is dark — and this sequence turns paper at the brief.
 *
 * So the sequence opens with a strip of void that is exactly as tall as that
 * scrim: `h-32 / h-40 / h-52`, the heights <SiteHeader /> uses. The bar and
 * its wash land on the void on every screen, the way they do on every other
 * page, and the paper never starts until the wash has finished. On the dark
 * screens the strip is invisible, because it is the same ground.
 *
 * It also puts the step chrome directly under the bar: at rest the chrome
 * sits below it, and by the time the page has scrolled far enough for the
 * chrome to pin at zero the bar has already left. The two never overlap.
 */
export const BAR_BAND = 'h-32 xl:h-40 xl2:h-52';

/**
 * The minimum run of one screen: the viewport, less the bar band and the
 * chrome above it. A screen shorter than this is centred in it rather than
 * left hanging under the chrome; a screen taller simply grows, because this
 * is a minimum and not a height.
 */
export const SCREEN_MIN = 'min-h-[calc(100dvh-11rem)] xl:min-h-[calc(100dvh-13.5rem)]';

/** The column every screen composes in. */
export const SHELL = 'column';

/**
 * The vertical run of a screen. Generous: a screen carries one decision, so
 * the air around it is the composition.
 *
 * Below `md` it is 20px rather than the 32px band. A 320 × 568 phone has 395px
 * of screen left once the bar's own band (128) and the step chrome (65) have
 * taken theirs, and the target screen's first match missed the fold by 24px
 * inside that. Air is the composition on a display that has some; on the
 * smallest screen in the matrix it is the difference between a decision the
 * reader can act on without scrolling and one they cannot.
 */
export const SCREEN_PAD = 'py-5 md:py-[var(--band-snug)] xl:py-[var(--band-open)]';

/**
 * The form column inside a screen.
 *
 * A 56px field and a three-row selector read best at about 40rem; past that
 * a set of controls stops being a form and becomes a banner. It opens one
 * step at 1920, where the body size steps up with it.
 */
export const SCREEN_FORM = 'w-full max-w-[40rem] xl2:max-w-[44rem]';

/**
 * The frame column. A square capture past roughly 700px stops reading as a
 * print and starts reading as a map, so it is capped and then left alone.
 */
export const SCREEN_FRAME = 'w-full max-w-[34rem] xl:max-w-[38rem] xl2:max-w-[42rem]';
