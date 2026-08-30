import { defineTheme } from "@astryxdesign/core/theme";

export const threadStudioTheme = defineTheme({
  name: "thread-studio",
  color: {
    accent: "#1D6B4C",
    neutralStyle: "cool",
    contrast: "high",
  },
  tokens: {
    // IMPORTANT: --color-accent is set explicitly here, not left to color.accent alone.
    // color.accent is only a seed the system can nudge for contrast — verify after building that
    // getComputedStyle(document.documentElement).getPropertyValue('--color-accent') actually
    // returns #1D6B4C and not some auto-adjusted nearby shade. If it doesn't match exactly, that
    // is a blocking problem, not a cosmetic one — stop and fix it before moving on.
    "--color-accent": ["#1D6B4C", "#1D6B4C"],
    "--color-background-body": ["#FCFCFA", "#FCFCFA"],
    "--color-background-surface": ["#FFFFFF", "#FFFFFF"],
    "--color-background-card": ["#FFFFFF", "#FFFFFF"],
    "--color-background-popover": ["#FFFFFF", "#FFFFFF"],
    "--color-background-muted": ["#EEF0EA", "#EEF0EA"],
    "--color-text-primary": ["#13201A", "#13201A"],
    "--color-text-secondary": ["#59695F", "#59695F"],
    "--color-text-disabled": ["#9AA79D", "#9AA79D"],
    "--color-border": ["#E2E6DD", "#E2E6DD"],
    "--color-border-emphasized": ["#B7C2B0", "#B7C2B0"],
    "--color-track": ["#E5E8DF", "#E5E8DF"],
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
  radius: { base: 10, multiplier: 1.3 },
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
      "size:sm": { padding: "var(--spacing-1-5) var(--spacing-3)" },
      "size:md": { padding: "var(--spacing-2) var(--spacing-3)" },
      "variant:primary": {
        backgroundImage: "linear-gradient(180deg, color-mix(in srgb, var(--color-accent) 100%, white 10%), var(--color-accent))",
        boxShadow: "var(--shadow-low)",
        ":hover": { boxShadow: "var(--shadow-med)", transform: "translateY(-1px)" },
      },
    },
    card: { base: { borderRadius: "var(--radius-element)", borderColor: "var(--color-border)", boxShadow: "var(--shadow-low)" } },
    badge: { base: { borderRadius: "var(--radius-full)" } },
    "side-nav": { base: { backgroundColor: "var(--color-background-surface)", borderColor: "var(--color-border)" } },
    "side-nav-heading": { base: { color: "var(--color-text-disabled)", fontFamily: "var(--font-family-code)", letterSpacing: "0.08em", marginBlockEnd: "var(--spacing-4)" } },
    "side-nav-item": {
      base: {
        borderRadius: "var(--radius-element)",
        // Roomier on every side than the previous 12/16.
        padding: "var(--spacing-4) var(--spacing-5)",
        // Rows in the same group no longer sit flush against each other.
        marginBlockEnd: "var(--spacing-1-5)",
        transition: "background-color var(--duration-fast) ease, color var(--duration-fast) ease, box-shadow var(--duration-fast) ease",
        // Each row is its own rounded rectangle, not a bare text row.
        ":hover": { backgroundColor: "var(--color-background-muted)" },
      },
      selected: { backgroundColor: "var(--color-accent-muted)", color: "var(--color-text-accent)", boxShadow: "inset 3px 0 0 var(--color-accent)", fontWeight: "var(--font-weight-semibold)" },
    },
    // Group blocks sit roughly twice as far apart as the items inside them.
    "side-nav-section": { base: { marginBlockStart: "var(--spacing-8)" } },
    selector: { base: { borderRadius: "var(--radius-element)" } },
    "top-nav": { base: { backgroundColor: "var(--color-background-surface)", borderColor: "var(--color-border)" } },
  },
});
