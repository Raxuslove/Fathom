# Fathom — Balance Reference

**Build reference:** v0.085.0  
**Session:** 9D — Procedural Equipment  

This file records the agreed balance spine so later item work does not need to re-open the same architecture. Constants are tuning targets, not promises that playtesting can never change them.

## 1. Major depth structure

- One major **Stratum / biome = 500 fathoms**.
- Stratum identity is a long-lived ecosystem, so Bestiary Study/Mastery has time to matter before the biome changes.
- Safe Hollows are **not** tied to one-per-stratum pacing. Ordinary hollows keep an approximately 30-fathom rhythm.
- A special staging hollow appears 8 fathoms before each 500-fathom boss boundary.
- Run-pressure resets and side-passage opportunities use their own 60-fathom cadence.

## 2. Depth progression spine

Let:

```text
G = depth^0.6
```

Expected progression at a depth is a benchmark. Enemy scaling uses these expected values — **never the player's live stats**.

```text
Expected primary attribute = 13 + 0.60G
Expected CON               = 12 + 0.30G
Expected Max HP            = Expected CON × 6
Expected Strike            = Expected primary attribute
Expected enemy HP          = Expected Strike × 4.5
Expected enemy hit         = Expected Max HP ÷ 9
Expected medium Armor      = Expected primary attribute × 3
```

Enemy archetypes still modify those baselines through their own HP/attack profiles and intent multipliers.

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

## 3. Item Level and normalized budget

Item Level is a **fixed-rate rating**. A displayed iLv point always has the same normalized budget meaning at every depth.

```text
1.0-slot normalized budget = Item Level × 0.195
Expected budget at depth   = 19.5 + 0.90G
Expected Item Level        = Expected budget ÷ 0.195
```

Therefore:

- iLv 100 = 19.5 normalized budget.
- +100 iLv always means +19.5 normalized 1.0-slot budget.
- Higher iLv means a larger total budget, but not automatically a better fit for every build.
- Rarity power must already be reflected in the displayed Item Level. No invisible rarity multiplier remains after the item is stamped.

### Slot budget coefficients

| Slot | Coefficient |
|---|---:|
| Main Hand | 1.00 |
| Off Hand | 1.00 |
| Top | 1.00 |
| Bottoms | 0.80 |
| Hat | 0.60 |
| Gloves | 0.60 |
| Boots | 0.60 |
| Cape | 0.45 |
| Belt | 0.45 |
| Light Source | 0.45 |
| Pendant | 0.50 |
| Each Earring | 0.30 |
| Each Ring | 0.35 |

A two-handed weapon consumes Main Hand + Off Hand and therefore may use roughly two hand-slots of weapon budget. Main Hand and Off Hand are both full-value hand positions; moving a compatible one-handed weapon between them does not weaken the item.

## 4. Weapon contribution

For the first live 9C implementation:

```text
+1 weapon contribution costs 3 normalized budget
Basic attack base = 0.5 × weapon scaling attribute + weapon contribution
```

All classes use this same basic weapon formula. The equipped weapon chooses the scaling attribute (for example STR, DEX or INT).

Real dual-wield combat remains deferred. A second dagger is a legitimate full-value equipped item, but its second-weapon attack behavior is not part of 9C.

## 5. Armor

Armor is persistent equipment mitigation, separate from the tactical intent/counter layer.

```text
r = total equipped Armor / expected medium Armor at current depth
mitigation = r / (r + 2.5)
```

Reference on-level sets:

| Armor profile | r | Mitigation |
|---|---:|---:|
| None | 0.0 | 0% |
| Light tendency | 0.6 | ~19% |
| Medium tendency | 1.0 | ~29% |
| Heavy tendency | 1.5 | ~38% |
| Heavy / overgeared example | 2.2 | ~47% |

Armor reduces ordinary incoming damage. Correct Guard/Parry/Dodge/Perfect-Defence play remains a separate tactical layer, so equipment does not replace the declared-intent game.

```text
+1 Armor costs 1.5 normalized budget
```

Armor classes are tendencies, not restrictions:

- Light spends more budget on offense/mobility/utility.
- Medium is mixed.
- Heavy spends more budget on protection.
- Any class may wear any armor type.

## 6. Slot-native stat pools

Normal item families should roll properties that make sense for that item.

Examples:

- Breastplates naturally carry Armor/defensive properties.
- Weapons naturally carry weapon contribution and weapon-family properties.
- Rings normally do not carry Armor.
- A specifically themed item such as a **Ring of Defense** may deliberately break the normal ring pool.

Named/themed/Unique equipment may violate ordinary slot rules intentionally.

## 7. Attributes and other properties

- STR / CON / DEX / INT / WIS / CHA on generated equipment are now mechanically live and remain **rare and restrained** so level-up allocation stays the primary source of build identity.
- **Provisional Session 9D price:** `+1 attribute = 8 normalized budget`. This is a playtest tuning constant, not a permanent promise.
- Generic Max Stamina is **not rollable**. Exceptional named items may potentially grant +1 as a special property.
- Generic Max HP is not part of the first item budget implementation.
- Skill/check-bonus pricing is deferred until the Skill/DC progression curve is locked; fixed cheap check bonuses would eventually overwhelm a d20 system.
- Equipping CON later must not heal the player. Unequipping Max-HP-granting effects must clamp current HP to the new maximum, never below 1.

## 8. Rarity ladder

Mechanical rarity order, lowest to highest:

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

### Initial rarity gates and eligible-equipment-drop targets

| Rarity | First possible depth | Target chance once unlocked | Current budget multiplier |
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
| Unfathomable | 5,000 | see below | ×2.47 |

The upper ladder continues the existing rarity progression at roughly an 11% multiplicative step per tier. **Ancient is the clean ×2.00 Common anchor.** Unfathomable is the ceiling at ×2.47 Common; it does not gain numbered subtiers or any hidden post-generation multiplier.

At full unlock depth and the 1.5% Unfathomable cap, the raw eligible-equipment-drop distribution averages roughly **×1.12 Common budget**. This does not mean equipped player Gear Level will average ×1.12: players keep the best item found for each slot rather than equipping an average drop.

### Unfathomable chance

Unfathomable cannot drop before 5,000 fathoms.

```text
5,000 fathoms: 0.5%
+0.1 percentage point per additional 1,000 fathoms
maximum: 1.5%
```

Equivalent rule:

```text
chance = min(1.5%, 0.5% + floor((depth - 5000) / 1000) × 0.1%)
```

There is no Unfathomable I / II / III / IV. Item Level is already the endless progression axis; the word **Unfathomable** remains the top rarity.


### Equipped-player selection bias calibration

The depth benchmark describes **generated-drop expectation**, not the exact Gear Level a real player will carry. Because a player keeps the best item seen for each slot, equipped gear should naturally sit above the raw-drop average over time.

Do **not** correct this in advance. If playtesting shows that actual equipped Gear Level and Armor sit persistently above the intended depth benchmark, introduce a single calibration factor on the expected-equipment / expected-medium-Armor benchmark and tune it from observed runs. Start from `k = 1.0`; do not guess a higher value before real 500-fathom playtest data exists.

## 9. Comparison UI rule

Do not label an item simply **BETTER** or **UPGRADE** when build preference is unknowable.

- Item Level / Gear Level differences are shown neutrally.
- Objective consequences carry positive/negative coloring, for example:
  - Armor 19 → 24
  - mitigation 16% → 20%
  - basic attack 11.5 → 19.0
- Later, other consequences can be added when those properties become mechanical.

## 10. Session 9D procedural-equipment baseline

The live ordinary-equipment path is now procedural rather than a finite Warren catalogue.

- New delvers still start with **Salvage iLv 75** authored equipment: Top, Bottoms, Boots, plus a class-selected hand setup.
- Votary: Salvage Longsword + Buckler, or two-handed Salvage Greatsword.
- Rogue: Salvage Dagger + Buckler, or two-handed Salvage Shortbow. Real dual-wield attacks remain deferred.
- Wizard: Salvage Wand + Buckler, or two-handed Salvage Wooden Staff.
- Existing Bandage / Camp Supply / Meat / Water / Rope / Scroll Dust creature salvage remains live. **No healing potion is added**, so Rest/Camp/ability recovery pressure remains observable.
- Ordinary enemy equipment drops use the generation pipeline: **depth → rarity → iLv/budget → item family/slot → valid properties → persistent generated instance**.
- Before 500 fathoms, Epic is the highest possible rarity. At 500+, Wondrous (4%) and Legendary (1%) become eligible on equipment-rarity rolls.
- Normal generated weapon families have fixed sensible scaling: martial weapons use STR, finesse/ranged weapons use DEX, and wands/staves use INT. Special authored items may deliberately break this rule later.
- Protective equipment spends its live budget on Armor. Jewelry and current utility families spend their live budget on attributes. Generated items are stamped from the properties actually allocated; there is no hidden post-generation rarity multiplier.
- Generated items receive unique instance IDs and are stored in the chronicle so reloads preserve the exact item.
- Authored starters, boss rewards, Uniques and special encounter items remain static. The first 500-fathom stratum boss still grants one class-relevant **Epic iLv 385** weapon.

The purpose of the ongoing playtest is now to evaluate the real endless equipment loop: replacement frequency, Gear Level selection bias, attribute pressure, Armor mitigation, weapon contribution, resource pressure and whether rarity excitement remains appropriately sparse.

## 11. Explicitly still deferred

- broader procedural affix catalogue beyond Armor / Weapon Contribution / six attributes;
- skill/check-bonus pricing;
- real dual-wield attack rules;
- detailed ranged/arcane weapon-family mechanics;
- crafting, durability and merchants;
- character-level/stat equipment requirements;
- class armor restrictions.

