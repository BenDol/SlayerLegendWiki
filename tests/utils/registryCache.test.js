/**
 * Tests for the in-process TTL registry cache used by the display-name and
 * profile-picture handlers.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createTtlCache, registryKey } from '../../functions/_shared/utils/registryCache.js';

describe('registryKey', () => {
  it('builds an owner/repo key', () => {
    expect(registryKey('BenDol', 'SlayerLegendWiki')).toBe('BenDol/SlayerLegendWiki');
  });
});

describe('createTtlCache', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('returns a stored value before the TTL elapses', () => {
    const cache = createTtlCache(1000);
    cache.set('k', { a: 1 });
    vi.advanceTimersByTime(999);
    expect(cache.get('k')).toEqual({ a: 1 });
  });

  it('expires a value after the TTL elapses', () => {
    const cache = createTtlCache(1000);
    cache.set('k', 'v');
    vi.advanceTimersByTime(1001);
    expect(cache.get('k')).toBeUndefined();
  });

  it('returns undefined for an unknown key', () => {
    const cache = createTtlCache(1000);
    expect(cache.get('missing')).toBeUndefined();
  });

  it('invalidate() drops a single key', () => {
    const cache = createTtlCache(1000);
    cache.set('a', 1);
    cache.set('b', 2);
    cache.invalidate('a');
    expect(cache.get('a')).toBeUndefined();
    expect(cache.get('b')).toBe(2);
  });

  it('clear() drops every key', () => {
    const cache = createTtlCache(1000);
    cache.set('a', 1);
    cache.set('b', 2);
    cache.clear();
    expect(cache.get('a')).toBeUndefined();
    expect(cache.get('b')).toBeUndefined();
  });
});
