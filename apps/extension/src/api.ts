import { actionEndpoint, createEvidencePayload, type ExtensionAction, type SelectionContext } from "./shared";
import { normalizeBackendUrl, PRODUCTION_BACKEND_URL } from "./config";

export interface ExtensionProject {
  id: string;
  title: string;
  researchQuestion: string;
  description: string;
  tags: string[];
}

type ThreadErrorBody = { error?: string };
type RelayResult = {
  status: number;
  statusText: string;
  contentType: string;
  text: string;
  error?: string;
};

export async function getBackendUrl() {
  const stored = await chrome.storage.sync.get("backendUrl");
  return normalizeBackendUrl(stored.backendUrl || PRODUCTION_BACKEND_URL);
}

function responseFromRelay(result: RelayResult) {
  return new Response(result.text, {
    status: result.status,
    statusText: result.statusText,
    headers: result.contentType ? { "Content-Type": result.contentType } : undefined,
  });
}

async function relayThroughOpenBackendTab(backend: string, path: string, init?: RequestInit) {
  const backendOrigin = new URL(backend).origin;
  const tabs = (await chrome.tabs.query({}))
    .filter((tab) => {
      if (!tab.id || !tab.url) return false;
      try { return new URL(tab.url).origin === backendOrigin; } catch { return false; }
    })
    .sort((left, right) => (right.lastAccessed ?? 0) - (left.lastAccessed ?? 0));
  const tab = tabs[0];
  if (!tab?.id) return null;

  const headers: Record<string, string> = {};
  new Headers(init?.headers).forEach((value, key) => { headers[key] = value; });
  const request = {
    method: init?.method ?? "GET",
    headers,
    body: typeof init?.body === "string" ? init.body : undefined,
  };
  const [{ result }] = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    world: "MAIN",
    args: [`${backend}${path}`, request],
    func: async (url: string, options: { method: string; headers: Record<string, string>; body?: string }): Promise<RelayResult> => {
      try {
        const response = await fetch(url, { ...options, credentials: "include" });
        return {
          status: response.status,
          statusText: response.statusText,
          contentType: response.headers.get("content-type") ?? "",
          text: await response.text(),
        };
      } catch (error) {
        return {
          status: 0,
          statusText: "Network error",
          contentType: "",
          text: "",
          error: error instanceof Error ? error.message : "The website could not relay the request.",
        };
      }
    },
  });
  if (!result || result.error || result.status === 0) {
    throw new Error(result?.error || `THREAD could not use the open ${backendOrigin} tab.`);
  }
  return responseFromRelay(result);
}

function shouldRetryInsideWebsite(response: Response) {
  const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
  return response.status === 401 || response.status === 403 || (!response.ok && !contentType.includes("json"));
}

export async function fetchThread(backend: string, path: string, init?: RequestInit) {
  const method = (init?.method ?? "GET").toUpperCase();
  let relayError: unknown;

  // Mutations run from an open THREAD tab first. They become same-origin on
  // localhost, ChatGPT Sites, Vercel, or any custom deployment, preserving
  // that deployment's login and avoiding host-level cross-origin blockers.
  if (method !== "GET" && method !== "HEAD") {
    try {
      const relayed = await relayThroughOpenBackendTab(backend, path, init);
      if (relayed) return relayed;
    } catch (error) {
      relayError = error;
    }
  }

  try {
    const direct = await fetch(`${backend}${path}`, { credentials: "include", ...init });
    if (!shouldRetryInsideWebsite(direct)) return direct;
    try {
      return await relayThroughOpenBackendTab(backend, path, init) ?? direct;
    } catch (error) {
      relayError = error;
      return direct;
    }
  } catch {
    try {
      const relayed = await relayThroughOpenBackendTab(backend, path, init);
      if (relayed) return relayed;
    } catch (error) {
      relayError = error;
    }
    const detail = relayError instanceof Error ? ` ${relayError.message}` : "";
    throw new Error(`Cannot reach THREAD at ${backend}.${detail} Open that deployment in Brave, sign in, and try again.`);
  }
}

export async function readThreadJson<T extends Record<string, unknown>>(response: Response): Promise<T> {
  const text = await response.text();
  if (!text.trim()) return {} as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    const summary = text.replace(/\s+/g, " ").trim().slice(0, 140);
    if (response.status === 403 || /^forbidden\b/i.test(summary)) {
      throw new Error("This deployment blocked a cross-origin extension request. Keep the matching THREAD website open and signed in, then try again.");
    }
    if (response.status === 404) {
      throw new Error("This THREAD deployment is outdated or missing the requested API route. Deploy the current website build, then reconnect it.");
    }
    throw new Error(`THREAD returned ${response.status || "an invalid response"}: ${summary || "empty response"}`);
  }
}

export async function getThreadProjects(requestedBackend?: string) {
  const backend = requestedBackend ? normalizeBackendUrl(requestedBackend) : await getBackendUrl();
  const response = await fetchThread(backend, "/api/projects");
  const body = await readThreadJson<{ projects?: ExtensionProject[]; activeProjectId?: string | null; error?: string }>(response);
  if (response.status === 401) throw new Error("Open this THREAD deployment in Brave, sign in, then reconnect it.");
  if (!response.ok) throw new Error(body.error ?? `THREAD returned ${response.status}.`);
  return { backend, projects: body.projects ?? [], activeProjectId: body.activeProjectId ?? null };
}

async function resolveProjectId(backend: string, requestedProjectId?: string) {
  const stored = await chrome.storage.sync.get("projectId");
  const selected = requestedProjectId || String(stored.projectId || "");
  const response = await fetchThread(backend, "/api/projects");
  const body = await readThreadJson<{ projects?: Array<{ id: string }>; error?: string }>(response);
  if (response.status === 401) throw new Error("Open this THREAD deployment in Brave, sign in, then select the text again.");
  if (!response.ok) throw new Error(body.error ?? `THREAD returned ${response.status}.`);
  const projects = body.projects ?? [];
  const projectId = projects.some((project) => project.id === selected) ? selected : projects[0]?.id ?? "";
  if (!projectId) throw new Error("Create a research project in THREAD before capturing evidence.");
  await chrome.storage.sync.set({ projectId });
  return projectId;
}

export async function callThread(action: ExtensionAction, context: SelectionContext, requestedProjectId?: string) {
  const backend = await getBackendUrl();
  const projectId = await resolveProjectId(backend, requestedProjectId);
  const payload = action === "verify"
    ? { projectId, claim: context.selectedText }
    : createEvidencePayload(context, projectId);
  const response = await fetchThread(backend, actionEndpoint(action), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const body = await readThreadJson<ThreadErrorBody & Record<string, unknown>>(response);
  if (response.status === 401) throw new Error("Open this THREAD deployment in Brave, sign in, then try again.");
  if (!response.ok) throw new Error(body.error ?? `THREAD returned ${response.status}.`);
  return body;
}
