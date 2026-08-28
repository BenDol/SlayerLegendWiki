---
id: mechanics
title: Stage Mechanics
description: How a Slayer Legend stage is actually built - chapters, areas and zones, monster waves, the boss challenge, the three combat dials, and how idle rewards are decided.
tags:
  - stages
  - mechanics
  - progression
category: Stages
date: 2026-08-28
order: 1
---

# <span class="text-gray-900 dark:text-gray-100">The Shape of the Road</span>

The main game is one long road, and it has a strict grammar. Three words describe every position on it, and the game uses all three in its own interface:

- A **chapter** - shown in game as a **region** name like *Beginning Forest* or *Corridor of the Blue Boundary* - is always **exactly twenty stages**. No exceptions anywhere on the road.
- An **area** is a named place inside a chapter. Early chapters are patchworks of five or six areas; from around chapter 33 onward a chapter is almost always a single area sharing the region's name.
- A **zone** is the Roman numeral after the area name. *Beginner's Ground III* is zone III of that area. Late chapters run a single area straight through zones I to XX.

The game client currently defines **83 named chapters, covering stages 1 to 1,660**, plus two further chapter slots that exist in the client but have not been given names yet - the clearest available signal that the road is still being extended. Separately from the numbered road, the client also carries a twenty-stage block named **Memory of Star**, which sits outside the 1-1,660 sequence entirely.

That growth has been steady and public: patch notes raised the ceiling to stage 640, then 700, then 740, then added regions at 840 and 900. If you have played for a while and remember the road ending somewhere much earlier, you are not misremembering.

# <span class="text-gray-900 dark:text-gray-100">Inside a Stage</span>

A stage is a repeating hunt plus a gate.

**The hunt.** Monsters spawn in waves. The game shows the size directly - *Monsters per wave: N* - and that number is genuinely a property of the stage, not a constant. Across the measured stages it takes the values 4, 6, 8, 10, 12, 14, 16 and 18, usually holding for a run of two to five consecutive stages before changing. Stage 1 is the only one-monster stage in the game; eighteen first appears at stage 186 and is the largest wave the road ever throws.

Wave size is the single biggest reason a farming loadout looks nothing like a pushing loadout. On an eighteen-monster stage an area-of-effect skill is doing eighteen times the work of a single-target one; on a four-monster stage it is doing four.

> The community's translated Master Guide describes wave size as something you *choose* per stage from three presets - roughly four monsters for more gold, eight for balance, eighteen for more dice, stones and cubes - and notes the wave counter is not displayed until after stage 160. The datamined table this wiki is built from records a single wave size per stage, including values (6, 10, 12, 14, 16) that are not any of those three presets. Both can be true if the presets shift a stage's base wave size, but we have not been able to confirm how the two interact. Treat the wave column in the stage tables as the stage's recorded value, not as a promise about what your screen will show.

**The gate.** Each stage is capped by a boss. The client's own wording is blunt about the rule: *"Eliminate previous stage's Boss to open"*, and for the chapter boundary, *"Can enter when you clear Area 5 of the previous stage."* The boss encounter runs against a clock - beat it inside the time limit and the stage is cleared and the next one opens; fail and you stay where you are and can try again.

Failing costs you nothing but time, which is the important thing to internalise. Because every reward in the game scales with your stage number, sitting one stage below a boss you cannot beat is never wasted - you are farming at the best rate you have access to while you build the stats to pass it.

**What clearing gets you, permanently.** Clearing is not just a key to the next door. The client states that you *"Gain more EXP on the battlefield with each stage you clear"*, that the daily Black Mana allowance *"increases according to the highest stage cleared"*, and that *"the auto hunting reward is determined by the highest reached stage."* Depth is a permanent account-wide multiplier, not just a location.

# <span class="text-gray-900 dark:text-gray-100">The Three Combat Dials</span>

Beyond raw health and attack, every stage carries three numbers that decide how the fight actually feels.

| Dial | What it is | How it behaves |
|---|---|---|
| **Attack speed** | How often enemies swing | Only seven distinct values ever appear (2, 1.5, 1.3, 1, 0.9, 0.8, 0.6). It moves around a great deal for the first 440 stages, then **locks at 0.6 from stage 441** and never changes again for the rest of the measured road. |
| **Miss** | The enemy miss value | Climbs from 1 to roughly 290 over the road, but not smoothly - it falls as often as it rises from one stage to the next. |
| **Accuracy** | The enemy accuracy value | Climbs from 60 to roughly 935, and is just as noisy. |

Miss and accuracy are worth calling out because they are the two stats on the road that genuinely never settle. Around four transitions in ten *decrease* rather than increase. A stage that feels harder than the one after it is not always an illusion.

# <span class="text-gray-900 dark:text-gray-100">Online Hunting vs. Idle Rewards</span>

Every stage carries two separate reward profiles, and the game tracks them as different columns entirely.

**Online**, you are paid per kill: gold, EXP, and enhancement cubes on roughly a one-in-ten chance, plus rolls on attribute stones and equipment drops. More kills means more of everything, so wave size and clear speed matter enormously.

**Idle**, you are paid per unit of time - the client describes it as a *"Reward to be obtained by time unit when the stage is cleared"* - across seven separate resources: gold, EXP, enhancement cubes, attribute stones, dice, souls and diamonds. This is the part players most often underestimate. Idle income is not gold and EXP only; **souls** in particular become the dominant idle resource in the second half of the road, and souls are what feed [soul weapons](/equipment/soul-weapons).

The practical rule the community converged on, and which the numbers support: **park at the lowest stage of the furthest region you have reached** rather than at the deepest stage you can technically survive. Rewards scale with stage number, but only if you are actually killing things quickly - a stage where kills are instant beats a deeper one where you grind.

# <span class="text-gray-900 dark:text-gray-100">The Clear Bonus</span>

Every stage carries a permanent gold multiplier, shown in game as *"Clear benefit: Stage Gold x N"*. It is a step function, and it is one of the strongest reasons to keep pushing even when a stage has nothing else to offer you.

It sits at ×1 for the first 89 stages, and from stage 90 it steps up by **+0.2 roughly every ten stages**, without ever stopping: ×1.4 at stage 120, ×3.1 at 200, ×7.1 at 400, ×11.1 at 600, ×15.1 at 800, ×19.1 at 1,000, and ×26.5 by stage 1,376. Pushing ten stages you cannot farm efficiently still permanently improves every gold reward you will ever earn.

Stages also pay **dice** on clear, climbing from 5 at the start of the game to a maximum of **20 from stage 521 onward**.

# <span class="text-gray-900 dark:text-gray-100">Reading the Stage Data</span>

The per-stage tables in this section come from two different places, and they deserve different amounts of trust.

**Names are authoritative.** Every region, area and zone name on this wiki is read directly out of the game client's own localization table, which is why chapters past 640 have proper names here even though community spreadsheets leave them blank. Where the client and older fan resources disagree, the client wins - the clearest case is stage 201-220, which fan sheets have long listed as *"Asian North Coast"* but which the game itself calls **Aslan North Coast**, matching the Korean 아슬란 and the official *Aslan festival* event name.

The client is not infallible, though. Its English strings for stages 1,541-1,560 read *"Eternity Garden"*, repeating the previous chapter, while the Korean strings correctly say 피어나는 도원 - **Blooming Peach Garden**, which is also what the chapter itself is called. We publish the correct name.

**Numbers stop at stage 1,376, and the tables stop at 1,360.** The combat and reward figures come from the community's datamined spreadsheet, and that source has a hard edge. From **stage 1,377 onward, enemy HP, boss HP and boss attack stop producing new values entirely** and simply repeat whatever they were twenty stages earlier - stage 1,500, 1,600, 1,700, 1,800, 1,900 and 2,000 all report identical figures, because they are all the same recycled row. The boss icon column collapses to a placeholder over the same stretch. This is a limitation of the source data, not a design feature of the game, so rather than republish recycled numbers as if they were measured, the stage tables here stop where the trustworthy data does.

Because a chapter is twenty stages and is only worth tabulating when all twenty are covered, the published tables end with chapter 68 at **stage 1,360** rather than mid-chapter at 1,376. Chapter 69 (stages 1,361-1,380) straddles the edge - its first sixteen stages are genuine and its last four are recycled - so it is listed by name along with everything deeper.

A few smaller flaws in the same source are worth knowing about if you compare against it directly: the equipment rarity ladder briefly runs backwards around stages 83-100 (Epic 4 → Epic 3 → Epic 4 again), the gold-factor ladder skips ×1.5 entirely between stages 129 and 130, and the Roman numerals for stages 411-420 are malformed in the sheet. The names on this wiki come from the client and are unaffected.

# <span class="text-gray-900 dark:text-gray-100">Where to Go Next</span>

- [Stage rewards and scaling](/stages/rewards) - what a stage actually pays, and how fast the curve grows
- [Equipment drops by stage](/stages/drops) - the full rarity ladder and where each tier appears
- [Stage milestones](/stages/milestones) - what unlocks at which stage
- [The full stage list](/stages) - every chapter, with per-stage tables
