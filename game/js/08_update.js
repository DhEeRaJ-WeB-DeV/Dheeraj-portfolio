// Sword Quest — preserved from the original working game.js

// ---------- Update ----------
  function updatePlayer(dt){
    const speed = 3.6;
    let moveInput = 0;
    if(keys['KeyA']||keys['ArrowLeft']) moveInput -= 1;
    if(keys['KeyD']||keys['ArrowRight']) moveInput += 1;
    player.vx = moveInput * speed;
    player.moving = moveInput !== 0;
    if(moveInput !== 0) player.facing = moveInput > 0 ? 1 : -1;

    const jumpPressed = keys['Space']||keys['KeyW']||keys['ArrowUp'];
    if(jumpPressed && !player._jumpLatch){
      if(player.jumps < player.maxJumps){
        player.vy = -12.8;
        player.jumps++;
        playSfx('jump');
        spawnParticles(player.x+player.w/2, player.y+player.h, '#cfc9d9', 4);
      }
      player._jumpLatch = true;
    }
    if(!jumpPressed) player._jumpLatch = false;

    player.vy += GRAVITY;
    if(player.vy > 18) player.vy = 18;

    resolvePlatforms(player);
    if(player.onGround) player.jumps = 0;

    // fall off world -> lose
    if(player.y > H+200){ player.health = 0; }

    // world bounds
    if(currentLevel === 3){
      // The boss arena is a fixed-screen room: the hero can walk the whole
      // straight floor but cannot leave either side of the throne hall.
      if(player.x < 36) player.x = 36;
      if(player.x + player.w > W-36) player.x = W-36-player.w;
    } else {
      if(player.x < 0) player.x = 0;
      if(player.x + player.w > LEVEL_WIDTH) player.x = LEVEL_WIDTH - player.w;
    }

    // attack
    if(player.attackCooldown > 0) player.attackCooldown--;
    const attackPressed = keys['KeyE'];
    if(attackPressed && player.attackCooldown === 0 && !player.attacking){
      player.attacking = true;
      player.attackTimer = 14;
      player._attackHit = false;
      player.attackCooldown = 26;
      playSfx('sword_swing');
    }
    // ---------- Long-range fireball ----------
    // F fires once per key press. It can be cast while moving or airborne,
    // consumes mana only when successfully launched, and uses the same one-hit
    // damage as the sword attack.
    if(player.fireballCooldown > 0) player.fireballCooldown--;
    const fireballPressed = keys['KeyF'];
    if(fireballPressed && !player._fireballLatch && player.fireballCooldown === 0 &&
       !player.parrying && player.mana >= FIREBALL_MANA_COST){
      player.mana -= FIREBALL_MANA_COST;
      player.fireballCooldown = FIREBALL_COOLDOWN_FRAMES;
      // Cast from the hand/forward arm area rather than the feet. The visual
      // sprite is anchored at the player's feet, so this point stays near the
      // hands even while the character is moving or airborne.
      const fw = 34, fh = 26;
      const handX = player.x + player.w/2 + player.facing * 18;
      const handY = player.y + player.h * 0.20;
      playSfx('fireball_cast');
      fireballs.push({
        x: handX - fw/2,
        y: handY - fh/2,
        w: fw, h: fh,
        vx: player.facing * FIREBALL_SPEED,
        facing: player.facing,
        life: 180,
        hit:false
      });
      spawnParticles(handX, handY, '#5fe9ff', 8);
    }
    player._fireballLatch = fireballPressed;

    // attack
    if(player.attacking){
      player.attackTimer--;
      if(player.attackTimer <= 8 && player.attackTimer >= 4){
        const range = 36;
        const hitbox = {
          x: player.facing>0 ? player.x+player.w : player.x-range,
          y: player.y+6, w:range, h: player.h-10
        };
        for(const en of enemies){
          if(en.alive && en.hitTimer<=0 && aabb(hitbox,en)){
            en.health--;
            en.hitTimer = 12;
            en.vx = player.facing * 3;
            playSfx('enemy_sword_hit');
            player._attackHit = true;
            spawnBlood(en.x+en.w/2, en.y+en.h/2, 16, 'enemy');
            if(en.health<=0){
              en.alive = false;
              player.score += 10;
              spawnBlood(en.x+en.w/2, en.y+en.h/2, 32, 'enemy');

              // A killed snake must stay gone for a full 10 seconds before
              // the next ambush can spawn. Reset the boss's snake timer here
              // so the normal cooldown cannot cause an immediate respawn.
              if(en.type === 'snake' && boss && boss.phase === 1 && !boss.defeated){
                boss.snakeAmbushTimer = SNAKE_RESPAWN_DELAY;
                // Alternate the entry side after every kill:
                // right -> left -> right -> left ...
                boss.snakeSpawnSide *= -1;
              }
            }
          }
        }
      }
      if(player.attackTimer <= 0){
        if(!player._attackHit) playSfx('sword_miss');
        player.attacking = false;
      }
    }

    // ---------- Parry ----------
    // Q raises the blade for PARRY_DURATION frames (same length as an attack
    // swing — see heroGetSprite). Only the middle window of that stance is
    // actually live; whether it lines up with an enemy's swing is decided
    // where the enemy's damage is applied (playerParryActive() is checked
    // at that exact moment), not here.
    if(player.parryCooldown > 0) player.parryCooldown--;
    const parryPressed = keys['KeyQ'];
    if(parryPressed && !player._parryLatch && player.parryCooldown === 0 &&
       !player.parrying && !player.attacking){
      player.parrying = true;
      player.parryTimer = PARRY_DURATION;
      player.parryCooldown = PARRY_COOLDOWN_FRAMES;
    }
    player._parryLatch = parryPressed;
    if(player.parrying){
      player.parryTimer--;
      if(player.parryTimer <= 0) player.parrying = false;
    }
    if(player.parrySuccessFlash > 0) player.parrySuccessFlash--;

    // ---------- Consumable potions ----------
    // R: consume one health potion and restore HP to full.
    if(keys['KeyR'] && !player._healthPotionLatch){
      if(player.healthPotions > 0 && player.health < player.maxHealth){
        player.health = player.maxHealth;
        player.healthPotions--;
        playSfx('potion');
        spawnParticles(player.x+player.w/2, player.y+player.h/2, '#d94b52', 14);
      }
      player._healthPotionLatch = true;
    }
    if(!keys['KeyR']) player._healthPotionLatch = false;

    // T: consume one mana potion and restore mana to full.
    if(keys['KeyT'] && !player._manaPotionLatch){
      if(player.manaPotions > 0 && player.mana < player.maxMana){
        player.mana = player.maxMana;
        player.manaPotions--;
        playSfx('potion', 0.9);
        spawnParticles(player.x+player.w/2, player.y+player.h/2, '#8d5be8', 14);
      }
      player._manaPotionLatch = true;
    }
    if(!keys['KeyT']) player._manaPotionLatch = false;

    if(player.invuln > 0) player.invuln--;

    // spikes
    for(const s of spikes){
      if(aabb(player,s) && player.invuln<=0){
        player.health -= 25;
        playSfx('player_hurt');
        player.invuln = 60;
        player.vy = -8;
        player.vx = -player.facing*4;
      }
    }

    // gems
    for(const g of gems){
      if(!g.taken){
        const dx = (player.x+player.w/2)-g.x, dy=(player.y+player.h/2)-g.y;
        if(Math.sqrt(dx*dx+dy*dy) < 26){
          g.taken = true;
          playSfx('gem');
          player.score += 5;
          totalGemsCollected++;
          spawnParticles(g.x,g.y,'#66d1c9',10);
          document.getElementById('gemCount').textContent =
            gems.filter(x=>x.taken).length;
        }
      }
    }

    // goal / level transition. The boss level ends by defeating the boss,
    // so it intentionally has no goal object.
    if(goal && aabb(player, goal)){
      if(currentLevel < 3){
        gameState = 'levelup';
        const title = document.getElementById('levelCardTitle');
        const stats = document.getElementById('levelStats');
        const bossTips = document.getElementById('bossTips');
        if(currentLevel === 2){
          title.textContent = 'THE THRONE HALL';
          stats.textContent = 'The final gate opens. A straight stone floor leads into the cathedral throne hall. Study the guardian before you descend:';
          bossTips.classList.remove('hidden');
        } else {
          title.textContent = 'GATE OPENED';
          stats.textContent = `Gems collected: ${gems.filter(g=>g.taken).length}/${gems.length}  •  Score so far: ${player.score}`;
          bossTips.classList.add('hidden');
        }
        document.getElementById('level-card').classList.remove('hidden');
      }
    }

    if(player.health <= 0 && gameState==='playing'){
      gameState = 'lose';
      stopBossFightMusic();
      stopBossVoice();
      playSfx('player_death');
      playSfx('defeat', 0.65);
      document.getElementById('lose-card').classList.remove('hidden');
    }

    const healthMissing = document.getElementById('healthMissing');
    const manaFill = document.getElementById('manaFill');
    const manaMissing = document.getElementById('manaMissing');
    const healthPotionCount = document.getElementById('healthPotionCount');
    const manaPotionCount = document.getElementById('manaPotionCount');
    if(healthMissing) healthMissing.style.width = (66.2 * (1 - Math.max(0,Math.min(1,player.health/player.maxHealth)))) + '%';
    const manaRatio = Math.max(0,Math.min(1,player.mana/player.maxMana));
    if(manaFill) manaFill.style.width = (30.5 * manaRatio) + '%';
    if(manaMissing) manaMissing.style.width = (30.5 * (1 - manaRatio)) + '%';
    if(healthPotionCount) healthPotionCount.textContent = player.healthPotions;
    if(manaPotionCount) manaPotionCount.textContent = player.manaPotions;
  }

  function updateFireballs(){
    for(let i=fireballs.length-1;i>=0;i--){
      const f = fireballs[i];
      f.x += f.vx;
      f.life--;

      // Fireballs disappear when they leave the playable world or strike a platform.
      if(f.life <= 0 || f.x < -120 || f.x > LEVEL_WIDTH + 120){
        fireballs.splice(i,1);
        continue;
      }
      let blocked = false;
      for(const platform of platforms){
        if(aabb(f, platform)){ blocked = true; break; }
      }
      if(blocked){
        spawnParticles(f.x + f.w/2, f.y + f.h/2, '#5fe9ff', 8);
        fireballs.splice(i,1);
        continue;
      }

      // One fireball can hit one target, just like one sword swing can hit one target.
      let consumed = false;
      for(const en of enemies){
        if(!en.alive || en.hitTimer > 0 || !aabb(f,en)) continue;
        en.health--;
        en.hitTimer = 12;
        en.vx = f.facing * 3;
        playSfx('enemy_sword_hit');
        spawnBlood(en.x + en.w/2, en.y + en.h/2, 16, 'enemy');
        playSfx('fireball_hit');
        spawnParticles(f.x + f.w/2, f.y + f.h/2, '#8fe8ff', 12);
        if(en.health <= 0){
          en.alive = false;
          player.score += 10;
          spawnBlood(en.x + en.w/2, en.y + en.h/2, 32, 'enemy');
          if(en.type === 'snake' && boss && boss.phase === 1 && !boss.defeated){
            boss.snakeAmbushTimer = SNAKE_RESPAWN_DELAY;
            boss.snakeSpawnSide *= -1;
          }
        }
        consumed = true;
        break;
      }
      if(consumed){ fireballs.splice(i,1); continue; }

      // Match sword behavior against the boss: phase 1 head hits deal one damage;
      // phase 2 keeps the Warden's guarded head immune to direct attacks.
      if(currentLevel === 3 && boss && !boss.defeated && !boss.emerging &&
         boss.phase === 1 && boss.hitFlash <= 0 && aabb(f, bossHeadHurtbox(boss))){
        damageBoss(1, 15);
        spawnParticles(f.x + f.w/2, f.y + f.h/2, '#8fe8ff', 18);
        fireballs.splice(i,1);
      }
    }
  }

  let frameCount = 0;
  function updateEnemies(){
    frameCount++;
    for(const en of enemies){
      if(!en.alive) continue;
      if(en.hitTimer>0){ en.hitTimer--; }

      if(en.type === 'flyer'){
        if(en.hitTimer<=0){
          en.x += en.vx * en.dir;
          if(en.x < en.range[0] || en.x+en.w > en.range[1]) en.dir *= -1;
        }
        en.y = en.baseY + Math.sin(frameCount*0.05 + en.phase) * en.amp;
      } else if(en.type === 'thornwalker'){
        // stands guard at its post until the player enters its radar range,
        // then it wakes up and actively hunts them down wherever they go,
        // only stopping to wind up and swing once it's in weapon's reach.
        const dx = player.x - (en.x + en.w/2);
        const dist = Math.abs(dx);

        if(en.state === 'idle'){
          if(dist < THORNWALKER_DETECT_RADIUS){
            en.dir = dx > 0 ? 1 : -1;
            thornSetState(en, 'chasing');
          }
        } else if(en.state === 'chasing'){
          en.dir = dx > 0 ? 1 : -1;
          if(dist < THORNWALKER_ATTACK_RANGE){
            en.wakeTimer = THORNWALKER_WAKE_FRAMES;
            thornSetState(en, 'winding');
          } else if(dist > THORNWALKER_GIVEUP_RADIUS){
            thornSetState(en, 'idle'); // player got away - give up the chase
          }
        } else if(en.state === 'winding'){
          // telegraph: braces and raises its weapon arm, feet planted
          en.dir = dx > 0 ? 1 : -1; // still tracks the player while winding up
          en.wakeTimer--;
          if(en.wakeTimer <= 0){
            en.swingTimer = THORNWALKER_SWING_FRAMES;
            thornSetState(en, 'swinging');
            en.hasHit = false;
          }
        } else if(en.state === 'swinging'){
          en.swingTimer--;
          // Only check for a hit while the actual displayed sprite frame is
          // one of the "weapon down and extended" frames — i.e. wait for
          // the weapon frame to come, rather than checking the geometric
          // swing continuously across the whole animation.
          const curFrame = thornAttackVisualFrame(en);
          const weaponFrameLive = !en.hasHit && player.invuln<=0 && curFrame != null &&
            curFrame >= THORN_STRIKE_PEAK_FRAME &&
            curFrame <= THORN_STRIKE_END_FRAME;
          if(weaponFrameLive){
            const theta = thornwalkerSwingAngle(en);
            const shoulderX = en.x + en.w*0.5 + en.dir*en.w*0.15;
            const shoulderY = en.y + en.h - en.h*1.35;
            const tipX = shoulderX + en.dir*THORNWALKER_WEAPON_REACH*Math.sin(theta);
            const tipY = shoulderY + THORNWALKER_WEAPON_REACH*Math.cos(theta);
            const pad = THORNWALKER_WEAPON_RADIUS;
            if(tipX > player.x-pad && tipX < player.x+player.w+pad &&
               tipY > player.y-pad && tipY < player.y+player.h+pad){
              // This is the exact frame the weapon connects — check whether
              // the player's parry stance is in its live window right now.
              if(playerParryActive()){
                en.hasHit = true;
                thornSetState(en, 'cooldown');
                en.cooldownTimer = THORNWALKER_COOLDOWN_FRAMES + PARRY_STUN_FRAMES;
                en.x -= en.dir * 20; // knocked off-balance, staggered backward
                en.hitTimer = 16; // reuse the hit-flash so the stagger reads visually
                player.parrySuccessFlash = PARRY_SUCCESS_FLASH;
                playSfx('parry_perfect');
                player.parryCooldown = 0; // a successful parry doesn't cost the cooldown
                spawnParticles(tipX, tipY, '#8fe8ff', 16);
              } else {
                player.health -= en.dmg;
                playSfx('player_hurt');
                player.invuln = 50;
                player.vx = (player.x < shoulderX ? -1:1)*5;
                player.vy = -6;
                spawnBlood(player.x+player.w/2, player.y+player.h/2, 18, 'hero');
                en.hasHit = true;
              }
            }
          }
          if(en.swingTimer <= 0){
            thornSetState(en, 'cooldown');
            en.cooldownTimer = THORNWALKER_COOLDOWN_FRAMES;
          }
        } else if(en.state === 'cooldown'){
          en.cooldownTimer--;
          if(en.cooldownTimer <= 0){
            if(dist < THORNWALKER_ATTACK_RANGE){
              en.dir = dx > 0 ? 1 : -1;
              en.wakeTimer = THORNWALKER_WAKE_FRAMES;
              thornSetState(en, 'winding');
            } else if(dist < THORNWALKER_DETECT_RADIUS){
              thornSetState(en, 'chasing');
            } else {
              thornSetState(en, 'idle');
            }
          }
        }

        // only actually moves while hunting the player - it plants its feet
        // and stays put while idle, winding up, swinging or recovering
        en.vx = (en.state === 'chasing') ? en.dir * THORNWALKER_CHASE_SPEED : 0;
        en.vy = (en.vy||0) + GRAVITY;
        resolvePlatforms(en);
      } else if(en.type === 'snake'){
        // Ground-only serpent: the attack animation now stays planted on the
        // arena/platform surface. It never homes vertically or flies through
        // the air. Horizontal movement uses acceleration/deceleration so the
        // 160 supplied attack frames and the body motion read as one smooth
        // continuous attack.
        let ground = platforms[en.groundPlatformIndex || 0] || platforms[0];
        if(!ground) ground = {x:0, y:GROUND_Y, w:W, h:H-GROUND_Y};

        en.y = ground.y - en.h;
        en.vy = 0;

        const targetX = player.x + player.w/2;
        const centerX = en.x + en.w/2;
        const dx = targetX - centerX;
        const deadZone = 8;

        if(en.hitTimer<=0){
          if(Math.abs(dx) > deadZone){
            const wanted = Math.sign(dx) * SNAKE_SPEED;
            const accel = Math.abs(en.vx) > 0 && Math.sign(en.vx) !== Math.sign(wanted)
              ? SNAKE_DECEL : SNAKE_ACCEL;
            if(en.vx < wanted) en.vx = Math.min(wanted, en.vx + accel);
            else if(en.vx > wanted) en.vx = Math.max(wanted, en.vx - accel);
            en.dir = en.vx >= 0 ? 1 : -1;
          } else {
            if(en.vx > 0) en.vx = Math.max(0, en.vx - SNAKE_DECEL);
            else if(en.vx < 0) en.vx = Math.min(0, en.vx + SNAKE_DECEL);
          }
          en.x += en.vx;
        } else {
          // Hit/parry knockback still happens, but the serpent remains on the
          // same surface instead of acquiring any vertical velocity.
          en.vx *= 0.92;
          en.x += en.vx;
        }

        // Hard platform-floor constraint: the snake can only occupy this
        // platform's horizontal span and its feet are always exactly on top.
        const minX = ground.x;
        const maxX = ground.x + ground.w - en.w;
        if(en.x < minX){ en.x = minX; en.vx = Math.max(0,en.vx); }
        if(en.x > maxX){ en.x = maxX; en.vx = Math.min(0,en.vx); }
        en.y = ground.y - en.h;
      } else {
        if(en.hitTimer<=0){
          en.x += en.vx * en.dir;
          if(en.x < en.range[0] || en.x+en.w > en.range[1]) en.dir *= -1;
        }
        en.vy = (en.vy||0) + GRAVITY;
        resolvePlatforms(en);
        en.vx = Math.abs(en.vx); // keep base speed positive; dir handles direction
      }

      // touch damage - the thornwalker no longer hurts the player by body contact;
      // it only deals damage through its weapon-swing hit check above.
      if(en.type !== 'thornwalker' && player.invuln<=0 && aabb(player,en)){
        if(playerParryActive()){
          // Timed correctly: deflect it instead of taking the hit.
          en.vx = Math.abs(en.vx);
          en.dir = (player.x < en.x) ? 1 : -1;
          en.x += en.dir * 22;
          en.hitTimer = 16;
          player.parrySuccessFlash = PARRY_SUCCESS_FLASH;
          playSfx('parry_perfect');
          player.parryCooldown = 0;
          spawnParticles(en.x+en.w/2, en.y+en.h/2, '#8fe8ff', 14);
        } else {
          player.health -= en.dmg;
          playSfx('player_hurt');
          player.invuln = 50;
          player.vx = (player.x < en.x ? -1:1)*5;
          player.vy = -6;
          spawnBlood(player.x+player.w/2, player.y+player.h/2, 18, 'hero');
        }
      }
    }
  }

  // ---------- FINAL BOSS ----------
  // The Cathedral Warden uses three readable attacks: a ground wave, a
  // leaping descent, and a short-range sword sweep. The patterns accelerate
  // after the boss drops below half health.
  // Wipes any snakes still alive from the boss's low-health ambush attack —
  // called the instant the boss is defeated, since the ambush shouldn't
  // linger once the fight is over.
  function clearSnakeAmbush(){
    const hadSnakes = enemies.some(e => e.type === 'snake' && e.alive);
    if(!hadSnakes) return; // nothing to do — avoid needlessly rebuilding the enemies array every frame
    for(const en of enemies){
      if(en.type === 'snake' && en.alive){
        spawnParticles(en.x+en.w/2, en.y+en.h/2, '#e0555f', 10);
      }
    }
    enemies = enemies.filter(e => e.type !== 'snake');
  }

  // Erupts SNAKE_COUNT fire-serpent(s) from alternating arena edges. Called
  // only while the boss is in phase 1 (see updateBoss()) — they are fully independent little enemies once spawned (they live in the shared
  // `enemies` array), so the player's existing sword-swing hit detection in
  // updatePlayer() and the generic enemy-touch-damage check in
  // updateEnemies() both apply to them automatically, no special-casing
  // needed. Each one takes SNAKE_HEALTH hits to put down.
  function spawnSnakeAmbush(){
    const s = statsFor('snake');
    for(let i=0;i<SNAKE_COUNT;i++){
      // Boss-fight entry pattern: first spawn from the RIGHT, then alternate
      // LEFT/RIGHT after each kill. The snake starts at the arena edge and
      // slowly chases the player instead of appearing beside them.
      const side = (boss && boss.snakeSpawnSide) || 1;
      const spawnX = side > 0 ? W - s.w - 2 : 2;
      const spawnY = GROUND_Y - s.h;
      playSfx('snake');
      enemies.push({
        x:spawnX, y:spawnY, w:s.w, h:s.h, vx:side > 0 ? -0.35 : 0.35, vy:0,
        health:s.health, maxHealth:s.health, alive:true, hitTimer:0,
        dir:side > 0 ? -1 : 1, type:'snake', dmg:s.dmg,
        animationStart: performance.now(),
        groundPlatformIndex: 0,
        spawnSide: side
      });
      spawnParticles(spawnX+s.w/2, spawnY+s.h/2, '#a83240', 16);
    }
  }

  function damageBoss(amount, scoreReward){
    if(!boss || boss.defeated) return;
    boss.health -= amount;
    playSfx(boss.health <= 0 ? 'victory' : 'boss_hit');
    boss.hitFlash = 8; // still used as the anti-double-hit cooldown, just no longer drawn as a tint
    if(scoreReward) player.score += scoreReward;
    spawnBlood(boss.x+boss.w/2,boss.y+boss.h*0.45,22,'boss');
    if(boss.health<=0){
      boss.health=0;
      boss.defeated=true;
      stopBossVoice();
      stopBossFightMusic();
      clearSnakeAmbush(); // any ambush snakes vanish the instant the boss falls
      player.score += 500;
      spawnBlood(boss.x+boss.w/2,boss.y+boss.h/2,65,'boss');
      document.getElementById('winTitle').textContent = 'CATHEDRAL CONQUERED';
      document.getElementById('winStats').textContent =
        `The throne hall falls silent. Total gems: ${totalGemsCollected}  •  Final score: ${player.score}`;
      gameState='win';
      document.getElementById('win-card').classList.remove('hidden');
    }
  }

  // The boss's damageable "weak point" — its head — rather than its whole
  // body. A direct sword swing (or, in phase 2, a deflected ball — see
  // below) only actually hurts the boss when it connects with this box.
  // Sized/positioned so a normal jump-and-swing can actually reach it: the
  // boss is 250px tall but the player's attack hitbox only rises with
  // however high they jump, so the box covers a generous top slice of the
  // boss (roughly head-and-shoulders) — pulled down further so even a
  // short hop plus an attack lands it, not just a near-perfect max-height
  // jump.
  function bossHeadHurtbox(b){
    return { x: b.x + b.w*0.24, y: b.y, w: b.w*0.52, h: b.h*0.55 };
  }

  function bossTakeHit(){
    if(!boss || boss.defeated || boss.emerging || !player.attacking || player.attackTimer > 8 || player.attackTimer < 4) return;
    // Phase 2: the Warden has learned to guard its head — a direct sword
    // strike no longer lands at all. The only way to hurt it now is to
    // parry a falling ball back into its head (handled in updateBoss below).
    if(boss.phase === 2) return;
    const range = 58;
    const hitbox = {
      x: player.facing > 0 ? player.x + player.w : player.x - range,
      y: player.y + 5, w: range, h: player.h - 8
    };
    const hurtbox = bossHeadHurtbox(boss); // only a hit to the head damages the boss
    if(aabb(hitbox,hurtbox) && boss.hitFlash<=0){
      damageBoss(1, 15);
    }
  }

  function updateBoss(){
    if(currentLevel !== 3 || !boss || boss.defeated) return;

    boss.timer++;
    if(boss.hitFlash>0) boss.hitFlash--;
    if(boss.attackFlash>0) boss.attackFlash--;

    // The first boss encounter is a short cutscene: hold the arena for a
    // full 8 seconds while the subtitle is shown, then begin the 6-second
    // ground entrance. No attacks or damage are allowed during either part.
    if(!boss.introComplete){
      if(!boss.voicePlayed){
        boss.voicePlayed = true;
        playBossTaunt(1, 1.0);
        boss.tauntIndex = 2;
        boss.tauntTimer = 300;
      }
      if(boss.introTimer > 0){
        boss.introTimer--;
        boss.emerging = false;
        boss.emergeProgress = 0;
        boss.y = GROUND_Y;
        boss.attackTimer = 1;
        bossProjectiles.length = 0;
        return;
      }
      boss.introComplete = true;
      startBossFightMusic();
      boss.emergeTimer = 0;
      boss.emergeDuration = BOSS_EMERGE_FRAMES;
      boss.emerging = true;
      boss.attackTimer = BOSS_EMERGE_FRAMES;
      boss.spawnIntroBurst = true;
    }

    // Keep the boss taunting throughout the battle. Each line is a local,
    // pre-rendered non-AI voice clip with a sinister processed tone.
    if(boss.tauntTimer > 0) boss.tauntTimer--;
    if(boss.tauntTimer <= 0){
      playBossTaunt(boss.tauntIndex, 0.95);
      boss.tauntIndex = boss.tauntIndex >= BOSS_TAUNT_COUNT ? 1 : boss.tauntIndex + 1;
      boss.tauntTimer = 360; // about every 6 seconds, so the fight stays voiced
    }

    const dx = (player.x+player.w/2) - (boss.x+boss.w/2);
    boss.dir = dx >= 0 ? 1 : -1;

    // Phase 2 starts with a second dramatic ground entrance. Attacks and
    // damage are completely disabled while the boss is coming up.
    const desiredPhase = boss.health <= boss.maxHealth/2 ? 2 : 1;
    if(desiredPhase !== boss.phase){
      boss.lastPhase = boss.phase;
      boss.phase = desiredPhase;

      if(boss.phase === 2){
        boss.emergeTimer = 0;
        boss.emergeDuration = BOSS_EMERGE_FRAMES;
        boss.emerging = true;
        boss.attackTimer = BOSS_EMERGE_FRAMES;
        boss.attackFlash = 0;
        bossProjectiles.length = 0;
        spawnParticles(boss.x+boss.w/2, GROUND_Y-4, '#a83240', 18);
      }
    }

    // ---------- Snake ambush (timer-based, phase 1 only) ----------
    // A completely separate attack track from the wave/fall/sweep rotation
    // below: on its own timer, a large fire-serpent erupts out of nowhere and
    // slowly chases the hero from the current entry side. First eruption is SNAKE_FIRST_AMBUSH_DELAY
    // frames after the fight actually starts, then it repeats on cooldown, with a 10-second delay after each snake is killed —
    // but only while the boss is still in phase 1. The moment phase 2 begins
    // (or the boss is defeated), any snake still alive is wiped instantly
    // (see clearSnakeAmbush()).
    if(boss.phase === 1 && !boss.emerging){
      if(boss.snakeAmbushTimer > 0) boss.snakeAmbushTimer--;
      if(boss.snakeAmbushTimer <= 0){
        // Guard against piling up a 2nd snake on top of one that's still
        // alive from the last ambush (e.g. the player just hasn't killed it
        // yet) — only erupt a fresh one once the arena is actually clear.
        const snakeStillAlive = enemies.some(e => e.type === 'snake' && e.alive);
        if(!snakeStillAlive){
          spawnSnakeAmbush();
          boss.snakeAmbushTimer = SNAKE_AMBUSH_COOLDOWN;
        } else {
          boss.snakeAmbushTimer = 30; // check again shortly instead of spamming every frame
        }
      }
    } else if(boss.phase !== 1){
      clearSnakeAmbush(); // phase 2 (or later) — snake ambush never happens here
    }

    // ---------- Phase-2 floor-serpent raid ----------
    // This attack is exclusive to phase 2. A random lane is left completely
    // safe while every other lane gets a red warning for exactly 2 seconds.
    // When the warning ends, the supplied snake frames erupt from below those
    // marked lanes. The damage is applied once per raid, at the rising strike.
    if(boss.phase === 2 && !boss.emerging){
      if(!boss.phase2SnakeAttack){
        if(boss.phase2SnakeTimer > 0){
          boss.phase2SnakeTimer--;
        } else {
          const safeLane = Math.floor(Math.random() * PHASE2_SNAKE_LANES);
          playSfx('snake');
          boss.phase2SnakeAttack = {
            state: 'warning',
            timer: PHASE2_SNAKE_WARNING_FRAMES,
            safeLane,
            damageDone: false,
            frame: 0
          };
        }
      } else {
        const raid = boss.phase2SnakeAttack;
        if(raid.state === 'warning'){
          raid.timer--;
          if(raid.timer <= 0){
            raid.state = 'rising';
            raid.frame = 0;
            raid.damageDone = false;
          }
        } else if(raid.state === 'rising'){
          raid.frame++;
          if(!raid.damageDone && raid.frame >= PHASE2_SNAKE_DAMAGE_FRAME){
            raid.damageDone = true;
            const laneW = W / PHASE2_SNAKE_LANES;
            const px = player.x + player.w/2;
            const playerLane = Math.max(0, Math.min(PHASE2_SNAKE_LANES - 1,
              Math.floor(px / laneW)));
            if(playerLane !== raid.safeLane && player.invuln <= 0){
              player.health -= PHASE2_SNAKE_DAMAGE;
              playSfx('player_hurt');
              player.invuln = 70;
              player.vy = -8;
              player.vx = (playerLane < raid.safeLane ? -1 : 1) * 3;
              spawnBlood(player.x+player.w/2, player.y+player.h/2, 24, 'hero');
            }
          }
          if(raid.frame >= PHASE2_SNAKE_ATTACK_DURATION_FRAMES){
            boss.phase2SnakeAttack = null;
            boss.phase2SnakeTimer = PHASE2_SNAKE_COOLDOWN;
          }
        }
      }
    } else if(boss.phase !== 2){
      boss.phase2SnakeAttack = null;
      boss.phase2SnakeTimer = PHASE2_SNAKE_FIRST_DELAY;
    }

    // Keep the boss fixed in the exact center of the final arena.
    boss.x = W/2 - boss.w/2;

    if(boss.emerging){
      boss.emergeTimer++;

      const t = Math.min(1, boss.emergeTimer / boss.emergeDuration);
      // Smoothstep gives a slow, weighty rise from the ground and eases into
      // the final standing position.
      const eased = t*t*(3-2*t);
      boss.emergeProgress = eased;
      boss.y = GROUND_Y - boss.h * eased;

      if(t >= 1){
        boss.emerging = false;
        boss.emergeProgress = 1;
        boss.y = GROUND_Y - boss.h;
        boss.attackTimer = 0; // first attack may begin only after full arrival
        spawnParticles(boss.x+boss.w/2, GROUND_Y-5, '#d9a441', 12);
      }
    } else {
      boss.emergeProgress = 1;
      boss.y = GROUND_Y-boss.h;
    }

    if(boss.attackTimer>0) boss.attackTimer--;

    // Never schedule an attack during either entrance animation.
    if(!boss.emerging && boss.attackTimer<=0 && !boss.phase2SnakeAttack){
      const choice = (Math.floor(boss.timer/120)+boss.phase)%3;
      if(choice===0){
        // Ground wave: fast horizontal projectile that stays on the floor.
        bossProjectiles.push({
          type:'wave', x:boss.x+boss.w/2, y:GROUND_Y-14, w:34, h:14,
          vx:-boss.dir*4.8, life:150, damage:18
        });
        boss.attackFlash=18;
        playSfx('boss_attack');
        boss.attackTimer=boss.phase===2?62:82;
      } else if(choice===1){
        // Falling blade: telegraph above the hero, then drop vertically.
        // Slowed down (lower starting speed + gentler acceleration below)
        // so it takes noticeably longer to reach the player — more time to
        // see it coming and line up the parry, and it's moving slower by
        // the time it arrives so the catchable window is wider too.
        bossProjectiles.push({
          type:'fall', x:player.x+player.w/2-7, y:-50, w:14, h:24,
          vx:0, vy:3.6+(boss.phase===2?0.6:0), life:150, damage:16
        });
        boss.attackFlash=14;
        playSfx('boss_attack');
        boss.attackTimer=boss.phase===2?70:92;
      } else {
        // Sword sweep is represented by a short-lived arc hitbox around boss.
        boss.attackFlash=20;
        playSfx('boss_attack');
        bossProjectiles.push({
          type:'sweep', x:boss.x+boss.w/2, y:boss.y+48,
          w:boss.w+72, h:62, life:24, damage:22
        });
        boss.attackTimer=boss.phase===2?55:78;
      }
    }

    for(let i=bossProjectiles.length-1;i>=0;i--){
      const p=bossProjectiles[i];

      // Yellow is a timing cue only: it means the ball is predicted to reach
      // the player inside the usable parry lead window. The actual parry
      // success is still decided by playerParryActive() on collision below.
      p.parryReady = ballParryReady(p);

      // During the phase-2 floor-serpent raid, freeze falling balls exactly
      // where they are. Their position, velocity and lifetime all pause so
      // the player can focus on finding the single safe lane. They resume
      // falling immediately after the raid finishes.
      const freezeFallingBall = p.type === 'fall' && boss.phase === 2 && boss.phase2SnakeAttack;
      if(!freezeFallingBall){
        if(p.deflected){ p.x += p.vx; p.y += p.vy; }
        else if(p.type==='wave') p.x += p.vx;
        else if(p.type==='fall'){ p.y += p.vy; p.vy += 0.09; }
        p.life--;
      }

      if(!p.deflected && player.invuln<=0 && !boss.emerging){
        if(aabb(player,p)){
          if(playerParryActive()){
            // Timed correctly: deflect it instead of taking the hit.
            player.parrySuccessFlash = PARRY_SUCCESS_FLASH;
            playSfx('parry_perfect');
            player.parryCooldown = 0;
            spawnParticles(player.x+player.w/2,player.y+player.h/2,'#8fe8ff',14);
            if(p.type === 'fall'){
              // The falling ball gets sent back the other way, straight at
              // the boss's head — it deals no damage yet; that only happens
              // once it actually connects with the head down below.
              const head = bossHeadHurtbox(boss);
              const targetX = head.x + head.w/2;
              const targetY = head.y + head.h/2;
              const dx = targetX - (p.x+p.w/2), dy = targetY - (p.y+p.h/2);
              const dist = Math.max(1, Math.hypot(dx,dy));
              const speed = 9;
              p.vx = dx/dist*speed;
              p.vy = dy/dist*speed;
              p.deflected = true;
              p.life = 90; // plenty of time to cross the arena and land the hit
            } else {
              // Wave/sweep attacks are still safely parried either way, but
              // in phase 2 only a deflected ball can actually damage the
              // boss's guarded head — these just protect the player there.
              if(boss.phase !== 2 && boss.hitFlash<=0) damageBoss(1, 20);
              p.life = 0;
            }
          } else {
            player.health -= p.damage;
            playSfx(p.type === 'fall' ? 'boss_ball_hit' : 'player_hurt');
            player.invuln=55;
            player.vy=-7;
            player.vx=(player.x < boss.x ? -1:1)*4;
            spawnBlood(player.x+player.w/2,player.y+player.h/2,20,'hero');
            p.life=0;
          }
        }
      }

      if(p.deflected && !boss.emerging && boss.hitFlash<=0 && aabb(p, bossHeadHurtbox(boss))){
        // The deflected ball has found its mark on the boss's head — this
        // is the only moment phase-2 damage actually lands.
        damageBoss(1, 25);
        const head = bossHeadHurtbox(boss);
        spawnParticles(head.x+head.w/2, head.y+head.h/2, '#8fe8ff', 18);
        p.life = 0;
      }

      if(p.life<=0 || p.x<-120 || p.x>W+120 || p.y>H+80) bossProjectiles.splice(i,1);
    }

    if(!boss.emerging) bossTakeHit();
  }

  function updateParticles(){
    for(let i=particles.length-1;i>=0;i--){
      const p = particles[i];
      p.x += p.vx; p.y += p.vy; p.vy += (p.gravity != null ? p.gravity : 0.2); p.life--;
      if(p.life<=0) particles.splice(i,1);
    }
  }
