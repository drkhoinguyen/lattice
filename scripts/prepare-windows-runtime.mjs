// Windows needs Node for Open Slide, but cannot run the guarded Synara Agent.
// Keep the resource location the host already resolves, with no server stub.
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, renameSync, rmSync } from "node:fs";
import { join } from "node:path";
import { prepareNodeRuntime } from "./lib/node-runtime.mjs";
import { isMain, projectRoot, readJson, writeJson } from "./lib/util.mjs";

export async function prepareWindowsRuntime() {
  // Tauri sets TAURI_ENV_ARCH for the build hook; fall back to the host's.
  const arch = process.env.TAURI_ENV_ARCH ?? (process.arch === "arm64" ? "aarch64" : "x86_64");
  if (process.platform !== "win32" || !["x86_64", "aarch64"].includes(arch)) {
    throw new Error("The experimental Windows package requires Windows x64 or ARM64.");
  }
  const { nodeVersion } = readJson(join(projectRoot, "scripts/synara-runtime.json"));
  const target = `${arch}-pc-windows-msvc`;
  if (arch === "aarch64" && !/^[0-9a-f]{64}$/.test(process.env.LATTICE_NODE_WIN_ARM64_SHA256 ?? "")) {
    throw new Error("Set LATTICE_NODE_WIN_ARM64_SHA256 to the SHA-256 of the Node win-arm64 zip.");
  }
  const destination = join(projectRoot, "src-tauri/synara-runtime");
  const stage = mkdtempSync(join(projectRoot, "src-tauri/.windows-runtime-"));
  const cacheRoot = join(projectRoot, "node_modules/.cache/lattice/node");
  mkdirSync(cacheRoot, { recursive: true });
  try {
    await prepareNodeRuntime(stage, { cacheRoot, target, nodeVersion });
    const version = execFileSync(join(stage, "bin/node.exe"), ["--version"], { encoding: "utf8", windowsHide: true }).trim();
    if (version !== `v${nodeVersion}`) throw new Error(`Unexpected bundled Node version: ${version}`);
    writeJson(join(stage, "manifest.json"), { target, nodeVersion, nodeRuntime: "standalone", agentAvailable: false });
    rmSync(destination, { recursive: true, force: true });
    renameSync(stage, destination);
    console.log(`Prepared Node ${nodeVersion} for Windows; the embedded Agent remains disabled.`);
  } finally {
    rmSync(stage, { recursive: true, force: true });
  }
}

if (isMain(import.meta.url)) await prepareWindowsRuntime();
