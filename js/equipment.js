import {CLASSES,attackBonus,defenceStats,maxHp,playerAttackRating,playerDefenceRating,progression} from './core.js';

/*
  LOWFATHOM v0.201.0 — canonical equipment/inventory rebase

  This module is intentionally based on the v0.114.1.3 equipment spine rather
  than the simplified Active World prototype rules. The Canvas world is new;
  equipment slotting, iLv/Intrinsic Value, rarity gates, procedural gear,
  two-handed handling and comparison math are carried forward from the old game.
*/

export const EQUIPMENT_SLOT_ORDER = [
  "rightHand","leftHand","light","hat","cape","earLeft","necklace","earRight","top","gloves","bottoms","belt","boots",
  "ring1","ring2","ring3","ring4"
];
export const EQUIPMENT_SLOT_LABELS = {
  rightHand:"Main Hand",leftHand:"Off Hand",light:"Light",hat:"Hat",top:"Top / Shirt",gloves:"Gloves",
  cape:"Cape",belt:"Belt",bottoms:"Bottoms",boots:"Boots",necklace:"Pendant / Neck",
  earLeft:"Earring L",earRight:"Earring R",ring1:"Ring I",ring2:"Ring II",ring3:"Ring III",ring4:"Ring IV"
};
export const EQUIPMENT_BODY_LAYOUT = [
  ["light",1,1],["hat",1,2],["cape",1,3],
  ["earLeft",2,1],["necklace",2,2],["earRight",2,3],
  ["rightHand",3,1],["top",3,2],["leftHand",3,3],
  ["gloves",4,1],["bottoms",4,2],["belt",4,3],
  ["boots",5,2]
];
export const EQUIPMENT_FILTERS = [
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
export const BACKPACK_FILTERS = [
  {id:"all",label:"All"},
  {id:"consumables",label:"Consumables"},
  {id:"tools",label:"Tools"},
  {id:"quest",label:"Quest"},
  {id:"texts",label:"Texts"},
  {id:"materials",label:"Materials"},
  {id:"other",label:"Other"}
];

const STAT_KEYS=["STR","CON","DEX","INT","WIS","CHA"];
const DUAL_WIELD_FAMILIES=new Set(["dagger"]);
const BALANCE_DEPTH_EXPONENT=.60;
const INTRINSIC_VALUE_PER_ILVL=1;
const ARMOR_VALUE_COST=8;
const WEAPON_VALUE_COST=15;
const ATTRIBUTE_VALUE_COST=40;
const GENERATED_ILVL_VARIANCE=.06;
const GENERATED_VALUE_TOLERANCE=.08;
const GUARD_REDUCTION_SHIELD=.50;
const SLOT_BUDGET_COEFFICIENTS=Object.freeze({
  rightHand:1,leftHand:1,top:1,bottoms:.80,hat:.60,gloves:.60,boots:.60,
  cape:.50,belt:.50,light:.50,necklace:.50,earLeft:.40,earRight:.40,
  ring1:.40,ring2:.40,ring3:.40,ring4:.40
});
const PLAYER_WEAPON_SPEED=Object.freeze({
  dagger:125,shortsword:112,wand:110,sword:100,axe:100,unarmed:100,
  bow:90,staff:90,greatsword:80
});

export const RARITY_ORDER=Object.freeze(["Salvage","Poor","Common","Uncommon","Rare","Epic","Wondrous","Legendary","Mythical","Ancient","Sunless","Unfathomable"]);
export const RARITY_DEFS=Object.freeze({
  Salvage:{unlockDepth:0,baseChance:.08,budgetMult:.75},
  Poor:{unlockDepth:0,baseChance:.18,budgetMult:.88},
  Common:{unlockDepth:0,baseChance:null,budgetMult:1},
  Uncommon:{unlockDepth:0,baseChance:.20,budgetMult:1.08},
  Rare:{unlockDepth:0,baseChance:.10,budgetMult:1.18},
  Epic:{unlockDepth:250,baseChance:.05,budgetMult:1.32},
  Wondrous:{unlockDepth:500,baseChance:.04,budgetMult:1.47},
  Legendary:{unlockDepth:500,baseChance:.01,budgetMult:1.63},
  Mythical:{unlockDepth:2000,baseChance:.025,budgetMult:1.81},
  Ancient:{unlockDepth:3000,baseChance:.02,budgetMult:2},
  Sunless:{unlockDepth:4000,baseChance:.0175,budgetMult:2.22},
  Unfathomable:{unlockDepth:5000,baseChance:.005,budgetMult:2.47}
});

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

const STARTING_LOADOUTS=Object.freeze({
  Votary:Object.freeze([
    Object.freeze({id:"sword-shield",label:"Sword + Buckler",main:"salvage_longsword",off:"salvage_buckler"}),
    Object.freeze({id:"greatsword",label:"Two-handed Greatsword",main:"salvage_greatsword",off:null})
  ]),
  Rogue:Object.freeze([
    Object.freeze({id:"dagger-shield",label:"Dagger + Buckler",main:"salvage_dagger",off:"salvage_buckler"}),
    Object.freeze({id:"shortbow",label:"Two-handed Shortbow",main:"salvage_shortbow",off:null})
  ]),
  Wizard:Object.freeze([
    Object.freeze({id:"wand-shield",label:"Wand + Buckler",main:"salvage_wand",off:"salvage_buckler"}),
    Object.freeze({id:"staff",label:"Two-handed Wooden Staff",main:"salvage_staff",off:null})
  ])
});

const GENERATED_AFFIX_ENABLED={
  crit:false,
  bossDamage:true,
  reflect:true,
  lifesteal:false,
  skillRating:false,
  armorPen:false,
  magicPen:false,
  ccReduction:false,
  lootFind:false
};
const EQUIPMENT_AFFIXES=Object.freeze({
  crit:Object.freeze({id:"crit",name:"Critical Chance",unitCost:2.5,maxUnits:10,slots:["weapon","gloves","ring"],enabledKey:"crit"}),
  bossDamage:Object.freeze({id:"bossDamage",name:"Boss Damage",unitCost:8,maxUnits:15,slots:["weapon","focus","cape","light","necklace","earring","ring"],enabledKey:"bossDamage"}),
  reflect:Object.freeze({id:"reflect",name:"Damage Reflect",unitCost:6,maxUnits:15,slots:["shield","top","bottoms","hat","gloves","boots","cape","belt","necklace"],enabledKey:"reflect"}),
  lifesteal:Object.freeze({id:"lifesteal",name:"Lifesteal",unitCost:25,maxUnits:8,slots:["weapon","focus","necklace","ring"],enabledKey:"lifesteal"}),
  skillRating:Object.freeze({id:"skillRating",name:"Skill Rating",unitCost:12,maxUnits:12,slots:["focus","cape","belt","light","necklace","earring","ring"],enabledKey:"skillRating"}),
  armorPen:Object.freeze({id:"armorPen",name:"Armor Penetration",unitCost:10,maxUnits:15,slots:["weapon","gloves","ring"],enabledKey:"armorPen"}),
  magicPen:Object.freeze({id:"magicPen",name:"Magic Penetration",unitCost:10,maxUnits:15,slots:["weapon","focus","necklace","ring"],enabledKey:"magicPen"}),
  ccReduction:Object.freeze({id:"ccReduction",name:"Crowd-Control Reduction",unitCost:10,maxUnits:15,slots:["top","hat","cape","necklace","ring"],enabledKey:"ccReduction"}),
  lootFind:Object.freeze({id:"lootFind",name:"Loot Find",unitCost:15,maxUnits:10,slots:["cape","belt","light","necklace","earring","ring"],enabledKey:"lootFind"})
});
const GENERATED_WEAPON_FAMILIES=Object.freeze([
  Object.freeze({base:"Longsword",family:"sword",stat:"STR",hands:1,weight:2}),
  Object.freeze({base:"Greatsword",family:"greatsword",stat:"STR",hands:2,greatWeapon:true,weight:1}),
  Object.freeze({base:"Hand Axe",family:"axe",stat:"STR",hands:1,weight:1}),
  Object.freeze({base:"Dagger",family:"dagger",stat:"DEX",hands:1,weight:2}),
  Object.freeze({base:"Shortbow",family:"bow",stat:"DEX",hands:2,weight:2}),
  Object.freeze({base:"Wand",family:"wand",stat:"INT",hands:1,weight:2}),
  Object.freeze({base:"Wooden Staff",family:"staff",stat:"INT",hands:2,weight:2})
]);
const GENERATED_DROP_FAMILIES=Object.freeze([
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
const GENERATED_RARITY_PREFIX=Object.freeze({
  Salvage:"Salvaged",Poor:"Worn",Common:"",Uncommon:"Hardened",Rare:"Deep-forged",Epic:"Masterwork",
  Wondrous:"Wonder-wrought",Legendary:"Legend-marked",Mythical:"Mythbound",Ancient:"Ancient",Sunless:"Sunless",Unfathomable:"Unfathomable"
});

function rnd(){return Math.random();}
function pick(arr){return arr[Math.floor(rnd()*arr.length)];}
function weightedPick(entries,weightFn=e=>e.weight||1){
  const weights=entries.map(e=>Math.max(0,Number(weightFn(e))||0));
  const total=weights.reduce((a,b)=>a+b,0);
  if(total<=0)return entries[0];
  let roll=rnd()*total;
  for(let i=0;i<entries.length;i++){roll-=weights[i];if(roll<=0)return entries[i];}
  return entries[entries.length-1];
}
function clone(v){return JSON.parse(JSON.stringify(v));}
function depthGrowth(depth=0){return Math.pow(Math.max(0,Number(depth)||0),BALANCE_DEPTH_EXPONENT);}
export function expectedItemLevelAtDepth(depth=0){return Math.max(1,Math.round(100+(0.90/0.195)*depthGrowth(depth)));}
function intrinsicValueFromLevel(ilvl,coefficient=1){return Math.max(0,(Number(ilvl)||0)*Math.max(.01,Number(coefficient)||1)*INTRINSIC_VALUE_PER_ILVL);}
function itemLevelFromIntrinsic(value,coefficient=1){return Math.max(0,Math.round((Number(value)||0)/(Math.max(.01,Number(coefficient)||1)*INTRINSIC_VALUE_PER_ILVL)));}
function rarityDef(name){return RARITY_DEFS[name]||RARITY_DEFS.Common;}
function rarityMarketMultiplier(name){return Math.sqrt(Math.max(.01,rarityDef(name).budgetMult||1));}
export function rarityClass(name){return `rarity-${String(name||"Common").toLowerCase().replace(/[^a-z]+/g,"")}`;}
export function rarityFrameClass(name){return `rarity-frame rarity-frame-${String(name||"Common").toLowerCase().replace(/[^a-z]+/g,"")}`;}
function unfathomableDropChance(depth=0){
  const d=Math.max(0,Number(depth)||0);
  if(d<5000)return 0;
  return Math.min(.015,.005+Math.floor((d-5000)/1000)*.001);
}
function equipmentRarityChanceAtDepth(name,depth=0){
  const def=rarityDef(name),d=Math.max(0,Number(depth)||0);
  if(d<def.unlockDepth)return 0;
  return name==="Unfathomable"?unfathomableDropChance(d):(def.baseChance??0);
}
function itemSlotCoefficientFromDef(def){
  if(!def)return 1;
  if(def.kind==="weapon" || (def.family && ["sword","greatsword","axe","dagger","shortsword","bow","wand","staff","unarmed"].includes(def.family))) return Number(def.hands||1)===2?2:SLOT_BUDGET_COEFFICIENTS.rightHand;
  const slot=(def.slots||[])[0]||def.slot;
  return SLOT_BUDGET_COEFFICIENTS[slot]||1;
}
function affixIntrinsicValue(affixes){return Object.values(affixes||{}).reduce((sum,a)=>sum+(Number(a?.value)||0),0);}
export function computedIntrinsicValue(def){
  if(!def)return 0;
  if(Number.isFinite(Number(def.intrinsicValue)))return Math.max(0,Number(def.intrinsicValue));
  if(def.generated){
    let value=0;
    if(Number.isFinite(Number(def.weaponContribution)))value+=Number(def.weaponContribution)*WEAPON_VALUE_COST;
    if(Number.isFinite(Number(def.armor)))value+=Number(def.armor)*ARMOR_VALUE_COST;
    for(const stat of STAT_KEYS)value+=(Number(def.attributes?.[stat])||0)*ATTRIBUTE_VALUE_COST;
    value+=affixIntrinsicValue(def.affixes);
    if(value>0)return value;
  }
  return intrinsicValueFromLevel(def.itemLevel||0,itemSlotCoefficientFromDef(def));
}
export function computedItemGoldValue(def){
  if(!def)return 0;
  if(Number.isFinite(Number(def.goldValue)))return Math.max(0,Math.round(Number(def.goldValue)));
  return Math.max(0,Math.round(computedIntrinsicValue(def)*rarityMarketMultiplier(def.rarity||"Common")));
}
function stampItemEconomy(def,{recalculateGeneratedIlvl=false}={}){
  if(!def)return def;
  const coef=itemSlotCoefficientFromDef(def);
  const intrinsic=computedIntrinsicValue({...def,intrinsicValue:undefined,goldValue:undefined});
  def.intrinsicValue=Number(intrinsic.toFixed(2));
  if(recalculateGeneratedIlvl&&def.generated&&intrinsic>0)def.itemLevel=Math.max(1,itemLevelFromIntrinsic(intrinsic,coef));
  def.goldValue=Math.max(0,Math.round(def.intrinsicValue*rarityMarketMultiplier(def.rarity||"Common")));
  return def;
}
export function formatGold(value){
  const total=Math.max(0,Math.round(Number(value)||0)),gc=Math.floor(total/100),sc=total%100;
  if(gc>0&&sc>0)return `${gc.toLocaleString()} gc ${String(sc).padStart(2,"0")} sc`;
  if(gc>0)return `${gc.toLocaleString()} gc`;
  return `${sc.toLocaleString()} sc`;
}

export function itemDef(player,id){return EQUIPMENT_ITEMS[id]||player?.generatedItems?.[id]||null;}
export function equipmentItemUsesBothHands(player,id){const d=itemDef(player,id);return !!d&&(Number(d.hands||1)===2||d.greatWeapon===true);}
function equipmentItemDualWieldable(player,id){const d=itemDef(player,id);return !!d&&Number(d.hands||1)===1&&DUAL_WIELD_FAMILIES.has(d.family);}
export function compatibleSlots(player,id){
  const d=itemDef(player,id);if(!d)return [];
  const slots=[...(d.slots||[])];
  if(equipmentItemDualWieldable(player,id)){
    if(!slots.includes("rightHand"))slots.push("rightHand");
    if(!slots.includes("leftHand"))slots.push("leftHand");
  }
  return slots;
}
function startingLoadoutDef(cls,id=null){
  const list=STARTING_LOADOUTS[cls]||STARTING_LOADOUTS.Votary;
  return list.find(x=>x.id===id)||list[0];
}
export function startingEquipmentLoadout(cls,loadoutId=null){
  const choice=startingLoadoutDef(cls,loadoutId);
  return {
    rightHand:choice.main,leftHand:choice.off,light:null,hat:null,cape:null,
    earLeft:null,necklace:null,earRight:null,top:"salvage_top",gloves:null,
    bottoms:"salvage_bottoms",belt:null,boots:"salvage_boots",ring1:null,ring2:null,ring3:null,ring4:null
  };
}
export function ensureEquipment(player){
  if(!player)return;
  player.generatedItems=(player.generatedItems&&typeof player.generatedItems==="object"&&!Array.isArray(player.generatedItems))?player.generatedItems:{};
  player.inventory=(player.inventory&&typeof player.inventory==="object")?player.inventory:{};
  player.inventory.equipment=Array.isArray(player.inventory.equipment)?player.inventory.equipment:[];
  player.inventory.loot=Array.isArray(player.inventory.loot)?player.inventory.loot:[];
  player.inventory.misc=(player.inventory.misc&&typeof player.inventory.misc==="object"&&!Array.isArray(player.inventory.misc))?player.inventory.misc:{};
  for(const key of ["campSupplies","bandages","water","rope","meat","rogueTools"])player.inventory[key]=Math.max(0,Number(player.inventory[key])||0);
  if(!player.equipment||typeof player.equipment!=="object"||Array.isArray(player.equipment)){
    player.equipment=startingEquipmentLoadout(player.className,player.startingLoadoutId);
  }else{
    for(const slot of EQUIPMENT_SLOT_ORDER)if(!(slot in player.equipment))player.equipment[slot]=null;
  }
  const equipped=new Set(Object.values(player.equipment).filter(Boolean));
  player.inventory.equipment=[...new Set(player.inventory.equipment)].filter(id=>!!itemDef(player,id)&&!equipped.has(id));
  recalcEquipment(player);
}
export function equipmentItems(player){
  ensureEquipment(player);
  const out={};
  for(const slot of EQUIPMENT_SLOT_ORDER){
    const id=player.equipment[slot];
    out[slot]=id?{id,...itemDef(player,id),ilvl:Number(itemDef(player,id)?.itemLevel)||0,twoHanded:equipmentItemUsesBothHands(player,id)}:null;
  }
  return out;
}
export function equipmentSlotBlocked(player,slot){return slot==="leftHand"&&equipmentItemUsesBothHands(player,player?.equipment?.rightHand);}
function itemArmor(player,id){
  const def=itemDef(player,id);if(!def)return 0;
  if(Number.isFinite(Number(def.armor)))return Math.max(0,Number(def.armor));
  for(const stat of def.stats||[]){const m=String(stat).match(/^Armor\s*\+(\d+(?:\.\d+)?)/i);if(m)return Number(m[1])||0;}
  return 0;
}
export function equipmentArmorFor(player,equipmentState=player?.equipment){
  if(!equipmentState)return 0;let total=0;
  for(const slot of EQUIPMENT_SLOT_ORDER){
    if(slot==="leftHand"&&equipmentItemUsesBothHands(player,equipmentState.rightHand))continue;
    total+=itemArmor(player,equipmentState[slot]);
  }
  return total;
}
export function equipmentAttributeTotalsFor(player,equipmentState=player?.equipment){
  const out=Object.fromEntries(STAT_KEYS.map(k=>[k,0]));if(!equipmentState)return out;
  for(const slot of EQUIPMENT_SLOT_ORDER){
    if(slot==="leftHand"&&equipmentItemUsesBothHands(player,equipmentState.rightHand))continue;
    const a=itemDef(player,equipmentState[slot])?.attributes||{};
    for(const k of STAT_KEYS)out[k]+=Number(a[k])||0;
  }
  return out;
}
export function effectiveStat(player,key,equipmentState=player?.equipment){return (Number(player?.stats?.[key])||10)+(equipmentAttributeTotalsFor(player,equipmentState)[key]||0);}
export function weaponContributionForDef(def){
  if(!def)return 1;
  if(Number.isFinite(Number(def.weaponContribution)))return Number(def.weaponContribution);
  const handUnits=Number(def.hands||1)===2?2:1;
  return intrinsicValueFromLevel(def.itemLevel||0,handUnits)/WEAPON_VALUE_COST;
}
export function weaponAttackBaseForEquipment(player,equipmentState=player?.equipment){
  const def=itemDef(player,equipmentState?.rightHand)||{family:"unarmed",stat:"STR",hands:1,weaponContribution:1,itemLevel:0};
  const stat=def.stat||"STR";
  return .5*effectiveStat(player,stat,equipmentState)+weaponContributionForDef(def);
}
export function equipmentAffixTotalsFor(player,equipmentState=player?.equipment){
  const out={crit:{pct:0},bossDamage:{pct:0,bonusCap:0},reflect:{pct:0,damageCap:0},lifesteal:{pct:0,healCap:0}};
  if(!equipmentState)return out;
  for(const slot of EQUIPMENT_SLOT_ORDER){
    if(slot==="leftHand"&&equipmentItemUsesBothHands(player,equipmentState.rightHand))continue;
    const a=itemDef(player,equipmentState[slot])?.affixes||{};
    if(a.crit)out.crit.pct+=Number(a.crit.pct)||0;
    if(a.bossDamage){out.bossDamage.pct+=Number(a.bossDamage.pct)||0;out.bossDamage.bonusCap+=Number(a.bossDamage.bonusCap)||0;}
    if(a.reflect){out.reflect.pct+=Number(a.reflect.pct)||0;out.reflect.damageCap+=Number(a.reflect.damageCap)||0;}
    if(a.lifesteal){out.lifesteal.pct+=Number(a.lifesteal.pct)||0;out.lifesteal.healCap+=Number(a.lifesteal.healCap)||0;}
  }
  return out;
}
export function recalcEquipment(player){
  if(!player)return;
  player.equipmentAttributes=equipmentAttributeTotalsFor(player,player.equipment);
  player.armor=equipmentArmorFor(player,player.equipment);
  const weapon=itemDef(player,player.equipment?.rightHand);
  player.weaponContribution=weaponContributionForDef(weapon);
  player.equipmentAffixes=equipmentAffixTotalsFor(player,player.equipment);
}
export function gearLevelFor(player,equipmentState=player?.equipment){
  if(!equipmentState)return 0;const two=equipmentItemUsesBothHands(player,equipmentState.rightHand);let total=0;
  for(const slot of EQUIPMENT_SLOT_ORDER){
    if(slot==="leftHand"&&two){total+=Number(itemDef(player,equipmentState.rightHand)?.itemLevel)||0;continue;}
    total+=Number(itemDef(player,equipmentState[slot])?.itemLevel)||0;
  }
  return total/EQUIPMENT_SLOT_ORDER.length;
}
export function gearLevel(player){return gearLevelFor(player,player?.equipment);}

function filterSlots(id){return EQUIPMENT_FILTERS.find(f=>f.id===id)?.slots||null;}
export function filteredEquipmentBag(player,filterId="all"){
  ensureEquipment(player);const allowed=filterSlots(filterId);
  return player.inventory.equipment.filter(id=>{
    if(!itemDef(player,id))return false;
    if(!allowed)return true;
    return compatibleSlots(player,id).some(s=>allowed.includes(s));
  }).sort((a,b)=>{
    const A=itemDef(player,a),B=itemDef(player,b);
    const ra=RARITY_ORDER.indexOf(A?.rarity||"Common"),rb=RARITY_ORDER.indexOf(B?.rarity||"Common");
    return (Number(B?.itemLevel)||0)-(Number(A?.itemLevel)||0) || rb-ra || String(A?.name||"").localeCompare(String(B?.name||""));
  });
}
function simulateEquipDirect(player,id,target){
  const next={...(player?.equipment||{})};
  if(!itemDef(player,id)||!target||!compatibleSlots(player,id).includes(target))return next;
  for(const slot of EQUIPMENT_SLOT_ORDER)if(next[slot]===id)next[slot]=null;
  if(target==="leftHand"&&equipmentItemUsesBothHands(player,next.rightHand))next.rightHand=null;
  next[target]=id;
  if(target==="rightHand"&&equipmentItemUsesBothHands(player,id))next.leftHand=null;
  return next;
}
export function recommendedSlot(player,id,preferred=null,filterId="all"){
  let slots=compatibleSlots(player,id);
  const allowed=filterSlots(filterId);if(allowed)slots=slots.filter(s=>allowed.includes(s));
  if(preferred&&slots.includes(preferred))return preferred;
  if(!slots.length)return null;
  return [...slots].sort((a,b)=>{
    const A=compareEquipment(player,id,a),B=compareEquipment(player,id,b);
    if(Math.abs(B.gearDelta-A.gearDelta)>.0001)return B.gearDelta-A.gearDelta;
    if(B.itemDelta!==A.itemDelta)return B.itemDelta-A.itemDelta;
    return (player.equipment[a]?1:0)-(player.equipment[b]?1:0);
  })[0];
}
export function compareEquipment(player,id,target){
  ensureEquipment(player);
  if(!target)target=compatibleSlots(player,id)[0]||null;
  if(!target)return {target:null,itemDelta:0,gearDelta:0};
  const before=player.equipment,after=simulateEquipDirect(player,id,target);
  const currentId=before[target];
  const strikeBefore=weaponAttackBaseForEquipment(player,before),strikeAfter=weaponAttackBaseForEquipment(player,after);
  const attackBefore=attackBonus(strikeBefore),attackAfter=attackBonus(strikeAfter);
  const drBefore=equipmentArmorFor(player,before),drAfter=equipmentArmorFor(player,after);
  const defBefore=defenceStats(drBefore),defAfter=defenceStats(drAfter);
  const attrsBefore=equipmentAttributeTotalsFor(player,before),attrsAfter=equipmentAttributeTotalsFor(player,after);
  const hpBefore=effectiveStat(player,"CON",before)*6,hpAfter=effectiveStat(player,"CON",after)*6;
  const affBefore=equipmentAffixTotalsFor(player,before),affAfter=equipmentAffixTotalsFor(player,after);
  return {
    target,currentId,
    itemDelta:(Number(itemDef(player,id)?.itemLevel)||0)-(Number(itemDef(player,currentId)?.itemLevel)||0),
    gearDelta:gearLevelFor(player,after)-gearLevelFor(player,before),
    valueDelta:computedItemGoldValue(itemDef(player,id))-computedItemGoldValue(itemDef(player,currentId)),
    strikeBefore,strikeAfter,attackBefore,attackAfter,
    drBefore,drAfter,acBefore:defBefore.ac,acAfter:defAfter.ac,deflectionBefore:defBefore.deflection,deflectionAfter:defAfter.deflection,
    attrsBefore,attrsAfter,hpBefore,hpAfter,affBefore,affAfter
  };
}
function addToBag(player,id){if(id&&itemDef(player,id)&&!player.inventory.equipment.includes(id))player.inventory.equipment.push(id);}
function removeFromBag(player,id){player.inventory.equipment=player.inventory.equipment.filter(x=>x!==id);}
export function equipItem(player,id,targetSlot=null){
  ensureEquipment(player);const def=itemDef(player,id);if(!def)return false;
  const target=recommendedSlot(player,id,targetSlot,"all");if(!target)return false;
  const current=player.equipment[target];
  if(current===id)return true;
  for(const slot of EQUIPMENT_SLOT_ORDER)if(player.equipment[slot]===id)player.equipment[slot]=null;
  if(target==="leftHand"&&equipmentItemUsesBothHands(player,player.equipment.rightHand)){
    addToBag(player,player.equipment.rightHand);player.equipment.rightHand=null;
  }
  if(current)addToBag(player,current);
  if(target==="rightHand"&&equipmentItemUsesBothHands(player,id)){
    if(player.equipment.leftHand)addToBag(player,player.equipment.leftHand);player.equipment.leftHand=null;
  }
  removeFromBag(player,id);player.equipment[target]=id;recalcEquipment(player);
  player.hpMax=maxHp(player);player.hp=Math.max(player.hp<=0?0:1,Math.min(player.hp,player.hpMax));
  return true;
}
export function unequipSlot(player,slot){
  ensureEquipment(player);
  if(!EQUIPMENT_SLOT_ORDER.includes(slot)||equipmentSlotBlocked(player,slot))return false;
  const id=player.equipment[slot];if(!id)return false;
  addToBag(player,id);player.equipment[slot]=null;recalcEquipment(player);
  player.hpMax=maxHp(player);player.hp=Math.max(player.hp<=0?0:1,Math.min(player.hp,player.hpMax));
  return true;
}
export function equipmentDisplayStatLines(item){
  if(!item)return [];
  const fallback=item.kind==="weapon"
    ?[`${item.stat||"Weapon"} scaling`,`Weapon contribution +${weaponContributionForDef(item).toFixed(1)}`]
    :item.armor?[`Armor +${item.armor}`]
    :STAT_KEYS.filter(stat=>item.attributes?.[stat]).map(stat=>`${stat} +${item.attributes[stat]}`);
  const lines=[...(Array.isArray(item.stats)&&item.stats.length?item.stats:fallback)].filter(Boolean);
  if((item.kind==="weapon"||["sword","greatsword","axe","dagger","shortsword","bow","wand","staff","unarmed"].includes(item.family))&&!lines.some(x=>/^Speed\b/i.test(String(x))))lines.push(`Speed ${Math.max(20,Number(PLAYER_WEAPON_SPEED[item.family])||100)}`);
  if(item.family==="shield"&&!lines.some(x=>/Guard|Protection/i.test(String(x))))lines.push(`Guard: ${Math.round(GUARD_REDUCTION_SHIELD*100)}% damage reduction`);
  return lines;
}
export function backpackMiscCategory(name){
  const n=String(name||"").toLowerCase();
  if(/dust|shard|fragment|scrap|reagent|ore|ingot|salvage|essence/.test(n))return "materials";
  if(/spellbook|book|scroll|page|map|journal|tome|ledger|writ|lexicon/.test(n))return "texts";
  if(/key|quest|seal|objective/.test(n))return "quest";
  return "other";
}

// --- v0.114 procedural item generation, adapted from the old global state to an explicit player object ---
function affixEnabled(def){return !!GENERATED_AFFIX_ENABLED[def?.enabledKey||def?.id];}
function generatedAffixSlotKey(entry){return entry.kind==="weapon"?"weapon":entry.id;}
function allowedGeneratedAffixes(entry){const key=generatedAffixSlotKey(entry);return Object.values(EQUIPMENT_AFFIXES).filter(def=>affixEnabled(def)&&def.slots.includes(key));}
function emptyAffixRecord(){return {};}
function generatedAffixMaxUnits(def,entry,weapon=null){if(def?.id==="crit"&&entry?.kind==="weapon"&&weapon?.family==="dagger")return 20;return def?.maxUnits||0;}
function addAffixUnit(affixes,def,maxUnits=def.maxUnits){
  const rec=affixes[def.id]||(affixes[def.id]={units:0,value:0});if(rec.units>=maxUnits)return false;
  rec.units++;rec.value=rec.units*def.unitCost;
  if(def.id==="crit")rec.pct=rec.units*.25;
  else if(def.id==="bossDamage"){rec.pct=rec.units;rec.bonusCap=rec.units*2;}
  else if(def.id==="reflect"){rec.pct=rec.units;rec.damageCap=rec.units;}
  else if(def.id==="lifesteal"){rec.pct=rec.units;rec.healCap=rec.units;}
  else rec.amount=rec.units;
  return true;
}
function generatedAffixLines(affixes){
  const out=[],a=affixes||{};
  if(a.crit?.units)out.push(`Critical Chance +${a.crit.pct}% (parked)`);
  if(a.bossDamage?.units)out.push(`Boss Damage +${a.bossDamage.pct}% · bonus cap ${a.bossDamage.bonusCap}/action`);
  if(a.reflect?.units)out.push(`Damage Reflect ${a.reflect.pct}% · cap ${a.reflect.damageCap}/hit`);
  if(a.lifesteal?.units)out.push(`Lifesteal ${a.lifesteal.pct}% · cap ${a.lifesteal.healCap} HP/action`);
  if(a.skillRating?.units)out.push(`Skill Rating +${a.skillRating.amount}`);
  if(a.armorPen?.units)out.push(`Armor Penetration +${a.armorPen.amount}%`);
  if(a.magicPen?.units)out.push(`Magic Penetration +${a.magicPen.amount}%`);
  if(a.ccReduction?.units)out.push(`Crowd-Control Reduction +${a.ccReduction.amount}%`);
  if(a.lootFind?.units)out.push(`Loot Find +${a.lootFind.amount}%`);
  return out;
}
function rollEquipmentRarity(depth=0){
  const d=Math.max(0,Number(depth)||0),roll=rnd();let cursor=0;
  for(const rarity of RARITY_ORDER){
    if(rarity==="Common")continue;
    const chance=equipmentRarityChanceAtDepth(rarity,d);if(chance<=0)continue;
    cursor+=chance;if(roll<cursor)return rarity;
  }
  return "Common";
}
function generatedFamilyWeight(entry,sourceKey){
  let w=entry.weight||1;
  if(["cutter","mauler"].includes(sourceKey)&&entry.id==="weapon")w*=1.8;
  if(sourceKey==="shieldback"&&["shield","top","gloves"].includes(entry.id))w*=1.8;
  if(sourceKey==="skitter"&&["bottoms","hat","boots","cape"].includes(entry.id))w*=1.45;
  if(["scrounger","oldhand"].includes(sourceKey)&&["focus","belt","light","necklace","earring","ring"].includes(entry.id))w*=1.65;
  return w;
}
function generatedStratumTag(depth=0){return ["Warren","Mine","Barrow","Undertemple","Wyrm"][Math.floor(Math.max(0,depth)/500)]||"Deep";}
function generatedItemName(base,rarity,depth){return [GENERATED_RARITY_PREFIX[rarity]||"",generatedStratumTag(depth),base].filter(Boolean).join(" ");}
function generatedInstanceId(player){
  player.generatedItemSeq=(Number(player.generatedItemSeq)||0)+1;
  return `gen_${Date.now().toString(36)}_${player.generatedItemSeq.toString(36)}_${Math.floor(rnd()*0xffffff).toString(36)}`;
}
function generatedTargetItemLevel(depth,rarity){
  const variance=1-GENERATED_ILVL_VARIANCE+rnd()*(GENERATED_ILVL_VARIANCE*2);
  return Math.max(1,Math.round(expectedItemLevelAtDepth(depth)*rarityDef(rarity).budgetMult*variance));
}
function generatedSlotCoefficient(entry,weapon=null){
  if(entry.kind==="weapon")return Number(weapon?.hands||1)===2?2:SLOT_BUDGET_COEFFICIENTS.rightHand;
  return SLOT_BUDGET_COEFFICIENTS[(entry.slots||[])[0]]||1;
}
function candidateAddCoreUnit(candidate,entry){
  if(entry.kind==="weapon"){candidate.weaponContribution=Number(((candidate.weaponContribution||0)+.1).toFixed(1));candidate.value+=WEAPON_VALUE_COST*.1;return;}
  if(entry.kind==="armor"){candidate.armor=(candidate.armor||0)+1;candidate.value+=ARMOR_VALUE_COST;return;}
  const stat=pick(entry.pool);candidate.attributes[stat]=(candidate.attributes[stat]||0)+1;candidate.value+=ATTRIBUTE_VALUE_COST;
}
function candidateCoreCost(entry){return entry.kind==="weapon"?WEAPON_VALUE_COST*.1:entry.kind==="armor"?ARMOR_VALUE_COST:ATTRIBUTE_VALUE_COST;}
function generatedMaxAffixTypes(rarity){
  const rank=RARITY_ORDER.indexOf(rarity);
  if(rank<=RARITY_ORDER.indexOf("Common"))return 1;
  if(rank<=RARITY_ORDER.indexOf("Rare"))return 2;
  return 3;
}
function buildGeneratedValueCandidate(entry,weapon,targetValue,rarity="Common"){
  const candidate={value:0,attributes:{},affixes:emptyAffixRecord(),armor:0,weaponContribution:0};
  const affixes=allowedGeneratedAffixes(entry),limit=targetValue*(1+GENERATED_VALUE_TOLERANCE),maxTypes=generatedMaxAffixTypes(rarity),coreCost=candidateCoreCost(entry);
  const nativeShare=entry.kind==="attributes"?.42+rnd()*.42:.64+rnd()*.28,nativeTarget=targetValue*nativeShare;
  while(candidate.value+coreCost<=Math.min(nativeTarget,limit))candidateAddCoreUnit(candidate,entry);
  let guard=0;
  while(affixes.length&&guard++<80){
    const usedTypes=Object.keys(candidate.affixes).length;
    const fitting=affixes.filter(def=>candidate.value+def.unitCost<=limit&&(candidate.affixes[def.id]?.units||0)<generatedAffixMaxUnits(def,entry,weapon)&&(candidate.affixes[def.id]||usedTypes<maxTypes));
    if(!fitting.length)break;
    const def=weightedPick(fitting,()=>1);
    if(rnd()<.24&&candidate.value>=targetValue*(1-GENERATED_VALUE_TOLERANCE))break;
    addAffixUnit(candidate.affixes,def,generatedAffixMaxUnits(def,entry,weapon));candidate.value+=def.unitCost;
  }
  while(candidate.value+coreCost<=limit&&Math.abs(targetValue-(candidate.value+coreCost))<Math.abs(targetValue-candidate.value))candidateAddCoreUnit(candidate,entry);
  return candidate;
}
function bestGeneratedValueCandidate(entry,weapon,targetValue,rarity){
  let best=null,bestScore=Infinity;
  for(let i=0;i<72;i++){
    const c=buildGeneratedValueCandidate(entry,weapon,targetValue,rarity);
    const miss=Math.abs(c.value-targetValue),outside=miss>targetValue*GENERATED_VALUE_TOLERANCE?targetValue:0;
    const diversity=allowedGeneratedAffixes(entry).length&&!Object.keys(c.affixes).length?targetValue*.012:0;
    const score=miss+outside+diversity;
    if(score<bestScore){bestScore=score;best=clone(c);}
  }
  return best||buildGeneratedValueCandidate(entry,weapon,targetValue,rarity);
}
export function generateEquipmentDrop(player,depth=0,sourceKey=""){
  ensureEquipment(player);const d=Math.max(0,Number(depth)||0),rarity=rollEquipmentRarity(d);
  const entry=weightedPick(GENERATED_DROP_FAMILIES,e=>generatedFamilyWeight(e,sourceKey));
  const targetIlvl=generatedTargetItemLevel(d,rarity),weapon=entry.kind==="weapon"?weightedPick(GENERATED_WEAPON_FAMILIES):null;
  const coef=generatedSlotCoefficient(entry,weapon),targetValue=intrinsicValueFromLevel(targetIlvl,coef),pkg=bestGeneratedValueCandidate(entry,weapon,targetValue,rarity);
  let item;
  if(entry.kind==="weapon")item={kind:"weapon",base:weapon.base,family:weapon.family,stat:weapon.stat,hands:weapon.hands,greatWeapon:!!weapon.greatWeapon,slot:"rightHand",slots:["rightHand"],weaponContribution:Number(pkg.weaponContribution.toFixed(1)),affixes:pkg.affixes};
  else if(entry.kind==="armor")item={kind:"armor",base:entry.base,family:entry.family||"armor",slot:entry.slot,slots:[...entry.slots],armor:pkg.armor,affixes:pkg.affixes};
  else item={kind:"attributes",base:entry.base,family:entry.family||entry.id,slot:entry.slot,slots:[...entry.slots],attributes:pkg.attributes,affixes:pkg.affixes};
  const id=generatedInstanceId(player),intrinsic=Math.max(0,Number(pkg.value.toFixed(2)));
  Object.assign(item,{id,generated:true,generatedDepth:Number(d.toFixed(1)),rarity,targetItemLevel:targetIlvl,targetIntrinsicValue:Number(targetValue.toFixed(2)),intrinsicValue:intrinsic});
  item.itemLevel=Math.max(1,itemLevelFromIntrinsic(intrinsic,coef));
  item.goldValue=Math.max(0,Math.round(intrinsic*rarityMarketMultiplier(rarity)));
  item.name=generatedItemName(item.base,rarity,d);item.stats=equipmentDisplayStatLines(item);
  item.desc=`Procedural ${item.rarity} ${item.base.toLowerCase()} generated at ${d.toFixed(1)} fathoms. Finished properties contain ${Math.round(item.intrinsicValue)} Intrinsic Value; iLv is derived from that actual package.`;
  stampItemEconomy(item,{recalculateGeneratedIlvl:true});
  player.generatedItems[id]=clone(item);addToBag(player,id);return item;
}

export function importLegacyEquipment(player,state){
  if(!player||!state)return;
  if(state.generatedItems&&typeof state.generatedItems==="object"&&!Array.isArray(state.generatedItems))player.generatedItems=clone(state.generatedItems);
  if(state.equipment&&typeof state.equipment==="object"&&!Array.isArray(state.equipment))player.equipment=clone(state.equipment);
  if(state.inventory&&typeof state.inventory==="object"){
    const inv=clone(state.inventory);
    player.inventory={...player.inventory,...inv};
    player.inventory.equipment=Array.isArray(inv.equipment)?[...inv.equipment]:player.inventory.equipment;
    player.inventory.loot=Array.isArray(inv.loot)?inv.loot:player.inventory.loot;
  }
  player.generatedItemSeq=Math.max(0,Number(state.generatedItemSeq)||0);
  ensureEquipment(player);
}
