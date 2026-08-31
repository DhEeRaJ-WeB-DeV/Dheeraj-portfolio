// Sword Quest — preserved from the original working game.js

// ---------- BAT: SMOOTH FLYING ANIMATION ----------
  // 8 real wing-flap frames (extracted + cleaned from supplied bat footage,
  // background removed to transparent, cropped/aligned to a shared frame so
  // there's no jitter). The cycle already starts and ends on the same open-
  // wing pose, so it loops forward continuously (open -> tuck -> open) for a
  // natural, non-stuttering flap instead of a ping-pong bounce.
  const BAT_FLY_FRAME_COUNT = 8;
  const BAT_FLY_FRAME_HOLD = 3; // engine frames each wing pose is held for

  const batFlyImages = Array.from({length:BAT_FLY_FRAME_COUNT}, (_,i)=>{
    const img = new Image();
    img.decoding = 'async';
    img.src = `assets/bat/bat_fly_${String(i+1).padStart(2,'0')}.png`;
    return img;
  });
