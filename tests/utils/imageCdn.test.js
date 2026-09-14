import { describe, it, expect } from 'vitest';
import { buildCdnImageUrl, encodeImagePath, CONTENT_IMAGE_PREFIX, CDN_SERVING_MODES } from '../../functions/_shared/utils/imageCdn.js';

const gameAssets = {
  enabled: true,
  cdn: {
    provider: 'github',
    github: { owner: 'BenDol', repo: 'SlayerLegendCDN', basePath: 'game-assets', servingMode: 'jsdelivr', branch: 'main' },
  },
};

describe('encodeImagePath', () => {
  it('percent-encodes spaces per segment', () => {
    expect(encodeImagePath('altar/DragonStat 1.png')).toBe('altar/DragonStat%201.png');
  });

  it('never double-encodes an already encoded path', () => {
    expect(encodeImagePath('altar/DragonStat%201.png')).toBe('altar/DragonStat%201.png');
  });

  it('drops empty segments and leading slashes', () => {
    expect(encodeImagePath('/goods//Goods_Emerald.png')).toBe('goods/Goods_Emerald.png');
  });

  it('encodes a malformed escape sequence literally instead of throwing', () => {
    expect(encodeImagePath('goods/100%.png')).toBe('goods/100%25.png');
  });

  it('returns an empty string for empty input', () => {
    expect(encodeImagePath('')).toBe('');
    expect(encodeImagePath(undefined)).toBe('');
  });

  it('rejects dot segments, raw or percent-encoded, so a path can never climb out of images/', () => {
    expect(encodeImagePath('../../README.md')).toBe('');
    expect(encodeImagePath('%2e%2e/%2e%2e/README.md')).toBe('');
    expect(encodeImagePath('goods/../secret.png')).toBe('');
    expect(encodeImagePath('./goods/a.png')).toBe('');
    // A file name that merely contains dots is fine.
    expect(encodeImagePath('goods/..a.png')).toBe('goods/..a.png');
    expect(encodeImagePath('goods/a..png')).toBe('goods/a..png');
  });
});

describe('buildCdnImageUrl', () => {
  it('maps a /images/content/ path to jsDelivr in the configured mode', () => {
    expect(buildCdnImageUrl('/images/content/goods/Goods_Emerald.png', gameAssets)).toBe(
      'https://cdn.jsdelivr.net/gh/BenDol/SlayerLegendCDN@main/game-assets/images/goods/Goods_Emerald.png'
    );
  });

  it('accepts a bare relative path', () => {
    expect(buildCdnImageUrl('goods/Goods_Emerald.png', gameAssets)).toMatch(/\/images\/goods\/Goods_Emerald\.png$/);
  });

  it('serves from raw.githubusercontent.com when asked', () => {
    expect(buildCdnImageUrl('/images/content/companions/zeke/warrior_01.png', gameAssets, 'raw')).toBe(
      'https://raw.githubusercontent.com/BenDol/SlayerLegendCDN/main/game-assets/images/companions/zeke/warrior_01.png'
    );
  });

  it('honours a raw servingMode from config when no override is given', () => {
    const rawConfig = { ...gameAssets, cdn: { ...gameAssets.cdn, github: { ...gameAssets.cdn.github, servingMode: 'raw' } } };
    expect(buildCdnImageUrl('goods/x.png', rawConfig)).toMatch(/^https:\/\/raw\.githubusercontent\.com\//);
  });

  it('ignores an unknown servingMode override and falls back to config', () => {
    expect(buildCdnImageUrl('goods/x.png', gameAssets, 'ftp')).toMatch(/^https:\/\/cdn\.jsdelivr\.net\//);
  });

  it('encodes spaces so crawlers get a valid URL', () => {
    expect(buildCdnImageUrl('/images/content/altar/DragonStat 1.png', gameAssets, 'raw')).toBe(
      'https://raw.githubusercontent.com/BenDol/SlayerLegendCDN/main/game-assets/images/altar/DragonStat%201.png'
    );
  });

  it('defaults basePath and branch, and trims slashes around basePath', () => {
    const minimal = { enabled: true, cdn: { provider: 'github', github: { owner: 'o', repo: 'r' } } };
    expect(buildCdnImageUrl('a.png', minimal)).toBe('https://cdn.jsdelivr.net/gh/o/r@main/game-assets/images/a.png');
    const slashed = { enabled: true, cdn: { provider: 'github', github: { owner: 'o', repo: 'r', basePath: '/assets/' } } };
    expect(buildCdnImageUrl('a.png', slashed)).toBe('https://cdn.jsdelivr.net/gh/o/r@main/assets/images/a.png');
  });

  it('returns null for a traversing path', () => {
    expect(buildCdnImageUrl('/images/content/../../x.png', gameAssets)).toBeNull();
    expect(buildCdnImageUrl('%2e%2e/x.png', gameAssets)).toBeNull();
  });

  it('returns null when the CDN is disabled, misconfigured, or the path is empty', () => {
    expect(buildCdnImageUrl('a.png', { enabled: false, cdn: gameAssets.cdn })).toBeNull();
    expect(buildCdnImageUrl('a.png', { enabled: true })).toBeNull();
    expect(buildCdnImageUrl('a.png', { enabled: true, cdn: { provider: 's3' } })).toBeNull();
    expect(buildCdnImageUrl('a.png', { enabled: true, cdn: { provider: 'github', github: { owner: 'o' } } })).toBeNull();
    expect(buildCdnImageUrl('', gameAssets)).toBeNull();
    expect(buildCdnImageUrl('/images/content/', gameAssets)).toBeNull();
    expect(buildCdnImageUrl(undefined, gameAssets)).toBeNull();
  });

  it('exposes the prefix and modes the callers rely on', () => {
    expect(CONTENT_IMAGE_PREFIX).toBe('/images/content/');
    expect(CDN_SERVING_MODES).toEqual(['jsdelivr', 'raw']);
  });
});
