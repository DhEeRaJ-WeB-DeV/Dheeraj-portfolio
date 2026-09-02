// Sword Quest — preserved from the original working game.js

// ---------- Adaptive performance monitor ----------
// 00_quality.js's tier pick (WebGL renderer string, CPU cores,
// deviceMemory, touch/viewport) is a good upfront guess, but it can't
// see how THIS device is actually coping once real gameplay — particles,
// multi-layer glow, boss sprite sheets — is running. Every couple of
// seconds this checks the real achieved frame rate and steps GFX down
// one tier (fewer particles, fewer glow layers — see 00_quality.js) if
// it's sustained below a smooth rate, so a misjudged phone or an old
// laptop's integrated GPU settles into something it can actually keep up
// with instead of staying choppy for the whole session. One-way and
// cooldown-gated so it can't thrash back and forth.
const perfSample = (function(){
  const SAMPLE_MS = 2500;   // how long a "bad" window must run before downgrading
  const BAD_FPS = 40;       // sustained average below this counts as struggling
  const COOLDOWN_MS = 6000; // minimum gap between downgrade attempts
  let windowStart = performance.now();
  let frames = 0;
  let lastDowngrade = 0;
  return function(now){
    if(!window.GFX || window.GFX.tier === 'low') return; // nothing lighter to fall back to
    frames++;
    const elapsed = now - windowStart;
    if(elapsed < SAMPLE_MS) return;
    const fps = (frames * 1000) / elapsed;
    frames = 0;
    windowStart = now;
    if(fps < BAD_FPS && (now - lastDowngrade) > COOLDOWN_MS){
      lastDowngrade = now;
      window.GFX.downgrade();
    }
  };
})();

// Auto-pause when the tab/app is backgrounded (switching apps on mobile,
// switching browser tabs on a laptop). Saves battery/CPU while hidden —
// most browsers already throttle a hidden tab's requestAnimationFrame
// hard, but this makes it explicit and consistent, and gives the player
// a proper pause screen instead of resuming into whatever happened while
// the game kept ticking off-screen.
document.addEventListener('visibilitychange', () => {
  if(document.hidden && typeof gameState !== 'undefined' && gameState === 'playing'){
    togglePause();
  }
});

function loop(t){
    requestAnimationFrame(loop);
    perfSample(t);
    if(gameState !== 'playing') { draw(); return; }
    updatePlayer();
    updateEnemies();
    updateBoss();
    updateFireballs();
    updateParticles();
    // Camera: the boss room is a fixed-screen arena so the entire background
    // image remains visible from edge to edge.
    if(currentLevel === 3){
      camX = 0;
    } else {
      const target = player.x - W/2 + player.w/2;
      camX += (target-camX)*0.14;
      camX = Math.max(0, Math.min(LEVEL_WIDTH-W, camX));
    }
    draw();
  }

  resetLevel();
  requestAnimationFrame(loop);

// ---------- Fullscreen UI ----------
(function(){
  const btn = document.getElementById('fullscreenBtn');
  const wrap = document.getElementById('wrap');
  if(!btn || !wrap) return;

  function syncFullscreenIcon(){
    btn.textContent = document.fullscreenElement ? '×' : '⛶';
    btn.title = document.fullscreenElement ? 'Exit fullscreen' : 'Fullscreen';
  }

  btn.addEventListener('click', async (e)=>{
    e.preventDefault();
    try{
      if(!document.fullscreenElement){
        await (wrap.requestFullscreen ? wrap.requestFullscreen() : document.documentElement.requestFullscreen());
      }else{
        await document.exitFullscreen();
      }
    }catch(err){
      // Browsers can block fullscreen when not triggered by a user gesture.
      console.warn('Fullscreen unavailable:', err);
    }
    syncFullscreenIcon();
  });

  document.addEventListener('fullscreenchange', syncFullscreenIcon);
  syncFullscreenIcon();
})();
