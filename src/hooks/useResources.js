import { useState, useCallback } from "react";

/**
 * Manage the player's resource state and provide helper mutators.
 */
export function useResources(initialResources) {
  const [resources, setResources] = useState(initialResources);

  const spendResources = useCallback((cost = {}) => {
    setResources((prev) => ({
      ...prev,
      coins: prev.coins - (cost.coins ?? 0),
      supplies: prev.supplies - (cost.supplies ?? 0),
      chronos: prev.chronos - (cost.chronos ?? 0),
    }));
  }, []);

  const refundResources = useCallback((refund = {}) => {
    setResources((prev) => ({
      ...prev,
      coins: prev.coins + (refund.coins ?? 0),
      supplies: prev.supplies + (refund.supplies ?? 0),
      chronos: prev.chronos + (refund.chronos ?? 0),
    }));
  }, []);

  const adjustGoods = useCallback((good, delta) => {
    setResources((prev) => ({
      ...prev,
      goods: { ...prev.goods, [good]: (prev.goods[good] ?? 0) + delta },
    }));
  }, []);

  const adjustUnits = useCallback((unit, delta) => {
    setResources((prev) => ({
      ...prev,
      units: { ...prev.units, [unit]: (prev.units?.[unit] ?? 0) + delta },
    }));
  }, []);

  return {
    resources,
    setResources,
    spendResources,
    refundResources,
    adjustGoods,
    adjustUnits,
  };
}
