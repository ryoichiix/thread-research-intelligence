export function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <svg
      className={compact ? "brand-mark brand-mark-compact" : "brand-mark"}
      viewBox="0 0 40 40"
      role="img"
      aria-label="THREAD"
    >
      <path d="M8 7h24M8 13h14M18 13v20M12 33h20" />
      <circle cx="8" cy="7" r="2" />
      <circle cx="32" cy="7" r="2" />
      <circle cx="8" cy="13" r="2" />
      <circle cx="18" cy="33" r="2" />
      <circle cx="32" cy="33" r="2" />
    </svg>
  );
}
