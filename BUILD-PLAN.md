# Lowfathom — Build Plan

Sessions, not weeks. Each one ends with something visible on your phone.
Tick them off as you go. Commit at the end of every session.

---

## The rule this plan is built around

The core bet is **combat with declared intent**. Everything else — books, hirelings,
oaths, auto mode, art — is decoration on top of that. So combat gets built first,
before the descent, before saving, before anything pretty.

If the fight isn't fun by Session 2, no amount of the rest fixes it. That's the point
of doing it first: finding out early is cheap, finding out at Session 9 is not.

---

## PHASE 1 — Find out if it's fun (Sessions 0–2)

### Session 0 · Setup (~45 min)
- [x] New folder `Lowfathom` on the Desktop, outside the pantry folder
- [x] VS Code → File → Open Folder → select it
- [x] Create `index.html`, paste starter, save
- [x] Right-click → Open with Live Server, confirm it loads
- [x] Open the same address on the phone over wifi
- [x] Terminal → `git init`, first commit
- [x] Create `BACKLOG.md` and paste in every idea from the design chat

**Done when:** you can see a page on your phone that says the game's name.

---

### Session 1 · The combat screen, static (~2 hrs)
No logic at all. Layout only, with fake numbers hardcoded.

- [x] Foe panel: name, level, HP bar
- [x] Intent line — the most important text on screen, must be readable at arm's length
- [x] Your panel: HP bar, Stamina bar
- [x] 2×2 action pad pinned to the bottom, inside thumb reach
- [x] Readout area for what just happened
- [x] Check on the phone in portrait. Then check it one-handed.

**Done when:** it looks right on your phone and you can reach every button with a thumb.
**Your input needed:** none yet — placeholder text is fine here.

---

### Session 2 · Combat that plays ★ THE GATE
- [x] Turn loop: you act, foe acts on its declared intent, repeat
- [x] Stamina pool — spend on Strike/Heavy, restore on Guard
- [x] Intents roll each turn and display before you choose
- [x] Tap-to-preview → tap-to-confirm (also prevents fatal misclicks)
- [x] Preview shows exact numbers: damage, Stamina cost, what comes back at you
- [x] Run, with its HP cost shown and a red warning when it would kill you
- [x] Death is real — screen ends the run
- [x] One hardcoded enemy is enough

**Done when:** you've played twenty fights on your phone.

**★ STOP HERE AND BE HONEST.** Was it tense? Did you ever agonise over a button?
Did you lose a fight and immediately want another? If yes, carry on. If it felt like
clicking the biggest number, we fix combat before building anything else on top of it.

---

## PHASE 2 — Make it a game (Sessions 3–7)

### Session 3 · Enemies and reading
- [x] 5–6 enemies with different stats and intent tendencies
- [x] Difficulty scales with depth
- [x] The Read action — costs a turn, reveals a weakness
- [x] Weaknesses remembered permanently, per species, across the run

**Your input needed:** creature names and one line of flavour each.

---

### Session 4 · The descent
- [ ] Depth in fathoms, always climbing
- [ ] Encounters interrupt the descent, combat screen slides in
- [ ] Strata with names — hand-written ones first, procedural after they run out
- [ ] The shaft visual: depth marker creeping down

**Done when:** you can descend, fight, descend again, and see the depth number rise.
**Your input needed:** stratum names for the first five bands.

---

### Session 5 · Rest and camp
⚠ **Resolve camp gating before starting this session.** 3-hour cooldown vs. safe
hollows + supplies. The whole session's shape depends on which one.

- [ ] Real-time clocks stored as timestamps, diffed on load
- [ ] Rest: ~10–15 min cooldown, quarter heal, choose one boon
- [ ] Camp: full heal, rested buff, all slots back
- [ ] One boon active at a time
- [ ] Clock freezes during combat

**Your input needed:** the boon list — names and what each does.

---

### Session 6 · Skills and slots
- [ ] Skill slots as a resource — refresh fully at camp, partially at rest
- [ ] First class with three skills
- [ ] Each skill solves a problem the basic four can't
- [ ] Degrees display as I / II / III

**Your input needed:** the three skills, what problem each solves, and what II and III change.

---

### Session 7 · Permadeath and character creation
- [ ] Character creation screen — name, folk, trade, origin, starting stats
- [ ] Death screen: the chronicle, depth reached, what killed you
- [ ] Starting a new delver is clean and quick

**Done when:** you can die and immediately want to sign another one.
**Your input needed:** the folk/trade/origin lists, and the death screen's wording.

---

## PHASE 3 — Make it real (Session 8)

### Session 8 · Saving and installing
- [ ] Save state to localStorage, restore on open
- [ ] Save on every meaningful action — a permadeath game must never lose progress to a closed tab
- [ ] `manifest.json` + icons
- [ ] Service worker so it opens offline
- [ ] Install to your phone's home screen and play it as an app

**Done when:** it's an icon on your phone that works with the wifi off.

**This is v1.** Play it for a week before building anything below.

---

## POST-V1 — Only after v1 has been played for a week

- Session 9 · Auto mode — hireling works cleared ground, yields computed from elapsed time
- Session 10 · Sprite loading with placeholder fallback, then art
- Session 11 · Books and plips
- Session 12 · Oaths
- Session 13 · Hirelings with specialties, wages, recruitment
- Session 14 · Wandering merchants
- Session 15 · Second class

Everything here is additive and bolts on without rework. That's why it waits.

---

## Open design questions

Only the first one blocks a session. The rest can stay open past v1.

- [ ] **Camp gating** — cooldown, or safe hollows + supplies? *(blocks Session 5)*
- [ ] Plip cost — scales with depth, or with the book's power?
- [ ] Do books show their scaling stat on pickup?
- [ ] Smites on CHA or WIS?
- [ ] Hybrid builds — split scaling, or lean into narrow builds?

---

## Session end checklist

Every time:
- [ ] Play it on the phone, not just the desktop browser
- [ ] New ideas → `BACKLOG.md`, not into the build
- [ ] `git add .` then `git commit -m "Session N: what got built"`
