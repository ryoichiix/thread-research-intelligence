import { isExtensionRuntimeError, sendExtensionMessage, type SelectionContext } from "./shared";

const MIN_SELECTION_LENGTH = 8;
const MAX_SELECTION_LENGTH = 12_000;
const BUTTON_DELAY = 80;
const THREAD_BUILD = "0.8.2";

let captureTimer: number | undefined;
let noticeTimer: number | undefined;
let pendingContext: SelectionContext | null = null;
let pendingRect: DOMRect | null = null;
let capturing = false;
let reconnectRequired = false;

const lifecycleWindow = window as Window & { __threadCaptureLifecycle?: AbortController };
lifecycleWindow.__threadCaptureLifecycle?.abort();
const lifecycle = new AbortController();
lifecycleWindow.__threadCaptureLifecycle = lifecycle;

const backendMarker = document.querySelector<HTMLMetaElement>('meta[name="thread-extension-backend"]');
const legacyThreadDeployment = /\bTHREAD\b/i.test(document.title) && /research intelligence/i.test(document.title);
if (backendMarker?.content === "self" || legacyThreadDeployment) {
  sendExtensionMessage({ type: "REGISTER_THREAD_BACKEND", backendUrl: location.origin }).catch(() => undefined);
}

const staleHost = [...document.querySelectorAll<HTMLElement>('aside[aria-live="polite"]')].find((element) =>
  element.id === "thread-extension-capture-root" || (element.style.position === "fixed" && element.style.zIndex === "2147483647"),
);
staleHost?.remove();

interface ProjectChoice {
  id: string;
  title: string;
  researchQuestion: string;
}

const host = document.createElement("aside");
host.id = "thread-extension-capture-root";
host.dataset.threadBuild = THREAD_BUILD;
host.setAttribute("aria-live", "polite");
host.style.setProperty("all", "initial");
host.style.setProperty("position", "fixed");
host.style.setProperty("z-index", "2147483647");
host.style.setProperty("display", "none");
document.documentElement.append(host);

const shadow = host.attachShadow({ mode: "closed" });
const style = document.createElement("style");
style.textContent = `
  :host { --thread-ink: #151515; --thread-paper: #fffef9; --thread-line: #d7d3c8; --thread-ok: #17723a; --thread-warn: #9a6500; --thread-error: #a92e2e; }
  button { all: unset; box-sizing: border-box; display: flex; align-items: center; gap: 8px; max-width: 330px; min-height: 38px; padding: 8px 12px; color: var(--thread-ink); background: var(--thread-paper); border: 1px solid var(--thread-line); border-radius: 10px; box-shadow: 0 10px 30px rgba(0,0,0,.16); font: 600 12px/1.35 ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; letter-spacing: .01em; cursor: default; }
  button[data-state="ready"] { cursor: pointer; }
  button[data-state="ready"]:hover { border-color: currentColor; transform: translateY(-1px); }
  button[data-state="loading"] { cursor: wait; }
  button[data-state="success"] { border-color: var(--thread-ok); color: var(--thread-ok); }
  button[data-state="warning"] { border-color: var(--thread-warn); color: var(--thread-warn); }
  button[data-state="error"] { border-color: var(--thread-error); color: var(--thread-error); }
  button[data-state="reconnect"] { border-color: var(--thread-warn); color: var(--thread-warn); cursor: pointer; }
  .chooser { box-sizing: border-box; width: 330px; max-height: min(330px, 48vh); overflow: auto; padding: 8px; color: var(--thread-ink); background: var(--thread-paper); border: 1px solid var(--thread-line); border-radius: 12px; box-shadow: 0 16px 44px rgba(0,0,0,.2); font: 500 12px/1.4 ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
  .chooser strong { display: block; padding: 7px 8px 4px; font-size: 11px; letter-spacing: .08em; text-transform: uppercase; }
  .chooser button { display: block; width: 100%; max-width: none; margin-top: 4px; box-shadow: none; cursor: pointer; }
  .chooser button:hover { border-color: var(--thread-ink); }
  .chooser small { display: block; margin-top: 3px; color: #67645d; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .suggested { color: var(--thread-ok); font-size: 10px; letter-spacing: .08em; }
  svg { width: 20px; height: 20px; flex: 0 0 auto; fill: none; stroke: currentColor; stroke-width: 1.6; stroke-linecap: round; }
  .spinner { width: 12px; height: 12px; border: 2px solid var(--thread-line); border-top-color: currentColor; border-radius: 50%; animation: spin .8s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }
`;
const notice = document.createElement("button");
notice.type = "button";
notice.tabIndex = 0;
notice.innerHTML = '<svg viewBox="0 0 40 40" aria-hidden="true"><path d="M8 7h24M8 13h14M18 13v20M12 33h20"/><circle cx="8" cy="7" r="2"/><circle cx="32" cy="7" r="2"/></svg><span>Thread</span>';
shadow.append(style, notice);

function showNotice(message: string, state: "ready" | "loading" | "success" | "warning" | "error" | "reconnect", rect: DOMRect) {
  if (noticeTimer) window.clearTimeout(noticeTimer);
  notice.dataset.state = state;
  notice.querySelector("span")!.textContent = message;
  const spinner = notice.querySelector(".spinner");
  if (state === "loading" && !spinner) notice.insertAdjacentHTML("beforeend", '<i class="spinner" aria-hidden="true"></i>');
  if (state !== "loading") spinner?.remove();
  host.style.setProperty("display", "block");
  host.style.setProperty("left", `${Math.max(12, Math.min(rect.left, window.innerWidth - 330))}px`);
  host.style.setProperty("top", `${Math.min(window.innerHeight - 58, rect.bottom + 10)}px`);
  if (state !== "loading" && state !== "reconnect") noticeTimer = window.setTimeout(() => host.style.setProperty("display", "none"), state === "ready" ? 8000 : 3400);
}

function invalidExtensionContext(error: unknown) {
  return isExtensionRuntimeError(error);
}

function showReconnect(rect: DOMRect) {
  reconnectRequired = true;
  capturing = false;
  showNotice("Reload page to reconnect THREAD", "reconnect", rect);
}

function showProjectChooser(projects: ProjectChoice[], suggestedProjectId: string | null, rect: DOMRect) {
  shadow.querySelector(".chooser")?.remove();
  notice.style.display = "none";
  const chooser = document.createElement("section");
  chooser.className = "chooser";
  chooser.setAttribute("aria-label", "Choose a THREAD research project");
  chooser.innerHTML = "<strong>Add this evidence to</strong>";
  for (const project of projects) {
    const option = document.createElement("button");
    option.type = "button";
    option.dataset.projectId = project.id;
    if (project.id === suggestedProjectId) {
      const marker = document.createElement("span");
      marker.className = "suggested";
      marker.textContent = "SUGGESTED";
      option.append(marker);
    }
    const title = document.createElement("span");
    title.textContent = project.title;
    const question = document.createElement("small");
    question.textContent = project.researchQuestion;
    option.append(title, question);
    chooser.append(option);
  }
  shadow.append(chooser);
  host.style.setProperty("display", "block");
  host.style.setProperty("left", `${Math.max(12, Math.min(rect.left, window.innerWidth - 350))}px`);
  host.style.setProperty("top", `${Math.max(12, Math.min(window.innerHeight - 350, rect.bottom + 10))}px`);
  chooser.addEventListener("click", async (event) => {
    const option = (event.target as Element).closest<HTMLButtonElement>("button[data-project-id]");
    if (!option || !pendingContext || !pendingRect) return;
    const context = pendingContext;
    chooser.remove();
    notice.style.display = "flex";
    capturing = true;
    showNotice("Analyzing against existing research…", "loading", rect);
    try {
      const response = await sendExtensionMessage<{ ok?: boolean; duplicate?: boolean; error?: string; result?: { status?: string } }>({ type: "CAPTURE_THREAD_SELECTION", context, projectId: option.dataset.projectId });
      if (!response?.ok) throw new Error(response?.error || "Capture failed");
      const conflict = String(response.result?.status || "").includes("CONFLICT");
      pendingContext = null;
      pendingRect = null;
      showNotice(response.duplicate ? "Already added to this paper" : conflict ? "Added · contradiction found" : "Analyzed and added", conflict ? "warning" : "success", rect);
    } catch (error) {
      if (invalidExtensionContext(error)) showReconnect(rect);
      else showNotice(error instanceof Error ? error.message : "THREAD could not capture this text", "error", rect);
    } finally {
      capturing = false;
    }
  });
}

function getSelectionContext(selection: Selection): SelectionContext | null {
  const selectedText = selection.toString().replace(/\s+/g, " ").trim();
  if (selectedText.length < MIN_SELECTION_LENGTH || selectedText.length > MAX_SELECTION_LENGTH || selection.rangeCount === 0) return null;
  const range = selection.getRangeAt(0);
  const container = range.commonAncestorContainer;
  const parent = container.nodeType === Node.TEXT_NODE ? container.parentElement : container as Element;
  const surroundingContext = parent?.textContent?.replace(/\s+/g, " ").trim().slice(0, 2400) || selectedText;
  const meta = (...names: string[]) => names.map((name) => document.querySelector(`meta[name="${name}"], meta[property="${name}"]`)?.getAttribute("content")?.trim()).find(Boolean) || "";
  const metaAll = (...names: string[]) => names.flatMap((name) => [...document.querySelectorAll(`meta[name="${name}"], meta[property="${name}"]`)].map((element) => element.getAttribute("content")?.trim() || "")).filter(Boolean);
  const absolute = (value: string) => { try { return value ? new URL(value, location.href).href : ""; } catch { return ""; } };
  const scholarResult = parent?.closest(".gs_r");
  const scholarTitleLink = scholarResult?.querySelector<HTMLAnchorElement>(".gs_rt a");
  const scholarByline = scholarResult?.querySelector(".gs_a")?.textContent?.replace(/\s+/g, " ").trim() || "";
  const scholarCitedBy = [...(scholarResult?.querySelectorAll<HTMLAnchorElement>(".gs_fl a") ?? [])].find((anchor) => /cited by/i.test(anchor.textContent || ""));
  const scholarlyAuthors = metaAll("citation_author", "bepress_citation_author");
  const author = scholarlyAuthors.join(", ") || meta("author", "article:author", "DC.creator") || scholarByline.split(" - ")[0] || "";
  const publicationDate = meta("citation_publication_date", "citation_date", "article:published_time", "DC.issued", "prism.publicationDate") || scholarByline.match(/\b(19|20)\d{2}\b/)?.[0] || document.querySelector('time[datetime]')?.getAttribute("datetime") || "";
  const journal = meta("citation_journal_title", "prism.publicationName");
  const conference = meta("citation_conference_title");
  const dissertation = meta("citation_dissertation_institution");
  const reportInstitution = meta("citation_technical_report_institution");
  const doi = meta("citation_doi", "DC.identifier", "prism.doi") || location.href.match(/10\.\d{4,9}\/[-._;()/:a-z0-9]+/i)?.[0] || "";
  const canonicalUrl = document.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.href || location.href;
  const sourceUrl = absolute(scholarTitleLink?.href || canonicalUrl);
  const pdfUrl = absolute(meta("citation_pdf_url") || scholarResult?.querySelector<HTMLAnchorElement>(".gs_or_ggsm a")?.href || "");
  const referenceElements = [...document.querySelectorAll<HTMLElement>('#references li, .references li, [role="doc-biblioref"], .csl-entry')].slice(0, 60);
  const references = referenceElements.map((element) => {
    const text = element.textContent?.replace(/\s+/g, " ").trim().slice(0, 1000) || "";
    const url = absolute(element.querySelector<HTMLAnchorElement>("a[href]")?.href || "");
    const referenceDoi = text.match(/10\.\d{4,9}\/[-._;()/:a-z0-9]+/i)?.[0];
    return { text, ...(url ? { url } : {}), ...(referenceDoi ? { doi: referenceDoi } : {}) };
  }).filter((item) => item.text);
  const contentType = document.contentType.toLowerCase();
  const hostName = location.hostname.toLowerCase();
  const documentType = journal ? "journal_article" : conference ? "conference_paper" : dissertation ? "thesis" : reportInstitution ? "technical_report" : /arxiv|biorxiv|medrxiv|ssrn/.test(hostName) ? "preprint" : contentType.includes("pdf") || /\.pdf(?:$|[?#])/.test(sourceUrl) ? "pdf" : /\.gov$|\.gov\./.test(hostName) ? "government_report" : /docs\.|\/docs\//.test(`${hostName}${location.pathname}`) ? "documentation" : /blog|medium|substack/.test(`${hostName}${location.pathname}`) ? "blog_post" : "webpage";
  return {
    selectedText,
    surroundingContext,
    pageTitle: meta("citation_title", "bepress_citation_title", "og:title", "DC.title") || scholarTitleLink?.textContent?.trim() || document.title || location.hostname,
    url: sourceUrl,
    hostname: location.hostname,
    author,
    authors: scholarlyAuthors.length ? scholarlyAuthors : author ? author.split(/,| and /).map((value) => value.trim()).filter(Boolean) : [],
    publicationDate,
    documentType,
    publisher: meta("citation_publisher", "DC.publisher", "og:site_name") || reportInstitution || dissertation,
    journal: journal || conference,
    doi,
    citationCount: scholarCitedBy ? Number(scholarCitedBy.textContent?.match(/\d+/)?.[0] || 0) : null,
    referenceCount: references.length || null,
    citedByUrl: absolute(scholarCitedBy?.href || ""),
    pdfUrl,
    metadataProvider: scholarResult ? "google_scholar" : scholarlyAuthors.length ? "scholarly_meta" : "page",
    references,
  };
}

function scheduleCapture(event?: Event) {
  // Brave exposes the original shadow-DOM target during the capture phase.
  // `host.contains(target)` does not cross a shadow boundary, so the old check
  // hid the button on mouseup before its click handler could run.
  const eventPath = event?.composedPath?.() ?? [];
  if (eventPath.includes(host) || eventPath.includes(notice)) return;
  if (captureTimer) window.clearTimeout(captureTimer);
  if (capturing) return;
  const selection = window.getSelection();
  const context = selection ? getSelectionContext(selection) : null;
  if (!context) {
    shadow.querySelector(".chooser")?.remove();
    notice.style.display = "flex";
    pendingContext = null;
    pendingRect = null;
    host.style.setProperty("display", "none");
    return;
  }
  const rect = selection!.getRangeAt(0).getBoundingClientRect();
  if (!rect.width && !rect.height) return;
  captureTimer = window.setTimeout(() => {
    pendingContext = context;
    pendingRect = rect;
    showNotice("Thread", "ready", rect);
  }, BUTTON_DELAY);
}

notice.addEventListener("click", async (event) => {
  event.preventDefault();
  event.stopPropagation();
  if (reconnectRequired) {
    window.location.reload();
    return;
  }
  if (!pendingContext || !pendingRect || capturing) return;
  const context = pendingContext;
  const rect = pendingRect;
  capturing = true;
  showNotice("Finding the right research paper…", "loading", rect);
  try {
    const response = await sendExtensionMessage<{ ok?: boolean; error?: string; projects?: ProjectChoice[]; suggestedProjectId?: string | null }>({ type: "GET_THREAD_PROJECTS", context });
    if (!response?.ok) throw new Error(response?.error || "Capture failed");
    if (!response.projects?.length) throw new Error("Create a research project in THREAD first.");
    showProjectChooser(response.projects, response.suggestedProjectId ?? null, rect);
  } catch (error) {
    if (invalidExtensionContext(error)) showReconnect(rect);
    else showNotice(error instanceof Error ? error.message : "THREAD could not load your research projects", "error", rect);
  } finally {
    capturing = false;
  }
}, { signal: lifecycle.signal });

document.addEventListener("mouseup", scheduleCapture, { capture: true, signal: lifecycle.signal });
document.addEventListener("keyup", (event) => {
  if (event.key.startsWith("Arrow") || event.key === "Shift") scheduleCapture();
}, { capture: true, signal: lifecycle.signal });
