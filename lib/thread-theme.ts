import { defineTheme } from "@astryxdesign/core/theme";

export const threadStudioTheme = defineTheme({
  name: "thread-studio",
  color: {
    accent: "#8C1F35", // deep garnet — single hex since this is light-only, no [light, dark] tuple needed
    neutralStyle: "cool",
    contrast: "high",
  },
  tokens: {
    // Single-scheme theme: both entries in each tuple are intentionally identical, so the
    // result is the same regardless of any ambient data-theme/mode setting — this guarantees
    // light-only behavior even if something upstream still requests dark.
    "--color-background-body": ["#F7F5EF", "#F7F5EF"],
    "--color-background-surface": ["#FFFFFF", "#FFFFFF"],
    "--color-background-card": ["#FFFFFF", "#FFFFFF"],
    "--color-background-popover": ["#FFFFFF", "#FFFFFF"],
    "--color-background-muted": ["#EDE8DA", "#EDE8DA"],
    "--color-text-primary": ["#1C1B22", "#1C1B22"],
    "--color-text-secondary": ["#6B6860", "#6B6860"],
    "--color-text-disabled": ["#A39C8C", "#A39C8C"],
    "--color-border": ["#E3DFD1", "#E3DFD1"],
    "--color-border-emphasized": ["#C7BFA8", "#C7BFA8"],
    "--color-track": ["#E7E1D0", "#E7E1D0"],
  },
  typography: {
    scale: { base: 15, ratio: 1.2 },
    body: { family: "Inter", fallbacks: "-apple-system, BlinkMacSystemFont, \"Segoe UI\", sans-serif" },
    heading: {
      family: "Space Grotesk",
      fallbacks: "-apple-system, BlinkMacSystemFont, \"Segoe UI\", sans-serif",
      weight: "semibold",
      weights: { 1: "bold", 2: "bold", 3: "semibold" },
    },
    code: { family: "Geist Mono", fallbacks: "SFMono-Regular, ui-monospace, monospace" },
  },
  radius: { base: 10, multiplier: 1.3 }, // was base:3, multiplier:0.8 — this is why buttons looked "old-generation square"
  motion: { fast: 110, medium: 220, slow: 420, ratio: 0.7 },
  components: {
    button: {
      base: {
        borderRadius: "var(--radius-element)",
        fontWeight: "var(--font-weight-semibold)",
        transition: "transform var(--duration-fast) ease, filter var(--duration-fast) ease, box-shadow var(--duration-fast) ease",
        ":hover": { filter: "contrast(1.05) brightness(1.02)", transform: "translateY(-1px)" },
        ":active": { transform: "translateY(0)" },
      },
      "variant:primary": {
        backgroundImage: "linear-gradient(180deg, color-mix(in srgb, var(--color-accent) 100%, white 10%), var(--color-accent))",
        boxShadow: "var(--shadow-low)",
        ":hover": { boxShadow: "var(--shadow-med)", transform: "translateY(-1px)" },
      },
    },
    card: { base: { borderRadius: "var(--radius-element)", borderColor: "var(--color-border)", boxShadow: "var(--shadow-low)" } },
    badge: { base: { borderRadius: "var(--radius-full)" } },
    "side-nav": { base: { backgroundColor: "var(--color-background-surface)", borderColor: "var(--color-border)" } },
    "side-nav-heading": { base: { color: "var(--color-text-disabled)", fontFamily: "var(--font-family-code)", letterSpacing: "0.08em" } },
    "side-nav-item": {
      base: { borderRadius: "var(--radius-element)", transition: "background-color var(--duration-fast) ease, color var(--duration-fast) ease, box-shadow var(--duration-fast) ease" },
      selected: { backgroundColor: "var(--color-accent-muted)", color: "var(--color-text-accent)", boxShadow: "inset 3px 0 0 var(--color-accent)", fontWeight: "var(--font-weight-semibold)" },
    },
    selector: { base: { borderRadius: "var(--radius-element)" } },
    "top-nav": { base: { backgroundColor: "var(--color-background-surface)", borderColor: "var(--color-border)" } },
  },
});
