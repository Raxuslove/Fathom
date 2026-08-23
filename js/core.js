export const VERSION = "0.201.0";
export const SAVE_KEY = "lowfathom:world:v1";
export const LEGACY_SAVE_KEY = "lowfathom:run";
export const TILE = 24;
export const CHUNK_TILES = 32;
export const CHUNK_SIZE = TILE * CHUNK_TILES;
export const FATHOMS_PER_TILE = 0.5;
export const FATHOMS_PER_STRATUM = 500;
export const START_WORLD_Y = 0;

export const STRATA = [
  "The Goblin Warren","The Drowned Galleries","The Ash Vaults","The Pale Chasm","The Sunless Works","The Hollow Choir"
];

export const FOLK = {
  Human:{mods:{}},"Half-Elf":{mods:{CHA:2,WIS:1,CON:-1}},"High-Elf":{mods:{INT:2,DEX:1,STR:-1}},
  Drow:{mods:{DEX:2,CHA:1,CON:-1}},Orc:{mods:{STR:2,CON:1,INT:-1}},"Half-Orc":{mods:{STR:2,WIS:1,CHA:-1}},
  Dwarf:{mods:{CON:2,STR:1,DEX:-1}},Halfling:{mods:{DEX:2,CHA:1,STR:-1}}
};
export const TRADES=["Smith's Apprentice","Merchant's Clerk","Herbalist's Hand","Scribe's Apprentice","Hunter's Hand","Mason's Apprentice","Stablehand","Caravan Hand"];
export const ORIGINS=["Market Town","Border Village","River Country","Hill Country","Forest Edge","Old City"];
export const CLASSES={
  Votary:{stat:"STR",weaponContribution:7,armor:39,defend:"Guard",defendReduction:.50,desc:"Martial faith · strong Guard · STR weapon"},
  Rogue:{stat:"DEX",weaponContribution:7,armor:31,defend:"Parry",defendReduction:.30,desc:"Finesse · Parry · DEX weapon"},
  Wizard:{stat:"INT",weaponContribution:7,armor:27,defend:"Ward",defendReduction:.30,desc:"Arcane · Ward · INT focus"}
};

export const FOES=[
  {id:"cutter",name:"goblin cutter",unlock:0,hp:32,atk:7,xp:9,awareness:-8,intents:{quick:55,heavy:15,dodge:10,guard:10,recover:10},recoverAt:.35,weakness:"Overcommits on close cuts. Counter retaliation hits harder."},
  {id:"scrounger",name:"goblin scrounger",unlock:4,hp:30,atk:6,xp:10,awareness:0,intents:{quick:35,heavy:10,dodge:30,guard:25,recover:0},recoverAt:.45,weakness:"Drops everything to recover. Strike punishes recovery."},
  {id:"skitter",name:"goblin skitter",unlock:8,hp:27,atk:6,xp:11,awareness:10,intents:{quick:35,heavy:5,dodge:45,guard:5,recover:10},recoverAt:.30,weakness:"Built to evade, not absorb. Heavy hits punish it."},
  {id:"shieldback",name:"goblin shieldback",unlock:14,hp:38,atk:6,xp:12,awareness:-4,intents:{quick:25,heavy:10,dodge:5,guard:45,recover:15},recoverAt:.35,weakness:"Its shield braces light work. Heavy can break through."},
  {id:"mauler",name:"goblin mauler",unlock:22,hp:34,atk:8,xp:14,awareness:-6,intents:{quick:30,heavy:50,dodge:5,guard:5,recover:10},recoverAt:.28,weakness:"Top-heavy. Off-Balance openings hurt it badly."},
  {id:"oldhand",name:"goblin oldhand",unlock:32,hp:42,atk:8,xp:16,awareness:18,intents:{quick:30,heavy:20,dodge:20,guard:20,recover:10},recoverAt:.30,weakness:"Its committed attacks expose it to heavy punishment."}
];

export const SETTLEMENTS=[
  {id:"grey-lantern",name:"Grey Lantern",depth:150,type:"Town",x:-4,services:["Market","Tavern","Herbalist","Guild Hall"]},
  {id:"lantern-city",name:"Lantern City",depth:450,type:"City",x:5,services:["Market","Inn","Guild Hall","Quartermaster"]},
  {id:"ashwick",name:"Ashwick",depth:550,type:"Town",x:-6,services:["Market","Tavern","Herbalist"]}
];

export const ACTIONS={
  strike:{name:"Strike",cost:1,kind:"attack",desc:"Chain 1.0× → 1.6× → 2.6×"},
  heavy:{name:"Heavy",cost:3,kind:"attack",desc:"3.2× committed attack"},
  defend:{name:"Defend",cost:2,kind:"defend",desc:"Prepare for the next attack"},
  counter:{name:"Counter",cost:3,kind:"defend",desc:"+4 AC; retaliate if it misses"},
  sand:{name:"Sand",cost:2,kind:"utility",desc:"60% chance to Blind"},
  read:{name:"Read",cost:1,kind:"utility",desc:"Learn this foe's weakness"},
  end:{name:"End Turn",cost:0,kind:"utility",desc:"Yield remaining Stamina"},
  run:{name:"Run",cost:3,kind:"utility",desc:"Escape; lose 10% Max HP"}
};

export function clamp(v,a,b){return Math.max(a,Math.min(b,v));}
export function lerp(a,b,t){return a+(b-a)*t;}
export function hash2(x,y,seed=0){
  let h=(Math.imul(x|0,374761393)+Math.imul(y|0,668265263)+Math.imul(seed|0,1442695041))|0;
  h=(h^(h>>>13));h=Math.imul(h,1274126177);h^=h>>>16;return (h>>>0)/4294967295;
}
export function rngInt(a,b,r=Math.random){return Math.floor(r()*(b-a+1))+a;}
export function weightedPick(weights,r=Math.random){
  const entries=Object.entries(weights);let total=entries.reduce((s,[,w])=>s+Math.max(0,w),0);let n=r()*total;
  for(const [k,w0] of entries){const w=Math.max(0,w0);n-=w;if(n<=0)return k;}return entries[0]?.[0]||"quick";
}
export function depthFromY(y){return Math.max(0,(START_WORLD_Y-y)/TILE*FATHOMS_PER_TILE);}
export function yFromDepth(depth){return START_WORLD_Y-(depth/FATHOMS_PER_TILE)*TILE;}
export function stratumIndex(depth){return Math.max(0,Math.floor(depth/FATHOMS_PER_STRATUM));}
export function stratumName(depth){const i=stratumIndex(depth);return STRATA[i]||`The Unnamed Deep ${i+1}`;}
export function progression(depth){const g=Math.pow(Math.max(0,depth),.6);return {g,primary:13+.60*g,con:12+.30*g,hp:(12+.30*g)*6,enemyHit:(12+.30*g)*6/9,defence:(13+.60*g)*3};}
export function attackBonus(rating){const base=13;const safe=Math.max(base*.25,Math.max(.01,rating));return Math.floor(4+2*Math.log2(safe/base));}
export function defenceStats(rating){const base=39;const safe=Math.max(base*.25,Math.max(.01,rating));const cont=13+2*Math.log2(safe/base);const ac=Math.floor(cont);return {ac,deflection:(cont-ac)*.08};}
export function playerAttackRating(p){const c=CLASSES[p.className]||CLASSES.Votary;const stat=(p.stats[c.stat]||10)+(p.equipmentAttributes?.[c.stat]||0);return .5*stat+(p.weaponContribution||c.weaponContribution);}
export function playerDefenceRating(p){return Math.max(0,p.armor??CLASSES[p.className]?.armor??0);}
export function xpToNext(level){return Math.round(20+10*Math.pow(level,1.5));}
export function maxHp(p){return Math.max(6,Math.round(((p.stats.CON||10)+(p.equipmentAttributes?.CON||0))*6));}
export function newPlayer(profile={}){
  const folk=profile.folk||"Human",className=profile.className||"Votary",mods=FOLK[folk]?.mods||{};
  const stats={STR:10,CON:10,DEX:10,INT:10,WIS:10,CHA:10};for(const [k,v] of Object.entries(mods))stats[k]+=v;
  const c=CLASSES[className]||CLASSES.Votary;const p={
    name:(profile.name||"Leofrun Fenwick").trim()||"Unnamed Delver",folk,trade:profile.trade||TRADES[0],origin:profile.origin||ORIGINS[0],className,
    level:1,xp:0,statPoints:0,gold:0,kills:0,stats,hp:1,hpMax:1,weaponContribution:c.weaponContribution,armor:c.armor,
    inventory:{campSupplies:2,bandages:1,water:1,rope:0,meat:0,rogueTools:className==='Rogue'?1:0,lexicon:className==='Wizard'?1:0,reliquary:className==='Votary'?1:0,misc:{},questItems:[],passageKey:null,loot:[],equipment:[]},equipment:null,generatedItems:{},equipmentAttributes:{},knowledge:{},deepest:0,dead:false
  };p.hpMax=maxHp(p);p.hp=p.hpMax;return p;
}
