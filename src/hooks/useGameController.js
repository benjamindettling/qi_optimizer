// Central game-state hook: orchestrates layout, placement, economy, regions, and modals.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  BOARD_HEIGHT,
  BOARD_WIDTH,
  REGION_SIZE,
  REGION_COLS,
  REGION_MASK,
  REGION_GOODS_COSTS,
  REGION_SHARD_COSTS,
  GOODS_TYPES,
  UNIT_TYPES,
  BOARD_SCALE_DEFAULT,
  BOARD_SCALE_MIN,
  BOARD_SCALE_MAX,
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
import { solveTilingMask } from "../utils/tilingSolver";
import {
  applyTilingSolution,
  buildTilingGroups,
  buildTilingMask,
} from "../utils/tilingTranslator";
import { isAreaFree } from "../utils/layoutUtils";
import { useResources } from "./useResources";
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
import { formatNumber } from "../utils/formatNumber";
import { useCheckpoints } from "./useCheckpoints";

const VIEW_MODE_STORAGE_KEY = "qi_viewMode";
const BOARD_SCALE_STORAGE_KEY = "qi_boardScale";
const INFINITE_STORAGE_KEY = "qi_infiniteResources";
const SHORTNAME_STORAGE_KEY = "qi_useShortNames";
const SNAPSHOT_LIMIT = BigInt;

// Primary controller that exposes all state and actions for the app.
export const useGameController = () => {
  const { library, libraryMap, categories, categoryColors, townhallDef } =
    useMemo(() => buildLibrary(), []);
  const { config, updateConfig } = useConfig();
  const allowNegativeShards = !!config?.allowNegativeShards;

  const initialState = useMemo(
    () => buildInitialGameState({ libraryMap, townhallDef }),
    [libraryMap, townhallDef],
  );

  const nextId = useRef(2);
  const smartInvestRunningRef = useRef(false);
  const smartInvestStepResolveRef = useRef(null);
  const adjustedInitialResources = useMemo(() => {
    const base = initialState.resources;
    const goodsStart = config.goodsStartBonus ?? 0;
    const shardsStart = Number(config.shardsStart ?? base.shards ?? 0);
    return {
      ...base,
      coins: (base.coins ?? 0) + (config.extraCoins ?? 0),
      supplies: (base.supplies ?? 0) + (config.extraSupplies ?? 0),
      shards: shardsStart,
      goods: GOODS_TYPES.reduce(
        (acc, g) => ({ ...acc, [g]: (base.goods[g] ?? 0) + goodsStart }),
        {},
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
    initialState.unlockedRegions,
  );
  const [goodsUnlocks, setGoodsUnlocks] = useState(initialState.goodsUnlocks);
  const [shardUnlocks, setShardUnlocks] = useState(initialState.shardUnlocks);
  const [selectedCategory, setSelectedCategory] = useState(
    initialState.selectedCategory,
  );
  const [selectedBuildingId, setSelectedBuildingId] = useState(
    initialState.selectedBuildingId,
  );
  const [selectedIds, setSelectedIds] = useState(
    () => new Set(initialState.selectedIds || []),
  );

  const [hoverCell, setHoverCell] = useState(initialState.hoverCell);
  const [moveMode, setMoveMode] = useState(initialState.moveMode);
  const [sellMode, setSellMode] = useState(initialState.sellMode);
  const [refundMode, setRefundMode] = useState(initialState.refundMode);
  const [boostMode, setBoostMode] = useState(initialState.boostMode);
  const [notes, setNotes] = useState(initialState.notes);
  const [infiniteResources, setInfiniteResources] = useState(() => {
    if (typeof window === "undefined") return initialState.infiniteResources;
    try {
      const raw = localStorage.getItem(INFINITE_STORAGE_KEY);
      if (raw === "true") return true;
      if (raw === "false") return false;
    } catch {}
    return initialState.infiniteResources;
  });
  const [carried, setCarried] = useState(initialState.carried);
  const [moveSnapshot, setMoveSnapshot] = useState(initialState.moveSnapshot);
  const [harvestModal, setHarvestModal] = useState(initialState.harvestModal);
  const [smartHarvestModal, setSmartHarvestModal] = useState(null);
  const [smartInvestModal, setSmartInvestModal] = useState(null);
  const [smartInvestResults, setSmartInvestResults] = useState(null);
  const [smartInvestRunning, setSmartInvestRunning] = useState(false);
  const [goodsModal, setGoodsModal] = useState(initialState.goodsModal);
  const [unitModal, setUnitModal] = useState(initialState.unitModal);
  const [fastBuyModal, setFastBuyModal] = useState(initialState.fastBuyModal);
  const [fastBuyTarget, setFastBuyTarget] = useState(
    initialState.fastBuyTarget,
  );
  const [helpModal, setHelpModal] = useState(initialState.helpModal);
  const [configModal, setConfigModal] = useState(initialState.configModal);
  const [editResourceModal, setEditResourceModal] = useState(null);
  const [editGoodModal, setEditGoodModal] = useState(
    initialState.editGoodModal,
  );
  const [editUnitModal, setEditUnitModal] = useState(null);
  const [autoSelectNew, setAutoSelectNew] = useState(false);
  const [worstModal, setWorstModal] = useState(null);
  const [exportModal, setExportModal] = useState(false);
  const [importModal, setImportModal] = useState(false);
  const [pastEditModal, setPastEditModal] = useState(false);
  const [timeStep, setTimeStep] = useState(initialState.timeStep ?? 1);
  const [unlockChoice, setUnlockChoice] = useState(initialState.unlockChoice);
  const [unlockGoodSelect, setUnlockGoodSelect] = useState(
    initialState.unlockGoodSelect,
  );
  const [viewMode, setViewMode] = useState(() => {
    if (typeof window === "undefined") return initialState.viewMode;
    try {
      const saved = localStorage.getItem(VIEW_MODE_STORAGE_KEY);
      const allowed = ["down", "diagonal", "right"];
      return saved && allowed.includes(saved) ? saved : initialState.viewMode;
    } catch {
      return initialState.viewMode;
    }
  });
  // UI only: scaling of the main board (does not affect regions panel).
  const [boardScale, setBoardScale] = useState(() => {
    if (typeof window === "undefined") return BOARD_SCALE_DEFAULT;
    const raw = parseFloat(localStorage.getItem(BOARD_SCALE_STORAGE_KEY));
    if (
      !Number.isNaN(raw) &&
      raw >= BOARD_SCALE_MIN &&
      raw <= BOARD_SCALE_MAX
    ) {
      return raw;
    }
    return BOARD_SCALE_DEFAULT;
  });
  const [status, setStatus] = useState(initialState.status);
  const [readyMap, setReadyMap] = useState(initialState.readyMap);
  const [buildLocks, setBuildLocks] = useState(initialState.buildLocks || {});
  const [useShortNames, setUseShortNames] = useState(() => {
    if (typeof window === "undefined") return false;
    try {
      const raw = localStorage.getItem(SHORTNAME_STORAGE_KEY);
      return raw === "true";
    } catch {
      return false;
    }
  });
  // Debug: allow quick toggling of region unlocks from the Regions panel (no cost).
  const [debugRegions, setDebugRegions] = useState(false);

  useEffect(() => {
    setDebugRegions(infiniteResources);
  }, [infiniteResources]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(VIEW_MODE_STORAGE_KEY, viewMode);
    } catch (e) {
      console.error("Failed to persist view mode", e);
    }
  }, [viewMode]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(BOARD_SCALE_STORAGE_KEY, String(boardScale));
    } catch (e) {
      console.error("Failed to persist board scale", e);
    }
  }, [boardScale]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(
        INFINITE_STORAGE_KEY,
        infiniteResources ? "true" : "false",
      );
    } catch (e) {
      console.error("Failed to persist infinite toggle", e);
    }
  }, [infiniteResources]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(
        SHORTNAME_STORAGE_KEY,
        useShortNames ? "true" : "false",
      );
    } catch (e) {
      console.error("Failed to persist short-names toggle", e);
    }
  }, [useShortNames]);

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
      if (infiniteResources) return;
      spendResources(cost);
    },
    [infiniteResources, spendResources],
  );

  const applyRefund = useCallback(
    (delta) => {
      if (infiniteResources) return;
      refundResources(delta);
    },
    [infiniteResources, refundResources],
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

  const {
    saves,
    loadName,
    setLoadName,
    savesLoaded,
    setAllSaves,
    saveSnapshot,
    loadSnapshot,
    deleteSave,
  } = useSaves();
  const visibleSaves = useMemo(() => {
    const next = {};
    Object.entries(saves || {}).forEach(([name, entry]) => {
      if (entry?.meta?.isSnapshot) return;
      next[name] = entry;
    });
    return next;
  }, [saves]);
  const snapshots = useMemo(() => {
    const raw = Object.entries(saves || {})
      .filter(([, entry]) => entry?.meta?.isSnapshot)
      .map(([name, entry]) => ({ name, meta: entry.meta || {} }));
    const sorted = [...raw].sort((a, b) => {
      const ai = a.meta.snapshotIndex ?? 0;
      const bi = b.meta.snapshotIndex ?? 0;
      if (ai && bi && ai !== bi) return ai - bi;
      const ac = a.meta.createdAt || "";
      const bc = b.meta.createdAt || "";
      if (ac && bc && ac !== bc) return ac.localeCompare(bc);
      return a.name.localeCompare(b.name);
    });
    return sorted.map((entry, idx) => {
      const index = entry.meta.snapshotIndex ?? idx;
      const label = entry.meta.label || `Snapshot ${index}`;
      const log = entry.meta.log || "";
      return { name: entry.name, index, label, log };
    });
  }, [saves]);
  const initialSnapshotMadeRef = useRef(false);
  const [selectedSnapshotName, setSelectedSnapshotName] = useState(null);
  const [activeSnapshotName, setActiveSnapshotName] = useState(null);

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
        isUnlocked,
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
      setBuildLocks((prev) => ({
        ...prev,
        [id]: townhallDef.buildTime === 10,
      }));
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

  const lastStatusRef = useRef("");

  const updateStatus = useCallback((msg) => {
    setStatus(msg);
    lastStatusRef.current = msg || "";
  }, []);

  // Capture a serializable snapshot of the current game state.
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
        boostMode,
        selectedCategory,
        notes,
        timeStep,
        loadName,
        selectedBuildingId,
        selectedIds: Array.from(selectedIds ?? []),
      }),
    [
      resources,
      layout,
      unlockedRegions,
      goodsUnlocks,
      shardUnlocks,
      readyMap,
      buildLocks,
      boostMode,
      moveMode,
      sellMode,
      refundMode,
      selectedCategory,
      notes,
      timeStep,
      selectedIds,
      loadName,
      selectedBuildingId,
    ],
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
        setBoostMode,
        setMoveMode,
        setSellMode,
        setRefundMode,
        setSelectedCategory,
        setTimeStep,
        setLoadName,
        setNotes,
        setSelectedIds,
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
      setBoostMode,
      setMoveMode,
      setSellMode,
      setRefundMode,
      setSelectedCategory,
      setTimeStep,
      setLoadName,
      setNotes,
      setSelectedIds,
      townhallDef,
    ],
  );

  const {
    checkpoints,
    checkpointIndex,
    setCheckpointIndex,
    editUnlocked,
    setEditUnlocked,
    isPast,
    editingLocked,
    canTimeBack,
    canTimeForward,
    jumpBackTime,
    jumpForwardTime,
    branchFromPast,
    trimFutureCheckpoints,
    applyLoadedCheckpoints,
    updateCheckpoints,
    makeCheckpointsForSave,
    addCheckpointPart,
    currentPart,
    currentPartTotal,
    suppressNextCheckpoint,
    overwriteCheckpointAtIndex,
    enableEditFromPast,
    pauseCheckpointTracking,
    resumeCheckpointTracking,
  } = useCheckpoints({
    buildSnapshot,
    applySnapshot,
    timeStep,
    setTimeStep,
  });

  useEffect(() => {
    if (checkpointIndex === null) return;
    const snap = buildSnapshot();
    overwriteCheckpointAtIndex(snap, checkpointIndex);
  }, [
    checkpointIndex,
    buildSnapshot,
    overwriteCheckpointAtIndex,
    layout,
    resources,
    readyMap,
    buildLocks,
    notes,
    selectedIds,
    selectedBuildingId,
    timeStep,
  ]);

  const [pendingAutoSnapshot, setPendingAutoSnapshot] = useState(null);

  const requestAutoSnapshot = useCallback(
    (options = {}) => {
      const { waitForCheckpoint = true } = options;
      const tailUid = checkpoints[checkpoints.length - 1]?.uid ?? null;
      setPendingAutoSnapshot({
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        waitForCheckpoint,
        tailUid,
      });
    },
    [checkpoints],
  );

  const handleAddCheckpointPart = useCallback(() => {
    suppressNextCheckpoint(2);
    setNotes("");
    setSelectedIds(new Set());
    setSelectedBuildingId(null);
    setTimeout(() => {
      addCheckpointPart();
      requestAutoSnapshot();
    }, 0);
  }, [
    suppressNextCheckpoint,
    setNotes,
    setSelectedIds,
    setSelectedBuildingId,
    addCheckpointPart,
    requestAutoSnapshot,
  ]);

  const handleToggleInfinite = useCallback(
    (checked) => {
      if (editingLocked) {
        updateStatus("Bearbeitung gesperrt. Bearbeitung aktivieren.");
        return;
      }
      setInfiniteResources(!!checked);
    },
    [editingLocked, updateStatus],
  );

  // Clears interaction modes and deselects building.
  const resetModes = useCallback(() => {
    setMoveMode(false);
    setSellMode(false);
    setRefundMode(false);
    setBoostMode(false);
    setSelectedBuildingId(null);
  }, []);

  // Admin editor: open modal for numeric resource.
  const handleEditResource = useCallback(
    (descriptor) => {
      if (editingLocked) {
        updateStatus("Bearbeitung gesperrt. Bearbeitung aktivieren.");
        return;
      }
      if (!infiniteResources) {
        updateStatus("Admin-Modus aktivieren, um Werte zu bearbeiten.");
        return;
      }
      if (!descriptor?.key) return;
      const current = resources?.[descriptor.key] ?? 0;
      setEditResourceModal({
        ...descriptor,
        value: current,
      });
    },
    [resources, editingLocked, infiniteResources, updateStatus],
  );

  // Admin editor: set goods amount.
  const handleEditGood = useCallback(
    (goodKey) => {
      if (editingLocked) {
        updateStatus("Bearbeitung gesperrt. Bearbeitung aktivieren.");
        return;
      }
      if (!infiniteResources) {
        updateStatus("Admin-Modus aktivieren, um Werte zu bearbeiten.");
        return;
      }
      if (!goodKey) return;
      const current = resources?.goods?.[goodKey] ?? 0;
      setEditGoodModal({ goodKey, value: current });
    },
    [resources, editingLocked, updateStatus, infiniteResources],
  );

  // Admin editor: set unit amount.
  const handleEditUnit = useCallback(
    (unitKey) => {
      if (editingLocked) {
        updateStatus("Bearbeitung gesperrt. Bearbeitung aktivieren.");
        return;
      }
      if (!infiniteResources) {
        updateStatus("Admin-Modus aktivieren, um Werte zu bearbeiten.");
        return;
      }
      if (!unitKey) return;
      const current = resources?.units?.[unitKey] ?? 0;
      setEditUnitModal({ unitKey, value: current });
    },
    [resources, editingLocked, infiniteResources, updateStatus],
  );

  const handleSetGoodsUnlocks = useCallback(
    (nextIdx) => {
      if (editingLocked) {
        updateStatus("Bearbeitung gesperrt. Bearbeitung aktivieren.");
        return;
      }
      const idxRaw = Number(nextIdx);
      if (!Number.isFinite(idxRaw)) return;
      const maxIdx = REGION_GOODS_COSTS.length - 1;
      const prevIdx = Math.min(Math.max(goodsUnlocks ?? 0, 0), maxIdx);
      const clampedIdx = Math.min(Math.max(idxRaw, 0), maxIdx);
      if (clampedIdx === prevIdx) return;
      const prevCost = REGION_GOODS_COSTS[prevIdx];
      const nextCost = REGION_GOODS_COSTS[clampedIdx];
      setGoodsUnlocks(clampedIdx);
      updateStatus(
        `naechste Region: ${formatNumber(prevCost)} -> ${formatNumber(
          nextCost,
        )} Gueter`,
      );
      requestAutoSnapshot();
    },
    [
      editingLocked,
      goodsUnlocks,
      setGoodsUnlocks,
      updateStatus,
      requestAutoSnapshot,
    ],
  );

  const handleSetShardUnlocks = useCallback(
    (nextIdx) => {
      if (editingLocked) {
        updateStatus("Bearbeitung gesperrt. Bearbeitung aktivieren.");
        return;
      }
      const idxRaw = Number(nextIdx);
      if (!Number.isFinite(idxRaw)) return;
      const maxIdx = REGION_SHARD_COSTS.length - 1;
      const prevIdx = Math.min(Math.max(shardUnlocks ?? 0, 0), maxIdx);
      const clampedIdx = Math.min(Math.max(idxRaw, 0), maxIdx);
      if (clampedIdx === prevIdx) return;
      const prevCost = REGION_SHARD_COSTS[prevIdx];
      const nextCost = REGION_SHARD_COSTS[clampedIdx];
      setShardUnlocks(clampedIdx);
      updateStatus(
        `naechste Region: ${formatNumber(prevCost)} -> ${formatNumber(
          nextCost,
        )} Scherben`,
      );
      requestAutoSnapshot();
    },
    [
      editingLocked,
      shardUnlocks,
      setShardUnlocks,
      updateStatus,
      requestAutoSnapshot,
    ],
  );

  const applyGoodEdit = useCallback((amount, applyAll = false) => {
    if (!editGoodModal?.goodKey && !applyAll) return;
    const nextVal = Math.max(0, Math.floor(Number(amount) || 0));
    const prevVal = editGoodModal?.value ?? 0;
    const label = applyAll
      ? `Alle Gueter: ${formatNumber(nextVal)}`
      : `${
          GOODS_LABELS[editGoodModal?.goodKey] ?? editGoodModal?.goodKey
        }: ${formatNumber(prevVal)} -> ${formatNumber(nextVal)}`;
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
    updateStatus(label);
    setEditGoodModal(null);
    requestAutoSnapshot();
  });

  const cancelEditGood = useCallback(() => {
    setEditGoodModal(null);
  }, []);

  const RESOURCE_LABELS = {
    coins: "M\u00fcnzen",
    supplies: "Vorr\u00e4te",
    chronos: "Chronos",
    shards: "Scherben",
    quantumActions: "QA",
  };

  const GOODS_LABELS = {
    Kupfer: "Kupfer",
    Honig: "Honig",
    Stein: "Stein",
    Seil: "Seil",
    Schiesspulver: "Schiesspulver",
  };

  const applyResourceEdit = useCallback(
    (amount) => {
      if (!editResourceModal?.key) return;
      const nextVal = Math.max(0, Math.floor(Number(amount) || 0));
      const prevVal = resources?.[editResourceModal.key] ?? 0;
      branchFromPast();
      const resLabel =
        RESOURCE_LABELS[editResourceModal.key] || editResourceModal.key;
      const label = `${resLabel}: ${formatNumber(prevVal)} -> ${formatNumber(
        nextVal,
      )}`;
      setResources((prev) => ({ ...prev, [editResourceModal.key]: nextVal }));
      updateStatus(label);
      setEditResourceModal(null);
      requestAutoSnapshot();
    },
    [
      branchFromPast,
      editResourceModal,
      resources,
      setResources,
      updateStatus,
      requestAutoSnapshot,
    ],
  );

  const cancelEditResource = useCallback(() => {
    setEditResourceModal(null);
  }, []);

  const applyUnitEdit = useCallback(
    (amount) => {
      if (!editUnitModal?.unitKey) return;
      const nextVal = Math.max(0, Math.floor(Number(amount) || 0));
      const prevVal = resources?.units?.[editUnitModal.unitKey] ?? 0;

      const label = `${editUnitModal.unitKey}: ${formatNumber(
        prevVal,
      )} -> ${formatNumber(nextVal)}`;

      setResources((prev) => ({
        ...prev,
        units: {
          ...(prev.units ?? {}),
          [editUnitModal.unitKey]: nextVal,
        },
      }));
      updateStatus(label);
      setEditUnitModal(null);
      requestAutoSnapshot();
    },
    [editUnitModal, resources, setResources, updateStatus, requestAutoSnapshot],
  );

  const cancelEditUnit = useCallback(() => {
    setEditUnitModal(null);
  }, []);

  const resetTransientModes = useCallback(() => {
    setMoveMode(false);
    setSellMode(false);
    setRefundMode(false);
    setBoostMode(false);
    setSelectedBuildingId(null);
    setCarried(null);
    setMoveSnapshot(null);
  }, []);

  const isCellUnlocked = useCallback(
    (x, y) => regionIsCellUnlocked(x, y, unlockedRegions),
    [unlockedRegions],
  );

  // Prompted save of the current snapshot.
  const handleSaveState = useCallback(
    (nameArg) => {
      const targetName =
        nameArg || loadName || prompt("Save name?", loadName || "");
      if (!targetName) return;
      const snapshot = buildSnapshot();
      const latestCp = checkpoints[checkpoints.length - 1];
      const snapshotForSave = latestCp?.snapshot ?? snapshot;
      const stepForSave = latestCp?.timeStep ?? timeStep ?? 1;
      const checkpointsForSave = makeCheckpointsForSave(
        snapshotForSave,
        stepForSave,
        checkpointIndex,
        isPast,
      ).map((cp) => ({
        ...cp,
        snapshot: { ...(cp.snapshot ?? {}), loadName: targetName },
      }));
      saveSnapshot(targetName, {
        snapshot: { ...snapshotForSave, loadName: targetName },
        checkpoints: checkpointsForSave,
      });
      setLoadName(targetName);
      updateStatus(`Saved state "${targetName}"`);
    },
    [
      buildSnapshot,
      loadName,
      saveSnapshot,
      setLoadName,
      updateStatus,
      makeCheckpointsForSave,
      timeStep,
      checkpointIndex,
      isPast,
      checkpoints,
    ],
  );

  const handleTakeSnapshot = useCallback(() => {
    const orderedSnapshots = snapshots;
    const activeIdx =
      activeSnapshotName &&
      orderedSnapshots.some((snap) => snap.name === activeSnapshotName)
        ? orderedSnapshots.findIndex((snap) => snap.name === activeSnapshotName)
        : -1;
    const deleteNames = new Set(
      activeIdx >= 0 && activeIdx < orderedSnapshots.length - 1
        ? orderedSnapshots.slice(activeIdx + 1).map((snap) => snap.name)
        : [],
    );
    const remainingSnapshots = orderedSnapshots.filter(
      (snap) => !deleteNames.has(snap.name),
    );
    const maxIndex = remainingSnapshots.reduce(
      (max, entry) => Math.max(max, entry.index ?? -1),
      -1,
    );
    let index = maxIndex + 1;
    let snapshotName = `__snapshot_${index}`;

    const totalAfterAdd = remainingSnapshots.length + 1;
    if (totalAfterAdd > SNAPSHOT_LIMIT) {
      const removeCount = totalAfterAdd - SNAPSHOT_LIMIT;
      remainingSnapshots.slice(0, removeCount).forEach((snap) => {
        deleteNames.add(snap.name);
      });
    }

    while (saves[snapshotName] && !deleteNames.has(snapshotName)) {
      index += 1;
      snapshotName = `__snapshot_${index}`;
    }
    snapshots
      .filter((snap) => (snap.index ?? -1) > index)
      .forEach((snap) => {
        deleteNames.add(snap.name);
      });
    deleteNames.delete(snapshotName);

    const namesToDelete = Array.from(deleteNames);
    if (namesToDelete.length > 0) {
      setAllSaves((prev) => {
        const next = { ...prev };
        for (const name of namesToDelete) {
          delete next[name];
        }
        return next;
      });
    }

    const label = `Snapshot ${index}`;

    // Current UI state
    const snapshot = buildSnapshot();

    // Use the last checkpoint snapshot as the “base” snapshot, as before
    const latestCp = checkpoints[checkpoints.length - 1];
    const snapshotForSave = latestCp?.snapshot ?? snapshot;
    const stepForSave = latestCp?.timeStep ?? timeStep ?? 1;

    // Build the checkpoint list to save
    const rawCheckpointsForSave = makeCheckpointsForSave(
      snapshotForSave,
      stepForSave,
    );

    // If we are editing a past checkpoint, ensure the checkpoint at checkpointIndex
    // in the saved list actually reflects the current state (snapshot).
    const patchedCheckpointsForSave =
      isPast && checkpointIndex !== null
        ? rawCheckpointsForSave.map((cp, idx) =>
            idx === checkpointIndex
              ? {
                  ...cp,
                  snapshot,
                  // keep existing timeStep or fall back to current one
                  timeStep: cp.timeStep ?? stepForSave,
                }
              : cp,
          )
        : rawCheckpointsForSave;

    const checkpointsForSave = patchedCheckpointsForSave.map((cp) => ({
      ...cp,
      snapshot: { ...(cp.snapshot ?? {}), loadName: snapshotName },
    }));

    saveSnapshot(snapshotName, {
      snapshot: { ...snapshotForSave, loadName: snapshotName },
      checkpoints: checkpointsForSave,
      meta: {
        isSnapshot: true,
        snapshotIndex: index,
        createdAt: new Date().toISOString(),
        label,
        log: lastStatusRef.current || "",
      },
    });

    setSelectedSnapshotName(snapshotName);
    setActiveSnapshotName(snapshotName);
    //updateStatus(`${label} gespeichert`);
  }, [
    snapshots,
    activeSnapshotName,
    saves,
    deleteSave,
    buildSnapshot,
    checkpoints,
    timeStep,
    makeCheckpointsForSave,
    checkpointIndex,
    isPast,
    saveSnapshot,
  ]);

  useEffect(() => {
    if (!savesLoaded) return;
    if (initialSnapshotMadeRef.current) return;
    initialSnapshotMadeRef.current = true;
    handleTakeSnapshot();
  }, [handleTakeSnapshot, savesLoaded]);

  useEffect(() => {
    if (!savesLoaded) return;
    if (!snapshots.length) {
      setSelectedSnapshotName(null);
      return;
    }
    const exists = snapshots.some((s) => s.name === selectedSnapshotName);
    if (!exists) {
      setSelectedSnapshotName(snapshots[0].name);
    }
  }, [snapshots, selectedSnapshotName, savesLoaded]);

  // Load a named snapshot and clear transient UI state.
  const handleLoadState = useCallback(
    (name, options = {}) => {
      if (!name) return;
      const saved = loadSnapshot(name);
      const snap = saved?.snapshot ?? saved;
      if (!snap) return;
      const isSnapshot = !!saved?.meta?.isSnapshot;
      const snapIdx = saved?.meta?.snapshotIndex;
      const logText = saved?.meta?.log;
      const label =
        options.statusOverride ??
        (isSnapshot
          ? logText
            ? `Snapshot '${logText}'`
            : snapIdx
              ? `Snapshot ${snapIdx} geladen`
              : "Snapshot geladen"
          : `Load ${name}`);
      const snapshotToApply = isSnapshot ? { ...snap } : snap;
      if (isSnapshot && snapshotToApply.loadName !== undefined) {
        delete snapshotToApply.loadName;
      }
      applySnapshot(snapshotToApply);
      applyLoadedCheckpoints(saved?.checkpoints ?? [], 1, snap?.timeStep ?? 1);
      setCarried(null);
      setMoveSnapshot(null);
      if (isSnapshot) {
        setMoveMode(false);
        setSellMode(false);
        setRefundMode(false);
        setBoostMode(false);
        setSelectedBuildingId(null);
        setSelectedSnapshotName(name);
        setActiveSnapshotName(name);
      } else {
        setMoveMode(false);
        setLoadName(name);
        setActiveSnapshotName(null);
      }
      updateStatus(label);
      if (options.createSnapshot && !isSnapshot) {
        requestAutoSnapshot({ waitForCheckpoint: false });
      }
    },
    [
      applySnapshot,
      loadSnapshot,
      updateStatus,
      setLoadName,
      applyLoadedCheckpoints,
      buildSnapshot,
      setSelectedBuildingId,
      setSellMode,
      setRefundMode,
      setBoostMode,
      setMoveMode,
      requestAutoSnapshot,
      setActiveSnapshotName,
    ],
  );

  const openPastEditModal = useCallback(() => {
    setPastEditModal(true);
  }, []);

  const closePastEditModal = useCallback(() => {
    setPastEditModal(false);
  }, []);

  const handleEnableEditFromPast = useCallback(() => {
    enableEditFromPast();
    updateStatus("Bearbeitung aktiviert. Zukuenftige Checkpoints entfernt.");
    setPastEditModal(false);
    requestAutoSnapshot();
  }, [enableEditFromPast, updateStatus, requestAutoSnapshot]);

  const handleCopyAndEnableEdit = useCallback(() => {
    const base = (loadName || "").trim();
    let idx = 1;
    let candidate = `${base}_copy${idx}`;
    while (saves[candidate]) {
      idx += 1;
      candidate = `${base}_copy${idx}`;
    }
    const snapshot = buildSnapshot();
    const latestCp = checkpoints[checkpoints.length - 1];
    const snapshotForSave =
      isPast && checkpointIndex !== null
        ? snapshot
        : (latestCp?.snapshot ?? snapshot);
    const stepForSave = latestCp?.timeStep ?? timeStep ?? 1;
    const checkpointsForSave = makeCheckpointsForSave(
      snapshotForSave,
      stepForSave,
      checkpointIndex,
      isPast,
    ).map((cp) => ({
      ...cp,
      snapshot: { ...(cp.snapshot ?? {}), loadName: candidate },
    }));
    saveSnapshot(candidate, {
      snapshot: { ...snapshotForSave, loadName: candidate },
      checkpoints: checkpointsForSave,
    });
    setLoadName(candidate);
    updateStatus(`Kopie gespeichert als "${candidate}"`);
    handleEnableEditFromPast();
  }, [
    loadName,
    saves,
    buildSnapshot,
    makeCheckpointsForSave,
    saveSnapshot,
    setLoadName,
    updateStatus,
    timeStep,
    handleEnableEditFromPast,
    checkpointIndex,
    isPast,
  ]);

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
    [layout, buildLocks],
  );

  const computeLockedPeopleReq = useCallback(
    (layoutList, locks) =>
      (layoutList || []).reduce((acc, inst) => {
        if (!locks?.[inst.id]) return acc;
        const def = libraryMap[inst.defId];
        if (!def || def.category === "housing") return acc;
        const req = def.requiresPeople ?? 0;
        return req > 0 ? acc + req : acc;
      }, 0),
    [libraryMap],
  );

  const computeStatsWithLockedPeopleReq = useCallback(
    (layoutList, locks) => {
      const unlocked = (layoutList || []).filter((b) => !locks?.[b.id]);
      const base = computeStats(unlocked, libraryMap);
      const lockedReq = computeLockedPeopleReq(layoutList, locks);
      if (!lockedReq) return base;
      return { ...base, peopleReq: (base.peopleReq ?? 0) + lockedReq };
    },
    [computeLockedPeopleReq, libraryMap],
  );

  const baseStats = useMemo(
    () => computeStatsWithLockedPeopleReq(layout, buildLocks),
    [layout, buildLocks, computeStatsWithLockedPeopleReq],
  );
  const coinBoostCfg = Number(config?.coinBoost ?? 0) / 100;
  const supplyBoostCfg = Number(config?.supplyBoost ?? 0) / 100;
  const armyBoostRedCfg = Number(config?.armyBoostRed ?? 0) / 100;
  const armyBoostBlueCfg = Number(config?.armyBoostBlue ?? 0) / 100;
  const applyConfigBoosts = useCallback(
    (base) => ({
      ...base,
      coinBoost: (base.coinBoost ?? 0) + coinBoostCfg,
      supplyBoost: (base.supplyBoost ?? 0) + supplyBoostCfg,
      armyBoostRed: (base.armyBoostRed ?? 0) + armyBoostRedCfg,
      armyBoostBlue: (base.armyBoostBlue ?? 0) + armyBoostBlueCfg,
    }),
    [coinBoostCfg, supplyBoostCfg, armyBoostRedCfg, armyBoostBlueCfg],
  );
  const qaBasePerHour = 5000 + Number(config?.qaBaseBonus ?? 0);
  const qaHoursPerHarvest = Number(config?.qaHarvestHours ?? 12);
  const qaRateFromBuildings = useMemo(
    () =>
      layout.reduce(
        (acc, b) => acc + (libraryMap[b.defId]?.quantumActions ?? 0),
        0,
      ),
    [layout, libraryMap],
  );
  const qaPerHour = qaBasePerHour + qaRateFromBuildings;
  const statsWithConfig = applyConfigBoosts(baseStats);
  const stats = { ...statsWithConfig, qaPerHour, qaHoursPerHarvest };
  const happyInfo = happinessTier(
    stats.happinessProvided,
    stats.happinessRequired,
  );

  const harvestWithConfig = useCallback(
    (layoutSubset) => {
      const base = computeStats(layoutSubset, libraryMap);
      const happy = happinessTier(
        base.happinessProvided,
        base.happinessRequired,
      ).ratio;
      const coinBoost = (base.coinBoost ?? 0) + coinBoostCfg;
      const supplyBoost = (base.supplyBoost ?? 0) + supplyBoostCfg;
      const coins =
        Math.round(base.baseCoins * (1 + coinBoost + (happy - 1))) +
        base.flatCoins;
      const supplies =
        Math.round(base.baseSupplies * (1 + supplyBoost + (happy - 1))) +
        base.flatSupplies;
      return { coins, supplies };
    },
    [libraryMap, coinBoostCfg, supplyBoostCfg],
  );

  const openWorstModal = useCallback(() => {
    const activeLayout = layout.filter((b) => !buildLocks[b.id]);
    const housingDefs = Array.from(
      new Set(
        activeLayout
          .filter((b) => libraryMap[b.defId]?.category === "housing")
          .map((b) => b.defId),
      ),
    );
    const productionDefs = Array.from(
      new Set(
        activeLayout
          .filter((b) => libraryMap[b.defId]?.category === "production")
          .map((b) => b.defId),
      ),
    );

    const computeList = (defIds, harvestKey) => {
      return defIds
        .map((defId) => {
          const idx = activeLayout.findIndex((b) => b.defId === defId);
          if (idx === -1) return null;
          const removed = activeLayout.filter((_, i) => i !== idx);
          const h = harvestWithConfig(removed);
          const value = h[harvestKey] ?? 0;
          const def = libraryMap[defId];
          return {
            defId,
            short: def?.short || def?.name || defId,
            name: def?.name || defId,
            value,
          };
        })
        .filter(Boolean);
    };

    const housingList = computeList(housingDefs, "coins");
    const productionList = computeList(productionDefs, "supplies");

    setWorstModal({
      housing: housingList,
      production: productionList,
    });
  }, [layout, buildLocks, libraryMap, harvestWithConfig]);

  const openExportSaves = useCallback(() => {
    setExportModal(true);
  }, []);

  const openImportSaves = useCallback(() => {
    setImportModal(true);
  }, []);

  const handleExportSelected = useCallback(
    (names) => {
      if (!names?.length) {
        setExportModal(false);
        return;
      }

      const stripSignatures = (checkpoints = []) =>
        (checkpoints || []).map(({ signature, ...rest }) => rest);

      const payload = {
        version: 1,
        savedAt: new Date().toISOString(),
        saves: names
          .filter((n) => saves[n]?.snapshot)
          .map((name) => ({
            name,
            snapshot: saves[name].snapshot,
            checkpoints: stripSignatures(saves[name].checkpoints),
            meta: saves[name].meta ?? {},
          })),
      };
      const now = new Date();
      const pad = (n) => String(n).padStart(2, "0");
      const fileName = `QI_${pad(now.getMonth() + 1)}${pad(
        now.getDate(),
      )}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(
        now.getSeconds(),
      )}.json`;
      const blob = new Blob([JSON.stringify(payload, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);
      setExportModal(false);
    },
    [saves],
  );

  const handleImportSelected = useCallback(
    (entries) => {
      if (!entries?.length) {
        setImportModal(false);
        return;
      }
      setAllSaves((prev) => {
        const next = { ...(prev || {}) };
        entries.forEach((entry) => {
          if (entry.name && entry.snapshot) {
            next[entry.name] = {
              snapshot: entry.snapshot,
              checkpoints: entry.checkpoints ?? [],
              meta: entry.meta ?? {},
            };
          }
        });
        return next;
      });
      setImportModal(false);
    },
    [setAllSaves],
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
    selectedIds,
    libraryMap,
    allowNegativeShards,
  });

  // Collect production for a set of buildings and update readiness.
  const harvestBuildings = useCallback(
    (
      instances,
      label = "Harvest",
      skipPopup = false,
      skipHistory = false,
      options = {},
    ) => {
      if (!instances.length) return;
      const logStatus = options.logStatus ?? !skipHistory;

      const locks = options.buildLocksOverride ?? buildLocks;
      const useStats = options.statsOverride ?? stats;
      const lockedIds = [];
      const harvestable = [];
      const lockedCulture = [];
      instances.forEach((inst) => {
        if (locks[inst.id]) {
          const def = libraryMap[inst.defId];
          if (def?.category === "culture") {
            lockedCulture.push(inst);
          } else {
            lockedIds.push(inst.id);
          }
        } else {
          harvestable.push(inst);
        }
      });

      const total =
        harvestable.length > 0
          ? aggregateHarvest(harvestable, libraryMap, useStats, {
              qaHoursPerHarvest,
            })
          : { coins: 0, supplies: 0, chronos: 0, goods: {}, qa: 0 };

      const qaFromLockedCulture = lockedCulture.reduce(
        (acc, inst) =>
          acc +
          (libraryMap[inst.defId]?.quantumActions ?? 0) * qaHoursPerHarvest,
        0,
      );
      total.qa = (total.qa ?? 0) + qaFromLockedCulture;

      const extraQa = options.extraQa ?? 0;
      total.qa += extraQa;

      if (!infiniteResources) {
        setResources((prev) => ({
          ...prev,
          coins: prev.coins + (total.coins ?? 0),
          supplies: prev.supplies + (total.supplies ?? 0),
          chronos: prev.chronos + (total.chronos ?? 0),
          quantumActions: (prev.quantumActions ?? 0) + (total.qa ?? 0),
          goods: GOODS_TYPES.reduce(
            (acc, g) => ({
              ...acc,
              [g]: (prev.goods?.[g] ?? 0) + (total.goods?.[g] ?? 0),
            }),
            {},
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
      const unlockIds = [...lockedIds, ...lockedCulture.map((inst) => inst.id)];
      if (unlockIds.length) {
        setBuildLocks((prev) => {
          const next = { ...prev };
          unlockIds.forEach((id) => {
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
      if (!skipHistory) {
      }
      if (logStatus) {
        updateStatus(label);
      }
    },
    [
      buildSnapshot,
      libraryMap,
      stats,
      setResources,
      resources,
      infiniteResources,
      buildLocks,
      qaHoursPerHarvest,
      qaBasePerHour,
    ],
  );

  // Unlock region via goods or shards, with fast-buy fallback.
  const handleUnlockRegion = useCallback(
    (idx, method, goodKey) => {
      if (editingLocked) {
        updateStatus("Bearbeitung gesperrt. Bearbeitung aktivieren.");
        return;
      }
      const isInfinityCost = (value) =>
        value === "Infinity" ||
        value === Infinity ||
        value === Number.POSITIVE_INFINITY;
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
          allowNegativeShards,
        });
        setUnlockChoice(choice);
        setUnlockGoodSelect(null);
        return;
      }

      let didUnlock = false;

      if (method === "goods") {
        if (goodsUnlocks >= REGION_GOODS_COSTS.length) {
          updateStatus("Keine weiteren Gueter-Erweiterungen verfuegbar.");
          return;
        }
        if (
          !infiniteResources &&
          !canAffordSingleGood(
            effectiveResources.goods,
            goodKey,
            currentGoodsCost,
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
        const label = `Erweiterung gekauft für ${formatNumber(
          currentGoodsCost,
        )} Güter`;
        applyAdjustGoods(goodKey, -currentGoodsCost);
        setGoodsUnlocks((prev) =>
          Math.min(prev + 1, REGION_GOODS_COSTS.length - 1),
        );
        setUnlockedRegions((prev) =>
          prev.map((val, i) => (i === idx ? true : val)),
        );
        updateStatus(label);
        didUnlock = true;
      } else {
        if (isInfinityCost(currentShardCost)) {
          updateStatus("Keine weiteren Scherben-Erweiterungen verfuegbar.");
          return;
        }
        if (
          !infiniteResources &&
          !allowNegativeShards &&
          (effectiveResources.shards ?? 0) < currentShardCost
        ) {
          updateStatus("Need more shards to unlock.");
          return;
        }
        const label = `Erweiterung gekauft für ${formatNumber(
          currentShardCost,
        )} Scherben`;
        if (!infiniteResources) {
          setResources((prev) => ({
            ...prev,
            shards: prev.shards - currentShardCost,
          }));
        }
        setShardUnlocks((prev) => prev + 1);
        setUnlockedRegions((prev) =>
          prev.map((val, i) => (i === idx ? true : val)),
        );
        updateStatus(label);
        didUnlock = true;
      }
      setFastBuyTarget(null);
      setUnlockChoice(null);
      setUnlockGoodSelect(null);

      if (didUnlock) {
        requestAutoSnapshot();
      }
    },
    [
      applyAdjustGoods,
      buildSnapshot,
      currentGoodsCost,
      currentShardCost,
      layout,
      libraryMap,
      resources,
      effectiveResources,
      setResources,
      updateStatus,
      infiniteResources,
      requestAutoSnapshot,
      allowNegativeShards,
    ],
  );

  // Enable/disable region debug tools.
  const toggleDebugRegions = useCallback(() => {
    if (editingLocked && !isPast) {
      updateStatus("Bearbeitung gesperrt. Bearbeitung aktivieren.");
      return;
    }
    setDebugRegions((prev) => !prev);
  }, [editingLocked, updateStatus]);

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
    [layout, regionRect],
  );

  // Debug: unlock a region without cost.
  const handleDebugUnlockRegion = useCallback(
    (idx) => {
      if (editingLocked) {
        updateStatus("Bearbeitung gesperrt. Bearbeitung aktivieren.");
        return;
      }
      if (!debugRegions) return;
      const row = Math.floor(idx / REGION_COLS);
      const col = idx % REGION_COLS;
      if (REGION_MASK[row][col] === "N") return;
      if (unlockedRegions[idx]) return;
      if (!neighborUnlocked(idx)) return;

      setUnlockedRegions((prev) => {
        const next = [...prev];
        next[idx] = true;
        return next;
      });
      updateStatus("Admin: +1 Region");
      requestAutoSnapshot();
    },
    [
      debugRegions,
      unlockedRegions,
      neighborUnlocked,
      buildSnapshot,
      setUnlockedRegions,
      updateStatus,
      requestAutoSnapshot,
    ],
  );

  // Debug: relock a region if empty and not base.
  const handleDebugLockRegion = useCallback(
    (idx, isBase = false) => {
      if (editingLocked) {
        updateStatus("Bearbeitung gesperrt. Bearbeitung aktivieren.");
        return;
      }
      if (!debugRegions) return;
      if (isBase) return; // starting region must never be removable
      if (!unlockedRegions[idx]) return;

      if (hasAnyBuildingInRegion(idx)) {
        updateStatus("Kann Region nicht entfernen Gebäude stehen noch drauf.");
        return;
      }

      setUnlockedRegions((prev) => {
        const next = [...prev];
        next[idx] = false;
        return next;
      });
      updateStatus("Admin: -1 Region");
      requestAutoSnapshot();
    },
    [
      debugRegions,
      unlockedRegions,
      hasAnyBuildingInRegion,
      buildSnapshot,
      setUnlockedRegions,
      updateStatus,
      requestAutoSnapshot,
    ],
  );

  // Toggle move mode; starts/stops carrying interactions.
  const toggleMove = useCallback(() => {
    setMoveMode((prev) => {
      const next = !prev;
      if (next) {
        setSellMode(false);
        setRefundMode(false);
        setBoostMode(false);
        setSelectedBuildingId(null);
      }
      if (!next) {
        if (carried && moveSnapshot) {
          applySnapshot(moveSnapshot);
        }
        setCarried(null);
        setMoveSnapshot(null);
      }
      return next;
    });
  }, [applySnapshot, moveSnapshot, carried]);

  const resetMoveIfActive = useCallback(() => {
    if (moveMode && carried && moveSnapshot) {
      applySnapshot(moveSnapshot);
    }
    setCarried(null);
    setMoveSnapshot(null);
  }, [applySnapshot, moveMode, moveSnapshot, carried]);

  const toggleAutoSelectNew = useCallback(
    () => setAutoSelectNew((prev) => !prev),
    [],
  );

  // Toggle sell mode (coin return).
  const toggleSell = useCallback(() => {
    if (editingLocked) {
      updateStatus("Bearbeitung gesperrt. Bearbeitung aktivieren.");
      return;
    }
    resetMoveIfActive();
    setSellMode((prev) => {
      const next = !prev;
      if (next) {
        setMoveMode(false);
        setRefundMode(false);
        setBoostMode(false);
        setSelectedBuildingId(null);
      }
      return next;
    });
  });

  // Toggle refund mode (full cost return).
  const toggleRefund = useCallback(() => {
    if (editingLocked) {
      updateStatus("Bearbeitung gesperrt. Bearbeitung aktivieren.");
      return;
    }
    resetMoveIfActive();
    setRefundMode((prev) => {
      const next = !prev;
      if (next) {
        setMoveMode(false);
        setSellMode(false);
        setBoostMode(false);
        setSelectedBuildingId(null);
      }
      return next;
    });
  });

  const toggleBoost = useCallback(() => {
    if (editingLocked) {
      updateStatus("Bearbeitung gesperrt. Bearbeitung aktivieren.");
      return;
    }
    resetMoveIfActive();
    setBoostMode((prev) => {
      const next = !prev;
      if (next) {
        setMoveMode(false);
        setSellMode(false);
        setRefundMode(false);
        setSelectedBuildingId(null);
      }
      return next;
    });
  });

  const handleSelectBuilding = useCallback(
    (defId) => {
      if (!defId) return;
      setMoveMode(false);
      setSellMode(false);
      setRefundMode(false);
      setBoostMode(false);
      setSelectedBuildingId(defId);
    },
    [setBoostMode, setMoveMode, setRefundMode, setSellMode],
  );

  // Execute a goods purchase for a producer building.
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
      const label = `Goods gekauft: ${
        def.produces
      } ${amount} für ${formatNumber(cost.coins ?? 0)}/${formatNumber(
        cost.supplies ?? 0,
      )}`;
      applySpend(cost);
      applyAdjustGoods(def.produces, Number(amount));
      updateStatus(label);
    },
    [
      effectiveResources,
      resources,
      updateStatus,
      buildSnapshot,
      applySpend,
      applyAdjustGoods,
      infiniteResources,
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
      const label = `Units gekauft: ${
        def.produces
      } ${amount} für ${formatNumber(cost.coins ?? 0)}/${formatNumber(
        cost.supplies ?? 0,
      )}`;
      applySpend(cost);
      applyAdjustUnits(def.produces, Number(amount));
      updateStatus(label);
    },
    [
      effectiveResources,
      updateStatus,
      buildSnapshot,
      applySpend,
      applyAdjustUnits,
      infiniteResources,
    ],
  );

  // Handle fast-buy flow to unlock regions with lacking goods.
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
      requestAutoSnapshot();
    },
    [
      applyAdjustGoods,
      applySpend,
      buildSnapshot,
      effectiveResources,
      fastBuyModal,
      fastBuyTarget,
      resources,
      requestAutoSnapshot,
      updateStatus,
      infiniteResources,
      setUnlockChoice,
      setUnlockGoodSelect,
    ],
  );

  // Mark all productions as ready.
  const finishProductions = useCallback(() => {
    if (editingLocked) {
      updateStatus("Bearbeitung gesperrt. Bearbeitung aktivieren.");
      return;
    }
    trimFutureCheckpoints();
    setCheckpointIndex(null);
    setEditUnlocked(false);
    const label = "Beende alle Prod.";
    setNotes("");
    setReadyMap((prev) =>
      finishProductionsReadyMap(layout, libraryMap, prev, buildLocks),
    );
    if (!infiniteResources) {
      const baseQa = qaBasePerHour * qaHoursPerHarvest;
      if (baseQa > 0) {
        setResources((prev) => ({
          ...prev,
          quantumActions: (prev.quantumActions ?? 0) + baseQa,
        }));
      }
    }
    setTimeStep((prev) => Math.min(23, prev + 1));
    setBoostMode(false);
    updateStatus(label);
    setSelectedIds(new Set());
    setSelectedBuildingId(null);
    requestAutoSnapshot();
  }, [
    buildSnapshot,
    layout,
    libraryMap,
    buildLocks,
    infiniteResources,
    qaBasePerHour,
    qaHoursPerHarvest,
    setResources,
    setTimeStep,
    editingLocked,
    updateStatus,
    trimFutureCheckpoints,
    suppressNextCheckpoint,
    setSelectedIds,
    setSelectedBuildingId,
  ]);

  // Harvest either all ready buildings or everything.
  const harvestAll = useCallback(() => {
    if (editingLocked) {
      updateStatus("Bearbeitung gesperrt. Bearbeitung aktivieren.");
      return;
    }
    trimFutureCheckpoints();
    setCheckpointIndex(null);
    setEditUnlocked(false);
    branchFromPast();
    const readyOnes = layout.filter((b) => readyMap[b.id] === true);
    const isFullHarvest = readyOnes.length === 0;
    const label = isFullHarvest ? "Volle Ernte" : "Rest einsammeln";
    setNotes("");
    setBoostMode(false);

    const locksBefore = { ...buildLocks };
    const buildLocksAfter = { ...buildLocks };
    let unlockedAny = false;
    Object.keys(buildLocksAfter).forEach((key) => {
      if (buildLocksAfter[key]) {
        buildLocksAfter[key] = false;
        unlockedAny = true;
      }
    });
    if (unlockedAny) setBuildLocks(buildLocksAfter);

    const effectiveStats = applyConfigBoosts(computeStats(layout, libraryMap));
    const baseQa = qaBasePerHour * qaHoursPerHarvest;
    const extraQa = isFullHarvest ? baseQa : 0;
    const targets = isFullHarvest ? layout : readyOnes;
    harvestBuildings(targets, label, false, true, {
      statsOverride: effectiveStats,
      buildLocksOverride: locksBefore,
      extraQa,
      logStatus: false,
    });
    if (isFullHarvest) {
      setTimeStep((prev) => Math.min(23, prev + 1));
    }
    updateStatus(label);
    if (isFullHarvest) {
      setSelectedIds(new Set());
      setSelectedBuildingId(null);
    }
    requestAutoSnapshot();
  }, [
    layout,
    readyMap,
    harvestBuildings,
    buildLocks,
    setBuildLocks,
    applyConfigBoosts,
    computeStats,
    libraryMap,
    buildSnapshot,
    qaBasePerHour,
    qaHoursPerHarvest,
    setTimeStep,
    setCheckpointIndex,
    setEditUnlocked,
    editingLocked,
    updateStatus,
    trimFutureCheckpoints,
    branchFromPast,
    suppressNextCheckpoint,
    setSelectedIds,
    setSelectedBuildingId,
  ]);

  const runSmartHarvestSimulation = useCallback(
    (input = {}) => {
      const {
        layout: startLayout = layout,
        readyMap: startReadyMap = readyMap,
        buildLocks: startBuildLocks = buildLocks,
        resources: startResources = resources,
        nextId: startNextId = nextId.current,
        timeStep: startTimeStep = timeStep ?? 1,
        mask: maskOverride = null,
        logActions = false,
      } = input;

      const log = [];
      const addLog = logActions ? (msg) => log.push(msg) : () => {};

      const churchDef = libraryMap["culture:kirche"];
      if (!churchDef) {
        addLog("Abbruch: Kirche nicht gefunden.");
        return { ok: false, log, reason: "church_missing" };
      }

      let simLayout = startLayout.map((b) => ({ ...b }));
      let simReadyMap = { ...startReadyMap };
      let simBuildLocks = { ...startBuildLocks };
      let simResources = cloneResources(startResources);
      let simNextId = startNextId;
      let simTimeStep = startTimeStep;

      const baseQa = qaBasePerHour * qaHoursPerHarvest;
      simReadyMap = finishProductionsReadyMap(
        simLayout,
        libraryMap,
        simReadyMap,
        simBuildLocks,
      );
      if (!infiniteResources && baseQa > 0) {
        simResources.quantumActions =
          (simResources.quantumActions ?? 0) + baseQa;
      }
      simTimeStep = Math.min(23, simTimeStep + 1);

      const mask =
        maskOverride ??
        buildTilingMask(BOARD_WIDTH, BOARD_HEIGHT, isCellUnlocked);

      const computeUnlockedStats = () =>
        computeStatsWithLockedPeopleReq(simLayout, simBuildLocks);

      const computeHappyInfo = () => {
        const base = computeUnlockedStats();
        const happy = happinessTier(
          base.happinessProvided,
          base.happinessRequired,
        );
        const freePop = (base.people ?? 0) - (base.peopleReq ?? 0);
        return { base, happy, freePop };
      };

      const buildHarvestStats = (useLockedLayout = false) => {
        const base = useLockedLayout
          ? computeStats(simLayout, libraryMap)
          : computeUnlockedStats();
        return applyConfigBoosts(base);
      };

      const applyResourceDelta = (delta, sign = 1) => {
        if (infiniteResources) return;
        simResources.coins =
          (simResources.coins ?? 0) + sign * (delta.coins ?? 0);
        simResources.supplies =
          (simResources.supplies ?? 0) + sign * (delta.supplies ?? 0);
        simResources.chronos =
          (simResources.chronos ?? 0) + sign * (delta.chronos ?? 0);
      };

      const simulateHarvest = (
        instances,
        stats,
        options = { extraQa: 0, buildLocksOverride: null },
      ) => {
        if (!instances.length) return;
        const locks = options.buildLocksOverride ?? simBuildLocks;
        const lockedIds = [];
        const harvestable = [];
        const lockedCulture = [];
        instances.forEach((inst) => {
          if (locks[inst.id]) {
            const def = libraryMap[inst.defId];
            if (def?.category === "culture") {
              lockedCulture.push(inst);
            } else {
              lockedIds.push(inst.id);
            }
          } else {
            harvestable.push(inst);
          }
        });

        const total =
          harvestable.length > 0
            ? aggregateHarvest(harvestable, libraryMap, stats, {
                qaHoursPerHarvest,
              })
            : { coins: 0, supplies: 0, chronos: 0, goods: {}, qa: 0 };

        const qaFromLockedCulture = lockedCulture.reduce(
          (acc, inst) =>
            acc +
            (libraryMap[inst.defId]?.quantumActions ?? 0) * qaHoursPerHarvest,
          0,
        );
        total.qa =
          (total.qa ?? 0) + qaFromLockedCulture + (options.extraQa ?? 0);

        if (!infiniteResources) {
          simResources.coins = (simResources.coins ?? 0) + (total.coins ?? 0);
          simResources.supplies =
            (simResources.supplies ?? 0) + (total.supplies ?? 0);
          simResources.chronos =
            (simResources.chronos ?? 0) + (total.chronos ?? 0);
          simResources.quantumActions =
            (simResources.quantumActions ?? 0) + (total.qa ?? 0);
          simResources.goods = simResources.goods ?? {};
          GOODS_TYPES.forEach((g) => {
            simResources.goods[g] =
              (simResources.goods[g] ?? 0) + (total.goods?.[g] ?? 0);
          });
        }

        instances.forEach((inst) => {
          simReadyMap[inst.id] = false;
        });
        const unlockIds = [
          ...lockedIds,
          ...lockedCulture.map((inst) => inst.id),
        ];
        unlockIds.forEach((id) => {
          simBuildLocks[id] = false;
        });
      };

      const ensureFreePopulation = () => {
        const { freePop } = computeHappyInfo();
        return freePop >= 0;
      };

      if (!ensureFreePopulation()) {
        addLog("Abbruch: Freie Bevoelkerung unter 0.");
        return { ok: false, log, reason: "population" };
      }

      const multiHouseDefId = "housing:mehrgeschossiges_haus";
      const estateDefId = "housing:gutshaus";
      const targetRatio = 1.5;
      const maxSteps = 200;
      let ok = false;
      let failureReason = "";

      for (let step = 0; step < maxSteps; step += 1) {
        const { happy } = computeHappyInfo();
        if ((happy.ratio ?? 0) >= targetRatio) {
          ok = true;
          break;
        }

        let placedChurch = false;
        const canAffordChurch =
          infiniteResources || canAffordResources(simResources, churchDef.cost);
        if (canAffordChurch) {
          const { groups, blocks } = buildTilingGroups(simLayout, [
            { ...churchDef, count: 1 },
          ]);
          const placements = solveTilingMask(mask, blocks, { allowGaps: true });
          if (placements) {
            const applied = applyTilingSolution(placements, groups, simNextId);
            if (!applied) {
              failureReason = "Tiling konnte nicht uebertragen werden.";
              break;
            }
            simLayout = applied.layout;
            simNextId = applied.nextId;
            applied.created.forEach((created) => {
              simReadyMap[created.id] = false;
              simBuildLocks[created.id] = churchDef.buildTime === 10;
            });
            applyResourceDelta(churchDef.cost, -1);
            addLog("Setze Kirche");
            placedChurch = true;
            if (!ensureFreePopulation()) {
              failureReason = "Freie Bevoelkerung unter 0.";
              break;
            }
          }
        }

        if (placedChurch) continue;

        const target =
          simLayout.find((b) => b.defId === multiHouseDefId) ||
          simLayout.find((b) => b.defId === estateDefId);
        if (!target) {
          failureReason = "Keine passenden Wohngebaeude mehr.";
          break;
        }

        if (simReadyMap[target.id] === true) {
          const statsForHarvest = buildHarvestStats(false);
          simulateHarvest([target], statsForHarvest);
        }

        const refundDelta = computeSaleOrRefund(target, libraryMap, false);
        applyResourceDelta(refundDelta, 1);

        simLayout = simLayout.filter((b) => b.id !== target.id);
        delete simReadyMap[target.id];
        delete simBuildLocks[target.id];

        addLog(`Zerstoere ${libraryMap[target.defId]?.name ?? "Wohngebaeude"}`);

        if (!ensureFreePopulation()) {
          failureReason = "Freie Bevoelkerung unter 0.";
          break;
        }
      }

      if (!ok) {
        addLog(`Abbruch: ${failureReason || "Keine Loesung gefunden."}`);
        return { ok: false, log, reason: failureReason || "no_solution" };
      }

      addLog("150% erreicht -> Ernte Rest");
      const harvestTargets = simLayout.filter(
        (b) => simReadyMap[b.id] === true,
      );
      const finalHarvestStats = buildHarvestStats(true);
      simulateHarvest(harvestTargets, finalHarvestStats, { extraQa: baseQa });

      addLog(
        `Neuer Stand: ${formatNumber(simResources.coins ?? 0)} Muenzen, ${formatNumber(
          simResources.supplies ?? 0,
        )} Vorraete, ${formatNumber(simResources.chronos ?? 0)} Chronos`,
      );

      return {
        ok: true,
        log,
        layout: simLayout,
        readyMap: simReadyMap,
        buildLocks: simBuildLocks,
        resources: simResources,
        nextId: simNextId,
        timeStep: simTimeStep,
      };
    },
    [
      layout,
      readyMap,
      buildLocks,
      resources,
      timeStep,
      libraryMap,
      cloneResources,
      qaBasePerHour,
      qaHoursPerHarvest,
      infiniteResources,
      isCellUnlocked,
      applyConfigBoosts,
      computeStats,
      computeStatsWithLockedPeopleReq,
      buildTilingMask,
      BOARD_WIDTH,
      BOARD_HEIGHT,
      solveTilingMask,
      buildTilingGroups,
      applyTilingSolution,
      canAffordResources,
      computeSaleOrRefund,
      formatNumber,
      happinessTier,
      GOODS_TYPES,
      aggregateHarvest,
      finishProductionsReadyMap,
      nextId,
    ],
  );

  const handleSmartHarvest = useCallback(() => {
    if (editingLocked) {
      updateStatus("Bearbeitung gesperrt. Bearbeitung aktivieren.");
      return;
    }
    if (carried) {
      updateStatus("Bitte zuerst das getragene Gebaeude ablegen.");
      return;
    }

    const result = runSmartHarvestSimulation({ logActions: true });
    if (!result.ok) {
      setSmartHarvestModal({
        success: false,
        log: result.log,
        resources: {
          coins: resources.coins ?? 0,
          supplies: resources.supplies ?? 0,
          chronos: resources.chronos ?? 0,
          quantumActions: resources.quantumActions ?? 0,
        },
      });
      updateStatus("Schlaue Ernte abgebrochen.");
      return;
    }

    trimFutureCheckpoints();
    setCheckpointIndex(null);
    setEditUnlocked(false);
    branchFromPast();
    setLayout(result.layout);
    setResources(result.resources);
    setReadyMap(result.readyMap);
    setBuildLocks(result.buildLocks);
    setTimeStep(result.timeStep);
    nextId.current = result.nextId;
    setSmartHarvestModal({
      success: true,
      log: result.log,
      resources: {
        coins: result.resources.coins ?? 0,
        supplies: result.resources.supplies ?? 0,
        chronos: result.resources.chronos ?? 0,
        quantumActions: result.resources.quantumActions ?? 0,
      },
    });
    updateStatus("Schlaue Ernte");
    requestAutoSnapshot();
  }, [
    editingLocked,
    updateStatus,
    carried,
    resources,
    setCheckpointIndex,
    setEditUnlocked,
    trimFutureCheckpoints,
    branchFromPast,
    setSmartHarvestModal,
    runSmartHarvestSimulation,
    setResources,
    setLayout,
    setReadyMap,
    setBuildLocks,
    setTimeStep,
    requestAutoSnapshot,
  ]);

  const handleSmartInvest = useCallback(async () => {
    if (editingLocked) {
      updateStatus("Bearbeitung gesperrt. Bearbeitung aktivieren.");
      return;
    }
    if (carried) {
      updateStatus("Bitte zuerst das getragene Gebaeude ablegen.");
      return;
    }
    if (smartInvestRunningRef.current) {
      updateStatus("Schlauer Invest laeuft bereits.");
      return;
    }

    smartInvestRunningRef.current = true;
    setSmartInvestRunning(true);
    setSmartInvestModal({ phase: "running", churchCount: 0 });

    const churchDef = libraryMap["culture:kirche"];
    const gutDef = libraryMap["housing:gutshaus"];
    const mehrDef = libraryMap["housing:mehrgeschossiges_haus"];
    if (!churchDef || !gutDef || !mehrDef) {
      const missing = [];
      if (!churchDef) missing.push("Kirche");
      if (!gutDef) missing.push("Gutshaus");
      if (!mehrDef) missing.push("Mehrgeschossiges Haus");
      const error = `Abbruch: ${missing.join(", ")} nicht gefunden.`;
      setSmartInvestResults([]);
      setSmartInvestModal({ phase: "results", results: [], error });
      setSmartInvestRunning(false);
      smartInvestRunningRef.current = false;
      updateStatus("Schlauer Invest abgebrochen.");
      return;
    }

    const baseLayout = layout.map((b) => ({ ...b }));
    const baseResources = cloneResources(resources);
    const baseReadyMap = { ...readyMap };
    const baseBuildLocks = { ...buildLocks };

    const mask = buildTilingMask(BOARD_WIDTH, BOARD_HEIGHT, isCellUnlocked);
    const availableCells = mask.reduce(
      (acc, row) => acc + row.filter(Boolean).length,
      0,
    );
    const existingArea = baseLayout.reduce(
      (acc, b) => acc + (b.width ?? 0) * (b.height ?? 0),
      0,
    );
    const extraCells = availableCells - existingArea;
    if (extraCells < 0) {
      const error = "Abbruch: Layout passt nicht in die freigegebene Flaeche.";
      setSmartInvestResults([]);
      setSmartInvestModal({ phase: "results", results: [], error });
      setSmartInvestRunning(false);
      smartInvestRunningRef.current = false;
      updateStatus("Schlauer Invest abgebrochen.");
      return;
    }

    const sleep = () => new Promise((resolve) => setTimeout(resolve, 0));
    const waitForContinue = () =>
      new Promise((resolve) => {
        smartInvestStepResolveRef.current = resolve;
      });

    const sumCost = (cost, count) => ({
      coins: (cost?.coins ?? 0) * count,
      supplies: (cost?.supplies ?? 0) * count,
      chronos: (cost?.chronos ?? 0) * count,
    });

    const addCost = (a, b) => ({
      coins: (a?.coins ?? 0) + (b?.coins ?? 0),
      supplies: (a?.supplies ?? 0) + (b?.supplies ?? 0),
      chronos: (a?.chronos ?? 0) + (b?.chronos ?? 0),
    });

    const subtractResources = (base, cost) => {
      const next = cloneResources(base);
      next.coins = (next.coins ?? 0) - (cost?.coins ?? 0);
      next.supplies = (next.supplies ?? 0) - (cost?.supplies ?? 0);
      next.chronos = (next.chronos ?? 0) - (cost?.chronos ?? 0);
      return next;
    };

    const maxCountForCost = (res, cost) => {
      const limits = ["coins", "supplies", "chronos"].map((key) => {
        const unit = cost?.[key] ?? 0;
        if (!unit) return Infinity;
        const have = res?.[key] ?? 0;
        return Math.floor(have / unit);
      });
      return Math.max(0, Math.min(...limits));
    };

    const canAffordTotal = (res, cost) =>
      infiniteResources || canAffordResources(res, cost);

    const churchArea = (churchDef.width ?? 0) * (churchDef.height ?? 0);
    const gutArea = (gutDef.width ?? 0) * (gutDef.height ?? 0);
    const mehrArea = (mehrDef.width ?? 0) * (mehrDef.height ?? 0);

    const maxChurchByArea = churchArea
      ? Math.floor(extraCells / churchArea)
      : 0;
    const maxChurchByBudget = infiniteResources
      ? maxChurchByArea
      : maxCountForCost(baseResources, churchDef.cost);
    const maxChurch = Math.max(0, Math.min(maxChurchByArea, maxChurchByBudget));

    const buildCandidateLayout = (churchCount, gutCount, mehrCount) => {
      const extras = [];
      if (churchCount > 0) {
        extras.push({ ...churchDef, count: churchCount });
      }
      if (gutCount > 0) {
        extras.push({ ...gutDef, count: gutCount });
      }
      if (mehrCount > 0) {
        extras.push({ ...mehrDef, count: mehrCount });
      }
      const { groups, blocks } = buildTilingGroups(baseLayout, extras);
      const placements = solveTilingMask(mask, blocks, { allowGaps: true });
      if (!placements) return null;
      return applyTilingSolution(placements, groups, nextId.current);
    };

    const countDefs = (candidateLayout) =>
      candidateLayout.reduce(
        (acc, b) => {
          if (b.defId === churchDef.defId) acc.church += 1;
          if (b.defId === gutDef.defId) acc.gut += 1;
          if (b.defId === mehrDef.defId) acc.mehr += 1;
          return acc;
        },
        { church: 0, gut: 0, mehr: 0 },
      );

    const insertTopResult = (list, result) => {
      const next = [...list, result].sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        const as = a.resources?.supplies ?? 0;
        const bs = b.resources?.supplies ?? 0;
        if (bs !== as) return bs - as;
        const ac = a.resources?.chronos ?? 0;
        const bc = b.resources?.chronos ?? 0;
        return bc - ac;
      });
      return next.slice(0, 3);
    };

    const results = [];
    let bestOverall = -Infinity;
    let outerMisses = 0;
    let resultId = 1;

    for (let churchCount = 0; churchCount <= maxChurch; churchCount += 1) {
      setSmartInvestModal({ phase: "running", churchCount, gutCount: 0 });
      await sleep();

      const costChurches = sumCost(churchDef.cost, churchCount);
      if (!canAffordTotal(baseResources, costChurches)) break;
      const areaChurches = churchCount * churchArea;
      if (areaChurches > extraCells) break;

      const remainingAfterChurch = subtractResources(
        baseResources,
        costChurches,
      );
      const maxGutshausByArea = gutArea
        ? Math.floor((extraCells - areaChurches) / gutArea)
        : 0;
      const maxGutshausByBudget = infiniteResources
        ? maxGutshausByArea
        : maxCountForCost(remainingAfterChurch, gutDef.cost);
      const maxGutshaus = Math.max(
        0,
        Math.min(maxGutshausByArea, maxGutshausByBudget),
      );

      let bestInner = -Infinity;
      let improvedOverall = false;
      let foundAny = false;

      for (let gutCount = 0; gutCount <= maxGutshaus; gutCount += 1) {
        setSmartInvestModal({ phase: "running", churchCount, gutCount });
        await sleep();
        const costGut = sumCost(gutDef.cost, gutCount);
        const baseCost = addCost(costChurches, costGut);
        if (!canAffordTotal(baseResources, baseCost)) break;
        const areaUsed = areaChurches + gutCount * gutArea;
        if (areaUsed > extraCells) break;

        const remainingAfterBase = subtractResources(baseResources, baseCost);
        const maxMehrByArea = mehrArea
          ? Math.floor((extraCells - areaUsed) / mehrArea)
          : 0;
        const maxMehrByBudget = infiniteResources
          ? maxMehrByArea
          : maxCountForCost(remainingAfterBase, mehrDef.cost);
        let maxMehr = Math.max(0, Math.min(maxMehrByArea, maxMehrByBudget));

        let candidate = null;
        for (let mehrCount = maxMehr; mehrCount >= 0; mehrCount -= 1) {
          const totalCost = addCost(baseCost, sumCost(mehrDef.cost, mehrCount));
          if (!canAffordTotal(baseResources, totalCost)) continue;
          const resourcesAfterPurchase = subtractResources(
            baseResources,
            totalCost,
          );

          const applied = buildCandidateLayout(
            churchCount,
            gutCount,
            mehrCount,
          );
          if (!applied) continue;

          const nextReadyMap = { ...baseReadyMap };
          const nextBuildLocks = { ...baseBuildLocks };
          applied.created.forEach((created) => {
            nextReadyMap[created.id] = false;
            nextBuildLocks[created.id] =
              libraryMap[created.defId]?.buildTime === 10;
          });

          const simResult = runSmartHarvestSimulation({
            layout: applied.layout,
            readyMap: nextReadyMap,
            buildLocks: nextBuildLocks,
            resources: resourcesAfterPurchase,
            nextId: applied.nextId,
            timeStep: timeStep ?? 1,
            mask,
            logActions: false,
          });

          if (!simResult.ok) continue;

          candidate = {
            id: `invest-${resultId++}`,
            score: simResult.resources.coins ?? 0,
            resources: simResult.resources,
            layout: simResult.layout,
            readyMap: simResult.readyMap,
            buildLocks: simResult.buildLocks,
            timeStep: simResult.timeStep,
            nextId: simResult.nextId,
            counts: countDefs(simResult.layout),
          };
          break;
        }

        if (!candidate) {
          continue;
        }

        foundAny = true;
        if (candidate.score > bestInner) {
          bestInner = candidate.score;
        } else {
          break;
        }

        if (candidate.score > bestOverall) {
          bestOverall = candidate.score;
          improvedOverall = true;
        }

        results.splice(
          0,
          results.length,
          ...insertTopResult(results, candidate),
        );

        setSmartInvestModal({
          phase: "step",
          churchCount,
          gutCount,
          lastResult: candidate,
          bestResult: results[0] ?? null,
        });
        await waitForContinue();
      }

      if (!foundAny) {
        outerMisses += 1;
      } else if (improvedOverall) {
        outerMisses = 0;
      } else {
        outerMisses += 1;
      }

      if (outerMisses >= 4) break;
    }

    const error =
      results.length === 0
        ? "Keine Ergebnisse fuer das aktuelle Budget gefunden."
        : null;

    setSmartInvestResults(results);
    setSmartInvestModal({ phase: "results", results, error });
    setSmartInvestRunning(false);
    smartInvestRunningRef.current = false;
    updateStatus("Schlauer Invest abgeschlossen.");
  }, [
    editingLocked,
    updateStatus,
    carried,
    libraryMap,
    buildTilingMask,
    BOARD_WIDTH,
    BOARD_HEIGHT,
    isCellUnlocked,
    layout,
    resources,
    cloneResources,
    infiniteResources,
    canAffordResources,
    buildTilingGroups,
    solveTilingMask,
    applyTilingSolution,
    readyMap,
    buildLocks,
    runSmartHarvestSimulation,
    timeStep,
  ]);

  const openSmartInvestResults = useCallback(() => {
    if (!smartInvestResults) return;
    setSmartInvestModal({ phase: "results", results: smartInvestResults });
  }, [smartInvestResults]);

  const continueSmartInvest = useCallback(() => {
    const resolver = smartInvestStepResolveRef.current;
    if (resolver) {
      smartInvestStepResolveRef.current = null;
      resolver();
    }
  }, []);

  const closeSmartInvestModal = useCallback(() => {
    setSmartInvestModal(null);
  }, []);

  const applySmartInvestResult = useCallback(
    (result) => {
      if (!result) return;
      if (editingLocked) {
        updateStatus("Bearbeitung gesperrt. Bearbeitung aktivieren.");
        return;
      }
      if (carried) {
        updateStatus("Bitte zuerst das getragene Gebaeude ablegen.");
        return;
      }
      trimFutureCheckpoints();
      setCheckpointIndex(null);
      setEditUnlocked(false);
      branchFromPast();
      setLayout(result.layout);
      setResources(result.resources);
      setReadyMap(result.readyMap);
      setBuildLocks(result.buildLocks);
      setTimeStep(result.timeStep);
      nextId.current = result.nextId;
      setSelectedIds(new Set());
      setSelectedBuildingId(null);
      setSmartInvestModal(null);
      updateStatus("Schlauer Invest angewendet.");
      requestAutoSnapshot();
    },
    [
      editingLocked,
      updateStatus,
      carried,
      trimFutureCheckpoints,
      setCheckpointIndex,
      setEditUnlocked,
      branchFromPast,
      setLayout,
      setResources,
      setReadyMap,
      setBuildLocks,
      setTimeStep,
      requestAutoSnapshot,
      setSelectedIds,
      setSelectedBuildingId,
    ],
  );

  // Full-harvest helper for PDF export: always applies a full harvest cycle,
  // without opening modals or writing history/status.
  // IMPORTANT: During PDF export we may call this immediately after applying a snapshot.
  // In that case, React state may not have re-rendered yet, so relying on the closure-captured
  // `layout`/`buildLocks` can produce a harvest based on the *previous* (often base) layout.
  //
  // To keep export deterministic and fast, allow passing explicit overrides.
  const harvestFullForPdf = useCallback(
    (layoutOverride = null, buildLocksOverride = null) => {
      // NOTE: During PDF export we already pause checkpoint tracking in App.jsx.
      // We keep this function side-effect minimal (no notes/status changes).
      const effectiveLayout = Array.isArray(layoutOverride)
        ? layoutOverride
        : layout;
      const locksBefore = {
        ...(buildLocksOverride && typeof buildLocksOverride === "object"
          ? buildLocksOverride
          : buildLocks),
      };

      const effectiveStats = applyConfigBoosts(
        computeStats(effectiveLayout, libraryMap),
      );
      const baseQa = qaBasePerHour * qaHoursPerHarvest;

      harvestBuildings(effectiveLayout, "Volle Ernte", true, true, {
        statsOverride: effectiveStats,
        buildLocksOverride: locksBefore,
        extraQa: baseQa,
        logStatus: false,
      });
    },
    [
      buildLocks,
      applyConfigBoosts,
      computeStats,
      harvestBuildings,
      layout,
      libraryMap,
      qaBasePerHour,
      qaHoursPerHarvest,
    ],
  );

  // Close harvest modal after acknowledgment.
  const confirmHarvest = useCallback(() => {
    setHarvestModal(null);
  }, []);

  // Close harvest modal without extra action.
  const cancelHarvest = useCallback(() => {
    setHarvestModal(null);
  }, []);

  const confirmSmartHarvest = useCallback(() => {
    setSmartHarvestModal(null);
  }, []);

  // Update freeform notes tied to the current city state.
  const handleChangeNotes = useCallback(
    (val) => {
      setNotes(val ?? "");
      updateStatus("Notizen geaendert");
    },
    [updateStatus],
  );

  const applyStartBonusToCheckpoints = useCallback(
    (coinsDelta, suppliesDelta) => {
      if (editingLocked) {
        updateStatus("Bearbeitung gesperrt. Bearbeitung aktivieren.");
        return;
      }
      const coins = Number(coinsDelta ?? 0) || 0;
      const supplies = Number(suppliesDelta ?? 0) || 0;
      updateCheckpoints((prev) =>
        (prev || []).map((cp) => {
          const snapshot = cp.snapshot ?? {};
          const resourcesSnapshot = snapshot.resources ?? {};
          return {
            ...cp,
            snapshot: {
              ...snapshot,
              resources: {
                ...resourcesSnapshot,
                coins: (resourcesSnapshot.coins ?? 0) + coins,
                supplies: (resourcesSnapshot.supplies ?? 0) + supplies,
                goods: { ...(resourcesSnapshot.goods ?? {}) },
                units: { ...(resourcesSnapshot.units ?? {}) },
              },
            },
          };
        }),
      );
      setResources((prev) => ({
        ...prev,
        coins: (prev.coins ?? 0) + coins,
        supplies: (prev.supplies ?? 0) + supplies,
      }));
      updateStatus("Fügte Startboni auf alle Checkpoints hinzu");
      requestAutoSnapshot({ waitForCheckpoint: false });
    },
    [
      editingLocked,
      requestAutoSnapshot,
      setResources,
      updateCheckpoints,
      updateStatus,
    ],
  );

  // Persist note edits when viewing past checkpoints after state flushes.
  useEffect(() => {
    if (!isPast) return;
    const timer = setTimeout(() => {
      overwriteCheckpointAtIndex(buildSnapshot());
    }, 0);
    return () => clearTimeout(timer);
  }, [notes, isPast, overwriteCheckpointAtIndex, buildSnapshot]);

  useEffect(() => {
    if (!pendingAutoSnapshot) return;
    if (carried) return; // move/swap not completed yet

    if (pendingAutoSnapshot.waitForCheckpoint) {
      const currentTailUid = checkpoints[checkpoints.length - 1]?.uid ?? null;
      if (currentTailUid === pendingAutoSnapshot.tailUid) return; // wait for checkpoint update
    }

    setPendingAutoSnapshot(null);
    handleTakeSnapshot();
  }, [pendingAutoSnapshot, carried, checkpoints, handleTakeSnapshot]);

  // Selection helpers.
  const toggleSelectId = useCallback(
    (id) => {
      if (editingLocked) {
        updateStatus("Bearbeitung gesperrt. Bearbeitung aktivieren.");
        return;
      }
      if (!id) return;
      setSelectedIds((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });
      requestAutoSnapshot();
    },
    [editingLocked, updateStatus, requestAutoSnapshot],
  );

  const clearSelection = useCallback(() => {
    if (editingLocked) {
      updateStatus("Bearbeitung gesperrt. Bearbeitung aktivieren.");
      return;
    }
    setSelectedIds(new Set());
  }, [editingLocked, updateStatus]);

  // Core board click handler covering placement, moving, selling, harvesting, and goods modal.
  const handleCellClick = useCallback(
    (x, y) => {
      const target = findTargetInstance(layout, x, y);
      if (carried) {
        const dropResult = dropCarried({
          carried,
          x,
          y,
          layout,
          libraryMap,
          isCellUnlocked,
          setLayout,
          setCarried,
          setReadyMap,
          setBuildLocks,
          buildLocks,
          setMoveMode,
          updateStatus,
        });
        if (dropResult?.ok && dropResult?.done) {
          requestAutoSnapshot();
        }
        return;
      }

      if ((sellMode || refundMode) && target) {
        if (libraryMap[target.defId]?.category === "townhall") {
          updateStatus("Rathaus kann nicht verkauft werden.");
          return;
        }
        branchFromPast();
        const delta = computeSaleOrRefund(target, libraryMap, refundMode);
        if (readyMap[target.id] === true) {
          harvestBuildings([target], "Harvest", true, true);
        }
        const label = `${refundMode ? "Rueckerstattung:" : "Verkauft:"} ${
          libraryMap[target.defId].name
        }`;
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
        updateStatus(label);
        if (isPast) {
          setTimeout(() => {
            overwriteCheckpointAtIndex(buildSnapshot());
          }, 0);
        }
        requestAutoSnapshot();
        return;
      }

      if (boostMode && target) {
        const def = libraryMap[target.defId];
        const boostCostForDef = (value) => {
          const buildTime = Number(value?.buildTime ?? 0);
          if (buildTime === 1) return 75;
          if (buildTime === 10) return 95;
          return 50;
        };
        const canSpendShards = (cost) =>
          infiniteResources ||
          cost <= 0 ||
          allowNegativeShards ||
          (resources.shards ?? 0) >= cost;
        const spendShards = (cost) => {
          if (infiniteResources || cost <= 0) return;
          setResources((prev) => ({
            ...prev,
            shards: (prev.shards ?? 0) - cost,
          }));
        };
        if (buildLocks[target.id]) {
          const cost = 50;
          if (!canSpendShards(cost)) {
            updateStatus("Need more shards.");
            return;
          }
          spendShards(cost);
          if (def?.category === "culture") {
            harvestBuildings([target], "Harvest", true);
            updateStatus(`Unlocked ${def.name}`);
          } else {
            setBuildLocks((prev) => ({ ...prev, [target.id]: false }));
            updateStatus(`Unlocked ${def.name}`);
          }
        } else if (readyMap[target.id] === true) {
          harvestBuildings([target], "Harvest", true);
        } else {
          const cost = boostCostForDef(def);
          if (!canSpendShards(cost)) {
            updateStatus("Need more shards.");
            return;
          }
          spendShards(cost);
          setReadyMap((prev) => ({ ...prev, [target.id]: true }));
          updateStatus(`Boosted ${def.name}`);
        }
        requestAutoSnapshot();
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
            isCellUnlocked,
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
        branchFromPast();
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
        if (autoSelectNew) {
          setSelectedIds((prev) => new Set([...(prev ?? []), instance.id]));
        }
        const label = `Gekauft: ${selectedDef.name}`;
        updateStatus(label);
        if (isPast) {
          setTimeout(() => {
            overwriteCheckpointAtIndex(buildSnapshot());
          }, 0);
        }
        requestAutoSnapshot();
        return;
      }

      if (moveMode && target) {
        suppressNextCheckpoint();
        const snap = buildSnapshot();
        setMoveSnapshot(snap);
        setLayout((prev) => prev.filter((p) => p.id !== target.id));
        setCarried({
          instance: {
            ...target,
            ready: readyMap[target.id],
            locked: buildLocks[target.id],
          },
          def: libraryMap[target.defId],
        });
        if (isPast) {
          setTimeout(() => {
            overwriteCheckpointAtIndex(buildSnapshot());
          }, 0);
        }
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
        harvestBuildings([target], "Geerntet", true);
        requestAutoSnapshot();
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
      setCarried,
      setLayout,
      setMoveMode,
      setReadyMap,
      refundMode,
      refundResources,
      selectedDef,
      stats,
      resources,
      allowNegativeShards,
      setResources,
      effectiveResources,
      applySpend,
      moveMode,
      sellMode,
      readyMap,
      harvestBuildings,
      setGoodsModal,
      updateStatus,
      infiniteResources,
      buildLocks,
      findTargetInstance,
      autoSelectNew,
      handleTakeSnapshot,
    ],
  );

  const previewDef = carried?.def ?? selectedDef;
  const previewOrigin = useMemo(
    () => buildPreviewOrigin(hoverCell, previewDef, categoryColors),
    [hoverCell, previewDef, categoryColors],
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
    rotatedWidthPx,
    rotatedHeightPx,
  } = computeViewTransforms(viewMode, viewWidth, viewHeight, boardScale);

  return {
    resources,
    layout,
    selectedIds,
    libraryMap,
    categories,
    categoryColors,
    selectedCategory,
    setSelectedCategory,
    selectedBuildingId,
    setSelectedBuildingId,
    autoSelectNew,
    setAutoSelectNew,
    unlockedRegions,
    goodsUnlocks,
    shardUnlocks,
    setGoodsUnlocks: handleSetGoodsUnlocks,
    setShardUnlocks: handleSetShardUnlocks,
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
    hoverCell,
    setHoverCell,
    moveMode,
    sellMode,
    refundMode,
    boostMode,
    saves,
    visibleSaves,
    snapshots,
    loadName,
    setLoadName,
    harvestModal,
    smartHarvestModal,
    smartInvestModal,
    smartInvestResults,
    smartInvestRunning,
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
    rotatedWidthPx,
    rotatedHeightPx,
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
    handleCellClick,
    handleUnlockRegion,
    handleDebugUnlockRegion,
    handleDebugLockRegion,
    toggleMove,
    toggleSell,
    toggleRefund,
    toggleBoost,
    toggleSelectId,
    clearSelection,
    handleSelectBuilding,
    finishProductions,
    harvestAll,
    handleSmartHarvest,
    handleSmartInvest,
    openSmartInvestResults,
    continueSmartInvest,
    closeSmartInvestModal,
    applySmartInvestResult,
    harvestFullForPdf,
    confirmHarvest,
    cancelHarvest,
    confirmSmartHarvest,
    handleSaveState,
    handleTakeSnapshot,
    handleLoadState,
    deleteSave,
    worstModal,
    openWorstModal,
    setWorstModal,
    exportModal,
    importModal,
    setExportModal,
    setImportModal,
    openExportSaves,
    openImportSaves,
    handleExportSelected,
    handleImportSelected,
    checkpoints,
    setCheckpointIndex,
    timeStep,
    setTimeStep,
    checkpointIndex,
    addCheckpointPart: handleAddCheckpointPart,
    currentPart,
    currentPartTotal,
    editUnlocked,
    setEditUnlocked,
    isPast,
    editingLocked,
    canTimeBack,
    canTimeForward,
    jumpBackTime,
    jumpForwardTime,
    enableEditFromPast,
    pastEditModal,
    openPastEditModal,
    closePastEditModal,
    handleCopyAndEnableEdit,
    handleEnableEditFromPast,
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
    handleEditUnit,
    buildSnapshot,
    applySnapshot,
    pauseCheckpointTracking,
    resumeCheckpointTracking,
    isCellUnlocked,
    autoSelectNew,
    toggleAutoSelectNew,
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
    applyStartBonusToCheckpoints,
    applyGoodEdit,
    cancelEditGood,
    editResourceModal,
    setEditResourceModal,
    applyResourceEdit,
    cancelEditResource,
    editUnitModal,
    setEditUnitModal,
    applyUnitEdit,
    cancelEditUnit,
    selectedSnapshotName,
    setSelectedSnapshotName,
  };
};
