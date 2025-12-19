import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  BOARD_HEIGHT,
  BOARD_WIDTH,
  REGION_SIZE,
  REGION_COLS,
  REGION_MASK,
  GOODS_TYPES,
} from "../config/boardConfig";
import { buildInitialGameState, buildLibrary } from "../state/initialState";
import {
  buildSnapshot as buildSnapshotState,
  applySnapshot as applySnapshotState,
} from "../state/snapshot";
import { happinessTier } from "../utils/gameMath";
import {
  canAffordResources,
  canAffordSingleGood,
  computeStats,
  hasPopulationForDef,
} from "../utils/stateUtils";
import { isAreaFree } from "../utils/layoutUtils";
import { useResources } from "./useResources";
import { useUndoRedo } from "./useUndoRedo";
import { useRegionAccess } from "./useRegionAccess";
import { useSaves } from "./useSaves";
import {
  dropCarried,
  buildPreviewOrigin,
  findTargetInstance,
} from "../domain/placement/placementController";
import {
  isCellUnlocked as regionIsCellUnlocked,
  buildUnlockChoiceState,
  prepareFastBuyModal,
} from "../domain/regions/regionController";
import {
  aggregateHarvest,
  buildHarvestResult,
  finishProductionsReadyMap,
} from "../domain/production/productionController";
import {
  computeViewBounds,
  computeViewTransforms,
} from "../domain/view/viewController";
import {
  canAffordFastBuy,
  computeSaleOrRefund,
  totalFastBuyCost,
} from "../domain/economy/resourceTransactions";

export const useGameController = () => {
  const { library, libraryMap, categories, categoryColors, townhallDef } =
    useMemo(() => buildLibrary(), []);

  const initialState = useMemo(
    () => buildInitialGameState({ libraryMap, townhallDef }),
    [libraryMap, townhallDef]
  );

  const nextId = useRef(2);
  const {
    resources,
    setResources,
    spendResources,
    refundResources,
    adjustGoods,
  } = useResources(initialState.resources);

  const [layout, setLayout] = useState(initialState.layout);
  const [unlockedRegions, setUnlockedRegions] = useState(
    initialState.unlockedRegions
  );
  const [goodsUnlocks, setGoodsUnlocks] = useState(initialState.goodsUnlocks);
  const [shardUnlocks, setShardUnlocks] = useState(initialState.shardUnlocks);
  const [selectedCategory, setSelectedCategory] = useState(
    initialState.selectedCategory
  );
  const [selectedBuildingId, setSelectedBuildingId] = useState(
    initialState.selectedBuildingId
  );
  const [hoverCell, setHoverCell] = useState(initialState.hoverCell);
  const [moveMode, setMoveMode] = useState(initialState.moveMode);
  const [sellMode, setSellMode] = useState(initialState.sellMode);
  const [refundMode, setRefundMode] = useState(initialState.refundMode);
  const [carried, setCarried] = useState(initialState.carried);
  const [moveSnapshot, setMoveSnapshot] = useState(initialState.moveSnapshot);
  const [harvestModal, setHarvestModal] = useState(initialState.harvestModal);
  const [goodsModal, setGoodsModal] = useState(initialState.goodsModal);
  const [fastBuyModal, setFastBuyModal] = useState(initialState.fastBuyModal);
  const [fastBuyTarget, setFastBuyTarget] = useState(
    initialState.fastBuyTarget
  );
  const [unlockChoice, setUnlockChoice] = useState(initialState.unlockChoice);
  const [unlockGoodSelect, setUnlockGoodSelect] = useState(
    initialState.unlockGoodSelect
  );
  const [viewMode, setViewMode] = useState(initialState.viewMode);
  const [status, setStatus] = useState(initialState.status);
  const [readyMap, setReadyMap] = useState(initialState.readyMap);
  // Debug: allow quick toggling of region unlocks from the Regions panel (no cost).
  const [debugRegions, setDebugRegions] = useState(false);

  const {
    saves,
    loadName,
    setLoadName,
    saveSnapshot,
    loadSnapshot,
    deleteSave,
  } = useSaves();

  useEffect(() => {
    if (!townhallDef) return;
    const carryingTownhall =
      carried?.def?.defId === townhallDef.defId ||
      carried?.instance?.defId === townhallDef.defId;
    if (carryingTownhall) return;
    if (layout.some((l) => l.defId === townhallDef.defId)) return;

    const isUnlocked = (cx, cy) => regionIsCellUnlocked(cx, cy, unlockedRegions);
    const fitsAt = (x, y, layoutSnapshot) =>
      isAreaFree(
        layoutSnapshot,
        x,
        y,
        townhallDef.width,
        townhallDef.height,
        null,
        isUnlocked
      );

    setLayout((prevLayout) => {
      if (prevLayout.some((l) => l.defId === townhallDef.defId))
        return prevLayout;

      let placement = fitsAt(17, 4, prevLayout)
        ? { x: 17, y: 4 }
        : null;
      if (!placement) {
        for (
          let y = 0;
          y <= BOARD_HEIGHT - townhallDef.height && !placement;
          y += 1
        ) {
          for (
            let x = 0;
            x <= BOARD_WIDTH - townhallDef.width && !placement;
            x += 1
          ) {
            if (fitsAt(x, y, prevLayout)) {
              placement = { x, y };
            }
          }
        }
      }
      if (!placement) return prevLayout;

      const maxId = prevLayout.reduce((max, b) => Math.max(max, b.id), 0);
      const id = Math.max(nextId.current ?? 1, maxId + 1);
      nextId.current = id + 1;
      const instance = {
        id,
        defId: townhallDef.defId,
        x: placement.x,
        y: placement.y,
        width: townhallDef.width,
        height: townhallDef.height,
      };
      setReadyMap((prev) => ({ ...prev, [id]: false }));
      return [...prevLayout, instance];
    });
  }, [townhallDef, carried, unlockedRegions, layout]);

  useEffect(() => {
    setReadyMap((prev) => {
      const next = { ...prev };
      layout.forEach((b) => {
        if (next[b.id] === undefined) next[b.id] = false;
      });
      return next;
    });
  }, [layout]);

  const selectedDef = selectedBuildingId
    ? libraryMap[selectedBuildingId]
    : null;

  const updateStatus = useCallback((msg) => {
    setStatus(msg);
    setTimeout(() => setStatus(""), 2500);
  }, []);

  const buildSnapshot = useCallback(
    () =>
      buildSnapshotState({
        resources,
        layout,
        unlockedRegions,
        goodsUnlocks,
        shardUnlocks,
        nextId: nextId.current,
        readyMap,
        moveMode,
        sellMode,
        refundMode,
        selectedCategory,
      }),
    [
      resources,
      layout,
      unlockedRegions,
      goodsUnlocks,
      shardUnlocks,
      readyMap,
      moveMode,
      sellMode,
      refundMode,
      selectedCategory,
    ]
  );

  const applySnapshot = useCallback(
    (snapshot) =>
      applySnapshotState(snapshot, {
        setResources,
        setLayout,
        setUnlockedRegions,
        setGoodsUnlocks,
        setShardUnlocks,
        setReadyMap,
        setMoveMode,
        setSellMode,
        setRefundMode,
        setSelectedCategory,
        nextIdRef: nextId,
        townhallDef,
      }),
    [
      setResources,
      setLayout,
      setUnlockedRegions,
      setGoodsUnlocks,
      setShardUnlocks,
      setReadyMap,
      setMoveMode,
      setSellMode,
      setRefundMode,
      setSelectedCategory,
      townhallDef,
    ]
  );

  const { undoStack, redoStack, pushHistory, handleUndo, handleRedo } =
    useUndoRedo(buildSnapshot, applySnapshot);

  const resetModes = useCallback(() => {
    setMoveMode(false);
    setSellMode(false);
    setRefundMode(false);
    setSelectedBuildingId(null);
  }, []);

  const handleEditResource = useCallback(
    (key) => {
      if (!key) return;
      const current = resources?.[key] ?? 0;
      const raw = prompt(`Set ${key} (current: ${current})`, String(current));
      if (raw == null) return;
      const nextVal = Math.max(0, Number.parseInt(String(raw), 10));
      if (Number.isNaN(nextVal)) return;
      pushHistory(buildSnapshot());
      setResources((prev) => ({ ...prev, [key]: nextVal }));
      updateStatus(`${key} set to ${nextVal}`);
    },
    [resources, pushHistory, buildSnapshot, setResources, updateStatus]
  );

  const handleEditGood = useCallback(
    (goodKey) => {
      if (!goodKey) return;
      const current = resources?.goods?.[goodKey] ?? 0;
      const raw = prompt(
        `Set good "${goodKey}" (current: ${current})`,
        String(current)
      );
      if (raw == null) return;
      const nextVal = Math.max(0, Number.parseInt(String(raw), 10));
      if (Number.isNaN(nextVal)) return;
      pushHistory(buildSnapshot());
      setResources((prev) => ({
        ...prev,
        goods: { ...prev.goods, [goodKey]: nextVal },
      }));
      updateStatus(`Good "${goodKey}" set to ${nextVal}`);
    },
    [resources, pushHistory, buildSnapshot, setResources, updateStatus]
  );

  const undoWithCleanup = useCallback(() => {
    handleUndo();
    setCarried(null);
    setMoveSnapshot(null);
  }, [handleUndo]);

  const redoWithCleanup = useCallback(() => {
    handleRedo();
    setCarried(null);
    setMoveSnapshot(null);
  }, [handleRedo]);

  const isCellUnlocked = useCallback(
    (x, y) => regionIsCellUnlocked(x, y, unlockedRegions),
    [unlockedRegions]
  );

  const handleSaveState = useCallback(() => {
    const name = prompt("Save name?");
    if (!name) return;
    const snapshot = buildSnapshot();
    saveSnapshot(name, snapshot);
    updateStatus(`Saved state "${name}"`);
  }, [buildSnapshot, saveSnapshot, updateStatus]);

  const handleLoadState = useCallback(
    (name) => {
      const snap = loadSnapshot(name);
      if (!snap) return;
      applySnapshot(snap);
      setCarried(null);
      setMoveSnapshot(null);
      setMoveMode(false);
      updateStatus(`Loaded state "${name}"`);
    },
    [applySnapshot, loadSnapshot, updateStatus]
  );

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape" && moveSnapshot) {
        applySnapshot(moveSnapshot);
        setCarried(null);
        setMoveSnapshot(null);
        setMoveMode(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [moveSnapshot, applySnapshot]);

  const stats = computeStats(layout, libraryMap);
  const happyInfo = happinessTier(
    stats.happinessProvided,
    stats.happinessRequired
  );
  const {
    currentGoodsCost,
    currentShardCost,
    neighborUnlocked,
    hasAnyGoodsProducer,
    hasAnyGoodsEnough,
    canAnyUnlock,
  } = useRegionAccess({
    unlockedRegions,
    goodsUnlocks,
    shardUnlocks,
    resources,
    layout,
    libraryMap,
  });

  const harvestBuildings = useCallback(
    (instances, label = "Harvest", skipPopup = false, skipHistory = false) => {
      if (!instances.length) return;
      const snapshot = skipHistory ? null : buildSnapshot();
      if (!skipHistory) pushHistory(snapshot);
      const total = aggregateHarvest(instances, libraryMap, stats);
      setResources((prev) => ({
        ...prev,
        coins: prev.coins + total.coins,
        supplies: prev.supplies + total.supplies,
        chronos: prev.chronos + total.chronos,
        goods: GOODS_TYPES.reduce(
          (acc, g) => ({
            ...acc,
            [g]: (prev.goods[g] ?? 0) + (total.goods[g] ?? 0),
          }),
          {}
        ),
      }));
      const harvestedIds = instances.map((i) => i.id);
      setReadyMap((prev) => {
        const next = { ...prev };
        harvestedIds.forEach((id) => {
          next[id] = false;
        });
        return next;
      });
      if (!skipPopup) {
        setHarvestModal({
          delta: total,
          result: buildHarvestResult({ total, resources }),
          title: label,
        });
      }
    },
    [buildSnapshot, libraryMap, stats, setResources, pushHistory, resources]
  );

  const handleUnlockRegion = useCallback(
    (idx, method, goodKey) => {
      const row = Math.floor(idx / REGION_COLS);
      const col = idx % REGION_COLS;
      if (REGION_MASK[row][col] === "N") return;
      if (!method) {
        const choice = buildUnlockChoiceState({
          idx,
          resources,
          layout,
          libraryMap,
          currentGoodsCost,
          currentShardCost,
        });
        setUnlockChoice(choice);
        setUnlockGoodSelect(null);
        return;
      }
      if (method === "goods") {
        if (!canAffordSingleGood(resources.goods, goodKey, currentGoodsCost)) {
          const fastBuy = prepareFastBuyModal({
            goodKey,
            resources,
            layout,
            libraryMap,
            currentGoodsCost,
          });
          if (!fastBuy) {
            updateStatus("Need more goods of that type to unlock.");
            return;
          }
          setFastBuyModal({
            goodKey,
            goodsCost: currentGoodsCost,
            options: fastBuy.options,
            buildingDef: fastBuy.buildingDef,
          });
          setFastBuyTarget(idx);
          return;
        }
        const snapshot = buildSnapshot();
        pushHistory(snapshot);
        adjustGoods(goodKey, -currentGoodsCost);
        setGoodsUnlocks((prev) => prev + 1);
        setUnlockedRegions((prev) =>
          prev.map((val, i) => (i === idx ? true : val))
        );
      } else {
        if ((resources.shards ?? 0) < currentShardCost) {
          updateStatus("Need more shards to unlock.");
          return;
        }
        const snapshot = buildSnapshot();
        pushHistory(snapshot);
        setResources((prev) => ({
          ...prev,
          shards: prev.shards - currentShardCost,
        }));
        setShardUnlocks((prev) => prev + 1);
        setUnlockedRegions((prev) =>
          prev.map((val, i) => (i === idx ? true : val))
        );
      }
      setFastBuyTarget(null);
      setUnlockChoice(null);
      setUnlockGoodSelect(null);
    },
    [
      adjustGoods,
      buildSnapshot,
      currentGoodsCost,
      currentShardCost,
      layout,
      libraryMap,
      pushHistory,
      resources,
      setResources,
      updateStatus,
    ]
  );

  const toggleDebugRegions = useCallback(() => {
    setDebugRegions((prev) => !prev);
  }, []);

  const regionRect = useCallback((idx) => {
    const row = Math.floor(idx / REGION_COLS);
    const col = idx % REGION_COLS;
    const x0 = col * REGION_SIZE;
    const y0 = row * REGION_SIZE;
    return {
      x0,
      y0,
      x1: x0 + REGION_SIZE - 1,
      y1: y0 + REGION_SIZE - 1,
    };
  }, []);

  const hasAnyBuildingInRegion = useCallback(
    (idx) => {
      const { x0, y0, x1, y1 } = regionRect(idx);
      return layout.some((inst) => {
        const ix0 = inst.x;
        const iy0 = inst.y;
        const ix1 = inst.x + inst.width - 1;
        const iy1 = inst.y + inst.height - 1;
        const overlaps = !(ix1 < x0 || ix0 > x1 || iy1 < y0 || iy0 > y1);
        return overlaps;
      });
    },
    [layout, regionRect]
  );

  const handleDebugUnlockRegion = useCallback(
    (idx) => {
      if (!debugRegions) return;
      const row = Math.floor(idx / REGION_COLS);
      const col = idx % REGION_COLS;
      if (REGION_MASK[row][col] === "N") return;
      if (unlockedRegions[idx]) return;
      if (!neighborUnlocked(idx)) return;

      pushHistory(buildSnapshot());
      setUnlockedRegions((prev) => {
        const next = [...prev];
        next[idx] = true;
        return next;
      });
      updateStatus("Debug: region unlocked (no cost)");
    },
    [
      debugRegions,
      unlockedRegions,
      neighborUnlocked,
      pushHistory,
      buildSnapshot,
      setUnlockedRegions,
      updateStatus,
    ]
  );

  const handleDebugLockRegion = useCallback(
    (idx, isBase = false) => {
      if (!debugRegions) return;
      if (isBase) return; // starting region must never be removable
      if (!unlockedRegions[idx]) return;

      if (hasAnyBuildingInRegion(idx)) {
        updateStatus("Cannot remove region: buildings still placed in it.");
        return;
      }

      pushHistory(buildSnapshot());
      setUnlockedRegions((prev) => {
        const next = [...prev];
        next[idx] = false;
        return next;
      });
      updateStatus("Debug: region removed");
    },
    [
      debugRegions,
      unlockedRegions,
      hasAnyBuildingInRegion,
      pushHistory,
      buildSnapshot,
      setUnlockedRegions,
      updateStatus,
    ]
  );

  const toggleMove = useCallback(() => {
    pushHistory(buildSnapshot());
    setMoveMode((prev) => {
      const next = !prev;
      if (next) {
        setSellMode(false);
        setRefundMode(false);
        setSelectedBuildingId(null);
      }
      if (!next) {
        setCarried(null);
        setMoveSnapshot(null);
      }
      return next;
    });
  }, [buildSnapshot, pushHistory]);

  const toggleSell = useCallback(() => {
    pushHistory(buildSnapshot());
    setSellMode((prev) => {
      const next = !prev;
      if (next) {
        setMoveMode(false);
        setRefundMode(false);
        setSelectedBuildingId(null);
      }
      return next;
    });
  }, [buildSnapshot, pushHistory]);

  const toggleRefund = useCallback(() => {
    pushHistory(buildSnapshot());
    setRefundMode((prev) => {
      const next = !prev;
      if (next) {
        setMoveMode(false);
        setSellMode(false);
        setSelectedBuildingId(null);
      }
      return next;
    });
  }, [buildSnapshot, pushHistory]);

  const handleGoodsPurchase = useCallback(
    (def, amount) => {
      const cost = def.goodsCost?.[amount];
      if (!cost) return;
      if (
        resources.coins < (cost.coins ?? 0) ||
        resources.supplies < (cost.supplies ?? 0)
      ) {
        updateStatus("Not enough coins or supplies.");
        return;
      }
      const snapshot = buildSnapshot();
      pushHistory(snapshot);
      spendResources(cost);
      adjustGoods(def.produces, Number(amount));
      setGoodsModal(null);
    },
    [
      resources,
      updateStatus,
      buildSnapshot,
      pushHistory,
      spendResources,
      adjustGoods,
    ]
  );

  const handleFastBuy = useCallback(
    (option) => {
      if (!fastBuyModal || fastBuyTarget === null) return;
      const goodKey = fastBuyModal.goodKey;
      const goodsCost = fastBuyModal.goodsCost;
      if (!canAffordFastBuy(resources, option)) {
        updateStatus("Not enough coins or supplies for fast buy.");
        return;
      }
      const goodsAfterPurchase =
        (resources.goods[goodKey] ?? 0) + option.totalAmount;
      if (goodsAfterPurchase < goodsCost) {
        updateStatus("Fast buy plan insufficient.");
        return;
      }
      const totals = totalFastBuyCost(option);
      const snapshot = buildSnapshot();
      pushHistory(snapshot);
      spendResources({ coins: totals.coins, supplies: totals.supplies });
      adjustGoods(goodKey, option.totalAmount - goodsCost);
      setUnlockedRegions((prev) =>
        prev.map((val, i) => (i === fastBuyTarget ? true : val))
      );
      setGoodsUnlocks((prev) => prev + 1);
      setFastBuyModal(null);
      setFastBuyTarget(null);
    },
    [
      adjustGoods,
      buildSnapshot,
      fastBuyModal,
      fastBuyTarget,
      pushHistory,
      resources,
      spendResources,
      updateStatus,
    ]
  );

  const finishProductions = useCallback(() => {
    const snapshot = buildSnapshot();
    pushHistory(snapshot);
    setReadyMap(finishProductionsReadyMap(layout));
  }, [buildSnapshot, pushHistory, layout]);

  const harvestAll = useCallback(() => {
    const readyOnes = layout.filter((b) => readyMap[b.id]);
    if (readyOnes.length > 0) {
      harvestBuildings(readyOnes, "Partial Harvest");
    } else {
      harvestBuildings(layout, "Full Harvest");
    }
  }, [layout, readyMap, harvestBuildings]);

  const confirmHarvest = useCallback(() => {
    setHarvestModal(null);
  }, []);

  const cancelHarvest = useCallback(() => {
    setHarvestModal(null);
  }, []);

  const handleCellClick = useCallback(
    (x, y) => {
      const target = findTargetInstance(layout, x, y);
      if (carried) {
        dropCarried({
          carried,
          x,
          y,
          layout,
          libraryMap,
          isCellUnlocked,
          moveSnapshot,
          buildSnapshot,
          setLayout,
          setCarried,
          setReadyMap,
          pushHistory,
          setMoveSnapshot,
          setMoveMode,
          updateStatus,
        });
        return;
      }

      if ((sellMode || refundMode) && target) {
        if (libraryMap[target.defId]?.category === "townhall") {
          updateStatus("Townhall cannot be deleted.");
          return;
        }
        const delta = computeSaleOrRefund(target, libraryMap, refundMode);
        if (readyMap[target.id]) {
          harvestBuildings([target], "Harvest", true, true);
        }
        const snapshot = buildSnapshot();
        pushHistory(snapshot);
        refundResources(delta);
        setLayout((prev) => prev.filter((p) => p.id !== target.id));
        setReadyMap((prev) => {
          const next = { ...prev };
          delete next[target.id];
          return next;
        });
        updateStatus(
          `${refundMode ? "Refunded" : "Sold"} ${libraryMap[target.defId].name}`
        );
        return;
      }

      if (selectedDef) {
        if (!hasPopulationForDef(stats, selectedDef)) {
          updateStatus("Not enough free population.");
          return;
        }
        const adjustedX = Math.min(x, BOARD_WIDTH - selectedDef.width);
        const adjustedY = Math.min(y, BOARD_HEIGHT - selectedDef.height);
        if (
          !isAreaFree(
            layout,
            adjustedX,
            adjustedY,
            selectedDef.width,
            selectedDef.height,
            undefined,
            isCellUnlocked
          )
        ) {
          updateStatus("Blocked or locked area.");
          return;
        }
        if (!canAffordResources(resources, selectedDef.cost)) {
          updateStatus("Not enough resources.");
          return;
        }
        const snapshot = buildSnapshot();
        spendResources(selectedDef.cost);
        const instance = {
          id: nextId.current++,
          defId: selectedDef.defId,
          x: adjustedX,
          y: adjustedY,
          width: selectedDef.width,
          height: selectedDef.height,
        };
        setLayout((prev) => [...prev, instance]);
        setReadyMap((prev) => ({ ...prev, [instance.id]: false }));
        pushHistory(snapshot);
        updateStatus(`Placed ${selectedDef.name}`);
        return;
      }

      if (moveMode && target) {
        const snapshot = buildSnapshot();
        setMoveSnapshot(snapshot);
        setLayout((prev) => prev.filter((p) => p.id !== target.id));
        setCarried({
          instance: { ...target, ready: readyMap[target.id] },
          def: libraryMap[target.defId],
        });
        updateStatus(`Picked up ${libraryMap[target.defId].name}`);
        return;
      }

      if (
        !moveMode &&
        !sellMode &&
        !refundMode &&
        !selectedDef &&
        target &&
        readyMap[target.id]
      ) {
        harvestBuildings([target], "Harvest", true);
        return;
      }

      if (
        !moveMode &&
        target &&
        libraryMap[target.defId]?.category === "goods"
      ) {
        const def = libraryMap[target.defId];
        setGoodsModal({ def });
      }
    },
    [
      layout,
      carried,
      libraryMap,
      isCellUnlocked,
      moveSnapshot,
      buildSnapshot,
      pushHistory,
      setCarried,
      setLayout,
      setMoveMode,
      setReadyMap,
      refundMode,
      refundResources,
      selectedDef,
      stats,
      resources,
      spendResources,
      moveMode,
      sellMode,
      readyMap,
      harvestBuildings,
      setGoodsModal,
      updateStatus,
    ]
  );

  const previewDef = carried?.def ?? selectedDef;
  const previewOrigin = useMemo(
    () => buildPreviewOrigin(hoverCell, previewDef, categoryColors),
    [hoverCell, previewDef, categoryColors]
  );

  const { viewColStart, viewRowStart, viewWidth, viewHeight } =
    computeViewBounds(unlockedRegions);
  const {
    viewRotation,
    boardTransform,
    regionTransform,
    toolbarOffsetPx,
    boardTransformClass,
  } = computeViewTransforms(viewMode, viewWidth, viewHeight);

  return {
    resources,
    layout,
    libraryMap,
    categories,
    categoryColors,
    selectedCategory,
    setSelectedCategory,
    selectedBuildingId,
    setSelectedBuildingId,
    unlockedRegions,
    goodsUnlocks,
    shardUnlocks,
    goodsModal,
    setGoodsModal,
    fastBuyModal,
    fastBuyTarget,
    unlockChoice,
    unlockGoodSelect,
    viewMode,
    setViewMode,
    status,
    carried,
    readyMap,
    hoverCell,
    setHoverCell,
    moveMode,
    sellMode,
    refundMode,
    saves,
    loadName,
    setLoadName,
    harvestModal,
    stats,
    happyInfo,
    previewOrigin,
    viewRotation,
    boardTransform,
    regionTransform,
    toolbarOffsetPx,
    boardTransformClass,
    viewWidth,
    viewHeight,
    viewColStart,
    viewRowStart,
    currentGoodsCost,
    currentShardCost,
    neighborUnlocked,
    hasAnyGoodsProducer,
    hasAnyGoodsEnough,
    canAnyUnlock,
    debugRegions,
    handleCellClick,
    handleUnlockRegion,
    toggleDebugRegions,
    handleDebugUnlockRegion,
    handleDebugLockRegion,
    toggleMove,
    toggleSell,
    toggleRefund,
    undoWithCleanup,
    redoWithCleanup,
    finishProductions,
    harvestAll,
    confirmHarvest,
    cancelHarvest,
    handleSaveState,
    handleLoadState,
    deleteSave,
    setFastBuyModal,
    setFastBuyTarget,
    setUnlockChoice,
    setUnlockGoodSelect,
    handleGoodsPurchase,
    handleFastBuy,
    resetModes,
    handleEditResource,
    handleEditGood,
    isCellUnlocked,
    undoStack,
    redoStack,
  };
};
