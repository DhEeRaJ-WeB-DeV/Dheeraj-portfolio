// Sword Quest — preserved from the original working game.js

function loop(t){
    requestAnimationFrame(loop);
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
