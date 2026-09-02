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

  // Touch-only skip button (see .touch-only in styles.css) — the mobile
  // equivalent of pressing Enter, which laptop players already have.
  const introSkipBtn = document.getElementById('introSkipBtn');
  if(introSkipBtn){
    introSkipBtn.addEventListener('touchstart', e=>{
      e.preventDefault();
      finishIntro(true);
    }, {passive:false});
    introSkipBtn.addEventListener('click', e=>{
      e.preventDefault();
      finishIntro(true);
    });
  }

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

  // Pointer Events (not touchstart/touchend) so the same handler smoothly
  // covers touch, mouse and pen with a single listener each — fewer event
  // listeners firing per frame keeps this light on low-end phones.
  function setupTouchBtn(id, onDown, onUp){
    const el = document.getElementById(id);
    if(!el) return;
    const down = ev=>{ ev.preventDefault(); onDown(); };
    const up = ev=>{ ev.preventDefault(); if(onUp) onUp(); };
    el.addEventListener('pointerdown', down, {passive:false});
    el.addEventListener('pointerup', up, {passive:false});
    el.addEventListener('pointercancel', up, {passive:false});
    el.addEventListener('pointerleave', up, {passive:false});
  }
  setupTouchBtn('btnAttack', ()=>keys['KeyE']=true, ()=>keys['KeyE']=false);
  setupTouchBtn('btnParry', ()=>keys['KeyQ']=true, ()=>keys['KeyQ']=false);
  setupTouchBtn('btnFireball', ()=>keys['KeyF']=true, ()=>keys['KeyF']=false);
  canvas.addEventListener('mousedown', ()=>{ keys['KeyE']=true; });
  canvas.addEventListener('mouseup', ()=>{ keys['KeyE']=false; });

  // ---------- Movement joystick (touch-only) ----------
  // Replaces the old left/right arrow buttons. Dragging the knob past a
  // small dead zone sets keys['ArrowLeft']/keys['ArrowRight']; dragging
  // it up past the dead zone sets keys['Space'] (jump), reusing exactly
  // the same flags 08_update.js already reads from the keyboard — so the
  // jump latch/double-jump logic there needs no changes at all.
  (function setupJoystick(){
    const zone = document.getElementById('joystick');
    const base = document.getElementById('joystickBase');
    const knob = document.getElementById('joystickKnob');
    if(!zone || !base || !knob) return;

    const DEADZONE = 12; // px of drag before a direction registers
    let activeId = null;
    let centerX = 0, centerY = 0, maxDist = 30;

    function setKeys(dx, dy){
      keys['ArrowLeft'] = dx < -DEADZONE;
      keys['ArrowRight'] = dx > DEADZONE;
      keys['Space'] = dy < -DEADZONE;
    }
    function resetKeys(){
      keys['ArrowLeft'] = false;
      keys['ArrowRight'] = false;
      keys['Space'] = false;
    }
    function moveKnob(clientX, clientY){
      let dx = clientX - centerX;
      let dy = clientY - centerY;
      const dist = Math.hypot(dx, dy);
      if(dist > maxDist){
        const ratio = maxDist / dist;
        dx *= ratio; dy *= ratio;
      }
      // translate3d for GPU compositing — keeps the knob smooth even on
      // weaker phones/tablets while the canvas is also animating.
      knob.style.transform = `translate3d(${dx}px, ${dy}px, 0)`;
      setKeys(dx, dy);
    }

    function start(ev){
      if(activeId !== null) return;
      ev.preventDefault();
      activeId = ev.pointerId;
      try{ zone.setPointerCapture(activeId); }catch(e){}
      const rect = base.getBoundingClientRect();
      centerX = rect.left + rect.width/2;
      centerY = rect.top + rect.height/2;
      maxDist = rect.width/2 - knob.offsetWidth/2 + 4;
      zone.classList.add('joystick-active');
      moveKnob(ev.clientX, ev.clientY);
    }
    function move(ev){
      if(ev.pointerId !== activeId) return;
      ev.preventDefault();
      moveKnob(ev.clientX, ev.clientY);
    }
    function end(ev){
      if(ev.pointerId !== activeId) return;
      activeId = null;
      zone.classList.remove('joystick-active');
      knob.style.transform = 'translate3d(0,0,0)';
      resetKeys();
    }

    zone.addEventListener('pointerdown', start, {passive:false});
    zone.addEventListener('pointermove', move, {passive:false});
    zone.addEventListener('pointerup', end, {passive:false});
    zone.addEventListener('pointercancel', end, {passive:false});
  })();

  // ---------- Combo potion button (touch-only) ----------
  // One visible button (potion_combo icon) by default. Holding it past
  // LONG_PRESS_MS pops out separate Health/Mana buttons above it; a
  // quick tap does nothing, so a stray thumb-tap can never waste a
  // potion. Tapping a sub-button drinks that potion (via the same R/T
  // keys the keyboard uses) and collapses the menu again.
  (function setupPotionMenu(){
    const wrap = document.getElementById('potions');
    const mainBtn = document.getElementById('btnPotionMain');
    const healthBtn = document.getElementById('btnHealthPotion');
    const manaBtn = document.getElementById('btnManaPotion');
    if(!wrap || !mainBtn || !healthBtn || !manaBtn) return;

    const LONG_PRESS_MS = 350;
    const AUTO_COLLAPSE_MS = 4000;
    let pressTimer = null;
    let collapseTimer = null;
    let longPressFired = false;

    function expand(){
      longPressFired = true;
      wrap.classList.add('expanded');
      if(navigator.vibrate) navigator.vibrate(12);
      clearTimeout(collapseTimer);
      collapseTimer = setTimeout(collapse, AUTO_COLLAPSE_MS);
    }
    function collapse(){
      wrap.classList.remove('expanded');
      clearTimeout(collapseTimer);
    }

    mainBtn.addEventListener('pointerdown', ev=>{
      ev.preventDefault();
      longPressFired = false;
      clearTimeout(pressTimer);
      pressTimer = setTimeout(expand, LONG_PRESS_MS);
    }, {passive:false});
    ['pointerup','pointercancel','pointerleave'].forEach(evtName=>{
      mainBtn.addEventListener(evtName, ev=>{
        clearTimeout(pressTimer);
        // A short tap (below the long-press threshold) on an already
        // expanded menu collapses it again; a short tap while collapsed
        // is a no-op, so it can never accidentally trigger a potion.
        if(!longPressFired && wrap.classList.contains('expanded')) collapse();
      }, {passive:false});
    });

    function bindSubButton(el, keyCode){
      el.addEventListener('pointerdown', ev=>{
        ev.preventDefault(); ev.stopPropagation();
        keys[keyCode] = true;
      }, {passive:false});
      ['pointerup','pointercancel','pointerleave'].forEach(evtName=>{
        el.addEventListener(evtName, ev=>{
          ev.preventDefault(); ev.stopPropagation();
          keys[keyCode] = false;
          collapse();
        }, {passive:false});
      });
    }
    bindSubButton(healthBtn, 'KeyR');
    bindSubButton(manaBtn, 'KeyT');

    // Tapping anywhere else on screen while the menu is open closes it.
    document.addEventListener('pointerdown', ev=>{
      if(wrap.classList.contains('expanded') && !wrap.contains(ev.target)) collapse();
    });
  })();

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
