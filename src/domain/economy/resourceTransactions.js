import { computeRefund } from "../../utils/gameMath";
import {
  canAffordResources,
  canAffordSingleGood,
} from "../../utils/stateUtils";

export const canAffordPlacement = (resources, def) =>
  canAffordResources(resources, def?.cost);

export const computeSaleOrRefund = (target, libraryMap, refundMode) => {
  if (!target) return { coins: 0, supplies: 0, chronos: 0 };
  // Full refund is intended as a debug/tooling action: return the original
  // build cost of the definition (instances don't store cost).
  if (refundMode)
    return (
      libraryMap[target.defId]?.cost ?? { coins: 0, supplies: 0, chronos: 0 }
    );
  return computeRefund(libraryMap[target.defId]);
};

export const totalFastBuyCost = (option) => {
  if (!option) return { coins: 0, supplies: 0 };
  const totalCoins = option.plan.reduce(
    (sum, p) => sum + (p.cost.coins ?? 0),
    0
  );
  const totalSupplies = option.plan.reduce(
    (sum, p) => sum + (p.cost.supplies ?? 0),
    0
  );
  return { coins: totalCoins, supplies: totalSupplies };
};

export const canAffordFastBuy = (resources, option) => {
  const totals = totalFastBuyCost(option);
  return (
    (resources.coins ?? 0) >= totals.coins &&
    (resources.supplies ?? 0) >= totals.supplies
  );
};

export { canAffordResources, canAffordSingleGood };
