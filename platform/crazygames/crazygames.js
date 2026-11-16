// CrazyGames adapter for Talon Strike. Only the CrazyGames build loads this file (before the game's
// scripts); petrieuk.co.uk and GitHub Pages never see it. It starts the CrazyGames SDK, routes saves
// through it, then starts the game and reports what the game is doing.
(() => {
  'use strict';
  let sdk = null;
  const log = (...a) => { try { console.info('[crazygames]', ...a); } catch (e) { /* no console */ } };
  const call = (fn) => { if (!sdk) return; try { fn(sdk); } catch (e) { log('sdk call failed', e); } };

  // Saves: the game's chopperGunner.* localStorage keys (campaign, settings, best score, aircraft,
  // key bindings) go through the SDK data module, so progress follows a signed-in CrazyGames account.
  // Guests still end up in localStorage (the SDK does that itself). If the module is off or throws,
  // fall back to plain localStorage.
  function routeSaves() {
    const P = Storage.prototype, get = P.getItem, set = P.setItem, del = P.removeItem;
    let inside = false; // the SDK may use localStorage itself; never route its own calls back to it
    const ours = (store, k) => !inside && store === window.localStorage && typeof k === 'string' && k.startsWith('chopperGunner.');
    const via = (fn, fallback) => { inside = true; try { return fn(); } catch (e) { return fallback(); } finally { inside = false; } };
    P.getItem = function (k) {
      if (!ours(this, k)) return get.call(this, k);
      return via(() => { const v = sdk.data.getItem(k); return v === null || v === undefined ? get.call(this, k) : String(v); }, () => get.call(this, k));
    };
    P.setItem = function (k, v) {
      if (!ours(this, k)) return set.call(this, k, v);
      via(() => sdk.data.setItem(k, String(v)), () => set.call(this, k, v));
    };
    P.removeItem = function (k) {
      if (!ours(this, k)) return del.call(this, k);
      via(() => sdk.data.removeItem(k), () => del.call(this, k));
    };
  }

  // Watch the game and report to the SDK. G (game.js) is the whole game; Sfx (audio.js) owns the sound.
  // Both are top-level consts in the game's scripts: shared globals, but not properties of window,
  // so they're named directly. This only runs once those scripts have loaded.
  function hook() {
    call((s) => s.game.loadingStop());
    let sdkMute = false, adBusy = false, playing = false, was = G.state;
    const applySettings = (st) => { sdkMute = !!(st && st.muteAudio); };
    call((s) => { applySettings(s.game.settings); s.game.addSettingsChangeListener(applySettings); });

    const silence = (on) => {
      const c = Sfx.ctx;
      if (!c) return;
      if (on && c.state === 'running') c.suspend().catch(() => {});
      if (!on && c.state === 'suspended') c.resume().catch(() => {});
    };

    // A midgame ad between missions: when the player leaves the mission-complete or failure screen.
    // Every screen they can go to from there waits for input, so the game needn't pause.
    function midgame() {
      if (!sdk || adBusy) return;
      adBusy = true;
      const done = () => { adBusy = false; silence(false); };
      call((s) => s.ad.requestAd('midgame', {
        adStarted: () => silence(true),
        adFinished: done,
        adError: (e) => { log('ad not shown', e && e.code); done(); },
      }));
    }

    setInterval(() => {
      // The platform's mute setting wins over the in-game M key.
      if (sdkMute && !Sfx.muted) Sfx.toggleMute();
      const now = G.state;
      if (now !== was) {
        if (was === 'complete' || was === 'failed') midgame();
        if (now === 'complete') call((s) => s.game.happytime());
        was = now;
      }
      if (adBusy) return; // no gameplay events while an ad is up
      const nowPlaying = now === 'play' || now === 'dying';
      if (nowPlaying !== playing) {
        playing = nowPlaying;
        call((s) => (nowPlaying ? s.game.gameplayStart() : s.game.gameplayStop()));
      }
    }, 150);
  }

  // The build swaps the game's own `window.addEventListener('load', () => G.init())` for a call to this,
  // so the SDK (and the saves it holds) is ready before the game reads its save.
  window.__talonBoot = (start) => {
    const loaded = new Promise((ok) => (document.readyState === 'complete' ? ok() : window.addEventListener('load', ok)));
    const ready = (async () => {
      try {
        const S = window.CrazyGames && window.CrazyGames.SDK;
        if (S) {
          await Promise.race([S.init(), new Promise((_, no) => setTimeout(() => no(new Error('init timeout')), 5000))]);
          if (S.environment === 'crazygames' || S.environment === 'local') sdk = S;
          log('environment', S.environment);
        }
      } catch (e) {
        log('SDK unavailable, running without it', e && e.message);
        sdk = null;
      }
      if (sdk) {
        routeSaves();
        call((s) => s.game.loadingStart());
      }
    })();
    Promise.all([loaded, ready]).then(() => {
      start();
      hook();
    });
  };
})();
