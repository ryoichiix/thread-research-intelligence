"use client";

import { useEffect, useState } from "react";

/*
 * The hero's cycling tail phrase.
 *
 * Two-phase on purpose: the current phrase blurs out, and only then does the next one fade in
 * from blur. A single keyed re-mount would swap the text instantly and animate only the entrance,
 * which reads as a pop rather than a cross-dissolve.
 */
const PHRASES = ["read.", "connect.", "question.", "reveal."];
const VISIBLE_MS = 2200;
const BLUR_OUT_MS = 260;

export function HeroHeadline() {
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<"in" | "out">("in");

  useEffect(() => {
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    let swap: ReturnType<typeof setTimeout>;
    const tick = setInterval(() => {
      if (reduced) {
        setIndex((i) => (i + 1) % PHRASES.length);
        return;
      }
      setPhase("out");
      swap = setTimeout(() => {
        setIndex((i) => (i + 1) % PHRASES.length);
        setPhase("in");
      }, BLUR_OUT_MS);
    }, VISIBLE_MS);
    return () => {
      clearInterval(tick);
      clearTimeout(swap);
    };
  }, []);

  return (
    <h1 className="hero-headline">
      Your research should remember what you{" "}
      <span className="hero-cycle" data-phase={phase} aria-live="polite">
        {PHRASES[index]}
      </span>
    </h1>
  );
}
