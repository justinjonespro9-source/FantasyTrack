"use client";

import { useEffect, useState } from "react";

type HydratedMobileState =
  | { ready: false; isMobile: false }
  | { ready: true; isMobile: boolean };

/**
 * Hydration-safe viewport gate for large layout branches.
 * - Server + first client paint: ready=false (render a shared neutral shell)
 * - After mount: ready=true with the real breakpoint — never flashes the wrong heavy layout
 */
export function useHydratedMobile(breakpointPx = 768): HydratedMobileState {
  const [state, setState] = useState<HydratedMobileState>({
    ready: false,
    isMobile: false,
  });

  useEffect(() => {
    const media = window.matchMedia(`(max-width: ${breakpointPx - 1}px)`);
    const sync = () => setState({ ready: true, isMobile: media.matches });
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, [breakpointPx]);

  return state;
}
