// src/utils/layoutUtils.js

import { BOARD_WIDTH, BOARD_HEIGHT } from "../config/boardConfig";

/**
 * Clone the layout array, copying each item shallowly.
 */
export const cloneLayout = (layout) => layout.map((item) => ({ ...item }));

/**
 * Find the first instance that covers a given (x, y) cell.
 */
export const findInstanceAt = (layout, x, y) =>
  layout.find(
    (item) =>
      x >= item.x &&
      x < item.x + item.width &&
      y >= item.y &&
      y < item.y + item.height
  );

/**
 * Find the first instance that overlaps the given rectangle.
 */
export const findOverlap = (layout, x, y, w, h, ignoreId) =>
  layout.find((item) => {
    if (item.id === ignoreId) return false;
    const separated =
      x + w <= item.x ||
      item.x + item.width <= x ||
      y + h <= item.y ||
      item.y + item.height <= y;
    return !separated;
  });

/**
 * Check if a rectangle fits fully on the board.
 */
const fitsOnBoard = (x, y, w, h) =>
  x >= 0 && y >= 0 && x + w <= BOARD_WIDTH && y + h <= BOARD_HEIGHT;

/**
 * Check if a rectangular area is free:
 * - inside board bounds
 * - all cells are unlocked according to `isCellUnlocked(x, y)`
 * - no overlapping layout items (except optionally `ignoreId`)
 */
export const isAreaFree = (
  layout,
  x,
  y,
  w,
  h,
  ignoreId = null,
  isCellUnlocked
) => {
  if (!fitsOnBoard(x, y, w, h)) return false;

  if (typeof isCellUnlocked === "function") {
    for (let cy = y; cy < y + h; cy += 1) {
      for (let cx = x; cx < x + w; cx += 1) {
        if (!isCellUnlocked(cx, cy)) return false;
      }
    }
  }

  return layout.every((item) => {
    if (item.id === ignoreId) return true;
    const separated =
      x + w <= item.x ||
      item.x + item.width <= x ||
      y + h <= item.y ||
      item.y + item.height <= y;
    return separated;
  });
};
