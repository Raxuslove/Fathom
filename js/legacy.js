
"use strict";

/* ============================================================
   A note, since this is your first real JavaScript file.

   Everything below follows one pattern. The game's numbers live
   in an object called S. Nothing on screen updates itself. You
   change a number inside S, then call render(), and render()
   repaints every bar and label from scratch. That is why you'll
   see render() at the end of nearly every function.

   In GDScript terms: S is your member variables, and render() is
   an update_ui() that you call by hand instead of a _process()
   loop that runs every frame.
   ============================================================ */

const $ = id => document.getElementById(id);
const rnd = () => Math.random();
const ri = (a,b) => a + Math.floor(rnd()*(b-a+1));
const pick = a => a[Math.floor(rnd()*a.length)];
const clamp = (v,a,b) => Math.max(a, Math.min(b,v));
const esc = s => String(s).replace(/[&<>]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
const article = n => /^[aeiou]/i.test(n) ? `an ${n}` : `a ${n}`;

function weightedPick(items, weightOf){
  const total = items.reduce((sum,item) => sum + Math.max(0,weightOf(item)), 0);
  if(total <= 0) return items[0];
  let roll = rnd() * total;
  for(const item of items){
    roll -= Math.max(0,weightOf(item));
    if(roll <= 0) return item;
  }
  return items[items.length-1];
}


/* ============================================================
   INTENTS — enemy action profiles.

   The Enemy Turn panel shows the action happening now. On the Player Turn,
   the same profile is shown separately as NEXT ENEMY so it is explicitly a
   forecast. mult is the damage multiplier; armour is enemy Guard reduction.
   ============================================================ */
const INTENTS = {
  heavy: {
    label:"Heavy attack",
    tell:"drawing back for a committed blow",
    kind:"attack", mult:2.0, armour:0
  },
  quick: {
    label:"Quick attack",
    tell:"darting in to strike",
    kind:"attack", mult:0.6, armour:0
  },
  offquick: {
    label:"Glancing attack",
    tell:"lashing out without its footing",
    kind:"attack", mult:0.3, armour:0
  },
  dodge: {
    label:"Dodge",
    tell:"circling, light on its feet",
    kind:"stance", mult:0, armour:0
  },
  guard: {
    label:"Guard",
    tell:"set behind its guard",
    kind:"stance", mult:0, armour:0.50
  },
  recover: {
    label:"Recover",
    tell:"sucking air, giving ground",
    kind:"stance", mult:0, armour:0, heal:0.14
  },
  unaware: {
    label:"Unaware",
    tell:"has not noticed you yet",
    kind:"stance", mult:0, armour:0
  },
  steady: {
    label:"Steady",
    tell:"planting its feet and recovering its balance",
    kind:"stance", mult:0, armour:0
  }
};

/* Session 3: the intent profile is the actual enemy content.
   Each goblin has a fixed weakness and a weighted set of intents. Read does not
   randomise a weakness anymore: it learns that species and remembers it for the run.

   For this prototype, the bonus turns on once the weakness is known. That keeps the
   exact preview truthful and gives Read a concrete mechanical payoff. */
const FOES = [
  {
    id:"cutter", name:"goblin cutter", unlock:0, hp:32, atk:7, xp:9, danger:0, awareness:-8, speed:105,
    intents:{quick:55, heavy:15, dodge:10, guard:10, recover:10}, recoverAt:0.35,
    weakness:{
      id:"overcommit",
      txt:"Overcommits on close cuts. Counters and ripostes deal +50% damage.",
      eff:{counterBonus:1.50}
    }
  },
  {
    id:"scrounger", name:"goblin scrounger", unlock:4, hp:30, atk:6, xp:10, danger:0, awareness:0, speed:95,
    intents:{quick:35, heavy:10, dodge:30, guard:25, recover:0},
    hurtIntents:{quick:15, heavy:5, dodge:25, guard:15, recover:40}, hurtAt:0.65,
    weakness:{
      id:"open_recovery",
      txt:"Drops everything to recover. Strike deals +50% while it is Recovering.",
      eff:{recoverStrikeBonus:1.50}
    }
  },
  {
    id:"skitter", name:"goblin skitter", unlock:8, hp:27, atk:6, xp:11, danger:1, awareness:10, speed:125,
    intents:{quick:35, heavy:5, dodge:45, guard:5, recover:10}, recoverAt:0.30,
    weakness:{
      id:"frail_frame",
      txt:"Built to evade, not absorb. Heavy blows that land deal +40% damage.",
      eff:{heavyBonus:1.40}
    }
  },
  {
    id:"shieldback", name:"goblin shieldback", unlock:14, hp:38, atk:6, xp:12, danger:1, awareness:-4, speed:90,
    intents:{quick:25, heavy:10, dodge:5, guard:45, recover:15}, recoverAt:0.35,
    weakness:{
      id:"braced_wrong",
      txt:"Its shield braces light work. A Heavy that lands during Guard deals +50% damage.",
      eff:{guardHeavyBonus:1.50}
    }
  },
  {
    id:"mauler", name:"goblin mauler", unlock:22, hp:34, atk:8, xp:14, danger:1, awareness:-6, speed:82,
    intents:{quick:30, heavy:50, dodge:5, guard:5, recover:10}, recoverAt:0.28,
    weakness:{
      id:"top_heavy",
      txt:"Top-heavy. While Off-Balance it takes +50% damage instead of +25%.",
      eff:{offBalanceBonus:1.50}
    }
  },
  {
    id:"oldhand", name:"goblin oldhand", unlock:32, hp:42, atk:8, xp:16, danger:2, awareness:18, speed:100,
    intents:{quick:30, heavy:20, dodge:20, guard:20, recover:10}, recoverAt:0.30,
    chargedIntents:{quick:20, heavy:5, dodge:50, guard:20, recover:5},
    weakness:{
      id:"deep_commitment",
      txt:"Deep commitment leaves it vulnerable. A released Heavy that lands deals +50% damage.",
      eff:{fullHeavyBonus:1.50}
    }
  }
];

const HIT_VERBS = ["Struck","Cut into","Caught","Opened up","Got through on","Landed on"];

/* ============================================================
   SESSION 4 / 9C — STRATA + TRAVEL

   Major biome strata are 500 fathoms. Recovery, Run pressure and side-passage
   opportunities deliberately keep their own shorter cadence so changing biome
   length does not make the minute-to-minute delve sparse or punitive.
   ============================================================ */
const STRATA_NAMED = [
  "The Goblin Warren",
  "The Abandoned Mines",
  "The Underbarrow Crypts",
  "The Drowned Undertemple",
  "The Wyrm's Vault"
];
const STRATA_ADJ = ["Sunken","Weeping","Rimed","Hollow","Black","Ashen","Silent","Forgotten","Bleeding","Nine-Gated","Salt-Eaten"];
const STRATA_NOUN = ["Gallery","Stair","Cistern","Chancel","Reservoir","Kiln","Almshouse","Rookery","Sluice","Ossuary","Scriptorium"];
const FATHOMS_PER_STRATUM = 500;
const BUILD_VERSION = "v0.205.1 · Floating Windows & Minimap QOL";
const SETTINGS_KEY = "lowfathom:settings";
const SETTINGS_SCHEMA = 5;
const MINIMAP_SIZE_OPTIONS=["small","medium","large","extra"];
const MINIMAP_ZOOM_OPTIONS=[0,1,2,3,4];
const DEFAULT_SETTINGS = Object.freeze({characterIndicators:true,encounterGraceSeconds:15,diceAnimation:true,diceSize:"normal",combatDice:"player",combatFont:"concept",worldZoom:"standard",minimapSize:"medium",minimapZoom:2});
const WINDOW_LAYOUT_KEY="lowfathom:window-layout:v1";
const COMBAT_FONT_OPTIONS=["concept","slab"];
const ENCOUNTER_GRACE_OPTIONS = [5,15,30];
const DICE_SIZE_OPTIONS = ["small","normal","large"];
const COMBAT_DICE_OPTIONS = ["off","player","all"];
const WORLD_ZOOM_OPTIONS = ["far","standard","close","closer"];
const WORLD_ZOOM_VALUES = Object.freeze({far:1,standard:1.15,close:1.30,closer:1.45});
let settings = {...DEFAULT_SETTINGS};

const TRAVEL_TICK_MS = 500;
const TRAVEL_STEP = 0.25;          // 0.5 fathom / second while Descending
const BLEED_DURATION_MS = 30 * 1000;
const BLEED_TICK_MS = 5 * 1000;
const BLEED_COMBAT_TURN_MS = 2500;    // two completed combat turns ~= one 5-second bleed tick
const TRAVEL_QUIET = 3;            // a short breathing stretch after an event
const TRAVEL_FORCE_EVENT = 16;     // prototype anti-drought cap
const TRAIL_BEHIND = 10;              // compact minimap: behind the delver
const TRAIL_AHEAD = 15;                // compact minimap: ahead; keeps marker near 40% across
const TRAIL_SPAN = TRAIL_BEHIND + TRAIL_AHEAD;
const TRAIL_TICK = 4;                  // labelled depth spacing on the route
const TRAIL_W = 220;
const TRAIL_H = 154;
const TRAIL_MARKER_Y = 77;             // visually centered while the route slopes downward
const TRAIL_VERTICAL_ZOOM = 0.80;      // compact minimap route height

/* v0.106.1 recovery/economy test spacing. Grey Lantern is Town A at 150 fathoms,
   Lantern City is the test city at 450, and Ashwick remains the temporary Town C
   at 550 so every authored delivery still moves strictly deeper. Ashwick continues
   to reuse Grey Lantern art until its own settlement pass. */
const TOWN_DEFS = Object.freeze([
  Object.freeze({
    id:"grey-lantern",name:"Grey Lantern",kind:"town",depth:150,
    image:"./assets/ui/town-grey-lantern.png",aspectRatio:"4 / 4.55",focusY:"43%",
    locations:Object.freeze([
      Object.freeze({id:"market",name:"Market",type:"Trade",x:49.0,y:44.0,description:"The central market district.",service:"market"}),
      Object.freeze({id:"inn",name:"Tavern",type:"Recovery",x:27.0,y:58.0,description:"Grey Lantern's tavern and rest house.",service:"tavern"}),
      Object.freeze({id:"herbalist",name:"Herbalist",type:"Medicine",x:70.0,y:45.0,description:"The herbalist's shop and treatment room.",service:"herbalist"}),
      Object.freeze({id:"guild",name:"Guild Hall",type:"Contracts",x:80.0,y:28.5,description:"A hall used by delvers, guards, and local employers.",service:"guild"}),
      Object.freeze({id:"lower-gate",name:"Lower Gate",type:"Departure",x:48.5,y:83.0,description:"The road out of Grey Lantern continues deeper.",status:"Departure is permanent; you cannot travel back to this town.",departure:true})
    ])
  }),
  Object.freeze({
    id:"lantern-city",name:"Lantern City",kind:"city",depth:450,
    image:"./assets/ui/city-lantern.png",aspectRatio:"4 / 4.55",focusY:"43%",
    locations:Object.freeze([
      Object.freeze({id:"market",name:"Market",type:"Trade",x:49.0,y:44.0,description:"Lantern City's crowded trade quarter.",service:"market"}),
      Object.freeze({id:"inn",name:"Tavern",type:"Recovery",x:27.0,y:58.0,description:"A large rest house serving delvers and caravan crews.",service:"tavern"}),
      Object.freeze({id:"herbalist",name:"Herbalist",npcName:"Mara Venn",type:"Medicine",x:70.0,y:45.0,description:"Mara Venn keeps a medicine shop here and receives field samples for Grey Lantern.",service:"herbalist"}),
      Object.freeze({id:"guild",name:"Guild Hall",type:"Contracts",x:80.0,y:28.5,description:"Lantern City's Guild Hall posts work for the road below.",service:"guild"}),
      Object.freeze({id:"lower-gate",name:"Lower Gate",type:"Departure",x:48.5,y:83.0,description:"The lower road leaves Lantern City and continues into the dark.",status:"Departure is permanent; you cannot travel back to this city.",departure:true})
    ])
  }),
  Object.freeze({
    id:"ashwick",name:"Ashwick",kind:"town",depth:550,
    image:"./assets/ui/town-grey-lantern.png",aspectRatio:"4 / 4.55",focusY:"43%",
    locations:Object.freeze([
      Object.freeze({id:"market",name:"Market",type:"Trade",x:49.0,y:44.0,description:"Ashwick's temporary test market.",service:"market"}),
      Object.freeze({id:"inn",name:"Tavern",type:"Recovery",x:27.0,y:58.0,description:"A small rest house near the lower road.",service:"tavern"}),
      Object.freeze({id:"herbalist",name:"Herbalist",type:"Medicine",x:70.0,y:45.0,description:"A local herbalist serving the settlement.",service:"herbalist"}),
      Object.freeze({id:"guild",name:"Guild Hall",npcName:"Toren Kest",type:"Contracts",x:80.0,y:28.5,description:"Quartermaster Toren Kest receives Guild material forwarded from Lantern City.",service:"guild"}),
      Object.freeze({id:"lower-gate",name:"Lower Gate",type:"Departure",x:48.5,y:83.0,description:"The descent continues beyond Ashwick.",status:"Departure is permanent; you cannot travel back to this town.",departure:true})
    ])
  })
]);
/* ============================================================
   v0.106.0 — TOWN PHASE 5 DELIVERY LOOP
   Quest instances now resolve authored settlement/location destinations. The
   generic depth-event path remains available for future ruins, camps and other
   non-settlement hand-ins. Quest items stay instance-bound and proportional
   quota rewards remain locked when the contract is accepted.
   ============================================================ */
const QUEST_DEFS = Object.freeze([
  Object.freeze({
    id:"grey-lantern-cave-mushrooms",title:"Cave Mushroom Samples",kind:"quota-delivery",
    giverTownId:"grey-lantern",giverLocationId:"guild",giverName:"Grey Lantern Guild Hall",
    targetTownId:"lantern-city",targetLocationId:"herbalist",targetNpcName:"Mara Venn",targetName:"Mara Venn · Lantern City Herbalist",repeatable:false,
    summary:"Gather up to 5 cave mushrooms during the descent and deliver what you recover to Mara Venn in Lantern City.",
    details:"Grey Lantern's Guild wants fresh samples carried forward to Lantern City. Mara Venn pays by usable sample, so arriving with fewer than five still earns a proportional reward.",
    lore:"A practical field order from Grey Lantern: gather what survives the road and place it directly in the hands of Lantern City's herbalist.",
    objectives:Object.freeze([Object.freeze({
      id:"mushrooms",type:"quota-item",required:5,
      item:Object.freeze({id:"quest-cave-mushroom",name:"Cave Mushroom",desc:"A cave mushroom gathered under this specific Grey Lantern contract.",onAbandon:"convert",mundaneName:"Cave Mushroom"}),
      sources:Object.freeze(["combat","explore"]),combatChance:.36,exploreChance:.55,exploreInterval:1.25
    })]),
    reward:Object.freeze({goldPerUnit:10,maxGold:50})
  }),
  Object.freeze({
    id:"grey-lantern-missing-physician",title:"Missing Physician",kind:"rescue-escort",
    giverTownId:"grey-lantern",giverLocationId:"guild",giverName:"Grey Lantern Guild Hall",
    targetTownId:"lantern-city",targetLocationId:"guild",targetNpcName:"Lantern City Guild Representative",targetName:"Lantern City · Lower Gate",repeatable:false,
    interactionId:"zeshava-contract",rescueInteractionId:"zeshava-found",arrivalInteractionId:"zeshava-arrival",
    subject:Object.freeze({id:"zeshava-brightsong",name:"Zeshava Brightsong",role:"Physician / Herbalist"}),
    summary:"Find Zeshava Brightsong, a physician who never arrived in Lantern City, and escort them there if they are still alive.",
    details:"Search the Grey Lantern–Lantern City road for signs of Zeshava Brightsong. If you find them alive, see them safely to Lantern City. Payment is made on arrival.",
    lore:"Grey Lantern sent a physician down-road. Lantern City sent word back when Zeshava Brightsong failed to arrive.",
    objectives:Object.freeze([
      Object.freeze({id:"writ",type:"quest-proof",required:1,issuedQty:1,item:Object.freeze({id:"quest-grey-lantern-writ",name:"Grey Lantern Guild Writ",desc:"A sealed Guild writ naming Zeshava Brightsong and authorizing you to search for them.",onAbandon:"discard"})}),
      Object.freeze({id:"satchel",type:"quest-clue",required:1,item:Object.freeze({id:"quest-zeshava-satchel",name:"Zeshava's Medicine Satchel",desc:"A battered physician's satchel bearing Zeshava Brightsong's mark. Several wrapped medicines remain inside.",onAbandon:"convert",mundaneName:"Medicine Satchel"})})
    ]),
    reward:Object.freeze({gold:80})
  }),
  Object.freeze({
    id:"lantern-city-deepglass",title:"Deepglass Forwarding Order",kind:"quota-delivery",
    giverTownId:"lantern-city",giverLocationId:"guild",giverName:"Lantern City Guild Hall",
    targetTownId:"ashwick",targetLocationId:"guild",targetNpcName:"Toren Kest",targetName:"Toren Kest · Ashwick Guild Hall",repeatable:false,
    summary:"Recover up to 4 deepglass fragments below Lantern City and carry them forward to Toren Kest in Ashwick.",
    details:"The Guild pays for every intact fragment that reaches Ashwick. The order is deliberately capped; once four contract fragments are secured, no more are marked for this job.",
    lore:"Deepglass is common enough to find and fragile enough that every surviving piece matters. Lantern City wants the samples moved downward, not returned upward.",
    objectives:Object.freeze([Object.freeze({
      id:"deepglass",type:"quota-item",required:4,
      item:Object.freeze({id:"quest-deepglass-fragment",name:"Deepglass Fragment",desc:"A dark glassy fragment gathered for Lantern City's forwarding order.",onAbandon:"convert",mundaneName:"Deepglass Fragment"}),
      sources:Object.freeze(["combat","explore"]),combatChance:.34,exploreChance:.52,exploreInterval:1.25
    })]),
    reward:Object.freeze({goldPerUnit:14,maxGold:56})
  }),
  Object.freeze({
    id:"caravan-sealed-dispatch",title:"Sealed Caravan Dispatch",kind:"delivery",
    giverTownId:null,giverLocationId:null,giverName:"Damaged caravan on the Grey Lantern road",
    targetTownId:"lantern-city",targetLocationId:"guild",targetNpcName:"Lantern City Quartermaster",targetName:"Lantern City Guild Hall",repeatable:false,
    summary:"Carry a sealed dispatch recovered from a damaged caravan forward to Lantern City.",
    details:"A caravan crew on the Grey Lantern road asked you to carry one sealed dispatch to the Guild Hall in Lantern City. The parcel is already in your pack; only delivery remains.",
    lore:"The road keeps moving even when a wagon cannot. Someone still has to carry the message forward.",
    objectives:Object.freeze([Object.freeze({
      id:"dispatch",type:"delivery-item",required:1,issuedQty:1,
      item:Object.freeze({id:"quest-caravan-dispatch",name:"Sealed Caravan Dispatch",desc:"A sealed dispatch entrusted to you by a damaged caravan.",onAbandon:"convert",mundaneName:"Sealed Dispatch"})
    })]),
    reward:Object.freeze({goldPerUnit:24,maxGold:24})
  })
]);
function questDefById(id){return QUEST_DEFS.find(q=>q.id===id)||null;}
function ensureQuestState(){
  if(!S)return null;
  if(!S.quests||typeof S.quests!=="object"||Array.isArray(S.quests))S.quests={instances:[],nextSerial:1,exploreAccumulator:0};
  S.quests.instances=Array.isArray(S.quests.instances)?S.quests.instances:[];
  S.quests.nextSerial=Math.max(1,Math.floor(Number(S.quests.nextSerial)||1));
  S.quests.exploreAccumulator=Math.max(0,Number(S.quests.exploreAccumulator)||0);
  S.inventory=S.inventory||{};
  S.inventory.questItems=Array.isArray(S.inventory.questItems)?S.inventory.questItems:[];
  return S.quests;
}
function questInstanceById(id){return ensureQuestState()?.instances.find(q=>q.instanceId===id)||null;}
function questInstances(status=null){const all=ensureQuestState()?.instances||[];return status?all.filter(q=>q.status===status):all;}
function questInstanceForDefinition(defId){return questInstances().find(q=>q.definitionId===defId)||null;}
function activeQuestForDefinition(defId){return questInstances("active").find(q=>q.definitionId===defId)||null;}
function questObjectiveDef(inst,objectiveId){const def=questDefById(inst?.definitionId);return def?.objectives?.find(o=>o.id===objectiveId)||null;}
function questItemCount(instanceId,objectiveId=null){return (S?.inventory?.questItems||[]).reduce((n,row)=>n+(row.questInstanceId===instanceId&&(!objectiveId||row.objectiveId===objectiveId)?Math.max(0,Math.floor(Number(row.qty)||0)):0),0);}
function syncQuestObjectiveProgress(inst){
  if(!inst)return;const def=questDefById(inst.definitionId);inst.objectives=inst.objectives||{};
  for(const obj of def?.objectives||[]){
    const state=inst.objectives[obj.id]||(inst.objectives[obj.id]={current:0,required:obj.required||1});
    if(obj.type==="quota-item"||obj.type==="delivery-item")state.current=questItemCount(inst.instanceId,obj.id);
    state.required=Math.max(1,Number(obj.required)||1);
  }
}
function addQuestItem(inst,obj,qty=1,source="quest"){
  ensureQuestState();if(!inst||!obj||inst.status!=="active")return 0;syncQuestObjectiveProgress(inst);
  const state=inst.objectives[obj.id],room=Math.max(0,state.required-state.current),add=Math.min(room,Math.max(0,Math.floor(Number(qty)||0)));if(!add)return 0;
  let row=S.inventory.questItems.find(x=>x.questInstanceId===inst.instanceId&&x.objectiveId===obj.id&&x.itemId===obj.item.id);
  if(!row){row={itemId:obj.item.id,name:obj.item.name,desc:obj.item.desc||"",qty:0,questInstanceId:inst.instanceId,objectiveId:obj.id,source,acquiredAtDepth:Number(S.depth)||0};S.inventory.questItems.push(row);}
  row.qty+=add;state.current+=add;markCharacterNotice("quests");requestRunSave();return add;
}
function removeQuestItems(instanceId,objectiveId=null,qty=Infinity){
  ensureQuestState();let remaining=Number.isFinite(qty)?Math.max(0,Math.floor(qty)):Infinity,removed=0,next=[];
  for(const row of S.inventory.questItems){
    if(row.questInstanceId!==instanceId||(objectiveId&&row.objectiveId!==objectiveId)||remaining<=0){next.push(row);continue;}
    const take=Math.min(Math.max(0,row.qty||0),remaining);removed+=take;if(Number.isFinite(remaining))remaining-=take;row.qty-=take;if(row.qty>0)next.push(row);
  }
  S.inventory.questItems=next;const inst=questInstanceById(instanceId);if(inst)syncQuestObjectiveProgress(inst);return removed;
}
function releaseQuestItems(inst){
  if(!inst)return 0;const def=questDefById(inst.definitionId);let released=0;
  for(const obj of def?.objectives||[]){
    const count=questItemCount(inst.instanceId,obj.id);if(!count)continue;
    removeQuestItems(inst.instanceId,obj.id);released+=count;
    if(obj.item?.onAbandon==="convert"){addMisc(obj.item.mundaneName||obj.item.name,count);}
  }
  return released;
}
function questPromisedRewardText(inst){
  const r=inst?.promisedRewards||{};if(r.goldPerUnit)return `${formatGold(r.goldPerUnit)} each · up to ${formatGold(r.maxGold||0)}`;
  if(r.gold)return formatGold(r.gold);return "—";
}
function questProgressText(inst){
  const def=questDefById(inst?.definitionId);if(!def)return "";syncQuestObjectiveProgress(inst);
  if(def.kind==="rescue-escort"){
    const r=inst.rescue||{},name=def.subject?.name||"Missing traveller";
    if(r.stage==="completed")return `${name} delivered to ${townDefById(inst.targetTownId)?.name||"the destination"}`;
    if(r.stage==="failed")return `Rescue failed`;
    if(r.stage==="escorting")return `Escorting ${name} · ${formatDepth(S?.depth||inst.acceptedAtDepth)} / ${formatDepth(inst.targetDepth)} fathoms`;
    if(r.stage==="located")return `${name} located`;
    return `${Math.max(0,Number(r.leads)||0)} / 2 leads found`;
  }
  const obj=def.objectives?.[0],state=inst.objectives?.[obj?.id];
  if(obj?.type==="quota-item")return `${state?.current||0} / ${state?.required||obj.required} ${obj.item.name}${(state?.required||obj.required)===1?"":"s"}`;
  return state?`${state.current||0} / ${state.required||1}`:"";
}
function questsAtTownLocation(townId,locationId){return QUEST_DEFS.filter(q=>q.giverTownId===townId&&q.giverLocationId===locationId);}
function questAtTownLocation(townId,locationId){return questsAtTownLocation(townId,locationId)[0]||null;}
function questTurnInsAtTownLocation(townId,locationId){
  return questInstances("active").filter(inst=>{const def=questDefById(inst.definitionId);return def?.kind!=="rescue-escort"&&(inst.targetTownId||def?.targetTownId)===townId&&(inst.targetLocationId||def?.targetLocationId)===locationId;});
}
function questDestinationText(inst){
  const def=questDefById(inst?.definitionId);if(!inst||!def)return "—";
  if(def.kind==="rescue-escort"&&!['escorting','completed'].includes(inst.rescue?.stage)){
    const from=townDefById(def.giverTownId),to=townDefById(def.targetTownId);
    return `${from?.name||"Source"} → ${to?.name||"next settlement"} road · whereabouts unknown`;
  }
  const town=townDefById(inst.targetTownId||def.targetTownId),loc=townLocationById(town,inst.targetLocationId||def.targetLocationId),npc=inst.targetNpcName||def.targetNpcName;
  if(town)return `${town.name} · ${def.kind==="rescue-escort"?"Lower Gate":(loc?.name||def.targetName||"Destination")}${npc&&def.kind!=="rescue-escort"?` · ${npc}`:""} · ${formatDepth(inst.targetDepth)} fathoms`;
  return `${formatDepth(inst.targetDepth)} fathoms · ${def.targetName||"Quest destination"}`;
}
function findClearQuestDepth(desired){
  let d=roundQuarter(Math.max((Number(S?.depth)||0)+8,Number(desired)||0));
  for(let i=0;i<100;i++){
    const otherQuestClear=questInstances("active").every(q=>Math.abs(Number(q.targetDepth||0)-d)>=5);
    if(routeDepthClear(d,5)&&otherQuestClear)return d;d=roundQuarter(d+.75);
  }return d;
}
function acceptQuest(defId){
  ensureQuestState();const def=questDefById(defId);if(!def)return false;
  if(questInstanceForDefinition(defId)&&!def.repeatable)return false;
  const serial=S.quests.nextSerial++,instanceId=`q-${def.id}-${serial}`;
  const originDepth=Number(S.depth)||Number(townDefById(def.giverTownId)?.depth)||0,targetTown=townDefById(def.targetTownId);
  const targetDepth=targetTown?Number(targetTown.depth):findClearQuestDepth(originDepth+Number(def.targetOffset||0));
  const objectives={};for(const obj of def.objectives||[])objectives[obj.id]={current:0,required:Math.max(1,Number(obj.required)||1)};
  const inst={instanceId,definitionId:def.id,status:"active",acceptedAt:Date.now(),acceptedAtDepth:originDepth,acceptedTownId:def.giverTownId,targetDepth,targetTownId:def.targetTownId||null,targetLocationId:def.targetLocationId||null,targetNpcName:def.targetNpcName||null,expiresAtDepth:def.expiresAfterDepth?roundQuarter(originDepth+Number(def.expiresAfterDepth)):null,objectives,promisedRewards:{...(def.reward||{})},result:null,inactiveReason:null};
  if(def.kind==="rescue-escort")inst.rescue=createRescueQuestState(def,inst);
  S.quests.instances.push(inst);
  for(const obj of def.objectives||[])if(obj.issuedQty)addQuestItem(inst,obj,obj.issuedQty,"issued");
  if(!targetTown)nudgePendingMerchantFromDepth(targetDepth,5);
  markCharacterNotice("quests");travelLogAdd(`<b>Quest accepted:</b> ${esc(def.title)} · destination ${esc(questDestinationText(inst))}.`,"beat");saveRunNow();renderTown();renderCharacterSheet();renderTrail();return true;
}
function eligibleQuestDropObjectives(source){
  const rows=[];for(const inst of questInstances("active")){const def=questDefById(inst.definitionId);syncQuestObjectiveProgress(inst);for(const obj of def?.objectives||[]){if(obj.type!=="quota-item"||!obj.sources?.includes(source))continue;const st=inst.objectives[obj.id];if((st?.current||0)<(st?.required||obj.required||1))rows.push({inst,obj});}}return rows;
}
function maybeQuestCombatDrop(f){
  const eligible=eligibleQuestDropObjectives("combat");if(!eligible.length)return null;const pickRow=pick(eligible),chance=clamp(Number(pickRow.obj.combatChance)||0,0,1);if(rnd()>=chance)return null;
  const added=addQuestItem(pickRow.inst,pickRow.obj,1,"combat");if(!added)return null;syncQuestObjectiveProgress(pickRow.inst);const st=pickRow.inst.objectives[pickRow.obj.id],label=`${pickRow.obj.item.name} · Quest ${st.current}/${st.required}`;S._lootFoundCurrent?.push(label);return label;
}
function maybeQuestExploreDrop(){
  const eligible=eligibleQuestDropObjectives("explore");if(!eligible.length){if(S?.quests)S.quests.exploreAccumulator=0;return null;}
  const interval=Math.max(.5,Math.min(...eligible.map(x=>Number(x.obj.exploreInterval)||1.25)));S.quests.exploreAccumulator=(S.quests.exploreAccumulator||0)+TRAVEL_STEP;if(S.quests.exploreAccumulator<interval)return null;S.quests.exploreAccumulator-=interval;
  const pickRow=pick(eligible),chance=clamp(Number(pickRow.obj.exploreChance)||0,0,1);if(rnd()>=chance)return null;const added=addQuestItem(pickRow.inst,pickRow.obj,1,"explore");if(!added)return null;
  syncQuestObjectiveProgress(pickRow.inst);const st=pickRow.inst.objectives[pickRow.obj.id];travelLogAdd(`Exploring turns up <b>${esc(pickRow.obj.item.name)}</b> for <b>${esc(questDefById(pickRow.inst.definitionId)?.title||"your quest")}</b> · ${st.current}/${st.required}.`,"good");return pickRow.obj.item.name;
}
function crossedActiveQuestTarget(beforeDepth,afterDepth){return questInstances("active").filter(q=>!q.targetTownId&&Number(q.targetDepth)>beforeDepth+.0001&&Number(q.targetDepth)<=afterDepth+.0001).sort((a,b)=>a.targetDepth-b.targetDepth)[0]||null;}
function beginQuestTurnIn(inst){
  if(!inst||inst.status!=="active"||inst.targetTownId)return false;const def=questDefById(inst.definitionId);S.depth=Number(inst.targetDepth)||S.depth;S.exploreDepth=S.depth;S.exploreElapsedMs=0;const prior=S.travelMode||"descend";S.travelMode="stopped";pauseBoonClock();syncQuestObjectiveProgress(inst);
  const obj=def?.objectives?.[0],count=obj?questItemCount(inst.instanceId,obj.id):0;const payout=Math.min(Number(inst.promisedRewards?.maxGold)||Infinity,count*(Number(inst.promisedRewards?.goldPerUnit)||0));
  S.travelEvent={id:"quest-turnin",kind:"Quest",title:def?.targetName||"Quest destination",questInstanceId:inst.instanceId,priorMode:prior,text:`${def?.title||"Contract"} can be resolved here.`,rollHtml:`<b>Carried:</b> ${count}/${obj?.required||0} ${esc(obj?.item?.name||"quest item")}${count===1?"":"s"}<br><b>Payment now:</b> ${formatGold(payout)}`};
  travelLogAdd(`<b>Quest destination reached.</b> ${esc(def?.targetName||"The hand-in point")} waits at ${formatDepth(S.depth)} fathoms.`,"beat");render();return true;
}
function resolveQuestDelivery(inst,{resumeTravel=false}={}){
  if(!inst||inst.status!=="active")return false;const def=questDefById(inst.definitionId),obj=def?.objectives?.[0];if(!obj)return false;syncQuestObjectiveProgress(inst);const count=questItemCount(inst.instanceId,obj.id);if(count<=0)return false;
  const delivered=removeQuestItems(inst.instanceId,obj.id,count),reward=Math.min(Number(inst.promisedRewards?.maxGold)||Infinity,delivered*(Number(inst.promisedRewards?.goldPerUnit)||0));S.gold=(S.gold||0)+reward;inst.status="completed";inst.completedAt=Date.now();inst.result={delivered,required:obj.required,reward,full:delivered>=obj.required};inst.inactiveReason=null;
  markCharacterNotice("quests");travelLogAdd(`<b>${esc(def.title)} completed${delivered<obj.required?" partially":""}.</b> Delivered ${delivered}/${obj.required} · received ${formatGold(reward)}.`,"good");
  if(resumeTravel){const resume=S.travelEvent?.priorMode||"descend";S.travelEvent=null;S.travelMode=resume==="explore"?"stopped":resume;resumeBoonClock();}
  saveRunNow();render();return true;
}
function questRewardConfirmationParts(inst){
  const parts=[],result=inst?.result||{};
  const gold=Math.max(0,Math.round(Number(result.reward)||0));
  if(gold>0)parts.push(formatGold(gold));
  const items=Array.isArray(result.rewardItems)?result.rewardItems:[];
  for(const row of items){
    if(!row)continue;
    const qty=Math.max(1,Math.floor(Number(row.qty)||1)),name=String(row.name||row.label||"item");
    parts.push(`${qty>1?`${qty} × `:""}${name}`);
  }
  return parts;
}
function showQuestRewardConfirmation(inst){
  const sheet=$("questRewardSheet");if(!sheet||!inst)return false;
  const def=questDefById(inst.definitionId),parts=questRewardConfirmationParts(inst);
  $("questRewardTitle").textContent=def?.title||"Quest reward";
  $("questRewardText").textContent=parts.length?`You have received ${parts.join(" · ")}.`:"You have received the promised reward.";
  sheet.hidden=false;
  return true;
}
function closeQuestRewardConfirmation(){const sheet=$("questRewardSheet");if(sheet)sheet.hidden=true;}
function completeQuestTurnIn(instanceId){return resolveQuestDelivery(questInstanceById(instanceId),{resumeTravel:true});}
function completeTownQuestTurnIn(instanceId){
  const inst=questInstanceById(instanceId),def=questDefById(inst?.definitionId),town=currentTown();if(!inst||!def||!town||inst.status!=="active")return false;
  if((inst.targetTownId||def.targetTownId)!==town.id||(inst.targetLocationId||def.targetLocationId)!==townLocationOpenId)return false;
  const ok=resolveQuestDelivery(inst,{resumeTravel:false});if(ok){renderTown();renderCharacterSheet();renderPack(false);renderTrail();showQuestRewardConfirmation(inst);}return ok;
}
function makeQuestInactive(instanceId,reason="Destination missed"){
  const inst=questInstanceById(instanceId);if(!inst||inst.status!=="active")return false;
  inst.status="inactive";inst.inactiveReason=reason;inst.inactiveAt=Date.now();
  if(questDefById(inst.definitionId)?.kind==="rescue-escort"){
    if(inst.rescue)inst.rescue.stage="failed";
    clearTemporaryCompanion(inst.instanceId);
  }
  markCharacterNotice("quests");requestRunSave();return true;
}
function passQuestTurnIn(instanceId){
  const inst=questInstanceById(instanceId);if(!inst)return false;const def=questDefById(inst.definitionId),resume=S.travelEvent?.priorMode||"descend";makeQuestInactive(instanceId,"Delivery point passed");S.travelEvent=null;S.travelMode=resume==="explore"?"stopped":resume;resumeBoonClock();travelLogAdd(`<b>${esc(def?.title||"Quest")} becomes inactive.</b> The delivery point has been left behind.`,"note");saveRunNow();render();return true;
}
function deleteInactiveQuest(instanceId){
  const inst=questInstanceById(instanceId);if(!inst||inst.status!=="inactive")return false;const def=questDefById(inst.definitionId),held=questItemCount(inst.instanceId);if(!confirm(`Delete ${def?.title||"this quest"}? ${held?`${held} bound quest item${held===1?"":"s"} will be released from the contract.`:"This cannot be undone."}`))return false;
  const released=releaseQuestItems(inst);S.quests.instances=S.quests.instances.filter(q=>q.instanceId!==instanceId);travelLogAdd(`Inactive quest <b>${esc(def?.title||"quest")}</b> removed.${released?` ${released} gathered item${released===1?"":"s"} became ordinary inventory.`:""}`,"note");saveRunNow();renderCharacterSheet();renderPack(false);renderTrail();return true;
}
function normalizeQuestState(){
  ensureQuestState();for(const inst of S.quests.instances){
    const def=questDefById(inst.definitionId);if(!def){inst.status="inactive";inst.inactiveReason="Quest definition unavailable";continue;}
    if(inst.status==="active"){
      if(def.targetTownId&&!inst.targetTownId){inst.targetTownId=def.targetTownId;inst.targetLocationId=def.targetLocationId||null;inst.targetNpcName=def.targetNpcName||null;inst.targetDepth=Number(townDefById(def.targetTownId)?.depth)||Number(inst.targetDepth)||0;}
      if(inst.expiresAtDepth&&Number(S.depth)>Number(inst.expiresAtDepth)+TRAVEL_STEP){inst.status="inactive";inst.inactiveReason="Contract expired";}
      else if(!inst.targetTownId&&Number(S.depth)>Number(inst.targetDepth)+TRAVEL_STEP&&S.travelEvent?.questInstanceId!==inst.instanceId){inst.status="inactive";inst.inactiveReason="Delivery point missed";}
      else if(inst.targetTownId&&ensureTownState()?.departed?.[inst.targetTownId]){inst.status="inactive";inst.inactiveReason="Destination left behind";}
    }
    if(inst.status!=="active"&&def.kind==="rescue-escort"){
      if(inst.rescue&&inst.status!=="completed")inst.rescue.stage="failed";
      if(S.temporaryCompanion?.questInstanceId===inst.instanceId)S.temporaryCompanion=null;
    }
    syncQuestObjectiveProgress(inst);
  }
}
function activeQuestDestinationLandmarks(){return questInstances("active").filter(inst=>!inst.targetTownId).map(inst=>({depth:Number(inst.targetDepth)||0,title:questDefById(inst.definitionId)?.targetName||"Quest destination"}));}

/* ============================================================
   v0.113.0 — RESCUE / ESCORT FOUNDATION

   Rescue quests remain ordinary persistent Quest Engine instances. Their
   authored clue beats live inside inst.rescue, while a single lightweight
   temporaryCompanion record handles route presence between rescue and handoff.
   No companion combat AI, HP bar or second combat turn is created here.
   ============================================================ */
let routeSpeechTimer=null;
let routeSpeechPriority=0;
function clearRouteSpeech(){
  if(routeSpeechTimer){clearTimeout(routeSpeechTimer);routeSpeechTimer=null;}
  routeSpeechPriority=0;
  const box=$("routeSpeechBubble");if(!box)return;
  box.classList.remove("show");box.hidden=true;
}
function showRouteSpeech({speaker="",text="",who="npc",type="normal",duration=4200,priority=1}={}){
  const box=$("routeSpeechBubble");if(!box||!text||priority<routeSpeechPriority)return false;
  if(routeSpeechTimer){clearTimeout(routeSpeechTimer);routeSpeechTimer=null;}
  routeSpeechPriority=priority;
  box.className=`route-speech ${who==="player"?"player":"npc"}${type&&type!=="normal"?` ${type}`:""}`;
  $("routeSpeechName").textContent=speaker||"";$("routeSpeechName").hidden=!speaker;
  $("routeSpeechText").textContent=text;box.hidden=false;
  requestAnimationFrame(()=>box.classList.add("show"));
  routeSpeechTimer=setTimeout(()=>{box.classList.remove("show");setTimeout(()=>{box.hidden=true;routeSpeechPriority=0;},180);routeSpeechTimer=null;},Math.max(1200,Number(duration)||4200));
  return true;
}
function ensureTemporaryCompanion(){
  if(!S)return null;
  const c=S.temporaryCompanion;
  if(!c||typeof c!=="object"||Array.isArray(c)){S.temporaryCompanion=null;return null;}
  c.status=c.status||"following";c.hiddenForCombat=!!c.hiddenForCombat;
  c.nextBarkDepth=Number(c.nextBarkDepth)||((Number(S.depth)||0)+ri(24,40));
  return c;
}
function temporaryCompanionActive(){const c=ensureTemporaryCompanion();return !!c&&c.status==="following";}
function temporaryCompanionForQuest(instanceId){const c=ensureTemporaryCompanion();return c?.questInstanceId===instanceId?c:null;}
function startTemporaryCompanion(inst){
  const def=questDefById(inst?.definitionId);if(!inst||!def||def.kind!=="rescue-escort")return false;
  const name=def.subject?.name||"Traveller";
  S.temporaryCompanion={id:def.subject?.id||`escort-${inst.instanceId}`,name,role:def.subject?.role||"Traveller",questInstanceId:inst.instanceId,destinationTownId:inst.targetTownId||def.targetTownId,status:"following",hiddenForCombat:false,nextBarkDepth:(Number(S.depth)||0)+ri(24,40),joinedAtDepth:Number(S.depth)||0};
  inst.rescue=inst.rescue||{};inst.rescue.stage="escorting";inst.rescue.joinedAtDepth=Number(S.depth)||0;
  if(!Number.isFinite(Number(inst.rescue.pursuitDepth))){
    const target=Number(inst.targetDepth)||Number(townDefById(inst.targetTownId)?.depth)||((Number(S.depth)||0)+50);
    inst.rescue.pursuitDepth=findClearRescueDepth((Number(S.depth)||0)+(target-(Number(S.depth)||0))*.56,(Number(S.depth)||0)+12,target-8);
  }
  markCharacterNotice("quests");travelLogAdd(`<b>${esc(name)}</b> joins you for the road to ${esc(townDefById(inst.targetTownId)?.name||"the next settlement")}.`,"beat");requestRunSave();return true;
}
function clearTemporaryCompanion(instanceId=null){
  const c=ensureTemporaryCompanion();if(!c||instanceId&&c.questInstanceId!==instanceId)return false;
  S.temporaryCompanion=null;requestRunSave();return true;
}
function companionTravelLines(){return ["Did you hear that?!","Keep your voice down.","I thought I saw movement.","They're still out there.","How much farther?"];}
function maybeCompanionTravelBark(){
  const c=ensureTemporaryCompanion();if(!c||c.status!=="following"||c.hiddenForCombat||S.foe||S.travelEvent||encounterWarningActive()||S.travelMode!=="descend")return false;
  if((Number(S.depth)||0)+.001<Number(c.nextBarkDepth||Infinity))return false;
  c.nextBarkDepth=(Number(S.depth)||0)+ri(24,40);requestRunSave();
  return showRouteSpeech({speaker:c.name,text:pick(companionTravelLines()),who:"npc",type:rnd()<.28?"whisper":"normal",duration:4300,priority:1});
}
function companionEncounterWarningBark(){
  const c=ensureTemporaryCompanion();if(!c||c.status!=="following")return;
  showRouteSpeech({speaker:c.name,text:pick(["I'm going to hide!","Something's coming. I'll hide.","They're here—I'm hiding!"]),who:"npc",type:"normal",duration:4200,priority:3});
}
function companionEnterCombat(){const c=ensureTemporaryCompanion();if(c)c.hiddenForCombat=true;}
function companionLeaveCombat(line="Is it over?"){
  const c=ensureTemporaryCompanion();if(!c)return;
  c.hiddenForCombat=false;c.nextBarkDepth=Math.max(Number(c.nextBarkDepth)||0,(Number(S.depth)||0)+ri(20,34));requestRunSave();
  setTimeout(()=>showRouteSpeech({speaker:c.name,text:line,who:"npc",type:"normal",duration:4200,priority:3}),120);
}
function positionRouteSpeech(marker){
  const box=$("routeSpeechBubble");if(!box||!marker)return;
  box.style.left=marker.style.left||"40%";box.style.top=marker.style.top||"50%";
}
function findClearRescueDepth(desired,minDepth,maxDepth){
  let d=roundQuarter(clamp(Number(desired)||0,Number(minDepth)||0,Number(maxDepth)||Number(desired)||0));
  const min=Number(minDepth)||0,max=Math.max(min,Number(maxDepth)||d);
  for(let i=0;i<80;i++){
    if(routeDepthClear(d,4)&&TOWN_DEFS.every(t=>Math.abs(Number(t.depth)-d)>=6))return d;
    const offset=(i%2===0?1:-1)*(Math.floor(i/2)+1)*.75;d=roundQuarter(clamp((Number(desired)||d)+offset,min,max));
  }
  return roundQuarter(clamp(Number(desired)||min,min,max));
}
function rescueDepthDifficulty(depth){return Math.max(0,Math.floor(Math.log2(1+Math.max(0,Number(depth)||0)/500)));}
function rescueSkillChallenge(depth,difficulty=0){return authoredChallenge(10+rescueDepthDifficulty(depth)+Math.max(0,Number(difficulty)||0));}
function createRescueQuestState(def,inst){
  const origin=Number(inst.acceptedAtDepth)||Number(townDefById(def.giverTownId)?.depth)||0,target=Number(inst.targetDepth)||Number(townDefById(def.targetTownId)?.depth)||origin+120,span=Math.max(60,target-origin);
  const track=findClearRescueDepth(origin+span*.22,origin+14,target-36);
  const satchel=findClearRescueDepth(origin+span*.48,track+18,target-26);
  const hideout=findClearRescueDepth(origin+span*.72,satchel+18,target-14);
  return {stage:"searching",leads:0,trackDepth:track,satchelDepth:satchel,hideoutDepth:hideout,pursuitDepth:null,tracksResolved:false,satchelResolved:false,hideoutResolved:false,pursuitResolved:false,trackAttempts:{investigation:false,survival:false},hideoutAttempts:{perception:false,survival:false},satchelInsight:false,enemyLabel:"goblins"};
}
function ensureRescueQuestState(inst){
  const def=questDefById(inst?.definitionId);if(!inst||def?.kind!=="rescue-escort")return null;
  if(!inst.rescue||typeof inst.rescue!=="object"||Array.isArray(inst.rescue))inst.rescue=createRescueQuestState(def,inst);
  inst.rescue.trackAttempts=inst.rescue.trackAttempts&&typeof inst.rescue.trackAttempts==="object"?inst.rescue.trackAttempts:{investigation:false,survival:false};
  inst.rescue.hideoutAttempts=inst.rescue.hideoutAttempts&&typeof inst.rescue.hideoutAttempts==="object"?inst.rescue.hideoutAttempts:{perception:false,survival:false};
  inst.rescue.leads=Math.max(0,Math.min(2,Number(inst.rescue.leads)||0));
  return inst.rescue;
}
function activeRescueQuests(){return questInstances("active").filter(inst=>questDefById(inst.definitionId)?.kind==="rescue-escort");}
function rescueQuestItem(inst,objectiveId){const obj=questObjectiveDef(inst,objectiveId);return obj?questItemCount(inst.instanceId,obj.id):0;}
function addRescueLead(inst){const r=ensureRescueQuestState(inst);if(!r)return 0;r.leads=Math.min(2,(Number(r.leads)||0)+1);markCharacterNotice("quests");requestRunSave();return r.leads;}
function crossedRescueBeat(beforeDepth,afterDepth){
  for(const inst of activeRescueQuests()){
    const r=ensureRescueQuestState(inst);if(!r)continue;
    const beats=r.stage==="escorting"?[["pursuit",r.pursuitDepth,r.pursuitResolved]]:[["tracks",r.trackDepth,r.tracksResolved],["satchel",r.satchelDepth,r.satchelResolved],["hideout",r.hideoutDepth,r.hideoutResolved]];
    for(const [type,depth,resolved] of beats){if(!resolved&&Number.isFinite(Number(depth))&&Number(depth)>beforeDepth+.0001&&Number(depth)<=afterDepth+.0001)return {type,depth:Number(depth),inst};}
  }
  return null;
}
function rescueEventBase(inst,beat){
  const r=ensureRescueQuestState(inst),prior=S.travelMode||"descend";S.depth=Number(beat.depth)||S.depth;S.exploreElapsedMs=0;S.exploreDepth=S.depth;S.travelMode="stopped";S.travelSinceEvent=0;pauseBoonClock();
  return {questInstanceId:inst.instanceId,priorMode:prior,rescueKind:beat.type,rescueDepth:Number(beat.depth)||S.depth,enemyLabel:r?.enemyLabel||"creatures"};
}
function beginRescueHideout(inst,automatic=false){
  const r=ensureRescueQuestState(inst);if(!r)return false;r.hideoutResolved=true;r.stage="located";
  S.travelEvent={id:"rescue-hideout",kind:"Missing person",title:"A hidden refuge",text:"The trail ends at a cramped recess off the route. Something is moving outside it.",rollHtml:automatic?`<b>Trail:</b> the clues point here clearly.`:"",questInstanceId:inst.instanceId,priorMode:"descend",rescueKind:"hideout",enemyLabel:r.enemyLabel};
  travelLogAdd(`<b>The trail leads to a hidden refuge.</b> Someone may still be alive inside.`,"beat");render();
  showRouteSpeech({speaker:S.name,text:"That has to be the place.",who:"player",type:"thought",duration:3900,priority:2});return true;
}
function beginRescueBeat(beat){
  const inst=beat?.inst,r=ensureRescueQuestState(inst);if(!inst||!r)return false;
  const base=rescueEventBase(inst,beat);
  if(beat.type==="tracks"){
    S.travelEvent={id:"rescue-clue",kind:"Missing person",title:"Tracks leave the road",text:"Fresh-looking prints break away from the main descent. The marks are uneven, as if whoever made them was moving in haste.",rollHtml:"",...base};
    travelLogAdd(`<b>Possible clue.</b> Tracks leave the main road near ${formatDepth(S.depth)} fathoms.`,"note");render();
    showRouteSpeech({speaker:S.name,text:"Those tracks leave the main route.",who:"player",type:"thought",duration:3900,priority:2});return true;
  }
  if(beat.type==="satchel"){
    S.travelEvent={id:"rescue-clue",kind:"Missing person",title:"A bag in the rubble",text:"A battered medical satchel lies caught between two stones. Several wrapped medicines are still inside.",rollHtml:"",...base};
    travelLogAdd(`<b>Possible clue.</b> A medical satchel lies abandoned beside the route.`,"note");render();
    showRouteSpeech({speaker:S.name,text:"A medical bag?",who:"player",type:"thought",duration:3600,priority:2});return true;
  }
  if(beat.type==="hideout"){
    if(r.leads>=2)return beginRescueHideout(inst,true);
    S.travelEvent={id:"rescue-search",kind:"Missing person",title:"Something off the route",text:"For a moment there is a sound beyond the main path—too faint to place, then gone.",rollHtml:"",...base};
    travelLogAdd(`<b>The trail is uncertain.</b> Something may be hidden off the route here.`,"note");render();
    showRouteSpeech({speaker:S.name,text:"Was that a voice?",who:"player",type:"thought",duration:3600,priority:2});return true;
  }
  if(beat.type==="pursuit")return beginEscortDangerEvent(inst,base);
  return false;
}
function resumeRescueTravel(ev=S?.travelEvent){
  const resume=ev?.priorMode||"descend";S.travelEvent=null;S.travelMode=resume==="descend"?"descend":"stopped";S.travelSinceEvent=0;resumeBoonClock();saveRunNow();render();return true;
}
function failRescueQuest(inst,reason="Rescue failed"){
  if(!inst||inst.status!=="active")return false;const def=questDefById(inst.definitionId),r=ensureRescueQuestState(inst);if(r)r.stage="failed";
  inst.status="inactive";inst.inactiveReason=reason;inst.inactiveAt=Date.now();clearTemporaryCompanion(inst.instanceId);markCharacterNotice("quests");
  travelLogAdd(`<b>${esc(def?.title||"Rescue")} failed.</b> ${esc(reason)}.`,"danger");saveRunNow();return true;
}
function completeRescueQuest(inst){
  if(!inst||inst.status!=="active")return false;const def=questDefById(inst.definitionId),reward=Math.max(0,Math.round(Number(inst.promisedRewards?.gold)||0));
  removeQuestItems(inst.instanceId,null,Infinity);S.gold=(S.gold||0)+reward;inst.status="completed";inst.completedAt=Date.now();inst.inactiveReason=null;inst.result={reward,full:true,rescued:def?.subject?.name||"Traveller",delivered:1,required:1};
  if(inst.rescue)inst.rescue.stage="completed";clearTemporaryCompanion(inst.instanceId);markCharacterNotice("quests");travelLogAdd(`<b>${esc(def?.title||"Rescue")} completed.</b> ${esc(def?.subject?.name||"The traveller")} reached ${esc(townDefById(inst.targetTownId)?.name||"the destination")} · received ${esc(formatGold(reward))}.`,"good");saveRunNow();return true;
}
function maybeStartEscortArrival(town){
  const c=ensureTemporaryCompanion();if(!town||!c||c.status!=="following"||c.destinationTownId!==town.id||activeInteraction())return false;
  const inst=questInstanceById(c.questInstanceId),def=questDefById(inst?.definitionId);if(!inst||inst.status!=="active"||def?.kind!=="rescue-escort")return false;
  return startInteraction(def.arrivalInteractionId||"zeshava-arrival",{questInstanceId:inst.instanceId,townId:town.id,rescuedName:def.subject?.name||c.name});
}
function beginEscortDangerEvent(inst,base=null){
  const r=ensureRescueQuestState(inst),c=temporaryCompanionForQuest(inst.instanceId);if(!r||!c)return false;
  const prior=base?.priorMode||S.travelMode||"descend";r.pursuitResolved=true;S.travelMode="stopped";pauseBoonClock();
  S.travelEvent={id:"escort-danger",kind:"Escort",title:"Movement behind you",text:`${c.name} stops dead. The same ${r.enemyLabel||"creatures"} that drove them into hiding may have found the trail again.`,rollHtml:"",questInstanceId:inst.instanceId,priorMode:prior,rescueKind:"pursuit"};
  travelLogAdd(`<b>Escort danger.</b> ${esc(c.name)} recognizes movement behind you.`,"danger");render();
  showRouteSpeech({speaker:c.name,text:"That's them.",who:"npc",type:"whisper",duration:4300,priority:3});return true;
}
function startRescueThreatCombat(inst,{guardian=false,pursuit=false}={}){
  if(!inst||inst.status!=="active")return false;const profile=chooseFoeProfile(),tag={questInstanceId:inst.instanceId,profileId:profile.id};S.travelEvent=null;
  travelLogAdd(guardian?`A <b>${esc(profile.name)}</b> prowls between you and the refuge.`:`The pursuers close in. You stand between them and <b>${esc(questDefById(inst.definitionId)?.subject?.name||"your companion")}</b>.`,"danger");
  return spawnEncounter({profile,...(guardian?{rescueGuardian:tag}:{escortThreat:tag})});
}
function rescueCombatVictory(foe){
  const tag=foe?.rescueGuardian||foe?.escortThreat;if(!tag)return false;const inst=questInstanceById(tag.questInstanceId),def=questDefById(inst?.definitionId);if(!inst||inst.status!=="active")return false;
  if(foe.rescueGuardian){const r=ensureRescueQuestState(inst);if(r)r.stage="located";queueInteraction(def.rescueInteractionId||"zeshava-found",{questInstanceId:inst.instanceId,enemyLabel:r?.enemyLabel||"creatures",resumeMode:"stopped"});travelLogAdd(`<b>The refuge is clear.</b> You can finally reach whoever is hiding inside.`,"beat");}
  else travelLogAdd(`<b>The pursuit breaks.</b> ${esc(def.subject?.name||"Your companion")} can keep moving with you.`,"good");
  requestRunSave();return true;
}
function rescueCombatAbandoned(foe){
  const tag=foe?.rescueGuardian||foe?.escortThreat;if(!tag)return false;const inst=questInstanceById(tag.questInstanceId);if(!inst||inst.status!=="active")return false;
  if(foe.rescueGuardian)return failRescueQuest(inst,"You fled the refuge and left it behind");
  return failRescueQuest(inst,`${questDefById(inst.definitionId)?.subject?.name||"The traveller"} was lost when you broke from the pursuit`);
}

/* ============================================================
   v0.108.0 — GAME-WIDE NPC INTERACTION ENGINE

   Conversations are data-driven node graphs. Content supplies speakers, text,
   choices, conditions, effects and optional existing-Skill checks; the engine
   owns rendering, save-safe node state and transitions. Nothing here creates a
   parallel quest, merchant, item or Skill system — interaction effects call the
   existing engines instead.
   ============================================================ */
const INTERACTION_DEFS=Object.freeze({
  "zeshava-contract":Object.freeze({
    id:"zeshava-contract",kind:"Guild contract",start:"briefing",
    nodes:Object.freeze({
      briefing:Object.freeze({
        speaker:"Guild Representative",
        text:()=>`We got word from Brightsong's family in Lantern City. Zeshava Brightsong, a physician we sent down-road, never arrived. Find out what happened. If they're alive, see them safely to Lantern City. Payment is ${formatGold(questDefById("grey-lantern-missing-physician")?.reward?.gold||0)} on arrival.`,
        choices:Object.freeze([
          Object.freeze({id:"accept",label:"I'll find them.",sub:()=>"accept the missing-person contract",next:"accepted",style:"reward",effects:Object.freeze([Object.freeze({type:"acceptQuest",questId:"grey-lantern-missing-physician"})])}),
          Object.freeze({id:"decline",label:"Not this time.",sub:"leave the contract on the board",end:true,style:"leave"})
        ])
      }),
      accepted:Object.freeze({
        speaker:"Guild Representative",text:"Take this writ. It names Brightsong and carries Grey Lantern's seal. If you find them, get them to Lantern City. They'll settle the payment there.",
        choices:Object.freeze([Object.freeze({id:"leave",label:"Take the writ",sub:"return to Grey Lantern",end:true,wide:true,style:"reward"})])
      })
    })
  }),
  "zeshava-found":Object.freeze({
    id:"zeshava-found",kind:"Missing person",start:"wary",
    nodes:Object.freeze({
      wary:Object.freeze({
        speaker:"Zeshava Brightsong",text:"Stop there. Who are you?",
        choices:Object.freeze([
          Object.freeze({id:"persuade",label:"I was sent by Grey Lantern's Guild.",sub:"Persuasion · earn practice even if the writ is needed",style:"skill",skill:Object.freeze({id:"persuasion",challenge:()=>rescueSkillChallenge(S?.depth||0,0),practiceSource:"zeshava-trust"}),success:"trusted",failure:"skeptical"})
        ])
      }),
      skeptical:Object.freeze({
        speaker:"Zeshava Brightsong",text:"Anyone could say that. I need more than your word.",
        choices:Object.freeze([
          Object.freeze({id:"writ",label:"Show the Guild Writ",sub:"Grey Lantern's seal is proof enough",next:"trusted",showWhen:Object.freeze({type:"questItemAtLeast",objectiveId:"writ",amount:1})}),
          Object.freeze({id:"satchel",label:"Show the medicine satchel",sub:"return the equipment you found on the road",next:"satchel-proof",showWhen:Object.freeze({type:"questItemAtLeast",objectiveId:"satchel",amount:1})})
        ])
      }),
      "satchel-proof":Object.freeze({
        speaker:"Zeshava Brightsong",text:"That's mine. I dropped it when I ran. All right—you're telling the truth.",
        choices:Object.freeze([Object.freeze({id:"continue",label:"What happened?",sub:"hear them out",next:"trusted",wide:true})])
      }),
      trusted:Object.freeze({
        speaker:"Zeshava Brightsong",text:active=>`Thank you. I've been holed up in here for days. I lost most of my equipment when the ${active?.context?.enemyLabel||"creatures"} came after me, and every time I thought they'd gone I heard them searching again. I can't make the rest of the road alone.`,
        choices:Object.freeze([
          Object.freeze({id:"escort",label:"Come with me.",sub:"escort Zeshava to Lantern City",next:"joining",style:"reward"}),
          Object.freeze({id:"leave",label:"I can't take you.",sub:"leaving them here permanently fails the rescue",next:"abandon-confirm",style:"leave"})
        ])
      }),
      joining:Object.freeze({
        speaker:"Zeshava Brightsong",text:"Then stay close. I won't get in your way if something finds us.",onEnterEffects:Object.freeze([Object.freeze({type:"hook",name:"start-rescue-companion"})]),
        choices:Object.freeze([Object.freeze({id:"leave",label:"Move on together",sub:"Zeshava now accompanies you",end:true,wide:true,style:"reward"})])
      }),
      "abandon-confirm":Object.freeze({
        speaker:"Zeshava Brightsong",text:"If you leave now, I can't follow you down alone.",
        choices:Object.freeze([
          Object.freeze({id:"back",label:"Come with me.",sub:"take responsibility for the escort",next:"joining",style:"reward"}),
          Object.freeze({id:"abandon",label:"Leave anyway",sub:"the rescue fails when you continue downward",end:true,style:"leave",effects:Object.freeze([Object.freeze({type:"hook",name:"fail-rescue-abandoned"})])})
        ])
      })
    })
  }),
  "zeshava-arrival":Object.freeze({
    id:"zeshava-arrival",kind:"Escort handoff",start:"thanks",
    nodes:Object.freeze({
      thanks:Object.freeze({
        speaker:"Zeshava Brightsong",text:"We made it. I thought I was going to die back there. Thank you.",
        choices:Object.freeze([Object.freeze({id:"continue",label:"Continue",sub:"someone is waiting at the gate",next:"representative",wide:true})])
      }),
      representative:Object.freeze({
        speaker:"Lantern City Guild Representative",text:active=>`Brightsong. We had word to watch for you. The contract is fulfilled. Here's the promised ${formatGold(questInstanceById(active?.context?.questInstanceId)?.promisedRewards?.gold||0)}.`,
        choices:Object.freeze([Object.freeze({id:"reward",label:"Receive payment",sub:"complete the rescue and enter Lantern City",end:true,wide:true,style:"reward",effects:Object.freeze([Object.freeze({type:"hook",name:"complete-rescue-arrival"})])})])
      })
    })
  }),
  "caravan-survivors":Object.freeze({
    id:"caravan-survivors",kind:"Caravan survivors",start:"thanks",endHook:"resolve-helped-caravan",
    nodes:Object.freeze({
      thanks:Object.freeze({
        speaker:"Caravan Master",
        text:"Gods below—you came at the right moment. Thought we'd lost the wagon.",
        choices:Object.freeze([
          Object.freeze({id:"continue",label:"Continue",sub:"hear them out",next:"reward",wide:true})
        ])
      }),
      reward:Object.freeze({
        speaker:"Caravan Master",
        text:"Here. Something for your troubles. We can handle the dead.",
        onEnterEffects:Object.freeze([
          Object.freeze({type:"gold",min:8,max:16}),
          Object.freeze({type:"generatedEquipment",depthOffset:0,source:"caravan-survivor-thanks"})
        ]),
        choices:Object.freeze([
          Object.freeze({id:"wounded",label:"Are you all right?",sub:"ask after the wounded",next:"wounded"}),
          Object.freeze({id:"more",label:"Need any more help?",sub:"see whether anything else needs doing",next:"more"}),
          Object.freeze({id:"leave",label:"Move Along",sub:"return to the descent",end:true,wide:true,style:"leave"})
        ])
      }),
      wounded:Object.freeze({
        speaker:"Caravan Master",
        text:"A few cuts. One of ours took the worst of it.",
        choices:Object.freeze([
          Object.freeze({
            id:"bandage",label:"Use a Bandage",sub:"1 Bandage · Survival check",style:"skill",
            enabledWhen:Object.freeze({type:"inventoryAtLeast",key:"bandages",amount:1}),disabledSub:"requires 1 Bandage",
            beforeEffects:Object.freeze([Object.freeze({type:"inventory",key:"bandages",delta:-1})]),
            skill:Object.freeze({id:"survival",challengeRank:12,practiceSource:"caravan-wounded"}),
            success:"bandage-success",failure:"bandage-failure"
          }),
          Object.freeze({id:"back",label:"Keep talking",sub:"leave your supplies packed",next:"more",style:"leave"})
        ])
      }),
      "bandage-success":Object.freeze({
        speaker:"Wounded Caravaner",
        text:"That'll hold. Better than bleeding all the way to Lantern City.",
        choices:Object.freeze([Object.freeze({id:"continue",label:"Anything else?",sub:"return to the caravan master",next:"more",wide:true})])
      }),
      "bandage-failure":Object.freeze({
        speaker:"Wounded Caravaner",
        text:"You bind it as best you can. It should hold, but not comfortably.",
        choices:Object.freeze([Object.freeze({id:"continue",label:"Anything else?",sub:"return to the caravan master",next:"more",wide:true})])
      }),
      more:Object.freeze({
        speaker:"Caravan Master",
        text:"If you're still offering, there may be one thing.",
        choices:Object.freeze([
          Object.freeze({
            id:"dispatch",label:"Anything I can carry forward?",sub:"ask whether something needs to reach the next settlement",next:"dispatch-offer",
            showWhen:Object.freeze({all:Object.freeze([
              Object.freeze({type:"contextEquals",key:"routeId",value:"grey-lantern__lantern-city"}),
              Object.freeze({type:"questAbsent",questId:"caravan-sealed-dispatch"})
            ])})
          }),
          Object.freeze({
            id:"nothing",label:"Anything I can carry forward?",sub:"ask whether something needs to reach the next settlement",next:"nothing-more",
            showWhen:Object.freeze({not:Object.freeze({all:Object.freeze([
              Object.freeze({type:"contextEquals",key:"routeId",value:"grey-lantern__lantern-city"}),
              Object.freeze({type:"questAbsent",questId:"caravan-sealed-dispatch"})
            ])})})
          }),
          Object.freeze({id:"leave",label:"Move Along",sub:"return to the descent",end:true,style:"leave"})
        ])
      }),
      "dispatch-offer":Object.freeze({
        speaker:"Caravan Master",
        text:"Take this sealed dispatch to the Guild Hall in Lantern City. The wagon will make poor time from here.",
        choices:Object.freeze([
          Object.freeze({id:"accept",label:"Carry it forward",sub:"accept a normal persistent quest",next:"dispatch-accepted",style:"reward",effects:Object.freeze([Object.freeze({type:"acceptQuest",questId:"caravan-sealed-dispatch"})])}),
          Object.freeze({id:"decline",label:"Not this time",sub:"leave the dispatch with the caravan",next:"more",style:"leave"})
        ])
      }),
      "dispatch-accepted":Object.freeze({
        speaker:"Caravan Master",
        text:"Then that's one less thing tied to this wagon. Safe road.",
        choices:Object.freeze([
          Object.freeze({id:"leave",label:"Move Along",sub:"return to the descent",end:true,wide:true,style:"leave"})
        ])
      }),
      "nothing-more":Object.freeze({
        speaker:"Caravan Master",
        text:"Not today. You've done enough.",
        choices:Object.freeze([
          Object.freeze({id:"leave",label:"Move Along",sub:"return to the descent",end:true,wide:true,style:"leave"})
        ])
      })
    })
  }),
  "caravan-passing":Object.freeze({
    id:"caravan-passing",kind:"Passing caravan",start:"greeting",endHook:"resolve-caravan-interaction",
    nodes:Object.freeze({
      greeting:Object.freeze({
        speaker:"Caravaner",
        text:"A caravaner gives you a tired nod as the wagons edge past in the dark.",
        choices:Object.freeze([
          Object.freeze({id:"route",label:"Where are you headed?",sub:"ask about their route",next:"route"}),
          Object.freeze({id:"road",label:"Anything ahead?",sub:"ask what they saw on the road",next:"road"}),
          Object.freeze({id:"leave",label:"Safe travels",sub:"let the caravan continue",end:true,wide:true,style:"leave"})
        ])
      }),
      route:Object.freeze({
        speaker:"Caravaner",
        text:active=>active?.context?.direction==="up"
          ?"Upward. Supplies, letters, and whoever has business closer to the settlements above."
          :"Downward. There is always another stop below, if the road stays open.",
        choices:Object.freeze([
          Object.freeze({id:"back",label:"Keep talking",sub:"ask something else",next:"greeting"}),
          Object.freeze({id:"leave",label:"Move Along",sub:"return to the descent",end:true,style:"leave"})
        ])
      }),
      road:Object.freeze({
        speaker:"Caravaner",
        text:"Nothing worth stopping for when we passed through. That can change quickly down here.",
        choices:Object.freeze([
          Object.freeze({id:"back",label:"Keep talking",sub:"ask something else",next:"greeting"}),
          Object.freeze({id:"leave",label:"Move Along",sub:"return to the descent",end:true,style:"leave"})
        ])
      })
    })
  }),
  "caravan-damaged":Object.freeze({
    id:"caravan-damaged",kind:"Damaged caravan",start:"thanks",endHook:"resolve-caravan-interaction",
    nodes:Object.freeze({
      thanks:Object.freeze({
        speaker:"Caravan Master",
        text:"That's got it. Another stretch like that and we'd have lost the wheel entirely.",
        choices:Object.freeze([
          Object.freeze({id:"wounded",label:"Anyone hurt?",sub:"check whether the crew needs treatment",next:"wounded"}),
          Object.freeze({id:"more",label:"Need anything else?",sub:"see whether anything still needs doing",next:"more"}),
          Object.freeze({id:"leave",label:"Move Along",sub:"return to the descent",end:true,wide:true,style:"leave"})
        ])
      }),
      wounded:Object.freeze({
        speaker:"Caravan Master",
        text:"Mostly scrapes. One of ours caught the axle badly when it shifted.",
        choices:Object.freeze([
          Object.freeze({
            id:"bandage",label:"Use a Bandage",sub:"1 Bandage · Survival check",style:"skill",
            enabledWhen:Object.freeze({type:"inventoryAtLeast",key:"bandages",amount:1}),disabledSub:"requires 1 Bandage",
            beforeEffects:Object.freeze([Object.freeze({type:"inventory",key:"bandages",delta:-1})]),
            skill:Object.freeze({id:"survival",challengeRank:12,practiceSource:"caravan-damaged-wounded"}),
            success:"bandage-success",failure:"bandage-failure"
          }),
          Object.freeze({id:"back",label:"Keep talking",sub:"leave your supplies packed",next:"more",style:"leave"})
        ])
      }),
      "bandage-success":Object.freeze({
        speaker:"Wounded Caravaner",
        text:"Good wrap. That'll hold until we reach somewhere with a proper table and light.",
        choices:Object.freeze([Object.freeze({id:"continue",label:"Anything else?",sub:"return to the caravan master",next:"more",wide:true})])
      }),
      "bandage-failure":Object.freeze({
        speaker:"Wounded Caravaner",
        text:"It'll do. Not pretty, but better than leaving it open on the road.",
        choices:Object.freeze([Object.freeze({id:"continue",label:"Anything else?",sub:"return to the caravan master",next:"more",wide:true})])
      }),
      more:Object.freeze({
        speaker:"Caravan Master",
        text:"If you're still offering, there may be one thing.",
        choices:Object.freeze([
          Object.freeze({
            id:"dispatch",label:"Anything I can carry forward?",sub:"ask whether something needs to reach the next settlement",next:"dispatch-offer",
            showWhen:Object.freeze({all:Object.freeze([
              Object.freeze({type:"contextEquals",key:"routeId",value:"grey-lantern__lantern-city"}),
              Object.freeze({type:"questAbsent",questId:"caravan-sealed-dispatch"})
            ])})
          }),
          Object.freeze({
            id:"nothing",label:"Anything I can carry forward?",sub:"ask whether something needs to reach the next settlement",next:"nothing-more",
            showWhen:Object.freeze({not:Object.freeze({all:Object.freeze([
              Object.freeze({type:"contextEquals",key:"routeId",value:"grey-lantern__lantern-city"}),
              Object.freeze({type:"questAbsent",questId:"caravan-sealed-dispatch"})
            ])})})
          }),
          Object.freeze({id:"leave",label:"Move Along",sub:"return to the descent",end:true,style:"leave"})
        ])
      }),
      "dispatch-offer":Object.freeze({
        speaker:"Caravan Master",
        text:"Take this sealed dispatch to the Guild Hall in Lantern City. We'll make poor time from here.",
        choices:Object.freeze([
          Object.freeze({id:"accept",label:"Carry it forward",sub:"accept the delivery quest",next:"dispatch-accepted",style:"reward",effects:Object.freeze([Object.freeze({type:"acceptQuest",questId:"caravan-sealed-dispatch"})])}),
          Object.freeze({id:"decline",label:"Not this time",sub:"leave the dispatch with the caravan",next:"more",style:"leave"})
        ])
      }),
      "dispatch-accepted":Object.freeze({
        speaker:"Caravan Master",
        text:"Then that's one less thing tied to this wagon. Safe road.",
        choices:Object.freeze([Object.freeze({id:"leave",label:"Move Along",sub:"return to the descent",end:true,wide:true,style:"leave"})])
      }),
      "nothing-more":Object.freeze({
        speaker:"Caravan Master",
        text:"Not today. You've already done enough.",
        choices:Object.freeze([Object.freeze({id:"leave",label:"Move Along",sub:"return to the descent",end:true,wide:true,style:"leave"})])
      })
    })
  })
});
let interactionBusy=false;
function ensureInteractionState(){
  if(!S)return null;
  if(!S.interactionState||typeof S.interactionState!=="object"||Array.isArray(S.interactionState))S.interactionState={active:null,pending:null,nextSerial:1};
  const st=S.interactionState;
  st.nextSerial=Math.max(1,Math.floor(Number(st.nextSerial)||1));
  if(!st.active||typeof st.active!=="object"||Array.isArray(st.active))st.active=null;
  if(!st.pending||typeof st.pending!=="object"||Array.isArray(st.pending))st.pending=null;
  return st;
}
function interactionDef(id){return INTERACTION_DEFS[id]||null;}
function interactionNodeText(node,active){return typeof node?.text==="function"?(node.text(active)||""):(node?.text||"");}
function interactionChoiceSub(choice,active){return typeof choice?.sub==="function"?(choice.sub(active)||""):(choice?.sub||"");}
function activeInteraction(){return ensureInteractionState()?.active||null;}
function interactionConditionMet(condition,active=activeInteraction()){
  if(!condition)return true;
  if(condition.all)return condition.all.every(c=>interactionConditionMet(c,active));
  if(condition.any)return condition.any.some(c=>interactionConditionMet(c,active));
  if(condition.not)return !interactionConditionMet(condition.not,active);
  if(condition.type==="inventoryAtLeast")return Number(S?.inventory?.[condition.key])>=Number(condition.amount||1);
  if(condition.type==="questItemAtLeast"){const inst=questInstanceById(active?.context?.questInstanceId);return !!inst&&questItemCount(inst.instanceId,condition.objectiveId)>=Number(condition.amount||1);}
  if(condition.type==="questAbsent")return !questInstanceForDefinition(condition.questId);
  if(condition.type==="contextEquals")return active?.context?.[condition.key]===condition.value;
  return true;
}
function interactionEffectResult(effect,active){
  if(!effect||!active)return "";
  if(effect.type==="gold"){
    const amount=ri(Number(effect.min)||0,Number(effect.max)||Number(effect.min)||0);S.gold=(S.gold||0)+amount;
    travelLogAdd(`Conversation reward: <b>${esc(formatGold(amount))}</b>.`,"good");
    return `<b>Received:</b> ${esc(formatGold(amount))}`;
  }
  if(effect.type==="generatedEquipment"){
    const item=generateProceduralEquipment(Math.max(0,(Number(S.depth)||0)+(Number(effect.depthOffset)||0)),effect.source||`interaction:${active.defId}`);
    if(!item)return "";addGeneratedEquipment(item);
    travelLogAdd(`Conversation reward: <b>${esc(item.name)}</b> · ${esc(item.rarity)} · iLv ${item.itemLevel}.`,"good");
    return `<b>Equipment:</b> ${esc(item.name)} · ${esc(item.rarity)} · iLv ${item.itemLevel}`;
  }
  if(effect.type==="inventory"){
    const key=effect.key;if(!key)return "";S.inventory=S.inventory||{};S.inventory[key]=Math.max(0,(Number(S.inventory[key])||0)+(Number(effect.delta)||0));
    if(Number(effect.delta)<0){
      const amount=Math.abs(Number(effect.delta)||0);let label=key.replace(/([A-Z])/g," $1").replace(/^./,m=>m.toUpperCase());if(amount===1&&label.endsWith("s"))label=label.slice(0,-1);
      travelLogAdd(`Conversation choice used <b>${amount} ${esc(label)}</b>.`,"note");return `<b>Used:</b> ${amount} ${esc(label)}`;
    }
    return "";
  }
  if(effect.type==="acceptQuest"){
    const existing=questInstanceForDefinition(effect.questId),accepted=existing||acceptQuest(effect.questId);
    return accepted?`<b>Quest:</b> ${esc(questDefById(effect.questId)?.title||effect.questId)}`:"";
  }
  if(effect.type==="hook"){
    const hook=INTERACTION_HOOKS[effect.name];return typeof hook==="function"?(hook(active,effect)||""):"";
  }
  return "";
}
function applyInteractionEffects(effects,active,onceKey=null){
  if(!active||!Array.isArray(effects)||!effects.length)return "";
  active.appliedEffects=Array.isArray(active.appliedEffects)?active.appliedEffects:[];
  if(onceKey&&active.appliedEffects.includes(onceKey))return "";
  if(onceKey)active.appliedEffects.push(onceKey);
  const parts=effects.map(effect=>interactionEffectResult(effect,active)).filter(Boolean);
  const html=parts.join("<br>");
  active.effectResults=active.effectResults&&typeof active.effectResults==="object"?active.effectResults:{};
  if(onceKey)active.effectResults[onceKey]=html;
  requestRunSave();return html;
}
function enterInteractionNode(active,nodeId,extraHtml=""){
  const def=interactionDef(active?.defId),node=def?.nodes?.[nodeId];if(!active||!node)return false;
  active.nodeId=nodeId;active.nodeResults=active.nodeResults&&typeof active.nodeResults==="object"?active.nodeResults:{};
  const onEnter=applyInteractionEffects(node.onEnterEffects,active,`node:${nodeId}`);
  const combined=[extraHtml,onEnter].filter(Boolean).join("<br>");
  if(combined)active.nodeResults[nodeId]=[active.nodeResults[nodeId],combined].filter(Boolean).join("<br>");
  requestRunSave();return true;
}
function interactionSession(defId,context={}){
  const st=ensureInteractionState(),def=interactionDef(defId);if(!st||!def)return null;
  return {sessionId:`interaction-${st.nextSerial++}`,defId,nodeId:def.start,context:cloneForSave(context||{}),appliedEffects:[],effectResults:{},nodeResults:{},startedAt:Date.now()};
}
function startInteraction(defId,context={}){
  const st=ensureInteractionState(),active=interactionSession(defId,context);if(!st||!active)return false;
  st.active=active;st.pending=null;interactionBusy=false;
  if(!currentTown()){pauseBoonClock();S.travelMode="stopped";}
  enterInteractionNode(active,active.nodeId);saveRunNow();render();return true;
}
function queueInteraction(defId,context={}){
  const st=ensureInteractionState(),pending=interactionSession(defId,context);if(!st||!pending)return false;
  st.pending=pending;requestRunSave();return true;
}
function activateQueuedInteraction(){
  const st=ensureInteractionState();if(!st?.pending)return false;
  st.active=st.pending;st.pending=null;interactionBusy=false;
  if(!currentTown()){pauseBoonClock();S.travelMode="stopped";}
  enterInteractionNode(st.active,st.active.nodeId);saveRunNow();render();return true;
}
const INTERACTION_HOOKS={
  "start-rescue-companion":active=>{const inst=questInstanceById(active?.context?.questInstanceId);return startTemporaryCompanion(inst)?`<b>Escort:</b> ${esc(questDefById(inst?.definitionId)?.subject?.name||"Traveller")} is accompanying you.`:"";},
  "fail-rescue-abandoned":active=>{const inst=questInstanceById(active?.context?.questInstanceId);failRescueQuest(inst,"You left Zeshava Brightsong in the refuge");return "";},
  "complete-rescue-arrival":active=>{const inst=questInstanceById(active?.context?.questInstanceId);if(!inst)return "";const ok=completeRescueQuest(inst);if(ok)setTimeout(()=>showQuestRewardConfirmation(inst),0);return ok?`<b>Quest completed:</b> ${esc(questDefById(inst.definitionId)?.title||"Rescue")}`:"";},
  "resolve-helped-caravan":active=>{
    const outcome=active?.context?.outcome||"helped-attacked";recordCaravanResolution(outcome,pendingCaravan());
    if(S&&!over){S.travelMode=active?.context?.resumeMode==="descend"?"descend":"stopped";S.travelSinceEvent=0;resumeBoonClock();}
    return "";
  },
  "resolve-caravan-interaction":active=>{
    const outcome=active?.context?.outcome||"talked";recordCaravanResolution(outcome,pendingCaravan());
    if(S&&!over){S.travelMode=active?.context?.resumeMode==="descend"?"descend":"stopped";S.travelSinceEvent=0;resumeBoonClock();}
    return "";
  }
};
function endInteraction(){
  const st=ensureInteractionState(),active=st?.active,def=interactionDef(active?.defId);if(!st||!active)return false;
  if(def?.endHook){const hook=INTERACTION_HOOKS[def.endHook];if(typeof hook==="function")hook(active);}
  st.active=null;interactionBusy=false;saveRunNow();render();return true;
}
function renderInteraction(){
  const sheet=$("interactionSheet");if(!sheet)return;
  const active=activeInteraction(),def=interactionDef(active?.defId),node=def?.nodes?.[active?.nodeId];
  sheet.hidden=!active||!def||!node;if(sheet.hidden)return;
  $("interactionKind").textContent=def.kind||"Conversation";$("interactionSpeaker").textContent=node.speaker||"Traveller";$("interactionText").textContent=interactionNodeText(node,active);
  const result=$("interactionResult"),html=active.nodeResults?.[active.nodeId]||"";result.hidden=!html;result.innerHTML=html;
  const actions=$("interactionActions");actions.innerHTML=(node.choices||[]).filter(choice=>interactionConditionMet(choice.showWhen,active)).map(choice=>{
    const enabled=interactionConditionMet(choice.enabledWhen,active),baseSub=interactionChoiceSub(choice,active),sub=enabled?baseSub:(choice.disabledSub||baseSub||"Unavailable");
    const cls=["interaction-choice",choice.wide?"wide":"",choice.style||""].filter(Boolean).join(" ");
    return `<button class="${cls}" type="button" data-interaction-choice="${esc(choice.id)}"${enabled?"":" disabled"}><b>${esc(choice.label||"Continue")}</b><span>${esc(sub)}</span></button>`;
  }).join("");
}
async function handleInteractionChoice(choiceId){
  if(interactionBusy)return;const active=activeInteraction(),def=interactionDef(active?.defId),node=def?.nodes?.[active?.nodeId],choice=node?.choices?.find(c=>c.id===choiceId);
  if(!active||!choice||!interactionConditionMet(choice.showWhen,active)||!interactionConditionMet(choice.enabledWhen,active))return;
  interactionBusy=true;renderInteraction();
  let resultHtml=applyInteractionEffects(choice.beforeEffects,active,`choice:${active.nodeId}:${choice.id}:before`);
  let target=choice.next||null;
  if(choice.skill){
    const challenge=typeof choice.skill.challenge==="function"?Number(choice.skill.challenge(active)):Number.isFinite(Number(choice.skill.challenge))?Number(choice.skill.challenge):authoredChallenge(Number(choice.skill.challengeRank)||12),check=await runActiveSkillCheck(choice.skill.id,challenge,Number(choice.skill.circumstance)||0);
    const practiceKey=`interaction:${choice.skill.practiceSource||choice.id}:${active.context?.eventId||active.sessionId}`;
    const practice=awardSkillPractice(choice.skill.id,practiceKey,check);
    resultHtml=[resultHtml,formatSkillCheck(check)+practiceText(choice.skill.id,practice)].filter(Boolean).join("<br>");
    target=check.success?choice.success:choice.failure;
  }
  resultHtml=[resultHtml,applyInteractionEffects(choice.effects,active,`choice:${active.nodeId}:${choice.id}:effects`)].filter(Boolean).join("<br>");
  if(choice.end){interactionBusy=false;return endInteraction();}
  if(target)enterInteractionNode(active,target,resultHtml);
  interactionBusy=false;saveRunNow();render();
}

/* ============================================================
   v0.107.2 — PHASE 6 CARAVANS ON THE WANDERING-MERCHANT CADENCE

   Caravans no longer maintain a second independent interruption timer. The
   existing wandering-merchant scheduler owns one road-traffic slot at a time:
   50% of those slots stay the normal wandering merchant, while 50% become a
   caravan event at the exact same scheduled depth. This keeps road life visible
   without increasing the total number of travel interruptions.
   ============================================================ */
const CARAVAN_ROUTE_DEFS=Object.freeze([
  Object.freeze({
    id:"grey-lantern__lantern-city",fromTownId:"grey-lantern",toTownId:"lantern-city",
    pool:Object.freeze([
      Object.freeze({type:"merchant",weight:2}),
      Object.freeze({type:"damaged",weight:3}),
      Object.freeze({type:"attacked",weight:2})
    ])
  }),
  Object.freeze({
    id:"lantern-city__ashwick",fromTownId:"lantern-city",toTownId:"ashwick",
    pool:Object.freeze([
      Object.freeze({type:"merchant",weight:2}),
      Object.freeze({type:"damaged",weight:1}),
      Object.freeze({type:"attacked",weight:4})
    ])
  })
]);
const CARAVAN_DEFAULT_POOL=Object.freeze([
  Object.freeze({type:"merchant",weight:2}),
  Object.freeze({type:"damaged",weight:2}),
  Object.freeze({type:"attacked",weight:2})
]);
const CARAVAN_ROAD_SLOT_CHANCE=.50;
const CARAVAN_WARNING_DISTANCE=22;
const CARAVAN_WARNING_MS=6000;

function ensureCaravanState(){
  if(!S)return null;
  if(!S.caravans||typeof S.caravans!=="object"||Array.isArray(S.caravans))S.caravans={pending:null,history:[],routeRolls:{},warning:null,nextSerial:1,activeMerchant:null};
  const c=S.caravans;
  if(!Array.isArray(c.history))c.history=[];
  // routeRolls is retained only so schema-11 saves remain harmless after migration.
  // The independent route scheduler that used it no longer runs.
  if(!c.routeRolls||typeof c.routeRolls!=="object"||Array.isArray(c.routeRolls))c.routeRolls={};
  c.nextSerial=Math.max(1,Math.floor(Number(c.nextSerial)||1));
  if(!c.pending||typeof c.pending!=="object"||Array.isArray(c.pending))c.pending=null;
  if(!c.warning||typeof c.warning!=="object"||Array.isArray(c.warning))c.warning=null;
  if(!c.activeMerchant||typeof c.activeMerchant!=="object"||Array.isArray(c.activeMerchant))c.activeMerchant=null;
  return c;
}
function caravanRouteById(id){return CARAVAN_ROUTE_DEFS.find(r=>r.id===id)||null;}
function caravanRouteBounds(route){
  const from=townDefById(route?.fromTownId),to=townDefById(route?.toTownId);
  return from&&to?{from,to,start:Number(from.depth)||0,end:Number(to.depth)||0}:null;
}
function caravanRouteForDepth(depth){
  const d=Number(depth)||0;
  return CARAVAN_ROUTE_DEFS.find(route=>{
    const b=caravanRouteBounds(route);return !!b&&d>=b.start-.001&&d<b.end-.001;
  })||null;
}
function weightedCaravanType(route){
  const pool=(route?.pool?.length?route.pool:CARAVAN_DEFAULT_POOL).filter(row=>row?.type!=="passing");
  const total=pool.reduce((n,row)=>n+Math.max(0,Number(row.weight)||0),0);
  if(total<=0)return "merchant";
  let roll=rnd()*total;
  for(const row of pool){roll-=Math.max(0,Number(row.weight)||0);if(roll<=0)return row.type;}
  return pool[pool.length-1]?.type||"merchant";
}
function scheduleCaravanAtRoadSlot(depth){
  const c=ensureCaravanState();if(!c||c.pending)return c?.pending||null;
  const d=roundQuarter(depth),route=caravanRouteForDepth(d);
  c.pending={
    id:`caravan-${c.nextSerial++}`,routeId:route?.id||null,type:weightedCaravanType(route),depth:d,
    direction:rnd()<.5?"down":"up",warningChecked:false,warningShown:false,createdAt:Date.now(),roadSlot:true,
    fallbackRouteName:route?null:`${stratumName(stratumIndex(d)).replace(/^The /,"")} route`
  };
  requestRunSave();return c.pending;
}
function pendingCaravan(){
  const c=ensureCaravanState(),event=c?.pending||null;
  if(event?.type==="passing"){
    const route=caravanRouteById(event.routeId)||caravanRouteForDepth(event.depth);
    event.type=weightedCaravanType(route);
    event.warningChecked=false;event.warningShown=false;
    if(c)c.warning=null;
    requestRunSave();
  }
  return event;
}
function caravanRouteLabel(event=pendingCaravan()){
  const route=caravanRouteById(event?.routeId),b=caravanRouteBounds(route);
  if(b){
    return event?.direction==="up"
      ? `${b.to.name} → ${b.from.name} · travelling upward`
      : `${b.from.name} → ${b.to.name} · travelling downward`;
  }
  const road=event?.fallbackRouteName||"Underground route";
  return `${road} · travelling ${event?.direction==="up"?"upward":"downward"}`;
}
function caravanWarningText(event=pendingCaravan()){
  if(!event)return "";
  if(event.type==="attacked")return "Steel and shouting carry through the dark ahead.";
  if(event.type==="damaged")return "You hear an uneven wheel and stopped voices somewhere ahead.";
  if(event.type==="merchant")return "Harness bells and several voices carry along the route ahead.";
  return "Harness, footsteps, and low voices carry along the road ahead.";
}
function maybeCaravanPerceptionWarning(){
  const event=pendingCaravan();if(!event||event.warningChecked||S.travelMode!=="descend"||S.foe||S.travelEvent)return false;
  const distance=Number(event.depth)-Number(S.depth);
  if(distance<=0||distance>CARAVAN_WARNING_DISTANCE)return false;
  event.warningChecked=true;
  const challenge=authoredChallenge(event.type==="attacked"?10:event.type==="damaged"?12:14);
  const check=runSkillCheck("perception",challenge),practice=awardSkillPractice("perception",`caravan-warning:${event.id}`,check);
  if(!check.success){requestRunSave();return false;}
  event.warningShown=true;
  const text=caravanWarningText(event);
  ensureCaravanState().warning={eventId:event.id,text,until:Date.now()+CARAVAN_WARNING_MS};
  travelLogAdd(`<b>Perception:</b> ${esc(text)}${practiceText("perception",practice)}`,"good");
  requestRunSave();return true;
}
function renderCaravanEarlyWarning(){
  const box=$("caravanEarlyWarning");if(!box)return;
  const warning=ensureCaravanState()?.warning;
  if(!warning||Date.now()>=Number(warning.until)||warning.eventId!==pendingCaravan()?.id){
    if(S?.caravans)S.caravans.warning=null;
    box.hidden=true;box.textContent="";return;
  }
  box.hidden=false;box.innerHTML=`<b>Perception</b><br>${esc(warning.text)}`;
}
function caravanEventCopy(event){
  if(!event)return {title:"Caravan on the road",text:"Traffic occupies the route ahead."};
  if(event.type==="merchant")return {title:"A merchant caravan has halted",text:"A travelling trader and several pack animals have stopped beside the route."};
  if(event.type==="damaged")return {title:"A caravan has broken down",text:"One wagon sits at an angle with a damaged wheel while the crew works around it."};
  if(event.type==="attacked")return {title:"A caravan is under attack",text:"A caravan has been hit beside the route. Fighting is still underway around the wagons."};
  return {title:"A caravan has halted",text:"A caravan has stopped on the route and its crew are dealing with a problem."};
}
function beginCaravanEvent(event=pendingCaravan()){
  if(!S||!event||S.foe||S.travelEvent||currentTown())return false;
  S.depth=roundQuarter(event.depth);S.exploreDepth=S.depth;S.exploreElapsedMs=0;
  pauseBoonClock();S.travelMode="stopped";S.travelSinceEvent=0;
  if(S.caravans)S.caravans.warning=null;
  const copy=caravanEventCopy(event);
  S.travelEvent={
    id:"caravan",stage:"choice",kind:"Road traffic",title:copy.title,text:copy.text,
    rollHtml:`<b>Route:</b> ${esc(caravanRouteLabel(event))}`,caravanEventId:event.id,caravanType:event.type,routeId:event.routeId,priorMode:"descend",outcome:null
  };
  travelLogAdd(`<b>Caravan event.</b> ${esc(copy.title)} · ${esc(caravanRouteLabel(event))}.`,"note");
  render();return true;
}
function crossedPendingCaravan(beforeDepth,afterDepth){
  const event=pendingCaravan();if(!event)return null;
  return Number(event.depth)>Number(beforeDepth)+.0001&&Number(event.depth)<=Number(afterDepth)+.0001?event:null;
}
function recordCaravanResolution(outcome="resolved",event=pendingCaravan()){
  const c=ensureCaravanState();if(!c)return;
  if(event){
    c.history.push({id:event.id,routeId:event.routeId,type:event.type,direction:event.direction,depth:Number(event.depth)||0,outcome,resolvedAt:Date.now()});
    if(c.history.length>40)c.history.shift();
    // A new-model caravan consumed one of the exact same cadence slots that a
    // wandering merchant would have consumed, so advance the merchant cadence.
    if(event.roadSlot)S.merchantVisits=(Number(S.merchantVisits)||0)+1;
  }
  c.pending=null;c.activeMerchant=null;c.warning=null;c.routeRolls={};
  maybeScheduleMerchant();
  requestRunSave();
}
function completeCaravanAndResume(outcome="resolved"){
  const event=pendingCaravan(),prior=S?.travelEvent?.priorMode||"descend";
  recordCaravanResolution(outcome,event);
  if(S)S.travelEvent=null;
  if(S&&!over){S.travelMode=prior==="descend"?"descend":"stopped";S.travelSinceEvent=0;resumeBoonClock();}
  saveRunNow();render();return true;
}
function caravanSetResult(title,text,rollHtml="",outcome="resolved"){
  if(S?.travelEvent?.id!=="caravan")return false;
  Object.assign(S.travelEvent,{stage:"result",title,text,rollHtml,outcome});render();return true;
}
function caravanCanOfferDispatch(event=pendingCaravan()){
  return !!event&&event.routeId==="grey-lantern__lantern-city"&&!questInstanceForDefinition("caravan-sealed-dispatch");
}
function generateCaravanMerchant(event=pendingCaravan()){
  if(!event)return null;
  const merchant=generateMerchantForDepth(event.depth);
  merchant.context="caravan";merchant.caravanEventId=event.id;merchant.title="Caravan Trader";merchant.displayName=`${merchant.title} ${merchant.name}`;
  return merchant;
}
function caravanCombatVictory(foe){
  if(!foe?.caravan)return false;
  const event=pendingCaravan();if(!event)return false;
  travelLogAdd(`The fighting around the caravan finally stops. The survivors gather themselves beside the wagons.`,"good");
  queueInteraction("caravan-survivors",{eventId:event.id,routeId:event.routeId,caravanType:event.type,resumeMode:"descend",outcome:"helped-attacked"});
  return true;
}
function caravanCombatAbandoned(foe){
  if(!foe?.caravan)return false;
  travelLogAdd(`You break away from the caravan fight and leave the road event behind.`,"note");
  recordCaravanResolution("left-during-fight",pendingCaravan());return true;
}
function activeCaravanLandmark(){
  const event=pendingCaravan();
  if(!event)return null;
  // v0.113.2: merchant caravan slots are still caravan encounters internally,
  // but their visible route marker should read as trade, not as an unknown
  // sudden event. Damaged/attacked caravans keep the generic ?! marker.
  return {
    type:event.type==="merchant"?"merchant":"caravan-event",
    depth:Number(event.depth)||0,
    title:event.type==="merchant"?"Travelling merchant":"Something is happening on the route"
  };
}

function townDefById(id){ return TOWN_DEFS.find(t=>t.id===id)||null; }
function townLocationById(def,id){ return def?.locations?.find(loc=>loc.id===id)||null; }
function ensureTownState(){
  if(!S) return null;
  const state=(S.townState&&typeof S.townState==="object"&&!Array.isArray(S.townState))?S.townState:{};
  state.currentId=typeof state.currentId==="string"?state.currentId:null;
  state.visited=(state.visited&&typeof state.visited==="object"&&!Array.isArray(state.visited))?state.visited:{};
  state.departed=(state.departed&&typeof state.departed==="object"&&!Array.isArray(state.departed))?state.departed:{};
  state.services=(state.services&&typeof state.services==="object"&&!Array.isArray(state.services))?state.services:{};
  if(state.currentId&&!townDefById(state.currentId)) state.currentId=null;
  S.townState=state;
  return state;
}
function currentTown(){
  const state=ensureTownState();
  return state?.currentId?townDefById(state.currentId):null;
}
function findCrossedTown(beforeDepth,afterDepth){
  const state=ensureTownState();
  if(!state||state.currentId) return null;
  const before=Number(beforeDepth)||0,after=Number(afterDepth)||0;
  return TOWN_DEFS.find(t=>!state.departed[t.id]&&before<t.depth&&after>=t.depth)||null;
}
function townAtCurrentDepth(){
  const state=ensureTownState();
  if(!state||state.currentId) return null;
  return TOWN_DEFS.find(t=>!state.departed[t.id]&&Math.abs((Number(S?.depth)||0)-t.depth)<0.001)||null;
}

/* v0.112.1: three-hit momentum remains, but the upper chain steps are reduced
   so repeated 1-Stamina Strikes do not eclipse a full-turn committed attack. */
const STRIKE_MULT = [1.0, 1.6, 2.6];

/* Session 9F item-value spine. Depth remains the master progression benchmark.
   A full-slot iLv point is now one Intrinsic Value point: the generator targets
   value, buys real properties, then derives displayed iLv from the finished item.
   Gold appraisal is deliberately separate so future merchants can add margins,
   CHA/haggling and scarcity without changing combat power. */
const BALANCE_DEPTH_EXPONENT = 0.60;
const INTRINSIC_VALUE_PER_ILVL = 1;
const ARMOR_VALUE_COST = 8;
const WEAPON_VALUE_COST = 15;
const ATTRIBUTE_VALUE_COST = 40;
const GENERATED_ILVL_VARIANCE = 0.06;
const GENERATED_VALUE_TOLERANCE = 0.08;
const ARMOR_CURVE_CONSTANT = 2.5;
const SLOT_BUDGET_COEFFICIENTS = Object.freeze({
  rightHand:1.00,leftHand:1.00,top:1.00,bottoms:0.80,hat:0.60,gloves:0.60,boots:0.60,
  cape:0.50,belt:0.50,light:0.50,necklace:0.50,earLeft:0.40,earRight:0.40,
  ring1:0.40,ring2:0.40,ring3:0.40,ring4:0.40
});
function depthGrowth(depth=S?.depth||0){ return Math.pow(Math.max(0,Number(depth)||0),BALANCE_DEPTH_EXPONENT); }
function expectedPrimaryAtDepth(depth=S?.depth||0){ return 13 + 0.60*depthGrowth(depth); }
function expectedConAtDepth(depth=S?.depth||0){ return 12 + 0.30*depthGrowth(depth); }
function expectedMaxHpAtDepth(depth=S?.depth||0){ return expectedConAtDepth(depth)*6; }
function expectedStrikeAtDepth(depth=S?.depth||0){ return expectedPrimaryAtDepth(depth); }
function expectedEnemyHitAtDepth(depth=S?.depth||0){ return expectedMaxHpAtDepth(depth)/9; }
function expectedMediumArmorAtDepth(depth=S?.depth||0){ return 3*expectedPrimaryAtDepth(depth); }
// Algebraically identical to the old 19.5 + 0.90G budget curve divided by 0.195.
function expectedItemLevelAtDepth(depth=S?.depth||0){ return Math.max(1,Math.round(100 + (0.90/0.195)*depthGrowth(depth))); }
function intrinsicValueFromLevel(ilvl,coefficient=1){ return Math.max(0,(Number(ilvl)||0)*Math.max(0.01,Number(coefficient)||1)*INTRINSIC_VALUE_PER_ILVL); }
function itemLevelFromIntrinsic(value,coefficient=1){ return Math.max(0,Math.round((Number(value)||0)/(Math.max(0.01,Number(coefficient)||1)*INTRINSIC_VALUE_PER_ILVL))); }

const RARITY_ORDER = Object.freeze(["Salvage","Poor","Common","Uncommon","Rare","Epic","Wondrous","Legendary","Mythical","Ancient","Sunless","Unfathomable"]);
const RARITY_DEFS = Object.freeze({
  // v0.203.17: rarity is now a three-era depth progression rather than twelve
  // independent permanent percentages. unlockDepth marks the era in which a
  // procedural rarity can first appear; the live odds are calculated below.
  Salvage:{unlockDepth:0,budgetMult:0.75},
  Poor:{unlockDepth:0,budgetMult:0.88},
  Common:{unlockDepth:0,budgetMult:1.00},
  Uncommon:{unlockDepth:0,budgetMult:1.08},
  Rare:{unlockDepth:500,budgetMult:1.18},
  Epic:{unlockDepth:500,budgetMult:1.32},
  Wondrous:{unlockDepth:500,budgetMult:1.47},
  Legendary:{unlockDepth:500,budgetMult:1.63},
  Mythical:{unlockDepth:5000,budgetMult:1.81},
  Ancient:{unlockDepth:5000,budgetMult:2.00},
  Sunless:{unlockDepth:5000,budgetMult:2.22},
  Unfathomable:{unlockDepth:5000,budgetMult:2.47}
});
function rarityDef(name){ return RARITY_DEFS[name]||RARITY_DEFS.Common; }
function rarityMarketMultiplier(name){ return Math.sqrt(Math.max(0.01,rarityDef(name).budgetMult||1)); }
function rarityClass(name){ return `rarity-${String(name||"Common").toLowerCase().replace(/[^a-z]+/g,"")}`; }
function rarityFrameClass(name){ return `rarity-frame rarity-frame-${String(name||"Common").toLowerCase().replace(/[^a-z]+/g,"")}`; }
function raritySparkles(name,seedKey=""){
  if(RARITY_ORDER.indexOf(name)<RARITY_ORDER.indexOf("Legendary")) return "";
  let seed=2166136261;
  const src=String(seedKey||name);
  for(let i=0;i<src.length;i++){seed^=src.charCodeAt(i);seed=Math.imul(seed,16777619)>>>0;}
  const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  const stars=[];
  for(let i=0;i<3;i++){
    const x=(12+rand()*76).toFixed(1),y=(16+rand()*68).toFixed(1);
    const size=(i===1?8+rand()*5:5+rand()*4).toFixed(1);
    const dur=(12+rand()*7).toFixed(1),delay=(-rand()*17).toFixed(1);
    stars.push(`<i class="rarity-sparkle" aria-hidden="true" style="--sx:${x}%;--sy:${y}%;--ss:${size}px;--sdur:${dur}s;--sdelay:${delay}s"></i>`);
  }
  return `<i class="rarity-sparkles" aria-hidden="true">${stars.join("")}</i>`;
}

// Three rarity eras. Era I completes at the first 500-fathom boundary. Era II
// then carries the exceptional ladder to 5,000. Era III is intentionally
// endless: Unfathomable eventually becomes the most common deep drop, but the
// lower three deep rarities never disappear completely.
const RARITY_ERAS = Object.freeze([
  Object.freeze({start:0,end:500,tiers:Object.freeze(["Salvage","Poor","Common","Uncommon"]),endless:false}),
  Object.freeze({start:500,end:5000,tiers:Object.freeze(["Rare","Epic","Wondrous","Legendary"]),endless:false}),
  Object.freeze({start:5000,end:null,tiers:Object.freeze(["Mythical","Ancient","Sunless","Unfathomable"]),endless:true})
]);
const RARITY_COMPLETE_CURVE = Object.freeze([
  Object.freeze({t:0.00,w:Object.freeze([0.60,0.27,0.10,0.03])}),
  Object.freeze({t:0.20,w:Object.freeze([0.42,0.34,0.18,0.06])}),
  Object.freeze({t:0.50,w:Object.freeze([0.20,0.35,0.32,0.13])}),
  Object.freeze({t:0.75,w:Object.freeze([0.05,0.15,0.42,0.38])}),
  Object.freeze({t:0.90,w:Object.freeze([0.00,0.03,0.22,0.75])}),
  Object.freeze({t:1.00,w:Object.freeze([0.00,0.00,0.00,1.00])})
]);
const RARITY_ENDLESS_CURVE = Object.freeze([
  Object.freeze({t:0.00,w:Object.freeze([0.60,0.27,0.10,0.03])}),
  Object.freeze({t:0.20,w:Object.freeze([0.42,0.34,0.18,0.06])}),
  Object.freeze({t:0.50,w:Object.freeze([0.20,0.35,0.32,0.13])}),
  Object.freeze({t:0.75,w:Object.freeze([0.08,0.20,0.40,0.32])}),
  Object.freeze({t:1.00,w:Object.freeze([0.03,0.12,0.30,0.55])})
]);
const RARITY_ENDLESS_DEPTH_SCALE = 12000;
function rarityCurveWeights(curve,t){
  const x=Math.max(0,Math.min(1,Number(t)||0));
  for(let i=1;i<curve.length;i++){
    const a=curve[i-1],b=curve[i];
    if(x<=b.t){
      const span=Math.max(0.000001,b.t-a.t),u=(x-a.t)/span;
      return a.w.map((v,j)=>v+(b.w[j]-v)*u);
    }
  }
  return [...curve[curve.length-1].w];
}
function rarityEraStateAtDepth(depth=S?.depth||0){
  const d=Math.max(0,Number(depth)||0);
  // The exact boundary remains the capstone of the preceding era: 500 is
  // 100% Uncommon and 5,000 is 100% Legendary. The next quarter-fathom begins
  // the new descending ladder.
  if(d<=RARITY_ERAS[0].end){
    const era=RARITY_ERAS[0],progress=(d-era.start)/(era.end-era.start);
    return {era,progress:Math.max(0,Math.min(1,progress)),weights:rarityCurveWeights(RARITY_COMPLETE_CURVE,progress)};
  }
  if(d<=RARITY_ERAS[1].end){
    const era=RARITY_ERAS[1],progress=(d-era.start)/(era.end-era.start);
    return {era,progress:Math.max(0,Math.min(1,progress)),weights:rarityCurveWeights(RARITY_COMPLETE_CURVE,progress)};
  }
  const era=RARITY_ERAS[2];
  const progress=1-Math.exp(-(d-era.start)/RARITY_ENDLESS_DEPTH_SCALE);
  return {era,progress:Math.max(0,Math.min(1,progress)),weights:rarityCurveWeights(RARITY_ENDLESS_CURVE,progress)};
}
function equipmentRarityOddsAtDepth(depth=S?.depth||0){
  const {era,weights}=rarityEraStateAtDepth(depth),odds={};
  for(const rarity of RARITY_ORDER) odds[rarity]=0;
  era.tiers.forEach((rarity,i)=>{odds[rarity]=Math.max(0,Number(weights[i])||0);});
  const total=Object.values(odds).reduce((sum,v)=>sum+v,0)||1;
  for(const rarity of RARITY_ORDER) odds[rarity]/=total;
  return odds;
}
function equipmentRarityChanceAtDepth(name,depth=S?.depth||0){
  return equipmentRarityOddsAtDepth(depth)[name]||0;
}

/* Session 5 recovery pacing. These are deliberately isolated so phone
   playtesting can change them without touching combat balance. */
const REST_RECOVERY_REQUIRED = 60;      // NEW deepest fathoms after each Rest; backtracking/sideways travel never count
const REST_HEAL_FRACTION = 0.25;        // always based on Max HP, never current HP
const HOLLOW_FIRST_OFFSET = 20;         // first ordinary hollow inside each major stratum
const HOLLOW_SPACING = 30;              // preserve the old ~30-fathom recovery rhythm
const HOLLOW_STAGE_MARGIN = 8;           // special pre-boss staging hollow sits this far above the boundary
const RUN_PRESSURE_RESET_FATHOMS = 60;  // Run pressure is encounter pacing, not biome pacing
const SIDE_PASSAGE_CADENCE_FATHOMS = 60;// side opportunities remain frequent inside a 500-fathom biome
// v0.203.9.3: the authored legacy side-passage event engine is parked.
// Passages remain physical world geography; old riddles/traps/altars/etc. stay
// in this file for later reuse, but Active World must never enter side mode,
// stage-gate the route, or return/teleport the player on completion.
const SIDE_PASSAGE_EVENTS_ENABLED = false;
const HOLLOW_AUTO_RESUME_MS = 15000;    // ordinary hollow only
const LEVELUP_NOTICE_MS = 15000;         // informational only; does not pause the delve
const COMBAT_RESULT_LINGER_MS = 1500;    // legacy timing constant; post-combat now waits for explicit Continue
const POST_COMBAT_REVEAL_DELAY_MS = 2000;
const POST_COMBAT_FADE_START_MS = 1500;
const STARTING_CAMP_SUPPLIES = 2;
const CAMP_HEAL_FRACTION = 0.50;       // Camp Supplies are expedition sustain, not portable inns
const TOWN_LODGING_COST_SC = 10;       // current test-economy price; deliberately not deep-game scaled yet
const CITY_LODGING_COST_SC = 20;
const TAVERN_BOON_IDS = Object.freeze(["whetstone","poultice","makingplan"]);
const BOON_DURATION_MS = 10 * 60 * 1000; // prototype: active delve time; frozen whenever travel is held/interrupted
const BOONS = {
  whetstone:{
    id:"whetstone", name:"Whetstone Work",
    desc:"The first Strike of every fight deals 15% more damage."
  },
  setfeet:{
    id:"setfeet", name:"Set Your Feet",
    desc:"Your Defence Rating is 20% higher."
  },
  poultice:{
    id:"poultice", name:"Poultice",
    desc:"After each kill, recover 5% of Max HP."
  },
  keptwatch:{
    id:"keptwatch", name:"Kept Watch",
    desc:"Your first Read / Study each encounter is quick-use and does not spend your Player Turn."
  },
  makingplan:{
    id:"makingplan", name:"Making a Plan",
    desc:"Gain 20% more XP from defeated enemies."
  }
};
const ABILITY_DEFS = {
  layonhands:{
    id:"layonhands", name:"Lay On Hands", degree:"I", max:2,
    desc:"Heal 15 HP. Quick-use: once per turn, and it does not end your turn.",
    mechanics:"Restore up to 15 HP. Cannot be used at full HP. Quick-use means it costs 0 Stamina and may be used once during each Player Turn.",
    scaling:"No stat scaling at Degree I. The heal is a flat 15 HP."
  },
  holdfast:{
    id:"holdfast", name:"Hold Fast", degree:"I", max:2,
    desc:"Spend the full Player Turn to negate the forecast enemy attack.",
    mechanics:"Only usable when NEXT ENEMY is an attack. Costs the full 3-Stamina Player Turn, deals no damage and completely negates that next attack attempt.",
    scaling:"No stat scaling at Degree I."
  },
  smite:{
    id:"smite", name:"Smite", degree:"I", max:2,
    desc:"Strike with your weapon and Radiant power.",
    mechanics:"Costs the full 3-Stamina Player Turn. Deals a weapon-strength Physical component plus 6 Radiant damage. The Physical part rolls against AC and can be reduced by Guard; the Radiant part still lands through an ordinary miss or Guard.",
    scaling:"Physical damage scales with STR. Radiant damage is flat at Degree I."
  },
  withdraw:{
    id:"withdraw", name:"Withdraw", degree:"I", max:1,
    desc:"Leave the fight immediately with no Run HP cost. You gain no XP or kill rewards.",
    mechanics:"Costs the full 3-Stamina Player Turn and ends the current encounter immediately. No XP, kill reward or Poultice trigger.",
    scaling:"No stat scaling at Degree I."
  },
  concealment:{
    id:"concealment", name:"Concealment", degree:"I", max:2, fieldOnly:true,
    desc:"Enter a concealed travel state for 10 active minutes. Enemy Awareness tests your Stealth before combat begins.",
    mechanics:"While concealed, creatures that fail to detect you can be ambushed or allowed to pass. Ambushing or being detected breaks Concealment. The timer advances only during active travel and freezes during combat or while held.",
    scaling:"Uses your effective Stealth rating against each creature's authored Awareness rating."
  }
};
const ABILITY_ORDER = ["layonhands","holdfast","smite","withdraw"];

const STAT_KEYS = ["STR","CON","DEX","INT","WIS","CHA","RSL"];
const FOLK_TRAITS = {
  "Human":    {adaptive:true, desc:"Adaptable · choose +2 / +1 / −2", flavor:"No single inheritance decides the road ahead."},
  "Half-Elf": {mods:{CHA:2,WIS:1,CON:-1}, flavor:"Between traditions, quick to read people and changing situations."},
  "High-Elf": {mods:{INT:2,DEX:1,STR:-1}, flavor:"Studious and precise, with little reliance on brute strength."},
  "Drow":     {mods:{DEX:2,CHA:1,CON:-1}, flavor:"Quick-footed and forceful in presence, though less hardy."},
  "Orc":      {mods:{STR:2,CON:1,INT:-1}, flavor:"Powerfully built, enduring, and inclined toward direct solutions."},
  "Half-Orc": {mods:{STR:2,WIS:1,CHA:-1}, flavor:"Strong and watchful, more comfortable acting than persuading."},
  "Dwarf":    {mods:{CON:2,STR:1,DEX:-1}, flavor:"Stout and powerful, trading quickness for staying power."},
  "Halfling": {mods:{DEX:2,CHA:1,STR:-1}, flavor:"Quick and personable, but physically slight."}
};
const FOLK_OPTIONS = Object.keys(FOLK_TRAITS);
const TRADE_OPTIONS = [
  "Smith's Apprentice",
  "Merchant's Clerk",
  "Herbalist's Hand",
  "Scribe's Apprentice",
  "Hunter's Hand",
  "Mason's Apprentice",
  "Stablehand",
  "Caravan Hand"
];
const ORIGIN_OPTIONS = ["Market Town","Border Village","River Country","Hill Country","Forest Edge","Old City"];
const STARTING_STATS = {STR:10,CON:10,DEX:10,INT:10,WIS:10,CHA:10,RSL:10};

/* v0.075: Skills are practiced competencies. Class features such as Smite and
   Lay On Hands are Abilities. Skills improve through meaningful use rather than
   being repeatedly clicked in a safe place. */
const SKILL_DEFS = {
  perception:{name:"Perception", stat:"WIS", desc:"Passively notice subtle signs, movement, sounds and things that do not belong."},
  investigation:{name:"Investigation", stat:"INT", desc:"Examine clues, mechanisms, objects and places to understand what is actually there."},
  stealth:{name:"Stealth", stat:"DEX", desc:"Conceal yourself from creature Awareness and control how encounters begin."},
  acrobatics:{name:"Acrobatics", stat:"DEX", desc:"Balance, tumble, squeeze through and control precise movement."},
  athletics:{name:"Athletics", stat:"STR", desc:"Climb, force, haul, jump and overcome obstacles through physical power."},
  survival:{name:"Survival", stat:"WIS", desc:"Read tracks, terrain, signs of danger and the practical conditions of the delve."},
  persuasion:{name:"Persuasion", stat:"CHA", desc:"Win trust, reassure, negotiate and convince someone through presence and honest argument."},
  deception:{name:"Deception", stat:"CHA", desc:"Mislead, bluff and maintain a convincing falsehood under pressure."}
};
const SKILL_ORDER = ["perception","investigation","stealth","acrobatics","athletics","survival","persuasion","deception"];

/* Session 9E: displayed Skill Rank is an Elo-like logarithmic expertise rating.
   A fixed rating gap always means the same relative competence at Rank 10 or 1000.
   Challenges are authored to the identity of the content; depth changes the mix of
   content encountered, never a rusty lock's rating merely because it is deeper. */
const SKILL_RATING_SPREAD = 30;              // +30 rating => about 91% success; -30 => about 9%
const SKILL_APTITUDE_PER_DOUBLING = 8;       // every doubling of the governing attribute contributes +8 effective rating
const SKILL_CHALLENGE_STEP = 8;              // compatibility map for the existing 8–14 authored check scale
const SKILL_XP_BASE = 100;                    // Rank 0 -> 1 begins at roughly ten balanced successes
const SKILL_XP_PER_RANK_GROWTH = 10;          // each later Rank asks for a little more long-term practice
const SKILL_BASE_PRACTICE = 10;
const SKILL_PRACTICE_GROWTH_DIVISOR = 200;    // practice rewards rise slowly as expertise rises
const SKILL_AGAINST_ODDS_PCT = 5;             // any successful check displayed at 5% or lower
const SKILL_AUTO_SUCCESS_CHANCE = 0.99;
const SKILL_AUTO_FAIL_CHANCE = 0.01;
const CONCEALMENT_DURATION_MS = 10 * 60 * 1000;
const UNIVERSAL_ABILITY_IDS = ["concealment"];
const GLINT_EVENT_TRIGGER = 2.5;

function authoredChallenge(base=12){ return (Number(base)-12) * SKILL_CHALLENGE_STEP; }
function sideDiscoveryChallenge(){ return stratumIndex(S?.depth||0)===0 ? authoredChallenge(8) : authoredChallenge(12); }

function stratumIndex(depth=S?.depth || 0){
  return Math.max(0, Math.floor(depth / FATHOMS_PER_STRATUM));
}
function stratumName(index=stratumIndex()){
  if(index < STRATA_NAMED.length) return STRATA_NAMED[index];
  const seed = index * 7919;
  return `The ${STRATA_ADJ[seed % STRATA_ADJ.length]} ${STRATA_NOUN[(seed >> 3) % STRATA_NOUN.length]}`;
}
function formatDepth(depth=S?.depth || 0){
  return Number(depth).toFixed(1);
}
function formatExploreTime(ms=S?.exploreElapsedMs || 0){
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2,"0")}`;
}


/* ============================================================
   STATE
   ============================================================ */
let S = null;      // the delver, and the fight in front of them
let knowledge = {}; // per-archetype Read progress during this delver's run
let armed = null;  // which action is tapped-but-not-yet-committed
let over = false;  // true once you're dead
let hollowTimer = null; // UI countdown for ordinary safe hollows
let healFxTimer = null;
let smiteFxTimer = null;
let creatorDraft = {name:"", folk:null, trade:null, origin:null, className:null, startingLoadout:null, humanPlus2:null, humanPlus1:null, humanMinus2:null};
let combatExpandedAbility = null;
let charExpandedAbility = null;
let charView = "overview";
let equipmentListExpanded = false;
let equipmentInspectSlot = null;
let equipmentInspectItemId = null;
let equipmentInspectTargetSlot = null;
let equipmentInspectExpanded = false;
let equipmentFilter = "all";
let packActiveTab = "backpack";
let packReturnTarget = null;
let backpackFilter = "all";
const packViewScrollTop = {backpack:0,equipment:0};
const packFilterScrollLeft = {backpack:0,equipment:0};
let statPointDraft = Object.fromEntries(STAT_KEYS.map(stat => [stat,0]));
let levelUpNoticeDismissed = false;
let levelUpNoticeDeadline = 0;
let levelUpNoticeFrame = null;
let combatVictoryPending = null;
let combatVictoryTimer = null;
let combatVictoryFadeTimer = null;
let combatLogCollapsed = true;
let combatHistoryOpen = false;

/* Session 8 persistence runtime. */
const SAVE_SCHEMA = 24;
const SAVE_KEY = "lowfathom:run";
const LEGACY_SAVE_KEYS = ["lowfathom:run:v1"];
const SAVE_QUARANTINE_KEY = "lowfathom:run:quarantine";
const ACTIVE_RUN_SLOT_KEY = "lowfathom:active-run-slot";
const RUN_SLOT_KEYS = Object.freeze({1:SAVE_KEY,2:"lowfathom:run:slot2",3:"lowfathom:run:slot3"});
let currentRunSlot = 1;
const SAVE_THROTTLE_MS = 750;
let saveTimer = null;
let lastSaveAt = 0;
let restoringRun = false;
let appSuspended = false;
let suspendedEncounterWarningMs = null;
let suspendedLevelUpNoticeMs = null;
let suspendedHollowResumeMs = null;
let runSaveWritesBlocked = false;
let runSaveLoadIssue = null;

function oldXpToNext(level){
  const L=Math.max(1,Math.floor(Number(level)||1));
  return Math.round(20 + 10*Math.pow(L,1.5));
}
function xpToNext(level=S?.level||1){
  const L=Math.max(1,Math.floor(Number(level)||1));
  return oldXpToNext(2*L-1)+oldXpToNext(2*L);
}
function equipmentItemAttributes(id){
  const def=equipmentItemDef(id);
  const out=Object.fromEntries(STAT_KEYS.map(stat=>[stat,0]));
  if(!def?.attributes || typeof def.attributes!=="object") return out;
  for(const stat of STAT_KEYS) out[stat]=Number(def.attributes[stat])||0;
  return out;
}
function equipmentAttributeTotalsFor(equipmentState=S?.equipment){
  const out=Object.fromEntries(STAT_KEYS.map(stat=>[stat,0]));
  if(!equipmentState) return out;
  for(const slot of EQUIPMENT_SLOT_ORDER){
    if(slot==="leftHand" && equipmentItemUsesBothHands(equipmentState.rightHand)) continue;
    const attrs=equipmentItemAttributes(equipmentState[slot]);
    for(const stat of STAT_KEYS) out[stat]+=attrs[stat]||0;
  }
  return out;
}
function effectiveStatForEquipment(stat,equipmentState=S?.equipment){
  return (Number(S?.[stat])||0)+(equipmentAttributeTotalsFor(equipmentState)[stat]||0);
}
function effectiveStat(stat){ return effectiveStatForEquipment(stat,S?.equipment); }
function maxHp(){
  // Base CON plus equipped CON sets the ceiling. Equipping CON never heals; callers clamp separately.
  return effectiveStat("CON") * 6;
}

/* ============================================================
   v0.109.1 — DERIVED COMBAT STATS

   Attributes are endless; their combat jobs are deliberately bounded or
   progressively more expensive so one secondary stat cannot become the whole
   damage model.
   ============================================================ */
const DEX_CRIT_PER_POINT = 0.075;
const DEX_CRIT_CAP_PCT = 15;
const BASE_CRIT_DAMAGE_PCT = 150;
const BACKSTAB_CRIT_BONUS_PCT = 25;
const D20_CRIT_MIN_ROLL = 20;
const D20_CRIT_MULTIPLIER = 2;
const PRECISION_FIRST_50_COST = 500;
const PRECISION_DAMAGE_BAND_PCT = 50;
const SHIELD_PROTECTION_ARMOR_FACTOR = 0.5;
const BASE_REACTION_PROTECTION = 5;

function trimNumber(value,digits=1){
  const n=Number(value)||0;
  return String(Number(n.toFixed(digits)));
}
function dexCritChanceForEquipment(equipmentState=S?.equipment){
  // 10 DEX is the neutral character baseline, matching WIS -> Precision. Only
  // effective DEX above 10 creates Critical Chance; falling below 10 never
  // creates a negative crit modifier.
  return Math.min(DEX_CRIT_CAP_PCT,Math.max(0,effectiveStatForEquipment("DEX",equipmentState)-10)*DEX_CRIT_PER_POINT);
}
function precisionForEquipment(equipmentState=S?.equipment){
  // 10 WIS is the neutral character baseline and grants 0 Precision. Only WIS
  // above 10 becomes Precision one-for-one; WIS below 10 never makes Precision negative.
  return Math.max(0,effectiveStatForEquipment("WIS",equipmentState)-10);
}
function criticalDamagePctFromPrecision(precision){
  let remaining=Math.max(0,Number(precision)||0),pct=BASE_CRIT_DAMAGE_PCT,cost=PRECISION_FIRST_50_COST,guard=0;
  // First +50pp costs 500 Precision. Each later +50pp costs twice the prior
  // band: 500, 1000, 2000, 4000, ... This keeps severity endless but slow.
  while(remaining>0 && guard++<100000){
    const spend=Math.min(remaining,cost);
    pct+=PRECISION_DAMAGE_BAND_PCT*(spend/cost);
    remaining-=spend;cost*=2;
  }
  return pct;
}
function criticalDamagePctForEquipment(equipmentState=S?.equipment){
  return criticalDamagePctFromPrecision(precisionForEquipment(equipmentState));
}
function shieldProtectionBonusFromItem(item){
  if(!item || item.family!=="shield") return 0;
  return Math.max(0,Math.round((Number(item.armor)||0)*SHIELD_PROTECTION_ARMOR_FACTOR));
}
function shieldProtectionBonusFor(equipmentState=S?.equipment){
  if(!equipmentState || equipmentItemUsesBothHands(equipmentState.rightHand)) return 0;
  return shieldProtectionBonusFromItem(equipmentItemDef(equipmentState.leftHand));
}
function protectionCapacityForEquipment(equipmentState=S?.equipment){
  // CON 10 is the neutral defensive baseline, matching DEX/WIS secondary-stat logic.
  // Full effective CON still drives Max HP; only points above 10 add Protection.
  const conProtection=Math.max(0,effectiveStatForEquipment("CON",equipmentState)-10);
  return Math.max(0,Math.round(BASE_REACTION_PROTECTION+conProtection+shieldProtectionBonusFor(equipmentState)));
}
function protectionCapacity(){ return protectionCapacityForEquipment(S?.equipment); } // parked for future shield/ward abilities

/* ============================================================
   v0.112.0 — ENDLESS d20 ATTACK / AC LAYER

   Raw Attack and Defence Ratings can grow forever. Each doubling advances the
   virtual d20 ladder by two points. The player and enemies use independent
   ratings; AC never changes merely because the opponent changed.
   ============================================================ */
const D20_ATTACK_BASELINE_RATING = 13;
const D20_DEFENCE_BASELINE_RATING = 39;
const D20_BASE_ATTACK_BONUS = 4;
const D20_BASE_AC = 13;
const D20_POINTS_PER_DOUBLING = 2;
const D20_MIN_RATING_FRACTION = 0.25;
const DEFLECTION_BAND_MAX = 0.08;
const PLAYER_TURN_STAMINA = 3;
const COUNTER_AC_BONUS = 4;
const FOE_DODGE_AC_BONUS = 4;
const GUARD_REDUCTION_SHIELD = 0.50;
const GUARD_REDUCTION_OTHER = 0.30;
const FOE_GUARD_REDUCTION = 0.50;
const ATTACK_ACCURACY_MOD = Object.freeze({quick:2,heavy:-2,offquick:0,normal:0});

function ratingLogStep(rating,baseline){
  const base=Math.max(0.0001,Number(baseline)||1);
  const floor=base*D20_MIN_RATING_FRACTION;
  return D20_POINTS_PER_DOUBLING*Math.log2(Math.max(floor,Number(rating)||0)/base);
}
function attackBonusFromRating(rating){
  return Math.floor(D20_BASE_ATTACK_BONUS+ratingLogStep(rating,D20_ATTACK_BASELINE_RATING)+1e-9);
}
function defenceSnapshotFromRating(rating){
  const continuous=D20_BASE_AC+ratingLogStep(rating,D20_DEFENCE_BASELINE_RATING);
  const ac=Math.floor(continuous+1e-9);
  const progress=clamp(continuous-ac,0,0.999999);
  return {rating:Math.max(0,Number(rating)||0),continuous,ac,progress,deflection:progress*DEFLECTION_BAND_MAX};
}
function playerAttackRatingForEquipment(equipmentState=S?.equipment){ return weaponAttackBaseForEquipment(equipmentState); }
function playerAttackRating(){ return weaponAttackBase(); }
function playerAttackBonusForEquipment(equipmentState=S?.equipment){ return attackBonusFromRating(playerAttackRatingForEquipment(equipmentState)); }
function playerAttackBonus(){ return attackBonusFromRating(playerAttackRating()); }
function defenceRatingEffectMultiplier(){
  let mult=1;
  if(boonActive("setfeet")) mult*=1.20;
  if(S?.hollowRespite?.remaining>0) mult*=1.10;
  return mult;
}
function playerDefenceRatingForEquipment(equipmentState=S?.equipment,{includeEffects=false}={}){
  const raw=Math.max(0,D20_DEFENCE_BASELINE_RATING*(effectiveStatForEquipment("RSL",equipmentState)/10));
  return raw*(includeEffects?defenceRatingEffectMultiplier():1);
}
function playerDefenceRating(){ return playerDefenceRatingForEquipment(S?.equipment,{includeEffects:true}); }
function playerDefenceSnapshot(){ return defenceSnapshotFromRating(playerDefenceRating()); }
function playerArmorClass(){ return playerDefenceSnapshot().ac; }
function playerDeflection(){ return playerDefenceSnapshot().deflection; }
function foeAttackRating(foe=S?.foe,depth=S?.depth||0){
  const profile=Math.max(0.1,Number(foe?.profile?.accuracyProfile)||1);
  return expectedPrimaryAtDepth(depth)*profile;
}
function foeDefenceRating(foe=S?.foe,depth=S?.depth||0){
  const profile=Math.max(0.1,Number(foe?.profile?.defenceProfile)||1);
  return expectedMediumArmorAtDepth(depth)*profile;
}
function foeDefenceSnapshot(foe=S?.foe,depth=S?.depth||0){ return defenceSnapshotFromRating(foeDefenceRating(foe,depth)); }
function foeArmorClass(foe=S?.foe,{includeDodge=true}={}){
  return foeDefenceSnapshot(foe).ac+(includeDodge&&foeDodgeActive(foe)?FOE_DODGE_AC_BONUS:0);
}
function enemyAttackBonusForIntent(foe=S?.foe,intent=foe?.intent){
  return attackBonusFromRating(foeAttackRating(foe))+(ATTACK_ACCURACY_MOD[intent]||0);
}
function d20HitChance(attackBonus,armorClass){
  let hits=0;
  for(let roll=1;roll<=20;roll++){
    if(roll===1)continue;
    if(roll===20 || roll+(Number(attackBonus)||0)>=(Number(armorClass)||0))hits++;
  }
  return hits/20;
}
let queuedCombatD20Roll=null;
let combatDiceBusy=false;
let combatDiceGeneration=0;
function cancelCombatDicePresentation(){
  combatDiceGeneration++;
  queuedCombatD20Roll=null;
  if(typeof window.fathomCombatDiceCancel==="function") window.fathomCombatDiceCancel();
}
function consumeQueuedCombatD20(){
  const value=queuedCombatD20Roll;
  queuedCombatD20Roll=null;
  return Number.isFinite(value)?Math.max(1,Math.min(20,Math.round(value))):null;
}
function d20CriticalRangeMinForAction(_key){ return D20_CRIT_MIN_ROLL; }
function rollD20Attack(attackBonus,armorClass,{criticalMin=D20_CRIT_MIN_ROLL}={}){
  const queued=consumeQueuedCombatD20();
  const roll=queued??ri(1,20),total=roll+(Number(attackBonus)||0);
  const hit=roll===20 || (roll!==1 && total>=(Number(armorClass)||0));
  const critFloor=clamp(Math.round(Number(criticalMin)||D20_CRIT_MIN_ROLL),2,20);
  // Expanded ranges stay accuracy-neutral: only a roll that already hit can crit.
  // Natural 20 remains an automatic hit, so the baseline 20 always qualifies.
  const critical=hit&&roll>=critFloor;
  return {roll,bonus:Number(attackBonus)||0,total,ac:Number(armorClass)||0,hit,critical,criticalMin:critFloor,natural20:roll===20,natural1:roll===1,chance:d20HitChance(attackBonus,armorClass)};
}
function attackRollLog(result,attacker="Attack"){
  const sign=result.bonus>=0?"+":"";
  const natural=result.natural20?" · natural 20":result.natural1?" · natural 1":"";
  const crit=result.critical?" · CRITICAL":"";
  return `<p class="note"><b>${esc(attacker)} roll:</b> d20 <b>${result.roll}</b> ${sign}${result.bonus} = <b>${result.total}</b> vs AC <b>${result.ac}</b>${natural}${crit} · <b>${result.hit?"HIT":"MISS"}</b>.</p>`;
}
function playerAccuracyModForAction(_key){ return 0; }
function playerAttackRollForAction(key,{extraMod=0,ignoreDodge=false}={}){
  const ac=foeArmorClass(S?.foe,{includeDodge:!ignoreDodge});
  return rollD20Attack(playerAttackBonus()+playerAccuracyModForAction(key)+extraMod,ac,{criticalMin:d20CriticalRangeMinForAction(key)});
}
function enemyAttackRollForCurrent({extraTargetAc=0}={}){
  const f=S?.foe;
  return rollD20Attack(enemyAttackBonusForIntent(f,f?.intent),playerArmorClass()+Math.round(Number(extraTargetAc)||0),{criticalMin:D20_CRIT_MIN_ROLL});
}
function combatDiceEnabledFor(side){
  const mode=COMBAT_DICE_OPTIONS.includes(settings?.combatDice)?settings.combatDice:DEFAULT_SETTINGS.combatDice;
  return mode==="all" || (mode==="player"&&side==="player");
}
function combatDieScaleSetting(){
  const size=settings?.diceSize;
  return size==="small"?3.4:size==="large"?5.2:4.25;
}
async function rollPhysicalCombatD20({side="player",name="Attack",bonus=0,ac=10,rollKey=""}={}){
  if(!combatDiceEnabledFor(side))return null;
  if(typeof window.fathomCombatDiceRoll!=="function"||window.fathomDiceBoxFailed||window.fathomCombatDiceFailed)return null;
  const generation=combatDiceGeneration;
  try{
    const result=await window.fathomCombatDiceRoll({side,name,bonus:Number(bonus)||0,ac:Number(ac)||0,rollKey:String(rollKey||""),scale:combatDieScaleSetting()});
    // Settings may have changed while Dice Box was resolving. Never allow an
    // already-started physical roll to leak back into combat after Off is chosen.
    if(generation!==combatDiceGeneration||!combatDiceEnabledFor(side))return null;
    return result;
  }catch(err){
    console.error("Combat d20 physical roll failed; resolving with the normal internal d20 instead:",err);
    return null;
  }
}
let playerPhysicalRollSerial=0;
async function queuePlayerPhysicalAttackRoll(key,{extraMod=0,ignoreDodge=false,name=null}={}){
  if(!combatDiceEnabledFor("player"))return;
  const generation=combatDiceGeneration;
  const bonus=playerAttackBonus()+playerAccuracyModForAction(key)+extraMod;
  const ac=foeArmorClass(S?.foe,{includeDodge:!ignoreDodge});
  const rollKey=`player:${Number(S?.turn)||0}:${++playerPhysicalRollSerial}`;
  const physical=await rollPhysicalCombatD20({side:"player",name:name||actionLabel(key),bonus,ac,rollKey});
  if(generation===combatDiceGeneration&&combatDiceEnabledFor("player")&&physical!=null)queuedCombatD20Roll=physical;
}
async function queueEnemyPhysicalAttackRoll({extraTargetAc=0,name=null}={}){
  if(!combatDiceEnabledFor("enemy"))return;
  const generation=combatDiceGeneration;
  const f=S?.foe,bonus=enemyAttackBonusForIntent(f,f?.intent),ac=playerArmorClass()+Math.round(Number(extraTargetAc)||0);
  const rollKey=`enemy:${Number(S?.turn)||0}:${String(f?.intent||"attack")}:${Number(f?.heavyStage)||0}`;
  const physical=await rollPhysicalCombatD20({side:"enemy",name:name||enemyActionDescriptor(f)?.label||"Enemy attack",bonus,ac,rollKey});
  if(generation===combatDiceGeneration&&combatDiceEnabledFor("enemy")&&physical!=null)queuedCombatD20Roll=physical;
}
function playerHitChanceForAction(key,{extraMod=0,ignoreDodge=false}={}){
  return d20HitChance(playerAttackBonus()+playerAccuracyModForAction(key)+extraMod,foeArmorClass(S?.foe,{includeDodge:!ignoreDodge}));
}
function enemyHitChanceForCurrent({extraTargetAc=0}={}){
  if(!enemyAttackIncoming())return 0;
  return d20HitChance(enemyAttackBonusForIntent(S.foe,S.foe.intent),playerArmorClass()+Math.round(Number(extraTargetAc)||0));
}
function defenceDamageReduction(){
  let value=equipmentItemIsShield(S?.equipment?.leftHand)&&!equipmentItemUsesBothHands(S?.equipment?.rightHand)?GUARD_REDUCTION_SHIELD:GUARD_REDUCTION_OTHER;
  return clamp(value,0,0.90);
}
function criticalChanceForEquipment(equipmentState=S?.equipment){
  const gear=equipmentAffixTotalsFor(equipmentState).crit.pct||0;
  return Math.min(100,Math.max(0,dexCritChanceForEquipment(equipmentState)+gear));
}
function criticalChance(){ return criticalChanceForEquipment(S?.equipment); } // live for overworld auto-attacks; legacy modal combat keeps its own natural-20 rule
function criticalDamagePct(){ return criticalDamagePctForEquipment(S?.equipment); } // live for overworld auto-attacks
function legacyCriticalDamageFromBase(base,bonusPct=0){
  return Math.max(0,Math.round((Number(base)||0)*(criticalDamagePct()+Math.max(0,Number(bonusPct)||0))/100));
}
function criticalDamageFromBase(base){
  return Math.max(0,Math.round((Number(base)||0)*D20_CRIT_MULTIPLIER));
}
function equipmentDisplayStatLines(item){
  if(!item) return [];
  const fallback=item.kind==="weapon"
    ? [`${item.stat||"Weapon"} scaling`,`Weapon contribution +${weaponContribution(item).toFixed(1)}`]
    : item.armor?[`Armor +${item.armor}`]
    : STAT_KEYS.filter(stat=>item.attributes?.[stat]).map(stat=>`${stat} +${item.attributes[stat]}`);
  const lines=[...(Array.isArray(item.stats)&&item.stats.length?item.stats:fallback)].filter(Boolean);
  if((item.kind==="weapon" || ["sword","greatsword","axe","dagger","shortsword","bow","wand","staff","unarmed"].includes(item.family)) && !lines.some(line=>/^Speed\b/i.test(String(line)))) lines.push(`Speed ${weaponCombatSpeed(item)}`);
  if(item.family==="shield" && !lines.some(line=>/Guard|Protection/i.test(String(line)))){
    lines.push(`Guard: ${Math.round(GUARD_REDUCTION_SHIELD*100)}% damage reduction`);
  }
  return lines;
}
function syncEquipmentHpCeiling(){
  if(!S) return;
  S.hpMax=maxHp();
  const floor=Number(S.hp)<=0?0:1;
  S.hp=Math.max(floor,Math.min(S.hp,S.hpMax));
}
function knowledgeReads(key){
  return knowledge[key]?.reads || 0;
}
function knowledgeTier(key){
  const reads = knowledgeReads(key);
  if(reads >= 6) return "mastered";
  if(reads >= 3) return "studied";
  if(reads >= 1) return "known";
  return "unknown";
}
function knowledgeDamageTakenMult(key){
  return knowledgeReads(key) >= 3 ? 0.95 : 1;
}
function masteryWeaknessBoost(){
  return S.foe && knowledgeReads(S.foe.key) >= 6 ? 0.05 : 0;
}
function boostedWeaknessMultiplier(mult){
  return mult + masteryWeaknessBoost();
}
function knowledgeSummary(key){
  const reads = knowledgeReads(key);
  if(reads >= 6) return `<b>Mastered · 6/6</b> · take 5% less damage · weakness payoff +5%`;
  if(reads >= 3) return `<b>Studied · ${reads}/6</b> · take 5% less damage · ${6-reads} more ${6-reads === 1 ? "study" : "studies"} to Mastered (+5% weakness payoff)`;
  return `<b>Known · ${reads}/3</b> · ${3-reads} more ${3-reads === 1 ? "study" : "studies"} to Studied (take 5% less damage)`;
}
function spawnWeight(profile, depth){
  if(depth < profile.unlock) return 0;
  // Soft overlapping bands: a species peaks for a while after introduction but
  // never vanishes completely. This is deliberately not infinite-depth solved yet.
  return Math.max(0.5, 2.2 - Math.abs(depth - (profile.unlock + 18))/24);
}
function chooseFoeProfile(){
  const available = FOES.filter(f => S.depth >= f.unlock);

  // Session 3 playtest rule: once a new archetype is unlocked, guarantee its first
  // appearance before returning to the weighted pool. RNG should not hide content
  // that this slice exists to test.
  const unseen = available.find(f => !S.seenFoes[f.id]);
  if(unseen) return unseen;

  return weightedPick(available, f => spawnWeight(f,S.depth));
}
function xpReward(f){
  // v0.203.15: XP scales on the same sublinear endless curve as enemy power.
  // The old (1 + depth/100) multiplier made later versions of the same goblin
  // disproportionately valuable and exploded boss rewards by 500 fathoms.
  const depth=Math.max(0,Number(S.depth)||0);
  const depthFactor=expectedPrimaryAtDepth(depth)/expectedPrimaryAtDepth(0);
  const base = Math.max(1, Math.round(f.profile.xp * depthFactor));
  return boonActive("makingplan") ? Math.max(1, Math.round(base * 1.20)) : base;
}
function folkModifiers(folk, draft=creatorDraft){
  const trait = FOLK_TRAITS[folk];
  const mods = Object.fromEntries(STAT_KEYS.map(k => [k,0]));
  if(!trait) return mods;
  if(trait.adaptive){
    if(draft.humanPlus2) mods[draft.humanPlus2] += 2;
    if(draft.humanPlus1) mods[draft.humanPlus1] += 1;
    if(draft.humanMinus2) mods[draft.humanMinus2] -= 2;
    return mods;
  }
  for(const [stat,val] of Object.entries(trait.mods || {})) mods[stat] = val;
  return mods;
}
function startingStatsForProfile(profile){
  const mods = folkModifiers(profile.folk, profile);
  return Object.fromEntries(STAT_KEYS.map(stat => [stat, STARTING_STATS[stat] + (mods[stat] || 0)]));
}
function folkTraitText(folk){
  const trait = FOLK_TRAITS[folk];
  if(!trait) return "";
  if(trait.adaptive) return "Choose +2 · +1 · −2";
  const bits = Object.entries(trait.mods).sort((a,b) => b[1]-a[1]).map(([stat,val]) => `${stat} ${val > 0 ? "+" : ""}${val}`);
  return bits.join(" · ");
}
function folkFlavorText(folk){
  return FOLK_TRAITS[folk]?.flavor || "";
}
function formatFolkMods(mods){
  return STAT_KEYS.filter(stat => mods?.[stat]).sort((a,b) => (mods[b] || 0) - (mods[a] || 0)).map(stat => {
    const val = mods[stat];
    const cls = val > 0 ? "pos" : "neg";
    return `<span class="${cls}">${stat} ${val > 0 ? "+" : ""}${val}</span>`;
  }).join(" · ");
}
function humanTraitsComplete(draft=creatorDraft){
  const picks = [draft.humanPlus2,draft.humanPlus1,draft.humanMinus2];
  return picks.every(Boolean) && new Set(picks).size === 3;
}

function skillState(id){ return S?.skills?.[id] || null; }
function skillXpNeeded(rank=0){ return Math.max(1,Math.round(SKILL_XP_BASE + SKILL_XP_PER_RANK_GROWTH*Math.max(0,Number(rank)||0))); }
function skillBasePractice(rank=0){ return SKILL_BASE_PRACTICE * (1 + Math.max(0,Number(rank)||0)/SKILL_PRACTICE_GROWTH_DIVISOR); }
function skillAgainstOdds(result){ return !!(result?.success && !result?.automatic && Math.round((Number(result.chance)||0)*100)<=SKILL_AGAINST_ODDS_PCT); }
function signed(n){ return n >= 0 ? `+${n}` : `${n}`; }
function formatRating(n){
  const v=Math.round((Number(n)||0)*10)/10;
  return Number.isInteger(v)?String(v):v.toFixed(1);
}
function skillAptitude(id){
  const def=SKILL_DEFS[id];
  if(!def||!S) return 0;
  const attr=Math.max(1,effectiveStat(def.stat));
  return SKILL_APTITUDE_PER_DOUBLING * Math.log2(attr/10);
}
function skillRating(id,situational=0){
  const st=skillState(id);
  if(!st||!S) return 0;
  return st.rank + skillAptitude(id) + proficiencyBonus(id) + (Number(situational)||0);
}
function skillCheckBonus(id){ return Math.round(skillRating(id)); }
function skillChanceData(id,challenge,situational=0){
  const rating=skillRating(id,situational), cr=Number(challenge)||0;
  const gap=rating-cr, u=gap/SKILL_RATING_SPREAD;
  const chance=1/(1+Math.pow(10,-u));
  const autoSuccess=chance>=SKILL_AUTO_SUCCESS_CHANCE;
  const autoFail=chance<SKILL_AUTO_FAIL_CHANCE;
  let label="Even";
  if(autoSuccess) label="Trivial";
  else if(autoFail) label="Beyond you";
  else if(chance>=.75) label="Favoured";
  else if(chance>=.55) label="Slight edge";
  else if(chance>.45) label="Even";
  else if(chance>=.20) label="Difficult";
  else if(chance>=.05) label="Very difficult";
  else label="Desperate";
  return {id,rating,challenge:cr,gap,normalizedGap:u,chance,autoSuccess,autoFail,label,situational:Number(situational)||0};
}
function percentileRollHighTarget(chance){
  const pct=Math.max(1,Math.min(99,Math.round((Number(chance)||0)*100)));
  return 101-pct;
}
function runSkillCheck(id, challenge, situational=0, rollOverride=null){
  const def=SKILL_DEFS[id], st=skillState(id), data=skillChanceData(id,challenge,situational);
  const threshold=Math.max(1,Math.min(99,Math.round(data.chance*100)));
  const target=percentileRollHighTarget(data.chance);
  let roll=null,success=false,automatic=false;
  if(data.autoSuccess){success=true;automatic=true;}
  else if(data.autoFail){success=false;automatic=true;}
  else {
    // null means "no override". Number(null) is 0, so converting first would
    // accidentally force every ordinary hidden roll to 1 after clamping.
    const hasOverride=rollOverride!==null&&rollOverride!==undefined&&rollOverride!=="";
    const supplied=hasOverride?Number(rollOverride):NaN;
    roll=Number.isFinite(supplied)?Math.max(1,Math.min(100,Math.round(supplied))):ri(1,100);
    success=roll>=target;
  }
  return {...data,id,def,rank:st?.rank||0,aptitude:skillAptitude(id),proficiency:proficiencyBonus(id),threshold,target,roll,success,automatic};
}
function skillCheckPreview(id,challenge,situational=0){
  const d=skillChanceData(id,challenge,situational);
  const pct=Math.round(d.chance*100);
  if(d.autoSuccess) return `<strong class="check-bonus">Automatic success · ${esc(d.label)}</strong>`;
  if(d.autoFail) return `<strong class="check-bonus">Beyond you · automatic failure</strong>`;
  const target=percentileRollHighTarget(d.chance);
  return `<strong class="check-bonus">Need ${target}+ on d100 · ${esc(d.label)} · ${pct}%</strong>`;
}
function formatSkillCheck(result){
  const parts=[`Rank ${result.rank}`,`${result.def.stat} aptitude ${signed(formatRating(result.aptitude))}`];
  if(result.proficiency) parts.push(`proficiency ${signed(result.proficiency)}`);
  if(result.situational) parts.push(`circumstance ${signed(result.situational)}`);
  const pct=Math.round(result.chance*100);
  const resolution=result.automatic
    ? `<b>${result.success?"automatic success":"automatic failure"}</b>`
    : `Need <b>${result.target}+</b> on d100 · rolled <b>${result.roll}</b>`;
  return `<b>${esc(result.def.name)}</b>: ${resolution} · <span class="${result.success?"good":"bad"}">${result.success?"success":"failure"}</span>${result.automatic?"":` · ${esc(result.label)} (${pct}%)`}<br><span class="note">Rank ${result.rank} · ${result.def.stat} aptitude ${signed(formatRating(result.aptitude))}${result.proficiency?` · proficiency ${signed(result.proficiency)}`:""}${result.situational?` · circumstance ${signed(result.situational)}`:""} · effective Rating ${formatRating(result.rating)}</span>`;
}
let fathomDiceBoxFallbackTimer=null;
function stopFathomDiePresentation(){
  if(fathomDiceBoxFallbackTimer){clearTimeout(fathomDiceBoxFallbackTimer);fathomDiceBoxFallbackTimer=null;}
  const layer=$("fathomDiceBoxLayer");
  if(layer){layer.classList.remove("active","loading");layer.setAttribute("aria-hidden","true");}
  if(typeof window.fathomDiceBoxClear==="function") window.fathomDiceBoxClear();
}
function fathomDieScaleSetting(){
  const size=settings?.diceSize;
  // Two d10-shaped dice occupy more room than the old single d20.
  return size==="small"?3.75:size==="large"?6.05:4.85;
}
async function rollFathomPercentile({name="Skill check",target=51,force=false}={}){
  if(!force&&!settings?.diceAnimation) return null;
  if(typeof window.fathomDiceBoxRoll!=="function"||window.fathomDiceBoxFailed) return null;
  try{
    return await window.fathomDiceBoxRoll({name,target,scale:fathomDieScaleSetting()});
  }catch(err){
    console.error("Fathom percentile dice roll failed:",err);
    return null;
  }
}
async function testFathomDie(){
  const physical=await rollFathomPercentile({name:"Dice test",target:51,force:true});
  if(physical==null){
    const fallback=ri(1,100),caption=$("fathomDieCaption"),layer=$("fathomDiceBoxLayer");
    if(layer){layer.classList.add("active");layer.setAttribute("aria-hidden","false");}
    if(caption){
      caption.className=`fathom-roll-caption${fallback>=51?"":" failure"}`;
      caption.innerHTML=`Physical dice unavailable · rolled <strong>${fallback}</strong> · ${fallback>=51?"SUCCESS":"FAILURE"}`;
    }
    fathomDiceBoxFallbackTimer=setTimeout(stopFathomDiePresentation,1500);
  }
}
function testFathomDieForced(value){
  const forced=Math.max(1,Math.min(100,Math.round(Number(value)||1)));
  stopFathomDiePresentation();
  const caption=$("fathomDieCaption"),layer=$("fathomDiceBoxLayer");
  if(layer){layer.classList.add("active");layer.setAttribute("aria-hidden","false");}
  if(caption){
    caption.className=`fathom-roll-caption${forced>=51?"":" failure"}`;
    caption.innerHTML=`Forced test <strong>${forced}</strong> · Need 51+ · ${forced>=51?"SUCCESS":"FAILURE"}`;
  }
  fathomDiceBoxFallbackTimer=setTimeout(stopFathomDiePresentation,1400);
}
async function runActiveSkillCheck(id,challenge,situational=0){
  const data=skillChanceData(id,challenge,situational);
  // Automatic outcomes stay silent, exactly like passive checks.
  if(data.autoSuccess||data.autoFail) return runSkillCheck(id,challenge,situational);
  const target=percentileRollHighTarget(data.chance);
  const physical=await rollFathomPercentile({name:SKILL_DEFS[id]?.name||"Skill check",target});
  // If animation is disabled or 3D dice cannot load, roll the same authoritative
  // hidden d100 normally. Never pass null as an override: Number(null) is 0.
  return physical==null
    ? runSkillCheck(id,challenge,situational)
    : runSkillCheck(id,challenge,situational,physical);
}

function skillPracticeAmount(result){
  if(!result || result.automatic) return 0;
  const rank=Math.max(0,Number(result.rank)||0),base=skillBasePractice(rank),u=Number(result.normalizedGap)||0;
  if(result.success){
    // Balanced success is the anchor. Easier-but-still-uncertain work teaches less;
    // harder success teaches more. The learning value grows slowly with Rank.
    const multiplier=u>=0 ? clamp(1-u*.35,.25,1) : 1+Math.min(2.5,-u);
    let amount=base*multiplier;
    if(skillAgainstOdds(result)) amount=amount*2 + base*.5;
    return Math.max(1,Math.round(amount));
  }
  // Failure teaches most near an even contest and fades to zero near displayed
  // 5%/95% extremes, so hopeless failure is never the optimal practice strategy.
  const chance=clamp(Number(result.chance)||0,0,1),displayPct=Math.round(chance*100);
  if(displayPct<=SKILL_AGAINST_ODDS_PCT || displayPct>=95) return 0;
  const relevance=clamp(1-Math.abs(chance-.5)/.45,0,1);
  return Math.max(0,Math.round(base*.4*relevance));
}
function ensureSkillDiagnostics(){
  if(!S) return {};
  if(!S.skillDiagnostics || typeof S.skillDiagnostics!=="object" || Array.isArray(S.skillDiagnostics)) S.skillDiagnostics={};
  for(const id of SKILL_ORDER){
    const d=S.skillDiagnostics[id];
    S.skillDiagnostics[id]=(d&&typeof d==="object"&&!Array.isArray(d))?d:{attempts:0,successes:0,failures:0,automatic:0,xp:0,againstOdds:0};
    for(const key of ["attempts","successes","failures","automatic","xp","againstOdds"]) S.skillDiagnostics[id][key]=Math.max(0,Number(S.skillDiagnostics[id][key])||0);
  }
  return S.skillDiagnostics;
}
function recordSkillDiagnostic(id,result,amount){
  if(!S?.skills?.[id] || !result || typeof result!=="object") return;
  const d=ensureSkillDiagnostics()[id];
  d.attempts++;
  if(result.success)d.successes++;else d.failures++;
  if(result.automatic)d.automatic++;
  d.xp+=Math.max(0,Number(amount)||0);
  if(skillAgainstOdds(result))d.againstOdds++;
}
function awardSkillPractice(id, source, result=null){
  if(!S?.skills?.[id]) return {awarded:false,levelled:false};
  if(!S.skillPracticeSources[source]) S.skillPracticeSources[source]={};
  if(S.skillPracticeSources[source][id]) return {awarded:false,levelled:false};
  S.skillPracticeSources[source][id]=true;
  const amount=typeof result==="number"?Math.max(0,Math.round(result)):skillPracticeAmount(result);
  recordSkillDiagnostic(id,result,amount);
  const st=S.skills[id], beforeRank=st.rank;
  if(amount>0) st.xp+=amount;
  while(st.xp>=skillXpNeeded(st.rank)){
    st.xp-=skillXpNeeded(st.rank);
    st.rank++;
  }
  const levelled=st.rank>beforeRank;
  if(levelled) markSkillRankNotice(id);
  return {awarded:amount>0,amount,levelled,againstOdds:skillAgainstOdds(result),rank:st.rank,xp:st.xp,next:skillXpNeeded(st.rank)};
}
function practiceText(id, practice){
  if(!practice?.awarded) return "";
  const name=SKILL_DEFS[id].name, odds=practice.againstOdds?`<b>Against the Odds.</b> `:"";
  return practice.levelled
    ? `<br><span class="good">${odds}${esc(name)} +${practice.amount} XP · increased to Rank ${practice.rank}.</span>`
    : `<br><span class="good">${odds}${esc(name)} +${practice.amount} XP · ${practice.xp}/${practice.next}</span>`;
}

function newDelver(profile){
  stopEncounterWarningFrame();
  clearCombatTransitionTimers();
  encounterWarningState = null;
  travelLogExpanded = false;
  const fade = $("combatTransition");
  if(fade){ fade.hidden = true; fade.classList.remove("fade-in"); }

  statPointDraft = Object.fromEntries(STAT_KEYS.map(stat => [stat,0]));
  stopLevelUpNoticeFrame();
  levelUpNoticeDeadline = 0;
  levelUpNoticeDismissed = false;
  clearCombatVictoryTimer();
  combatVictoryPending = null;

  const chosen = profile || {name:"Leofrun Fenwick",folk:"Orc",trade:"Smith's Apprentice",origin:"Market Town"};
  const cls = chosen.className || creatorDraft.className || "Votary";
  const classInfo = CLASS_DEFS[cls] || CLASS_DEFS.Votary;
  const loadoutId = chosen.startingLoadout || creatorDraft.startingLoadout || startingLoadoutOptions(cls)[0]?.id;
  const starting = startingStatsForProfile(chosen);
  const startingFolkMods = folkModifiers(chosen.folk, chosen);
  const startingEquipment = startingEquipmentLoadout(cls,null,loadoutId);
  const startingEquipmentBag = startingEquipmentBackpack(cls);

  S = {
    name:chosen.name, folk:chosen.folk, trade:chosen.trade, origin:chosen.origin,
    charNotices:{overview:false,status:false,skills:false,equipment:false,bestiary:false,abilities:false,quests:false,journal:false},
    skillRankNotices:{},
    folkChoices:chosen.folk === "Human" ? {plus2:chosen.humanPlus2,plus1:chosen.humanPlus1,minus2:chosen.humanMinus2} : null,
    folkMods:{...startingFolkMods},
    level:1, xp:0, statPoints:0, kills:0, gold:0,
    STR:starting.STR, CON:starting.CON, DEX:starting.DEX, INT:starting.INT, WIS:starting.WIS, CHA:starting.CHA, RSL:starting.RSL,
    hpMax:0, hp:0, staminaMax:3, stamina:3, reactionMax:3, reactionPoints:3, protection:0, protectionMax:0,
    combatResources:{energy:100,focus:0,mana:100}, worldCombatGuardUntil:0, worldCombatQueuedPower:null,
    heavyCharge:0, strikeChain:0, defenceChain:0,
    loadout:cls === "Votary" ? (equipmentItemIsShield(startingEquipment.leftHand)?"shield":"sword") : cls === "Rogue" ? "rogue" : "staff",
    depth:0, encounter:0, seenFoes:{}, seenTravelEvents:{}, travelEvent:null,
    exploreActivity:0, exploreElapsedMs:0, exploreDepth:0,
    skills:Object.fromEntries(SKILL_ORDER.map(id => [id,{rank:0,xp:0}])), skillPracticeSources:{}, skillDiagnostics:{},
    travelMode:"stopped", travelSinceEvent:0, travelLog:[], restRecovery:REST_RECOVERY_REQUIRED,
    runPacing:{foregroundMs:0,movementMs:0,milestones:{}},
    inventory:{
      campSupplies:STARTING_CAMP_SUPPLIES, bandages:1, meat:0, rope:0, water:1,
      rogueTools:cls==="Rogue"?1:0, lexicon:cls==="Wizard"?1:0, reliquary:cls==="Votary"?1:0,
      misc:{}, questItems:[], weapons:[], equipment:[...startingEquipmentBag], passageKey:null
    },
    generatedItems:{},
    equipment:{...startingEquipment},
    hollowStates:{}, activeHollow:null, boon:null, pendingBoonChoice:false, pendingRestAbilityChoice:false,
    abilityQuickUsed:false, className:classInfo.name, proficiencies:{...classInfo.proficiencies},
    specialization:classInfo.specialization, equippedWeapon:startingEquipment.rightHand,
    abilities:Object.fromEntries([...new Set([...classInfo.abilities,...UNIVERSAL_ABILITY_IDS])].map(id=>[id,{cur:ABILITY_DEFS[id].max,max:ABILITY_DEFS[id].max,degree:ABILITY_DEFS[id].degree}])),
    languageKnown:cls==="Wizard"?["Cor"]:[],
    sideArea:null, sideDiscoveryStratum:0, sideDiscoveryAt:ri(15,30), sideDiscoveryAttempted:false,
    sideAreaResolved:false, sideAreaHistory:[],
    curse:null, bleeding:false, bleedRemainingMs:0, bleedAccumulatorMs:0, bleedCombatTurns:0, bossDefeated:{}, midBossDefeated:{}, midBossVariants:{}, packMode:null,
    runAttemptStratum:0, runAttempts:0,
    descentXpMaxDepth:0, descentXpPending:0,
    lootHistory:[], pendingLoot:null, combatLog:[], concealment:null, stealthOpportunitySeq:0,pendingMerchant:null,merchantVisits:0,merchantHistory:[],
    caravans:{pending:null,history:[],routeRolls:{},warning:null,nextSerial:1,activeMerchant:null},
    interactionState:{active:null,pending:null,nextSerial:1},
    temporaryCompanion:null,
    townState:{currentId:null,visited:{},departed:{},services:{}},
    quests:{instances:[],nextSerial:1,exploreAccumulator:0},
    turn:1, combatActor:"player", combatExtraTurns:{player:0,enemy:0}, combatTimeline:null, reactionMax:3, reactionPoints:3, reactionAvailable:false, reactionWindow:false, protectionMax:0, protectionSource:null, defencePrepared:null, negateNextAttack:null, foe:null
  };

  S.hpMax = maxHp();
  S.hp = S.hpMax;
  knowledge = {};
  armed = null;
  over = false;
  selectedLootHistoryId = null;
  combatLogCollapsed = true;
  clearHollowTimer();
  closeLootHistory();
  document.querySelectorAll(".dead").forEach(n => n.remove());
  $("creator").hidden = true;
  $("readout").innerHTML = "";
  $("travelLog").innerHTML = "";
  $("packSheet").hidden = true;
  $("sheet").hidden = true;
  $("restAbilityPick").hidden = true;
  $("charSheet").hidden = true;

  travelLogAdd(`The way down waits. Choose how you want to move.`, "note");
  say(`<p class="note">The way down waits. Choose how you want to move.</p>`);
  travelLogAdd(`<b>${esc(classInfo.name)}</b> specialization: ${esc(classInfo.specialization)}.`,"good");
  travelLogAdd(`Starting kit: <b>${esc(equipmentItemDef(startingEquipment.rightHand)?.name||"Unarmed")}</b>${startingEquipment.leftHand?` + <b>${esc(equipmentItemDef(startingEquipment.leftHand)?.name||"")}</b>`:""} · Salvage Top · Salvage Bottoms · Salvage Boots.`,"note");
  if(cls==="Rogue") travelLogAdd(`Rogue proficiency: <b>+5 Sleight of Hand Rating</b>. Rogue Tools are packed and ready.`,"note");
  if(cls==="Wizard") travelLogAdd(`Wizard proficiency: <b>+5 Translation Rating</b>. Your lexicon already identifies one word of the old tongue.`,"note");

  // A new chronicle must also reset the persistent Canvas-world runtime.
  // The world object outlives character creation, so relying on inferred run
  // changes can leak the previous delver's x/y/deepest/minimap state.
  try{window.LowfathomWorldBridge?.resetForNewRun?.();}catch(err){console.error("World reset for new delver failed",err);}
  renderTravelLogCollapse();
  render();
}

function creatorComplete(){
  const basics = creatorDraft.name.trim().length > 0 && !!creatorDraft.folk && !!creatorDraft.trade && !!creatorDraft.origin;
  if(!basics) return false;
  if(creatorDraft.folk === "Human" && !humanTraitsComplete()) return false;
  return !!creatorDraft.className && !!creatorDraft.startingLoadout;
}
function renderCreatorChoices(id, options, key){
  const root = $(id);
  root.innerHTML = options.map(value => {
    const selected = creatorDraft[key] === value;
    if(key === "folk"){
      const trait = folkTraitText(value);
      const lines = trait.split(" · ").map(line => {
        const decorated = line.replace(/([A-Z]{3} \+\d)/g,'<span class="pos">$1</span>').replace(/([A-Z]{3} [−-]\d)/g,'<span class="neg">$1</span>');
        return `<span class="folk-meta-line">${decorated}</span>`;
      }).join("");
      return `<button class="creator-choice folk-card ${selected ? "selected" : ""}" data-creator-key="${key}" data-creator-value="${esc(value)}"><b>${esc(value)}</b><span class="folk-meta">${lines}</span></button>`;
    }
    return `<button class="creator-choice ${selected ? "selected" : ""}" data-creator-key="${key}" data-creator-value="${esc(value)}"><b>${esc(value)}</b></button>`;
  }).join("");
}
function renderHumanTraitRow(id, key){
  const root = $(id);
  if(!root) return;
  const usedElsewhere = new Set([creatorDraft.humanPlus2,creatorDraft.humanPlus1,creatorDraft.humanMinus2].filter(Boolean));
  const own = creatorDraft[key];
  root.innerHTML = STAT_KEYS.map(stat => {
    const unavailable = usedElsewhere.has(stat) && stat !== own;
    return `<button class="creator-human-stat ${own === stat ? "selected" : ""}" data-human-trait="${key}" data-human-stat="${stat}" ${unavailable ? "disabled" : ""}>${stat}</button>`;
  }).join("");
}
function creatorStatsAndMods(){
  const mods = creatorDraft.folk ? folkModifiers(creatorDraft.folk) : Object.fromEntries(STAT_KEYS.map(k=>[k,0]));
  const stats = Object.fromEntries(STAT_KEYS.map(stat => [stat, STARTING_STATS[stat] + (mods[stat] || 0)]));
  return {stats,mods};
}
function renderCreator(){
  if(!$("creator")) return;
  $("creatorName").value = creatorDraft.name;
  renderCreatorChoices("folkChoices", FOLK_OPTIONS, "folk");
  renderCreatorChoices("tradeChoices", TRADE_OPTIONS, "trade");
  renderCreatorChoices("originChoices", ORIGIN_OPTIONS, "origin");

  const human = creatorDraft.folk === "Human";
  const flavor = folkFlavorText(creatorDraft.folk);
  $("folkFlavor").hidden = !flavor;
  $("folkFlavor").textContent = flavor;
  $("humanTraits").hidden = !human;
  if(human){
    renderHumanTraitRow("humanPlus2","humanPlus2");
    renderHumanTraitRow("humanPlus1","humanPlus1");
    renderHumanTraitRow("humanMinus2","humanMinus2");
  }

  const {stats,mods} = creatorStatsAndMods();
  $("creatorStats").innerHTML = STAT_KEYS.map(stat => {
    const mod = mods[stat] || 0;
    const cls = mod > 0 ? "pos" : mod < 0 ? "neg" : "";
    const delta = mod ? `${mod > 0 ? "+" : ""}${mod} Folk` : "";
    return `<div class="creator-stat"><span>${stat}</span><b>${stats[stat]}</b><small class="${cls}">${delta}</small></div>`;
  }).join("");
  $("creatorHp").textContent = `${stats.CON * 6} HP`;

  const root=$("classChoices");
  if(root){
    root.innerHTML = CLASS_ORDER.map(name => {
      const d=CLASS_DEFS[name], selected=creatorDraft.className===name;
      return `<button class="creator-choice class-card ${selected?"selected":""}" data-class-choice="${name}"><b>${esc(name)}</b><span>${esc(d.short)}<br>Starts with ${esc(d.specialization)}</span></button>`;
    }).join("");
  }
  const d=creatorDraft.className ? CLASS_DEFS[creatorDraft.className] : null;
  if($("classFlavor")){
    $("classFlavor").hidden=!d;
    $("classFlavor").textContent=d ? `${d.flavor} Specialization: ${d.specialization}.` : "";
  }
  if($("creatorClass")) $("creatorClass").textContent=d?.name || "—";

  const loadoutSection=$("startingLoadoutSection"), loadoutRoot=$("startingLoadoutChoices");
  if(loadoutSection) loadoutSection.hidden=!d;
  if(loadoutRoot){
    const opts=d?startingLoadoutOptions(d.name):[];
    if(d && creatorDraft.startingLoadout && !opts.some(opt=>opt.id===creatorDraft.startingLoadout)) creatorDraft.startingLoadout=null;
    loadoutRoot.innerHTML=opts.map(opt=>`<button class="creator-choice class-card ${creatorDraft.startingLoadout===opt.id?"selected":""}" data-starting-loadout="${esc(opt.id)}"><b>${esc(opt.label)}</b><span>${esc(opt.sub)}</span></button>`).join("");
  }

  const complete=creatorComplete();
  $("btnSignFate").disabled=!complete;
  if(!creatorDraft.name.trim() || !creatorDraft.folk || !creatorDraft.trade || !creatorDraft.origin){
    $("creatorReadyText").textContent="name, folk, trade and origin required";
  } else if(human && !humanTraitsComplete()){
    $("creatorReadyText").textContent="choose Human +2, +1 and −2 attributes";
  } else if(!creatorDraft.className){
    $("creatorReadyText").textContent="choose a class";
  } else if(!creatorDraft.startingLoadout){
    $("creatorReadyText").textContent="choose a Salvage starting kit";
  } else {
    $("creatorReadyText").textContent=`${creatorDraft.className} · ${creatorDraft.folk} · ${creatorDraft.trade}`;
  }
}
function openCreator({keepChoices=true}={}){
  pauseBoonClock?.();
  if(!keepChoices) creatorDraft = {name:"",folk:null,trade:null,origin:null,className:null,startingLoadout:null,humanPlus2:null,humanPlus1:null,humanMinus2:null};
  else creatorDraft.name = "";
  document.querySelectorAll(".dead").forEach(n => n.remove());
  if($("townScreen")) $("townScreen").hidden=true;
  $("creator").hidden = false;
  renderCreator();
  setTimeout(() => $("creatorName")?.focus(), 0);
}
function signFate(){
  if(!creatorComplete()) return;
  const profile={
    name:creatorDraft.name.trim(), folk:creatorDraft.folk, trade:creatorDraft.trade, origin:creatorDraft.origin,
    className:creatorDraft.className, startingLoadout:creatorDraft.startingLoadout,
    humanPlus2:creatorDraft.humanPlus2, humanPlus1:creatorDraft.humanPlus1, humanMinus2:creatorDraft.humanMinus2
  };
  newDelver(profile);
  saveRunNow();
}
function boonDef(id=S?.boon?.id){
  return id ? BOONS[id] || null : null;
}
function boonRemainingMs(){
  if(!S?.boon) return 0;
  if(S.boon.frozen) return Math.max(0, S.boon.remainingMs || 0);
  return Math.max(0, (S.boon.expiresAt || 0) - Date.now());
}
function formatBoonTime(ms){
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const sec = total % 60;
  return `${m}:${String(sec).padStart(2,"0")}`;
}
function boonActive(id){
  return !!S?.boon && S.boon.id === id && boonRemainingMs() > 0;
}
function removeBoonEffects(){
  if(!S?.boon) return;
  // Oiled Joints was retired with active-combat Stamina in v0.111.1.
}
function clearBoon(expired=false){
  if(!S?.boon) return false;
  const old = boonDef();
  removeBoonEffects();
  S.boon = null;
  if(expired && old) travelLogAdd(`<b>${esc(old.name)}</b> fades.`, "note");
  return true;
}
function checkBoonExpiry(){
  if(!S?.boon || S.boon.frozen) return false;
  if(boonRemainingMs() > 0) return false;
  return clearBoon(true);
}
function pauseBoonClock(){
  checkBoonExpiry();
  if(!S?.boon || S.boon.frozen) return;
  S.boon.remainingMs = boonRemainingMs();
  S.boon.expiresAt = null;
  S.boon.frozen = true;
}
function resumeBoonClock(){
  if(!S?.boon || !S.boon.frozen) return;
  if((S.boon.remainingMs || 0) <= 0){ clearBoon(true); return; }
  S.boon.expiresAt = Date.now() + S.boon.remainingMs;
  S.boon.remainingMs = 0;
  S.boon.frozen = false;
}
function activateBoon(id){
  const def = BOONS[id];
  if(!def || !S) return;
  const fromTavern=!!currentTown();
  clearBoon(false);
  const running = S.travelMode === "descend" || S.travelMode === "explore";
  S.boon = running
    ? {id, expiresAt:Date.now()+BOON_DURATION_MS, remainingMs:0, frozen:false}
    : {id, expiresAt:null, remainingMs:BOON_DURATION_MS, frozen:true};
  S.pendingBoonChoice = false;
  travelLogAdd(`${fromTavern?"Lodging":"Camp"} boon: <b>${esc(def.name)}</b>.`, "good");
  render();
}
function poulticeHealAmount(){
  return Math.max(1, Math.round(S.hpMax * 0.05));
}
function renderBoonChoice(){
  const picker = $("boonPick");
  if(!picker) return;
  picker.hidden = !S?.pendingBoonChoice || over;
  if(picker.hidden) return;
  const tavern=!!currentTown();
  const options=tavern?TAVERN_BOON_IDS.map(id=>BOONS[id]).filter(Boolean):Object.values(BOONS);
  if($("boonPickKind")) $("boonPickKind").textContent=tavern?"Lodging boon":"Camp boon";
  if($("boonPickTitle")) $("boonPickTitle").textContent=tavern?"Choose how you spend the evening":"Choose how you prepare";
  if($("boonPickText")) $("boonPickText").textContent="One boon active at a time · 10 minutes of active delve time · paused whenever you are not Descending or Exploring.";
  if($("boonPickNote")) $("boonPickNote").textContent=tavern
    ? "A paid room fully restores you and offers a smaller preparation list than making camp."
    : "Camp restores 50% of Max HP and all ability uses; the full camp boon list remains available.";
  $("boonOptions").innerHTML = options.map(b =>
    `<button class="boon-opt" data-boon="${b.id}"><b>${esc(b.name)}</b><span>${esc(b.desc)}</span></button>`
  ).join("");
}
function renderActiveBoon(){
  const def = boonDef();
  const remaining = boonRemainingMs();
  const text = def ? `${def.name} · ${formatBoonTime(remaining)}${S.boon.frozen ? " · paused" : ""}` : "";
  for(const [wrapId,textId] of [["travelBoon","travelBoonTxt"],["combatBoon","combatBoonTxt"]]){
    const wrap=$(wrapId), txt=$(textId);
    if(!wrap || !txt) continue;
    wrap.hidden = !def;
    txt.textContent = text;
  }
}
function triggerHealFx(amount, targets=["combat"]){
  if(!amount || amount <= 0) return;
  const seen = new Set();
  const roots = [];
  for(const target of targets){
    const root = target === "travel" ? $("travelHp")?.parentElement
      : target === "character" ? $("charHpBar")
      : $("heroBar");
    if(root && !seen.has(root)){
      seen.add(root);
      roots.push(root);
    }
  }
  roots.forEach(root => {
    root.classList.remove("healing");
    root.classList.add("healing");
    root.querySelectorAll(".heal-pop,.heal-pluses").forEach(n => n.remove());

    const pop = document.createElement("div");
    pop.className = "heal-pop";
    pop.innerHTML = `<span class="heal-label">+${amount}</span>`;
    root.appendChild(pop);

    const pluses = document.createElement("div");
    pluses.className = "heal-pluses";
    pluses.innerHTML = [
      `<span class="heal-plus" style="left:7%;top:-4px;animation-delay:0s">+</span>`,
      `<span class="heal-plus" style="left:27%;top:-10px;animation-delay:.04s">+</span>`,
      `<span class="heal-plus" style="left:48%;top:-3px;animation-delay:.08s">+</span>`,
      `<span class="heal-plus" style="left:69%;top:-9px;animation-delay:.12s">+</span>`,
      `<span class="heal-plus" style="left:87%;top:-2px;animation-delay:.16s">+</span>`
    ].join("");
    root.appendChild(pluses);

    setTimeout(() => {
      root.classList.remove("healing");
      pop.remove();
      pluses.remove();
    }, 850);
  });
}
function triggerSmiteFx(){
  const sprite = $("foeSprite");
  if(!sprite) return;
  sprite.classList.remove("smite-flare");
  // Force a reflow so repeated Smites restart the animation cleanly.
  void sprite.offsetWidth;
  sprite.classList.add("smite-flare");
  if(smiteFxTimer !== null) clearTimeout(smiteFxTimer);
  smiteFxTimer = setTimeout(() => {
    sprite.classList.remove("smite-flare");
    smiteFxTimer = null;
  }, 760);
}

function flashTravelDamage(){
  const card=$("travelHeroCard");
  if(!card) return;
  card.classList.remove("damage-flash");
  void card.offsetWidth;
  card.classList.add("damage-flash");
  setTimeout(()=>card.classList.remove("damage-flash"),600);
}

function restoreAllAbilities(){ for(const id of classAbilityOrder()){ const sk=abilityState(id); if(sk) sk.cur=sk.max; } }
function recoverOneAbilityUse(id){
  const sk = abilityState(id);
  if(!sk || sk.cur >= sk.max) return false;
  sk.cur++;
  return true;
}
function abilityDisplayName(id){
  const def = ABILITY_DEFS[id];
  const sk = abilityState(id);
  return `${def.name} ${sk?.degree || def.degree}`;
}
function closeAbilitySheet(){ $("sheet").hidden = true; }
function closeRestAbilityPick(){
  if(!S) return;
  S.pendingRestAbilityChoice = false;
  $("restAbilityPick").hidden = true;
}
function renderRestAbilityPick(){
  const picker=$("restAbilityPick"); if(!picker) return;
  const show=!!S?.pendingRestAbilityChoice&&!over; picker.hidden=!show; if(!show) return;
  $("restAbilityOptions").innerHTML=classAbilityOrder().filter(id=>{const sk=abilityState(id);return sk&&sk.cur<sk.max;}).map(id=>{
    const sk=abilityState(id),def=ABILITY_DEFS[id];
    return `<button class="restskill-opt" data-recover-ability="${id}"><b>${esc(def.name)} ${esc(sk.degree)}</b><span>${sk.cur}/${sk.max} uses ready → ${Math.min(sk.max,sk.cur+1)}/${sk.max} after Rest</span></button>`;
  }).join("");
}
function abilityDetailHtml(def){
  return `<p><b>Mechanics</b><span>${esc(def.mechanics)}</span></p><p><b>Scaling</b><span>${esc(def.scaling)}</span></p>`;
}
function renderAbilitySheet(){
  const list=$("abilitiesList"); if(!list||!S) return;
  const head=document.querySelector("#sheet .sheet-head h2"); if(head) head.textContent=`${S.className} Abilities`;
  $("sheetSlots").textContent=`${combatAbilityUsesReady()} / ${combatAbilityUsesMax()} uses ready`;
  $("abilitySummary").textContent=`${combatAbilityUsesReady()} / ${combatAbilityUsesMax()} ready`;
  list.innerHTML=combatAbilityOrder().map(id=>{
    const def=ABILITY_DEFS[id],sk=abilityState(id),unusable=!!combatVictoryPending||classAbilityDisabled(id),open=combatExpandedAbility===id;
    let meta=`${sk.cur}/${sk.max} uses ready`;
    if(["layonhands","mend"].includes(id)&&S.hp>=S.hpMax) meta+=` · full HP`;
    if(["layonhands","mend"].includes(id)&&S.abilityQuickUsed) meta+=` · once per turn`;
    if(["holdfast","slip","ward"].includes(id)&&S.foe&&enemyActionDescriptor()?.kind!=="attack") meta+=` · no attack to answer`;
    if(sk.cur<=0) meta=`0/${sk.max} uses ready · spent`;
    return `<div class="skill-wrap"><button class="skill ${sk.cur<=0?"spent":""}" data-ability="${id}" ${unusable?"disabled":""}><span class="meta">${esc(meta)}</span><b>${esc(def.name)} ${esc(sk.degree)}</b><p>${esc(def.desc)}</p></button><button class="skill-more" data-ability-more="${id}">${open?"Hide details":"See more"}</button><div class="skill-detail" ${open?"":"hidden"}>${abilityDetailHtml(def)}</div></div>`;
  }).join("");
}
function statPointDraftTotal(){
  return STAT_KEYS.reduce((total,stat) => total + Math.max(0,statPointDraft[stat] || 0),0);
}
function availableStatPoints(){
  return Math.max(0,(S?.statPoints || 0) - statPointDraftTotal());
}
function statPointHint(stat){
  return ({STR:"physical power + Athletics",CON:"Max HP",DEX:"finesse + DEX Skills + Crit",INT:"arcane power + INT Skills",WIS:"Perception + Precision",CHA:"social / conviction",RSL:"Defence Rating / chance to be hit"})[stat] || "";
}
function combatEstimateRange(base,mult,swingMax){
  const lo=Math.max(1,Math.round(base*mult));
  const hi=Math.max(lo,Math.round(base*mult+swingMax));
  const avg=Math.max(1,Math.round(base*mult+swingMax/2));
  return {lo,hi,avg};
}
function neutralCounterEstimate(perfect=false){
  if(!S)return 0;
  if(S.className==="Votary"){
    const shield=S.loadout==="shield";
    const mult=perfect?(shield?0.75:1.25):(shield?0.35:0.75);
    return Math.max(1,Math.round(effectiveStat("STR")*mult));
  }
  const stat=S.className==="Rogue"?effectiveStat("DEX"):S.className==="Wizard"?effectiveStat("INT"):effectiveStat("STR");
  return Math.max(1,Math.round(stat*(perfect?1.05:0.55)));
}
function renderCharacterCombatStats(){
  const root=$("charCombatStats");if(!root||!S)return;
  const attack=playerAttackRating(),defence=playerDefenceRating(),armor=equipmentArmorFor(),mitigation=armorMitigation();
  const basicMax=Math.max(1,Math.round(weaponAttackBase()*0.80)),basicMin=Math.max(1,Math.floor(basicMax*0.75));
  const aff=equipmentAffixTotals(),atkStat=attackStatKey(),atkValue=attackStatValue(),weapon=equippedWeaponDef(),weaponPart=weaponContribution(weapon);
  const dexCrit=dexCritChanceForEquipment(),gearCrit=aff.crit.pct||0,totalCrit=criticalChance();
  const precision=precisionForEquipment(),critDamage=criticalDamagePct(),rsl=effectiveStat("RSL");
  const fmtPct=(n,d=1)=>`${trimNumber(Math.max(0,Number(n)||0),d)}%`;
  const spec=worldCombatPowerSpec(),primary=weaponPrimaryResource();
  const rows=[
    {label:"Attack Rating",value:trimNumber(attack,1),sub:`${atkStat} ${atkValue} and weapon contribution ${Number.isInteger(weaponPart)?weaponPart:weaponPart.toFixed(1)} set your offensive rating. Realtime accuracy compares this directly with enemy Defence Rating.`,cls:"offense"},
    {label:"Basic Attack",value:`${basicMin}–${basicMax} raw damage`,sub:`Successful Basics roll 75–100% of an 80% Basic Max Hit, keeping the old average while tightening ordinary RNG. Armor and Crit resolve afterward.`,cls:"offense"},
    {label:spec.label,value:`${trimNumber(spec.mult,2)}× committed power`,sub:`Uses ${cap(primary)}. Heavy/Finisher behavior remains immediate; Mana power is typed magic so physical Armor does not reduce it.`,cls:"offense"},
    {label:"Defence Rating",value:trimNumber(defence,1),sub:`RSL ${rsl} × 3.9${defenceRatingEffectMultiplier()!==1?` × temporary effects ${trimNumber(defenceRatingEffectMultiplier(),2)}`:""}. Defence Rating changes the chance enemies connect; Armor does not.`,cls:"defense"},
    {label:"RSL · Resilience",value:String(rsl),sub:`Your avoidance attribute. Base RSL 10 gives 39 Defence Rating before temporary effects.`,cls:"defense"},
    {label:"Armor",value:trimNumber(armor,0),sub:`Total equipped Armor. Armor reduces physical damage only after an attack successfully connects.`,cls:"defense"},
    {label:"Physical Damage Reduction",value:fmtPct(mitigation*100,1),sub:`At this depth, Armor equal to the expected medium benchmark gives about 28.57% mitigation. Successful hits are always clamped to at least 1 final damage.`,cls:"defense"},
    {label:"Guard",value:`${Math.round(WORLD_COMBAT_GUARD_REDUCTION*100)}% after Armor`,sub:`Costs ${WORLD_COMBAT_GUARD_COST} Energy and reduces the next incoming physical hit after Armor mitigation.`,cls:"defense"},
    {label:"Critical Chance",value:fmtPct(totalCrit,2),sub:`${fmtPct(dexCrit,2)} from DEX + ${fmtPct(gearCrit,2)} from equipped Crit gear. Crit rolls only after accuracy succeeds.`,cls:"utility"},
    {label:"Critical Damage",value:fmtPct(critDamage,1),sub:`Base 150%. WIS above 10 becomes Precision; each +50 percentage-point band costs twice as much Precision as the previous one.`,cls:"utility"},
    {label:"Precision",value:trimNumber(precision,0),sub:`Precision = max(0, effective WIS − 10). It raises Crit Damage, not Crit Chance.`,cls:"utility"},
    {label:"Resources",value:"Energy · Focus · Mana",sub:`All three pools remain available. The equipped weapon determines which pool is primary; current primary is ${cap(primary)}.`,cls:"utility"},
    {label:"Boss Damage",value:`+${fmtPct(aff.bossDamage.pct)}`,sub:aff.bossDamage.pct>0?`Bonus cap +${aff.bossDamage.bonusCap}/action`:"No current Boss Damage gear bonus.",cls:"utility"},
    {label:"Lifesteal",value:fmtPct(aff.lifesteal.pct),sub:aff.lifesteal.pct>0?`Heal cap ${aff.lifesteal.healCap} HP/action`:"No current Lifesteal gear bonus.",cls:"utility"},
    {label:"Damage Reflect",value:fmtPct(aff.reflect.pct),sub:aff.reflect.pct>0?`Return cap ${aff.reflect.damageCap} damage/hit`:"No current Damage Reflect gear bonus.",cls:"utility"}
  ];
  root.innerHTML=rows.map(r=>`<div class="char-combat-stat ${r.cls}"><em>${esc(r.label)}</em><b>${esc(r.value)}</b><small>${esc(r.sub)}</small></div>`).join("");
}

function renderCharacterStats(){
  if(!S || !$("charStats")) return;
  const draftTotal=statPointDraftTotal();
  const editing=(S.statPoints || 0)>0 || draftTotal>0;
  const locked=typeof encounterWarningActive === "function" && encounterWarningActive();
  const available=availableStatPoints();
  const gearAttrs=equipmentAttributeTotalsFor();
  $("charStats").innerHTML=STAT_KEYS.map(stat=>{
    const pending=Math.max(0,statPointDraft[stat] || 0);
    const gear=gearAttrs[stat]||0;
    const shown=S[stat]+gear+pending;
    const gearText=gear?` · +${gear} gear`:"";
    if(!editing) return `<div class="char-stat"><span>${stat}</span><b>${shown}${gear?` <small>+${gear} gear</small>`:""}</b></div>`;
    return `<div class="char-stat editable">
      <div class="char-stat-main"><span>${stat}</span><b>${shown}</b><small class="${pending||gear?"pending":""}">${pending?`+${pending} pending${gearText}`:gear?`+${gear} gear`:esc(statPointHint(stat))}</small></div>
      <div class="char-stat-controls">
        <button class="char-stat-step minus" type="button" data-stat-minus="${stat}" aria-label="Remove staged ${stat} point" ${locked||pending<=0?"disabled":""}>−</button>
        <button class="char-stat-step plus" type="button" data-stat-plus="${stat}" aria-label="Stage ${stat} point" ${locked||available<=0?"disabled":""}>+</button>
      </div>
    </div>`;
  }).join("");

  const panel=$("charStatAllocation");
  if(!panel) return;
  panel.hidden=!editing;
  if(!editing) return;
  const raw=S.statPoints || 0;
  $("charStatPoints").textContent=`${raw} attribute point${raw===1?"":"s"} unspent`;
  $("charStatDraftSummary").textContent=draftTotal?`${draftTotal} staged · ${available} free`:`${available} available`;
  $("btnConfirmStats").disabled=locked||draftTotal<=0;
  $("btnConfirmStats").textContent=draftTotal?`Confirm ${draftTotal} point${draftTotal===1?"":"s"}`:"Confirm attribute changes";
  $("charStatLock").hidden=!locked;
}
function stageStatPoint(stat,delta){
  if(!S || !STAT_KEYS.includes(stat) || over || (typeof encounterWarningActive === "function" && encounterWarningActive())) return;
  const current=Math.max(0,statPointDraft[stat] || 0);
  if(delta>0){
    if(availableStatPoints()<=0) return;
    statPointDraft[stat]=current+1;
  }else if(delta<0){
    if(current<=0) return;
    statPointDraft[stat]=current-1;
  }
  renderCharacterSheet();
}
function confirmStatPointDraft(){
  if(!S || over || (typeof encounterWarningActive === "function" && encounterWarningActive())) return;
  const total=statPointDraftTotal();
  if(total<=0 || total>S.statPoints) return;
  const oldMax=S.hpMax;
  const changes=[];
  for(const stat of STAT_KEYS){
    const amount=Math.max(0,statPointDraft[stat] || 0);
    if(!amount) continue;
    S[stat]+=amount;
    changes.push(`${stat} +${amount}`);
  }
  S.statPoints-=total;
  S.hpMax=maxHp();
  S.hp=Math.min(S.hpMax,S.hp+Math.max(0,S.hpMax-oldMax));
  statPointDraft=Object.fromEntries(STAT_KEYS.map(stat=>[stat,0]));
  dismissLevelUpNotice();
  clearCharacterNotice("overview");
  say(`<p class="good">Confirmed <b>${total} attribute point${total===1?"":"s"}</b>: ${esc(changes.join(" · "))}.</p>`);
  travelLogAdd(`Attribute points committed: <b>${esc(changes.join(" · "))}</b>.`,"good");
  render();
}
function ensureCharacterNotices(){
  if(!S) return null;
  const defaults={overview:false,status:false,skills:false,equipment:false,bestiary:false,abilities:false,quests:false,journal:false};
  if(!S.charNotices) S.charNotices={...defaults};
  for(const key of Object.keys(defaults)) if(typeof S.charNotices[key]!=="boolean") S.charNotices[key]=false;
  return S.charNotices;
}
function markCharacterNotice(view){
  if(!settings.characterIndicators) return;
  const notices=ensureCharacterNotices();
  if(notices && Object.prototype.hasOwnProperty.call(notices,view)) notices[view]=true;
}
function ensureSkillRankNotices(){
  if(!S) return null;
  if(!S.skillRankNotices || typeof S.skillRankNotices!=="object") S.skillRankNotices={};
  return S.skillRankNotices;
}
function markSkillRankNotice(id){
  if(!settings.characterIndicators) return;
  const notices=ensureSkillRankNotices();
  if(!notices || !SKILL_DEFS[id]) return;
  notices[id]=true;
  markCharacterNotice("skills");
}
function skillHasRankNotice(id){
  return settings.characterIndicators && !!ensureSkillRankNotices()?.[id];
}
function clearCharacterNotice(view){
  const notices=ensureCharacterNotices();
  if(notices && Object.prototype.hasOwnProperty.call(notices,view)) notices[view]=false;
  requestRunSave();
}
function clearAllCharacterNotices(){
  const notices=ensureCharacterNotices();
  if(!notices) return;
  for(const key of Object.keys(notices)) notices[key]=false;
  const skillNotices=ensureSkillRankNotices();
  if(skillNotices) for(const key of Object.keys(skillNotices)) skillNotices[key]=false;
  renderCharacterSheet();
  renderCharacterNotices();
  requestRunSave();
}
function characterHasUnread(){
  if(!settings.characterIndicators) return false;
  const notices=ensureCharacterNotices();
  const skillNotices=ensureSkillRankNotices();
  return (!!notices && Object.values(notices).some(Boolean)) || (!!skillNotices && Object.values(skillNotices).some(Boolean));
}
function renderCharacterNotices(){
  if(!S) return;
  const notices=ensureCharacterNotices();
  const skillNotices=ensureSkillRankNotices();
  const skillUnread=!!skillNotices && Object.values(skillNotices).some(Boolean);
  const any=characterHasUnread();
  const badge=$("travelHeroNew"); if(badge) badge.hidden=!any;
  document.querySelectorAll("[data-char-view]").forEach(btn=>{
    const view=btn.dataset.charView;
    btn.classList.toggle("has-notice",!!notices?.[view] || (view==="skills" && skillUnread));
  });
  const clear=$("btnClearCharNotices"); if(clear) clear.hidden=!any;
}
function stopLevelUpNoticeFrame(){
  if(levelUpNoticeFrame!==null){ cancelAnimationFrame(levelUpNoticeFrame); levelUpNoticeFrame=null; }
}
function dismissLevelUpNotice(){
  levelUpNoticeDismissed=true;
  levelUpNoticeDeadline=0;
  stopLevelUpNoticeFrame();
  renderLevelUpNotice();
  requestRunSave();
}
function showLevelUpNotice(){
  if(!S || (S.statPoints||0)<=0 || over) return;
  // Level-ups are commonly awarded on the lethal combat action. Do not burn the
  // 15-second notice while the combat result / loot event is still covering it.
  levelUpNoticeDismissed=false;
  levelUpNoticeDeadline=0;
  stopLevelUpNoticeFrame();
  renderLevelUpNotice();
}
function levelUpNoticeLoop(){
  if(!S || over || levelUpNoticeDismissed || (S.statPoints||0)<=0){
    stopLevelUpNoticeFrame();
    renderLevelUpNotice();
    return;
  }
  if(levelUpNoticeDeadline && performance.now()>=levelUpNoticeDeadline){
    dismissLevelUpNotice();
    return;
  }
  renderLevelUpNotice();
  levelUpNoticeFrame=requestAnimationFrame(levelUpNoticeLoop);
}
function renderLevelUpNotice(){
  const box=$("levelup");
  if(!box || !S) return;
  const points=S.statPoints || 0;
  const interrupted=!!S.foe || !!S.travelEvent || (typeof encounterWarningActive === "function" && encounterWarningActive());
  const show=points>0 && !over && !levelUpNoticeDismissed && !interrupted;
  box.hidden=!show;
  if(!show) return;
  if(!levelUpNoticeDeadline){
    levelUpNoticeDeadline=performance.now()+LEVELUP_NOTICE_MS;
    stopLevelUpNoticeFrame();
    levelUpNoticeFrame=requestAnimationFrame(levelUpNoticeLoop);
  }
  const remaining=Math.max(0,levelUpNoticeDeadline-performance.now());
  if(remaining<=0){
    dismissLevelUpNotice();
    return;
  }
  const frac=clamp(remaining/LEVELUP_NOTICE_MS,0,1);
  $("levelupTitle").textContent=points===1?`Level ${S.level} · 1 attribute point available`:`Level ${S.level} · ${points} attribute points available`;
  $("levelupText").textContent=`Spend it whenever you are ready · closes in ${(remaining/1000).toFixed(1)}s`;
  $("levelupBar").style.transform=`scaleX(${frac})`;
}
function travelBrowsingContextAvailable(){
  if(!S || over || currentTown() || S.foe || S.travelEvent || S.activeHollow || S.pendingBoonChoice) return false;
  if(sideAreaActive() || encounterWarningActive()) return false;
  const creator=$("creator");
  return !creator || creator.hidden;
}
function browsingSheetOpen(){
  return ["packSheet","charSheet","lootHistorySheet","settingsSheet"].some(id=>{
    const el=$(id); return !!el && !el.hidden;
  });
}
function syncTravelMapMode(){
  const travel=$("travel"),creator=$("creator"),middleVisual=$("travelMiddleVisual");
  if(!travel) return false;
  const travelVisible=!!S && !over && !currentTown() && !S.foe && (creator?.hidden ?? true);
  const browseMini=travelVisible && browsingSheetOpen();
  travel.classList.toggle("browse-mini-map",browseMini);
  if(middleVisual){
    middleVisual.hidden=!!(browseMini || S?.travelEvent || S?.activeHollow || S?.pendingBoonChoice);
  }
  return browseMini;
}
function syncBrowseTravelUI(){
  const controls=$("travelMiniControls"),arena=$("arena"),settingsSheet=$("settingsSheet");
  syncTravelMapMode();
  const show=travelBrowsingContextAvailable() && browsingSheetOpen();
  if(arena) arena.classList.toggle("browse-descent-visible",show);
  if(settingsSheet){
    const travelContext=!!S && !over && !currentTown() && !S.foe && ($("creator")?.hidden ?? true);
    settingsSheet.classList.toggle("travel-browse",travelContext);
  }
  if(!controls) return;
  controls.hidden=!show;
  if(!show) return;
  const descend=$("btnBrowseDescend"),stop=$("btnBrowseStop");
  if(descend){
    descend.disabled=S.travelMode==="descend";
    descend.classList.toggle("active",S.travelMode==="descend");
  }
  if(stop) stop.disabled=S.travelMode==="stopped";
}

function openCharacterSheet(){
  if(!S || over || S.foe || S.travelEvent) return;
  clearCharacterNotice(charView);
  renderCharacterSheet();
  $("charSheet").hidden = false;
  setFloatingWindowEnabled("character",true);
  syncBrowseTravelUI();
}
function closeCharacterSheet(){
  closeEquipmentInspect();
  $("charSheet").hidden = true;
  syncBrowseTravelUI();
}

const EQUIPMENT_SLOT_ORDER = [
  "rightHand","leftHand","light","hat","cape","earLeft","necklace","earRight","top","gloves","bottoms","belt","boots",
  "ring1","ring2","ring3","ring4"
];
const EQUIPMENT_SLOT_LABELS = {
  rightHand:"Main Hand",leftHand:"Off Hand",light:"Light",hat:"Hat",top:"Top / Shirt",gloves:"Gloves",
  cape:"Cape",belt:"Belt",bottoms:"Bottoms",boots:"Boots",necklace:"Pendant / Neck",
  earLeft:"Earring L",earRight:"Earring R",ring1:"Ring I",ring2:"Ring II",ring3:"Ring III",ring4:"Ring IV"
};
const EQUIPMENT_BODY_LAYOUT = [
  ["light",1,1],["hat",1,2],["cape",1,3],
  ["earLeft",2,1],["necklace",2,2],["earRight",2,3],
  ["rightHand",3,1],["top",3,2],["leftHand",3,3],
  ["gloves",4,1],["bottoms",4,2],["belt",4,3],
  ["boots",5,2]
];
const EQUIPMENT_FILTERS = [
  {id:"all",label:"All",slots:null},
  {id:"main",label:"Main",slots:["rightHand"]},
  {id:"off",label:"Off",slots:["leftHand"]},
  {id:"light",label:"Light",slots:["light"]},
  {id:"hat",label:"Hat",slots:["hat"]},
  {id:"cape",label:"Cape",slots:["cape"]},
  {id:"earrings",label:"Earrings",slots:["earLeft","earRight"]},
  {id:"neck",label:"Pendant",slots:["necklace"]},
  {id:"top",label:"Top",slots:["top"]},
  {id:"gloves",label:"Gloves",slots:["gloves"]},
  {id:"belt",label:"Belt",slots:["belt"]},
  {id:"bottoms",label:"Bottoms",slots:["bottoms"]},
  {id:"boots",label:"Boots",slots:["boots"]},
  {id:"rings",label:"Rings",slots:["ring1","ring2","ring3","ring4"]}
];
const BACKPACK_FILTERS = [
  {id:"all",label:"All"},
  {id:"consumables",label:"Consumables"},
  {id:"tools",label:"Tools"},
  {id:"quest",label:"Quest"},
  {id:"texts",label:"Texts"},
  {id:"materials",label:"Materials"},
  {id:"other",label:"Other"}
];
const DUAL_WIELD_FAMILIES = new Set(["dagger"]);
function equipmentFilterDef(id=equipmentFilter){ return EQUIPMENT_FILTERS.find(f=>f.id===id)||EQUIPMENT_FILTERS[0]; }
const equipmentFilterScrollLeft = {equipment:0,pack:0};
let merchantView="buy";
let merchantSellGearScope="backpack";
let merchantPendingPurchase=null;
let merchantSellSelection={equipment:new Set(),backpack:new Set()};
let merchantSellQuantities={};
function rememberEquipmentFilterScroll(){
  document.querySelectorAll(".equipment-filter-row[data-equipment-filter-context]").forEach(row=>{
    equipmentFilterScrollLeft[row.dataset.equipmentFilterContext]=row.scrollLeft;
  });
}
function restoreEquipmentFilterScroll(){
  document.querySelectorAll(".equipment-filter-row[data-equipment-filter-context]").forEach(row=>{
    row.scrollLeft=equipmentFilterScrollLeft[row.dataset.equipmentFilterContext]||0;
  });
}
function equipmentFilterButtonsHtml(){
  return EQUIPMENT_FILTERS.map(f=>`<button class="equipment-filter${equipmentFilter===f.id?" selected":""}" type="button" data-equipment-filter="${f.id}">${esc(f.label)}</button>`).join("");
}
function setEquipmentFilter(id){
  if(!EQUIPMENT_FILTERS.some(f=>f.id===id)) return;
  rememberEquipmentFilterScroll();
  equipmentFilter=id;
  if(S){
    renderEquipmentUI();
    renderPack();
    restoreEquipmentFilterScroll();
    if(typeof requestAnimationFrame==="function") requestAnimationFrame(()=>{restoreEquipmentFilterScroll();restorePackViewState();});
  }
}
function backpackFilterButtonsHtml(){
  return BACKPACK_FILTERS.map(f=>`<button class="equipment-filter${backpackFilter===f.id?" selected":""}" type="button" data-backpack-filter="${f.id}">${esc(f.label)}</button>`).join("");
}
function rememberPackViewState(){
  const sheet=$("packSheet");
  if(!sheet || sheet.hidden) return;
  const scroll=$("packScroll");
  if(scroll) packViewScrollTop[packActiveTab]=scroll.scrollTop;
  const row=$("packFilterBar")?.querySelector(".equipment-filter-row");
  if(row) packFilterScrollLeft[packActiveTab]=row.scrollLeft;
}
function restorePackViewState(){
  const scroll=$("packScroll");
  if(scroll) scroll.scrollTop=packViewScrollTop[packActiveTab]||0;
  const row=$("packFilterBar")?.querySelector(".equipment-filter-row");
  if(row) row.scrollLeft=packFilterScrollLeft[packActiveTab]||0;
}
function setPackTab(tab){
  if(S?.packMode==="merchant") return;
  if(!["backpack","equipment"].includes(tab)) return;
  if((S?.packMode==="offering"||S?.packMode==="combat") && tab==="equipment") return;
  rememberPackViewState();
  packActiveTab=tab;
  renderPack(false);
  if(typeof requestAnimationFrame==="function") requestAnimationFrame(restorePackViewState);
}
function setBackpackFilter(id){
  if(!BACKPACK_FILTERS.some(f=>f.id===id)) return;
  rememberPackViewState();
  backpackFilter=id;
  renderPack();
  if(typeof requestAnimationFrame==="function") requestAnimationFrame(restorePackViewState);
}
function backpackMiscCategory(name){
  const n=String(name||"").toLowerCase();
  if(/dust|shard|fragment|scrap|reagent|ore|ingot|salvage|essence/.test(n)) return "materials";
  if(/spellbook|book|scroll|page|map|journal|tome|ledger|writ|lexicon/.test(n)) return "texts";
  if(/key|quest|seal|objective/.test(n)) return "quest";
  return "other";
}
function ensureEquipmentState(){
  if(!S) return;
  S.inventory=S.inventory||{};
  S.generatedItems=(S.generatedItems && typeof S.generatedItems==="object" && !Array.isArray(S.generatedItems))?S.generatedItems:{};
  S.inventory.weapons=Array.isArray(S.inventory.weapons)?S.inventory.weapons:[];
  if(!Array.isArray(S.inventory.equipment)) S.inventory.equipment=[];
  const validState=S.equipment && typeof S.equipment==="object" && !Array.isArray(S.equipment);
  if(!validState){
    const main=(S.equippedWeapon && equipmentItemDef(S.equippedWeapon))?S.equippedWeapon:(CLASS_DEFS[S.className]?.startingWeapon||"worn_longsword");
    S.equipment=startingEquipmentLoadout(S.className,main);
    const seed=[...startingEquipmentBackpack(S.className),...S.inventory.weapons];
    const equippedIds=new Set(Object.values(S.equipment).filter(Boolean));
    S.inventory.equipment=[...new Set([...S.inventory.equipment,...seed])].filter(id=>equipmentItemDef(id)&&!equippedIds.has(id));
  }else{
    for(const slot of EQUIPMENT_SLOT_ORDER) if(!(slot in S.equipment)) S.equipment[slot]=null;
    S.inventory.equipment=[...new Set(S.inventory.equipment.filter(id=>equipmentItemDef(id)))];
  }
  // Migrate the obsolete pre-9B weapon mirror exactly once, then retire it.
  // Keeping IDs here after migration could resurrect sold gear on the next render.
  const legacyWeapons=S.inventory.weapons.filter(id=>GEAR_ITEMS[id]);
  for(const id of legacyWeapons){
    if(id!==S.equipment.rightHand && !S.inventory.equipment.includes(id)) S.inventory.equipment.push(id);
  }
  S.inventory.weapons=[];
  // Palette-test fixtures are no longer part of live chronicles.
  S.inventory.equipment=S.inventory.equipment.filter(id=>!RARITY_TEST_WEAPONS.includes(id));
  if(RARITY_TEST_WEAPONS.includes(S.equipment.rightHand)) S.equipment.rightHand=null;
  const main=S.equipment.rightHand;
  S.equippedWeapon=(main && equipmentItemDef(main))?main:null;
}
function equipmentItems(){
  ensureEquipmentState();
  const out={};
  for(const slot of EQUIPMENT_SLOT_ORDER){
    const id=S?.equipment?.[slot]||null;
    out[slot]=id?{id,...equipmentItemDef(id),ilvl:equipmentItemLevel(id),twoHanded:equipmentItemUsesBothHands(id)}:null;
  }
  return out;
}
function equipmentUsesBothHands(items=equipmentItems()){ return !!items?.rightHand?.twoHanded; }
function equipmentSlotBlocked(slot,items=equipmentItems()){ return slot==="leftHand" && equipmentUsesBothHands(items); }
function equipmentEquippedCount(items=equipmentItems()){
  let count=0;
  for(const slot of EQUIPMENT_SLOT_ORDER){
    if(slot==="leftHand" && equipmentUsesBothHands(items)){count++;continue;}
    if(items[slot]) count++;
  }
  return count;
}
function equipmentGearLevelFor(equipmentState=S?.equipment){
  if(!equipmentState) return 0;
  const mainId=equipmentState.rightHand;
  const two=equipmentItemUsesBothHands(mainId);
  let total=0;
  for(const slot of EQUIPMENT_SLOT_ORDER){
    if(slot==="leftHand" && two){total+=equipmentItemLevel(mainId);continue;}
    total+=equipmentItemLevel(equipmentState[slot]);
  }
  return total/EQUIPMENT_SLOT_ORDER.length;
}
function equipmentGearLevel(){ return equipmentGearLevelFor().toFixed(1); }
function equipmentItemDualWieldable(itemId){
  const def=equipmentItemDef(itemId);
  return !!def && Number(def.hands||1)===1 && DUAL_WIELD_FAMILIES.has(def.family);
}
function compatibleEquipmentSlots(itemId){
  const def=equipmentItemDef(itemId);
  if(!def) return [];
  const slots=[...(def.slots||[])];
  if(equipmentItemDualWieldable(itemId)){
    if(!slots.includes("rightHand")) slots.push("rightHand");
    if(!slots.includes("leftHand")) slots.push("leftHand");
  }
  return slots;
}
function equipmentFilterCompatibleSlots(itemId,filterId=equipmentFilter){
  const slots=compatibleEquipmentSlots(itemId), filter=equipmentFilterDef(filterId);
  return filter.slots ? slots.filter(slot=>filter.slots.includes(slot)) : slots;
}
function simulateEquipmentEquipDirect(itemId,target){
  const next={...(S?.equipment||{})};
  if(!equipmentItemDef(itemId) || !target || !compatibleEquipmentSlots(itemId).includes(target)) return next;
  for(const slot of EQUIPMENT_SLOT_ORDER) if(next[slot]===itemId) next[slot]=null;
  if(target==="leftHand" && equipmentItemUsesBothHands(next.rightHand)) next.rightHand=null;
  next[target]=itemId;
  if(target==="rightHand" && equipmentItemUsesBothHands(itemId)) next.leftHand=null;
  return next;
}
function equipmentComparisonForTarget(itemId,target){
  const currentId=target?S?.equipment?.[target]:null;
  const itemDelta=equipmentItemLevel(itemId)-equipmentItemLevel(currentId);
  const valueDelta=equipmentItemGoldValue(itemId)-equipmentItemGoldValue(currentId);
  const beforeState=S?.equipment||{}, afterState=simulateEquipmentEquipDirect(itemId,target);
  const before=equipmentGearLevelFor(beforeState), after=equipmentGearLevelFor(afterState);
  const armorBefore=equipmentArmorFor(beforeState),armorAfter=equipmentArmorFor(afterState);
  const physicalMitigationBefore=armorMitigationFor(beforeState,S?.depth||0),physicalMitigationAfter=armorMitigationFor(afterState,S?.depth||0);
  const defenceRatingBefore=playerDefenceRatingForEquipment(beforeState,{includeEffects:true}),defenceRatingAfter=playerDefenceRatingForEquipment(afterState,{includeEffects:true});
  const defenceBefore=defenceSnapshotFromRating(defenceRatingBefore),defenceAfter=defenceSnapshotFromRating(defenceRatingAfter);
  const attributesBefore=equipmentAttributeTotalsFor(beforeState),attributesAfter=equipmentAttributeTotalsFor(afterState);
  const hpBefore=effectiveStatForEquipment("CON",beforeState)*6,hpAfter=effectiveStatForEquipment("CON",afterState)*6;
  const strikeBefore=weaponAttackBaseForEquipment(beforeState),strikeAfter=weaponAttackBaseForEquipment(afterState);
  const attackBonusBefore=attackBonusFromRating(strikeBefore),attackBonusAfter=attackBonusFromRating(strikeAfter);
  const affixesBefore=equipmentAffixTotalsFor(beforeState),affixesAfter=equipmentAffixTotalsFor(afterState);
  const critChanceBefore=criticalChanceForEquipment(beforeState),critChanceAfter=criticalChanceForEquipment(afterState);
  const precisionBefore=precisionForEquipment(beforeState),precisionAfter=precisionForEquipment(afterState);
  const critDamageBefore=criticalDamagePctForEquipment(beforeState),critDamageAfter=criticalDamagePctForEquipment(afterState);
  const speedBefore=playerCombatSpeedForEquipment(beforeState),speedAfter=playerCombatSpeedForEquipment(afterState);
  return {target,currentId,itemDelta,valueDelta,gearDelta:after-before,before,after,armorBefore,armorAfter,physicalMitigationBefore,physicalMitigationAfter,defenceRatingBefore,defenceRatingAfter,acBefore:defenceBefore.ac,acAfter:defenceAfter.ac,deflectionBefore:defenceBefore.deflection,deflectionAfter:defenceAfter.deflection,attributesBefore,attributesAfter,hpBefore,hpAfter,strikeBefore,strikeAfter,attackBonusBefore,attackBonusAfter,affixesBefore,affixesAfter,critChanceBefore,critChanceAfter,precisionBefore,precisionAfter,critDamageBefore,critDamageAfter,speedBefore,speedAfter};
}
function recommendedEquipmentSlot(itemId,preferred=null,filterId="all"){
  const slots=equipmentFilterCompatibleSlots(itemId,filterId);
  if(preferred && slots.includes(preferred)) return preferred;
  if(!slots.length) return null;
  return [...slots].sort((a,b)=>{
    const ca=equipmentComparisonForTarget(itemId,a), cb=equipmentComparisonForTarget(itemId,b);
    if(Math.abs(cb.gearDelta-ca.gearDelta)>0.0001) return cb.gearDelta-ca.gearDelta;
    if(cb.itemDelta!==ca.itemDelta) return cb.itemDelta-ca.itemDelta;
    const ae=S?.equipment?.[a]?1:0, be=S?.equipment?.[b]?1:0;
    return ae-be;
  })[0];
}
function simulateEquipmentEquip(itemId,targetSlot){
  const target=recommendedEquipmentSlot(itemId,targetSlot,"all");
  return simulateEquipmentEquipDirect(itemId,target);
}
function equipmentComparison(itemId,targetSlot=null,filterId="all"){
  const target=recommendedEquipmentSlot(itemId,targetSlot,filterId);
  return target?equipmentComparisonForTarget(itemId,target):{target:null,currentId:null,itemDelta:0,gearDelta:0,before:equipmentGearLevelFor(),after:equipmentGearLevelFor()};
}
function equipmentMatchesFilter(itemId,filterId=equipmentFilter){ return equipmentFilterCompatibleSlots(itemId,filterId).length>0; }
function sortedBackpackEquipment(filterId=equipmentFilter){
  if(!S) return [];
  return S.inventory.equipment.filter(id=>equipmentItemDef(id)&&equipmentMatchesFilter(id,filterId)).sort((a,b)=>{
    const ca=equipmentComparison(a,null,filterId), cb=equipmentComparison(b,null,filterId);
    if(cb.itemDelta!==ca.itemDelta) return cb.itemDelta-ca.itemDelta;
    if(Math.abs(cb.gearDelta-ca.gearDelta)>0.0001) return cb.gearDelta-ca.gearDelta;
    const il=equipmentItemLevel(b)-equipmentItemLevel(a); if(il) return il;
    const ta=RARITY_TEST_WEAPONS.indexOf(a), tb=RARITY_TEST_WEAPONS.indexOf(b);
    if(ta>=0 && tb>=0) return ta-tb;
    return String(equipmentItemDef(a)?.name||a).localeCompare(String(equipmentItemDef(b)?.name||b));
  });
}
function deltaClass(v){ return v>0?"good":v<0?"bad":"same"; }
function deltaText(v,digits=0){
  const n=digits?Number(v.toFixed(digits)):Math.round(v);
  return `${n>0?"+":""}${n.toFixed? n.toFixed(digits):n}`;
}
function equipmentCompareHtml(itemId,targetSlot=null){
  const c=equipmentComparison(itemId,targetSlot), targetLabel=EQUIPMENT_SLOT_LABELS[c.target]||"slot",bits=[];
  bits.push(`<span class="equipment-delta power">iLv ${deltaText(c.itemDelta)}</span>`,`<span class="equipment-delta power">Gear ${deltaText(c.gearDelta,1)}</span>`,`<span class="equipment-delta power">Value ${deltaText(c.valueDelta||0)}g</span>`);
  const armorDelta=(c.armorAfter??0)-(c.armorBefore??0); if(Math.abs(armorDelta)>.001) bits.push(`<span class="equipment-delta ${deltaClass(armorDelta)}">Armor ${deltaText(armorDelta)}</span>`);
  for(const stat of STAT_KEYS){
    const d=(c.attributesAfter?.[stat]||0)-(c.attributesBefore?.[stat]||0);
    if(d) bits.push(`<span class="equipment-delta ${deltaClass(d)}">${stat} ${deltaText(d)}</span>`);
  }
  const strikeDelta=(c.strikeAfter??0)-(c.strikeBefore??0); if(Math.abs(strikeDelta)>.05) bits.push(`<span class="equipment-delta ${deltaClass(strikeDelta)}">Attack Rating ${deltaText(strikeDelta,1)}</span>`);
  const defenceDelta=(c.defenceRatingAfter??0)-(c.defenceRatingBefore??0);if(Math.abs(defenceDelta)>.05)bits.push(`<span class="equipment-delta ${deltaClass(defenceDelta)}">Defence Rating ${deltaText(defenceDelta,1)}</span>`);
  const mitigationDelta=((c.physicalMitigationAfter??0)-(c.physicalMitigationBefore??0))*100;if(Math.abs(mitigationDelta)>.01)bits.push(`<span class="equipment-delta ${deltaClass(mitigationDelta)}">Physical DR ${deltaText(mitigationDelta,1)}%</span>`);
  const speedDelta=(c.speedAfter??0)-(c.speedBefore??0); if(speedDelta) bits.push(`<span class="equipment-delta same">Speed ${deltaText(speedDelta)} (parked)</span>`);
  const critDelta=(c.critChanceAfter??0)-(c.critChanceBefore??0);if(Math.abs(critDelta)>.001)bits.push(`<span class="equipment-delta same">Crit Chance ${deltaText(critDelta,2)}%</span>`);
  const critDamageDelta=(c.critDamageAfter??0)-(c.critDamageBefore??0);if(Math.abs(critDamageDelta)>.001)bits.push(`<span class="equipment-delta same">Crit Damage ${deltaText(critDamageDelta,1)}%</span>`);
  const bossDelta=(c.affixesAfter?.bossDamage?.pct||0)-(c.affixesBefore?.bossDamage?.pct||0);if(bossDelta)bits.push(`<span class="equipment-delta ${deltaClass(bossDelta)}">Boss ${deltaText(bossDelta)}%</span>`);
  const reflectDelta=(c.affixesAfter?.reflect?.pct||0)-(c.affixesBefore?.reflect?.pct||0);if(reflectDelta)bits.push(`<span class="equipment-delta ${deltaClass(reflectDelta)}">Reflect ${deltaText(reflectDelta)}%</span>`);
  const leechDelta=(c.affixesAfter?.lifesteal?.pct||0)-(c.affixesBefore?.lifesteal?.pct||0);if(leechDelta)bits.push(`<span class="equipment-delta ${deltaClass(leechDelta)}">Lifesteal ${deltaText(leechDelta)}%</span>`);
  bits.push(`<span>${esc(targetLabel)}</span>`);
  return bits.join("");
}
function removeEquipmentFromBag(itemId){
  const i=S.inventory.equipment.indexOf(itemId);
  if(i>=0) S.inventory.equipment.splice(i,1);
}
function addEquipmentToBag(itemId){
  if(itemId && equipmentItemDef(itemId) && !S.inventory.equipment.includes(itemId)) S.inventory.equipment.push(itemId);
}
function equipmentItemIsShield(itemId){ return equipmentItemDef(itemId)?.family==="shield"; }
function syncVotaryLoadoutFromHands(){
  if(!S || S.className!=="Votary") return;
  if(equipmentItemUsesBothHands(S.equipment?.rightHand)) S.loadout="sword";
  else if(equipmentItemIsShield(S.equipment?.leftHand)) S.loadout="shield";
  else if(S.loadout==="shield") S.loadout="sword";
}
function equipEquipmentItem(itemId,targetSlot=null){
  if(!S || S.foe || encounterWarningActive()) return false;
  ensureEquipmentState();
  const def=equipmentItemDef(itemId); if(!def) return false;
  const target=recommendedEquipmentSlot(itemId,targetSlot,"all"); if(!target) return false;
  if(!compatibleEquipmentSlots(itemId).includes(target)) return false;
  const current=S.equipment[target];
  if(current===itemId) return true;
  // An item can only occupy one normal slot at a time.
  for(const slot of EQUIPMENT_SLOT_ORDER){
    if(S.equipment[slot]===itemId) S.equipment[slot]=null;
  }
  if(target==="leftHand" && equipmentItemUsesBothHands(S.equipment.rightHand)){
    const twoHander=S.equipment.rightHand;
    addEquipmentToBag(twoHander);
    S.equipment.rightHand=null;
    S.equippedWeapon=null;
  }
  if(current) addEquipmentToBag(current);
  if(target==="rightHand" && equipmentItemUsesBothHands(itemId)){
    if(S.equipment.leftHand) addEquipmentToBag(S.equipment.leftHand);
    S.equipment.leftHand=null;
  }
  removeEquipmentFromBag(itemId);
  S.equipment[target]=itemId;
  if(target==="rightHand") S.equippedWeapon=equipmentItemDef(itemId)?itemId:null;
  syncVotaryLoadoutFromHands();
  syncEquipmentHpCeiling();
  travelLogAdd(`Equipped <b>${esc(def.name)}</b> in <b>${esc(EQUIPMENT_SLOT_LABELS[target])}</b>.`,"good");
  closeEquipmentInspect();
  renderPack();
  render();
  saveRunNow();
  return true;
}
function unequipEquipmentSlot(slot){
  if(!S || S.foe || encounterWarningActive() || !EQUIPMENT_SLOT_ORDER.includes(slot)) return false;
  ensureEquipmentState();
  if(equipmentSlotBlocked(slot)) return false;
  const id=S.equipment[slot]; if(!id) return false;
  addEquipmentToBag(id);
  S.equipment[slot]=null;
  if(slot==="rightHand") S.equippedWeapon=null;
  syncVotaryLoadoutFromHands();
  syncEquipmentHpCeiling();
  travelLogAdd(`Moved <b>${esc(equipmentItemDef(id)?.name||id)}</b> to the Backpack.`,"note");
  closeEquipmentInspect();
  renderPack();
  render();
  saveRunNow();
  return true;
}
function equipmentSlotClass(slot){
  return `${["rightHand","leftHand"].includes(slot)?" hand":""}${slot==="light"?" light":""}${slot.startsWith("ring")?" ring":""}`;
}
function equipmentSlotButton(slot,item,style="",items=equipmentItems()){
  const selected=equipmentInspectSlot===slot && !equipmentInspectItemId;
  const blocked=equipmentSlotBlocked(slot,items);
  const label=EQUIPMENT_SLOT_LABELS[slot]||slot;
  const shownItem=blocked?null:item;
  const frame=shownItem?rarityFrameClass(shownItem.rarity):"";
  const mergedStyle=style;
  const aria=blocked?`${label}: unavailable while ${items.rightHand?.name||"the Main Hand item"} uses both hands`:shownItem?`${label}: ${shownItem.name}`:`${label}: empty`;
  return `<button class="equipment-slot${equipmentSlotClass(slot)}${shownItem?` has-rarity ${frame}`:" empty"}${blocked?" blocked":""}${selected?" selected":""}${slot==="boots"?" slot-boots":""}" type="button" data-equipment-slot="${slot}" ${blocked?'aria-disabled="true"':''} ${mergedStyle?`style="${mergedStyle}"`:""} aria-label="${esc(aria)}"><span class="slot-name">${esc(label)}</span><span class="slot-level">${blocked?"2-hand":shownItem?`iLv ${shownItem.ilvl}`:"—"}</span>${shownItem?raritySparkles(shownItem.rarity,`${slot}:${shownItem.id}`):""}</button>`;
}
function renderEquipmentInfo(items){
  const root=$("equipmentInfo"); if(!root) return;
  const equipped=equipmentEquippedCount(items),gear=equipmentGearLevel();
  const slot=equipmentInspectSlot;
  if(!slot){
    const defence=playerDefenceRating(),armor=equipmentArmorFor(S?.equipment),physicalDr=armorMitigationFor(S?.equipment,S?.depth||0);
    root.innerHTML=`<em>Equipment info</em><b>Tap a slot</b><p>Inspect equipped gear here. Expand the list to compare Backpack items automatically against the slot they would replace.</p><dl><div><dt>Equipped</dt><dd>${equipped}/17</dd></div><div><dt>Gear</dt><dd>${gear}</dd></div><div><dt>Defence</dt><dd>${trimNumber(defence,1)} DR · RSL ${effectiveStat("RSL")}</dd></div><div><dt>Armor</dt><dd>${trimNumber(armor,0)} · ${trimNumber(physicalDr*100,1)}% physical DR</dd></div><div><dt>Hands</dt><dd>${equipmentUsesBothHands(items)?"2H":"R / L"}</dd></div><div><dt>Light</dt><dd>${items.light?"ready":"empty"}</dd></div></dl>`;
    return;
  }
  const label=EQUIPMENT_SLOT_LABELS[slot]||slot;
  if(equipmentSlotBlocked(slot,items)){
    const main=items.rightHand;
    root.innerHTML=`<em>Equipment info</em><span class="equipment-info-slot">${esc(label)}</span><b>Used by Main Hand</b><span class="equipment-info-meta">Two-handed</span><p class="info-note"><strong>${esc(main?.name||"Main Hand")}</strong> uses both hands. Equipping an Off Hand item will stow it and leave Main Hand empty.</p><dl><div><dt>Main</dt><dd>${main?`iLv ${main.ilvl}`:"—"}</dd></div><div><dt>Off Hand</dt><dd>2-hand</dd></div></dl>`;
    return;
  }
  const item=items[slot];
  if(!item){
    const count=S.inventory.equipment.filter(id=>compatibleEquipmentSlots(id).includes(slot)).length;
    root.innerHTML=`<em>Equipment info</em><span class="equipment-info-slot">${esc(label)}</span><b>Empty</b><p>${count?`${count} compatible ${count===1?"item":"items"} in your Backpack. Expand the list to compare them.`:"Nothing compatible is currently carried."}</p><dl><div><dt>Equipped</dt><dd>${equipped}/17</dd></div><div><dt>Gear</dt><dd>${gear}</dd></div></dl>`;
    return;
  }
  const stats=equipmentDisplayStatLines(item).slice(0,4).map(stat=>{
    const m=String(stat).match(/^(.*?)([+−-]\d+.*)$/);
    return m?`<div class="equipment-info-stat"><span>${esc(m[1].trim())}</span><strong>${esc(m[2])}</strong></div>`:`<div class="equipment-info-stat"><span>${esc(stat)}</span><strong>•</strong></div>`;
  }).join("");
  const compatible=S.inventory.equipment.filter(id=>compatibleEquipmentSlots(id).includes(slot)).length;
  root.innerHTML=`<em>Equipment info</em><span class="equipment-info-slot">${esc(label)}</span><b class="${rarityClass(item.rarity)}">${esc(item.name)}</b><span class="equipment-info-meta"><span class="${rarityClass(item.rarity)}">${esc(item.rarity)}</span> · iLv ${item.ilvl}${item.twoHanded?" · two-handed":""}${equipmentItemDualWieldable(item.id)?" · dual-wieldable":""}</span><div class="equipment-economy"><span>Intrinsic ${Math.round(computedIntrinsicValue(item))}</span><b>${formatGoldHtml(computedItemGoldValue(item))}</b></div><div class="equipment-info-stats">${stats}</div><p class="info-note">${esc(item.desc||"")}</p><dl><div><dt>Backpack</dt><dd>${compatible} match${compatible===1?"":"es"}</dd></div></dl><button class="equipment-info-action" type="button" data-equipment-inline-unequip="${slot}">Remove</button>`;
}
function renderEquipmentUI(){
  if(!S) return;
  rememberEquipmentFilterScroll();
  ensureEquipmentState();
  const items=equipmentItems();
  const count=equipmentEquippedCount(items),gear=equipmentGearLevel();
  if($("equipmentEquippedCount")) $("equipmentEquippedCount").textContent=`${count} / 17 equipped`;
  if($("equipmentGearLevel")) $("equipmentGearLevel").textContent=gear;
  if($("charEquipmentSummary")) $("charEquipmentSummary").textContent=`gear ${gear}`;
  const ringRoot=$("equipmentRingRail");
  if(ringRoot) ringRoot.innerHTML=["ring1","ring2","ring3","ring4"].map(slot=>equipmentSlotButton(slot,items[slot],"",items)).join("");
  const bodyRoot=$("equipmentBodyGrid");
  if(bodyRoot) bodyRoot.innerHTML=EQUIPMENT_BODY_LAYOUT.map(([slot,row,col])=>equipmentSlotButton(slot,items[slot],`grid-row:${row};grid-column:${col}`,items)).join("");
  renderEquipmentInfo(items);
  const list=$("equipmentCompactList"); if(list) list.hidden=true;
  const expand=$("btnEquipmentExpand");
  if(expand){expand.classList.remove("open");expand.setAttribute("aria-expanded","false");expand.textContent="⌄";expand.title="Open equipment inventory";}
  const compact=$("equipmentCompactGrid");
  if(compact){
    const equippedHtml=EQUIPMENT_SLOT_ORDER.map(slot=>{
      const blocked=equipmentSlotBlocked(slot,items),item=blocked?null:items[slot],label=EQUIPMENT_SLOT_LABELS[slot];
      const frame=item?rarityFrameClass(item.rarity):"";
      const nameClass=item?rarityClass(item.rarity):"";
      return `<button class="equipment-compact-item${item?` ${frame}`:" empty"}" type="button" data-equipment-slot="${slot}"><small>${esc(label)}</small><b class="${nameClass}">${blocked?"Used by Main Hand":item?esc(item.name):"Empty"}</b><span class="compact-rarity-meta">${blocked?"Two-handed":item?`<span class="${nameClass}">iLv ${item.ilvl}</span> · ${esc(item.rarity)}`:"—"}</span>${item?raritySparkles(item.rarity,`compact:${slot}:${item.id}`):""}</button>`;
    }).join("");
    const bag=sortedBackpackEquipment(equipmentFilter);
    const bagHtml=bag.length?bag.map(id=>{
      const d=equipmentItemDef(id),target=recommendedEquipmentSlot(id,null,equipmentFilter),cmp=equipmentCompareHtml(id,target);
      const frame=rarityFrameClass(d.rarity);
      return `<button class="equipment-compact-item equipment-backpack-item ${frame}" type="button" data-equipment-item="${id}" data-equipment-target="${target||""}"><small>Backpack · ${esc(EQUIPMENT_SLOT_LABELS[target]||d.slot)}</small><b class="${rarityClass(d.rarity)}">${esc(d.name)}</b><span class="compact-rarity-meta"><span class="${rarityClass(d.rarity)}">iLv ${d.itemLevel}</span> · <span class="${rarityClass(d.rarity)}">${esc(d.rarity)}</span> · ${formatGoldHtml(computedItemGoldValue(d))}</span><span class="equipment-compare">${cmp}</span>${raritySparkles(d.rarity,`bagcompact:${id}`)}</button>`;
    }).join(""):`<div class="equipment-filter-empty">No carried equipment matches this filter.</div>`;
    compact.innerHTML=`${equippedHtml}<div class="equipment-list-subhead">Backpack equipment · automatic comparison</div><div class="equipment-filter-row" data-equipment-filter-context="equipment">${equipmentFilterButtonsHtml()}</div>${bagHtml}`;
  }
  restoreEquipmentFilterScroll();
}
function selectEquipmentSlot(slot){
  if(!EQUIPMENT_SLOT_ORDER.includes(slot)) return;
  equipmentInspectSlot=slot; equipmentInspectItemId=null; equipmentInspectTargetSlot=null; equipmentInspectExpanded=false;
  renderEquipmentUI();
}
function openEquipmentInspect(slot){
  if(!EQUIPMENT_SLOT_ORDER.includes(slot)) return;
  equipmentInspectSlot=slot; equipmentInspectItemId=null; equipmentInspectTargetSlot=slot; equipmentInspectExpanded=false;
  renderEquipmentInspect(); const box=$("equipmentInspect"); if(box) box.hidden=false; renderEquipmentUI();
}
function openEquipmentItemInspect(itemId,targetSlot=null){
  if(!equipmentItemDef(itemId)) return;
  equipmentInspectItemId=itemId; equipmentInspectTargetSlot=recommendedEquipmentSlot(itemId,targetSlot); equipmentInspectSlot=equipmentInspectTargetSlot; equipmentInspectExpanded=false;
  renderEquipmentInspect(); const box=$("equipmentInspect"); if(box) box.hidden=false; renderEquipmentUI();
}
function closeEquipmentInspect(){
  equipmentInspectExpanded=false; equipmentInspectItemId=null; equipmentInspectTargetSlot=null;
  const box=$("equipmentInspect"); if(box) box.hidden=true;
  if(S) renderEquipmentUI();
}
function renderEquipmentInspect(){
  const root=$("equipmentInspectContent"); if(!root||!equipmentInspectSlot) return;
  const items=equipmentItems(),slot=equipmentInspectSlot,label=EQUIPMENT_SLOT_LABELS[slot];
  const candidateId=equipmentInspectItemId;
  if(!candidateId && equipmentSlotBlocked(slot,items)){
    const main=items.rightHand;
    root.innerHTML=`<div class="equipment-inspect-head"><div><em>${esc(label)}</em><h3 id="equipmentInspectName">Off Hand unavailable</h3></div><span class="equipment-inspect-rarity">Two-handed</span></div><div class="equipment-inspect-empty">${esc(main?.name||"The Main Hand item")} uses both hands. Equipping an Off Hand item will stow it and leave Main Hand empty.</div><div class="equipment-inspect-actions"><button class="primary" type="button" data-equipment-close style="grid-column:1/-1">Close</button></div>`;
    return;
  }
  const itemId=candidateId || S.equipment[slot];
  const item=itemId?equipmentItemDef(itemId):null;
  if(!item){
    root.innerHTML=`<div class="equipment-inspect-head"><div><em>${esc(label)}</em><h3 id="equipmentInspectName">Empty slot</h3></div><span class="equipment-inspect-rarity">Unequipped</span></div><div class="equipment-inspect-empty">Nothing is equipped here. Expand the equipment list to inspect compatible Backpack items.</div><div class="equipment-inspect-actions"><button class="primary" type="button" data-equipment-close style="grid-column:1/-1">Close</button></div>`;
    return;
  }
  const stats=equipmentDisplayStatLines(item).map(stat=>{
    const m=String(stat).match(/^(.*?)([+−-]\d+.*)$/);
    return m?`<div class="equipment-inspect-stat"><span>${esc(m[1].trim())}</span><b>${esc(m[2])}</b></div>`:`<div class="equipment-inspect-stat"><span>${esc(stat)}</span><b>•</b></div>`;
  }).join("");
  const candidate=!!candidateId;
  const comp=candidate?equipmentComparison(itemId,slot):null;
  const compare=candidate?(()=>{
    const lines=[`<span class="equipment-delta power">Item Level ${deltaText(comp.itemDelta)}</span> · <span class="equipment-delta power">Gear Level ${deltaText(comp.gearDelta,1)}</span>`];
    if(Math.abs(comp.armorAfter-comp.armorBefore)>.001) lines.push(`Armor <span class="equipment-delta ${deltaClass(comp.armorAfter-comp.armorBefore)}">${trimNumber(comp.armorBefore,0)} → ${trimNumber(comp.armorAfter,0)}</span> · Physical DR ${trimNumber(comp.physicalMitigationBefore*100,1)}% → ${trimNumber(comp.physicalMitigationAfter*100,1)}%`);
    if(Math.abs(comp.defenceRatingAfter-comp.defenceRatingBefore)>.05) lines.push(`Defence Rating <span class="equipment-delta ${deltaClass(comp.defenceRatingAfter-comp.defenceRatingBefore)}">${trimNumber(comp.defenceRatingBefore,1)} → ${trimNumber(comp.defenceRatingAfter,1)}</span>`);
    for(const stat of STAT_KEYS){
      const d=(comp.attributesAfter?.[stat]||0)-(comp.attributesBefore?.[stat]||0);
      if(d) lines.push(`${stat} <span class="equipment-delta ${deltaClass(d)}">${effectiveStatForEquipment(stat,S.equipment)} → ${effectiveStatForEquipment(stat,simulateEquipmentEquipDirect(itemId,slot))}</span>`);
    }
    if(comp.hpAfter!==comp.hpBefore) lines.push(`Max HP <span class="equipment-delta ${deltaClass(comp.hpAfter-comp.hpBefore)}">${comp.hpBefore} → ${comp.hpAfter}</span>`);
    if(Math.abs(comp.strikeAfter-comp.strikeBefore)>.05) lines.push(`Attack Rating <span class="equipment-delta ${deltaClass(comp.strikeAfter-comp.strikeBefore)}">${comp.strikeBefore.toFixed(1)} → ${comp.strikeAfter.toFixed(1)}</span>`);
    if((comp.speedAfter??0)!==(comp.speedBefore??0)) lines.push(`Speed <span class="equipment-delta same">${comp.speedBefore} → ${comp.speedAfter} · parked during realtime combat tuning</span>`);
    if(Math.abs((comp.critChanceAfter??0)-(comp.critChanceBefore??0))>.001) lines.push(`Crit Chance <span class="equipment-delta power">${trimNumber(comp.critChanceBefore,2)}% → ${trimNumber(comp.critChanceAfter,2)}%</span>`);
    if(Math.abs((comp.critDamageAfter??0)-(comp.critDamageBefore??0))>.001) lines.push(`Crit Damage <span class="equipment-delta power">${trimNumber(comp.critDamageBefore,1)}% → ${trimNumber(comp.critDamageAfter,1)}%</span>`);
    if(equipmentItemUsesBothHands(itemId)) lines.push(`Equipping this two-handed item returns the current Off Hand item to the Backpack.`);
    return `<div class="equipment-inspect-special"><b>Compared with ${esc(EQUIPMENT_SLOT_LABELS[comp.target]||label)}</b><br>${lines.join("<br>")}</div>`;
  })():"";
  const canUnequip=!candidate;
  root.innerHTML=`<div class="equipment-inspect-head"><div><em>${candidate?`Backpack → ${esc(EQUIPMENT_SLOT_LABELS[comp.target]||label)}`:esc(label)}</em><h3 id="equipmentInspectName" class="${rarityClass(item.rarity)}">${esc(item.name)}</h3></div><span class="equipment-inspect-rarity ${rarityClass(item.rarity)}">${esc(item.rarity||"Common")}</span></div><div class="equipment-inspect-meta"><div><span>Item level</span><b>${item.itemLevel}</b></div><div><span>Gold value</span><b>${formatGoldHtml(computedItemGoldValue(item))}</b></div><div><span>${candidate?"Target":"Slot"}</span><b>${esc(candidate?(EQUIPMENT_SLOT_LABELS[comp.target]||label):label)}</b></div></div><div class="equipment-inspect-stats">${stats}</div>${compare}<div class="equipment-inspect-full" ${equipmentInspectExpanded?"":"hidden"}><p><b>Full details</b><br>${esc(item.desc||"")}</p><p><b>Session 9F</b><br>Intrinsic Value is the mechanical accounting unit. Slot-normalized finished value determines iLv. Appraised Gold Value then applies a restrained rarity scarcity premium; future merchant buy/sell margins and CHA can modify transaction prices without changing combat power.</p></div><div class="equipment-inspect-actions">${candidate?`<button class="primary" type="button" data-equipment-equip="${itemId}" data-equipment-target="${comp.target}">Equip</button>`:`<button class="primary" type="button" data-equipment-full>${equipmentInspectExpanded?"Quick view":"Full details"}</button>`}${candidate?`<button type="button" data-equipment-full>${equipmentInspectExpanded?"Quick view":"Full details"}</button>`:canUnequip?`<button type="button" data-equipment-unequip="${slot}">Unequip</button>`:`<button type="button" data-equipment-close>Close</button>`}</div>`;
}
function toggleEquipmentList(){
  equipmentListExpanded=false;
  closeCharacterSheet();
  openPack(null,"equipment","characterEquipment");
}

let questListView="active";
let charExpandedQuest=null;
function questBoundItemCount(inst){
  const def=questDefById(inst?.definitionId);if(!inst||!def)return 0;
  return (def.objectives||[]).reduce((total,obj)=>total+questItemCount(inst.instanceId,obj.id),0);
}
function questStatusLabel(inst){
  if(inst.status==="completed")return inst.result?.full?"Completed":"Partial completion";
  if(inst.status==="inactive")return inst.inactiveReason||"Inactive";
  const def=questDefById(inst.definitionId);
  if(def?.kind==="rescue-escort")return inst.rescue?.stage==="escorting"?"Escorting":inst.rescue?.stage==="located"?"Located":"Searching";
  return "Active";
}
function questResultText(inst){
  const def=questDefById(inst?.definitionId),result=inst?.result||{};
  if(def?.kind==="rescue-escort")return `${result.rescued||def.subject?.name||"Traveller"} reached ${townDefById(inst.targetTownId)?.name||"the destination"} · ${formatGold(result.reward||0)} paid`;
  return `${result.delivered||0}/${result.required||0} delivered · ${formatGold(result.reward||0)} paid`;
}
function renderQuestPage(){
  const root=$("charQuests");if(!root||!S)return;normalizeQuestState();
  const activeCount=questInstances("active").length;if($("charQuestSummary"))$("charQuestSummary").textContent=activeCount?`${activeCount} active`:"none active";
  document.querySelectorAll("[data-quest-list-view]").forEach(btn=>btn.classList.toggle("active",btn.dataset.questListView===questListView));
  const list=questInstances(questListView);
  root.innerHTML=list.length?list.map(inst=>{
    const def=questDefById(inst.definitionId);syncQuestObjectiveProgress(inst);const progress=questProgressText(inst),open=charExpandedQuest===inst.instanceId;
    const reward=inst.status==="completed"?`${formatGold(inst.result?.reward||0)} received`:questPromisedRewardText(inst);
    const held=questBoundItemCount(inst);
    const detail=`<div class="quest-detail" ${open?"":"hidden"}><div class="quest-detail-grid"><b>Given by</b><span>${esc(def?.giverName||"—")}</span><b>Destination</b><span>${esc(questDestinationText(inst))}</span><b>Objective</b><span>${esc(def?.details||def?.summary||"—")}</span><b>Progress</b><span>${esc(progress)}</span><b>Quest items</b><span>${held} bound to this contract instance</span><b>Promised</b><span>${esc(questPromisedRewardText(inst))}</span>${inst.status==="completed"?`<b>Result</b><span>${esc(questResultText(inst))}</span>`:""}${inst.status==="inactive"?`<b>Status</b><span>${esc(inst.inactiveReason||"Inactive")}</span>`:""}</div>${def?.lore?`<p class="quest-lore">${esc(def.lore)}</p>`:""}</div>`;
    return `<div class="quest-entry ${inst.status}"><div class="quest-entry-main"><div class="quest-entry-copy"><b>${esc(def?.title||inst.definitionId)}</b><p>${esc(def?.summary||"")}</p></div><div class="quest-entry-side"><strong>${esc(questStatusLabel(inst))}</strong><span>${esc(progress)}</span><span>${esc(reward)}</span></div></div><div class="quest-entry-actions"><button class="more" type="button" data-quest-more="${esc(inst.instanceId)}">${open?"Hide details":"See more"}</button>${inst.status==="inactive"?`<button class="warn" type="button" data-quest-delete="${esc(inst.instanceId)}">Delete</button>`:""}</div>${detail}</div>`;
  }).join(""):`<div class="quest-empty">${questListView==="active"?"No active quests.":questListView==="inactive"?"No inactive quests.":"No completed quests yet."}</div>`;
}
function renderCharacterSheet(){
  if(!S || !$("charSheet")) return;
  $("charName").textContent=S.name;
  $("charClassLevel").textContent=`${S.className || "Votary"} · Level ${S.level}`;
  $("charBackground").textContent=`${S.folk} · ${S.trade} · ${S.origin}`;
  $("charHp").textContent=`${Math.max(0,S.hp)}/${S.hpMax}`;
  const charHpFrac=clamp(S.hp/S.hpMax,0,1);
  playerHpClass($("charHpBar"),charHpFrac);
  $("charHpFill").style.width=`${charHpFrac*100}%`;
  if($("charXpBar")) $("charXpBar").style.width=`${clamp(S.xp/Math.max(1,xpToNext(S.level)),0,1)*100}%`;
  $("charStamina").textContent=`${Math.max(0,Math.round(Number(S.protection)||0))} / ${Math.max(Math.round(Number(S.protection)||0),Math.round(Number(S.protectionMax)||0))}`;
  if($("charGold")) $("charGold").innerHTML=formatGoldHtml(S.gold||0);
  renderCharacterStats();
  $("charFolkTrait").innerHTML=`<b>${esc(S.folk)} Folk trait</b> · ${formatFolkMods(S.folkMods)}`;
  if($("charSpecialization")) $("charSpecialization").textContent=S.specialization||"—";
  renderCharacterCombatStats();

  $("charSkills").innerHTML=SKILL_ORDER.map(id=>{
    const def=SKILL_DEFS[id],st=skillState(id),rating=skillRating(id),apt=skillAptitude(id),prof=proficiencyBonus(id),rankNotice=skillHasRankNotice(id);
    return `<div class="char-field-skill${rankNotice?" has-rank-notice":""}"><div><b>${esc(def.name)}${rankNotice?`<span class="skill-rank-new">New rank</span>`:""}</b><p><strong>${def.stat}</strong> · ${esc(def.desc)} · aptitude ${signed(formatRating(apt))}${prof?` · class proficiency ${signed(prof)}`:""}</p></div><div class="char-field-progress"><strong>Rank ${st.rank} · Rating ${formatRating(rating)}</strong><span>${st.xp}/${skillXpNeeded(st.rank)} XP</span></div></div>`;
  }).join("");

  const seen=[...FOES,BOSS_PROFILE].filter(f=>S.seenFoes?.[f.id]||knowledgeReads(f.id)>0);
  $("charBestiary").innerHTML=seen.length?seen.map(f=>{
    const reads=knowledgeReads(f.id),tier=knowledgeTier(f.id),drops=DROP_HINTS[f.id]||[];
    const dropText=reads>=3?`<span class="drops">Probably carries: ${esc(drops.join(" · ")||"unknown")}</span>`:"";
    const awarenessText=reads>=3?` · Awareness ${formatRating(f.awareness??0)}`:"";
    return `<div class="char-field-skill bestiary"><div><b>${esc(cap(f.name))}</b><p>${reads?`${cap(tier)} · ${reads}/6 knowledge${awarenessText}`:"Encountered · not yet Read"}${dropText}</p></div><div class="char-field-progress"><strong>${reads>=6?"Mastered":reads>=3?"Studied":reads?"Known":"Unknown"}</strong><span>${reads>=3?"drops + Awareness known":"study to learn drops"}</span></div></div>`;
  }).join(""):`<div class="char-field-note">No archetypes recorded yet.</div>`;

  renderQuestPage();
  renderStatusEffects();
  $("charAbilitySummary").textContent=`${abilityUsesReady()} / ${abilityUsesMax()} uses ready`;
  $("charAbilities").innerHTML=classAbilityOrder().map(id=>{
    const def=ABILITY_DEFS[id],sk=abilityState(id),open=charExpandedAbility===id,usable=canFieldUseAbility(id);
    const field=!!def.fieldOnly || ["layonhands","mend"].includes(id);
    const fieldLabel=id==="concealment"?(concealmentActive()?`Active · ${formatEffectTime(S.concealment.remainingMs)}`:sk.cur<=0?"Spent":"Use now"):(S.hp>=S.hpMax?"Full HP":sk.cur<=0?"Spent":"Use now");
    return `<div class="char-skill"><div class="char-skill-top"><b>${esc(def.name)} ${esc(sk.degree)}</b><span>${sk.cur}/${sk.max} uses</span></div><p>${esc(def.desc)}</p>${field?`<div class="char-ability-actions"><button class="char-field-use" data-field-ability="${id}" ${usable?"":"disabled"}>${esc(fieldLabel)}</button></div>`:""}<button class="skill-more" data-char-ability-more="${id}">${open?"Hide details":"See more"}</button><div class="skill-detail" ${open?"":"hidden"}>${abilityDetailHtml(def)}</div></div>`;
  }).join("");
  renderEquipmentUI();
  renderCharacterNotices();
  renderCharacterView();
}


function ensureRunPacing(){
  if(!S)return {foregroundMs:0,movementMs:0,milestones:{}};
  if(!S.runPacing||typeof S.runPacing!=="object"||Array.isArray(S.runPacing))S.runPacing={foregroundMs:0,movementMs:0,milestones:{}};
  S.runPacing.foregroundMs=Math.max(0,Number(S.runPacing.foregroundMs)||0);
  S.runPacing.movementMs=Math.max(0,Number(S.runPacing.movementMs)||0);
  if(!S.runPacing.milestones||typeof S.runPacing.milestones!=="object"||Array.isArray(S.runPacing.milestones))S.runPacing.milestones={};
  return S.runPacing;
}
function noteRunForeground(ms=0){
  if(!S||over)return;
  const dt=Math.max(0,Math.min(1000,Number(ms)||0));if(!dt)return;
  ensureRunPacing().foregroundMs+=dt;
}
function noteRunMovement(ms=0){
  if(!S||over)return;
  const dt=Math.max(0,Math.min(1000,Number(ms)||0));if(!dt)return;
  ensureRunPacing().movementMs+=dt;
}
function recordRunDepthMilestones(beforeDepth,afterDepth){
  if(!S)return;
  const before=Math.max(0,Number(beforeDepth)||0),after=Math.max(before,Number(afterDepth)||before),p=ensureRunPacing();
  for(const mark of [100,250,500,1000]){
    if(before<mark&&after>=mark&&p.milestones[String(mark)]==null)p.milestones[String(mark)]=Math.round(p.foregroundMs);
  }
}
function formatRunPacingTime(ms){
  const total=Math.max(0,Math.round((Number(ms)||0)/1000)),m=Math.floor(total/60),s=total%60,h=Math.floor(m/60),mm=m%60;
  return h?`${h}:${String(mm).padStart(2,"0")}:${String(s).padStart(2,"0")}`:`${mm}:${String(s).padStart(2,"0")}`;
}
function advanceRestRecoveryFromDepth(beforeDepth,afterDepth){
  if(!S)return 0;
  const gain=Math.max(0,(Number(afterDepth)||0)-(Number(beforeDepth)||0));
  if(gain>0)S.restRecovery=Math.min(REST_RECOVERY_REQUIRED,Math.max(0,Number(S.restRecovery)||0)+gain);
  return gain;
}
function restHealAmount(){
  return Math.max(1, Math.round(S.hpMax * REST_HEAL_FRACTION));
}
function restReady(){
  return !!S && S.restRecovery >= REST_RECOVERY_REQUIRED - 0.001;
}
function abilityState(id){
  return S?.abilities?.[id] || null;
}
function abilityUsesReady(){ return classAbilityOrder().reduce((n,id)=>n+(abilityState(id)?.cur||0),0); }
function abilityUsesMax(){ return classAbilityOrder().reduce((n,id)=>n+(abilityState(id)?.max||0),0); }
function combatAbilityOrder(){ return classAbilityOrder().filter(id=>!ABILITY_DEFS[id]?.fieldOnly); }
function combatAbilityUsesReady(){ return combatAbilityOrder().reduce((n,id)=>n+(abilityState(id)?.cur||0),0); }
function combatAbilityUsesMax(){ return combatAbilityOrder().reduce((n,id)=>n+(abilityState(id)?.max||0),0); }
function abilitiesNeedRestoration(){ return classAbilityOrder().some(id=>{const sk=abilityState(id);return sk&&sk.cur<sk.max;}); }
function canRest(){
  return !!S && !over && !S.foe && !S.travelEvent && !S.pendingRestAbilityChoice &&
    !encounterWarningActive() && restReady() &&
    (S.hp < S.hpMax || abilitiesNeedRestoration());
}
function hollowKey(stratum, kind, ordinal=null){
  return ordinal===null ? `${stratum}:${kind}` : `${stratum}:${kind}:${ordinal}`;
}
function stageHollowInfo(stratum){
  return {stratum,kind:"stage",key:hollowKey(stratum,"stage"),depth:(stratum+1)*FATHOMS_PER_STRATUM-HOLLOW_STAGE_MARGIN};
}
function ordinaryHollowsForStratum(stratum){
  const base=stratum*FATHOMS_PER_STRATUM, stageDepth=stageHollowInfo(stratum).depth;
  const out=[];
  for(let depth=base+HOLLOW_FIRST_OFFSET,ordinal=0;depth<stageDepth-10;depth+=HOLLOW_SPACING,ordinal++){
    out.push({stratum,kind:"ordinary",key:hollowKey(stratum,"ordinary",ordinal),depth});
  }
  return out;
}
function findCrossedHollow(beforeDepth, afterDepth){
  const first = Math.max(0, Math.floor(beforeDepth / FATHOMS_PER_STRATUM));
  const last = Math.max(first, Math.floor(afterDepth / FATHOMS_PER_STRATUM));
  const candidates = [];
  for(let i = first; i <= last; i++) candidates.push(...ordinaryHollowsForStratum(i),stageHollowInfo(i));
  return candidates
    .filter(h => h.depth > beforeDepth + 0.0001 && h.depth <= afterDepth + 0.0001)
    .filter(h => !S.hollowStates[h.key])
    .sort((a,b) => a.depth - b.depth)[0] || null;
}
function clearHollowTimer(){
  if(hollowTimer !== null){
    clearInterval(hollowTimer);
    hollowTimer = null;
  }
}
function startHollowTimer(){
  clearHollowTimer();
  const h = S?.activeHollow;
  if(!h || h.kind === "stage" || h.autoResumeCancelled) return;
  hollowTimer = setInterval(() => {
    if(!S?.activeHollow || S.activeHollow.key !== h.key){
      clearHollowTimer();
      return;
    }
    if(Date.now() >= S.activeHollow.autoResumeAt){
      leaveHollow(true);
      return;
    }
    renderSafeHollow();
  },100);
}
function cancelHollowAutoResume(){
  const h = S?.activeHollow;
  if(!h || h.kind === "stage" || h.autoResumeCancelled) return;
  h.autoResumeCancelled = true;
  clearHollowTimer();
  renderSafeHollow();
}
function discoverHollow(h){
  closePack();
  S.depth = h.depth;
  pauseBoonClock();
  S.travelMode = "stopped";
  S.travelSinceEvent = 0;
  S.hollowStates[h.key] = "found";
  S.activeHollow = {
    ...h,
    autoResumeCancelled:h.kind === "stage",
    autoResumeAt:h.kind === "stage" ? null : Date.now() + HOLLOW_AUTO_RESUME_MS
  };
  travelLogAdd(h.kind === "stage"
    ? `<b>Staging hollow.</b> Safe ground before the stratum boundary.`
    : `<b>Safe hollow.</b> You could make camp here.`, "beat");
  render();
  startHollowTimer();
}
function leaveHollow(auto=false){
  const h = S?.activeHollow;
  if(!h) return;
  clearHollowTimer();
  S.hollowStates[h.key] = "passed";
  S.activeHollow = null;
  S.travelMode = "descend";
  resumeBoonClock();
  travelLogAdd(auto
    ? `You move on from the hollow.`
    : `You leave the hollow behind and continue down.`, "note");
  render();
}
function campAtHollow(){
  if(encounterWarningActive()) return;
  const h=S?.activeHollow;
  if(!h) return;
  if(S.inventory.campSupplies<=0) return restAtEmptyHollow();
  const wasBleeding=!!S.bleeding;
  clearHollowRespite();
  cancelHollowAutoResume();
  clearHollowTimer();
  const beforeHp=S.hp;
  const campHeal=Math.max(1,Math.round(S.hpMax*CAMP_HEAL_FRACTION));
  S.inventory.campSupplies--;
  S.hp=Math.min(S.hpMax,S.hp+campHeal);
  const healedHp=S.hp-beforeHp;
  S.stamina=S.staminaMax;
  ensureWorldCombatResources();
  S.combatResources.energy=WORLD_COMBAT_RESOURCE_MAX;
  S.combatResources.mana=WORLD_COMBAT_RESOURCE_MAX;
  S.combatResources.focus=0;
  S.worldCombatGuardUntil=0;S.worldCombatQueuedPower=null;
  S.heavyCharge=0;
  S.strikeChain=0;
  S.defenceChain=0;
  S.abilityQuickUsed=false;
  restoreAllAbilities();
  S.restRecovery=REST_RECOVERY_REQUIRED;
  S.hollowStates[h.key]="used";
  S.activeHollow=null;
  pauseBoonClock();
  S.travelMode="stopped";
  S.pendingBoonChoice=true;
  if(wasBleeding)clearBleeding();
  travelLogAdd(`You make camp. <b>${healedHp} HP recovered · all ability uses restored.</b> Choose a boon for the next stretch.`,"good");
  if(healedHp>0) triggerHealFx(healedHp,["travel"]);
  render();
}
function takeRest(){
  if(!canRest()) return;
  const wasBleeding=!!S.bleeding;
  cancelHollowAutoResume();
  pauseBoonClock();
  S.travelMode="stopped";
  const before=S.hp;
  const nominal=restHealAmount();
  S.hp=Math.min(S.hpMax,S.hp+nominal);
  const healed=S.hp-before;
  S.restRecovery=0;
  ensureWorldCombatResources();
  S.combatResources.energy=Math.min(WORLD_COMBAT_RESOURCE_MAX,S.combatResources.energy+45);
  S.combatResources.mana=Math.min(WORLD_COMBAT_RESOURCE_MAX,S.combatResources.mana+20);
  S.combatResources.focus=Math.max(0,S.combatResources.focus-30);
  if(healed>0) triggerHealFx(healed,["travel"]);
  const recovered=healed>0?` recover <b>${healed} HP</b>`:` steady yourself`;
  if(abilitiesNeedRestoration()){
    S.pendingRestAbilityChoice=true;
    travelLogAdd(`You rest and${recovered}. Choose one spent ability use to restore.`,"good");
  }else{
    travelLogAdd(`You rest and${recovered}.`,"good");
  }
  if(wasBleeding){
    clearBleeding();
    travelLogAdd(`Rest also stopped the <b>Bleeding</b>.`,"good");
  }
  render();
}
function openPack(mode=null,tab="backpack",returnTarget=null){
  if(!S || over) return;
  const combat=!!S.foe;
  if(combat && mode!=="combat") return;
  if(!combat && mode==="combat") return;
  if(S.travelEvent && mode!=="offering") return;
  cancelHollowAutoResume();
  S.packMode=mode;
  packReturnTarget=returnTarget;
  packActiveTab=(mode==="offering"||mode==="combat")?"backpack":(["backpack","equipment"].includes(tab)?tab:"backpack");
  $("packSheet").hidden=false;
  setFloatingWindowEnabled("backpack",!combat&&mode===null);
  renderPack(false);
  syncBrowseTravelUI();
  if(typeof requestAnimationFrame==="function") requestAnimationFrame(restorePackViewState);
}
function closePack(){
  rememberPackViewState();
  if(S) S.packMode=null;
  packReturnTarget=null;
  $("packSheet").hidden=true;
  syncBrowseTravelUI();
}
function backFromPack(){
  if(S?.packMode==="merchant") return leaveMerchant();
  if(packReturnTarget==="characterEquipment"){
    rememberPackViewState();
    if(S) S.packMode=null;
    packReturnTarget=null;
    $("packSheet").hidden=true;
    charView="equipment";
    openCharacterSheet();
    syncBrowseTravelUI();
    return;
  }
  closePack();
}
function renderPack(rememberView=true){
  if(!S) return;
  if(rememberView) rememberPackViewState();
  rememberEquipmentFilterScroll();
  ensureEquipmentState();
  const offer=S.packMode==="offering";
  const combatPack=S.packMode==="combat" && !!S.foe;
  if(offer||combatPack) packActiveTab="backpack";
  const packClose=$("btnPackClose");
  if(packClose){
    const returning=packReturnTarget==="characterEquipment",inTown=!!currentTown();
    packClose.textContent=returning?"← Back to Character":combatPack?"Back to combat":inTown?"Back to town":"Back to the delve";
    packClose.setAttribute("aria-label",returning?"Back to Character Equipment":combatPack?"Back to combat":inTown?"Back to town":"Back to the delve");
  }

  const tabs=$("packTabs"), currencyLabel=$("packCurrencyLabel"), merchantStrip=$("merchantStrip"), merchantHead=$("merchantCombatHead"), packSheet=$("packSheet");
  if(packSheet) packSheet.classList.toggle("merchant-mode", S.packMode==="merchant");
  if(S.packMode==="merchant"){
    const m=currentMerchant(),buyOnly=!!m?.buyOnly;
    if(buyOnly) merchantView="buy";
    tabs.classList.add("merchant-tabs");
    tabs.classList.toggle("buy-only",buyOnly);
    tabs.innerHTML=buyOnly
      ? `<button class="pack-tab active" type="button" data-merchant-view="buy">Buy</button>`
      : `<button class="pack-tab ${merchantView==="buy"?"active":""}" type="button" data-merchant-view="buy">Buy</button><button class="pack-tab ${merchantView==="sell-equipment"?"active":""}" type="button" data-merchant-view="sell-equipment">Sell Gear</button><button class="pack-tab ${merchantView==="sell-backpack"?"active":""}" type="button" data-merchant-view="sell-backpack">Sell Pack</button>`;
    if(currencyLabel) currencyLabel.textContent="Your purse";
    if($("packGold")) $("packGold").innerHTML=formatGoldHtml(S.gold||0);
    if(merchantHead){
      merchantHead.hidden=!m;
      if(m){
        $("merchantHeadName").textContent=merchantDisplayName(m);
        $("merchantHeadPurse").innerHTML=`${m.context==="town"?"Shop purse":"Merchant Purse"} · ${formatGoldHtml(m.purse)}`;
        if($("merchantHeadKind")) $("merchantHeadKind").textContent=m.context==="town"?(m.serviceId==="herbalist"?"Herbalist":"Town market"):"Merchant camp";
        $("merchantHeadNote").textContent=m.context==="town"
          ? `${m.serviceId==="herbalist"?"Town medicine":"Town market"} · better rates than the road · ${m.stock.filter(x=>(x.kind!=="supply")||x.qty>0).length} goods visible`
          : `Neutral trader · ${m.stock.filter(x=>(x.kind!=="supply")||x.qty>0).length} goods visible`;
        $("merchantHeadIntentText").textContent = merchantView==="buy"
          ? "Browse the stock — spend coins to purchase carried goods."
          : merchantView==="sell-equipment"
            ? "Sell gear — bundle equipment the merchant can afford."
            : "Sell pack goods — choose exactly how many units to trade.";
      }
    }
    if(merchantStrip){ merchantStrip.hidden=true; merchantStrip.innerHTML=""; }
  }else{
    tabs.classList.remove("buy-only");
    tabs.classList.remove("merchant-tabs");
    tabs.innerHTML=`<button class="pack-tab ${packActiveTab==="backpack"?"active":""}" id="btnPackTabBackpack" type="button" data-pack-tab="backpack" role="tab" aria-selected="${packActiveTab==="backpack"?"true":"false"}">Backpack</button><button class="pack-tab ${packActiveTab==="equipment"?"active":""}" id="btnPackTabEquipment" type="button" data-pack-tab="equipment" role="tab" aria-selected="${packActiveTab==="equipment"?"true":"false"}">Equipment</button>`;
    if(currencyLabel) currencyLabel.textContent="Coins";
    if($("packGold")) $("packGold").innerHTML=formatGoldHtml(S.gold||0);
    if(merchantStrip){ merchantStrip.hidden=true; merchantStrip.innerHTML=""; }
    if(merchantHead) merchantHead.hidden=true;
  }
  const filterBar=$("packFilterBar");
  const root=$("packDynamicItems");
  if(!filterBar || !root) return;
  const itemRow=(name,count,desc,actions="")=>`<div class="pack-item compact"><div class="pack-item-top"><b>${esc(name)}</b><strong>×${count}</strong></div><p>${esc(desc)}</p>${actions?`<div class="pack-actions">${actions}</div>`:""}</div>`;

  if(S.packMode==="merchant"){
    const m=currentMerchant(),townTrade=m?.context==="town";
    packClose.textContent=townTrade?"Back to town":"Leave merchant";
    packClose.setAttribute("aria-label",townTrade?"Close trade and return to town":"Leave merchant and continue descending");
    if(merchantView==="buy"){
      const m=currentMerchant();
      filterBar.innerHTML=`<div class="merchant-note-quiet"><b>Buy</b> from ${esc(merchantDisplayName(m))}. Purchased goods enter your Backpack; what you buy increases the shop purse.</div>`;
      const rows=(m?.stock||[]).filter(row=>row.kind!=="supply" || row.qty>0);
      root.innerHTML=rows.length?rows.map(row=>{
        const price=merchantBuyPrice(row), afford=(S.gold||0)>=price;
        if(row.kind==="equipment"){
          const g=equipmentItemDef(row.itemId); const frame=rarityFrameClass(g?.rarity||"Common");
          const pending=merchantPendingPurchase===row.id;
          return `<div class="pack-item compact equipment-pack ${frame}">${g?raritySparkles(g.rarity,`merchant:${row.id}`):""}<div class="pack-item-top"><b class="${rarityClass(g?.rarity||"Common")}">${esc(g?.name||"Unknown item")}${row.kind==="equipment"&&row.resale?`<span class="merchant-stock-tag">resold</span>`:""}</b><strong class="${rarityClass(g?.rarity||"Common")}">iLv ${g?.itemLevel||0}</strong></div><div class="merchant-stock-meta"><span>${esc(g?.rarity||"Common")} · ${esc(equipmentTypeLabel(g))} · IV ${Math.round(computedIntrinsicValue(g))}</span></div>${merchantEquipmentStatsHtml(g)}${merchantEquipmentCompareHtml(row.itemId)}<p>${esc(g?.desc||"")}</p><div class="merchant-price-row"><span>Merchant price</span><b>${formatGoldHtml(price)}</b></div><div class="pack-actions">${pending?`<button class="pack-mini-btn good" data-merchant-confirm-buy="${row.id}">Confirm purchase</button><button class="pack-mini-btn" data-merchant-cancel-buy>Cancel</button>`:`<button class="pack-mini-btn good" ${afford?"":"disabled"} data-merchant-buy="${row.id}">Buy</button>`}</div></div>`;
        }
        const pending=merchantPendingPurchase===row.id;
        return `<div class="pack-item compact"><div class="pack-item-top"><b>${esc(row.label)}</b><strong>×${Math.max(0,row.qty||0)}</strong></div><div class="merchant-stock-meta"><span>Supply</span></div><p>${esc(row.desc||"")}</p><div class="merchant-price-row"><span>Merchant price</span><b>${formatGoldHtml(price)}</b></div><div class="pack-actions">${pending?`<button class="pack-mini-btn good" data-merchant-confirm-buy="${row.id}">Confirm purchase</button><button class="pack-mini-btn" data-merchant-cancel-buy>Cancel</button>`:`<button class="pack-mini-btn good" ${afford?"":"disabled"} data-merchant-buy="${row.id}">Buy 1</button>`}</div></div>`;
      }).join(""):`<div class="pack-note">This merchant has sold out.</div>`;
      $("packNote").textContent=currentMerchant()?.context==="town"?"Town stock persists for this visit. Market prices are better than wandering-merchant rates.":"Merchant stock is finite. Buying raises the merchant purse; if you later sell something back, the same merchant can afford more.";
    }else if(merchantView==="sell-equipment"){
      filterBar.innerHTML=`<div class="merchant-scope"><button class="${merchantSellGearScope==="backpack"?"active":""}" data-merchant-gear-scope="backpack">Backpack Gear</button><button class="${merchantSellGearScope==="equipped"?"active":""}" data-merchant-gear-scope="equipped">Equipped Gear</button></div><div class="equipment-filter-row" data-equipment-filter-context="pack">${equipmentFilterButtonsHtml()}</div>`;
      const rows=merchantEquipmentSellRows();
      root.innerHTML=rows.length?rows.map(row=>{
        const g=equipmentItemDef(row.itemId), selected=merchantSellSelection.equipment.has(row.itemId), payout=merchantSellValueForEquipment(row.itemId), frame=rarityFrameClass(g?.rarity||"Common");
        return `<div class="pack-item compact equipment-pack ${frame}">${g?raritySparkles(g.rarity,`sell:${row.itemId}`):""}<div class="pack-item-top"><b class="${rarityClass(g?.rarity||"Common")}">${esc(g?.name||row.itemId)}<span class="pack-tag ${row.equipped?"equipped":""}">${esc(row.location)}</span></b><strong class="${rarityClass(g?.rarity||"Common")}">iLv ${g?.itemLevel||0}</strong></div><div class="merchant-stock-meta"><span>${esc(g?.rarity||"Common")} · ${esc(equipmentTypeLabel(g))} · IV ${Math.round(computedIntrinsicValue(g))}</span></div>${merchantEquipmentStatsHtml(g)}${merchantEquipmentCompareHtml(row.itemId)}<p>${esc(g?.desc||"")}</p>${row.equipped?`<div class="merchant-equip-warning"><b>Equipped item.</b> Selling this immediately removes it from your current loadout.</div>`:""}<div class="merchant-price-row"><span>Merchant offers</span><b>${formatGoldHtml(payout)}</b></div><div class="pack-actions"><button class="merchant-check ${selected?"on":""}" data-merchant-toggle-equip="${row.itemId}" data-equipped-warning="${row.equipped?"1":"0"}">${selected?"Selected":row.equipped?"Select equipped ⚠":"Select"}</button></div></div>`;
      }).join("")+(()=>{ const total=merchantSelectedEquipmentPayout(), count=merchantSellSelection.equipment.size, afford=merchantCanAfford(total); return `<div class="merchant-summary"><b>${count} item${count===1?"":"s"} selected · ${formatGoldHtml(total)}</b><span>${afford?`Merchant can pay. Purse remaining after sale: ${formatGoldHtml((currentMerchant()?.purse||0)-total)}`:`Merchant cannot afford this bundle yet.`}</span><div class="pack-actions"><button class="pack-mini-btn good" ${count&&afford?"":"disabled"} data-merchant-sell-equipment>Sell selected</button></div></div>`; })():`<div class="pack-note">No sellable equipment matches this filter.</div>`;
      $("packNote").textContent="Select one or more equipped or backpack gear pieces, then sell them as a bundle if the merchant can afford the total.";
    }else{
      filterBar.innerHTML=`<div class="merchant-note-quiet"><b>Sell Pack</b> Choose a quantity from each carried stack. Only the selected units are removed and paid for.</div>`;
      const rows=merchantBackpackSellRows();
      root.innerHTML=rows.length?rows.map(row=>{
        const qty=merchantBackpackSellQty(row.key,row.count), payout=merchantBackpackSellPayout(row.key,row.label,qty);
        return `<div class="pack-item compact"><div class="pack-item-top"><b>${esc(row.label)}</b><strong>×${row.count}</strong></div><div class="merchant-stock-meta"><span>Backpack stack · ${formatGold(merchantBackpackSellPayout(row.key,row.label,1))} each</span></div><p>${esc(row.desc||"")}</p><div class="merchant-price-row"><span>Offer for ${qty} of ${row.count}</span><b>${formatGoldHtml(payout)}</b></div><div class="pack-actions"><div class="merchant-qty" role="group" aria-label="Quantity of ${esc(row.label)} to sell"><button type="button" data-merchant-pack-qty="${esc(row.key)}" data-merchant-qty-delta="-1" ${qty<=0?"disabled":""}>−</button><span class="merchant-qty-output">${qty} / ${row.count}</span><button type="button" data-merchant-pack-qty="${esc(row.key)}" data-merchant-qty-delta="1" ${qty>=row.count?"disabled":""}>+</button><button class="merchant-qty-all" type="button" data-merchant-pack-qty="${esc(row.key)}" data-merchant-qty-all="1" ${qty===row.count?"disabled":""}>All</button></div></div></div>`;
      }).join("")+(()=>{ const total=merchantSelectedBackpackPayout(), units=merchantSelectedBackpackUnits(), afford=merchantCanAfford(total); return `<div class="merchant-summary"><b>${units} unit${units===1?"":"s"} selected · ${formatGoldHtml(total)}</b><span>${afford?`Merchant can pay. Purse remaining after sale: ${formatGoldHtml((currentMerchant()?.purse||0)-total)}`:`Merchant cannot afford these goods yet.`}</span><div class="pack-actions"><button class="pack-mini-btn good" ${units&&afford?"":"disabled"} data-merchant-sell-backpack>Sell selected quantities</button></div></div>`; })():`<div class="pack-note">No sellable backpack goods are currently carried.</div>`;
      $("packNote").textContent="Set each quantity from 0 up to the amount carried. Payout and inventory removal use that exact quantity.";
    }
    restoreEquipmentFilterScroll();
    return;
  }

  document.querySelectorAll("#packTabs [data-pack-tab]").forEach(btn=>{
    const active=btn.dataset.packTab===packActiveTab;
    btn.classList.toggle("active",active);
    btn.setAttribute("aria-selected",active?"true":"false");
    btn.disabled=(offer||combatPack) && btn.dataset.packTab==="equipment";
  });

  if(packActiveTab==="equipment"){
    filterBar.innerHTML=`<div class="equipment-filter-row" data-equipment-filter-context="pack">${equipmentFilterButtonsHtml()}</div>`;
    const filteredEquipment=sortedBackpackEquipment(equipmentFilter);
    root.innerHTML=filteredEquipment.length?filteredEquipment.map(id=>{
      const g=equipmentItemDef(id),target=recommendedEquipmentSlot(id,null,equipmentFilter),cmp=equipmentComparison(id,target,equipmentFilter);
      const armorDelta=(cmp.armorAfter??0)-(cmp.armorBefore??0),strikeDelta=(cmp.strikeAfter??0)-(cmp.strikeBefore??0);
      const attrConsequences=STAT_KEYS.map(stat=>{const d=(cmp.attributesAfter?.[stat]||0)-(cmp.attributesBefore?.[stat]||0);return d?`<span class="equipment-delta ${deltaClass(d)}">${stat} ${deltaText(d)}</span>`:"";}).join("");
      const specialConsequences=[];
      const defenceDelta=(cmp.defenceRatingAfter??0)-(cmp.defenceRatingBefore??0);if(Math.abs(defenceDelta)>.05)specialConsequences.push(`<span class="equipment-delta ${deltaClass(defenceDelta)}">Defence Rating ${deltaText(defenceDelta,1)}</span>`);
      const mitigationDelta=((cmp.physicalMitigationAfter??0)-(cmp.physicalMitigationBefore??0))*100;if(Math.abs(mitigationDelta)>.01)specialConsequences.push(`<span class="equipment-delta ${deltaClass(mitigationDelta)}">Physical DR ${deltaText(mitigationDelta,1)}%</span>`);
      const critDelta=(cmp.critChanceAfter??0)-(cmp.critChanceBefore??0);if(Math.abs(critDelta)>.001)specialConsequences.push(`<span class="equipment-delta same">Crit Chance ${deltaText(critDelta,2)}%</span>`);
      const critDmgDelta=(cmp.critDamageAfter??0)-(cmp.critDamageBefore??0);if(Math.abs(critDmgDelta)>.001)specialConsequences.push(`<span class="equipment-delta same">Crit Damage ${deltaText(critDmgDelta,1)}%</span>`);
      const affixConsequences=[["Boss","bossDamage","pct"],["Reflect","reflect","pct"],["Lifesteal","lifesteal","pct"]].map(([label,key,prop])=>{const d=(cmp.affixesAfter?.[key]?.[prop]||0)-(cmp.affixesBefore?.[key]?.[prop]||0);return d?`<span class="equipment-delta ${deltaClass(d)}">${label} ${deltaText(d)}%</span>`:"";}).join("");
      const consequences=`${Math.abs(armorDelta)>.001?`<span class="equipment-delta ${deltaClass(armorDelta)}">Armor ${deltaText(armorDelta)}</span>`:""}${attrConsequences}${Math.abs(strikeDelta)>.05?`<span class="equipment-delta ${deltaClass(strikeDelta)}">Attack Rating ${deltaText(strikeDelta,1)}</span>`:""}${specialConsequences.join("")}${affixConsequences}`;
      const frame=rarityFrameClass(g.rarity);
      return `<div class="pack-item compact equipment-pack ${frame}">${raritySparkles(g.rarity,`pack:${id}`)}<div class="pack-item-top"><b class="${rarityClass(g.rarity)}">${esc(g.name)}<span class="pack-tag">${esc(EQUIPMENT_SLOT_LABELS[target]||g.slot)}</span></b><strong class="${rarityClass(g.rarity)}">iLv ${g.itemLevel}</strong></div><div class="equipment-economy"><span>Intrinsic ${Math.round(computedIntrinsicValue(g))}</span><b>${formatGoldHtml(computedItemGoldValue(g))}</b></div><p>${esc(g.desc||"")}</p><div class="pack-compare"><span class="equipment-delta power">iLv ${deltaText(cmp.itemDelta)}</span><span class="equipment-delta power">Gear ${deltaText(cmp.gearDelta,1)}</span><span class="equipment-delta power">Value ${deltaText(cmp.valueDelta||0)}</span>${consequences}</div><div class="pack-actions"><button class="pack-mini-btn good" data-equip-equipment="${id}" data-equipment-target="${target||""}">Equip → ${esc(EQUIPMENT_SLOT_LABELS[target]||"slot")}</button></div></div>`;
    }).join(""):`<div class="pack-note">No carried equipment matches this filter.</div>`;
    $("packNote").textContent="Equipment is filtered by compatible slot and sorted by current iLv upgrade potential.";
  }else{
    filterBar.innerHTML=`<div class="equipment-filter-row">${backpackFilterButtonsHtml()}</div>`;
    const rows=[];
    const add=(category,html)=>rows.push({category,html});
    const offerBtn=(kind,label,count)=>offer&&count>0?`<button class="pack-mini-btn warn" data-offer-item="${kind}">Offer 1 ${esc(label)}</button>`:"";

    add("consumables",itemRow("Camp Supplies",S.inventory.campSupplies,"Found rarely on scavenger-type foes and in caches. Consumed when you make a full camp at a safe hollow."));
    add("other",itemRow("Specialization",1,S.specialization||"—"));
    const combatBandageLocked=combatPack&&(!playerTurnActive()||(Number(S.stamina)||0)<PLAYER_TURN_STAMINA);
    add("consumables",itemRow("Bandages",S.inventory.bandages,"Stops Bleeding. Commonly found as creature salvage or extra searched loot.",`${S.inventory.bandages>0&&S.bleeding?`<button class="pack-mini-btn good" data-use-bandage ${combatBandageLocked?"disabled":""}>${combatBandageLocked?"Bandage · needs 3 Stamina":"Use Bandage"}</button>`:""}${offerBtn("bandage","Bandage",S.inventory.bandages)}`));
    add("consumables",itemRow("Meat",S.inventory.meat,"A rough ration. Often found as creature salvage or searched loot; some old places may value it.",offerBtn("meat","Meat",S.inventory.meat)));
    add("tools",itemRow("Rope",S.inventory.rope,"General delving tool; can turn up in searched loot and caches. No dedicated use in this slice yet.",offerBtn("rope","Rope",S.inventory.rope)));
    add("consumables",itemRow("Water",S.inventory.water,"A carried jug/flask; can turn up in searched loot and caches. No dedicated use in this slice yet.",offerBtn("water","Water",S.inventory.water)));
    add("tools",itemRow("Rogue Tools",S.inventory.rogueTools,"Reusable lockpick and trap tools. Any class can use them. Goblin Scroungers are a known possible source."));
    if(S.inventory.passageKey) add("quest",itemRow(S.inventory.passageKey.name,1,"A unique key tied to the current side passage. It disappears when that passage ends."));
    for(const row of (S.inventory.questItems||[])){
      if((row.qty||0)<=0)continue;const inst=questInstanceById(row.questInstanceId),def=questDefById(inst?.definitionId),obj=questObjectiveDef(inst,row.objectiveId),required=obj?.required||inst?.objectives?.[row.objectiveId]?.required||row.qty;
      add("quest",`<div class="pack-item compact"><div class="pack-item-top"><b>${esc(row.name)}<span class="pack-tag">Quest</span></b><strong>×${row.qty}</strong></div><p>${esc(row.desc||"Quest-bound item.")}</p><span class="quest-pack-bind">For: ${esc(def?.title||"Unknown contract")} · ${questItemCount(row.questInstanceId,row.objectiveId)}/${required} · cannot be sold while bound</span></div>`);
    }
    for(const [name,count] of Object.entries(S.inventory.misc||{})) if(count>0) add(backpackMiscCategory(name),itemRow(name,count,"Prototype loot / secondary item.",offerBtn(`misc:${name}`,name,count)));

    const visible=backpackFilter==="all"?rows:rows.filter(row=>row.category===backpackFilter);
    let status="";
    if(backpackFilter==="all"){
      if(curseActive()) status+=`<div class="pack-item compact"><div class="curse-line"><b>${esc(S.curse.name)}</b> · ${S.curse.remaining} completed encounters remain · ${esc(S.curse.desc)}</div></div>`;
      if(S.bleeding) status+=`<div class="pack-item compact"><div class="curse-line"><b>Bleeding</b> · ${bleedSecondsRemaining()}s remain · 1 HP every 5s of active travel/combat.</div></div>`;
    }
    root.innerHTML=status+(visible.length?visible.map(row=>row.html).join(""):`<div class="pack-note">No carried items match this filter.</div>`);
    $("packNote").textContent=offer?"Choose one carried item to place on the altar. Equipment is unavailable while choosing an offering.":combatPack?"Combat Backpack · usable consumables spend your turn. Equipment changes are locked until the fight ends.":"Backpack categories: Consumables · Tools · Quest · Texts · Materials · Other.";
  }

  if(combatPack) document.querySelectorAll("[data-equip-weapon],[data-equip-equipment],[data-offer-item]").forEach(el=>el.disabled=true);
  if(encounterWarningActive()) document.querySelectorAll("[data-use-bandage],[data-equip-weapon],[data-equip-equipment],[data-offer-item]").forEach(el=>el.disabled=true);
  restoreEquipmentFilterScroll();
  restorePackViewState();
}

function spawnEncounter(options={}){
  if(S) S.travelEvent = null;
  const worldRealtime=!!options.worldRealtime;
  // Realtime world combat is not a modal scene. Selecting or being noticed by
  // a creature must not freeze the rest of the cavern or stop travel clocks by
  // itself; actual hostile pressure is tracked by the world bridge.
  if(!worldRealtime){
    companionEnterCombat();
    closePack();
    closeCharacterSheet();
    closeSettingsSheet(false);
    pauseBoonClock();
    S.travelMode = "stopped";
    S.travelSinceEvent = 0;
  }
  S.encounter++;
  S.turn = 1;
  S.combatActor = "player";
  S.combatExtraTurns = {player:0,enemy:0}; // legacy field retained for save compatibility
  S.combatTimeline = null;
  S.reactionMax = 3;
  S.reactionPoints = 3;
  S.reactionAvailable = false;
  S.reactionWindow = false;
  S.protectionMax = 0;
  S.protectionSource = null;
  S.defencePrepared = null;
  S.negateNextAttack = null;
  S.heavyCharge = 0;
  S.strikeChain = 0;
  S.defenceChain = 0;
  S.protection = 0;
  S.abilityQuickUsed = false;
  S.combatLog = [];
  combatLogCollapsed = true;
  armed = null;

  const base = options.profile || (options.boss ? BOSS_PROFILE : chooseFoeProfile());
  travelLogAdd(options.caravan
    ? `You enter the caravan fight. <b>${cap(article(base.name))}</b> turns toward you.`
    : options.surprise
      ? `You move first from concealment. <b>${cap(article(base.name))}</b> has not reacted yet.`
      : options.playerInitiated
        ? `You mark <b>${cap(article(base.name))}</b> as your target.`
        : `Something moves in the dark. <b>${cap(article(base.name))}</b> notices you.`,options.surprise?"good":options.playerInitiated?"note":"danger");
  const hpRoll = 0.94 + rnd()*0.12;
  const hpProfile = base.hp/34;
  const atkProfile = base.atk/7;
  const hpMax = Math.max(1,Math.round(expectedStrikeAtDepth(S.depth)*4.5*hpProfile*hpRoll));
  const firstSeen = !S.seenFoes[base.id];

  S.foe = {
    key:base.id,name:base.name,profile:base,
    lv:Math.max(1,1+Math.floor(depthGrowth(S.depth)/5)+base.danger),
    hp:hpMax,hpMax,atk:Math.max(1,Math.round(expectedEnemyHitAtDepth(S.depth)*atkProfile)),
    weakness:base.weakness,revealed:knowledgeReads(base.id)>=1,
    readUsed:false,whetstoneUsed:false,intent:null,heavyStage:0,backgroundCharges:[],
    blinded:false,offBalance:false,offBalanceStruck:false,feintBaitedDodge:false,reaction:null,noDodgeNextReaction:false,
    worldRealtime:!!options.worldRealtime,evading:false
  };
  if(options.rescueGuardian)S.foe.rescueGuardian=cloneForSave(options.rescueGuardian);
  if(options.escortThreat)S.foe.escortThreat=cloneForSave(options.escortThreat);
  S.seenFoes[base.id] = true;
  if(firstSeen) markCharacterNotice("bestiary");
  if(options.caravan)S.foe.caravan={...options.caravan};

  if(options.side){
    S.foe.side = true;
    S.foe.name = `cursed ${S.foe.name}`;
    S.foe.cursed = true;
    travelLogAdd(`<b>${esc(cap(S.foe.name))}</b> carries the same wrongness as the passage.`,"danger");
  }
  if(options.boss){
    const idx = options.bossStratum ?? Math.max(0,Math.floor(S.depth/FATHOMS_PER_STRATUM));
    S.foe.boss = true;S.foe.bossStratum = idx;S.foe.midBoss=!!options.midBoss;S.foe.sideBoss=!!options.sideBoss;
    if(options.midBoss||options.sideBoss){
      S.foe.key=base.id;S.foe.name=base.name;S.seenFoes[base.id]=true;
      travelLogAdd(options.sideBoss?`<b>Passage guardian.</b> The longest route has put something dangerous at its end.`:`<b>Mid-stratum boss.</b> A dangerous figure controls this stretch of the descent.`,"beat");
    }else{
      S.foe.key = BOSS_PROFILE.id;
      S.foe.name = idx>0 ? `prototype ${stratumName(idx).replace(/^The /,"").toLowerCase()} boss` : BOSS_PROFILE.name;
      S.seenFoes[BOSS_PROFILE.id] = true;
      travelLogAdd(`<b>Stratum boss encounter.</b> Its intent weighting becomes much more Heavy-focused below half HP.`,"beat");
    }
  }
  if(options.mimic){
    S.foe.mimic = true;
    S.foe.name = MIMIC_PROFILE.name;
    S.foe.key = MIMIC_PROFILE.id;
    travelLogAdd(`<b>${esc(cap(MIMIC_PROFILE.name))}</b> unfolds from the shape of the chest.`,"danger");
  }

  if(S.foe.worldRealtime){
    // Physical-world combat never uses the old fade-to-modal transition. A stale
    // fade has pointer-events:none, which is why the controls could still work
    // underneath an apparently dead black screen. Retire it synchronously here.
    stopEncounterWarningFrame();clearCombatTransitionTimers();encounterWarningState=null;clearCombatTransitionVisual();
    ensureWorldCombatResources();S.worldCombatGuardUntil=0;S.worldCombatQueuedPower=null;S.foe.intent="engaged";S.foe.heavyStage=0;S.foe.reaction=null;
  }else{
    rollIntent();
    rollEnemyReaction();
    if(options.surprise){S.foe.surprised=true;S.foe.intent="unaware";S.foe.heavyStage=0;S.foe.reaction=null;}
    initCombatTimeline({surprise:!!options.surprise});
  }
  if(S.foe.revealed){
    S.foe.weaknessManualOpen = null;
    S.foe.weaknessAutoOpenUntil = S.turn;
  }
  say(options.surprise
    ? `<p class="said">You catch ${esc(article(S.foe.name))} before it can react.</p><p class="good">Surprise opening: it is <b>Unaware</b>. Your first action gets no enemy response.</p>`
    : `<p class="said">${cap(article(S.foe.name))} comes out of the dark.</p>`);
  render();
  return true;
}

function nextFoe(options={}){
  return queueEncounterWarning(options);
}

function renderTravelEvent(){
  const card=$("travelEventCard"),ev=S?.travelEvent;
  if(!card) return;
  card.hidden=!ev;
  if(!ev) return;
  if(ev.id==="caravan"&&ev.caravanType==="passing"){
    const event=pendingCaravan();
    if(event&&event.type!=="passing"){
      const copy=caravanEventCopy(event);
      ev.caravanType=event.type;ev.title=copy.title;ev.text=copy.text;ev.routeId=event.routeId;
    }
  }
  $("travelEventKind").textContent=ev.kind||"Exploration";
  $("travelEventTitle").textContent=ev.title||"";
  $("travelEventText").textContent=ev.text||"";
  const roll=$("travelEventRoll"),actions=$("travelEventActions");
  roll.hidden=!ev.rollHtml;
  roll.innerHTML=ev.rollHtml||"";

  if(ev.id==="rescue-clue"){
    const inst=questInstanceById(ev.questInstanceId),r=ensureRescueQuestState(inst),challenge=rescueSkillChallenge(ev.rescueDepth||S.depth,0);
    roll.hidden=!ev.rollHtml;roll.innerHTML=ev.rollHtml||"";
    if(ev.rescueKind==="tracks"){
      if(ev.stage==="result"){actions.innerHTML=`<button class="travel-event-btn wide skill" data-event-action="rescue-clue-continue"><b>Continue</b><span>leave this clue behind and keep descending</span></button>`;return;}
      const inv=!r?.trackAttempts?.investigation?`<button class="travel-event-btn investigate" data-event-action="rescue-tracks-investigation"><b>Examine the tracks</b><span>${skillCheckPreview("investigation",challenge)} · Investigation</span></button>`:"";
      const surv=!r?.trackAttempts?.survival?`<button class="travel-event-btn skill" data-event-action="rescue-tracks-survival"><b>Follow the signs</b><span>${skillCheckPreview("survival",challenge)} · Survival</span></button>`:"";
      actions.innerHTML=`${inv}${surv}<button class="travel-event-btn ignore ${inv&&surv?"wide":""}" data-event-action="rescue-tracks-leave"><b>Keep moving</b><span>leave these tracks behind permanently</span></button>`;return;
    }
    if(ev.rescueKind==="satchel"){
      if(ev.stage==="result"){actions.innerHTML=`<button class="travel-event-btn wide skill" data-event-action="rescue-clue-continue"><b>Continue</b><span>carry the satchel deeper</span></button>`;return;}
      actions.innerHTML=`<button class="travel-event-btn investigate" data-event-action="rescue-satchel-investigate"><b>Search the satchel</b><span>${skillCheckPreview("investigation",challenge)} · Investigation · identify what happened</span></button><button class="travel-event-btn skill" data-event-action="rescue-satchel-take"><b>Take the satchel</b><span>no check · secure it as quest evidence</span></button><button class="travel-event-btn ignore wide" data-event-action="rescue-satchel-leave"><b>Leave it</b><span>this clue will be behind you</span></button>`;return;
    }
  }

  if(ev.id==="rescue-search"){
    const inst=questInstanceById(ev.questInstanceId),r=ensureRescueQuestState(inst),difficulty=(r?.leads||0)>0?0:1,challenge=rescueSkillChallenge(ev.rescueDepth||S.depth,difficulty);
    roll.hidden=!ev.rollHtml;roll.innerHTML=ev.rollHtml||"";
    if(ev.stage==="lost"){actions.innerHTML=`<button class="travel-event-btn wide ignore" data-event-action="rescue-search-lost"><b>Move on</b><span>the hiding place is left behind · quest fails</span></button>`;return;}
    const per=!r?.hideoutAttempts?.perception?`<button class="travel-event-btn investigate" data-event-action="rescue-hideout-perception"><b>Listen carefully</b><span>${skillCheckPreview("perception",challenge)} · Perception${(r?.leads||0)?" · clue advantage":""}</span></button>`:"";
    const surv=!r?.hideoutAttempts?.survival?`<button class="travel-event-btn skill" data-event-action="rescue-hideout-survival"><b>Read the terrain</b><span>${skillCheckPreview("survival",challenge)} · Survival${(r?.leads||0)?" · clue advantage":""}</span></button>`:"";
    actions.innerHTML=`${per}${surv}<button class="travel-event-btn ignore ${per&&surv?"wide":""}" data-event-action="rescue-search-leave"><b>Keep descending</b><span>leave whatever is here behind</span></button>`;return;
  }

  if(ev.id==="rescue-hideout"){
    roll.hidden=!ev.rollHtml;roll.innerHTML=ev.rollHtml||"";
    actions.innerHTML=`<button class="travel-event-btn skill" data-event-action="rescue-hideout-approach"><b>Reach the refuge</b><span>clear the creature prowling outside, then check who is inside</span></button><button class="travel-event-btn ignore" data-event-action="rescue-hideout-leave"><b>Leave it behind</b><span>permanently fail the rescue</span></button>`;return;
  }

  if(ev.id==="escort-danger"){
    const inst=questInstanceById(ev.questInstanceId),challenge=rescueSkillChallenge(S.depth,0);
    roll.hidden=!ev.rollHtml;roll.innerHTML=ev.rollHtml||"";
    if(ev.stage==="result"){actions.innerHTML=`<button class="travel-event-btn wide skill" data-event-action="escort-danger-continue"><b>Keep moving</b><span>the danger has passed for now</span></button>`;return;}
    if(ev.stage==="spotted"){actions.innerHTML=`<button class="travel-event-btn skill" data-event-action="escort-danger-fight"><b>Stand your ground</b><span>fight the pursuer using normal combat</span></button><button class="travel-event-btn ignore" data-event-action="escort-danger-abandon"><b>Break away alone</b><span>escape the pursuit · lose Zeshava · quest fails</span></button>`;return;}
    actions.innerHTML=`<button class="travel-event-btn investigate" data-event-action="escort-danger-stealth"><b>Hide together</b><span>${skillCheckPreview("stealth",challenge)} · Stealth</span></button><button class="travel-event-btn skill" data-event-action="escort-danger-survival"><b>Find another route</b><span>${skillCheckPreview("survival",challenge)} · Survival</span></button><button class="travel-event-btn skill" data-event-action="escort-danger-fight"><b>Stand your ground</b><span>fight immediately</span></button><button class="travel-event-btn ignore wide" data-event-action="escort-danger-abandon"><b>Break away alone</b><span>leave Zeshava behind · quest fails</span></button>`;return;
  }

  if(ev.id==="quest-turnin"){
    const inst=questInstanceById(ev.questInstanceId),def=questDefById(inst?.definitionId),obj=def?.objectives?.[0],count=obj?questItemCount(inst.instanceId,obj.id):0;
    const reward=Math.min(Number(inst?.promisedRewards?.maxGold)||Infinity,count*(Number(inst?.promisedRewards?.goldPerUnit)||0));
    roll.hidden=false;roll.innerHTML=`<b>Carried:</b> ${count}/${obj?.required||0} ${esc(obj?.item?.name||"quest item")}${count===1?"":"s"}<br><b>Payment now:</b> ${formatGold(reward)}`;
    actions.innerHTML=`${count>0?`<button class="travel-event-btn skill" data-event-action="quest-deliver"><b>Deliver ${count}</b><span>complete ${count>=Number(obj?.required||0)?"the full order":"partially"} · receive ${formatGold(reward)}</span></button>`:""}<button class="travel-event-btn ignore ${count>0?"":"wide"}" data-event-action="quest-pass"><b>Pass the relay</b><span>quest becomes inactive · bound items remain until deleted</span></button>`;
    return;
  }

  if(ev.id==="loot-found"){
    roll.hidden=!ev.rollHtml; roll.innerHTML=ev.rollHtml||"";
    const challenge=Number.isFinite(S.pendingLoot?.searchChallenge)?S.pendingLoot.searchChallenge:authoredChallenge(12);
    actions.innerHTML=`<button class="travel-event-btn investigate" data-event-action="loot-investigation"><b>Investigate</b><span>${skillCheckPreview("investigation",challenge)} · search carefully</span></button><button class="travel-event-btn ignore wide" data-event-action="loot-continue"><b>Move on</b><span>your normal loot is already collected</span></button>`;
    return;
  }

  if(ev.id==="stealth-contact"){
    roll.hidden=!ev.rollHtml; roll.innerHTML=ev.rollHtml||"";
    actions.innerHTML=`<button class="travel-event-btn skill" data-event-action="stealth-ambush"><b>Ambush</b><span>start combat with a surprise opening · breaks Concealment</span></button><button class="travel-event-btn ignore" data-event-action="stealth-pass"><b>Let them pass</b><span>no combat XP or loot · remain concealed</span></button>`;
    return;
  }

  if(ev.id==="caravan"){
    roll.hidden=!ev.rollHtml;roll.innerHTML=ev.rollHtml||"";
    if(ev.stage==="quest-offer"){
      actions.innerHTML=`<button class="travel-event-btn skill" data-event-action="caravan-accept-quest"><b>Carry it forward</b><span>accept a normal delivery quest · item goes into your Backpack</span></button><button class="travel-event-btn ignore" data-event-action="caravan-decline-quest"><b>Move Along</b><span>safe · immediate · no penalty</span></button>`;
      return;
    }
    if(ev.stage==="result"){
      actions.innerHTML=`<button class="travel-event-btn wide skill" data-event-action="caravan-continue"><b>Continue</b><span>return to the descent</span></button>`;
      return;
    }
    if(ev.caravanType==="merchant"){
      actions.innerHTML=`<button class="travel-event-btn investigate" data-event-action="caravan-trade"><b>Trade</b><span>use the normal merchant buy/sell system</span></button><button class="travel-event-btn ignore" data-event-action="caravan-move"><b>Move Along</b><span>safe · immediate · no penalty</span></button>`;
      return;
    }
    const stealChallenge=authoredChallenge(ev.caravanType==="attacked"?14:12);
    const damagedHelpChallenge=authoredChallenge(12);
    const helpSub=ev.caravanType==="attacked"?"enter the fight using normal combat":`${skillCheckPreview("athletics",damagedHelpChallenge)} · Athletics · brace and shift the wagon`;
    actions.innerHTML=`<button class="travel-event-btn skill" data-event-action="${ev.caravanType==="attacked"?"caravan-help-attacked":"caravan-help-damaged"}"><b>Help</b><span>${helpSub}</span></button><button class="travel-event-btn investigate" data-event-action="caravan-steal"><b>Take advantage</b><span>${skillCheckPreview("stealth",stealChallenge)} · Stealth</span></button><button class="travel-event-btn ignore wide" data-event-action="caravan-move"><b>Move Along</b><span>safe · immediate · no penalty</span></button>`;
    return;
  }

  if(ev.id==="merchant"){
    roll.hidden=!ev.rollHtml; roll.innerHTML=ev.rollHtml||"";
    actions.innerHTML=`<button class="travel-event-btn investigate" data-event-action="merchant-trade"><b>Trade</b><span>open the merchant camp and inspect the stock</span></button><button class="travel-event-btn ignore" data-event-action="merchant-pass"><b>Pass by</b><span>resume the descent immediately</span></button>`;
    return;
  }

  const a=S?.sideArea;
  if(ev.id==="side-route-riddle"&&a){
    const r=a.activeRiddle, hintAttempts=Math.max(0,Number(r?.hintAttempts)||0), hintSkill=r?.hintSkill||"investigation";
    const answerButtons=(r?.answers||[]).map((answer,i)=>`<button class="travel-event-btn ${i===0?"skill":"investigate"}" data-event-action="side-riddle-${i}"><b>${esc(answer)}</b><span>choose this answer</span></button>`).join("");
    const hintButton=hintAttempts<(r?.hints?.length||0)?`<button class="travel-event-btn wide skill" data-event-action="side-riddle-hint"><b>Ask for a hint</b><span>${skillCheckPreview(hintSkill,sideHintChallenge(hintAttempts))} · ${esc(SKILL_DEFS[hintSkill]?.name||"Investigation")} · hint ${hintAttempts+1}/${r.hints.length}${hintAttempts?" · harder than the last":""}</span></button>`:"";
    actions.innerHTML=answerButtons+hintButton;
    return;
  }
  if(ev.id==="side-route-puzzle"&&a){
    const hp=a.activeRoutePuzzle||{}, hintAttempts=Math.max(0,Number(hp.hintAttempts)||0), hintButton=hintAttempts<(hp.hints?.length||0)?`<button class="travel-event-btn wide skill" data-event-action="side-route-puzzle-hint"><b>Ask for a hint</b><span>${skillCheckPreview("investigation",sideHintChallenge(hintAttempts))} · Investigation · hint ${hintAttempts+1}/${hp.hints.length}${hintAttempts?" · harder than the last":""}</span></button>`:"";
    actions.innerHTML=`${hintButton}<button class="travel-event-btn skill" data-event-action="side-puzzle-investigate"><b>Work out the release</b><span>${skillCheckPreview("investigation",trapDc(12))} · Investigation</span></button><button class="travel-event-btn investigate" data-event-action="side-puzzle-force"><b>Force the release</b><span>${skillCheckPreview("athletics",trapDc(12))} · Athletics</span></button><button class="travel-event-btn ignore wide" data-event-action="side-puzzle-bypass"><b>Risk the crawlspace</b><span>no check · lose 5% Max HP squeezing through</span></button>`;
    return;
  }
  if(ev.id==="side-altar"&&a&&ev.stage==="salvage"){
    actions.innerHTML=`<button class="travel-event-btn wide skill" data-event-action="finish-side"><b>Return to the descent</b><span>side passage complete</span></button>`;
    return;
  }
  if(ev.id==="side-altar"&&a&&sideFinaleType()!=="cache"){
    if(ev.stage==="mimic") actions.innerHTML=`<button class="travel-event-btn investigate" data-event-action="mimic-approach"><b>Approach the chest</b><span>something about it is wrong</span></button><button class="travel-event-btn ignore" data-event-action="leave-side-end"><b>Turn back</b><span>leave the chamber untouched</span></button>`;
    else if(ev.stage==="mimic-reward"||ev.stage==="reward") actions.innerHTML=`<button class="travel-event-btn wide skill" data-event-action="finish-side"><b>Return to the descent</b><span>side passage complete</span></button>`;
    else if(ev.stage==="puzzle-warning") actions.innerHTML=`<button class="travel-event-btn skill" data-event-action="puzzle-begin"><b>Attempt the five seals</b><span>need 3 successes · failure: 30% Max HP backlash</span></button><button class="travel-event-btn ignore" data-event-action="leave-side-end"><b>Leave it alone</b><span>return without risking the ward</span></button>`;
    else if(ev.stage==="puzzle-step"){
      const p=puzzleState(),step=puzzleCurrent(),hintState=puzzleStepHintState(),hintSkill=step.hintSkill||"investigation";
      const hintButton=hintState.attempts<(step.hints?.length||0)?`<button class="travel-event-btn wide skill" data-event-action="puzzle-hint"><b>Ask for a hint</b><span>${skillCheckPreview(hintSkill,sideHintChallenge(hintState.attempts))} · ${esc(SKILL_DEFS[hintSkill]?.name||"Investigation")} · hint ${hintState.attempts+1}/${step.hints.length}${hintState.attempts?" · harder than the last":""}</span></button>`:"";
      if(p.step===4) actions.innerHTML=`${hintButton}${S.inventory.water>0?`<button class="travel-event-btn skill" data-event-action="puzzle-water"><b>Use Water</b><span>consume 1 Jug of Water · guaranteed grounding success</span></button>`:""}<button class="travel-event-btn investigate" data-event-action="puzzle-athletics"><b>Ground it by force</b><span>${skillCheckPreview("athletics",trapDc(step.dc))} · STR · Athletics</span></button>`;
      else{
        const situational=step.skill==="sleight"&&S.inventory.rogueTools>0?2:0,label=SKILL_DEFS[step.skill].name;
        actions.innerHTML=`${hintButton}<button class="travel-event-btn skill wide" data-event-action="puzzle-skill"><b>Use ${esc(label)}</b><span>${skillCheckPreview(step.skill,trapDc(step.dc),situational)}${situational?" · Rogue Tools +2":""}</span></button>`;
      }
    }else if(ev.stage==="puzzle-result") actions.innerHTML=`<button class="travel-event-btn wide skill" data-event-action="puzzle-next"><b>${puzzleState().step>=4?"Resolve the ward":"Next seal"}</b><span>${puzzleState().successes}/3 successes needed · ${puzzleState().attempts}/5 attempted</span></button>`;
    return;
  }

  const sideIds=["side-discovery","side-retreat","side-inscription","side-trap","side-altar"];
  if(sideIds.includes(ev.id)){
    if(ev.id==="side-discovery"){
      if(ev.stage==="found") actions.innerHTML=`<button class="travel-event-btn investigate" data-event-action="side-enter"><b>Enter side passage</b><span>optional danger · depth stops here</span></button><button class="travel-event-btn ignore" data-event-action="side-leave-found"><b>Leave it alone</b><span>continue the main descent</span></button>`;
      else actions.innerHTML=`<button class="travel-event-btn wide" data-event-action="side-continue"><b>Continue</b><span>return to the main descent</span></button>`;
    }else if(ev.id==="side-retreat") actions.innerHTML=`<button class="travel-event-btn skill" data-event-action="side-keep"><b>Keep exploring</b><span>stay in the passage</span></button><button class="travel-event-btn ignore" data-event-action="side-abandon"><b>Turn back</b><span>abandon the passage and its remaining reward</span></button>`;
    else if(ev.id==="side-inscription") actions.innerHTML=ev.stage==="prompt"?`<button class="travel-event-btn skill" data-event-action="translate-wall"><b>Translate</b><span>${skillCheckPreview("translation",trapDc(12))}</span></button><button class="travel-event-btn ignore" data-event-action="side-event-resume"><b>Leave it</b><span>continue deeper</span></button>`:`<button class="travel-event-btn wide" data-event-action="side-event-resume"><b>Continue</b><span>the word stays with you</span></button>`;
    else if(ev.id==="side-trap"){
      if(ev.stage==="sense") actions.innerHTML=`<button class="travel-event-btn skill" data-event-action="trap-perception"><b>Use Perception</b><span>${skillCheckPreview("perception",trapDc(12))}</span></button><button class="travel-event-btn ignore" data-event-action="trap-cross"><b>Keep moving</b><span>risk whatever is ahead</span></button>`;
      else if(ev.stage==="found") actions.innerHTML=`<button class="travel-event-btn skill" data-event-action="trap-dismantle"><b>Dismantle</b><span>${skillCheckPreview("sleight",trapDc(13),S.inventory?.rogueTools>0?2:0)} · Rogue Tools</span></button><button class="travel-event-btn investigate" data-event-action="trap-destroy"><b>Destroy mechanism</b><span>${skillCheckPreview("athletics",trapDc(12))}</span></button>`;
      else actions.innerHTML=`<button class="travel-event-btn wide" data-event-action="side-event-resume"><b>Continue</b><span>the mechanism cannot be attempted again</span></button>`;
    }else if(ev.id==="side-altar"){
      if(ev.stage==="altar") actions.innerHTML=`<button class="travel-event-btn skill" data-event-action="translate-altar"><b>Translate inscription</b><span>${skillCheckPreview("translation",trapDc(13))}</span></button><button class="travel-event-btn investigate" data-event-action="choose-offering"><b>Make an offering</b><span>choose 1 item from Backpack</span></button><button class="travel-event-btn ignore wide" data-event-action="open-warded"><b>Ignore altar</b><span>approach the chest anyway</span></button>`;
      else if(ev.stage==="chest"){
        const key=S.inventory.passageKey?.id===S.sideArea.keyId,tools=S.inventory.rogueTools>0;
        actions.innerHTML=`${key?`<button class="travel-event-btn skill" data-event-action="use-side-key"><b>Use passage key</b><span>guaranteed · consumes key</span></button>`:""}${tools?`<button class="travel-event-btn investigate" data-event-action="pick-side-lock"><b>Pick lock</b><span>${skillCheckPreview("sleight",trapDc(13),S.inventory?.rogueTools>0?2:0)} · Rogue Tools</span></button>`:""}<button class="travel-event-btn investigate" data-event-action="force-side-chest"><b>Force it</b><span>${skillCheckPreview("athletics",trapDc(14))}</span></button><button class="travel-event-btn ignore wide" data-event-action="leave-side-end"><b>Leave it</b><span>abandon the chest and return</span></button>`;
      }else if(ev.stage==="jammed") actions.innerHTML=`<button class="travel-event-btn investigate" data-event-action="force-side-chest"><b>Force it</b><span>the delicate attempt is gone</span></button><button class="travel-event-btn ignore" data-event-action="leave-side-end"><b>Leave it</b><span>return empty-handed</span></button>`;
      else if(ev.stage==="failed-force") actions.innerHTML=`<button class="travel-event-btn wide ignore" data-event-action="leave-side-end"><b>Leave it</b><span>return to the main descent</span></button>`;
      else if(ev.stage==="reward") actions.innerHTML=`<button class="travel-event-btn wide skill" data-event-action="finish-side"><b>Return to the descent</b><span>side passage complete</span></button>`;
    }
    annotateCheckChoice("side-perception","perception",sideDiscoveryChallenge());
    annotateCheckChoice("translate-wall","translation",trapDc(12));
    annotateCheckChoice("trap-perception","perception",trapDc(12));
    annotateCheckChoice("trap-dismantle","sleight",trapDc(13),S.inventory?.rogueTools>0?2:0);
    annotateCheckChoice("trap-destroy","athletics",trapDc(12));
    annotateCheckChoice("translate-altar","translation",trapDc(13));
    annotateCheckChoice("pick-side-lock","sleight",trapDc(13),S.inventory?.rogueTools>0?2:0);
    annotateCheckChoice("force-side-chest","athletics",trapDc(14));
    if(ev.id==="side-altar"&&ev.stage==="altar"&&S.sideArea?.altarTranslationAttempted){
      const b=document.querySelector('[data-event-action="translate-altar"]');
      if(b){
        b.disabled=true;
        b.querySelector("b").textContent="Translation attempted";
        b.querySelector("span").textContent=S.sideArea.altarTranslationResult==="success"?"you have taken what you can from these words":"the inscription will not yield more to this attempt";
      }
    }
    return;
  }

  if(ev.stage==="noticed") actions.innerHTML=`<button class="travel-event-btn investigate" data-event-action="investigate-informed"><b>Investigate</b><span>Perception has already identified the unstable approach</span></button><button class="travel-event-btn ignore" data-event-action="leave"><b>Leave it</b><span>you know where the danger is</span></button>`;
  else actions.innerHTML=`<button class="travel-event-btn wide" data-event-action="continue"><b>Continue</b><span>${ev.followupCombat?"something is coming":"return to the delve"}</span></button>`;
  annotateCheckChoice("investigate-informed","investigation",authoredChallenge(13),2);
}
function beginGlintEvent(){
  if(!S || S.seenTravelEvents.glint || S.foe || S.travelEvent) return false;
  closePack();closeCharacterSheet();
  S.seenTravelEvents.glint=true;
  const check=runSkillCheck("perception",authoredChallenge(12),0);
  const practice=awardSkillPractice("perception","glint:perception",check);
  const rollHtml=formatSkillCheck(check)+practiceText("perception",practice);
  S.exploreActivity=0;
  if(!check.success){
    travelLogAdd(`For an instant your light catches something in the broken masonry, but whatever was there is gone before you can place it.${practiceText("perception",practice)}`,"note");
    render();return false;
  }
  pauseBoonClock();
  S.travelMode="stopped";S.travelSinceEvent=0;
  S.travelEvent={
    id:"glint",stage:"noticed",kind:"Perception",title:"There — again.",
    text:"You catch the glint without chasing it. A thin metal corner sits beneath the rubble, and the stones above it are badly settled. You know where not to put your weight.",
    rollHtml,followupCombat:false
  };
  travelLogAdd(`Perception passively reveals both a <b>glint</b> and the unstable rubble around it.`,"good");
  render();return true;
}
function setTravelEventResult(title,text,rollHtml="",followupCombat=false){
  if(!S?.travelEvent) return;
  Object.assign(S.travelEvent,{stage:"result",title,text,rollHtml,followupCombat});
  render();
}
async function attemptGlintInvestigation(informed=false){
  if(!S?.travelEvent) return;
  const circumstance = informed ? 2 : 0;
  const check = await runActiveSkillCheck("investigation",authoredChallenge(13),circumstance);
  const practice = awardSkillPractice("investigation","glint:investigation",check);
  const rollHtml = formatSkillCheck(check) + practiceText("investigation",practice);
  if(check.success){
    S.inventory.campSupplies++;
    travelLogAdd(`Investigation paid off: you recovered <b>1 Camp Supply</b> from beneath the rubble.`, "good");
    setTravelEventResult("Something useful","Wedged beneath the stones is a sealed oilskin bundle. Whatever delver lost it never came back for it. You recover 1 Camp Supply.",rollHtml,false);
  } else if(informed){
    travelLogAdd(`You identify the glint, but leave the unstable stones alone.`, "note");
    setTravelEventResult("Not worth the collapse","You find the metal edge you noticed, but the surrounding stones are carrying one another's weight. You leave it where it is.",rollHtml,false);
  } else {
    travelLogAdd(`A loose stone gives way while you investigate. The collapse carries through the tunnels.`, "danger");
    setTravelEventResult("That was loud","Your hand shifts the wrong stone. Rubble clatters down the passage, and somewhere beyond your light something answers the noise.",rollHtml,true);
  }
}
async function handleTravelEventAction(action){
  const ev=S?.travelEvent;
  if(!ev) return;

  if(ev.id==="rescue-clue"){
    const inst=questInstanceById(ev.questInstanceId),r=ensureRescueQuestState(inst);if(!inst||!r)return;
    if(action==="rescue-clue-continue")return resumeRescueTravel(ev);
    if(action==="rescue-tracks-leave"){r.tracksResolved=true;travelLogAdd(`You leave the tracks behind without committing to the trail.`,"note");return resumeRescueTravel(ev);}
    if(action==="rescue-tracks-investigation"||action==="rescue-tracks-survival"){
      const skill=action.endsWith("investigation")?"investigation":"survival";if(r.trackAttempts[skill])return;r.trackAttempts[skill]=true;
      const challenge=rescueSkillChallenge(ev.rescueDepth||S.depth,0),check=await runActiveSkillCheck(skill,challenge),practice=awardSkillPractice(skill,`rescue-tracks:${inst.instanceId}:${skill}`,check),html=formatSkillCheck(check)+practiceText(skill,practice);
      if(check.success){r.tracksResolved=true;addRescueLead(inst);ev.stage="result";ev.title="The trail holds";ev.text=skill==="survival"?"The prints keep a consistent downward line before disappearing back toward the main route. Whoever made them was fleeing, not wandering.":"The stride, scuffs and broken dust all point to one traveller moving fast and under pressure.";ev.rollHtml=html;travelLogAdd(`<b>Lead found.</b> The tracks belong to a single traveller moving downward in haste.`,"good");}
      else if(r.trackAttempts.investigation&&r.trackAttempts.survival){r.tracksResolved=true;ev.stage="result";ev.title="The trail breaks apart";ev.text="You try both the marks themselves and the surrounding terrain, but cannot recover a direction you trust.";ev.rollHtml=html;travelLogAdd(`The first trail goes cold. Other evidence may still lie farther down.`,"note");}
      else{ev.rollHtml=html;ev.text="The signs refuse to resolve cleanly. Another approach may still tell you something.";}
      saveRunNow();render();return;
    }
    if(action==="rescue-satchel-leave"){r.satchelResolved=true;travelLogAdd(`You leave the medical satchel where it fell.`,"note");return resumeRescueTravel(ev);}
    if(action==="rescue-satchel-take"||action==="rescue-satchel-investigate"){
      let html="";
      if(action==="rescue-satchel-investigate"){
        const challenge=rescueSkillChallenge(ev.rescueDepth||S.depth,0),check=await runActiveSkillCheck("investigation",challenge),practice=awardSkillPractice("investigation",`rescue-satchel:${inst.instanceId}`,check);html=formatSkillCheck(check)+practiceText("investigation",practice);r.satchelInsight=!!check.success;
      }
      if(!rescueQuestItem(inst,"satchel")){const obj=questObjectiveDef(inst,"satchel");if(obj)addQuestItem(inst,obj,1,"rescue-clue");addRescueLead(inst);}
      r.satchelResolved=true;ev.stage="result";ev.title="Zeshava's satchel";ev.text=r.satchelInsight?"The owner's mark is Zeshava Brightsong's. The torn strap and scattered wrapping suggest it was dropped during a sudden flight.":"The owner's mark is Zeshava Brightsong's. Whatever happened, the physician came through here.";ev.rollHtml=html;
      travelLogAdd(`<b>Lead found.</b> You recover <b>Zeshava's Medicine Satchel</b> as quest evidence.`,"good");saveRunNow();render();return;
    }
    return;
  }

  if(ev.id==="rescue-search"){
    const inst=questInstanceById(ev.questInstanceId),r=ensureRescueQuestState(inst);if(!inst||!r)return;
    if(action==="rescue-search-leave"||action==="rescue-search-lost"){
      r.hideoutResolved=true;failRescueQuest(inst,"The trail went cold and Zeshava's hiding place was left behind");return resumeRescueTravel(ev);
    }
    if(action==="rescue-hideout-perception"||action==="rescue-hideout-survival"){
      const skill=action.endsWith("perception")?"perception":"survival";if(r.hideoutAttempts[skill])return;r.hideoutAttempts[skill]=true;
      const difficulty=(r.leads||0)>0?0:1,challenge=rescueSkillChallenge(ev.rescueDepth||S.depth,difficulty),check=await runActiveSkillCheck(skill,challenge),practice=awardSkillPractice(skill,`rescue-hideout:${inst.instanceId}:${skill}`,check),html=formatSkillCheck(check)+practiceText(skill,practice);
      if(check.success){beginRescueHideout(inst,false);S.travelEvent.rollHtml=html;saveRunNow();render();return;}
      if(r.hideoutAttempts.perception&&r.hideoutAttempts.survival){ev.stage="lost";ev.title="Nothing you can trust";ev.text="You search the sound and the terrain from two different angles, but the route gives you nothing solid. Going farther means leaving this stretch behind.";ev.rollHtml=html;}
      else{ev.rollHtml=html;ev.text="You cannot place it yet. There is still another way to read the signs before you move on.";}
      saveRunNow();render();return;
    }
    return;
  }

  if(ev.id==="rescue-hideout"){
    const inst=questInstanceById(ev.questInstanceId);if(!inst)return;
    if(action==="rescue-hideout-approach")return startRescueThreatCombat(inst,{guardian:true});
    if(action==="rescue-hideout-leave"){failRescueQuest(inst,"You found the refuge but chose to leave Zeshava behind");return resumeRescueTravel(ev);}
    return;
  }

  if(ev.id==="escort-danger"){
    const inst=questInstanceById(ev.questInstanceId);if(!inst)return;
    if(action==="escort-danger-continue")return resumeRescueTravel(ev);
    if(action==="escort-danger-abandon"){failRescueQuest(inst,"You broke from the pursuit and left Zeshava behind");return resumeRescueTravel(ev);}
    if(action==="escort-danger-fight")return startRescueThreatCombat(inst,{pursuit:true});
    if(action==="escort-danger-stealth"||action==="escort-danger-survival"){
      const skill=action.endsWith("stealth")?"stealth":"survival",challenge=rescueSkillChallenge(S.depth,0),check=await runActiveSkillCheck(skill,challenge),practice=awardSkillPractice(skill,`escort-danger:${inst.instanceId}:${skill}`,check),html=formatSkillCheck(check)+practiceText(skill,practice);
      ev.rollHtml=html;
      if(check.success){ev.stage="result";ev.title=skill==="stealth"?"The second light disappears":"A quieter route";ev.text=skill==="stealth"?"You smother the lights and wait. The movement passes without finding either of you.":"You find a narrow continuation that rejoins the main descent below the searchers.";travelLogAdd(`<b>${esc(SKILL_DEFS[skill].name)} succeeds.</b> The escort avoids another fight.`,"good");}
      else{ev.stage="spotted";ev.title="They found the trail";ev.text="The attempt buys only seconds. Something turns toward you in the dark.";travelLogAdd(`The pursuers find you. The escort cannot slip past cleanly.`,"danger");}
      saveRunNow();render();return;
    }
    return;
  }

  if(ev.id==="stealth-contact"){
    const profile=profileById(ev.profileId) || FOES.find(f=>f.id===ev.profileId);
    const options={...(ev.encounterOptions||{}),profile};
    if(action==="stealth-pass"){
      const resume=ev.priorMode||"descend";
      S.travelEvent=null;S.travelMode=resume;if(S.concealment)S.concealment.autoPass=true;resumeBoonClock();
      travelLogAdd(`You let the <b>${esc(profile?.name||"creature")}</b> pass without revealing yourself. Further successful concealed contacts will pass automatically until Concealment ends.`,"good");render();return;
    }
    if(action==="stealth-ambush"){
      clearConcealment();S.travelEvent=null;S.travelMode="stopped";pauseBoonClock();
      travelLogAdd(`You break Concealment on your terms and spring the ambush.`,"beat");
      return spawnEncounter({...options,surprise:true});
    }
    return;
  }

  if(ev.id==="quest-turnin"){
    if(action==="quest-deliver")return completeQuestTurnIn(ev.questInstanceId);
    if(action==="quest-pass")return passQuestTurnIn(ev.questInstanceId);
    return;
  }

  if(ev.id==="loot-found"){
    if(action==="loot-investigation") return resolveLootSearch("investigation");
    if(action==="loot-continue") return closeLootFound();
    return;
  }

  if(ev.id==="caravan"){
    const event=pendingCaravan();
    if(action==="caravan-move"){
      travelLogAdd(`You leave the caravan event behind and continue descending.`,"note");
      return completeCaravanAndResume("moved-along");
    }
    if(action==="caravan-greet"){
      if(!event)return;
      const context={eventId:event.id,routeId:event.routeId,caravanType:event.type,direction:event.direction,resumeMode:ev.priorMode||"descend",outcome:"talked-passing"};
      S.travelEvent=null;
      travelLogAdd(`You fall into step beside the passing caravan long enough to have a word.`,"note");
      return startInteraction("caravan-passing",context);
    }
    if(action==="caravan-trade"){
      const c=ensureCaravanState();if(!event||!c)return;
      c.activeMerchant=generateCaravanMerchant(event);
      S.travelEvent=null;
      openPack("merchant","backpack");
      render();
      return;
    }
    if(action==="caravan-help-damaged"){
      if(!event)return;
      const challenge=authoredChallenge(12),check=await runActiveSkillCheck("athletics",challenge),practice=awardSkillPractice("athletics",`caravan-wheel:${event.id}`,check);
      const resultHtml=formatSkillCheck(check)+practiceText("athletics",practice);
      if(!check.success){
        travelLogAdd(`You put your weight into the wagon, but the wheel will not shift cleanly enough to free it.`,"note");
        return caravanSetResult("The wheel will not budge","You strain against the wagon with the crew, but the axle stays pinned. You leave them working at another approach.",resultHtml,"help-damaged-failed");
      }
      const context={eventId:event.id,routeId:event.routeId,caravanType:event.type,direction:event.direction,resumeMode:ev.priorMode||"descend",outcome:"helped-damaged"};
      S.travelEvent=null;
      travelLogAdd(`Athletics pays off: together you brace the wagon and shift the wheel back into a workable position.`,"good");
      const started=startInteraction("caravan-damaged",context);
      if(started){
        const active=activeInteraction();
        if(active)active.nodeResults[active.nodeId]=resultHtml;
        saveRunNow();render();
      }
      return started;
    }
    if(action==="caravan-accept-quest"){
      if(!questInstanceForDefinition("caravan-sealed-dispatch"))acceptQuest("caravan-sealed-dispatch");
      ev.stage="result";ev.title="Dispatch accepted";ev.text="The sealed dispatch is now a normal quest-bound Backpack item. Deliver it at Lantern City Guild Hall.";ev.rollHtml=`<b>Quest:</b> Sealed Caravan Dispatch<br><b>Destination:</b> Lantern City Guild Hall`;ev.outcome="helped-dispatch";render();return;
    }
    if(action==="caravan-decline-quest"){
      travelLogAdd(`You decline the caravan's delivery request and continue on.`,"note");
      return completeCaravanAndResume("helped-declined-dispatch");
    }
    if(action==="caravan-help-attacked"){
      if(!event)return;
      const profile=chooseFoeProfile();
      S.travelEvent=null;
      travelLogAdd(`You choose to help and enter the fighting around the caravan.`,"beat");
      return spawnEncounter({profile,caravan:{eventId:event.id,routeId:event.routeId,type:event.type}});
    }
    if(action==="caravan-steal"){
      if(!event)return;
      const challenge=authoredChallenge(event.type==="attacked"?14:12),check=await runActiveSkillCheck("stealth",challenge),practice=awardSkillPractice("stealth",`caravan-steal:${event.id}`,check);
      const resultHtml=formatSkillCheck(check)+practiceText("stealth",practice);
      if(check.success){
        const reward=ri(10,20);S.gold=(S.gold||0)+reward;
        travelLogAdd(`You take advantage of the confusion and come away with <b>${esc(formatGold(reward))}</b>.`,"note");
        return caravanSetResult("You slip away unnoticed",`You recover ${formatGold(reward)} and leave before anyone can stop you.`,resultHtml,"stole");
      }
      travelLogAdd(`You cannot find a clean opening. You leave without taking anything.`,"note");
      return caravanSetResult("No clean opening","The opportunity closes before you can take anything. No one follows you.",resultHtml,"steal-failed");
    }
    if(action==="caravan-continue")return completeCaravanAndResume(ev.outcome||"resolved");
    return;
  }

  if(ev.id==="merchant"){
    const m=currentMerchant();
    if(action==="merchant-pass"){
      travelLogAdd(`You pass by <b>${esc(m?.title||"merchant")} ${esc(m?.name||"")}</b> and continue on.`,"note");
      S.travelEvent=null;
      retireMerchant();
      S.travelMode="descend";
      resumeBoonClock();
      render();
      return;
    }
    if(action==="merchant-trade"){
      S.travelEvent=null;
      openPack("merchant","backpack");
      render();
      return;
    }
    return;
  }

  const a=S?.sideArea;
  if(ev.id==="side-route-riddle"&&a){
    if(action==="side-riddle-hint") return attemptSideRiddleHint();
    const m=String(action||"").match(/^side-riddle-(\d+)$/);if(!m)return;
    const chosen=Number(m[1]),r=a.activeRiddle,correct=chosen===Number(r?.correct);
    if(correct){S.gold=(S.gold||0)+ri(1,4);completeSideRouteStage(`The answer is accepted. A hidden coin slot yields a few <b>sc</b>.`);}
    else{const dmg=Math.max(1,Math.round(S.hpMax*.04));S.hp-=dmg;flashTravelDamage();completeSideRouteStage(`The wrong mark bites back for <b>${dmg} HP</b>, but the seal opens anyway.`);if(S.hp<=0)return die(`<p class="hurt">The passage riddle took the last of your strength.</p>`);}
    a.activeRiddle=null;S.travelEvent=null;S.travelMode="side";resumeBoonClock();render();return;
  }
  if(ev.id==="side-route-puzzle"&&a){
    if(action==="side-route-puzzle-hint") return attemptSideRoutePuzzleHint();
    if(action==="side-puzzle-bypass"){
      const dmg=Math.max(1,Math.round(S.hpMax*.05));S.hp-=dmg;flashTravelDamage();completeSideRouteStage(`You squeeze through the crawlspace and lose <b>${dmg} HP</b> to stone and rust.`);a.activeRoutePuzzle=null;S.travelEvent=null;if(S.hp<=0)return die(`<p class="hurt">The crawlspace closed around you.</p>`);S.travelMode="side";resumeBoonClock();render();return;
    }
    if(action==="side-puzzle-investigate"||action==="side-puzzle-force"){
      const skill=action.endsWith("investigate")?"investigation":"athletics",check=await runActiveSkillCheck(skill,trapDc(12)),practice=awardSkillPractice(skill,`side-route-puzzle:${a.id}:${a.encountersDefeated}`,check);
      if(check.success){S.gold=(S.gold||0)+ri(2,5);completeSideRouteStage(`The mechanism gives way cleanly, exposing a few old <b>sc</b> in the housing.`);}
      else{const dmg=Math.max(1,Math.round(S.hpMax*.05));S.hp-=dmg;flashTravelDamage();completeSideRouteStage(`The mechanism snaps loose and costs <b>${dmg} HP</b>, but the way opens.`);if(S.hp<=0)return die(`<p class="hurt">The counterweight crushed the last of your strength.</p>`);}
      a.activeRoutePuzzle=null;S.travelEvent=null;S.travelMode="side";resumeBoonClock();render();return;
    }
    return;
  }
  if(ev.id==="side-altar"&&a&&sideFinaleType()!=="cache"){
    if(action==="mimic-approach") return startMimicFinale();
    if(action==="puzzle-begin") return beginPuzzleFinale();
    if(action==="puzzle-hint") return attemptPuzzleHint();
    if(action==="puzzle-skill"){
      const step=puzzleCurrent(); if(!step?.skill) return;
      const situational=step.skill==="sleight"&&S.inventory.rogueTools>0?2:0;
      return attemptPuzzleSkill(step.skill,step.dc,situational);
    }
    if(action==="puzzle-water") return attemptPuzzleWater();
    if(action==="puzzle-athletics") return attemptPuzzleSkill("athletics",puzzleCurrent()?.dc||13,0);
    if(action==="puzzle-next") return nextPuzzleSeal();
    if(action==="leave-side-end") return exitSideArea(false);
    if(action==="finish-side") return exitSideArea(true);
  }

  if(["side-discovery","side-retreat","side-inscription","side-trap","side-altar"].includes(ev.id)){
    if(action==="side-ignore"){S.sideAreaResolved=true;S.travelEvent=null;render();return;}
    if(action==="side-enter") return enterSideArea();
    if(action==="side-leave-found"||action==="side-continue"){S.sideAreaResolved=true;S.travelEvent=null;render();return;}
    if(action==="side-keep"){S.travelEvent=null;S.travelMode="side";resumeBoonClock();render();return;}
    if(action==="side-abandon") return exitSideArea(false);
    if(action==="translate-wall"||action==="translate-altar"){
      if(action==="translate-altar"){
        if(S.sideArea.altarTranslationAttempted) return;
        S.sideArea.altarTranslationAttempted=true;
      }
      const source=action==="translate-wall"?`side-language:${S.sideArea.id}`:`side-altar-language:${S.sideArea.id}`,
        dc=trapDc(action==="translate-wall"?12:13),c=await runActiveSkillCheck("translation",dc),p=awardSkillPractice("translation",source,c);
      let html=formatSkillCheck(c)+practiceText("translation",p);
      if(c.success){
        const knownBefore=[...(S.languageKnown||[])],learned=learnLanguageWord();
        const previous=knownBefore.filter(w=>LANG_DICT[w]).map(w=>`${esc(w)} = ${esc(LANG_DICT[w])}`).join(" · ");
        html+=learned?`<br><span class="good"><b>New word:</b> ${esc(learned.word)} = ${esc(learned.meaning)}.</span>${previous?`<br><span class="note">Previously known: ${previous}.</span>`:""}`:`<br><span class="good">You already know every word in this short phrase.</span>`;
        travelLogAdd(learned?`Translation learned one new word: <b>${esc(learned.word)} = ${esc(learned.meaning)}</b>.`:`The inscription contains no unknown words.`,"good");
      }else html+=`<br><span class="bad">The context does not give you enough to trust a translation.</span>`;
      if(action==="translate-altar") S.sideArea.altarTranslationResult=c.success?"success":"failure";
      ev.rollHtml=`<span class="inscription">${languageLine()}</span><br>${html}`;
      if(action==="translate-wall") ev.stage="result";
      render();
      return;
    }
    if(action==="side-event-resume"){S.travelEvent=null;S.travelMode="side";S.travelSinceEvent=0;resumeBoonClock();render();return;}
    if(action==="trap-perception"){
      const c=await runActiveSkillCheck("perception",trapDc(12)),p=awardSkillPractice("perception",`side-trap-sense:${S.sideArea.id}`,c),html=formatSkillCheck(c)+practiceText("perception",p);
      if(c.success){ev.stage="found";ev.title="A loaded mechanism";ev.text="A line disappears into a crude spring assembly under the stone. The passage is too tight to simply walk around it.";ev.rollHtml=html;travelLogAdd(`Perception catches a <b>trap</b> before it catches you.`,"good");render();}
      else triggerTrap("You miss the loaded line until your boot finds it.");
      return;
    }
    if(action==="trap-cross") return triggerTrap("You choose to cross without resolving the mechanism.");
    if(action==="trap-dismantle"){
      if(S.inventory.rogueTools<=0){ev.rollHtml=`<span class="bad">You do not have Rogue Tools. The mechanism is too fine to dismantle safely.</span>`;render();return;}
      const c=await runActiveSkillCheck("sleight",trapDc(13),2),p=awardSkillPractice("sleight",`side-trap:${S.sideArea.id}`,c),html=formatSkillCheck(c)+practiceText("sleight",p);
      if(c.success){ev.stage="result";ev.title="Mechanism dismantled";ev.text="The loaded pieces come apart in your hands. The trap is permanently safe.";ev.rollHtml=html;travelLogAdd(`Sleight of Hand dismantles the trap cleanly.`,"good");render();}
      else triggerTrap("A pick slips. The mechanism fires and breaks itself in the same motion.");
      return;
    }
    if(action==="trap-destroy"){
      const c=await runActiveSkillCheck("athletics",trapDc(12)),p=awardSkillPractice("athletics",`side-trap-force:${S.sideArea.id}`,c),html=formatSkillCheck(c)+practiceText("athletics",p);
      if(c.success){ev.stage="result";ev.title="Mechanism smashed";ev.text="You break the loaded assembly before it can release. Nothing delicate remains, but the way is safe.";ev.rollHtml=html;travelLogAdd(`You destroy the trap mechanism.`,"good");render();}
      else triggerTrap("The blow lands on the wrong piece and releases the trap.");
      return;
    }
    if(action==="choose-offering") return openPack("offering");
    if(action==="open-warded") return openWardedChestDirect();
    if(action==="use-side-key"){if(S.inventory.passageKey?.id!==S.sideArea.keyId)return;removePassageKey();return grantChestReward();}
    if(action==="pick-side-lock") return attemptChestLock();
    if(action==="force-side-chest") return forceChest();
    if(action==="leave-side-end") return exitSideArea(false);
    if(action==="finish-side") return exitSideArea(true);
    return;
  }

  if(action==="ignore"){
    travelLogAdd(`You decide the glint is not worth leaving the route for.`,"note");
    S.travelEvent=null;render();return;
  }
  if(action==="investigate-informed"&&ev.stage==="noticed") return attemptGlintInvestigation(true);
  if(action==="leave"&&ev.stage==="noticed"){travelLogAdd(`You leave the unstable rubble undisturbed.`,"note");S.travelEvent=null;render();return;}
  if(action==="continue"&&ev.stage==="result"){
    const combat=!!ev.followupCombat;S.travelEvent=null;render();if(combat)nextFoe();
  }
}

let townDepartureArmed=false;
let townLocationOpenId=null;
let townMerchantServiceId=null;
function closeTownBlockingSheets(){
  if($("packSheet")) $("packSheet").hidden=true;
  if($("sheet")) $("sheet").hidden=true;
  if($("charSheet")) $("charSheet").hidden=true;
  if($("lootHistorySheet")) $("lootHistorySheet").hidden=true;
  if($("settingsSheet")) $("settingsSheet").hidden=true;
  if(S) S.packMode=null;
  packReturnTarget=null;
  selectedLootHistoryId=null;
  townDepartureArmed=false;
  townLocationOpenId=null;
  townMerchantServiceId=null;
}
function enterTown(def){
  if(!S||!def||over||S.foe||S.travelEvent||S.activeHollow) return false;
  const state=ensureTownState();
  if(!state||state.departed[def.id]) return false;
  pauseBoonClock();
  clearHollowTimer();
  closeTownBlockingSheets();
  S.depth=Math.max(Number(S.depth)||0,Number(def.depth)||0);
  S.exploreElapsedMs=0;S.exploreDepth=S.depth;
  S.travelMode="stopped";S.travelSinceEvent=0;
  state.currentId=def.id;state.visited[def.id]=true;
  travelLogAdd(`You reach <b>${esc(def.name)}</b> at <b>${formatDepth(def.depth)} fathoms</b>. The descent waits beyond its lower gate.`,"beat");
  render();
  // Escort handoffs resolve at the gate before normal town browsing. The town
  // itself is already active underneath the Interaction Engine, so closing the
  // handoff conversation drops the player directly into the normal town map.
  if(maybeStartEscortArrival(def)){requestRunSave();return true;}
  requestRunSave();
  return true;
}
function openTownLocation(id){
  const def=currentTown();if(!def||!townLocationById(def,id))return;
  townLocationOpenId=id;townDepartureArmed=false;renderTown();
}
function closeTownLocation(){
  townLocationOpenId=null;townDepartureArmed=false;renderTown();
}
function armTownDeparture(){
  const def=currentTown(),loc=townLocationById(def,townLocationOpenId);
  if(!loc?.departure)return;
  townDepartureArmed=true;renderTown();
}
function departCurrentTown(){
  const def=currentTown();if(!S||!def)return false;
  const state=ensureTownState();
  for(const inst of questInstances("active")){const qdef=questDefById(inst.definitionId);if((inst.targetTownId||qdef?.targetTownId)===def.id)makeQuestInactive(inst.instanceId,"Destination left behind");}
  state.visited[def.id]=true;state.departed[def.id]=true;state.currentId=null;
  townDepartureArmed=false;townLocationOpenId=null;townMerchantServiceId=null;
  S.travelMode="stopped";S.travelSinceEvent=0;
  travelLogAdd(`You leave <b>${esc(def.name)}</b> through the lower gate. There is no road back for you.`,"beat");
  maybeScheduleMerchant();
  render();saveRunNow();
  return true;
}

function townServiceBucket(def=currentTown()){
  if(!S||!def) return null;
  const state=ensureTownState();
  if(!state.services[def.id] || typeof state.services[def.id]!=="object" || Array.isArray(state.services[def.id])) state.services[def.id]={};
  return state.services[def.id];
}
function ensureTownMerchantService(serviceId){
  const def=currentTown(),bucket=townServiceBucket(def);
  if(!def||!bucket||!["market","herbalist"].includes(serviceId)) return null;
  const key=`${serviceId}Merchant`;
  if(!bucket[key] || typeof bucket[key]!=="object" || Array.isArray(bucket[key])) bucket[key]=generateTownMerchantForService(def,serviceId);
  return bucket[key];
}
function townRecoveryNeeded(){
  return !!S && (S.hp<S.hpMax || abilitiesNeedRestoration() || !!S.bleeding || !restReady());
}
function townLodgingCost(def=currentTown()){
  if(!def)return 0;
  return def.kind==="city"?CITY_LODGING_COST_SC:TOWN_LODGING_COST_SC;
}
function canAffordTownLodging(def=currentTown()){
  return !!S&&!!def&&(S.gold||0)>=townLodgingCost(def);
}
function restAtTownTavern(){
  const def=currentTown();
  if(!S||!def||over||S.pendingBoonChoice) return false;
  const cost=townLodgingCost(def);
  if((S.gold||0)<cost) return false;
  const beforeHp=S.hp,beforeUses=abilityUsesReady(),wasBleeding=!!S.bleeding;
  S.gold=Math.max(0,(S.gold||0)-cost);
  S.hp=S.hpMax;
  S.heavyCharge=0;S.strikeChain=0;S.defenceChain=0;S.abilityQuickUsed=false;
  restoreAllAbilities();
  S.restRecovery=REST_RECOVERY_REQUIRED;
  S.pendingRestAbilityChoice=false;
  if(wasBleeding) clearBleeding();
  S.pendingBoonChoice=true;
  const healed=Math.max(0,S.hp-beforeHp),uses=Math.max(0,abilityUsesReady()-beforeUses);
  const gains=[];
  if(healed) gains.push(`${healed} HP`);
  if(uses) gains.push(`${uses} ability use${uses===1?"":"s"}`);
  if(wasBleeding) gains.push("Bleeding stopped");
  travelLogAdd(`You rent a room at <b>${esc(def.name)}</b>'s tavern for <b>${esc(formatGold(cost))}</b>. <b>${esc(gains.length?gains.join(" · "):"Fully recovered")}</b>. Choose a lodging boon.`,"good");
  if(healed>0) triggerHealFx(healed,["travel"]);
  saveRunNow();
  render();
  return true;
}
function openTownMerchantService(serviceId){
  if(!currentTown()||!["market","herbalist"].includes(serviceId)) return false;
  townMerchantServiceId=serviceId;
  const m=ensureTownMerchantService(serviceId);
  if(!m){townMerchantServiceId=null;return false;}
  merchantView="buy";merchantSellGearScope="backpack";merchantPendingPurchase=null;
  merchantSellSelection={equipment:new Set(),backpack:new Set()};merchantSellQuantities={};
  openPack("merchant","backpack");
  return true;
}
function townLocationQuestMarkerClass(townId,loc){
  if(questTurnInsAtTownLocation(townId,loc.id).length)return " quest-target";
  const offered=questsAtTownLocation(townId,loc.id);
  if(offered.some(def=>!questInstanceForDefinition(def.id)))return " quest-available";
  return "";
}
function townQuestTurnInStatus(loc){
  const rows=questTurnInsAtTownLocation(currentTown()?.id,loc.id);if(!rows.length)return "";
  return rows.map(inst=>{const def=questDefById(inst.definitionId),obj=def?.objectives?.[0],held=obj?questItemCount(inst.instanceId,obj.id):0,required=obj?.required||0,payout=Math.min(Number(inst.promisedRewards?.maxGold)||Infinity,held*(Number(inst.promisedRewards?.goldPerUnit)||0));return `${def?.targetNpcName||loc.npcName||"The recipient"} is waiting for ${def?.title||"your contract"} · ${held}/${required} carried · ${formatGold(payout)} payable now.`;}).join(" ");
}
function townQuestTurnInActions(loc){
  const rows=questTurnInsAtTownLocation(currentTown()?.id,loc.id);if(!rows.length)return "";
  return rows.map(inst=>{const def=questDefById(inst.definitionId),obj=def?.objectives?.[0],held=obj?questItemCount(inst.instanceId,obj.id):0,reward=Math.min(Number(inst.promisedRewards?.maxGold)||Infinity,held*(Number(inst.promisedRewards?.goldPerUnit)||0));return held>0?`<button class="town-location-action primary" type="button" data-town-service="quest-deliver" data-quest-instance="${esc(inst.instanceId)}">Deliver ${held}/${obj?.required||0} · ${formatGold(reward)}</button>`:`<button class="town-location-action" type="button" disabled>No ${esc(obj?.item?.name||"quest items")} to deliver</button>`;}).join("");
}
function townLocationStatusText(loc){
  if(!loc) return "";
  const turnIn=townQuestTurnInStatus(loc);
  if(loc.service==="market") return turnIn||"Town market rates are better than wandering trade: buy prices are about 8% lower and sale offers about 10% higher.";
  if(loc.service==="tavern"){
    const def=currentTown(),cost=townLodgingCost(def),afford=canAffordTownLodging(def);
    const recovery=townRecoveryNeeded()?`Full recovery available · HP ${S.hp}/${S.hpMax} · abilities and conditions restored.`:`You are already fully recovered.`;
    return turnIn||`${def?.kind==="city"?"City":"Town"} room · ${formatGold(cost)} · ${recovery} Includes a lodging boon.${afford?"":" Not enough coin."}`;
  }
  if(loc.service==="herbalist") return turnIn||"Bandages are available now. Direct healer services are reserved for a later town-service hook.";
  if(loc.service==="guild"){
    if(turnIn)return turnIn;
    const defs=questsAtTownLocation(currentTown()?.id,loc.id);
    if(!defs.length)return "No contracts are posted here yet.";
    const available=defs.filter(def=>!questInstanceForDefinition(def.id));
    if(available.length)return available.map(def=>`${def.title} available · ${def.summary}`).join(" ");
    const active=defs.map(def=>[def,questInstanceForDefinition(def.id)]).filter(([,inst])=>inst?.status==="active");
    if(active.length)return active.map(([def,inst])=>`${def.title} active · ${questProgressText(inst)} · ${questDestinationText(inst)}.`).join(" ");
    return defs.map(def=>{const inst=questInstanceForDefinition(def.id);return inst?.status==="completed"?`${def.title} resolved.`:`${def.title} inactive.`;}).join(" ");
  }
  return turnIn||loc.status||"";
}
function townLocationActionsHtml(loc){
  if(!loc) return "";
  const turnIn=townQuestTurnInActions(loc);
  if(loc.departure) return `<button class="town-location-action primary" id="btnTownLocationLeave" type="button">Leave through the lower gate</button>`;
  if(loc.service==="market") return `${turnIn}<button class="town-location-action primary" type="button" data-town-service="market">Open Market</button>`;
  if(loc.service==="tavern"){const def=currentTown(),cost=townLodgingCost(def),afford=canAffordTownLodging(def);return `${turnIn}<button class="town-location-action primary" type="button" data-town-service="tavern-rest" ${afford&&!S.pendingBoonChoice?"":"disabled"}>Rent room · ${formatGold(cost)}</button>`;}
  if(loc.service==="herbalist") return `${turnIn}<button class="town-location-action primary" type="button" data-town-service="herbalist">Buy Bandages</button><button class="town-location-action" type="button" disabled>Healer services · later phase</button>`;
  if(loc.service==="guild"){
    const defs=questsAtTownLocation(currentTown()?.id,loc.id);
    let offered=defs.map(def=>{
      const inst=questInstanceForDefinition(def.id);
      if(inst)return `<button class="town-location-action" type="button" disabled>${esc(def.title)} · ${inst.status==="active"?"active":inst.status==="completed"?"completed":"inactive"}</button>`;
      if(def.interactionId)return `<button class="town-location-action primary" type="button" data-town-service="quest-interact" data-quest-def="${esc(def.id)}">Discuss · ${esc(def.title)}</button>`;
      return `<button class="town-location-action primary" type="button" data-town-service="quest-accept" data-quest-def="${esc(def.id)}">Accept · ${esc(def.title)}</button>`;
    }).join("");
    if(!defs.length&&!turnIn)offered=`<button class="town-location-action" type="button" disabled>No contracts posted</button>`;
    return `${turnIn}${offered}`;
  }
  return `${turnIn}<button class="town-location-action" type="button" disabled>Service unavailable</button>`;
}
function renderTown(){
  const screen=$("townScreen");if(!screen)return;
  const def=!over?currentTown():null;
  screen.hidden=!def;
  if(!def){townDepartureArmed=false;townLocationOpenId=null;return;}
  $("townMeta").textContent=`${def.kind==="city"?"City":"Town"} · ${formatDepth(def.depth)} fathoms`;
  $("townName").textContent=def.name;
  const art=$("townMapArtboard");
  const shell=$("townMapShell");
  if(shell){shell.style.aspectRatio=def.aspectRatio||"4 / 3";shell.setAttribute("aria-label",`${def.name} ${def.kind} map`);}
  if(art){
    art.style.backgroundImage=`url("${def.image}")`;
    art.style.aspectRatio=def.aspectRatio||"4 / 3";
    art.style.backgroundPosition=`center ${def.focusY||"50%"}`;
  }
  const loc=townLocationById(def,townLocationOpenId);
  if(townLocationOpenId&&!loc){townLocationOpenId=null;townDepartureArmed=false;}
  const active=townLocationById(def,townLocationOpenId);
  const hotspots=$("townHotspots");
  if(hotspots){
    hotspots.innerHTML=(def.locations||[]).map(place=>`<button class="town-hotspot${active?.id===place.id?" selected":""}${townLocationQuestMarkerClass(def.id,place)}" type="button" data-town-location="${esc(place.id)}" style="--hx:${Number(place.x)||50}%;--hy:${Number(place.y)||50}%" aria-label="Open ${esc(place.name)}"><span>${esc(place.name)}</span></button>`).join("");
  }
  const panel=$("townLocationPanel");
  if(panel)panel.hidden=!active;
  if($("btnTownLocationBack")) $("btnTownLocationBack").textContent=$("worldCanvas")?"Back to town":"Back to map";
  if(active){
    $("townLocationType").textContent=active.type||"Location";
    $("townLocationName").textContent=active.npcName?`${active.name} — ${active.npcName}`:active.name;
    $("townLocationDescription").textContent=active.description||"";
    $("townLocationStatus").textContent=townLocationStatusText(active);
    const actions=$("townLocationActions");
    if(actions) actions.innerHTML=townLocationActionsHtml(active);
  }
  const confirm=$("townDepartConfirm");if(confirm)confirm.hidden=!townDepartureArmed;
  const actionLeave=$("btnTownLocationLeave");if(actionLeave)actionLeave.hidden=townDepartureArmed;
  $("btnTownConfirmLeave").textContent=`Leave ${def.name} permanently`;
  if(S){
    $("townHeroName").textContent=S.name||"—";
    $("townHeroLv").textContent=`Level ${S.level||1}`;
    const hpMax=Math.max(1,S.hpMax||1), hpNow=Math.max(0,Math.min(hpMax,S.hp||0)), xpNeed=Math.max(1,xpToNext()), xpNow=Math.max(0,S.xp||0);
    const hpPct=(hpNow/hpMax)*100;
    $("townHeroHpBar").style.width=`${hpPct}%`;
    $("townHeroHpBar").style.background=hpPct>55?"#6f93a7":(hpPct>25?"#9a8450":"#a15b4a");
    $("townHeroHpText").textContent=`${hpNow} / ${hpMax} hp`;
    $("townHeroXpText").textContent=`${xpNow} / ${xpNeed} XP`;
    if($("townHeroXpBar")) $("townHeroXpBar").style.width=`${clamp(xpNow/Math.max(1,xpNeed),0,1)*100}%`;
    $("townPackSub").textContent=`${S.inventory?.campSupplies||0} Camp Supplies · ${S.inventory?.bandages||0} Bandage${(S.inventory?.bandages||0)===1?"":"s"}`;
  }
}

function startTravel(mode){
  if(encounterWarningActive() || !S || over || currentTown() || S.foe || S.travelEvent || S.activeHollow || S.pendingBoonChoice) return;
  if(sideAreaActive()&&mode==="explore"){
    if(S.travelMode==="side") return promptSideRetreat();
    S.travelMode="side";
    S.travelSinceEvent=0;
    resumeBoonClock();
    travelLogAdd(`You continue into the <b>${esc(S.sideArea.name)}</b>.`,"note");
    render();
    return;
  }
  if(mode!=="descend"&&mode!=="explore") return;
  if(S.travelMode===mode) return;
  if(mode==="explore") S.exploreActivity=0;
  S.travelMode=mode;
  resumeBoonClock();
  armed=null;
  travelLogAdd(mode==="descend"?`You start down again.`:`You leave the downward route and explore outward at <b>${formatDepth(S.depth)} fathoms</b>.`,mode==="descend"?"":"note");
  render();
}

function stopTravel(){
  if(!S || S.travelMode === "stopped") return;
  pauseBoonClock();
  S.travelMode = "stopped";
  travelLogAdd(`You hold at <b>${formatDepth(S.depth)} fathoms</b>.`, "note");
  render();
}

function travelInterruptionChance(){
  const d = S.travelSinceEvent;
  if(d < TRAVEL_QUIET) return 0;
  if(d >= TRAVEL_FORCE_EVENT) return 1;

  // Chance is expressed per fathom, then converted to this 0.25-fathom tick.
  // It starts low and rises with distance so timing is uncertain without allowing
  // absurdly long dry streaks. Other event types will later share this roll.
  const perFathom = Math.min(0.35, 0.04 + (d - TRAVEL_QUIET) * 0.02);
  return 1 - Math.pow(1 - perFathom, TRAVEL_STEP);
}

function runTravelTickCore(){
  // Active World owns all physical travel. The legacy passive travel driver is
  // retained only as historical/fallback code for a build without the Canvas.
  // Never let both systems advance depth or auto-trigger spatial content.
  if($("worldCanvas")) return;
  syncSidePassageStratum();
  if(!S || over) return;
  ensureTownState();
  normalizeQuestState();
  if(currentTown()){
    if(S.travelMode!=="stopped"){S.travelMode="stopped";pauseBoonClock();}
    return;
  }
  if(!S.foe && !S.travelEvent && !S.activeHollow && S.travelMode==="descend"){
    const waitingTown=townAtCurrentDepth();
    if(waitingTown) return enterTown(waitingTown);
    maybeCaravanPerceptionWarning();
  }

  if(!S.foe && !S.travelEvent && !S.sideDiscoveryAttempted && !S.sideAreaResolved && !sideAreaActive() &&
     (S.travelMode==="descend" || S.travelMode==="explore") && S.depth>=4){
    const chance = S.travelMode==="descend" ? .012 : .025;
    if(rnd()<chance) return beginSideDiscovery();
  }

  if(!tickBleeding()) return;
  if(S.travelMode!=="stopped") tickConcealment();
  if(S.travelMode==="side") return sideTravelTick();

  if(S.travelMode==="descend" && !S.foe && !S.travelEvent){
    const rescueBeat=crossedRescueBeat(S.depth,S.depth+TRAVEL_STEP);
    if(rescueBeat)return beginRescueBeat(rescueBeat);
    const questTarget=crossedActiveQuestTarget(S.depth,S.depth+TRAVEL_STEP);
    if(questTarget)return beginQuestTurnIn(questTarget);
    const caravan=crossedPendingCaravan(S.depth,S.depth+TRAVEL_STEP);
    if(caravan)return beginCaravanEvent(caravan);
  }

  if(S.travelMode==="descend" && !S.foe && !S.travelEvent && currentMerchant() && S.depth<currentMerchant().depth && S.depth+TRAVEL_STEP>=currentMerchant().depth){
    return beginMerchantEncounter();
  }

  if(S.travelMode==="descend" && !S.foe && !S.travelEvent && !S.sideDiscoveryAttempted && !S.sideAreaResolved &&
     S.depth<S.sideDiscoveryAt && S.depth+TRAVEL_STEP>=S.sideDiscoveryAt){
    S.depth=S.sideDiscoveryAt;
    S.exploreElapsedMs=0;
    S.exploreDepth=S.depth;
    advanceRestRecoveryFromDepth(S.depth-TRAVEL_STEP,S.depth);
    return beginSideDiscovery();
  }

  if(S.travelMode==="descend" && !S.foe && !S.travelEvent){
    const current=Math.max(0,Math.floor(S.depth/FATHOMS_PER_STRATUM));
    const midpoint=midBossDepthForStratum(current);
    if(!S.midBossDefeated?.[current] && S.depth<midpoint && S.depth+TRAVEL_STEP>=midpoint){
      S.depth=midpoint-0.1;S.travelMode="stopped";pauseBoonClock();
      travelLogAdd(`<b>Danger ahead.</b> A powerful foe has claimed the middle of this stratum.`,"danger");
      return nextFoe({boss:true,midBoss:true,bossStratum:current,profile:current===0?MID_BOSS_PROFILE:{...MID_BOSS_PROFILE,name:`${stratumName(current).replace(/^The /,"")} depth-warden`}});
    }
    const boundary=(current+1)*FATHOMS_PER_STRATUM;
    if(!S.bossDefeated?.[current] && S.depth<boundary && S.depth+TRAVEL_STEP>=boundary){
      S.depth=boundary-0.1;
      S.travelMode="stopped";
      pauseBoonClock();
      travelLogAdd(`<b>Something bars the stratum boundary.</b> The way into ${esc(stratumName(current+1))} is not open yet.`,"danger");
      return nextFoe({boss:true,bossStratum:current});
    }
  }

  const expired=checkBoonExpiry();
  if(expired) render();
  else renderActiveBoon();
  if(S.foe || S.pendingBoonChoice || S.travelMode==="stopped") return;

  const beforeDepth=S.depth;
  const beforeStratum=stratumIndex(S.depth);
  S.travelSinceEvent+=TRAVEL_STEP;

  if(S.travelMode==="descend"){
    S.depth=Math.round((S.depth+TRAVEL_STEP)*100)/100;
    advanceRestRecoveryFromDepth(beforeDepth,S.depth);
    recordRunDepthMilestones(beforeDepth,S.depth);
    if(Math.abs(S.depth-beforeDepth)>0.0001){
      S.exploreElapsedMs=0;
      S.exploreDepth=S.depth;
    }
    const afterStratum=stratumIndex(S.depth);
    if(afterStratum!==beforeStratum) travelLogAdd(`You cross into <b>${esc(stratumName(afterStratum))}</b>.`,"beat");
    const town=findCrossedTown(beforeDepth,S.depth);
    if(town){S.depth=town.depth;S.exploreDepth=S.depth;enterTown(town);return;}
    const hollow=findCrossedHollow(beforeDepth,S.depth);
    if(hollow){ discoverHollow(hollow); return; }
  }

  if(S.travelMode==="explore"){
    if(Math.abs((S.exploreDepth??S.depth)-S.depth)>0.0001){
      S.exploreElapsedMs=0;
      S.exploreDepth=S.depth;
    }
    S.exploreElapsedMs=(S.exploreElapsedMs||0)+TRAVEL_TICK_MS;
    S.exploreActivity=(S.exploreActivity||0)+TRAVEL_STEP;
    maybeQuestExploreDrop();
    if(!S.seenTravelEvents.glint && S.exploreActivity>=GLINT_EVENT_TRIGGER){
      beginGlintEvent();
      return;
    }
  }

  if(rnd()<travelInterruptionChance()){
    nextFoe();
    return;
  }

  // Flavor chatter is evaluated only after this tick has proven not to create
  // an encounter, so an idle line can never accidentally look like a warning.
  if(S.travelMode==="descend")maybeCompanionTravelBark();

  renderTravel();
  renderCombatHeader();
}

function travelTick(){
  if(document.hidden) return;
  // Some mobile/PWA lifecycle paths can deliver pagehide without the matching
  // resume event promptly. If the document is visibly active, never allow the
  // travel loop to remain permanently suspended.
  if(appSuspended) resumeRuntime();
  if(appSuspended) return;
  const result=runTravelTickCore();
  recordDescentXpProgress();
  requestRunSave();
  return result;
}

function activeFoeIntentWeights(f=S.foe){
  if(!f)return {};
  const p=f.profile,frac=f.hp/Math.max(1,f.hpMax);
  let weights={...p.intents};
  if(p.hurtIntents&&frac<=p.hurtAt)weights={...p.hurtIntents};
  if(p.chargedIntents&&S.heavyCharge>0)weights={...p.chargedIntents};
  return weights;
}
function rollEnemyReaction(){
  const f=S.foe;if(!f)return null;
  const weights=activeFoeIntentWeights(f);
  let dodge=Math.max(0,Number(weights.dodge)||0),guard=Math.max(0,Number(weights.guard)||0);
  const total=Math.max(1,Object.values(weights).reduce((a,v)=>a+Math.max(0,Number(v)||0),0));
  if(f.noDodgeNextReaction){dodge=0;f.noDodgeNextReaction=false;}
  const reactionWeight=dodge+guard;
  if(reactionWeight<=0||rnd()>=reactionWeight/total){f.reaction=null;return null;}
  f.reaction=rnd()<(dodge/Math.max(1,reactionWeight))?"dodge":"guard";
  return f.reaction;
}
function expireEnemyReactionAtEnemyTurn(){
  if(S.foe)S.foe.reaction=null;
}
function rollIntent(){
  const f=S.foe;if(!f)return;
  const openingIntent=S.turn===1&&f?.intent==null;
  if(f.offBalance){
    f.intent=f.offBalanceStruck?"steady":(rnd()<0.60?"steady":"offquick");
    f.heavyStage=0;return;
  }
  const p=f.profile,frac=f.hp/Math.max(1,f.hpMax);
  let weights={...activeFoeIntentWeights(f),guard:0,dodge:0};
  if(weights.recover&&(openingIntent||frac>(p.recoverAt??0.30)))weights.recover=0;
  let choices=Object.entries(weights).filter(([,w])=>w>0);
  if(!choices.length)choices=[["quick",1]];
  f.intent=weightedPick(choices,([,w])=>w)[0];
  f.heavyStage=f.intent==="heavy"?1:0;
}

/* ============================================================
   v0.111.0 — COMBAT TIMELINE V2

   Every visible node is one global turn/action slot. Speed schedules the next
   ordinary slot; injected slots are deliberately separate so Surprise and
   future boss/legendary actions can add turns without rewriting Speed math.
   ============================================================ */
const TIMELINE_BASE_DELAY=1000;
const TIMELINE_VISIBLE_SLOTS=5;
const ENEMY_TURN_WINDUP_MS=650;
const ENEMY_TURN_AFTERMATH_MS=650;
const REACTION_MAX=3; // legacy save compatibility only
const DAMAGE_VARIANCE=0.08;
const PLAYER_WEAPON_SPEED=Object.freeze({
  dagger:125,shortsword:112,wand:110,sword:100,axe:100,unarmed:100,
  bow:90,staff:90,greatsword:80
});
let enemyTurnTimer=null;
let enemyTurnResolving=false;
let combatProtectionAftermath=null;
function clearEnemyTurnTimer(){if(enemyTurnTimer!==null){clearTimeout(enemyTurnTimer);enemyTurnTimer=null;}}
function combatActor(){return S?.combatActor==="enemy"?"enemy":"player";}
function playerTurnActive(){return !!S?.foe&&!over&&!S.foe.defeated&&combatActor()==="player";}
function enemyTurnActive(){return !!S?.foe&&!over&&!S.foe.defeated&&combatActor()==="enemy";}
function weaponCombatSpeed(def){return Math.max(20,Number(PLAYER_WEAPON_SPEED[def?.family])||100);}
function playerCombatSpeed(def=equippedWeaponDef()){return weaponCombatSpeed(def);}
function playerCombatSpeedForEquipment(equipmentState=S?.equipment){
  const def=equipmentItemDef(equipmentState?.rightHand)||UNARMED_WEAPON;
  return weaponCombatSpeed(def);
}
function foeCombatSpeed(foe=S?.foe){return Math.max(20,Number(foe?.profile?.speed)||100);}
function delayFromSpeed(speed){return TIMELINE_BASE_DELAY/Math.max(20,Number(speed)||100);}
function playerActionDelay(_key=null){return delayFromSpeed(playerCombatSpeed());}
function enemyActionDelay(){return delayFromSpeed(foeCombatSpeed());}
function ensureBackgroundCharges(foe=S?.foe){
  if(!foe)return [];
  if(!Array.isArray(foe.backgroundCharges))foe.backgroundCharges=[];
  return foe.backgroundCharges;
}
function enemyBackgroundChargeText(foe=S?.foe){
  return ensureBackgroundCharges(foe).filter(c=>c&&c.total>0&&c.stage>0).map(c=>`${c.label||c.id||"Charge"} ${c.stage}/${c.total}`).join(" · ");
}
function advanceEnemyBackgroundCharges(){
  // No live creature uses this yet. The hook intentionally exists for future
  // Breath 1/5-style warnings that advance while the foe takes normal actions.
  for(const c of ensureBackgroundCharges()){
    if(c.paused||c.stage>=c.total)continue;
    c.stage++;
  }
}
function enemyActionDescriptor(foe=S?.foe){
  if(!foe)return null;
  const base=INTENTS[foe.intent]||INTENTS.quick;
  if(foe.intent==="heavy"){
    const stage=Math.max(1,Math.min(2,Number(foe.heavyStage)||1));
    if(stage===1)return {...base,label:"Heavy attack 1/2",tell:"winding up a committed blow",kind:"charge",mult:0,stage,total:2};
    return {...base,label:"Heavy attack 2/2",tell:"bringing the committed blow down",kind:"attack",stage,total:2};
  }
  return {...base,stage:1,total:1};
}
function foeGuardActive(foe=S?.foe){return !!foe && foe.reaction==="guard";}
function foeDodgeActive(foe=S?.foe){return !!foe && foe.reaction==="dodge";}
function enemyAttackIncoming(){return enemyActionDescriptor()?.kind==="attack";}
function reactionReadAvailable(){return !!S?.foe&&!S.foe.readUsed&&knowledgeReads(S.foe.key)<6;}
function enemyReactionWindowPossible(){return false;}
function enemyReactionWindowOpen(){return false;}
function combatTimelineState(){
  if(!S.combatTimeline||typeof S.combatTimeline!=="object")initCombatTimeline();
  return S.combatTimeline;
}
function initCombatTimeline(){
  S.turn=Math.max(1,Math.floor(Number(S.turn)||1));
  S.combatActor="player";
  S.combatTimeline={mode:"alternating"};
  S.staminaMax=PLAYER_TURN_STAMINA;
  S.stamina=PLAYER_TURN_STAMINA;
  S.reactionMax=REACTION_MAX;
  S.reactionPoints=REACTION_MAX;
  S.reactionAvailable=false;
  S.reactionWindow=false;
  S.protection=0;
  S.protectionMax=0;
  S.protectionSource=null;
  S.defencePrepared=null;
  return S.combatTimeline;
}
function injectCombatTurn(_actor,_tag="Extra"){
  // Speed/extra-turn injection is deliberately parked during the AC/Stamina test.
}
function simulateTimelineSlots(count=TIMELINE_VISIBLE_SLOTS){
  if(!S?.foe)return [];
  const slots=[];
  let actor=combatActor();
  for(let i=0;i<count;i++){
    slots.push({actor,turn:Math.max(1,Number(S.turn)||1)+i,current:i===0,injected:false,tag:null});
    actor=actor==="player"?"enemy":"player";
  }
  return slots;
}
function clearProtectionForNextReaction(){
  S.protection=0;
  S.protectionMax=0;
  S.protectionSource=null;
  combatProtectionAftermath=null;
}
function setReactionProtection(amount,source){
  // Protection is parked for future shield/ward abilities; basic defence no longer creates it.
  const value=Math.max(0,Math.round(Number(amount)||0));
  S.protection=value;S.protectionMax=value;S.protectionSource=value>0?source:null;
  combatProtectionAftermath=null;
  return value;
}
function counterProtectionCapacity(){return 0;}
function beginCombatTurn(actor){
  clearEnemyTurnTimer();
  S.combatActor=actor;
  armed=null;
  S.reactionWindow=false;
  S.reactionAvailable=false;
  if(actor==="player"){
    S.staminaMax=PLAYER_TURN_STAMINA;
    S.stamina=PLAYER_TURN_STAMINA;
    S.abilityQuickUsed=false;
  }else{
    expireEnemyReactionAtEnemyTurn();
  }
  render();requestRunSave();
  if(actor==="enemy")scheduleEnemyTurn();
}
function advanceTimelineAfter(actor,_actionKey=null){
  S.turn=Math.max(1,Math.floor(Number(S.turn)||1))+1;
  beginCombatTurn(actor==="player"?"enemy":"player");
}
function advanceFromPlayerTurn({surpriseOpening=false,actionKey=null}={}){
  if(surpriseOpening&&S.foe){
    S.foe.surprised=false;
    S.foe.intent=null;
    S.foe.heavyStage=0;
    rollIntent();
  }
  advanceTimelineAfter("player",actionKey);
}
function advanceFromEnemyTurn({keepIntent=false}={}){
  if(!keepIntent&&S.foe&&!S.foe.defeated)rollIntent();
  advanceTimelineAfter("enemy");
}
function scheduleEnemyTurn(delay=ENEMY_TURN_WINDUP_MS){
  // Physical enemy dice can keep the enemy turn open for several seconds.
  // Do not let render() schedule another copy of the same enemy action while
  // that authoritative roll is still resolving.
  if(enemyTurnTimer!==null||enemyTurnResolving||combatDiceBusy||!enemyTurnActive())return;
  enemyTurnTimer=setTimeout(()=>{enemyTurnTimer=null;resolveEnemyTurn();},delay);
}
/* ============================================================
   THE MATHS — all in one place, so tuning is easy later
   ============================================================ */
function weaknessEff(){
  // Read is what teaches you how to exploit the archetype. Until then the exact
  // preview remains truthful because no hidden bonus is being secretly applied.
  if(!S.foe || !S.foe.revealed) return {};
  const base = S.foe.weakness.eff;
  const eff = {...base};

  // Mastery adds a small universal payoff to the archetype's existing weakness
  // rather than inventing a second weakness. +50% becomes +55%, +40% becomes +45%.
  for(const k of Object.keys(eff)){
    if(typeof eff[k] === "number" && eff[k] > 1) eff[k] = boostedWeaknessMultiplier(eff[k]);
  }
  return eff;
}
function openingBonus(){
  if(!S.foe || !S.foe.offBalance) return 1;
  return weaknessEff().offBalanceBonus || 1.25;
}
function strikeStage(){
  return clamp(S?.strikeChain || 0, 0, 2);
}
function strikeName(stage=strikeStage()){
  return stage === 2 ? "Perfect Strike" : stage === 1 ? "Double Strike" : "Strike";
}
function strikeMultiplier(stage=strikeStage()){
  return STRIKE_MULT[clamp(stage,0,2)];
}
function dmgStrike(stage=strikeStage(), swingOverride=null){
  const f = S.foe;
  const eff = weaknessEff();
  const mult = strikeMultiplier(stage);
  const swing = swingOverride !== null ? swingOverride
    : stage === 0 ? ri(0,4) : stage === 1 ? ri(0,5) : ri(0,6);
  // Session 9C: every class now uses the same split between its weapon's scaling
  // attribute and the equipped weapon contribution. The weapon remains relevant
  // without replacing level-up stat investment.
  const attack = weaponAttackBase();
  let d = (attack * mult + swing) * openingBonus();
  if(eff.strikeBonus) d *= eff.strikeBonus;
  if(eff.recoverStrikeBonus && f.intent === "recover") d *= eff.recoverStrikeBonus;
  if(foeGuardActive(f)) d *= (1 - INTENTS.guard.armour);
  return Math.max(1, Math.round(d));
}
function damageTypeMultiplier(type, foe=S.foe){
  return foe?.profile?.damageTypes?.[type] ?? 1;
}
let combatDamagePopSerial=0;
function showCombatDamagePop(target,amount,{critical=false,protection=false,label=""}={}){
  const value=Math.max(0,Math.round(Number(amount)||0));
  const customLabel=String(label||"").trim();
  if(value<=0&&!customLabel)return;
  const arena=document.querySelector(".arena.combat-mode");
  if(!arena)return;
  const host=target==="foe"?$("foeBar"):$("heroBar");
  if(!host)return;

  // Six separated lanes per HP bar prevent fast hits, Bleeding and Damage Reflect
  // from drawing two live numbers at the same coordinates. If all lanes are busy,
  // the oldest callout is retired before its lane is reused.
  const laneMap=[
    {x:0,y:0},{x:-36,y:30},{x:36,y:30},
    {x:-20,y:60},{x:20,y:60},{x:0,y:90}
  ];
  const occupied=new Set([...host.querySelectorAll(".combat-damage-pop")].map(el=>Number(el.dataset.damageLane)).filter(Number.isFinite));
  let lane=laneMap.findIndex((_,i)=>!occupied.has(i));
  if(lane<0){
    const oldest=host.querySelector(".combat-damage-pop");
    lane=Number(oldest?.dataset.damageLane);
    if(!Number.isFinite(lane)||lane<0||lane>=laneMap.length)lane=combatDamagePopSerial%laneMap.length;
    oldest?.remove();
  }
  combatDamagePopSerial++;
  const slot=laneMap[lane];
  const pop=document.createElement("span");
  pop.className=`combat-damage-pop${critical?" critical":""}${protection?" protection":""}${customLabel?" miss":""}`;
  pop.dataset.damageLane=String(lane);
  pop.textContent=customLabel||(critical?`-${value}!`:`-${value}`);
  pop.style.setProperty("--damage-shift",`${slot.x}px`);
  pop.style.setProperty("--damage-lift",`${slot.y}px`);
  host.appendChild(pop);
  window.setTimeout(()=>pop.remove(),1650);
}

function applyOutgoingEquipmentEffects(baseDamage,{foe=S.foe,eligible=true,critical=false}={}){
  const base=Math.max(0,Math.round(Number(baseDamage)||0));
  if(!eligible||!S||!foe||base<=0) return {damage:base,html:"",crit:false,bossBonus:0,critBonus:0,heal:0};
  const totals=equipmentAffixTotals();
  let damage=base,bossBonus=0,critBonus=0,crit=!!critical,heal=0;
  // v0.114.0: the authoritative attack d20 owns crit resolution. There is no
  // second hidden DEX/equipment roll and WIS Precision does not modify severity.
  if(crit){
    const critTotal=Math.max(base,criticalDamageFromBase(base));
    critBonus=critTotal-base;
    damage=critTotal;
  }
  if(foe.boss && totals.bossDamage.pct>0){
    // Boss Damage remains its own bounded additive property rather than being
    // multiplied by the d20 critical hit.
    bossBonus=Math.min(totals.bossDamage.bonusCap,Math.max(0,Math.round(base*totals.bossDamage.pct/100)));
    damage+=bossBonus;
  }
  // Lifesteal is supported here even while ordinary generation keeps it disabled.
  // One cap is consumed by the whole player action, not once per hit/component.
  if(totals.lifesteal.pct>0 && S.hp<S.hpMax){
    heal=Math.min(totals.lifesteal.healCap,Math.max(0,Math.floor(damage*totals.lifesteal.pct/100)));
    if(heal>0) S.hp=Math.min(S.hpMax,S.hp+heal);
  }
  let html="";
  if(crit) html+=`<p class="good"><b>Critical Hit.</b> Natural d20 critical ×${D20_CRIT_MULTIPLIER} (+${critBonus}).</p>`;
  if(bossBonus>0) html+=`<p class="good">Boss Damage added <b>${bossBonus}</b>.</p>`;
  if(heal>0) html+=`<p class="good"><b>Lifesteal.</b> Recovered ${heal} HP.</p>`;
  showCombatDamagePop("foe",damage,{critical:crit});
  return {damage,html,crit,bossBonus,critBonus,heal};
}

function reflectedDamageFromHit(incomingDamage){
  const t=equipmentAffixTotals().reflect;
  if(!S?.foe||incomingDamage<=0||t.pct<=0) return 0;
  return Math.min(t.damageCap,Math.max(0,Math.round(incomingDamage*t.pct/100)));
}
function dmgSmite(){
  const f = S.foe;
  let physical = (weaponAttackBase() + ri(0,4)) * openingBonus();
  if(foeGuardActive(f)) physical *= (1 - INTENTS.guard.armour);
  physical = Math.max(1, Math.round(physical));
  const radiant = Math.max(0, Math.round(6 * damageTypeMultiplier("radiant", f)));
  return {physical, radiant, total:physical + radiant};
}

function heavyMultiplier(_charge=S.heavyCharge){
  // v0.112.1: the full-turn player Heavy is its own burst option rather than
  // paying an additional accuracy tax on top of its 3-Stamina commitment.
  return 3.2;
}
function dmgHeavy(_charge=S.heavyCharge, swingOverride=null){
  const f = S.foe;
  const eff = weaknessEff();
  const mult = heavyMultiplier();
  const attack = weaponAttackBase();
  let d = (attack*mult + (swingOverride !== null ? swingOverride : ri(0,6))) * openingBonus();
  if(eff.heavyBonus) d *= eff.heavyBonus;
  if(eff.fullHeavyBonus) d *= eff.fullHeavyBonus;
  if(eff.guardHeavyBonus && foeGuardActive(f)) d *= eff.guardHeavyBonus;
  // Heavy is the general answer to a guard: most of the blow still gets through.
  if(foeGuardActive(f)) d *= 0.85;
  return Math.max(1, Math.round(d));
}
function counterDamage(style, perfect=false){
  const eff = weaknessEff();
  let d;
  if(S.className === "Votary"){
    const mult = perfect
      ? (style === "shield" ? 0.75 : 1.25)
      : (style === "shield" ? 0.35 : 0.75);
    d = effectiveStat("STR") * mult;
  } else {
    const base = S.className === "Rogue" ? effectiveStat("DEX") : S.className === "Wizard" ? effectiveStat("INT") : effectiveStat("STR");
    d = base * (perfect ? 1.05 : 0.55);
  }
  if(eff.counterBonus) d *= eff.counterBonus;
  return Math.max(1, Math.round(d));
}
function perfectDefenceReady(){return false;}
function incomingMean(openMult=1){
  const f=S.foe;if(!f)return 0;
  const I=enemyActionDescriptor(f);if(!I||I.kind!=="attack")return 0;
  const learnedDefence=knowledgeDamageTakenMult(f.key);
  let d=Math.max(0,f.atk*I.mult*openMult*learnedDefence);
  if(curseActive()&&S.curse.id==="frailty")d*=1.05;
  d=mitigateDamageByType(d,{damageType:"physical",armor:equipmentArmorFor(),expectedArmor:expectedMediumArmorAtDepth(S.depth)});
  return Math.max(0,d);
}
function actualIncomingBounds(openMult=1){
  const mean=incomingMean(openMult);
  return {lo:Math.max(0,Math.floor(mean*(1-DAMAGE_VARIANCE))),hi:Math.max(0,Math.ceil(mean*(1+DAMAGE_VARIANCE)))};
}
function incomingEstimateBounds(openMult=1){
  const mean=incomingMean(openMult),reads=S?.foe?knowledgeReads(S.foe.key):0;
  const spread=reads>=6?DAMAGE_VARIANCE:reads>=3?0.10:reads>=1?0.12:0.15;
  return {lo:Math.max(0,Math.floor(mean*(1-spread))),hi:Math.max(0,Math.ceil(mean*(1+spread)))};
}
function incomingEstimateText(openMult=1){const r=incomingEstimateBounds(openMult);return r.lo===r.hi?String(r.lo):`${r.lo}–${r.hi}`;}
function rollIncoming(openMult=1){const r=actualIncomingBounds(openMult);return r.hi<=r.lo?r.lo:ri(r.lo,r.hi);}
function incoming(openMult=1){return Math.round(incomingMean(openMult));}
function runCost(){
  const f = S.foe;
  return Math.max(1, Math.round(4 + S.depth/26 + (f.intent === "heavy" ? 4 : 0)));
}
function defenceName(){
  const hasShield=equipmentItemIsShield(S?.equipment?.leftHand)&&!equipmentItemUsesBothHands(S?.equipment?.rightHand);
  if(hasShield) return "Guard";
  if(S?.className === "Wizard") return equippedWeaponDef()?.family === "wand" ? "Ward" : "Brace";
  return "Parry";
}
function defenceCounterNoun(){
  if(S?.className === "Wizard") return "counter";
  return S?.loadout === "shield" ? "counter" : "riposte";
}
function heavyActionName(){ return S?.className === "Rogue" ? "Backstab" : S?.className === "Wizard" ? "Arcane Bolt" : "Heavy"; }
function sandChance(){
  if(!S.foe) return 0;
  // Sand is a broad dirty trick, not a weapon attack: enemy AC/Guard/Dodge do not alter it.
  return 0.60;
}

function awardKill(f){
  const gain = xpReward(f);
  S.xp += gain;
  let levels = 0;

  while(S.xp >= xpToNext(S.level)){
    S.xp -= xpToNext(S.level);
    S.level++;
    S.statPoints+=3;
    levels++;
  }

  let html = `<p class="good">Earned <b>${gain} XP</b>${boonActive("makingplan") ? " · Making a Plan" : ""}.</p>`;
  if(levels){
    const gainedPoints=levels*3;
    markCharacterNotice("overview");
    showLevelUpNotice();
    html += `<p class="good"><b>Level ${S.level}.</b> <b>${gainedPoints} attribute point${gainedPoints===1?"":"s"}</b> gained. Spend them when you are ready; leveling itself does not heal you.</p>`;
  }
  return html;
}

function clearCombatVictoryTimer(){
  if(combatVictoryTimer!==null){ clearTimeout(combatVictoryTimer); combatVictoryTimer=null; }
  if(combatVictoryFadeTimer!==null){ clearTimeout(combatVictoryFadeTimer); combatVictoryFadeTimer=null; }
}
function postCombatPhase(f=S?.foe,now=Date.now()){
  if(!f?.defeated) return "combat";
  const revealAt=Number(f.postCombatRevealAt)||0;
  const fadeAt=Number(f.postCombatFadeAt)||0;
  // Old defeated saves from v0.105.1 have no timing fields; reveal those immediately.
  if(!revealAt||now>=revealAt) return "revealed";
  if(fadeAt&&now>=fadeAt) return "fading";
  return "hold";
}
function schedulePostCombatReveal(f=S?.foe){
  clearCombatVictoryTimer();
  if(!f?.defeated||S?.foe!==f) return;
  const now=Date.now(), fadeAt=Number(f.postCombatFadeAt)||0, revealAt=Number(f.postCombatRevealAt)||0;
  if(fadeAt>now){
    combatVictoryFadeTimer=setTimeout(()=>{
      combatVictoryFadeTimer=null;
      if(S?.foe===f&&f.defeated) render();
    },Math.max(0,fadeAt-now));
  }
  if(revealAt>now){
    combatVictoryTimer=setTimeout(()=>{
      combatVictoryTimer=null;
      if(S?.foe===f&&f.defeated) render();
    },Math.max(0,revealAt-now));
  }
}
function finalizeCombatVictory(foe){
  if(combatVictoryPending!==foe) return;
  clearCombatVictoryTimer();
  worldCombatCancelQueuedPower({refund:true});
  const companionWasFollowing=temporaryCompanionActive();
  if(S?.travelEvent?.id==="loot-found") S.travelEvent=null;
  S.pendingLoot=null;
  if(S?.foe===foe) S.foe=null;
  combatVictoryPending=null;
  if(ensureInteractionState()?.pending){activateQueuedInteraction();return;}
  if(companionWasFollowing)companionLeaveCombat();
  render();
}

function finishKill(out){
  const f=S.foe;
  if(!f) return;
  worldCombatCancelQueuedPower({refund:true});
  const wasSide=!!f.side, wasBoss=!!f.boss, wasMimic=!!f.mimic, wasCaravan=!!f.caravan;
  const bossStratum=f.bossStratum??Math.max(0,Math.floor(S.depth/FATHOMS_PER_STRATUM));
  S._lootFoundCurrent=[];

  S.kills=(S.kills||0)+1;
  const reward=awardKill(f);
  let sustain="";
  if(boonActive("poultice") && S.hp<S.hpMax){
    const before=S.hp;
    S.hp=Math.min(S.hpMax,S.hp+poulticeHealAmount());
    const healed=S.hp-before;
    if(healed>0) sustain=`<p class="good">Poultice: recovered <b>${healed} HP</b> after the kill.</p>`;
  }

  travelLogAdd(`You put down the <b>${esc(f.name)}</b>.`,"good");
  say(out+`<p class="said">The ${esc(f.name)} went down and stayed down.</p>`+reward+sustain);
  f.hp=0;
  f.defeated=true;
  const postCombatNow=Date.now();
  f.postCombatFadeAt=postCombatNow+POST_COMBAT_FADE_START_MS;
  f.postCombatRevealAt=postCombatNow+POST_COMBAT_REVEAL_DELAY_MS;
  combatVictoryPending=f;
  clearCombatVictoryTimer();
  S.heavyCharge=0;
  S.strikeChain=0;
  S.defenceChain=0;
  S.protection=0;
  S.protectionMax=0;
  S.protectionSource=null;
  S.defencePrepared=null;
  S.negateNextAttack=null;
  S.reactionAvailable=false;
  S.reactionWindow=false;
  S.combatTimeline=null;
  S.combatActor="player";
  clearEnemyTurnTimer();
  S.abilityQuickUsed=false;
  armed=null;

  if(f.worldEntityId&&!wasBoss&&!wasMimic&&!wasCaravan){
    const rolled=rollWorldGoblinLoot(f);f._worldLootPayload=rolled.payload;if(rolled.labels.length)S._lootFoundCurrent.push(...rolled.labels);
  }else{
    maybeMonsterLoot(f);
    maybeQuestCombatDrop(f);
  }
  if(wasSide) maybeSideKey(f);

  if(curseActive()){
    S.curse.remaining--;
    if(S.curse.remaining<=0){
      travelLogAdd(`<b>${esc(S.curse.name)}</b> finally lifts after the completed encounter.`,"good");
      S.curse=null;
    }else travelLogAdd(`${esc(S.curse.name)}: <b>${S.curse.remaining}</b> completed encounters remain.`,"note");
  }

  if(S.hollowRespite?.remaining>0){
    S.hollowRespite.remaining--;
    if(S.hollowRespite.remaining<=0){
      clearHollowRespite();
      travelLogAdd(`<b>Sheltered</b> fades after the completed encounter.`,"note");
    }
  }

  if(wasSide && sideAreaActive()){
    S.sideArea.encountersDefeated++;
    S.sideArea.activity=0;
    S.sideArea.routeNodeActive=false;
    S.travelSinceEvent=0;
    travelLogAdd(`Side passage progress: <b>${S.sideArea.encountersDefeated}/${S.sideArea.encountersNeeded} stages cleared</b>.`,"beat");
    if(S.sideArea.encountersDefeated>=S.sideArea.encountersNeeded) S.sideArea.endReached=true;
  }

  if(wasBoss){
    if(f.sideBoss){
      travelLogAdd(`<b>Passage guardian defeated.</b> The reward chamber lies beyond.`,"beat");
    }else if(f.midBoss){
      S.midBossDefeated[bossStratum]=true;
      const item=generateProceduralEquipment(S.depth+18,"mid-boss");if(item){addGeneratedEquipment(item);S._lootFoundCurrent.push(`${item.name} · ${item.rarity} · iLv ${item.itemLevel} · ${formatGold(computedItemGoldValue(item))}`);}
      travelLogAdd(`<b>Mid-stratum boss defeated.</b> The route deeper is open again.`,"beat");
    }else{
      S.bossDefeated[bossStratum]=true;
      const boundary=(bossStratum+1)*FATHOMS_PER_STRATUM;
      S.depth=boundary;S.exploreElapsedMs=0;S.exploreDepth=boundary;
      const trophy=`Prototype Stratum ${bossStratum+1} Trophy`;addMisc(trophy,1);S._lootFoundCurrent.push(trophy);
      if(bossStratum===0){
        const bossGear=stratumBossEquipmentReward(), bossDef=equipmentItemDef(bossGear);
        if(bossDef && !ownsEquipmentItem(bossGear)){addEquipmentToBag(bossGear);S._lootFoundCurrent.push(`${bossDef.name} · ${bossDef.rarity} · iLv ${bossDef.itemLevel} · ${formatGold(computedItemGoldValue(bossDef))}`);}
      }
      travelLogAdd(`The boundary seal breaks. The physical route into <b>${esc(stratumName(bossStratum+1))}</b> is open; you still have to walk through it.`,"beat");
    }
  }

  if(wasCaravan)caravanCombatVictory(f);
  rescueCombatVictory(f);

  const drops=[...S._lootFoundCurrent];
  delete S._lootFoundCurrent;
  const lootRec=drops.length?openLootFound(drops,f):null;
  if(lootRec&&f.worldEntityId)f.worldLootRecordId=lootRec.id;

  recordDescentXpProgress();
  bankDescentXp();

  if(wasMimic && S.sideArea){
    S.pendingLoot=null;
    grantMimicReward();
  }else {
    render();
    if(f.worldEntityId)setTimeout(()=>{if(S?.foe===f&&f.defeated)finalizeCombatVictory(f);},700);
  }
}

/* ============================================================
   ACTIONS
   Universal actions should create matchups, not replace class abilities.
   ============================================================ */
const ACTIONS = {
  strike:{
    label(){ return strikeName(); },
    sub(){
      const sharpened=boonActive("whetstone")&&S.foe&&!S.foe.whetstoneUsed;
      const stage=strikeStage(),chain=stage===0?"start chain":stage===1?"2/3 momentum":"3/3 momentum";
      return `1 Stamina · ${chain}${sharpened?" · sharpened":""}`;
    },
    cost(){ return 1; },
    preview(){
      const f=S.foe,stage=strikeStage(),d=dmgStrike(stage),mult=strikeMultiplier(stage),hit=Math.round(playerHitChanceForAction("strike")*100);
      let text=`<span class="dmg">${hit}% hit</span> · <span class="dmg">~${d} damage</span> · ${mult.toFixed(1)}× ${attackScaleLabel()}`;
      if(stage<2)text+=` · hit to build <span class="dmg">${strikeName(stage+1)}</span>`;else text+=` · hit completes the chain, then resets`;
      if(f.offBalance)text+=` · <span class="dmg">+${Math.round((openingBonus()-1)*100)}% opening</span>`;
      if(foeDodgeActive(f))text+=` · <span class="bad">Dodge Ready: +${FOE_DODGE_AC_BONUS} AC</span>`;
      if(foeGuardActive(f))text+=` · <span class="bad">Guard Ready: damage reduced</span>`;
      return text;
    },
    run(){
      const f=S.foe,stage=strikeStage(),name=strikeName(stage),sharpened=boonActive("whetstone")&&!f.whetstoneUsed;
      if(sharpened)f.whetstoneUsed=true;
      const roll=playerAttackRollForAction("strike");
      let out=attackRollLog(roll,name);
      if(!roll.hit){S.strikeChain=0;showCombatDamagePop("foe",0,{label:"MISS · 0 DAMAGE"});return out+`<p>${esc(name)} misses the ${esc(f.name)}. <b>Momentum broken.</b></p>`;}
      const base=Math.max(1,Math.round(dmgStrike(stage)*(sharpened?1.15:1))),fx=applyOutgoingEquipmentEffects(base,{critical:roll.critical});
      f.hp-=fx.damage;S.strikeChain=stage>=2?0:stage+1;
      const momentum=stage>=2?` <span class="note">The three-hit rhythm completes and resets.</span>`:` <span class="note">Momentum: next Strike becomes <b>${strikeName(stage+1)}</b>.</span>`;
      return out+`<p>${stage===0?pick(HIT_VERBS):name} the ${esc(f.name)} for <b>${fx.damage}</b>.</p>${fx.html}${momentum}`;
    }
  },

  smite:{
    label:"Smite I",sub:"3 Stamina · weapon attack + 6 Radiant",cost:3,
    preview(){
      const d=dmgSmite(),hit=Math.round(playerHitChanceForAction("smite")*100);let text=`<span class="dmg">${hit}% hit</span> · <span class="dmg">~${d.physical} Physical + ${d.radiant} Radiant</span> · 1 ability use`;
      if(foeDodgeActive(S.foe))text+=` · <span class="bad">Dodge Ready: +${FOE_DODGE_AC_BONUS} AC; Radiant still lands on a miss</span>`;
      if(foeGuardActive(S.foe))text+=` · Guard reduces the Physical part, not Radiant`;
      return text;
    },
    run(){
      const f=S.foe,sk=abilityState("smite");if(!sk||sk.cur<=0)return `<p class="note">Smite is spent.</p>`;
      sk.cur--;triggerSmiteFx();S.heavyCharge=0;const d=dmgSmite(),roll=playerAttackRollForAction("smite");let out=attackRollLog(roll,"Smite");
      if(!roll.hit){showCombatDamagePop("foe",0,{label:"MISS · RADIANT ONLY"});const fx=applyOutgoingEquipmentEffects(d.radiant);f.hp-=fx.damage;return out+`<p>The weapon blow misses, but Radiance still sears the ${esc(f.name)} for <b>${fx.damage}</b>.</p>${fx.html}`;}
      const fx=applyOutgoingEquipmentEffects(d.total,{critical:roll.critical});f.hp-=fx.damage;
      return out+`<p>Smote the ${esc(f.name)} for <b>${d.physical} Physical</b> + <b>${d.radiant} Radiant</b> (${fx.damage} total).</p>${fx.html}${foeGuardActive(f)?`<p class="note">Its Guard blunted the weapon blow, but not the Radiance.</p>`:""}`;
    }
  },

  heavy:{
    label(){return heavyActionName();},
    sub(){return "3 Stamina · 3.2×";},
    cost(){return 3;},
    preview(){
      const f=S.foe,d=dmgHeavy(),shown=d,hit=Math.round(playerHitChanceForAction("heavy")*100);
      let text=`<span class="dmg">${hit}% hit</span> · <span class="dmg">~${shown} damage</span> · <span class="dmg">3.2× ${attackScaleLabel()}</span>`;
      if(S.className==="Rogue")text+=` · <span class="dmg">natural 20 crits ×${D20_CRIT_MULTIPLIER}</span>`;
      if(foeDodgeActive(f))text+=` · <span class="bad">Dodge Ready: +${FOE_DODGE_AC_BONUS} AC</span>`;
      if(foeGuardActive(f))text+=` · punches through most of Guard`;
      return text;
    },
    run(){
      const f=S.foe,roll=playerAttackRollForAction("heavy");let out=attackRollLog(roll,heavyActionName());S.heavyCharge=0;
      if(!roll.hit){showCombatDamagePop("foe",0,{label:"MISS · 0 DAMAGE"});return out+`<p><b>${esc(heavyActionName())} missed.</b> The full 3-Stamina commitment deals no damage.</p>`;}
      const base=dmgHeavy(1),fx=applyOutgoingEquipmentEffects(base,{critical:roll.critical});f.hp-=fx.damage;
      return out+`<p><b>${esc(heavyActionName())}.</b> Struck the ${esc(f.name)} for <b>${fx.damage}</b>${foeGuardActive(f)?", forcing through most of its Guard":""}.</p>${fx.html}`;
    }
  },

  guard:{
    label(){return defenceName();},
    sub(){return `${Math.round(defenceDamageReduction()*100)}% damage reduction · 2 Stamina`;},cost:2,
    preview(){
      const reduction=defenceDamageReduction(),I=enemyActionDescriptor(),hit=enemyAttackIncoming()?Math.round(enemyHitChanceForCurrent()*100):0;
      if(!I||I.kind!=="attack")return `Prepare <span class="dmg">${Math.round(reduction*100)}% damage reduction</span> against the next enemy attack attempt. The stance persists through non-attack enemy actions and cannot be stacked.`;
      const r=incomingEstimateBounds(),lo=Math.max(0,Math.round(r.lo*(1-reduction))),hi=Math.max(0,Math.round(r.hi*(1-reduction)));
      return `The next ${esc(I.label)} still has <span class="bad">${hit}% hit chance</span>. If it hits, reduce estimated damage <span class="bad">${r.lo}–${r.hi}</span> → <span class="dmg">${lo}–${hi}</span>.`;
    },
    run(){
      const source=defenceName(),reduction=defenceDamageReduction();
      S.defencePrepared={mode:"guard",source,reduction};
      return `<p class="good"><b>${esc(source)}.</b> Prepared <b>${Math.round(reduction*100)}% damage reduction</b> against the next enemy attack attempt.</p>`;
    }
  },

  counter:{
    label:"Counter",sub:`3 Stamina · +${COUNTER_AC_BONUS} AC · retaliate on miss`,cost:3,
    preview(){
      const I=enemyActionDescriptor();
      if(!I||I.kind!=="attack")return `Commit the turn to a Counter stance. The stance persists until an enemy attack attempt: <span class="dmg">+${COUNTER_AC_BONUS} AC</span>; if it misses, retaliate for roughly <b>2× Strike</b>. No Guard damage reduction.`;
      const before=Math.round(enemyHitChanceForCurrent()*100),after=Math.round(enemyHitChanceForCurrent({extraTargetAc:COUNTER_AC_BONUS})*100);
      return `${esc(I.label)} hit chance: <span class="bad">${before}%</span> → <span class="dmg">${after}%</span>. A miss triggers a 2× Strike retaliation; a hit deals normal damage.`;
    },
    run(){
      S.defencePrepared={mode:"counter",source:"Counter",acBonus:COUNTER_AC_BONUS};
      return `<p class="good"><b>Counter.</b> Your AC rises by <b>+${COUNTER_AC_BONUS}</b> against the next enemy attack attempt. If it misses, you retaliate; if it hits, you take normal damage.</p>`;
    }
  },

  sand:{
    label:"Sand Throw",sub(){return "2 Stamina · 60% Blind";},cost:2,
    preview(){const I=enemyActionDescriptor();return `<span class="dmg">60% chance to Blind</span> the foe and spoil its next attack attempt.${I?.kind==="attack"?` Current forecast: <b>${esc(I.label)}</b>.`:" Blind persists until an attack is attempted."}`;},
    run(){const f=S.foe;if(!f)return `<p class="note">Nothing to blind.</p>`;if(rnd()<sandChance()){f.blinded=true;return `<p class="good"><b>Sand Throw.</b> Grit catches its eyes. Its next attack attempt will miss.</p>`;}return `<p><b>Sand Throw.</b> The grit misses. Nothing changes.</p>`;}
  },

  read:{
    label(){return S.foe&&S.foe.revealed?"Study":"Read";},
    sub(){if(!S.foe)return "—";if(S.foe.readUsed)return "already studied this encounter";const reads=knowledgeReads(S.foe.key);if(reads>=6)return "mastered · no further gain";return boonActive("keptwatch")?"0 Stamina · Kept Watch":`1 Stamina · ${reads}/${reads<3?3:6} knowledge`;},
    cost(){return boonActive("keptwatch")&&reactionReadAvailable()?0:1;},
    preview(){
      const f=S.foe,reads=knowledgeReads(f.key);if(f.readUsed)return `You already studied this ${esc(f.name)}. Knowledge can advance only once per encounter.`;if(reads>=6)return `This archetype is already <span class="dmg">Mastered</span>.`;
      let text=reads===0?`Reveal its weakness permanently`:reads<3?`Study this archetype · ${reads+1}/3 knowledge · at 3: <span class="dmg">take 5% less damage</span>`:`Study this archetype · ${reads+1}/6 knowledge · at 6: <span class="dmg">weakness payoff +5%</span>`;
      text+=boonActive("keptwatch")?` · <span class="dmg">Kept Watch: 0 Stamina</span>`:` · <span class="cost">1 Stamina</span>`;text+=` · narrows the damage estimate now`;return text;
    },
    run(){
      const f=S.foe,before=knowledgeReads(f.key);if(f.readUsed)return `<p class="note">You have already studied this one during this encounter.</p>`;if(before>=6)return `<p class="note">You already know this archetype as well as this system allows.</p>`;
      f.readUsed=true;knowledge[f.key]={reads:before+1};markCharacterNotice("bestiary");f.revealed=true;const after=before+1;
      if(before===0){f.weaknessManualOpen=null;f.weaknessAutoOpenUntil=S.turn+2;return `<p class="good">Watched the ${esc(f.name)} under pressure. ${esc(f.weakness.txt)}</p><p class="note">Knowledge <b>1/3</b>. The incoming damage estimate is now narrower.</p>`;}
      if(after===3)return `<p class="good"><b>Studied: ${esc(cap(f.name))}.</b> You now take 5% less damage from this archetype.</p><p class="note">Knowledge <b>3/6</b>. The damage estimate narrows again.</p>`;
      if(after===6)return `<p class="good"><b>Mastered: ${esc(cap(f.name))}.</b> Its weakness payoff is now 5% stronger.</p><p class="note">Knowledge <b>6/6</b>. The estimate now matches the attack's real small variance.</p>`;
      const target=after<3?3:6,reward=after<3?"Studied: 5% less damage":"Mastered: weakness payoff +5%";return `<p class="good">Studied the ${esc(f.name)} under pressure.</p><p class="note">Knowledge <b>${after}/${target}</b> · next reward: ${reward}.</p>`;
    }
  },

  endturn:{
    label:"End Turn",sub:"End with Stamina remaining",cost:0,
    preview(){return `End your Player Turn now. Any unspent Stamina is lost; the enemy takes its turn.`;},
    run(){return `<p class="note"><b>End Turn.</b> You yield the remaining tempo.</p>`;}
  }
};

function applyLayOnHands(){
  const sk = abilityState("layonhands");
  if(!playerTurnActive() || !sk || sk.cur <= 0 || S.abilityQuickUsed || S.hp >= S.hpMax) return;
  const before = S.hp;
  S.hp = Math.min(S.hpMax, S.hp + 15);
  const healed = S.hp - before;
  if(healed <= 0) return;
  sk.cur--;
  S.abilityQuickUsed = true;
  closeAbilitySheet();
  triggerHealFx(healed, ["combat"]);
  say(`<p class="good"><b>${esc(abilityDisplayName("layonhands"))}.</b> Closed a wound for <b>${healed}</b> HP.</p><p class="note">Quick-use ability: it did not end your turn.</p>`);
  render();
}
function useHoldFast(){
  const sk=abilityState("holdfast");
  if(classAbilityDisabled("holdfast"))return;
  sk.cur--;closeAbilitySheet();armed=null;
  S.stamina=0;S.strikeChain=0;S.defenceChain=0;S.defencePrepared=null;
  S.negateNextAttack={name:abilityDisplayName("holdfast"),preserveHeavy:true};
  finishPlayerStaminaTurn(`<p class="good"><b>${esc(abilityDisplayName("holdfast"))}.</b> You plant yourself against the forecast <b>${esc(enemyActionDescriptor()?.label||"attack")}</b>. The next attack is negated.</p>`,"holdfast");
}

function useSmite(){
  const sk = abilityState("smite");
  if(!S.foe || !sk || sk.cur <= 0) return;
  closeAbilitySheet();
  armed = null;
  takeTurn("smite");
}
function useWithdrawAbility(){
  const sk=abilityState("withdraw");
  if(classAbilityDisabled("withdraw"))return;
  sk.cur--;S.stamina=0;closeAbilitySheet();armed=null;
  travelLogAdd(`You withdraw and hold at <b>${formatDepth(S.depth)} fathoms</b>.`, "danger");
  say(`<p class="said"><b>${esc(abilityDisplayName("withdraw"))}.</b> Broke contact cleanly.</p><p class="note">No HP cost, but you gain no XP or kill reward.</p>`);
  worldCombatCancelQueuedPower({refund:true});
  S.foe=null;S.heavyCharge=0;S.strikeChain=0;S.defenceChain=0;S.protection=0;S.protectionMax=0;S.protectionSource=null;S.defencePrepared=null;S.negateNextAttack=null;S.reactionAvailable=false;S.reactionWindow=false;S.combatTimeline=null;S.combatActor="player";
  clearEnemyTurnTimer();S.abilityQuickUsed=false;render();
}
function useAbility(id){
  if(!S || over || combatVictoryPending || !playerTurnActive()) return;
  if(id === "mend") return useQuickHeal("mend",12);
  if(id === "slip") return useNegateAbility("slip",0);
  if(id === "ward") return useNegateAbility("ward",0);
  if(["feint","dirtytrick","arcbolt"].includes(id)){
    closeAbilitySheet();
    armed = null;
    return takeTurn(id);
  }
  if(id === "layonhands") return applyLayOnHands();
  if(id === "holdfast") return useHoldFast();
  if(id === "smite") return useSmite();
  if(id === "withdraw") return useWithdrawAbility();
}

function actionLabel(key){
  const v = ACTIONS[key].label;
  return typeof v === "function" ? v() : v;
}
function actionSub(key){
  const v = ACTIONS[key].sub;
  return typeof v === "function" ? v() : v;
}
function actionCost(key){
  const v = ACTIONS[key]?.cost;
  return Math.max(0,Number(typeof v === "function" ? v() : v)||0);
}
function actionCounters(key){
  if(!S.foe)return false;
  if(["strike","heavy","smite","feint","dirtytrick","arcbolt"].includes(key))return foeGuardActive()||foeDodgeActive();
  return false;
}
function combatActionUnavailableReason(key){
  if(combatDiceBusy)return "Rolling d20";
  if(!playerTurnActive())return "Not your turn";
  if(!ACTIONS[key])return "Unavailable";
  if(key==="read"&&!reactionReadAvailable())return "Already studied";
  if((key==="guard"||key==="counter")&&S.defencePrepared)return `${S.defencePrepared.source||"Defence"} already prepared`;
  if(key==="sand"&&S.foe?.blinded)return "Already Blinded";
  const cost=actionCost(key);
  if(cost>(Number(S.stamina)||0))return `Need ${cost} Stamina`;
  return "";
}
function canUseCombatAction(key){return !combatActionUnavailableReason(key);}

/* ============================================================
   TAP TO PREVIEW, TAP AGAIN TO COMMIT

   First tap on an action arms it and fills in the preview.
   Second tap on the SAME action commits it.
   Tapping a different action just moves the arming across.
   ============================================================ */
function tapAction(key){
  if(combatDiceBusy || over || !S.foe || combatVictoryPending || !playerTurnActive() || !canUseCombatAction(key)) return;
  if(armed !== key){armed = key;render();return;}
  armed = null;
  takeTurn(key);
}

function actionTriggersEnemyReaction(key){
  return ["strike","heavy","smite","feint","dirtytrick","arcbolt"].includes(key);
}
function actionUsesPlayerAttackRoll(key){
  return ["strike","heavy","smite","feint","dirtytrick","arcbolt"].includes(key);
}
function finishPlayerStaminaTurn(out,actionKey=null){
  const bleed=tickCombatBleeding();
  if(!bleed.alive)return;
  out+=bleed.html;
  say(out);
  const surpriseOpening=S.foe?.intent==="unaware"&&!!S.foe?.surprised;
  advanceFromPlayerTurn({surpriseOpening,actionKey});
}
async function takeTurn(key){
  if(combatDiceBusy||!playerTurnActive()||!canUseCombatAction(key))return;
  const A=ACTIONS[key];if(!A)return;
  if(actionUsesPlayerAttackRoll(key)&&combatDiceEnabledFor("player")){
    combatDiceBusy=true;armed=null;render();
    try{await queuePlayerPhysicalAttackRoll(key);}finally{combatDiceBusy=false;}
    if(!S?.foe||over||combatVictoryPending||!playerTurnActive()){queuedCombatD20Roll=null;return;}
  }
  const cost=actionCost(key);
  if(cost>0)S.stamina=Math.max(0,(Number(S.stamina)||0)-cost);
  const reactionBefore=S.foe?.reaction||null;
  if(key!=="strike"&&key!=="read")S.strikeChain=0;

  let out=A.run();
  if(reactionBefore&&actionTriggersEnemyReaction(key)){
    S.foe.reaction=null;
    out+=`<p class="note"><b>${esc(cap(reactionBefore))} stance spent.</b></p>`;
  }
  if(S.foe.hp<=0){finishKill(out);return;}

  if(key==="endturn" || (Number(S.stamina)||0)<=0){
    finishPlayerStaminaTurn(out,key);
    return;
  }
  say(out);
  render();
  requestRunSave();
}

// v0.112.0: player-side Reaction windows are removed. This stub only keeps old
// delegated data-reaction clicks harmless if stale markup survives a cached frame.
function tapReaction(){ return; }

async function counterRetaliation(){
  const f=S?.foe;if(!f)return "";
  // v0.113.2: once Counter has caused/claimed a missed enemy attack, the
  // retaliation is the payoff for that successful defence and does not make a
  // second attack roll. This also prevents a redundant physical d20 throw.
  const weakness=weaknessEff().counterBonus||1;
  const base=Math.max(1,Math.round(dmgStrike(0)*2*weakness));
  const fx=applyOutgoingEquipmentEffects(base);f.hp-=fx.damage;
  return `<p class="good"><b>Counter Strike.</b> The opening guarantees the retaliation for <b>${fx.damage}</b>.</p>${fx.html}`;
}

async function resolveEnemyTurn(){
  if(enemyTurnResolving||!S?.foe||over||S.foe.defeated||!enemyTurnActive())return;
  enemyTurnResolving=true;
  try{
  S.reactionWindow=false;
  armed=null;
  const f=S.foe,I=enemyActionDescriptor(f);
  if(!I)return;

  let out="";
  let keepIntent=false;
  const prepared=S.defencePrepared;
  const negated=S.negateNextAttack;

  if(I.kind==="charge"){
    // Enemy Heavy still uses a literal wind-up turn. Prepared player defence is
    // not consumed because no attack attempt happened yet.
    f.heavyStage=2;
    keepIntent=true;
    out+=`<p class="note"><b>${esc(I.label)}.</b> The ${esc(f.name)} spends the turn winding up. <b>No damage yet.</b> Its next enemy turn releases the blow.</p>`;
  }else if(I.kind==="attack"){
    if(negated){
      out+=`<p class="good"><b>${esc(negated.name||"Defence")}.</b> ${esc(I.label)} was completely negated.</p><p class="note">No HP damage.</p>`;
      if(f.blinded)f.blinded=false;
      S.defencePrepared=null;
      S.negateNextAttack=null;
      S.defenceChain=0;
    }else if(f.blinded){
      showCombatDamagePop("hero",0,{label:"BLINDED · MISS"});
      out+=`<p class="good"><b>${esc(I.label)} missed.</b> Blinded, the ${esc(f.name)} attacks empty air.</p>`;
      if(prepared?.mode==="counter"&&S.hp>0){
        out+=`<p class="good"><b>Counter successful.</b> The missed attack opens a retaliation.</p>`;
        out+=await counterRetaliation();
      }
      f.blinded=false;
      S.defencePrepared=null;
    }else{
      const counterMode=prepared?.mode==="counter";
      const guardMode=prepared?.mode==="guard";
      const counterAc=counterMode?(prepared.acBonus||COUNTER_AC_BONUS):0;
      if(combatDiceEnabledFor("enemy")){
        combatDiceBusy=true;render();
        try{await queueEnemyPhysicalAttackRoll({extraTargetAc:counterAc,name:I.label});}finally{combatDiceBusy=false;}
        if(!S?.foe||over||S.foe.defeated||!enemyTurnActive()){queuedCombatD20Roll=null;return;}
      }
      const attackRoll=enemyAttackRollForCurrent({extraTargetAc:counterAc});
      out+=attackRollLog(attackRoll,I.label);

      if(!attackRoll.hit){
        showCombatDamagePop("hero",0,{label:"MISS · 0 DAMAGE"});
        out+=`<p class="good">The ${esc(f.name)} misses. <b>No HP damage.</b></p>`;
        if(counterMode&&S.hp>0){
          out+=`<p class="good"><b>Counter successful.</b> Your raised AC turns the attack aside and opens a retaliation.</p>`;
          out+=await counterRetaliation();
        }
      }else{
        const rolledDamage=rollIncoming();
        const incomingDamage=attackRoll.critical?Math.max(1,Math.round(rolledDamage*D20_CRIT_MULTIPLIER)):rolledDamage;
        const reduction=guardMode?clamp(Number(prepared.reduction)||0,0,0.90):0;
        const hpDamage=Math.max(1,Math.round(incomingDamage*(1-reduction)));
        S.hp-=hpDamage;
        if(hpDamage>0)showCombatDamagePop("hero",hpDamage,{critical:attackRoll.critical});
        const baseLine=`${attackRoll.critical?`<b>Critical Hit.</b> Natural 20 doubles the blow. `:""}${esc(I.label)} hits for <b>${incomingDamage}</b> after physical Armor.`;
        if(guardMode){
          out+=`<p class="hurt">${baseLine} <b>${esc(prepared.source||defenceName())}</b> reduces it by ${Math.round(reduction*100)}% → <b>${hpDamage} HP</b>.</p>`;
        }else{
          out+=`<p class="hurt">${baseLine} You take <b>${hpDamage} HP</b>.</p>`;
        }
        const reflected=reflectedDamageFromHit(hpDamage);
        if(reflected>0){f.hp-=reflected;showCombatDamagePop("foe",reflected);out+=`<p class="good"><b>Damage Reflect.</b> ${reflected} damage returned.</p>`;}
      }

      if(prepared&&["guard","counter"].includes(prepared.mode)&&S.hp>0&&f.intent==="heavy"&&Number(f.heavyStage)===2){
        f.offBalance=true;f.offBalanceStruck=false;
        out+=`<p class="good">The committed blow carries it past its footing. <b>Off-Balance.</b></p>`;
      }
      S.defencePrepared=null; // every attack attempt consumes Guard/Counter, hit or miss
    }

    if(f.intent==="offquick"&&f.offBalance){
      f.offBalanceStruck=true;
      out+=`<p class="note">It lashed out instead of recovering its footing. It is still <b>Off-Balance</b>.</p>`;
    }
    if(f.intent==="heavy"&&Number(f.heavyStage)===2)f.heavyStage=0;
  }else if(I.heal){
    const h=Math.round(f.hpMax*I.heal),before=f.hp;
    f.hp=Math.min(f.hpMax,f.hp+h);
    out+=`<p class="note"><b>${esc(I.label)}.</b> It gives ground and recovers <b>${f.hp-before}</b> HP. Any prepared Guard/Counter remains waiting for an attack.</p>`;
  }else if(f.intent==="steady"&&f.offBalance){
    f.offBalance=false;f.offBalanceStruck=false;
    out+=`<p class="note"><b>Steady.</b> It spends the turn finding its footing again. Any prepared Guard/Counter remains waiting for an attack.</p>`;
  }else{
    out+=`<p class="note"><b>${esc(I.label)}.</b> It spends the turn without attacking. Any prepared Guard/Counter remains waiting for an attack.</p>`;
  }

  if(!keepIntent)S.negateNextAttack=null;
  advanceEnemyBackgroundCharges();
  rollEnemyReaction();

  if(S.hp<=0)return die(out);
  if(f.hp<=0){finishKill(out);return;}

  const bleed=tickCombatBleeding();
  if(!bleed.alive)return;
  out+=bleed.html;
  say(out);
  enemyTurnTimer=setTimeout(()=>{
    enemyTurnTimer=null;
    advanceFromEnemyTurn({keepIntent});
  },ENEMY_TURN_AFTERMATH_MS);
  render();
  }finally{
    enemyTurnResolving=false;
  }
}

function tapRun(){
  if(combatDiceBusy||over||!S.foe||!playerTurnActive()||(Number(S.stamina)||0)<PLAYER_TURN_STAMINA)return;
  if(armed!=="run"){armed="run";render();return;}
  armed=null;
  const chance=runSuccessChance();
  S.runAttempts=(syncRunAttempts()||0)+1;
  if(rnd()>=chance){
    travelLogAdd(`You fail to break contact. The foe keeps the initiative.`,"danger");
    takeTurn("runattempt");
    return;
  }
  S.stamina=0;
  const c=runCost();
  S.hp-=c;
  if(S.hp<=0)return die(`<p class="hurt">Turned to run. Did not get far.</p>`);
  travelLogAdd(`You break contact and hold at <b>${formatDepth(S.depth)} fathoms</b>.`,"danger");
  say(`<p class="said">Broke contact and did not look back.</p>`+(c?`<p class="hurt">It cost <b>${c}</b> on the way out.</p>`:`<p class="note">It let you go.</p>`));
  if(S.foe?.caravan)caravanCombatAbandoned(S.foe);
  const rescueAbandoned=rescueCombatAbandoned(S.foe);
  const companionStillFollowing=temporaryCompanionActive();
  clearEnemyTurnTimer();
  worldCombatCancelQueuedPower({refund:true});
  S.foe=null;S.heavyCharge=0;S.strikeChain=0;S.defenceChain=0;S.protection=0;S.protectionMax=0;S.protectionSource=null;S.defencePrepared=null;S.negateNextAttack=null;S.reactionAvailable=false;S.reactionWindow=false;S.combatTimeline=null;S.abilityQuickUsed=false;S.combatActor="player";
  if(companionStillFollowing&&!rescueAbandoned)companionLeaveCombat("Are they gone?");
  render();
}

function die(out){
  clearEnemyTurnTimer();
  over=true;
  if(S){S.protection=0;S.protectionMax=0;S.protectionSource=null;S.defencePrepared=null;S.negateNextAttack=null;S.reactionAvailable=false;S.reactionWindow=false;S.combatTimeline=null;S.combatActor="player";}
  pauseBoonClock();
  say(out + `<p class="hurt said">You did not get up.</p>`);
  saveRunNow();
  render();
  setTimeout(()=>{ if(over) showDeathScreen(); },1200);
}

/* ============================================================
   RENDER — repaints the whole screen from S
   ============================================================ */
function travelLogAdd(html, cls=""){
  if(!S) return;
  if(!Array.isArray(S.travelLog)) S.travelLog = [];
  const entry = {depth:S.depth, html, cls};
  S.travelLog.push(entry);
  if(S.travelLog.length > 120) S.travelLog.shift();

  const r = $("travelLog");
  if(!r) return;
  const nearBottom = r.scrollHeight - r.scrollTop - r.clientHeight < 44;
  const row = document.createElement("div");
  row.className = `travel-entry ${cls}`;
  row.innerHTML = `<span class="depth">${formatDepth(entry.depth)}f</span><p>${html}</p>`;
  r.appendChild(row);
  while(r.children.length > 120) r.removeChild(r.firstChild);
  if(nearBottom) r.scrollTop = r.scrollHeight;
}

function renderCombatLog(){
  const entries=Array.isArray(S?.combatLog)?S.combatLog:[];
  const activeWorld=!!$("worldCanvas");
  const shown=(activeWorld&&combatHistoryOpen)?entries:(entries.length?entries.slice(-2):[`<p class="note">Nothing has happened yet.</p>`]);
  const r=$("readout");
  if(r){
    r.innerHTML=(shown.length?shown:[`<p class="note">Nothing has happened yet.</p>`]).map(html=>`<div class="combat-log-entry">${html}</div>`).join("");
    if(activeWorld&&combatHistoryOpen) requestAnimationFrame(()=>{r.scrollTop=r.scrollHeight;});
  }
  const list=$("combatHistoryList");
  if(list){
    list.innerHTML=entries.length?entries.map(html=>`<div class="combat-log-entry">${html}</div>`).join(""):`<div class="combat-log-entry"><p class="note">Nothing has happened yet.</p></div>`;
    list.scrollTop=list.scrollHeight;
  }
  const meta=$("combatHistoryMeta");
  if(meta) meta.textContent=`${entries.length} entr${entries.length===1?"y":"ies"}`;
}
function setCombatHistoryOpen(open){
  combatHistoryOpen=!!open;
  const activeWorld=!!$("worldCanvas"),sheet=$("combatHistorySheet"),btn=$("btnCombatLogToggle"),wrap=$("combatLogWrap");
  if(activeWorld){
    if(sheet) sheet.hidden=true;
    if(wrap){wrap.classList.toggle("world-log-expanded",combatHistoryOpen);const head=wrap.querySelector(".combat-log-head h2");if(head)head.textContent=combatHistoryOpen?"Combat log":"Latest exchange";}
    if(btn){btn.setAttribute("aria-expanded",combatHistoryOpen?"true":"false");btn.textContent=combatHistoryOpen?"Collapse":"History";}
    renderCombatLog();
    return;
  }
  if(sheet) sheet.hidden=!combatHistoryOpen;
  if(btn) btn.setAttribute("aria-expanded",combatHistoryOpen?"true":"false");
  if(combatHistoryOpen) renderCombatLog();
}
function renderCombatLogCollapse(){
  const btn=$("btnCombatLogToggle");
  if(btn) btn.setAttribute("aria-expanded",combatHistoryOpen?"true":"false");
}
function toggleCombatLog(){
  setCombatHistoryOpen(true);
}
function say(html){
  if(!S) return;
  if(S.foe){
    if(!Array.isArray(S.combatLog)) S.combatLog=[];
    S.combatLog.push(html);
    if(S.combatLog.length>40) S.combatLog.shift();
  }else{
    S.combatLog=[html];
  }
  renderCombatLog();
  renderCombatLogCollapse();
}

function hpClass(el, frac){
  el.classList.toggle("mid", frac <= 0.50 && frac > 0.22);
  el.classList.toggle("low", frac <= 0.22);
}
function playerHpClass(el, frac){
  if(!el) return;
  el.classList.toggle("mid", frac <= 0.50 && frac > 0.25);
  el.classList.toggle("low", frac <= 0.25);
}

function renderCombatHeader(){
  $("place").textContent = stratumName(stratumIndex());
  $("meta").textContent = `${formatDepth(S.depth)} fathoms · encounter ${S.encounter}`;
}

let trailVisualDepth = null;
let trailAnimFrame = null;
const TRAIL_RENDER_TARGETS = [
  {
    key:"mini", world:"trailWorldMini",
    corridor:"trailCorridor", path:"trailPath", marks:"trailMarks", marker:"trailMarker",
    sideCorridor:"trailSideCorridor", sidePath:"trailSidePath",
    behind:TRAIL_BEHIND, ahead:TRAIL_AHEAD, verticalZoom:TRAIL_VERTICAL_ZOOM,
    htmlLabels:null
  },
  {
    key:"large", world:"trailWorldLarge",
    corridor:"trailCorridorLarge", path:"trailPathLarge", marks:"trailMarksLarge", marker:"trailMarkerLarge",
    sideCorridor:"trailSideCorridorLarge", sidePath:"trailSidePathLarge",
    behind:TRAIL_BEHIND*1.875, ahead:TRAIL_AHEAD*1.875, verticalZoom:TRAIL_VERTICAL_ZOOM*0.74,
    htmlLabels:"trailLabelsLarge"
  }
];
const trailWorldState = new Map();

function trailWave(depth){
  return Math.sin(depth * 0.72) * 6 + Math.sin(depth * 1.61 + 0.8) * 2.5;
}

function sideAreaRouteProgress(area=S?.sideArea){
  if(!area) return 0;
  if(area.completed || area.endReached) return 1;
  const needed=Math.max(1,area.encountersNeeded||4);
  const resolved=clamp((area.encountersDefeated||0)/needed,0,1);
  const between=clamp((area.activity||0)/4,0,1);
  return clamp(.08 + resolved*.75 + between*.17,.08,.98);
}
function sideBranchPath(anchorX,anchorY,progress=1,routeOffsets=null){
  return sideBranchGeometry(anchorX,anchorY,progress,routeOffsets).d;
}

function trailStructureSignature(){
  const active=sideAreaActive();
  const area=S?.sideArea;
  const activeProgress=active?sideAreaRouteProgress(area).toFixed(3):"-";
  const history=(S?.sideAreaHistory||[]).map(h=>`${Number(h.entryDepth||0).toFixed(2)}:${Number(h.progress??(h.completed?1:.5)).toFixed(2)}:${h.completed?1:0}`).join("|");
  const merchants=(S?.merchantHistory||[]).map(h=>Number(h.depth||0).toFixed(2)).join(",");
  // v0.108.1: road markers are part of the cached trail structure. Track the
  // actual pending road slot, including caravan id/type/depth, so changing from
  // a caravan to a normal merchant (or vice versa) cannot leave a stale icon.
  const pendingMerchantDepth=S?.pendingMerchant?.depth??"-";
  const pendingCaravanState=pendingCaravan();
  const pendingCaravanSig=pendingCaravanState?`${pendingCaravanState.id}:${pendingCaravanState.type}:${Number(pendingCaravanState.depth||0).toFixed(2)}`:"-";
  const bosses=`${Object.entries(S?.midBossDefeated||{}).filter(([,v])=>v).map(([k])=>k).join(",")}/${Object.entries(S?.bossDefeated||{}).filter(([,v])=>v).map(([k])=>k).join(",")}`;
  const hollows=Object.entries(S?.hollowStates||{}).map(([k,v])=>`${k}:${v}`).join(",");
  const sideDiscovery=`${S?.sideDiscoveryAttempted?1:0}:${Number(S?.sideDiscoveryAt||0).toFixed(2)}`;
  const ts=ensureTownState();
  const towns=TOWN_DEFS.map(t=>`${t.id}:${ts?.visited?.[t.id]?1:0}:${ts?.departed?.[t.id]?1:0}:${ts?.currentId===t.id?1:0}`).join("|");
  const quests=questInstances().map(q=>`${q.instanceId}:${q.status}:${Number(q.targetDepth||0).toFixed(2)}`).join("|");
  return `${active?1:0}:${activeProgress}:${area?.entryDepth??"-"}:${history}:${merchants}:${pendingMerchantDepth}:${pendingCaravanSig}:${bosses}:${hollows}:${sideDiscovery}:${towns}:${quests}`;
}

function syncLargeTrailLabels(layerId,labelPositions){
  const layer=$(layerId);
  if(!layer)return;
  const wanted=new Set(labelPositions.map(p=>String(p.depth)));
  for(const node of [...layer.children]){
    if(!wanted.has(node.dataset.depth)) node.remove();
  }
  for(const p of labelPositions){
    const key=String(p.depth);
    let node=[...layer.children].find(n=>n.dataset.depth===key);
    if(!node){
      node=document.createElement("span");
      node.className="trail-html-label";
      node.dataset.depth=key;
      node.textContent=formatDepth(p.depth).replace('.0','');
      layer.appendChild(node);
    }
    node.classList.toggle("major",p.major);
    node.style.left=`${(p.x/TRAIL_W)*100}%`;
    node.style.top=`${(p.labelY/TRAIL_H)*100}%`;
  }
}

function syncTrailLandmarks(target,landmarks){
  const world=$(target.world);if(!world)return;
  let layer=world.querySelector('.trail-landmarks-layer');
  if(!layer){layer=document.createElement('div');layer.className='trail-landmarks-layer';world.appendChild(layer);}
  layer.innerHTML=landmarks.map((lm,i)=>`<span class="trail-landmark-html ${lm.type}${lm.visited?" visited":""}" style="left:${(lm.x/TRAIL_W*100).toFixed(3)}%;top:${(lm.y/TRAIL_H*100).toFixed(3)}%" title="${esc(lm.title||lm.type)}"></span>`).join('');
}
function rebuildTrailWorld(target,anchorDepth){
  const behind=target.behind ?? TRAIL_BEHIND;
  const ahead=target.ahead ?? TRAIL_AHEAD;
  const span=behind+ahead;
  const verticalZoom=target.verticalZoom ?? TRAIL_VERTICAL_ZOOM;
  const anchorViewStart=Math.max(0,anchorDepth-behind);
  const anchorWave=trailWave(anchorDepth);
  const xScale=TRAIL_W/span;
  const xOf=d=>(d-anchorViewStart)*xScale;
  const yOf=d=>TRAIL_MARKER_Y+((d-anchorDepth)*2.25+(trailWave(d)-anchorWave))*verticalZoom;
  const buffer=Math.max(TRAIL_TICK*2,span*.55);
  const worldFrom=Math.max(0,anchorViewStart-buffer);
  const worldTo=anchorViewStart+span+buffer;

  const pts=[];
  for(let d=Math.max(0,worldFrom-.5);d<=worldTo+.501;d+=.5) pts.push([xOf(d),yOf(d)]);
  const path=pts.map((p,i)=>`${i?"L":"M"}${p[0].toFixed(2)},${p[1].toFixed(2)}`).join(" ");

  let marks="";
  const labelPositions=[];
  const firstTick=Math.ceil(worldFrom/TRAIL_TICK)*TRAIL_TICK;
  for(let d=firstTick;d<=worldTo+.001;d+=TRAIL_TICK){
    const x=xOf(d),y=yOf(d),major=Math.abs(d%FATHOMS_PER_STRATUM)<.001;
    marks+=`<line class="trail-tick" x1="${x.toFixed(2)}" y1="${(y-5).toFixed(2)}" x2="${x.toFixed(2)}" y2="${(y+5).toFixed(2)}"></line>`;
  }
  const firstBoundary=Math.ceil(worldFrom/FATHOMS_PER_STRATUM)*FATHOMS_PER_STRATUM;
  for(let d=firstBoundary;d<=worldTo+.001;d+=FATHOMS_PER_STRATUM){
    if(d<=0)continue;
    const x=xOf(d);
    marks+=`<line class="trail-boundary" x1="${x.toFixed(2)}" y1="${(TRAIL_MARKER_Y-TRAIL_H).toFixed(2)}" x2="${x.toFixed(2)}" y2="${(TRAIL_MARKER_Y+TRAIL_H).toFixed(2)}"></line>`;
  }
  const landmarks=[];
  const TOWN_LANDMARK_CLEARANCE=3.6; // fathoms; prevents authored town pins from visually stacking with incidental markers
  const nearAuthoredTown=depth=>TOWN_DEFS.some(t=>Math.abs(Number(t.depth)-Number(depth))<TOWN_LANDMARK_CLEARANCE);
  const addLandmark=(type,depth,visited=false,title="")=>{
    if(depth<worldFrom-.001||depth>worldTo+.001)return;
    if(type!=="town"&&type!=="city"&&nearAuthoredTown(depth))return;
    landmarks.push({type,depth,visited,title});
  };
  const ts=ensureTownState();
  for(const t of TOWN_DEFS) addLandmark(t.kind==="city"?"city":"town",t.depth,!!ts?.departed?.[t.id],t.name);
  for(const q of activeQuestDestinationLandmarks())addLandmark("quest",q.depth,false,q.title);
  // v0.108.1: one road-traffic slot means one road marker. Never derive this
  // from currentMerchant(), because that helper may point at a caravan trader or
  // town service. The pending slot itself owns the map icon.
  const caravanLm=activeCaravanLandmark();
  if(caravanLm)addLandmark(caravanLm.type||"caravan-event",caravanLm.depth,false,caravanLm.title);
  else if(S?.pendingMerchant)addLandmark("merchant",Number(S.pendingMerchant.depth)||0,false,`${S.pendingMerchant.title} ${S.pendingMerchant.name}`);
  for(const h of (S.merchantHistory||[]))addLandmark("merchant",Number(h.depth)||0,true,h.name||"Merchant camp");
  const firstStratum=Math.max(0,Math.floor(worldFrom/FATHOMS_PER_STRATUM)),lastStratum=Math.max(firstStratum,Math.floor(worldTo/FATHOMS_PER_STRATUM));
  for(let i=firstStratum;i<=lastStratum;i++){
    const mid=midBossDepthForStratum(i),boundary=(i+1)*FATHOMS_PER_STRATUM;
    addLandmark("boss",mid,!!S.midBossDefeated?.[i],"Mid-stratum boss");
    addLandmark("boss",boundary,!!S.bossDefeated?.[i],"Stratum boss");
    for(const h of ordinaryHollowsForStratum(i))addLandmark("hollow",h.depth,!!S.hollowStates?.[h.key],"Safe hollow");
    const sh=stageHollowInfo(i);addLandmark("stage",sh.depth,!!S.hollowStates?.[sh.key],"Staging hollow");
  }
  if(S.travelEvent?.id==="side-discovery"||sideAreaActive())addLandmark("side",sideAreaActive()?Number(S.sideArea?.entryDepth||S.depth):Number(S.depth||0),false,"Side passage");
  for(const h of (S.sideAreaHistory||[]))addLandmark("side",Number(h.entryDepth)||0,true,"Side passage");
  landmarks.sort((a,b)=>a.depth-b.depth);
  for(const lm of landmarks){
    // Landmarks belong on the shaft itself. Generation keeps live events apart;
    // never float an icon above/below the route merely to avoid a collision.
    lm.offsetY=0;
    lm.x=xOf(lm.depth);lm.y=yOf(lm.depth);
  }
  syncTrailLandmarks(target,landmarks);
  for(const h of (S.sideAreaHistory||[])){
    if(h.entryDepth<worldFrom-.001||h.entryDepth>worldTo+.001)continue;
    const hx=xOf(h.entryDepth),hy=yOf(h.entryDepth);
    const hd=sideBranchPath(hx,hy,h.progress??(h.completed?1:.5),h.routeOffsets);
    marks+=`<path class="trail-side-history ${h.completed?"completed":"abandoned"}" d="${hd}"></path>`;
  }

  const corridor=$(target.corridor),mainPath=$(target.path),marksNode=$(target.marks),sideCorridor=$(target.sideCorridor),sidePath=$(target.sidePath);
  if(!corridor||!mainPath||!marksNode)return;
  corridor.setAttribute("d",path);
  mainPath.setAttribute("d",path);
  marksNode.innerHTML=marks;
  if(target.htmlLabels) syncLargeTrailLabels(target.htmlLabels,[]);

  let sideMarkerWorld=null;
  if(sideCorridor&&sidePath){
    const active=sideAreaActive();
    if(active){
      sideCorridor.removeAttribute("hidden");
      sidePath.removeAttribute("hidden");
      const entryDepth=Number(S.sideArea?.entryDepth ?? S.depth);
      const g=sideBranchGeometry(xOf(entryDepth),yOf(entryDepth),sideAreaRouteProgress(),S.sideArea.routeOffsets);
      sideCorridor.setAttribute("d",g.d);
      sidePath.setAttribute("d",g.d);
      sideMarkerWorld={x:g.end[0],y:g.end[1]};
    }else{
      sideCorridor.setAttribute("hidden","");
      sidePath.setAttribute("hidden","");
    }
  }

  trailWorldState.set(target.key,{
    anchorDepth,anchorViewStart,anchorWave,xScale,verticalZoom,span,behind,ahead,
    structure:trailStructureSignature(),worldFrom,worldTo,sideMarkerWorld
  });
}

function ensureTrailWorld(target,cameraDepth){
  let state=trailWorldState.get(target.key);
  const signature=trailStructureSignature();
  const span=(target.behind??TRAIL_BEHIND)+(target.ahead??TRAIL_AHEAD);
  const driftLimit=Math.max(TRAIL_TICK*1.5,span*.28);
  if(!state || Math.abs(cameraDepth-state.anchorDepth)>driftLimit || state.structure!==signature){
    rebuildTrailWorld(target,cameraDepth);
    state=trailWorldState.get(target.key);
  }
  return state;
}

function applyTrailCamera(target,cameraDepth){
  const state=ensureTrailWorld(target,cameraDepth);
  if(!state)return;
  const world=$(target.world),marker=$(target.marker);
  if(!world||!marker)return;

  const cameraViewStart=Math.max(0,cameraDepth-state.behind);
  const dxSvg=(state.anchorViewStart-cameraViewStart)*state.xScale;
  const dySvg=((state.anchorDepth-cameraDepth)*2.25+(state.anchorWave-trailWave(cameraDepth)))*state.verticalZoom;
  const width=world.clientWidth||world.parentElement?.clientWidth||1;
  const height=world.clientHeight||world.parentElement?.clientHeight||1;
  const dxPx=dxSvg*(width/TRAIL_W);
  const dyPx=dySvg*(height/TRAIL_H);
  world.style.transform=`translate3d(${dxPx.toFixed(3)}px,${dyPx.toFixed(3)}px,0)`;

  let markerX=((cameraDepth-cameraViewStart)/state.span)*TRAIL_W;
  let markerY=TRAIL_MARKER_Y;
  if(sideAreaActive() && state.sideMarkerWorld){
    markerX=state.sideMarkerWorld.x+dxSvg;
    markerY=state.sideMarkerWorld.y+dySvg;
  }
  marker.style.left=`${(markerX/TRAIL_W)*100}%`;
  marker.style.top=`${(markerY/TRAIL_H)*100}%`;
  marker.classList.toggle("exploring",S.travelMode==="explore"||S.travelMode==="side");
  const companion=ensureTemporaryCompanion();
  marker.classList.toggle("has-companion",!!companion&&companion.status==="following");
  marker.classList.toggle("companion-hidden",!!companion&&companion.status==="following"&&companion.hiddenForCombat);
  if(target.key==="large")positionRouteSpeech(marker);
}

function applyTrailCameras(cameraDepth){
  for(const target of TRAIL_RENDER_TARGETS) applyTrailCamera(target,cameraDepth);
}

function renderTrail(){
  const targetDepth=S.depth;
  if(trailVisualDepth===null || Math.abs(targetDepth-trailVisualDepth)>2){
    trailVisualDepth=targetDepth;
    applyTrailCameras(targetDepth);
    return;
  }
  if(Math.abs(targetDepth-trailVisualDepth)<0.001){
    applyTrailCameras(targetDepth);
    return;
  }
  if(trailAnimFrame!==null) cancelAnimationFrame(trailAnimFrame);
  const startDepth=trailVisualDepth;
  const delta=targetDepth-startDepth;
  const started=performance.now();
  const duration=TRAVEL_TICK_MS*1.04;
  const step=now=>{
    const t=clamp((now-started)/duration,0,1);
    trailVisualDepth=startDepth+delta*t;
    applyTrailCameras(trailVisualDepth);
    if(t<1) trailAnimFrame=requestAnimationFrame(step);
    else{
      trailVisualDepth=targetDepth;
      trailAnimFrame=null;
      applyTrailCameras(targetDepth);
    }
  };
  trailAnimFrame=requestAnimationFrame(step);
}

function renderSafeHollow(){
  const card=$("safeHollowCard");
  const h=S?.activeHollow;
  card.hidden=!h;
  if(!h) return;
  const stage=h.kind==="stage";
  card.classList.toggle("stage",stage);
  $("safeHollowKind").textContent=stage?"Staging hollow":"Safe hollow";
  $("safeHollowTitle").textContent=stage?"The descent waits here":"Defensible ground";
  $("safeHollowText").textContent=stage
    ? "A hard shelter before the stratum boundary. It will not move you on automatically."
    : "You can make camp here once, or leave it behind and continue deeper.";
  const camp=$("btnCampHere");
  $("btnLeaveHollow").disabled=false;
  if(S.inventory.campSupplies<=0){
    camp.disabled=false;
    camp.querySelector("b").textContent="Take shelter";
    $("campHereSub").textContent="Rest recovery · Sheltered for 3 encounters";
    $("safeHollowText").textContent=stage
      ? "You have no Camp Supplies, but this protected ground can still serve as a short Rest before the boundary."
      : "You have no Camp Supplies, but the hollow is still good enough for a short Rest before you move on.";
  }else{
    camp.disabled=false;
    camp.querySelector("b").textContent="Make camp";
    $("campHereSub").textContent=`1 Camp Supply · ${S.inventory.campSupplies} carried · 50% Max HP + full resources`;
  }
  const countdown=$("hollowCountdown");
  if(stage) countdown.textContent="No auto-continue at the pre-boss staging hollow.";
  else if(h.autoResumeCancelled) countdown.textContent="Auto-continue cancelled. The hollow will wait for your choice.";
  else{
    const left=Math.max(0,(h.autoResumeAt-Date.now())/1000);
    countdown.textContent=`Continuing automatically in ${left.toFixed(1)}s · tap anywhere to hold here`;
  }
}

function renderTravel(){
  const travel=$("travel");
  // Active World rule: entering a settlement never replaces or hides the physical
  // cavern. The legacy town state only changes which services/interactions are
  // available. Keep the Canvas travel surface alive while walking inside town.
  const canvasWorld=!!$("worldCanvas");
  const show=!!S&&!over&&(canvasWorld||!currentTown());
  travel.hidden=!show;
  if(!show) return;
  // In a walk-in settlement the bridge/world renderer owns the live HUD and
  // canvas. Do not run the old passive-travel renderer (which can schedule road
  // events and rewrite delve-only controls) merely because a town service called
  // render(). Keeping #travel visible is enough to keep the physical city alive.
  if(canvasWorld&&currentTown()) return;
  syncTravelMapMode();
  const idx=stratumIndex();
  $("travelBand").textContent=`Stratum ${idx+1}`;
  $("buildVersion").textContent=BUILD_VERSION;
  $("travelStratum").textContent=stratumName(idx);
  $("travelDepth").textContent=formatDepth(S.depth);
  $("travelHeroName").textContent=S.name;
  $("travelHeroLv").textContent=`Level ${S.level}${S.statPoints>0?` · ${S.statPoints} pt${S.statPoints===1?"":"s"}`:""}`;
  const travelHpFrac=clamp(S.hp/S.hpMax,0,1);
  playerHpClass($("travelHp")?.parentElement,travelHpFrac);
  $("travelHp").style.width=`${travelHpFrac*100}%`;
  $("travelHpN").textContent=`${Math.max(0,S.hp)} / ${S.hpMax} hp`;
  $("travelXp").textContent=`${S.xp} / ${xpToNext(S.level)} XP`;
  if($("travelXpBar")) $("travelXpBar").style.width=`${clamp(S.xp/Math.max(1,xpToNext(S.level)),0,1)*100}%`;
  maybeScheduleMerchant();
  renderTrail();
  renderCaravanEarlyWarning();
  renderTravelEvent();
  renderSafeHollow();
  // Inventory/equipment is rendered on open and on actual inventory interactions.
  // Rebuilding it on every 500 ms travel tick caused the horizontal filter row
  // to visibly flicker even though its scroll position was restored afterward.
  renderActiveBoon();
  renderBoonChoice();

  const status=$("travelStatus");
  status.classList.toggle("moving",S.travelMode==="descend");
  status.classList.toggle("exploring",S.travelMode==="explore");
  if(S.travelEvent) status.innerHTML=`<b>Something caught your attention.</b> The delve waits for your choice.`;
  else if(S.activeHollow) status.innerHTML=S.activeHollow.kind==="stage"?`<b>Staging hollow.</b> Safe ground before the stratum boundary.`:`<b>Safe hollow.</b> Camp here or decide to move on.`;
  else if(S.travelMode==="descend") status.innerHTML=`<b>Descending.</b> You keep moving deeper until something interrupts you.`;
  else if(S.travelMode==="explore") status.innerHTML=`<b>Exploring<span class="passage-dots"></span></b> Depth is locked at ${formatDepth(S.depth)} fathoms · <span class="explore-time">${formatExploreTime()}</span> explored.`;
  else{
    const exploredHere=(S.exploreElapsedMs||0)>0&&Math.abs((S.exploreDepth??S.depth)-S.depth)<=0.0001;
    status.innerHTML=exploredHere?`<b>Held.</b> Descend deeper or explore this depth · ${formatExploreTime()} explored here.`:`<b>Held.</b> Descend deeper or explore this depth.`;
  }

  const atHollow=!!S.activeHollow,inTravelEvent=!!S.travelEvent,choosingBoon=!!S.pendingBoonChoice;
  $("btnDescend").classList.toggle("active",S.travelMode==="descend");
  $("btnExplore").classList.toggle("active",S.travelMode==="explore");
  $("btnDescend").disabled=atHollow||inTravelEvent||choosingBoon;
  $("btnExplore").disabled=atHollow||inTravelEvent||choosingBoon;
  $("btnPack").disabled=inTravelEvent;
  $("btnStopTravel").disabled=atHollow||inTravelEvent||choosingBoon||S.travelMode==="stopped";
  const heal=restHealAmount(),ready=restReady(),rest=$("btnRest");
  rest.disabled=!canRest();
  const missingAbilities=abilitiesNeedRestoration();
  if(!ready) $("restSub").textContent=`${S.restRecovery.toFixed(1)} / ${REST_RECOVERY_REQUIRED} new deepest fathoms`;
  else{
    const bits=[];
    if(S.hp<S.hpMax) bits.push(`+${heal} HP`);
    if(missingAbilities) bits.push(`recover 1 ability use`);
    $("restSub").textContent=bits.length?bits.join(" · "):`fully recovered`;
  }

  if(sideAreaActive()){
    $("travelBand").textContent=`Side passage · Stratum ${stratumIndex(S.sideArea.entryDepth)+1}`;
    $("travelStratum").textContent=S.sideArea.name;
    $("travelDepth").textContent=formatDepth(S.sideArea.entryDepth);
    status.classList.toggle("moving",false);
    status.classList.toggle("exploring",S.travelMode==="side");
    if(!S.travelEvent) status.innerHTML=S.travelMode==="side"
      ? `<b>Exploring passage<span class="passage-dots"></span></b> · <span class="side-time">${formatExploreTime(S.sideArea.elapsedMs||0)}</span> inside · <span class="side-progress">${S.sideArea.encountersDefeated}/${S.sideArea.encountersNeeded} stages cleared</span>`
      : `<b>Held inside passage.</b> <span class="side-time">${formatExploreTime(S.sideArea.elapsedMs||0)}</span> explored · <span class="side-progress">${S.sideArea.encountersDefeated}/${S.sideArea.encountersNeeded} stages cleared</span>`;
    $("btnDescend").disabled=true;
    $("btnDescend").classList.remove("active");
    $("btnExplore").disabled=!!S.travelEvent;
    $("btnExplore").classList.toggle("active",S.travelMode==="side");
    $("btnExplore").querySelector("b").textContent=S.travelMode==="side"?"Exploring Passage":"Explore Passage";
    $("btnExplore").querySelector("span").textContent=S.travelMode==="side"?"tap to consider turning back":"continue into the side area";
    $("btnStopTravel").disabled=!!S.travelEvent||S.travelMode==="stopped";
  }else{
    $("btnExplore").querySelector("b").textContent="Explore";
    $("btnExplore").querySelector("span").textContent="hold this depth";
/* Active afflictions stay in the compact character-effect badges below so the travel header cannot squeeze the map/log column. */
  }
  $("packSub").textContent=`${S.inventory.campSupplies} Camp Supplies · ${S.inventory.bandages} Bandage${S.inventory.bandages===1?"":"s"}`;
  document.querySelectorAll(".passage-dots").forEach(el=>el.textContent=liveExploreDots());
  renderTravelEffects();
  syncBrowseTravelUI();
}

function combatLootRecordForFoe(f=S?.foe){
  if(!f||!Array.isArray(S?.lootHistory)) return null;
  for(let i=S.lootHistory.length-1;i>=0;i--){
    const rec=S.lootHistory[i];
    if(Number(rec?.encounter)===Number(S.encounter) && String(rec?.foeName||"")===String(f.name||"")) return rec;
  }
  return null;
}
function renderCombatLootPanel(){
  const panel=$("combatLootPanel");if(!panel)return;
  const f=S?.foe,post=!!f&&!f.worldRealtime&&postCombatPhase(f)==="revealed";
  panel.hidden=!post;
  if(!post){panel.innerHTML="";return;}
  const rec=combatLootRecordForFoe(f);
  const items=rec?.items||[];
  const itemHtml=items.length
    ? items.map((item,i)=>`<div class="combat-loot-item"><b>${esc(item)}</b><span>${rec?.bonusItems?.includes(item)?"Investigation":"Collected"}</span></div>`).join("")
    : `<div class="combat-loot-empty">Nothing worth carrying was recovered from this foe.</div>`;
  const loot=S.pendingLoot && Number(S.pendingLoot.encounter)===Number(S.encounter)?S.pendingLoot:null;
  const canSearch=!!loot&&!loot.searched;
  const search=canSearch
    ? `<div class="combat-loot-search"><b>Something may have been overlooked.</b><span>Perception caught a detail worth checking carefully. ${skillCheckPreview("investigation",Number.isFinite(loot.searchChallenge)?loot.searchChallenge:authoredChallenge(12))}</span></div>`
    : rec?.searchResult?`<div class="combat-loot-result">${esc(rec.searchResult)}</div>`:"";
  const investigate=canSearch?`<button class="combat-loot-btn investigate" type="button" data-combat-loot-investigate><b>Investigate</b><span>Search for one possible additional find</span></button>`:"";
  panel.innerHTML=`<div class="combat-loot-head"><div><em>Encounter resolved</em><b>Recovered</b></div><span>${items.length} find${items.length===1?"":"s"}</span></div><div class="combat-loot-items">${itemHtml}</div>${search}<div class="combat-loot-actions ${canSearch?"":"single"}">${investigate}<button class="combat-loot-btn continue" type="button" data-combat-loot-continue><b>Continue</b><span>Leave the defeated foe behind</span></button></div>`;
}

function renderCombatTimeline(){
  const box=$("combatTimeline"),track=$("combatTimelineTrack"),summary=$("combatSpeedSummary");
  if(!box||!track)return;
  const f=S?.foe;
  box.hidden=!f||!!f.worldRealtime||!!f.defeated||over;
  if(box.hidden){track.innerHTML="";if(summary)summary.textContent="—";return;}
  const slots=simulateTimelineSlots(TIMELINE_VISIBLE_SLOTS);
  track.innerHTML=slots.map(slot=>{
    const who=slot.actor==="player"?"YOU":"ENEMY";
    return `<div class="timeline-slot ${slot.actor} ${slot.current?"current":""}"><strong>${who}</strong><span>TURN ${slot.turn}</span></div>`;
  }).join("");
  if(summary)summary.textContent="FIXED ALTERNATION · SPEED PARKED";
}

function render(){
  checkBoonExpiry();
  if(S?.foe?.worldRealtime)clearCombatTransitionVisual();
  renderCombatHeader();
  renderTown();
  renderTravel();
  renderInteraction();
  renderActiveBoon();
  renderBoonChoice();
  renderWorldLootSheet();
  renderTravelLogCollapse();

  $("heroName").textContent = S.name;
  $("heroLv").textContent = "Level " + S.level;
  $("heroStats").textContent = `STR ${effectiveStat("STR")} · CON ${effectiveStat("CON")} · DEX ${effectiveStat("DEX")}`;
  $("heroXp").textContent = `${S.xp} / ${xpToNext(S.level)} XP`;
  if($("heroXpBar")) $("heroXpBar").style.width=`${clamp(S.xp/Math.max(1,xpToNext(S.level)),0,1)*100}%`;

  const hf = clamp(S.hp/S.hpMax,0,1);
  playerHpClass($("heroBar"),hf);
  $("heroHp").style.width = hf*100 + "%";
  $("heroHpN").textContent = `${Math.max(0,S.hp)} / ${S.hpMax}`;
  const prot=Math.max(0,Math.round(Number(S.protection)||0)),protMax=Math.max(prot,Math.round(Number(S.protectionMax)||0)),protEl=$("heroProtection"),protN=$("heroProtectionN");
  if(protEl){
    protEl.style.width=`${clamp(prot/Math.max(1,S.hpMax),0,1)*100}%`;
    protEl.classList.toggle("active",prot>0);
    protEl.classList.remove("spent");
    protEl.title=`Protection ${prot}/${protMax}`;
  }
  if(protN){
    protN.hidden=false;
    protN.classList.remove("spent");
    protN.textContent=`PROT ${prot}/${protMax}`;
    protN.title="PROT = persistent ability-granted Protection. Normal combat defence does not generate it in this test.";
  }

  const staminaNow=clamp(Math.floor(Number(S.stamina)||0),0,PLAYER_TURN_STAMINA);
  $("pips").innerHTML = Array.from({length:PLAYER_TURN_STAMINA},(_,i)=>`<i class="${i<staminaNow?"on":""}"></i>`).join("");
  $("staminaN").textContent = `${staminaNow} / ${PLAYER_TURN_STAMINA}`;

  const f = S.foe;
  const arenaNode=$("arena");
  if(arenaNode) arenaNode.classList.toggle("combat-scroll",!!f&&!f.worldRealtime&&!over);
  if(arenaNode) arenaNode.classList.toggle("combat-mode",!!f&&!f.worldRealtime);
  const resolutionPhase=postCombatPhase(f);
  if(arenaNode){
    arenaNode.classList.toggle("player-slot-active",!!f&&!f.worldRealtime&&!f.defeated&&!over&&playerTurnActive());
    arenaNode.classList.toggle("enemy-slot-active",!!f&&!f.worldRealtime&&!f.defeated&&!over&&enemyTurnActive());
    arenaNode.classList.toggle("post-combat-pending",!f?.worldRealtime&&(resolutionPhase==="hold"||resolutionPhase==="fading"));
    arenaNode.classList.toggle("post-combat-fading",!f?.worldRealtime&&resolutionPhase==="fading");
    arenaNode.classList.toggle("post-combat-mode",!f?.worldRealtime&&resolutionPhase==="revealed");
  }
  if(f?.defeated&&!f.worldRealtime) schedulePostCombatReveal(f); else clearCombatVictoryTimer();
  if(!f && combatHistoryOpen) setCombatHistoryOpen(false);
  const sprite = $("foeSprite");
  if(f&&!f.worldRealtime){
    $("foeName").textContent = f.name;
    $("foeLv").textContent = "Level " + f.lv;
    if(sprite){
      sprite.textContent = "";
      const portrait=portraitForFoe(f);
      sprite.style.backgroundImage = portrait
        ? `linear-gradient(180deg, rgba(0,0,0,.04), rgba(0,0,0,.22)), url(${portrait})`
        : "none";
      sprite.style.backgroundSize = "cover";
      sprite.style.backgroundPosition = "center center";
      sprite.style.backgroundRepeat = "no-repeat";
    }
    const ff = clamp(f.hp/f.hpMax,0,1);
    hpClass($("foeBar"),ff);
    $("foeHp").style.width = ff*100 + "%";
    $("foeHpN").textContent = `${Math.max(0,f.hp)} / ${f.hpMax}`;
    if(f.defeated){
      $("intent").classList.add("unknown");
      $("intent").classList.remove("enemy-turn","player-turn");
      $("intent").innerHTML = `<div class="intent-copy"><em>Result</em><b>Defeated</b><span class="intent-note">The foe is down.</span></div>`;
    }else{
      const enemyNow=combatActor()==="enemy",I=enemyActionDescriptor(f),charge=enemyBackgroundChargeText(f),panel=$("intent");
      panel.classList.remove("unknown");
      panel.classList.toggle("enemy-turn",enemyNow);
      panel.classList.toggle("player-turn",!enemyNow);
      if(enemyNow){
        const tell=(I?.tell||"").trim(),counterActive=S.defencePrepared?.mode==="counter",guardActive=S.defencePrepared?.mode==="guard";
        const hit=I?.kind==="attack"?Math.round(enemyHitChanceForCurrent({extraTargetAc:counterActive?(S.defencePrepared?.acBonus||COUNTER_AC_BONUS):0})*100):null;
        let estimate="";
        if(I?.kind==="attack"){
          const r=incomingEstimateBounds(),reduction=guardActive?clamp(Number(S.defencePrepared?.reduction)||0,0,.90):0;
          const lo=Math.max(0,Math.round(r.lo*(1-reduction))),hi=Math.max(lo,Math.round(r.hi*(1-reduction)));
          estimate=lo===hi?String(lo):`${lo}–${hi}`;
        }
        const stance=counterActive?` · Counter +${S.defencePrepared?.acBonus||COUNTER_AC_BONUS} AC`:guardActive?` · ${S.defencePrepared?.source||defenceName()} ${Math.round((S.defencePrepared?.reduction||0)*100)}%`:"";
        const detail=I?.kind==="attack"
          ? `<div class="intent-detail-row"><span class="intent-tell">${esc((tell||"The foe attacks.")+` · ${hit}% HIT${stance}`)}</span><span class="intent-estimate"><span class="intent-estimate-label">Est. Dmg</span><span class="intent-estimate-value">${esc(estimate)}</span></span></div>`
          : (tell?`<span class="intent-tell">${esc(tell)}</span>`:"");
        panel.innerHTML=`<div class="intent-copy"><em>Enemy action</em><b>${esc(I?.label||"—")}</b>${detail}${charge?`<span class="intent-charge">${esc(charge)}</span>`:""}</div>`;
      }else{
        const reactionNotice=f.reaction==="guard"?" · GUARD READY":f.reaction==="dodge"?` · DODGE +${FOE_DODGE_AC_BONUS} AC`:"";
        const forecastLabel=I?.label||"No forecast",counterActive=S.defencePrepared?.mode==="counter";
        const hit=I?.kind==="attack"?Math.round(enemyHitChanceForCurrent({extraTargetAc:counterActive?(S.defencePrepared?.acBonus||COUNTER_AC_BONUS):0})*100):null;
        const forecast=I?.kind==="attack"?`NEXT ENEMY: ${forecastLabel} · ${hit}% HIT · ${incomingEstimateText()} DMG${reactionNotice}`:`NEXT ENEMY: ${forecastLabel}${reactionNotice}`;
        panel.innerHTML=`<div class="intent-copy"><em>${S.stamina}/${S.staminaMax} Stamina</em><b>Your Turn</b><span class="intent-tell ${reactionNotice?"enemy-reaction-ready":""}">${esc(forecast)}</span></div>`;
      }
    }
    $("tell").hidden = !f.revealed;
    if(f.revealed){
      $("tellTxt").textContent = f.weakness.txt;
      $("knowledgeTxt").innerHTML = knowledgeSummary(f.key);
    }else $("knowledgeTxt").innerHTML = "";
    const statuses = [];
    const baseFoeAc=foeArmorClass(f,{includeDodge:false}),liveFoeAc=foeArmorClass(f);
    statuses.push(`<span class="status">AC ${baseFoeAc}${liveFoeAc!==baseFoeAc?` → ${liveFoeAc}`:""}</span>`);
    if(f.offBalance){
      const suffix = f.offBalanceStruck ? " · must steady" : " · exposed";
      statuses.push(`<span class="status offbalance">Off-Balance${suffix}</span>`);
    }
    if(f.blinded) statuses.push(`<span class="status blinded">Blinded</span>`);
    if(playerTurnActive()&&f.reaction==="dodge") statuses.push(`<span class="status">Dodge Ready · +${FOE_DODGE_AC_BONUS} AC</span>`);
    if(playerTurnActive()&&f.reaction==="guard") statuses.push(`<span class="status">Guard Ready · ${Math.round(FOE_GUARD_REDUCTION*100)}% reduction</span>`);
    if(playerTurnActive()&&f.intent==="heavy"&&Number(f.heavyStage)===2) statuses.push(`<span class="status">Heavy 2/2 Ready</span>`);
    $("foeStatus").hidden = statuses.length===0;
    $("foeStatus").innerHTML = statuses.join("");
  }else{
    $("foeName").textContent = "—";
    $("foeLv").textContent = "";
    if(sprite){ sprite.style.backgroundImage = ""; sprite.textContent = "?"; }
    $("foeHp").style.width = "0%";
    $("foeHpN").textContent = "";
    $("intent").classList.add("unknown");
    $("intent").classList.remove("enemy-turn","player-turn");
    $("intent").innerHTML = `<div class="intent-copy"><em>Enemy action</em><b>Nothing in front of you</b><span class="intent-note">Keep descending or explore this depth.</span></div>`;
    $("tell").hidden = true;
    $("foeStatus").hidden = true;
    $("foeStatus").innerHTML = "";
  }

  renderCombatTimeline();
  renderCombatLootPanel();
  renderAbilitySheet();
  renderRestAbilityPick();
  renderCharacterSheet();
  renderLevelUpNotice();
  renderPad();
  renderHeroEndTurn();
  renderPreview();
  renderCombatLogCollapse();

  $("btnRun").hidden = !f || !!f.worldRealtime || over;
  if(f&&!f.worldRealtime){
    const c = runCost(), fatal = c>=S.hp, btn = $("btnRun"), defeated=!!f.defeated;
    const fullTurnReady=(Number(S.stamina)||0)>=PLAYER_TURN_STAMINA;
    btn.disabled = defeated||!playerTurnActive()||!fullTurnReady;
    btn.classList.toggle("fatal",!defeated&&fatal&&fullTurnReady);
    btn.classList.toggle("armed",!defeated&&armed==="run");
    btn.querySelector("b").textContent = "Run";
    $("runSub").textContent = defeated
      ? "ENEMY DEFEATED\nNO ESCAPE NEEDED"
      : !fullTurnReady ? "NEEDS FULL TURN\n3 STAMINA"
      : armed==="run" ? "TAP AGAIN\nTO BREAK CONTACT"
      : fatal ? `COSTS ${c} HP\nTHAT KILLS YOU`
      : c===0 ? "3 STAMINA\nNO HP COST"
      : `3 STAMINA · ${Math.round(runSuccessChance()*100)}%\n−${c} HP ON SUCCESS`;
  }

  const w = equippedWeaponDef(),defSnap=playerDefenceSnapshot();
  $("heroStats").textContent = `ATK +${playerAttackBonus()} · AC ${defSnap.ac} · DEFLECT ${trimNumber(defSnap.deflection*100,1)}% · ${w.unarmed?"unarmed":`${w.stat} weapon`}`;
  const combatPackBtn=$("btnCombatPack"),combatPackTxt=$("combatPackTxt");
  if(combatPackBtn) combatPackBtn.disabled=!f||!!f.worldRealtime||over||!playerTurnActive();
  if(combatPackTxt){
    const bandages=S.inventory?.bandages||0;
    combatPackTxt.textContent=S.bleeding?`${bandages} bandage${bandages===1?"":"s"} · bleeding`:`${bandages} item${bandages===1?"":"s"}`;
  }

  const aff = $("combatCurse"), affTxt = $("combatCurseTxt");
  if(aff&&affTxt){
    const bits = [];
    if(curseActive()) bits.push(`${S.curse.name} · ${S.curse.remaining} completed encounters`);
    if(S.bleeding) bits.push("Bleeding");
    aff.hidden = bits.length===0;
    affTxt.textContent = bits.join(" · ");
  }
  renderPack();

  if(f?.revealed&&!f.worldRealtime){
    const collapsed = weaknessCollapsed(f), tell = $("tell"), em = tell?.querySelector("em");
    if(tell) tell.classList.toggle("collapsed",collapsed);
    if(em) em.textContent = collapsed ? "Known weakness ▸" : "Known weakness ▾";
    $("tellTxt").hidden = collapsed;
    $("knowledgeTxt").hidden = collapsed;
    tell?.setAttribute("aria-expanded",String(!collapsed));
  }

  if(f&&!f.worldRealtime&&!f.defeated&&!over&&(Number(S.stamina)||0)>=PLAYER_TURN_STAMINA){
    const c = runCost(), chance = Math.round(runSuccessChance()*100), btn = $("btnRun"), fatal = c>=S.hp;
    if(btn&&armed!=="run") $("runSub").textContent = fatal
      ? `${chance}% ESCAPE\n−${c} HP KILLS YOU`
      : `${chance}% ESCAPE\n−${c} HP ON SUCCESS`;
  }

  document.querySelectorAll(".passage-dots").forEach(el=>el.textContent=liveExploreDots());
  const pending = pendingDescentXp(), suffix = pending ? ` · +${pending} descent pending` : "";
  if($("travelXp")) $("travelXp").textContent = `${S.xp} / ${xpToNext(S.level)} XP${suffix}`;
  if($("heroXp")) $("heroXp").textContent = `${S.xp} / ${xpToNext(S.level)} XP${suffix}`;
  const xpPct=clamp(S.xp/Math.max(1,xpToNext(S.level)),0,1)*100;
  if($("travelXpBar")) $("travelXpBar").style.width=`${xpPct}%`;
  if($("heroXpBar")) $("heroXpBar").style.width=`${xpPct}%`;
  if($("townHeroXpBar")) $("townHeroXpBar").style.width=`${xpPct}%`;
  if($("charXpBar")) $("charXpBar").style.width=`${xpPct}%`;

  renderLootHistory();
  renderEncounterWarningLocks();
  if(f&&!f.worldRealtime&&!f.defeated&&!over&&combatActor()==="enemy"&&!S.reactionWindow) scheduleEnemyTurn();
  if($("btnAbilities")) $("btnAbilities").disabled = !f || over || !playerTurnActive();
  if(combatVictoryPending){
    if($("btnRun")) $("btnRun").disabled = true;
  }
  renderSettingsSheet();
  try{window.LowfathomWorldBridge?.sync?.();}catch(err){console.error("World bridge sync failed",err);}
  saveRunNow();
}

const UI_ART_DIR = "./assets/ui";
const CONCEPT_ICON_MAP = Object.freeze({
  strike:"strike", heavy:"heavy", parry:"guard", guard:"guard",
  recover:"recover", sand:"sand", read:"read",
  quick:"intent", dodge:"intent", intent:"intent",
  abilities:"abilities", pack:"pack", run:"run", skull:"skull"
});
const UI_ICON_SVGS = Object.freeze({
  strike:`<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M8 23l1.8-5.1L19.7 8l4.3 4.3-10 9.9L8 23Z"/><path d="M19.7 8 23 4.7l4.3 4.3-3.3 3.3"/></svg>`,
  heavy:`<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6c-5 0-9 4-9 9 0 4 2 7 5 9"/><path d="M23 10c-3-1-6 1-6 4 0 2 1 3 3 4 2 1 3 2 3 4 0 2-1 3-3 4"/><path d="M14 22c1 2 3 4 6 4"/></svg>`,
  parry:`<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M16 4 7 8v7c0 6 4.2 10.4 9 13 4.8-2.6 9-7 9-13V8l-9-4Z"/></svg>`,
  recover:`<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="16" cy="16" r="11"/><path d="M16 10v12"/><path d="M10 16h12"/></svg>`,
  sand:`<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M7 22c4-5 8-8 14-10"/><circle cx="8" cy="23" r="2.1" fill="currentColor" stroke="none"/><circle cx="17" cy="10" r="1.2" fill="currentColor" stroke="none"/><circle cx="20.5" cy="12.5" r="1.1" fill="currentColor" stroke="none"/><circle cx="24" cy="16" r="1" fill="currentColor" stroke="none"/><circle cx="26" cy="19.5" r=".9" fill="currentColor" stroke="none"/></svg>`,
  read:`<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M7 8.5h8a4 4 0 0 1 4 4V26a4 4 0 0 0-4-4H7Z"/><path d="M25 8.5h-8a4 4 0 0 0-4 4V26a4 4 0 0 1 4-4h8Z"/></svg>`,
  quick:`<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M8 22c4-7 9-11 16-13"/><path d="M16 8h8v8"/></svg>`,
  dodge:`<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M23 7c-6 2-11 8-12 14"/><path d="M9 19v6h6"/></svg>`,
  guard:`<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M16 4 7 8v7c0 6 4.2 10.4 9 13 4.8-2.6 9-7 9-13V8l-9-4Z"/></svg>`
});
function uiIcon(name, variant="icon"){
  const key=CONCEPT_ICON_MAP[name];
  const svg=UI_ICON_SVGS[name]||"";
  if(!key) return `<span class="ui-icon ${name}" aria-hidden="true">${svg}</span>`;
  const img=`<img src="${UI_ART_DIR}/${variant}-${key}.png" alt="" decoding="async" `
    + `onerror="this.closest('.ui-icon').classList.add('art-missing');this.remove();">`;
  return `<span class="ui-icon ${name}" aria-hidden="true">${img}<span class="ui-fallback">${svg}</span></span>`;
}
function applyConceptChrome(){
  const seat={iconAbilities:"abilities",iconPack:"pack",iconRun:"run"};
  for(const id in seat){ const el=$(id); if(el && !el.innerHTML) el.innerHTML=uiIcon(seat[id],"glyph"); }
}
function actionIconName(key){ if(key==="heavy") return "heavy"; if(key==="guard"||key==="defend") return "parry"; if(key==="sand") return "sand"; if(key==="read") return "read"; if(key==="counter")return "strike"; if(key==="endturn")return "intent"; return "strike"; }
function intentIconName(key){ return "intent"; }
function portraitForFoe(f){ return ""; }
function actionBadgeText(key,counters){
  if(key==="guard"&&S.defencePrepared)return "Defence already prepared";
  if(key==="counter"&&S.defencePrepared)return "Defence already prepared";
  if(key==="heavy")return "Whole turn";
  if(key==="counter")return `Whole turn · +${COUNTER_AC_BONUS} AC`;
  if(counters)return foeDodgeActive()?`Dodge Ready · +${FOE_DODGE_AC_BONUS} AC`:"Guard Ready · reduced damage";
  if(key==="read"&&S.foe&&!S.foe.readUsed){
    const reads=knowledgeReads(S.foe.key);
    if(reads<6)return `${reads+1}/${reads<3?3:6} knowledge`;
  }
  return "";
}
function actionSummaryText(key){return actionSub(key).replace(/\s+·\s+/g,' • ').replace(/\s+—\s+/g,' • ');}

function renderPad(){
  const root=$("pad");
  if(!root)return;
  if(S?.foe?.worldRealtime){root.hidden=true;root.innerHTML="";return;}
  if(!S.foe||over||S.foe.defeated){root.hidden=false;root.innerHTML="";return;}
  if(enemyTurnActive()){
    // v0.113.1: enemy-resolution status is already shown in the Awaiting choice
    // preview panel. Hide the action pad instead of duplicating that information
    // in a disabled Enemy Turn card.
    root.hidden=true;
    root.innerHTML="";
    return;
  }
  root.hidden=false;
  const order=["strike","guard","heavy","counter","sand","read"];
  root.innerHTML=order.map((k,i)=>{
    const reason=combatActionUnavailableReason(k),off=!!reason,isArmed=armed===k,counters=S.foe&&actionCounters(k);
    let sub=isArmed?"Tap again to commit":off?reason:actionSummaryText(k);
    const badge=actionBadgeText(k,counters);
    return `<button class="act ${k} ${isArmed?"armed":""}" data-k="${k}" ${off?"disabled":""}><span class="act-icon">${uiIcon(actionIconName(k))}</span><span class="act-copy"><b>${esc(actionLabel(k))}</b><span class="sub">${esc(sub)}</span>${badge?`<span class="act-badge">${esc(badge)}</span>`:""}</span></button>`;
  }).join("");
}
function renderHeroEndTurn(){
  const btn=$("heroEndTurn");
  if(!btn)return;
  const f=S?.foe,show=!!f&&!over&&!f.defeated;
  btn.hidden=!show;
  if(!show){btn.classList.remove("armed");return;}
  const active=playerTurnActive(),isArmed=armed==="endturn";
  btn.disabled=!active||combatDiceBusy;
  btn.classList.toggle("armed",isArmed);
  btn.textContent=isArmed?"Confirm":"End Turn";
  btn.setAttribute("aria-label",isArmed?"Confirm end turn":"End turn");
}

function combatPreviewMetrics(key){
  if(!S.foe)return [];
  const metric=(label,value,tone="")=>({label,value,tone});
  try{
    if(["strike","heavy","smite","feint","dirtytrick","arcbolt"].includes(key)){
      const hit=Math.round(playerHitChanceForAction(key)*100);
      const rows=[metric("Hit chance",`${hit}%`,hit<50?"warn":"good"),metric("Target AC",`${foeArmorClass()}`,"teal")];
      if(key==="strike"){const st=strikeStage();rows.push(metric("Est. damage",`~${dmgStrike(st,st===0?2:st===1?2.5:3)}`,"gold"));}
      if(key==="heavy"){const base=dmgHeavy(1,3);rows.push(metric("Est. damage",`~${base}`,"gold"));}
      return rows;
    }
    if(key==="guard")return enemyAttackIncoming()
      ? [metric("Reduction",`${Math.round(defenceDamageReduction()*100)}%`,"good"),metric("Next enemy hit",`${Math.round(enemyHitChanceForCurrent()*100)}%`,"warn")]
      : [metric("Reduction",`${Math.round(defenceDamageReduction()*100)}%`,"good"),metric("Persists","Until attack","teal")];
    if(key==="counter")return enemyAttackIncoming()
      ? [metric("AC",`${playerArmorClass()} → ${playerArmorClass()+COUNTER_AC_BONUS}`,"good"),metric("Enemy hit",`${Math.round(enemyHitChanceForCurrent()*100)}% → ${Math.round(enemyHitChanceForCurrent({extraTargetAc:COUNTER_AC_BONUS})*100)}%`,"gold")]
      : [metric("AC",`${playerArmorClass()} → ${playerArmorClass()+COUNTER_AC_BONUS}`,"good"),metric("Trigger","Next attack","teal")];
    if(key==="sand")return [metric("Blind chance","60%","gold")];
  }catch(_e){}
  return [];
}
function renderPreview(){
  const p=$("preview");
  if(!p)return;
  if(!S.foe||over||!armed||armed==="run"){
    p.classList.add("idle");p.classList.remove("has-metrics");
    const idleLine=!S.foe?"Nothing in front of you."
      :combatVictoryPending?"The final blow lands. The foe is down."
      :enemyTurnActive()?`Enemy turn • ${enemyActionDescriptor()?.label||"action"} is resolving.`
      :`Your Turn · ${S.stamina}/${S.staminaMax} Stamina. Choose an action; tap once to preview, then tap again to commit.`;
    p.innerHTML=`<div class="ttl">Selected action</div><div class="preview-body"><span class="preview-icon">${uiIcon("strike")}</span><div class="preview-copy"><div class="pick"><span class="name">Awaiting choice</span></div><div class="line">${esc(idleLine)}</div></div></div>`;
    return;
  }
  p.classList.remove("idle");
  const badge=actionBadgeText(armed,actionCounters(armed));
  let detail="";try{detail=(ACTIONS[armed]&&typeof ACTIONS[armed].preview==="function")?ACTIONS[armed].preview():"";}catch(_e){}
  const metrics=combatPreviewMetrics(armed),metricHtml=metrics.length?`<div class="preview-metrics">${metrics.map(m=>`<div class="preview-metric ${m.tone||""}"><span>${esc(m.label)}</span><b>${esc(m.value)}</b></div>`).join("")}</div>`:"";
  p.classList.toggle("has-metrics",metrics.length>0);
  p.innerHTML=`<div class="ttl">Selected action</div><div class="preview-body"><span class="preview-icon">${uiIcon(actionIconName(armed))}</span><div class="preview-copy"><div class="pick"><span class="name">${esc(actionLabel(armed))}</span><span class="cost">${esc(actionSummaryText(armed))}</span></div>${detail?`<div class="line">${detail}</div>`:""}${badge?`<div class="counters">${esc(badge)}</div>`:""}</div>${metricHtml}</div>`;
}

/* ============================================================
   SESSION 7.5 — vertical slice extension (v0.080)

   This layer deliberately sits on top of the proven v0.078 systems. It adds
   class-defined abilities, two dungeon Skills, a small inventory/loot model,
   one cursed side passage, one curse, and the first stratum boss without
   replacing the existing Votary combat rules or protected Smite FX.
   ============================================================ */

// Two new practiced competencies. The existing array is mutable even though the
// binding is const, so the original character-sheet and new-delver code can see them.
Object.assign(SKILL_DEFS, {
  sleight:{name:"Sleight of Hand", stat:"DEX", desc:"Manipulate locks, traps and delicate mechanisms without setting them off."},
  translation:{name:"Translation", stat:"INT", desc:"Decipher unfamiliar words, inscriptions and ritual language from context."}
});
for(const id of ["sleight","translation"]) if(!SKILL_ORDER.includes(id)) SKILL_ORDER.push(id);

Object.assign(ABILITY_DEFS, {
  feint:{
    id:"feint", name:"Feint", degree:"I", max:2,
    desc:"A deceptive DEX-damage attack that is especially effective into Guard.",
    mechanics:"Costs the full 3-Stamina Player Turn. Rolls your current Attack Bonus against AC. Guard does not reduce it; a guarding foe takes 50% extra damage. Damage scales with DEX.",
    scaling:"Damage scales with DEX."
  },
  slip:{
    id:"slip", name:"Slip Away", degree:"I", max:2,
    desc:"Spend the full Player Turn to slip clear of the forecast attack.",
    mechanics:"Only usable when NEXT ENEMY is an attack. Costs the full 3-Stamina Player Turn and completely negates that next attack attempt.",
    scaling:"No direct damage scaling at Degree I."
  },
  dirtytrick:{
    id:"dirtytrick", name:"Dirty Trick", degree:"I", max:2,
    desc:"A light DEX strike that leaves the foe Blinded until its next attack attempt.",
    mechanics:"Costs the full 3-Stamina Player Turn. Rolls your current Attack Bonus against AC; on hit, deals light DEX damage and applies Blinded. Guard still reduces the damage, but not the Blind.",
    scaling:"Damage scales with DEX."
  },
  arcbolt:{
    id:"arcbolt", name:"Arc Bolt", degree:"I", max:3,
    desc:"Hurl INT-scaled Arcane damage. Ordinary Guard does not reduce it.",
    mechanics:"Costs the full 3-Stamina Player Turn. Rolls your current Attack Bonus against AC. Arcane damage scales with INT and ignores ordinary Guard; Dodge raises the target AC.",
    scaling:"Damage scales with INT."
  },
  ward:{
    id:"ward", name:"Ward", degree:"I", max:2,
    desc:"Spend the full Player Turn to ward off the forecast enemy attack.",
    mechanics:"Only usable when NEXT ENEMY is an attack. Costs the full 3-Stamina Player Turn and completely negates that next attack attempt; no counterattack is made.",
    scaling:"No direct scaling at Degree I."
  },
  mend:{
    id:"mend", name:"Mending Spark", degree:"I", max:2,
    desc:"Heal 12 HP. Quick-use: once per turn, and it does not end your turn.",
    mechanics:"Restore up to 12 HP. Cannot be used at full HP. Quick-use means it costs 0 Stamina and may be used once during each Player Turn.",
    scaling:"The heal is flat at Degree I."
  }
});

const CLASS_DEFS = {
  Votary:{
    name:"Votary", short:"Martial faith", flavor:"A defensive martial calling built around commitment, recovery and Radiant force.",
    abilities:["layonhands","holdfast","smite","withdraw"], proficiencies:{},
    specialization:"Votive Reliquary", startingWeapon:"salvage_longsword"
  },
  Rogue:{
    name:"Rogue", short:"DEX · traps · locks", flavor:"A finesse delver trained to manipulate mechanisms and survive bad positions.",
    abilities:["feint","slip","dirtytrick","withdraw"], proficiencies:{sleight:5},
    specialization:"Rogue Tools", startingWeapon:"salvage_dagger"
  },
  Wizard:{
    name:"Wizard", short:"INT · arcane · language", flavor:"A scholar of hostile places, using Arcane force and practiced translation.",
    abilities:["arcbolt","ward","mend","withdraw"], proficiencies:{translation:5},
    specialization:"Scholar's Lexicon", startingWeapon:"salvage_wand"
  }
};
const CLASS_ORDER = ["Votary","Rogue","Wizard"];

const GEAR_ITEMS = {

  salvage_longsword:{name:"Salvage Longsword",slot:"rightHand",slots:["rightHand"],stat:"STR",itemLevel:75,rarity:"Salvage",family:"sword",hands:1,desc:"A nicked starter blade worth exactly what the Guild paid for it."},
  salvage_dagger:{name:"Salvage Dagger",slot:"rightHand",slots:["rightHand"],stat:"DEX",itemLevel:75,rarity:"Salvage",family:"dagger",hands:1,desc:"A battered finesse blade with just enough edge left to descend."},
  salvage_wand:{name:"Salvage Wand",slot:"rightHand",slots:["rightHand"],stat:"INT",itemLevel:75,rarity:"Salvage",family:"wand",hands:1,desc:"A cracked focus that still answers a practiced hand."},
  salvage_greatsword:{name:"Salvage Greatsword",slot:"rightHand",slots:["rightHand"],stat:"STR",itemLevel:75,rarity:"Salvage",family:"greatsword",hands:2,greatWeapon:true,desc:"A two-handed starter blade, heavy and badly kept."},
  salvage_shortbow:{name:"Salvage Shortbow",slot:"rightHand",slots:["rightHand"],stat:"DEX",itemLevel:75,rarity:"Salvage",family:"bow",hands:2,desc:"A shortbow with a patched grip and serviceable string."},
  salvage_staff:{name:"Salvage Wooden Staff",slot:"rightHand",slots:["rightHand"],stat:"INT",itemLevel:75,rarity:"Salvage",family:"staff",hands:2,desc:"A scarred two-handed staff used as both focus and weapon."},
  worn_longsword:{name:"Worn Longsword",slot:"rightHand",slots:["rightHand"],stat:"STR",itemLevel:100,rarity:"Common",family:"sword",hands:1,desc:"Reliable Guild-issue steel."},
  tempered_longsword:{name:"Tempered Longsword",slot:"rightHand",slots:["rightHand"],stat:"STR",itemLevel:205,rarity:"Uncommon",family:"sword",hands:1,desc:"A mid-depth STR weapon balanced for the Warren."},
  worn_shortsword:{name:"Worn Shortsword",slot:"rightHand",slots:["rightHand"],stat:"DEX",itemLevel:100,rarity:"Common",family:"shortsword",hands:1,desc:"A light finesse weapon using DEX."},
  balanced_dagger:{name:"Balanced Dagger",slot:"rightHand",slots:["rightHand"],stat:"DEX",itemLevel:205,rarity:"Uncommon",family:"dagger",hands:1,desc:"A mid-depth finesse weapon using DEX."},
  worn_wand:{name:"Worn Wand",slot:"rightHand",slots:["rightHand"],stat:"INT",itemLevel:100,rarity:"Common",family:"wand",hands:1,desc:"An arcane focus; basic attacks use INT."},
  etched_wand:{name:"Etched Wand",slot:"rightHand",slots:["rightHand"],stat:"INT",itemLevel:205,rarity:"Uncommon",family:"wand",hands:1,desc:"A mid-depth arcane focus using INT."},
  handaxe:{name:"Salvaged Hand-axe",slot:"rightHand",slots:["rightHand"],stat:"STR",itemLevel:102,rarity:"Common",family:"axe",hands:1,desc:"An off-class STR weapon."},
  hunting_bow:{name:"Hunting Bow",slot:"rightHand",slots:["rightHand"],stat:"DEX",itemLevel:100,rarity:"Common",family:"bow",hands:2,desc:"A two-handed ranged DEX weapon."},
  worn_greatsword:{name:"Worn Greatsword",slot:"rightHand",slots:["rightHand"],stat:"STR",itemLevel:100,rarity:"Common",family:"greatsword",hands:2,greatWeapon:true,desc:"A Great Weapon. It occupies both hands while equipped."},
  worn_staff:{name:"Worn Wooden Staff",slot:"rightHand",slots:["rightHand"],stat:"INT",itemLevel:100,rarity:"Common",family:"staff",hands:2,desc:"A two-handed arcane staff using INT."},
  recurved_bow:{name:"Recurved Bow",slot:"rightHand",slots:["rightHand"],stat:"DEX",itemLevel:205,rarity:"Uncommon",family:"bow",hands:2,desc:"A mid-depth two-handed DEX weapon."},
  ash_staff:{name:"Ash Staff",slot:"rightHand",slots:["rightHand"],stat:"INT",itemLevel:205,rarity:"Uncommon",family:"staff",hands:2,desc:"A mid-depth two-handed INT focus."},
  iron_greatsword:{name:"Iron Greatsword",slot:"rightHand",slots:["rightHand"],stat:"STR",itemLevel:205,rarity:"Uncommon",family:"greatsword",hands:2,greatWeapon:true,desc:"A mid-depth Great Weapon that occupies both hands."},
  guildsteel_longsword:{name:"Guildsteel Longsword",slot:"rightHand",slots:["rightHand"],stat:"STR",itemLevel:295,rarity:"Rare",family:"sword",hands:1,desc:"A rare deep-Warren STR weapon."},
  needle_dagger:{name:"Needle Dagger",slot:"rightHand",slots:["rightHand"],stat:"DEX",itemLevel:295,rarity:"Rare",family:"dagger",hands:1,desc:"A rare deep-Warren DEX weapon."},
  runed_wand:{name:"Runed Wand",slot:"rightHand",slots:["rightHand"],stat:"INT",itemLevel:295,rarity:"Rare",family:"wand",hands:1,desc:"A rare deep-Warren INT focus."},
  war_bow:{name:"Warren War Bow",slot:"rightHand",slots:["rightHand"],stat:"DEX",itemLevel:295,rarity:"Rare",family:"bow",hands:2,desc:"A rare two-handed DEX weapon from the deepest Warren galleries."},
  ironwood_staff:{name:"Ironwood Staff",slot:"rightHand",slots:["rightHand"],stat:"INT",itemLevel:295,rarity:"Rare",family:"staff",hands:2,desc:"A rare two-handed INT focus hardened by the deep."},
  deep_greatsword:{name:"Deep-forged Greatsword",slot:"rightHand",slots:["rightHand"],stat:"STR",itemLevel:295,rarity:"Rare",family:"greatsword",hands:2,greatWeapon:true,desc:"A rare Great Weapon from the deep Warren."},
  warren_epic_longsword:{name:"Warren-Bane Longsword",slot:"rightHand",slots:["rightHand"],stat:"STR",itemLevel:385,rarity:"Epic",family:"sword",hands:1,desc:"A stratum-boss reward stamped at the 500-fathom boundary."},
  warren_epic_greatsword:{name:"Warren-Bane Greatsword",slot:"rightHand",slots:["rightHand"],stat:"STR",itemLevel:385,rarity:"Epic",family:"greatsword",hands:2,greatWeapon:true,desc:"A stratum-boss reward stamped at the 500-fathom boundary."},
  warren_epic_dagger:{name:"Warren-Bane Dagger",slot:"rightHand",slots:["rightHand"],stat:"DEX",itemLevel:385,rarity:"Epic",family:"dagger",hands:1,desc:"A stratum-boss reward stamped at the 500-fathom boundary."},
  warren_epic_bow:{name:"Warren-Bane Bow",slot:"rightHand",slots:["rightHand"],stat:"DEX",itemLevel:385,rarity:"Epic",family:"bow",hands:2,desc:"A stratum-boss reward stamped at the 500-fathom boundary."},
  warren_epic_wand:{name:"Warren-Bane Wand",slot:"rightHand",slots:["rightHand"],stat:"INT",itemLevel:385,rarity:"Epic",family:"wand",hands:1,desc:"A stratum-boss reward stamped at the 500-fathom boundary."},
  warren_epic_staff:{name:"Warren-Bane Staff",slot:"rightHand",slots:["rightHand"],stat:"INT",itemLevel:385,rarity:"Epic",family:"staff",hands:2,desc:"A stratum-boss reward stamped at the 500-fathom boundary."},
  rarity_test_salvage:{name:"Salvage Test Greatsword",slot:"rightHand",slots:["rightHand"],stat:"STR",itemLevel:100,rarity:"Salvage",family:"greatsword",hands:2,greatWeapon:true,desc:"Palette test item · equal iLv with every rarity test greatsword."},
  rarity_test_poor:{name:"Poor Test Greatsword",slot:"rightHand",slots:["rightHand"],stat:"STR",itemLevel:100,rarity:"Poor",family:"greatsword",hands:2,greatWeapon:true,desc:"Palette test item · equal iLv with every rarity test greatsword."},
  rarity_test_common:{name:"Common Test Greatsword",slot:"rightHand",slots:["rightHand"],stat:"STR",itemLevel:100,rarity:"Common",family:"greatsword",hands:2,greatWeapon:true,desc:"Palette test item · equal iLv with every rarity test greatsword."},
  rarity_test_uncommon:{name:"Uncommon Test Greatsword",slot:"rightHand",slots:["rightHand"],stat:"STR",itemLevel:100,rarity:"Uncommon",family:"greatsword",hands:2,greatWeapon:true,desc:"Palette test item · equal iLv with every rarity test greatsword."},
  rarity_test_rare:{name:"Rare Test Greatsword",slot:"rightHand",slots:["rightHand"],stat:"STR",itemLevel:100,rarity:"Rare",family:"greatsword",hands:2,greatWeapon:true,desc:"Palette test item · equal iLv with every rarity test greatsword."},
  rarity_test_epic:{name:"Epic Test Greatsword",slot:"rightHand",slots:["rightHand"],stat:"STR",itemLevel:100,rarity:"Epic",family:"greatsword",hands:2,greatWeapon:true,desc:"Palette test item · equal iLv with every rarity test greatsword."},
  rarity_test_wondrous:{name:"Wondrous Test Greatsword",slot:"rightHand",slots:["rightHand"],stat:"STR",itemLevel:100,rarity:"Wondrous",family:"greatsword",hands:2,greatWeapon:true,desc:"Palette test item · reserved rarity palette preview only."},
  rarity_test_legendary:{name:"Legendary Test Greatsword",slot:"rightHand",slots:["rightHand"],stat:"STR",itemLevel:100,rarity:"Legendary",family:"greatsword",hands:2,greatWeapon:true,desc:"Palette test item · reserved rarity palette preview only."},
  rarity_test_mythical:{name:"Mythical Test Greatsword",slot:"rightHand",slots:["rightHand"],stat:"STR",itemLevel:100,rarity:"Mythical",family:"greatsword",hands:2,greatWeapon:true,desc:"Palette test item · reserved rarity palette preview only."},
  rarity_test_ancient:{name:"Ancient Test Greatsword",slot:"rightHand",slots:["rightHand"],stat:"STR",itemLevel:100,rarity:"Ancient",family:"greatsword",hands:2,greatWeapon:true,desc:"Palette test item · reserved rarity palette preview only."},
  rarity_test_sunless:{name:"Sunless Test Greatsword",slot:"rightHand",slots:["rightHand"],stat:"STR",itemLevel:100,rarity:"Sunless",family:"greatsword",hands:2,greatWeapon:true,desc:"Palette test item · reserved rarity palette preview only."},
  rarity_test_unfathomable:{name:"Unfathomable Test Greatsword",slot:"rightHand",slots:["rightHand"],stat:"STR",itemLevel:100,rarity:"Unfathomable",family:"greatsword",hands:2,greatWeapon:true,desc:"Palette test item · reserved rarity palette preview only."}
};

const RARITY_TEST_WEAPONS = Object.freeze([
  "rarity_test_salvage","rarity_test_poor","rarity_test_common","rarity_test_uncommon","rarity_test_rare","rarity_test_epic",
  "rarity_test_wondrous","rarity_test_legendary","rarity_test_mythical","rarity_test_ancient","rarity_test_sunless","rarity_test_unfathomable"
]);

const EQUIPMENT_ITEMS = {
  ...GEAR_ITEMS,
  salvage_buckler:{name:"Salvage Buckler",slot:"leftHand",slots:["leftHand"],itemLevel:75,rarity:"Salvage",family:"shield",armor:10,stats:["Armor +10","Guard support"],desc:"A dented starter shield with a sound strap."},
  salvage_top:{name:"Salvage Top",slot:"top",slots:["top"],itemLevel:75,rarity:"Salvage",armor:10,stats:["Armor +10"],desc:"Patched layers and scavenged plates. Barely enough protection to sign the register."},
  salvage_bottoms:{name:"Salvage Bottoms",slot:"bottoms",slots:["bottoms"],itemLevel:75,rarity:"Salvage",armor:8,stats:["Armor +8"],desc:"Repaired trousers reinforced at the knees and thighs."},
  salvage_boots:{name:"Salvage Boots",slot:"boots",slots:["boots"],itemLevel:75,rarity:"Salvage",armor:6,stats:["Armor +6"],desc:"Mismatched boots with enough sole left for the first descent."},
  reinforced_buckler:{name:"Reinforced Buckler",slot:"leftHand",slots:["leftHand"],itemLevel:205,rarity:"Uncommon",family:"shield",armor:27,stats:["Armor +27","Guard support"],desc:"A mid-depth shield reinforced with Warren iron."},
  ringmail_jack:{name:"Ringmail Jack",slot:"top",slots:["top"],itemLevel:205,rarity:"Uncommon",armor:27,stats:["Armor +27"],desc:"A mid-depth defensive top of patched ringmail."},
  scaled_trousers:{name:"Scaled Trousers",slot:"bottoms",slots:["bottoms"],itemLevel:205,rarity:"Uncommon",armor:21,stats:["Armor +21"],desc:"Layered scales sewn over the legs for deeper work."},
  mail_coif:{name:"Mail Coif",slot:"hat",slots:["hat"],itemLevel:205,rarity:"Uncommon",armor:16,stats:["Armor +16"],desc:"A practical mid-depth coif."},
  riveted_gloves:{name:"Riveted Gloves",slot:"gloves",slots:["gloves"],itemLevel:205,rarity:"Uncommon",armor:16,stats:["Armor +16"],desc:"Riveted protection without the weight of full plate."},
  ironshod_boots:{name:"Ironshod Boots",slot:"boots",slots:["boots"],itemLevel:205,rarity:"Uncommon",armor:16,stats:["Armor +16"],desc:"Mid-depth boots plated where the stone bites hardest."},
  tower_buckler:{name:"Deep Tower Buckler",slot:"leftHand",slots:["leftHand"],itemLevel:295,rarity:"Rare",family:"shield",armor:38,stats:["Armor +38","Guard support"],desc:"A rare deep-Warren shield that carries nearly a full hand-slot of protection."},
  brigandine_jack:{name:"Deep Brigandine",slot:"top",slots:["top"],itemLevel:295,rarity:"Rare",armor:38,stats:["Armor +38"],desc:"Rare deep-Warren body protection."},
  plated_bottoms:{name:"Plated Bottoms",slot:"bottoms",slots:["bottoms"],itemLevel:295,rarity:"Rare",armor:31,stats:["Armor +31"],desc:"Rare leg protection built for the last Warren galleries."},
  deep_sallet:{name:"Deep Sallet",slot:"hat",slots:["hat"],itemLevel:295,rarity:"Rare",armor:23,stats:["Armor +23"],desc:"A rare helmet from the deep Warren."},
  plated_gloves:{name:"Plated Gloves",slot:"gloves",slots:["gloves"],itemLevel:295,rarity:"Rare",armor:23,stats:["Armor +23"],desc:"Rare articulated hand protection."},
  deep_boots:{name:"Deep-forged Boots",slot:"boots",slots:["boots"],itemLevel:295,rarity:"Rare",armor:23,stats:["Armor +23"],desc:"Rare boots made to survive the lower Warren."},
  worn_buckler:{name:"Worn Buckler",slot:"leftHand",slots:["leftHand"],itemLevel:100,rarity:"Common",family:"shield",armor:13,stats:["Armor +13","Guard support"],desc:"A compact shield kept close to the body."},
  parrying_knife:{name:"Parrying Knife",slot:"leftHand",slots:["leftHand"],itemLevel:100,rarity:"Common",stats:["Finesse offhand","Parry support"],desc:"A narrow offhand blade built to catch and redirect steel."},
  chalkbound_grimoire:{name:"Chalkbound Grimoire",slot:"leftHand",slots:["leftHand"],itemLevel:100,rarity:"Common",stats:["Arcane focus","Translation aid"],desc:"A compact field grimoire bound for hostile conditions."},
  hooded_lantern:{name:"Hooded Lantern",slot:"light",slots:["light"],itemLevel:100,rarity:"Common",stats:["Steady light","Hands remain free"],desc:"A shuttered lantern suited to long descents and controlled illumination."},
  leather_coif:{name:"Leather Coif",slot:"hat",slots:["hat"],itemLevel:100,rarity:"Common",armor:8,stats:["Armor +8","Perception +1"],desc:"Simple head protection that leaves hearing mostly unobstructed."},
  grey_delvers_cape:{name:"Grey Delver's Cape",slot:"cape",slots:["cape"],itemLevel:100,rarity:"Common",stats:["Stealth +1","Cold ward +1"],desc:"A short cape cut not to snag easily on ladders or rough tunnels."},
  saints_pendant:{name:"Saint's Pendant",slot:"necklace",slots:["necklace"],itemLevel:118,rarity:"Rare",stats:["WIS +1","Resolve +2"],desc:"A small devotional token worn close enough to grip in the dark."},
  padded_delvers_jack:{name:"Padded Delver's Jack",slot:"top",slots:["top"],itemLevel:108,rarity:"Uncommon",armor:14,stats:["Armor +14","CON +1"],desc:"Layered cloth reinforced for scraping stone, claws and hurried retreats."},
  locksmith_gloves:{name:"Locksmith's Gloves",slot:"gloves",slots:["gloves"],itemLevel:118,rarity:"Rare",armor:9,stats:["Armor +9","DEX +1","Rogue Tools +2"],desc:"Thin protected fingertips preserve touch while giving the palm and knuckles some protection."},
  reinforced_trousers:{name:"Reinforced Trousers",slot:"bottoms",slots:["bottoms"],itemLevel:100,rarity:"Common",armor:10,stats:["Armor +10","Athletics +1"],desc:"Heavy cloth with reinforced knees and seat for crawling through bad stone."},
  tool_belt:{name:"Tool Belt",slot:"belt",slots:["belt"],itemLevel:100,rarity:"Common",stats:["Utility +1","Quick access"],desc:"Loops, ties and little pockets for the practical objects a descent keeps demanding."},
  hobnailed_boots:{name:"Hobnailed Boots",slot:"boots",slots:["boots"],itemLevel:108,rarity:"Uncommon",armor:8,stats:["Armor +8","Sure footing +2"],desc:"Hard soles and iron nails bite into timber, packed earth and old stairways."},
  iron_signet:{name:"Iron Signet",slot:"ring",slots:["ring1","ring2","ring3","ring4"],itemLevel:108,rarity:"Uncommon",stats:["CON +1","Guard +1"],desc:"A heavy stamped ring whose original mark has been filed away."},
  bone_ring:{name:"Bone Ring",slot:"ring",slots:["ring1","ring2","ring3","ring4"],itemLevel:108,rarity:"Uncommon",stats:["WIS +1","Read +1"],desc:"Polished pale bone, warm even when the surrounding stone is cold."},
  copper_stud:{name:"Copper Stud",slot:"earring",slots:["earLeft","earRight"],itemLevel:100,rarity:"Common",stats:["Utility +1"],desc:"A plain copper stud made to survive rough travel."},
  plate_gauntlets:{name:"Plate Gauntlets",slot:"gloves",slots:["gloves"],itemLevel:108,rarity:"Uncommon",armor:8,stats:["Armor +8","Delicate work -2"],desc:"Heavy articulated plates prioritize protection over fine manipulation."}
};

/* ============================================================
   v0.090.0 — SESSION 9F INTRINSIC VALUE + AFFIX REGISTRY
   Toggle an affix here to add/remove it from ordinary procedural generation.
   Disabled affixes keep their valuation/mechanics so later tests need no rewrite.
   ============================================================ */
const GENERATED_AFFIX_ENABLED = {
  crit:true, // v0.204.0: build-driven Critical Chance is live again for overworld auto-attacks
  bossDamage:true,
  reflect:true,
  lifesteal:false,
  skillRating:false,
  armorPen:false,
  magicPen:false,
  ccReduction:false,
  lootFind:false
};
const EQUIPMENT_AFFIXES = Object.freeze({
  crit:Object.freeze({id:"crit",name:"Critical Chance",unitCost:2.5,maxUnits:60,slots:["weapon","gloves","ring"],enabledKey:"crit"}),
  bossDamage:Object.freeze({id:"bossDamage",name:"Boss Damage",unitCost:8,maxUnits:15,slots:["weapon","focus","cape","light","necklace","earring","ring"],enabledKey:"bossDamage"}),
  reflect:Object.freeze({id:"reflect",name:"Damage Reflect",unitCost:6,maxUnits:15,slots:["shield","top","bottoms","hat","gloves","boots","cape","belt","necklace"],enabledKey:"reflect"}),
  lifesteal:Object.freeze({id:"lifesteal",name:"Lifesteal",unitCost:25,maxUnits:8,slots:["weapon","focus","necklace","ring"],enabledKey:"lifesteal"}),
  skillRating:Object.freeze({id:"skillRating",name:"Skill Rating",unitCost:12,maxUnits:12,slots:["focus","cape","belt","light","necklace","earring","ring"],enabledKey:"skillRating"}),
  armorPen:Object.freeze({id:"armorPen",name:"Armor Penetration",unitCost:10,maxUnits:15,slots:["weapon","gloves","ring"],enabledKey:"armorPen"}),
  magicPen:Object.freeze({id:"magicPen",name:"Magic Penetration",unitCost:10,maxUnits:15,slots:["weapon","focus","necklace","ring"],enabledKey:"magicPen"}),
  ccReduction:Object.freeze({id:"ccReduction",name:"Crowd-Control Reduction",unitCost:10,maxUnits:15,slots:["top","hat","cape","necklace","ring"],enabledKey:"ccReduction"}),
  lootFind:Object.freeze({id:"lootFind",name:"Loot Find",unitCost:15,maxUnits:10,slots:["cape","belt","light","necklace","earring","ring"],enabledKey:"lootFind"})
});
function affixEnabled(def){ return !!GENERATED_AFFIX_ENABLED[def?.enabledKey||def?.id]; }
function generatedAffixSlotKey(entry){ return entry.kind==="weapon"?"weapon":entry.id; }
function allowedGeneratedAffixes(entry){
  const key=generatedAffixSlotKey(entry);
  return Object.values(EQUIPMENT_AFFIXES).filter(def=>affixEnabled(def)&&def.slots.includes(key));
}
function emptyAffixRecord(){ return {}; }
const CRIT_AFFIX_STEP_PCT = 0.25;
const CRIT_AFFIX_CONTINUE_CHANCE = Object.freeze({
  Salvage:0.30,Poor:0.36,Common:0.45,Uncommon:0.52,Rare:0.60,Epic:0.68,
  Wondrous:0.73,Legendary:0.78,Mythical:0.82,Ancient:0.85,Sunless:0.88,Unfathomable:0.90
});
const CRIT_AFFIX_RARITY_CAP_PCT = Object.freeze({
  Salvage:Object.freeze({ring:0.25,standard:0.75}),
  Poor:Object.freeze({ring:0.50,standard:1.50}),
  Common:Object.freeze({ring:1.00,standard:3.00}),
  Uncommon:Object.freeze({ring:1.50,standard:4.50}),
  Rare:Object.freeze({ring:2.50,standard:7.50}),
  Epic:Object.freeze({ring:3.00,standard:9.00}),
  Wondrous:Object.freeze({ring:3.50,standard:10.50}),
  Legendary:Object.freeze({ring:4.00,standard:12.00}),
  Mythical:Object.freeze({ring:4.50,standard:13.50}),
  Ancient:Object.freeze({ring:5.00,standard:15.00}),
  Sunless:Object.freeze({ring:5.00,standard:15.00}),
  Unfathomable:Object.freeze({ring:5.00,standard:15.00})
});
function critRarityCapRow(rarity){return CRIT_AFFIX_RARITY_CAP_PCT[rarity]||CRIT_AFFIX_RARITY_CAP_PCT.Common;}
function critQuarter(value){return Math.round((Number(value)||0)/CRIT_AFFIX_STEP_PCT)*CRIT_AFFIX_STEP_PCT;}
function normalWeaponCritCapPct(rarity){return critRarityCapRow(rarity).standard;}
function daggerCritCapPct(rarity){return critQuarter(normalWeaponCritCapPct(rarity)*(4/3));}
function offhandDaggerCritCapPct(rarity){return critQuarter(normalWeaponCritCapPct(rarity)/6);}
function generatedCritHardCapPct(rarity,entry,weapon=null){
  if(entry?.kind==="weapon")return weapon?.family==="dagger"?daggerCritCapPct(rarity):normalWeaponCritCapPct(rarity);
  if(entry?.id==="ring" || entry?.family==="ring" || (entry?.slots||[]).some(slot=>String(slot).startsWith("ring")))return critRarityCapRow(rarity).ring;
  if(entry?.id==="gloves" || entry?.slot==="gloves" || (entry?.slots||[]).includes("gloves"))return critRarityCapRow(rarity).standard;
  return 0;
}
function generatedAffixMaxUnits(def,entry,weapon=null){
  if(def?.id==="crit" && entry?.kind==="weapon" && weapon?.family==="dagger") return 80; // ultimate dagger cap: 20%
  return def?.maxUnits||0;
}
function rolledCritMaxUnits(rarity,hardMaxUnits,randomFn=rnd){
  const hard=Math.max(0,Math.floor(Number(hardMaxUnits)||0));
  if(hard<=0)return 0;
  const keep=CRIT_AFFIX_CONTINUE_CHANCE[rarity]??CRIT_AFFIX_CONTINUE_CHANCE.Common;
  let units=1;
  while(units<hard && randomFn()<keep)units++;
  return units;
}
function generatedAffixCandidateMaxUnits(def,entry,weapon,rolledCaps=null){
  const hard=generatedAffixMaxUnits(def,entry,weapon);
  if(def?.id!=="crit" || !rolledCaps || !Number.isFinite(Number(rolledCaps.crit)))return hard;
  return Math.max(0,Math.min(hard,Math.floor(Number(rolledCaps.crit)||0)));
}
function addAffixUnit(affixes,def,maxUnits=def.maxUnits){
  const rec=affixes[def.id]||(affixes[def.id]={units:0,value:0});
  if(rec.units>=maxUnits) return false;
  rec.units++;rec.value=rec.units*def.unitCost;
  if(def.id==="crit"){rec.pct=rec.units*CRIT_AFFIX_STEP_PCT;delete rec.bonusCap;}
  else if(def.id==="bossDamage"){rec.pct=rec.units;rec.bonusCap=rec.units*2;}
  else if(def.id==="reflect"){rec.pct=rec.units;rec.damageCap=rec.units;}
  else if(def.id==="lifesteal"){rec.pct=rec.units;rec.healCap=rec.units;}
  else rec.amount=rec.units;
  return true;
}

function affixIntrinsicValue(affixes){ return Object.values(affixes||{}).reduce((sum,a)=>sum+(Number(a?.value)||0),0); }
function generatedAffixLines(affixes){
  const out=[];
  const a=affixes||{};
  if(a.crit?.units) out.push(`Critical Chance +${trimNumber(a.crit.pct,2)}%`);
  if(a.bossDamage?.units) out.push(`Boss Damage +${a.bossDamage.pct}% · bonus cap ${a.bossDamage.bonusCap}/action`);
  if(a.reflect?.units) out.push(`Damage Reflect ${a.reflect.pct}% · cap ${a.reflect.damageCap}/hit`);
  if(a.lifesteal?.units) out.push(`Lifesteal ${a.lifesteal.pct}% · cap ${a.lifesteal.healCap} HP/action`);
  if(a.skillRating?.units) out.push(`Skill Rating +${a.skillRating.amount}`);
  if(a.armorPen?.units) out.push(`Armor Penetration +${a.armorPen.amount}%`);
  if(a.magicPen?.units) out.push(`Magic Penetration +${a.magicPen.amount}%`);
  if(a.ccReduction?.units) out.push(`Crowd-Control Reduction +${a.ccReduction.amount}%`);
  if(a.lootFind?.units) out.push(`Loot Find +${a.lootFind.amount}%`);
  return out;
}
function itemSlotCoefficientFromDef(def){
  if(!def) return 1;
  if(def.kind==="weapon" || def.family && ["sword","greatsword","axe","dagger","shortsword","bow","wand","staff","unarmed"].includes(def.family)) return Number(def.hands||1)===2?2:SLOT_BUDGET_COEFFICIENTS.rightHand;
  const slot=(def.slots||[])[0]||def.slot;
  return SLOT_BUDGET_COEFFICIENTS[slot]||1;
}
function computedIntrinsicValue(def){
  if(!def) return 0;
  if(Number.isFinite(Number(def.intrinsicValue))) return Math.max(0,Number(def.intrinsicValue));
  if(def.generated){
    let value=0;
    if(Number.isFinite(Number(def.weaponContribution))) value+=Number(def.weaponContribution)*WEAPON_VALUE_COST;
    if(Number.isFinite(Number(def.armor))) value+=Number(def.armor)*ARMOR_VALUE_COST;
    for(const stat of STAT_KEYS) value+=(Number(def.attributes?.[stat])||0)*ATTRIBUTE_VALUE_COST;
    value+=affixIntrinsicValue(def.affixes);
    if(value>0) return value;
  }
  return intrinsicValueFromLevel(def.itemLevel||0,itemSlotCoefficientFromDef(def));
}
function computedItemGoldValue(def){
  if(!def) return 0;
  if(Number.isFinite(Number(def.goldValue))) return Math.max(0,Math.round(Number(def.goldValue)));
  return Math.max(0,Math.round(computedIntrinsicValue(def)*rarityMarketMultiplier(def.rarity||"Common")));
}
function stampItemEconomy(def,{recalculateGeneratedIlvl=false}={}){
  if(!def) return def;
  const coef=itemSlotCoefficientFromDef(def),intrinsic=computedIntrinsicValue({...def,intrinsicValue:undefined,goldValue:undefined});
  def.intrinsicValue=Number(intrinsic.toFixed(2));
  if(recalculateGeneratedIlvl && def.generated && intrinsic>0) def.itemLevel=Math.max(1,itemLevelFromIntrinsic(intrinsic,coef));
  def.goldValue=Math.max(0,Math.round(def.intrinsicValue*rarityMarketMultiplier(def.rarity||"Common")));
  return def;
}
function formatGold(value){
  const total=Math.max(0,Math.round(Number(value)||0));
  const gc=Math.floor(total/100), sc=total%100;
  if(gc>0 && sc>0) return `${gc.toLocaleString()} gc ${String(sc).padStart(2,"0")} sc`;
  if(gc>0) return `${gc.toLocaleString()} gc`;
  return `${sc.toLocaleString()} sc`;
}
function formatGoldHtml(value){
  const total=Math.max(0,Math.round(Number(value)||0));
  const gc=Math.floor(total/100), sc=total%100, bits=[];
  if(gc>0) bits.push(`<span class="coin-gc">${gc.toLocaleString()} gc</span>`);
  if(sc>0 || gc===0) bits.push(`<span class="coin-sc">${sc.toLocaleString()} sc</span>`);
  return bits.join('<span class="coin-sep"></span>');
}
function roundQuarter(n){ return Math.round((Number(n)||0)*4)/4; }
const MERCHANT_NAMES=Object.freeze(["Mora Vell","Brass-Lantern Nesk","Old Tallow Hedd","Tarn Seln","Blue-Clasp Rook","Jori Flint","Pale Aster Merrow"]);
const MERCHANT_TITLES=Object.freeze(["Wayfarer","Peddler","Quartermaster","Relic Trader","Armorer"]);
function ensureMerchantState(){
  if(!S) return;
  if(!S.pendingMerchant || typeof S.pendingMerchant!=="object" || Array.isArray(S.pendingMerchant)) S.pendingMerchant=null;
  if(!Number.isInteger(S.merchantVisits)) S.merchantVisits=0;
  if(!Array.isArray(S.merchantHistory)) S.merchantHistory=[];
}
function merchantEncounterRange(){
  ensureMerchantState();
  const first=(S?.merchantVisits||0)<=0;
  return first ? [18,34] : [38,78];
}
function merchantSellMultiplier(merchant=currentMerchant()){
  const cha=effectiveStat("CHA")||10,base=clamp(1.28-(cha-10)*0.015,1.08,1.34);
  return clamp(base*(Number(merchant?.playerBuyPriceMod)||1),0.90,1.34);
}
function merchantBuyMultiplier(merchant=currentMerchant()){
  const cha=effectiveStat("CHA")||10,base=clamp(0.50+(cha-10)*0.015,0.34,0.72);
  return clamp(base*(Number(merchant?.playerSellPayoutMod)||1),0.34,0.82);
}
function merchantUnitValueForBackpackKey(key,name=""){
  if(key==="campSupplies") return 34;
  if(key==="bandages") return 12;
  if(key==="meat") return 7;
  if(key==="rope") return 16;
  if(key==="water") return 6;
  if(key==="rogueTools") return 55;
  const low=String(name||"").toLowerCase();
  if(/ore|salvage|scrap|essence|fragment|shard/.test(low)) return 9;
  if(/book|map|scroll|page|journal/.test(low)) return 11;
  return 5;
}
function merchantSellValueForEquipment(itemId){
  const item=equipmentItemDef(itemId); if(!item) return 0;
  return Math.max(1,Math.floor(computedItemGoldValue(item)*merchantBuyMultiplier()));
}
function merchantEquipmentStatsHtml(item){
  if(!item) return "";
  const lines=equipmentDisplayStatLines(item);
  if(!lines.length) return "";
  return `<div class="merchant-item-stats"><em>Stats</em>${lines.map(line=>`<span class="merchant-item-stat">${esc(line)}</span>`).join("")}</div>`;
}
function merchantEquipmentCompareHtml(itemId,targetSlot=null){
  if(!S||!itemId||!equipmentItemDef(itemId)) return "";
  const target=recommendedEquipmentSlot(itemId,targetSlot,"all");
  if(!target) return "";
  const currentId=S.equipment?.[target]||null;
  // Empty target slots intentionally show no comparison. Likewise, an equipped
  // item in the Sell Gear view should not compare against itself.
  if(!currentId||currentId===itemId) return "";
  const current=equipmentItemDef(currentId);
  if(!current) return "";
  const c=equipmentComparisonForTarget(itemId,target);
  const bits=[];
  bits.push(`<span class="equipment-delta power">vs ${esc(current.name)}</span>`);
  bits.push(`<span class="equipment-delta power">iLv ${deltaText(c.itemDelta)}</span>`);
  bits.push(`<span class="equipment-delta power">Gear ${deltaText(c.gearDelta,1)}</span>`);
  const armorDelta=(c.armorAfter??0)-(c.armorBefore??0);
  if(Math.abs(armorDelta)>.001) bits.push(`<span class="equipment-delta ${deltaClass(armorDelta)}">Armor ${deltaText(armorDelta)}</span>`);
  for(const stat of STAT_KEYS){
    const d=(c.attributesAfter?.[stat]||0)-(c.attributesBefore?.[stat]||0);
    if(d) bits.push(`<span class="equipment-delta ${deltaClass(d)}">${stat} ${deltaText(d)}</span>`);
  }
  const strikeDelta=(c.strikeAfter??0)-(c.strikeBefore??0);
  if(Math.abs(strikeDelta)>.05) bits.push(`<span class="equipment-delta ${deltaClass(strikeDelta)}">Attack Rating ${deltaText(strikeDelta,1)}</span>`);
  const defenceDelta=(c.defenceRatingAfter??0)-(c.defenceRatingBefore??0);if(Math.abs(defenceDelta)>.05)bits.push(`<span class="equipment-delta ${deltaClass(defenceDelta)}">Defence Rating ${deltaText(defenceDelta,1)}</span>`);
  const mitigationDelta=((c.physicalMitigationAfter??0)-(c.physicalMitigationBefore??0))*100;if(Math.abs(mitigationDelta)>.01)bits.push(`<span class="equipment-delta ${deltaClass(mitigationDelta)}">Physical DR ${deltaText(mitigationDelta,1)}%</span>`);
  const critDelta=(c.critChanceAfter??0)-(c.critChanceBefore??0);if(Math.abs(critDelta)>.001)bits.push(`<span class="equipment-delta same">Crit Chance ${deltaText(critDelta,2)}%</span>`);
  const critDmgDelta=(c.critDamageAfter??0)-(c.critDamageBefore??0);if(Math.abs(critDmgDelta)>.001)bits.push(`<span class="equipment-delta same">Crit Damage ${deltaText(critDmgDelta,1)}%</span>`);
  const affixes=[["Boss","bossDamage"],["Reflect","reflect"],["Lifesteal","lifesteal"]];
  for(const [label,key] of affixes){
    const d=(c.affixesAfter?.[key]?.pct||0)-(c.affixesBefore?.[key]?.pct||0);
    if(d) bits.push(`<span class="equipment-delta ${deltaClass(d)}">${label} ${deltaText(d)}%</span>`);
  }
  bits.push(`<span>${esc(EQUIPMENT_SLOT_LABELS[target]||target)}</span>`);
  return `<div class="pack-compare">${bits.join("")}</div>`;
}
function merchantBuyPrice(stock,merchant=currentMerchant()){
  if(!stock) return 0;
  if(stock.kind==="equipment"){
    const item=equipmentItemDef(stock.itemId); if(!item) return 0;
    return Math.max(1,Math.ceil(computedItemGoldValue(item)*merchantSellMultiplier(merchant)));
  }
  return Math.max(1,Math.ceil((Number(stock.unitPrice)||0)*merchantSellMultiplier(merchant)));
}
function merchantSupplyStock(label,key,qty,unitPrice,desc){
  return {id:`mstock_${key}_${Date.now().toString(36)}_${Math.floor(rnd()*1e5).toString(36)}`,kind:"supply",supplyKey:key,label,qty,unitPrice,desc};
}
function storeMerchantEquipment(item){
  if(!S||!item?.id) return null;
  S.generatedItems=S.generatedItems||{};
  S.generatedItems[item.id]=cloneForSave(item);
  return item.id;
}
function generateMerchantForDepth(depth){
  const d=Math.max(0,Number(depth)||0);
  const id=`merchant_${Date.now().toString(36)}_${Math.floor(rnd()*1e6).toString(36)}`;
  const name=MERCHANT_NAMES[ri(0,MERCHANT_NAMES.length-1)];
  const title=MERCHANT_TITLES[ri(0,MERCHANT_TITLES.length-1)];
  const stock=[];
  const stockCount=4;
  for(let i=0;i<stockCount;i++){
    const item=generateProceduralEquipment(Math.max(0,d+ri(-8,10)),`merchant:${id}:${i}`);
    storeMerchantEquipment(item);
    stock.push({id:`${id}_eq_${i}`,kind:"equipment",itemId:item.id});
  }
  stock.push(merchantSupplyStock("Bandage","bandages",ri(1,3),12,"Stops Bleeding when used from the Backpack."));
  stock.push(merchantSupplyStock("Camp Supply","campSupplies",1,34,"A compact field bundle for making camp at a safe hollow."));
  const merchant={id,name,title,depth:roundQuarter(d),purse:ri(120,260)+Math.round(d*1.2),stock,context:"wandering"};
  for(const row of stock) merchant.purse+=Math.round(merchantBuyPrice(row,merchant)*0.22);
  return merchant;
}
function generateTownMerchantForService(def,serviceId){
  const d=Math.max(0,Number(def?.depth)||0),id=`town_${def?.id||"town"}_${serviceId}`;
  const common={id,depth:roundQuarter(d),context:"town",serviceId,playerBuyPriceMod:0.92,playerSellPayoutMod:1.10};
  if(serviceId==="herbalist"){
    return {...common,title:def?.name||"Town",name:"Herbalist",displayName:`${def?.name||"Town"} Herbalist`,buyOnly:true,purse:600+Math.round(d),stock:[merchantSupplyStock("Bandage","bandages",10,12,"Stops Bleeding when used from the Backpack.")]};
  }
  const stock=[];
  for(let i=0;i<6;i++){
    const item=generateProceduralEquipment(Math.max(0,d+ri(-6,12)),`town-market:${def?.id||"town"}:${i}`);
    storeMerchantEquipment(item);
    stock.push({id:`${id}_eq_${i}`,kind:"equipment",itemId:item.id});
  }
  stock.push(merchantSupplyStock("Camp Supply","campSupplies",2,34,"A compact field bundle for making camp at a safe hollow."));
  const market={...common,title:def?.name||"Town",name:"Market",displayName:`${def?.name||"Town"} Market`,buyOnly:false,purse:1400+Math.round(d*2),stock};
  for(const row of stock) market.purse+=Math.round(merchantBuyPrice(row,market)*0.15);
  return market;
}
function midBossDepthForStratum(stratum){ return stratum*FATHOMS_PER_STRATUM + FATHOMS_PER_STRATUM/2; }
function routeReservedDepthsAround(depth){
  const d=Math.max(0,Number(depth)||0),first=Math.max(0,Math.floor((d-90)/FATHOMS_PER_STRATUM)),last=Math.max(first,Math.floor((d+90)/FATHOMS_PER_STRATUM));
  const out=[];
  for(let i=first;i<=last;i++){
    out.push(midBossDepthForStratum(i),(i+1)*FATHOMS_PER_STRATUM,stageHollowInfo(i).depth);
    for(const h of ordinaryHollowsForStratum(i)) out.push(h.depth);
  }
  if(Number.isFinite(Number(S?.sideDiscoveryAt))) out.push(Number(S.sideDiscoveryAt));
  for(const h of (S?.sideAreaHistory||[])) out.push(Number(h.entryDepth)||0);
  for(const h of (S?.merchantHistory||[])) out.push(Number(h.depth)||0);
  const caravan=pendingCaravan();if(caravan)out.push(Number(caravan.depth)||0);
  for(const q of questInstances("active")) out.push(Number(q.targetDepth)||0);
  return out;
}
function routeDepthClear(depth,minGap=5){ return routeReservedDepthsAround(depth).every(other=>Math.abs(other-depth)>=minGap); }
function findClearMerchantDepth(desired){
  let d=roundQuarter(Math.max((Number(S?.depth)||0)+6,Number(desired)||0));
  for(let i=0;i<80;i++){
    if(routeDepthClear(d,5)) return d;
    d=roundQuarter(d+.75);
  }
  return d;
}
function nudgePendingMerchantFromDepth(depth,minGap=5){
  const m=currentMerchant(); if(!m || Math.abs(m.depth-depth)>=minGap) return;
  m.depth=findClearMerchantDepth(depth+minGap+2);
}
function normalizePendingMerchantDepth(){
  const m=S?.pendingMerchant;
  if(!m || m.depth<=Number(S.depth||0)+TRAVEL_STEP) return;
  if(!routeDepthClear(m.depth,5)) m.depth=findClearMerchantDepth(Math.max(Number(S.depth||0)+6,m.depth));
}
function roadTrafficDepthIsStale(depth){
  const d=Number(depth),here=Number(S?.depth)||0;
  // In Active World, road traffic retires by physical camera distance. Depth-only
  // retirement made a caravan disappear while it could still be visible and,
  // worse, used to make its temporary floor patch disappear with it.
  if($("worldCanvas"))return !Number.isFinite(d);
  return !Number.isFinite(d) || d<=here+.0001;
}
function repairStaleRoadTrafficSlot(){
  if(!S)return false;
  ensureMerchantState();const caravanState=ensureCaravanState();
  // Do not retire a slot after the player has actually reached it. Merchant and
  // caravan encounters keep their pending record alive while the choice/trade/
  // combat UI is open, so those states are deliberately protected here.
  const merchantActive=S.travelEvent?.id==="merchant" || (S.packMode==="merchant" && !!S.pendingMerchant);
  const interactionCaravanId=S.interactionState?.active?.context?.eventId||S.interactionState?.pending?.context?.eventId||null;
  const caravanActive=S.travelEvent?.id==="caravan" || !!S.foe?.caravan || !!caravanState?.activeMerchant || (!!caravanState?.pending&&interactionCaravanId===caravanState.pending.id);
  let repaired=false;
  if(S.pendingMerchant && !merchantActive && roadTrafficDepthIsStale(S.pendingMerchant.depth)){
    S.pendingMerchant=null;
    repaired=true;
  }
  if(caravanState?.pending && !caravanActive && roadTrafficDepthIsStale(caravanState.pending.depth)){
    caravanState.pending=null;
    caravanState.warning=null;
    caravanState.activeMerchant=null;
    caravanState.routeRolls={};
    repaired=true;
  }
  if(repaired)requestRunSave();
  return repaired;
}
function normalizeRoadTrafficSlot(){
  if(!S)return false;
  ensureMerchantState();const c=ensureCaravanState();
  if(!S.pendingMerchant||!c?.pending)return false;
  // A valid post-v0.107.2 run must never own both kinds of road traffic. If an
  // older/transitional save does, preserve whichever event is physically next.
  const md=Number(S.pendingMerchant.depth),cd=Number(c.pending.depth);
  if(Number.isFinite(cd)&&(!Number.isFinite(md)||cd<=md)){
    S.pendingMerchant=null;
  }else{
    c.pending=null;c.warning=null;c.activeMerchant=null;c.routeRolls={};
  }
  requestRunSave();return true;
}
function maybeScheduleMerchant(){
  if(!S || sideAreaActive()) return;
  ensureMerchantState();ensureCaravanState();
  normalizeRoadTrafficSlot();
  // v0.107.5: a town/boss/other priority interruption can occasionally move the
  // delver past a pending road slot before that slot gets its crossing check.
  // Retire only unseen stale slots, then immediately create a fresh future slot.
  repairStaleRoadTrafficSlot();
  // There is exactly one road-traffic slot pending at a time. A caravan and a
  // wandering merchant can never be independently scheduled on top of each other.
  if(S.pendingMerchant){normalizePendingMerchantDepth();return;}
  if(pendingCaravan())return;
  const [mn,mx]=merchantEncounterRange();
  const depth=findClearMerchantDepth((Number(S.depth)||0)+ri(mn,mx));
  if(rnd()<CARAVAN_ROAD_SLOT_CHANCE)scheduleCaravanAtRoadSlot(depth);
  else S.pendingMerchant=generateMerchantForDepth(depth);
  requestRunSave();
}
function currentMerchant(){
  ensureMerchantState();ensureCaravanState();
  if(townMerchantServiceId && currentTown()) return ensureTownMerchantService(townMerchantServiceId);
  if(S?.caravans?.activeMerchant) return S.caravans.activeMerchant;
  return S?.pendingMerchant||null;
}
function merchantDisplayName(m=currentMerchant()){ return m?.displayName||`${m?.title||"Merchant"} ${m?.name||""}`.trim(); }
function merchantArrivalText(m){
  return `${m.title} ${m.name} has made a neutral camp along the route. A blue lantern hangs beside the path, and the trader watches your approach without reaching for steel.`;
}
function beginMerchantEncounter(){
  const m=currentMerchant(); if(!m||S.foe||S.travelEvent) return false;
  closePack();
  S.depth=roundQuarter(m.depth);
  S.travelMode="stopped";
  S.travelSinceEvent=0;
  pauseBoonClock();
  S.travelEvent={id:"merchant",kind:"Wandering Merchant",title:`${m.title} ${m.name}`,text:merchantArrivalText(m),rollHtml:`<b>Merchant purse:</b> ${formatGold(m.purse)}<br><b>Visible stock:</b> ${m.stock.filter(x=>(x.kind!=="supply")||x.qty>0).length} goods`};
  travelLogAdd(`<b>Merchant spotted.</b> ${esc(m.title)} ${esc(m.name)} waits beside the route.`,"note");
  render();
  return true;
}
function retireMerchant(){
  ensureMerchantState();
  merchantView="buy";merchantSellGearScope="backpack";merchantPendingPurchase=null;
  merchantSellSelection={equipment:new Set(),backpack:new Set()};
  merchantSellQuantities={};
  if(S.pendingMerchant){
    S.merchantVisits=(Number(S.merchantVisits)||0)+1;
    S.merchantHistory.push({depth:Number(S.pendingMerchant.depth)||0,name:`${S.pendingMerchant.title} ${S.pendingMerchant.name}`});
    if(S.merchantHistory.length>80) S.merchantHistory.shift();
  }
  S.pendingMerchant=null;
  maybeScheduleMerchant();
}
function leaveMerchant(){
  if(!S || S.packMode!=="merchant") return;
  const m=currentMerchant(),townTrade=m?.context==="town",caravanTrade=m?.context==="caravan";
  S.packMode=null;
  packReturnTarget=null;
  $("packSheet").hidden=true;
  merchantView="buy";merchantSellGearScope="backpack";merchantPendingPurchase=null;
  merchantSellSelection={equipment:new Set(),backpack:new Set()};merchantSellQuantities={};
  if(townTrade){
    townMerchantServiceId=null;
    saveRunNow();
    syncBrowseTravelUI();
    render();
    return;
  }
  if(m) travelLogAdd(`You leave <b>${esc(merchantDisplayName(m))}</b> behind and continue the descent.`,"note");
  if(caravanTrade) recordCaravanResolution("traded",pendingCaravan());
  else retireMerchant();
  S.travelMode="descend";
  resumeBoonClock();
  syncBrowseTravelUI();
  render();
}
function merchantEquipmentSellRows(){
  ensureEquipmentState();
  const out=[];
  const seen=new Set();
  if(merchantSellGearScope==="equipped"){
    for(const slot of EQUIPMENT_SLOT_ORDER){
      const id=S?.equipment?.[slot];
      if(!id || seen.has(id)) continue;
      seen.add(id);
      out.push({itemId:id,location:`Equipped · ${EQUIPMENT_SLOT_LABELS[slot]||slot}`,equipped:true,slot});
    }
  }else{
    for(const id of sortedBackpackEquipment(equipmentFilter)) if(!seen.has(id)) out.push({itemId:id,location:"Backpack",equipped:false});
  }
  return out;
}
function equipmentTypeLabel(def){
  if(!def) return "Equipment";
  if(Number(def.hands||1)===2 && def.slot==="rightHand") return `Main Hand · two-handed ${def.family||"weapon"}`;
  const slots=def.slots||[def.slot];
  const first=slots[0];
  return EQUIPMENT_SLOT_LABELS[first]||String(def.family||first||"Equipment");
}
function merchantBackpackSellPayout(key,label,qty){
  const count=Math.max(0,Math.floor(Number(qty)||0));
  if(count<=0) return 0;
  const lookupKey=String(key||"").startsWith("misc:")?"misc":key;
  return Math.max(1,Math.floor(count*merchantUnitValueForBackpackKey(lookupKey,label)*merchantBuyMultiplier()));
}
function merchantBackpackSellQty(key,maxCount){
  const max=Math.max(0,Math.floor(Number(maxCount)||0));
  return clamp(Math.floor(Number(merchantSellQuantities[key])||0),0,max);
}
function merchantSetBackpackSellQty(key,qty){
  const row=merchantBackpackSellRows().find(x=>x.key===key);
  if(!row) return;
  const next=clamp(Math.floor(Number(qty)||0),0,row.count);
  if(next<=0) delete merchantSellQuantities[key]; else merchantSellQuantities[key]=next;
  renderPack(false);
}
function merchantAdjustBackpackSellQty(key,delta){
  const row=merchantBackpackSellRows().find(x=>x.key===key);
  if(!row) return;
  merchantSetBackpackSellQty(key,merchantBackpackSellQty(key,row.count)+(Number(delta)||0));
}
function merchantBackpackSellRows(){
  const inv=S?.inventory||{}, rows=[];
  const push=(key,label,count,desc)=>{
    const held=Math.max(0,Math.floor(Number(count)||0));
    if(held>0) rows.push({key,label,count:held,desc,totalValue:merchantBackpackSellPayout(key,label,held)});
  };
  push("bandages","Bandages",inv.bandages,"Stops Bleeding when used from the Backpack.");
  push("meat","Meat",inv.meat,"Rations and scavenged cuts.");
  push("rope","Rope",inv.rope,"General delving rope.");
  push("water","Water",inv.water,"Waterskins or jugs.");
  push("campSupplies","Camp Supplies",inv.campSupplies,"Field bundles for full camps.");
  push("rogueTools","Rogue Tools",inv.rogueTools,"Fine picks and trap tools.");
  for(const [name,count] of Object.entries(inv.misc||{})) push(`misc:${name}`,name,count,"Miscellaneous trade goods.");
  return rows;
}
function merchantSelectedEquipmentPayout(){
  let total=0;
  for(const id of merchantSellSelection.equipment) total+=merchantSellValueForEquipment(id);
  return total;
}
function merchantSelectedBackpackPayout(){
  let total=0;
  for(const row of merchantBackpackSellRows()){
    const qty=merchantBackpackSellQty(row.key,row.count);
    total+=merchantBackpackSellPayout(row.key,row.label,qty);
  }
  return total;
}
function merchantSelectedBackpackUnits(){
  return merchantBackpackSellRows().reduce((sum,row)=>sum+merchantBackpackSellQty(row.key,row.count),0);
}
function merchantCanAfford(amount){ return (currentMerchant()?.purse||0) >= Math.max(0,amount||0); }
function merchantAddSoldEquipmentToStock(itemId){
  const m=currentMerchant(); if(!m||!equipmentItemDef(itemId)) return;
  m.stock.push({id:`${m.id}_resale_${Math.floor(rnd()*1e6).toString(36)}`,kind:"equipment",itemId,resale:true});
}
function removeEquippedItemEverywhere(itemId){
  ensureEquipmentState();
  removeEquipmentFromBag(itemId);
  for(const slot of EQUIPMENT_SLOT_ORDER){
    if(S.equipment[slot]===itemId) S.equipment[slot]=null;
  }
  if(S.equippedWeapon===itemId) S.equippedWeapon=null;
  syncVotaryLoadoutFromHands();
  syncEquipmentHpCeiling();
}
function merchantBuyStock(stockId,confirmed=false){
  const m=currentMerchant(); if(!m) return;
  const idx=m.stock.findIndex(row=>row.id===stockId); if(idx<0) return;
  const row=m.stock[idx], price=merchantBuyPrice(row);
  if(price<=0 || (S.gold||0) < price) return;
  if(!confirmed){ merchantPendingPurchase=stockId; renderPack(false); return; }
  merchantPendingPurchase=null;
  S.gold-=price; m.purse+=price;
  if(row.kind==="equipment"){
    addEquipmentToBag(row.itemId);
    travelLogAdd(`Bought <b>${esc(equipmentItemDef(row.itemId)?.name||"gear")}</b> from <b>${esc(merchantDisplayName(m))}</b> for ${formatGold(price)}.`,"good");
    m.stock.splice(idx,1);
  }else if(row.kind==="supply"){
    const key=row.supplyKey;
    S.inventory[key]=Math.max(0,Number(S.inventory[key])||0)+1;
    row.qty=Math.max(0,(Number(row.qty)||0)-1);
    travelLogAdd(`Bought <b>${esc(row.label)}</b> for ${formatGold(price)}.`,"good");
    if(row.qty<=0) m.stock.splice(idx,1);
  }
  saveRunNow();
  renderPack(false); render();
}
function cancelMerchantPurchase(){ merchantPendingPurchase=null; renderPack(false); }
function merchantToggleSellEquipment(itemId){
  const set=merchantSellSelection.equipment;
  if(set.has(itemId)) set.delete(itemId); else set.add(itemId);
  renderPack(false);
}
function merchantToggleSellBackpack(key){
  const set=merchantSellSelection.backpack;
  if(set.has(key)) set.delete(key); else set.add(key);
  renderPack(false);
}
function merchantSellSelectedEquipment(){
  const m=currentMerchant(); if(!m) return;
  const ids=[...merchantSellSelection.equipment].filter(id=>equipmentItemDef(id));
  if(!ids.length) return;
  const total=ids.reduce((sum,id)=>sum+merchantSellValueForEquipment(id),0);
  if(!merchantCanAfford(total)) return;
  const equippedIds=new Set(Object.values(S.equipment||{}).filter(Boolean));
  if(ids.some(id=>equippedIds.has(id)) && !confirm("This sale includes equipped gear. Confirm selling it and removing it from your current loadout?")) return;
  for(const id of ids){
    removeEquippedItemEverywhere(id);
    merchantAddSoldEquipmentToStock(id);
  }
  m.purse-=total; S.gold=(S.gold||0)+total;
  merchantSellSelection.equipment.clear();
  travelLogAdd(`Sold <b>${ids.length}</b> equipment item${ids.length===1?"":"s"} for ${formatGold(total)}.`,"good");
  saveRunNow();
  renderPack(false); render();
}
function merchantSellSelectedBackpack(){
  const m=currentMerchant(); if(!m) return;
  const rows=merchantBackpackSellRows().map(row=>({...row,qty:merchantBackpackSellQty(row.key,row.count)})).filter(row=>row.qty>0);
  if(!rows.length) return;
  const total=rows.reduce((sum,row)=>sum+merchantBackpackSellPayout(row.key,row.label,row.qty),0);
  if(!merchantCanAfford(total)) return;
  let units=0;
  for(const row of rows){
    const qty=Math.min(row.count,row.qty); units+=qty;
    if(row.key==="bandages") S.inventory.bandages=Math.max(0,(Number(S.inventory.bandages)||0)-qty);
    else if(row.key==="meat") S.inventory.meat=Math.max(0,(Number(S.inventory.meat)||0)-qty);
    else if(row.key==="rope") S.inventory.rope=Math.max(0,(Number(S.inventory.rope)||0)-qty);
    else if(row.key==="water") S.inventory.water=Math.max(0,(Number(S.inventory.water)||0)-qty);
    else if(row.key==="campSupplies") S.inventory.campSupplies=Math.max(0,(Number(S.inventory.campSupplies)||0)-qty);
    else if(row.key==="rogueTools") S.inventory.rogueTools=Math.max(0,(Number(S.inventory.rogueTools)||0)-qty);
    else if(row.key.startsWith("misc:")){
      const left=Math.max(0,(Number(S.inventory.misc?.[row.label])||0)-qty);
      if(left>0) S.inventory.misc[row.label]=left; else delete S.inventory.misc[row.label];
    }
  }
  m.purse-=total; S.gold=(S.gold||0)+total;
  merchantSellSelection.backpack.clear(); merchantSellQuantities={};
  travelLogAdd(`Sold <b>${units}</b> backpack unit${units===1?"":"s"} for ${formatGold(total)}.`,"good");
  saveRunNow();
  renderPack(false); render();
}


/* ============================================================
   v0.090.0 — SESSION 9F PROCEDURAL EQUIPMENT
   Authored starters, bosses and special items stay in EQUIPMENT_ITEMS. Ordinary
   drops are unique saved instances generated from depth, rarity and Intrinsic Value.
   ============================================================ */
const GENERATED_WEAPON_FAMILIES = Object.freeze([
  Object.freeze({base:"Longsword",family:"sword",stat:"STR",hands:1,weight:2}),
  Object.freeze({base:"Greatsword",family:"greatsword",stat:"STR",hands:2,greatWeapon:true,weight:1}),
  Object.freeze({base:"Hand Axe",family:"axe",stat:"STR",hands:1,weight:1}),
  Object.freeze({base:"Dagger",family:"dagger",stat:"DEX",hands:1,weight:2}),
  Object.freeze({base:"Shortbow",family:"bow",stat:"DEX",hands:2,weight:2}),
  Object.freeze({base:"Wand",family:"wand",stat:"INT",hands:1,weight:2}),
  Object.freeze({base:"Wooden Staff",family:"staff",stat:"INT",hands:2,weight:2})
]);
const GENERATED_DROP_FAMILIES = Object.freeze([
  Object.freeze({id:"weapon",kind:"weapon",weight:22}),
  Object.freeze({id:"shield",kind:"armor",base:"Buckler",family:"shield",slot:"leftHand",slots:["leftHand"],weight:6}),
  Object.freeze({id:"focus",kind:"attributes",base:"Field Grimoire",family:"focus",slot:"leftHand",slots:["leftHand"],pool:["INT","WIS"],weight:4}),
  Object.freeze({id:"top",kind:"armor",base:"Delver's Jack",slot:"top",slots:["top"],weight:9}),
  Object.freeze({id:"bottoms",kind:"armor",base:"Trousers",slot:"bottoms",slots:["bottoms"],weight:7}),
  Object.freeze({id:"hat",kind:"armor",base:"Coif",slot:"hat",slots:["hat"],weight:6}),
  Object.freeze({id:"gloves",kind:"armor",base:"Gloves",slot:"gloves",slots:["gloves"],weight:6}),
  Object.freeze({id:"boots",kind:"armor",base:"Boots",slot:"boots",slots:["boots"],weight:6}),
  Object.freeze({id:"cape",kind:"attributes",base:"Cape",slot:"cape",slots:["cape"],pool:["DEX","WIS","CHA"],weight:5}),
  Object.freeze({id:"belt",kind:"attributes",base:"Belt",slot:"belt",slots:["belt"],pool:["STR","CON","DEX"],weight:5}),
  Object.freeze({id:"light",kind:"attributes",base:"Hooded Lantern",slot:"light",slots:["light"],pool:["WIS","INT","DEX"],weight:5}),
  Object.freeze({id:"necklace",kind:"attributes",base:"Pendant",slot:"necklace",slots:["necklace"],pool:["WIS","CHA","INT","CON"],weight:5}),
  Object.freeze({id:"earring",kind:"attributes",base:"Stud",slot:"earring",slots:["earLeft","earRight"],pool:["DEX","INT","WIS","CHA"],weight:7}),
  Object.freeze({id:"ring",kind:"attributes",base:"Ring",slot:"ring",slots:["ring1","ring2","ring3","ring4"],pool:["STR","CON","DEX","INT","WIS","CHA"],weight:7})
]);
const GENERATED_RARITY_PREFIX = Object.freeze({
  Salvage:"Salvaged",Poor:"Worn",Common:"",Uncommon:"Hardened",Rare:"Deep-forged",Epic:"Masterwork",
  Wondrous:"Wonder-wrought",Legendary:"Legend-marked",Mythical:"Mythbound",Ancient:"Ancient",Sunless:"Sunless",Unfathomable:"Unfathomable"
});
function rollEquipmentRarity(depth=S?.depth||0){
  const odds=equipmentRarityOddsAtDepth(depth),roll=rnd();
  let cursor=0,last="Common";
  for(const rarity of RARITY_ORDER){
    const chance=Math.max(0,Number(odds[rarity])||0);
    if(chance<=0) continue;
    last=rarity;cursor+=chance;
    if(roll<cursor) return rarity;
  }
  // Floating-point guard only; the active era always sums to 100%.
  return last;
}
function generatedWeightedPick(entries,weightFn=e=>e.weight||1){
  const weights=entries.map(e=>Math.max(0,Number(weightFn(e))||0)),total=weights.reduce((a,b)=>a+b,0);
  if(total<=0) return entries[0];
  let roll=rnd()*total;
  for(let i=0;i<entries.length;i++){roll-=weights[i];if(roll<=0)return entries[i];}
  return entries[entries.length-1];
}
function generatedFamilyWeight(entry,sourceKey){
  let w=entry.weight||1;
  if(["cutter","mauler"].includes(sourceKey) && entry.id==="weapon") w*=1.8;
  if(sourceKey==="shieldback" && ["shield","top","gloves"].includes(entry.id)) w*=1.8;
  if(sourceKey==="skitter" && ["bottoms","hat","boots","cape"].includes(entry.id)) w*=1.45;
  if(["scrounger","oldhand"].includes(sourceKey) && ["focus","belt","light","necklace","earring","ring"].includes(entry.id)) w*=1.65;
  return w;
}
function generatedStratumTag(depth=S?.depth||0){
  return ["Warren","Mine","Barrow","Undertemple","Wyrm"][stratumIndex(depth)]||"Deep";
}
function generatedItemName(base,rarity,depth){
  const prefix=GENERATED_RARITY_PREFIX[rarity]||"",tag=generatedStratumTag(depth);
  return [prefix,tag,base].filter(Boolean).join(" ");
}
function generatedInstanceId(){
  if(!S) return `gen_${Date.now()}_${Math.floor(rnd()*1e9)}`;
  S.generatedItemSeq=(Number(S.generatedItemSeq)||0)+1;
  return `gen_${Date.now().toString(36)}_${S.generatedItemSeq.toString(36)}_${Math.floor(rnd()*0xffffff).toString(36)}`;
}
function stochasticWhole(value,min=0){
  const v=Math.max(0,Number(value)||0),floor=Math.floor(v);
  return Math.max(min,floor+(rnd()<(v-floor)?1:0));
}
function generatedTargetItemLevel(depth,rarity){
  const variance=1-GENERATED_ILVL_VARIANCE+rnd()*(GENERATED_ILVL_VARIANCE*2);
  return Math.max(1,Math.round(expectedItemLevelAtDepth(depth)*rarityDef(rarity).budgetMult*variance));
}
function generatedSlotCoefficient(entry,weapon=null){
  if(entry.kind==="weapon") return Number(weapon?.hands||1)===2?2:SLOT_BUDGET_COEFFICIENTS.rightHand;
  const slot=(entry.slots||[])[0];
  return SLOT_BUDGET_COEFFICIENTS[slot]||1;
}
function distributeGeneratedAttributes(points,pool){
  const attrs={};
  for(let i=0;i<points;i++){const stat=pick(pool);attrs[stat]=(attrs[stat]||0)+1;}
  return attrs;
}
function generatedStatsLines(item){
  const lines=[];
  if(item.kind==="weapon") lines.push(`${item.stat} scaling`,`Weapon contribution +${Number(item.weaponContribution).toFixed(1)}`,`Speed ${weaponCombatSpeed(item)}`);
  else if(item.armor) lines.push(`Armor +${item.armor}`);
  else lines.push(...STAT_KEYS.filter(stat=>item.attributes?.[stat]).map(stat=>`${stat} +${item.attributes[stat]}`));
  if(item.family==="shield") lines.push(`Guard: ${Math.round(GUARD_REDUCTION_SHIELD*100)}% damage reduction`);
  lines.push(...generatedAffixLines(item.affixes));
  return lines;
}
function cloneGeneratedCandidate(c){ return JSON.parse(JSON.stringify(c)); }
function candidateAddCoreUnit(candidate,entry,weapon){
  if(entry.kind==="weapon"){
    candidate.weaponContribution=Number(((candidate.weaponContribution||0)+0.1).toFixed(1));
    candidate.value+=WEAPON_VALUE_COST*0.1;
    return;
  }
  if(entry.kind==="armor"){
    candidate.armor=(candidate.armor||0)+1;candidate.value+=ARMOR_VALUE_COST;return;
  }
  const stat=pick(entry.pool);candidate.attributes[stat]=(candidate.attributes[stat]||0)+1;candidate.value+=ATTRIBUTE_VALUE_COST;
}
function candidateCoreCost(entry){ return entry.kind==="weapon"?WEAPON_VALUE_COST*0.1:entry.kind==="armor"?ARMOR_VALUE_COST:ATTRIBUTE_VALUE_COST; }
function generatedMaxAffixTypes(rarity){
  const rank=RARITY_ORDER.indexOf(rarity);
  if(rank<=RARITY_ORDER.indexOf("Common")) return 1;
  if(rank<=RARITY_ORDER.indexOf("Rare")) return 2;
  return 3;
}
function buildGeneratedValueCandidate(entry,weapon,targetValue,rarity="Common",rolledCaps=null){
  const candidate={value:0,attributes:{},affixes:emptyAffixRecord(),armor:0,weaponContribution:0};
  const affixes=allowedGeneratedAffixes(entry),limit=targetValue*(1+GENERATED_VALUE_TOLERANCE),maxTypes=generatedMaxAffixTypes(rarity);
  const coreCost=candidateCoreCost(entry);
  // Keep the slot's native identity dominant, but vary how much room is reserved
  // for build-defining affixes. Utility pieces can lean further into affixes.
  const nativeShare=entry.kind==="attributes" ? 0.42+rnd()*0.42 : 0.64+rnd()*0.28;
  const nativeTarget=targetValue*nativeShare;
  while(candidate.value+coreCost<=Math.min(nativeTarget,limit)) candidateAddCoreUnit(candidate,entry,weapon);
  // Randomly buy legal affix units while they fit. Different denominations are
  // what remove the old repeated iLv shelves without inventing fractional stats.
  let guard=0;
  while(affixes.length && guard++<80){
    const usedTypes=Object.keys(candidate.affixes).length;
    const fitting=affixes.filter(def=>candidate.value+def.unitCost<=limit && (candidate.affixes[def.id]?.units||0)<generatedAffixCandidateMaxUnits(def,entry,weapon,rolledCaps) && (candidate.affixes[def.id]||usedTypes<maxTypes));
    if(!fitting.length) break;
    const def=generatedWeightedPick(fitting,()=>1);
    if(rnd()<0.24 && candidate.value>=targetValue*(1-GENERATED_VALUE_TOLERANCE)) break;
    addAffixUnit(candidate.affixes,def,generatedAffixCandidateMaxUnits(def,entry,weapon,rolledCaps));candidate.value+=def.unitCost;
  }
  // Finish with native units when they improve the miss. This deliberately does
  // not force an exact target: final iLv is allowed to land naturally nearby.
  while(candidate.value+coreCost<=limit && Math.abs(targetValue-(candidate.value+coreCost))<Math.abs(targetValue-candidate.value)) candidateAddCoreUnit(candidate,entry,weapon);
  return candidate;
}
function bestGeneratedValueCandidate(entry,weapon,targetValue,rarity="Common",rolledCaps=null){
  let best=null,bestScore=Infinity;
  for(let i=0;i<72;i++){
    const c=buildGeneratedValueCandidate(entry,weapon,targetValue,rarity,rolledCaps);
    const miss=Math.abs(c.value-targetValue),outside=miss>targetValue*GENERATED_VALUE_TOLERANCE?targetValue:0;
    // Slightly prefer packages with at least one live affix when the slot can roll
    // one, but never enough to choose a materially worse power match.
    const diversity=allowedGeneratedAffixes(entry).length && !Object.keys(c.affixes).length ? targetValue*0.012 : 0;
    const score=miss+outside+diversity;
    if(score<bestScore){bestScore=score;best=cloneGeneratedCandidate(c);}
  }
  return best||buildGeneratedValueCandidate(entry,weapon,targetValue,rarity,rolledCaps);
}
function generateProceduralEquipment(depth=S?.depth||0,sourceKey=""){
  const d=Math.max(0,Number(depth)||0),rarity=rollEquipmentRarity(d);
  const entry=generatedWeightedPick(GENERATED_DROP_FAMILIES,e=>generatedFamilyWeight(e,sourceKey));
  const targetIlvl=generatedTargetItemLevel(d,rarity);
  let weapon=null;
  if(entry.kind==="weapon") weapon=generatedWeightedPick(GENERATED_WEAPON_FAMILIES);
  const coef=generatedSlotCoefficient(entry,weapon),targetValue=intrinsicValueFromLevel(targetIlvl,coef);
  // Crit has a hard slot ceiling, but rarity controls how likely this particular
  // item is to roll toward that ceiling. The rolled cap is chosen once per item
  // so the 72 best-fit candidates cannot brute-force every eligible piece to max.
  const critDef=EQUIPMENT_AFFIXES.crit;
  const critEligible=allowedGeneratedAffixes(entry).some(def=>def.id==="crit");
  const critHardUnits=Math.max(0,Math.round(generatedCritHardCapPct(rarity,entry,weapon)/CRIT_AFFIX_STEP_PCT));
  const rolledCaps=critEligible?{crit:rolledCritMaxUnits(rarity,critHardUnits)}:null;
  const pkg=bestGeneratedValueCandidate(entry,weapon,targetValue,rarity,rolledCaps);
  let item;
  if(entry.kind==="weapon"){
    item={kind:"weapon",base:weapon.base,family:weapon.family,stat:weapon.stat,hands:weapon.hands,greatWeapon:!!weapon.greatWeapon,slot:"rightHand",slots:["rightHand"],weaponContribution:Number(pkg.weaponContribution.toFixed(1)),affixes:pkg.affixes};
  }else if(entry.kind==="armor"){
    item={kind:"armor",base:entry.base,family:entry.family||"armor",slot:entry.slot,slots:[...entry.slots],armor:pkg.armor,affixes:pkg.affixes};
  }else{
    item={kind:"attributes",base:entry.base,family:entry.family||entry.id,slot:entry.slot,slots:[...entry.slots],attributes:pkg.attributes,affixes:pkg.affixes};
  }
  const id=generatedInstanceId(),intrinsic=Math.max(0,Number(pkg.value.toFixed(2)));
  item.id=id;item.generated=true;item.generatedDepth=Number(d.toFixed(1));item.rarity=rarity;item.targetItemLevel=targetIlvl;item.targetIntrinsicValue=Number(targetValue.toFixed(2));
  item.intrinsicValue=intrinsic;item.itemLevel=Math.max(1,itemLevelFromIntrinsic(intrinsic,coef));
  item.goldValue=Math.max(0,Math.round(intrinsic*rarityMarketMultiplier(rarity)));
  item.name=generatedItemName(item.base,rarity,d);
  item.stats=generatedStatsLines(item);
  item.desc=`Procedural ${item.rarity} ${item.base.toLowerCase()} generated at ${formatDepth(d)} fathoms. Its finished properties contain ${Math.round(item.intrinsicValue)} Intrinsic Value; iLv is derived from that actual package.`;
  return item;
}
function addGeneratedEquipment(item){
  if(!S||!item?.id) return null;
  stampItemEconomy(item,{recalculateGeneratedIlvl:!!item.generated});
  S.generatedItems=S.generatedItems||{};
  S.generatedItems[item.id]=cloneForSave(item);
  addEquipmentToBag(item.id);
  return item.id;
}
function grantAuthoredEquipmentInstance(templateId){
  const template=EQUIPMENT_ITEMS[templateId];
  if(!S||!template)return null;
  const id=generatedInstanceId(),item=cloneForSave(template);
  item.id=id;item.generated=false;item.authoredReward=true;stampItemEconomy(item);
  S.generatedItems=S.generatedItems||{};S.generatedItems[id]=item;addEquipmentToBag(id);
  return {id,name:item.name};
}

function equipmentItemDef(id){ return EQUIPMENT_ITEMS[id] || S?.generatedItems?.[id] || null; }
function equipmentItemLevel(id){ return Number(equipmentItemDef(id)?.itemLevel)||0; }
function equipmentItemIntrinsicValue(id){ return computedIntrinsicValue(equipmentItemDef(id)); }
function equipmentItemGoldValue(id){ return computedItemGoldValue(equipmentItemDef(id)); }
function equipmentAffixTotalsFor(equipmentState=S?.equipment){
  const out={crit:{pct:0},bossDamage:{pct:0,bonusCap:0},reflect:{pct:0,damageCap:0},lifesteal:{pct:0,healCap:0}};
  if(!equipmentState)return out;
  for(const slot of EQUIPMENT_SLOT_ORDER){
    if(slot==="leftHand"&&equipmentItemUsesBothHands(equipmentState.rightHand))continue;
    const item=equipmentItemDef(equipmentState[slot]),a=item?.affixes||{};
    if(a.crit){
      let pct=Number(a.crit.pct)||0;
      if(slot==="leftHand"&&item?.family==="dagger")pct=Math.min(pct,offhandDaggerCritCapPct(item.rarity||"Common"));
      out.crit.pct+=pct;
    }
    if(a.bossDamage){out.bossDamage.pct+=Number(a.bossDamage.pct)||0;out.bossDamage.bonusCap+=Number(a.bossDamage.bonusCap)||0;}
    if(a.reflect){out.reflect.pct+=Number(a.reflect.pct)||0;out.reflect.damageCap+=Number(a.reflect.damageCap)||0;}
    if(a.lifesteal){out.lifesteal.pct+=Number(a.lifesteal.pct)||0;out.lifesteal.healCap+=Number(a.lifesteal.healCap)||0;}
  }
  return out;
}

function equipmentAffixTotals(){ return equipmentAffixTotalsFor(S?.equipment); }
function equipmentItemArmor(id){
  const def=equipmentItemDef(id); if(!def) return 0;
  if(Number.isFinite(Number(def.armor))) return Math.max(0,Number(def.armor));
  for(const stat of def.stats||[]){ const m=String(stat).match(/^Armor\s*\+(\d+(?:\.\d+)?)/i); if(m) return Number(m[1])||0; }
  return 0;
}
function equipmentArmorFor(equipmentState=S?.equipment){
  if(!equipmentState) return 0;
  let total=0;
  for(const slot of EQUIPMENT_SLOT_ORDER){
    if(slot==="leftHand" && equipmentItemUsesBothHands(equipmentState.rightHand)) continue;
    total+=equipmentItemArmor(equipmentState[slot]);
  }
  return total;
}
function physicalDamageReductionFromArmor(actualArmor,expectedArmor){
  const expected=Math.max(0.0001,Number(expectedArmor)||0.0001);
  const r=Math.max(0,Number(actualArmor)||0)/expected;
  return r<=0?0:r/(r+ARMOR_CURVE_CONSTANT);
}
function armorMitigationFor(equipmentState=S?.equipment,depth=S?.depth||0){
  return physicalDamageReductionFromArmor(equipmentArmorFor(equipmentState),expectedMediumArmorAtDepth(depth));
}
function armorMitigation(){ return armorMitigationFor(S?.equipment,S?.depth||0); }
function foeArmorRating(foe=S?.foe,depth=S?.depth||0){
  const rawProfile=Number(foe?.profile?.armorProfile);
  const profile=Math.max(0,Number.isFinite(rawProfile)?rawProfile:1);
  return expectedMediumArmorAtDepth(depth)*profile;
}
function foeArmorMitigation(foe=S?.foe,depth=S?.depth||0){
  return physicalDamageReductionFromArmor(foeArmorRating(foe,depth),expectedMediumArmorAtDepth(depth));
}
function mitigateDamageByType(damage,{damageType="physical",armor=0,expectedArmor=expectedMediumArmorAtDepth(S?.depth||0)}={}){
  const raw=Math.max(0,Number(damage)||0);
  if(String(damageType||"physical").toLowerCase()!=="physical")return raw;
  return raw*(1-physicalDamageReductionFromArmor(armor,expectedArmor));
}
function equipmentItemUsesBothHands(id){ const d=equipmentItemDef(id); return !!d && (d.hands===2 || d.greatWeapon===true); }
const STARTING_LOADOUTS = Object.freeze({
  Votary:Object.freeze([
    Object.freeze({id:"sword-shield",label:"Sword + Buckler",sub:"Salvage Longsword · Salvage Buckler",main:"salvage_longsword",off:"salvage_buckler"}),
    Object.freeze({id:"greatsword",label:"Two-handed Greatsword",sub:"Salvage Greatsword · Off Hand occupied",main:"salvage_greatsword",off:null})
  ]),
  Rogue:Object.freeze([
    Object.freeze({id:"dagger-shield",label:"Dagger + Buckler",sub:"Salvage Dagger · Salvage Buckler",main:"salvage_dagger",off:"salvage_buckler"}),
    Object.freeze({id:"shortbow",label:"Two-handed Shortbow",sub:"Salvage Shortbow · dual-wield attacks are deferred",main:"salvage_shortbow",off:null})
  ]),
  Wizard:Object.freeze([
    Object.freeze({id:"wand-shield",label:"Wand + Buckler",sub:"Salvage Wand · Salvage Buckler",main:"salvage_wand",off:"salvage_buckler"}),
    Object.freeze({id:"staff",label:"Two-handed Wooden Staff",sub:"Salvage Wooden Staff · Off Hand occupied",main:"salvage_staff",off:null})
  ])
});
function startingLoadoutOptions(cls){ return STARTING_LOADOUTS[cls]||STARTING_LOADOUTS.Votary; }
function startingLoadoutDef(cls,id){ return startingLoadoutOptions(cls).find(opt=>opt.id===id)||startingLoadoutOptions(cls)[0]; }
function startingEquipmentLoadout(cls,weaponId=null,loadoutId=null){
  const choice=startingLoadoutDef(cls,loadoutId);
  const main=weaponId&&GEAR_ITEMS[weaponId]?weaponId:choice.main;
  const off=equipmentItemUsesBothHands(main)?null:choice.off;
  return {
    rightHand:main,leftHand:off,light:null,hat:null,cape:null,
    earLeft:null,necklace:null,earRight:null,top:"salvage_top",gloves:null,
    bottoms:"salvage_bottoms",belt:null,boots:"salvage_boots",ring1:null,ring2:null,ring3:null,ring4:null
  };
}
function startingEquipmentBackpack(){ return []; }


const DROP_HINTS = {
  cutter:["Bandages","meat scraps","simple weapons"],
  scrounger:["Rogue Tools","keys","Camp Supplies"],
  skitter:["meat scraps","light gear","Bandages"],
  shieldback:["Bandages","shields","heavy gear"],
  mauler:["heavy weapons","meat scraps","Camp Supplies"],
  oldhand:["keys","better weapons","unusual trinkets"],
  warren_boss:["stratum reward","better equipment","unusual trinkets"]
};

// Authored equipment definitions above remain valid for old chronicles, starters, bosses and special rewards.
function ownsEquipmentItem(id){
  return !!id && (S?.inventory?.equipment?.includes(id) || Object.values(S?.equipment||{}).includes(id));
}
function maybeEquipmentLoot(f){
  if(!S||!f||f.boss||f.mimic) return null;
  const key=f.key||f.profile?.id;
  const chance=key==="oldhand"?.36:key==="shieldback"||key==="mauler"?.30:.24;
  if(rnd()>=chance) return null;
  const item=generateProceduralEquipment(S.depth,key);
  if(!item) return null;
  addGeneratedEquipment(item);
  S._lootFoundCurrent.push(`${item.name} · ${item.rarity} · iLv ${item.itemLevel} · ${formatGold(computedItemGoldValue(item))}`);
  return item.id;
}
function stratumBossEquipmentReward(){
  const def=equippedWeaponDef(), two=Number(def?.hands||1)===2;
  const byClass={
    Votary:two?"warren_epic_greatsword":"warren_epic_longsword",
    Rogue:two?"warren_epic_bow":"warren_epic_dagger",
    Wizard:two?"warren_epic_staff":"warren_epic_wand"
  };
  return byClass[S?.className]||"warren_epic_longsword";
}

const LANG_DICT = {Cor:"I", amina:"want", mi:"one", mattra:"meat", keth:"open", sava:"blood"};
const ALTAR_SENTENCE = ["Cor","amina","mi","mattra"];

const BOSS_PROFILE = {
  id:"warren_boss", name:"prototype warren boss", unlock:0, hp:78, atk:9, xp:32, danger:3, awareness:40, speed:95,
  intents:{quick:30,heavy:25,dodge:10,guard:25,recover:10}, recoverAt:0.35,
  hurtIntents:{quick:20,heavy:50,dodge:5,guard:10,recover:15}, hurtAt:0.50,
  weakness:{id:"rage_opening",txt:"Its second wind becomes reckless. Heavy commitment is easier to punish once it is bloodied.",eff:{counterBonus:1.40,offBalanceBonus:1.40}}
};
const MID_BOSS_PROFILE={
  id:"warren_shaman",name:"goblin depth-shaman",unlock:0,hp:62,atk:8,xp:26,danger:3,awareness:32,speed:100,
  intents:{quick:18,heavy:22,dodge:12,guard:14,recover:34},recoverAt:.62,
  hurtIntents:{quick:24,heavy:32,dodge:8,guard:12,recover:24},hurtAt:.5,
  weakness:{id:"broken_ritual",txt:"Pressure interrupts its ritual recovery and leaves it exposed.",eff:{counterBonus:1.25}}
};
// v0.203.12: the 250-fathom encounter is no longer a bespoke chamber
// monster. Each run/stratum chooses one ordinary goblin species and promotes
// that exact species into a tougher, visibly larger roaming mini-boss.
function midBossVariantProfile(stratum=0){
  if(!S)return MID_BOSS_PROFILE;
  const st=Math.max(0,Math.floor(Number(stratum)||0)),depth=midBossDepthForStratum(st);
  S.midBossVariants=S.midBossVariants||{};
  const pool=FOES.filter(f=>depth>=Number(f.unlock||0));
  let base=FOES.find(f=>f.id===S.midBossVariants[st] && pool.some(p=>p.id===f.id));
  if(!base){base=pool.length?pool[ri(0,pool.length-1)]:FOES[0];S.midBossVariants[st]=base.id;}
  return {...base,
    name:`oversized ${base.name}`,
    hp:Math.max(54,Math.round(base.hp*1.65)),
    atk:Math.max(8,Math.round(base.atk*1.18)),
    xp:Math.max(26,Math.round(base.xp*1.8)),
    danger:Math.max(3,(Number(base.danger)||0)+2),
    awareness:Math.max(28,Number(base.awareness)||0),
    speed:Math.max(100,Number(base.speed)||100)
  };
}

const UNARMED_WEAPON = Object.freeze({name:"Unarmed",stat:"STR",itemLevel:0,rarity:"Common",family:"unarmed",hands:1,unarmed:true,weaponContribution:1,desc:"No Main Hand weapon equipped."});
function classDef(){ return CLASS_DEFS[S?.className] || CLASS_DEFS.Votary; }
function classAbilityOrder(){ const base=S ? classDef().abilities : CLASS_DEFS.Votary.abilities; return [...new Set([...base,...UNIVERSAL_ABILITY_IDS])]; }
function proficiencyBonus(id){ return S?.proficiencies?.[id] || 0; }
function equippedWeaponDef(){
  const hasEquipment=!!S?.equipment && Object.prototype.hasOwnProperty.call(S.equipment,"rightHand");
  const id=hasEquipment?S.equipment.rightHand:S?.equippedWeapon;
  return equipmentItemDef(id) || UNARMED_WEAPON;
}
function attackStatKey(){ return equippedWeaponDef().stat || "STR"; }
function weaponContribution(def=equippedWeaponDef()){
  if(def?.unarmed) return Number(def.weaponContribution)||1;
  if(Number.isFinite(Number(def?.weaponContribution))) return Number(def.weaponContribution);
  const handUnits=Number(def?.hands||1)===2?2:1;
  return intrinsicValueFromLevel(def?.itemLevel||0,handUnits)/WEAPON_VALUE_COST;
}
function attackStatValue(){ const key=attackStatKey(); return effectiveStat(key) || 10; }
function weaponAttackBase(def=equippedWeaponDef(),statValue=attackStatValue()){ return 0.5*statValue + weaponContribution(def); }
function attackScaleLabel(){ return `${attackStatKey()} + weapon`; }
function weaponDefForEquipment(equipmentState=S?.equipment){
  const id=equipmentState?.rightHand; return equipmentItemDef(id)||UNARMED_WEAPON;
}
function weaponAttackBaseForEquipment(equipmentState=S?.equipment){
  const def=weaponDefForEquipment(equipmentState), key=def.stat||"STR";
  return 0.5*(effectiveStatForEquipment(key,equipmentState)||10)+weaponContribution(def);
}

/* ============================================================
   v0.204.0 — OVERWORLD COMBAT FOUNDATION

   Ordinary physical-world enemies now use a continuous attack heartbeat rather
   than the legacy 3-Stamina/d20 turn screen. The three resources are universal:
   the equipped weapon decides which one is PRIMARY, not which resources exist.
   Legacy/modal encounters remain available during the migration.
   ============================================================ */
const WORLD_COMBAT_RESOURCE_MAX=100;
const WORLD_COMBAT_GUARD_COST=35;
const WORLD_COMBAT_GUARD_REDUCTION=.60;
const WORLD_COMBAT_GUARD_MS=2600;
const WORLD_COMBAT_ENERGY_REGEN_ACTIVE=10;
const WORLD_COMBAT_ENERGY_REGEN_IDLE=18;
const WORLD_COMBAT_ENERGY_REGEN_SECONDARY_ACTIVE=5;
const WORLD_COMBAT_ENERGY_REGEN_SECONDARY_IDLE=10;
const WORLD_COMBAT_MANA_REGEN=0.50;
const WORLD_COMBAT_MANA_REGEN_PRIMARY=1.50;
const WORLD_COMBAT_FOCUS_DECAY_IDLE=6;
const WORLD_COMBAT_FOCUS_GAIN=8;
const WORLD_COMBAT_FOCUS_GAIN_PRIMARY=18;
const WORLD_COMBAT_ENERGY_POWER_COST=60;
const WORLD_COMBAT_ENERGY_REFUND=0; // Immediate Heavy: no on-hit refund in this playtest.
const WORLD_COMBAT_MANA_POWER_COST=30;
const WORLD_COMBAT_FOCUS_MIN_FINISHER=40;
// v0.204.0.12: melee reach is now a weapon-family rule rather than a debug
// slider. Reach is measured surface-to-surface between combat bodies. Daggers
// are deliberately tight, ordinary melee shares one readable distance, and
// Great Weapons receive the longer reach identity discussed for the family.
const WORLD_COMBAT_DAGGER_REACH=15;
const WORLD_COMBAT_STANDARD_MELEE_REACH=20;
const WORLD_COMBAT_GREAT_WEAPON_REACH=25;
const WORLD_COMBAT_REACH_BONUS=12;
const WORLD_COMBAT_ENEMY_MELEE_REACH=10;
const WORLD_COMBAT_MELEE_FAMILIES=new Set(["unarmed","dagger","sword","axe","shortsword","greatsword"]);

function ensureWorldCombatResources(state=S){
  if(!state)return {energy:0,focus:0,mana:0};
  if(!state.combatResources||typeof state.combatResources!=="object")state.combatResources={energy:WORLD_COMBAT_RESOURCE_MAX,focus:0,mana:WORLD_COMBAT_RESOURCE_MAX};
  for(const key of ["energy","focus","mana"]){
    const fallback=key==="focus"?0:WORLD_COMBAT_RESOURCE_MAX;
    const n=Number(state.combatResources[key]);
    state.combatResources[key]=clamp(Number.isFinite(n)?n:fallback,0,WORLD_COMBAT_RESOURCE_MAX);
  }
  if(!Number.isFinite(Number(state.worldCombatGuardUntil)))state.worldCombatGuardUntil=0;
  // v0.204.1.3 retires the old delayed power queue. If a save was made while
  // a power was reserved, return the spent resource exactly once instead of
  // silently eating it or carrying stale queue state into the new model.
  const stale=state.worldCombatQueuedPower;
  if(stale&&typeof stale==="object"){
    const key=String(stale.resource||"");
    const spent=Math.max(0,Number(stale.spent)||0);
    if(["energy","focus","mana"].includes(key)&&spent>0)state.combatResources[key]=Math.min(WORLD_COMBAT_RESOURCE_MAX,(Number(state.combatResources[key])||0)+spent);
    state.worldCombatQueuedPower=null;
  }else if(stale)state.worldCombatQueuedPower=null;
  return state.combatResources;
}
function weaponPrimaryResource(def=equippedWeaponDef()){
  const family=String(def?.family||"unarmed");
  if(["dagger","shortsword","bow"].includes(family))return "focus";
  if(["wand","staff"].includes(family))return "mana";
  return "energy";
}
function weaponWorldRange(def=equippedWeaponDef()){
  const family=String(def?.family||"unarmed");
  if(WORLD_COMBAT_MELEE_FAMILIES.has(family)){
    let base=WORLD_COMBAT_STANDARD_MELEE_REACH;
    if(family==="dagger")base=WORLD_COMBAT_DAGGER_REACH;
    else if(def?.greatWeapon||family==="greatsword")base=WORLD_COMBAT_GREAT_WEAPON_REACH;
    // Preserve the authored Reach hook for future exceptional weapons. Great
    // Weapons already get their family reach, so this is an additional property.
    const authoredReach=def?.reach===true?WORLD_COMBAT_REACH_BONUS:Math.max(0,Number(def?.reach)||0);
    return base+authoredReach;
  }
  return ({staff:42,wand:112,bow:150})[family]||WORLD_COMBAT_STANDARD_MELEE_REACH;
}
// Compatibility helpers retained for older bridge/save code. Fixed family reach
// no longer accepts a global runtime override.
function setWorldCombatMeleeReach(){return weaponWorldRange();}
function getWorldCombatMeleeReach(){return weaponWorldRange();}

function weaponWorldAttackIntervalMs(def=equippedWeaponDef()){
  return Math.round(1800*(100/Math.max(45,weaponCombatSpeed(def))));
}
function enemyWorldAttackIntervalMs(foe=S?.foe){
  return Math.round(2100*(100/Math.max(55,foeCombatSpeed(foe))));
}
function worldCombatNormalizedHitChance(attackRating,defenceRating){
  const a=Math.max(0,Number(attackRating)||0)/D20_ATTACK_BASELINE_RATING;
  const d=Math.max(0,Number(defenceRating)||0)/D20_DEFENCE_BASELINE_RATING;
  if(a<=0)return d<=0?0.50:0.02;
  if(d<=0)return 0.98;
  const chance=1/(1+Math.pow(d/(1.5*a),2.2));
  return clamp(chance,.02,.98);
}
function worldCombatPlayerHitChance(){return worldCombatNormalizedHitChance(playerAttackRating(),foeDefenceRating(S?.foe));}
function worldCombatEnemyHitChance(){return worldCombatNormalizedHitChance(foeAttackRating(S?.foe),playerDefenceRating());}
function worldCombatRollDamage(maxHit,{minFrac=.40,mult=1}={}){
  const hi=Math.max(1,Math.round((Number(maxHit)||1)*Math.max(.1,Number(mult)||1))),lo=Math.max(1,Math.floor(hi*clamp(minFrac,.05,.95)));
  return hi<=lo?hi:ri(lo,hi);
}
function worldCombatPowerSpec(){
  const primary=weaponPrimaryResource(),family=equippedWeaponDef()?.family||"unarmed";
  if(primary==="focus"){
    const focus=ensureWorldCombatResources().focus;
    const spend=focus>=WORLD_COMBAT_FOCUS_MIN_FINISHER?focus:0;
    return {primary,label:family==="bow"?"Aimed Finisher":"Finisher",cost:spend,minCost:WORLD_COMBAT_FOCUS_MIN_FINISHER,mult:spend?1.5+spend/100:1.5,refund:0};
  }
  if(primary==="mana")return {primary,label:"Arcane Bolt",cost:WORLD_COMBAT_MANA_POWER_COST,minCost:WORLD_COMBAT_MANA_POWER_COST,mult:2.0,refund:0};
  return {primary,label:"Heavy",cost:WORLD_COMBAT_ENERGY_POWER_COST,minCost:WORLD_COMBAT_ENERGY_POWER_COST,mult:1.8,refund:WORLD_COMBAT_ENERGY_REFUND};
}
function worldCombatResourceSnapshot(){
  const r=ensureWorldCombatResources(),primary=weaponPrimaryResource(),spec=worldCombatPowerSpec();
  return {
    energy:{value:r.energy,max:WORLD_COMBAT_RESOURCE_MAX},focus:{value:r.focus,max:WORLD_COMBAT_RESOURCE_MAX},mana:{value:r.mana,max:WORLD_COMBAT_RESOURCE_MAX},
    primary,power:{label:spec.label,cost:spec.cost,minCost:spec.minCost,resource:spec.primary,queued:false,immediate:true},
    guard:{cost:WORLD_COMBAT_GUARD_COST,active:Number(S?.worldCombatGuardUntil||0)>Date.now()},
    weapon:{family:equippedWeaponDef()?.family||"unarmed",name:equippedWeaponDef()?.name||"Unarmed",range:weaponWorldRange(),attackIntervalMs:weaponWorldAttackIntervalMs()},
    enemy:S?.foe?{attackIntervalMs:enemyWorldAttackIntervalMs(S.foe),range:WORLD_COMBAT_ENEMY_MELEE_REACH,moveSpeed:clamp(60+(foeCombatSpeed(S.foe)-100)*.22,50,84),heavyChance:clamp((Number(S.foe.profile?.intents?.heavy)||0)/Math.max(1,Object.values(S.foe.profile?.intents||{}).reduce((a,v)=>a+(Number(v)||0),0)),.05,.55)}:null,
    chances:S?.foe?{player:worldCombatPlayerHitChance(),enemy:worldCombatEnemyHitChance()}:null
  };
}
function tickWorldCombatResources(ms=0,inCombat=!!S?.foe?.worldRealtime){
  if(!S||over)return false;
  const r=ensureWorldCombatResources(),dt=Math.max(0,Math.min(1000,Number(ms)||0))/1000;if(dt<=0)return false;
  const primary=weaponPrimaryResource();
  const energyRate=primary==="energy"?(inCombat?WORLD_COMBAT_ENERGY_REGEN_ACTIVE:WORLD_COMBAT_ENERGY_REGEN_IDLE):(inCombat?WORLD_COMBAT_ENERGY_REGEN_SECONDARY_ACTIVE:WORLD_COMBAT_ENERGY_REGEN_SECONDARY_IDLE);
  const manaRate=primary==="mana"?WORLD_COMBAT_MANA_REGEN_PRIMARY:WORLD_COMBAT_MANA_REGEN;
  r.energy=Math.min(WORLD_COMBAT_RESOURCE_MAX,r.energy+energyRate*dt);
  r.mana=Math.min(WORLD_COMBAT_RESOURCE_MAX,r.mana+manaRate*dt);
  if(!inCombat)r.focus=Math.max(0,r.focus-WORLD_COMBAT_FOCUS_DECAY_IDLE*dt);
  return true;
}
function worldCombatApplyOutgoing(base,{critical=false,damageType="physical"}={}){
  const foe=S?.foe,baseDamage=Math.max(0,Math.round(Number(base)||0));
  if(!foe||baseDamage<=0)return {damage:0,critical:false};
  const totals=equipmentAffixTotals();
  let rawDamage=critical?legacyCriticalDamageFromBase(baseDamage):baseDamage,bossBonus=0,heal=0;
  if(foe.boss&&totals.bossDamage.pct>0){bossBonus=Math.min(totals.bossDamage.bonusCap,Math.max(0,Math.round(baseDamage*totals.bossDamage.pct/100)));rawDamage+=bossBonus;}
  const reduction=String(damageType).toLowerCase()==="physical"?foeArmorMitigation(foe,S.depth):0;
  const mitigated=mitigateDamageByType(rawDamage,{damageType,armor:foeArmorRating(foe,S.depth),expectedArmor:expectedMediumArmorAtDepth(S.depth)});
  const damage=Math.max(1,Math.round(mitigated));
  if(totals.lifesteal.pct>0&&S.hp<S.hpMax){heal=Math.min(totals.lifesteal.healCap,Math.max(0,Math.floor(damage*totals.lifesteal.pct/100)));if(heal>0)S.hp=Math.min(S.hpMax,S.hp+heal);}
  return {damage,rawDamage:Math.round(rawDamage),critical:!!critical,bossBonus,heal,damageType,reduction};
}
function worldCombatQueuePower(){
  // Deprecated compatibility shim. The live bridge no longer queues powers;
  // keeping this explicit prevents old/stale callers from silently reserving
  // resources that may never be consumed.
  return {ok:false,reason:"Power queue retired"};
}
function worldCombatCancelQueuedPower({refund=false}={}){
  if(!S)return;
  if(refund&&S.worldCombatQueuedPower&&typeof S.worldCombatQueuedPower==="object"){
    // ensureWorldCombatResources owns the one-time migration/refund so there is
    // a single code path and no possibility of double-refunding stale queues.
    ensureWorldCombatResources();
    return;
  }
  S.worldCombatQueuedPower=null;
}
function worldCombatUsePower(){
  const f=S?.foe;if(!f?.worldRealtime||f.defeated||f.evading||over)return {ok:false,reason:"Unavailable"};
  // Defensive cleanup for any queue left by an older cached build. This is
  // normally already handled by ensureWorldCombatResources(), but keeping the
  // boundary explicit prevents old queue bugs from accumulating.
  worldCombatCancelQueuedPower({refund:true});
  const r=ensureWorldCombatResources(),spec=worldCombatPowerSpec(),available=Number(r[spec.primary])||0;
  if(available<spec.minCost)return {ok:false,reason:`Need ${Math.ceil(spec.minCost-available)} more ${cap(spec.primary)}`};
  const spend=spec.primary==="focus"?available:Math.max(0,Number(spec.cost)||0);
  r[spec.primary]=Math.max(0,available-spend);
  f.hostile=true;
  const mult=spec.primary==="focus"?1.5+spend/100:Math.max(.1,Number(spec.mult)||1);
  const hit=rnd()<worldCombatPlayerHitChance();
  if(!hit){requestRunSave();return {ok:true,hit:false,damage:0,critical:false,power:true,label:spec.label,spent,resource:spec.primary};}
  const baseMax=Math.max(1,Math.round(weaponAttackBase()*mult));
  const rolled=worldCombatRollDamage(baseMax,{minFrac:.50});
  const critical=rnd()<criticalChance()/100,damageType=spec.primary==="mana"?"magic":"physical",fx=worldCombatApplyOutgoing(rolled,{critical,damageType});
  f.hp-=fx.damage;
  const killed=f.hp<=0;
  if(killed)finishKill(`<p>${esc(spec.label)} lands for <b>${fx.damage}</b>${critical?" with a critical hit":""}.</p>`);
  else requestRunSave();
  return {ok:true,hit:true,damage:fx.damage,critical,power:true,label:spec.label,spent,resource:spec.primary,killed};
}
function worldCombatPlayerAttack(usePower=false){
  // Compatibility: an older bridge that still passes true gets the immediate
  // power resolver. The current bridge calls this only for automatic basics.
  if(usePower)return worldCombatUsePower();
  const f=S?.foe;if(!f?.worldRealtime||f.defeated||over)return {ok:false};f.hostile=true;
  const hit=rnd()<worldCombatPlayerHitChance();
  if(!hit){requestRunSave();return {ok:true,hit:false,damage:0,critical:false,power:false,label:"Basic"};}
  const r=ensureWorldCombatResources(),baseMax=Math.max(1,Math.round(weaponAttackBase()*0.80));
  const rolled=worldCombatRollDamage(baseMax,{minFrac:.75});
  const critical=rnd()<criticalChance()/100,fx=worldCombatApplyOutgoing(rolled,{critical,damageType:"physical"});
  f.hp-=fx.damage;
  const gain=weaponPrimaryResource()==="focus"?WORLD_COMBAT_FOCUS_GAIN_PRIMARY:WORLD_COMBAT_FOCUS_GAIN;
  r.focus=Math.min(WORLD_COMBAT_RESOURCE_MAX,r.focus+gain);
  const killed=f.hp<=0;
  if(killed)finishKill(`<p>${esc("Basic attack")} lands for <b>${fx.damage}</b>${critical?" with a critical hit":""}.</p>`);
  else requestRunSave();
  return {ok:true,hit:true,damage:fx.damage,critical,power:false,label:"Basic",focus:r.focus,killed};
}
function worldCombatGuard(){
  if(!S?.foe?.worldRealtime||S.foe.defeated||over)return {ok:false,reason:"Unavailable"};
  const r=ensureWorldCombatResources();if(r.energy<WORLD_COMBAT_GUARD_COST)return {ok:false,reason:`Need ${Math.ceil(WORLD_COMBAT_GUARD_COST-r.energy)} more Energy`};
  r.energy-=WORLD_COMBAT_GUARD_COST;S.worldCombatGuardUntil=Date.now()+WORLD_COMBAT_GUARD_MS;requestRunSave();
  return {ok:true,cost:WORLD_COMBAT_GUARD_COST,durationMs:WORLD_COMBAT_GUARD_MS,reduction:WORLD_COMBAT_GUARD_REDUCTION,attackDelayMs:500};
}
function worldCombatEnemyAttack({heavy=false}={}){
  const f=S?.foe;if(!f?.worldRealtime||f.defeated||over)return {ok:false};
  if(rnd()>=worldCombatEnemyHitChance())return {ok:true,hit:false,damage:0,heavy:!!heavy};
  const rawDamage=worldCombatRollDamage(f.atk,{minFrac:.60,mult:heavy?2.2:1});
  let damage=mitigateDamageByType(rawDamage,{damageType:"physical",armor:equipmentArmorFor(),expectedArmor:expectedMediumArmorAtDepth(S.depth)});
  const guarded=Number(S.worldCombatGuardUntil||0)>Date.now();
  if(guarded){damage=damage*(1-WORLD_COMBAT_GUARD_REDUCTION);S.worldCombatGuardUntil=0;}
  damage=Math.max(1,Math.round(damage));
  S.hp-=damage;
  const reflected=reflectedDamageFromHit(damage);if(reflected>0)f.hp-=reflected;
  if(S.hp<=0){die(`<p class="hurt">The ${esc(f.name)} ${heavy?"committed to a heavy blow":"struck"} for <b>${damage}</b>.</p>`);return {ok:true,hit:true,damage,heavy:!!heavy,guarded,dead:true,reflected};}
  if(f.hp<=0){finishKill(`<p class="good">Damage Reflect returns <b>${reflected}</b> and finishes the ${esc(f.name)}.</p>`);return {ok:true,hit:true,damage,heavy:!!heavy,guarded,killed:true,reflected};}
  requestRunSave();return {ok:true,hit:true,damage,heavy:!!heavy,guarded,reflected};
}
function worldCombatBeginEvade(){
  if(!S?.foe?.worldRealtime||S.foe.defeated)return false;
  // A queued technique has not fired yet. Breaking the leash cancels the
  // reservation instead of stealing the resource for an attack that never happened.
  worldCombatCancelQueuedPower({refund:true});S.worldCombatGuardUntil=0;S.foe.evading=true;S.foe.evadeStartedAt=Date.now();requestRunSave();return true;
}
function worldCombatEvadeHeal(ms=0){
  const f=S?.foe;if(!f?.worldRealtime||!f.evading||f.defeated)return false;
  const elapsed=Date.now()-Number(f.evadeStartedAt||Date.now());if(elapsed<1000)return false;
  const dt=Math.max(0,Math.min(1000,Number(ms)||0))/1000;f.hp=Math.min(f.hpMax,f.hp+f.hpMax*.25*dt);return true;
}
function worldCombatFinishEvade(){
  const f=S?.foe;if(!f?.worldRealtime||f.defeated)return false;
  f.hp=f.hpMax;travelLogAdd(`The <b>${esc(f.name)}</b> breaks pursuit and recovers in its territory.`,"note");
  const companionStillFollowing=temporaryCompanionActive();clearEnemyTurnTimer();
  worldCombatCancelQueuedPower({refund:true});
  S.foe=null;S.worldCombatGuardUntil=0;S.combatTimeline=null;S.combatActor="player";
  if(companionStillFollowing)companionLeaveCombat("It went back.");render();requestRunSave();return true;
}
function sideAreaActive(){ return SIDE_PASSAGE_EVENTS_ENABLED && !!S?.sideArea && !S.sideArea.paused && !S.sideArea.completed && !S.sideArea.abandoned; }
function curseActive(){ return !!S?.curse && (S.curse.remaining || 0) > 0; }
function trapDc(base=12){ return authoredChallenge(base); }
function sideDiscoveryDc(){ return sideDiscoveryChallenge(); }
function languageLine(){
  const known = new Set(S?.languageKnown || []);
  return ALTAR_SENTENCE.map(w => known.has(w) ? `<span class="known">${esc(LANG_DICT[w])}</span>` : esc(w)).join(" ");
}
function learnLanguageWord(){
  if(!S) return null;
  const known = new Set(S.languageKnown || []);
  const unknown = ALTAR_SENTENCE.filter(w => !known.has(w));
  if(!unknown.length) return null;
  const word = pick(unknown);
  S.languageKnown.push(word);
  return {word,meaning:LANG_DICT[word]};
}
function addMisc(name, qty=1){
  if(!S.inventory.misc) S.inventory.misc={};
  S.inventory.misc[name]=(S.inventory.misc[name]||0)+qty;
}
function addWeapon(itemId){
  if(!S?.inventory || !itemId || !equipmentItemDef(itemId)) return;
  // Equipment inventory is canonical. The old inventory.weapons mirror is retired.
  if(!S.inventory.equipment) S.inventory.equipment=[];
  if(S?.equipment?.rightHand!==itemId && !S.inventory.equipment.includes(itemId)) S.inventory.equipment.push(itemId);
}
function removePassageKey(){ if(S?.inventory) S.inventory.passageKey=null; }

// ----- Session 7.5 class creator helpers -----
creatorDraft.className = creatorDraft.className || null;

// Skill checks, creator flow and Ability UI are consolidated in their canonical definitions above.

// ----- dynamic class abilities -----
function classAbilityDisabled(id){
  const sk=abilityState(id); if(combatDiceBusy||!sk||sk.cur<=0||!S.foe||over||!playerTurnActive()) return true;
  if(["layonhands","mend"].includes(id)) return !!(S.abilityQuickUsed||S.hp>=S.hpMax);
  if((Number(S.stamina)||0)<PLAYER_TURN_STAMINA) return true;
  if(["holdfast","slip","ward"].includes(id) && enemyActionDescriptor()?.kind!=="attack") return true;
  return false;
}

function useQuickHeal(id, amount){
  const sk=abilityState(id); if(!playerTurnActive()||!sk||sk.cur<=0||S.abilityQuickUsed||S.hp>=S.hpMax) return;
  const before=S.hp; S.hp=Math.min(S.hpMax,S.hp+amount); const healed=S.hp-before; if(healed<=0)return;
  sk.cur--; S.abilityQuickUsed=true; closeAbilitySheet(); triggerHealFx(healed,["combat"]);
  say(`<p class="good"><b>${esc(abilityDisplayName(id))}.</b> Recovered <b>${healed}</b> HP.</p><p class="note">Quick-use ability: 0 Stamina; your Player Turn continues.</p>`); render();
}
function useNegateAbility(id, extraStamina=0){
  const sk=abilityState(id);
  if(classAbilityDisabled(id))return;
  sk.cur--;closeAbilitySheet();armed=null;
  S.stamina=0;S.strikeChain=0;S.defenceChain=0;S.defencePrepared=null;S.heavyCharge=0;
  S.negateNextAttack={name:abilityDisplayName(id),preserveHeavy:false};
  const out=`<p class="good"><b>${esc(abilityDisplayName(id))}.</b> Prepared to completely negate the forecast <b>${esc(enemyActionDescriptor()?.label||"attack")}</b> when it resolves.</p>`;
  finishPlayerStaminaTurn(out,id);
}

ACTIONS.feint={
  label:"Feint I",sub:"3 Stamina · DEX attack",cost:3,
  preview(){const d=Math.max(1,Math.round((effectiveStat("DEX")*1.35+2)*(foeGuardActive()?1.5:1)*openingBonus())),hit=Math.round(playerHitChanceForAction("feint")*100);return `<span class="dmg">${hit}% hit · ~${d} damage</span> · DEX${foeGuardActive()?` · <span class="dmg">Guard becomes +50% damage</span>`:""}${foeDodgeActive()?` · <span class="bad">Dodge Ready: +${FOE_DODGE_AC_BONUS} AC</span>`:""}`;},
  run(){const sk=abilityState("feint");if(!sk||sk.cur<=0)return `<p class="note">Feint is spent.</p>`;sk.cur--;const roll=playerAttackRollForAction("feint");let out=attackRollLog(roll,"Feint");if(!roll.hit){showCombatDamagePop("foe",0,{label:"MISS · 0 DAMAGE"});return out+`<p>The follow-up misses.</p>`;}const d=Math.max(1,Math.round((effectiveStat("DEX")*1.35+ri(0,4))*(foeGuardActive()?1.5:1)*openingBonus())),fx=applyOutgoingEquipmentEffects(d,{critical:roll.critical});S.foe.hp-=fx.damage;return out+`<p>Sold the wrong line and cut through the opening for <b>${fx.damage}</b>.</p>${fx.html}${foeGuardActive()?`<p class="good">Its Guard became the opening instead of the answer.</p>`:""}`;}
};
ACTIONS.dirtytrick={
  label:"Dirty Trick I",sub:"3 Stamina · light DEX + Blind",cost:3,
  preview(){const d=Math.max(1,Math.round(effectiveStat("DEX")*.8)),hit=Math.round(playerHitChanceForAction("dirtytrick")*100);return `<span class="dmg">${hit}% hit · ~${d} damage + Blinded</span> · DEX${foeDodgeActive()?` · <span class="bad">Dodge Ready: +${FOE_DODGE_AC_BONUS} AC</span>`:""}`;},
  run(){const sk=abilityState("dirtytrick");if(!sk||sk.cur<=0)return `<p class="note">Dirty Trick is spent.</p>`;sk.cur--;const roll=playerAttackRollForAction("dirtytrick");let out=attackRollLog(roll,"Dirty Trick");if(!roll.hit){showCombatDamagePop("foe",0,{label:"MISS · 0 DAMAGE"});return out+`<p>The trick misses and applies no Blind.</p>`;}let d=Math.max(1,Math.round((effectiveStat("DEX")*.8+ri(0,3))*openingBonus()));if(foeGuardActive())d=Math.max(1,Math.round(d*(1-INTENTS.guard.armour)));const fx=applyOutgoingEquipmentEffects(d,{critical:roll.critical});S.foe.hp-=fx.damage;S.foe.blinded=true;return out+`<p>Clipped the ${esc(S.foe.name)} for <b>${fx.damage}</b> and left it <b>Blinded</b>.</p>${fx.html}`;}
};
ACTIONS.arcbolt={
  label:"Arc Bolt I",sub:"3 Stamina · INT Arcane",cost:3,
  preview(){const d=Math.max(1,Math.round(effectiveStat("INT")*1.25+4)),hit=Math.round(playerHitChanceForAction("arcbolt")*100);return `<span class="dmg">${hit}% hit · ~${d} Arcane</span> · INT · ignores ordinary Guard${foeDodgeActive()?` · <span class="bad">Dodge Ready: +${FOE_DODGE_AC_BONUS} AC</span>`:""}`;},
  run(){const sk=abilityState("arcbolt");if(!sk||sk.cur<=0)return `<p class="note">Arc Bolt is spent.</p>`;sk.cur--;const roll=playerAttackRollForAction("arcbolt");let out=attackRollLog(roll,"Arc Bolt");if(!roll.hit){showCombatDamagePop("foe",0,{label:"MISS · 0 DAMAGE"});return out+`<p>The bolt tears through empty air.</p>`;}const d=Math.max(1,Math.round((effectiveStat("INT")*1.25+ri(2,6))*openingBonus())),fx=applyOutgoingEquipmentEffects(d,{critical:roll.critical});S.foe.hp-=fx.damage;return out+`<p>Arcane force struck the ${esc(S.foe.name)} for <b>${fx.damage}</b>.</p>${fx.html}${foeGuardActive()?`<p class="good">Its ordinary Guard did nothing against the spell.</p>`:""}`;}
};
// ----- class weapon scaling and defensive identity -----
// v0.080.11: class combat behavior is consolidated into the canonical combat functions above.

// ----- inventory -----
function useBandage(){
  if(encounterWarningActive() || !S || !S.bleeding || S.inventory.bandages<=0) return;
  if(S.foe){
    if(!playerTurnActive()||(Number(S.stamina)||0)<PLAYER_TURN_STAMINA)return;
    closePack();
    armed=null;
    takeTurn("bandage");
    return;
  }
  S.inventory.bandages--;
  clearBleeding();
  travelLogAdd(`Used a <b>Bandage</b>. Bleeding stopped.`,"good");
  renderPack();
  render();
}
ACTIONS.bandage={
  label:"Bandage",sub:"3 Stamina · consumes turn",cost:3,
  preview(){return "Use a Bandage to stop Bleeding. Consumes your turn.";},
  run(){
    if(!S.bleeding || S.inventory.bandages<=0) return `<p class="note">There is nothing to bandage.</p>`;
    S.inventory.bandages--;
    clearBleeding();
    S.heavyCharge=0;
    return `<p class="good">Bound the wound with a <b>Bandage</b>. <b>Bleeding stopped.</b></p>`;
  }
};
function equipWeapon(id){
  if(!GEAR_ITEMS[id]) return;
  equipEquipmentItem(id,"rightHand");
}

// Rest and Camp clear Bleeding because both are deliberate recovery actions.
// ----- Bestiary + class sheet -----

// ----- side passage event engine -----
function beginSideDiscovery(){
  if(!SIDE_PASSAGE_EVENTS_ENABLED)return false;
  if(!S||S.sideDiscoveryAttempted||S.sideAreaResolved)return false;
  nudgePendingMerchantFromDepth(S.depth,5);
  closePack();closeCharacterSheet();S.sideDiscoveryAttempted=true;S.travelSinceEvent=0;
  const challenge=sideDiscoveryChallenge(),c=runSkillCheck("perception",challenge),source=`side-discovery:${S.sideDiscoveryStratum??stratumIndex()}`,p=awardSkillPractice("perception",source,c),html=formatSkillCheck(c)+practiceText("perception",p);
  if(!c.success){
    S.sideAreaResolved=true;
    travelLogAdd(`Something about the wall almost catches your attention, then the route carries you past it.${practiceText("perception",p)}`,"note");
    render();return false;
  }
  pauseBoonClock();S.travelMode="stopped";
  S.travelEvent={id:"side-discovery",stage:"found",kind:"Perception",title:"A passage behind the stone",text:"A narrow route turns away from the main descent. Something about the air beyond it feels wrong.",rollHtml:html};
  travelLogAdd(`Perception passively reveals a <b>side passage</b>.`,"good");render();return true;
}
function rollSidePassageLength(){
  const r=rnd();
  if(r<.15)return 1;
  if(r<.45)return 2;
  if(r<.75)return 3;
  if(r<.95)return 4;
  return 5;
}
function createSideArea(){
  const sid=`side-${stratumIndex()}-${Math.floor(S.depth*10)}`,length=rollSidePassageLength();
  return {
    id:sid,name:"Cursed Side Passage",theme:"Cursed",entryDepth:S.depth,
    encountersNeeded:length,encountersDefeated:0,activity:0,elapsedMs:0,variedRoute:true,routeNodeActive:false,
    inscriptionSeen:true,trapSeen:true,endReached:false,keyDropped:false,
    keyId:`${sid}-key`,keyName:"Old Passage Key",completed:false,abandoned:false,
    wardCleared:false,lockAttempted:false,chestOpened:false,
    routeOffsets:generateSideRouteOffsets(),altarTranslationAttempted:false,altarTranslationResult:null,
    finaleType:length===5?"cache":pick(SIDE_FINALE_TYPES),puzzle:null,mimicStarted:false,mimicDefeated:false,damagedSalvageClaimed:false
  };
}
function enterSideArea(){
  if(!SIDE_PASSAGE_EVENTS_ENABLED)return false;
  S.sideArea=createSideArea();S.travelEvent=null;S.travelMode="side";S.travelSinceEvent=0;S.exploreActivity=0;resumeBoonClock();travelLogAdd(`You leave the main descent and enter a <b>Cursed Side Passage</b>. Your fathom depth stays at ${formatDepth(S.depth)}.`,"beat");render();
}
function exitSideArea(completed=false){
  const a=S.sideArea;
  if(!a) return;
  const entrance=a.entryDepth;
  const routeProgress=completed ? 1 : sideAreaRouteProgress(a);
  const routeOffsets=a.routeOffsets ? a.routeOffsets.map(p=>[...p]) : null;
  removePassageKey();
  a.completed=completed;
  a.abandoned=!completed;
  if(!S.sideAreaHistory) S.sideAreaHistory=[];
  S.sideAreaHistory.push({id:a.id,entryDepth:entrance,progress:routeProgress,completed,abandoned:!completed,routeOffsets});
  // Side areas are lateral excursions. No matter how long they took, returning
  // places the delver back on the exact fathom where the branch was entered.
  S.depth=entrance;
  S.exploreDepth=entrance;
  S.exploreElapsedMs=0;
  S.sideAreaResolved=true;
  S.travelEvent=null;
  S.travelMode="stopped";
  pauseBoonClock();
  travelLogAdd(completed
    ? `You return from the side passage to <b>${formatDepth(entrance)} fathoms</b>, carrying whatever you managed to claim.`
    : `You turn back to <b>${formatDepth(entrance)} fathoms</b> and abandon the side passage. Whatever remained deeper inside is lost.`,
    completed?"good":"note");
  S.sideArea=null;
  render();
}
function promptSideRetreat(){
  if(!sideAreaActive()||S.foe||S.travelEvent)return;pauseBoonClock();S.travelMode="stopped";S.travelEvent={id:"side-retreat",stage:"prompt",kind:S.sideArea.name,title:"Turn back?",text:"Leave the side passage and return to the main descent. Anything left deeper inside will be abandoned.",rollHtml:""};render();
}
function beginSideInscription(){
  const a=S.sideArea;if(!a||a.inscriptionSeen)return;a.inscriptionSeen=true;pauseBoonClock();S.travelMode="stopped";S.travelEvent={id:"side-inscription",stage:"prompt",kind:"Old inscription",title:"Words cut into the stone",text:"The same short phrase has been cut into several stones, as if someone expected it to matter later.",rollHtml:`<span class="inscription">${languageLine()}</span>`};render();
}
function beginSideTrap(){
  const a=S.sideArea;if(!a||a.trapSeen)return;a.trapSeen=true;pauseBoonClock();S.travelMode="stopped";S.travelEvent={id:"side-trap",stage:"sense",kind:"Uneasy footing",title:"Did you notice anything?",text:"The passage narrows. Dust lies strangely across the floor ahead.",rollHtml:""};render();
}
function triggerTrap(reason="The mechanism fires before you can stop it."){
  const dmg=Math.max(2,Math.round(3+S.depth/35+ri(0,3)));S.hp-=dmg;startBleeding();markCharacterNotice("status");flashTravelDamage();travelLogAdd(`A trap catches you for <b>${dmg} HP</b>. You are <b>Bleeding</b> for up to 30 seconds unless treated.`,"danger");
  if(S.hp<=0){S.travelEvent=null;return die(`<p class="hurt">${esc(reason)} It tore through you for <b>${dmg}</b>.</p>`);}
  S.travelEvent={id:"side-trap",stage:"result",kind:"Trap triggered",title:"The mechanism is spent",text:`${reason} The trap is now broken or discharged; there is nothing left to farm or retry.`,rollHtml:`<span class="bad">Lost ${dmg} HP · Bleeding</span>`};render();
}
function beginSideAltar(){
  const a=S?.sideArea;
  if(!a || S.travelEvent) return;
  const type=sideFinaleType();
  pauseBoonClock();
  S.travelMode="stopped";
  if(type==="cache"){
    S.travelEvent={id:"side-altar",stage:"altar",kind:"End chamber",title:"A chest and an altar",text:"A chest sits beneath an old altar. The same words you saw deeper in the passage are carved above it.",rollHtml:`<span class="inscription">${languageLine()}</span>`};
  }else if(type==="mimic"){
    S.travelEvent={id:"side-altar",stage:"mimic",kind:"End chamber",title:"A chest with no keyway",text:"A squat chest waits alone in the chamber. Its lid sits a little too neatly on the stone, and there is no visible lock.",rollHtml:""};
  }else{
    S.travelEvent={id:"side-altar",stage:"puzzle-warning",kind:"Arcane cache",title:"Five rotating seals",text:"The chest has no keyway. Five arcane seals turn around its lid. You need at least 3 successes to stabilize the ward. Failure triggers a magical backlash for 30% of Max HP, but this prototype will not let the backlash reduce you below 1 HP.",rollHtml:`<span class="bad">Dangerous attempt · five one-shot decisions · 3 successes required</span>`};
  }
  render();
}
function applyFrailty(){
  S.curse={id:"frailty",name:"Frailty",remaining:5,desc:"Take 5% more damage. Running or Withdrawing does not reduce the duration."};markCharacterNotice("status");travelLogAdd(`<b>Frailty.</b> For the next 5 completed encounters, you take 5% more damage.`,"danger");
}
function resolveOffering(kind){
  if(!S?.travelEvent||S.travelEvent.id!=="side-altar")return;
  let label=kind;
  if(kind==="meat"&&S.inventory.meat>0){S.inventory.meat--;S.sideArea.wardCleared=true;label="Meat";travelLogAdd(`The altar accepts <b>1 Meat</b>. The pressure around the chest lifts.`,"good");}
  else {
    if(kind==="bandage"&&S.inventory.bandages>0){S.inventory.bandages--;label="Bandage";}
    else if(kind==="rope"&&S.inventory.rope>0){S.inventory.rope--;label="Rope";}
    else if(kind==="water"&&S.inventory.water>0){S.inventory.water--;label="Water";}
    else if(kind.startsWith("misc:")){const n=kind.slice(5);if((S.inventory.misc[n]||0)>0){S.inventory.misc[n]--;label=n;}}
    else return;
    applyFrailty();travelLogAdd(`The altar rejects <b>${esc(label)}</b>. The ward settles onto you instead.`,"danger");
  }
  closePack();S.travelEvent={id:"side-altar",stage:"chest",kind:"End chamber",title:S.sideArea.wardCleared?"The ward is quiet":"The curse has already taken hold",text:"The chest remains locked. The altar is no longer the immediate problem.",rollHtml:""};render();
}
function openWardedChestDirect(){ if(!S.sideArea.wardCleared&&!curseActive())applyFrailty();S.travelEvent={id:"side-altar",stage:"chest",kind:"End chamber",title:"The chest remains",text:"Whatever guarded the altar has made its claim. Now only the lock stands between you and the contents.",rollHtml:""};render(); }
function grantChestReward(){
  const roll=ri(1,100);let text="";
  const grantDepthGear=(suffix="")=>{
    const rewardDepth=Math.max(0,Number(S.sideArea?.entryDepth??S.depth)+20),item=generateProceduralEquipment(rewardDepth,"side-cache");
    if(!item)return false;addGeneratedEquipment(item);text=`${item.name}${suffix} · iLv ${item.itemLevel}`;return true;
  };
  if(roll<=30){grantDepthGear(" (weapon or equipment cache)");}
  else if(roll<=50){grantDepthGear(" (specialized equipment)");}
  else if(roll<=60){grantDepthGear(" (protective equipment)");}
  else if(roll<=70){grantDepthGear(" (trinket cache)");}
  else {const choices=["bandage","meat","rope","water","offweapon","dust"],c=pick(choices);if(c==="bandage"){S.inventory.bandages+=2;text="2 Bandages";}else if(c==="meat"){S.inventory.meat+=2;text="2 Meat";}else if(c==="rope"){S.inventory.rope++;text="Rope";}else if(c==="water"){S.inventory.water++;text="Jug of Water";}else if(c==="offweapon"){grantDepthGear(" (weapon cache)");}else{addMisc("Scroll Dust",1);text="a scroll that crumbled into dust";}}
  if(!text){addMisc("Scroll Dust",1);text="Scroll Dust";}
  S.sideArea.chestOpened=true;travelLogAdd(`The chest yields <b>${esc(text)}</b>.`,"good");S.travelEvent={id:"side-altar",stage:"reward",kind:"Side passage complete",title:"The chest opens",text:`You recover ${text}. The route behind you is the only way back to the main descent.`,rollHtml:""};render();
}
async function attemptChestLock(){
  const a=S.sideArea;if(!a||a.lockAttempted)return;a.lockAttempted=true;const tool=S.inventory.rogueTools>0?2:0,check=await runActiveSkillCheck("sleight",trapDc(13),tool),practice=awardSkillPractice("sleight",`side-lock:${a.id}`,check);const html=formatSkillCheck(check)+practiceText("sleight",practice);
  if(check.success){S.travelEvent.rollHtml=html;grantChestReward();}else{S.travelEvent={id:"side-altar",stage:"jammed",kind:"Lock jammed",title:"The lock will not take another delicate attempt",text:"The pick slips and the old lock deforms. The mechanism is changed; you cannot repeat the same check.",rollHtml:html};render();}
}
async function forceChest(){
  const a=S.sideArea,check=await runActiveSkillCheck("athletics",trapDc(14),0),practice=awardSkillPractice("athletics",`side-force:${a.id}`,check),html=formatSkillCheck(check)+practiceText("athletics",practice);
  if(check.success){S.travelEvent.rollHtml=html;return grantChestReward();}
  const dmg=Math.max(1,ri(1,4));S.hp-=dmg;flashTravelDamage();
  travelLogAdd(`Forcing the chest costs <b>${dmg} HP</b>. The frame gives way badly and ruins the better contents.`,"danger");
  if(S.hp<=0){S.travelEvent=null;return die(`<p class="hurt">The ruined chest took the last of your strength.</p>`);}
  grantDamagedSalvage("The failed force attempt wrecks the lock and much of what was inside.");
}



// ----- travel, trap attrition and boss gate -----
function bleedSecondsRemaining(){ return Math.max(0,Math.ceil((Number(S?.bleedRemainingMs)||0)/1000)); }
function startBleeding(){
  if(!S)return;
  S.bleeding=true;S.bleedRemainingMs=BLEED_DURATION_MS;S.bleedAccumulatorMs=0;S.bleedCombatTurns=0;
}
function clearBleeding(){
  if(!S)return;
  S.bleeding=false;S.bleedRemainingMs=0;S.bleedAccumulatorMs=0;S.bleedCombatTurns=0;
}
function advanceBleeding(ms,context="travel"){
  if(!S?.bleeding)return {alive:true,damage:0,expired:false,html:""};
  const dt=Math.max(0,Number(ms)||0);
  S.bleedRemainingMs=Math.max(0,(Number(S.bleedRemainingMs)||BLEED_DURATION_MS)-dt);
  S.bleedAccumulatorMs=(Number(S.bleedAccumulatorMs)||0)+dt;
  let damage=0;
  while(S.bleeding && S.bleedAccumulatorMs>=BLEED_TICK_MS){
    S.bleedAccumulatorMs-=BLEED_TICK_MS;S.hp-=1;damage++;flashTravelDamage();
    if(S.hp<=0){die(`<p class="hurt">The wound kept opening until there was nothing left to give.</p>`);return {alive:false,damage,expired:false,html:""};}
  }
  const expired=S.bleedRemainingMs<=0;
  let html="";
  if(damage>0){
    if(context==="combat"){showCombatDamagePop("hero",damage);html+=`<p class="hurt">Bleeding costs <b>${damage} HP</b>.</p>`;}
    else travelLogAdd(`Bleeding costs <b>${damage} HP</b>. <b>${bleedSecondsRemaining()}s</b> remain.`,"danger");
  }
  if(expired){
    clearBleeding();
    if(context==="combat") html+=`<p class="good">The bleeding finally slows and stops.</p>`;
    else travelLogAdd(`The <b>Bleeding</b> finally slows and stops.`,"good");
  }
  return {alive:true,damage,expired,html};
}
function tickBleeding(){
  if(!S?.bleeding||S.foe||S.travelEvent||S.travelMode==="stopped")return true;
  return advanceBleeding(TRAVEL_TICK_MS,"travel").alive;
}
function tickCombatBleeding(){
  if(!S?.bleeding)return {alive:true,html:""};
  S.bleedCombatTurns=((Number(S.bleedCombatTurns)||0)+1)%2;
  const result=advanceBleeding(BLEED_COMBAT_TURN_MS,"combat");
  return result;
}
function sideHintChallenge(attempts=0){ return trapDc(11+Math.min(2,Math.max(0,Number(attempts)||0))); }
const SIDE_RIDDLES=Object.freeze([
  Object.freeze({q:"I have a mouth but never eat, a bed but never sleep, and I run without feet. What am I?",answers:["A river","A tunnel","A bell"],correct:0,hintSkill:"investigation",hints:["The answer can move constantly without having limbs.","Its ‘bed’ is a place it lies in rather than somewhere it sleeps.","Its mouth is where it empties into something larger."]}),
  Object.freeze({q:"The more of me you take, the more you leave behind. What am I?",answers:["Gold","Footsteps","Breath"],correct:1,hintSkill:"investigation",hints:["Think about what taking repeated steps creates behind you.","The thing left behind is evidence of movement, not an object you carried.","A trail can be made of these without anyone deliberately placing them."]}),
  Object.freeze({q:"An old-tongue inscription reads: ‘I grow smaller every time I work, yet without me the dark wins.’ What am I?",answers:["A candle","A blade","A rope"],correct:0,hintSkill:"translation",hints:["The old verb translated as ‘work’ also means ‘to spend oneself in service.’","The word rendered as ‘smaller’ carries the sense of being consumed from one end.","The final phrase uses ‘dark wins’ literally: the object exists to make light."]})
]);
async function attemptSideRiddleHint(){
  const a=S?.sideArea,r=a?.activeRiddle,ev=S?.travelEvent;if(!a||!r||ev?.id!=="side-route-riddle")return;
  r.hintAttempts=Math.max(0,Number(r.hintAttempts)||0);r.hintLog=Array.isArray(r.hintLog)?r.hintLog:[];
  if(r.hintAttempts>=(r.hints?.length||0))return;
  const idx=r.hintAttempts,skill=r.hintSkill||"investigation",challenge=sideHintChallenge(idx);
  const check=await runActiveSkillCheck(skill,challenge),practice=awardSkillPractice(skill,`side-riddle-hint:${a.id}:${a.encountersDefeated}:${idx}`,check);
  r.hintAttempts++;
  const result=formatSkillCheck(check)+practiceText(skill,practice);
  if(check.success){
    const hint=r.hints[idx];r.hintLog.push(`<span class="good"><b>Hint ${idx+1}:</b> ${esc(hint)}</span>`);
    ev.rollHtml=`${r.hintLog.join("<br>")}<br>${result}`;
  }else{
    r.hintLog.push(`<span class="note"><b>Hint ${idx+1}:</b> You cannot pull a trustworthy clue from it.</span>`);
    ev.rollHtml=`${r.hintLog.join("<br>")}<br>${result}`;
  }
  render();
}
async function attemptSideRoutePuzzleHint(){
  const a=S?.sideArea,h=a?.activeRoutePuzzle,ev=S?.travelEvent;if(!a||!h||ev?.id!=="side-route-puzzle")return;
  h.hintAttempts=Math.max(0,Number(h.hintAttempts)||0);h.hintLog=Array.isArray(h.hintLog)?h.hintLog:[];
  if(h.hintAttempts>=(h.hints?.length||0))return;
  const idx=h.hintAttempts,challenge=sideHintChallenge(idx),check=await runActiveSkillCheck("investigation",challenge),practice=awardSkillPractice("investigation",`side-route-mechanism-hint:${a.id}:${a.encountersDefeated}:${idx}`,check);
  h.hintAttempts++;
  const result=formatSkillCheck(check)+practiceText("investigation",practice);
  if(check.success)h.hintLog.push(`<span class="good"><b>Hint ${idx+1}:</b> ${esc(h.hints[idx])}</span>`);
  else h.hintLog.push(`<span class="note"><b>Hint ${idx+1}:</b> The mechanism does not give up another useful clue.</span>`);
  ev.rollHtml=`${h.hintLog.join("<br>")}<br>${result}`;render();
}
const SIDE_SHAMAN_PROFILE={id:"side_shaman",name:"goblin hex-shaman",unlock:0,hp:56,atk:8,xp:24,danger:3,awareness:24,intents:{quick:20,heavy:24,dodge:14,guard:12,recover:30},recoverAt:.6,weakness:{id:"ritual_break",txt:"Its hexes collapse when pressure denies it time to recover.",eff:{recoverPenalty:.4}}};
const SIDE_GUARDIAN_MIMIC={id:"side_guardian_mimic",name:"corridor mimic",unlock:0,hp:66,atk:9,xp:27,danger:3,awareness:18,intents:{quick:30,heavy:35,dodge:5,guard:20,recover:10},recoverAt:.3,weakness:{id:"hinge_tell",txt:"The false stone flexes at one seam before it lunges.",eff:{counterBonus:1.25}}};
function completeSideRouteStage(note=""){
  const a=S?.sideArea;if(!a)return;
  a.encountersDefeated=Math.min(a.encountersNeeded,(a.encountersDefeated||0)+1);a.activity=0;a.routeNodeActive=false;S.travelSinceEvent=0;
  if(note) travelLogAdd(note,"good");
  travelLogAdd(`Side passage progress: <b>${a.encountersDefeated}/${a.encountersNeeded} stages cleared</b>.`,"beat");
  if(a.encountersDefeated>=a.encountersNeeded)a.endReached=true;
}
function beginSideRiddle(){
  const a=S?.sideArea;if(!a)return;
  a.routeNodeActive=true;pauseBoonClock();S.travelMode="stopped";
  const r=pick(SIDE_RIDDLES);a.activeRiddle={q:r.q,answers:[...r.answers],correct:r.correct,hintSkill:r.hintSkill||"investigation",hints:[...(r.hints||[])],hintAttempts:0,hintLog:[]};
  S.travelEvent={id:"side-route-riddle",kind:"Passage riddle",title:"Three marks around a sealed door",text:r.q,rollHtml:"The scratches are fresh enough to be deliberate."};render();
}
function beginSidePuzzle(){
  const a=S?.sideArea;if(!a)return;
  a.routeNodeActive=true;pauseBoonClock();S.travelMode="stopped";
  a.activeRoutePuzzle={hintAttempts:0,hintLog:[],hints:["The counterweight is still carrying most of the slab's weight; the gate itself is not truly jammed.","The iron teeth form a ratchet. They are meant to lift in sequence rather than all at once.","The release can be worked from the protected side of the housing, avoiding the full load of the slab."]};
  S.travelEvent={id:"side-route-puzzle",kind:"Passage mechanism",title:"A counterweighted stone gate",text:"A slab blocks the passage. Its counterweight is intact, but the release is buried behind old iron teeth.",rollHtml:"Force it, understand it, or manipulate the mechanism. Hints are optional and do not resolve the gate."};render();
}
function beginSideRouteNode(){
  const a=S?.sideArea;if(!a||a.routeNodeActive)return;
  const next=(a.encountersDefeated||0)+1;
  a.routeNodeActive=true;a.activity=0;
  if(a.encountersNeeded===5 && next===5){
    const profile=rnd()<.55?SIDE_SHAMAN_PROFILE:SIDE_GUARDIAN_MIMIC;
    return nextFoe({side:true,boss:true,sideBoss:true,profile,bossStratum:stratumIndex(a.entryDepth)});
  }
  const r=rnd();
  if(r<.58) return nextFoe({side:true});
  if(r<.80) return beginSideRiddle();
  return beginSidePuzzle();
}
function sideTravelTick(){
  if(!SIDE_PASSAGE_EVENTS_ENABLED)return;
  if(!S||over||!sideAreaActive()||S.travelMode!=="side"||S.foe||S.travelEvent)return;
  checkBoonExpiry();S.travelSinceEvent+=TRAVEL_STEP;S.sideArea.activity+=TRAVEL_STEP;S.sideArea.elapsedMs=(S.sideArea.elapsedMs||0)+TRAVEL_TICK_MS;
  if(S.sideArea.variedRoute){
    if(S.sideArea.encountersDefeated>=S.sideArea.encountersNeeded){S.sideArea.endReached=true;return beginSideAltar();}
    if(!S.sideArea.routeNodeActive && S.sideArea.activity>=1.1) return beginSideRouteNode();
    renderTravel();renderCombatHeader();return;
  }
  if(!S.sideArea.inscriptionSeen&&S.sideArea.activity>=.75)return beginSideInscription();
  if(!S.sideArea.trapSeen&&S.sideArea.activity>=2.0)return beginSideTrap();
  if(S.sideArea.encountersDefeated>=S.sideArea.encountersNeeded){S.sideArea.endReached=true;return beginSideAltar();}
  if(S.travelSinceEvent>=2 && rnd()<travelInterruptionChance())return nextFoe({side:true});
  renderTravel();renderCombatHeader();
}

// ----- foe variants, loot, side progress, curse duration and boss resolution -----
function rollWorldGoblinLoot(f){
  const payload={gold:0,rogueTools:false,inventory:{meat:0,bandages:0,water:0,rope:0,campSupplies:0,scrollDust:0},equipment:[],questDrops:[]};
  const labels=[];
  if(!S||!f)return {payload,labels};
  let amount=0;
  if(rnd()<.58) amount=ri(1,5)+Math.max(0,Math.floor((Number(f.profile?.danger||f.danger||1)-1)*1.5))+Math.floor(depthGrowth(S.depth)/18);
  amount=Math.max(0,Math.round(amount));
  if(amount>0){payload.gold=amount;labels.push(formatGold(amount));}
  if(f.key==="scrounger"&&S.inventory.rogueTools<=0&&rnd()<.12){payload.rogueTools=true;labels.push("Rogue Tools");}
  if(rnd()<.34){
    const r=rnd();
    if(r<.38){payload.inventory.meat++;labels.push("Meat");}
    else if(r<.67){payload.inventory.bandages++;labels.push("Bandage");}
    else if(r<.78){payload.inventory.water++;labels.push("Jug of Water");}
    else if(r<.88){payload.inventory.rope++;labels.push("Rope");}
    else if(r<.96){payload.inventory.campSupplies++;labels.push("Camp Supply");}
    else {payload.inventory.scrollDust++;labels.push("Scroll Dust");}
  }
  if(rnd()<.035){payload.inventory.campSupplies++;labels.push("Camp Supply");}
  const key=f.key||f.profile?.id,chance=key==="oldhand"?.36:key==="shieldback"||key==="mauler"?.30:.24;
  if(rnd()<chance){
    const item=generateProceduralEquipment(S.depth,key);
    if(item){payload.equipment.push(item);labels.push(`${item.name} · ${item.rarity} · iLv ${item.itemLevel} · ${formatGold(computedItemGoldValue(item))}`);}
  }
  const eligible=eligibleQuestDropObjectives("combat");
  if(eligible.length){
    const pickRow=pick(eligible),dropChance=clamp(Number(pickRow.obj.combatChance)||0,0,1);
    if(rnd()<dropChance){
      const st=pickRow.inst.objectives[pickRow.obj.id],next=Math.min(st?.required||pickRow.obj.required||1,(st?.current||0)+1);
      payload.questDrops.push({instanceId:pickRow.inst.instanceId,objId:pickRow.obj.id,qty:1,itemName:pickRow.obj.item.name});
      labels.push(`${pickRow.obj.item.name} · Quest ${next}/${st?.required||pickRow.obj.required||1}`);
    }
  }
  return {payload,labels};
}
function claimWorldLootRecord(rec){
  if(!S||!rec||rec.worldClaimed!==false)return false;
  const p=rec.worldClaimPayload||{};
  S.gold=(S.gold||0)+Math.max(0,Math.round(Number(p.gold)||0));
  if(p.rogueTools&&S.inventory.rogueTools<=0)S.inventory.rogueTools=1;
  const inv=p.inventory||{};
  S.inventory.meat=(S.inventory.meat||0)+Math.max(0,Math.floor(Number(inv.meat)||0));
  S.inventory.bandages=(S.inventory.bandages||0)+Math.max(0,Math.floor(Number(inv.bandages)||0));
  S.inventory.water=(S.inventory.water||0)+Math.max(0,Math.floor(Number(inv.water)||0));
  S.inventory.rope=(S.inventory.rope||0)+Math.max(0,Math.floor(Number(inv.rope)||0));
  S.inventory.campSupplies=(S.inventory.campSupplies||0)+Math.max(0,Math.floor(Number(inv.campSupplies)||0));
  const dust=Math.max(0,Math.floor(Number(inv.scrollDust)||0));if(dust)addMisc("Scroll Dust",dust);
  for(const item of Array.isArray(p.equipment)?p.equipment:[]){if(item?.id&&!equipmentItemDef(item.id)){addGeneratedEquipment(item);markCharacterNotice("equipment");}}
  for(const q of Array.isArray(p.questDrops)?p.questDrops:[]){
    const inst=questInstanceById(q.instanceId),def=inst?questDefById(inst.definitionId):null,obj=def?.objectives?.find(x=>x.id===q.objId);
    if(inst?.status==="active"&&obj){addQuestItem(inst,obj,Math.max(1,Math.floor(Number(q.qty)||1)),"combat");syncQuestObjectiveProgress(inst);markCharacterNotice("quests");}
  }
  rec.worldClaimed=true;rec.worldClaimPayload=null;
  refreshLootLogEntries(rec.id);requestRunSave();return true;
}

function awardMonsterCoins(f){
  if(!S||!f)return 0;
  let amount=0;
  if(f.boss) amount=ri(f.midBoss||f.sideBoss?12:24,f.midBoss||f.sideBoss?28:48)+Math.floor(depthGrowth(S.depth)*.6);
  else if(f.mimic) amount=ri(10,24)+Math.floor(depthGrowth(S.depth)*.35);
  else if(rnd()<.58) amount=ri(1,5)+Math.max(0,Math.floor((Number(f.profile?.danger||f.danger||1)-1)*1.5))+Math.floor(depthGrowth(S.depth)/18);
  amount=Math.max(0,Math.round(amount));
  if(amount>0){S.gold=(S.gold||0)+amount;S._lootFoundCurrent.push(formatGold(amount));}
  return amount;
}
function maybeMonsterLoot(f){
  const drops=[];
  awardMonsterCoins(f);
  if(f.key==="scrounger"&&S.inventory.rogueTools<=0&&rnd()<.12){S.inventory.rogueTools=1;drops.push("Rogue Tools");}
  if(rnd()<.34){
    const r=rnd();
    if(r<.38){S.inventory.meat++;drops.push("Meat");}
    else if(r<.67){S.inventory.bandages++;drops.push("Bandage");}
    else if(r<.78){S.inventory.water++;drops.push("Jug of Water");}
    else if(r<.88){S.inventory.rope++;drops.push("Rope");}
    else if(r<.96){S.inventory.campSupplies++;drops.push("Camp Supply");}
    else {addMisc("Scroll Dust",1);drops.push("Scroll Dust");}
  }
  if(rnd()<.035){S.inventory.campSupplies++;drops.push("Camp Supply");}
  if(drops.length) S._lootFoundCurrent.push(...drops);
  maybeEquipmentLoot(f);
  return drops;
}
function maybeSideKey(f){
  const a=S.sideArea;
  if(!f.side||!a||a.keyDropped||S.inventory.passageKey) return null;
  if(rnd()<.12){
    a.keyDropped=true;
    S.inventory.passageKey={id:a.keyId,name:a.keyName};
    S._lootFoundCurrent.push(a.keyName);
    return a.keyName;
  }
  return null;
}

// ----- travel + combat render overlays -----



/* ============================================================
   v0.080 — Session 7.5 QOL + feedback pass
   ============================================================ */

function concealmentActive(){ return !!S?.concealment && (S.concealment.remainingMs||0)>0; }
function formatEffectTime(ms){
  const total=Math.max(0,Math.ceil((Number(ms)||0)/1000));
  return `${Math.floor(total/60)}:${String(total%60).padStart(2,"0")}`;
}
function clearConcealment(reason=""){
  if(!S?.concealment) return;
  S.concealment=null;
  if(reason) travelLogAdd(reason,"note");
}
function tickConcealment(){
  if(!concealmentActive()) return false;
  S.concealment.remainingMs=Math.max(0,S.concealment.remainingMs-TRAVEL_TICK_MS);
  if(S.concealment.remainingMs<=0){clearConcealment(`<b>Concealment</b> fades. You are moving openly again.`);return true;}
  return false;
}
function canFieldUseAbility(id){
  const sk=abilityState(id);
  if(encounterWarningActive() || over || S?.foe || !sk || sk.cur<=0) return false;
  if(id==="concealment") return !concealmentActive() && !S?.travelEvent && !S?.activeHollow;
  return S.hp<S.hpMax && ["layonhands","mend"].includes(id);
}
function useFieldAbility(id){
  if(encounterWarningActive() || !canFieldUseAbility(id)) return;
  const sk=abilityState(id);
  if(id==="concealment"){
    sk.cur--;
    S.concealment={remainingMs:CONCEALMENT_DURATION_MS,autoPass:false};
    travelLogAdd(`<b>Concealment.</b> You soften your movement and travel hidden. Enemy Awareness will test your Stealth before combat.`,"good");
    render();renderCharacterSheet();requestRunSave();return;
  }
  const amount=id==="layonhands"?15:12, before=S.hp;
  S.hp=Math.min(S.hpMax,S.hp+amount);
  const healed=S.hp-before;
  if(healed<=0) return;
  sk.cur--;
  render();
  renderCharacterSheet();
  triggerHealFx(healed,["travel","character"]);
  travelLogAdd(`<b>${esc(abilityDisplayName(id))}</b> restores <b>${healed} HP</b> outside combat.`,"good");requestRunSave();
}
function renderCharacterView(){
  document.querySelectorAll("[data-char-page]").forEach(page=>page.hidden=page.dataset.charPage!==charView);
  document.querySelectorAll("[data-char-view]").forEach(btn=>btn.classList.toggle("active",btn.dataset.charView===charView));
}
function renderStatusEffects(){
  const root=$("charStatuses"); if(!root||!S) return;
  const rows=[];
  if(S.bleeding){
    const bandageLocked=(typeof encounterWarningActive==="function" && encounterWarningActive()) || (S.foe && (!playerTurnActive() || (Number(S.stamina)||0)<3));
    const bandageAction=S.inventory?.bandages>0
      ? `<div class="char-ability-actions"><button class="char-field-use" data-use-bandage ${bandageLocked?"disabled":""}>Use Bandage · ×${S.inventory.bandages}</button></div>`
      : "";
    rows.push(`<div class="char-status bad"><b>Bleeding</b><span>${bleedSecondsRemaining()}s remain · loses 1 HP every 5 seconds of active travel/combat · Bandage, Rest or Camp removes it early.</span>${bandageAction}</div>`);
  }
  if(curseActive()) rows.push(`<div class="char-status bad"><b>${esc(S.curse.name)}</b><span>${S.curse.remaining} completed encounters remaining · ${esc(S.curse.desc)}</span></div>`);
  if(S.hollowRespite?.remaining>0) rows.push(`<div class="char-status good"><b>Sheltered</b><span>${S.hollowRespite.remaining} completed encounters remaining · +10% RSL-derived Defence Rating.</span></div>`);
  if(concealmentActive()) rows.push(`<div class="char-status good"><b>Concealment</b><span>${formatEffectTime(S.concealment.remainingMs)} active travel remaining · Stealth contests enemy Awareness before combat.</span></div>`);
  const boon=boonDef(); if(boon) rows.push(`<div class="char-status good"><b>${esc(boon.name)}</b><span>${formatBoonTime(boonRemainingMs())}${S.boon?.frozen?" · paused":""} · ${esc(boon.desc)}</span></div>`);
  root.innerHTML=rows.length?rows.join(""):`<div class="char-status empty"><b>No active conditions</b><span>No wounds, curses or temporary effects are currently affecting this delver.</span></div>`;
  const count=(S.bleeding?1:0)+(curseActive()?1:0)+(S.hollowRespite?.remaining>0?1:0)+(concealmentActive()?1:0)+(boon?1:0);
  if($("charStatusNavText")) $("charStatusNavText").textContent=count?`${count} active`:"none active";
}


function renderTravelEffects(){
  const root=$("travelEffects"); if(!root||!S) return;
  const bits=[];
  if(S.bleeding) bits.push(`<span class="travel-effect bad">Bleeding</span>`);
  if(curseActive()) bits.push(`<span class="travel-effect bad">${esc(S.curse.name)} ${S.curse.remaining}</span>`);
  if(S.hollowRespite?.remaining>0) bits.push(`<span class="travel-effect good">Sheltered ${S.hollowRespite.remaining}</span>`);
  if(concealmentActive()) bits.push(`<span class="travel-effect good">Concealed ${formatEffectTime(S.concealment.remainingMs)}</span>`);
  root.hidden=bits.length===0; root.innerHTML=bits.join("");
}

// Defensible ground is still useful without Camp Supplies: it becomes a one-use Rest
// plus a deliberately modest, encounter-counted shelter effect.
function clearHollowRespite(){
  if(!S?.hollowRespite) return;
  S.hollowRespite=null;
}
function grantHollowRespite(){
  clearHollowRespite(); S.hollowRespite={remaining:3};
  travelLogAdd(`<b>Sheltered.</b> +10% Defence Rating for the next 3 completed encounters.`,"good");
}
function restAtEmptyHollow(){
  const h=S?.activeHollow; if(!h||S.inventory.campSupplies>0) return;
  cancelHollowAutoResume(); clearHollowTimer(); pauseBoonClock();
  const before=S.hp; S.hp=Math.min(S.hpMax,S.hp+restHealAmount()); const healed=S.hp-before;
  S.restRecovery=0; clearBleeding(); S.hollowStates[h.key]="used"; S.activeHollow=null; S.travelMode="stopped";
  grantHollowRespite();
  if(healed>0) triggerHealFx(healed,["travel"]);
  if(abilitiesNeedRestoration()) S.pendingRestAbilityChoice=true;
  travelLogAdd(`You use the defensible ground as a short shelter. <b>${healed} HP</b> recovered${abilitiesNeedRestoration()?" · choose one spent ability use to restore":""}.`,"good");
  render();
}

// Loot popup. No base loot means no popup; when loot exists, one optional search
// check can look for a second find, but even a successful check does not guarantee it.
function addRolledLoot(kind){
  if(kind==="bandage"){S.inventory.bandages++;return "Bandage";}
  if(kind==="meat"){S.inventory.meat++;return "Meat";}
  if(kind==="rope"){S.inventory.rope++;return "Rope";}
  if(kind==="water"){S.inventory.water++;return "Jug of Water";}
  if(kind==="camp"){S.inventory.campSupplies++;return "Camp Supply";}
  if(kind==="dust"){addMisc("Scroll Dust",1);return "Scroll Dust";}
  return "";
}
function rollExtraLoot(){
  const r=rnd();
  if(r<.24)return addRolledLoot("bandage");
  if(r<.47)return addRolledLoot("meat");
  if(r<.60)return addRolledLoot("water");
  if(r<.72)return addRolledLoot("rope");
  if(r<.82)return addRolledLoot("camp");
  return addRolledLoot("dust");
}
let activeWorldLootId=null;
function worldLootRecord(id){return lootRecordById(id);}
function renderWorldLootSheet(){
  const sheet=$("worldLootSheet"),panel=$("worldLootPanel");if(!sheet||!panel)return;
  const rec=activeWorldLootId?worldLootRecord(activeWorldLootId):null;
  sheet.hidden=!rec;if(!rec){panel.innerHTML="";return;}
  const items=Array.isArray(rec.items)?rec.items:[];
  const itemHtml=items.length?items.map(item=>`<div class="combat-loot-item"><b>${esc(item)}</b><span>${rec.bonusItems?.includes(item)?"Investigation":"Recovered"}</span></div>`).join(""):`<div class="combat-loot-empty">Nothing else here is worth carrying.</div>`;
  const canSearch=!!rec.worldSearchAvailable&&!rec.worldSearchResolved;
  const search=canSearch?`<div class="combat-loot-search"><b>Something may have been overlooked.</b><span>Perception caught a detail worth checking carefully. ${skillCheckPreview("investigation",Number.isFinite(rec.worldSearchChallenge)?rec.worldSearchChallenge:authoredChallenge(12))}</span></div>`:rec.searchResult?`<div class="combat-loot-result">${esc(rec.searchResult)}</div>`:"";
  const investigate=canSearch?`<button class="combat-loot-btn investigate" type="button" data-world-loot-investigate><b>Investigate</b><span>Search for one possible additional find</span></button>`:"";
  panel.innerHTML=`<div class="combat-loot-head"><div><em>Loot on the ground</em><b>Recovered</b></div><span>${items.length} find${items.length===1?"":"s"}</span></div><div class="combat-loot-items">${itemHtml}</div>${search}<div class="combat-loot-actions ${canSearch?"":"single"}">${investigate}<button class="combat-loot-btn continue" type="button" data-world-loot-close><b>Continue</b><span>Return to the cavern</span></button></div>`;
}
function openWorldLoot(recordId){const rec=worldLootRecord(recordId);if(!rec)return false;activeWorldLootId=String(recordId);claimWorldLootRecord(rec);renderWorldLootSheet();try{window.LowfathomWorldBridge?.sync?.();}catch{}return true;}
function closeWorldLoot(){activeWorldLootId=null;const sheet=$("worldLootSheet");if(sheet)sheet.hidden=true;try{window.LowfathomWorldBridge?.sync?.();}catch{}}
async function resolveWorldLootSearch(){
  const rec=activeWorldLootId?worldLootRecord(activeWorldLootId):null;if(!rec||!rec.worldSearchAvailable||rec.worldSearchResolved)return;
  rec.worldSearchResolved=true;const challenge=Number.isFinite(rec.worldSearchChallenge)?rec.worldSearchChallenge:authoredChallenge(12),c=await runActiveSkillCheck("investigation",challenge),p=awardSkillPractice("investigation",`world-loot-search:${rec.id}`,c);
  const qualityBonus=Math.max(0,c.normalizedGap),findChance=clamp(.55+.10*qualityBonus,.55,.80);let found=null;
  if(c.success&&rnd()<findChance){found=rollExtraLoot();rec.items.push(found);rec.bonusItems=Array.isArray(rec.bonusItems)?rec.bonusItems:[];rec.bonusItems.push(found);refreshLootLogEntries(rec.id);}
  rec.searchResult=found?`Investigation recovered ${found}.`:c.success?"Investigation found no additional salvage worth carrying.":"Investigation found nothing else.";
  travelLogAdd(`${found?`<span class="good">Investigation found <b>${esc(found)}</b>.</span>`:c.success?`<span class="note">Investigation succeeds, but nothing else here is worth carrying.</span>`:`<span class="note">Investigation finds no additional salvage.</span>`}<br>${formatSkillCheck(c)}${practiceText("investigation",p)}`,found?"good":"note");
  renderWorldLootSheet();requestRunSave();
}

function openLootFound(drops,f){
  if(!drops?.length) return null;
  const isWorld=!!f?.worldEntityId;
  const rec=makeLootRecord(drops,f,{worldClaimed:!isWorld,worldClaimPayload:isWorld?(f._worldLootPayload||null):null});
  if(isWorld)delete f._worldLootPayload;
  rec.worldSearchAvailable=false;rec.worldSearchResolved=false;rec.worldSearchChallenge=null;
  if(rnd()>=.35){S.pendingLoot=null;return rec;}
  const encounter=S.encounter, challenge=authoredChallenge(11);
  const sense=runSkillCheck("perception",challenge),practice=awardSkillPractice("perception",`loot-sense:${encounter}`,sense);
  if(!sense.success){
    if(practice.awarded) travelLogAdd(`You finish collecting the obvious salvage.${practiceText("perception",practice)}`,"note");
    S.pendingLoot=null;return rec;
  }
  rec.worldSearchAvailable=!!f?.worldEntityId;rec.worldSearchChallenge=authoredChallenge(12);rec.worldPerceptionText=formatSkillCheck(sense)+practiceText("perception",practice);
  if(f?.worldEntityId){S.pendingLoot=null;return rec;}
  S.pendingLoot={encounter,foeName:f?.name||"foe",drops:[...drops],searched:false,historyId:rec.id,searchChallenge:authoredChallenge(12),perceptionText:formatSkillCheck(sense)+practiceText("perception",practice)};
  if(S.travelEvent?.id==="loot-found") S.travelEvent=null;
  return rec;
}
async function resolveLootSearch(skill="investigation"){
  const loot=S.pendingLoot;
  if(!loot||loot.searched) return;
  loot.searched=true;
  const challenge=Number.isFinite(loot.searchChallenge)?loot.searchChallenge:authoredChallenge(12),c=await runActiveSkillCheck("investigation",challenge),p=awardSkillPractice("investigation",`loot-search:${loot.encounter}`,c);
  const rec=lootRecordById(loot.historyId);
  let found=null;
  // Success quality: expertise above the challenge improves the chance that the careful search yields something worth carrying.
  const qualityBonus=Math.max(0,c.normalizedGap);
  const findChance=clamp(.55 + .10*qualityBonus,.55,.80);
  if(c.success&&rnd()<findChance){
    found=rollExtraLoot();
    loot.drops.push(found);
    if(rec){rec.items.push(found);rec.bonusItems.push(found);refreshLootLogEntries(rec.id);}
  }
  const practice=practiceText("investigation",p),checkText=formatSkillCheck(c);
  const outcome=found
    ? `<span class="good">Investigation found <b>${esc(found)}</b>.</span>`
    : c.success
      ? `<span class="note">Investigation succeeds, but nothing else here is worth carrying.</span>`
      : `<span class="note">Investigation finds no additional salvage.</span>`;
  if(rec) rec.searchResult=found?`Investigation recovered ${found}.`:c.success?"Investigation found no additional salvage worth carrying.":"Investigation found nothing else.";
  travelLogAdd(`${outcome}<br>${checkText}${practice}`,found?"good":"note");
  S.pendingLoot=null;S.travelEvent=null;render();
}
function closeLootFound(){
  S.pendingLoot=null;
  S.travelEvent=null;
  render();
}

// Replace the v0.079 kill extension so bosses are gated at every stratum boundary.


// Chance-based discovery can happen during normal descent OR deliberate Explore.
// The existing per-run depth trigger remains as a fallback so this slice is still testable.



/* ============================================================
   v0.080.1 — Session 7.5 combat + information QOL
   ============================================================ */

// Check-choice literacy: show the actual current modifier before the player commits.
function displayedCheckBonus(skillId, situational=0){ return skillRating(skillId,situational); }
function annotateCheckChoice(action, skillId, challenge=authoredChallenge(12), situational=0){
  const b=document.querySelector(`[data-event-action="${action}"]`);
  if(!b) return;
  const span=b.querySelector("span");
  if(!span) return;
  const detail=span.innerHTML
    .replace(/<strong class="check-bonus">.*?<\/strong>\s*(?:·\s*)?/,"")
    .trim();
  span.innerHTML=`${skillCheckPreview(skillId,challenge,situational)}${detail?` · ${detail}`:""}`;
}

// Known Weakness gets one full decision-turn of prominence after the first Read,
// then collapses to a one-line toggle. Future encounters default collapsed.
function weaknessCollapsed(f=S?.foe){
  if(!f?.revealed) return false;
  if(f.weaknessManualOpen===true) return false;
  if(f.weaknessManualOpen===false) return true;
  return S.turn >= (f.weaknessAutoOpenUntil ?? S.turn);
}
// The first Read now sets its one-turn weakness presentation directly in ACTIONS.read.run.


// Dedicated Recover remains retired. Player turns use one shared 3-Stamina budget;
// basic defence, offence, study and End Turn all compete for that same budget.
// Player Heavy/Backstab/Arcane Bolt resolve immediately for a full 3-Stamina turn.
// Enemy Heavy alone keeps its literal two-enemy-turn wind-up/release sequence.

// Run pressure is now uncertainty rather than an HP surcharge. Attempts reset
// on a short 60-fathom pressure band, independent of the 500-fathom biome.
// Chance within a band: 100% -> 75% -> 50% -> 30% (floor).
// A failed attempt costs no Run HP, but consumes the player's entire turn and lets
// the foe resolve its forecast enemy action normally.
function syncRunAttempts(){
  if(!S)return 0;
  const idx=Math.max(0,Math.floor(S.depth/RUN_PRESSURE_RESET_FATHOMS));
  if(S.runAttemptStratum!==idx){S.runAttemptStratum=idx;S.runAttempts=0;}
  return S.runAttempts||0;
}
function runSuccessChance(){
  const attempts=syncRunAttempts();
  return attempts<=0?1:attempts===1?.75:attempts===2?.50:.30;
}
ACTIONS.runattempt={
  label:"Run",sub:"3 Stamina · failed escape spends turn",cost:3,
  preview(){return "Attempt to break contact.";},
  run(){return `<p class="hurt"><b>Escape failed.</b> You lose the turn trying to break contact.</p>`;}
};

// Side-passage opportunities use their own 60-fathom cadence. Failing, declining
// or completing one resolves that local opportunity without waiting 500 fathoms
// for the next major biome.
function syncSidePassageStratum(){
  if(!S||sideAreaActive())return;
  const idx=Math.max(0,Math.floor(S.depth/SIDE_PASSAGE_CADENCE_FATHOMS));
  if(S.sideDiscoveryStratum===idx)return;
  S.sideDiscoveryStratum=idx;
  S.sideDiscoveryAttempted=false;
  S.sideAreaResolved=false;
  S.sideDiscoveryAt=idx*SIDE_PASSAGE_CADENCE_FATHOMS+ri(15,30);
}

// New delvers need the small Session 7.5 tracking fields explicitly initialized.

// Final render polish for Read collapse and explicit Run pursuit information.


/* ============================================================
   v0.080.3 — Session 7.5 exploration reward + side-route QOL
   v0.080.4 — stronger lateral branch + live dot rendering fix
   ============================================================ */

// Descent XP is earned only for NEW main-shaft depth. Quarter-fathom movement is
// retained internally so repeated interruptions still total exactly 1 XP/fathom.
function recordDescentXpProgress(){
  if(!S) return;
  const maxSeen=Number(S.descentXpMaxDepth ?? 0);
  if(S.depth <= maxSeen + 0.0001) return;
  S.descentXpPending=(S.descentXpPending||0)+(S.depth-maxSeen);
  S.descentXpMaxDepth=S.depth;
}
function bankDescentXp(){
  if(!S) return 0;
  const gain=Math.floor((S.descentXpPending||0)+1e-6);
  if(gain<=0) return 0;
  S.descentXpPending-=gain;
  S.xp+=gain;
  let levels=0;
  while(S.xp>=xpToNext(S.level)){
    S.xp-=xpToNext(S.level);
    S.level++;
    S.statPoints+=3;
    levels++;
  }
  travelLogAdd(`Descent explored: <b>+${gain} XP</b>.`,"good");
  if(levels){
    const gainedPoints=levels*3;
    markCharacterNotice("overview");
    showLevelUpNotice();
    travelLogAdd(`<b>Level ${S.level}.</b> <b>${gainedPoints} attribute point${gainedPoints===1?"":"s"}</b> gained. You can save them for later.`,"good");
  }
  return gain;
}
function pendingDescentXp(){ return Math.max(0,Math.floor((S?.descentXpPending||0)+1e-6)); }

// Side passages are generated once per passage and then remain stable. Only these
// lateral branches are randomized; the main fathom route above remains untouched.
function generateSideRouteOffsets(){
  const pts=[[0,0]];
  const bias=rnd()<.5?-1:1;
  // Side passages must LOOK lateral. The first two segments deliberately peel
  // away from the shaft before they begin wandering sideways.
  let x=ri(5,8);
  let y=bias*ri(20,27);
  pts.push([x,y]);
  x+=ri(7,11);
  y=bias*ri(34,43);
  pts.push([x,y]);
  for(let i=3;i<=6;i++){
    x+=ri(11,17);
    const outward=bias*ri(-5,9);
    y=clamp(y+outward,-52,52);
    // Keep the branch comfortably away from the main route after its initial fork.
    if(Math.abs(y)<26) y=bias*ri(28,40);
    pts.push([x,y]);
  }
  return pts;
}

function sideBranchGeometry(anchorX,anchorY,progress=1,routeOffsets=null){
  const offsets=routeOffsets?.length?routeOffsets:[[0,0],[15,-7],[31,-21],[48,-17],[66,-4],[83,7],[99,-9]];
  const pts=offsets.map(([x,y])=>[anchorX+x,clamp(anchorY+y,9,TRAIL_H-9)]);
  const segs=Math.max(1,pts.length-1),scaled=clamp(progress,0,1)*segs;
  const whole=Math.floor(scaled),frac=scaled-whole;
  const out=[pts[0]];
  for(let i=1;i<=Math.min(whole,segs);i++) out.push(pts[i]);
  if(whole<segs && frac>0){
    const a=pts[whole],b=pts[whole+1];
    out.push([a[0]+(b[0]-a[0])*frac,a[1]+(b[1]-a[1])*frac]);
  }
  const end=out[out.length-1]||pts[0];
  return {
    d:out.map((pt,i)=>`${i?"L":"M"}${pt[0].toFixed(1)},${pt[1].toFixed(1)}`).join(" "),
    end
  };
}

// Preserve the generated geometry in the nearby-route history after returning to
// the exact entrance fathom.

// Draw the unchanged main route, then reveal the active lateral branch behind the
// moving delver marker. Combat/events pause the marker exactly where travel stopped.

function liveExploreDots(){
  const phase=Math.floor(Date.now()/800)%3;
  return [".","..","..."][phase];
}

// Track new main-shaft depth after every finalized travel tick. Side travel leaves
// S.depth unchanged, so it cannot create descent XP.

// Winning any encounter banks the pending main-shaft exploration reward. A boss
// can advance S.depth to the exact boundary, so record that final fraction first.

// Altar translation is a one-shot check. The result remains visible and the button
// becomes disabled rather than implying the same inscription can be rerolled.




/* ============================================================
   v0.080.7 — Session 7.5 loot pacing / history
   Ordinary creature loot is automatic. A clickable Delve Log entry opens a
   soft history sheet while travel continues. Only ~35% of loot-bearing kills
   offer an optional Perception / Investigation bonus search.
   ============================================================ */
let selectedLootHistoryId=null;

function ensureLootHistory(){
  if(!Array.isArray(S?.lootHistory)) S.lootHistory=[];
  return S?.lootHistory || [];
}
function lootRecordById(id){
  return ensureLootHistory().find(x=>String(x.id)===String(id)) || null;
}
function lootItemsText(items=[]){ return items.length ? items.join(" · ") : "Nothing recorded"; }
function makeLootRecord(drops,f,opts={}){
  const history=ensureLootHistory();
  const rec={
    id:`loot-${Date.now()}-${S.encounter}-${Math.floor(rnd()*100000)}`,
    depth:S.depth,
    encounter:S.encounter,
    foeName:f?.name || "foe",
    items:[...drops],
    bonusItems:[],
    searchResult:null,
    worldClaimed:opts.worldClaimed!==false,
    worldClaimPayload:opts.worldClaimPayload||null
  };
  history.push(rec);
  if(history.length>40) history.shift();
  addLootLogEntry(rec);
  return rec;
}
function addLootLogEntry(rec){
  if(!S) return;
  const entry={depth:rec.depth,html:"",cls:"loot",lootId:rec.id};
  S.travelLog.push(entry);
  if(S.travelLog.length>120) S.travelLog.shift();
  const r=$("travelLog"); if(!r)return;
  const nearBottom=r.scrollHeight-r.scrollTop-r.clientHeight<44;
  const row=document.createElement("div");
  row.className="travel-entry loot";
  row.dataset.lootHistory=rec.id;
  row.innerHTML=`<span class="depth">${formatDepth(rec.depth)}f</span><p><button class="loot-log-btn" data-loot-history="${esc(rec.id)}"><span class="loot-log-source">From ${esc(cap(rec.foeName))}</span><b class="loot-log-items">${esc(lootItemsText(rec.items))}</b><span class="loot-log-note">${rec.worldClaimed===false?"left on cavern floor":"already collected"} · tap to review</span></button></p>`;
  r.appendChild(row);
  while(r.children.length>120)r.removeChild(r.firstChild);
  if(nearBottom)r.scrollTop=r.scrollHeight;
}
function refreshLootLogEntries(id){
  const rec=lootRecordById(id); if(!rec)return;
  document.querySelectorAll(`[data-loot-history="${CSS.escape(String(id))}"]`).forEach(el=>{
    if(el.classList.contains("loot-log-btn")){
      const items=el.querySelector(".loot-log-items"),note=el.querySelector(".loot-log-note");
      if(items)items.textContent=lootItemsText(rec.items);
      if(note)note.textContent=`${rec.worldClaimed===false?"left on cavern floor":"already collected"} · tap to review`;
    }
  });
}
function renderLootHistory(){
  const sheet=$("lootHistorySheet"),list=$("lootHistoryList");
  if(!sheet||!list||!S)return;
  // Soft sheets should never hide a hard interruption.
  if((S.foe||S.travelEvent)&&!sheet.hidden){sheet.hidden=true;selectedLootHistoryId=null;return;}
  const history=ensureLootHistory();
  if(!history.length){list.innerHTML=`<div class="loot-history-entry"><p>No creature loot has been recorded yet.</p></div>`;return;}
  list.innerHTML=[...history].reverse().map(rec=>`<div class="loot-history-entry ${String(rec.id)===String(selectedLootHistoryId)?"selected":""}"><div class="loot-history-entry-top"><span class="loot-history-foe">${esc(cap(rec.foeName))}</span><em>${formatDepth(rec.depth)}f · encounter ${rec.encounter}</em></div><p class="loot-history-items">${esc(lootItemsText(rec.items))}</p>${rec.worldClaimed===false?`<small>Still on the cavern floor.</small>`:""}${rec.bonusItems?.length?`<small>Bonus search: ${esc(rec.bonusItems.join(" · "))}</small>`:""}</div>`).join("");
}
function openLootHistory(id){
  if(!S||S.foe||S.travelEvent)return;
  closeTravelLogPopup();
  selectedLootHistoryId=id;
  renderLootHistory();
  $("lootHistorySheet").hidden=false;
  syncBrowseTravelUI();
}
function closeLootHistory(){
  selectedLootHistoryId=null;
  if($("lootHistorySheet"))$("lootHistorySheet").hidden=true;
  syncBrowseTravelUI();
}

// Ordinary loot is inserted directly into the Backpack; makeLootRecord supplies the history.

// Called by the existing kill pipeline after loot has already entered inventory.
// Most of the time this only creates the clickable history line. About 35% of
// loot-bearing kills offer a deliberate bonus-search decision.




$("travelLog").addEventListener("click",e=>{
  const b=e.target.closest("[data-loot-history]");if(!b)return;
  openLootHistory(b.dataset.lootHistory);
});
$("btnLootHistoryClose").addEventListener("click",closeLootHistory);
$("lootHistoryScrim").addEventListener("click",closeLootHistory);


/* ============================================================
   v0.080.8 — Session 7.5 encounter warning / transition
   A generated encounter freezes all world progression immediately. The warning
   remains above soft sheets so the player can browse information, but recovery,
   consumables, equipment changes and travel preparation are locked. Combat then
   enters through a short fade-to-black transition.
   ============================================================ */
function encounterWarningDurationMs(){
  const seconds=Number(settings?.encounterGraceSeconds)||DEFAULT_SETTINGS.encounterGraceSeconds;
  return Math.max(1000,seconds*1000);
}
let encounterWarningState=null;
let encounterWarningFrame=null;
let encounterTransitionTimer=null;
let travelLogExpanded=false;

function encounterWarningActive(){ return !!encounterWarningState; }
function encounterWarningLabel(state=encounterWarningState){
  if(!state) return {kicker:"You have been noticed",title:"Something is closing in."};
  if(state.options?.sideBoss) return {kicker:"The passage narrows",title:"A guardian waits ahead."};
  if(state.options?.midBoss) return {kicker:"Danger on the route",title:"A powerful foe holds the descent."};
  if(state.options?.boss) return {kicker:"The way is barred",title:"Something waits at the sill."};
  const raw=state.profile?.name || "foe";
  const name=state.options?.side ? `cursed ${raw}` : raw;
  const variants=[
    ["You have been noticed",`${cap(article(name))} is closing in.`],
    ["Movement nearby",`${cap(article(name))} is approaching.`],
    ["Something heard you",`${cap(article(name))} has found your trail.`]
  ];
  const chosen=variants[state.variantIndex%variants.length];
  return {kicker:chosen[0],title:chosen[1]};
}
function updateEncounterWarningUi(){
  const box=$("encounterWarning");
  if(!box) return;
  const state=encounterWarningState;
  box.hidden=!state;
  if(!state) return;
  const now=performance.now();
  const remaining=Math.max(0,state.deadline-now);
  const frac=clamp(remaining/Math.max(1,state.durationMs||encounterWarningDurationMs()),0,1);
  const copy=encounterWarningLabel(state);
  $("encounterWarningKicker").textContent=copy.kicker;
  $("encounterWarningTitle").textContent=copy.title;
  $("encounterWarningSub").textContent=`Delve frozen · combat in ${(remaining/1000).toFixed(1)}s · browsing remains available`;
  $("encounterWarningBar").style.transform=`scaleX(${frac})`;
}
function stopEncounterWarningFrame(){
  if(encounterWarningFrame!==null){cancelAnimationFrame(encounterWarningFrame);encounterWarningFrame=null;}
}
function encounterWarningLoop(){
  if(!encounterWarningState){stopEncounterWarningFrame();updateEncounterWarningUi();return;}
  updateEncounterWarningUi();
  if(performance.now()>=encounterWarningState.deadline){beginEncounterTransition();return;}
  encounterWarningFrame=requestAnimationFrame(encounterWarningLoop);
}
function renderEncounterWarningLocks(){
  const active=encounterWarningActive();
  updateEncounterWarningUi();
  if(!active) return;
  // The player can browse Character, Backpack, Loot History and the Delve Log,
  // but cannot alter resources/state during the grace period.
  for(const id of ["btnDescend","btnExplore","btnRest","btnStopTravel","btnCampHere","btnLeaveHollow"]){
    const el=$(id);if(el)el.disabled=true;
  }
  document.querySelectorAll("[data-field-ability],[data-use-bandage],[data-equip-weapon],[data-offer-item],[data-stat-plus],[data-stat-minus]").forEach(el=>el.disabled=true);
  if($("btnConfirmStats")) $("btnConfirmStats").disabled=true;
  const packNote=$("packNote");
  if(packNote&&!$("packSheet").hidden)packNote.textContent="Encounter approaching · browsing only. Recovery, item use and equipment changes are locked.";
}
function tryConcealedContact(profile,options,priorMode){
  if(!concealmentActive() || options.mimic || options.skipStealth) return false;
  if(options.boss){clearConcealment(`<b>Concealment</b> fails against a boss. Whatever waits there already controls the route.`);return false;}
  const challenge=Number(profile?.awareness)||0;
  const check=runSkillCheck("stealth",challenge,0);
  const source=`stealth-contact:${++S.stealthOpportunitySeq}`;
  const practice=awardSkillPractice("stealth",source,check);
  if(!check.success){
    clearConcealment();
    travelLogAdd(`<b>${esc(cap(profile?.name||"Something"))}</b> turns directly toward you. It pierced your Concealment.<br>${formatSkillCheck(check)}${practiceText("stealth",practice)}`,"danger");
    return false;
  }
  if(S.concealment?.autoPass){
    travelLogAdd(`You remain hidden and let the <b>${esc(profile.name)}</b> pass without stopping.`,"note");
    resumeBoonClock();S.travelMode=priorMode;return true;
  }
  const storedOptions={...options};delete storedOptions.profile;
  S.travelMode="stopped";
  S.travelEvent={
    id:"stealth-contact",stage:"choice",kind:"Concealed contact",title:"They haven't seen you.",
    text:`${cap(article(profile.name))} moves through the dark without realizing you are there.`,
    rollHtml:formatSkillCheck(check)+practiceText("stealth",practice),profileId:profile.id,encounterOptions:storedOptions,priorMode
  };
  travelLogAdd(`Your Stealth holds against the <b>${esc(profile.name)}</b>. You choose how this encounter begins.`,"good");
  render();return true;
}

function queueEncounterWarning(options={}){
  if(!S||over||S.foe||encounterWarningActive())return false;
  // If an actual travel event is still unresolved, its own decision flow takes
  // precedence. Calls made after an event clears it can queue normally.
  if(S.travelEvent)return false;
  // Encounter warnings own the top-notice channel. If a level-up notice was still
  // visible, retire that popup now; its Character → Overview unread marker remains.
  if(!levelUpNoticeDismissed) dismissLevelUpNotice();
  pauseBoonClock();
  const priorMode=S.travelMode;
  S.travelMode="stopped";
  const profile=options.profile || (options.boss ? BOSS_PROFILE : chooseFoeProfile());
  if(tryConcealedContact(profile,options,priorMode)) return true;
  const durationMs=encounterWarningDurationMs();
  encounterWarningState={
    options:{...options},profile,priorMode,durationMs,
    startedAt:performance.now(),deadline:performance.now()+durationMs,
    variantIndex:ri(0,2)
  };
  // The companion reacts only after the game's normal encounter warning has
  // already begun. This keeps chatter from becoming a hidden danger detector.
  companionEncounterWarningBark();
  armed=null;
  travelLogAdd(options.sideBoss
    ? `<b>A passage guardian waits ahead.</b> Combat is imminent.`
    : options.midBoss
      ? `<b>A mid-stratum boss blocks the route.</b> Combat is imminent.`
      : options.boss
    ? `<b>Something is waiting at the boundary.</b> Combat is imminent.`
    : `<b>${esc(cap(article(options.side?`cursed ${profile.name}`:profile.name)))}</b> is closing in.`,"danger");
  render();
  stopEncounterWarningFrame();
  encounterWarningFrame=requestAnimationFrame(encounterWarningLoop);
  return true;
}
function clearCombatTransitionTimers(){
  if(encounterTransitionTimer!==null){clearTimeout(encounterTransitionTimer);encounterTransitionTimer=null;}
}
function clearCombatTransitionVisual(){
  const fade=$("combatTransition"),warning=$("encounterWarning");
  if(fade){fade.classList.remove("fade-in");fade.hidden=true;fade.setAttribute("aria-hidden","true");}
  if(warning&&S?.foe?.worldRealtime)warning.hidden=true;
}
function beginEncounterTransition(){
  const state=encounterWarningState;
  if(!state)return;
  stopEncounterWarningFrame();
  const fade=$("combatTransition");
  const warning=$("encounterWarning");
  if(warning)warning.hidden=true;
  if(fade){
    fade.hidden=false;
    fade.classList.remove("fade-in");
    void fade.offsetWidth;
    fade.classList.add("fade-in");
  }
  clearCombatTransitionTimers();
  encounterTransitionTimer=setTimeout(()=>{
    encounterTransitionTimer=null;
    // Spawn the exact profile announced by the warning so the notice and combat
    // can never disagree about what is approaching. The black transition is a
    // visual only: even if encounter setup throws, it must never remain over the
    // live Canvas and make the game appear dead while controls still respond.
    encounterWarningState=null;
    updateEncounterWarningUi();
    try{
      spawnEncounter({...state.options,profile:state.profile});
    }finally{
      setTimeout(()=>{
        if(!fade)return;
        fade.classList.remove("fade-in");
        setTimeout(()=>{fade.hidden=true;fade.setAttribute("aria-hidden","true");},260);
      },80);
    }
  },240);
}

// Encounter warnings now call the canonical spawnEncounter() directly after the fade.

/* ============================================================
   v0.081.1 — SESSION 8 SETTINGS FOUNDATION
   Preferences live outside the permadeath run save so interface choices survive
   death and a new chronicle. Keep this intentionally small until playtesting tells
   us which additional preferences are genuinely useful.
   ============================================================ */
function normalizeSettings(value){
  const next={...DEFAULT_SETTINGS};
  if(value && typeof value==="object"){
    if(typeof value.characterIndicators==="boolean") next.characterIndicators=value.characterIndicators;
    const grace=Number(value.encounterGraceSeconds);
    if(ENCOUNTER_GRACE_OPTIONS.includes(grace)) next.encounterGraceSeconds=grace;
    if(typeof value.diceAnimation==="boolean") next.diceAnimation=value.diceAnimation;
    if(DICE_SIZE_OPTIONS.includes(value.diceSize)) next.diceSize=value.diceSize;
    if(COMBAT_DICE_OPTIONS.includes(value.combatDice)) next.combatDice=value.combatDice;
    if(COMBAT_FONT_OPTIONS.includes(value.combatFont)) next.combatFont=value.combatFont;
    if(WORLD_ZOOM_OPTIONS.includes(value.worldZoom)) next.worldZoom=value.worldZoom;
    if(MINIMAP_SIZE_OPTIONS.includes(value.minimapSize)) next.minimapSize=value.minimapSize;
    const minimapZoom=Math.round(Number(value.minimapZoom));
    if(MINIMAP_ZOOM_OPTIONS.includes(minimapZoom)) next.minimapZoom=minimapZoom;
  }
  return next;
}
function loadSettings(){
  try{
    const raw=localStorage.getItem(SETTINGS_KEY);
    if(!raw){settings={...DEFAULT_SETTINGS};return settings;}
    const data=JSON.parse(raw);
    const payload=data?.settings && typeof data.settings==="object" ? data.settings : data;
    settings=normalizeSettings(payload);
  }catch(err){
    console.error("Lowfathom settings restore failed",err);
    settings={...DEFAULT_SETTINGS};
  }
  return settings;
}
function saveSettingsNow(){
  try{
    localStorage.setItem(SETTINGS_KEY,JSON.stringify({schema:SETTINGS_SCHEMA,settings:{...settings}}));
    return true;
  }catch(err){
    console.error("Lowfathom settings save failed",err);
    return false;
  }
}
/* v0.205.1 — persistent non-modal world window layout. Kept outside the run
   save so one UI arrangement can survive character death and slot changes. */
let floatingWindowLayout=null;
let floatingWindowDrag=null;
let floatingWindowZ=30;
function loadFloatingWindowLayout(){
  if(floatingWindowLayout&&typeof floatingWindowLayout==="object")return floatingWindowLayout;
  try{const raw=localStorage.getItem(WINDOW_LAYOUT_KEY);const parsed=raw?JSON.parse(raw):null;floatingWindowLayout=parsed&&typeof parsed==="object"?parsed:{};}
  catch(err){console.error("Lowfathom window layout restore failed",err);floatingWindowLayout={};}
  return floatingWindowLayout;
}
function saveFloatingWindowLayout(){
  try{localStorage.setItem(WINDOW_LAYOUT_KEY,JSON.stringify(loadFloatingWindowLayout()));return true;}catch(err){console.error("Lowfathom window layout save failed",err);return false;}
}
function floatingWindowParts(key){
  if(key==="backpack")return{root:$("packSheet"),panel:document.querySelector("#packSheet .pack-panel")};
  if(key==="character")return{root:$("charSheet"),panel:document.querySelector("#charSheet .char-panel")};
  if(key==="delveLog")return{root:$("travelLogWrap"),panel:$("travelLogWrap")};
  return{root:null,panel:null};
}
function floatingWindowDefaultPosition(key,panel){
  const arena=$("arena"),aw=Math.max(0,arena?.clientWidth||window.innerWidth),ah=Math.max(0,arena?.clientHeight||window.innerHeight);
  const w=Math.max(1,panel?.offsetWidth||300),h=Math.max(1,panel?.offsetHeight||300),pad=14;
  if(key==="backpack")return{x:Math.max(pad,aw-w-pad),y:64};
  if(key==="character")return{x:pad,y:64};
  return{x:pad,y:Math.max(64,ah-h-pad)};
}
function clampFloatingWindowPosition(x,y,panel){
  const arena=$("arena"),aw=Math.max(1,arena?.clientWidth||window.innerWidth),ah=Math.max(1,arena?.clientHeight||window.innerHeight);
  const w=Math.max(1,panel?.offsetWidth||1),h=Math.max(1,panel?.offsetHeight||1),pad=6;
  return{x:Math.round(clamp(Number(x)||0,pad,Math.max(pad,aw-w-pad))),y:Math.round(clamp(Number(y)||0,pad,Math.max(pad,ah-h-pad)))};
}
function bringFloatingWindowToFront(key){
  const {root}=floatingWindowParts(key);if(!root)return;
  floatingWindowZ++;if(floatingWindowZ>38){floatingWindowZ=31;for(const k of ["backpack","character","delveLog"]){const p=floatingWindowParts(k);if(p.root)p.root.style.setProperty("--window-z","30");}}
  root.style.setProperty("--window-z",String(floatingWindowZ));
}
function applyFloatingWindowPosition(key){
  const {root,panel}=floatingWindowParts(key);if(!root||!panel)return;
  if(key!=="delveLog"&&!root.classList.contains("world-floating"))return;
  if(key==="delveLog"&&!root.classList.contains("world-floating-window"))return;
  const layout=loadFloatingWindowLayout(),saved=layout[key],base=saved&&Number.isFinite(Number(saved.x))&&Number.isFinite(Number(saved.y))?saved:floatingWindowDefaultPosition(key,panel),pos=clampFloatingWindowPosition(base.x,base.y,panel);
  panel.style.setProperty("--window-x",`${pos.x}px`);panel.style.setProperty("--window-y",`${pos.y}px`);
}
function persistFloatingWindowPosition(key,x,y){
  const {panel}=floatingWindowParts(key);if(!panel)return;const pos=clampFloatingWindowPosition(x,y,panel),layout=loadFloatingWindowLayout();layout[key]=pos;saveFloatingWindowLayout();
  panel.style.setProperty("--window-x",`${pos.x}px`);panel.style.setProperty("--window-y",`${pos.y}px`);
}
function setFloatingWindowEnabled(key,enabled){
  const {root}=floatingWindowParts(key);if(!root)return;
  if(key==="delveLog")root.classList.toggle("world-floating-window",!!enabled);else root.classList.toggle("world-floating",!!enabled);
  if(enabled){bringFloatingWindowToFront(key);requestAnimationFrame(()=>applyFloatingWindowPosition(key));}
}
function resetFloatingWindowPositions(){
  floatingWindowLayout={};try{localStorage.removeItem(WINDOW_LAYOUT_KEY);}catch(err){console.error("Lowfathom window layout reset failed",err);}
  for(const key of ["backpack","character","delveLog"])requestAnimationFrame(()=>applyFloatingWindowPosition(key));
}
function reflowFloatingWindows(){for(const key of ["backpack","character","delveLog"])applyFloatingWindowPosition(key);}
function initFloatingWindowDragging(){
  loadFloatingWindowLayout();
  document.addEventListener("pointerdown",e=>{
    const handle=e.target.closest?.("[data-window-drag]");if(!handle||e.target.closest?.("button,input,select,textarea,a,[contenteditable='true']"))return;
    const key=handle.dataset.windowDrag,{root,panel}=floatingWindowParts(key);if(!root||!panel||root.hidden)return;
    if(key!=="delveLog"&&!root.classList.contains("world-floating"))return;if(key==="delveLog"&&!root.classList.contains("world-floating-window"))return;
    const arena=$("arena")?.getBoundingClientRect(),rect=panel.getBoundingClientRect();if(!arena)return;
    bringFloatingWindowToFront(key);handle.classList.add("dragging");
    floatingWindowDrag={key,handle,pointerId:e.pointerId,arena,dx:e.clientX-rect.left,dy:e.clientY-rect.top};
    try{handle.setPointerCapture?.(e.pointerId);}catch(_err){}e.preventDefault();
  },true);
  document.addEventListener("pointermove",e=>{
    const d=floatingWindowDrag;if(!d||e.pointerId!==d.pointerId)return;const {panel}=floatingWindowParts(d.key);if(!panel)return;
    const pos=clampFloatingWindowPosition(e.clientX-d.arena.left-d.dx,e.clientY-d.arena.top-d.dy,panel);panel.style.setProperty("--window-x",`${pos.x}px`);panel.style.setProperty("--window-y",`${pos.y}px`);e.preventDefault();
  },true);
  const finish=e=>{const d=floatingWindowDrag;if(!d||e.pointerId!==d.pointerId)return;const {panel}=floatingWindowParts(d.key);d.handle?.classList.remove("dragging");if(panel){const rect=panel.getBoundingClientRect(),arena=$("arena")?.getBoundingClientRect();if(arena)persistFloatingWindowPosition(d.key,rect.left-arena.left,rect.top-arena.top);}floatingWindowDrag=null;};
  document.addEventListener("pointerup",finish,true);document.addEventListener("pointercancel",finish,true);
  window.addEventListener("resize",()=>requestAnimationFrame(reflowFloatingWindows));
}
function applyMinimapSize(){document.body.dataset.minimapSize=MINIMAP_SIZE_OPTIONS.includes(settings?.minimapSize)?settings.minimapSize:DEFAULT_SETTINGS.minimapSize;requestAnimationFrame(()=>window.LowfathomWorldBridge?.world?.refreshMinimap?.());}
function setMinimapSize(size){if(!MINIMAP_SIZE_OPTIONS.includes(size))return;settings.minimapSize=size;applyMinimapSize();saveSettingsNow();renderSettingsSheet();}
function persistMinimapZoom(level){const n=Math.round(Number(level));if(!MINIMAP_ZOOM_OPTIONS.includes(n))return;settings.minimapZoom=n;saveSettingsNow();}
function clearCurrentCharacterIndicators(){
  if(!S) return;
  const notices=ensureCharacterNotices();
  if(notices) for(const key of Object.keys(notices)) notices[key]=false;
  const skillNotices=ensureSkillRankNotices();
  if(skillNotices) for(const key of Object.keys(skillNotices)) skillNotices[key]=false;
}
function setCharacterIndicators(enabled){
  settings.characterIndicators=!!enabled;
  if(!settings.characterIndicators) clearCurrentCharacterIndicators();
  saveSettingsNow();
  renderSettingsSheet();
  if(S){renderCharacterSheet();renderCharacterNotices();requestRunSave();}
}
function setEncounterGrace(seconds){
  const value=Number(seconds);
  if(!ENCOUNTER_GRACE_OPTIONS.includes(value)) return;
  settings.encounterGraceSeconds=value;
  saveSettingsNow();
  renderSettingsSheet();
}
function setDiceAnimation(enabled){
  settings.diceAnimation=!!enabled;
  if(!settings.diceAnimation) stopFathomDiePresentation();
  saveSettingsNow();
  renderSettingsSheet();
}
function setDiceSize(size){
  if(!DICE_SIZE_OPTIONS.includes(size)) return;
  settings.diceSize=size;
  saveSettingsNow();
  renderSettingsSheet();
}
function setCombatDice(mode){
  if(!COMBAT_DICE_OPTIONS.includes(mode)) return;
  settings.combatDice=mode;
  if(mode==="off"){
    // Off is authoritative immediately, even if a physical combat roll was
    // already queued or visible when the setting changed.
    cancelCombatDicePresentation();
    stopFathomDiePresentation();
  }
  saveSettingsNow();
  renderSettingsSheet();
  if(S)render();
}
function applyCombatFont(){
  document.body.classList.toggle("font-slab", settings?.combatFont==="slab");
}
function setCombatFont(mode){
  if(!COMBAT_FONT_OPTIONS.includes(mode)) return;
  settings.combatFont=mode;
  applyCombatFont();
  saveSettingsNow();
  renderSettingsSheet();
}
function setWorldZoom(mode){
  if(!WORLD_ZOOM_OPTIONS.includes(mode))return;
  settings.worldZoom=mode;
  saveSettingsNow();
  window.LowfathomWorldBridge?.world?.setZoom?.(WORLD_ZOOM_VALUES[mode]||WORLD_ZOOM_VALUES.standard);
  renderSettingsSheet();
}
function resetSettings(){
  settings={...DEFAULT_SETTINGS};
  clearCurrentCharacterIndicators();
  applyCombatFont();applyMinimapSize();
  window.LowfathomWorldBridge?.world?.setZoom?.(WORLD_ZOOM_VALUES[settings.worldZoom]||WORLD_ZOOM_VALUES.standard);
  window.LowfathomWorldBridge?.world?.setMinimapZoom?.(settings.minimapZoom,{notify:false});
  saveSettingsNow();
  renderSettingsSheet();
  if(S){renderCharacterSheet();renderCharacterNotices();requestRunSave();}
}
function runSlotKey(slot=currentRunSlot){ return RUN_SLOT_KEYS[Number(slot)]||RUN_SLOT_KEYS[1]; }
function runQuarantineKey(slot=currentRunSlot){ return Number(slot)===1?SAVE_QUARANTINE_KEY:`${SAVE_QUARANTINE_KEY}:slot${Number(slot)}`; }
function loadActiveRunSlot(){
  try{
    const n=Number(localStorage.getItem(ACTIVE_RUN_SLOT_KEY));
    currentRunSlot=[1,2,3].includes(n)?n:1;
  }catch(err){currentRunSlot=1;}
  return currentRunSlot;
}
function saveActiveRunSlot(){
  try{localStorage.setItem(ACTIVE_RUN_SLOT_KEY,String(currentRunSlot));return true;}catch(err){console.error("Lowfathom active slot save failed",err);return false;}
}
function slotSnapshotSummary(slot){
  const keys=[runSlotKey(slot),...(Number(slot)===1?LEGACY_SAVE_KEYS:[])];
  for(const key of keys){
    let raw=null;
    try{raw=localStorage.getItem(key);}catch(err){return {kind:"error"};}
    if(!raw) continue;
    try{
      const parsed=JSON.parse(raw),result=migrateRunSnapshot(parsed);
      if(result.future) return {kind:"future",schema:result.snapshot.schema};
      if(!validateRunSnapshot(result.snapshot)) return {kind:"invalid"};
      const snap=result.snapshot,state=snap.state;
      return {kind:"run",name:state.name,className:state.className,level:state.level,depth:state.depth,gear:state.equipment?equipmentGearLevelFor(state.equipment):0,dead:!!snap.over||Number(state.hp)<=0};
    }catch(err){return {kind:"invalid"};}
  }
  return {kind:"empty"};
}
function canSwitchCharacterSlot(){ return (!S && !$("creator")?.hidden) || (!!S && !S.foe && !encounterWarningActive()); }
function renderCharacterSlots(){
  const root=$("characterSlotList"); if(!root) return;
  const safe=canSwitchCharacterSlot();
  root.innerHTML=[1,2,3].map(slot=>{
    const summary=slotSnapshotSummary(slot),active=slot===currentRunSlot;
    let title="Empty Chronicle",meta="Ready for a new delver.",button=active?"Active":"Create";
    if(summary.kind==="run"){
      title=`${summary.name}${summary.dead?" · dead":""}`;
      meta=`${summary.className} · Level ${summary.level} · ${formatDepth(summary.depth)}f · Gear ${Number(summary.gear||0).toFixed(1)}`;
      button=active?"Active":"Switch";
    }else if(summary.kind==="future"){title="Newer save format";meta=`Schema ${summary.schema} needs a newer Fathom build.`;button="Unavailable";}
    else if(summary.kind==="invalid"||summary.kind==="error"){title="Unreadable Chronicle";meta="This slot cannot be previewed safely.";button="Unavailable";}
    const disabled=active || summary.kind==="future" || summary.kind==="invalid" || summary.kind==="error" || (!safe && !active);
    const canDelete=summary.kind!=="empty";
    const deleteDisabled=canDelete && active && !safe;
    return `<div class="settings-slot${active?" active":""}"><div class="settings-slot-copy"><em>Slot ${slot}${active?" · active":""}</em><b>${esc(title)}</b><span>${esc(meta)}</span></div><div class="settings-slot-actions"><button class="settings-slot-btn${active?" active":""}" type="button" data-character-slot="${slot}" ${disabled?"disabled":""}>${esc(button)}</button>${canDelete?`<button class="settings-slot-delete" type="button" data-delete-character-slot="${slot}" ${deleteDisabled?"disabled":""}>Delete</button>`:""}</div></div>`;
  }).join("");
}
function deleteCharacterSlot(slot){
  slot=Number(slot);
  if(![1,2,3].includes(slot)) return false;
  const summary=slotSnapshotSummary(slot);
  if(summary.kind==="empty") return false;
  const active=slot===currentRunSlot;
  if(active && !canSwitchCharacterSlot()) return false;
  const label=summary.kind==="run" ? summary.name : `Slot ${slot}`;
  if(!window.confirm(`Delete ${label}?\n\nThis permanently erases this chronicle from Slot ${slot}. This cannot be undone.`)) return false;
  clearScheduledSave();
  try{
    localStorage.removeItem(runSlotKey(slot));
    if(slot===1) for(const key of LEGACY_SAVE_KEYS) localStorage.removeItem(key);
  }catch(err){
    console.error("Lowfathom character slot delete failed",err);
    return false;
  }
  if(!active){renderCharacterSlots();return true;}
  resetRuntimeForSlotChange();
  S=null;knowledge={};over=false;runSaveWritesBlocked=false;runSaveLoadIssue=null;
  creatorDraft={name:"",folk:null,trade:null,origin:null,className:null,startingLoadout:null,humanPlus2:null,humanPlus1:null,humanMinus2:null};
  openCreator({keepChoices:true});
  return true;
}

function resetRuntimeForSlotChange(){
  stopFathomDiePresentation();closeInfoSheet();
  stopEncounterWarningFrame();clearCombatTransitionTimers();clearCombatVictoryTimer();clearHollowTimer();stopLevelUpNoticeFrame();pauseBoonClock();
  closePack();closeCharacterSheet();closeSettingsSheet();closeLootHistory();closeEquipmentInspect();
  document.querySelectorAll(".dead,.save-integrity").forEach(n=>n.remove());
  encounterWarningState=null;suspendedEncounterWarningMs=null;suspendedLevelUpNoticeMs=null;suspendedHollowResumeMs=null;
  armed=null;combatVictoryPending=null;levelUpNoticeDeadline=0;levelUpNoticeDismissed=true;
}
function switchCharacterSlot(slot){
  slot=Number(slot);
  if(![1,2,3].includes(slot)||slot===currentRunSlot||!canSwitchCharacterSlot()) return false;
  pauseBoonClock();
  if(S && !saveRunNow()) return false;
  resetRuntimeForSlotChange();
  currentRunSlot=slot;saveActiveRunSlot();
  S=null;knowledge={};over=false;runSaveWritesBlocked=false;runSaveLoadIssue=null;
  const snapshot=loadRunSnapshot(slot);
  if(snapshot){restoreRun(snapshot);return true;}
  creatorDraft={name:"",folk:null,trade:null,origin:null,className:null,startingLoadout:null,humanPlus2:null,humanPlus1:null,humanMinus2:null};
  openCreator({keepChoices:true});
  if(runSaveLoadIssue) showSaveLoadIssueScreen(runSaveLoadIssue);
  return true;
}
const INFO_CHAPTERS = [
  {id:"skill-checks",title:"Skill checks"},
  {id:"aptitude",title:"Attributes"},
  {id:"combat-stats",title:"Combat stats"},
  {id:"practice",title:"Practice & Rank"},
  {id:"item-value",title:"Items & Gold"}
];
let infoChapterId="skill-checks";
function infoChapterHtml(id){
  if(id==="item-value") return `<h3>Items, iLv &amp; Coinage</h3><p>Fathom sets the expected power of the world. Rarity shifts a generated item's target, but the <b>finished properties</b> decide its real Item Level.</p><div class="info-step"><b>Intrinsic Value:</b> the internal mechanical cost of the properties actually on the item. On a full 1.0 slot, roughly 1 Intrinsic Value corresponds to 1 iLv.</div><div class="info-step"><b>Slot coefficients:</b> smaller slots carry less raw power. A Ring/Earring uses 0.40; Cape/Belt/Light/Pendant 0.50; Hat/Gloves/Boots 0.60; Bottoms 0.80; full hand/Top slots 1.00. Two-handed weapons use two hand slots.</div><div class="info-step"><b>Armor:</b> equipped Armor now reduces physical damage after a successful hit. It no longer supplies Defence Rating.</div><div class="info-step"><b>Critical Chance:</b> live on weapons, gloves and rings in 0.25 percentage-point steps. Rarity sets the item's hard cap and the existing continuation roll keeps high values uncommon. Ancient+ reaches 15% on a normal weapon/gloves and 5% on each ring; a main-hand dagger can reach 20%.</div><div class="info-step"><b>Appraised coin value:</b> appraisal starts from actual Intrinsic Value, then applies a restrained rarity/scarcity premium. A merchant may offer less or charge more; CHA modifies the transaction, not the item's combat power.</div><div class="info-step"><b>Bounded effects:</b> Boss Damage, Reflect and future Lifesteal retain item-stamped caps. Existing saved Crit affixes keep their exact values when a chronicle migrates.</div><div class="info-example"><b>Current live generated affixes</b><br>Critical Chance · Boss Damage · Damage Reflect. Lifesteal is supported by the combat/value engine but intentionally switched off in ordinary generation while recovery pressure is being tested.</div>`;
  if(id==="combat-stats") return `<h3>Combat stats</h3><p>Realtime combat separates accuracy, physical mitigation and health into three readable layers.</p><div class="info-step"><b>Accuracy:</b> Attack Rating is compared directly with the target's Defence Rating on the continuous realtime curve. At Attack 13 versus Defence 39 the hit chance is about 70.93%. A failed accuracy check is the only source of a <b>0</b> damage splat.</div><div class="info-step"><b>Defence Rating:</b> player Defence Rating comes from RSL: <code>39 × effective RSL / 10</code>. Set Your Feet and Sheltered multiply that RSL-derived rating.</div><div class="info-step"><b>Armor:</b> after a physical hit connects, Armor reduces its damage using the target's Armor relative to the expected medium Armor at the current depth. Matching expected medium Armor gives about 28.57% physical reduction.</div><div class="info-step"><b>Successful-hit floor:</b> Crit and Armor resolve after accuracy, then Guard if active. Any successful hit is clamped to at least <b>1 final damage</b>; 0 always means the accuracy roll failed.</div><div class="info-step"><b>Basic attacks:</b> Basic Max Hit is 80% of Weapon Attack Base, then a successful Basic rolls 75–100% of that value. Weapon Attack Base 20 therefore gives 12–16 raw Basic damage, averaging about 14 before Crit and Armor.</div><div class="info-step"><b>Crit Chance:</b> rolls only after a successful hit. DEX above 10 grants 0.075% per point, capped at 15%; equipped Crit gear is added afterward, with total Crit Chance technically capped at 100%.</div><div class="info-step"><b>Crit Damage:</b> starts at 150%. WIS above 10 becomes Precision; successive +50 percentage-point Crit Damage bands cost 500, 1,000, 2,000, 4,000 Precision and so on.</div><div class="info-step"><b>Damage types:</b> physical Armor only reduces physical damage. The mitigation helper accepts a damage type so future Magic Defence can be added without making Armor universal.</div>`;
  if(id==="aptitude") return `<h3>Attributes &amp; aptitude</h3><p>Attributes have direct combat jobs and also feed Skills. Skill checks compress enormous endless-game attributes before they touch the d100.</p><div class="info-step"><b>Combat jobs:</b> weapon scaling chooses STR, DEX or INT for Attack Rating; CON = Max HP; RSL = Defence Rating; DEX also contributes bounded Crit Chance; WIS supplies Precision for Crit Damage; CHA remains the people/economy stat.</div><div class="info-step"><b>1. Find the governing attribute.</b><br>Investigation uses INT. Perception uses WIS. Stealth uses DEX, and so on.</div><div class="info-step"><b>2. Convert it into aptitude.</b><br>Every doubling of that attribute changes aptitude by about <b>${SKILL_APTITUDE_PER_DOUBLING} Rating</b>. Attribute 10 is about +0; 20 about +8; 40 about +16; 80 about +24.</div><div class="info-step"><b>3. Add aptitude to training.</b><br>Skill Rank remains the main expertise number. Class proficiency and special circumstances are added afterward.</div><div class="info-equation">Effective Rating = Skill Rank + attribute aptitude + proficiency + circumstance</div><p>This keeps attributes relevant without letting a future 2,000 INT become a ridiculous +2,000 on the die.</p>`;
  if(id==="practice") return `<h3>Practice &amp; Rank</h3><p>Skills are long-term expertise. They improve by facing meaningful situations, not by repeating a harmless button forever.</p><div class="info-step"><b>Growing Rank requirement:</b> Rank 0 starts at ${skillXpNeeded(0)} XP to advance. Each later Rank asks for ${SKILL_XP_PER_RANK_GROWTH} more XP than the previous one.</div><div class="info-step"><b>Balanced success:</b> begins around ${SKILL_BASE_PRACTICE} XP. Practice rewards rise slowly with Skill Rank so deep expertise still moves, but the requirement rises faster.</div><div class="info-step"><b>Difficult success:</b> gives more practice. Easier uncertain work gives less. Automatic/trivial checks give none.</div><div class="info-step"><b>Failure:</b> a credible failed attempt can teach a smaller amount, but failure XP fades toward zero at extreme odds so hopeless attempts are poor training.</div><div class="info-step"><b>Against the Odds:</b> a success shown at <b>${SKILL_AGAINST_ODDS_PCT}% or lower</b> earns roughly double that difficult success's XP plus a small extra bonus.</div><div class="info-step"><b>No reroll farming:</b> the same generated opportunity has one practice identity and cannot award practice repeatedly.</div><div class="info-equation">XP to next Rank = ${SKILL_XP_BASE} + (${SKILL_XP_PER_RANK_GROWTH} × current Rank)</div><p>The Rank number can continue forever. Higher Rank lowers the roll you need against the same challenge until old obstacles become automatic.</p>`;
  return `<h3>Skill checks</h3><p>Skill bonuses do not get added to the d100. They change <b>how low a number you need to roll</b>.</p><div class="info-step"><b>1. Build your Effective Rating.</b><br>Skill Rank + attribute aptitude + class proficiency + circumstances.</div><div class="info-step"><b>2. Compare it with the challenge.</b><br>The game compares your Effective Rating with that object's fixed Challenge Rating.</div><div class="info-step"><b>3. That comparison becomes a target.</b><br>More Rating means a better chance and therefore a lower <b>Need X+</b> number.</div><div class="info-step"><b>4. Roll d100.</b><br>Meet or beat the target to succeed. If it says <b>Need 47+</b>, 47–100 succeeds and 1–46 fails.</div><div class="info-example"><b>Example</b><br>Investigation Rank 20 + INT aptitude 16 = Rating 36. Against Challenge Rating 21, you are +15 ahead: about a 76% chance, shown as <b>Need 25+ on d100</b>.</div><div class="info-step"><b>Huge advantage?</b> Old trivial obstacles eventually auto-succeed with no die roll. Huge disadvantage can become an automatic failure.</div><details class="info-details"><summary>Under the hood</summary><p>Equal Rating is 50%. A +${SKILL_RATING_SPREAD} Rating gap is about 91%; −${SKILL_RATING_SPREAD} is about 9%. The exact probability curve is <code>P = 1 / (1 + 10^(-(Skill − Challenge)/${SKILL_RATING_SPREAD}))</code>. You never need to calculate it yourself.</p></details>`;
}
function renderInfoSheet(){
  const list=$("infoChapterList"),body=$("infoChapterBody");
  if(!list||!body) return;
  if(!INFO_CHAPTERS.some(ch=>ch.id===infoChapterId)) infoChapterId=INFO_CHAPTERS[0].id;
  list.innerHTML=INFO_CHAPTERS.map(ch=>`<button class="info-chapter-btn${ch.id===infoChapterId?" selected":""}" type="button" data-info-chapter="${ch.id}">${esc(ch.title)}</button>`).join("");
  body.innerHTML=infoChapterHtml(infoChapterId);
}
function openInfoSheet(){
  const info=$("infoSheet");if(!info)return;
  info.hidden=false;renderInfoSheet();
}
function closeInfoSheet(){
  const info=$("infoSheet");if(info)info.hidden=true;
}
function renderSkillDiagnostics(){
  const root=$("skillDiagnostics"); if(!root) return;
  if(!S){root.innerHTML=`<div class="settings-note">Start or load a delver to collect Skill diagnostics.</div>`;return;}
  const d=ensureSkillDiagnostics();
  root.innerHTML=SKILL_ORDER.map(id=>{
    const x=d[id],name=SKILL_DEFS[id]?.name||id;
    return `<div class="skill-diagnostic-row"><b>${esc(name)}</b><span>${x.attempts} attempts · ${x.successes} success · ${x.failures} fail · <em>${Math.round(x.xp)} XP</em>${x.automatic?` · ${x.automatic} auto`:""}${x.againstOdds?` · ${x.againstOdds} odds`:""}</span></div>`;
  }).join("");
}
function resetSkillDiagnostics(){
  if(!S) return;
  if(!window.confirm("Reset only the temporary Skill diagnostics counters? Skill Rank and XP will not change.")) return;
  S.skillDiagnostics={};ensureSkillDiagnostics();renderSkillDiagnostics();requestRunSave();
}

function renderSettingsSheet(){
  const sheet=$("settingsSheet");
  if(!sheet) return;
  const creatorVisible=!$("creator")?.hidden;
  sheet.classList.toggle("travel-browse",!!S && !over && !S.foe && !creatorVisible);
  if(!sheet.hidden && over && !creatorVisible){
    sheet.hidden=true;
    return;
  }
  const noticeBtn=$("btnSettingNotices");
  if(noticeBtn){
    const on=!!settings.characterIndicators;
    noticeBtn.textContent=on?"On":"Off";
    noticeBtn.classList.toggle("on",on);
    noticeBtn.setAttribute("aria-pressed",String(on));
  }
  document.querySelectorAll("[data-encounter-grace]").forEach(btn=>{
    btn.classList.toggle("selected",Number(btn.dataset.encounterGrace)===settings.encounterGraceSeconds);
  });
  const diceBtn=$("btnSettingDice");
  if(diceBtn){
    const on=!!settings.diceAnimation;
    diceBtn.textContent=on?"On":"Off";
    diceBtn.classList.toggle("on",on);
    diceBtn.setAttribute("aria-pressed",String(on));
  }
  document.querySelectorAll("[data-dice-size]").forEach(btn=>{
    btn.classList.toggle("selected",btn.dataset.diceSize===settings.diceSize);
  });
  document.querySelectorAll("[data-combat-dice]").forEach(btn=>{
    btn.classList.toggle("selected",btn.dataset.combatDice===settings.combatDice);
  });
  document.querySelectorAll("[data-combat-font]").forEach(btn=>{
    btn.classList.toggle("selected",btn.dataset.combatFont===settings.combatFont);
  });
  document.querySelectorAll("[data-world-zoom]").forEach(btn=>{
    btn.classList.toggle("selected",btn.dataset.worldZoom===settings.worldZoom);
  });
  document.querySelectorAll("[data-minimap-size]").forEach(btn=>{
    btn.classList.toggle("selected",btn.dataset.minimapSize===settings.minimapSize);
  });
  const pacingEl=$("runPacingDiagnostics");
  if(pacingEl){
    if(!S)pacingEl.innerHTML=`<div class="settings-note">Start or load a delver to collect run pacing.</div>`;
    else{
      const p=ensureRunPacing(),milestones=[100,250,500].map(mark=>{
        const ms=p.milestones?.[String(mark)];
        return `<div><span>${mark} fathoms</span><b>${ms==null?"not timed":formatRunPacingTime(ms)}</b></div>`;
      }).join("");
      pacingEl.innerHTML=`<div><span>Foreground run time</span><b>${formatRunPacingTime(p.foregroundMs)}</b></div><div><span>Actual movement time</span><b>${formatRunPacingTime(p.movementMs)}</b></div>${milestones}`;
    }
  }
  renderSkillDiagnostics();
  renderCharacterSlots();
}
function openSettingsSheet(){
  closeTravelLogPopup();
  const creatorVisible=!$("creator")?.hidden;
  if((over || !S) && !creatorVisible) return;
  $("settingsSheet").hidden=false;
  renderSettingsSheet();
  syncBrowseTravelUI();
}
function closeSettingsSheet(){
  closeInfoSheet();
  const sheet=$("settingsSheet");
  if(sheet) sheet.hidden=true;
  syncBrowseTravelUI();
}

/* ============================================================
   v0.081.0 — SESSION 8 PERSISTENCE FOUNDATION
   ============================================================ */
function profileById(id){
  if(!id) return null;
  if(id===BOSS_PROFILE.id) return BOSS_PROFILE;
  if(id===MIMIC_PROFILE.id) return MIMIC_PROFILE;
  return FOES.find(f=>f.id===id) || null;
}
function cloneForSave(value){
  return value==null ? value : JSON.parse(JSON.stringify(value));
}
function normalizedStateForSave(){
  if(!S) return null;
  const copy=cloneForSave(S);
  if(copy.boon){
    copy.boon.remainingMs=boonRemainingMs();
    copy.boon.expiresAt=null;
    copy.boon.frozen=true;
  }
  if(copy.activeHollow && copy.activeHollow.kind!=="stage" && !copy.activeHollow.autoResumeCancelled){
    const remaining=suspendedHollowResumeMs!=null
      ? suspendedHollowResumeMs
      : Math.max(0,(S.activeHollow.autoResumeAt||Date.now())-Date.now());
    copy.activeHollow.autoResumeRemainingMs=remaining;
    copy.activeHollow.autoResumeAt=null;
  }
  return copy;
}
function pendingEncounterForSave(){
  if(!encounterWarningState) return null;
  const remaining=suspendedEncounterWarningMs!=null
    ? suspendedEncounterWarningMs
    : Math.max(0,encounterWarningState.deadline-performance.now());
  const options={...(encounterWarningState.options||{})};
  delete options.profile;
  return {
    options,
    profileId:encounterWarningState.profile?.id||null,
    priorMode:encounterWarningState.priorMode||"stopped",
    remainingMs:remaining,
    durationMs:encounterWarningState.durationMs||encounterWarningDurationMs(),
    variantIndex:encounterWarningState.variantIndex||0
  };
}
function levelUpNoticeForSave(){
  if(levelUpNoticeDismissed || !S?.statPoints) return null;
  const remaining=suspendedLevelUpNoticeMs!=null
    ? suspendedLevelUpNoticeMs
    : levelUpNoticeDeadline ? Math.max(0,levelUpNoticeDeadline-performance.now()) : LEVELUP_NOTICE_MS;
  return {remainingMs:remaining};
}
function buildRunSnapshot(){
  if(!S) return null;
  const state=normalizedStateForSave();
  const dead=!!over || Number(state?.hp)<=0;
  // Permadeath invariant: once a run is dead, every subsequent save remains dead.
  if(dead && state && Number(state.hp)>0) state.hp=0;
  return {
    schema:SAVE_SCHEMA,
    build:BUILD_VERSION,
    savedAt:Date.now(),
    state,
    knowledge:cloneForSave(knowledge||{}),
    over:dead,
    pendingEncounter:dead?null:pendingEncounterForSave(),
    levelUpNotice:dead?null:levelUpNoticeForSave(),
    ui:{travelLogExpanded:!!travelLogExpanded,combatLogCollapsed:!!combatLogCollapsed}
  };
}
function isSaveRecord(value){
  return !!value && typeof value==="object" && !Array.isArray(value);
}
function migrateSave1To2(snapshot){
  const next=cloneForSave(snapshot);
  next.schema=2;
  if(!isSaveRecord(next.knowledge)) next.knowledge={};
  if(!isSaveRecord(next.ui)) next.ui={};
  // Schema 2 makes death authoritative from either the explicit flag or HP.
  next.over=!!next.over || Number(next.state?.hp)<=0;
  if(next.over && next.state && Number(next.state.hp)>0) next.state.hp=0;
  return next;
}
function migrateSave2To3(snapshot){
  const next=cloneForSave(snapshot);
  next.schema=3;
  const state=next.state;
  if(isSaveRecord(state)){
    // v0.084.0 expands major strata from 60 to 500 fathoms. Old stratum-indexed
    // recovery/boss/run/side markers cannot be reinterpreted safely, so reset
    // only those pacing markers. Character progression, depth, gear, inventory,
    // Bestiary knowledge and combat resources remain untouched.
    state.hollowStates={};
    state.activeHollow=null;
    state.bossDefeated={};state.midBossDefeated={};
    state.runAttemptStratum=null;
    state.runAttempts=0;
    if(!state.sideArea || state.sideArea.completed || state.sideArea.abandoned){
      state.sideDiscoveryStratum=null;
      state.sideDiscoveryAttempted=false;
      state.sideAreaResolved=false;
      state.sideDiscoveryAt=Number(state.depth)||0;
    }
  }
  if(next.pendingEncounter?.options?.boss) next.pendingEncounter=null;
  return next;
}
function migrateSave3To4(snapshot){
  const next=cloneForSave(snapshot);
  next.schema=4;
  const state=next.state;
  if(isSaveRecord(state)){
    if(!isSaveRecord(state.generatedItems)) state.generatedItems={};
    if(!Array.isArray(state.combatLog)) state.combatLog=[];
    if(!Number.isInteger(state.generatedItemSeq)) state.generatedItemSeq=0;
  }
  if(!isSaveRecord(next.ui)) next.ui={};
  if(typeof next.ui.combatLogCollapsed!=="boolean") next.ui.combatLogCollapsed=true;
  return next;
}
function migrateSave4To5(snapshot){
  const next=cloneForSave(snapshot);next.schema=5;
  const state=next.state;
  if(isSaveRecord(state)){
    if(isSaveRecord(state.skills)) for(const st of Object.values(state.skills)){
      if(!isSaveRecord(st)) continue;
      const rank=Math.max(0,Number(st.rank)||0),oldNeed=3+rank*2,oldXp=Math.max(0,Number(st.xp)||0);
      st.rank=Math.floor(rank);st.xp=Math.round(clamp(oldXp/Math.max(1,oldNeed),0,.999)*100);
    }
    if(!Number.isInteger(state.stealthOpportunitySeq)) state.stealthOpportunitySeq=0;
    if(!isSaveRecord(state.concealment)) state.concealment=null;
    if(!isSaveRecord(state.abilities)) state.abilities={};
    for(const id of UNIVERSAL_ABILITY_IDS){
      const def=ABILITY_DEFS[id];
      if(def && !isSaveRecord(state.abilities[id])) state.abilities[id]={cur:def.max,max:def.max,degree:def.degree};
    }
  }
  return next;
}
function migrateSave5To6(snapshot){
  const next=cloneForSave(snapshot);next.schema=6;
  const state=next.state;
  if(isSaveRecord(state)){
    if(isSaveRecord(state.skills)) for(const st of Object.values(state.skills)){
      if(!isSaveRecord(st))continue;
      const rank=Math.max(0,Math.floor(Number(st.rank)||0)),oldXp=Math.max(0,Number(st.xp)||0);
      st.rank=rank;
      // v0.088.x used 100 XP at every Rank. Preserve the same percentage toward
      // the next Rank when moving onto the growing 9E requirement.
      st.xp=Math.round(clamp(oldXp/100,0,.999)*skillXpNeeded(rank));
    }
    state.skillDiagnostics={};
    // Recover the exact known side-cache bug from v0.088.x: Reinforced Buckler
    // was described as equipment but stored in misc inventory instead.
    const misplacedBucklers=Math.max(0,Math.floor(Number(state.inventory?.misc?.["Reinforced Buckler"])||0));
    if(misplacedBucklers && EQUIPMENT_ITEMS.reinforced_buckler){
      if(!isSaveRecord(state.generatedItems))state.generatedItems={};
      if(!Array.isArray(state.inventory.equipment))state.inventory.equipment=[];
      for(let i=0;i<misplacedBucklers;i++){
        state.generatedItemSeq=(Number(state.generatedItemSeq)||0)+1;
        const id=`legacy_reward_${state.generatedItemSeq}_${i}`;
        state.generatedItems[id]={...cloneForSave(EQUIPMENT_ITEMS.reinforced_buckler),id,generated:false,authoredReward:true};
        state.inventory.equipment.push(id);
      }
      delete state.inventory.misc["Reinforced Buckler"];
    }
    if(state.bleeding){
      state.bleedRemainingMs=BLEED_DURATION_MS;state.bleedAccumulatorMs=0;state.bleedCombatTurns=0;
    }else{
      state.bleedRemainingMs=0;state.bleedAccumulatorMs=0;state.bleedCombatTurns=0;
    }
    delete state.bleedTravel;
  }
  return next;
}
function migrateSave6To7(snapshot){
  const next=cloneForSave(snapshot);next.schema=7;
  const state=next.state;
  if(isSaveRecord(state)){
    state.gold=Math.max(0,Math.round(Number(state.gold)||0));
    if(!isSaveRecord(state.generatedItems)) state.generatedItems={};
    for(const item of Object.values(state.generatedItems)){
      if(!isSaveRecord(item)) continue;
      // Existing generated pieces keep their exact stats/affixes. We only translate
      // those contents onto the 9F value scale and derive the corresponding iLv.
      stampItemEconomy(item,{recalculateGeneratedIlvl:!!item.generated});
      if(item.generated) item.stats=generatedStatsLines(item);
    }
  }
  return next;
}
function migrateSave7To8(snapshot){
  const next=cloneForSave(snapshot);next.schema=8;
  const state=next.state;
  if(isSaveRecord(state)){
    if(!isSaveRecord(state.townState)) state.townState={currentId:null,visited:{},departed:{}};
    if(!isSaveRecord(state.townState.visited)) state.townState.visited={};
    if(!isSaveRecord(state.townState.departed)) state.townState.departed={};
    if(typeof state.townState.currentId!=="string") state.townState.currentId=null;
    // Saves already deeper than the temporary test town must never be pulled
    // backward into it after updating. Treat the authored location as passed.
    for(const town of TOWN_DEFS){
      if((Number(state.depth)||0)>town.depth+.001 && state.townState.currentId!==town.id) state.townState.departed[town.id]=true;
    }
  }
  return next;
}
function migrateSave8To9(snapshot){
  const next=cloneForSave(snapshot);next.schema=9;const state=next.state;
  if(isSaveRecord(state)){
    if(!isSaveRecord(state.quests))state.quests={instances:[],nextSerial:1,exploreAccumulator:0};
    if(!Array.isArray(state.quests.instances))state.quests.instances=[];
    state.quests.nextSerial=Math.max(1,Math.floor(Number(state.quests.nextSerial)||1));
    state.quests.exploreAccumulator=Math.max(0,Number(state.quests.exploreAccumulator)||0);
    if(!isSaveRecord(state.inventory))state.inventory={};
    if(!Array.isArray(state.inventory.questItems))state.inventory.questItems=[];
    if(!isSaveRecord(state.charNotices))state.charNotices={};
    for(const k of ["overview","status","skills","equipment","bestiary","abilities","quests","journal"])if(!(k in state.charNotices))state.charNotices[k]=false;
  }
  return next;
}
function migrateSave9To10(snapshot){
  const next=cloneForSave(snapshot);next.schema=10;const state=next.state;
  if(isSaveRecord(state)){
    if(!isSaveRecord(state.townState))state.townState={currentId:null,visited:{},departed:{},services:{}};
    if(!isSaveRecord(state.townState.visited))state.townState.visited={};if(!isSaveRecord(state.townState.departed))state.townState.departed={};if(!isSaveRecord(state.townState.services))state.townState.services={};
    if(isSaveRecord(state.quests)&&Array.isArray(state.quests.instances)){
      for(const inst of state.quests.instances){
        if(!isSaveRecord(inst)||inst.status!=="active")continue;
        if(inst.definitionId==="grey-lantern-cave-mushrooms"&&!inst.targetTownId){inst.targetTownId="lantern-city";inst.targetLocationId="herbalist";inst.targetNpcName="Mara Venn";inst.targetDepth=200;}
      }
    }
    // New authored settlements should remain reachable when they are still ahead,
    // but an older save already deeper than them must not be pulled backward.
    for(const town of TOWN_DEFS){if((Number(state.depth)||0)>town.depth+.001&&state.townState.currentId!==town.id)state.townState.departed[town.id]=true;}
  }
  return next;
}
function migrateSave10To11(snapshot){
  const next=cloneForSave(snapshot);next.schema=11;const state=next.state;
  if(isSaveRecord(state)){
    if(!isSaveRecord(state.caravans))state.caravans={pending:null,history:[],routeRolls:{},warning:null,nextSerial:1,activeMerchant:null};
    if(!Array.isArray(state.caravans.history))state.caravans.history=[];
    if(!isSaveRecord(state.caravans.routeRolls))state.caravans.routeRolls={};
    state.caravans.nextSerial=Math.max(1,Math.floor(Number(state.caravans.nextSerial)||1));
    if(!isSaveRecord(state.caravans.pending))state.caravans.pending=null;
    if(!isSaveRecord(state.caravans.warning))state.caravans.warning=null;
    if(!isSaveRecord(state.caravans.activeMerchant))state.caravans.activeMerchant=null;
  }
  return next;
}
function migrateSave11To12(snapshot){
  const next=cloneForSave(snapshot);next.schema=12;const state=next.state;
  if(isSaveRecord(state)){
    if(!isSaveRecord(state.caravans))state.caravans={pending:null,history:[],routeRolls:{},warning:null,nextSerial:1,activeMerchant:null};
    const activeCaravan=state.travelEvent?.id==="caravan"||!!state.foe?.caravan||!!state.caravans.activeMerchant;
    // v0.107.0 could have a merchant and a separately scheduled caravan pending
    // simultaneously. Retire only the unseen legacy caravan so the established
    // wandering-merchant slot becomes the single source of future road traffic.
    if(!activeCaravan){state.caravans.pending=null;state.caravans.warning=null;state.caravans.activeMerchant=null;}
    state.caravans.routeRolls={};
  }
  return next;
}
function migrateSave12To13(snapshot){
  const next=cloneForSave(snapshot);next.schema=13;const state=next.state;
  if(isSaveRecord(state)&&!isSaveRecord(state.interactionState))state.interactionState={active:null,pending:null,nextSerial:1};
  return next;
}
function critAffixCapForItem(item){
  if(!item)return 0;
  if(item.kind==="weapon" || ["sword","greatsword","axe","dagger","shortsword","bow","wand","staff","unarmed"].includes(item.family)) return item.family==="dagger"?5:2.5;
  if(item.slot==="gloves" || item.family==="ring" || (item.slots||[]).some(slot=>String(slot).startsWith("ring"))) return 2.5;
  return 0;
}
function normalizeCritAffixOnItem(item){
  if(!isSaveRecord(item?.affixes)||!isSaveRecord(item.affixes.crit))return false;
  const cap=critAffixCapForItem(item),old=item.affixes.crit;
  if(cap<=0){delete item.affixes.crit;return true;}
  const oldPct=Math.max(0,Number(old.pct)||Number(old.units)||0);
  const pct=Math.min(cap,Math.round(oldPct/CRIT_AFFIX_STEP_PCT)*CRIT_AFFIX_STEP_PCT);
  if(pct<=0){delete item.affixes.crit;return true;}
  const units=Math.max(1,Math.round(pct/CRIT_AFFIX_STEP_PCT));
  item.affixes.crit={units,pct:units*CRIT_AFFIX_STEP_PCT,value:units*EQUIPMENT_AFFIXES.crit.unitCost};
  return true;
}
function migrateSave13To14(snapshot){
  const next=cloneForSave(snapshot);next.schema=14;const state=next.state;
  if(isSaveRecord(state)){
    state.protection=Math.max(0,Math.round(Number(state.protection)||0));
    state.protectionMax=Math.max(state.protection,Math.round(Number(state.protectionMax)||0));
    if(!state.foe){state.protection=0;state.protectionMax=0;}
    if(isSaveRecord(state.generatedItems)){
      for(const item of Object.values(state.generatedItems)){
        if(!isSaveRecord(item))continue;
        const changed=normalizeCritAffixOnItem(item);
        if(changed){stampItemEconomy(item,{recalculateGeneratedIlvl:!!item.generated});if(item.generated)item.stats=generatedStatsLines(item);}
      }
    }
  }
  return next;
}
function migrateSave14To15(snapshot){
  const next=cloneForSave(snapshot);next.schema=15;const state=next.state;
  if(isSaveRecord(state)){
    state.combatActor="player";
    state.combatExtraTurns={player:0,enemy:0};
    state.defencePrepared=null;
    state.negateNextAttack=null;
    state.turn=Math.max(1,Math.floor(Number(state.turn)||1));
    if(isSaveRecord(state.foe)){
      state.foe.guardActive=false;state.foe.dodgeActive=false;state.foe.feintBaitedDodge=false;
    }else state.protection=0;
  }
  return next;
}
function deterministicUnitRandom(seedText){
  let h=2166136261>>>0;
  for(const ch of String(seedText||"")){h^=ch.charCodeAt(0);h=Math.imul(h,16777619)>>>0;}
  return ()=>{
    h+=0x6D2B79F5;
    let t=h;
    t=Math.imul(t^(t>>>15),t|1);
    t^=t+Math.imul(t^(t>>>7),t|61);
    return ((t^(t>>>14))>>>0)/4294967296;
  };
}
function critAffixHardUnitsForItem(item){
  return Math.max(0,Math.round(critAffixCapForItem(item)/CRIT_AFFIX_STEP_PCT));
}
function restampExistingCritForRarity(item){
  if(!isSaveRecord(item?.affixes)||!isSaveRecord(item.affixes.crit))return false;
  const hard=critAffixHardUnitsForItem(item);
  if(hard<=0){delete item.affixes.crit;return true;}
  const oldPct=Math.max(0,Number(item.affixes.crit.pct)||Number(item.affixes.crit.units)*0.5||0);
  const oldUnits=Math.max(1,Math.round(oldPct/CRIT_AFFIX_STEP_PCT));
  const roller=deterministicUnitRandom(`${item.id||item.name||"item"}|${item.rarity||"Common"}|crit-v01102`);
  const rarityCap=rolledCritMaxUnits(item.rarity||"Common",hard,roller);
  const units=Math.max(1,Math.min(hard,oldUnits,rarityCap));
  item.affixes.crit={units,pct:units*CRIT_AFFIX_STEP_PCT,value:units*EQUIPMENT_AFFIXES.crit.unitCost};
  return true;
}
function migrateSave15To16(snapshot){
  const next=cloneForSave(snapshot);next.schema=16;const state=next.state;
  if(isSaveRecord(state)){
    if(isSaveRecord(state.foe)){
      // Legacy Guarding/Dodging flags represented a second future-action layer.
      // v0.110.2 uses only the currently committed foe action shown in the panel.
      state.foe.guardActive=false;state.foe.dodgeActive=false;state.foe.feintBaitedDodge=false;
    }
    if(isSaveRecord(state.generatedItems)){
      for(const item of Object.values(state.generatedItems)){
        if(!isSaveRecord(item)||!item.generated)continue;
        if(restampExistingCritForRarity(item)){
          stampItemEconomy(item,{recalculateGeneratedIlvl:true});
          item.stats=generatedStatsLines(item);
        }
      }
    }
  }
  return next;
}
function migrateSave16To17(snapshot){
  const next=cloneForSave(snapshot);next.schema=17;const state=next.state;
  if(isSaveRecord(state)){
    // Timeline V2 cannot safely infer a partially resolved v0.110 exchange. Resume
    // any live encounter at a clean player slot with the current foe/HP intact.
    state.combatActor="player";
    state.combatTimeline=null;
    state.reactionAvailable=true;
    state.reactionWindow=false;
    state.protection=0;
    state.protectionMax=0;
    state.protectionSource=null;
    state.defencePrepared=null;
    state.negateNextAttack=null;
    state.combatExtraTurns={player:0,enemy:0};
    state.turn=Math.max(1,Math.floor(Number(state.turn)||1));
    state.heavyCharge=Math.min(1,Math.max(0,Math.floor(Number(state.heavyCharge)||0)));
    if(isSaveRecord(state.foe)){
      state.foe.heavyStage=state.foe.intent==="heavy"?1:0;
      if(!Array.isArray(state.foe.backgroundCharges))state.foe.backgroundCharges=[];
    }
  }
  return next;
}
function migrateSave17To18(snapshot){
  const next=cloneForSave(snapshot);next.schema=18;const state=next.state;
  if(isSaveRecord(state)){
    // Reaction Points changes the meaning of an enemy turn. Resume any live
    // v0.111.0 encounter at a clean Player slot instead of resolving an old
    // half-finished reaction under the new rules.
    state.combatActor="player";
    state.combatTimeline=null;
    state.reactionMax=REACTION_MAX;
    state.reactionPoints=REACTION_MAX;
    state.reactionAvailable=true;
    state.reactionWindow=false;
    state.protection=0;
    state.protectionMax=0;
    state.protectionSource=null;
    state.defencePrepared=null;
    state.defenceChain=0;
    state.negateNextAttack=null;
    if(state.boon?.id==="oiled")state.boon=null;
    if(isSaveRecord(state.foe)){
      state.foe.reaction=null;
      state.foe.noDodgeNextReaction=false;
      if(state.foe.intent==="guard"||state.foe.intent==="dodge"){
        state.foe.intent="quick";
        state.foe.heavyStage=0;
      }
    }
  }
  return next;
}
function migrateSave18To19(snapshot){
  const next=cloneForSave(snapshot);next.schema=19;const state=next.state;
  if(isSaveRecord(state)){
    // v0.111.2 removes the RP reaction budget. Resume a live v0.111.1 encounter
    // from a clean Player slot so no saved half-reaction resolves under new rules.
    state.combatActor="player";
    state.combatTimeline=null;
    state.reactionAvailable=true;
    state.reactionWindow=false;
    state.protection=0;
    state.protectionMax=0;
    state.protectionSource=null;
    state.defencePrepared=null;
    state.negateNextAttack=null;
    state.reactionMax=REACTION_MAX;
    state.reactionPoints=REACTION_MAX;
    state.turn=Math.max(1,Math.floor(Number(state.turn)||1));
    if(isSaveRecord(state.foe)){
      state.foe.reaction=null;
      state.foe.noDodgeNextReaction=false;
    }
  }
  return next;
}

function migrateSave19To20(snapshot){
  const next=cloneForSave(snapshot);next.schema=20;
  const state=isSaveRecord(next.state)?next.state:null;
  if(state){
    state.staminaMax=PLAYER_TURN_STAMINA;state.stamina=PLAYER_TURN_STAMINA;
    state.combatActor="player";state.combatTimeline=null;
    state.reactionMax=REACTION_MAX;state.reactionPoints=REACTION_MAX;state.reactionAvailable=false;state.reactionWindow=false;
    state.protection=0;state.protectionMax=0;state.protectionSource=null;state.defencePrepared=null;state.negateNextAttack=null;
    state.heavyCharge=0;state.strikeChain=0;state.defenceChain=0;
    if(state.foe&&typeof state.foe==="object"){
      state.foe={...state.foe,reaction:null,noDodgeNextReaction:false};
      if(state.foe.intent==="guard"||state.foe.intent==="dodge") state.foe.intent="quick";
      if(state.foe.intent==="heavy") state.foe.heavyStage=Math.max(1,Math.min(2,Number(state.foe.heavyStage)||1));
    }
    next.state=state;
  }
  return next;
}
function migrateSave20To21(snapshot){
  const next=cloneForSave(snapshot);next.schema=21;
  const state=isSaveRecord(next.state)?next.state:null;
  if(state){
    state.skills=isSaveRecord(state.skills)?state.skills:{};
    for(const id of ["persuasion","deception"]){
      if(!isSaveRecord(state.skills[id]))state.skills[id]={rank:0,xp:0};
    }
    if(!("temporaryCompanion" in state))state.temporaryCompanion=null;
    next.state=state;
  }
  return next;
}
function migrateSave21To22(snapshot){
  const next=cloneForSave(snapshot);next.schema=22;
  const state=isSaveRecord(next.state)?next.state:null;
  if(state){
    const old=Math.max(0,Number(state.restRecovery)||0);
    state.restRecovery=Math.min(REST_RECOVERY_REQUIRED,(old/20)*REST_RECOVERY_REQUIRED);
    if(!isSaveRecord(state.runPacing))state.runPacing={foregroundMs:0,movementMs:0,milestones:{}};
    next.state=state;
  }
  return next;
}
function migrateSave22To23(snapshot){
  const next=cloneForSave(snapshot);next.schema=23;
  const state=isSaveRecord(next.state)?next.state:null;
  if(state){
    // Park, do not delete, authored passage state. This preserves the data for a
    // future redesign while preventing old instance-era side logic from moving
    // the player or blocking a physical passage in Active World.
    if(isSaveRecord(state.sideArea)){
      state.sideArea.paused=true;
      state.sideArea.parkedAtBuild="v0.203.9.3";
      state.sideDiscoveryAttempted=true;
      state.sideAreaResolved=true;
    }
    if(isSaveRecord(state.travelEvent)&&String(state.travelEvent.id||"").startsWith("side-"))state.travelEvent=null;
    if(state.travelMode==="side")state.travelMode="stopped";
    if(isSaveRecord(state.inventory)&&state.inventory.passageKey)state.inventory.passageKey=null;
    next.state=state;
  }
  return next;
}
function migrateSave23To24(snapshot){
  const next=cloneForSave(snapshot);next.schema=24;
  const state=isSaveRecord(next.state)?next.state:null;
  if(state){
    // v0.205.0 adds Resilience without retroactively rewriting a delver. Existing
    // levels, XP progress, unspent points, Armor and saved Crit affixes stay exact.
    if(!Number.isFinite(Number(state.RSL)))state.RSL=10;
    next.state=state;
  }
  return next;
}
const SAVE_MIGRATIONS={
  1:migrateSave1To2,
  2:migrateSave2To3,
  3:migrateSave3To4,
  4:migrateSave4To5,
  5:migrateSave5To6,
  6:migrateSave6To7,
  7:migrateSave7To8,
  8:migrateSave8To9,
  9:migrateSave9To10,
  10:migrateSave10To11,
  11:migrateSave11To12,
  12:migrateSave12To13,
  13:migrateSave13To14,
  14:migrateSave14To15,
  15:migrateSave15To16,
  16:migrateSave16To17,
  17:migrateSave17To18,
  18:migrateSave18To19,
  19:migrateSave19To20,
  20:migrateSave20To21,
  21:migrateSave21To22,
  22:migrateSave22To23,
  23:migrateSave23To24
};
function migrateRunSnapshot(snapshot){
  if(!isSaveRecord(snapshot) || !Number.isInteger(snapshot.schema)) throw new Error("Missing or invalid save schema.");
  if(snapshot.schema>SAVE_SCHEMA) return {future:true,snapshot};
  if(snapshot.schema<1) throw new Error(`Unsupported save schema ${snapshot.schema}.`);
  let migrated=cloneForSave(snapshot);
  while(migrated.schema<SAVE_SCHEMA){
    const from=migrated.schema;
    const migrate=SAVE_MIGRATIONS[from];
    if(typeof migrate!=="function") throw new Error(`No migration exists for save schema ${from}.`);
    migrated=migrate(migrated);
    if(!isSaveRecord(migrated) || migrated.schema!==from+1) throw new Error(`Save migration ${from} -> ${from+1} failed.`);
  }
  return {future:false,snapshot:migrated};
}
function validateRunSnapshot(snapshot){
  if(!isSaveRecord(snapshot) || snapshot.schema!==SAVE_SCHEMA || !isSaveRecord(snapshot.state)) return false;
  const state=snapshot.state;
  if(typeof state.name!=="string" || !state.name.trim()) return false;
  if(typeof state.className!=="string" || !state.className.trim()) return false;
  if(!Number.isFinite(state.hp) || !Number.isFinite(state.hpMax) || state.hpMax<=0) return false;
  if(!Number.isFinite(state.depth) || state.depth<0) return false;
  if(!Number.isInteger(state.level) || state.level<1) return false;
  if(snapshot.knowledge!=null && !isSaveRecord(snapshot.knowledge)) return false;
  if(snapshot.ui!=null && !isSaveRecord(snapshot.ui)) return false;
  if(snapshot.pendingEncounter!=null && !isSaveRecord(snapshot.pendingEncounter)) return false;
  if(snapshot.levelUpNotice!=null && !isSaveRecord(snapshot.levelUpNotice)) return false;
  return true;
}
function quarantineRunSave(sourceKey,raw,reason,slot=currentRunSlot){
  try{
    // Keep the untouched bytes. Only remove the active copy after preservation succeeds.
    localStorage.setItem(runQuarantineKey(slot),raw);
    localStorage.removeItem(sourceKey);
    console.error(`Lowfathom quarantined unreadable save from ${sourceKey}: ${reason}`);
    return true;
  }catch(err){
    console.error("Lowfathom could not quarantine an unreadable save",err);
    return false;
  }
}
function persistCanonicalSnapshot(snapshot,sourceKey,slot=currentRunSlot){
  const targetKey=runSlotKey(slot);
  try{
    localStorage.setItem(targetKey,JSON.stringify(snapshot));
    if(sourceKey!==targetKey) localStorage.removeItem(sourceKey);
    return true;
  }catch(err){
    console.error("Lowfathom could not rewrite the migrated save",err);
    return false;
  }
}
function clearScheduledSave(){
  if(saveTimer!==null){clearTimeout(saveTimer);saveTimer=null;}
}
function saveRunNow(){
  clearScheduledSave();
  if(restoringRun || !S || runSaveWritesBlocked) return false;
  try{
    localStorage.setItem(runSlotKey(),JSON.stringify(buildRunSnapshot()));
    lastSaveAt=Date.now();
    return true;
  }catch(err){
    console.error("Lowfathom save failed",err);
    return false;
  }
}
function requestRunSave(){
  if(restoringRun || !S || runSaveWritesBlocked) return;
  const wait=Math.max(0,SAVE_THROTTLE_MS-(Date.now()-lastSaveAt));
  if(wait===0){saveRunNow();return;}
  if(saveTimer===null) saveTimer=setTimeout(()=>{saveTimer=null;saveRunNow();},wait);
}
function clearRunSave(slot=currentRunSlot){
  clearScheduledSave();
  if(runSaveWritesBlocked) return false;
  try{
    localStorage.removeItem(runSlotKey(slot));
    if(Number(slot)===1) for(const key of LEGACY_SAVE_KEYS) localStorage.removeItem(key);
    return true;
  }catch(err){
    console.error("Lowfathom save clear failed",err);
    return false;
  }
}
function loadRunSnapshot(slot=currentRunSlot){
  runSaveWritesBlocked=false;
  runSaveLoadIssue=null;
  let quarantinedSomething=false;
  const canonicalKey=runSlotKey(slot);
  const keys=[canonicalKey,...(Number(slot)===1?LEGACY_SAVE_KEYS:[])];

  for(const sourceKey of keys){
    let raw=null;
    try{raw=localStorage.getItem(sourceKey);}catch(err){
      console.error("Lowfathom save storage read failed",err);
      continue;
    }
    if(!raw) continue;

    let parsed;
    try{parsed=JSON.parse(raw);}catch(err){
      if(!quarantineRunSave(sourceKey,raw,"malformed JSON",slot)){
        runSaveWritesBlocked=true;
        runSaveLoadIssue={kind:"corrupt",quarantined:false};
        return null;
      }
      quarantinedSomething=true;
      continue;
    }

    let result;
    try{result=migrateRunSnapshot(parsed);}catch(err){
      if(!quarantineRunSave(sourceKey,raw,err.message||"migration failed",slot)){
        runSaveWritesBlocked=true;
        runSaveLoadIssue={kind:"corrupt",quarantined:false};
        return null;
      }
      quarantinedSomething=true;
      continue;
    }

    if(result.future){
      runSaveWritesBlocked=true;
      runSaveLoadIssue={kind:"future",schema:result.snapshot.schema};
      return null;
    }

    const snapshot=result.snapshot;
    if(!validateRunSnapshot(snapshot)){
      if(!quarantineRunSave(sourceKey,raw,"required save fields were invalid",slot)){
        runSaveWritesBlocked=true;
        runSaveLoadIssue={kind:"corrupt",quarantined:false};
        return null;
      }
      quarantinedSomething=true;
      continue;
    }

    if(sourceKey!==canonicalKey || parsed.schema!==SAVE_SCHEMA) persistCanonicalSnapshot(snapshot,sourceKey,slot);
    if(quarantinedSomething) console.warn("Lowfathom recovered a valid older chronicle after quarantining a bad save.");
    return snapshot;
  }

  if(quarantinedSomething) runSaveLoadIssue={kind:"corrupt",quarantined:true};
  return null;
}
function showSaveLoadIssueScreen(issue){
  if(!issue) return;
  document.querySelectorAll(".save-integrity").forEach(n=>n.remove());
  const d=document.createElement("div");
  d.className="dead save-integrity";
  if(issue.kind==="future"){
    d.innerHTML=`<h2>This chronicle needs a newer Fathom build.</h2>
      <p>The save uses schema ${Number(issue.schema)||"?"}, but this app only understands schema ${SAVE_SCHEMA}. It has not been changed or overwritten.</p>
      <p>Reconnect if needed, then reload Fathom so the installed app can update.</p>
      <button id="btnRetrySaveLoad" type="button">Reload Fathom</button>`;
    $("arena").appendChild(d);
    $("btnRetrySaveLoad").addEventListener("click",()=>location.reload());
    return;
  }
  const preserved=issue.quarantined
    ? "The unreadable save was preserved in a recovery slot on this device before the active slot was cleared."
    : "The unreadable save could not be copied safely, so Fathom has blocked save writes to avoid destroying it.";
  d.innerHTML=`<h2>The chronicle save could not be read.</h2>
    <p>${preserved}</p>
    ${issue.quarantined?`<p>You can start a new delver without overwriting that recovery copy.</p><button id="btnContinueAfterCorruptSave" type="button">Continue to Character Creation</button>`:`<p>Do not start a new run in this build. Reload after updating Fathom.</p><button id="btnRetrySaveLoad" type="button">Reload Fathom</button>`}`;
  $("arena").appendChild(d);
  if(issue.quarantined){
    $("btnContinueAfterCorruptSave").addEventListener("click",()=>{
      d.remove();
      $("creatorName")?.focus();
    });
  }else{
    $("btnRetrySaveLoad").addEventListener("click",()=>location.reload());
  }
}
function rebuildTravelLogFromState(){
  const root=$("travelLog");
  if(!root) return;
  root.innerHTML="";
  for(const entry of S?.travelLog||[]){
    const row=document.createElement("div");
    row.className=`travel-entry ${entry.cls||""}`;
    row.innerHTML=`<span class="depth">${formatDepth(entry.depth)}f</span><p>${entry.html||""}</p>`;
    root.appendChild(row);
  }
  root.scrollTop=root.scrollHeight;
}
function normalizeRestoredRun(){
  if(!S) return;
  if(!Number.isFinite(Number(S.RSL)))S.RSL=10;
  if(S.trade==="Apothecary's Hand") S.trade="Herbalist's Hand";
  S.travelLog=Array.isArray(S.travelLog)?S.travelLog:[];
  ensureRunPacing();
  S.charNotices=S.charNotices||{overview:false,status:false,skills:false,equipment:false,bestiary:false,abilities:false,quests:false,journal:false};
  for(const k of ["overview","status","skills","equipment","bestiary","abilities","quests","journal"])if(!(k in S.charNotices))S.charNotices[k]=false;
  S.skillRankNotices=S.skillRankNotices||{};
  S.skills=(S.skills&&typeof S.skills==="object"&&!Array.isArray(S.skills))?S.skills:{};
  for(const id of SKILL_ORDER){
    if(!S.skills[id]||typeof S.skills[id]!=="object"||Array.isArray(S.skills[id]))S.skills[id]={rank:0,xp:0};
    S.skills[id].rank=Math.max(0,Math.floor(Number(S.skills[id].rank)||0));
    S.skills[id].xp=Math.max(0,Number(S.skills[id].xp)||0);
  }
  S.hollowStates=S.hollowStates||{};
  S.bossDefeated=S.bossDefeated||{};S.midBossDefeated=S.midBossDefeated||{};S.midBossVariants=S.midBossVariants||{};
  S.seenFoes=S.seenFoes||{};
  S.seenTravelEvents=S.seenTravelEvents||{};
  const restoredTowns=ensureTownState();
  // Active World: settlements are spatial. Only an explicit lower-gate departure marks one left behind.
  if(restoredTowns.currentId){S.travelMode="stopped";}
  S.skillPracticeSources=S.skillPracticeSources||{};
  ensureSkillDiagnostics();
  if(S.bleeding){
    S.bleedRemainingMs=Math.max(1,Number(S.bleedRemainingMs)||BLEED_DURATION_MS);
    S.bleedAccumulatorMs=Math.max(0,Number(S.bleedAccumulatorMs)||0);
    S.bleedCombatTurns=Math.max(0,Number(S.bleedCombatTurns)||0);
  }else clearBleeding();
  S.stealthOpportunitySeq=Number.isInteger(S.stealthOpportunitySeq)?S.stealthOpportunitySeq:0;
  S.concealment=(S.concealment&&Number(S.concealment.remainingMs)>0)?{remainingMs:Number(S.concealment.remainingMs),autoPass:!!S.concealment.autoPass}:null;ensureMerchantState();ensureCaravanState();ensureInteractionState();
  if(activeInteraction())S.travelMode="stopped";
  S.abilities=S.abilities||{};
  for(const id of UNIVERSAL_ABILITY_IDS){const def=ABILITY_DEFS[id];if(def&&!S.abilities[id])S.abilities[id]={cur:def.max,max:def.max,degree:def.degree};}
  S.lootHistory=Array.isArray(S.lootHistory)?S.lootHistory:[];
  S.combatLog=Array.isArray(S.combatLog)?S.combatLog:[];
  S.generatedItems=(S.generatedItems && typeof S.generatedItems==="object" && !Array.isArray(S.generatedItems))?S.generatedItems:{};
  S.gold=Math.max(0,Math.round(Number(S.gold)||0));
  for(const item of Object.values(S.generatedItems)) if(item&&typeof item==="object") stampItemEconomy(item,{recalculateGeneratedIlvl:!!item.generated});
  S.inventory=S.inventory||{};
  S.inventory.misc=S.inventory.misc||{};
  S.inventory.questItems=Array.isArray(S.inventory.questItems)?S.inventory.questItems:[];
  S.inventory.weapons=Array.isArray(S.inventory.weapons)?S.inventory.weapons:[];
  S.inventory.equipment=Array.isArray(S.inventory.equipment)?S.inventory.equipment:[];
  ensureEquipmentState();
  normalizeQuestState();
  for(const inst of activeRescueQuests())ensureRescueQuestState(inst);
  ensureTemporaryCompanion();
  syncEquipmentHpCeiling();
  if(!settings.characterIndicators) clearCurrentCharacterIndicators();
  if(S.foe){
    const base=profileById(S.foe.profile?.id||S.foe.key);
    if(base){S.foe.profile=base;S.foe.weakness=base.weakness;}
    // v0.204.0.3 recovery: v0.204.0–0.204.0.2 could save the run while a
    // realtime world encounter was active and then restore into a broken Canvas
    // state. Never preserve that experimental encounter across reload. The
    // physical player position/world snapshot remains untouched and the enemy
    // can be encountered again normally.
    if(S.foe.worldRealtime){
      worldCombatCancelQueuedPower({refund:true});
      S.foe=null;
      S.worldCombatGuardUntil=0;
      S.combatTimeline=null;
      S.combatActor="player";
      S.travelMode="stopped";
      clearEnemyTurnTimer();
      clearCombatTransitionVisual();
    }
  }
  if(S.boon){
    S.boon.remainingMs=Math.max(0,S.boon.remainingMs||0);
    S.boon.expiresAt=null;
    S.boon.frozen=true;
  }
  if(S.activeHollow && S.activeHollow.kind!=="stage" && !S.activeHollow.autoResumeCancelled){
    const remaining=Math.max(0,S.activeHollow.autoResumeRemainingMs??HOLLOW_AUTO_RESUME_MS);
    delete S.activeHollow.autoResumeRemainingMs;
    S.activeHollow.autoResumeAt=Date.now()+remaining;
  }
}
function showDeathScreen(){
  if(!S) return;
  document.querySelectorAll(".dead").forEach(n=>n.remove());
  const killer=S.foe?.name?cap(S.foe.name):"the dark";
  const d=document.createElement("div");
  d.className="dead";
  d.innerHTML=`<h2>${esc(S.name)}'s chronicle ends here.</h2>
    <p>The dark keeps the rest.</p>
    <div class="chronicle">
      <div><span>Folk</span><b>${esc(S.folk)}</b></div>
      <div><span>Trade</span><b>${esc(S.trade)}</b></div>
      <div><span>Origin</span><b>${esc(S.origin)}</b></div>
      <div><span>Calling</span><b>${esc(S.className)} · Level ${S.level}</b></div>
      <div><span>Foes defeated</span><b>${S.kills||0}</b></div>
      <div><span>Depth reached</span><b>${formatDepth(S.depth)} fathoms</b></div>
      <div><span>Fell to</span><b>${esc(killer)}</b></div>
    </div>
    <button id="btnNew">Face the Dark Again</button>`;
  $("arena").appendChild(d);
  $("btnNew").addEventListener("click",beginNewChronicle);
}
function beginNewChronicle(){
  clearRunSave();
  S=null;
  knowledge={};
  over=false;
  encounterWarningState=null;
  stopEncounterWarningFrame();
  clearCombatTransitionTimers();
  clearCombatVictoryTimer();
  clearHollowTimer();
  closeSettingsSheet(false);
  openCreator({keepChoices:true});
}
function restoreRun(snapshot){
  if(!snapshot) return false;
  restoringRun=true;
  try{
    stopEncounterWarningFrame();
    clearCombatTransitionTimers();
    clearCombatVictoryTimer();
    clearHollowTimer();
    document.querySelectorAll(".dead").forEach(n=>n.remove());
    S=cloneForSave(snapshot.state);
    knowledge=cloneForSave(snapshot.knowledge||{});
    over=!!snapshot.over || Number(S.hp)<=0;
    if(over && Number(S.hp)>0) S.hp=0;
    armed=null;
    combatVictoryPending=null;
    selectedLootHistoryId=null;
    statPointDraft=Object.fromEntries(STAT_KEYS.map(stat=>[stat,0]));
    travelLogExpanded=!!snapshot.ui?.travelLogExpanded;
    combatLogCollapsed=snapshot.ui?.combatLogCollapsed!==false;
    normalizeRestoredRun();
    creatorDraft={
      name:"",folk:S.folk||null,trade:S.trade||null,origin:S.origin||null,className:S.className||null,startingLoadout:null,
      humanPlus2:S.folkChoices?.plus2||null,humanPlus1:S.folkChoices?.plus1||null,humanMinus2:S.folkChoices?.minus2||null
    };

    $("creator").hidden=true;
    $("packSheet").hidden=true;
    $("sheet").hidden=true;
    $("restAbilityPick").hidden=true;
    $("charSheet").hidden=true;
    $("settingsSheet").hidden=true;
    $("lootHistorySheet").hidden=true;
    rebuildTravelLogFromState();
    renderTravelLogCollapse();
    renderCombatLog();
    renderCombatLogCollapse();

    encounterWarningState=null;
    suspendedEncounterWarningMs=null;
    if(snapshot.pendingEncounter && !over && !S.foe){
      const pe=snapshot.pendingEncounter;
      const profile=profileById(pe.profileId)||(pe.options?.boss?BOSS_PROFILE:null);
      if(profile){
        encounterWarningState={
          options:{...(pe.options||{})},profile,priorMode:pe.priorMode||"stopped",
          durationMs:Math.max(1000,pe.durationMs||encounterWarningDurationMs()),
          startedAt:performance.now(),deadline:performance.now()+Math.max(0,pe.remainingMs||0),
          variantIndex:pe.variantIndex||0
        };
      }
    }

    levelUpNoticeDismissed=true;
    levelUpNoticeDeadline=0;
    if(snapshot.levelUpNotice && S.statPoints>0 && !over && !encounterWarningState){
      levelUpNoticeDismissed=false;
      levelUpNoticeDeadline=performance.now()+Math.max(0,snapshot.levelUpNotice.remainingMs||0);
    }

    if(S.boon && !currentTown() && (S.travelMode==="descend"||S.travelMode==="explore"||S.travelMode==="side") && !S.foe && !S.travelEvent && !S.activeHollow && !encounterWarningState && !over) resumeBoonClock();

    say(`<p class="note">Chronicle restored at <b>${formatDepth(S.depth)} fathoms</b>.</p>`);
    render();

    if(over) showDeathScreen();
    else if(S.foe?.defeated){combatVictoryPending=S.foe;render();}
    else if(encounterWarningState){
      if(encounterWarningState.deadline<=performance.now()) setTimeout(beginEncounterTransition,0);
      else encounterWarningFrame=requestAnimationFrame(encounterWarningLoop);
    }
    if(S.activeHollow) startHollowTimer();
    // A reload made at the destination gate must not strand an active escort
    // inside town without its handoff conversation.
    if(!over&&!S.foe&&!encounterWarningState&&currentTown()&&!activeInteraction())maybeStartEscortArrival(currentTown());
    return true;
  }finally{
    restoringRun=false;
    lastSaveAt=Date.now();
  }
}
function suspendRuntime(){
  if(appSuspended) return;
  appSuspended=true;
  if(encounterWarningState){
    suspendedEncounterWarningMs=Math.max(0,encounterWarningState.deadline-performance.now());
    stopEncounterWarningFrame();
  }
  if(!levelUpNoticeDismissed && levelUpNoticeDeadline){
    suspendedLevelUpNoticeMs=Math.max(0,levelUpNoticeDeadline-performance.now());
    stopLevelUpNoticeFrame();
  }
  if(S?.activeHollow && S.activeHollow.kind!=="stage" && !S.activeHollow.autoResumeCancelled){
    suspendedHollowResumeMs=Math.max(0,(S.activeHollow.autoResumeAt||Date.now())-Date.now());
    clearHollowTimer();
  }
  pauseBoonClock();
  saveRunNow();
}
function resumeRuntime(){
  if(!appSuspended) return;
  appSuspended=false;
  if(encounterWarningState && suspendedEncounterWarningMs!=null){
    encounterWarningState.deadline=performance.now()+suspendedEncounterWarningMs;
    encounterWarningState.startedAt=performance.now();
    suspendedEncounterWarningMs=null;
    encounterWarningFrame=requestAnimationFrame(encounterWarningLoop);
  }
  if(!levelUpNoticeDismissed && suspendedLevelUpNoticeMs!=null){
    levelUpNoticeDeadline=performance.now()+suspendedLevelUpNoticeMs;
    suspendedLevelUpNoticeMs=null;
    levelUpNoticeFrame=requestAnimationFrame(levelUpNoticeLoop);
  }
  if(S?.activeHollow && suspendedHollowResumeMs!=null){
    S.activeHollow.autoResumeAt=Date.now()+suspendedHollowResumeMs;
    suspendedHollowResumeMs=null;
    startHollowTimer();
  }
  if(S?.boon && (S.travelMode==="descend"||S.travelMode==="explore"||S.travelMode==="side") && !S.foe && !S.travelEvent && !S.activeHollow && !encounterWarningState && !over) resumeBoonClock();
  render();
  requestRunSave();
}

// Hard state guards are consolidated into the canonical field-use functions above.

function renderTravelLogCollapse(){
  const wrap=$("travelLogWrap"),openBtn=$("btnTravelLogOpen"),closeBtn=$("btnTravelLogClose"),toggleText=wrap?.querySelector(".travel-log-toggle-text");
  if(!wrap||!openBtn)return;
  const activeWorld=!!$("worldCanvas");
  const activeDelve=activeWorld&&!!S&&!over&&!currentTown()&&!S.foe&&!S.pendingBoonChoice&&!activeInteraction()&&!S.travelEvent&&!S.activeHollow;
  // The Delve Log belongs to active cavern travel only. Town services, lodging
  // choices and other modal interactions must never be covered by a stale log.
  if(!activeDelve)travelLogExpanded=false;
  wrap.hidden=!activeDelve||!travelLogExpanded;
  wrap.classList.remove("world-log-expanded");
  setFloatingWindowEnabled("delveLog",activeDelve&&travelLogExpanded);
  openBtn.hidden=!activeDelve;
  openBtn.setAttribute("aria-expanded",travelLogExpanded?"true":"false");
  if(closeBtn)closeBtn.textContent="Collapse";
  if(toggleText)toggleText.textContent="full history";
  if(activeDelve&&travelLogExpanded){const log=$("travelLog");if(log)requestAnimationFrame(()=>{log.scrollTop=log.scrollHeight;});}
}
function closeTravelLogPopup(){
  if(!travelLogExpanded)return;
  travelLogExpanded=false;
  renderTravelLogCollapse();
}
$("townHotspots")?.addEventListener("click",e=>{
  const btn=e.target.closest("[data-town-location]");if(btn)openTownLocation(btn.dataset.townLocation);
});
$("btnTownLocationBack")?.addEventListener("click",closeTownLocation);
$("townLocationActions")?.addEventListener("click",e=>{
  if(e.target.closest("#btnTownLocationLeave")){armTownDeparture();return;}
  const service=e.target.closest("[data-town-service]");
  if(!service||service.disabled)return;
  if(service.dataset.townService==="market") openTownMerchantService("market");
  else if(service.dataset.townService==="herbalist") openTownMerchantService("herbalist");
  else if(service.dataset.townService==="quest-deliver") completeTownQuestTurnIn(service.dataset.questInstance);
  else if(service.dataset.townService==="tavern-rest") restAtTownTavern();
  else if(service.dataset.townService==="quest-interact"){
    const def=questDefById(service.dataset.questDef);
    if(def?.interactionId)startInteraction(def.interactionId,{questDefId:def.id,townId:currentTown()?.id});
  }
  else if(service.dataset.townService==="quest-accept") acceptQuest(service.dataset.questDef);
});
$("btnTownCancelLeave")?.addEventListener("click",()=>{townDepartureArmed=false;renderTown();});
$("btnTownConfirmLeave")?.addEventListener("click",departCurrentTown);
$("btnTravelLogOpen").addEventListener("click",()=>{travelLogExpanded=!travelLogExpanded;renderTravelLogCollapse();});
$("btnTravelLogClose").addEventListener("click",closeTravelLogPopup);
$("btnCombatLogToggle").addEventListener("click",()=>setCombatHistoryOpen(!combatHistoryOpen));
$("btnCombatHistoryBack").addEventListener("click",()=>setCombatHistoryOpen(false));
$("combatHistoryScrim").addEventListener("click",()=>setCombatHistoryOpen(false));
$("btnFaceEncounter").addEventListener("click",beginEncounterTransition);
renderTravelLogCollapse();


/* ============================================================
   v0.080.10 — Session 7.5 side-area finale prototypes
   Optional side areas now end in one of three testable finales:
   - Cache: key / lockpick / force, with damaged salvage after final failure.
   - Mimic: a boss-ish combat finale with guaranteed creature-specific loot.
   - Arcane puzzle: five one-shot seals, three successes required; failure causes
     warned backlash and still leaves one damaged salvage item.
   ============================================================ */
const SIDE_FINALE_TYPES=["cache","mimic","puzzle"];
const MIMIC_PROFILE={
  id:"mimic",name:"hungry mimic",unlock:0,hp:58,atk:8,xp:22,danger:2,awareness:14,
  intents:{quick:30,heavy:25,dodge:5,guard:25,recover:15},recoverAt:.30,
  hurtIntents:{quick:20,heavy:45,dodge:5,guard:15,recover:15},hurtAt:.45,
  weakness:{id:"false_hinge",txt:"Its false hinges gape after committed attacks. Counters deal +45% damage.",eff:{counterBonus:1.45}}
};


function sideFinaleType(){ return S?.sideArea?.finaleType || "cache"; }
function damagedSalvageItem(){
  const r=ri(1,7);let text="";
  if(r===1){S.inventory.bandages++;text="Bandage";}
  else if(r===2){S.inventory.meat++;text="Meat";}
  else if(r===3){S.inventory.rope++;text="Rope";}
  else if(r===4){S.inventory.water++;text="Jug of Water";}
  else if(r===5){addMisc("Scroll Dust",1);text="Scroll Dust";}
  else if(r===6){const id=pick(["handaxe","hunting_bow"]);addWeapon(id);text=GEAR_ITEMS[id].name;}
  else {addMisc("Cracked Silver Ring",1);text="Cracked Silver Ring";}
  return text;
}
function grantDamagedSalvage(reason="The chest is ruined before you can claim its better contents."){
  const a=S?.sideArea;if(!a||a.damagedSalvageClaimed)return;
  a.damagedSalvageClaimed=true;
  const item=damagedSalvageItem();
  travelLogAdd(`${reason} You salvage <b>${esc(item)}</b> from what remains.`,"note");
  S.travelEvent={id:"side-altar",stage:"salvage",kind:"Damaged cache",title:"Something survives",text:`The premium contents are lost, but you recover ${item} from the wreckage.`,rollHtml:""};
  render();
}
function grantMimicReward(){
  const grantGear=id=>grantAuthoredEquipmentInstance(id)?.name||null;
  const choices=[
    ()=>grantGear("iron_signet")||"Iron Signet",
    ()=>{S.inventory.bandages+=2;return "2 Bandages";},
    ()=>{S.inventory.campSupplies++;return "Camp Supply";},
    ()=>grantGear("saints_pendant")||"Saint's Pendant",
    ()=>grantGear(pick(["handaxe","hunting_bow"]))||"Salvaged weapon"
  ];
  const item=pick(choices)();
  S.sideArea.mimicDefeated=true;S.sideArea.chestOpened=true;
  travelLogAdd(`Inside the Mimic you recover <b>${esc(item)}</b>.`,"good");
  S.travelEvent={id:"side-altar",stage:"mimic-reward",kind:"Side passage complete",title:"The false chest is dead",text:`The creature carried ${item} inside it. It is not the premium cache you hoped for, but the passage did not leave you empty-handed.`,rollHtml:""};
  render();
}


function startMimicFinale(){
  const a=S?.sideArea;if(!a||a.mimicStarted)return;
  a.mimicStarted=true;S.travelEvent=null;
  travelLogAdd(`The chest moves before you touch it. <b>It was waiting for you.</b>`,"danger");
  nextFoe({mimic:true,profile:MIMIC_PROFILE});
}

function puzzleState(){
  const a=S?.sideArea;if(!a)return null;
  if(!a.puzzle)a.puzzle={step:0,successes:0,attempts:0,lastHtml:"",lastSuccess:false,hintsByStep:{}};
  if(!a.puzzle.hintsByStep||typeof a.puzzle.hintsByStep!=="object")a.puzzle.hintsByStep={};
  return a.puzzle;
}
const PUZZLE_STEPS=[
  {name:"First seal · Words",skill:"translation",hintSkill:"translation",dc:11,text:"The outer ring is covered in the same language found elsewhere in the passage.",hints:["The repeated verb is imperative: the seal is giving an instruction, not describing itself.","The final word shares a root with the passage word for ‘still’ or ‘rest.’","Read as an instruction, the phrase tells you to stop the ring on the quiet glyph."]},
  {name:"Second seal · Mechanism",skill:"investigation",hintSkill:"investigation",dc:12,text:"Tiny channels beneath the second ring shift when the first settles.",hints:["The channels do not all carry force; one is only a guide track.","Wear marks show the inner channel completes its movement before the outer one.","The mechanism wants the inner ring settled first, then the outer ring brought against it."]},
  {name:"Third seal · Pulse",skill:"perception",hintSkill:"perception",dc:12,text:"The third seal brightens in a repeating rhythm. Acting on the wrong beat may destabilize it.",hints:["The pulse is not random: every fourth beat is slightly longer.","The long beat is followed by a brief dim interval.","The safest moment to act is the dim interval immediately after the fourth pulse."]},
  {name:"Fourth seal · Delicate catch",skill:"sleight",hintSkill:"investigation",dc:12,text:"A physical catch turns beneath the magic. Fine control may hold it in place.",hints:["The catch has two worn faces, but only one is load-bearing.","Pressure on the bright edge makes the opposite side loosen.","Hold the bright edge down while turning the loose side rather than forcing both together."]},
  {name:"Fifth seal · Grounding",skill:null,hintSkill:"investigation",dc:13,text:"Heat gathers in the final ring. Something must draw the charge away before it releases.",hints:["The charge is looking for a path away from the metal rather than another lock to open.","The grooves around the seal lead outward like drainage channels.","A conductive or cooling medium through those channels would ground the stored charge."]}
];
function puzzleStepHintState(){
  const p=puzzleState();if(!p)return {attempts:0,log:[]};
  const key=String(p.step);if(!p.hintsByStep[key])p.hintsByStep[key]={attempts:0,log:[]};
  const h=p.hintsByStep[key];h.attempts=Math.max(0,Number(h.attempts)||0);h.log=Array.isArray(h.log)?h.log:[];return h;
}
async function attemptPuzzleHint(){
  const p=puzzleState(),step=puzzleCurrent(),h=puzzleStepHintState(),ev=S?.travelEvent;if(!p||!step||ev?.stage!=="puzzle-step")return;
  if(h.attempts>=(step.hints?.length||0))return;
  const idx=h.attempts,skill=step.hintSkill||"investigation",challenge=sideHintChallenge(idx),check=await runActiveSkillCheck(skill,challenge),practice=awardSkillPractice(skill,`side-final-puzzle-hint:${S.sideArea.id}:${p.step}:${idx}`,check);
  h.attempts++;
  const result=formatSkillCheck(check)+practiceText(skill,practice);
  if(check.success)h.log.push(`<span class="good"><b>Hint ${idx+1}:</b> ${esc(step.hints[idx])}</span>`);
  else h.log.push(`<span class="note"><b>Hint ${idx+1}:</b> You cannot extract another reliable clue from this seal.</span>`);
  ev.rollHtml=`${h.log.join("<br>")}<br>${result}`;render();
}
function puzzleCurrent(){const p=puzzleState();return p?PUZZLE_STEPS[p.step]||null:null;}
function beginPuzzleFinale(){
  const p=puzzleState();p.step=0;p.successes=0;p.attempts=0;p.lastHtml="";p.hintsByStep={};
  S.travelEvent={id:"side-altar",stage:"puzzle-step",kind:"Arcane cache",title:PUZZLE_STEPS[0].name,text:PUZZLE_STEPS[0].text,rollHtml:""};render();
}
async function attemptPuzzleSkill(skill,baseDc,situational=0){
  const p=puzzleState(),step=puzzleCurrent();if(!p||!step||S.travelEvent.stage!=="puzzle-step")return;
  const dc=trapDc(baseDc),c=await runActiveSkillCheck(skill,dc,situational),practice=awardSkillPractice(skill,`side-puzzle:${S.sideArea.id}:${p.step}`,c);
  p.attempts++;if(c.success)p.successes++;
  p.lastSuccess=c.success;p.lastHtml=formatSkillCheck(c)+practiceText(skill,practice);
  S.travelEvent.stage="puzzle-result";S.travelEvent.rollHtml=p.lastHtml;S.travelEvent.title=c.success?"The seal settles":"The seal slips";
  S.travelEvent.text=`${p.successes} success${p.successes===1?"":"es"} from ${p.attempts} attempted seal${p.attempts===1?"":"s"}.`;
  render();
}
function attemptPuzzleWater(){
  const p=puzzleState();if(!p||p.step!==4||S.inventory.water<=0)return;
  S.inventory.water--;p.attempts++;p.successes++;p.lastSuccess=true;
  p.lastHtml=`<span class="good">You pour water through the hot channels. Steam tears away the excess charge and the final seal settles.</span>`;
  S.travelEvent.stage="puzzle-result";S.travelEvent.title="The final seal cools";S.travelEvent.text=`${p.successes} successes from ${p.attempts} attempted seals.`;S.travelEvent.rollHtml=p.lastHtml;render();
}
function nextPuzzleSeal(){
  const p=puzzleState();if(!p||S.travelEvent.stage!=="puzzle-result")return;
  p.step++;
  if(p.step>=PUZZLE_STEPS.length)return finishPuzzleFinale();
  const step=PUZZLE_STEPS[p.step];S.travelEvent={id:"side-altar",stage:"puzzle-step",kind:"Arcane cache",title:step.name,text:step.text,rollHtml:""};render();
}
function finishPuzzleFinale(){
  const p=puzzleState();if(!p)return;
  if(p.successes>=3){
    travelLogAdd(`The arcane cache stabilizes with <b>${p.successes}/5 seals</b> resolved.`,"good");
    return grantChestReward();
  }
  const dmg=Math.max(1,Math.round(S.hpMax*.30));
  const actual=Math.min(Math.max(0,S.hp-1),dmg);
  S.hp-=actual;flashTravelDamage();
  travelLogAdd(`The ward collapses after only <b>${p.successes}/5</b> seals. Magical backlash costs <b>${actual} HP</b>.` ,"danger");
  grantDamagedSalvage("The backlash burns through most of the cache.");
}

// A failed final force now damages the premium contents instead of making the
// entire side excursion retroactively worth nothing.



// The Mimic uses the normal encounter-warning / combat machinery but is not a
// normal passage encounter. Killing it resolves the finale and guarantees loot.



/* ============================================================
   v0.203.0 — ACTIVE WORLD BRIDGE
   The old v0.114.1.3 game remains canonical. This API exposes only the
   minimum hooks needed by the free-moving Canvas world. Inventory,
   equipment, combat, quests, towns, interactions, saving and rules stay in
   this file and are called directly rather than reimplemented.
   ============================================================ */
function worldBlocked(){
  // Active World v0.203.4: a settlement is a place in the cavern, not a map
  // instance. Being inside a town must not globally freeze world movement;
  // individual town services, conversations and sheets still block through
  // their own canonical UI/state gates.
  return !S || over || encounterWarningActive() || (!!S.foe && !S.foe.worldRealtime) || !!S.travelEvent || !!S.activeHollow || !!S.pendingBoonChoice || !!activeInteraction();
}
function worldUiBlocking(){
  const pack=$("packSheet"),character=$("charSheet");
  if(pack&&!pack.hidden&&!pack.classList.contains("world-floating"))return true;
  if(character&&!character.hidden&&!character.classList.contains("world-floating"))return true;
  return ["creator","settingsSheet","lootHistorySheet","sheet","combatHistorySheet","infoSheet","boonPick","restAbilityPick","interactionSheet","questRewardSheet","worldLootSheet"].some(id=>{
    const el=$(id); return !!el && !el.hidden;
  });
}
function worldDepthEvent(beforeDepth,afterDepth){
  // Active World v0.203.5: depth progression is bookkeeping, never collision.
  // Every interrupting thing -- including mid-bosses and stratum bosses -- is a
  // physical world entity. Merely crossing its authored fathom must not clamp,
  // teleport, rewind or otherwise move the player. The player sees the entity
  // in the cavern and chooses/causes the encounter there.
  return false;
}
function worldAdvanceDepth(targetDepth,movementMs=0){
  if(!S || over || (S.foe&&!S.foe.worldRealtime) || S.travelEvent || S.activeHollow || S.pendingBoonChoice || activeInteraction()) return {depth:Number(S?.depth)||0,blocked:true};
  syncSidePassageStratum();
  const before=Math.max(0,Number(S.depth)||0),target=Math.max(before,Number(targetDepth)||before),delta=target-before;
  if(delta<=0){ if(S.travelMode!=="stopped") S.travelMode="stopped"; pauseBoonClock(); return {depth:before,blocked:false}; }
  S.travelMode="descend"; resumeBoonClock();
  if(S.bleeding && movementMs>0){const bleed=advanceBleeding(movementMs,"travel");if(!bleed.alive)return {depth:Number(S.depth)||before,blocked:true};}
  if(concealmentActive() && movementMs>0){S.concealment.remainingMs=Math.max(0,(Number(S.concealment.remainingMs)||0)-movementMs);if(S.concealment.remainingMs<=0)clearConcealment(`<b>Concealment</b> fades. You are moving openly again.`);}
  if(worldDepthEvent(before,target)){render();requestRunSave();return {depth:Number(S.depth)||before,blocked:true};}
  S.depth=Math.round(target*100)/100;
  advanceRestRecoveryFromDepth(before,S.depth);
  recordRunDepthMilestones(before,S.depth);
  S.exploreDepth=S.depth;S.exploreElapsedMs=0;
  checkBoonExpiry();maybeScheduleMerchant();
  recordDescentXpProgress();
  // The Canvas bridge already paints live depth every frame and snapshots the run
  // on a short throttle. Repainting the entire legacy DOM every few pixels was the
  // source of the upward-movement hitching in the active world.
  return {depth:S.depth,blocked:false};
}
function worldActiveMovement(ms=0){
  if(!S||over||worldBlocked())return false;
  const dt=Math.max(0,Number(ms)||0);if(dt<=0)return false;
  if(S.travelMode!=="descend"){S.travelMode="descend";resumeBoonClock();}
  if(S.bleeding){const bleed=advanceBleeding(dt,"travel");if(!bleed.alive)return false;}
  if(concealmentActive()){S.concealment.remainingMs=Math.max(0,(Number(S.concealment.remainingMs)||0)-dt);if(S.concealment.remainingMs<=0)clearConcealment(`<b>Concealment</b> fades. You are moving openly again.`);}
  const units=dt/1000*0.5;
  S.travelSinceEvent=(Number(S.travelSinceEvent)||0)+units;
  checkBoonExpiry();return true;
}
function worldActiveSideMovement(ms=0){
  if(!S||over||!sideAreaActive()||(S.foe&&!S.foe.worldRealtime)||S.travelEvent||S.activeHollow||activeInteraction())return false;
  const dt=Math.max(0,Number(ms)||0);if(dt<=0)return false;
  if(S.travelMode!=="side"){S.travelMode="side";resumeBoonClock();}
  if(S.bleeding){const bleed=advanceBleeding(dt,"travel");if(!bleed.alive)return false;}
  if(concealmentActive()){S.concealment.remainingMs=Math.max(0,(Number(S.concealment.remainingMs)||0)-dt);if(S.concealment.remainingMs<=0)clearConcealment(`<b>Concealment</b> fades. You are moving openly again.`);}
  S.sideArea.elapsedMs=(Number(S.sideArea.elapsedMs)||0)+dt;checkBoonExpiry();return true;
}
function worldMovementStopped(){
  if(!S||(S.foe&&!S.foe.worldRealtime))return;
  if(sideAreaActive()){if(S.travelMode!=="stopped"){S.travelMode="stopped";pauseBoonClock();requestRunSave();}return;}
  if(S.travelMode!=="stopped"){
    S.travelMode="stopped";pauseBoonClock();
    // A live town keeps its own canonical service UI. Repainting the old
    // travel surface here can fight that UI even though the player never left
    // the world, so only refresh legacy travel when outside a settlement.
    if(!currentTown())renderTravel();
    requestRunSave();
  }
}
function worldEngageFoe(profileId,worldEntityId,options={}){
  if(worldBlocked())return false;
  const profile=FOES.find(f=>f.id===profileId)||chooseFoeProfile();
  if(options?.resumeState)return worldResumeCombatTarget(options.resumeState,worldEntityId);
  // Concealment now works spatially in the live world by shrinking notice radius;
  // do not open the old modal concealed-contact choice during realtime targeting.
  const ok=spawnEncounter({profile,worldEntityId,worldRealtime:true,playerInitiated:!!options?.playerInitiated});
  if(ok&&S.foe){S.foe.worldEntityId=worldEntityId||null;S.foe.hostile=!options?.playerInitiated;}
  return !!ok;
}
function worldSetCombatHostile(active=true){if(!S?.foe?.worldRealtime)return false;S.foe.hostile=!!active;requestRunSave();return true;}
function worldSetThreatened(active=true){if(!S)return false;if(active)pauseBoonClock();else if(!currentTown()&&(S.travelMode==="descend"||S.travelMode==="explore"||S.travelMode==="side"))resumeBoonClock();return true;}
function worldSuspendCombatTarget(){
  const f=S?.foe;if(!f?.worldRealtime||f.defeated)return null;
  const snapshot=cloneForSave(f);
  worldCombatCancelQueuedPower({refund:true});S.worldCombatGuardUntil=0;S.foe=null;S.combatTimeline=null;S.combatActor="player";
  requestRunSave();return snapshot;
}
function worldResumeCombatTarget(snapshot,worldEntityId){
  if(!S||over||!snapshot||snapshot.defeated)return false;
  const f=cloneForSave(snapshot);f.worldRealtime=true;f.evading=false;f.worldEntityId=worldEntityId||f.worldEntityId||null;
  worldCombatCancelQueuedPower({refund:true});
  S.foe=f;S.worldCombatGuardUntil=0;S.combatTimeline=null;S.combatActor="player";requestRunSave();return true;
}
function worldEnemyProfile(profileId,kind="foe",bossStratum=0){
  if(kind==="boss")return BOSS_PROFILE;
  if(kind==="midboss")return midBossVariantProfile(Math.max(0,Number(bossStratum)||0));
  return FOES.find(f=>f.id===profileId)||FOES[0];
}
function worldEnemyCombatConfig(profileId,kind="foe",bossStratum=0){
  const profile=worldEnemyProfile(profileId,kind,bossStratum),tmp={profile};
  const total=Object.values(profile?.intents||{}).reduce((a,v)=>a+(Number(v)||0),0);
  return {attackIntervalMs:enemyWorldAttackIntervalMs(tmp),range:WORLD_COMBAT_ENEMY_MELEE_REACH,moveSpeed:clamp(60+(foeCombatSpeed(tmp)-100)*.22,50,84),heavyChance:clamp((Number(profile?.intents?.heavy)||0)/Math.max(1,total),.05,.55)};
}
function worldCombatEnemyAttackFrom(profileId,{heavy=false,kind="foe",bossStratum=0}={}){
  if(!S||over)return {ok:false};
  const profile=worldEnemyProfile(profileId,kind,bossStratum),tmp={profile};
  const chance=worldCombatNormalizedHitChance(foeAttackRating(tmp),playerDefenceRating());
  if(rnd()>=chance)return {ok:true,hit:false,damage:0,heavy:!!heavy};
  const atk=Math.max(1,Math.round(expectedEnemyHitAtDepth(S.depth)*(Math.max(.1,Number(profile?.atk)||7)/7)));
  const rawDamage=worldCombatRollDamage(atk,{minFrac:.60,mult:heavy?2.2:1});
  let damage=mitigateDamageByType(rawDamage,{damageType:"physical",armor:equipmentArmorFor(),expectedArmor:expectedMediumArmorAtDepth(S.depth)});
  const guarded=Number(S.worldCombatGuardUntil||0)>Date.now();
  if(guarded){damage=damage*(1-WORLD_COMBAT_GUARD_REDUCTION);S.worldCombatGuardUntil=0;}
  damage=Math.max(1,Math.round(damage));
  S.hp-=damage;
  if(S.hp<=0){die(`<p class="hurt">The ${esc(profile.name)} ${heavy?"committed to a heavy blow":"struck"} for <b>${damage}</b>.</p>`);return {ok:true,hit:true,damage,heavy:!!heavy,guarded,dead:true};}
  requestRunSave();return {ok:true,hit:true,damage,heavy:!!heavy,guarded};
}
function worldDetectionRadius(profileId){
  const profile=FOES.find(f=>f.id===profileId)||FOES[0],awareness=Number(profile?.awareness)||0,stealth=skillRating("stealth");
  // Ordinary awareness is spatially readable rather than a hidden hard gate.
  // Better Stealth trims the notice radius, while alert species still see farther.
  const base=clamp(5.5+(awareness-stealth)/30,3.5,9);return concealmentActive()?Math.max(1.5,base*.35):base;
}
function ensureWorldReadInstances(){
  if(!S.worldReadInstances||typeof S.worldReadInstances!=="object"||Array.isArray(S.worldReadInstances))S.worldReadInstances={};
  return S.worldReadInstances;
}
function worldReadInfo(profileId,worldEntityId){
  const profile=String(profileId||"")===BOSS_PROFILE.id?BOSS_PROFILE:(FOES.find(f=>f.id===profileId)||FOES[0]),reads=knowledgeReads(profile.id),used=!!ensureWorldReadInstances()[String(worldEntityId||"")];
  return {profileId:profile.id,name:profile.name,reads,used,mastered:reads>=6,channelMs:boonActive("keptwatch")?500:1500,maxRangeTiles:8,ok:!used&&reads<6};
}
function worldReadFoe(profileId,worldEntityId){
  if(!S||over)return {ok:false,reason:"Unavailable"};
  const info=worldReadInfo(profileId,worldEntityId);
  if(info.mastered)return {ok:false,reason:"This archetype is already Mastered.",...info};
  if(info.used)return {ok:false,reason:"You have already Read this individual creature.",...info};
  const profile=String(info.profileId||"")===BOSS_PROFILE.id?BOSS_PROFILE:(FOES.find(f=>f.id===info.profileId)||FOES[0]),after=info.reads+1;
  ensureWorldReadInstances()[String(worldEntityId||`${profile.id}:${S.encounter}`)]=true;knowledge[profile.id]={reads:after};S.seenFoes[profile.id]=true;markCharacterNotice("bestiary");
  let text=after===1?`Read ${cap(profile.name)}: weakness learned · 1/3 knowledge.`:after===3?`Studied ${cap(profile.name)}: take 5% less damage · 3/6 knowledge.`:after===6?`Mastered ${cap(profile.name)}: weakness payoff +5% · 6/6 knowledge.`:`Studied ${cap(profile.name)} · ${after}/${after<3?3:6} knowledge.`;
  travelLogAdd(`<b>${esc(text)}</b>`,after===3||after===6?"good":"note");requestRunSave();return {ok:true,reads:after,text,profileId:profile.id,name:profile.name};
}
function worldEnterTownById(id){const def=TOWN_DEFS.find(t=>t.id===id);return def?enterTown(def):false;}
function worldTownState(){
  const def=currentTown();
  if(!def)return null;
  return {
    id:def.id,name:def.name,kind:def.kind,depth:Number(def.depth)||0,
    locationOpenId:townLocationOpenId||null,departureArmed:!!townDepartureArmed,
    locations:(def.locations||[]).map(loc=>({id:loc.id,name:loc.name,type:loc.type||"Location",service:loc.service||null,departure:!!loc.departure,npcName:loc.npcName||null,description:loc.description||"",status:loc.status||""}))
  };
}
function worldTownCanMove(){
  return !!currentTown()&&!over&&!S?.foe&&!S?.travelEvent&&!S?.activeHollow&&!S?.pendingBoonChoice&&!activeInteraction()&&!townLocationOpenId&&!townDepartureArmed&&!worldUiBlocking();
}
function worldOpenTownLocation(id){if(!currentTown()||!townLocationById(currentTown(),id))return false;openTownLocation(id);return true;}
function worldCloseTownLocation(){if(!currentTown())return false;closeTownLocation();return true;}
function worldDepartTown(){return departCurrentTown();}
function worldLeaveTownById(id){
  const def=currentTown();if(!S||!def||String(def.id)!==String(id)||townLocationOpenId||townDepartureArmed||S.foe||S.travelEvent||S.activeHollow||activeInteraction())return false;
  const state=ensureTownState();state.visited[def.id]=true;state.currentId=null;
  townLocationOpenId=null;townMerchantServiceId=null;townDepartureArmed=false;
  S.travelMode="stopped";pauseBoonClock();render();requestRunSave();return true;
}
function worldRetireEvent(kind,id){
  if(!S||S.foe||S.travelEvent||activeInteraction())return false;
  if(kind==="caravan"){
    const event=pendingCaravan();if(!event||String(event.id)!==String(id))return false;
    recordCaravanResolution("passed-by",event);return true;
  }
  if(kind==="merchant"){
    const merchant=currentMerchant();if(!merchant||merchant.context==="town"||merchant.context==="caravan")return false;
    retireMerchant();requestRunSave();return true;
  }
  return false;
}
function worldUseHollow(id,depth,kind="ordinary"){
  if(worldBlocked())return false;
  const d=Math.max(0,Number(depth)||Number(S.depth)||0),stratum=Math.floor(d/FATHOMS_PER_STRATUM);
  const h={stratum,kind:kind==="stage"?"stage":"ordinary",key:`world:${String(id||Math.round(d*10))}`,depth:d};
  if(S.hollowStates?.[h.key])return false;discoverHollow(h);return true;
}
function worldEventDescriptors(){
  if(!S||over||currentTown())return [];
  ensureMerchantState();ensureCaravanState();normalizeRoadTrafficSlot();repairStaleRoadTrafficSlot();
  const out=[];
  const caravan=pendingCaravan();
  if(caravan&&!S.travelEvent&&!S.foe)out.push({type:"caravan",id:caravan.id,depth:Number(caravan.depth)||0,subtype:caravan.type,title:caravanEventCopy(caravan)?.title||"Caravan"});
  const merchant=currentMerchant();
  if(merchant&&!S.caravans?.activeMerchant&&!currentTown()&&!S.travelEvent&&!S.foe)out.push({type:"merchant",id:`merchant:${merchant.id||merchant.depth}`,depth:Number(merchant.depth)||0,title:merchantDisplayName(merchant)});
  if(!S.sideDiscoveryAttempted&&!S.sideAreaResolved&&!sideAreaActive()&&Number.isFinite(Number(S.sideDiscoveryAt))){
    // Geography is independent of encounter/UI state. An ordinary passage is
    // already open in the cavern and must not blink out during combat or a popup.
    out.push({type:"sidepassage",id:`side:${S.sideDiscoveryStratum??stratumIndex()}:${Number(S.sideDiscoveryAt).toFixed(2)}`,depth:Number(S.sideDiscoveryAt)||0,title:"Side passage"});
  }
  // Rescue beats used to fire the instant the depth counter crossed their
  // authored value. In Active World they become actual clues/places you can see.
  for(const inst of activeRescueQuests()){
    const r=ensureRescueQuestState(inst);if(!r)continue;
    const beats=r.stage==="escorting"
      ? [["escort-pursuit",r.pursuitDepth,r.pursuitResolved,"Movement on the trail"]]
      : [["rescue-tracks",r.trackDepth,r.tracksResolved,"Tracks leave the route"],["rescue-satchel",r.satchelDepth,r.satchelResolved,"Abandoned medicine satchel"],["rescue-hideout",r.hideoutDepth,r.hideoutResolved,"Hidden refuge"]];
    for(const [type,depth,resolved,title] of beats){
      if(!resolved&&Number.isFinite(Number(depth)))out.push({type,id:`rescue:${inst.instanceId}:${type}`,depth:Number(depth),title,questInstanceId:inst.instanceId,rescueKind:type.replace(/^rescue-/,'').replace(/^escort-/,'')});
    }
  }
  // Non-town delivery/hand-in locations also become physical route objects.
  for(const inst of questInstances("active")){
    if(inst.targetTownId||questDefById(inst.definitionId)?.kind==="rescue-escort")continue;
    if(!Number.isFinite(Number(inst.targetDepth)))continue;
    out.push({type:"quest-target",id:`quest-target:${inst.instanceId}`,depth:Number(inst.targetDepth),title:questDefById(inst.definitionId)?.targetName||"Quest destination",questInstanceId:inst.instanceId});
  }
  const currentStratum=Math.max(0,stratumIndex(Number(S.depth)||0));
  for(let st=Math.max(0,currentStratum-1);st<=currentStratum+1;st++){
    const mid=midBossDepthForStratum(st),boundary=(st+1)*FATHOMS_PER_STRATUM;
    if(!S.midBossDefeated?.[st]){const mini=midBossVariantProfile(st);out.push({type:"midboss",id:`midboss:${st}`,depth:mid,title:mini.name,profileId:mini.id,bossStratum:st});}
    if(!S.bossDefeated?.[st])out.push({type:"boss",id:`boss:${st}`,depth:boundary,title:st===0?BOSS_PROFILE.name:`${stratumName(st)} boundary guardian`,bossStratum:st});
  }
  return out;
}
function worldTriggerEvent(kind,id,depth){
  if(worldBlocked())return false;
  if(kind==="caravan"){
    const event=pendingCaravan();if(!event||String(event.id)!==String(id))return false;
    S.depth=Math.max(Number(S.depth)||0,Number(event.depth)||Number(depth)||0);return !!beginCaravanEvent(event);
  }
  if(kind==="merchant"){
    const merchant=currentMerchant();if(!merchant)return false;
    S.depth=Math.max(Number(S.depth)||0,Number(merchant.depth)||Number(depth)||0);return !!beginMerchantEncounter();
  }
  if(kind==="sidepassage"){
    if(S.sideDiscoveryAttempted||S.sideAreaResolved)return false;
    // v0.203.9.3: ordinary side passages are geography only. Walking into one
    // records the discovery and leaves the player exactly where they are. No
    // side travel mode, stages, barriers, return button, or coordinate rewrite.
    const d=Math.max(0,Number(S.sideDiscoveryAt)||Number(depth)||Number(S.depth)||0);
    S.sideDiscoveryAttempted=true;S.sideAreaResolved=true;
    if(!Array.isArray(S.sideAreaHistory))S.sideAreaHistory=[];
    if(!S.sideAreaHistory.some(h=>String(h?.id||"")===String(id||"")))S.sideAreaHistory.push({id:String(id||`side:${d.toFixed(2)}`),entryDepth:d,progress:0,completed:false,abandoned:false,geographyOnly:true});
    travelLogAdd(`<b>Side passage discovered</b> near ${formatDepth(d)} fathoms.`,"note");
    requestRunSave();return true;
  }
  if(kind==="rescue-tracks"||kind==="rescue-satchel"||kind==="rescue-hideout"||kind==="escort-pursuit"){
    const raw=String(id||"").split(":");const instanceId=raw[1];const inst=questInstanceById(instanceId);if(!inst||inst.status!=="active")return false;
    const type=kind==="escort-pursuit"?"pursuit":kind.replace("rescue-","");
    S.depth=Math.max(Number(S.depth)||0,Number(depth)||0);return !!beginRescueBeat({type,depth:Number(depth)||S.depth,inst});
  }
  if(kind==="quest-target"){
    const instanceId=String(id||"").replace(/^quest-target:/,"");const inst=questInstanceById(instanceId);if(!inst||inst.status!=="active")return false;
    S.depth=Math.max(Number(S.depth)||0,Number(depth)||0);return !!beginQuestTurnIn(inst);
  }
  if(kind==="midboss"){
    const st=Math.max(0,Number(String(id||"").replace(/^midboss:/,""))||0);if(S.midBossDefeated?.[st])return false;
    // The mini-boss lives in ordinary cavern terrain. Contact may advance only
    // canonical depth bookkeeping; there is no arena teleport or 250f gate.
    S.depth=Math.max(Number(S.depth)||0,Number(depth)||midBossDepthForStratum(st));
    const profile=midBossVariantProfile(st);
    travelLogAdd(`<b>Danger ahead.</b> An unusually large ${esc(profile.name.replace(/^oversized /,''))} gives chase.`,"danger");
    const ok=!!spawnEncounter({boss:true,midBoss:true,bossStratum:st,profile,worldRealtime:true});
    if(ok&&S.foe)S.foe.worldEntityId=`worldevent:${id}`;
    return ok;
  }
  if(kind==="boss"){
    const st=Math.max(0,Number(String(id||"").replace(/^boss:/,""))||0);if(S.bossDefeated?.[st])return false;
    S.depth=Math.max(Number(S.depth)||0,Number(depth)||(st+1)*FATHOMS_PER_STRATUM);
    travelLogAdd(`<b>The stratum guardian gives chase.</b> The sealed lower throat will not open while it lives.`,"danger");
    const ok=!!spawnEncounter({boss:true,bossStratum:st,worldRealtime:true});
    if(ok&&S.foe)S.foe.worldEntityId=`worldevent:${id}`;
    return ok;
  }
  return false;
}
function worldInvestigateGlint(id,depth){
  if(worldBlocked())return false;
  if(!S.seenTravelEvents?.glint){S.depth=Math.max(S.depth,Number(depth)||0);return beginGlintEvent();}
  const challenge=authoredChallenge(12),check=runSkillCheck("perception",challenge,0),source=`world-glint:${id}`,practice=awardSkillPractice("perception",source,check);
  if(check.success){const item=generateProceduralEquipment(S.depth,"cache");addGeneratedEquipment(item);markCharacterNotice("equipment");const rec=makeLootRecord([item.name],{name:"hidden cache"});travelLogAdd(`A glint leads you to <b>${esc(item.name)}</b>.${practiceText("perception",practice)}`,"good");render();requestRunSave();return {success:true,item:item.name,lootId:rec.id};}
  travelLogAdd(`The glint disappears among the stone before you can place it.${practiceText("perception",practice)}`,"note");render();requestRunSave();return {success:false};
}
function worldOpenChest(id,depth){
  if(worldBlocked())return false;
  S.depth=Math.max(S.depth,Number(depth)||0);const drops=[];
  const silver=ri(2,7)+Math.floor(depthGrowth(S.depth)/15);S.gold=(S.gold||0)+silver;drops.push(formatGold(silver));
  if(rnd()<.72){const item=generateProceduralEquipment(S.depth,"cache");addGeneratedEquipment(item);drops.push(item.name);markCharacterNotice("equipment");}
  else {addMisc("Scroll Dust",1);drops.push("Scroll Dust");}
  const rec=makeLootRecord(drops,{name:"cavern cache"});travelLogAdd(`You open a <b>cavern cache</b>. ${drops.map(esc).join(" · ")}.`,`good`);render();requestRunSave();return {drops,lootId:rec.id};
}
function worldCompanionState(){
  const c=ensureTemporaryCompanion();
  if(!c||c.status!=="following")return null;
  return {id:c.id,name:c.name,role:c.role||"Traveller",status:c.status,hiddenForCombat:!!c.hiddenForCombat,destinationTownId:c.destinationTownId||null};
}
function worldSideAreaState(){
  const a=S?.sideArea;if(!a)return null;
  // A pre-cleanup active side area may survive in a migrated save solely so the
  // Canvas can archive its already-carved geometry. It is not gameplay-active.
  return {id:a.id,name:a.name||"Side Passage",entryDepth:Number(a.entryDepth)||Number(S.depth)||0,encountersNeeded:Number(a.encountersNeeded)||1,encountersDefeated:Number(a.encountersDefeated)||0,routeNodeActive:!!a.routeNodeActive,endReached:!!a.endReached,chestOpened:!!a.chestOpened,completed:!!a.completed,paused:!SIDE_PASSAGE_EVENTS_ENABLED||!!a.paused};
}
function worldTriggerSideStage(){
  if(!SIDE_PASSAGE_EVENTS_ENABLED)return false;
  const a=S?.sideArea;if(!a||S.foe||S.travelEvent||a.routeNodeActive)return false;
  if((a.encountersDefeated||0)>=(a.encountersNeeded||1)){a.endReached=true;return false;}
  beginSideRouteNode();return true;
}
function worldTriggerSideFinale(){
  if(!SIDE_PASSAGE_EVENTS_ENABLED)return false;
  const a=S?.sideArea;if(!a||S.foe||S.travelEvent)return false;
  if((a.encountersDefeated||0)<(a.encountersNeeded||1))return false;
  a.endReached=true;beginSideAltar();return true;
}
function worldExitSideArea(completed=false){if(!SIDE_PASSAGE_EVENTS_ENABLED||!S?.sideArea)return false;exitSideArea(!!completed);return true;}
function worldSaveSnapshot(snapshot){if(!S||!snapshot)return;S.world=cloneForSave(snapshot);requestRunSave();}
function worldRestoreSnapshot(){return S?.world?cloneForSave(S.world):null;}
function worldProfiles(){return FOES.map(f=>({id:f.id,name:f.name,unlock:Number(f.unlock)||0}));}
function worldTowns(){
  const state=ensureTownState(),currentId=currentTown()?.id||null;
  return TOWN_DEFS.map(t=>({
    id:t.id,name:t.name,kind:t.kind,depth:Number(t.depth)||0,
    current:t.id===currentId,departed:!!state?.departed?.[t.id],visited:!!state?.visited?.[t.id],
    locations:(t.locations||[]).map(loc=>({id:loc.id,name:loc.name,type:loc.type||"Location",service:loc.service||null,departure:!!loc.departure,npcName:loc.npcName||null,description:loc.description||"",status:loc.status||""}))
  }));
}
function worldCurrentState(){
  if(!S)return null;const resources=worldCombatResourceSnapshot();
  return {name:String(S.name||""),slot:currentRunSlot,depth:Number(S.depth)||0,hp:Number(S.hp)||0,hpMax:Number(S.hpMax)||1,xp:Number(S.xp)||0,xpNeed:Math.max(1,xpToNext(S.level)),level:Number(S.level)||1,statPoints:Number(S.statPoints)||0,resources,foe:S.foe?{key:S.foe.key,name:S.foe.name,hp:S.foe.hp,hpMax:S.foe.hpMax,defeated:!!S.foe.defeated,worldRealtime:!!S.foe.worldRealtime,hostile:!!S.foe.hostile,evading:!!S.foe.evading,worldEntityId:S.foe.worldEntityId||null,worldLootRecordId:S.foe.worldLootRecordId||null}:null,over:!!over,town:currentTown()?.id||null,townLocationOpenId:townLocationOpenId||null,townDepartureArmed:!!townDepartureArmed,travelEvent:!!S.travelEvent,hollow:!!S.activeHollow,interaction:!!activeInteraction()};
}
window.LowfathomLegacy={
  getState:worldCurrentState,getRawState:()=>S,getProfiles:worldProfiles,getTowns:worldTowns,getWorldZoom:()=>WORLD_ZOOM_VALUES[settings.worldZoom]||WORLD_ZOOM_VALUES.standard,getMinimapZoom:()=>Number(settings.minimapZoom),persistMinimapZoom,
  canMove:()=>!worldBlocked()&&!worldUiBlocking(),uiBlocking:worldUiBlocking,
  getWorldCombat:worldCombatResourceSnapshot,getWorldCombatMeleeReach,setWorldCombatMeleeReach,tickWorldCombatResources,useWorldCombatPower:worldCombatUsePower,queueWorldCombatPower:worldCombatQueuePower,cancelWorldCombatPower:worldCombatCancelQueuedPower,worldCombatPlayerAttack,worldCombatGuard,worldCombatEnemyAttack,worldCombatEnemyAttackFrom,getWorldEnemyCombatConfig:worldEnemyCombatConfig,getWorldDetectionRadius:worldDetectionRadius,beginWorldCombatEvade:worldCombatBeginEvade,tickWorldCombatEvadeHeal:worldCombatEvadeHeal,finishWorldCombatEvade:worldCombatFinishEvade,
  getWorldReadInfo:worldReadInfo,readWorldFoe:worldReadFoe,setWorldCombatHostile:worldSetCombatHostile,setWorldThreatened:worldSetThreatened,suspendWorldCombatTarget:worldSuspendCombatTarget,resumeWorldCombatTarget:worldResumeCombatTarget,
  advanceDepth:worldAdvanceDepth,activeMovement:worldActiveMovement,activeSideMovement:worldActiveSideMovement,movementStopped:worldMovementStopped,noteRunForeground,noteRunMovement,engageFoe:worldEngageFoe,
  enterTown:worldEnterTownById,leaveTown:worldLeaveTownById,getTownState:worldTownState,townCanMove:worldTownCanMove,openTownLocation:worldOpenTownLocation,closeTownLocation:worldCloseTownLocation,departTown:worldDepartTown,
  useHollow:worldUseHollow,investigateGlint:worldInvestigateGlint,openChest:worldOpenChest,
  getWorldEvents:worldEventDescriptors,triggerWorldEvent:worldTriggerEvent,retireWorldEvent:worldRetireEvent,getCompanion:worldCompanionState,
  getSideArea:worldSideAreaState,triggerSideStage:worldTriggerSideStage,triggerSideFinale:worldTriggerSideFinale,exitSideArea:worldExitSideArea,
  saveWorld:worldSaveSnapshot,restoreWorld:worldRestoreSnapshot,render:()=>render(),requestSave:()=>requestRunSave(),
  openInventory:()=>S?.foe?openPack("combat","backpack"):openPack(null,"backpack"),closeInventory:()=>closePack(),
  inventoryOpen:()=>!!$("packSheet")&&!$("packSheet").hidden,
  openCharacter:()=>openCharacterSheet(),takeRest:()=>takeRest(),openWorldLoot:(recordId)=>openWorldLoot(recordId),
  getWorldPositionDepth:()=>Number(S?.depth)||0
};

/* ============================================================
   WIRING — connecting the buttons to the functions above
   ============================================================ */
$("pad").addEventListener("click", e => {
  const b = e.target.closest(".act");
  if(!b || b.disabled) return;
  if(b.dataset.reaction)return tapReaction(b.dataset.reaction);
  if(b.dataset.k)tapAction(b.dataset.k);
});
$("heroEndTurn")?.addEventListener("click", () => tapAction("endturn"));

$("btnRun").addEventListener("click", tapRun);
$("tell").addEventListener("click", () => {
  const f=S?.foe;
  if(!f?.revealed) return;
  f.weaknessManualOpen=weaknessCollapsed(f);
  render();
});
$("btnDescend").addEventListener("click", () => startTravel("descend"));
$("btnExplore").addEventListener("click", () => startTravel("explore"));
$("btnRest").addEventListener("click", takeRest);
$("btnPack").addEventListener("click", () => openPack(S?.foe?"combat":null,"backpack"));
$("btnTownPack")?.addEventListener("click", () => openPack(null,"backpack"));
$("townHeroCard")?.addEventListener("click", openCharacterSheet);
$("townHeroCard")?.addEventListener("keydown", e => {
  if(e.key!=="Enter"&&e.key!==" ") return;
  e.preventDefault();
  openCharacterSheet();
});
$("btnStopTravel").addEventListener("click", stopTravel);
$("btnBrowseDescend").addEventListener("click", () => startTravel("descend"));
$("btnBrowseStop").addEventListener("click", stopTravel);
$("btnCampHere").addEventListener("click", campAtHollow);
$("btnLeaveHollow").addEventListener("click", () => leaveHollow(false));
$("btnQuestRewardClose")?.addEventListener("click",closeQuestRewardConfirmation);
$("travelEventActions").addEventListener("click", e => {
  const b = e.target.closest("[data-event-action]");
  if(!b) return;
  handleTravelEventAction(b.dataset.eventAction);
});
$("btnPackClose").addEventListener("click", backFromPack);
$("btnPackWindowClose")?.addEventListener("click", backFromPack);
$("packScrim").addEventListener("click", backFromPack);
$("packTabs").addEventListener("click", e => {
  const merchantTab=e.target.closest("[data-merchant-view]");
  if(merchantTab && !merchantTab.disabled){ merchantView=merchantTab.dataset.merchantView; renderPack(false); return; }
  const tab=e.target.closest("[data-pack-tab]");
  if(tab && !tab.disabled) setPackTab(tab.dataset.packTab);
});
$("packFilterBar").addEventListener("click", e => {
  const merchantScope=e.target.closest("[data-merchant-gear-scope]");
  if(merchantScope){merchantSellGearScope=merchantScope.dataset.merchantGearScope;merchantSellSelection.equipment.clear();renderPack(false);return;}
  const equipment=e.target.closest("[data-equipment-filter]");
  if(equipment){setEquipmentFilter(equipment.dataset.equipmentFilter);return;}
  const backpack=e.target.closest("[data-backpack-filter]");
  if(backpack){setBackpackFilter(backpack.dataset.backpackFilter);return;}
});
$("packDynamicItems").addEventListener("click", e => {
  const filter=e.target.closest("[data-equipment-filter]"); if(filter){setEquipmentFilter(filter.dataset.equipmentFilter);return;}
  const bandage=e.target.closest("[data-use-bandage]"); if(bandage){useBandage();return;}
  const weapon=e.target.closest("[data-equip-weapon]"); if(weapon){equipWeapon(weapon.dataset.equipWeapon);return;}
  const equipment=e.target.closest("[data-equip-equipment]"); if(equipment){equipEquipmentItem(equipment.dataset.equipEquipment,equipment.dataset.equipmentTarget||null);return;}
  const offer=e.target.closest("[data-offer-item]"); if(offer){resolveOffering(offer.dataset.offerItem);return;}
  const merchantBuy=e.target.closest("[data-merchant-buy]"); if(merchantBuy){merchantBuyStock(merchantBuy.dataset.merchantBuy,false);return;}
  const merchantConfirm=e.target.closest("[data-merchant-confirm-buy]"); if(merchantConfirm){merchantBuyStock(merchantConfirm.dataset.merchantConfirmBuy,true);return;}
  const merchantCancel=e.target.closest("[data-merchant-cancel-buy]"); if(merchantCancel){cancelMerchantPurchase();return;}
  const merchantToggleEquip=e.target.closest("[data-merchant-toggle-equip]"); if(merchantToggleEquip){
    if(merchantToggleEquip.dataset.equippedWarning==="1" && !merchantSellSelection.equipment.has(merchantToggleEquip.dataset.merchantToggleEquip)){
      if(!confirm("This item is currently equipped. Select it for sale anyway? Selling it will remove it from your loadout."))return;
    }
    merchantToggleSellEquipment(merchantToggleEquip.dataset.merchantToggleEquip);return;
  }
  const merchantQty=e.target.closest("[data-merchant-pack-qty]"); if(merchantQty){
    const key=merchantQty.dataset.merchantPackQty;
    if(merchantQty.dataset.merchantQtyAll==="1"){ const row=merchantBackpackSellRows().find(x=>x.key===key); if(row) merchantSetBackpackSellQty(key,row.count); }
    else merchantAdjustBackpackSellQty(key,Number(merchantQty.dataset.merchantQtyDelta)||0);
    return;
  }
  const merchantSellEquip=e.target.closest("[data-merchant-sell-equipment]"); if(merchantSellEquip){merchantSellSelectedEquipment();return;}
  const merchantSellPack=e.target.closest("[data-merchant-sell-backpack]"); if(merchantSellPack){merchantSellSelectedBackpack();return;}
});
$("boonOptions").addEventListener("click", e => {
  const b = e.target.closest(".boon-opt");
  if(!b || !S?.pendingBoonChoice) return;
  activateBoon(b.dataset.boon);
});
$("travel").addEventListener("pointerdown", () => {
  if(S?.activeHollow) cancelHollowAutoResume();
}, {passive:true});

$("btnReviewLevelup").addEventListener("click", () => {
  if(!S || over) return;
  dismissLevelUpNotice();
  charView="overview";
  clearCharacterNotice("overview");
  openCharacterSheet();
  const panel=document.querySelector(".char-panel");
  if(panel) panel.scrollTop=0;
});
$("btnDismissLevelup").addEventListener("click", dismissLevelUpNotice);
$("btnClearCharNotices").addEventListener("click", clearAllCharacterNotices);
$("charStats").addEventListener("click", e => {
  const plus=e.target.closest("[data-stat-plus]");
  if(plus){stageStatPoint(plus.dataset.statPlus,1);return;}
  const minus=e.target.closest("[data-stat-minus]");
  if(minus){stageStatPoint(minus.dataset.statMinus,-1);return;}
});
$("btnConfirmStats").addEventListener("click", confirmStatPointDraft);

$("btnAbilities").addEventListener("click", () => {
  if(over) return;
  $("sheet").hidden = false;
  renderAbilitySheet();
});
$("abilitiesList").addEventListener("click", e => {
  const more = e.target.closest(".skill-more[data-ability-more]");
  if(more){
    const id = more.dataset.abilityMore;
    combatExpandedAbility = combatExpandedAbility === id ? null : id;
    renderAbilitySheet();
    return;
  }
  const b = e.target.closest(".skill[data-ability]");
  if(!b || b.disabled) return;
  useAbility(b.dataset.ability);
});
$("travelHeroCard").addEventListener("click", openCharacterSheet);
$("travelHeroCard").addEventListener("keydown", e => {
  if(e.key === "Enter" || e.key === " "){
    e.preventDefault();
    openCharacterSheet();
  }
});
$("charAbilities").addEventListener("click", e => {
  const more = e.target.closest(".skill-more[data-char-ability-more]");
  if(!more) return;
  const id = more.dataset.charAbilityMore;
  charExpandedAbility = charExpandedAbility === id ? null : id;
  renderCharacterSheet();
});
$("charNav").addEventListener("click", e => {
  const b=e.target.closest("[data-char-view]"); if(!b)return; charView=b.dataset.charView; if(charView!=="skills") clearCharacterNotice(charView); renderCharacterSheet();
});
$("questPageTabs")?.addEventListener("click",e=>{const b=e.target.closest("[data-quest-list-view]");if(!b)return;questListView=b.dataset.questListView;charExpandedQuest=null;renderQuestPage();});
$("charQuests")?.addEventListener("click",e=>{
  const more=e.target.closest("[data-quest-more]");if(more){charExpandedQuest=charExpandedQuest===more.dataset.questMore?null:more.dataset.questMore;renderQuestPage();return;}
  const del=e.target.closest("[data-quest-delete]");if(del)deleteInactiveQuest(del.dataset.questDelete);
});
$("btnEquipmentExpand").addEventListener("click", toggleEquipmentList);
$("equipmentRingRail").addEventListener("click", e => {const b=e.target.closest("[data-equipment-slot]");if(b)selectEquipmentSlot(b.dataset.equipmentSlot);});
$("equipmentBodyGrid").addEventListener("click", e => {const b=e.target.closest("[data-equipment-slot]");if(b)selectEquipmentSlot(b.dataset.equipmentSlot);});
$("equipmentCompactGrid").addEventListener("click", e => {
  const filter=e.target.closest("[data-equipment-filter]"); if(filter){setEquipmentFilter(filter.dataset.equipmentFilter);return;}
  const item=e.target.closest("[data-equipment-item]"); if(item){openEquipmentItemInspect(item.dataset.equipmentItem,item.dataset.equipmentTarget||null);return;}
  const b=e.target.closest("[data-equipment-slot]"); if(b)openEquipmentInspect(b.dataset.equipmentSlot);
});
$("equipmentInfo").addEventListener("click", e => {
  const remove=e.target.closest("[data-equipment-inline-unequip]");
  if(remove) unequipEquipmentSlot(remove.dataset.equipmentInlineUnequip);
});
$("equipmentInspectContent").addEventListener("click", e => {
  if(e.target.closest("[data-equipment-close]")){closeEquipmentInspect();return;}
  const equip=e.target.closest("[data-equipment-equip]"); if(equip){equipEquipmentItem(equip.dataset.equipmentEquip,equip.dataset.equipmentTarget||null);return;}
  const unequip=e.target.closest("[data-equipment-unequip]"); if(unequip){unequipEquipmentSlot(unequip.dataset.equipmentUnequip);return;}
  if(e.target.closest("[data-equipment-full]")){equipmentInspectExpanded=!equipmentInspectExpanded;renderEquipmentInspect();}
});
$("equipmentInspectScrim").addEventListener("click", closeEquipmentInspect);
$("charStatuses").addEventListener("click", e => {
  const bandage=e.target.closest("[data-use-bandage]");
  if(!bandage || bandage.disabled) return;
  useBandage();
});
$("charAbilities").addEventListener("click", e => {
  const b=e.target.closest("[data-field-ability]"); if(!b||b.disabled)return; useFieldAbility(b.dataset.fieldAbility);
});
$("btnCharClose").addEventListener("click", closeCharacterSheet);
$("btnCharWindowClose")?.addEventListener("click", closeCharacterSheet);
$("charScrim").addEventListener("click", closeCharacterSheet);
$("btnSettingsClose").addEventListener("click", closeSettingsSheet);
$("settingsScrim").addEventListener("click", closeSettingsSheet);
$("arena").addEventListener("click", e => {
  const cog=e.target.closest("[data-open-settings]");
  if(cog) openSettingsSheet();
});
$("btnSettingNotices").addEventListener("click", () => setCharacterIndicators(!settings.characterIndicators));
$("btnSettingDice").addEventListener("click", () => setDiceAnimation(!settings.diceAnimation));
document.getElementById("worldZoomChoices")?.addEventListener("click",e=>{const b=e.target.closest("[data-world-zoom]");if(b)setWorldZoom(b.dataset.worldZoom);});
document.getElementById("minimapSizeChoices")?.addEventListener("click",e=>{const b=e.target.closest("[data-minimap-size]");if(b)setMinimapSize(b.dataset.minimapSize);});
$("btnResetWindowPositions")?.addEventListener("click",resetFloatingWindowPositions);
$("combatFontChoices").addEventListener("click", e => {
  const b=e.target.closest("[data-combat-font]");
  if(b) setCombatFont(b.dataset.combatFont);
});
$("diceSizeChoices").addEventListener("click", e => {
  const b=e.target.closest("[data-dice-size]");
  if(b) setDiceSize(b.dataset.diceSize);
});
$("combatDiceChoices").addEventListener("click", e => {
  const b=e.target.closest("[data-combat-dice]");
  if(b) setCombatDice(b.dataset.combatDice);
});
$("btnResetSkillDiagnostics").addEventListener("click", resetSkillDiagnostics);
$("btnOpenInfo").addEventListener("click", openInfoSheet);
$("btnInfoBack").addEventListener("click", closeInfoSheet);
$("infoScrim").addEventListener("click", closeInfoSheet);
$("infoChapterList").addEventListener("click", e => {
  const b=e.target.closest("[data-info-chapter]");
  if(!b)return;infoChapterId=b.dataset.infoChapter;renderInfoSheet();
});
$("encounterGraceChoices").addEventListener("click", e => {
  const b=e.target.closest("[data-encounter-grace]");
  if(b) setEncounterGrace(b.dataset.encounterGrace);
});
$("btnResetSettings").addEventListener("click", resetSettings);
$("characterSlotList").addEventListener("click", e => {
  const del=e.target.closest("[data-delete-character-slot]");
  if(del && !del.disabled){deleteCharacterSlot(del.dataset.deleteCharacterSlot);return;}
  const b=e.target.closest("[data-character-slot]");
  if(b && !b.disabled) switchCharacterSlot(b.dataset.characterSlot);
});
$("restAbilityOptions").addEventListener("click", e => {
  const b = e.target.closest(".restskill-opt[data-recover-ability]");
  if(!b || !S?.pendingRestAbilityChoice) return;
  if(recoverOneAbilityUse(b.dataset.recoverAbility)){
    travelLogAdd(`Rest also restored <b>1 use</b> of <b>${esc(abilityDisplayName(b.dataset.recoverAbility))}</b>.`, "good");
    closeRestAbilityPick();
    render();
  }
});
$("combatLootPanel")?.addEventListener("click", async e => {
  const investigate=e.target.closest("[data-combat-loot-investigate]");
  if(investigate){investigate.disabled=true;await resolveLootSearch("investigation");return;}
  const cont=e.target.closest("[data-combat-loot-continue]");
  if(cont && combatVictoryPending) finalizeCombatVictory(combatVictoryPending);
});
$("worldLootSheet")?.addEventListener("click", async e=>{
  const investigate=e.target.closest("[data-world-loot-investigate]");if(investigate){investigate.disabled=true;await resolveWorldLootSearch();return;}
  if(e.target.closest("[data-world-loot-close]")||e.target.id==="worldLootSheet")closeWorldLoot();
});
$("interactionActions")?.addEventListener("click", async e=>{
  const b=e.target.closest("[data-interaction-choice]");if(!b||b.disabled)return;
  await handleInteractionChoice(b.dataset.interactionChoice);
});
$("btnCombatPack").addEventListener("click", () => {
  if(!S || over || !S.foe) return;
  armed=null;
  openPack("combat","backpack");
});
$("btnBack").addEventListener("click", closeAbilitySheet);
$("scrim").addEventListener("click", closeAbilitySheet);

$("creatorName").addEventListener("input", e => {
  creatorDraft.name = e.target.value;
  renderCreator();
});
$("creator").addEventListener("click", e => {
  const cls = e.target.closest("[data-class-choice]");
  if(cls){ creatorDraft.className = cls.dataset.classChoice; creatorDraft.startingLoadout=null; renderCreator(); return; }
  const loadout = e.target.closest("[data-starting-loadout]");
  if(loadout){ creatorDraft.startingLoadout=loadout.dataset.startingLoadout; renderCreator(); return; }
  const stat = e.target.closest(".creator-human-stat[data-human-trait]");
  if(stat && !stat.disabled){
    creatorDraft[stat.dataset.humanTrait] = stat.dataset.humanStat;
    renderCreator();
    return;
  }
  const b = e.target.closest(".creator-choice[data-creator-key]");
  if(!b) return;
  creatorDraft[b.dataset.creatorKey] = b.dataset.creatorValue;
  renderCreator();
});
$("btnSignFate").addEventListener("click", signFate);
$("creatorName").addEventListener("keydown", e => {
  if(e.key === "Enter" && creatorComplete()) signFate();
});

document.addEventListener("visibilitychange",()=>{
  if(document.hidden) suspendRuntime();
  else resumeRuntime();
});
window.addEventListener("pagehide",()=>{suspendRuntime();saveRunNow();});
window.addEventListener("pageshow",()=>{if(!document.hidden) resumeRuntime();});
$("arena").addEventListener("click",()=>{setTimeout(saveRunNow,0);});

function bootGame(){
  loadSettings();
  applyCombatFont();
  applyMinimapSize();
  initFloatingWindowDragging();
  applyConceptChrome();
  loadActiveRunSlot();
  const snapshot=loadRunSnapshot(currentRunSlot);
  const restored=restoreRun(snapshot);
  if(!restored){
    renderCreator();
    if(runSaveLoadIssue) showSaveLoadIssueScreen(runSaveLoadIssue);
  }
  window.LowfathomLegacyReady=true;
  window.dispatchEvent(new Event("lowfathom:legacy-ready"));
}
bootGame();
/* ---------- Session 8D: PWA service worker update hardening ---------- */
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./service-worker.js", {updateViaCache:"none"})
      .then(registration => {
        // Ask the browser to check for a newer worker whenever Lowfathom opens.
        registration.update().catch(() => {});
      })
      .catch(error => {
        console.error("Lowfathom service worker registration failed:", error);
      });
  });
}

