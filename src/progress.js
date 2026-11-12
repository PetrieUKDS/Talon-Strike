'use strict';

// Saved campaign: which missions are unlocked, best score per mission, workshop funds,
// upgrades bought, and the chosen difficulty. Stored in localStorage.

// enemy scales enemy toughness and fire rate; hurt scales damage the player takes.
const DIFFICULTIES = [
  { id: 'easy', name: 'EASY', enemy: 0.75, hurt: 0.65 },
  { id: 'normal', name: 'NORMAL', enemy: 1, hurt: 1 },
  { id: 'hard', name: 'HARD', enemy: 1.3, hurt: 1.3 },
];

// Workshop upgrades. They apply to whichever aircraft you fly; costs are per level.
// Levels 4 and 5 unlock at contract ranks UPGRADE_RANKS[0] and [1].
const UPGRADES = [
  { id: 'armor', name: 'ARMOUR PLATING', desc: '+15% armour', costs: [1500, 3000, 5000, 8000, 12000] },
  { id: 'cooling', name: 'GUN COOLING', desc: '-15% gun heat', costs: [1200, 2500, 4500, 7000, 10000] },
  { id: 'racks', name: 'MISSILE RACKS', desc: '+2 missiles', costs: [1500, 3000, 5000, 8000, 12000] },
  { id: 'flares', name: 'FLARE PODS', desc: '+1 flare', costs: [800, 1600, 3000, 5000, 7500] },
  { id: 'engine', name: 'ENGINE TUNING', desc: '+6% speed', costs: [1500, 3000, 5000, 8000, 12000] },
];
const UPGRADE_RANKS = [5, 10];

const newBoardSeed = () => 1 + Math.floor(Math.random() * 2147483646);

const SAVE_KEY = 'chopperGunner.save';
const SETTINGS_KEY = 'chopperGunner.settings';

// Player preferences, kept apart from the campaign save. Volumes run 0-10.
// autofire: null means on for touch controls only. effects: 'auto', 'high' or 'low'.
const Settings = {
  data: { v: 2, music: 7, sfx: 8, shake: true, autofire: null, effects: 'auto', vibrate: true, tutorial: true },

  load() {
    try {
      const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) || 'null');
      if (saved && typeof saved === 'object') {
        // Version 1 saved auto-fire as off by default; move those players to the touch default.
        if (saved.v !== 2 && saved.autofire === false) saved.autofire = null;
        Object.assign(this.data, saved, { v: 2 });
      }
    } catch (e) { /* storage unavailable or corrupt: keep defaults */ }
    this.apply();
  },

  write() {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(this.data));
    } catch (e) { /* storage unavailable */ }
    this.apply();
  },

  apply() {
    Sfx.setVolumes(this.data.music / 10, this.data.sfx / 10);
  },
};

const Save = {
  data: null,

  load() {
    this.data = { unlocked: 1, best: {}, stars: {}, funds: 0, upgrades: {}, difficulty: 'normal', campaignDone: false };
    try {
      const saved = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null');
      if (saved && typeof saved === 'object') Object.assign(this.data, saved);
    } catch (e) { /* storage unavailable or corrupt: start fresh */ }
  },

  write() {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(this.data));
    } catch (e) { /* storage unavailable */ }
  },

  level(id) {
    return this.data.upgrades[id] || 0;
  },

  difficulty() {
    return DIFFICULTIES.find((d) => d.id === this.data.difficulty) || DIFFICULTIES[1];
  },

  setDifficulty(step) {
    const i = DIFFICULTIES.indexOf(this.difficulty());
    this.data.difficulty = DIFFICULTIES[clamp(i + step, 0, DIFFICULTIES.length - 1)].id;
    this.write();
  },

  // Upgrade levels plus difficulty, in the shape Player expects.
  mods() {
    const m = { hurt: this.difficulty().hurt };
    for (const u of UPGRADES) m[u.id] = this.level(u.id);
    return m;
  },

  // Record a cleared mission: unlock the next one, keep the best score and star count,
  // bank the earnings. Clearing the last mission finishes the campaign.
  cleared(index, earned, stars) {
    const i = index % MISSIONS.length;
    this.data.unlocked = Math.max(this.data.unlocked, Math.min(MISSIONS.length, i + 2));
    this.data.best[i] = Math.max(this.data.best[i] || 0, earned);
    this.data.stars[i] = Math.max(this.data.stars[i] || 0, stars);
    if (i === MISSIONS.length - 1) this.data.campaignDone = true;
    this.data.funds += earned;
    this.write();
  },

  // How many upgrade levels are on sale: three, plus one for each contract rank milestone.
  maxLevel() {
    return 3 + UPGRADE_RANKS.filter((r) => this.contracts().rank >= r).length;
  },

  // Undefined when the upgrade is maxed out or its next level is still locked.
  nextCost(id) {
    const u = UPGRADES.find((x) => x.id === id);
    if (this.level(id) >= this.maxLevel()) return undefined;
    return u.costs[this.level(id)];
  },

  // ---------------------------------------------------------- contracts

  contractsOpen() {
    return this.data.unlocked >= 4 || this.data.campaignDone;
  },

  // rank: the rank of the next ordinary contracts. board: seed of the current offers.
  contracts() {
    if (!this.data.contracts) this.data.contracts = { rank: 1, board: newBoardSeed(), cleared: 0, top: 0 };
    return this.data.contracts;
  },

  // Today's daily contract record, starting a fresh one each day.
  daily() {
    const today = todayKey();
    if (!this.data.daily || this.data.daily.date !== today) this.data.daily = { date: today, best: 0, done: false };
    return this.data.daily;
  },

  // Days in a row with the daily contract cleared, counting today or yesterday as the latest.
  streak() {
    const s = this.data.streak;
    if (!s || (s.last !== todayKey() && s.last !== todayKey(-1))) return 0;
    return s.count;
  },

  newBoard() {
    this.contracts().board = newBoardSeed();
    this.write();
  },

  reroll() {
    if (this.data.funds < REROLL_COST) return false;
    this.data.funds -= REROLL_COST;
    this.newBoard();
    return true;
  },

  // Record a cleared contract. Ordinary ones raise your rank past the one you cleared and
  // deal a new board; the daily one counts towards your streak, once a day.
  contractCleared(info, earned, score) {
    const c = this.contracts();
    this.data.funds += earned;
    c.cleared++;
    if (info.kind === 'daily') {
      const d = this.daily();
      d.best = Math.max(d.best, score);
      if (!d.done) {
        d.done = true;
        const s = this.data.streak;
        this.data.streak = { count: s && s.last === todayKey(-1) ? s.count + 1 : 1, last: todayKey() };
      }
    } else {
      c.rank = Math.max(c.rank, info.rank + 1);
      c.top = Math.max(c.top, info.rank);
      c.board = newBoardSeed();
    }
    this.write();
  },

  buy(id) {
    const cost = this.nextCost(id);
    if (cost === undefined || this.data.funds < cost) return false;
    this.data.funds -= cost;
    this.data.upgrades[id] = this.level(id) + 1;
    this.write();
    return true;
  },
};
