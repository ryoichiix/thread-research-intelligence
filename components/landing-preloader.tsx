"use client";

import { useCallback, useEffect, useState } from "react";
import { BrandMark } from "@/components/brand-mark";

/*
 * Landing entrance.
 *
 * No persisted "seen" flag of any kind, so it plays on every full document load. It is rendered
 * in the server HTML on purpose — gating the first paint on a client-side check would flash the
 * hero before the panel covered it.
 *
 * prefers-reduced-motion is handled in CSS (the panel is display:none) as well as here, where the
 * hold collapses to zero. Doing it in CSS is what removes the flash: a JS check cannot run before
 * first paint.
 *
 * Durations mirror the motion tokens this theme actually compiles to — fast 110ms, medium 220ms,
 * slow 420ms — not the values in the published docs, which are the design system's defaults.
 */
const HOLD_MS = 1600;
const EXIT_MS = 420;

export function LandingPreloader() {
  const [phase, setPhase] = useState<"visible" | "leaving" | "done">("visible");

  const dismiss = useCallback(() => {
    setPhase((current) => (current === "visible" ? "leaving" : current));
  }, []);

  useEffect(() => {
    if (phase !== "visible") return;
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
    /* setState lands in the timer callback, never synchronously in the effect body. */
    const timer = setTimeout(dismiss, reduced ? 0 : HOLD_MS);
    return () => clearTimeout(timer);
  }, [phase, dismiss]);

  useEffect(() => {
    if (phase !== "leaving") return;
    const timer = setTimeout(() => setPhase("done"), EXIT_MS);
    return () => clearTimeout(timer);
  }, [phase]);

  /*
   * The phase is published to the root element so the hero underneath can play its own reveal
   * off the same signal, instead of both sides hard-coding the same delay.
   */
  useEffect(() => {
    const root = document.documentElement;
    if (phase === "done") {
      delete root.dataset.preloader;
      return;
    }
    root.dataset.preloader = phase;
    return () => {
      delete root.dataset.preloader;
    };
  }, [phase]);

  useEffect(() => {
    if (phase === "done") return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [phase]);

  if (phase === "done") return null;

  return (
    <div className="preloader" data-state={phase} role="presentation">
      <span className="preloader-glow" aria-hidden="true" />
      <div className="preloader-mark">
        <BrandMark />
        <span className="preloader-wordmark">THREAD</span>
      </div>
      <button type="button" className="preloader-skip" onClick={dismiss}>
        Skip
      </button>
    </div>
  );
}
