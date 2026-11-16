// Tiny local receiver for the preview-video recorder: video.html POSTs each frame here as a JPEG
// and it is written to dist/video/out/. Only accepts requests from the local game server.
//
//   node platform/crazygames/video/receive.mjs
import http from 'node:http';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'dist', 'video', 'out');
mkdirSync(OUT, { recursive: true });
let n = 0;
http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', 'http://127.0.0.1:5220');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  if (req.method === 'OPTIONS') { res.end(); return; }
  if (req.method !== 'POST') { res.statusCode = 405; res.end(); return; }
  const name = basename(new URL(req.url, 'http://x').searchParams.get('name') || 'frame.jpg').replace(/[^\w.-]/g, '_');
  const chunks = [];
  req.on('data', (c) => chunks.push(c));
  req.on('end', () => {
    writeFileSync(join(OUT, name), Buffer.concat(chunks));
    if (++n % 60 === 0) console.log('frames saved:', n);
    res.end('ok');
  });
}).listen(5263, '127.0.0.1', () => console.log('listening on 5263, saving to', OUT));
