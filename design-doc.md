Guard a Heavy Attack → enemy becomes Off-Balance.
Successfully Parry a Heavy Attack → enemy becomes Off-Balance.
Interrupt certain actions → enemy becomes Off-Balance.
Future Fighter skill → forcibly causes Off-Balance.
Certain monsters may be resistant to it.

|                       | Guard                     | Parry                          |
| --------------------- | ------------------------- | ------------------------------ |
| Damage reduction      | **High**                  | Moderate                       |
| Counter damage        | Low                       | **High**                       |
| Stamina recovery      | +2                        | +2                             |
| Full-Stamina bonus    | Shield counter            | Riposte                        |
| Equipment consequence | Shield absorbs punishment | Weapon takes durability damage |
| Risk                  | Low                       | Higher                         |




The rock-paper-scissors direction is right
Not literally three choices, but a system of answers and counter-answers.
Something approximately like:
| Enemy intent     | Strong answers                           |
| ---------------- | ---------------------------------------- |
| **Quick Attack** | Guard / Parry                            |
| **Heavy Attack** | Guard / Parry / Sand gamble              |
| **Dodge**        | Read / Guard for stamina / prepare Heavy |
| **Guard**        | Heavy                                    |
| **Recover**      | Strike / Heavy / maybe Interrupt         |
| **Off-Balance**  | Attack aggressively                      |


I have an idea I just don't know if it's good. In tetris, you can see the next block that comes after the current one is done. Would it work in this one? So you can plan ahead?

But I think you've accidentally found a really good future mechanic
Instead of everyone always seeing the next intent, make future knowledge something the player can earn.
For example, Read It could eventually do more than reveal a weakness.
Once you've studied a species enough:
Well Read
You can sometimes anticipate what it will do after its current intent.

Or a class skill:
Foresight
Reveal the enemy's next intent.

Or a high-WIS character could get:
Prediction: likely to Guard next
Not necessarily 100% certainty.

Certain enemies could also naturally telegraph multiple steps:

Heavy Attack
It is committing everything to this swing. It will need to recover afterward.

That's particularly good because it gives monsters character. A berserker might have obvious chains while something cunning deliberately stays unpredictable.

Blind is stored until consumed by an attack attempt. It does not expire simply because the enemy takes a non-attacking action.


## Deferred Descent & Exploration Design

These ideas belong to the broader exploration system, but should **not be implemented during Session 4**. Session 4 only needs to establish the traversal/event backbone that they can later plug into.

### Horizontal Exploration

At any depth, the player can stop descending and **Explore** horizontally.

Example:

* Current depth: 35 fathoms
* **Descend** continues deeper.
* **Explore** searches the area around 35 fathoms without increasing depth.

Explore exists as a way to investigate a stratum, find unusual discoveries, gather resources and recover from a run that has progressed faster than the character's strength.

The same general interruption engine used while descending can also operate while Exploring.

Possible Exploration outcomes later include:

* Monsters appropriate to the current depth or shallower
* Treasure
* Ingredients/materials
* Artifacts
* Books and scrolls
* Treasure maps
* Scrolls written in unknown languages
* Chests
* Traps
* Strange locations
* NPCs
* Wandering merchants
* Quest encounters
* Rare discoveries

Exploration should be exciting because of **what might be found**, not merely because it is a grinding button.

---

### Preventing Infinite Exploration Farming

Horizontal Exploration must not become mathematically superior to descending.

The likely solution is to treat **discoveries and combat differently**.

#### Discoveries

Useful finds at a specific depth/area are finite or strongly diminishing.

An area can gradually become searched out or picked over.

Early exploration has good discovery potential. Continued searching eventually produces fewer meaningful finds because the player has already exhausted most of what was there.

The exact implementation does not need to be decided yet.

#### Combat

Monster encounters do **not** need to become exhausted.

Creatures can continue wandering into an explored area, so combat may remain possible indefinitely.

However, fighting weak enemies should not allow infinite meaningful XP farming.

XP should probably scale relative to the player's level versus the monster's level:

* Appropriate-level enemy → normal XP
* Weaker enemy → reduced XP
* Much weaker enemy → negligible or zero XP

The exact level difference and XP curve will require playtesting.

This allows Exploration to function as a **catch-up mechanic**. A player who descended unusually far while receiving few combat encounters can stop and fight level-appropriate enemies until they are more prepared.

A player who is already overlevelled gains little from repeatedly killing weak enemies.

---

### Stratum Structure

A stratum is essentially Lowfathom's version of a biome or dungeon zone.

A stratum can eventually determine:

* Enemy population
* Environment/architecture
* Hazards
* Materials
* Loot
* Books and scrolls
* NPC possibilities
* Merchants
* Special locations
* Atmosphere
* Bosses and minibosses
* Other stratum-specific events

The temporary prototype size is **20 fathoms per stratum**, but this is a pacing number and can be changed easily later.

---

### Minibosses

Each stratum should have a miniboss around its midpoint.

The miniboss does not necessarily need to attack exactly when the player crosses the midpoint.

Reaching that region could instead introduce the miniboss into the local event/encounter system until it is eventually found.

Exact miniboss behavior should be designed later.

---

### Stratum Bosses

The end of a stratum contains its boss.

The boss **gates further descent**, but reaching the boundary should not automatically throw the player into the fight.

Instead, reaching the bottom of the stratum tells the player that something is preventing further progress.

The player can then prepare before deliberately challenging the boss.

Possible preparation later includes:

* Horizontal Exploration
* Equipment management
* Inventory management
* Rest/camp
* Consumables
* Skills
* Books/knowledge
* Other preparation systems

The desired emotional sequence is:

**Reach the boundary → realize what waits there → prepare → feel apprehension/excitement → deliberately commit to the boss fight.**

The boss challenge should feel voluntary and consequential, not like an unavoidable random encounter while the player happens to have 10 HP left.

---

### Dangerous Encounter Warnings

Not every encounter needs to appear without warning.

Particularly dangerous encounters may first produce a warning event such as:

**“You hear noises up ahead.”**

Possible examples later:

* Monster groups
* Swarms
* Elite enemies
* Minibosses
* Dangerous hazards
* Other unusually threatening encounters

The player may eventually be able to react before committing.

Possible responses could include:

* Continue
* Listen
* Avoid
* Prepare

This creates an exploration equivalent of combat's declared-intent philosophy: dangerous situations can sometimes provide information before the player commits.

Ordinary encounters should probably remain more immediate so warnings retain significance.

---

### Descent Continues Behind Soft Screens

When the player has chosen to Descend, opening a non-critical management screen should not automatically stop travel.

Possible soft screens:

* Inventory
* Equipment
* Character/stats
* Knowledge/bestiary
* Books
* Similar management screens

Depth continues increasing and the event engine continues operating in the background.

A genuine interruption—combat, trap, NPC encounter, important discovery, etc.—stops descent and pulls the player's attention back to the event.

General rule:

**Soft UI does not stop the delve. Actual events do.**

---

### Generic Exploration Event Engine

The descent system should eventually work like this:

**Player chooses activity:**

* Descend
* Explore
* Stop

The game then periodically determines whether something interrupts that activity.

If something happens, the engine asks:

**“What happened?”**

Possible future event categories:

* Combat
* Dangerous encounter warning
* Trap
* Loot/discovery
* Chest
* Ingredient/material
* Book/scroll
* Treasure map
* Artifact
* Merchant
* NPC
* Quest encounter
* Location/choice event
* Safe location
* Other stratum-specific events

Session 4 should build the generic traversal/interruption structure, but initially **combat can remain the only implemented event result**.

The purpose is to avoid building a combat-specific random encounter system that later has to be replaced when exploration content is added.


Character selection screen, so you can choose to either make a new character + game mode, It would say name of character, race, class, current depth.
3x character slots to begin with.
