// Sword Quest — Cathedral Warden ground-serpent attack.
// Frames are pre-sized to 320x180 to keep canvas textures small and prevent
// GPU/compositor tearing when the attack is animated over the boss room.
// Playback starts from frame 000 for every spawned snake and loops smoothly.
const SNAKE_FRAME_COUNT = 160;
const SNAKE_FRAME_MS = 1000 / 30;

const snakeImages = Array.from({length:SNAKE_FRAME_COUNT}, (_,i)=>{
  const img = new Image();
  img.decoding = 'async';
  img.src = `assets/snake_attack/snake_attack_${String(i).padStart(3,'0')}.png`;
  return img;
});

function snakeFrameIndex(en) {
  // Start the attack animation when this particular snake spawns.
  // This prevents a newly spawned snake from appearing halfway through
  // the sequence just because the global game clock is elsewhere.
  const start = Number.isFinite(en.animationStart) ? en.animationStart : performance.now();
  const elapsed = Math.max(0, performance.now() - start);
  return Math.floor(elapsed / SNAKE_FRAME_MS) % SNAKE_FRAME_COUNT;
}

function snakeGetVisualImage(en) {
  const index = snakeFrameIndex(en);
  const current = snakeImages[index];

  // If the current frame is still loading, use the nearest already-loaded
  // frame instead of falling back to a plain placeholder. This makes the
  // attack animation visible immediately while the remaining PNGs load.
  if(current && current.complete && current.naturalWidth > 0) return current;

  for(let d=1; d<SNAKE_FRAME_COUNT; d++){
    const a = snakeImages[(index-d+SNAKE_FRAME_COUNT)%SNAKE_FRAME_COUNT];
    if(a && a.complete && a.naturalWidth > 0) return a;
    const b = snakeImages[(index+d)%SNAKE_FRAME_COUNT];
    if(b && b.complete && b.naturalWidth > 0) return b;
  }
  return null;
}
