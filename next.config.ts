import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  typedRoutes: false,
  turbopack: { root: process.cwd() },
  serverExternalPackages: ["pdfkit"],
  transpilePackages: ["@astryxdesign/core", "@astryxdesign/theme-neutral"],
};

export default nextConfig;
