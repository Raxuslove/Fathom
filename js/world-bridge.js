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
const devDragBtn=document.getElementById('btnDevPlacementDrag');
const devResetBtn=document.getElementById('btnDevPlacementReset');
const devResetAllBtn=document.getElementById('btnDevPlacementResetAll');
const devExportBtn=document.getElementById('btnDevPlacementExport');
const devImportInput=document.getElementById('devPlacementImport');
const travelRoot=document.getElementById('travel');
let devPlacement={enabled:false,selection:'',selectionMeta:null,dragUnlocked:false,drag:null};

function devLoadConfig(){
  try{const raw=localStorage.getItem(DEV_PLACEMENT_STORAGE);return raw?JSON.parse(raw):null;}catch(err){console.warn('Developer placement settings could not be loaded.',err);return null;}
}
function devSaveConfig(){
  try{localStorage.setItem(DEV_PLACEMENT_STORAGE,JSON.stringify(world.getDevPlacementConfig?.()||{}));}catch(err){console.warn('Developer placement settings could not be saved.',err);}
}
world.setDevPlacementConfig?.(devLoadConfig());

function devGetPath(obj,path){return String(path||'').split('.').reduce((v,k)=>v&&v[k],obj);}
function devSetPath(obj,path,value){const parts=String(path||'').split('.');let cur=obj;for(let i=0;i<parts.length-1;i++){if(!cur[parts[i]]||typeof cur[parts[i]]!=='object')cur[parts[i]]={};cur=cur[parts[i]];}cur[parts.at(-1)]=value;}
function devField(path,title,sub,min,max,step){
  const value=Number(devGetPath(world.getDevPlacementConfig(),path));
  return `<div class="dev-placement-field"><label><b>${title}</b><span>${sub}</span></label><input type="number" data-dev-path="${path}" min="${min}" max="${max}" step="${step}" value="${Number.isFinite(value)?value:0}"><input type="range" data-dev-path="${path}" min="${min}" max="${max}" step="${step}" value="${Number.isFinite(value)?value:0}"></div>`;
}
function devSelectionInfo(id){
  if(id==='playerLanternGlow')return{id,label:'Player lantern · warm glow',editable:true,kind:'light'};
  if(id==='playerLanternVisibility')return{id,label:'Player lantern · visibility radius',editable:true,kind:'light'};
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
  if(!meta){devSelected.innerHTML='<em>Selected</em><b>Nothing</b><span>Click near the player to choose a target.</span>';devInspector.innerHTML='';devDragBtn.disabled=true;devResetBtn.disabled=true;return;}
  devSelected.innerHTML=`<em>Selected</em><b>${meta.label}</b><span>${meta.editable?'Editable visual override. Saved automatically.':'Protected in this first editor pass.'}</span>`;
  devDragBtn.disabled=!meta.editable||meta.id!=='playerLanternGlow';devResetBtn.disabled=!meta.editable;
  if(meta.id==='playerLanternGlow'){
    devInspector.innerHTML=`<div class="dev-placement-fields">${devField('playerLanternGlow.sideOffset','Side offset','Distance from player toward the held lantern.',0,40,1)}${devField('playerLanternGlow.y','Vertical offset','Positive values move the glow downward.',-32,32,1)}${devField('playerLanternGlow.innerRadius','Inner glow radius','Bright warm halo immediately around the lantern.',3,64,1)}${devField('playerLanternGlow.outerRadius','Outer glow radius','Fainter warm halo beyond the inner glow.',5,96,1)}${devField('playerLanternGlow.brightness','Brightness','1.00 is the original intensity.',.15,2.5,.05)}</div>`;
  }else if(meta.id==='playerLanternVisibility'){
    devInspector.innerHTML=`<div class="dev-placement-fields">${devField('playerLanternVisibility.clearRadius','Clear radius','Fully revealed world around the player.',80,600,4)}${devField('playerLanternVisibility.featherRadius','Feather radius','Soft edge immediately outside the clear area.',90,680,4)}${devField('playerLanternVisibility.falloffOuter','Falloff reach','Outer edge of partial visibility.',120,900,4)}${devField('playerLanternVisibility.falloffStrength','Falloff strength','How strongly the partial-visibility band cuts darkness.',0,.8,.02)}</div>`;
  }else{
    devInspector.innerHTML='<div class="dev-placement-protected">This target is selectable so overlapping objects are unambiguous, but editing it is intentionally locked for now. That prevents accidental player movement, collision damage, quest deletion, or terrain corruption.</div>';
  }
}
function devSelect(meta){
  devPlacement.selectionMeta=meta||null;devPlacement.selection=meta?.id||'';world.setDevPlacementSelection?.(devPlacement.selection);devHidePicker();devRenderInspector();
}
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
  if(!devPlacement.enabled){devPlacement.drag=null;devPlacement.dragUnlocked=false;devDragBtn?.classList.remove('active');if(devDragBtn){devDragBtn.textContent='Drag locked';devDragBtn.setAttribute('aria-pressed','false');}devSelect(null);devHidePicker();}
  else{for(const code of ['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','KeyW','KeyA','KeyS','KeyD'])world.keyUp(code);world.setJoystick(0,0);devRenderInspector();}
}
function devApplyPath(path,value){
  const cfg=world.getDevPlacementConfig();devSetPath(cfg,path,value);world.setDevPlacementConfig(cfg);devSaveConfig();
  for(const el of devInspector?.querySelectorAll(`[data-dev-path="${path}"]`)||[]){if(String(el.value)!==String(value))el.value=String(value);}
}
function devNudge(dx,dy){
  if(devPlacement.selection!=='playerLanternGlow')return false;
  const cfg=world.getDevPlacementConfig(),g=cfg.playerLanternGlow,facing=world.playerLanternScreenPosition?.().facing||'right';
  if(dx){const screenSigned=(facing==='left'?g.sideOffset:-g.sideOffset)+dx;g.sideOffset=Math.max(0,Math.min(40,Math.abs(screenSigned)));}
  if(dy)g.y=Math.max(-32,Math.min(32,g.y+dy));
  world.setDevPlacementConfig(cfg);devSaveConfig();devRenderInspector();return true;
}
function devResetSelected(){
  const id=devPlacement.selection;if(!id)return;const cfg=world.getDevPlacementConfig(),defaults=world.defaultDevPlacementConfig?.();if(!defaults)return;
  if(id==='playerLanternGlow')cfg.playerLanternGlow=defaults.playerLanternGlow;
  else if(id==='playerLanternVisibility')cfg.playerLanternVisibility=defaults.playerLanternVisibility;
  else return;world.setDevPlacementConfig(cfg);devSaveConfig();devRenderInspector();toast('Selected developer override reset.');
}
function devResetAll(){
  if(!confirm('Reset all developer placement overrides to their build defaults?'))return;world.setDevPlacementConfig(world.defaultDevPlacementConfig?.());try{localStorage.removeItem(DEV_PLACEMENT_STORAGE);}catch{}devRenderInspector();toast('Developer placement overrides reset.');
}
function devExport(){
  const payload={format:'lowfathom-dev-placement',version:1,build:'v0.219.2',config:world.getDevPlacementConfig()};const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='lowfathom-dev-placement.json';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
async function devImport(file){
  if(!file)return;try{const parsed=JSON.parse(await file.text()),cfg=parsed?.config||parsed;world.setDevPlacementConfig(cfg);devSaveConfig();devRenderInspector();toast('Developer placement settings imported.');}catch(err){console.error(err);toast('That developer placement JSON could not be imported.');}finally{if(devImportInput)devImportInput.value='';}
}



// v0.219.0 — Settlement Template Workshop
// This editor intentionally does not write into the active procedural world.
// It authors reusable local-coordinate stamps that can later be consumed by the
// settlement generator. The browser keeps a draft and named library; JSON export
// is the durable handoff/project copy.
const DEV_TEMPLATE_LIBRARY_STORAGE='lowfathom-dev-template-library-v1';
const DEV_TEMPLATE_DRAFT_STORAGE='lowfathom-dev-template-draft-v1';
const DEV_TEMPLATE_ASSET_STORAGE='lowfathom-dev-template-assets-v1';
const DEV_TEMPLATE_VIEW_STORAGE='lowfathom-dev-template-view-v1';
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
const devTemplateAssets=document.getElementById('devTemplateAssets');
const devTemplateShowCollision=document.getElementById('devTemplateShowCollision');
const devTemplateShowOcclusion=document.getElementById('devTemplateShowOcclusion');
const devTemplateShowDoors=document.getElementById('devTemplateShowDoors');
const devTemplateSnap=document.getElementById('devTemplateSnap');
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
function devTemplateDefault(){return{format:'lowfathom-settlement-template',version:2,id:'',name:'Untitled Town',kind:'town',width:960,height:640,objects:[],anchors:{entrance:{x:480,y:616},exit:{x:480,y:24}},updatedAt:new Date().toISOString()};}
function devTemplateSanitize(raw){
  const base=devTemplateDefault(),src=raw&&typeof raw==='object'?raw:{};
  base.id=String(src.id||'');base.name=String(src.name||base.name).slice(0,80);base.kind=['village','town','city','outpost','custom'].includes(src.kind)?src.kind:'town';
  base.width=Math.round(devTemplateClamp(src.width||base.width,256,4096));base.height=Math.round(devTemplateClamp(src.height||base.height,256,4096));
  const anchors=src.anchors||{};base.anchors.entrance={x:devTemplateClamp(anchors.entrance?.x??base.width/2,0,base.width),y:devTemplateClamp(anchors.entrance?.y??base.height-24,0,base.height)};base.anchors.exit={x:devTemplateClamp(anchors.exit?.x??base.width/2,0,base.width),y:devTemplateClamp(anchors.exit?.y??24,0,base.height)};
  base.objects=Array.isArray(src.objects)?src.objects.slice(0,600).map((o,i)=>{
    const aw=Math.round(devTemplateClamp(o?.assetWidth||64,1,2048)),ah=Math.round(devTemplateClamp(o?.assetHeight||64,1,2048)),scale=devTemplateClamp(o?.scale||1,.25,4);
    const collision=o?.collision||{},occlusion=o?.occlusion||{},door=o?.door||{},isBuilding=devTemplateAssetCategory(o?.assetPath)==='buildings';
    return{id:String(o?.id||devTemplateId('asset')),type:'asset',assetPath:String(o?.assetPath||''),label:String(o?.label||devTemplateFilename(o?.assetPath)||`Asset ${i+1}`).slice(0,80),x:devTemplateClamp(o?.x||0,-2048,base.width+2048),y:devTemplateClamp(o?.y||0,-2048,base.height+2048),scale,assetWidth:aw,assetHeight:ah,locked:!!o?.locked,collision:{enabled:collision.enabled!==false,x:devTemplateClamp(collision.x??0,0,aw),y:devTemplateClamp(collision.y??Math.round(ah*.25),0,ah),w:devTemplateClamp(collision.w??aw,1,aw),h:devTemplateClamp(collision.h??Math.max(1,Math.round(ah*.75)),1,ah)},occlusion:{enabled:occlusion.enabled!==undefined?!!occlusion.enabled:isBuilding,x:devTemplateClamp(occlusion.x??0,0,aw),y:devTemplateClamp(occlusion.y??0,0,ah),w:devTemplateClamp(occlusion.w??aw,1,aw),h:devTemplateClamp(occlusion.h??Math.max(1,Math.round(ah*.50)),1,ah)},door:{enabled:door.enabled!==false,x:devTemplateClamp(door.x??aw/2,0,aw),y:devTemplateClamp(door.y??ah,0,ah)}};
  }):[];
  base.updatedAt=String(src.updatedAt||new Date().toISOString());return base;
}
function devTemplateStorageGet(key,fallback){try{const raw=localStorage.getItem(key);return raw?JSON.parse(raw):fallback;}catch(err){console.warn('Dev template storage read failed.',err);return fallback;}}
function devTemplateStorageSet(key,value){try{localStorage.setItem(key,JSON.stringify(value));}catch(err){console.warn('Dev template storage write failed.',err);}}
function devTemplateLoadLibrary(){const value=devTemplateStorageGet(DEV_TEMPLATE_LIBRARY_STORAGE,{});return value&&typeof value==='object'&&!Array.isArray(value)?value:{};}
function devTemplateLoadAssets(){const value=devTemplateStorageGet(DEV_TEMPLATE_ASSET_STORAGE,[]);return Array.isArray(value)?[...new Set(value.map(String).filter(Boolean))]:[];}
function devTemplateLoadView(){const raw=devTemplateStorageGet(DEV_TEMPLATE_VIEW_STORAGE,{}),z=DEV_TEMPLATE_ZOOM_LEVELS.includes(Number(raw?.zoom))?Number(raw.zoom):1,cls=DEV_TEMPLATE_PLAYER_REF_SPRITES[raw?.playerClass]?raw.playerClass:'Votary';return{zoom:z,pixelGrid:!!raw?.pixelGrid,showPlayer:!!raw?.showPlayer,playerClass:cls,playerX:Number.isFinite(Number(raw?.playerX))?Number(raw.playerX):480,playerY:Number.isFinite(Number(raw?.playerY))?Number(raw.playerY):320};}
const devTemplateView=devTemplateLoadView();
let devTemplateState={open:false,current:devTemplateSanitize(devTemplateStorageGet(DEV_TEMPLATE_DRAFT_STORAGE,null)),library:devTemplateLoadLibrary(),assets:devTemplateLoadAssets(),selection:null,drag:null,dirty:false,showCollision:false,showOcclusion:false,showDoors:false,regionTool:null,regionDraw:null,snap:1,zoom:devTemplateView.zoom,pixelGrid:devTemplateView.pixelGrid,playerRef:{shown:devTemplateView.showPlayer,className:devTemplateView.playerClass,x:devTemplateView.playerX,y:devTemplateView.playerY}};
function devTemplatePersistView(){devTemplateStorageSet(DEV_TEMPLATE_VIEW_STORAGE,{zoom:devTemplateState.zoom,pixelGrid:!!devTemplateState.pixelGrid,showPlayer:devTemplateState.playerRef.shown,playerClass:devTemplateState.playerRef.className,playerX:devTemplateState.playerRef.x,playerY:devTemplateState.playerRef.y});}

function devTemplatePersistDraft(){devTemplateState.current.updatedAt=new Date().toISOString();devTemplateStorageSet(DEV_TEMPLATE_DRAFT_STORAGE,devTemplateState.current);devTemplateState.dirty=true;devTemplateRenderStatus();}
function devTemplatePersistLibrary(){devTemplateStorageSet(DEV_TEMPLATE_LIBRARY_STORAGE,devTemplateState.library);devTemplateRenderLibrary();}
function devTemplatePersistAssets(){devTemplateStorageSet(DEV_TEMPLATE_ASSET_STORAGE,devTemplateState.assets);devTemplateRenderAssets();}
function devTemplateNormalizeAssetPath(value){let p=String(value||'').trim().replace(/\\/g,'/');if(!p)return'';if(!p.includes('/'))p=`./assets/buildings/${p}`;else if(!p.startsWith('.')&&!p.startsWith('/'))p=`./${p}`;return p;}
function devTemplateDownload(filename,payload){const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function devTemplateCanvasPoint(clientX,clientY){const r=devTemplateCanvas.getBoundingClientRect(),z=Math.max(.01,Number(devTemplateState.zoom)||1);return{x:(clientX-r.left)/z,y:(clientY-r.top)/z};}
function devTemplateObjectSize(o){return{w:o.assetWidth*o.scale,h:o.assetHeight*o.scale};}
function devTemplateObjectRect(o){const s=devTemplateObjectSize(o);return{x:o.x,y:o.y,w:s.w,h:s.h};}
function devTemplateOcclusionRect(o){const q=o?.occlusion;if(!q?.enabled)return null;return{x:o.x+q.x*o.scale,y:o.y+q.y*o.scale,w:q.w*o.scale,h:q.h*o.scale};}
function devTemplatePointInOcclusion(o,p){const r=devTemplateOcclusionRect(o);return!!r&&p.x>=r.x&&p.x<=r.x+r.w&&p.y>=r.y&&p.y<=r.y+r.h;}
function devTemplateVisualOverlaps(){
  const ids=new Set(),objects=devTemplateState.current.objects;
  for(let i=0;i<objects.length;i++)for(let j=i+1;j<objects.length;j++){const a=devTemplateObjectRect(objects[i]),b=devTemplateObjectRect(objects[j]);if(a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y){ids.add(objects[i].id);ids.add(objects[j].id);}}
  return ids;
}
function devTemplateCandidatesAt(p){
  const out=[];for(let i=devTemplateState.current.objects.length-1;i>=0;i--){const o=devTemplateState.current.objects[i],r=devTemplateObjectRect(o);if(p.x>=r.x&&p.x<=r.x+r.w&&p.y>=r.y&&p.y<=r.y+r.h)out.push({kind:'asset',id:o.id,label:o.label||devTemplateFilename(o.assetPath)});}
  if(devTemplateState.playerRef.shown&&Math.abs(p.x-devTemplateState.playerRef.x)<=16&&Math.abs(p.y-devTemplateState.playerRef.y)<=16)out.unshift({kind:'reference',id:'player',label:`Player reference · ${devTemplateState.playerRef.className}`});
  for(const key of ['entrance','exit']){const a=devTemplateState.current.anchors[key];if(Math.hypot(p.x-a.x,p.y-a.y)<=13)out.unshift({kind:'anchor',id:key,label:key==='entrance'?'Template entrance':'Template exit'});}
  return out;
}
function devTemplateSelectedObject(){return devTemplateState.selection?.kind==='asset'?devTemplateState.current.objects.find(o=>o.id===devTemplateState.selection.id)||null:null;}
function devTemplateSelectedAnchor(){return devTemplateState.selection?.kind==='anchor'?devTemplateState.current.anchors[devTemplateState.selection.id]||null:null;}
function devTemplateSelectedReference(){return devTemplateState.selection?.kind==='reference'&&devTemplateState.selection.id==='player'?devTemplateState.playerRef:null;}
function devTemplateSetSelection(selection){devTemplateState.selection=selection||null;devTemplateHidePicker();devTemplateRenderCanvas();devTemplateRenderInspector();}
function devTemplateHidePicker(){if(devTemplatePicker)devTemplatePicker.hidden=true;if(devTemplatePickerList)devTemplatePickerList.innerHTML='';}
function devTemplateShowPicker(candidates,clientX,clientY){
  if(!devTemplatePicker||!devTemplatePickerList)return;devTemplatePickerList.innerHTML='';for(const item of candidates){const b=document.createElement('button');b.type='button';b.textContent=item.label;b.addEventListener('click',()=>devTemplateSetSelection({kind:item.kind,id:item.id}));devTemplatePickerList.appendChild(b);}
  const r=devTemplateStage.getBoundingClientRect(),sx=devTemplateStage.scrollLeft||0,sy=devTemplateStage.scrollTop||0;devTemplatePicker.style.left=`${sx+Math.max(6,Math.min(r.width-230,clientX-r.left+8))}px`;devTemplatePicker.style.top=`${sy+Math.max(6,Math.min(r.height-180,clientY-r.top+8))}px`;devTemplatePicker.hidden=false;
}
function devTemplateRenderLibrary(){
  if(!devTemplateLibrarySelect)return;const current=devTemplateLibrarySelect.value,entries=Object.values(devTemplateState.library).sort((a,b)=>String(a.name).localeCompare(String(b.name)));devTemplateLibrarySelect.innerHTML='<option value="">Saved templates…</option>'+entries.map(t=>`<option value="${devTemplateEsc(t.id)}">${devTemplateEsc(t.name)} · ${devTemplateEsc(t.kind||'town')}</option>`).join('');if(entries.some(t=>t.id===current))devTemplateLibrarySelect.value=current;else if(devTemplateState.current.id&&entries.some(t=>t.id===devTemplateState.current.id))devTemplateLibrarySelect.value=devTemplateState.current.id;
}
function devTemplateRenderAssets(){
  if(!devTemplateAssets)return;if(!devTemplateState.assets.length){devTemplateAssets.innerHTML='<div class="dev-template-inspector-empty">No registered assets yet. Use Scan Assets Folder to discover them automatically.</div>';return;}devTemplateAssets.innerHTML='';
  const paths=[...devTemplateState.assets].sort((a,b)=>{const ca=devTemplateAssetCategory(a),cb=devTemplateAssetCategory(b);return ca.localeCompare(cb)||devTemplateFilename(a).localeCompare(devTemplateFilename(b));});let lastCategory='';
  for(const path of paths){const category=devTemplateAssetCategory(path);if(category!==lastCategory){const head=document.createElement('div');head.className='dev-template-asset-category';head.textContent=category;devTemplateAssets.appendChild(head);lastCategory=category;}const row=document.createElement('div');row.className='dev-template-asset';const preview=document.createElement('div');preview.className='dev-template-asset-preview';const img=document.createElement('img');img.src=path;img.alt='';preview.appendChild(img);const copy=document.createElement('div');copy.className='dev-template-asset-copy';copy.innerHTML=`<b>${devTemplateEsc(devTemplateFilename(path))}</b><small>${devTemplateEsc(path)}</small>`;const actions=document.createElement('div');actions.className='dev-template-asset-actions';const add=document.createElement('button');add.type='button';add.textContent='Add';add.addEventListener('click',()=>devTemplateAddAsset(path));const remove=document.createElement('button');remove.type='button';remove.className='remove';remove.textContent='Unregister';remove.addEventListener('click',()=>{devTemplateState.assets=devTemplateState.assets.filter(v=>v!==path);devTemplatePersistAssets();});actions.append(add,remove);copy.appendChild(actions);row.append(preview,copy);devTemplateAssets.appendChild(row);}
}
function devTemplateSyncMetaControls(){
  const t=devTemplateState.current,z=Math.max(.5,Math.min(6,Number(devTemplateState.zoom)||1)),inv=1/z;if(devTemplateNameInput)devTemplateNameInput.value=t.name;if(devTemplateKindSelect)devTemplateKindSelect.value=t.kind;if(devTemplateWidthInput)devTemplateWidthInput.value=t.width;if(devTemplateHeightInput)devTemplateHeightInput.value=t.height;if(devTemplateCanvas){devTemplateCanvas.style.width=`${t.width}px`;devTemplateCanvas.style.height=`${t.height}px`;devTemplateCanvas.style.transform=`scale(${z})`;devTemplateCanvas.style.setProperty('--dev-inv-zoom',String(inv));devTemplateCanvas.style.setProperty('--dev-guide-px',`${inv}px`);}if(devTemplateCanvasShell){devTemplateCanvasShell.style.width=`${Math.ceil(t.width*z)}px`;devTemplateCanvasShell.style.height=`${Math.ceil(t.height*z)}px`;}if(devTemplateZoom)devTemplateZoom.value=String(z);if(devTemplateZoomReadout)devTemplateZoomReadout.textContent=`${Math.round(z*100)}%`;if(devTemplatePixelGrid){devTemplatePixelGrid.checked=!!devTemplateState.pixelGrid;devTemplatePixelGrid.disabled=z<3;devTemplatePixelGrid.title=z<3?'Pixel grid becomes useful at 300% zoom or higher.':'Show individual source-pixel boundaries.';}if(devTemplateShowPlayerRef)devTemplateShowPlayerRef.checked=!!devTemplateState.playerRef.shown;if(devTemplatePlayerRefClass)devTemplatePlayerRefClass.value=devTemplateState.playerRef.className;
}
function devTemplateScreenAlignedRect(x,y,w,h){const z=Math.max(.5,Math.min(6,Number(devTemplateState.zoom)||1)),snap=n=>Math.round(Number(n||0)*z)/z,x1=snap(x),y1=snap(y),x2=snap(Number(x||0)+Number(w||0)),y2=snap(Number(y||0)+Number(h||0));return{x:x1,y:y1,w:Math.max(1/z,x2-x1),h:Math.max(1/z,y2-y1)};}
function devTemplateScreenAlignedPoint(x,y){const z=Math.max(.5,Math.min(6,Number(devTemplateState.zoom)||1));return{x:Math.round(Number(x||0)*z)/z,y:Math.round(Number(y||0)*z)/z};}
function devTemplateRenderCanvas(){
  if(!devTemplateCanvas)return;devTemplateSyncMetaControls();devTemplateCanvas.innerHTML='';const overlaps=devTemplateVisualOverlaps();
  for(const o of devTemplateState.current.objects){const size=devTemplateObjectSize(o),el=document.createElement('div');el.className='dev-template-object';if(o.locked)el.classList.add('locked');if(devTemplateState.selection?.kind==='asset'&&devTemplateState.selection.id===o.id)el.classList.add('selected');if(overlaps.has(o.id))el.classList.add('overlap-warning');el.dataset.templateId=o.id;const occludesRef=devTemplateState.playerRef.shown&&devTemplatePointInOcclusion(o,{x:devTemplateState.playerRef.x,y:devTemplateState.playerRef.y+14});Object.assign(el.style,{left:`${o.x}px`,top:`${o.y}px`,width:`${size.w}px`,height:`${size.h}px`,zIndex:occludesRef?'5':'2'});const img=document.createElement('img');img.src=o.assetPath;img.alt='';img.draggable=false;img.addEventListener('load',()=>devTemplateLearnDimensions(o,img));img.addEventListener('error',()=>{if(!el.querySelector('.dev-template-object-missing')){const miss=document.createElement('div');miss.className='dev-template-object-missing';miss.textContent='Asset not found';el.appendChild(miss);}});el.appendChild(img);
    if(o.collision.enabled){const col=document.createElement('div'),r=devTemplateScreenAlignedRect(o.collision.x*o.scale,o.collision.y*o.scale,o.collision.w*o.scale,o.collision.h*o.scale);col.className='dev-template-collision';Object.assign(col.style,{left:`${r.x}px`,top:`${r.y}px`,width:`${r.w}px`,height:`${r.h}px`});el.appendChild(col);}if(o.occlusion?.enabled){const occ=document.createElement('div'),r=devTemplateScreenAlignedRect(o.occlusion.x*o.scale,o.occlusion.y*o.scale,o.occlusion.w*o.scale,o.occlusion.h*o.scale);occ.className='dev-template-occlusion';Object.assign(occ.style,{left:`${r.x}px`,top:`${r.y}px`,width:`${r.w}px`,height:`${r.h}px`});el.appendChild(occ);}if(o.door.enabled){const door=document.createElement('div'),p=devTemplateScreenAlignedPoint(o.door.x*o.scale,o.door.y*o.scale);door.className='dev-template-door';Object.assign(door.style,{left:`${p.x}px`,top:`${p.y}px`});el.appendChild(door);}devTemplateCanvas.appendChild(el);
  }
  if(devTemplateState.playerRef.shown){const ref=devTemplateState.playerRef,el=document.createElement('div');el.className='dev-template-player-ref';if(devTemplateState.selection?.kind==='reference'&&devTemplateState.selection.id==='player')el.classList.add('selected');const rp=devTemplateScreenAlignedPoint(ref.x,ref.y);Object.assign(el.style,{left:`${rp.x}px`,top:`${rp.y}px`});const img=document.createElement('img');img.src=DEV_TEMPLATE_PLAYER_REF_SPRITES[ref.className]||DEV_TEMPLATE_PLAYER_REF_SPRITES.Votary;img.alt='Player scale reference';img.draggable=false;el.appendChild(img);devTemplateCanvas.appendChild(el);}
  for(const key of ['entrance','exit']){const a=devTemplateState.current.anchors[key],el=document.createElement('div');el.className=`dev-template-anchor ${key==='exit'?'exit':''}`;if(devTemplateState.selection?.kind==='anchor'&&devTemplateState.selection.id===key)el.classList.add('selected');el.textContent=key==='entrance'?'IN':'OUT';el.title=key==='entrance'?'Template entrance':'Template exit';const p=devTemplateScreenAlignedPoint(a.x,a.y);Object.assign(el.style,{left:`${p.x}px`,top:`${p.y}px`});devTemplateCanvas.appendChild(el);}
  if(devTemplateState.pixelGrid&&(devTemplateState.zoom||1)>=3){const grid=document.createElement('div');grid.className='dev-template-pixel-grid';grid.setAttribute('aria-hidden','true');devTemplateCanvas.appendChild(grid);}
  devTemplateWorkshop?.classList.toggle('show-all-collision',devTemplateState.showCollision);devTemplateWorkshop?.classList.toggle('show-all-occlusion',devTemplateState.showOcclusion);devTemplateWorkshop?.classList.toggle('show-all-doors',devTemplateState.showDoors);devTemplateWorkshop?.classList.toggle('drawing-region',!!devTemplateState.regionTool);devTemplateRenderStatus();
}
function devTemplateLearnDimensions(o,img){
  if(!img.naturalWidth||!img.naturalHeight)return;if(o.assetWidth===img.naturalWidth&&o.assetHeight===img.naturalHeight)return;const wasFallback=o.assetWidth===64&&o.assetHeight===64;o.assetWidth=img.naturalWidth;o.assetHeight=img.naturalHeight;if(wasFallback){o.collision={enabled:true,x:0,y:Math.round(o.assetHeight*.25),w:o.assetWidth,h:Math.max(1,Math.round(o.assetHeight*.75))};const isBuilding=devTemplateAssetCategory(o.assetPath)==='buildings';o.occlusion={enabled:isBuilding,x:0,y:0,w:o.assetWidth,h:Math.max(1,Math.round(o.assetHeight*.50))};o.door={enabled:true,x:Math.round(o.assetWidth/2),y:o.assetHeight};}else{o.collision.x=devTemplateClamp(o.collision.x,0,o.assetWidth);o.collision.y=devTemplateClamp(o.collision.y,0,o.assetHeight);o.collision.w=devTemplateClamp(o.collision.w,1,o.assetWidth-o.collision.x||1);o.collision.h=devTemplateClamp(o.collision.h,1,o.assetHeight-o.collision.y||1);if(!o.occlusion)o.occlusion={enabled:devTemplateAssetCategory(o.assetPath)==='buildings',x:0,y:0,w:o.assetWidth,h:Math.max(1,Math.round(o.assetHeight*.50))};o.occlusion.x=devTemplateClamp(o.occlusion.x,0,o.assetWidth);o.occlusion.y=devTemplateClamp(o.occlusion.y,0,o.assetHeight);o.occlusion.w=devTemplateClamp(o.occlusion.w,1,o.assetWidth-o.occlusion.x||1);o.occlusion.h=devTemplateClamp(o.occlusion.h,1,o.assetHeight-o.occlusion.y||1);o.door.x=devTemplateClamp(o.door.x,0,o.assetWidth);o.door.y=devTemplateClamp(o.door.y,0,o.assetHeight);}devTemplatePersistDraft();devTemplateRenderCanvas();devTemplateRenderInspector();
}
function devTemplateInspectorField(path,title,sub,value,min,max,step=1){return`<div class="dev-template-inspector-field"><label><b>${devTemplateEsc(title)}</b><span>${devTemplateEsc(sub)}</span></label><input type="number" data-template-field="${devTemplateEsc(path)}" value="${Number(value)}" min="${min}" max="${max}" step="${step}"></div>`;}
function devTemplateRenderInspector(){
  if(!devTemplateInspector)return;const o=devTemplateSelectedObject(),a=devTemplateSelectedAnchor(),ref=devTemplateSelectedReference();if(!o&&!a&&!ref){devTemplateInspector.innerHTML='<div class="dev-template-inspector-empty">Select an asset, entrance, exit, or the player reference. Multiple things under the cursor open a picker.</div>';return;}
  if(ref){devTemplateInspector.innerHTML=`<div class="dev-template-inspector-title"><b>Player reference · ${devTemplateEsc(ref.className)}</b><span>32×32px current in-game render reference · Dev Tools only · not exported</span></div><div class="dev-template-inspector-fields">${devTemplateInspectorField('reference.x','X','Template-local reference position.',ref.x,0,devTemplateState.current.width,1)}${devTemplateInspectorField('reference.y','Y','Template-local reference position.',ref.y,0,devTemplateState.current.height,1)}</div><p>Drag or nudge this reference to compare doors, roads, props and building scale against the player.</p>`;return;}
  if(a){const key=devTemplateState.selection.id;devTemplateInspector.innerHTML=`<div class="dev-template-inspector-title"><b>${key==='entrance'?'Template entrance':'Template exit'}</b><span>Procedural route connection anchor</span></div><div class="dev-template-inspector-fields">${devTemplateInspectorField('anchor.x','X','Template-local horizontal position.',a.x,0,devTemplateState.current.width,1)}${devTemplateInspectorField('anchor.y','Y','Template-local vertical position.',a.y,0,devTemplateState.current.height,1)}</div>`;return;}
  const size=devTemplateObjectSize(o);devTemplateInspector.innerHTML=`<div class="dev-template-inspector-title"><b>${devTemplateEsc(o.label)}</b><span>${devTemplateEsc(o.assetPath)} · source ${o.assetWidth}×${o.assetHeight}px · rendered ${Math.round(size.w)}×${Math.round(size.h)}px</span></div><div class="dev-template-inspector-fields">${devTemplateInspectorField('x','X','Template-local position.',o.x,-2048,devTemplateState.current.width+2048,1)}${devTemplateInspectorField('y','Y','Template-local position.',o.y,-2048,devTemplateState.current.height+2048,1)}${devTemplateInspectorField('scale','Uniform scale','Nearest-neighbour; width and height stay proportional.',o.scale,.25,4,.25)}<div class="dev-template-inspector-field"><label><b>Scale slider</b><span>0.25× to 4×.</span></label><input type="range" data-template-field="scale" value="${o.scale}" min=".25" max="4" step=".25"></div></div><label class="dev-template-check"><input type="checkbox" data-template-toggle="locked" ${o.locked?'checked':''}> Lock position against drag/nudge</label><label class="dev-template-check"><input type="checkbox" data-template-toggle="collision" ${o.collision.enabled?'checked':''}> Collision enabled</label><div class="dev-template-inspector-fields">${devTemplateInspectorField('collision.x','Collision X','Source-pixel offset inside artwork.',o.collision.x,0,o.assetWidth,1)}${devTemplateInspectorField('collision.y','Collision Y','Source-pixel offset inside artwork.',o.collision.y,0,o.assetHeight,1)}${devTemplateInspectorField('collision.w','Collision W','Source-pixel width; scales with building.',o.collision.w,1,o.assetWidth,1)}${devTemplateInspectorField('collision.h','Collision H','Source-pixel height; scales with building.',o.collision.h,1,o.assetHeight,1)}</div><label class="dev-template-check"><input type="checkbox" data-template-toggle="occlusion" ${o.occlusion?.enabled?'checked':''}> Behind / occlusion zone enabled</label><div class="dev-template-inspector-fields">${devTemplateInspectorField('occlusion.x','Behind X','Source-pixel offset inside artwork.',o.occlusion?.x??0,0,o.assetWidth,1)}${devTemplateInspectorField('occlusion.y','Behind Y','Source-pixel offset inside artwork.',o.occlusion?.y??0,0,o.assetHeight,1)}${devTemplateInspectorField('occlusion.w','Behind W','Player is drawn beneath this part of the building.',o.occlusion?.w??o.assetWidth,1,o.assetWidth,1)}${devTemplateInspectorField('occlusion.h','Behind H','Use for roofs / tall foreground portions.',o.occlusion?.h??Math.round(o.assetHeight*.5),1,o.assetHeight,1)}</div><div class="dev-template-inspector-actions"><button type="button" data-template-action="draw-occlusion">Draw Behind Zone</button><button type="button" data-template-action="occlusion-reset">Reset Behind Zone</button></div><p>The purple zone is not collision. When the player's feet enter it, this PNG draws over the player so roofs can visually hide them.</p><label class="dev-template-check"><input type="checkbox" data-template-toggle="door" ${o.door.enabled?'checked':''}> Door / interaction marker enabled</label><div class="dev-template-inspector-fields">${devTemplateInspectorField('door.x','Door X','Source-pixel position; scales with building.',o.door.x,0,o.assetWidth,1)}${devTemplateInspectorField('door.y','Door Y','Source-pixel position; scales with building.',o.door.y,0,o.assetHeight,1)}</div><div class="dev-template-inspector-actions"><button type="button" data-template-action="scale-reset">Scale 1×</button><button type="button" data-template-action="collision-reset">Reset collision</button><button type="button" data-template-action="duplicate">Duplicate asset</button><button class="danger" type="button" data-template-action="delete">Delete asset</button></div>`;
}
function devTemplateRenderStatus(){
  if(!devTemplateStatus)return;const overlaps=devTemplateVisualOverlaps(),overlapCount=overlaps.size;const current=devTemplateState.current,drawHint=devTemplateState.regionTool?' · <b class="warn">DRAW BEHIND ZONE: drag over selected artwork</b>':'',saveState=devTemplateState.dirty?'<b class="dirty">Draft changed · autosaved locally</b>':'<b class="ok">Saved template matches draft</b>';devTemplateStatus.innerHTML=`<span>${saveState} · ${current.objects.length} asset${current.objects.length===1?'':'s'} · ${current.width}×${current.height}px · view ${Math.round((devTemplateState.zoom||1)*100)}%${drawHint} ${overlapCount?`· <b class="warn">${overlapCount} asset${overlapCount===1?'':'s'} visually overlap</b>`:''}</span><span><kbd>Arrows</kbd> nudge 1 px · <kbd>Shift</kbd> + arrows 5 px · <kbd>Delete</kbd> removes selected asset</span>`;
}
function devTemplateSetZoom(value,{keepCenter=true}={}){const old=Math.max(.5,Math.min(6,Number(devTemplateState.zoom)||1)),next=DEV_TEMPLATE_ZOOM_LEVELS.reduce((best,v)=>Math.abs(v-Number(value))<Math.abs(best-Number(value))?v:best,DEV_TEMPLATE_ZOOM_LEVELS[0]);if(old===next){devTemplateSyncMetaControls();return;}let localCenter=null;if(keepCenter&&devTemplateStage){localCenter={x:(devTemplateStage.scrollLeft+devTemplateStage.clientWidth/2-32)/old,y:(devTemplateStage.scrollTop+devTemplateStage.clientHeight/2-32)/old};}devTemplateState.zoom=next;devTemplatePersistView();devTemplateRenderCanvas();if(localCenter&&devTemplateStage){requestAnimationFrame(()=>{devTemplateStage.scrollLeft=Math.max(0,32+localCenter.x*next-devTemplateStage.clientWidth/2);devTemplateStage.scrollTop=Math.max(0,32+localCenter.y*next-devTemplateStage.clientHeight/2);});}}
function devTemplateStepZoom(direction){const current=Number(devTemplateState.zoom)||1,idx=Math.max(0,DEV_TEMPLATE_ZOOM_LEVELS.indexOf(current)),next=DEV_TEMPLATE_ZOOM_LEVELS[Math.max(0,Math.min(DEV_TEMPLATE_ZOOM_LEVELS.length-1,idx+(direction<0?-1:1)))];devTemplateSetZoom(next);}
function devTemplateCenterPlayerRef(){devTemplateState.playerRef.x=Math.round(devTemplateState.current.width/2);devTemplateState.playerRef.y=Math.round(devTemplateState.current.height/2);devTemplateState.playerRef.shown=true;devTemplatePersistView();devTemplateState.selection={kind:'reference',id:'player'};devTemplateRenderCanvas();devTemplateRenderInspector();}
function devTemplateRefresh(){devTemplateRenderLibrary();devTemplateRenderAssets();devTemplateRenderCanvas();devTemplateRenderInspector();}
function devTemplateSetOpen(value){
  devTemplateState.open=!!value;if(devTemplateState.open){if(!devPlacement.enabled)devSetMode(true);document.body.classList.add('dev-template-open');devTemplateWorkshop.hidden=false;devTemplateRefresh();setTimeout(()=>{if(devTemplateStage){const z=devTemplateState.zoom||1;devTemplateStage.scrollLeft=Math.max(0,(devTemplateState.current.width*z-devTemplateStage.clientWidth)/2+32);devTemplateStage.scrollTop=Math.max(0,(devTemplateState.current.height*z-devTemplateStage.clientHeight)/2+32);}},0);}else{document.body.classList.remove('dev-template-open');if(devTemplateWorkshop)devTemplateWorkshop.hidden=true;devTemplateState.drag=null;devTemplateState.regionTool=null;devTemplateState.regionDraw=null;devTemplateHidePicker();}
}
function devTemplatePathFromFolderFile(file){
  const rel=String(file?.webkitRelativePath||file?.name||'').replace(/\\/g,'/');if(!DEV_TEMPLATE_IMAGE_EXT.test(rel))return'';const lower=rel.toLowerCase(),marker='/assets/';let i=lower.indexOf(marker);if(i>=0)return`./${rel.slice(i+1)}`;if(lower.startsWith('assets/'))return`./${rel}`;return'';
}
function devTemplateScanAssetFolder(files){
  const list=Array.from(files||[]),found=[];for(const file of list){const path=devTemplatePathFromFolderFile(file);if(path)found.push(path);}const unique=[...new Set(found)];if(!unique.length){if(devTemplateAssetScanMeta)devTemplateAssetScanMeta.textContent='No supported images were found. Choose the project assets folder (or project root containing assets/).';toast('No assets found. Choose the project assets folder.');return;}
  const before=new Set(devTemplateState.assets);for(const path of unique)before.add(path);devTemplateState.assets=[...before].sort();devTemplatePersistAssets();const categories=[...new Set(unique.map(devTemplateAssetCategory))].sort();if(devTemplateAssetScanMeta)devTemplateAssetScanMeta.innerHTML=`Found <b>${unique.length}</b> image asset${unique.length===1?'':'s'} across <b>${categories.length}</b> folder categor${categories.length===1?'y':'ies'}: ${categories.map(devTemplateEsc).join(', ')}.`;toast(`Asset catalogue refreshed: ${unique.length} image${unique.length===1?'':'s'} found.`);
}
function devTemplateOpenAssetFolderPicker(){
  if(!devTemplateAssetFolderInput)return;devTemplateAssetFolderInput.value='';devTemplateAssetFolderInput.click();
}
function devTemplateRegisterAsset(){const path=devTemplateNormalizeAssetPath(devTemplateAssetPathInput?.value);if(!path||/\/$/.test(path)){toast('Enter a PNG filename or complete project-relative asset path.');return;}if(!devTemplateState.assets.includes(path)){devTemplateState.assets.push(path);devTemplateState.assets.sort();devTemplatePersistAssets();toast(`Registered ${devTemplateFilename(path)}.`);}if(devTemplateAssetPathInput)devTemplateAssetPathInput.value='./assets/buildings/';}
function devTemplateAddAsset(path){
  path=devTemplateNormalizeAssetPath(path);if(!path)return;const isBuilding=devTemplateAssetCategory(path)==='buildings';const o={id:devTemplateId('asset'),type:'asset',assetPath:path,label:devTemplateFilename(path).replace(/\.[^.]+$/,''),x:Math.round(devTemplateState.current.width/2-32),y:Math.round(devTemplateState.current.height/2-32),scale:1,assetWidth:64,assetHeight:64,locked:false,collision:{enabled:true,x:0,y:16,w:64,h:48},occlusion:{enabled:isBuilding,x:0,y:0,w:64,h:32},door:{enabled:true,x:32,y:64}};devTemplateState.current.objects.push(o);devTemplateSetSelection({kind:'asset',id:o.id});devTemplatePersistDraft();devTemplateRenderCanvas();devTemplateRenderInspector();
}
function devTemplateDeleteSelected(){const o=devTemplateSelectedObject();if(!o)return false;devTemplateState.current.objects=devTemplateState.current.objects.filter(v=>v.id!==o.id);devTemplateState.selection=null;devTemplatePersistDraft();devTemplateRenderCanvas();devTemplateRenderInspector();return true;}
function devTemplateDuplicateSelected(){const o=devTemplateSelectedObject();if(!o)return;const copy=devTemplateDeepClone(o);copy.id=devTemplateId('asset');copy.label=`${o.label} copy`;copy.x+=16;copy.y+=16;copy.locked=false;devTemplateState.current.objects.push(copy);devTemplateState.selection={kind:'asset',id:copy.id};devTemplatePersistDraft();devTemplateRenderCanvas();devTemplateRenderInspector();}
function devTemplateNudge(dx,dy){
  const o=devTemplateSelectedObject();if(o){if(o.locked){toast('That asset is position-locked.');return true;}o.x+=dx;o.y+=dy;devTemplatePersistDraft();devTemplateRenderCanvas();devTemplateRenderInspector();return true;}const a=devTemplateSelectedAnchor();if(a){a.x=devTemplateClamp(a.x+dx,0,devTemplateState.current.width);a.y=devTemplateClamp(a.y+dy,0,devTemplateState.current.height);devTemplatePersistDraft();devTemplateRenderCanvas();devTemplateRenderInspector();return true;}const ref=devTemplateSelectedReference();if(ref){ref.x=devTemplateClamp(ref.x+dx,0,devTemplateState.current.width);ref.y=devTemplateClamp(ref.y+dy,0,devTemplateState.current.height);devTemplatePersistView();devTemplateRenderCanvas();devTemplateRenderInspector();return true;}return false;
}
function devTemplateSaveCurrent(){
  const t=devTemplateState.current;t.name=String(devTemplateNameInput?.value||t.name||'Untitled Town').trim().slice(0,80)||'Untitled Town';t.kind=devTemplateKindSelect?.value||t.kind;if(!t.id)t.id=`${devTemplateSlug(t.name)}-${Date.now().toString(36)}`;t.updatedAt=new Date().toISOString();devTemplateState.library[t.id]=devTemplateDeepClone(t);devTemplatePersistLibrary();devTemplateStorageSet(DEV_TEMPLATE_DRAFT_STORAGE,t);devTemplateState.dirty=false;devTemplateRenderStatus();if(devTemplateLibrarySelect)devTemplateLibrarySelect.value=t.id;toast(`Saved template: ${t.name}.`);
}
function devTemplateLoadSaved(id){const raw=devTemplateState.library[id];if(!raw){toast('Choose a saved template first.');return;}devTemplateState.current=devTemplateSanitize(devTemplateDeepClone(raw));devTemplateState.selection=null;devTemplateState.dirty=false;devTemplateStorageSet(DEV_TEMPLATE_DRAFT_STORAGE,devTemplateState.current);devTemplateRefresh();toast(`Loaded ${devTemplateState.current.name}.`);}
function devTemplateNew(){if(devTemplateState.dirty&&!confirm('Start a new template? The current draft is auto-saved locally, but unsaved changes are not committed to the named template library.'))return;devTemplateState.current=devTemplateDefault();devTemplateState.selection=null;devTemplateState.dirty=true;devTemplatePersistDraft();devTemplateRefresh();}
function devTemplateDuplicateCurrent(){const copy=devTemplateDeepClone(devTemplateState.current);copy.id='';copy.name=`${copy.name} Copy`.slice(0,80);devTemplateState.current=devTemplateSanitize(copy);devTemplateState.selection=null;devTemplatePersistDraft();devTemplateRefresh();toast('Template duplicated as a new draft. Save it when ready.');}
function devTemplateDeleteSaved(){const id=devTemplateState.current.id;if(!id||!devTemplateState.library[id]){toast('The current draft is not a saved template.');return;}if(!confirm(`Delete saved template “${devTemplateState.current.name}” from the local library? Exported JSON files are unaffected.`))return;delete devTemplateState.library[id];devTemplatePersistLibrary();devTemplateState.current.id='';devTemplatePersistDraft();toast('Saved template removed from local library.');}
function devTemplateExportCurrent(){const t=devTemplateSanitize(devTemplateState.current);devTemplateDownload(`${devTemplateSlug(t.name)}.json`,t);}
function devTemplateExportLibrary(){const payload={format:'lowfathom-settlement-template-library',version:1,build:'v0.219.2',templates:Object.values(devTemplateState.library)};devTemplateDownload('lowfathom-settlement-template-library.json',payload);}
async function devTemplateImport(file){
  if(!file)return;try{const parsed=JSON.parse(await file.text());if(parsed?.format==='lowfathom-settlement-template-library'&&Array.isArray(parsed.templates)){for(const raw of parsed.templates){const t=devTemplateSanitize(raw);if(!t.id)t.id=`${devTemplateSlug(t.name)}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,5)}`;devTemplateState.library[t.id]=t;}devTemplatePersistLibrary();toast(`Imported ${parsed.templates.length} templates into the library.`);}else{const t=devTemplateSanitize(parsed?.template||parsed);t.id=String(t.id||'');devTemplateState.current=t;devTemplateState.selection=null;devTemplatePersistDraft();devTemplateRefresh();toast('Template imported as an editable draft.');}}catch(err){console.error(err);toast('That template JSON could not be imported.');}finally{if(devTemplateImportInput)devTemplateImportInput.value='';}
}
function devTemplateApplyInspectorField(path,value){
  const o=devTemplateSelectedObject(),a=devTemplateSelectedAnchor(),ref=devTemplateSelectedReference();if(ref&&path.startsWith('reference.')){const key=path.slice(10);ref[key]=devTemplateClamp(value,0,key==='x'?devTemplateState.current.width:devTemplateState.current.height);devTemplatePersistView();devTemplateRenderCanvas();devTemplateRenderInspector();return;}if(a&&path.startsWith('anchor.')){const key=path.slice(7);a[key]=devTemplateClamp(value,0,key==='x'?devTemplateState.current.width:devTemplateState.current.height);}else if(o){if(path==='x')o.x=devTemplateClamp(value,-2048,devTemplateState.current.width+2048);else if(path==='y')o.y=devTemplateClamp(value,-2048,devTemplateState.current.height+2048);else if(path==='scale')o.scale=devTemplateClamp(value,.25,4);else if(path.startsWith('collision.')){const k=path.slice(10),max=(k==='x'||k==='w')?o.assetWidth:o.assetHeight;o.collision[k]=devTemplateClamp(value,k==='w'||k==='h'?1:0,max);}else if(path.startsWith('occlusion.')){const k=path.slice(10),max=(k==='x'||k==='w')?o.assetWidth:o.assetHeight;if(!o.occlusion)o.occlusion={enabled:true,x:0,y:0,w:o.assetWidth,h:Math.max(1,Math.round(o.assetHeight*.5))};o.occlusion[k]=devTemplateClamp(value,k==='w'||k==='h'?1:0,max);}else if(path.startsWith('door.')){const k=path.slice(5);o.door[k]=devTemplateClamp(value,0,k==='x'?o.assetWidth:o.assetHeight);}}else return;devTemplatePersistDraft();devTemplateRenderCanvas();devTemplateRenderInspector();
}
function devTemplateApplyInspectorAction(action){const o=devTemplateSelectedObject();if(!o)return;if(action==='delete')devTemplateDeleteSelected();else if(action==='duplicate')devTemplateDuplicateSelected();else if(action==='scale-reset'){o.scale=1;devTemplatePersistDraft();devTemplateRenderCanvas();devTemplateRenderInspector();}else if(action==='collision-reset'){o.collision={enabled:true,x:0,y:Math.round(o.assetHeight*.25),w:o.assetWidth,h:Math.max(1,Math.round(o.assetHeight*.75))};o.door.x=Math.round(o.assetWidth/2);o.door.y=o.assetHeight;devTemplatePersistDraft();devTemplateRenderCanvas();devTemplateRenderInspector();}else if(action==='occlusion-reset'){o.occlusion={enabled:true,x:0,y:0,w:o.assetWidth,h:Math.max(1,Math.round(o.assetHeight*.50))};devTemplatePersistDraft();devTemplateRenderCanvas();devTemplateRenderInspector();}else if(action==='draw-occlusion'){o.occlusion=o.occlusion||{enabled:true,x:0,y:0,w:o.assetWidth,h:Math.max(1,Math.round(o.assetHeight*.50))};o.occlusion.enabled=true;devTemplateState.regionTool={type:'occlusion',objectId:o.id};devTemplateState.regionDraw=null;devTemplateRenderCanvas();devTemplateRenderInspector();toast('Drag over the building artwork to draw its Behind zone.');}}

devTemplateOpenBtn?.addEventListener('click',()=>devTemplateSetOpen(true));
devTemplateCloseBtn?.addEventListener('click',()=>devTemplateSetOpen(false));
devTemplateNewBtn?.addEventListener('click',devTemplateNew);devTemplateSaveBtn?.addEventListener('click',devTemplateSaveCurrent);devTemplateDuplicateBtn?.addEventListener('click',devTemplateDuplicateCurrent);devTemplateExportBtn?.addEventListener('click',devTemplateExportCurrent);devTemplateExportAllBtn?.addEventListener('click',devTemplateExportLibrary);devTemplateImportInput?.addEventListener('change',()=>devTemplateImport(devTemplateImportInput.files?.[0]));devTemplateDeleteTemplateBtn?.addEventListener('click',devTemplateDeleteSaved);devTemplateLoadBtn?.addEventListener('click',()=>devTemplateLoadSaved(devTemplateLibrarySelect?.value));devTemplateScanAssetsBtn?.addEventListener('click',devTemplateOpenAssetFolderPicker);devTemplateAssetFolderInput?.addEventListener('change',()=>devTemplateScanAssetFolder(devTemplateAssetFolderInput.files));devTemplateRegisterAssetBtn?.addEventListener('click',devTemplateRegisterAsset);devTemplateAssetPathInput?.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();devTemplateRegisterAsset();}});
devTemplateNameInput?.addEventListener('input',()=>{devTemplateState.current.name=String(devTemplateNameInput.value||'').slice(0,80);devTemplatePersistDraft();});devTemplateKindSelect?.addEventListener('change',()=>{devTemplateState.current.kind=devTemplateKindSelect.value;devTemplatePersistDraft();});
function devTemplateResizeFromInputs(){const t=devTemplateState.current;t.width=Math.round(devTemplateClamp(devTemplateWidthInput?.value,256,4096));t.height=Math.round(devTemplateClamp(devTemplateHeightInput?.value,256,4096));for(const key of ['entrance','exit']){t.anchors[key].x=devTemplateClamp(t.anchors[key].x,0,t.width);t.anchors[key].y=devTemplateClamp(t.anchors[key].y,0,t.height);}devTemplateState.playerRef.x=devTemplateClamp(devTemplateState.playerRef.x,0,t.width);devTemplateState.playerRef.y=devTemplateClamp(devTemplateState.playerRef.y,0,t.height);devTemplatePersistView();devTemplatePersistDraft();devTemplateRenderCanvas();devTemplateRenderInspector();}
devTemplateWidthInput?.addEventListener('change',devTemplateResizeFromInputs);devTemplateHeightInput?.addEventListener('change',devTemplateResizeFromInputs);devTemplateShowCollision?.addEventListener('change',()=>{devTemplateState.showCollision=devTemplateShowCollision.checked;devTemplateRenderCanvas();});devTemplateShowOcclusion?.addEventListener('change',()=>{devTemplateState.showOcclusion=devTemplateShowOcclusion.checked;devTemplateRenderCanvas();});devTemplateShowDoors?.addEventListener('change',()=>{devTemplateState.showDoors=devTemplateShowDoors.checked;devTemplateRenderCanvas();});devTemplateSnap?.addEventListener('change',()=>{devTemplateState.snap=Math.max(1,Number(devTemplateSnap.value)||1);});
devTemplateZoom?.addEventListener('change',()=>devTemplateSetZoom(Number(devTemplateZoom.value)));devTemplateZoomOutBtn?.addEventListener('click',()=>devTemplateStepZoom(-1));devTemplateZoomResetBtn?.addEventListener('click',()=>devTemplateSetZoom(1));devTemplateZoomInBtn?.addEventListener('click',()=>devTemplateStepZoom(1));devTemplatePixelGrid?.addEventListener('change',()=>{devTemplateState.pixelGrid=devTemplatePixelGrid.checked;devTemplatePersistView();devTemplateRenderCanvas();});devTemplateShowPlayerRef?.addEventListener('change',()=>{devTemplateState.playerRef.shown=devTemplateShowPlayerRef.checked;if(devTemplateState.playerRef.shown&&(devTemplateState.playerRef.x<0||devTemplateState.playerRef.x>devTemplateState.current.width||devTemplateState.playerRef.y<0||devTemplateState.playerRef.y>devTemplateState.current.height)){devTemplateState.playerRef.x=Math.round(devTemplateState.current.width/2);devTemplateState.playerRef.y=Math.round(devTemplateState.current.height/2);}if(!devTemplateState.playerRef.shown&&devTemplateState.selection?.kind==='reference')devTemplateState.selection=null;devTemplatePersistView();devTemplateRenderCanvas();devTemplateRenderInspector();});devTemplatePlayerRefClass?.addEventListener('change',()=>{devTemplateState.playerRef.className=DEV_TEMPLATE_PLAYER_REF_SPRITES[devTemplatePlayerRefClass.value]?devTemplatePlayerRefClass.value:'Votary';devTemplatePersistView();devTemplateRenderCanvas();devTemplateRenderInspector();});devTemplatePlayerRefCenterBtn?.addEventListener('click',devTemplateCenterPlayerRef);
devTemplateInspector?.addEventListener('change',e=>{const field=e.target.closest('[data-template-field]');if(field){devTemplateApplyInspectorField(field.dataset.templateField,field.value);return;}const toggle=e.target.closest('[data-template-toggle]');if(toggle){const o=devTemplateSelectedObject();if(!o)return;if(toggle.dataset.templateToggle==='locked')o.locked=toggle.checked;else if(toggle.dataset.templateToggle==='collision')o.collision.enabled=toggle.checked;else if(toggle.dataset.templateToggle==='occlusion'){o.occlusion=o.occlusion||{enabled:true,x:0,y:0,w:o.assetWidth,h:Math.max(1,Math.round(o.assetHeight*.5))};o.occlusion.enabled=toggle.checked;}else if(toggle.dataset.templateToggle==='door')o.door.enabled=toggle.checked;devTemplatePersistDraft();devTemplateRenderCanvas();devTemplateRenderInspector();}});
devTemplateInspector?.addEventListener('input',e=>{if(e.target.matches('input[type="range"][data-template-field]'))devTemplateApplyInspectorField(e.target.dataset.templateField,e.target.value);});devTemplateInspector?.addEventListener('click',e=>{const b=e.target.closest('[data-template-action]');if(b)devTemplateApplyInspectorAction(b.dataset.templateAction);});
devTemplateCanvas?.addEventListener('pointerdown',e=>{if(e.button!==0)return;const p=devTemplateCanvasPoint(e.clientX,e.clientY);if(devTemplateState.regionTool){const tool=devTemplateState.regionTool,o=devTemplateState.current.objects.find(v=>v.id===tool.objectId);if(!o){devTemplateState.regionTool=null;devTemplateRenderCanvas();return;}const r=devTemplateObjectRect(o);if(p.x<r.x||p.x>r.x+r.w||p.y<r.y||p.y>r.y+r.h){toast('Start the Behind zone inside the selected artwork.');return;}const lx=devTemplateClamp((p.x-o.x)/o.scale,0,o.assetWidth),ly=devTemplateClamp((p.y-o.y)/o.scale,0,o.assetHeight);devTemplateState.regionDraw={pointerId:e.pointerId,type:tool.type,objectId:o.id,startX:lx,startY:ly};o.occlusion={enabled:true,x:Math.round(lx),y:Math.round(ly),w:1,h:1};devTemplateCanvas.setPointerCapture?.(e.pointerId);devTemplateRenderCanvas();return;}const candidates=devTemplateCandidatesAt(p);if(!candidates.length){devTemplateSetSelection(null);return;}const selected=devTemplateState.selection,candidateSelected=selected&&candidates.some(c=>c.kind===selected.kind&&c.id===selected.id);if(candidates.length>1&&!candidateSelected){devTemplateShowPicker(candidates,e.clientX,e.clientY);return;}const target=candidateSelected?candidates.find(c=>c.kind===selected.kind&&c.id===selected.id):candidates[0];devTemplateSetSelection({kind:target.kind,id:target.id});const o=devTemplateSelectedObject(),a=devTemplateSelectedAnchor(),ref=devTemplateSelectedReference();if(o?.locked){toast('That asset is position-locked.');return;}const origin=o?{x:o.x,y:o.y}:a?{x:a.x,y:a.y}:ref?{x:ref.x,y:ref.y}:null;if(!origin)return;devTemplateState.drag={pointerId:e.pointerId,kind:target.kind,id:target.id,offsetX:p.x-origin.x,offsetY:p.y-origin.y};devTemplateCanvas.setPointerCapture?.(e.pointerId);});
devTemplateCanvas?.addEventListener('pointermove',e=>{const rd=devTemplateState.regionDraw;if(rd&&rd.pointerId===e.pointerId){const o=devTemplateState.current.objects.find(v=>v.id===rd.objectId);if(!o)return;const p=devTemplateCanvasPoint(e.clientX,e.clientY),lx=devTemplateClamp((p.x-o.x)/o.scale,0,o.assetWidth),ly=devTemplateClamp((p.y-o.y)/o.scale,0,o.assetHeight),x=Math.min(rd.startX,lx),y=Math.min(rd.startY,ly),w=Math.max(1,Math.abs(lx-rd.startX)),h=Math.max(1,Math.abs(ly-rd.startY));o.occlusion={enabled:true,x:Math.round(x),y:Math.round(y),w:Math.round(w),h:Math.round(h)};devTemplateRenderCanvas();return;}const d=devTemplateState.drag;if(!d||d.pointerId!==e.pointerId)return;const p=devTemplateCanvasPoint(e.clientX,e.clientY),snap=Math.max(1,devTemplateState.snap||1),nx=Math.round((p.x-d.offsetX)/snap)*snap,ny=Math.round((p.y-d.offsetY)/snap)*snap;if(d.kind==='asset'){const o=devTemplateState.current.objects.find(v=>v.id===d.id);if(!o||o.locked)return;o.x=nx;o.y=ny;}else if(d.kind==='reference'){devTemplateState.playerRef.x=devTemplateClamp(nx,0,devTemplateState.current.width);devTemplateState.playerRef.y=devTemplateClamp(ny,0,devTemplateState.current.height);}else{const a=devTemplateState.current.anchors[d.id];if(!a)return;a.x=devTemplateClamp(nx,0,devTemplateState.current.width);a.y=devTemplateClamp(ny,0,devTemplateState.current.height);}devTemplateRenderCanvas();});
function devTemplateFinishDrag(e){const rd=devTemplateState.regionDraw;if(rd&&rd.pointerId===e.pointerId){devTemplateState.regionDraw=null;devTemplateState.regionTool=null;try{devTemplateCanvas.releasePointerCapture?.(e.pointerId);}catch{}devTemplatePersistDraft();devTemplateRenderCanvas();devTemplateRenderInspector();return;}const d=devTemplateState.drag;if(!d||d.pointerId!==e.pointerId)return;devTemplateState.drag=null;try{devTemplateCanvas.releasePointerCapture?.(e.pointerId);}catch{}if(d.kind==='reference')devTemplatePersistView();else devTemplatePersistDraft();devTemplateRenderInspector();}
devTemplateCanvas?.addEventListener('pointerup',devTemplateFinishDrag);devTemplateCanvas?.addEventListener('pointercancel',devTemplateFinishDrag);

devTemplateRefresh();

devToggle?.addEventListener('click',()=>devSetMode(!devPlacement.enabled));
devClose?.addEventListener('click',()=>devSetMode(false));
devDragBtn?.addEventListener('click',()=>{if(devDragBtn.disabled)return;devPlacement.dragUnlocked=!devPlacement.dragUnlocked;devDragBtn.classList.toggle('active',devPlacement.dragUnlocked);devDragBtn.textContent=devPlacement.dragUnlocked?'Drag unlocked':'Drag locked';devDragBtn.setAttribute('aria-pressed',String(devPlacement.dragUnlocked));});
devResetBtn?.addEventListener('click',devResetSelected);devResetAllBtn?.addEventListener('click',devResetAll);devExportBtn?.addEventListener('click',devExport);devImportInput?.addEventListener('change',()=>devImport(devImportInput.files?.[0]));
devInspector?.addEventListener('input',event=>{const el=event.target.closest('[data-dev-path]');if(!el)return;const min=Number(el.min),max=Number(el.max),raw=Number(el.value);if(!Number.isFinite(raw))return;devApplyPath(el.dataset.devPath,Math.max(Number.isFinite(min)?min:-Infinity,Math.min(Number.isFinite(max)?max:Infinity,raw)));});

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
  if(devPlacement.enabled)return false;
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
  if(devPlacement.enabled){
    e.preventDefault();closeEnemyMenu();devHidePicker();
    const point=worldPointFromClient(e.clientX,e.clientY);
    if(devPlacement.dragUnlocked&&devPlacement.selection==='playerLanternGlow'){
      const pos=world.playerLanternScreenPosition?.();if(pos&&Math.hypot(point.x-pos.x,point.y-pos.y)<=30){devPlacement.drag={id:e.pointerId};canvas.setPointerCapture?.(e.pointerId);return;}
    }
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
    e.preventDefault();const point=worldPointFromClient(e.clientX,e.clientY),pos=world.playerLanternScreenPosition?.();if(!pos)return;const cfg=world.getDevPlacementConfig(),g=cfg.playerLanternGlow;g.sideOffset=Math.max(0,Math.min(40,Math.abs(point.x-pos.playerX)));g.y=Math.max(-32,Math.min(32,point.y-pos.playerY));world.setDevPlacementConfig(cfg);devSaveConfig();devRenderInspector();return;
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
  if(worldShortcutTargetIsEditable(e.target))return;
  if(devPlacement.enabled){
    if(devTemplateState?.open){
      if(e.code==='Escape'){e.preventDefault();if(devTemplateState.regionTool||devTemplateState.regionDraw){devTemplateState.regionTool=null;devTemplateState.regionDraw=null;devTemplateRenderCanvas();toast('Behind-zone drawing cancelled.');}else if(devTemplateState.selection)devTemplateSetSelection(null);else devTemplateSetOpen(false);return;}
      const step=e.shiftKey?5:1;if(e.code==='ArrowLeft'){e.preventDefault();devTemplateNudge(-step,0);return;}if(e.code==='ArrowRight'){e.preventDefault();devTemplateNudge(step,0);return;}if(e.code==='ArrowUp'){e.preventDefault();devTemplateNudge(0,-step);return;}if(e.code==='ArrowDown'){e.preventDefault();devTemplateNudge(0,step);return;}if((e.code==='Delete'||e.code==='Backspace')&&devTemplateState.selection?.kind==='asset'){e.preventDefault();devTemplateDeleteSelected();return;}return;
    }
    if(e.code==='Escape'){e.preventDefault();devSelect(null);return;}
    const step=e.shiftKey?5:1;if(e.code==='ArrowLeft'){e.preventDefault();devNudge(-step,0);return;}if(e.code==='ArrowRight'){e.preventDefault();devNudge(step,0);return;}if(e.code==='ArrowUp'){e.preventDefault();devNudge(0,-step);return;}if(e.code==='ArrowDown'){e.preventDefault();devNudge(0,step);return;}
    return;
  }
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
