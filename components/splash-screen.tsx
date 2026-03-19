"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

const SPLASH_STORAGE_KEY = "fantasytrack_splash_seen";
const VISIBLE_MS = 3500; // ~3.5s visible
const FADEOUT_MS = 400; // + 0.4s fade-out ≈ 3.9s total

export default function SplashScreen() {
  const [phase, setPhase] = useState<"visible" | "exiting" | "done">("visible");

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (sessionStorage.getItem(SPLASH_STORAGE_KEY)) {
      setPhase("done");
      return;
    }
    const hideAt = Date.now() + VISIBLE_MS;
    const timer = setInterval(() => {
      if (Date.now() >= hideAt) {
        clearInterval(timer);
        setPhase("exiting");
      }
    }, 50);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (phase !== "exiting") return;
    const t = setTimeout(() => {
      sessionStorage.setItem(SPLASH_STORAGE_KEY, "1");
      setPhase("done");
    }, FADEOUT_MS);
    return () => clearTimeout(t);
  }, [phase]);

  if (phase === "done") return null;

  return (
    <div
      className="splash-overlay"
      aria-hidden
      role="presentation"
    >
      <div className={`splash-content ${phase === "exiting" ? "splash-exit" : ""}`}>
        <Image
          src="/fantasytrack-loading-podium-transparent.png"
          alt="FantasyTrack player performance market loading"
          width={1024}
          height={682}
          priority
          className="h-auto w-full max-w-[720px] md:max-w-[840px] object-contain px-4"
        />
      </div>
    </div>
  );
}
