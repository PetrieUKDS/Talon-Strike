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

## Still to do before submitting

- **Covers:** 1920×1080, 800×1200 and 800×800, character-led, with the aircraft large. The capybara game found a busy gameplay cover lost clicks.
- **Preview videos:** landscape and portrait.
- **Store text:** check `store/STORE-TEXT.md`.
- **Optional:** a rewarded ad, for example to continue after being shot down or for double contract pay.
- **Before submitting:** Pixa's written confirmation of commercial use for the art.
