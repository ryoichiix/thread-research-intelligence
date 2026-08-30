"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CommandPalette } from "@astryxdesign/core/CommandPalette";
import { VStack } from "@astryxdesign/core/Stack";
import { Text } from "@astryxdesign/core/Text";
import type { SearchSource, SearchableItem } from "@astryxdesign/core/Typeahead/utils";
import type { Evidence, Project, Source } from "@thread/shared";

type CommandGroup = "Go to" | "Research papers" | "Claims" | "Sources";

interface CommandAux {
  group: CommandGroup;
  detail?: string;
  run: () => void;
}

type CommandItem = SearchableItem<CommandAux>;

const DESTINATIONS: Array<{ href: string; label: string; detail: string }> = [
  { href: "/dashboard", label: "Research brief", detail: "Synthesis, insights, and research health" },
  { href: "/graph", label: "Evidence map", detail: "Claim graph and connectors" },
  { href: "/conflicts", label: "Contradictions", detail: "Findings that genuinely disagree" },
  { href: "/gaps", label: "Knowledge gaps", detail: "Topics without defensible coverage" },
  { href: "/next", label: "Next moves", detail: "Ranked research tasks" },
  { href: "/research", label: "Research library", detail: "Every source, excerpt, and change" },
  { href: "/timeline", label: "Activity log", detail: "How understanding changed" },
  { href: "/settings", label: "Settings", detail: "Workspace and extension configuration" },
  { href: "/onboarding", label: "New research paper", detail: "Start a new project" },
];

function matches(item: CommandItem, query: string) {
  const needle = query.toLowerCase();
  return item.label.toLowerCase().includes(needle) || (item.auxiliaryData?.detail ?? "").toLowerCase().includes(needle);
}

export function ThreadCommandPalette({
  isOpen,
  onOpenChange,
  projects,
  activeProjectId,
  onSelectProject,
}: {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  projects: Project[];
  activeProjectId: string | null;
  onSelectProject: (projectId: string) => void;
}) {
  const router = useRouter();
  const [corpus, setCorpus] = useState<{ sources: Source[]; evidence: Evidence[] }>({ sources: [], evidence: [] });
  /* The active project's corpus is fetched once per project, on first open rather than on mount. */
  const loadedProjectId = useRef<string | null>(null);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== "k" || !(event.metaKey || event.ctrlKey)) return;
      event.preventDefault();
      onOpenChange(!isOpen);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, onOpenChange]);

  useEffect(() => {
    if (!isOpen || !activeProjectId || loadedProjectId.current === activeProjectId) return;
    let cancelled = false;
    loadedProjectId.current = activeProjectId;
    (async () => {
      try {
        const [sourcesResponse, evidenceResponse] = await Promise.all([
          fetch(`/api/projects/${activeProjectId}/sources`),
          fetch(`/api/projects/${activeProjectId}/evidence`),
        ]);
        const sources = sourcesResponse.ok ? (await sourcesResponse.json()).sources ?? [] : [];
        const evidence = evidenceResponse.ok ? (await evidenceResponse.json()).evidence ?? [] : [];
        if (!cancelled) setCorpus({ sources, evidence });
      } catch {
        /* The palette stays useful for navigation and project switching without the corpus. */
        if (!cancelled) loadedProjectId.current = null;
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isOpen, activeProjectId]);

  const close = useCallback(() => onOpenChange(false), [onOpenChange]);

  const items = useMemo<CommandItem[]>(() => {
    const destinations: CommandItem[] = DESTINATIONS.map((destination) => ({
      id: `go:${destination.href}`,
      label: destination.label,
      auxiliaryData: { group: "Go to", detail: destination.detail, run: () => router.push(destination.href) },
    }));

    const projectItems: CommandItem[] = projects.map((project) => ({
      id: `project:${project.id}`,
      label: project.title,
      auxiliaryData: {
        group: "Research papers",
        detail: project.id === activeProjectId ? "Active paper" : project.researchQuestion,
        run: () => {
          if (project.id !== activeProjectId) onSelectProject(project.id);
        },
      },
    }));

    const claimItems: CommandItem[] = corpus.evidence.map((item) => ({
      id: `claim:${item.id}`,
      label: item.extractedClaim || item.selectedText,
      auxiliaryData: {
        group: "Claims",
        detail: item.pageTitle,
        run: () => router.push(`/research?query=${encodeURIComponent(item.extractedClaim || item.selectedText)}`),
      },
    }));

    const sourceItems: CommandItem[] = corpus.sources.map((source) => ({
      id: `source:${source.id}`,
      label: source.title,
      auxiliaryData: {
        group: "Sources",
        detail: source.domain || source.url,
        run: () => router.push(`/research/source/${source.id}`),
      },
    }));

    return [...destinations, ...projectItems, ...claimItems, ...sourceItems];
  }, [router, projects, activeProjectId, corpus, onSelectProject]);

  const searchSource = useMemo<SearchSource<CommandItem>>(() => ({
    /*
     * Hand-rolled rather than createStaticSource: matching has to reach the detail line
     * (a source's hostname, a claim's page title) and the bootstrap list has to stay short
     * enough to scan before anything is typed.
     */
    search: (query: string) => {
      const trimmed = query.trim();
      if (!trimmed) return items.slice(0, 12);
      return items.filter((item) => matches(item, trimmed)).slice(0, 40);
    },
    bootstrap: () => items.filter((item) => item.auxiliaryData?.group === "Go to" || item.auxiliaryData?.group === "Research papers").slice(0, 12),
  }), [items]);

  return (
    <CommandPalette<CommandItem>
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      label="Search THREAD"
      searchSource={searchSource}
      emptySearchText="Nothing in this research paper matches that."
      emptyBootstrapText="Search pages, research papers, claims, and sources."
      onValueChange={(value) => {
        const item = items.find((candidate) => candidate.id === value);
        close();
        item?.auxiliaryData?.run();
      }}
      renderItem={(item) => (
        <VStack gap={0.5}>
          <Text maxLines={1}>{item.label}</Text>
          {item.auxiliaryData?.detail ? <Text type="supporting" color="secondary" maxLines={1}>{item.auxiliaryData.detail}</Text> : null}
        </VStack>
      )}
    />
  );
}
