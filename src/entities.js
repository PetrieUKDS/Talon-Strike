'use strict';

// ---------------------------------------------------------------- drawing

// Light falls from the top-left of the screen, matching the shadows cast down-right.
const LIGHT = -Math.PI * 0.75;

// Mix a #rrggbb colour toward white (amt > 0) or black (amt < 0).
function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const t = amt < 0 ? 0 : 255, p = Math.abs(amt);
  const ch = (v) => Math.round(v + (t - v) * p);
  return '#' + ((1 << 24) | (ch(n >> 16) << 16) | (ch((n >> 8) & 255) << 8) | ch(n & 255)).toString(16).slice(1);
}

// Gradient for a sprite part, lit from the world light whichever way the sprite faces.
// angle is the sprite's world rotation; r is roughly the part's half-size.
function litFill(ctx, angle, r, base, flash) {
  if (flash) return '#ffffff';
  const a = LIGHT - angle, lx = Math.cos(a) * r, ly = Math.sin(a) * r;
  const g = ctx.createLinearGradient(lx, ly, -lx, -ly);
  g.addColorStop(0, shade(base, 0.3));
  g.addColorStop(0.5, base);
  g.addColorStop(1, shade(base, -0.45));
  return g;
}

function glassFill(ctx, angle, r, base) {
  const a = LIGHT - angle, lx = Math.cos(a) * r, ly = Math.sin(a) * r;
  const g = ctx.createLinearGradient(lx, ly, -lx, -ly);
  g.addColorStop(0, shade(base, 0.45));
  g.addColorStop(0.4, base);
  g.addColorStop(1, shade(base, -0.6));
  return g;
}

const OUTLINE = 'rgba(0,0,0,0.5)';

function outlinePath(ctx) {
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 0.8;
  ctx.stroke();
}

// Helicopter seen from above, nose pointing along +x.
// o: { body, dark, accent, glass, scale, shadow, flash, turbo }
function drawChopper(ctx, x, y, angle, rotor, o) {
  const s = o.scale || 1;
  const shadow = !!o.shadow, f = !!o.flash;
  const sil = 'rgba(0,0,0,0.22)';
  const lit = (r, c) => (shadow ? sil : litFill(ctx, angle, r, c, f));
  const solid = (c) => (shadow ? sil : f ? '#ffffff' : c);
  const outline = () => {
    if (!shadow) outlinePath(ctx);
  };
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.scale(s, s);

  // Tail boom, tapering to the fin.
  ctx.fillStyle = lit(5, o.body);
  ctx.beginPath();
  ctx.moveTo(-6, -4.5); ctx.lineTo(-44, -1.8); ctx.lineTo(-44, 1.8); ctx.lineTo(-6, 4.5);
  ctx.closePath();
  ctx.fill();
  outline();
  // Horizontal stabiliser with end plates.
  ctx.fillStyle = lit(10, o.body);
  ctx.beginPath();
  ctx.roundRect(-37, -10, 6, 20, 1.5);
  ctx.fill();
  outline();
  ctx.fillStyle = solid(o.dark);
  ctx.fillRect(-38, -11, 8, 2.2);
  ctx.fillRect(-38, 8.8, 8, 2.2);
  // Fin.
  ctx.beginPath();
  ctx.moveTo(-41, -2); ctx.lineTo(-49, -3); ctx.lineTo(-50, 3); ctx.lineTo(-41, 2);
  ctx.closePath();
  ctx.fill();

  // Stub wings.
  ctx.fillStyle = lit(20, o.body);
  ctx.beginPath();
  ctx.moveTo(-4, -20); ctx.lineTo(4, -20); ctx.lineTo(7, -6); ctx.lineTo(7, 6);
  ctx.lineTo(4, 20); ctx.lineTo(-4, 20); ctx.lineTo(-6, 6); ctx.lineTo(-6, -6);
  ctx.closePath();
  ctx.fill();
  outline();
  // Gun pods on the wingtips.
  for (const side of [-1, 1]) {
    ctx.fillStyle = lit(4, o.dark);
    ctx.beginPath();
    ctx.roundRect(-9, side * 19.5 - 3.5, 22, 7, 3.5);
    ctx.fill();
    outline();
  }

  // Fuselage.
  ctx.fillStyle = lit(11, o.body);
  ctx.beginPath();
  ctx.moveTo(28, 0);
  ctx.quadraticCurveTo(24, -10, 8, -11);
  ctx.lineTo(-10, -9);
  ctx.quadraticCurveTo(-17, 0, -10, 9);
  ctx.lineTo(8, 11);
  ctx.quadraticCurveTo(24, 10, 28, 0);
  ctx.fill();
  outline();

  if (!shadow) {
    // Gun barrels.
    ctx.strokeStyle = '#8a8f96';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(13, -19.5); ctx.lineTo(24, -19.5);
    ctx.moveTo(13, 19.5); ctx.lineTo(24, 19.5);
    ctx.stroke();

    // Panel lines.
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    ctx.moveTo(-2, -10); ctx.lineTo(-2, 10);
    ctx.moveTo(-26, -2.9); ctx.lineTo(-26, 2.9);
    ctx.stroke();

    // Livery: pale belly showing along the flanks.
    ctx.strokeStyle = f ? '#ffffff' : o.accent;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(25, -4);
    ctx.quadraticCurveTo(15, -10.5, -9, -8.6);
    ctx.moveTo(25, 4);
    ctx.quadraticCurveTo(15, 10.5, -9, 8.6);
    ctx.stroke();

    // Engine nacelles with intakes and exhausts.
    for (const side of [-1, 1]) {
      ctx.fillStyle = litFill(ctx, angle, 3, o.dark, f);
      ctx.beginPath();
      ctx.roundRect(-13, side * 6 - 2.5, 15, 5, 2.5);
      ctx.fill();
      ctx.fillStyle = '#0b0c0e';
      ctx.beginPath();
      ctx.ellipse(1.5, side * 6, 1.2, 2, 0, 0, TAU);
      ctx.ellipse(-13, side * 6, 1.6, 2.2, 0, 0, TAU);
      ctx.fill();
    }
    if (o.turbo) {
      const gr = ctx.createRadialGradient(-17, 0, 0, -17, 0, 24);
      gr.addColorStop(0, 'rgba(255,230,160,0.95)');
      gr.addColorStop(0.35, 'rgba(255,130,40,0.6)');
      gr.addColorStop(1, 'rgba(255,60,0,0)');
      ctx.fillStyle = gr;
      ctx.beginPath();
      ctx.arc(-20, 0, 24, 0, TAU);
      ctx.fill();
    }

    // Chin gun.
    ctx.fillStyle = '#2a2d31';
    ctx.beginPath();
    ctx.arc(24.5, 0, 2.6, 0, TAU);
    ctx.fill();
    ctx.fillRect(25, -0.7, 6, 1.4);

    // Tandem cockpit: gunner in front, pilot behind.
    ctx.fillStyle = f ? '#ffffff' : shade(o.dark, -0.3);
    ctx.beginPath();
    ctx.ellipse(15, 0, 10, 6.5, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = glassFill(ctx, angle, 6, o.glass || '#22445c');
    ctx.beginPath();
    ctx.ellipse(19.5, 0, 4.6, 4.6, 0, 0, TAU);
    ctx.ellipse(10.5, 0, 4.4, 5.3, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.beginPath();
    ctx.ellipse(20.5, -2, 2.4, 1.1, -0.4, 0, TAU);
    ctx.ellipse(11.5, -2.6, 2.4, 1.1, -0.3, 0, TAU);
    ctx.fill();

    // Navigation lights: red to port, green to starboard, and a flashing tail beacon.
    ctx.fillStyle = '#ff3b30';
    ctx.beginPath();
    ctx.arc(2, -23.4, 1.3, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#34d36a';
    ctx.beginPath();
    ctx.arc(2, 23.4, 1.3, 0, TAU);
    ctx.fill();
    if (Math.sin(rotor * 0.3) > 0.6) {
      const gl = ctx.createRadialGradient(-45, 0, 0, -45, 0, 6);
      gl.addColorStop(0, 'rgba(255,90,70,0.9)');
      gl.addColorStop(1, 'rgba(255,60,40,0)');
      ctx.fillStyle = gl;
      ctx.beginPath();
      ctx.arc(-45, 0, 6, 0, TAU);
      ctx.fill();
    }

    // Tail rotor, seen edge-on.
    ctx.strokeStyle = `rgba(220,220,220,${0.25 + 0.3 * Math.abs(Math.sin(rotor * 2))})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-52, 4.5);
    ctx.lineTo(-38, 4.5);
    ctx.stroke();
  }

  ctx.translate(2, 0);
  drawRotor(ctx, 38, 4, rotor, shadow);
  ctx.restore();
}

// Main rotor around the current origin: a motion-blurred disc, trailing ghost blades,
// then the blades themselves with painted tips.
function drawRotor(ctx, R, blades, rotor, shadow) {
  ctx.save();
  if (!shadow) {
    const disc = ctx.createRadialGradient(0, 0, 4, 0, 0, R);
    disc.addColorStop(0, 'rgba(180,190,200,0.03)');
    disc.addColorStop(0.85, 'rgba(180,190,200,0.10)');
    disc.addColorStop(1, 'rgba(210,215,220,0.2)');
    ctx.fillStyle = disc;
    ctx.beginPath();
    ctx.arc(0, 0, R, 0, TAU);
    ctx.fill();
  }
  ctx.lineCap = 'round';
  ctx.lineWidth = 3.2;
  ctx.strokeStyle = shadow ? 'rgba(0,0,0,0.16)' : 'rgba(25,27,30,0.6)';
  for (let k = 0; k < 3; k++) {
    const a0 = rotor - k * 0.13;
    ctx.globalAlpha = 1 - k * 0.32;
    ctx.beginPath();
    for (let b = 0; b < blades; b++) {
      const a = a0 + (b * TAU) / blades;
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(a) * R, Math.sin(a) * R);
    }
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  if (!shadow) {
    // Painted blade tips.
    ctx.strokeStyle = 'rgba(230,200,70,0.85)';
    ctx.beginPath();
    for (let b = 0; b < blades; b++) {
      const a = rotor + (b * TAU) / blades;
      ctx.moveTo(Math.cos(a) * R * 0.86, Math.sin(a) * R * 0.86);
      ctx.lineTo(Math.cos(a) * R, Math.sin(a) * R);
    }
    ctx.stroke();
    ctx.fillStyle = '#3d4146';
    ctx.beginPath();
    ctx.arc(0, 0, 4, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#8a9096';
    ctx.beginPath();
    ctx.arc(-0.8, -0.8, 1.6, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

// Light scout helicopter: slim body, bubble canopy, skids and a shrouded tail rotor.
function drawScout(ctx, x, y, angle, rotor, o) {
  const s = o.scale || 1;
  const shadow = !!o.shadow, f = !!o.flash;
  const sil = 'rgba(0,0,0,0.22)';
  const lit = (r, c) => (shadow ? sil : litFill(ctx, angle, r, c, f));
  const outline = () => {
    if (!shadow) outlinePath(ctx);
  };
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.scale(s, s);

  // Skids and cross tubes.
  ctx.strokeStyle = shadow ? sil : f ? '#ffffff' : '#2a2d31';
  ctx.lineWidth = 1.6;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-10, -9.5); ctx.lineTo(17, -9.5);
  ctx.moveTo(-10, 9.5); ctx.lineTo(17, 9.5);
  ctx.moveTo(-4, -9.5); ctx.lineTo(-4, 9.5);
  ctx.moveTo(9, -9.5); ctx.lineTo(9, 9.5);
  ctx.stroke();

  // Tail boom with a small stabiliser.
  ctx.fillStyle = lit(4, o.body);
  ctx.beginPath();
  ctx.moveTo(-6, -2.8); ctx.lineTo(-37, -1.3); ctx.lineTo(-37, 1.3); ctx.lineTo(-6, 2.8);
  ctx.closePath();
  ctx.fill();
  outline();
  ctx.beginPath();
  ctx.roundRect(-30, -6.5, 4, 13, 1.5);
  ctx.fill();
  outline();
  // Shrouded tail rotor.
  ctx.fillStyle = lit(5, o.dark);
  ctx.beginPath();
  ctx.arc(-40, 0, 4.6, 0, TAU);
  ctx.fill();
  outline();

  // Gun pods slung on the skid mounts.
  for (const side of [-1, 1]) {
    ctx.fillStyle = lit(2, o.dark);
    ctx.beginPath();
    ctx.roundRect(3, side * 8 - 1.8, 14, 3.6, 1.8);
    ctx.fill();
    outline();
  }

  // Teardrop body.
  ctx.fillStyle = lit(9, o.body);
  ctx.beginPath();
  ctx.moveTo(22, 0);
  ctx.quadraticCurveTo(20, -9, 6, -9);
  ctx.lineTo(-6, -7);
  ctx.quadraticCurveTo(-11, 0, -6, 7);
  ctx.lineTo(6, 9);
  ctx.quadraticCurveTo(20, 9, 22, 0);
  ctx.fill();
  outline();

  if (!shadow) {
    ctx.strokeStyle = '#8a8f96';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(16, -8); ctx.lineTo(22, -8);
    ctx.moveTo(16, 8); ctx.lineTo(22, 8);
    ctx.stroke();

    // Livery band on the boom and the engine housing behind the cabin.
    ctx.fillStyle = f ? '#ffffff' : o.accent;
    ctx.fillRect(-25, -2.1, 4, 4.2);
    ctx.fillStyle = litFill(ctx, angle, 4, o.dark, f);
    ctx.beginPath();
    ctx.roundRect(-8, -3.5, 9, 7, 2.5);
    ctx.fill();
    ctx.fillStyle = '#0b0c0e';
    ctx.beginPath();
    ctx.ellipse(-8.5, 0, 1.5, 2.4, 0, 0, TAU);
    ctx.fill();
    if (o.turbo) {
      const gr = ctx.createRadialGradient(-11, 0, 0, -11, 0, 16);
      gr.addColorStop(0, 'rgba(255,230,160,0.95)');
      gr.addColorStop(0.35, 'rgba(255,130,40,0.6)');
      gr.addColorStop(1, 'rgba(255,60,0,0)');
      ctx.fillStyle = gr;
      ctx.beginPath();
      ctx.arc(-13, 0, 16, 0, TAU);
      ctx.fill();
    }

    // Big bubble canopy with a centre frame.
    ctx.fillStyle = glassFill(ctx, angle, 7, o.glass);
    ctx.beginPath();
    ctx.ellipse(11, 0, 9, 7, 0, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = f ? '#ffffff' : shade(o.dark, -0.2);
    ctx.lineWidth = 0.9;
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(8, -6.6); ctx.lineTo(8, 6.6);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.beginPath();
    ctx.ellipse(13.5, -3, 3.4, 1.4, -0.4, 0, TAU);
    ctx.fill();

    // Navigation lights and the tail rotor's spinning blades.
    ctx.fillStyle = '#ff3b30';
    ctx.beginPath();
    ctx.arc(17, -9.5, 1.1, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#34d36a';
    ctx.beginPath();
    ctx.arc(17, 9.5, 1.1, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = 'rgba(220,220,220,0.5)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    const ta = rotor * 3;
    ctx.moveTo(-40 - Math.cos(ta) * 3.2, -Math.sin(ta) * 3.2);
    ctx.lineTo(-40 + Math.cos(ta) * 3.2, Math.sin(ta) * 3.2);
    ctx.stroke();
  }

  ctx.translate(3, 0);
  drawRotor(ctx, 32, 3, rotor, shadow);
  ctx.restore();
}

// Compound jet-copter: dart fuselage, swept wings carrying two ducted lift fans,
// a jet nozzle at the tail and a nose-mounted laser. No main rotor.
function drawViper(ctx, x, y, angle, rotor, o) {
  const s = o.scale || 1;
  const shadow = !!o.shadow, f = !!o.flash;
  const sil = 'rgba(0,0,0,0.22)';
  const lit = (r, c) => (shadow ? sil : litFill(ctx, angle, r, c, f));
  const outline = () => {
    if (!shadow) outlinePath(ctx);
  };
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.scale(s, s);

  // Swept wings.
  ctx.fillStyle = lit(14, o.dark);
  ctx.beginPath();
  ctx.moveTo(8, -4); ctx.lineTo(-8, -26); ctx.lineTo(-16, -26); ctx.lineTo(-10, -4);
  ctx.lineTo(-10, 4); ctx.lineTo(-16, 26); ctx.lineTo(-8, 26); ctx.lineTo(8, 4);
  ctx.closePath();
  ctx.fill();
  outline();

  // Ducted fans in the wing roots: a ring, and spinning blades inside.
  for (const side of [-1, 1]) {
    const fy = side * 18;
    ctx.fillStyle = lit(9, o.body);
    ctx.beginPath();
    ctx.arc(-6, fy, 9.5, 0, TAU);
    ctx.fill();
    outline();
    ctx.fillStyle = shadow ? sil : '#0d0f12';
    ctx.beginPath();
    ctx.arc(-6, fy, 7.2, 0, TAU);
    ctx.fill();
    if (!shadow) {
      ctx.strokeStyle = 'rgba(190,200,210,0.55)';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      for (let b = 0; b < 5; b++) {
        const a = rotor * 1.6 * side + (b * TAU) / 5;
        ctx.moveTo(-6, fy);
        ctx.lineTo(-6 + Math.cos(a) * 6.6, fy + Math.sin(a) * 6.6);
      }
      ctx.stroke();
      ctx.fillStyle = f ? '#ffffff' : o.accent;
      ctx.beginPath();
      ctx.arc(-6, fy, 1.8, 0, TAU);
      ctx.fill();
    }
  }

  // Tail fins and jet nozzle.
  ctx.fillStyle = lit(6, o.dark);
  ctx.beginPath();
  ctx.moveTo(-22, -2); ctx.lineTo(-32, -11); ctx.lineTo(-35, -11); ctx.lineTo(-30, -2);
  ctx.lineTo(-30, 2); ctx.lineTo(-35, 11); ctx.lineTo(-32, 11); ctx.lineTo(-22, 2);
  ctx.closePath();
  ctx.fill();
  outline();
  if (!shadow) {
    const glow = o.turbo ? 22 : 9;
    const gr = ctx.createRadialGradient(-34, 0, 0, -34, 0, glow);
    gr.addColorStop(0, 'rgba(170,240,255,0.95)');
    gr.addColorStop(0.4, o.turbo ? 'rgba(80,170,255,0.7)' : 'rgba(80,170,255,0.4)');
    gr.addColorStop(1, 'rgba(40,80,255,0)');
    ctx.fillStyle = gr;
    ctx.beginPath();
    ctx.arc(-36, 0, glow, 0, TAU);
    ctx.fill();
  }

  // Dart fuselage.
  ctx.fillStyle = lit(8, o.body);
  ctx.beginPath();
  ctx.moveTo(30, 0);
  ctx.quadraticCurveTo(16, -6.5, 0, -6);
  ctx.lineTo(-32, -3.4);
  ctx.lineTo(-32, 3.4);
  ctx.lineTo(0, 6);
  ctx.quadraticCurveTo(16, 6.5, 30, 0);
  ctx.fill();
  outline();

  if (!shadow) {
    // Spine stripe, laser emitter and canopy.
    ctx.fillStyle = f ? '#ffffff' : o.accent;
    ctx.fillRect(-26, -1, 22, 2);
    ctx.fillStyle = '#9ff0ff';
    ctx.beginPath();
    ctx.arc(30.5, 0, 1.6, 0, TAU);
    ctx.fill();
    ctx.fillStyle = glassFill(ctx, angle, 6, o.glass);
    ctx.beginPath();
    ctx.ellipse(13, 0, 8, 3.8, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.beginPath();
    ctx.ellipse(15, -1.5, 3, 1, -0.3, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#ff3b30';
    ctx.beginPath();
    ctx.arc(-14, -25.5, 1.1, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#34d36a';
    ctx.beginPath();
    ctx.arc(-14, 25.5, 1.1, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

// Heavy tandem-rotor gunship: long armoured hull, stub wings with gun pods, two rotors.
function drawHeavy(ctx, x, y, angle, rotor, o) {
  const s = o.scale || 1;
  const shadow = !!o.shadow, f = !!o.flash;
  const sil = 'rgba(0,0,0,0.22)';
  const lit = (r, c) => (shadow ? sil : litFill(ctx, angle, r, c, f));
  const outline = () => {
    if (!shadow) outlinePath(ctx);
  };
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.scale(s, s);

  // Stub wings with a gun pod and a missile rail on each side.
  ctx.fillStyle = lit(26, o.body);
  ctx.beginPath();
  ctx.moveTo(-6, -27); ctx.lineTo(6, -27); ctx.lineTo(9, -10); ctx.lineTo(9, 10);
  ctx.lineTo(6, 27); ctx.lineTo(-6, 27); ctx.lineTo(-8, 10); ctx.lineTo(-8, -10);
  ctx.closePath();
  ctx.fill();
  outline();
  for (const side of [-1, 1]) {
    ctx.fillStyle = lit(4, o.dark);
    ctx.beginPath();
    ctx.roundRect(-10, side * 24 - 3.8, 25, 7.6, 3.8);
    ctx.fill();
    outline();
    ctx.fillStyle = shadow ? sil : f ? '#ffffff' : '#d8d4c8';
    ctx.beginPath();
    ctx.roundRect(-6, side * 16 - 1.4, 16, 2.8, 1.4);
    ctx.fill();
  }

  // Engine nacelles on the rear flanks.
  for (const side of [-1, 1]) {
    ctx.fillStyle = lit(4, o.dark);
    ctx.beginPath();
    ctx.roundRect(-34, side * 13 - 3.5, 20, 7, 3.5);
    ctx.fill();
    outline();
  }

  // Hull.
  ctx.fillStyle = lit(12, o.body);
  ctx.beginPath();
  ctx.moveTo(38, -5); ctx.quadraticCurveTo(38, -10, 30, -10.5);
  ctx.lineTo(-34, -10); ctx.quadraticCurveTo(-40, -10, -40, -4);
  ctx.lineTo(-40, 4); ctx.quadraticCurveTo(-40, 10, -34, 10);
  ctx.lineTo(30, 10.5); ctx.quadraticCurveTo(38, 10, 38, 5);
  ctx.closePath();
  ctx.fill();
  outline();

  if (!shadow) {
    ctx.strokeStyle = '#8a8f96';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(15, -24); ctx.lineTo(30, -24);
    ctx.moveTo(15, 24); ctx.lineTo(30, 24);
    ctx.stroke();
    ctx.fillStyle = '#b8342a';
    ctx.fillRect(9.5, -17.4, 2, 2.8);
    ctx.fillRect(9.5, 14.6, 2, 2.8);

    // Rotor pylons, a spine stripe and armour panel lines.
    ctx.fillStyle = f ? '#ffffff' : o.accent;
    ctx.fillRect(-22, -1.2, 36, 2.4);
    for (const px of [24, -28]) {
      ctx.fillStyle = litFill(ctx, angle, 6, o.dark, f);
      ctx.beginPath();
      ctx.roundRect(px - 7, -6, 14, 12, 4);
      ctx.fill();
      outlinePath(ctx);
    }
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    for (const lx of [-12, 2, 14]) {
      ctx.moveTo(lx, -10); ctx.lineTo(lx, 10);
    }
    ctx.stroke();
    for (const side of [-1, 1]) {
      ctx.fillStyle = '#0b0c0e';
      ctx.beginPath();
      ctx.ellipse(-34, side * 13, 1.6, 2.6, 0, 0, TAU);
      ctx.fill();
    }
    if (o.turbo) {
      const gr = ctx.createRadialGradient(-38, 0, 0, -38, 0, 26);
      gr.addColorStop(0, 'rgba(255,230,160,0.95)');
      gr.addColorStop(0.35, 'rgba(255,130,40,0.6)');
      gr.addColorStop(1, 'rgba(255,60,0,0)');
      ctx.fillStyle = gr;
      ctx.beginPath();
      ctx.arc(-40, 0, 26, 0, TAU);
      ctx.fill();
    }

    // Wide cockpit glazing across the nose.
    ctx.fillStyle = glassFill(ctx, angle, 8, o.glass);
    ctx.beginPath();
    ctx.moveTo(36.5, -4.5); ctx.quadraticCurveTo(36, -8.5, 31, -8.5);
    ctx.lineTo(31, 8.5); ctx.quadraticCurveTo(36, 8.5, 36.5, 4.5);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = f ? '#ffffff' : shade(o.dark, -0.3);
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    ctx.moveTo(31, -3); ctx.lineTo(37, -3);
    ctx.moveTo(31, 3); ctx.lineTo(37, 3);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.fillRect(32.5, -7, 2.5, 3);

    ctx.fillStyle = '#ff3b30';
    ctx.beginPath();
    ctx.arc(0, -27.6, 1.4, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#34d36a';
    ctx.beginPath();
    ctx.arc(0, 27.6, 1.4, 0, TAU);
    ctx.fill();
  }

  // Counter-rotating rotors fore and aft.
  ctx.translate(24, 0);
  drawRotor(ctx, 30, 3, rotor, shadow);
  ctx.translate(-52, 0);
  drawRotor(ctx, 30, 3, -rotor + 0.5, shadow);
  ctx.restore();
}

function drawJetShape(ctx, x, y, angle, o) {
  const shadow = !!o.shadow, f = !!o.flash;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.scale(o.scale || 1, o.scale || 1);
  if (!shadow) {
    const r = 15 + Math.random() * 4;
    const gr = ctx.createRadialGradient(-30, 0, 0, -30, 0, r);
    gr.addColorStop(0, 'rgba(255,240,200,0.95)');
    gr.addColorStop(0.4, 'rgba(255,150,50,0.7)');
    gr.addColorStop(1, 'rgba(255,90,0,0)');
    ctx.fillStyle = gr;
    ctx.beginPath();
    ctx.arc(-32, 0, r, 0, TAU);
    ctx.fill();
  }

  // Swept wings and tailplanes.
  ctx.fillStyle = shadow ? 'rgba(0,0,0,0.2)' : litFill(ctx, angle, 25, o.body, f);
  ctx.beginPath();
  const pts = [[34, 0], [6, -5], [-12, -25], [-17, -6], [-25, -12], [-28, -3], [-28, 3], [-25, 12], [-17, 6], [-12, 25], [6, 5]];
  pts.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)));
  ctx.closePath();
  ctx.fill();
  if (!shadow) {
    outlinePath(ctx);

    // Fuselage spine.
    ctx.fillStyle = litFill(ctx, angle, 5, o.body, f);
    ctx.beginPath();
    ctx.ellipse(2, 0, 30, 4.6, 0, 0, TAU);
    ctx.fill();
    outlinePath(ctx);
    // Intakes and twin tail fins.
    ctx.fillStyle = '#1b1f22';
    ctx.fillRect(-2, -6.2, 9, 1.8);
    ctx.fillRect(-2, 4.4, 9, 1.8);
    ctx.strokeStyle = f ? '#ffffff' : shade(o.body, -0.5);
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(-17, -4); ctx.lineTo(-26, -7);
    ctx.moveTo(-17, 4); ctx.lineTo(-26, 7);
    ctx.stroke();

    // Canopy.
    ctx.fillStyle = glassFill(ctx, angle, 4, '#3d5566');
    ctx.beginPath();
    ctx.ellipse(15, 0, 7, 3, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.beginPath();
    ctx.ellipse(16.5, -1.1, 3, 0.9, -0.2, 0, TAU);
    ctx.fill();

    // Wing roundels.
    for (const side of [-1, 1]) {
      ctx.fillStyle = '#e8e4d8';
      ctx.beginPath();
      ctx.arc(-11, side * 16, 3.2, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#b8342a';
      ctx.beginPath();
      ctx.arc(-11, side * 16, 1.9, 0, TAU);
      ctx.fill();
    }
  }
  ctx.restore();
}

// Ground vehicles cast a soft shadow down-right of their footprint.
function groundShadow(ctx, x, y, w, h, r) {
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  ctx.beginPath();
  ctx.roundRect(x + 3, y + 4, w, h, r);
  ctx.fill();
}

function drawWheel(ctx, x, y, w, h) {
  ctx.fillStyle = '#141414';
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, Math.min(w, h) / 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  ctx.fillRect(x + 1, y + 0.5, w - 2, 0.8);
}

// ---------------------------------------------------------------- projectiles

class Bullet {
  constructor(x, y, vx, vy, owner, dmg, life, kind = 'bullet') {
    this.x = x; this.y = y; this.vx = vx; this.vy = vy;
    this.owner = owner; this.dmg = dmg; this.life = life; this.kind = kind;
    this.dead = false;
  }
  update(dt) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.life -= dt;
    if (this.life <= 0) this.dead = true;
  }
  draw(ctx) {
    if (this.kind === 'laser') {
      ctx.lineCap = 'round';
      ctx.strokeStyle = 'rgba(80,220,255,0.35)';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(this.x - this.vx * 0.03, this.y - this.vy * 0.03);
      ctx.lineTo(this.x, this.y);
      ctx.stroke();
      ctx.strokeStyle = '#e8fcff';
      ctx.lineWidth = 1.8;
      ctx.stroke();
    } else if (this.owner === 'p') {
      ctx.strokeStyle = '#ffe9a0';
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(this.x - this.vx * 0.022, this.y - this.vy * 0.022);
      ctx.lineTo(this.x, this.y);
      ctx.stroke();
    } else if (this.kind === 'shell') {
      ctx.fillStyle = '#ffb347';
      ctx.beginPath();
      ctx.arc(this.x, this.y, 4.5, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#fff6d0';
      ctx.beginPath();
      ctx.arc(this.x, this.y, 2, 0, TAU);
      ctx.fill();
    } else {
      ctx.fillStyle = '#ff6a3a';
      ctx.beginPath();
      ctx.arc(this.x, this.y, 3, 0, TAU);
      ctx.fill();
    }
  }
}

class Missile {
  constructor(x, y, angle, owner, target, o) {
    this.x = x; this.y = y; this.angle = angle;
    this.owner = owner; this.target = target;
    this.speed = o.speed; this.maxSpeed = o.maxSpeed; this.accel = o.accel;
    this.turn = o.turn; this.dmg = o.dmg; this.life = o.life;
    this.dead = false;
    this.trailT = 0;
    this.arm = 0.12; // brief unguided boost off the rail
    this.cluster = !!o.cluster; // a cluster bomb flies straight and bursts into bomblets
  }
  update(dt, g) {
    this.arm -= dt;
    const t = this.target;
    if (t && !t.dead && this.arm <= 0) {
      this.angle = turnToward(this.angle, Math.atan2(t.y - this.y, t.x - this.x), this.turn * dt);
    } else if (this.owner === 'p' && (!t || t.dead)) {
      this.target = g.findTarget(this.x, this.y, this.angle, 650);
    }
    this.speed = Math.min(this.maxSpeed, this.speed + this.accel * dt);
    this.x += Math.cos(this.angle) * this.speed * dt;
    this.y += Math.sin(this.angle) * this.speed * dt;
    this.life -= dt;
    this.trailT -= dt;
    if (this.trailT <= 0) {
      this.trailT = 0.018;
      g.particles.push(new Particle(this.x - Math.cos(this.angle) * 8, this.y - Math.sin(this.angle) * 8,
        rand(-10, 10), rand(-10, 10), rand(0.5, 0.9), 3, 9, 'trail'));
    }
    if (this.life <= 0) {
      this.dead = true;
      if (this.cluster) g.clusterBurst(this.x, this.y);
      else g.explode(this.x, this.y, 10);
    }
  }
  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle);
    if (this.cluster) {
      ctx.fillStyle = '#3a3f2c';
      ctx.beginPath();
      ctx.ellipse(0, 0, 9, 4.5, 0, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#ff5ad2';
      ctx.fillRect(-9, -4, 3, 8);
      ctx.restore();
      return;
    }
    ctx.fillStyle = this.owner === 'p' ? '#e8e8e8' : '#d9d2c0';
    ctx.fillRect(-7, -1.8, 13, 3.6);
    ctx.fillStyle = this.owner === 'p' ? '#2a2a2a' : '#b83020';
    ctx.fillRect(4, -1.8, 3, 3.6);
    ctx.fillRect(-7, -3.5, 3, 7);
    ctx.fillStyle = 'rgba(255,200,90,0.9)';
    ctx.beginPath();
    ctx.arc(-9, 0, 3 + Math.random() * 2, 0, TAU);
    ctx.fill();
    ctx.restore();
  }
}

class Flare {
  constructor(x, y, vx, vy) {
    this.x = x; this.y = y; this.vx = vx; this.vy = vy;
    this.life = 2.6;
    this.dead = false;
  }
  update(dt, g) {
    const k = Math.exp(-1.6 * dt);
    this.vx *= k;
    this.vy *= k;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.life -= dt;
    if (Math.random() < 0.6) g.particles.push(new Particle(this.x, this.y, rand(-15, 15), rand(-15, 15), 0.5, 3, 6, 'trail'));
    if (this.life <= 0) this.dead = true;
  }
  draw(ctx) {
    const r = 6 + Math.random() * 4;
    ctx.fillStyle = 'rgba(255,240,200,0.9)';
    ctx.beginPath();
    ctx.arc(this.x, this.y, r * 0.45, 0, TAU);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,170,60,0.35)';
    ctx.beginPath();
    ctx.arc(this.x, this.y, r, 0, TAU);
    ctx.fill();
  }
}

// ---------------------------------------------------------------- effects

class Particle {
  constructor(x, y, vx, vy, life, size, grow, type, rot = 0) {
    this.x = x; this.y = y; this.vx = vx; this.vy = vy;
    this.life = this.maxLife = life;
    this.size = size; this.grow = grow; this.type = type;
    this.rot = rot;
    this.dead = false;
  }
  update(dt) {
    const drag = this.type === 'spark' || this.type === 'debris' ? 2 : 3;
    const k = Math.exp(-drag * dt);
    this.vx *= k;
    this.vy *= k;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.size += this.grow * dt;
    this.rot += dt * 8;
    this.life -= dt;
    if (this.life <= 0) this.dead = true;
  }
  get additive() {
    return this.type === 'fire' || this.type === 'spark' || this.type === 'flash' || this.type === 'muzzle';
  }
  draw(ctx) {
    const t = this.life / this.maxLife;
    switch (this.type) {
      case 'smoke':
        ctx.fillStyle = `rgba(48,46,44,${0.4 * t})`;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, TAU);
        ctx.fill();
        break;
      case 'trail':
        ctx.fillStyle = `rgba(215,215,210,${0.35 * t})`;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, TAU);
        ctx.fill();
        break;
      case 'debris':
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rot);
        ctx.fillStyle = `rgba(30,28,26,${Math.min(1, t * 2)})`;
        ctx.fillRect(-this.size / 2, -this.size / 2, this.size, this.size * 0.6);
        ctx.restore();
        break;
      case 'fire': {
        const r = 255, gg = (90 + 160 * t) | 0, b = (30 + 120 * t * t) | 0;
        ctx.fillStyle = `rgba(${r},${gg},${b},${0.75 * t})`;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, TAU);
        ctx.fill();
        break;
      }
      case 'spark':
        ctx.strokeStyle = `rgba(255,214,130,${t})`;
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(this.x, this.y);
        ctx.lineTo(this.x - this.vx * 0.035, this.y - this.vy * 0.035);
        ctx.stroke();
        break;
      case 'muzzle':
        ctx.fillStyle = `rgba(255,230,140,${t})`;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, TAU);
        ctx.fill();
        break;
      case 'ring':
        ctx.strokeStyle = `rgba(255,226,170,${0.7 * t})`;
        ctx.lineWidth = 2 + 6 * t;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, TAU);
        ctx.stroke();
        break;
      case 'flash': {
        const gr = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, this.size);
        gr.addColorStop(0, `rgba(255,250,230,${t})`);
        gr.addColorStop(1, 'rgba(255,160,60,0)');
        ctx.fillStyle = gr;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, TAU);
        ctx.fill();
        break;
      }
    }
  }
}

const PICKUP_COLORS = {
  repair: '#4cd47a', missiles: '#ffb02e', flares: '#5ec8ff',
  guns: '#ff6a3a', shield: '#b48cff', cluster: '#ff5ad2',
};

class Pickup {
  constructor(x, y, kind) {
    this.x = x; this.y = y; this.kind = kind;
    this.life = 20;
    this.t = Math.random() * 10;
    this.dead = false;
  }
  update(dt) {
    this.t += dt;
    this.life -= dt;
    if (this.life <= 0) this.dead = true;
  }
  draw(ctx) {
    if (this.life < 4 && Math.floor(this.t * 8) % 2) return;
    const s = 1 + Math.sin(this.t * 4) * 0.08;
    const col = PICKUP_COLORS[this.kind];
    const label = { repair: '+', missiles: 'M', flares: 'F', guns: '2x', shield: 'S', cluster: 'C' }[this.kind];
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.scale(s, s);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.arc(3, 4, 15, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#10161c';
    ctx.strokeStyle = col;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, 14, 0, TAU);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = col;
    ctx.font = `bold ${label.length > 1 ? 13 : 16}px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, 0, 1);
    ctx.restore();
  }
}

// ---------------------------------------------------------------- player

// Player airframes, chosen in the hangar: how each one looks and handles.
// gun: muzzle position (x forward, y to each side), seconds between rounds, damage, heat per round.
// missileMount: launch position (x forward, y to each side). turn: nose turn rate in rad/s.
const VEHICLES = {
  stormwolf: {
    name: 'STORMWOLF',
    role: 'ATTACK HELICOPTER',
    blurb: 'The all-rounder. Solid armour, a good missile load and twin wing guns.',
    draw: drawChopper,
    colors: { body: '#1b1f24', dark: '#2c3238', accent: '#e9ecef', glass: '#294d66' },
    r: 20,
    hp: 100,
    missiles: 8,
    flares: 4,
    speed: 270,
    turboSpeed: 580,
    turn: 7,
    gun: { x: 24, y: 19.5, cd: 0.06, dmg: 7, heat: 2.8 },
    missileMount: { x: 4, y: 20 },
  },
  kestrel: {
    name: 'KESTREL',
    role: 'SCOUT HELICOPTER',
    blurb: 'Fast and nimble with a fast-firing gun and extra flares, but light armour.',
    draw: drawScout,
    colors: { body: '#c4c9ce', dark: '#6f7880', accent: '#ff8a1f', glass: '#2b5a78' },
    r: 16,
    hp: 65,
    missiles: 4,
    flares: 7,
    speed: 335,
    turboSpeed: 690,
    turn: 10,
    gun: { x: 22, y: 8, cd: 0.045, dmg: 5, heat: 2.2 },
    missileMount: { x: 8, y: 8 },
  },
  titan: {
    name: 'TITAN',
    role: 'HEAVY GUNSHIP',
    blurb: 'A flying tank. Huge armour and missile load, heavy guns, slow to turn.',
    draw: drawHeavy,
    colors: { body: '#2b3a52', dark: '#1a2433', accent: '#e0b84a', glass: '#3a5a6e' },
    r: 26,
    hp: 170,
    missiles: 14,
    flares: 4,
    speed: 205,
    turboSpeed: 440,
    turn: 4.5,
    gun: { x: 30, y: 24, cd: 0.075, dmg: 10, heat: 3 },
    missileMount: { x: 10, y: 16 },
  },
  // Unlocked by clearing the last mission of the campaign.
  viper: {
    name: 'VIPER',
    role: 'PROTOTYPE JET-COPTER',
    blurb: 'Skywatch\'s reward: jet speed, ducted-fan agility and a long-range laser that runs cool.',
    draw: drawViper,
    colors: { body: '#262b33', dark: '#161a20', accent: '#3fd8ff', glass: '#1f4a5c' },
    unlock: 'campaign',
    r: 19,
    hp: 95,
    missiles: 6,
    flares: 5,
    speed: 360,
    turboSpeed: 780,
    turn: 8.5,
    // Laser bolts: fast, long-ranged and cool-running.
    gun: { x: 31, y: 3, cd: 0.065, dmg: 8.5, heat: 1.6, speed: 1500, range: 860, kind: 'laser' },
    missileMount: { x: 0, y: 14 },
  },
};

function vehicleLocked(v) {
  return v.unlock === 'campaign' && !Save.data.campaignDone;
}

class Player {
  // mods: workshop upgrade levels and difficulty, e.g. { armor: 1, racks: 2, hurt: 0.65 }.
  constructor(x, y, vehicle = VEHICLES.stormwolf, mods = {}) {
    this.vehicle = vehicle;
    this.speedMult = 1 + 0.06 * (mods.engine || 0);
    this.heatMult = 1 - 0.15 * (mods.cooling || 0);
    this.hurtMult = mods.hurt || 1;
    this.x = x; this.y = y; this.vx = 0; this.vy = 0;
    this.angle = -Math.PI / 2;
    this.aimAngle = this.angle;
    this.r = vehicle.r;
    this.hp = this.maxHp = Math.round(vehicle.hp * (1 + 0.15 * (mods.armor || 0)));
    this.missiles = this.maxMissiles = vehicle.missiles + 2 * (mods.racks || 0);
    this.flares = this.maxFlares = vehicle.flares + (mods.flares || 0);
    this.turbo = 100;
    this.heat = 0;
    this.overheat = false;
    this.gunCd = 0; this.misCd = 0; this.flareCd = 0;
    this.rotor = 0;
    this.gunSide = 1; this.misSide = 1;
    this.turboOn = false;
    this.hitFlash = 0;
    this.rearmT = 0;
    this.onPad = false;
    this.dead = false;
    this.gunBoostT = 0; // seconds of double guns left
    this.shieldT = 0; // seconds of shield left
    this.clusters = 0; // cluster bombs carried; the missile button drops these first
  }

  update(dt, g, c) {
    let mx = c.mx, my = c.my;
    const ml = Math.hypot(mx, my);
    if (ml > 1) { mx /= ml; my /= ml; }

    this.turboOn = c.turbo && this.turbo > 1 && ml > 0.1;
    if (this.turboOn) this.turbo = Math.max(0, this.turbo - 30 * dt);
    else this.turbo = Math.min(100, this.turbo + 9 * dt);

    const maxSpd = (this.turboOn ? this.vehicle.turboSpeed : this.vehicle.speed) * this.speedMult;
    const k = 1 - Math.exp(-(this.turboOn ? 2.4 : 3.2) * dt);
    this.vx += (mx * maxSpd - this.vx) * k;
    this.vy += (my * maxSpd - this.vy) * k;
    this.x = clamp(this.x + this.vx * dt, 40, WORLD_W - 40);
    this.y = clamp(this.y + this.vy * dt, 40, WORLD_H - 40);

    this.angle = turnToward(this.angle, Math.atan2(c.aimY - this.y, c.aimX - this.x), this.vehicle.turn * dt);
    this.rotor += dt * (this.turboOn ? 52 : 40);

    this.gunCd -= dt; this.misCd -= dt; this.flareCd -= dt; this.hitFlash -= dt;
    this.gunBoostT = Math.max(0, this.gunBoostT - dt);
    this.shieldT = Math.max(0, this.shieldT - dt);
    this.heat = Math.max(0, this.heat - 26 * dt);
    if (this.overheat && this.heat < 35) this.overheat = false;

    const ca = Math.cos(this.angle), sa = Math.sin(this.angle);

    const gun = this.vehicle.gun, mm = this.vehicle.missileMount;
    if (c.fire && !this.overheat && this.gunCd <= 0) {
      this.gunCd = gun.cd;
      this.heat += gun.heat * this.heatMult;
      if (this.heat >= 100) {
        this.heat = 100;
        this.overheat = true;
        Sfx.overheat();
      }
      // Double guns fire from both sides at once.
      for (let k = this.gunBoostT > 0 ? 2 : 1; k > 0; k--) {
        this.gunSide *= -1;
        const ox = this.x + ca * gun.x - sa * gun.y * this.gunSide;
        const oy = this.y + sa * gun.x + ca * gun.y * this.gunSide;
        let a = this.angle;
        // Keyboard, pad and auto-fire players get a little help: rounds bend onto where a
        // target nearly dead ahead will be when they get there.
        const t = c.gunTarget;
        if (c.assist && t) a += clamp(angDiff(this.angle, Math.atan2(t.y - oy, t.x - ox)), -t.cone, t.cone);
        a += rand(-0.035, 0.035);
        const sp = gun.speed || 980;
        g.bullets.push(new Bullet(ox, oy, Math.cos(a) * sp + this.vx * 0.5, Math.sin(a) * sp + this.vy * 0.5, 'p', gun.dmg, (gun.range || 690) / sp, gun.kind));
        g.particles.push(new Particle(ox, oy, this.vx, this.vy, 0.05, 5, 0, 'muzzle'));
      }
      Sfx.gun(gun.kind);
    }

    if (c.missile && this.misCd <= 0 && this.clusters > 0) {
      this.misCd = 0.6;
      this.clusters--;
      g.missiles.push(new Missile(this.x + ca * 10, this.y + sa * 10, this.angle, 'p', null,
        { speed: 320, maxSpeed: 520, accel: 300, turn: 0, dmg: 30, life: 0.75, cluster: true }));
      Sfx.missile();
    } else if (c.missile && this.misCd <= 0 && this.missiles > 0) {
      this.misCd = 0.4;
      this.missiles--;
      this.misSide *= -1;
      const ox = this.x + ca * mm.x - sa * mm.y * this.misSide;
      const oy = this.y + sa * mm.x + ca * mm.y * this.misSide;
      const spd = Math.hypot(this.vx, this.vy);
      g.missiles.push(new Missile(ox, oy, this.angle, 'p', g.lockTarget,
        { speed: 260 + spd * 0.5, maxSpeed: 840, accel: 950, turn: 4.8, dmg: 55, life: 2.8 }));
      Sfx.missile();
    }

    if (c.flare && this.flareCd <= 0 && this.flares > 0) {
      this.flareCd = 1.0;
      this.flares--;
      const fl = [];
      for (let i = 0; i < 6; i++) {
        const a = this.angle + Math.PI + rand(-1.3, 1.3);
        const f = new Flare(this.x, this.y, Math.cos(a) * rand(150, 300) + this.vx * 0.3, Math.sin(a) * rand(150, 300) + this.vy * 0.3);
        fl.push(f);
        g.flares.push(f);
      }
      // Missiles already tracking us have a good chance of chasing the decoys instead.
      for (const m of g.missiles) {
        if (m.owner === 'e' && m.target === this && Math.random() < 0.85 && dist2(m.x, m.y, this.x, this.y) < 900 * 900) {
          m.target = pick(fl);
        }
      }
      Sfx.flare();
    }

    const dB = dist(this.x, this.y, g.base.x, g.base.y);
    this.onPad = dB < 110 && Math.hypot(this.vx, this.vy) < 90;
    if (this.onPad) {
      this.hp = Math.min(this.maxHp, this.hp + 18 * dt);
      this.turbo = Math.min(100, this.turbo + 30 * dt);
      this.rearmT += dt;
      if (this.rearmT > 0.35) {
        this.rearmT = 0;
        if (this.missiles < this.maxMissiles) this.missiles++;
        else if (this.flares < this.maxFlares) this.flares++;
      }
    }

    if (this.hp < 35 && Math.random() < dt * (40 - this.hp) * 0.4) {
      g.particles.push(new Particle(this.x - ca * 14, this.y - sa * 14, rand(-20, 20), rand(-20, 20), 1.2, 4, 14, 'smoke'));
    }
  }

  // from: world angle the hit came from, for the HUD's damage-direction markers.
  damage(n, g, from) {
    if (this.dead || g.state !== 'play') return;
    if (from !== undefined) g.hitMarks.push({ a: from, t: 1 });
    if (this.shieldT > 0) {
      // The shield pickup soaks up hits while it lasts.
      g.particles.push(new Particle(this.x + Math.cos(from || 0) * this.r * 1.6, this.y + Math.sin(from || 0) * this.r * 1.6, 0, 0, 0.25, 10, 30, 'flash'));
      return;
    }
    this.hp -= n * this.hurtMult;
    g.damageTaken += n * this.hurtMult;
    g.hurtFlash = Math.min(1, g.hurtFlash + 0.25 + n / 60);
    this.hitFlash = 0.12;
    g.shake(5);
    Sfx.hit();
    if (Settings.data.vibrate && Input.touchMode && navigator.vibrate) navigator.vibrate(this.hp <= 0 ? 300 : 35);
    if (this.hp <= 0) {
      this.hp = 0;
      this.dead = true;
      g.playerDied();
    }
  }

  drawShadow(ctx) {
    this.vehicle.draw(ctx, this.x + 26, this.y + 34, this.angle, this.rotor, { shadow: true, scale: 0.92 });
  }

  draw(ctx) {
    this.vehicle.draw(ctx, this.x, this.y, this.angle, this.rotor, {
      ...this.vehicle.colors, turbo: this.turboOn, flash: this.hitFlash > 0,
    });
  }
}

// ---------------------------------------------------------------- enemies

class Enemy {
  constructor(x, y) {
    this.x = x; this.y = y;
    this.vx = 0; this.vy = 0;
    this.angle = rand(0, TAU);
    this.dead = false;
    this.gone = false; // left the map without being destroyed
    this.hitFlash = 0;
    this.objective = false;
    this.air = false;
    this.cd = rand(0.8, 2.5);
    this.burst = 0;
    this.burstT = 0;
    this.aware = false;
  }
  hurt(n, g) {
    if (this.dead) return;
    this.hp -= n;
    this.hitFlash = 0.07;
    this.aware = true;
    if (this.hp <= 0) {
      this.dead = true;
      this.die(g);
    }
  }
  die(g) {
    g.explode(this.x, this.y, this.boom, { ground: !this.air });
    if (!this.air) {
      g.terrain.addDecal({ type: 'wreck', x: this.x, y: this.y, angle: this.angle, w: this.r * 1.6, h: this.r });
      g.emitters.push({ x: this.x, y: this.y, life: 7 });
    } else {
      // Aircraft come down a little way ahead and leave a burning hulk, unless over water.
      const cx = this.x + Math.cos(this.angle) * this.r * 2, cy = this.y + Math.sin(this.angle) * this.r * 2;
      if (isLand(cx, cy)) {
        g.terrain.addDecal({ type: 'scorch', x: cx, y: cy, r: this.r * 2.2 });
        g.terrain.addDecal({ type: 'wreck', x: cx, y: cy, angle: this.angle, w: this.r * 1.5, h: this.r * 0.9 });
        g.emitters.push({ x: cx, y: cy, life: 9 });
      }
    }
    g.addScore(this.score, this.x, this.y);
    g.kills++;
    g.maybeDrop(this.x, this.y);
  }
  // The target to aim at: the player, or a friendly unit (convoy truck, base HQ) that is
  // clearly closer and within 900px.
  toPlayer(g) {
    const p = g.player;
    let tx = p.x, ty = p.y, d = dist(p.x, p.y, this.x, this.y);
    for (const f of g.friendlies) {
      if (f.dead || !f.solid) continue;
      const fd = dist(f.x, f.y, this.x, this.y);
      if (fd < 900 && fd < d * 0.8) {
        tx = f.x; ty = f.y; d = fd;
      }
    }
    return { dx: tx - this.x, dy: ty - this.y, d, a: Math.atan2(ty - this.y, tx - this.x) };
  }
  // Ground units stay on land: blocked moves turn them away from the water.
  groundMove(step) {
    const nx = this.x + Math.cos(this.angle) * step, ny = this.y + Math.sin(this.angle) * step;
    if (isLand(nx, ny)) {
      this.x = nx;
      this.y = ny;
      return true;
    }
    this.angle += Math.PI * 0.6 * (Math.random() < 0.5 ? 1 : -1);
    this.wander = this.angle;
    this.wanderT = rand(1.5, 3);
    return false;
  }
  drawHealth(ctx) {
    if (this.hp >= this.maxHp || this.isBoss) return;
    const w = this.r * 2;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(this.x - w / 2, this.y - this.r - 12, w, 4);
    ctx.fillStyle = '#ff5a3c';
    ctx.fillRect(this.x - w / 2, this.y - this.r - 12, (w * Math.max(0, this.hp)) / this.maxHp, 4);
  }
  drawShadow() {}
}

class Jeep extends Enemy {
  constructor(x, y, diff, leader = null) {
    super(x, y);
    this.r = 14;
    this.hp = this.maxHp = 22 * diff;
    this.score = 100;
    this.boom = 24;
    this.speed = 120;
    this.turret = this.angle;
    this.dir = Math.random() < 0.5 ? 1 : -1;
    this.wander = this.angle;
    this.wanderT = 0;
    this.leader = leader;
    this.offset = { x: rand(-70, 70), y: rand(-70, 70) };
    this.rate = diff;
  }
  update(dt, g) {
    const p = g.player;
    const t = this.toPlayer(g);
    let ta, speed = this.speed, free = false;
    if (this.leader && !this.leader.dead && (t.d > 650 || p.dead)) {
      const tx = this.leader.x + this.offset.x, ty = this.leader.y + this.offset.y;
      ta = Math.atan2(ty - this.y, tx - this.x);
      const d = dist(tx, ty, this.x, this.y);
      speed = d < 30 ? this.leader.speed : this.speed * 1.2;
      free = true; // escorts follow the road, bridges included
    } else if (t.d < 750 && !p.dead) {
      ta = t.d > 320 ? t.a : t.a + (Math.PI / 2) * this.dir;
    } else {
      this.wanderT -= dt;
      if (this.wanderT <= 0) {
        this.wanderT = rand(2, 5);
        this.wander = rand(0, TAU);
      }
      ta = this.wander;
      speed *= 0.6;
    }
    this.angle = turnToward(this.angle, ta, 2.4 * dt);
    if (free) {
      this.x += Math.cos(this.angle) * speed * dt;
      this.y += Math.sin(this.angle) * speed * dt;
    } else this.groundMove(speed * dt);

    this.turret = turnToward(this.turret, t.a, 4 * dt);
    this.cd -= dt;
    this.burstT -= dt;
    if (t.d < 480 && !p.dead && this.cd <= 0 && Math.abs(angDiff(this.turret, t.a)) < 0.2) {
      this.burst = 3;
      this.cd = rand(1.6, 2.6) / Math.sqrt(this.rate);
    }
    if (this.burst > 0 && this.burstT <= 0) {
      this.burst--;
      this.burstT = 0.12;
      g.enemyShoot(this.x, this.y, this.turret, 430, 4, 'bullet', 0.08, 10);
    }
    this.hitFlash -= dt;
  }
  draw(ctx) {
    const f = this.hitFlash > 0;
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle);
    groundShadow(ctx, -14, -8, 29, 16, 3);
    for (const wx of [-11, 5]) {
      drawWheel(ctx, wx, -9.5, 7, 3);
      drawWheel(ctx, wx, 6.5, 7, 3);
    }
    // Spare wheel on the tailgate.
    ctx.fillStyle = '#1a1a1a';
    ctx.beginPath();
    ctx.arc(-14, 0, 3.2, 0, TAU);
    ctx.fill();
    ctx.fillStyle = litFill(ctx, this.angle, 8, THEATRE.camo.light, f);
    ctx.beginPath();
    ctx.roundRect(-13, -7, 27, 14, 3);
    ctx.fill();
    outlinePath(ctx);
    // Bonnet, grille and windscreen.
    ctx.fillStyle = litFill(ctx, this.angle, 6, shade(THEATRE.camo.light, 0.12), f);
    ctx.beginPath();
    ctx.roundRect(5, -6, 8.5, 12, 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.4)';
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    ctx.moveTo(9, -5); ctx.lineTo(9, 5);
    ctx.moveTo(13.4, -4); ctx.lineTo(13.4, 4);
    ctx.stroke();
    ctx.fillStyle = glassFill(ctx, this.angle, 6, '#2e3a40');
    ctx.fillRect(2, -6, 2.5, 12);
    // Open rear bed with a roll bar.
    ctx.fillStyle = f ? '#fff' : shade(THEATRE.camo.light, -0.35);
    ctx.beginPath();
    ctx.roundRect(-12, -5.5, 11, 11, 1.5);
    ctx.fill();
    ctx.fillStyle = '#2b2b26';
    ctx.fillRect(-1.5, -6.5, 1.5, 13);
    // Gunner and pintle machine gun, which turns independently.
    ctx.translate(-6, 0);
    ctx.rotate(this.turret - this.angle);
    ctx.fillStyle = '#222';
    ctx.fillRect(1, -0.8, 13, 1.6);
    ctx.fillRect(2, -1.8, 4, 3.6);
    ctx.fillStyle = f ? '#fff' : THEATRE.camo.dark;
    ctx.beginPath();
    ctx.arc(-1, 0, 3, 0, TAU);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    ctx.beginPath();
    ctx.arc(-1.8, -0.9, 1.2, 0, TAU);
    ctx.fill();
    ctx.restore();
    this.drawHealth(ctx);
  }
}

class Truck extends Enemy {
  constructor(path, startDist, diff) {
    super(path[0].x, path[0].y);
    this.path = path;
    this.r = 16;
    this.hp = this.maxHp = 40 * diff;
    this.score = 300;
    this.boom = 30;
    this.speed = 50;
    this.objective = true;
    // Place the truck startDist along the route.
    let s = startDist;
    this.seg = 1;
    while (this.seg < path.length) {
      const a = path[this.seg - 1], b = path[this.seg];
      const l = dist(a.x, a.y, b.x, b.y);
      if (s <= l) {
        this.x = a.x + ((b.x - a.x) * s) / l;
        this.y = a.y + ((b.y - a.y) * s) / l;
        this.angle = Math.atan2(b.y - a.y, b.x - a.x);
        break;
      }
      s -= l;
      this.seg++;
    }
  }
  update(dt, g) {
    this.hitFlash -= dt;
    const t = this.path[this.seg];
    if (!t) return;
    const dx = t.x - this.x, dy = t.y - this.y;
    if (Math.hypot(dx, dy) < 20) {
      this.seg++;
      if (this.seg >= this.path.length) {
        this.dead = true;
        this.gone = true;
        g.escaped++;
        g.banner('TRUCK ESCAPED', '#ff6a4a');
      }
      return;
    }
    this.angle = turnToward(this.angle, Math.atan2(dy, dx), 3 * dt);
    this.x += Math.cos(this.angle) * this.speed * dt;
    this.y += Math.sin(this.angle) * this.speed * dt;
  }
  draw(ctx) {
    const f = this.hitFlash > 0;
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle);
    groundShadow(ctx, -22, -9, 47, 18, 3);
    for (const wx of [-19, -10, 15]) {
      drawWheel(ctx, wx, -10.5, 7, 3);
      drawWheel(ctx, wx, 7.5, 7, 3);
    }
    // Cab with windscreen and roof hatch.
    const paint = this.paint || THEATRE.camo;
    ctx.fillStyle = litFill(ctx, this.angle, 9, shade(paint.main, -0.12), f);
    ctx.beginPath();
    ctx.roundRect(11, -8, 13, 16, 2.5);
    ctx.fill();
    outlinePath(ctx);
    ctx.fillStyle = glassFill(ctx, this.angle, 7, '#26323a');
    ctx.beginPath();
    ctx.roundRect(19.5, -6.5, 3, 13, 1);
    ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(13.5, -2.5, 4, 5);
    // Canvas-covered cargo bed, sagging between its hoops.
    ctx.fillStyle = litFill(ctx, this.angle, 10, paint.cover, f);
    ctx.beginPath();
    ctx.roundRect(-22, -9, 32, 18, 2.5);
    ctx.fill();
    outlinePath(ctx);
    ctx.lineWidth = 1.2;
    for (let i = -16; i < 10; i += 6) {
      ctx.strokeStyle = 'rgba(0,0,0,0.28)';
      ctx.beginPath();
      ctx.moveTo(i, -9); ctx.lineTo(i, 9);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.1)';
      ctx.beginPath();
      ctx.moveTo(i + 1.2, -9); ctx.lineTo(i + 1.2, 9);
      ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(255,255,255,0.14)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-21, 0); ctx.lineTo(9, 0);
    ctx.stroke();
    ctx.restore();
    this.drawHealth(ctx);
  }
}

class Tank extends Enemy {
  constructor(x, y, diff) {
    super(x, y);
    this.r = 20;
    this.hp = this.maxHp = 75 * diff;
    this.score = 250;
    this.boom = 34;
    this.speed = 45;
    this.turret = this.angle;
    this.wander = this.angle;
    this.wanderT = 0;
    this.tread = 0;
    this.rate = diff;
  }
  update(dt, g) {
    const p = g.player;
    const t = this.toPlayer(g);
    this.wanderT -= dt;
    if (t.d < 900 && !p.dead) {
      if (t.d > 380) this.wander = t.a;
      else if (this.wanderT <= 0) {
        this.wander = t.a + rand(-1.5, 1.5);
        this.wanderT = rand(2, 4);
      }
    } else if (this.wanderT <= 0) {
      this.wanderT = rand(3, 6);
      this.wander = rand(0, TAU);
    }
    this.angle = turnToward(this.angle, this.wander, 0.9 * dt);
    if (this.groundMove(this.speed * dt)) this.tread += dt * 30;
    this.turret = turnToward(this.turret, t.a, 1.6 * dt);
    this.cd -= dt;
    if (t.d < 560 && !p.dead && this.cd <= 0 && Math.abs(angDiff(this.turret, t.a)) < 0.12) {
      this.cd = rand(2.2, 3.2) / Math.sqrt(this.rate);
      g.enemyShoot(this.x, this.y, this.turret, 330, 13, 'shell', 0.02, 30);
      g.particles.push(new Particle(this.x + Math.cos(this.turret) * 30, this.y + Math.sin(this.turret) * 30, 0, 0, 0.1, 10, 0, 'muzzle'));
    }
    this.hitFlash -= dt;
  }
  draw(ctx) {
    const f = this.hitFlash > 0;
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle);
    groundShadow(ctx, -22, -16, 44, 32, 4);
    // Tracks, with links that roll as the tank moves.
    for (const ty of [-15.5, 8.5]) {
      ctx.fillStyle = '#23241e';
      ctx.beginPath();
      ctx.roundRect(-22, ty, 44, 7, 2.5);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.13)';
      for (let i = 0; i < 11; i++) {
        const xx = -21 + (((i * 4 + this.tread) % 42) + 42) % 42;
        ctx.fillRect(xx, ty + 0.5, 1.4, 6);
      }
    }
    // Hull with a sloped glacis and engine deck grilles.
    ctx.fillStyle = litFill(ctx, this.angle, 12, THEATRE.camo.main, f);
    ctx.beginPath();
    ctx.moveTo(-19, -10); ctx.lineTo(16, -10); ctx.lineTo(21, -6);
    ctx.lineTo(21, 6); ctx.lineTo(16, 10); ctx.lineTo(-19, 10);
    ctx.closePath();
    ctx.fill();
    outlinePath(ctx);
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    for (let i = -17; i <= -11; i += 2) {
      ctx.moveTo(i, -6); ctx.lineTo(i, 6);
    }
    ctx.moveTo(16, -10); ctx.lineTo(16, 10);
    ctx.stroke();
    // Turret, barrel with muzzle brake, and the commander's hatch.
    ctx.rotate(this.turret - this.angle);
    ctx.fillStyle = litFill(ctx, this.turret, 3, shade(THEATRE.camo.main, -0.15), f);
    ctx.fillRect(6, -2, 23, 4);
    ctx.fillRect(28, -3, 4, 6);
    ctx.fillStyle = litFill(ctx, this.turret, 10, shade(THEATRE.camo.main, -0.08), f);
    ctx.beginPath();
    ctx.moveTo(-12, -7); ctx.lineTo(-6, -10); ctx.lineTo(5, -9); ctx.lineTo(10, -4);
    ctx.lineTo(10, 4); ctx.lineTo(5, 9); ctx.lineTo(-6, 10); ctx.lineTo(-12, 7);
    ctx.closePath();
    ctx.fill();
    outlinePath(ctx);
    ctx.fillStyle = f ? '#fff' : THEATRE.camo.dark;
    ctx.beginPath();
    ctx.arc(-4, -3.5, 3.2, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    ctx.lineWidth = 0.8;
    ctx.stroke();
    ctx.fillStyle = '#222';
    ctx.fillRect(-1, 3, 7, 1.2);
    ctx.restore();
    this.drawHealth(ctx);
  }
}

class SamSite extends Enemy {
  constructor(x, y, diff) {
    super(x, y);
    this.r = 24;
    this.hp = this.maxHp = 90 * diff;
    this.score = 500;
    this.boom = 44;
    this.turret = rand(0, TAU);
    this.dish = 0;
    this.cd = rand(1, 3);
    this.rate = diff;
    this.loaded = 2;
    this.reload = 0;
  }
  update(dt, g) {
    const p = g.player;
    const t = this.toPlayer(g);
    this.dish += dt * 2.5;
    this.hitFlash -= dt;
    const inRange = t.d < 820 && !p.dead;
    if (inRange) this.turret = turnToward(this.turret, t.a, 1.5 * dt);
    if (this.loaded < 2) {
      this.reload -= dt;
      if (this.reload <= 0) {
        this.loaded++;
        this.reload = 4;
      }
    }
    this.cd -= dt;
    if (inRange && this.cd <= 0 && this.loaded > 0 && Math.abs(angDiff(this.turret, t.a)) < 0.3) {
      this.loaded--;
      this.reload = 4;
      this.cd = rand(2.6, 3.6) / Math.sqrt(this.rate);
      g.launchEnemyMissile(this.x, this.y, this.turret, p);
    }
  }
  draw(ctx) {
    const f = this.hitFlash > 0;
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.arc(4, 5, 28, 0, TAU);
    ctx.fill();
    // Gravel pad inside a ring of sandbags.
    ctx.fillStyle = litFill(ctx, 0, 26, THEATRE.camo.ground, f);
    ctx.beginPath();
    ctx.arc(0, 0, 26, 0, TAU);
    ctx.fill();
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * TAU;
      ctx.save();
      ctx.translate(Math.cos(a) * 22.5, Math.sin(a) * 22.5);
      ctx.rotate(a + Math.PI / 2);
      ctx.fillStyle = litFill(ctx, a + Math.PI / 2, 4, shade(THEATRE.camo.ground, i % 2 ? -0.14 : -0.06), f);
      ctx.beginPath();
      ctx.ellipse(0, 0, 5.4, 3.4, 0, 0, TAU);
      ctx.fill();
      outlinePath(ctx);
      ctx.restore();
    }
    // Ammo crates.
    for (const [cx, cy] of [[11, 9], [6, 13]]) {
      ctx.fillStyle = litFill(ctx, 0, 3, THEATRE.camo.main, f);
      ctx.fillRect(cx - 2.5, cy - 2, 5, 4);
      ctx.strokeStyle = 'rgba(0,0,0,0.4)';
      ctx.lineWidth = 0.6;
      ctx.strokeRect(cx - 2.5, cy - 2, 5, 4);
    }
    ctx.fillStyle = litFill(ctx, 0, 12, shade(THEATRE.camo.dark, 0.25), f);
    ctx.beginPath();
    ctx.arc(0, 0, 12, 0, TAU);
    ctx.fill();
    outlinePath(ctx);
    // Rotating radar dish on its mast.
    ctx.save();
    ctx.translate(-13, -13);
    ctx.fillStyle = '#3a3b33';
    ctx.beginPath();
    ctx.arc(0, 0, 2.5, 0, TAU);
    ctx.fill();
    ctx.rotate(this.dish);
    ctx.strokeStyle = f ? '#fff' : '#d4d4ca';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.arc(-4, 0, 8, -0.75, 0.75);
    ctx.stroke();
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(0, 0); ctx.lineTo(5, 0);
    ctx.stroke();
    ctx.restore();
    // Twin-rail launcher that tracks the player.
    ctx.rotate(this.turret);
    ctx.fillStyle = litFill(ctx, this.turret, 9, shade(THEATRE.camo.main, -0.3), f);
    ctx.beginPath();
    ctx.roundRect(-8, -9, 16, 18, 2);
    ctx.fill();
    outlinePath(ctx);
    for (let i = 0; i < 2; i++) {
      const yy = i ? 4.5 : -4.5;
      ctx.fillStyle = '#2a2e24';
      ctx.fillRect(-7, yy - 2.2, 22, 4.4);
      if (i >= this.loaded) continue;
      ctx.fillStyle = litFill(ctx, this.turret, 2, '#e8e2d0', f);
      ctx.beginPath();
      ctx.roundRect(-6, yy - 1.6, 21, 3.2, 1.6);
      ctx.fill();
      ctx.fillStyle = '#b83020';
      ctx.beginPath();
      ctx.moveTo(15, yy - 1.6); ctx.lineTo(18, yy); ctx.lineTo(15, yy + 1.6);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#9a958a';
      ctx.fillRect(-6, yy - 2.6, 3, 5.2);
    }
    ctx.restore();
    this.drawHealth(ctx);
  }
}

class Gunship extends Enemy {
  constructor(x, y, diff) {
    super(x, y);
    this.air = true;
    this.r = 20;
    this.hp = this.maxHp = 45 * diff;
    this.score = 300;
    this.boom = 34;
    this.speed = 210;
    this.range = rand(260, 360);
    this.orbit = rand(0, TAU);
    this.dir = Math.random() < 0.5 ? 1 : -1;
    this.rotor = rand(0, TAU);
    this.hx = x; this.hy = y;
    this.rate = diff;
    this.colors = { ...THEATRE.camo.heli, glass: '#2a3b3a' };
    this.scale = 0.9;
  }
  update(dt, g) {
    const p = g.player;
    const t = this.toPlayer(g);
    if (!this.aware && t.d < 950) this.aware = true;
    const engaged = this.aware && !p.dead;
    this.orbit += dt * 0.45 * this.dir;
    let tx, ty;
    if (engaged) {
      tx = p.x + Math.cos(this.orbit) * this.range;
      ty = p.y + Math.sin(this.orbit) * this.range;
    } else {
      tx = this.hx + Math.cos(this.orbit) * 250;
      ty = this.hy + Math.sin(this.orbit) * 250;
    }
    const ddx = tx - this.x, ddy = ty - this.y, dd = Math.hypot(ddx, ddy) || 1;
    const sp = Math.min(this.speed, dd * 1.5);
    const k = 1 - Math.exp(-2 * dt);
    this.vx += ((ddx / dd) * sp - this.vx) * k;
    this.vy += ((ddy / dd) * sp - this.vy) * k;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    const face = engaged ? t.a : Math.atan2(this.vy, this.vx);
    this.angle = turnToward(this.angle, face, 3 * dt);
    this.rotor += dt * 40;
    this.hitFlash -= dt;
    this.attack(dt, g, t, engaged);
  }
  attack(dt, g, t, engaged) {
    this.cd -= dt;
    this.burstT -= dt;
    if (engaged && t.d < 540 && this.cd <= 0 && Math.abs(angDiff(this.angle, t.a)) < 0.25) {
      this.burst = 4;
      this.cd = rand(1.8, 3) / Math.sqrt(this.rate);
    }
    if (this.burst > 0 && this.burstT <= 0) {
      this.burst--;
      this.burstT = 0.11;
      g.enemyShoot(this.x, this.y, this.angle, 480, 5, 'bullet', 0.06, 24 * this.scale);
    }
  }
  drawShadow(ctx) {
    drawChopper(ctx, this.x + 26, this.y + 34, this.angle, this.rotor, { shadow: true, scale: this.scale * 0.92 });
  }
  draw(ctx) {
    drawChopper(ctx, this.x, this.y, this.angle, this.rotor, { ...this.colors, scale: this.scale, flash: this.hitFlash > 0 });
    this.drawHealth(ctx);
  }
}

class Boss extends Gunship {
  constructor(x, y, diff) {
    super(x, y, diff);
    this.isBoss = true;
    this.objective = true;
    this.name = 'RED TALON';
    this.r = 32;
    this.hp = this.maxHp = 900 * diff;
    this.score = 5000;
    this.boom = 70;
    this.speed = 250;
    this.range = 380;
    this.scale = 1.55;
    this.colors = { body: '#5c1714', dark: '#2b0c0a', accent: '#d9a441', glass: '#3a2020' };
    this.salvoCd = 5;
    this.dashT = 0;
    this.dashCd = 8;
  }
  update(dt, g) {
    if (this.aware) {
      this.dashCd -= dt;
      if (this.dashCd <= 0) {
        this.dashCd = rand(7, 11);
        this.dashT = 1.2;
        this.dir *= -1;
      }
    }
    this.dashT -= dt;
    this.speed = this.dashT > 0 ? 560 : 250;
    this.orbit += this.dashT > 0 ? dt * 1.2 * this.dir : 0;
    super.update(dt, g);
    if (this.dashT > 0 && Math.random() < 0.6) {
      g.particles.push(new Particle(this.x - Math.cos(this.angle) * 30, this.y - Math.sin(this.angle) * 30, 0, 0, 0.4, 8, 20, 'fire'));
    }
  }
  die(g) {
    super.die(g);
    for (let i = 1; i <= 9; i++) {
      g.delayed.push({ t: i * 0.2, x: this.x + rand(-60, 60), y: this.y + rand(-60, 60), size: rand(30, 55) });
    }
    g.delayed.push({ t: 2, x: this.x, y: this.y, size: 110, ring: true });
    g.banner(`${this.name} DOWN`, HUD_AMBER);
  }
  attack(dt, g, t, engaged) {
    this.cd -= dt;
    this.burstT -= dt;
    this.salvoCd -= dt;
    if (engaged && t.d < 620 && this.cd <= 0 && Math.abs(angDiff(this.angle, t.a)) < 0.3) {
      this.burst = 8;
      this.cd = rand(1.2, 2) / Math.sqrt(this.rate);
    }
    if (this.burst > 0 && this.burstT <= 0) {
      this.burst--;
      this.burstT = 0.08;
      for (const s of [-1, 1]) {
        const ox = this.x - Math.sin(this.angle) * 30 * s, oy = this.y + Math.cos(this.angle) * 30 * s;
        g.enemyShoot(ox, oy, this.angle, 520, 5, 'bullet', 0.05, 34);
      }
    }
    if (engaged && t.d < 900 && this.salvoCd <= 0) {
      this.salvoCd = rand(5, 7);
      g.launchEnemyMissile(this.x, this.y, this.angle + 0.5, g.player);
      g.launchEnemyMissile(this.x, this.y, this.angle - 0.5, g.player);
    }
  }
}

class Jet extends Enemy {
  constructor(x, y, tx, ty, diff) {
    super(x, y);
    this.air = true;
    this.r = 22;
    this.hp = this.maxHp = 35 * diff;
    this.score = 400;
    this.boom = 36;
    this.speed = 640;
    this.angle = Math.atan2(ty - y, tx - x);
    this.life = 10;
    this.fired = false;
  }
  update(dt, g) {
    const t = this.toPlayer(g);
    // Lazily track the player until committed to the pass.
    if (!this.fired && t.d > 500) this.angle = turnToward(this.angle, t.a, 0.5 * dt);
    this.x += Math.cos(this.angle) * this.speed * dt;
    this.y += Math.sin(this.angle) * this.speed * dt;
    this.hitFlash -= dt;
    if (!this.fired && !g.player.dead && t.d < 800 && Math.abs(angDiff(this.angle, t.a)) < 0.35) {
      this.fired = true;
      g.launchEnemyMissile(this.x, this.y, this.angle, g.player);
    }
    this.life -= dt;
    if (this.life <= 0) {
      this.dead = true;
      this.gone = true;
    }
  }
  drawShadow(ctx) {
    drawJetShape(ctx, this.x + 40, this.y + 52, this.angle, { shadow: true, scale: 0.9 });
  }
  draw(ctx) {
    drawJetShape(ctx, this.x, this.y, this.angle, { body: THEATRE.camo.jet, flash: this.hitFlash > 0 });
  }
}

// ---------------------------------------------------------------- emplacements, boats and structures

function isWater(x, y) {
  return x > 60 && y > 60 && x < WORLD_W - 60 && y < WORLD_H - 60 && heightAt(x, y) < SEA_LEVEL - 0.01;
}

// Ring of sandbags around an emplacement.
function drawSandbags(ctx, n, radius, f) {
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU;
    ctx.save();
    ctx.translate(Math.cos(a) * radius, Math.sin(a) * radius);
    ctx.rotate(a + Math.PI / 2);
    ctx.fillStyle = litFill(ctx, a + Math.PI / 2, 4, shade(THEATRE.camo.ground, i % 2 ? -0.14 : -0.06), f);
    ctx.beginPath();
    ctx.ellipse(0, 0, 4.6, 3, 0, 0, TAU);
    ctx.fill();
    outlinePath(ctx);
    ctx.restore();
  }
}

// Twin-barrelled anti-aircraft gun: static, hoses the sky with fast bursts.
class AAGun extends Enemy {
  constructor(x, y, diff) {
    super(x, y);
    this.r = 15;
    this.hp = this.maxHp = 35 * diff;
    this.score = 200;
    this.boom = 26;
    this.turret = rand(0, TAU);
    this.rate = diff;
    this.side = 1;
  }
  update(dt, g) {
    const p = g.player;
    const t = this.toPlayer(g);
    this.hitFlash -= dt;
    const inRange = t.d < 640 && !p.dead;
    if (inRange) this.turret = turnToward(this.turret, t.a, 2.6 * dt);
    this.cd -= dt;
    this.burstT -= dt;
    if (inRange && this.cd <= 0 && Math.abs(angDiff(this.turret, t.a)) < 0.2) {
      this.burst = 6;
      this.cd = rand(2, 3) / Math.sqrt(this.rate);
    }
    if (this.burst > 0 && this.burstT <= 0) {
      this.burst--;
      this.burstT = 0.07;
      this.side *= -1;
      const ox = this.x - Math.sin(this.turret) * 3 * this.side, oy = this.y + Math.cos(this.turret) * 3 * this.side;
      g.enemyShoot(ox, oy, this.turret, 600, 3, 'bullet', 0.07, 18);
    }
  }
  draw(ctx) {
    const f = this.hitFlash > 0, C = THEATRE.camo;
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.arc(3, 4, 18, 0, TAU);
    ctx.fill();
    ctx.fillStyle = litFill(ctx, 0, 14, shade(C.ground, -0.25), f);
    ctx.beginPath();
    ctx.arc(0, 0, 14, 0, TAU);
    ctx.fill();
    drawSandbags(ctx, 11, 14.5, f);
    ctx.rotate(this.turret);
    ctx.fillStyle = '#25272a';
    ctx.fillRect(4, -4, 16, 2);
    ctx.fillRect(4, 2, 16, 2);
    ctx.fillRect(18, -4.6, 3, 3.2);
    ctx.fillRect(18, 1.4, 3, 3.2);
    ctx.fillStyle = litFill(ctx, this.turret, 8, C.main, f);
    ctx.beginPath();
    ctx.roundRect(-7, -7, 13, 14, 3);
    ctx.fill();
    outlinePath(ctx);
    ctx.fillStyle = f ? '#fff' : C.dark;
    ctx.beginPath();
    ctx.arc(-2, 0, 3, 0, TAU);
    ctx.fill();
    ctx.restore();
    this.drawHealth(ctx);
  }
}

// Fuel depot: three storage tanks on a bunded pad. Goes up in a fireball that hurts anything nearby.
class FuelDepot extends Enemy {
  constructor(x, y, diff) {
    super(x, y);
    this.r = 28;
    this.hp = this.maxHp = 70 * diff;
    this.score = 400;
    this.boom = 64;
    this.objective = true;
  }
  update(dt) {
    this.hitFlash -= dt;
  }
  die(g) {
    super.die(g);
    for (const o of g.enemies) {
      if (o !== this && !o.dead && dist2(o.x, o.y, this.x, this.y) < 170 * 170) o.hurt(45, g);
    }
    const p = g.player;
    if (!p.dead && dist2(p.x, p.y, this.x, this.y) < 110 * 110) p.damage(12, g, Math.atan2(this.y - p.y, this.x - p.x));
    g.emitters.push({ x: this.x + 10, y: this.y - 6, life: 14 });
  }
  draw(ctx) {
    const f = this.hitFlash > 0, C = THEATRE.camo;
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.roundRect(-28, -22, 62, 50, 5);
    ctx.fill();
    // Concrete pad with a raised bund wall.
    ctx.fillStyle = litFill(ctx, this.angle, 30, '#85867f', f);
    ctx.beginPath();
    ctx.roundRect(-31, -26, 62, 52, 5);
    ctx.fill();
    outlinePath(ctx);
    ctx.fillStyle = f ? '#fff' : '#6b6c66';
    ctx.beginPath();
    ctx.roundRect(-27, -22, 54, 44, 3);
    ctx.fill();
    // Pipework between the tanks.
    ctx.strokeStyle = '#3b3d3f';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-13, -8); ctx.lineTo(13, -8); ctx.lineTo(0, 11); ctx.closePath();
    ctx.moveTo(13, -8); ctx.lineTo(27, -8);
    ctx.stroke();
    const tanks = [[-13, -8, 10.5], [13, -8, 10.5], [0, 11, 9.5]];
    for (const [tx, ty, tr] of tanks) {
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.beginPath();
      ctx.arc(tx + 2, ty + 3, tr, 0, TAU);
      ctx.fill();
      ctx.fillStyle = litFill(ctx, this.angle, tr, shade(C.light, 0.3), f);
      ctx.beginPath();
      ctx.arc(tx, ty, tr, 0, TAU);
      ctx.fill();
      outlinePath(ctx);
      ctx.strokeStyle = 'rgba(0,0,0,0.25)';
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.arc(tx, ty, tr * 0.65, 0, TAU);
      ctx.stroke();
      ctx.fillStyle = '#3b3d3f';
      ctx.beginPath();
      ctx.arc(tx, ty, 1.8, 0, TAU);
      ctx.fill();
    }
    // Hazard diamond on the wall.
    ctx.translate(22, 16);
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = '#e8b31c';
    ctx.fillRect(-3, -3, 6, 6);
    ctx.fillStyle = '#c0392b';
    ctx.fillRect(-1.5, -1.5, 3, 3);
    ctx.restore();
    this.drawHealth(ctx);
  }
}

// Fast attack boat: patrols the water, strafes with a bow gun; some carry missiles.
class PatrolBoat extends Enemy {
  constructor(x, y, diff, missiles = false) {
    super(x, y);
    this.r = 16;
    this.hp = this.maxHp = 40 * diff;
    this.score = 350;
    this.boom = 30;
    this.speed = 150;
    this.missileBoat = missiles;
    this.turret = this.angle;
    this.rate = diff;
    this.wander = this.angle;
    this.wanderT = 0;
    this.dir = Math.random() < 0.5 ? 1 : -1;
    this.salvoCd = rand(4, 8);
    this.wake = 0;
  }
  update(dt, g) {
    const p = g.player;
    const t = this.toPlayer(g);
    this.hitFlash -= dt;
    let ta, speed = this.speed;
    if (t.d < 900 && !p.dead) {
      this.aware = true;
      ta = t.d > 360 ? t.a : t.a + (Math.PI / 2) * this.dir;
    } else {
      this.wanderT -= dt;
      if (this.wanderT <= 0) {
        this.wanderT = rand(3, 6);
        this.wander = rand(0, TAU);
      }
      ta = this.wander;
      speed *= 0.55;
    }
    this.angle = turnToward(this.angle, ta, 1.6 * dt);
    const nx = this.x + Math.cos(this.angle) * speed * dt, ny = this.y + Math.sin(this.angle) * speed * dt;
    if (isWater(nx, ny)) {
      this.x = nx;
      this.y = ny;
      this.wake = Math.min(1, this.wake + dt * 2);
    } else {
      // Heading for the shore: swing round until there is open water ahead.
      this.angle += this.dir * 3 * dt;
      this.wander = this.angle;
      this.wanderT = rand(1, 2);
      this.wake = Math.max(0.2, this.wake - dt * 2);
    }

    this.turret = turnToward(this.turret, t.a, 3.5 * dt);
    this.cd -= dt;
    this.burstT -= dt;
    if (t.d < 520 && !p.dead && this.cd <= 0 && Math.abs(angDiff(this.turret, t.a)) < 0.2) {
      this.burst = 4;
      this.cd = rand(1.6, 2.4) / Math.sqrt(this.rate);
    }
    if (this.burst > 0 && this.burstT <= 0) {
      this.burst--;
      this.burstT = 0.1;
      const bx = this.x + Math.cos(this.angle) * 10, by = this.y + Math.sin(this.angle) * 10;
      g.enemyShoot(bx, by, this.turret, 460, 4, 'bullet', 0.07, 10);
    }
    if (this.missileBoat) {
      this.salvoCd -= dt;
      if (t.d < 850 && !p.dead && this.salvoCd <= 0) {
        this.salvoCd = rand(7, 10) / Math.sqrt(this.rate);
        g.launchEnemyMissile(this.x, this.y, this.angle, p);
      }
    }
  }
  // Sinks without leaving a wreck on the water.
  die(g) {
    g.explode(this.x, this.y, this.boom);
    g.addScore(this.score, this.x, this.y);
    g.kills++;
    g.maybeDrop(this.x, this.y);
  }
  draw(ctx) {
    const f = this.hitFlash > 0, C = THEATRE.camo;
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle);
    // Wake: a white V spreading from the stern.
    if (this.wake > 0.05) {
      ctx.strokeStyle = `rgba(235,245,250,${0.45 * this.wake})`;
      ctx.lineWidth = 2.5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-14, -5); ctx.lineTo(-48, -17);
      ctx.moveTo(-14, 5); ctx.lineTo(-48, 17);
      ctx.stroke();
      ctx.fillStyle = `rgba(235,245,250,${0.3 * this.wake})`;
      ctx.beginPath();
      ctx.ellipse(-22, 0, 10, 4.5, 0, 0, TAU);
      ctx.fill();
    }
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(3, 4, 21, 8, 0, 0, TAU);
    ctx.fill();
    // Hull and deck.
    ctx.fillStyle = litFill(ctx, this.angle, 8, C.cover, f);
    ctx.beginPath();
    ctx.moveTo(21, 0);
    ctx.quadraticCurveTo(13, -7.5, 4, -7.5);
    ctx.lineTo(-16, -6.5); ctx.lineTo(-16, 6.5); ctx.lineTo(4, 7.5);
    ctx.quadraticCurveTo(13, 7.5, 21, 0);
    ctx.fill();
    outlinePath(ctx);
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(18, 0); ctx.lineTo(-15, 0);
    ctx.stroke();
    // Wheelhouse with windows.
    ctx.fillStyle = litFill(ctx, this.angle, 5, C.main, f);
    ctx.beginPath();
    ctx.roundRect(-7, -4.5, 10, 9, 2);
    ctx.fill();
    outlinePath(ctx);
    ctx.fillStyle = glassFill(ctx, this.angle, 4, '#26323a');
    ctx.fillRect(1.5, -3.5, 1.6, 7);
    // Stern missile box.
    if (this.missileBoat) {
      ctx.fillStyle = f ? '#fff' : C.dark;
      ctx.fillRect(-15, -4, 6, 8);
      ctx.fillStyle = '#b83020';
      ctx.fillRect(-9.5, -3, 1.2, 2);
      ctx.fillRect(-9.5, 1, 1.2, 2);
    }
    // Bow gun.
    ctx.translate(11, 0);
    ctx.rotate(this.turret - this.angle);
    ctx.fillStyle = '#222';
    ctx.fillRect(0, -0.8, 10, 1.6);
    ctx.fillStyle = f ? '#fff' : C.dark;
    ctx.beginPath();
    ctx.arc(0, 0, 3, 0, TAU);
    ctx.fill();
    ctx.restore();
    this.drawHealth(ctx);
  }
}

// Power generator feeding the command bunker's shield.
class Generator extends Enemy {
  constructor(x, y, diff) {
    super(x, y);
    this.r = 22;
    this.hp = this.maxHp = 80 * diff;
    this.score = 400;
    this.boom = 44;
    this.objective = true;
    this.fan = 0;
  }
  update(dt) {
    this.hitFlash -= dt;
    this.fan += dt * 14;
  }
  draw(ctx) {
    const f = this.hitFlash > 0;
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.roundRect(-22, -15, 50, 38, 4);
    ctx.fill();
    ctx.fillStyle = litFill(ctx, this.angle, 24, '#7d7e78', f);
    ctx.beginPath();
    ctx.roundRect(-25, -19, 50, 38, 4);
    ctx.fill();
    outlinePath(ctx);
    // Housing with radiator fins.
    ctx.fillStyle = litFill(ctx, this.angle, 12, '#b8892a', f);
    ctx.beginPath();
    ctx.roundRect(-20, -13, 24, 26, 3);
    ctx.fill();
    outlinePath(ctx);
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    for (let i = -16; i <= 0; i += 4) {
      ctx.moveTo(i, -10); ctx.lineTo(i, 10);
    }
    ctx.stroke();
    // Cooling fan.
    ctx.fillStyle = '#26282a';
    ctx.beginPath();
    ctx.arc(14, 0, 8, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = '#8a8f96';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let b = 0; b < 3; b++) {
      const a = this.fan + (b * TAU) / 3;
      ctx.moveTo(14, 0);
      ctx.lineTo(14 + Math.cos(a) * 6.5, Math.sin(a) * 6.5);
    }
    ctx.stroke();
    // Power arcing off the coil.
    const pulse = 0.4 + 0.4 * Math.sin(this.fan * 0.9);
    const gl = ctx.createRadialGradient(-8, 0, 0, -8, 0, 14);
    gl.addColorStop(0, `rgba(140,210,255,${pulse})`);
    gl.addColorStop(1, 'rgba(80,160,255,0)');
    ctx.fillStyle = gl;
    ctx.beginPath();
    ctx.arc(-8, 0, 14, 0, TAU);
    ctx.fill();
    ctx.restore();
    this.drawHealth(ctx);
  }
}

// Fortified command bunker. Invulnerable behind its shield while any generator is running.
class Bunker extends Enemy {
  constructor(x, y, diff) {
    super(x, y);
    this.r = 34;
    this.hp = this.maxHp = 320 * diff;
    this.score = 2500;
    this.boom = 84;
    this.objective = true;
    this.turret = rand(0, TAU);
    this.rate = diff;
    this.shielded = true;
    this.shieldHit = 0;
    this.salvoCd = 5;
    this.angle = 0;
  }
  hurt(n, g) {
    if (this.shielded) {
      this.shieldHit = 0.2;
      return;
    }
    super.hurt(n, g);
  }
  update(dt, g) {
    const p = g.player;
    const t = this.toPlayer(g);
    this.hitFlash -= dt;
    this.shieldHit -= dt;
    const shielded = g.enemies.some((e) => e instanceof Generator && !e.dead);
    if (this.shielded && !shielded) {
      g.banner('BUNKER SHIELD DOWN', HUD_AMBER);
      g.shake(6);
    }
    this.shielded = shielded;
    // While the shield is up, the dome is what incoming fire hits.
    this.r = shielded ? 58 : 34;

    const inRange = t.d < 720 && !p.dead;
    if (inRange) this.turret = turnToward(this.turret, t.a, 2 * dt);
    this.cd -= dt;
    this.burstT -= dt;
    if (inRange && this.cd <= 0 && Math.abs(angDiff(this.turret, t.a)) < 0.25) {
      this.burst = 8;
      this.cd = rand(1.6, 2.4) / Math.sqrt(this.rate);
    }
    if (this.burst > 0 && this.burstT <= 0) {
      this.burst--;
      this.burstT = 0.06;
      g.enemyShoot(this.x, this.y, this.turret, 620, 4, 'bullet', 0.08, 24);
    }
    this.salvoCd -= dt;
    if (t.d < 880 && !p.dead && this.salvoCd <= 0) {
      this.salvoCd = rand(6, 8) / Math.sqrt(this.rate);
      g.launchEnemyMissile(this.x, this.y, t.a + 0.5, p);
      g.launchEnemyMissile(this.x, this.y, t.a - 0.5, p);
    }
  }
  draw(ctx) {
    const f = this.hitFlash > 0, C = THEATRE.camo;
    ctx.save();
    ctx.translate(this.x, this.y);
    const oct = (r) => {
      ctx.beginPath();
      for (let i = 0; i < 8; i++) {
        const a = Math.PI / 8 + (i * TAU) / 8;
        if (i) ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
        else ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      ctx.closePath();
    };
    ctx.save();
    ctx.translate(5, 6);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    oct(36);
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = litFill(ctx, 0, 36, '#77746e', f);
    oct(36);
    ctx.fill();
    outlinePath(ctx);
    ctx.fillStyle = litFill(ctx, 0, 26, shade(C.main, -0.1), f);
    oct(26);
    ctx.fill();
    outlinePath(ctx);
    // Firing slits and roof vents.
    ctx.fillStyle = '#141516';
    for (let i = 0; i < 4; i++) {
      const a = (i * TAU) / 4;
      ctx.save();
      ctx.rotate(a);
      ctx.fillRect(29, -5, 4, 10);
      ctx.restore();
    }
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(-18, -20, 8, 5);
    ctx.fillRect(10, 15, 8, 5);
    // Radio mast.
    ctx.strokeStyle = '#2a2c2e';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-14, 14); ctx.lineTo(-24, 24);
    ctx.stroke();
    ctx.fillStyle = Math.floor(performance.now() / 500) % 2 ? '#ff4030' : '#601810';
    ctx.beginPath();
    ctx.arc(-24, 24, 2, 0, TAU);
    ctx.fill();
    // Quad flak turret.
    ctx.save();
    ctx.rotate(this.turret);
    ctx.fillStyle = '#25272a';
    for (const by of [-6, -2, 2, 6]) ctx.fillRect(6, by - 0.9, 20, 1.8);
    ctx.fillStyle = litFill(ctx, this.turret, 10, C.dark, f);
    ctx.beginPath();
    ctx.arc(0, 0, 11, 0, TAU);
    ctx.fill();
    outlinePath(ctx);
    ctx.restore();

    if (this.shielded) {
      const t = performance.now() / 1000;
      const hit = this.shieldHit > 0 ? 1 : 0;
      const dome = ctx.createRadialGradient(-12, -12, 10, 0, 0, 58);
      dome.addColorStop(0, `rgba(160,220,255,${0.06 + hit * 0.1})`);
      dome.addColorStop(0.85, `rgba(90,170,255,${0.16 + hit * 0.2})`);
      dome.addColorStop(1, `rgba(150,210,255,${0.5 + hit * 0.3})`);
      ctx.fillStyle = dome;
      ctx.beginPath();
      ctx.arc(0, 0, 58, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = `rgba(170,225,255,${0.35 + 0.25 * Math.sin(t * 4)})`;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([6, 8]);
      ctx.lineDashOffset = -t * 30;
      ctx.beginPath();
      ctx.arc(0, 0, 52, 0, TAU);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.restore();
    this.drawHealth(ctx);
  }
}

// ---------------------------------------------------------------- friendly units

// Aid convoy truck for the escort mission: drives the route, and counts as delivered
// at the end of it. Enemies shoot at it; the player's guns pass over it.
class AidTruck extends Truck {
  constructor(path, startDist) {
    super(path, startDist, 1);
    this.hp = this.maxHp = 110;
    this.objective = false;
    this.solid = true;
    this.speed = 44;
    this.waitT = 5; // the convoy waits a moment so you can get ahead of it
    this.paint = { main: '#e4e8ec', cover: '#3f78c8' };
  }
  update(dt, g) {
    this.hitFlash -= dt;
    this.waitT -= dt;
    const t = this.path[this.seg];
    if (!t || this.waitT > 0) return;
    if (Math.hypot(t.x - this.x, t.y - this.y) < 20) {
      this.seg++;
      if (this.seg >= this.path.length) {
        this.dead = true;
        this.gone = true;
        g.delivered++;
        g.banner('AID TRUCK DELIVERED', HUD_GREEN);
      }
      return;
    }
    this.angle = turnToward(this.angle, Math.atan2(t.y - this.y, t.x - this.x), 3 * dt);
    this.x += Math.cos(this.angle) * this.speed * dt;
    this.y += Math.sin(this.angle) * this.speed * dt;
  }
  die(g) {
    g.explode(this.x, this.y, this.boom, { ground: true });
    g.terrain.addDecal({ type: 'wreck', x: this.x, y: this.y, angle: this.angle, w: this.r * 1.6, h: this.r });
    g.emitters.push({ x: this.x, y: this.y, life: 10 });
    g.convoyLost++;
    g.banner('AID TRUCK LOST', HUD_RED);
  }
  draw(ctx) {
    super.draw(ctx);
    // Red cross on the canvas roof.
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle);
    ctx.fillStyle = '#e8ecef';
    ctx.fillRect(-12, -5, 10, 10);
    ctx.fillStyle = '#d8262a';
    ctx.fillRect(-11, -1.2, 8, 2.4);
    ctx.fillRect(-8.2, -4, 2.4, 8);
    ctx.restore();
  }
}

// Downed aircrew for the rescue mission. Hover slowly over them to take them aboard;
// militia search jeeps capture them if they get there first.
class Survivor {
  constructor(x, y) {
    this.x = x; this.y = y;
    this.r = 10;
    this.t = rand(0, 10);
    this.holdT = 0;
    this.dead = false;
    this.solid = false; // enemies don't shoot at them
    this.speed = 0; // so search jeeps can use them as a destination
  }
  update(dt, g) {
    this.t += dt;
    const p = g.player;
    const slow = Math.hypot(p.vx, p.vy) < 130;
    if (!p.dead && slow && dist2(p.x, p.y, this.x, this.y) < 75 * 75) {
      this.holdT += dt;
      if (this.holdT >= 1.2) {
        this.dead = true;
        g.carrying++;
        Sfx.pickup();
        g.banner('CREW ABOARD - RETURN TO BASE', HUD_GREEN);
      }
    } else this.holdT = Math.max(0, this.holdT - dt * 2);
    for (const e of g.enemies) {
      if (!e.dead && e.hunter && dist2(e.x, e.y, this.x, this.y) < 30 * 30) {
        this.dead = true;
        g.captured++;
        g.banner('CREW CAPTURED', HUD_RED);
        break;
      }
    }
  }
  draw(ctx) {
    // Orange signal smoke drifting off, a beacon ring, the waving crewman, and a ring
    // that fills while you pick them up.
    for (let i = 0; i < 4; i++) {
      const k = (this.t * 0.35 + i / 4) % 1;
      ctx.fillStyle = `rgba(255,130,40,${0.32 * (1 - k)})`;
      ctx.beginPath();
      ctx.arc(this.x + 10 + k * 46, this.y - 6 - k * 30, 6 + k * 16, 0, TAU);
      ctx.fill();
    }
    const pulse = (this.t * 0.8) % 1;
    ctx.strokeStyle = `rgba(255,150,50,${0.9 * (1 - pulse)})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(this.x, this.y, 14 + pulse * 50, 0, TAU);
    ctx.stroke();
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.scale(1.7, 1.7);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(2, 3, 6, 4, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#ff7a1a';
    ctx.beginPath();
    ctx.roundRect(-4, -3, 8, 7, 2);
    ctx.fill();
    ctx.fillStyle = '#e8c8a0';
    ctx.beginPath();
    ctx.arc(0, -4, 3, 0, TAU);
    ctx.fill();
    // Waving arm.
    const wave = Math.sin(this.t * 8) * 0.6;
    ctx.strokeStyle = '#ff7a1a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(3, -1);
    ctx.lineTo(3 + Math.cos(-1 + wave) * 6, -1 + Math.sin(-1 + wave) * 6);
    ctx.stroke();
    ctx.restore();
    if (this.holdT > 0) {
      ctx.strokeStyle = HUD_GREEN;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(this.x, this.y, 26, -Math.PI / 2, -Math.PI / 2 + (this.holdT / 1.2) * TAU);
      ctx.stroke();
    }
  }
}

// The base's command building for the defence mission. It sits where the hangar is
// drawn, so it only adds damage effects and a health bar to the base picture.
class BaseHQ {
  constructor(x, y, hp) {
    this.x = x; this.y = y;
    this.r = 44;
    this.hp = this.maxHp = hp;
    this.hitFlash = 0;
    this.dead = false;
    this.solid = true;
  }
  hurt(n, g) {
    if (this.dead) return;
    this.hp -= n;
    this.hitFlash = 0.08;
    if (this.hp <= 0) {
      this.hp = 0;
      this.dead = true;
      g.explode(this.x, this.y, 90, { ground: true, ring: true });
      g.emitters.push({ x: this.x, y: this.y, life: 30 });
    }
  }
  update(dt, g) {
    this.hitFlash -= dt;
    const f = this.hp / this.maxHp;
    if (f < 0.6 && Math.random() < dt * (1 - f) * 12) {
      g.particles.push(new Particle(this.x + rand(-35, 35), this.y + rand(-22, 22), rand(5, 15), rand(-10, -2), rand(1.5, 2.5), rand(6, 10), 12, 'smoke'));
      if (f < 0.3) g.particles.push(new Particle(this.x + rand(-30, 30), this.y + rand(-20, 20), 0, 0, 0.4, rand(5, 9), 5, 'fire'));
    }
  }
  draw(ctx) {
    if (this.hitFlash > 0) {
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.fillRect(this.x - 45, this.y - 30, 90, 60);
    }
    const w = 90;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(this.x - w / 2, this.y - 44, w, 6);
    ctx.fillStyle = this.hp > this.maxHp * 0.35 ? HUD_GREEN : HUD_RED;
    ctx.fillRect(this.x - w / 2, this.y - 44, (w * this.hp) / this.maxHp, 6);
  }
}
