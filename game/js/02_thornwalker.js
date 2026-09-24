// Sword Quest — preserved from the original working game.js

// ---------- THORNWALKER: SOURCE-IMAGE PIXEL ANIMATION ----------
  const THORN_DRAW_H = 104;

  // Last-resort fallback if even the idle frames below fail to load —
  // never expected to exist/load in the current asset set, kept only so
  // thornGetVisualImage() never returns nothing.
  const thornSourceIdle = new Image();
  thornSourceIdle.src = "assets/thornwalker/thornwalker_idle_source.png";


  // ---------- THORNWALKER: SMOOTH IDLE/WALK ANIMATION ----------
  // Real animation frames (extracted from the supplied Thornwalker monster
  // footage) replace the old single static idle pose. THORN_IDLE_FRAME_COUNT
  // frames are cycled forward-then-backward (ping-pong) for a seamless
  // breathing/swaying loop -- no crossfade needed since every frame is a
  // genuine, fully-rendered pose already.
  const THORN_IDLE_FRAME_COUNT = 160;
  const THORN_IDLE_FRAME_HOLD = 2; // engine frames each pose is held for

  const thornIdleImages = Array.from({length:THORN_IDLE_FRAME_COUNT}, (_,i)=>{
    const img = new Image();
    img.decoding = 'async';
    img.src = `assets/thornwalker/thornwalker_idle_${String(i).padStart(2,'0')}.png`;
    return img;
  });
