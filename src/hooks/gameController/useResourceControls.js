import { useCallback, useMemo } from "react";
import { GOODS_TYPES, UNIT_TYPES } from "../../config/boardConfig";

// Resource helpers that respect infinite-resource mode.
export const useResourceControls = ({
  resources,
  infiniteResources,
  spendResources,
  refundResources,
  adjustGoods,
  adjustUnits,
}) => {
  const cloneResources = useCallback(
    (obj) => ({
      ...obj,
      goods: { ...(obj?.goods ?? {}) },
      units: { ...(obj?.units ?? {}) },
    }),
    [],
  );

  const effectiveResources = useMemo(() => {
    if (!infiniteResources) return resources;
    const huge = Number.MAX_SAFE_INTEGER;
    return {
      ...resources,
      coins: huge,
      supplies: huge,
      chronos: huge,
      shards: huge,
      quantumActions: huge,
      goods: GOODS_TYPES.reduce((acc, g) => ({ ...acc, [g]: huge }), {
        ...(resources.goods ?? {}),
      }),
      units: UNIT_TYPES.reduce((acc, u) => ({ ...acc, [u]: huge }), {
        ...(resources.units ?? {}),
      }),
    };
  }, [infiniteResources, resources]);

  const applySpend = useCallback(
    (cost) => {
      spendResources(cost);
    },
    [spendResources],
  );

  const applyRefund = useCallback(
    (delta) => {
      refundResources(delta);
    },
    [refundResources],
  );

  const applyAdjustGoods = useCallback(
    (good, delta) => {
      if (infiniteResources) return;
      adjustGoods(good, delta);
    },
    [infiniteResources, adjustGoods],
  );

  const applyAdjustUnits = useCallback(
    (unit, delta) => {
      if (infiniteResources) return;
      adjustUnits(unit, delta);
    },
    [infiniteResources, adjustUnits],
  );

  return {
    cloneResources,
    effectiveResources,
    applySpend,
    applyRefund,
    applyAdjustGoods,
    applyAdjustUnits,
  };
};
