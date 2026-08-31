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

  function setupTouchBtn(id, onDown, onUp){
    const el = document.getElementById(id);
<<<<<<< HEAD
    const down = ev=>{ ev.preventDefault(); onDown(); };
    const up = ev=>{ ev.preventDefault(); if(onUp) onUp(); };
    el.addEventListener('touchstart', down, {passive:false});
    el.addEventListener('touchend', up, {passive:false});
    el.addEventListener('mousedown', down);
    el.addEventListener('mouseup', up);
    el.addEventListener('mouseleave', up);
  }
  setupTouchBtn('btnJump', ()=>keys['Space']=true, ()=>keys['Space']=false);
  setupTouchBtn('btnAttack', ()=>keys['KeyE']=true, ()=>keys['KeyE']=false);
  setupTouchBtn('btnParry', ()=>keys['KeyQ']=true, ()=>keys['KeyQ']=false);
  setupTouchBtn('btnFireball', ()=>keys['KeyF']=true, ()=>keys['KeyF']=false);

  // ---------- Virtual joystick (movement + jump) ----------
  // Replaces the old left/right dpad buttons. Dragging left/right sets the
  // same ArrowLeft/ArrowRight keys the dpad and keyboard already used, so
  // 08_update.js's movement code needs no changes. Pushing the stick up
  // past a taller deadzone also triggers a jump (ArrowUp), on top of the
  // dedicated jump button — either works.
  //
  // Uses the Pointer Events API (not touchmove) so the drag tracks
  // smoothly even once the finger leaves the base circle, and so a single
  // element handles both touch and mouse without duplicated listeners.
  function setupJoystick(){
    const base = document.getElementById('joystickBase');
    const stick = document.getElementById('joystickStick');
    if(!base || !stick) return;

    const MAX_DIST = 34;      // px the stick can travel from center
    const MOVE_DEADZONE = 10; // px before left/right registers
    const JUMP_DEADZONE = 20; // px of upward push before a jump registers

    let activeId = null;
    let originX = 0, originY = 0;

    function applyDelta(dx, dy){
      stick.style.transform = `translate(${dx}px, ${dy}px) translateZ(0)`;
      keys['ArrowLeft'] = dx < -MOVE_DEADZONE;
      keys['ArrowRight'] = dx > MOVE_DEADZONE;
      keys['ArrowUp'] = (-dy) > JUMP_DEADZONE && Math.abs(dy) > Math.abs(dx);
    }

    function reset(){
      stick.style.transform = 'translate(0px, 0px) translateZ(0)';
      keys['ArrowLeft'] = false;
      keys['ArrowRight'] = false;
      keys['ArrowUp'] = false;
      base.classList.remove('active');
    }

    function onDown(e){
      if(activeId !== null) return;
      e.preventDefault();
      activeId = e.pointerId;
      const rect = base.getBoundingClientRect();
      originX = rect.left + rect.width/2;
      originY = rect.top + rect.height/2;
      base.classList.add('active');
      try{ base.setPointerCapture(activeId); }catch(err){}
      onMove(e);
    }
    function onMove(e){
      if(e.pointerId !== activeId) return;
      e.preventDefault();
      let dx = e.clientX - originX;
      let dy = e.clientY - originY;
      const dist = Math.hypot(dx, dy);
      if(dist > MAX_DIST){
        const ratio = MAX_DIST / dist;
        dx *= ratio; dy *= ratio;
      }
      applyDelta(dx, dy);
    }
    function onUp(e){
      if(e.pointerId !== activeId) return;
      activeId = null;
      reset();
    }

    base.addEventListener('pointerdown', onDown, {passive:false});
    base.addEventListener('pointermove', onMove, {passive:false});
    base.addEventListener('pointerup', onUp, {passive:false});
    base.addEventListener('pointercancel', onUp, {passive:false});
  }
  setupJoystick();

  // ---------- Potion menu (single button -> long-press reveals health/mana) ----------
  // Touch-only (see .touch-only in styles.css). Mirrors the R/T keyboard
  // shortcuts, so the existing latch logic in 08_update.js (one potion per
  // press, not one per frame held) just works unchanged.
  function setupPotionMenu(){
    const mainBtn = document.getElementById('btnPotionMain');
    const options = document.getElementById('potionOptions');
    if(!mainBtn || !options) return;

    const LONG_PRESS_MS = 320;
    let pressTimer = null;
    let menuOpen = false;

    function openMenu(){
      menuOpen = true;
      options.classList.add('open');
    }
    function closeMenu(){
      menuOpen = false;
      options.classList.remove('open');
    }

    function onMainDown(ev){
      ev.preventDefault();
      mainBtn.classList.add('pressing');
      clearTimeout(pressTimer);
      pressTimer = setTimeout(openMenu, LONG_PRESS_MS);
    }
    function onMainUp(ev){
      ev.preventDefault();
      mainBtn.classList.remove('pressing');
      clearTimeout(pressTimer);
      // A quick tap (menu never opened) just does nothing — long-press is
      // required to choose a potion, so nothing gets drunk by accident.
    }
    mainBtn.addEventListener('touchstart', onMainDown, {passive:false});
    mainBtn.addEventListener('touchend', onMainUp, {passive:false});
    mainBtn.addEventListener('touchcancel', onMainUp, {passive:false});
    mainBtn.addEventListener('mousedown', onMainDown);
    mainBtn.addEventListener('mouseup', onMainUp);
    mainBtn.addEventListener('mouseleave', onMainUp);

    setupTouchBtn('btnHealthPotion', ()=>keys['KeyR']=true, ()=>{ keys['KeyR']=false; closeMenu(); });
    setupTouchBtn('btnManaPotion', ()=>keys['KeyT']=true, ()=>{ keys['KeyT']=false; closeMenu(); });

    // Tapping/clicking anywhere else closes an open menu.
    document.addEventListener('touchstart', ev=>{
      if(menuOpen && !options.contains(ev.target) && ev.target !== mainBtn) closeMenu();
    }, {passive:true});
    document.addEventListener('mousedown', ev=>{
      if(menuOpen && !options.contains(ev.target) && ev.target !== mainBtn) closeMenu();
    });
  }
  setupPotionMenu();

=======
    if(!el) return;
    const down = ev=>{ ev.preventDefault(); try{el.setPointerCapture?.(ev.pointerId);}catch(_){} onDown(); };
    const up = ev=>{ ev.preventDefault(); if(onUp) onUp(); };
    el.addEventListener('pointerdown', down, {passive:false});
    el.addEventListener('pointerup', up, {passive:false});
    el.addEventListener('pointercancel', up, {passive:false});
    el.addEventListener('pointerleave', up, {passive:false});
  }

  // Image-based virtual joystick, using the same joystick artwork as the
  // supplied/reference HUD. It continuously maps the thumb position to the
  // existing ArrowLeft/ArrowRight movement keys.
  const joystick = document.getElementById('joystick');
  if(joystick){
    let joyPointer = null;
    const releaseJoystick = ev=>{
      if(joyPointer !== null && ev && ev.pointerId !== joyPointer) return;
      joyPointer = null;
      keys['ArrowLeft']=false;
      keys['ArrowRight']=false;
    };
    const moveJoystick = ev=>{
      if(joyPointer !== ev.pointerId) return;
      ev.preventDefault();
      const r=joystick.getBoundingClientRect();
      const x=(ev.clientX-r.left)/r.width-.5;
      const dead=.16;
      keys['ArrowLeft']=x < -dead;
      keys['ArrowRight']=x > dead;
    };
    joystick.addEventListener('pointerdown', ev=>{
      ev.preventDefault();
      joyPointer=ev.pointerId;
      try{joystick.setPointerCapture(ev.pointerId);}catch(_){}
      moveJoystick(ev);
    }, {passive:false});
    joystick.addEventListener('pointermove', moveJoystick, {passive:false});
    joystick.addEventListener('pointerup', releaseJoystick, {passive:false});
    joystick.addEventListener('pointercancel', releaseJoystick, {passive:false});
    joystick.addEventListener('lostpointercapture', releaseJoystick, {passive:false});
  }

  setupTouchBtn('btnJump', ()=>keys['Space']=true, ()=>keys['Space']=false);
  setupTouchBtn('btnAttack', ()=>keys['KeyE']=true, ()=>keys['KeyE']=false);
  setupTouchBtn('btnParry', ()=>keys['KeyQ']=true, ()=>keys['KeyQ']=false);
  // Touch-only (see .touch-only in styles.css) — same R/T keys the
  // keyboard already uses, so the existing latch logic in 08_update.js
  // (one potion per press, not one per frame held) just works.
  setupTouchBtn('btnHealthPotion', ()=>keys['KeyR']=true, ()=>keys['KeyR']=false);
  setupTouchBtn('btnManaPotion', ()=>keys['KeyT']=true, ()=>keys['KeyT']=false);
>>>>>>> 6c18afef32ebbf611bfe2a2309eb78586e17448f
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
