# Fathom — Balance & Systems Reference

**Build reference:** v0.205.4 — Combat HUD Layout Pass  
**Purpose:** human/design reference for the systems and live math in the current build. This file is not read by the game.  
**Source rule:** this document was reconciled against the actual v0.205.4 HTML/JS source. Values below describe the active-world game unless explicitly marked legacy, parked, incomplete, or planned.

## 1. Current architecture

Fathom is now an **explorable physical world**, not the older linear auto-descent/event screen.

- Movement, enemies, loot, hollows, passages, settlements and authored world events exist in world coordinates.
- Depth is derived from vertical world position.
- `1 tile = 24 px = 0.5 fathom` vertically.
- One major Stratum/biome remains **500 fathoms**.
- The current primary combat path is **real-time overworld combat**.
- The older modal/turn-based d20/Stamina combat engine still exists in the source for compatibility and old authored content, but it is **not the primary active-world combat model**.
- Active-world enemies can coexist, acquire the player independently and remain physically present while another enemy is targeted.
- Targeting is pointer-driven. The player auto-approaches to the equipped weapon's usable range and attacks on the weapon's rhythm.
- Enemy Heavy attacks visibly wind up in the world before release.

This distinction matters when reading old comments or code: do not reinterpret dormant AC/d20/Stamina helpers as the live overworld rules.

## 2. World / depth pacing

```text
Stratum length = 500 fathoms
Fathoms per world tile = 0.5
```

Current authored depth landmarks:

- Ordinary Safe Hollows begin about **20 fathoms** into each stratum.
- Ordinary Hollow spacing remains approximately **30 fathoms**.
- A special staging Hollow appears **8 fathoms before** each 500-fathom boss boundary.
- A physical mini-boss occurs at each **250-fathom midpoint**.
- A mandatory stratum boss/guardian occurs at each **500-fathom boundary**.
- Side-passage opportunity logic retains an approximately **60-fathom** cadence, but the old instanced side-event engine is parked; current passages are physical geography.

### Current settlement test locations

These are the live v0.205.4 settlement definitions and are expected to be reconsidered during the upcoming Fathom 0 city pass:

| Settlement | Kind | Current depth |
|---|---|---:|
| Grey Lantern | Town | 150 |
| Lantern City | City | 450 |
| Ashwick | Town | 550 |

Settlements are physically carved into the active world with walls, gates, buildings/locations, roads and enemy-exclusion zones.

## 3. Endless depth progression spine

Let:

```text
G = depth^0.6
```

Expected progression at depth:

```text
Expected primary attribute = 13 + 0.60G
Expected CON               = 12 + 0.30G
Expected Max HP            = Expected CON × 6
Expected Strike benchmark  = Expected primary attribute
Expected enemy HP          = Expected Strike × 4.5
Expected enemy hit         = Expected Max HP ÷ 9
Expected medium Armor      = Expected primary attribute × 3
Expected Item Level        = round(100 + (0.90 / 0.195)G)
                           ≈ round(100 + 4.6153846G)
```

Enemy progression is based on **depth expectation**, never by reading the player's live stats or gear.

### Reference points

| Depth | Expected primary | Expected HP | Expected iLv | Expected enemy HP | Base enemy hit | Medium Armor |
|---:|---:|---:|---:|---:|---:|---:|
| 0 | 13 | 72 | 100 | 59 | 8 | 39 |
| 60 | 20 | 93 | 154 | 90 | 10 | 60 |
| 500 | 38 | 147 | 292 | 171 | 16 | 114 |
| 1,000 | 51 | 186 | 391 | 229 | 21 | 153 |
| 5,000 | 112 | 370 | 865 | 506 | 41 | 337 |
| 10,000 | 164 | 524 | 1,259 | 737 | 58 | 491 |
| 60,000 | 455 | 1,397 | 3,497 | 2,046 | 155 | 1,364 |
| 1,000,000 | 2,402 | 7,238 | 18,474 | 10,807 | 804 | 7,205 |

### Enemy profile scaling

An authored enemy profile supplies relative HP, attack, awareness, speed and intent identity.

```text
Enemy Max HP
= Expected Strike × 4.5 × (profile base HP / 34) × random 0.94–1.06

Enemy base ATK
= round(Expected enemy hit × (profile base ATK / 7))
```

XP also follows the sublinear endless progression rather than a linear depth multiplier:

```text
Depth XP factor
= Expected Primary at current depth / Expected Primary at depth 0

Enemy XP
= round(profile base XP × Depth XP factor)
```

The Making a Plan boon currently multiplies kill XP by **1.20**.

## 4. Character levels and attributes

### Level XP

The old XP helper is retained:

```text
OldXP(L) = round(20 + 10 × L^1.5)
```

The current displayed-level requirement bundles two old levels:

```text
XP to next Level at displayed Level L
= OldXP(2L - 1) + OldXP(2L)
```

Reference values:

| Current Level | XP to next |
|---:|---:|
| 1 | 78 |
| 2 | 172 |
| 3 | 299 |
| 4 | 451 |
| 5 | 626 |

Each gained Character Level grants:

```text
+3 freely allocated attribute points
```

There are no allocation restrictions. Several simultaneous levels grant +3 points per level.

Leveling does **not** heal the character.

### Live attributes

```text
STR — martial/physical weapon scaling; Athletics
CON — Max HP
DEX — finesse/ranged weapon scaling; DEX Skills; bounded Crit Chance
INT — wand/staff scaling; INT Skills
WIS — Perception; Precision → Crit Damage
CHA — social / people / economy stat
RSL — Resilience; player Defence Rating / chance to be hit
```

All seven start at **10** before folk/trade/origin/loadout modifiers.

```text
Max HP = effective CON × 6
```

Equipping CON increases the HP ceiling but does not heal current HP. Removing Max-HP effects clamps current HP to the new ceiling, never below 1 while alive.

## 5. Weapon contribution and Attack Rating

The equipped main-hand weapon chooses its scaling attribute.

- martial weapons: usually **STR**;
- finesse/ranged weapons: usually **DEX**;
- wands/staves: **INT**;
- authored exceptional items may deliberately differ.

```text
Weapon Attack Base / Player Attack Rating
= 0.5 × effective scaling attribute + weapon contribution
```

Unarmed weapon contribution = **1**.

For generated weapons, weapon contribution is purchased from Intrinsic Value. A two-handed weapon uses two hand-slot budgets.

## 6. Active-world accuracy

The live overworld does **not** use the old AC breakpoint roll for ordinary attacks.

Player offensive rating:

```text
Player Attack Rating = Weapon Attack Base
```

Enemy avoidance rating:

```text
Enemy Defence Rating
= Expected medium Armor at depth × defenceProfile
```

Enemy offensive rating:

```text
Enemy Attack Rating
= Expected Primary at depth × accuracyProfile
```

Current continuous hit formula:

```text
a = Attack Rating / 13
d = Defence Rating / 39

Hit Chance
= 1 / (1 + (d / (1.5 × a)) ^ 2.2)

Final Hit Chance = clamp(Hit Chance, 2%, 98%)
```

Neutral benchmark:

```text
Attack Rating 13 vs Defence Rating 39
≈ 70.93% hit
≈ 29.07% accuracy failure
```

### Readability rule

```text
0 damage = accuracy failure only
```

If accuracy succeeds, final damage is clamped to at least **1**. Armor and Guard can never turn a connected hit into `0`.

## 7. Player Defence Rating, RSL and Armor

The current defensive model deliberately separates three jobs:

```text
RSL   → chance enemies connect
Armor → physical damage reduction after a hit connects
CON   → Max HP
```

### Player Defence Rating

```text
Player Defence Rating
= 39 × (effective RSL / 10)
```

Examples:

| RSL | Defence Rating |
|---:|---:|
| 10 | 39 |
| 15 | 58.5 |
| 20 | 78 |
| 30 | 117 |

Temporary effects multiply the RSL-derived Defence Rating:

- Set Your Feet: **×1.20**.
- Sheltered: **×1.10** while its encounter charges remain.

Armor does **not** add Defence Rating.

### Physical Armor mitigation

Player Armor is the sum of equipped Armor on legal equipped slots.

For player or enemy physical targets:

```text
r = Actual Armor / Expected Medium Armor at current depth

Physical Damage Reduction
= r / (r + 2.5)
```

Reference:

| Armor relative to expected medium | Physical reduction |
|---:|---:|
| 0× | 0% |
| 0.5× | 16.67% |
| 1× | 28.57% |
| 2× | 44.44% |
| 3× | 54.55% |
| 4× | 61.54% |

Enemy Armor is separate from enemy Defence:

```text
Enemy Armor
= Expected Medium Armor × armorProfile
```

Default unspecified `armorProfile = 1.0`.

The mitigation helper accepts a damage type. **Physical Armor currently reduces physical damage only.** Magic Defence is not implemented.

## 8. Active-world weapon rhythm and reach

Weapon Speed determines automatic Basic attack cadence:

```text
Player attack interval
= 1800 ms × (100 / max(45, weapon Speed))
```

Current weapon speeds:

| Family | Speed |
|---|---:|
| Dagger | 125 |
| Shortsword | 112 |
| Wand | 110 |
| Sword | 100 |
| Axe | 100 |
| Unarmed | 100 |
| Bow | 90 |
| Staff | 90 |
| Greatsword | 80 |

Current surface-to-surface reach:

| Family | Reach |
|---|---:|
| Dagger | 15 |
| Standard melee | 20 |
| Great weapon / greatsword | 25 |
| Staff | 42 |
| Wand | 112 |
| Bow | 150 |
| Enemy ordinary melee | 10 |

Authored Reach can add **+12** to a melee weapon when the special reach hook is used.

Enemies use their own Speed-driven attack interval:

```text
Enemy attack interval
= 2100 ms × (100 / max(55, enemy Speed))
```

## 9. Weapon-driven combat resources

All three resource pools have a current maximum of:

```text
100
```

The primary resource comes from the equipped weapon family rather than a locked class:

```text
Bow        → Focus
Wand/Staff → Mana
Everything else / martial melee → Momentum
```

### Momentum — aggression resource

```text
Starts at 0
Successful martial Basic → +10 Momentum
Accuracy failure / 0     → +5 Momentum
Crit                      → no extra Momentum
```

Momentum decay:

```text
After the last martial attack:
3 second grace
then -2 Momentum per second
minimum 0
```

There is no passive Momentum refill. This deliberately allows the player to **carry some Momentum into a nearby fight** while punishing long disengagement.

### Focus — prepared ranged resource

```text
Starts/full baseline = 100
Regeneration while threatened/in combat = 10 per second
Regeneration while idle/outside combat   = 20 per second
```

After approximately **4 seconds of genuine peace**, Focus is treated as prepared and restored to full.

Focus is not generated by shooting.

### Mana — magic resource

Current passive regeneration:

```text
With Mana weapon equipped = 1.5 Mana/sec
Otherwise                 = 0.5 Mana/sec
```

Mana is still an early test economy and has not received the same identity pass as Momentum/Focus.

## 10. Active-world Basic attacks and powers

### Basic attack

On a successful accuracy check:

```text
Basic Max Hit
= 0.80 × Weapon Attack Base

Successful Basic raw damage
= 75%–100% of Basic Max Hit
```

Equivalent approximate range:

```text
60%–80% of Weapon Attack Base
```

Example:

```text
Weapon Attack Base 20
→ Basic Max Hit 16
→ raw successful Basic 12–16
→ average ≈14 before Crit/Armor
```

### Heavy — Momentum melee power

```text
Cost = 30 Momentum
Raw max basis = Weapon Attack Base × 1.8
Successful raw roll = 50%–100% of that max
Damage type = physical
```

Heavy resolves immediately when pressed; there is no delayed player power queue.

### Snipe — Focus ranged power

```text
Minimum usable Focus = 40
When used, Snipe spends all currently available Focus
Multiplier = 1.5 + (Focus spent / 100)
Successful raw roll = 50%–100% of multiplied max
Damage type = physical
```

Examples before Crit/Armor:

```text
40 Focus  → 1.9× Weapon Attack Base max basis
100 Focus → 2.5× Weapon Attack Base max basis
```

### Arcane Bolt — Mana power

```text
Cost = 30 Mana
Multiplier = 2.0 × Weapon Attack Base
Successful raw roll = 50%–100% of multiplied max
Damage type = magic
```

Because it is magic, current physical Armor does not reduce Arcane Bolt.

### Crit resolution order

For active-world player attacks:

```text
1. Accuracy
2. Failed accuracy → 0
3. Successful raw damage roll
4. Crit, if rolled
5. Physical Armor if physical damage
6. Successful-hit minimum = 1
7. HP loss
```

## 11. Guard, Sand Throw and Read

### Guard

Guard currently spends the equipped weapon's primary resource:

```text
Cost = 35 Momentum / Focus / Mana
Duration = 2.6 seconds
Damage reduction = 60%
```

Guard reduction is applied **after physical Armor mitigation** to the next connected incoming attack during the guard window. Guard currently costs slightly more Momentum than Heavy; this is a playtest value, not a locked long-term identity.

### Sand Throw

```text
Blind chance = 60%
```

Sand Throw ignores enemy Defence/Armor/Dodge/Guard for the Blind check. On success, the enemy's next attack attempt automatically misses and consumes Blind.

The realtime HUD currently exposes Recover + Read on the first row, Heavy/Snipe/Arcane Bolt + Guard on the second, and Sand Throw on the bottom row.

### Read / Bestiary channel

Read is performed against a physical enemy target.

```text
Normal channel time = 1.5 sec
Kept Watch channel  = 0.5 sec
Maximum range       = 8 tiles
One Read per individual creature
No further Reads once the archetype is Mastered
```

The channel can be interrupted by movement/damage/conditions enforced by the realtime bridge.

## 12. Incoming enemy damage

Enemy normal/heavy attacks use the same continuous accuracy model against player RSL-derived Defence Rating.

On hit:

```text
Normal raw damage roll = enemy ATK × random 60%–100%
Heavy raw damage roll  = enemy ATK × 2.2 × random 60%–100%
```

Then:

```text
1. Physical Armor mitigation
2. Guard reduction if active
3. Clamp successful damage to minimum 1
4. HP loss
```

Enemy Heavy is telegraphed in the world before release. The bridge currently uses a roughly **1.2 second Heavy wind-up** for realtime enemies.

Blinded enemies automatically miss their next attack attempt.

When a roaming enemy breaks its leash, it returns toward home and can recover back to full HP in its territory rather than being dragged indefinitely across the map.

## 13. Critical Chance and Precision

Crit is separate from accuracy and rolls **after a successful hit** in active-world combat.

There is no universal free Crit Chance.

### DEX Crit

```text
DEX Crit
= max(0, effective DEX - 10) × 0.075%

DEX-derived cap = 15%
```

Examples:

```text
DEX 10  → 0%
DEX 50  → 3%
DEX 100 → 6.75%
DEX 210 → 15% cap
```

Total Crit Chance:

```text
DEX Crit + equipped Crit affixes
```

Technical clamp remains **100%** for future special/Unique content.

### Precision / Crit Damage

```text
Precision = max(0, effective WIS - 10)
Base Crit Damage = 150%
```

Crit Damage is endless but increasingly expensive:

- first +50 percentage points: **500 Precision**;
- next +50: **1,000**;
- next +50: **2,000**;
- then **4,000, 8,000, 16,000...**.

Each band fills linearly.

## 14. Crit affix rarity ceilings

Crit rolls in:

```text
0.25 percentage-point steps
```

Ordinary eligible slots:

```text
weapon
Gloves
Rings
```

There are four ring slots.

### Hard cap by rarity

| Rarity | Each Ring max | Gloves / normal weapon max |
|---|---:|---:|
| Salvage | 0.25% | 0.75% |
| Poor | 0.50% | 1.50% |
| Common | 1.00% | 3.00% |
| Uncommon | 1.50% | 4.50% |
| Rare | 2.50% | 7.50% |
| Epic | 3.00% | 9.00% |
| Wondrous | 3.50% | 10.50% |
| Legendary | 4.00% | 12.00% |
| Mythical | 4.50% | 13.50% |
| Ancient | 5.00% | 15.00% |
| Sunless | 5.00% | 15.00% |
| Unfathomable | 5.00% | 15.00% |

The actual roll remains continuation/geometric rather than uniform. Higher rarity raises both the possible ceiling and the chance of continuing toward stronger values.

Current continuation chances by rarity:

```text
Salvage 30% · Poor 36% · Common 45% · Uncommon 52%
Rare 60% · Epic 68% · Wondrous 73% · Legendary 78%
Mythical 82% · Ancient 85% · Sunless 88% · Unfathomable 90%
```

### Dagger Crit identity

Main-hand dagger cap:

```text
≈ normal weapon cap × 4/3
rounded to nearest 0.25%
```

At Ancient+:

```text
Main-hand dagger cap = 20%
```

The offhand dagger does **not** contribute a second full weapon Crit allocation. Its special contribution is:

```text
≈ normal weapon cap ÷ 6
rounded to nearest 0.25%
```

At Ancient+:

```text
Offhand dagger special contribution = 2.5%
```

Ordinary ultimate ceilings therefore remain approximately:

```text
Normal build = 65%
Single dagger = 70%
Dual dagger = 72.5%
```

These are ordinary generated-build ceilings, not the technical 100% system clamp.

## 15. Intrinsic Value, Item Level and slot power

The procedural equipment generator uses **Intrinsic Value (IV)**.

```text
Generated target iLv
= Expected iLv × rarity budget multiplier × random 0.94–1.06

Target IV
= target iLv × slot coefficient

Final displayed iLv
= round(actual finished IV / slot coefficient)
```

On a full 1.0 slot:

```text
1 IV ≈ 1 iLv
```

Current property costs:

```text
+1 Armor                 = 8 IV
+1 weapon contribution   = 15 IV
+0.1 weapon contribution = 1.5 IV
+1 attribute             = 40 IV
```

### Slot coefficients

| Slot | Coefficient |
|---|---:|
| Main Hand | 1.00 |
| Off Hand | 1.00 |
| Top | 1.00 |
| Bottoms | 0.80 |
| Hat | 0.60 |
| Gloves | 0.60 |
| Boots | 0.60 |
| Cape | 0.50 |
| Belt | 0.50 |
| Light Source | 0.50 |
| Pendant / Necklace | 0.50 |
| Each Earring | 0.40 |
| Each Ring | 0.40 |

A two-handed weapon consumes both hands and uses a coefficient of **2.0**.

### Gold appraisal

```text
Appraised Gold Value
= round(Intrinsic Value × sqrt(rarity budget multiplier))

100 SC = 1 GC
```

Merchant margins and CHA affect transactions rather than combat power.

## 16. Live generated affixes

Current procedural generation toggles:

- **Critical Chance:** enabled.
- **Boss Damage:** enabled.
- **Damage Reflect:** enabled.
- **Lifesteal:** mechanically supported but disabled from ordinary generation.
- Skill Rating, Armor Penetration, Magic Penetration, Crowd-Control Reduction and Loot Find are registered but disabled from ordinary generation.

Current affix IV units:

| Affix | IV / unit | Effect / unit | Base registry max |
|---|---:|---|---:|
| Crit Chance | 2.5 | +0.25% Crit | rarity/slot capped |
| Boss Damage | 8 | +1% Boss Damage; +2 damage/action cap | 15 |
| Damage Reflect | 6 | +1%; +1 reflected damage/hit cap | 15 |
| Lifesteal | 25 | +1%; +1 HP/action heal cap | 8 |

Saved generated item instances retain their exact rolled properties across reloads/migrations.

## 17. Rarity progression — current three-era system

Mechanical rarity order:

```text
Salvage
Poor
Common
Uncommon
Rare
Epic
Wondrous
Legendary
Mythical
Ancient
Sunless
Unfathomable
```

**Unique is a separate named/authored designation, not another power rung.**

Rarity no longer uses the older independent permanent drop percentages. The active generator uses three depth eras.

### Era I — 0 to 500 fathoms

```text
Salvage / Poor / Common / Uncommon
```

Weights interpolate through the stratum and reach **100% Uncommon at exactly 500**.

### Era II — after 500 to 5,000 fathoms

```text
Rare / Epic / Wondrous / Legendary
```

Weights interpolate through the era and reach **100% Legendary at exactly 5,000**.

### Era III — after 5,000, endless

```text
Mythical / Ancient / Sunless / Unfathomable
```

The endless curve gradually approaches approximately:

```text
Mythical      3%
Ancient      12%
Sunless      30%
Unfathomable 55%
```

with an exponential depth scale of approximately **12,000 fathoms** after the era begins. Lower deep rarities therefore never disappear completely.

Current IV multipliers remain:

| Rarity | IV / target iLv multiplier |
|---|---:|
| Salvage | ×0.75 |
| Poor | ×0.88 |
| Common | ×1.00 |
| Uncommon | ×1.08 |
| Rare | ×1.18 |
| Epic | ×1.32 |
| Wondrous | ×1.47 |
| Legendary | ×1.63 |
| Mythical | ×1.81 |
| Ancient | ×2.00 |
| Sunless | ×2.22 |
| Unfathomable | ×2.47 |

## 18. Procedural equipment rules

- New delvers start with authored **Salvage iLv 75** Top, Bottoms and Boots plus a class-selected hand setup.
- Votary: Longsword + Buckler or two-handed Greatsword.
- Rogue: Dagger + Buckler or two-handed Shortbow.
- Wizard: Wand + Buckler or two-handed Wooden Staff.
- Ordinary generation path remains `depth → rarity → target iLv/IV → slot/family → legal properties/affixes → saved item instance`.
- Protective equipment primarily spends value on Armor.
- Weapons primarily spend value on weapon contribution.
- Utility/jewelry primarily spend value on attributes and eligible affixes.
- Armor families are tendencies, not class restrictions.
- Named/themed/Unique items may violate ordinary slot-native rules deliberately.
- Generic Max HP and generic Max Resource are not ordinary random properties.
- The first 500-fathom stratum boss still has authored class-relevant **Epic iLv 385** weapon rewards in the current source.

## 19. Recovery / expedition sustain

### Field Recover — live testing tool

Ordinary Rest has been **retired from the active world UI**. The old Rest implementation remains dormant for rollback/compatibility.

Current field Recover:

```text
Heal = flat +20 HP
Cooldown = 30 real-time seconds
Usable only outside combat / events / towns
Cannot be used at full HP
```

This is intentionally a stress-testing aid, not a finalized endless healing system.

### Safe Hollow Camp

New delvers start with:

```text
2 Camp Supplies
```

At a Safe Hollow, a full camp with a Camp Supply:

```text
Consumes 1 Camp Supply
Heals 50% Max HP
Momentum → 0
Focus → 100
Mana → 100
Restores all ability uses
Clears current Guard/queued combat state
Stops Bleeding
Opens boon choice
```

Camp does not inherently mean a full 100% HP heal; it adds 50% Max HP up to the cap.

### Dormant Rest

The old Rest path still exists in code and can heal **25% Max HP**, refresh prepared resources and restore one spent ability use, but it is not currently offered as an ordinary active-world button. Do not design around Rest unless it is deliberately brought back.

## 20. Bestiary combat knowledge

Knowledge is still per enemy archetype:

```text
1 Read  = Known: weakness revealed
3 Reads = Studied: take 5% less damage from that archetype
6 Reads = Mastered: weakness payoff +5 percentage points
```

One physical individual can be Read at most once.

Incoming-damage estimate uncertainty remains:

```text
Unknown  ±15%
Known    ±12%
Studied  ±10%
Mastered ±8%
```

Mastery strengthens the archetype's existing weakness instead of adding a second unrelated weakness.

## 21. Endless Skill foundation

Displayed Skill Rank is an Elo-like expertise rating rather than a flat die bonus.

```text
rating gap d = Effective Skill Rating - Challenge Rating
spread s = 30
P(success) = 1 / (1 + 10^(-d / 30))
```

Reference:

| Rating gap | Success chance |
|---:|---:|
| +60 | ~99% |
| +30 | ~91% |
| +15 | ~76% |
| 0 | 50% |
| -15 | ~24% |
| -30 | ~9% |
| -60 | ~1% |

### Attribute aptitude

```text
attribute aptitude
= 8 × log2(effective governing attribute / 10)

Effective Skill Rating
= Skill Rank + aptitude + proficiency + circumstance
```

Every doubling of the governing attribute adds **+8 Rating**.

Current core Skills:

- Perception — WIS
- Investigation — INT
- Stealth — DEX
- Acrobatics — DEX
- Athletics — STR
- Survival — WIS
- Sleight of Hand — DEX
- Translation — INT

### Challenge identity

Challenge Rating belongs to authored/generated content, not automatically to depth. A specific rusty lock does not become stronger simply because it appears deeper; deeper areas should change the mix of challenges.

Compatibility conversion used by older authored checks:

```text
Challenge Rating = (old authored value - 12) × 8
```

### d100 resolution

- ≥99%: automatic success, no die.
- <1%: automatic failure, no die.
- otherwise use d100.

```text
shown success % = round(P × 100)
Need on d100    = 101 - shown success %
roll >= Need    = success
```

### Skill practice

```text
XP to next Rank = 100 + 10 × current Rank
Base practice   = 10 × (1 + Rank / 200)
```

- automatic/trivial outcomes grant 0 practice;
- harder meaningful success grants more;
- easier uncertain success grants less;
- credible failures can teach a smaller amount;
- a displayed success chance of **5% or lower** qualifies for Against the Odds;
- generated opportunities use one-use practice identities to prevent reroll farming.

## 22. Perception, Investigation, Stealth and world discovery

The Skill engine exists, but its **player-facing reconnection to the new physical world is incomplete**.

### Glints — important current distinction

There are currently deterministic physical **glint entities** in the world. Walking near one exposes an `Investigate` interaction, and interacting can run Perception/Investigation logic and reveal a generated cache/item.

However, the intended exploration presentation discussed for the game is **not complete**:

- the delver should occasionally notice a subtle cue such as *"Did I just see a glint?"*;
- that cue should feel like passive Perception surfacing an opportunity rather than an obvious permanent world marker;
- the player should then choose whether to actively investigate;
- this has not yet been made into the reliable speech-bubble / attention-based interaction originally intended.

Treat glints as **technically present but design-incomplete**, not as a finished feature.

### Concealment / Stealth

The underlying concealment/Stealth system remains present. Enemy Awareness is authored identity, and current active-world detection radius is spatial:

```text
base notice radius in tiles
≈ clamp(5.5 + (Awareness - Stealth Rating) / 30, 3.5, 9)
```

While Concealment is active, the radius is reduced to approximately **35%**, with a minimum around 1.5 tiles.

Mandatory stratum bosses cannot be bypassed as ordinary roamers.

## 23. Active-world interactions currently present

The active world already contains a substantial interaction layer that should be reused rather than rebuilt blindly.

Physical/current entities include:

- ordinary roaming enemies;
- loot bags;
- cavern chests/caches;
- glints;
- Safe Hollows;
- side-passage mouths/geography;
- settlement signposts;
- settlement service/building locations;
- caravans;
- wandering merchants;
- rescue/escort quest clues and refuge sites;
- generic quest-target locations;
- 250-fathom mini-bosses;
- 500-fathom stratum bosses.

When no hostile pressure suppresses interactions, nearby world objects expose contextual actions such as:

```text
Open chest
Investigate
Use Safe Hollow
Read sign
Approach caravan
Approach merchant
Inspect tracks
Inspect satchel
Approach refuge
Enter building
Use Lower Gate
```

A major next-phase goal is to make these systems appear to the player in a coherent authored progression instead of merely existing as disconnected mechanics.

## 24. Settlements and quests currently implemented

The current settlement code supports physical town/city geometry and service locations such as:

```text
Market
Tavern
Herbalist
Guild Hall
Lower Gate
```

The current test quest framework already supports:

- quest instances;
- settlement/location givers and recipients;
- delivery items tied to a specific quest instance;
- quota/proportional rewards;
- exploration/combat acquisition sources;
- rescue/escort state;
- physical route clues/sites;
- delivery turn-ins at actual settlement locations;
- caravan-originated delivery work.

Current authored examples include:

- **Cave Mushroom Samples** — Grey Lantern → Mara Venn in Lantern City; up to 5 samples at 10 coin per usable unit, max 50.
- **Missing Physician** — rescue/escort Zeshava Brightsong from the Grey Lantern–Lantern City road; 80 coin reward.
- **Deepglass Forwarding Order** — Lantern City → Toren Kest in Ashwick; up to 4 fragments at 14 coin per unit, max 56.
- **Sealed Caravan Dispatch** — damaged caravan → Lantern City Guild Hall; 24 coin.

These systems are valuable existing infrastructure. The upcoming Fathom 0 city work should decide **how the player meets them naturally**, not discard them without inspection.

## 25. Side passages, mini-bosses and bosses

### Side passages

Ordinary side passages are now **physical geography** in the cavern network.

The old instanced side-mode event engine is parked:

```text
SIDE_PASSAGE_EVENTS_ENABLED = false
```

Walking into a passage records discovery without teleporting the player, entering a separate side mode, creating a return button, or rewriting coordinates.

The old riddle/trap/altar/event content remains in the source for possible future reuse inside the physical passages.

### 250-fathom mini-boss

- Appears in ordinary cavern terrain rather than a bespoke boss room.
- Uses an oversized version/variant of an ordinary goblin archetype.
- Has a larger aggro/territory presentation than normal roamers.
- Does not create a 250-fathom hard arena gate.

### 500-fathom boss

- Owns the stratum boundary encounter/gate.
- Physically blocks progression until defeated.
- Current first-stratum boss reward definitions include class-relevant Epic iLv 385 weapons.

## 26. Ordinary enemy ecology / spawn density

Ordinary enemies are generated by deterministic **24×24-tile ecology sectors**, not a per-floor-tile lottery.

The sector model deliberately creates:

```text
quiet sectors
lone-roamer sectors
nest sectors with 2–4 bodies
```

Current v0.205.1+ density constants were changed to be **25% higher in expected bodies per sector** than the previous ecology version:

```text
Quiet share = 56.25%
Lone share  = 33.75%
Nest share  = 10%

Old expected bodies/sector = 0.51
Current expected bodies/sector = 0.6375
```

There is also a local active ordinary-hostile cap of:

```text
6
```

### Important playtest status

Although the code contains the mathematical +25% density increase, live testing still produced **large open areas that felt nearly empty**. Therefore the player-facing density target is **not considered solved**.

Do not simply claim “enemy spawns were increased” in future work. Re-evaluate the ecology model itself — especially sector size, quiet share, placement success and local visibility — until the world visually feels populated enough without becoming a wall of enemies.

Bosses, mini-bosses, settlement safe zones and authored encounters should remain separate from ordinary roaming-density tuning.

## 27. UI / quality-of-life systems currently live

These are not combat balance rules, but they materially affect how the current game is played:

- Character/Equipment, Backpack and Delve Log use persistent floating-window behavior.
- Window positions can be remembered and reset from Settings.
- Non-modal windows are intended to allow continued world movement while browsing.
- Minimap physical size has Settings options: **Small / Medium / Large / Extra Large**.
- Minimap has separate persistent `+ / −` zoom controls.
- Enemy combat HP/info is positioned at the top-center of the screen.
- Player HUD sits at the lower area with the combat-action cluster adjacent to character status.
- Current combat action layout is conceptually:

```text
[ Recover ][ Read ]
[ Power   ][ Guard ]
[   Sand Throw    ]
```

Recover is disabled/unavailable during combat; its top-left combat seat remains visually part of the action layout.

Phone/PWA presentation is still allowed to lag behind desktop while core systems are stabilized.

## 28. Save / migration state

Current save schema:

```text
25
```

Important migration guarantees already implemented:

- missing RSL initializes to **10**;
- existing attributes are preserved;
- existing displayed level is not downgraded;
- existing unspent attribute points are preserved;
- existing Armor values are preserved;
- existing saved Crit affixes retain exact values;
- old Energy is **not** converted into free Momentum;
- Momentum initializes at 0 when introduced;
- Focus initializes prepared/full;
- existing Mana is preserved/clamped into the current 0–100 pool.

Settings use a separate schema and persist minimap/window preferences independently of the run save.

## 29. Comparison / authoring rules

Do not label equipment simply **BETTER** or **UPGRADE** when build preference is unknowable.

Prefer objective consequences such as:

- Attack Rating change;
- Defence Rating / RSL change;
- Armor and Physical Damage Reduction change;
- Crit Chance change;
- Precision / Crit Damage change;
- live affix changes;
- iLv / Gear Level change;
- weapon family, range, Speed or primary-resource identity when relevant.

Do not present legacy AC/Deflection as the active-world defensive model.

## 30. Parked, incomplete and next-phase-sensitive systems

### Parked / legacy

- Legacy modal d20/AC combat helpers remain in source; ordinary active-world combat uses the continuous accuracy curve.
- Legacy 3-Stamina turn economy remains in source for old/modal encounters; it is not the main overworld rhythm.
- Speed-timeline UI/logic remains partially available but the active world instead uses real-time attack intervals.
- Protection capacity remains parked for future persistent shield/ward mechanics.
- Ordinary Rest is retired from the active world UI, with old code retained.
- Old instanced side-passage event mode is disabled; physical passages are live.
- Broader affix catalogue is registered but mostly disabled.
- True dual-wield attack behavior remains incomplete.
- Magic Defence is not implemented.

### Implemented but not yet satisfactory / fully surfaced

- Ordinary enemy ecology contains a +25% expected-density change, but playtesting still feels too sparse.
- Glint entities and checks exist, but the intended passive Perception/speech-bubble discovery experience is incomplete.
- Several caravan, merchant, quest, rescue, Skill and settlement systems exist but are not yet introduced/reconnected through a coherent beginning-of-game flow.
- Phone/PWA behavior and layout still need later cleanup; desktop/core functionality is currently the priority.

### Next development direction

The next major phase should begin at **Fathom 0** and build/rework the opening city as the player's real starting point.

The goal is not to invent a new stack of systems. The city and the first stretch below it should become the chronological spine used to **reconnect existing systems** — quests, NPCs, services, merchants, Perception/Investigation, road events, rescue/escort content, loot and exploration — in the order a new player actually encounters them.
