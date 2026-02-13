#!/usr/bin/env node
/**
 * build_fit_db.mjs
 *
 * Given a coarse 4x4-tile area (array of "0/1" strings), compute for each n (number of 3x3 buildings)
 * the maximum r (number of 2x2 buildings) that can fit alongside:
 *   - 1x Townhall (6x7) (always included)
 *   - n x (3x3)
 *   - r x (2x2)
 * within the area (mask), with allowGaps=true (unused area allowed).
 *
 * Results are stored in a JSON "database" file. Running again with the same tiles will exit immediately.
 *
 * Usage:
 *   node build_fit_db.mjs --tiles 11110,11111,11110,11110,11100
 *
 * Or edit the `tiles` constant at the bottom and run:
 *   node build_fit_db.mjs
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { solveTilingMask } from "./tilingSolver.js";

/* ----------------------- Helpers: tiles -> mask ----------------------- */

function maskFrom4x4Tiles(tiles, tileSize = 4) {
  if (!Array.isArray(tiles) || tiles.length === 0) {
    throw new Error(
      "maskFrom4x4Tiles: tiles must be a non-empty array of strings."
    );
  }

  const tilesH = tiles.length;
  const tilesW = tiles[0].length;

  for (let y = 0; y < tilesH; y++) {
    if (typeof tiles[y] !== "string")
      throw new Error(`tiles[${y}] must be a string`);
    if (tiles[y].length !== tilesW)
      throw new Error("All tile rows must have the same length.");
    if (!/^[01]+$/.test(tiles[y]))
      throw new Error("Tiles may only contain '0' and '1'.");
  }

  const H = tilesH * tileSize;
  const W = tilesW * tileSize;

  const mask = Array.from({ length: H }, () => Array(W).fill(false));
  for (let ty = 0; ty < tilesH; ty++) {
    for (let tx = 0; tx < tilesW; tx++) {
      if (tiles[ty][tx] !== "1") continue;
      const y0 = ty * tileSize;
      const x0 = tx * tileSize;
      for (let dy = 0; dy < tileSize; dy++) {
        for (let dx = 0; dx < tileSize; dx++) mask[y0 + dy][x0 + dx] = true;
      }
    }
  }
  return mask;
}

function countAvailable(mask) {
  let c = 0;
  for (let y = 0; y < mask.length; y++) {
    const row = mask[y];
    for (let x = 0; x < row.length; x++) if (row[x]) c++;
  }
  return c;
}

function normalizeTilesKey(tiles) {
  // Canonical key: join with '\n'
  return tiles.join("\n");
}

/* ----------------------- Database I/O ----------------------- */

function loadDb(dbPath) {
  if (!fs.existsSync(dbPath)) return { version: 1, entries: {} };
  const raw = fs.readFileSync(dbPath, "utf8");
  const parsed = JSON.parse(raw);
  if (!parsed || typeof parsed !== "object") return { version: 1, entries: {} };
  if (!parsed.entries) parsed.entries = {};
  if (!parsed.version) parsed.version = 1;
  return parsed;
}

function saveDb(dbPath, db) {
  fs.writeFileSync(dbPath, JSON.stringify(db, null, 2), "utf8");
}

/* ----------------------- Core computation ----------------------- */

function canFit(mask, n3, n2) {
  const blocks = [
    { width: 6, height: 7, count: 1, id: "townhall" },
    { width: 3, height: 3, count: n3, id: "3x3" },
    { width: 2, height: 2, count: n2, id: "2x2" },
  ];
  const sol = solveTilingMask(mask, blocks, { allowGaps: true });
  return sol !== null;
}

function computeMax2x2Per3x3(mask) {
  const avail = countAvailable(mask);
  const townhallArea = 6 * 7;
  if (avail < townhallArea) {
    return { avail, results: [] };
  }

  const maxN3 = Math.floor((avail - townhallArea) / 9);
  const results = new Array(maxN3 + 1).fill(0);

  // Monotonicity: increasing n3 cannot increase max n2.
  let prevMax2 = Math.floor((avail - townhallArea) / 4);

  for (let n3 = 0; n3 <= maxN3; n3++) {
    const remainingAfter3 = avail - townhallArea - 9 * n3;
    if (remainingAfter3 < 0) break;

    const hardUpper = Math.min(prevMax2, Math.floor(remainingAfter3 / 4));
    if (hardUpper < 0) {
      results[n3] = 0;
      prevMax2 = 0;
      continue;
    }

    // If even townhall + n3 doesn't fit, stop (no higher n3 will fit either)
    if (!canFit(mask, n3, 0)) {
      return { avail, results: results.slice(0, n3) };
    }

    // Binary search for maximal n2 in [0, hardUpper]
    let lo = 0,
      hi = hardUpper,
      best = 0;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (canFit(mask, n3, mid)) {
        best = mid;
        lo = mid + 1;
      } else {
        hi = mid - 1;
      }
    }

    results[n3] = best;
    prevMax2 = best;
  }

  return { avail, results };
}

/* ----------------------- CLI / Entrypoint ----------------------- */

function parseTilesFromArgs(argv) {
  const idx = argv.indexOf("--tiles");
  if (idx === -1) return null;
  const val = argv[idx + 1];
  if (!val) throw new Error("Expected --tiles <row1,row2,...>");
  const tiles = val
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (tiles.length === 0) throw new Error("No tiles provided.");
  return tiles;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.join(__dirname, "fitDatabase.json");

// 1) Get tiles either from CLI or from inline constant
const cliTiles = parseTilesFromArgs(process.argv);

const tiles = cliTiles ?? [
  // Default example (edit as desired):
  "1111",
  "1110",
  "1110",
  "1110",
  "1110",
];

const key = normalizeTilesKey(tiles);

// 2) Load DB, check for duplicates
const db = loadDb(dbPath);
if (db.entries[key]) {
  console.log("Tiles setup already exists in database. No work performed.");
  process.exit(0);
}

// 3) Build mask and compute
const mask = maskFrom4x4Tiles(tiles, 4);
const { avail, results } = computeMax2x2Per3x3(mask);

// 4) Save entry
db.entries[key] = {
  tiles,
  tileSize: 4,
  computedAt: new Date().toISOString(),
  availableCells: avail,
  resultsMax2x2By3x3: results,
  note: "Index n => max # of 2x2 that fit with n # of 3x3, always including 1 townhall (6x7). allowGaps=true.",
};

saveDb(dbPath, db);

console.log("Saved new entry to fitDatabase.json");
console.log(`Tiles key:\n${key}`);
console.log(`Available cells: ${avail}`);
console.log(
  `Computed entries: ${results.length} (n3 from 0..${results.length - 1})`
);
