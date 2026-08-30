"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AppShell } from "@astryxdesign/core/AppShell";
import { Button } from "@astryxdesign/core/Button";
import { IconButton } from "@astryxdesign/core/IconButton";
import { HStack, VStack } from "@astryxdesign/core/Stack";
import { Text } from "@astryxdesign/core/Text";
import { Selector } from "@astryxdesign/core/Selector";
import { SideNav, SideNavHeading, SideNavItem, SideNavSection } from "@astryxdesign/core/SideNav";
import { TopNav } from "@astryxdesign/core/TopNav";
import {
  Activity,
  BookOpen,
  CircleHelp,
  Compass,
  GitFork,
  LayoutDashboard,
  Settings,
  ShieldAlert,
  LogOut,
  Target,
} from "lucide-react";
import { BrandMark } from "@/components/brand-mark";
import type { Project } from "@thread/shared";

const navigation = [
  {
    title: "Workspace",
    items: [
      { href: "/dashboard", label: "Research brief", icon: LayoutDashboard },
      { href: "/graph", label: "Evidence map", icon: GitFork },
      { href: "/conflicts", label: "Contradictions", icon: ShieldAlert },
      { href: "/gaps", label: "Knowledge gaps", icon: CircleHelp },
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
        <SideNavHeading
          icon={<BrandMark compact />}
          superheading="RESEARCH INTELLIGENCE"
          heading="THREAD"
          subheading={activeProject?.title ?? "Research desk"}
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
            const selected = pathname === item.href || pathname.startsWith(`${item.href}/`);
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
            <Selector
              label="Active research paper"
              isLabelHidden
              value={activeProjectId ?? ""}
              onChange={changeProject}
              options={projects.map((project) => ({ value: project.id, label: project.title, description: project.researchQuestion }))}
              hasSearch={projects.length > 5}
              isLoading={switchingProject}
              width="100%"
            />
          ) : <Text weight="semibold" maxLines={1}>{activeProject?.title ?? "Create your first research project"}</Text>}
          {shellError ? <Text type="supporting" color="secondary" className="workspace-error">{shellError}</Text> : null}
        </VStack>
      }
      endContent={
        <HStack gap={3} align="center">
          {email ? <Text type="supporting" color="secondary" className="workspace-account">{email}</Text> : null}
          <Button className="top-new-action" label="New paper" href="/onboarding" variant="primary" size="sm" icon={<Target />} />
        </HStack>
      }
    />
  );

  return (
    <AppShell topNav={topNav} sideNav={sideNav} height="fill" variant="section" contentPadding={0} mobileNav={{ breakpoint: "md" }}>
      <section className="thread-main">{children}</section>
    </AppShell>
  );
}
