import { build } from "esbuild";
import { cp, mkdir, rm } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dist = resolve(root, "dist");

await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });
await build({
  entryPoints: {
    background: resolve(root, "src/background.ts"),
    content: resolve(root, "src/content.ts"),
    popup: resolve(root, "src/popup.tsx"),
    sidepanel: resolve(root, "src/sidepanel.tsx"),
  },
  bundle: true,
  outdir: dist,
  format: "esm",
  target: "chrome116",
  jsx: "automatic",
  sourcemap: false,
  minify: true,
  legalComments: "none",
});
await Promise.all([
  cp(resolve(root, "manifest.json"), resolve(dist, "manifest.json")),
  cp(resolve(root, "popup.html"), resolve(dist, "popup.html")),
  cp(resolve(root, "sidepanel.html"), resolve(dist, "sidepanel.html")),
]);

console.log(`THREAD extension built at ${dist}`);
