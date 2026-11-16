# CrazyGames build

A separate build of Talon Strike for CrazyGames. The game itself is not changed: the build copies it and applies the CrazyGames changes to the copy, so petrieuk.co.uk and GitHub Pages keep serving the normal game.

```bash
node platform/crazygames/build.mjs
```

The output goes to `dist/crazygames/` (the files to play) and `dist/talon-strike-crazygames.zip` (the upload). `dist/` is not committed. Rebuild after any change to the game.

## What the build changes

- **SDK first:** the page loads the CrazyGames SDK v3, then `crazygames.js`, then the game. The game no longer starts on page load: the adapter starts it once the SDK is ready, so the save it reads comes from the player's CrazyGames account.
- **Saves:** the `chopperGunner.*` keys (campaign, settings, best score, aircraft, key bindings) go through the SDK data module. If the module is off they fall back to `localStorage`. Turn on *Progress Save* in the submission form.
- **Gameplay events:** `loadingStart` and `loadingStop` around startup; `gameplayStart` while flying a mission; `gameplayStop` on pause, menus, briefings and the results screens.
- **`happytime`** when a mission or contract is cleared.
- **Midgame ad** when the player leaves the mission-complete or failure screen. The game's sound is suspended while it plays. Every screen they go to from there waits for input, so the game doesn't need pausing.
- **CrazyGames mute setting** always wins over the in-game M key.
- **Removed:**
  - the SEND FEEDBACK button, an outgoing link to the Tally form
  - the service worker, the web app manifest and the app icons, since the portal hosts the game in a frame
  - the game's own full-screen and landscape lock, because the portal has its own full-screen button

The build stops if any patch doesn't match exactly, and it lists any outgoing URLs left in the page or scripts.

## Testing locally

Serve `dist/crazygames/` on `localhost`, for example with `python -m http.server 5262` from that folder. On `localhost` the SDK runs in `local` mode: ads show a placeholder and the console logs every SDK call. Add `?muteAudio=true` to test the platform mute.

## Covers

`store/` holds the three covers CrazyGames asks for: 1920×1080, 800×1200 and 800×800. Each has a large gunship from painted key art, with the title in the game's Orbitron lettering, kept clear of the top-left corner where CrazyGames puts its labels. The capybara game's busy gameplay cover lost clicks, so these lead with the aircraft.

- **Key art:** `covers/art/`, painted with Pixa (Flux 2 Max, 2K) with no text.
- **Rebuild:** run `python platform/crazygames/covers/mkcovers.py`, which crops each picture, darkens the corner behind the title and draws the title. It needs Pillow, and fontTools with brotli to read the game's woff2 font.

## Preview videos

`store/preview-landscape-1920x1080.mp4` and `store/preview-portrait-1080x1620.mp4` are 18-second clips of the real game, with no sound and no HUD. The only text is the title, which fades in the first second. They show three scenes: a desert SAM site, the tundra fuel depots, and RED TALON in the canyons. They're gitignored because of their size, so keep a copy if you move machines. To re-record them:

1. Serve the repo root on `127.0.0.1:5220` (`python -m http.server 5220 --bind 127.0.0.1`).
2. Run `node platform/crazygames/video/receive.mjs` to save the frames.
3. Open `/platform/crazygames/video/video.html` and keep the browser in view, because a hidden tab is throttled. Run `await VIDEO.record('landscape')`, reload, then `await VIDEO.record('portrait')`.
4. Run `node platform/crazygames/video/encode.mjs`, which needs ffmpeg.

`video.js` takes over a copy of the game on that page:
- It renders at the exact video size in fixed steps.
- It flies an autopilot and keeps the player alive.
- It builds the terrain in view ahead of each frame. The scenes are in `SCENES`.

## Still to do before submitting

- **Store text:** check `store/STORE-TEXT.md`.
- **Optional:** a rewarded ad, for example to continue after being shot down or for double contract pay.
- **Before submitting:** Pixa's written confirmation of commercial use for the art.
