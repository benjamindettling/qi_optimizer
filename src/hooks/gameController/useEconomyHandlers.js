import { useCallback } from "react";
import { REGION_GOODS_COSTS } from "../../config/boardConfig";
import { formatNumber } from "../../utils/formatNumber";
import { canAffordFastBuy, totalFastBuyCost } from "../../domain/economy/resourceTransactions";

// Purchases for goods/units and fast-buy flow.
export const useEconomyHandlers = ({
  effectiveResources,
  infiniteResources,
  updateStatus,
  applySpend,
  applyAdjustGoods,
  applyAdjustUnits,
  branchFromPast,
  requestAutoSnapshot,
  setUnlockedRegions,
  setGoodsUnlocks,
  setFastBuyModal,
  setFastBuyTarget,
  setUnlockChoice,
  setUnlockGoodSelect,
  fastBuyModal,
  fastBuyTarget,
  editingLocked,
  recordHistoryAction,
}) => {
  const handleGoodsPurchase = useCallback(
    (def, amount) => {
      if (editingLocked) {
        updateStatus("Bearbeitung gesperrt. Bearbeitung aktivieren.");
        return;
      }
      const cost = def.goodsCost?.[amount];
      if (!cost) return;
      if (
        !infiniteResources &&
        (effectiveResources.coins < (cost.coins ?? 0) ||
          effectiveResources.supplies < (cost.supplies ?? 0))
      ) {
        updateStatus("Not enough coins or supplies.");
        return;
      }
      branchFromPast();
      const label = `Goods gekauft: ${def.produces} ${amount} für ${formatNumber(
        cost.coins ?? 0,
      )}/${formatNumber(cost.supplies ?? 0)}`;
      applySpend(cost);
      applyAdjustGoods(def.produces, Number(amount));
      updateStatus(label);
      recordHistoryAction?.({
        type: infiniteResources ? "goodsPurchaseAdmin" : "goodsPurchase",
        goodsKey: def.produces,
        quantity: Number(amount),
        cost: cost,
      });
    },
    [
      effectiveResources,
      updateStatus,
      applySpend,
      applyAdjustGoods,
      infiniteResources,
      editingLocked,
      branchFromPast,
      recordHistoryAction,
    ],
  );

  const handleUnitPurchase = useCallback(
    (def, amount) => {
      if (editingLocked) {
        updateStatus("Bearbeitung gesperrt. Bearbeitung aktivieren.");
        return;
      }
      const cost = def.unitCosts?.[amount];
      if (!cost) return;
      if (
        !infiniteResources &&
        (effectiveResources.coins < (cost.coins ?? 0) ||
          effectiveResources.supplies < (cost.supplies ?? 0))
      ) {
        updateStatus("Not enough coins or supplies.");
        return;
      }
      branchFromPast();
      const label = `Units gekauft: ${def.produces} ${amount} für ${formatNumber(
        cost.coins ?? 0,
      )}/${formatNumber(cost.supplies ?? 0)}`;
      applySpend(cost);
      applyAdjustUnits(def.produces, Number(amount));
      updateStatus(label);
      recordHistoryAction?.({
        type: infiniteResources ? "unitPurchaseAdmin" : "unitPurchase",
        unitKey: def.produces,
        quantity: Number(amount),
        cost: cost,
      });
    },
    [
      effectiveResources,
      updateStatus,
      applySpend,
      applyAdjustUnits,
      infiniteResources,
      editingLocked,
      branchFromPast,
      recordHistoryAction,
    ],
  );

  const handleFastBuy = useCallback(
    (option) => {
      if (editingLocked) {
        updateStatus("Bearbeitung gesperrt. Bearbeitung aktivieren.");
        return;
      }
      if (!fastBuyModal || fastBuyTarget === null) return;
      const goodKey = fastBuyModal.goodKey;
      const goodsCost = fastBuyModal.goodsCost;
      if (!infiniteResources && !canAffordFastBuy(effectiveResources, option)) {
        updateStatus("Not enough coins or supplies for fast buy.");
        return;
      }
      const goodsAfterPurchase =
        (effectiveResources.goods[goodKey] ?? 0) + option.totalAmount;
      if (goodsAfterPurchase < goodsCost) {
        updateStatus("Fast buy plan insufficient.");
        return;
      }
      branchFromPast();
      const totals = totalFastBuyCost(option);
      const label = `Fastbuy ${goodKey} für ${formatNumber(
        totals.coins,
      )}/${formatNumber(totals.supplies)}`;
      applySpend({ coins: totals.coins, supplies: totals.supplies });
      applyAdjustGoods(goodKey, option.totalAmount - goodsCost);
      setUnlockedRegions((prev) =>
        prev.map((val, i) => (i === fastBuyTarget ? true : val)),
      );
      setGoodsUnlocks((prev) =>
        Math.min(prev + 1, REGION_GOODS_COSTS.length - 1),
      );
      setFastBuyModal(null);
      setFastBuyTarget(null);
      setUnlockChoice(null);
      setUnlockGoodSelect(null);
      updateStatus(label);
      recordHistoryAction?.({
        type: "regionUnlockGoods",
        regionIdx: fastBuyTarget,
        goodKey,
        fastBuyAmount: option.totalAmount,
        admin: !!infiniteResources,
      });
      requestAutoSnapshot();
    },
    [
      applyAdjustGoods,
      applySpend,
      effectiveResources,
      fastBuyModal,
      fastBuyTarget,
      requestAutoSnapshot,
      updateStatus,
      infiniteResources,
      setUnlockChoice,
      setUnlockGoodSelect,
      setUnlockedRegions,
      setGoodsUnlocks,
      setFastBuyModal,
      setFastBuyTarget,
      editingLocked,
      branchFromPast,
      recordHistoryAction,
    ],
  );

  return {
    handleGoodsPurchase,
    handleUnitPurchase,
    handleFastBuy,
  };
};
