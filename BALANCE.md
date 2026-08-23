# Fathom — Balance & Systems Reference

**Build reference:** v0.114.1.3 canonical systems + Active World direction through v0.203.3  
**Purpose:** human/design reference for canonical math/system rules while Lowfathom moves to the free-moving Active World. This file is not read by the game.  
**Rule:** v0.114.1.3 remains the source of truth for mature combat, equipment, Skills, quests, economy and progression unless explicitly superseded below. v0.203.3 is the current working Active World build, but its instanced town/side-passage experiments and bridge-specific behavior are **not** automatically design canon. Constants are tuning targets and may change after playtesting.

## 1. World / depth pacing

### Canonical depth structure

- One major **Stratum / biome = 500 fathoms**.
- Enemy progression uses expected values for the current depth — **never the player's live stats**.
- Authored settlement depths currently remain **Grey Lantern 150**, **Lantern City 450**, **Ashwick 550**. Departure continues deeper and is intended to remain one-way where the settlement rules say so.
- Ordinary Safe Hollows begin about 20 fathoms into a stratum and target an approximately **30-fathom depth rhythm**.
- A special staging Hollow appears **8 fathoms before** each 500-fathom boss boundary.
- Side-passage opportunities retain an approximately **60-fathom opportunity rhythm** as a pacing target. In Active World this means generating a real branch in the cavern, **not** opening a passage popup when a timer/depth threshold fires.
- Run-pressure reset pacing may continue to use its own 60-fathom rhythm, but its Active World presentation must be spatial rather than an unexplained interruption where possible.

### Recovery rules carried from v0.114

- Rest heals **25% Max HP**.
- The legacy recharge rule is **20 active travel units after each Rest**. Active World must preserve approximately the same recovery pressure, but the exact mapping from legacy travel units to continuous world movement/distance is **not yet locked**. Do not silently equate one world tile/pixel with one legacy travel unit.
- Camp Supply healing = **50% Max HP**. New delvers start with **2 Camp Supplies**.
- Hollow **Sheltered** respite = **+10% Defence Rating for 3 completed encounters**.

### Active World direction — supersedes the passive travel presentation

- Gameplay is now intended to be **free-moving, landscape, top-down Canvas exploration**.
- **Up on the screen = deeper.** Upward world progress increases Fathoms; lateral movement is exploration at roughly the same depth.
- The current large camera/zoom is intentional: the player should feel small inside an enormous, mysterious cavern. Desktop may render farther than phone without forcing distant AI to simulate at full cost.
- Depth remains the canonical progression coordinate because combat scaling, item generation, strata, settlements, quests and bosses already depend on it. The HUD should read depth directly from world position without forcing a full legacy DOM render every small movement increment.
- World generation should be chunk/sector based, connected and effectively endless. It must allow meaningful lateral wandering and avoid sealed enemy/object pockets.
- Chests, Safe Hollows, caravans, merchants, quest objects, bosses, side passages and settlements should have **physical world presence** before their interaction UI appears.
- **Towns/cities and side passages must remain part of the same continuous world. They are not intended to be instanced maps.** v0.203.x experiments that teleport into separate town/passage spaces are implementation debt, not the target design.

## 2. Depth progression spine

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
Expected medium Armor/DR   = Expected primary attribute × 3
Expected Item Level        = round(100 + (0.90 / 0.195)G)
                           ≈ round(100 + 4.6153846G)
```

Enemy archetypes modify HP/damage through authored profiles; Attack/Defence accuracy profiles currently default to 1.0 unless explicitly authored.

### Reference points

| Depth | Expected primary | Expected HP | Expected iLv | Expected enemy HP | Base enemy hit | Medium Armor/DR |
|---:|---:|---:|---:|---:|---:|---:|
| 0 | 13 | 72 | 100 | 59 | 8 | 39 |
| 60 | 20 | 93 | 154 | 90 | 10 | 60 |
| 500 | 38 | 147 | 292 | 171 | 16 | 114 |
| 1,000 | 51 | 186 | 391 | 229 | 21 | 153 |
| 5,000 | 112 | 370 | 865 | 506 | 41 | 337 |
| 10,000 | 164 | 524 | 1,259 | 737 | 58 | 491 |
| 60,000 | 455 | 1,397 | 3,497 | 2,046 | 155 | 1,364 |
| 1,000,000 | 2,402 | 7,238 | 18,474 | 10,807 | 804 | 7,205 |

### Character level

```text
XP to next character level = round(20 + 10 × level^1.5)
```

- Each level grants **1 attribute point**.
- Leveling does **not** heal the character.
- Max HP = **effective CON × 6**.
- Equipping CON raises the Max-HP ceiling but does not heal current HP; removing Max-HP effects clamps current HP to the new ceiling, never below 1 while alive.

## 3. Item Level, Intrinsic Value and slot power

The old normalized-budget system is superseded by **Intrinsic Value (IV)**.

- Generated gear first targets an iLv from depth/rarity, buys real properties, then derives final displayed iLv from the properties actually present.
- On a full 1.0 slot, **1 IV ≈ 1 iLv**.
- Rarity changes the generation target; there is no hidden post-generation rarity power multiplier.

```text
Generated target iLv = Expected iLv × rarity budget multiplier × random 0.94–1.06
Target IV            = target iLv × slot coefficient
Final iLv             = round(actual finished IV / slot coefficient)
```

Current property costs:

```text
+1 Armor                = 8 IV
+1 weapon contribution  = 15 IV
+0.1 weapon contribution = 1.5 IV
+1 attribute            = 40 IV
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

A two-handed weapon consumes both hand positions and uses a coefficient of **2.0**.

### Gold appraisal

```text
Appraised Gold Value = round(Intrinsic Value × sqrt(rarity budget multiplier))
100 SC = 1 GC
```

Merchant margins and CHA affect transaction prices, not combat power.

## 4. Weapon contribution and Attack Rating

All classes use the same basic weapon formula. The weapon chooses its scaling attribute:

- martial weapons → **STR**;
- finesse/ranged weapons → **DEX**;
- wands/staves → **INT**;
- special authored items may deliberately break this rule later.

```text
Weapon Attack Base / Player Attack Rating
= 0.5 × effective scaling attribute + weapon contribution
```

Unarmed weapon contribution = **1**.

This raw Attack Rating is used both for damage scaling and the logarithmic d20 Attack Bonus described below.

## 5. Defence Rating, AC and Deflection

**Armor no longer uses the old passive `r / (r + 2.5)` mitigation curve.** That formula is superseded for live combat.

Current defensive equipment flow:

```text
Total equipped Armor = raw Defence Rating (DR)
```

Current temporary DR multipliers:

- **Set Your Feet:** ×1.20 DR.
- **Sheltered:** ×1.10 DR.
- Multipliers stack multiplicatively if both are active.

DR is converted into **Armor Class (AC)** on an endless logarithmic ladder. DR remains the underlying progression stat; AC is the actual d20 target.

### Exact d20 rating constants

```text
Attack baseline rating  = 13
Defence baseline rating = 39
Base Attack Bonus       = +4
Base AC                 = 13
Points per doubling     = +2
Minimum rating used by log conversion = 25% of the relevant baseline
Deflection band maximum = 8%
```

For either rating:

```text
log step = 2 × log2(max(0.25 × baseline, rating) / baseline)
```

Attack:

```text
Attack Bonus = floor(4 + log step using baseline 13)
```

Defence:

```text
continuous AC = 13 + log step using baseline 39
AC            = floor(continuous AC)
AC progress   = fractional part of continuous AC
Deflection    = AC progress × 8%
```

Deflection therefore gives partial DR upgrades value before the next +1 AC breakpoint. When the breakpoint is crossed, the fractional Deflection resets and the gained +1 AC replaces it.

### Relative ladder example

| Rating vs baseline | Attack Bonus | AC |
|---:|---:|---:|
| 0.25× | +0 | 9 |
| 0.50× | +2 | 11 |
| 1.00× | +4 | 13 |
| 2.00× | +6 | 15 |
| 4.00× | +8 | 17 |
| 8.00× | +10 | 19 |

At matched baseline progression, `+4 vs AC 13` needs **9+ on d20 = 60% hit chance**. Because Attack and Defence climb by the same +2 per doubling, this matchup remains stable at extreme depth when both sides progress normally.

## 6. Player and enemy Attack / AC sources

### Player

```text
Player Attack Rating = weaponAttackBase
Player Attack Bonus  = logarithmic conversion of that rating
Player Defence Rating = total equipped Armor × active DR effects
Player AC / Deflection = logarithmic conversion of that DR
```

Player action accuracy currently has **no additional Heavy penalty**; standard player weapon attacks use the normal Attack Bonus unless an ability explicitly says otherwise.

### Enemy

```text
Enemy Attack Rating = Expected primary at depth × accuracyProfile
Enemy Defence Rating = Expected medium Armor/DR at depth × defenceProfile
```

- Current ordinary archetypes default to `accuracyProfile = 1.0` and `defenceProfile = 1.0` when no profile is authored.
- Enemy HP uses `Expected Strike × 4.5 × (base HP / 34) × random 0.94–1.06`.
- Enemy base damage stat uses `Expected enemy hit × (base ATK / 7)`, rounded.
- Enemies scale from **depth expectation**, never by reading the player's actual level, AC, gear or attributes.

## 7. d20 hit resolution

Player and enemy attacks use the same rule:

```text
d20 + Attack Bonus >= target AC  → hit
```

- Natural **1 always misses**.
- Natural **20 always hits**.
- Therefore the current absolute hit-chance bounds are **5%–95%**.
- Natural **20 automatically hits and is a Critical Hit for ×2 damage** for both player and enemy.
- Natural 1 is never a crit because it always misses.
- The current baseline critical range is natural 20 only. A future expanded range such as 19–20 remains accuracy-neutral: 19 only crits if `19 + Attack Bonus` already meets AC; natural 20 remains the automatic hit.

Enemy attack accuracy modifiers:

```text
Quick Attack     +2
Normal / offquick +0
Heavy Attack     -2
```

Enemy Dodge = **+4 AC** against the next relevant player attack attempt.

Physical combat dice are presentation of the authoritative roll, not a second roll:

- Off = hidden/instant d20.
- Player Only = physical player d20.
- All Rolls = physical player + enemy d20.
- Player d20 is obsidian/black; enemy d20 is red/crimson.

## 8. Combat turn economy

Speed scheduling is currently **parked** while the new combat core is tested.

```text
PLAYER → ENEMY → PLAYER → ENEMY
```

Every Player Turn refreshes to:

```text
3 / 3 Stamina
```

Current core costs:

| Action | Cost | Current rule |
|---|---:|---|
| Strike | 1 | Repeatable chain attack |
| Guard / Parry / Ward / Brace | 2 | Prepare damage reduction |
| Heavy / Backstab / Arcane Bolt | 3 | Immediate committed burst |
| Counter | 3 | +4 AC stance; retaliate on miss |
| Sand Throw | 2 | 60% Blind |
| Read / Study | 1 | Once per encounter; Kept Watch can make first use 0 |
| End Turn | 0 | Lose remaining Stamina and pass turn |

At 0 Stamina the turn ends automatically.

Prepared Guard/Counter cannot stack. A prepared stance persists through non-attack enemy actions and an enemy Heavy wind-up, then is consumed by the **next enemy attack attempt whether that attack hits or misses**.

## 9. Player attack damage

### Strike chain

```text
Strike 1 / Strike        = 1.0× weapon Attack Base + random 0–4
Strike 2 / Double Strike = 1.6× weapon Attack Base + random 0–5
Strike 3 / Perfect Strike= 2.6× weapon Attack Base + random 0–6
```

- A successful Strike advances the chain.
- A miss resets it to Strike 1.
- The third successful stage completes and resets the chain.
- Whetstone boon: first Strike of each fight deals **+15% damage**.

### Heavy / Backstab / Arcane Bolt

```text
Base committed attack = 3.2× weapon Attack Base + random 0–6
Cost = full 3-Stamina turn
Player accuracy modifier = 0
```

- Rogue **Backstab currently uses the same Heavy damage/accuracy rule and the same natural-20 ×2 Critical Hit rule as other attacks**. Its previous guaranteed crit and +25 percentage-point Crit Damage bonus are parked while Backstab's replacement identity is undecided.
- Heavy punches through most enemy Guard: ordinary enemy Guard reduces Heavy by only **15%** rather than 50%.

### Opening / Off-Balance

A normally Off-Balance enemy takes **+25% damage** from the opening. The Mauler's known weakness raises its Off-Balance payoff to **+50%**.

Guarding/parrying or Countering a released enemy Heavy can leave the foe **Off-Balance**.

## 10. Enemy intents and incoming damage

Current intent damage multipliers:

```text
Quick Attack    = 0.6× enemy base ATK
Heavy Attack    = 2.0× enemy base ATK
Glancing/offquick = 0.3× enemy base ATK
Enemy Guard     = 50% normal damage reduction
Recover         = heal 14% Max HP
```

Enemy Heavy remains literal and readable:

```text
Heavy 1/2 = wind-up turn, no attack roll or damage
Heavy 2/2 = release on the next enemy turn
```

Incoming damage before active Guard/Parry:

```text
mean = enemy ATK × intent multiplier
     × Bestiary learned-damage multiplier
     × curse modifier if applicable
     × (1 - player Deflection)

actual damage roll = mean ±8%
```

- **Frailty** curse currently multiplies incoming mean by **1.05**.
- Bestiary Studied status multiplies incoming damage by **0.95**.
- Active Guard/Parry reduction is applied after this passive Deflection/damage roll.

## 11. Active defence

### Shield Guard

```text
Cost = 2 Stamina
Damage reduction = 50%
```

Does not raise AC. Applies to the next enemy attack attempt and cannot stack.

### Non-shield defence

- Votary / Rogue: **Parry**.
- Wizard with wand: **Ward**.
- Wizard without wand/shield: **Brace**.

```text
Cost = 2 Stamina
Damage reduction = 30%
```

### Counter

```text
Cost = 3 Stamina
Temporary AC = +4 against next enemy attack attempt
Damage reduction = 0%
```

- If that enemy attack misses, Counter opens a retaliation.
- Once Counter has caused/claimed the miss, its retaliation **automatically hits**; there is no second d20 roll.
- The guaranteed retaliation is approximately `2 × Strike-1 damage`, then applies the foe's known Counter weakness if one exists.
- If the enemy attack hits, the player takes normal damage and receives no retaliation.

### Sand Throw

```text
Cost = 2 Stamina
Blind chance = 60%
```

Blind ignores AC/Guard/Dodge. If successful, the foe's next attack attempt automatically misses; Blind is then consumed.

## 12. Protection — parked, not deleted

Protection is no longer generated by ordinary Guard/Parry combat and normally remains `0/0`.

The underlying capacity helper is retained for future persistent shield/ward abilities:

```text
Protection capacity
= 5
+ max(0, effective CON - 10)
+ round(shield Armor × 0.5)
```

- Full effective CON still controls Max HP.
- Only CON above 10 contributes to this parked Protection formula.
- Two-handed weapon use suppresses the shield contribution.
- Future Protection is intended to be a persistent/stackable special resource rather than the default defensive layer.

## 13. Natural-d20 Critical Hits and parked legacy Crit progression

### Live v0.114.0+ Crit rule

The authoritative attack d20 now owns Crit resolution. There is **no second hidden Crit roll**.

```text
Natural 1  = automatic miss
Natural 20 = automatic hit + Critical Hit
Critical damage = ×2 final base attack damage before separate additive effects such as Boss Damage
Baseline critical range = 20 only
```

- This rule applies to **both player and enemy attacks**.
- On enemy attacks, the normal incoming roll already includes passive Deflection; a natural-20 Crit doubles that rolled damage, then active Guard/Parry reduction is applied afterward.
- A future expanded Crit range remains accuracy-neutral: a 19 may crit only if the attack already hits AC. Natural 20 retains its automatic-hit rule.
- Rogue Backstab no longer guarantees a Crit during this playtest; it uses the same natural-20 baseline while its future identity is undecided.

### Parked legacy DEX / gear Critical Chance

The following formulas remain in the code/reference for rollback or later redesign but **do not modify live Critical Hits**:

```text
DEX crit = max(0, effective DEX - 10) × 0.25%
DEX-derived cap = 50%
Legacy total Crit Chance = DEX crit + gear Crit, capped at 100%
```

Existing Crit Chance affixes may still be stamped on saved items and remain visible for compatibility. They are mechanically parked. New procedural Crit Chance generation is disabled.

### Parked legacy WIS Precision / variable Crit Damage

These formulas are likewise retained only for rollback/design work:

```text
Precision = max(0, effective WIS - 10)
Legacy base Crit Damage = 150%
```

Legacy Precision used progressively more expensive +50 percentage-point Crit Damage bands (500, 1,000, 2,000, 4,000... Precision). **None of that modifies the current fixed natural-d20 ×2 Crit.**

DEX and WIS continue to matter through their other attribute/Skill roles; only their former Crit Chance/Precision combat jobs are parked.

## 14. Live equipment affixes

Current procedural generation toggles:

- **Critical Chance:** **generation disabled / mechanically parked**. Existing stamped Crit affixes remain stored for compatibility and possible rollback.
- **Boss Damage:** enabled.
- **Damage Reflect:** enabled.
- **Lifesteal:** mechanically supported but disabled from ordinary random generation.
- Skill Rating, Armor Penetration, Magic Penetration, CC Reduction and Loot Find have registry values but are currently disabled from ordinary generation.

Current affix IV units:

| Affix | IV / unit | Effect / unit | Ordinary max units |
|---|---:|---|---:|
| Crit Chance | 2.5 | legacy +0.25% Crit | 10; dagger weapon 20 |
| Boss Damage | 8 | +1% Boss Damage; +2 damage/action cap | 15 |
| Damage Reflect | 6 | +1%; +1 damage/hit cap | 15 |
| Lifesteal | 25 | +1%; +1 HP/action heal cap | 8 |

Generated items normally use at most 1 affix type at Common or below, 2 through Rare, and 3 at Epic+. **Crit Chance is excluded from new generation during the natural-d20 Crit playtest, so currently live generated affixes are Boss Damage and Damage Reflect; Lifesteal remains supported but disabled.**

## 15. Rarity ladder

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

**Unique is not a power tier.** It is a separate designation for named/hand-authored/special items and can coexist with a normal rarity.

| Rarity | First depth | Target chance once unlocked | Target iLv / IV multiplier |
|---|---:|---:|---:|
| Salvage | 0 | 8% | ×0.75 |
| Poor | 0 | 18% | ×0.88 |
| Common | 0 | remainder | ×1.00 |
| Uncommon | 0 | 20% | ×1.08 |
| Rare | 0 | 10% | ×1.18 |
| Epic | 250 | 5% | ×1.32 |
| Wondrous | 500 | 4% | ×1.47 |
| Legendary | 500 | 1% | ×1.63 |
| Mythical | 2,000 | 2.5% | ×1.81 |
| Ancient | 3,000 | 2% | ×2.00 |
| Sunless | 4,000 | 1.75% | ×2.22 |
| Unfathomable | 5,000 | special | ×2.47 |

Unfathomable:

```text
before 5,000 = 0%
5,000         = 0.5%
+0.1 percentage point per additional 1,000 fathoms
maximum       = 1.5%

chance = min(1.5%, 0.5% + floor((depth - 5000) / 1000) × 0.1%)
```

There are no numbered Unfathomable subtiers; iLv is already the endless progression axis.

### Equipped-player selection bias

The depth benchmark describes generated-drop expectation, not the exact Gear Level a player will carry. Players keep the best items seen per slot, so equipped gear naturally trends above average drops.

Do **not** pre-correct this. If observed runs show persistent over-performance, use a single calibration factor on the expected-equipment / expected-medium-DR benchmark and tune from real data; start from `k = 1.0`.

## 16. Procedural equipment rules that remain live

- New delvers start with authored **Salvage iLv 75** Top, Bottoms and Boots plus a class-selected hand setup.
- Votary: Longsword + Buckler or two-handed Greatsword.
- Rogue: Dagger + Buckler or two-handed Shortbow.
- Wizard: Wand + Buckler or two-handed Wooden Staff.
- Ordinary equipment generation path: `depth → rarity → target iLv/IV → slot/family → best-fit legal properties/affixes → persistent generated instance`.
- Protective equipment primarily spends native value on Armor/DR.
- Weapons primarily spend native value on weapon contribution.
- Current utility/jewelry families primarily spend native value on attributes/eligible affixes.
- Generated items receive unique saved instance IDs; reload preserves the exact item.
- Authored starters, boss rewards, Uniques and special encounter items remain static.
- First 500-fathom stratum boss still grants one class-relevant **Epic iLv 385** weapon.
- Armor families are tendencies, not class restrictions; any class may wear any armor type.
- Slot-native property pools remain the default. Named/themed/Unique items may intentionally violate ordinary slot rules.
- Generic Max Stamina and generic Max HP are not ordinary random properties.

## 17. Bestiary combat knowledge

Read/Study is capped per archetype and advances at most once per encounter.

```text
1 read  = Known: permanent weakness revealed
3 reads = Studied: take 5% less damage from that archetype
6 reads = Mastered: existing weakness payoff +5 percentage points
```

Incoming-damage estimate uncertainty narrows with knowledge:

```text
Unknown  ±15%
Known    ±12%
Studied  ±10%
Mastered ±8%  (matches actual damage variance)
```

Mastery strengthens the archetype's existing numeric weakness rather than adding a second weakness; e.g. ×1.50 becomes ×1.55, ×1.40 becomes ×1.45.

## 18. Endless Skill foundation

Displayed Skill Rank is an Elo-like logarithmic expertise rating, not a flat die bonus.

```text
rating gap d = Effective Skill Rating - Challenge Rating
spread s = 30
P(success) = 1 / (1 + 10^(-d / 30))
```

Reference probabilities:

| Gap | Success |
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
attribute aptitude = 8 × log2(effective governing attribute / 10)
Effective Skill Rating = Skill Rank + aptitude + proficiency + circumstance
```

Every doubling of the governing attribute adds **+8 Rating**. Attributes below 10 can give negative aptitude.

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

Challenge Rating belongs to the content, not automatically to depth. A particular rusty lock does not become stronger because it appears deeper; depth changes the mix of content encountered.

Compatibility conversion used by older authored checks:

```text
Challenge Rating = (old authored value - 12) × 8
```

### d100 resolution

- At **≥99%**: automatic success, no roll.
- At **<1%**: automatic failure, no roll.
- Otherwise use d100.

```text
shown success % = round(P × 100)
Need on d100    = 101 - shown success %
roll >= Need    = success
```

The percentile die adds resolution, not extra statistical swing; the rating gap determines the chance.

### Skill practice / Rank XP

```text
XP to next Rank = 100 + 10 × current Rank
Base practice   = 10 × (1 + Rank / 200)
```

- Automatic/trivial outcomes grant 0 practice.
- Balanced meaningful success is the anchor around Base Practice.
- Easier uncertain success gives less; harder success gives more.
- A success displayed at **5% or lower** is **Against the Odds** and receives a large bonus.
- Credible failures can teach a smaller amount; extreme failures near the probability floor teach 0.
- A generated opportunity has a one-use practice identity, preventing reroll farming.

## 19. Perception, Investigation and Concealment

- Perception is primarily passive: it decides whether the delver notices glints, side-passage signs and similar opportunities before an active decision appears.
- Investigation is primarily active and can improve the quality/productivity of successful examination.
- Concealment I has **2 uses** and lasts **10 minutes of active travel** per use in the canonical v0.114 system; the timer freezes while travel is held or combat is active. In Active World, preserve the intent as active exploration time rather than letting menu/combat time consume the effect; the exact migration hook should be explicit, not inferred from old travel ticks.
- Enemy Awareness is authored content identity, not a universal depth multiplier.
- Concealment compares effective Stealth Rating against creature Awareness.
- Success can allow **Ambush** or **Let them pass**; passing grants no combat XP/loot and preserves concealment, while ambushing or being detected breaks it.
- Mandatory stratum bosses cannot be bypassed by Concealment.
- Studied Bestiary entries reveal creature Awareness.

Long-term Skill progression is intended to combine endless Rank, automatic mastery of old problems, sparse qualitative milestones, and genuinely different deep content rather than only larger numbers.

## 20. Comparison / authoring rules

Do not label equipment simply **BETTER** or **UPGRADE** when build preference is unknowable.

Prefer objective consequences such as:

- Armor / Defence Rating change;
- Attack Rating / Attack Bonus change;
- AC change;
- Deflection change;
- live natural-d20 Crit rules; parked Crit Chance/Crit Damage affixes may be shown for compatibility but must not be presented as current combat upgrades;
- live affix changes;
- iLv / Gear Level change shown neutrally.

## 21. Parked / intentionally unfinished systems

- **Speed timeline:** engine/UI remains, but ordinary combat is intentionally fixed alternation during the AC + Stamina playtest.
- **Protection:** engine/formula retained for future persistent shield/ward abilities; not ordinary defence.
- Real dual-wield attack behavior remains unfinished.
- Broader procedural affix catalogue is registered but mostly disabled until each property has a proven use and balance price.
- Class armor restrictions are not part of the current design.
- **Legacy DEX/gear Crit Chance and WIS Precision/Crit Damage:** parked during the natural-d20 ×2 Crit playtest.
- **Rogue Backstab guaranteed Crit/+25pp Crit Damage:** parked; replacement identity unresolved.
- **Active World migration:** exact conversion of legacy travel-unit timers/recharges to continuous movement remains unfinished.
- **Instanced Active World towns/side passages:** explicitly not the target design; these must become continuous-world spaces.



## 22. Active World spatial/system integration rules

These rules describe the intended conversion architecture. They are design constraints for the main v0.203.3 Active World line, not claims that every item is already working correctly.

### Main vs reference build

- **v0.203.3 Active World is the main working build and must remain the foundation.** Preserve its free-moving Canvas, current world scale/zoom, continuous movement, roaming-enemy concept and landscape direction.
- **v0.114.1.3 is the canonical system/UI reference.** When an established system in Active World behaves differently from the mature v0.114 version without an explicit design decision, restore/adapt the v0.114 behavior rather than inventing a parallel replacement.

### Spatial ownership

The Canvas world owns:

```text
world position
camera
continuous movement
terrain/chunks
collision
world entities and sprites
spatial interaction range
physical placement of encounters/locations
```

Canonical Lowfathom systems own:

```text
character state
combat math and turn state
items/equipment/rarity/economy
Skills/Abilities/Bestiary
quests and interaction state
merchant/town services
Rest/Camp effects
XP/attributes/progression
save integrity and migrations
```

Adapters should connect them explicitly. Example: a visible goblin touches the player → canonical combat starts for that archetype; canonical death/loot resolves → a physical loot bag can be created at that world position.

### Required physical-world behavior

- **Enemies:** visible, modest roaming, collision-aware, reachable spawns, no sealed rock pockets, no casual roaming through protected Hollows. AI activity radius and render radius should be separate.
- **Loot:** enemy rewards may appear physically as `assets/ui/bag_coins.png`; walking over or pressing Interact/E opens the canonical recovered-loot flow. No fake bag when nothing dropped.
- **Chests:** keep procedural chests, but use sparse sector/chunk placement rather than per-floor-tile rolls.
- **Safe Hollows:** physically carved protected outcroppings/clearings with a campfire; canonical Hollow/Rest/Camp rules activate through spatial interaction.
- **Side passages:** literal traversable branches connected to the same terrain. No teleport to an instanced side-passage map.
- **Settlements:** Grey Lantern, Lantern City and Ashwick are constructed areas embedded directly into the same world coordinates. Buildings physically represent canonical Market/Tavern/Herbalist/Guild services. No detached rectangular town instance.
- **Caravans / wandering merchants:** visible wagon/camp/traveler world entities first; canonical Interaction Engine/merchant UI opens after approach/interact.
- **Quest/rescue objects:** clues, satchels, tracks, hideouts, bosses and similar beats should have physical causes in the world instead of appearing solely because a depth threshold was crossed.
- **Temporary companions:** an active escort such as Zeshava must have a visible follower presence; underlying quest/escort state remains canonical.

### In-world combat presentation

Combat remains the canonical turn-based system but occurs visually in the world where the encounter happened. Free movement locks while combat is active; combat UI overlays the Canvas. Player/enemy attack animation may use short lunges/bumps purely as visual feedback — the bump is **not** the input or hit-resolution system.

Current layout target:

- top-left: live Fathoms;
- top-center in combat: enemy name/HP/Intent;
- bottom-center: player name/level/HP/XP;
- right side: compact combat actions;
- left side: one collapsible log region, Delve Log outside combat and Combat Log during combat, same coordinates.

The correct Settings art is `assets/ui/glyph-gear.png`. Inventory should be accessible with **I** on keyboard.
