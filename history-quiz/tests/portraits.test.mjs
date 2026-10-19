import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { characters } from '../src/quiz.ts';
import { portraitUrl } from '../src/portraits.ts';

test('each of the 100 results resolves to a distinct local WebP portrait', () => {
  const hashes = new Set();
  for (const person of characters) {
    const asset = new URL(`../public${portraitUrl(person)}`, import.meta.url);
    const bytes = readFileSync(asset);
    assert.equal(bytes.toString('ascii', 0, 4), 'RIFF', person.name);
    assert.equal(bytes.toString('ascii', 8, 12), 'WEBP', person.name);
    assert.ok(bytes.length > 10000, `${person.name}: portrait is empty or incomplete`);
    hashes.add(createHash('sha256').update(bytes).digest('hex'));
  }
  assert.equal(hashes.size, 100, 'Different people must not share a generic portrait');
});
