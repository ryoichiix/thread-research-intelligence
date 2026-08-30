import { callThread, fetchThread, getThreadProjects, readThreadJson, type ExtensionProject } from "./api";
import { migrateLegacyBackend, normalizeBackendUrl } from "./config";
import { selectionFingerprint, type ExtensionAction, type ExtensionState, type SelectionContext } from "./shared";

const menuItems: Array<{ id: ExtensionAction; title: string }> = [
  { id: "save", title: "SAVE TO THREAD" },
  { id: "explain", title: "EXPLAIN WITH THREAD" },
  { id: "verify", title: "VERIFY AGAINST THREAD" },
];

async function reconnectOpenTabs() {
  const tabs = await chrome.tabs.query({});
  await Promise.all(tabs.map(async (tab) => {
    if (!tab.id || !/^(https?|file):/i.test(tab.url || "")) return;
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["content.js"] }).catch(() => undefined);
  }));
}

chrome.runtime.onInstalled.addListener(() => {
  migrateLegacyBackend().catch(() => undefined);
  chrome.contextMenus.removeAll(() => {
    for (const item of menuItems) {
      chrome.contextMenus.create({ id: item.id, title: item.title, contexts: ["selection"] });
    }
  });
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => undefined);
  reconnectOpenTabs().catch(() => undefined);
});

chrome.runtime.onStartup.addListener(() => {
  migrateLegacyBackend().catch(() => undefined);
});

migrateLegacyBackend().catch(() => undefined);

async function registerThreadBackend(value: string) {
  const backendUrl = normalizeBackendUrl(value);
  let compatible = false;
  try {
    const response = await fetchThread(backendUrl, "/api/extension/config");
    const body = await readThreadJson<{ product?: string; apiVersion?: number }>(response);
    compatible = response.ok && body.product === "thread-research-intelligence" && body.apiVersion === 1;
  } catch {
    // Older THREAD deployments predate the discovery endpoint. The projects
    // route remains a safe compatibility probe and can also be relayed through
    // the already-open deployment tab.
  }
  if (!compatible) {
    try {
      const response = await fetchThread(backendUrl, "/api/projects");
      const body = await readThreadJson<{ projects?: unknown[]; error?: string }>(response);
      compatible = (response.ok && Array.isArray(body.projects)) || (response.status === 401 && /auth/i.test(body.error ?? ""));
    } catch {
      compatible = false;
    }
  }
  if (!compatible) throw new Error("This page is not a compatible or reachable THREAD deployment.");
  await chrome.storage.sync.set({ backendUrl });
  const stored = await chrome.storage.local.get("threadBackends");
  const history = [backendUrl, ...(Array.isArray(stored.threadBackends) ? stored.threadBackends.map(String) : []).filter((item) => item !== backendUrl)].slice(0, 8);
  await chrome.storage.local.set({ threadBackends: history, lastBackendDetectedAt: new Date().toISOString() });
  return backendUrl;
}

async function pageContext(tab: chrome.tabs.Tab, selectedText: string): Promise<SelectionContext> {
  if (!tab.id) throw new Error("No active tab is available.");
  try {
    const [{ result }] = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    args: [selectedText],
    func: (selection: string) => {
      const chosen = window.getSelection();
      let context = selection;
      if (chosen && chosen.rangeCount > 0) {
        const container = chosen.getRangeAt(0).commonAncestorContainer;
        const parent = container.nodeType === Node.TEXT_NODE ? container.parentElement : (container as Element);
        context = parent?.textContent?.replace(/\s+/g, " ").trim().slice(0, 1600) || selection;
      }
      const author = document.querySelector('meta[name="author"]')?.getAttribute("content") || "";
      const meta = (...names: string[]) => names.map((name) => document.querySelector(`meta[name="${name}"], meta[property="${name}"]`)?.getAttribute("content")?.trim()).find(Boolean) || "";
      const authors = [...document.querySelectorAll('meta[name="citation_author"], meta[name="bepress_citation_author"]')].map((element) => element.getAttribute("content")?.trim() || "").filter(Boolean);
      const publicationDate =
        meta("citation_publication_date", "citation_date", "article:published_time", "DC.issued") ||
        document.querySelector('time[datetime]')?.getAttribute("datetime") || "";
      const journal = meta("citation_journal_title", "citation_conference_title", "prism.publicationName");
      const doi = meta("citation_doi", "DC.identifier", "prism.doi") || location.href.match(/10\.\d{4,9}\/[-._;()/:a-z0-9]+/i)?.[0] || "";
      const pdfUrl = meta("citation_pdf_url");
      const host = location.hostname.toLowerCase();
      const documentType = journal ? "journal_article" : /arxiv|biorxiv|medrxiv|ssrn/.test(host) ? "preprint" : document.contentType.includes("pdf") || /\.pdf(?:$|[?#])/.test(location.href) ? "pdf" : /\.gov$|\.gov\./.test(host) ? "government_report" : /docs\.|\/docs\//.test(`${host}${location.pathname}`) ? "documentation" : /blog|medium|substack/.test(`${host}${location.pathname}`) ? "blog_post" : "webpage";
      return {
        selectedText: selection,
        surroundingContext: context,
        pageTitle: meta("citation_title", "bepress_citation_title", "og:title", "DC.title") || document.title,
        url: document.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.href || location.href,
        hostname: location.hostname,
        author: authors.join(", ") || author,
        authors,
        publicationDate,
        documentType,
        publisher: meta("citation_publisher", "DC.publisher", "og:site_name"),
        journal,
        doi,
        citationCount: null,
        referenceCount: null,
        citedByUrl: "",
        pdfUrl,
        metadataProvider: authors.length ? "scholarly_meta" : "page",
        references: [],
      };
    },
  });
    if (!result) throw new Error("THREAD could not read the selected page context.");
    return result as SelectionContext;
  } catch {
    const url = tab.url || "https://unknown.invalid/";
    return { selectedText, surroundingContext: selectedText, pageTitle: tab.title || "Browser document", url, hostname: (() => { try { return new URL(url).hostname; } catch { return ""; } })(), author: "", authors: [], publicationDate: "", documentType: /\.pdf(?:$|[?#])/i.test(url) ? "pdf" : "unknown", publisher: "", journal: "", doi: url.match(/10\.\d{4,9}\/[-._;()/:a-z0-9]+/i)?.[0] || "", citationCount: null, referenceCount: null, citedByUrl: "", pdfUrl: /\.pdf(?:$|[?#])/i.test(url) ? url : "", metadataProvider: "browser_document", references: [] };
  }
}

async function setState(state: ExtensionState) {
  await chrome.storage.session.set({ threadState: state });
}

async function runAction(action: ExtensionAction, tab: chrome.tabs.Tab, selectionText?: string) {
  if (!tab.id) throw new Error("No active tab is available.");
  const context = await pageContext(tab, selectionText || "");
  if (context.selectedText.trim().length < 8) throw new Error("Select a specific claim before using THREAD.");
  await setState({ status: "loading", action, selection: context, message: action === "save" ? "Analyzing evidence…" : action === "verify" ? "Checking for conflicts…" : "Explaining with research context…", updatedAt: new Date().toISOString() });
  await chrome.action.setBadgeText({ text: "…", tabId: tab.id });
  const result = await callThread(action, context);
  const status = String(result.status || "");
  await setState({ status: status.includes("CONFLICT") ? "warning" : "success", action, selection: context, result, message: action === "save" ? status.includes("CONFLICT") ? "Evidence captured · potential conflict detected" : "Evidence captured and integrated" : action === "verify" ? status === "POTENTIAL_CONFLICT" ? "Potential conflict detected" : "Verification complete" : "Explanation ready", updatedAt: new Date().toISOString() });
  await chrome.action.setBadgeText({ text: status.includes("CONFLICT") ? "!" : "✓", tabId: tab.id });
  await chrome.action.setBadgeBackgroundColor({ color: status.includes("CONFLICT") ? "#C58600" : "#0D8626", tabId: tab.id });
  return result;
}

const captures = new Map<string, number>();

async function captureSelection(context: SelectionContext, projectId?: string, tabId?: number) {
  const fingerprint = `${projectId || "default"}:${selectionFingerprint(context)}`;
  const previous = captures.get(fingerprint) ?? 0;
  if (Date.now() - previous < 30_000) return { duplicate: true };
  captures.set(fingerprint, Date.now());
  await setState({ status: "loading", action: "save", selection: context, message: "Analyzing selected evidence…", updatedAt: new Date().toISOString() });
  if (tabId) await chrome.action.setBadgeText({ text: "…", tabId });
  try {
    const result = await callThread("save", context, projectId);
    const status = String(result.status || "");
    const warning = status.includes("CONFLICT");
    await setState({ status: warning ? "warning" : "success", action: "save", selection: context, result, message: warning ? "Added · potential conflict detected" : "Analyzed and added to research", updatedAt: new Date().toISOString() });
    if (tabId) {
      await chrome.action.setBadgeText({ text: warning ? "!" : "✓", tabId });
      await chrome.action.setBadgeBackgroundColor({ color: warning ? "#C58600" : "#0D8626", tabId });
    }
    return { duplicate: false, result };
  } catch (error) {
    captures.delete(fingerprint);
    throw error;
  }
}

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (tab?.id) chrome.sidePanel.open({ tabId: tab.id }).catch(() => undefined);
  try {
    if (!tab) throw new Error("No active tab is available.");
    const action = info.menuItemId as ExtensionAction;
    if (!menuItems.some((item) => item.id === action)) return;
    await runAction(action, tab, info.selectionText);
  } catch (error) {
    await setState({ status: "error", message: error instanceof Error ? error.message : "THREAD could not complete the action.", updatedAt: new Date().toISOString() });
  }
});

function projectMatch(project: ExtensionProject, context: SelectionContext) {
  const terms = `${context.selectedText} ${context.pageTitle}`.toLowerCase().match(/[a-z0-9]{4,}/g) ?? [];
  const haystack = `${project.title} ${project.researchQuestion} ${project.description} ${project.tags.join(" ")}`.toLowerCase();
  return new Set(terms.filter((term) => haystack.includes(term))).size;
}

chrome.runtime.onMessage.addListener((message: { type?: string; action?: ExtensionAction; context?: SelectionContext; projectId?: string; backendUrl?: string }, sender, sendResponse) => {
  if (message.type === "REGISTER_THREAD_BACKEND" && message.backendUrl) {
    registerThreadBackend(message.backendUrl)
      .then((backendUrl) => sendResponse({ ok: true, backendUrl }))
      .catch((error) => sendResponse({ ok: false, error: error instanceof Error ? error.message : "THREAD backend discovery failed." }));
    return true;
  }
  if (message.type === "GET_THREAD_PROJECTS" && message.context) {
    const context = message.context;
    getThreadProjects().then(({ projects, activeProjectId }) => {
      const ranked = projects.slice().sort((left, right) => projectMatch(right, context) - projectMatch(left, context));
      const best = ranked[0];
      const suggestedProjectId = best && projectMatch(best, context) > 0 ? best.id : activeProjectId ?? projects[0]?.id ?? null;
      sendResponse({ ok: true, projects, activeProjectId, suggestedProjectId });
    }).catch((error) => sendResponse({ ok: false, error: error instanceof Error ? error.message : "THREAD could not load projects." }));
    return true;
  }
  if (message.type === "CAPTURE_THREAD_SELECTION" && message.context) {
    captureSelection(message.context, message.projectId, sender.tab?.id).then((result) => sendResponse({ ok: true, ...result })).catch(async (error) => {
      const messageText = error instanceof Error ? error.message : "THREAD could not capture this selection.";
      await setState({ status: "error", selection: message.context, message: messageText, updatedAt: new Date().toISOString() });
      sendResponse({ ok: false, error: messageText });
    });
    return true;
  }
  if (message.type !== "RUN_THREAD_ACTION" || !message.action) return false;
  chrome.tabs.query({ active: true, currentWindow: true }).then(async ([tab]) => {
    try {
      if (!tab) throw new Error("No active tab is available.");
      const result = await runAction(message.action!, tab);
      sendResponse({ ok: true, result });
    } catch (error) {
      const messageText = error instanceof Error ? error.message : "THREAD could not complete the action.";
      await setState({ status: "error", message: messageText, updatedAt: new Date().toISOString() });
      sendResponse({ ok: false, error: messageText });
    }
  });
  return true;
});
