import {World} from './world.js';
import {depthFromY,TILE} from './world-core.js';

const api=window.LowfathomLegacy;
if(!api) throw new Error('Lowfathom legacy systems failed to initialize before the world bridge.');

const canvas=document.getElementById('worldCanvas');
const interactBtn=document.getElementById('btnWorldInteract');
const lookBtn=document.getElementById('btnWorldLook');
const stick=document.getElementById('worldStick');
const knob=document.getElementById('worldStickKnob');
const combatHud=document.getElementById('worldCombatHud');
const combatPlayerCard=document.getElementById('worldPlayerCard');
const combatPlayerName=document.getElementById('worldPlayerName');
const combatPlayerLevel=document.getElementById('worldPlayerLevel');
const combatPlayerHp=document.getElementById('worldPlayerHp');
const combatPlayerHpN=document.getElementById('worldPlayerHpN');
const combatPlayerMomentum=document.getElementById('worldPlayerMomentum');
const combatPlayerMomentumN=document.getElementById('worldPlayerMomentumN');
const combatPlayerFocus=document.getElementById('worldPlayerFocus');
const combatPlayerFocusN=document.getElementById('worldPlayerFocusN');
const combatPlayerMana=document.getElementById('worldPlayerMana');
const combatPlayerManaN=document.getElementById('worldPlayerManaN');
const combatPlayerXp=document.getElementById('worldPlayerXp');
const combatPlayerXpN=document.getElementById('worldPlayerXpN');
const combatPlayerStats=document.getElementById('worldPlayerStats');
const combatPlayerWeapon=document.getElementById('worldPlayerWeapon');
const combatTargetShell=document.getElementById('worldCombatTargetShell');
const combatName=document.getElementById('worldCombatName');
const combatLevel=document.getElementById('worldCombatLevel');
const combatHp=document.getElementById('worldCombatHp');
const combatHpN=document.getElementById('worldCombatHpN');
const combatState=document.getElementById('worldCombatState');
const powerBtn=document.getElementById('btnWorldPower');
const guardBtn=document.getElementById('btnWorldGuard');
const readBtn=document.getElementById('btnWorldRead');
const sandBtn=document.getElementById('btnWorldSand');
const arena=document.getElementById('arena');
const WORLD_MELEE_FAMILIES=new Set(['unarmed','dagger','sword','axe','shortsword','greatsword']);

combatPlayerCard?.addEventListener('click',()=>api.openCharacter?.());
combatPlayerCard?.addEventListener('keydown',event=>{
  if(event.key==='Enter'||event.key===' '){event.preventDefault();api.openCharacter?.();}
});
let realtimeCombat={id:null,playerChargeMs:0,enemyChargeMs:0,windupMs:0,evading:false,openerPending:false,attackOrder:false};
const secondaryHostiles=new Map();
let readChannel=null;
let pendingEntity=null;
let toastTimer=0;
let locationTitleTimer=0;
let previous={state:null,foeHp:null,heroHp:null,foeDefeated:false,foeEntityId:null};
let movementMs=0;
let movementKind='world';
let lastDepthPush=0;
let lastWorldSave=0;
let lastMoving=false;
let lastThreatened=false;

// Weapon reach now comes directly from the equipped weapon snapshot. The legacy
// combat layer owns the family rules (dagger 15 / regular melee 20 / Great Weapon
// 25), so rendering, collision and attack resolution all consume one value.
function effectivePlayerWeaponRange(cfg){
  return Math.max(0,Number(cfg?.weapon?.range)||20);
}

function flushMovement(){
  if(movementMs<=0)return;
  if(movementKind==='side')api.activeSideMovement?.(movementMs);
  else api.activeMovement?.(movementMs);
  movementMs=0;
}

function toast(text){
  if(!text)return;
  let el=document.getElementById('worldToast');
  if(!el){el=document.createElement('div');el.id='worldToast';Object.assign(el.style,{position:'absolute',zIndex:'40',left:'50%',top:'20%',transform:'translateX(-50%)',maxWidth:'65vw',padding:'7px 10px',border:'1px solid rgba(138,117,80,.45)',background:'rgba(2,6,8,.88)',color:'#c9c2b3',font:'12px IBM Plex Mono, monospace',pointerEvents:'none',boxShadow:'0 5px 18px rgba(0,0,0,.35)'});document.getElementById('arena')?.appendChild(el);}
  el.textContent=text;el.hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.hidden=true,1800);
}

function showSettlementTitle(settlement){
  if(!settlement)return;
  const shell=document.getElementById('worldLocationTitle');
  if(!shell)return;
  const kind=document.getElementById('worldLocationKind'),name=document.getElementById('worldLocationName'),depth=document.getElementById('worldLocationDepth');
  if(kind)kind.textContent=settlement.kind==='city'?'City':settlement.kind==='village'?'Village':'Town';
  if(name)name.textContent=settlement.name||'Settlement';
  if(depth)depth.textContent=`${Math.max(0,Number(settlement.depth)||0).toFixed(0)} fathoms`;
  clearTimeout(locationTitleTimer);
  shell.classList.remove('show');
  // Restart the transition even when the player leaves and immediately re-enters.
  void shell.offsetWidth;
  shell.classList.add('show');
  locationTitleTimer=setTimeout(()=>shell.classList.remove('show'),3000);
}

const world=new World(canvas,{
  seed:41729,
  getProfiles:()=>api.getProfiles(),
  getTowns:()=>api.getTowns(),
  getWorldEvents:()=>api.getWorldEvents?.()||[],
  getCompanion:()=>api.getCompanion?.()||null,
  getSideArea:()=>api.getSideArea?.()||null,
  getPlayerClass:()=>api.getState?.()?.className||'Votary',
  onToast:toast,
  onMinimapZoom:index=>api.persistMinimapZoom?.(index),
  getDetectionRadius:(profileId)=>api.getWorldDetectionRadius?.(profileId)||5.5,
  onHostile:entity=>{setTimeout(()=>handleWorldHostile(entity),0);},
  onLocationTitle:showSettlementTitle,
  onSettlementEnter:settlement=>{if(api.enterTown?.(settlement.id)){sync();api.saveWorld(world.snapshot());}},
  onSettlementLeave:settlement=>{if(api.leaveTown?.(settlement.id)){sync();api.saveWorld(world.snapshot());}},
  onEnterSide:event=>{if(api.triggerWorldEvent?.('sidepassage',event.id,Number(event.depth)||depthFromY(world.player.y))){sync();api.saveWorld(world.snapshot());}},
  // v0.203.9.3: side passages are geography only; there is no side-exit action
  // and therefore no callback may return/reposition the player.
  onLeaveSide:()=>{},
  onPassWorldEvent:event=>{if(api.retireWorldEvent?.(event.type,event.id)){sync();api.saveWorld(world.snapshot());}},
  onInteract:(entity,label)=>{pendingEntity=entity;interactBtn.disabled=!entity;interactBtn.textContent=label||'Interact';},
  onLoot:entity=>pickupLoot(entity),
  onLootExpired:bag=>{if(bag?.recordId)api.expireWorldLoot?.(bag.recordId);lastWorldSave=performance.now();api.saveWorld(world.snapshot());},
  onEncounter:entity=>{
    pendingEntity=entity;
    const bossLike=['midboss','boss'].includes(entity?.type);
    const ok=bossLike
      ?api.triggerWorldEvent?.(entity.type,entity.eventId,Number(entity.event?.depth)||depthFromY(entity.y))
      :api.engageFoe(entity.foe?.id,entity.id);
    const s=api.getState();
    if(ok&&s?.foe){
      const combatEntity=bossLike?{...entity,foe:{id:s.foe.key,name:s.foe.name}}:entity;
      world.beginCombatEntity(combatEntity);previous.foeEntityId=entity.id;sync();
    }else world.setCombat(false);
  },
  onDepth:(deepestDepth,currentDepth,moving,dtMs,_inTown=false,inSide=false)=>{
    const now=performance.now();
    const depthEl=document.getElementById('travelDepth'),currentEl=document.getElementById('travelCurrentDepth');
    if(depthEl)depthEl.textContent=(Math.max(0,Number(deepestDepth)||0)).toFixed(1);
    if(currentEl)currentEl.textContent=(Math.max(0,Number(currentDepth)||0)).toFixed(1);
    const state=api.getState();

    // Overworld combat uses the Canvas for real physical movement, but that
    // movement is tactical positioning rather than descent progress. Travel
    // clocks, boon time and canonical fathom advancement stay frozen until the
    // engagement ends. The next normal step reconciles physical depth again.
    if(world.hasActiveThreats?.()){
      if(movementMs>0)flushMovement();lastMoving=false;
      if((moving&&now-lastWorldSave>1400)||(!moving&&now-lastWorldSave>7000)){lastWorldSave=now;api.saveWorld(world.snapshot());}
      return;
    }

    if(moving)api.noteRunMovement?.(dtMs);
    // Movement happens in one coordinate system. A side passage changes which
    // canonical travel clock receives the elapsed time, never where the player
    // lives. Towns need no special movement branch at all.
    const inTown=!!state?.town,kind=inSide?'side':'world';
    if(moving&&api.canMove()&&!inTown){
      if(movementMs>0&&movementKind!==kind)flushMovement();
      movementKind=kind;movementMs+=dtMs;
    }
    if(movementMs>=180)flushMovement();

    // Side passages intentionally remain at roughly their entrance fathom in
    // canonical progression. Everywhere else the deepest physical y reached is
    // authoritative and is pushed into the mature legacy progression systems.
    if(!inTown&&!inSide&&moving&&deepestDepth>Number(state?.depth||0)+.015&&now-lastDepthPush>90){
      lastDepthPush=now;
      api.advanceDepth(deepestDepth,0);
    }

    if(lastMoving&&!moving){flushMovement();api.movementStopped();}
    lastMoving=moving;
    if((moving&&now-lastWorldSave>1400)||(!moving&&now-lastWorldSave>7000)){lastWorldSave=now;api.saveWorld(world.snapshot());}
  }
});
world.setZoom?.(api.getWorldZoom?.()||1.15);
world.setAtmosphereEffectsEnabled?.(api.getWorldShadows?.()!==false);
world.setMinimapZoom?.(api.getMinimapZoom?.()??2,{notify:false});

const fathomMeter=document.getElementById("fathomMeter"),currentFathomRow=document.getElementById("travelCurrentRow");
fathomMeter?.addEventListener("click",()=>{const open=fathomMeter.getAttribute("aria-expanded")==="true";fathomMeter.setAttribute("aria-expanded",String(!open));if(currentFathomRow)currentFathomRow.hidden=open;});

const restored=api.restoreWorld();
world.restore(restored,api.getWorldPositionDepth());
// Repair the v0.203.9 new-delver leak if it already made it into a save: the
// canonical run depth is authoritative for progression. A world snapshot that
// claims to be materially deeper than that run belongs to the previous delver.
const initialState=api.getState?.();
const restoredDeepest=restored&&Number.isFinite(Number(restored.deepestY))?depthFromY(Number(restored.deepestY)):0;
if(initialState&&restored&&restoredDeepest>Math.max(5,(Number(initialState.depth)||0)+5)){
  world.restore(null,Number(initialState.depth)||0);
  api.saveWorld(world.snapshot());
}
world.start();

function syntheticCombatEntity(state){
  const profiles=api.getProfiles(),profile=profiles.find(p=>p.id===state.foe?.key)||profiles[0]||{id:'cutter',name:'foe'};
  const id=state.foe?.worldEntityId||`legacy-combat:${Date.now()}`;
  return {type:'foe',id,foe:profile,x:world.player.x,y:world.player.y-TILE*2};
}

function uiAllowsWorld(){
  const s=api.getState();
  if(!s||s.over||s.travelEvent||s.hollow||s.interaction)return false;
  if(s.foe&&!s.foe.worldRealtime)return false;
  if(api.uiBlocking?.())return false;
  if(s.town)return !!api.townCanMove?.();
  return api.canMove();
}


function syncWorldHud(state){
  if(!state)return;
  const name=document.getElementById('travelHeroName');
  const lv=document.getElementById('travelHeroLv');
  const hpBar=document.getElementById('travelHp');
  const hpN=document.getElementById('travelHpN');
  const xp=document.getElementById('travelXp');
  const xpBar=document.getElementById('travelXpBar');
  const hpMax=Math.max(1,Number(state.hpMax)||1),hp=Math.max(0,Math.min(hpMax,Number(state.hp)||0));
  const xpNeed=Math.max(1,Number(state.xpNeed)||1),xpNow=Math.max(0,Number(state.xp)||0);
  if(name)name.textContent=state.name||'Delver';
  if(lv)lv.textContent=`Level ${Number(state.level)||1}${Number(state.statPoints)>0?` · ${Number(state.statPoints)} pt${Number(state.statPoints)===1?'':'s'}`:''}`;
  const hpFrac=Math.max(0,Math.min(1,hp/hpMax));
  if(hpBar){
    hpBar.style.width=`${hpFrac*100}%`;
    const shell=hpBar.parentElement;
    if(shell){shell.classList.toggle('mid',hpFrac<=.50&&hpFrac>.25);shell.classList.toggle('low',hpFrac<=.25);}
  }
  if(hpN)hpN.textContent=`${Math.round(hp)} / ${Math.round(hpMax)} hp`;
  if(xp)xp.textContent=`${Math.round(xpNow)} / ${Math.round(xpNeed)} XP`;
  if(xpBar)xpBar.style.width=`${Math.max(0,Math.min(1,xpNow/xpNeed))*100}%`;
  const resources=state.resources||{},primary=resources.primary||'momentum';
  for(const key of ['momentum','focus','mana']){
    const data=resources[key]||{value:0,max:100},max=Math.max(1,Number(data.max)||100),value=Math.max(0,Math.min(max,Number(data.value)||0));
    const row=document.querySelector(`[data-world-resource="${key}"]`),bar=document.getElementById(`travel${key[0].toUpperCase()+key.slice(1)}Bar`),num=document.getElementById(`travel${key[0].toUpperCase()+key.slice(1)}N`);
    row?.classList.toggle('primary',key===primary);row?.classList.toggle('secondary',key!==primary);
    if(bar)bar.style.width=`${value/max*100}%`;
    if(num)num.textContent=`${Math.round(value)} / ${Math.round(max)}`;
  }
}

function syncCombatVisual(state){
  const f=state?.foe;
  if(f&&!world.combat){
    const entity=world.activeEntities.find(e=>e.id===f.worldEntityId)||syntheticCombatEntity(state);
    world.beginCombatEntity(entity,{hostile:!!f.hostile});previous.foeEntityId=entity.id;
  }
  if(f){
    if(f.worldRealtime){
      if(world.combatFoe){
        world.combatFoe.combatHp=Number(f.hp);world.combatFoe.combatHpMax=Number(f.hpMax);
        world.combatFoe.combatEvading=!!f.evading;
      }
    }else{
      if(previous.foeHp!=null&&Number(f.hp)<Number(previous.foeHp)){const dmg=Math.max(1,Math.round(previous.foeHp-f.hp));world.bumpPlayer(`-${dmg}`);}
      if(previous.heroHp!=null&&Number(state.hp)<Number(previous.heroHp)){const dmg=Math.max(1,Math.round(previous.heroHp-state.hp));world.bumpFoe(`-${dmg}`);}
    }
    previous.foeHp=Number(f.hp);previous.heroHp=Number(state.hp);previous.foeDefeated=!!f.defeated;previous.foeEntityId=f.worldEntityId||previous.foeEntityId;
    if(f.defeated&&previous.foeEntityId){
      world.defeated.add(previous.foeEntityId);world.roamers.delete(previous.foeEntityId);
      if(f.worldLootRecordId){const pos=world.combatFoe||world.activeEntities.find(e=>e.id===previous.foeEntityId);world.dropLootBag({id:`loot:${f.worldLootRecordId}`,recordId:f.worldLootRecordId,x:pos?.x??world.player.x,y:pos?.y??world.player.y-TILE*1.5});api.saveWorld(world.snapshot());}
    }
  }else if(previous.state?.foe){
    const wasRealtime=!!previous.state.foe.worldRealtime,wasEvade=!!previous.state.foe.evading;
    if(wasRealtime&&wasEvade&&!previous.foeDefeated)world.resetCombatSource?.(previous.foeEntityId);
    world.endCombat({defeated:previous.foeDefeated});previous.foeHp=null;previous.foeDefeated=false;previous.foeEntityId=null;previous.heroHp=Number(state?.hp)||null;setTimeout(()=>acquireNearestHostile(),0);
  }else previous.heroHp=Number(state?.hp)||null;
}


export function sync(){
  const state=api.getState();
  if(!state){if(combatPlayerCard)combatPlayerCard.hidden=true;world.setInputEnabled(false);previous.state=state;return;}
  syncWorldHud(state);
  updateCombatPlayerCard(state,api.getWorldCombat?.());
  const runChanged=!!previous.state&&(state.slot!==previous.state.slot||state.name!==previous.state.name||(Number(state.depth)===0&&Number(previous.state.depth)>1));
  if(runChanged){world.endCombat({defeated:false});world.restore(api.restoreWorld(),state.depth);previous.foeHp=null;previous.heroHp=null;previous.foeDefeated=false;previous.foeEntityId=null;}
  const travel=document.getElementById('travel');
  if(state.town){if(travel)travel.hidden=false;arena?.classList.add('world-town-mode');}
  else arena?.classList.remove('world-town-mode');
  arena?.classList.toggle('world-side-mode',!!api.getSideArea?.());
  world.refreshTowns?.();world.refreshSidePlan?.();
  syncCombatVisual(state);
  world.setInputEnabled(uiAllowsWorld());
  // A legacy restore may have depth but no matching world snapshot yet. Recover
  // through the world's safety path instead of assigning coordinates directly.
  if(!restored&&Number(state.depth)>depthFromY(world.player.deepestY)+.1)world.recoverToDepth(Number(state.depth)||0);
  previous.state=JSON.parse(JSON.stringify(state));
}

function resetRealtimeRuntime(id=null){
  // A newly engaged foe should be met with an immediate opening basic attack
  // as soon as it is inside the weapon's valid surface-to-surface range. After
  // that opener, the normal weapon attack interval becomes the combat rhythm.
  realtimeCombat={id,playerChargeMs:0,enemyChargeMs:0,windupMs:0,evading:false,openerPending:id!==null,attackOrder:id!==null,engagedOnce:false};
  world.setCombatPlayerAttacking?.(id!==null);
  if(world.combatFoe){world.combatFoe.combatTelegraph='';world.combatFoe.combatEvading=false;}
}
function cancelPlayerAttackOrder(){
  if(!realtimeCombat.attackOrder)return false;
  realtimeCombat.attackOrder=false;world.setAutoApproach?.(false);world.setCombatPlayerAttacking?.(false);
  toast('Attack order canceled.');return true;
}
function resumePlayerAttackOrder(){
  realtimeCombat.attackOrder=true;world.setCombatPlayerAttacking?.(true);return true;
}
function setCombatHudVisible(show){
  if(combatHud)combatHud.hidden=!show;
  if(combatTargetShell)combatTargetShell.hidden=!show;
  arena?.classList.toggle('world-realtime-combat',!!show);
  if(show){
    // Realtime combat owns the existing Canvas. Never allow the legacy black
    // transition or modal combat classes to sit over it. The transition layer
    // intentionally ignores pointer events, which can otherwise look exactly
    // like a frozen black game while buttons underneath still respond.
    const fade=document.getElementById('combatTransition');
    if(fade){fade.classList.remove('fade-in');fade.hidden=true;fade.setAttribute('aria-hidden','true');}
    const warning=document.getElementById('encounterWarning');if(warning)warning.hidden=true;
    const travel=document.getElementById('travel');if(travel)travel.hidden=false;
    arena?.classList.remove('combat-mode','combat-scroll','player-slot-active','enemy-slot-active','post-combat-pending','post-combat-fading','post-combat-mode');
  }
}
function setCombatButtonParts(btn,title,detail){
  if(!btn)return;
  // Never rebuild the button's child nodes during the animation loop. A press
  // may begin on the label/detail node; replacing it before pointerup can swallow
  // the click. The classic icon card therefore keeps one stable copy wrapper.
  let copy=btn.querySelector('.world-action-copy');
  if(!copy){copy=document.createElement('span');copy.className='world-action-copy';btn.append(copy);}
  let label=copy.querySelector('b'),sub=copy.querySelector('span');
  if(!label){label=document.createElement('b');copy.prepend(label);}
  if(!sub){sub=document.createElement('span');copy.append(sub);}
  if(label.textContent!==String(title??''))label.textContent=String(title??'');
  if(sub.textContent!==String(detail??''))sub.textContent=String(detail??'');
}
function setCombatPowerIcon(resource){
  const root=document.getElementById('worldPowerIcon');if(!root)return;
  const key=resource==='focus'?'strike':resource==='mana'?'abilities':'heavy';
  const src=`./assets/ui/${key==='abilities'?'glyph':'icon'}-${key}.png`;
  const img=root.querySelector('img');
  if(img&&img.dataset.worldIcon===key)return;
  root.innerHTML=`<span class="ui-icon ${key}"><img data-world-icon="${key}" src="${src}" alt="" decoding="async"></span>`;
}

function combatThreatKey(cfg){
  const key=String(cfg?.matchup?.key||'even');
  return ['weak','even','tough','deadly'].includes(key)?key:'even';
}
function combatThreatLabel(cfg){return String(cfg?.matchup?.label||'EVEN').toUpperCase();}
function combatInfoHtml(cfg,rangeLabel=''){
  const hit=Math.round((Number(cfg?.chances?.player)||0)*100),key=combatThreatKey(cfg),threat=combatThreatLabel(cfg);
  return `${rangeLabel?`${rangeLabel} · `:''}${hit}% HIT · <span class="threat-word threat-${key}">${threat}</span>`;
}
function updateCombatLevel(cfg){
  if(!combatLevel)return;
  const key=combatThreatKey(cfg),level=Math.max(1,Math.round(Number(cfg?.enemy?.level)||1));
  combatLevel.textContent=`LV ${level}`;
  combatLevel.className=`world-combat-level threat-${key}`;
}
function updateCombatPlayerCard(state,cfg){
  if(!combatPlayerCard||!state||!cfg)return;
  combatPlayerCard.hidden=false;
  const hpMax=Math.max(1,Number(state.hpMax)||1),hp=Math.max(0,Math.min(hpMax,Number(state.hp)||0));
  if(combatPlayerName)combatPlayerName.textContent=state.name||'Delver';
  if(combatPlayerLevel)combatPlayerLevel.textContent=`LEVEL ${Math.max(1,Math.round(Number(state.level)||1))}`;
  if(combatPlayerHp)combatPlayerHp.style.width=`${hp/hpMax*100}%`;
  if(combatPlayerHpN)combatPlayerHpN.textContent=`${Math.ceil(hp)} / ${Math.ceil(hpMax)} HP`;
  const resourceKey=String(cfg.primary||'momentum');
  const resourceEls={
    momentum:[combatPlayerMomentum,combatPlayerMomentumN],
    focus:[combatPlayerFocus,combatPlayerFocusN],
    mana:[combatPlayerMana,combatPlayerManaN]
  };
  for(const key of ['momentum','focus','mana']){
    const resource=cfg[key]||{value:key==='momentum'?0:100,max:100};
    const rv=Math.max(0,Number(resource.value)||0),rm=Math.max(1,Number(resource.max)||100);
    const [bar,num]=resourceEls[key];
    if(bar)bar.style.width=`${Math.min(100,rv/rm*100)}%`;
    if(num)num.textContent=`${Math.round(rv)} / ${Math.round(rm)}`;
    const row=bar?.parentElement?.previousElementSibling;
    bar?.parentElement?.classList.toggle('primary',key===resourceKey);
    bar?.parentElement?.classList.toggle('secondary',key!==resourceKey);
    row?.classList.toggle('primary',key===resourceKey);
    row?.classList.toggle('secondary',key!==resourceKey);
  }
  const xp=Math.max(0,Number(state.xp)||0),xpNeed=Math.max(1,Number(state.xpNeed)||Number(cfg.player?.xpNeed)||1);
  if(combatPlayerXp)combatPlayerXp.style.width=`${Math.min(100,xp/xpNeed*100)}%`;
  if(combatPlayerXpN)combatPlayerXpN.textContent=`${Math.round(xp)} / ${Math.round(xpNeed)} XP`;
  const p=cfg.player||{},atk=Number(p.attackRating)||0,armor=Number(p.armor)||0,def=Number(p.def)||0,dr=Math.max(0,Number(p.physicalDr)||0);
  if(combatPlayerStats)combatPlayerStats.textContent=`ATK ${atk.toFixed(atk%1?1:0)} · ARMOR ${Math.round(armor)} · DEF ${Math.round(def)} · ${Math.round(dr*1000)/10}% DR`;
  if(combatPlayerWeapon)combatPlayerWeapon.textContent=String(cfg.weapon?.name||cfg.weapon?.family||'Unarmed').toUpperCase();
}
function updateCombatHud(state,cfg){
  const f=state?.foe;if(!f||!cfg)return setCombatHudVisible(false);
  setCombatHudVisible(true);
  updateCombatPlayerCard(state,cfg);
  if(combatName)combatName.textContent=f.name||'Foe';
  updateCombatLevel(cfg);
  const max=Math.max(1,Number(f.hpMax)||1),hp=Math.max(0,Math.min(max,Number(f.hp)||0));
  if(combatHp)combatHp.style.width=`${hp/max*100}%`;
  if(combatHpN)combatHpN.textContent=`${Math.ceil(hp)} / ${Math.ceil(max)}`;
  if(combatState){
    if(f.evading)combatState.textContent='Evading · returning home';
    else if(realtimeCombat.windupMs>0)combatState.textContent='Heavy incoming';
    else combatState.innerHTML=combatInfoHtml(cfg);
  }
  const p=cfg.power||{},resource=String(p.resource||cfg.primary||'momentum'),data=cfg[resource]||{value:0},available=Number(data.value)||0,min=Math.max(0,Number(p.minCost)||0);
  if(powerBtn){
    const focus=resource==='focus';
    const detail=focus?(available>=min?`spend ${Math.round(available)} Focus`:`need ${min} Focus`):`${Math.round(Number(p.cost)||min)} ${resource[0].toUpperCase()+resource.slice(1)}`;
    setCombatPowerIcon(resource);
    setCombatButtonParts(powerBtn,p.label||'Power',detail);
    powerBtn.disabled=!!f.evading||available<min;
  }
  if(guardBtn){const guardResource=String(cfg.guard?.resource||cfg.primary||'momentum'),guardData=cfg[guardResource]||{value:0};setCombatButtonParts(guardBtn,cfg.guard?.active?'Guarding':'Guard',`${cfg.guard?.cost||35} ${guardResource[0].toUpperCase()+guardResource.slice(1)}`);guardBtn.disabled=!!f.evading||!!cfg.guard?.active||Number(guardData.value||0)<Number(cfg.guard?.cost||35);}
  if(readBtn){const entity=world.combatFoe,info=entity?api.getWorldReadInfo?.(entityProfileId(entity),entity.id):null;const detail=info?.mastered?'Mastered':info?.used?'Already observed':info?(info.freeCombatRead?`${info.reads}/${info.reads<3?3:6} knowledge · Kept Watch`: `${info.reads}/${info.reads<3?3:6} knowledge · uses attack beat`):'Observe target';setCombatButtonParts(readBtn,info?.reads>0?'Study':'Read',detail);readBtn.disabled=!!f.evading||!entity||!info?.ok||!!readChannel;}
  if(sandBtn){setCombatButtonParts(sandBtn,'Sand Throw',f.blinded?'Target Blinded':'60% Blind · uses next attack beat');sandBtn.disabled=!!f.evading||!!f.blinded;}
}
function combatSplat(target,result,{enemy=false,status=false}={}){
  if(!target||!result)return;
  const text=result.hit===false?'0':result.damage!=null?`${Math.max(0,Math.round(result.damage))}${result.critical?'!':''}`:String(result.text||'');
  if(text){
    const poison=String(result.damageType||'').toLowerCase()==='poison'||!!result.poison;
    const tone=status?'status':poison?'poison':enemy?(result.hit===false?'enemyMiss':result.critical?'enemyCrit':'enemy'):(result.hit===false?'playerMiss':result.critical?'playerCrit':'playerHit');
    world.spawnText(target.x,target.y,text,tone);
  }
  if(Number(result.postKillHeal)>0){const healed=Math.round(result.postKillHeal);world.spawnText(world.player.x,world.player.y-8,`+${healed}`,'heal');window.triggerHealFx?.(healed,['travel']);}
}
function moveCombatFoeToward(x,y,speed,dt){
  const f=world.combatFoe;if(!f)return 0;
  const dx=x-f.x,dy=y-f.y,len=Math.hypot(dx,dy)||1,step=Math.min(len,Math.max(0,Number(speed)||0)*dt/1000);
  if(step>0)world.moveWorldActor(f,dx/len*step,dy/len*step,10);
  return len;
}

function entityProfileId(entity){if(entity?.type==='boss')return 'warren_boss';return entity?.foe?.id||entity?.foeId||entity?.event?.profileId||null;}
function entityKind(entity){return entity?.type==='boss'?'boss':entity?.type==='midboss'?'midboss':'foe';}
function entityBossStratum(entity){return Math.max(0,Number(entity?.bossStratum??entity?.event?.bossStratum)||0);}
function entityEncounterDepth(entity){
  if(!entity)return Math.max(0,Number(api.getState?.()?.depth)||0);
  const eventDepth=Number(entity?.event?.depth);if(Number.isFinite(eventDepth))return Math.max(0,eventDepth);
  const homeY=Number(entity?.homeY??entity?.spawnY);if(Number.isFinite(homeY))return Math.max(0,depthFromY(homeY));
  return Math.max(0,depthFromY(Number(entity.y)||0));
}
function beginWorldTarget(entity,{enemyInitiated=false}={}){
  if(!entity||!['foe','midboss','boss'].includes(entity.type))return false;
  const same=world.combatEntityId&&String(world.combatEntityId)===String(entity.id);
  if(same){if(!enemyInitiated){resumePlayerAttackOrder();world.setAutoApproach?.(true);}if(enemyInitiated&&world.combatFoe){world.combatFoe.hostile=true;api.setWorldCombatHostile?.(true);}return true;}
  const hadOld=!!world.combatFoe;
  if(hadOld){
    const oldId=String(world.combatEntityId||'');const oldEnemyRuntime={charge:realtimeCombat.enemyChargeMs||0,windup:realtimeCombat.windupMs||0};
    const snap=api.suspendWorldCombatTarget?.(),source=world.stashCombatTarget?.(snap);
    if(source?.hostile){secondaryHostiles.set(oldId,oldEnemyRuntime);source.combatTelegraph=oldEnemyRuntime.windup>0?'HEAVY':'';source.combatThreatRange=(Number(api.getWorldEnemyCombatConfig?.(entityProfileId(source),entityKind(source),entityBossStratum(source))?.range)||10)+4;}
    resetRealtimeRuntime(null);
  }
  const incomingRuntime=secondaryHostiles.get(String(entity.id||''))||null;secondaryHostiles.delete(String(entity.id||''));
  let ok=false;
  const encounterDepth=entityEncounterDepth(entity);
  if(entity.combatLegacyState)ok=!!api.resumeWorldCombatTarget?.(entity.combatLegacyState,entity.id,encounterDepth);
  else if(entity.type==='boss'||entity.type==='midboss')ok=!!api.triggerWorldEvent?.(entity.type,entity.eventId,Number(entity.event?.depth)||encounterDepth);
  else ok=!!api.engageFoe?.(entityProfileId(entity),entity.id,{playerInitiated:!enemyInitiated,encounterDepth});
  const state=api.getState();
  if(!ok||!state?.foe)return false;
  const hostile=enemyInitiated||!!entity.hostile;
  world.beginCombatEntity(entity,{hostile,autoApproach:!enemyInitiated});previous.foeEntityId=entity.id;resetRealtimeRuntime(entity.id);
  // Switching targets must not manufacture free opening swings or cancel an
  // enemy Heavy that was already winding up while it was a secondary threat.
  realtimeCombat.openerPending=!hadOld;
  if(incomingRuntime){realtimeCombat.enemyChargeMs=Math.max(0,Number(incomingRuntime.charge)||0);realtimeCombat.windupMs=Math.max(0,Number(incomingRuntime.windup)||0);if(realtimeCombat.windupMs>0)world.combatFoe.combatTelegraph='HEAVY';}
  sync();return true;
}
function scriptedCombatSpawnPoint(options={}){
  let anchorX=world.player.x,anchorY=world.player.y,sign=1;
  const anchorId=String(options.anchorEventId||'');
  if(anchorId){
    const event=world.worldEvents?.find(e=>String(e?.id||'')===anchorId);
    if(event&&typeof world.eventTile==='function'){const p=world.eventTile(event);anchorX=(p.tx+.5)*TILE;anchorY=(p.ty+.5)*TILE;sign=Number(p.sign)||1;}
  }
  const candidates=[
    [anchorX-sign*TILE*2.2,anchorY+TILE*.8],[anchorX+sign*TILE*2.2,anchorY-TILE*.8],
    [world.player.x+TILE*2.3,world.player.y],[world.player.x-TILE*2.3,world.player.y],
    [world.player.x,world.player.y+TILE*2.3],[world.player.x,world.player.y-TILE*2.3]
  ];
  for(const [x,y] of candidates){if(Math.hypot(x-world.player.x,y-world.player.y)<TILE*1.25)continue;if(!world.collides?.(x,y,10,{ignoreBossGate:true}))return{x,y};}
  return{x:anchorX,y:anchorY};
}
function startScriptedCombat(options={}){
  if(world.combatFoe)return false;
  const profileId=String(options.profileId||'');if(!profileId)return false;
  const id=String(options.worldEntityId||`scripted:${profileId}:${Date.now()}`),pos=scriptedCombatSpawnPoint(options);
  const ok=!!api.engageScriptedFoe?.(profileId,id,{...options,encounterDepth:Math.max(0,Number(options.encounterDepth)||depthFromY(pos.y))});
  const state=api.getState?.();if(!ok||!state?.foe)return false;
  const entity={type:'foe',id,foe:{id:profileId,name:state.foe.name||profileId},x:pos.x,y:pos.y,homeX:pos.x,homeY:pos.y,hostile:true,scripted:true};
  world.beginCombatEntity(entity,{hostile:true,autoApproach:false});previous.foeEntityId=id;resetRealtimeRuntime(id);
  // Scripted event attackers are already committed when the player chooses Fight/Help.
  // Their realtime cadence is otherwise identical to ordinary world enemies.
  if(world.combatFoe)world.combatFoe.hostile=true;
  sync();api.saveWorld?.(world.snapshot());return true;
}
function handleWorldHostile(entity){
  if(!entity||!uiAllowsWorld())return;
  if(world.combatEntityId&&String(world.combatEntityId)===String(entity.id)){if(world.combatFoe)world.combatFoe.hostile=true;return;}
  if(!world.combatFoe)beginWorldTarget(entity,{enemyInitiated:true});
}
function acquireNearestHostile(){if(world.combatFoe||!uiAllowsWorld())return;const list=world.hostileEntities?.()||[];list.sort((a,b)=>Math.hypot(a.x-world.player.x,a.y-world.player.y)-Math.hypot(b.x-world.player.x,b.y-world.player.y));if(list[0])beginWorldTarget(list[0],{enemyInitiated:true});}
function currentEntityById(id){return world.findEntityById?.(id)||null;}
function worldPointFromClient(clientX,clientY){const r=canvas.getBoundingClientRect(),w=world.logicalViewW?.()||r.width,h=world.logicalViewH?.()||r.height;return{x:(clientX-r.left)*(w/Math.max(1,r.width)),y:(clientY-r.top)*(h/Math.max(1,r.height))};}
function enemyFromPointerEvent(e){const p=worldPointFromClient(e.clientX,e.clientY);return world.entityAtScreenPoint?.(p.x,p.y)||null;}

let contextEntity=null;
const enemyMenu=document.createElement('div');enemyMenu.id='worldEnemyContext';enemyMenu.hidden=true;Object.assign(enemyMenu.style,{position:'absolute',zIndex:'75',minWidth:'150px',padding:'5px',border:'1px solid rgba(177,153,96,.65)',background:'rgba(4,8,10,.96)',boxShadow:'0 8px 24px rgba(0,0,0,.5)',font:'11px IBM Plex Mono, monospace'});arena?.appendChild(enemyMenu);
function closeEnemyMenu(){enemyMenu.hidden=true;contextEntity=null;}
function readMenuLabel(entity){const info=api.getWorldReadInfo?.(entityProfileId(entity),entity?.id);if(!info)return 'Read';if(info.mastered)return 'Read · Mastered';if(info.used)return 'Read · already observed';return `${info.reads>0?'Study':'Read'} · ${info.reads}/${info.reads<3?3:6}`;}
function examineEntity(entity){
  closeEnemyMenu();if(!entity)return false;
  const specimen=api.getWorldExamineInfo?.(entityProfileId(entity),{worldEntityId:entity.id,kind:entityKind(entity),bossStratum:entityBossStratum(entity),depth:entityEncounterDepth(entity)});
  if(!specimen)return false;
  api.openDelverJournal?.('bestiary',{profileId:specimen.profileId,specimen});return true;
}
function openEnemyMenu(entity,clientX,clientY){
  if(!entity)return;contextEntity=entity;const info=api.getWorldReadInfo?.(entityProfileId(entity),entity.id)||{};
  enemyMenu.innerHTML=`<button type="button" data-enemy-context="target" style="display:block;width:100%;padding:7px 8px;margin:0 0 4px;background:#171c1f;color:#ddd3bc;border:1px solid #574a35;text-align:left;font:inherit">Target / Attack</button><button type="button" data-enemy-context="examine" style="display:block;width:100%;padding:7px 8px;margin:0 0 4px;background:#171c1f;color:#ddd3bc;border:1px solid #574a35;text-align:left;font:inherit">Examine</button><button type="button" data-enemy-context="read" ${info.ok?'':'disabled'} style="display:block;width:100%;padding:7px 8px;background:#171c1f;color:${info.ok?'#ddd3bc':'#6e6b63'};border:1px solid #574a35;text-align:left;font:inherit">${readMenuLabel(entity)}</button>`;
  const ar=arena.getBoundingClientRect();enemyMenu.style.left=`${Math.max(6,Math.min(ar.width-166,clientX-ar.left))}px`;enemyMenu.style.top=`${Math.max(6,Math.min(ar.height-124,clientY-ar.top))}px`;enemyMenu.hidden=false;
}
function cancelRead(reason=''){if(!readChannel)return;const e=currentEntityById(readChannel.entityId);if(e)world.spawnText(e.x,e.y,'READ CANCELED','status');readChannel=null;if(reason)toast(reason);}
function performCombatRead(entity){
  if(!entity)return false;
  const state=api.getState?.(),isActive=!!state?.foe?.worldRealtime&&String(world.combatEntityId||'')===String(entity.id||'');
  if(!isActive)return false;
  const info=api.getWorldReadInfo?.(entityProfileId(entity),entity.id);
  if(!info?.ok){toast(info?.mastered?'Already Mastered.':'Already Read this creature.');return true;}
  const dist=Math.hypot(entity.x-world.player.x,entity.y-world.player.y),maxPx=(Number(info.maxRangeTiles)||8)*TILE;
  if(dist>maxPx){toast('Too far away to Read. Move closer.');return true;}
  const r=api.readWorldFoe?.(entityProfileId(entity),entity.id);
  if(!r?.ok){toast(r?.reason||'Read failed.');return true;}
  // In realtime combat, Read replaces one normal automatic attack beat. Kept Watch
  // preserves its existing free-Read identity and therefore does not consume it.
  if(!info.freeCombatRead){
    realtimeCombat.openerPending=false;
    realtimeCombat.playerChargeMs=0;
  }
  world.spawnText(entity.x,entity.y,'READ','status');
  toast(info.freeCombatRead?`${r.text} Kept Watch: no attack beat spent.`:r.text);
  syncWorldHud(api.getState?.());
  updateCombatHud(api.getState?.(),api.getWorldCombat?.());
  return true;
}
function startRead(entity){
  closeEnemyMenu();if(!entity)return;if(performCombatRead(entity))return;const info=api.getWorldReadInfo?.(entityProfileId(entity),entity.id);if(!info?.ok){toast(info?.mastered?'Already Mastered.':'Already Read this creature.');return;}
  const dist=Math.hypot(entity.x-world.player.x,entity.y-world.player.y),maxPx=(Number(info.maxRangeTiles)||8)*TILE;if(dist>maxPx){toast('Too far away to Read. Move closer.');return;}
  // Reading is an observation channel, not a free action layered on top of
  // pursuit. Stop auto-approach and pause the player's weapon timer while the
  // channel is active; enemies and the rest of the cavern continue normally.
  world.setAutoApproach?.(false);
  const state=api.getState();readChannel={entityId:entity.id,profileId:entityProfileId(entity),endAt:performance.now()+Math.max(250,Number(info.channelMs)||1500),maxPx,startHp:Number(state?.hp)||0};world.spawnText(entity.x,entity.y,'READING…','status');
}
function updateReadChannel(){
  if(!readChannel)return;const e=currentEntityById(readChannel.entityId),state=api.getState();if(!e)return cancelRead('The creature is no longer in sight.');
  if(world.player.moving)return cancelRead('Movement interrupts Read.');if((Number(state?.hp)||0)<readChannel.startHp)return cancelRead('Taking damage interrupts Read.');if(Math.hypot(e.x-world.player.x,e.y-world.player.y)>readChannel.maxPx)return cancelRead('The creature moved beyond reading distance.');
  if(performance.now()>=readChannel.endAt){const r=api.readWorldFoe?.(readChannel.profileId,readChannel.entityId);readChannel=null;if(r?.ok){world.spawnText(e.x,e.y,'READ','status');toast(r.text);}else toast(r?.reason||'Read failed.');syncWorldHud(api.getState());}
}
function updateSecondaryHostiles(dt){
  const currentId=world.combatEntityId?String(world.combatEntityId):'';const hostiles=world.hostileEntities?.()||[],live=new Set();
  for(const e of hostiles){const id=String(e.id||'');if(!id||id===currentId)continue;live.add(id);let rt=secondaryHostiles.get(id);if(!rt){rt={charge:0,windup:0};secondaryHostiles.set(id,rt);}const cfg=api.getWorldEnemyCombatConfig?.(entityProfileId(e),entityKind(e),entityBossStratum(e))||{attackIntervalMs:2100,range:10,heavyChance:.12};const gap=world.surfaceGapTo?.(e)??Infinity,range=Math.max(0,Number(cfg.range)||10),heavyRange=range+4;e.combatThreatRange=heavyRange;
    if(rt.windup>0){rt.windup=Math.max(0,rt.windup-dt);e.combatTelegraph='HEAVY';if(rt.windup<=0){e.combatTelegraph='';if(gap<=heavyRange){world.bumpActor?.(e,world.player,12,.22);const r=api.worldCombatEnemyAttackFrom?.(entityProfileId(e),{heavy:true,kind:entityKind(e),bossStratum:entityBossStratum(e),depth:entityEncounterDepth(e)});combatSplat(world.player,r,{enemy:true});if(r?.dead){sync();return;}}else world.spawnText(world.player.x,world.player.y,'MISS','status');rt.charge=0;}}
    else if(gap<=range){rt.charge+=dt;if(rt.charge>=Math.max(550,Number(cfg.attackIntervalMs)||2100)){rt.charge%=Math.max(550,Number(cfg.attackIntervalMs)||2100);if(Math.random()<Math.max(.04,Number(cfg.heavyChance)||.12)){rt.windup=Math.max(0,Number(cfg.heavyWindupMs)||1200);e.combatTelegraph='HEAVY';}else{world.bumpActor?.(e,world.player,8,.16);const r=api.worldCombatEnemyAttackFrom?.(entityProfileId(e),{heavy:false,kind:entityKind(e),bossStratum:entityBossStratum(e),depth:entityEncounterDepth(e)});combatSplat(world.player,r,{enemy:true});if(r?.dead){sync();return;}}}}
  }
  for(const [id] of secondaryHostiles)if(!live.has(id)){secondaryHostiles.delete(id);const e=currentEntityById(id);if(e)e.combatTelegraph='';}
}
function updateRealtimeCombat(state,dt){
  const f=state?.foe;
  const blocked=!!api.uiBlocking?.();
  if(!document.hidden&&!blocked&&state&&!state.over)api.tickWorldCombatResources?.(dt,!!world.hasActiveThreats?.());
  const cfg=api.getWorldCombat?.();
  updateCombatPlayerCard(state,cfg);
  if(!f?.worldRealtime){
    if(realtimeCombat.id!==null)resetRealtimeRuntime(null);
    world.setPlayerReachGuide?.(0,{visible:false});
    setCombatHudVisible(false);return;
  }
  const id=f.worldEntityId||`foe:${f.key}`;
  if(realtimeCombat.id!==id)resetRealtimeRuntime(id);
  updateCombatHud(state,cfg);
  if(!cfg||f.defeated||state.over){world.setPlayerReachGuide?.(0,{visible:false});return;}
  if(blocked||document.hidden)return;
  if(!world.combatFoe){syncCombatVisual(state);if(!world.combatFoe)return;}
  world.combatFoe.combatHp=Number(f.hp);world.combatFoe.combatHpMax=Number(f.hpMax);world.combatFoe.combatEvading=!!f.evading;
  const territory=world.combatTerritory?.(effectivePlayerWeaponRange(cfg)||32)||{inside:true,homeX:world.combatFoe.x,homeY:world.combatFoe.y};
  if(world.combatFoe.hostile&&!territory.inside&&!f.evading){
    // v0.207.0: an evading enemy stops owning the primary combat slot immediately.
    // The physical source keeps its HP/state and returns home under normal world AI,
    // so the player can target another foe without waiting for a stale EVADING state.
    api.beginWorldCombatEvade?.();
    const snap=api.suspendWorldCombatTarget?.(),source=world.stashCombatTarget?.(snap);
    if(source){source.hostile=false;source.combatEvading=true;source.combatTelegraph='';}
    secondaryHostiles.delete(String(id));resetRealtimeRuntime(null);previous.foeHp=null;previous.foeDefeated=false;previous.foeEntityId=null;
    world.setPlayerReachGuide?.(0,{visible:false});toast(`${f.name} breaks pursuit and starts returning to its territory.`);sync();setTimeout(()=>acquireNearestHostile(),0);
    return;
  }
  if(f.evading){
    // Recovery path for a save/runtime that already contained the old sticky
    // primary-evade state: detach it on the next frame instead of requiring reload.
    const snap=api.suspendWorldCombatTarget?.(),source=world.stashCombatTarget?.(snap);
    if(source){source.hostile=false;source.combatEvading=true;source.combatTelegraph='';}
    secondaryHostiles.delete(String(id));resetRealtimeRuntime(null);previous.foeHp=null;previous.foeDefeated=false;previous.foeEntityId=null;
    world.setPlayerReachGuide?.(0,{visible:false});sync();setTimeout(()=>acquireNearestHostile(),0);return;
  }
  realtimeCombat.evading=false;world.combatFoe.combatEvading=false;
  world.setCombatPlayerAttacking?.(!!realtimeCombat.attackOrder);
  const activeProfileId=entityProfileId(world.combatFoe),detectTiles=Number(api.getWorldDetectionRadius?.(activeProfileId))||5.5;
  if(!world.combatFoe.hostile&&Math.hypot(world.player.x-world.combatFoe.x,world.player.y-world.combatFoe.y)<=detectTiles*TILE){world.combatFoe.hostile=true;api.setWorldCombatHostile?.(true);}
  // Ranges are now true weapon reach measured from body edge to body edge. The
  // World owns body radii, so large Maulers/minibosses remain hittable at their
  // visible edge instead of forcing centre-to-centre overlap.
  const enemyRange=Math.max(0,Number(cfg.enemy?.range)||10),heavyThreatRange=enemyRange+4,playerRange=effectivePlayerWeaponRange(cfg);
  const meleeWeapon=WORLD_MELEE_FAMILIES.has(String(cfg.weapon?.family||'unarmed'));
  let dx=world.player.x-world.combatFoe.x,dy=world.player.y-world.combatFoe.y,dist=Math.hypot(dx,dy)||1;
  let gap=world.combatSurfaceGap?.()??dist;
  if(world.combatFoe.hostile&&realtimeCombat.windupMs<=0&&gap>enemyRange*.82){
    // A melee foe should actually close into fighting distance rather than stop
    // Keep melee enemies close to body contact so all fixed melee families can
    // actually exchange attacks. Enemy attack reach stays separate from player
    // weapon reach; this is only the foe's preferred physical spacing.
    const desiredGap=2,step=Math.min(Math.max(0,gap-desiredGap),(Number(cfg.enemy?.moveSpeed)||60)*dt/1000);
    if(step>0)world.moveWorldActor(world.combatFoe,dx/dist*step,dy/dist*step,10);
    dx=world.player.x-world.combatFoe.x;dy=world.player.y-world.combatFoe.y;dist=Math.hypot(dx,dy)||1;gap=world.combatSurfaceGap?.()??dist;
  }
  let playerInRange=gap<=playerRange;
  // v0.208.1: movement-away is only a way to cancel a *distant approach order*.
  // Once the player has actually reached fighting range, normal movement is
  // combat movement/kiting and must never silently turn auto-attacks off.
  if(playerInRange){
    realtimeCombat.engagedOnce=true;
    // Valid weapon reach is authoritative. If movement or another transient state
    // paused the player's attack order, coming back inside the active reach circle
    // resumes it without touching the accumulated attack timer or opener state.
    if(!realtimeCombat.attackOrder)resumePlayerAttackOrder();
  }
  if(realtimeCombat.attackOrder&&!realtimeCombat.engagedOnce&&!playerInRange&&world.manualMovementAwayFrom?.(world.combatFoe)){
    cancelPlayerAttackOrder();
  }
  world.setCombatPlayerAttacking?.(!!realtimeCombat.attackOrder);
  world.setPlayerReachGuide?.(playerRange,{visible:meleeWeapon});
  world.setCombatRangeGuide?.(playerRange,{melee:meleeWeapon,inRange:playerInRange,enemyThreatRange:heavyThreatRange,threatActive:realtimeCombat.windupMs>0,showPlayerReach:meleeWeapon});
  if(combatState){
    const rangeLabel=!realtimeCombat.attackOrder?'ATTACK PAUSED':playerInRange?(meleeWeapon?'IN MELEE RANGE':'IN RANGE'):(meleeWeapon?'OUT OF MELEE RANGE':'OUT OF RANGE');
    combatState.innerHTML=combatInfoHtml(cfg,rangeLabel);
  }

  // Automatic basics keep a fixed weapon rhythm. Active powers are resolved by
  // their button input on the next safe event/frame and never reset, replace or
  // delay this charge clock.
  function resolvePlayerSwing(usePower){
    // Purely visual lunge. renderOffset rides on top of the player's real world
    // position, so kiting continues underneath and the sprite returns to wherever
    // the player actually moved to rather than snapping back to an old coordinate.
    world.bumpPlayer?.('',usePower?11:7,usePower?.20:.15);
    const result=api.worldCombatPlayerAttack?.(!!usePower);
    world.combatFoe.hostile=true;
    if(result?.power)world.spawnText(world.combatFoe.x,world.combatFoe.y-12,String(result.label||'POWER').toUpperCase(),'status');
    combatSplat(world.combatFoe,result,{enemy:false});
    const after=api.getState();
    if(after?.foe&&world.combatFoe){world.combatFoe.combatHp=Number(after.foe.hp);world.combatFoe.combatHpMax=Number(after.foe.hpMax);}
    return after;
  }

  // Both timers advance only while the surface gap is inside weapon reach.
  // Backing out avoids pressure but sacrifices offensive uptime.
  if(playerInRange&&!readChannel&&realtimeCombat.attackOrder){
    const interval=Math.max(450,Number(cfg.weapon?.attackIntervalMs)||1800);
    if(realtimeCombat.openerPending){
      // Contact opener is an immediate Basic. Active powers are independent and
      // may be woven before or after it without changing this timer.
      realtimeCombat.openerPending=false;
      realtimeCombat.playerChargeMs=0;
      const after=resolvePlayerSwing(false);
      if(after?.foe?.defeated){sync();return;}
    }else{
      realtimeCombat.playerChargeMs+=dt;
      if(realtimeCombat.playerChargeMs>=interval){
        realtimeCombat.playerChargeMs%=interval;
        const after=resolvePlayerSwing(false);
        if(after?.foe?.defeated){sync();return;}
      }
    }
  }

  if(world.combatFoe.hostile&&realtimeCombat.windupMs>0){
    realtimeCombat.windupMs=Math.max(0,realtimeCombat.windupMs-dt);world.combatFoe.combatTelegraph='HEAVY';
    world.setCombatRangeGuide?.(playerRange,{melee:meleeWeapon,inRange:playerInRange,enemyThreatRange:heavyThreatRange,threatActive:realtimeCombat.windupMs>0,showPlayerReach:meleeWeapon});
    if(realtimeCombat.windupMs<=0){
      world.combatFoe.combatTelegraph='';
      dx=world.player.x-world.combatFoe.x;dy=world.player.y-world.combatFoe.y;dist=Math.hypot(dx,dy)||1;gap=world.combatSurfaceGap?.()??dist;
      if(gap<=heavyThreatRange){world.bumpFoe?.('',12,.22);const result=api.worldCombatEnemyAttack?.({heavy:true});combatSplat(world.player,result,{enemy:true});if(result?.dead||result?.killed){sync();return;}}
      else world.spawnText(world.player.x,world.player.y,'MISS','status');
      realtimeCombat.enemyChargeMs=0;
      world.setCombatRangeGuide?.(playerRange,{melee:meleeWeapon,inRange:gap<=playerRange,enemyThreatRange:heavyThreatRange,threatActive:false,showPlayerReach:meleeWeapon});
    }
  }else if(world.combatFoe.hostile&&gap<=enemyRange){
    realtimeCombat.enemyChargeMs+=dt;
    const interval=Math.max(550,Number(cfg.enemy?.attackIntervalMs)||2100);
    if(realtimeCombat.enemyChargeMs>=interval){
      realtimeCombat.enemyChargeMs%=interval;
      if(Math.random()<Math.max(.04,Number(cfg.enemy?.heavyChance)||.12)){
        realtimeCombat.windupMs=Math.max(0,Number(cfg.enemy?.heavyWindupMs)||1200);world.combatFoe.combatTelegraph='HEAVY';
        world.setCombatRangeGuide?.(playerRange,{melee:meleeWeapon,inRange:playerInRange,enemyThreatRange:heavyThreatRange,threatActive:true,showPlayerReach:meleeWeapon});
      }else{
        world.bumpFoe?.('',8,.16);const result=api.worldCombatEnemyAttack?.({heavy:false});combatSplat(world.player,result,{enemy:true});if(result?.dead||result?.killed){sync();return;}
      }
    }
  }
}

function resetForNewRun(){
  flushMovement();
  movementMs=0;movementKind='world';lastDepthPush=0;lastWorldSave=performance.now();lastMoving=false;lastThreatened=false;
  world.endCombat({defeated:false});secondaryHostiles.clear();readChannel=null;closeEnemyMenu();
  world.restore(null,0);
  previous={state:null,foeHp:null,heroHp:null,foeDefeated:false,foeEntityId:null};
  api.saveWorld(world.snapshot());
  sync();
}

window.LowfathomWorldBridge={sync,world,resetForNewRun,startScriptedCombat};
sync();

// Legacy sheets often close without calling the full render() path. Reconcile the
// movement gate independently so closing Character/Pack/Settings can never leave
// the Canvas stuck until another legacy action happens to render.
let lastForegroundTick=performance.now();
function reconcileWorldGate(){
  const now=performance.now(),dt=Math.max(0,Math.min(1000,now-lastForegroundTick));lastForegroundTick=now;
  try{
    let state=api.getState();
    if(!document.hidden&&state&&!state.over)api.noteRunForeground?.(dt);
    world.setZoom?.(api.getWorldZoom?.()||1.15);
    // Do not rely only on the one-shot onHostile callback. A hostile roamer may
    // become aware between the independent World and bridge animation frames;
    // reacquire it here so enemy-initiated combat can never stall with both sides
    // standing idle and no active target.
    if(!world.combatFoe)acquireNearestHostile();
    state=api.getState();
    syncWorldHud(state);syncCombatVisual(state);updateRealtimeCombat(state,dt);updateSecondaryHostiles(dt);updateReadChannel();
    state=api.getState();syncWorldHud(state);
    const threatened=!!world.hasActiveThreats?.();if(threatened!==lastThreatened){lastThreatened=threatened;api.setWorldThreatened?.(threatened);}
    const allowed=uiAllowsWorld();if(world.inputEnabled!==allowed)world.setInputEnabled(allowed);
  }catch(err){
    // Do not let one combat-frame exception permanently stop bridge updates.
    // Keep the Canvas/UI alive and surface the real error in DevTools.
    console.error('Realtime world bridge frame failed',err);
  }finally{
    requestAnimationFrame(reconcileWorldGate);
  }
}
requestAnimationFrame(reconcileWorldGate);

function pickupLoot(entity){
  if(!entity||!uiAllowsWorld())return false;
  const opened=api.openWorldLoot?.(entity.recordId);
  if(!opened)return false;
  world.removeLootBag(entity.id);api.saveWorld(world.snapshot());sync();return true;
}

function doInteract(){
  if(!uiAllowsWorld())return;
  const result=world.interact();if(!result)return;
  if(result.type==='loot'){pickupLoot(result.entity);return;}
  if(result.type==='target'){beginWorldTarget(result.entity,{enemyInitiated:false});return;}
  if(result.type==='chest')api.openChest(result.entity.id,result.depth);
  else if(result.type==='glint')api.investigateGlint(result.entity.id,result.depth);
  else if(result.type==='hollow')api.useHollow(result.entity.id,result.depth,result.entity.kind||'ordinary');
  else if(result.type==='townlocation')api.openTownLocation?.(result.location?.id);
  else if(result.type==='side-stage')api.triggerSideStage?.();
  else if(result.type==='side-finale')api.triggerSideFinale?.();
  else if(result.type==='worldevent')api.triggerWorldEvent?.(result.eventKind,result.eventId,result.depth);
  sync();api.saveWorld(world.snapshot());
}
powerBtn?.addEventListener('click',()=>{
  const state=api.getState?.(),cfg=api.getWorldCombat?.(),target=world.combatFoe;
  if(!state?.foe?.worldRealtime||!target){toast('No active target.');return;}
  if(readChannel){toast('Finish or cancel Read first.');return;}
  if(state.foe.evading||target.combatEvading){toast('Target is evading.');return;}
  const range=effectivePlayerWeaponRange(cfg),gap=world.combatSurfaceGap?.()??Infinity;
  if(gap>range){toast('Out of reach.');return;}
  const r=api.useWorldCombatPower?.();
  if(!r?.ok){if(r?.reason)toast(r.reason);return;}
  resumePlayerAttackOrder();
  world.bumpPlayer?.('',11,.20);
  target.hostile=true;api.setWorldCombatHostile?.(true);
  world.spawnText(target.x,target.y-12,String(r.label||'POWER').toUpperCase(),'status');
  combatSplat(target,r,{enemy:false});
  const after=api.getState?.();
  if(after?.foe&&world.combatFoe){world.combatFoe.combatHp=Number(after.foe.hp);world.combatFoe.combatHpMax=Number(after.foe.hpMax);}
  syncWorldHud(after);updateCombatHud(after,api.getWorldCombat?.());
  if(r?.killed||after?.foe?.defeated)sync();
});
guardBtn?.addEventListener('click',()=>{const r=api.worldCombatGuard?.();if(!r?.ok){if(r?.reason)toast(r.reason);return;}realtimeCombat.playerChargeMs=Math.max(0,realtimeCombat.playerChargeMs-(Number(r.attackDelayMs)||0));world.spawnText(world.player.x,world.player.y,'GUARD','status');syncWorldHud(api.getState());});
readBtn?.addEventListener('click',()=>{const entity=world.combatFoe;if(!entity){toast('No active target.');return;}startRead(entity);updateCombatHud(api.getState?.(),api.getWorldCombat?.());});
sandBtn?.addEventListener('click',()=>{const cfg=api.getWorldCombat?.();const r=api.worldCombatSandThrow?.();if(!r?.ok){if(r?.reason)toast(r.reason);return;}const beat=Math.max(250,Number(cfg?.weapon?.attackIntervalMs)||900);realtimeCombat.playerChargeMs=Math.max(0,realtimeCombat.playerChargeMs-beat);if(world.combatFoe)world.spawnText(world.combatFoe.x,world.combatFoe.y,r.success?'BLINDED':'MISS','status');toast(r.success?'Sand catches the target’s eyes.':'The sand misses.');updateCombatHud(api.getState?.(),api.getWorldCombat?.());});
interactBtn.addEventListener('click',doInteract);
lookBtn.addEventListener('click',()=>{if(uiAllowsWorld())world.look();});


// Creature selection: left click / quick tap targets; right click / long press
// opens the same compact context menu. Pointer events keep mouse, touch and pen
// on one input path without forcing bump-to-fight.
let canvasTouch=null;
canvas.addEventListener('pointerdown',e=>{
  if(!uiAllowsWorld())return;const enemy=enemyFromPointerEvent(e);if(!enemy)return closeEnemyMenu();
  if(e.pointerType==='mouse'){
    if(e.button===0){e.preventDefault();closeEnemyMenu();beginWorldTarget(enemy,{enemyInitiated:false});}
    else if(e.button===2){e.preventDefault();openEnemyMenu(enemy,e.clientX,e.clientY);}
    return;
  }
  if(e.button!==0)return;e.preventDefault();const startX=e.clientX,startY=e.clientY,id=e.pointerId;
  const timer=setTimeout(()=>{if(canvasTouch?.id!==id)return;canvasTouch.long=true;openEnemyMenu(enemy,e.clientX,e.clientY);},430);
  canvasTouch={id,enemy,startX,startY,lastX:e.clientX,lastY:e.clientY,timer,long:false};
});
canvas.addEventListener('pointermove',e=>{if(!canvasTouch||e.pointerId!==canvasTouch.id)return;canvasTouch.lastX=e.clientX;canvasTouch.lastY=e.clientY;if(Math.hypot(e.clientX-canvasTouch.startX,e.clientY-canvasTouch.startY)>16&&!canvasTouch.long){clearTimeout(canvasTouch.timer);canvasTouch=null;}});
function finishCanvasPointer(e){if(!canvasTouch||e.pointerId!==canvasTouch.id)return;const p=canvasTouch;clearTimeout(p.timer);canvasTouch=null;if(!p.long)beginWorldTarget(p.enemy,{enemyInitiated:false});}
canvas.addEventListener('pointerup',finishCanvasPointer);canvas.addEventListener('pointercancel',e=>{if(canvasTouch&&e.pointerId===canvasTouch.id){clearTimeout(canvasTouch.timer);canvasTouch=null;}});
arena?.addEventListener('contextmenu',e=>{e.preventDefault();},{capture:true});
canvas.addEventListener('contextmenu',e=>{e.preventDefault();const enemy=enemyFromPointerEvent(e);if(!enemy){closeEnemyMenu();return;}openEnemyMenu(enemy,e.clientX,e.clientY);});
enemyMenu.addEventListener('click',e=>{const b=e.target.closest('[data-enemy-context]');if(!b||!contextEntity)return;const entity=contextEntity;if(b.dataset.enemyContext==='target'){closeEnemyMenu();beginWorldTarget(entity,{enemyInitiated:false});}else if(b.dataset.enemyContext==='examine')examineEntity(entity);else if(b.dataset.enemyContext==='read')startRead(entity);});
window.addEventListener('pointerdown',e=>{if(enemyMenu.hidden)return;if(e.target===enemyMenu||enemyMenu.contains(e.target))return;if(e.target===canvas)return;closeEnemyMenu();},{capture:true});

// Desktop movement + quality-of-life inventory shortcut.
// Never steal letters/Space from character names, search fields, or any future
// text-entry UI. The old global KeyI handler made the letter "i" impossible to
// type during character creation.
function worldShortcutTargetIsEditable(target){
  const el=target instanceof Element?target:null;
  return !!el&&(el.matches('input,textarea,select,[contenteditable="true"]')||!!el.closest('[contenteditable="true"]'));
}
window.addEventListener('keydown',e=>{
  if(worldShortcutTargetIsEditable(e.target))return;
  if(e.code==='KeyI'&&!e.repeat&&api.getState?.()){e.preventDefault();if(api.inventoryOpen())api.closeInventory();else api.openInventory();sync();return;}
  if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','KeyW','KeyA','KeyS','KeyD'].includes(e.code)){if(uiAllowsWorld()){e.preventDefault();world.keyDown(e.code);}}
  if((e.code==='KeyE'||e.code==='Space')&&!e.repeat&&uiAllowsWorld()){e.preventDefault();doInteract();}
});
window.addEventListener('keyup',e=>{world.keyUp(e.code);});
window.addEventListener('blur',()=>{for(const code of ['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','KeyW','KeyA','KeyS','KeyD'])world.keyUp(code);world.setJoystick(0,0);});

// Mobile analogue stick. It is deliberately simple and asset-free for now.
let stickPointer=null;
function updateStick(e){const r=stick.getBoundingClientRect(),cx=r.left+r.width/2,cy=r.top+r.height/2,dx=e.clientX-cx,dy=e.clientY-cy,max=r.width*.34,len=Math.hypot(dx,dy)||1,scale=Math.min(1,max/len),px=dx*scale,py=dy*scale;knob.style.transform=`translate(${px}px,${py}px)`;world.setJoystick(px/max,py/max);}
stick.addEventListener('pointerdown',e=>{if(!uiAllowsWorld())return;stickPointer=e.pointerId;stick.setPointerCapture(e.pointerId);updateStick(e);});
stick.addEventListener('pointermove',e=>{if(e.pointerId===stickPointer)updateStick(e);});
function releaseStick(e){if(stickPointer===null||e.pointerId!==stickPointer)return;stickPointer=null;knob.style.transform='translate(0,0)';world.setJoystick(0,0);}
stick.addEventListener('pointerup',releaseStick);stick.addEventListener('pointercancel',releaseStick);

// Keep the world and canonical legacy save aligned when the page is suspended.
window.addEventListener('pagehide',()=>api.saveWorld(world.snapshot()));
document.addEventListener('visibilitychange',()=>{if(document.hidden)api.saveWorld(world.snapshot());else sync();});
