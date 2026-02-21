const GOODS_ICON_NAME_OVERRIDES = {
  Stein: "Backstein",
  Schießpulver: "Schiesspulver",
  Schiesspulver: "Schiesspulver",
  "SchieÃŸpulver": "Schiesspulver",
};

export function getGoodIconName(goodKey) {
  const key = String(goodKey ?? "").trim();
  if (!key) return "Kupfer";
  return GOODS_ICON_NAME_OVERRIDES[key] ?? key;
}

export function getGoodIconPath(goodKey) {
  return `/goods/${getGoodIconName(goodKey)}.webp`;
}

