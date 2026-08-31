// Sword Quest — Phase 2 floor-serpent raid.
// Uses the supplied 74-frame snake attack sequence. This attack is completely
// separate from the Phase-1 roaming snake and only runs while boss.phase === 2.

const phase2SnakeImages = Array.from({length:PHASE2_SNAKE_FRAME_COUNT}, (_, i) => {
  const img = new Image();
  img.decoding = 'async';
  img.src = `assets/phase2_snake/phase2_snake_${String(i + 1).padStart(3, '0')}.png`;
  return img;
});

function phase2SnakeGetFrame(index){
  index = Math.max(0, Math.min(PHASE2_SNAKE_FRAME_COUNT - 1, index|0));
  const current = phase2SnakeImages[index];
  if(current && current.complete && current.naturalWidth > 0) return current;
  for(let d=1; d<PHASE2_SNAKE_FRAME_COUNT; d++){
    const a = phase2SnakeImages[index-d];
    if(a && a.complete && a.naturalWidth > 0) return a;
    const b = phase2SnakeImages[index+d];
    if(b && b.complete && b.naturalWidth > 0) return b;
  }
  return null;
}
