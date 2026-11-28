/** A node's box on the diagram. */
export interface Rect {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * UI15: after the node `changedId` grew, moves down the nodes it now
 * overlaps, then the nodes those overlap, and so on. A node only pushes
 * nodes that were not above it before the pass, and each pushed node is
 * placed `gap` below its pusher. Nodes that are not hit stay where they are.
 *
 * Returns the new `y` of every moved node.
 */
export function pushDownOverlaps(rects: Rect[], changedId: string, gap: number): Map<string, number> {
  const current = new Map(rects.map((r) => [r.id, { ...r }]));
  const originalY = new Map(rects.map((r) => [r.id, r.y]));
  const moved = new Map<string, number>();

  const queue = [changedId];
  while (queue.length > 0) {
    const a = current.get(queue.shift() as string);
    if (!a) {
      continue;
    }
    const aTop = originalY.get(a.id) as number;
    for (const b of current.values()) {
      if (b.id === a.id || (originalY.get(b.id) as number) < aTop || !overlaps(a, b, gap)) {
        continue;
      }
      b.y = a.y + a.height + gap;
      moved.set(b.id, b.y);
      queue.push(b.id);
    }
  }
  return moved;
}

/** True when the boxes share columns and are vertically closer than `gap`. */
function overlaps(a: Rect, b: Rect, gap: number): boolean {
  return (
    a.x < b.x + b.width &&
    b.x < a.x + a.width &&
    a.y < b.y + b.height + gap &&
    b.y < a.y + a.height + gap
  );
}
