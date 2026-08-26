import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { extname, join, relative } from "node:path";
import process from "node:process";

const projectRoot = process.cwd();
const distRoot = join(projectRoot, "dist");
const serverRoot = join(distRoot, "server");
const serverEntry = join(serverRoot, "index.js");

const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".webmanifest": "application/manifest+json",
};

async function collectFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (fullPath.startsWith(serverRoot)) continue;

    if (entry.isDirectory()) {
      files.push(...(await collectFiles(fullPath)));
      continue;
    }

    files.push(fullPath);
  }

  return files;
}

const files = await collectFiles(distRoot);
const assets = {};

for (const file of files) {
  const path = `/${relative(distRoot, file).split("/").join("/")}`;
  const body = await readFile(file, "base64");
  assets[path] = {
    body,
    type: contentTypes[extname(file)] ?? "application/octet-stream",
  };
}

await mkdir(serverRoot, { recursive: true });
await writeFile(
  serverEntry,
  `const assets = ${JSON.stringify(assets)};\n\n` +
    `function normalizePath(url) {\n` +
    `  const path = new URL(url).pathname;\n` +
    `  return path === "/" ? "/index.html" : path;\n` +
    `}\n\n` +
    `function responseFor(asset) {\n` +
    `  return new Response(Uint8Array.from(atob(asset.body), (char) => char.charCodeAt(0)), {\n` +
    `    headers: { "content-type": asset.type, "cache-control": "public, max-age=300" },\n` +
    `  });\n` +
    `}\n\n` +
    `export default {\n` +
    `  fetch(request) {\n` +
    `    const asset = assets[normalizePath(request.url)] ?? assets["/index.html"];\n` +
    `    return responseFor(asset);\n` +
    `  },\n` +
    `};\n`,
);
