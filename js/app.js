import {newPlayer,depthFromY,yFromDepth,clamp} from './core.js';
import {World} from './world.js';
import {Combat} from './combat.js';
import {UI} from './ui.js';
import {saveGame,loadGame,clearGame,hasLegacySave,importLegacy} from './save.js';
import {ensureEquipment,generateEquipmentDrop} from './equipment.js';

const $=id=>document.getElementById(id);
class Game{
  constructor(){this.player=null;this.world=null;this.combat=null;this.ui=new UI(this);this.currentDepth=0;this.saveTimer=null;}
  init(){
    this.ui.populateCreator();this.bindCreator();this.bindControls();this.bindUi();
    this.world=new World($('gameCanvas'),{onEncounter:e=>this.beginEncounter(e),onToast:m=>this.ui.toast(m),onInteract:(e,l)=>this.ui.setPrompt(e,l),onDepth:d=>this.depthChanged(d)});
    this.combat=new Combat({game:this,world:this.world,ui:this.ui,onEnd:r=>this.endEncounter(r),onDeath:k=>this.die(k),onSave:()=>this.save()});
    const saved=loadGame();if(saved&&!saved.player.dead){this.player=saved.player;ensureEquipment(this.player);this.player.hpMax=Math.max(this.player.hpMax||1,(this.player.stats.CON+(this.player.equipmentAttributes?.CON||0))*6);this.player.hp=Math.min(this.player.hp,this.player.hpMax);this.world.restore(saved.world);this.ui.showCreator(false);this.world.start();this.ui.toast('Active-world chronicle restored.');}else{this.ui.showCreator(true);this.world.start();this.world.setPaused(true);}
    $('importLegacyBtn').hidden=!hasLegacySave();this.ui.renderHud();
    if('serviceWorker'in navigator)navigator.serviceWorker.register('./service-worker.js?v=0.201.0').catch(err=>console.warn('Service worker',err));
  }
  bindCreator(){
    $('classGrid').addEventListener('click',e=>{const b=e.target.closest('[data-class]');if(!b)return;document.querySelectorAll('.class-btn').forEach(x=>x.classList.remove('selected'));b.classList.add('selected');});
    $('startBtn').addEventListener('click',()=>this.startNew(this.ui.creatorProfile()));
    $('importLegacyBtn').addEventListener('click',()=>{const p=importLegacy();if(!p){this.ui.toast('Could not import the legacy delver.');return;}this.player=p;ensureEquipment(this.player);this.world.player.x=12;this.world.player.y=yFromDepth(Math.max(0,p.deepest));this.player.deepest=Math.max(0,p.deepest);this.ui.showCreator(false);this.world.setPaused(false);this.save();this.ui.renderHud();this.ui.toast('Imported the v0.114 delver, including its real equipment and generated items. The old save was not changed.');});
  }
  startNew(profile){clearGame();this.player=newPlayer(profile);ensureEquipment(this.player);this.world.player.x=12;this.world.player.y=0;this.world.defeated.clear();this.world.opened.clear();this.world.visitedSettlements.clear();this.currentDepth=0;this.ui.showCreator(false);this.world.setPaused(false);this.ui.renderHud();this.ui.toast('The way upward leads deeper.');this.save();}
  bindControls(){
    window.addEventListener('keydown',e=>{if(['INPUT','SELECT','TEXTAREA'].includes(e.target?.tagName))return;if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code))e.preventDefault();if(e.code==='KeyI'){e.preventDefault();if(this.player&&!this.combat.active)this.ui.togglePack();return;}if(e.code==='KeyE'||e.code==='Space'){if(!this.combat.active)this.interact();return;}if(e.code==='Escape'){document.querySelectorAll('.sheet').forEach(s=>s.hidden=true);if(!this.combat.active)this.world.setPaused(false);return;}this.world.keyDown(e.code);});
    window.addEventListener('keyup',e=>this.world.keyUp(e.code));
    const joy=$('joystick'),stick=$('joystickStick');let active=false,pid=null;const reset=()=>{active=false;pid=null;stick.style.transform='translate(0px,0px)';this.world.setJoystick(0,0)};const update=e=>{const r=joy.getBoundingClientRect(),cx=r.left+r.width/2,cy=r.top+r.height/2,dx=e.clientX-cx,dy=e.clientY-cy,max=r.width*.32,len=Math.hypot(dx,dy)||1,scale=Math.min(max,len)/len,sx=dx*scale,sy=dy*scale;stick.style.transform=`translate(${sx}px,${sy}px)`;this.world.setJoystick(dx/max,dy/max);};joy.addEventListener('pointerdown',e=>{active=true;pid=e.pointerId;joy.setPointerCapture(pid);update(e)});joy.addEventListener('pointermove',e=>{if(active&&e.pointerId===pid)update(e)});joy.addEventListener('pointerup',reset);joy.addEventListener('pointercancel',reset);
    $('interactBtn').addEventListener('click',()=>this.interact());$('lookBtn').addEventListener('click',()=>this.world.look());
  }
  bindUi(){$('charBtn').addEventListener('click',()=>this.ui.showSheet('characterSheet'));$('packBtn').addEventListener('click',()=>this.ui.showSheet('packSheet'));$('menuBtn').addEventListener('click',()=>this.ui.showSheet('menuSheet'));$('settlementClose').addEventListener('click',()=>this.ui.closeSettlement());$('newRunBtn').addEventListener('click',()=>{this.ui.hideDeath();clearGame();this.ui.showCreator(true);this.world.setPaused(true);});}
  interact(){const r=this.world.interact();if(!r||r===true)return;if(r.type==='loot'){this.player.gold+=r.gold||0;this.player.inventory.loot.push({name:'Cavern Salvage',note:`Found near ${this.currentDepth.toFixed(1)} fathoms`});if(Math.random()<.45){const gear=generateEquipmentDrop(this.player,this.currentDepth);this.ui.toast(`Found ${gear.name}. It was added to the Equipment Backpack.`);}this.ui.renderHud();this.save();}if(r.type==='hollow'){const heal=Math.max(1,Math.round(this.player.hpMax*.10));this.player.hp=Math.min(this.player.hpMax,this.player.hp+heal);this.ui.renderHud();this.save();}if(r.type==='settlement'){this.ui.showSettlement(r.settlement);this.save();}}
  beginEncounter(entity){if(!this.player||this.player.dead)return;this.world.setCombat(true);this.combat.start(entity);}
  endEncounter(){this.ui.renderHud();this.world.setCombat(false);this.save();}
  die(killer){this.ui.renderHud();this.ui.showDeath(killer);this.world.setPaused(true);this.save();}
  depthChanged(d){if(!this.player)return;this.currentDepth=d;this.player.deepest=Math.max(this.player.deepest||0,d);this.ui.updateDepth(d);if(!this.combat.active&&Math.random()<.0015)this.save();}
  save(){if(!this.player||!this.world)return;clearTimeout(this.saveTimer);this.saveTimer=setTimeout(()=>saveGame(this),120);}
  hasSave(){return !!loadGame();}
  resetPrototype(){clearGame();location.reload();}
}

const game=new Game();window.lowfathom=game;game.init();
