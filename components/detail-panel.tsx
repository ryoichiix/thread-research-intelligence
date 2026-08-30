"use client";

import { useEffect, useId, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { Badge } from "@astryxdesign/core/Badge";
import { Button } from "@astryxdesign/core/Button";
import { Heading } from "@astryxdesign/core/Heading";
import { HStack, VStack } from "@astryxdesign/core/Stack";
import { Tab, TabList } from "@astryxdesign/core/TabList";
import { Text } from "@astryxdesign/core/Text";
import { X } from "lucide-react";

/*
 * Scroll lock is reference-counted so overlapping panels cannot restore scrolling early.
 * Both the document body and the AppShell scroll region are locked: AppShell height="fill"
 * moves the scrollport onto #astryx-app-shell-main, so locking the body alone does nothing.
 */
let openPanels = 0;
const previousOverflow = new Map<HTMLElement, string>();

function scrollLockTargets(): HTMLElement[] {
  const shellMain = document.querySelector<HTMLElement>("#astryx-app-shell-main");
  return shellMain ? [document.body, shellMain] : [document.body];
}

function lockScroll() {
  openPanels += 1;
  if (openPanels > 1) return;
  for (const target of scrollLockTargets()) {
    previousOverflow.set(target, target.style.overflow);
    target.style.overflow = "hidden";
  }
}

function unlockScroll() {
  openPanels = Math.max(0, openPanels - 1);
  if (openPanels > 0) return;
  for (const [target, overflow] of previousOverflow) target.style.overflow = overflow;
  previousOverflow.clear();
}

/* Portals need document, which does not exist during the server render pass. */
const subscribeNoop = () => () => {};
const getClientSnapshot = () => true;
const getServerSnapshot = () => false;

export interface DetailPanelTab {
  value: string;
  label: string;
  /** Optional count shown on the tab, so the weight of each section reads before opening it. */
  badge?: string;
  content: React.ReactNode;
}

export function DetailPanel({
  title,
  eyebrow,
  meta,
  summary,
  tabs,
  footer,
  size = "md",
  onClose,
  children,
}: {
  title: string;
  /** Short kicker above the title, e.g. the kind of record being inspected. */
  eyebrow?: string;
  /** Badges and other at-a-glance metadata pinned into the header. */
  meta?: React.ReactNode;
  /** The answer or decision, held above the fold and never scrolled away. */
  summary?: React.ReactNode;
  /** Supporting detail behind tabs instead of stacked below the summary. */
  tabs?: DetailPanelTab[];
  /** Primary action pinned to the bottom edge so it survives a long body. */
  footer?: React.ReactNode;
  size?: "md" | "lg";
  onClose: () => void;
  children?: React.ReactNode;
}) {
  /*
   * Rendered through a portal to document.body on purpose. Any ancestor with a transform,
   * filter, perspective, contain, or backdrop-filter becomes the containing block for
   * position: fixed descendants, which clips the scrim and panel to that ancestor's box.
   * .page-frame currently does exactly that (studio-enter runs with fill-mode "both", so a
   * resting identity transform survives the animation). Portalling out of the tree makes the
   * overlay immune to that class of bug regardless of what styling lands on wrappers later.
   */
  const isHydrated = useSyncExternalStore(subscribeNoop, getClientSnapshot, getServerSnapshot);
  const panelIdPrefix = useId();
  const [requestedTab, setRequestedTab] = useState("");
  const activeTab = tabs?.some((tab) => tab.value === requestedTab) ? requestedTab : tabs?.[0]?.value ?? "";
  const activeTabContent = tabs?.find((tab) => tab.value === activeTab)?.content;

  useEffect(() => {
    lockScroll();
    return unlockScroll;
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  if (!isHydrated) return null;

  return createPortal(
    <>
      <button className="detail-scrim" type="button" aria-label="Close details" onClick={onClose} />
      <aside className="detail-panel" data-size={size} aria-label={title}>
        <header className="detail-panel-header">
          <VStack gap={2}>
            <HStack justify="between" align="start" gap={3}>
              <VStack gap={1}>
                {eyebrow ? <Text type="supporting" color="secondary" className="detail-panel-eyebrow">{eyebrow}</Text> : null}
                <Heading level={2}>{title}</Heading>
              </VStack>
              <Button label="Close details" icon={<X />} isIconOnly variant="ghost" size="sm" onClick={onClose} />
            </HStack>
            {meta ? <HStack gap={2} align="center" wrap="wrap">{meta}</HStack> : null}
          </VStack>
        </header>

        {summary ? <section className="detail-panel-summary">{summary}</section> : null}

        {tabs?.length ? (
          <nav className="detail-panel-tabs">
            <TabList value={activeTab} onChange={setRequestedTab} size="sm" role="tablist">
              {tabs.map((tab) => (
                <Tab
                  key={tab.value}
                  value={tab.value}
                  label={tab.label}
                  panelId={`${panelIdPrefix}-${tab.value}`}
                  endContent={tab.badge ? <Badge label={tab.badge} /> : undefined}
                />
              ))}
            </TabList>
          </nav>
        ) : null}

        {tabs?.length ? (
          <section className="detail-panel-body" id={`${panelIdPrefix}-${activeTab}`} role="tabpanel" tabIndex={-1}>
            {activeTabContent}
          </section>
        ) : (
          <section className="detail-panel-body">{children}</section>
        )}

        {footer ? <footer className="detail-panel-footer">{footer}</footer> : null}
      </aside>
    </>,
    document.body,
  );
}
