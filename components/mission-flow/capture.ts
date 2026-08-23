/**
 * THE CAPTURE FOOTPRINT, IN ONE PLACE.
 *
 * `useCommission()` sends `areaKm: 2` to `/api/orders`, and the framing
 * tool draws a square of exactly this edge on the basemap. Those two
 * numbers are the same fact — what the buyer positions is what the order
 * buys — so they are read from here rather than typed twice. A framing
 * tool drawing 2 km over an order for 4 km is a lie the buyer cannot see.
 *
 * It is not in `lib/mission-flow/config.ts` because that file is priced
 * and owned elsewhere; when the footprint becomes something the buyer
 * chooses, this constant is the thing that becomes a field.
 */
export const CAPTURE_AREA_KM = 2;
