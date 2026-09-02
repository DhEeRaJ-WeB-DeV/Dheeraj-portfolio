// Sword Quest — lightweight game sound effects.
// All sounds are local assets; no external audio or network dependency is used.

const SFX = Object.create(null);
const SFX_VOLUME = {
  sword_swing: 0.48,
  enemy_hit: 0.55,
  enemy_sword_hit: 0.48,
  sword_miss: 0.38,
  enemy_death: 0.62,
  player_hurt: 0.62,
  parry: 0.72,
  parry_perfect: 0.78,
  fireball_cast: 0.48,
  fireball_hit: 0.55,
  boss_ball_hit: 0.62,
  jump: 0.34,
  gem: 0.45,
  potion: 0.45,
  boss_attack: 0.50,
  snake: 0.55,
  boss_hit: 0.60,
  victory: 0.65,
  defeat: 0.62,
  player_death: 0.72,
  boss_voice_hiss: 0.78,
  boss_taunt_1: 0.92,
  boss_taunt_2: 0.92,
  boss_taunt_3: 0.92,
  boss_taunt_4: 0.92,
  boss_taunt_5: 0.92,
  boss_taunt_6: 0.92,
  boss_taunt_7: 0.92
};

function playSfx(name, volume = 1){
  const ext = (name === 'enemy_sword_hit' || name === 'sword_miss' || name === 'parry_perfect' || name === 'fireball_cast' || name === 'boss_ball_hit' || name === 'boss_hit') ? 'mp3' : 'wav';
  const base = SFX[name] || (SFX[name] = (() => {
    const a = new Audio(`assets/audio/${name}.${ext}`);
    a.preload = 'auto';
    return a;
  })());

  const sound = base.cloneNode();
  sound.volume = Math.max(0, Math.min(1, (SFX_VOLUME[name] ?? 0.5) * volume));
  const p = sound.play();
  if(p && typeof p.catch === 'function') p.catch(()=>{});
  return sound;
}

// Preload after the first user gesture so the game never blocks on sound loading.
function warmupSfx(){
  Object.keys(SFX_VOLUME).forEach(name => {
    if(!SFX[name]){
      const ext = (name === 'enemy_sword_hit' || name === 'sword_miss' || name === 'parry_perfect' || name === 'fireball_cast' || name === 'boss_ball_hit' || name === 'boss_hit') ? 'mp3' : 'wav';
      const a = new Audio(`assets/audio/${name}.${ext}`);
      a.preload = 'auto';
      SFX[name] = a;
      a.load();
    }
  });
}

// The Warden's voice uses pre-recorded rule-based speech processed into a
// dark, cavernous effect. There is no browser AI voice / SpeechSynthesis.
const BOSS_TAUNT_COUNT = 7;
let currentBossVoice = null;
let bossFightMusic = null;

function playBossTaunt(index = 1, volume = 1){
  const name = `boss_taunt_${Math.max(1, Math.min(BOSS_TAUNT_COUNT, index|0))}`;
  if(currentBossVoice){
    try{ currentBossVoice.pause(); currentBossVoice.currentTime = 0; }catch(e){}
  }
  const clip = playSfx(name, volume);
  currentBossVoice = clip;
  if(clip) clip.onended = () => {
    if(currentBossVoice === clip) currentBossVoice = null;
  };
  return currentBossVoice;
}

function stopBossVoice(){
  if(currentBossVoice){
    try{ currentBossVoice.pause(); currentBossVoice.currentTime = 0; }catch(e){}
    currentBossVoice = null;
  }
}


// Boss-fight music: the supplied Attack on Titan track is intentionally kept
// quiet so it sits underneath combat SFX and the boss voice.
function startBossFightMusic(){
  if(!bossFightMusic){
    bossFightMusic = new Audio('assets/audio/boss_fight_music.mp3');
    bossFightMusic.preload = 'auto';
    bossFightMusic.loop = true;
  }
  bossFightMusic.volume = 0.25;
  const p = bossFightMusic.play();
  if(p && typeof p.catch === 'function') p.catch(()=>{});
}

function stopBossFightMusic(){
  if(bossFightMusic){
    try{ bossFightMusic.pause(); bossFightMusic.currentTime = 0; }catch(e){}
  }
}
