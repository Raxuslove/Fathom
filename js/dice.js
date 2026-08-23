
import DiceBox from "https://unpkg.com/@3d-dice/dice-box@1.1.3/dist/dice-box.es.min.js";

const layer=document.getElementById("fathomDiceBoxLayer");
const caption=document.getElementById("fathomDieCaption");
const status=document.getElementById("fathomDiceBoxStatus");
const CDN_ORIGIN="https://unpkg.com/@3d-dice/dice-box@1.1.3/dist/";
const assetPath="assets/";
const FATHOM_THEME="fathomObsidian";
const COMBAT_D20_THEME="default";
const fathomThemePath=new URL("./assets/fathom-die/obsidian/",document.baseURI).href;
let hideTimer=null;
let rollToken=0;
let physicalDiceQueue=Promise.resolve();
const combatRollPromisesByKey=new Map();
let combatCancelEpoch=0;
const combatCancelWaiters=new Set();

const diceBox=new DiceBox({
  container:"#fathomDiceBoxStage",
  assetPath,
  origin:CDN_ORIGIN,
  theme:FATHOM_THEME,
  preloadThemes:[COMBAT_D20_THEME],
  externalThemes:{[FATHOM_THEME]:fathomThemePath},
  themeColor:"#040506",
  offscreen:false,
  scale:4.85,
  gravity:1,
  mass:1.35,
  friction:.82,
  restitution:.28,
  angularDamping:.36,
  linearDamping:.34,
  spinForce:5.2,
  throwForce:6.2,
  startingHeight:8.5,
  settleTimeout:4500,
  enableShadows:true,
  shadowTransparency:.72,
  lightIntensity:.54
});

window.fathomDiceBoxReady=false;
window.fathomDiceBoxFailed=false;
window.fathomCombatDiceFailed=false;
const INIT_TIMEOUT_MS=12000;
const COMBAT_D20_TIMEOUT_MS=6500;
function diceTimeout(promise,ms,label){
  return new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>reject(new Error(`${label} timed out after ${ms}ms`)),ms);
    Promise.resolve(promise).then(
      value=>{clearTimeout(timer);resolve(value);},
      err=>{clearTimeout(timer);reject(err);}
    );
  });
}
function enqueuePhysicalDice(operation){
  const task=physicalDiceQueue.catch(()=>null).then(operation);
  physicalDiceQueue=task.catch(()=>null);
  return task;
}
const initAttempt=diceBox.init();
const initTimeout=new Promise((_,reject)=>setTimeout(()=>reject(new Error(`Dice Box init timed out after ${INIT_TIMEOUT_MS}ms`)),INIT_TIMEOUT_MS));
const ready=Promise.race([initAttempt,initTimeout]).then(()=>{
  window.fathomDiceBoxReady=true;
  window.fathomDiceBoxFailed=false;
  layer?.classList.remove("loading");
  if(status)status.textContent="Dice ready";
  console.info("Fathom ready (v0.088.9 Session 9E combat opening fixes + v0.088.8 Skill resolver null-roll fix + v0.088.7 native d100 parser + matte obsidian theme)");
  return diceBox;
}).catch(err=>{
  window.fathomDiceBoxReady=false;
  window.fathomDiceBoxFailed=true;
  layer?.classList.remove("loading");
  if(status)status.textContent="Physical dice unavailable";
  console.error("Fathom Dice Box initialization failed:",err);
  return null;
});

function percentileValue(results){
  // Dice Box's native d100 is displayed as a percentile pair (tens + ones),
  // but roll() resolves with one logical d100 entry whose value is already combined.
  const list=Array.isArray(results)?results:[results];
  const logical=list.find(item=>{
    const type=String(item?.dieType||"").toLowerCase();
    const sides=Number(item?.sides);
    return type==="d100"||sides===100;
  });
  if(logical){
    const value=Number(logical?.value ?? logical?.result);
    if(Number.isFinite(value) && value>=0 && value<=100){
      return {total:value===0?100:value,raw:list};
    }
  }

  // Defensive compatibility path in case a future build exposes both physical dice.
  const values=list.map(item=>({
    type:String(item?.dieType||"").toLowerCase(),
    sides:Number(item?.sides),
    value:Number(item?.value ?? item?.result)
  })).filter(item=>Number.isFinite(item.value));
  const tensDie=values.find(item=>item.type==="d100"||item.sides===100||((item.value===0||item.value%10===0)&&item.value<=100));
  const onesDie=values.find(item=>item!==tensDie&&(item.type==="d10"||item.sides===10||item.value<=10));
  if(tensDie&&onesDie){
    const tens=tensDie.value===100?0:tensDie.value;
    const ones=onesDie.value===10?0:onesDie.value;
    const combined=tens+ones;
    return {total:combined===0?100:combined,raw:list};
  }

  console.error("Unexpected Dice Box d100 result:",results);
  throw new Error("Percentile roll returned an unreadable result");
}
function d20Value(results){
  const list=Array.isArray(results)?results:[results];
  const die=list.find(item=>String(item?.dieType||"").toLowerCase()==="d20"||Number(item?.sides)===20) || list[0];
  const value=Number(die?.value ?? die?.result);
  if(Number.isFinite(value)&&value>=1&&value<=20)return Math.round(value);
  console.error("Unexpected Dice Box d20 result:",results);
  throw new Error("Combat d20 returned an unreadable result");
}
window.fathomDiceBoxClear=()=>{
  clearTimeout(hideTimer);
  try{diceBox.clear();}catch{}
};
window.fathomCombatDiceCancel=()=>{
  combatCancelEpoch++;
  ++rollToken;
  clearTimeout(hideTimer);
  for(const resolve of combatCancelWaiters)resolve(null);
  combatCancelWaiters.clear();
  combatRollPromisesByKey.clear();
  try{diceBox.clear();}catch{}
  layer?.classList.remove("active","loading");
  layer?.setAttribute("aria-hidden","true");
  if(layer)delete layer.dataset.rollSide;
};

async function performFathomPercentileRoll(payload){
  const token=++rollToken;
  clearTimeout(hideTimer);
  layer?.classList.add("active","loading");
  layer?.setAttribute("aria-hidden","false");
  if(caption){
    caption.className="fathom-roll-caption";
    caption.innerHTML=`${payload?.name||"Skill check"} · Need <strong>${payload?.target||51}+</strong>`;
  }
  const initialized=await ready;
  if(token!==rollToken)return null;
  if(!initialized)throw new Error("Dice Box unavailable after initialization attempt");
  layer?.classList.remove("loading");
  try{diceBox.clear();}catch{}
  const fathomConfig={theme:FATHOM_THEME,themeColor:"#040506"};
  if(Number.isFinite(payload?.scale))fathomConfig.scale=payload.scale;
  await diceBox.updateConfig(fathomConfig);

  // Dice Box's native 1d100 roll already creates the complete percentile pair.
  // Do not add another d10 here: that would create an accidental third die.
  const raw=await diceBox.roll("1d100");
  if(token!==rollToken)return null;
  const result=percentileValue(raw);
  const target=Math.max(1,Math.min(100,Math.round(Number(payload?.target)||51)));
  const success=result.total>=target;
  if(caption){
    caption.className=`fathom-roll-caption${success?"":" failure"}`;
    caption.innerHTML=`Rolled <strong>${result.total}</strong> · Need ${target}+ · ${success?"SUCCESS":"FAILURE"}`;
  }
  clearTimeout(hideTimer);
  hideTimer=setTimeout(()=>{
    if(token!==rollToken)return;
    try{diceBox.clear();}catch{}
    layer?.classList.remove("active","loading");
    layer?.setAttribute("aria-hidden","true");
  },success?1350:1650);
  return result.total;
}
window.fathomDiceBoxRoll=payload=>enqueuePhysicalDice(()=>performFathomPercentileRoll(payload));

async function performPhysicalCombatD20(payload){
  const token=++rollToken;
  clearTimeout(hideTimer);
  layer?.classList.add("active","loading");
  layer?.setAttribute("aria-hidden","false");
  const bonus=Number(payload?.bonus)||0,ac=Number(payload?.ac)||0,sign=bonus>=0?"+":"";
  const combatSide=payload?.side==="enemy"?"enemy":"player";
  const combatColor=combatSide==="enemy"?"#a8242f":"#040506";
  if(layer)layer.dataset.rollSide=combatSide;
  if(caption){
    caption.className="fathom-roll-caption";
    caption.innerHTML=`${combatSide==="enemy"?"ENEMY · ":""}${payload?.name||"Attack"} · d20 ${sign}${bonus} vs AC <strong>${ac}</strong>`;
  }
  try{
    const initialized=await diceTimeout(ready,COMBAT_D20_TIMEOUT_MS,"Combat dice initialization");
    if(token!==rollToken)return null;
    if(!initialized)throw new Error("Dice Box unavailable after initialization attempt");
    layer?.classList.remove("loading");
    try{diceBox.clear();}catch{}

    // Keep combat color on the roll object itself. Dice Box officially supports
    // per-roll theme/themeColor values; this avoids racing the box's global
    // configuration between player, enemy and percentile rolls.
    if(Number.isFinite(payload?.scale)){
      await diceTimeout(diceBox.updateConfig({scale:payload.scale}),COMBAT_D20_TIMEOUT_MS,"Combat d20 scale update");
    }
    const notation={qty:1,sides:20,theme:COMBAT_D20_THEME,themeColor:combatColor};
    const raw=await diceTimeout(diceBox.roll(notation),COMBAT_D20_TIMEOUT_MS,"Combat d20 roll");
    if(token!==rollToken)return null;

    const roll=d20Value(raw),total=roll+bonus;
    const hit=roll===20||(roll!==1&&total>=ac);
    const natural=roll===20?" · NAT 20":roll===1?" · NAT 1":"";
    if(caption){
      caption.className=`fathom-roll-caption${hit?"":" failure"}`;
      caption.innerHTML=`${combatSide==="enemy"?"ENEMY · ":""}d20 <strong>${roll}</strong> ${sign}${bonus} = ${total} · AC ${ac}${natural} · ${hit?"HIT":"MISS"}`;
    }
    clearTimeout(hideTimer);
    await new Promise(resolve=>setTimeout(resolve,hit?650:800));
    window.fathomCombatDiceFailed=false;
    return roll;
  }catch(err){
    window.fathomCombatDiceFailed=true;
    if(status)status.textContent="Combat die unavailable — using instant rolls";
    console.error("Physical combat d20 failed; disabling it for this session and falling back to internal combat rolls:",err);
    throw err;
  }finally{
    if(token===rollToken){
      try{diceBox.clear();}catch{}
      layer?.classList.remove("active","loading");
      layer?.setAttribute("aria-hidden","true");
      if(layer)delete layer.dataset.rollSide;
    }
  }
}

window.fathomCombatDiceRoll=payload=>{
  const rollKey=String(payload?.rollKey||"");
  if(rollKey&&combatRollPromisesByKey.has(rollKey))return combatRollPromisesByKey.get(rollKey);

  const epoch=combatCancelEpoch;
  const task=enqueuePhysicalDice(()=>epoch===combatCancelEpoch?performPhysicalCombatD20(payload):null);
  let cancelResolve=null;
  const cancelled=new Promise(resolve=>{cancelResolve=resolve;combatCancelWaiters.add(resolve);});
  const wrapped=Promise.race([task,cancelled]).finally(()=>{
    if(cancelResolve)combatCancelWaiters.delete(cancelResolve);
    if(rollKey&&combatRollPromisesByKey.get(rollKey)===wrapped)combatRollPromisesByKey.delete(rollKey);
  });
  if(rollKey)combatRollPromisesByKey.set(rollKey,wrapped);
  return wrapped;
};
