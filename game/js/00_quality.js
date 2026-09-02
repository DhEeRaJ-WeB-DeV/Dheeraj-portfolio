// 00_quality.js — Sword Quest's own lightweight version of the portfolio's
// device-tier heuristic. Kept separate/plain-JS on purpose: this game is a
// standalone static site with no build step and no access to the React
// app's modules, so it can't import src/utils/deviceTier.js directly.
// Loaded first, before every other game script, so everything else can
// read `window.GFX` synchronously from the very first frame.
//
// Quality is picked from, in priority order:
//   1. `?gfx=low|medium|high` on the game's own URL — this is what the
//      portfolio's GameShowcase.jsx passes in on the iframe/link URL,
//      built from its own device-tier detection (see src/perf.jsx), so by
//      default the game just inherits whatever the surrounding page
//      already decided rather than re-detecting from scratch.
//   2. If the game is opened directly with no ?gfx= (a bookmark, sharing
//      the game standalone, testing) it falls back to detecting for
//      itself using the same signals: WebGL renderer string, CPU core
//      count, and mobile/coarse-pointer.
(function () {
  var TIERS = ['low', 'medium', 'high'];

  function fromQuery() {
    try {
      var v = new URLSearchParams(window.location.search).get('gfx');
      return TIERS.indexOf(v) !== -1 ? v : null;
    } catch (e) {
      return null;
    }
  }

  function detect() {
    var renderer = null;
    try {
      var canvas = document.createElement('canvas');
      var gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      if (gl) {
        var ext = gl.getExtension('WEBGL_debug_renderer_info');
        var raw = ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
        renderer = typeof raw === 'string' ? raw.toLowerCase() : null;
      }
    } catch (e) {
      // ignore — treated as "no WebGL info", scored as low below
    }

    var lowKeywords = [
      'swiftshader', 'llvmpipe', 'software', 'mali-4', 'mali-t6', 'mali-t7',
      'adreno 3', 'adreno 4', 'adreno 5', 'powervr sgx'
    ];
    var highKeywords = [
      'nvidia', 'geforce', 'rtx', 'gtx', 'radeon', 'apple m1', 'apple m2',
      'apple m3', 'apple m4', 'adreno 7', 'adreno 8', 'mali-g7', 'mali-g8'
    ];

    var score = 0;
    if (renderer) {
      if (lowKeywords.some(function (k) { return renderer.indexOf(k) !== -1; })) score -= 1;
      if (highKeywords.some(function (k) { return renderer.indexOf(k) !== -1; })) score += 1;
    } else {
      score -= 1;
    }

    var cores = navigator.hardwareConcurrency || 4;
    score += cores >= 8 ? 1 : cores <= 2 ? -1 : 0;

    // navigator.deviceMemory (Chrome/Android/most low-end phones report
    // this; Safari/Firefox don't, in which case it's undefined and just
    // skipped — cores + renderer + touch/viewport still cover those).
    var mem = navigator.deviceMemory;
    if (typeof mem === 'number') {
      score += mem >= 8 ? 1 : mem <= 2 ? -1 : 0;
    }

    var coarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
    var narrow = window.innerWidth < 768;
    if (coarse || narrow) score -= 1;

    if (score <= -2) return 'low';
    if (score >= 2) return 'high';
    return 'medium';
  }

  var forcedTier = fromQuery();
  var tier = forcedTier || detect();

  // Touch/mobile-or-tablet detection, separate from the render-quality
  // tier above (a touch device can still be "high" tier, e.g. a modern
  // tablet). Drives which on-screen controls show up: see the
  // `.touch-only` rules in styles.css (skip-intro button, health/mana
  // potion buttons) and 05_input.js for the buttons themselves. A real
  // touch/coarse-pointer device OR a narrow viewport both count, so this
  // also does the right thing for someone resizing a desktop browser
  // down to a phone-width window for testing.
  var isTouch =
    (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) ||
    'ontouchstart' in window ||
    navigator.maxTouchPoints > 0 ||
    window.innerWidth < 900;

  document.documentElement.classList.toggle('touch-device', !!isTouch);
  window.GFX_IS_TOUCH = !!isTouch;

  // detect()'s score-based heuristic was landing plenty of ordinary
  // mid-range phones on "medium" (decent core count + an unrecognized-
  // but-perfectly-adequate-for-a-native-app GPU string can cancel out
  // the mobile penalty entirely) — "medium" still runs 2 glow layers
  // and 70% particle density per frame, which is where the actual
  // choppiness on phones was coming from. Rather than keep tuning the
  // score weights (and risk mis-tuning desktop in the process), just
  // drop touch devices one tier below whatever was decided — the
  // portfolio's own GameShowcase.jsx does the same one-step-down before
  // building the `?gfx=` URL for the iframe (see buildGameUrl there),
  // so this mainly matters for the game opened standalone/bookmarked
  // with no `?gfx=` at all. Desktop (no touch, wide viewport) never
  // hits this, so laptop rendering is unchanged either way.
  if (isTouch) {
    var idx = TIERS.indexOf(tier);
    tier = TIERS[Math.max(0, idx - 1)];
  }

  // Per-tier tunables the rest of the game reads. Kept conservative —
  // "medium" should look and play basically like the original game did;
  // "high" is unchanged from before this existed. `let`, not `const` —
  // GFX.downgrade() below reassigns these at runtime, and scaleCount/
  // glowFilter close over the variables (not a snapshot value), so any
  // reassignment is picked up on the very next frame automatically.
  var TIER_PARTICLE_SCALE = { low: 0.35, medium: 0.7, high: 1 };
  var TIER_GLOW_BUDGET = { low: 0, medium: 2, high: 4 };
  var PARTICLE_SCALE = TIER_PARTICLE_SCALE[tier];
  var GLOW_LAYER_BUDGET = TIER_GLOW_BUDGET[tier];

  window.GFX = {
    tier: tier,

    // Scales a particle-spawn count `n` down for weaker tiers. Always
    // spawns at least 1 so effects (hit sparks, blood, etc.) never fully
    // disappear, just get lighter.
    scaleCount: function (n) {
      return Math.max(1, Math.round(n * PARTICLE_SCALE));
    },

    // Multi-layer `drop-shadow(...)` glows are one of the most expensive
    // things this canvas draws — each layer is a separate blur pass over
    // the whole sprite. Pass the layers ordered from most-important/
    // cheapest (small, tight blur) to least, and this trims to however
    // many the current tier can afford — none at all on low, since the
    // base sprite art (color-coded red/yellow/blue) still reads clearly
    // without the glow on top of it.
    glowFilter: function (layers) {
      if (!layers || !layers.length || GLOW_LAYER_BUDGET === 0) return 'none';
      return layers.slice(0, GLOW_LAYER_BUDGET).join(' ');
    },

    // Runtime step-down, called by the adaptive FPS monitor in
    // 10_main.js when the game is actually chugging on this specific
    // device/tab/thermal-state right now — covers everything the
    // upfront WebGL-renderer/cores/deviceMemory heuristic above can't
    // know in advance (background tabs throttling, a phone already hot
    // from other apps, an old laptop's integrated GPU that doesn't
    // report a recognizable renderer string, etc). One-way (never
    // upgrades mid-session — a device that struggled once stays lighter
    // rather than yo-yoing) and stops at 'low'. Returns true if it
    // actually changed anything, so the caller can stop monitoring.
    downgrade: function () {
      var idx = TIERS.indexOf(this.tier);
      if (idx <= 0) return false;
      this.tier = TIERS[idx - 1];
      PARTICLE_SCALE = TIER_PARTICLE_SCALE[this.tier];
      GLOW_LAYER_BUDGET = TIER_GLOW_BUDGET[this.tier];
      return true;
    }
  };
})();
