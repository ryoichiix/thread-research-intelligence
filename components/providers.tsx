"use client";

import { forwardRef, type ComponentProps } from "react";
import NextLink from "next/link";
import { LinkProvider } from "@astryxdesign/core/Link";
import { Theme } from "@astryxdesign/core/theme";
import { threadStudioTheme } from "@/lib/thread-studio";

const ClientLink = forwardRef<
  HTMLAnchorElement,
  ComponentProps<typeof NextLink> & { to?: string }
>(function ClientLink({ to: _to, prefetch: _prefetch, ...props }, ref) {
  return <NextLink {...props} ref={ref} prefetch={false} />;
});

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <Theme theme={threadStudioTheme} mode="light">
      <LinkProvider component={ClientLink}>{children}</LinkProvider>
    </Theme>
  );
}
