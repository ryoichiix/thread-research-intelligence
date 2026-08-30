import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import "@astryxdesign/core/reset.css";
import "@astryxdesign/core/astryx.css";
import "@astryxdesign/theme-neutral/theme.css";
import "./extension.css";
import { Badge } from "@astryxdesign/core/Badge";
import { Button } from "@astryxdesign/core/Button";
import { Card } from "@astryxdesign/core/Card";
import { Heading } from "@astryxdesign/core/Heading";
import { HStack, VStack } from "@astryxdesign/core/Stack";
import { StatusDot } from "@astryxdesign/core/StatusDot";
import { Text } from "@astryxdesign/core/Text";
import { Theme } from "@astryxdesign/core/theme";
import { neutralTheme } from "@astryxdesign/theme-neutral/built";
import { sendExtensionMessage, type ExtensionAction, type ExtensionState } from "./shared";
import { getBackendUrl } from "./api";

const initialState: ExtensionState = { status: "idle", message: "Select a passage, then click the small Thread button to analyze and save it.", updatedAt: new Date().toISOString() };

function Logo() { return <svg className="extension-brand" viewBox="0 0 40 40" aria-hidden="true"><path d="M8 7h24M8 13h14M18 13v20M12 33h20" /><circle cx="8" cy="7" r="2" /><circle cx="32" cy="7" r="2" /></svg>; }

function SidePanel() {
  const [state, setState] = useState<ExtensionState>(initialState);
  const [sending, setSending] = useState<ExtensionAction | null>(null);
  useEffect(() => {
    chrome.storage.session.get("threadState").then((result) => result.threadState && setState(result.threadState as ExtensionState));
    const listener = (changes: Record<string, chrome.storage.StorageChange>, area: string) => { if (area === "session" && changes.threadState?.newValue) setState(changes.threadState.newValue as ExtensionState); };
    chrome.storage.onChanged.addListener(listener);
    return () => chrome.storage.onChanged.removeListener(listener);
  }, []);
  const run = async (action: ExtensionAction) => {
    setSending(action);
    try {
      const response = await sendExtensionMessage<{ ok?: boolean; error?: string }>({ type: "RUN_THREAD_ACTION", action });
      if (!response?.ok) setState({ status: "error", message: response?.error ?? "THREAD action failed.", updatedAt: new Date().toISOString() });
    } catch {
      setState({ status: "error", message: "Extension connection changed. Reload the page once, then select the text again.", updatedAt: new Date().toISOString() });
    }
    setSending(null);
  };
  const result = state.result ?? {};
  const counts = result.counts as { supporting?: number; contradicting?: number; inconclusive?: number } | undefined;
  const analysis = result.analysis as { extractedClaim?: string; summary?: string } | undefined;
  const captured = result.evidence as { extractedClaim?: string } | undefined;
  const openApp = async (path: string) => { const backend = await getBackendUrl(); await chrome.tabs.create({ url: `${backend}${path}` }); };
  return (
    <section className="extension-root"><VStack gap={5}>
      <header className="extension-header"><HStack justify="between" align="center"><HStack gap={2} align="center"><Logo /><VStack gap={0}><Heading level={1}>THREAD</Heading><Text type="supporting" color="secondary">Research companion</Text></VStack></HStack><Badge label="CONNECTED" variant="green" /></HStack></header>
      <Card className={`extension-status-${state.status}`} padding={4}><VStack gap={2}><HStack gap={2} align="center"><StatusDot variant={state.status === "error" ? "error" : state.status === "warning" ? "warning" : state.status === "loading" ? "accent" : "success"} label={state.status} isPulsing={state.status === "loading"} /><Text weight="semibold">{state.message}</Text></HStack>{state.selection ? <Text type="supporting" color="secondary">{state.selection.hostname} · {state.selection.pageTitle}</Text> : null}</VStack></Card>
      {state.selection ? <blockquote className="extension-selection">“{state.selection.selectedText}”</blockquote> : null}
      {captured?.extractedClaim || analysis?.extractedClaim ? <Card padding={4}><VStack gap={2}><Text type="supporting" color="secondary">KEY CLAIM</Text><Text weight="semibold">{captured?.extractedClaim || analysis?.extractedClaim}</Text>{analysis?.summary ? <Text color="secondary">{analysis.summary}</Text> : null}</VStack></Card> : null}
      {counts ? <section className="extension-metric-grid"><Card padding={3}><VStack gap={1}><Heading level={2}>{counts.supporting ?? 0}</Heading><Text type="supporting">Supporting</Text></VStack></Card><Card padding={3} variant="red"><VStack gap={1}><Heading level={2}>{counts.contradicting ?? 0}</Heading><Text type="supporting">Conflicting</Text></VStack></Card><Card padding={3}><VStack gap={1}><Heading level={2}>{counts.inconclusive ?? 0}</Heading><Text type="supporting">Inconclusive</Text></VStack></Card></section> : null}
      <VStack gap={2}><Button label="Save selected evidence" isLoading={sending === "save"} onClick={() => run("save")} variant="primary" width="100%" /><HStack gap={2}><Button label="Explain selection" isLoading={sending === "explain"} onClick={() => run("explain")} width="100%" /><Button label="Verify selection" isLoading={sending === "verify"} onClick={() => run("verify")} width="100%" /></HStack></VStack>
      <footer className="extension-footer"><HStack gap={2}><Button label="View evidence" onClick={() => openApp("/research")} variant="ghost" width="100%" /><Button label="Open research" onClick={() => openApp("/dashboard")} variant="ghost" width="100%" /></HStack></footer>
    </VStack></section>
  );
}

createRoot(document.getElementById("root")!).render(<React.StrictMode><Theme theme={neutralTheme} mode="light"><SidePanel /></Theme></React.StrictMode>);
