#!/usr/bin/env node
// Removes previous build artifacts (index.html + assets/) from the repo root
// before Vite rebuilds. Keeps everything else at root untouched.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const root = path.resolve(path.dirname(__filename), '..');

const targets = [
  path.join(root, 'index.html'),
  path.join(root, 'assets'),
];

for (const target of targets) {
  if (fs.existsSync(target)) {
    fs.rmSync(target, { recursive: true, force: true });
    console.log('cleaned', path.relative(root, target));
  }
}
