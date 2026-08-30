"use client";

import { useCallback, useEffect, useState } from "react";

/*
 * Landing entrance.
 *
 * The mark assembles the way the product's own graph does: each segment draws itself along its
 * length, and each node pops in only once the segment terminating at it has arrived. That is why
 * the mark is rebuilt here as discrete <path>/<circle> elements rather than reusing BrandMark,
 * whose single compound path cannot be drawn segment by segment.
 *
 * Segment lengths are exact and hardcoded because every stroke is axis-aligned: dasharray is in
 * user units, so these hold at any rendered size and need no getTotalLength() at runtime.
 *
 * Timeline (ms from mount):
 *    0-460  segments draw, staggered 80 apart, 220 each
 *    0-640  nodes pop as their incoming segment lands
 *  600-900  wordmark rises
 *      800  skip control fades in
 *     1500  dismiss begins
 * 1500-1900 panel scales out while the hero cross-fades in from 1650
 */
const HOLD_MS = 1500;
const HOLD_REDUCED_MS = 150;
const EXIT_MS = 400;

const SEGMENTS = [
  { d: "M8 7h24", length: 24, delay: 0 },
  { d: "M8 13h14", length: 14, delay: 80 },
  { d: "M18 13v20", length: 20, delay: 160 },
  { d: "M12 33h20", length: 20, delay: 240 },
];

/* Each node waits for the segment that ends on it. */
const NODES = [
  { cx: 8, cy: 7, delay: 0 },
  { cx: 8, cy: 13, delay: 80 },
  { cx: 32, cy: 7, delay: 220 },
  { cx: 18, cy: 33, delay: 380 },
  { cx: 32, cy: 33, delay: 460 },
];

export function LandingPreloader() {
  const [phase, setPhase] = useState<"visible" | "leaving" | "done">("visible");

  const dismiss = useCallback(() => {
    setPhase((current) => (current === "visible" ? "leaving" : current));
  }, []);

  useEffect(() => {
    if (phase !== "visible") return;
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
    /* setState lands in the timer callback, never synchronously in the effect body. */
    const timer = setTimeout(dismiss, reduced ? HOLD_REDUCED_MS : HOLD_MS);
    return () => clearTimeout(timer);
  }, [phase, dismiss]);

  useEffect(() => {
    if (phase !== "leaving") return;
    const timer = setTimeout(() => setPhase("done"), EXIT_MS);
    return () => clearTimeout(timer);
  }, [phase]);

  /* Published to the root so the hero can cross-fade off the same signal. */
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
        <svg className="preloader-glyph" viewBox="0 0 40 40" role="img" aria-label="THREAD">
          {SEGMENTS.map((segment) => (
            <path
              key={segment.d}
              className="preloader-seg"
              d={segment.d}
              style={{ "--seg-len": segment.length, "--seg-delay": `${segment.delay}ms` } as React.CSSProperties}
            />
          ))}
          {NODES.map((node) => (
            <circle
              key={`${node.cx}-${node.cy}`}
              className="preloader-node"
              cx={node.cx}
              cy={node.cy}
              r={2}
              style={{ "--node-delay": `${node.delay}ms` } as React.CSSProperties}
            />
          ))}
        </svg>
        <span className="preloader-wordmark">THREAD</span>
      </div>
      <button type="button" className="preloader-skip" onClick={dismiss}>
        Skip
      </button>
    </div>
  );
}
