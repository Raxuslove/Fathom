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
  getPlayerVisualScale:()=>api.getPlayerVisualScale?.()||1,
  getTownQuestMarker:info=>api.getTownQuestMarker?.(info)||null,
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
  onInteract:(entity,label)=>{pendingEntity=entity;interactBtn.disabled=!entity||!!world.isMining?.();interactBtn.textContent=label||'Interact';},
  onLoot:entity=>pickupLoot(entity),
  onLootExpired:bag=>{if(bag?.recordId)api.expireWorldLoot?.(bag.recordId);lastWorldSave=performance.now();api.saveWorld(world.snapshot());},
  onMineUnit:detail=>{const result=api.mineOreUnit?.(detail);if(result?.ok){api.saveWorld(world.snapshot());sync();}else if(result?.reason)toast(result.reason);return result;},
  onMineComplete:()=>{api.saveWorld(world.snapshot());sync();},
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
world.setEdgeAtmosphereEnabled?.(api.getWorldEdgeShadows?.()===true);
world.setMinimapZoom?.(api.getMinimapZoom?.()??2,{notify:false});

// ---------------------------------------------------------------------------
// v0.218.0 — Developer placement mode
// Visual overrides are deliberately stored outside the run save. This means a
// bad light tweak cannot damage character/world state, and replacing the build
// on the same origin keeps the editor values through localStorage.
const DEV_PLACEMENT_STORAGE='lowfathom-dev-placement-v1';
const devToggle=document.getElementById('btnDevPlacement');
const devPanel=document.getElementById('devPlacementPanel');
const devClose=document.getElementById('btnDevPlacementClose');
const devSelected=document.getElementById('devPlacementSelected');
const devInspector=document.getElementById('devPlacementInspector');
const devPicker=document.getElementById('devPlacementPicker');
const devPickerList=document.getElementById('devPlacementPickerList');
const devPlaceLightBtn=document.getElementById('btnDevPlacementPlaceLight');
const devMiningSwingBtn=document.getElementById('btnDevPlacementMiningSwing');
const devSmithingHammerBtn=document.getElementById('btnDevPlacementSmithingHammer');
const devOreMinimapBtn=document.getElementById('btnDevPlacementOreMinimap');
const devOreVeinsBtn=document.getElementById('btnDevPlacementOreVeins');
const devQuestTrackerBtn=document.getElementById('btnDevPlacementQuestTracker');
const devSmithingAnvilBtn=document.getElementById('btnDevPlacementSmithingAnvil');
const devDragBtn=document.getElementById('btnDevPlacementDrag');
const devResetBtn=document.getElementById('btnDevPlacementReset');
const devDeleteBtn=document.getElementById('btnDevPlacementDelete');
const devResetAllBtn=document.getElementById('btnDevPlacementResetAll');
const devExportBtn=document.getElementById('btnDevPlacementExport');
const devImportInput=document.getElementById('devPlacementImport');
const travelRoot=document.getElementById('travel');
const devWorldSeed=document.getElementById('devWorldSeed');
let devPlacement={enabled:false,selection:'',selectionMeta:null,dragUnlocked:false,drag:null,placeMode:''};

function devLoadConfig(){
  try{const raw=localStorage.getItem(DEV_PLACEMENT_STORAGE);return raw?JSON.parse(raw):null;}catch(err){console.warn('Developer placement settings could not be loaded.',err);return null;}
}
function devSaveConfig(){
  try{localStorage.setItem(DEV_PLACEMENT_STORAGE,JSON.stringify(world.getDevPlacementConfig?.()||{}));}catch(err){console.warn('Developer placement settings could not be saved.',err);}
}
world.setDevPlacementConfig?.(devLoadConfig());

function devApplyUiConfig(){
  const scale=Math.max(.75,Math.min(2,Number(world.getDevPlacementConfig?.()?.questTracker?.fontScale)||1.5));
  // These variables are declared on the tracker itself in CSS. Setting them on
  // :root cannot override that local declaration, which made the old DEV slider
  // appear to do nothing. Apply the live override directly to the tracker.
  const tracker=document.getElementById('worldQuestTracker');if(!tracker)return;
  tracker.style.setProperty('--quest-tracker-header-font',`${Math.round(7*scale*10)/10}px`);
  tracker.style.setProperty('--quest-tracker-title-font',`${Math.round(8*scale*10)/10}px`);
  tracker.style.setProperty('--quest-tracker-progress-font',`${Math.round(7*scale*10)/10}px`);
}
devApplyUiConfig();

function devGetPath(obj,path){return String(path||'').split('.').reduce((v,k)=>v&&v[k],obj);}
function devSetPath(obj,path,value){const parts=String(path||'').split('.');let cur=obj;for(let i=0;i<parts.length-1;i++){if(!cur[parts[i]]||typeof cur[parts[i]]!=='object')cur[parts[i]]={};cur=cur[parts[i]];}cur[parts.at(-1)]=value;}
function devField(path,title,sub,min,max,step){
  const value=Number(devGetPath(world.getDevPlacementConfig(),path));
  return `<div class="dev-placement-field"><label><b>${title}</b><span>${sub}</span></label><input type="number" data-dev-path="${path}" min="${min}" max="${max}" step="${step}" value="${Number.isFinite(value)?value:0}"><input type="range" data-dev-path="${path}" min="${min}" max="${max}" step="${step}" value="${Number.isFinite(value)?value:0}"></div>`;
}
function devSelectionInfo(id){
  if(id==='playerLanternGlow')return{id,label:'Player lantern · warm glow',editable:true,kind:'light'};
  if(id==='playerLanternVisibility')return{id,label:'Player lantern · visibility radius',editable:true,kind:'light'};
  if(id==='miningSwing')return{id,label:'Mining pickaxe · swing preview',editable:true,kind:'animation'};
  if(id==='smithingHammer')return{id,label:'Smithing hammer · swing preview',editable:true,kind:'animation'};
  if(id==='oreMinimap')return{id,label:'Ore minimap · pickaxe markers',editable:true,kind:'map'};
  if(id==='oreVeins')return{id,label:'Ore veins · visual sizes',editable:true,kind:'resource'};
  if(id==='questTracker')return{id,label:'Quest tracker · text size',editable:true,kind:'ui'};
  if(id==='smithingAnvil')return{id,label:'Dawngate anvil · placement',editable:true,kind:'prop'};
  if(String(id||'').startsWith('campfireVisibility:'))return{id,label:'Campfire · visibility radius',editable:true,kind:'light'};
  if(String(id||'').startsWith('placedLight:')){const key=String(id).slice('placedLight:'.length),light=(world.getDevPlacementConfig?.().placedLights||[]).find(v=>String(v?.id||'')===key);return light?{id,label:'Placed light · warm source',editable:true,kind:'light'}:null;}
  if(id==='playerSprite')return{id,label:'Player sprite',editable:false,kind:'protected'};
  if(id==='playerCollision')return{id,label:'Player collision',editable:false,kind:'protected'};
  if(String(id||'').startsWith('entity:')){
    const key=String(id).slice(7),e=(world.activeEntities||[]).find(v=>String(v?.id||v?.name||v?.type||'')===key);
    return{id,label:`${String(e?.name||e?.profile?.name||e?.type||'World entity')} · world entity`,editable:false,kind:'protected'};
  }
  return null;
}
function devRenderInspector(){
  const meta=devPlacement.selectionMeta||devSelectionInfo(devPlacement.selection);
  if(!devSelected||!devInspector)return;
  if(!meta){devSelected.innerHTML='<em>Selected</em><b>Nothing</b><span>'+((devPlacement.placeMode==='light')?'Click the world to place a light source.':'Click near the player or a placed light to choose a target.')+'</span>';devInspector.innerHTML='';devDragBtn.disabled=true;devResetBtn.disabled=true;if(devDeleteBtn)devDeleteBtn.disabled=true;return;}
  devSelected.innerHTML=`<em>Selected</em><b>${meta.label}</b><span>${meta.editable?'Editable visual override. Saved automatically.':'Protected in this first editor pass.'}</span>`;
  const placedLight=String(meta.id||'').startsWith('placedLight:');
  devDragBtn.disabled=!meta.editable||!(meta.id==='playerLanternGlow'||meta.id==='smithingAnvil'||placedLight);devResetBtn.disabled=!meta.editable;if(devDeleteBtn)devDeleteBtn.disabled=!placedLight;
  if(meta.id==='playerLanternGlow'){
    devInspector.innerHTML=`<div class="dev-placement-fields">${devField('playerLanternGlow.sideOffset','Side offset','Distance from player toward the held lantern.',0,40,1)}${devField('playerLanternGlow.y','Vertical offset','Positive values move the glow downward.',-32,32,1)}${devField('playerLanternGlow.innerRadius','Inner glow radius','Bright warm halo immediately around the lantern.',3,64,1)}${devField('playerLanternGlow.outerRadius','Outer glow radius','Fainter warm halo beyond the inner glow.',5,96,1)}${devField('playerLanternGlow.brightness','Brightness','1.00 is the original intensity.',.15,2.5,.05)}</div>`;
  }else if(meta.id==='playerLanternVisibility'){
    devInspector.innerHTML=`<div class="dev-placement-fields">${devField('playerLanternVisibility.clearRadius','Clear radius','Fully revealed world around the player.',80,600,4)}${devField('playerLanternVisibility.featherRadius','Feather radius','Soft edge immediately outside the clear area.',90,680,4)}${devField('playerLanternVisibility.falloffOuter','Falloff reach','Outer edge of partial visibility.',120,900,4)}${devField('playerLanternVisibility.falloffStrength','Falloff strength','How strongly the partial-visibility band cuts darkness.',0,.8,.02)}</div>`;
  }else if(meta.id==='miningSwing'){
    devInspector.innerHTML=`<div class="dev-placement-protected" style="margin-bottom:8px">Live mining-animation preview. The crosshair marks the hand/pivot. Tune these values, then use <b>Export JSON</b> and send that file back to make the result permanent.</div><div class="dev-placement-fields">${devField('miningSwing.pivotX','Pivot X','Horizontal position of the hand/grip relative to the player.',-18,18,.5)}${devField('miningSwing.pivotY','Pivot Y','Vertical position of the hand/grip; negative moves upward.',-22,10,.5)}${devField('miningSwing.startDeg','Overhead angle','Where the pickaxe waits before the downward swing.',-160,80,1)}${devField('miningSwing.impactDeg','Impact angle','Where the pickaxe finishes at the vein.',-80,160,1)}${devField('miningSwing.handleLength','Handle length','Length from the player hand to the pickaxe head.',4,20,.5)}${devField('miningSwing.headWidth','Head width','Width of the temporary pickaxe head.',3,16,.5)}${devField('miningSwing.handleThickness','Handle thickness','Temporary Canvas handle thickness.',.5,3,.25)}${devField('miningSwing.headThickness','Head thickness','Temporary Canvas pick head thickness.',1,5,.25)}</div>`;
  }else if(meta.id==='smithingHammer'){
    devInspector.innerHTML=`<div class="dev-placement-protected" style="margin-bottom:8px">Live forging-animation preview. The crosshair marks the hand/pivot. Tune the hammer arc and speed, then export JSON if you want these values baked into the build.</div><div class="dev-placement-fields">${devField('smithingHammer.pivotX','Pivot X','Horizontal hand/grip position relative to the player.',-18,18,.5)}${devField('smithingHammer.pivotY','Pivot Y','Vertical hand/grip position; negative moves upward.',-22,10,.5)}${devField('smithingHammer.startDeg','Overhead angle','Raised hammer angle before the strike.',-170,100,1)}${devField('smithingHammer.impactDeg','Impact angle','Hammer angle when it hits the anvil.',-100,170,1)}${devField('smithingHammer.handleLength','Handle length','Distance from the hand to the hammer head.',4,18,.5)}${devField('smithingHammer.headWidth','Head width','Width of the temporary Canvas hammer head.',3,14,.5)}${devField('smithingHammer.handleThickness','Handle thickness','Temporary Canvas handle thickness.',.5,3,.25)}${devField('smithingHammer.headHeight','Head height','Thickness/height of the hammer head.',2,8,.5)}${devField('smithingHammer.cycleMs','Strike speed','Milliseconds for one full raise/strike/recover cycle.',420,1400,20)}</div>`;
  }else if(meta.id==='oreMinimap'){
    devInspector.innerHTML=`<div class="dev-placement-protected" style="margin-bottom:8px">Tunes the discovered-vein pickaxe marker. Nearby productive veins are clustered into one icon; mined-out veins are removed from the minimap.</div><div class="dev-placement-fields">${devField('oreMinimap.iconSize','Icon size','Rendered size of mini-pickaxe-icon.png on the minimap.',3,16,.5)}${devField('oreMinimap.clusterRadiusTiles','Cluster radius','Veins within roughly this many world tiles share one marker.',2,24,1)}</div>`;
  }else if(meta.id==='oreVeins'){
    devInspector.innerHTML=`<div class="dev-placement-protected" style="margin-bottom:8px">Live visual scale for the three ore silhouettes. Capacity and placement do not change here; this is only for judging how the Canvas veins read in-world.</div><div class="dev-placement-fields">${devField('oreVeins.standardScale','Standard size','Common edge-biased deposits.',.65,1.8,.05)}${devField('oreVeins.remoteScale','Remote size','Larger deposits farther from the route or in passages.',.75,2.1,.05)}${devField('oreVeins.richScale','Rich size','Largest exploration-reward deposits.',.85,2.5,.05)}</div>`;
  }else if(meta.id==='questTracker'){
    devInspector.innerHTML=`<div class="dev-placement-protected" style="margin-bottom:8px">Changes the tracked quest helper text only. Export JSON when the size feels readable at your normal screen resolution.</div><div class="dev-placement-fields">${devField('questTracker.fontScale','Text scale','1.50 is the current recommended size; tune this for your normal screen resolution.',.75,2,.05)}</div>`;
  }else if(meta.id==='smithingAnvil'){
    devInspector.innerHTML=`<div class="dev-placement-protected" style="margin-bottom:8px">The anvil is anchored to Dawngate's blacksmith. Unlock dragging and move it directly, or tune the offsets here. Export JSON when it sits correctly.</div><div class="dev-placement-fields">${devField('smithingAnvil.offsetX','Offset X','Horizontal offset from the blacksmith.',-220,220,1)}${devField('smithingAnvil.offsetY','Offset Y','Vertical offset from the blacksmith.',-220,220,1)}${devField('smithingAnvil.scale','Scale','Visual scale of assets/props/anvil1.png.',.4,2.5,.05)}</div>`;
  }else if(String(meta.id||'').startsWith('campfireVisibility:')){
    devInspector.innerHTML=`<div class="dev-placement-protected" style="margin-bottom:8px">Shared campfire light preset. Changes apply live to every Safe Hollow campfire; the campfire object itself remains protected.</div><div class="dev-placement-fields">${devField('campfireVisibility.clearRadius','Clear radius','Fully revealed terrain immediately around every campfire.',8,300,1)}${devField('campfireVisibility.featherRadius','Feather radius','Soft edge just outside the clear campfire circle.',12,360,1)}${devField('campfireVisibility.falloffOuter','Falloff reach','Outer edge of partial campfire visibility.',16,500,2)}${devField('campfireVisibility.falloffStrength','Falloff strength','Strength of the partial-visibility outer band.',0,.8,.02)}${devField('campfireVisibility.revealStrength','Reveal strength','How completely the inner campfire pocket cuts through darkness.',.1,1,.02)}</div>`;
  }else if(placedLight){
    const key=String(meta.id).slice('placedLight:'.length),cfg=world.getDevPlacementConfig(),idx=(cfg.placedLights||[]).findIndex(v=>String(v?.id||'')===key);
    if(idx<0){devSelect(null);return;}
    const base=`placedLights.${idx}`;
    devInspector.innerHTML=`<div class="dev-placement-protected" style="margin-bottom:8px">Invisible developer light node. Place a lantern/torch asset separately when you want a visible fixture. This node only controls illumination and is saved in Dev Placement JSON/local storage.</div><div class="dev-placement-fields">${devField(`${base}.clearRadius`,'Clear radius','Fully revealed terrain around this light.',8,320,1)}${devField(`${base}.featherRadius`,'Feather radius','Soft edge just outside the clear circle.',12,400,1)}${devField(`${base}.falloffOuter`,'Falloff reach','Outer edge of partial visibility.',16,520,2)}${devField(`${base}.falloffStrength`,'Falloff strength','Strength of the partial-visibility outer band.',0,.8,.02)}${devField(`${base}.revealStrength`,'Reveal strength','How completely this light cuts through darkness.',.1,1,.02)}${devField(`${base}.glowRadius`,'Warm glow radius','Visible amber halo around the light source.',4,220,1)}${devField(`${base}.glowAlpha`,'Glow intensity','Visible amber halo intensity.',0,.5,.01)}</div>`;
  }else{
    devInspector.innerHTML='<div class="dev-placement-protected">This target is selectable so overlapping objects are unambiguous, but editing it is intentionally locked for now. That prevents accidental player movement, collision damage, quest deletion, or terrain corruption.</div>';
  }
}
function devSelect(meta){
  devPlacement.selectionMeta=meta||null;devPlacement.selection=meta?.id||'';world.setDevPlacementSelection?.(devPlacement.selection);devHidePicker();devRenderInspector();
}
function devPlacedLightKey(){return String(devPlacement.selection||'').startsWith('placedLight:')?String(devPlacement.selection).slice('placedLight:'.length):'';}
function devPlacedLightFromConfig(cfg,key=devPlacedLightKey()){return (cfg?.placedLights||[]).find(v=>String(v?.id||'')===String(key||''))||null;}
function devScreenToWorld(point){const w=world.logicalViewW?.()||0,h=world.logicalViewH?.()||0;return{x:(Number(world.camera?.x)||0)+(Number(point?.x)||0)-w/2,y:(Number(world.camera?.y)||0)+(Number(point?.y)||0)-h/2};}
function devSetPlaceLightMode(enabled){devPlacement.placeMode=enabled?'light':'';if(devPlaceLightBtn){devPlaceLightBtn.classList.toggle('active',!!enabled);devPlaceLightBtn.setAttribute('aria-pressed',String(!!enabled));devPlaceLightBtn.textContent=enabled?'Click world…':'Place light';}if(enabled){devPlacement.drag=null;devSelect(null);}else devRenderInspector();}
function devPlaceLightAt(point){const cfg=world.getDevPlacementConfig(),base=world.defaultDevPlacedLight?.()||{clearRadius:48,featherRadius:66,falloffOuter:118,falloffStrength:.24,revealStrength:.94,glowRadius:68,glowAlpha:.13},wp=devScreenToWorld(point),id=`devlight-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,7)}`;cfg.placedLights=Array.isArray(cfg.placedLights)?cfg.placedLights:[];cfg.placedLights.push({...base,id,x:Math.round(wp.x),y:Math.round(wp.y)});world.setDevPlacementConfig(cfg);devSaveConfig();devSetPlaceLightMode(false);devSelect({id:`placedLight:${id}`,label:'Placed light · warm source',editable:true,kind:'light'});toast('Light source placed.');}
function devDeleteSelectedLight(){const key=devPlacedLightKey();if(!key)return;const cfg=world.getDevPlacementConfig(),before=(cfg.placedLights||[]).length;cfg.placedLights=(cfg.placedLights||[]).filter(v=>String(v?.id||'')!==key);if(cfg.placedLights.length===before)return;world.setDevPlacementConfig(cfg);devSaveConfig();devSelect(null);toast('Placed light deleted.');}
function devHidePicker(){if(devPicker)devPicker.hidden=true;if(devPickerList)devPickerList.innerHTML='';}
function devShowPicker(candidates,clientX,clientY){
  if(!devPicker||!devPickerList)return;devPickerList.innerHTML='';
  for(const item of candidates){const b=document.createElement('button');b.type='button';b.innerHTML=`${item.label}<small>${item.editable?'editable':'protected'}</small>`;b.addEventListener('click',()=>devSelect(item));devPickerList.appendChild(b);}
  const r=travelRoot?.getBoundingClientRect();if(r){const left=Math.max(8,Math.min(r.width-300,clientX-r.left+8)),top=Math.max(8,Math.min(r.height-190,clientY-r.top+8));devPicker.style.left=`${left}px`;devPicker.style.top=`${top}px`;}
  devPicker.hidden=false;
}
function devSetMode(enabled){
  devPlacement.enabled=!!enabled;if(!devPlacement.enabled&&typeof devTemplateState!=='undefined'&&devTemplateState.open)devTemplateSetOpen(false);world.setDevPlacementEnabled?.(devPlacement.enabled);document.body.classList.toggle('dev-placement-active',devPlacement.enabled);
  if(devPanel)devPanel.hidden=!devPlacement.enabled;if(devToggle){devToggle.classList.toggle('active',devPlacement.enabled);devToggle.setAttribute('aria-pressed',String(devPlacement.enabled));}
  if(!devPlacement.enabled){devSetPlaceLightMode(false);devPlacement.drag=null;devPlacement.dragUnlocked=false;devDragBtn?.classList.remove('active');if(devDragBtn){devDragBtn.textContent='Drag locked';devDragBtn.setAttribute('aria-pressed','false');}devSelect(null);devHidePicker();}
  else{for(const code of ['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','KeyW','KeyA','KeyS','KeyD'])world.keyUp(code);world.setJoystick(0,0);devRenderInspector();}
}
function devApplyPath(path,value){
  const cfg=world.getDevPlacementConfig();devSetPath(cfg,path,value);world.setDevPlacementConfig(cfg);devApplyUiConfig();devSaveConfig();
  for(const el of devInspector?.querySelectorAll(`[data-dev-path="${path}"]`)||[]){if(String(el.value)!==String(value))el.value=String(value);}
}
function devNudge(dx,dy){
  const cfg=world.getDevPlacementConfig();
  if(devPlacement.selection==='playerLanternGlow'){const g=cfg.playerLanternGlow,facing=world.playerLanternScreenPosition?.().facing||'right';if(dx){const screenSigned=(facing==='left'?g.sideOffset:-g.sideOffset)+dx;g.sideOffset=Math.max(0,Math.min(40,Math.abs(screenSigned)));}if(dy)g.y=Math.max(-32,Math.min(32,g.y+dy));}
  else if(devPlacement.selection==='smithingAnvil'){cfg.smithingAnvil.offsetX=Math.max(-220,Math.min(220,(Number(cfg.smithingAnvil.offsetX)||0)+dx));cfg.smithingAnvil.offsetY=Math.max(-220,Math.min(220,(Number(cfg.smithingAnvil.offsetY)||0)+dy));}
  else{const light=devPlacedLightFromConfig(cfg);if(!light)return false;light.x=Math.round((Number(light.x)||0)+dx);light.y=Math.round((Number(light.y)||0)+dy);}
  world.setDevPlacementConfig(cfg);devSaveConfig();devRenderInspector();return true;
}
function devResetSelected(){
  const id=devPlacement.selection;if(!id)return;const cfg=world.getDevPlacementConfig(),defaults=world.defaultDevPlacementConfig?.();if(!defaults)return;
  if(id==='playerLanternGlow')cfg.playerLanternGlow=defaults.playerLanternGlow;
  else if(id==='playerLanternVisibility')cfg.playerLanternVisibility=defaults.playerLanternVisibility;
  else if(id==='miningSwing')cfg.miningSwing=defaults.miningSwing;
  else if(id==='smithingHammer')cfg.smithingHammer=defaults.smithingHammer;
  else if(id==='oreMinimap')cfg.oreMinimap=defaults.oreMinimap;
  else if(id==='oreVeins')cfg.oreVeins=defaults.oreVeins;
  else if(id==='questTracker')cfg.questTracker=defaults.questTracker;
  else if(id==='smithingAnvil')cfg.smithingAnvil=defaults.smithingAnvil;
  else if(String(id).startsWith('campfireVisibility:'))cfg.campfireVisibility=defaults.campfireVisibility;
  else if(String(id).startsWith('placedLight:')){const light=devPlacedLightFromConfig(cfg);if(!light)return;const base=world.defaultDevPlacedLight?.()||{};Object.assign(light,base,{id:light.id,x:light.x,y:light.y});}
  else return;world.setDevPlacementConfig(cfg);devApplyUiConfig();devSaveConfig();devRenderInspector();toast('Selected developer override reset.');
}
function devResetAll(){
  if(!confirm('Reset all developer placement overrides to their build defaults?'))return;world.setDevPlacementConfig(world.defaultDevPlacementConfig?.());devApplyUiConfig();try{localStorage.removeItem(DEV_PLACEMENT_STORAGE);}catch{}devRenderInspector();toast('Developer placement overrides reset.');
}
function devExport(){
  const payload={format:'lowfathom-dev-placement',version:9,build:'v0.219.50',config:world.getDevPlacementConfig()};const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='lowfathom-dev-placement.json';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
async function devImport(file){
  if(!file)return;try{const parsed=JSON.parse(await file.text()),cfg=parsed?.config||parsed;world.setDevPlacementConfig(cfg);devApplyUiConfig();devSaveConfig();devRenderInspector();toast('Developer placement settings imported.');}catch(err){console.error(err);toast('That developer placement JSON could not be imported.');}finally{if(devImportInput)devImportInput.value='';}
}



// v0.219.0 — Settlement Template Workshop
// This editor intentionally does not write into the active procedural world.
// It authors reusable local-coordinate stamps that can later be consumed by the
// settlement generator. The browser keeps a draft and named library; JSON export
// is the durable handoff/project copy.
const DEV_TEMPLATE_LIBRARY_STORAGE='lowfathom-dev-template-library-v1';
const DEV_TEMPLATE_DRAFT_STORAGE='lowfathom-dev-template-draft-v1';
const DEV_TEMPLATE_ASSET_STORAGE='lowfathom-dev-template-assets-v1';
const DEV_TEMPLATE_SCAN_FOLDERS_STORAGE='lowfathom-dev-template-scan-folders-v1';
const DEV_TEMPLATE_VIEW_STORAGE='lowfathom-dev-template-view-v1';
const DEV_TEMPLATE_ROAD_STAMPS_STORAGE='lowfathom-dev-template-road-stamps-v1';
const DEV_TEMPLATE_ASSET_COLLAPSE_STORAGE='lowfathom-dev-template-asset-collapse-v1';
const DEV_TEMPLATE_TILES_FOLDER_MIGRATION_STORAGE='lowfathom-dev-template-tiles-folder-migrated-v1';
const DEV_TEMPLATE_HISTORY_STORAGE='lowfathom-dev-template-history-v1';
const DEV_TEMPLATE_HISTORY_MAX=120;
const DEV_TEMPLATE_HISTORY_PERSIST_COUNT=24;
const DEV_TEMPLATE_HISTORY_PERSIST_BYTES=900000;
const DEV_TEMPLATE_HISTORY_PERSIST_DELAY=900;
const DEV_TEMPLATE_DRAFT_PERSIST_DELAY=180;
const devTemplateWorkshop=document.getElementById('devTemplateWorkshop');
const devTemplateOpenBtn=document.getElementById('btnDevTemplateOpen');
const devTemplateCloseBtn=document.getElementById('btnDevTemplateClose');
const devTemplateNewBtn=document.getElementById('btnDevTemplateNew');
const devTemplateSaveBtn=document.getElementById('btnDevTemplateSave');
const devTemplateDuplicateBtn=document.getElementById('btnDevTemplateDuplicate');
const devTemplateExportBtn=document.getElementById('btnDevTemplateExport');
const devTemplateExportAllBtn=document.getElementById('btnDevTemplateExportAll');
const devTemplateImportInput=document.getElementById('devTemplateImport');
const devTemplateDeleteTemplateBtn=document.getElementById('btnDevTemplateDeleteTemplate');
const devTemplateLibrarySelect=document.getElementById('devTemplateLibrary');
const devTemplateLoadBtn=document.getElementById('btnDevTemplateLoad');
const devTemplateNameInput=document.getElementById('devTemplateName');
const devTemplateKindSelect=document.getElementById('devTemplateKind');
const devTemplateWidthInput=document.getElementById('devTemplateWidth');
const devTemplateHeightInput=document.getElementById('devTemplateHeight');
const devTemplateAssetPathInput=document.getElementById('devTemplateAssetPath');
const devTemplateRegisterAssetBtn=document.getElementById('btnDevTemplateRegisterAsset');
const devTemplateScanAssetsBtn=document.getElementById('btnDevTemplateScanAssets');
const devTemplateAssetFolderInput=document.getElementById('devTemplateAssetFolder');
const devTemplateAssetScanMeta=document.getElementById('devTemplateAssetScanMeta');
const devTemplateScanFolderRules=document.getElementById('devTemplateScanFolderRules');
const devTemplateScanFolderInput=document.getElementById('devTemplateScanFolderInput');
const devTemplateScanFolderAddBtn=document.getElementById('btnDevTemplateScanFolderAdd');
const devTemplateScanFolderCleanBtn=document.getElementById('btnDevTemplateScanFolderClean');
const devTemplateAssets=document.getElementById('devTemplateAssets');
const devTemplateRoadSheet=document.getElementById('devTemplateRoadSheet');
const devTemplateRoadTileSize=document.getElementById('devTemplateRoadTileSize');
const devTemplateRoadScale=document.getElementById('devTemplateRoadScale');
const devTemplateRoadPaletteZoom=document.getElementById('devTemplateRoadPaletteZoom');
const devTemplateRoadPaletteWrap=document.getElementById('devTemplateRoadPaletteWrap');
const devTemplateRoadPalette=document.getElementById('devTemplateRoadPalette');
const devTemplateRoadPaletteEmpty=document.getElementById('devTemplateRoadPaletteEmpty');
const devTemplateRoadMeta=document.getElementById('devTemplateRoadMeta');
const devTemplateRoadWindow=document.getElementById('devTemplateRoadWindow');
const devTemplateRoadWindowHead=document.getElementById('devTemplateRoadWindowHead');
const devTemplateRoadWindowResetBtn=document.getElementById('btnDevTemplateRoadWindowReset');
const devTemplateRoadWindowMinimizeBtn=document.getElementById('btnDevTemplateRoadWindowMinimize');
const devTemplateRoadPreview=document.getElementById('devTemplateRoadPreview');
const devTemplateRoadSaved=document.getElementById('devTemplateRoadSaved');
const devTemplateRoadRecent=document.getElementById('devTemplateRoadRecent');
const devTemplateRoadPaintBtn=document.getElementById('btnDevTemplateRoadPaint');
const devTemplateRoadEraseBtn=document.getElementById('btnDevTemplateRoadErase');
const devTemplateRoadSelectBtn=document.getElementById('btnDevTemplateRoadSelect');
const devTemplateRoadEyedropBtn=document.getElementById('btnDevTemplateRoadEyedrop');
const devTemplateRoadSaveStampBtn=document.getElementById('btnDevTemplateRoadSaveStamp');
const devTemplateRoadStopBtn=document.getElementById('btnDevTemplateRoadStop');
const devTemplateShowCollision=document.getElementById('devTemplateShowCollision');
const devTemplateShowOcclusion=document.getElementById('devTemplateShowOcclusion');
const devTemplateShowDoors=document.getElementById('devTemplateShowDoors');
const devTemplateSnap=document.getElementById('devTemplateSnap');
const devTemplateUndoBtn=document.getElementById('btnDevTemplateUndo');
const devTemplateRedoBtn=document.getElementById('btnDevTemplateRedo');
const devTemplateZoom=document.getElementById('devTemplateZoom');
const devTemplateZoomOutBtn=document.getElementById('btnDevTemplateZoomOut');
const devTemplateZoomResetBtn=document.getElementById('btnDevTemplateZoomReset');
const devTemplateZoomInBtn=document.getElementById('btnDevTemplateZoomIn');
const devTemplateZoomReadout=document.getElementById('devTemplateZoomReadout');
const devTemplatePixelGrid=document.getElementById('devTemplatePixelGrid');
const devTemplateShowPlayerRef=document.getElementById('devTemplateShowPlayerRef');
const devTemplatePlayerRefClass=document.getElementById('devTemplatePlayerRefClass');
const devTemplatePlayerRefCenterBtn=document.getElementById('btnDevTemplatePlayerRefCenter');
const devTemplateStage=document.getElementById('devTemplateStage');
const devTemplateCanvasShell=document.getElementById('devTemplateCanvasShell');
const devTemplateCanvas=document.getElementById('devTemplateCanvas');
const devTemplatePicker=document.getElementById('devTemplatePicker');
const devTemplatePickerList=document.getElementById('devTemplatePickerList');
const devTemplateInspector=document.getElementById('devTemplateInspector');
const devTemplateStatus=document.getElementById('devTemplateStatus');

const devTemplateDeepClone=value=>JSON.parse(JSON.stringify(value));
const devTemplateClamp=(n,min,max)=>Math.max(min,Math.min(max,Number(n)||0));
const devTemplateEsc=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const devTemplateId=(prefix='item')=>`${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`;
const devTemplateSlug=value=>String(value||'template').trim().toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,52)||'template';
const devTemplateFilename=path=>String(path||'asset').split('/').filter(Boolean).at(-1)||'asset';
const devTemplateAssetCategory=path=>{const parts=String(path||'').replace(/\\/g,'/').split('/').filter(Boolean),i=parts.indexOf('assets');return i>=0&&parts[i+1]?parts[i+1]:'other';};
const DEV_TEMPLATE_IMAGE_EXT=/\.(?:png|webp|jpe?g|gif|avif)$/i;
const DEV_TEMPLATE_PLAYER_REF_SPRITES=Object.freeze({Votary:'./assets/player/knight-lantern-player.png',Rogue:'./assets/player/rogue-lantern-player.png',Wizard:'./assets/player/mage-lantern-player.png'});
const DEV_TEMPLATE_ZOOM_LEVELS=[.5,.75,1,1.5,2,3,4,6];
const DEV_TEMPLATE_DEFAULT_SCAN_FOLDERS=Object.freeze(['buildings','props','npcs','tiles']);
const DEV_TEMPLATE_TILE_CATEGORIES=Object.freeze(['tiles','roads']);
const devTemplateIsTileCategory=value=>DEV_TEMPLATE_TILE_CATEGORIES.includes(String(value||'').toLowerCase());
const DEV_TEMPLATE_FILTER_PRESETS=Object.freeze({
  original:{label:'Original',brightness:1,saturation:1,tint:'#71806f',tintStrength:0},
  darker:{label:'Darker',brightness:.78,saturation:.90,tint:'#71806f',tintStrength:0},
  muted:{label:'Muted',brightness:.96,saturation:.58,tint:'#71806f',tintStrength:.05},
  'dark-muted':{label:'Dark + Muted',brightness:.78,saturation:.58,tint:'#667363',tintStrength:.08},
  mossy:{label:'Mossy / Forest',brightness:.84,saturation:.68,tint:'#536650',tintStrength:.14}
});
function devTemplateDefaultVisual(){return{preset:'original',brightness:1,saturation:1,tint:'#71806f',tintStrength:0};}
const DEV_TEMPLATE_LAYERS=Object.freeze({ground:{label:'Ground / Path',z:1},normal:{label:'Normal Objects',z:2},foreground:{label:'Foreground',z:4}});
function devTemplateNormalizeLayer(value,fallback='normal'){value=String(value||'').toLowerCase();return DEV_TEMPLATE_LAYERS[value]?value:fallback;}
function devTemplateLayerZ(value){return DEV_TEMPLATE_LAYERS[devTemplateNormalizeLayer(value,'normal')]?.z||2;}
function devTemplateLayerOptions(current){current=devTemplateNormalizeLayer(current,'normal');return Object.entries(DEV_TEMPLATE_LAYERS).map(([id,meta])=>`<option value="${id}" ${current===id?'selected':''}>${meta.label}</option>`).join('');}
function devTemplateSanitizeZones(zones,maxW=4096,maxH=4096){return Array.isArray(zones)?zones.slice(0,16).map((z,i)=>({id:String(z?.id||devTemplateId('zone')),enabled:z?.enabled!==false,x:devTemplateClamp(z?.x??0,0,maxW),y:devTemplateClamp(z?.y??0,0,maxH),w:devTemplateClamp(z?.w??Math.min(32,maxW),1,maxW),h:devTemplateClamp(z?.h??Math.min(32,maxH),1,maxH)})):[];}
function devTemplateDefaultZone(width,height,kind='collision'){const w=Math.max(1,Number(width)||1),h=Math.max(1,Number(height)||1);return kind==='occlusion'?{id:devTemplateId('zone'),enabled:true,x:0,y:0,w,h:Math.max(1,Math.round(h*.5))}:{id:devTemplateId('zone'),enabled:true,x:0,y:Math.round(h*.25),w,h:Math.max(1,Math.round(h*.75))};}
function devTemplateDefault(){return{format:'lowfathom-settlement-template',version:8,id:'',name:'Untitled Town',kind:'town',width:960,height:640,objects:[],tileLayers:[{id:'roads',name:'Roads',kind:'ground',tiles:[]}],anchors:{entrance:{x:480,y:616},exit:{x:480,y:24}},updatedAt:new Date().toISOString()};}
function devTemplateSanitize(raw){
  const base=devTemplateDefault(),src=raw&&typeof raw==='object'?raw:{};
  base.id=String(src.id||'');base.name=String(src.name||base.name).slice(0,80);base.kind=['village','town','city','outpost','custom'].includes(src.kind)?src.kind:'town';
  base.width=Math.round(devTemplateClamp(src.width||base.width,256,4096));base.height=Math.round(devTemplateClamp(src.height||base.height,256,4096));
  const anchors=src.anchors||{};base.anchors.entrance={x:devTemplateClamp(anchors.entrance?.x??base.width/2,0,base.width),y:devTemplateClamp(anchors.entrance?.y??base.height-24,0,base.height)};base.anchors.exit={x:devTemplateClamp(anchors.exit?.x??base.width/2,0,base.width),y:devTemplateClamp(anchors.exit?.y??24,0,base.height)};
  base.objects=Array.isArray(src.objects)?src.objects.slice(0,600).map((o,i)=>{
    const aw=Math.round(devTemplateClamp(o?.assetWidth||64,1,2048)),ah=Math.round(devTemplateClamp(o?.assetHeight||64,1,2048)),scale=devTemplateClamp(o?.scale||1,.25,4);
    const collision=o?.collision||{},occlusion=o?.occlusion||{},door=o?.door||{},visual=o?.visual||{},isBuilding=devTemplateAssetCategory(o?.assetPath)==='buildings';
    const preset=DEV_TEMPLATE_FILTER_PRESETS[visual.preset]?visual.preset:(visual.preset==='custom'?'custom':'original'),fallbackPreset=DEV_TEMPLATE_FILTER_PRESETS[preset]||DEV_TEMPLATE_FILTER_PRESETS.original;
    return{id:String(o?.id||devTemplateId('asset')),type:'asset',assetPath:String(o?.assetPath||''),label:String(o?.label||devTemplateFilename(o?.assetPath)||`Asset ${i+1}`).slice(0,80),x:devTemplateClamp(o?.x||0,-2048,base.width+2048),y:devTemplateClamp(o?.y||0,-2048,base.height+2048),scale,assetWidth:aw,assetHeight:ah,locked:!!o?.locked,layer:devTemplateNormalizeLayer(o?.layer,'normal'),visual:{preset,brightness:devTemplateClamp(visual.brightness??fallbackPreset.brightness,.25,1.6),saturation:devTemplateClamp(visual.saturation??fallbackPreset.saturation,0,2),tint:/^#[0-9a-f]{6}$/i.test(String(visual.tint||''))?String(visual.tint):fallbackPreset.tint,tintStrength:devTemplateClamp(visual.tintStrength??fallbackPreset.tintStrength,0,.8)},collision:{enabled:collision.enabled!==false,x:devTemplateClamp(collision.x??0,0,aw),y:devTemplateClamp(collision.y??Math.round(ah*.25),0,ah),w:devTemplateClamp(collision.w??aw,1,aw),h:devTemplateClamp(collision.h??Math.max(1,Math.round(ah*.75)),1,ah)},occlusion:{enabled:occlusion.enabled!==undefined?!!occlusion.enabled:isBuilding,x:devTemplateClamp(occlusion.x??0,0,aw),y:devTemplateClamp(occlusion.y??0,0,ah),w:devTemplateClamp(occlusion.w??aw,1,aw),h:devTemplateClamp(occlusion.h??Math.max(1,Math.round(ah*.50)),1,ah)},door:{enabled:door.enabled!==false,x:devTemplateClamp(door.x??aw/2,0,aw),y:devTemplateClamp(door.y??ah,0,ah)},collisionZones:devTemplateSanitizeZones(o?.collisionZones,aw,ah),occlusionZones:devTemplateSanitizeZones(o?.occlusionZones,aw,ah)};
  }):[];
  const rawLayers=Array.isArray(src.tileLayers)?src.tileLayers:[];
  base.tileLayers=rawLayers.slice(0,8).map((layer,li)=>({id:String(layer?.id||`tiles-${li+1}`),name:String(layer?.name||`Tile Layer ${li+1}`).slice(0,60),kind:String(layer?.kind||'ground').slice(0,24),tiles:Array.isArray(layer?.tiles)?layer.tiles.slice(0,12000).map(tile=>{const visual=tile?.visual||{},preset=DEV_TEMPLATE_FILTER_PRESETS[visual.preset]?visual.preset:(visual.preset==='custom'?'custom':'original'),fallbackPreset=DEV_TEMPLATE_FILTER_PRESETS[preset]||DEV_TEMPLATE_FILTER_PRESETS.original;return{id:String(tile?.id||devTemplateId('tile')),assetPath:String(tile?.assetPath||''),tileIndex:Math.max(0,Math.floor(Number(tile?.tileIndex)||0)),tileSize:Math.round(devTemplateClamp(tile?.tileSize||16,4,128)),x:devTemplateClamp(tile?.x||0,-2048,base.width+2048),y:devTemplateClamp(tile?.y||0,-2048,base.height+2048),scale:devTemplateClamp(tile?.scale||1,.25,4),groupId:String(tile?.groupId||''),sourceStampId:String(tile?.sourceStampId||''),label:String(tile?.label||'').slice(0,80),locked:!!tile?.locked,layer:devTemplateNormalizeLayer(tile?.layer,'ground'),visual:{preset,brightness:devTemplateClamp(visual.brightness??fallbackPreset.brightness,.25,1.6),saturation:devTemplateClamp(visual.saturation??fallbackPreset.saturation,0,2),tint:/^#[0-9a-f]{6}$/i.test(String(visual.tint||''))?String(visual.tint):fallbackPreset.tint,tintStrength:devTemplateClamp(visual.tintStrength??fallbackPreset.tintStrength,0,.8)},collisionZones:devTemplateSanitizeZones(tile?.collisionZones,4096,4096),occlusionZones:devTemplateSanitizeZones(tile?.occlusionZones,4096,4096)}}).filter(tile=>tile.assetPath):[]}));
  if(!base.tileLayers.some(layer=>layer.id==='roads'))base.tileLayers.unshift({id:'roads',name:'Roads',kind:'ground',tiles:[]});
  base.updatedAt=String(src.updatedAt||new Date().toISOString());return base;
}
function devTemplateStorageGet(key,fallback){try{const raw=localStorage.getItem(key);return raw?JSON.parse(raw):fallback;}catch(err){console.warn('Dev template storage read failed.',err);return fallback;}}
function devTemplateStorageSet(key,value){try{localStorage.setItem(key,JSON.stringify(value));}catch(err){console.warn('Dev template storage write failed.',err);}}
function devTemplateLoadLibrary(){const value=devTemplateStorageGet(DEV_TEMPLATE_LIBRARY_STORAGE,{});return value&&typeof value==='object'&&!Array.isArray(value)?value:{};}
function devTemplateLoadAssets(){const value=devTemplateStorageGet(DEV_TEMPLATE_ASSET_STORAGE,[]);return Array.isArray(value)?[...new Set(value.map(String).filter(Boolean))]:[];}
function devTemplateNormalizeScanFolder(value){let p=String(value||'').trim().replace(/\\/g,'/').replace(/^\.\//,'').replace(/^assets\//i,'').replace(/^\/+|\/+$/g,'');return p.split('/').filter(Boolean).join('/').toLowerCase();}
function devTemplateLoadScanFolders(){const value=devTemplateStorageGet(DEV_TEMPLATE_SCAN_FOLDERS_STORAGE,DEV_TEMPLATE_DEFAULT_SCAN_FOLDERS);const arr=Array.isArray(value)?value:DEV_TEMPLATE_DEFAULT_SCAN_FOLDERS,clean=[...new Set(arr.map(devTemplateNormalizeScanFolder).filter(Boolean))];if(!devTemplateStorageGet(DEV_TEMPLATE_TILES_FOLDER_MIGRATION_STORAGE,false)){if(!clean.includes('tiles'))clean.push('tiles');devTemplateStorageSet(DEV_TEMPLATE_SCAN_FOLDERS_STORAGE,clean);devTemplateStorageSet(DEV_TEMPLATE_TILES_FOLDER_MIGRATION_STORAGE,true);}return clean.length?clean.sort():[...DEV_TEMPLATE_DEFAULT_SCAN_FOLDERS];}
function devTemplateLoadAssetCollapse(){const value=devTemplateStorageGet(DEV_TEMPLATE_ASSET_COLLAPSE_STORAGE,[]);return Array.isArray(value)?[...new Set(value.map(v=>String(v||'').toLowerCase()).filter(Boolean))]:[];}
function devTemplateLoadRoadStamps(){const value=devTemplateStorageGet(DEV_TEMPLATE_ROAD_STAMPS_STORAGE,[]);return Array.isArray(value)?value.slice(0,24).map(s=>{const visual=s?.visual||{},preset=DEV_TEMPLATE_FILTER_PRESETS[visual.preset]?visual.preset:(visual.preset==='custom'?'custom':'original'),fallback=DEV_TEMPLATE_FILTER_PRESETS[preset]||DEV_TEMPLATE_FILTER_PRESETS.original;return{id:String(s?.id||devTemplateId('stamp')),name:String(s?.name||'Tile stamp').slice(0,60),assetPath:String(s?.assetPath||''),tileSize:Math.round(devTemplateClamp(s?.tileSize||16,4,128)),scale:devTemplateClamp(s?.scale||2,1,4),cols:Math.max(1,Math.floor(Number(s?.cols)||1)),rows:Math.max(1,Math.floor(Number(s?.rows)||1)),locked:!!s?.locked,layer:devTemplateNormalizeLayer(s?.layer,'ground'),cells:Array.isArray(s?.cells)?s.cells.map(cell=>({dx:Math.max(0,Math.floor(Number(cell?.dx)||0)),dy:Math.max(0,Math.floor(Number(cell?.dy)||0)),tileIndex:Math.max(0,Math.floor(Number(cell?.tileIndex)||0))})).filter(cell=>Number.isFinite(cell.tileIndex)).slice(0,400):[],visual:{preset,brightness:devTemplateClamp(visual.brightness??fallback.brightness,.25,1.6),saturation:devTemplateClamp(visual.saturation??fallback.saturation,0,2),tint:/^#[0-9a-f]{6}$/i.test(String(visual.tint||''))?String(visual.tint):fallback.tint,tintStrength:devTemplateClamp(visual.tintStrength??fallback.tintStrength,0,.8)},collisionZones:devTemplateSanitizeZones(s?.collisionZones,4096,4096),occlusionZones:devTemplateSanitizeZones(s?.occlusionZones,4096,4096)};}).filter(s=>s.assetPath&&s.cells.length):[];}
function devTemplateLoadView(){const raw=devTemplateStorageGet(DEV_TEMPLATE_VIEW_STORAGE,{}),z=DEV_TEMPLATE_ZOOM_LEVELS.includes(Number(raw?.zoom))?Number(raw.zoom):1,cls=DEV_TEMPLATE_PLAYER_REF_SPRITES[raw?.playerClass]?raw.playerClass:'Votary',roadScale=[1,2,3,4].includes(Number(raw?.roadScale))?Number(raw.roadScale):2,roadPaletteZoom=[1,1.25,1.5,2].includes(Number(raw?.roadPaletteZoom))?Number(raw.roadPaletteZoom):1.25;return{zoom:z,pixelGrid:!!raw?.pixelGrid,showPlayer:!!raw?.showPlayer,playerClass:cls,playerX:Number.isFinite(Number(raw?.playerX))?Number(raw.playerX):480,playerY:Number.isFinite(Number(raw?.playerY))?Number(raw.playerY):320,roadSheet:String(raw?.roadSheet||''),roadTileSize:Math.round(devTemplateClamp(raw?.roadTileSize||16,4,128)),roadScale,roadPaletteZoom,roadWindowX:Number.isFinite(Number(raw?.roadWindowX))?Number(raw.roadWindowX):null,roadWindowY:Number.isFinite(Number(raw?.roadWindowY))?Number(raw.roadWindowY):null,roadWindowMinimized:!!raw?.roadWindowMinimized,snap:[1,2,4,8,16,32,64].includes(Number(raw?.snap))?Number(raw.snap):1};}
const devTemplateView=devTemplateLoadView();
let devTemplateState={open:false,current:devTemplateSanitize(devTemplateStorageGet(DEV_TEMPLATE_DRAFT_STORAGE,null)),library:devTemplateLoadLibrary(),assets:devTemplateLoadAssets(),scanFolders:devTemplateLoadScanFolders(),collapsedAssetCategories:devTemplateLoadAssetCollapse(),selection:null,multiSelection:[],multiRoadSelection:[],drag:null,marquee:null,dirty:false,showCollision:false,showOcclusion:false,showDoors:false,regionTool:null,regionDraw:null,snap:devTemplateView.snap,zoom:devTemplateView.zoom,pixelGrid:devTemplateView.pixelGrid,playerRef:{shown:devTemplateView.showPlayer,className:devTemplateView.playerClass,x:devTemplateView.playerX,y:devTemplateView.playerY},roadWindow:{x:devTemplateView.roadWindowX,y:devTemplateView.roadWindowY,minimized:devTemplateView.roadWindowMinimized,drag:null},roadPaint:{active:false,mode:'paint',assetPath:devTemplateView.roadSheet,tileSize:devTemplateView.roadTileSize,scale:devTemplateView.roadScale,paletteZoom:devTemplateView.roadPaletteZoom,tileIndex:0,selectionRect:{x:0,y:0,w:1,h:1},customStamp:null,savedStamps:devTemplateLoadRoadStamps(),recentStamps:[],selectedIds:[],pointerId:null,lastKey:'',strokeGroupId:'',palettePointerId:null,paletteDrag:null,hover:null}};
function devTemplatePersistView(){devTemplateStorageSet(DEV_TEMPLATE_VIEW_STORAGE,{zoom:devTemplateState.zoom,pixelGrid:!!devTemplateState.pixelGrid,showPlayer:devTemplateState.playerRef.shown,playerClass:devTemplateState.playerRef.className,playerX:devTemplateState.playerRef.x,playerY:devTemplateState.playerRef.y,roadSheet:devTemplateState.roadPaint.assetPath,roadTileSize:devTemplateState.roadPaint.tileSize,roadScale:devTemplateState.roadPaint.scale,roadPaletteZoom:devTemplateState.roadPaint.paletteZoom,roadWindowX:devTemplateState.roadWindow?.x,roadWindowY:devTemplateState.roadWindow?.y,roadWindowMinimized:!!devTemplateState.roadWindow?.minimized,snap:devTemplateState.snap});}
let devTemplateHistory={ready:false,restoring:false,undo:[],redo:[],last:null,lastCore:'',lastKey:'',lastTime:0,nextMeta:null,skipNext:false,persistTimer:0};
let devTemplateDraftPersistTimer=0;
let devTemplateRenderRaf=0;
function devTemplateHistorySnapshot(){return{current:devTemplateDeepClone(devTemplateState.current),savedStamps:devTemplateDeepClone(devTemplateState.roadPaint.savedStamps||[]),selection:devTemplateState.selection?devTemplateDeepClone(devTemplateState.selection):null,multiSelection:[...(devTemplateState.multiSelection||[])],multiRoadSelection:[...(devTemplateState.multiRoadSelection||[])],dirty:!!devTemplateState.dirty};}
function devTemplateHistoryCoreString(snapshot){return JSON.stringify({current:snapshot?.current||null,savedStamps:snapshot?.savedStamps||[]},(key,value)=>key==='updatedAt'?undefined:value);}
function devTemplateHistoryHash(value){let h=2166136261;for(let i=0;i<value.length;i++){h^=value.charCodeAt(i);h=Math.imul(h,16777619);}return(h>>>0).toString(36);}
function devTemplateHistorySetNext(label,key=''){devTemplateHistory.nextMeta={label:String(label||'Edit template'),key:String(key||'')};}
function devTemplateHistoryInferMeta(defaultLabel='Edit template'){
  if(devTemplateHistory.nextMeta){const meta=devTemplateHistory.nextMeta;devTemplateHistory.nextMeta=null;return meta;}
  const el=document.activeElement;
  if(el===devTemplateNameInput)return{label:'Rename template',key:'template:name'};
  if(el===devTemplateWidthInput||el===devTemplateHeightInput)return{label:'Resize template',key:'template:size'};
  if(el?.dataset?.templateField){const target=devTemplateState.selection?.kind&&devTemplateState.selection?.id?`${devTemplateState.selection.kind}:${devTemplateState.selection.id}`:'selection';return{label:'Edit inspector value',key:`field:${target}:${el.dataset.templateField}`};}
  if(el?.dataset?.templateRoadLabel)return{label:'Rename tile piece',key:`road-label:${devTemplateState.selection?.id||''}`};
  return{label:String(defaultLabel||'Edit template'),key:''};
}
function devTemplateHistoryRenderControls(){if(devTemplateUndoBtn){devTemplateUndoBtn.disabled=!devTemplateHistory.undo.length;const item=devTemplateHistory.undo.at(-1);devTemplateUndoBtn.title=item?`Undo: ${item.label} · Ctrl+Z`:'Nothing to undo · Ctrl+Z';}if(devTemplateRedoBtn){devTemplateRedoBtn.disabled=!devTemplateHistory.redo.length;const item=devTemplateHistory.redo.at(-1);devTemplateRedoBtn.title=item?`Redo: ${item.label} · Ctrl+Y / Ctrl+Shift+Z`:'Nothing to redo · Ctrl+Y / Ctrl+Shift+Z';}}
function devTemplateHistoryTrim(){if(devTemplateHistory.undo.length>DEV_TEMPLATE_HISTORY_MAX)devTemplateHistory.undo.splice(0,devTemplateHistory.undo.length-DEV_TEMPLATE_HISTORY_MAX);if(devTemplateHistory.redo.length>DEV_TEMPLATE_HISTORY_MAX)devTemplateHistory.redo.splice(0,devTemplateHistory.redo.length-DEV_TEMPLATE_HISTORY_MAX);}
function devTemplateHistoryPersistNow(){if(!devTemplateHistory.ready||devTemplateHistory.restoring)return;devTemplateHistoryTrim();const currentSig=devTemplateHistoryHash(devTemplateHistory.lastCore||devTemplateHistoryCoreString(devTemplateHistory.last||devTemplateHistorySnapshot()));let undo=devTemplateHistory.undo.slice(-DEV_TEMPLATE_HISTORY_PERSIST_COUNT),redo=devTemplateHistory.redo.slice(-DEV_TEMPLATE_HISTORY_PERSIST_COUNT),payload={version:1,currentSig,undo,redo};try{let raw=JSON.stringify(payload);while(raw.length>DEV_TEMPLATE_HISTORY_PERSIST_BYTES&&(undo.length>1||redo.length>1)){if(undo.length>=redo.length&&undo.length>1)undo.shift();else if(redo.length>1)redo.shift();payload={version:1,currentSig,undo,redo};raw=JSON.stringify(payload);}localStorage.setItem(DEV_TEMPLATE_HISTORY_STORAGE,raw);}catch(err){console.warn('Workshop history persistence skipped; in-memory Undo/Redo is still available.',err);}}
function devTemplateHistoryPersist({immediate=false}={}){if(!devTemplateHistory.ready||devTemplateHistory.restoring)return;if(devTemplateHistory.persistTimer){clearTimeout(devTemplateHistory.persistTimer);devTemplateHistory.persistTimer=0;}if(immediate){devTemplateHistoryPersistNow();return;}devTemplateHistory.persistTimer=setTimeout(()=>{devTemplateHistory.persistTimer=0;const run=()=>devTemplateHistoryPersistNow();if('requestIdleCallback'in window)requestIdleCallback(run,{timeout:450});else run();},DEV_TEMPLATE_HISTORY_PERSIST_DELAY);}
function devTemplateHistoryCommit(defaultLabel='Edit template'){
  if(!devTemplateHistory.ready||devTemplateHistory.restoring)return;if(devTemplateHistory.skipNext){devTemplateHistory.skipNext=false;return;}const next=devTemplateHistorySnapshot(),core=devTemplateHistoryCoreString(next);if(core===devTemplateHistory.lastCore)return;const meta=devTemplateHistoryInferMeta(defaultLabel),now=Date.now(),sameBurst=!!meta.key&&devTemplateHistory.undo.length&&devTemplateHistory.lastKey===meta.key&&now-devTemplateHistory.lastTime<900;if(sameBurst){const top=devTemplateHistory.undo.at(-1);top.label=meta.label;top.key=meta.key;top.time=now;}else{devTemplateHistory.undo.push({state:devTemplateHistory.last,label:meta.label,key:meta.key,time:now});}devTemplateHistory.redo=[];devTemplateHistory.last=next;devTemplateHistory.lastCore=core;devTemplateHistory.lastKey=meta.key;devTemplateHistory.lastTime=now;devTemplateHistoryTrim();devTemplateHistoryPersist();devTemplateHistoryRenderControls();
}
function devTemplateHistoryApply(snapshot){if(!snapshot)return;devTemplateHistory.restoring=true;try{devTemplateState.current=devTemplateSanitize(devTemplateDeepClone(snapshot.current));devTemplateState.roadPaint.savedStamps=devTemplateDeepClone(snapshot.savedStamps||[]);devTemplateState.selection=snapshot.selection?devTemplateDeepClone(snapshot.selection):null;devTemplateState.multiSelection=[...(snapshot.multiSelection||[])];devTemplateState.multiRoadSelection=[...(snapshot.multiRoadSelection||[])];devTemplateState.dirty=!!snapshot.dirty;devTemplateState.drag=null;devTemplateState.marquee=null;devTemplateState.regionTool=null;devTemplateState.regionDraw=null;devTemplateState.roadPaint.pointerId=null;devTemplateState.roadPaint.lastKey='';devTemplateState.roadPaint.strokeGroupId='';devTemplateStorageSet(DEV_TEMPLATE_DRAFT_STORAGE,devTemplateState.current);devTemplateStorageSet(DEV_TEMPLATE_ROAD_STAMPS_STORAGE,devTemplateState.roadPaint.savedStamps||[]);devTemplateRefresh();}finally{devTemplateHistory.restoring=false;}devTemplateHistory.last=devTemplateHistorySnapshot();devTemplateHistory.lastCore=devTemplateHistoryCoreString(devTemplateHistory.last);devTemplateHistory.lastKey='';devTemplateHistory.lastTime=0;devTemplateHistoryPersist({immediate:true});devTemplateHistoryRenderControls();}
function devTemplateUndo(){if(!devTemplateHistory.ready||!devTemplateHistory.undo.length)return false;const entry=devTemplateHistory.undo.pop(),current=devTemplateHistory.last||devTemplateHistorySnapshot();devTemplateHistory.redo.push({state:current,label:entry.label,key:entry.key,time:Date.now()});devTemplateHistoryApply(entry.state);toast(`Undo: ${entry.label}.`);return true;}
function devTemplateRedo(){if(!devTemplateHistory.ready||!devTemplateHistory.redo.length)return false;const entry=devTemplateHistory.redo.pop(),current=devTemplateHistory.last||devTemplateHistorySnapshot();devTemplateHistory.undo.push({state:current,label:entry.label,key:entry.key,time:Date.now()});devTemplateHistoryApply(entry.state);toast(`Redo: ${entry.label}.`);return true;}
function devTemplateHistoryInit(){const snap=devTemplateHistorySnapshot(),core=devTemplateHistoryCoreString(snap),sig=devTemplateHistoryHash(core),stored=devTemplateStorageGet(DEV_TEMPLATE_HISTORY_STORAGE,null);devTemplateHistory.last=snap;devTemplateHistory.lastCore=core;devTemplateHistory.undo=[];devTemplateHistory.redo=[];if(stored?.version===1&&stored.currentSig===sig){if(Array.isArray(stored.undo))devTemplateHistory.undo=stored.undo.filter(v=>v?.state?.current).slice(-DEV_TEMPLATE_HISTORY_MAX);if(Array.isArray(stored.redo))devTemplateHistory.redo=stored.redo.filter(v=>v?.state?.current).slice(-DEV_TEMPLATE_HISTORY_MAX);}devTemplateHistory.ready=true;devTemplateHistoryRenderControls();devTemplateHistoryPersist();}
function devTemplatePersistRoadStamps(){devTemplateStorageSet(DEV_TEMPLATE_ROAD_STAMPS_STORAGE,devTemplateState.roadPaint.savedStamps||[]);devTemplateHistoryCommit('Edit saved tile stamps');}

function devTemplateFlushDraftStorage(){if(devTemplateDraftPersistTimer){clearTimeout(devTemplateDraftPersistTimer);devTemplateDraftPersistTimer=0;}devTemplateStorageSet(DEV_TEMPLATE_DRAFT_STORAGE,devTemplateState.current);}
function devTemplateScheduleDraftStorage(){if(devTemplateDraftPersistTimer)clearTimeout(devTemplateDraftPersistTimer);devTemplateDraftPersistTimer=setTimeout(()=>{devTemplateDraftPersistTimer=0;devTemplateStorageSet(DEV_TEMPLATE_DRAFT_STORAGE,devTemplateState.current);},DEV_TEMPLATE_DRAFT_PERSIST_DELAY);}
function devTemplatePersistDraft(){devTemplateState.current.updatedAt=new Date().toISOString();devTemplateScheduleDraftStorage();devTemplateState.dirty=true;devTemplateRenderStatus();devTemplateHistoryCommit('Edit template');}
function devTemplatePersistLibrary(){devTemplateStorageSet(DEV_TEMPLATE_LIBRARY_STORAGE,devTemplateState.library);devTemplateRenderLibrary();}
function devTemplatePersistAssets(){devTemplateStorageSet(DEV_TEMPLATE_ASSET_STORAGE,devTemplateState.assets);devTemplateRenderAssets();devTemplateRenderRoadControls();}
function devTemplatePersistScanFolders(){devTemplateStorageSet(DEV_TEMPLATE_SCAN_FOLDERS_STORAGE,devTemplateState.scanFolders);devTemplateRenderScanFolders();}
function devTemplatePersistAssetCollapse(){devTemplateStorageSet(DEV_TEMPLATE_ASSET_COLLAPSE_STORAGE,devTemplateState.collapsedAssetCategories||[]);}
function devTemplateToggleAssetCategory(category){const key=String(category||'').toLowerCase(),set=new Set(devTemplateState.collapsedAssetCategories||[]);if(set.has(key))set.delete(key);else set.add(key);devTemplateState.collapsedAssetCategories=[...set];devTemplatePersistAssetCollapse();devTemplateRenderAssets();}
function devTemplateNormalizeAssetPath(value){let p=String(value||'').trim().replace(/\\/g,'/');if(!p)return'';if(!p.includes('/'))p=`./assets/buildings/${p}`;else if(!p.startsWith('.')&&!p.startsWith('/'))p=`./${p}`;return p;}
function devTemplateAssetPathLookupKey(value){return String(value||'').trim().replace(/\\/g,'/').replace(/^\.\//,'').toLowerCase();}
function devTemplateCurrentAssetPath(path,{tilesOnly=false}={}){
  const original=String(path||'');if(!original)return'';const assets=Array.isArray(devTemplateState?.assets)?devTemplateState.assets:[],key=devTemplateAssetPathLookupKey(original),file=devTemplateFilename(original).toLowerCase(),oldCategory=String(devTemplateAssetCategory(original)||'').toLowerCase();
  const eligible=assets.filter(candidate=>!tilesOnly||devTemplateIsTileCategory(devTemplateAssetCategory(candidate)));
  const exact=eligible.find(candidate=>devTemplateAssetPathLookupKey(candidate)===key);if(exact&&exact!==original)return exact;
  const sameFile=eligible.filter(candidate=>devTemplateFilename(candidate).toLowerCase()===file);if(sameFile.length){
    if(oldCategory==='roads'){const tiles=sameFile.find(candidate=>String(devTemplateAssetCategory(candidate)).toLowerCase()==='tiles');if(tiles)return tiles;}
    const sameCategory=sameFile.find(candidate=>String(devTemplateAssetCategory(candidate)).toLowerCase()===oldCategory);if(sameCategory)return sameCategory;
    if(sameFile.length===1)return sameFile[0];
  }
  return original;
}
function devTemplateReplaceAssetPathInTemplate(template,oldPath,newPath){if(!template||!oldPath||!newPath||oldPath===newPath)return 0;let changed=0;for(const o of template.objects||[]){if(String(o.assetPath||'')===oldPath){o.assetPath=newPath;changed++;}}for(const layer of template.tileLayers||[])for(const tile of layer.tiles||[]){if(String(tile.assetPath||'')===oldPath){tile.assetPath=newPath;changed++;}}return changed;}
function devTemplateReplaceAssetPathEverywhere(oldPath,newPath,{persist=true}={}){
  oldPath=String(oldPath||'');newPath=String(newPath||'');if(!oldPath||!newPath||oldPath===newPath)return 0;let changed=0;changed+=devTemplateReplaceAssetPathInTemplate(devTemplateState.current,oldPath,newPath);for(const template of Object.values(devTemplateState.library||{}))changed+=devTemplateReplaceAssetPathInTemplate(template,oldPath,newPath);for(const stamp of devTemplateState.roadPaint?.savedStamps||[]){if(String(stamp.assetPath||'')===oldPath){stamp.assetPath=newPath;changed++;}}if(String(devTemplateState.roadPaint?.assetPath||'')===oldPath){devTemplateState.roadPaint.assetPath=newPath;changed++;}if(devTemplateState.roadPaint?.customStamp&&String(devTemplateState.roadPaint.customStamp.assetPath||'')===oldPath){devTemplateState.roadPaint.customStamp.assetPath=newPath;changed++;}
  if(changed&&persist){devTemplateStorageSet(DEV_TEMPLATE_DRAFT_STORAGE,devTemplateState.current);devTemplateStorageSet(DEV_TEMPLATE_LIBRARY_STORAGE,devTemplateState.library);devTemplatePersistRoadStamps();devTemplatePersistView();}
  return changed;
}
function devTemplateRepairStoredAssetPaths({announce=false}={}){
  const replacements=new Map(),consider=(path,tilesOnly=false)=>{path=String(path||'');if(!path)return;const resolved=devTemplateCurrentAssetPath(path,{tilesOnly});if(resolved&&resolved!==path)replacements.set(path,resolved);};
  for(const o of devTemplateState.current.objects||[])consider(o.assetPath,false);for(const layer of devTemplateState.current.tileLayers||[])for(const tile of layer.tiles||[])consider(tile.assetPath,true);for(const template of Object.values(devTemplateState.library||{})){for(const o of template.objects||[])consider(o.assetPath,false);for(const layer of template.tileLayers||[])for(const tile of layer.tiles||[])consider(tile.assetPath,true);}for(const stamp of devTemplateState.roadPaint?.savedStamps||[])consider(stamp.assetPath,true);consider(devTemplateState.roadPaint?.assetPath,true);consider(devTemplateState.roadPaint?.customStamp?.assetPath,true);
  let changed=0;for(const [oldPath,newPath] of replacements)changed+=devTemplateReplaceAssetPathEverywhere(oldPath,newPath,{persist:false});if(changed){devTemplateStorageSet(DEV_TEMPLATE_DRAFT_STORAGE,devTemplateState.current);devTemplateStorageSet(DEV_TEMPLATE_LIBRARY_STORAGE,devTemplateState.library);devTemplatePersistRoadStamps();devTemplatePersistView();devTemplateRoadSheetCache.clear();if(announce)toast(`Repaired ${changed} stored Workshop asset reference${changed===1?'':'s'} after folder changes.`);}return changed;
}
function devTemplateLegacyTilePathCandidates(path){const original=String(path||''),out=[];const add=v=>{if(v&&v!==original&&!out.includes(v))out.push(v);};const registered=devTemplateCurrentAssetPath(original,{tilesOnly:true});add(registered);if(/\/assets\/roads\//i.test(original)){add(original.replace(/\/assets\/roads\//i,'/assets/tiles/'));add(original.replace(/\/assets\/roads\//i,'/assets/Tiles/'));}if(/\/assets\/tiles\//i.test(original)){add(original.replace(/\/assets\/tiles\//i,'/assets/Tiles/'));add(original.replace(/\/assets\/tiles\//i,'/assets/tiles/'));}return out;}
function devTemplateDownload(filename,payload){const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function devTemplateCanvasPoint(clientX,clientY){const r=devTemplateCanvas.getBoundingClientRect(),z=Math.max(.01,Number(devTemplateState.zoom)||1);return{x:(clientX-r.left)/z,y:(clientY-r.top)/z};}
function devTemplateObjectSize(o){return{w:o.assetWidth*o.scale,h:o.assetHeight*o.scale};}
function devTemplateObjectRect(o){const s=devTemplateObjectSize(o);return{x:o.x,y:o.y,w:s.w,h:s.h};}
function devTemplateOcclusionRect(o){const q=o?.occlusion;if(!q?.enabled)return null;return{x:o.x+q.x*o.scale,y:o.y+q.y*o.scale,w:q.w*o.scale,h:q.h*o.scale};}
function devTemplatePointInOcclusion(o,p){const rects=[];const r=devTemplateOcclusionRect(o);if(r)rects.push(r);for(const q of o?.occlusionZones||[])if(q?.enabled)rects.push({x:o.x+q.x*o.scale,y:o.y+q.y*o.scale,w:q.w*o.scale,h:q.h*o.scale});return rects.some(v=>p.x>=v.x&&p.x<=v.x+v.w&&p.y>=v.y&&p.y<=v.y+v.h);}
let devTemplateOverlapCache={sig:'',ids:new Set()};
function devTemplateVisualOverlaps(){
  const objects=devTemplateState.current.objects||[];if((devTemplateState.drag||devTemplateState.marquee||devTemplateState.regionDraw||devTemplateState.roadPaint.pointerId!==null)&&devTemplateOverlapCache.sig)return devTemplateOverlapCache.ids;const sig=objects.map(o=>`${o.id}:${Math.round(Number(o.x)||0)},${Math.round(Number(o.y)||0)},${Number(o.scale)||1},${o.assetWidth}x${o.assetHeight}`).join('|');if(sig===devTemplateOverlapCache.sig)return devTemplateOverlapCache.ids;const ids=new Set();for(let i=0;i<objects.length;i++){const a=devTemplateObjectRect(objects[i]);for(let j=i+1;j<objects.length;j++){const b=devTemplateObjectRect(objects[j]);if(a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y){ids.add(objects[i].id);ids.add(objects[j].id);}}}devTemplateOverlapCache={sig,ids};return ids;
}
function devTemplateRoadKey(tile){return tile?.groupId?`group:${tile.groupId}`:`tile:${tile?.id||''}`;}
function devTemplateRoadTilesForKey(key){const tiles=devTemplateRoadLayer().tiles,keyStr=String(key||'');if(keyStr.startsWith('group:')){const id=keyStr.slice(6);return tiles.filter(t=>String(t.groupId||'')===id);}if(keyStr.startsWith('tile:')){const id=keyStr.slice(5);return tiles.filter(t=>String(t.id||'')===id);}return[];}
function devTemplateRoadItemRect(key){const tiles=devTemplateRoadTilesForKey(key);if(!tiles.length)return null;let x1=Infinity,y1=Infinity,x2=-Infinity,y2=-Infinity;for(const tile of tiles){const r=devTemplateRoadTileRect(tile);x1=Math.min(x1,r.x);y1=Math.min(y1,r.y);x2=Math.max(x2,r.x+r.w);y2=Math.max(y2,r.y+r.h);}return{x:x1,y:y1,w:Math.max(0,x2-x1),h:Math.max(0,y2-y1)};}
function devTemplateRoadItem(key){const tiles=devTemplateRoadTilesForKey(key);if(!tiles.length)return null;const first=tiles[0],rect=devTemplateRoadItemRect(key),visual=first.visual||devTemplateDefaultVisual(),label=first.label||((tiles.length>1?'Tile stamp · ':'Tile · ')+devTemplateFilename(first.assetPath).replace(/\.[^.]+$/,''));return{key,tiles,first,rect,label,locked:tiles.every(t=>!!t.locked),layer:devTemplateNormalizeLayer(first.layer,'ground'),visual,scale:Number(first.scale)||1,assetPath:first.assetPath,tileSize:Number(first.tileSize)||16,sourceStampId:String(first.sourceStampId||''),collisionZones:devTemplateDeepClone(first.collisionZones||[]),occlusionZones:devTemplateDeepClone(first.occlusionZones||[])};}
function devTemplateAllRoadItems(){const map=new Map();for(const tile of devTemplateRoadLayer().tiles){const key=devTemplateRoadKey(tile);if(!map.has(key))map.set(key,devTemplateRoadItem(key));}return[...map.values()].filter(Boolean);}
function devTemplateRoadStructureSignature(item){if(!item?.tiles?.length)return'';const scale=Math.max(.01,Number(item.scale)||1),unit=Math.max(.01,(Number(item.tileSize)||16)*scale),originX=Number(item.rect?.x)||0,originY=Number(item.rect?.y)||0,cells=item.tiles.map(tile=>({dx:Math.round(((Number(tile.x)||0)-originX)/unit),dy:Math.round(((Number(tile.y)||0)-originY)/unit),tileIndex:Math.max(0,Math.floor(Number(tile.tileIndex)||0)),assetPath:String(tile.assetPath||'')})).sort((a,b)=>a.assetPath.localeCompare(b.assetPath)||a.dy-b.dy||a.dx-b.dx||a.tileIndex-b.tileIndex);return `${Number(item.tileSize)||16}|${cells.map(c=>`${c.assetPath}:${c.dx},${c.dy},${c.tileIndex}`).join(';')}`;}
function devTemplateRoadStampStructureSignature(stamp){if(!stamp?.cells?.length)return'';const cells=stamp.cells.map(c=>({dx:Math.max(0,Math.floor(Number(c.dx)||0)),dy:Math.max(0,Math.floor(Number(c.dy)||0)),tileIndex:Math.max(0,Math.floor(Number(c.tileIndex)||0))})).sort((a,b)=>a.dy-b.dy||a.dx-b.dx||a.tileIndex-b.tileIndex);return `${Number(stamp.tileSize)||16}|${cells.map(c=>`${String(stamp.assetPath||'')}:${c.dx},${c.dy},${c.tileIndex}`).join(';')}`;}
function devTemplateRoadSavedStampById(id){id=String(id||'');return id?(devTemplateState.roadPaint.savedStamps||[]).find(s=>String(s.id||'')===id)||null:null;}
function devTemplateRoadMatchingItems(item){if(!item)return[];const savedId=item.sourceStampId&&devTemplateRoadSavedStampById(item.sourceStampId)?item.sourceStampId:'',structure=devTemplateRoadStructureSignature(item);return devTemplateAllRoadItems().filter(other=>{const otherId=String(other.sourceStampId||'');if(savedId)return otherId===savedId||(!otherId&&devTemplateRoadStructureSignature(other)===structure);return devTemplateRoadStructureSignature(other)===structure;});}
function devTemplateRoadMatchingSavedStamps(item){if(!item)return[];const byId=item.sourceStampId?devTemplateRoadSavedStampById(item.sourceStampId):null;if(byId)return[byId];const structure=devTemplateRoadStructureSignature(item);return(devTemplateState.roadPaint.savedStamps||[]).filter(stamp=>devTemplateRoadStampStructureSignature(stamp)===structure);}
function devTemplateRoadPropagateShared(item,fields={}){if(!item)return{copies:0,saved:0};const matches=devTemplateRoadMatchingItems(item),saved=devTemplateRoadMatchingSavedStamps(item);for(const other of matches){if(item.sourceStampId&&!other.sourceStampId)for(const tile of other.tiles)tile.sourceStampId=item.sourceStampId;if(fields.locked!==undefined)devTemplateSetRoadItemLocked(other,fields.locked);if(fields.layer!==undefined)devTemplateSetRoadItemLayer(other,fields.layer);if(fields.visual)devTemplateSetRoadItemVisual(other,fields.visual);if(fields.collisionZones)devTemplateSetRoadItemZones(other,'collision',fields.collisionZones);if(fields.occlusionZones)devTemplateSetRoadItemZones(other,'occlusion',fields.occlusionZones);}for(const stamp of saved){if(fields.locked!==undefined)stamp.locked=!!fields.locked;if(fields.layer!==undefined)stamp.layer=devTemplateNormalizeLayer(fields.layer,'ground');if(fields.visual)stamp.visual=devTemplateDeepClone(fields.visual);if(fields.collisionZones)stamp.collisionZones=devTemplateDeepClone(fields.collisionZones);if(fields.occlusionZones)stamp.occlusionZones=devTemplateDeepClone(fields.occlusionZones);}if(saved.length){devTemplateStorageSet(DEV_TEMPLATE_ROAD_STAMPS_STORAGE,devTemplateState.roadPaint.savedStamps||[]);const activeId=String(devTemplateState.roadPaint.customStamp?.id||''),updated=activeId?saved.find(s=>String(s.id||'')===activeId):null;if(updated)devTemplateState.roadPaint.customStamp=devTemplateDeepClone(updated);}return{copies:Math.max(0,matches.length-1),saved:saved.length};}
function devTemplateRoadSetSharedLocked(item,value){devTemplateSetRoadItemLocked(item,value);return devTemplateRoadPropagateShared(item,{locked:!!value});}
function devTemplateRoadSetSharedLayer(item,value){devTemplateSetRoadItemLayer(item,value);return devTemplateRoadPropagateShared(item,{layer:devTemplateNormalizeLayer(value,'ground')});}
function devTemplateRoadSetSharedVisual(item,visual){devTemplateSetRoadItemVisual(item,visual);return devTemplateRoadPropagateShared(item,{visual});}
function devTemplateRoadSetSharedZones(item,kind,zones){devTemplateSetRoadItemZones(item,kind,zones);return devTemplateRoadPropagateShared(item,kind==='occlusion'?{occlusionZones:zones}:{collisionZones:zones});}
function devTemplateRoadSyncZonesToCopies(item,mode='both'){if(!item)return;devTemplateHistorySetNext('Sync shared tile zones');const fields={};if(mode==='both'||mode==='collision')fields.collisionZones=item.collisionZones||[];if(mode==='both'||mode==='occlusion')fields.occlusionZones=item.occlusionZones||[];const result=devTemplateRoadPropagateShared(item,fields);devTemplatePersistDraft();devTemplateRenderCanvas();devTemplateRenderInspector();devTemplateRenderRoadControls();const what=mode==='collision'?'collision zones':mode==='occlusion'?'Behind zones':'collision + Behind zones';toast(`Synced ${what} to ${result.copies} matching placed cop${result.copies===1?'y':'ies'}${result.saved?' and the saved stamp definition':''}.`);}
function devTemplateCandidatesAt(p){
  const out=[];for(let i=devTemplateState.current.objects.length-1;i>=0;i--){const o=devTemplateState.current.objects[i],r=devTemplateObjectRect(o);if(p.x>=r.x&&p.x<=r.x+r.w&&p.y>=r.y&&p.y<=r.y+r.h)out.push({kind:'asset',id:o.id,label:o.label||devTemplateFilename(o.assetPath)});}
  const seenRoad=new Set();for(let i=devTemplateRoadLayer().tiles.length-1;i>=0;i--){const tile=devTemplateRoadLayer().tiles[i],r=devTemplateRoadTileRect(tile),key=devTemplateRoadKey(tile);if(seenRoad.has(key))continue;if(p.x>=r.x&&p.x<=r.x+r.w&&p.y>=r.y&&p.y<=r.y+r.h){seenRoad.add(key);const item=devTemplateRoadItem(key);out.push({kind:'road',id:key,label:item?.label||'Road tile'});}}
  if(devTemplateState.playerRef.shown&&Math.abs(p.x-devTemplateState.playerRef.x)<=16&&Math.abs(p.y-devTemplateState.playerRef.y)<=16)out.unshift({kind:'reference',id:'player',label:`Player reference · ${devTemplateState.playerRef.className}`});
  for(const key of ['entrance','exit']){const a=devTemplateState.current.anchors[key];if(Math.hypot(p.x-a.x,p.y-a.y)<=13)out.unshift({kind:'anchor',id:key,label:key==='entrance'?'Template entrance':'Template exit'});}
  return out;
}
function devTemplateSelectedObject(){return devTemplateState.selection?.kind==='asset'?devTemplateState.current.objects.find(o=>o.id===devTemplateState.selection.id)||null:null;}
function devTemplateSelectedRoadItem(){return devTemplateState.selection?.kind==='road'?devTemplateRoadItem(devTemplateState.selection.id):null;}
function devTemplateSelectedAnchor(){return devTemplateState.selection?.kind==='anchor'?devTemplateState.current.anchors[devTemplateState.selection.id]||null:null;}
function devTemplateSelectedReference(){return devTemplateState.selection?.kind==='reference'&&devTemplateState.selection.id==='player'?devTemplateState.playerRef:null;}
function devTemplateSelectedAssetIds(){const valid=new Set(devTemplateState.current.objects.map(o=>o.id));const ids=(devTemplateState.multiSelection||[]).filter(id=>valid.has(id));if(devTemplateState.selection?.kind==='asset'&&valid.has(devTemplateState.selection.id)&&!ids.includes(devTemplateState.selection.id))ids.push(devTemplateState.selection.id);return ids;}
function devTemplateSelectedRoadKeys(){const valid=new Set(devTemplateAllRoadItems().map(item=>item.key)),keys=(devTemplateState.multiRoadSelection||[]).filter(key=>valid.has(key));if(devTemplateState.selection?.kind==='road'&&valid.has(devTemplateState.selection.id)&&!keys.includes(devTemplateState.selection.id))keys.push(devTemplateState.selection.id);return keys;}
function devTemplateSelectedObjects(){const ids=new Set(devTemplateSelectedAssetIds());return devTemplateState.current.objects.filter(o=>ids.has(o.id));}
function devTemplateSelectedRoadItems(){return devTemplateSelectedRoadKeys().map(devTemplateRoadItem).filter(Boolean);}
function devTemplateSelectedTemplateCount(){return devTemplateSelectedAssetIds().length+devTemplateSelectedRoadKeys().length;}
function devTemplateDefaultAnchorPosition(key){const t=devTemplateState.current;return key==='entrance'?{x:Math.round(t.width/2),y:Math.max(0,t.height-24)}:{x:Math.round(t.width/2),y:Math.min(t.height,24)};}
function devTemplateSavedVersionOfSelectedObject(){const o=devTemplateSelectedObject(),saved=devTemplateState.current.id?devTemplateState.library[devTemplateState.current.id]:null;if(!o||!saved||!Array.isArray(saved.objects))return null;return saved.objects.find(v=>v.id===o.id)||null;}
function devTemplateSetSelection(selection,{additive=false,toggle=false}={}){
  if(!selection){devTemplateState.selection=null;devTemplateState.multiSelection=[];devTemplateState.multiRoadSelection=[];devTemplateHidePicker();devTemplateRenderCanvas();devTemplateRenderInspector();return;}
  if(selection.kind==='asset'){
    const id=selection.id,current=devTemplateSelectedAssetIds();if(!additive&&!toggle)devTemplateState.multiRoadSelection=[];
    if(additive||toggle){const has=current.includes(id),next=has&&toggle?current.filter(v=>v!==id):[...new Set([...current,id])];devTemplateState.multiSelection=next;if(!next.length){const roads=devTemplateSelectedRoadKeys();devTemplateState.selection=roads.length?{kind:'road',id:roads.at(-1)}:null;}else if(has&&toggle&&devTemplateState.selection?.kind==='asset'&&devTemplateState.selection.id===id)devTemplateState.selection={kind:'asset',id:next.at(-1)};else if(!has||!devTemplateState.selection)devTemplateState.selection={kind:'asset',id};}
    else{devTemplateState.selection={kind:'asset',id};devTemplateState.multiSelection=[id];}
  }else if(selection.kind==='road'){
    const id=selection.id,current=devTemplateSelectedRoadKeys();if(!additive&&!toggle)devTemplateState.multiSelection=[];
    if(additive||toggle){const has=current.includes(id),next=has&&toggle?current.filter(v=>v!==id):[...new Set([...current,id])];devTemplateState.multiRoadSelection=next;if(!next.length){const assets=devTemplateSelectedAssetIds();devTemplateState.selection=assets.length?{kind:'asset',id:assets.at(-1)}:null;}else if(has&&toggle&&devTemplateState.selection?.kind==='road'&&devTemplateState.selection.id===id)devTemplateState.selection={kind:'road',id:next.at(-1)};else if(!has||!devTemplateState.selection)devTemplateState.selection={kind:'road',id};}
    else{devTemplateState.selection={kind:'road',id};devTemplateState.multiRoadSelection=[id];}
  }else{devTemplateState.selection=selection;devTemplateState.multiSelection=[];devTemplateState.multiRoadSelection=[];}
  devTemplateHidePicker();devTemplateRenderCanvas();devTemplateRenderInspector();
}
function devTemplateSelectionRect(){const rects=[...devTemplateSelectedObjects().map(devTemplateObjectRect),...devTemplateSelectedRoadItems().map(item=>item.rect).filter(Boolean)];if(!rects.length)return null;let x1=Infinity,y1=Infinity,x2=-Infinity,y2=-Infinity;for(const r of rects){x1=Math.min(x1,r.x);y1=Math.min(y1,r.y);x2=Math.max(x2,r.x+r.w);y2=Math.max(y2,r.y+r.h);}return{x:x1,y:y1,w:Math.max(0,x2-x1),h:Math.max(0,y2-y1)};}
function devTemplateRectIntersects(a,b){return a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;}
function devTemplateHidePicker(){if(devTemplatePicker)devTemplatePicker.hidden=true;if(devTemplatePickerList)devTemplatePickerList.innerHTML='';}
function devTemplateShowPicker(candidates,clientX,clientY){
  if(!devTemplatePicker||!devTemplatePickerList)return;devTemplatePickerList.innerHTML='';for(const item of candidates){const b=document.createElement('button');b.type='button';b.textContent=item.label;b.addEventListener('click',()=>devTemplateSetSelection({kind:item.kind,id:item.id}));devTemplatePickerList.appendChild(b);}
  const r=devTemplateStage.getBoundingClientRect(),sx=devTemplateStage.scrollLeft||0,sy=devTemplateStage.scrollTop||0;devTemplatePicker.style.left=`${sx+Math.max(6,Math.min(r.width-230,clientX-r.left+8))}px`;devTemplatePicker.style.top=`${sy+Math.max(6,Math.min(r.height-180,clientY-r.top+8))}px`;devTemplatePicker.hidden=false;
}
function devTemplateRenderLibrary(){
  if(!devTemplateLibrarySelect)return;const current=devTemplateLibrarySelect.value,entries=Object.values(devTemplateState.library).sort((a,b)=>String(a.name).localeCompare(String(b.name)));devTemplateLibrarySelect.innerHTML='<option value="">Saved templates…</option>'+entries.map(t=>`<option value="${devTemplateEsc(t.id)}">${devTemplateEsc(t.name)} · ${devTemplateEsc(t.kind||'town')}</option>`).join('');if(entries.some(t=>t.id===current))devTemplateLibrarySelect.value=current;else if(devTemplateState.current.id&&entries.some(t=>t.id===devTemplateState.current.id))devTemplateLibrarySelect.value=devTemplateState.current.id;
}
function devTemplateAssetRelativePath(path){let p=String(path||'').replace(/\\/g,'/').replace(/^\.\//,'');const i=p.toLowerCase().indexOf('assets/');if(i>=0)p=p.slice(i+7);return p.replace(/^\/+/, '').toLowerCase();}
function devTemplateAssetMatchesScanFolder(path){const rel=devTemplateAssetRelativePath(path);return devTemplateState.scanFolders.some(rule=>rel===rule||rel.startsWith(`${rule}/`));}
function devTemplateRenderScanFolders(){
  if(!devTemplateScanFolderRules)return;devTemplateScanFolderRules.innerHTML='';
  for(const rule of devTemplateState.scanFolders){const chip=document.createElement('div');chip.className='dev-template-scan-folder';const label=document.createElement('code');label.textContent=`assets/${rule}/`;const remove=document.createElement('button');remove.type='button';remove.textContent='×';remove.title=`Remove assets/${rule}/ from automatic scans`;remove.addEventListener('click',()=>{if(devTemplateState.scanFolders.length<=1){toast('Keep at least one Workshop scan folder.');return;}devTemplateState.scanFolders=devTemplateState.scanFolders.filter(v=>v!==rule);devTemplatePersistScanFolders();toast(`Removed assets/${rule}/ from automatic scans. Existing catalogue entries are unchanged until Clean excluded is used.`);});chip.append(label,remove);devTemplateScanFolderRules.appendChild(chip);}
}
function devTemplateAddScanFolder(){const rule=devTemplateNormalizeScanFolder(devTemplateScanFolderInput?.value);if(!rule){toast('Enter a folder under assets, for example environment or props/trees.');return;}if(!devTemplateState.scanFolders.includes(rule)){devTemplateState.scanFolders.push(rule);devTemplateState.scanFolders.sort();devTemplatePersistScanFolders();toast(`Workshop scans will include assets/${rule}/.`);}if(devTemplateScanFolderInput)devTemplateScanFolderInput.value='';}
function devTemplateCleanExcludedAssets(){const before=devTemplateState.assets.length;devTemplateState.assets=devTemplateState.assets.filter(devTemplateAssetMatchesScanFolder);const removed=before-devTemplateState.assets.length;devTemplatePersistAssets();if(devTemplateAssetScanMeta)devTemplateAssetScanMeta.innerHTML=`Catalogue cleaned. Removed <b>${removed}</b> image${removed===1?'':'s'} outside the enabled Workshop folders.`;toast(removed?`Removed ${removed} excluded asset${removed===1?'':'s'} from the Workshop catalogue.`:'Catalogue already matches the enabled Workshop folders.');}
function devTemplateRenderAssets(){
  if(!devTemplateAssets)return;if(!devTemplateState.assets.length){devTemplateAssets.innerHTML='<div class="dev-template-inspector-empty">No registered assets yet. Use Scan Workshop Folder to discover them automatically.</div>';return;}devTemplateAssets.innerHTML='';
  const paths=[...devTemplateState.assets].sort((a,b)=>{const ca=devTemplateAssetCategory(a).toLowerCase(),cb=devTemplateAssetCategory(b).toLowerCase();return ca.localeCompare(cb)||devTemplateFilename(a).localeCompare(devTemplateFilename(b));}),groups=new Map();for(const path of paths){const category=devTemplateAssetCategory(path);if(!groups.has(category))groups.set(category,[]);groups.get(category).push(path);}const collapsed=new Set(devTemplateState.collapsedAssetCategories||[]);
  for(const [category,items] of groups){const key=String(category||'other').toLowerCase(),isCollapsed=collapsed.has(key),group=document.createElement('div');group.className='dev-template-asset-group';if(isCollapsed)group.classList.add('collapsed');const head=document.createElement('div');head.className='dev-template-asset-category';const label=document.createElement('span');label.className='dev-template-asset-category-label';label.textContent=category;const count=document.createElement('span');count.className='dev-template-asset-category-count';count.textContent=String(items.length);const toggle=document.createElement('button');toggle.type='button';toggle.className='dev-template-asset-category-toggle';toggle.textContent=isCollapsed?'+':'−';toggle.title=isCollapsed?`Expand ${category}`:`Minimize ${category}`;toggle.setAttribute('aria-expanded',String(!isCollapsed));toggle.addEventListener('click',()=>devTemplateToggleAssetCategory(category));head.addEventListener('dblclick',()=>devTemplateToggleAssetCategory(category));head.append(label,count,toggle);group.appendChild(head);const body=document.createElement('div');body.className='dev-template-asset-category-body';body.hidden=isCollapsed;
    for(const path of items){const row=document.createElement('div');row.className='dev-template-asset';const preview=document.createElement('div');preview.className='dev-template-asset-preview';const img=document.createElement('img');img.src=path;img.alt='';preview.appendChild(img);const copy=document.createElement('div');copy.className='dev-template-asset-copy';copy.innerHTML=`<b>${devTemplateEsc(devTemplateFilename(path))}</b><small>${devTemplateEsc(path)}</small>`;const actions=document.createElement('div');actions.className='dev-template-asset-actions';const add=document.createElement('button');add.type='button';if(devTemplateIsTileCategory(category)){add.textContent='Tiles';add.title='Open this sprite sheet in the Tile Painter.';add.addEventListener('click',()=>devTemplateChooseRoadSheet(path));}else{add.textContent='Add';add.addEventListener('click',()=>devTemplateAddAsset(path));}const remove=document.createElement('button');remove.type='button';remove.className='remove';remove.textContent='Unregister';remove.addEventListener('click',()=>{devTemplateState.assets=devTemplateState.assets.filter(v=>v!==path);devTemplatePersistAssets();});actions.append(add,remove);copy.appendChild(actions);row.append(preview,copy);body.appendChild(row);}group.appendChild(body);devTemplateAssets.appendChild(group);
  }
}

const devTemplateRoadSheetCache=new Map();
function devTemplateRoadAssets(){return devTemplateState.assets.filter(path=>devTemplateIsTileCategory(devTemplateAssetCategory(path))&&DEV_TEMPLATE_IMAGE_EXT.test(path)).sort((a,b)=>devTemplateFilename(a).localeCompare(devTemplateFilename(b)));}
function devTemplateRoadLayer(){let layer=devTemplateState.current.tileLayers?.find(v=>v.id==='roads');if(!layer){if(!Array.isArray(devTemplateState.current.tileLayers))devTemplateState.current.tileLayers=[];layer={id:'roads',name:'Roads',kind:'ground',tiles:[]};devTemplateState.current.tileLayers.unshift(layer);}if(!Array.isArray(layer.tiles))layer.tiles=[];return layer;}
function devTemplateRoadTileCount(){return devTemplateRoadLayer().tiles.length;}
function devTemplateRoadSheetRecord(path){path=String(path||'');if(!path)return null;const resolved=devTemplateCurrentAssetPath(path,{tilesOnly:true});if(resolved&&resolved!==path){devTemplateReplaceAssetPathEverywhere(path,resolved);path=resolved;}let rec=devTemplateRoadSheetCache.get(path);if(rec)return rec;rec={path,img:new Image(),ready:false,failed:false,width:0,height:0,fallbacks:devTemplateLegacyTilePathCandidates(path),tryingFallback:false};devTemplateRoadSheetCache.set(path,rec);rec.img.onload=()=>{rec.ready=true;rec.failed=false;rec.width=rec.img.naturalWidth||0;rec.height=rec.img.naturalHeight||0;if(rec.tryingFallback&&rec.loadedPath&&rec.loadedPath!==path){devTemplateReplaceAssetPathEverywhere(path,rec.loadedPath);devTemplateRoadSheetCache.set(rec.loadedPath,rec);}if(devTemplateState.open){devTemplateRenderRoadPalette();devTemplateRenderCanvas();}};rec.img.onerror=()=>{const next=rec.fallbacks.shift();if(next){rec.tryingFallback=true;rec.loadedPath=next;rec.img.src=next;return;}rec.failed=true;rec.ready=false;if(devTemplateState.open)devTemplateRenderRoadPalette();};rec.loadedPath=path;rec.img.src=path;return rec;}
function devTemplateRoadTileInfo(tile,rec=null){const size=Math.round(devTemplateClamp(tile?.tileSize||16,4,128)),r=rec||devTemplateRoadSheetRecord(tile?.assetPath),columns=r?.ready?Math.max(1,Math.floor(r.width/size)):1,index=Math.max(0,Math.floor(Number(tile?.tileIndex)||0));return{size,columns,sx:(index%columns)*size,sy:Math.floor(index/columns)*size};}

function devTemplateRoadWindowClamp(x,y){
  if(!devTemplateRoadWindow)return{x:0,y:0};const r=devTemplateRoadWindow.getBoundingClientRect(),vw=Math.max(1,window.innerWidth),vh=Math.max(1,window.innerHeight),keep=48,maxX=Math.max(4,vw-Math.min(r.width,keep)),maxY=Math.max(4,vh-keep);return{x:Math.max(4,Math.min(maxX,Number(x)||0)),y:Math.max(4,Math.min(maxY,Number(y)||0))};
}
function devTemplateApplyRoadWindowPosition(){
  if(!devTemplateRoadWindow)return;const state=devTemplateState.roadWindow||{};if(Number.isFinite(state.x)&&Number.isFinite(state.y)){const pos=devTemplateRoadWindowClamp(state.x,state.y);state.x=pos.x;state.y=pos.y;devTemplateRoadWindow.style.left=`${pos.x}px`;devTemplateRoadWindow.style.top=`${pos.y}px`;devTemplateRoadWindow.style.right='auto';devTemplateRoadWindow.style.bottom='auto';}else{const r=devTemplateRoadWindow.getBoundingClientRect(),x=window.innerWidth<=700?12:238,y=Math.max(12,window.innerHeight-Math.min(r.height,window.innerHeight-24)-12);devTemplateRoadWindow.style.left=`${x}px`;devTemplateRoadWindow.style.top=`${y}px`;devTemplateRoadWindow.style.right='auto';devTemplateRoadWindow.style.bottom='auto';}
}
function devTemplateResetRoadWindowPosition(){
  const minimized=!!devTemplateState.roadWindow?.minimized;devTemplateState.roadWindow={x:null,y:null,minimized,drag:null};devTemplatePersistView();devTemplateApplyRoadWindowPosition();toast('Tile Painter position reset.');
}
function devTemplateApplyRoadWindowMinimized(){if(!devTemplateRoadWindow)return;const minimized=!!devTemplateState.roadWindow?.minimized;devTemplateRoadWindow.classList.toggle('minimized',minimized);if(devTemplateRoadWindowMinimizeBtn){devTemplateRoadWindowMinimizeBtn.textContent=minimized?'+':'−';devTemplateRoadWindowMinimizeBtn.title=minimized?'Expand Tile Painter':'Minimize Tile Painter';devTemplateRoadWindowMinimizeBtn.setAttribute('aria-expanded',String(!minimized));}requestAnimationFrame(()=>devTemplateApplyRoadWindowPosition());}
function devTemplateToggleRoadWindowMinimized(){devTemplateState.roadWindow.minimized=!devTemplateState.roadWindow.minimized;devTemplatePersistView();devTemplateApplyRoadWindowMinimized();}
function devTemplateRoadWindowPointerDown(e){
  if(e.button!==0||e.target.closest('button,input,select,label'))return;if(!devTemplateRoadWindow)return;e.preventDefault();e.stopPropagation();const r=devTemplateRoadWindow.getBoundingClientRect();devTemplateState.roadWindow.drag={pointerId:e.pointerId,offsetX:e.clientX-r.left,offsetY:e.clientY-r.top};devTemplateRoadWindow.classList.add('dragging');try{devTemplateRoadWindowHead?.setPointerCapture?.(e.pointerId);}catch{}
}
function devTemplateRoadWindowPointerMove(e){
  const d=devTemplateState.roadWindow?.drag;if(!d||d.pointerId!==e.pointerId||!devTemplateRoadWindow)return;e.preventDefault();const pos=devTemplateRoadWindowClamp(e.clientX-d.offsetX,e.clientY-d.offsetY);devTemplateState.roadWindow.x=pos.x;devTemplateState.roadWindow.y=pos.y;devTemplateRoadWindow.style.left=`${pos.x}px`;devTemplateRoadWindow.style.top=`${pos.y}px`;devTemplateRoadWindow.style.right='auto';devTemplateRoadWindow.style.bottom='auto';
}
function devTemplateRoadWindowPointerFinish(e){
  const d=devTemplateState.roadWindow?.drag;if(!d||d.pointerId!==e.pointerId)return;devTemplateState.roadWindow.drag=null;devTemplateRoadWindow?.classList.remove('dragging');try{devTemplateRoadWindowHead?.releasePointerCapture?.(e.pointerId);}catch{}devTemplatePersistView();
}
function devTemplateChooseRoadSheet(path){path=String(path||'');if(!path)return;const paint=devTemplateState.roadPaint;paint.assetPath=path;paint.tileIndex=0;paint.customStamp=null;paint.selectionRect={x:0,y:0,w:1,h:1};paint.selectedIds=[];devTemplatePersistView();devTemplateRenderRoadControls();if(devTemplateRoadPaletteWrap)devTemplateRoadPaletteWrap.scrollTo({left:0,top:0});}
function devTemplateRoadNormalizeSelectionRect(rect){const src=rect&&typeof rect==='object'?rect:{x:0,y:0,w:1,h:1},x=Math.max(0,Math.floor(Number(src.x)||0)),y=Math.max(0,Math.floor(Number(src.y)||0)),w=Math.max(1,Math.floor(Number(src.w)||1)),h=Math.max(1,Math.floor(Number(src.h)||1));return{x,y,w,h};}
function devTemplateRoadCurrentPaletteRect(){return devTemplateRoadNormalizeSelectionRect(devTemplateState.roadPaint.selectionRect);}
function devTemplateRoadStampSignature(stamp){return `${stamp.assetPath}|${stamp.tileSize}|${stamp.scale}|${stamp.cols}x${stamp.rows}|${stamp.cells.map(c=>`${c.dx},${c.dy},${c.tileIndex}`).join(';')}|c:${JSON.stringify((stamp.collisionZones||[]).map(({enabled,x,y,w,h})=>({enabled,x,y,w,h})))}|o:${JSON.stringify((stamp.occlusionZones||[]).map(({enabled,x,y,w,h})=>({enabled,x,y,w,h})))}|v:${JSON.stringify(stamp.visual||{})}|l:${stamp.locked?1:0}|z:${devTemplateNormalizeLayer(stamp.layer,'ground')}`;}
function devTemplateRoadStampFromPalette(){const paint=devTemplateState.roadPaint,rec=devTemplateRoadSheetRecord(paint.assetPath);if(!paint.assetPath||!rec?.ready)return null;const tileSize=Math.round(devTemplateClamp(paint.tileSize,4,128)),cols=Math.max(1,Math.floor(rec.width/tileSize)),rows=Math.max(1,Math.floor(rec.height/tileSize)),rect=devTemplateRoadCurrentPaletteRect(),cells=[];for(let dy=0;dy<rect.h;dy++)for(let dx=0;dx<rect.w;dx++){const col=rect.x+dx,row=rect.y+dy;if(col<0||row<0||col>=cols||row>=rows)continue;cells.push({dx,dy,tileIndex:row*cols+col});}if(!cells.length)return null;return{id:devTemplateId('stamp'),name:`${devTemplateFilename(paint.assetPath)} ${rect.w}×${rect.h}`,assetPath:paint.assetPath,tileSize,scale:devTemplateClamp(paint.scale,1,4),cols:rect.w,rows:rect.h,cells,locked:false,layer:'ground',visual:devTemplateDefaultVisual(),collisionZones:[],occlusionZones:[]};}
function devTemplateRoadActiveStamp(){const paint=devTemplateState.roadPaint;if(paint.customStamp?.cells?.length)return devTemplateDeepClone(paint.customStamp);return devTemplateRoadStampFromPalette();}
function devTemplateRoadRememberRecent(stamp){if(!stamp?.cells?.length)return;const paint=devTemplateState.roadPaint,sig=devTemplateRoadStampSignature(stamp);paint.recentStamps=[stamp,...(paint.recentStamps||[]).filter(s=>devTemplateRoadStampSignature(s)!==sig)].slice(0,8);}
function devTemplateRoadApplyStamp(stamp,{remember=true}={}){if(!stamp?.assetPath||!stamp?.cells?.length)return;const paint=devTemplateState.roadPaint;paint.assetPath=String(stamp.assetPath);paint.tileSize=Math.round(devTemplateClamp(stamp.tileSize||16,4,128));paint.scale=devTemplateClamp(stamp.scale||2,1,4);paint.customStamp=devTemplateDeepClone({id:String(stamp.id||devTemplateId('stamp')),name:String(stamp.name||'Tile stamp').slice(0,60),assetPath:paint.assetPath,tileSize:paint.tileSize,scale:paint.scale,cols:Math.max(1,Math.floor(Number(stamp.cols)||1)),rows:Math.max(1,Math.floor(Number(stamp.rows)||1)),locked:!!stamp.locked,layer:devTemplateNormalizeLayer(stamp.layer,'ground'),cells:stamp.cells.map(c=>({dx:Math.max(0,Math.floor(Number(c.dx)||0)),dy:Math.max(0,Math.floor(Number(c.dy)||0)),tileIndex:Math.max(0,Math.floor(Number(c.tileIndex)||0))})),visual:devTemplateDeepClone(stamp.visual||devTemplateDefaultVisual()),collisionZones:devTemplateSanitizeZones(stamp.collisionZones,4096,4096),occlusionZones:devTemplateSanitizeZones(stamp.occlusionZones,4096,4096)});paint.selectionRect={x:0,y:0,w:paint.customStamp.cols,h:paint.customStamp.rows};paint.tileIndex=Math.max(0,paint.customStamp.cells[0]?.tileIndex||0);if(remember)devTemplateRoadRememberRecent(paint.customStamp);devTemplatePersistView();devTemplateRenderRoadControls();devTemplateRenderCanvas();}
function devTemplateRoadSaveCurrentStamp(){const stamp=devTemplateRoadInheritStampDefaults(devTemplateRoadActiveStamp());if(!stamp?.cells?.length){toast('Choose one or more road tiles first.');return;}const name=prompt('Name this tile stamp:',stamp.name||`${stamp.cols}×${stamp.rows} stamp`);if(name===null)return;stamp.name=String(name||'Tile stamp').trim().slice(0,60)||'Tile stamp';const paint=devTemplateState.roadPaint,sig=devTemplateRoadStampSignature(stamp);paint.savedStamps=[stamp,...(paint.savedStamps||[]).filter(s=>devTemplateRoadStampSignature(s)!==sig)].slice(0,24);paint.customStamp=devTemplateDeepClone(stamp);devTemplatePersistRoadStamps();devTemplateRenderRoadControls();toast(`Saved tile stamp “${stamp.name}”. It is now the active linked stamp brush.`);}
function devTemplateRoadDeleteSavedStamp(id){const paint=devTemplateState.roadPaint,before=(paint.savedStamps||[]).length;paint.savedStamps=(paint.savedStamps||[]).filter(s=>s.id!==id);if((paint.savedStamps||[]).length!==before){devTemplatePersistRoadStamps();devTemplateRenderRoadControls();}}
function devTemplateRenderRoadStampList(target,items,{saved=false}={}){if(!target)return;target.innerHTML='';if(!items?.length){target.innerHTML='<div class="dev-template-road-empty">None yet.</div>';return;}for(const stamp of items){const row=document.createElement('div');row.className='dev-template-road-stamp';const info=document.createElement('button');info.type='button';info.className='stamp';info.innerHTML=`<b>${devTemplateEsc(stamp.name||'Road stamp')}</b><small>${stamp.cols}×${stamp.rows} · ${devTemplateEsc(devTemplateFilename(stamp.assetPath))} · ${stamp.scale}×</small>`;info.addEventListener('click',()=>devTemplateRoadApplyStamp(stamp));row.appendChild(info);if(saved){const remove=document.createElement('button');remove.type='button';remove.className='remove';remove.textContent='×';remove.title='Delete saved road stamp';remove.addEventListener('click',()=>devTemplateRoadDeleteSavedStamp(stamp.id));row.appendChild(remove);}target.appendChild(row);}}
function devTemplateRenderRoadPreview(){const canvas=devTemplateRoadPreview,stamp=devTemplateRoadActiveStamp();if(!canvas)return;const ctx=canvas.getContext('2d');ctx.clearRect(0,0,canvas.width,canvas.height);ctx.imageSmoothingEnabled=false;ctx.fillStyle='#0b1214';ctx.fillRect(0,0,canvas.width,canvas.height);if(!stamp?.cells?.length)return;const rec=devTemplateRoadSheetRecord(stamp.assetPath);const base=Math.max(1,stamp.tileSize),pad=8,scale=Math.max(1,Math.floor(Math.min((canvas.width-pad*2)/(stamp.cols*base),(canvas.height-pad*2)/(stamp.rows*base))));const offX=Math.floor((canvas.width-stamp.cols*base*scale)/2),offY=Math.floor((canvas.height-stamp.rows*base*scale)/2);ctx.strokeStyle='rgba(233,207,135,.16)';for(let x=0;x<=stamp.cols;x++){ctx.beginPath();ctx.moveTo(offX+x*base*scale+.5,offY);ctx.lineTo(offX+x*base*scale+.5,offY+stamp.rows*base*scale);ctx.stroke();}for(let y=0;y<=stamp.rows;y++){ctx.beginPath();ctx.moveTo(offX,offY+y*base*scale+.5);ctx.lineTo(offX+stamp.cols*base*scale,offY+y*base*scale+.5);ctx.stroke();}if(rec?.ready){for(const cell of stamp.cells){const tile={tileSize:stamp.tileSize,tileIndex:cell.tileIndex},info=devTemplateRoadTileInfo(tile,rec);ctx.drawImage(rec.img,info.sx,info.sy,info.size,info.size,offX+cell.dx*base*scale,offY+cell.dy*base*scale,base*scale,base*scale);}}else{ctx.fillStyle='rgba(194,79,66,.30)';for(const cell of stamp.cells)ctx.fillRect(offX+cell.dx*base*scale,offY+cell.dy*base*scale,base*scale,base*scale);}ctx.strokeStyle='rgba(255,215,112,.9)';ctx.strokeRect(offX+.5,offY+.5,stamp.cols*base*scale,stamp.rows*base*scale);}
function devTemplateRenderRoadControls(){devTemplateApplyRoadWindowPosition();devTemplateApplyRoadWindowMinimized();if(!devTemplateRoadSheet)return;const assets=devTemplateRoadAssets(),paint=devTemplateState.roadPaint;if(!assets.includes(paint.assetPath))paint.assetPath=assets[0]||'';devTemplateRoadSheet.innerHTML=assets.length?assets.map(path=>`<option value="${devTemplateEsc(path)}">${devTemplateEsc(devTemplateFilename(path))}</option>`).join(''):'<option value="">No tile sheets scanned</option>';devTemplateRoadSheet.value=paint.assetPath||'';if(devTemplateRoadTileSize)devTemplateRoadTileSize.value=String(paint.tileSize);if(devTemplateRoadScale)devTemplateRoadScale.value=String(paint.scale);if(devTemplateRoadPaletteZoom)devTemplateRoadPaletteZoom.value=String(paint.paletteZoom);if(devTemplateRoadPaintBtn)devTemplateRoadPaintBtn.classList.toggle('active',paint.active&&paint.mode==='paint');if(devTemplateRoadEraseBtn)devTemplateRoadEraseBtn.classList.toggle('active',paint.active&&paint.mode==='erase');if(devTemplateRoadSelectBtn)devTemplateRoadSelectBtn.classList.toggle('active',paint.active&&paint.mode==='select');if(devTemplateRoadEyedropBtn)devTemplateRoadEyedropBtn.classList.toggle('active',paint.active&&paint.mode==='eyedropper');if(devTemplateRoadStopBtn)devTemplateRoadStopBtn.classList.toggle('active',!paint.active);devTemplateWorkshop?.classList.toggle('road-painting',!!paint.active);devTemplateRenderRoadPalette();devTemplateRenderRoadPreview();devTemplateRenderRoadStampList(devTemplateRoadSaved,paint.savedStamps||[],{saved:true});devTemplateRenderRoadStampList(devTemplateRoadRecent,paint.recentStamps||[]);}
function devTemplateRenderRoadPalette(){const canvas=devTemplateRoadPalette,empty=devTemplateRoadPaletteEmpty,meta=devTemplateRoadMeta,paint=devTemplateState.roadPaint;if(!canvas)return;const path=paint.assetPath,rec=devTemplateRoadSheetRecord(path);if(!path||!rec?.ready){canvas.width=1;canvas.height=1;canvas.style.width='1px';canvas.style.height='1px';if(empty){empty.hidden=false;empty.innerHTML=path?(rec?.failed?'Tile sheet could not be loaded from the project path.':'Loading road sheet…'):'Put sprite-sheet PNGs in <code>assets/tiles/</code> (legacy <code>assets/roads/</code> is also supported), then scan the Workshop folder.';}if(meta)meta.textContent='No tile selected.';devTemplateRenderRoadPreview();return;}if(empty)empty.hidden=true;const tileSize=Math.round(devTemplateClamp(paint.tileSize,4,128)),cols=Math.max(1,Math.floor(rec.width/tileSize)),rows=Math.max(1,Math.floor(rec.height/tileSize));const rect=devTemplateRoadCurrentPaletteRect();paint.tileIndex=Math.max(0,Math.min(cols*rows-1,rect.y*cols+rect.x));canvas.width=rec.width;canvas.height=rec.height;canvas.style.width=`${Math.round(rec.width*paint.paletteZoom)}px`;canvas.style.height=`${Math.round(rec.height*paint.paletteZoom)}px`;const ctx=canvas.getContext('2d');ctx.clearRect(0,0,canvas.width,canvas.height);ctx.imageSmoothingEnabled=false;ctx.drawImage(rec.img,0,0);ctx.save();ctx.strokeStyle='rgba(230,224,202,.18)';ctx.lineWidth=1;ctx.beginPath();for(let x=tileSize;x<rec.width;x+=tileSize){ctx.moveTo(x+.5,0);ctx.lineTo(x+.5,rec.height);}for(let y=tileSize;y<rec.height;y+=tileSize){ctx.moveTo(0,y+.5);ctx.lineTo(rec.width,y+.5);}ctx.stroke();ctx.fillStyle='rgba(255,215,112,.08)';ctx.fillRect(rect.x*tileSize,rect.y*tileSize,rect.w*tileSize,rect.h*tileSize);ctx.strokeStyle='rgba(255,215,112,.98)';ctx.lineWidth=2;ctx.strokeRect(rect.x*tileSize+1,rect.y*tileSize+1,Math.max(1,rect.w*tileSize-2),Math.max(1,rect.h*tileSize-2));ctx.restore();if(meta){const stamp=devTemplateRoadActiveStamp(),rendered=Math.round(tileSize*paint.scale),selected=stamp?`${stamp.cols}×${stamp.rows}`:'1×1',linked=(devTemplateState.roadPaint.selectedIds||[]).length?` · linked selection ${(devTemplateState.roadPaint.selectedIds||[]).length} tile${(devTemplateState.roadPaint.selectedIds||[]).length===1?'':'s'}`:'';meta.innerHTML=`<b>${devTemplateEsc(devTemplateFilename(path))}</b> · brush ${selected} · source ${tileSize}×${tileSize}px → ${rendered}×${rendered}px per tile at ${paint.scale}× · ${devTemplateRoadTileCount()} placed${linked}`;}devTemplatePersistView();devTemplateRenderRoadPreview();}
function devTemplateRoadPaletteStart(e){const canvas=devTemplateRoadPalette,paint=devTemplateState.roadPaint,rec=devTemplateRoadSheetRecord(paint.assetPath);if(!canvas||!rec?.ready||e.button!==0)return;e.preventDefault();const r=canvas.getBoundingClientRect(),sx=(e.clientX-r.left)*(canvas.width/Math.max(1,r.width)),sy=(e.clientY-r.top)*(canvas.height/Math.max(1,r.height)),size=Math.round(devTemplateClamp(paint.tileSize,4,128)),cols=Math.max(1,Math.floor(rec.width/size)),rows=Math.max(1,Math.floor(rec.height/size)),col=Math.max(0,Math.min(cols-1,Math.floor(sx/size))),row=Math.max(0,Math.min(rows-1,Math.floor(sy/size)));paint.palettePointerId=e.pointerId;paint.paletteDrag={startCol:col,startRow:row,col,row};paint.customStamp=null;paint.selectionRect={x:col,y:row,w:1,h:1};canvas.setPointerCapture?.(e.pointerId);devTemplateRenderRoadPalette();}
function devTemplateRoadPaletteMove(e){const canvas=devTemplateRoadPalette,paint=devTemplateState.roadPaint,drag=paint.paletteDrag,rec=devTemplateRoadSheetRecord(paint.assetPath);if(!canvas||!drag||paint.palettePointerId!==e.pointerId||!rec?.ready)return;const r=canvas.getBoundingClientRect(),sx=(e.clientX-r.left)*(canvas.width/Math.max(1,r.width)),sy=(e.clientY-r.top)*(canvas.height/Math.max(1,r.height)),size=Math.round(devTemplateClamp(paint.tileSize,4,128)),cols=Math.max(1,Math.floor(rec.width/size)),rows=Math.max(1,Math.floor(rec.height/size)),col=Math.max(0,Math.min(cols-1,Math.floor(sx/size))),row=Math.max(0,Math.min(rows-1,Math.floor(sy/size)));drag.col=col;drag.row=row;paint.selectionRect={x:Math.min(drag.startCol,col),y:Math.min(drag.startRow,row),w:Math.abs(col-drag.startCol)+1,h:Math.abs(row-drag.startRow)+1};devTemplateRenderRoadPalette();}
function devTemplateRoadPaletteFinish(e){const paint=devTemplateState.roadPaint;if(paint.palettePointerId!==e.pointerId)return;paint.palettePointerId=null;paint.paletteDrag=null;try{devTemplateRoadPalette.releasePointerCapture?.(e.pointerId);}catch{}devTemplateRoadRememberRecent(devTemplateRoadActiveStamp());devTemplateRenderRoadControls();}
function devTemplateRoadSetMode(mode){const paint=devTemplateState.roadPaint;if(mode==='stop'){paint.active=false;paint.pointerId=null;paint.lastKey='';paint.hover=null;paint.selectedIds=[];}else{if(!paint.assetPath){toast('Scan assets/tiles/ and choose a tile sheet first.');return;}paint.active=true;paint.mode=(mode==='erase'||mode==='select'||mode==='eyedropper')?mode:'paint';paint.pointerId=null;paint.lastKey='';paint.hover=null;devTemplateState.selection=null;devTemplateState.multiSelection=[];devTemplateState.multiRoadSelection=[];devTemplateHidePicker();}devTemplateRenderRoadControls();devTemplateRenderCanvas();devTemplateRenderInspector();}
function devTemplateRoadTileRect(tile){const s=(Number(tile.tileSize)||16)*(Number(tile.scale)||1);return{x:Number(tile.x)||0,y:Number(tile.y)||0,w:s,h:s};}
function devTemplateRoadTilesAt(p){const tiles=devTemplateRoadLayer().tiles,out=[];for(let i=tiles.length-1;i>=0;i--){const t=tiles[i],r=devTemplateRoadTileRect(t);if(p.x>=r.x&&p.x<r.x+r.w&&p.y>=r.y&&p.y<r.y+r.h)out.push(t);}return out;}
function devTemplateRoadSelectedTiles(){const ids=new Set(devTemplateState.roadPaint.selectedIds||[]);return devTemplateRoadLayer().tiles.filter(t=>ids.has(t.id));}
function devTemplateRoadSelectionBounds(){const tiles=devTemplateRoadSelectedTiles();if(!tiles.length)return null;let x1=Infinity,y1=Infinity,x2=-Infinity,y2=-Infinity;for(const tile of tiles){const r=devTemplateRoadTileRect(tile);x1=Math.min(x1,r.x);y1=Math.min(y1,r.y);x2=Math.max(x2,r.x+r.w);y2=Math.max(y2,r.y+r.h);}return{x:x1,y:y1,w:x2-x1,h:y2-y1};}
function devTemplateRoadClearSelection(){devTemplateState.roadPaint.selectedIds=[];}
function devTemplateRoadSelectFromTile(tile){if(!tile){devTemplateRoadClearSelection();return false;}const tiles=devTemplateRoadLayer().tiles;devTemplateState.roadPaint.selectedIds=(tile.groupId?tiles.filter(t=>t.groupId===tile.groupId):[tile]).map(t=>t.id);return true;}
function devTemplateRoadRemoveByIds(ids){if(!ids?.length)return false;const set=new Set(ids),layer=devTemplateRoadLayer(),before=layer.tiles.length;layer.tiles=layer.tiles.filter(t=>!set.has(t.id));return layer.tiles.length!==before;}
function devTemplateRoadEraseAt(p){const hit=devTemplateRoadTilesAt(p)[0];if(!hit)return false;if(hit.groupId)return devTemplateRoadRemoveByIds(devTemplateRoadLayer().tiles.filter(t=>t.groupId===hit.groupId).map(t=>t.id));return devTemplateRoadRemoveByIds([hit.id]);}
function devTemplateRoadInheritStampDefaults(stamp){if(!stamp?.cells?.length)return stamp;const direct=stamp.id?devTemplateRoadSavedStampById(stamp.id):null;if(direct)return{...stamp,locked:!!direct.locked,layer:devTemplateNormalizeLayer(direct.layer,'ground'),visual:devTemplateDeepClone(direct.visual||devTemplateDefaultVisual()),collisionZones:devTemplateDeepClone(direct.collisionZones||[]),occlusionZones:devTemplateDeepClone(direct.occlusionZones||[])};const sig=devTemplateRoadStampStructureSignature(stamp),existing=devTemplateAllRoadItems().find(item=>devTemplateRoadStructureSignature(item)===sig);if(!existing)return stamp;return{...stamp,locked:!!existing.locked,layer:devTemplateNormalizeLayer(existing.layer,'ground'),visual:devTemplateDeepClone(existing.visual||devTemplateDefaultVisual()),collisionZones:devTemplateDeepClone(existing.collisionZones||[]),occlusionZones:devTemplateDeepClone(existing.occlusionZones||[])};}
function devTemplateRoadPaintAt(p){const paint=devTemplateState.roadPaint;if(!paint.active)return false;if(paint.mode==='erase')return devTemplateRoadEraseAt(p);const stamp=devTemplateRoadInheritStampDefaults(devTemplateRoadActiveStamp());if(!stamp?.cells?.length)return false;const unit=Math.max(1,Math.round(stamp.tileSize*stamp.scale)),x=Math.floor(p.x/unit)*unit,y=Math.floor(p.y/unit)*unit,key=`${paint.mode}:${x}:${y}:${devTemplateRoadStampSignature(stamp)}`;if(key===paint.lastKey)return false;paint.lastKey=key;const layer=devTemplateRoadLayer(),tiles=layer.tiles,groupId=devTemplateId('roadgrp'),label=String(stamp.name||((stamp.cells.length>1?'Tile stamp · ':'Tile · ')+devTemplateFilename(stamp.assetPath).replace(/\.[^.]+$/,''))).slice(0,80),visual=devTemplateDeepClone(stamp.visual||devTemplateDefaultVisual()),collisionZones=devTemplateSanitizeZones(stamp.collisionZones,4096,4096),occlusionZones=devTemplateSanitizeZones(stamp.occlusionZones,4096,4096);for(const cell of stamp.cells){const tx=x+cell.dx*unit,ty=y+cell.dy*unit;for(let i=tiles.length-1;i>=0;i--){if(Math.abs(Number(tiles[i].x)-tx)<.001&&Math.abs(Number(tiles[i].y)-ty)<.001)tiles.splice(i,1);}tiles.push({id:devTemplateId('tile'),groupId,sourceStampId:(paint.customStamp?.id&&devTemplateRoadSavedStampById(paint.customStamp.id))?String(paint.customStamp.id):'',label,locked:!!stamp.locked,layer:devTemplateNormalizeLayer(stamp.layer,'ground'),visual:devTemplateDeepClone(visual),collisionZones:devTemplateDeepClone(collisionZones),occlusionZones:devTemplateDeepClone(occlusionZones),assetPath:stamp.assetPath,tileIndex:cell.tileIndex,tileSize:stamp.tileSize,x:tx,y:ty,scale:stamp.scale});}if(tiles.length>12000)tiles.splice(0,tiles.length-12000);return true;}
function devTemplateRoadEyedropAt(p){const hit=devTemplateRoadTilesAt(p)[0];if(!hit)return false;devTemplateRoadApplyStamp({id:devTemplateId('stamp'),name:`Picked ${devTemplateFilename(hit.assetPath)}`,assetPath:hit.assetPath,tileSize:hit.tileSize,scale:hit.scale,cols:1,rows:1,cells:[{dx:0,dy:0,tileIndex:hit.tileIndex}]});devTemplateRoadSetMode('paint');toast('Road brush picked from the template.');return true;}
function devTemplateRoadPointerStart(e,p){const paint=devTemplateState.roadPaint;if(!paint.active)return false;e.preventDefault();paint.pointerId=e.pointerId;paint.lastKey='';paint.hover=p;if(paint.mode==='select'){const hit=devTemplateRoadTilesAt(p)[0];if(!hit){devTemplateRoadClearSelection();devTemplateSetSelection(null);devTemplateCanvas.setPointerCapture?.(e.pointerId);return true;}devTemplateRoadSelectFromTile(hit);const key=devTemplateRoadKey(hit);devTemplateSetSelection({kind:'road',id:key});const item=devTemplateRoadItem(key);if(item?.locked){paint.pointerId=null;toast('That road piece is position-locked.');return true;}const origins={};for(const tile of devTemplateRoadSelectedTiles())origins[tile.id]={x:tile.x,y:tile.y};devTemplateState.drag={pointerId:e.pointerId,kind:'road-group',startX:p.x,startY:p.y,origins};devTemplateCanvas.setPointerCapture?.(e.pointerId);devTemplateRenderCanvas();devTemplateRenderInspector();return true;}if(paint.mode==='eyedropper'){paint.pointerId=null;devTemplateRoadEyedropAt(p);return true;}paint.strokeGroupId=devTemplateId('roadgrp');devTemplateRoadRememberRecent(devTemplateRoadActiveStamp());if(devTemplateRoadPaintAt(p))devTemplateRenderCanvas();devTemplateCanvas.setPointerCapture?.(e.pointerId);return true;}
function devTemplateRoadPointerMove(e,p){const paint=devTemplateState.roadPaint;if(!paint.active)return false;paint.hover=p;if(paint.pointerId===e.pointerId){if(paint.mode==='select'&&devTemplateState.drag?.kind==='road-group'){const selected=devTemplateRoadSelectedTiles();if(selected.length){const unit=Math.max(1,Math.round(((selected[0].tileSize)||paint.tileSize)*((selected[0].scale)||paint.scale))),dx=Math.round((p.x-devTemplateState.drag.startX)/unit)*unit,dy=Math.round((p.y-devTemplateState.drag.startY)/unit)*unit;for(const tile of selected){const origin=devTemplateState.drag.origins?.[tile.id];if(origin){tile.x=origin.x+dx;tile.y=origin.y+dy;}}devTemplateRequestCanvasRender();}return true;}if((paint.mode==='paint'||paint.mode==='erase')&&devTemplateRoadPaintAt(p))devTemplateRequestCanvasRender();return true;}devTemplateRequestCanvasRender();return false;}
function devTemplateRoadPointerFinish(e){const paint=devTemplateState.roadPaint;if(!paint.active)return false;if(paint.pointerId!==e.pointerId)return false;paint.pointerId=null;paint.lastKey='';paint.strokeGroupId='';try{devTemplateCanvas.releasePointerCapture?.(e.pointerId);}catch{}if(devTemplateState.drag?.pointerId===e.pointerId&&devTemplateState.drag.kind==='road-group')devTemplateState.drag=null;devTemplateHistorySetNext(paint.mode==='erase'?'Erase tile pieces':paint.mode==='select'?'Move tile piece':'Paint tile stamp');devTemplatePersistDraft();devTemplateRenderCanvas();devTemplateRenderRoadControls();devTemplateRenderInspector();return true;}
function devTemplateSyncMetaControls(){
  const t=devTemplateState.current,z=Math.max(.5,Math.min(6,Number(devTemplateState.zoom)||1)),inv=1/z;if(devTemplateNameInput)devTemplateNameInput.value=t.name;if(devTemplateKindSelect)devTemplateKindSelect.value=t.kind;if(devTemplateWidthInput)devTemplateWidthInput.value=t.width;if(devTemplateHeightInput)devTemplateHeightInput.value=t.height;if(devTemplateCanvas){devTemplateCanvas.style.width=`${t.width}px`;devTemplateCanvas.style.height=`${t.height}px`;devTemplateCanvas.style.transform=`scale(${z})`;devTemplateCanvas.style.setProperty('--dev-inv-zoom',String(inv));devTemplateCanvas.style.setProperty('--dev-guide-px',`${inv}px`);}if(devTemplateCanvasShell){devTemplateCanvasShell.style.width=`${Math.ceil(t.width*z)}px`;devTemplateCanvasShell.style.height=`${Math.ceil(t.height*z)}px`;}if(devTemplateZoom)devTemplateZoom.value=String(z);if(devTemplateZoomReadout)devTemplateZoomReadout.textContent=`${Math.round(z*100)}%`;if(devTemplatePixelGrid){devTemplatePixelGrid.checked=!!devTemplateState.pixelGrid;devTemplatePixelGrid.disabled=z<3;devTemplatePixelGrid.title=z<3?'Pixel grid becomes useful at 300% zoom or higher.':'Show individual source-pixel boundaries.';}if(devTemplateShowPlayerRef)devTemplateShowPlayerRef.checked=!!devTemplateState.playerRef.shown;if(devTemplatePlayerRefClass)devTemplatePlayerRefClass.value=devTemplateState.playerRef.className;if(devTemplateSnap)devTemplateSnap.value=String(devTemplateState.snap||1);
}
function devTemplateScreenAlignedRect(x,y,w,h){const z=Math.max(.5,Math.min(6,Number(devTemplateState.zoom)||1)),snap=n=>Math.round(Number(n||0)*z)/z,x1=snap(x),y1=snap(y),x2=snap(Number(x||0)+Number(w||0)),y2=snap(Number(y||0)+Number(h||0));return{x:x1,y:y1,w:Math.max(1/z,x2-x1),h:Math.max(1/z,y2-y1)};}
function devTemplateScreenAlignedPoint(x,y){const z=Math.max(.5,Math.min(6,Number(devTemplateState.zoom)||1));return{x:Math.round(Number(x||0)*z)/z,y:Math.round(Number(y||0)*z)/z};}
function devTemplateRequestCanvasRender(){if(devTemplateRenderRaf)return;devTemplateRenderRaf=requestAnimationFrame(()=>{devTemplateRenderRaf=0;devTemplateRenderCanvas();});}
function devTemplateRenderCanvas(){
  if(!devTemplateCanvas)return;devTemplateSyncMetaControls();devTemplateCanvas.innerHTML='';const frag=document.createDocumentFragment();const overlaps=devTemplateVisualOverlaps(),selectedAssetIds=new Set(devTemplateSelectedAssetIds()),normalRoadSelectedIds=new Set(devTemplateSelectedRoadItems().flatMap(item=>item.tiles.map(t=>t.id))),selectedRoadIds=new Set([...(devTemplateState.roadPaint.selectedIds||[]),...normalRoadSelectedIds]);
  const allRoadItems=devTemplateAllRoadItems(),roadItemByTile=new Map();for(const item of allRoadItems)for(const tile of item.tiles)roadItemByTile.set(tile.id,item);const playerRefSize=Math.round(32*(Number(api.getPlayerVisualScale?.())||1)),playerFeet={x:devTemplateState.playerRef.x,y:devTemplateState.playerRef.y+playerRefSize/2-2};const roadTiles=devTemplateRoadLayer().tiles;for(const tile of roadTiles){const rec=devTemplateRoadSheetRecord(tile.assetPath),info=devTemplateRoadTileInfo(tile,rec),scale=Number(tile.scale)||1,rendered=info.size*scale,el=document.createElement('div'),visual=tile.visual||devTemplateDefaultVisual(),roadItem=roadItemByTile.get(tile.id),occludesRef=devTemplateState.playerRef.shown&&roadItem&&devTemplateRoadPointInOcclusion(roadItem,playerFeet);el.className='dev-template-road-tile';if(selectedRoadIds.has(tile.id))el.classList.add('selected');if(tile.locked)el.classList.add('locked');Object.assign(el.style,{left:`${Number(tile.x)||0}px`,top:`${Number(tile.y)||0}px`,width:`${rendered}px`,height:`${rendered}px`,filter:`brightness(${visual.brightness}) saturate(${visual.saturation})`,zIndex:String(occludesRef?5:devTemplateLayerZ(tile.layer))});if(rec?.ready){const sheetUrl=`url("${String(tile.assetPath).replace(/"/g,'\"')}")`,sheetSize=`${rec.width*scale}px ${rec.height*scale}px`,sheetPos=`${-info.sx*scale}px ${-info.sy*scale}px`;el.style.backgroundImage=sheetUrl;el.style.backgroundSize=sheetSize;el.style.backgroundPosition=sheetPos;if((Number(visual.tintStrength)||0)>0){const tint=document.createElement('div');tint.className='dev-template-road-tint';tint.style.background=visual.tint||'#71806f';tint.style.opacity=String(devTemplateClamp(visual.tintStrength,0,.8));tint.style.maskImage=sheetUrl;tint.style.webkitMaskImage=sheetUrl;tint.style.maskSize=sheetSize;tint.style.webkitMaskSize=sheetSize;tint.style.maskPosition=sheetPos;tint.style.webkitMaskPosition=sheetPos;tint.style.maskRepeat='no-repeat';tint.style.webkitMaskRepeat='no-repeat';el.appendChild(tint);}}else el.classList.add('missing');frag.appendChild(el);}const selectedRoadKeysForZones=new Set(devTemplateSelectedRoadKeys());for(const item of allRoadItems){const scale=Math.max(.01,Number(item.scale)||1),showCol=devTemplateState.showCollision||selectedRoadKeysForZones.has(item.key),showOcc=devTemplateState.showOcclusion||selectedRoadKeysForZones.has(item.key);if(showCol)for(const q of item.collisionZones||[])if(q?.enabled){const el=document.createElement('div'),r=devTemplateScreenAlignedRect(item.rect.x+q.x*scale,item.rect.y+q.y*scale,q.w*scale,q.h*scale);el.className='dev-template-collision dev-template-road-region';Object.assign(el.style,{left:`${r.x}px`,top:`${r.y}px`,width:`${r.w}px`,height:`${r.h}px`});frag.appendChild(el);}if(showOcc)for(const q of item.occlusionZones||[])if(q?.enabled){const el=document.createElement('div'),r=devTemplateScreenAlignedRect(item.rect.x+q.x*scale,item.rect.y+q.y*scale,q.w*scale,q.h*scale);el.className='dev-template-occlusion dev-template-road-region';Object.assign(el.style,{left:`${r.x}px`,top:`${r.y}px`,width:`${r.w}px`,height:`${r.h}px`});frag.appendChild(el);}}if(devTemplateState.roadPaint.active){const stamp=devTemplateRoadActiveStamp(),unit=Math.max(1,Math.round((stamp?.tileSize||devTemplateState.roadPaint.tileSize)*(stamp?.scale||devTemplateState.roadPaint.scale))),grid=document.createElement('div');grid.className='dev-template-road-grid-hint';grid.style.backgroundSize=`${unit}px ${unit}px`;frag.appendChild(grid);if(devTemplateState.roadPaint.mode==='paint'&&devTemplateState.roadPaint.hover&&stamp?.cells?.length){const baseX=Math.floor(devTemplateState.roadPaint.hover.x/unit)*unit,baseY=Math.floor(devTemplateState.roadPaint.hover.y/unit)*unit;for(const cell of stamp.cells){const rec=devTemplateRoadSheetRecord(stamp.assetPath),info=devTemplateRoadTileInfo({tileSize:stamp.tileSize,tileIndex:cell.tileIndex},rec),ghost=document.createElement('div');ghost.className='dev-template-road-tile ghost';Object.assign(ghost.style,{left:`${baseX+cell.dx*unit}px`,top:`${baseY+cell.dy*unit}px`,width:`${unit}px`,height:`${unit}px`});if(rec?.ready){ghost.style.backgroundImage=`url("${String(stamp.assetPath).replace(/"/g,'\"')}")`;ghost.style.backgroundSize=`${rec.width*stamp.scale}px ${rec.height*stamp.scale}px`;ghost.style.backgroundPosition=`${-info.sx*stamp.scale}px ${-info.sy*stamp.scale}px`;}frag.appendChild(ghost);}}}if(!devTemplateState.roadPaint.active&&(Number(devTemplateState.snap)||1)>1){const moveGrid=document.createElement('div');moveGrid.className='dev-template-move-grid';moveGrid.style.backgroundSize=`${devTemplateState.snap}px ${devTemplateState.snap}px`;frag.appendChild(moveGrid);}
  for(const o of devTemplateState.current.objects){const size=devTemplateObjectSize(o),el=document.createElement('div');el.className='dev-template-object';if(o.locked)el.classList.add('locked');if(selectedAssetIds.has(o.id))el.classList.add('selected');if(overlaps.has(o.id))el.classList.add('overlap-warning');el.dataset.templateId=o.id;const objectSelected=selectedAssetIds.has(o.id),showObjectCol=devTemplateState.showCollision||objectSelected,showObjectOcc=devTemplateState.showOcclusion||objectSelected,showObjectDoor=devTemplateState.showDoors||objectSelected,occludesRef=devTemplateState.playerRef.shown&&devTemplatePointInOcclusion(o,{x:devTemplateState.playerRef.x,y:devTemplateState.playerRef.y+playerRefSize/2-2});Object.assign(el.style,{left:`${o.x}px`,top:`${o.y}px`,width:`${size.w}px`,height:`${size.h}px`,zIndex:String(occludesRef?5:devTemplateLayerZ(o.layer))});const img=document.createElement('img');img.src=o.assetPath;img.alt='';img.draggable=false;const visual=o.visual||devTemplateDefaultVisual();img.style.filter=`brightness(${visual.brightness}) saturate(${visual.saturation})`;img.addEventListener('load',()=>devTemplateLearnDimensions(o,img));img.addEventListener('error',()=>{if(!el.querySelector('.dev-template-object-missing')){const miss=document.createElement('div');miss.className='dev-template-object-missing';miss.textContent='Asset not found';el.appendChild(miss);}});el.appendChild(img);if((Number(visual.tintStrength)||0)>0){const tint=document.createElement('div');tint.className='dev-template-object-tint';tint.style.background=visual.tint||'#71806f';tint.style.opacity=String(devTemplateClamp(visual.tintStrength,0,.8));const maskUrl=`url("${String(o.assetPath).replace(/"/g,'\"')}")`;tint.style.maskImage=maskUrl;tint.style.webkitMaskImage=maskUrl;el.appendChild(tint);}if(showObjectCol&&o.collision.enabled){const col=document.createElement('div'),r=devTemplateScreenAlignedRect(o.collision.x*o.scale,o.collision.y*o.scale,o.collision.w*o.scale,o.collision.h*o.scale);col.className='dev-template-collision';Object.assign(col.style,{left:`${r.x}px`,top:`${r.y}px`,width:`${r.w}px`,height:`${r.h}px`});el.appendChild(col);}if(showObjectCol)for(const q of o.collisionZones||[])if(q?.enabled){const col=document.createElement('div'),r=devTemplateScreenAlignedRect(q.x*o.scale,q.y*o.scale,q.w*o.scale,q.h*o.scale);col.className='dev-template-collision';Object.assign(col.style,{left:`${r.x}px`,top:`${r.y}px`,width:`${r.w}px`,height:`${r.h}px`});el.appendChild(col);}if(showObjectOcc&&o.occlusion?.enabled){const occ=document.createElement('div'),r=devTemplateScreenAlignedRect(o.occlusion.x*o.scale,o.occlusion.y*o.scale,o.occlusion.w*o.scale,o.occlusion.h*o.scale);occ.className='dev-template-occlusion';Object.assign(occ.style,{left:`${r.x}px`,top:`${r.y}px`,width:`${r.w}px`,height:`${r.h}px`});el.appendChild(occ);}if(showObjectOcc)for(const q of o.occlusionZones||[])if(q?.enabled){const occ=document.createElement('div'),r=devTemplateScreenAlignedRect(q.x*o.scale,q.y*o.scale,q.w*o.scale,q.h*o.scale);occ.className='dev-template-occlusion';Object.assign(occ.style,{left:`${r.x}px`,top:`${r.y}px`,width:`${r.w}px`,height:`${r.h}px`});el.appendChild(occ);}if(showObjectDoor&&o.door.enabled){const door=document.createElement('div'),p=devTemplateScreenAlignedPoint(o.door.x*o.scale,o.door.y*o.scale);door.className='dev-template-door';Object.assign(door.style,{left:`${p.x}px`,top:`${p.y}px`});el.appendChild(door);}frag.appendChild(el);}if(devTemplateState.marquee){const q=devTemplateState.marquee,x=Math.min(q.startX,q.x),y=Math.min(q.startY,q.y),w=Math.abs(q.x-q.startX),h=Math.abs(q.y-q.startY),marquee=document.createElement('div');marquee.className='dev-template-marquee';Object.assign(marquee.style,{left:`${x}px`,top:`${y}px`,width:`${w}px`,height:`${h}px`});frag.appendChild(marquee);}for(const item of devTemplateSelectedRoadItems()){if(!item.rect)continue;const box=document.createElement('div');box.className='dev-template-road-selection-box normal';Object.assign(box.style,{left:`${item.rect.x}px`,top:`${item.rect.y}px`,width:`${item.rect.w}px`,height:`${item.rect.h}px`});frag.appendChild(box);}const roadBounds=devTemplateRoadSelectionBounds();if(roadBounds){const box=document.createElement('div');box.className='dev-template-road-selection-box painter';Object.assign(box.style,{left:`${roadBounds.x}px`,top:`${roadBounds.y}px`,width:`${roadBounds.w}px`,height:`${roadBounds.h}px`});frag.appendChild(box);}if(devTemplateState.playerRef.shown){const ref=devTemplateState.playerRef,refSize=Math.round(32*(Number(api.getPlayerVisualScale?.())||1)),el=document.createElement('div');el.className='dev-template-player-ref';if(devTemplateState.selection?.kind==='reference'&&devTemplateState.selection.id==='player')el.classList.add('selected');const rp=devTemplateScreenAlignedPoint(ref.x,ref.y);Object.assign(el.style,{left:`${rp.x}px`,top:`${rp.y}px`,width:`${refSize}px`,height:`${refSize}px`});const img=document.createElement('img');img.src=DEV_TEMPLATE_PLAYER_REF_SPRITES[ref.className]||DEV_TEMPLATE_PLAYER_REF_SPRITES.Votary;img.alt='Player scale reference';img.draggable=false;Object.assign(img.style,{width:`${refSize}px`,height:`${refSize}px`});el.appendChild(img);frag.appendChild(el);}for(const key of ['entrance','exit']){const a=devTemplateState.current.anchors[key],el=document.createElement('div');el.className=`dev-template-anchor ${key==='exit'?'exit':''}`;if(devTemplateState.selection?.kind==='anchor'&&devTemplateState.selection.id===key)el.classList.add('selected');el.textContent=key==='entrance'?'IN':'OUT';el.title=key==='entrance'?'Template entrance':'Template exit';const p=devTemplateScreenAlignedPoint(a.x,a.y);Object.assign(el.style,{left:`${p.x}px`,top:`${p.y}px`});frag.appendChild(el);}if(devTemplateState.pixelGrid&&(devTemplateState.zoom||1)>=3){const grid=document.createElement('div');grid.className='dev-template-pixel-grid';grid.setAttribute('aria-hidden','true');frag.appendChild(grid);}devTemplateCanvas.appendChild(frag);devTemplateWorkshop?.classList.toggle('show-all-collision',devTemplateState.showCollision);devTemplateWorkshop?.classList.toggle('show-all-occlusion',devTemplateState.showOcclusion);devTemplateWorkshop?.classList.toggle('show-all-doors',devTemplateState.showDoors);devTemplateWorkshop?.classList.toggle('drawing-region',!!devTemplateState.regionTool);devTemplateRenderStatus();
}
function devTemplateLearnDimensions(o,img){
  if(!img.naturalWidth||!img.naturalHeight)return;if(o.assetWidth===img.naturalWidth&&o.assetHeight===img.naturalHeight)return;const wasFallback=o.assetWidth===64&&o.assetHeight===64;o.assetWidth=img.naturalWidth;o.assetHeight=img.naturalHeight;if(wasFallback){o.collision={enabled:true,x:0,y:Math.round(o.assetHeight*.25),w:o.assetWidth,h:Math.max(1,Math.round(o.assetHeight*.75))};const isBuilding=devTemplateAssetCategory(o.assetPath)==='buildings';o.occlusion={enabled:isBuilding,x:0,y:0,w:o.assetWidth,h:Math.max(1,Math.round(o.assetHeight*.50))};o.door={enabled:true,x:Math.round(o.assetWidth/2),y:o.assetHeight};}else{o.collision.x=devTemplateClamp(o.collision.x,0,o.assetWidth);o.collision.y=devTemplateClamp(o.collision.y,0,o.assetHeight);o.collision.w=devTemplateClamp(o.collision.w,1,o.assetWidth-o.collision.x||1);o.collision.h=devTemplateClamp(o.collision.h,1,o.assetHeight-o.collision.y||1);if(!o.occlusion)o.occlusion={enabled:devTemplateAssetCategory(o.assetPath)==='buildings',x:0,y:0,w:o.assetWidth,h:Math.max(1,Math.round(o.assetHeight*.50))};o.occlusion.x=devTemplateClamp(o.occlusion.x,0,o.assetWidth);o.occlusion.y=devTemplateClamp(o.occlusion.y,0,o.assetHeight);o.occlusion.w=devTemplateClamp(o.occlusion.w,1,o.assetWidth-o.occlusion.x||1);o.occlusion.h=devTemplateClamp(o.occlusion.h,1,o.assetHeight-o.occlusion.y||1);o.door.x=devTemplateClamp(o.door.x,0,o.assetWidth);o.door.y=devTemplateClamp(o.door.y,0,o.assetHeight);}devTemplatePersistDraft();devTemplateRenderCanvas();devTemplateRenderInspector();
}
function devTemplateInspectorField(path,title,sub,value,min,max,step=1){return`<div class="dev-template-inspector-field"><label><b>${devTemplateEsc(title)}</b><span>${devTemplateEsc(sub)}</span></label><input type="number" data-template-field="${devTemplateEsc(path)}" value="${Number(value)}" min="${min}" max="${max}" step="${step}"></div>`;}
function devTemplateFilterPresetOptions(current){const options=Object.entries(DEV_TEMPLATE_FILTER_PRESETS).map(([id,p])=>`<option value="${id}" ${current===id?'selected':''}>${devTemplateEsc(p.label)}</option>`).join('');return`${options}<option value="custom" ${current==='custom'?'selected':''}>Custom</option>`;}
function devTemplateZoneCards(scope,kind,zones,maxW,maxH){const title=kind==='collision'?'Collision':'Behind',arr=zones||[];if(!arr.length)return`<div class="dev-template-zone-empty">No additional ${title.toLowerCase()} zones.</div>`;return`<div class="dev-template-zone-list">${arr.map((q,i)=>`<div class="dev-template-zone-card"><div class="dev-template-zone-head"><label class="dev-template-check"><input type="checkbox" data-template-zone-toggle="${scope}:${kind}:${i}" ${q.enabled!==false?'checked':''}> ${title} ${i+1}</label><div><button type="button" data-template-action="zone-draw:${scope}:${kind}:${i}">Draw</button><button class="danger" type="button" data-template-action="zone-remove:${scope}:${kind}:${i}">Remove</button></div></div><div class="dev-template-inspector-fields">${devTemplateInspectorField(`${scope==='road'?'road.':''}${kind}Zones.${i}.x`,'X','Local offset.',q.x,0,maxW,1)}${devTemplateInspectorField(`${scope==='road'?'road.':''}${kind}Zones.${i}.y`,'Y','Local offset.',q.y,0,maxH,1)}${devTemplateInspectorField(`${scope==='road'?'road.':''}${kind}Zones.${i}.w`,'W','Zone width.',q.w,1,maxW,1)}${devTemplateInspectorField(`${scope==='road'?'road.':''}${kind}Zones.${i}.h`,'H','Zone height.',q.h,1,maxH,1)}</div></div>`).join('')}</div>`;}
function devTemplateRenderInspector(){
  if(!devTemplateInspector)return;const selectedAssets=devTemplateSelectedObjects(),selectedRoads=devTemplateSelectedRoadItems(),totalSelected=selectedAssets.length+selectedRoads.length,o=devTemplateSelectedObject(),road=devTemplateSelectedRoadItem(),a=devTemplateSelectedAnchor(),ref=devTemplateSelectedReference();
  if(totalSelected>1){const locked=selectedAssets.filter(v=>v.locked).length+selectedRoads.filter(v=>v.locked).length,parts=[];if(selectedAssets.length)parts.push(`${selectedAssets.length} asset${selectedAssets.length===1?'':'s'}`);if(selectedRoads.length)parts.push(`${selectedRoads.length} road piece${selectedRoads.length===1?'':'s'}`);devTemplateInspector.innerHTML=`<div class="dev-template-inspector-title"><b>${totalSelected} items selected</b><span>${parts.join(' + ')} · relative placement is preserved while moving</span></div><p>Drag any selected unlocked building, prop, road stamp, or individual road tile to move the whole selection together. ${locked?`<b>${locked}</b> locked item${locked===1?' stays':'s stay'} in place.`:'All selected items are movable.'}</p><div class="dev-template-inspector-actions"><button type="button" data-template-action="lock-selected">Lock selected</button><button type="button" data-template-action="unlock-selected">Unlock selected</button><button type="button" data-template-action="duplicate">Duplicate group</button><button type="button" data-template-action="clear-selection">Clear selection</button><button class="danger" type="button" data-template-action="delete">Delete selected</button></div><p><b>Shift+click</b> adds/removes individual items. Marquee selection now includes road pieces as well as ordinary assets.</p>`;return;}
  if(!o&&!road&&!a&&!ref){devTemplateInspector.innerHTML='<div class="dev-template-inspector-empty">Select a building, prop, tile stamp/single tile, entrance, exit, or the player reference. Placed tile pieces behave like normal Workshop assets when the Tile Painter is stopped.</div>';return;}
  if(ref){const refSize=Math.round(32*(Number(api.getPlayerVisualScale?.())||1));devTemplateInspector.innerHTML=`<div class="dev-template-inspector-title"><b>Player reference · ${devTemplateEsc(ref.className)}</b><span>${refSize}×${refSize}px current in-game render reference · Dev Tools only · not exported</span></div><div class="dev-template-inspector-fields">${devTemplateInspectorField('reference.x','X','Template-local reference position.',ref.x,0,devTemplateState.current.width,1)}${devTemplateInspectorField('reference.y','Y','Template-local reference position.',ref.y,0,devTemplateState.current.height,1)}</div><div class="dev-template-inspector-actions"><button type="button" data-template-action="reference-reset">Reset to Center</button></div><p>Drag or nudge this reference to compare doors, roads, props and building scale against the player. It follows Settings → Player sprite size.</p>`;return;}
  if(a){const key=devTemplateState.selection.id;devTemplateInspector.innerHTML=`<div class="dev-template-inspector-title"><b>${key==='entrance'?'Template entrance':'Template exit'}</b><span>Procedural route connection anchor</span></div><div class="dev-template-inspector-fields">${devTemplateInspectorField('anchor.x','X','Template-local horizontal position.',a.x,0,devTemplateState.current.width,1)}${devTemplateInspectorField('anchor.y','Y','Template-local vertical position.',a.y,0,devTemplateState.current.height,1)}</div><div class="dev-template-inspector-actions"><button type="button" data-template-action="anchor-reset">Reset ${key==='entrance'?'IN':'OUT'}</button></div>`;return;}
  if(road){const visual=road.visual||devTemplateDefaultVisual(),pieceType=road.tiles.length>1?'Tile stamp / linked piece':'Individual tile',renderedW=Math.round(road.rect.w),renderedH=Math.round(road.rect.h),local=devTemplateRoadLocalSize(road);devTemplateInspector.innerHTML=`<div class="dev-template-inspector-title"><b>${devTemplateEsc(road.label)}</b><span>${pieceType} · ${road.tiles.length} tile${road.tiles.length===1?'':'s'} · ${renderedW}×${renderedH}px · ${devTemplateEsc(road.assetPath)}</span></div><div class="dev-template-row"><label style="width:100%">Name <input data-template-road-label type="text" maxlength="80" value="${devTemplateEsc(road.label)}" aria-label="Tile piece name"></label></div><div class="dev-template-row"><label style="width:100%">Layer <select data-template-field="road.layer">${devTemplateLayerOptions(road.layer)}</select></label></div><div class="dev-template-inspector-fields">${devTemplateInspectorField('road.x','X','Template-local position of the whole tile piece.',road.rect.x,-2048,devTemplateState.current.width+2048,1)}${devTemplateInspectorField('road.y','Y','Template-local position of the whole tile piece.',road.rect.y,-2048,devTemplateState.current.height+2048,1)}${devTemplateInspectorField('road.scale','Uniform scale','Scales every tile and preserves the prefab layout.',road.scale,.25,4,.25)}<div class="dev-template-inspector-field"><label><b>Scale slider</b><span>Changes the whole tile piece, not one child tile.</span></label><input type="range" data-template-field="road.scale" value="${road.scale}" min=".25" max="4" step=".25"></div></div><label class="dev-template-check"><input type="checkbox" data-template-toggle="road-locked" ${road.locked?'checked':''}> Lock position against drag/nudge</label><div class="dev-template-inspector-actions"><button type="button" data-template-action="scale-reset">Reset Scale</button><button type="button" data-template-action="road-save-stamp">Save as Stamp</button>${road.tiles.length>1?'<button type="button" data-template-action="road-unlink">Break Apart</button>':''}</div>
  <div class="dev-template-zone-block"><h4>Shared Copy Inheritance</h4><p>${Math.max(0,devTemplateRoadMatchingItems(road).length-1)} other placed cop${Math.max(0,devTemplateRoadMatchingItems(road).length-1)===1?'y':'ies'} match this tile/stamp type. <b>Collision, Behind zones, lock state, layer and artwork filters now inherit automatically</b> across matching copies and the linked saved stamp. Position and scale stay per-instance.</p><div class="dev-template-inspector-actions"><button type="button" data-template-action="road-sync-collision">Reapply Collision</button><button type="button" data-template-action="road-sync-occlusion">Reapply Behind</button><button type="button" data-template-action="road-sync-filter">Reapply Filter</button><button type="button" data-template-action="road-sync-lock">Reapply Lock</button><button type="button" data-template-action="road-sync-all">Reapply All</button></div></div>
  <div class="dev-template-filter-block"><h4>Artwork Filter</h4><div class="dev-template-row"><label>Preset <select data-template-filter-preset>${devTemplateFilterPresetOptions(visual.preset||'original')}</select></label></div><div class="dev-template-inspector-fields">${devTemplateInspectorField('visual.brightness','Brightness','1.00 = source artwork.',visual.brightness,.25,1.6,.01)}<div class="dev-template-inspector-field"><label><b>Brightness slider</b><span>Applied to every tile in this piece.</span></label><input type="range" data-template-field="visual.brightness" value="${visual.brightness}" min=".25" max="1.6" step=".01"></div>${devTemplateInspectorField('visual.saturation','Saturation','1.00 = source colour; 0 = grayscale.',visual.saturation,0,2,.01)}<div class="dev-template-inspector-field"><label><b>Saturation slider</b><span>Useful for matching the tile artwork to the surrounding biome.</span></label><input type="range" data-template-field="visual.saturation" value="${visual.saturation}" min="0" max="2" step=".01"></div><div class="dev-template-inspector-field"><label><b>Tint colour</b><span>Uses each tile's sprite alpha as the mask.</span></label><input class="dev-template-color-input" type="color" data-template-field="visual.tint" value="${devTemplateEsc(visual.tint||'#71806f')}"></div>${devTemplateInspectorField('visual.tintStrength','Tint strength','0.00 = no tint; transparent pixels remain untouched.',visual.tintStrength,0,.8,.01)}<div class="dev-template-inspector-field"><label><b>Tint slider</b><span>Transparent parts of the source tile remain transparent.</span></label><input type="range" data-template-field="visual.tintStrength" value="${visual.tintStrength}" min="0" max=".8" step=".01"></div></div><div class="dev-template-inspector-actions"><button type="button" data-template-action="filter-reset">Reset Artwork Filter</button></div></div>
  <div class="dev-template-zone-block"><h4>Collision Zones</h4><p>Red regions are solid collision. A stamp or single tile can have several separate collision rectangles for irregular shapes.</p><div class="dev-template-inspector-actions"><button type="button" data-template-action="zone-add:road:collision">Add Collision Zone</button><button type="button" data-template-action="zone-draw-new:road:collision">Draw New Collision</button></div>${devTemplateZoneCards('road','collision',road.collisionZones,local.w,local.h)}</div>
  <div class="dev-template-zone-block"><h4>Behind / Occlusion Zones</h4><p>Purple regions are walkable. When the player's feet enter one, this tile artwork can render over the player. Multiple regions are supported.</p><div class="dev-template-inspector-actions"><button type="button" data-template-action="zone-add:road:occlusion">Add Behind Zone</button><button type="button" data-template-action="zone-draw-new:road:occlusion">Draw New Behind</button></div>${devTemplateZoneCards('road','occlusion',road.occlusionZones,local.w,local.h)}</div>
  <div class="dev-template-inspector-actions"><button type="button" data-template-action="duplicate">Duplicate Tile Piece</button><button class="danger" type="button" data-template-action="delete">Delete Tile Piece</button></div>`;return;}
  const size=devTemplateObjectSize(o),hasSaved=!!devTemplateSavedVersionOfSelectedObject(),visual=o.visual||devTemplateDefaultVisual();devTemplateInspector.innerHTML=`<div class="dev-template-inspector-title"><b>${devTemplateEsc(o.label)}</b><span>${devTemplateEsc(o.assetPath)} · source ${o.assetWidth}×${o.assetHeight}px · rendered ${Math.round(size.w)}×${Math.round(size.h)}px</span></div><div class="dev-template-inspector-fields">${devTemplateInspectorField('x','X','Template-local position.',o.x,-2048,devTemplateState.current.width+2048,1)}${devTemplateInspectorField('y','Y','Template-local position.',o.y,-2048,devTemplateState.current.height+2048,1)}${devTemplateInspectorField('scale','Uniform scale','Nearest-neighbour; width and height stay proportional.',o.scale,.25,4,.25)}<div class="dev-template-inspector-field"><label><b>Scale slider</b><span>0.25× to 4×.</span></label><input type="range" data-template-field="scale" value="${o.scale}" min=".25" max="4" step=".25"></div></div><div class="dev-template-row"><label style="width:100%">Layer <select data-template-field="layer">${devTemplateLayerOptions(o.layer)}</select></label></div><label class="dev-template-check"><input type="checkbox" data-template-toggle="locked" ${o.locked?'checked':''}> Lock position against drag/nudge</label><div class="dev-template-inspector-actions"><button type="button" data-template-action="scale-reset">Reset Scale</button>${hasSaved?'<button type="button" data-template-action="revert-saved">Revert Selected to Saved</button>':''}</div>
  <div class="dev-template-filter-block"><h4>Artwork Filter</h4><div class="dev-template-row"><label>Preset <select data-template-filter-preset>${devTemplateFilterPresetOptions(visual.preset||'original')}</select></label></div><div class="dev-template-inspector-fields">${devTemplateInspectorField('visual.brightness','Brightness','1.00 = source artwork.',visual.brightness,.25,1.6,.01)}<div class="dev-template-inspector-field"><label><b>Brightness slider</b><span>Darker / lighter without changing alpha.</span></label><input type="range" data-template-field="visual.brightness" value="${visual.brightness}" min=".25" max="1.6" step=".01"></div>${devTemplateInspectorField('visual.saturation','Saturation','1.00 = source colour; 0 = grayscale.',visual.saturation,0,2,.01)}<div class="dev-template-inspector-field"><label><b>Saturation slider</b><span>Useful for bringing bright assets into the world palette.</span></label><input type="range" data-template-field="visual.saturation" value="${visual.saturation}" min="0" max="2" step=".01"></div><div class="dev-template-inspector-field"><label><b>Tint colour</b><span>Applied only through the PNG alpha mask.</span></label><input class="dev-template-color-input" type="color" data-template-field="visual.tint" value="${devTemplateEsc(visual.tint||'#71806f')}"></div>${devTemplateInspectorField('visual.tintStrength','Tint strength','0.00 = no tint; transparent pixels remain untouched.',visual.tintStrength,0,.8,.01)}<div class="dev-template-inspector-field"><label><b>Tint slider</b><span>Blends the selected tint into visible pixels only.</span></label><input type="range" data-template-field="visual.tintStrength" value="${visual.tintStrength}" min="0" max=".8" step=".01"></div></div><div class="dev-template-inspector-actions"><button type="button" data-template-action="filter-reset">Reset Artwork Filter</button></div><p>The filter is <b>non-destructive</b>. Transparent PNG areas stay transparent; tinting is masked by the artwork's alpha instead of colouring the whole rectangular asset box.</p></div>
  <label class="dev-template-check"><input type="checkbox" data-template-toggle="collision" ${o.collision.enabled?'checked':''}> Primary collision enabled</label><div class="dev-template-inspector-fields">${devTemplateInspectorField('collision.x','Collision X','Source-pixel offset inside artwork.',o.collision.x,0,o.assetWidth,1)}${devTemplateInspectorField('collision.y','Collision Y','Source-pixel offset inside artwork.',o.collision.y,0,o.assetHeight,1)}${devTemplateInspectorField('collision.w','Collision W','Source-pixel width; scales with building.',o.collision.w,1,o.assetWidth,1)}${devTemplateInspectorField('collision.h','Collision H','Source-pixel height; scales with building.',o.collision.h,1,o.assetHeight,1)}</div><div class="dev-template-inspector-actions"><button type="button" data-template-action="collision-reset">Reset Collision</button><button type="button" data-template-action="zone-draw-primary:asset:collision">Draw Primary Collision</button><button type="button" data-template-action="zone-add:asset:collision">Add Collision Zone</button><button type="button" data-template-action="zone-draw-new:asset:collision">Draw Extra Collision</button></div>${devTemplateZoneCards('asset','collision',o.collisionZones||[],o.assetWidth,o.assetHeight)}<label class="dev-template-check"><input type="checkbox" data-template-toggle="occlusion" ${o.occlusion?.enabled?'checked':''}> Behind / occlusion zone enabled</label><div class="dev-template-inspector-fields">${devTemplateInspectorField('occlusion.x','Behind X','Source-pixel offset inside artwork.',o.occlusion?.x??0,0,o.assetWidth,1)}${devTemplateInspectorField('occlusion.y','Behind Y','Source-pixel offset inside artwork.',o.occlusion?.y??0,0,o.assetHeight,1)}${devTemplateInspectorField('occlusion.w','Behind W','Player is drawn beneath this part of the building.',o.occlusion?.w??o.assetWidth,1,o.assetWidth,1)}${devTemplateInspectorField('occlusion.h','Behind H','Use for roofs / tall foreground portions.',o.occlusion?.h??Math.round(o.assetHeight*.5),1,o.assetHeight,1)}</div><div class="dev-template-inspector-actions"><button type="button" data-template-action="draw-occlusion">Draw Primary Behind</button><button type="button" data-template-action="occlusion-reset">Reset Behind Zone</button><button type="button" data-template-action="zone-add:asset:occlusion">Add Behind Zone</button><button type="button" data-template-action="zone-draw-new:asset:occlusion">Draw Extra Behind</button></div>${devTemplateZoneCards('asset','occlusion',o.occlusionZones||[],o.assetWidth,o.assetHeight)}<p>The purple zone is not collision. When the player's feet enter it, this PNG draws over the player so roofs can visually hide them.</p><label class="dev-template-check"><input type="checkbox" data-template-toggle="door" ${o.door.enabled?'checked':''}> Door / interaction marker enabled</label><div class="dev-template-inspector-fields">${devTemplateInspectorField('door.x','Door X','Source-pixel position; scales with building.',o.door.x,0,o.assetWidth,1)}${devTemplateInspectorField('door.y','Door Y','Source-pixel position; scales with building.',o.door.y,0,o.assetHeight,1)}</div><div class="dev-template-inspector-actions"><button type="button" data-template-action="door-reset">Reset Interaction Marker</button><button type="button" data-template-action="duplicate">Duplicate asset</button><button class="danger" type="button" data-template-action="delete">Delete asset</button></div>`;
}
function devTemplateRenderStatus(){
  if(!devTemplateStatus)return;const overlaps=devTemplateVisualOverlaps(),overlapCount=overlaps.size;const current=devTemplateState.current,roadCount=devTemplateRoadTileCount(),selectedCount=devTemplateSelectedTemplateCount(),normalRoadSelected=devTemplateSelectedRoadKeys().length,painterRoadSelected=(devTemplateState.roadPaint.selectedIds||[]).length,modeLabel=devTemplateState.roadPaint.mode==='erase'?'ERASE':devTemplateState.roadPaint.mode==='select'?'SELECT':devTemplateState.roadPaint.mode==='eyedropper'?'PICK':'PAINT',roadHint=devTemplateState.roadPaint.active?` · <b class="warn">ROAD ${modeLabel} ACTIVE</b>`:'',drawHint=devTemplateState.regionTool?` · <b class="warn">DRAW REGION: drag over selected artwork</b>`:'',selectHint=selectedCount>1?` · <b>${selectedCount} items selected</b>`:normalRoadSelected===1?' · <b>road piece selected</b>':'',roadSelectHint=painterRoadSelected?` · <b>${painterRoadSelected} road tile${painterRoadSelected===1?'':'s'} linked</b>`:'',saveState=devTemplateState.dirty?'<b class="dirty">Draft changed · autosaved locally</b>':'<b class="ok">Saved template matches draft</b>';devTemplateStatus.innerHTML=`<span>${saveState} · ${current.objects.length} asset${current.objects.length===1?'':'s'} · ${roadCount} road tile${roadCount===1?'':'s'} · ${current.width}×${current.height}px · view ${Math.round((devTemplateState.zoom||1)*100)}%${selectHint}${roadSelectHint}${roadHint}${drawHint} ${overlapCount?`· <b class="warn">${overlapCount} asset${overlapCount===1?'':'s'} visually overlap</b>`:''}</span><span>${devTemplateState.roadPaint.active?(devTemplateState.roadPaint.mode==='select'?'<kbd>Click</kbd> selects linked road groups · <kbd>Drag</kbd> moves them · <kbd>Delete</kbd> removes them':devTemplateState.roadPaint.mode==='eyedropper'?'<kbd>Click</kbd> picks a brush from placed road tiles · <kbd>Esc</kbd> stops painter':'<kbd>Drag</kbd> repeats the current road stamp · <kbd>Esc</kbd> stops painter'):'<kbd>Drag empty</kbd> marquee assets + roads · <kbd>Shift+click</kbd> add/remove · <kbd>Arrows</kbd> nudge · <kbd>Delete</kbd> removes selection'}</span>`;
}

function devTemplateSetZoom(value,{keepCenter=true}={}){const old=Math.max(.5,Math.min(6,Number(devTemplateState.zoom)||1)),next=DEV_TEMPLATE_ZOOM_LEVELS.reduce((best,v)=>Math.abs(v-Number(value))<Math.abs(best-Number(value))?v:best,DEV_TEMPLATE_ZOOM_LEVELS[0]);if(old===next){devTemplateSyncMetaControls();return;}let localCenter=null;if(keepCenter&&devTemplateStage){localCenter={x:(devTemplateStage.scrollLeft+devTemplateStage.clientWidth/2-32)/old,y:(devTemplateStage.scrollTop+devTemplateStage.clientHeight/2-32)/old};}devTemplateState.zoom=next;devTemplatePersistView();devTemplateRenderCanvas();if(localCenter&&devTemplateStage){requestAnimationFrame(()=>{devTemplateStage.scrollLeft=Math.max(0,32+localCenter.x*next-devTemplateStage.clientWidth/2);devTemplateStage.scrollTop=Math.max(0,32+localCenter.y*next-devTemplateStage.clientHeight/2);});}}
function devTemplateStepZoom(direction){const current=Number(devTemplateState.zoom)||1,idx=Math.max(0,DEV_TEMPLATE_ZOOM_LEVELS.indexOf(current)),next=DEV_TEMPLATE_ZOOM_LEVELS[Math.max(0,Math.min(DEV_TEMPLATE_ZOOM_LEVELS.length-1,idx+(direction<0?-1:1)))];devTemplateSetZoom(next);}
function devTemplateCenterPlayerRef(){devTemplateState.playerRef.x=Math.round(devTemplateState.current.width/2);devTemplateState.playerRef.y=Math.round(devTemplateState.current.height/2);devTemplateState.playerRef.shown=true;devTemplatePersistView();devTemplateState.selection={kind:'reference',id:'player'};devTemplateState.multiSelection=[];devTemplateState.multiRoadSelection=[];devTemplateRenderCanvas();devTemplateRenderInspector();}
function devTemplateRefresh(){devTemplateRenderLibrary();devTemplateRenderScanFolders();devTemplateRenderAssets();devTemplateRenderRoadControls();devTemplateRenderCanvas();devTemplateRenderInspector();}
function devTemplateSetOpen(value){
  devTemplateState.open=!!value;if(devTemplateState.open){if(!devPlacement.enabled)devSetMode(true);document.body.classList.add('dev-template-open');devTemplateWorkshop.hidden=false;devTemplateRefresh();setTimeout(()=>{if(devTemplateStage){const z=devTemplateState.zoom||1;devTemplateStage.scrollLeft=Math.max(0,(devTemplateState.current.width*z-devTemplateStage.clientWidth)/2+32);devTemplateStage.scrollTop=Math.max(0,(devTemplateState.current.height*z-devTemplateStage.clientHeight)/2+32);}},0);}else{document.body.classList.remove('dev-template-open');if(devTemplateWorkshop)devTemplateWorkshop.hidden=true;devTemplateState.drag=null;devTemplateState.marquee=null;devTemplateState.regionTool=null;devTemplateState.regionDraw=null;devTemplateState.roadPaint.pointerId=null;devTemplateState.roadPaint.lastKey='';devTemplateState.roadPaint.hover=null;devTemplateHidePicker();}
}
function devTemplatePathFromFolderFile(file){
  const rel=String(file?.webkitRelativePath||file?.name||'').replace(/\\/g,'/');if(!DEV_TEMPLATE_IMAGE_EXT.test(rel))return'';const lower=rel.toLowerCase(),marker='/assets/';let i=lower.indexOf(marker);if(i>=0)return`./${rel.slice(i+1)}`;if(lower.startsWith('assets/'))return`./${rel}`;
  // Browsers omit the parent path when the user chooses a source folder such as
  // assets/buildings directly. If its first path segment is one of the enabled
  // Workshop folders, rebuild the project-relative assets/ path safely.
  const first=devTemplateNormalizeScanFolder(rel.split('/')[0]||'');if(first&&devTemplateState.scanFolders.some(rule=>rule===first||rule.startsWith(`${first}/`)))return`./assets/${rel}`;
  return'';
}
function devTemplateScanAssetFolder(files){
  const list=Array.from(files||[]),found=[];for(const file of list){const path=devTemplatePathFromFolderFile(file);if(path)found.push(path);}const discovered=[...new Set(found)],unique=discovered.filter(devTemplateAssetMatchesScanFolder);if(!discovered.length){if(devTemplateAssetScanMeta)devTemplateAssetScanMeta.textContent='No supported project images were found. Choose the project assets folder, project root, or one enabled source folder.';toast('No project assets found in that folder.');return;}if(!unique.length){if(devTemplateAssetScanMeta)devTemplateAssetScanMeta.innerHTML=`Found <b>${discovered.length}</b> image${discovered.length===1?'':'s'}, but none are inside the enabled Workshop folders.`;toast('Images were found, but all were excluded by the Workshop folder rules.');return;}
  const before=new Set(devTemplateState.assets);for(const path of unique)before.add(path);devTemplateState.assets=[...before].sort();devTemplatePersistAssets();const repaired=devTemplateRepairStoredAssetPaths(),categories=[...new Set(unique.map(devTemplateAssetCategory))].sort(),ignored=discovered.length-unique.length;if(devTemplateAssetScanMeta)devTemplateAssetScanMeta.innerHTML=`Added/refreshed <b>${unique.length}</b> allowed image asset${unique.length===1?'':'s'}${ignored?` · ignored <b>${ignored}</b> outside enabled folders`:''}${repaired?` · repaired <b>${repaired}</b> stored template path${repaired===1?'':'s'}`:''}. Sources: ${categories.map(devTemplateEsc).join(', ')}.`;toast(`Workshop catalogue refreshed: ${unique.length} allowed image${unique.length===1?'':'s'}${repaired?` · ${repaired} old path${repaired===1?'':'s'} repaired`:''}.`);
}
function devTemplateOpenAssetFolderPicker(){
  if(!devTemplateAssetFolderInput)return;devTemplateAssetFolderInput.value='';devTemplateAssetFolderInput.click();
}
function devTemplateRegisterAsset(){const path=devTemplateNormalizeAssetPath(devTemplateAssetPathInput?.value);if(!path||/\/$/.test(path)){toast('Enter a PNG filename or complete project-relative asset path.');return;}if(!devTemplateState.assets.includes(path)){devTemplateState.assets.push(path);devTemplateState.assets.sort();devTemplatePersistAssets();toast(`Registered ${devTemplateFilename(path)}.`);}if(devTemplateAssetPathInput)devTemplateAssetPathInput.value='./assets/buildings/';}
function devTemplateAddAsset(path){
  path=devTemplateNormalizeAssetPath(path);if(!path)return;const isBuilding=devTemplateAssetCategory(path)==='buildings';const o={id:devTemplateId('asset'),type:'asset',assetPath:path,label:devTemplateFilename(path).replace(/\.[^.]+$/,''),x:Math.round(devTemplateState.current.width/2-32),y:Math.round(devTemplateState.current.height/2-32),scale:1,assetWidth:64,assetHeight:64,locked:false,layer:'normal',visual:devTemplateDefaultVisual(),collision:{enabled:true,x:0,y:16,w:64,h:48},occlusion:{enabled:isBuilding,x:0,y:0,w:64,h:32},door:{enabled:true,x:32,y:64},collisionZones:[],occlusionZones:[]};devTemplateState.current.objects.push(o);devTemplateSetSelection({kind:'asset',id:o.id});devTemplatePersistDraft();devTemplateRenderCanvas();devTemplateRenderInspector();
}
function devTemplateMoveRoadItem(item,dx,dy){if(!item||item.locked)return false;for(const tile of item.tiles){tile.x=(Number(tile.x)||0)+dx;tile.y=(Number(tile.y)||0)+dy;}return true;}
function devTemplateSetRoadItemVisual(item,visual){if(!item)return;for(const tile of item.tiles)tile.visual=devTemplateDeepClone(visual);}
function devTemplateSetRoadItemLocked(item,value){if(!item)return;for(const tile of item.tiles)tile.locked=!!value;item.locked=!!value;}
function devTemplateSetRoadItemLayer(item,value){if(!item)return;const layer=devTemplateNormalizeLayer(value,'ground');for(const tile of item.tiles)tile.layer=layer;item.layer=layer;}
function devTemplateSetRoadItemZones(item,kind,zones){if(!item)return;const key=kind==='occlusion'?'occlusionZones':'collisionZones',copy=devTemplateDeepClone(zones||[]);for(const tile of item.tiles)tile[key]=devTemplateDeepClone(copy);item[key]=copy;}
function devTemplateRoadLocalSize(item){const scale=Math.max(.01,Number(item?.scale)||1);return{w:Math.max(1,(Number(item?.rect?.w)||1)/scale),h:Math.max(1,(Number(item?.rect?.h)||1)/scale)};}
function devTemplateRoadPointInOcclusion(item,p){if(!item?.rect)return false;const scale=Math.max(.01,Number(item.scale)||1);return(item.occlusionZones||[]).some(q=>q?.enabled&&p.x>=item.rect.x+q.x*scale&&p.x<=item.rect.x+(q.x+q.w)*scale&&p.y>=item.rect.y+q.y*scale&&p.y<=item.rect.y+(q.y+q.h)*scale);}
function devTemplateSetRoadItemScale(item,newScale){if(!item?.tiles?.length)return;const oldScale=Math.max(.01,Number(item.scale)||1),next=devTemplateClamp(newScale,.25,4),ratio=next/oldScale,originX=item.rect.x,originY=item.rect.y;for(const tile of item.tiles){tile.x=originX+((Number(tile.x)||0)-originX)*ratio;tile.y=originY+((Number(tile.y)||0)-originY)*ratio;tile.scale=next;}}
function devTemplateDeleteSelected(){const assetIds=devTemplateSelectedAssetIds(),roadKeys=devTemplateSelectedRoadKeys();if(!assetIds.length&&!roadKeys.length)return false;devTemplateHistorySetNext('Delete selection');if(assetIds.length){const set=new Set(assetIds);devTemplateState.current.objects=devTemplateState.current.objects.filter(v=>!set.has(v.id));}if(roadKeys.length){const tileIds=new Set(roadKeys.flatMap(key=>devTemplateRoadTilesForKey(key).map(t=>t.id)));const layer=devTemplateRoadLayer();layer.tiles=layer.tiles.filter(t=>!tileIds.has(t.id));}devTemplateState.selection=null;devTemplateState.multiSelection=[];devTemplateState.multiRoadSelection=[];devTemplatePersistDraft();devTemplateRenderCanvas();devTemplateRenderInspector();return true;}
function devTemplateDuplicateSelected(){const selectedAssets=devTemplateSelectedObjects(),selectedRoads=devTemplateSelectedRoadItems();if(!selectedAssets.length&&!selectedRoads.length)return;devTemplateHistorySetNext('Duplicate selection');const assetCopies=[],roadCopies=[];for(const o of selectedAssets){const copy=devTemplateDeepClone(o);copy.id=devTemplateId('asset');copy.label=`${o.label} copy`;copy.x+=16;copy.y+=16;copy.locked=false;devTemplateState.current.objects.push(copy);assetCopies.push(copy.id);}for(const item of selectedRoads){const newGroup=devTemplateId('roadgrp'),label=`${item.label} copy`.slice(0,80),tiles=[];for(const tile of item.tiles){const copy=devTemplateDeepClone(tile);copy.id=devTemplateId('tile');copy.groupId=newGroup;copy.label=label;copy.x=(Number(copy.x)||0)+16;copy.y=(Number(copy.y)||0)+16;devTemplateRoadLayer().tiles.push(copy);tiles.push(copy);}if(tiles.length)roadCopies.push(`group:${newGroup}`);}devTemplateState.multiSelection=assetCopies;devTemplateState.multiRoadSelection=roadCopies;if(roadCopies.length)devTemplateState.selection={kind:'road',id:roadCopies.at(-1)};else if(assetCopies.length)devTemplateState.selection={kind:'asset',id:assetCopies.at(-1)};else devTemplateState.selection=null;devTemplatePersistDraft();devTemplateRenderCanvas();devTemplateRenderInspector();}
function devTemplateNudge(dx,dy){
  const selectedAssets=devTemplateSelectedObjects(),selectedRoads=devTemplateSelectedRoadItems();if(selectedAssets.length||selectedRoads.length){devTemplateHistorySetNext('Nudge selection');let moved=0,locked=0;for(const o of selectedAssets){if(o.locked){locked++;continue;}o.x+=dx;o.y+=dy;moved++;}for(const item of selectedRoads){if(item.locked){locked++;continue;}devTemplateMoveRoadItem(item,dx,dy);moved++;}if(!moved){toast('All selected items are position-locked.');return true;}if(locked)toast('Moved the unlocked selections; locked items stayed in place.');devTemplatePersistDraft();devTemplateRenderCanvas();devTemplateRenderInspector();return true;}const a=devTemplateSelectedAnchor();if(a){devTemplateHistorySetNext('Nudge anchor');a.x=devTemplateClamp(a.x+dx,0,devTemplateState.current.width);a.y=devTemplateClamp(a.y+dy,0,devTemplateState.current.height);devTemplatePersistDraft();devTemplateRenderCanvas();devTemplateRenderInspector();return true;}const ref=devTemplateSelectedReference();if(ref){ref.x=devTemplateClamp(ref.x+dx,0,devTemplateState.current.width);ref.y=devTemplateClamp(ref.y+dy,0,devTemplateState.current.height);devTemplatePersistView();devTemplateRenderCanvas();devTemplateRenderInspector();return true;}return false;
}
function devTemplateSaveCurrent(){
  devTemplateHistorySetNext('Save template');const t=devTemplateState.current;t.name=String(devTemplateNameInput?.value||t.name||'Untitled Town').trim().slice(0,80)||'Untitled Town';t.kind=devTemplateKindSelect?.value||t.kind;if(!t.id)t.id=`${devTemplateSlug(t.name)}-${Date.now().toString(36)}`;t.updatedAt=new Date().toISOString();devTemplateState.library[t.id]=devTemplateDeepClone(t);devTemplatePersistLibrary();devTemplateStorageSet(DEV_TEMPLATE_DRAFT_STORAGE,t);devTemplateState.dirty=false;devTemplateRenderStatus();devTemplateHistoryCommit('Save template');if(devTemplateLibrarySelect)devTemplateLibrarySelect.value=t.id;toast(`Saved template: ${t.name}.`);
}
function devTemplateLoadSaved(id){const raw=devTemplateState.library[id];if(!raw){toast('Choose a saved template first.');return;}devTemplateHistorySetNext('Load saved template');devTemplateState.current=devTemplateSanitize(devTemplateDeepClone(raw));devTemplateState.selection=null;devTemplateState.multiSelection=[];devTemplateState.multiRoadSelection=[];devTemplateState.dirty=false;devTemplateStorageSet(DEV_TEMPLATE_DRAFT_STORAGE,devTemplateState.current);devTemplateHistoryCommit('Load saved template');devTemplateRefresh();toast(`Loaded ${devTemplateState.current.name}.`);}
function devTemplateNew(){if(devTemplateState.dirty&&!confirm('Start a new template? The current draft is auto-saved locally, but unsaved changes are not committed to the named template library.'))return;devTemplateHistorySetNext('New template');devTemplateState.current=devTemplateDefault();devTemplateState.selection=null;devTemplateState.multiSelection=[];devTemplateState.multiRoadSelection=[];devTemplateState.dirty=true;devTemplatePersistDraft();devTemplateRefresh();}
function devTemplateDuplicateCurrent(){devTemplateHistorySetNext('Duplicate template');const copy=devTemplateDeepClone(devTemplateState.current);copy.id='';copy.name=`${copy.name} Copy`.slice(0,80);devTemplateState.current=devTemplateSanitize(copy);devTemplateState.selection=null;devTemplateState.multiSelection=[];devTemplateState.multiRoadSelection=[];devTemplatePersistDraft();devTemplateRefresh();toast('Template duplicated as a new draft. Save it when ready.');}
function devTemplateDeleteSaved(){const id=devTemplateState.current.id;if(!id||!devTemplateState.library[id]){toast('The current draft is not a saved template.');return;}if(!confirm(`Delete saved template “${devTemplateState.current.name}” from the local library? Exported JSON files are unaffected.`))return;delete devTemplateState.library[id];devTemplatePersistLibrary();devTemplateState.current.id='';devTemplatePersistDraft();toast('Saved template removed from local library.');}
function devTemplateExportCurrent(){const t=devTemplateSanitize(devTemplateState.current);devTemplateDownload(`${devTemplateSlug(t.name)}.json`,t);}
function devTemplateExportLibrary(){const payload={format:'lowfathom-settlement-template-library',version:1,build:'v0.219.30',templates:Object.values(devTemplateState.library)};devTemplateDownload('lowfathom-settlement-template-library.json',payload);}
async function devTemplateImport(file){
  if(!file)return;try{const parsed=JSON.parse(await file.text());if(parsed?.format==='lowfathom-settlement-template-library'&&Array.isArray(parsed.templates)){for(const raw of parsed.templates){const t=devTemplateSanitize(raw);if(!t.id)t.id=`${devTemplateSlug(t.name)}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,5)}`;devTemplateState.library[t.id]=t;}devTemplatePersistLibrary();toast(`Imported ${parsed.templates.length} templates into the library.`);}else{const t=devTemplateSanitize(parsed?.template||parsed);t.id=String(t.id||'');devTemplateState.current=t;devTemplateState.selection=null;devTemplateState.multiSelection=[];devTemplateState.multiRoadSelection=[];devTemplatePersistDraft();devTemplateRefresh();toast('Template imported as an editable draft.');}}catch(err){console.error(err);toast('That template JSON could not be imported.');}finally{if(devTemplateImportInput)devTemplateImportInput.value='';}
}
function devTemplateRoadSaveItemAsStamp(item){if(!item?.tiles?.length)return;const scale=Math.max(.01,Number(item.scale)||1),unit=Math.max(1,(Number(item.tileSize)||16)*scale),assetPath=item.assetPath;if(item.tiles.some(t=>t.assetPath!==assetPath)){toast('A saved road stamp must use one source sheet.');return;}const cells=item.tiles.map(tile=>({dx:Math.round(((Number(tile.x)||0)-item.rect.x)/unit),dy:Math.round(((Number(tile.y)||0)-item.rect.y)/unit),tileIndex:Math.max(0,Math.floor(Number(tile.tileIndex)||0))})),cols=Math.max(1,...cells.map(c=>c.dx+1)),rows=Math.max(1,...cells.map(c=>c.dy+1)),stamp={id:devTemplateId('stamp'),name:item.label||'Tile stamp',assetPath,tileSize:item.tileSize,scale:item.scale,cols,rows,cells,locked:!!item.locked,layer:devTemplateNormalizeLayer(item.layer,'ground'),visual:devTemplateDeepClone(item.visual||devTemplateDefaultVisual()),collisionZones:devTemplateDeepClone(item.collisionZones||[]),occlusionZones:devTemplateDeepClone(item.occlusionZones||[])};const name=prompt('Name this tile stamp:',stamp.name);if(name===null)return;devTemplateHistorySetNext('Save tile stamp');stamp.name=String(name||'Tile stamp').trim().slice(0,60)||'Tile stamp';const sig=devTemplateRoadStampSignature(stamp),paint=devTemplateState.roadPaint;paint.savedStamps=[stamp,...(paint.savedStamps||[]).filter(s=>devTemplateRoadStampSignature(s)!==sig)].slice(0,24);for(const tile of item.tiles)tile.sourceStampId=stamp.id;devTemplatePersistRoadStamps();devTemplatePersistDraft();devTemplateRenderRoadControls();devTemplateRenderCanvas();devTemplateRenderInspector();toast(`Saved tile stamp “${stamp.name}”. This placed copy is now linked to that stamp type.`);}
function devTemplateRoadClipZonesToTile(item,tile,zones){const scale=Math.max(.01,Number(item.scale)||1),tileX=((Number(tile.x)||0)-item.rect.x)/scale,tileY=((Number(tile.y)||0)-item.rect.y)/scale,tileW=Number(tile.tileSize)||16,tileH=tileW,out=[];for(const q of zones||[]){const x1=Math.max(q.x,tileX),y1=Math.max(q.y,tileY),x2=Math.min(q.x+q.w,tileX+tileW),y2=Math.min(q.y+q.h,tileY+tileH);if(x2>x1&&y2>y1)out.push({id:devTemplateId('zone'),enabled:q.enabled!==false,x:x1-tileX,y:y1-tileY,w:x2-x1,h:y2-y1});}return out;}
function devTemplateRoadUnlinkItem(item){devTemplateHistorySetNext('Break apart tile stamp');if(!item?.tiles?.length)return;for(const tile of item.tiles){tile.collisionZones=devTemplateRoadClipZonesToTile(item,tile,item.collisionZones);tile.occlusionZones=devTemplateRoadClipZonesToTile(item,tile,item.occlusionZones);tile.groupId='';tile.sourceStampId='';}const first=item.tiles[0];devTemplateState.multiRoadSelection=[];devTemplateState.selection=first?{kind:'road',id:`tile:${first.id}`} : null;devTemplatePersistDraft();devTemplateRenderCanvas();devTemplateRenderInspector();toast('Tile piece broken apart; collision and Behind zones were clipped onto the individual tiles.');}
function devTemplateApplyInspectorField(path,value,{renderInspector=true}={}){
  const o=devTemplateSelectedObject(),road=devTemplateSelectedRoadItem(),a=devTemplateSelectedAnchor(),ref=devTemplateSelectedReference();if(ref&&path.startsWith('reference.')){const key=path.slice(10);ref[key]=devTemplateClamp(value,0,key==='x'?devTemplateState.current.width:devTemplateState.current.height);devTemplatePersistView();devTemplateRenderCanvas();if(renderInspector)devTemplateRenderInspector();return;}if(a&&path.startsWith('anchor.')){const key=path.slice(7);a[key]=devTemplateClamp(value,0,key==='x'?devTemplateState.current.width:devTemplateState.current.height);}else if(road){if(path==='road.layer'){devTemplateRoadSetSharedLayer(road,value);}else if(path==='road.x'){const next=devTemplateClamp(value,-2048,devTemplateState.current.width+2048);devTemplateMoveRoadItem({...road,locked:false},next-road.rect.x,0);}else if(path==='road.y'){const next=devTemplateClamp(value,-2048,devTemplateState.current.height+2048);devTemplateMoveRoadItem({...road,locked:false},0,next-road.rect.y);}else if(path==='road.scale')devTemplateSetRoadItemScale(road,value);else if(path.startsWith('visual.')){const visual=devTemplateDeepClone(road.visual||devTemplateDefaultVisual());if(path==='visual.brightness')visual.brightness=devTemplateClamp(value,.25,1.6);else if(path==='visual.saturation')visual.saturation=devTemplateClamp(value,0,2);else if(path==='visual.tint'&&/^#[0-9a-f]{6}$/i.test(String(value)))visual.tint=String(value);else if(path==='visual.tintStrength')visual.tintStrength=devTemplateClamp(value,0,.8);visual.preset='custom';devTemplateRoadSetSharedVisual(road,visual);}else{const m=String(path).match(/^road\.(collisionZones|occlusionZones)\.(\d+)\.(x|y|w|h)$/);if(!m)return;const key=m[1],index=Number(m[2]),field=m[3],zones=devTemplateDeepClone(road[key]||[]),local=devTemplateRoadLocalSize(road),zone=zones[index];if(!zone)return;const max=(field==='x'||field==='w')?local.w:local.h;zone[field]=devTemplateClamp(value,field==='w'||field==='h'?1:0,max);devTemplateRoadSetSharedZones(road,key==='occlusionZones'?'occlusion':'collision',zones);}}else if(o){if(path==='layer')o.layer=devTemplateNormalizeLayer(value,'normal');else if(path==='x')o.x=devTemplateClamp(value,-2048,devTemplateState.current.width+2048);else if(path==='y')o.y=devTemplateClamp(value,-2048,devTemplateState.current.height+2048);else if(path==='scale')o.scale=devTemplateClamp(value,.25,4);else if(path==='visual.brightness'){o.visual=o.visual||devTemplateDefaultVisual();o.visual.brightness=devTemplateClamp(value,.25,1.6);o.visual.preset='custom';}else if(path==='visual.saturation'){o.visual=o.visual||devTemplateDefaultVisual();o.visual.saturation=devTemplateClamp(value,0,2);o.visual.preset='custom';}else if(path==='visual.tint'){o.visual=o.visual||devTemplateDefaultVisual();if(/^#[0-9a-f]{6}$/i.test(String(value)))o.visual.tint=String(value);o.visual.preset='custom';}else if(path==='visual.tintStrength'){o.visual=o.visual||devTemplateDefaultVisual();o.visual.tintStrength=devTemplateClamp(value,0,.8);o.visual.preset='custom';}else if(path.startsWith('collision.')){const k=path.slice(10),max=(k==='x'||k==='w')?o.assetWidth:o.assetHeight;o.collision[k]=devTemplateClamp(value,k==='w'||k==='h'?1:0,max);}else if(path.startsWith('occlusion.')){const k=path.slice(10),max=(k==='x'||k==='w')?o.assetWidth:o.assetHeight;if(!o.occlusion)o.occlusion={enabled:true,x:0,y:0,w:o.assetWidth,h:Math.max(1,Math.round(o.assetHeight*.5))};o.occlusion[k]=devTemplateClamp(value,k==='w'||k==='h'?1:0,max);}else{const m=String(path).match(/^(collisionZones|occlusionZones)\.(\d+)\.(x|y|w|h)$/);if(m){const key=m[1],index=Number(m[2]),field=m[3],zone=(o[key]||[])[index];if(!zone)return;const max=(field==='x'||field==='w')?o.assetWidth:o.assetHeight;zone[field]=devTemplateClamp(value,field==='w'||field==='h'?1:0,max);}else if(path.startsWith('door.')){const k=path.slice(5);o.door[k]=devTemplateClamp(value,0,k==='x'?o.assetWidth:o.assetHeight);}else return;}}else return;devTemplatePersistDraft();devTemplateRenderCanvas();if(renderInspector)devTemplateRenderInspector();
}
function devTemplateApplyFilterPreset(id){const o=devTemplateSelectedObject(),road=devTemplateSelectedRoadItem(),targetVisual=road?.visual||o?.visual;if(!o&&!road)return;if(id==='custom'){const visual=devTemplateDeepClone(targetVisual||devTemplateDefaultVisual());visual.preset='custom';if(road)devTemplateRoadSetSharedVisual(road,visual);else o.visual=visual;devTemplatePersistDraft();devTemplateRenderInspector();return;}const preset=DEV_TEMPLATE_FILTER_PRESETS[id];if(!preset)return;const visual={preset:id,brightness:preset.brightness,saturation:preset.saturation,tint:preset.tint,tintStrength:preset.tintStrength};if(road)devTemplateRoadSetSharedVisual(road,visual);else o.visual=visual;devTemplatePersistDraft();devTemplateRenderCanvas();devTemplateRenderInspector();}
function devTemplateApplyInspectorAction(action){
  const ref=devTemplateSelectedReference(),a=devTemplateSelectedAnchor(),road=devTemplateSelectedRoadItem();
  if(action==='clear-selection'){devTemplateSetSelection(null);return;}
  if(action==='delete'){devTemplateDeleteSelected();return;}
  if(action==='duplicate'){devTemplateDuplicateSelected();return;}
  if(action==='lock-selected'||action==='unlock-selected'){const value=action==='lock-selected',assets=devTemplateSelectedObjects(),roads=devTemplateSelectedRoadItems();for(const o of assets)o.locked=value;for(const item of roads)devTemplateRoadSetSharedLocked(item,value);devTemplatePersistDraft();devTemplateRenderCanvas();devTemplateRenderInspector();toast(`${value?'Locked':'Unlocked'} ${assets.length+roads.length} selected item${assets.length+roads.length===1?'':'s'}.`);return;}
  const zoneAction=String(action||'').match(/^zone-(add|draw-new|draw|remove|draw-primary):(asset|road):(collision|occlusion)(?::(\d+))?$/);if(zoneAction){const [,op,scope,kind,indexRaw]=zoneAction,index=indexRaw===undefined?null:Number(indexRaw),roadTarget=scope==='road'?devTemplateSelectedRoadItem():null,assetTarget=scope==='asset'?devTemplateSelectedObject():null,target=roadTarget||assetTarget;if(!target)return;const key=kind==='occlusion'?'occlusionZones':'collisionZones',size=roadTarget?devTemplateRoadLocalSize(roadTarget):{w:assetTarget.assetWidth,h:assetTarget.assetHeight};if(op==='add'){const zones=devTemplateDeepClone(target[key]||[]);zones.push(devTemplateDefaultZone(size.w,size.h,kind));if(roadTarget)devTemplateRoadSetSharedZones(roadTarget,kind,zones);else assetTarget[key]=zones;devTemplatePersistDraft();devTemplateRenderCanvas();devTemplateRenderInspector();return;}if(op==='remove'){const zones=devTemplateDeepClone(target[key]||[]);if(index===null||!zones[index])return;zones.splice(index,1);if(roadTarget)devTemplateRoadSetSharedZones(roadTarget,kind,zones);else assetTarget[key]=zones;devTemplatePersistDraft();devTemplateRenderCanvas();devTemplateRenderInspector();return;}if(op==='draw-primary'&&assetTarget){devTemplateState.regionTool={target:'asset',kind,objectId:assetTarget.id,zone:'primary'};devTemplateState.regionDraw=null;devTemplateRenderCanvas();toast(`Drag over the artwork to draw the primary ${kind==='collision'?'collision':'Behind'} zone.`);return;}const zoneIndex=op==='draw-new'?'new':index;if(zoneIndex!=='new'&&(zoneIndex===null||!(target[key]||[])[zoneIndex]))return;devTemplateState.regionTool=roadTarget?{target:'road',kind,roadKey:roadTarget.key,zone:zoneIndex}:{target:'asset',kind,objectId:assetTarget.id,zone:zoneIndex};devTemplateState.regionDraw=null;devTemplateRenderCanvas();toast(`Drag over the selected ${scope==='road'?'tile piece':'artwork'} to draw ${kind==='collision'?'collision':'a Behind'} zone.`);return;}
  if(action==='reference-reset'&&ref){ref.x=Math.round(devTemplateState.current.width/2);ref.y=Math.round(devTemplateState.current.height/2);devTemplatePersistView();devTemplateRenderCanvas();devTemplateRenderInspector();toast('Player reference reset to template center.');return;}
  if(action==='anchor-reset'&&a){const key=devTemplateState.selection?.id,def=devTemplateDefaultAnchorPosition(key);a.x=def.x;a.y=def.y;devTemplatePersistDraft();devTemplateRenderCanvas();devTemplateRenderInspector();toast(`${key==='entrance'?'IN':'OUT'} anchor reset.`);return;}
  if(road){if(action==='scale-reset'){devTemplateSetRoadItemScale(road,1);devTemplatePersistDraft();devTemplateRenderCanvas();devTemplateRenderInspector();toast('Road piece scale reset to 1×.');}else if(action==='filter-reset'){devTemplateRoadSetSharedVisual(road,devTemplateDefaultVisual());devTemplatePersistDraft();devTemplateRenderCanvas();devTemplateRenderInspector();toast('Road artwork filter reset.');}else if(action==='road-unlink')devTemplateRoadUnlinkItem(road);else if(action==='road-save-stamp')devTemplateRoadSaveItemAsStamp(road);else if(action==='road-sync-collision')devTemplateRoadSyncZonesToCopies(road,'collision');else if(action==='road-sync-occlusion')devTemplateRoadSyncZonesToCopies(road,'occlusion');else if(action==='road-sync-zones')devTemplateRoadSyncZonesToCopies(road,'both');else if(action==='road-sync-filter'){devTemplateHistorySetNext('Sync shared tile filter');const r=devTemplateRoadPropagateShared(road,{visual:road.visual||devTemplateDefaultVisual()});devTemplatePersistDraft();devTemplateRenderCanvas();devTemplateRenderInspector();toast(`Reapplied artwork filter to ${r.copies} matching cop${r.copies===1?'y':'ies'}.`);}else if(action==='road-sync-lock'){devTemplateHistorySetNext('Sync shared tile lock');const r=devTemplateRoadPropagateShared(road,{locked:road.locked});devTemplatePersistDraft();devTemplateRenderCanvas();devTemplateRenderInspector();toast(`Reapplied lock state to ${r.copies} matching cop${r.copies===1?'y':'ies'}.`);}else if(action==='road-sync-all'){devTemplateHistorySetNext('Sync all shared tile settings');const r=devTemplateRoadPropagateShared(road,{locked:road.locked,layer:road.layer,visual:road.visual||devTemplateDefaultVisual(),collisionZones:road.collisionZones||[],occlusionZones:road.occlusionZones||[]});devTemplatePersistDraft();devTemplateRenderCanvas();devTemplateRenderInspector();toast(`Reapplied shared settings to ${r.copies} matching cop${r.copies===1?'y':'ies'}.`);}return;}
  const o=devTemplateSelectedObject();if(!o)return;
  if(action==='scale-reset'){o.scale=1;devTemplatePersistDraft();devTemplateRenderCanvas();devTemplateRenderInspector();toast('Scale reset to 1×.');}
  else if(action==='filter-reset'){o.visual=devTemplateDefaultVisual();devTemplatePersistDraft();devTemplateRenderCanvas();devTemplateRenderInspector();toast('Artwork filter reset to the original PNG colours.');}
  else if(action==='collision-reset'){o.collision={enabled:true,x:0,y:Math.round(o.assetHeight*.25),w:o.assetWidth,h:Math.max(1,Math.round(o.assetHeight*.75))};devTemplatePersistDraft();devTemplateRenderCanvas();devTemplateRenderInspector();toast('Collision reset to its default footprint.');}
  else if(action==='occlusion-reset'){o.occlusion={enabled:devTemplateAssetCategory(o.assetPath)==='buildings',x:0,y:0,w:o.assetWidth,h:Math.max(1,Math.round(o.assetHeight*.50))};devTemplatePersistDraft();devTemplateRenderCanvas();devTemplateRenderInspector();toast('Behind zone reset to its default footprint.');}
  else if(action==='door-reset'){o.door={enabled:true,x:Math.round(o.assetWidth/2),y:o.assetHeight};devTemplatePersistDraft();devTemplateRenderCanvas();devTemplateRenderInspector();toast('Interaction marker reset to bottom-center.');}
  else if(action==='revert-saved'){const saved=devTemplateSavedVersionOfSelectedObject();if(!saved){toast('This asset has no saved version to revert to yet.');return;}const idx=devTemplateState.current.objects.findIndex(v=>v.id===o.id);if(idx<0)return;devTemplateState.current.objects[idx]=devTemplateSanitize({...devTemplateState.current,objects:[saved]}).objects[0];devTemplatePersistDraft();devTemplateRenderCanvas();devTemplateRenderInspector();toast('Selected asset restored to its last Save Template state.');}
  else if(action==='draw-occlusion'){o.occlusion=o.occlusion||{enabled:true,x:0,y:0,w:o.assetWidth,h:Math.max(1,Math.round(o.assetHeight*.50))};o.occlusion.enabled=true;devTemplateState.regionTool={target:'asset',kind:'occlusion',objectId:o.id,zone:'primary'};devTemplateState.regionDraw=null;devTemplateRenderCanvas();devTemplateRenderInspector();toast('Drag over the artwork to draw its primary Behind zone.');}
}


devTemplateOpenBtn?.addEventListener('click',()=>devTemplateSetOpen(true));
devTemplateCloseBtn?.addEventListener('click',()=>devTemplateSetOpen(false));
devTemplateNewBtn?.addEventListener('click',devTemplateNew);devTemplateSaveBtn?.addEventListener('click',devTemplateSaveCurrent);devTemplateDuplicateBtn?.addEventListener('click',devTemplateDuplicateCurrent);devTemplateExportBtn?.addEventListener('click',devTemplateExportCurrent);devTemplateExportAllBtn?.addEventListener('click',devTemplateExportLibrary);devTemplateImportInput?.addEventListener('change',()=>devTemplateImport(devTemplateImportInput.files?.[0]));devTemplateDeleteTemplateBtn?.addEventListener('click',devTemplateDeleteSaved);devTemplateLoadBtn?.addEventListener('click',()=>devTemplateLoadSaved(devTemplateLibrarySelect?.value));devTemplateScanAssetsBtn?.addEventListener('click',devTemplateOpenAssetFolderPicker);devTemplateAssetFolderInput?.addEventListener('change',()=>devTemplateScanAssetFolder(devTemplateAssetFolderInput.files));devTemplateRegisterAssetBtn?.addEventListener('click',devTemplateRegisterAsset);devTemplateAssetPathInput?.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();devTemplateRegisterAsset();}});devTemplateScanFolderAddBtn?.addEventListener('click',devTemplateAddScanFolder);devTemplateScanFolderCleanBtn?.addEventListener('click',devTemplateCleanExcludedAssets);devTemplateScanFolderInput?.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();devTemplateAddScanFolder();}});
devTemplateRoadWindowHead?.addEventListener('pointerdown',devTemplateRoadWindowPointerDown);window.addEventListener('pointermove',devTemplateRoadWindowPointerMove,{passive:false});window.addEventListener('pointerup',devTemplateRoadWindowPointerFinish);window.addEventListener('pointercancel',devTemplateRoadWindowPointerFinish);devTemplateRoadWindowResetBtn?.addEventListener('click',devTemplateResetRoadWindowPosition);devTemplateRoadWindowMinimizeBtn?.addEventListener('click',devTemplateToggleRoadWindowMinimized);window.addEventListener('resize',()=>{if(devTemplateState.open)devTemplateApplyRoadWindowPosition();});
devTemplateRoadSheet?.addEventListener('change',()=>devTemplateChooseRoadSheet(devTemplateRoadSheet.value));devTemplateRoadTileSize?.addEventListener('change',()=>{devTemplateState.roadPaint.tileSize=Math.round(devTemplateClamp(devTemplateRoadTileSize.value,4,128));devTemplateState.roadPaint.tileIndex=0;devTemplateState.roadPaint.customStamp=null;devTemplatePersistView();devTemplateRenderRoadControls();devTemplateRenderCanvas();});devTemplateRoadScale?.addEventListener('change',()=>{devTemplateState.roadPaint.scale=devTemplateClamp(devTemplateRoadScale.value,1,4);if(devTemplateState.roadPaint.customStamp?.cells?.length)devTemplateState.roadPaint.customStamp.scale=devTemplateState.roadPaint.scale;devTemplatePersistView();devTemplateRenderRoadControls();devTemplateRenderCanvas();});devTemplateRoadPaletteZoom?.addEventListener('change',()=>{devTemplateState.roadPaint.paletteZoom=[1,1.25,1.5,2].includes(Number(devTemplateRoadPaletteZoom.value))?Number(devTemplateRoadPaletteZoom.value):1.25;devTemplatePersistView();devTemplateRenderRoadPalette();});devTemplateRoadPalette?.addEventListener('pointerdown',devTemplateRoadPaletteStart);devTemplateRoadPalette?.addEventListener('pointermove',devTemplateRoadPaletteMove);devTemplateRoadPalette?.addEventListener('pointerup',devTemplateRoadPaletteFinish);devTemplateRoadPalette?.addEventListener('pointercancel',devTemplateRoadPaletteFinish);devTemplateRoadPaintBtn?.addEventListener('click',()=>devTemplateRoadSetMode('paint'));devTemplateRoadEraseBtn?.addEventListener('click',()=>devTemplateRoadSetMode('erase'));devTemplateRoadSelectBtn?.addEventListener('click',()=>devTemplateRoadSetMode('select'));devTemplateRoadEyedropBtn?.addEventListener('click',()=>devTemplateRoadSetMode('eyedropper'));devTemplateRoadSaveStampBtn?.addEventListener('click',devTemplateRoadSaveCurrentStamp);devTemplateRoadStopBtn?.addEventListener('click',()=>devTemplateRoadSetMode('stop'));
devTemplateNameInput?.addEventListener('input',()=>{devTemplateState.current.name=String(devTemplateNameInput.value||'').slice(0,80);devTemplatePersistDraft();});devTemplateKindSelect?.addEventListener('change',()=>{devTemplateState.current.kind=devTemplateKindSelect.value;devTemplatePersistDraft();});
function devTemplateResizeFromInputs(){const t=devTemplateState.current;t.width=Math.round(devTemplateClamp(devTemplateWidthInput?.value,256,4096));t.height=Math.round(devTemplateClamp(devTemplateHeightInput?.value,256,4096));for(const key of ['entrance','exit']){t.anchors[key].x=devTemplateClamp(t.anchors[key].x,0,t.width);t.anchors[key].y=devTemplateClamp(t.anchors[key].y,0,t.height);}devTemplateState.playerRef.x=devTemplateClamp(devTemplateState.playerRef.x,0,t.width);devTemplateState.playerRef.y=devTemplateClamp(devTemplateState.playerRef.y,0,t.height);devTemplatePersistView();devTemplatePersistDraft();devTemplateRenderCanvas();devTemplateRenderInspector();}
devTemplateWidthInput?.addEventListener('change',devTemplateResizeFromInputs);devTemplateHeightInput?.addEventListener('change',devTemplateResizeFromInputs);devTemplateShowCollision?.addEventListener('change',()=>{devTemplateState.showCollision=devTemplateShowCollision.checked;devTemplateRenderCanvas();});devTemplateShowOcclusion?.addEventListener('change',()=>{devTemplateState.showOcclusion=devTemplateShowOcclusion.checked;devTemplateRenderCanvas();});devTemplateShowDoors?.addEventListener('change',()=>{devTemplateState.showDoors=devTemplateShowDoors.checked;devTemplateRenderCanvas();});devTemplateSnap?.addEventListener('change',()=>{devTemplateState.snap=[1,2,4,8,16,32,64].includes(Number(devTemplateSnap.value))?Number(devTemplateSnap.value):1;devTemplatePersistView();devTemplateRenderCanvas();});
devTemplateUndoBtn?.addEventListener('click',devTemplateUndo);devTemplateRedoBtn?.addEventListener('click',devTemplateRedo);
devTemplateZoom?.addEventListener('change',()=>devTemplateSetZoom(Number(devTemplateZoom.value)));devTemplateZoomOutBtn?.addEventListener('click',()=>devTemplateStepZoom(-1));devTemplateZoomResetBtn?.addEventListener('click',()=>devTemplateSetZoom(1));devTemplateZoomInBtn?.addEventListener('click',()=>devTemplateStepZoom(1));devTemplatePixelGrid?.addEventListener('change',()=>{devTemplateState.pixelGrid=devTemplatePixelGrid.checked;devTemplatePersistView();devTemplateRenderCanvas();});devTemplateShowPlayerRef?.addEventListener('change',()=>{devTemplateState.playerRef.shown=devTemplateShowPlayerRef.checked;if(devTemplateState.playerRef.shown&&(devTemplateState.playerRef.x<0||devTemplateState.playerRef.x>devTemplateState.current.width||devTemplateState.playerRef.y<0||devTemplateState.playerRef.y>devTemplateState.current.height)){devTemplateState.playerRef.x=Math.round(devTemplateState.current.width/2);devTemplateState.playerRef.y=Math.round(devTemplateState.current.height/2);}if(!devTemplateState.playerRef.shown&&devTemplateState.selection?.kind==='reference')devTemplateState.selection=null;devTemplatePersistView();devTemplateRenderCanvas();devTemplateRenderInspector();});devTemplatePlayerRefClass?.addEventListener('change',()=>{devTemplateState.playerRef.className=DEV_TEMPLATE_PLAYER_REF_SPRITES[devTemplatePlayerRefClass.value]?devTemplatePlayerRefClass.value:'Votary';devTemplatePersistView();devTemplateRenderCanvas();devTemplateRenderInspector();});devTemplatePlayerRefCenterBtn?.addEventListener('click',devTemplateCenterPlayerRef);
devTemplateInspector?.addEventListener('change',e=>{const zoneToggle=e.target.closest('[data-template-zone-toggle]');if(zoneToggle){const [scope,kind,indexRaw]=String(zoneToggle.dataset.templateZoneToggle||'').split(':'),index=Number(indexRaw),road=scope==='road'?devTemplateSelectedRoadItem():null,o=scope==='asset'?devTemplateSelectedObject():null,target=road||o,key=kind==='occlusion'?'occlusionZones':'collisionZones';if(!target||!Number.isFinite(index)||!(target[key]||[])[index])return;const zones=devTemplateDeepClone(target[key]||[]);zones[index].enabled=zoneToggle.checked;if(road)devTemplateRoadSetSharedZones(road,kind,zones);else o[key]=zones;devTemplatePersistDraft();devTemplateRenderCanvas();devTemplateRenderInspector();return;}const roadLabel=e.target.closest('[data-template-road-label]');if(roadLabel){const road=devTemplateSelectedRoadItem();if(!road)return;const label=String(roadLabel.value||road.label||'Road piece').trim().slice(0,80)||'Road piece';for(const tile of road.tiles)tile.label=label;devTemplatePersistDraft();devTemplateRenderCanvas();devTemplateRenderInspector();return;}const preset=e.target.closest('[data-template-filter-preset]');if(preset){devTemplateApplyFilterPreset(preset.value);return;}const field=e.target.closest('[data-template-field]');if(field){devTemplateApplyInspectorField(field.dataset.templateField,field.value);return;}const toggle=e.target.closest('[data-template-toggle]');if(toggle){const road=devTemplateSelectedRoadItem(),o=devTemplateSelectedObject();if(toggle.dataset.templateToggle==='road-locked'&&road){devTemplateHistorySetNext('Change shared tile lock');devTemplateRoadSetSharedLocked(road,toggle.checked);}else if(o){if(toggle.dataset.templateToggle==='locked')o.locked=toggle.checked;else if(toggle.dataset.templateToggle==='collision')o.collision.enabled=toggle.checked;else if(toggle.dataset.templateToggle==='occlusion'){o.occlusion=o.occlusion||{enabled:true,x:0,y:0,w:o.assetWidth,h:Math.max(1,Math.round(o.assetHeight*.5))};o.occlusion.enabled=toggle.checked;}else if(toggle.dataset.templateToggle==='door')o.door.enabled=toggle.checked;}else return;devTemplatePersistDraft();devTemplateRenderCanvas();devTemplateRenderInspector();}});
devTemplateInspector?.addEventListener('input',e=>{if(e.target.matches('input[type="range"][data-template-field]')){devTemplateHistory.skipNext=true;devTemplateApplyInspectorField(e.target.dataset.templateField,e.target.value,{renderInspector:false});}});devTemplateInspector?.addEventListener('click',e=>{const b=e.target.closest('[data-template-action]');if(b)devTemplateApplyInspectorAction(b.dataset.templateAction);});

devTemplateCanvas?.addEventListener('pointerdown',e=>{
  if(e.button!==0)return;if(devTemplateState.marquee&&devTemplateState.marquee.pointerId!==e.pointerId)devTemplateState.marquee=null;if(devTemplateState.drag&&devTemplateState.drag.pointerId!==e.pointerId&&devTemplateState.drag.kind!=='road-group')devTemplateState.drag=null;const p=devTemplateCanvasPoint(e.clientX,e.clientY);if(devTemplateRoadPointerStart(e,p))return;
  if(devTemplateState.regionTool){const tool=devTemplateState.regionTool,road=tool.target==='road'?devTemplateRoadItem(tool.roadKey):null,o=tool.target==='asset'?devTemplateState.current.objects.find(v=>v.id===tool.objectId):null;if(!road&&!o){devTemplateState.regionTool=null;devTemplateRenderCanvas();return;}const targetRect=road?road.rect:devTemplateObjectRect(o),scale=Math.max(.01,road?road.scale:o.scale),localW=targetRect.w/scale,localH=targetRect.h/scale;if(p.x<targetRect.x||p.x>targetRect.x+targetRect.w||p.y<targetRect.y||p.y>targetRect.y+targetRect.h){toast(`Start the ${tool.kind==='collision'?'collision':'Behind'} zone inside the selected artwork.`);return;}const lx=devTemplateClamp((p.x-targetRect.x)/scale,0,localW),ly=devTemplateClamp((p.y-targetRect.y)/scale,0,localH),key=tool.kind==='occlusion'?'occlusionZones':'collisionZones';let zoneIndex=tool.zone;if(zoneIndex==='new'){const zones=devTemplateDeepClone((road||o)[key]||[]);zones.push({id:devTemplateId('zone'),enabled:true,x:Math.round(lx),y:Math.round(ly),w:1,h:1});zoneIndex=zones.length-1;tool.zone=zoneIndex;if(road)devTemplateRoadSetSharedZones(road,tool.kind,zones);else o[key]=zones;}else if(zoneIndex==='primary'&&o){const q=tool.kind==='occlusion'?o.occlusion:o.collision;q.enabled=true;q.x=Math.round(lx);q.y=Math.round(ly);q.w=1;q.h=1;}else{const zones=devTemplateDeepClone((road||o)[key]||[]),q=zones[Number(zoneIndex)];if(!q){devTemplateState.regionTool=null;devTemplateRenderCanvas();return;}q.enabled=true;q.x=Math.round(lx);q.y=Math.round(ly);q.w=1;q.h=1;if(road)devTemplateRoadSetSharedZones(road,tool.kind,zones);else o[key]=zones;}devTemplateState.regionDraw={pointerId:e.pointerId,target:tool.target,kind:tool.kind,objectId:tool.objectId,roadKey:tool.roadKey,zone:zoneIndex,startX:lx,startY:ly};devTemplateCanvas.setPointerCapture?.(e.pointerId);devTemplateRenderCanvas();return;}
  const candidates=devTemplateCandidatesAt(p);if(!candidates.length){devTemplateState.marquee={pointerId:e.pointerId,startX:p.x,startY:p.y,x:p.x,y:p.y,additive:!!e.shiftKey};devTemplateCanvas.setPointerCapture?.(e.pointerId);devTemplateRenderCanvas();return;}
  const selectedAssets=new Set(devTemplateSelectedAssetIds()),selectedRoads=new Set(devTemplateSelectedRoadKeys()),candidateSelected=candidates.find(c=>(c.kind==='asset'&&selectedAssets.has(c.id))||(c.kind==='road'&&selectedRoads.has(c.id)))||candidates.find(c=>devTemplateState.selection&&c.kind===devTemplateState.selection.kind&&c.id===devTemplateState.selection.id);if(candidates.length>1&&!candidateSelected){devTemplateShowPicker(candidates,e.clientX,e.clientY);return;}const target=candidateSelected||candidates[0];
  if(target.kind==='asset'||target.kind==='road'){
    if(e.shiftKey){devTemplateSetSelection({kind:target.kind,id:target.id},{additive:true,toggle:true});return;}
    const alreadySelected=target.kind==='asset'?selectedAssets.has(target.id):selectedRoads.has(target.id);if(!alreadySelected)devTemplateSetSelection({kind:target.kind,id:target.id});
    const clickedAsset=target.kind==='asset'?devTemplateState.current.objects.find(v=>v.id===target.id):null,clickedRoad=target.kind==='road'?devTemplateRoadItem(target.id):null;if(clickedAsset?.locked||clickedRoad?.locked){toast('That item is position-locked.');return;}
    const allAssets=devTemplateSelectedObjects(),allRoads=devTemplateSelectedRoadItems(),total=allAssets.length+allRoads.length;if(target.kind==='asset'&&total===1){devTemplateState.drag={pointerId:e.pointerId,kind:'asset',id:target.id,offsetX:p.x-clickedAsset.x,offsetY:p.y-clickedAsset.y};}
    else{const assetOrigins={},roadOrigins={};for(const o of allAssets)if(!o.locked)assetOrigins[o.id]={x:o.x,y:o.y};for(const item of allRoads)if(!item.locked)for(const tile of item.tiles)roadOrigins[tile.id]={x:tile.x,y:tile.y};const anchorRect=target.kind==='asset'?devTemplateObjectRect(clickedAsset):clickedRoad.rect;devTemplateState.drag={pointerId:e.pointerId,kind:'template-group',id:target.id,startX:p.x,startY:p.y,anchorX:anchorRect.x,anchorY:anchorRect.y,offsetX:p.x-anchorRect.x,offsetY:p.y-anchorRect.y,assetOrigins,roadOrigins};}
    devTemplateCanvas.setPointerCapture?.(e.pointerId);return;
  }
  devTemplateSetSelection({kind:target.kind,id:target.id});const a=devTemplateSelectedAnchor(),ref=devTemplateSelectedReference(),origin=a?{x:a.x,y:a.y}:ref?{x:ref.x,y:ref.y}:null;if(!origin)return;devTemplateState.drag={pointerId:e.pointerId,kind:target.kind,id:target.id,offsetX:p.x-origin.x,offsetY:p.y-origin.y};devTemplateCanvas.setPointerCapture?.(e.pointerId);
});
devTemplateCanvas?.addEventListener('pointermove',e=>{
  const roadPoint=devTemplateCanvasPoint(e.clientX,e.clientY);if(devTemplateRoadPointerMove(e,roadPoint))return;
  const rd=devTemplateState.regionDraw;if(rd&&rd.pointerId===e.pointerId){const road=rd.target==='road'?devTemplateRoadItem(rd.roadKey):null,o=rd.target==='asset'?devTemplateState.current.objects.find(v=>v.id===rd.objectId):null;if(!road&&!o)return;const targetRect=road?road.rect:devTemplateObjectRect(o),scale=Math.max(.01,road?road.scale:o.scale),localW=targetRect.w/scale,localH=targetRect.h/scale,p=devTemplateCanvasPoint(e.clientX,e.clientY),lx=devTemplateClamp((p.x-targetRect.x)/scale,0,localW),ly=devTemplateClamp((p.y-targetRect.y)/scale,0,localH),x=Math.min(rd.startX,lx),y=Math.min(rd.startY,ly),w=Math.max(1,Math.abs(lx-rd.startX)),h=Math.max(1,Math.abs(ly-rd.startY));if(rd.zone==='primary'&&o){const q=rd.kind==='occlusion'?o.occlusion:o.collision;q.enabled=true;q.x=Math.round(x);q.y=Math.round(y);q.w=Math.round(w);q.h=Math.round(h);}else{const key=rd.kind==='occlusion'?'occlusionZones':'collisionZones',zones=devTemplateDeepClone((road||o)[key]||[]),q=zones[Number(rd.zone)];if(!q)return;q.enabled=true;q.x=Math.round(x);q.y=Math.round(y);q.w=Math.round(w);q.h=Math.round(h);if(road)devTemplateRoadSetSharedZones(road,rd.kind,zones);else o[key]=zones;}devTemplateRequestCanvasRender();return;}
  const marquee=devTemplateState.marquee;if(marquee&&marquee.pointerId===e.pointerId){const p=devTemplateCanvasPoint(e.clientX,e.clientY);marquee.x=p.x;marquee.y=p.y;devTemplateRequestCanvasRender();return;}
  const d=devTemplateState.drag;if(!d||d.pointerId!==e.pointerId)return;const p=devTemplateCanvasPoint(e.clientX,e.clientY),snap=Math.max(1,devTemplateState.snap||1);
  if(d.kind==='template-group'){const snappedX=Math.round((p.x-d.offsetX)/snap)*snap,snappedY=Math.round((p.y-d.offsetY)/snap)*snap,dx=snappedX-d.anchorX,dy=snappedY-d.anchorY;for(const [id,origin] of Object.entries(d.assetOrigins||{})){const o=devTemplateState.current.objects.find(v=>v.id===id);if(o&&!o.locked){o.x=origin.x+dx;o.y=origin.y+dy;}}for(const [id,origin] of Object.entries(d.roadOrigins||{})){const tile=devTemplateRoadLayer().tiles.find(v=>v.id===id);if(tile&&!tile.locked){tile.x=origin.x+dx;tile.y=origin.y+dy;}}}
  else if(d.kind==='asset-group'){const dx=Math.round((p.x-d.startX)/snap)*snap,dy=Math.round((p.y-d.startY)/snap)*snap;for(const [id,origin] of Object.entries(d.origins||{})){const o=devTemplateState.current.objects.find(v=>v.id===id);if(o&&!o.locked){o.x=origin.x+dx;o.y=origin.y+dy;}}}
  else{const nx=Math.round((p.x-d.offsetX)/snap)*snap,ny=Math.round((p.y-d.offsetY)/snap)*snap;if(d.kind==='asset'){const o=devTemplateState.current.objects.find(v=>v.id===d.id);if(!o||o.locked)return;o.x=nx;o.y=ny;}else if(d.kind==='reference'){devTemplateState.playerRef.x=devTemplateClamp(nx,0,devTemplateState.current.width);devTemplateState.playerRef.y=devTemplateClamp(ny,0,devTemplateState.current.height);}else{const a=devTemplateState.current.anchors[d.id];if(!a)return;a.x=devTemplateClamp(nx,0,devTemplateState.current.width);a.y=devTemplateClamp(ny,0,devTemplateState.current.height);}}
  devTemplateRequestCanvasRender();
});
function devTemplateFinishDrag(e){
  if(devTemplateRoadPointerFinish(e))return;
  const rd=devTemplateState.regionDraw;if(rd&&rd.pointerId===e.pointerId){devTemplateState.regionDraw=null;devTemplateState.regionTool=null;try{devTemplateCanvas.releasePointerCapture?.(e.pointerId);}catch{}devTemplateHistorySetNext(`Draw ${rd.kind==='collision'?'collision':'Behind'} zone`);devTemplatePersistDraft();devTemplateRenderCanvas();devTemplateRenderInspector();return;}
  const marquee=devTemplateState.marquee;if(marquee&&marquee.pointerId===e.pointerId){const x=Math.min(marquee.startX,marquee.x),y=Math.min(marquee.startY,marquee.y),w=Math.abs(marquee.x-marquee.startX),h=Math.abs(marquee.y-marquee.startY),dragged=w>=2||h>=2,baseAssets=marquee.additive?devTemplateSelectedAssetIds():[],baseRoads=marquee.additive?devTemplateSelectedRoadKeys():[];devTemplateState.marquee=null;try{devTemplateCanvas.releasePointerCapture?.(e.pointerId);}catch{}if(!dragged){if(!marquee.additive)devTemplateSetSelection(null);else{devTemplateRenderCanvas();devTemplateRenderInspector();}return;}const rect={x,y,w:Math.max(1,w),h:Math.max(1,h)},assetHits=devTemplateState.current.objects.filter(o=>devTemplateRectIntersects(rect,devTemplateObjectRect(o))).map(o=>o.id),roadHits=devTemplateAllRoadItems().filter(item=>item.rect&&devTemplateRectIntersects(rect,item.rect)).map(item=>item.key),assetIds=[...new Set([...baseAssets,...assetHits])],roadKeys=[...new Set([...baseRoads,...roadHits])];devTemplateState.multiSelection=assetIds;devTemplateState.multiRoadSelection=roadKeys;devTemplateState.selection=roadKeys.length?{kind:'road',id:roadKeys.at(-1)}:assetIds.length?{kind:'asset',id:assetIds.at(-1)}:null;devTemplateRenderCanvas();devTemplateRenderInspector();return;}
  const d=devTemplateState.drag;if(!d||d.pointerId!==e.pointerId)return;devTemplateState.drag=null;try{devTemplateCanvas.releasePointerCapture?.(e.pointerId);}catch{}if(d.kind==='reference')devTemplatePersistView();else{devTemplateHistorySetNext('Move selection');devTemplatePersistDraft();}devTemplateRenderInspector();
}
devTemplateCanvas?.addEventListener('pointerup',devTemplateFinishDrag);devTemplateCanvas?.addEventListener('pointercancel',devTemplateFinishDrag);
// Pointer capture should normally deliver the release back to the Workshop canvas,
// but browsers can still lose it when the pointer crosses floating editor panels or
// leaves the viewport. This fallback ends only an interaction owned by this pointer,
// so marquee/group movement can never remain stuck after mouse/touch release.
function devTemplateFinishCanvasInteractionFallback(e){
  const ownsMarquee=devTemplateState.marquee?.pointerId===e.pointerId,ownsDrag=devTemplateState.drag?.pointerId===e.pointerId,ownsRegion=devTemplateState.regionDraw?.pointerId===e.pointerId,ownsRoad=devTemplateState.roadPaint.active&&devTemplateState.roadPaint.pointerId===e.pointerId;
  if(!ownsMarquee&&!ownsDrag&&!ownsRegion&&!ownsRoad)return;
  devTemplateFinishDrag(e);
}
window.addEventListener('pointerup',devTemplateFinishCanvasInteractionFallback);window.addEventListener('pointercancel',devTemplateFinishCanvasInteractionFallback);window.addEventListener('blur',()=>{if(!devTemplateState.open)return;const had=!!devTemplateState.marquee||!!devTemplateState.drag||!!devTemplateState.regionDraw||!!devTemplateState.regionTool||devTemplateState.roadPaint.pointerId!==null;devTemplateState.marquee=null;if(devTemplateState.drag?.kind!=='road-group')devTemplateState.drag=null;devTemplateState.regionDraw=null;devTemplateState.regionTool=null;devTemplateState.roadPaint.pointerId=null;devTemplateState.roadPaint.lastKey='';devTemplateState.roadPaint.strokeGroupId='';if(had){devTemplateRenderCanvas();devTemplateRenderInspector();}});

devTemplateRepairStoredAssetPaths({announce:false});
devTemplateRefresh();
devTemplateHistoryInit();
window.addEventListener('beforeunload',()=>{devTemplateFlushDraftStorage();devTemplateHistoryPersist({immediate:true});});
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden'){devTemplateFlushDraftStorage();devTemplateHistoryPersist({immediate:true});}});

devToggle?.addEventListener('click',()=>{updateDevWorldSeed();devSetMode(!devPlacement.enabled);});
devClose?.addEventListener('click',()=>devSetMode(false));
devPlaceLightBtn?.addEventListener('click',()=>devSetPlaceLightMode(devPlacement.placeMode!=='light'));
devMiningSwingBtn?.addEventListener('click',()=>{devSetPlaceLightMode(false);devSelect({id:'miningSwing',label:'Mining pickaxe · swing preview',editable:true,kind:'animation'});});
devSmithingHammerBtn?.addEventListener('click',()=>{devSetPlaceLightMode(false);devSelect({id:'smithingHammer',label:'Smithing hammer · swing preview',editable:true,kind:'animation'});});
devOreMinimapBtn?.addEventListener('click',()=>{devSetPlaceLightMode(false);devSelect({id:'oreMinimap',label:'Ore minimap · pickaxe markers',editable:true,kind:'map'});world.refreshMinimap?.();});
devOreVeinsBtn?.addEventListener('click',()=>{devSetPlaceLightMode(false);devSelect({id:'oreVeins',label:'Ore veins · visual sizes',editable:true,kind:'resource'});});
devQuestTrackerBtn?.addEventListener('click',()=>{devSetPlaceLightMode(false);devSelect({id:'questTracker',label:'Quest tracker · text size',editable:true,kind:'ui'});});
devSmithingAnvilBtn?.addEventListener('click',()=>{devSetPlaceLightMode(false);devSelect({id:'smithingAnvil',label:'Dawngate anvil · placement',editable:true,kind:'prop'});});
devDeleteBtn?.addEventListener('click',devDeleteSelectedLight);
devDragBtn?.addEventListener('click',()=>{if(devDragBtn.disabled)return;devPlacement.dragUnlocked=!devPlacement.dragUnlocked;devDragBtn.classList.toggle('active',devPlacement.dragUnlocked);devDragBtn.textContent=devPlacement.dragUnlocked?'Drag unlocked':'Drag locked';devDragBtn.setAttribute('aria-pressed',String(devPlacement.dragUnlocked));});
devResetBtn?.addEventListener('click',devResetSelected);devResetAllBtn?.addEventListener('click',devResetAll);devExportBtn?.addEventListener('click',devExport);devImportInput?.addEventListener('change',()=>devImport(devImportInput.files?.[0]));
devInspector?.addEventListener('input',event=>{const el=event.target.closest('[data-dev-path]');if(!el)return;const min=Number(el.min),max=Number(el.max),raw=Number(el.value);if(!Number.isFinite(raw))return;devApplyPath(el.dataset.devPath,Math.max(Number.isFinite(min)?min:-Infinity,Math.min(Number.isFinite(max)?max:Infinity,raw)));});

const fathomMeter=document.getElementById("fathomMeter"),currentFathomRow=document.getElementById("travelCurrentRow");
fathomMeter?.addEventListener("click",()=>{const open=fathomMeter.getAttribute("aria-expanded")==="true";fathomMeter.setAttribute("aria-expanded",String(!open));if(currentFathomRow)currentFathomRow.hidden=open;});

const restored=api.restoreWorld();
world.restore(restored,api.getWorldPositionDepth());
updateDevWorldSeed();
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
  if(devPlacement.enabled)return false;
  if(world.isSmithingForge?.())return false;
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

function freshWorldSeed(){
  try{
    const values=new Uint32Array(1);
    globalThis.crypto?.getRandomValues?.(values);
    const seed=Number(values[0])>>>0;
    if(seed)return seed;
  }catch(err){console.warn('Secure world seed generation unavailable; using fallback.',err);}
  return (Math.floor(Math.random()*0xffffffff)>>>0)||1;
}
function updateDevWorldSeed(){if(devWorldSeed)devWorldSeed.textContent=String(Number(world.seed)>>>0);}
function resetForNewRun(){
  flushMovement();
  movementMs=0;movementKind='world';lastDepthPush=0;lastWorldSave=performance.now();lastMoving=false;lastThreatened=false;
  world.endCombat({defeated:false});secondaryHostiles.clear();readChannel=null;closeEnemyMenu();
  // Each delver owns a fresh procedural descent. The seed is then stored in the
  // normal world snapshot, so reloads keep this character's exact geography.
  world.seed=freshWorldSeed();
  world.restore(null,0);
  updateDevWorldSeed();
  previous={state:null,foeHp:null,heroHp:null,foeDefeated:false,foeEntityId:null};
  api.saveWorld(world.snapshot());
  sync();
}

function startForgeAnimation(detail={}){
  const started=world.beginSmithingForge?.(detail,()=>{
    const item=api.completeBronzeForge?.(detail.recipeId);
    if(item){toast(`${detail.name||'Item'} forged.`);sync();api.saveWorld?.(world.snapshot());}
    else toast('Forging could not be completed.');
  });
  if(started)sync();
  return !!started;
}

window.LowfathomWorldBridge={sync,world,resetForNewRun,startScriptedCombat,startForgeAnimation,refreshPlayerVisualScale:()=>{if(devTemplateState?.open){devTemplateRenderCanvas();devTemplateRenderInspector();}}};
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
    const allowed=!devPlacement.enabled&&uiAllowsWorld();if(world.inputEnabled!==allowed)world.setInputEnabled(allowed);
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
  if(result.type==='ore'){
    const cfg=api.getMiningConfig?.(result.entity?.oreId||'copper');
    if(!cfg?.canMine){toast(cfg?.reason||'A suitable pickaxe is required.');return;}
    if(!world.beginMining?.(result.entity,cfg))toast('Move closer to the vein.');
  }
  else if(result.type==='smithingstation')api.openSmithingStation?.(result.station||'anvil');
  else if(result.type==='chest')api.openChest(result.entity.id,result.depth);
  else if(result.type==='glint')api.investigateGlint(result.entity.id,result.depth);
  else if(result.type==='hollow')api.useHollow(result.entity.id,result.depth,result.entity.kind||'ordinary');
  else if(result.type==='townlocation')api.openTownLocation?.(result.location?.id);
  else if(result.type==='townnpc')api.interactTownNpc?.(result.npc);
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
interactBtn.addEventListener('click',()=>{if(api.activateUiPrimary?.())return;if(api.finishInteractionText?.())return;doInteract();});
lookBtn.addEventListener('click',()=>{if(uiAllowsWorld())world.look();});


// Creature selection: left click / quick tap targets; right click / long press
// opens the same compact context menu. Pointer events keep mouse, touch and pen
// on one input path without forcing bump-to-fight.
let canvasTouch=null;
canvas.addEventListener('pointerdown',e=>{
  if(devPlacement.enabled){
    e.preventDefault();closeEnemyMenu();devHidePicker();
    const point=worldPointFromClient(e.clientX,e.clientY);
    if(devPlacement.placeMode==='light'){devPlaceLightAt(point);return;}
    if(devPlacement.dragUnlocked&&devPlacement.selection==='playerLanternGlow'){
      const pos=world.playerLanternScreenPosition?.();if(pos&&Math.hypot(point.x-pos.x,point.y-pos.y)<=30){devPlacement.drag={id:e.pointerId,kind:'playerLanternGlow'};canvas.setPointerCapture?.(e.pointerId);return;}
    }
    if(devPlacement.dragUnlocked&&devPlacedLightKey()){const light=devPlacedLightFromConfig(world.getDevPlacementConfig());if(light){const pos=world.worldToScreen?.(light.x,light.y);if(pos&&Math.hypot(point.x-pos.x,point.y-pos.y)<=24){devPlacement.drag={id:e.pointerId,kind:'placedLight',key:String(light.id)};canvas.setPointerCapture?.(e.pointerId);return;}}}
    if(devPlacement.dragUnlocked&&devPlacement.selection==='smithingAnvil'){const pos=world.smithingAnvilWorldPosition?.();const sp=pos?world.worldToScreen?.(pos.x,pos.y):null;if(sp&&Math.hypot(point.x-sp.x,point.y-sp.y)<=28){devPlacement.drag={id:e.pointerId,kind:'smithingAnvil'};canvas.setPointerCapture?.(e.pointerId);return;}}
    const candidates=world.getDevPlacementCandidates?.(point.x,point.y)||[];
    if(candidates.length===1)devSelect(candidates[0]);else if(candidates.length>1)devShowPicker(candidates,e.clientX,e.clientY);else devSelect(null);
    return;
  }
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
canvas.addEventListener('pointermove',e=>{
  if(devPlacement.enabled&&devPlacement.drag?.id===e.pointerId){
    e.preventDefault();const point=worldPointFromClient(e.clientX,e.clientY),cfg=world.getDevPlacementConfig();
    if(devPlacement.drag.kind==='placedLight'){const light=devPlacedLightFromConfig(cfg,devPlacement.drag.key);if(!light)return;const wp=devScreenToWorld(point);light.x=Math.round(wp.x);light.y=Math.round(wp.y);}
    else if(devPlacement.drag.kind==='smithingAnvil'){const wp=devScreenToWorld(point),anchor=world.smithingBlacksmithAnchor?.();if(!anchor)return;cfg.smithingAnvil.offsetX=Math.round(wp.x-anchor.x);cfg.smithingAnvil.offsetY=Math.round(wp.y-anchor.y);}
    else{const pos=world.playerLanternScreenPosition?.();if(!pos)return;const g=cfg.playerLanternGlow;g.sideOffset=Math.max(0,Math.min(40,Math.abs(point.x-pos.playerX)));g.y=Math.max(-32,Math.min(32,point.y-pos.playerY));}
    world.setDevPlacementConfig(cfg);devSaveConfig();devRenderInspector();return;
  }
  if(!canvasTouch||e.pointerId!==canvasTouch.id)return;canvasTouch.lastX=e.clientX;canvasTouch.lastY=e.clientY;if(Math.hypot(e.clientX-canvasTouch.startX,e.clientY-canvasTouch.startY)>16&&!canvasTouch.long){clearTimeout(canvasTouch.timer);canvasTouch=null;}
});
function finishCanvasPointer(e){if(devPlacement.drag?.id===e.pointerId){devPlacement.drag=null;try{canvas.releasePointerCapture?.(e.pointerId);}catch{}return;}if(!canvasTouch||e.pointerId!==canvasTouch.id)return;const p=canvasTouch;clearTimeout(p.timer);canvasTouch=null;if(!p.long)beginWorldTarget(p.enemy,{enemyInitiated:false});}
canvas.addEventListener('pointerup',finishCanvasPointer);canvas.addEventListener('pointercancel',e=>{if(canvasTouch&&e.pointerId===canvasTouch.id){clearTimeout(canvasTouch.timer);canvasTouch=null;}});
arena?.addEventListener('contextmenu',e=>{e.preventDefault();},{capture:true});
canvas.addEventListener('contextmenu',e=>{e.preventDefault();if(devPlacement.enabled){devHidePicker();return;}const enemy=enemyFromPointerEvent(e);if(!enemy){closeEnemyMenu();return;}openEnemyMenu(enemy,e.clientX,e.clientY);});
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
  if(e.code==='F3'&&!e.repeat){e.preventDefault();devSetMode(!devPlacement.enabled);return;}
  if(devPlacement.enabled&&devTemplateState?.open&&(e.ctrlKey||e.metaKey)&&!e.altKey&&!e.repeat){if(e.code==='KeyZ'){e.preventDefault();if(e.shiftKey)devTemplateRedo();else devTemplateUndo();return;}if(e.code==='KeyY'){e.preventDefault();devTemplateRedo();return;}}
  if(worldShortcutTargetIsEditable(e.target))return;
  if(devPlacement.enabled){
    if(devTemplateState?.open){
      if(e.code==='Escape'){e.preventDefault();if(devTemplateState.roadPaint.active){devTemplateRoadSetMode('stop');toast('Tile painter stopped.');}else if(devTemplateState.marquee||devTemplateState.drag){devTemplateState.marquee=null;devTemplateState.drag=null;devTemplateRenderCanvas();devTemplateRenderInspector();}else if(devTemplateState.regionTool||devTemplateState.regionDraw){devTemplateState.regionTool=null;devTemplateState.regionDraw=null;devTemplateRenderCanvas();toast('Region drawing cancelled.');}else if((devTemplateState.roadPaint.selectedIds||[]).length){devTemplateRoadClearSelection();devTemplateRenderCanvas();devTemplateRenderRoadControls();}else if(devTemplateState.selection||devTemplateSelectedTemplateCount())devTemplateSetSelection(null);else devTemplateSetOpen(false);return;}
      const step=e.shiftKey?5:1;if(e.code==='ArrowLeft'){e.preventDefault();devTemplateNudge(-step,0);return;}if(e.code==='ArrowRight'){e.preventDefault();devTemplateNudge(step,0);return;}if(e.code==='ArrowUp'){e.preventDefault();devTemplateNudge(0,-step);return;}if(e.code==='ArrowDown'){e.preventDefault();devTemplateNudge(0,step);return;}if((e.code==='Delete'||e.code==='Backspace')&&(devTemplateState.roadPaint.selectedIds||[]).length){e.preventDefault();if(devTemplateRoadRemoveByIds(devTemplateState.roadPaint.selectedIds)){devTemplateRoadClearSelection();devTemplatePersistDraft();devTemplateRenderCanvas();devTemplateRenderRoadControls();}return;}if((e.code==='Delete'||e.code==='Backspace')&&devTemplateSelectedTemplateCount()){e.preventDefault();devTemplateDeleteSelected();return;}return;
    }
    if(e.code==='Escape'){e.preventDefault();if(devPlacement.placeMode)devSetPlaceLightMode(false);else devSelect(null);return;}
    if((e.code==='Delete'||e.code==='Backspace')&&devPlacedLightKey()){e.preventDefault();devDeleteSelectedLight();return;}
    const step=e.shiftKey?5:1;if(e.code==='ArrowLeft'){e.preventDefault();devNudge(-step,0);return;}if(e.code==='ArrowRight'){e.preventDefault();devNudge(step,0);return;}if(e.code==='ArrowUp'){e.preventDefault();devNudge(0,-step);return;}if(e.code==='ArrowDown'){e.preventDefault();devNudge(0,step);return;}
    return;
  }
  if(e.code==='Escape'&&!e.repeat){if(api.closeTopUi?.()){e.preventDefault();sync();return;}if(!enemyMenu.hidden){e.preventDefault();closeEnemyMenu();return;}}
  if(e.code==='KeyI'&&!e.repeat&&api.getState?.()){e.preventDefault();if(api.inventoryOpen())api.closeInventory();else api.openInventory();sync();return;}
  if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','KeyW','KeyA','KeyS','KeyD'].includes(e.code)){if(uiAllowsWorld()){e.preventDefault();world.keyDown(e.code);}}
  if((e.code==='KeyE'||e.code==='Space')&&!e.repeat){if(api.activateUiPrimary?.()){e.preventDefault();sync();return;}if(api.finishInteractionText?.()){e.preventDefault();return;}if(uiAllowsWorld()){e.preventDefault();doInteract();}}
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
