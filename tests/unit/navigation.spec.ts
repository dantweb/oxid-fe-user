import { describe, expect, it, vi } from 'vitest';
import { dropQueryString } from '../../src/navigation';

describe('dropQueryString', () => {
  it('replaces the entry with the bare path, keeping the history state', () => {
    const history = { state: { position: 3 }, replaceState: vi.fn() };

    dropQueryString(history, { search: '?uid=secret', pathname: '/reset-password' });

    expect(history.replaceState).toHaveBeenCalledWith({ position: 3 }, '', '/reset-password');
  });

  it('leaves an address without a query string alone', () => {
    const history = { state: null, replaceState: vi.fn() };

    dropQueryString(history, { search: '', pathname: '/checkout/return/stripe' });

    expect(history.replaceState).not.toHaveBeenCalled();
  });
});
