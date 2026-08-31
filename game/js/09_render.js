// Sword Quest — preserved from the original working game.js

// ---------- Draw ----------
  // Small hex-color interpolation helper used to "dry"/darken blood pools
  // over their lifetime instead of keeping a flat, unrealistic color.
  function lerpColor(hexA, hexB, t){
    t = Math.max(0, Math.min(1, t));
    const a = parseInt(hexA.slice(1),16), b = parseInt(hexB.slice(1),16);
    const ar=(a>>16)&255, ag=(a>>8)&255, ab=a&255;
    const br=(b>>16)&255, bg=(b>>8)&255, bb=b&255;
    const rr=Math.round(ar+(br-ar)*t), rg=Math.round(ag+(bg-ag)*t), rb=Math.round(ab+(bb-ab)*t);
    return `rgb(${rr},${rg},${rb})`;
  }

  // the painted stone walkway in both backgrounds sits at ~80% down the image;
  // we zoom/shift it slightly so that row lands exactly on GROUND_Y, and scroll
  // it 1:1 with the level so the player's feet stay locked to the painted floor
  const BG_FLOOR_FRAC = 0.8;
  const BG_ZOOM = 1.12;

  function drawBackground(){
    if(currentLevel === 3){
      // Exact 8:3 canvas ratio (1200x450) matches the uploaded 1568x588
      // artwork. Draw it 1:1 in aspect ratio so absolutely no edge is cropped.
      if(bossBgImage.complete && bossBgImage.naturalWidth){
        ctx.drawImage(bossBgImage,0,0,W,H);
      } else {
        ctx.fillStyle='#120d12';
        ctx.fillRect(0,0,W,H);
      }
      return;
    }
    const activeImg = currentLevel === 2 ? bg2Image : bgImage;
    if(activeImg.complete && activeImg.naturalWidth){
      const dh = H * BG_ZOOM;
      const scale = dh / activeImg.naturalHeight;
      const imgW = activeImg.naturalWidth * scale;
      const dy = GROUND_Y - BG_FLOOR_FRAC * dh;
      let startX = -(camX % imgW);
      if(startX > 0) startX -= imgW;
      for(let x = startX; x < W; x += imgW){
        ctx.drawImage(activeImg, x, dy, imgW, dh);
      }
      if(currentLevel === 2){
        ctx.fillStyle = 'rgba(8,6,14,0.28)';
        ctx.fillRect(0,0,W,H);
      }
    } else {
      ctx.fillStyle = currentLevel === 2 ? '#141021' : '#221d19';
      ctx.fillRect(0,0,W,H);
    }
  }

  function drawPit(x0, x1){
    const sx0 = x0-camX, sx1 = x1-camX;
    if(sx1 < -20 || sx0 > W+20) return;
    // a real gap cut into the painted floor, so a missing platform reads as a
    // drop into the dark rather than floor you'd fall through invisibly
    const grad = ctx.createLinearGradient(0, GROUND_Y, 0, H);
    grad.addColorStop(0, 'rgba(4,3,3,0.94)');
    grad.addColorStop(1, 'rgba(0,0,0,0.99)');
    ctx.fillStyle = grad;
    ctx.fillRect(sx0, GROUND_Y, sx1-sx0, H-GROUND_Y);
    ctx.fillStyle = 'rgba(90,75,50,0.3)';
    ctx.fillRect(sx0, GROUND_Y, sx1-sx0, 2);
  }

  function drawPlatforms(){
    if(currentLevel === 3){
      const imgReady = bossPlatformImg.complete && bossPlatformImg.naturalWidth;
      if(imgReady){
        // Scale the supplied transparent cutout to the complete arena width
        // without changing its aspect ratio. Its stone walking surface sits
        // around source row 340, so offset it until that surface meets the
        // exact collision line at GROUND_Y. Nothing is cropped horizontally.
        const drawW = W;
        const scale = drawW / bossPlatformImg.naturalWidth;
        const drawH = bossPlatformImg.naturalHeight * scale;
        const walkSurfaceSourceY = 340;
        const drawY = GROUND_Y - walkSurfaceSourceY * scale;
        ctx.imageSmoothingEnabled = true;
        ctx.drawImage(bossPlatformImg, 0, drawY, drawW, drawH);
      } else {
        const grad = ctx.createLinearGradient(0,GROUND_Y,0,H);
        grad.addColorStop(0,'rgba(54,45,39,0.95)');
        grad.addColorStop(1,'rgba(9,7,8,0.98)');
        ctx.fillStyle=grad;
        ctx.fillRect(0,GROUND_Y,W,H-GROUND_Y);
        ctx.fillStyle='rgba(201,168,98,0.5)';
        ctx.fillRect(0,GROUND_Y,W,2);
      }
      return;
    }
    // cut pits wherever the ground platforms don't cover, so the painted floor
    // never shows solid where there's actually a drop
    const groundSegs = platforms.filter(p=>p.h>30).slice().sort((a,b)=>a.x-b.x);
    let prevEnd = 0;
    for(const g of groundSegs){
      if(g.x > prevEnd) drawPit(prevEnd, g.x);
      prevEnd = Math.max(prevEnd, g.x+g.w);
    }
    if(prevEnd < LEVEL_WIDTH) drawPit(prevEnd, LEVEL_WIDTH);

    const imgReady = platformImg.complete && platformImg.naturalWidth;
    const imgAspect = imgReady ? platformImg.naturalWidth/platformImg.naturalHeight : 7;

    for(const p of platforms){
      const sx = p.x - camX;
      if(sx+p.w < -20 || sx > W+20) continue;
      if(imgReady){
        // stretch the uploaded stone-ledge art to this platform's width,
        // keeping its own proportions, anchored so its flat top sits exactly
        // on the walkable line — this is the same asset for every platform,
        // ground or floating, so they all read as one consistent set of ruins
        const drawH = p.w / imgAspect;
        ctx.drawImage(platformImg, sx, p.y, p.w, drawH);
      } else {
        // fallback carved-stone look while the image loads
        const ph = p.h>30 ? p.h : 20;
        const grad = ctx.createLinearGradient(0, p.y, 0, p.y+ph);
        grad.addColorStop(0,   'rgba(58,50,40,0.92)');
        grad.addColorStop(0.3, 'rgba(28,24,19,0.88)');
        grad.addColorStop(1,   'rgba(10,8,7,0.55)');
        ctx.fillStyle = grad;
        ctx.fillRect(sx, p.y, p.w, ph);
        ctx.fillStyle = 'rgba(201,168,98,0.55)';
        ctx.fillRect(sx, p.y, p.w, 1.5);
      }
    }
    const spikeImgReady = spikeTrapImg.complete && spikeTrapImg.naturalWidth;
    const spikeAspect = spikeImgReady ? spikeTrapImg.naturalWidth/spikeTrapImg.naturalHeight : 2.05;
    for(const s of spikes){
      const sx = s.x-camX;
      if(spikeImgReady){
        // Draw the uploaded spike-trap artwork, scaled up a bit beyond the
        // hitbox for visual punch, bottom-anchored to the hazard's ground
        // line and centered over the (narrower) collision box.
        const drawH = s.h * 2.4;
        const drawW = drawH * spikeAspect;
        const cx = sx + s.w/2;
        ctx.imageSmoothingEnabled = true;
        ctx.drawImage(spikeTrapImg, cx - drawW/2, s.y+s.h-drawH, drawW, drawH);
      } else {
        // fallback carved-spike look while the image loads
        ctx.fillStyle = 'rgba(74,62,54,0.85)';
        for(let i=0;i<s.w;i+=15){
          ctx.beginPath();
          ctx.moveTo(sx+i, s.y+s.h);
          ctx.lineTo(sx+i+7.5, s.y);
          ctx.lineTo(sx+i+15, s.y+s.h);
          ctx.closePath();
          ctx.fill();
        }
        ctx.strokeStyle = 'rgba(201,168,98,0.25)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        for(let i=0;i<s.w;i+=15){
          ctx.moveTo(sx+i, s.y+s.h);
          ctx.lineTo(sx+i+7.5, s.y);
        }
        ctx.stroke();
      }
    }
  }

  function drawGems(){
    for(const g of gems){
      if(g.taken) continue;
      g.bob += 0.06;
      const gy = g.y + Math.sin(g.bob)*4;
      const gx = g.x - camX;
      if(gx < -20 || gx > W+20) continue;
      ctx.save();
      ctx.translate(gx,gy);
      ctx.rotate(Math.PI/4);
      ctx.fillStyle = '#66d1c9';
      ctx.shadowColor = '#66d1c9'; ctx.shadowBlur = 10;
      ctx.fillRect(-6,-6,12,12);
      ctx.restore();
    }
  }

  function drawGoal(){
    if(!goal) return;
    const gx = goal.x-camX;
    if(gx>-160 && gx<W+160){
      const imgReady = checkpointGateImg.complete && checkpointGateImg.naturalWidth;
      if(imgReady){
        // Scale the gate so it stands on the ground at the goal's ledge,
        // matching the old flag's footprint but tall enough to read clearly.
        const aspect = checkpointGateImg.naturalWidth / checkpointGateImg.naturalHeight;
        const drawH = goal.h + 70;
        const drawW = drawH * aspect;
        const drawX = gx + goal.w/2 - drawW/2;
        const drawY = goal.y + goal.h - drawH;
        ctx.drawImage(checkpointGateImg, drawX, drawY, drawW, drawH);
      } else {
        // Fallback while the artwork loads, so the goal is never invisible.
        ctx.fillStyle = '#8a6a34';
        ctx.fillRect(gx+22, goal.y, 6, goal.h);
        ctx.fillStyle = 'rgba(217,164,65,0.85)';
        ctx.beginPath();
        ctx.moveTo(gx+28, goal.y);
        ctx.lineTo(gx+28+40, goal.y+14);
        ctx.lineTo(gx+28, goal.y+28);
        ctx.closePath();
        ctx.fill();
      }
    }
  }

  const snakeDomLayer = document.getElementById('snakeDomLayer');
  const snakeDomNodes = new Map();
  const snakeDomHealthNodes = new Map();
  let snakeDomFrameUsed = 0;

  function beginSnakeDomFrame(){
    snakeDomFrameUsed = 0;
  }

  function drawSnakeDom(en){
    if(!snakeDomLayer || !en || !en.alive) return;
    const sprite = snakeGetVisualImage(en);
    if(!sprite) return;

    let node = snakeDomNodes.get(en);
    if(!node){
      node = document.createElement('img');
      node.alt = '';
      node.draggable = false;
      node.decoding = 'async';
      snakeDomNodes.set(en,node);
      snakeDomLayer.appendChild(node);
    }
    if(node.src !== sprite.src) node.src = sprite.src;

    // Separate DOM health bar: it never touches the game canvas, so the
    // snake's animated PNG frames remain isolated from the background.
    let hp = snakeDomHealthNodes.get(en);
    if(!hp){
      hp = document.createElement('div');
      hp.className = 'snake-health-bar';
      hp.innerHTML = '<div class="snake-health-fill"></div>';
      snakeDomHealthNodes.set(en,hp);
      snakeDomLayer.appendChild(hp);
    }

    const drawH = SNAKE_DRAW_H;
    const drawW = drawH * (sprite.naturalWidth / sprite.naturalHeight);
    const sx = (en.x - camX + en.w/2) - drawW/2;
    const sy = (en.y + en.h) - drawH;
    const scaleX = snakeDomLayer.clientWidth / W || 1;
    const scaleY = snakeDomLayer.clientHeight / H || 1;
    const facing = en.dir >= 0 ? 1 : -1;

    node.style.width = `${drawW * scaleX}px`;
    node.style.height = `${drawH * scaleY}px`;
    node.style.left = `${sx * scaleX}px`;
    node.style.top = `${sy * scaleY}px`;
    node.style.transformOrigin = '50% 100%';
    node.style.transform = `scaleX(${facing})`;
    node.style.visibility = 'visible';

    const barW = Math.max(44, drawW * 0.62) * scaleX;
    const barH = 7 * scaleY;
    const barX = (sx + (drawW - drawW * 0.62)/2) * scaleX;
    const barY = Math.max(2, sy * scaleY - 13 * scaleY);
    const hpRatio = en.maxHealth > 0 ? Math.max(0, Math.min(1, en.health / en.maxHealth)) : 0;

    hp.style.width = `${barW}px`;
    hp.style.height = `${barH}px`;
    hp.style.left = `${barX}px`;
    hp.style.top = `${barY}px`;
    hp.style.visibility = 'visible';
    hp.querySelector('.snake-health-fill').style.width = `${hpRatio * 100}%`;

    snakeDomFrameUsed++;
  }

  function endSnakeDomFrame(){
    for(const [en,node] of snakeDomNodes){
      if(!en.alive || currentLevel !== 3 || !snakeDomFrameUsed){
        node.style.visibility = 'hidden';
        const hp = snakeDomHealthNodes.get(en);
        if(hp) hp.style.visibility = 'hidden';
      }
    }
  }

  function drawEnemy(en){
    if(!en.alive) return;
    const ex = en.x-camX;
    if(ex<-60||ex>W+60) return;

    ctx.save();
    ctx.translate(ex, en.y);

    if(en.type === 'crawler'){
      // low spider-like ground crawler
      ctx.fillStyle = '#26161a';
      ctx.beginPath();
      ctx.ellipse(en.w/2, en.h*0.6, en.w/2, en.h*0.4, 0, 0, Math.PI*2);
      ctx.fill();
      ctx.strokeStyle = '#26161a';
      ctx.lineWidth = 2;
      for(let i=-1;i<=1;i+=2){
        for(let j=0;j<3;j++){
          ctx.beginPath();
          ctx.moveTo(en.w/2 + i*4, en.h*0.55);
          ctx.lineTo(en.w/2 + i*(10+j*4), en.h*0.3 + j*4);
          ctx.stroke();
        }
      }
      ctx.fillStyle = '#c9622a';
      ctx.beginPath();
      ctx.arc(en.w/2 - 4*en.dir, en.h*0.5, 1.6, 0, Math.PI*2);
      ctx.arc(en.w/2 + 4*en.dir, en.h*0.5, 1.6, 0, Math.PI*2);
      ctx.fill();

    } else if(en.type === 'brute'){
      // heavy, horned demon
      ctx.fillStyle = '#3a1418';
      ctx.beginPath();
      ctx.moveTo(en.w*0.1, en.h);
      ctx.lineTo(en.w*0.05, en.h*0.4);
      ctx.quadraticCurveTo(en.w*0.5, en.h*0.05, en.w*0.95, en.h*0.4);
      ctx.lineTo(en.w*0.9, en.h);
      ctx.closePath();
      ctx.fill();
      // horns
      ctx.fillStyle = '#d9c9a0';
      ctx.beginPath();
      ctx.moveTo(en.w*0.22, en.h*0.32); ctx.lineTo(en.w*0.1, en.h*0.02); ctx.lineTo(en.w*0.34, en.h*0.28);
      ctx.closePath(); ctx.fill();
      ctx.beginPath();
      ctx.moveTo(en.w*0.78, en.h*0.32); ctx.lineTo(en.w*0.9, en.h*0.02); ctx.lineTo(en.w*0.66, en.h*0.28);
      ctx.closePath(); ctx.fill();
      // eyes
      ctx.fillStyle = '#e0555f';
      ctx.beginPath();
      ctx.arc(en.w/2 - 8*en.dir, en.h*0.42, 2.5, 0, Math.PI*2);
      ctx.arc(en.w/2 + 8*en.dir, en.h*0.42, 2.5, 0, Math.PI*2);
      ctx.fill();

    } else if(en.type === 'flyer'){
      // Real bat sprite: flap-cycle frames, drawn with a gentle sine bob and
      // a bank/tilt in the direction of travel so the flight reads as alive
      // rather than a rigid slide.
      const sprite = batGetVisualImage(en);
      const facing = en.dir >= 0 ? 1 : -1;
      const bobPx = Math.sin(frameCount*0.14 + (en.phase||0)) * 1.6;
      const bankDeg = facing * 0.12; // slight forward bank into the flight direction

      if(sprite){
        const BAT_DRAW_H = en.h * 2.1;
        const drawW = BAT_DRAW_H * (sprite.naturalWidth / sprite.naturalHeight);
        ctx.save();
        ctx.translate(en.w/2, en.h/2 + bobPx);
        ctx.scale(facing, 1);
        ctx.rotate(bankDeg);
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(sprite, -drawW/2, -BAT_DRAW_H/2, drawW, BAT_DRAW_H);
        ctx.restore();
      } else {
        // fallback silhouette while the sprite sheet is still loading
        const flap = Math.sin(frameCount*0.3)*0.5+0.5;
        ctx.fillStyle = '#241418';
        ctx.beginPath();
        ctx.ellipse(en.w/2, en.h*0.5, en.w*0.32, en.h*0.42, 0, 0, Math.PI*2);
        ctx.fill();
        ctx.fillStyle = '#3a2020';
        ctx.beginPath();
        ctx.moveTo(en.w*0.4, en.h*0.4);
        ctx.lineTo(en.w*0.4 - 16, en.h*0.1 - flap*10);
        ctx.lineTo(en.w*0.4 - 4, en.h*0.5);
        ctx.closePath(); ctx.fill();
        ctx.beginPath();
        ctx.moveTo(en.w*0.6, en.h*0.4);
        ctx.lineTo(en.w*0.6 + 16, en.h*0.1 - flap*10);
        ctx.lineTo(en.w*0.6 + 4, en.h*0.5);
        ctx.closePath(); ctx.fill();
      }

    } else if(en.type === 'snake'){
      // IMPORTANT: do not draw the animated snake frames into the game canvas.
      // Swapping large, frequently-decoded PNGs inside a scaled canvas was
      // triggering browser/GPU partial-surface corruption: a stale rectangular
      // chunk of the canvas would briefly show an older frame/background.
      // The snake is therefore composited as a transparent DOM image above the
      // canvas. The game canvas itself is never touched by the snake animation.
      drawSnakeDom(en);

    } else if(en.type === 'thornwalker'){
      // Every attack frame is a complete source-image pose.
      if(en.state !== 'swinging'){
        const pulse=(Math.sin(frameCount*0.09 + en.x*0.02)+1)/2;
        const alertness=en.state==='winding' ? 0.35 : (en.state==='chasing' ? 0.28 : 0.14);
        ctx.save();
        ctx.strokeStyle=`rgba(224,85,95,${alertness+pulse*0.12})`;
        ctx.lineWidth=1.4;
        ctx.setLineDash([5,6]);
        ctx.beginPath();
        ctx.arc(en.w/2,en.h*0.6,THORNWALKER_DETECT_RADIUS,0,Math.PI*2);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
      }

      const facing=en.dir>=0?1:-1;
      const bob=(en.state==='chasing' ? Math.sin(frameCount*0.28)*1.0 : 0);
      const sprite=thornGetVisualImage(en);

      if(sprite){
        ctx.save();
        ctx.translate(en.w/2,en.h-1+bob);
        ctx.scale(facing,1);

        // IMPORTANT: nearest-neighbour only. No browser interpolation.
        ctx.imageSmoothingEnabled=false;
        ctx.globalAlpha=1;
        // Each frame set (idle vs attack) has its own natural aspect ratio,
        // so derive the draw width from the sprite itself rather than a
        // single hard-coded constant -- keeps every pose correctly proportioned.
        const drawW = THORN_DRAW_H * (sprite.naturalWidth / sprite.naturalHeight);
        ctx.drawImage(sprite,-drawW*0.5,-THORN_DRAW_H,drawW,THORN_DRAW_H);

        ctx.restore();
      }

    } else {
      // wraith (default)
      ctx.fillStyle = '#2a1a20';
      ctx.beginPath();
      ctx.ellipse(en.w/2, en.h*0.6, en.w/2, en.h*0.42, 0, 0, Math.PI*2);
      ctx.fill();
      ctx.fillStyle = '#8a2a2a';
      ctx.beginPath();
      ctx.arc(en.w/2 - 5*en.dir, en.h*0.5, 3, 0, Math.PI*2);
      ctx.arc(en.w/2 + 5*en.dir, en.h*0.5, 3, 0, Math.PI*2);
      ctx.fill();
      ctx.fillStyle = '#e0555f';
      ctx.beginPath();
      ctx.arc(en.w/2 - 5*en.dir, en.h*0.5, 1.4, 0, Math.PI*2);
      ctx.arc(en.w/2 + 5*en.dir, en.h*0.5, 1.4, 0, Math.PI*2);
      ctx.fill();
    }
    ctx.restore();

    // Small enemy health bar. Thornwalkers always show their bar so the
    // player can immediately see that they take exactly 3 hits; other
    // enemies keep the original behavior of showing it only after damage.
    if(en.type === 'thornwalker' || en.health < en.maxHealth){
      const barH = 4;
      const barY = en.y - 18.0;
      ctx.fillStyle = '#3a1418';
      ctx.fillRect(ex, barY, en.w, barH);
      ctx.fillStyle = '#c9622a';
      ctx.fillRect(ex, barY, en.w * Math.max(0, Math.min(1, en.health / en.maxHealth)), barH);
    }
  }

  function drawBoss(){
    if(currentLevel !== 3 || !boss) return;

    const bx = boss.x - camX;

    // Boss introduction subtitle. It remains on screen during the full
    // 8-second pause before the ground entrance begins. A condensed combat
    // reminder sits underneath it — the detailed tips already showed on the
    // "THE THRONE HALL" card before the player chose to descend, but that
    // card is easy to skim past, so this repeats the two things that matter
    // most right as the fight actually begins.
    if(!boss.introComplete){
      ctx.save();
      const remaining = boss.introTimer || 0;
      const fade = Math.min(1, Math.max(0, remaining / 24));
      ctx.globalAlpha = 0.78 + 0.22 * fade;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = 'bold 24px monospace';
      ctx.fillStyle = '#f1e7c8';
      ctx.strokeStyle = '#160f0d';
      ctx.lineWidth = 6;
      ctx.strokeText('"How dare u enter my domain"', W/2, H*0.20);
      ctx.fillText('"How dare u enter my domain"', W/2, H*0.20);

      ctx.font = '15px monospace';
      ctx.lineWidth = 4;
      ctx.fillStyle = '#c9a862';
      const hint = 'Hit its HEAD with E  •  Parry gold-flash attacks with Q';
      ctx.strokeText(hint, W/2, H*0.20 + 34);
      ctx.fillText(hint, W/2, H*0.20 + 34);
      ctx.restore();
    }

    const img = bossGetVisualImage();

    ctx.save();

    // Floor aura behind the animated boss.
    const emerge = boss.emergeProgress == null ? 1 : boss.emergeProgress;
    ctx.globalAlpha = 0.12 + 0.10 * emerge;
    ctx.fillStyle = '#8b2635';
    ctx.beginPath();
    ctx.ellipse(bx + boss.w/2, GROUND_Y + 4, 82, 13, 0, 0, Math.PI*2);
    ctx.fill();
    ctx.globalAlpha = 1;

    if(img){
      // Visual is centered on the boss hitbox and its feet stay on GROUND_Y.
      const drawH = BOSS_DRAW_H;
      const drawW = drawH * (img.naturalWidth / img.naturalHeight);
      const drawX = bx + boss.w/2 - drawW/2;

      // The sprite rises with the boss. It starts mostly below the floor and
      // eases upward until the feet meet the arena floor; no new artwork is
      // needed, only the existing boss frames are vertically offset.
      const emerge = boss.emergeProgress == null ? 1 : boss.emergeProgress;
      const undergroundOffset = (1 - emerge) * drawH * 0.88;
      const drawY = GROUND_Y - drawH + undergroundOffset;

      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(img, drawX, drawY, drawW, drawH);

      // Dust/stone disturbance grows as the boss breaks through the floor.
      if(boss.emerging && emerge > 0.05){
        const dust = emerge * (1 - emerge) * 9;
        ctx.globalAlpha = Math.min(0.5, dust);
        ctx.fillStyle = '#c2a878';
        for(let i=0;i<7;i++){
          const side = i%2===0 ? -1 : 1;
          const px = bx + boss.w/2 + side*(18 + i*8) + Math.sin(frameCount*0.12+i)*3;
          const py = GROUND_Y - 2 - Math.sin(frameCount*0.16+i)*2;
          ctx.beginPath();
          ctx.arc(px, py, 1.5 + (i%3), 0, Math.PI*2);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
      }
    }

    ctx.restore();

    // Bottom-screen boss health HUD.
    // The supplied artwork already contains the gothic gold/red frame and title.
    // It is drawn near the bottom instead of the old plain top health bar.
    if(bossHealthHudImg.complete && bossHealthHudImg.naturalWidth){
      const hudW = Math.min(W - 170.0, 468);
      const hudScale = hudW / bossHealthHudImg.naturalWidth;
      const hudH = bossHealthHudImg.naturalHeight * hudScale;
      const hudX = (W - hudW) / 2;
      const hudY = H - hudH - 10;

      ctx.save();
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(bossHealthHudImg, hudX, hudY, hudW, hudH);

      // Darken the unfilled portion of the red strip while leaving the gold
      // frame and central crest untouched. Source coordinates refer to the
      // processed 1714x384 HUD asset.
      const healthRatio = Math.max(0, Math.min(1, boss.health / boss.maxHealth));
      const sxLeft = 126, sxCenterL = 790, sxCenterR = 924, sxRight = 1588;
      const sy = 181, sh = 72;
      const totalFillWidth = (sxCenterL - sxLeft) + (sxRight - sxCenterR);
      const missing = totalFillWidth * (1 - healthRatio);

      ctx.fillStyle = 'rgba(12,5,7,0.84)';

      // Consume the missing health from right to left.
      let remaining = missing;
      const rightMissing = Math.min(remaining, sxRight - sxCenterR);
      if(rightMissing > 0){
        const x = sxRight - rightMissing;
        ctx.fillRect(
          hudX + x * hudScale,
          hudY + sy * hudScale,
          rightMissing * hudScale,
          sh * hudScale
        );
        remaining -= rightMissing;
      }
      if(remaining > 0){
        const leftMissing = Math.min(remaining, sxCenterL - sxLeft);
        ctx.fillRect(
          hudX + (sxLeft + (sxCenterL - sxLeft) - leftMissing) * hudScale,
          hudY + sy * hudScale,
          leftMissing * hudScale,
          sh * hudScale
        );
      }

      ctx.restore();
    }

    // Phase-2 floor-serpent warning / attack.
    if(boss.phase === 2 && boss.phase2SnakeAttack && !boss.emerging){
      const raid = boss.phase2SnakeAttack;
      const laneW = W / PHASE2_SNAKE_LANES;

      if(raid.state === 'warning'){
        const pulse = 0.45 + 0.20 * Math.sin(frameCount * 0.16);
        for(let lane=0; lane<PHASE2_SNAKE_LANES; lane++){
          if(lane === raid.safeLane) continue;
          const x = lane * laneW;
          ctx.save();
          ctx.fillStyle = `rgba(210, 35, 48, ${pulse})`;
          ctx.fillRect(x + 5, GROUND_Y - 24, laneW - 10, 24);
          ctx.strokeStyle = `rgba(255, 85, 85, ${0.55 + pulse * 0.4})`;
          ctx.lineWidth = 2;
          ctx.strokeRect(x + 5, GROUND_Y - 24, laneW - 10, 24);
          ctx.fillStyle = 'rgba(255, 70, 70, 0.85)';
          for(let s=0; s<3; s++){
            const sx = x + laneW * (0.22 + s*0.28);
            ctx.fillRect(sx, GROUND_Y - 20, 2, 14 + Math.sin(frameCount*0.12+s)*4);
          }
          ctx.restore();
        }

        // Clearly mark the single safe opening.
        ctx.save();
        ctx.strokeStyle = 'rgba(125, 225, 160, 0.9)';
        ctx.lineWidth = 2;
        ctx.setLineDash([7,5]);
        ctx.strokeRect(raid.safeLane * laneW + 7, GROUND_Y - 26, laneW - 14, 26);
        ctx.restore();

        ctx.save();
        ctx.textAlign = 'center';
        ctx.font = 'bold 13px monospace';
        ctx.fillStyle = 'rgba(255,235,210,0.92)';
        ctx.strokeStyle = 'rgba(30,8,10,0.85)';
        ctx.lineWidth = 4;
        ctx.strokeText('MOVE TO THE SAFE SPACE', W/2, GROUND_Y - 34);
        const secondsLeft = Math.max(1, Math.ceil(raid.timer / 60));
        ctx.fillText(`MOVE TO THE SAFE SPACE  •  ${secondsLeft}s`, W/2, GROUND_Y - 34);
        ctx.restore();
      } else if(raid.state === 'rising'){
        const frame = Math.min(PHASE2_SNAKE_FRAME_COUNT - 1,
          Math.floor(raid.frame / PHASE2_SNAKE_FRAME_STEP));
        const img = phase2SnakeGetFrame(frame);
        const progress = Math.min(1, raid.frame / 24);
        const laneW2 = W / PHASE2_SNAKE_LANES;

        for(let lane=0; lane<PHASE2_SNAKE_LANES; lane++){
          if(lane === raid.safeLane) continue;
          if(!img) continue;
          const drawH = PHASE2_SNAKE_DRAW_H;
          const drawW = drawH * (img.naturalWidth / img.naturalHeight);
          const cx = lane * laneW2 + laneW2/2;
          const drawX = cx - drawW/2;
          const drawY = GROUND_Y - drawH + (1-progress) * drawH * 0.92;

          ctx.save();
          // The snake originates below the platform. Clip at the platform top
          // so it visibly erupts upward rather than simply appearing in front.
          ctx.beginPath();
          ctx.rect(0, 0, W, GROUND_Y);
          ctx.clip();
          ctx.globalAlpha = Math.min(1, 0.35 + progress * 0.65);
          ctx.filter = window.GFX
            ? window.GFX.glowFilter(['drop-shadow(0 0 5px rgba(220,45,55,.9))', 'drop-shadow(0 0 16px rgba(220,45,55,.65))'])
            : 'drop-shadow(0 0 5px rgba(220,45,55,.9)) drop-shadow(0 0 16px rgba(220,45,55,.65))';
          ctx.drawImage(img, drawX, drawY, drawW, drawH);
          ctx.restore();
        }
      }
    }

    // Attack telegraphs/projectiles
    for(const p of bossProjectiles){
      ctx.save();
      if(p.type==='wave'){
        // Ground-wave attack: visual warning intentionally removed per request
        // (the wave's hitbox/logic in 08_update.js is untouched — only the
        // red triangle telegraph that used to be drawn here is gone).
      } else if(p.type==='fall'){
        // Falling-ball attack: the supplied crystalline-orb artwork, red
        // while it's still dangerous to the player, swapped to the blue
        // version once parried and now flying at the boss instead. A slow
        // spin sells the "orb of energy" feel; falls back to the plain
        // rect if the art hasn't finished loading yet.
        // Use the supplied artwork for all three states:
        // red = dangerous, yellow = ideal parry timing, blue = deflected.
        const img = p.deflected
          ? ballDeflectedImg
          : (p.parryReady ? ballYellowImg : ballFallImg);
        const cx = p.x - camX + p.w/2, cy = p.y + p.h/2;
        if(img && img.complete && img.naturalWidth > 0){
          const drawSize = p.deflected ? 46 : 40;
          const drawW = drawSize, drawH = drawSize * (img.naturalHeight/img.naturalWidth);
          ctx.save();
          ctx.translate(cx, cy);
          ctx.rotate(frameCount * (p.deflected ? -0.09 : 0.06));

          if(p.deflected){
            const layers = [
              'drop-shadow(0 0 4px #ffffff)',
              'drop-shadow(0 0 10px #4fd6ff)',
              'drop-shadow(0 0 20px #4fd6ff)',
              'drop-shadow(0 0 36px rgba(79,214,255,0.8))'
            ];
            ctx.filter = window.GFX ? window.GFX.glowFilter(layers) : layers.join(' ');
          } else if(p.parryReady){
            // The supplied yellow image is the actual parry-window visual.
            // Add a small extra glow so the timing cue is unmistakable.
            const layers = [
              'drop-shadow(0 0 4px #ffffff)',
              'drop-shadow(0 0 10px #fff200)',
              'drop-shadow(0 0 22px #ffd000)',
              'drop-shadow(0 0 38px rgba(255,215,0,0.9))'
            ];
            ctx.filter = window.GFX ? window.GFX.glowFilter(layers) : layers.join(' ');
          } else {
            const layers = [
              'drop-shadow(0 0 4px #ffffff)',
              'drop-shadow(0 0 10px #ff3b3b)',
              'drop-shadow(0 0 20px #ff3b3b)',
              'drop-shadow(0 0 36px rgba(255,59,59,0.8))'
            ];
            ctx.filter = window.GFX ? window.GFX.glowFilter(layers) : layers.join(' ');
          }

          ctx.drawImage(img, -drawW/2, -drawH/2, drawW, drawH);
          ctx.filter = 'none';
          ctx.restore();
        } else {
          if(p.deflected){
            ctx.fillStyle = '#8fe8ff';
            ctx.shadowColor = '#8fe8ff';
          } else if(p.parryReady){
            ctx.fillStyle = '#ffd92f';
            ctx.shadowColor = '#ffd92f';
          } else {
            ctx.fillStyle = '#d6c59a';
            ctx.shadowColor = '#e0555f';
          }
          ctx.shadowBlur = 10;
          ctx.fillRect(p.x-camX,p.y,p.w,p.h);
        }
      } else {
        // Sword-sweep attack: visual warning intentionally removed per
        // request (the sweep's hitbox/logic in 08_update.js is untouched —
        // only the pink arc telegraph that used to be drawn here is gone).
      }
      ctx.restore();
    }
  }

  function drawPlayer(){
    const px = player.x-camX;
    ctx.save();
    if(player.invuln>0 && player.invuln%8<4) ctx.globalAlpha = 0.4;

    // contact shadow pooling into the stone ledge, so the figure feels
    // planted on the platform rather than floating over it
    ctx.save();
    ctx.globalAlpha *= 0.45;
    ctx.fillStyle = '#000000';
    ctx.beginPath();
    ctx.ellipse(px+player.w/2, player.y+player.h+1, player.w*0.58, 4.5, 0, 0, Math.PI*2);
    ctx.fill();
    ctx.restore();

    ctx.translate(px + player.w/2, player.y + player.h);
    // The hero source frames are naturally drawn facing left, so mirror them
    // (negate facing) to line up with player.facing = 1 meaning "moving/
    // facing right". This is the inverse of a sprite sheet that natively
    // faces right.
    ctx.scale(-player.facing, 1);

    // Real hero sprite: attack/jump/movement frame sets swapped based on
    // player state (see heroGetSprite). Anchored at the feet so the sprite's
    // own baked-in proportions (which vary in width between sets, e.g. the
    // wide attack swing arcs) don't shift the character's footing.
    const sprite = heroGetSprite();
    if (sprite) {
      const drawH = player.h * HERO_DRAW_SCALE;
      const drawW = drawH * (sprite.naturalWidth / sprite.naturalHeight);
      ctx.imageSmoothingEnabled = false;
      if (player.parrying) {
        // Reusing the attack swing frames for the parry stance, so tint them
        // a cool steel-blue to keep the two actions visually distinct.
        ctx.filter = 'brightness(1.2) saturate(1.3) hue-rotate(150deg)';
      }
      ctx.drawImage(sprite, -drawW/2, -drawH, drawW, drawH);
      ctx.filter = 'none';
    } else {
      // Minimal placeholder so there's never a blank gap during the brief
      // window before the first frame finishes loading.
      ctx.fillStyle = '#171410';
      ctx.fillRect(-11, -34, 22, 30);
      ctx.beginPath();
      ctx.arc(0, -38, 10, 0, Math.PI*2);
      ctx.fill();
    }
    ctx.restore();

    // Successful-parry burst: a small blue/gold spark-flash sprite marking
    // the frame the parry's active window matched the enemy's attack.
    // Plays once through its short frame set, kept deliberately small so it
    // reads as a sharp "clink" accent rather than a big screen effect.
    if (player.parrySuccessFlash > 0) {
      const elapsed = PARRY_SUCCESS_FLASH - player.parrySuccessFlash;
      const frameIdx = Math.min(
        PARRY_FLASH_FRAME_COUNT-1,
        Math.floor(elapsed / PARRY_SUCCESS_FLASH * PARRY_FLASH_FRAME_COUNT)
      );
      const flashImg = parryFlashImages[frameIdx];
      if (flashImg && flashImg.complete && flashImg.naturalWidth) {
        const size = 46; // small, per design — an accent, not a screen-filler
        ctx.save();
        ctx.imageSmoothingEnabled = true;
        ctx.drawImage(
          flashImg,
          px+player.w/2 - size/2,
          player.y+player.h/2 - size/2,
          size, size
        );
        ctx.restore();
      }
    }
  }

  // Hero fireballs are drawn above the arena/boss but below the HUD.
  // (Pulled out of drawBoss() so they render on every level, not just level 3.)
  function drawFireballs(){
    for(const f of fireballs){
      if(!fireballImg.complete || !fireballImg.naturalWidth) continue;
      const cx = f.x - camX + f.w/2;
      const cy = f.y + f.h/2;
      const drawW = FIREBALL_DRAW_SIZE;
      const drawH = drawW * (fireballImg.naturalHeight / fireballImg.naturalWidth);
      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(f.facing, 1);
      ctx.imageSmoothingEnabled = false;
      const fireballLayers = [
        'drop-shadow(0 0 4px #ffffff)',
        'drop-shadow(0 0 10px #4fe8ff)',
        'drop-shadow(0 0 22px #18c9ff)',
        'drop-shadow(0 0 34px rgba(79,232,255,0.85))'
      ];
      ctx.filter = window.GFX ? window.GFX.glowFilter(fireballLayers) : fireballLayers.join(' ');
      ctx.drawImage(fireballImg, -drawW/2, -drawH/2, drawW, drawH);
      ctx.restore();
    }
  }

  function drawParticles(){
    for(const p of particles){
      const fadeSpan = p.type === 'bloodpool' ? 55 : 40;
      ctx.globalAlpha = Math.max(0, Math.min(1, p.life/fadeSpan));

      if(p.type === 'blood'){
        // Flying droplet: stretched along its direction of travel like a
        // real spatter drop, with a small dark-to-highlight gradient instead
        // of a flat fill so it actually reads as wet rather than a sticker.
        const sx = p.x-camX, sy = p.y;
        const speed = Math.hypot(p.vx, p.vy);
        const angle = Math.atan2(p.vy, p.vx);
        const stretch = 1 + Math.min(2.0, speed*0.22);
        ctx.save();
        ctx.translate(sx, sy);
        ctx.rotate(angle);
        ctx.scale(stretch, 1);
        const grad = ctx.createRadialGradient(-p.size*0.3,-p.size*0.3,0.3, 0,0, p.size*1.3);
        // Small specular highlight + deep edge makes purple boss blood read
        // as a wet liquid droplet instead of a flat particle.
        const isPurpleBlood = p.color === '#8f2bb3' || p.color === '#5f197d' || p.color === '#2d0b3d';
        grad.addColorStop(0, isPurpleBlood ? '#d98aff' : '#b23334');
        grad.addColorStop(0.4, p.color);
        grad.addColorStop(1, isPurpleBlood ? '#12051b' : '#2a0608');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.ellipse(0,0, p.size*1.1, p.size*0.6, 0, 0, Math.PI*2);
        ctx.fill();
        ctx.restore();
      } else if(p.type === 'bloodpool'){
        // Lingering splatter pool: an irregular multi-lobe blob (real blood
        // never dries in a perfect ellipse) that visibly darkens the longer
        // it sits, mimicking blood drying from a duller red to near-black.
        const sx = p.x-camX, sy = p.y;
        const driedT = 1 - Math.max(0, Math.min(1, p.life / (p.maxLife||90)));
        const dried = lerpColor(p.color, p.color === '#4b155f' || p.color === '#240a31' ? '#12051b' : '#2b0507', driedT*0.85);
        ctx.save();
        ctx.translate(sx, sy);
        ctx.fillStyle = dried;
        for(let i=0;i<3;i++){
          const a = (p.seed||0) + i*2.4;
          const ox = Math.cos(a) * p.size * 0.5 * (p.wobble||1);
          const oy = Math.sin(a) * p.size * 0.28 * (p.wobble||1);
          const s = p.size * (0.75 + 0.3*Math.sin((p.seed||0)*3+i));
          ctx.beginPath();
          ctx.ellipse(ox, oy, s*1.15, s*0.6, a*0.3, 0, Math.PI*2);
          ctx.fill();
        }
        // faint glossy highlight while still fresh/wet, gone once dried
        if(driedT < 0.5){
          ctx.globalAlpha *= (0.5-driedT)*0.8;
          const purplePool = p.color === '#4b155f' || p.color === '#240a31';
          ctx.fillStyle = purplePool ? '#a94ad1' : '#c94a4d';
          ctx.beginPath();
          ctx.ellipse(-p.size*0.2, -p.size*0.15, p.size*0.35, p.size*0.18, 0, 0, Math.PI*2);
          ctx.fill();
        }
        ctx.restore();
      } else {
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x-camX, p.y, p.size, p.size);
      }
      ctx.globalAlpha = 1;
    }
  }

  function drawPostProcess(){
    // subtle film grain
    ctx.save();
    ctx.globalAlpha = 0.045;
    ctx.globalCompositeOperation = 'overlay';
    ctx.fillStyle = grainPattern;
    ctx.fillRect(0,0,W,H);
    ctx.restore();

    // vignette
    const vg = ctx.createRadialGradient(W/2,H*0.45,H*0.25,W/2,H*0.45,H*0.95);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(0,0,0,0.5)');
    ctx.fillStyle = vg;
    ctx.fillRect(0,0,W,H);
  }

  function draw(){
    ctx.clearRect(0,0,W,H);
    drawBackground();
    drawPlatforms();
    drawGoal();
    drawGems();
    beginSnakeDomFrame();
    // Normal enemies are rendered first. In the boss room the supplied snake
    // attack must visibly pass in front of the boss, so snakes are rendered
    // after the boss instead of being hidden behind its sprite.
    for(const en of enemies) if(en.type !== 'snake') drawEnemy(en);
    drawBoss();
    for(const en of enemies) if(en.type === 'snake') drawEnemy(en);
    endSnakeDomFrame();
    drawParticles();
    drawFireballs();
    drawPlayer();
    drawPostProcess();
  }
