import { GOODS_TYPES } from "../../config/boardConfig";

export const computeBuildingHarvest = (
  inst,
  libraryMap,
  stats,
  { qaHoursPerHarvest = 0 } = {}
) => {
  const def = libraryMap[inst.defId];
  if (!def)
    return { coins: 0, supplies: 0, chronos: 0, goods: {}, qa: 0 };
  const happyMulti = stats.happyMulti ?? 1;
  const coinMulti = 1 + (stats.coinBoost ?? 0) + (happyMulti - 1);
  const supplyMulti = 1 + (stats.supplyBoost ?? 0) + (happyMulti - 1);
  const goods = {};
  const qaPerHarvest = (def.quantumActions ?? 0) * qaHoursPerHarvest;
  switch (def.category) {
    case "housing": {
      const prod = def.production ?? {};
      return {
        coins: Math.round((prod.coins ?? 0) * coinMulti),
        supplies: Math.round((prod.supplies ?? 0) * supplyMulti),
        chronos: Math.round((prod.chronos ?? 0) * happyMulti),
        goods,
        qa: 0,
      };
    }
    case "production": {
      const prod = def.production ?? {};
      return {
        coins: Math.round((prod.coins ?? 0) * coinMulti),
        supplies: Math.round((prod.supplies ?? 0) * supplyMulti),
        chronos: Math.round((prod.chronos ?? 0) * happyMulti),
        goods,
        qa: 0,
      };
    }
    case "culture": {
      const chrono = def.production?.chronos ?? def.chronos ?? 0;
      return {
        coins: 0,
        supplies: 0,
        chronos: Math.round(chrono * happyMulti),
        goods,
        qa: qaPerHarvest,
      };
    }
    case "goods": {
      return { coins: 0, supplies: 0, chronos: 0, goods, qa: 0 };
    }
    case "townhall": {
      const prod = def.production ?? {};
      return {
        coins: prod.coins ?? 0,
        supplies: prod.supplies ?? 0,
        chronos: prod.chronos ?? 0,
        goods,
        qa: 0,
      };
    }
    default:
      return { coins: 0, supplies: 0, chronos: 0, goods, qa: 0 };
  }
};

export const aggregateHarvest = (
  instances,
  libraryMap,
  stats,
  options = {}
) => {
  const total = { coins: 0, supplies: 0, chronos: 0, goods: {}, qa: 0 };
  instances.forEach((inst) => {
    const delta = computeBuildingHarvest(inst, libraryMap, stats, options);
    total.coins += delta.coins ?? 0;
    total.supplies += delta.supplies ?? 0;
    total.chronos += delta.chronos ?? 0;
    total.qa += delta.qa ?? 0;
    GOODS_TYPES.forEach((g) => {
      total.goods[g] = (total.goods[g] ?? 0) + (delta.goods[g] ?? 0);
    });
  });
  return total;
};

export const finishProductionsReadyMap = (
  layout,
  libraryMap,
  prevReadyMap = {},
  buildLocks = {}
) =>
  layout.reduce((acc, b) => {
    const def = libraryMap[b.defId];
    const allowed =
      def &&
      (def.category === "housing" ||
        def.category === "production" ||
        def.category === "townhall" ||
        def.category === "culture");
    const prev = prevReadyMap[b.id] ?? false;
    if (buildLocks[b.id]) {
      // Freshly unlocked buildings should not be harvestable on the same jump.
      acc[b.id] = false;
    } else {
      acc[b.id] = allowed ? true : prev;
    }
    return acc;
  }, {});

export const getLockedCultureAutoHarvest = (
  layout,
  libraryMap,
  buildLocks = {},
  { qaHoursPerHarvest = 0 } = {}
) => {
  const lockedCultureIds = [];
  let qa = 0;

  (layout ?? []).forEach((inst) => {
    if (!buildLocks?.[inst.id]) return;
    const def = libraryMap?.[inst.defId];
    if (def?.category !== "culture") return;
    lockedCultureIds.push(inst.id);
    qa += (def.quantumActions ?? 0) * qaHoursPerHarvest;
  });

  return { lockedCultureIds, qa };
};

export const getCultureAutoHarvest = (
  layout,
  libraryMap,
  buildLocks = {},
  stats = {},
  { qaHoursPerHarvest = 0 } = {}
) => {
  const cultureInstances = [];
  const cultureIds = [];
  const lockedCultureIds = [];

  (layout ?? []).forEach((inst) => {
    const def = libraryMap?.[inst.defId];
    if (def?.category !== "culture") return;
    cultureInstances.push(inst);
    cultureIds.push(inst.id);
    if (buildLocks?.[inst.id]) {
      lockedCultureIds.push(inst.id);
    }
  });

  const total =
    cultureInstances.length > 0
      ? aggregateHarvest(cultureInstances, libraryMap, stats, {
          qaHoursPerHarvest,
        })
      : { coins: 0, supplies: 0, chronos: 0, goods: {}, qa: 0 };

  return { cultureIds, lockedCultureIds, total };
};

export const buildHarvestResult = ({ total, resources }) => ({
  coins: (resources.coins ?? 0) + total.coins,
  supplies: (resources.supplies ?? 0) + total.supplies,
  chronos: (resources.chronos ?? 0) + total.chronos,
  quantumActions: (resources.quantumActions ?? 0) + (total.qa ?? 0),
  goods: GOODS_TYPES.reduce(
    (acc, g) => ({
      ...acc,
      [g]: (resources.goods?.[g] ?? 0) + (total.goods[g] ?? 0),
    }),
    {}
  ),
});
