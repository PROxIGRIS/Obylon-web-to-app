import fs from 'fs';
import path from 'path';

const serverDir = path.resolve('dist/server');
const jsPath = path.join(serverDir, 'index.js');
const mjsPath = path.join(serverDir, 'index.mjs');

// Ensure directory exists
if (!fs.existsSync(serverDir)) {
  console.log('Creating dist/server directory as a fallback...');
  fs.mkdirSync(serverDir, { recursive: true });
}

if (!fs.existsSync(jsPath)) {
  if (fs.existsSync(mjsPath)) {
    console.log('[Deploy Prepare] Copying index.mjs to index.js to satisfy wrangler.jsonc');
    fs.copyFileSync(mjsPath, jsPath);
  } else {
    console.log('[Deploy Prepare] Warning: Neither index.js nor index.mjs found in dist/server.');
    console.log('[Deploy Prepare] Directory contents of dist/server:');
    try {
      console.log(fs.readdirSync(serverDir));
    } catch (e) {
      console.log('Could not read dist/server:', e.message);
    }
  }
} else {
  console.log('[Deploy Prepare] index.js exists in dist/server.');
}
