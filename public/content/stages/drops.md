---
id: drops
title: Equipment Drops by Stage
description: The full Slayer Legend equipment drop ladder - which rarity drops at which stage, the weapon and accessory cycle, drop rates, and why gear stops improving at stage 221.
tags:
  - stages
  - equipment
  - drops
  - farming
category: Stages
date: 2026-08-28
order: 3
---

# <span class="text-gray-900 dark:text-gray-100">How Stage Drops Work</span>

Every monster you kill rolls independently for an equipment drop. The chance is small - it never exceeds half a percent anywhere on the road, and for most of the game it sits near a tenth of a percent - but it is a **per-kill** roll, not a per-wave one, and that matters more than the number itself.

Because the roll is per kill and the rate is fixed across a whole chapter, **wave size is a direct multiplier on how much gear you see**. An eighteen-monster stage rolls the drop table eighteen times per wave; a four-monster stage rolls it four times, at exactly the same rate. If you are farming for gear, take the biggest wave you can still clear quickly. (Gold works in precisely the opposite way - see [why gold per kill is a trap](/stages/rewards).)

What drops is decided entirely by the stage, not by luck:

- **The type follows a strict four-to-one cycle.** Every stage whose number is a multiple of five drops **accessories**; every other stage drops **weapons**. This holds without a single exception across all 1,376 measured stages. Stage 5, 10, 15, 20 and so on are accessory stages; everything else is a weapon stage.
- **The rarity is fixed per stage.** There is no roll for quality. Whatever tier the stage is assigned is the tier you get, every time.

# <span class="text-gray-900 dark:text-gray-100">The Rarity Ladder</span>

Nineteen rarity bands appear across the road, and almost all of them are packed into the first two hundred stages:

| Rarity | Stages | Length |
|---|---|---|
| <span class="text-gray-400 dark:text-gray-300">**Common 4**</span> | 1-5 | 5 |
| <span class="text-gray-400 dark:text-gray-300">**Common 3**</span> | 6-10 | 5 |
| <span class="text-gray-400 dark:text-gray-300">**Common 2**</span> | 11-15 | 5 |
| <span class="text-gray-400 dark:text-gray-300">**Common 1**</span> | 16-20 | 5 |
| <span class="text-green-800 dark:text-green-600">**Great 4**</span> | 21-25 | 5 |
| <span class="text-green-800 dark:text-green-600">**Great 3**</span> | 26-30 | 5 |
| <span class="text-green-800 dark:text-green-600">**Great 2**</span> | 31-35 | 5 |
| <span class="text-green-800 dark:text-green-600">**Great 1**</span> | 36-42 | 7 |
| <span class="text-orange-800 dark:text-orange-600">**Rare 4**</span> | 43-49 | 7 |
| <span class="text-orange-800 dark:text-orange-600">**Rare 3**</span> | 50-56 | 7 |
| <span class="text-orange-800 dark:text-orange-600">**Rare 2**</span> | 57-63 | 7 |
| <span class="text-orange-800 dark:text-orange-600">**Rare 1**</span> | 64-70 | 7 |
| <span class="text-purple-600 dark:text-purple-400">**Epic 4**</span> | 71-82 | 12 |
| <span class="text-purple-600 dark:text-purple-400">**Epic 3**</span> | 83-88 | 6 |
| <span class="text-purple-600 dark:text-purple-400">**Epic 4** *(again)*</span> | 89-100 | 12 |
| <span class="text-purple-600 dark:text-purple-400">**Epic 2**</span> | 101-114 | 14 |
| <span class="text-purple-600 dark:text-purple-400">**Epic 1**</span> | 115-146 | 32 |
| <span class="text-red-600 dark:text-red-400">**Legendary 4**</span> | 147-220 | 74 |
| <span class="text-red-600 dark:text-red-400">**Legendary 3**</span> | **221 onward** | **the rest of the game** |

**Legend: | <span class="text-gray-400 dark:text-gray-300">Common</span> | <span class="text-green-800 dark:text-green-600">Great</span> | <span class="text-orange-800 dark:text-orange-600">Rare</span> | <span class="text-purple-600 dark:text-purple-400">Epic</span> | <span class="text-red-600 dark:text-red-400">Legendary</span>**

Two things stand out.

**The bands stretch relentlessly.** Common tiers last five stages each. Epic 1 lasts thirty-two. Legendary 4 lasts seventy-four. And Legendary 3 lasts for the remaining eleven hundred stages of the measured road.

**Gear stops improving at stage 221.** From there to the end of the game, every equipment drop is Legendary 3. Legendary 2 and Legendary 1 do not appear as stage drops anywhere - and the game's own equipment drop table lists only eighteen rarities, stopping at Legendary 3, which confirms this is a real ceiling rather than a gap in the data.

That is the single most consequential fact on this page. **After stage 221, deeper stages do not give you better gear.** Everything past that point comes from [enhancement](/equipment/enhancement), [fusion](/equipment/fusion) and [soul weapons](/equipment/soul-weapons) instead - and stage depth only matters for gear insofar as it pays for those.

> **A known flaw in the source data.** The ladder briefly runs backwards: Epic 4 covers stages 71-82, then Epic 3 covers 83-88, then it returns to **Epic 4** for 89-100 before advancing to Epic 2. That regression is almost certainly a transcription error in the community spreadsheet these figures come from rather than real game behaviour. It is reproduced here as recorded rather than silently corrected, but treat stages 83-100 as "somewhere in Epic" rather than as a precise claim.

# <span class="text-gray-900 dark:text-gray-100">Drop Rates</span>

The drop chance itself is genuinely noisy for the first hundred and fifty stages or so, swinging between 0.03% and 0.5%, before settling into a rising step function that converges on a permanent value:

| Stage | Drop chance |
|---|---|
| 5 | 0.5% *(the highest anywhere on the road)* |
| 100 | 0.2% |
| 200 | 0.13% |
| 300 | 0.045% |
| 500 | 0.095% |
| 700 | 0.113% |
| 900 | 0.117% |
| **1,001 onward** | **0.118%, locked for the rest of the road** |

Averaged out, the first two hundred stages actually drop gear slightly more often (0.142%) than the deep game does (0.118%). Combined with the rarity ceiling, this means the flood of equipment you remember from early play is not nostalgia - the early game genuinely is where the drops are, both in variety and in frequency.

Attribute stones follow a much cleaner curve, rising steadily from 0.5% per kill at stage 1 to a cap of **1.725% from stage 827** onward. Enhancement cubes come on roughly a one-in-ten kill and their yield never stops climbing - 15 per drop at stage 1, 510 by stage 200, 1,310 by stage 1,000, and 1,500 by stage 1,376.

# <span class="text-gray-900 dark:text-gray-100">What to Do With Drops</span>

Stage drops are raw material, not an endgame. The pipeline is:

1. **Fuse upward.** Five items of one grade combine into one of the next - so five Legendary 3 drops become the material for progress rather than clutter. See [fusion](/equipment/fusion).
2. **Enhance what you keep.** Gold and cubes go much further than drop luck ever will. See [enhancement](/equipment/enhancement).
3. **Disassemble the rest.** Everything you are not fusing or wearing is disassembly income.

Separately from the drop table, clearing stages also yields **soul weapon blueprints** - the game's own wording is *"Clear Stage to obtain Soul Weapon Blueprint"* - which is a second, entirely different reason for pushing depth. Soul weapon crafting opens at stage 80, and new weapon tiers appear roughly every twenty stages from there. See [soul weapons](/equipment/soul-weapons).

# <span class="text-gray-900 dark:text-gray-100">Related</span>

- [Weapons](/equipment/weapons) and [accessories](/equipment/accessories) - what the drops actually are
- [Stage rewards and scaling](/stages/rewards) - the per-wave and per-kill split explained in full
- [The full stage list](/stages) - per-stage drop type and rarity for every chapter
