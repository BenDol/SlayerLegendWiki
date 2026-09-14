import { describe, it, expect } from 'vitest';
import { isCrawler, isAdNetworkCrawler, getCrawlerName } from '../../src/utils/crawlerDetection.js';

const CHROME_DESKTOP = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36';
const GOOGLEBOT_SMARTPHONE = 'Mozilla/5.0 (Linux; Android 6.0.1; Nexus 5X Build/MMB29P) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Mobile Safari/537.36 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)';
const MEDIAPARTNERS = 'Mozilla/5.0 (Linux; Android 6.0.1; Nexus 5X Build/MMB29P) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Mobile Safari/537.36 (compatible; Mediapartners-Google/2.1; +http://www.google.com/bot.html)';
const DISPLAY_ADS_BOT = 'Google-Display-Ads-Bot';
const DISPLAY_ADS_BOT_CHROME = 'Mozilla/5.0 (compatible; Google-Display-Ads-Bot/1.0; +https://support.google.com/adsense/answer/99376) Chrome/128.0.0.0 Safari/537.36';

describe('Google ad crawlers', () => {
  it.each([
    ['Mediapartners-Google', MEDIAPARTNERS],
    ['AdsBot-Google', 'AdsBot-Google (+http://www.google.com/adsbot.html)'],
    ['AdsBot-Google-Mobile', 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_7_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.2 Mobile/15E148 Safari/604.1 (compatible; AdsBot-Google-Mobile; +http://www.google.com/mobile/adsbot.html)'],
    ['Google-Display-Ads-Bot (site verification)', DISPLAY_ADS_BOT],
    ['Google-Display-Ads-Bot with browser tokens', DISPLAY_ADS_BOT_CHROME],
  ])('%s is both a crawler and an ad crawler', (_label, ua) => {
    expect(isCrawler(ua)).toBe(true);
    expect(isAdNetworkCrawler(ua)).toBe(true);
  });
});

describe('search crawlers', () => {
  it('classifies Googlebot Smartphone as a crawler but not an ad crawler, despite Chrome/Safari tokens', () => {
    expect(isCrawler(GOOGLEBOT_SMARTPHONE)).toBe(true);
    expect(isAdNetworkCrawler(GOOGLEBOT_SMARTPHONE)).toBe(false);
    expect(getCrawlerName(GOOGLEBOT_SMARTPHONE)).toBe('Googlebot');
  });
});

describe('real browsers', () => {
  it('does not classify a desktop Chrome user agent as a crawler', () => {
    expect(isCrawler(CHROME_DESKTOP)).toBe(false);
    expect(isAdNetworkCrawler(CHROME_DESKTOP)).toBe(false);
    expect(getCrawlerName(CHROME_DESKTOP)).toBeNull();
  });

  it('handles empty input', () => {
    expect(isCrawler('')).toBe(false);
    expect(isAdNetworkCrawler('')).toBe(false);
  });
});
