import { solveTilingMask, renderSolution } from "./tilingSolver.js";

/**
 * Convert a coarse "4x4 tile map" into a full-resolution mask.
 *
 * tiles: array of strings containing only '0'/'1', all same length.
 * Each '1' expands to a tileSize x tileSize available region.
 *
 * Returns:
 *   boolean[][] maskBig of size (tilesH*tileSize) x (tilesW*tileSize)
 */
export function maskFrom4x4Tiles(tiles, tileSize = 4) {
  if (!Array.isArray(tiles) || tiles.length === 0) {
    throw new Error(
      "maskFrom4x4Tiles: tiles must be a non-empty array of strings."
    );
  }

  const tilesH = tiles.length;
  const tilesW = tiles[0].length;

  for (let y = 0; y < tilesH; y++) {
    if (typeof tiles[y] !== "string") {
      throw new Error(`maskFrom4x4Tiles: tiles[${y}] must be a string.`);
    }
    if (tiles[y].length !== tilesW) {
      throw new Error(
        `maskFrom4x4Tiles: all rows must have same length. Row ${y} has ${tiles[y].length}, expected ${tilesW}.`
      );
    }
    if (!/^[01]+$/.test(tiles[y])) {
      throw new Error(
        `maskFrom4x4Tiles: row ${y} contains invalid characters. Use only '0'/'1'.`
      );
    }
  }

  const H = tilesH * tileSize;
  const W = tilesW * tileSize;

  const maskBig = Array.from({ length: H }, () => Array(W).fill(false));

  for (let ty = 0; ty < tilesH; ty++) {
    const row = tiles[ty];
    for (let tx = 0; tx < tilesW; tx++) {
      if (row[tx] !== "1") continue;
      const startY = ty * tileSize;
      const startX = tx * tileSize;
      for (let dy = 0; dy < tileSize; dy++) {
        for (let dx = 0; dx < tileSize; dx++) {
          maskBig[startY + dy][startX + dx] = true;
        }
      }
    }
  }

  return maskBig;
}

/**
 * Convenience: build the same tile map from a multiline string.
 *
 * Example:
 *   maskFrom4x4TilesStr(`
 *   11110
 *   11111
 *   11110
 *   11110
 *   11100
 *   `)
 */
export function maskFrom4x4TilesStr(str, tileSize = 4) {
  if (typeof str !== "string") {
    throw new Error("maskFrom4x4TilesStr: expected a string.");
  }
  const tiles = str
    .trim()
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  return maskFrom4x4Tiles(tiles, tileSize);
}

/**
 * 4x4-tile area definition (each '1' is a 4x4 available region).
 */
const tiles = ["11100", "11110", "11100", "11100", "11100"];

const maskBig = maskFrom4x4Tiles(tiles);

const cases = [
  {
    name: "Feasible (1,17,10)",
    blocks: [
      { width: 6, height: 7, count: 1 }, // Rathaus
      { width: 3, height: 3, count: 14 }, //3x3 Buildings, such as Kirche or Brauerei
      { width: 2, height: 2, count: 18 }, //2x2 Buildings, such as Gutshaus or Schindelhaus
    ],
    expect: true,
  },
  {
    name: "Infeasible (area overflow)",
    blocks: [
      { width: 6, height: 7, count: 1 },
      { width: 3, height: 3, count: 15 },
      { width: 2, height: 2, count: 19 },
    ],
    expect: true,
  },
];

cases.forEach((c) => {
  console.log(`\n--- ${c.name} ---`);
  const placements = solveTilingMask(maskBig, c.blocks, { allowGaps: true });
  const ok = !!placements;

  if (ok !== c.expect) {
    console.error(
      `Unexpected result: got ${ok ? "tiling" : "no tiling"}, expected ${
        c.expect ? "tiling" : "no tiling"
      }`
    );
    process.exit(1);
  }

  if (!placements) {
    console.log("No tiling (pruned quickly).");
    return;
  }

  console.log("Tiling found. Simplified layout:");
  console.log(renderSolution(maskBig, placements, 1));

  console.log("\nPlacements:");
  placements.forEach((p) =>
    console.log(
      `type ${p.typeIndex + 1}${p.isFiller ? " (filler)" : ""} at (${p.x},${
        p.y
      }) size ${p.width}x${p.height}`
    )
  );
});
