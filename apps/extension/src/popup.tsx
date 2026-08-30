import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import "@astryxdesign/core/reset.css";
import "@astryxdesign/core/astryx.css";
import "../../../lib/thread-studio.css";
import "./extension.css";
import { Badge } from "@astryxdesign/core/Badge";
import { Button } from "@astryxdesign/core/Button";
import { Card } from "@astryxdesign/core/Card";
import { Heading } from "@astryxdesign/core/Heading";
import { HStack, VStack } from "@astryxdesign/core/Stack";
import { StatusDot } from "@astryxdesign/core/StatusDot";
import { Text } from "@astryxdesign/core/Text";
import { Theme } from "@astryxdesign/core/theme";
import { threadStudioTheme } from "../../../lib/thread-studio";
import { getBackendUrl, getThreadProjects } from "./api";
import { normalizeBackendUrl, PRODUCTION_BACKEND_URL } from "./config";

function Logo() { return <svg className="extension-brand" viewBox="0 0 40 40" aria-hidden="true"><path d="M8 7h24M8 13h14M18 13v20M12 33h20" /><circle cx="8" cy="7" r="2" /><circle cx="32" cy="7" r="2" /></svg>; }

function Popup() {
  const [backend, setBackend] = useState(PRODUCTION_BACKEND_URL);
  const [projects, setProjects] = useState<Array<{ id: string; title: string }>>([]);
  const [projectId, setProjectId] = useState("");
  const [connected, setConnected] = useState(false);
  const [message, setMessage] = useState("Connect to choose a research project.");
  useEffect(() => { Promise.all([getBackendUrl(), chrome.storage.sync.get("projectId")]).then(([backendUrl, value]) => { setBackend(backendUrl); setProjectId(String(value.projectId || "")); }); }, []);
  const connect = async () => {
    const clean = normalizeBackendUrl(backend);
    setBackend(clean);
    await chrome.storage.sync.set({ backendUrl: clean });
    try {
      const { projects: available } = await getThreadProjects(clean);
      const selected = available.some((project) => project.id === projectId) ? projectId : available[0]?.id ?? "";
      setProjects(available); setProjectId(selected); setConnected(true);
      await chrome.storage.sync.set({ projectId: selected });
      setMessage(available.length ? "Connected. Choose where evidence is saved." : "Connected. Create a project in THREAD first.");
    } catch (error) { setConnected(false); setMessage(error instanceof Error ? error.message : "Connection failed."); }
  };
  const chooseProject = async (value: string) => { setProjectId(value); await chrome.storage.sync.set({ projectId: value }); };
  const reconnectTab = async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab.id) await chrome.tabs.reload(tab.id);
    window.close();
  };
  const openPanel = async () => { const [tab] = await chrome.tabs.query({ active: true, currentWindow: true }); if (tab.windowId) await chrome.sidePanel.open({ windowId: tab.windowId }); window.close(); };
  return <section className="extension-root"><VStack gap={4}><header className="extension-header"><HStack justify="between" align="center"><HStack gap={2} align="center"><Logo /><Heading level={1}>THREAD</Heading></HStack><Badge label="CLICK TO CAPTURE" variant="green" /></HStack></header><HStack gap={2} align="center"><StatusDot variant={connected ? "success" : "warning"} label={connected ? "Connected" : "Setup needed"} isPulsing={connected} /><Text>{message}</Text></HStack><Card padding={4}><VStack gap={3}><Text type="supporting" color="secondary">THREAD WEBSITE</Text><input className="extension-native-input" value={backend} onChange={(event) => { setConnected(false); setBackend(event.target.value); }} aria-label="THREAD website URL" /><Button label="Connect and load projects" variant="primary" onClick={connect} width="100%" />{projects.length ? <><Text type="supporting" color="secondary">DEFAULT RESEARCH PAPER</Text><select className="extension-native-input" value={projectId} onChange={(event) => chooseProject(event.target.value)} aria-label="Research project">{projects.map((project) => <option key={project.id} value={project.id}>{project.title}</option>)}</select></> : null}</VStack></Card><HStack gap={2}><Button label="Open THREAD" onClick={() => chrome.tabs.create({ url: `${normalizeBackendUrl(backend)}/dashboard` })} width="100%" /><Button label="Reconnect tab" onClick={reconnectTab} width="100%" /></HStack><Button label="Open side panel" onClick={openPanel} width="100%" /><Text type="supporting" color="secondary">THREAD now learns the backend from any compatible deployment you open. After updating, reconnect the current tab once.</Text></VStack></section>;
}

createRoot(document.getElementById("root")!).render(<React.StrictMode><Theme theme={threadStudioTheme} mode="light"><Popup /></Theme></React.StrictMode>);
