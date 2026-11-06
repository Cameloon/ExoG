import fs from 'node:fs';
import assert from 'node:assert/strict';
import { gzipSync } from 'node:zlib';

const dist = new URL('../dist/',import.meta.url);
const manifest = JSON.parse(fs.readFileSync(new URL('.vite/manifest.json',dist),'utf8'));
const visited = new Set();
function visit(key) {
  if(visited.has(key)) return;
  const chunk = manifest[key];
  assert.ok(chunk,`Missing manifest entry ${key}`);
  visited.add(key);
  for(const dependency of chunk.imports??[]) visit(dependency);
}
visit('index.html');
visit('src/pages/LandingV2.tsx');
let bytes=0;
for(const key of visited) {
  const file=manifest[key].file;
  assert.doesNotMatch(`${key} ${file}`,/clerk|supabase|jspdf|jszip|charts|AppShell/i,`Optional code in public dependency graph: ${key}`);
  if(file.endsWith('.js')) bytes+=gzipSync(fs.readFileSync(new URL(file,dist))).length;
}
console.log(`Public entry + landing: ${visited.size} static chunks, ${(bytes/1000).toFixed(2)} kB gzip; auth and PDF libraries stay deferred.`);
