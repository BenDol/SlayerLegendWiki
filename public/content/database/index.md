---
id: index
title: Database
description: The wiki's reference data for Slayer Legend - the Skill Database today, the game data files behind every builder, where the numbers come from, and how to correct them.
tags:
  - database
  - reference
  - data
category: Database
date: 2026-09-14
order: 0
---

# <span class="text-gray-900 dark:text-gray-100">The Database Section</span>

Most of the wiki explains systems. This section publishes the raw numbers behind them, laid out as tables you can scan and compare rather than prose you have to read. The first and largest entry is the [Skill Database](/database/skills): all 46 skills with element, MP cost, cooldown, level cap, and the base value and per-level growth of every effect, grouped by grade from Common to Immortal, with notes on the skills that break the usual rules.

# <span class="text-gray-900 dark:text-gray-100">Where the Numbers Come From</span>

The wiki keeps its game data in structured files - skills, soul weapons, spirits, companions, relics, promotions, and the stage tables - and the interactive tools read those files directly. The [Skill Builder](/skill-builder) plans a bar from the same skill entries this section tabulates; the [Spirit Builder](/spirit-builder) calculates with the same spirit values the [Spirit Information](/spirits/information) page describes; the [Stages](/stages) pages are generated from the stage dataset rather than typed by hand. The reference tables on this section's pages are written from those same files by the same contributors, so when a patch changes a value the correction is made once in the data and carried to the tables that cite it.

Provenance matters, and the pages say what they know. Skill and equipment values are taken from the game and checked against it; the per-stage combat figures come from the community's datamined spreadsheet, which is reliable up to stage 1,376 and is not republished beyond that point - [Reading the stage data](/stages/mechanics) explains exactly where that dataset stops and why the tables stop with it.

# <span class="text-gray-900 dark:text-gray-100">How to Use a Data Page</span>

Start from the decision, not the table. If you want to know which active to level first, the [Skill Database](/database/skills)'s "Reading the Numbers" section explains what MP, cooldown and the per-level growth mean in practice before you compare rows. If you are planning a whole build, open the matching tool - the database pages link to them - and use the table to understand *why* the tool's totals move the way they do. The numbers are the same in both places; the table is for understanding, the tool is for trying things.

# <span class="text-gray-900 dark:text-gray-100">Correcting a Value</span>

Every table here is community-maintained. If a number no longer matches your game after a patch, [edit the page](/meta/contributing): note the value you see in-game and the game version, and a reviewer checks it before it publishes. Corrections to values that also feed a tool are applied to the underlying data file so the builder and the table stay in step.
