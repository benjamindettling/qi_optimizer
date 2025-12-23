// src/utils/stateUtils.js

import { GOODS_TYPES } from "../config/boardConfig";
import { happinessTier } from "./gameMath";
import { cloneLayout } from "./layoutUtils";

/**
 * Snapshot the parts of state needed for undo/redo.
 */
export const serializeState = (state) => ({
  resources: {
    ...state.resources,
    goods: { ...(state.resources.goods ?? {}) },
    units: { ...(state.resources.units ?? {}) },
  },
  saves: state.saves ? { ...state.saves } : {},
  loadName: state.loadName ?? "",
  layout: cloneLayout(state.layout ?? []),
  unlockedRegions: [...(state.unlockedRegions ?? [])],
  goodsUnlocks: state.goodsUnlocks,
  shardUnlocks: state.shardUnlocks,
  nextId: state.nextId,
  readyMap: { ...(state.readyMap ?? {}) },
  moveMode: state.moveMode,
  sellMode: state.sellMode,
  refundMode: state.refundMode,
  selectedCategory: state.selectedCategory,
  infiniteResources: state.infiniteResources ?? false,
  infiniteBackup: state.infiniteBackup
    ? {
        ...state.infiniteBackup,
        goods: { ...(state.infiniteBackup.goods ?? {}) },
        units: { ...(state.infiniteBackup.units ?? {}) },
      }
    : null,
  notes: state.notes ?? "",
  buildLocks: { ...(state.buildLocks ?? {}) },
});

/**
 * Check if a goods bag has at least `amount` of a given good.
 */
export const canAffordSingleGood = (goodsBag, good, amount) =>
  (goodsBag?.[good] ?? 0) >= amount;

/**
 * Return a new goods bag with `amount` of `good` deducted.
 */
export const deductSingleGood = (goodsBag, good, amount) => ({
  ...goodsBag,
  [good]: (goodsBag?.[good] ?? 0) - amount,
});

/**
 * Check if the numeric resources (coins, supplies, chronos) cover a cost.
 */
export const canAffordResources = (resources, cost = {}) =>
  (resources.coins ?? 0) >= (cost.coins ?? 0) &&
  (resources.supplies ?? 0) >= (cost.supplies ?? 0) &&
  (resources.chronos ?? 0) >= (cost.chronos ?? 0);

/**
 * Check if there is enough free population for a building definition.
 */
export const hasPopulationForDef = (stats, def) => {
  const requires = def.requiresPeople ?? 0;
  const available = Math.max(0, stats.people - stats.peopleReq);
  return requires <= available;
};

const happinessBoost = (provided, required) =>
  happinessTier(provided, required).ratio;

/**
 * Compute all city stats + harvest result for a given layout.
 */
export const computeStats = (layout, libraryMap) => {
  const totals = {
    baseCoins: 0,
    baseSupplies: 0,
    baseChronos: 0,
    flatCoins: 0,
    flatSupplies: 0,
    flatChronos: 0,
    baseGoods: GOODS_TYPES.reduce((acc, key) => ({ ...acc, [key]: 0 }), {}),
    coinBoost: 0,
    supplyBoost: 0,
    people: 0,
    peopleReq: 0,
    happinessProvided: 0,
    happinessRequired: 0,
  };

  layout.forEach((item) => {
    const def = libraryMap[item.defId];
    if (!def) return;

    switch (def.category) {
      case "housing": {
        totals.people += def.people ?? 0;
        totals.coinBoost += def.coinBoost ?? 0;
        const prod = def.production ?? {};
        totals.baseCoins += prod.coins ?? 0;
        totals.baseSupplies += prod.supplies ?? 0;
        totals.baseChronos += prod.chronos ?? 0;
        break;
      }
      case "production": {
        totals.peopleReq += def.requiresPeople ?? 0;
        totals.supplyBoost += def.supplyBoost ?? 0;
        const prod = def.production ?? {};
        totals.baseCoins += prod.coins ?? 0;
        totals.baseSupplies += prod.supplies ?? 0;
        totals.baseChronos += prod.chronos ?? 0;
        break;
      }
      case "goods": {
        totals.peopleReq += def.requiresPeople ?? 0;
        const amounts = def.goodsCost
          ? Object.keys(def.goodsCost).map((k) => Number(k))
          : [];
        const best = amounts.length ? Math.max(...amounts) : 0;
        if (def.produces && best) {
          totals.baseGoods[def.produces] =
            (totals.baseGoods[def.produces] ?? 0) + best;
        }
        break;
      }
      case "culture": {
        totals.happinessProvided += def.happiness ?? 0;
        totals.baseChronos += def.production?.chronos ?? def.chronos ?? 0;
        break;
      }
      case "decoration": {
        totals.happinessRequired += def.happinessCost ?? 0;
        break;
      }
      case "military": {
        totals.peopleReq += def.requiresPeople ?? 0;
        break;
      }
      case "townhall": {
        totals.flatCoins += def.production?.coins ?? 0;
        totals.flatSupplies += def.production?.supplies ?? 0;
        totals.flatChronos += def.production?.chronos ?? 0;
        break;
      }
      default:
        break;
    }
  });

  const usedPeople = Math.max(totals.peopleReq, totals.people);
  totals.happinessRequired += usedPeople * 1;

  const happyMulti = happinessBoost(
    totals.happinessProvided,
    totals.happinessRequired
  );

  const coins =
    Math.round(totals.baseCoins * (1 + totals.coinBoost + (happyMulti - 1))) +
    totals.flatCoins;
  const supplies =
    Math.round(
      totals.baseSupplies * (1 + totals.supplyBoost + (happyMulti - 1))
    ) + totals.flatSupplies;
  const chronos =
    Math.round(totals.baseChronos * happyMulti) + totals.flatChronos;

  return {
    ...totals,
    happyMulti,
    harvest: {
      coins,
      supplies,
      chronos,
      goods: totals.baseGoods,
    },
  };
};
