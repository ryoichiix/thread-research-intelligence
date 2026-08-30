"use client";

import { usePathname, useRouter } from "next/navigation";
import { Tab, TabList } from "@astryxdesign/core/TabList";

/*
 * The evidence map, the contradiction desk, and the knowledge gaps are three lenses on one
 * claim graph, so they read as tabs inside a single Evidence destination rather than three
 * sidebar entries. They stay real routes — every existing deep link and in-app href keeps
 * working, and each lens still server-renders only the dataset slice it needs.
 */
export const EVIDENCE_VIEWS = [
  { value: "graph", href: "/graph", label: "Evidence map" },
  { value: "conflicts", href: "/conflicts", label: "Contradictions" },
  { value: "gaps", href: "/gaps", label: "Knowledge gaps" },
] as const;

export const EVIDENCE_SECTION_HREF = EVIDENCE_VIEWS[0].href;
export const EVIDENCE_ROUTES: string[] = EVIDENCE_VIEWS.map((view) => view.href);

export function isEvidenceRoute(pathname: string) {
  return EVIDENCE_ROUTES.some((href) => pathname === href || pathname.startsWith(`${href}/`));
}

export function EvidenceTabs() {
  const pathname = usePathname();
  const router = useRouter();
  const active = EVIDENCE_VIEWS.find((view) => pathname === view.href || pathname.startsWith(`${view.href}/`))?.value ?? EVIDENCE_VIEWS[0].value;

  return (
    <nav className="section-tabs" aria-label="Evidence views">
      <TabList
        value={active}
        size="sm"
        hasDivider
        onChange={(value) => {
          /*
           * Each Tab carries an href, so pointer and keyboard activation navigate as real
           * links. This only covers activation paths that do not follow the anchor.
           */
          const view = EVIDENCE_VIEWS.find((item) => item.value === value);
          if (view && view.href !== pathname) router.push(view.href);
        }}
      >
        {EVIDENCE_VIEWS.map((view) => (
          <Tab key={view.value} value={view.value} label={view.label} href={view.href} />
        ))}
      </TabList>
    </nav>
  );
}
