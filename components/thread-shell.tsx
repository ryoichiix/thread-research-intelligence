"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AppShell } from "@astryxdesign/core/AppShell";
import { Button } from "@astryxdesign/core/Button";
import { IconButton } from "@astryxdesign/core/IconButton";
import { Kbd } from "@astryxdesign/core/Kbd";
import { HStack, VStack } from "@astryxdesign/core/Stack";
import { Text } from "@astryxdesign/core/Text";
import { DropdownMenu } from "@astryxdesign/core/DropdownMenu";
import { SideNav, SideNavHeading, SideNavItem, SideNavSection } from "@astryxdesign/core/SideNav";
import { TopNav } from "@astryxdesign/core/TopNav";
import {
  Activity,
  BookOpen,
  Compass,
  GitFork,
  LayoutDashboard,
  Search,
  Settings,
  Library,
  LogOut,
  Target,
} from "lucide-react";
import { BrandMark } from "@/components/brand-mark";
import { ThreadCommandPalette } from "@/components/command-palette";
import { EVIDENCE_SECTION_HREF, EVIDENCE_ROUTES } from "@/components/evidence-tabs";
import type { Project } from "@thread/shared";

/*
 * Evidence collapses the old Evidence map / Contradictions / Knowledge gaps entries into one
 * destination; the three lenses are tabs inside it (see components/evidence-tabs.tsx), so
 * `matches` keeps the sidebar entry lit on any of their routes.
 */
const navigation: Array<{ title: string; items: Array<{ href: string; label: string; icon: typeof LayoutDashboard; matches?: string[] }> }> = [
  {
    title: "Workspace",
    items: [
      { href: "/dashboard", label: "Research brief", icon: LayoutDashboard },
      { href: EVIDENCE_SECTION_HREF, label: "Evidence", icon: GitFork, matches: EVIDENCE_ROUTES },
    ],
  },
  {
    title: "Output",
    items: [
      { href: "/next", label: "Next moves", icon: Compass },
      { href: "/research", label: "Research library", icon: BookOpen },
      { href: "/timeline", label: "Activity log", icon: Activity },
    ],
  },
];

export function ThreadShell({ children, email, projects, activeProjectId }: { children: React.ReactNode; email: string | null; projects: Project[]; activeProjectId: string | null }) {
  const pathname = usePathname();
  const router = useRouter();
  const [switchingProject, setSwitchingProject] = useState(false);
  const [isPaletteOpen, setIsPaletteOpen] = useState(false);
  const [shellError, setShellError] = useState("");
  const activeProject = projects.find((project) => project.id === activeProjectId);

  /*
   * Evidence is captured by the browser extension while the user is on another site entirely,
   * so an already-open THREAD tab holds a stale Server Component payload with no way to learn
   * that new rows exist. Revalidate whenever the tab is looked at again. Both listeners are
   * needed: visibilitychange covers tab switches, focus covers window switches within the same
   * visible tab. They fire together on a normal tab switch, so a trailing debounce collapses the
   * pair (and any alt-tab drumming) into a single refresh.
   */
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const requestRefresh = () => {
      if (document.visibilityState !== "visible") return;
      clearTimeout(timer);
      timer = setTimeout(() => router.refresh(), 400);
    };
    window.addEventListener("focus", requestRefresh);
    document.addEventListener("visibilitychange", requestRefresh);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("focus", requestRefresh);
      document.removeEventListener("visibilitychange", requestRefresh);
    };
  }, [router]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      document.querySelector<HTMLElement>("#astryx-app-shell-main")?.scrollTo({ top: 0 });
      document.querySelectorAll<HTMLElement>(".thread-main .astryx-layout-content, .thread-main .astryx-layout-panel")
        .forEach((region) => region.scrollTo({ top: 0 }));
    });
    return () => window.cancelAnimationFrame(frame);
  }, [pathname]);
  const changeProject = async (projectId: string) => {
    if (!projectId || projectId === activeProjectId) return;
    setSwitchingProject(true);
    setShellError("");
    try {
      const response = await fetch("/api/projects/active", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId }),
      });
      if (!response.ok) throw new Error("Could not switch research projects.");
      router.refresh();
    } catch (error) {
      setShellError(error instanceof Error ? error.message : "Could not switch research projects.");
    } finally {
      setSwitchingProject(false);
    }
  };
  const logout = async () => {
    setShellError("");
    try {
      const response = await fetch("/api/auth/logout", { method: "POST" });
      if (!response.ok) throw new Error("Could not sign out. Please try again.");
      window.location.assign("/login");
    } catch (error) {
      setShellError(error instanceof Error ? error.message : "Could not sign out. Please try again.");
    }
  };
  const sideNav = (
    <SideNav
      header={
        /*
         * Wordmark only. The project name lives in the top-bar switcher a few pixels away, so
         * repeating it here duplicated the one piece of state on screen and truncated badly.
         * The "RESEARCH INTELLIGENCE" superheading went with it: it is landing-page positioning
         * copy that carries no in-app meaning, and a three-line brand block for a one-word
         * product crowded the nav it sits above.
         */
        <SideNavHeading
          icon={<BrandMark compact />}
          heading="THREAD"
          headingHref="/dashboard"
        />
      }
      footerIcons={
        <>
          <IconButton label="Open settings" tooltip="Settings" variant="ghost" icon={<Settings />} onClick={() => router.push("/settings")} />
          {email ? <IconButton label={`Sign out ${email}`} tooltip="Sign out" variant="ghost" icon={<LogOut />} onClick={logout} /> : null}
        </>
      }
      collapsible={{ defaultIsCollapsed: false, buttonLabel: "Collapse research tools" }}
    >
      {navigation.map((group) => (
        <SideNavSection title={group.title} key={group.title}>
          {group.items.map((item) => {
            const Icon = item.icon;
            const selected = (item.matches ?? [item.href]).some((href) => pathname === href || pathname.startsWith(`${href}/`));
            return (
              <SideNavItem
                key={item.href}
                href={item.href}
                label={item.label}
                icon={<Icon />}
                selectedIcon={<Icon />}
                isSelected={selected}
                size="sm"
              />
            );
          })}
        </SideNavSection>
      ))}
    </SideNav>
  );

  const topNav = (
    <TopNav
      label="Research workspace controls"
      heading={
        <HStack gap={2} align="center" className="mobile-brand">
          <BrandMark compact />
          <Text weight="semibold">THREAD</Text>
        </HStack>
      }
      startContent={
        <VStack gap={1} className="workspace-context">
          {projects.length ? (
            /*
             * Icon + chevron only. The project name is the page's H1 a few pixels below, so
             * spelling it out here duplicated the largest text on screen. The name still reaches
             * assistive tech through the trigger's accessible label.
             */
            <DropdownMenu
              button={{
                label: `Switch research paper — current: ${activeProject?.title ?? "none"}`,
                icon: <Library />,
                isIconOnly: true,
                variant: "ghost",
                size: "sm",
                isLoading: switchingProject,
              }}
              items={projects.map((project) => ({
                id: project.id,
                label: project.title,
                description: project.researchQuestion,
                onClick: () => changeProject(project.id),
              }))}
              menuWidth={320}
              alignment="start"
            />
          ) : <Text weight="semibold" maxLines={1}>{activeProject?.title ?? "Create your first research project"}</Text>}
          {shellError ? <Text type="supporting" color="secondary" className="workspace-error">{shellError}</Text> : null}
        </VStack>
      }
      endContent={
        // gap={6} = --spacing-6 (24px). At 12px the search trigger, the account line, and the
        // primary action ran together as one undifferentiated cluster.
        <HStack gap={6} align="center">
          <Button
            className="top-search-action"
            label="Search"
            variant="secondary"
            size="sm"
            icon={<Search />}
            onClick={() => setIsPaletteOpen(true)}
            endContent={<Kbd keys="mod+K" />}
          />
          {email ? <Text type="supporting" color="secondary" className="workspace-account">{email}</Text> : null}
          <Button className="top-new-action" label="New paper" href="/onboarding" variant="primary" size="sm" icon={<Target />} />
        </HStack>
      }
    />
  );

  return (
    <AppShell topNav={topNav} sideNav={sideNav} height="fill" variant="section" contentPadding={0} mobileNav={{ breakpoint: "md" }}>
      <section className="thread-main">{children}</section>
      <ThreadCommandPalette
        isOpen={isPaletteOpen}
        onOpenChange={setIsPaletteOpen}
        projects={projects}
        activeProjectId={activeProjectId}
        onSelectProject={changeProject}
      />
    </AppShell>
  );
}
