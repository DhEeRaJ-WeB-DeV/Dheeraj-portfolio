// Sword Quest — preserved from the original working game.js

const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  const GRAVITY = 0.5;
  const GROUND_Y = 350;
  const THORNWALKER_DETECT_RADIUS = 220;   // radar range - player entering this puts it on alert and it starts hunting
  const THORNWALKER_ATTACK_RANGE = 82;     // it only stops closing the gap and winds up once actually within weapon reach
  const THORNWALKER_WAKE_FRAMES = 42;      // telegraph length before it winds up its swing (slowed down — more warning before it strikes)
  const THORNWALKER_SWING_FRAMES = 36;     // duration of the actual weapon swing (slowed down — more time to react and land the parry)
  const THORNWALKER_COOLDOWN_FRAMES = 46;  // recovery time between swings
  const THORNWALKER_WEAPON_REACH = 74;     // distance from shoulder anchor to the mace head at full extension
  const THORNWALKER_WEAPON_RADIUS = 14;    // size of the weapon's damage hitbox
  // The Thornwalker has no separate attack sprite sheet — the weapon
  // wind-up/down-swing motion is already captured naturally inside its real
  // idle/run frames: the blade rises into view around frame 88, is fully
  // raised and cocked at frame 97, and has swept down into the strike by
  // frame 102, with a short follow-through after that before it resets.
  // The attack pose (see thornAttackVisualFrame) and the hit-detection
  // window below both read from these exact same frame numbers, so damage
  // only ever lands on the precise frames where the blade is actually
  // shown swinging down and through — not on a disconnected timer.
  const THORN_WIND_START_FRAME = 88;    // blade starts rising into view
  const THORN_STRIKE_PEAK_FRAME = 97;   // blade fully raised, about to fall
  const THORN_STRIKE_END_FRAME = 102;   // blade has swept down/forward — the hit lands somewhere across this window
  const THORN_RECOVER_END_FRAME = 109;  // follow-through settles before resetting
  const THORNWALKER_CHASE_SPEED = 1.7;     // how fast it hunts the player once it's spotted them
  const THORNWALKER_GIVEUP_RADIUS = 320;   // if the player outruns it past this, it breaks off the chase

  // ---------- Parry ----------
  // Pressing Q raises the blade in a parry stance for PARRY_DURATION frames,
  // reusing the same attack sprite set for the animation. Only the middle
  // slice of that stance (PARRY_ACTIVE_END..PARRY_ACTIVE_START, counting
  // down) is actually "live": an enemy's attack has to land on the player
  // during that same window for the timing to match and the parry to
  // succeed, otherwise the stance is just a raised guard with no effect.
  // Widened (and the Thornwalker's own windup/swing slowed down above) so
  // the timing is much easier to hit — more real time to see the attack
  // coming and a bigger live window to catch once you press Q.
  const PARRY_DURATION = 20;         // stance length (widened slightly so the active window below still fits comfortably inside it)
  const PARRY_ACTIVE_START = 17;     // parryTimer counts down FROM this...
  const PARRY_ACTIVE_END = 0;        // ...TO this — the live deflect window (widened again — 18 frames, ~300ms — very forgiving)
  const PARRY_COOLDOWN_FRAMES = 34;  // recovery before Q can be used again
  const PARRY_STUN_FRAMES = 55;      // extra stagger applied to a parried enemy
  const PARRY_SUCCESS_FLASH = 16;    // duration of the on-hit deflect shockwave

  // Final-boss entrance: the boss rises out of the floor before it can
  // attack. The same entrance is replayed when phase 2 begins.
  const BOSS_INTRO_PAUSE_FRAMES = 480; // 8 seconds before the boss begins rising
  const BOSS_EMERGE_FRAMES = 360;      // 6 seconds for the ground entrance

  // ---------- Boss attack: the snake ambush ----------
  // A single, large fire-serpent erupts out of nowhere, flies freely around
  // the arena and hunts the hero. Strictly a phase-1 attack: first shows up
  // SNAKE_FIRST_AMBUSH_DELAY frames after the fight actually begins (i.e.
  // after the intro cutscene and ground entrance finish), then keeps
  // erupting on a repeating cooldown for as long as the boss stays in
  // phase 1. The instant phase 2 begins (or the boss is defeated), any
  // snake still alive is wiped from the arena instantly (see updateBoss()/damageBoss()).
  const SNAKE_COUNT = 1;               // how many snakes erupt per ambush
  const SNAKE_HEALTH = 3;              // sword hits needed to kill one
  const SNAKE_SPEED = 1.35;            // slower chase speed so the player can react
  const SNAKE_ACCEL = 0.08;             // gentle acceleration for a slower, readable chase
  const SNAKE_DECEL = 0.14;             // smooth braking near the hero
  const SNAKE_DAMAGE = 12;              // contact damage to the player
  const SNAKE_AMBUSH_COOLDOWN = 520;    // frames between ambushes
  const SNAKE_FIRST_AMBUSH_DELAY = 420; // 7 seconds after the fight starts, before the first ambush
  const SNAKE_RESPAWN_DELAY = 600; // 10 seconds after a snake is killed (60 FPS)
  const SNAKE_DRAW_H = 145;             // visual height of the supplied 160-frame attack animation

  // ---------- Hero ranged attack ----------
  // F throws a long-range fireball using the supplied fireball artwork.
  // It deals exactly one hit of damage, matching a normal sword strike.
  const FIREBALL_MANA_COST = 20;
  const FIREBALL_SPEED = 8.5;
  const FIREBALL_COOLDOWN_FRAMES = 28;
  const FIREBALL_DRAW_SIZE = 60;

  // ---------- Phase-2 boss attack: floor serpent raid ----------
  // After a short warning, snakes erupt upward from every marked lane except
  // one safe lane. The warning lasts exactly 2 seconds at 60 FPS.
  const PHASE2_SNAKE_LANES = 6;
  const PHASE2_SNAKE_WARNING_FRAMES = 240;
  const PHASE2_SNAKE_FRAME_COUNT = 74;
  const PHASE2_SNAKE_FRAME_MS = 1000 / 60;
  const PHASE2_SNAKE_DRAW_H = 315;
  const PHASE2_SNAKE_COOLDOWN = 900;
  const PHASE2_SNAKE_FIRST_DELAY = 900;
  const PHASE2_SNAKE_DAMAGE = 50; // half of the hero's 100 HP
  const PHASE2_SNAKE_DAMAGE_FRAME = 42;
  const PHASE2_SNAKE_FRAME_STEP = 3; // deliberately slow ground-emergence animation
  const PHASE2_SNAKE_ATTACK_DURATION_FRAMES = PHASE2_SNAKE_FRAME_COUNT * PHASE2_SNAKE_FRAME_STEP + 15;

  // ---------- Level data ----------
  // Platforms: x, y, w, h
  const LEVEL_WIDTH = 3600;

  const levels = {
    1: {
      platforms: [
        {x:0,   y:GROUND_Y, w:520, h:H-GROUND_Y},
        {x:600, y:GROUND_Y, w:260, h:H-GROUND_Y},
        {x:940, y:360, w:140, h:20},
        {x:1140,y:300, w:140, h:20},
        {x:1340,y:GROUND_Y, w:420, h:H-GROUND_Y},
        {x:1840,y:390, w:110, h:20},
        {x:2010,y:330, w:110, h:20},
        {x:2180,y:270, w:110, h:20},
        {x:2360,y:GROUND_Y, w:340, h:H-GROUND_Y},
        {x:2780,y:400, w:130, h:20},
        {x:2980,y:340, w:130, h:20},
        {x:3180,y:GROUND_Y, w:420, h:H-GROUND_Y},
      ],
      spikes: [
        {x:1350, y:GROUND_Y-16, w:60, h:16},
        {x:2400, y:GROUND_Y-16, w:60, h:16},
      ],
      enemyDefs: [
        {x:700, y:GROUND_Y-40, range:[620,820], type:'wraith'},
        {x:900, y:GROUND_Y-24, range:[860,1020], type:'crawler'},
        {x:1450,y:GROUND_Y-40, range:[1380,1650], type:'wraith'},
        {x:1580,y:GROUND_Y-24, range:[1550,1650], type:'crawler'},
        {x:1700,y:GROUND_Y-50, range:[1650,1730], type:'brute'},
        {x:1855,y:390-40, range:[1840,1922], type:'wraith'},
        {x:2025,y:330-40, range:[2010,2092], type:'crawler'},
        {x:2195,y:270-40, range:[2180,2262], type:'wraith'},
        {x:2420,y:GROUND_Y-40, range:[2380,2620], type:'wraith'},
        {x:2500,y:GROUND_Y-50, range:[2450,2620], type:'brute'},
        {x:2650,y:GROUND_Y-24, range:[2600,2690], type:'crawler'},
        {x:3250,y:GROUND_Y-40, range:[3200,3480], type:'wraith'},
        {x:3350,y:GROUND_Y-50, range:[3300,3480], type:'brute'},
        {x:3420,y:GROUND_Y-24, range:[3380,3480], type:'crawler'},
        {x:200,y:GROUND_Y-56, range:[120,480], type:'thornwalker'},
        {x:1450,y:GROUND_Y-56, range:[1340,1700], type:'thornwalker'},
        {x:2480,y:GROUND_Y-56, range:[2380,2700], type:'thornwalker'},
        {x:3300,y:GROUND_Y-56, range:[3200,3550], type:'thornwalker'},
      ],
      flyerDefs: [
        {x:1000, y:190, range:[900,1300], amp:44},
        {x:1950, y:170, range:[1840,2260], amp:55},
        {x:2850, y:210, range:[2700,3100], amp:48},
        {x:3450, y:190, range:[3250,3560], amp:42},
      ],
      gemDefs: [
        {x:980, y:320}, {x:1180,y:260}, {x:1500,y:GROUND_Y-30}, {x:1880,y:350},
        {x:2050,y:290}, {x:2220,y:230}, {x:2420,y:GROUND_Y-30}, {x:2820,y:360},
        {x:3020,y:300}, {x:3400,y:GROUND_Y-30}
      ],
      goal: {x: LEVEL_WIDTH-160, y: GROUND_Y-90, w:50, h:90},
      bg: 'bg1'
    },
    2: {
      // The moonlit cathedral courtyard: tighter, higher stakes, more gargoyles overhead.
      platforms: [
        {x:0,   y:GROUND_Y, w:460, h:H-GROUND_Y},
        {x:540, y:GROUND_Y, w:220, h:H-GROUND_Y},
        {x:860, y:380, w:120, h:20},
        {x:1060,y:320, w:120, h:20},
        {x:1260,y:260, w:120, h:20},
        {x:1460,y:GROUND_Y, w:360, h:H-GROUND_Y},
        {x:1900,y:400, w:100, h:20},
        {x:2060,y:340, w:100, h:20},
        {x:2220,y:280, w:100, h:20},
        {x:2380,y:220, w:100, h:20},
        {x:2560,y:GROUND_Y, w:300, h:H-GROUND_Y},
        {x:2940,y:380, w:120, h:20},
        {x:3140,y:320, w:120, h:20},
        {x:3340,y:GROUND_Y, w:260, h:H-GROUND_Y},
      ],
      spikes: [
        {x:1470, y:GROUND_Y-16, w:60, h:16},
        {x:1720, y:GROUND_Y-16, w:60, h:16},
        {x:2600, y:GROUND_Y-16, w:60, h:16},
        {x:2820, y:GROUND_Y-16, w:60, h:16},
      ],
      enemyDefs: [
        {x:640, y:GROUND_Y-40, range:[560,760], type:'wraith'},
        {x:820, y:GROUND_Y-24, range:[780,940], type:'crawler'},
        {x:1520,y:GROUND_Y-40, range:[1470,1720], type:'wraith'},
        {x:1650,y:GROUND_Y-50, range:[1600,1810], type:'brute'},
        {x:1780,y:GROUND_Y-24, range:[1720,1810], type:'crawler'},
        {x:1915,y:400-40, range:[1900,1982], type:'wraith'},
        {x:2075,y:340-40, range:[2060,2142], type:'crawler'},
        {x:2235,y:280-40, range:[2220,2302], type:'wraith'},
        {x:2395,y:220-40, range:[2380,2462], type:'crawler'},
        {x:2610,y:GROUND_Y-40, range:[2570,2850], type:'wraith'},
        {x:2700,y:GROUND_Y-50, range:[2620,2850], type:'brute'},
        {x:2800,y:GROUND_Y-24, range:[2760,2850], type:'crawler'},
        {x:2960,y:380-40, range:[2940,3040], type:'wraith'},
        {x:3160,y:320-40, range:[3140,3240], type:'brute'},
        {x:3400,y:GROUND_Y-40, range:[3360,3580], type:'wraith'},
        {x:3480,y:GROUND_Y-50, range:[3400,3580], type:'brute'},
        {x:180,y:GROUND_Y-56, range:[100,440], type:'thornwalker'},
        {x:1550,y:GROUND_Y-56, range:[1470,1810], type:'thornwalker'},
        {x:2650,y:GROUND_Y-56, range:[2570,2850], type:'thornwalker'},
        {x:3420,y:GROUND_Y-56, range:[3360,3580], type:'thornwalker'},
      ],
      flyerDefs: [
        {x:920, y:170, range:[820,1230], amp:50},
        {x:1700, y:150, range:[1600,1980], amp:58},
        {x:2200, y:180, range:[2060,2460], amp:46},
        {x:2900, y:160, range:[2760,3160], amp:52},
        {x:3300, y:180, range:[3160,3560], amp:44},
      ],
      gemDefs: [
        {x:900, y:340}, {x:1100,y:280}, {x:1300,y:220}, {x:1620,y:GROUND_Y-30},
        {x:1940,y:360}, {x:2100,y:300}, {x:2260,y:240}, {x:2420,y:180},
        {x:2700,y:GROUND_Y-30}, {x:2980,y:340}, {x:3180,y:280}, {x:3450,y:GROUND_Y-30}
      ],
      goal: {x: LEVEL_WIDTH-160, y: GROUND_Y-90, w:50, h:90},
      bg: 'bg2'
    },
    3: {
      // Final boss arena: one uninterrupted collision floor across the entire
      // viewport. The background keeps its exact 8:3 aspect ratio and the
      // separate transparent boss-platform artwork is rendered over its floor.
      platforms: [
        {x:0, y:GROUND_Y, w:W, h:H-GROUND_Y}
      ],
      spikes: [],
      enemyDefs: [],
      flyerDefs: [],
      gemDefs: [],
      goal: null,
      bg: 'boss',
      boss: {x: W/2-80, y: GROUND_Y-250, w:160, h:250, health:30, maxHealth:30}
    }
  };

  let currentLevel = 1;
  let carryScore = 0;
  let totalGemsCollected = 0;
  let platforms, spikes, enemyDefs, flyerDefs, gemDefs, goal, bossDef;

  function loadLevelData(n){
    const L = levels[n];
    platforms = L.platforms;
    spikes = L.spikes;
    enemyDefs = L.enemyDefs;
    flyerDefs = L.flyerDefs;
    gemDefs = L.gemDefs;
    goal = L.goal;
    bossDef = L.boss || null;
  }
  loadLevelData(currentLevel);

  // ---------- Entities ----------
  function makePlayer(){
    return {
      x:60, y:GROUND_Y-48, w:26, h:48, vx:0, vy:0,
      onGround:false, facing:1, moving:false, jumps:0, maxJumps:2,
      health:100, maxHealth:100, invuln:0,
      mana:100, maxMana:100,
      healthPotions:3, maxHealthPotions:3,
      manaPotions:2, maxManaPotions:2,
      attacking:false, attackTimer:0, attackCooldown:0,
      fireballCooldown:0,
      parrying:false, parryTimer:0, parryCooldown:0, parrySuccessFlash:0,
      score:0
    };
  }
  let player = makePlayer();

  let enemies = [];
  let gems = [];
  let particles = [];
  let boss = null;
  let bossProjectiles = [];
  let fireballs = [];
