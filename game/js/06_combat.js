// Sword Quest — preserved from the original working game.js

// ---------- Parry timing ----------
  // True only during the live slice of the parry stance (see PARRY_ACTIVE_*
  // in 01_game_core.js). Every place an enemy attack would otherwise damage
  // the player checks this at the exact moment the hit is calculated, so
  // "the timing matches" literally means: the frame the enemy's weapon/
  // projectile connects is one of the frames this returns true for.
  function playerParryActive(){
    return player.parrying &&
      player.parryTimer <= PARRY_ACTIVE_START &&
      player.parryTimer >= PARRY_ACTIVE_END;
  }

  // ---------- Falling-ball perfect-parry telegraph ----------
  // Yellow means the player should press Q now. We predict the ball's
  // trajectory and show the supplied yellow artwork shortly before the
  // collision, giving enough lead time for Q to enter its live window.
  const BALL_PARRY_TELEGRAPH_MIN_FRAMES = 3;
  const BALL_PARRY_TELEGRAPH_MAX_FRAMES = 19;

  function ballParryReady(p){
    if(!p || p.type !== 'fall' || p.deflected) return false;
    if(boss.emerging) return false;
    if(boss.phase === 2 && boss.phase2SnakeAttack) return false;

    let testY = p.y;
    let testVy = p.vy;

    for(let frame=1; frame<=BALL_PARRY_TELEGRAPH_MAX_FRAMES; frame++){
      testY += testVy;
      testVy += 0.09;

      if(frame < BALL_PARRY_TELEGRAPH_MIN_FRAMES) continue;

      const predicted = {
        x: p.x,
        y: testY,
        w: p.w,
        h: p.h
      };

      if(aabb(player, predicted)) return true;
    }

    return false;
  }

// ---------- Thornwalker weapon-swing angle ----------
  // Angle is measured from "hanging straight down" (0), where a positive
  // angle rotates the weapon toward the facing direction. Shared by the
  // update loop (for the hit check) and the draw code (for the sprite).
  const THORN_ARM_REST = -0.35;     // idle/cooldown: hangs loosely forward
  const THORN_ARM_WOUND = -2.27;    // winding: raised up and back, bracing
  const THORN_ARM_FORWARD = 1.75;   // swinging: chopped down through to the front
  function thornwalkerSwingAngle(en){
    if(en.state === 'winding'){
      const t = 1 - en.wakeTimer / THORNWALKER_WAKE_FRAMES;
      return THORN_ARM_REST + (THORN_ARM_WOUND - THORN_ARM_REST) * t;
    } else if(en.state === 'swinging'){
      const p = 1 - en.swingTimer / THORNWALKER_SWING_FRAMES;
      // The weapon has to reach full forward extension by the same point in
      // the swing where the sprite frame actually shows the blade struck
      // down (THORN_STRIKE_END_FRAME / thornAttackVisualFrame, ~60% through
      // the swing timer) — not at the very end of it, which is now just the
      // follow-through tail after the hit window has already closed. Ramp
      // WOUND->FORWARD across that first 60%, then hold at full extension
      // through the rest so the reach doesn't collapse right when the
      // sprite is shown mid-follow-through.
      const t = Math.min(1, p / 0.6);
      return THORN_ARM_WOUND + (THORN_ARM_FORWARD - THORN_ARM_WOUND) * t;
    }
    return THORN_ARM_REST;
  }
