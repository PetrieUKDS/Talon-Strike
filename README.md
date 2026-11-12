# Talon Strike

A top-down helicopter gunship game for the browser, drawn on a single canvas. There's no build step and no dependencies. All sound, music included, is synthesised live with WebAudio, so there are no audio files.

## Music

Each mission has its own original synth soundtrack, in the style of 80s TV action themes. Each one plays a short intro, then loops a groove section and a lead melody section:

| Mission | Track | Tempo | Key |
| --- | --- | --- | --- |
| Operation Sandstorm (also the title screen) | Sandstorm | 132 BPM | A minor |
| Operation Iron Road | Iron Road | 144 BPM | E minor |
| Operation Frostbite | Frostbite | 124 BPM | F# minor |
| Operation Green Hell | Green Hell | 138 BPM | G minor |
| Operation Black Gold | Black Gold | 150 BPM | C minor |
| Operation Red Talon | Red Talon | 116 BPM | D minor |

Operations Lifeline, Safe Passage and Last Stand reuse the Green Hell, Sandstorm and Black Gold tracks.

The music starts with your first key press or click, because browsers won't play sound before that. M mutes it along with the sound effects (the settings screen has separate volume sliders for each), and it pauses while the tab is hidden. The songs are written as note data in `src/music.js`: chords, bass and drum patterns, and the melody, one bar of sixteenth notes per line. They were composed for this game, so you're free to use, change and redistribute them with it.

## Running it

Play it online at https://petrieukds.github.io/Talon-Strike/. GitHub Pages republishes it a minute or two after each push to `main`.

### Install it and play offline

The game is a web app, so you can add it to your home screen and it opens full-screen, like an app:

- **Android (Chrome):** open the link, then menu **⋮ → Add to Home screen** (or **Install app**).
- **iPhone / iPad (Safari):** open the link, tap **Share → Add to Home Screen**.
- **Desktop Chrome or Edge:** click the install icon at the right of the address bar.

After your first visit, the game also works with no connection. A service worker (`sw.js`) keeps a copy of every file. It always tries the network first, so you get the newest version whenever you're online.

To run it locally, open `index.html` in a modern browser.

If your browser blocks local files, serve the folder instead:

```bash
npx serve .
```

or

```bash
python -m http.server 8000
```

Then go to http://localhost:8000 (or whatever port `serve` prints).

Your campaign progress, contract rank and daily streak, star ratings, funds, upgrades, difficulty, settings, best scores, key bindings and chosen aircraft are saved in the browser's `localStorage`, so each browser and device keeps its own save.

## Controls

| Action | Keys |
| --- | --- |
| Fly | W / A / S / D |
| Turn | ← / → or Q / E |
| Chain guns | Space (or ↑) |
| Missiles | ↓ or K |
| Flares | F (or L) |
| Turbo | Shift |
| Pause | P or Esc |
| Mute | M |
| Rebind keys | C (on the title screen or while paused) |
| Settings | O (on the title screen, mission select or while paused) |

The mouse also works for aiming and firing.

### Phones and tablets

- **Twin-stick touch controls:** drag on the left half of the screen to fly and on the right half to aim. Auto-fire is on for touch by default, so your guns fire at anything in front of you. On-screen buttons cover missiles, flares, turbo and pause.
- **Landscape only:** if you hold the phone upright, the game pauses and asks you to rotate it. On Android it also goes full-screen on your first tap.
- **Fits around the screen:** the buttons scale with the screen, and the HUD keeps clear of notches and the home bar.
- **Vibration:** phones that support it buzz when you're hit.

### Gamepad

Any standard controller (Xbox, PlayStation and similar) works as soon as you press a button:

| Action | Button |
| --- | --- |
| Fly | Left stick |
| Aim | Right stick |
| Chain guns | Right trigger |
| Missiles | Left trigger |
| Flares | Right bumper |
| Turbo | Left bumper or left stick click |
| Pause | Start |
| Mute | Back / Select |
| Menus | D-pad or left stick to move, A to confirm, B to go back |

Land on your base pad to repair and rearm. Your guns overheat if you hold the trigger too long. Flares break enemy missile locks.

### Settings

| Setting | What it does |
| --- | --- |
| Music volume | 0–10 |
| Sound volume | 0–10, for everything except the music |
| Auto-fire | **TOUCH** (default): on with touch controls only. **ON**: always. **OFF**: never. Your guns fire by themselves whenever a target is in front of your nose and in range, so you only have to aim. Handy on a touchpad too. |
| Effects | **AUTO** (default) starts on high and switches to low by itself if the game runs below about 40 frames a second. **HIGH** or **LOW** fixes it. Low draws at normal resolution on high-density screens, and halves the particles and weather. |
| Screen shake | Turn the camera shake from explosions and hits on or off |
| Vibration | Buzz when you're hit, on phones that support it |
| Training | Show the first-flight guide at the start of Operation Sandstorm. It turns itself off once you finish or skip it, so switch it back on to see it again. |

### Feedback

Settings has a **SEND FEEDBACK** button that opens a Tally form in a new tab. It passes along which controls you're using, your screen size, the effects level and the last mission you played, so reports come with some context. Nothing personal is sent. The form link is `FEEDBACK_URL` at the top of `src/game.js`, and the button stays hidden while that's empty.

### Training

The first time you fly Operation Sandstorm, a five-step guide walks you through flying, firing, missiles, flares and landing on the pad to repair. The hints match whatever you're playing with: touch, gamepad or keyboard. Enemies don't send reinforcements and the par clock doesn't run until training is over. Press Tab, or tap **TAP TO SKIP**, to skip it.

### Warnings

- When an enemy missile locks on, red arrows around your aircraft point at it, getting bigger and brighter as it closes. The lock tone beeps faster and higher as it gets nearer.
- When you're hit, a red arc flashes on the side the shot came from, and the screen edges glow red.

### Pickups

Destroyed enemies sometimes drop a pickup. Fly over it to collect it.

| Pickup | Effect |
| --- | --- |
| **+** Repair | +30 armour |
| **M** Missiles | +4 missiles |
| **F** Flares | +2 flares |
| **2x** Double guns | Both guns fire at once for 15 seconds |
| **S** Shield | Blocks all damage for 10 seconds |
| **C** Cluster bomb | Your next missile press drops a cluster bomb instead. It bursts into ten bomblets that blanket the area ahead. You can carry up to three. |

Active power-ups are listed under your gauges with the time left.

## Aircraft

After the title screen, the hangar lets you pick your aircraft. Use ← / → (or A / D) to browse and Space to continue to mission select. With a mouse or on a touchscreen, click or tap the sides of the screen to browse and the middle to continue. Esc goes back to the title. The game remembers your choice next time.

| Aircraft | Role | Strengths | Weaknesses |
| --- | --- | --- | --- |
| **Stormwolf** | Attack helicopter | All-rounder: solid armour, 8 missiles, twin wing guns | Doesn't excel at anything |
| **Kestrel** | Scout helicopter | Fastest and most agile, quick-firing gun, 7 flares, small target | Light armour, only 4 missiles |
| **Titan** | Heavy twin-rotor gunship | Huge armour, 14 missiles, hardest-hitting guns | Slow, turns sluggishly, big target |
| **Viper** | Prototype jet-copter | Fastest in the fleet, long-range laser bolts that barely heat up, agile | Medium armour, 6 missiles. **Locked until you clear all nine missions.** |

Skywatch's radio calls use the callsign of the aircraft you're flying.

Each aircraft is an entry in the `VEHICLES` list in `src/entities.js`. An entry sets how the aircraft looks (its draw function and colours) and how it handles: armour, missiles, flares, cruise and turbo speed, turn rate, hitbox size, gun position, fire rate, damage and heat, and where missiles launch from. Add an entry and it appears in the hangar automatically.

## Sprites

The four player aircraft are painted images in `art/`, generated with Pixa (Qwen Image 2.1) and cut out of their backgrounds. Their rotors, lift fans and engine glows are still drawn in code, so they spin and flare. `ART` in `src/entities.js` sets where each image sits on its aircraft's footprint and where its rotor hubs are.

Enemy vehicles are painted too, once for each theatre in its own camouflage: `art/<theatre>/` holds a jeep, cargo truck, tank hull, tank turret, gunship, jet and patrol boat. The turret is a separate image so it can still turn. The jeep and boat guns, gunship rotors and the boat's missile box stay in code. `ENEMY_ART` in `src/entities.js` sets each image's footprint, and a theatre's set loads when its mission starts. The boss, aid trucks, emplacements and buildings are still drawn in code.

Everything else is drawn in code in `src/entities.js`, lit from the top-left to match the shadows. Each aircraft also keeps its code model as a fallback for while its image loads. Open `sprites.html` (served the same way as the game) to see the code models at 2× size.

## Missions

Each mission is fought in its own theatre, with its own island layout, ground and sea colours, plant life, weather and landmarks. Enemy vehicles are painted in matching camouflage. The last three missions revisit earlier theatres on new maps.

| # | Mission | Theatre | Weather | Objective |
| --- | --- | --- | --- | --- |
| 1 | **Operation Sandstorm** | Southern Desert: sand, palm oases, ruins, nomad camps | Blowing sand | Destroy the three SAM sites in the interior. Each is guarded by armour and light vehicles. |
| 2 | **Operation Iron Road** | Central Valleys: farmland, woods, ruined villages | **Night** | Destroy the arms convoy on the highway before more than two trucks reach the border. Trucks, jeeps and tanks show up by their headlights, and your searchlight points where you fly. |
| 3 | **Operation Frostbite** | Northern Tundra: snow, pack ice, frozen lakes, huts | Snow | Destroy five fuel depots ringed by anti-aircraft guns. Depots explode violently and damage anything close by. |
| 4 | **Operation Green Hell** | Eastern Jungle: dense canopy, muddy shores, temple ruins | Rain | Sink six gunboats patrolling the coast. Two of them fire anti-air missiles. |
| 5 | **Operation Black Gold** | Volcanic Oil Fields: ash, pumpjacks, oil pools | Falling ash and embers | A shield protects the command bunker. Destroy its three generators to drop the shield, then destroy the bunker. |
| 6 | **Operation Red Talon** | Red Canyons: red rock, mesas, cacti | Dust | Hunt down RED TALON, a stolen prototype gunship, and destroy it. |
| 7 | **Operation Lifeline** | Eastern Jungle (new map) | Rain | **Rescue.** Four downed aircrew are waiting by orange smoke. Hover slowly over each one to take them aboard, then land on your base pad to bring them home. Militia search jeeps are heading for them; the mission fails if more than one is captured. |
| 8 | **Operation Safe Passage** | Southern Desert (new map) | Blowing sand | **Escort.** Four white aid trucks drive from your base to a cut-off town. Clear the ambushes along the road. The mission fails if more than one truck is destroyed. |
| 9 | **Operation Last Stand** | Central Valleys (new map) | Clear | **Defend.** Five waves of jeeps, tanks, gunships and jets attack your base. Keep the command building standing; it gets patched up a little between waves. |

Shipwrecks lie offshore in every theatre.

### Campaign and mission select

After the hangar you pick a mission. Clearing a mission unlocks the next one, and you can replay any mission you've unlocked; your best score and star rating for each are shown. On the mission select screen, ↑ / ↓ picks a mission, ← / → sets the difficulty, Space launches, U opens the workshop, O opens settings and Esc goes back. Everything is clickable too.

After the ninth mission the campaign starts over with tougher enemies, and the Viper is unlocked in the hangar.

### Contracts

Clear Operation Frostbite and **CONTRACTS** opens at the bottom of mission select (T, or click it). Contracts are endless generated missions. Each one is built from a seed: a theatre, a fresh island, one of the nine objective types (SAM sites, fuel depots, gunboats, shield bunker, ace hunt, rescue, base defence, convoy or escort), and sometimes a second objective that arrives as new orders halfway through.

- **Rank:** you start at rank 1. Each rank makes enemies tougher, adds targets and raises the pay. Clearing a contract takes you to the rank after it.
- **The board:** two offers at your rank and a **HIGH RISK** one two ranks up, which jumps you three ranks if you clear it. **NEW BOARD** (R) deals fresh offers for 300 funds.
- **Twists:** higher ranks bring more of them, and each pays extra:

  | Twist | Effect |
  | --- | --- |
  | NIGHT | Flown at night |
  | NO FLARES | No flares fitted |
  | SWARM | Reinforcements twice as fast |
  | BLITZ | Hard time limit; the clock shows it instead of par |
  | THIN ARMOUR | You take 50% more damage |

- **Daily contract:** a rank 5 contract that's the same for everyone on a given day. It pays double, once a day, and clearing it on consecutive days builds a streak.
- **Workshop:** upgrade level 4 goes on sale at contract rank 5, and level 5 at rank 10.

Your rank, board, daily result and streak are saved with the campaign. The generator is in `src/contracts.js`; a new objective type is one more entry in `CONTRACT_OBJECTIVES`.

### Star ratings

Each cleared mission earns up to three stars, and each bonus star adds 1500 to your score (and so to your workshop funds):

| Star | How to earn it |
| --- | --- |
| ★ | Clear the mission |
| ★ | Finish under the mission's par time. The clock and par time are shown under your score; the clock is green while you're still under par. |
| ★ | Lose less than half your armour over the whole mission (repairs don't wipe the slate clean) |

Mission select keeps your best rating for each mission.

### Difficulty

| Setting | Enemies | Damage you take |
| --- | --- | --- |
| Easy | Weaker, slower to reinforce | 35% less |
| Normal | Standard | Standard |
| Hard | Tougher, faster missiles, more reinforcements | 30% more |

### Workshop

The points you score in a mission become funds. After each win you go to the workshop, where funds buy upgrades. Upgrades fit every aircraft and each has three levels:

| Upgrade | Per level | Costs |
| --- | --- | --- |
| Armour plating | +15% armour | 1500 / 3000 / 5000 / 8000 / 12000 |
| Gun cooling | −15% gun heat | 1200 / 2500 / 4500 / 7000 / 10000 |
| Missile racks | +2 missiles | 1500 / 3000 / 5000 / 8000 / 12000 |
| Flare pods | +1 flare | 800 / 1600 / 3000 / 5000 / 7500 |
| Engine tuning | +6% speed | 1500 / 3000 / 5000 / 8000 / 12000 |

Levels 4 and 5 unlock at contract ranks 5 and 10.

Theatres (palette, weather, landmarks) are defined in `THEATRES` in `src/terrain.js`, missions (with their par times) in `src/missions.js`, difficulty, upgrades and settings in `src/progress.js`, and weather and night lighting in `src/weather.js`. Friendly units (aid trucks, downed crew, the base's command building) are at the end of `src/entities.js`.
