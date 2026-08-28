import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { tolerate } from './tolerate';

// tolerate logs every failure on purpose; keep that out of the test output.
beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('tolerate', () => {
  it('passes the value through when the read succeeds', async () => {
    let calls = 0;
    const result = await tolerate(
      async () => {
        calls++;
        return 'menu';
      },
      'fallback',
      'test',
    );

    expect(result).toEqual({ data: 'menu', failed: false });
    expect(calls).toBe(1);
  });

  it('retries once after a rejected token and reports success', async () => {
    vi.useFakeTimers();
    let calls = 0;
    const run = async () => {
      calls++;
      if (calls === 1) throw new Error('JWT issued at future');
      return 'menu';
    };

    const pending = tolerate(run, 'fallback', 'test');
    await vi.advanceTimersByTimeAsync(750);

    expect(await pending).toEqual({ data: 'menu', failed: false });
    expect(calls).toBe(2);
  });

  it('falls back and flags failure when the retry also fails', async () => {
    vi.useFakeTimers();
    let calls = 0;
    const run = async () => {
      calls++;
      throw new Error('JWT issued at future');
    };

    const pending = tolerate(run, 'fallback', 'test');
    await vi.advanceTimersByTimeAsync(750);

    expect(await pending).toEqual({ data: 'fallback', failed: true });
    expect(calls).toBe(2);
  });

  // The narrow match is the point: doubling the latency of a real fault would
  // make every genuine outage twice as slow to surface.
  it('does not retry an error that is not token-shaped', async () => {
    let calls = 0;
    const result = await tolerate(
      async () => {
        calls++;
        throw new Error('relation "food_log" does not exist');
      },
      'fallback',
      'test',
    );

    expect(result).toEqual({ data: 'fallback', failed: true });
    expect(calls).toBe(1);
  });

  it('recognises the PostgREST code as well as the message', async () => {
    vi.useFakeTimers();
    let calls = 0;
    const run = async () => {
      calls++;
      throw new Error('PGRST301: JWT expired');
    };

    const pending = tolerate(run, [] as string[], 'test');
    await vi.advanceTimersByTimeAsync(750);

    expect(calls).toBe(2);
    expect(await pending).toEqual({ data: [], failed: true });
  });
});
