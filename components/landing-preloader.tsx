"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { BrandMark } from "@/components/brand-mark";

/*
 * First-visit entrance for the landing page.
 *
 * Gated on sessionStorage, so it plays once per session and never on a client-side return to "/".
 * Under prefers-reduced-motion it never appears at all, which is the honest reading of "skip
 * straight to content".
 *
 * The decision comes through useSyncExternalStore rather than an effect: reading sessionStorage
 * during render would desync server and client markup, and setting state from an effect body is
 * both a lint error and an extra paint. The result is memoised at module scope on purpose —
 * marking the session as seen must not flip the snapshot and yank the panel mid-animation.
 */
const SESSION_KEY = "thread-preloader-shown";
const HOLD_MS = 1400;
const FADE_MS = 420;

let playDecision: boolean | null = null;

const subscribeNoop = () => () => {};

function getClientSnapshot() {
  if (playDecision === null) {
    let seen = false;
    try {
      seen = sessionStorage.getItem(SESSION_KEY) === "1";
    } catch {
      /* Blocked storage (private mode): treat as seen so the page is never stuck behind it. */
      seen = true;
    }
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
    playDecision = !seen && !reduced;
  }
  return playDecision;
}

const getServerSnapshot = () => false;

function markSeen() {
  try {
    sessionStorage.setItem(SESSION_KEY, "1");
  } catch {
    /* nothing to do */
  }
}

export function LandingPreloader() {
  const shouldPlay = useSyncExternalStore(subscribeNoop, getClientSnapshot, getServerSnapshot);
  const [phase, setPhase] = useState<"visible" | "leaving" | "done">("visible");

  const dismiss = useCallback(() => {
    markSeen();
    setPhase((current) => (current === "visible" ? "leaving" : current));
  }, []);

  useEffect(() => {
    if (!shouldPlay) markSeen();
  }, [shouldPlay]);

  useEffect(() => {
    if (!shouldPlay || phase !== "visible") return;
    const timer = setTimeout(dismiss, HOLD_MS);
    return () => clearTimeout(timer);
  }, [shouldPlay, phase, dismiss]);

  useEffect(() => {
    if (phase !== "leaving") return;
    const timer = setTimeout(() => setPhase("done"), FADE_MS);
    return () => clearTimeout(timer);
  }, [phase]);

  /* Hold the scroll while it covers the page, so the hero is at the top when it lifts. */
  useEffect(() => {
    if (!shouldPlay || phase === "done") return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [shouldPlay, phase]);

  if (!shouldPlay || phase === "done") return null;

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
