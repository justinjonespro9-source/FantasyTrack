"use client";

import { useEffect, useState } from "react";

/** Client media query. Defaults to `false` until mounted (SSR-safe). */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const media = window.matchMedia(query);
    const onChange = () => setMatches(media.matches);
    onChange();
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [query]);

  return matches;
}

/** True when viewport is below the Tailwind `md` breakpoint (768px). */
export function useIsMobileViewport(): boolean {
  return useMediaQuery("(max-width: 767px)");
}
