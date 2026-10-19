#!/usr/bin/env node
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(root, "dist");
const index = path.join(dist, "client", "index.html");
const worker = path.join(root, "worker", "index.js");
const workerApi = path.join(root, "worker", "api.js");
const workerQuiz = path.join(root, "worker", "quiz.js");
const workerQuizData = path.join(root, "worker", "quiz-data.js");
const hosting = path.join(root, ".openai", "hosting.json");

await import(new URL("./generate-worker-quiz-data.mjs", import.meta.url));

for (const file of [index, worker, workerApi, workerQuiz, workerQuizData, hosting]) {
  if (!existsSync(file)) throw new Error("Missing Sites build input: " + file);
}

mkdirSync(path.join(dist, "server"), { recursive: true });
mkdirSync(path.join(dist, ".openai"), { recursive: true });
copyFileSync(worker, path.join(dist, "server", "index.js"));
copyFileSync(workerApi, path.join(dist, "server", "api.js"));
copyFileSync(workerQuiz, path.join(dist, "server", "quiz.js"));
copyFileSync(workerQuizData, path.join(dist, "server", "quiz-data.js"));
copyFileSync(hosting, path.join(dist, ".openai", "hosting.json"));

console.log("Prepared Sites build: dist/server/index.js and dist/.openai/hosting.json");
