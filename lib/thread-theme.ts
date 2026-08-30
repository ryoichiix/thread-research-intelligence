import { defineTheme } from "@astryxdesign/core/theme";

export const threadStudioTheme = defineTheme({
  name: "thread-studio",
  color: {
    accent: "#12355B",
    neutralStyle: "cool",
    contrast: "high",
  },
  tokens: {
    // --color-accent is pinned explicitly rather than left to the color.accent seed, which the
    // system is free to nudge for contrast. Verify after building that
    // getComputedStyle(document.documentElement).getPropertyValue('--color-accent') resolves to
    // exactly #12355B. One accent only — no second blue, no teal as a general-purpose accent.
    "--color-accent": ["#12355B", "#12355B"],
    "--color-background-body": ["#F8FAFC", "#F8FAFC"],
    "--color-background-surface": ["#FFFFFF", "#FFFFFF"],
    "--color-background-card": ["#FFFFFF", "#FFFFFF"],
    "--color-background-popover": ["#FFFFFF", "#FFFFFF"],
    "--color-background-muted": ["#EEF2F6", "#EEF2F6"],
    "--color-text-primary": ["#1E293B", "#1E293B"],
    "--color-text-secondary": ["#64748B", "#64748B"],
    "--color-text-disabled": ["#9AA7B8", "#9AA7B8"],
    "--color-border": ["#E2E8F0", "#E2E8F0"],
    "--color-border-emphasized": ["#C7D1DE", "#C7D1DE"],
    "--color-track": ["#E2E8F0", "#E2E8F0"],
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
        borderRadius: "var(--radius-full)",
        fontWeight: "var(--font-weight-semibold)",
        transition: "transform var(--duration-fast) ease, filter var(--duration-fast) ease, box-shadow var(--duration-fast) ease",
        ":hover": { filter: "contrast(1.05) brightness(1.02)", transform: "translateY(-1px)" },
        ":active": { transform: "translateY(0)" },
      },
      "variant:secondary": {
        backgroundColor: "transparent",
        borderWidth: "var(--border-width)",
        borderStyle: "solid",
        borderColor: "var(--color-border-emphasized)",
        color: "var(--color-text-primary)",
        boxShadow: "none",
        ":hover": { backgroundColor: "var(--color-background-muted)", borderColor: "var(--color-text-secondary)" },
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
