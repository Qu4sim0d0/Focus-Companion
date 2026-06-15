import { copyFileSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";

const sourceDir = resolve("node_modules/@mediapipe/tasks-vision/wasm");
const targetDir = resolve("public/wasm");

if (!existsSync(sourceDir)) {
  throw new Error("MediaPipe wasm directory not found. Run npm install first.");
}

mkdirSync(targetDir, { recursive: true });

for (const file of readdirSync(sourceDir)) {
  if (file.endsWith(".wasm") || file.endsWith(".js")) {
    copyFileSync(join(sourceDir, file), join(targetDir, file));
  }
}

console.log(`Copied MediaPipe wasm assets to ${targetDir}`);
