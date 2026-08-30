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
