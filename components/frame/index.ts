/**
 * The capture-framing tool. One public entry point:
 *
 *   import { FrameOnMap } from '@/components/frame';
 *
 * <FrameOnMap lat lon areaKm onChange /> — see FrameOnMap.tsx.
 * `viewport.ts` is the pure view maths behind it and is exported for
 * tests; nothing else should need it.
 */
export { FrameOnMap } from './FrameOnMap';
export type { FrameOnMapProps } from './FrameOnMap';
