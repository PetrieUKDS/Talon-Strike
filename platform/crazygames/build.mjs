// Builds the CrazyGames version of Talon Strike into dist/crazygames/ and dist/talon-strike-crazygames.zip.
// It reads the normal game and never changes it: every CrazyGames difference is a patch applied to a copy.
//
//   node platform/crazygames/build.mjs
//
// Each patch must match exactly as many times as expected, or the build stops, so a change to the
// game that moves things around shows up here instead of silently shipping a broken build.
import { readFileSync, writeFileSync, mkdirSync, rmSync, readdirSync, statSync, copyFileSync, cpSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateRawSync, crc32 } from 'node:zlib';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..');
const DIST = join(ROOT, 'dist');
const OUT = join(DIST, 'crazygames');
const ZIP = join(DIST, 'talon-strike-crazygames.zip');

function patch(text, find, replace, label, times = 1) {
  const n = text.split(find).length - 1;
  if (n !== times) throw new Error(`patch "${label}": expected ${times} match(es), found ${n}`);
  return text.split(find).join(replace);
}

// 1. copy the playable files: the page, scripts, fonts and painted art. No service worker, manifest
//    or app icons: CrazyGames hosts the game in a frame, so offline play and installing don't apply.
// Empty the folder rather than delete it: on Windows a local test server running inside it would block that.
mkdirSync(OUT, { recursive: true });
for (const f of readdirSync(OUT)) rmSync(join(OUT, f), { recursive: true, force: true });
for (const dir of ['src', 'fonts', 'art']) cpSync(join(ROOT, dir), join(OUT, dir), { recursive: true });
copyFileSync(join(HERE, 'crazygames.js'), join(OUT, 'crazygames.js'));

// 2. the page: load the SDK and the adapter first, drop the install-as-app bits and the service worker
let page = readFileSync(join(ROOT, 'index.html'), 'utf8');
page = patch(page, '<script src="src/util.js"></script>',
  '<script src="https://sdk.crazygames.com/crazygames-sdk-v3.js"></script>\n  <script src="crazygames.js"></script>\n  <script src="src/util.js"></script>', 'SDK and adapter load first');
page = page.replace(/<script>\s*\/\/ Offline play[\s\S]*?<\/script>\s*/, '');
if (page.includes('serviceWorker')) throw new Error('service worker registration still in the page');
for (const tag of [/\s*<link rel="manifest"[^>]*>/, /\s*<link rel="icon"[^>]*>/, /\s*<link rel="apple-touch-icon"[^>]*>/,
  /\s*<meta name="apple-mobile-web-app-[^>]*>/g, /\s*<meta name="mobile-web-app-capable"[^>]*>/]) {
  page = page.replace(tag, '');
}
writeFileSync(join(OUT, 'index.html'), page);

// 3. game patches
const edit = (file, fn) => writeFileSync(join(OUT, file), fn(readFileSync(join(OUT, file), 'utf8')));
edit('src/game.js', (s) => {
  // the adapter starts the game once the SDK (and the save it holds) is ready
  s = patch(s, "window.addEventListener('load', () => G.init());", 'window.__talonBoot(() => G.init());', 'boot through the adapter');
  // no outgoing links: the feedback form button hides itself when there's no form
  s = s.replace(/const FEEDBACK_URL = '[^']*';/, () => "const FEEDBACK_URL = '';");
  if (!s.includes("const FEEDBACK_URL = '';")) throw new Error('feedback link not removed');
  return s;
});
edit('src/input.js', (s) => patch(s, '    if (this.triedFullscreen) return;',
  '    return; // CrazyGames build: the portal has its own full-screen button, and the game runs in a frame', 'no own full-screen'));

// leftover outgoing links are a QA rejection reason, so list any that remain
const text = [page, ...['src/game.js', 'src/input.js', 'src/hud.js', 'src/progress.js'].map((f) => readFileSync(join(OUT, f), 'utf8'))].join('\n');
const left = [...text.matchAll(/https?:\/\/[a-z0-9.-]+[^\s'"`)]*/gi)].map((m) => m[0])
  .filter((u) => !u.startsWith('https://sdk.crazygames.com/') && !u.startsWith('http://www.w3.org/'));
if (left.length) console.log('Outgoing URLs still in the build:\n  ' + [...new Set(left)].join('\n  '));

// 4. zip it (forward-slash paths, index.html at the root, as CrazyGames wants)
function files(dir) { return readdirSync(dir).flatMap((f) => { const p = join(dir, f); return statSync(p).isDirectory() ? files(p) : [p]; }); }
const entries = [], central = [];
let offset = 0;
for (const f of files(OUT)) {
  const name = Buffer.from(relative(OUT, f).split('\\').join('/'));
  const data = readFileSync(f), comp = deflateRawSync(data, { level: 9 }), crc = crc32(data);
  const h = Buffer.alloc(30); h.writeUInt32LE(0x04034b50, 0); h.writeUInt16LE(20, 4); h.writeUInt16LE(0x0800, 6); h.writeUInt16LE(8, 8);
  h.writeUInt32LE(0, 10); h.writeUInt32LE(crc, 14); h.writeUInt32LE(comp.length, 18); h.writeUInt32LE(data.length, 22); h.writeUInt16LE(name.length, 26);
  entries.push(h, name, comp);
  const c = Buffer.alloc(46); c.writeUInt32LE(0x02014b50, 0); c.writeUInt16LE(20, 4); c.writeUInt16LE(20, 6); c.writeUInt16LE(0x0800, 8); c.writeUInt16LE(8, 10);
  c.writeUInt32LE(0, 12); c.writeUInt32LE(crc, 16); c.writeUInt32LE(comp.length, 20); c.writeUInt32LE(data.length, 24); c.writeUInt16LE(name.length, 28); c.writeUInt32LE(offset, 42);
  central.push(c, name);
  offset += 30 + name.length + comp.length;
}
const cd = Buffer.concat(central), count = central.length / 2;
const end = Buffer.alloc(22); end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(count, 8); end.writeUInt16LE(count, 10); end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(offset, 16);
const zip = Buffer.concat([...entries, cd, end]);
writeFileSync(ZIP, zip);

const total = files(OUT).reduce((n, f) => n + statSync(f).size, 0);
console.log(`Built ${relative(ROOT, OUT)}: ${count} files, ${(total / 1048576).toFixed(2)} MB (zip ${(zip.length / 1048576).toFixed(2)} MB) -> ${relative(ROOT, ZIP)}`);
