export const REGION_SIZE = 4;
export const REGION_COLS = 7;
export const REGION_ROWS = 7;
export const BOARD_WIDTH = REGION_COLS * REGION_SIZE;
export const BOARD_HEIGHT = REGION_ROWS * REGION_SIZE;
export const REGION_GOODS_COSTS = [
  30, 60, 90, 130, 180, 240, 310, 390, 480, 580, 700,
];
export const REGION_SHARD_COSTS = [
  100, 150, 200, 250, 300, 350, 400, 450, 500, 550, 600, 650, 700, 750, 800,
];
export const GOODS_TYPES = [
  "Kupfer",
  "Honig",
  "Stein",
  "Seil",
  "Schiesspulver",
];

export const REGION_MASK = [
  ["N", "N", "U", "U", "U", "U", "N"],
  ["N", "U", "S", "S", "S", "S", "U"],
  ["N", "U", "S", "S", "S", "S", "U"],
  ["N", "U", "S", "S", "S", "S", "U"],
  ["U", "U", "U", "U", "U", "U", "U"],
  ["U", "U", "U", "U", "U", "U", "N"],
  ["U", "U", "U", "U", "U", "U", "N"],
];

export const initialRegions = () =>
  REGION_MASK.flatMap((row) => row.map((cell) => cell === "S"));

export const initialGoods = () =>
  GOODS_TYPES.reduce((acc, key) => ({ ...acc, [key]: 30 }), {});
