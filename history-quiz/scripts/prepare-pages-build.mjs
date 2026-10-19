import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve('dist/client');
const extensions = new Set(['.css', '.html', '.js']);

async function filesIn(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await filesIn(absolute));
    else if (extensions.has(path.extname(entry.name))) files.push(absolute);
  }
  return files;
}

for (const file of await filesIn(root)) {
  const source = await readFile(file, 'utf8');
  const output = source.replace(/(?<!\/QuizMe)\/(art|assets)\//g, '/QuizMe/$1/');
  if (output !== source) await writeFile(file, output);
}
