/**
 * Optimized rectangle packing / tiling solver.
 * - Blocks: axis-aligned rectangles, not rotatable.
 * - Mask: boolean/0-1 grid of available cells.
 * - All blocks must be placed without overlaps and fully inside mask.
 * - If allowGaps is true (default), unused cells are allowed.
 *
 * Returns: null or placements:
 *   { x, y, width, height, typeIndex, instance, id, isFiller:false }
 */

export function solveTiling(areaWidth, areaHeight, blocks, options = {}) {
  if (areaWidth <= 0 || areaHeight <= 0) return null;
  const mask = Array.from({ length: areaHeight }, () =>
    Array.from({ length: areaWidth }, () => true)
  );
  return solveTilingMask(mask, blocks, options);
}

export function solveTilingMask(mask, blocks, options = {}) {
  if (!mask?.length || !mask[0]?.length) return null;
  if (!Array.isArray(blocks) || blocks.length === 0) return [];

  const allowGaps = options.allowGaps !== false;
  const H = mask.length;
  const W = mask[0].length;

  let availableCells = 0;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) availableCells += mask[y][x] ? 1 : 0;
  }

  // Merge identical dimensions (and same id if present) to exploit counts.
  const merged = mergeBlocks(blocks);
  const types = merged
    .map((b) => ({
      width: b.width | 0,
      height: b.height | 0,
      count: b.count | 0,
      typeIndex: b.typeIndex,
      id: b.id ?? null,
    }))
    .filter((t) => t.count > 0 && t.width > 0 && t.height > 0);

  if (types.length === 0) return [];

  const totalBlockArea = types.reduce(
    (s, t) => s + t.width * t.height * t.count,
    0
  );
  if (totalBlockArea > availableCells) return null;
  if (!allowGaps && totalBlockArea !== availableCells) return null;

  // Optional very cheap prune for common FoE-style inventories.
  const gap = availableCells - totalBlockArea;
  if (!passesResidueCheck(mask, types, gap)) return null;

  if (W <= 32) return solve32(mask, W, H, types, allowGaps);
  return solveBig(mask, W, H, types, allowGaps);
}

export function renderSolution(mask, placements, symbolOffset = 1) {
  const h = mask.length;
  const w = mask[0]?.length ?? 0;
  const grid = Array.from({ length: h }, (_, y) =>
    Array.from({ length: w }, (_, x) => (mask[y][x] ? "." : "0"))
  );
  placements.forEach((p) => {
    const sym = p.isFiller ? "." : String(p.typeIndex + symbolOffset);
    for (let dy = 0; dy < p.height; dy++) {
      for (let dx = 0; dx < p.width; dx++) {
        const gx = p.x + dx;
        const gy = p.y + dy;
        if (gy >= 0 && gy < h && gx >= 0 && gx < w) grid[gy][gx] = sym;
      }
    }
  });
  return grid.map((row) => row.join(" ")).join("\n");
}

/* ---------------------- Fast path: W <= 32 ---------------------- */

function solve32(mask, W, H, typesIn, allowGaps) {
  const baseRows = new Uint32Array(H);
  const freeRows = new Uint32Array(H);

  for (let y = 0; y < H; y++) {
    let r = 0;
    for (let x = 0; x < W; x++) if (mask[y][x]) r = (r | (1 << x)) >>> 0;
    baseRows[y] = r;
    freeRows[y] = r;
  }

  const availableCells = countBitsRows32(baseRows);

  const maxBW = Math.max(...typesIn.map((t) => t.width));
  const rangeMasks = precomputeRangeMasks32(W, maxBW);

  // Order types: larger area first; then fewer placements in base mask (more constrained).
  const types = typesIn
    .map((t) => {
      const area = t.width * t.height;
      const placementCount = countPlacementsInMask32(
        baseRows,
        W,
        H,
        rangeMasks,
        t.width,
        t.height
      );
      return { ...t, area, placementCount };
    })
    .sort(
      (a, b) =>
        b.area - a.area ||
        a.placementCount - b.placementCount ||
        b.count - a.count
    );

  for (const t of types) if (t.count > 0 && t.placementCount === 0) return null;

  const { multipliers, countsKey0, counts0 } = buildCountsKey(types);

  let boardKey = buildBoardKey32(freeRows, W);

  let cellsLeft = availableCells;
  let areaLeft = types.reduce((s, t) => s + t.area * t.count, 0);
  let countsKey = countsKey0;
  const counts = counts0;

  const placedSoFar = new Uint16Array(types.length);
  const solution = [];

  const memo = new Map(); // Map<boardKey, Set<countsKey>>
  const oldRowsPool = Array.from({ length: 9 }, () => []);

  const dfs = () => {
    if (areaLeft === 0) return allowGaps ? true : cellsLeft === 0;
    if (cellsLeft < areaLeft) return false;

    const bucket = memo.get(boardKey);
    if (bucket && bucket.has(countsKey)) return false;

    const pivot = findPivot32(freeRows);
    if (!pivot) return false;
    const { x: cx, y: cy, bit: cbit } = pivot;

    for (let ti = 0; ti < types.length; ti++) {
      if (counts[ti] === 0) continue;
      const t = types[ti];
      const bw = t.width;
      const bh = t.height;

      for (let dy = bh - 1; dy >= 0; dy--) {
        const ty = cy - dy;
        if (ty < 0 || ty + bh > H) continue;

        for (let dx = bw - 1; dx >= 0; dx--) {
          const tx = cx - dx;
          if (tx < 0 || tx + bw > W) continue;

          if (!canPlace32(freeRows, rangeMasks, tx, ty, bw, bh)) continue;

          const old = applyPlace32(
            freeRows,
            rangeMasks,
            tx,
            ty,
            bw,
            bh,
            oldRowsPool
          );
          const area = t.area;

          cellsLeft -= area;
          areaLeft -= area;
          counts[ti]--;
          countsKey -= multipliers[ti];

          const instance = placedSoFar[ti]++;
          solution.push({
            x: tx,
            y: ty,
            width: bw,
            height: bh,
            typeIndex: t.typeIndex,
            instance,
            id: `b${t.typeIndex}-${instance}`,
            isFiller: false,
          });

          const pm = placementBoardMask32(rangeMasks, W, tx, ty, bw, bh);
          boardKey ^= pm;

          if (dfs()) return true;

          boardKey ^= pm;
          solution.pop();
          placedSoFar[ti]--;
          countsKey += multipliers[ti];
          counts[ti]++;
          areaLeft += area;
          cellsLeft += area;

          undoPlace32(freeRows, ty, old, oldRowsPool);
        }
      }
    }

    // Allow skipping pivot cell if gaps are allowed and we still have capacity.
    if (allowGaps && cellsLeft - 1 >= areaLeft) {
      const oldRow = freeRows[cy];
      freeRows[cy] = (oldRow & ~cbit) >>> 0;
      cellsLeft -= 1;
      boardKey ^= BigInt(cbit >>> 0) << BigInt(cy * W);

      if (dfs()) return true;

      boardKey ^= BigInt(cbit >>> 0) << BigInt(cy * W);
      cellsLeft += 1;
      freeRows[cy] = oldRow;
    }

    let b = memo.get(boardKey);
    if (!b) memo.set(boardKey, (b = new Set()));
    b.add(countsKey);
    return false;
  };

  return dfs() ? solution : null;
}

function findPivot32(freeRows) {
  for (let y = 0; y < freeRows.length; y++) {
    const row = freeRows[y] >>> 0;
    if (!row) continue;
    const lsb = row & -row;
    const x = 31 - Math.clz32(lsb);
    return { x, y, bit: lsb };
  }
  return null;
}

function canPlace32(freeRows, rangeMasks, tx, ty, bw, bh) {
  const rowMask = rangeMasks[bw][tx];
  for (let dy = 0; dy < bh; dy++) {
    if (((freeRows[ty + dy] >>> 0) & rowMask) !== rowMask) return false;
  }
  return true;
}

function applyPlace32(freeRows, rangeMasks, tx, ty, bw, bh, oldRowsPool) {
  const rowMask = rangeMasks[bw][tx];
  const old = oldRowsPool[bh].pop() ?? new Uint32Array(bh);
  for (let dy = 0; dy < bh; dy++) {
    const yi = ty + dy;
    old[dy] = freeRows[yi];
    freeRows[yi] = (freeRows[yi] & ~rowMask) >>> 0;
  }
  return old;
}

function undoPlace32(freeRows, ty, oldRows, oldRowsPool) {
  for (let dy = 0; dy < oldRows.length; dy++) freeRows[ty + dy] = oldRows[dy];
  oldRowsPool[oldRows.length].push(oldRows);
}

function placementBoardMask32(rangeMasks, W, tx, ty, bw, bh) {
  const rowMask = BigInt(rangeMasks[bw][tx] >>> 0);
  let m = 0n;
  const w = BigInt(W);
  for (let dy = 0; dy < bh; dy++) m |= rowMask << (BigInt(ty + dy) * w);
  return m;
}

function buildBoardKey32(rows, W) {
  let key = 0n;
  const w = BigInt(W);
  for (let y = 0; y < rows.length; y++)
    key |= BigInt(rows[y] >>> 0) << (BigInt(y) * w);
  return key;
}

function precomputeRangeMasks32(W, maxBW) {
  const masks = Array.from({ length: maxBW + 1 }, () => null);
  for (let bw = 1; bw <= maxBW; bw++) {
    const base = ((1 << bw) - 1) >>> 0;
    const arr = new Uint32Array(Math.max(0, W - bw + 1));
    for (let x = 0; x <= W - bw; x++) arr[x] = (base << x) >>> 0;
    masks[bw] = arr;
  }
  return masks;
}

function countPlacementsInMask32(baseRows, W, H, rangeMasks, bw, bh) {
  if (bw > W || bh > H) return 0;
  let cnt = 0;
  for (let y = 0; y <= H - bh; y++) {
    for (let x = 0; x <= W - bw; x++) {
      const rowMask = rangeMasks[bw][x];
      let ok = true;
      for (let dy = 0; dy < bh; dy++) {
        if (((baseRows[y + dy] >>> 0) & rowMask) !== rowMask) {
          ok = false;
          break;
        }
      }
      if (ok) cnt++;
    }
  }
  return cnt;
}

function countBitsRows32(rows) {
  let total = 0;
  for (let i = 0; i < rows.length; i++) total += popcount32(rows[i] >>> 0);
  return total;
}

function popcount32(v) {
  v = v - ((v >>> 1) & 0x55555555);
  v = (v & 0x33333333) + ((v >>> 2) & 0x33333333);
  return (((v + (v >>> 4)) & 0x0f0f0f0f) * 0x01010101) >>> 24;
}

/* ---------------------- Fallback: W > 32 (BigInt rows) ---------------------- */
/* (Kept intentionally simple; if you expect W > 32 frequently, we can further tune it.) */

function solveBig(mask, W, H, typesIn, allowGaps) {
  const baseRows = new Array(H);
  const freeRows = new Array(H);

  for (let y = 0; y < H; y++) {
    let r = 0n;
    for (let x = 0; x < W; x++) if (mask[y][x]) r |= 1n << BigInt(x);
    baseRows[y] = r;
    freeRows[y] = r;
  }

  const availableCells = baseRows.reduce((s, r) => s + popcountBig(r), 0);

  const maxBW = Math.max(...typesIn.map((t) => t.width));
  const rangeMasks = precomputeRangeMasksBig(W, maxBW);

  const types = typesIn
    .map((t) => {
      const area = t.width * t.height;
      const placementCount = countPlacementsInMaskBig(
        baseRows,
        W,
        H,
        rangeMasks,
        t.width,
        t.height
      );
      return { ...t, area, placementCount };
    })
    .sort(
      (a, b) =>
        b.area - a.area ||
        a.placementCount - b.placementCount ||
        b.count - a.count
    );

  for (const t of types) if (t.count > 0 && t.placementCount === 0) return null;

  const { multipliers, countsKey0, counts0 } = buildCountsKey(types);
  const wBig = BigInt(W);

  let boardKey = buildBoardKeyBig(freeRows, W);
  let cellsLeft = availableCells;
  let areaLeft = types.reduce((s, t) => s + t.area * t.count, 0);
  let countsKey = countsKey0;
  const counts = counts0;

  const placedSoFar = new Uint16Array(types.length);
  const solution = [];
  const memo = new Map();
  const oldRowsPool = Array.from({ length: 9 }, () => []);

  const dfs = () => {
    if (areaLeft === 0) return allowGaps ? true : cellsLeft === 0;
    if (cellsLeft < areaLeft) return false;

    const bucket = memo.get(boardKey);
    if (bucket && bucket.has(countsKey)) return false;

    const pivot = findPivotBig(freeRows);
    if (!pivot) return false;
    const { x: cx, y: cy, bit: cbit } = pivot;

    for (let ti = 0; ti < types.length; ti++) {
      if (counts[ti] === 0) continue;
      const t = types[ti];
      const bw = t.width,
        bh = t.height;

      for (let dy = bh - 1; dy >= 0; dy--) {
        const ty = cy - dy;
        if (ty < 0 || ty + bh > H) continue;

        for (let dx = bw - 1; dx >= 0; dx--) {
          const tx = cx - dx;
          if (tx < 0 || tx + bw > W) continue;

          if (!canPlaceBig(freeRows, rangeMasks, tx, ty, bw, bh)) continue;

          const old = applyPlaceBig(
            freeRows,
            rangeMasks,
            tx,
            ty,
            bw,
            bh,
            oldRowsPool
          );
          const area = t.area;

          cellsLeft -= area;
          areaLeft -= area;
          counts[ti]--;
          countsKey -= multipliers[ti];

          const instance = placedSoFar[ti]++;
          solution.push({
            x: tx,
            y: ty,
            width: bw,
            height: bh,
            typeIndex: t.typeIndex,
            instance,
            id: `b${t.typeIndex}-${instance}`,
            isFiller: false,
          });

          const pm = placementBoardMaskBig(rangeMasks, wBig, tx, ty, bw, bh);
          boardKey ^= pm;

          if (dfs()) return true;

          boardKey ^= pm;
          solution.pop();
          placedSoFar[ti]--;
          countsKey += multipliers[ti];
          counts[ti]++;
          areaLeft += area;
          cellsLeft += area;

          undoPlaceBig(freeRows, ty, old, oldRowsPool);
        }
      }
    }

    if (allowGaps && cellsLeft - 1 >= areaLeft) {
      const oldRow = freeRows[cy];
      freeRows[cy] = oldRow & ~cbit;
      cellsLeft--;
      boardKey ^= cbit << (BigInt(cy) * wBig);

      if (dfs()) return true;

      boardKey ^= cbit << (BigInt(cy) * wBig);
      cellsLeft++;
      freeRows[cy] = oldRow;
    }

    let b = memo.get(boardKey);
    if (!b) memo.set(boardKey, (b = new Set()));
    b.add(countsKey);
    return false;
  };

  return dfs() ? solution : null;
}

function findPivotBig(rows) {
  for (let y = 0; y < rows.length; y++) {
    if (rows[y] === 0n) continue;
    const lsb = rows[y] & -rows[y];
    return { x: ctzBig(lsb), y, bit: lsb };
  }
  return null;
}

function ctzBig(oneHot) {
  let off = 0;
  let v = oneHot;
  while (true) {
    const chunk = Number(v & 0xffffffffn);
    if (chunk) return off + (31 - Math.clz32(chunk & -chunk));
    v >>= 32n;
    off += 32;
  }
}

function canPlaceBig(rows, rangeMasks, tx, ty, bw, bh) {
  const rowMask = rangeMasks[bw][tx];
  for (let dy = 0; dy < bh; dy++)
    if ((rows[ty + dy] & rowMask) !== rowMask) return false;
  return true;
}

function applyPlaceBig(rows, rangeMasks, tx, ty, bw, bh, pool) {
  const rowMask = rangeMasks[bw][tx];
  const old = pool[bh].pop() ?? new Array(bh);
  for (let dy = 0; dy < bh; dy++) {
    const yi = ty + dy;
    old[dy] = rows[yi];
    rows[yi] = rows[yi] & ~rowMask;
  }
  return old;
}

function undoPlaceBig(rows, ty, old, pool) {
  for (let dy = 0; dy < old.length; dy++) rows[ty + dy] = old[dy];
  pool[old.length].push(old);
}

function placementBoardMaskBig(rangeMasks, wBig, tx, ty, bw, bh) {
  const rowMask = rangeMasks[bw][tx];
  let m = 0n;
  for (let dy = 0; dy < bh; dy++) m |= rowMask << (BigInt(ty + dy) * wBig);
  return m;
}

function buildBoardKeyBig(rows, W) {
  const w = BigInt(W);
  let key = 0n;
  for (let y = 0; y < rows.length; y++) key |= rows[y] << (BigInt(y) * w);
  return key;
}

function precomputeRangeMasksBig(W, maxBW) {
  const masks = Array.from({ length: maxBW + 1 }, () => null);
  for (let bw = 1; bw <= maxBW; bw++) {
    const base = (1n << BigInt(bw)) - 1n;
    const arr = new Array(Math.max(0, W - bw + 1));
    for (let x = 0; x <= W - bw; x++) arr[x] = base << BigInt(x);
    masks[bw] = arr;
  }
  return masks;
}

function countPlacementsInMaskBig(rows, W, H, rangeMasks, bw, bh) {
  if (bw > W || bh > H) return 0;
  let cnt = 0;
  for (let y = 0; y <= H - bh; y++) {
    for (let x = 0; x <= W - bw; x++) {
      const rowMask = rangeMasks[bw][x];
      let ok = true;
      for (let dy = 0; dy < bh; dy++) {
        if ((rows[y + dy] & rowMask) !== rowMask) {
          ok = false;
          break;
        }
      }
      if (ok) cnt++;
    }
  }
  return cnt;
}

function popcountBig(v) {
  let n = v,
    c = 0;
  while (n) {
    n &= n - 1n;
    c++;
  }
  return c;
}

/* ---------------------- Shared helpers ---------------------- */

function mergeBlocks(blocks) {
  const out = [];
  const byKey = new Map();
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i];
    if (!b) continue;
    const w = b.width | 0,
      h = b.height | 0,
      c = b.count | 0;
    if (w <= 0 || h <= 0 || c <= 0) continue;
    const id = b.id ?? null;
    const key = `${id ?? ""}:${w}x${h}`;
    const j = byKey.get(key);
    if (j === undefined) {
      byKey.set(key, out.length);
      out.push({ width: w, height: h, count: c, id, typeIndex: i });
    } else {
      out[j].count += c;
    }
  }
  return out;
}

function buildCountsKey(types) {
  const n = types.length;
  const counts = new Uint16Array(n);
  const multipliers = new Array(n);

  let mul = 1n;
  let key = 0n;
  for (let i = 0; i < n; i++) {
    const c = types[i].count | 0;
    counts[i] = c;
    multipliers[i] = mul;
    key += BigInt(c) * mul;
    mul *= BigInt(c + 1);
  }
  return { counts0: counts, multipliers, countsKey0: key };
}

// Residue-based feasibility check (x mod 3) for common 6x7/3x3/2x2 sets.
function passesResidueCheck(mask, blocks, gap = 0) {
  const w = mask[0].length,
    h = mask.length;
  const residueCounts = [0, 0, 0];
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) if (mask[y][x]) residueCounts[x % 3]++;

  let fixed = [0, 0, 0];
  let count2x2 = 0;

  for (const b of blocks) {
    const area = (b.width ?? 0) * (b.height ?? 0);
    if (b.width === 2 && b.height === 2) {
      count2x2 += b.count ?? 0;
      continue;
    }
    if (b.width % 3 === 0) {
      const perResidue = (b.count ?? 0) * (area / 3);
      fixed = fixed.map((v) => v + perResidue);
      continue;
    }
    return true; // heuristic not applicable
  }

  const remaining = residueCounts.map((v, i) => v - fixed[i]);
  if (remaining.some((v) => v < 0)) return false;

  for (let a = 0; a <= count2x2; a++) {
    for (let b = 0; b <= count2x2 - a; b++) {
      const c = count2x2 - a - b;
      const rem0 = remaining[0] - (2 * a + 2 * c);
      const rem1 = remaining[1] - (2 * a + 2 * b);
      const rem2 = remaining[2] - (2 * b + 2 * c);
      if (rem0 < 0 || rem1 < 0 || rem2 < 0) continue;
      if (rem0 + rem1 + rem2 === gap) return true;
    }
  }
  return false;
}
