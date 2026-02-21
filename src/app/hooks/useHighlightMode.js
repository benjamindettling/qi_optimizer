import { useCallback, useMemo, useState } from "react";

const CHECKPOINT_TYPES = new Set(["finishProductions", "finishProductionsAdmin"]);
const BUILD_TYPES = new Set(["build", "buildAdmin"]);
const BOOST_SINGLE_TYPES = new Set([
  "boostReady",
  "boostReadyAdmin",
  "boostUnlock",
  "boostUnlockAdmin",
]);
const GOODS_PURCHASE_TYPES = new Set(["goodsPurchase", "goodsPurchaseAdmin"]);
const UNIT_PURCHASE_TYPES = new Set(["unitPurchase", "unitPurchaseAdmin"]);
const SELL_TYPES = new Set(["sell", "sellAdmin", "sellFull"]);

const toKey = (x, y) => `${Number(x)},${Number(y)}`;

const normalizeMovePositions = (action) => {
  if (Array.isArray(action?.positions)) {
    return action.positions
      .map((entry) => {
        if (!Array.isArray(entry) || entry.length < 4) return null;
        const fromX = Number(entry[0]);
        const fromY = Number(entry[1]);
        const toX = Number(entry[2]);
        const toY = Number(entry[3]);
        if (
          !Number.isFinite(fromX) ||
          !Number.isFinite(fromY) ||
          !Number.isFinite(toX) ||
          !Number.isFinite(toY)
        ) {
          return null;
        }
        return [fromX, fromY, toX, toY];
      })
      .filter(Boolean);
  }

  const xs = Array.isArray(action?.x) ? action.x : [];
  const ys = Array.isArray(action?.y) ? action.y : [];
  const xns = Array.isArray(action?.xn) ? action.xn : [];
  const yns = Array.isArray(action?.yn) ? action.yn : [];
  const len = Math.min(xs.length, ys.length, xns.length, yns.length);
  const positions = [];
  for (let i = 0; i < len; i += 1) {
    const fromX = Number(xs[i]);
    const fromY = Number(ys[i]);
    const toX = Number(xns[i]);
    const toY = Number(yns[i]);
    if (
      Number.isFinite(fromX) &&
      Number.isFinite(fromY) &&
      Number.isFinite(toX) &&
      Number.isFinite(toY)
    ) {
      positions.push([fromX, fromY, toX, toY]);
    }
  }
  return positions;
};

export function useHighlightMode({
  historyTree,
  selectedNodeId,
  layout,
  libraryMap,
}) {
  const [highlightMode, setHighlightMode] = useState(false);

  const toggleHighlightMode = useCallback(() => {
    setHighlightMode((prev) => !prev);
  }, []);

  const highlightedIds = useMemo(() => {
    if (!highlightMode) return new Set();

    const nodes = historyTree?.nodes;
    if (!(nodes instanceof Map) || !nodes.size) return new Set();
    if (!Number.isFinite(Number(selectedNodeId))) return new Set();

    // Path root -> selected node.
    const path = [];
    const visited = new Set();
    let current = Number(selectedNodeId);
    while (
      current !== null &&
      current !== undefined &&
      nodes.has(current) &&
      !visited.has(current)
    ) {
      visited.add(current);
      path.unshift(current);
      current = nodes.get(current)?.parentId;
    }
    if (!path.length) return new Set();

    // Scope starts after the most recent checkpoint.
    let startIdx = 0;
    for (let i = 0; i < path.length; i += 1) {
      const action = nodes.get(path[i])?.action;
      if (action?.type && CHECKPOINT_TYPES.has(action.type)) {
        startIdx = i + 1;
      }
    }

    const highlightedPositions = new Set();
    const purchasedGoodsKeys = new Set();
    const purchasedUnitKeys = new Set();

    for (let i = startIdx; i < path.length; i += 1) {
      const action = nodes.get(path[i])?.action;
      const type = action?.type;
      if (!type) continue;

      if (type === "move") {
        const moves = normalizeMovePositions(action);
        moves.forEach(([fromX, fromY, toX, toY]) => {
          const fromKey = toKey(fromX, fromY);
          if (highlightedPositions.has(fromKey)) {
            highlightedPositions.delete(fromKey);
            highlightedPositions.add(toKey(toX, toY));
          }
        });
        continue;
      }

      if (SELL_TYPES.has(type)) {
        const x = Number(action.x);
        const y = Number(action.y);
        if (Number.isFinite(x) && Number.isFinite(y)) {
          highlightedPositions.delete(toKey(x, y));
        }
        continue;
      }

      if (BUILD_TYPES.has(type) || BOOST_SINGLE_TYPES.has(type)) {
        const x = Number(action.x);
        const y = Number(action.y);
        if (Number.isFinite(x) && Number.isFinite(y)) {
          highlightedPositions.add(toKey(x, y));
        }
      }

      if (GOODS_PURCHASE_TYPES.has(type)) {
        const key = action.goodsKey ?? action.key;
        if (key) purchasedGoodsKeys.add(key);
      }
      if (UNIT_PURCHASE_TYPES.has(type)) {
        const key = action.unitKey ?? action.key;
        if (key) purchasedUnitKeys.add(key);
      }
    }

    const producerDefIds = new Set();
    if (purchasedGoodsKeys.size || purchasedUnitKeys.size) {
      Object.values(libraryMap || {}).forEach((def) => {
        const producedKey = def?.produces;
        if (!producedKey || !def?.defId) return;
        if (def.category === "goods" && purchasedGoodsKeys.has(producedKey)) {
          producerDefIds.add(def.defId);
        }
        if (
          def.category === "military" &&
          purchasedUnitKeys.has(producedKey)
        ) {
          producerDefIds.add(def.defId);
        }
      });
    }

    const next = new Set();
    (layout || []).forEach((building) => {
      if (!building) return;
      const byPosition = highlightedPositions.has(toKey(building.x, building.y));
      const byProducer = producerDefIds.has(building.defId);
      if (byPosition || byProducer) {
        next.add(building.id);
      }
    });
    return next;
  }, [highlightMode, historyTree, selectedNodeId, layout, libraryMap]);

  return {
    highlightMode,
    setHighlightMode,
    toggleHighlightMode,
    highlightedIds,
  };
}

