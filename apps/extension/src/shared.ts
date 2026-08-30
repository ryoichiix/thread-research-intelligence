import type { DocumentType, EvidenceType, SourceReference } from "@thread/shared";

export type ExtensionAction = "save" | "explain" | "verify";

export interface SelectionContext {
  selectedText: string;
  surroundingContext: string;
  pageTitle: string;
  url: string;
  hostname: string;
  author: string;
  authors: string[];
  publicationDate: string;
  documentType: DocumentType;
  publisher: string;
  journal: string;
  doi: string;
  citationCount: number | null;
  referenceCount: number | null;
  citedByUrl: string;
  pdfUrl: string;
  metadataProvider: string;
  references: SourceReference[];
}

/**
 * Minimum length a selection must reach before THREAD will act on it. Shared so the
 * injected page script, the background action guard, and the tests cannot drift apart.
 */
export const MIN_SELECTION_LENGTH = 8;

export function normalizeSelectionText(value: string | null | undefined) {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

/**
 * Decides which of two candidate strings is the real selection.
 *
 * The injected script reports whatever `window.getSelection()` holds on the page right now;
 * `fallback` is the text a caller already knew about (the context-menu path supplies
 * `info.selectionText`, the side-panel path supplies nothing). Prefer the live selection once
 * it is substantial enough to act on, otherwise defer to the caller's text, and only return a
 * too-short live selection when there is no caller text to fall back to — the length guard in
 * runAction then produces the same "select a specific claim" message either way.
 */
export function resolveSelectedText(liveSelection: string | null | undefined, fallback: string | null | undefined) {
  const live = normalizeSelectionText(liveSelection);
  if (live.length >= MIN_SELECTION_LENGTH) return live;
  const passed = normalizeSelectionText(fallback);
  return passed || live;
}

export interface ExtensionState {
  status: "idle" | "loading" | "success" | "warning" | "error";
  action?: ExtensionAction;
  selection?: SelectionContext;
  result?: Record<string, unknown>;
  message: string;
  updatedAt: string;
}

type CompatibleRuntime = {
  id?: string;
  sendMessage?: (message: unknown) => Promise<unknown>;
};

export class ExtensionRuntimeUnavailableError extends Error {
  constructor() {
    super("THREAD_RECONNECT_REQUIRED");
    this.name = "ExtensionRuntimeUnavailableError";
  }
}

export function isExtensionRuntimeError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || "");
  return error instanceof ExtensionRuntimeUnavailableError || /THREAD_RECONNECT_REQUIRED|extension context invalid|context invalidated|receiving end does not exist|sendMessage/i.test(message);
}

export async function sendExtensionMessage<T>(message: Record<string, unknown>): Promise<T> {
  const globals = globalThis as unknown as {
    chrome?: { runtime?: CompatibleRuntime };
    browser?: { runtime?: CompatibleRuntime };
  };
  let runtime: CompatibleRuntime | undefined;
  try {
    runtime = globals.chrome?.runtime ?? globals.browser?.runtime;
  } catch {
    runtime = undefined;
  }
  if (!runtime?.id || typeof runtime.sendMessage !== "function") throw new ExtensionRuntimeUnavailableError();
  try {
    return await runtime.sendMessage(message) as T;
  } catch (error) {
    if (isExtensionRuntimeError(error)) throw new ExtensionRuntimeUnavailableError();
    throw error;
  }
}

export function createEvidencePayload(context: SelectionContext, projectId: string) {
  return {
    projectId,
    selectedText: context.selectedText,
    surroundingContext: context.surroundingContext,
    pageTitle: context.pageTitle,
    url: context.url,
    author: context.author || "Unknown author",
    publicationDate: context.publicationDate,
    evidenceType: "unknown" as EvidenceType,
    topic: "Unclassified",
    documentType: context.documentType,
    authors: context.authors,
    publisher: context.publisher,
    journal: context.journal,
    doi: context.doi,
    citationCount: context.citationCount,
    referenceCount: context.referenceCount,
    citedByUrl: context.citedByUrl,
    pdfUrl: context.pdfUrl,
    metadataProvider: context.metadataProvider,
    references: context.references,
  };
}

export function actionEndpoint(action: ExtensionAction) {
  if (action === "save") return "/api/evidence";
  if (action === "explain") return "/api/analyze/evidence";
  return "/api/verify";
}

export function selectionFingerprint(context: Pick<SelectionContext, "selectedText" | "url">) {
  return `${context.url}::${context.selectedText.replace(/\s+/g, " ").trim()}`;
}
