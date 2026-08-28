import {TILE,FATHOMS_PER_TILE,depthFromY,yFromDepth,hash2,clamp,stratumIndex} from './world-core.js';
import {DAWNGATE_TEMPLATE} from './dawngate-template.js';

const DIRS={up:{x:0,y:-1},down:{x:0,y:1},left:{x:-1,y:0},right:{x:1,y:0}};
const BASE_ENTITY_MARGIN_TILES=4;
const AI_RADIUS_TILES=11;
const ROAMER_RETENTION_MULTIPLIER=2.4;
// Ordinary foes use deterministic ecology sectors, but every creature now owns
// its own spawn chance. Adding a new species therefore does NOT dilute the rate of
// any existing species. The chances live on the foe profiles in legacy.js.
const ORDINARY_ECOLOGY_SECTOR_TILES=20;
const ORDINARY_LOCAL_ACTIVE_CAP=16;
const ECOLOGY_SPAWN_RATE_MULTIPLIER=2;
const FOE_SPRITE_SIZE=32;
const PLAYER_SPRITE_SIZE=32;
const PLAYER_SPRITE_DIR='./assets/player/';
const PLAYER_SPRITE_FILES=Object.freeze({
  Votary:'knight-lantern-player.png',
  Rogue:'rogue-lantern-player.png',
  Wizard:'mage-lantern-player.png'
});
const FOE_SPRITE_FILES={
  cutter:'goblin-cutter.png',
  scrounger:'goblin-cutter.png',
  skitter:'goblin-skitter.png',
  shieldback:'goblin-shieldback.png',
  mauler:'goblin-mauler.png',
  oldhand:'goblin-oldhand.png',
  slime:'slime1-right.png',
  slime2:'slime2-right.png'
};
const FOE_SPRITE_DIRS=['./assets/creatures/','./assets/ui/','./assets/enemies/','./assets/'];
function stableCreatureSeed(value){
  const str=String(value||'');let h=2166136261;
  for(let i=0;i<str.length;i++){h^=str.charCodeAt(i);h=Math.imul(h,16777619);}
  return h>>>0;
}
const LOOT_BAG_FILE='./assets/ui/bag_coins.png';
const LOOT_BAG_LIFETIME_MS=60000;
const LOOT_BAG_BLINK_MS=10000;
const COMPANION_TORCH_FILE='./assets/ui/companion-torch.png';
// v0.219.10: authored looping campfire sheet used by Safe Hollows.
const CAMPFIRE_SHEET_FILE='./assets/props/campfire-sheet.png';
const CAMPFIRE_FRAME_W=32;
const CAMPFIRE_FRAME_H=64;
const CAMPFIRE_FRAME_COUNT=8;
const CAMPFIRE_FPS=10;
// v0.219.8: authored rock-prop set. The source pack contains BIG + small
// versions; only BIG is used for procedural boulders so the world keeps the
// deliberately chunky obstacle scale and does not drift back toward pebbles.
const AMBIENT_BOULDER_ASSETS=Object.freeze([
  {src:'./assets/props/rocks/Rock Pile 1 - MOSSY - BIG.PNG',w:62,h:34},
  {src:'./assets/props/rocks/Rock Pile 2 - MOSSY - BIG.PNG',w:76,h:40},
  {src:'./assets/props/rocks/Rock Pile 3 - MOSSY - BIG.PNG',w:50,h:39},
  {src:'./assets/props/rocks/Rock Pile 4 - MOSSY - BIG.PNG',w:67,h:39},
  {src:'./assets/props/rocks/Rock Pile 5 - MOSSY - BIG.PNG',w:52,h:30},
  {src:'./assets/props/rocks/Rock Pile 6 - MOSSY - BIG.PNG',w:74,h:41},
  {src:'./assets/props/rocks/Rock Pile 7 - MOSSY - BIG.PNG',w:70,h:38},
  {src:'./assets/props/rocks/Rock Pile 8 - MOSSY - BIG.PNG',w:60,h:40},
  {src:'./assets/props/rocks/Rock Pile 9 - MOSSY - BIG.PNG',w:50,h:29},
  {src:'./assets/props/rocks/Rock Pile 10 - MOSSY - BIG.PNG',w:58,h:33},
  {src:'./assets/props/rocks/Rock Pile 11 - MOSSY - BIG.PNG',w:47,h:29},
  {src:'./assets/props/rocks/Rock Pile 12 - MOSSY - BIG.PNG',w:77,h:33},
  {src:'./assets/props/rocks/Rock Pile 13 - MOSSY - BIG.PNG',w:42,h:25},
  {src:'./assets/props/rocks/Rock Pile 14 - MOSSY - BIG.PNG',w:63,h:33},
  {src:'./assets/props/rocks/Rock Pile 15 - MOSSY - BIG.PNG',w:53,h:27}
]);
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
// v0.219.42: ore remains exploration-biased, but the first Smithing quest must
// be realistically completable. Standard deposits favour chamber/route edges,
// while Remote/Rich deposits and Side Passage deposits reward deeper detours.
const ORE_SECTOR_TILES=14;
const ORE_SECTOR_CHANCE=.90;
const ORE_MAX_DEPTH=500;
// Copper and Tin are world resources, not recipe-weighted drops. Their base
// deposit identity is deliberately 50/50. Cluster generation below applies the
// same rules to both metals so one ore cannot silently dominate total spawns.
const TIN_VEIN_SHARE=.50;
const ORE_VARIANTS=Object.freeze({
  standard:Object.freeze({minOffset:3,maxOffset:7,copper:[3,6],tin:[2,4],weight:.66}),
  remote:Object.freeze({minOffset:9,maxOffset:16,copper:[5,8],tin:[3,6],weight:.24}),
  rich:Object.freeze({minOffset:18,maxOffset:28,copper:[7,11],tin:[5,8],weight:.10})
});
const STARTER_COPPER_DEPTH=6;
const MINIMAP_ORE_ICON_PATH='./assets/ui/mini-pickaxe-icon.png';
const SMITHING_ANVIL_ASSET='./assets/props/anvil1.png';
const TOWN_BUILDING_IDS=new Set(['inn','herbalist','guild']);
const AUTHORED_START_TOWN_ID='grey-lantern';
const AUTHORED_TOWN_NPC_ROLES=Object.freeze({
  'guild-npc.png':Object.freeze({role:'guild_manager',label:'Guild Manager',service:'guild'}),
  'herb-mnpc.png':Object.freeze({role:'herbalist_owner',label:'Herbalist Owner'}),
  'herb-fnpc.png':Object.freeze({role:'herbalist_shopkeeper',label:'Herbalist',service:'herbalist'}),
  'tavern-fnpc.png':Object.freeze({role:'tavern_keeper',label:'Tavern Keeper',service:'inn'}),
  'mine-fnpc.png':Object.freeze({role:'miner',label:'Miner'}),
  'bsmith-mnpc.png':Object.freeze({role:'blacksmith',label:'Blacksmith'}),
  'merchant-fnpc.png':Object.freeze({role:'merchant',label:'Merchant',service:'market'}),
  'merchant-mnpc.png':Object.freeze({role:'merchant',label:'Merchant',service:'market'}),
  'soldier-mnpc.png':Object.freeze({role:'gate_guard',label:'Gate Guard'})
});
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
const WORLD_SNAPSHOT_VERSION=2036;
// Claude's temporary live-terrain build stored Infinity in the snapshot. JSON
// serializes Infinity as null. Convert those null markers to a large finite value
// so the currently-generated v0.203.12 terrain stays stable instead of collapsing
// into an unintended legacy migration on the next load.
const LIVE_TERRAIN_LOCK_TY=1000000000;

export class World{
  constructor(canvas,{seed=41729,onEncounter,onToast,onInteract,onLoot,onLootExpired,onDepth,onSettlementEnter,onSettlementLeave,onLocationTitle,onEnterSide,onLeaveSide,onPassWorldEvent,onHostile,onMinimapZoom,onMineUnit,onMineComplete,getDetectionRadius,getProfiles,getTowns,getWorldEvents,getCompanion,getSideArea,getPlayerClass,getPlayerVisualScale,getTownQuestMarker}={}){
    this.canvas=canvas;
    this.ctx=canvas.getContext('2d',{alpha:false});
    this.ctx.imageSmoothingEnabled=false;
    this.seed=seed;
    this.onEncounter=onEncounter;
    this.onToast=onToast;
    this.onInteract=onInteract;
    this.onLoot=onLoot;
    this.onLootExpired=typeof onLootExpired==='function'?onLootExpired:null;
    this.onMineUnit=typeof onMineUnit==='function'?onMineUnit:null;
    this.onMineComplete=typeof onMineComplete==='function'?onMineComplete:null;
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
    this.getPlayerClass=typeof getPlayerClass==='function'?getPlayerClass:(()=>'Votary');
    this.getPlayerVisualScale=typeof getPlayerVisualScale==='function'?getPlayerVisualScale:(()=>1);
    this.getTownQuestMarker=typeof getTownQuestMarker==='function'?getTownQuestMarker:(()=>null);
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

    // v0.219.7: the delver is now canonically presented at 64×64 scale, so
    // the gameplay body is recalibrated as well instead of remaining a tiny
    // 32px-era footprint. Collision/reach therefore follow the larger player.
    this.player={x:TILE*.5,y:0,deepestY:0,r:14,speed:95,dir:'up',facing:'right',moving:false};
    this.camera={x:0,y:-80};
    this.zoom=1.15;
    this.atmosphereEffectsEnabled=true;
    this.edgeAtmosphereEnabled=false;
    // v0.218.0 developer placement mode. Runtime-editable presentation values
    // stay separate from collision/world state so visual iteration cannot corrupt a run.
    this.devPlacementEnabled=false;
    this.devPlacementSelection='';
    this.devPlacementConfig=this.sanitizeDevPlacementConfig(null);
    this.lightSources=[];
    this.fireflyAttractors=[];
    this.campfireSprite={img:null,ready:false,failed:false};
    this.playerFacingBeforeCombat=null;
    this.lightingCanvas=document.createElement('canvas');
    this.lightingCtx=this.lightingCanvas.getContext('2d',{alpha:true});
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
    this.oreRemaining=new Map();
    // Ore markers are based on deposits the delver has actually approached,
    // rather than every procedural vein whose terrain cell happens to be explored.
    this.discoveredOre=new Set();
    this.orePlanCache=new Map();
    this.oreClusterPlanCache=new Map();
    // v0.219.42 performance: these deterministic world-placement results were
    // being recomputed from collision/entity scans. Cache them per world seed.
    this.ambientBoulderSpecCache=new Map();
    this.ordinaryEcologySectorCache=new Map();
    this.starterOreSpecCache=undefined;
    // Nearby static/entity discovery does not need a full viewport tile scan at
    // render-frame frequency. Roamer objects continue updating every frame.
    this.activeEntityRefresh={ptx:null,pty:null,rx:null,ry:null,last:-999};
    this.minimapOreIcon={img:null,ready:false,failed:false};
    this.activeMining=null;
    this.activeSmithingForge=null;
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
    this.combatPlayerAttacking=false;
    this.autoApproach=false;
    this.onHostile=typeof onHostile==='function'?onHostile:null;
    this.getDetectionRadius=typeof getDetectionRadius==='function'?getDetectionRadius:null;
    this.companionVisual={x:0,y:0,ready:false,id:null};
    this.companionTorch={img:new Image(),ready:false};
    this.companionTorch.img.onload=()=>this.companionTorch.ready=true;
    this.companionTorch.img.onerror=()=>this.companionTorch.ready=false;
    this.companionTorch.img.src=COMPANION_TORCH_FILE;
    this.foeSprites=new Map();
    this.playerSprites=new Map();
    this.cleanedPlayerSpriteCache=new WeakMap();
    this.ambientBoulderSprites=new Map();
    this.ambientBoulderTintCache=new Map();
    // v0.219.30: authored settlement artwork is static, so render it into cached
    // layer canvases instead of replaying hundreds of Workshop tile draws every frame.
    this.authoredImageCache=new Map();
    this.authoredProcessedImageCache=new Map();
    this.authoredTileSpriteCache=new Map();
    this.authoredTownLayerCache=new Map();
    this.authoredTownRenderEpoch=1;
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
    this.activeEntities=[];this.particles=[];this.animations=[];this.combatFoe=null;this.combatEntityId=null;this.combat=false;this.combatPlayerRange=10;this.combatPlayerMelee=true;this.combatPlayerInRange=false;this.combatEnemyThreatRange=10;this.combatThreatActive=false;this.combatPlayerAttacking=false;this.autoApproach=false;this.playerFacingBeforeCombat=null;this.nearby=null;this.activeMining=null;this.activeSmithingForge=null;this.orePlanCache.clear();this.ambientBoulderSpecCache.clear();this.ordinaryEcologySectorCache.clear();this.starterOreSpecCache=undefined;this.activeEntityRefresh={ptx:null,pty:null,rx:null,ry:null,last:-999};
    this.worldEvents=[];this.worldEventSignature='';this.towns=[];this.townPlanCache=[];this.townSignature='';
    this.activeSide=null;this.activeSidePlan=null;this.sideSignature='';this.transitionLock='';this.sideWasInside=false;this.locationTitleZone='';
    this.companionVisual={x:0,y:0,ready:false,id:null};this.reachabilityCache.clear();this.wallCache.clear();this.minimapFloorCache.clear();this.sideGeometryCache.clear();this.ambientBoulderSpecCache?.clear();this.ordinaryEcologySectorCache?.clear();this.starterOreSpecCache=undefined;
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
    if(!data&&Math.max(0,Number(legacyDepth)||0)<=.001){
      const home=this.townPlans().find(t=>t.current&&t.depth<=.001);
      if(home){x=Number.isFinite(Number(home.spawnX))?Number(home.spawnX):home.originX;y=Number.isFinite(Number(home.spawnY))?Number(home.spawnY):home.originY+home.layoutH*.24;deepest=0;}
    }
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
      const authoredHome=canonicalDepth<=.001?this.townPlans().find(t=>t.current&&t.authored&&t.depth<=.001):null;
      if(authoredHome){x=Number(authoredHome.spawnX);y=Number(authoredHome.spawnY);deepest=0;}
      else{y=yFromDepth(canonicalDepth);const ty=Math.floor(y/TILE);x=(this.corridorCenter(ty)+.5)*TILE;deepest=y;}
    }

    this.defeated=new Set(data?.defeated||[]);
    this.opened=new Set(data?.opened||[]);
    this.oreRemaining=new Map(Object.entries(data?.oreRemaining&&typeof data.oreRemaining==='object'?data.oreRemaining:{}).map(([id,value])=>[String(id),Math.max(0,Math.floor(Number(value)||0))]));
    this.discoveredOre=new Set(Array.isArray(data?.discoveredOre)?data.discoveredOre.map(String):[]);
    // Migration: any vein recorded in oreRemaining has already been worked and
    // therefore was definitely discovered on older saves.
    for(const id of this.oreRemaining.keys())this.discoveredOre.add(String(id));
    this.visitedSettlements=new Set(data?.visited||[]);
    this.sealedTownGates=new Set();
    const lootRestoreNow=Date.now();
    this.lootBags=new Map((data?.lootBags||[]).filter(v=>v&&v.id&&v.recordId).map(v=>{
      const createdAt=Number.isFinite(Number(v.createdAt))?Number(v.createdAt):lootRestoreNow;
      const expiresAt=Number.isFinite(Number(v.expiresAt))?Number(v.expiresAt):createdAt+LOOT_BAG_LIFETIME_MS;
      return [String(v.id),{type:'loot',id:String(v.id),recordId:String(v.recordId),x:Number(v.x)||0,y:Number(v.y)||0,createdAt,expiresAt}];
    }));
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
      oreRemaining:Object.fromEntries(this.oreRemaining),
      discoveredOre:[...this.discoveredOre],
      visited:[...this.visitedSettlements],
      sealedTownGates:[...this.sealedTownGates],
      exploredCells:[...this.exploredCells],
      lootBags:[...this.lootBags.values()].map(b=>({id:b.id,recordId:b.recordId,x:b.x,y:b.y,createdAt:b.createdAt,expiresAt:b.expiresAt}))
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

  worldActorBodyRadius(actor,fallback=9){
    if(actor?.type==='boss')return COMBAT_BOSS_BODY_RADIUS;
    if(actor?.type==='midboss')return COMBAT_MIDBOSS_BODY_RADIUS;
    return Math.max(7,Number(fallback)||COMBAT_FOE_BODY_RADIUS);
  }

  worldActorCollidesOther(actor,x,y,r=9){
    const seen=new Set(),others=[];
    const push=e=>{if(!e||e===actor||seen.has(e)||!['foe','midboss','boss'].includes(e.type)||e.combatEvading)return;seen.add(e);others.push(e);};
    if(this.combatFoe)push(this.combatFoe);
    for(const e of this.activeEntities)push(e);
    for(const e of this.roamers.values())push(e);
    for(const e of this.bossActors.values())push(e);
    const selfR=this.worldActorBodyRadius(actor,r);
    for(const other of others){
      const otherR=this.worldActorBodyRadius(other,9),min=selfR+otherR+2;
      const nextDist=Math.hypot(x-other.x,y-other.y);
      if(nextDist>=min)continue;
      // If two actors somehow start overlapped, allow a step only when it increases
      // their separation. This lets the crowd untangle instead of freezing forever.
      const currentDist=Math.hypot(actor.x-other.x,actor.y-other.y);
      if(nextDist<=currentDist+.01)return true;
    }
    return false;
  }

  moveWorldActor(actor,dx,dy,r=9){
    const startX=actor.x,startY=actor.y,maxStep=Math.max(1,Math.min(TILE*.20,r*.65)),steps=Math.max(1,Math.ceil(Math.max(Math.abs(dx),Math.abs(dy))/maxStep)),sx=dx/steps,sy=dy/steps;
    for(let i=0;i<steps;i++){
      const beforeX=actor.x,beforeY=actor.y;
      const nx=actor.x+sx;
      if(!this.collides(nx,actor.y,r,{ignoreBossGate:true})&&!this.worldActorCollidesOther(actor,nx,actor.y,r))actor.x=nx;
      const ny=actor.y+sy;
      if(!this.collides(actor.x,ny,r,{ignoreBossGate:true})&&!this.worldActorCollidesOther(actor,actor.x,ny,r))actor.y=ny;
      if(Math.hypot(actor.x-beforeX,actor.y-beforeY)<.01){
        const mag=Math.hypot(sx,sy)||1,stepMag=Math.max(1,Math.min(maxStep,mag));
        if(actor._avoidSide!==1&&actor._avoidSide!==-1)actor._avoidSide=hash2(Math.floor(actor.x),Math.floor(actor.y),this.seed+9181)>.5?1:-1;
        for(const sign of [actor._avoidSide,-actor._avoidSide]){
          const px=(-sy/mag)*stepMag*sign,py=(sx/mag)*stepMag*sign,tx=actor.x+px,ty=actor.y+py;
          if(!this.collides(tx,ty,r,{ignoreBossGate:true})&&!this.worldActorCollidesOther(actor,tx,ty,r)){actor.x=tx;actor.y=ty;actor._avoidSide=sign;break;}
        }
      }
    }
    return Math.hypot(actor.x-startX,actor.y-startY);
  }

  separateWorldActors(entities=this.activeEntities){
    const seen=new Set(),actors=[];
    const add=e=>{if(!e||seen.has(e)||!['foe','midboss','boss'].includes(e.type))return;seen.add(e);actors.push(e);};
    add(this.combatFoe);for(const e of entities||[])add(e);
    for(let pass=0;pass<2;pass++)for(let i=0;i<actors.length;i++)for(let j=i+1;j<actors.length;j++){
      const a=actors[i],b=actors[j],ar=this.worldActorBodyRadius(a,9),br=this.worldActorBodyRadius(b,9),min=ar+br+2;
      let dx=b.x-a.x,dy=b.y-a.y,dist=Math.hypot(dx,dy);
      if(dist>=min)continue;
      if(dist<.001){const sign=hash2(i,j,this.seed+9199)>.5?1:-1;dx=sign;dy=1;dist=Math.SQRT2;}
      const nx=dx/dist,ny=dy/dist,push=(min-dist)*.52;
      const ax=a.x-nx*push,ay=a.y-ny*push,bx=b.x+nx*push,by=b.y+ny*push;
      if(!this.collides(ax,ay,ar,{ignoreBossGate:true})){a.x=ax;a.y=ay;}
      if(!this.collides(bx,by,br,{ignoreBossGate:true})){b.x=bx;b.y=by;}
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
        this.reachabilityCache.clear();this.wallCache.clear();this.minimapFloorCache.clear();this.ambientBoulderSpecCache?.clear();this.ordinaryEcologySectorCache?.clear();this.starterOreSpecCache=undefined;this.minimapDirty=true;
      }
      this.activeSide=null;this.activeSidePlan=null;return;
    }
    if(sig===this.sideSignature){this.activeSide=side;if(this.activeSidePlan)this.activeSidePlan.side=side;return;}
    const previousPlan=this.activeSidePlan;
    this.sideSignature=sig;this.activeSide=side;
    if(!side){
      if(previousPlan)this.rememberSidePlan(previousPlan);
      this.activeSidePlan=null;this.reachabilityCache.clear();this.wallCache.clear();this.minimapFloorCache.clear();this.ambientBoulderSpecCache?.clear();this.ordinaryEcologySectorCache?.clear();this.starterOreSpecCache=undefined;this.minimapDirty=true;return;
    }
    this.persistentSidePlans=this.persistentSidePlans.filter(p=>p.id!==String(side.id));
    const count=Math.max(1,Number(side.encountersNeeded)||1),event={type:'sidepassage',id:side.id||'active-side',depth:Number(side.entryDepth)||0};
    this.activeSidePlan={...this.prospectiveSidePlan(event,{count}),side};
    this.reachabilityCache.clear();this.wallCache.clear();this.minimapFloorCache.clear();this.ambientBoulderSpecCache?.clear();this.ordinaryEcologySectorCache?.clear();this.starterOreSpecCache=undefined;this.minimapDirty=true;
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

  authoredTownTemplateFor(town){
    return String(town?.id||'')===AUTHORED_START_TOWN_ID?DAWNGATE_TEMPLATE:null;
  }

  authoredFilename(path){return String(path||'').replace(/\\/g,'/').split('/').filter(Boolean).at(-1)||'';}

  authoredNormalizeLayer(value){return ['ground','normal','foreground'].includes(String(value||''))?String(value):'normal';}

  authoredVisualKey(visual){
    const v=visual||{};
    return `${Number(v.brightness)||1}|${Number(v.saturation)||1}|${String(v.tint||'#71806f')}|${clamp(Number(v.tintStrength)||0,0,.8)}`;
  }

  authoredAssetRecord(path){
    path=String(path||'');if(!path)return null;
    let rec=this.authoredImageCache.get(path);if(rec)return rec;
    const img=new Image();rec={path,img,ready:false,failed:false};this.authoredImageCache.set(path,rec);
    const refresh=()=>{this.authoredTownRenderEpoch++;this.authoredTownLayerCache.clear();this.minimapDirty=true;};
    img.onload=()=>{rec.ready=true;rec.failed=false;refresh();};
    img.onerror=()=>{rec.ready=false;rec.failed=true;console.warn(`Authored settlement asset could not be loaded: ${path}`);refresh();};
    img.src=path;
    return rec;
  }

  authoredTintCanvas(canvas,visual){
    const strength=clamp(Number(visual?.tintStrength)||0,0,.8);if(strength<=0)return canvas;
    const c=canvas.getContext('2d',{alpha:true});c.save();c.globalCompositeOperation='source-atop';c.globalAlpha=strength;c.fillStyle=String(visual?.tint||'#71806f');c.fillRect(0,0,canvas.width,canvas.height);c.restore();return canvas;
  }

  authoredProcessedAsset(path,visual){
    const rec=this.authoredAssetRecord(path);if(!rec?.ready||!rec.img?.naturalWidth||!rec.img?.naturalHeight)return null;
    const key=`asset|${path}|${this.authoredVisualKey(visual)}`;let canvas=this.authoredProcessedImageCache.get(key);if(canvas)return canvas;
    canvas=document.createElement('canvas');canvas.width=rec.img.naturalWidth;canvas.height=rec.img.naturalHeight;
    const c=canvas.getContext('2d',{alpha:true});c.imageSmoothingEnabled=false;c.filter=`brightness(${Number(visual?.brightness)||1}) saturate(${Number(visual?.saturation)||1})`;c.drawImage(rec.img,0,0);c.filter='none';this.authoredTintCanvas(canvas,visual);this.authoredProcessedImageCache.set(key,canvas);return canvas;
  }

  authoredProcessedTile(tile){
    const path=String(tile?.assetPath||''),rec=this.authoredAssetRecord(path);if(!rec?.ready||!rec.img?.naturalWidth||!rec.img?.naturalHeight)return null;
    const size=Math.max(1,Math.floor(Number(tile?.tileSize)||16)),index=Math.max(0,Math.floor(Number(tile?.tileIndex)||0)),cols=Math.max(1,Math.floor(rec.img.naturalWidth/size)),sx=(index%cols)*size,sy=Math.floor(index/cols)*size;
    if(sx+size>rec.img.naturalWidth||sy+size>rec.img.naturalHeight)return null;
    const key=`tile|${path}|${size}|${index}|${this.authoredVisualKey(tile?.visual)}`;let canvas=this.authoredTileSpriteCache.get(key);if(canvas)return canvas;
    canvas=document.createElement('canvas');canvas.width=size;canvas.height=size;const c=canvas.getContext('2d',{alpha:true});c.imageSmoothingEnabled=false;c.filter=`brightness(${Number(tile?.visual?.brightness)||1}) saturate(${Number(tile?.visual?.saturation)||1})`;c.drawImage(rec.img,sx,sy,size,size,0,0,size,size);c.filter='none';this.authoredTintCanvas(canvas,tile?.visual);this.authoredTileSpriteCache.set(key,canvas);return canvas;
  }

  authoredDrawObjectLocal(c,o,offsetX=0,offsetY=0){
    const img=this.authoredProcessedAsset(o?.assetPath,o?.visual);if(!img)return false;
    const scale=Math.max(.01,Number(o?.scale)||1),w=Math.max(1,Number(o?.assetWidth)||img.width)*scale,h=Math.max(1,Number(o?.assetHeight)||img.height)*scale;
    c.imageSmoothingEnabled=false;c.drawImage(img,(Number(o?.x)||0)-offsetX,(Number(o?.y)||0)-offsetY,w,h);return true;
  }

  authoredDrawTileLocal(c,tile,offsetX=0,offsetY=0){
    const img=this.authoredProcessedTile(tile);if(!img)return false;
    const scale=Math.max(.01,Number(tile?.scale)||1),rendered=Math.max(1,Number(tile?.tileSize)||16)*scale;c.imageSmoothingEnabled=false;c.drawImage(img,(Number(tile?.x)||0)-offsetX,(Number(tile?.y)||0)-offsetY,rendered,rendered);return true;
  }

  authoredDrawRoadGroupLocal(c,group,offsetX=0,offsetY=0){let drew=false;for(const tile of group?.tiles||[])drew=this.authoredDrawTileLocal(c,tile,offsetX,offsetY)||drew;return drew;}

  authoredTownAssetsSettled(t){for(const o of t?.template?.objects||[]){const rec=this.authoredAssetRecord(o?.assetPath);if(rec&&!rec.ready&&!rec.failed)return false;}for(const layer of t?.template?.tileLayers||[])for(const tile of layer?.tiles||[]){const rec=this.authoredAssetRecord(tile?.assetPath);if(rec&&!rec.ready&&!rec.failed)return false;}return true;}

  authoredTownLayerBounds(t,layerName){
    let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
    const add=(x,y,w,h)=>{x=Number(x)||0;y=Number(y)||0;w=Math.max(0,Number(w)||0);h=Math.max(0,Number(h)||0);if(w<=0||h<=0)return;minX=Math.min(minX,x);minY=Math.min(minY,y);maxX=Math.max(maxX,x+w);maxY=Math.max(maxY,y+h);};
    for(const o of t?.template?.objects||[])if(this.authoredNormalizeLayer(o?.layer)===layerName){const scale=Math.max(.01,Number(o?.scale)||1);add(o?.x,o?.y,Math.max(1,Number(o?.assetWidth)||1)*scale,Math.max(1,Number(o?.assetHeight)||1)*scale);}
    for(const layer of t?.template?.tileLayers||[])for(const tile of layer?.tiles||[])if(this.authoredNormalizeLayer(tile?.layer||'ground')===layerName){const rendered=Math.max(1,Number(tile?.tileSize)||16)*Math.max(.01,Number(tile?.scale)||1);add(tile?.x,tile?.y,rendered,rendered);}
    if(!Number.isFinite(minX))return{x:0,y:0,w:1,h:1,empty:true};
    const x=Math.floor(minX),y=Math.floor(minY),right=Math.ceil(maxX),bottom=Math.ceil(maxY);return{x,y,w:Math.max(1,right-x),h:Math.max(1,bottom-y),empty:false};
  }

  authoredTownLayerRecord(t){
    if(!t?.authored||!this.authoredTownAssetsSettled(t))return null;
    const key=String(t.id||'authored-town');let rec=this.authoredTownLayerCache.get(key);if(rec&&rec.epoch===this.authoredTownRenderEpoch)return rec;
    const layers={};
    for(const name of ['ground','normal','foreground']){
      const b=this.authoredTownLayerBounds(t,name),canvas=document.createElement('canvas');canvas.width=b.w;canvas.height=b.h;const c=canvas.getContext('2d',{alpha:true});c.imageSmoothingEnabled=false;
      if(!b.empty){
        if(name==='normal'){
          // Town walls/fences and buildings often share the normal layer. Drawing
          // every tile after every object made long fence runs paint over roofs.
          // Sort normal-layer artwork by its visual bottom edge instead, matching
          // ordinary top-down depth: farther/northern things first, lower things last.
          const items=[];
          for(const o of t.template?.objects||[])if(this.authoredNormalizeLayer(o?.layer)==='normal'){
            const scale=Math.max(.01,Number(o?.scale)||1),bottom=(Number(o?.y)||0)+Math.max(1,Number(o?.assetHeight)||1)*scale;
            items.push({kind:'object',item:o,bottom});
          }
          for(const layerDef of t.template?.tileLayers||[])for(const tile of layerDef?.tiles||[])if(this.authoredNormalizeLayer(tile?.layer||'ground')==='normal'){
            const size=Math.max(1,Number(tile?.tileSize)||16)*Math.max(.01,Number(tile?.scale)||1),bottom=(Number(tile?.y)||0)+size;
            items.push({kind:'tile',item:tile,bottom});
          }
          items.sort((a,b)=>a.bottom-b.bottom);
          for(const row of items){if(row.kind==='object')this.authoredDrawObjectLocal(c,row.item,b.x,b.y);else this.authoredDrawTileLocal(c,row.item,b.x,b.y);}
        }else{
          for(const o of t.template?.objects||[])if(this.authoredNormalizeLayer(o?.layer)===name)this.authoredDrawObjectLocal(c,o,b.x,b.y);
          for(const layerDef of t.template?.tileLayers||[])for(const tile of layerDef?.tiles||[])if(this.authoredNormalizeLayer(tile?.layer||'ground')===name)this.authoredDrawTileLocal(c,tile,b.x,b.y);
        }
      }
      layers[name]={...b,canvas};
    }
    rec={epoch:this.authoredTownRenderEpoch,layers};this.authoredTownLayerCache.set(key,rec);return rec;
  }

  drawAuthoredTownLayer(layer){
    for(const t of this.townPlans()){
      if(!t.authored)continue;const rec=this.authoredTownLayerRecord(t),lr=rec?.layers?.[layer];if(!lr||lr.empty)continue;
      const worldX=t.templateOriginX+lr.x,worldY=t.templateOriginY+lr.y,s=this.worldToScreen(worldX,worldY),margin=Math.max(lr.w,lr.h);
      if(s.x>this.logicalViewW()+margin||s.x+lr.w<-margin||s.y>this.logicalViewH()+margin||s.y+lr.h<-margin)continue;
      this.ctx.imageSmoothingEnabled=false;this.ctx.drawImage(lr.canvas,Math.round(s.x),Math.round(s.y),lr.w,lr.h);
    }
  }

  authoredPointInZone(x,y,zone){return !!zone&&x>=zone.x&&x<=zone.x+zone.w&&y>=zone.y&&y<=zone.y+zone.h;}

  drawAuthoredTownOcclusion(){
    const footX=this.player.x,footY=this.player.y;
    for(const t of this.townPlans()){
      if(!t.authored)continue;
      const redrawnObjects=new Set(),redrawnTiles=new Set();
      const drawObject=o=>{
        const key=String(o?.id||o?.assetPath||'');if(redrawnObjects.has(key))return;const img=this.authoredProcessedAsset(o?.assetPath,o?.visual);if(!img)return;
        const scale=Math.max(.01,Number(o?.scale)||1),s=this.worldToScreen(t.templateOriginX+(Number(o?.x)||0),t.templateOriginY+(Number(o?.y)||0));
        this.ctx.imageSmoothingEnabled=false;this.ctx.drawImage(img,Math.round(s.x),Math.round(s.y),Math.max(1,Number(o?.assetWidth)||img.width)*scale,Math.max(1,Number(o?.assetHeight)||img.height)*scale);redrawnObjects.add(key);
      };
      const drawTile=tile=>{
        const key=String(tile?.id||`${tile?.assetPath}:${tile?.x}:${tile?.y}`);if(redrawnTiles.has(key))return;const img=this.authoredProcessedTile(tile);if(!img)return;
        const scale=Math.max(.01,Number(tile?.scale)||1),size=Math.max(1,Number(tile?.tileSize)||16)*scale,s=this.worldToScreen(t.templateOriginX+(Number(tile?.x)||0),t.templateOriginY+(Number(tile?.y)||0));
        this.ctx.imageSmoothingEnabled=false;this.ctx.drawImage(img,Math.round(s.x),Math.round(s.y),size,size);redrawnTiles.add(key);
      };

      // Workshop Behind zones are authoritative. Unlike the old v0.219.45
      // fallback, do not guess by redrawing every normal-layer tile under the
      // player's X coordinate: that could pull isolated fence/gate pixels over
      // nearby guards and create the stray fragments seen at Dawngate.
      for(const occ of t.occluders||[]){
        if(!(occ.zones||[]).some(zone=>this.authoredPointInZone(footX,footY,zone)))continue;
        if(occ.kind==='object')drawObject(occ.item);else if(occ.kind==='road')for(const tile of occ.item?.tiles||[])drawTile(tile);
      }

      // Gate occlusion is redrawn from gate-area tiles/props only. Never redraw
      // the cached normal layer here: it also contains authored NPC sprites, which
      // created the stray square/"quest-target"-looking fragment above guards.
      for(const gate of [{x:t.shallowGateX,y:t.shallowGateY},{x:t.deepGateX,y:t.deepGateY}]){
        if(!Number.isFinite(gate.x)||!Number.isFinite(gate.y))continue;const dx=Math.abs(footX-gate.x),dy=Math.abs(footY-gate.y);if(dx>TILE*5.0||dy>TILE*3.8)continue;
        const minX=gate.x-TILE*5,maxX=gate.x+TILE*5,minY=gate.y-TILE*4,maxY=gate.y+TILE*1.6,gs=this.worldToScreen(gate.x,gate.y),c=this.ctx;c.save();c.beginPath();c.rect(Math.round(gs.x-TILE*5),Math.round(gs.y-TILE*4),Math.round(TILE*10),Math.round(TILE*5.6));c.clip();
        for(const layerDef of t.template?.tileLayers||[])for(const tile of layerDef?.tiles||[]){if(this.authoredNormalizeLayer(tile?.layer||'ground')!=='normal')continue;const size=Math.max(1,Number(tile?.tileSize)||16)*Math.max(.01,Number(tile?.scale)||1),wx=t.templateOriginX+(Number(tile?.x)||0),wy=t.templateOriginY+(Number(tile?.y)||0);if(wx+size<minX||wx>maxX||wy+size<minY||wy>maxY)continue;drawTile(tile);}
        for(const o of t.template?.objects||[]){if(this.authoredNormalizeLayer(o?.layer)!=='normal')continue;const path=String(o?.assetPath||'').toLowerCase();if(path.includes('/npc/')||path.includes('/buildings/'))continue;const scale=Math.max(.01,Number(o?.scale)||1),w=Math.max(1,Number(o?.assetWidth)||1)*scale,h=Math.max(1,Number(o?.assetHeight)||1)*scale,wx=t.templateOriginX+(Number(o?.x)||0),wy=t.templateOriginY+(Number(o?.y)||0);if(wx+w<minX||wx>maxX||wy+h<minY||wy>maxY)continue;drawObject(o);}
        c.restore();
      }
    }
  }

  drawTownQuestMarkers(){
    for(const e of this.activeEntities||[]){
      if(e?.type!=='townnpc'&&!(e?.type==='townlocation'&&e.authoredNpc))continue;
      const npc=e.npc||{},townId=e.town?.id||'',locationId=e.location?.id||null;
      const marker=this.getTownQuestMarker?.({townId,locationId,role:npc.role||'',npcId:npc.id||'',label:npc.label||''});
      if(!marker?.asset)continue;
      const rec=this.authoredAssetRecord(marker.asset);if(!rec?.ready||!rec.img)continue;
      const wx=Number.isFinite(Number(npc.x))?Number(npc.x):Number(e.x)||0,wy=Number.isFinite(Number(npc.y))?Number(npc.y):Number(e.y)||0,s=this.worldToScreen(wx,wy);
      const npcScale=Math.max(.01,Number(npc.object?.scale)||1),npcH=Math.max(18,(Number(npc.object?.assetHeight)||32)*npcScale),iw=20,ih=22,bob=Math.round(Math.sin(this.time*3.1+(wx+wy)*.01)*1);
      const c=this.ctx;c.save();c.imageSmoothingEnabled=false;c.drawImage(rec.img,Math.round(s.x-iw/2),Math.round(s.y-npcH-ih-4+bob),iw,ih);c.restore();
    }
  }

  authoredTownRoadGroups(template){
    const map=new Map();
    for(const layer of template?.tileLayers||[])for(const tile of layer?.tiles||[]){
      const key=String(tile?.groupId||tile?.id||'');if(!key)continue;
      let group=map.get(key);
      if(!group){group={id:key,tiles:[],scale:Math.max(.01,Number(tile?.scale)||1),layer:String(tile?.layer||'ground'),collisionZones:Array.isArray(tile?.collisionZones)?tile.collisionZones:[],occlusionZones:Array.isArray(tile?.occlusionZones)?tile.occlusionZones:[]};map.set(key,group);}
      group.tiles.push(tile);
    }
    for(const group of map.values()){
      let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
      for(const tile of group.tiles){const size=Math.max(1,Number(tile?.tileSize)||16)*Math.max(.01,Number(tile?.scale)||1),x=Number(tile?.x)||0,y=Number(tile?.y)||0;minX=Math.min(minX,x);minY=Math.min(minY,y);maxX=Math.max(maxX,x+size);maxY=Math.max(maxY,y+size);}
      group.rect={x:Number.isFinite(minX)?minX:0,y:Number.isFinite(minY)?minY:0,w:Number.isFinite(maxX-minX)?maxX-minX:0,h:Number.isFinite(maxY-minY)?maxY-minY:0};
    }
    return [...map.values()];
  }

  makeAuthoredTownPlan(town,template){
    const width=Math.max(1,Number(template?.width)||1),height=Math.max(1,Number(template?.height)||1),entrance=template?.anchors?.entrance||{x:width*.5,y:height},exit=template?.anchors?.exit||{x:width*.5,y:0};
    // The authored OUT anchor is the progression origin. At Fathom 0 it sits on
    // world y=0, so walking anywhere inside Dawngate remains 0.0 fathoms and the
    // counter starts only after the player actually crosses the upper gate.
    const depth=Math.max(0,Number(town?.depth)||0),deepGateY=yFromDepth(depth),deepTy=Math.floor(deepGateY/TILE),deepGateX=(this.corridorCenter(deepTy)+.5)*TILE;
    const templateOriginX=deepGateX-(Number(exit.x)||0),templateOriginY=deepGateY-(Number(exit.y)||0),originX=templateOriginX+width/2,originY=templateOriginY+height/2;
    const shallowGateX=templateOriginX+(Number(entrance.x)||0),shallowGateY=templateOriginY+(Number(entrance.y)||0);
    const deepJoinY=deepGateY-TILE*8,deepJoinTy=Math.floor(deepJoinY/TILE),deepJoinX=(this.corridorCenter(deepJoinTy)+.5)*TILE;
    const vx=deepGateX-shallowGateX,vy=deepGateY-shallowGateY,vlen=Math.hypot(vx,vy)||1,spawnInset=Math.min(52,Math.max(28,TILE*1.8)),spawnX=shallowGateX+vx/vlen*spawnInset,spawnY=shallowGateY+vy/vlen*spawnInset;
    const groups=this.authoredTownRoadGroups(template),collisionRects=[],occluders=[],npcs=[];
    const pushCollision=(lx,ly,w,h)=>{w=Math.max(0,Number(w)||0);h=Math.max(0,Number(h)||0);if(w<=0||h<=0)return;collisionRects.push({x:templateOriginX+(Number(lx)||0)+w/2,y:templateOriginY+(Number(ly)||0)+h/2,w,h});};
    const worldZone=(lx,ly,w,h)=>({x:templateOriginX+(Number(lx)||0),y:templateOriginY+(Number(ly)||0),w:Math.max(0,Number(w)||0),h:Math.max(0,Number(h)||0)});
    let artMinX=0,artMinY=0,artMaxX=width,artMaxY=height;
    for(const o of template?.objects||[]){
      const scale=Math.max(.01,Number(o?.scale)||1),ow=Math.max(1,Number(o?.assetWidth)||1),oh=Math.max(1,Number(o?.assetHeight)||1),ox=Number(o?.x)||0,oy=Number(o?.y)||0,renderW=ow*scale,renderH=oh*scale;
      artMinX=Math.min(artMinX,ox);artMinY=Math.min(artMinY,oy);artMaxX=Math.max(artMaxX,ox+renderW);artMaxY=Math.max(artMaxY,oy+renderH);
      if(o?.collision?.enabled!==false&&o?.collision){pushCollision(ox+(Number(o.collision.x)||0)*scale,oy+(Number(o.collision.y)||0)*scale,(Number(o.collision.w)||0)*scale,(Number(o.collision.h)||0)*scale);}
      for(const q of o?.collisionZones||[])if(q?.enabled!==false)pushCollision(ox+(Number(q.x)||0)*scale,oy+(Number(q.y)||0)*scale,(Number(q.w)||0)*scale,(Number(q.h)||0)*scale);
      const occ=[];
      if(o?.occlusion?.enabled){const q=o.occlusion;occ.push(worldZone(ox+(Number(q.x)||0)*scale,oy+(Number(q.y)||0)*scale,(Number(q.w)||0)*scale,(Number(q.h)||0)*scale));}
      for(const q of o?.occlusionZones||[])if(q?.enabled!==false)occ.push(worldZone(ox+(Number(q.x)||0)*scale,oy+(Number(q.y)||0)*scale,(Number(q.w)||0)*scale,(Number(q.h)||0)*scale));
      if(occ.length)occluders.push({kind:'object',item:o,zones:occ});
      if(String(o?.assetPath||'').replace(/\\/g,'/').includes('/assets/npc/')){
        const filename=this.authoredFilename(o.assetPath),role=AUTHORED_TOWN_NPC_ROLES[filename]||Object.freeze({role:'townsperson',label:String(o?.label||'Townsperson')}),x=templateOriginX+ox+renderW/2,y=templateOriginY+oy+renderH;
        npcs.push({id:String(o?.id||`npc:${filename}:${Math.round(x)}:${Math.round(y)}`),object:o,filename,x,y,role:role.role,label:role.label||'Townsperson',service:role.service||null});
      }
      this.authoredAssetRecord(o?.assetPath);
    }
    for(const group of groups){
      artMinX=Math.min(artMinX,group.rect.x);artMinY=Math.min(artMinY,group.rect.y);artMaxX=Math.max(artMaxX,group.rect.x+group.rect.w);artMaxY=Math.max(artMaxY,group.rect.y+group.rect.h);
      const scale=Math.max(.01,Number(group.scale)||1);
      for(const q of group.collisionZones||[])if(q?.enabled!==false)pushCollision(group.rect.x+(Number(q.x)||0)*scale,group.rect.y+(Number(q.y)||0)*scale,(Number(q.w)||0)*scale,(Number(q.h)||0)*scale);
      const occ=[];for(const q of group.occlusionZones||[])if(q?.enabled!==false)occ.push(worldZone(group.rect.x+(Number(q.x)||0)*scale,group.rect.y+(Number(q.y)||0)*scale,(Number(q.w)||0)*scale,(Number(q.h)||0)*scale));
      if(occ.length)occluders.push({kind:'road',item:group,zones:occ});
      for(const tile of group.tiles)this.authoredAssetRecord(tile?.assetPath);
    }
    // Service sprites can legitimately sit behind counters or other authored
    // collision. Build one small reachability field from the player spawn and
    // attach the interaction trigger to the closest reachable point. The sprite
    // itself never moves; this only prevents a shopkeeper behind a counter from
    // becoming impossible to use.
    const interactionStep=TILE*.5,interactionRadius=14,gridW=Math.max(1,Math.ceil(width/interactionStep)),gridH=Math.max(1,Math.ceil(height/interactionStep));
    const gridPoint=(gx,gy)=>({x:templateOriginX+Math.min(width-interactionStep*.5,interactionStep*.5+gx*interactionStep),y:templateOriginY+Math.min(height-interactionStep*.5,interactionStep*.5+gy*interactionStep)});
    const blockedPoint=(x,y)=>collisionRects.some(rect=>this.townRectHit(x,y,interactionRadius,rect));
    const startGX=clamp(Math.round((spawnX-templateOriginX-interactionStep*.5)/interactionStep),0,gridW-1),startGY=clamp(Math.round((spawnY-templateOriginY-interactionStep*.5)/interactionStep),0,gridH-1);
    let startKey=null,startBest=Infinity;
    for(let gy=0;gy<gridH;gy++)for(let gx=0;gx<gridW;gx++){const pt=gridPoint(gx,gy);if(blockedPoint(pt.x,pt.y))continue;const d=(gx-startGX)*(gx-startGX)+(gy-startGY)*(gy-startGY);if(d<startBest){startBest=d;startKey=`${gx},${gy}`;if(d===0)break;}}
    const reachable=[],seen=new Set(),queue=[];
    if(startKey){const [gx,gy]=startKey.split(',').map(Number);seen.add(startKey);queue.push([gx,gy]);}
    for(let qi=0;qi<queue.length;qi++){const [gx,gy]=queue[qi],pt=gridPoint(gx,gy);reachable.push(pt);for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){const nx=gx+dx,ny=gy+dy;if(nx<0||ny<0||nx>=gridW||ny>=gridH)continue;const key=`${nx},${ny}`;if(seen.has(key))continue;const np=gridPoint(nx,ny);if(blockedPoint(np.x,np.y))continue;seen.add(key);queue.push([nx,ny]);}}
    const nearestReachable=(x,y)=>{let best=null,bestD=Infinity;for(const pt of reachable){const d=(pt.x-x)*(pt.x-x)+(pt.y-y)*(pt.y-y);if(d<bestD){bestD=d;best=pt;}}return best?{x:best.x,y:best.y,distance:Math.sqrt(bestD)}:{x,y,distance:0};};
    const baseLocations=(town?.locations||[]).map(loc=>({...loc,x:originX,y:originY})),serviceNpcs=[];
    for(const npc of npcs){
      if(!npc.service)continue;const loc=(town?.locations||[]).find(v=>String(v.id)===String(npc.service));if(!loc)continue;
      const interaction=nearestReachable(npc.x,npc.y);
      serviceNpcs.push({...npc,interactionX:interaction.x,interactionY:interaction.y,interactionDistance:interaction.distance,location:{...loc,x:interaction.x,y:interaction.y,npcName:npc.label}});
      const stored=baseLocations.find(v=>String(v.id)===String(loc.id));if(stored&&stored.x===originX&&stored.y===originY){stored.x=interaction.x;stored.y=interaction.y;stored.npcName=npc.label;}
    }
    return {...town,name:String(template?.name||town?.name||'Dawngate'),authored:true,template,templateOriginX,templateOriginY,artBounds:{x:artMinX,y:artMinY,w:artMaxX-artMinX,h:artMaxY-artMinY},depth,entryX:shallowGateX,entryY:shallowGateY,entryTx:Math.floor(shallowGateX/TILE),entryTy:Math.floor(shallowGateY/TILE),originX,originY,layoutW:width,layoutH:height,halfW:width/2,halfH:height/2,shallowGateX,shallowGateY,deepGateX,deepGateY,gateY:deepGateY,deepRoadEndY:deepJoinY,shallowJoinX:shallowGateX,shallowJoinY:shallowGateY,shallowBendX:shallowGateX,shallowBendY:shallowGateY,deepJoinX,deepJoinY,deepBendX:deepGateX,deepBendY:deepGateY-TILE*2,wallSegs:[],signX:shallowGateX,signY:shallowGateY,approachSignX:shallowGateX,approachSignY:shallowGateY,locations:baseLocations,buildings:[],stalls:[],collisionRects,occluders,roadGroups:groups,npcs,serviceNpcs,spawnX,spawnY};
  }

  makeTownPlan(town){
    if(!town)return null;
    const authored=this.authoredTownTemplateFor(town);if(authored)return this.makeAuthoredTownPlan(town,authored);
    const city=town.kind==='city',village=town.kind==='village';
    // Settlements are physical world spaces. Fathom 0 gets a broad, leafy
    // village footprint; the major city is larger and denser rather than being
    // represented by a single illustrated map.
    const layoutW=(city?24:village?20:16)*TOWN_TILE,layoutH=(city?16:village?14:11)*TOWN_TILE;
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
    const approachExtra=city?2:(village?1:0),shallowJoinY=shallowGateY+TOWN_TILE*(6.5+approachExtra),deepJoinY=deepGateY-TOWN_TILE*(6.5+approachExtra);
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
    const pos={market:{x:originX+TOWN_TILE*2.10,y:originY+TOWN_TILE*1.40},inn:{x:originX-layoutW*.37,y:originY+layoutH*.22},herbalist:{x:originX+layoutW*.37,y:originY+layoutH*.09},guild:{x:originX-layoutW*.25,y:originY-layoutH*.36},'lower-gate':{x:originX,y:deepGateY+TOWN_TILE*1.35}};
    const buildings=[];
    const locations=(town.locations||[]).map((loc,i)=>{const p=pos[loc.id]||{x:originX+(i%2?1:-1)*layoutW*.35,y:originY+(i-2)*TOWN_TILE*1.6};if(TOWN_BUILDING_IDS.has(loc.id)){const w=(loc.id==='guild'?5.6:4.8)*TOWN_TILE,h=(loc.id==='guild'?4.1:3.6)*TOWN_TILE;buildings.push({id:loc.id,x:p.x,y:p.y-TOWN_TILE*.55,w,h,service:true});return {...loc,x:p.x,y:p.y+h/2+TOWN_TILE*.35};}return {...loc,x:p.x,y:p.y};});

    // Non-service houses are still real geometry: they draw, collide and shape
    // the streets, but they do not open arbitrary menus. This is what makes a
    // settlement read as a place rather than three buttons standing in a field.
    const decorative=village?[
      [-.479,.446,3.8,3.0],[-.146,.417,3.5,2.8],[.156,.432,3.8,3.0],[.438,.387,3.8,3.0],
      [.458,-.313,3.7,3.0],[.219,-.357,3.6,2.9],[.021,-.432,3.6,2.9],[-.469,-.089,3.8,3.0]
    ]:city?[
      [-.495,.430,4.0,3.1],[-.252,.443,3.7,3.0],[0,.443,3.8,3.0],[.252,.443,4.2,3.2],[.495,.417,3.8,3.0],
      [-.521,-.247,4.0,3.1],[-.017,-.469,4.1,3.1],[.217,-.456,4.0,3.1],[.451,-.404,4.0,3.1],[.521,-.182,3.8,3.0]
    ]:[];
    decorative.forEach((d,i)=>buildings.push({id:`house-${i+1}`,x:originX+layoutW*d[0],y:originY+layoutH*d[1],w:TOWN_TILE*d[2],h:TOWN_TILE*d[3],decorative:true,variant:i%4}));
    const stalls=[
      {x:originX-TOWN_TILE*2.7,y:originY+TOWN_TILE*.45,w:TOWN_TILE*2.0,h:TOWN_TILE*1.15},
      {x:originX+TOWN_TILE*.85,y:originY-TOWN_TILE*.15,w:TOWN_TILE*2.0,h:TOWN_TILE*1.15},
      {x:originX-TOWN_TILE*.7,y:originY+TOWN_TILE*2.2,w:TOWN_TILE*2.0,h:TOWN_TILE*1.05},
      ...(city||village?[{x:originX+TOWN_TILE*3.0,y:originY+TOWN_TILE*2.05,w:TOWN_TILE*1.8,h:TOWN_TILE*1.05}]:[])
    ];
    const signX=originX+TOWN_TILE*1.55,signY=shallowGateY+TOWN_TILE*1.65;
    const approachT=.34,approachSignX=shallowJoinX+(shallowBendX-shallowJoinX)*approachT+(pocketSign>0?-TOWN_TILE*1.4:TOWN_TILE*1.4),approachSignY=shallowJoinY+(shallowBendY-shallowJoinY)*approachT;
    return {...town,depth,placement:pocket?'pocket':'route',pocketSign,entryX:shallowJoinX,entryY,entryTx,entryTy,originX,originY,layoutW,layoutH,halfW,halfH,shallowGateY,deepGateY,gateY,deepRoadEndY,shallowJoinX,shallowJoinY,shallowBendX,shallowBendY,deepJoinX,deepJoinY,deepBendX,deepBendY,wallSegs,signX,signY,approachSignX,approachSignY,locations,buildings,stalls};
  }

  refreshTowns(){
    const towns=this.getTowns?.()||[];
    const sig=towns.map(t=>`${t.id}:${Number(t.depth)||0}:${t.current?1:0}:${t.departed?1:0}`).join('|');
    if(sig===this.townSignature){this.towns=towns;for(let i=0;i<this.townPlanCache.length;i++)if(towns[i])Object.assign(this.townPlanCache[i],{current:!!towns[i].current,departed:!!towns[i].departed,visited:!!towns[i].visited});return;}
    this.townSignature=sig;this.towns=towns;this.townPlanCache=towns.map(t=>this.makeTownPlan(t)).filter(Boolean);this.reachabilityCache.clear();this.wallCache.clear();this.minimapFloorCache.clear();this.ambientBoulderSpecCache?.clear();this.ordinaryEcologySectorCache?.clear();this.starterOreSpecCache=undefined;this.minimapDirty=true;
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
      if(t.authored){
        // Dawngate owns its full authored footprint. The procedural biome floor
        // remains underneath, but cave walls cannot punch through the template.
        const b=t.artBounds||{x:0,y:0,w:t.layoutW,h:t.layoutH},minX=t.templateOriginX+Math.min(0,b.x)-TOWN_TILE*.8,maxX=t.templateOriginX+Math.max(t.layoutW,b.x+b.w)+TOWN_TILE*.8,minY=t.templateOriginY+Math.min(0,b.y)-TOWN_TILE*.8,maxY=t.templateOriginY+Math.max(t.layoutH,b.y+b.h)+TOWN_TILE*.8;
        if(x>=minX&&x<=maxX&&y>=minY&&y<=maxY)return true;
        // Only the OUT/deep gate needs to join procedural geography. Aligning
        // this anchor with y=0 makes the first negative-y step the first fathom.
        if(this.pointSegmentDistance(x,y,t.deepGateX,t.deepGateY,t.deepJoinX,t.deepJoinY)<=TOWN_TILE*3.15)return true;
        continue;
      }
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
    return this.townPlans().some(t=>{
      if(t.authored){const b=t.artBounds||{x:0,y:0,w:t.layoutW,h:t.layoutH},margin=TOWN_TILE*1.5,minX=t.templateOriginX+Math.min(0,b.x)-margin,maxX=t.templateOriginX+Math.max(t.layoutW,b.x+b.w)+margin,minY=t.templateOriginY+Math.min(0,b.y)-margin,maxY=t.templateOriginY+Math.max(t.layoutH,b.y+b.h)+margin;return x>=minX&&x<=maxX&&y>=minY&&y<=maxY;}
      return Math.abs(x-t.originX)<=t.halfW+TOWN_TILE*1.5&&Math.abs(y-t.originY)<=t.halfH+TOWN_TILE*1.5;
    });
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
    if(this.sealedTownGates.size)this.sealedTownGates.clear();
  }

  townObstacleCollides(x,y,r){
    for(const t of this.townPlans()){
      if(t.authored){if((t.collisionRects||[]).some(rect=>this.townRectHit(x,y,r,rect)))return true;continue;}
      if(Math.abs(y-t.originY)>t.halfH+TOWN_TILE*6)continue;
      if(t.buildings.some(b=>this.townRectHit(x,y,r,b)))return true;
      if(t.stalls.some(b=>this.townRectHit(x,y,r,b)))return true;
      if(t.wallSegs.some(b=>this.townRectHit(x,y,r,b)))return true;
    }
    return false;
  }

  smithingBlacksmithAnchor(town=null){
    const t=town||this.townPlans().find(v=>String(v?.id||'')===AUTHORED_START_TOWN_ID&&v?.authored);
    if(!t)return null;
    const npc=(t.npcs||[]).find(v=>String(v?.role||'')==='blacksmith');
    return npc?{x:Number(npc.x)||0,y:Number(npc.y)||0,town:t,npc}:null;
  }

  smithingAnvilWorldPosition(town=null){
    const anchor=this.smithingBlacksmithAnchor(town);if(!anchor)return null;
    const cfg=this.devPlacementConfig?.smithingAnvil||this.defaultDevPlacementConfig().smithingAnvil;
    return{x:anchor.x+(Number(cfg.offsetX)||0),y:anchor.y+(Number(cfg.offsetY)||0),scale:Number(cfg.scale)||1,anchor};
  }

  smithingStationEntities(t){
    if(!t?.authored||String(t.id)!==AUTHORED_START_TOWN_ID)return[];
    const out=[],objects=t.template?.objects||[];
    const furnace=objects.find(o=>this.authoredFilename(o?.assetPath).toLowerCase()==='furnace1.png');
    if(furnace){
      const scale=Math.max(.01,Number(furnace.scale)||1),door=furnace.door||{},lx=(Number(furnace.x)||0)+(door.enabled===false?(Number(furnace.assetWidth)||32)*.5:(Number(door.x)||((Number(furnace.assetWidth)||32)*.5)))*scale,ly=(Number(furnace.y)||0)+(door.enabled===false?(Number(furnace.assetHeight)||32):(Number(door.y)||Number(furnace.assetHeight)||32))*scale;
      out.push({type:'smithingstation',station:'furnace',id:`smithing:${t.id}:furnace`,x:t.templateOriginX+lx,y:t.templateOriginY+ly,town:t,drawAsset:false,label:'Furnace'});
    }
    const anvil=this.smithingAnvilWorldPosition(t);
    if(anvil)out.push({type:'smithingstation',station:'anvil',id:`smithing:${t.id}:anvil`,x:anvil.x,y:anvil.y,town:t,drawAsset:true,label:'Anvil',scale:anvil.scale});
    return out;
  }

  townEntities(ptx,pty,rx,ry){
    const out=[];
    for(const t of this.townPlans()){
      if(t.authored){
        for(const npc of t.serviceNpcs||[]){const x=Number.isFinite(Number(npc.interactionX))?Number(npc.interactionX):npc.x,y=Number.isFinite(Number(npc.interactionY))?Number(npc.interactionY):npc.y,tx=Math.floor(x/TILE),ty=Math.floor(y/TILE);if(Math.abs(tx-ptx)<=rx+5&&Math.abs(ty-pty)<=ry+5)out.push({type:'townlocation',id:`town:${t.id}:${npc.location.id}:${npc.id}`,x,y,location:npc.location,town:t,authoredNpc:true,npc});}
        for(const npc of t.npcs||[]){if(npc.service)continue;const tx=Math.floor(npc.x/TILE),ty=Math.floor(npc.y/TILE);if(Math.abs(tx-ptx)<=rx+5&&Math.abs(ty-pty)<=ry+5)out.push({type:'townnpc',id:`townnpc:${t.id}:${npc.id}`,x:npc.x,y:npc.y,town:t,npc,authoredNpc:true});}
        for(const station of this.smithingStationEntities(t)){const tx=Math.floor(station.x/TILE),ty=Math.floor(station.y/TILE);if(Math.abs(tx-ptx)<=rx+5&&Math.abs(ty-pty)<=ry+5)out.push(station);}
        continue;
      }
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

  setAtmosphereEffectsEnabled(enabled=true){
    this.atmosphereEffectsEnabled=!!enabled;
    return this.atmosphereEffectsEnabled;
  }

  setEdgeAtmosphereEnabled(enabled=true){
    this.edgeAtmosphereEnabled=!!enabled;
    return this.edgeAtmosphereEnabled;
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

  getPlayerSprite(className){
    const key=PLAYER_SPRITE_FILES[className]?className:'Votary';
    let rec=this.playerSprites.get(key);
    if(rec)return rec.ready?rec.img:null;
    const img=new Image();
    rec={img,ready:false};
    this.playerSprites.set(key,rec);
    img.onload=()=>rec.ready=true;
    img.onerror=()=>rec.ready=false;
    img.src=PLAYER_SPRITE_DIR+PLAYER_SPRITE_FILES[key];
    return null;
  }

  getCleanedPlayerSprite(sprite){
    if(!sprite)return null;
    if(!this.cleanedPlayerSpriteCache)this.cleanedPlayerSpriteCache=new WeakMap();
    const cached=this.cleanedPlayerSpriteCache.get(sprite);
    if(cached)return cached;
    const w=sprite.naturalWidth||sprite.width||0,h=sprite.naturalHeight||sprite.height||0;
    if(!w||!h){this.cleanedPlayerSpriteCache.set(sprite,sprite);return sprite;}
    const off=document.createElement('canvas');
    off.width=w;off.height=h;
    const oc=off.getContext('2d',{willReadFrequently:true});
    if(!oc){this.cleanedPlayerSpriteCache.set(sprite,sprite);return sprite;}
    oc.imageSmoothingEnabled=false;
    oc.drawImage(sprite,0,0,w,h);
    const img=oc.getImageData(0,0,w,h),d=img.data;
    const corners=[[0,0],[w-1,0],[0,h-1],[w-1,h-1]].map(([x,y])=>{const i=(y*w+x)*4;return[d[i],d[i+1],d[i+2],d[i+3]];});
    if(corners.some(c=>c[3]<180)){this.cleanedPlayerSpriteCache.set(sprite,sprite);return sprite;}
    const avg=[0,0,0];
    for(const c of corners){avg[0]+=c[0];avg[1]+=c[1];avg[2]+=c[2];}
    avg[0]/=corners.length;avg[1]/=corners.length;avg[2]/=corners.length;
    const similar=c=>Math.abs(c[0]-avg[0])<=14&&Math.abs(c[1]-avg[1])<=14&&Math.abs(c[2]-avg[2])<=14;
    if(!corners.every(similar)){this.cleanedPlayerSpriteCache.set(sprite,sprite);return sprite;}
    for(let i=0;i<d.length;i+=4){
      if(d[i+3]<180)continue;
      if(Math.abs(d[i]-avg[0])<=16&&Math.abs(d[i+1]-avg[1])<=16&&Math.abs(d[i+2]-avg[2])<=16)d[i+3]=0;
    }
    oc.putImageData(img,0,0);
    this.cleanedPlayerSpriteCache.set(sprite,off);
    return off;
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

  minimapEnemyDot(entity,ctx,originCx,originCy,cellPx){
    if(!entity||!['foe','midboss','boss'].includes(entity.type)||entity.combatEvading)return;
    const tx=Math.floor(Number(entity.x)/TILE),ty=Math.floor(Number(entity.y)/TILE);
    if(!Number.isFinite(tx)||!Number.isFinite(ty)||!this.isExploredTile(tx,ty))return;
    // Unlike landmark markers, enemies use their live position inside the map
    // cell so movement is readable instead of snapping between cell centres.
    const ex=(Number(entity.x)/TILE)/MINIMAP_CELL_TILES,ey=(Number(entity.y)/TILE)/MINIMAP_CELL_TILES;
    const x=(ex-originCx)*cellPx,y=(ey-originCy)*cellPx;
    const size=entity.type==='boss'||entity.type==='midboss'?4:3;
    ctx.fillStyle='#d84a43';
    ctx.fillRect(Math.round(x-size/2),Math.round(y-size/2),size,size);
  }

  minimapPickaxeImage(){
    const rec=this.minimapOreIcon||(this.minimapOreIcon={img:null,ready:false,failed:false});
    if(rec.ready)return rec.img;
    if(rec.failed||rec.img)return null;
    const img=new Image();rec.img=img;
    img.onload=()=>{rec.ready=true;this.minimapDirty=true;this.drawMinimap(true);};
    img.onerror=()=>{rec.failed=true;rec.ready=false;};
    img.src=MINIMAP_ORE_ICON_PATH;
    return null;
  }

  minimapOreMarker(tx,ty,ctx,originCx,originCy,cellPx){
    if(!this.isExploredTile(Math.floor(tx),Math.floor(ty)))return;
    const ex=(Number(tx)+.5)/MINIMAP_CELL_TILES,ey=(Number(ty)+.5)/MINIMAP_CELL_TILES;
    const x=(ex-originCx)*cellPx,y=(ey-originCy)*cellPx;
    const cfg=this.devPlacementConfig?.oreMinimap||this.defaultDevPlacementConfig().oreMinimap;
    const size=Math.max(3,Number(cfg?.iconSize)||8),img=this.minimapPickaxeImage();
    ctx.save();ctx.imageSmoothingEnabled=false;
    if(img)ctx.drawImage(img,Math.round(x-size/2),Math.round(y-size/2),size,size);
    else{
      // Fallback is deliberately tiny and schematic. The real project icon at
      // assets/ui/mini-pickaxe-icon.png takes over as soon as it loads.
      ctx.translate(Math.round(x),Math.round(y));ctx.rotate(-Math.PI/4);
      ctx.fillStyle='#8a6239';ctx.fillRect(-1,-1,2,6);
      ctx.fillStyle='#b9c0bd';ctx.fillRect(-4,-3,8,2);ctx.fillRect(-4,-2,2,2);
    }
    ctx.restore();
  }

  minimapOreVeins(ptx,pty,rangeX,rangeY){
    const out=[],tyLo=pty-rangeY-4,tyHi=pty+rangeY+4,sy0=Math.floor(tyLo/ORE_SECTOR_TILES)-1,sy1=Math.floor(tyHi/ORE_SECTOR_TILES)+1;
    for(let sy=sy0;sy<=sy1;sy++){
      const plan=this.orePlanForSector(sy);if(!plan)continue;
      if(Math.abs(plan.tx-ptx)>rangeX+6||Math.abs(plan.ty-pty)>rangeY+6)continue;
      const depth=depthFromY(plan.ty*TILE);if(depth<3||depth>=ORE_MAX_DEPTH)continue;
      if(this.townSafeZone(plan.tx,plan.ty)||this.bossExclusionAtTile(plan.tx,plan.ty)||this.sideCarvesFloor(plan.tx,plan.ty)||this.hollowSafeZone(plan.tx,plan.ty))continue;
      const id=this.entityId(`ore:${plan.oreId}`,plan.tx,plan.ty),vein=this.makeOreVein(plan.oreId,id,plan.tx,plan.ty,{veinClass:plan.veinClass});
      if(this.discoveredOre.has(String(vein.id))&&!vein.depleted&&this.isExploredTile(plan.tx,plan.ty))out.push(vein);
    }
    for(const vein of this.mainOreClusterEntities(ptx,pty,rangeX+6,rangeY+6))if(this.discoveredOre.has(String(vein.id))&&!vein.depleted&&this.isExploredTile(vein.tx,vein.ty)&&!out.some(v=>v.id===vein.id))out.push(vein);
    const starter=this.starterCopperVein(ptx,pty,rangeX+4,rangeY+4);
    if(starter&&this.discoveredOre.has(String(starter.id))&&!starter.depleted&&this.isExploredTile(starter.tx,starter.ty)&&!out.some(v=>v.id===starter.id))out.push(starter);
    for(const vein of this.sideOreEntities(ptx,pty,rangeX+8,rangeY+8))if(this.discoveredOre.has(String(vein.id))&&!vein.depleted&&this.isExploredTile(vein.tx,vein.ty)&&!out.some(v=>v.id===vein.id))out.push(vein);
    return out;
  }

  drawMinimapOreClusters(veins,ctx,originCx,originCy,cellPx){
    if(!Array.isArray(veins)||!veins.length)return;
    const cfg=this.devPlacementConfig?.oreMinimap||this.defaultDevPlacementConfig().oreMinimap,clusterRadius=Math.max(2,Number(cfg?.clusterRadiusTiles)||10),clusters=[];
    for(const vein of veins){
      let cluster=clusters.find(g=>Math.hypot(vein.tx-g.cx,vein.ty-g.cy)<=clusterRadius);
      if(!cluster){cluster={members:[],cx:vein.tx,cy:vein.ty};clusters.push(cluster);}
      cluster.members.push(vein);cluster.cx=cluster.members.reduce((sum,v)=>sum+v.tx,0)/cluster.members.length;cluster.cy=cluster.members.reduce((sum,v)=>sum+v.ty,0)/cluster.members.length;
    }
    for(const cluster of clusters){
      const marker=cluster.members.reduce((best,v)=>!best||Math.hypot(v.tx-cluster.cx,v.ty-cluster.cy)<Math.hypot(best.tx-cluster.cx,best.ty-cluster.cy)?v:best,null);
      if(marker)this.minimapOreMarker(marker.tx,marker.ty,ctx,originCx,originCy,cellPx);
    }
  }

  drawMinimap(force=false){
    const canvas=this.minimapCanvas,ctx=this.minimapCtx;if(!this.minimapOpen||!canvas||!ctx)return;
    // Static terrain/landmarks remain discovery-driven. Live enemy dots only need
    // a low-frequency tactical refresh; a full minimap redraw is comparatively
    // expensive because it samples terrain, landmarks and discovered ore.
    const dynamicEnemies=(this.activeEntities||[]).some(e=>['foe','midboss','boss'].includes(e?.type)&&!e.combatEvading)||!!(this.combatFoe&&!this.combatFoe.combatEvading);
    if(!force&&!this.minimapDirty&&(!dynamicEnemies||this.time-this.minimapLastDraw<.25))return;
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
    // Discovered, still-productive ore deposits. Nearby veins collapse into a
    // single pickaxe marker so a rich pocket stays readable instead of becoming
    // a stack of overlapping icons. Depleted veins disappear automatically.
    this.drawMinimapOreClusters(this.minimapOreVeins(ptx,pty,rangeX,rangeY),ctx,originCx,originCy,cellPx);
    // Live enemies: red dots, but only on already-explored terrain. This gives
    // tactical local awareness without using the minimap to reveal fogged space.
    const seenEnemyIds=new Set();
    for(const e of this.activeEntities||[]){
      if(!e?.id||seenEnemyIds.has(String(e.id)))continue;
      if(['foe','midboss','boss'].includes(e.type)){seenEnemyIds.add(String(e.id));this.minimapEnemyDot(e,ctx,originCx,originCy,cellPx);}
    }
    if(this.combatFoe&&(!this.combatFoe.id||!seenEnemyIds.has(String(this.combatFoe.id))))this.minimapEnemyDot(this.combatFoe,ctx,originCx,originCy,cellPx);
    const px=(pc.cx-originCx+.5)*cellPx,py=(pc.cy-originCy+.5)*cellPx;ctx.fillStyle='#e6d9aa';ctx.fillRect(Math.round(px-2),Math.round(py-2),5,5);
    ctx.restore();ctx.strokeStyle='rgba(153,128,79,.55)';ctx.strokeRect(.5,.5,cssW-1,cssH-1);
  }

  start(){this.last=performance.now();requestAnimationFrame(t=>this.loop(t));}
  setInputEnabled(v){this.inputEnabled=!!v;if(!v){this.cancelMining('ui');this.joy.x=this.joy.y=0;this.player.moving=false;}}
  setCombat(v){this.combat=!!v;if(!this.combat){if(this.playerFacingBeforeCombat)this.player.facing=this.playerFacingBeforeCombat;this.playerFacingBeforeCombat=null;this.combatFoe=null;this.combatEntityId=null;this.combatPlayerRange=10;this.combatPlayerMelee=true;this.combatPlayerInRange=false;this.combatEnemyThreatRange=10;this.combatThreatActive=false;this.combatPlayerAttacking=false;this.playerReachGuideVisible=false;this.autoApproach=false;}}
  setCombatPlayerAttacking(v=true){this.combatPlayerAttacking=!!v;}
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

  manualMovementAwayFrom(entity=this.combatFoe){
    if(!entity)return false;
    const m=this.movementVector(),ml=Math.hypot(m.x,m.y);if(ml<=.08)return false;
    const dx=entity.x-this.player.x,dy=entity.y-this.player.y,dl=Math.hypot(dx,dy);if(dl<=.001)return false;
    // Negative dot = the deliberate input points away from the current target.
    // A small dead zone preserves side-strafing/kiting without keeping a stale
    // attack order when the player clearly turns and leaves the engagement.
    return (m.x*dx+m.y*dy)/(ml*dl)<-.18;
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
      this.reachabilityCache.clear();this.wallCache.clear();this.minimapFloorCache.clear();this.ambientBoulderSpecCache?.clear();this.ordinaryEcologySectorCache?.clear();this.starterOreSpecCache=undefined;this.minimapDirty=true;
    }else this.worldEvents=next;
  }

  update(dt){
    this.expireLootBags();
    this.refreshWorldEvents();this.refreshTowns();this.refreshSidePlan();
    this.ensurePlayerSafe();
    if(this.inputEnabled){
      const m=this.movementVector();
      const wantsMove=Math.hypot(m.x,m.y)>.08;
      this.player.moving=false;
      if(wantsMove){
        if(this.activeMining)this.cancelMining('movement');
        this.autoApproach=false;
        if(Math.abs(m.y)>=Math.abs(m.x))this.player.dir=m.y<0?'up':'down';
        else{this.player.dir=m.x<0?'left':'right';this.player.facing=this.player.dir;}
        // Only count real displacement as movement. Holding the stick/key into a
        // wall must not advance travel timers or schedule world events.
        this.player.moving=this.movePlayer(m.x*this.player.speed*dt,m.y*this.player.speed*dt);
      }else if(this.autoApproach&&this.combatFoe&&!this.combatFoe.combatEvading){
        const gap=this.combatSurfaceGap(this.combatFoe),stop=Math.max(0,Number(this.combatPlayerRange)||0)-.75;
        if(gap>stop){
          const dx=this.combatFoe.x-this.player.x,dy=this.combatFoe.y-this.player.y,len=Math.hypot(dx,dy)||1,step=Math.min(this.player.speed*dt,Math.max(0,gap-stop));
          if(step>.01){if(Math.abs(dy)>=Math.abs(dx))this.player.dir=dy<0?'up':'down';else{this.player.dir=dx<0?'left':'right';this.player.facing=this.player.dir;}this.player.moving=this.movePlayer(dx/len*step,dy/len*step);}
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
    const ptx=Math.floor(this.player.x/TILE),pty=Math.floor(this.player.y/TILE),radii=this.entityRadii(),refresh=this.activeEntityRefresh||{ptx:null,pty:null,rx:null,ry:null,last:-999};
    // Rebuild static/procedural nearby entities immediately when entering a new
    // tile, otherwise at 5 Hz as a safety refresh. Previously this scanned every
    // visible tile at ~60 Hz, which made lag strongly dependent on what was on
    // screen. Mutable roamer references still animate/think every frame below.
    if(refresh.ptx!==ptx||refresh.pty!==pty||refresh.rx!==radii.rx||refresh.ry!==radii.ry||this.time-refresh.last>=.20){
      this.activeEntities=this.dynamicEntities();
      refresh.ptx=ptx;refresh.pty=pty;refresh.rx=radii.rx;refresh.ry=radii.ry;refresh.last=this.time;this.activeEntityRefresh=refresh;
    }
    for(const e of this.activeEntities){
      if(e?.type!=='ore'||e.depleted||Math.hypot(e.x-this.player.x,e.y-this.player.y)>TILE*8)continue;
      const id=String(e.id||'');if(!id||this.discoveredOre.has(id))continue;
      this.discoveredOre.add(id);this.minimapDirty=true;
    }
    if(this.inputEnabled){this.updateRoamers(dt,this.activeEntities);this.updateBossActors(dt,this.activeEntities);}
    this.separateWorldActors(this.activeEntities);
    this.updateMining(dt);
    this.updateSmithingForge(dt);
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
      if(current.authored){
        // The Workshop IN and OUT anchors are independent points; do not assume
        // both gates share the settlement centre X like the old generated town.
        const gateHalf=TILE*3.1,deepAligned=Math.abs(this.player.x-current.deepGateX)<=gateHalf,shallowAligned=Math.abs(this.player.x-current.shallowGateX)<=gateHalf,leftDeep=deepAligned&&this.player.y<current.deepGateY,leftShallow=shallowAligned&&this.player.y>current.shallowGateY;
        if(leftDeep||leftShallow){const key=`leave-town:${current.id}:${leftDeep?'deep':'shallow'}`;if(this.transitionLock!==key){this.transitionLock=key;this.onSettlementLeave?.(current);}return;}
      }else{
        const aligned=Math.abs(this.player.x-current.originX)<=TOWN_GATE_HALF_WIDTH+TILE;
        const leftShallow=this.player.y>current.shallowGateY+TILE*.85;
        const leftDeep=this.player.y<current.deepGateY-TILE*.85;
        if(aligned&&(leftShallow||leftDeep)){
          const key=`leave-town:${current.id}:${leftDeep?'deep':'shallow'}`;
          if(this.transitionLock!==key){this.transitionLock=key;this.onSettlementLeave?.(current);}
          return;
        }
      }
    }else{
      for(const t of this.townPlans()){
        if(t.authored){
          const gateHalf=TILE*3.1,deepEntry=Math.abs(this.player.x-t.deepGateX)<=gateHalf&&this.player.y>=t.deepGateY&&this.player.y<t.deepGateY+TILE*3.5,shallowEntry=Math.abs(this.player.x-t.shallowGateX)<=gateHalf&&this.player.y<=t.shallowGateY&&this.player.y>t.shallowGateY-TILE*3.5;
          if(deepEntry||shallowEntry){const key=`enter-town:${t.id}`;if(this.transitionLock!==key){this.transitionLock=key;this.visitedSettlements.add(t.id);this.onSettlementEnter?.(t);}return;}
          continue;
        }
        const insideVertical=this.player.y<t.shallowGateY-TILE*.35&&this.player.y>t.deepGateY+TILE*.35;
        const aligned=Math.abs(this.player.x-t.originX)<=TOWN_GATE_HALF_WIDTH+TILE*.65;
        if(insideVertical&&aligned){
          const key=`enter-town:${t.id}`;
          if(this.transitionLock!==key){this.transitionLock=key;this.visitedSettlements.add(t.id);this.onSettlementEnter?.(t);}
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

  oreCollides(x,y,r=this.player.r){
    for(const e of this.activeEntities){
      if(e?.type!=='ore')continue;
      const ex=Number(e.x)||0,ey=(Number(e.y)||0)+3,cls=String(e.veinClass||'standard'),sizes=this.devPlacementConfig?.oreVeins||this.defaultDevPlacementConfig().oreVeins,scale=Math.max(.6,Number(sizes?.[`${cls}Scale`])||1);
      const baseRX=cls==='rich'?16:cls==='remote'?13:11,baseRY=cls==='rich'?10:cls==='remote'?8:7;
      const rx=(e.depleted?baseRX*.72:baseRX)*scale+Math.max(1,Number(r)||0),ry=(e.depleted?baseRY*.68:baseRY)*scale+Math.max(1,Number(r)||0)*.85;
      const dx=(x-ex)/Math.max(1,rx),dy=(y-ey)/Math.max(1,ry);
      if(dx*dx+dy*dy<1)return true;
    }
    return false;
  }

  smithingStationCollides(x,y,r=this.player.r){
    const anvil=this.smithingAnvilWorldPosition();if(!anvil)return false;
    const rr=7*Math.max(.6,Number(anvil.scale)||1)+Math.max(1,Number(r)||0);
    return Math.hypot(x-anvil.x,y-(anvil.y+2))<rr;
  }

  collisionReason(x,y,r,{ignoreBossGate=false}={}){
    if(this.sideBarrierCollides(x,y,r))return 'side-stage';
    if(this.townObstacleCollides(x,y,r))return 'town-structure';
    if(!ignoreBossGate){const bossGate=this.bossGateReason(x,y,r);if(bossGate)return bossGate;}
    if([[x-r,y-r],[x+r,y-r],[x-r,y+r],[x+r,y+r]].some(([px,py])=>this.isWall(Math.floor(px/TILE),Math.floor(py/TILE))))return 'rock';
    if(this.ambientBoulderCollides(x,y,r))return 'boulder';
    if(this.oreCollides(x,y,r))return 'ore';
    if(this.smithingStationCollides(x,y,r))return 'anvil';
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
    const createdAt=Date.now();
    const bag={type:'loot',id:key,recordId:String(recordId),x:Number(x)||this.player.x,y:Number(y)||this.player.y,createdAt,expiresAt:createdAt+LOOT_BAG_LIFETIME_MS};
    this.lootBags.set(key,bag);
    return bag;
  }

  expireLootBags(now=Date.now()){
    let changed=false;
    for(const [id,bag] of [...this.lootBags]){
      if(Number(bag?.expiresAt)>now)continue;
      this.lootBags.delete(id);changed=true;this.onLootExpired?.(bag);
    }
    return changed;
  }

  removeLootBag(id){if(!id)return false;return this.lootBags.delete(String(id));}

  getRoamer(id,tx,ty,foe){
    let e=this.roamers.get(id);
    if(!e){
      const x=(tx+.5)*TILE,y=(ty+.5)*TILE;
      e={type:'foe',id,tx,ty,homeTx:tx,homeTy:ty,homeX:x,homeY:y,x,y,foe,targetX:x,targetY:y,facing:'right',roamTimer:1+hash2(tx,ty,this.seed+341)*2.5,speed:12+hash2(tx,ty,this.seed+721)*10};
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
    const x=(tx+.5)*TILE,y=(ty+.5)*TILE;if(this.ambientBoulderCollides(x,y,10)||this.mainOreBlocksTile(tx,ty,2))return false;
    return this.isSpawnAccessible(tx,ty);
  }

  ecologySpawnChance(profile,depth){
    const d=Math.max(0,Number(depth)||0),bands=Array.isArray(profile?.ecology)?profile.ecology:[];
    for(const band of bands){
      const min=Math.max(0,Number(band?.min)||0),max=band?.max==null?Infinity:Number(band.max);
      if(d>=min&&d<max){
        // Creature frequency is now scaled separately from which creatures exist.
        // Doubling this multiplier increases overall ecology pressure without
        // forcing us to rebalance every individual authored profile by hand.
        return clamp((Number(band?.chance)||0)*ECOLOGY_SPAWN_RATE_MULTIPLIER,0,.98);
      }
    }
    return 0;
  }

  ecologyProfilesAtDepth(profiles,depth){
    const d=Math.max(0,Number(depth)||0);
    return (profiles||[]).filter(f=>d>=Number(f.unlock||0)&&(f.maxDepth==null||d<Number(f.maxDepth))&&this.ecologySpawnChance(f,d)>0);
  }

  ordinaryEcologySectorSpawns(sx,sy,profiles){
    const cacheKey=`${sx}:${sy}`;
    if(this.ordinaryEcologySectorCache.has(cacheKey))return this.ordinaryEcologySectorCache.get(cacheKey);
    const size=ORDINARY_ECOLOGY_SECTOR_TILES,x0=sx*size,y0=sy*size;
    const depth=depthFromY((y0+size*.5)*TILE),eligible=this.ecologyProfilesAtDepth(profiles,depth),out=[];
    if(!eligible.length){this.ordinaryEcologySectorCache.set(cacheKey,out);return out;}

    // Each profile gets a deterministic roll keyed by its own id. Crucially, the
    // roll does not use array position or pool size: adding another monster later
    // cannot change whether an existing monster passed its spawn roll.
    for(const foe of eligible){
      const creatureSeed=stableCreatureSeed(foe.id),chance=this.ecologySpawnChance(foe,depth);
      const roll=hash2(sx+(creatureSeed%1009),sy-(creatureSeed%1013),this.seed+3701+(creatureSeed%1000003));
      if(roll>=chance)continue;

      let placed=null;
      // Position selection is also keyed to this creature, so its home does not
      // slide around merely because another profile is added to the catalogue.
      for(let attempt=0;attempt<36;attempt++){
        const tx=x0+1+Math.floor(hash2(sx*37+attempt+(creatureSeed%97),sy*19-attempt,this.seed+3719+(creatureSeed%7919))*(size-2));
        const ty=y0+1+Math.floor(hash2(sx*23-attempt,sy*41+attempt+(creatureSeed%89),this.seed+3733+(creatureSeed%7877))*(size-2));
        if(!this.ordinaryEcologySpawnTile(tx,ty))continue;
        // Only reject an exact occupied tile. Nearby monsters are allowed: their
        // independent successful rolls are real ecology, not a shared spawn pie.
        if(out.some(sp=>sp.tx===tx&&sp.ty===ty))continue;
        placed={tx,ty,foe};break;
      }
      if(placed)out.push(placed);
    }
    this.ordinaryEcologySectorCache.set(cacheKey,out);
    return out;
  }

  ordinaryEcologyEntities(ptx,pty,rx,ry){
    const size=ORDINARY_ECOLOGY_SECTOR_TILES,candidates=[];
    const sx0=Math.floor((ptx-rx-2)/size),sx1=Math.floor((ptx+rx+2)/size);
    const sy0=Math.floor((pty-ry-2)/size),sy1=Math.floor((pty+ry+2)/size);
    const profiles=this.getProfiles();
    if(!profiles.length)return candidates;
    for(let sy=sy0;sy<=sy1;sy++)for(let sx=sx0;sx<=sx1;sx++){
      for(const sp of this.ordinaryEcologySectorSpawns(sx,sy,profiles)){
        if(Math.abs(sp.tx-ptx)>rx+3||Math.abs(sp.ty-pty)>ry+3)continue;
        // Sector + profile id gives each species its own persistent population
        // identity. A later species addition cannot rename/replace this creature.
        const id=`ecofoe:${sx}:${sy}:${sp.foe.id}`;
        if(this.defeated.has(id)||id===this.combatEntityId)continue;
        const e=this.getRoamer(id,sp.tx,sp.ty,sp.foe);
        const dx=e.x-this.player.x,dy=e.y-this.player.y;
        candidates.push({e,dist2:dx*dx+dy*dy});
      }
    }
    // The probabilities are independent; this cap is only a safety valve for the
    // number of simultaneous nearby actors, not a weighting mechanism.
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
      if(this.collides(x,y,8,{ignoreBossGate:true}))continue;
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
          const dx=homeX-e.x,dy=homeY-e.y,len=Math.hypot(dx,dy)||1,step=Math.min(len,150*dt);if(Math.abs(dx)>.1)e.facing=dx<0?'left':'right';if(step>0)this.moveWorldActor(e,dx/len*step,dy/len*step,10);
          if(len<8){e.x=homeX;e.y=homeY;e.targetX=homeX;e.targetY=homeY;e.combatEvading=false;e.hostile=false;e.combatTelegraph='';if(Number.isFinite(Number(e.combatHpMax)))e.combatHp=e.combatHpMax;if(e.combatLegacyState&&Number.isFinite(Number(e.combatLegacyState.hpMax)))e.combatLegacyState.hp=e.combatLegacyState.hpMax;}
          continue;
        }
        // A telegraphed Heavy is a commitment. Secondary hostiles must root in
        // place during the wind-up too; otherwise their red danger circle chases
        // the player and the dodge telegraph is functionally dishonest.
        if(e.combatTelegraph==='HEAVY')continue;
        const gap=this.combatSurfaceGap(e),dx=this.player.x-e.x,dy=this.player.y-e.y,len=Math.hypot(dx,dy)||1,desired=2;
        if(Math.abs(dx)>.1)e.facing=dx<0?'left':'right';
        if(gap>desired){const step=Math.min(Math.max(0,gap-desired),Math.max(48,Number(e.speed)||80)*dt);if(step>0)this.moveWorldActor(e,dx/len*step,dy/len*step,10);}
        continue;
      }
      e.roamTimer-=dt;let dx=e.targetX-e.x,dy=e.targetY-e.y,dist=Math.hypot(dx,dy);
      if(e.roamTimer<=0||dist<2){this.pickRoamTarget(e);dx=e.targetX-e.x;dy=e.targetY-e.y;dist=Math.hypot(dx,dy);}
      if(dist>1){
        const step=Math.min(dist,e.speed*dt),nx=e.x+dx/dist*step,ny=e.y+dy/dist*step,ntx=Math.floor(nx/TILE),nty=Math.floor(ny/TILE),sidePlan=e.sidePlanId?this.sidePlanById(e.sidePlanId):null;if(Math.abs(dx)>.1)e.facing=dx<0?'left':'right';
        const legal=sidePlan?(!this.collides(nx,ny,7)&&this.sidePlanCarvesFloor(sidePlan,ntx,nty)&&!this.hollowSafeZone(ntx,nty)&&!this.townEnemyExclusionAtTile(ntx,nty)&&!this.bossExclusionAtTile(ntx,nty)):(!this.collides(nx,ny,7)&&this.isSpawnAccessible(ntx,nty)&&!this.hollowSafeZone(ntx,nty)&&!this.townEnemyExclusionAtTile(ntx,nty)&&!this.bossExclusionAtTile(ntx,nty)&&!this.sideCarvesFloor(ntx,nty));
        if(legal&&!this.worldActorCollidesOther(e,nx,ny,7)){e.x=nx;e.y=ny;}else this.pickRoamTarget(e);
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
      if(this.sideOreBlocksTile(plan,tx,ty,2.5))continue;
      if(out.some(p=>Math.hypot(p.tx-tx,p.ty-ty)<4))continue;
      out.push({tx,ty,index:out.length});
    }
    return out;
  }

  sideEcologyEntities(ptx,pty,rx,ry){
    const out=[],profiles=this.getProfiles();if(!profiles.length)return out;
    for(const plan of this.sideContentPlans()){
      if(!plan)continue;const points=this.sideEcologySpawnPoints(plan);if(!points.length)continue;const d=Math.max(0,Number(plan.depth)||0),eligible=this.ecologyProfilesAtDepth(profiles,d);if(!eligible.length)continue;
      const wanted=Math.min(points.length,d<150?2:d<320?3:4),seed=Number(plan.shapeSeed)||plan.mouthTx;
      for(let i=0;i<wanted;i++){
        const sp=points[i%points.length];if(Math.abs(sp.tx-ptx)>rx+5||Math.abs(sp.ty-pty)>ry+5)continue;const foe=eligible[Math.floor(hash2(seed,i+3773,this.seed+3779)*eligible.length)%eligible.length],id=`sidefoe:${plan.id}:${i}:${foe.id}`;
        if(this.defeated.has(id)||id===this.combatEntityId)continue;const e=this.getRoamer(id,sp.tx,sp.ty,foe);e.sidePlanId=String(plan.id);out.push(e);
      }
    }
    return out;
  }

  sideBonusEntities(ptx,pty,rx,ry){
    const out=[];for(const plan of this.sideContentPlans()){
      const g=this.sideNetworkGeometry(plan),seed=Number(plan.shapeSeed)||plan.mouthTx,candidates=[];if(g?.rooms?.length){for(const r of g.rooms)candidates.push({tx:Math.round(r.x),ty:Math.round(r.y)});}else{for(const u of [.55,.82].map(v=>(Number(plan.lengthTiles)||50)*v)){const q=this.sidePoint(plan,u);candidates.push({tx:Math.round(q.tx),ty:Math.round(q.ty)});}}
      if(!candidates.length)continue;const far=candidates[candidates.length-1],chestId=`sidechest:${plan.id}`;if(!this.opened.has(chestId)&&Math.abs(far.tx-ptx)<=rx+5&&Math.abs(far.ty-pty)<=ry+5&&!this.sideOreBlocksTile(plan,far.tx,far.ty,2.2))out.push({type:'chest',id:chestId,tx:far.tx,ty:far.ty,x:(far.tx+.5)*TILE,y:(far.ty+.5)*TILE});
      if(candidates.length>1&&hash2(seed,6121,this.seed+6121)>.25){const q=candidates[0],glintId=`sideglint:${plan.id}`;if(!this.opened.has(glintId)&&Math.abs(q.tx-ptx)<=rx+5&&Math.abs(q.ty-pty)<=ry+5&&!this.sideOreBlocksTile(plan,q.tx,q.ty,2.2))out.push({type:'glint',id:glintId,tx:q.tx,ty:q.ty,x:(q.tx+.5)*TILE,y:(q.ty+.5)*TILE});}
    }return out;
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

  oreVariantForSector(sy){
    const r=hash2(sy,5103,this.seed+5103),std=ORE_VARIANTS.standard.weight,remote=ORE_VARIANTS.remote.weight;
    return r<std?'standard':r<std+remote?'remote':'rich';
  }

  oreCapacity(oreId,tx,ty,veinClass='standard'){
    const tin=String(oreId||'copper')==='tin',variant=ORE_VARIANTS[veinClass]||ORE_VARIANTS.standard,range=tin?variant.tin:variant.copper,min=range[0],max=range[1],span=max-min+1;
    return min+Math.floor(hash2(tx,ty,this.seed+(tin?5129:5107))*span);
  }

  oreRemainingFor(id,maxUnits){
    if(this.oreRemaining.has(id))return clamp(Math.floor(Number(this.oreRemaining.get(id))||0),0,maxUnits);
    return maxUnits;
  }

  makeOreVein(oreId,id,tx,ty,{starter=false,veinClass='standard'}={}){
    const kind=String(oreId||'copper')==='tin'?'tin':'copper',cls=starter?'standard':(ORE_VARIANTS[veinClass]?veinClass:'standard'),maxUnits=this.oreCapacity(kind,tx,ty,cls),remaining=this.oreRemainingFor(id,maxUnits);
    const tin=kind==='tin',baseName=tin?'Tin Vein':'Copper Vein',oreName=cls==='rich'?`Rich ${baseName}`:cls==='remote'?`Large ${baseName}`:baseName;
    return{type:'ore',oreId:kind,oreName,itemName:tin?'Tin Ore':'Copper Ore',id,tx,ty,x:(tx+.5)*TILE,y:(ty+.5)*TILE,maxUnits,remaining,depleted:remaining<=0,starter,veinClass:cls};
  }

  makeCopperVein(id,tx,ty,options={}){return this.makeOreVein('copper',id,tx,ty,options);}

  starterCopperSpec(){
    if(this.starterOreSpecCache!==undefined)return this.starterOreSpecCache||null;
    const baseTy=Math.floor(yFromDepth(STARTER_COPPER_DEPTH)/TILE),primarySide=hash2(baseTy,611,this.seed+5113)>.5?1:-1;
    let best=null;
    // The teaching vein has one deterministic home. Cache the expensive search;
    // callers only need to test whether that home is currently in range.
    for(const jy of [0,-2,2,-4,4,-6,6,-8,8,-10,10]){
      const ty=baseTy+jy,center=this.corridorCenter(ty);
      for(const side of [primarySide,-primarySide]){
        const edge=this.mainRouteEdgeTx(ty,center,side);
        for(const separation of [6,7,8,9,10,11]){
          const tx=edge+side*separation;
          if(!this.isSpawnAccessible(tx,ty)||this.walkableNeighborCount(tx,ty)<3)continue;
          if(this.hollowSafeZone(tx,ty)||this.bossExclusionAtTile(tx,ty)||this.townSafeZone(tx,ty)||this.sideCarvesFloor(tx,ty))continue;
          best={tx,ty};break;
        }
        if(best)break;
      }
      if(best)break;
    }
    this.starterOreSpecCache=best||false;
    return best;
  }

  starterCopperVein(ptx,pty,rx,ry){
    const best=this.starterCopperSpec();
    if(!best||Math.abs(best.tx-ptx)>rx+3||Math.abs(best.ty-pty)>ry+3)return null;
    return this.makeCopperVein('ore:copper:starter',best.tx,best.ty,{starter:true,veinClass:'standard'});
  }

  orePocketScore(tx,ty,preferredSeparation,routeEdgeTx){
    const open=this.walkableNeighborCount(tx,ty),separation=Math.abs(tx-routeEdgeTx);
    let edge=0;
    for(let oy=-2;oy<=2;oy++)for(let ox=-2;ox<=2;ox++)if(Math.abs(ox)+Math.abs(oy)>=2&&this.isWall(tx+ox,ty+oy))edge++;
    // High open-neighbour counts favour pockets/chambers. A little nearby wall
    // gives chamber-edge deposits a bonus without forcing veins into corridors.
    return open*5+Math.min(7,edge)*1.2-Math.abs(separation-preferredSeparation)*.35;
  }

  orePlanForSector(sy){
    sy=Math.floor(Number(sy)||0);if(this.orePlanCache.has(sy))return this.orePlanCache.get(sy);
    if(hash2(sy,5077,this.seed+5077)>=ORE_SECTOR_CHANCE){this.orePlanCache.set(sy,null);return null;}
    const size=ORE_SECTOR_TILES,baseTy=sy*size+2+Math.floor(hash2(sy,5081,this.seed+5081)*(size-4)),primarySide=hash2(sy,5099,this.seed+5099)>.5?1:-1;
    const veinClass=this.oreVariantForSector(sy),variant=ORE_VARIANTS[veinClass],preferred=variant.minOffset+Math.floor(hash2(sy,5101,this.seed+5101)*(variant.maxOffset-variant.minOffset+1));
    const yJitter=[0,-2,2,-4,4,-6,6,-8,8,-10,10,-12,12],offsetJitter=[0,2,-2,4,-4,6,-6,8,-8,10,-10];let plan=null,bestScore=-Infinity;
    for(const jy of yJitter){
      const ty=baseTy+jy;if(Math.floor(ty/size)!==sy)continue;
      const center=this.corridorCenter(ty);
      for(const side of [primarySide,-primarySide]){
        const routeEdge=this.mainRouteEdgeTx(ty,center,side);
        for(const jo of offsetJitter){
          const separation=clamp(preferred+jo,variant.minOffset,variant.maxOffset),tx=routeEdge+side*separation;
          if(Math.abs(tx-routeEdge)<variant.minOffset||!this.isSpawnAccessible(tx,ty)||this.walkableNeighborCount(tx,ty)<3)continue;
          if(this.hollowSafeZone(tx,ty)||this.bossExclusionAtTile(tx,ty)||this.townSafeZone(tx,ty)||this.sideCarvesFloor(tx,ty))continue;
          const score=this.orePocketScore(tx,ty,preferred,routeEdge)+hash2(tx,ty,this.seed+5111)*.5;
          if(score<=bestScore)continue;
          const oreId=hash2(sy,5119,this.seed+5119)<TIN_VEIN_SHARE?'tin':'copper';plan={sy,tx,ty,oreId,veinClass};bestScore=score;
        }
      }
    }
    this.orePlanCache.set(sy,plan);return plan;
  }

  isOreCandidate(tx,ty){const plan=this.orePlanForSector(Math.floor(ty/ORE_SECTOR_TILES));return !!plan&&plan.tx===tx&&plan.ty===ty?plan:null;}

  oreClusterExtrasForPlan(plan){
    if(!plan)return[];const key=`${plan.sy}:${plan.tx}:${plan.ty}:${plan.veinClass}:${plan.oreId}`;if(this.oreClusterPlanCache.has(key))return this.oreClusterPlanCache.get(key);
    const depth=Math.max(0,depthFromY(plan.ty*TILE)),variant=ORE_VARIANTS[plan.veinClass]||ORE_VARIANTS.standard;
    // Cluster chance and size are identical for Copper and Tin. This preserves
    // the useful "found a deposit" feeling without turning Tin into the dominant
    // ore merely because only Tin used to receive extra veins.
    const clusterChance=plan.veinClass==='rich'?.88:plan.veinClass==='remote'?.68:.48;
    if(hash2(plan.sy,5225,this.seed+5225)>=clusterChance){this.oreClusterPlanCache.set(key,[]);return[];}
    const roll=hash2(plan.sy,5227,this.seed+5227);let total=depth<140?2:(depth<300?(roll>.52?3:2):(roll>.48?4:3));if(plan.veinClass==='rich')total=Math.min(4,total+1);
    const center=this.corridorCenter(plan.ty),side=plan.tx<center?-1:1,out=[];
    const offsets=[[3,0],[-3,1],[2,-2],[-2,-2],[5,2],[-5,-1],[1,4],[-1,-4],[6,-3],[-6,3],[4,4],[-4,-4]];
    const start=Math.floor(hash2(plan.sy,5231,this.seed+5231)*offsets.length);
    for(let step=0;step<offsets.length&&out.length<total-1;step++){
      const [ox0,oy]=(offsets[(start+step)%offsets.length]),ox=ox0*side,tx=plan.tx+ox,ty=plan.ty+oy,routeEdge=this.mainRouteEdgeTx(ty,this.corridorCenter(ty),side);
      if(Math.abs(tx-routeEdge)<Math.max(2,variant.minOffset-1)||!this.isSpawnAccessible(tx,ty)||this.walkableNeighborCount(tx,ty)<2)continue;
      if(this.hollowSafeZone(tx,ty)||this.bossExclusionAtTile(tx,ty)||this.townSafeZone(tx,ty)||this.sideCarvesFloor(tx,ty))continue;
      if(out.some(v=>Math.hypot(v.tx-tx,v.ty-ty)<2.4))continue;out.push({tx,ty});
    }
    this.oreClusterPlanCache.set(key,out);return out;
  }
  mainOreClusterEntities(ptx,pty,rx,ry){
    const out=[],sy0=Math.floor((pty-ry-8)/ORE_SECTOR_TILES)-1,sy1=Math.floor((pty+ry+8)/ORE_SECTOR_TILES)+1;
    for(let sy=sy0;sy<=sy1;sy++){
      const plan=this.orePlanForSector(sy);if(!plan)continue;const extras=this.oreClusterExtrasForPlan(plan);
      for(let i=0;i<extras.length;i++){
        const q=extras[i];if(Math.abs(q.tx-ptx)>rx+5||Math.abs(q.ty-pty)>ry+5)continue;
        const id=this.entityId(`ore:${plan.oreId}`,q.tx,q.ty);out.push(this.makeOreVein(plan.oreId,id,q.tx,q.ty,{veinClass:plan.veinClass}));
      }
    }
    return out;
  }

  mainOreBlocksTile(tx,ty,padding=1.6){
    const sy0=Math.floor((ty-padding)/ORE_SECTOR_TILES)-1,sy1=Math.floor((ty+padding)/ORE_SECTOR_TILES)+1;
    for(let sy=sy0;sy<=sy1;sy++){const plan=this.orePlanForSector(sy);if(plan&&Math.hypot(plan.tx-tx,plan.ty-ty)<=padding)return true;if(plan)for(const q of this.oreClusterExtrasForPlan(plan))if(Math.hypot(q.tx-tx,q.ty-ty)<=padding)return true;}
    const starter=this.starterCopperSpec();
    return !!(starter&&Math.hypot(starter.tx-tx,starter.ty-ty)<=padding);
  }

  sideContentPlans(){
    const plans=[],seen=new Set(),push=p=>{if(!p||seen.has(String(p.id)))return;seen.add(String(p.id));plans.push(p);};push(this.activeSidePlan);for(const p of this.persistentSidePlans||[])push(p);for(const e of this.worldEvents||[])if(e?.type==="sidepassage")push(this.prospectiveSidePlan(e));return plans;
  }
  sideOreSpecsForPlan(plan){
    if(!plan)return[];const depth=Math.max(0,Number(plan.depth)||depthFromY((Number(plan.mouthTy)||0)*TILE));if(depth<3||depth>=ORE_MAX_DEPTH)return[];
    const seed=Number(plan.shapeSeed)||Math.floor(hash2(plan.mouthTx,plan.mouthTy,this.seed+5161)*1000000),g=this.sideNetworkGeometry(plan),candidates=[];
    if(g?.rooms?.length){for(let i=0;i<g.rooms.length;i++){const r=g.rooms[i];for(const phase of [.42,.68]){const a=hash2(seed,i+71+Math.round(phase*100),this.seed+5167)*Math.PI*2;candidates.push({tx:Math.round(r.x+Math.cos(a)*r.rx*phase),ty:Math.round(r.y+Math.sin(a)*r.ry*phase)});}}}
    else{for(const u of [Math.max(10,(Number(plan.lengthTiles)||50)*.42),Math.max(18,(Number(plan.lengthTiles)||50)*.66),Math.max(24,(Number(plan.lengthTiles)||50)*.86)]){const q=this.sidePoint(plan,u);candidates.push({tx:Math.round(q.tx),ty:Math.round(q.ty)});}}
    const wanted=depth<150?3:depth<320?4:5,out=[],jitter=[[0,0],[1,0],[-1,0],[0,1],[0,-1],[2,0],[-2,0],[0,2],[0,-2],[1,1],[-1,1],[1,-1],[-1,-1],[3,0],[-3,0]];
    const firstTin=hash2(seed,107,this.seed+5181)<.50;
    for(let i=0;i<candidates.length&&out.length<wanted;i++){
      const base=candidates[(i+Math.floor(hash2(seed,i+109,this.seed+5189)*candidates.length))%candidates.length];let found=null;
      for(const [ox,oy] of jitter){const tx=base.tx+ox,ty=base.ty+oy;if(!this.sidePlanCarvesFloor(plan,tx,ty)||this.isWall(tx,ty))continue;if(this.hollowSafeZone(tx,ty)||this.townSafeZone(tx,ty)||this.bossExclusionAtTile(tx,ty))continue;if(out.some(v=>Math.hypot(v.tx-tx,v.ty-ty)<3.1))continue;found={tx,ty};break;}
      if(!found)continue;const slot=out.length,oreId=((slot+(firstTin?0:1))%2===0)?'tin':'copper',veinClass=slot<2?'remote':'rich',id=`ore:side:${String(plan.id||seed)}:${slot}`;out.push(this.makeOreVein(oreId,id,found.tx,found.ty,{veinClass}));
    }
    return out;
  }

  sideOreEntities(ptx,pty,rx,ry){const out=[];for(const plan of this.sideContentPlans())for(const vein of this.sideOreSpecsForPlan(plan))if(Math.abs(vein.tx-ptx)<=rx+5&&Math.abs(vein.ty-pty)<=ry+5)out.push(vein);return out;}

  sideOreBlocksTile(plan,tx,ty,padding=2){return this.sideOreSpecsForPlan(plan).some(v=>Math.hypot(v.tx-tx,v.ty-ty)<=padding);}

  beginMining(entity,config={}){
    if(!entity||entity.type!=='ore'||entity.depleted||this.hasActiveThreats()||!this.inputEnabled)return false;
    if(Math.hypot(entity.x-this.player.x,entity.y-this.player.y)>44)return false;
    const swingMs=Math.max(750,Number(config.swingMs)||2400);
    this.autoApproach=false;
    if(Math.abs(entity.x-this.player.x)>=Math.abs(entity.y-this.player.y))this.player.facing=entity.x<this.player.x?'left':'right';
    this.activeMining={id:String(entity.id),entity:{...entity},swingMs,elapsedMs:0,minedUnits:0,swingFlash:0,impactFlash:0,toolName:String(config.toolName||'Pickaxe')};
    this.onToast?.(`Mining ${entity.oreName||'vein'}… move to stop.`);
    return true;
  }

  isMining(){return !!this.activeMining;}

  cancelMining(reason='cancelled'){
    const mining=this.activeMining;if(!mining)return false;
    this.activeMining=null;
    if(reason==='threat')this.onToast?.('Mining interrupted by danger.');
    return true;
  }

  updateMining(dt){
    const mining=this.activeMining;if(!mining)return;
    if(!this.inputEnabled){this.cancelMining('ui');return;}
    if(this.hasActiveThreats()){this.cancelMining('threat');return;}
    const current=(this.activeEntities||[]).find(e=>e?.id===mining.id)||mining.entity;
    const maxUnits=Math.max(1,Number(current.maxUnits)||Number(mining.entity.maxUnits)||1),remaining=this.oreRemainingFor(mining.id,maxUnits);
    if(remaining<=0){this.activeMining=null;return;}
    if(Math.hypot(current.x-this.player.x,current.y-this.player.y)>46){this.cancelMining('distance');return;}
    mining.entity={...current,remaining,maxUnits,depleted:false};
    mining.elapsedMs+=Math.max(0,dt*1000);
    mining.swingFlash=Math.max(0,(Number(mining.swingFlash)||0)-dt);
    mining.impactFlash=Math.max(0,(Number(mining.impactFlash)||0)-dt);
    while(mining.elapsedMs>=mining.swingMs&&this.activeMining===mining){
      mining.elapsedMs-=mining.swingMs;
      const before=this.oreRemainingFor(mining.id,maxUnits),after=Math.max(0,before-1);
      this.oreRemaining.set(mining.id,after);mining.minedUnits++;mining.swingFlash=.22;mining.impactFlash=.18;
      this.spawnMiningDebris(current.x,current.y-4,6);
      const detail={id:mining.id,oreId:current.oreId||'copper',oreName:current.oreName||'Copper Vein',itemName:current.itemName||'Copper Ore',remaining:after,maxUnits,x:current.x,y:current.y};
      const award=this.onMineUnit?.(detail);
      if(award===false||award?.ok===false){this.oreRemaining.set(mining.id,before);this.cancelMining('cancelled');return;}
      this.spawnText(current.x,current.y-10,`+1 ${String(detail.itemName||'ORE').replace(/ Ore$/i,'').toUpperCase()}`,'status');
      this.minimapDirty=true;
      if(after<=0){
        this.discoveredOre.delete(String(mining.id));
        this.minimapDirty=true;
        this.activeMining=null;
        this.onToast?.(`${detail.oreName} depleted.`);
        this.onMineComplete?.({...detail,minedUnits:mining.minedUnits});
        break;
      }
    }
  }

  beginSmithingForge(detail={},onComplete=null){
    if(this.activeSmithingForge||this.hasActiveThreats())return false;
    const anvil=this.smithingAnvilWorldPosition();if(!anvil)return false;
    if(Math.hypot(anvil.x-this.player.x,anvil.y-this.player.y)>54)return false;
    const durationMs=Math.max(1800,Number(detail.durationMs)||5000),cfg=this.devPlacementConfig?.smithingHammer||this.defaultDevPlacementConfig().smithingHammer,cycleMs=Math.max(420,Number(cfg.cycleMs)||820);
    if(Math.abs(anvil.x-this.player.x)>=Math.abs(anvil.y-this.player.y))this.player.facing=anvil.x<this.player.x?'left':'right';
    this.autoApproach=false;this.player.moving=false;
    this.activeSmithingForge={recipeId:String(detail.recipeId||''),name:String(detail.name||'Item'),bars:Math.max(1,Math.floor(Number(detail.bars)||1)),durationMs,elapsedMs:0,cycleMs,lastStrike:-1,impactFlash:0,onComplete:typeof onComplete==='function'?onComplete:null,anvilX:anvil.x,anvilY:anvil.y};
    this.onToast?.(`Forging ${this.activeSmithingForge.name}…`);
    return true;
  }

  isSmithingForge(){return !!this.activeSmithingForge;}

  updateSmithingForge(dt){
    const f=this.activeSmithingForge;if(!f)return;
    f.elapsedMs=Math.min(f.durationMs,f.elapsedMs+Math.max(0,dt*1000));
    f.impactFlash=Math.max(0,(Number(f.impactFlash)||0)-dt);
    const cfg=this.devPlacementConfig?.smithingHammer||this.defaultDevPlacementConfig().smithingHammer,cycleMs=Math.max(420,Number(cfg.cycleMs)||f.cycleMs||820),strike=Math.floor(f.elapsedMs/cycleMs),cycle=(f.elapsedMs%cycleMs)/cycleMs;
    if(cycle>=.58&&strike!==f.lastStrike){f.lastStrike=strike;f.impactFlash=.16;this.spawnSmithingSparks(f.anvilX,f.anvilY-7,7);}
    if(f.elapsedMs>=f.durationMs){
      const done=f.onComplete,detail={recipeId:f.recipeId,name:f.name,bars:f.bars},x=f.anvilX,y=f.anvilY;
      this.activeSmithingForge=null;this.spawnText(x,y-10,'FORGED','status');done?.(detail);
    }
  }

  spawnSmithingSparks(x,y,count=6){
    for(let i=0;i<count;i++){const angle=-2.75+Math.random()*2.35,speed=28+Math.random()*36,size=Math.random()<.72?1:2,life=.22+Math.random()*.20;this.particles.push({kind:'spark',x,y,vx:Math.cos(angle)*speed,vy:Math.sin(angle)*speed-4,size,life,max:life,tone:Math.random()<.55?'#f3c56d':'#d98242'});}
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
      const orePlan=!authoredZone&&!bossExclusion&&d>=3&&d<ORE_MAX_DEPTH?this.isOreCandidate(tx,ty):null;
      if(orePlan&&this.isSpawnAccessible(tx,ty)&&!this.hollowSafeZone(tx,ty)){
        const id=this.entityId(`ore:${orePlan.oreId}`,tx,ty);
        out.push(this.makeOreVein(orePlan.oreId,id,tx,ty,{veinClass:orePlan.veinClass}));
      }
    }
    const starterOre=this.starterCopperVein(ptx,pty,rx,ry);
    if(starterOre&&!out.some(e=>e.id===starterOre.id))out.push(starterOre);
    for(const vein of this.mainOreClusterEntities(ptx,pty,rx,ry))if(!out.some(e=>e.id===vein.id))out.push(vein);
    for(const vein of this.sideOreEntities(ptx,pty,rx,ry))if(!out.some(e=>e.id===vein.id))out.push(vein);

    out.push(...this.ordinaryEcologyEntities(ptx,pty,rx,ry));
    out.push(...this.sideEcologyEntities(ptx,pty,rx,ry));
    out.push(...this.sideBonusEntities(ptx,pty,rx,ry));
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
    if(this.activeMining){const mine=(entities||[]).find(e=>e?.id===this.activeMining.id)||this.activeMining.entity;this.nearby=mine;this.onInteract?.(mine,'Mining…');return;}
    let best=null,bestD=Infinity;
    for(const e of entities){if(e?.type==='ore'&&e.depleted)continue;const d=Math.hypot(e.x-this.player.x,e.y-this.player.y);if(d<bestD){bestD=d;best=e;}}
    this.nearby=bestD<40?best:null;
    if(this.nearby?.type==='loot'&&bestD<13&&this.inputEnabled){this.onLoot?.(this.nearby);return;}
    if(this.nearby&&bestD<40){
      const label={ore:`Mine ${this.nearby.oreName||'Vein'} · ${this.nearby.remaining}/${this.nearby.maxUnits}`,smithingstation:this.nearby.station==='anvil'?'Use Anvil':'Use Furnace',chest:'Open chest',glint:'Investigate',hollow:'Use Safe Hollow',signpost:'Read sign',foe:'Target',loot:'Loot',caravan:'Approach caravan',merchant:'Approach merchant','rescue-tracks':'Inspect tracks','rescue-satchel':'Inspect satchel','rescue-hideout':'Approach refuge','escort-pursuit':'Face the movement','quest-target':'Approach destination',midboss:'Target foe',boss:'Target guardian','side-stage':'Face obstacle','side-finale':'Inspect end chamber',townnpc:`Talk to ${this.nearby.npc?.label||'Townsperson'}`,townlocation:this.nearby.authoredNpc?`Talk to ${this.nearby.npc?.label||this.nearby.location?.name||'Shopkeeper'}`:(this.nearby.location?.departure?'Use Lower Gate':`Enter ${this.nearby.location?.name||'building'}`)}[this.nearby.type];
      this.onInteract?.(this.nearby,label);
    }else this.onInteract?.(null,null);
  }

  interact(){
    const e=this.nearby;
    if(!e)return false;
    if(e.type==='foe')return{type:'target',entity:e};
    if(e.type==='loot')return{type:'loot',entity:e,recordId:e.recordId};
    if(e.type==='ore'){return{type:'ore',entity:e,depth:depthFromY(e.y)};}
    if(e.type==='smithingstation')return{type:'smithingstation',entity:e,station:e.station,town:e.town};
    if(e.type==='chest'){this.opened.add(e.id);this.spawnText(e.x,e.y,'LOOT');return{type:'chest',entity:e,depth:depthFromY(e.y)};}
    if(e.type==='glint'){this.opened.add(e.id);this.spawnText(e.x,e.y,'FOUND');return{type:'glint',entity:e,depth:depthFromY(e.y)};}
    if(e.type==='hollow'){this.opened.add(e.id);return{type:'hollow',entity:e,depth:e.depth??depthFromY(e.y),kind:e.kind||'ordinary'};}
    if(e.type==='signpost'){this.opened.add(e.id);const place=e.town?.name||'Settlement',depth=Number(e.town?.depth||0).toFixed(0);this.onToast?.(e.signKind==='approach'?`${place} · ${depth} fathoms · follow the road ahead`:`${place} · ${depth} fathoms`);return{type:'signpost',entity:e};}
    if(e.type==='townlocation')return{type:'townlocation',entity:e,location:e.location,town:e.town};
    if(e.type==='townnpc'){const label=e.npc?.label||'Townsperson',role=String(e.npc?.role||'townsperson').replace(/_/g,' ');this.onToast?.(`${label} · ${role}`);return{type:'townnpc',entity:e,npc:e.npc,town:e.town};}
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
      ore:e.depleted?`The ${e.oreName||'ore vein'} has been worked out.`:`${e.oreName||'An ore vein'} holds ${e.remaining}/${e.maxUnits} resource units.`,
      smithingstation:e.station==='anvil'?'A working anvil stands ready for forging, repairs and dismantling.':'The blacksmith furnace is hot enough to smelt ore into bars.',
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
      townnpc:`${e.npc?.label||'A townsperson'} waits in ${e.town?.name||'the settlement'}.`,
      townlocation:e.authoredNpc?`${e.npc?.label||'A shopkeeper'} is ready to speak with you.`:(e.location?.departure?'The lower gate opens onto the road deeper into the dark.':`${e.location?.name||'A building'} stands within ${e.town?.name||'the settlement'}.`)
    }[e.type]||'Something is here.');
    else this.onToast?.('Stone, damp air, and the way upward into deeper dark.');
  }

  beginCombatEntity(entity,{hostile=false,autoApproach=false}={}){
    if(!entity)return;this.combat=true;this.combatEntityId=entity.id;if(!this.playerFacingBeforeCombat)this.playerFacingBeforeCombat=this.player.facing||'right';
    const homeX=Number.isFinite(Number(entity.homeX))?Number(entity.homeX):(Number.isFinite(Number(entity.spawnX))?Number(entity.spawnX):Number(entity.x)||0),homeY=Number.isFinite(Number(entity.homeY))?Number(entity.homeY):(Number.isFinite(Number(entity.spawnY))?Number(entity.spawnY):Number(entity.y)||0);
    this.combatFoe={...entity,x:entity.x,y:entity.y,combatHomeX:homeX,combatHomeY:homeY,combatHp:Number.isFinite(Number(entity.combatHp))?Number(entity.combatHp):null,combatHpMax:Number.isFinite(Number(entity.combatHpMax))?Number(entity.combatHpMax):null,combatTelegraph:'',combatEvading:false,hostile:!!(hostile||entity.hostile),renderOffsetX:0,renderOffsetY:0};
    this.autoApproach=!!autoApproach;
    this.combatPlayerAttacking=false;
  }
  stashCombatTarget(legacyState=null){
    const f=this.combatFoe,id=this.combatEntityId;if(!f||!id){this.setCombat(false);return null;}
    const source=this.roamers.get(id)||this.bossActors.get(id);
    if(source){
      const evading=!!legacyState?.evading;
      source.x=f.x;source.y=f.y;source.hostile=evading?false:!!f.hostile;source.combatHp=Number.isFinite(Number(f.combatHp))?Number(f.combatHp):source.combatHp;source.combatHpMax=Number.isFinite(Number(f.combatHpMax))?Number(f.combatHpMax):source.combatHpMax;source.combatLegacyState=legacyState||source.combatLegacyState||null;source.combatTelegraph='';source.combatEvading=evading;
      if(evading){source.targetX=Number(source.homeX)||source.x;source.targetY=Number(source.homeY)||source.y;if('aggro' in source)source.aggro=true;}
    }
    if(this.playerFacingBeforeCombat)this.player.facing=this.playerFacingBeforeCombat;this.playerFacingBeforeCombat=null;this.combat=false;this.combatFoe=null;this.combatEntityId=null;this.combatPlayerAttacking=false;this.autoApproach=false;this.playerReachGuideVisible=false;return source||null;
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
      roamer.combatEvading=false;roamer.hostile=false;roamer.combatTelegraph='';roamer.combatLegacyState=null;
      if(Number.isFinite(Number(roamer.combatHpMax)))roamer.combatHp=roamer.combatHpMax;
      return;
    }
    const actor=this.bossActors.get(id);
    if(actor){actor.x=Number(actor.spawnX)||actor.x;actor.y=Number(actor.spawnY)||actor.y;actor.aggro=false;actor.hostile=false;actor.combatEvading=false;actor.combatTelegraph='';actor.combatLegacyState=null;if(Number.isFinite(Number(actor.combatHpMax)))actor.combatHp=actor.combatHpMax;actor.tx=Math.floor(actor.x/TILE);actor.ty=Math.floor(actor.y/TILE);}
  }

  endCombat({defeated=false}={}){
    if(defeated&&this.combatEntityId){this.defeated.add(this.combatEntityId);this.roamers.delete(this.combatEntityId);}
    if(this.playerFacingBeforeCombat)this.player.facing=this.playerFacingBeforeCombat;this.playerFacingBeforeCombat=null;this.combat=false;this.combatFoe=null;this.combatEntityId=null;this.combatPlayerRange=10;this.combatPlayerMelee=true;this.combatPlayerInRange=false;this.combatEnemyThreatRange=10;this.combatThreatActive=false;this.combatPlayerAttacking=false;this.autoApproach=false;
  }

  bumpPlayer(text='',amount=12,duration=.20){if(!this.combatFoe)return;this.bump(this.player,this.combatFoe,amount,duration,()=>{if(text)this.spawnText(this.combatFoe.x,this.combatFoe.y,text);});}
  bumpFoe(text='',amount=12,duration=.20){if(!this.combatFoe)return;this.bump(this.combatFoe,this.player,amount,duration,()=>{if(text)this.spawnText(this.player.x,this.player.y,text);});}
  bumpActor(attacker,target,amount=12,duration=.20){if(!attacker||!target)return;this.bump(attacker,target,amount,duration);}
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

  spawnText(x,y,text,tone='player'){this.particles.push({kind:'text',x,y,text,tone,life:1.1,max:1.1});}
  spawnMiningDebris(x,y,count=5){
    for(let i=0;i<count;i++){
      const angle=-1.9+Math.random()*1.2,speed=20+Math.random()*26,size=Math.random()<.45?1:2;
      this.particles.push({kind:'chip',x,y,vx:Math.cos(angle)*speed,vy:Math.sin(angle)*speed-.5,size,life:.30+Math.random()*.18,max:.30+Math.random()*.18,tone:Math.random()<.35?'#c98a53':'#7f8583',shadow:Math.random()<.35?'#5c3421':'#4a514f'});
    }
  }
  updateParticles(dt){
    for(const p of this.particles){
      p.life-=dt;
      if(p.kind==='chip'||p.kind==='spark'){
        p.x+=(Number(p.vx)||0)*dt;
        p.y+=(Number(p.vy)||0)*dt;
        p.vy=(Number(p.vy)||0)+(p.kind==='spark'?58:46)*dt;
      }
    }
    this.particles=this.particles.filter(p=>p.life>0);
  }
  worldToScreen(x,y){return{x:(x-this.camera.x)+this.logicalViewW()/2,y:(y-this.camera.y)+this.logicalViewH()/2};}

  queueLightSource(x,y,{radius=24,cutout=12,feather=null,strength=.68,falloffOuter=null,falloffStrength=0,color='rgba(244,188,100,.14)',alpha=.16}={}){
    if(!this.atmosphereEffectsEnabled)return;
    radius=Math.max(1,Number(radius)||24);cutout=Math.max(1,Number(cutout)||radius*.55);alpha=clamp(Number(alpha)||0,0,1);
    feather=Number.isFinite(feather)?Math.max(cutout+1,Number(feather)):null;
    strength=clamp(Number(strength)||0,0,1);
    falloffOuter=Number.isFinite(falloffOuter)?Math.max((feather||cutout)+1,Number(falloffOuter)):null;
    falloffStrength=clamp(Number(falloffStrength)||0,0,1);
    if(x<-radius||x>this.logicalViewW()+radius||y<-radius||y>this.logicalViewH()+radius)return;
    this.lightSources.push({x,y,radius,cutout,feather,strength,falloffOuter,falloffStrength,color:String(color||'rgba(244,188,100,.14)'),alpha});
  }

  queueDevPlacedLights(){
    if(!this.atmosphereEffectsEnabled)return;
    for(const light of this.devPlacementConfig?.placedLights||[]){const s=this.worldToScreen(light.x,light.y),outer=Math.max(light.clearRadius,light.featherRadius,light.falloffOuter,light.glowRadius)+8;this.queueLightSource(Math.round(s.x),Math.round(s.y),{radius:outer,cutout:light.clearRadius,feather:light.featherRadius,strength:light.revealStrength,falloffOuter:light.falloffOuter,falloffStrength:light.falloffStrength,color:'rgba(240,179,91,.18)',alpha:light.glowAlpha});}
  }

  drawDevPlacedLightGlows(){
    if(!this.atmosphereEffectsEnabled)return;
    const c=this.ctx;for(const light of this.devPlacementConfig?.placedLights||[]){const s=this.worldToScreen(light.x,light.y),r=Math.max(1,Number(light.glowRadius)||1);if(s.x<-r||s.x>this.logicalViewW()+r||s.y<-r||s.y>this.logicalViewH()+r)continue;c.save();c.globalCompositeOperation='screen';this.drawLightGlow(c,s.x,s.y,r,'rgba(240,179,91,.18)',light.glowAlpha);c.restore();}
  }

  queueFireflyAttractor(x,y,{radius=26,warm=false,density=1,seedBase=0}={}){
    if(!this.atmosphereEffectsEnabled)return;
    radius=Math.max(6,Number(radius)||26);
    density=clamp(Number(density)||1,.5,2.2);
    seedBase=Number.isFinite(Number(seedBase))?Math.trunc(Number(seedBase)):0;
    if(x<-radius||x>this.logicalViewW()+radius||y<-radius||y>this.logicalViewH()+radius)return;
    this.fireflyAttractors.push({x,y,radius,warm:!!warm,density,seedBase});
  }

  ambientBoulderSpecForSector(gx,gy){
    const cacheKey=`${gx}:${gy}`;
    if(this.ambientBoulderSpecCache.has(cacheKey))return this.ambientBoulderSpecCache.get(cacheKey);
    const remember=value=>{this.ambientBoulderSpecCache.set(cacheKey,value);return value;};
    const roll=hash2(gx,gy,this.seed+9801);
    // Ordinary boulders are background geology. Resource nodes and traversable
    // routes must read more clearly, so keep these genuinely sparse.
    if(roll<.94)return remember(null);
    const sector=TILE*9;
    const wx=(gx+.22+hash2(gx,gy,this.seed+9811)*.54)*sector;
    const wy=(gy+.22+hash2(gx,gy,this.seed+9821)*.54)*sector;
    const tx=Math.floor(wx/TILE),ty=Math.floor(wy/TILE);
    if(this.townSafeZone(tx,ty)||this.townCarvesFloor(tx,ty)||this.hollowSafeZone(tx,ty)||this.sideCarvesFloor(tx,ty))return remember(null);
    if(this.isWall(tx,ty)||this.isWall(tx-1,ty)||this.isWall(tx+1,ty)||this.isWall(tx,ty-1)||this.isWall(tx,ty+1))return remember(null);
    if(this.mainOreBlocksTile(tx,ty,2.8))return remember(null);
    const spineDist=Math.abs(tx-this.corridorCenter(ty));
    if(spineDist<=5)return remember(null);
    if(spineDist<=16&&hash2(gx,gy,this.seed+9851)<.74)return remember(null);
    const stratum=stratumIndex(depthFromY(wy));
    const assetIndex=Math.min(AMBIENT_BOULDER_ASSETS.length-1,Math.floor(hash2(gx,gy,this.seed+9847)*AMBIENT_BOULDER_ASSETS.length));
    const asset=AMBIENT_BOULDER_ASSETS[assetIndex]||AMBIENT_BOULDER_ASSETS[0];
    // Every supplied source file is labelled MOSSY. Vary the cached colour pass
    // so roughly half retain a restrained moss read and half become much more
    // neutral-looking without altering the master PNGs.
    const moss=hash2(gx,gy,this.seed+9833)>.48;
    // Collision follows the lower physical pile rather than the whole transparent
    // rectangle/roofline. An ellipse fits wide piles far better than the old
    // circular placeholder collision and remains deterministic before images load.
    const collisionRX=Math.max(13,Math.round(asset.w*.40));
    const collisionRY=Math.max(7,Math.round(asset.h*.27));
    return remember({gx,gy,wx,wy,tx,ty,stratum,moss,assetIndex,asset,collisionRX,collisionRY});
  }

  ambientBoulderCollides(x,y,r=0){
    const sector=TILE*9,gx0=Math.floor((x-sector)/sector),gx1=Math.ceil((x+sector)/sector),gy0=Math.floor((y-sector)/sector),gy1=Math.ceil((y+sector)/sector);
    const pr=Math.max(1,Number(r)||0);
    for(let gy=gy0;gy<=gy1;gy++)for(let gx=gx0;gx<=gx1;gx++){
      const spec=this.ambientBoulderSpecForSector(gx,gy);
      if(!spec)continue;
      const rx=spec.collisionRX+pr,ry=spec.collisionRY+pr,cx=spec.wx,cy=spec.wy+4;
      const nx=(x-cx)/Math.max(1,rx),ny=(y-cy)/Math.max(1,ry);
      if(nx*nx+ny*ny<1)return spec;
    }
    return null;
  }

  getAmbientBoulderSprite(assetIndex){
    assetIndex=Math.max(0,Math.min(AMBIENT_BOULDER_ASSETS.length-1,Math.trunc(Number(assetIndex)||0)));
    let rec=this.ambientBoulderSprites.get(assetIndex);
    if(rec)return rec;
    const asset=AMBIENT_BOULDER_ASSETS[assetIndex],img=new Image();
    rec={img,ready:false,failed:false};
    img.onload=()=>{rec.ready=true;rec.failed=false;this.ambientBoulderTintCache.clear();};
    img.onerror=()=>{rec.ready=false;rec.failed=true;};
    img.src=asset.src;
    this.ambientBoulderSprites.set(assetIndex,rec);
    return rec;
  }

  getAmbientBoulderTintedSprite(spec){
    const rec=this.getAmbientBoulderSprite(spec.assetIndex);
    if(!rec?.ready||!rec.img?.naturalWidth)return null;
    // Forest Plains gets a slightly darker, still only-slightly-green treatment
    // so the authored stones sit into the floor better instead of popping off it.
    // Deeper strata use a neutral dark pass for now; their individual palette
    // treatments can be tuned later without touching the source art.
    const mode=spec.stratum===0?(spec.moss?'forest-moss':'forest-neutral'):'deep-neutral';
    const key=`${spec.assetIndex}:${mode}`;
    if(this.ambientBoulderTintCache.has(key))return this.ambientBoulderTintCache.get(key);
    const asset=spec.asset||AMBIENT_BOULDER_ASSETS[spec.assetIndex],oc=document.createElement('canvas');
    oc.width=Math.max(1,asset.w);oc.height=Math.max(1,asset.h);
    const cc=oc.getContext('2d',{alpha:true});cc.imageSmoothingEnabled=false;
    cc.drawImage(rec.img,0,0,oc.width,oc.height);
    // A source-atop veil is deliberately used instead of a CSS/canvas filter so
    // the treatment is identical in desktop browsers and mobile/PWA canvases.
    // Forest moss stays readable but restrained; neutral placements push the
    // same mossy master art closer to stone without creating duplicate PNGs.
    cc.globalCompositeOperation='source-atop';
    cc.fillStyle=mode==='forest-moss'?'rgba(18,30,18,.35)':mode==='forest-neutral'?'rgba(22,27,22,.41)':'rgba(24,28,31,.36)';
    cc.fillRect(0,0,oc.width,oc.height);cc.globalCompositeOperation='source-over';
    this.ambientBoulderTintCache.set(key,oc);
    return oc;
  }

  drawAmbientBoulderSpec(spec){
    const c=this.ctx,s=this.worldToScreen(spec.wx,spec.wy),asset=spec.asset||AMBIENT_BOULDER_ASSETS[spec.assetIndex],sprite=this.getAmbientBoulderTintedSprite(spec);
    const w=asset.w,h=asset.h,x=Math.round(s.x-w/2),y=Math.round(s.y-h+8);
    // Ground shadow stays procedural so the authored transparent PNG sits in the
    // existing world instead of looking pasted onto the floor.
    c.fillStyle='rgba(0,0,0,.20)';
    c.beginPath();c.ellipse(Math.round(s.x),Math.round(s.y+5),Math.max(8,Math.round(spec.collisionRX*.88)),Math.max(3,Math.round(spec.collisionRY*.48)),0,0,Math.PI*2);c.fill();
    if(sprite){c.imageSmoothingEnabled=false;c.drawImage(sprite,x,y,w,h);return;}
    // Tiny loading fallback: keep collision readable for a frame without bringing
    // back the old six hand-drawn boulder variants.
    c.fillStyle=spec.stratum===0?'#3f473d':'#464b50';
    c.fillRect(Math.round(s.x-spec.collisionRX*.7),Math.round(s.y-spec.collisionRY),Math.max(3,Math.round(spec.collisionRX*1.4)),Math.max(3,Math.round(spec.collisionRY*1.3)));
  }

  drawAmbientBoulders(){
    const w=this.logicalViewW(),h=this.logicalViewH(),left=this.camera.x-w/2,top=this.camera.y-h/2,sector=TILE*9;
    const gx0=Math.floor(left/sector)-1,gx1=Math.ceil((left+w)/sector)+1,gy0=Math.floor(top/sector)-1,gy1=Math.ceil((top+h)/sector)+1;
    const specs=[];
    for(let gy=gy0;gy<=gy1;gy++)for(let gx=gx0;gx<=gx1;gx++){const spec=this.ambientBoulderSpecForSector(gx,gy);if(spec)specs.push(spec);}
    specs.sort((a,b)=>a.wy-b.wy);
    for(const spec of specs){
      const s=this.worldToScreen(spec.wx,spec.wy),pad=Math.max(90,spec.asset?.w||70);
      if(s.x<-pad||s.x>w+pad||s.y<-70||s.y>h+70)continue;
      this.drawAmbientBoulderSpec(spec);
    }
  }

  drawForestGlowMushrooms(x,y,tx,ty,paletteSeed,landmarkBoost=0){
    // Decorative mushrooms should read as background flora, not as loot or a
    // future Herbalism resource. Keep some colour, but no self-light or halo.
    const c=this.ctx,phase=hash2(tx,ty,this.seed+9323)*Math.PI*2;
    const pick=hash2(tx*7,ty*5,this.seed+9341),purple=pick>.68,cool=pick<.34;
    const cap=purple?'#655474':cool?'#527982':'#58735d';
    const capBright=purple?'#806c91':cool?'#6b949c':'#718d73';
    const stem=purple?'#5b5363':cool?'#596c6d':'#596b57';
    const shadow=purple?'#43394d':cool?'#3d555a':'#3e5140';
    const cluster=landmarkBoost>0?3:2;
    const sway=Math.sin(this.time*.7+phase)>0?1:0;
    const positions=[[8,15],[12,12],[16,16]];
    for(let i=0;i<cluster;i++){
      const [ox,oy]=positions[i];
      const h=i===1?5:4;
      c.fillStyle=stem;c.fillRect(x+ox,y+oy,h>4?2:1,h);
      c.fillStyle=shadow;c.fillRect(x+ox-1,y+oy-1,3,2);c.fillRect(x+ox+1,y+oy-2,2,1);
      c.fillStyle=cap;c.fillRect(x+ox-2+sway,y+oy-3,5,2);c.fillRect(x+ox-1+sway,y+oy-4,3,1);
      c.fillStyle=capBright;c.fillRect(x+ox-1+sway,y+oy-4,1,1);
    }
    if(landmarkBoost>0){c.fillStyle='rgba(99,118,79,.18)';c.fillRect(x+6,y+18,12,2);}
  }

  drawForestPond(cx,cy,gx,gy,landmarkBoost=0){
    const c=this.ctx,phase=hash2(gx,gy,this.seed+9413)*Math.PI*2;
    const ripple=.5+.5*Math.sin(this.time*.72+phase),sway=Math.sin(this.time*.65+phase)>0?1:0;
    const variant=Math.floor(hash2(gx,gy,this.seed+9421)*5);
    const scale=.90+hash2(gx,gy,this.seed+9425)*.34;
    const wide=Math.round((variant===2?104:variant===4?92:82)*scale);
    const tall=Math.round((variant===1?46:variant===3?38:42)*scale);
    const x=Math.round(cx-wide/2),y=Math.round(cy-tall/2);
    const bands={
      0:[[.18,.00,.64,.14],[.08,.12,.82,.17],[.02,.28,.96,.31],[.10,.57,.80,.22],[.24,.78,.54,.14]],
      1:[[.32,.00,.46,.13],[.14,.10,.72,.19],[.03,.28,.82,.24],[.00,.48,.94,.25],[.16,.70,.72,.20],[.34,.88,.40,.10]],
      2:[[.10,.00,.74,.12],[.02,.10,.90,.18],[.10,.27,.88,.23],[.00,.48,.82,.24],[.16,.70,.78,.19],[.38,.88,.44,.10]],
      3:[[.28,.00,.50,.15],[.08,.13,.76,.21],[.00,.33,.90,.28],[.12,.60,.88,.22],[.34,.80,.54,.15]],
      4:[[.12,.00,.68,.14],[.02,.12,.94,.18],[.10,.29,.82,.20],[.00,.47,.96,.24],[.18,.69,.70,.18],[.42,.85,.38,.11]]
    }[variant];
    c.fillStyle='rgba(18,43,47,.78)';
    for(const [bx,by,bw,bh] of bands)c.fillRect(x+Math.round(wide*bx),y+Math.round(tall*by),Math.max(2,Math.round(wide*bw)),Math.max(2,Math.round(tall*bh)));
    c.fillStyle='rgba(28,69,77,.86)';
    c.fillRect(x+Math.round(wide*.12),y+Math.round(tall*.24),Math.round(wide*.72),Math.round(tall*.44));
    c.fillRect(x+Math.round(wide*.22),y+Math.round(tall*.13),Math.round(wide*.48),Math.round(tall*.18));
    c.fillRect(x+Math.round(wide*.27),y+Math.round(tall*.65),Math.round(wide*.50),Math.round(tall*.16));
    if(variant===1||variant===4)c.fillRect(x+Math.round(wide*.06),y+Math.round(tall*.43),Math.round(wide*.24),Math.round(tall*.18));
    if(variant===2||variant===3)c.fillRect(x+Math.round(wide*.68),y+Math.round(tall*.34),Math.round(wide*.22),Math.round(tall*.22));
    c.fillStyle='rgba(12,34,39,.66)';
    c.fillRect(x+Math.round(wide*.30),y+Math.round(tall*.72),Math.round(wide*.38),Math.max(2,Math.round(tall*.08)));
    c.fillStyle=`rgba(145,192,198,${.10+.085*ripple})`;
    c.fillRect(x+Math.round(wide*.18),y+Math.round(tall*.31),Math.max(8,Math.round(wide*.25)),1);
    c.fillRect(x+Math.round(wide*.52),y+Math.round(tall*.43),Math.max(7,Math.round(wide*.18)),1);
    c.fillRect(x+Math.round(wide*.28),y+Math.round(tall*.58),Math.max(6,Math.round(wide*.15)),1);
    c.fillStyle=`rgba(91,143,156,${.08+.065*ripple})`;
    c.fillRect(x+Math.round(wide*.42),y+Math.round(tall*.68),Math.max(6,Math.round(wide*.20)),1);
    for(let i=0;i<2;i++){
      const cycle=(this.time*.22+hash2(gx,gy+i,this.seed+9443))%1;
      const rw=5+Math.round(cycle*18),ry=Math.max(1,Math.round(rw*.24));
      const rx=x+Math.round(wide*(.34+.28*hash2(gx+i,gy,this.seed+9457)));
      const ry0=y+Math.round(tall*(.39+.20*hash2(gx,gy+i,this.seed+9463)));
      c.globalAlpha=(1-cycle)*.24;c.strokeStyle='rgba(154,202,207,.72)';c.lineWidth=1;
      c.beginPath();c.ellipse(rx,ry0,rw,ry,0,0,Math.PI*2);c.stroke();
    }
    c.globalAlpha=1;
    const leftFlower=hash2(gx,gy,this.seed+9427)>.58,rightFlower=hash2(gx,gy,this.seed+9439)>.62;
    c.fillStyle='#405d39';
    c.fillRect(x+7+sway,y+Math.round(tall*.28),1,11);c.fillRect(x+11+sway,y+Math.round(tall*.20),1,13);
    c.fillRect(x+wide-11-sway,y+Math.round(tall*.44),1,10);c.fillRect(x+wide-7-sway,y+Math.round(tall*.34),1,12);
    c.fillStyle='#658452';
    c.fillRect(x+6+sway,y+Math.round(tall*.25),2,2);c.fillRect(x+11+sway,y+Math.round(tall*.18),1,3);
    c.fillRect(x+wide-12-sway,y+Math.round(tall*.41),2,2);c.fillRect(x+wide-8-sway,y+Math.round(tall*.31),2,2);
    if(leftFlower){c.fillStyle='#d3d99a';c.fillRect(x+10+sway,y+Math.round(tall*.16),2,2);c.fillStyle='#9fba6d';c.fillRect(x+11+sway,y+Math.round(tall*.18),1,1);}
    if(rightFlower){c.fillStyle='#d8c97c';c.fillRect(x+wide-11-sway,y+Math.round(tall*.38),2,2);c.fillStyle='#b19d59';c.fillRect(x+wide-10-sway,y+Math.round(tall*.40),1,1);}
    if(landmarkBoost>0){
      c.fillStyle='rgba(71,112,79,.32)';c.fillRect(x+3,y+tall-5,13,2);c.fillRect(x+wide-18,y+tall-4,15,2);
      this.queueFireflyAttractor(cx,cy,{radius:30,warm:false,density:1.0,seedBase:gx*4099+gy*131+9413});
    }
  }

  drawForestPonds(){
    if(stratumIndex(depthFromY(this.player.y))!==0)return;
    const w=this.logicalViewW(),h=this.logicalViewH(),left=this.camera.x-w/2,top=this.camera.y-h/2;
    const sector=TILE*17;
    const gx0=Math.floor(left/sector)-1,gx1=Math.ceil((left+w)/sector)+1,gy0=Math.floor(top/sector)-1,gy1=Math.ceil((top+h)/sector)+1;
    for(let gy=gy0;gy<=gy1;gy++)for(let gx=gx0;gx<=gx1;gx++){
      const roll=hash2(gx,gy,this.seed+9401);
      if(roll<.82)continue;
      const wx=(gx+.18+hash2(gx,gy,this.seed+9407)*.64)*sector;
      const wy=(gy+.18+hash2(gx,gy,this.seed+9411)*.64)*sector;
      const tx=Math.floor(wx/TILE),ty=Math.floor(wy/TILE);
      if(this.townSafeZone(tx,ty)||this.townCarvesFloor(tx,ty)||this.hollowSafeZone(tx,ty))continue;
      if(this.isWall(tx,ty)||this.isWall(tx-1,ty)||this.isWall(tx+1,ty)||this.isWall(tx,ty-1)||this.isWall(tx,ty+1))continue;
      if(Math.abs(tx-this.corridorCenter(ty))<=4)continue;
      const s=this.worldToScreen(wx,wy);
      if(s.x<-90||s.x>w+90||s.y<-60||s.y>h+60)continue;
      this.drawForestPond(s.x,s.y,gx,gy,roll>.965?1:0);
    }
  }


  drawAmbientWaterDrips(){
    const c=this.ctx,w=this.logicalViewW(),h=this.logicalViewH(),left=this.camera.x-w/2,top=this.camera.y-h/2,sector=190;
    const gx0=Math.floor(left/sector)-1,gx1=Math.ceil((left+w)/sector)+1,gy0=Math.floor(top/sector)-1,gy1=Math.ceil((top+h)/sector)+1;
    c.save();
    for(let gy=gy0;gy<=gy1;gy++)for(let gx=gx0;gx<=gx1;gx++){
      const roll=hash2(gx,gy,this.seed+9861);if(roll<.84)continue;
      const wx=(gx+.18+hash2(gx,gy,this.seed+9871)*.64)*sector,wy=(gy+.18+hash2(gx,gy,this.seed+9883)*.64)*sector;
      if(this.townSafeZone(Math.floor(wx/TILE),Math.floor(wy/TILE)))continue;
      const s=this.worldToScreen(wx,wy);if(s.x<-20||s.x>w+20||s.y<-30||s.y>h+30)continue;
      const phase=hash2(gx,gy,this.seed+9897),cycle=(this.time*.52+phase)%1,fall=Math.min(1,cycle/.60),dropY=s.y-17+fall*24;
      if(cycle<.60){c.fillStyle=`rgba(133,185,195,${.30+.30*fall})`;c.fillRect(Math.round(s.x),Math.round(dropY),1,2);}
      else{const t=(cycle-.60)/.40,rx=2+Math.round(t*9);c.globalAlpha=(1-t)*.34;c.strokeStyle='rgba(136,192,201,.72)';c.lineWidth=1;c.beginPath();c.ellipse(Math.round(s.x),Math.round(s.y+2),rx,Math.max(1,Math.round(rx*.25)),0,0,Math.PI*2);c.stroke();c.globalAlpha=1;}
    }
    c.restore();
  }

  drawFireflyCluster(c,cx,cy,seedBase,count=3,warmCluster=false,density=1,orbitScale=1,speedScale=1){
    const total=Math.max(2,Math.min(4,Math.round(count*density)));
    for(let i=0;i<total;i++){
      const localPhase=hash2(seedBase,i,this.seed+9531)*Math.PI*2+i*(Math.PI*2/total);
      const orbitRadius=(4+hash2(seedBase,i+11,this.seed+9547)*7)*orbitScale;
      const orbitSpeed=(.48+hash2(seedBase,i+23,this.seed+9563)*.52)*Math.max(.2,Number(speedScale)||1);
      const angle=this.time*orbitSpeed+localPhase;
      const bobX=Math.sin(this.time*(.40+i*.07)+localPhase*1.4)*1.5;
      const bobY=Math.cos(this.time*(.34+i*.05)+localPhase*1.2)*1.2;
      const sx=cx+Math.cos(angle)*orbitRadius+bobX,sy=cy+Math.sin(angle)*Math.max(2,orbitRadius*.72)+bobY;
      const pulse=.42+.58*(.5+.5*Math.sin(this.time*(1.22+i*.13)+localPhase));
      const warm=warmCluster ? i!==1 || total<3 : (i===0&&hash2(seedBase,i+31,this.seed+9579)>.5);
      const body=warm?'rgba(236,196,104,.88)':'rgba(162,216,146,.80)';
      const glow=warm?'rgba(236,196,104,.12)':'rgba(162,216,146,.10)';
      this.queueLightSource(Math.round(sx),Math.round(sy),{radius:9+Math.round(pulse*5),cutout:4+Math.round(pulse*2),color:glow,alpha:.03+.028*pulse});
      let grad=c.createRadialGradient(sx,sy,0,sx,sy,5+pulse*4);
      grad.addColorStop(0,warm?`rgba(255,233,162,${.20+.16*pulse})`:`rgba(198,255,188,${.16+.12*pulse})`);
      grad.addColorStop(.45,warm?`rgba(236,196,104,${.07+.05*pulse})`:`rgba(162,216,146,${.055+.04*pulse})`);
      grad.addColorStop(1,'rgba(0,0,0,0)');
      c.fillStyle=grad;c.beginPath();c.arc(sx,sy,5+pulse*4,0,Math.PI*2);c.fill();
      c.fillStyle=body;
      const px=Math.round(sx),py=Math.round(sy),size=pulse>.68?2:1;
      c.fillRect(px,py,size,size);
    }
  }

  defaultDevPlacedLight(){return{id:'',x:0,y:0,clearRadius:48,featherRadius:66,falloffOuter:118,falloffStrength:.24,revealStrength:.94,glowRadius:68,glowAlpha:.13};}

  defaultDevPlacementConfig(){
    return{
      version:9,
      playerLanternGlow:{sideOffset:8,y:3,innerRadius:18,outerRadius:31,brightness:1},
      playerLanternVisibility:{clearRadius:336,featherRadius:368,falloffOuter:520,falloffStrength:.24},
      campfireVisibility:{clearRadius:35,featherRadius:45,falloffOuter:80,falloffStrength:.24,revealStrength:.92},
      miningSwing:{pivotX:5.5,pivotY:-8,startDeg:-62,impactDeg:125,handleLength:15,headWidth:8,handleThickness:1.5,headThickness:1.5},
      smithingHammer:{pivotX:5,pivotY:-7,startDeg:-82,impactDeg:42,handleLength:11,headWidth:7,handleThickness:1.5,headHeight:4,cycleMs:820},
      oreMinimap:{iconSize:8,clusterRadiusTiles:10},
      oreVeins:{standardScale:1,remoteScale:1.12,richScale:1.28},
      smithingAnvil:{offsetX:-127,offsetY:26,scale:1},
      questTracker:{fontScale:1.5},
      placedLights:[]
    };
  }

  sanitizeDevPlacementConfig(value){
    const base=this.defaultDevPlacementConfig(),src=value&&typeof value==='object'?value:{};
    const glow=src.playerLanternGlow&&typeof src.playerLanternGlow==='object'?src.playerLanternGlow:{};
    const vis=src.playerLanternVisibility&&typeof src.playerLanternVisibility==='object'?src.playerLanternVisibility:{};
    const fireVis=src.campfireVisibility&&typeof src.campfireVisibility==='object'?src.campfireVisibility:{};
    const miningSwing=src.miningSwing&&typeof src.miningSwing==='object'?src.miningSwing:{};
    const smithingHammer=src.smithingHammer&&typeof src.smithingHammer==='object'?src.smithingHammer:{};
    const oreMinimap=src.oreMinimap&&typeof src.oreMinimap==='object'?src.oreMinimap:{};
    const oreVeins=src.oreVeins&&typeof src.oreVeins==='object'?src.oreVeins:{};
    const smithingAnvil=src.smithingAnvil&&typeof src.smithingAnvil==='object'?src.smithingAnvil:{};
    const questTracker=src.questTracker&&typeof src.questTracker==='object'?src.questTracker:{};
    const num=(v,fallback,min,max)=>clamp(Number.isFinite(Number(v))?Number(v):fallback,min,max);
    const lightBase=this.defaultDevPlacedLight(),placedLights=(Array.isArray(src.placedLights)?src.placedLights:[]).slice(0,128).map((raw,i)=>{const l=raw&&typeof raw==='object'?raw:{};return{id:String(l.id||`devlight-${i}`).slice(0,80),x:num(l.x,0,-100000,100000),y:num(l.y,0,-100000,100000),clearRadius:num(l.clearRadius,lightBase.clearRadius,8,320),featherRadius:num(l.featherRadius,lightBase.featherRadius,12,400),falloffOuter:num(l.falloffOuter,lightBase.falloffOuter,16,520),falloffStrength:num(l.falloffStrength,lightBase.falloffStrength,0,.8),revealStrength:num(l.revealStrength,lightBase.revealStrength,.1,1),glowRadius:num(l.glowRadius,lightBase.glowRadius,4,220),glowAlpha:num(l.glowAlpha,lightBase.glowAlpha,0,.5)}});
    const sourceVersion=Math.max(0,Number(src.version)||0),trackerScale=(sourceVersion<9&&Math.abs(Number(questTracker.fontScale)-1.25)<.001)?1.5:questTracker.fontScale;
    return{
      version:9,
      playerLanternGlow:{
        sideOffset:num(glow.sideOffset,base.playerLanternGlow.sideOffset,0,40),
        y:num(glow.y,base.playerLanternGlow.y,-32,32),
        innerRadius:num(glow.innerRadius,base.playerLanternGlow.innerRadius,3,64),
        outerRadius:num(glow.outerRadius,base.playerLanternGlow.outerRadius,5,96),
        brightness:num(glow.brightness,base.playerLanternGlow.brightness,.15,2.5)
      },
      playerLanternVisibility:{
        clearRadius:num(vis.clearRadius,base.playerLanternVisibility.clearRadius,80,600),
        featherRadius:num(vis.featherRadius,base.playerLanternVisibility.featherRadius,90,680),
        falloffOuter:num(vis.falloffOuter,base.playerLanternVisibility.falloffOuter,120,900),
        falloffStrength:num(vis.falloffStrength,base.playerLanternVisibility.falloffStrength,0,.8)
      },
      campfireVisibility:{
        clearRadius:num(fireVis.clearRadius,base.campfireVisibility.clearRadius,8,300),
        featherRadius:num(fireVis.featherRadius,base.campfireVisibility.featherRadius,12,360),
        falloffOuter:num(fireVis.falloffOuter,base.campfireVisibility.falloffOuter,16,500),
        falloffStrength:num(fireVis.falloffStrength,base.campfireVisibility.falloffStrength,0,.8),
        revealStrength:num(fireVis.revealStrength,base.campfireVisibility.revealStrength,.1,1)
      },
      miningSwing:{
        pivotX:num(miningSwing.pivotX,base.miningSwing.pivotX,-18,18),
        pivotY:num(miningSwing.pivotY,base.miningSwing.pivotY,-22,10),
        startDeg:num(miningSwing.startDeg,base.miningSwing.startDeg,-160,80),
        impactDeg:num(miningSwing.impactDeg,base.miningSwing.impactDeg,-80,160),
        handleLength:num(miningSwing.handleLength,base.miningSwing.handleLength,4,20),
        headWidth:num(miningSwing.headWidth,base.miningSwing.headWidth,3,16),
        handleThickness:num(miningSwing.handleThickness,base.miningSwing.handleThickness,.5,3),
        headThickness:num(miningSwing.headThickness,base.miningSwing.headThickness,1,5)
      },
      smithingHammer:{
        pivotX:num(smithingHammer.pivotX,base.smithingHammer.pivotX,-18,18),
        pivotY:num(smithingHammer.pivotY,base.smithingHammer.pivotY,-22,10),
        startDeg:num(smithingHammer.startDeg,base.smithingHammer.startDeg,-170,100),
        impactDeg:num(smithingHammer.impactDeg,base.smithingHammer.impactDeg,-100,170),
        handleLength:num(smithingHammer.handleLength,base.smithingHammer.handleLength,4,18),
        headWidth:num(smithingHammer.headWidth,base.smithingHammer.headWidth,3,14),
        handleThickness:num(smithingHammer.handleThickness,base.smithingHammer.handleThickness,.5,3),
        headHeight:num(smithingHammer.headHeight,base.smithingHammer.headHeight,2,8),
        cycleMs:num(smithingHammer.cycleMs,base.smithingHammer.cycleMs,420,1400)
      },
      oreMinimap:{
        iconSize:num(oreMinimap.iconSize,base.oreMinimap.iconSize,3,16),
        clusterRadiusTiles:num(oreMinimap.clusterRadiusTiles,base.oreMinimap.clusterRadiusTiles,2,24)
      },
      oreVeins:{
        standardScale:num(oreVeins.standardScale,base.oreVeins.standardScale,.65,1.8),
        remoteScale:num(oreVeins.remoteScale,base.oreVeins.remoteScale,.75,2.1),
        richScale:num(oreVeins.richScale,base.oreVeins.richScale,.85,2.5)
      },
      smithingAnvil:{
        offsetX:num(smithingAnvil.offsetX,base.smithingAnvil.offsetX,-220,220),
        offsetY:num(smithingAnvil.offsetY,base.smithingAnvil.offsetY,-220,220),
        scale:num(smithingAnvil.scale,base.smithingAnvil.scale,.4,2.5)
      },
      questTracker:{fontScale:num(trackerScale,base.questTracker.fontScale,.75,2)},
      placedLights
    };
  }

  setDevPlacementConfig(value){this.devPlacementConfig=this.sanitizeDevPlacementConfig(value);this.minimapDirty=true;return this.getDevPlacementConfig();}
  getDevPlacementConfig(){return JSON.parse(JSON.stringify(this.devPlacementConfig||this.defaultDevPlacementConfig()));}
  setDevPlacementEnabled(value){this.devPlacementEnabled=!!value;if(!this.devPlacementEnabled)this.devPlacementSelection='';}
  setDevPlacementSelection(id){this.devPlacementSelection=String(id||'');}

  playerVisualFacing(){
    const p=this.player;let facing=p.facing==='left'?'left':'right';
    if(this.combatPlayerAttacking&&this.combatFoe&&!this.combatFoe.combatEvading){const dx=this.combatFoe.x-p.x;if(Math.abs(dx)>.75)facing=dx<0?'left':'right';}
    return facing;
  }

  playerVisualScale(){
    // v0.219.7: the larger player is no longer a cosmetic toggle. 64×64 is now
    // the canonical delver presentation used by both the live world and the
    // Template Workshop reference actor.
    return 2;
  }

  playerSpriteRenderSize(){
    return Math.max(1,Math.round(PLAYER_SPRITE_SIZE*this.playerVisualScale()));
  }

  playerLanternScreenPosition(){
    const p=this.player,ps=this.worldToScreen(p.x+(p.renderOffsetX||0),p.y+(p.renderOffsetY||0));
    const cfg=this.devPlacementConfig?.playerLanternGlow||this.defaultDevPlacementConfig().playerLanternGlow,visualScale=this.playerVisualScale();
    const facing=this.playerVisualFacing(),localX=(facing==='left'?cfg.sideOffset:-cfg.sideOffset)*visualScale,localY=cfg.y*visualScale;
    return{x:ps.x+localX,y:ps.y+localY,facing,playerX:ps.x,playerY:ps.y};
  }

  getDevPlacementCandidates(screenX,screenY){
    if(!this.devPlacementEnabled)return[];
    const x=Number(screenX)||0,y=Number(screenY)||0,out=[];
    const lp=this.playerLanternScreenPosition(),pd=Math.hypot(x-lp.playerX,y-lp.playerY),ld=Math.hypot(x-lp.x,y-lp.y),spritePickRadius=Math.max(28,this.playerSpriteRenderSize()*.55);
    if(ld<=24)out.push({id:'playerLanternGlow',label:'Player lantern · warm glow',editable:true,kind:'light'});
    if(pd<=spritePickRadius){
      out.push({id:'playerLanternVisibility',label:'Player lantern · visibility radius',editable:true,kind:'light'});
      out.push({id:'miningSwing',label:'Mining pickaxe · swing preview',editable:true,kind:'animation'});
      out.push({id:'smithingHammer',label:'Smithing hammer · swing preview',editable:true,kind:'animation'});
      out.push({id:'playerSprite',label:'Player sprite',editable:false,kind:'protected'});
      out.push({id:'playerCollision',label:'Player collision',editable:false,kind:'protected'});
    }
    for(const light of this.devPlacementConfig?.placedLights||[]){const s=this.worldToScreen(Number(light.x)||0,Number(light.y)||0);if(Math.hypot(x-s.x,y-s.y)<=18)out.push({id:`placedLight:${light.id}`,label:'Placed light · warm source',editable:true,kind:'light'});}
    for(const e of this.activeEntities||[]){
      if(!e||e.dead)continue;
      const s=this.worldToScreen(Number(e.x)||0,Number(e.y)||0),r=Math.max(12,Number(e.r)||8)+8;
      if(Math.hypot(x-s.x,y-s.y)>r)continue;
      const label=String(e.name||e.profile?.name||e.type||'World entity'),entityKey=String(e.id||label);
      if(e.type==='hollow')out.push({id:`campfireVisibility:${entityKey}`,label:'Campfire · visibility radius',editable:true,kind:'light'});
      if(e.type==='ore')out.push({id:'oreVeins',label:'Ore veins · visual sizes',editable:true,kind:'resource'});
      if(e.type==='smithingstation'&&e.station==='anvil')out.push({id:'smithingAnvil',label:'Dawngate anvil · placement',editable:true,kind:'prop'});
      out.push({id:`entity:${entityKey}`,label:`${label} · world entity`,editable:false,kind:'protected'});
    }
    return out;
  }

  drawDevPlacementOverlay(){
    if(!this.devPlacementEnabled)return;
    const c=this.ctx,id=this.devPlacementSelection;
    c.save();c.setLineDash([]);c.lineWidth=1;c.strokeStyle='rgba(228,192,107,.72)';c.fillStyle='rgba(228,192,107,.46)';
    for(const light of this.devPlacementConfig?.placedLights||[]){const s=this.worldToScreen(light.x,light.y);if(s.x<-12||s.x>this.logicalViewW()+12||s.y<-12||s.y>this.logicalViewH()+12)continue;c.globalAlpha=id===`placedLight:${light.id}`?.96:.58;c.strokeRect(Math.round(s.x-4)+.5,Math.round(s.y-4)+.5,8,8);c.fillRect(Math.round(s.x-1),Math.round(s.y-1),3,3);}
    c.restore();
    if(!id)return;
    c.save();c.globalAlpha=.92;c.lineWidth=1;c.setLineDash([4,3]);c.strokeStyle='#e4c06b';c.fillStyle='rgba(228,192,107,.12)';
    const ps=this.worldToScreen(this.player.x+(this.player.renderOffsetX||0),this.player.y+(this.player.renderOffsetY||0));
    if(id==='playerLanternGlow'){
      const cfg=this.devPlacementConfig.playerLanternGlow,pos=this.playerLanternScreenPosition();
      c.beginPath();c.arc(pos.x,pos.y,cfg.innerRadius,0,Math.PI*2);c.stroke();c.globalAlpha=.55;c.beginPath();c.arc(pos.x,pos.y,cfg.outerRadius,0,Math.PI*2);c.stroke();c.globalAlpha=.95;c.setLineDash([]);c.fillRect(Math.round(pos.x-2),Math.round(pos.y-2),5,5);
    }else if(id==='playerLanternVisibility'){
      const cfg=this.devPlacementConfig.playerLanternVisibility;c.beginPath();c.arc(ps.x,ps.y,cfg.clearRadius,0,Math.PI*2);c.stroke();c.globalAlpha=.48;c.beginPath();c.arc(ps.x,ps.y,cfg.falloffOuter,0,Math.PI*2);c.stroke();
    }else if(id==='miningSwing'){
      const cfg=this.devPlacementConfig.miningSwing||this.defaultDevPlacementConfig().miningSwing,vs=this.playerVisualScale(),facing=this.playerVisualFacing(),px=ps.x+(facing==='left'?-cfg.pivotX:cfg.pivotX)*vs,py=ps.y+cfg.pivotY*vs;
      c.setLineDash([]);c.globalAlpha=.95;c.strokeStyle='#e4c06b';c.beginPath();c.moveTo(px-4,py);c.lineTo(px+4,py);c.moveTo(px,py-4);c.lineTo(px,py+4);c.stroke();
    }else if(id==='smithingHammer'){
      const cfg=this.devPlacementConfig.smithingHammer||this.defaultDevPlacementConfig().smithingHammer,vs=this.playerVisualScale(),facing=this.playerVisualFacing(),px=ps.x+(facing==='left'?-cfg.pivotX:cfg.pivotX)*vs,py=ps.y+cfg.pivotY*vs;
      c.setLineDash([]);c.globalAlpha=.95;c.strokeStyle='#e4c06b';c.beginPath();c.moveTo(px-4,py);c.lineTo(px+4,py);c.moveTo(px,py-4);c.lineTo(px,py+4);c.stroke();
    }else if(id==='smithingAnvil'){
      const pos=this.smithingAnvilWorldPosition();if(pos){const s=this.worldToScreen(pos.x,pos.y);c.setLineDash([]);c.strokeStyle='#e4c06b';c.strokeRect(Math.round(s.x-14),Math.round(s.y-14),28,24);c.beginPath();c.moveTo(s.x-5,s.y);c.lineTo(s.x+5,s.y);c.moveTo(s.x,s.y-5);c.lineTo(s.x,s.y+5);c.stroke();}
    }else if(id==='oreVeins'){
      c.setLineDash([]);c.font='bold 8px monospace';c.textAlign='center';for(const e of this.activeEntities||[]){if(e?.type!=='ore')continue;const s=this.worldToScreen(e.x,e.y);c.fillStyle='#e4c06b';c.fillText(String(e.veinClass||'standard').toUpperCase(),s.x,s.y-28);}
    }else if(id.startsWith('campfireVisibility:')){
      const key=id.slice('campfireVisibility:'.length),e=(this.activeEntities||[]).find(v=>String(v?.id||v?.name||v?.type||'')===key&&v?.type==='hollow');
      if(e){const s=this.worldToScreen(e.x,e.y-8),cfg=this.devPlacementConfig.campfireVisibility;c.beginPath();c.arc(s.x,s.y,cfg.clearRadius,0,Math.PI*2);c.stroke();c.globalAlpha=.68;c.beginPath();c.arc(s.x,s.y,cfg.featherRadius,0,Math.PI*2);c.stroke();c.globalAlpha=.42;c.beginPath();c.arc(s.x,s.y,cfg.falloffOuter,0,Math.PI*2);c.stroke();}
    }else if(id.startsWith('placedLight:')){
      const key=id.slice('placedLight:'.length),light=(this.devPlacementConfig?.placedLights||[]).find(v=>String(v?.id||'')===key);
      if(light){const s=this.worldToScreen(light.x,light.y);c.beginPath();c.arc(s.x,s.y,light.clearRadius,0,Math.PI*2);c.stroke();c.globalAlpha=.58;c.beginPath();c.arc(s.x,s.y,light.featherRadius,0,Math.PI*2);c.stroke();c.globalAlpha=.38;c.beginPath();c.arc(s.x,s.y,light.falloffOuter,0,Math.PI*2);c.stroke();c.globalAlpha=.96;c.setLineDash([]);c.fillRect(Math.round(s.x-2),Math.round(s.y-2),5,5);}
    }else if(id==='playerSprite'){
      const size=this.playerSpriteRenderSize();
      c.strokeRect(Math.round(ps.x-size/2),Math.round(ps.y+11-size),size,size);
    }else if(id==='playerCollision'){
      c.beginPath();c.arc(ps.x,ps.y,this.player.r,0,Math.PI*2);c.stroke();
    }else if(id.startsWith('entity:')){
      const key=id.slice(7),e=(this.activeEntities||[]).find(v=>String(v?.id||v?.name||v?.type||'')===key);
      if(e){const s=this.worldToScreen(e.x,e.y);c.beginPath();c.arc(s.x,s.y,Math.max(10,Number(e.r)||8),0,Math.PI*2);c.stroke();}
    }
    c.restore();
  }

  cutVisibilityCircle(c,x,y,clearRadius=104,featherRadius=132,strength=1){
    const inner=Math.max(1,Number(clearRadius)||104),outer=Math.max(inner+1,Number(featherRadius)||132),s=clamp(Number(strength)||0,0,1);
    const g=c.createRadialGradient(x,y,0,x,y,outer);
    const edge=clamp(inner/outer,0,.98);
    g.addColorStop(0,`rgba(0,0,0,${s})`);
    g.addColorStop(edge,`rgba(0,0,0,${s})`);
    g.addColorStop(1,'rgba(0,0,0,0)');
    c.fillStyle=g;c.beginPath();c.arc(x,y,outer,0,Math.PI*2);c.fill();
  }

  cutVisibilityFalloff(c,x,y,innerRadius=112,outerRadius=220,strength=.28){
    const inner=Math.max(1,Number(innerRadius)||112),outer=Math.max(inner+1,Number(outerRadius)||220),s=clamp(Number(strength)||0,0,1);
    const g=c.createRadialGradient(x,y,0,x,y,outer);
    const edge=clamp(inner/outer,0,.985),edge2=Math.min(.995,edge+.003);
    g.addColorStop(0,'rgba(0,0,0,0)');
    g.addColorStop(edge,'rgba(0,0,0,0)');
    g.addColorStop(edge2,`rgba(0,0,0,${s})`);
    g.addColorStop(1,'rgba(0,0,0,0)');
    c.fillStyle=g;c.beginPath();c.arc(x,y,outer,0,Math.PI*2);c.fill();
  }

  hostileIlluminationAtScreen(x,y){
    if(!this.atmosphereEffectsEnabled)return 1;
    const ps=this.worldToScreen(this.player.x+(this.player.renderOffsetX||0),this.player.y+(this.player.renderOffsetY||0));
    const d=Math.hypot(x-ps.x,y-ps.y);
    const vis=this.devPlacementConfig?.playerLanternVisibility||this.defaultDevPlacementConfig().playerLanternVisibility;
    const clear=Math.max(1,vis.clearRadius),outer=Math.max(clear+1,vis.falloffOuter);
    let light=1;
    if(d>clear){
      if(d<outer){
        const t=clamp((d-clear)/(outer-clear),0,1);
        light=1-(t*.76);
      }else light=.16;
    }
    // A hostile standing near a genuine environmental light should become readable
    // again even when it is outside the player's own lantern radius.
    for(const source of this.lightSources){
      const r=Math.max(1,Number(source.radius)||1),sd=Math.hypot(x-source.x,y-source.y);
      if(sd>=r)continue;
      const local=clamp(1-(sd/r),0,1);
      light=Math.max(light,.30+local*.70);
    }
    return clamp(light,.14,1);
  }

  drawLightGlow(c,x,y,radius,color='rgba(244,188,100,.14)',alpha=.16){
    const r=Math.max(1,Number(radius)||1),a=clamp(Number(alpha)||0,0,1);
    const g=c.createRadialGradient(x,y,0,x,y,r);
    const rgba=String(color||'rgba(244,188,100,.14)');
    const soft=rgba.replace(/rgba\(([^,]+),([^,]+),([^,]+),[^)]+\)/,(_m,r,g,b)=>`rgba(${r},${g},${b},${a})`);
    const mid=rgba.replace(/rgba\(([^,]+),([^,]+),([^,]+),[^)]+\)/,(_m,r,g,b)=>`rgba(${r},${g},${b},${Math.max(0,a*.45)})`);
    g.addColorStop(0,soft);
    g.addColorStop(.45,mid);
    g.addColorStop(1,'rgba(0,0,0,0)');
    c.fillStyle=g;c.beginPath();c.arc(x,y,r,0,Math.PI*2);c.fill();
  }

  drawAtmosphericLighting(){
    if(!this.atmosphereEffectsEnabled)return;
    const c=this.ctx,w=this.logicalViewW(),h=this.logicalViewH(),depth=depthFromY(this.player.y),stratum=stratumIndex(depth);
    const darkness=stratum===0?.40:.50;
    const ps=this.worldToScreen(this.player.x+(this.player.renderOffsetX||0),this.player.y+(this.player.renderOffsetY||0));
    const mask=this.lightingCanvas,m=this.lightingCtx;
    if(!mask||!m)return;

    const mw=Math.max(1,Math.ceil(w)),mh=Math.max(1,Math.ceil(h));
    if(mask.width!==mw||mask.height!==mh){mask.width=mw;mask.height=mh;}
    m.setTransform(1,0,0,1,0,0);
    m.clearRect(0,0,mw,mh);

    // Build the darkness on an alpha-capable offscreen canvas. The main world
    // canvas is deliberately opaque, so erasing it directly produces black.
    m.globalCompositeOperation='source-over';
    m.fillStyle=`rgba(3,5,8,${darkness})`;
    m.fillRect(0,0,mw,mh);

    // Fully reveal the real rendered world around the player. Developer placement
    // mode can tune this presentation safely without touching world collision.
    const vis=this.devPlacementConfig?.playerLanternVisibility||this.defaultDevPlacementConfig().playerLanternVisibility;
    const clearRadius=Math.max(1,vis.clearRadius),featherRadius=Math.max(clearRadius+1,vis.featherRadius),falloffOuter=Math.max(featherRadius+1,vis.falloffOuter);
    m.globalCompositeOperation='destination-out';
    this.cutVisibilityCircle(m,ps.x,ps.y,clearRadius,featherRadius,1);

    // After the main clear radius, preserve a second wider band of partial visibility
    // so the light falls off with distance instead of snapping straight into darkness.
    this.cutVisibilityFalloff(m,ps.x,ps.y,clearRadius,falloffOuter,vis.falloffStrength);

    // Environmental lights punch smaller visibility pockets through the same
    // darkness mask. They reveal terrain instead of painting blurry colour blobs.
    for(const light of this.lightSources){
      const clear=Math.max(4,Math.min(Number(light.cutout)||0,(Number(light.radius)||0)*.95));
      const feather=Math.max(clear+3,Number.isFinite(light.feather)?Number(light.feather):Math.min(Number(light.radius)||clear+10,clear+10));
      const strength=clamp(Number(light.strength)||0,0,1);
      this.cutVisibilityCircle(m,light.x,light.y,clear,feather,strength);
      const falloffOuter=Math.max(feather+1,Number(light.falloffOuter)||0),falloffStrength=clamp(Number(light.falloffStrength)||0,0,1);
      if(falloffOuter>feather&&falloffStrength>0)this.cutVisibilityFalloff(m,light.x,light.y,clear,falloffOuter,falloffStrength);
    }

    m.globalCompositeOperation='source-over';
    c.save();
    c.globalCompositeOperation='source-over';
    c.drawImage(mask,0,0,mw,mh,0,0,w,h);
    c.restore();
  }

  draw(){
    const c=this.ctx,w=this.logicalViewW(),h=this.logicalViewH();
    if(!w||!h)return;
    c.setTransform((this.dpr||1)*(this.zoom||1),0,0,(this.dpr||1)*(this.zoom||1),0,0);
    c.imageSmoothingEnabled=false;
    c.fillStyle='#020507';c.fillRect(0,0,w,h);
    this.lightSources.length=0;
    this.fireflyAttractors.length=0;
    this.queueDevPlacedLights();
    const left=this.camera.x-w/2,top=this.camera.y-h/2;
    const tx0=Math.floor(left/TILE)-1,tx1=Math.ceil((left+w)/TILE)+1,ty0=Math.floor(top/TILE)-1,ty1=Math.ceil((top+h)/TILE)+1;
    for(let ty=ty0;ty<=ty1;ty++)for(let tx=tx0;tx<=tx1;tx++)this.drawTile(tx,ty);
    this.drawForestPonds();
    this.drawAmbientBoulders();
    this.drawBossChambers(ty0,ty1);
    this.drawWorldEventRoutes();
    this.drawActiveSideRoute();
    this.drawAuthoredTownLayer('ground');
    this.drawTownOverlays();
    this.drawAuthoredTownLayer('normal');
    this.drawAmbientFireflies();
    this.drawAmbientWaterDrips();
    if(this.edgeAtmosphereEnabled&&stratumIndex(depthFromY(this.player.y))===0)this.drawForestAtmosphere();
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
    this.drawAuthoredTownLayer('foreground');
    this.drawAuthoredTownOcclusion();
    this.drawDevPlacedLightGlows();
    this.drawAtmosphericLighting();
    this.drawTownQuestMarkers();
    for(const p of this.particles)this.drawParticle(p);
    this.drawDepthDirection();
    this.drawDevPlacementOverlay();
  }

  drawForestTile(tx,ty,s,wall,n){
    const c=this.ctx,x=Math.floor(s.x),y=Math.floor(s.y);
    if(wall){
      // Forest Plains collision is still real world geometry, but its solid mass
      // reads as roots, trunks, damp growth and buried stone rather than open-air forest.
      const grove=hash2(Math.floor(tx/6),Math.floor(ty/6),this.seed+8101),stone=hash2(tx*5,ty*7,this.seed+8129);
      c.fillStyle=grove>.54?'#0f170d':'#10180e';c.fillRect(x,y,TILE+1,TILE+1);
      c.fillStyle=n>.50?'#162111':'#182413';c.fillRect(x+2,y+2,TILE-4,TILE-3);
      if(grove>.74){
        c.fillStyle='#2f291b';c.fillRect(x+7,y-1,10,TILE+2);c.fillStyle='#483826';c.fillRect(x+9,y-1,3,TILE+2);
        c.fillStyle='#253119';c.fillRect(x+2,y+17,20,5);c.fillRect(x+4,y+13,5,10);c.fillRect(x+15,y+12,5,11);
      }else if(n>.76){
        c.fillStyle='#27331a';c.fillRect(x+4,y+15,16,4);c.fillRect(x+7,y+10,4,10);
      }
      if(stone>.82){
        c.fillStyle='#425047';c.fillRect(x+3,y+6,4,9);c.fillRect(x+5,y+4,7,3);c.fillStyle='#697464';c.fillRect(x+6,y+5,3,1);
      }else if(stone<.10){
        c.fillStyle='#51604e';c.fillRect(x+13,y+8,6,5);c.fillStyle='#364034';c.fillRect(x+12,y+12,8,3);
      }
      const floorBelow=!this.isWall(tx,ty+1),floorAbove=!this.isWall(tx,ty-1),floorLeft=!this.isWall(tx-1,ty),floorRight=!this.isWall(tx+1,ty);
      c.fillStyle='rgba(93,108,58,.26)';
      if(floorBelow)c.fillRect(x,y+TILE-3,TILE,3);if(floorAbove)c.fillRect(x,y,TILE,3);if(floorLeft)c.fillRect(x,y,3,TILE);if(floorRight)c.fillRect(x+TILE-3,y,3,TILE);
      c.fillStyle='rgba(21,27,15,.28)';
      if(floorAbove)c.fillRect(x,y,TILE,6);
    }else{
      const settlementFloor=this.townSafeZone(tx,ty),path=!settlementFloor&&Math.abs(tx-this.corridorCenter(ty))<=3,fleck=hash2(tx*3,ty*5,this.seed+8117),damp=hash2(tx*7,ty*11,this.seed+8161),flora=hash2(tx*11,ty*13,this.seed+9301),water=hash2(tx*17,ty*19,this.seed+9377),landmark=hash2(Math.floor(tx/3),Math.floor(ty/3),this.seed+9451);
      c.fillStyle=path?'#262518':(n>.55?'#1a2515':'#1c2816');c.fillRect(x,y,TILE+1,TILE+1);
      if(path){c.fillStyle='rgba(95,76,44,.23)';c.fillRect(x,y+9,TILE,7);c.fillStyle='rgba(58,52,31,.18)';c.fillRect(x,y+5,TILE,2);}
      if(fleck>.48){c.fillStyle='#314023';c.fillRect(x+4,y+5,2,4);c.fillRect(x+16,y+14,3,2);}
      if(fleck>.79){c.fillStyle='#535a37';c.fillRect(x+9,y+17,2,2);c.fillRect(x+12,y+6,1,3);}
      if(fleck<.05){c.fillStyle='#566250';c.fillRect(x+6,y+11,11,3);c.fillStyle='#6f7666';c.fillRect(x+9,y+7,3,7);} // buried stone/ruin rib
      if(!settlementFloor&&fleck>.985){c.fillStyle='#a57939';c.fillRect(x+3,y+18,2,2);c.fillRect(x+19,y+8,2,2);if(hash2(tx,ty,this.seed+8187)>.5)this.queueLightSource(x+20,y+9,{radius:12,cutout:6,color:'rgba(240,178,86,.10)',alpha:.06});} // rare warm spores / fireflies
      if(damp>.72){c.fillStyle='rgba(37,55,32,.28)';c.fillRect(x+1,y+15,7,4);c.fillRect(x+13,y+3,6,3);} // damp moss bands
      if(!settlementFloor&&damp<.05){c.fillStyle='#7d8667';c.fillRect(x+10,y+13,1,3);c.fillRect(x+12,y+14,1,2);c.fillStyle='#d9caa1';c.fillRect(x+9,y+12,1,1);c.fillRect(x+13,y+13,1,1);if(hash2(tx,ty,this.seed+8199)>.72)this.queueLightSource(x+11,y+13,{radius:12,cutout:6,color:'rgba(151,224,188,.08)',alpha:.05});} // rare pale fungi

      // Atmospheric flora and landmarks. These are decorative and separate from
      // future gatherable mushrooms, giving the biome more life right now.
      const special=!settlementFloor&&!path&&landmark>.945;
      if(!settlementFloor&&!path&&flora>.965&&damp<.52)this.drawForestGlowMushrooms(x,y,tx,ty,flora,special?1:0);
      if(special && water>.72 && damp>.40 && flora>.52){
        c.fillStyle='rgba(86,122,76,.26)';c.fillRect(x+2,y+18,5,2);c.fillRect(x+17,y+18,4,2);c.fillRect(x+11,y+7,3,2);
        this.queueFireflyAttractor(x+12,y+13,{radius:24,warm:flora>.9,density:1.35,seedBase:tx*4099+ty*131+9451});
      }
    }
  }

  drawForestAtmosphere(){
    const c=this.ctx,w=this.logicalViewW(),h=this.logicalViewH();
    c.save();

    // Irregular overhead ceiling mass. This remains the main cue that the Forest
    // Plains sit inside a cavern rather than beneath open sky.
    const segW=Math.ceil(w/7),leftWorld=Math.floor((this.camera.x-w/2)/TILE),topWorld=Math.floor((this.camera.y-h/2)/TILE);
    for(let i=-1;i<=7;i++){
      const seedX=leftWorld+i*5,cap=28+Math.floor(hash2(seedX,topWorld,this.seed+8201)*32),width=segW+18+Math.floor(hash2(seedX,topWorld,this.seed+8207)*16),x=i*segW-9;
      c.fillStyle='rgba(8,12,7,.28)';c.fillRect(x,0,width,cap);
      c.fillStyle='rgba(18,24,13,.24)';
      for(let j=0;j<3;j++){
        const rx=x+4+Math.floor(hash2(seedX,j,this.seed+8213)*(Math.max(12,width-12))),len=8+Math.floor(hash2(seedX,j,this.seed+8221)*22),rw=1+Math.floor(hash2(seedX,j,this.seed+8229)*2);
        c.fillRect(rx,cap-2,rw,len);
      }
    }

    // Side-wall pressure: blocky cavern edges pushing inward from both sides.
    for(let i=0;i<6;i++){
      const y=12+i*Math.floor(h/7),lw=14+Math.floor(hash2(leftWorld,i,this.seed+8249)*22),rw=14+Math.floor(hash2(leftWorld,i,this.seed+8261)*22),hh=30+Math.floor(hash2(leftWorld,i,this.seed+8273)*34);
      c.fillStyle='rgba(9,12,8,.07)';c.fillRect(0,y,lw,hh);c.fillRect(w-rw,y+4,rw,Math.max(14,hh-6));
      c.fillStyle='rgba(20,26,15,.045)';c.fillRect(lw-4,y+3,4,Math.max(10,hh-10));c.fillRect(w-rw,y+8,4,Math.max(10,hh-14));
    }

    // Bottom-edge intrusion keeps the space feeling bounded below without choking
    // the player area. It should be present, but weaker than the ceiling.
    const bottomBandH=20+Math.floor(hash2(leftWorld,topWorld,this.seed+8331)*10);
    c.fillStyle='rgba(9,12,8,.055)';
    for(let i=-1;i<=7;i++){
      const seedX=leftWorld+i*7,bh=bottomBandH+Math.floor(hash2(seedX,topWorld,this.seed+8339)*18),bw=segW+12+Math.floor(hash2(seedX,topWorld,this.seed+8347)*20),x=i*segW-6;
      c.fillRect(x,h-bh,bw,bh);
      if(hash2(seedX,topWorld,this.seed+8353)>.38){
        c.fillStyle='rgba(18,24,13,.04)';
        c.fillRect(x+6,h-bh-8,4,8+Math.floor(hash2(seedX,3,this.seed+8361)*9));
        c.fillRect(x+bw-10,h-bh-5,3,6+Math.floor(hash2(seedX,5,this.seed+8369)*7));
        c.fillStyle='rgba(9,12,8,.15)';
      }
    }

    // Root/stone silhouettes near the upper edges.
    c.fillStyle='rgba(31,41,23,.22)';
    for(let i=0;i<9;i++){
      const px=10+Math.floor(hash2(leftWorld,i,this.seed+8291)*(w-20)),py=4+Math.floor(hash2(topWorld,i,this.seed+8299)*26),pw=8+Math.floor(hash2(leftWorld,i,this.seed+8303)*12),ph=5+Math.floor(hash2(leftWorld,i,this.seed+8311)*10);
      c.fillRect(px,py,pw,ph);c.fillRect(px+Math.floor(pw*.35),py+ph,2,6+Math.floor(hash2(i,leftWorld,this.seed+8317)*10));
    }

    // Side and bottom root/stone silhouettes so the enclosure reads from every edge.
    c.fillStyle='rgba(25,33,18,.17)';
    for(let i=0;i<10;i++){
      const py=14+Math.floor(hash2(topWorld,i,this.seed+8377)*(h-44)),ph=8+Math.floor(hash2(leftWorld,i,this.seed+8387)*16),pw=4+Math.floor(hash2(leftWorld,i,this.seed+8393)*7);
      if(i<5)c.fillRect(0,py,pw,ph); else c.fillRect(w-pw,py,pw,ph);
      const bx=8+Math.floor(hash2(leftWorld,i,this.seed+8401)*(w-16)),bw=6+Math.floor(hash2(topWorld,i,this.seed+8407)*14),bh=4+Math.floor(hash2(leftWorld,i,this.seed+8413)*8);
      c.fillRect(bx,h-bh-2,bw,bh);
    }

    // Broad edge-darkening keeps distant forest pockets feeling enclosed and subterranean.
    let grad=c.createRadialGradient(w/2,h*.52,Math.min(w,h)*.15,w/2,h*.52,Math.max(w,h)*.80);
    grad.addColorStop(0,'rgba(14,18,10,0)');
    grad.addColorStop(.66,'rgba(10,13,8,.09)');
    grad.addColorStop(1,'rgba(5,7,5,.28)');
    c.fillStyle=grad;c.fillRect(0,0,w,h);

    // Directional vignette: strongest on top, medium on the sides, lightest on the bottom.
    grad=c.createLinearGradient(0,0,0,h);
    grad.addColorStop(0,'rgba(6,8,6,.19)');
    grad.addColorStop(.18,'rgba(6,8,6,.11)');
    grad.addColorStop(.55,'rgba(6,8,6,0)');
    grad.addColorStop(1,'rgba(6,8,6,.07)');
    c.fillStyle=grad;c.fillRect(0,0,w,h);
    grad=c.createLinearGradient(0,0,w,0);
    grad.addColorStop(0,'rgba(6,8,6,.15)');
    grad.addColorStop(.12,'rgba(6,8,6,.08)');
    grad.addColorStop(.30,'rgba(6,8,6,0)');
    grad.addColorStop(.70,'rgba(6,8,6,0)');
    grad.addColorStop(.88,'rgba(6,8,6,.08)');
    grad.addColorStop(1,'rgba(6,8,6,.15)');
    c.fillStyle=grad;c.fillRect(0,0,w,h);

    // A faint misty screen softens the openness without making the biome too dark.
    c.globalCompositeOperation='screen';
    grad=c.createLinearGradient(0,0,0,h);
    grad.addColorStop(0,'rgba(170,182,150,.018)');
    grad.addColorStop(.45,'rgba(130,144,116,.010)');
    grad.addColorStop(1,'rgba(0,0,0,0)');
    c.fillStyle=grad;c.fillRect(0,0,w,h*.72);
    c.restore();
  }

  drawAmbientFireflies(){
    if(!this.atmosphereEffectsEnabled)return;
    const depth=depthFromY(this.player.y),stratum=stratumIndex(depth);
    if(stratum!==0)return;
    const c=this.ctx,w=this.logicalViewW(),h=this.logicalViewH();
    const left=this.camera.x-w/2,top=this.camera.y-h/2;
    const cell=128;
    const gx0=Math.floor(left/cell)-1,gx1=Math.ceil((left+w)/cell)+1,gy0=Math.floor(top/cell)-1,gy1=Math.ceil((top+h)/cell)+1;
    c.save();
    c.globalCompositeOperation='screen';
    for(let gy=gy0;gy<=gy1;gy++)for(let gx=gx0;gx<=gx1;gx++){
      const n=hash2(gx,gy,this.seed+9101);
      if(n<.77)continue; // scattered, but not too rare
      const clusterX=gx*cell+Math.floor(hash2(gx,gy,this.seed+9113)*(cell-18))+9;
      const clusterY=gy*cell+Math.floor(hash2(gx,gy,this.seed+9127)*(cell-18))+9;
      const tx=Math.floor(clusterX/TILE),ty=Math.floor(clusterY/TILE);
      if(this.isWall(tx,ty))continue;
      const phase=hash2(gx,gy,this.seed+9139)*Math.PI*2;
      const driftX=Math.sin(this.time*.18+phase)*4;
      const driftY=Math.cos(this.time*.16+phase*1.3)*3;
      const sx=this.worldToScreen(clusterX+driftX,clusterY+driftY).x,sy=this.worldToScreen(clusterX+driftX,clusterY+driftY).y;
      if(sx<-18||sx>w+18||sy<-18||sy>h+18)continue;
      this.drawFireflyCluster(c,sx,sy,gx*4096+gy,n>.93?3:2,hash2(gx,gy,this.seed+9151)>.55,1,1);
    }
    // Extra local groups around glowing flora / ponds so the creatures feel like
    // they are reacting to the environment rather than being random particles.
    let budget=18;
    for(const attractor of this.fireflyAttractors){
      if(budget--<=0)break;
      this.drawFireflyCluster(c,attractor.x,attractor.y,attractor.seedBase,attractor.density>1.18?3:2,attractor.warm,attractor.density,.82,.62);
    }
    c.restore();
  }


  forestForegroundToScreen(x,y,parallax=1.14){
    // Proper near-plane parallax: scale the object's camera-relative distance.
    // The old formula scaled the absolute camera coordinate, which could push
    // foreground pieces out of view as depth increased.
    return{
      x:(x-this.camera.x)*parallax+this.logicalViewW()/2,
      y:(y-this.camera.y)*parallax+this.logicalViewH()/2
    };
  }

  drawForegroundStalactite(x,y,len,baseW,alpha=.28){
    const c=this.ctx,segments=Math.max(5,Math.ceil(len/8));
    c.save();
    c.globalAlpha=alpha;
    c.fillStyle='#070a07';
    for(let i=0;i<segments;i++){
      const t=i/segments,segTop=Math.round(y+t*len),segH=Math.max(3,Math.ceil(len/segments));
      const wobble=(i%3===1?1:(i%4===2?-1:0)),segW=Math.max(2,Math.round(baseW*(1-t*.84)));
      c.fillRect(Math.round(x-segW/2+wobble),segTop,segW,segH);
    }
    // A faint ridge prevents the silhouette becoming an unreadable flat black bar.
    c.globalAlpha=alpha*.36;
    c.fillStyle='#35402b';
    c.fillRect(Math.round(x-baseW*.22),Math.round(y+3),Math.max(1,Math.round(baseW*.16)),Math.max(5,Math.round(len*.34)));
    c.restore();
  }

  drawForestForeground(){
    const c=this.ctx,w=this.logicalViewW(),h=this.logicalViewH(),sector=TILE*9;
    const left=this.camera.x-w/2,top=this.camera.y-h/2;
    const sx0=Math.floor(left/sector)-2,sx1=Math.ceil((left+w)/sector)+2;
    const sy0=Math.floor(top/sector)-2,sy1=Math.ceil((top+h)/sector)+2;

    c.save();
    c.imageSmoothingEnabled=false;

    // TOP FOREGROUND — large near-plane stalactites. These are genuinely tied to
    // world coordinates and use stronger near-plane parallax, so they visibly pass
    // by as the delver moves rather than behaving like a static vignette.
    for(let sy=sy0;sy<=sy1;sy++)for(let sx=sx0;sx<=sx1;sx++){
      const roll=hash2(sx,sy,this.seed+8501);
      if(roll<.34)continue;

      const wx=(sx+.08+hash2(sx,sy,this.seed+8513)*.84)*sector;
      const wy=(sy+.02+hash2(sx,sy,this.seed+8521)*.18)*sector;
      const s=this.forestForegroundToScreen(wx,wy,1.18);
      const len=40+Math.floor(hash2(sx,sy,this.seed+8527)*64);
      const baseW=11+Math.floor(hash2(sx,sy,this.seed+8531)*15);

      // Only stalactites whose attachment point is at/near the visible ceiling are
      // drawn. This prevents "floating" spikes in the middle of the forest.
      if(s.x<-baseW-18||s.x>w+baseW+18||s.y<-70||s.y>86)continue;

      const edgeBias=Math.min(1,Math.abs(s.x-w/2)/(w*.5));
      const alpha=.22+.10*edgeBias;
      this.drawForegroundStalactite(s.x,s.y,len,baseW,alpha);

      // Short ceiling shelf at the attachment point helps them read as hanging.
      c.fillStyle=`rgba(7,10,7,${Math.min(.28,alpha*.82)})`;
      c.fillRect(Math.round(s.x-baseW*.78),Math.round(s.y-5),Math.round(baseW*1.56),7);
    }

    // SIDE FOREGROUND — moving blocky cavern pressure driven by world-Y bands.
    // These replace the "stuck to the monitor" feel of the old side blocks.
    for(let sy=sy0;sy<=sy1;sy++){
      const bandY=(sy+.18+hash2(sy,41,this.seed+8621)*.64)*sector;
      const s=this.forestForegroundToScreen(this.camera.x,bandY,1.13);
      const hh=42+Math.floor(hash2(sy,43,this.seed+8629)*72);
      if(s.y+hh<-30||s.y>h+30)continue;

      const lw=14+Math.floor(hash2(sy,47,this.seed+8633)*34);
      const rw=14+Math.floor(hash2(sy,53,this.seed+8641)*34);
      const notchL=5+Math.floor(hash2(sy,59,this.seed+8647)*14);
      const notchR=5+Math.floor(hash2(sy,61,this.seed+8653)*14);

      c.fillStyle='rgba(6,9,6,.20)';
      c.fillRect(0,Math.round(s.y),lw,hh);
      c.fillRect(w-rw,Math.round(s.y+8),rw,Math.max(18,hh-12));

      c.fillStyle='rgba(28,36,22,.10)';
      c.fillRect(Math.max(0,lw-notchL),Math.round(s.y+7),notchL,Math.max(12,hh-18));
      c.fillRect(w-rw,Math.round(s.y+15),notchR,Math.max(10,hh-24));
    }

    // BOTTOM FOREGROUND — world-anchored rock/root tips entering from below.
    // Drawing from each moving tip down to the screen edge makes the lower mass
    // feel like near terrain passing in front of the camera.
    for(let sy=sy0;sy<=sy1;sy++)for(let sx=sx0;sx<=sx1;sx++){
      if(hash2(sx,sy,this.seed+8663)<.62)continue;
      const wx=(sx+.10+hash2(sx,sy,this.seed+8671)*.80)*sector;
      const wy=(sy+.72+hash2(sx,sy,this.seed+8677)*.24)*sector;
      const s=this.forestForegroundToScreen(wx,wy,1.12);
      if(s.x<-40||s.x>w+40||s.y<h-120||s.y>h+55)continue;

      const bw=14+Math.floor(hash2(sx,sy,this.seed+8681)*28);
      const tipH=8+Math.floor(hash2(sx,sy,this.seed+8689)*22);
      const topY=Math.round(s.y-tipH);

      c.fillStyle='rgba(7,10,7,.17)';
      c.fillRect(Math.round(s.x-bw/2),topY,bw,Math.max(4,h-topY+8));
      c.fillStyle='rgba(30,38,23,.08)';
      c.fillRect(Math.round(s.x-bw*.18),topY+3,Math.max(2,Math.round(bw*.18)),Math.max(5,Math.min(18,h-topY)));
    }

    c.restore();
  }


  drawForestRockFrame(){
    const c=this.ctx,w=this.logicalViewW(),h=this.logicalViewH();
    c.save();
    c.imageSmoothingEnabled=false;

    // A viewport rock frame sells the idea that the player is looking through an
    // opening within a massive cavern. This is intentionally screen-space rather
    // than world-space: it behaves like a near camera-edge layer and keeps the UI
    // unobstructed because UI renders later.
    const segTop=Math.ceil(w/9),segSide=Math.ceil(h/7),segBottom=Math.ceil(w/8);

    const drawRockBlock=(x,y,bw,bh,seedA,seedB)=>{
      c.fillStyle='#231f18';c.fillRect(Math.round(x),Math.round(y),Math.round(bw),Math.round(bh));
      c.fillStyle='#40392c';
      c.fillRect(Math.round(x+2),Math.round(y+2),Math.max(2,Math.round(bw*.34)),Math.max(2,Math.round(bh*.18)));
      if(hash2(seedA,seedB,this.seed+8753)>.45)c.fillRect(Math.round(x+bw*.55),Math.round(y+bh*.18),Math.max(2,Math.round(bw*.18)),Math.max(2,Math.round(bh*.12)));
      c.fillStyle='#605842';
      c.fillRect(Math.round(x+1),Math.round(y+1),Math.max(1,Math.round(bw*.14)),Math.max(1,Math.round(bh*.10)));
      if(hash2(seedA,seedB,this.seed+8761)>.58){
        c.fillStyle='#2f4422';
        c.fillRect(Math.round(x+bw*.08),Math.round(y+bh*.72),Math.max(2,Math.round(bw*.22)),Math.max(2,Math.round(bh*.10)));
      }
    };

    // Top rocky lip.
    for(let i=-1;i<=9;i++){
      const bw=segTop+10+Math.floor(hash2(i,1,this.seed+8701)*18),bh=22+Math.floor(hash2(i,2,this.seed+8707)*22),x=i*segTop-6,y=-2;
      drawRockBlock(x,y,bw,bh,i,10);
      if(hash2(i,3,this.seed+8713)>.40){
        const len=10+Math.floor(hash2(i,4,this.seed+8719)*24),sx=x+6+Math.floor(hash2(i,5,this.seed+8723)*Math.max(6,bw-12)),sw=2+Math.floor(hash2(i,6,this.seed+8729)*3);
        c.fillStyle='#16130e';c.fillRect(Math.round(sx),Math.round(y+bh-1),sw,len);
      }
    }

    // Left and right rocky walls.
    for(let i=-1;i<=7;i++){
      const by=i*segSide+4;
      const lw=18+Math.floor(hash2(i,11,this.seed+8731)*26),lh=segSide+10+Math.floor(hash2(i,12,this.seed+8737)*14);
      const rw=18+Math.floor(hash2(i,13,this.seed+8741)*26),rh=segSide+10+Math.floor(hash2(i,14,this.seed+8749)*14);
      drawRockBlock(-2,by,lw,lh,i,20);
      drawRockBlock(w-rw+2,by+2,rw,rh,i,21);
    }

    // Bottom rocky lip, lighter than the top so it does not crush the player area.
    for(let i=-1;i<=8;i++){
      const bw=segBottom+10+Math.floor(hash2(i,31,this.seed+8771)*18),bh=14+Math.floor(hash2(i,32,this.seed+8777)*16),x=i*segBottom-5,y=h-bh+2;
      drawRockBlock(x,y,bw,bh,i,30);
    }

    // Inner shadow immediately under the rock edges. This is what makes the edge
    // frame feel like solid depth rather than decorative trim.
    let grad=c.createLinearGradient(0,0,0,66);
    grad.addColorStop(0,'rgba(0,0,0,.22)');
    grad.addColorStop(.28,'rgba(0,0,0,.10)');
    grad.addColorStop(1,'rgba(0,0,0,0)');
    c.fillStyle=grad;c.fillRect(0,0,w,66);

    grad=c.createLinearGradient(0,0,48,0);
    grad.addColorStop(0,'rgba(0,0,0,.17)');
    grad.addColorStop(.55,'rgba(0,0,0,.07)');
    grad.addColorStop(1,'rgba(0,0,0,0)');
    c.fillStyle=grad;c.fillRect(0,0,48,h);

    grad=c.createLinearGradient(w,0,w-48,0);
    grad.addColorStop(0,'rgba(0,0,0,.17)');
    grad.addColorStop(.55,'rgba(0,0,0,.07)');
    grad.addColorStop(1,'rgba(0,0,0,0)');
    c.fillStyle=grad;c.fillRect(w-48,0,48,h);

    grad=c.createLinearGradient(0,h,0,h-34);
    grad.addColorStop(0,'rgba(0,0,0,.11)');
    grad.addColorStop(1,'rgba(0,0,0,0)');
    c.fillStyle=grad;c.fillRect(0,h-34,w,34);

    c.restore();
  }


  drawTile(tx,ty){
    const c=this.ctx,s=this.worldToScreen(tx*TILE,ty*TILE),wall=this.isWall(tx,ty),depth=depthFromY(ty*TILE),stratum=stratumIndex(depth);
    const si=stratum===2?0:(stratum%4),n=hash2(tx,ty,this.seed+si*31);
    if(stratum===0){this.drawForestTile(tx,ty,s,wall,hash2(tx,ty,this.seed+8009));return;}
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
      if(n<.03){c.fillStyle='#24332f';c.fillRect(Math.floor(s.x+10),Math.floor(s.y+12),2,4);c.fillStyle='#466052';c.fillRect(Math.floor(s.x+8),Math.floor(s.y+10),6,2);if(hash2(tx,ty,this.seed+76)>.82)this.queueLightSource(Math.floor(s.x+11),Math.floor(s.y+13),{radius:10,cutout:5,color:'rgba(132,205,182,.07)',alpha:.04});}
      if(hash2(tx*23,ty*29,this.seed+9801)>.972)this.drawAmbientBoulder(Math.floor(s.x),Math.floor(s.y),tx,ty,stratum);
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
    this.queueLightSource(Math.round(s.x+8),Math.round(s.y-6),{radius:12,cutout:6,color:'rgba(241,187,95,.08)',alpha:.04});
  }

  drawTownOverlays(){
    for(const t of this.townPlans()){
      if(t.authored)continue;
      const s=this.worldToScreen(t.originX,t.originY),margin=Math.max(t.layoutW,t.layoutH);
      if(s.x<-margin||s.x>this.logicalViewW()+margin||s.y<-margin||s.y>this.logicalViewH()+margin)continue;
      this.drawTownPlan(t);
    }
  }

  drawTownPlan(t){
    const c=this.ctx,center=this.worldToScreen(t.originX,t.originY);
    c.save();
    c.globalAlpha=.18;c.fillStyle=t.kind==='village'?'#5e6b35':'#6d624e';c.beginPath();c.ellipse(center.x,center.y,t.layoutW*.58,t.layoutH*.56,0,0,Math.PI*2);c.fill();c.globalAlpha=1;
    // Main street, cross-lane and central square are drawn geometry beneath the
    // buildings. The settlement reference is used for layout language only; no
    // settlement image is composited into the world.
    const roadTop=this.worldToScreen(t.originX-TOWN_TILE*1.55,t.deepGateY),roadBottom=this.worldToScreen(t.originX+TOWN_TILE*1.55,t.shallowGateY);
    c.fillStyle=t.kind==='village'?'rgba(111,92,50,.42)':'rgba(85,72,52,.34)';c.fillRect(Math.round(roadTop.x),Math.round(roadTop.y),Math.round(roadBottom.x-roadTop.x),Math.round(roadBottom.y-roadTop.y));
    const laneL=this.worldToScreen(t.originX-t.layoutW*.34,t.originY-TOWN_TILE*.75),laneR=this.worldToScreen(t.originX+t.layoutW*.34,t.originY+TOWN_TILE*.75);
    c.fillRect(Math.round(laneL.x),Math.round(laneL.y),Math.round(laneR.x-laneL.x),Math.round(laneR.y-laneL.y));
    c.save();c.globalAlpha=.34;c.strokeStyle=t.kind==='village'?'#817447':'#6c604a';c.lineWidth=6;c.beginPath();c.arc(Math.round(center.x),Math.round(center.y+TOWN_TILE*.75),TOWN_TILE*2.15,0,Math.PI*2);c.stroke();c.restore();

    // Physical perimeter wall. The shallow and deep gate gaps are the only ways
    // through the settlement wall; collision uses the exact same rectangles.
    for(const wall of t.wallSegs){
      const p=this.worldToScreen(wall.x-wall.w/2,wall.y-wall.h/2);
      c.fillStyle='#20282c';c.fillRect(Math.round(p.x),Math.round(p.y),Math.round(wall.w),Math.round(wall.h));
      c.fillStyle='rgba(107,119,120,.34)';
      if(wall.w>wall.h)c.fillRect(Math.round(p.x),Math.round(p.y),Math.round(wall.w),3);
      else c.fillRect(Math.round(p.x),Math.round(p.y),3,Math.round(wall.h));
    }
    // The wall intentionally leaves open road mouths on both sides. No gate,
    // bars, posts or one-way lock are drawn here anymore.

    for(const building of t.buildings)this.drawTownBuilding(building,t);
    for(const stall of t.stalls){const p=this.worldToScreen(stall.x-stall.w/2,stall.y-stall.h/2);c.fillStyle='#4a3828';c.fillRect(Math.round(p.x),Math.round(p.y),stall.w,stall.h);c.fillStyle='#8b7047';c.fillRect(Math.round(p.x),Math.round(p.y),stall.w,4);}
    const lamps=[[t.originX-t.layoutW*.24,t.originY+t.layoutH*.20],[t.originX+t.layoutW*.25,t.originY+t.layoutH*.22],[t.originX-t.layoutW*.19,t.originY-t.layoutH*.27],[t.originX+t.layoutW*.20,t.originY-t.layoutH*.24]];
    for(const [x,y] of lamps){const p=this.worldToScreen(x,y);c.fillStyle='#6e5030';c.fillRect(Math.round(p.x-1),Math.round(p.y-3),3,10);c.fillStyle='#e1b65d';c.fillRect(Math.round(p.x-3),Math.round(p.y-7),7,6);c.globalAlpha=.09;c.fillRect(Math.round(p.x-11),Math.round(p.y-15),23,22);c.globalAlpha=1;this.queueLightSource(Math.round(p.x),Math.round(p.y-4),{radius:24,cutout:10,color:'rgba(247,194,106,.11)',alpha:.07});}
    const folk=t.kind==='city'?[[-92,76],[88,82],[-38,-72],[112,-44],[-118,12],[18,92],[70,-92],[-8,-8]]:t.kind==='village'?[[-72,58],[70,62],[-30,-62],[82,-34],[-85,-18],[15,76]]:[[-58,38],[62,55],[-18,-45],[74,-28]];
    for(const [ox,oy] of folk){const p=this.worldToScreen(t.originX+ox,t.originY+oy);c.fillStyle='#777060';c.fillRect(Math.round(p.x-3),Math.round(p.y-5),6,10);c.fillStyle='#a69472';c.fillRect(Math.round(p.x-2),Math.round(p.y-8),4,4);}

    // Settlement identity is presented as a screen-space arrival title by the
    // world bridge. Never paint the settlement name onto cavern terrain.
    c.restore();
  }

  drawTownBuilding(b,t){
    const c=this.ctx,p=this.worldToScreen(b.x-b.w/2,b.y-b.h/2),loc=t.locations.find(l=>l.id===b.id),v=Number(b.variant)||0;
    const village=t.kind==='village';
    c.fillStyle=b.id==='guild'?'#25272a':village?(v%2?'#302b20':'#342e21'):'#292821';c.fillRect(Math.round(p.x),Math.round(p.y),b.w,b.h);
    // Sloped roof impression built from stepped pixels; the rectangle beneath it
    // remains the exact collision body.
    c.fillStyle=village?(v%3===0?'#4e4329':'#453a29'):'#4c4a3d';c.fillRect(Math.round(p.x-3),Math.round(p.y),b.w+6,6);c.fillRect(Math.round(p.x+2),Math.round(p.y-4),b.w-4,4);
    c.fillStyle='#151a1b';c.fillRect(Math.round(p.x+b.w/2-7),Math.round(p.y+b.h-15),14,15);
    if(!b.decorative||v%2===0){c.fillStyle=village?'#c49b51':'#d1a354';c.fillRect(Math.round(p.x+8),Math.round(p.y+12),5,6);if(b.w>70)c.fillRect(Math.round(p.x+b.w-13),Math.round(p.y+12),5,6);}
    if(village&&b.decorative&&v%3===1){c.fillStyle='#26311e';c.fillRect(Math.round(p.x+3),Math.round(p.y+b.h-5),b.w-6,5);}
    // Only service buildings carry readable labels. Ordinary homes stay scenery.
    if(loc&&Math.hypot(this.player.x-b.x,this.player.y-b.y)<=TOWN_TILE*9){
      c.save();c.textAlign='center';c.font='8px monospace';c.fillStyle='#a9a292';c.fillText(loc.name.toUpperCase(),Math.round(p.x+b.w/2),Math.round(p.y-7));c.restore();
    }
  }

  drawFoeSprite(id,x,y,bob=0,visualScale=1,facing='right'){
    const c=this.ctx,sprite=this.getFoeSprite(id),size=FOE_SPRITE_SIZE*Math.max(.5,Number(visualScale)||1),illumination=this.hostileIlluminationAtScreen(x,y);
    c.save();c.translate(Math.round(x),Math.round(y+bob));
    if(illumination<.995){
      const brightness=.16+illumination*.84,saturation=.48+illumination*.52;
      c.filter=`brightness(${brightness}) saturate(${saturation})`;
    }
    c.fillStyle='rgba(0,0,0,.5)';c.fillRect(-10*visualScale,11,20*visualScale,3);
    if(sprite){
      const scale=Math.min(size/sprite.naturalWidth,size/sprite.naturalHeight),w=Math.max(1,Math.round(sprite.naturalWidth*scale)),h=Math.max(1,Math.round(sprite.naturalHeight*scale));
      c.imageSmoothingEnabled=false;
      // Creature art is authored in its default right-facing orientation. Mirror
      // the render for left-facing movement/combat so hostiles visually track the
      // delver without requiring duplicate directional assets per creature.
      if(facing==='left'){c.save();c.scale(-1,1);c.drawImage(sprite,Math.round(-w/2),Math.round(11-h),w,h);c.restore();}
      else c.drawImage(sprite,Math.round(-w/2),Math.round(11-h),w,h);
    }else{
      if(String(id||'').startsWith('slime')){c.fillStyle='#5b7c58';c.fillRect(-9,1,18,10);c.fillRect(-6,-3,12,6);c.fillStyle='#9fcf91';c.fillRect(-4,-1,3,2);c.fillStyle='#1b2420';c.fillRect(2,0,2,2);}
      else{c.fillStyle='#6c7e55';c.fillRect(-7,-6,14,13);c.fillStyle='#879565';c.fillRect(-5,-9,10,5);c.fillStyle='#111';c.fillRect(-3,-6,2,2);c.fillRect(2,-6,2,2);c.fillStyle='#8e5b39';c.fillRect(-8,6,5,4);c.fillRect(3,6,5,4);}
    }
    c.restore();
  }

  drawBossSprite(x,y,aggro=false,bob=0){
    const c=this.ctx,scale=1.55,illumination=this.hostileIlluminationAtScreen(x,y);c.save();c.translate(Math.round(x),Math.round(y+bob));c.scale(scale,scale);
    if(illumination<.995){const brightness=.16+illumination*.84,saturation=.48+illumination*.52;c.filter=`brightness(${brightness}) saturate(${saturation})`;}
    c.fillStyle='rgba(0,0,0,.55)';c.fillRect(-12,12,24,4);c.fillStyle='#85684b';c.fillRect(-9,-8,18,20);c.fillStyle='#a5835a';c.fillRect(-7,-13,14,7);
    c.fillStyle=aggro?'#e24e39':'#b64635';c.fillRect(-4,-9,2,2);c.fillRect(3,-9,2,2);c.fillStyle='#5a493a';c.fillRect(-13,3,7,5);c.fillRect(6,3,7,5);c.restore();
  }

  getCampfireSprite(){
    const rec=this.campfireSprite||(this.campfireSprite={img:null,ready:false,failed:false});
    if(rec.img||rec.failed)return rec;
    const img=new Image();rec.img=img;
    img.onload=()=>{rec.ready=true;rec.failed=false;};
    img.onerror=()=>{rec.ready=false;rec.failed=true;};
    img.src=CAMPFIRE_SHEET_FILE;
    return rec;
  }

  drawCampfireSprite(x,y){
    const rec=this.getCampfireSprite();
    if(!rec?.ready||!rec.img?.naturalWidth)return false;
    const frame=Math.floor(this.time*CAMPFIRE_FPS)%CAMPFIRE_FRAME_COUNT;
    // Frames are 32×64. The visible art ends around source y=57, so anchoring
    // the frame at y-49 places the ember/log base on the old Hollow fire ground.
    const dx=Math.round(x-CAMPFIRE_FRAME_W/2),dy=Math.round(y-49);
    this.ctx.imageSmoothingEnabled=false;
    this.ctx.drawImage(rec.img,frame*CAMPFIRE_FRAME_W,0,CAMPFIRE_FRAME_W,CAMPFIRE_FRAME_H,dx,dy,CAMPFIRE_FRAME_W,CAMPFIRE_FRAME_H);
    return true;
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
    // Fire ring + authored 8-frame looping campfire. The sprite is visual
    // only: Safe Hollows keep their existing interaction/safe-zone behavior and
    // the campfire itself adds no collision.
    c.fillStyle='#62605a';c.fillRect(x-7,y+4,4,3);c.fillRect(x+3,y+4,4,3);c.fillRect(x-2,y+6,4,2);
    if(!this.drawCampfireSprite(x,y)){
      // Loading/error fallback preserves a readable fire until the PNG arrives.
      c.fillStyle='#8a4b2d';c.fillRect(x-4,y-1,8,7);
      c.fillStyle='#d6763a';c.fillRect(x-3,y-5,6,8);
      c.fillStyle='#e8b65e';c.fillRect(x-1,y-8,3,7);
    }
    const flamePulse=.82+.18*(.5+.5*Math.sin(this.time*5.2));
    // Stronger local fire glow: this should read as a real light source in the
    // darkness rather than only a decorative aura around the sprite.
    this.drawLightGlow(c,x,y-8,40+flamePulse*10,'rgba(244,178,92,.22)',.22+.07*flamePulse);
    this.drawLightGlow(c,x,y-8,20+flamePulse*5,'rgba(255,212,132,.30)',.24+.08*flamePulse);
    c.globalAlpha=.15+.06*Math.sin(this.time*5);c.fillStyle='#e6a64e';c.fillRect(x-15,y-15,30,28);
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

  drawOreVein(s,e){
    const c=this.ctx,max=Math.max(1,Number(e.maxUnits)||1),remaining=clamp(Number(e.remaining)||0,0,max),ratio=remaining/max,depleted=remaining<=0,mining=this.activeMining?.id===e.id,cls=String(e.veinClass||'standard');
    const sizes=this.devPlacementConfig?.oreVeins||this.defaultDevPlacementConfig().oreVeins,scale=Math.max(.6,Number(sizes?.[`${cls}Scale`])||1);
    let x=Math.round(s.x),y=Math.round(s.y);
    if(mining){const impact=clamp((Number(this.activeMining.impactFlash)||0)/.18,0,1);x+=Math.round(Math.sin(this.time*92)*impact*1.6);y-=Math.round(impact*1.2);}
    c.save();c.translate(x,y);c.scale(scale,scale);
    const wide=cls==='rich'?20:cls==='remote'?17:15;
    c.fillStyle='rgba(0,0,0,.40)';c.fillRect(-wide,depleted?7:8,wide*2,4);
    if(depleted){
      // Each class collapses into its own rubble silhouette instead of a scaled
      // copy of the standard pile. Larger finds leave broader broken stone.
      if(cls==='rich'){
        c.fillStyle='#2d3335';c.fillRect(-16,1,8,5);c.fillRect(-7,-2,10,6);c.fillRect(4,0,9,5);c.fillRect(12,3,6,4);c.fillRect(-12,6,7,3);c.fillRect(-2,5,8,4);
        c.fillStyle='#4a5355';c.fillRect(-13,0,4,2);c.fillRect(-4,-3,5,2);c.fillRect(6,-1,4,2);c.fillRect(13,2,3,2);
        c.fillStyle='#5b4639';c.fillRect(-19,6,4,2);c.fillRect(-4,8,4,2);c.fillRect(9,7,5,2);c.fillRect(17,6,2,2);
      }else if(cls==='remote'){
        c.fillStyle='#2d3335';c.fillRect(-13,1,8,5);c.fillRect(-4,-2,9,6);c.fillRect(6,1,8,5);c.fillRect(-8,6,6,3);c.fillRect(2,5,7,3);
        c.fillStyle='#4a5355';c.fillRect(-10,0,4,2);c.fillRect(-2,-3,4,2);c.fillRect(8,0,3,2);c.fillStyle='#5b4639';c.fillRect(-15,6,3,2);c.fillRect(11,6,4,2);
      }else{
        c.fillStyle='#2d3335';c.fillRect(-10,1,7,4);c.fillRect(-2,-1,8,5);c.fillRect(5,2,6,4);c.fillRect(-6,4,5,3);
        c.fillStyle='#475053';c.fillRect(-8,0,4,2);c.fillRect(1,-2,4,2);c.fillRect(6,1,3,2);c.fillStyle='#5b4639';c.fillRect(-12,5,3,2);c.fillRect(-1,5,4,2);c.fillRect(10,5,2,2);
      }
    }else{
      // Standard is the compact teaching/resource shape. Remote and Rich use
      // additional lobes/chunks, so their silhouettes remain distinct even when
      // the user later tunes visual scale in Dev Tools.
      c.fillStyle='#303738';c.fillRect(-13,-6,26,14);
      c.fillStyle='#444b4a';c.fillRect(-9,-11,12,7);c.fillRect(4,-8,10,10);c.fillRect(-15,-2,7,8);
      if(cls==='remote'){c.fillRect(11,-3,8,9);c.fillRect(-13,-10,7,6);}
      if(cls==='rich'){c.fillRect(10,-8,11,14);c.fillRect(-19,-4,9,11);c.fillRect(-5,-16,11,8);c.fillRect(3,-13,9,7);}
      c.fillStyle='#69706a';c.fillRect(-7,-9,6,3);c.fillRect(6,-6,5,3);c.fillRect(-12,0,4,3);
      if(cls!=='standard'){c.fillRect(13,-1,4,3);c.fillRect(-14,-7,3,2);}
      if(cls==='rich'){c.fillRect(-3,-14,5,3);c.fillRect(6,-11,4,2);}
      c.fillStyle='#1c2224';c.fillRect(-4,1,8,6);
      const tin=e.oreId==='tin',oreDark=tin?'#6f7d80':'#8f5734',oreMid=tin?'#899699':'#a86435',oreLight=tin?'#c6ceca':'#d08a4d';
      const patches=cls==='rich'?[[-14,-2,6,4],[-8,-10,5,5],[-1,-14,5,4],[5,-9,6,5],[12,-4,6,4],[-5,2,6,3],[5,2,5,3],[14,1,4,3]]:cls==='remote'?[[-11,-4,5,4],[-4,-10,5,5],[4,-5,6,4],[11,-1,5,4],[-5,3,5,3],[7,3,4,3]]:[[-9,-4,5,4],[-2,-8,4,5],[5,-3,6,4],[-5,3,5,3],[8,3,4,3]];
      const visiblePatches=Math.max(1,Math.ceil(patches.length*ratio));
      for(let i=0;i<visiblePatches;i++){const [ox,oy,w,h]=patches[i];c.fillStyle=i%2?oreDark:oreMid;c.fillRect(ox,oy,w,h);c.fillStyle=oreLight;c.fillRect(ox+1,oy,Math.max(1,w-2),1);}
      if(mining){const bw=cls==='rich'?26:cls==='remote'?23:20,bh=2,bx=-Math.floor(bw/2),by=cls==='rich'?-23:-18;c.fillStyle='rgba(4,7,9,.84)';c.fillRect(bx-1,by-1,bw+2,bh+2);c.fillStyle='#c9cfcc';c.fillRect(bx,by,Math.round(bw*ratio),bh);}
      if(mining&&this.activeMining.swingFlash>0){c.globalAlpha=clamp(this.activeMining.swingFlash/.22,0,1);c.fillStyle='#d0b18b';const sx=cls==='rich'?18:12;c.fillRect(sx,-8,2,2);c.fillRect(sx+3,-3,1,1);c.fillRect(sx-3,-12,1,1);}
    }
    c.restore();
  }

  drawEntity(e){
    const c=this.ctx,s=this.worldToScreen(e.x,e.y);
    if(['foe','midboss','boss'].includes(e.type)&&e.combatTelegraph==='HEAVY'){const r=this.combatCenterRadiusForReach(Number(e.combatThreatRange)||14,e),pulse=.48+.15*Math.sin(this.time*10);c.save();c.globalAlpha=.08;c.fillStyle='#b64b43';c.beginPath();c.arc(Math.round(s.x),Math.round(s.y),r,0,Math.PI*2);c.fill();c.globalAlpha=pulse;c.strokeStyle='#d45a50';c.lineWidth=2;c.beginPath();c.arc(Math.round(s.x),Math.round(s.y),r,0,Math.PI*2);c.stroke();c.restore();}
    if(e.type==='foe')this.drawFoeSprite(e.foe?.id,s.x,s.y,Math.sin(this.time*5+e.tx)*1.1,1,e.facing||'right');
    else if(e.type==='ore')this.drawOreVein(s,e);
    else if(e.type==='smithingstation'){
      if(e.station==='anvil'&&e.drawAsset){
        const forging=this.activeSmithingForge,impact=forging?clamp((Number(forging.impactFlash)||0)/.16,0,1):0,shakeX=impact?Math.round(Math.sin(this.time*110)*impact*1.5):0,shakeY=impact?-Math.round(impact):0;
        const rec=this.authoredAssetRecord(SMITHING_ANVIL_ASSET),img=rec?.ready?rec.img:null,scale=Math.max(.4,Number(e.scale)||1),sx=s.x+shakeX,sy=s.y+shakeY;
        if(img?.naturalWidth){const max=34*scale,k=Math.min(max/img.naturalWidth,max/img.naturalHeight),w=Math.max(1,Math.round(img.naturalWidth*k)),h=Math.max(1,Math.round(img.naturalHeight*k));c.save();c.imageSmoothingEnabled=false;c.fillStyle='rgba(0,0,0,.40)';c.fillRect(Math.round(sx-w*.42),Math.round(sy+5),Math.max(4,Math.round(w*.84)),3);c.drawImage(img,Math.round(sx-w/2),Math.round(sy+8-h),w,h);c.restore();}
        else{c.fillStyle='#555b5d';c.fillRect(Math.round(sx-8),Math.round(sy-2),16,6);c.fillRect(Math.round(sx-5),Math.round(sy+4),10,4);}
        if(forging){const progress=clamp(forging.elapsedMs/Math.max(1,forging.durationMs),0,1),bw=46,bh=3,bx=Math.round(s.x-bw/2),by=Math.round(s.y-28);c.save();c.fillStyle='rgba(3,7,9,.90)';c.fillRect(bx-1,by-1,bw+2,bh+2);c.fillStyle='#626b70';c.fillRect(bx,by,bw,bh);c.fillStyle='#d2a85c';c.fillRect(bx,by,Math.round(bw*progress),bh);c.font='bold 7px monospace';c.textAlign='center';c.fillStyle='#d6d8d3';c.fillText(`FORGING ${String(forging.name||'ITEM').toUpperCase()}`,Math.round(s.x),by-5);c.restore();}
      }
    }
    else if(e.type==='chest'){
      c.fillStyle='#5f3f24';c.fillRect(Math.round(s.x-8),Math.round(s.y-5),16,11);c.fillStyle='#b17d3e';c.fillRect(Math.round(s.x-8),Math.round(s.y-5),16,3);c.fillStyle='#c8a15a';c.fillRect(Math.round(s.x-1),Math.round(s.y-2),3,4);
    }else if(e.type==='glint'){
      const a=.45+.45*Math.sin(this.time*5);c.fillStyle=`rgba(225,193,123,${a})`;c.fillRect(Math.round(s.x),Math.round(s.y-4),1,9);c.fillRect(Math.round(s.x-4),Math.round(s.y),9,1);this.queueLightSource(Math.round(s.x),Math.round(s.y-1),{radius:14,cutout:7,color:'rgba(240,201,123,.10)',alpha:.05});
    }else if(e.type==='hollow'){
      this.drawHollow(s,e.kind==='stage');
      const firePulse=.86+.14*(.5+.5*Math.sin(this.time*4.6+((e.depth||0)%7))),fireVis=this.devPlacementConfig?.campfireVisibility||this.defaultDevPlacementConfig().campfireVisibility;
      // Every Safe Hollow campfire shares this developer-tunable visibility
      // preset. Dev Tools can edit the clear/feather/falloff radii live without
      // changing the campfire entity, collision, Safe Hollow data or sprite.
      this.queueLightSource(Math.round(s.x),Math.round(s.y-8),{radius:Math.max(fireVis.clearRadius,fireVis.featherRadius,fireVis.falloffOuter)+8,cutout:fireVis.clearRadius,feather:fireVis.featherRadius,strength:fireVis.revealStrength,falloffOuter:fireVis.falloffOuter,falloffStrength:fireVis.falloffStrength,color:'rgba(240,175,88,.20)',alpha:.18+.03*firePulse});
    }
    else if(e.type==='loot'){
      const remaining=Number(e.expiresAt)-Date.now(),blink=Number.isFinite(remaining)&&remaining<=LOOT_BAG_BLINK_MS;
      c.save();
      if(blink)c.globalAlpha=.18+.82*(.5+.5*Math.sin(this.time*14));
      const img=this.lootBagSprite.ready?this.lootBagSprite.img:null;c.fillStyle='rgba(0,0,0,.48)';c.fillRect(Math.round(s.x-8),Math.round(s.y+6),16,3);
      if(img){const max=24,scale=Math.min(max/img.naturalWidth,max/img.naturalHeight),w=Math.max(1,Math.round(img.naturalWidth*scale)),h=Math.max(1,Math.round(img.naturalHeight*scale));c.imageSmoothingEnabled=false;c.drawImage(img,Math.round(s.x-w/2),Math.round(s.y+8-h),w,h);}
      else{c.fillStyle='#8f6a3b';c.fillRect(Math.round(s.x-7),Math.round(s.y-4),14,12);c.fillStyle='#caa35c';c.fillRect(Math.round(s.x-5),Math.round(s.y-7),10,4);c.fillStyle='#e1bd67';c.fillRect(Math.round(s.x-2),Math.round(s.y),4,4);}
      c.restore();
    }else if(e.type==='settlement'){
      c.fillStyle='#453b2b';c.fillRect(Math.round(s.x-14),Math.round(s.y-9),28,18);c.fillStyle='#8f7950';c.fillRect(Math.round(s.x-16),Math.round(s.y-11),32,4);c.fillStyle='#e2b765';c.fillRect(Math.round(s.x-8),Math.round(s.y-2),4,5);c.fillRect(Math.round(s.x+5),Math.round(s.y-2),4,5);
    }else if(e.type==='signpost'){
      const x=Math.round(s.x),y=Math.round(s.y);c.fillStyle='rgba(0,0,0,.45)';c.fillRect(x-9,y+8,18,3);c.fillStyle='#5d4329';c.fillRect(x-2,y-5,4,16);c.fillStyle='#795a35';c.fillRect(x-13,y-9,26,9);c.fillStyle='#b58b50';c.fillRect(x-10,y-7,20,2);c.fillStyle='#d0b078';c.fillRect(x+8,y-6,3,3);
    }else if(e.type==='townlocation'){
      // Authored NPC artwork is already part of the settlement layer; its entity
      // exists only for proximity/service interaction and must not add a marker.
      if(!e.authoredNpc){const dep=!!e.location?.departure,pulse=.65+.25*Math.sin(this.time*4);c.fillStyle=dep?'#c29a5a':'#8b8067';c.fillRect(Math.round(s.x-3),Math.round(s.y-3),6,6);c.globalAlpha=.16*pulse;c.fillStyle=dep?'#e4b865':'#c4b38a';c.fillRect(Math.round(s.x-10),Math.round(s.y-10),20,20);c.globalAlpha=1;}
    }else if(e.type==='townnpc'){
      // Static authored sprite; interaction-only runtime entity.
    }else if(e.type==='sidepassage')this.drawSidePassage(s,e.event);
    else if(e.type==='caravan'||e.type==='merchant')this.drawCaravan(s,e.event);
    else if(e.type==='rescue-tracks'){
      c.fillStyle='#75634a';for(const [ox,oy] of [[-6,-3],[-1,3],[5,-2],[10,4]]){c.fillRect(Math.round(s.x+ox),Math.round(s.y+oy),4,2);c.fillRect(Math.round(s.x+ox+1),Math.round(s.y+oy-2),2,2);}
    }else if(e.type==='rescue-satchel'){
      c.fillStyle='rgba(0,0,0,.45)';c.fillRect(Math.round(s.x-9),Math.round(s.y+6),18,3);c.fillStyle='#5e4430';c.fillRect(Math.round(s.x-7),Math.round(s.y-5),14,12);c.fillStyle='#8a6c4a';c.fillRect(Math.round(s.x-5),Math.round(s.y-8),10,4);c.fillStyle='#b7aa8a';c.fillRect(Math.round(s.x-1),Math.round(s.y-1),3,4);
    }else if(e.type==='rescue-hideout'){
      c.fillStyle='#020405';c.fillRect(Math.round(s.x-13),Math.round(s.y-12),26,25);c.fillStyle='#263137';c.fillRect(Math.round(s.x-16),Math.round(s.y-14),5,28);c.fillRect(Math.round(s.x+11),Math.round(s.y-14),5,28);c.fillRect(Math.round(s.x-12),Math.round(s.y-16),24,5);c.fillStyle='rgba(214,166,83,.22)';c.fillRect(Math.round(s.x-7),Math.round(s.y-7),14,14);this.queueLightSource(Math.round(s.x),Math.round(s.y-2),{radius:18,cutout:8,color:'rgba(235,177,93,.10)',alpha:.05});
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
    const facing=f.x>this.player.x?'left':'right';
    if(f.type==='midboss')this.drawFoeSprite(f.foe?.id||f.foeId||f.event?.profileId||'cutter',s.x,s.y,bob,MID_BOSS_VISUAL_SCALE,facing);
    else if(f.type==='boss')this.drawBossSprite(s.x,s.y,true,bob);
    else this.drawFoeSprite(f.foe?.id||f.id,s.x,s.y,bob,1,facing);
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
    const className=String(this.getPlayerClass?.()||'Votary'),sprite=this.getCleanedPlayerSprite(this.getPlayerSprite(className)),visualScale=this.playerVisualScale(),renderSize=this.playerSpriteRenderSize();
    const facing=this.playerVisualFacing();
    const miningPreview=!this.activeMining&&!this.activeSmithingForge&&this.devPlacementEnabled&&this.devPlacementSelection==='miningSwing';
    const hammerPreview=!this.activeSmithingForge&&!this.activeMining&&this.devPlacementEnabled&&this.devPlacementSelection==='smithingHammer';
    let mineBumpX=0,mineBumpY=0,mineProgress=miningPreview?((this.time%1.6)/1.6):0,mineImpact=0;
    let hammerProgress=hammerPreview?((this.time%.82)/.82):0,hammerImpact=0;
    if(this.activeMining){
      const target=(this.activeEntities||[]).find(e=>e?.id===this.activeMining.id)||this.activeMining.entity;
      mineProgress=clamp((Number(this.activeMining.elapsedMs)||0)/Math.max(1,Number(this.activeMining.swingMs)||1),0,1);
      mineImpact=clamp((Number(this.activeMining.impactFlash)||0)/.18,0,1);
      const dx=(Number(target?.x)||p.x)-p.x,dy=(Number(target?.y)||p.y)-p.y,len=Math.hypot(dx,dy)||1;
      const drive=Math.sin(mineProgress*Math.PI)*1.4+mineImpact*.8;
      mineBumpX=dx/len*drive;
      mineBumpY=dy/len*drive*.7-mineImpact*.6;
    }
    if(this.activeSmithingForge){const f=this.activeSmithingForge,cfg=this.devPlacementConfig?.smithingHammer||this.defaultDevPlacementConfig().smithingHammer;hammerProgress=(f.elapsedMs%Math.max(1,cfg.cycleMs||f.cycleMs||820))/Math.max(1,cfg.cycleMs||f.cycleMs||820);hammerImpact=clamp((Number(f.impactFlash)||0)/.16,0,1);const dx=(Number(f.anvilX)||p.x)-p.x,dy=(Number(f.anvilY)||p.y)-p.y,len=Math.hypot(dx,dy)||1,drive=Math.sin(hammerProgress*Math.PI)*.65+hammerImpact*.45;mineBumpX=dx/len*drive;mineBumpY=dy/len*drive*.55-hammerImpact*.35;}
    c.save();c.translate(Math.round(s.x+mineBumpX),Math.round(s.y+walk+mineBumpY));
    c.fillStyle='rgba(0,0,0,.55)';c.fillRect(Math.round(-7*visualScale),8,Math.round(14*visualScale),Math.max(3,Math.round(3*visualScale)));

    // Lantern light belongs to the delver, not the whole screen. Keep it slightly
    // off-center toward the held lantern so the glow feels attached to the sprite.
    // The sprite's lantern sits on the opposite side from the previous pass, so
    // the glow anchor is intentionally mirrored here.
    const glow=this.devPlacementConfig?.playerLanternGlow||this.defaultDevPlacementConfig().playerLanternGlow;
    const lanternX=(facing==='left'?glow.sideOffset:-glow.sideOffset)*visualScale,lanternY=glow.y*visualScale;
    const flicker=.95+.035*Math.sin(this.time*13)+.025*Math.sin(this.time*19+1.7),bright=glow.brightness;
    if(this.atmosphereEffectsEnabled){
      c.save();
      c.globalCompositeOperation='screen';
      const inner=Math.max(2,glow.innerRadius*flicker),outer=Math.max(inner+1,glow.outerRadius*flicker);
      let grad=c.createRadialGradient(lanternX,lanternY,0,lanternX,lanternY,inner);
      grad.addColorStop(0,`rgba(255,226,166,${clamp(.38*bright,0,1)})`);
      grad.addColorStop(.24,`rgba(247,197,108,${clamp(.22*bright,0,1)})`);
      grad.addColorStop(.62,`rgba(233,176,82,${clamp(.09*bright,0,1)})`);
      grad.addColorStop(1,'rgba(244,189,101,0)');
      c.fillStyle=grad;c.beginPath();c.arc(lanternX,lanternY,inner,0,Math.PI*2);c.fill();
      grad=c.createRadialGradient(lanternX,lanternY,0,lanternX,lanternY,outer);
      grad.addColorStop(0,`rgba(233,176,82,${clamp(.10*bright,0,1)})`);
      grad.addColorStop(.58,`rgba(214,150,68,${clamp(.05*bright,0,1)})`);
      grad.addColorStop(1,'rgba(214,150,68,0)');
      c.fillStyle=grad;c.beginPath();c.arc(lanternX,lanternY,outer,0,Math.PI*2);c.fill();
      c.restore();
    }
    if(sprite){
      const scale=Math.min(renderSize/sprite.naturalWidth,renderSize/sprite.naturalHeight),w=Math.max(1,Math.round(sprite.naturalWidth*scale)),h=Math.max(1,Math.round(sprite.naturalHeight*scale));
      c.imageSmoothingEnabled=false;
      // Player art is authored facing right. Keep the last horizontal facing while
      // moving vertically and mirror only for leftward travel.
      if(facing==='left'){c.save();c.scale(-1,1);c.drawImage(sprite,Math.round(-w/2),Math.round(11-h),w,h);c.restore();}
      else c.drawImage(sprite,Math.round(-w/2),Math.round(11-h),w,h);
      const lampMark=Math.max(3,Math.round(3*visualScale));
      c.fillStyle='rgba(255,224,163,.88)';c.fillRect(Math.round(lanternX-lampMark/2),Math.round(lanternY-lampMark*.65),lampMark,lampMark);
      c.fillStyle='rgba(208,131,59,.92)';c.fillRect(Math.round(lanternX),Math.round(lanternY+visualScale),Math.max(1,Math.round(visualScale)),Math.max(2,Math.round(2*visualScale)));
    }else{
      // Preserve the old delver marker as a resilient fallback if an asset is
      // missing or still loading.
      c.save();c.scale(visualScale,visualScale);c.fillStyle='#2f444f';c.fillRect(-6,-6,12,13);c.fillStyle='#b49f7d';c.fillRect(-4,-10,8,5);c.fillStyle='#171c20';c.fillRect(-5,-11,10,3);c.fillStyle='#d8b661';const lx=facing==='left'?-8:6;c.fillRect(lx,-1,3,5);c.fillStyle='#825c33';c.fillRect(lx+1,4,1,4);c.restore();
    }
    if(this.activeMining||miningPreview){
      const cfg=this.devPlacementConfig?.miningSwing||this.defaultDevPlacementConfig().miningSwing,side=facing==='left'?-1:1;
      const recoverEnd=.62;
      let angleDeg;
      if(mineProgress<recoverEnd){
        const q=mineProgress/recoverEnd,ease=1-Math.pow(1-q,2);
        angleDeg=cfg.impactDeg+(cfg.startDeg-cfg.impactDeg)*ease;
      }else{
        const q=(mineProgress-recoverEnd)/(1-recoverEnd),ease=q*q;
        angleDeg=cfg.startDeg+(cfg.impactDeg-cfg.startDeg)*ease;
      }
      angleDeg+=mineImpact*4;
      const handleLength=Math.max(2,cfg.handleLength*visualScale),headWidth=Math.max(3,cfg.headWidth*visualScale),handleThickness=Math.max(1,cfg.handleThickness*visualScale),headThickness=Math.max(1,cfg.headThickness*visualScale);
      c.save();
      c.translate(side*cfg.pivotX*visualScale,cfg.pivotY*visualScale-mineImpact*.6);
      c.scale(side,1);
      c.rotate(angleDeg*Math.PI/180);
      // The pivot is the hand at the BOTTOM of the handle. The head is at the
      // opposite end, so the tool now swings around the grip rather than around
      // the pick head.
      c.fillStyle='#7e5832';c.fillRect(-handleThickness/2,-handleLength,handleThickness,handleLength);
      c.fillStyle='#9da5a8';c.fillRect(-headWidth/2,-handleLength-headThickness/2,headWidth,headThickness);
      c.fillStyle='#5b6266';c.fillRect(headWidth/2-headThickness,-handleLength-headThickness/2,headThickness,headThickness);
      c.restore();
    }
    if(this.activeSmithingForge||hammerPreview){const cfg=this.devPlacementConfig?.smithingHammer||this.defaultDevPlacementConfig().smithingHammer,side=facing==='left'?-1:1;let angleDeg;if(hammerProgress<.58){const q=hammerProgress/.58,ease=q*q;angleDeg=cfg.startDeg+(cfg.impactDeg-cfg.startDeg)*ease;}else{const q=(hammerProgress-.58)/.42,ease=1-Math.pow(1-q,2);angleDeg=cfg.impactDeg+(cfg.startDeg-cfg.impactDeg)*ease;}angleDeg+=hammerImpact*3;const handleLength=Math.max(2,cfg.handleLength*visualScale),headWidth=Math.max(3,cfg.headWidth*visualScale),handleThickness=Math.max(1,cfg.handleThickness*visualScale),headHeight=Math.max(2,cfg.headHeight*visualScale);c.save();c.translate(side*cfg.pivotX*visualScale,cfg.pivotY*visualScale-hammerImpact*.4);c.scale(side,1);c.rotate(angleDeg*Math.PI/180);c.fillStyle='#7a5430';c.fillRect(-handleThickness/2,-handleLength,handleThickness,handleLength);c.fillStyle='#8c9599';c.fillRect(-headWidth/2,-handleLength-headHeight/2,headWidth,headHeight);c.fillStyle='#b3b9b9';c.fillRect(-headWidth/2,-handleLength-headHeight/2,Math.max(1,headWidth*.18),Math.max(1,headHeight*.35));c.fillStyle='#4b5256';c.fillRect(headWidth/2-Math.max(1,headWidth*.28),-handleLength-headHeight/2,Math.max(1,headWidth*.28),headHeight);c.restore();}
    c.restore();
  }

  drawParticle(p){
    const c=this.ctx;
    if(p.kind==='spark'){const s=this.worldToScreen(p.x,p.y),alpha=clamp(p.life/p.max,0,1),size=Math.max(1,Number(p.size)||1);c.save();c.globalAlpha=alpha;c.globalCompositeOperation='screen';c.fillStyle=p.tone||'#f2b65d';c.fillRect(Math.round(s.x),Math.round(s.y),size,size);if(size===1&&alpha>.45)c.fillRect(Math.round(s.x-1),Math.round(s.y),3,1);c.restore();return;}
    if(p.kind==='chip'){
      const s=this.worldToScreen(p.x,p.y),alpha=clamp(p.life/p.max,0,1),size=Math.max(1,Number(p.size)||1);
      c.save();c.globalAlpha=alpha;c.fillStyle=p.shadow||'#3d4341';c.fillRect(Math.round(s.x),Math.round(s.y)+1,size,size);c.fillStyle=p.tone||'#8b908d';c.fillRect(Math.round(s.x),Math.round(s.y),size,size);c.restore();
      return;
    }
    const s=this.worldToScreen(p.x,p.y-(1-p.life/p.max)*18),tone=String(p.tone||'player');
    c.save();c.globalAlpha=clamp(p.life/p.max,0,1);c.textAlign='center';
    c.font=(tone==='playerMiss'||tone==='enemyMiss')?'bold 12px monospace':'bold 10px monospace';
    c.fillStyle=tone==='playerHit'?'#f2f0e9':tone==='playerCrit'?'#e0bd78':tone==='playerMiss'?'#6fa7d8':tone==='enemyMiss'?'#355f8c':tone==='enemyCrit'?'#862d2a':tone==='poison'?'#69aa62':tone==='heal'?'#7fc77a':tone==='enemy'?'#d46b5f':tone==='status'?'#a7aa9a':'#e0bd78';
    c.fillText(p.text,s.x,s.y-14);c.restore();
  }
  drawDepthDirection(){const c=this.ctx;c.save();c.globalAlpha=.42;c.textAlign='center';c.font='9px monospace';c.fillStyle='#8b7650';c.fillText('↑ DEEPER',this.logicalViewW()/2,Math.max(116,this.logicalViewH()*.18));c.restore();}
}
