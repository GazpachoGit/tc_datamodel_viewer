import { describe, expect, it } from 'vitest';
import { pushDownOverlaps, type Rect } from './collisions';

const GAP = 24;
const box = (id: string, x: number, y: number, width = 100, height = 50): Rect => ({
  id,
  x,
  y,
  width,
  height,
});

describe('pushDownOverlaps (UI15)', () => {
  it('moves a node below the grown node', () => {
    // "a" grew from 50 to 200 and now covers "b".
    const moved = pushDownOverlaps([box('a', 0, 0, 100, 200), box('b', 0, 100)], 'a', GAP);
    expect(moved).toEqual(new Map([['b', 224]]));
  });

  it('pushes in a chain', () => {
    const moved = pushDownOverlaps(
      [box('a', 0, 0, 100, 200), box('b', 0, 100), box('c', 50, 180)],
      'a',
      GAP,
    );
    expect(moved.get('b')).toBe(224);
    expect(moved.get('c')).toBe(224 + 50 + GAP);
  });

  it('does not move nodes beside or above the grown node', () => {
    const moved = pushDownOverlaps(
      [box('above', 0, -100), box('a', 0, 0, 100, 200), box('beside', 140, 100)],
      'a',
      GAP,
    );
    expect(moved.size).toBe(0);
  });

  it('moves nothing when the gap is already large enough', () => {
    const moved = pushDownOverlaps([box('a', 0, 0, 100, 200), box('b', 0, 224)], 'a', GAP);
    expect(moved.size).toBe(0);
  });
});
