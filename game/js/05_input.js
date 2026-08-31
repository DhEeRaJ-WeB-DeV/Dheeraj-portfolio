// Sword Quest — preserved from the original working game.js

// ---------- Input ----------
  // The intro now plays every time the page loads (i.e. every refresh),
  // not just on the player's first-ever visit. To change the video, simply
  // replace assets/intro/game_intro.mp4 with another MP4 using the exact
  // same filename.
  const introCard = document.getElementById('intro-card');
  const introVideo = document.getElementById('introVideo');
  const introUnmuteBtn = document.getElementById('introUnmuteBtn');
  let introActive = false;

  window.addEventListener('keydown', e=>{
    // Enter skips the first-play intro immediately.
    if(introActive && e.code === 'Enter'){
      e.preventDefault();
      e.stopPropagation();
      finishIntro(true);
      return;
    }

    keys[e.code] = true;
    if(e.code==='Space') e.preventDefault();
    if(e.code==='KeyP' && !e.repeat){ togglePause(); }
  });
  window.addEventListener('keyup', e=>{ keys[e.code]=false; });

  function showIntro(){
    introActive = true;
    keys = {};
    introCard.classList.remove('hidden');
    introVideo.currentTime = 0;
    introUnmuteBtn.classList.add('hidden');
    // startGame() is normally triggered by a click, so browsers permit
    // unmuted playback with audio. When the game is instead auto-launched
    // straight into the intro (see the ?autoplay=1 handling below), there's
    // no in-document click for the browser to treat as a playback gesture,
    // so an unmuted play() can get silently blocked. Fall back to a muted
    // autoplay (which browsers always allow) and surface a small unmute
    // button so sound is one tap away instead of the intro just failing
    // to play at all.
    introVideo.muted = false;
    const playPromise = introVideo.play();
    if(playPromise && typeof playPromise.catch === 'function'){
      playPromise.catch(()=>{
        introVideo.muted = true;
        introUnmuteBtn.classList.remove('hidden');
        const mutedPlayPromise = introVideo.play();
        if(mutedPlayPromise && typeof mutedPlayPromise.catch === 'function'){
          mutedPlayPromise.catch(()=>finishIntro(false));
        }
      });
    }
  }

  introUnmuteBtn.onclick = () => {
    introVideo.muted = false;
    introUnmuteBtn.classList.add('hidden');
  };

  function finishIntro(skipped){
    if(!introActive) return;
    introActive = false;
    introVideo.pause();
    introVideo.currentTime = 0;
    introCard.classList.add('hidden');
    keys = {};
    showControlsCard();
  }

  introVideo.addEventListener('ended', ()=>finishIntro(false));
  introVideo.addEventListener('error', ()=>finishIntro(false));

  // Shown right after the intro finishes (skipped or watched in full), for
  // every entry path — including the portfolio's autoplay launch, which
  // used to jump straight past the title card's controls list into
  // gameplay with no controls shown anywhere. Gameplay stays paused
  // (gameState 'controls', same idea as the pause/lose/win cards) until
  // this is dismissed.
  function showControlsCard(){
    gameState = 'controls';
    document.getElementById('controls-card').classList.remove('hidden');
  }

  document.getElementById('beginPlayBtn').onclick = () => {
    warmupSfx();
    document.getElementById('controls-card').classList.add('hidden');
    launchGame();
  };

  window.addEventListener('keyup', e=>{ keys[e.code]=false; });

  function setupTouchBtn(id, onDown, onUp){
    const el = document.getElementById(id);
    const down = ev=>{ ev.preventDefault(); onDown(); };
    const up = ev=>{ ev.preventDefault(); if(onUp) onUp(); };
    el.addEventListener('touchstart', down, {passive:false});
    el.addEventListener('touchend', up, {passive:false});
    el.addEventListener('mousedown', down);
    el.addEventListener('mouseup', up);
    el.addEventListener('mouseleave', up);
  }
  setupTouchBtn('btnLeft', ()=>keys['ArrowLeft']=true, ()=>keys['ArrowLeft']=false);
  setupTouchBtn('btnRight', ()=>keys['ArrowRight']=true, ()=>keys['ArrowRight']=false);
  setupTouchBtn('btnJump', ()=>keys['Space']=true, ()=>keys['Space']=false);
  setupTouchBtn('btnAttack', ()=>keys['KeyE']=true, ()=>keys['KeyE']=false);
  setupTouchBtn('btnParry', ()=>keys['KeyQ']=true, ()=>keys['KeyQ']=false);
  canvas.addEventListener('mousedown', ()=>{ keys['KeyE']=true; });
  canvas.addEventListener('mouseup', ()=>{ keys['KeyE']=false; });

  document.getElementById('pauseBtn').onclick = togglePause;
  document.getElementById('resumeBtn').onclick = resumeGame;
  document.getElementById('restartPauseBtn').onclick = restartFromPause;

  function togglePause(){
    if(gameState === 'playing'){
      gameState = 'paused';
      document.getElementById('pause-card').classList.remove('hidden');
      keys = {};
    } else if(gameState === 'paused'){
      resumeGame();
    }
  }

  function resumeGame(){
    if(gameState !== 'paused') return;
    document.getElementById('pause-card').classList.add('hidden');
    gameState = 'playing';
  }

  function restartFromPause(){
    document.getElementById('pause-card').classList.add('hidden');
    startGame();
  }

  document.getElementById('startBtn').onclick = startGame;
  document.getElementById('restartWinBtn').onclick = startGame;
  document.getElementById('restartLoseBtn').onclick = retryLevel;
  document.getElementById('continueBtn').onclick = continueToNextLevel;

  // The portfolio's "Play" button links here with ?autoplay=1 so the game
  // opens straight into the intro video instead of sitting on the title
  // card first — same intro/launch flow as pressing Begin, just triggered
  // automatically on load rather than waiting for a click.
  if(new URLSearchParams(window.location.search).get('autoplay') === '1'){
    startGame();
  }

  function startGame(){
    // The intro plays every time Begin is pressed (i.e. on every fresh page
    // load/refresh), not just the first time.
    document.getElementById('title-card').classList.add('hidden');
    document.getElementById('win-card').classList.add('hidden');
    document.getElementById('lose-card').classList.add('hidden');
    document.getElementById('level-card').classList.add('hidden');
    document.getElementById('pause-card').classList.add('hidden');
    showIntro();
  }

  function launchGame(){
    warmupSfx();
    document.getElementById('title-card').classList.add('hidden');
    document.getElementById('controls-card').classList.add('hidden');
    document.getElementById('win-card').classList.add('hidden');
    document.getElementById('lose-card').classList.add('hidden');
    document.getElementById('level-card').classList.add('hidden');
    document.getElementById('pause-card').classList.add('hidden');
    restartRun();
    gameState = 'playing';
  }

  function retryLevel(){
    document.getElementById('lose-card').classList.add('hidden');
    // dying mid-level forfeits that level's carried score, but earlier levels' progress stands
    resetLevel();
    gameState = 'playing';
  }

  function continueToNextLevel(){
    document.getElementById('level-card').classList.add('hidden');
    goToLevel(currentLevel + 1);
    gameState = 'playing';
  }
