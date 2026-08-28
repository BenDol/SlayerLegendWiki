/**
 * Generate the per-stage reference pages under public/content/stages/.
 *
 * The stage road is 1,660 stages long and every 20 of them form one named chapter, so a
 * single page would be unreadable. This splits the road into blocks of 200 stages (ten
 * chapters each), giving one page per block with a table per chapter.
 *
 * Two sources feed the pages, and they are trusted for different things:
 *   - public/data/stage-chapters.json - chapter/region names, extracted from the game
 *     client itself by scripts/extract-stage-atlas.js. Authoritative for naming.
 *   - public/data/stages.json - per-stage combat and reward numbers, from the community
 *     datamined spreadsheet. Authoritative for numbers ONLY up to lastVerifiedStage:
 *     past that point the source repeats its final 20-stage block verbatim, so those
 *     rows are omitted rather than published as if they were real.
 *
 * Prose that cannot be derived from data (each block's intro, the section blurbs) lives
 * in scripts/stage-pages.config.json so it survives regeneration.
 *
 * Usage: node scripts/generate-stage-pages.js [--dry-run]
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.join(__dirname, '..');

const STAGES_JSON = path.join(ROOT, 'public/data/stages.json');
const CHAPTERS_JSON = path.join(ROOT, 'public/data/stage-chapters.json');
const CONFIG_JSON = path.join(__dirname, 'stage-pages.config.json');
const OUT_DIR = path.join(ROOT, 'public/content/stages');

const STAGES_PER_CHAPTER = 20;
/**
 * Fallback for the stage past which the source spreadsheet stops producing new combat
 * values and just repeats the block from 20 stages earlier. scripts/extract-stage-atlas.js
 * derives the real boundary from the data and records it as `lastVerifiedStage`; this
 * value only applies to atlases written before that field existed.
 */
const LAST_VERIFIED_STAGE_FALLBACK = 1376;
/** Resolved from the atlas in main() before any page is built. */
let lastVerifiedStage = LAST_VERIFIED_STAGE_FALLBACK;
/** Accessories drop on every fifth stage; the other four drop weapons. */
const ACCESSORY_CYCLE = 5;
/** Above this magnitude, short-scale suffixes stop being familiar, so use powers of ten. */
const SCIENTIFIC_THRESHOLD = 1e15;
const SUFFIXES = [
  { value: 1e12, suffix: 'T' },
  { value: 1e9, suffix: 'B' },
  { value: 1e6, suffix: 'M' },
  { value: 1e3, suffix: 'K' },
];
const SUPERSCRIPT = { '-': '⁻', 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹' };
const GENERATOR = 'scripts/generate-stage-pages.js';
/** Stands in for the frontmatter date until resolveDate() decides whether it moved. */
const DATE_PLACEHOLDER = '__GENERATED_DATE__';

const HEADING = (text) => `# <span class="text-gray-900 dark:text-gray-100">${text}</span>`;
const SUBHEADING = (text) => `## <span class="text-gray-900 dark:text-gray-100">${text}</span>`;

const dryRun = process.argv.includes('--dry-run');

const superscript = (n) => String(n).split('').map((c) => SUPERSCRIPT[c] ?? c).join('');

/** Comma-grouped below a thousand-suffix, short-scale suffix up to trillions. */
function formatSuffix(n) {
  if (n === 0) return '0';
  if (n < 1000) return Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/\.?0+$/, '');
  for (const { value, suffix } of SUFFIXES) {
    if (n >= value) {
      const scaled = n / value;
      return `${scaled >= 100 ? Math.round(scaled) : scaled.toFixed(scaled >= 10 ? 1 : 2)}${suffix}`;
    }
  }
  return Math.round(n).toLocaleString('en-US');
}

/** "3.86 × 10⁵¹" - used for columns whose values outgrow familiar suffixes. */
function formatScientific(n) {
  if (n === 0) return '0';
  const exponent = Math.floor(Math.log10(Math.abs(n)));
  const mantissa = n / 10 ** exponent;
  return `${mantissa.toFixed(2)} × 10${superscript(exponent)}`;
}

/**
 * Pick one notation for a whole column so a table reads consistently: suffixes while the
 * numbers stay familiar, powers of ten once the column outgrows trillions.
 */
function columnFormatter(values) {
  const max = Math.max(...values.filter((v) => Number.isFinite(v)), 0);
  return max >= SCIENTIFIC_THRESHOLD ? formatScientific : formatSuffix;
}

/** Small counts (cubes, dice) read better in full than abbreviated to "1.12K". */
const formatCount = (n) => Math.round(n).toLocaleString('en-US');

const range = (values, format) => {
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  return lo === hi ? format(lo) : `${format(lo)} → ${format(hi)}`;
};

const uniq = (values) => [...new Set(values)];

const pct = (n) => `${Number(n.toFixed(3))}%`;

/** Chapters run 20 stages each, so a block of 200 always splits into whole chapters. */
function chaptersInRange(chapters, start, end) {
  return chapters.filter((c) => c.firstStage >= start && c.lastStage <= end && c.name);
}

function buildBlocks(config, lastNamedStage) {
  return config.pages
    // A shorter client build can pull lastNamedStage below a configured block; clamping
    // such a block would invert it (end < start) and emit a page for a range that does
    // not exist, so drop it outright instead.
    .filter((page) => page.start <= lastNamedStage)
    .map((page) => ({ ...page, end: Math.min(page.end, lastNamedStage) }));
}

/**
 * chaptersInRange only accepts chapters that sit wholly inside a block, so a boundary
 * that misses the 20-stage grid would drop a chapter from every page without failing.
 * The generator's one hard guarantee is that the blocks tile the named road exactly, so
 * check it up front and refuse to write anything rather than ship a road with a hole.
 */
function assertBlocksTileTheRoad(blocks, chapters, lastNamedStage) {
  const named = chapters.filter((c) => c.name);
  const seen = new Map();

  for (const block of blocks) {
    for (const chapter of chaptersInRange(chapters, block.start, block.end)) {
      const already = seen.get(chapter.chapter);
      if (already) {
        throw new Error(
          `Chapter ${chapter.chapter} (${chapter.name}) falls in two blocks: ` +
            `${already.start}-${already.end} and ${block.start}-${block.end}.`
        );
      }
      seen.set(chapter.chapter, block);
    }
  }

  const missing = named.filter((c) => !seen.has(c.chapter));
  if (missing.length) {
    throw new Error(
      `${missing.length} chapter(s) fall outside every configured block, so their stages would ` +
        `vanish from the wiki: ${missing.map((c) => `${c.chapter} (${c.firstStage}-${c.lastStage})`).join(', ')}. ` +
        'Block boundaries in stage-pages.config.json must land on 20-stage chapter edges.'
    );
  }

  const covered = named.length * STAGES_PER_CHAPTER;
  if (covered !== lastNamedStage) {
    throw new Error(`Blocks cover ${covered} stages but the road is ${lastNamedStage} long.`);
  }
}

/**
 * Rows past lastVerifiedStage carry recycled numbers, so a chapter is either fully
 * documented, or listed by name only with its stats withheld.
 */
const hasVerifiedStats = (chapter) => chapter.lastStage <= lastVerifiedStage;

function chapterGlance(rows, chapter) {
  const waves = uniq(rows.map((r) => r.enemyCount)).sort((a, b) => a - b);
  const areas = uniq(rows.map((r) => r.area));
  const rarities = uniq(rows.map((r) => r.equipmentRarity));
  const goldFactors = uniq(rows.map((r) => r.goldFactor));
  const dice = uniq(rows.map((r) => r.diceEarned));

  const enemyHp = columnFormatter(rows.map((r) => r.enemyHP));
  const bossHp = columnFormatter(rows.map((r) => r.bossHP));
  const gold = columnFormatter(rows.map((r) => r.goldPerKill));
  const idleGold = columnFormatter(rows.map((r) => r.idleGold));
  const soul = columnFormatter(rows.map((r) => r.idleSoul));

  const lines = [
    `- **Areas:** ${areas.join(' · ')}`,
    `- **Wave size:** ${waves.length === 1 ? `${waves[0]} monsters` : `${waves[0]}-${waves[waves.length - 1]} monsters`}`,
    `- **Enemy HP:** ${range(rows.map((r) => r.enemyHP), enemyHp)} · **Boss HP:** ${range(rows.map((r) => r.bossHP), bossHp)}`,
    `- **Gold per kill:** ${range(rows.map((r) => r.goldPerKill), gold)} · **Cubes per kill:** ${range(rows.map((r) => r.cubePerKill), formatCount)}`,
    `- **Drops:** ${rarities.join(' → ')} at ${range(rows.map((r) => r.equipmentProbability), pct)}, accessories on every ${ordinal(ACCESSORY_CYCLE)} stage`,
    `- **Idle payout:** ${range(rows.map((r) => r.idleGold), idleGold)} gold · ${range(rows.map((r) => r.idleSoul), soul)} souls · ${range(rows.map((r) => r.idleDiamond), formatSuffix)} diamonds`,
    `- **Clear bonus:** Stage Gold ×${goldFactors.length === 1 ? goldFactors[0] : `${Math.min(...goldFactors)}-${Math.max(...goldFactors)}`} · **Dice:** ${dice.length === 1 ? dice[0] : `${Math.min(...dice)}-${Math.max(...dice)}`} per clear`,
  ];

  if (areas.length === 1 && areas[0] === chapter.name) lines.shift();
  return lines.join('\n');
}

const ordinal = (n) => {
  const suffixes = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return `${n}${suffixes[(v - 20) % 10] || suffixes[v] || suffixes[0]}`;
};

function chapterTable(rows) {
  const singleArea = uniq(rows.map((r) => r.area)).length === 1;
  const enemyHp = columnFormatter(rows.map((r) => r.enemyHP));
  const bossHp = columnFormatter(rows.map((r) => r.bossHP));
  const bossAtk = columnFormatter(rows.map((r) => r.bossATK));
  const gold = columnFormatter(rows.map((r) => r.goldPerKill));
  const exp = columnFormatter(rows.map((r) => r.expPerKill));

  const headers = ['Stage', ...(singleArea ? [] : ['Area']), 'Zone', 'Wave', 'Enemy HP', 'Boss HP', 'Boss ATK', 'Gold / Kill', 'EXP / Kill', 'Drop'];
  const lines = [
    `| ${headers.join(' | ')} |`,
    `|${headers.map(() => '---').join('|')}|`,
  ];

  for (const r of rows) {
    const drop = `${r.equipment} · ${r.equipmentRarity}`;
    const cells = [
      `**${r.stageNo}**`,
      ...(singleArea ? [] : [r.area]),
      r.zone || '-',
      r.enemyCount,
      enemyHp(r.enemyHP),
      bossHp(r.bossHP),
      bossAtk(r.bossATK),
      gold(r.goldPerKill),
      exp(r.expPerKill),
      drop,
    ];
    lines.push(`| ${cells.join(' | ')} |`);
  }
  return lines.join('\n');
}

/**
 * The block's opening table: one row per chapter, so a reader can jump straight in.
 * A block with no measured numbers at all gets a naming-only shape instead of a table
 * of dashes - the areas and zones are still known, and they are what that page is for.
 */
function blockSummaryTable(chapters, byStage, namesByStage) {
  if (chapters.every((c) => !hasVerifiedStats(c))) {
    const headers = ['Chapter', 'Region', 'Stages', 'Areas'];
    const lines = [`| ${headers.join(' | ')} |`, `|${headers.map(() => '---').join('|')}|`];
    for (const c of chapters) {
      const areas = uniq(namesFor(c, namesByStage).map((r) => r.area));
      lines.push(`| ${c.chapter} | **${c.name}** | ${c.firstStage}-${c.lastStage} | ${areas.join(' · ')} |`);
    }
    return lines.join('\n');
  }

  const headers = ['Chapter', 'Region', 'Stages', 'Wave', 'Enemy HP', 'Boss HP', 'Drop rarity'];
  const lines = [
    `| ${headers.join(' | ')} |`,
    `|${headers.map(() => '---').join('|')}|`,
  ];

  for (const c of chapters) {
    const rows = rowsFor(c, byStage);
    if (!hasVerifiedStats(c) || rows.length === 0) {
      lines.push(`| ${c.chapter} | **${c.name}** | ${c.firstStage}-${c.lastStage} | - | - | - | - |`);
      continue;
    }
    const enemyHp = columnFormatter(rows.map((r) => r.enemyHP));
    const bossHp = columnFormatter(rows.map((r) => r.bossHP));
    const waves = uniq(rows.map((r) => r.enemyCount)).sort((a, b) => a - b);
    const rarities = uniq(rows.map((r) => r.equipmentRarity));
    lines.push(
      `| ${c.chapter} | **${c.name}** | ${c.firstStage}-${c.lastStage} | ${waves.length === 1 ? waves[0] : `${waves[0]}-${waves[waves.length - 1]}`} | ${range(rows.map((r) => r.enemyHP), enemyHp)} | ${range(rows.map((r) => r.bossHP), bossHp)} | ${rarities.join(' → ')} |`
    );
  }
  return lines.join('\n');
}

const namesFor = (chapter, namesByStage) => {
  const rows = [];
  for (let n = chapter.firstStage; n <= chapter.lastStage; n++) {
    const row = namesByStage.get(n);
    if (row) rows.push(row);
  }
  return rows;
};

/** Area and zone are known for every named chapter, even where the numbers are not. */
function chapterNameTable(rows) {
  const singleArea = uniq(rows.map((r) => r.area)).length === 1;
  const headers = ['Stage', ...(singleArea ? [] : ['Area']), 'Zone'];
  const lines = [`| ${headers.join(' | ')} |`, `|${headers.map(() => '---').join('|')}|`];
  for (const r of rows) {
    lines.push(`| ${[`**${r.stageNo}**`, ...(singleArea ? [] : [r.area]), r.zone || '-'].join(' | ')} |`);
  }
  return lines.join('\n');
}

const rowsFor = (chapter, byStage) => {
  const rows = [];
  for (let n = chapter.firstStage; n <= chapter.lastStage; n++) {
    const row = byStage.get(n);
    if (row) rows.push(row);
  }
  return rows;
};

/**
 * `date` is emitted as a placeholder and resolved per page in main(): the sitemap takes
 * its lastmod from this field precisely so a rebuild does not claim every page changed,
 * so a regeneration that produces identical prose must keep the date it already had.
 */
function frontmatter({ id, title, description, order, tags }) {
  return [
    '---',
    `id: ${id}`,
    `title: ${title}`,
    `description: ${description}`,
    'tags:',
    ...tags.map((t) => `  - ${t}`),
    'category: Stages',
    `date: ${DATE_PLACEHOLDER}`,
    `order: ${order}`,
    'generated: true',
    `generatedBy: ${GENERATOR}`,
    '---',
    '',
    `<!-- Generated by ${GENERATOR} - edits here are overwritten on the next run.`,
    `     Prose lives in ${path.posix.join('scripts', path.basename(CONFIG_JSON))}; data in public/data/. -->`,
  ].join('\n');
}

/** Reuse the date already on disk when nothing else about the page changed. */
function resolveDate(file, body) {
  const today = new Date().toISOString().slice(0, 10);
  if (!fs.existsSync(file)) return today;

  const existing = fs.readFileSync(file, 'utf8');
  const previousDate = existing.match(/^date: (.+)$/m)?.[1]?.trim();
  if (!previousDate) return today;

  const normalised = existing.replace(/^date: .+$/m, `date: ${DATE_PLACEHOLDER}`);
  return normalised === body ? previousDate : today;
}

function buildPage({ block, index, blocks, chapters, byStage, namesByStage, config }) {
  const blockChapters = chaptersInRange(chapters, block.start, block.end);
  const id = `stages-${block.start}-${block.end}`;
  const title = `Stages ${block.start.toLocaleString('en-US')}-${block.end.toLocaleString('en-US')}`;
  const parts = [];

  parts.push(
    frontmatter({
      id,
      title,
      description: block.description,
      order: config.firstBlockOrder + index,
      tags: config.tags,
    })
  );

  parts.push(HEADING(title));
  parts.push(block.intro.trim());

  parts.push(HEADING('Chapters In This Stretch'));
  parts.push(blockSummaryTable(blockChapters, byStage, namesByStage));

  const unverified = blockChapters.filter((c) => !hasVerifiedStats(c));
  if (unverified.length) {
    parts.push(config.unverifiedNotice.replaceAll('{{stage}}', lastVerifiedStage.toLocaleString('en-US')));
  }

  for (const chapter of blockChapters) {
    parts.push(SUBHEADING(`${chapter.chapter}. ${chapter.name} <span class="text-gray-500 dark:text-gray-400 text-base font-normal">(${chapter.firstStage}-${chapter.lastStage})</span>`));
    const rows = rowsFor(chapter, byStage);
    if (!hasVerifiedStats(chapter) || rows.length === 0) {
      const names = namesFor(chapter, namesByStage);
      const areas = uniq(names.map((r) => r.area));
      const zones = names.map((r) => r.zone).filter(Boolean);
      // A single-area chapter is just zones I-XX of the region, which a table would
      // spell out twenty times without adding anything. Only tabulate real structure.
      if (areas.length > 1) {
        parts.push(`**${chapter.name}** spans ${areas.length} areas. Per-stage numbers are not published yet - see the note above.`);
        parts.push(chapterNameTable(names));
      } else {
        parts.push(
          `All twenty stages sit in **${chapter.name}** itself` +
            `${zones.length ? `, zones ${zones[0]} through ${zones[zones.length - 1]}` : ''}. ` +
            'Per-stage numbers are not published yet - see the note above.'
        );
      }
      continue;
    }
    parts.push(chapterGlance(rows, chapter));
    parts.push(chapterTable(rows));
  }

  const prev = blocks[index - 1];
  const next = blocks[index + 1];
  const nav = [];
  if (prev) nav.push(`← [Stages ${prev.start.toLocaleString('en-US')}-${prev.end.toLocaleString('en-US')}](/stages/stages-${prev.start}-${prev.end})`);
  nav.push('[All stages](/stages)');
  if (next) nav.push(`[Stages ${next.start.toLocaleString('en-US')}-${next.end.toLocaleString('en-US')}](/stages/stages-${next.start}-${next.end}) →`);

  parts.push(HEADING('Keep Reading'));
  parts.push(nav.join(' · '));
  parts.push(config.footer.trim());

  return { id, title, body: `${parts.join('\n\n')}\n` };
}

function main() {
  const stages = JSON.parse(fs.readFileSync(STAGES_JSON, 'utf8'));
  const atlas = JSON.parse(fs.readFileSync(CHAPTERS_JSON, 'utf8'));
  const { chapters, lastNamedStage } = atlas;
  const config = JSON.parse(fs.readFileSync(CONFIG_JSON, 'utf8'));

  lastVerifiedStage = atlas.lastVerifiedStage ?? LAST_VERIFIED_STAGE_FALLBACK;

  const byStage = new Map(stages.filter((s) => s.stageNo <= lastVerifiedStage).map((s) => [s.stageNo, s]));
  const namesByStage = new Map(stages.filter((s) => s.chapter).map((s) => [s.stageNo, s]));
  const blocks = buildBlocks(config, lastNamedStage);
  assertBlocksTileTheRoad(blocks, chapters, lastNamedStage);

  const pages = blocks.map((block, index) => buildPage({ block, index, blocks, chapters, byStage, namesByStage, config }));

  let unchanged = 0;
  for (const page of pages) {
    const file = path.join(OUT_DIR, `${page.id}.md`);
    const date = resolveDate(file, page.body);
    const body = page.body.replace(DATE_PLACEHOLDER, date);
    const kept = fs.existsSync(file) && fs.readFileSync(file, 'utf8') === body;
    if (kept) unchanged++;
    const size = Buffer.byteLength(body, 'utf8');
    console.log(`${dryRun ? 'would write' : 'wrote'} ${path.relative(ROOT, file)} (${(size / 1024).toFixed(1)} KB)${kept ? ' - unchanged' : ''}`);
    if (!dryRun) fs.writeFileSync(file, body);
  }

  const deepestPublished = Math.max(
    ...chapters.filter((c) => c.name && hasVerifiedStats(c)).map((c) => c.lastStage)
  );
  console.log(`\n${pages.length} block pages covering stages 1-${lastNamedStage.toLocaleString('en-US')} (${unchanged} unchanged).`);
  console.log(`Per-stage numbers published for stages 1-${deepestPublished.toLocaleString('en-US')}.`);
}

// Run only when executed directly (node scripts/generate-stage-pages.js); importing the
// module (e.g. from tests) must not rewrite content.
const isDirectExecution =
  process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename);
if (isDirectExecution) {
  try {
    main();
  } catch (err) {
    console.error('Failed to generate stage pages:', err.message);
    process.exit(1);
  }
}

// Pure helpers exported for unit tests.
export { buildBlocks, assertBlocksTileTheRoad, chaptersInRange, formatSuffix, formatScientific };
