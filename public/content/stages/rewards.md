---
id: rewards
title: Stage Rewards & Scaling
description: What every Slayer Legend stage pays online and idle, how fast enemy health and rewards actually grow, when each currency starts and caps, and why gold per kill is a misleading number.
tags:
  - stages
  - rewards
  - farming
  - progression
category: Stages
date: 2026-08-28
order: 2
---

# <span class="text-gray-900 dark:text-gray-100">What a Stage Pays</span>

Every stage on the road carries two separate reward profiles.

**Online, you are paid per kill.** Each monster you drop can give:

- <img src="/images/content/goods/Goods_Gold.png" alt="" class="inline-image" style="display: inline-block; vertical-align: middle;width: 26px; height: 26px; margin: -4px 0 0 0;" data-inline="true" /> **Gold** - every kill, always
- <img src="/images/content/goods/Goods_Exp.png" alt="" class="inline-image" style="display: inline-block; vertical-align: middle;width: 26px; height: 26px; margin: -4px 0 0 0;" data-inline="true" /> **EXP** - every kill, always
- <img src="/images/content/goods/EnchantCube 1_1.png" alt="" class="inline-image" style="display: inline-block; vertical-align: middle;width: 26px; height: 26px; margin: -4px 0 0 0;" data-inline="true" /> **Enhancement Cubes** - on roughly a one-in-ten chance
- <img src="/images/content/goods/Goods_AllStone.png" alt="" class="inline-image" style="display: inline-block; vertical-align: middle;width: 26px; height: 26px; margin: -4px 0 0 0;" data-inline="true" /> **Attribute Stones** - on a small per-kill chance that grows with stage number
- An **equipment drop** - a weapon or accessory, on a chance under one percent

**Idle, you are paid per unit of time**, across seven resources at once: gold, EXP, cubes, attribute stones, <img src="/images/content/goods/Goods_Dice_1.png" alt="" class="inline-image" style="display: inline-block; vertical-align: middle;width: 26px; height: 26px; margin: -4px 0 0 0;" data-inline="true" /> dice, <img src="/images/content/goods/Goods_SoulWhite.png" alt="" class="inline-image" style="display: inline-block; vertical-align: middle;width: 26px; height: 26px; margin: -4px 0 0 0;" data-inline="true" /> souls and <img src="/images/content/goods/Goods_Diamond.png" alt="" class="inline-image" style="display: inline-block; vertical-align: middle;width: 26px; height: 26px; margin: -4px 0 0 0;" data-inline="true" /> diamonds. Idle is not a gold-and-EXP-only mode, and treating it as one is the most common way players undervalue depth.

And clearing a stage - once, permanently - raises your **Stage Gold multiplier** and pays a lump of dice.

# <span class="text-gray-900 dark:text-gray-100">Why "Gold Per Kill" Is a Trap</span>

This is the most important thing on this page, and it is not obvious from the tables.

Look at gold per kill across a single chapter and it appears to lurch wildly - here is Underwater Cave, stages 801-820:

| Stage | Wave | Gold / Kill | Gold per **wave** |
|---|---|---|---|
| 801 | 12 | 10.1B | 121B |
| 803 | **4** | **30.4B** | 122B |
| 805 | 10 | 12.2B | 122B |
| 809 | **18** | **6.9B** | 124B |
| 811 | **4** | **31.0B** | 124B |
| 815 | 18 | 7.0B | 125B |
| 820 | 16 | 7.9B | 127B |

Gold per kill swings by more than **4.5×** inside twenty stages. Gold per *wave* rises smoothly from 121B to 127B and never once goes backwards.

That is not a coincidence, and it holds for the entire road. Across all 1,376 measured stages, **gold per wave increases on 1,374 of 1,375 stage-to-stage transitions**, while gold per kill falls on 282 of them. EXP behaves the same way. In other words:

> **A stage pays a fixed amount per wave. Wave size only decides how that amount is sliced up.** A four-monster stage does not pay more - it pays the same, in bigger pieces.

The practical consequence is that chasing high gold-per-kill stages is chasing nothing. What actually differs between stages is **how fast you can clear a wave**. A four-monster wave is four kills to bank the payout; an eighteen-monster wave is eighteen. If your build clears both instantly, they are worth the same, and you should simply farm the deepest stage you can clear instantly. If your build is slow, small waves bank faster - and that, not the gold-per-kill column, is the real argument for them.

This also quietly explains why the community's per-chapter "best farming stage" folklore exists: in 56 of the 58 chapters between stages 201 and 1,360, the highest gold-per-kill stage is *not* the last stage of the chapter. It is wherever the wave happens to be smallest.

## <span class="text-gray-900 dark:text-gray-100">The other half: drops don't work that way</span>

Everything above applies to gold and EXP. **Drops behave in exactly the opposite way**, and the contrast is the single most useful thing to understand about farming.

Enhancement cubes, attribute stones and equipment are all rolled **per kill**, at a chance that is fixed for the whole chapter regardless of wave size. Across stages 801-820 the equipment drop chance is 0.116% on every single stage, while the wave swings between 4 and 18. So a wave of eighteen rolls that chance eighteen times; a wave of four rolls it four times.

| Reward | How it is paid | Effect of a bigger wave |
|---|---|---|
| Gold, EXP | A fixed budget **per wave**, divided among the monsters | **No change** to income - only smaller, more frequent chunks |
| Cubes, attribute stones, equipment | An independent roll **per kill** | **Strictly more** of them, in proportion to wave size |

That is the whole mechanic behind the community advice to farm small waves for gold and large waves for materials. It is not a preference or a rule of thumb - it falls straight out of how the two reward types are defined. If you are farming gold, wave size is irrelevant and only clear speed matters. If you are farming cubes, stones or gear, **wave size is the entire game** and an eighteen-monster stage is worth four and a half of a four-monster one.

# <span class="text-gray-900 dark:text-gray-100">How Fast the Road Grows</span>

Enemy health, boss health and boss attack all scale together, and the rate changes character sharply across the game:

| Stages | Enemy HP growth | Per twenty-stage chapter | What it feels like |
|---|---|---|---|
| 1-200 | **×1.27 per stage** | ×110-135 | Violent. Your stats have to multiply constantly just to stand still. |
| 201-300 | ×1.09 per stage | ×5.4 | The curve breaks. Progress starts feeling earned rather than gated. |
| 301-500 | ×1.04-1.05 per stage | ×2.1-2.7 | The flattest stretch of the entire game. |
| 501-1,376 | **×1.06 per stage** | **×3.3** | Locked. The same rate, unbroken, for over eight hundred stages. |

Boss health is a multiple of regular monster health, and it steps:

| Stages | Boss HP multiple |
|---|---|
| 1 | 5× |
| 2-140 | about 20× |
| 141-500 | a continuous ramp from 20× up past 400× |
| **501-1,376** | **locked at 500×** |

So for three quarters of the road, a boss is exactly five hundred ordinary monsters stacked into one health bar with a timer attached. If you can clear a wave comfortably but the boss beats you, the gap is burst damage, not sustained damage.

# <span class="text-gray-900 dark:text-gray-100">When Each Dial Starts and Stops</span>

Most of the stage table's variables lock permanently at some point, and knowing where saves a lot of wondering whether something is still improving.

| Stage | What happens |
|---|---|
| **2** | Diamonds begin appearing in idle rewards |
| **28** | Dice begin appearing in idle rewards |
| **141** | **Souls** first appear in idle rewards |
| **221** | Equipment drop rarity reaches **Legendary 3** and never improves again |
| **321** | Idle diamonds cap at 6 |
| **441** | Enemy attack speed locks at 0.6 |
| **501** | Boss health locks at 500× monster health |
| **521** | Dice per clear cap at 20 |
| **827** | Attribute stone chance caps at 1.725% |
| **1,001** | Equipment drop chance locks at 0.118% |

What is *still* climbing at stage 1,376, with no ceiling in sight: gold, EXP, enhancement cubes (15 per kill at stage 1, 1,500 by stage 1,376), souls, and the Stage Gold clear multiplier. Those five are the entire reason to keep pushing in the back half of the game.

# <span class="text-gray-900 dark:text-gray-100">The Stage Gold Ladder</span>

Clearing a stage permanently raises your Stage Gold multiplier - the game shows it as *"Clear benefit: Stage Gold x N"*. It holds at ×1 for the first 89 stages, then steps up **+0.2 roughly every ten stages** for the rest of the road, with no cap found:

| Stage | Multiplier | | Stage | Multiplier |
|---|---|---|---|---|
| 1-89 | ×1 | | 600 | ×11.1 |
| 120 | ×1.4 | | 800 | ×15.1 |
| 200 | ×3.1 | | 1,000 | ×19.1 |
| 400 | ×7.1 | | 1,376 | ×26.5 |

This is why pushing stages you have no intention of farming is still worth the trip. Ten stages you clear once and abandon still make every future gold reward permanently larger.

# <span class="text-gray-900 dark:text-gray-100">Souls Are the Second-Half Currency</span>

Souls are worth their own section because their growth is unlike anything else on the road. They do not exist at all until stage 141, and then:

| Stage | Idle souls |
|---|---|
| 141 | 1 |
| 300 | 46 |
| 600 | 6,030 |
| 900 | 505,000 |
| 1,200 | 1.19 × 10⁸ |
| 1,360 | 1.28 × 10⁹ |

That is roughly a billion-fold increase across the back three quarters of the game, and it is almost entirely idle income. [Soul weapon](/equipment/soul-weapons) progression is therefore gated far more on **how deep you can comfortably park** than on how much you actively play. The highest stage you can idle at safely is worth more than the highest stage you can barely survive.

# <span class="text-gray-900 dark:text-gray-100">So Where Should You Farm?</span>

1. **Push as deep as you can clear**, because the Stage Gold multiplier, idle soul rate and every per-wave payout all key off stage number and none of them ever go backwards.
2. **Then drop back to wherever kills are instant.** Gold per wave is fixed, so the only variable you control is how many waves per minute you bank.
3. **Prefer the lowest stage of your furthest region** as a default parking spot - it is the deepest reward tier you have unlocked at the easiest difficulty inside that tier.
4. **Ignore the gold-per-kill column** when comparing stages. Compare wave clear speed instead.
5. **Match the wave to the goal.** Farming gold or EXP: wave size is irrelevant, take the fastest clear. Farming cubes, stones or gear: take the biggest wave you can still clear quickly, because every extra monster is another roll.
6. When you stop moving, the answer is almost never more farming at the same stage - it is a [promotion](/character/promotions), a class grade, or a [skill](/skills) upgrade.

See the [farming loop](/resources/farming) for how a full daily rotation fits around this, and [stage milestones](/stages/milestones) for what pushing actually unlocks.
