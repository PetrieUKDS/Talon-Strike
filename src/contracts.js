'use strict';

// Contracts: endless generated missions, unlocked after Operation Frostbite.
// A contract is built from a seed and a rank. The seed picks a theatre, a fresh island,
// one or two objectives and sometimes a twist; the rank sets enemy strength, target
// counts and pay. makeContract() returns an object shaped like a MISSIONS entry, so the
// game flies it the same way. The same seed and rank always give the same contract,
// enemy placements included (the game seeds the random numbers while it sets up).

const THEATRE_MUSIC = { desert: 0, temperate: 1, canyon: 2, arctic: 3, jungle: 4, ash: 5 };
const CODE_A = ['IRON', 'SILENT', 'BROKEN', 'COLD', 'BLACK', 'HOLLOW', 'BURNING', 'WHITE', 'STEEL', 'GHOST', 'SHATTERED', 'LONG', 'HIGH', 'LAST', 'DISTANT', 'SWIFT'];
const CODE_B = ['ANVIL', 'SPEAR', 'HARVEST', 'LANTERN', 'HAMMER', 'VIGIL', 'TIDE', 'FURNACE', 'ORCHARD', 'SPARROW', 'COMPASS', 'THUNDER', 'GAUNTLET', 'EMBER', 'WATCH', 'HORIZON'];
const ACE_NAMES = ['BLACK ADDER', 'IRON KITE', 'WIDOWMAKER', 'SCORPION', 'NIGHTJAR', 'RED TALON II', 'HELLHOUND', 'GRAVEDIGGER'];
const DAILY_RANK = 5;
const REROLL_COST = 300;

// Twists make a contract harder and pay more.
const TWISTS = [
  { id: 'night', label: 'NIGHT', pay: 1.25, brief: 'It is a night operation. Watch for headlights.' },
  { id: 'noflares', label: 'NO FLARES', pay: 1.35, brief: 'No flares are fitted for this one. Shoot incoming missiles down or outfly them.' },
  { id: 'swarm', label: 'SWARM', pay: 1.3, brief: 'Expect heavy resistance: reinforcements arrive twice as fast.' },
  { id: 'blitz', label: 'BLITZ', pay: 1.35, brief: 'Hard time limit. If the clock runs out, the contract is void.' },
  { id: 'thin', label: 'THIN ARMOUR', pay: 1.3, brief: 'Your armour has not been refitted. You take 50% more damage.' },
];

const capped = (base, rank, per, max) => Math.min(max, base + Math.floor(rank / per));

// Each objective builds a stage for a rank: briefing lines, a short headline for the
// HUD banner when it comes up as new orders, its par time, the reinforcement types,
// and setup/update/objective/status like a campaign mission.
// road: lays a road, so it can only be the first stage (chunks already drawn wouldn't show it).
const CONTRACT_OBJECTIVES = {
  sam: {
    label: 'SAM SITES',
    make(rank) {
      const n = capped(3, rank, 4, 6);
      return {
        headline: `DESTROY ${n} SAM SITES`,
        brief: [`Militia crews have set up ${n} surface-to-air missile sites. Destroy every one.`, 'Each site is guarded by armour.'],
        par: 120 + n * 55,
        types: ['jeep', 'jeep', 'tank', 'gunship'],
        setup(g) {
          const placed = [];
          for (let i = 0; i < n; i++) {
            const pt = g.landPoint(g.base, 1300, 2800, (p) => placed.every((q) => dist(p.x, p.y, q.x, q.y) > 900));
            placed.push(pt);
            const sam = new SamSite(pt.x, pt.y, g.difficulty);
            sam.objective = true;
            g.enemies.push(sam);
            g.spawnNear('jeep', pt, 150, 350);
            g.spawnNear(i % 2 ? 'jeep' : 'tank', pt, 120, 300);
          }
        },
        objective: (g) => `SAM SITES REMAINING: ${g.objectivesLeft()}`,
        status: (g) => (g.objectivesLeft() === 0 ? 'won' : null),
      };
    },
  },
  depots: {
    label: 'FUEL DEPOTS',
    make(rank) {
      const n = capped(4, rank, 3, 8);
      return {
        headline: `DESTROY ${n} FUEL DEPOTS`,
        brief: [`Destroy ${n} fuel depots. Anti-aircraft guns ring each one.`, 'Depots burn hot. Do not hover over one when it goes up.'],
        par: 100 + n * 50,
        types: ['jeep', 'tank', 'gunship', 'aa'],
        setup(g) {
          const placed = [];
          for (let i = 0; i < n; i++) {
            const pt = g.landPoint(g.base, 1000, 3000, (p) => placed.every((q) => dist(p.x, p.y, q.x, q.y) > 700));
            placed.push(pt);
            g.enemies.push(new FuelDepot(pt.x, pt.y, g.difficulty));
            for (let j = 0; j < 2; j++) g.spawnNear('aa', pt, 110, 220);
            if (i % 2) g.spawnNear('tank', pt, 150, 320);
          }
        },
        objective: (g) => `FUEL DEPOTS REMAINING: ${g.objectivesLeft()}`,
        status: (g) => (g.objectivesLeft() === 0 ? 'won' : null),
      };
    },
  },
  boats: {
    label: 'GUNBOATS',
    make(rank) {
      const n = capped(4, rank, 3, 9);
      const armed = Math.min(n - 1, 1 + Math.floor(rank / 4));
      return {
        headline: `SINK ${n} GUNBOATS`,
        brief: [`Sink ${n} militia gunboats off the coast.`, `${armed} of them carry anti-air missiles.`],
        par: 90 + n * 40,
        types: ['gunship', 'jeep', 'aa', 'jet'],
        setup(g) {
          const placed = [];
          for (let i = 0; i < n; i++) {
            const pt = g.waterPoint(g.base, 900, 2800, (p) => placed.every((q) => dist(p.x, p.y, q.x, q.y) > 500));
            placed.push(pt);
            g.enemies.push(Object.assign(new PatrolBoat(pt.x, pt.y, g.difficulty, i < armed), { objective: true }));
            if (i % 3 === 0) g.spawnNear('aa', pt, 150, 450);
          }
          g.spawnNear('gunship', placed[0], 200, 500);
        },
        objective: (g) => `GUNBOATS REMAINING: ${g.objectivesLeft()}`,
        status: (g) => (g.objectivesLeft() === 0 ? 'won' : null),
      };
    },
  },
  shield: {
    label: 'SHIELD BUNKER',
    make(rank) {
      const n = capped(3, rank, 6, 5);
      return {
        headline: 'DROP THE SHIELD, DESTROY THE BUNKER',
        brief: [`A command bunker sits behind a shield fed by ${n} generators.`, 'Knock out the generators, then flatten the bunker.'],
        par: 150 + n * 55,
        types: ['tank', 'jeep', 'gunship', 'aa', 'jet'],
        setup(g) {
          const hq = g.landPoint(g.base, 2000, 3200);
          g.enemies.push(new Bunker(hq.x, hq.y, g.difficulty));
          const sam = g.landPoint(hq, 250, 450);
          g.enemies.push(new SamSite(sam.x, sam.y, g.difficulty));
          const placed = [];
          for (let i = 0; i < n; i++) {
            const pt = g.landPoint(hq, 550, 1200, (p) => placed.every((q) => dist(p.x, p.y, q.x, q.y) > 500));
            placed.push(pt);
            g.enemies.push(new Generator(pt.x, pt.y, g.difficulty));
            g.spawnNear('aa', pt, 110, 220);
            g.spawnNear('tank', pt, 150, 320);
          }
        },
        objective(g) {
          const gens = g.enemies.filter((e) => e instanceof Generator && !e.dead).length;
          if (gens) return `GENERATORS: ${gens}   BUNKER SHIELDED`;
          return g.objectivesLeft() ? 'DESTROY THE COMMAND BUNKER' : 'COMMAND BUNKER DESTROYED';
        },
        status: (g) => (g.objectivesLeft() === 0 ? 'won' : null),
      };
    },
  },
  ace: {
    label: 'ACE HUNT',
    make(rank, r) {
      const n = rank >= 9 ? 2 : 1;
      const names = [ACE_NAMES[Math.floor(r() * ACE_NAMES.length)]];
      if (n > 1) names.push(ACE_NAMES.find((a) => a !== names[0] && r() < 0.5) || 'HELLHOUND');
      return {
        headline: `DESTROY ${names.join(' AND ')}`,
        brief: [`A militia ace flying a stolen gunship, callsign ${names.join(', with a wingman callsign ')}, is operating here.`, 'It is fast and carries its own missiles. Find it and bring it down.'],
        par: 200 + n * 90,
        types: ['gunship', 'jet', 'jeep', 'tank'],
        setup(g) {
          const lair = g.landPoint(g.base, 2400, 3600);
          names.forEach((name, i) => {
            const pt = i ? g.landPoint(lair, 300, 600) : lair;
            g.enemies.push(Object.assign(new Boss(pt.x, pt.y, g.difficulty), { name }));
          });
          const sam = g.landPoint(lair, 300, 700);
          g.enemies.push(new SamSite(sam.x, sam.y, g.difficulty));
          for (let i = 0; i < 2; i++) g.spawnNear('gunship', lair, 400, 900);
        },
        objective(g) {
          const left = g.enemies.filter((e) => e.isBoss && !e.dead);
          return left.length ? `DESTROY ${left.map((b) => b.name).join(' + ')}` : 'ACES DESTROYED';
        },
        status: (g) => (g.objectivesLeft() === 0 ? 'won' : null),
      };
    },
  },
  rescue: {
    label: 'RESCUE',
    make(rank) {
      const n = capped(3, rank, 5, 5);
      return {
        headline: `RESCUE ${n} DOWNED CREW`,
        brief: [`${n} downed aircrew are waiting by orange smoke. Militia search teams are closing in.`, 'Hover slowly over each one to take them aboard, then land on the base pad.', 'If more than one is captured, the contract is void.'],
        failText: 'Too many of the crew were captured.',
        par: 100 + n * 65,
        types: ['gunship', 'jeep', 'aa'],
        setup(g) {
          const placed = [];
          for (let i = 0; i < n; i++) {
            const pt = g.landPoint(g.base, 1100, 2700, (p) => placed.every((q) => dist(p.x, p.y, q.x, q.y) > 750));
            placed.push(pt);
            const s = new Survivor(pt.x, pt.y);
            g.friendlies.push(s);
            if (i === 0) {
              g.terrain.addDecal({ type: 'scorch', x: pt.x + 60, y: pt.y + 30, r: 70 });
              g.terrain.addDecal({ type: 'wreck', x: pt.x + 60, y: pt.y + 30, angle: rand(0, TAU), w: 46, h: 22 });
              g.emitters.push({ x: pt.x + 60, y: pt.y + 30, life: 120 });
            }
            // Search teams start further out for each survivor, so there's time to reach them in turn.
            for (let j = 0; j < 2; j++) {
              const hp = g.landPoint(pt, 1300 + i * 600, 1600 + i * 600);
              const jeep = new Jeep(hp.x, hp.y, g.difficulty, s);
              jeep.offset = { x: 0, y: 0 };
              jeep.speed = 45 + Math.min(20, rank * 1.5);
              jeep.hunter = true;
              g.enemies.push(jeep);
            }
            if (i % 2) g.spawnNear('aa', pt, 250, 450);
          }
        },
        update(g) {
          if (g.carrying && g.player.onPad) {
            g.rescued += g.carrying;
            g.banner(`${g.carrying} CREW SAFE`, HUD_GREEN);
            Sfx.confirm();
            g.carrying = 0;
          }
        },
        objective: (g) => `CREW WAITING: ${aliveCount(g.friendlies, Survivor)}   ABOARD: ${g.carrying}   SAFE: ${g.rescued}   CAPTURED: ${g.captured}/1`,
        status(g) {
          if (g.captured > 1) return 'lost';
          return aliveCount(g.friendlies, Survivor) === 0 && g.carrying === 0 ? 'won' : null;
        },
      };
    },
  },
  defend: {
    label: 'DEFEND BASE',
    calm: true, // no ordinary reinforcements: the waves are the attack
    make(rank) {
      const waves = capped(3, rank, 4, 6);
      return {
        headline: `HOLD THE BASE FOR ${waves} WAVES`,
        brief: [`${waves} waves of armour and gunships are coming for the base. Keep the command building standing.`, 'Land on the pad between waves to repair and rearm.'],
        failText: 'The command building was destroyed.',
        par: 90 + waves * 60,
        types: ['jeep'],
        setup(g) {
          g.hq = new BaseHQ(g.base.x - 75, g.base.y - 82, 900);
          g.hq.speed = 0;
          g.friendlies.push(g.hq);
          g.wave = 0;
          g.waveT = 6;
        },
        update(g, dt) {
          const left = g.enemies.filter((e) => e.wave && !e.dead).length;
          if (left || g.wave >= waves) return;
          g.waveT -= dt;
          if (g.waveT > 0) return;
          if (g.wave) g.hq.hp = Math.min(g.hq.maxHp, g.hq.hp + g.hq.maxHp * 0.2);
          g.wave++;
          g.waveT = 8;
          g.banner(`WAVE ${g.wave} OF ${waves}`, HUD_RED);
          // Later waves of a longer defence hit as hard as the campaign's last ones.
          const k = Math.ceil((g.wave * 5) / waves) + Math.floor(rank / 6);
          const add = (e) => {
            e.wave = true;
            g.enemies.push(e);
            return e;
          };
          for (let i = 0; i < 2 + k; i++) {
            const pt = g.landPoint(g.base, 720, 820);
            add(new Jeep(pt.x, pt.y, g.difficulty, g.hq)).aware = true;
          }
          for (let i = 0; i < Math.ceil(k / 2); i++) {
            const pt = g.landPoint(g.base, 720, 800);
            add(new Tank(pt.x, pt.y, g.difficulty));
          }
          for (let i = 0; i < k - 1; i++) {
            const a = rand(0, TAU);
            add(new Gunship(g.base.x + Math.cos(a) * 1300, g.base.y + Math.sin(a) * 1300, g.difficulty)).aware = true;
          }
          if (k >= 4) {
            const a = rand(0, TAU);
            add(new Jet(g.base.x + Math.cos(a) * 1700, g.base.y + Math.sin(a) * 1700, g.base.x, g.base.y, g.difficulty));
            Sfx.jet();
          }
        },
        objective(g) {
          const pct = Math.ceil((100 * g.hq.hp) / g.hq.maxHp);
          if (!g.wave) return `FIRST WAVE IN ${Math.ceil(g.waveT)}   BASE ${pct}%`;
          const left = g.enemies.filter((e) => e.wave && !e.dead).length;
          return `WAVE ${g.wave}/${waves}   HOSTILES: ${left}   BASE ${pct}%`;
        },
        status(g) {
          if (g.hq.dead) return 'lost';
          const left = g.enemies.filter((e) => e.wave && !e.dead).length;
          return g.wave >= waves && left === 0 ? 'won' : null;
        },
      };
    },
  },
  convoy: {
    label: 'CONVOY',
    road: true,
    make(rank) {
      const n = capped(5, rank, 4, 9);
      return {
        headline: `STOP THE ${n}-TRUCK CONVOY`,
        brief: [`An arms convoy of ${n} trucks is heading for the border. Destroy every truck.`, 'If more than two make it across, the contract is void.'],
        failText: 'Too many trucks crossed the border.',
        par: 120 + n * 18,
        types: ['gunship', 'jeep', 'jet'],
        setup(g) {
          const { path, start, end } = windingRoad(g, () => g.landPoint(g.base, 1700, 2400),
            (s) => g.landPoint(s, 2600, 3600, (p) => dist(p.x, p.y, g.base.x, g.base.y) > 1400));
          g.checkpoint = end;
          g.checkpointLabel = 'BORDER';
          g.allowedEscapes = 2;
          const trucks = [];
          for (let i = 0; i < n; i++) {
            const tr = new Truck(path, 40 + (n - 1 - i) * 85, g.difficulty);
            trucks.push(tr);
            g.enemies.push(tr);
          }
          for (let i = 1; i < n; i += 2) {
            const leader = trucks[i];
            g.enemies.push(new Jeep(leader.x + rand(-40, 40), leader.y + rand(-40, 40), g.difficulty, leader));
          }
          g.spawnNear('tank', start, 80, 200);
          g.spawnNear('tank', end, 120, 260);
        },
        objective: (g) => `TRUCKS: ${g.objectivesLeft()}   ESCAPED: ${g.escaped}/${g.allowedEscapes}`,
        status(g) {
          if (g.escaped > g.allowedEscapes) return 'lost';
          return g.objectivesLeft() === 0 ? 'won' : null;
        },
      };
    },
  },
  escort: {
    label: 'ESCORT',
    road: true,
    make(rank) {
      const ambush = capped(4, rank, 4, 7);
      return {
        headline: 'ESCORT THE AID CONVOY',
        brief: ['Four aid trucks are rolling out from the base to a town cut off by the fighting.', `Militia raiders are waiting in ${ambush} ambushes along the road. Clear the way.`, 'Lose more than one truck and the contract is void.'],
        failText: 'Too many aid trucks were destroyed.',
        par: 300,
        types: ['jeep', 'gunship', 'tank'],
        setup(g) {
          const { path, end } = windingRoad(g, () => g.landPoint(g.base, 700, 900),
            (s) => g.landPoint(s, 2800, 3600, (p) => dist(p.x, p.y, g.base.x, g.base.y) > 1800));
          g.checkpoint = end;
          g.checkpointLabel = 'TOWN';
          for (let i = 0; i < 4; i++) g.friendlies.push(new AidTruck(path, 40 + (3 - i) * 90));
          for (let k = 0; k < ambush; k++) {
            const pt = roadAt(path, (2.5 + (k * 6) / ambush) / 9);
            for (let j = 0; j < 2; j++) g.spawnNear('jeep', pt, 220, 420);
            g.spawnNear(k % 2 ? 'tank' : 'aa', pt, 200, 380);
          }
        },
        objective: (g) => `CONVOY: ${aliveCount(g.friendlies, AidTruck)} ON THE ROAD   DELIVERED: ${g.delivered}   LOST: ${g.convoyLost}/1`,
        status(g) {
          if (g.convoyLost > 1) return 'lost';
          return aliveCount(g.friendlies, AidTruck) === 0 ? 'won' : null;
        },
      };
    },
  },
};

// A whole number seed for the k-th contract on a board.
const subSeed = (seed, k) => Math.floor(hash2(seed, k) * 2147483647) + 1;

// kind: 'board' (an ordinary offer), 'risk' (a higher-rank offer) or 'daily'.
function makeContract(seed, rank, kind = 'board') {
  const r = mulberry32(seed);
  const pickR = (arr) => arr[Math.floor(r() * arr.length)];
  const theatre = pickR(Object.keys(THEATRE_MUSIC));
  const ids = Object.keys(CONTRACT_OBJECTIVES);
  const order = [pickR(ids)];
  if (rank >= 4 && r() < Math.min(0.45, 0.12 + rank * 0.025)) {
    order.push(pickR(ids.filter((id) => id !== order[0] && !CONTRACT_OBJECTIVES[id].road)));
  }
  const twist = r() < Math.min(0.6, 0.12 + rank * 0.04) ? pickR(TWISTS) : null;
  const stages = order.map((id) => CONTRACT_OBJECTIVES[id].make(rank, r));
  const mapSeed = 1 + Math.floor(r() * 999999);
  const title = `OPERATION ${pickR(CODE_A)} ${pickR(CODE_B)}`;
  const par = Math.round(stages.reduce((s, st) => s + st.par, 0) / 10) * 10;
  const limit = twist && twist.id === 'blitz' ? Math.round(par * 1.15) : 0;
  let pay = (1000 + 400 * rank) * (twist ? twist.pay : 1) * (stages.length > 1 ? 1.6 : 1);
  if (kind === 'daily') pay *= 2;
  pay = Math.round(pay / 50) * 50;

  const brief = [`Skywatch to {callsign}. ${kind === 'daily' ? 'Daily contract' : 'Contract'}, rank ${rank}.`, ...stages[0].brief];
  if (stages.length > 1) brief.push('When that is done, stand by. There will be new orders.');
  if (twist) brief.push(twist.brief);

  const m = {
    title,
    theatre,
    seed: mapSeed,
    setupSeed: seed,
    music: THEATRE_MUSIC[theatre],
    night: !!twist && twist.id === 'night',
    par,
    limit,
    brief,
    failText: '',
    stage: 0,
    contract: {
      seed, rank, kind, twist, pay,
      labels: order.map((id) => CONTRACT_OBJECTIVES[id].label),
    },
    get reinforce() {
      const st = stages[this.stage];
      if (CONTRACT_OBJECTIVES[order[this.stage]].calm) return { every: 9999, cap: 0, types: ['jeep'] };
      let every = Math.max(9, 14 - rank * 0.25), cap = 16 + Math.min(10, rank / 2);
      if (twist && twist.id === 'swarm') {
        every *= 0.5;
        cap *= 1.5;
      }
      return { every, cap, types: st.types };
    },
    setup(g) {
      this.stage = 0;
      this.failText = stages[0].failText || '';
      stages[0].setup(g);
      for (let i = 0; i < 4; i++) g.spawnNear(i % 2 ? 'jeep' : rank > 6 ? 'tank' : 'jeep', g.base, 900, 2400);
      if (twist && twist.id === 'noflares') g.player.flares = g.player.maxFlares = 0;
      if (twist && twist.id === 'thin') g.player.hurtMult *= 1.5;
    },
    update(g, dt) {
      const st = stages[this.stage];
      if (st.update) st.update(g, dt);
    },
    objective(g) {
      let text = stages[this.stage].objective(g);
      if (stages.length > 1) text = `[${this.stage + 1}/${stages.length}] ${text}`;
      return text;
    },
    status(g) {
      if (limit && g.missionTime > limit) {
        this.failText = 'Out of time. The contract is void.';
        return 'lost';
      }
      const s = stages[this.stage].status(g);
      if (s === 'lost') this.failText = stages[this.stage].failText || 'The objective was lost.';
      if (s !== 'won' || this.stage >= stages.length - 1) return s;
      this.stage++;
      withSeed(seed + this.stage, () => stages[this.stage].setup(g));
      this.failText = stages[this.stage].failText || '';
      g.banner('NEW ORDERS', HUD_AMBER);
      g.banner(stages[this.stage].headline, HUD_GREEN);
      Sfx.confirm();
      return null;
    },
  };
  return m;
}

// Today's date in the player's own time zone, as YYYY-MM-DD.
function todayKey(offsetDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// The same contract for every player on a given day.
function dailyContract() {
  const n = Number(todayKey().replace(/-/g, ''));
  return makeContract(subSeed(n, 7), DAILY_RANK, 'daily');
}
