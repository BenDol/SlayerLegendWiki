// @vitest-environment jsdom
/**
 * usePathname - one shared poller for every consumer.
 *
 * SeoManager and AdsProvider both watch the pathname from outside the
 * router; each used to own a 500 ms setInterval. The hook now multiplexes
 * one interval and one popstate listener across all subscribers.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, act, cleanup } from '@testing-library/react';
import { usePathname, PATHNAME_POLL_INTERVAL_MS } from '../../src/hooks/usePathname.js';

const Probe = ({ id }) => {
  const pathname = usePathname();
  return <span data-testid={id}>{pathname}</span>;
};

const navigateTo = (path) => window.history.pushState({}, '', path);

describe('usePathname', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    navigateTo('/');
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('reports the current pathname and follows pushState navigations through the poll', () => {
    const { getByTestId } = render(<Probe id="a" />);
    expect(getByTestId('a').textContent).toBe('/');

    act(() => {
      navigateTo('/skills/skills');
      vi.advanceTimersByTime(PATHNAME_POLL_INTERVAL_MS);
    });
    expect(getByTestId('a').textContent).toBe('/skills/skills');
  });

  it('follows popstate immediately', () => {
    const { getByTestId } = render(<Probe id="a" />);
    act(() => {
      navigateTo('/guides');
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
    expect(getByTestId('a').textContent).toBe('/guides');
  });

  it('shares one interval and one popstate listener between consumers, and tears both down with the last one', () => {
    const setIntervalSpy = vi.spyOn(globalThis, 'setInterval');
    const clearIntervalSpy = vi.spyOn(globalThis, 'clearInterval');
    const addSpy = vi.spyOn(window, 'addEventListener');
    const removeSpy = vi.spyOn(window, 'removeEventListener');

    const first = render(<Probe id="a" />);
    const second = render(<Probe id="b" />);
    expect(setIntervalSpy).toHaveBeenCalledTimes(1);
    expect(addSpy.mock.calls.filter(([type]) => type === 'popstate')).toHaveLength(1);

    act(() => {
      navigateTo('/spirits');
      vi.advanceTimersByTime(PATHNAME_POLL_INTERVAL_MS);
    });
    expect(first.getByTestId('a').textContent).toBe('/spirits');
    expect(second.getByTestId('b').textContent).toBe('/spirits');

    first.unmount();
    expect(clearIntervalSpy).not.toHaveBeenCalled();

    second.unmount();
    expect(clearIntervalSpy).toHaveBeenCalledTimes(1);
    expect(removeSpy.mock.calls.filter(([type]) => type === 'popstate')).toHaveLength(1);

    // A later consumer starts a fresh poller.
    render(<Probe id="c" />);
    expect(setIntervalSpy).toHaveBeenCalledTimes(2);
  });
});
