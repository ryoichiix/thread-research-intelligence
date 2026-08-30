import { defineTheme } from "@astryxdesign/core/theme";

export const threadStudioTheme = defineTheme({
  name: "thread-studio",
  color: { accent: "#D24A36", neutralStyle: "warm", contrast: "high" },
  tokens: {
    "--color-background-body": ["#F2EFE8", "#11100E"],
    "--color-background-surface": ["#FBFAF6", "#191816"],
    "--color-background-card": ["#FBFAF6", "#191816"],
    "--color-background-popover": ["#FFFFFF", "#211F1C"],
    "--color-background-muted": ["#EAE5DB", "#27241F"],
    "--color-text-primary": ["#1B1916", "#F6F2E9"],
    "--color-text-secondary": ["#666159", "#B4ADA1"],
    "--color-text-disabled": ["#9C958A", "#716A60"],
    "--color-border": ["#D9D2C6", "#37332D"],
    "--color-border-emphasized": ["#9D9589", "#6B645B"],
    "--color-track": ["#DED7CB", "#37332D"],
  },
  typography: {
    scale: { base: 15, ratio: 1.18 },
    body: { family: "Geist", fallbacks: "Inter, Avenir Next, -apple-system, BlinkMacSystemFont, system-ui, sans-serif" },
    heading: { family: "Geist", fallbacks: "Inter, Avenir Next, -apple-system, BlinkMacSystemFont, system-ui, sans-serif", weight: "semibold", weights: { 1: "bold", 2: "semibold" } },
    code: { family: "Geist Mono", fallbacks: "SFMono-Regular, ui-monospace, monospace" },
  },
  radius: { base: 3, multiplier: 0.8 },
  motion: { fast: 90, medium: 180, slow: 360, ratio: 0.72 },
  components: {
    button: {
      base: {
        borderRadius: "var(--radius-element)",
        fontWeight: "var(--font-weight-semibold)",
        ":hover": { filter: "contrast(1.04)" },
      },
    },
    card: {
      base: {
        borderRadius: "var(--radius-element)",
        borderColor: "var(--color-border-emphasized)",
        boxShadow: "none",
      },
    },
    "side-nav": {
      base: {
        backgroundColor: "var(--color-background-surface)",
        borderColor: "var(--color-border)",
      },
    },
    "side-nav-item": {
      base: { borderRadius: "var(--radius-element)" },
      selected: {
        backgroundColor: "var(--color-accent-muted)",
        color: "var(--color-text-accent)",
        boxShadow: "inset calc(var(--border-width) * 2) 0 0 var(--color-accent)",
      },
    },
    selector: {
      base: { borderRadius: "var(--radius-element)" },
    },
    "top-nav": {
      base: {
        backgroundColor: "var(--color-background-surface)",
        borderColor: "var(--color-border)",
      },
    },
  },
});
