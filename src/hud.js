'use strict';

const HUD_GREEN = '#7dffb0';
const HUD_AMBER = '#ffc04a';
const HUD_RED = '#ff5a3c';

const Hud = {
  text(ctx, s, x, y, o = {}) {
    ctx.font = `${o.weight || ''} ${o.size || 14}px ${o.font || FONT}`;
    ctx.textAlign = o.align || 'left';
    ctx.textBaseline = o.base || 'alphabetic';
    if (o.shadow !== false) {
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      ctx.fillText(s, x + 1.5, y + 1.5);
    }
    ctx.fillStyle = o.color || HUD_GREEN;
    ctx.fillText(s, x, y);
  },

  bar(ctx, x, y, w, h, frac, color, label) {
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(x - 1, y - 1, w + 2, h + 2);
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w * clamp(frac, 0, 1), h);
    if (label) this.text(ctx, label, x - 8, y + h - 1, { size: 12, align: 'right', color });
  },

  draw(ctx, g) {
    const p = g.player;
    const w = g.w, h = g.h;
    const small = w < 600;
    const safe = g.safe || { l: 0, r: 0, t: 0, b: 0 };

    // --- mission panel and gauges, kept clear of a notch on the left
    ctx.save();
    ctx.translate(safe.l, safe.t);
    let y = 24;
    this.text(ctx, g.mission.title, 16, y, { size: small ? 12 : 14, color: HUD_AMBER });
    y += 20;
    this.text(ctx, g.mission.objective(g), 16, y, { size: small ? 12 : 14 });
    y += 22;

    // --- gauges
    const bx = 70, bw = small ? 110 : 150;
    const hpCol = p.hp > 60 ? HUD_GREEN : p.hp > 30 ? HUD_AMBER : HUD_RED;
    this.bar(ctx, bx, y, bw, 9, p.hp / p.maxHp, hpCol, 'ARMOR');
    y += 17;
    this.bar(ctx, bx, y, bw, 7, p.turbo / 100, '#5ec8ff', 'TURBO');
    y += 15;
    const heatCol = p.overheat ? (Math.floor(g.time * 8) % 2 ? HUD_RED : '#ffffff') : p.heat > 70 ? HUD_AMBER : '#c8d0d0';
    this.bar(ctx, bx, y, bw, 7, p.heat / 100, heatCol, 'GUNS');
    y += 22;
    this.text(ctx, 'MSL', bx - 8, y, { size: 12, align: 'right', color: HUD_AMBER });
    for (let i = 0; i < p.maxMissiles; i++) {
      ctx.fillStyle = i < p.missiles ? HUD_AMBER : 'rgba(255,255,255,0.15)';
      ctx.fillRect(bx + i * 9, y - 10, 5, 11);
    }
    y += 18;
    this.text(ctx, 'FLR', bx - 8, y, { size: 12, align: 'right', color: '#5ec8ff' });
    for (let i = 0; i < p.maxFlares; i++) {
      ctx.fillStyle = i < p.flares ? '#5ec8ff' : 'rgba(255,255,255,0.15)';
      ctx.beginPath();
      ctx.arc(bx + 3 + i * 12, y - 4, 4, 0, TAU);
      ctx.fill();
    }

    // --- active power-ups
    const ups = [];
    if (p.gunBoostT > 0) ups.push([`2X GUNS ${Math.ceil(p.gunBoostT)}`, PICKUP_COLORS.guns]);
    if (p.shieldT > 0) ups.push([`SHIELD ${Math.ceil(p.shieldT)}`, PICKUP_COLORS.shield]);
    if (p.clusters > 0) ups.push([`CLUSTER x${p.clusters}`, PICKUP_COLORS.cluster]);
    let ux = 16;
    y += 20;
    for (const [label, col] of ups) {
      this.text(ctx, label, ux, y, { size: 12, color: col });
      ux += ctx.measureText(label).width + 14;
    }

    ctx.restore();

    // --- score, and the mission clock against par (green while you're still under it)
    // A contract with a hard time limit shows the time left instead, red in the last 30 seconds.
    const lim = g.mission.limit;
    const clock = lim ? `${fmtTime(g.missionTime)} / LIMIT ${fmtTime(lim)}` : `${fmtTime(g.missionTime)} / PAR ${fmtTime(g.mission.par)}`;
    const clockCol = lim && lim - g.missionTime < 30 ? HUD_RED : g.missionTime <= g.mission.par ? HUD_GREEN : '#9fb4c0';
    const rx = w - 78 - safe.r;
    if (small) {
      this.text(ctx, String(g.score).padStart(7, '0'), rx, 162 + safe.t, { size: 16, align: 'center', color: '#ffffff' });
      this.text(ctx, clock, rx, 178 + safe.t, { size: 10, align: 'center', color: clockCol });
    } else {
      this.text(ctx, String(g.score).padStart(7, '0'), w / 2, 28, { size: 22, align: 'center', color: '#ffffff' });
      this.text(ctx, clock, w / 2, 46, { size: 12, align: 'center', color: clockCol });
    }

    // --- boss bar
    const boss = g.enemies.find((e) => e.isBoss && !e.dead && e.aware);
    if (boss) {
      const bw2 = Math.min(360, w - 260);
      const by = small ? 196 : 66;
      this.text(ctx, boss.name, w / 2, by, { size: 12, align: 'center', color: HUD_RED });
      this.bar(ctx, w / 2 - bw2 / 2, by + 6, bw2, 8, boss.hp / boss.maxHp, HUD_RED);
    }

    this.radar(ctx, g, rx, 78 + safe.t, small ? 52 : 64);

    // --- warnings
    let wy = h * 0.28;
    const blink = Math.floor(g.time * 5) % 2 === 0;
    if (g.missileWarning && blink) {
      this.text(ctx, '!! MISSILE WARNING - FLARES !!', w / 2, wy, { size: 18, align: 'center', color: HUD_RED, weight: 'bold' });
    }
    wy += 26;
    if (p.overheat) this.text(ctx, 'GUNS OVERHEATED', w / 2, wy, { size: 15, align: 'center', color: HUD_AMBER });
    wy += 22;
    if (p.onPad && (p.hp < p.maxHp || p.missiles < p.maxMissiles || p.flares < p.maxFlares)) {
      this.text(ctx, 'REPAIRING / REARMING', w / 2, wy, { size: 15, align: 'center', color: HUD_GREEN });
    } else if (p.hp < 35 && !p.dead && blink) {
      this.text(ctx, 'ARMOR CRITICAL - RETURN TO BASE', w / 2, wy, { size: 15, align: 'center', color: HUD_RED });
    }

    for (const b of g.banners) {
      const a = clamp(b.t, 0, 1);
      ctx.globalAlpha = a;
      this.text(ctx, b.text, w / 2, h * 0.42 + b.slot * 30, { size: 22, align: 'center', color: b.color, font: TITLE_FONT, weight: '700' });
      ctx.globalAlpha = 1;
    }

    this.edgeArrows(ctx, g);
    this.threatRing(ctx, g);
    if (Input.touchMode) this.touchControls(ctx, g);
  },

  // Around the aircraft: red arcs on the side the last hits came from, red chevrons pointing
  // at missiles homing in (brighter as they close), and a red edge glow after taking damage.
  threatRing(ctx, g) {
    const p = g.player;
    if (g.hurtFlash > 0) {
      const R = Math.hypot(g.w, g.h) / 2;
      const gr = ctx.createRadialGradient(g.w / 2, g.h / 2, R * 0.55, g.w / 2, g.h / 2, R);
      gr.addColorStop(0, 'rgba(255,40,20,0)');
      gr.addColorStop(1, `rgba(255,40,20,${0.45 * g.hurtFlash})`);
      ctx.fillStyle = gr;
      ctx.fillRect(0, 0, g.w, g.h);
    }
    if (p.dead) return;
    const s = g.worldToScreen(p.x, p.y);
    const r0 = p.r * g.zoom + 22;
    ctx.save();
    ctx.lineCap = 'round';
    for (const hm of g.hitMarks) {
      ctx.strokeStyle = `rgba(255,70,40,${hm.t * 0.9})`;
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(s.x, s.y, r0, hm.a - 0.38, hm.a + 0.38);
      ctx.stroke();
    }
    for (const t of g.threats) {
      const near = clamp(1 - t.d / 1400, 0, 1);
      const rr = r0 + 22;
      ctx.save();
      ctx.translate(s.x + Math.cos(t.a) * rr, s.y + Math.sin(t.a) * rr);
      ctx.rotate(t.a);
      ctx.fillStyle = `rgba(255,${(120 - near * 100) | 0},60,${0.45 + near * 0.55})`;
      const k = 0.8 + near * 0.7;
      ctx.beginPath();
      ctx.moveTo(12 * k, 0); ctx.lineTo(-4 * k, -9 * k); ctx.lineTo(0, 0); ctx.lineTo(-4 * k, 9 * k);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
    if (p.shieldT > 0) {
      ctx.strokeStyle = `rgba(110,200,255,${0.35 + 0.25 * Math.sin(g.time * 8)})`;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(s.x, s.y, p.r * g.zoom * 1.7, 0, TAU);
      ctx.stroke();
    }
    ctx.restore();
  },

  radar(ctx, g, cx, cy, R) {
    const p = g.player;
    const range = 2400;
    const s = R / range;
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, TAU);
    ctx.fillStyle = 'rgba(4,18,10,0.72)';
    ctx.fill();
    ctx.clip();
    ctx.strokeStyle = 'rgba(125,255,176,0.18)';
    ctx.lineWidth = 1;
    for (const rr of [R / 3, (R * 2) / 3]) {
      ctx.beginPath();
      ctx.arc(cx, cy, rr, 0, TAU);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.moveTo(cx - R, cy); ctx.lineTo(cx + R, cy);
    ctx.moveTo(cx, cy - R); ctx.lineTo(cx, cy + R);
    ctx.stroke();
    const sweep = g.time * 2.2;
    const gr = ctx.createLinearGradient(cx, cy, cx + Math.cos(sweep) * R, cy + Math.sin(sweep) * R);
    gr.addColorStop(0, 'rgba(125,255,176,0.0)');
    gr.addColorStop(1, 'rgba(125,255,176,0.45)');
    ctx.strokeStyle = gr;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(sweep) * R, cy + Math.sin(sweep) * R);
    ctx.stroke();

    const dot = (x, y, col, size, square) => {
      const dx = (x - p.x) * s, dy = (y - p.y) * s;
      const d = Math.hypot(dx, dy);
      let px = cx + dx, py = cy + dy;
      if (d > R - 3) {
        px = cx + (dx / d) * (R - 3);
        py = cy + (dy / d) * (R - 3);
      }
      ctx.fillStyle = col;
      if (square) ctx.fillRect(px - size, py - size, size * 2, size * 2);
      else {
        ctx.beginPath();
        ctx.arc(px, py, size, 0, TAU);
        ctx.fill();
      }
    };
    dot(g.base.x, g.base.y, HUD_GREEN, 3.5, true);
    if (g.checkpoint) dot(g.checkpoint.x, g.checkpoint.y, '#ffffff', 3, true);
    for (const e of g.enemies) {
      if (e.dead) continue;
      if (e.objective) {
        if (Math.floor(g.time * 3) % 2) dot(e.x, e.y, HUD_AMBER, 4);
      } else if (dist2(e.x, e.y, p.x, p.y) < range * range) {
        dot(e.x, e.y, e.air ? '#ff9a7a' : HUD_RED, e.air ? 2.5 : 2);
      }
    }
    for (const f of g.friendlies) {
      if (!f.dead) dot(f.x, f.y, f instanceof Survivor ? '#ff8c28' : '#5ec8ff', f instanceof BaseHQ ? 0 : 3);
    }
    for (const m of g.missiles) if (m.owner === 'e') dot(m.x, m.y, '#ffffff', 1.5);
    for (const pk of g.pickups) dot(pk.x, pk.y, '#5ec8ff', 2);
    ctx.restore();

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(p.angle);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(6, 0); ctx.lineTo(-4, -4); ctx.lineTo(-2, 0); ctx.lineTo(-4, 4);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    ctx.strokeStyle = 'rgba(125,255,176,0.6)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, TAU);
    ctx.stroke();
  },

  edgeArrows(ctx, g) {
    const targets = g.enemies.filter((e) => e.objective && !e.dead).map((e) => ({ x: e.x, y: e.y, col: HUD_AMBER }));
    for (const f of g.friendlies) {
      if (f.dead) continue;
      if (f instanceof Survivor) targets.push({ x: f.x, y: f.y, col: '#ff8c28', label: 'CREW' });
      else if (f instanceof AidTruck) targets.push({ x: f.x, y: f.y, col: '#5ec8ff', label: 'AID' });
    }
    const needBase = g.player.hp < 35 || (g.player.missiles === 0 && !g.player.onPad) || g.carrying > 0
      || (g.hq && !g.hq.dead && dist(g.player.x, g.player.y, g.base.x, g.base.y) > 900);
    if (needBase) targets.push({ x: g.base.x, y: g.base.y, col: HUD_GREEN, label: 'BASE' });
    if (g.checkpoint) targets.push({ x: g.checkpoint.x, y: g.checkpoint.y, col: '#ffffff', label: g.checkpointLabel });
    const m = 46;
    for (const t of targets) {
      const s = g.worldToScreen(t.x, t.y);
      if (s.x > m && s.x < g.w - m && s.y > m && s.y < g.h - m) continue;
      const cx = g.w / 2, cy = g.h / 2;
      const dx = s.x - cx, dy = s.y - cy;
      const k = Math.min((g.w / 2 - m) / Math.abs(dx || 1e-6), (g.h / 2 - m) / Math.abs(dy || 1e-6));
      const ax = cx + dx * k, ay = cy + dy * k;
      const a = Math.atan2(dy, dx);
      ctx.save();
      ctx.translate(ax, ay);
      ctx.rotate(a);
      ctx.fillStyle = t.col;
      ctx.globalAlpha = 0.85;
      ctx.beginPath();
      ctx.moveTo(14, 0); ctx.lineTo(-6, -9); ctx.lineTo(-2, 0); ctx.lineTo(-6, 9);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      ctx.globalAlpha = 1;
      const dkm = (dist(g.player.x, g.player.y, t.x, t.y) / 1000).toFixed(1);
      this.text(ctx, (t.label ? t.label + ' ' : '') + dkm + 'km', ax - Math.cos(a) * 26, ay - Math.sin(a) * 22 + 4, { size: 11, align: 'center', color: t.col });
    }
  },

  touchControls(ctx, g) {
    for (const k of ['move', 'aim']) {
      const s = Input.sticks[k];
      if (!s) continue;
      ctx.strokeStyle = 'rgba(255,255,255,0.35)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(s.ox, s.oy, 60, 0, TAU);
      ctx.stroke();
      const st = Input.stick(k);
      ctx.fillStyle = k === 'aim' && st.mag > 0.45 ? 'rgba(255,200,90,0.5)' : 'rgba(255,255,255,0.3)';
      ctx.beginPath();
      ctx.arc(s.ox + st.x * 60, s.oy + st.y * 60, 24, 0, TAU);
      ctx.fill();
    }
    const safe = g.safe || { l: 0, r: 0, b: 0 };
    if (!Input.sticks.move) this.text(ctx, 'MOVE', 70 + safe.l, g.h - 60 - safe.b, { size: 12, align: 'center', color: 'rgba(255,255,255,0.35)', shadow: false });
    const aimX = g.h < 520 ? g.w * 0.64 : g.w - 160 - safe.r; // clear of the corner buttons on short screens
    if (!Input.sticks.aim) this.text(ctx, 'AIM + FIRE', aimX, g.h - 60 - safe.b, { size: 12, align: 'center', color: 'rgba(255,255,255,0.35)', shadow: false });
    for (const b of Input.btnLayout) {
      const held = Input.buttons[b.id] !== undefined;
      ctx.fillStyle = held ? 'rgba(255,192,74,0.45)' : 'rgba(0,0,0,0.35)';
      ctx.strokeStyle = 'rgba(255,255,255,0.45)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, TAU);
      ctx.fill();
      ctx.stroke();
      this.text(ctx, b.label, b.x, b.y + 5, { size: 13, align: 'center', color: '#ffffff', shadow: false });
    }
  },

  crosshair(ctx, x, y, locked) {
    ctx.strokeStyle = locked ? HUD_AMBER : 'rgba(125,255,176,0.9)';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(x, y, 10, 0, TAU);
    ctx.moveTo(x - 18, y); ctx.lineTo(x - 6, y);
    ctx.moveTo(x + 6, y); ctx.lineTo(x + 18, y);
    ctx.moveTo(x, y - 18); ctx.lineTo(x, y - 6);
    ctx.moveTo(x, y + 6); ctx.lineTo(x, y + 18);
    ctx.stroke();
  },

  lockBox(ctx, x, y, r, t) {
    const s = r + 10 + Math.sin(t * 10) * 2;
    const c = s * 0.45;
    ctx.strokeStyle = HUD_AMBER;
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      ctx.moveTo(x + sx * s, y + sy * (s - c));
      ctx.lineTo(x + sx * s, y + sy * s);
      ctx.lineTo(x + sx * (s - c), y + sy * s);
    }
    ctx.stroke();
  },
};
