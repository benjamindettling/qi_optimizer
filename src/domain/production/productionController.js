import { GOODS_TYPES } from "../../config/boardConfig";

export const computeBuildingHarvest = (inst, libraryMap, stats) => {
  const def = libraryMap[inst.defId];
  if (!def) return { coins: 0, supplies: 0, chronos: 0, goods: {} };
  const happyMulti = stats.happyMulti ?? 1;
  const coinMulti = 1 + (stats.coinBoost ?? 0) + (happyMulti - 1);
  const supplyMulti = 1 + (stats.supplyBoost ?? 0) + (happyMulti - 1);
  const goods = {};
  switch (def.category) {
    case "housing": {
      const prod = def.production ?? {};
      return {
        coins: Math.round((prod.coins ?? 0) * coinMulti),
        supplies: Math.round((prod.supplies ?? 0) * supplyMulti),
        chronos: Math.round((prod.chronos ?? 0) * happyMulti),
        goods,
      };
    }
    case "production": {
      const prod = def.production ?? {};
      return {
        coins: Math.round((prod.coins ?? 0) * coinMulti),
        supplies: Math.round((prod.supplies ?? 0) * supplyMulti),
        chronos: Math.round((prod.chronos ?? 0) * happyMulti),
        goods,
      };
    }
    case "culture": {
      const chrono = def.production?.chronos ?? def.chronos ?? 0;
      return {
        coins: 0,
        supplies: 0,
        chronos: Math.round(chrono * happyMulti),
        goods,
      };
    }
    case "goods": {
      return { coins: 0, supplies: 0, chronos: 0, goods };
    }
    case "townhall": {
      const prod = def.production ?? {};
      return {
        coins: prod.coins ?? 0,
        supplies: prod.supplies ?? 0,
        chronos: prod.chronos ?? 0,
        goods,
      };
    }
    default:
      return { coins: 0, supplies: 0, chronos: 0, goods };
  }
};

export const aggregateHarvest = (instances, libraryMap, stats) => {
  const total = { coins: 0, supplies: 0, chronos: 0, goods: {} };
  instances.forEach((inst) => {
    const delta = computeBuildingHarvest(inst, libraryMap, stats);
    total.coins += delta.coins ?? 0;
    total.supplies += delta.supplies ?? 0;
    total.chronos += delta.chronos ?? 0;
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
        def.category === "townhall");
    const prev = prevReadyMap[b.id] ?? false;
    if (buildLocks[b.id]) {
      acc[b.id] = true;
    } else {
      acc[b.id] = allowed ? true : prev;
    }
    // keep locked flag implied via buildLocks map; ready state still true for housing/production
    return acc;
  }, {});

export const buildHarvestResult = ({ total, resources }) => ({
  coins: (resources.coins ?? 0) + total.coins,
  supplies: (resources.supplies ?? 0) + total.supplies,
  chronos: (resources.chronos ?? 0) + total.chronos,
  goods: GOODS_TYPES.reduce(
    (acc, g) => ({
      ...acc,
      [g]: (resources.goods?.[g] ?? 0) + (total.goods[g] ?? 0),
    }),
    {}
  ),
});
