# Fathom — Balance Reference

**Build reference:** v0.086.0  
**Session:** 9E — Skill Foundation  

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
- Skill/check-bonus item pricing remains deferred. Session 9E establishes the endless Skill rating curve, but the normalized-budget price of +Skill Rating has not yet been tuned against live runs.
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

## 12. Session 9E endless Skill foundation

Session 9E replaces the old `d20 + attribute + Skill Rank + proficiency vs DC` prototype. The old formula could not survive endless attributes and endless Skill progression because the additive bonuses eventually dwarfed the die.

### 12.1 Rank is a logarithmic expertise rating

Displayed Skill Rank is an **Elo-like logarithmic rating**, not a literal flat bonus added to a die.

```text
rating gap d = Effective Skill Rating - Challenge Rating
spread s = 30
P(success) = 1 / (1 + 10^(-d / s))
```

`30` is the current playtest spread, not an untouchable constant.

Reference probabilities:

| Rating gap | Approx. success chance |
|---:|---:|
| +60 | 99% |
| +30 | 91% |
| +15 | 76% |
| 0 | 50% |
| -15 | 24% |
| -30 | 9% |
| -60 | 1% |

This makes a +1 Rank increase preserve the same underlying proportional meaning at Rank 10, Rank 100 or Rank 1,000.

### 12.2 Percentile resolution, not a larger swing die

Only uncertain contests roll. The game uses a percentile roll internally because a d20 can only represent probability in 5-point steps.

A 24% check succeeds on 24 of 100 possible percentile results; a 76% check succeeds on 76 of 100. The d100 therefore adds **resolution**, not extra volatility. The Skill/Challenge gap determines the probability.

- At roughly 99% or higher: automatic success; no roll.
- Below roughly 1%: automatic failure; no roll.
- Between those bounds: percentile roll.

Trivial old obstacles should stop consuming meaningful decisions. They may remain as scenery, free interaction, loot access or evidence of how far the delver has progressed.

### 12.3 Effective Skill Rating and attributes

Attributes remain relevant without becoming endless flat check modifiers.

```text
attribute aptitude = 8 × log2(effective attribute / 10)
Effective Skill Rating = trained Skill Rank + aptitude + proficiency + circumstance
```

The aptitude coefficient `8` is provisional.

Every doubling of the governing attribute adds the same amount of effective Skill Rating. This lets both training and attributes remain meaningful at extreme depth without either one automatically swallowing the other.

Examples:

| Governing attribute | Approx. aptitude |
|---:|---:|
| 10 | 0 |
| 20 | +8 |
| 40 | +16 |
| 160 | +32 |
| 2,400 | +63 |

Attributes below 10 may contribute a small negative aptitude rather than being clamped to zero.

### 12.4 Challenge identity is fixed to the content

**Challenge Rating belongs to the thing being attempted, not automatically to fathom depth.**

A particular rusty lock does not become harder merely because the same kind of lock appears at 30,000 fathoms. If the delver has outgrown it, it becomes automatic.

Depth instead changes the **content mix**. Deeper regions should increasingly introduce new high-rated locks, creatures, materials, languages, hazards and other challenge identities, while some low-rated content continues to appear.

Do not author Skill content as a multiplicative percentage of the player's current Rank. On a logarithmic rating scale, challenge distributions must use **additive rating gaps** around whatever benchmark is eventually observed.

No expected-Skill-Rank-at-depth formula is locked in 9E. That benchmark must be derived from actual practice cadence and playtest data rather than guessed in advance.

### 12.5 Learning-value Skill XP

Skill Rank improves through meaningful learning rather than simple button use.

Current prototype:

```text
XP to next Rank = 100, flat forever
base meaningful success = 10 XP
```

The logarithmic Rank scale already supplies diminishing underlying returns, so the first prototype does not add a growing XP-to-Rank curve.

Practice behavior:

- automatic/trivial resolution: 0 XP;
- comparable success: normal practice;
- success against a stronger challenge: increased practice;
- sufficiently extreme upset success: an **Against the Odds** bonus;
- failure near the delver's competence: some practice;
- failure far outside the meaningful learning band: little or no practice.

Hard-success reward increases while hard-failure learning falls away. This preserves the excitement of hitting a rare 1–2% success without making repeated hopeless failure the optimal training strategy.

Each authored opportunity still has a one-use practice identity so the same generated event cannot be farmed indefinitely.

### 12.6 Perception is primarily passive

Perception now establishes what the delver notices before the active decision is presented.

Current proving interactions:

- the exploration glint is passively detected by Perception;
- side-passage discovery is passively detected by Perception;
- post-combat bonus-search opportunities are passively surfaced by Perception, then actively examined with Investigation.

A trivial Perception challenge auto-resolves and grants no practice. A near-level passive challenge can grant learning whether it succeeds or fails.

Some deliberate inspection interactions may still use Perception where the player has already chosen to stop and actively scan a suspicious situation; Perception is **mostly passive**, not forbidden from every active context.

### 12.7 Investigation proves active success quality

Investigation remains an active choice. In the first 9E slice it handles deliberate examination and bonus salvage searches.

A successful Investigation can become more productive when the delver's effective rating exceeds the challenge. This is the first prototype of the broader rule:

> Skill progression should improve not only whether an action succeeds, but how well success converts into information, efficiency or reward.

Detailed material-rank and crafting interactions remain future content work.

### 12.8 Stealth vs enemy Awareness

Creatures now have authored **Awareness** ratings. Awareness is content identity, not a universal depth multiplier.

The first Stealth technique is **Concealment I**:

- 2 uses;
- 10 minutes of active travel per use;
- timer freezes when travel is held or combat is active;
- each normal enemy encounter compares Stealth Rating against that creature's Awareness;
- successful concealment gives the player a choice to **Ambush** or **Let them pass**;
- Ambush starts combat with a surprise opening and breaks Concealment;
- Let them pass preserves Concealment but grants no combat XP or loot;
- being detected breaks Concealment and proceeds to the normal encounter warning;
- mandatory stratum bosses do not become bypassable through this prototype.

For 9E playtesting, Concealment is available immediately so the Stealth/Awareness loop can actually be exercised. Its eventual Skill-Rank mastery unlock threshold is deliberately **not locked** until Rank cadence is observed.

Studied Bestiary entries reveal a creature's Awareness rating so unusual detection ability can become part of enemy identity.

### 12.9 Long-term Skill progression philosophy

The endless rating is only one layer. Long-term Skill progression should combine:

1. **endless Rank growth** — the number continues to rise;
2. **automatic mastery of old problems** — former obstacles become beneath the delver;
3. **sparse qualitative milestones** — new verbs, techniques, information or efficiencies rather than only percentage bonuses;
4. **new deep content traits** — higher-rated content must increasingly behave differently, not merely carry a larger number.

This prevents infinite progression from degrading into `Rank 1000 vs Challenge 1002` forever.

Failure-quality improvements remain a good future mastery axis, but are deferred until the base success-quality and resolver loop has been playtested.

