import { cp, mkdir, readFile, rm } from "node:fs/promises";
import { resolve, sep } from "node:path";

const root = resolve(".");
const distDir = resolve(root, "dist");
const clientDir = resolve(distDir, "client");
const serverDir = resolve(distDir, "server");
const distConfig = resolve(distDir, "config.json");
const outputDir = resolve(root, ".vercel", "output");

if (!outputDir.startsWith(root + sep)) {
  throw new Error(`Refusing to write outside project: ${outputDir}`);
}

const config = JSON.parse(await readFile(distConfig, "utf8"));

await rm(outputDir, { recursive: true, force: true });
await mkdir(resolve(outputDir, "functions"), { recursive: true });

await cp(clientDir, resolve(outputDir, "static"), { recursive: true });
await cp(serverDir, resolve(outputDir, "functions", "__server.func"), { recursive: true });
await mkdir(outputDir, { recursive: true });
await cp(distConfig, resolve(outputDir, "config.json"));

if (config.version !== 3) {
  throw new Error("Unexpected Vercel output config version.");
}

console.log("Prepared .vercel/output for Vercel.");
