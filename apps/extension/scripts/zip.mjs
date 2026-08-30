import archiver from "archiver";
import { createWriteStream } from "node:fs";
import { copyFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outputPath = resolve(root, "thread-extension.zip");
const output = createWriteStream(outputPath);
const archive = archiver("zip", { zlib: { level: 9 } });

const finished = new Promise((resolveFinished, reject) => {
  output.on("close", resolveFinished);
  archive.on("error", reject);
});
archive.pipe(output);
archive.directory(resolve(root, "dist"), false);
await archive.finalize();
await finished;
const publicDirectory = resolve(root, "..", "..", "public");
await mkdir(publicDirectory, { recursive: true });
await copyFile(outputPath, resolve(publicDirectory, "thread-extension.zip"));
console.log(`THREAD extension zipped at ${outputPath}`);
