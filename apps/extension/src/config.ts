export const PRODUCTION_BACKEND_URL = "https://thread-research-intelligence.sujeethsai265.chatgpt.site";
export const BACKEND_MIGRATION_VERSION = 2;

export function normalizeBackendUrl(value: unknown) {
  const candidate = String(value || PRODUCTION_BACKEND_URL).trim();
  try {
    const url = new URL(candidate);
    if (url.protocol !== "https:" && url.protocol !== "http:") return PRODUCTION_BACKEND_URL;
    const pathname = url.pathname.replace(/\/+$/, "");
    return `${url.origin}${pathname === "/" ? "" : pathname}`;
  } catch {
    return PRODUCTION_BACKEND_URL;
  }
}

export function isLegacyLocalBackend(value: unknown) {
  try {
    const url = new URL(String(value || ""));
    return (url.hostname === "localhost" || url.hostname === "127.0.0.1") && (url.port === "3000" || url.port === "3001");
  } catch {
    return false;
  }
}

export async function migrateLegacyBackend() {
  const stored = await chrome.storage.sync.get(["backendUrl", "backendMigrationVersion"]);
  if (Number(stored.backendMigrationVersion || 0) >= BACKEND_MIGRATION_VERSION) return;
  const current = String(stored.backendUrl || "");
  const backendUrl = current ? normalizeBackendUrl(current) : PRODUCTION_BACKEND_URL;
  await chrome.storage.sync.set({ backendUrl, backendMigrationVersion: BACKEND_MIGRATION_VERSION });
}
