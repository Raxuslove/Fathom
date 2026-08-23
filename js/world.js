import {TILE,FATHOMS_PER_TILE,depthFromY,yFromDepth,hash2,clamp,stratumIndex} from './world-core.js';

const DIRS={up:{x:0,y:-1},down:{x:0,y:1},left:{x:-1,y:0},right:{x:1,y:0}};
const BASE_ENTITY_MARGIN_TILES=4;
const AI_RADIUS_TILES=11;
const ROAMER_RETENTION_MULTIPLIER=2.4;
// v0.203.15: ordinary foes are authored by deterministic ecology sectors rather
// than a per-floor-tile lottery. This creates quiet stretches, lone roamers and
// occasional readable nests without accidental screen-filling clusters.
const ORDINARY_ECOLOGY_SECTOR_TILES=24;
// v0.205.1: increase ordinary roaming density by exactly 25% in expectation
// while preserving the existing lone:nest mix among active ecology sectors.
// Old expected bodies/sector: .27 + .08*3 = .51. New: .3375 + .10*3 = .6375.
const ORDINARY_ECOLOGY_QUIET_SHARE=.5625;
const ORDINARY_ECOLOGY_LONE_SHARE=.3375;
const ORDINARY_LOCAL_ACTIVE_CAP=6;
const FOE_SPRITE_SIZE=32;
const FOE_SPRITE_FILES={
  cutter:'goblin-cutter.png',
  scrounger:'goblin-cutter.png',
  skitter:'goblin-skitter.png',
  shieldback:'goblin-shieldback.png',
  mauler:'goblin-mauler.png',
  oldhand:'goblin-oldhand.png'
};
const FOE_SPRITE_DIRS=['./assets/ui/','./assets/enemies/','./assets/'];
const LOOT_BAG_FILE='./assets/ui/bag_coins.png';
const COMPANION_TORCH_FILE='./assets/ui/companion-torch.png';
const ORDINARY_HOLLOW_FIRST=20;
const ORDINARY_HOLLOW_GAP=30;
const HOLLOW_LOOKAHEAD=42;
const HOLLOW_CLEAR_X=4;
const HOLLOW_CLEAR_Y=3;
const HOLLOW_SAFE_X=7;
const HOLLOW_SAFE_Y=6;
const TOWN_TILE=TILE;
const CHEST_SECTOR_TILES=18;
const CHEST_SECTOR_CHANCE=.26;
const TOWN_BUILDING_IDS=new Set(['inn','herbalist','guild']);
const BOSS_ROOM_HALF_W_TILES=8;
const BOSS_ROOM_HALF_H_TILES=6;
const BOSS_ROOM_RING_X_TILES=10;
const BOSS_ROOM_RING_Y_TILES=8;
const BOSS_GATE_OFFSET_TILES=7;
// v0.203.14: mandatory boss boundaries seal the full generated cavern width
// across several rows, leaving only the authored gate throat.
const BOSS_SEAL_HALF_H_TILES=2;
const BOSS_GATE_HALF_WIDTH_TILES=2.5;
const BOSS_GATE_HALF_HEIGHT_TILES=.22;
const BOSS_AGGRO_RADIUS_TILES=10;
const MID_BOSS_AGGRO_RADIUS_TILES=42;
const BOSS_CONTACT_RADIUS=19;
const MID_BOSS_CONTACT_RADIUS=30;
const MID_BOSS_STANDOFF=26;
const MID_BOSS_VISUAL_SCALE=1.34;
// v0.204.0.6: combatants have physical bodies and all attack reach is measured
// surface-to-surface. Large creatures therefore remain hittable at their visible
// edge instead of requiring the delver to enter an impossible centre radius.
const COMBAT_FOE_BODY_RADIUS=9;
const COMBAT_MIDBOSS_BODY_RADIUS=13;
const COMBAT_BOSS_BODY_RADIUS=15;
const COMBAT_BODY_PADDING=1;
const TOWN_TITLE_RADIUS=TILE*7.5;
const MID_BOSS_CHASE_SPEED=122;
const BOSS_CHASE_SPEED=126;
const BOSS_ENEMY_EXCLUSION_FATHOMS=15;
const BOSS_ENEMY_EXCLUSION_TILES=BOSS_ENEMY_EXCLUSION_FATHOMS/FATHOMS_PER_TILE;
// A 250-fathom miniboss can acquire the player from much farther away than the
// old 15-fathom exclusion. Keep its whole approach quiet, then maintain a local
// moving bubble once the chase begins so a normal goblin cannot join the fight.
const MID_BOSS_ENEMY_EXCLUSION_TILES=MID_BOSS_AGGRO_RADIUS_TILES+8;
const MID_BOSS_MOVING_EXCLUSION_TILES=16;
// v0.203.16: ordinary hostiles still stay out of settlements themselves, but the
// surrounding no-spawn buffer is reduced from 50 to 25 fathoms so towns/cities
// do not sterilize such a large section of the continuous cavern.
const TOWN_ENEMY_EXCLUSION_FATHOMS=25;
const TOWN_ENEMY_EXCLUSION_TILES=TOWN_ENEMY_EXCLUSION_FATHOMS/FATHOMS_PER_TILE;
// Ant-colony topology: a guaranteed main spine, deterministic reconnecting
// branches, dead-end pockets, and occasional large chambers. These values are
// physical world scale only; balance/progression still uses the existing 500f
// stratum cadence.
const ANT_SECTOR_ROWS=96;
const ANT_MAIN_HALF_WIDTH=4;
const ANT_BRANCH_HALF_WIDTH=3;
const ANT_NESTED_HALF_WIDTH=2;
const WIDE_MAIN_HALF_WIDTH=7;
const WIDE_BRANCH_HALF_WIDTH=5;
const WIDE_NESTED_HALF_WIDTH=3;
// v0.203.11: the new main route is deliberately about twice the v0.203.10
// width. A protected inner core prevents erosion from turning it into a choke.
const ORGANIC_MAIN_HALF_WIDTH=15;
const ORGANIC_MAIN_CORE_HALF_WIDTH=13;
const ORGANIC_BRANCH_HALF_WIDTH=6;
const ORGANIC_NESTED_HALF_WIDTH=4;
// v0.203.12: fresh/new terrain doubles the v0.203.11 main-spine width again.
// The broad protected core keeps ordinary travel spacious while the outer lip
// still erodes enough to look like cave stone rather than a rectangle.
const ORGANIC_V2_MAIN_HALF_WIDTH=30;
const ORGANIC_V2_MAIN_CORE_HALF_WIDTH=26;
const ORGANIC_V2_BRANCH_HALF_WIDTH=7;
const ORGANIC_V2_NESTED_HALF_WIDTH=5;
const VARIED_SECTOR_ROWS=132;
const VARIED_WORLD_HALF_WIDTH=102;
const ANT_WORLD_HALF_WIDTH=54;
const SIDE_PHYSICAL_LENGTH_TILES=54;
// v0.203.10: keep the existing Side Passage corridor, then optionally continue
// it into a much larger adventure region: huge chamber, room network, remote loop
// or branching dead end. This is additive; ordinary cave forks remain untouched.
const SIDE_NETWORK_GENERATION=2;
const SIDE_ORGANIC_GENERATION=3;
const SIDE_VARIETY_GENERATION=4;
const SIDE_NETWORK_MIN_LATERAL_TILES=22;
const SIDE_NETWORK_ENTRY_HALF_WIDTH=4;
const SIDE_NETWORK_ROUTE_HALF_WIDTH=4;
const SIDE_ORGANIC_CORE_ROUTE_HALF_WIDTH=3.1;
const ROAD_EVENT_FAR_MARGIN_TILES=4;
const MINIMAP_CELL_TILES=2;
const MINIMAP_REVEAL_RADIUS_TILES=9;
const MINIMAP_RADIUS_X_CELLS=25;
const MINIMAP_RADIUS_Y_CELLS=18;
// Index increases as the player zooms IN. Index 2 preserves the v0.205.0 view.
const MINIMAP_ZOOM_LEVELS=Object.freeze([
  Object.freeze({x:36,y:26}),Object.freeze({x:30,y:22}),Object.freeze({x:25,y:18}),Object.freeze({x:20,y:14}),Object.freeze({x:16,y:11})
]);
const TOWN_WALL_THICKNESS=TILE*.42;
const TOWN_GATE_HALF_WIDTH=TILE*2.15;
const WORLD_SNAPSHOT_VERSION=2035;
// Claude's temporary live-terrain build stored Infinity in the snapshot. JSON
// serializes Infinity as null. Convert those null markers to a large finite value
// so the currently-generated v0.203.12 terrain stays stable instead of collapsing
// into an unintended legacy migration on the next load.
const LIVE_TERRAIN_LOCK_TY=1000000000;

export class World{
  constructor(canvas,{seed=41729,onEncounter,onToast,onInteract,onLoot,onDepth,onSettlementEnter,onSettlementLeave,onLocationTitle,onEnterSide,onLeaveSide,onPassWorldEvent,onHostile,onMinimapZoom,getDetectionRadius,getProfiles,getTowns,getWorldEvents,getCompanion,getSideArea}={}){
    this.canvas=canvas;
    this.ctx=canvas.getContext('2d',{alpha:false});
    this.ctx.imageSmoothingEnabled=false;
    this.seed=seed;
    this.onEncounter=onEncounter;
    this.onToast=onToast;
    this.onInteract=onInteract;
    this.onLoot=onLoot;
    this.onDepth=onDepth;
    this.onSettlementEnter=onSettlementEnter;
    this.onSettlementLeave=onSettlementLeave;
    this.onLocationTitle=onLocationTitle;
    this.onMinimapZoom=typeof onMinimapZoom==='function'?onMinimapZoom:null;
    this.onEnterSide=onEnterSide;
    this.onLeaveSide=onLeaveSide;
    this.onPassWorldEvent=onPassWorldEvent;
    this.getProfiles=getProfiles||(()=>[]);
    this.getTowns=getTowns||(()=>[]);
    this.getWorldEvents=getWorldEvents||(()=>[]);
    this.getCompanion=getCompanion||(()=>null);
    this.getSideArea=getSideArea||(()=>null);
    this.worldEvents=[];
    this.worldEventSignature='';
    this.persistentEventSites=[];
    this.passedWorldEvents=new Set();
    this.transitionLock='';
    this.sideWasInside=false;
    this.locationTitleZone='';
    this.bossActors=new Map();
    this.lastCollisionReason=null;
    // v0.203.4: one authoritative world coordinate system. Towns and side
    // passages are geometry inside the cavern; there are no local-map modes.
    this.lastSafePosition={x:TILE*.5,y:0,deepestY:0};
    this.towns=[];this.townPlanCache=[];this.townSignature='';this.sealedTownGates=new Set();
    this.activeSide=null;this.activeSidePlan=null;this.persistentSidePlans=[];this.sideSignature='';
    this.sideGeometryCache=new Map();
    this.sideNetworkStartDepth=0;
    this.sideOrganicStartDepth=0;
    this.sideVarietyStartDepth=0;

    this.player={x:TILE*.5,y:0,deepestY:0,r:7,speed:95,dir:'up',moving:false};
    this.camera={x:0,y:-80};
    this.zoom=1.15;
    this.exploredCells=new Set();
    this.explorationAnchor='';
    // v0.203.9.1 performance: terrain is deterministic across frames, so cache
    // tile solidity instead of recomputing the full cave graph for every wall
    // edge, collision corner and minimap sample on every draw.
    this.wallCache=new Map();
    this.minimapFloorCache=new Map();
    this.minimapCanvas=document.getElementById('worldMinimapCanvas');
    this.minimapCtx=this.minimapCanvas?.getContext('2d',{alpha:true})||null;
    this.minimapPanel=document.getElementById('worldMinimapPanel');
    this.minimapToggle=document.getElementById('btnWorldMinimap');
    this.minimapZoomOut=document.getElementById('btnWorldMinimapZoomOut');
    this.minimapZoomIn=document.getElementById('btnWorldMinimapZoomIn');
    this.minimapZoomIndex=2;
    this.minimapOpen=true;
    this.minimapDirty=true;
    this.minimapLastDraw=-999;
    if(this.minimapCtx)this.minimapCtx.imageSmoothingEnabled=false;
    if(this.minimapToggle){
      this.minimapToggle.addEventListener('click',()=>this.setMinimapOpen(!this.minimapOpen));
      this.setMinimapOpen(true);
    }
    this.minimapZoomOut?.addEventListener('click',()=>this.setMinimapZoom(this.minimapZoomIndex-1));
    this.minimapZoomIn?.addEventListener('click',()=>this.setMinimapZoom(this.minimapZoomIndex+1));
    this.updateMinimapZoomControls();
    // Existing v0.203.6 saves keep already-explored terrain unchanged; the new
    // ant-colony topology begins just beyond their deepest explored frontier.
    this.antTopologyStartTy=-8;
    this.networkTopologyStartTy=-8;
    this.wideTopologyStartTy=-8;
    this.organicTopologyStartTy=-8;
    this.varietyTopologyStartTy=-8;
    this.dpr=1;
    this.keys=new Set();
    this.joy={x:0,y:0};
    this.inputEnabled=false;
    this.combat=false;
    this.last=0;
    this.time=0;
    this.nearby=null;
    this.defeated=new Set();
    this.opened=new Set();
    this.visitedSettlements=new Set();
    this.roamers=new Map();
    this.lootBags=new Map();
    this.reachabilityCache=new Map();
    this.activeEntities=[];
    this.particles=[];
    this.animations=[];
    this.combatFoe=null;
    this.combatEntityId=null;
    this.combatPlayerRange=10;
    // Temporary tuning guide: literal weapon-space reach from the player body.
    // Unlike the old enemy-centred threshold circle, this remains meaningful
    // outside combat and visibly changes with the persistent reach slider.
    this.playerReachGuideRange=10;this.playerReachGuideVisible=false;
    this.combatPlayerMelee=true;
    this.combatPlayerInRange=false;
    this.combatEnemyThreatRange=10;
    this.combatThreatActive=false;
    this.autoApproach=false;
    this.onHostile=typeof onHostile==='function'?onHostile:null;
    this.getDetectionRadius=typeof getDetectionRadius==='function'?getDetectionRadius:null;
    this.companionVisual={x:0,y:0,ready:false,id:null};
    this.companionTorch={img:new Image(),ready:false};
    this.companionTorch.img.onload=()=>this.companionTorch.ready=true;
    this.companionTorch.img.onerror=()=>this.companionTorch.ready=false;
    this.companionTorch.img.src=COMPANION_TORCH_FILE;
    this.foeSprites=new Map();
    this.lootBagSprite={img:new Image(),ready:false};
    this.lootBagSprite.img.onload=()=>this.lootBagSprite.ready=true;
    this.lootBagSprite.img.onerror=()=>this.lootBagSprite.ready=false;
    this.lootBagSprite.img.src=LOOT_BAG_FILE;

    this.resizeObserver=new ResizeObserver(()=>this.resize());
    this.resizeObserver.observe(canvas);
    this.resize();
  }

  restore(data,legacyDepth=0){
    if(data)this.seed=Number(data.seed)||this.seed;
    const topologyKeys=['antTopologyStartTy','networkTopologyStartTy','wideTopologyStartTy','organicTopologyStartTy','varietyTopologyStartTy'];
    const claudeLiveTerrainSnapshot=!!data&&topologyKeys.some(key=>data[key]===null);
    const savedNumber=(key)=>{const raw=data?.[key];return raw!==null&&raw!==undefined&&Number.isFinite(Number(raw))?Number(raw):null;};
    const savedTopologyTy=(key,fallback)=>{const n=savedNumber(key);if(n!==null)return Math.floor(n);return claudeLiveTerrainSnapshot?LIVE_TERRAIN_LOCK_TY:fallback;};
    // A restore is also a runtime-world handoff (slot switch/new delver). Never
    // carry transient actors, passed-event flags, or terrain caches across runs.
    this.roamers.clear();this.bossActors.clear();this.passedWorldEvents.clear();
    this.activeEntities=[];this.particles=[];this.animations=[];this.combatFoe=null;this.combatEntityId=null;this.combat=false;this.combatPlayerRange=10;this.combatPlayerMelee=true;this.combatPlayerInRange=false;this.combatEnemyThreatRange=10;this.combatThreatActive=false;this.autoApproach=false;this.nearby=null;
    this.worldEvents=[];this.worldEventSignature='';this.towns=[];this.townPlanCache=[];this.townSignature='';
    this.activeSide=null;this.activeSidePlan=null;this.sideSignature='';this.transitionLock='';this.sideWasInside=false;this.locationTitleZone='';
    this.companionVisual={x:0,y:0,ready:false,id:null};this.reachabilityCache.clear();this.wallCache.clear();this.minimapFloorCache.clear();this.sideGeometryCache.clear();
    // Completed/abandoned side passages are real world geometry. Keep plans in
    // the world snapshot so closing a passage never makes the floor disappear.
    this.persistentSidePlans=Array.isArray(data?.sidePlans)?data.sidePlans.filter(v=>v&&v.id&&Number.isFinite(Number(v.mouthTx))&&Number.isFinite(Number(v.mouthTy))).map(v=>({
      id:String(v.id),count:Math.max(1,Number(v.count)||1),lengthTiles:Math.max(14,Number(v.lengthTiles)||SIDE_PHYSICAL_LENGTH_TILES),
      mouthTx:Number(v.mouthTx),mouthTy:Number(v.mouthTy),centerTx:Number(v.centerTx),sign:Number(v.sign)<0?-1:1,
      generation:Math.max(1,Number(v.generation)||1),archetype:Math.max(0,Math.min(3,Math.floor(Number(v.archetype)||0))),
      shapeSeed:Number.isFinite(Number(v.shapeSeed))?Number(v.shapeSeed):0,depth:Number.isFinite(Number(v.depth))?Number(v.depth):depthFromY(Number(v.mouthTy)*TILE)
    })):[];
    this.persistentEventSites=Array.isArray(data?.eventSites)?data.eventSites.filter(v=>v&&v.id&&v.type==='rescue-hideout'&&Number.isFinite(Number(v.tx))&&Number.isFinite(Number(v.ty))).map(v=>({id:String(v.id),type:'rescue-hideout',tx:Number(v.tx),ty:Number(v.ty),center:Number(v.center),sign:Number(v.sign)<0?-1:1})):[];
    // Establish the side-network migration frontier BEFORE event descriptors are
    // materialized, otherwise an old save could have a nearby passage rewritten
    // underneath it during restore.
    const preloadDeepestY=Number.isFinite(Number(data?.deepestY))?Number(data.deepestY):yFromDepth(legacyDepth);
    const preloadFallbackTy=data?Math.floor(Math.min(preloadDeepestY,yFromDepth(legacyDepth))/TILE)-12:-8;
    this.varietyTopologyStartTy=savedTopologyTy('varietyTopologyStartTy',preloadFallbackTy);
    const preloadSideFallback=data?Math.max(0,depthFromY(Math.min(preloadDeepestY,yFromDepth(legacyDepth)))+8):0;
    const preloadSideStart=savedNumber('sideNetworkStartDepth');
    this.sideNetworkStartDepth=preloadSideStart!==null?Math.max(0,preloadSideStart):preloadSideFallback;
    const preloadSideOrganicStart=savedNumber('sideOrganicStartDepth');
    this.sideOrganicStartDepth=preloadSideOrganicStart!==null?Math.max(0,preloadSideOrganicStart):preloadSideFallback;
    const preloadSideVarietyStart=savedNumber('sideVarietyStartDepth');
    this.sideVarietyStartDepth=preloadSideVarietyStart!==null?Math.max(0,preloadSideVarietyStart):preloadSideFallback;
    this.refreshWorldEvents();this.refreshTowns();this.refreshSidePlan();

    // v0.203.4 migration: old side instances stored local side-map coordinates
    // in the top-level x/y fields. Their nested return point is the real cavern
    // position. Town instances also carried a return point, so prefer it when
    // present and discard all local-map coordinates permanently.
    const sideReturn=data?.side?.return&&typeof data.side.return==='object'?data.side.return:null;
    const townReturn=data?.town?.return&&typeof data.town.return==='object'?data.town.return:null;
    const migratedReturn=sideReturn||townReturn;
    let x=migratedReturn&&Number.isFinite(Number(migratedReturn.x))?Number(migratedReturn.x):Number.isFinite(Number(data?.x))?Number(data.x):TILE*.5;
    let y=migratedReturn&&Number.isFinite(Number(migratedReturn.y))?Number(migratedReturn.y):Number.isFinite(Number(data?.y))?Number(data.y):yFromDepth(legacyDepth);
    let deepest=migratedReturn&&Number.isFinite(Number(migratedReturn.deepestY))?Number(migratedReturn.deepestY):Number.isFinite(Number(data?.deepestY))?Number(data.deepestY):Math.min(y,yFromDepth(legacyDepth));
    const topologyFallbackTy=data?Math.floor(Math.min(deepest,yFromDepth(legacyDepth))/TILE)-12:-8;
    this.antTopologyStartTy=savedTopologyTy('antTopologyStartTy',topologyFallbackTy);
    // v0.203.8 changes the ant-colony geometry again. Existing v0.203.7 saves
    // keep everything already explored exactly as it was; the richer network
    // begins ~6 fathoms beyond the current deepest frontier.
    this.networkTopologyStartTy=savedTopologyTy('networkTopologyStartTy',topologyFallbackTy);
    // v0.203.9 widens the v0.203.8 network. Preserve already-explored 0.203.8
    // terrain and begin the wider geometry several fathoms beyond the frontier.
    this.wideTopologyStartTy=savedTopologyTy('wideTopologyStartTy',topologyFallbackTy);
    // v0.203.11 doubles the main-route width and adds protected edge erosion.
    // Existing saves retain all already-explored v0.203.10 terrain; the organic
    // geometry begins several fathoms beyond the current deepest frontier.
    this.organicTopologyStartTy=savedTopologyTy('organicTopologyStartTy',topologyFallbackTy);
    // v0.203.12 changes fresh topology again: a doubled main spine, larger
    // route excursions, recessed settlement pockets and edge-relative Hollows.
    // Existing saves keep the already-seen v0.203.11 terrain exactly as-is.
    this.varietyTopologyStartTy=savedTopologyTy('varietyTopologyStartTy',topologyFallbackTy);
    // v0.203.10 introduces deliberately large Side Networks. Existing saves keep
    // already-authored passage geometry around the current frontier; new passage
    // descriptors beyond this point use the new graph-based layouts.
    const sideFallbackDepth=data?Math.max(0,depthFromY(Math.min(deepest,yFromDepth(legacyDepth)))+8):0;
    const savedSideNetworkStart=savedNumber('sideNetworkStartDepth');
    this.sideNetworkStartDepth=savedSideNetworkStart!==null?Math.max(0,savedSideNetworkStart):sideFallbackDepth;
    const savedSideOrganicStart=savedNumber('sideOrganicStartDepth');
    this.sideOrganicStartDepth=savedSideOrganicStart!==null?Math.max(0,savedSideOrganicStart):sideFallbackDepth;
    const savedSideVarietyStart=savedNumber('sideVarietyStartDepth');
    this.sideVarietyStartDepth=savedSideVarietyStart!==null?Math.max(0,savedSideVarietyStart):sideFallbackDepth;

    // v0.203.4.x spatial snapshots cannot be trusted after the old instanced
    // side-passage exit/recovery path. Those builds could save a perfectly valid
    // character at a poisoned world coordinate and every later reload would keep
    // restoring it. v2035 performs ONE spatial-only repair: preserve the entire
    // run, but respawn the player on the guaranteed cavern spine at canonical
    // Fathom depth. Once the new snapshot is saved, normal x/y persistence resumes.
    const snapshotVersion=Math.max(0,Number(data?.version)||0);
    const canonicalDepth=Math.max(0,Number(legacyDepth)||0);
    const needsSpatialRepair=!!data&&snapshotVersion>0&&snapshotVersion<WORLD_SNAPSHOT_VERSION;
    if(needsSpatialRepair){
      y=yFromDepth(canonicalDepth);
      const ty=Math.floor(y/TILE);
      x=(this.corridorCenter(ty)+.5)*TILE;
      deepest=y;
    }

    this.defeated=new Set(data?.defeated||[]);
    this.opened=new Set(data?.opened||[]);
    this.visitedSettlements=new Set(data?.visited||[]);
    this.sealedTownGates=new Set(data?.sealedTownGates||[]);
    this.lootBags=new Map((data?.lootBags||[]).filter(v=>v&&v.id&&v.recordId).map(v=>[
      String(v.id),
      {type:'loot',id:String(v.id),recordId:String(v.recordId),x:Number(v.x)||0,y:Number(v.y)||0}
    ]));
    this.exploredCells=new Set(Array.isArray(data?.exploredCells)?data.exploredCells.map(String):[]);
    this.explorationAnchor='';

    const savedSafe=data?.lastSafe&&typeof data.lastSafe==='object'?data.lastSafe:null;
    if(savedSafe&&Number.isFinite(Number(savedSafe.x))&&Number.isFinite(Number(savedSafe.y))){
      this.lastSafePosition={x:Number(savedSafe.x),y:Number(savedSafe.y),deepestY:Number.isFinite(Number(savedSafe.deepestY))?Number(savedSafe.deepestY):Number(savedSafe.y)};
    }else this.lastSafePosition={x,y,deepestY:deepest};

    if(!this.setPlayerPositionSafe(x,y,{deepestY:deepest,allowLastSafe:true,reachable:true,maxRings:18}))this.recoverToDepth(legacyDepth);
    this.updateTownDepartureSeals();
    this.camera.x=this.player.x;
    this.camera.y=this.player.y-50;
    this.revealAroundPlayer(true);
  }

  snapshot(){
    this.rememberSafePosition();
    return {
      version:WORLD_SNAPSHOT_VERSION,
      x:this.player.x,
      y:this.player.y,
      deepestY:this.player.deepestY,
      lastSafe:{...this.lastSafePosition},
      seed:this.seed,
      antTopologyStartTy:this.antTopologyStartTy,
      networkTopologyStartTy:this.networkTopologyStartTy,
      wideTopologyStartTy:this.wideTopologyStartTy,
      organicTopologyStartTy:this.organicTopologyStartTy,
      varietyTopologyStartTy:this.varietyTopologyStartTy,
      sideNetworkStartDepth:this.sideNetworkStartDepth,
      sideOrganicStartDepth:this.sideOrganicStartDepth,
      sideVarietyStartDepth:this.sideVarietyStartDepth,
      eventSites:this.persistentEventSites.map(v=>({...v})),
      sidePlans:this.persistentSidePlans.map(p=>({id:p.id,count:p.count,lengthTiles:p.lengthTiles,mouthTx:p.mouthTx,mouthTy:p.mouthTy,centerTx:p.centerTx,sign:p.sign,generation:p.generation||1,archetype:p.archetype||0,shapeSeed:p.shapeSeed||0,depth:Number.isFinite(Number(p.depth))?Number(p.depth):depthFromY(p.mouthTy*TILE)})),
      defeated:[...this.defeated],
      opened:[...this.opened],
      visited:[...this.visitedSettlements],
      sealedTownGates:[...this.sealedTownGates],
      exploredCells:[...this.exploredCells],
      lootBags:[...this.lootBags.values()].map(b=>({id:b.id,recordId:b.recordId,x:b.x,y:b.y}))
    };
  }

  bossPlan(kind,stratum){
    const st=Math.max(0,Math.floor(Number(stratum)||0));
    const depth=kind==='midboss'?st*500+250:(st+1)*500;
    const ty=Math.floor(yFromDepth(depth)/TILE),centerTx=this.corridorCenter(ty);
    return {kind,stratum:st,id:`${kind}:${st}`,depth,ty,centerTx,gateTy:ty-BOSS_GATE_OFFSET_TILES};
  }

  bossPlansNearTy(ty,rangeTiles=40){
    // Mandatory encounters alternate every 250 fathoms (500 tile rows). Derive
    // only the plans actually near this row; isWall() calls this frequently, so
    // do not scan multiple strata on every collision/render query.
    const depth=depthFromY(ty*TILE),rangeDepth=Math.max(0,Number(rangeTiles)||0)*FATHOMS_PER_TILE,out=[];
    const first=Math.max(1,Math.ceil((depth-rangeDepth)/250)),last=Math.floor((depth+rangeDepth)/250);
    if(last<first)return out;
    for(let k=first;k<=last;k++){
      const kind=k%2?'midboss':'boss',st=kind==='midboss'?(k-1)/2:k/2-1,plan=this.bossPlan(kind,st);
      if(Math.abs(plan.ty-ty)<=rangeTiles)out.push(plan);
    }
    return out;
  }

  bossPlanForEvent(event){
    if(!event||!['midboss','boss'].includes(event.type))return null;
    const st=Number.isFinite(Number(event.bossStratum))?Number(event.bossStratum):Math.max(0,Math.floor((Number(event.depth)||0)/500));
    return this.bossPlan(event.type,st);
  }

  activeBossEventForPlan(plan){
    if(!plan)return null;
    return this.worldEvents.find(e=>e&&e.type===plan.kind&&String(e.id)===plan.id)||null;
  }

  bossTerrainOverride(tx,ty){
    for(const plan of this.bossPlansNearTy(ty,22)){
      // Mid-bosses are oversized ordinary goblins encountered in the normal
      // cave network. Only full 500-fathom stratum bosses own an arena/gate.
      if(plan.kind==='midboss')continue;
      const dx=tx-plan.centerTx,dy=ty-plan.ty,adx=Math.abs(dx),ady=Math.abs(dy);
      // A solid cross-cavern rock band makes the mandatory route unbypassable.
      // The only opening is the five-tile gate throat, whose closed state is a
      // visible physical gate rather than an invisible depth clamp.
      // Seal the entire generated cavern cross-section and make the seal several
      // rows thick. A one-row barrier can be bypassed by a diagonal branch; a
      // finite 32-tile seal can be bypassed by the v0.203.12 broad cavern. The
      // authored gate throat is the only floor through this band.
      if(Math.abs(ty-plan.gateTy)<=BOSS_SEAL_HALF_H_TILES)return adx>BOSS_GATE_HALF_WIDTH_TILES;
      // Carve the chamber interior. The surrounding two-tile ring is forced rock
      // so the room reads as authored space instead of a random cavern widening.
      if(adx<=BOSS_ROOM_RING_X_TILES&&ady<=BOSS_ROOM_RING_Y_TILES){
        if(adx<=BOSS_ROOM_HALF_W_TILES&&ady<=BOSS_ROOM_HALF_H_TILES)return false;
        if(adx<=BOSS_GATE_HALF_WIDTH_TILES&&(dy>=BOSS_ROOM_HALF_H_TILES||dy<=-BOSS_ROOM_HALF_H_TILES))return false;
        return true;
      }
      // Join both throats back to the ordinary cavern spine.
      if(ady<=14){
        const spine=this.corridorCenter(ty),lo=Math.min(plan.centerTx,spine)-2,hi=Math.max(plan.centerTx,spine)+2;
        if(tx>=lo&&tx<=hi)return false;
      }
    }
    return null;
  }

  bossGateReason(x,y,r){
    for(const event of this.worldEvents){
      if(!event||event.type!=='boss')continue;
      const plan=this.bossPlanForEvent(event);if(!plan)continue;
      const gx=(plan.centerTx+.5)*TILE,gy=(plan.gateTy+.5)*TILE;
      const halfW=BOSS_GATE_HALF_WIDTH_TILES*TILE,halfH=BOSS_GATE_HALF_HEIGHT_TILES*TILE;
      if(Math.abs(x-gx)<r+halfW&&Math.abs(y-gy)<r+halfH)return `${event.type}-gate`;
    }
    return null;
  }

  bossExclusionAtTile(tx,ty){
    const x=(tx+.5)*TILE,y=(ty+.5)*TILE;
    for(const event of this.worldEvents){
      if(!event||!['midboss','boss'].includes(event.type))continue;
      const plan=this.bossPlanForEvent(event);if(!plan)continue;
      const bx=(plan.centerTx+.5)*TILE,by=(plan.ty+.5)*TILE;
      const originLimit=(event.type==='midboss'?MID_BOSS_ENEMY_EXCLUSION_TILES:BOSS_ENEMY_EXCLUSION_TILES)*TILE;
      if(Math.hypot(x-bx,y-by)<originLimit)return true;
      if(event.type==='midboss'){
        const actor=this.bossActors.get(`worldevent:${event.id}`);
        if(actor?.aggro&&Math.hypot(x-actor.x,y-actor.y)<MID_BOSS_MOVING_EXCLUSION_TILES*TILE)return true;
      }
    }
    return false;
  }

  getBossActor(event){
    const plan=this.bossPlanForEvent(event);if(!plan)return null;
    const id=`worldevent:${event.id}`;
    let actor=this.bossActors.get(id);
    if(!actor){
      const spawnTx=event.type==='midboss'?plan.centerTx+(hash2(plan.stratum,317,this.seed)>.5?4:-4):plan.centerTx;
      const spawnTy=event.type==='midboss'?plan.ty:plan.ty-4;
      const spawnX=(spawnTx+.5)*TILE,spawnY=(spawnTy+.5)*TILE;
      actor={type:event.type,id,eventId:event.id,event,eventKind:event.type,bossStratum:plan.stratum,foeId:event.profileId||null,x:spawnX,y:spawnY,spawnX,spawnY,aggro:false,speed:event.type==='boss'?BOSS_CHASE_SPEED:MID_BOSS_CHASE_SPEED,tx:spawnTx,ty:spawnTy};
      this.bossActors.set(id,actor);
    }
    actor.type=event.type;actor.event=event;actor.eventId=event.id;actor.eventKind=event.type;actor.bossStratum=plan.stratum;actor.foeId=event.profileId||actor.foeId||null;actor.tx=Math.floor(actor.x/TILE);actor.ty=Math.floor(actor.y/TILE);
    return actor;
  }

  moveWorldActor(actor,dx,dy,r=9){
    const maxStep=Math.max(1,Math.min(TILE*.20,r*.65)),steps=Math.max(1,Math.ceil(Math.max(Math.abs(dx),Math.abs(dy))/maxStep)),sx=dx/steps,sy=dy/steps;
    for(let i=0;i<steps;i++){
      const nx=actor.x+sx;if(!this.collides(nx,actor.y,r,{ignoreBossGate:true}))actor.x=nx;
      const ny=actor.y+sy;if(!this.collides(actor.x,ny,r,{ignoreBossGate:true}))actor.y=ny;
    }
  }

  updateBossActors(dt,entities){
    for(const actor of entities){
      if(!['midboss','boss'].includes(actor.type))continue;
      const homeX=Number(actor.spawnX)||Number(actor.x)||0,homeY=Number(actor.spawnY)||Number(actor.y)||0;
      if(actor.combatEvading){
        const dx=homeX-actor.x,dy=homeY-actor.y,len=Math.hypot(dx,dy)||1,step=Math.min(len,150*dt);
        if(step>0)this.moveWorldActor(actor,dx/len*step,dy/len*step,10);
        if(len<8){actor.x=homeX;actor.y=homeY;actor.aggro=false;actor.hostile=false;actor.combatEvading=false;actor.combatTelegraph='';if(Number.isFinite(Number(actor.combatHpMax)))actor.combatHp=actor.combatHpMax;if(actor.combatLegacyState&&Number.isFinite(Number(actor.combatLegacyState.hpMax)))actor.combatLegacyState.hp=actor.combatLegacyState.hpMax;}
        continue;
      }
      const dist=Math.hypot(actor.x-this.player.x,actor.y-this.player.y);
      const aggroTiles=actor.type==='midboss'?MID_BOSS_AGGRO_RADIUS_TILES:BOSS_AGGRO_RADIUS_TILES;
      if(!actor.aggro&&dist<=aggroTiles*TILE){
        actor.aggro=true;actor.hostile=true;this.onHostile?.(actor);
        this.onToast?.(actor.type==='boss'?'The guardian sees you. The lower way is sealed.':'An oversized goblin spots you and gives chase.');
      }
      if(!actor.aggro||!this.inputEnabled)continue;
      // A secondary boss/miniboss obeys the same territory rules as when it is
      // the active target. Switching targets must never turn a chamber boss
      // into something that can be dragged indefinitely through the cavern.
      let inside=true;
      if(actor.type==='boss'){
        const plan=this.bossPlanForEvent(actor.event);
        if(plan){const cx=(plan.centerTx+.5)*TILE,cy=(plan.ty+.5)*TILE,halfW=(BOSS_ROOM_HALF_W_TILES+.75)*TILE,halfH=(BOSS_ROOM_HALF_H_TILES+1.5)*TILE;inside=Math.abs(this.player.x-cx)<=halfW&&Math.abs(this.player.y-cy)<=halfH;}
      }else inside=Math.hypot(this.player.x-homeX,this.player.y-homeY)<=46*TILE;
      if(!inside){actor.combatEvading=true;actor.hostile=false;actor.combatTelegraph='';continue;}
      // Secondary bosses/minibosses also commit their position during a Heavy
      // wind-up. The active target is rooted by the bridge; this keeps both paths
      // identical when the player switches targets mid-fight.
      if(actor.combatTelegraph==='HEAVY')continue;
      // The oversized 250-fathom goblin stops just outside the delver's sprite
      // instead of walking into the same tile while combat is being handed off.
      const standoff=actor.type==='midboss'?Math.max(MID_BOSS_STANDOFF,this.player.r+COMBAT_MIDBOSS_BODY_RADIUS+COMBAT_BODY_PADDING):this.player.r+COMBAT_BOSS_BODY_RADIUS+COMBAT_BODY_PADDING;
      const dx=this.player.x-actor.x,dy=this.player.y-actor.y,len=Math.hypot(dx,dy)||1;
      const step=Math.min(Math.max(0,len-standoff),actor.speed*dt);
      if(step>0)this.moveWorldActor(actor,dx/len*step,dy/len*step,10);
    }
  }

  sideOffsetTy(u){return Math.round(Math.sin(u*.42)*1.15+Math.sin(u*.17)*.55);}

  sidePlanKey(plan){
    return `${plan?.id||'side'}:${plan?.generation||1}:${plan?.archetype||0}:${plan?.shapeSeed||0}:${plan?.mouthTx||0}:${plan?.mouthTy||0}:${plan?.sign||1}`;
  }

  rememberSidePlan(plan){
    if(!plan?.id)return;
    const copy={
      id:String(plan.id),count:Math.max(1,Number(plan.count)||1),lengthTiles:Math.max(14,Number(plan.lengthTiles)||SIDE_PHYSICAL_LENGTH_TILES),
      mouthTx:Number(plan.mouthTx),mouthTy:Number(plan.mouthTy),centerTx:Number(plan.centerTx),sign:Number(plan.sign)<0?-1:1,
      generation:Math.max(1,Number(plan.generation)||1),archetype:Math.max(0,Math.min(3,Math.floor(Number(plan.archetype)||0))),
      shapeSeed:Number.isFinite(Number(plan.shapeSeed))?Number(plan.shapeSeed):0,
      depth:Number.isFinite(Number(plan.depth))?Number(plan.depth):depthFromY(Number(plan.mouthTy)*TILE)
    };
    if(!Number.isFinite(copy.mouthTx)||!Number.isFinite(copy.mouthTy)||!Number.isFinite(copy.centerTx))return;
    const i=this.persistentSidePlans.findIndex(p=>p.id===copy.id);
    if(i>=0)this.persistentSidePlans[i]=copy;else this.persistentSidePlans.push(copy);
    this.sideGeometryCache.delete(this.sidePlanKey(copy));
  }

  refreshSidePlan(){
    const side=this.getSideArea?.()||null;
    const sig=side?`${side.id}:${Number(side.entryDepth)||0}:${Number(side.encountersNeeded)||1}:${Number(side.encountersDefeated)||0}:${side.routeNodeActive?1:0}:${side.chestOpened?1:0}:${side.paused?1:0}`:'';
    // v0.203.9.3 migration: an old active side event may remain in canonical
    // save data only as an archive. Convert its geometry into a persistent world
    // plan, then treat it as ordinary cavern forever.
    if(side?.paused){
      if(sig!==this.sideSignature){
        this.sideSignature=sig;
        const count=Math.max(1,Number(side.encountersNeeded)||1),event={type:'sidepassage',id:side.id||'parked-side',depth:Number(side.entryDepth)||0};
        this.rememberSidePlan(this.prospectiveSidePlan(event,{forceLegacy:true,count}));
        this.reachabilityCache.clear();this.wallCache.clear();this.minimapFloorCache.clear();this.minimapDirty=true;
      }
      this.activeSide=null;this.activeSidePlan=null;return;
    }
    if(sig===this.sideSignature){this.activeSide=side;if(this.activeSidePlan)this.activeSidePlan.side=side;return;}
    const previousPlan=this.activeSidePlan;
    this.sideSignature=sig;this.activeSide=side;
    if(!side){
      if(previousPlan)this.rememberSidePlan(previousPlan);
      this.activeSidePlan=null;this.reachabilityCache.clear();this.wallCache.clear();this.minimapFloorCache.clear();this.minimapDirty=true;return;
    }
    this.persistentSidePlans=this.persistentSidePlans.filter(p=>p.id!==String(side.id));
    const count=Math.max(1,Number(side.encountersNeeded)||1),event={type:'sidepassage',id:side.id||'active-side',depth:Number(side.entryDepth)||0};
    this.activeSidePlan={...this.prospectiveSidePlan(event,{count}),side};
    this.reachabilityCache.clear();this.wallCache.clear();this.minimapFloorCache.clear();this.minimapDirty=true;
  }
  sidePlan(){return this.activeSidePlan;}

  prospectiveSidePlan(event,{forceLegacy=false,count=5}={}){
    const mouth=this.eventTile(event),depth=Math.max(0,Number(event?.depth)||0);
    const shapeSeed=Math.floor(hash2(Math.floor(depth*10),Math.max(1,String(event?.id||'').length),this.seed+3181)*1000000);
    // Keep classic passages in the mix, but make substantial adventures common.
    // v0.203.11 also makes the reconnecting expedition common enough to be a
    // recognizable feature instead of a rare layout the player may never see.
    const expansionRoll=hash2(shapeSeed%100003,Math.floor(depth*10),this.seed+3191);
    let generation=1;
    if(!forceLegacy&&depth>=this.sideNetworkStartDepth&&expansionRoll>.12){
      generation=depth>=this.sideVarietyStartDepth?SIDE_VARIETY_GENERATION:(depth>=this.sideOrganicStartDepth?SIDE_ORGANIC_GENERATION:SIDE_NETWORK_GENERATION);
    }
    const archetypeRoll=hash2(Math.floor(depth*10),shapeSeed%997,this.seed+3203);
    const archetype=archetypeRoll<.47?2:archetypeRoll<.67?0:archetypeRoll<.85?1:3;
    return {side:null,count:Math.max(1,Number(count)||5),lengthTiles:SIDE_PHYSICAL_LENGTH_TILES,mouthTx:mouth.tx,mouthTy:mouth.ty,centerTx:mouth.center,sign:mouth.sign,id:String(event?.id||'prospective-side'),generation,archetype,shapeSeed,depth};
  }

  sidePoint(plan,u){
    // Legacy helper retained for parked v0.203.9.3 passage geometry only.
    const step=Math.max(0,Number(u)||0),tx=plan.mouthTx+plan.sign*step,ty=plan.mouthTy+this.sideOffsetTy(step);
    return{x:(tx+.5)*TILE,y:(ty+.5)*TILE,tx,ty};
  }

  pointSegmentDistanceSq(px,py,ax,ay,bx,by){
    const vx=bx-ax,vy=by-ay,wx=px-ax,wy=py-ay,len=vx*vx+vy*vy;
    const t=len>0?clamp((wx*vx+wy*vy)/len,0,1):0,dx=px-(ax+vx*t),dy=py-(ay+vy*t);
    return dx*dx+dy*dy;
  }

  sideNetworkGeometry(plan){
    if(!plan||Number(plan.generation||1)<SIDE_NETWORK_GENERATION)return null;
    const key=this.sidePlanKey(plan);if(this.sideGeometryCache.has(key))return this.sideGeometryCache.get(key);
    const generation=Number(plan.generation||1),sign=plan.sign<0?-1:1,seed=Number(plan.shapeSeed)||0,kind=Math.max(0,Math.min(3,Math.floor(Number(plan.archetype)||0)));
    const jitter=(salt,span=1)=>(hash2(seed%1000003,salt,this.seed+3251)-.5)*span;
    const roll=(salt)=>hash2(seed%1000003,salt,this.seed+3261);
    // Keep the passage stem the player already likes. Adventure geometry grows
    // from the old far room, so normal cave forks and simple passage mouths stay.
    const oldEnd=this.sidePoint(plan,plan.lengthTiles-3);
    const sx=oldEnd.tx,sy=oldEnd.ty;
    const nodes=[{x:sx,y:sy}],rooms=[],extra=[];

    if(generation<SIDE_VARIETY_GENERATION){
      // Exact v0.203.10/11 adventure layouts retained for compatibility.
      if(kind===0){
        const approach={x:sx+sign*10,y:sy-6-Math.floor(jitter(17,5))};
        const cavern={x:sx+sign*(25+Math.floor(hash2(seed,19,this.seed+3263)*8)),y:sy-17-Math.floor(hash2(seed,23,this.seed+3271)*9)};
        nodes.push(approach,cavern);
        rooms.push({x:cavern.x,y:cavern.y,rx:17+Math.floor(hash2(seed,29,this.seed+3277)*5),ry:12+Math.floor(hash2(seed,31,this.seed+3299)*5)});
        const subStart={x:cavern.x+sign*5,y:cavern.y+5};
        const subEnd={x:cavern.x+sign*(20+Math.floor(hash2(seed,37,this.seed+3301)*7)),y:cavern.y+13+Math.floor(jitter(41,8))};
        extra.push([subStart,subEnd]);rooms.push({x:subEnd.x,y:subEnd.y,rx:7+Math.floor(hash2(seed,43,this.seed+3307)*3),ry:5+Math.floor(hash2(seed,47,this.seed+3313)*3)});
      }else if(kind===1){
        const a={x:sx+sign*12,y:sy-5},b={x:sx+sign*31,y:sy-16},c={x:sx+sign*51,y:sy-29},d={x:sx+sign*72,y:sy-38};
        nodes.push(a,b,c,d);rooms.push({x:a.x,y:a.y,rx:6,ry:5},{x:b.x,y:b.y,rx:7,ry:6},{x:c.x,y:c.y,rx:6,ry:5},{x:d.x,y:d.y,rx:8,ry:6});
        const forkEnd={x:b.x+sign*(19+Math.floor(hash2(seed,53,this.seed+3323)*7)),y:b.y+15+Math.floor(jitter(59,7))};extra.push([b,forkEnd]);rooms.push({x:forkEnd.x,y:forkEnd.y,rx:6+Math.floor(hash2(seed,61,this.seed+3331)*3),ry:5});
      }else if(kind===2){
        const reconnectRow=sy-(46+Math.floor(hash2(seed,67,this.seed+3343)*18)),reconnectX=this.corridorCenter(reconnectRow);
        const a={x:sx+sign*12,y:sy-7},b={x:sx+sign*31,y:sy-19},c={x:sx+sign*37,y:reconnectRow+18},d={x:reconnectX+sign*13,y:reconnectRow+6},e={x:reconnectX,y:reconnectRow};
        nodes.push(a,b,c,d,e);rooms.push({x:b.x+sign*2,y:b.y-1,rx:11,ry:9},{x:c.x,y:c.y,rx:8,ry:6});const subEnd={x:b.x+sign*15,y:b.y+12};extra.push([b,subEnd]);rooms.push({x:subEnd.x,y:subEnd.y,rx:6,ry:5});
      }else{
        const hub={x:sx+sign*29,y:sy-17};nodes.push({x:sx+sign*12,y:sy-6},hub);rooms.push({x:hub.x,y:hub.y,rx:12,ry:9});
        const upper={x:hub.x+sign*(16+Math.floor(hash2(seed,73,this.seed+3371)*5)),y:hub.y-13},lower={x:hub.x+sign*(14+Math.floor(hash2(seed,79,this.seed+3389)*6)),y:hub.y+14};extra.push([hub,upper],[hub,lower]);rooms.push({x:upper.x,y:upper.y,rx:7,ry:6},{x:lower.x,y:lower.y,rx:7,ry:6});const nested={x:lower.x+sign*11,y:lower.y+9};extra.push([lower,nested]);rooms.push({x:nested.x,y:nested.y,rx:5,ry:5});
      }
    }else if(kind===0){
      // GRAND CAVERN variants: a remote, irregular multi-lobed cavern with one
      // or two smaller routes leaving it. Overlapping rooms create organic lobes.
      const lateral=42+Math.floor(roll(17)*26),vertical=22+Math.floor(roll(19)*20);
      const approach={x:sx+sign*(14+Math.floor(roll(23)*8)),y:sy-(7+Math.floor(roll(29)*8))};
      const cavern={x:sx+sign*lateral,y:sy-vertical};nodes.push(approach,cavern);
      const rx=19+Math.floor(roll(31)*9),ry=13+Math.floor(roll(37)*8);rooms.push({x:cavern.x,y:cavern.y,rx,ry});
      rooms.push({x:cavern.x-sign*(rx*.32),y:cavern.y-ry*.26,rx:Math.max(8,rx*.58),ry:Math.max(6,ry*.56)});
      if(roll(41)>.34)rooms.push({x:cavern.x+sign*(rx*.36),y:cavern.y+ry*.30,rx:Math.max(7,rx*.48),ry:Math.max(5,ry*.46)});
      const branches=1+(roll(43)>.52?1:0);for(let i=0;i<branches;i++){
        const dir=i?1:-1,end={x:cavern.x+sign*(18+Math.floor(roll(47+i*7)*16)),y:cavern.y+dir*(14+Math.floor(roll(53+i*7)*12))};extra.push([cavern,end]);rooms.push({x:end.x,y:end.y,rx:7+Math.floor(roll(59+i*7)*5),ry:5+Math.floor(roll(61+i*7)*4)});
      }
    }else if(kind===1){
      // ROOM NETWORK variants: 4–7 rooms zig-zag farther from the spine, with
      // at least one genuine sub-branch so the passage can have a passage.
      const count=4+Math.floor(roll(71)*3);let cursorX=0,cursorY=0;
      for(let i=0;i<count;i++){
        cursorX+=20+Math.floor(roll(73+i)*11);cursorY-=8+Math.floor(roll(109+i)*7);
        const zig=(i%2?1:-1)*(5+Math.floor(roll(121+i)*8));
        const x=sx+sign*cursorX,y=sy+cursorY+zig+Math.round(jitter(127+i,6));
        const pt={x,y};nodes.push(pt);rooms.push({x,y,rx:5+Math.floor(roll(149+i)*3),ry:4+Math.floor(roll(167+i)*3)});
      }
      const pivot=nodes[2+Math.floor(roll(181)*Math.max(1,nodes.length-2))],fork={x:pivot.x+sign*(27+Math.floor(roll(191)*15)),y:pivot.y+(roll(193)>.5?1:-1)*(19+Math.floor(roll(197)*15))};extra.push([pivot,fork]);rooms.push({x:fork.x,y:fork.y,rx:6+Math.floor(roll(199)*4),ry:5+Math.floor(roll(211)*3)});
      if(roll(223)>.5){const nested={x:fork.x-sign*(7+Math.floor(roll(227)*7)),y:fork.y+(roll(229)>.5?1:-1)*(12+Math.floor(roll(233)*9))};extra.push([fork,nested]);rooms.push({x:nested.x,y:nested.y,rx:5+Math.floor(roll(239)*4),ry:4+Math.floor(roll(241)*3)});}
    }else if(kind===2){
      // TRUE LOOP EXPEDITION: leave the main route by a large lateral distance,
      // spend 45–80 fathoms away from it, then reconnect substantially deeper.
      const span=92+Math.floor(roll(251)*64),reconnectRow=sy-span,reconnectX=this.corridorCenter(reconnectRow),far=58+Math.floor(roll(257)*36),variant=Math.floor(roll(263)*4);
      const a={x:sx+sign*(18+Math.floor(roll(269)*9)),y:sy-(10+Math.floor(roll(271)*8))};
      const b={x:sx+sign*far,y:sy-Math.round(span*.28)+(variant===1?12:0)};
      const c={x:sx+sign*(far+Math.floor(jitter(277,18))),y:sy-Math.round(span*.57)+(variant===2?-16:variant===3?14:0)};
      const d={x:reconnectX+sign*(34+Math.floor(roll(281)*20)),y:reconnectRow+Math.round(span*.22)};
      const e={x:reconnectX+sign*(13+Math.floor(roll(283)*8)),y:reconnectRow+8};
      const f={x:reconnectX,y:reconnectRow};nodes.push(a,b,c,d,e,f);
      rooms.push({x:b.x,y:b.y,rx:10+Math.floor(roll(293)*7),ry:8+Math.floor(roll(307)*6)},{x:c.x,y:c.y,rx:12+Math.floor(roll(311)*8),ry:9+Math.floor(roll(313)*7)});
      if(roll(317)>.35){const sub={x:c.x+sign*(20+Math.floor(roll(331)*15)),y:c.y+(roll(337)>.5?1:-1)*(15+Math.floor(roll(347)*12))};extra.push([c,sub]);rooms.push({x:sub.x,y:sub.y,rx:7+Math.floor(roll(349)*5),ry:5+Math.floor(roll(353)*4)});}
    }else{
      // BRANCHING EXPEDITION: remote hub with 2–4 spokes, room lobes and an
      // optional secondary hub. It is intentionally a rewarding-feeling dead end.
      const hub={x:sx+sign*(45+Math.floor(roll(359)*28)),y:sy-(22+Math.floor(roll(367)*20))};nodes.push({x:sx+sign*(18+Math.floor(roll(373)*8)),y:sy-8},hub);rooms.push({x:hub.x,y:hub.y,rx:13+Math.floor(roll(379)*7),ry:10+Math.floor(roll(383)*6)});
      const spokes=2+Math.floor(roll(389)*3);for(let i=0;i<spokes;i++){const dir=i%2?1:-1,end={x:hub.x+sign*(17+Math.floor(roll(397+i*11)*18)),y:hub.y+dir*(13+i*5+Math.floor(roll(401+i*11)*10))};extra.push([hub,end]);rooms.push({x:end.x,y:end.y,rx:6+Math.floor(roll(409+i*11)*6),ry:5+Math.floor(roll(419+i*11)*4)});if(i===spokes-1&&roll(431)>.42){const n={x:end.x+sign*(13+Math.floor(roll(433)*11)),y:end.y+dir*(9+Math.floor(roll(439)*8))};extra.push([end,n]);rooms.push({x:n.x,y:n.y,rx:5+Math.floor(roll(443)*4),ry:4+Math.floor(roll(449)*3)});}}
    }
    const geom=this.finalizeSideGeometry(plan,nodes,rooms,extra,['grand','rooms','loop','branching'][kind]||'side');
    this.sideGeometryCache.set(key,geom);return geom;
  }

  finalizeSideGeometry(plan,nodes,rooms,extraSegments=[],kind='side'){
    const segments=[];for(let i=1;i<nodes.length;i++)segments.push([nodes[i-1],nodes[i]]);for(const seg of extraSegments)segments.push(seg);
    let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;
    const pad=SIDE_NETWORK_ROUTE_HALF_WIDTH+2;
    for(const [a,b] of segments){minX=Math.min(minX,a.x,b.x)-pad;maxX=Math.max(maxX,a.x,b.x)+pad;minY=Math.min(minY,a.y,b.y)-pad;maxY=Math.max(maxY,a.y,b.y)+pad;}
    for(const r of rooms){minX=Math.min(minX,r.x-r.rx-2);maxX=Math.max(maxX,r.x+r.rx+2);minY=Math.min(minY,r.y-r.ry-2);maxY=Math.max(maxY,r.y+r.ry+2);}
    return{kind,segments,rooms,bounds:{minX,maxX,minY,maxY}};
  }

  legacySidePlanCarvesFloor(plan,tx,ty){
    const lo=Math.min(plan.centerTx,plan.mouthTx),hi=Math.max(plan.centerTx,plan.mouthTx);
    if(tx>=lo&&tx<=hi&&Math.abs(ty-plan.mouthTy)<=3)return true;
    const u=plan.sign*(tx-plan.mouthTx);
    if(u>=-1&&u<=plan.lengthTiles+1){
      const cy=plan.mouthTy+this.sideOffsetTy(Math.max(0,Math.round(u)));
      if(Math.abs(ty-cy)<=3)return true;
    }
    for(let i=1;i<=5;i++){
      const u0=5+i*8,p=this.sidePoint(plan,u0);
      if(Math.abs(tx-Math.round(p.tx))<=2&&Math.abs(ty-Math.round(p.ty))<=3)return true;
    }
    const end=this.sidePoint(plan,plan.lengthTiles-3);
    return Math.abs(tx-Math.round(end.tx))<=4&&Math.abs(ty-Math.round(end.ty))<=4;
  }

  sideEdgeNoise(plan,tx,ty,salt=0){
    const seed=(Number(plan?.shapeSeed)||0)+salt;
    const coarse=hash2(Math.floor(tx/2),Math.floor(ty/2),this.seed+seed+3401);
    const fine=hash2(tx,ty,this.seed+seed+3413);
    return coarse*.72+fine*.28;
  }

  organicSideStemCarvesFloor(plan,tx,ty){
    const lo=Math.min(plan.centerTx,plan.mouthTx),hi=Math.max(plan.centerTx,plan.mouthTx);
    if(tx>=lo&&tx<=hi){
      const d=Math.abs(ty-plan.mouthTy);if(d<=2)return true;
      if(d<=4&&this.sideEdgeNoise(plan,tx,ty,11)>.30)return true;
    }
    const u=plan.sign*(tx-plan.mouthTx);
    if(u>=-1&&u<=plan.lengthTiles+1){
      const cy=plan.mouthTy+this.sideOffsetTy(Math.max(0,Math.round(u))),d=Math.abs(ty-cy);
      if(d<=2)return true;
      if(d<=4&&this.sideEdgeNoise(plan,tx,ty,23)>.34)return true;
    }
    for(let i=1;i<=5;i++){
      const u0=5+i*8,p=this.sidePoint(plan,u0),dx=(tx-p.tx)/3.3,dy=(ty-p.ty)/4.0,d2=dx*dx+dy*dy;
      if(d2<=.70)return true;
      if(d2<=1.12&&this.sideEdgeNoise(plan,tx,ty,37+i)>.31)return true;
    }
    const end=this.sidePoint(plan,plan.lengthTiles-3),dx=(tx-end.tx)/5.0,dy=(ty-end.ty)/5.0,d2=dx*dx+dy*dy;
    return d2<=.72||(d2<=1.14&&this.sideEdgeNoise(plan,tx,ty,71)>.30);
  }

  organicSideRoomCarvesFloor(plan,r,tx,ty,index=0){
    const dx=(tx-r.x)/Math.max(1,r.rx),dy=(ty-r.y)/Math.max(1,r.ry),d2=dx*dx+dy*dy;
    if(d2<=.72)return true;
    if(d2>1.16)return false;
    const n=this.sideEdgeNoise(plan,tx,ty,101+index*17);
    // Inner annulus is mostly floor; the extreme lip is rougher. The .72 core
    // guarantees erosion can never cut connectivity through a room.
    const need=d2<.93?.22:.38+(d2-.93)*.85;
    return n>need;
  }

  organicSideSegmentCarvesFloor(plan,a,b,tx,ty,index=0){
    const d=Math.sqrt(this.pointSegmentDistanceSq(tx,ty,a.x,a.y,b.x,b.y));
    if(d<=SIDE_ORGANIC_CORE_ROUTE_HALF_WIDTH)return true;
    if(d>SIDE_NETWORK_ROUTE_HALF_WIDTH+1.15)return false;
    const n=this.sideEdgeNoise(plan,tx,ty,211+index*19);
    const edge=(d-SIDE_ORGANIC_CORE_ROUTE_HALF_WIDTH)/Math.max(.01,SIDE_NETWORK_ROUTE_HALF_WIDTH+1.15-SIDE_ORGANIC_CORE_ROUTE_HALF_WIDTH);
    return n>(.23+edge*.42);
  }

  sidePlanCarvesFloor(plan,tx,ty){
    if(!plan)return false;
    const generation=Number(plan.generation||1);
    // Saved v0.203.10 and older passages keep their exact geometry. Only newly
    // authored generation-3 passages receive the organic erosion pass.
    if(generation>=SIDE_ORGANIC_GENERATION){
      if(this.organicSideStemCarvesFloor(plan,tx,ty))return true;
    }else if(this.legacySidePlanCarvesFloor(plan,tx,ty))return true;
    if(generation<SIDE_NETWORK_GENERATION)return false;
    const g=this.sideNetworkGeometry(plan);if(!g)return false;
    if(tx<g.bounds.minX-2||tx>g.bounds.maxX+2||ty<g.bounds.minY-2||ty>g.bounds.maxY+2)return false;
    if(generation>=SIDE_ORGANIC_GENERATION){
      for(let i=0;i<g.rooms.length;i++)if(this.organicSideRoomCarvesFloor(plan,g.rooms[i],tx,ty,i))return true;
      for(let i=0;i<g.segments.length;i++){const [a,b]=g.segments[i];if(this.organicSideSegmentCarvesFloor(plan,a,b,tx,ty,i))return true;}
      return false;
    }
    for(const r of g.rooms){const dx=(tx-r.x)/r.rx,dy=(ty-r.y)/r.ry;if(dx*dx+dy*dy<=1)return true;}
    const radius=SIDE_NETWORK_ROUTE_HALF_WIDTH+.35,rr=radius*radius;
    for(const [a,b] of g.segments)if(this.pointSegmentDistanceSq(tx,ty,a.x,a.y,b.x,b.y)<=rr)return true;
    return false;
  }

  sideCarvesFloor(tx,ty){
    if(this.sidePlanCarvesFloor(this.activeSidePlan,tx,ty))return true;
    if(this.persistentSidePlans.some(plan=>this.sidePlanCarvesFloor(plan,tx,ty)))return true;
    // Ordinary side passages are real, open regions before discovery. The
    // descriptor is only a lightweight landmark/discovery hook.
    for(const event of this.worldEvents)if(event?.type==='sidepassage'&&this.sidePlanCarvesFloor(this.prospectiveSidePlan(event),tx,ty))return true;
    return false;
  }

  sideBarrierCollides(x,y,r){
    const plan=this.sidePlan();if(!plan)return false;
    const side=plan.side,done=Math.max(0,Number(side.encountersDefeated)||0);
    if(done>=plan.count||side.routeNodeActive)return false;
    // Passage progression may physically block the route, but never with hidden
    // collision. The collider is centered on the SAME side-stage entity that is
    // rendered and interacted with, so what stops the player is what they see.
    const p=this.sidePoint(plan,5+(done+1)*8);
    const halfW=TILE*.30,halfH=TILE*2.35;
    return Math.abs(x-p.x)<r+halfW&&Math.abs(y-p.y)<r+halfH;
  }

  sideEntities(){
    const plan=this.sidePlan();if(!plan)return[];
    const side=plan.side,out=[],done=Math.max(0,Number(side.encountersDefeated)||0);
    if(done<plan.count&&!side.routeNodeActive&&!this.combat){
      const p=this.sidePoint(plan,5+(done+1)*8);
      out.push({type:'side-stage',id:`side-stage:${side.id}:${done+1}`,stage:done+1,x:p.x,y:p.y});
    }
    if(done>=plan.count&&!side.chestOpened){
      const p=this.sidePoint(plan,plan.lengthTiles-3);
      out.push({type:'side-finale',id:`side-finale:${side.id}`,x:p.x,y:p.y});
    }
    return out;
  }

  playerInActiveSide(){
    const plan=this.sidePlan();if(!plan)return false;
    const u=plan.sign*(this.player.x/TILE-(plan.mouthTx+.5));
    if(u<-.45||u>plan.lengthTiles+3)return false;
    const p=this.sidePoint(plan,Math.max(0,u));
    return Math.abs(this.player.y-p.y)<=TILE*4.25;
  }

  makeTownPlan(town){
    if(!town)return null;
    const city=town.kind==='city',layoutW=(city?17:14)*TOWN_TILE,layoutH=(city?11:9.5)*TOWN_TILE;
    const depth=Math.max(0,Number(town.depth)||0),entryTy=Math.floor(yFromDepth(depth)/TILE),entryTx=this.corridorCenter(entryTy);
    const entryY=yFromDepth(depth),halfW=layoutW*.59,halfH=layoutH*.56;
    // New terrain can recess settlements into a cavern pocket in either wall.
    // Existing-save towns before the migration frontier retain their old layout.
    const pocket=entryTy<=this.varietyTopologyStartTy;
    const pocketSign=hash2(Math.floor(depth*10),509,this.seed+3613)>.5?1:-1;
    const routeHalf=pocket?ORGANIC_V2_MAIN_HALF_WIDTH:0;
    const offsetTiles=pocket?routeHalf+Math.ceil(halfW/TOWN_TILE)+7:0;
    const originX=(entryTx+.5)*TILE+pocketSign*offsetTiles*TOWN_TILE;
    const originY=entryY-layoutH*.34;
    const shallowGateY=originY+halfH,deepGateY=originY-halfH,gateY=deepGateY;
    const shallowJoinY=shallowGateY+TOWN_TILE*(6.5+(city?1:0)),deepJoinY=deepGateY-TOWN_TILE*(6.5+(city?1:0));
    const shallowJoinTy=Math.floor(shallowJoinY/TILE),deepJoinTy=Math.floor(deepJoinY/TILE);
    const shallowJoinX=(this.corridorCenter(shallowJoinTy)+.5)*TILE,deepJoinX=(this.corridorCenter(deepJoinTy)+.5)*TILE;
    // The approach turns to face each gate before crossing the wall, so a long
    // diagonal road can never clip the wall beside the actual opening.
    const shallowBendX=originX,shallowBendY=shallowGateY+TOWN_TILE*3.0;
    const deepBendX=originX,deepBendY=deepGateY-TOWN_TILE*3.0;
    const deepRoadEndY=deepJoinY;
    const wallSideW=Math.max(TOWN_TILE,halfW-TOWN_GATE_HALF_WIDTH);
    const wallSegs=[
      {id:'wall-left',x:originX-halfW,y:originY,w:TOWN_WALL_THICKNESS,h:halfH*2+TOWN_WALL_THICKNESS},
      {id:'wall-right',x:originX+halfW,y:originY,w:TOWN_WALL_THICKNESS,h:halfH*2+TOWN_WALL_THICKNESS},
      {id:'wall-shallow-left',x:originX-(TOWN_GATE_HALF_WIDTH+wallSideW/2),y:shallowGateY,w:wallSideW,h:TOWN_WALL_THICKNESS},
      {id:'wall-shallow-right',x:originX+(TOWN_GATE_HALF_WIDTH+wallSideW/2),y:shallowGateY,w:wallSideW,h:TOWN_WALL_THICKNESS},
      {id:'wall-deep-left',x:originX-(TOWN_GATE_HALF_WIDTH+wallSideW/2),y:deepGateY,w:wallSideW,h:TOWN_WALL_THICKNESS},
      {id:'wall-deep-right',x:originX+(TOWN_GATE_HALF_WIDTH+wallSideW/2),y:deepGateY,w:wallSideW,h:TOWN_WALL_THICKNESS}
    ];
    const pos={market:{x:originX+TOWN_TILE*2.10,y:originY+TOWN_TILE*1.55},inn:{x:originX-layoutW*.38,y:originY+layoutH*.22},herbalist:{x:originX+layoutW*.39,y:originY+layoutH*.08},guild:{x:originX-layoutW*.27,y:originY-layoutH*.36},'lower-gate':{x:originX,y:deepGateY+TOWN_TILE*1.35}};
    const buildings=[];
    const locations=(town.locations||[]).map((loc,i)=>{const p=pos[loc.id]||{x:originX+(i%2?1:-1)*layoutW*.35,y:originY+(i-2)*TOWN_TILE*1.6};if(TOWN_BUILDING_IDS.has(loc.id)){const w=(loc.id==='guild'?5.6:4.8)*TOWN_TILE,h=(loc.id==='guild'?4.1:3.6)*TOWN_TILE;buildings.push({id:loc.id,x:p.x,y:p.y-TOWN_TILE*.55,w,h});return {...loc,x:p.x,y:p.y+h/2+TOWN_TILE*.35};}return {...loc,x:p.x,y:p.y};});
    const stalls=[{x:originX-TOWN_TILE*2.7,y:originY+TOWN_TILE*.45,w:TOWN_TILE*2.0,h:TOWN_TILE*1.15},{x:originX+TOWN_TILE*.85,y:originY-TOWN_TILE*.15,w:TOWN_TILE*2.0,h:TOWN_TILE*1.15},{x:originX-TOWN_TILE*.7,y:originY+TOWN_TILE*2.2,w:TOWN_TILE*2.0,h:TOWN_TILE*1.05}];
    const signX=originX+TOWN_TILE*1.55,signY=shallowGateY+TOWN_TILE*1.65;
    const approachT=.34,approachSignX=shallowJoinX+(shallowBendX-shallowJoinX)*approachT+(pocketSign>0?-TOWN_TILE*1.4:TOWN_TILE*1.4),approachSignY=shallowJoinY+(shallowBendY-shallowJoinY)*approachT;
    return {...town,depth,placement:pocket?'pocket':'route',pocketSign,entryX:shallowJoinX,entryY,entryTx,entryTy,originX,originY,layoutW,layoutH,halfW,halfH,shallowGateY,deepGateY,gateY,deepRoadEndY,shallowJoinX,shallowJoinY,shallowBendX,shallowBendY,deepJoinX,deepJoinY,deepBendX,deepBendY,wallSegs,signX,signY,approachSignX,approachSignY,locations,buildings,stalls};
  }

  refreshTowns(){
    const towns=this.getTowns?.()||[];
    const sig=towns.map(t=>`${t.id}:${Number(t.depth)||0}:${t.current?1:0}:${t.departed?1:0}`).join('|');
    if(sig===this.townSignature){this.towns=towns;for(let i=0;i<this.townPlanCache.length;i++)if(towns[i])Object.assign(this.townPlanCache[i],{current:!!towns[i].current,departed:!!towns[i].departed,visited:!!towns[i].visited});return;}
    this.townSignature=sig;this.towns=towns;this.townPlanCache=towns.map(t=>this.makeTownPlan(t)).filter(Boolean);this.reachabilityCache.clear();this.wallCache.clear();this.minimapFloorCache.clear();this.minimapDirty=true;
  }

  townPlans(){return this.townPlanCache;}

  pointSegmentDistance(px,py,ax,ay,bx,by){
    const vx=bx-ax,vy=by-ay,wx=px-ax,wy=py-ay,len2=vx*vx+vy*vy;
    const t=len2>0?clamp((wx*vx+wy*vy)/len2,0,1):0;
    return Math.hypot(px-(ax+vx*t),py-(ay+vy*t));
  }

  townCarvesFloor(tx,ty){
    const x=(tx+.5)*TOWN_TILE,y=(ty+.5)*TOWN_TILE;
    for(const t of this.townPlans()){
      // The fortified footprint stays readable, while the surrounding cave
      // pocket uses a rounded margin instead of a giant square cutout.
      if(Math.abs(x-t.originX)<=t.halfW+TOWN_TILE*.8&&Math.abs(y-t.originY)<=t.halfH+TOWN_TILE*.8)return true;
      if(this.pointSegmentDistance(x,y,t.shallowJoinX,t.shallowJoinY,t.shallowBendX,t.shallowBendY)<=TOWN_TILE*3.15)return true;
      if(this.pointSegmentDistance(x,y,t.shallowBendX,t.shallowBendY,t.originX,t.shallowGateY)<=TOWN_TILE*3.15)return true;
      if(this.pointSegmentDistance(x,y,t.originX,t.deepGateY,t.deepBendX,t.deepBendY)<=TOWN_TILE*3.15)return true;
      if(this.pointSegmentDistance(x,y,t.deepBendX,t.deepBendY,t.deepJoinX,t.deepJoinY)<=TOWN_TILE*3.15)return true;
      for(const b of t.buildings)if(Math.abs(x-b.x)<=b.w/2+TOWN_TILE*1.55&&Math.abs(y-b.y)<=b.h/2+TOWN_TILE*1.55)return true;
    }
    return false;
  }

  townSafeZone(tx,ty){
    const x=(tx+.5)*TOWN_TILE,y=(ty+.5)*TOWN_TILE;
    return this.townPlans().some(t=>Math.abs(x-t.originX)<=t.halfW+TOWN_TILE*1.5&&Math.abs(y-t.originY)<=t.halfH+TOWN_TILE*1.5);
  }

  townEnemyExclusionAtTile(tx,ty){
    const x=(tx+.5)*TILE,y=(ty+.5)*TILE,limit=TOWN_ENEMY_EXCLUSION_TILES*TILE;
    return this.townPlans().some(t=>{
      const dx=Math.max(0,Math.abs(x-t.originX)-t.halfW),dy=Math.max(0,Math.abs(y-t.originY)-t.halfH);
      return Math.hypot(dx,dy)<=limit;
    });
  }

  townRectHit(x,y,r,rect){return x+r>rect.x-rect.w/2&&x-r<rect.x+rect.w/2&&y+r>rect.y-rect.h/2&&y-r<rect.y+rect.h/2;}

  updateTownDepartureSeals(){
    for(const t of this.townPlans())if(t.departed&&this.player.y<t.deepGateY-TOWN_TILE*.70)this.sealedTownGates.add(t.id);
  }

  townObstacleCollides(x,y,r){
    for(const t of this.townPlans()){
      if(Math.abs(y-t.originY)>t.halfH+TOWN_TILE*6)continue;
      if(t.buildings.some(b=>this.townRectHit(x,y,r,b)))return true;
      if(t.stalls.some(b=>this.townRectHit(x,y,r,b)))return true;
      if(t.wallSegs.some(b=>this.townRectHit(x,y,r,b)))return true;
      const atDeepGate=Math.abs(y-t.deepGateY)<r+TOWN_TILE*.24&&Math.abs(x-t.originX)<TOWN_GATE_HALF_WIDTH+r;
      // The lower/deeper gate is the only progression gate. It is visible and
      // aligned with this exact collider. The shallow entrance is always open.
      if(!t.departed&&atDeepGate)return true;
      if(t.departed&&this.sealedTownGates.has(t.id)&&atDeepGate)return true;
    }
    return false;
  }

  townEntities(ptx,pty,rx,ry){
    const out=[];
    for(const t of this.townPlans()){
      const stx=Math.floor(t.signX/TILE),sty=Math.floor(t.signY/TILE);
      if(Math.abs(stx-ptx)<=rx+4&&Math.abs(sty-pty)<=ry+4)out.push({type:'signpost',id:`sign:${t.id}:gate`,x:t.signX,y:t.signY,town:t,signKind:'gate'});
      const atx=Math.floor(t.approachSignX/TILE),aty=Math.floor(t.approachSignY/TILE);
      if(Math.abs(atx-ptx)<=rx+4&&Math.abs(aty-pty)<=ry+4)out.push({type:'signpost',id:`sign:${t.id}:approach`,x:t.approachSignX,y:t.approachSignY,town:t,signKind:'approach'});
      if(t.current){
        for(const loc of t.locations){
          const tx=Math.floor(loc.x/TILE),ty=Math.floor(loc.y/TILE);
          if(Math.abs(tx-ptx)<=rx+5&&Math.abs(ty-pty)<=ry+5)out.push({type:'townlocation',id:`town:${t.id}:${loc.id}`,x:loc.x,y:loc.y,location:loc,town:t});
        }
      }
    }
    return out;
  }

  // Live movement safety must be cheap. A position is walkable when the player's
  // collision circle is on floor and not inside a physical obstacle. Connectivity
  // is a SPAWN/RESTORE concern only; running a flood-search every animation frame
  // can lock the browser at dead ends and then lock it again on reload.
  pointIsWalkable(x,y,r=this.player.r,{reachable=false,predicate=null}={}){
    if(!Number.isFinite(Number(x))||!Number.isFinite(Number(y)))return false;
    x=Number(x);y=Number(y);
    if(predicate&&!predicate(x,y))return false;
    if(this.collides(x,y,r))return false;
    if(!reachable)return true;
    return this.isSpawnAccessible(Math.floor(x/TILE),Math.floor(y/TILE));
  }

  findNearestSafePosition(x,y,{r=this.player.r,maxRings=24,predicate=null,reachable=false}={}){
    x=Number(x);y=Number(y);
    const ok=(px,py)=>this.pointIsWalkable(px,py,r,{reachable,predicate});
    if(Number.isFinite(x)&&Number.isFinite(y)&&ok(x,y))return{x,y};
    const tx0=Math.floor((Number.isFinite(x)?x:0)/TILE),ty0=Math.floor((Number.isFinite(y)?y:0)/TILE);
    const center=(tx,ty)=>({x:(tx+.5)*TILE,y:(ty+.5)*TILE});
    const c0=center(tx0,ty0);if(ok(c0.x,c0.y))return c0;
    for(let ring=1;ring<=maxRings;ring++){
      for(let ix=-ring;ix<=ring;ix++)for(const iy of [-ring,ring]){const c=center(tx0+ix,ty0+iy);if(ok(c.x,c.y))return c;}
      for(let iy=-ring+1;iy<=ring-1;iy++)for(const ix of [-ring,ring]){const c=center(tx0+ix,ty0+iy);if(ok(c.x,c.y))return c;}
    }
    return null;
  }

  setPlayerPositionSafe(x,y,{deepestY=null,allowLastSafe=true,predicate=null,reachable=false,maxRings=24}={}){
    let safe=this.findNearestSafePosition(x,y,{predicate,reachable,maxRings});
    if(!safe&&allowLastSafe&&this.lastSafePosition&&this.pointIsWalkable(this.lastSafePosition.x,this.lastSafePosition.y,this.player.r,{reachable,predicate}))safe={x:this.lastSafePosition.x,y:this.lastSafePosition.y};
    if(!safe)return false;
    this.player.x=safe.x;this.player.y=safe.y;
    const d=Number.isFinite(Number(deepestY))?Number(deepestY):safe.y;
    this.player.deepestY=Math.min(d,safe.y);
    this.rememberSafePosition();
    return true;
  }

  rememberSafePosition(){
    // No graph search here. If the player got here through collision-safe walking,
    // the position is already connected to where they came from.
    if(this.pointIsWalkable(this.player.x,this.player.y,this.player.r,{reachable:false}))this.lastSafePosition={x:this.player.x,y:this.player.y,deepestY:this.player.deepestY};
  }

  ensurePlayerSafe(){
    // This runs every frame, so it intentionally checks collision only.
    if(this.pointIsWalkable(this.player.x,this.player.y,this.player.r,{reachable:false})){this.rememberSafePosition();return false;}
    const old={x:this.player.x,y:this.player.y};
    if(this.lastSafePosition&&this.pointIsWalkable(this.lastSafePosition.x,this.lastSafePosition.y,this.player.r,{reachable:false})){
      this.player.x=this.lastSafePosition.x;this.player.y=this.lastSafePosition.y;this.player.deepestY=this.lastSafePosition.deepestY;this.camera.x=this.player.x;this.camera.y=this.player.y-40;this.onToast?.('Recovered to the last safe cavern position.');return true;
    }
    const safe=this.findNearestSafePosition(old.x,old.y,{reachable:false,maxRings:12});
    if(safe){this.player.x=safe.x;this.player.y=safe.y;this.player.deepestY=Math.min(this.player.deepestY,safe.y);this.rememberSafePosition();this.camera.x=safe.x;this.camera.y=safe.y-40;this.onToast?.('Recovered to nearby walkable ground.');return true;}
    return false;
  }

  recoverToDepth(depth){
    const y=yFromDepth(Math.max(0,Number(depth)||0)),ty=Math.floor(y/TILE),x=(this.corridorCenter(ty)+.5)*TILE;
    const ok=this.setPlayerPositionSafe(x,y,{deepestY:y,allowLastSafe:false,reachable:false,maxRings:18});
    if(ok){this.camera.x=this.player.x;this.camera.y=this.player.y-40;}
    return ok;
  }

  setZoom(value=1.15){
    const next=Math.max(1,Math.min(1.5,Number(value)||1.15));
    this.zoom=next;
    return this.zoom;
  }

  logicalViewW(){return Math.max(1,(this.viewW||1)/(this.zoom||1));}
  logicalViewH(){return Math.max(1,(this.viewH||1)/(this.zoom||1));}

  resize(){
    const r=this.canvas.getBoundingClientRect();
    const dpr=Math.min(2,window.devicePixelRatio||1);
    this.dpr=dpr;
    this.canvas.width=Math.max(1,Math.floor(r.width*dpr));
    this.canvas.height=Math.max(1,Math.floor(r.height*dpr));
    this.ctx.setTransform(dpr,0,0,dpr,0,0);
    this.viewW=r.width;
    this.viewH=r.height;
    this.ctx.imageSmoothingEnabled=false;
    this.minimapDirty=true;
  }

  entityRadii(){
    const rx=Math.max(8,Math.ceil(this.logicalViewW()/(TILE*2))+BASE_ENTITY_MARGIN_TILES);
    const ry=Math.max(8,Math.ceil(this.logicalViewH()/(TILE*2))+BASE_ENTITY_MARGIN_TILES);
    return{rx,ry};
  }

  getFoeSprite(id){
    const key=id||'cutter';
    let rec=this.foeSprites.get(key);
    if(rec)return rec.ready?rec.img:null;
    const file=FOE_SPRITE_FILES[key]||FOE_SPRITE_FILES.cutter;
    const candidates=FOE_SPRITE_DIRS.map(d=>d+file);
    const img=new Image();
    rec={img,ready:false,index:0};
    this.foeSprites.set(key,rec);
    const next=()=>{if(rec.index<candidates.length)img.src=candidates[rec.index++];};
    img.onload=()=>rec.ready=true;
    img.onerror=()=>{rec.ready=false;next();};
    next();
    return null;
  }

  setMinimapOpen(open){
    this.minimapOpen=!!open;
    if(this.minimapPanel)this.minimapPanel.hidden=!this.minimapOpen;
    if(this.minimapToggle){
      this.minimapToggle.setAttribute('aria-expanded',String(this.minimapOpen));
      this.minimapToggle.textContent=this.minimapOpen?'Map ▾':'Map ▸';
    }
    this.minimapDirty=true;this.minimapLastDraw=-999;
    if(this.minimapOpen&&this.opened)this.drawMinimap(true);
  }

  updateMinimapZoomControls(){if(this.minimapZoomOut)this.minimapZoomOut.disabled=this.minimapZoomIndex<=0;if(this.minimapZoomIn)this.minimapZoomIn.disabled=this.minimapZoomIndex>=MINIMAP_ZOOM_LEVELS.length-1;}
  setMinimapZoom(index,{notify=true}={}){
    const next=clamp(Math.round(Number(index)||0),0,MINIMAP_ZOOM_LEVELS.length-1);if(next===this.minimapZoomIndex){this.updateMinimapZoomControls();return next;}
    this.minimapZoomIndex=next;this.updateMinimapZoomControls();this.minimapDirty=true;this.minimapLastDraw=-999;if(this.minimapOpen&&this.opened)this.drawMinimap(true);if(notify)this.onMinimapZoom?.(next);return next;
  }
  refreshMinimap(){this.minimapDirty=true;this.minimapLastDraw=-999;if(this.minimapOpen&&this.opened)this.drawMinimap(true);}

  explorationCell(tx,ty){return{cx:Math.floor(tx/MINIMAP_CELL_TILES),cy:Math.floor(ty/MINIMAP_CELL_TILES)};}
  explorationKey(cx,cy){return `${cx},${cy}`;}
  isExploredTile(tx,ty){const c=this.explorationCell(tx,ty);return this.exploredCells.has(this.explorationKey(c.cx,c.cy));}
  minimapCellHasFloor(cx,cy){
    const key=this.explorationKey(cx,cy);
    if(this.minimapFloorCache.has(key))return this.minimapFloorCache.get(key);
    const baseTx=cx*MINIMAP_CELL_TILES,baseTy=cy*MINIMAP_CELL_TILES;
    let floor=false;
    for(let yy=0;yy<MINIMAP_CELL_TILES&&!floor;yy++)for(let xx=0;xx<MINIMAP_CELL_TILES;xx++)if(!this.isWall(baseTx+xx,baseTy+yy)){floor=true;break;}
    this.minimapFloorCache.set(key,floor);
    return floor;
  }
  revealAroundPlayer(force=false){
    const tx=Math.floor(this.player.x/TILE),ty=Math.floor(this.player.y/TILE),anchor=this.explorationCell(tx,ty),key=this.explorationKey(anchor.cx,anchor.cy);
    if(!force&&key===this.explorationAnchor)return false;
    this.explorationAnchor=key;
    const cellRadius=Math.ceil(MINIMAP_REVEAL_RADIUS_TILES/MINIMAP_CELL_TILES);
    for(let cy=anchor.cy-cellRadius;cy<=anchor.cy+cellRadius;cy++)for(let cx=anchor.cx-cellRadius;cx<=anchor.cx+cellRadius;cx++){
      const wx=(cx+.5)*MINIMAP_CELL_TILES,wy=(cy+.5)*MINIMAP_CELL_TILES;
      if(Math.hypot(wx-(tx+.5),wy-(ty+.5))<=MINIMAP_REVEAL_RADIUS_TILES+1)this.exploredCells.add(this.explorationKey(cx,cy));
    }
    this.minimapDirty=true;
    return true;
  }

  minimapMarker(tx,ty,label,kind,ctx,originCx,originCy,cellPx){
    if(!this.isExploredTile(tx,ty))return;
    const cell=this.explorationCell(tx,ty),x=(cell.cx-originCx+.5)*cellPx,y=(cell.cy-originCy+.5)*cellPx;
    const palette={town:'#d7b563',hollow:'#6f8fd4',side:'#b48a5a',caravan:'#b87b4b',merchant:'#81a67a',boss:'#c45f55',sign:'#c9a96b',quest:'#9d83bd'};
    ctx.fillStyle='rgba(2,5,7,.82)';ctx.fillRect(Math.round(x-4),Math.round(y-4),8,8);
    ctx.strokeStyle=palette[kind]||'#bbb';ctx.strokeRect(Math.round(x-4)+.5,Math.round(y-4)+.5,7,7);
    ctx.fillStyle=palette[kind]||'#ddd';ctx.font='bold 7px monospace';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(label,Math.round(x),Math.round(y+.3));
  }

  drawMinimap(force=false){
    const canvas=this.minimapCanvas,ctx=this.minimapCtx;if(!this.minimapOpen||!canvas||!ctx)return;
    // The map is discovery-driven, not an animation. Redraw only when discovery,
    // landmarks, resize, or the player's minimap cell actually changes.
    if(!force&&!this.minimapDirty)return;
    this.minimapDirty=false;this.minimapLastDraw=this.time;
    const cssW=Math.max(120,canvas.clientWidth||190),cssH=Math.max(90,canvas.clientHeight||138),dpr=Math.max(1,Math.min(2,window.devicePixelRatio||1));
    const needW=Math.round(cssW*dpr),needH=Math.round(cssH*dpr);if(canvas.width!==needW||canvas.height!==needH){canvas.width=needW;canvas.height=needH;ctx.imageSmoothingEnabled=false;}
    ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,cssW,cssH);ctx.fillStyle='rgba(3,7,9,.94)';ctx.fillRect(0,0,cssW,cssH);
    const ptx=Math.floor(this.player.x/TILE),pty=Math.floor(this.player.y/TILE),pc=this.explorationCell(ptx,pty),zoom=MINIMAP_ZOOM_LEVELS[this.minimapZoomIndex]||MINIMAP_ZOOM_LEVELS[2],radiusX=zoom.x,radiusY=zoom.y;
    const cellsX=radiusX*2+1,cellsY=radiusY*2+1,cellPx=Math.max(2,Math.min(cssW/cellsX,cssH/cellsY));
    const originCx=pc.cx-radiusX,originCy=pc.cy-radiusY;
    const drawW=cellsX*cellPx,drawH=cellsY*cellPx,ox=(cssW-drawW)/2,oy=(cssH-drawH)/2;
    ctx.save();ctx.translate(ox,oy);
    for(let cy=originCy;cy<originCy+cellsY;cy++)for(let cx=originCx;cx<originCx+cellsX;cx++){
      const key=this.explorationKey(cx,cy);if(!this.exploredCells.has(key))continue;
      const floor=this.minimapCellHasFloor(cx,cy);
      ctx.fillStyle=floor?'#202b2d':'#0c1114';ctx.fillRect((cx-originCx)*cellPx,(cy-originCy)*cellPx,Math.ceil(cellPx),Math.ceil(cellPx));
    }
    for(const t of this.townPlans()){
      const tx=Math.floor(t.originX/TILE),ty=Math.floor(t.originY/TILE);this.minimapMarker(tx,ty,'T','town',ctx,originCx,originCy,cellPx);
      const sx=Math.floor(t.approachSignX/TILE),sy=Math.floor(t.approachSignY/TILE);this.minimapMarker(sx,sy,'!','sign',ctx,originCx,originCy,cellPx);
    }
    const rangeX=radiusX*MINIMAP_CELL_TILES,rangeY=radiusY*MINIMAP_CELL_TILES;
    // Hollows remain useful landmarks after use, so map their authored cadence
    // independently of whether the interaction has already been consumed.
    const mapDepthLo=Math.max(0,depthFromY((pty+rangeY)*TILE)),mapDepthHi=depthFromY((pty-rangeY)*TILE);
    const hk0=Math.max(0,Math.floor((mapDepthLo-ORDINARY_HOLLOW_FIRST)/ORDINARY_HOLLOW_GAP)-1),hk1=Math.ceil((mapDepthHi-ORDINARY_HOLLOW_FIRST)/ORDINARY_HOLLOW_GAP)+1;
    for(let k=hk0;k<=hk1;k++){const d=ORDINARY_HOLLOW_FIRST+k*ORDINARY_HOLLOW_GAP;if(d<0)continue;const h=this.hollowTile(d);this.minimapMarker(h.tx,h.ty,'H','hollow',ctx,originCx,originCy,cellPx);}
    // Side entrances stay on the map after their temporary event descriptor is
    // gone because the physical branch itself persists.
    const sidePlans=[...(this.persistentSidePlans||[]),...(this.activeSidePlan?[this.activeSidePlan]:[])];
    for(const plan of sidePlans)this.minimapMarker(plan.mouthTx,plan.mouthTy,'S','side',ctx,originCx,originCy,cellPx);
    for(const event of this.worldEvents){
      if(!event?.id)continue;const p=this.eventTile(event);
      if(Math.abs(p.tx-ptx)>rangeX+8||Math.abs(p.ty-pty)>rangeY+8)continue;
      if(event.type==='sidepassage')this.minimapMarker(p.tx,p.ty,'S','side',ctx,originCx,originCy,cellPx);
      else if(event.type==='caravan')this.minimapMarker(p.tx,p.ty,'C','caravan',ctx,originCx,originCy,cellPx);
      else if(event.type==='merchant')this.minimapMarker(p.tx,p.ty,'M','merchant',ctx,originCx,originCy,cellPx);
      else if(event.type==='midboss'||event.type==='boss')this.minimapMarker(p.tx,p.ty,'B','boss',ctx,originCx,originCy,cellPx);
      else if(event.type==='quest-target')this.minimapMarker(p.tx,p.ty,'Q','quest',ctx,originCx,originCy,cellPx);
      else if(event.type==='rescue-tracks'||event.type==='rescue-satchel'||event.type==='rescue-hideout'||event.type==='escort-pursuit')this.minimapMarker(p.tx,p.ty,'R','quest',ctx,originCx,originCy,cellPx);
    }
    const px=(pc.cx-originCx+.5)*cellPx,py=(pc.cy-originCy+.5)*cellPx;ctx.fillStyle='#e6d9aa';ctx.fillRect(Math.round(px-2),Math.round(py-2),5,5);
    ctx.restore();ctx.strokeStyle='rgba(153,128,79,.55)';ctx.strokeRect(.5,.5,cssW-1,cssH-1);
  }

  start(){this.last=performance.now();requestAnimationFrame(t=>this.loop(t));}
  setInputEnabled(v){this.inputEnabled=!!v;if(!v){this.joy.x=this.joy.y=0;this.player.moving=false;}}
  setCombat(v){this.combat=!!v;if(!this.combat){this.combatFoe=null;this.combatEntityId=null;this.combatPlayerRange=10;this.combatPlayerMelee=true;this.combatPlayerInRange=false;this.combatEnemyThreatRange=10;this.combatThreatActive=false;this.playerReachGuideVisible=false;this.autoApproach=false;}}
  setAutoApproach(v=true){this.autoApproach=!!v;}
  setJoystick(x,y){this.joy.x=clamp(x,-1,1);this.joy.y=clamp(y,-1,1);if(Math.hypot(this.joy.x,this.joy.y)>.08)this.autoApproach=false;}
  keyDown(code){this.keys.add(code);if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','KeyW','KeyA','KeyS','KeyD'].includes(code))this.autoApproach=false;}
  keyUp(code){this.keys.delete(code);}

  loop(t){
    const dt=Math.min(.04,Math.max(0,(t-this.last)/1000));
    this.last=t;
    this.time+=dt;
    // Never allow a gameplay callback exception to permanently kill the Canvas
    // animation chain. Update and rendering are guarded separately so the last
    // valid world state can still paint while the underlying error is reported.
    try{
      this.update(dt);
    }catch(err){
      console.error('World update frame failed',err);
    }
    try{
      this.draw();
      this.drawMinimap();
    }catch(err){
      console.error('World render frame failed',err);
    }finally{
      requestAnimationFrame(n=>this.loop(n));
    }
  }

  movementVector(){
    let x=this.joy.x,y=this.joy.y;
    if(this.keys.has('ArrowUp')||this.keys.has('KeyW'))y-=1;
    if(this.keys.has('ArrowDown')||this.keys.has('KeyS'))y+=1;
    if(this.keys.has('ArrowLeft')||this.keys.has('KeyA'))x-=1;
    if(this.keys.has('ArrowRight')||this.keys.has('KeyD'))x+=1;
    const len=Math.hypot(x,y);
    if(len>1){x/=len;y/=len;}
    return{x,y};
  }

  refreshWorldEvents(){
    const next=(this.getWorldEvents()||[]).filter(Boolean);
    const sig=next.map(e=>`${e.type}:${e.id}:${Number(e.depth||0).toFixed(2)}`).sort().join('|');
    if(sig!==this.worldEventSignature){
      this.worldEventSignature=sig;
      this.worldEvents=next;
      // Terrain is not allowed to disappear because an authored event resolves.
      // Only true carved locations need persistence; road traffic is placed on
      // already-walkable network floor and never owns terrain.
      for(const event of next){
        if(!event?.id)continue;
        if(event.type==='rescue-hideout'){
          const p=this.eventTile(event);
          if(!this.persistentEventSites.some(v=>v.id===String(event.id))){
            this.persistentEventSites.push({id:String(event.id),type:'rescue-hideout',tx:p.tx,ty:p.ty,center:p.center,sign:p.sign});
          }
        }else if(event.type==='sidepassage'){
          // Ordinary side passages are permanent geography, not temporary event
          // terrain. Persist the plan as soon as it is authored so walking past
          // it, fighting nearby, or advancing to another cadence band can never
          // make the branch close behind the player.
          this.rememberSidePlan(this.prospectiveSidePlan(event));
        }
      }
      const liveBossIds=new Set(next.filter(e=>e&&['midboss','boss'].includes(e.type)).map(e=>`worldevent:${e.id}`));
      for(const id of this.bossActors.keys())if(!liveBossIds.has(id))this.bossActors.delete(id);
      this.reachabilityCache.clear();this.wallCache.clear();this.minimapFloorCache.clear();this.minimapDirty=true;
    }else this.worldEvents=next;
  }

  update(dt){
    this.refreshWorldEvents();this.refreshTowns();this.refreshSidePlan();
    this.ensurePlayerSafe();
    if(this.inputEnabled){
      const m=this.movementVector();
      const wantsMove=Math.hypot(m.x,m.y)>.08;
      this.player.moving=false;
      if(wantsMove){
        this.autoApproach=false;
        if(Math.abs(m.y)>=Math.abs(m.x))this.player.dir=m.y<0?'up':'down';
        else this.player.dir=m.x<0?'left':'right';
        // Only count real displacement as movement. Holding the stick/key into a
        // wall must not advance travel timers or schedule world events.
        this.player.moving=this.movePlayer(m.x*this.player.speed*dt,m.y*this.player.speed*dt);
      }else if(this.autoApproach&&this.combatFoe&&!this.combatFoe.combatEvading){
        const gap=this.combatSurfaceGap(this.combatFoe),stop=Math.max(0,Number(this.combatPlayerRange)||0)-.75;
        if(gap>stop){
          const dx=this.combatFoe.x-this.player.x,dy=this.combatFoe.y-this.player.y,len=Math.hypot(dx,dy)||1,step=Math.min(this.player.speed*dt,Math.max(0,gap-stop));
          if(step>.01){if(Math.abs(dy)>=Math.abs(dx))this.player.dir=dy<0?'up':'down';else this.player.dir=dx<0?'left':'right';this.player.moving=this.movePlayer(dx/len*step,dy/len*step);}
        }else this.autoApproach=false;
      }
    }else this.player.moving=false;
    this.revealAroundPlayer();

    this.updateAutomaticTransitions();
    this.updateLocationTitleTrigger();
    this.retirePassedRoadEvents();

    const follow=1-Math.pow(.001,dt);
    this.camera.x+=(this.player.x-this.camera.x)*follow;
    this.camera.y+=(this.player.y-40-this.camera.y)*follow;
    this.activeEntities=this.dynamicEntities();
    if(this.inputEnabled){this.updateRoamers(dt,this.activeEntities);this.updateBossActors(dt,this.activeEntities);}
    this.updateNearby(this.activeEntities);
    this.updateCompanion(dt);
    this.updateAnimations(dt);
    this.updateParticles(dt);
    this.rememberSafePosition();
    this.onDepth?.(depthFromY(this.player.deepestY),depthFromY(this.player.y),this.player.moving,dt*1000,false,this.playerInActiveSide());
  }

  updateLocationTitleTrigger(){
    let nearbyTown=null;
    for(const t of this.townPlans()){
      const dx=Math.max(0,Math.abs(this.player.x-t.originX)-t.halfW);
      const dy=Math.max(0,Math.abs(this.player.y-t.originY)-t.halfH);
      if(Math.hypot(dx,dy)<=TOWN_TITLE_RADIUS){nearbyTown=t;break;}
    }
    const zone=nearbyTown?String(nearbyTown.id):'';
    if(zone===this.locationTitleZone)return;
    this.locationTitleZone=zone;
    if(nearbyTown)this.onLocationTitle?.(nearbyTown);
  }

  updateAutomaticTransitions(){
    if(this.hasActiveThreats()||!this.inputEnabled)return;
    const current=this.townPlans().find(t=>t.current)||null;
    if(current){
      // Walking back out through the shallow gate simply leaves the settlement
      // context. It is not a teleport and does not mark the town permanently
      // departed; walking back through the gate activates it again.
      if(this.player.y>current.shallowGateY+TILE*.85&&Math.abs(this.player.x-current.originX)<=TOWN_GATE_HALF_WIDTH+TILE){
        const key=`leave-town:${current.id}`;
        if(this.transitionLock!==key){
          this.transitionLock=key;
          this.onSettlementLeave?.(current);
        }
        return;
      }
    }else{
      for(const t of this.townPlans()){
        if(t.departed)continue;
        const crossedShallow=this.player.y< t.shallowGateY-TILE*.35 && this.player.y>t.deepGateY-TILE*.5;
        const aligned=Math.abs(this.player.x-t.originX)<=TOWN_GATE_HALF_WIDTH+TILE*.65;
        if(crossedShallow&&aligned){
          const key=`enter-town:${t.id}`;
          if(this.transitionLock!==key){
            this.transitionLock=key;
            this.visitedSettlements.add(t.id);
            this.onSettlementEnter?.(t);
          }
          return;
        }
      }
    }

    const side=this.sidePlan();
    if(side){
      const u=side.sign*(this.player.x/TILE-(side.mouthTx+.5));
      if(u>3)this.sideWasInside=true;
      if(this.sideWasInside&&u<.65){
        const key=`leave-side:${side.id}`;
        if(this.transitionLock!==key){
          this.transitionLock=key;
          this.sideWasInside=false;
          this.onLeaveSide?.(!!side.side?.chestOpened);
        }
        return;
      }
      this.transitionLock='';
      return;
    }
    for(const event of this.worldEvents){
      if(event?.type!=='sidepassage'||!event.id)continue;
      const plan=this.prospectiveSidePlan(event);
      const u=plan.sign*(this.player.x/TILE-(plan.mouthTx+.5));
      if(u<2.2||u>9)continue;
      const point=this.sidePoint(plan,u);
      if(Math.abs(this.player.y-point.y)>TILE*3.2)continue;
      const key=`enter-side:${event.id}`;
      if(this.transitionLock!==key){
        this.transitionLock=key;
        // Crossing into the already-open excursion only records discovery. The
        // Side Network remains ordinary world geometry and never becomes a mode.
        this.rememberSidePlan(plan);
        this.onEnterSide?.(event);
      }
      return;
    }
    this.transitionLock='';
  }

  retirePassedRoadEvents(){
    if(this.hasActiveThreats()||!this.inputEnabled||!this.viewH)return;
    const farHalfH=this.viewH/2+ROAD_EVENT_FAR_MARGIN_TILES*TILE;
    for(const event of this.worldEvents){
      if(!event?.id||!['caravan','merchant'].includes(event.type))continue;
      const key=`${event.type}:${event.id}`;
      if(this.passedWorldEvents.has(key))continue;
      const p=this.eventTile(event),eventY=(p.ty+.5)*TILE;
      // "Passed" means the player is physically deeper than the road event and
      // the event would be below the viewport even at maximum zoom-out (1.0).
      if(eventY-this.player.y<=farHalfH)continue;
      this.passedWorldEvents.add(key);
      this.onPassWorldEvent?.(event);
    }
  }

  movePlayer(dx,dy){
    const startX=this.player.x,startY=this.player.y;
    const r=this.player.r,maxStep=Math.max(1,Math.min(TILE*.22,r*.70)),steps=Math.max(1,Math.ceil(Math.max(Math.abs(dx),Math.abs(dy))/maxStep));
    const sx=dx/steps,sy=dy/steps;
    for(let i=0;i<steps;i++){
      const nx=this.player.x+sx;
      if(!this.collides(nx,this.player.y,r)&&!this.combatActorCollides(nx,this.player.y,r))this.player.x=nx;
      // Active World is a real navigable space, not the old one-way travel bar.
      // Never clamp the player to an invisible distance behind their deepest point.
      // Backtracking is limited only by visible physical collision/terrain.
      const ny=this.player.y+sy;
      if(!this.collides(this.player.x,ny,r)&&!this.combatActorCollides(this.player.x,ny,r))this.player.y=ny;
      if(this.player.y<this.player.deepestY)this.player.deepestY=this.player.y;
    }
    this.updateTownDepartureSeals();
    this.rememberSafePosition();
    return Math.hypot(this.player.x-startX,this.player.y-startY)>.01;
  }

  combatFoeBodyRadius(foe=this.combatFoe){
    if(!foe)return 0;
    if(foe.type==='boss')return COMBAT_BOSS_BODY_RADIUS;
    if(foe.type==='midboss')return COMBAT_MIDBOSS_BODY_RADIUS;
    return COMBAT_FOE_BODY_RADIUS;
  }

  combatActorCollides(x,y,r=this.player.r){
    const actors=[];if(this.combatFoe&&!this.combatFoe.combatEvading)actors.push(this.combatFoe);
    for(const e of this.activeEntities)if(['foe','midboss','boss'].includes(e?.type)&&!e.combatEvading)actors.push(e);
    for(const foe of actors){const min=Math.max(1,Number(r)||0)+this.combatFoeBodyRadius(foe)+COMBAT_BODY_PADDING;if(Math.hypot(x-foe.x,y-foe.y)<min)return true;}
    return false;
  }
  surfaceGapTo(foe){return this.combatSurfaceGap(foe);}
  hasActiveThreats(){
    if(this.combatFoe?.hostile&&!this.combatFoe.combatEvading)return true;
    return this.activeEntities.some(e=>['foe','midboss','boss'].includes(e?.type)&&e.hostile&&!e.combatEvading);
  }
  hostileEntities(){return this.activeEntities.filter(e=>['foe','midboss','boss'].includes(e?.type)&&e.hostile&&!e.combatEvading);}
  markHostile(entity,notify=true){if(!entity)return false;const was=!!entity.hostile;entity.hostile=true;entity.aggro=entity.type==='midboss'||entity.type==='boss'?true:entity.aggro;if(!was&&notify)this.onHostile?.(entity);return !was;}
  findEntityById(id){
    const key=String(id||'');if(!key)return null;if(this.combatFoe&&String(this.combatFoe.id)===key)return this.combatFoe;
    return this.activeEntities.find(e=>String(e?.id)===key)||this.roamers.get(key)||this.bossActors.get(key)||null;
  }
  entityAtScreenPoint(x,y){
    const candidates=[];if(this.combatFoe)candidates.push(this.combatFoe);for(const e of this.activeEntities)if(['foe','midboss','boss'].includes(e?.type)&&e.id!==this.combatEntityId)candidates.push(e);
    // Pointer targeting should follow the visible creature, not demand a click on
    // a tiny centre point. The combat body still owns collision/reach; this is
    // only a forgiving input hit area for mouse/touch selection.
    let best=null,bestD=Infinity;
    for(const e of candidates){
      const p=this.worldToScreen(e.x,e.y),r=e.type==='boss'?46:e.type==='midboss'?39:30,cy=p.y-(e.type==='boss'?10:e.type==='midboss'?8:6),d=Math.hypot(x-p.x,y-cy);
      if(d<=r&&d<bestD){best=e;bestD=d;}
    }
    return best;
  }

  combatSurfaceGap(foe=this.combatFoe){
    if(!foe)return Infinity;
    const center=Math.hypot(this.player.x-foe.x,this.player.y-foe.y);
    return Math.max(0,center-Math.max(1,Number(this.player.r)||0)-this.combatFoeBodyRadius(foe));
  }

  combatCenterRadiusForReach(reach,foe=this.combatFoe){
    if(!foe)return Math.max(0,Number(reach)||0);
    return Math.max(1,Number(this.player.r)||0)+this.combatFoeBodyRadius(foe)+Math.max(0,Number(reach)||0);
  }

  setPlayerReachGuide(range,{visible=true}={}){
    this.playerReachGuideRange=Math.max(0,Number(range)||0);
    this.playerReachGuideVisible=!!visible;
  }

  setCombatRangeGuide(range,{melee=true,inRange=false,enemyThreatRange=10,threatActive=false,showPlayerReach=false}={}){
    // `range` is weapon reach measured from one combat body's surface to the
    // other's. Rendering converts it to a centre radius only for the indicator.
    this.combatPlayerRange=Math.max(0,Number(range)||0);
    this.combatPlayerMelee=!!melee;
    this.combatPlayerInRange=!!inRange;
    this.combatEnemyThreatRange=Math.max(0,Number(enemyThreatRange)||0);
    this.combatThreatActive=!!threatActive;
    this.combatShowPlayerReach=!!showPlayerReach;
  }

  collisionReason(x,y,r,{ignoreBossGate=false}={}){
    if(this.sideBarrierCollides(x,y,r))return 'side-stage';
    if(this.townObstacleCollides(x,y,r))return 'town-structure';
    if(!ignoreBossGate){const bossGate=this.bossGateReason(x,y,r);if(bossGate)return bossGate;}
    if([[x-r,y-r],[x+r,y-r],[x-r,y+r],[x+r,y+r]].some(([px,py])=>this.isWall(Math.floor(px/TILE),Math.floor(py/TILE))))return 'rock';
    return null;
  }

  collides(x,y,r,options){
    const reason=this.collisionReason(x,y,r,options);
    this.lastCollisionReason=reason;
    return !!reason;
  }

  corridorCenter(ty){
    return Math.round(Math.sin((ty+this.seed*.001)*.12)*5+Math.sin((ty-this.seed*.002)*.037)*3);
  }

  antRowFromTy(ty){return Math.max(0,-Math.floor(Number(ty)||0));}

  // Exact v0.203.7 topology retained solely for already-explored save terrain.
  antV1SectorPlan(index){
    const i=Math.max(0,Math.floor(Number(index)||0)),rows=84;
    const h0=hash2(i,19,this.seed+401),h1=hash2(i,31,this.seed+409),h2=hash2(i,47,this.seed+419),h3=hash2(i,59,this.seed+431);
    return{index:i,startRow:i*rows+10+Math.floor(h0*15),lengthRows:38+Math.floor(h1*23),sign:h2>.5?1:-1,offset:8+Math.floor(h3*7),loop:hash2(i,71,this.seed+443)<.72,chamberRx:5+Math.floor(hash2(i,79,this.seed+449)*4),chamberRy:4+Math.floor(hash2(i,83,this.seed+457)*3)};
  }

  antV1LargeChamberPlan(index){
    const i=Math.max(0,Math.floor(Number(index)||0)),rows=84;if(i%3!==1)return null;
    const row=i*rows+50+Math.floor(hash2(i,101,this.seed+463)*15),sign=hash2(i,107,this.seed+467)>.5?1:-1,offset=3+Math.floor(hash2(i,109,this.seed+479)*7),ty=-row,spine=this.corridorCenter(ty);
    return{row,ty,tx:spine+sign*offset,rx:10+Math.floor(hash2(i,113,this.seed+487)*5),ry:7+Math.floor(hash2(i,127,this.seed+491)*5)};
  }

  antV1BranchCarvesFloor(plan,tx,ty){
    if(!plan)return false;
    const row=this.antRowFromTy(ty),u=(row-plan.startRow)/plan.lengthRows;if(u<0||u>1)return false;
    const spine=this.corridorCenter(ty),bow=plan.loop?Math.sin(Math.PI*u):Math.sin(Math.PI*Math.min(1,u*1.45)/2),center=spine+plan.sign*plan.offset*bow;
    if(Math.abs(tx-center)<=2)return true;
    const chamberU=plan.loop?.53:.72,chamberRow=plan.startRow+plan.lengthRows*chamberU,chamberTy=-chamberRow,chamberSpine=this.corridorCenter(chamberTy),chamberBow=plan.loop?Math.sin(Math.PI*chamberU):Math.sin(Math.PI*Math.min(1,chamberU*1.45)/2),chamberTx=chamberSpine+plan.sign*plan.offset*chamberBow;
    const dx=(tx-chamberTx)/plan.chamberRx,dy=(ty-chamberTy)/plan.chamberRy;
    return dx*dx+dy*dy<=1;
  }

  antV1LargeChamberCarvesFloor(plan,tx,ty){
    if(!plan)return false;
    const dx=(tx-plan.tx)/plan.rx,dy=(ty-plan.ty)/plan.ry;if(dx*dx+dy*dy<=1)return true;
    if(Math.abs(ty-plan.ty)<=2){const spine=this.corridorCenter(ty),lo=Math.min(spine,plan.tx),hi=Math.max(spine,plan.tx);if(tx>=lo&&tx<=hi)return true;}
    return false;
  }

  antV1ColonyCarvesFloor(tx,ty){
    if(ty>=-6&&ty<=6&&Math.abs(tx)<=9)return true;
    const spine=this.corridorCenter(ty);if(Math.abs(tx-spine)<=3)return true;
    const row=this.antRowFromTy(ty),sector=Math.floor(row/84);
    for(let i=Math.max(0,sector-1);i<=sector+1;i++){
      if(this.antV1BranchCarvesFloor(this.antV1SectorPlan(i),tx,ty))return true;
      if(this.antV1LargeChamberCarvesFloor(this.antV1LargeChamberPlan(i),tx,ty))return true;
    }
    return false;
  }

  antV1IsWall(tx,ty){
    if(this.antV1ColonyCarvesFloor(tx,ty))return false;
    const c=this.corridorCenter(ty);if(Math.abs(tx-c)>34)return true;
    const n=hash2(tx,ty,this.seed+1801);
    if(n>.84){
      for(const d of Object.values(DIRS))if(this.antV1ColonyCarvesFloor(tx+d.x,ty+d.y))return false;
    }
    return true;
  }

  // v0.203.8 network plan. A sector owns one substantial branch and can own a
  // smaller opposite-side spur. Reconnecting branches physically leave the main
  // route, explore their own chambers, then return farther along the spine.
  antSectorPlan(index){
    const i=Math.max(0,Math.floor(Number(index)||0));
    const h0=hash2(i,19,this.seed+2401),h1=hash2(i,31,this.seed+2411),h2=hash2(i,47,this.seed+2417),h3=hash2(i,59,this.seed+2423);
    const startRow=i*ANT_SECTOR_ROWS+12+Math.floor(h0*12);
    const rawLength=58+Math.floor(h1*23),endRow=Math.min((i+1)*ANT_SECTOR_ROWS-7,startRow+rawLength);
    const sign=h2>.5?1:-1,loop=hash2(i,71,this.seed+2437)<.76;
    return{
      index:i,startRow,endRow,lengthRows:Math.max(38,endRow-startRow),sign,loop,
      offset:16+Math.floor(h3*10),
      chamberRx:5+Math.floor(hash2(i,79,this.seed+2441)*4),
      chamberRy:4+Math.floor(hash2(i,83,this.seed+2447)*3),
      bigChamber:hash2(i,89,this.seed+2459)<.42,
      nested:loop&&hash2(i,97,this.seed+2467)<.68,
      nestedStart:.25+hash2(i,103,this.seed+2473)*.08,
      nestedEnd:.68+hash2(i,107,this.seed+2477)*.10,
      nestedOffset:8+Math.floor(hash2(i,109,this.seed+2483)*7),
      roomCount:2+(hash2(i,113,this.seed+2491)>.48?1:0)
    };
  }

  antSecondaryPlan(index){
    const i=Math.max(0,Math.floor(Number(index)||0));
    if(hash2(i,131,this.seed+2503)>.64)return null;
    const primary=this.antSectorPlan(i),startRow=i*ANT_SECTOR_ROWS+54+Math.floor(hash2(i,137,this.seed+2521)*12);
    const lengthRows=25+Math.floor(hash2(i,139,this.seed+2531)*16);
    return{index:i,startRow,endRow:startRow+lengthRows,lengthRows,sign:-primary.sign,offset:12+Math.floor(hash2(i,149,this.seed+2539)*8),chamberRx:5+Math.floor(hash2(i,151,this.seed+2543)*4),chamberRy:4+Math.floor(hash2(i,157,this.seed+2551)*3)};
  }

  antLargeChamberPlan(index){
    const i=Math.max(0,Math.floor(Number(index)||0));if(i%4!==2)return null;
    const row=i*ANT_SECTOR_ROWS+44+Math.floor(hash2(i,163,this.seed+2557)*20),sign=hash2(i,167,this.seed+2579)>.5?1:-1,ty=-row,spine=this.corridorCenter(ty);
    return{row,ty,tx:spine+sign*(5+Math.floor(hash2(i,173,this.seed+2591)*5)),rx:12+Math.floor(hash2(i,179,this.seed+2593)*5),ry:9+Math.floor(hash2(i,181,this.seed+2609)*5)};
  }

  antPathCenter(plan,row){
    const span=Math.max(1,plan.endRow-plan.startRow),u=clamp((row-plan.startRow)/span,0,1);
    const startTy=-plan.startRow,endTy=-plan.endRow,base=this.corridorCenter(startTy)+(this.corridorCenter(endTy)-this.corridorCenter(startTy))*u;
    const bow=plan.loop?Math.sin(Math.PI*u):Math.sin(Math.PI*.5*clamp(u/.82,0,1));
    return{u,center:base+plan.sign*plan.offset*bow};
  }

  antBranchCarvesFloor(plan,tx,ty,branchHalf=ANT_BRANCH_HALF_WIDTH,nestedHalf=ANT_NESTED_HALF_WIDTH){
    if(!plan)return false;
    const row=this.antRowFromTy(ty),span=Math.max(1,plan.endRow-plan.startRow),u=(row-plan.startRow)/span;if(u<0||u>1)return false;
    const path=this.antPathCenter(plan,row);
    if(Math.abs(tx-path.center)<=branchHalf)return true;

    // Small cave rooms make the branch feel like a place rather than a second
    // parallel corridor. They are deterministic and remain attached to the path.
    const roomUs=[.34,.53,.72];
    for(let i=0;i<Math.min(plan.roomCount,roomUs.length);i++){
      const ru=roomUs[i],rr=plan.startRow+span*ru,pt=this.antPathCenter(plan,rr),rx=4+Math.floor(hash2(plan.index,i+191,this.seed+2617)*3),ry=3+Math.floor(hash2(plan.index,i+197,this.seed+2621)*3);
      const dx=(tx-pt.center)/rx,dy=(ty+rr)/ry;if(dx*dx+dy*dy<=1)return true;
    }

    const chamberU=plan.loop?.56:.84,chamberRow=plan.startRow+span*chamberU,chamber=this.antPathCenter(plan,chamberRow);
    const crx=plan.bigChamber?11+plan.chamberRx*.45:plan.chamberRx,cry=plan.bigChamber?8+plan.chamberRy*.55:plan.chamberRy;
    let dx=(tx-chamber.center)/crx,dy=(ty+chamberRow)/cry;if(dx*dx+dy*dy<=1)return true;

    // A side passage can have its own side passage. This nested route leaves the
    // primary branch, reaches another pocket, and reconnects to that branch.
    if(plan.nested&&u>=plan.nestedStart&&u<=plan.nestedEnd){
      const su=(u-plan.nestedStart)/Math.max(.01,plan.nestedEnd-plan.nestedStart);
      const nestedCenter=path.center+plan.sign*plan.nestedOffset*Math.sin(Math.PI*su);
      if(Math.abs(tx-nestedCenter)<=nestedHalf)return true;
      if(Math.abs(su-.52)<.17){
        const nrx=5+Math.floor(hash2(plan.index,211,this.seed+2633)*3),nry=4+Math.floor(hash2(plan.index,223,this.seed+2647)*2);
        dx=(tx-(path.center+plan.sign*plan.nestedOffset*Math.sin(Math.PI*.52)))/nrx;
        const midRow=plan.startRow+span*(plan.nestedStart+(plan.nestedEnd-plan.nestedStart)*.52);
        dy=(ty+midRow)/nry;if(dx*dx+dy*dy<=1)return true;
      }
    }
    return false;
  }

  antSecondaryCarvesFloor(plan,tx,ty,nestedHalf=ANT_NESTED_HALF_WIDTH){
    if(!plan)return false;
    const row=this.antRowFromTy(ty),span=Math.max(1,plan.endRow-plan.startRow),u=(row-plan.startRow)/span;if(u<0||u>1)return false;
    const startTy=-plan.startRow,endTy=-plan.endRow,base=this.corridorCenter(startTy)+(this.corridorCenter(endTy)-this.corridorCenter(startTy))*u;
    const center=base+plan.sign*plan.offset*Math.sin(Math.PI*.5*clamp(u/.78,0,1));
    if(Math.abs(tx-center)<=nestedHalf)return true;
    const endCenter=this.corridorCenter(endTy)+plan.sign*plan.offset,dx=(tx-endCenter)/plan.chamberRx,dy=(ty+plan.endRow)/plan.chamberRy;
    return dx*dx+dy*dy<=1;
  }

  antLargeChamberCarvesFloor(plan,tx,ty){
    if(!plan)return false;
    const dx=(tx-plan.tx)/plan.rx,dy=(ty-plan.ty)/plan.ry;if(dx*dx+dy*dy<=1)return true;
    if(Math.abs(ty-plan.ty)<=3){const spine=this.corridorCenter(ty),lo=Math.min(spine,plan.tx),hi=Math.max(spine,plan.tx);if(tx>=lo&&tx<=hi)return true;}
    return false;
  }

  smoothRowNoise(ty,salt=0,span=7){
    const row=-Number(ty||0),q=Math.floor(row/span),t=(row-q*span)/span,st=t*t*(3-2*t);
    const a=hash2(q,salt,this.seed+2861),b=hash2(q+1,salt,this.seed+2861);
    return a+(b-a)*st;
  }

  organicMainCarvesFloor(tx,ty){
    const c=this.corridorCenter(ty),dx=tx-c,dist=Math.abs(dx);
    if(dist<=ORGANIC_MAIN_CORE_HALF_WIDTH)return true;
    const side=dx<0?-1:1;
    const drift=(this.smoothRowNoise(ty,side<0?2911:2927,8)-.5)*4;
    const width=ORGANIC_MAIN_HALF_WIDTH+drift;
    if(dist>width+1.2)return false;
    if(dist<=width-1.1)return true;
    // Moderate erosion only at the outer lip. It can make the wall breathe and
    // break up ruler-straight edges, but cannot touch the eleven-tile core.
    const coarse=hash2(Math.floor(tx/2),Math.floor(ty/2),this.seed+2941),fine=hash2(tx,ty,this.seed+2953);
    const n=coarse*.76+fine*.24,edge=(dist-(width-1.1))/2.3;
    return n>(.24+Math.max(0,edge)*.33);
  }

  antColonyCarvesFloor(tx,ty,mainHalf=ANT_MAIN_HALF_WIDTH,branchHalf=ANT_BRANCH_HALF_WIDTH,nestedHalf=ANT_NESTED_HALF_WIDTH){
    if(ty>=-6&&ty<=6&&Math.abs(tx)<=10)return true;
    const spine=this.corridorCenter(ty);if(Math.abs(tx-spine)<=mainHalf)return true;
    const row=this.antRowFromTy(ty),sector=Math.floor(row/ANT_SECTOR_ROWS);
    for(let i=Math.max(0,sector-1);i<=sector+1;i++){
      if(this.antBranchCarvesFloor(this.antSectorPlan(i),tx,ty,branchHalf,nestedHalf))return true;
      if(this.antSecondaryCarvesFloor(this.antSecondaryPlan(i),tx,ty,nestedHalf))return true;
      if(this.antLargeChamberCarvesFloor(this.antLargeChamberPlan(i),tx,ty))return true;
    }
    return false;
  }

  variedSectorPlan(index){
    const i=Math.max(0,Math.floor(Number(index)||0)),h=(salt)=>hash2(i,salt,this.seed+3701);
    const startRow=i*VARIED_SECTOR_ROWS+16+Math.floor(h(17)*20),raw=74+Math.floor(h(23)*39),endRow=Math.min((i+1)*VARIED_SECTOR_ROWS-9,startRow+raw);
    return{index:i,startRow,endRow,lengthRows:Math.max(46,endRow-startRow),sign:h(29)>.5?1:-1,loop:h(31)<.70,offset:44+Math.floor(h(37)*22),style:Math.floor(h(41)*5),roomCount:1+Math.floor(h(43)*4),bigChamber:h(47)<.46,nested:h(53)<.58,nestedOffset:14+Math.floor(h(59)*13),phase:h(61)*Math.PI*2};
  }

  variedPathCenter(plan,row){
    const span=Math.max(1,plan.endRow-plan.startRow),u=clamp((row-plan.startRow)/span,0,1),startTy=-plan.startRow,endTy=-plan.endRow;
    const base=this.corridorCenter(startTy)+(this.corridorCenter(endTy)-this.corridorCenter(startTy))*u;
    let bow;
    if(plan.loop){
      if(plan.style===0)bow=Math.sin(Math.PI*u);
      else if(plan.style===1)bow=Math.pow(Math.max(0,Math.sin(Math.PI*u)),.64);
      else if(plan.style===2)bow=Math.sin(Math.PI*u)*(.84+.22*Math.sin(2*Math.PI*u+plan.phase));
      else if(plan.style===3)bow=Math.sin(Math.PI*u)+.20*Math.sin(2*Math.PI*u+plan.phase);
      else bow=Math.sin(Math.PI*Math.pow(u,.86))*(.9+.14*Math.sin(4*Math.PI*u+plan.phase));
    }else{
      bow=Math.sin(Math.PI*.5*clamp(u/.78,0,1));
      if(plan.style===2||plan.style===4)bow*=.9+.16*Math.sin(3*Math.PI*u+plan.phase);
    }
    return{u,center:base+plan.sign*plan.offset*bow};
  }

  variedBranchCarvesFloor(plan,tx,ty){
    if(!plan)return false;const row=this.antRowFromTy(ty),span=Math.max(1,plan.endRow-plan.startRow),u=(row-plan.startRow)/span;if(u<0||u>1)return false;
    const path=this.variedPathCenter(plan,row),d=Math.abs(tx-path.center);
    if(d<=ORGANIC_V2_BRANCH_HALF_WIDTH-1)return true;
    if(d<=ORGANIC_V2_BRANCH_HALF_WIDTH+1.3){const n=hash2(tx,ty,this.seed+3719+plan.index*17);if(n>.30+(d-ORGANIC_V2_BRANCH_HALF_WIDTH+1)*.12)return true;}
    // Variable room chain. Their u/size/offset changes per sector rather than
    // repeating the same three ellipses forever.
    for(let i=0;i<plan.roomCount;i++){
      const ru=.24+(i+1)/(plan.roomCount+2)*.58+(hash2(plan.index,i+71,this.seed+3727)-.5)*.07,rr=plan.startRow+span*ru,pt=this.variedPathCenter(plan,rr);
      const rx=5+Math.floor(hash2(plan.index,i+83,this.seed+3733)*6),ry=4+Math.floor(hash2(plan.index,i+89,this.seed+3739)*5),lobe=(hash2(plan.index,i+97,this.seed+3749)-.5)*3;
      let dx=(tx-(pt.center+plan.sign*lobe))/rx,dy=(ty+rr)/ry;if(dx*dx+dy*dy<=1)return true;
    }
    const chamberU=.48+hash2(plan.index,103,this.seed+3761)*.26,chamberRow=plan.startRow+span*chamberU,ch=this.variedPathCenter(plan,chamberRow),crx=plan.bigChamber?14+Math.floor(hash2(plan.index,107,this.seed+3767)*7):8+Math.floor(hash2(plan.index,109,this.seed+3779)*5),cry=plan.bigChamber?10+Math.floor(hash2(plan.index,113,this.seed+3793)*6):6+Math.floor(hash2(plan.index,127,this.seed+3797)*4);
    let dx=(tx-ch.center)/crx,dy=(ty+chamberRow)/cry;if(dx*dx+dy*dy<=1)return true;
    if(plan.bigChamber){dx=(tx-(ch.center+plan.sign*crx*.42))/(crx*.58);dy=(ty+chamberRow-cry*.22)/(cry*.62);if(dx*dx+dy*dy<=1)return true;}
    if(plan.nested&&u>.30&&u<.72){const su=(u-.30)/.42,nestedCenter=path.center+plan.sign*plan.nestedOffset*Math.sin(Math.PI*su);if(Math.abs(tx-nestedCenter)<=ORGANIC_V2_NESTED_HALF_WIDTH)return true;if(Math.abs(su-.56)<.17){const mid=plan.startRow+span*(.30+.42*.56);dx=(tx-(path.center+plan.sign*plan.nestedOffset*Math.sin(Math.PI*.56)))/7;dy=(ty+mid)/5;if(dx*dx+dy*dy<=1)return true;}}
    return false;
  }

  variedSecondaryPlan(index){
    const i=Math.max(0,Math.floor(Number(index)||0));if(hash2(i,137,this.seed+3803)>.48)return null;const primary=this.variedSectorPlan(i),startRow=i*VARIED_SECTOR_ROWS+64+Math.floor(hash2(i,139,this.seed+3821)*20),len=31+Math.floor(hash2(i,149,this.seed+3823)*28);return{index:i,startRow,endRow:Math.min((i+1)*VARIED_SECTOR_ROWS-5,startRow+len),sign:-primary.sign,offset:34+Math.floor(hash2(i,151,this.seed+3833)*20),style:Math.floor(hash2(i,157,this.seed+3847)*3)};
  }

  variedSecondaryCarvesFloor(plan,tx,ty){
    if(!plan)return false;
    const span=Math.max(1,plan.endRow-plan.startRow),row=this.antRowFromTy(ty),u=(row-plan.startRow)/span;
    if(u<0||u>1)return false;
    const startTy=-plan.startRow,endTy=-plan.endRow,base=this.corridorCenter(startTy)+(this.corridorCenter(endTy)-this.corridorCenter(startTy))*u;
    let bow=Math.sin(Math.PI*.5*clamp(u/.75,0,1));if(plan.style===1)bow*=.88+.18*Math.sin(3*Math.PI*u);else if(plan.style===2)bow=Math.pow(bow,.74);const center=base+plan.sign*plan.offset*bow;
    if(Math.abs(tx-center)<=ORGANIC_V2_NESTED_HALF_WIDTH)return true;const endCenter=this.corridorCenter(endTy)+plan.sign*plan.offset,dx=(tx-endCenter)/(7+plan.style*2),dy=(ty+plan.endRow)/(5+plan.style);return dx*dx+dy*dy<=1;
  }

  variedLargeChamberPlan(index){
    const i=Math.max(0,Math.floor(Number(index)||0));if(i%3!==1)return null;const row=i*VARIED_SECTOR_ROWS+48+Math.floor(hash2(i,163,this.seed+3863)*35),ty=-row,sign=hash2(i,167,this.seed+3877)>.5?1:-1,spine=this.corridorCenter(ty);return{row,ty,tx:spine+sign*(18+Math.floor(hash2(i,173,this.seed+3881)*18)),sign,rx:15+Math.floor(hash2(i,179,this.seed+3889)*8),ry:10+Math.floor(hash2(i,181,this.seed+3907)*7),lobe:hash2(i,191,this.seed+3911)};
  }

  variedLargeChamberCarvesFloor(plan,tx,ty){
    if(!plan)return false;let dx=(tx-plan.tx)/plan.rx,dy=(ty-plan.ty)/plan.ry;if(dx*dx+dy*dy<=1)return true;const lx=plan.tx+plan.sign*plan.rx*.48,ly=plan.ty+(plan.lobe-.5)*plan.ry*.65;dx=(tx-lx)/(plan.rx*.62);dy=(ty-ly)/(plan.ry*.60);if(dx*dx+dy*dy<=1)return true;if(Math.abs(ty-plan.ty)<=3){const spine=this.corridorCenter(ty),lo=Math.min(spine,plan.tx),hi=Math.max(spine,plan.tx);if(tx>=lo&&tx<=hi)return true;}return false;
  }

  organicMainV2CarvesFloor(tx,ty){
    const c=this.corridorCenter(ty),dx=tx-c,dist=Math.abs(dx);if(dist<=ORGANIC_V2_MAIN_CORE_HALF_WIDTH)return true;const side=dx<0?-1:1,drift=(this.smoothRowNoise(ty,side<0?4013:4021,10)-.5)*10,width=ORGANIC_V2_MAIN_HALF_WIDTH+drift;if(dist>width+1.5)return false;if(dist<=width-1.4)return true;const coarse=hash2(Math.floor(tx/2),Math.floor(ty/2),this.seed+4027),fine=hash2(tx,ty,this.seed+4049),n=coarse*.72+fine*.28,edge=(dist-(width-1.4))/2.9;return n>(.24+Math.max(0,edge)*.30);
  }

  variedColonyCarvesFloor(tx,ty){
    if(ty>=-6&&ty<=6&&Math.abs(tx)<=16)return true;if(this.organicMainV2CarvesFloor(tx,ty))return true;const row=this.antRowFromTy(ty),sector=Math.floor(row/VARIED_SECTOR_ROWS);for(let i=Math.max(0,sector-1);i<=sector+1;i++){if(this.variedBranchCarvesFloor(this.variedSectorPlan(i),tx,ty))return true;if(this.variedSecondaryCarvesFloor(this.variedSecondaryPlan(i),tx,ty))return true;if(this.variedLargeChamberCarvesFloor(this.variedLargeChamberPlan(i),tx,ty))return true;}return false;
  }

  eventTile(event){
    const depth=Math.max(0,Number(event?.depth)||0);
    const ty=Math.floor(yFromDepth(depth)/TILE);
    const center=this.corridorCenter(ty);
    const sign=hash2(Math.floor(depth*10),73,this.seed)>.5?1:-1;
    if(event?.type==='sidepassage')return{tx:center+sign*15,ty,center,sign};
    if(event?.type==='caravan')return{tx:center+sign*3,ty,center,sign};
    if(event?.type==='merchant')return{tx:center+sign*3,ty,center,sign};
    if(event?.type==='rescue-hideout'){
      // Fresh broad-cavern hideouts live beyond the actual main-route lip rather
      // than being stamped as a square into the road itself.
      if(ty<=this.varietyTopologyStartTy){const edge=this.mainRouteEdgeTx(ty,center,sign);return{tx:edge+sign*9,ty,center:edge,sign};}
      return{tx:center+sign*10,ty,center,sign};
    }
    if(event?.type==='rescue-tracks')return{tx:center+sign*3,ty,center,sign};
    if(event?.type==='rescue-satchel')return{tx:center+sign*3,ty,center,sign};
    if(event?.type==='escort-pursuit')return{tx:center-sign*3,ty,center,sign:-sign};
    if(event?.type==='quest-target')return{tx:center+sign*3,ty,center,sign};
    if(event?.type==='midboss'||event?.type==='boss')return{tx:center,ty,center,sign};
    return{tx:center,ty,center,sign};
  }

  eventCarvesFloor(tx,ty){
    // Road traffic never owns terrain. Caravans, merchants, clues and ordinary
    // quest markers are placed on the already-generated network, so their
    // disappearance cannot make cavern walls close behind them.
    for(const site of this.persistentEventSites){
      if(site.type!=='rescue-hideout')continue;
      // A refuge is a rough side recess, not a 9x9 rectangle. Keep a guaranteed
      // core for traversal and erode only the outer lip.
      const a={x:site.center,y:site.ty},b={x:site.tx,y:site.ty+(hash2(site.tx,site.ty,this.seed+3613)>.5?1.4:-1.4)};
      const stem=Math.sqrt(this.pointSegmentDistanceSq(tx,ty,a.x,a.y,b.x,b.y));
      if(stem<=1.45)return true;
      if(stem<=2.45&&hash2(tx,ty,this.seed+3623)>.37)return true;
      const dySign=hash2(site.ty,site.tx,this.seed+3637)>.5?1:-1;
      const lobes=[
        {x:site.tx,y:site.ty,rx:5.1,ry:4.0},
        {x:site.tx+site.sign*2.0,y:site.ty+dySign*1.4,rx:4.2,ry:3.2}
      ];
      for(let i=0;i<lobes.length;i++){
        const r=lobes[i],dx=(tx-r.x)/r.rx,dy=(ty-r.y)/r.ry,d2=dx*dx+dy*dy;
        if(d2<=.72)return true;
        if(d2<=1.16){const need=.24+Math.max(0,d2-.72)*.33;if(hash2(tx,ty,this.seed+3651+i*17)>need)return true;}
      }
    }
    return false;
  }

  mainRouteEdgeTx(ty,center,sign){
    // Read the actual deterministic lip of the fresh v0.203.12 main spine. This
    // intentionally ignores optional branch/chamber floor: a Hollow belongs just
    // off the main road, not at the far edge of an unrelated excursion.
    if(ty<=this.varietyTopologyStartTy){
      let last=center,misses=0;
      for(let i=0;i<=ORGANIC_V2_MAIN_HALF_WIDTH+18;i++){
        const tx=center+sign*i;
        if(this.organicMainV2CarvesFloor(tx,ty)){last=tx;misses=0;}
        else if(++misses>=2)break;
      }
      return last;
    }
    return center+sign*8;
  }

  hollowTile(depth){
    const ty=Math.floor(yFromDepth(depth)/TILE),center=this.corridorCenter(ty),sign=hash2(Math.floor(depth*10),191,this.seed)>.5?1:-1;
    if(ty<=this.varietyTopologyStartTy){
      const edgeTx=this.mainRouteEdgeTx(ty,center,sign);
      const reach=6+Math.floor(hash2(Math.floor(depth*10),197,this.seed+3631)*3);
      const tx=edgeTx+sign*reach;
      return{tx,ty,center,edgeTx,sign,x:(tx+.5)*TILE,y:(ty+.5)*TILE};
    }
    const tx=center+sign*9;
    return{tx,ty,center,edgeTx:center,sign,x:(tx+.5)*TILE,y:(ty+.5)*TILE};
  }

  nearbyHollowTiles(ty){
    const depth=depthFromY(ty*TILE),out=[];
    const k0=Math.round((depth-ORDINARY_HOLLOW_FIRST)/ORDINARY_HOLLOW_GAP);
    for(let k=k0-1;k<=k0+1;k++)if(k>=0){
      const d=ORDINARY_HOLLOW_FIRST+k*ORDINARY_HOLLOW_GAP;
      if(d>=0)out.push(this.hollowTile(d));
    }
    const s0=Math.floor(depth/500);
    for(let s=s0-1;s<=s0+1;s++)if(s>=0){
      const d=(s+1)*500-8;
      if(d>0)out.push(this.hollowTile(d));
    }
    return out;
  }

  hollowCarvesFloor(tx,ty){
    for(const p of this.nearbyHollowTiles(ty)){
      // Short curved neck from the main-route lip into the shelter. Sampling a
      // soft curve instead of stamping a straight rectangle keeps the alcove
      // visibly connected without producing a man-made hallway.
      const curveSign=hash2(p.tx,p.ty,this.seed+3643)>.5?1:-1;
      const bend=curveSign*(1.0+hash2(p.ty,p.tx,this.seed+3647)*1.8);
      let prev={x:p.edgeTx??p.center,y:p.ty};
      for(let i=1;i<=8;i++){
        const u=i/8,x=(p.edgeTx??p.center)+(p.tx-(p.edgeTx??p.center))*u,y=p.ty+Math.sin(Math.PI*u)*bend;
        const d=Math.sqrt(this.pointSegmentDistanceSq(tx,ty,prev.x,prev.y,x,y));
        const core=1.20+.36*Math.sin(Math.PI*u),lip=core+1.05;
        if(d<=core)return true;
        if(d<=lip){const edge=(d-core)/Math.max(.01,lip-core),need=.30+edge*.30;if(hash2(tx,ty,this.seed+3661+i*13)>need)return true;}
        prev={x,y};
      }

      // Three overlapping lobes form an irregular erosion pocket around the fire.
      // The protected inner cores guarantee the camp marker can never be stranded,
      // while the offset lobes keep the shelter from reading as a stamped ellipse.
      const lobeY=hash2(p.ty,p.tx,this.seed+3689)>.5?1:-1;
      const lobeShift=1.2+hash2(p.tx,p.ty,this.seed+3697)*1.5;
      const lobes=[
        {x:p.tx,y:p.ty,rx:5.0,ry:3.9},
        {x:p.tx+p.sign*2.0,y:p.ty+lobeY*lobeShift,rx:3.9,ry:3.05},
        {x:p.tx-p.sign*1.0,y:p.ty-lobeY*(1.0+hash2(p.ty,p.tx,this.seed+3701)*1.2),rx:3.35,ry:2.75}
      ];
      for(let i=0;i<lobes.length;i++){
        const r=lobes[i],dx=(tx-r.x)/r.rx,dy=(ty-r.y)/r.ry,d2=dx*dx+dy*dy;
        if(d2<=.70)return true;
        if(d2<=1.22){const need=.20+Math.max(0,d2-.70)*.38;if(hash2(tx*3+i*7,ty*5-i*11,this.seed+3709+i*19)>need)return true;}
      }
    }
    return false;
  }

  hollowSafeZone(tx,ty){
    return this.nearbyHollowTiles(ty).some(p=>Math.abs(ty-p.ty)<=HOLLOW_SAFE_Y&&Math.abs(tx-p.tx)<=HOLLOW_SAFE_X);
  }

  legacyProceduralWall(tx,ty){
    if(ty>4)return Math.abs(tx)>16;
    const c=this.corridorCenter(ty),band=Math.abs(tx-c);
    if(band<=3)return false;
    const stratum=stratumIndex(depthFromY(ty*TILE));
    const coarse=hash2(Math.floor(tx/4),Math.floor(ty/4),this.seed+stratum*991);
    const medium=hash2(Math.floor(tx/2),Math.floor(ty/2),this.seed+stratum*313+31);
    const fine=hash2(tx,ty,this.seed*3+17);
    if(band<=12){if(coarse>.18&&coarse<.90)return fine<.16;return fine<.42;}
    if(band<=21){const chamber=coarse>.34&&coarse<.76&&medium>.20;if(chamber)return fine<.24;}
    if(band<=27){const rarePocket=coarse>.48&&coarse<.65&&medium>.42&&medium<.82;if(rarePocket)return fine<.34;}
    return true;
  }

  isWall(tx,ty){
    tx=Math.floor(Number(tx)||0);ty=Math.floor(Number(ty)||0);
    const key=`${tx},${ty}`;
    if(this.wallCache.has(key))return this.wallCache.get(key);
    const wall=this.computeWall(tx,ty);
    // Bound memory while retaining several screens worth of already-computed
    // terrain. Clearing occasionally is cheaper than rebuilding the cave graph
    // thousands of times every frame.
    if(this.wallCache.size>32000)this.wallCache.clear();
    this.wallCache.set(key,wall);
    return wall;
  }

  computeWall(tx,ty){
    if(ty>=-6&&ty<=6&&Math.abs(tx)<=16)return false;
    const bossOverride=this.bossTerrainOverride(tx,ty);
    if(bossOverride!==null)return bossOverride;
    if(this.eventCarvesFloor(tx,ty))return false;
    if(this.sideCarvesFloor(tx,ty))return false;
    if(this.townCarvesFloor(tx,ty))return false;
    if(this.hollowCarvesFloor(tx,ty))return false;

    // Preserve both historical topology bands. v0.203.6 and earlier keep their
    // old procedural field; already-explored v0.203.7 ant-colony terrain keeps
    // the exact v0.203.7 algorithm. The richer v0.203.8 network begins only
    // beyond the saved frontier.
    if(ty>this.antTopologyStartTy)return this.legacyProceduralWall(tx,ty);
    if(ty>this.networkTopologyStartTy)return this.antV1IsWall(tx,ty);
    if(ty>this.wideTopologyStartTy){
      if(this.antColonyCarvesFloor(tx,ty))return false;
      const oldC=this.corridorCenter(ty);if(Math.abs(tx-oldC)>ANT_WORLD_HALF_WIDTH)return true;
      const oldN=hash2(tx,ty,this.seed+2801);if(oldN>.87){for(const d of Object.values(DIRS))if(this.antColonyCarvesFloor(tx+d.x,ty+d.y))return false;}
      return true;
    }
    if(ty>this.organicTopologyStartTy){
      if(this.antColonyCarvesFloor(tx,ty,WIDE_MAIN_HALF_WIDTH,WIDE_BRANCH_HALF_WIDTH,WIDE_NESTED_HALF_WIDTH))return false;
      const c=this.corridorCenter(ty);if(Math.abs(tx-c)>ANT_WORLD_HALF_WIDTH)return true;
      const n=hash2(tx,ty,this.seed+2801);if(n>.87){for(const d of Object.values(DIRS))if(this.antColonyCarvesFloor(tx+d.x,ty+d.y,WIDE_MAIN_HALF_WIDTH,WIDE_BRANCH_HALF_WIDTH,WIDE_NESTED_HALF_WIDTH))return false;}
      return true;
    }

    if(ty<=this.varietyTopologyStartTy){
      if(this.variedColonyCarvesFloor(tx,ty))return false;
      const c=this.corridorCenter(ty);if(Math.abs(tx-c)>VARIED_WORLD_HALF_WIDTH)return true;
      const n=hash2(tx,ty,this.seed+4061);if(n>.91){for(const d of Object.values(DIRS))if(this.variedColonyCarvesFloor(tx+d.x,ty+d.y))return false;}
      return true;
    }

    if(this.organicMainCarvesFloor(tx,ty))return false;
    if(this.antColonyCarvesFloor(tx,ty,0,ORGANIC_BRANCH_HALF_WIDTH,ORGANIC_NESTED_HALF_WIDTH))return false;
    const c=this.corridorCenter(ty);
    if(Math.abs(tx-c)>ANT_WORLD_HALF_WIDTH)return true;

    const n=hash2(tx,ty,this.seed+2801);
    if(n>.90){
      for(const d of Object.values(DIRS)){
        if(this.organicMainCarvesFloor(tx+d.x,ty+d.y))return false;
        if(this.antColonyCarvesFloor(tx+d.x,ty+d.y,0,ORGANIC_BRANCH_HALF_WIDTH,ORGANIC_NESTED_HALF_WIDTH))return false;
      }
    }
    return true;
  }

  walkableNeighborCount(tx,ty){
    let n=0;
    for(const d of Object.values(DIRS))if(!this.isWall(tx+d.x,ty+d.y))n++;
    return n;
  }

  isSpawnAccessible(tx,ty){
    const key=`${tx},${ty}`;
    if(this.reachabilityCache.has(key))return this.reachabilityCache.get(key);
    if(this.isWall(tx,ty)||this.walkableNeighborCount(tx,ty)<1){this.reachabilityCache.set(key,false);return false;}
    // Side Networks can deliberately travel much farther than the bounded flood
    // search below. Their geometry is authored from a stem that is guaranteed to
    // meet the main cavern, so a floor tile inside one is valid without flooding
    // a hundred-tile expedition back to the spine on restore.
    if(this.sideCarvesFloor(tx,ty)){this.reachabilityCache.set(key,true);return true;}
    // Hard caps prevent a disconnected procedural pocket from flooding thousands
    // of tiles on the browser's main thread. All authored continuous-world spaces
    // (main cavern, towns and side branches) reach the spine well inside this.
    const q=[[tx,ty,0]],seen=new Set([key]),depthLimit=80,nodeLimit=1800;
    let ok=false,qi=0;
    while(qi<q.length&&qi<nodeLimit){
      const[x,y,d]=q[qi++];
      if(Math.abs(x-this.corridorCenter(y))<=3){ok=true;break;}
      if(d>=depthLimit)continue;
      for(const dir of Object.values(DIRS)){
        const nx=x+dir.x,ny=y+dir.y,nk=`${nx},${ny}`;
        if(seen.has(nk)||this.isWall(nx,ny))continue;
        seen.add(nk);q.push([nx,ny,d+1]);
        if(seen.size>=nodeLimit)break;
      }
    }
    this.reachabilityCache.set(key,ok);
    return ok;
  }

  entityId(type,tx,ty){return`${type}:${tx}:${ty}`;}

  dropLootBag({id,recordId,x,y}={}){
    if(!recordId)return null;
    const key=String(id||`loot:${recordId}`);
    if(this.lootBags.has(key))return this.lootBags.get(key);
    const bag={type:'loot',id:key,recordId:String(recordId),x:Number(x)||this.player.x,y:Number(y)||this.player.y};
    this.lootBags.set(key,bag);
    return bag;
  }

  removeLootBag(id){if(!id)return false;return this.lootBags.delete(String(id));}

  getRoamer(id,tx,ty,foe){
    let e=this.roamers.get(id);
    if(!e){
      const x=(tx+.5)*TILE,y=(ty+.5)*TILE;
      e={type:'foe',id,tx,ty,homeTx:tx,homeTy:ty,homeX:x,homeY:y,x,y,foe,targetX:x,targetY:y,roamTimer:1+hash2(tx,ty,this.seed+341)*2.5,speed:12+hash2(tx,ty,this.seed+721)*10};
      this.roamers.set(id,e);
    }
    e.foe=foe;
    return e;
  }

  ordinaryEcologySpawnTile(tx,ty){
    if(this.isWall(tx,ty))return false;
    const depth=depthFromY(ty*TILE);
    if(depth<3)return false;
    if(this.townSafeZone(tx,ty)||this.sideCarvesFloor(tx,ty))return false;
    if(this.bossExclusionAtTile(tx,ty)||this.townEnemyExclusionAtTile(tx,ty)||this.hollowSafeZone(tx,ty))return false;
    return this.isSpawnAccessible(tx,ty);
  }

  ordinaryEcologySectorSpawns(sx,sy){
    const size=ORDINARY_ECOLOGY_SECTOR_TILES,kind=hash2(sx,sy,this.seed+3601);
    if(kind<ORDINARY_ECOLOGY_QUIET_SHARE)return[];
    const nest=kind>=ORDINARY_ECOLOGY_QUIET_SHARE+ORDINARY_ECOLOGY_LONE_SHARE;
    const count=nest?2+Math.floor(hash2(sx,sy,this.seed+3607)*3):1;
    const x0=sx*size,y0=sy*size;
    let anchor=null;
    // Find one stable walkable anchor anywhere in the sector. A handful of
    // deterministic probes is enough for broad caverns without doing a full scan.
    for(let i=0;i<28;i++){
      const tx=x0+1+Math.floor(hash2(sx*37+i,sy*19-i,this.seed+3613)*(size-2));
      const ty=y0+1+Math.floor(hash2(sx*23-i,sy*41+i,this.seed+3617)*(size-2));
      if(this.ordinaryEcologySpawnTile(tx,ty)){anchor={tx,ty};break;}
    }
    if(!anchor)return[];
    const out=[anchor];
    if(!nest)return out;

    // A nest is a genuine local group: additional bodies stay near the anchor
    // instead of being independent random points scattered across the sector.
    for(let i=1;i<count;i++){
      let placed=null;
      for(let attempt=0;attempt<24;attempt++){
        const angle=hash2(sx*71+i*13,sy*67+attempt,this.seed+3623)*Math.PI*2;
        const radius=2+Math.floor(hash2(sx*29+attempt,sy*31+i,this.seed+3631)*6);
        const tx=anchor.tx+Math.round(Math.cos(angle)*radius),ty=anchor.ty+Math.round(Math.sin(angle)*radius);
        if(tx<=x0||tx>=x0+size-1||ty<=y0||ty>=y0+size-1)continue;
        if(out.some(p=>Math.hypot(p.tx-tx,p.ty-ty)<2.4))continue;
        if(this.ordinaryEcologySpawnTile(tx,ty)){placed={tx,ty};break;}
      }
      if(placed)out.push(placed);
    }
    return out;
  }

  ordinaryEcologyEntities(ptx,pty,rx,ry){
    const size=ORDINARY_ECOLOGY_SECTOR_TILES,candidates=[];
    const sx0=Math.floor((ptx-rx-2)/size),sx1=Math.floor((ptx+rx+2)/size);
    const sy0=Math.floor((pty-ry-2)/size),sy1=Math.floor((pty+ry+2)/size);
    const profiles=this.getProfiles();
    if(!profiles.length)return candidates;
    for(let sy=sy0;sy<=sy1;sy++)for(let sx=sx0;sx<=sx1;sx++){
      for(const sp of this.ordinaryEcologySectorSpawns(sx,sy)){
        if(Math.abs(sp.tx-ptx)>rx+3||Math.abs(sp.ty-pty)>ry+3)continue;
        const id=this.entityId('foe',sp.tx,sp.ty);
        if(this.defeated.has(id)||id===this.combatEntityId)continue;
        const depth=depthFromY(sp.ty*TILE),eligible=profiles.filter(f=>depth>=Number(f.unlock||0));
        const pool=eligible.length?eligible:profiles,foe=pool[Math.floor(hash2(sp.tx,sp.ty,this.seed+990)*pool.length)];
        if(!foe)continue;
        const e=this.getRoamer(id,sp.tx,sp.ty,foe);
        const dx=e.x-this.player.x,dy=e.y-this.player.y;
        candidates.push({e,dist2:dx*dx+dy*dy});
      }
    }
    // Hard local cap: random geography can no longer create an accidental wall
    // of ordinary hostiles. Side-passage ecology and authored bosses are separate.
    candidates.sort((a,b)=>a.dist2-b.dist2||String(a.e.id).localeCompare(String(b.e.id)));
    return candidates.slice(0,ORDINARY_LOCAL_ACTIVE_CAP).map(v=>v.e);
  }

  pickRoamTarget(e){
    for(let i=0;i<12;i++){
      const ox=Math.floor(Math.random()*9-4),oy=Math.floor(Math.random()*9-4);
      const tx=e.homeTx+ox,ty=e.homeTy+oy;
      const sidePlan=e.sidePlanId?this.sidePlanById(e.sidePlanId):null;
      if(sidePlan){
        if(!this.sidePlanCarvesFloor(sidePlan,tx,ty)||this.isWall(tx,ty)||this.hollowSafeZone(tx,ty)||this.townEnemyExclusionAtTile(tx,ty)||this.bossExclusionAtTile(tx,ty))continue;
      }else if(!this.isSpawnAccessible(tx,ty)||this.hollowSafeZone(tx,ty)||this.townEnemyExclusionAtTile(tx,ty)||this.bossExclusionAtTile(tx,ty)||this.sideCarvesFloor(tx,ty))continue;
      const x=(tx+.5)*TILE,y=(ty+.5)*TILE;
      if(Math.hypot(x-e.homeX,y-e.homeY)>TILE*4.2)continue;
      e.targetX=x;e.targetY=y;e.roamTimer=1.2+Math.random()*2.8;return;
    }
    e.targetX=e.homeX;e.targetY=e.homeY;e.roamTimer=1+Math.random()*2;
  }

  updateRoamers(dt,entities){
    const{rx,ry}=this.entityRadii();
    const aiTiles=Math.max(AI_RADIUS_TILES,Math.min(24,Math.ceil(Math.max(rx,ry)*.55))),aiRadius=aiTiles*TILE;
    for(const e of entities){
      if(e.type!=='foe'||e.id===this.combatEntityId)continue;
      const playerDist=Math.hypot(e.x-this.player.x,e.y-this.player.y);if(playerDist>aiRadius&&!e.hostile&&!e.combatEvading)continue;
      const detectTiles=Math.max(1,Number(this.getDetectionRadius?.(e.foe?.id,e.foe))||5.5);
      if(!e.hostile&&!e.combatEvading&&playerDist<=detectTiles*TILE)this.markHostile(e,true);
      if(e.hostile||e.combatEvading){
        const homeX=Number(e.homeX)||((Number(e.homeTx)||0)+.5)*TILE,homeY=Number(e.homeY)||((Number(e.homeTy)||0)+.5)*TILE;
        // Secondary threats use the same range-aware territory idea as the
        // active target. A bow can legitimately kite farther than a dagger,
        // without allowing an enemy to be dragged indefinitely through the map.
        const rangeAllowanceTiles=clamp(Math.max(0,(Number(this.combatPlayerRange)||10)-10)/TILE*1.15,0,10),leash=(12+rangeAllowanceTiles)*TILE;
        if(!e.combatEvading&&Math.hypot(this.player.x-homeX,this.player.y-homeY)>leash){e.combatEvading=true;e.hostile=false;e.combatTelegraph='';}
        if(e.combatEvading){
          const dx=homeX-e.x,dy=homeY-e.y,len=Math.hypot(dx,dy)||1,step=Math.min(len,150*dt);if(step>0)this.moveWorldActor(e,dx/len*step,dy/len*step,10);
          if(len<8){e.x=homeX;e.y=homeY;e.targetX=homeX;e.targetY=homeY;e.combatEvading=false;e.hostile=false;e.combatTelegraph='';if(Number.isFinite(Number(e.combatHpMax)))e.combatHp=e.combatHpMax;if(e.combatLegacyState&&Number.isFinite(Number(e.combatLegacyState.hpMax)))e.combatLegacyState.hp=e.combatLegacyState.hpMax;}
          continue;
        }
        // A telegraphed Heavy is a commitment. Secondary hostiles must root in
        // place during the wind-up too; otherwise their red danger circle chases
        // the player and the dodge telegraph is functionally dishonest.
        if(e.combatTelegraph==='HEAVY')continue;
        const gap=this.combatSurfaceGap(e),dx=this.player.x-e.x,dy=this.player.y-e.y,len=Math.hypot(dx,dy)||1,desired=2;
        if(gap>desired){const step=Math.min(Math.max(0,gap-desired),Math.max(48,Number(e.speed)||80)*dt);if(step>0)this.moveWorldActor(e,dx/len*step,dy/len*step,10);}
        continue;
      }
      e.roamTimer-=dt;let dx=e.targetX-e.x,dy=e.targetY-e.y,dist=Math.hypot(dx,dy);
      if(e.roamTimer<=0||dist<2){this.pickRoamTarget(e);dx=e.targetX-e.x;dy=e.targetY-e.y;dist=Math.hypot(dx,dy);}
      if(dist>1){
        const step=Math.min(dist,e.speed*dt),nx=e.x+dx/dist*step,ny=e.y+dy/dist*step,ntx=Math.floor(nx/TILE),nty=Math.floor(ny/TILE),sidePlan=e.sidePlanId?this.sidePlanById(e.sidePlanId):null;
        const legal=sidePlan?(!this.collides(nx,ny,7)&&this.sidePlanCarvesFloor(sidePlan,ntx,nty)&&!this.hollowSafeZone(ntx,nty)&&!this.townEnemyExclusionAtTile(ntx,nty)&&!this.bossExclusionAtTile(ntx,nty)):(!this.collides(nx,ny,7)&&this.isSpawnAccessible(ntx,nty)&&!this.hollowSafeZone(ntx,nty)&&!this.townEnemyExclusionAtTile(ntx,nty)&&!this.bossExclusionAtTile(ntx,nty)&&!this.sideCarvesFloor(ntx,nty));
        if(legal){e.x=nx;e.y=ny;}else this.pickRoamTarget(e);
      }
    }
  }

  sidePlanById(id){
    const key=String(id||'');
    if(this.activeSidePlan?.id===key)return this.activeSidePlan;
    return this.persistentSidePlans.find(p=>p.id===key)||null;
  }

  sideEcologySpawnPoints(plan){
    if(!plan)return[];
    const seed=Number(plan.shapeSeed)||Math.floor(hash2(plan.mouthTx,plan.mouthTy,this.seed+3501)*1000000);
    const count=(Number(plan.generation||1)>=SIDE_VARIETY_GENERATION?3:2)+Math.floor(hash2(seed%100003,17,this.seed+3511)*3);
    const candidates=[];
    const g=Number(plan.generation||1)>=SIDE_NETWORK_GENERATION?this.sideNetworkGeometry(plan):null;
    if(g){
      // Prefer actual rooms first so groups visibly inhabit the interesting
      // spaces, then use remote segment midpoints if more bodies are needed.
      for(const r of g.rooms)candidates.push({tx:Math.round(r.x),ty:Math.round(r.y)});
      for(let i=0;i<g.segments.length;i++){
        const [a,b]=g.segments[i],t=.42+hash2(seed,i+19,this.seed+3527)*.24;
        candidates.push({tx:Math.round(a.x+(b.x-a.x)*t),ty:Math.round(a.y+(b.y-a.y)*t)});
      }
    }else{
      for(const u of [17,31,45]){const p=this.sidePoint(plan,u);candidates.push({tx:Math.round(p.tx),ty:Math.round(p.ty)});}
    }
    const out=[];
    for(let i=0;i<candidates.length&&out.length<count;i++){
      let {tx,ty}=candidates[(i*2+(seed%3))%candidates.length];
      // Tiny deterministic offset avoids enemies stacking on exact room centers.
      const ox=Math.floor(hash2(seed,i+41,this.seed+3533)*3)-1,oy=Math.floor(hash2(seed,i+53,this.seed+3541)*3)-1;
      if(this.sidePlanCarvesFloor(plan,tx+ox,ty+oy)){tx+=ox;ty+=oy;}
      if(!this.sidePlanCarvesFloor(plan,tx,ty)||this.isWall(tx,ty))continue;
      if(out.some(p=>Math.hypot(p.tx-tx,p.ty-ty)<4))continue;
      out.push({tx,ty,index:out.length});
    }
    return out;
  }

  sideEcologyEntities(ptx,pty,rx,ry){
    const out=[],seen=new Set(),plans=[];
    if(this.activeSidePlan){plans.push(this.activeSidePlan);seen.add(this.activeSidePlan.id);}
    for(const p of this.persistentSidePlans)if(p&&!seen.has(p.id)){seen.add(p.id);plans.push(p);}
    const goblins=this.getProfiles().filter(f=>/goblin/i.test(String(f?.name||'')));
    if(!goblins.length)return out;
    for(const plan of plans){
      if(!plan||Number(plan.depth||0)<this.sideOrganicStartDepth)continue;
      for(const sp of this.sideEcologySpawnPoints(plan)){
        if(Math.abs(sp.tx-ptx)>rx+5||Math.abs(sp.ty-pty)>ry+5)continue;
        const id=`sidefoe:${plan.id}:${sp.index}`;
        if(this.defeated.has(id)||id===this.combatEntityId)continue;
        const d=Math.max(0,depthFromY(sp.ty*TILE)),eligible=goblins.filter(f=>d>=Number(f.unlock||0));
        const pool=eligible.length?eligible:goblins,foe=pool[Math.floor(hash2(sp.tx,sp.ty,this.seed+3563)*pool.length)];
        if(!foe)continue;
        const e=this.getRoamer(id,sp.tx,sp.ty,foe);e.sidePlanId=String(plan.id);out.push(e);
      }
    }
    return out;
  }

  hollowPosition(depth){
    const p=this.hollowTile(depth);
    return{tx:p.tx,ty:p.ty,x:p.x,y:p.y};
  }

  scheduledHollows(ptx,pty,rx,ry){
    const out=[];
    const d0=Math.max(0,depthFromY((pty+ry+2)*TILE)-2);
    const d1=depthFromY((pty-ry-2)*TILE)+2;
    const firstK=Math.max(0,Math.floor((d0-ORDINARY_HOLLOW_FIRST)/ORDINARY_HOLLOW_GAP)-1);
    const lastK=Math.ceil((d1-ORDINARY_HOLLOW_FIRST)/ORDINARY_HOLLOW_GAP)+1;
    for(let k=firstK;k<=lastK;k++){
      const depth=ORDINARY_HOLLOW_FIRST+k*ORDINARY_HOLLOW_GAP;
      if(depth<0||depth<d0-HOLLOW_LOOKAHEAD||depth>d1+HOLLOW_LOOKAHEAD)continue;
      const id=`hollow:ordinary:${depth.toFixed(1)}`;
      if(this.opened.has(id))continue;
      const p=this.hollowPosition(depth);
      if(Math.abs(p.tx-ptx)<=rx+3&&Math.abs(p.ty-pty)<=ry+3)out.push({type:'hollow',kind:'ordinary',id,depth,...p});
    }
    const stratumStart=Math.max(0,Math.floor(d0/500)-1),stratumEnd=Math.ceil(d1/500)+1;
    for(let s=stratumStart;s<=stratumEnd;s++){
      const depth=(s+1)*500-8;
      if(depth<=0)continue;
      const id=`hollow:stage:${depth.toFixed(1)}`;
      if(this.opened.has(id))continue;
      const p=this.hollowPosition(depth);
      if(Math.abs(p.tx-ptx)<=rx+3&&Math.abs(p.ty-pty)<=ry+3)out.push({type:'hollow',kind:'stage',id,depth,...p});
    }
    return out;
  }

  worldEventEntities(ptx,pty,rx,ry){
    const out=[];
    for(const event of this.worldEvents){
      if(!event?.id||event.type==='sidepassage'||this.opened.has(`worldevent:${event.id}`))continue;
      if(['midboss','boss'].includes(event.type)){
        const actor=this.getBossActor(event);if(!actor||actor.id===this.combatEntityId)continue;
        const atx=Math.floor(actor.x/TILE),aty=Math.floor(actor.y/TILE);
        if(!actor.aggro&&(Math.abs(atx-ptx)>rx+6||Math.abs(aty-pty)>ry+6))continue;
        out.push(actor);continue;
      }
      const p=this.eventTile(event);
      if(Math.abs(p.tx-ptx)>rx+4||Math.abs(p.ty-pty)>ry+4)continue;
      out.push({type:event.type,id:`worldevent:${event.id}`,eventId:event.id,event,eventKind:event.type,tx:p.tx,ty:p.ty,x:(p.tx+.5)*TILE,y:(p.ty+.5)*TILE});
    }
    return out;
  }

  isChestCandidate(tx,ty){
    // One deterministic candidate per large sector, and only some sectors are
    // eligible at all. This replaces the old per-floor-tile roll that produced
    // piles of chests on a wide desktop viewport. Adjacent chests are therefore
    // naturally separated by roughly a screenful of local walking space.
    const size=CHEST_SECTOR_TILES;
    const sx=Math.floor(tx/size),sy=Math.floor(ty/size);
    if(hash2(sx,sy,this.seed+1777)>=CHEST_SECTOR_CHANCE)return false;
    const ox=2+Math.floor(hash2(sx,sy,this.seed+1781)*(size-4));
    const oy=2+Math.floor(hash2(sx,sy,this.seed+1789)*(size-4));
    return tx===sx*size+ox&&ty===sy*size+oy;
  }

  dynamicEntities(){
    const ptx=Math.floor(this.player.x/TILE),pty=Math.floor(this.player.y/TILE),{rx,ry}=this.entityRadii(),out=[];
    for(let ty=pty-ry;ty<=pty+ry;ty++)for(let tx=ptx-rx;tx<=ptx+rx;tx++){
      if(this.isWall(tx,ty))continue;
      const d=depthFromY(ty*TILE);
      if(d<3)continue;
      const n=hash2(tx,ty,this.seed+777),bossExclusion=this.bossExclusionAtTile(tx,ty),authoredZone=this.townSafeZone(tx,ty)||!!this.sideCarvesFloor(tx,ty);
      // Procedural clutter stays out of authored settlement and Side Passage
      // geometry for now. Passage-event content is parked and will be repopulated
      // deliberately later rather than by incidental world spawns.
      if(!authoredZone&&!bossExclusion&&this.isChestCandidate(tx,ty)){
        const id=this.entityId('chest',tx,ty);
        if(!this.opened.has(id)&&!this.hollowSafeZone(tx,ty)&&this.isSpawnAccessible(tx,ty))out.push({type:'chest',id,tx,ty,x:(tx+.5)*TILE,y:(ty+.5)*TILE});
      }
      if(!authoredZone&&!bossExclusion&&n>.951&&n<.955){
        const id=this.entityId('glint',tx,ty);
        if(!this.opened.has(id)&&this.isSpawnAccessible(tx,ty))out.push({type:'glint',id,tx,ty,x:(tx+.5)*TILE,y:(ty+.5)*TILE});
      }
    }

    out.push(...this.ordinaryEcologyEntities(ptx,pty,rx,ry));
    out.push(...this.sideEcologyEntities(ptx,pty,rx,ry));
    out.push(...this.scheduledHollows(ptx,pty,rx,ry));
    out.push(...this.worldEventEntities(ptx,pty,rx,ry));
    out.push(...this.sideEntities());
    out.push(...this.townEntities(ptx,pty,rx,ry));

    for(const bag of this.lootBags.values()){
      const btx=Math.floor(bag.x/TILE),bty=Math.floor(bag.y/TILE);
      if(Math.abs(btx-ptx)<=rx&&Math.abs(bty-pty)<=ry)out.push(bag);
    }


    const keepRx=Math.ceil(rx*ROAMER_RETENTION_MULTIPLIER),keepRy=Math.ceil(ry*ROAMER_RETENTION_MULTIPLIER);
    for(const[id,e]of this.roamers){
      if(Math.abs(e.homeTx-ptx)>keepRx||Math.abs(e.homeTy-pty)>keepRy)this.roamers.delete(id);
    }
    return out;
  }

  updateNearby(entities=this.activeEntities){
    // Creature targeting is pointer-driven. Nearby interaction remains for loot,
    // camps and world objects; hostile pressure suppresses noncombat interactions.
    if(this.hasActiveThreats()){this.nearby=null;this.onInteract?.(null,null);return;}
    let best=null,bestD=Infinity;
    for(const e of entities){const d=Math.hypot(e.x-this.player.x,e.y-this.player.y);if(d<bestD){bestD=d;best=e;}}
    this.nearby=bestD<40?best:null;
    if(this.nearby?.type==='loot'&&bestD<13&&this.inputEnabled){this.onLoot?.(this.nearby);return;}
    if(this.nearby&&bestD<40){
      const label={chest:'Open chest',glint:'Investigate',hollow:'Use Safe Hollow',signpost:'Read sign',foe:'Target',loot:'Loot',caravan:'Approach caravan',merchant:'Approach merchant','rescue-tracks':'Inspect tracks','rescue-satchel':'Inspect satchel','rescue-hideout':'Approach refuge','escort-pursuit':'Face the movement','quest-target':'Approach destination',midboss:'Target foe',boss:'Target guardian','side-stage':'Face obstacle','side-finale':'Inspect end chamber',townlocation:this.nearby.location?.departure?'Use Lower Gate':`Enter ${this.nearby.location?.name||'building'}`}[this.nearby.type];
      this.onInteract?.(this.nearby,label);
    }else this.onInteract?.(null,null);
  }

  interact(){
    const e=this.nearby;
    if(!e)return false;
    if(e.type==='foe')return{type:'target',entity:e};
    if(e.type==='loot')return{type:'loot',entity:e,recordId:e.recordId};
    if(e.type==='chest'){this.opened.add(e.id);this.spawnText(e.x,e.y,'LOOT');return{type:'chest',entity:e,depth:depthFromY(e.y)};}
    if(e.type==='glint'){this.opened.add(e.id);this.spawnText(e.x,e.y,'FOUND');return{type:'glint',entity:e,depth:depthFromY(e.y)};}
    if(e.type==='hollow'){this.opened.add(e.id);return{type:'hollow',entity:e,depth:e.depth??depthFromY(e.y),kind:e.kind||'ordinary'};}
    if(e.type==='signpost'){this.opened.add(e.id);const place=e.town?.name||'Settlement',depth=Number(e.town?.depth||0).toFixed(0);this.onToast?.(e.signKind==='approach'?`${place} · ${depth} fathoms · follow the road ahead`:`${place} · ${depth} fathoms`);return{type:'signpost',entity:e};}
    if(e.type==='townlocation')return{type:'townlocation',entity:e,location:e.location,town:e.town};
    if(e.type==='side-stage')return{type:'side-stage',entity:e,stage:e.stage};
    if(e.type==='side-finale')return{type:'side-finale',entity:e};
    if(['caravan','merchant','rescue-tracks','rescue-satchel','rescue-hideout','escort-pursuit','quest-target','midboss','boss'].includes(e.type)){
      // Rescue clues and quest destinations disappear when the canonical legacy
      // state marks them resolved. Do not hide them merely because the player
      // opened the interaction once.
      if(['caravan','merchant'].includes(e.type))this.opened.add(e.id);
      return{type:'worldevent',entity:e,eventId:e.eventId,eventKind:e.type,depth:Number(e.event?.depth)||depthFromY(e.y)};
    }
    return false;
  }

  look(){
    const e=this.nearby;
    if(e?.type==='foe')this.onToast?.(`${e.foe.name}. It has not yet committed to a fight.`);
    else if(e)this.onToast?.({
      loot:'A small bag lies where the goblin fell.',
      chest:'An old chest wedged against the stone.',
      glint:'Something catches the lantern-light.',
      hollow:e.kind==='stage'?'A sheltered outcropping waits before the boundary.':'A small protected outcropping makes defensible camp ground.',
      signpost:e.signKind==='approach'?`A wooden post reads ${e.town?.name||'a settlement'} and points along the approach road.`:`The wooden sign marks ${e.town?.name||'a settlement'}.`,
      'rescue-tracks':'Fresh tracks leave the main route and disappear into the stone shadows.',
      'rescue-satchel':'A battered medicine satchel lies where someone dropped it in haste.',
      'rescue-hideout':'A cramped refuge has been cut into a side recess. Something moved near the entrance.',
      'escort-pursuit':'Movement follows the route behind you. Your companion has gone quiet.',
      'quest-target':'This looks like the place named in your contract.',
      midboss:'An oversized goblin prowls the ordinary cavern ahead.',boss:'A guardian physically bars the stratum boundary.',
      'side-stage':'Something blocks further progress through the passage.',
      'side-finale':'The passage opens into a deliberate end chamber.',
      caravan:'A wagon and its crew occupy a natural widening in the cavern.',
      merchant:'A trader has made camp beside the route.',
      townlocation:e.location?.departure?'The lower gate opens onto the road deeper into the dark.':`${e.location?.name||'A building'} stands within ${e.town?.name||'the settlement'}.`
    }[e.type]||'Something is here.');
    else this.onToast?.('Stone, damp air, and the way upward into deeper dark.');
  }

  beginCombatEntity(entity,{hostile=false,autoApproach=false}={}){
    if(!entity)return;this.combat=true;this.combatEntityId=entity.id;
    const homeX=Number.isFinite(Number(entity.homeX))?Number(entity.homeX):(Number.isFinite(Number(entity.spawnX))?Number(entity.spawnX):Number(entity.x)||0),homeY=Number.isFinite(Number(entity.homeY))?Number(entity.homeY):(Number.isFinite(Number(entity.spawnY))?Number(entity.spawnY):Number(entity.y)||0);
    this.combatFoe={...entity,x:entity.x,y:entity.y,combatHomeX:homeX,combatHomeY:homeY,combatHp:Number.isFinite(Number(entity.combatHp))?Number(entity.combatHp):null,combatHpMax:Number.isFinite(Number(entity.combatHpMax))?Number(entity.combatHpMax):null,combatTelegraph:'',combatEvading:false,hostile:!!(hostile||entity.hostile),renderOffsetX:0,renderOffsetY:0};
    this.autoApproach=!!autoApproach;
  }
  stashCombatTarget(legacyState=null){
    const f=this.combatFoe,id=this.combatEntityId;if(!f||!id){this.setCombat(false);return null;}
    const source=this.roamers.get(id)||this.bossActors.get(id);
    if(source){source.x=f.x;source.y=f.y;source.hostile=!!f.hostile;source.combatHp=Number.isFinite(Number(f.combatHp))?Number(f.combatHp):source.combatHp;source.combatHpMax=Number.isFinite(Number(f.combatHpMax))?Number(f.combatHpMax):source.combatHpMax;source.combatLegacyState=legacyState||source.combatLegacyState||null;source.combatTelegraph='';source.combatEvading=false;}
    this.combat=false;this.combatFoe=null;this.combatEntityId=null;this.autoApproach=false;this.playerReachGuideVisible=false;return source||null;
  }

  // Retained as a no-op compatibility hook for older bridge code. Physical
  // combat must never relocate either participant just to stage a fight.
  positionCombatants(){}

  combatTerritory(playerRange=32){
    const f=this.combatFoe;if(!f)return{inside:true,homeX:this.player.x,homeY:this.player.y,limitPx:Infinity,kind:'none'};
    const homeX=Number(f.combatHomeX)||Number(f.x)||0,homeY=Number(f.combatHomeY)||Number(f.y)||0;
    const rangeAllowanceTiles=clamp(Math.max(0,(Number(playerRange)||10)-10)/TILE*1.15,0,10);
    if(f.type==='boss'){
      const plan=this.bossPlanForEvent(f.event);
      if(plan){
        const cx=(plan.centerTx+.5)*TILE,cy=(plan.ty+.5)*TILE;
        const halfW=(BOSS_ROOM_HALF_W_TILES+.75)*TILE,halfH=(BOSS_ROOM_HALF_H_TILES+1.5)*TILE;
        return{inside:Math.abs(this.player.x-cx)<=halfW&&Math.abs(this.player.y-cy)<=halfH,homeX,homeY,limitPx:Math.max(halfW,halfH),kind:'boss-room'};
      }
    }
    const baseTiles=f.type==='midboss'?46:12;
    const limitPx=(baseTiles+rangeAllowanceTiles)*TILE;
    return{inside:Math.hypot(this.player.x-homeX,this.player.y-homeY)<=limitPx,homeX,homeY,limitPx,kind:f.type==='midboss'?'midboss':'roamer'};
  }

  resetCombatSource(id=this.combatEntityId){
    if(!id)return;
    const roamer=this.roamers.get(id);
    if(roamer){
      roamer.x=Number(roamer.homeX)||((Number(roamer.homeTx)||0)+.5)*TILE;
      roamer.y=Number(roamer.homeY)||((Number(roamer.homeTy)||0)+.5)*TILE;
      roamer.targetX=roamer.x;roamer.targetY=roamer.y;roamer.pause=0;
      return;
    }
    const actor=this.bossActors.get(id);
    if(actor){actor.x=Number(actor.spawnX)||actor.x;actor.y=Number(actor.spawnY)||actor.y;actor.aggro=false;actor.tx=Math.floor(actor.x/TILE);actor.ty=Math.floor(actor.y/TILE);}
  }

  endCombat({defeated=false}={}){
    if(defeated&&this.combatEntityId){this.defeated.add(this.combatEntityId);this.roamers.delete(this.combatEntityId);}
    this.combat=false;this.combatFoe=null;this.combatEntityId=null;this.combatPlayerRange=10;this.combatPlayerMelee=true;this.combatPlayerInRange=false;this.combatEnemyThreatRange=10;this.combatThreatActive=false;this.autoApproach=false;
  }

  bumpPlayer(text=''){if(!this.combatFoe)return;this.bump(this.player,this.combatFoe,12,.20,()=>{if(text)this.spawnText(this.combatFoe.x,this.combatFoe.y,text);});}
  bumpFoe(text=''){if(!this.combatFoe)return;this.bump(this.combatFoe,this.player,12,.20,()=>{if(text)this.spawnText(this.player.x,this.player.y,text);});}
  bump(attacker,target,amount=12,duration=.20,onImpact){
    const dx=target.x-attacker.x,dy=target.y-attacker.y,len=Math.hypot(dx,dy)||1;
    this.animations.push({who:attacker,dx:dx/len*amount,dy:dy/len*amount,t:0,duration,impact:false,onImpact});
  }

  updateAnimations(dt){
    for(const a of this.animations){
      a.t+=dt;
      const p=clamp(a.t/a.duration,0,1),wave=Math.sin(p*Math.PI);
      a.who.renderOffsetX=a.dx*wave;a.who.renderOffsetY=a.dy*wave;
      if(!a.impact&&p>=.45){a.impact=true;a.onImpact?.();}
    }
    this.animations=this.animations.filter(a=>{
      if(a.t<a.duration)return true;
      a.who.renderOffsetX=0;a.who.renderOffsetY=0;return false;
    });
  }

  spawnText(x,y,text,tone='player'){this.particles.push({x,y,text,tone,life:1.1,max:1.1});}
  updateParticles(dt){for(const p of this.particles)p.life-=dt;this.particles=this.particles.filter(p=>p.life>0);}
  worldToScreen(x,y){return{x:(x-this.camera.x)+this.logicalViewW()/2,y:(y-this.camera.y)+this.logicalViewH()/2};}

  draw(){
    const c=this.ctx,w=this.logicalViewW(),h=this.logicalViewH();
    if(!w||!h)return;
    c.setTransform((this.dpr||1)*(this.zoom||1),0,0,(this.dpr||1)*(this.zoom||1),0,0);
    c.imageSmoothingEnabled=false;
    c.fillStyle='#020507';c.fillRect(0,0,w,h);
    const left=this.camera.x-w/2,top=this.camera.y-h/2;
    const tx0=Math.floor(left/TILE)-1,tx1=Math.ceil((left+w)/TILE)+1,ty0=Math.floor(top/TILE)-1,ty1=Math.ceil((top+h)/TILE)+1;
    for(let ty=ty0;ty<=ty1;ty++)for(let tx=tx0;tx<=tx1;tx++)this.drawTile(tx,ty);
    this.drawBossChambers(ty0,ty1);
    this.drawWorldEventRoutes();
    this.drawActiveSideRoute();
    this.drawTownOverlays();
    this.drawCombatRangeGuide();
    // Depth-sort world actors against the delver. This matters for the enlarged
    // 250-fathom miniboss: whichever sprite is physically lower on screen should
    // render in front instead of the goblin always swallowing the player.
    const sorted=this.activeEntities.filter(e=>e?.id!==this.combatEntityId).map(e=>({entity:e,combat:false}));
    if(this.combatFoe)sorted.push({entity:this.combatFoe,combat:true});
    sorted.sort((a,b)=>(a.entity?.y||0)-(b.entity?.y||0));
    let drewPlayer=false;
    for(const item of sorted){
      const e=item.entity;
      if(!drewPlayer&&(e.y||0)>this.player.y){this.drawCompanion();this.drawPlayer();drewPlayer=true;}
      if(item.combat)this.drawCombatFoe(e);else this.drawEntity(e);
    }
    if(!drewPlayer){this.drawCompanion();this.drawPlayer();}
    for(const p of this.particles)this.drawParticle(p);
    this.drawDepthDirection();
  }

  drawTile(tx,ty){
    const c=this.ctx,s=this.worldToScreen(tx*TILE,ty*TILE),wall=this.isWall(tx,ty),depth=depthFromY(ty*TILE),si=stratumIndex(depth)%4,n=hash2(tx,ty,this.seed+si*31);
    if(wall){
      const cols=['#10171b','#11181c','#15181b','#11161a'];
      c.fillStyle=cols[si];c.fillRect(Math.floor(s.x),Math.floor(s.y),TILE+1,TILE+1);
      c.fillStyle=n>.52?'#1b2429':'#172025';c.fillRect(Math.floor(s.x+2),Math.floor(s.y+2),TILE-4,3);
      if(n>.86){c.fillStyle='#283239';c.fillRect(Math.floor(s.x+5),Math.floor(s.y+10),2,7);c.fillRect(Math.floor(s.x+7),Math.floor(s.y+15),5,2);}
      // A subtle exposed-rock edge makes collision boundaries readable rather than
      // feeling like invisible walls against the near-black floor.
      const floorBelow=!this.isWall(tx,ty+1),floorAbove=!this.isWall(tx,ty-1),floorLeft=!this.isWall(tx-1,ty),floorRight=!this.isWall(tx+1,ty);
      c.fillStyle='rgba(96,112,118,.20)';
      if(floorBelow)c.fillRect(Math.floor(s.x),Math.floor(s.y+TILE-2),TILE,2);
      if(floorAbove)c.fillRect(Math.floor(s.x),Math.floor(s.y),TILE,2);
      if(floorLeft)c.fillRect(Math.floor(s.x),Math.floor(s.y),2,TILE);
      if(floorRight)c.fillRect(Math.floor(s.x+TILE-2),Math.floor(s.y),2,TILE);
    }else{
      const cols=['#080d10','#091013','#0c1012','#090d10'];
      c.fillStyle=cols[si];c.fillRect(Math.floor(s.x),Math.floor(s.y),TILE+1,TILE+1);
      if(n>.82){c.fillStyle='#152026';c.fillRect(Math.floor(s.x+4),Math.floor(s.y+7),2,2);c.fillRect(Math.floor(s.x+15),Math.floor(s.y+14),3,1);}
      if(n<.05){c.fillStyle='#24332f';c.fillRect(Math.floor(s.x+10),Math.floor(s.y+12),2,4);c.fillStyle='#466052';c.fillRect(Math.floor(s.x+8),Math.floor(s.y+10),6,2);}
    }
  }

  drawBossChambers(ty0,ty1){
    const c=this.ctx,midTy=Math.floor((ty0+ty1)/2),range=Math.max(24,Math.ceil(Math.abs(ty1-ty0)/2)+18);
    for(const plan of this.bossPlansNearTy(midTy,range)){
      if(plan.kind==='midboss')continue;
      const center=this.worldToScreen((plan.centerTx+.5)*TILE,(plan.ty+.5)*TILE);
      if(center.x<-TILE*14||center.x>this.logicalViewW()+TILE*14||center.y<-TILE*14||center.y>this.logicalViewH()+TILE*14)continue;
      // Subtle floor mark makes the chamber read as a deliberate arena without
      // introducing decorative objects that look solid but are not collision.
      c.save();c.globalAlpha=.16;c.strokeStyle=plan.kind==='boss'?'#9d6f45':'#758463';c.lineWidth=2;
      c.strokeRect(Math.round(center.x-TILE*3),Math.round(center.y-TILE*2),TILE*6,TILE*4);
      c.globalAlpha=.10;c.fillStyle=plan.kind==='boss'?'#8b5f3b':'#65744f';c.fillRect(Math.round(center.x-TILE*2.5),Math.round(center.y-2),TILE*5,4);c.fillRect(Math.round(center.x-2),Math.round(center.y-TILE*1.5),4,TILE*3);c.restore();
      const event=this.activeBossEventForPlan(plan),gate=this.worldToScreen((plan.centerTx+.5)*TILE,(plan.gateTy+.5)*TILE),w=BOSS_GATE_HALF_WIDTH_TILES*TILE*2;
      c.save();
      if(event){
        c.fillStyle='#1e2528';c.fillRect(Math.round(gate.x-w/2),Math.round(gate.y-5),Math.round(w),10);
        c.fillStyle='#596166';for(let x=gate.x-w/2+5;x<gate.x+w/2-2;x+=10)c.fillRect(Math.round(x),Math.round(gate.y-12),4,24);
        c.fillStyle='#8f7148';c.fillRect(Math.round(gate.x-w/2),Math.round(gate.y-2),Math.round(w),4);
      }else{
        c.fillStyle='#343b3d';c.fillRect(Math.round(gate.x-w/2),Math.round(gate.y+5),18,5);c.fillRect(Math.round(gate.x+w/2-18),Math.round(gate.y-4),18,5);
      }
      c.restore();
    }
  }

  drawWorldEventRoutes(){
    const c=this.ctx;
    for(const event of this.worldEvents){
      if(!event||event.type!=='rescue-hideout')continue;
      const p=this.eventTile(event),startTx=p.center,endTx=p.tx,step=endTx>=startTx?1:-1;
      const routeY=this.worldToScreen((startTx+.5)*TILE,(p.ty+.5)*TILE).y;
      if(routeY<-40||routeY>this.logicalViewH()+40)continue;
      // IMPORTANT: never iterate until `tx === endTx` while stepping by 2.
      // Side-passage mouths are 15 tiles from the spine, so an equality loop can
      // never hit the odd endpoint and will lock the renderer forever. Iterate a
      // bounded distance instead, which is safe for both odd and even offsets.
      const routeDistance=Math.abs(endTx-startTx);
      for(let offset=2;offset<routeDistance;offset+=2){
        const tx=startTx+step*offset,q=this.worldToScreen((tx+.5)*TILE,(p.ty+.5)*TILE);
        if(q.x<-20||q.x>this.logicalViewW()+20||q.y<-20||q.y>this.logicalViewH()+20)continue;
        c.fillStyle='rgba(112,132,128,.18)';
        c.fillRect(Math.round(q.x-4),Math.round(q.y-1),8,2);
      }
      const mouthTx=startTx+step*3,m=this.worldToScreen((mouthTx+.5)*TILE,(p.ty+.5)*TILE);
      if(m.x>-30&&m.x<this.logicalViewW()+30&&m.y>-30&&m.y<this.logicalViewH()+30){
        c.fillStyle='#222d31';c.fillRect(Math.round(m.x-7),Math.round(m.y-11),4,22);c.fillRect(Math.round(m.x+3),Math.round(m.y-11),4,22);c.fillRect(Math.round(m.x-7),Math.round(m.y-13),14,4);
        c.fillStyle='rgba(108,148,143,.30)';c.fillRect(Math.round(m.x-2),Math.round(m.y-5),4,10);
      }
    }
  }

  drawActiveSideRoute(){
    const plan=this.sidePlan();if(!plan)return;
    const c=this.ctx;
    for(let u=2;u<=plan.lengthTiles;u+=3){
      const p=this.sidePoint(plan,u),s=this.worldToScreen(p.x,p.y);
      if(s.x<-20||s.x>this.logicalViewW()+20||s.y<-20||s.y>this.logicalViewH()+20)continue;
      c.fillStyle='rgba(153,119,74,.18)';c.fillRect(Math.round(s.x-5),Math.round(s.y-1),10,2);
    }
    const mouth=this.sidePoint(plan,0),m=this.worldToScreen(mouth.x,mouth.y);
    if(m.x>-40&&m.x<this.logicalViewW()+40&&m.y>-40&&m.y<this.logicalViewH()+40){
      c.fillStyle='#222d31';c.fillRect(Math.round(m.x-8),Math.round(m.y-12),4,24);c.fillRect(Math.round(m.x+4),Math.round(m.y-12),4,24);c.fillRect(Math.round(m.x-8),Math.round(m.y-14),16,4);
      c.fillStyle='rgba(180,139,79,.30)';c.fillRect(Math.round(m.x-2),Math.round(m.y-6),4,12);
    }
  }

  updateCompanion(dt){
    const data=this.getCompanion?.();
    if(!data||data.status!=='following'||data.hiddenForCombat){this.companionVisual.ready=false;return;}
    const v=this.companionVisual;
    let ox=0,oy=21;
    if(this.player.dir==='down')oy=-21;else if(this.player.dir==='left'){ox=21;oy=4;}else if(this.player.dir==='right'){ox=-21;oy=4;}
    let tx=this.player.x+ox,ty=this.player.y+oy;
    const blocked=this.collides(tx,ty,5);
    if(blocked){tx=this.player.x+(oy?18:0);ty=this.player.y+8;}
    if(!v.ready||v.id!==data.id){v.x=tx;v.y=ty;v.ready=true;v.id=data.id;}
    const k=1-Math.pow(.003,dt);v.x+=(tx-v.x)*k;v.y+=(ty-v.y)*k;
    v.data=data;
  }

  drawCompanion(){
    const v=this.companionVisual;if(!v.ready||!v.data)return;
    const c=this.ctx,s=this.worldToScreen(v.x,v.y),bob=Math.sin(this.time*8+1.7)*.7;
    c.save();c.translate(Math.round(s.x),Math.round(s.y+bob));
    c.fillStyle='rgba(0,0,0,.48)';c.fillRect(-7,8,14,3);
    c.fillStyle='#445c5d';c.fillRect(-5,-5,10,12);c.fillStyle='#b9a184';c.fillRect(-3,-9,6,5);c.fillStyle='#242b2c';c.fillRect(-4,-10,8,2);
    if(this.companionTorch.ready){const img=this.companionTorch.img,max=26,scale=Math.min(max/img.naturalWidth,max/img.naturalHeight),ww=Math.max(1,Math.round(img.naturalWidth*scale)),hh=Math.max(1,Math.round(img.naturalHeight*scale));c.imageSmoothingEnabled=false;c.drawImage(img,6,-10,ww,hh);}
    else{c.fillStyle='#d69445';c.fillRect(7,-4,3,8);c.fillStyle='#f0b85e';c.fillRect(6,-8,5,5);}
    c.restore();
  }

  drawTownOverlays(){
    for(const t of this.townPlans()){
      const s=this.worldToScreen(t.originX,t.originY),margin=Math.max(t.layoutW,t.layoutH);
      if(s.x<-margin||s.x>this.logicalViewW()+margin||s.y<-margin||s.y>this.logicalViewH()+margin)continue;
      this.drawTownPlan(t);
    }
  }

  drawTownPlan(t){
    const c=this.ctx,center=this.worldToScreen(t.originX,t.originY);
    c.save();
    c.globalAlpha=.16;c.fillStyle='#6d624e';c.beginPath();c.ellipse(center.x,center.y,t.layoutW*.58,t.layoutH*.56,0,0,Math.PI*2);c.fill();c.globalAlpha=1;
    const roadTop=this.worldToScreen(t.originX-TOWN_TILE*1.35,t.deepRoadEndY),roadBottom=this.worldToScreen(t.originX+TOWN_TILE*1.35,t.entryY+TOWN_TILE*2.2);
    c.fillStyle='rgba(85,72,52,.28)';c.fillRect(Math.round(roadTop.x),Math.round(roadTop.y),Math.round(roadBottom.x-roadTop.x),Math.round(roadBottom.y-roadTop.y));

    // Physical perimeter wall. The shallow and deep gate gaps are the only ways
    // through the settlement wall; collision uses the exact same rectangles.
    for(const wall of t.wallSegs){
      const p=this.worldToScreen(wall.x-wall.w/2,wall.y-wall.h/2);
      c.fillStyle='#20282c';c.fillRect(Math.round(p.x),Math.round(p.y),Math.round(wall.w),Math.round(wall.h));
      c.fillStyle='rgba(107,119,120,.34)';
      if(wall.w>wall.h)c.fillRect(Math.round(p.x),Math.round(p.y),Math.round(wall.w),3);
      else c.fillRect(Math.round(p.x),Math.round(p.y),3,Math.round(wall.h));
    }
    const shallow=this.worldToScreen(t.originX,t.shallowGateY),gate=this.worldToScreen(t.originX,t.deepGateY);
    c.fillStyle='#394044';
    c.fillRect(Math.round(shallow.x-TOWN_GATE_HALF_WIDTH-5),Math.round(shallow.y-9),6,19);c.fillRect(Math.round(shallow.x+TOWN_GATE_HALF_WIDTH-1),Math.round(shallow.y-9),6,19);
    c.fillRect(Math.round(gate.x-TOWN_GATE_HALF_WIDTH-5),Math.round(gate.y-9),6,19);c.fillRect(Math.round(gate.x+TOWN_GATE_HALF_WIDTH-1),Math.round(gate.y-9),6,19);
    const lowerClosed=!t.departed||this.sealedTownGates.has(t.id);
    if(lowerClosed){
      c.fillStyle=t.departed?'#62513f':'#8d7149';c.fillRect(Math.round(gate.x-TOWN_GATE_HALF_WIDTH),Math.round(gate.y-4),Math.round(TOWN_GATE_HALF_WIDTH*2),8);
      c.fillStyle='#b68d4f';for(let gx=gate.x-TOWN_GATE_HALF_WIDTH+6;gx<gate.x+TOWN_GATE_HALF_WIDTH-3;gx+=10)c.fillRect(Math.round(gx),Math.round(gate.y-10),3,20);
    }

    for(const building of t.buildings)this.drawTownBuilding(building,t);
    for(const stall of t.stalls){const p=this.worldToScreen(stall.x-stall.w/2,stall.y-stall.h/2);c.fillStyle='#4a3828';c.fillRect(Math.round(p.x),Math.round(p.y),stall.w,stall.h);c.fillStyle='#8b7047';c.fillRect(Math.round(p.x),Math.round(p.y),stall.w,4);}
    const lamps=[[t.originX-t.layoutW*.24,t.originY+t.layoutH*.20],[t.originX+t.layoutW*.25,t.originY+t.layoutH*.22],[t.originX-t.layoutW*.19,t.originY-t.layoutH*.27],[t.originX+t.layoutW*.20,t.originY-t.layoutH*.24]];
    for(const [x,y] of lamps){const p=this.worldToScreen(x,y);c.fillStyle='#6e5030';c.fillRect(Math.round(p.x-1),Math.round(p.y-3),3,10);c.fillStyle='#e1b65d';c.fillRect(Math.round(p.x-3),Math.round(p.y-7),7,6);c.globalAlpha=.09;c.fillRect(Math.round(p.x-11),Math.round(p.y-15),23,22);c.globalAlpha=1;}
    const folk=[[-58,38],[62,55],[-18,-45],[74,-28]];
    for(const [ox,oy] of folk){const p=this.worldToScreen(t.originX+ox*(t.kind==='city'?1.2:1),t.originY+oy*(t.kind==='city'?1.12:1));c.fillStyle='#777060';c.fillRect(Math.round(p.x-3),Math.round(p.y-5),6,10);c.fillStyle='#a69472';c.fillRect(Math.round(p.x-2),Math.round(p.y-8),4,4);}

    // Settlement identity is presented as a screen-space arrival title by the
    // world bridge. Never paint the settlement name onto cavern terrain.
    c.restore();
  }

  drawTownBuilding(b,t){
    const c=this.ctx,p=this.worldToScreen(b.x-b.w/2,b.y-b.h/2),loc=t.locations.find(l=>l.id===b.id);
    c.fillStyle=b.id==='guild'?'#25272a':'#292821';c.fillRect(Math.round(p.x),Math.round(p.y),b.w,b.h);
    c.fillStyle='#4c4a3d';c.fillRect(Math.round(p.x),Math.round(p.y),b.w,5);
    c.fillStyle='#151a1b';c.fillRect(Math.round(p.x+b.w/2-8),Math.round(p.y+b.h-16),16,16);
    c.fillStyle='#d1a354';c.fillRect(Math.round(p.x+8),Math.round(p.y+12),5,6);c.fillRect(Math.round(p.x+b.w-13),Math.round(p.y+12),5,6);
    // Building labels are local signage, not floating map labels. Only show them
    // when the delver is close enough to plausibly read the sign.
    if(Math.hypot(this.player.x-b.x,this.player.y-b.y)<=TOWN_TILE*9){
      c.save();c.textAlign='center';c.font='8px monospace';c.fillStyle='#a9a292';c.fillText((loc?.name||b.id).toUpperCase(),Math.round(p.x+b.w/2),Math.round(p.y-4));c.restore();
    }
  }

  drawFoeSprite(id,x,y,bob=0,visualScale=1){
    const c=this.ctx,sprite=this.getFoeSprite(id),size=FOE_SPRITE_SIZE*Math.max(.5,Number(visualScale)||1);
    c.save();c.translate(Math.round(x),Math.round(y+bob));
    c.fillStyle='rgba(0,0,0,.5)';c.fillRect(-10*visualScale,11,20*visualScale,3);
    if(sprite){
      const scale=Math.min(size/sprite.naturalWidth,size/sprite.naturalHeight),w=Math.max(1,Math.round(sprite.naturalWidth*scale)),h=Math.max(1,Math.round(sprite.naturalHeight*scale));
      c.imageSmoothingEnabled=false;c.drawImage(sprite,Math.round(-w/2),Math.round(11-h),w,h);
    }else{
      c.fillStyle='#6c7e55';c.fillRect(-7,-6,14,13);c.fillStyle='#879565';c.fillRect(-5,-9,10,5);c.fillStyle='#111';c.fillRect(-3,-6,2,2);c.fillRect(2,-6,2,2);c.fillStyle='#8e5b39';c.fillRect(-8,6,5,4);c.fillRect(3,6,5,4);
    }
    c.restore();
  }

  drawBossSprite(x,y,aggro=false,bob=0){
    const c=this.ctx,scale=1.55;c.save();c.translate(Math.round(x),Math.round(y+bob));c.scale(scale,scale);
    c.fillStyle='rgba(0,0,0,.55)';c.fillRect(-12,12,24,4);c.fillStyle='#85684b';c.fillRect(-9,-8,18,20);c.fillStyle='#a5835a';c.fillRect(-7,-13,14,7);
    c.fillStyle=aggro?'#e24e39':'#b64635';c.fillRect(-4,-9,2,2);c.fillRect(3,-9,2,2);c.fillStyle='#5a493a';c.fillRect(-13,3,7,5);c.fillRect(6,3,7,5);c.restore();
  }

  drawHollow(s,stage=false){
    const c=this.ctx,x=Math.round(s.x),y=Math.round(s.y);
    c.save();
    c.fillStyle='rgba(0,0,0,.42)';c.fillRect(x-13,y+8,26,3);
    // The terrain itself now forms the shelter. Do not paint a rectangular rock
    // frame around every Camp: that was the strongest source of the square-room
    // look even when the underlying cavern geometry was irregular.
    const stones=[[-12,2,4,3],[-9,6,3,2],[11,1,4,3],[8,7,3,2],[-4,-11,5,3],[5,-10,4,3]];
    c.fillStyle=stage?'#33322b':'#2b3032';
    for(const [ox,oy,sw,sh] of stones)c.fillRect(x+ox,y+oy,sw,sh);
    c.fillStyle='#3d4547';c.fillRect(x-11,y+2,2,2);c.fillRect(x+12,y+1,2,2);
    // Fire ring + fire.
    c.fillStyle='#62605a';c.fillRect(x-7,y+4,4,3);c.fillRect(x+3,y+4,4,3);c.fillRect(x-2,y+6,4,2);
    c.fillStyle='#8a4b2d';c.fillRect(x-4,y-1,8,7);
    c.fillStyle='#d6763a';c.fillRect(x-3,y-5,6,8);
    c.fillStyle='#e8b65e';c.fillRect(x-1,y-8,3,7);
    c.globalAlpha=.16+.05*Math.sin(this.time*5);c.fillStyle='#e6a64e';c.fillRect(x-13,y-13,26,24);
    c.restore();
  }

  drawCaravan(s,event){
    const c=this.ctx,x=Math.round(s.x),y=Math.round(s.y),merchant=event?.type==='merchant';
    c.save();
    c.fillStyle='rgba(0,0,0,.48)';c.fillRect(x-19,y+8,38,4);
    c.fillStyle=merchant?'#4c4435':'#59442e';c.fillRect(x-15,y-8,25,13);
    c.fillStyle='#7d6240';c.fillRect(x-12,y-12,19,5);
    c.fillStyle='#2b2520';c.fillRect(x-13,y+3,6,6);c.fillRect(x+4,y+3,6,6);
    c.fillStyle='#9c8055';c.fillRect(x-20,y-4,7,4);c.fillRect(x+10,y-5,8,4);
    if(merchant){c.fillStyle='#5d95dc';c.fillRect(x+13,y-12,3,7);c.globalAlpha=.35;c.fillRect(x+10,y-15,9,10);}
    c.restore();
  }

  drawSidePassage(s,event){
    const c=this.ctx,x=Math.round(s.x),y=Math.round(s.y),pulse=.12+.05*Math.sin(this.time*3);
    c.save();
    c.fillStyle='#030608';c.fillRect(x-11,y-11,22,23);
    c.fillStyle='#1f292d';c.fillRect(x-14,y-12,5,25);c.fillRect(x+9,y-12,5,25);c.fillRect(x-10,y-15,20,5);
    c.fillStyle='#364248';c.fillRect(x-13,y-10,3,7);c.fillRect(x+10,y-5,3,8);c.fillRect(x-5,y-14,7,3);
    c.globalAlpha=pulse;c.fillStyle='#b89a65';c.fillRect(x-8,y-8,16,16);
    c.restore();
  }

  drawEntity(e){
    const c=this.ctx,s=this.worldToScreen(e.x,e.y);
    if(['foe','midboss','boss'].includes(e.type)&&e.combatTelegraph==='HEAVY'){const r=this.combatCenterRadiusForReach(Number(e.combatThreatRange)||14,e),pulse=.48+.15*Math.sin(this.time*10);c.save();c.globalAlpha=.08;c.fillStyle='#b64b43';c.beginPath();c.arc(Math.round(s.x),Math.round(s.y),r,0,Math.PI*2);c.fill();c.globalAlpha=pulse;c.strokeStyle='#d45a50';c.lineWidth=2;c.beginPath();c.arc(Math.round(s.x),Math.round(s.y),r,0,Math.PI*2);c.stroke();c.restore();}
    if(e.type==='foe')this.drawFoeSprite(e.foe?.id,s.x,s.y,Math.sin(this.time*5+e.tx)*1.1);
    else if(e.type==='chest'){
      c.fillStyle='#5f3f24';c.fillRect(Math.round(s.x-8),Math.round(s.y-5),16,11);c.fillStyle='#b17d3e';c.fillRect(Math.round(s.x-8),Math.round(s.y-5),16,3);c.fillStyle='#c8a15a';c.fillRect(Math.round(s.x-1),Math.round(s.y-2),3,4);
    }else if(e.type==='glint'){
      const a=.45+.45*Math.sin(this.time*5);c.fillStyle=`rgba(225,193,123,${a})`;c.fillRect(Math.round(s.x),Math.round(s.y-4),1,9);c.fillRect(Math.round(s.x-4),Math.round(s.y),9,1);
    }else if(e.type==='hollow')this.drawHollow(s,e.kind==='stage');
    else if(e.type==='loot'){
      const img=this.lootBagSprite.ready?this.lootBagSprite.img:null;c.fillStyle='rgba(0,0,0,.48)';c.fillRect(Math.round(s.x-8),Math.round(s.y+6),16,3);
      if(img){const max=24,scale=Math.min(max/img.naturalWidth,max/img.naturalHeight),w=Math.max(1,Math.round(img.naturalWidth*scale)),h=Math.max(1,Math.round(img.naturalHeight*scale));c.imageSmoothingEnabled=false;c.drawImage(img,Math.round(s.x-w/2),Math.round(s.y+8-h),w,h);}
      else{c.fillStyle='#8f6a3b';c.fillRect(Math.round(s.x-7),Math.round(s.y-4),14,12);c.fillStyle='#caa35c';c.fillRect(Math.round(s.x-5),Math.round(s.y-7),10,4);c.fillStyle='#e1bd67';c.fillRect(Math.round(s.x-2),Math.round(s.y),4,4);}
    }else if(e.type==='settlement'){
      c.fillStyle='#453b2b';c.fillRect(Math.round(s.x-14),Math.round(s.y-9),28,18);c.fillStyle='#8f7950';c.fillRect(Math.round(s.x-16),Math.round(s.y-11),32,4);c.fillStyle='#e2b765';c.fillRect(Math.round(s.x-8),Math.round(s.y-2),4,5);c.fillRect(Math.round(s.x+5),Math.round(s.y-2),4,5);
    }else if(e.type==='signpost'){
      const x=Math.round(s.x),y=Math.round(s.y);c.fillStyle='rgba(0,0,0,.45)';c.fillRect(x-9,y+8,18,3);c.fillStyle='#5d4329';c.fillRect(x-2,y-5,4,16);c.fillStyle='#795a35';c.fillRect(x-13,y-9,26,9);c.fillStyle='#b58b50';c.fillRect(x-10,y-7,20,2);c.fillStyle='#d0b078';c.fillRect(x+8,y-6,3,3);
    }else if(e.type==='townlocation'){
      const dep=!!e.location?.departure,pulse=.65+.25*Math.sin(this.time*4);
      c.fillStyle=dep?'#c29a5a':'#8b8067';c.fillRect(Math.round(s.x-3),Math.round(s.y-3),6,6);
      c.globalAlpha=.16*pulse;c.fillStyle=dep?'#e4b865':'#c4b38a';c.fillRect(Math.round(s.x-10),Math.round(s.y-10),20,20);c.globalAlpha=1;
    }else if(e.type==='sidepassage')this.drawSidePassage(s,e.event);
    else if(e.type==='caravan'||e.type==='merchant')this.drawCaravan(s,e.event);
    else if(e.type==='rescue-tracks'){
      c.fillStyle='#75634a';for(const [ox,oy] of [[-6,-3],[-1,3],[5,-2],[10,4]]){c.fillRect(Math.round(s.x+ox),Math.round(s.y+oy),4,2);c.fillRect(Math.round(s.x+ox+1),Math.round(s.y+oy-2),2,2);}
    }else if(e.type==='rescue-satchel'){
      c.fillStyle='rgba(0,0,0,.45)';c.fillRect(Math.round(s.x-9),Math.round(s.y+6),18,3);c.fillStyle='#5e4430';c.fillRect(Math.round(s.x-7),Math.round(s.y-5),14,12);c.fillStyle='#8a6c4a';c.fillRect(Math.round(s.x-5),Math.round(s.y-8),10,4);c.fillStyle='#b7aa8a';c.fillRect(Math.round(s.x-1),Math.round(s.y-1),3,4);
    }else if(e.type==='rescue-hideout'){
      c.fillStyle='#020405';c.fillRect(Math.round(s.x-13),Math.round(s.y-12),26,25);c.fillStyle='#263137';c.fillRect(Math.round(s.x-16),Math.round(s.y-14),5,28);c.fillRect(Math.round(s.x+11),Math.round(s.y-14),5,28);c.fillRect(Math.round(s.x-12),Math.round(s.y-16),24,5);c.fillStyle='rgba(214,166,83,.22)';c.fillRect(Math.round(s.x-7),Math.round(s.y-7),14,14);
    }else if(e.type==='escort-pursuit'){
      c.fillStyle='rgba(0,0,0,.55)';c.fillRect(Math.round(s.x-11),Math.round(s.y+7),22,3);c.fillStyle='#718155';c.fillRect(Math.round(s.x-7),Math.round(s.y-5),6,11);c.fillRect(Math.round(s.x+3),Math.round(s.y-7),6,13);c.fillStyle='#b34f3c';c.fillRect(Math.round(s.x-5),Math.round(s.y-3),1,1);c.fillRect(Math.round(s.x+5),Math.round(s.y-5),1,1);
    }else if(e.type==='quest-target'){
      c.fillStyle='#7f8588';c.fillRect(Math.round(s.x-8),Math.round(s.y-6),16,13);c.fillStyle='#b9aa83';c.fillRect(Math.round(s.x-6),Math.round(s.y-4),12,2);c.fillStyle='#d5c08b';c.fillRect(Math.round(s.x-1),Math.round(s.y-1),3,4);
    }else if(e.type==='midboss'){
      if(e.aggro){
        // Subtle ground warning rather than a UI-looking square around the sprite.
        c.save();c.globalAlpha=.30+.10*Math.sin(this.time*3.4);c.strokeStyle='#c77b48';c.lineWidth=2;
        c.beginPath();c.ellipse(Math.round(s.x),Math.round(s.y+11),19,7,0,0,Math.PI*2);c.stroke();c.restore();
      }
      this.drawFoeSprite(e.foeId||e.event?.profileId||'cutter',s.x,s.y,Math.sin(this.time*4.2)*1.1,MID_BOSS_VISUAL_SCALE);
    }else if(e.type==='boss'){
      this.drawBossSprite(s.x,s.y,!!e.aggro);
    }else if(e.type==='side-stage'){
      // This is a real physical blockade, not an invisible progression wall.
      // Its visible footprint matches sideBarrierCollides(): narrow along the
      // passage direction and tall enough to span the carved branch.
      const top=Math.round(s.y-TILE*2.35),height=Math.round(TILE*4.70);
      c.fillStyle='rgba(0,0,0,.48)';c.fillRect(Math.round(s.x-8),top+3,16,height);
      c.fillStyle='#34383a';c.fillRect(Math.round(s.x-6),top,12,height);
      c.fillStyle='#4b5050';
      for(let yy=top+4,row=0;yy<top+height-5;yy+=11,row++){
        const ox=row%2?-3:1;c.fillRect(Math.round(s.x-6+ox),yy,10,6);c.fillStyle='#292f31';c.fillRect(Math.round(s.x+3+ox),yy+2,5,5);c.fillStyle='#4b5050';
      }
      c.fillStyle='#806344';c.fillRect(Math.round(s.x-9),Math.round(s.y-3),18,6);
      c.fillStyle='#c69a55';c.fillRect(Math.round(s.x-2),Math.round(s.y-2),4,4);
    }else if(e.type==='side-finale'){
      c.fillStyle='#32302a';c.fillRect(Math.round(s.x-18),Math.round(s.y-10),36,21);c.fillStyle='#6a4b2f';c.fillRect(Math.round(s.x-8),Math.round(s.y-3),16,12);c.fillStyle='#c39a55';c.fillRect(Math.round(s.x-6),Math.round(s.y-6),12,4);c.fillStyle='#82735c';c.fillRect(Math.round(s.x-2),Math.round(s.y-15),4,10);
    }else if(e.type==='side-exit'){
      c.strokeStyle='#6f756f';c.strokeRect(Math.round(s.x-10),Math.round(s.y-12),20,24);c.fillStyle='#1d282b';c.fillRect(Math.round(s.x-7),Math.round(s.y-9),14,18);
    }
  }

  drawCombatRangeGuide(){
    const c=this.ctx;
    c.save();

    // Combat-only PLAYER reach guide. This is the literal space the equipped
    // melee weapon reaches from the edge of the player's combat body. It is
    // deliberately hidden while exploring and appears only for an engagement.
    if(this.combat&&this.playerReachGuideVisible){
      const p=this.worldToScreen(this.player.x,this.player.y);
      const reachR=Math.max(1,Number(this.player.r)||0)+Math.max(0,Number(this.playerReachGuideRange)||0);
      // Keep the combat reach guide quiet: no fill, just the fine dotted gold
      // circumference requested for spatial feedback.
      c.globalAlpha=.42;
      c.strokeStyle='#d8b44a';
      c.lineWidth=1.15;
      c.lineCap='round';
      c.setLineDash([1,5]);
      c.beginPath();
      c.arc(Math.round(p.x),Math.round(p.y),reachR,0,Math.PI*2);
      c.stroke();
      c.setLineDash([]);
      c.lineCap='butt';
    }

    if(!this.combat||!this.combatFoe||this.combatFoe.combatEvading){c.restore();return;}
    const f=this.combatFoe,s=this.worldToScreen(f.x,f.y),body=this.combatFoeBodyRadius(f);

    // WHITE marks the active target even while approaching. It becomes brighter
    // and solid once that creature is actually inside the player's usable reach.
    const rx=Math.max(9,body+5),ry=Math.max(4,Math.round(body*.42)),pulse=this.combatPlayerInRange?.58+.10*Math.sin(this.time*6.2):.28;
    c.globalAlpha=pulse;c.strokeStyle='#f2f0e9';c.lineWidth=this.combatPlayerInRange?2:1.2;if(!this.combatPlayerInRange)c.setLineDash([2,4]);
    c.beginPath();c.ellipse(Math.round(s.x),Math.round(s.y+11),rx,ry,0,0,Math.PI*2);c.stroke();c.setLineDash([]);
    if(this.combatPlayerInRange){c.globalAlpha=.10;c.fillStyle='#ffffff';c.beginPath();c.ellipse(Math.round(s.x),Math.round(s.y+11),rx,ry,0,0,Math.PI*2);c.fill();}

    // Red appears only while a telegraphed Heavy is winding up. It shows the
    // actual imminent enemy threat radius and vanishes when the attack resolves.
    if(this.combatThreatActive){
      const threatR=this.combatCenterRadiusForReach(this.combatEnemyThreatRange,f);
      const pulse=.48+.15*Math.sin(this.time*10);
      c.globalAlpha=.08;c.fillStyle='#b64b43';c.beginPath();c.arc(Math.round(s.x),Math.round(s.y),threatR,0,Math.PI*2);c.fill();
      c.globalAlpha=pulse;c.strokeStyle='#d45a50';c.lineWidth=2;c.beginPath();c.arc(Math.round(s.x),Math.round(s.y),threatR,0,Math.PI*2);c.stroke();
    }
    c.restore();
  }

  drawCombatFoe(f){
    const s=this.worldToScreen(f.x+(f.renderOffsetX||0),f.y+(f.renderOffsetY||0)),bob=Math.sin(this.time*5)*.7;
    if(f.type==='midboss')this.drawFoeSprite(f.foe?.id||f.foeId||f.event?.profileId||'cutter',s.x,s.y,bob,MID_BOSS_VISUAL_SCALE);
    else if(f.type==='boss')this.drawBossSprite(s.x,s.y,true,bob);
    else this.drawFoeSprite(f.foe?.id||f.id,s.x,s.y,bob);
    const hpMax=Math.max(1,Number(f.combatHpMax)||0),hp=clamp(Number(f.combatHp)||0,0,hpMax);
    if(Number.isFinite(Number(f.combatHpMax))&&hpMax>0){
      const c=this.ctx,w=f.type==='boss'?38:(f.type==='midboss'?32:26),y=Math.round(s.y-(f.type==='boss'?42:(f.type==='midboss'?35:27)));
      c.fillStyle='rgba(0,0,0,.78)';c.fillRect(Math.round(s.x-w/2)-1,y-1,w+2,5);
      c.fillStyle='#4a2020';c.fillRect(Math.round(s.x-w/2),y,w,3);
      c.fillStyle='#a44c42';c.fillRect(Math.round(s.x-w/2),y,Math.round(w*(hp/hpMax)),3);
      const label=f.combatEvading?'EVADING':String(f.combatTelegraph||'');
      if(label){c.save();c.font='bold 8px monospace';c.textAlign='center';c.fillStyle=f.combatEvading?'#a7aa9a':'#d3a45e';c.fillText(label,s.x,y-5);c.restore();}
    }
  }

  drawPlayer(){
    const c=this.ctx,p=this.player,s=this.worldToScreen(p.x+(p.renderOffsetX||0),p.y+(p.renderOffsetY||0)),walk=p.moving?Math.sin(this.time*12)*1.2:0;
    c.save();c.translate(Math.round(s.x),Math.round(s.y+walk));
    c.fillStyle='rgba(0,0,0,.55)';c.fillRect(-7,8,14,3);c.fillStyle='#2f444f';c.fillRect(-6,-6,12,13);c.fillStyle='#b49f7d';c.fillRect(-4,-10,8,5);c.fillStyle='#171c20';c.fillRect(-5,-11,10,3);c.fillStyle='#d8b661';const lx=p.dir==='left'?-8:p.dir==='right'?6:4;c.fillRect(lx,-1,3,5);c.fillStyle='#825c33';c.fillRect(lx+1,4,1,4);c.restore();
  }

  drawParticle(p){const c=this.ctx,s=this.worldToScreen(p.x,p.y-(1-p.life/p.max)*18);c.save();c.globalAlpha=clamp(p.life/p.max,0,1);c.font='bold 10px monospace';c.textAlign='center';c.fillStyle=p.tone==='enemy'?'#d46b5f':p.tone==='status'?'#a7aa9a':'#e0bd78';c.fillText(p.text,s.x,s.y-14);c.restore();}
  drawDepthDirection(){const c=this.ctx;c.save();c.globalAlpha=.42;c.textAlign='center';c.font='9px monospace';c.fillStyle='#8b7650';c.fillText('↑ DEEPER',this.logicalViewW()/2,Math.max(116,this.logicalViewH()*.18));c.restore();}
}
