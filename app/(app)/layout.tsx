import { redirect } from "next/navigation";
import { ThreadShell } from "@/components/thread-shell";
import { getResearchWorkspace } from "@/lib/current-research";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { context, projects, activeProjectId } = await getResearchWorkspace();
  if (!context.userId) redirect("/login");
  return <ThreadShell email={context.email} projects={projects} activeProjectId={activeProjectId}>{children}</ThreadShell>;
}
