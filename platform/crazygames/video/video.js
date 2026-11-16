// Preview videos for CrazyGames, recorded from the real game: 18 s, no sound, no HUD or text except the
// opening title, which fades out. The game runs in fixed 1/60 s steps and every other step becomes a
// 30 fps frame, so the clip plays at the game's own speed and a slow or hidden browser can't drop frames.
//
// 1. node platform/crazygames/video/receive.mjs                 (saves frames to dist/video/out/)
// 2. serve the repo root on 127.0.0.1:5220 and open /platform/crazygames/video/video.html
// 3. in the console: await VIDEO.record('landscape')  then  await VIDEO.record('portrait')
// 4. node platform/crazygames/video/encode.mjs
//
// The game itself is untouched: this page swaps out the game's loop, controls and screen size.
window.VIDEO = (() => {
  const SIZES = { landscape: [1920, 1080, 1.6], portrait: [1080, 1620, 1.45] };
  const RECEIVER = 'http://127.0.0.1:5263/';
  const TITLE_IN = 0.7, TITLE_FADE = 0.7; // seconds the title holds, then fades over
  let W = 0, H = 0, zoom = 1, prefix = 'f', frame = 0, t = 0, pending = [];

  // ---- the game, taken over
  function takeOver(shape) {
    [W, H, zoom] = SIZES[shape];
    prefix = shape;
    G.loop = () => {}; // stops the game's own animation loop at its next tick
    G.resize = () => {};
    G.dpr = 1; G.w = W; G.h = H; G.zoom = zoom;
    G.canvas.width = W; G.canvas.height = H;
    G.canvas.style.width = Math.round(W / 2) + 'px'; G.canvas.style.height = Math.round(H / 2) + 'px';
    G.safe = { l: 0, r: 0, t: 0, b: 0 };
    Settings.data.tutorial = false; Settings.data.shake = true;
    Settings.data.tipFlares = Settings.data.tipPad = true;
    Sfx.setVolumes(0, 0);
    // no HUD, crosshair, score pop-ups or banners: CrazyGames wants no text over the gameplay
    Hud.draw = () => {}; Hud.crosshair = () => {};
    G.checkMission = () => {}; // a scene shouldn't end because something blew up
    G.readControls = autopilot;
  }

  // ---- autopilot: circle the focus target at a stand-off distance, guns on it, missiles now and then
  let focus = null, orbit = 0, missileT = 1.2;
  function pickFocus() {
    if (focus && !focus.dead) return focus;
    const p = G.player;
    let best = null, bd = Infinity;
    for (const e of G.enemies) {
      if (e.dead) continue;
      const d = dist(e.x, e.y, p.x, p.y) - (e.objective ? 400 : 0);
      if (d < bd) { bd = d; best = e; }
    }
    return (focus = best);
  }
  function autopilot(dt) {
    const p = G.player;
    const c = { mx: 0, my: 0, aimX: p.x + Math.cos(p.angle) * 300, aimY: p.y + Math.sin(p.angle) * 300, fire: false, missile: false, flare: false, turbo: false };
    const e = pickFocus();
    if (!e) return c;
    orbit += dt * 0.35;
    const stand = e.air ? 200 : 290;
    const a = Math.atan2(p.y - e.y, p.x - e.x) + 0.6 * dt * Math.sign(Math.sin(orbit) + 0.3);
    const gx = e.x + Math.cos(a) * stand, gy = e.y + Math.sin(a) * stand;
    const dx = gx - p.x, dy = gy - p.y, dd = Math.hypot(dx, dy) || 1;
    const k = Math.min(1, dd / 120);
    c.mx = (dx / dd) * k; c.my = (dy / dd) * k;
    c.turbo = dd > 520;
    c.aimX = e.x; c.aimY = e.y;
    const range = dist(p.x, p.y, e.x, e.y);
    c.fire = range < 520;
    missileT -= dt;
    if (missileT <= 0 && range < 640 && G.lockTarget) { c.missile = true; missileT = 1.6; }
    return c;
  }

  // ---- scenes: a mission, with the player placed near its targets, played for a few seconds
  function scene(mission, place) {
    G.vehicle = VEHICLES.stormwolf;
    G.score = 0;
    G.startMission(mission);
    G.setState('play');
    G.tut = null;
    const p = G.player;
    p.damage = () => {}; p.hp = p.maxHp;
    place(p);
    for (const e of G.enemies) {
      if (dist(e.x, e.y, p.x, p.y) < 1100) e.aware = true;
    }
    G.cam.x = p.x; G.cam.y = p.y;
    focus = null; missileT = 1.0;
  }
  const near = (p, e, d, ang) => { p.x = e.x + Math.cos(ang) * d; p.y = e.y + Math.sin(ang) * d; p.angle = ang + Math.PI; };
  const first = (cls) => G.enemies.find((e) => e instanceof cls && !e.dead);
  const SCENES = [
    // Desert: a SAM site and its escorts
    { secs: 6.5, start: () => scene(0, (p) => { const s = first(SamSite); near(p, s, 430, 2.4); for (let i = 0; i < 3; i++) G.spawnNear('jeep', s, 200, 420); G.spawnNear('tank', s, 160, 300); }) },
    // Tundra: fuel depots ringed by AA, which go up in fireballs
    { secs: 5.5, start: () => scene(2, (p) => { const d = first(FuelDepot); near(p, d, 400, 3.6); }) },
    // Red canyons: the stolen gunship, RED TALON
    { secs: 6.0, start: () => scene(5, (p) => { const b = G.enemies.find((e) => e.isBoss); near(p, b, 360, 1.2); b.aware = true; G.spawnNear('gunship', b, 200, 400).aware = true; }) },
  ];

  // ---- frames
  // While flying, the game only builds a few terrain tiles a frame, so new ground shows as a rough
  // preview for a moment. Build everything in and around the view first, off screen.
  const scratch = document.createElement('canvas').getContext('2d');
  function buildTerrain() {
    const vw = W / zoom, vh = H / zoom, x0 = G.cam.x - vw / 2, y0 = G.cam.y - vh / 2;
    G.terrain.draw(scratch, x0 - 500, y0 - 500, x0 + vw + 500, y0 + vh + 500, 200);
  }
  async function save() {
    const blob = await new Promise((r) => G.canvas.toBlob(r, 'image/jpeg', 0.93));
    const name = `${prefix}-${String(frame++).padStart(5, '0')}.jpg`;
    const res = await fetch(RECEIVER + '?name=' + name, { method: 'POST', body: blob, headers: { 'Content-Type': 'text/plain' } });
    if (!res.ok) throw new Error('save failed ' + name);
  }
  function title(alpha) {
    const ctx = G.ctx;
    const size = Math.round(Math.min(W, H) * 0.15);
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = 'rgba(5,7,10,0.45)';
    ctx.fillRect(0, 0, W, H);
    ctx.font = `900 ${size}px ${TITLE_FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.lineWidth = Math.max(4, size / 22);
    ctx.strokeStyle = '#05070a';
    const y = H / 2 - size * 0.08;
    for (const [txt, col, dy] of [['TALON', '#e9ecef', 0], ['STRIKE', HUD_AMBER, size * 1.05]]) {
      ctx.strokeText(txt, W / 2, y + dy);
      ctx.fillStyle = col;
      ctx.fillText(txt, W / 2, y + dy);
    }
    ctx.restore();
  }
  function shot() {
    G.banners = []; G.floaters = [];
    G.player.hp = G.player.maxHp;
    buildTerrain();
    G.render();
    const k = (t - TITLE_IN) / TITLE_FADE;
    if (k < 1) title(1 - Math.max(0, Math.min(1, k)) ** 2);
    pending.push(save());
  }
  async function play(secs, recording) {
    for (let s = 0, n = 0; s < secs; s += 1 / 60, n++) {
      G.update(1 / 60);
      Input.endFrame();
      if (!recording) { if (n % 6 === 0) buildTerrain(); continue; }
      t += 1 / 60;
      if (n % 2 === 0) {
        shot();
        if (pending.length > 6) { await Promise.all(pending); pending = []; }
      }
    }
  }

  async function record(shape = 'landscape') {
    await document.fonts.load(`900 100px Orbitron`);
    takeOver(shape);
    frame = 0; t = 0; pending = [];
    for (const sc of SCENES) {
      sc.start();
      await new Promise((r) => setTimeout(r, 400)); // let the theatre's painted art load
      buildTerrain();
      await play(0.8, false); // settle, off the record
      await play(sc.secs, true);
    }
    await Promise.all(pending);
    return `${shape}: ${frame} frames, ${(frame / 30).toFixed(1)} s`;
  }

  return { record, SCENES };
})();
