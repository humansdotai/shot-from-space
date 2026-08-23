'use client';

import { useEffect, useState } from 'react';

/**
 * A one-second clock, seeded from the server so the first paint matches.
 *
 * Extracted from <FleetTracker /> so the fleet band on the landing page and
 * the tracker on `/missions` share one implementation — two components
 * propagating the same orbits off two subtly different clocks is the kind of
 * divergence nobody notices until the numbers disagree on a screenshot.
 *
 * Paused while the tab is hidden: a background tab propagating eight orbits a
 * second is pure heat. It resyncs the moment the tab returns, so coming back
 * shows the current position rather than the one from when you left.
 *
 * Reduced motion is deliberately NOT honoured here. The preference is about
 * animation, and this is a clock — freezing a live position readout would
 * make it quietly wrong rather than calmer. Nothing driven by this hook
 * eases, slides or transitions; the numbers simply change.
 *
 * HYDRATION: the initial value is the server's instant, so the first client
 * render is byte-identical to the server markup; the tick only starts in an
 * effect. Consumers must format with `toFixed`, never a locale formatter,
 * for the same reason.
 */
export function useLiveClock(serverNow: string): Date {
  const [now, setNow] = useState(() => new Date(serverNow));

  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | undefined;

    const start = () => {
      setNow(new Date());
      timer = setInterval(() => setNow(new Date()), 1000);
    };
    const stop = () => {
      if (timer) clearInterval(timer);
      timer = undefined;
    };
    const onVisibility = () => {
      stop();
      if (!document.hidden) start();
    };

    start();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      stop();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  return now;
}
