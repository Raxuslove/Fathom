# Fathom v0.084.0 — Session 9C Update Log

## Live gameplay changes

- **Major strata expanded from 60 to 500 fathoms.** The Goblin Warren now lasts from 0 through 499.x fathoms, with its boss guarding the 500-fathom boundary.
- **Safe Hollow pacing is decoupled from biome size.** Ordinary hollows keep an approximately 30-fathom rhythm, with a dedicated staging hollow 8 fathoms before a stratum boss.
- **Run pressure is decoupled from strata.** Escape-attempt deterioration resets every 60 fathoms rather than lasting for the entire 500-fathom biome.
- **Side-passage opportunities are decoupled from strata.** They keep a 60-fathom opportunity cadence so the larger biomes do not make side content eight times rarer.
- **Enemy depth scaling moved off the old linear `1 + depth/90` / `1 + depth/120` formulas.** Enemy HP and attack now use the Session 9C `depth^0.6` expected-progression benchmarks. Enemy scaling never reads the player's live damage or live Max HP.
- **Weapon contribution is standardized across Votary, Rogue and Wizard basic attacks.** Basic Strike/Heavy/Smite physical contribution now derives from the equipped weapon's scaling attribute plus the weapon's Item-Level-backed contribution.
- **Two-handed weapon contribution uses both hand budgets.** This makes the offensive opportunity cost of giving up Off Hand explicit without reducing Off Hand item quality.
- **Armor is now mechanical.** Authored Armor values on equipment reduce ordinary incoming damage through the scale-relative mitigation curve. Guard/Parry/Perfect Defence remains a separate tactical layer.
- **Worn Buckler now carries Armor +10** so a shield is a real defensive equipment choice rather than display-only identity text.

## Equipment / UI changes

- Existing authored equipment Item Levels were rescaled around the new fixed-rate iLv reference, where **iLv 100 is the depth-0 normal benchmark**.
- Rarity colors are now available for the full ladder: Salvage, Poor, Common, Uncommon, Rare, Epic, Wondrous, Legendary, Mythical, Ancient, Sunless and Unfathomable.
- Equipment quick info now shows **total Armor and current mitigation percentage**.
- Equipment comparison headlines for Item Level and Gear Level are neutral rather than green/red verdicts.
- Comparisons now surface live consequences where available, including **Armor**, **mitigation**, and **basic attack** changes.
- Equipment full-details text now distinguishes live mechanical stats (weapon contribution, Armor) from still-provisional attribute/utility text.

## Rarity / balance model codified

- Added the full rarity order to the game data.
- Added depth gates and target eligible-equipment-drop rates.
- Unfathomable is impossible before **5,000 fathoms**, begins at **0.5%**, gains **+0.1 percentage point per 1,000 fathoms**, and caps at **1.5%**.
- `Unique` remains a separate named/special-item designation rather than a rarity rung.
- Lower rarity budget multipliers are recorded for Salvage through Epic.
- Wondrous through Unfathomable keep their names/gates/rates, but their final budget multipliers remain deliberately unassigned until deep-game loot is actually authored and tested.

## Balance reference added

A new `BALANCE.md` records:

- 500-fathom stratum structure;
- `depth^0.6` expected-progression math;
- expected player/enemy reference values;
- fixed-rate Item Level ↔ normalized-budget relationship;
- slot budget coefficients;
- weapon contribution and Armor prices;
- Armor mitigation formula;
- slot-native stat-pool rule;
- rarity gates/drop targets;
- deferred systems that should not be pulled into Session 9C accidentally.

## Intentionally not added yet

- procedural equipment/affix generation;
- Wondrous+ power multipliers;
- generic equipment attribute effects;
- generic Max Stamina rolls;
- generic Max HP rolls;
- final Skill/check-bonus pricing;
- real dual-wield attack mechanics;
- crafting, durability or merchants.

## PWA

- Build version bumped to **v0.084.0**.
- Service-worker cache bumped to `lowfathom-v0.084.0` so the updated app shell replaces v0.083.7 cleanly.


## Save migration

- Run-save schema bumped from **2 → 3** because old 60-fathom stratum indices cannot safely mean the same thing after the switch to 500-fathom major strata.
- Migration preserves the delver, exact depth, HP, XP/level, attributes, inventory, equipment, Bestiary knowledge, side-area state when actively inside one, and permadeath state.
- It resets only obsolete stratum-indexed pacing markers: old Hollow history, old boss-boundary completion flags, Run-attempt band state, and inactive side-passage opportunity markers.
- A saved pending old-boundary boss warning is cleared so an obsolete 60-fathom boss cannot spawn after updating.
