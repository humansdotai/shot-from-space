/**
 * WORLD COASTLINE — the only picture on this globe, and it is 5.7 kB of it.
 *
 * ------------------------------------------------------------------------
 * WHERE IT COMES FROM
 * ------------------------------------------------------------------------
 * Natural Earth 1:110m land, by way of the `world-atlas` TopoJSON build. The
 * dataset is explicitly PUBLIC DOMAIN — "no permission needed" — which is why
 * it is safe to vendor the geometry into this repository outright, unlike
 * every render, photograph and typeface WAVE.md §1 refuses.
 *
 * TopoJSON stores a land map as ARCS — the shared boundary segments the
 * polygons are assembled from. For a wireframe globe the arcs ARE the
 * drawing: no polygon has to be reassembled, nothing is filled, and the
 * winding rules that make TopoJSON fiddly never come up. Every arc here is
 * one coastline stroke.
 *
 * ------------------------------------------------------------------------
 * WHY IT IS THIS SMALL
 * ------------------------------------------------------------------------
 * The homepage ships about 103 kB of shared JavaScript and that budget is
 * the reason this file is not a GeoJSON import. Three reductions, in order:
 *
 *   1. SIMPLIFY. Douglas–Peucker at 0.30 degrees, with longitude weighted by
 *      cos(latitude) so the tolerance means roughly the same ground distance
 *      at the equator and at 70 degrees north. 5,129 source points become
 *      2,049. At the size this globe draws — a 300 px radius, where one
 *      degree of arc is about 5 px — the discarded points were sub-pixel.
 *   2. DROP SPECKS. Any arc whose bounding box is under 1.5 degrees on both
 *      axes is removed. Those are islands smaller than a hairline's width
 *      and they read as dirt on the canvas, not as geography.
 *   3. ENCODE. Coordinates are quantised to 0.1 degrees (~11 km, a fifth of
 *      a pixel here), delta-encoded against the previous point, then written
 *      as signed base-64 varints — the Google polyline scheme, with an
 *      alphabet chosen to be safe inside a TypeScript string literal. Arcs
 *      are separated by `|`.
 *
 * 107 arcs, 2,049 points, 5,741 bytes of source. A GeoJSON of the same
 * geometry is roughly 90 kB.
 *
 * ------------------------------------------------------------------------
 * REGENERATING IT
 * ------------------------------------------------------------------------
 * There is no build step and deliberately so — a 5.7 kB constant that
 * changes when the continents do does not need one. To rebuild: take
 * `world-atlas@2/land-110m.json`, decode the transform and the arc deltas,
 * run the simplifier above, and re-emit. The decoder below is the exact
 * inverse of the encoder and is the specification.
 */

import { latLonToUnit, type Polylines } from './projection';

/** Signed base-64 varint alphabet. No quote, backslash or `|`. */
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+-';

/** Quantisation grid: tenths of a degree. */
const PRECISION = 10;

const ENCODED =
  "nlB-xBLT1CCjBM4CBaQUH|vjD1xB-BENWuCZ|nc3wBmBnB-FTVQqDsBmCA|3rC9tByBAdLvBIcE|vuC9tBgBHhCIiBA|79B9" +
  "sBsBBMJ7CAdMiCA|5qBrsBFXnCFKI9BAWQkBCIiBcMkBpB|vwD90BSM+CH4CMuHd6BGmEJsDMEI1GSOiBtCS8DD0CU9BSzDG" +
  "9BsBuEJoDSYaMF2FY2JD0DQgBTUGqCPsEB9B2B0ET8DGSOwCRqCHYQyCRyEUkBUbuBY4B2CuBoDaEL3CRBbfFnBduC1BU7Bn" +
  "Cf7DZjEBmCXzCJBP0BV6JpBePoFesEHoBO0HWVU1DDDYqEgBkHgBkBMHU0DsB6BHKQ0BLoCGKH+EiBkBBaP0BQiBH0CKiCP6" +
  "CEiDQmBY+CZ+JwCmBDkDnB2BMgDJQZlBVaHXXoBHwCwBqCIeYqCWwCCYSiBR6DFuCE+BgBkCZwCEkCQoBP0CLkCQwDF4DMGS" +
  "wBhBgFCWTsBJqCJkBGyEnByDDuCRlBnB-BNxBjBWnBuBLnDHnBhBgG5ByFN9-GD|rqBzhB2BRHJdGVN5BKpCuBoCZkBgBeZ|" +
  "xkB9fQHFHbFHIRJJK2BO|+rBhffBEYgBJDL|86CvZUFmBEHtBFGNNRCZuBAKOB|ksDxZEHQIEHdpBIJfFRhBZNzBIGWmCqBu" +
  "ByBEH|ktDzWOTCOcbiBEJdPCXrBPHJIKQFMVIQOCcpB6BiBPGR|uoD7NHDXOdgB+BpB|vwDrK0gHDNDBIQEzgHG|qfvIGpBN" +
  "ACXtBpEHVhBNbMNsBCeKCMkBJoBIYmBIcYESIBSkBSf|45CzIGNOGQPUvCwBbSlBUBEVsBzBKnBJ3B3B-CFhBhBHnBXbMCKb" +
  "R7BQTmBdKCYJNRDWiBBOjBnBPIRmB7BWnDNlBPJRrCBlBVbCfQOSAiBvBuDKHHSQNPmBO0BCNyBkB0CUaeQkBIRKEHKGKKDC" +
  "OaccIaVYBDMYmBoBIAKPGME6BVYGKJTRJhB+C1BWaIwCQiBW9B|urCrGhBMSEQP|4tCpGRBKSWMsBGrBTNN|2pChFYLvBFYS" +
  "|6sChFBL5BBQMMFgBI|+jDlFhBSiBR|8jCnEmBBGIiDlBVH9DU5BSOUYBaP|uhDnENGNcchB|g-CtDjBPlBMeEGKCJMAQOBM" +
  "QBFX|yxC9BGP5BKEMwBF|2-C5CFFHUhBWEEaNSZ|6zCXGfWLQWoBM+DrBcfgBLGJRBENmC-B3BKlBoBZKbLCPPFfERQTEdFW" +
  "WPmBzCmBNLDQPKiBMdAhBamBKiBP|ouCcPTNDlCADNSRwBQAJJEZTiBjCLFHGKQXBCINMCUNFCzBTCCmBNOYkCSOoBHuBK|u" +
  "wCWBPJCAZNmBKYQV|kiC1DVApBiBhC4CNgBhCqCsBF+B9BWAqBnBHPUHKXYPF3B|2pCkBWRXBFfRNJxBBGVHHMXIXHHKdCBa" +
  "TWAkBMOeBEQgBIqCsCyBdlBrBORBJ|gvCoFCXFRHUHJAXXMAYLIdRDGIQYOGJiBQBQQJER|4yB8DRDHQDcIgBiBtBLZ|wtCu" +
  "GTZLOKYMADLQSBR|iqC6FZRuB8BEPXZ|uuC0HGXPGGRJFJcMBAILQYH|6rCyLSAGbPXAfuBJCZXWDHNMbCIMFGBHJMDcIHIy" +
  "BMA|-oBsLfFAKgBD|hwBmLbGcEOJNA|rtBuM0BFiBTHHnBENPTMpBCCIqBAVSQG|+kC2LPJPGBSsBOEHNT|5xBoOcFwCvBlC" +
  "DOKTGLSlCQIE-BN2Ba0BH|4rCoOJPLgBciBKFPrB|k0CqVHRHGPPLGKWiBA|0VqWfVNKuBM|6OqW0BHfHXIEI|2J8XHf1BUE" +
  "K6BC|4F4ZMNBZRFLqBUE|k4CmXNnB9BJbVNGAQxCNUPNfLJJIESTUgCqB+BCUkBOJoBcKwBIMWEKrBRTAV|gGsaHPHEFOSOE" +
  "P|+5C0bODOIEVbFRTfOJVVADUKOWCMsBmBb|5nBidiBBRHXICMGJ|zmB2e1BQ2BP|ltCqerBGvBYFQ0BJuBjB|hjB2fNROGM" +
  "DFFuBHFNOEKXJPVCAUXRLAOKTE7BACSkBsBoBSNR|9yC4hBUCHVSPlBYBQKD|45C2fWhBdGLbSjBPMLNHyEUWSpC|nE2gBjB" +
  "LbCQWJU8BaULVtB|+H4iBLPXUeGGJ|z-C2jBTHNQqBIKFRJ|7B0kBVTqBCVhBUB0B7BYDFbRJlCBrBNLEwBYlBMWGHYeBEMl" +
  "BQDULJLeYkBoBA|vnDulBlBGkBCCH|lzBmnBlBJMOaD|prD8nB6BL3BCBK|n1BipBmDnBRFpBOvBTHKZBasBOA|hJypBSbZN" +
  "rCRxCKUIrBKkBEpBKMOgBCeNeMaFiCK|tvB+pBVADKaOAX|vwDkrBmDjBMRFQ2BDoBRzBLJV-BWrBAFOXDBR|vwD0oBAwC|3" +
  "7BmrBNFlCMgBO0BT|vwD2sBghHN-gHO|vwD2sBuBHtBFAO|x4BurBATaQmBpBkB2B6BDaJAfnBXxBEdjBzBPRTvBTd9BeBSh" +
  "BcE2DnB2BDEjBsBpBacXqBgBIiBcnBuBYWPwB2CCwBZkBAGpBgBP+BqBgChCHN6ChBeZCX1ClB-DA9CjCwBeoCSSJRLMlBaJ" +
  "iBEUWOVvDvBNCBSkBQ1BDCF9BVNbQNpCNkBApBBRlBLMIVPXJmBCTNCOFMtBvDzCAbY9BFhBPAJOXoBAYXUTJZQ3BBHBIRTD" +
  "bMrBA3BbPRGdPlCgB9BmBXwBMYMKiBgCKGNTxBJEBnBJLuCCgBNETL-BgBpBQDkBQ4BTWQEYMKeCgBYOFPNEtBOQHWYIGQiB" +
  "foBAaJMKwBCPFGJgBJCPgBLMXcP+BD2BfQtBKDCNPPGFkBBATQM6BTKJDLYGkCJ4BlBgBFSrBHhBnCxCL-CfvCVVzBH7BdRT" +
  "H3BhDxDVLZCrBUBJaRIfRZdJ9BBElBLFvBBCTOFKIGLhBRHdhBLFNoBRHR9BzBShBZCZLLTlCgBNoCekBdGSQGiBYHKqBNGF" +
  "ZLEWuCHqBICkB+CBmCMaO8EDeVS5C4BrC0EdWIIJUgBoBDKHJLKCWQmBYMKYaYHGA0BNQAQbMRPKLRFDMvBMBObUBJLGAYnB" +
  "kBEIpCMlCuBlBJpE0BnBgBEeNchC4BAQZefWRsBhBMCf+BlCSvBaVLHrBmBBa3BiBKAISZUjBkCXUpBMrCyDKoDP2BgBDKRD" +
  "mB7CkBHeZKjDqDxBChCavEcVDENpCPWqBjClBOJRPzCpB-DfuEgCOapBJZOfHCSlBEtBiBegBeAuBONMOIzCH9BaoCSOJqBA" +
  "lDuBiDmBqDWuBN2GJuEZmEaOHUOuBTcOCP4BI+DRaJbJsDCULOaqBC8CX+BEOQgBHARmBkBtBUakBuBLcVRJmBD|rnC2tBJH" +
  "uBGaJYKiBZDc8BHShBmCTBHfBGNnCIxEN3BOXQiDItDCJIuBIhCGeWqCI|phC8tBRLdOwBB|1vB2tB-BHZU6CL|j2B4tBQNS" +
  "Q0BKehB8BOqCdmBG2CdSRjBJqEjBnBlB3BcZBBL4BZMTFNrCU0BjB-CUrCkB5BJRIOOuCEWsB5DyBtBJzEOdkBkBa0BGPL|3" +
  "+BkuBiCFTJgBHDRhBHxCYAGqBBVOWI|45C4tBpCEsBKeN|n6BwtBrBNLaeOwCD1BV|prC0sBzBJ3BUoBkBTMyEBqBNpCTZV|" +
  "m+C+uB1BFfO2CH|v6B8uBLHzBGmBOaL|26CovBPPpDDnBOkBQ+DJ|x9B+vBGhBfBVOfABOyCI|zjC0vBuBDHTzELmBQ1DAuB" +
  "a+DTJacL|+jBmsBrCCpBOwCoC8HkBANhGlB9BlBqBhB|l7BmwB+BFwBXiFCMT3EF1CIde-BKIIoBB|zoCwwBRV3CLbEsCc6B" +
  "C|2e6ZaTPBNbGXgBN8BCCoBPGGONAESkBCTWPDBPFiBXGTeUBAOiBCAgBjBCpBLvBjBwBhC|vwD0oBghHAzBHkBtBjBEpCPj" +
  "CjBbOzBPJItBFdhBYLBbTBHPIHhBLHVdDFVbRb4CKcSUgBGqD8BQeXB-BnBPazBHxBfQNpCFAOdEZJ9DDtE1CgBBePMKWBcV" +
  "CRZrClBpBhC5BbLXKtBbFTrBVBLqBvBHhBzBNHuBQENQdIMeTG-BTWeLKzBfTBJJcZQDWOgBHCLbDlBjBUJiB1BAPLDQRHfL" +
  "BvBnC3BhBhBLHG7BVHVJAAWbGzBlBDNgCrCIlBBhBvC9BHMGOfORgBjBIEQRARzCOAMjByBlBYzCNBpBgBZqCfmBDLKoCfuD" +
  "jBXXGCsBLeZUTqBRADTZGBHlBDJZbN5BxBAHlBNHtDLBHPGFRFPRRS9BuERsDpBJZYIIFGlBWTehDFxCMRcjBL-BcbsBpBBQ" +
  "tBcTMlBEYMDDXILsBCwBuBIrBmBLWZZlBNDBZvBZAH5BPDPlCf9BNLLdBR0BCgBjB2BjBkBLwBTMvBsCJAGcTlBduBiC3DDP" +
  "cVMjCSLSpBwClCLNmBZiEgBBbdrCjBzBzEnEVpBHjBMFDhBatBGtCZnBpBRzBrBQtBBnB5BfGJNzBvCvCvBV-BA7BRbSAsB7" +
  "B8CRkDxBwCAuBOuBWeCaPeGMZoC9BuCU0CHMRWzBJfoBvBDtCbzBK5BRdKjCyBvBoCjBaBcRWWcIoBRsC0B4CkBiBSCqBkBD" +
  "aKcwBeUiBqCLqCcqEGWKODAJSEJJGNLlBiDdKRkCVUOAYcM0ElBqBOUNEIgBFQKc+BEqBdCNLdBPKnBJpBMZeKQLKWSeCIOm" +
  "BBwBSiBA+BVqBCaUDM-C0BeUJIcOxCTALeDDHvBNLEEITGQQzBKVfPBVtBWdXBXPFMXCXDOLJBZGczBRECdNAPItBmCCclCk" +
  "BVgBLCFHBQPCPFGZyBpBQAAJ0BZDHbMHLOHBJTRHBIWNUhCiBfYFUZKvBZlBGdFBXrBRVhBILrBnBtBATPVUvBACcNIOqBLs" +
  "BcO6DFKMEoBjBgBdIBO8BBFYSJuBQGQsBOSekCIOKNeIgBqBMGXZTadgBKgBNmCWqBJgBQGsBSIgBPGcVQ+CGWKTKnDNfSEy" +
  "BuCmBdShBFPZnChBNbiBXnBbRzBXCLPXAxByCnBXZDbKNkCSM8CmB2CiC4CoBsCIeQqCE+BNZFWLUGkFnBQVVJfFnDMgBNCd" +
  "qBJEYwBLQGLOuBUmBHJyB4BHAd0EsBDNqDOWLYMJU+EjBOKtBSDeyBkBkCAPbmB7BvBpBWB2BgBnBoCgBciBfJOiBIqBAkBL" +
  "TmB+DGIY4DSmCByCKoCa4BXuCE8BR9CfoCDKNqBK4EPCOqCB2C3BUUgBH4DCPScI0FLmCb4DCmBdqEEkBRYGFWiFNjgHH|z6" +
  "BuwBzBG0BF|7kCywBlBFbGsBKWJ|uP2wBrBJhBSqBEkBL|xkCkxB3BDUKkBF|77B6wBtBAJQ4BP|x+B+wBIHtDKFSsDT|2hC" +
  "+wBxDHmBasCR|uL6xBgCNvDrBtD6BkEIaH|8PoyBoBF3CNvDSgFC|+fqyBlCJ3BMoDGWH|u+BqxBhDCrCa+CUwCvB|r2B6xB" +
  "YH-BTtCADWnCQoBUuBCsDf|5qB+zBkENzDRsBAxDhBxDJeP3CZmBH1BLxFGYciCH7BS6BSjBUmDEzDAvCc6DQuBHuCQ4GA|9" +
  "Qm0B+DPzGNqFCFR0EOoCL7EVuBBnBZYjB-BHmBJIjBrBBQN3BDaVxBC8BfhBDnBSRXyCBrDfxCHvBbvDXbnBfPLzBbBdSnBA" +
  "hC2BvBoC+B2BzBLXGGY8BD3CWWSzBqBvCcvEA5BS8CIzCErBQ2EUtBO6EmByEB0BK2DNtBSkCMmKG";

/** Reverse of the alphabet, built once. */
const INDEX = new Map<string, number>();
for (let i = 0; i < ALPHABET.length; i += 1) INDEX.set(ALPHABET[i], i);

let cached: Polylines | null = null;

/**
 * The coastline as unit vectors, decoded once per document.
 *
 * Memoised because the result is immutable and every mount of the globe
 * wants the same 2,049 points; decoding takes well under a millisecond but
 * there is no reason to pay it twice.
 */
export function coastline(): Polylines {
  if (cached) return cached;

  const arcs = ENCODED.split('|');

  // One pass to size the buffers exactly — two chars minimum per varint pair
  // is not a safe bound, so count by decoding lengths rather than guessing.
  let total = 0;
  for (const arc of arcs) {
    let i = 0;
    let n = 0;
    while (i < arc.length) {
      // Two varints per point; skip both by their continuation bits.
      for (let k = 0; k < 2; k += 1) {
        let byte = 0;
        do {
          byte = INDEX.get(arc[i]) ?? 0;
          i += 1;
        } while (byte >= 0x20);
      }
      n += 1;
    }
    total += n;
  }

  const xyz = new Float32Array(total * 3);
  const bounds = new Uint32Array(arcs.length + 1);

  let p = 0;
  for (let a = 0; a < arcs.length; a += 1) {
    bounds[a] = p;
    const arc = arcs[a];
    let i = 0;
    let x = 0;
    let y = 0;

    const varint = (): number => {
      let result = 0;
      let shift = 0;
      let byte = 0;
      do {
        byte = INDEX.get(arc[i]) ?? 0;
        i += 1;
        result |= (byte & 0x1f) << shift;
        shift += 5;
      } while (byte >= 0x20);
      // The low bit is the sign, so that small negative deltas stay short.
      return result & 1 ? ~(result >> 1) : result >> 1;
    };

    while (i < arc.length) {
      x += varint();
      y += varint();
      latLonToUnit(y / PRECISION, x / PRECISION, xyz, p * 3);
      p += 1;
    }
  }

  bounds[arcs.length] = p;
  cached = { xyz, bounds };
  return cached;
}
