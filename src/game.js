'use strict';

const VEHICLE_KEY = 'chopperGunner.vehicle';
const BONUS_STAR = 1500; // score (and so funds) for each bonus star
// Tally form behind the SEND FEEDBACK button in settings. Leave it empty to hide the button.
// The form can pick up input, screen, fx and mission as hidden fields; nothing personal is sent.
const FEEDBACK_URL = 'https://tally.so/r/zEjkY0';

function fmtTime(s) {
  s = Math.max(0, Math.floor(s));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

// First-flight training, shown at the start of Operation Sandstorm until it has been
// finished or skipped once. Each step's hint matches how you're playing (touch, pad or keys).
const TUTORIAL = [
  {
    hint: (g) => (Input.touchMode ? 'Drag on the LEFT half of the screen to fly'
      : Input.pad ? 'Push the LEFT STICK to fly'
      : `${['up', 'left', 'down', 'right'].map((a) => Input.bindLabel(a)).join(' ')} to fly`),
    done: (g, t) => dist(g.player.x, g.player.y, g.base.x, g.base.y) > 350,
  },
  {
    hint: (g) => (Input.touchMode ? 'Drag on the RIGHT half to aim - your guns fire at anything in front of you'
      : Input.pad ? 'RIGHT STICK aims, RIGHT TRIGGER fires the chain guns'
      : `Aim with the MOUSE (or ${Input.bindLabel('turnLeft')} ${Input.bindLabel('turnRight')}), fire with ${Input.bindLabel('fire')} or LEFT CLICK`),
    done: (g, t) => t.fired > 0.8,
  },
  {
    hint: (g) => (Input.touchMode ? 'Tap MSL to launch a homing missile at the target in the lock box'
      : Input.pad ? 'LEFT TRIGGER launches a homing missile at the target in the lock box'
      : `${Input.bindLabel('missile')} or RIGHT CLICK launches a homing missile at the target in the lock box`),
    done: (g, t) => t.missile,
  },
  {
    hint: (g) => (Input.touchMode ? 'Tap FLR to drop flares - they break enemy missile locks'
      : Input.pad ? 'RIGHT BUMPER drops flares - they break enemy missile locks'
      : `${Input.bindLabel('flare')} drops flares - they break enemy missile locks`),
    done: (g, t) => t.flare,
  },
  {
    hint: () => 'Fly back and hover over the base pad to repair and rearm',
    done: (g, t) => t.padT > 1.2,
  },
];

function starString(n, of = 3) {
  return '★'.repeat(n) + '☆'.repeat(of - n);
}

const G = {
  canvas: null,
  ctx: null,
  w: 0, h: 0, dpr: 1, zoom: 1,
  state: 'title',
  stateT: 0,
  time: 0,
  last: 0,
  cam: { x: 0, y: 0 },
  shakeAmt: 0,
  shakeX: 0, shakeY: 0,

  terrain: null,
  base: null,
  player: null,
  mission: MISSIONS[0],
  missionIndex: 0,
  difficulty: 1,

  enemies: [], bullets: [], ebullets: [], missiles: [], flares: [],
  particles: [], pickups: [], floaters: [], emitters: [], banners: [],
  friendlies: [], // aid trucks, downed crew, the base HQ: things to protect
  delayed: [], // timed explosions, e.g. the boss breaking up: { t, x, y, size, ring }

  score: 0,
  missionStartScore: 0,
  kills: 0,
  escaped: 0,
  allowedEscapes: 0,
  checkpoint: null,
  lockTarget: null,
  missileWarning: false,
  warnBeepT: 0,
  threats: [], // enemy missiles homing on the player, for the HUD's direction arrows
  hitMarks: [], // recent hits: { a: world angle they came from, t: fade 1 to 0 }
  hurtFlash: 0,
  damageTaken: 0,
  missionTime: 0,
  reinforceT: 0,
  controls: null,
  result: null,
  aimMode: 'keys', // 'mouse' or 'keys': whichever was used last steers the nose
  menu: { row: 0, slot: 0, from: 'title', waiting: false },
  vehicle: VEHICLES.stormwolf,

  init() {
    this.canvas = document.getElementById('game');
    this.ctx = this.canvas.getContext('2d');
    window.addEventListener('resize', () => this.resize());
    this.resize();
    Input.init(this.canvas);
    Save.load();
    Settings.load();
    setTheatre(MISSIONS[0].theatre);
    this.terrain = new Terrain();
    this.base = this.findBase();
    this.cam.x = this.base.x;
    this.cam.y = this.base.y;
    try {
      this.best = Number(localStorage.getItem('chopperGunner.best')) || 0;
      this.vehicle = VEHICLES[localStorage.getItem(VEHICLE_KEY)] || this.vehicle;
      if (vehicleLocked(this.vehicle)) this.vehicle = VEHICLES.stormwolf;
    } catch (e) {
      this.best = 0;
    }
    this.player = new Player(this.base.x, this.base.y, this.vehicle);
    Weather.set(THEATRE.weather, this.w, this.h, this.lowFx() ? 0.5 : 1);
    requestAnimationFrame((t) => this.loop(t));
  },

  resize() {
    // Low effects also renders at 1x on high-density screens, which is the biggest saving.
    this.dpr = Math.min(window.devicePixelRatio || 1, this.lowFx() ? 1 : 2);
    this.w = window.innerWidth;
    this.h = window.innerHeight;
    this.canvas.width = Math.round(this.w * this.dpr);
    this.canvas.height = Math.round(this.h * this.dpr);
    this.zoom = clamp(Math.min(this.w, this.h) / 820, 0.55, 1.3);
    this.safe = readSafeArea();
    Input.layoutButtons(this.w, this.h, this.safe);
  },

  lowFx() {
    const e = Settings.data.effects;
    return e === 'low' || (e === 'auto' && this.autoLow);
  },

  // AUTO effects: if play runs below ~40fps for a few seconds, drop to low effects.
  watchFrameRate(rawDt) {
    if (Settings.data.effects !== 'auto' || this.autoLow || this.state !== 'play' || this.stateT < 3) {
      this.slowT = 0;
      return;
    }
    this.frameAvg = this.frameAvg ? this.frameAvg * 0.95 + rawDt * 0.05 : rawDt;
    this.slowT = this.frameAvg > 1 / 40 ? (this.slowT || 0) + rawDt : 0;
    if (this.slowT > 4) {
      this.autoLow = true;
      this.resize();
      Weather.set(THEATRE.weather, this.w, this.h, 0.5);
      this.banner('LOW EFFECTS ON FOR SMOOTHER PLAY', '#9fb4c0');
    }
  },

  // A flat-ish spot inland for the home helipad.
  findBase() {
    const rng = mulberry32(THEATRE.seed);
    for (let i = 0; i < 4000; i++) {
      const r = 300 + i * 0.8;
      const a = rng() * TAU;
      const x = WORLD_W * 0.55 + Math.cos(a) * r, y = WORLD_H * 0.62 + Math.sin(a) * r;
      const h = heightAt(x, y);
      if (h < SHORE + 0.04 || h > HILLS - 0.04) continue;
      let ok = true;
      for (let k = 0; k < 12 && ok; k++) {
        const b = (k / 12) * TAU;
        const hh = heightAt(x + Math.cos(b) * 170, y + Math.sin(b) * 170);
        if (hh < SHORE + 0.02 || hh > HILLS) ok = false;
      }
      if (ok) return { x, y };
    }
    return { x: WORLD_W / 2, y: WORLD_H / 2 };
  },

  landPoint(from, minD, maxD, extra) {
    let fallback = null;
    for (let i = 0; i < 400; i++) {
      const a = rand(0, TAU), d = rand(minD, maxD);
      const x = from.x + Math.cos(a) * d, y = from.y + Math.sin(a) * d;
      if (x < 200 || y < 200 || x > WORLD_W - 200 || y > WORLD_H - 200) continue;
      if (!isLand(x, y)) continue;
      if (dist(x, y, this.base.x, this.base.y) < 700) continue;
      fallback = fallback || { x, y };
      if (extra && !extra({ x, y })) continue;
      return { x, y };
    }
    return fallback || { x: clamp(from.x + minD, 200, WORLD_W - 200), y: from.y };
  },

  // A spot on open water near the coast, for boats.
  waterPoint(from, minD, maxD, extra) {
    let fallback = null;
    for (let i = 0; i < 1200; i++) {
      const a = rand(0, TAU), d = rand(minD, maxD + i * 2);
      const x = from.x + Math.cos(a) * d, y = from.y + Math.sin(a) * d;
      if (!isWater(x, y) || heightAt(x, y) < SEA_LEVEL - 0.14) continue;
      fallback = fallback || { x, y };
      if (extra && !extra({ x, y })) continue;
      return { x, y };
    }
    return fallback || this.landPoint(from, minD, maxD);
  },

  make(type, x, y) {
    const d = this.difficulty;
    switch (type) {
      case 'jeep': return new Jeep(x, y, d);
      case 'aa': return new AAGun(x, y, d);
      case 'tank': return new Tank(x, y, d);
      case 'gunship': return new Gunship(x, y, d);
      case 'sam': return new SamSite(x, y, d);
    }
  },

  spawnNear(type, from, minD, maxD) {
    const pt = type === 'gunship'
      ? { x: clamp(from.x + rand(-1, 1) * maxD, 200, WORLD_W - 200), y: clamp(from.y + rand(-1, 1) * maxD, 200, WORLD_H - 200) }
      : this.landPoint(from, minD, maxD);
    const e = this.make(type, pt.x, pt.y);
    this.enemies.push(e);
    return e;
  },

  // ------------------------------------------------------------ flow

  startMission(i) {
    this.missionIndex = i;
    this.contract = null;
    const tour = Math.floor(i / MISSIONS.length);
    this.launch(MISSIONS[i % MISSIONS.length], 1 + (i % MISSIONS.length) * 0.08 + tour * 0.4, i === 0 && Settings.data.tutorial);
  },

  // A contract from the board or the daily one (see contracts.js). Its rank sets enemy strength.
  startContract(m) {
    this.contract = m;
    this.launch(m, 0.95 + 0.09 * m.contract.rank, false);
  },

  retry() {
    this.score = this.missionStartScore;
    if (this.contract) this.startContract(this.contract);
    else this.startMission(this.missionIndex);
  },

  launch(mission, strength, tutorial) {
    this.mission = mission;
    Music.play(this.mission.music);
    this.difficulty = strength * Save.difficulty().enemy;
    setTheatre(this.mission.theatre, this.mission.seed);
    Weather.set(THEATRE.weather, this.w, this.h, this.lowFx() ? 0.5 : 1);
    this.base = this.findBase();
    this.missionStartScore = this.score;
    this.enemies = []; this.bullets = []; this.ebullets = []; this.missiles = []; this.flares = [];
    this.particles = []; this.pickups = []; this.floaters = []; this.emitters = []; this.banners = [];
    this.delayed = [];
    this.friendlies = [];
    this.delivered = 0; this.convoyLost = 0; // escort
    this.carrying = 0; this.rescued = 0; this.captured = 0; // rescue
    this.kills = 0;
    this.escaped = 0;
    this.checkpoint = null;
    this.checkpointLabel = '';
    this.hq = null;
    this.threats = []; this.hitMarks = [];
    this.hurtFlash = 0;
    this.damageTaken = 0;
    this.missionTime = 0;
    this.tut = tutorial ? { step: 0, fired: 0, missile: false, flare: false, padT: 0, flash: 0 } : null;
    this.terrain.reset();
    this.player = new Player(this.base.x, this.base.y, this.vehicle, Save.mods());
    this.aimMode = 'keys';
    if (this.mission.setupSeed) withSeed(this.mission.setupSeed, () => this.mission.setup(this));
    else this.mission.setup(this);
    this.reinforceT = this.mission.reinforce.every;
    this.cam.x = this.player.x;
    this.cam.y = this.player.y;
    this.setState('briefing');
  },

  setState(s) {
    this.state = s;
    this.stateT = 0;
    // The crosshair stands in for the mouse pointer only while flying.
    this.canvas.style.cursor = s === 'play' || s === 'dying' ? 'none' : 'default';
  },

  playerDied() {
    this.explode(this.player.x, this.player.y, 60);
    this.result = 'down';
    this.setState('dying');
  },

  banner(text, color = HUD_GREEN) {
    this.banners.push({ text, color, t: 2.6, slot: this.banners.length });
  },

  // ------------------------------------------------------------ helpers

  shake(a) {
    if (!Settings.data.shake) return;
    this.shakeAmt = Math.max(this.shakeAmt, a);
  },

  worldToScreen(x, y) {
    return { x: (x - this.cam.x) * this.zoom + this.w / 2, y: (y - this.cam.y) * this.zoom + this.h / 2 };
  },

  screenToWorld(x, y) {
    return { x: (x - this.w / 2) / this.zoom + this.cam.x, y: (y - this.h / 2) / this.zoom + this.cam.y };
  },

  objectivesLeft() {
    let n = 0;
    for (const e of this.enemies) if (e.objective && !e.dead) n++;
    return n;
  },

  addScore(n, x, y) {
    this.score += n;
    this.floaters.push({ x, y, text: '+' + n, t: 1.2 });
  },

  maybeDrop(x, y) {
    if (Math.random() > 0.22) return;
    const p = this.player;
    const kinds = ['repair', 'missiles', 'flares'];
    let kind = pick(kinds);
    if (Math.random() < 0.25) kind = pick(['guns', 'shield', 'cluster']);
    else if (p.hp < 50 && Math.random() < 0.6) kind = 'repair';
    else if (p.missiles < 3 && Math.random() < 0.5) kind = 'missiles';
    this.pickups.push(new Pickup(x, y, kind));
  },

  enemyShoot(x, y, angle, speed, dmg, kind, spread, muzzle) {
    const a = angle + rand(-spread, spread);
    const ox = x + Math.cos(angle) * muzzle, oy = y + Math.sin(angle) * muzzle;
    this.ebullets.push(new Bullet(ox, oy, Math.cos(a) * speed, Math.sin(a) * speed, 'e', dmg * Math.sqrt(this.difficulty), 1.8, kind));
    const d = dist(x, y, this.player.x, this.player.y);
    if (d < 900) Sfx.enemyGun(1 - d / 900);
  },

  launchEnemyMissile(x, y, angle, target) {
    this.missiles.push(new Missile(x, y, angle, 'e', target,
      { speed: 180, maxSpeed: 380 + this.difficulty * 30, accel: 170, turn: 1.9 + this.difficulty * 0.2, dmg: 20, life: 6.5 }));
    if (dist(x, y, this.player.x, this.player.y) < 1200) Sfx.enemyMissile();
  },

  findTarget(x, y, angle, range) {
    let best = null, bs = Infinity;
    for (const e of this.enemies) {
      if (e.dead) continue;
      const d = dist(x, y, e.x, e.y);
      if (d > range) continue;
      const off = Math.abs(angDiff(angle, Math.atan2(e.y - y, e.x - x)));
      if (off > 0.9) continue;
      const s = d * (1 + off * 2);
      if (s < bs) { bs = s; best = e; }
    }
    return best;
  },

  computeLock(c) {
    let best = null, bd = 240 * 240;
    for (const e of this.enemies) {
      if (e.dead) continue;
      const d = dist2(e.x, e.y, c.aimX, c.aimY);
      if (d < bd) { bd = d; best = e; }
    }
    return best || this.findTarget(this.player.x, this.player.y, this.player.angle, 750);
  },

  explode(x, y, size, o = {}) {
    const n = Math.min(36, 6 + ((size * 0.7) | 0)) * (this.lowFx() ? 0.5 : 1);
    this.particles.push(new Particle(x, y, 0, 0, 0.2, size * 1.7, size * 3, 'flash'));
    if (size >= 30 || o.ring) this.particles.push(new Particle(x, y, 0, 0, 0.45, size * 0.6, size * 7, 'ring'));
    for (let i = 0; i < n; i++) {
      const a = rand(0, TAU), s = rand(20, size * 5);
      this.particles.push(new Particle(x, y, Math.cos(a) * s, Math.sin(a) * s, rand(0.3, 0.75), rand(size * 0.25, size * 0.6), size * 0.7, 'fire'));
    }
    for (let i = 0; i < n * 0.7; i++) {
      const a = rand(0, TAU), s = rand(10, size * 2);
      this.particles.push(new Particle(x, y, Math.cos(a) * s, Math.sin(a) * s, rand(1, 2.2), rand(size * 0.3, size * 0.6), size * 0.8, 'smoke'));
    }
    for (let i = 0; i < n * 0.6; i++) {
      const a = rand(0, TAU), s = rand(150, 480);
      this.particles.push(new Particle(x, y, Math.cos(a) * s, Math.sin(a) * s, rand(0.25, 0.6), 1, 0, 'spark'));
    }
    if (size > 18) {
      for (let i = 0; i < n * 0.4; i++) {
        const a = rand(0, TAU), s = rand(60, 260);
        this.particles.push(new Particle(x, y, Math.cos(a) * s, Math.sin(a) * s, rand(0.6, 1.2), rand(3, 6), 0, 'debris', rand(0, TAU)));
      }
    }
    const d = dist(x, y, this.player.x, this.player.y);
    const near = clamp(1 - d / 1400, 0, 1);
    if (near > 0) {
      this.shake(Math.min(16, size * 0.3) * near);
      Sfx.explosion(size / 30, near);
    }
    if (o.ground) this.terrain.addDecal({ type: 'scorch', x, y, r: size * 1.5 });
  },

  // A cluster bomb splits into bomblets that blanket the area in front of it.
  clusterBurst(x, y) {
    this.explode(x, y, 20);
    for (let i = 0; i < 10; i++) {
      const a = rand(0, TAU), d = rand(30, 150);
      this.delayed.push({ t: 0.08 + i * 0.05, x: x + Math.cos(a) * d, y: y + Math.sin(a) * d, size: 22, dmg: 34, r: 70 });
    }
  },

  updateDelayed(dt) {
    for (const ex of this.delayed) {
      ex.t -= dt;
      if (ex.t > 0) continue;
      this.explode(ex.x, ex.y, ex.size, { ground: isLand(ex.x, ex.y), ring: ex.ring });
      if (ex.dmg) {
        for (const e of this.enemies) {
          if (!e.dead && dist2(e.x, e.y, ex.x, ex.y) < (ex.r + e.r) * (ex.r + e.r)) e.hurt(ex.dmg, this);
        }
      }
      if (ex.ring) this.shake(18);
    }
    this.delayed = this.delayed.filter((ex) => ex.t > 0);
  },

  // Track what the player has tried, and move the training on when a step is done.
  updateTutorial(dt, c) {
    const t = this.tut;
    const p = this.player;
    if (c.fire) t.fired += dt;
    if (c.missile) t.missile = true;
    if (c.flare) t.flare = true;
    t.padT = p.onPad && t.step === TUTORIAL.length - 1 ? t.padT + dt : 0;
    t.flash = Math.max(0, t.flash - dt);
    if (TUTORIAL[t.step].done(this, t)) {
      t.step++;
      t.flash = 0.6;
      Sfx.confirm();
      if (t.step >= TUTORIAL.length) this.endTutorial('TRAINING COMPLETE - DESTROY THE SAM SITES');
    }
    if (Input.hit('Tab') || (this.tutSkip && Input.tapped && this.inBox(this.tutSkip))) this.endTutorial('TRAINING SKIPPED');
  },

  endTutorial(msg) {
    this.tut = null;
    this.tutSkip = null;
    Settings.data.tutorial = false;
    Settings.write();
    this.banner(msg, HUD_AMBER);
  },

  inBox(b) {
    return Input.tapX >= b.x && Input.tapX <= b.x + b.w && Input.tapY >= b.y && Input.tapY <= b.y + b.h;
  },

  drawTutorial(ctx) {
    const t = this.tut;
    const w = this.w, small = w < 600;
    const text = TUTORIAL[t.step].hint(this);
    // Short screens: low in the middle, between the touch controls and above the pause button.
    // Otherwise near the top, between the gauges and the radar.
    const short = this.h < 520;
    const pw = short ? clamp(w - 380, 300, 460) : Math.min(560, w - 480);
    const x0 = (w - pw) / 2;
    const y0 = short ? this.h - (this.safe ? this.safe.b : 0) - 116 : small ? 214 : 70;
    ctx.fillStyle = 'rgba(4,10,16,0.78)';
    ctx.fillRect(x0, y0, pw, 58);
    ctx.strokeStyle = t.flash > 0 ? HUD_GREEN : HUD_AMBER;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(x0 + 0.5, y0 + 0.5, pw - 1, 57);
    Hud.text(ctx, `TRAINING ${t.step + 1}/${TUTORIAL.length}`, x0 + 12, y0 + 18, { size: 12, color: HUD_AMBER });
    ctx.font = `${small ? 13 : 15}px ${FONT}`;
    const lines = this.wrap(ctx, text, pw - 24);
    lines.slice(0, 2).forEach((l, i) => Hud.text(ctx, l, x0 + 12, y0 + 36 + i * 17, { size: small ? 13 : 15, color: '#ffffff' }));
    const skip = Input.touchMode ? 'TAP TO SKIP' : 'TAB SKIPS';
    Hud.text(ctx, skip, x0 + pw - 12, y0 + 18, { size: 11, align: 'right', color: '#9fb4c0' });
    this.tutSkip = { x: x0 + pw - 110, y: y0, w: 110, h: 26 };
  },

  readControls(dt) {
    const p = this.player;
    const c = {
      mx: 0, my: 0,
      aimX: p.x + Math.cos(p.angle) * 300, aimY: p.y + Math.sin(p.angle) * 300,
      fire: false, missile: false, flare: false, turbo: false,
    };
    if (this.state !== 'play') return c;
    if (Input.action('left')) c.mx -= 1;
    if (Input.action('right')) c.mx += 1;
    if (Input.action('up')) c.my -= 1;
    if (Input.action('down')) c.my += 1;
    c.flare = Input.actionHit('flare') || Input.hit('btn_flare');
    c.turbo = Input.action('turbo') || Input.buttons.turbo !== undefined;
    c.missile = Input.mouse.right || Input.hit('Mouse2') || Input.action('missile') || Input.actionHit('missile') || Input.buttons.missile !== undefined;
    if (Input.touchMode) {
      const m = Input.stick('move');
      c.mx += m.x;
      c.my += m.y;
      const a = Input.stick('aim');
      if (a.mag > 0.2) {
        const ang = Math.atan2(a.y, a.x);
        c.aimX = p.x + Math.cos(ang) * 300;
        c.aimY = p.y + Math.sin(ang) * 300;
        c.fire = a.mag > 0.45;
      }
    } else {
      const turn = (Input.action('turnRight') ? 1 : 0) - (Input.action('turnLeft') ? 1 : 0);
      if (turn) this.aimMode = 'keys';
      else if (Input.mouseMoved || Input.mouse.left || Input.mouse.right || Input.hit('Mouse0')) this.aimMode = 'mouse';
      if (this.aimMode === 'keys') {
        p.aimAngle += turn * 3.6 * dt;
        c.aimX = p.x + Math.cos(p.aimAngle) * 300;
        c.aimY = p.y + Math.sin(p.aimAngle) * 300;
        c.assist = true;
      } else {
        const wpt = this.screenToWorld(Input.mouse.x, Input.mouse.y);
        c.aimX = wpt.x;
        c.aimY = wpt.y;
        p.aimAngle = p.angle;
      }
      c.fire = Input.mouse.left || Input.hit('Mouse0') || Input.action('fire') || Input.actionHit('fire');
    }
    const pad = Input.pad;
    if (pad) {
      c.mx += pad.lx;
      c.my += pad.ly;
      if (Math.hypot(pad.rx, pad.ry) > 0.35) {
        const ang = Math.atan2(pad.ry, pad.rx);
        p.aimAngle = ang;
        c.aimX = p.x + Math.cos(ang) * 300;
        c.aimY = p.y + Math.sin(ang) * 300;
        c.assist = true;
        this.aimMode = 'keys';
      }
      c.fire = c.fire || pad.fire;
      c.missile = c.missile || pad.missile;
      c.flare = c.flare || pad.flareHit;
      c.turbo = c.turbo || pad.turbo;
    }
    // Auto-fire: the guns open up on their own at whatever sits in front of the nose, and
    // the rounds get the same steer onto it that keyboard and pad players get.
    const auto = Settings.data.autofire === null ? Input.touchMode : Settings.data.autofire;
    c.gunTarget = this.gunTarget(p);
    if (auto && c.gunTarget && !p.overheat) {
      c.fire = true;
      c.assist = true;
    }
    return c;
  },

  // The enemy the guns would hit: in range, with either where it is or where it will be when
  // the rounds arrive inside a cone ahead of the nose (wider for big targets). Favours near and
  // central ones. cone is how far rounds may be steered off the nose towards it.
  gunTarget(p) {
    if (p.dead) return null;
    const gun = p.vehicle.gun, sp = gun.speed || 980, range = (gun.range || 690) * 0.95;
    let best = null, bs = Infinity;
    for (const e of this.enemies) {
      if (e.dead || e.gone) continue;
      const d = dist(p.x, p.y, e.x, e.y);
      if (d > range + e.r) continue;
      const t = d / sp;
      const lx = e.x + (e.mvx || 0) * t, ly = e.y + (e.mvy || 0) * t;
      const cone = 0.32 + Math.atan2(e.r, Math.max(d, 1));
      const offNow = Math.abs(angDiff(p.angle, Math.atan2(e.y - p.y, e.x - p.x)));
      const offLead = Math.abs(angDiff(p.angle, Math.atan2(ly - p.y, lx - p.x)));
      const off = Math.min(offNow, offLead);
      if (off > cone) continue;
      const s = d * (1 + off * 3);
      if (s < bs) { bs = s; best = { e, x: lx, y: ly, cone }; }
    }
    return best;
  },

  // ------------------------------------------------------------ update

  loop(ts) {
    const raw = (ts - this.last) / 1000 || 0;
    const dt = Math.min(0.033, raw);
    this.last = ts;
    if (raw < 0.25) this.watchFrameRate(raw); // ignore pauses from a hidden tab
    this.update(dt);
    this.render();
    Input.endFrame();
    requestAnimationFrame((t) => this.loop(t));
  },

  // Touch screens held upright: ask for landscape, and pause a mission in progress.
  portrait() {
    return Input.touchMode && this.h > this.w;
  },

  update(dt) {
    this.time += dt;
    this.stateT += dt;
    if (this.portrait() && this.state === 'play') {
      this.setState('paused');
      Sfx.setRotor(false);
    }
    Input.menuMode = this.state !== 'play' && this.state !== 'dying';
    Input.pollGamepad();
    if (this.state !== 'controls' && (Input.actionHit('mute') || Input.hit('btn_mute'))) Sfx.toggleMute();
    Weather.update(dt, this);

    switch (this.state) {
      case 'title':
        this.cam.x = this.base.x + Math.cos(this.time * 0.05) * 900;
        this.cam.y = this.base.y + Math.sin(this.time * 0.05) * 600;
        this.player.x = this.cam.x + Math.cos(this.time * 0.5) * (this.w * 0.36) / this.zoom;
        this.player.y = this.cam.y + Math.sin(this.time * 0.5) * (this.h * 0.36) / this.zoom;
        this.player.angle = this.time * 0.5 + Math.PI / 2;
        this.player.rotor += dt * 40;
        if (Input.hit('KeyC')) {
          this.openControls();
          break;
        }
        if (Input.hit('KeyO')) {
          this.openSettings();
          break;
        }
        if (this.stateT > 0.3 && Input.confirm()) {
          Sfx.confirm();
          this.setState('hangar');
        }
        break;
      case 'hangar':
        this.updateHangar();
        break;
      case 'missions':
        this.updateMissions();
        break;
      case 'workshop':
        this.updateWorkshop();
        break;
      case 'contracts':
        this.updateContracts();
        break;
      case 'briefing':
        this.player.rotor += dt * 40;
        if (this.stateT > 0.5 && Input.confirm()) {
          Sfx.confirm();
          this.setState('play');
          this.banner(`${this.vehicle.name} - LAUNCH`, HUD_GREEN);
        }
        break;
      case 'paused':
        if (Input.hit('KeyC')) this.openControls();
        else if (Input.hit('KeyO')) this.openSettings();
        else if (this.stateT > 0.2 && (Input.actionHit('pause') || Input.hit('btn_pause') || Input.confirm())) this.setState('play');
        break;
      case 'controls':
        this.player.rotor += dt * 40;
        this.updateControlsMenu();
        break;
      case 'settings':
        this.updateSettings();
        break;
      case 'play':
        if (Input.actionHit('pause') || Input.hit('btn_pause')) {
          this.setState('paused');
          Sfx.setRotor(false);
          break;
        }
        this.updateWorld(dt);
        this.checkMission();
        break;
      case 'dying':
        this.updateWorld(dt);
        if (this.stateT > 2.6) this.setState('failed');
        break;
      case 'complete':
      case 'failed':
        this.updateWorld(dt);
        if (this.stateT < 1.2) break;
        if (this.state === 'failed' && (Input.hit('Escape') || (this.tapHit() || {}).kind === 'back')) {
          Sfx.beep();
          this.score = this.missionStartScore;
          if (this.contract) this.openContracts();
          else this.openMissions();
        } else if (Input.confirm()) {
          Sfx.confirm();
          if (this.state === 'complete') this.openWorkshop(this.contract ? 'contracts' : this.missionIndex + 1);
          else this.retry();
        }
        break;
    }
  },

  openControls() {
    this.menu = { row: 0, slot: 0, from: this.state, waiting: false };
    this.setState('controls');
  },

  // Keyboard-driven rebinding screen. Navigation keys are fixed so the menu can never lock you out.
  updateControlsMenu() {
    const m = this.menu;
    if (m.waiting) return;
    const rows = ACTIONS.length;
    const rebind = () => {
      m.waiting = true;
      Input.capture = (code) => {
        m.waiting = false;
        if (code !== 'Escape') Input.setBind(ACTIONS[m.row].id, m.slot, code);
      };
    };
    if (Input.hit('ArrowUp') || Input.hit('KeyW')) m.row = (m.row + rows) % (rows + 1);
    if (Input.hit('ArrowDown') || Input.hit('KeyS') || Input.hit('Tab')) m.row = (m.row + 1) % (rows + 1);
    if (m.row < rows) {
      if (Input.hit('ArrowLeft') || Input.hit('KeyA')) m.slot = 0;
      if (Input.hit('ArrowRight') || Input.hit('KeyD')) m.slot = 1;
      if (Input.hit('Enter') || Input.hit('Space')) rebind();
      if (Input.hit('Backspace') || Input.hit('Delete')) {
        Input.binds[ACTIONS[m.row].id][m.slot] = null;
        Input.saveBinds();
      }
    } else if (Input.hit('Enter') || Input.hit('Space')) {
      Input.resetBinds();
    }
    if (Input.hit('KeyR')) Input.resetBinds();
    // Mouse: click a key slot to rebind it.
    if (Input.tapped && this.menuHits) {
      for (const hbox of this.menuHits) {
        if (Input.mouse.x >= hbox.x && Input.mouse.x <= hbox.x + hbox.w && Input.mouse.y >= hbox.y && Input.mouse.y <= hbox.y + hbox.h) {
          if (hbox.kind === 'slot') {
            m.row = hbox.row;
            m.slot = hbox.slot;
            rebind();
          } else if (hbox.kind === 'reset') Input.resetBinds();
          else if (hbox.kind === 'back') return this.closeControls();
        }
      }
    }
    if (!m.waiting && (Input.hit('Escape') || Input.hit('KeyC'))) this.closeControls();
  },

  closeControls() {
    this.setState(this.menu.from);
  },

  // ------------------------------------------------------------ settings

  openSettings() {
    this.prefs = { row: 0, from: this.state };
    this.menuHits = null;
    this.setState('settings');
  },

  // Opens the feedback form in a new tab, or in this one if pop-ups are blocked.
  openFeedback() {
    const m = this.mission;
    const q = new URLSearchParams({
      input: Input.touchMode ? 'touch' : Input.pad ? 'gamepad' : 'keyboard',
      screen: `${Math.round(this.w)}x${Math.round(this.h)}`,
      fx: this.lowFx() ? 'low' : 'high',
      mission: m ? m.title : '',
    });
    const url = `${FEEDBACK_URL}${FEEDBACK_URL.includes('?') ? '&' : '?'}${q}`;
    if (!window.open(url, '_blank', 'noopener')) location.assign(url);
  },

  // Each row: a label, how to show its value, and how ←/→ changes it.
  settingRows() {
    const s = Settings.data;
    const vol = (k) => ({ show: () => s[k], bar: () => s[k] / 10, step: (d) => (s[k] = clamp(s[k] + d, 0, 10)) });
    const flag = (k) => ({ show: () => (s[k] ? 'ON' : 'OFF'), step: () => (s[k] = !s[k]) });
    // Step through a fixed list of values; names maps a value to what's shown.
    const cycle = (k, values, names) => ({
      show: () => names[values.indexOf(s[k])],
      step: (d) => (s[k] = values[(values.indexOf(s[k]) + d + values.length) % values.length]),
    });
    return [
      { label: 'MUSIC VOLUME', ...vol('music') },
      { label: 'SOUND VOLUME', ...vol('sfx') },
      { label: 'AUTO-FIRE', ...cycle('autofire', [null, true, false], ['TOUCH', 'ON', 'OFF']), note: 'Guns fire by themselves at targets ahead. TOUCH: only with touch controls' },
      { label: 'EFFECTS', ...cycle('effects', ['auto', 'high', 'low'], ['AUTO', 'HIGH', 'LOW']), note: 'LOW cuts particles and weather for slower phones. AUTO switches if needed', apply: () => this.resize() },
      { label: 'SCREEN SHAKE', ...flag('shake') },
      { label: 'VIBRATION', ...flag('vibrate'), note: 'Buzz when you are hit (phones that support it)' },
      { label: 'TRAINING', ...flag('tutorial'), note: 'Show the first-flight guide at the start of Operation Sandstorm' },
    ];
  },

  updateSettings() {
    const rows = this.settingRows();
    const pr = this.prefs;
    const change = (i, d) => {
      rows[i].step(d);
      Settings.write();
      if (rows[i].apply) rows[i].apply();
      Sfx.beep();
    };
    // Below the setting rows: BACK, then SEND FEEDBACK when there's a form to send to.
    const n = rows.length + (FEEDBACK_URL ? 2 : 1);
    if (Input.hit('ArrowUp') || Input.hit('KeyW')) pr.row = (pr.row + n - 1) % n;
    if (Input.hit('ArrowDown') || Input.hit('KeyS') || Input.hit('Tab')) pr.row = (pr.row + 1) % n;
    const press = this.stateT > 0.3 && (Input.hit('Space') || Input.hit('Enter'));
    if (pr.row < rows.length) {
      if (Input.hit('ArrowLeft') || Input.hit('KeyA')) change(pr.row, -1);
      if (Input.hit('ArrowRight') || Input.hit('KeyD')) change(pr.row, 1);
      if (press && !rows[pr.row].bar) change(pr.row, 1);
    } else {
      if (FEEDBACK_URL && (Input.hit('ArrowLeft') || Input.hit('KeyA'))) pr.row = rows.length;
      if (FEEDBACK_URL && (Input.hit('ArrowRight') || Input.hit('KeyD'))) pr.row = rows.length + 1;
      if (press && pr.row === rows.length) return this.setState(pr.from);
      if (press) this.openFeedback();
    }
    if (Input.hit('Escape') || Input.hit('KeyO')) return this.setState(pr.from);
    const hit = this.tapHit();
    if (!hit) return;
    if (hit.kind === 'step') {
      pr.row = hit.i;
      change(hit.i, hit.d);
    } else if (hit.kind === 'row') {
      // Tapping the row itself steps a switch forward, or just selects a slider.
      if (pr.row === hit.i && !rows[hit.i].bar) change(hit.i, 1);
      pr.row = hit.i;
    } else if (hit.kind === 'back') this.setState(pr.from);
    else if (hit.kind === 'feedback') {
      pr.row = rows.length + 1;
      this.openFeedback();
    }
  },

  drawSettings(ctx) {
    this.dim(ctx, 0.7);
    const w = this.w, h = this.h;
    const small = w < 600;
    const rows = this.settingRows();
    const pw = Math.min(520, w - 24);
    const x0 = (w - pw) / 2;
    // Rows shrink to fit short (landscape phone) screens; the notes go when there's no room.
    const rowH = clamp((h - 130) / rows.length, 34, small ? 50 : 56);
    const notes = rowH >= 48 && !small;
    const hits = [];
    let y = Math.max(rowH < 44 ? 30 : 50, (h - rowH * rows.length - 150) / 2);
    Hud.text(ctx, 'SETTINGS', w / 2, y, { size: small ? 22 : 30, align: 'center', font: TITLE_FONT, weight: '900', color: HUD_AMBER });
    y += 30;
    rows.forEach((r, i) => {
      const ry = y + i * rowH;
      const sel = this.prefs.row === i;
      ctx.fillStyle = sel ? 'rgba(255,192,74,0.12)' : 'rgba(255,255,255,0.03)';
      ctx.fillRect(x0, ry, pw, rowH - 6);
      if (sel) {
        ctx.strokeStyle = HUD_AMBER;
        ctx.lineWidth = 1.5;
        ctx.strokeRect(x0 + 0.5, ry + 0.5, pw - 1, rowH - 7);
      }
      const mid = ry + (rowH - 6) / 2;
      Hud.text(ctx, r.label, x0 + 14, mid + (r.note && notes ? -3 : 5), { size: small ? 13 : 15, color: sel ? '#ffffff' : '#c8d6dc' });
      if (r.note && notes) Hud.text(ctx, r.note, x0 + 14, mid + 13, { size: 11, color: '#9fb4c0' });
      // ◀ value ▶ on the right, each arrow a tap target.
      const vx = x0 + pw - 120;
      Hud.text(ctx, '◀', vx - 52, mid + 6, { size: 18, align: 'center', color: HUD_GREEN });
      Hud.text(ctx, '▶', vx + 52, mid + 6, { size: 18, align: 'center', color: HUD_GREEN });
      if (r.bar) Hud.bar(ctx, vx - 34, mid - 4, 68, 9, r.bar(), HUD_GREEN);
      else Hud.text(ctx, r.show(), vx, mid + 6, { size: 16, align: 'center', color: r.show() === 'ON' ? HUD_GREEN : '#9fb4c0' });
      hits.push({ kind: 'step', i, d: -1, x: vx - 76, y: ry, w: 46, h: rowH - 6 }, { kind: 'step', i, d: 1, x: vx + 30, y: ry, w: 46, h: rowH - 6 });
      hits.push({ kind: 'row', i, x: x0, y: ry, w: pw, h: rowH - 6 });
    });
    const by = y + rows.length * rowH + 4;
    const button = (label, kind, bx, bw, sel) => {
      ctx.strokeStyle = sel ? HUD_AMBER : HUD_GREEN;
      ctx.lineWidth = sel ? 2 : 1.5;
      ctx.strokeRect(bx, by, bw, 34);
      Hud.text(ctx, label, bx + bw / 2, by + 22, { size: 14, align: 'center', color: sel ? HUD_AMBER : HUD_GREEN });
      hits.push({ kind, x: bx, y: by, w: bw, h: 34 });
    };
    if (FEEDBACK_URL) {
      const bw = Math.min(170, (pw - 12) / 2);
      button('BACK', 'back', w / 2 - bw - 6, bw, this.prefs.row === rows.length);
      button('SEND FEEDBACK', 'feedback', w / 2 + 6, bw, this.prefs.row === rows.length + 1);
    } else button('BACK', 'back', w / 2 - 80, 160, this.prefs.row === rows.length);
    if (!Input.touchMode) {
      if (by + 60 < h) Hud.text(ctx, '↑↓ SELECT   ←→ CHANGE   ESC BACK', w / 2, by + 60, { size: 12, align: 'center', color: '#9fb4c0' });
    }
    this.menuHits = hits;
  },

  // Aircraft selection between the title and the first briefing.
  updateHangar() {
    const ids = Object.keys(VEHICLES);
    const step = (d) => {
      let i = (ids.indexOf(this.pickId()) + d + ids.length) % ids.length;
      // Going left from the first aircraft skips past locked ones, so they only show up at the end.
      while (d < 0 && i === ids.length - 1 && vehicleLocked(VEHICLES[ids[i]])) i--;
      this.vehicle = VEHICLES[ids[i]];
      this.player = new Player(this.base.x, this.base.y, this.vehicle);
      if (!vehicleLocked(this.vehicle)) {
        try {
          localStorage.setItem(VEHICLE_KEY, ids[i]);
        } catch (e) { /* storage unavailable */ }
      }
      Sfx.beep();
    };
    if (Input.hit('ArrowLeft') || Input.hit('KeyA') || Input.actionHit('turnLeft')) step(-1);
    if (Input.hit('ArrowRight') || Input.hit('KeyD') || Input.actionHit('turnRight')) step(1);
    if (Input.hit('Escape')) {
      this.setState('title');
      return;
    }
    // Pointer: the side thirds of the screen page through the aircraft, the middle launches.
    let launch = this.stateT > 0.3 && (Input.hit('Space') || Input.hit('Enter'));
    if (Input.tapped && this.stateT > 0.3) {
      const x = Input.tapX;
      if (x < this.w / 3) step(-1);
      else if (x > (this.w * 2) / 3) step(1);
      else launch = true;
    }
    if (launch && vehicleLocked(this.vehicle)) Sfx.overheat();
    else if (launch) {
      Sfx.confirm();
      this.openMissions();
    }
  },

  pickId() {
    return Object.keys(VEHICLES).find((id) => VEHICLES[id] === this.vehicle);
  },

  callsign() {
    const n = this.vehicle.name;
    return n[0] + n.slice(1).toLowerCase();
  },

  // The clickable box under the latest click or tap, from the boxes the last menu drew.
  tapHit() {
    if (!Input.tapped || !this.menuHits || this.stateT < 0.3) return null;
    const x = Input.tapX, y = Input.tapY;
    return this.menuHits.find((b) => x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) || null;
  },

  // ------------------------------------------------------------ mission select

  openMissions() {
    this.menuSel = clamp(Save.data.unlocked - 1, 0, MISSIONS.length - 1);
    this.menuHits = null;
    this.setState('missions');
  },

  updateMissions() {
    const max = Save.data.unlocked - 1;
    // Selectable rows: the unlocked missions, then the contracts row once it's open.
    const rows = Array.from({ length: max + 1 }, (_, i) => i);
    if (Save.contractsOpen()) rows.push(MISSIONS.length);
    const move = (d) => {
      this.menuSel = rows[clamp(rows.indexOf(this.menuSel) + d, 0, rows.length - 1)];
      Sfx.beep();
    };
    const launch = (i) => {
      Sfx.confirm();
      this.score = 0;
      if (i === MISSIONS.length) this.openContracts();
      else this.startMission(i);
    };
    if (Input.hit('KeyT') && Save.contractsOpen()) return launch(MISSIONS.length);
    if (Input.hit('ArrowUp') || Input.hit('KeyW')) move(-1);
    if (Input.hit('ArrowDown') || Input.hit('KeyS')) move(1);
    if (Input.hit('ArrowLeft') || Input.hit('KeyA')) Save.setDifficulty(-1);
    if (Input.hit('ArrowRight') || Input.hit('KeyD')) Save.setDifficulty(1);
    if (Input.hit('KeyU')) return this.openWorkshop('missions');
    if (Input.hit('KeyO')) return this.openSettings();
    if (Input.hit('Escape')) return this.setState('hangar');
    if (this.stateT > 0.3 && (Input.hit('Space') || Input.hit('Enter'))) return launch(this.menuSel);
    const hit = this.tapHit();
    if (!hit) return;
    if (hit.kind === 'row' && rows.includes(hit.i)) {
      if (hit.i === this.menuSel) launch(hit.i);
      else this.menuSel = hit.i;
    } else if (hit.kind === 'diff') Save.setDifficulty(hit.d);
    else if (hit.kind === 'launch') launch(this.menuSel);
    else if (hit.kind === 'workshop') this.openWorkshop('missions');
    else if (hit.kind === 'settings') this.openSettings();
    else if (hit.kind === 'back') this.setState('hangar');
  },

  drawMissions(ctx) {
    this.dim(ctx, 0.72);
    const w = this.w, h = this.h;
    const small = w < 600;
    const pw = Math.min(620, w - 24);
    const x0 = (w - pw) / 2;
    const hits = [];
    const short = h < 520; // landscape phones: tighter header and rows
    let y = short ? 26 : Math.max(40, h * 0.07);
    Hud.text(ctx, 'SELECT MISSION', w / 2, y, { size: short ? 18 : small ? 20 : 28, align: 'center', font: TITLE_FONT, weight: '900', color: HUD_AMBER });
    y += short ? 22 : small ? 26 : 34;
    Hud.text(ctx, `${this.vehicle.name}   FUNDS ${Save.data.funds}`, w / 2, y, { size: short ? 12 : 13, align: 'center', color: '#9fb4c0' });
    y += short ? 22 : 26;

    // Difficulty selector.
    const diff = Save.difficulty();
    Hud.text(ctx, 'DIFFICULTY', w / 2 - 70, y, { size: 14, align: 'right', color: '#c8d6dc' });
    const dx = w / 2 + 40;
    Hud.text(ctx, '◀', dx - 52, y, { size: 16, align: 'center', color: HUD_GREEN });
    Hud.text(ctx, diff.name, dx, y, { size: 16, align: 'center', color: diff.id === 'hard' ? HUD_RED : diff.id === 'easy' ? '#5ec8ff' : HUD_GREEN });
    Hud.text(ctx, '▶', dx + 52, y, { size: 16, align: 'center', color: HUD_GREEN });
    hits.push({ kind: 'diff', d: -1, x: dx - 70, y: y - 20, w: 36, h: 28 }, { kind: 'diff', d: 1, x: dx + 34, y: y - 20, w: 36, h: 28 });
    y += short ? 12 : 18;

    const rowH = clamp((h - y - (short ? 50 : 110)) / (MISSIONS.length + 1), 22, 54);
    const compact = rowH < 36; // short screens: one line per mission
    MISSIONS.forEach((m, i) => {
      const ry = y + i * rowH;
      const locked = i >= Save.data.unlocked;
      const sel = i === this.menuSel;
      ctx.fillStyle = sel ? 'rgba(255,192,74,0.12)' : 'rgba(255,255,255,0.03)';
      ctx.fillRect(x0, ry, pw, rowH - 4);
      if (sel) {
        ctx.strokeStyle = HUD_AMBER;
        ctx.lineWidth = 1.5;
        ctx.strokeRect(x0 + 0.5, ry + 0.5, pw - 1, rowH - 5);
      }
      const col = locked ? 'rgba(200,214,220,0.35)' : sel ? '#ffffff' : '#c8d6dc';
      const mid = ry + rowH / 2;
      const best = Save.data.best[i];
      const stars = starString(Save.data.stars[i] || 1);
      Hud.text(ctx, String(i + 1), x0 + 18, mid + (compact ? 5 : 6), { size: compact ? 14 : small ? 16 : 20, align: 'center', font: TITLE_FONT, weight: '700', color: locked ? col : HUD_AMBER });
      if (compact) {
        Hud.text(ctx, m.title.replace('OPERATION ', ''), x0 + 40, mid + 4, { size: 12, color: col });
        const right = locked ? 'LOCKED' : best ? stars : 'NEW';
        Hud.text(ctx, right, x0 + pw - 12, mid + 4, { size: 12, align: 'right', color: locked ? col : best ? HUD_AMBER : '#9fb4c0' });
      } else {
        Hud.text(ctx, m.title, x0 + 40, mid - (small ? 1 : 3), { size: small ? 12 : 15, color: col });
        Hud.text(ctx, (m.night ? 'NIGHT - ' : '') + THEATRES[m.theatre].label, x0 + 40, mid + (small ? 13 : 15), { size: 11, color: locked ? col : '#9fb4c0' });
        const right = locked ? 'LOCKED' : best ? `BEST ${best}` : 'NOT CLEARED';
        Hud.text(ctx, right, x0 + pw - 12, mid + (best ? 13 : 5), { size: small ? 10 : 12, align: 'right', color: locked ? col : best ? HUD_GREEN : '#9fb4c0' });
        if (best) Hud.text(ctx, stars, x0 + pw - 12, mid - 3, { size: small ? 14 : 17, align: 'right', color: HUD_AMBER });
      }
      hits.push({ kind: 'row', i, x: x0, y: ry, w: pw, h: rowH - 4 });
    });
    this.drawContractsRow(ctx, x0, y + MISSIONS.length * rowH, pw, rowH, compact, small, hits);

    // Buttons.
    const by = y + (MISSIONS.length + 1) * rowH + (short ? 4 : 10);
    const bh = short ? 30 : 32;
    const btn = (label, kind, bx, bw, color) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(bx, by, bw, bh);
      Hud.text(ctx, label, bx + bw / 2, by + bh / 2 + 5, { size: short ? 13 : 14, align: 'center', color });
      hits.push({ kind, x: bx, y: by, w: bw, h: bh });
    };
    const gap = 8, bw = (pw - gap * 3) / 4;
    btn('BACK', 'back', x0, bw, '#c8d6dc');
    btn('WORKSHOP', 'workshop', x0 + bw + gap, bw, '#5ec8ff');
    btn('SETTINGS', 'settings', x0 + (bw + gap) * 2, bw, '#c8d6dc');
    btn('LAUNCH', 'launch', x0 + pw - bw, bw, HUD_GREEN);
    if (!Input.touchMode && by + 58 < h) {
      Hud.text(ctx, `↑↓ MISSION   ←→ DIFFICULTY   SPACE LAUNCH   ${Save.contractsOpen() ? 'T CONTRACTS   ' : ''}U WORKSHOP   O SETTINGS   ESC BACK`, w / 2, by + 58, { size: 12, align: 'center', color: '#9fb4c0' });
    }
    this.menuHits = hits;
  },

  // The last row of mission select: the way into contracts, or what unlocks them.
  drawContractsRow(ctx, x0, ry, pw, rowH, compact, small, hits) {
    const i = MISSIONS.length;
    const open = Save.contractsOpen();
    const sel = this.menuSel === i;
    ctx.fillStyle = sel ? 'rgba(94,200,255,0.14)' : 'rgba(94,200,255,0.05)';
    ctx.fillRect(x0, ry, pw, rowH - 4);
    if (sel) {
      ctx.strokeStyle = '#5ec8ff';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(x0 + 0.5, ry + 0.5, pw - 1, rowH - 5);
    }
    const mid = ry + rowH / 2;
    const col = open ? (sel ? '#ffffff' : '#c8d6dc') : 'rgba(200,214,220,0.35)';
    Hud.text(ctx, '∞', x0 + 18, mid + (compact ? 5 : 7), { size: compact ? 16 : 22, align: 'center', weight: '700', color: open ? '#5ec8ff' : col });
    const rank = Save.contracts().rank;
    const done = Save.daily().done;
    if (compact) {
      Hud.text(ctx, 'CONTRACTS', x0 + 40, mid + 4, { size: 12, color: col });
      Hud.text(ctx, open ? `RANK ${rank}` : 'LOCKED', x0 + pw - 12, mid + 4, { size: 12, align: 'right', color: open ? '#5ec8ff' : col });
    } else {
      Hud.text(ctx, 'CONTRACTS', x0 + 40, mid - (small ? 1 : 3), { size: small ? 12 : 15, color: col });
      const sub = open ? (small ? 'Endless generated missions' : 'Endless generated missions, harder and better paid every rank') : `Clear ${MISSIONS[2].title} to unlock`;
      Hud.text(ctx, sub, x0 + 40, mid + (small ? 13 : 15), { size: 11, color: open ? '#9fb4c0' : col });
      if (open) {
        Hud.text(ctx, `RANK ${rank}`, x0 + pw - 12, mid - 3, { size: small ? 13 : 16, align: 'right', color: '#5ec8ff' });
        Hud.text(ctx, done ? 'DAILY DONE' : 'DAILY READY', x0 + pw - 12, mid + 13, { size: small ? 10 : 12, align: 'right', color: done ? '#9fb4c0' : HUD_GREEN });
      } else Hud.text(ctx, 'LOCKED', x0 + pw - 12, mid + 5, { size: small ? 10 : 12, align: 'right', color: col });
    }
    hits.push({ kind: 'row', i, x: x0, y: ry, w: pw, h: rowH - 4 });
  },

  // ------------------------------------------------------------ contracts

  // The board: today's daily contract, two at your rank and a high-risk one two ranks up.
  openContracts() {
    const c = Save.contracts();
    this.board = [
      dailyContract(),
      makeContract(subSeed(c.board, 1), c.rank),
      makeContract(subSeed(c.board, 2), c.rank),
      makeContract(subSeed(c.board, 3), c.rank + 2, 'risk'),
    ];
    this.boardSel = clamp(this.boardSel || 0, 0, this.board.length - 1);
    this.menuHits = null;
    this.setState('contracts');
  },

  updateContracts() {
    const n = this.board.length;
    const launch = (i) => {
      Sfx.confirm();
      this.score = 0;
      this.boardSel = i;
      this.startContract(this.board[i]);
    };
    const reroll = () => {
      if (Save.reroll()) {
        Sfx.pickup();
        this.openContracts();
      } else Sfx.overheat();
    };
    if (Input.hit('ArrowUp') || Input.hit('KeyW')) {
      this.boardSel = (this.boardSel + n - 1) % n;
      Sfx.beep();
    }
    if (Input.hit('ArrowDown') || Input.hit('KeyS') || Input.hit('Tab')) {
      this.boardSel = (this.boardSel + 1) % n;
      Sfx.beep();
    }
    if (Input.hit('ArrowLeft') || Input.hit('KeyA')) Save.setDifficulty(-1);
    if (Input.hit('ArrowRight') || Input.hit('KeyD')) Save.setDifficulty(1);
    if (Input.hit('KeyR')) return reroll();
    if (Input.hit('KeyU')) return this.openWorkshop('contracts');
    if (Input.hit('KeyO')) return this.openSettings();
    if (Input.hit('Escape')) return this.openMissions();
    if (this.stateT > 0.3 && (Input.hit('Space') || Input.hit('Enter'))) return launch(this.boardSel);
    const hit = this.tapHit();
    if (!hit) return;
    if (hit.kind === 'row') {
      if (hit.i === this.boardSel) launch(hit.i);
      else this.boardSel = hit.i;
    } else if (hit.kind === 'diff') Save.setDifficulty(hit.d);
    else if (hit.kind === 'launch') launch(this.boardSel);
    else if (hit.kind === 'reroll') reroll();
    else if (hit.kind === 'workshop') this.openWorkshop('contracts');
    else if (hit.kind === 'back') this.openMissions();
  },

  drawContracts(ctx) {
    this.dim(ctx, 0.72);
    const w = this.w, h = this.h;
    const small = w < 600;
    const short = h < 520;
    const pw = Math.min(640, w - 24);
    const x0 = (w - pw) / 2;
    const hits = [];
    const c = Save.contracts();
    let y = short ? 26 : Math.max(40, h * 0.07);
    Hud.text(ctx, 'CONTRACTS', w / 2, y, { size: short ? 18 : small ? 20 : 28, align: 'center', font: TITLE_FONT, weight: '900', color: '#5ec8ff' });
    y += short ? 22 : small ? 26 : 34;
    const streak = Save.streak();
    const streakText = streak ? `   STREAK ${streak} ${streak > 1 ? 'DAYS' : 'DAY'}` : '';
    Hud.text(ctx, `${this.vehicle.name}   RANK ${c.rank}   FUNDS ${Save.data.funds}${streakText}`, w / 2, y, { size: short ? 12 : 13, align: 'center', color: '#9fb4c0' });
    y += short ? 22 : 26;

    const diff = Save.difficulty();
    Hud.text(ctx, 'DIFFICULTY', w / 2 - 70, y, { size: 14, align: 'right', color: '#c8d6dc' });
    const dx = w / 2 + 40;
    Hud.text(ctx, '◀', dx - 52, y, { size: 16, align: 'center', color: HUD_GREEN });
    Hud.text(ctx, diff.name, dx, y, { size: 16, align: 'center', color: diff.id === 'hard' ? HUD_RED : diff.id === 'easy' ? '#5ec8ff' : HUD_GREEN });
    Hud.text(ctx, '▶', dx + 52, y, { size: 16, align: 'center', color: HUD_GREEN });
    hits.push({ kind: 'diff', d: -1, x: dx - 70, y: y - 20, w: 36, h: 28 }, { kind: 'diff', d: 1, x: dx + 34, y: y - 20, w: 36, h: 28 });
    y += short ? 12 : 18;

    const rowH = clamp((h - y - (short ? 44 : 110)) / this.board.length, 40, 78);
    const roomy = rowH >= 62;
    const third = roomy || rowH >= 52; // room for the details line
    const daily = Save.daily();
    this.board.forEach((m, i) => {
      const info = m.contract;
      const ry = y + i * rowH;
      const sel = i === this.boardSel;
      const tint = info.kind === 'daily' ? '255,192,74' : info.kind === 'risk' ? '255,90,90' : '94,200,255';
      ctx.fillStyle = `rgba(${tint},${sel ? 0.14 : 0.05})`;
      ctx.fillRect(x0, ry, pw, rowH - 6);
      if (sel) {
        ctx.strokeStyle = `rgb(${tint})`;
        ctx.lineWidth = 1.5;
        ctx.strokeRect(x0 + 0.5, ry + 0.5, pw - 1, rowH - 7);
      }
      const tag = info.kind === 'daily' ? 'DAILY CONTRACT' : info.kind === 'risk' ? 'HIGH RISK' : `OFFER ${i}`;
      const lh = roomy ? 18 : 14;
      const top = ry + (third ? (roomy ? 18 : 14) : 14);
      Hud.text(ctx, tag, x0 + 12, top, { size: 11, color: `rgb(${tint})` });
      Hud.text(ctx, m.title, x0 + 12, top + lh, { size: small ? 12 : 15, color: sel ? '#ffffff' : '#c8d6dc' });
      const what = [THEATRES[m.theatre].label, info.labels.join(' + ')];
      if (info.twist) what.push(info.twist.label);
      if (third) Hud.text(ctx, what.join('  ·  '), x0 + 12, top + lh * 2, { size: 11, color: info.twist ? '#ff9b8a' : '#9fb4c0' });
      // Right side: rank and pay, or for the daily one whether it's been paid out today.
      const rx = x0 + pw - 12;
      Hud.text(ctx, `RANK ${info.rank}`, rx, top, { size: 11, align: 'right', color: '#9fb4c0' });
      const paid = info.kind === 'daily' && daily.done;
      Hud.text(ctx, paid ? 'CLEARED TODAY' : `PAY ${info.pay}`, rx, top + lh, { size: small ? 12 : 15, align: 'right', color: paid ? '#9fb4c0' : HUD_GREEN });
      if (third && paid && daily.best) Hud.text(ctx, `BEST ${daily.best}`, rx, top + lh * 2, { size: 11, align: 'right', color: HUD_AMBER });
      else if (third && info.kind === 'risk' && !small) Hud.text(ctx, `CLEAR FOR RANK ${info.rank + 1}`, rx, top + lh * 2, { size: 11, align: 'right', color: '#ff9b8a' });
      hits.push({ kind: 'row', i, x: x0, y: ry, w: pw, h: rowH - 6 });
    });

    const by = y + this.board.length * rowH + (short ? 0 : 8);
    const bh = short ? 30 : 32;
    const btn = (label, kind, bx, bw, color) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(bx, by, bw, bh);
      Hud.text(ctx, label, bx + bw / 2, by + bh / 2 + 5, { size: short || small ? 12 : 14, align: 'center', color });
      hits.push({ kind, x: bx, y: by, w: bw, h: bh });
    };
    const gap = 8, bw = (pw - gap * 3) / 4;
    btn('BACK', 'back', x0, bw, '#c8d6dc');
    btn('WORKSHOP', 'workshop', x0 + bw + gap, bw, '#5ec8ff');
    btn(small ? `NEW ${REROLL_COST}` : `NEW BOARD ${REROLL_COST}`, 'reroll', x0 + (bw + gap) * 2, bw, Save.data.funds >= REROLL_COST ? HUD_AMBER : 'rgba(255,90,90,0.7)');
    btn('LAUNCH', 'launch', x0 + pw - bw, bw, HUD_GREEN);
    if (!Input.touchMode && by + 58 < h) {
      Hud.text(ctx, '↑↓ CONTRACT   ←→ DIFFICULTY   SPACE LAUNCH   R NEW BOARD   U WORKSHOP   ESC BACK', w / 2, by + 58, { size: 12, align: 'center', color: '#9fb4c0' });
    }
    this.menuHits = hits;
  },

  drawContractComplete(ctx) {
    const info = this.contract.contract;
    const lines = [
      starString(this.lastStars) + `   Time ${fmtTime(this.missionTime)}`,
      ...this.bonuses.map((b) => `${b.got ? '★' : '☆'} ${b.label}${b.got ? '  +' + BONUS_STAR : ''}`),
      '',
      info.kind === 'daily' && !this.lastPay ? 'Daily pay already collected today' : `Contract pay ${this.lastPay}`,
      `Score ${this.score - this.missionStartScore}   Kills ${this.kills}`,
      `Earned ${this.lastEarned}   Funds ${Save.data.funds}`,
      '',
    ];
    if (info.kind === 'daily') {
      const s = Save.streak();
      lines.push(`DAILY STREAK: ${s} ${s === 1 ? 'DAY' : 'DAYS'}`, 'A new daily contract arrives tomorrow.');
    } else {
      const rank = Save.contracts().rank;
      lines.push(`CONTRACT RANK ${rank}`);
      if (UPGRADE_RANKS.some((r) => r > this.rankBefore && r <= rank)) lines.push('NEW UPGRADE LEVEL IN THE WORKSHOP');
    }
    lines.push('', 'PRESS SPACE / TAP FOR THE WORKSHOP');
    this.drawCenterPanel(ctx, 'CONTRACT COMPLETE', lines);
  },

  // ------------------------------------------------------------ workshop

  // next: 'missions' to return to mission select, or the mission index to brief next.
  openWorkshop(next) {
    this.shop = { sel: 0, next };
    this.menuHits = null;
    this.setState('workshop');
  },

  leaveWorkshop() {
    Sfx.confirm();
    if (this.shop.next === 'missions') this.openMissions();
    else if (this.shop.next === 'contracts') this.openContracts();
    else this.startMission(this.shop.next);
  },

  updateWorkshop() {
    const rows = UPGRADES.length + 1;
    const buy = (i) => {
      if (Save.buy(UPGRADES[i].id)) Sfx.pickup();
      else Sfx.overheat();
    };
    if (Input.hit('ArrowUp') || Input.hit('KeyW')) this.shop.sel = (this.shop.sel + rows - 1) % rows;
    if (Input.hit('ArrowDown') || Input.hit('KeyS') || Input.hit('Tab')) this.shop.sel = (this.shop.sel + 1) % rows;
    if (Input.hit('Escape')) return this.leaveWorkshop();
    if (this.stateT > 0.3 && (Input.hit('Space') || Input.hit('Enter'))) {
      if (this.shop.sel < UPGRADES.length) buy(this.shop.sel);
      else return this.leaveWorkshop();
    }
    const hit = this.tapHit();
    if (!hit) return;
    if (hit.kind === 'upgrade') {
      this.shop.sel = hit.i;
      buy(hit.i);
    } else if (hit.kind === 'continue') this.leaveWorkshop();
  },

  drawWorkshop(ctx) {
    this.dim(ctx, 0.75);
    const w = this.w, h = this.h;
    const small = w < 600;
    const pw = Math.min(600, w - 24);
    const x0 = (w - pw) / 2;
    const hits = [];
    let y = Math.max(44, h * 0.1);
    Hud.text(ctx, 'WORKSHOP', w / 2, y, { size: small ? 22 : 30, align: 'center', font: TITLE_FONT, weight: '900', color: HUD_AMBER });
    y += small ? 26 : 32;
    Hud.text(ctx, `FUNDS ${Save.data.funds}`, w / 2, y, { size: 18, align: 'center', color: HUD_GREEN });
    y += 22;
    Hud.text(ctx, 'Upgrades fit every aircraft in the hangar.', w / 2, y, { size: 12, align: 'center', color: '#9fb4c0' });
    y += 22;
    if (Save.contractsOpen() && Save.maxLevel() < 5) {
      Hud.text(ctx, `Level ${Save.maxLevel() + 1} goes on sale at contract rank ${UPGRADE_RANKS[Save.maxLevel() - 3]}.`, w / 2, y - 4, { size: 12, align: 'center', color: '#5ec8ff' });
      y += 18;
    }
    const rowH = small ? 46 : 54;
    UPGRADES.forEach((u, i) => {
      const ry = y + i * rowH;
      const sel = this.shop.sel === i;
      const lvl = Save.level(u.id);
      const cost = Save.nextCost(u.id);
      const afford = cost !== undefined && Save.data.funds >= cost;
      ctx.fillStyle = sel ? 'rgba(255,192,74,0.12)' : 'rgba(255,255,255,0.03)';
      ctx.fillRect(x0, ry, pw, rowH - 6);
      if (sel) {
        ctx.strokeStyle = HUD_AMBER;
        ctx.lineWidth = 1.5;
        ctx.strokeRect(x0 + 0.5, ry + 0.5, pw - 1, rowH - 7);
      }
      const mid = ry + (rowH - 6) / 2;
      Hud.text(ctx, u.name, x0 + 14, mid - 3, { size: small ? 13 : 15, color: sel ? '#ffffff' : '#c8d6dc' });
      Hud.text(ctx, `${u.desc} per level`, x0 + 14, mid + 13, { size: 11, color: '#9fb4c0' });
      // Levels past the ones on sale are drawn as empty outlines.
      for (let k = 0; k < u.costs.length; k++) {
        const px = x0 + pw * 0.5 + k * 16;
        if (k < Save.maxLevel()) {
          ctx.fillStyle = k < lvl ? HUD_GREEN : 'rgba(255,255,255,0.15)';
          ctx.fillRect(px, mid - 6, 11, 12);
        } else {
          ctx.strokeStyle = 'rgba(255,255,255,0.25)';
          ctx.lineWidth = 1;
          ctx.strokeRect(px + 0.5, mid - 5.5, 10, 11);
        }
      }
      const lockRank = UPGRADE_RANKS[lvl - 3];
      const label = cost !== undefined ? `${cost}` : lvl >= u.costs.length ? 'MAX' : `RANK ${lockRank}`;
      const labelCol = cost !== undefined ? (afford ? HUD_AMBER : HUD_RED) : lvl >= u.costs.length ? HUD_GREEN : '#9fb4c0';
      Hud.text(ctx, label, x0 + pw - 14, mid + 5, { size: 14, align: 'right', color: labelCol });
      hits.push({ kind: 'upgrade', i, x: x0, y: ry, w: pw, h: rowH - 6 });
    });
    const by = y + UPGRADES.length * rowH + 8;
    const cs = this.shop.sel === UPGRADES.length;
    ctx.strokeStyle = cs ? HUD_AMBER : HUD_GREEN;
    ctx.lineWidth = cs ? 2 : 1.5;
    ctx.strokeRect(x0 + pw / 2 - 110, by, 220, 34);
    const nextLabel = this.shop.next === 'missions' || this.shop.next === 'contracts' ? 'DONE' : 'CONTINUE TO BRIEFING';
    Hud.text(ctx, nextLabel, w / 2, by + 22, { size: 14, align: 'center', color: cs ? HUD_AMBER : HUD_GREEN });
    hits.push({ kind: 'continue', x: x0 + pw / 2 - 110, y: by, w: 220, h: 34 });
    if (!Input.touchMode) {
      Hud.text(ctx, '↑↓ SELECT   SPACE BUY   ESC CONTINUE', w / 2, Math.min(h - 14, by + 60), { size: 12, align: 'center', color: '#9fb4c0' });
    }
    this.menuHits = hits;
  },

  checkMission() {
    const s = this.mission.status(this);
    if (s === 'won') {
      this.result = 'won';
      const c = this.contract && this.contract.contract;
      // Contracts pay their fee; the daily one pays only on its first clear of the day.
      this.lastPay = c ? (c.kind === 'daily' && Save.daily().done ? 0 : c.pay) : 1000 * ((this.missionIndex % MISSIONS.length) + 1);
      this.score += this.lastPay;
      // Bonus stars: one for beating par time, one for losing less than half your armour.
      const p = this.player;
      this.bonuses = [
        { label: `Under par time (${fmtTime(this.mission.par)})`, got: this.missionTime <= this.mission.par },
        { label: 'Lost less than half your armour', got: this.damageTaken < p.maxHp * 0.5 },
      ];
      for (const b of this.bonuses) if (b.got) this.score += BONUS_STAR;
      this.lastStars = 1 + this.bonuses.filter((b) => b.got).length;
      this.saveBest();
      this.lastEarned = this.score - this.missionStartScore;
      this.rankBefore = Save.contracts().rank;
      if (c) Save.contractCleared(c, this.lastEarned, this.score - this.missionStartScore);
      else Save.cleared(this.missionIndex, this.lastEarned, this.lastStars);
      this.banner(c ? 'CONTRACT COMPLETE' : 'MISSION COMPLETE', HUD_AMBER);
      this.setState('complete');
    } else if (s === 'lost') {
      this.result = 'lost';
      this.setState('failed');
    }
  },

  saveBest() {
    if (this.score <= this.best) return;
    this.best = this.score;
    try {
      localStorage.setItem('chopperGunner.best', String(this.best));
    } catch (e) { /* storage unavailable */ }
  },

  updateWorld(dt) {
    const p = this.player;
    const c = (this.controls = this.readControls(dt));
    if (!p.dead) p.update(dt, this, c);
    if (this.tut && this.state === 'play') this.updateTutorial(dt, c);
    this.lockTarget = p.dead ? null : this.computeLock(c);

    for (const e of this.enemies) {
      if (e.dead) continue;
      const ox = e.x, oy = e.y;
      e.update(dt, this);
      // Measured velocity, smoothed, so the guns can lead a target whatever moves it.
      if (dt > 0) {
        e.mvx = lerp(e.mvx || 0, (e.x - ox) / dt, 0.3);
        e.mvy = lerp(e.mvy || 0, (e.y - oy) / dt, 0.3);
      }
      // Badly damaged units trail smoke, and catch fire when nearly finished.
      const hpf = e.hp / e.maxHp;
      if (hpf < 0.45 && Math.random() < dt * (e.air ? 14 : 7) * (this.lowFx() ? 0.4 : 1)) {
        this.particles.push(new Particle(e.x + rand(-5, 5), e.y + rand(-5, 5), rand(-10, 10), rand(-10, 10), rand(1, 1.8), rand(4, 7), 12, 'smoke'));
        if (hpf < 0.2) this.particles.push(new Particle(e.x + rand(-4, 4), e.y + rand(-4, 4), 0, 0, 0.3, rand(3, 6), 4, 'fire'));
      }
    }
    this.updateDelayed(dt);
    for (const f of this.friendlies) if (!f.dead) f.update(dt, this);
    if (this.state === 'play' && this.mission.update) this.mission.update(this, dt);
    for (const b of this.bullets) b.update(dt);
    for (const b of this.ebullets) b.update(dt);
    for (const m of this.missiles) if (!m.dead) m.update(dt, this);
    for (const f of this.flares) f.update(dt, this);
    for (const pk of this.pickups) pk.update(dt);
    for (const pt of this.particles) pt.update(dt);
    for (const f of this.floaters) { f.t -= dt; f.y -= 30 * dt; }
    for (const b of this.banners) b.t -= dt;
    for (const em of this.emitters) {
      em.life -= dt;
      if (Math.random() < dt * 10 * Math.min(1, em.life / 3)) {
        this.particles.push(new Particle(em.x + rand(-6, 6), em.y + rand(-6, 6), rand(8, 22), rand(-14, -4), rand(1.5, 2.6), rand(5, 9), 12, 'smoke'));
        if (Math.random() < 0.4) this.particles.push(new Particle(em.x + rand(-6, 6), em.y + rand(-6, 6), 0, 0, 0.35, rand(4, 7), 4, 'fire'));
      }
    }

    this.collide();

    this.enemies = this.enemies.filter((e) => !e.dead);
    this.friendlies = this.friendlies.filter((f) => !f.dead || f.keep);
    this.bullets = this.bullets.filter((b) => !b.dead);
    this.ebullets = this.ebullets.filter((b) => !b.dead);
    this.missiles = this.missiles.filter((m) => !m.dead);
    this.flares = this.flares.filter((f) => !f.dead);
    this.pickups = this.pickups.filter((pk) => !pk.dead);
    this.particles = this.particles.filter((pt) => !pt.dead);
    const cap = this.lowFx() ? 600 : 1600;
    if (this.particles.length > cap) this.particles.splice(0, this.particles.length - cap);
    this.floaters = this.floaters.filter((f) => f.t > 0);
    this.emitters = this.emitters.filter((em) => em.life > 0);
    this.banners = this.banners.filter((b) => b.t > 0);
    this.banners.forEach((b, i) => (b.slot = i));

    if (this.state === 'play') this.reinforce(dt);

    // Missile warning: the lock tone speeds up and rises in pitch as the nearest missile closes.
    this.threats = [];
    if (!p.dead) {
      for (const m of this.missiles) {
        if (m.owner === 'e' && m.target === p) {
          const d = dist(m.x, m.y, p.x, p.y);
          if (d < 1400) this.threats.push({ a: Math.atan2(m.y - p.y, m.x - p.x), d });
        }
      }
    }
    const nearest = this.threats.reduce((n, t) => Math.min(n, t.d), Infinity);
    this.missileWarning = nearest < 1000;
    this.warnBeepT -= dt;
    if (this.missileWarning && this.warnBeepT <= 0) {
      const near = 1 - nearest / 1000;
      this.warnBeepT = 0.08 + 0.4 * (1 - near);
      Sfx.lockTone(near);
    }
    for (const hm of this.hitMarks) hm.t -= dt * 1.1;
    this.hitMarks = this.hitMarks.filter((hm) => hm.t > 0).slice(-8);
    this.hurtFlash = Math.max(0, this.hurtFlash - dt * 1.8);
    if (this.state === 'play' && !this.tut) this.missionTime += dt; // training doesn't count against par

    // Camera leads toward where you are aiming and flying.
    if (!p.dead) {
      const lx = clamp((c.aimX - p.x) * 0.25, -140, 140) + p.vx * 0.25;
      const ly = clamp((c.aimY - p.y) * 0.25, -140, 140) + p.vy * 0.25;
      const k = 1 - Math.exp(-4 * dt);
      this.cam.x += (p.x + lx - this.cam.x) * k;
      this.cam.y += (p.y + ly - this.cam.y) * k;
    }
    this.shakeAmt *= Math.exp(-7 * dt);
    this.shakeX = rand(-1, 1) * this.shakeAmt;
    this.shakeY = rand(-1, 1) * this.shakeAmt;

    Sfx.setRotor(!p.dead && this.state !== 'paused', p.turboOn);
  },

  collide() {
    const p = this.player;
    for (const b of this.bullets) {
      if (b.dead) continue;
      for (const e of this.enemies) {
        if (e.dead) continue;
        const rr = e.r + 3;
        if (dist2(b.x, b.y, e.x, e.y) < rr * rr) {
          e.hurt(b.dmg, this);
          b.dead = true;
          this.particles.push(new Particle(b.x, b.y, rand(-80, 80), rand(-80, 80), 0.2, 1, 0, 'spark'));
          this.particles.push(new Particle(b.x, b.y, 0, 0, 0.06, 6, 0, 'muzzle'));
          break;
        }
      }
      if (b.dead) continue;
      for (const m of this.missiles) {
        if (m.owner !== 'e' || m.dead) continue;
        if (dist2(b.x, b.y, m.x, m.y) < 15 * 15) {
          m.dead = true;
          b.dead = true;
          this.explode(m.x, m.y, 12);
          this.addScore(50, m.x, m.y);
          break;
        }
      }
    }

    for (const m of this.missiles) {
      if (m.dead) continue;
      if (m.owner === 'p') {
        for (const e of this.enemies) {
          if (e.dead) continue;
          const rr = e.r + 8;
          if (dist2(m.x, m.y, e.x, e.y) < rr * rr) {
            m.dead = true;
            if (m.cluster) {
              this.clusterBurst(m.x, m.y);
              break;
            }
            this.explode(m.x, m.y, 24);
            e.hurt(m.dmg, this);
            for (const o of this.enemies) {
              if (o !== e && !o.dead && dist2(o.x, o.y, m.x, m.y) < 90 * 90) o.hurt(18, this);
            }
            break;
          }
        }
      } else {
        if (m.target && m.target instanceof Flare && dist2(m.x, m.y, m.target.x, m.target.y) < 22 * 22) {
          m.dead = true;
          this.explode(m.x, m.y, 14);
          continue;
        }
        if (!p.dead && dist2(m.x, m.y, p.x, p.y) < p.r * p.r) {
          m.dead = true;
          this.explode(m.x, m.y, 22);
          p.damage(m.dmg, this, m.angle + Math.PI);
        }
      }
    }

    for (const b of this.ebullets) {
      if (b.dead) continue;
      for (const f of this.friendlies) {
        if (!f.dead && f.solid && dist2(b.x, b.y, f.x, f.y) < f.r * f.r) {
          b.dead = true;
          f.hurt(b.dmg, this);
          this.particles.push(new Particle(b.x, b.y, rand(-60, 60), rand(-60, 60), 0.25, 1, 0, 'spark'));
          break;
        }
      }
    }

    if (!p.dead) {
      const rr = (p.r - 3) * (p.r - 3);
      for (const b of this.ebullets) {
        if (!b.dead && dist2(b.x, b.y, p.x, p.y) < rr) {
          b.dead = true;
          p.damage(b.dmg, this, Math.atan2(-b.vy, -b.vx));
          this.particles.push(new Particle(b.x, b.y, rand(-60, 60), rand(-60, 60), 0.25, 1, 0, 'spark'));
        }
      }
      for (const pk of this.pickups) {
        if (!pk.dead && dist2(pk.x, pk.y, p.x, p.y) < 46 * 46) {
          pk.dead = true;
          Sfx.pickup();
          if (pk.kind === 'repair') { p.hp = Math.min(p.maxHp, p.hp + 30); this.floaters.push({ x: pk.x, y: pk.y, text: 'ARMOR +30', t: 1.2 }); }
          if (pk.kind === 'missiles') { p.missiles = Math.min(p.maxMissiles, p.missiles + 4); this.floaters.push({ x: pk.x, y: pk.y, text: 'MISSILES +4', t: 1.2 }); }
          if (pk.kind === 'flares') { p.flares = Math.min(p.maxFlares, p.flares + 2); this.floaters.push({ x: pk.x, y: pk.y, text: 'FLARES +2', t: 1.2 }); }
          if (pk.kind === 'guns') { p.gunBoostT = 15; this.banner('DOUBLE GUNS', PICKUP_COLORS.guns); }
          if (pk.kind === 'shield') { p.shieldT = 10; this.banner('SHIELD UP', PICKUP_COLORS.shield); }
          if (pk.kind === 'cluster') { p.clusters = Math.min(3, p.clusters + 1); this.banner('CLUSTER BOMB READY', PICKUP_COLORS.cluster); }
        }
      }
    }
  },

  reinforce(dt) {
    const r = this.mission.reinforce;
    if (this.tut) return; // no reinforcements during training
    this.reinforceT -= dt;
    if (this.reinforceT > 0) return;
    this.reinforceT = r.every / Math.sqrt(this.difficulty);
    if (this.enemies.length >= r.cap * Math.sqrt(this.difficulty)) return;
    const type = pick(r.types);
    const p = this.player;
    if (type === 'jet') {
      const a = rand(0, TAU);
      const x = p.x + Math.cos(a) * 1600, y = p.y + Math.sin(a) * 1600;
      this.enemies.push(new Jet(x, y, p.x, p.y, this.difficulty));
      Sfx.jet();
      this.banner('FAST MOVER INBOUND', HUD_RED);
    } else if (type === 'gunship') {
      const a = rand(0, TAU);
      const e = new Gunship(clamp(p.x + Math.cos(a) * 1200, 100, WORLD_W - 100), clamp(p.y + Math.sin(a) * 1200, 100, WORLD_H - 100), this.difficulty);
      e.aware = true;
      this.enemies.push(e);
    } else {
      const pt = this.landPoint(p, 1000, 1500);
      this.enemies.push(this.make(type, pt.x, pt.y));
    }
  },

  // ------------------------------------------------------------ render

  render() {
    const ctx = this.ctx;
    const z = this.zoom, d = this.dpr;
    ctx.setTransform(d, 0, 0, d, 0, 0);
    const cx = this.cam.x + this.shakeX, cy = this.cam.y + this.shakeY;
    const vw = this.w / z, vh = this.h / z;
    const vx0 = cx - vw / 2, vy0 = cy - vh / 2;
    ctx.setTransform(z * d, 0, 0, z * d, (this.w / 2 - cx * z) * d, (this.h / 2 - cy * z) * d);

    const budget = this.state === 'play' || this.state === 'title' ? 3 : 40;
    this.terrain.draw(ctx, vx0 - 10, vy0 - 10, vx0 + vw + 10, vy0 + vh + 10, budget);
    const pad = 80;
    const inView = (o) => o.x > vx0 - pad && o.x < vx0 + vw + pad && o.y > vy0 - pad && o.y < vy0 + vh + pad;

    this.drawBase(ctx);
    if (this.checkpoint) this.drawCheckpoint(ctx);

    for (const f of this.friendlies) if (!f.dead && inView(f)) f.draw(ctx);
    for (const pk of this.pickups) if (inView(pk)) pk.draw(ctx);
    for (const e of this.enemies) if (!e.air && inView(e)) e.draw(ctx);

    for (const e of this.enemies) if (e.air && inView(e)) e.drawShadow(ctx);
    const showPlayer = !this.player.dead && this.state !== 'hangar';
    if (showPlayer) this.player.drawShadow(ctx);

    for (const b of this.ebullets) if (inView(b)) b.draw(ctx);
    for (const b of this.bullets) if (inView(b)) b.draw(ctx);
    for (const m of this.missiles) if (inView(m)) m.draw(ctx);

    for (const e of this.enemies) if (e.air && inView(e)) e.draw(ctx);
    if (showPlayer) this.player.draw(ctx);

    for (const pt of this.particles) if (!pt.additive && inView(pt)) pt.draw(ctx);
    ctx.globalCompositeOperation = 'lighter';
    for (const pt of this.particles) if (pt.additive && inView(pt)) pt.draw(ctx);
    for (const f of this.flares) if (inView(f)) f.draw(ctx);
    ctx.globalCompositeOperation = 'source-over';

    if (this.mission.night && !['title', 'hangar', 'missions', 'contracts'].includes(this.state)) Weather.drawNight(ctx, this);

    for (const f of this.floaters) {
      ctx.globalAlpha = clamp(f.t, 0, 1);
      Hud.text(ctx, f.text, f.x, f.y, { size: 13, align: 'center', color: '#fff3c0' });
    }
    ctx.globalAlpha = 1;

    if (this.state === 'play' && this.lockTarget) {
      Hud.lockBox(ctx, this.lockTarget.x, this.lockTarget.y, this.lockTarget.r, this.time);
    }

    // Screen space
    ctx.setTransform(d, 0, 0, d, 0, 0);
    Weather.draw(ctx, this.w, this.h);
    switch (this.state) {
      case 'title': this.drawTitle(ctx); break;
      case 'hangar': this.drawHangar(ctx); break;
      case 'missions': this.drawMissions(ctx); break;
      case 'workshop': this.drawWorkshop(ctx); break;
      case 'contracts': this.drawContracts(ctx); break;
      case 'settings':
        if (this.prefs.from === 'title') this.dim(ctx, 0.3);
        this.drawSettings(ctx);
        break;
      case 'controls':
        if (this.menu.from === 'title') this.dim(ctx, 0.3);
        this.drawControls(ctx);
        break;
      case 'briefing': this.drawBriefing(ctx); break;
      default:
        Hud.draw(ctx, this);
        if (this.tut && this.state === 'play') this.drawTutorial(ctx);
        if (this.state === 'play' && !Input.touchMode && !this.player.dead) {
          if (this.aimMode === 'keys') {
            const p = this.player;
            const s = this.worldToScreen(p.x + Math.cos(p.angle) * 260, p.y + Math.sin(p.angle) * 260);
            Hud.crosshair(ctx, s.x, s.y, !!this.lockTarget);
          } else Hud.crosshair(ctx, Input.mouse.x, Input.mouse.y, !!this.lockTarget);
        }
        if (this.state === 'paused') this.drawCenterPanel(ctx, 'PAUSED', [`${Input.bindLabel('pause')} or tap to resume`, 'C  controls / key bindings', 'O  settings', `${Input.bindLabel('mute')}  toggles sound`]);
        if (this.state === 'complete') this.drawComplete(ctx);
        if (this.state === 'failed') this.drawFailed(ctx);
    }
    if (this.portrait()) this.drawRotate(ctx);
  },

  drawRotate(ctx) {
    this.dim(ctx, 0.92);
    const w = this.w, h = this.h;
    // A phone outline turning on its side.
    const a = (-Math.PI / 2) * clamp(((this.time * 0.8) % 2) - 0.5, 0, 1);
    ctx.save();
    ctx.translate(w / 2, h * 0.42);
    ctx.rotate(a);
    ctx.strokeStyle = HUD_AMBER;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.roundRect(-28, -48, 56, 96, 9);
    ctx.stroke();
    ctx.restore();
    Hud.text(ctx, 'ROTATE YOUR PHONE', w / 2, h * 0.42 + 90, { size: 20, align: 'center', font: TITLE_FONT, weight: '900', color: HUD_AMBER });
    Hud.text(ctx, 'The game plays in landscape', w / 2, h * 0.42 + 118, { size: 14, align: 'center', color: '#c8d6dc' });
  },

  drawBase(ctx) {
    const { x, y } = this.base;
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(-126, -116, 260, 240);
    ctx.fillStyle = '#7b7f80';
    ctx.fillRect(-130, -120, 260, 240);
    ctx.strokeStyle = '#5d6162';
    ctx.lineWidth = 2;
    for (let i = -130; i <= 130; i += 52) {
      ctx.beginPath(); ctx.moveTo(i, -120); ctx.lineTo(i, 120); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-130, i * 0.92); ctx.lineTo(130, i * 0.92); ctx.stroke();
    }
    // hangar
    ctx.fillStyle = '#4a4f52';
    ctx.fillRect(-120, -112, 90, 60);
    ctx.fillStyle = '#3a3e40';
    for (let i = 0; i < 6; i++) ctx.fillRect(-120, -112 + i * 10, 90, 4);
    ctx.fillStyle = '#5e5a3e';
    ctx.fillRect(60, -108, 50, 26);
    ctx.fillRect(60, -74, 50, 26);
    // pad
    const pulse = this.player.onPad ? 0.6 + 0.4 * Math.sin(this.time * 6) : 1;
    ctx.fillStyle = '#545859';
    ctx.beginPath();
    ctx.arc(0, 10, 70, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = `rgba(255,200,60,${pulse})`;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(0, 10, 62, 0, TAU);
    ctx.stroke();
    ctx.fillStyle = `rgba(240,240,240,${pulse})`;
    ctx.fillRect(-22, -18, 9, 56);
    ctx.fillRect(13, -18, 9, 56);
    ctx.fillRect(-13, 6, 26, 8);
    // corner lights
    const on = Math.floor(this.time * 2) % 2;
    for (const [lx, ly] of [[-126, -116], [126, -116], [-126, 116], [126, 116]]) {
      ctx.fillStyle = on ? '#ff4030' : '#601810';
      ctx.beginPath();
      ctx.arc(lx, ly, 4, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  },

  drawCheckpoint(ctx) {
    const { x, y } = this.checkpoint;
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = '#5a5248';
    ctx.fillRect(-50, -50, 100, 100);
    ctx.fillStyle = '#d8d0b8';
    ctx.fillRect(-46, -46, 30, 24);
    for (let i = 0; i < 8; i++) {
      ctx.fillStyle = i % 2 ? '#d33' : '#eee';
      ctx.fillRect(-40 + i * 10, -4, 10, 8);
    }
    ctx.restore();
  },

  // ------------------------------------------------------------ screens

  dim(ctx, a = 0.6) {
    ctx.fillStyle = `rgba(3,6,10,${a})`;
    ctx.fillRect(0, 0, this.w, this.h);
  },

  drawTitle(ctx) {
    this.dim(ctx, 0.45);
    const w = this.w, h = this.h;
    const small = w < 600;
    const ts = small ? 32 : 64;
    Hud.text(ctx, 'TALON', w / 2, h * 0.3, { size: ts, align: 'center', font: TITLE_FONT, weight: '900', color: '#e9ecef' });
    Hud.text(ctx, 'STRIKE', w / 2, h * 0.3 + ts * 1.05, { size: ts, align: 'center', font: TITLE_FONT, weight: '900', color: HUD_AMBER });
    Hud.text(ctx, 'A SKYWATCH CAMPAIGN', w / 2, h * 0.3 + ts * 1.05 + 34, { size: small ? 13 : 16, align: 'center', color: '#9fb4c0' });

    const lines = Input.touchMode || 'ontouchstart' in window && w < 900
      ? ['LEFT THUMB  move', 'RIGHT THUMB  aim + fire', 'MSL missiles   FLR flares   TRB turbo', 'Hover over the base pad to repair & rearm']
      : [
        `${['up', 'left', 'down', 'right'].map((a) => Input.bindLabel(a)).join('')}  fly     ${Input.bindLabel('turnLeft')} ${Input.bindLabel('turnRight')}  turn (or aim with MOUSE)`,
        `${Input.bindLabel('fire')} / LEFT CLICK  chain guns`,
        `${Input.bindLabel('missile')} / RIGHT CLICK  missiles`,
        `${Input.bindLabel('turbo')}  turbo     ${Input.bindLabel('flare')}  flares     ${Input.bindLabel('pause')}  pause`,
        'Hover over the base pad to repair & rearm',
        'C  change controls     O  settings',
      ];
    let y = h * 0.58;
    for (const l of lines) {
      Hud.text(ctx, l, w / 2, y, { size: small ? 12 : 15, align: 'center', color: '#c8d6dc' });
      y += small ? 20 : 24;
    }
    if (Math.floor(this.time * 2) % 2 === 0) {
      Hud.text(ctx, 'PRESS SPACE / CLICK / TAP TO START', w / 2, h * 0.9, { size: small ? 14 : 18, align: 'center', color: HUD_GREEN });
    }
    if (this.best) Hud.text(ctx, `BEST ${this.best}`, w / 2, h * 0.9 + 28, { size: 13, align: 'center', color: '#9fb4c0' });
  },

  drawHangar(ctx) {
    this.dim(ctx, 0.62);
    const w = this.w, h = this.h;
    const small = w < 600;
    const v = this.vehicle;
    const ids = Object.keys(VEHICLES);
    const list = ids.map((id) => VEHICLES[id]);
    const idx = ids.indexOf(this.pickId());

    Hud.text(ctx, 'SELECT AIRCRAFT', w / 2, Math.max(44, h * 0.09), { size: small ? 20 : 28, align: 'center', font: TITLE_FONT, weight: '900', color: HUD_AMBER });

    // The chosen aircraft, turning slowly on a lit pad.
    const cy = h * (small ? 0.3 : 0.32);
    const sc = clamp(Math.min(w, h * 0.8) / 300, 1.2, 2.6);
    const pr = 46 * sc;
    const pad = ctx.createRadialGradient(w / 2, cy, pr * 0.2, w / 2, cy, pr);
    pad.addColorStop(0, 'rgba(125,255,176,0.14)');
    pad.addColorStop(1, 'rgba(125,255,176,0)');
    ctx.fillStyle = pad;
    ctx.beginPath();
    ctx.arc(w / 2, cy, pr, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = 'rgba(125,255,176,0.35)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(w / 2, cy, pr * 0.92, 0, TAU);
    ctx.stroke();
    const spin = -Math.PI / 2 + Math.sin(this.time * 0.6) * 0.5;
    const rotor = this.time * 30;
    const vs = (sc * 20) / v.r; // fit big and small airframes to the same pad
    const locked = vehicleLocked(v);
    v.draw(ctx, w / 2 + 8 * sc, cy + 10 * sc, spin, rotor, { shadow: true, scale: vs * 0.92 });
    // A locked aircraft shows only as a dark silhouette with a padlock.
    if (locked) {
      this.drawSilhouette(ctx, v, w / 2, cy, pr, spin, rotor, vs);
      this.drawPadlock(ctx, w / 2, cy, 14 * Math.min(sc, 1.8));
    } else v.draw(ctx, w / 2, cy, spin, rotor, { ...v.colors, scale: vs });

    // Arrows either side.
    const ax = Math.min(w * 0.38, 280);
    for (const d of [-1, 1]) {
      const x = w / 2 + d * ax;
      ctx.fillStyle = 'rgba(125,255,176,0.75)';
      ctx.beginPath();
      ctx.moveTo(x + d * 12, cy);
      ctx.lineTo(x - d * 8, cy - 16);
      ctx.lineTo(x - d * 8, cy + 16);
      ctx.closePath();
      ctx.fill();
    }

    let y = cy + pr + (small ? 26 : 34);
    Hud.text(ctx, v.name, w / 2, y, { size: small ? 22 : 30, align: 'center', font: TITLE_FONT, weight: '900', color: locked ? '#6c7780' : '#e9ecef' });
    y += small ? 20 : 24;
    Hud.text(ctx, locked ? `LOCKED \u2022 ${v.role}` : v.role, w / 2, y, { size: small ? 12 : 14, align: 'center', color: locked ? HUD_RED : HUD_AMBER });
    y += small ? 20 : 24;
    ctx.font = `${small ? 12 : 14}px ${FONT}`;
    for (const line of this.wrap(ctx, v.blurb, Math.min(520, w - 40))) {
      Hud.text(ctx, line, w / 2, y, { size: small ? 12 : 14, align: 'center', color: '#c8d6dc' });
      y += small ? 17 : 20;
    }

    // Stat bars, scaled against the best in the fleet.
    const stats = [
      ['ARMOR', (u) => u.hp],
      ['SPEED', (u) => u.speed],
      ['AGILITY', (u) => u.turn],
      ['FIREPOWER', (u) => u.gun.dmg / u.gun.cd],
      ['MISSILES', (u) => u.missiles],
      ['FLARES', (u) => u.flares],
    ];
    const bw = Math.min(220, w * 0.45), bx = w / 2 - bw / 2 + 40;
    y += 12;
    for (const [label, get] of stats) {
      const max = Math.max(...list.map(get));
      Hud.bar(ctx, bx, y, bw, 8, get(v) / max, HUD_GREEN, label);
      y += small ? 16 : 19;
    }

    // Which of the fleet this is.
    y += 10;
    list.forEach((u, i) => {
      ctx.beginPath();
      ctx.arc(w / 2 + (i - (list.length - 1) / 2) * 16, y, i === idx ? 4.5 : 3.5, 0, TAU);
      if (vehicleLocked(u)) {
        ctx.strokeStyle = i === idx ? HUD_RED : 'rgba(255,90,90,0.55)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      } else {
        ctx.fillStyle = i === idx ? HUD_AMBER : 'rgba(255,255,255,0.25)';
        ctx.fill();
      }
    });

    if (locked) {
      Hud.text(ctx, `LOCKED - CLEAR ALL ${MISSIONS.length} MISSIONS TO UNLOCK`, w / 2, y + (small ? 18 : 22), { size: small ? 12 : 15, align: 'center', color: HUD_RED });
      y += small ? 12 : 16;
    }
    const prompt = Input.touchMode
      ? 'TAP THE SIDES TO CHOOSE - TAP THE MIDDLE TO CONTINUE'
      : '\u2190 \u2192 CHOOSE    SPACE / CLICK CONTINUE    ESC BACK';
    if (Math.floor(this.time * 2) % 2 === 0) {
      Hud.text(ctx, prompt, w / 2, Math.min(h - 24, y + (small ? 34 : 44)), { size: small ? 12 : 16, align: 'center', color: HUD_GREEN });
    }
  },

  // Draws an aircraft off-screen and paints it one flat colour, so nothing of its livery,
  // lights or glow shows through.
  drawSilhouette(ctx, v, x, y, r, spin, rotor, scale) {
    const d = this.dpr, size = Math.ceil(r * 2 * d);
    const c = this.silCanvas || (this.silCanvas = document.createElement('canvas'));
    if (c.width !== size) c.width = c.height = size;
    const sx = c.getContext('2d');
    sx.setTransform(1, 0, 0, 1, 0, 0);
    sx.globalCompositeOperation = 'source-over';
    sx.clearRect(0, 0, size, size);
    sx.setTransform(d, 0, 0, d, 0, 0);
    v.draw(sx, r, r, spin, rotor, { ...v.colors, scale });
    sx.setTransform(1, 0, 0, 1, 0, 0);
    sx.globalCompositeOperation = 'source-in';
    sx.fillStyle = '#0b0d0f';
    sx.fillRect(0, 0, size, size);
    ctx.drawImage(c, x - r, y - r, r * 2, r * 2);
  },

  drawPadlock(ctx, x, y, s) {
    ctx.save();
    ctx.translate(x, y);
    ctx.strokeStyle = HUD_RED;
    ctx.lineWidth = s * 0.22;
    ctx.beginPath();
    ctx.arc(0, -s * 0.25, s * 0.42, Math.PI, 0);
    ctx.lineTo(s * 0.42, s * 0.05);
    ctx.moveTo(-s * 0.42, s * 0.05);
    ctx.lineTo(-s * 0.42, -s * 0.25);
    ctx.stroke();
    ctx.fillStyle = HUD_RED;
    ctx.fillRect(-s * 0.7, 0, s * 1.4, s * 1.05);
    ctx.fillStyle = '#0b0d0f';
    ctx.beginPath();
    ctx.arc(0, s * 0.42, s * 0.16, 0, TAU);
    ctx.fill();
    ctx.restore();
  },

  drawBriefing(ctx) {
    this.dim(ctx, 0.72);
    const w = this.w, h = this.h;
    const small = w < 600;
    const pw = Math.min(680, w - 32);
    const x = (w - pw) / 2;
    let y = Math.max(60, h * 0.2);
    const tour = Math.floor(this.missionIndex / MISSIONS.length);
    const c = this.contract && this.contract.contract;
    const head = c ? `SKYWATCH ${c.kind === 'daily' ? 'DAILY ' : ''}CONTRACT - RANK ${c.rank} - ${THEATRE.label}${c.twist ? ' - ' + c.twist.label : ''}`
      : `SKYWATCH SECURE BRIEFING - ${THEATRE.label}${tour ? ' - TOUR ' + (tour + 1) : ''}`;
    Hud.text(ctx, head, x, y, { size: 13, color: c && c.twist ? HUD_RED : '#9fb4c0' });
    y += 34;
    Hud.text(ctx, this.mission.title, x, y, { size: small ? 20 : 30, font: TITLE_FONT, weight: '700', color: HUD_AMBER });
    y += 36;
    // Typewriter reveal
    let chars = Math.floor(this.stateT * 70);
    ctx.font = `${small ? 13 : 16}px ${FONT}`;
    for (const line of this.mission.brief.map((l) => l.replace('{callsign}', this.callsign()))) {
      const wrapped = this.wrap(ctx, line, pw);
      for (const wl of wrapped) {
        if (chars <= 0) break;
        Hud.text(ctx, wl.slice(0, chars), x, y, { size: small ? 13 : 16, color: '#d6e2e8' });
        chars -= wl.length;
        y += small ? 20 : 24;
      }
      y += 8;
    }
    if (this.stateT > 0.5 && Math.floor(this.time * 2) % 2 === 0) {
      Hud.text(ctx, 'PRESS SPACE / TAP TO LAUNCH', w / 2, Math.min(h - 40, y + 40), { size: small ? 14 : 18, align: 'center', color: HUD_GREEN });
    }
  },

  drawControls(ctx) {
    this.dim(ctx, 0.62);
    const m = this.menu;
    const w = this.w, h = this.h;
    const pw = Math.min(560, w - 32);
    const x0 = (w - pw) / 2;
    const rowH = Math.min(30, (h - 190) / (ACTIONS.length + 1));
    let y = Math.max(40, (h - rowH * (ACTIONS.length + 1) - 120) / 2);
    Hud.text(ctx, 'CONTROLS', w / 2, y, { size: 26, align: 'center', font: TITLE_FONT, weight: '900', color: HUD_AMBER });
    y += 30;
    Hud.text(ctx, 'Arrows/WASD select   ENTER rebind   BKSP clear   R reset   ESC back', w / 2, y, { size: 12, align: 'center', color: '#9fb4c0' });
    y += 22;
    const colW = (pw - 200) / 2;
    const hits = [];
    ACTIONS.forEach((a, i) => {
      const ry = y + i * rowH;
      const selRow = m.row === i;
      if (selRow) {
        ctx.fillStyle = 'rgba(125,255,176,0.08)';
        ctx.fillRect(x0, ry, pw, rowH - 2);
      }
      Hud.text(ctx, a.label, x0 + 12, ry + rowH * 0.68, { size: 14, color: selRow ? '#ffffff' : '#c8d6dc' });
      for (let s = 0; s < 2; s++) {
        const bx = x0 + 200 + s * colW, bw = colW - 8;
        const active = selRow && m.slot === s;
        ctx.strokeStyle = active ? HUD_AMBER : 'rgba(255,255,255,0.18)';
        ctx.lineWidth = active ? 2 : 1;
        ctx.strokeRect(bx, ry + 2, bw, rowH - 6);
        const label = active && m.waiting ? (Math.floor(this.time * 3) % 2 ? 'PRESS A KEY' : '') : keyName(Input.binds[a.id][s]);
        Hud.text(ctx, label, bx + bw / 2, ry + rowH * 0.68, { size: 14, align: 'center', color: active ? HUD_AMBER : HUD_GREEN });
        hits.push({ kind: 'slot', row: i, slot: s, x: bx, y: ry + 2, w: bw, h: rowH - 6 });
      }
    });
    const by = y + ACTIONS.length * rowH + 8;
    const resetSel = m.row === ACTIONS.length;
    ctx.strokeStyle = resetSel ? HUD_AMBER : 'rgba(255,255,255,0.3)';
    ctx.lineWidth = resetSel ? 2 : 1;
    ctx.strokeRect(x0, by, 180, 30);
    Hud.text(ctx, 'RESET DEFAULTS', x0 + 90, by + 20, { size: 14, align: 'center', color: resetSel ? HUD_AMBER : '#c8d6dc' });
    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x0 + pw - 120, by, 120, 30);
    Hud.text(ctx, 'BACK', x0 + pw - 60, by + 20, { size: 14, align: 'center', color: '#c8d6dc' });
    hits.push({ kind: 'reset', x: x0, y: by, w: 180, h: 30 }, { kind: 'back', x: x0 + pw - 120, y: by, w: 120, h: 30 });
    if (m.waiting) Hud.text(ctx, 'Press the new key for ' + ACTIONS[m.row].label + '  (ESC cancels)', w / 2, by + 60, { size: 14, align: 'center', color: HUD_AMBER });
    else Hud.text(ctx, 'Mouse aiming always works too: moving the mouse takes over from the turn keys.', w / 2, by + 60, { size: 12, align: 'center', color: '#9fb4c0' });
    this.menuHits = hits;
  },

  wrap(ctx, text, maxW) {
    const words = text.split(' ');
    const out = [];
    let line = '';
    for (const wd of words) {
      const t = line ? line + ' ' + wd : wd;
      if (ctx.measureText(t).width > maxW && line) {
        out.push(line);
        line = wd;
      } else line = t;
    }
    if (line) out.push(line);
    return out;
  },

  drawCenterPanel(ctx, title, lines, color = HUD_AMBER) {
    this.dim(ctx, 0.55);
    const w = this.w, h = this.h;
    const small = w < 600;
    // Long panels start higher so the last line stays on screen.
    const top = Math.max(small ? 40 : 60, Math.min(h * 0.4, h - 64 - lines.length * 24));
    Hud.text(ctx, title, w / 2, top, { size: small ? 26 : 42, align: 'center', font: TITLE_FONT, weight: '900', color });
    let y = top + 44;
    for (const l of lines) {
      Hud.text(ctx, l, w / 2, y, { size: small ? 13 : 16, align: 'center', color: '#d6e2e8' });
      y += 24;
    }
    return y;
  },

  drawComplete(ctx) {
    if (this.stateT < 1) return;
    if (this.contract) return this.drawContractComplete(ctx);
    const last = (this.missionIndex + 1) % MISSIONS.length === 0;
    const lines = [
      starString(this.lastStars) + `   Time ${fmtTime(this.missionTime)}`,
      ...this.bonuses.map((b) => `${b.got ? '★' : '☆'} ${b.label}${b.got ? '  +' + BONUS_STAR : ''}`),
      '',
      `Score ${this.score}   Kills ${this.kills}`, `Earned ${this.lastEarned}   Funds ${Save.data.funds}`, '',
    ];
    if (last) {
      lines.unshift('The militia is finished. Skywatch has a new tour for you.', 'NEW AIRCRAFT IN THE HANGAR: VIPER');
    }
    lines.push('PRESS SPACE / TAP FOR THE WORKSHOP');
    this.drawCenterPanel(ctx, last ? 'CAMPAIGN COMPLETE' : 'MISSION COMPLETE', lines);
  },

  drawFailed(ctx) {
    const title = this.result === 'down' ? `${this.vehicle.name} DOWN` : 'MISSION FAILED';
    const why = this.result === 'down' ? 'Your armor gave out.' : this.mission.failText || 'The objective was lost.';
    const lines = [why, '', 'PRESS SPACE / TAP TO RETRY'];
    if (!Input.touchMode) lines.push(`ESC FOR ${this.contract ? 'THE CONTRACT BOARD' : 'MISSION SELECT'}`);
    const bottom = this.drawCenterPanel(ctx, title, lines, HUD_RED);
    // A button back to the menu, for touch screens with no Esc key.
    this.menuHits = null;
    if (this.stateT < 1.2) return;
    const bw = 220, bx = this.w / 2 - bw / 2, by = Math.min(this.h - 44, bottom + 8);
    ctx.strokeStyle = '#c8d6dc';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(bx, by, bw, 34);
    Hud.text(ctx, this.contract ? 'CONTRACT BOARD' : 'MISSION SELECT', this.w / 2, by + 22, { size: 14, align: 'center', color: '#c8d6dc' });
    this.menuHits = [{ kind: 'back', x: bx, y: by, w: bw, h: 34 }];
  },
};

window.addEventListener('load', () => G.init());
