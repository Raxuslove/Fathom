# Lowfathom — Active World Rebuild Handoff

**Main working build:** `lowfathom-world-v0.203.3.zip`  
**Canonical mature-system reference:** Lowfathom `v0.114.1.3`  
**Balance reference:** updated `BALANCE.md` supplied with this handoff  
**Purpose:** start a fresh chat without repeating the failed conversion strategy.

---

## 1. Most important correction: which build is the foundation

**v0.203.3 Active World is the MAIN game. Do not revert the project to v0.114.1.3 and do not restart the Active World from scratch.**

The player likes the new free-moving Canvas world, its current large zoom/scale, landscape presentation, roaming enemies, and the feeling of being a tiny delver in a huge mysterious cavern. Those are the parts to preserve and improve.

`v0.114.1.3` is a **REFERENCE/SOURCE OF TRUTH for mature systems and UI behavior** that were already working before the Active World conversion:

- combat rules/state;
- inventory/equipment;
- procedural gear/rarity/Intrinsic Value;
- Character/leveling/stat allocation;
- Skills/Abilities/Bestiary;
- quests/Journal/quest-bound items;
- NPC Interaction Engine;
- merchants/caravans;
- settlement services;
- Rest/Camp/Safe Hollow effects;
- loot/economy/currency;
- settings/dice;
- save integrity/migrations;
- other mature game systems.

If v0.203.3 has a simplified imitation of one of those systems, or behaves differently for no deliberate design reason, **adapt the real v0.114 implementation instead of inventing another replacement**.

The desired end state is:

> **current Active World + correct old Lowfathom systems/UI + spatial world integration**

Not:

> old passive game again

and not:

> another fresh rewrite of Lowfathom.

---

## 2. Why the current v0.203.x line went wrong

The first Active World conversion was built in the wrong direction. A new game shell was created and simplified versions of old systems were reimplemented around it. Later patches tried to graft the mature v0.114 systems back underneath that new shell.

That left two competing world models:

### Legacy assumptions

- passive Descend/Explore travel;
- timers and depth thresholds generate events;
- route markers stand in for places;
- town/passage screens are separate presentation states;
- many systems expect legacy travel `render()` calls.

### Active World assumptions

- player has real x/y coordinates;
- free continuous movement;
- terrain and collision are physical;
- creatures/objects should exist in the world;
- Fathoms are derived from world progress;
- interactions should be caused by visible places/entities.

Bridge patches between those assumptions caused repeated problems:

- movement remaining frozen after old sheets closed;
- severe lag only while walking upward because old depth rendering fired constantly;
- Fathoms desynchronizing;
- events opening in the middle of the screen with no physical cause;
- companion quest state existing without a visible follower;
- Delve Log clipping/off-screen positioning;
- bad town-coordinate save migrations;
- town and side-passage experiments becoming separate instances;
- current build feeling unlike the intended game despite containing many old systems.

**Do not continue solving this by piling more wrappers onto old travel rendering.** Keep v0.203.3 as the working codebase, but simplify the ownership boundary between the Canvas world and canonical systems.

---

## 3. Current v0.203.3 code shape

The Active World build is already split and should remain split rather than returning to one enormous HTML file.

Current important files include approximately:

```text
index.html
service-worker.js
manifest.json
js/
  legacy.js
  world.js
  world-bridge.js
  world-core.js
  dice.js
```

`legacy.js` contains much of the extracted v0.114 game logic. `world.js` contains Active World rendering/movement/world work. `world-bridge.js` is where many compatibility adaptations accumulated and therefore deserves careful review.

A fresh chat should **inspect these files before coding**, compare relevant code against v0.114.1.3, and identify which bridge behavior can be removed or made explicit.

---

# ACTIVE WORLD DESIGN — CURRENT DECISIONS

## 4. Platform and presentation

Still use plain **HTML/CSS/JavaScript/PWA**. HTML5 Canvas is appropriate for the world renderer. No engine switch is required.

Landscape is now the intended gameplay orientation for the Active World.

The game should work on phone/browser/PC. Mobile controls remain important, but do not force desktop to use a phone-sized render/entity radius.

### Superseded older project assumptions

Some old project notes are now stale and should NOT override this handoff:

- Passive/idle descent as the main exploration loop is superseded.
- The game is no longer primarily portrait stacked UI during exploration.
- The old “no player sprite” rule is superseded by the Active World.
- The old universal 64×64 enemy-art rule is not the current overworld standard; the present goblin sprites are roughly 32×32 and work at the current world scale.
- Progress Quest/idle heritage remains inspiration, but waiting during descent is specifically what motivated this redesign.

Still locked unless explicitly revisited:

- the player is the delver, not a manager;
- permadeath;
- endless Fathom progression;
- real player-controlled tactical combat;
- no unnecessary framework/build-step complexity;
- old mature systems should be preserved rather than casually reinvented.

---

## 5. Direction and movement

**UP ON SCREEN = DEEPER. This is locked.**

Movement should be Zelda-like/free continuous movement, not tile turns or movement ticks.

Desktop:

- WASD;
- arrow keys;
- E/Interact where appropriate;
- I opens Inventory.

Mobile:

- virtual joystick/D-pad;
- dedicated Interact control.

Moving upward increases Fathoms. Lateral movement is exploration at roughly the same depth. Downward movement means physically walking back through nearby ground, subject to one-way authored rules such as permanently departed settlements.

Do not call a full legacy DOM `render()` every tiny upward movement step. That previously made upward movement nearly unplayable while left/right/down remained smooth.

---

## 6. World scale / camera

**Keep the current v0.203.x world zoom.**

The wide desktop screenshot where the player and goblins looked small inside an enormous cavern is the desired feeling: massive, lonely, mysterious, dangerous.

Do not zoom in merely because sprites are around 32×32.

Render distance and AI simulation distance should be separate:

- desktop can display much more surrounding world;
- distant visible enemies do not need full roaming AI every frame;
- phone can use a smaller practical radius without changing world scale.

---

## 7. Infinite/procedural world

The world should feel continuous and effectively endless.

Use chunks/sectors internally. Only nearby content needs active simulation, but explored/persistent content must save correctly as needed.

Generation should create:

- large readable cavern spaces;
- corridors/tunnels;
- lateral branches;
- side chambers;
- environmental pockets;
- stratum-specific rules later.

The player must be able to wander sideways meaningfully. Avoid obvious invisible horizontal walls.

Spawn placement must verify connected/reachable terrain. Enemies/chests/events must not be placed inside sealed stone pockets the player cannot enter or the creature cannot leave.

---

## 8. Spatial interaction rule — extremely important

**World content should normally have a visible physical cause before UI opens.**

Bad:

> cross a Fathom threshold → carriage dialogue appears in the middle of the screen

Good:

> see a wagon/caravan in the cavern → approach it → press Interact → canonical dialogue opens

Bad:

> random side-passage popup

Good:

> see an actual branch/opening in the cave → physically walk into it

Bad:

> quest clue fires because depth value was reached

Good:

> tracks/satchel/body/hideout/object exists in the world → player discovers/interacts with it

Dialogue sheets, riddles, shop UI, quest choices etc. may still open after interaction. The issue is not using UI; the issue is events materializing without world feedback.

---

## 9. Side passages — must be continuous world

This is a major correction.

**Side passages must NOT be instanced maps.**

v0.203.1 experimented with transitioning into a separately generated passage map. That is not wanted.

A side passage is literally another branch of the same generated cavern network:

```text
                 deeper ↑
                    │
main cavern ────────┼────────
                    │
             ╲
              ╲ side passage
               ╲──── optional chamber/content
```

The player walks into it normally and can walk back out normally.

Existing canonical passage content can populate the physical branch:

- enemies;
- riddles;
- mechanisms;
- cursed content;
- keys;
- chests;
- special finales.

Do not teleport/change to a separate local coordinate system to represent a passage.

---

## 10. Towns/cities — must be continuous world

Same rule as passages.

**Grey Lantern, Lantern City and Ashwick should be physically built into the same world. They must not be detached/instanced town maps.**

The placeholder Lantern City layout itself was considered visually acceptable as an early concept: roads, buildings, lamps, Tavern, Herbalist, Guild Hall, Market, Lower Gate. The problem was teleporting into a separate rectangular town space.

Instead, the world generator/authored world layer should create a settlement district directly at its proper Fathom coordinates. Walking through its entrance simply means continuing to move through the same Canvas coordinates.

Current authored depths from the canonical system:

- Grey Lantern — 150 fathoms;
- Lantern City — 450 fathoms;
- Ashwick — 550 fathoms.

Buildings should physically call the existing services:

- Market → canonical merchant system;
- Tavern → canonical recovery/lodging;
- Herbalist → canonical medicine/quest service;
- Guild Hall → canonical contracts/turn-ins/interactions;
- Lower Gate → canonical permanent-departure behavior.

The service systems stay. Only their physical presentation changes.

---

## 11. Safe Hollows / Camp spaces

Safe Hollows need a visible safe place in the world.

Desired initial visual:

> a small rough rocky outcropping/clearing with a campfire in the middle.

The generator should deliberately carve enough safe terrain around it. Do not place a campfire in a random exposed corridor or against blocking rock.

Enemies should not spawn inside the Hollow's protected area and should not casually roam through it.

The old Rest/Camp/Hollow effects remain canonical.

Ordinary Hollow pacing remains approximately every 30 fathoms as a **depth-spacing target**, not as a popup timer. A special staging Hollow remains 8 fathoms before each 500-fathom boundary.

---

## 12. Chests

**Keep procedural chests. They were liked.**

Do not return to the very dense early implementation. The bad version rolled spawn chance per floor tile and could show many chests in one screen.

Use sparse sector/chunk placement. Usually zero chests nearby; occasionally one interesting cache. Avoid obvious clusters unless an authored room intentionally calls for them.

Chest rewards should use the canonical old loot/item generator rather than a replacement item system.

---

## 13. Enemy floor loot

When a goblin dies, canonical loot should be able to appear as a physical floor bag at the death location.

Asset:

```text
assets/ui/bag_coins.png
```

Interaction:

- walk over it; or
- stand nearby and press E/Interact.

Then open the canonical Recovered/loot UI.

Do not create a fake bag when the enemy actually rolled no loot.

Underlying coins/items/equipment/quest drops must come from canonical Lowfathom loot logic.

---

## 14. Enemies and sprites

Current six goblin archetypes:

- Goblin Cutter
- Goblin Scrounger
- Goblin Skitter
- Goblin Shieldback
- Goblin Mauler
- Goblin Oldhand

Current art plan:

```text
assets/ui/goblin-cutter.png
assets/ui/goblin-skitter.png
assets/ui/goblin-shieldback.png
assets/ui/goblin-mauler.png
assets/ui/goblin-oldhand.png
```

Goblin Scrounger deliberately reuses `goblin-cutter.png` for now.

Goblin overworld assets are roughly 32×32 and should remain relatively small at the current zoom.

Enemy behavior target:

- modest roaming;
- collision aware;
- feels like part of the environment rather than a static marker;
- reachable spawn locations only;
- does not constantly chase from huge range;
- no spawning/roaming inside Safe Hollows;
- render radius may be much larger than active AI radius.

---

# COMBAT

## 15. Combat stays in the world

There should be **no separate combat screen**.

The enemy remains where it was encountered. Player/enemy sprites remain visible on the Canvas. Free exploration movement locks while the canonical combat state is active.

Combat buttons appear over the world.

Attack animation may use a quick lunge/bump into the target and return. **The bump is visual feedback only; it is not the attack input or hit system.**

Use the actual canonical combat engine from v0.114.1.3.

Do not revive the simplified standalone `combat.js` implementation from the early v0.200 build merely because it looked clean. Its presentation can be used as inspiration, not its duplicate rules/state.

---

## 16. Current canonical combat rules

Important current state from v0.114.1.3:

- fixed Player → Enemy alternation while Speed is parked;
- 3 Stamina refreshed each Player Turn;
- d20 + Attack Bonus vs AC;
- natural 1 always misses;
- natural 20 automatically hits and is a **×2 Critical Hit** for player and enemy;
- hidden DEX/gear Crit roll is parked;
- WIS Precision/variable Crit Damage is parked;
- new Crit Chance affix generation is paused;
- existing saved Crit affixes remain for compatibility but do not affect live Crits;
- Rogue Backstab no longer guarantees a Crit; it currently uses the same natural-20 rule while its replacement identity is undecided;
- Strike chain = 1.0× / 1.6× / 2.6×;
- Heavy/Backstab/Arcane Bolt = 3.2×, normal player accuracy, full 3-Stamina commitment;
- Guard/Parry/Ward/Brace = next-attack damage reduction;
- Counter = +4 AC for next enemy attack attempt; if the attack misses, **Counter retaliation automatically hits** (no second d20);
- Sand Throw = 60% Blind;
- Read/Study;
- enemy intent system;
- enemy Heavy uses literal wind-up/release;
- Off-Balance;
- Attack/Defence logarithmic ladders and Deflection;
- optional physical d20 presentation remains authoritative, not a second roll.

See updated `BALANCE.md` for formulas.

---

## 17. Combat HUD target

Landscape target:

### Top-left

- live Fathoms.

### Top-center during combat

- enemy name;
- enemy HP bar;
- enemy Intent directly under it.

### Bottom-center

League/Diablo-like horizontal HUD placement, **not an orb**:

- player name;
- level;
- HP bar;
- XP bar;
- HP/XP values.

### Right side

- compact combat action buttons.

The user originally said left and corrected it: **combat buttons belong on the RIGHT.**

Do not cover the bottom-center player HP/XP with combat controls.

---

# UI / LOGS / OLD SYSTEMS

## 18. Delve Log and Combat Log

There should be one left-side log region.

Outside combat:

> Delve Log

During combat:

> Combat Log

They should occupy **the same coordinates** and swap content/state rather than behaving like unrelated windows.

Requirements:

- fully inside viewport;
- collapsible;
- History expands it;
- Collapse shrinks it;
- can stay open while player continues exploring;
- opening the log alone must not freeze world movement;
- no clipping inherited from the old travel container.

Several v0.203.x patches failed this by positioning the Delve Log relative to legacy DOM containers. Review this carefully rather than preserving that CSS blindly.

---

## 19. Inventory / Character / equipment

Do not redesign the mature systems unless deliberately requested.

Canonical old features include:

- Backpack/Equipment tabs;
- 17 equipment positions;
- Main/Off Hand;
- two-handed behavior;
- item filters/sorting;
- generated equipment instances;
- rarity presentation;
- Intrinsic Value;
- Gold appraisal;
- equipment comparison;
- combat-stat consequences;
- character stats/Skills/Abilities/Quests/Journal.

Keyboard:

**I opens/closes Inventory.**

Opening blocking sheets can pause movement. Closing them must restore movement immediately. Do not require some unrelated action such as Rest to trigger a legacy `render()` before Canvas movement resumes.

---

## 20. Settings art

Correct settings asset:

```text
assets/ui/glyph-gear.png
```

Do not use `icon-gear.png` and do not use a Unicode cog.

---

# QUESTS / NPCs / WORLD EVENTS

## 21. Temporary companions

The canonical Zeshava Brightsong rescue/escort system remains valid.

When escort state says Zeshava is following the player, the Active World needs visible follower presentation. Do not leave the NPC only as an invisible state variable.

Existing asset:

```text
assets/ui/companion-torch.png
```

A simple visual follower is enough initially; companion combat AI is not required merely to prove presence.

---

## 22. Caravans / wandering merchants

Make them physical world encounters.

Visible wagon/camp/traveler first → approach/interact → canonical Interaction Engine or merchant UI.

A proper carriage/wagon pixel asset is still needed. A temporary drawn placeholder is acceptable, but the spatial entity should exist before the popup.

---

## 23. Quest/rescue events

Do not simply fire old quest events because depth crossed a number.

Use the canonical quest state to decide what should exist, then let the world renderer spawn a physical representation where appropriate:

```text
quest says satchel should exist
→ world creates satchel/object at valid location
→ player reaches/interacts
→ canonical quest objective resolves
```

Same idea for tracks, hideouts, bodies, clues, quest bosses, etc.

The canonical quest/interaction engine owns state and consequences. The world owns where/how the player physically encounters that state.

---

# DEPTH / PERFORMANCE / SAVE

## 24. Fathoms

Fathoms remain the canonical endless progression axis.

The live HUD should derive Fathoms smoothly from actual Active World position.

The canonical depth state still needs synchronization because existing systems use it for:

- enemy scaling;
- iLv expectation;
- strata;
- settlements;
- bosses;
- loot;
- quests;
- other progression.

Do not solve this by calling the complete legacy render loop every small upward movement increment. That was the main cause of the catastrophic upward-only lag.

---

## 25. Saves

Current v0.203.x contains save/bridge migrations accumulated during the conversion, including town-coordinate repair work.

A fresh chat should inspect save ownership carefully before changing schemas again.

Principle:

- preserve canonical character/system state;
- add world state explicitly;
- do not maintain two conflicting coordinate/world representations for the same location;
- future world chunks/entities need deterministic IDs or saved state where persistence matters;
- test existing saves before bumping schema.

User has a full backup, but that is not a reason to casually break saves.

---

# ART DIRECTION

## 26. Current art approach

Pixel art is now the intended world direction. The user has some pixel-art experience and may use ChatGPT/image generation as a starting point, then clean assets in Aseprite.

Consistency matters more than detail.

Current useful assumptions:

- overworld character/enemy scale roughly around 32×32 where appropriate;
- crisp nearest-neighbor scaling;
- fixed perspective/top-down-ish angle;
- controlled palette/lighting;
- large world zoom stays as-is;
- terrain should be built from reusable tiles/assets rather than giant AI-generated background images.

Towns likewise should be constructed from reusable world art rather than using one giant illustrated town image.

---

# WHAT THE NEW CHAT SHOULD DO FIRST

## 27. Do not code immediately

Before making another patch:

1. Open/inspect the **v0.203.3 MAIN build**.
2. Open/inspect **v0.114.1.3 REFERENCE**.
3. Read updated `BALANCE.md`.
4. Identify which v0.203.3 systems are:
   - genuine Active World features to keep;
   - bridge hacks around legacy travel;
   - simplified/reimplemented old systems;
   - canonical old systems already successfully extracted.
5. Explain a repair/refactor plan before editing.

The plan should specifically address:

- continuous-world towns;
- continuous-world side passages;
- spatial quest/event triggering;
- canonical system ownership;
- Fathom synchronization without legacy-render lag;
- movement/UI blocking ownership;
- save/world coordinates;
- persistent log placement;
- world entity persistence.

Only then make changes.

---

## 28. Files to upload to the fresh chat

### Required

1. **`lowfathom-world-v0.203.3.zip` — MAIN BUILD**
2. **Old stable v0.114.1.3 backup — REFERENCE ONLY**
3. **This handoff + updated `BALANCE.md`**

### Strongly recommended

4. `assets/ui/` folder as a ZIP, or the full current Lowfathom project backup if upload size permits.

This matters because v0.203.3 packages supplied in chat did not contain the user's full art library. Having the assets lets the next chat verify real filenames/paths and build world presentation against the actual art.

### Not necessary as primary guidance

The old `BUILD-PLAN.md` and original project-instructions document describe an earlier passive-descent version of Lowfathom. They contain useful history, but parts are now superseded. If supplied, the new chat should treat **this handoff as the newer design authority** on Active World movement/presentation.

---

## 29. Suggested opening instruction for the fresh chat

Paste this after uploading the files:

> **v0.203.3 is the MAIN game and must remain the foundation. Do not revert to v0.114.1.3 and do not rewrite the Active World from scratch. Preserve the free-moving Canvas, current large world scale/zoom, landscape movement, roaming enemies and the overall visual feeling. Use v0.114.1.3 only as the canonical reference/source for mature systems and UI that need repair or restoration. Before coding, inspect both builds and explain which bridge/replacement systems need refactoring. Towns, side passages, Safe Hollows, caravans, quest objects, bosses and companions must ultimately exist physically in the same continuous world rather than as instanced maps or unexplained depth-triggered popups. Use the updated BALANCE.md for current combat/math, especially the natural-20 ×2 Crit and auto-hit Counter retaliation.**

---

## 30. Short version of the goal

**Do not replace the world the player likes. Fix the game around it.**

- v0.203.3 world = keep.
- v0.114.1.3 mature systems = reference/restore.
- one continuous world = towns + passages + events + companions.
- canonical combat/equipment/quests = preserve.
- old passive travel presentation = retire.
- world interactions should have visible physical causes.
- inspect and plan before another large patch.
