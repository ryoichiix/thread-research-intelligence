"use client";

import { useState, useSyncExternalStore } from "react";
import { AlertDialog } from "@astryxdesign/core/AlertDialog";
import { Badge } from "@astryxdesign/core/Badge";
import { Button } from "@astryxdesign/core/Button";
import { Card } from "@astryxdesign/core/Card";
import { Heading } from "@astryxdesign/core/Heading";
import { HStack, VStack } from "@astryxdesign/core/Stack";
import { Switch } from "@astryxdesign/core/Switch";
import { Text } from "@astryxdesign/core/Text";
import { CheckCircle2, PanelRightOpen, Settings, Trash2 } from "lucide-react";
import type { Project } from "@thread/shared";

const defaultSettings = { semanticSearch: true, storeContext: true, autoInsights: true };
const settingsEvent = "thread-settings-change";
const subscribe = (callback: () => void) => {
  window.addEventListener("storage", callback);
  window.addEventListener(settingsEvent, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(settingsEvent, callback);
  };
};
const getSettingsSnapshot = () => window.localStorage.getItem("thread-settings") ?? JSON.stringify(defaultSettings);
const getServerSettingsSnapshot = () => JSON.stringify(defaultSettings);

export function SettingsClient({ project, backendUrl }: { project: Project | null; backendUrl: string }) {
  const settings = JSON.parse(useSyncExternalStore(subscribe, getSettingsSnapshot, getServerSettingsSnapshot)) as typeof defaultSettings;
  const [saved, setSaved] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const update = (key: keyof typeof settings, value: boolean) => {
    setSaved(false);
    window.localStorage.setItem("thread-settings", JSON.stringify({ ...settings, [key]: value }));
    window.dispatchEvent(new Event(settingsEvent));
  };
  const save = () => setSaved(true);
  const deleteProject = async () => {
    if (!project) return;
    setDeleting(true);
    setDeleteError("");
    try {
      const response = await fetch(`/api/projects/${project.id}`, { method: "DELETE" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "The project could not be deleted.");
      setDeleteOpen(false);
      window.location.assign(payload.nextProjectId ? "/dashboard" : "/onboarding");
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : "The project could not be deleted.");
    } finally {
      setDeleting(false);
    }
  };
  return (
    <VStack gap={8}>
      <header className="page-header"><VStack gap={4}><HStack gap={2} align="center"><Settings /><Text type="supporting" color="secondary" className="page-eyebrow">SETTINGS</Text></HStack><Heading level={1} type="display-3">Research system configuration.</Heading><Text className="page-question">Provider choices stay server-side. The extension receives only a backend URL and authenticated session.</Text></VStack></header>
      <section className="settings-grid">
        <VStack gap={3}>
          <Button label="Providers" href="#providers" variant="ghost" width="100%" />
          <Button label="Extension" href="#extension" variant="ghost" width="100%" />
          <Button label="Data preferences" href="#data" variant="ghost" width="100%" />
          {project ? <Button label="Delete project" href="#danger" variant="ghost" width="100%" /> : null}
        </VStack>
        <VStack gap={6}>
          {saved ? <section className="status-banner is-success"><HStack gap={2} align="center"><CheckCircle2 /><Text weight="semibold">Settings saved locally</Text></HStack></section> : null}
          <Card id="providers" padding={5}><VStack gap={5}><VStack gap={1}><Heading level={2}>AI and search providers</Heading><Text color="secondary">Secrets are read only in server routes.</Text></VStack><label className="field-label">AI provider<select className="native-select" defaultValue="openai"><option value="openai">OpenAI Responses API</option><option value="deterministic">Deterministic grounded fallback</option></select></label><label className="field-label">Search provider<select className="native-select" defaultValue="tavily"><option value="tavily">Tavily Search API</option><option value="none">No live search</option></select></label></VStack></Card>
          <Card id="extension" padding={5}><VStack gap={4}><HStack justify="between" align="center"><VStack gap={1}><Heading level={2}>Browser extension connection</Heading><Text color="secondary">Manifest V3 · automatic backend discovery · authenticated project sync</Text></VStack><Badge label="READY" variant="success" /></HStack><Card variant="muted" padding={4}><VStack gap={2}><HStack gap={2} align="center"><PanelRightOpen /><Text weight="semibold">Current website</Text></HStack><Text type="code">{backendUrl}</Text><Text type="supporting" color="secondary">Opening this website teaches the extension which backend to use.</Text></VStack></Card><Button label="Download browser extension" href="/thread-extension.zip" variant="primary" /></VStack></Card>
          <Card id="data" padding={5}><VStack gap={4}><Heading level={2}>Data preferences</Heading><Switch label="Semantic search" description="Use pgvector embeddings when configured." value={settings.semanticSearch} onChange={(value) => update("semanticSearch", value)} labelSpacing="spread" width="100%" /><Switch label="Store surrounding context" description="Keeps capture context for more defensible analysis." value={settings.storeContext} onChange={(value) => update("storeContext", value)} labelSpacing="spread" width="100%" /><Switch label="Generate insights after capture" description="Queues provenance validation when new evidence arrives." value={settings.autoInsights} onChange={(value) => update("autoInsights", value)} labelSpacing="spread" width="100%" /></VStack></Card>
          <Button label="Save settings" variant="primary" onClick={save} width="100%" />
          {project ? (
            <Card id="danger" padding={5} className="danger-zone">
              <VStack gap={4}>
                <VStack gap={1}>
                  <Text type="supporting" color="secondary" className="page-eyebrow">DESTRUCTIVE ACTION</Text>
                  <Heading level={2}>Delete “{project.title}”</Heading>
                  <Text color="secondary">Permanently removes this project, its sources, captured evidence, claims, graph relationships, conflicts, gaps, tasks, insights, and timeline.</Text>
                </VStack>
                {deleteError ? <section className="status-banner is-warning"><Text>{deleteError}</Text></section> : null}
                <Button label="Delete this project" variant="destructive" icon={<Trash2 />} onClick={() => setDeleteOpen(true)} />
              </VStack>
            </Card>
          ) : null}
        </VStack>
      </section>
      {project ? (
        <AlertDialog
          isOpen={deleteOpen}
          onOpenChange={setDeleteOpen}
          title={`Delete ${project.title}?`}
          description="This permanently deletes the complete research project and every record inside it. This action cannot be undone."
          actionLabel="Delete project"
          onAction={deleteProject}
          isActionLoading={deleting}
        />
      ) : null}
    </VStack>
  );
}
