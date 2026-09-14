/**
 * Slayer Legend emoticon catalogue.
 *
 * Pure data, no React: shared by the <Emoticon> component (runtime) and by
 * scripts/prerender.js, which turns {{emoticon:...}} tokens into real <img>
 * tags in the crawler HTML instead of stripping them to empty table cells.
 *
 * Keep this file plain Node ESM (no JSX, no bundler-only imports such as
 * `?raw` or `import.meta.glob`): the prerenderer imports it directly as a
 * postbuild step, outside Vite.
 */

/** Emoticon ID -> display name. IDs match the game's Emoticon_<id>.png assets. */
export const EMOTICON_MAP = Object.freeze({
  1: 'Hello',
  2: 'Yep',
  3: 'Laugh',
  4: 'Okay',
  5: 'Cheer',
  6: 'Cool',
  7: 'Exhausted',
  8: 'Congrats',
  1001: 'Ok',
  1002: 'No',
  1003: 'Hm',
  1004: 'Love',
  1005: 'Question',
  1006: 'Sleep',
  1007: 'Sad',
  1008: 'Happy',
});

/** Lower-cased name -> ID. */
export const EMOTICON_NAME_TO_ID = Object.freeze(
  Object.entries(EMOTICON_MAP).reduce((acc, [id, name]) => {
    acc[name.toLowerCase()] = parseInt(id, 10);
    return acc;
  }, {})
);

/**
 * Content-image path for an emoticon, relative to the /images/content/ root
 * the wiki uses for game assets.
 * @param {number} id
 */
export const emoticonImagePath = (id) => `emoticons/Emoticon_${id}.png`;

/**
 * Resolve an emoticon reference (numeric id or name, either type) to
 * `{ id, name }`, or null when unknown.
 * @param {string|number} ref
 */
export function resolveEmoticon(ref) {
  if (ref === undefined || ref === null || ref === '') return null;
  const asNumber = Number(ref);
  const id = Number.isInteger(asNumber) && EMOTICON_MAP[asNumber]
    ? asNumber
    : EMOTICON_NAME_TO_ID[String(ref).trim().toLowerCase()];
  if (!id) return null;
  return { id, name: EMOTICON_MAP[id] };
}
