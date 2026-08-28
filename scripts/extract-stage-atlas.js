/**
 * Extract the authoritative stage atlas (chapter/region names, per-stage area and zone
 * names) from the Slayer Legend client's own localization table, and use it to correct
 * and complete public/data/stages.json.
 *
 * The client stores localization in the Unity `sharedassets0` splits as a flat run of
 * records: one KEY followed by 13 localized values, each stored as an int32-LE byte
 * length followed by UTF-8 bytes, padded to 4-byte alignment. The keys we care about:
 *
 *   STAGE_NAME_TITLE_nnn  -> chapter (region) name, chapter index nnn
 *   STAGE_NAME_nnn        -> "<Area> <Zone>" for stage index nnn (stageNo - 1)
 *
 * Every chapter is exactly 20 stages, so chapter = floor((stageNo - 1) / 20) + 1.
 *
 * The game assets are NOT part of this repository (`external/` is gitignored), so this
 * is an offline maintenance tool: run it when a new client build is unpacked to refresh
 * the committed data, then commit the regenerated JSON. It exits cleanly with a notice
 * when the assets are absent, so it is safe to invoke from any environment.
 *
 * Usage: node scripts/extract-stage-atlas.js [--dry-run]
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.join(__dirname, '..');

const ASSET_SUBPATH = 'external/decompiled/main_apk/assets/bin/Data';
const SPLIT_RE = /^sharedassets0\.assets\.split(\d+)$/;
const STAGES_JSON = path.join(ROOT, 'public/data/stages.json');
const CHAPTERS_JSON = path.join(ROOT, 'public/data/stage-chapters.json');

const STAGES_PER_CHAPTER = 20;
const VALUES_PER_KEY = 13;
const LANGS = ['ko', 'en', 'ja', 'zh-Hans', 'zh-Hant', 'vi', 'th', 'fr', 'de', 'es', 'it', 'ru', 'pt'];
const KEY_RE = /^[A-Z][A-Z0-9_]{2,120}$/;
const ZONE_RE = /\s+([IVXL]+|\d+(?:st|nd|rd|th)\s+Floor)$/;
const ANCHOR_KEY = 'STAGE_NAME_TITLE_000';
const MAX_STRING_BYTES = 4000;
const MAX_KEY_BYTES = 120;
const WALK_MISS_LIMIT = 64;
/** Zero-width characters the client's English strings contain (e.g. "Sea of <ZWSP>Star"). */
const INVISIBLE_RE = /[​-‍﻿]/g;

const dryRun = process.argv.includes('--dry-run');
/** The unpacked client lives outside the repo, so allow pointing at another checkout. */
const assetsArg = process.argv.find((a) => a.startsWith('--assets='));
const ASSET_DIR = assetsArg ? path.resolve(assetsArg.slice('--assets='.length)) : path.join(ROOT, ASSET_SUBPATH);

const clean = (s) => (s || '').replace(INVISIBLE_RE, '').replace(/\s+/g, ' ').trim();
const align = (p) => p + ((4 - (p % 4)) % 4);

function loadAssetBuffer() {
  if (!fs.existsSync(ASSET_DIR)) return null;
  const splits = fs
    .readdirSync(ASSET_DIR)
    .filter((f) => SPLIT_RE.test(f))
    .sort((a, b) => Number(a.match(SPLIT_RE)[1]) - Number(b.match(SPLIT_RE)[1]));
  if (splits.length === 0) return null;
  return Buffer.concat(splits.map((f) => fs.readFileSync(path.join(ASSET_DIR, f))));
}

function makeReader(buf) {
  const readString = (p) => {
    if (p < 0 || p + 4 > buf.length) return null;
    const len = buf.readInt32LE(p);
    if (len < 0 || len > MAX_STRING_BYTES || p + 4 + len > buf.length) return null;
    return { text: buf.toString('utf8', p + 4, p + 4 + len), next: align(p + 4 + len) };
  };

  const readRecord = (p) => {
    const key = readString(p);
    if (!key || !KEY_RE.test(key.text)) return null;
    const values = [];
    let q = key.next;
    for (let i = 0; i < VALUES_PER_KEY; i++) {
      const v = readString(q);
      if (!v) return null;
      values.push(v.text);
      q = v.next;
    }
    return { key: key.text, values, next: q };
  };

  return { readRecord };
}

/**
 * Collect every localization record. A forward walk from the anchor covers the main
 * contiguous run; a 4-byte-aligned sweep then picks up records the walk cannot reach,
 * since the table is not one unbroken block in every build.
 */
function readLocalization(buf) {
  const { readRecord } = makeReader(buf);
  const table = new Map();

  const anchor = buf.indexOf(Buffer.from(ANCHOR_KEY, 'utf8'));
  if (anchor < 0) throw new Error(`Localization anchor "${ANCHOR_KEY}" not found in ${ASSET_DIR}`);

  let p = align(Math.max(0, anchor - 4));
  let misses = 0;
  while (p < buf.length && misses < WALK_MISS_LIMIT) {
    const rec = readRecord(p);
    if (rec) {
      if (!table.has(rec.key)) table.set(rec.key, rec.values);
      p = rec.next;
      misses = 0;
    } else {
      p = align(p + 4);
      misses++;
    }
  }

  // Every key starts with an uppercase ASCII letter, so rejecting on that single byte
  // avoids decoding 14 length-prefixed strings at the vast majority of the ~8M offsets.
  for (let q = 0; q + 8 < buf.length; q += 4) {
    const len = buf.readInt32LE(q);
    if (len < 3 || len > MAX_KEY_BYTES) continue;
    const first = buf[q + 4];
    if (first < 0x41 || first > 0x5a) continue;
    const rec = readRecord(q);
    if (rec && !table.has(rec.key)) table.set(rec.key, rec.values);
  }

  return table;
}

const value = (table, key, lang = 'en') => {
  const rec = table.get(key);
  return rec ? clean(rec[LANGS.indexOf(lang)]) : null;
};

const stageNameKey = (i) => `STAGE_NAME_${i < 1000 ? String(i).padStart(3, '0') : String(i)}`;
const chapterTitleKey = (c) => `STAGE_NAME_TITLE_${String(c).padStart(3, '0')}`;

function buildAtlas(table) {
  const chapters = [];
  for (let c = 0; table.has(chapterTitleKey(c)); c++) {
    const name = value(table, chapterTitleKey(c), 'en');
    chapters.push({
      chapter: c + 1,
      name,
      nameKo: value(table, chapterTitleKey(c), 'ko'),
      // An empty `name` is the released/unreleased signal the generator keys off, so it
      // stays empty; `label` exists purely so browsing this data never shows a blank row.
      label: name || `Chapter ${c + 1} (unreleased)`,
      firstStage: c * STAGES_PER_CHAPTER + 1,
      lastStage: (c + 1) * STAGES_PER_CHAPTER,
    });
  }

  const stages = [];
  for (let i = 0; table.has(stageNameKey(i)); i++) {
    const full = value(table, stageNameKey(i), 'en');
    const m = full.match(ZONE_RE);
    const chapter = chapters[Math.floor(i / STAGES_PER_CHAPTER)];
    stages.push({
      stageNo: i + 1,
      chapter: chapter ? chapter.chapter : null,
      region: chapter ? chapter.name : '',
      area: m ? full.slice(0, m.index).trim() : full,
      zone: m ? m[1] : '',
    });
  }

  // Chapter slots the client defines but has not named yet are unreleased content.
  const named = chapters.filter((c) => c.name);
  const lastNamedChapter = named.length ? named[named.length - 1].chapter : 0;

  return { chapters, stages, lastNamedChapter };
}

/**
 * The community spreadsheet stops producing new combat values partway along the road and
 * then simply repeats the block from STAGES_PER_CHAPTER stages earlier, forever. Find the
 * first stage from which that repetition holds unbroken to the end of the sheet, so the
 * boundary is derived from the data instead of hardcoded in two places.
 */
function findLastVerifiedStage(rows) {
  const fields = ['enemyHP', 'bossHP', 'bossATK'];
  const repeats = (i) => fields.every((f) => rows[i][f] === rows[i - STAGES_PER_CHAPTER][f]);

  let firstRecycled = null;
  for (let i = STAGES_PER_CHAPTER; i < rows.length; i++) {
    if (repeats(i)) {
      if (firstRecycled === null) firstRecycled = rows[i].stageNo;
    } else {
      firstRecycled = null;
    }
  }
  return firstRecycled === null ? rows[rows.length - 1].stageNo : firstRecycled - 1;
}

/**
 * The client writes the same area name with inconsistent capitalisation in a handful of
 * places ("Predator Area" vs "Predator area"). Fold each spelling onto the variant the
 * client uses most often so a region's table reads as one place, not two.
 */
function normaliseAreaCasing(stages) {
  const spellings = new Map();
  for (const s of stages) {
    const k = s.area.toLowerCase();
    if (!spellings.has(k)) spellings.set(k, new Map());
    const counts = spellings.get(k);
    counts.set(s.area, (counts.get(s.area) || 0) + 1);
  }

  const canonical = new Map();
  for (const [k, counts] of spellings) {
    canonical.set(k, [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0]);
  }

  let changed = 0;
  for (const s of stages) {
    const c = canonical.get(s.area.toLowerCase());
    if (c && c !== s.area) {
      s.area = c;
      changed++;
    }
  }
  return changed;
}

/**
 * A chapter whose twenty stages all share one area name IS that region, so the area and
 * the chapter name should agree. Where they disagree the English string is at fault -
 * chapter 78 ships as "Blooming Peach Garden" but its stage names were left reading
 * "Eternity Garden", the previous chapter, while the Korean strings are correct. Trust
 * the chapter name in that case rather than publishing the copy-paste.
 */
function reconcileSingleAreaChapters(stages, chapters) {
  const byChapter = new Map();
  for (const s of stages) {
    if (!byChapter.has(s.chapter)) byChapter.set(s.chapter, []);
    byChapter.get(s.chapter).push(s);
  }

  const fixed = [];
  for (const chapter of chapters) {
    const rows = byChapter.get(chapter.chapter);
    if (!rows || !chapter.name) continue;
    const areas = [...new Set(rows.map((r) => r.area))];
    if (areas.length === 1 && areas[0] !== chapter.name) {
      fixed.push(`chapter ${chapter.chapter}: area "${areas[0]}" -> "${chapter.name}"`);
      rows.forEach((r) => {
        r.area = chapter.name;
      });
    }
  }
  return fixed;
}

function main() {
  const buf = loadAssetBuffer();
  if (!buf) {
    console.log(`ℹ  Game assets not found at ${path.relative(ROOT, ASSET_DIR)} - nothing to extract.`);
    console.log('   Expected outside a workspace that has an unpacked client build; the committed');
    console.log('   public/data/stage-chapters.json and stages.json are left untouched.');
    return;
  }

  console.log(`Reading ${buf.length.toLocaleString()} bytes of Unity asset data...`);
  const table = readLocalization(buf);
  console.log(`Parsed ${table.size.toLocaleString()} localization keys.`);

  const { chapters, stages, lastNamedChapter } = buildAtlas(table);
  const recased = normaliseAreaCasing(stages);
  const reconciled = reconcileSingleAreaChapters(stages, chapters);
  console.log(`Chapters: ${chapters.length} (${chapters.filter((c) => c.name).length} named, last named #${lastNamedChapter})`);
  console.log(`Stages named: ${stages.length}`);
  if (recased) console.log(`Normalised capitalisation on ${recased} area names.`);
  reconciled.forEach((r) => console.log(`Reconciled ${r}`));

  const existing = JSON.parse(fs.readFileSync(STAGES_JSON, 'utf8'));
  const byStage = new Map(stages.map((s) => [s.stageNo, s]));
  const lastVerifiedStage = findLastVerifiedStage(existing);
  console.log(`Combat figures stop being distinct after stage ${lastVerifiedStage}.`);

  let filled = 0;
  let corrected = 0;
  const samples = [];
  const merged = existing.map((row) => {
    // statsVerified marks the rows whose combat figures are genuinely the sheet's own,
    // so anyone browsing this file directly can see which numbers are recycled.
    const statsVerified = row.stageNo <= lastVerifiedStage;
    const atlas = byStage.get(row.stageNo);
    if (!atlas) return { ...row, chapter: null, statsVerified };

    const named = Boolean(row.region || row.area);
    if (!named) {
      filled++;
    } else if (row.region !== atlas.region || row.area !== atlas.area || row.zone !== atlas.zone) {
      corrected++;
      if (samples.length < 10) {
        samples.push(`  stage ${row.stageNo}: "${row.region} / ${row.area} ${row.zone}" -> "${atlas.region} / ${atlas.area} ${atlas.zone}"`);
      }
    }

    return { ...row, chapter: atlas.chapter, region: atlas.region, area: atlas.area, zone: atlas.zone, statsVerified };
  });

  console.log(`Filled names on ${filled} previously unnamed stages; corrected ${corrected} existing ones.`);
  samples.forEach((s) => console.log(s));

  const chapterFile = {
    source: 'Slayer Legend client localization table (Unity sharedassets0), package com.gear2.growslayer',
    generatedBy: 'scripts/extract-stage-atlas.js',
    stagesPerChapter: STAGES_PER_CHAPTER,
    lastNamedChapter,
    lastNamedStage: lastNamedChapter * STAGES_PER_CHAPTER,
    // Derived from stages.json, not from the client: the point past which the community
    // spreadsheet recycles its combat figures instead of producing new ones.
    lastVerifiedStage,
    chapters,
  };

  if (dryRun) {
    console.log('\n--dry-run: no files written.');
    return;
  }

  // The two files are read back as a matched pair, so serialise both before touching
  // disk: a failure while building one must not leave the other already replaced.
  const payloads = [
    [CHAPTERS_JSON, `${JSON.stringify(chapterFile, null, 2)}\n`],
    [STAGES_JSON, `${JSON.stringify(merged, null, 2)}\n`],
  ];
  const written = [];
  try {
    for (const [file, contents] of payloads) {
      fs.writeFileSync(file, contents);
      written.push(file);
    }
  } catch (err) {
    const done = written.map((f) => path.relative(ROOT, f)).join(', ') || 'none';
    throw new Error(`Write failed after updating [${done}] - the data files are now inconsistent: ${err.message}`);
  }

  console.log(`\n✓ Wrote ${path.relative(ROOT, CHAPTERS_JSON)} and ${path.relative(ROOT, STAGES_JSON)}.`);
}

try {
  main();
} catch (err) {
  console.error('Failed to extract the stage atlas:', err.message);
  process.exit(1);
}
