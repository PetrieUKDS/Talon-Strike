// Turns the recorded frames in dist/video/out/ into the CrazyGames preview MP4s in store/:
// H.264, 30 fps, no audio track, index at the front. Deletes the frames once encoded.
//
//   node platform/crazygames/video/encode.mjs
//
// Needs ffmpeg on PATH, or FFMPEG=path/to/ffmpeg.
import { spawnSync } from 'node:child_process';
import { readdirSync, rmSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, '..', '..', '..', 'dist', 'video', 'out');
const STORE = join(HERE, '..', 'store');
const ffmpeg = process.env.FFMPEG || 'ffmpeg';

for (const [prefix, name] of [['landscape', 'preview-landscape-1920x1080.mp4'], ['portrait', 'preview-portrait-1080x1620.mp4']]) {
  const frames = readdirSync(OUT).filter((f) => f.startsWith(prefix + '-') && f.endsWith('.jpg'));
  if (!frames.length) { console.log(`no ${prefix} frames, skipped`); continue; }
  const r = spawnSync(ffmpeg, ['-y', '-hide_banner', '-loglevel', 'error', '-framerate', '30', '-i', join(OUT, `${prefix}-%05d.jpg`),
    '-c:v', 'libx264', '-preset', 'slow', '-crf', process.env.CRF || '20', '-pix_fmt', 'yuv420p', '-an', '-movflags', '+faststart',
    join(STORE, name)], { stdio: 'inherit' });
  if (r.status !== 0) process.exit(r.status || 1);
  for (const f of frames) rmSync(join(OUT, f));
  const mb = statSync(join(STORE, name)).size / 1048576;
  console.log(`${name}: ${frames.length} frames, ${(frames.length / 30).toFixed(1)} s, ${mb.toFixed(1)} MB${mb > 50 ? '  (over the 50 MB limit: raise CRF)' : ''}`);
}
