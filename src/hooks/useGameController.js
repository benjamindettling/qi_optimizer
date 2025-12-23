// Central game-state hook: orchestrates layout, placement, economy, regions, undo/redo, and modals.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  BOARD_HEIGHT,
  BOARD_WIDTH,
  REGION_SIZE,
  REGION_COLS,
  REGION_MASK,
  GOODS_TYPES,
  UNIT_TYPES,
  BOARD_SCALE_DEFAULT,
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
import { useConfig } from "./useConfig";
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

// Primary controller that exposes all state and actions for the app.
export const useGameController = () => {
  const { library, libraryMap, categories, categoryColors, townhallDef } =
    useMemo(() => buildLibrary(), []);
  const { config, updateConfig } = useConfig();

  const initialState = useMemo(
    () => buildInitialGameState({ libraryMap, townhallDef }),
    [libraryMap, townhallDef]
  );

  const nextId = useRef(2);
  const adjustedInitialResources = useMemo(() => {
    const base = initialState.resources;
    const goodsStart = config.goodsStartBonus ?? 0;
    return {
      ...base,
      coins: (base.coins ?? 0) + (config.extraCoins ?? 0),
      supplies: (base.supplies ?? 0) + (config.extraSupplies ?? 0),
      goods: GOODS_TYPES.reduce(
        (acc, g) => ({ ...acc, [g]: (base.goods[g] ?? 0) + goodsStart }),
        {}
      ),
      units: { ...(base.units ?? {}) },
    };
  }, [initialState.resources, config]);

  const {
    resources,
    setResources,
    spendResources,
    refundResources,
    adjustGoods,
    adjustUnits,
  } = useResources(adjustedInitialResources);

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
  const [notes, setNotes] = useState(initialState.notes);
  const [infiniteResources, setInfiniteResources] = useState(
    initialState.infiniteResources
  );
  const [infiniteBackup, setInfiniteBackup] = useState(
    initialState.infiniteBackup
  );
  const [carried, setCarried] = useState(initialState.carried);
  const [moveSnapshot, setMoveSnapshot] = useState(initialState.moveSnapshot);
  const [harvestModal, setHarvestModal] = useState(initialState.harvestModal);
  const [goodsModal, setGoodsModal] = useState(initialState.goodsModal);
  const [unitModal, setUnitModal] = useState(initialState.unitModal);
  const [fastBuyModal, setFastBuyModal] = useState(initialState.fastBuyModal);
  const [fastBuyTarget, setFastBuyTarget] = useState(
    initialState.fastBuyTarget
  );
  const [helpModal, setHelpModal] = useState(initialState.helpModal);
  const [configModal, setConfigModal] = useState(initialState.configModal);
  const [editGoodModal, setEditGoodModal] = useState(initialState.editGoodModal);
  const [unlockChoice, setUnlockChoice] = useState(initialState.unlockChoice);
  const [unlockGoodSelect, setUnlockGoodSelect] = useState(
    initialState.unlockGoodSelect
  );
  const [viewMode, setViewMode] = useState(initialState.viewMode);
  // UI only: scaling of the main board (does not affect regions panel).
  const [boardScale, setBoardScale] = useState(BOARD_SCALE_DEFAULT);
  const [status, setStatus] = useState(initialState.status);
  const [readyMap, setReadyMap] = useState(initialState.readyMap);
  const [buildLocks, setBuildLocks] = useState(initialState.buildLocks || {});
  const [useShortNames, setUseShortNames] = useState(false);
  // Debug: allow quick toggling of region unlocks from the Regions panel (no cost).
  const [debugRegions, setDebugRegions] = useState(false);
  const cloneResources = useCallback(
    (obj) => ({
      ...obj,
      goods: { ...(obj?.goods ?? {}) },
      units: { ...(obj?.units ?? {}) },
    }),
    []
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
      if (infiniteResources) return;
      spendResources(cost);
    },
    [infiniteResources, spendResources]
  );

  const applyRefund = useCallback(
    (delta) => {
      if (infiniteResources) return;
      refundResources(delta);
    },
    [infiniteResources, refundResources]
  );

  const applyAdjustGoods = useCallback(
    (good, delta) => {
      if (infiniteResources) return;
      adjustGoods(good, delta);
    },
    [infiniteResources, adjustGoods]
  );

  const applyAdjustUnits = useCallback(
    (unit, delta) => {
      if (infiniteResources) return;
      adjustUnits(unit, delta);
    },
    [infiniteResources, adjustUnits]
  );

  const handleToggleInfinite = useCallback(
    (checked) => {
      if (checked) {
        setInfiniteBackup(cloneResources(resources));
        setInfiniteResources(true);
      } else {
        if (infiniteBackup) setResources(cloneResources(infiniteBackup));
        setInfiniteResources(false);
        setInfiniteBackup(null);
      }
    },
    [cloneResources, resources, infiniteBackup, setResources]
  );

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

    const isUnlocked = (cx, cy) =>
      regionIsCellUnlocked(cx, cy, unlockedRegions);
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

      let placement = fitsAt(17, 4, prevLayout) ? { x: 17, y: 4 } : null;
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
      setBuildLocks((prev) => ({ ...prev, [id]: townhallDef.buildTime === 10 }));
      return [...prevLayout, instance];
    });
  }, [townhallDef, carried, unlockedRegions, layout]);

  useEffect(() => {
    const ids = new Set(layout.map((b) => b.id));
    setReadyMap((prev) => {
      const next = {};
      layout.forEach((b) => {
        next[b.id] = prev[b.id] ?? false;
      });
      return next;
    });
    setBuildLocks((prev) => {
      const next = {};
      layout.forEach((b) => {
        next[b.id] =
          prev[b.id] !== undefined
            ? prev[b.id]
            : libraryMap[b.defId]?.buildTime === 10;
      });
      return next;
    });
  }, [layout, libraryMap]);

  const selectedDef = selectedBuildingId
    ? libraryMap[selectedBuildingId]
    : null;

  const updateStatus = useCallback((msg) => {
    setStatus(msg);
  }, []);

  // Capture a serializable snapshot for undo/redo.
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
        buildLocks,
        moveMode,
        sellMode,
        refundMode,
        selectedCategory,
        infiniteResources,
        infiniteBackup,
        notes,
      }),
    [
      resources,
      layout,
      unlockedRegions,
      goodsUnlocks,
      shardUnlocks,
      readyMap,
      buildLocks,
      moveMode,
      sellMode,
      refundMode,
      selectedCategory,
      infiniteResources,
      infiniteBackup,
      notes,
    ]
  );

  // Restore a serialized snapshot into state.
  const applySnapshot = useCallback(
    (snapshot) =>
      applySnapshotState(snapshot, {
    setResources,
    setLayout,
    setUnlockedRegions,
    setGoodsUnlocks,
    setShardUnlocks,
    setReadyMap,
        setBuildLocks,
        setMoveMode,
        setSellMode,
    setRefundMode,
    setSelectedCategory,
    setLoadName,
    setNotes,
    setInfiniteResources,
    setInfiniteBackup,
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
      setBuildLocks,
      setMoveMode,
      setSellMode,
      setRefundMode,
      setSelectedCategory,
      setNotes,
      setInfiniteResources,
      setInfiniteBackup,
      townhallDef,
    ]
  );

  const { undoStack, redoStack, pushHistory, handleUndo, handleRedo } =
    useUndoRedo(buildSnapshot, applySnapshot);

  // Clears interaction modes and deselects building.
  const resetModes = useCallback(() => {
    setMoveMode(false);
    setSellMode(false);
    setRefundMode(false);
    setSelectedBuildingId(null);
  }, []);

  // Debug editor: set numeric resource.
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

  // Debug editor: set goods amount.
  const handleEditGood = useCallback(
    (goodKey) => {
      if (!goodKey) return;
      const current = resources?.goods?.[goodKey] ?? 0;
      setEditGoodModal({ goodKey, value: current });
    },
    [resources]
  );

  const applyGoodEdit = useCallback(
    (amount, applyAll = false) => {
      if (!editGoodModal?.goodKey && !applyAll) return;
      const nextVal = Math.max(0, Math.floor(Number(amount) || 0));
      const snapshot = buildSnapshot();
      pushHistory(snapshot);
      setResources((prev) => {
        const goods = { ...(prev.goods ?? {}) };
        if (applyAll) {
          GOODS_TYPES.forEach((g) => {
            goods[g] = nextVal;
          });
        } else if (editGoodModal?.goodKey) {
          goods[editGoodModal.goodKey] = nextVal;
        }
        return { ...prev, goods };
      });
      const label = applyAll
        ? `Alle Gueter auf ${nextVal} gesetzt`
        : `${editGoodModal?.goodKey} auf ${nextVal} gesetzt`;
      updateStatus(label);
      setEditGoodModal(null);
    },
    [buildSnapshot, editGoodModal, pushHistory, setResources, updateStatus]
  );

  const cancelEditGood = useCallback(() => {
    setEditGoodModal(null);
  }, []);

  // Undo while clearing any carried building context.
  const undoWithCleanup = useCallback(() => {
    if (!undoStack.length) {
      updateStatus("Nothing to undo");
      return;
    }
    handleUndo();
    updateStatus("Undo");
    setCarried(null);
    setMoveSnapshot(null);
  }, [handleUndo, undoStack.length, updateStatus]);

  // Redo while clearing any carried building context.
  const redoWithCleanup = useCallback(() => {
    if (!redoStack.length) {
      updateStatus("Nothing to redo");
      return;
    }
    handleRedo();
    updateStatus("Redo");
    setCarried(null);
    setMoveSnapshot(null);
  }, [handleRedo, redoStack.length, updateStatus]);

  const isCellUnlocked = useCallback(
    (x, y) => regionIsCellUnlocked(x, y, unlockedRegions),
    [unlockedRegions]
  );

  // Prompted save of the current snapshot.
  const handleSaveState = useCallback(
    (nameArg) => {
      const targetName =
        nameArg || loadName || prompt("Save name?", loadName || "");
      if (!targetName) return;
      const snapshotBefore = buildSnapshot();
      pushHistory(snapshotBefore);
      const snapshot = buildSnapshot();
      saveSnapshot(targetName, snapshot);
      setLoadName(targetName);
      updateStatus(`Saved state "${targetName}"`);
    },
    [
      buildSnapshot,
      loadName,
      saveSnapshot,
      setLoadName,
      updateStatus,
      pushHistory,
    ]
  );

  // Load a named snapshot and clear transient UI state.
  const handleLoadState = useCallback(
    (name) => {
      if (!name) return;
      const snap = loadSnapshot(name);
      if (!snap) return;
      const prev = buildSnapshot();
      pushHistory(prev);
      applySnapshot(snap);
      setCarried(null);
      setMoveSnapshot(null);
      setMoveMode(false);
      setLoadName(name);
      updateStatus(`Loaded state "${name}"`);
    },
    [applySnapshot, loadSnapshot, updateStatus, buildSnapshot, pushHistory, setLoadName]
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

  const unlockedLayout = useMemo(
    () => layout.filter((b) => !buildLocks[b.id]),
    [layout, buildLocks]
  );

  const baseStats = computeStats(unlockedLayout, libraryMap);
  const coinBoostCfg = Number(config?.coinBoost ?? 0) / 100;
  const supplyBoostCfg = Number(config?.supplyBoost ?? 0) / 100;
  const statsWithConfig = {
    ...baseStats,
    coinBoost: (baseStats.coinBoost ?? 0) + coinBoostCfg,
    supplyBoost: (baseStats.supplyBoost ?? 0) + supplyBoostCfg,
  };
  const stats = statsWithConfig;
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
    resources: effectiveResources,
    layout,
    libraryMap,
  });

  // Collect production for a set of buildings and update readiness.
  const harvestBuildings = useCallback(
    (
      instances,
      label = "Harvest",
      skipPopup = false,
      skipHistory = false,
      options = {}
    ) => {
      if (!instances.length) return;
      const snapshot = skipHistory ? null : buildSnapshot();
      if (!skipHistory) pushHistory(snapshot);

      const locks = options.buildLocksOverride ?? buildLocks;
      const useStats = options.statsOverride ?? stats;
      const lockedIds = [];
      const harvestable = [];
      instances.forEach((inst) => {
        if (locks[inst.id]) lockedIds.push(inst.id);
        else harvestable.push(inst);
      });

      const total =
        harvestable.length > 0
          ? aggregateHarvest(harvestable, libraryMap, useStats)
          : { coins: 0, supplies: 0, chronos: 0, goods: {} };

      if (!infiniteResources) {
        setResources((prev) => ({
          ...prev,
          coins: prev.coins + (total.coins ?? 0),
          supplies: prev.supplies + (total.supplies ?? 0),
          chronos: prev.chronos + (total.chronos ?? 0),
          goods: GOODS_TYPES.reduce(
            (acc, g) => ({
              ...acc,
              [g]: (prev.goods?.[g] ?? 0) + (total.goods?.[g] ?? 0),
            }),
            {}
          ),
          units: { ...(prev.units ?? {}) },
        }));
      }
      const harvestedIds = instances.map((i) => i.id);
      setReadyMap((prev) => {
        const next = { ...prev };
        harvestedIds.forEach((id) => {
          next[id] = false;
        });
        return next;
      });
      if (lockedIds.length) {
        setBuildLocks((prev) => {
          const next = { ...prev };
          lockedIds.forEach((id) => {
            next[id] = false;
          });
          return next;
        });
      }
      if (!skipPopup) {
        setHarvestModal({
          delta: total,
          result: buildHarvestResult({ total, resources }),
          title: label,
        });
      }
    },
    [
      buildSnapshot,
      libraryMap,
      stats,
      setResources,
      pushHistory,
      resources,
      infiniteResources,
      buildLocks,
    ]
  );

  // Unlock region via goods or shards, with fast-buy fallback.
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
        if (
          !infiniteResources &&
          !canAffordSingleGood(
            effectiveResources.goods,
            goodKey,
            currentGoodsCost
          )
        ) {
          const fastBuy = prepareFastBuyModal({
            goodKey,
            resources: effectiveResources,
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
        applyAdjustGoods(goodKey, -currentGoodsCost);
        setGoodsUnlocks((prev) => prev + 1);
        setUnlockedRegions((prev) =>
          prev.map((val, i) => (i === idx ? true : val))
        );
      } else {
        if (
          !infiniteResources &&
          (effectiveResources.shards ?? 0) < currentShardCost
        ) {
          updateStatus("Need more shards to unlock.");
          return;
        }
        const snapshot = buildSnapshot();
        pushHistory(snapshot);
        if (!infiniteResources) {
          setResources((prev) => ({
            ...prev,
            shards: prev.shards - currentShardCost,
          }));
        }
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
      applyAdjustGoods,
      buildSnapshot,
      currentGoodsCost,
      currentShardCost,
      layout,
      libraryMap,
      pushHistory,
      resources,
      effectiveResources,
      setResources,
      updateStatus,
      infiniteResources,
    ]
  );

  // Enable/disable region debug tools.
  const toggleDebugRegions = useCallback(() => {
    setDebugRegions((prev) => !prev);
  }, []);

  // Compute cell bounds (inclusive) for a region index.
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

  // Check if any building occupies a given region.
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

  // Debug: unlock a region without cost.
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

  // Debug: relock a region if empty and not base.
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

  // Toggle move mode; starts/stops carrying interactions.
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

  // Toggle sell mode (coin return).
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

  // Toggle refund mode (full cost return).
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

  // Execute a goods purchase for a producer building.
  const handleGoodsPurchase = useCallback(
    (def, amount) => {
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
      const snapshot = buildSnapshot();
      pushHistory(snapshot);
      applySpend(cost);
      applyAdjustGoods(def.produces, Number(amount));
    },
    [
      effectiveResources,
      resources,
      updateStatus,
      buildSnapshot,
      pushHistory,
      applySpend,
      applyAdjustGoods,
      infiniteResources,
    ]
  );

  const handleUnitPurchase = useCallback(
    (def, amount) => {
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
      const snapshot = buildSnapshot();
      pushHistory(snapshot);
      applySpend(cost);
      applyAdjustUnits(def.produces, Number(amount));
      updateStatus(`Produced ${amount} ${def.produces}`);
    },
    [
      effectiveResources,
      updateStatus,
      buildSnapshot,
      pushHistory,
      applySpend,
      applyAdjustUnits,
      infiniteResources,
    ]
  );

  // Handle fast-buy flow to unlock regions with lacking goods.
  const handleFastBuy = useCallback(
    (option) => {
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
      const totals = totalFastBuyCost(option);
      const snapshot = buildSnapshot();
      pushHistory(snapshot);
      applySpend({ coins: totals.coins, supplies: totals.supplies });
      applyAdjustGoods(goodKey, option.totalAmount - goodsCost);
      setUnlockedRegions((prev) =>
        prev.map((val, i) => (i === fastBuyTarget ? true : val))
      );
      setGoodsUnlocks((prev) => prev + 1);
      setFastBuyModal(null);
      setFastBuyTarget(null);
    },
    [
      applyAdjustGoods,
      applySpend,
      buildSnapshot,
      effectiveResources,
      fastBuyModal,
      fastBuyTarget,
      pushHistory,
      resources,
      updateStatus,
      infiniteResources,
    ]
  );

  // Mark all productions as ready.
  const finishProductions = useCallback(() => {
    const snapshot = buildSnapshot();
    pushHistory(snapshot);
    setReadyMap((prev) =>
      finishProductionsReadyMap(layout, libraryMap, prev, buildLocks)
    );
  }, [buildSnapshot, pushHistory, layout, libraryMap, buildLocks]);

  // Harvest either all ready buildings or everything.
  const harvestAll = useCallback(() => {
    const snapshot = buildSnapshot();
    pushHistory(snapshot);

    const buildLocksAfter = { ...buildLocks };
    let unlockedAny = false;
    Object.keys(buildLocksAfter).forEach((key) => {
      if (buildLocksAfter[key]) {
        buildLocksAfter[key] = false;
        unlockedAny = true;
      }
    });
    if (unlockedAny) setBuildLocks(buildLocksAfter);

    const effectiveStats = computeStats(layout, libraryMap);
    const readyOnes = layout.filter((b) => readyMap[b.id] === true);
    if (readyOnes.length > 0) {
      harvestBuildings(readyOnes, "Partial Harvest", false, true, {
        statsOverride: effectiveStats,
        buildLocksOverride: buildLocksAfter,
      });
    } else {
      harvestBuildings(layout, "Full Harvest", false, true, {
        statsOverride: effectiveStats,
        buildLocksOverride: buildLocksAfter,
      });
    }
  }, [
    layout,
    readyMap,
    harvestBuildings,
    buildLocks,
    setBuildLocks,
    computeStats,
    libraryMap,
    buildSnapshot,
    pushHistory,
  ]);

  // Close harvest modal after acknowledgment.
  const confirmHarvest = useCallback(() => {
    setHarvestModal(null);
  }, []);

  // Close harvest modal without extra action.
  const cancelHarvest = useCallback(() => {
    setHarvestModal(null);
  }, []);

  // Update freeform notes tied to the current city state.
  const handleChangeNotes = useCallback((val) => {
    setNotes(val ?? "");
  }, []);

  // Core board click handler covering placement, moving, selling, harvesting, and goods modal.
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
          setBuildLocks,
          buildLocks,
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
        if (readyMap[target.id] === true) {
          harvestBuildings([target], "Harvest", true, true);
        }
        const snapshot = buildSnapshot();
        pushHistory(snapshot);
        if (!infiniteResources) refundResources(delta);
        setLayout((prev) => prev.filter((p) => p.id !== target.id));
        setReadyMap((prev) => {
          const next = { ...prev };
          delete next[target.id];
          return next;
        });
        setBuildLocks((prev) => {
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
        if (
          !infiniteResources &&
          !canAffordResources(effectiveResources, selectedDef.cost)
        ) {
          updateStatus("Not enough resources.");
          return;
        }
        const snapshot = buildSnapshot();
        applySpend(selectedDef.cost);
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
        setBuildLocks((prev) => ({
          ...prev,
          [instance.id]: selectedDef.buildTime === 10,
        }));
        pushHistory(snapshot);
        updateStatus(`Placed ${selectedDef.name}`);
        return;
      }

      if (moveMode && target) {
        const snapshot = buildSnapshot();
        setMoveSnapshot(snapshot);
        setLayout((prev) => prev.filter((p) => p.id !== target.id));
      setCarried({
        instance: {
          ...target,
          ready: readyMap[target.id],
          locked: buildLocks[target.id],
        },
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
        readyMap[target.id] === true
      ) {
        harvestBuildings([target], "Harvest", true);
        return;
      }

      if (
        !moveMode &&
        target &&
        libraryMap[target.defId]?.category === "military"
      ) {
        const def = libraryMap[target.defId];
        setUnitModal({ def });
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
      effectiveResources,
      applySpend,
      moveMode,
      sellMode,
      readyMap,
      harvestBuildings,
      setGoodsModal,
      updateStatus,
      infiniteResources,
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
    statusOffsetPx,
    boardTransformClass,
    cellSizePx,
  } = computeViewTransforms(viewMode, viewWidth, viewHeight, boardScale);

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
    setGoodsUnlocks,
    shardUnlocks,
    setShardUnlocks,
    goodsModal,
    setGoodsModal,
    unitModal,
    setUnitModal,
    fastBuyModal,
    fastBuyTarget,
    unlockChoice,
    unlockGoodSelect,
    configModal,
    viewMode,
    setViewMode,
    boardScale,
    setBoardScale,
    status,
    notes,
    setNotes,
    handleChangeNotes,
    useShortNames,
    setUseShortNames,
    carried,
    readyMap,
    buildLocks,
    useShortNames,
    setUseShortNames,
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
    statusOffsetPx,
    boardTransformClass,
    cellSizePx,
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
    handleUnitPurchase,
    handleFastBuy,
    resetModes,
    handleEditResource,
    handleEditGood,
    isCellUnlocked,
    undoStack,
    redoStack,
    infiniteResources,
    handleToggleInfinite,
    helpModal,
    setHelpModal,
    editGoodModal,
    setEditGoodModal,
    configModal,
    setConfigModal,
    config,
    updateConfig,
    applyGoodEdit,
    cancelEditGood,
  };
};
