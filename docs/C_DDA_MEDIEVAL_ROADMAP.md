# C:DDA-Compatible Systems Roadmap for Medieval Life Sim

**Goal:** Every major system in Cataclysm: Dark Days Ahead gets a medieval analog
implemented at minimum-functional depth. Sci-fi elements (bionics, mutations,
gunpowder-as-primary, electricity, computers) are replaced with their period-
appropriate equivalents (prosthetics, divine curses, crossbows/bows as primary
ranged, alchemy/clockwork, manuscripts/libraries).

**Method:** Audit each C:DDA system, map to a medieval analog, estimate effort,
prioritize.

---

## Priority Legend

- **P0** — Blocking playability or already wired but throwing. Fix first.
- **P1** — Major gameplay pillar. Needed for the medieval feel.
- **P2** — Depth/polish. Implement after P0/P1 lands.

**Effort legend:** S = <1 day, M = 1-3 days, L = 3-7 days, XL = >1 week

---

## Master Roadmap

### P0 — Un-wire what exists, fix the show-stoppers

These are systems with code on disk but the integration layer swallows their
errors. Fixing them unlocks hours of already-written logic.

| # | C:DDA System | Medieval Analog | Status | Effort |
|---|---|---|---|---|
| P0-1 | **Communications** (rumor network, speech, radio towers) | Heralds, messengers, town criers, rumor propagation, literacy tiers | `Communication.js` exists (439 LOC) but update call is wrapped in try/catch in Game.js:641 | S |
| P0-2 | **Language** | Spoken dialects, written scripts, literacy, lingua franca | `Language.js` exists (381 LOC), wrapped in try/catch in Game.js:641 | S |
| P0-3 | **Physics (real)** | Projectile arcs, falling damage, lever mechanics, buoyancy | `Physics.js` is stub (289 LOC, class shells only); `MaterialPhysics` stub too | L |
| P0-4 | **Vehicle (driving)** | Mounted riding, wagon/cart travel, ship sailing | `Transportation.js` exists (partial); needs full wiring in Game.js | M |
| P0-5 | **Sanitation** | Chamber pots, cesspits, latrines, water-borne illness | Not present; needed to make Pathogens realistic | M |
| P0-6 | **Body temperature clothing layer** | Layered clothing (linen/wool/leather/mail), wet/cold protection | Physiology reads ambient temp now (just fixed) but doesn't read person.clothing | M |

### P1 — Major gameplay pillars

These define what makes the medieval feel.

| # | C:DDA System | Medieval Analog | Status | Effort |
|---|---|---|---|---|
| P1-1 | **Bionics** | Prosthetics (peg leg, hook hand, iron arm), holy relics, blessed implants | Not present | L |
| P1-2 | **Mutations** | Divine curses/blessings, lycanthropy, witch's mark, fairy blood | Not present | L |
| P1-3 | **Firearms** (modern) | Crossbows (heavy/light), longbows, shortbows, slings, javelins, atlatl | Partial — Combat has melee; needs full ranged module | L |
| P1-4 | **Electricity / power grid** | Alchemical apparatus, clockwork, watermills, windmills, candle/oil lighting | `Buildings.js` has `updateTemperature` (line 272); no power system | L |
| P1-5 | **NPC follower / faction camp** | Retinues, sworn swords, household guard, brotherhoods, pilgrim bands | `Factions.js` exists (672 LOC) but companion-following not exposed | XL |
| P1-6 | **Traps** | Snares, pit traps, caltrops, mantraps, deadfalls, tripwires | Not present | M |
| P1-7 | **Cooking / food prep** | Spit roast, pottage, bread baking, salt curing, smoking, pickling | `FoodSystem.js` exists but prep methods absent | M |
| P1-8 | **Advanced weather** | Storms, fog, snowpack, drought, flood, microclimate, season effects | `NaturalWorld.updateWeather` exists (Game.js:860) but minimal | M |
| P1-9 | **Field surgery / first aid** | Herbal poultices, leeches, cautery, bone-setting, midwife birth assistance | `Treatment.js` exists (439 LOC); needs medieval pharmacology | M |
| P1-10 | **Animal husbandry** | Breeding, training, herding, veterinary, milking, shearing | `Fauna.js` has ecology; husbandry loop missing | L |
| P1-11 | **Skill books & teaching** | Master-apprentice, scribal copying, oral tradition, library decay | `Education.js` + `Knowledge.js` exist; book/teacher pipeline partial | L |
| P1-12 | **Religion/faith as gameplay** | Patron deities, prayer, divine intervention, heresy, tithes, indulgences | `Religion.js` exists (536 LOC); player-facing effects stub | M |

### P2 — Depth and polish

| # | C:DDA System | Medieval Analog | Status | Effort |
|---|---|---|---|---|
| P2-1 | **Mutation threshold** | Curse/mercy thresholds, exposure mechanics, cleansing rites | n/a (depends on P1-2) | M |
| P2-2 | **Bionic installation** | Prosthetic fitting, infection risk, faith healing rejection | n/a (depends on P1-1) | M |
| P2-3 | **Vehicle parts** | Wagon wheel repair, sail mending, horseshoe fitting | partial in `Transportation.js` | M |
| P2-4 | **Computers / software** | Scriptorium record-keeping, ledger auditing, astrolabe/cipher | Not present | L |
| P2-5 | **Map extras / overmap notes** | Cartographer's guild, expedition logs, rumor-of-place | Not present | M |
| P2-6 | **Achievements / milestones** | Notable deeds, bardic songs, chronicle entries | Not present | S |
| P2-7 | **Martial arts / styles** | Sword schools (Italian, German, English), wrestling styles | partial in Combat | M |
| P2-8 | **Activity interrupts** | Combat interrupts prayer, illness interrupts work, fire interrupts sleep | n/a — needs event bus priority | M |
| P2-9 | **NPC dialogue trees** | Tavern talk, confession, courtly speech, market haggling | Not present (Enhanced UI commands only) | XL |
| P2-10 | **Siege mechanics** | Siege camps, sapping, trebuchet, battering ram, starvation siege | partial in `Warfare.js` | L |
| P2-11 | **Mounted combat** | Lance, bow-from-horseback, cavalry charges | partial in Combat | M |
| P2-12 | **Sound propagation** | Acoustic range, line-of-sound, shouting, stealth | partial in `Perception.js` | M |
| P2-13 | **Ranged aim/concealment** | Lighting, smoke, cover, body silhouette at distance | partial | M |
| P2-14 | **Pain propagation / shock** | Pain → heart rate → blood pressure → consciousness | partial in Physiology | S |
| P2-15 | **Circadian rhythm** | Wake/sleep cycle, melatonin analog, shift-work exhaustion | Not present | S |
| P2-16 | **Hormones / endocrine** | Stress hormones (cortisol analog), adrenaline, fertility cycle | partial | M |
| P2-17 | **Microbiome** | Gut flora, fermented foods, dysentery, immunity | Not present | L |
| P2-18 | **Furniture / appliances** | Bed, table, chest, oven, anvil, spinning wheel, loom | partial in `Buildings.js` | M |
| P2-19 | **Repair / maintenance** | Tool wear, sharpening, oiling, patching, thatching | partial in `Production.js` | M |
| P2-20 | **Quality vectors** | Multiple axes (sharpness, durability, beauty, smell, toxicity) | partial in Crafting | M |
| P2-21 | **Procedural world extras** | Caves, ruins, barrows, standing stones, ley lines | partial in `ProceduralPipeline.js` (683 LOC stub) | XL |
| P2-22 | **Etiquette / taboo** | Cultural offense, honor, guest-right, blood-feud | partial in `Culture.js` | M |
| P2-23 | **Currency debasement** | Coin clipping, counterfeiting, Gresham's Law | partial in `Markets.js` | M |
| P2-24 | **Espionage** | Spy network, dead drops, coded letters | partial in `Politics.js` | XL |
| P2-25 | **Astronomy / weather forecasting** | Astrologer, saint's day omens, lunar cycles | partial | M |
| P2-26 | **Disability aids** | Crutches, peg leg, walking stick, eyeglasses, sign language | partial in `Disability.js` (510 LOC) | M |
| P2-27 | **Mental health** | Melancholia, lovesickness, religious mania, PTSD, possession | Not present | L |
| P2-28 | **Addiction** | Alcohol, opium, henbane, absinthe, fasting mania | Not present | M |
| P2-29 | **Reputation gossip** | Claim-based rep, observer-specific, propagation | partial in `Reputation.js` | M |
| P2-30 | **Status hierarchies** | Lord/vassal, master/apprentice, guild rank, clerical rank | `Titles.js` partial | M |

---

## Recommended build order

If you want to start building right after this roadmap is signed off, here's
a dependency-respecting sequence:

1. **P0-1, P0-2** (S+S) — un-wire Communication + Language. Pure win, 1 day.
2. **P0-5, P0-6** (M+M) — sanitation + clothing layer. Pathogens become meaningful.
3. **P1-3** (L) — ranged combat (crossbows/bows). Biggest gameplay-add for medieval.
4. **P1-7, P1-10** (M+L) — cooking + animal husbandry. Loops close.
5. **P1-5** (XL) — NPC follower/camp. Largest single feature.
6. **P1-1, P1-2** (L+L) — prosthetics + divine curses. Unlocks magic/cursed items.
7. **P1-6, P1-8** (M+M) — traps + weather. Outdoor survival.
8. **P0-3** (L) — real physics. Required for ranged to be satisfying.
9. **P2-21** (XL) — procedural world extras. Caves/ruins give exploration.
10. Everything else in P2 in any order.

---

## Test gating

Each P0/P1 system must add at least one new test file under `tests/`. Test
naming: `tests/<system-slug>.test.js`. No test = no ship.

Existing test layout (44 tests passing across 12 files) is the baseline.

---

## What we're explicitly NOT doing

- No bionics-as-tech (only prosthetics-as-craft)
- No guns-as-primary (bows/crossbows/slings/javelins only)
- No mutation-as-irradiation (only curse/blessing/lycanthropy)
- No electricity-grid (alchemy + clockwork + water/wind power)
- No post-apocalyptic scenario framing (the world is a medieval kingdom)
- No turn-based-per-second combat (C:DDA's sub-system); we keep 1-minute turns

---

## Open questions for the user

### Locked answers (2026-07-11)

1. **Blackpowder firearms:** Default to **strict medieval** — bows/crossbows/
   slings/javelins/atlatl only, no gunpowder weapons for personal combat.
   Siege artillery (bombards, trebuchets) remains allowed via Warfare system.
   Quality over breadth: whatever gets built must be high-quality, not thin.

2. **Lycanthropy/divine curses:** **Hybrid model.** Two pathways:
   - (a) **Random events** happen TO the player/NPCs (sacrilege, werewolf bite,
     saint's intervention, fairy bargain).
   - (b) **Skill-gated seeking**: once the player/NPC discovers a curse/blessing
     source, they may voluntarily pursue it. Requires Religion, Occultism, or
     Wilderness skill tier as gating.
   Discovery + commitment choice. No pure toggle.

3. **Prosthetic fitting:** **Manual Enhanced UI command.** Player invokes
   `fit prosthetic <type>` and chooses target limb + prosthetic + craftsman.
   Full player agency. No auto-fitting.

4. **NPC follower/retinue cap:** **Two-tier system.**
   - **Tier 1 — Sworn companions:** up to **5**, direct command, full agency,
     tactical micro-management, dialogue trees, personal quests.
   - **Tier 2 — Household/retinue:** up to **50**, indirect command via chain
     of command (captain, sergeant, etc.), bulk orders, less granular control.
   Noble-tier characters only for tier-2 (status-gated).

### Answers pending
- None. P0-1 and P0-2 are wired in (Communication.update and
  Language.update both run from Game.advanceTurns without try/catch as of
  v0.2.0); P0-5/P0-6/P1-3 still unblocked.