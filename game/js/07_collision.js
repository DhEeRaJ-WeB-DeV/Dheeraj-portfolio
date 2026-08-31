// Sword Quest — preserved from the original working game.js

// ---------- Collision helpers ----------
  function aabb(a,b){
    return a.x < b.x+b.w && a.x+a.w > b.x && a.y < b.y+b.h && a.y+a.h > b.y;
  }

  function resolvePlatforms(entity){
    entity.onGround = false;
    // horizontal
    entity.x += entity.vx;
    for(const p of platforms){
      if(aabb(entity,p)){
        if(entity.vx > 0) entity.x = p.x - entity.w;
        else if(entity.vx < 0) entity.x = p.x + p.w;
      }
    }
    // vertical
    entity.y += entity.vy;
    for(const p of platforms){
      if(aabb(entity,p)){
        if(entity.vy > 0){ entity.y = p.y - entity.h; entity.vy = 0; entity.onGround = true; }
        else if(entity.vy < 0){ entity.y = p.y + p.h; entity.vy = 0; }
      }
    }
  }

  function spawnParticles(x,y,color,n){
    n = window.GFX ? window.GFX.scaleCount(n) : n;
    for(let i=0;i<n;i++){
      particles.push({
        x,y, vx:(Math.random()-0.5)*4, vy:-Math.random()*4-1,
        life:30+Math.random()*15, color, size:2+Math.random()*3
      });
    }
  }

  // Blood splatter used anywhere a weapon or attack actually connects
  // (player striking an enemy/boss, or an enemy/boss attack landing on the
  // player) in place of the old red hit-flash tint.
  //
  // Realism pass: real blood is a dark, fairly desaturated tone rather than
  // a bright "danger" color, it catches a small wet highlight instead of
  // being flat-shaded, it splatters in irregular clumps rather than perfect
  // circles/ellipses, and it visibly darkens ("dries") the longer it sits
  // instead of staying a flat bright color. Also toned the overall volume
  // down — fewer, better-shaped drops reads as real; a dense bright mist
  // reads as cartoonish. Two layers:
  //  - flying droplets: arc outward under gravity with a short motion-smear
  //    while moving fast (like real spatter), settling as they slow
  //  - lingering splatter pools: irregular multi-lobe blobs that darken over
  //    their lifetime, leaving a visible mark that actually looks dried
  //
  // `side` picks the palette. Boss blood is intentionally purple: deep
  // violet droplets with a wet magenta highlight, fading into dark plum
  // pools so the spill looks organic rather than like bright paint.
  const BLOOD_PALETTES = {
    hero:  { drops: ['#9c1c22', '#7a1117', '#4a0a0e'], pools: ['#6e0f14', '#4a0a0e'] },
    enemy: { drops: ['#1c9c2e', '#177a20', '#0e4a14'], pools: ['#0f6e18', '#0e4a14'] },
    boss:  { drops: ['#8f2bb3', '#5f197d', '#2d0b3d'], pools: ['#4b155f', '#240a31'] }
  };
  function spawnBlood(x,y,n,side='hero'){
    n = window.GFX ? window.GFX.scaleCount(n) : n;
    const palette = BLOOD_PALETTES[side] || BLOOD_PALETTES.hero;
    const dropCount = Math.max(1, Math.round(n * 0.5));
    for(let i=0;i<dropCount;i++){
      const r = Math.random();
      const color = r<0.25 ? palette.drops[0] : (r<0.65 ? palette.drops[1] : palette.drops[2]);
      const angle = Math.random()*Math.PI*2;
      const speed = 1.5+Math.random()*4.5;
      const life = 40+Math.random()*30;
      particles.push({
        x,y, vx:Math.cos(angle)*speed*0.7, vy:-Math.abs(Math.sin(angle))*speed - 0.5,
        life, maxLife:life, color, size:2.5+Math.random()*3.5,
        type:'blood', gravity:0.45, seed:Math.random()*10
      });
    }
    const poolCount = 3 + Math.floor(n/8);
    for(let i=0;i<poolCount;i++){
      const life = 90+Math.random()*70;
      particles.push({
        x: x + (Math.random()-0.5)*24,
        y: y + (Math.random()-0.5)*8 + 8,
        vx:(Math.random()-0.5)*0.2, vy:0.1,
        life, maxLife:life,
        color: Math.random()<0.5 ? palette.pools[0] : palette.pools[1],
        size:5+Math.random()*7, type:'bloodpool', gravity:0,
        seed:Math.random()*10, wobble:0.6+Math.random()*0.6
      });
    }
  }
