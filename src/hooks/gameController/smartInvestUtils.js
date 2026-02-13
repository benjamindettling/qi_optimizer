// Helper utilities for smart-invest search.
export const sumCost = (cost, count) => ({
  coins: (cost?.coins ?? 0) * count,
  supplies: (cost?.supplies ?? 0) * count,
  chronos: (cost?.chronos ?? 0) * count,
});

export const addCost = (a, b) => ({
  coins: (a?.coins ?? 0) + (b?.coins ?? 0),
  supplies: (a?.supplies ?? 0) + (b?.supplies ?? 0),
  chronos: (a?.chronos ?? 0) + (b?.chronos ?? 0),
});

export const subtractResources = (cloneResources, base, cost) => {
  const next = cloneResources(base);
  next.coins = (next.coins ?? 0) - (cost?.coins ?? 0);
  next.supplies = (next.supplies ?? 0) - (cost?.supplies ?? 0);
  next.chronos = (next.chronos ?? 0) - (cost?.chronos ?? 0);
  return next;
};

export const maxCountForCost = (res, cost) => {
  const limits = ["coins", "supplies", "chronos"].map((key) => {
    const unit = cost?.[key] ?? 0;
    if (!unit) return Infinity;
    const have = res?.[key] ?? 0;
    return Math.floor(have / unit);
  });
  return Math.max(0, Math.min(...limits));
};

export const canAffordTotal = (infiniteResources, res, cost) =>
  infiniteResources ||
  (res?.coins ?? 0) >= (cost?.coins ?? 0) &&
  (res?.supplies ?? 0) >= (cost?.supplies ?? 0) &&
  (res?.chronos ?? 0) >= (cost?.chronos ?? 0);

export const buildCandidateLayoutFactory = ({
  churchDef,
  gutDef,
  mehrDef,
  baseLayout,
  mask,
  nextIdRef,
  buildTilingGroups,
  solveTilingMask,
  applyTilingSolution,
}) => (churchCount, gutCount, mehrCount) => {
  const extras = [];
  if (churchCount > 0) {
    extras.push({ ...churchDef, count: churchCount });
  }
  if (gutCount > 0) {
    extras.push({ ...gutDef, count: gutCount });
  }
  if (mehrCount > 0) {
    extras.push({ ...mehrDef, count: mehrCount });
  }
  const { groups, blocks } = buildTilingGroups(baseLayout, extras);
  const placements = solveTilingMask(mask, blocks, { allowGaps: true });
  if (!placements) return null;
  return applyTilingSolution(placements, groups, nextIdRef.current);
};

export const countDefsFactory = ({ churchDef, gutDef, mehrDef }) => (layout) =>
  layout.reduce(
    (acc, b) => {
      if (b.defId === churchDef.defId) acc.church += 1;
      if (b.defId === gutDef.defId) acc.gut += 1;
      if (b.defId === mehrDef.defId) acc.mehr += 1;
      return acc;
    },
    { church: 0, gut: 0, mehr: 0 },
  );

export const insertTopResult = (list, result) => {
  const next = [...list, result].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    const as = a.resources?.supplies ?? 0;
    const bs = b.resources?.supplies ?? 0;
    if (bs !== as) return bs - as;
    const ac = a.resources?.chronos ?? 0;
    const bc = b.resources?.chronos ?? 0;
    return bc - ac;
  });
  return next.slice(0, 3);
};
