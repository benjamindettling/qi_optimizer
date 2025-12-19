/**
 * Exact cover placement solver for rectangle blocks on a grid.
 * Uses Algorithm X with Dancing Links to determine whether a set of blocks
 * (with counts) can tile the available area without overlaps.
 *
 * API:
 *   solveTiling(areaWidth, areaHeight, blocks, options?)
 *     - blocks: [{ width, height, count, id? }]
 *     - options.allowGaps: if true, auto-fills remaining cells with 1x1 filler blocks
 *     - returns array of placements [{ id, x, y, width, height, typeIndex, instance, isFiller }]
 *       or null if no tiling exists.
 *
 *   solveTilingMask(mask, blocks, options?)
 *     - mask: boolean matrix (array of rows), true/1 indicates an available cell.
 *     - blocks: same shape as above
 *     - options.allowGaps behaves the same.
 *     - respects holes / non-rectangular shapes.
 *
 * Notes:
 * - Blocks are axis-aligned and not rotated.
 * - Every provided block instance must be placed. If allowGaps is true, empty cells are auto-filled.
 */

class DLXNode {
  constructor() {
    this.L = this;
    this.R = this;
    this.U = this;
    this.D = this;
    this.C = null;
    this.row = null;
  }
}

class DLXColumn extends DLXNode {
  constructor(name, isPrimary = true) {
    super();
    this.size = 0;
    this.name = name;
    this.C = this;
    this.isPrimary = isPrimary;
  }
}

function linkRight(left, right) {
  right.R = left.R;
  right.L = left;
  left.R.L = right;
  left.R = right;
}

function linkDown(top, bottom) {
  bottom.D = top.D;
  bottom.U = top;
  top.D.U = bottom;
  top.D = bottom;
  bottom.C = top.C;
}

function cover(col) {
  col.R.L = col.L;
  col.L.R = col.R;
  for (let i = col.D; i !== col; i = i.D) {
    for (let j = i.R; j !== i; j = j.R) {
      j.D.U = j.U;
      j.U.D = j.D;
      j.C.size -= 1;
    }
  }
}

function uncover(col) {
  for (let i = col.U; i !== col; i = i.U) {
    for (let j = i.L; j !== i; j = j.L) {
      j.C.size += 1;
      j.D.U = j;
      j.U.D = j;
    }
  }
  col.R.L = col;
  col.L.R = col;
}

function chooseColumn(head) {
  let smallest = Infinity;
  let chosen = null;
  for (let c = head.R; c !== head; c = c.R) {
    if (!c.isPrimary) continue;
    if (c.size < smallest) {
      smallest = c.size;
      chosen = c;
      if (smallest === 0) break;
    }
  }
  return chosen;
}

function search(head, solution, out) {
  const col = chooseColumn(head);
  if (!col) {
    out.push([...solution]);
    return true;
  }
  if (col.size === 0) return false;
  cover(col);
  for (let r = col.D; r !== col; r = r.D) {
    solution.push(r);
    for (let j = r.R; j !== r; j = j.R) cover(j.C);
    if (search(head, solution, out)) return true;
    for (let j = r.L; j !== r; j = j.L) uncover(j.C);
    solution.pop();
  }
  uncover(col);
  return false;
}

/**
 * Build exact cover matrix for placements.
 */
function buildDLXFromMask(mask, blocks, { allowGaps = false } = {}) {
  const areaH = mask.length;
  const areaW = mask[0]?.length ?? 0;
  const owned = [];
  for (let y = 0; y < areaH; y += 1) {
    for (let x = 0; x < areaW; x += 1) {
      if (mask[y][x]) owned.push({ x, y });
    }
  }
  const ownedIndex = new Map(owned.map((c, i) => [`${c.x},${c.y}`, i]));

  // Primary columns: one per available cell
  const head = new DLXColumn("head");
  let prev = head;
  const columns = [];
  const addColumn = (name, isPrimary = true) => {
    const c = new DLXColumn(name, isPrimary);
    linkRight(prev, c);
    prev = c;
    columns.push(c);
    return c;
  };

  const cellColumns = owned.map((c) =>
    addColumn(`cell:${c.x},${c.y}`, !allowGaps)
  );

  const instanceColumns = [];
  const sortedTypes = [...blocks]
    .map((b, idx) => ({
      ...b,
      typeIndex: idx,
      area: (b.width ?? 0) * (b.height ?? 0),
    }))
    .sort((a, b) => b.area - a.area || b.count - a.count);

  sortedTypes.forEach((b) => {
    for (let i = 0; i < b.count; i += 1) {
      const c = addColumn(`block:${b.typeIndex}:${i}`, true);
      instanceColumns.push({ col: c, typeIndex: b.typeIndex, instance: i, filler: false });
    }
  });

  const rows = [];
  const addRow = (cols, payload) => {
    const first = new DLXNode();
    first.C = cols[0];
    linkDown(first.C, first);
    first.C.size += 1;
    let last = first;
    for (let k = 1; k < cols.length; k += 1) {
      const node = new DLXNode();
      node.C = cols[k];
      linkDown(node.C, node);
      node.C.size += 1;
      // link horizontally
      node.L = last;
      node.R = first;
      last.R = node;
      first.L = node;
      last = node;
    }
    // Attach payload to every node in the row for easy retrieval
    for (let n = first; ; ) {
      n.row = payload;
      n = n.R;
      if (n === first) break;
    }
    rows.push(first);
  };

  instanceColumns.forEach(({ col, typeIndex, instance, filler }) => {
    const b = blocks[typeIndex];
    for (let y = 0; y <= areaH - b.height; y += 1) {
      for (let x = 0; x <= areaW - b.width; x += 1) {
        // symmetry break: enforce non-decreasing linear position across instances
        const linPos = y * areaW + x;
        if (instance > 0 && linPos < instance) continue;
        // ensure all cells in footprint are owned
        const ownedCells = [];
        let ok = true;
        for (let dy = 0; dy < b.height; dy += 1) {
          for (let dx = 0; dx < b.width; dx += 1) {
            const key = `${x + dx},${y + dy}`;
            const idx = ownedIndex.get(key);
            if (idx === undefined) {
              ok = false;
              break;
            }
            ownedCells.push(cellColumns[idx]);
          }
          if (!ok) break;
        }
        if (!ok) continue;

        const cols = [col, ...ownedCells];
        addRow(cols, {
          x,
          y,
          width: b.width,
          height: b.height,
          typeIndex,
          instance,
          isFiller: filler,
        });
      }
    }
  });

  if (allowGaps) {
    owned.forEach((cell, idx) => {
      const cellCol = cellColumns[idx];
      addRow([cellCol], {
        x: cell.x,
        y: cell.y,
        width: 1,
        height: 1,
        typeIndex: -1,
        instance: idx,
        isFiller: true,
      });
    });
  }

  return { head };
}

export function solveTiling(areaWidth, areaHeight, blocks, options) {
  if (areaWidth <= 0 || areaHeight <= 0) return null;
  if (!blocks.length) return [];
  const mask = Array.from({ length: areaHeight }, () =>
    Array.from({ length: areaWidth }, () => true)
  );
  return solveTilingMask(mask, blocks, options);
}

export function solveTilingMask(mask, blocks, options = {}) {
  if (!mask?.length || !mask[0]?.length) return null;
  if (!blocks.length) return [];
  const availableCells = mask.reduce(
    (sum, row) => sum + row.reduce((s, v) => s + (v ? 1 : 0), 0),
    0
  );
  const totalBlockArea = blocks.reduce(
    (sum, b) => sum + (b.width ?? 0) * (b.height ?? 0) * (b.count ?? 0),
    0
  );
  if (totalBlockArea > availableCells) {
    return null; // impossible: not enough area for all mandatory blocks
  }

  const gap = availableCells - totalBlockArea;
  const blocksToUse = blocks;

  // Fast prune using column-residue (x mod 3) feasibility for common shapes (3x3, 6x7, 2x2, 1x1).
  if (!passesResidueCheck(mask, blocksToUse, gap)) {
    return null;
  }

  const { head } = buildDLXFromMask(mask, blocksToUse, {
    allowGaps: options.allowGaps !== false,
  });
  const solutions = [];
  const ok = search(head, [], solutions);
  if (!ok || !solutions.length) return null;
  const nodes = solutions[0];
  return nodes.map((n) => ({
    x: n.row.x,
    y: n.row.y,
    width: n.row.width,
    height: n.row.height,
    typeIndex: n.row.typeIndex,
    instance: n.row.instance,
    id: `b${n.row.typeIndex}-${n.row.instance}`,
    isFiller: n.row.isFiller || false,
  }));
}

export function renderSolution(mask, placements, symbolOffset = 1) {
  const h = mask.length;
  const w = mask[0]?.length ?? 0;
  const grid = Array.from({ length: h }, (_, y) =>
    Array.from({ length: w }, (_, x) => (mask[y][x] ? "." : "0"))
  );
  placements.forEach((p) => {
    const sym = p.isFiller ? "." : String(p.typeIndex + symbolOffset);
    for (let dy = 0; dy < p.height; dy += 1) {
      for (let dx = 0; dx < p.width; dx += 1) {
        const gx = p.x + dx;
        const gy = p.y + dy;
        if (gy >= 0 && gy < h && gx >= 0 && gx < w) {
          grid[gy][gx] = sym;
        }
      }
    }
  });
  return grid.map((row) => row.join(" ")).join("\n");
}

// Residue-based feasibility check (x mod 3) for typical block sets.
function passesResidueCheck(mask, blocks, gap = 0) {
  const w = mask[0].length;
  const h = mask.length;
  const residueCounts = [0, 0, 0];
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      if (mask[y][x]) residueCounts[x % 3] += 1;
    }
  }

  let fixed = [0, 0, 0];
  let count2x2 = 0;
  for (const b of blocks) {
    const area = (b.width ?? 0) * (b.height ?? 0);
    if (b.filler && b.width === 1 && b.height === 1) {
      gap += b.count ?? 0;
      continue;
    }
    if (b.width === 2 && b.height === 2) {
      count2x2 += b.count ?? 0;
      continue;
    }
    // Blocks whose width is multiple of 3 contribute evenly across residues
    if (b.width % 3 === 0) {
      const perResidue = (b.count ?? 0) * (area / 3);
      fixed = fixed.map((v) => v + perResidue);
      continue;
    }
    // If we encounter other shapes, skip this heuristic.
    return true;
  }

  const remaining = residueCounts.map((v, i) => v - fixed[i]);
  if (remaining.some((v) => v < 0)) return false;

  // Try to satisfy remaining residues with 2x2 blocks (patterns [2,2,0]/[0,2,2]/[2,0,2]) and fillers (1x1).
  for (let a = 0; a <= count2x2; a += 1) {
    for (let b = 0; b <= count2x2 - a; b += 1) {
      const c = count2x2 - a - b;
      const rem0 = remaining[0] - (2 * a + 2 * c);
      const rem1 = remaining[1] - (2 * a + 2 * b);
      const rem2 = remaining[2] - (2 * b + 2 * c);
      if (rem0 < 0 || rem1 < 0 || rem2 < 0) continue;
      const needFillers = rem0 + rem1 + rem2;
      if (needFillers === gap) {
        return true;
      }
    }
  }
  return false;
}

// CLI harness for quick testing: node src/utils/tilingSolver.js
import { pathToFileURL } from "url";
const isMain = import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  const sampleBlocks = [
    { width: 2, height: 3, count: 4 },
    { width: 2, height: 2, count: 6 },
  ];
  const maskRect = Array.from({ length: 12 }, () =>
    Array.from({ length: 16 }, () => 1)
  );
  // Example "Big" mask: carve out a 4x4 hole in top-left
  const maskBig = Array.from({ length: 12 }, (_, y) =>
    Array.from({ length: 16 }, (_, x) => (x < 4 && y < 4 ? 0 : 1))
  );

  const blocksBig = [
    { width: 4, height: 4, count: 2 },
    { width: 3, height: 3, count: 3 },
    { width: 2, height: 4, count: 5 },
  ];

  const which = process.argv[2] === "BIG" ? maskBig : maskRect;
  const blocks = process.argv[2] === "BIG" ? blocksBig : sampleBlocks;
  const res = solveTilingMask(which, blocks, { allowGaps: true });
  if (!res) {
    console.log("No tiling found.");
  } else {
    console.log(
      `Found tiling for mask ${which.length}x${which[0].length} (${process.argv[2] || "RECT"})`
    );
    console.log(renderSolution(which, res));
    res.forEach((p) =>
      console.log(
        `block ${p.id} (type ${p.typeIndex}) at (${p.x},${p.y}) size ${p.width}x${p.height}`
      )
    );
  }
}
