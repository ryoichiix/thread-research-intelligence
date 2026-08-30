import type { Metadata } from "next";
import { SettingsClient } from "@/components/settings-client";
import { getResearchWorkspace } from "@/lib/current-research";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const { projects, activeProjectId } = await getResearchWorkspace();
  const activeProject = projects.find((project) => project.id === activeProjectId) ?? null;
  const backendUrl = process.env.NEXT_PUBLIC_APP_URL ?? "This THREAD deployment";
  return <section className="page-frame"><SettingsClient project={activeProject} backendUrl={backendUrl} /></section>;
}
