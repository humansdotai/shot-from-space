"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import type { ChannelWindow, CursorDocument, LiveCursor as Controller } from "@/lib/oh/live-cursor";
import { startOnFirstSign, type StartWindow } from "@/lib/oh/live-cursor-start";

/**
 * Live pointer for the 0Humans live site view, one sender in its own lazy chunk: batched mouse,
 * touch, scroll, tap and click samples POSTed same-origin to /api/oh/cursor at most every 500 ms
 * (3 s or stopped when the route answers `x-oh-cursor: slow|off`), and promptly on a tap or click.
 * With `visibility` (OH_CURSOR_VISIBILITY=on) it also sends `hide` and `show` samples when the tab
 * goes hidden and comes back. Nothing here posts to another host.
 *
 * Only while the tab is visible and for 30 minutes per page view. Passive listeners, nothing
 * rendered, nothing read from the page: a sample is a kind, a time and coordinates. The layout
 * renders this only when the server can forward (OH_OBSERVER_URL and OH_OBSERVER_SECRET are set).
 */
export function LiveCursor({ channel = false, visibility = false }: { channel?: boolean; visibility?: boolean }) {
  const pathname = usePathname();
  const controller = useRef<Controller[]>([]);
  const withChannel = useRef(channel);
  const withVisibility = useRef(visibility);

  // Start once, at the visitor's first input or when the browser is next idle (at most 1 s). Capture
  // begins about one chunk fetch after that first input, which is not itself sent.
  useEffect(() => {
    let cancelled = false;
    let cancelStart: (() => void) | undefined;
    // The sender is its own small chunk, fetched only when it starts.
    const boot = () => {
      if (cancelled) return;
      import("@/lib/oh/live-cursor")
        .then(({ createCursorChannel }) => {
          if (cancelled) return;
          const deps = { doc: document as unknown as CursorDocument, now: () => Date.now() };
          controller.current = [];
          if (withChannel.current) controller.current.push(createCursorChannel({ ...deps, win: window as unknown as ChannelWindow, visibility: withVisibility.current }));
          for (const c of controller.current) c.pageView();
        })
        .catch(() => {
          // Observation must never affect the visitor.
        });
    };
    try {
      cancelStart = startOnFirstSign(window as unknown as StartWindow, boot);
    } catch {
      // no event or idle scheduling: stay off
    }
    return () => {
      cancelled = true;
      try {
        cancelStart?.();
        for (const c of controller.current) c.stop();
      } catch {
        // nothing to undo
      }
      controller.current = [];
    };
  }, []);

  // Each in-site page change is a new page view: restart the 30-minute window.
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    try {
      for (const c of controller.current) c.pageView();
    } catch {
      // Observation must never affect the visitor.
    }
  }, [pathname]);

  return null;
}
