import {SAVE_KEY,LEGACY_SAVE_KEY,newPlayer,maxHp,CLASSES,clamp} from './core.js';
import {ensureEquipment,importLegacyEquipment} from './equipment.js';

export function saveGame(game){
  try{
    const snapshot={schema:2,savedAt:Date.now(),player:game.player,world:{x:game.world.player.x,y:game.world.player.y,seed:game.world.seed,defeated:[...game.world.defeated],opened:[...game.world.opened],visited:[...game.world.visitedSettlements]}};
    localStorage.setItem(SAVE_KEY,JSON.stringify(snapshot));return true;
  }catch(err){console.error('Lowfathom world save failed',err);return false;}
}
export function loadGame(){
  try{const raw=localStorage.getItem(SAVE_KEY);if(!raw)return null;const s=JSON.parse(raw);if(![1,2].includes(s?.schema)||!s.player||!s.world)return null;
    ensureEquipment(s.player);
    s.schema=2;
    return s;}catch(err){console.error(err);return null;}
}
export function clearGame(){try{localStorage.removeItem(SAVE_KEY);}catch{}}
export function hasLegacySave(){try{return !!localStorage.getItem(LEGACY_SAVE_KEY);}catch{return false;}}
export function importLegacy(){
  try{
    const raw=localStorage.getItem(LEGACY_SAVE_KEY);if(!raw)return null;const snap=JSON.parse(raw);const s=snap?.state;if(!s)return null;
    const p=newPlayer({name:s.name,folk:s.folk,trade:s.trade,origin:s.origin,className:s.className});
    p.level=Math.max(1,Number(s.level)||1);p.xp=Math.max(0,Number(s.xp)||0);p.statPoints=Math.max(0,Number(s.statPoints)||0);p.gold=Math.max(0,Number(s.gold)||0);p.kills=Math.max(0,Number(s.kills)||0);
    for(const k of Object.keys(p.stats)) if(Number.isFinite(Number(s[k]))) p.stats[k]=Number(s[k]);
    p.hpMax=maxHp(p);p.hp=clamp(Number(s.hp)||p.hpMax,1,p.hpMax);p.deepest=Math.max(0,Number(s.depth)||0);
    // v0.201.0: the Active World now carries the real v0.114 equipment registry,
    // so import the saved equipment/generated instances instead of approximating
    // Attack/Defence from character level. The old localStorage record is read-only.
    importLegacyEquipment(p,s);
    if(s.seenFoes&&typeof s.seenFoes==='object')p.knowledge={...s.seenFoes};
    p.hpMax=maxHp(p);p.hp=clamp(Number(s.hp)||p.hpMax,1,p.hpMax);
    return p;
  }catch(err){console.error('Legacy import failed',err);return null;}
}
