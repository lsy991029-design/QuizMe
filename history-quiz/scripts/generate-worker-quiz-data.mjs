#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const [people, questions] = await Promise.all([
  readFile(path.join(root, "src", "data", "people.json"), "utf8").then(JSON.parse),
  readFile(path.join(root, "src", "data", "questions.json"), "utf8").then(JSON.parse),
]);

const output = `// Generated from src/data/people.json and src/data/questions.json. Do not edit by hand.\nexport const peopleData = ${JSON.stringify(people)};\nexport const questionData = ${JSON.stringify(questions)};\n`;
await writeFile(path.join(root, "worker", "quiz-data.js"), output);
console.log("Generated worker/quiz-data.js");
