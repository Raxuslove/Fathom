import {ACTIONS,CLASSES,FOLK,TRADES,ORIGINS,attackBonus,defenceStats,playerAttackRating,playerDefenceRating,stratumName,xpToNext,maxHp} from './core.js';
import {EQUIPMENT_SLOT_ORDER,EQUIPMENT_SLOT_LABELS,EQUIPMENT_BODY_LAYOUT,EQUIPMENT_FILTERS,BACKPACK_FILTERS,ensureEquipment,itemDef,equipItem,unequipSlot,gearLevel,rarityClass,rarityFrameClass,effectiveStat,filteredEquipmentBag,recommendedSlot,compareEquipment,equipmentDisplayStatLines,computedIntrinsicValue,computedItemGoldValue,formatGold,equipmentSlotBlocked,backpackMiscCategory} from './equipment.js';

const $=id=>document.getElementById(id);
export class UI{
  constructor(game){this.game=game;this.toastTimer=null;this.interactEntity=null;this.armed=null;this.packTab='backpack';this.equipmentFilter='all';this.backpackFilter='all';this.equipmentInspect={kind:'slot',slot:'rightHand',id:null,target:null};this.bindSheets();}
  bindSheets(){document.querySelectorAll('[data-close]').forEach(btn=>btn.addEventListener('click',()=>this.hideSheet(btn.dataset.close)));}
  populateCreator(){
    const fill=(id,arr)=>$(id).innerHTML=arr.map(v=>`<option value="${this.esc(v)}">${this.esc(v)}</option>`).join('');fill('createFolk',Object.keys(FOLK));fill('createTrade',TRADES);fill('createOrigin',ORIGINS);
    $('classGrid').innerHTML=Object.entries(CLASSES).map(([name,d])=>`<button class="class-btn${name==='Votary'?' selected':''}" data-class="${name}"><b>${name}</b><span>${d.desc}</span></button>`).join('');
  }
  creatorProfile(){const selected=document.querySelector('.class-btn.selected');return{name:$('createName').value,folk:$('createFolk').value,trade:$('createTrade').value,origin:$('createOrigin').value,className:selected?.dataset.class||'Votary'};}
  showCreator(v=true){$('creator').hidden=!v;}
  showCombat(v){$('combatUi').hidden=!v;$('worldControls').hidden=!!v;$('app').classList.toggle('combat-active',!!v);}
  renderHud(){
    const p=this.game.player;if(!p)return;ensureEquipment(p);
    $('hudName').textContent=p.name;$('hudLevel').textContent=`Lv ${p.level}`;$('hudHp').textContent=`${Math.ceil(p.hp)} / ${p.hpMax} HP`;$('hudClass').textContent=p.className;$('hudGold').textContent=formatGold(p.gold);
    const hpPct=Math.max(0,p.hp/p.hpMax*100);$('hudHpFill').style.width=hpPct+'%';$('hudHpBar').classList.toggle('low',hpPct<=25);
    const need=xpToNext(p.level),xpPct=Math.max(0,Math.min(100,p.xp/need*100));$('hudXpFill').style.width=xpPct+'%';$('hudXp').textContent=`${p.xp} / ${need} XP`;
    this.updateDepth(this.game.world?this.game.currentDepth:0);
  }
  updateDepth(depth){$('hudDepth').textContent=`${depth.toFixed(1)} fathoms`;$('hudStratum').textContent=stratumName(depth);}
  toast(msg,ms=2300){const el=$('toast');el.textContent=msg;el.classList.add('show');clearTimeout(this.toastTimer);this.toastTimer=setTimeout(()=>el.classList.remove('show'),ms);}
  setPrompt(entity,label){this.interactEntity=entity;const p=$('prompt');if(!entity){p.hidden=true;return;}p.hidden=false;p.textContent=`${label} · E / Interact`;}
  combatMessage(html){$('combatNote').innerHTML=html;}
  renderCombat(combat,actions){
    const f=combat.foe,p=this.game.player;$('foeName').textContent=f.name;$('foeLevel').textContent=`Depth ${Math.floor(this.game.currentDepth)}`;$('foeHp').textContent=`${f.hp}/${f.maxHp} HP`;$('foeHpFill').style.width=`${Math.max(0,f.hp/f.maxHp*100)}%`;$('foeIntent').textContent=combat.intentLabel();$('foeIntentTell').textContent=combat.intentTell();const status=[];if(f.guard)status.push('Guard');if(f.dodge)status.push('Dodge');if(f.blind)status.push('Blind');if(f.offBalance)status.push('Off-Balance');$('foeStatus').textContent=status.join(' · ');
    $('staminaPips').innerHTML=Array.from({length:3},(_,i)=>`<i class="pip${i<p.stamina?' on':''}"></i>`).join('');$('combatActions').innerHTML=actions.map(a=>{const disabled=(a.id!=='end'&&a.id!=='run'&&a.cost>p.stamina)||combat.locked||(a.id==='read'&&f.read);const cls=a.kind==='defend'?'defend':a.id==='heavy'?'heavy':a.kind==='utility'?'utility':'';return`<button class="action ${cls}${combat.armed===a.id?' armed':''}" data-action="${a.id}" ${disabled?'disabled':''}><b>${this.esc(a.name)}</b><span>${a.cost?`${a.cost} STA · `:''}${this.esc(a.desc)}</span></button>`}).join('');$('combatActions').querySelectorAll('[data-action]').forEach(b=>b.addEventListener('click',()=>combat.choose(b.dataset.action)));this.renderHud();
  }
  showSheet(id){if(this.game.combat?.active)return;$(id).hidden=false;this.game.world.setPaused(true);if(id==='characterSheet')this.renderCharacter();if(id==='packSheet')this.renderPack();if(id==='menuSheet')this.renderMenu();}
  hideSheet(id){$(id).hidden=true;if(!this.anySheetOpen())this.game.world.setPaused(false);}
  togglePack(){if(this.game.combat?.active)return;const s=$('packSheet');if(s.hidden)this.showSheet('packSheet');else this.hideSheet('packSheet');}
  anySheetOpen(){return [...document.querySelectorAll('.sheet')].some(s=>!s.hidden);}
  renderCharacter(){
    const p=this.game.player;ensureEquipment(p);const ab=attackBonus(playerAttackRating(p)),ds=defenceStats(playerDefenceRating(p));
    $('characterBody').innerHTML=`<div class="stats-grid">${Object.entries(p.stats).map(([k,v])=>{const eff=effectiveStat(p,k),bonus=eff-v;return`<div class="stat"><em>${k}</em><b>${eff}${bonus?` <small style="font-size:8px;color:#7ba17b">(+${bonus})</small>`:''}</b></div>`}).join('')}</div><div class="menu-grid"><div class="menu-card"><b>Combat</b><p>Attack Rating ${playerAttackRating(p).toFixed(1)} · Attack Bonus +${ab}<br>Defence Rating ${playerDefenceRating(p)} · AC ${ds.ac} · Deflection ${(ds.deflection*100).toFixed(1)}%</p></div><div class="menu-card"><b>Progress</b><p>Level ${p.level} · ${p.xp}/${xpToNext(p.level)} XP<br>Deepest ${p.deepest.toFixed(1)} fathoms · ${p.kills} kills</p></div><div class="menu-card"><b>Equipment</b><p>Gear Level ${gearLevel(p).toFixed(1)}<br>Main Hand: ${this.esc(itemDef(p,p.equipment.rightHand)?.name||'Empty')}</p></div><div class="menu-card"><b>Identity</b><p>${this.esc(p.folk)} ${this.esc(p.className)}<br>${this.esc(p.trade)} · ${this.esc(p.origin)}</p></div><div class="menu-card"><b>Unspent points</b><p>${p.statPoints} attribute point${p.statPoints===1?'':'s'}.</p></div></div>${p.statPoints>0?`<div class="stats-grid" style="margin-top:8px">${Object.keys(p.stats).map(k=>`<button class="stat" data-stat="${k}"><em>+1 ${k}</em><b>${p.stats[k]}</b></button>`).join('')}</div>`:''}`;
    $('characterBody').querySelectorAll('[data-stat]').forEach(b=>b.addEventListener('click',()=>{if(p.statPoints<=0)return;p.stats[b.dataset.stat]++;p.statPoints--;p.hpMax=maxHp(p);p.hp=Math.min(p.hp,p.hpMax);this.renderCharacter();this.renderHud();this.game.save();}));
  }
  renderPack(){
    const p=this.game.player;ensureEquipment(p);const body=$('packBody');
    body.innerHTML=`<div class="inventory-tabs"><button class="inventory-tab${this.packTab==='backpack'?' active':''}" data-inv-tab="backpack">Backpack</button><button class="inventory-tab${this.packTab==='equipment'?' active':''}" data-inv-tab="equipment">Equipment</button></div><div id="inventoryTabBody"></div>`;
    body.querySelectorAll('[data-inv-tab]').forEach(b=>b.addEventListener('click',()=>{this.packTab=b.dataset.invTab;this.renderPack();}));
    if(this.packTab==='equipment')this.renderEquipmentTab();else this.renderBackpackTab();
  }
  filterButtons(filters,active,attr){
    return `<div class="equipment-filter-row">${filters.map(f=>`<button class="equipment-filter${active===f.id?' selected':''}" ${attr}="${f.id}">${this.esc(f.label)}</button>`).join('')}</div>`;
  }
  renderBackpackTab(){
    const p=this.game.player,inv=p.inventory,root=$('inventoryTabBody'),rows=[];
    const add=(category,name,count,desc,tag='')=>{const n=Math.max(0,Number(count)||0);if(n<=0&&name!=='Camp Supplies'&&name!=='Bandages')return;rows.push({category,html:`<div class="pack-item compact"><div class="pack-item-top"><b>${this.esc(name)}${tag?`<span class="pack-tag">${this.esc(tag)}</span>`:''}</b><strong>×${n}</strong></div><p>${this.esc(desc)}</p></div>`});};
    add('consumables','Camp Supplies',inv.campSupplies,'Field bundles for a full Camp at a Safe Hollow.');
    add('consumables','Bandages',inv.bandages,'Stops Bleeding and remains a carried recovery resource.');
    add('consumables','Meat',inv.meat,'Rough rations and scavenged cuts.');
    add('consumables','Water',inv.water,'Carried water for the descent.');
    add('tools','Rope',inv.rope,'General delving rope.');
    add('tools','Rogue Tools',inv.rogueTools,'Reusable lockpick and trap tools.');
    if(inv.passageKey)add('quest',inv.passageKey.name||'Passage Key',1,'A unique key tied to a side passage.','Quest');
    for(const row of inv.questItems||[])if((row.qty||0)>0)add('quest',row.name||'Quest Item',row.qty,row.desc||'Quest-bound item.','Quest');
    for(const [name,count] of Object.entries(inv.misc||{}))if(count>0)add(backpackMiscCategory(name),name,count,'Carried find / secondary item.');
    for(const row of inv.loot||[])rows.push({category:'other',html:`<div class="pack-item compact"><div class="pack-item-top"><b>${this.esc(row.name||'Cavern Salvage')}</b><strong>—</strong></div><p>${this.esc(row.note||'Found below.')}</p></div>`});
    const visible=this.backpackFilter==='all'?rows:rows.filter(r=>r.category===this.backpackFilter);
    root.innerHTML=`<div class="inventory-summary"><span>Backpack categories · equipment has its own tab</span><b>${this.esc(formatGold(p.gold))}</b></div>${this.filterButtons(BACKPACK_FILTERS,this.backpackFilter,'data-backpack-filter')}<div class="pack-list">${visible.length?visible.map(r=>r.html).join(''):'<div class="equipment-empty">No carried items match this filter.</div>'}</div>`;
    root.querySelectorAll('[data-backpack-filter]').forEach(b=>b.addEventListener('click',()=>{this.backpackFilter=b.dataset.backpackFilter;this.renderBackpackTab();}));
  }
  renderEquipmentTab(){
    const p=this.game.player,root=$('inventoryTabBody');ensureEquipment(p);
    const slots=EQUIPMENT_BODY_LAYOUT.map(([slot,row,col])=>this.equipmentSlotHtml(slot,row,col)).join('');
    const rings=['ring1','ring2','ring3','ring4'].map(slot=>this.equipmentSlotHtml(slot)).join('');
    const inspect=this.renderEquipmentInspectHtml();
    const bag=filteredEquipmentBag(p,this.equipmentFilter).map(id=>this.equipmentBagRowHtml(id)).join('');
    root.innerHTML=`<div class="inventory-summary"><span>17-slot loadout · Intrinsic Value / iLv from v0.114</span><b>Gear ${gearLevel(p).toFixed(1)}</b></div>${this.filterButtons(EQUIPMENT_FILTERS,this.equipmentFilter,'data-equipment-filter')}<div class="equipment-stage canonical"><div class="equipment-rings">${rings}</div><div class="equipment-body">${slots}</div><div class="equipment-info">${inspect}</div></div><div class="equipment-backpack canonical">${bag||'<div class="equipment-empty">No carried equipment matches this filter.</div>'}</div>`;
    root.querySelectorAll('[data-equipment-filter]').forEach(b=>b.addEventListener('click',()=>{this.equipmentFilter=b.dataset.equipmentFilter;this.renderEquipmentTab();}));
    root.querySelectorAll('[data-equipment-slot]').forEach(b=>b.addEventListener('click',()=>{const slot=b.dataset.equipmentSlot;if(equipmentSlotBlocked(p,slot))return;this.equipmentInspect={kind:'slot',slot,id:p.equipment[slot]||null,target:slot};this.renderEquipmentTab();}));
    root.querySelectorAll('[data-equipment-item]').forEach(b=>b.addEventListener('click',()=>{const id=b.dataset.equipmentItem,target=recommendedSlot(p,id,null,this.equipmentFilter);this.equipmentInspect={kind:'bag',slot:target,id,target};this.renderEquipmentTab();}));
    root.querySelectorAll('[data-equipment-equip]').forEach(b=>b.addEventListener('click',()=>this.equipFromBackpack(b.dataset.equipmentEquip,b.dataset.equipmentTarget||null)));
    root.querySelectorAll('[data-equipment-unequip]').forEach(b=>b.addEventListener('click',()=>this.removeEquipment(b.dataset.equipmentUnequip)));
  }
  equipmentSlotHtml(slot,row=null,col=null){
    const p=this.game.player,blocked=equipmentSlotBlocked(p,slot),id=blocked?null:p.equipment[slot],d=itemDef(p,id),style=row?`style="grid-row:${row};grid-column:${col}"`:'';
    const selected=this.equipmentInspect.kind==='slot'&&this.equipmentInspect.slot===slot;
    return `<button class="equipment-slot${d?` has-rarity ${rarityFrameClass(d.rarity)}`:' empty'}${blocked?' blocked':''}${selected?' selected':''}" ${style} data-equipment-slot="${slot}" ${blocked?'aria-disabled="true"':''}><small>${this.esc(EQUIPMENT_SLOT_LABELS[slot])}</small><b class="${d?rarityClass(d.rarity):''}">${blocked?'2-hand':this.esc(d?.name||'Empty')}</b><span>${blocked?'occupied':d?`iLv ${d.itemLevel||0}`:'—'}</span></button>`;
  }
  equipmentBagRowHtml(id){
    const p=this.game.player,d=itemDef(p,id);if(!d)return'';
    const target=recommendedSlot(p,id,null,this.equipmentFilter),cmp=compareEquipment(p,id,target),stats=equipmentDisplayStatLines(d).slice(0,3).join(' · ');
    const bits=[`iLv ${this.delta(cmp.itemDelta)}`,`Gear ${this.delta(cmp.gearDelta,1)}`];
    const ar=cmp.strikeAfter-cmp.strikeBefore;if(Math.abs(ar)>.05)bits.push(`Attack ${this.delta(ar,1)}`);
    const ac=cmp.acAfter-cmp.acBefore;if(ac)bits.push(`AC ${this.delta(ac)}`);
    const dr=cmp.drAfter-cmp.drBefore;if(dr)bits.push(`DR ${this.delta(dr)}`);
    return `<button class="equipment-item equipment-pack ${rarityFrameClass(d.rarity)}" data-equipment-item="${id}"><div class="pack-item-top"><b class="${rarityClass(d.rarity)}">${this.esc(d.name)}<span class="pack-tag">${this.esc(EQUIPMENT_SLOT_LABELS[target]||d.slot||'Gear')}</span></b><strong class="${rarityClass(d.rarity)}">iLv ${d.itemLevel||0}</strong></div><span>${this.esc(d.rarity||'Common')} · IV ${Math.round(computedIntrinsicValue(d))} · ${this.esc(formatGold(computedItemGoldValue(d)))}</span><p>${this.esc(stats||d.desc||'')}</p><div class="pack-compare">${bits.map(x=>`<span>${this.esc(x)}</span>`).join('')}</div></button>`;
  }
  renderEquipmentInspectHtml(){
    const p=this.game.player,info=this.equipmentInspect;
    let id=info.kind==='bag'?info.id:p.equipment?.[info.slot],target=info.kind==='bag'?(info.target||recommendedSlot(p,id,null,this.equipmentFilter)):info.slot;
    if(!id){
      return `<em>${this.esc(EQUIPMENT_SLOT_LABELS[target]||'Equipment')}</em><b>Empty slot</b><p>Select carried equipment below to compare it with this loadout.</p>`;
    }
    const d=itemDef(p,id);if(!d)return'<p>Unknown equipment record.</p>';
    const lines=equipmentDisplayStatLines(d),cmp=info.kind==='bag'?compareEquipment(p,id,target):null;
    const consequences=[];
    if(cmp){
      const push=(label,a,b,digits=0)=>{const delta=b-a;if(Math.abs(delta)>(digits?0.05:0))consequences.push(`${label} ${this.delta(delta,digits)}`);};
      push('Gear',0,cmp.gearDelta,1);push('Attack Rating',cmp.strikeBefore,cmp.strikeAfter,1);push('Attack Bonus',cmp.attackBefore,cmp.attackAfter);push('DR',cmp.drBefore,cmp.drAfter);push('AC',cmp.acBefore,cmp.acAfter);push('HP',cmp.hpBefore,cmp.hpAfter);
      for(const k of ['STR','CON','DEX','INT','WIS','CHA'])push(k,cmp.attrsBefore[k]||0,cmp.attrsAfter[k]||0);
      const boss=(cmp.affAfter.bossDamage.pct||0)-(cmp.affBefore.bossDamage.pct||0);if(boss)consequences.push(`Boss Damage ${this.delta(boss)}%`);
      const reflect=(cmp.affAfter.reflect.pct||0)-(cmp.affBefore.reflect.pct||0);if(reflect)consequences.push(`Reflect ${this.delta(reflect)}%`);
    }
    return `<em>${info.kind==='bag'?`Backpack → ${this.esc(EQUIPMENT_SLOT_LABELS[target]||'slot')}`:this.esc(EQUIPMENT_SLOT_LABELS[target]||'Equipped')}</em><b class="${rarityClass(d.rarity)}">${this.esc(d.name)}</b><span class="equipment-info-meta">${this.esc(d.rarity||'Common')} · iLv ${d.itemLevel||0}<br>IV ${Math.round(computedIntrinsicValue(d))} · ${this.esc(formatGold(computedItemGoldValue(d)))}</span><div class="equipment-info-stats">${lines.map(x=>`<span>${this.esc(x)}</span>`).join('')}</div>${cmp?`<div class="equipment-compare-box"><em>Compared with ${this.esc(EQUIPMENT_SLOT_LABELS[target]||'slot')}</em>${consequences.length?consequences.map(x=>`<span>${this.esc(x)}</span>`).join(''):'<span>No visible derived-stat change.</span>'}</div>`:''}<p>${this.esc(d.desc||'')}</p><div class="equipment-info-actions">${info.kind==='bag'?`<button data-equipment-equip="${id}" data-equipment-target="${target||''}">Equip</button>`:`<button data-equipment-unequip="${target}">Unequip</button>`}</div>`;
  }
  delta(n,digits=0){const v=Number(n)||0;return `${v>0?'+':''}${v.toFixed(digits)}`;}
  equipFromBackpack(id,target=null){
    const p=this.game.player,d=itemDef(p,id);if(!d)return;
    if(equipItem(p,id,target)){this.equipmentInspect={kind:'slot',slot:target||recommendedSlot(p,id),id,target};this.renderPack();this.renderHud();this.game.save();this.toast(`${d.name} equipped.`);}
  }
  removeEquipment(slot){
    const p=this.game.player,d=itemDef(p,p.equipment[slot]);if(!d)return;
    if(unequipSlot(p,slot)){this.equipmentInspect={kind:'slot',slot,id:null,target:slot};this.renderPack();this.renderHud();this.game.save();this.toast(`${d.name} moved to the Equipment Backpack.`);}
  }
  renderMenu(){$('menuBody').innerHTML=`<div class="menu-grid"><div class="menu-card"><b>Controls</b><p>Desktop: WASD / Arrow keys. E or Space interacts. <b>I opens Inventory.</b> Mobile: left joystick + Interact. Up-screen is deeper.</p></div><div class="menu-card"><b>Active world</b><p>Movement is real-time. Enemies wander on accessible cavern floor; combat remains turn-based and resolves in-place.</p></div><div class="menu-card"><b>Save</b><p>The active-world build uses its own localStorage key and does not overwrite the v0.114 chronicle.</p></div><div class="menu-card"><b>Reset build</b><p><button class="secondary" id="resetPrototype">Delete active-world save</button></p></div></div>`;$('resetPrototype').addEventListener('click',()=>this.game.resetPrototype());}
  showSettlement(s){$('settlementName').textContent=s.name;$('settlementBody').innerHTML=`<div class="menu-grid"><div class="menu-card"><b>${s.type}</b><p>${s.name} sits at roughly ${s.depth} fathoms. The full old settlement/service implementation is still next in the conversion queue.</p></div>${s.services.map(x=>`<div class="menu-card"><b>${x}</b><p>Service placeholder.</p></div>`).join('')}</div>`;$('settlementSheet').hidden=false;this.game.world.setPaused(true);}
  closeSettlement(){$('settlementSheet').hidden=true;this.game.world.setPaused(false);}
  showDeath(killer){const p=this.game.player;$('deathCopy').innerHTML=`<b>${this.esc(p.name)}</b> reached <b>${p.deepest.toFixed(1)} fathoms</b> and was killed by ${this.esc(killer)}.<br>${p.kills} kills · Level ${p.level}.`;$('deathScreen').hidden=false;}
  hideDeath(){$('deathScreen').hidden=true;}
  esc(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
}
