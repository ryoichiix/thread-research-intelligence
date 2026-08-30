import type { Metadata } from "next";
import "@astryxdesign/core/reset.css";
import "@astryxdesign/core/astryx.css";
import "@/lib/thread-studio.css";
import "@xyflow/react/dist/style.css";
import "./globals.css";
import { Providers } from "@/components/providers";

export const metadata: Metadata = {
  title: {
    default: "THREAD — Research intelligence",
    template: "%s · THREAD",
  },
  description:
    "Turn scattered sources into a living evidence graph that connects claims, exposes contradictions, and reveals what to investigate next.",
  other: {
    "thread-extension-backend": "self",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" data-theme="light">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
