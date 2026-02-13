import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import {
  BOARD_HEIGHT,
  BOARD_WIDTH,
  GOODS_TYPES,
  BOARD_SCALE_DEFAULT,
  BOARD_SCALE_MIN,
  BOARD_SCALE_MAX,
} from "../../config/boardConfig";
import { buildInitialGameState, buildLibrary } from "../../config/initialState";
import { useResources } from "../useResources";
import { useConfig } from "../useConfig";
import { isAreaFree } from "../../utils/layoutUtils";
import { isCellUnlocked as regionIsCellUnlocked } from "../../domain/regions/regionController";
import { isTierLocked } from "../../config/buildingTiers";
import { TOWNHALL_START_POSITION } from "../../config/gameDefaults";

const VIEW_MODE_STORAGE_KEY = "qi_viewMode";
const BOARD_SCALE_STORAGE_KEY = "qi_boardScale";
const INFINITE_STORAGE_KEY = "qi_infiniteResources";
const SHORTNAME_STORAGE_KEY = "qi_useShortNames";
const SHOP_TAB_STORAGE_KEY = "qi_shopTab";
const TOOLBAR_POSITION_STORAGE_KEY = "qi_toolbarPosition";

// Builds the core state tree and persists UI preferences.
export const useGameState = () => {
  const {
    library,
    libraryMap,
    shortIdMap,
    categories,
    categoryColors,
    townhallDef,
  } = useMemo(() => buildLibrary(), []);
  const allowedCategoryKeys = useMemo(
    () => new Set([...categories.map((cat) => cat.key), "favorites"]),
    [categories],
  );
  const { config: userConfig, updateConfig, replaceConfig } = useConfig();
  
  // Active save config - applied when a savefile with config is loaded
  const [activeSaveConfig, setActiveSaveConfig] = useState(null);
  
  // Effective config: merge userConfig with activeSaveConfig (save takes precedence for resource fields)
  const config = useMemo(() => {
    if (!activeSaveConfig) return userConfig;
    // Merge: save config overrides user config for resource-related fields
    return {
      ...userConfig,
      extraCoins: activeSaveConfig.extraCoins ?? userConfig.extraCoins,
      extraSupplies: activeSaveConfig.extraSupplies ?? userConfig.extraSupplies,
      goodsStartBonus: activeSaveConfig.goodsStartBonus ?? userConfig.goodsStartBonus,
      troopsStartBonus: activeSaveConfig.troopsStartBonus ?? userConfig.troopsStartBonus,
      coinBoost: activeSaveConfig.coinBoost ?? userConfig.coinBoost,
      supplyBoost: activeSaveConfig.supplyBoost ?? userConfig.supplyBoost,
    };
  }, [userConfig, activeSaveConfig]);
  
  const allowNegativeShards = !!config?.allowNegativeShards;

  const initialState = useMemo(
    () => buildInitialGameState({ libraryMap, townhallDef }),
    [libraryMap, townhallDef],
  );

  const nextIdRef = useRef(2);
  const smartInvestRunningRef = useRef(false);
  const smartInvestStepResolveRef = useRef(null);

  const computeStartResources = useCallback(
    (cfg) => {
      const base = initialState.resources;
      // Divide by 5 and floor - e.g. 50 -> +10 per good, 51 -> +10 per good
      const goodsStart = Math.floor(Number(cfg?.goodsStartBonus ?? 0) / 5);
      // Divide by 5 and floor - adds to Katapult only (other 80% of units not tracked)
      const troopsStart = Math.floor(Number(cfg?.troopsStartBonus ?? 0) / 5);
      const shardsStart = Number(cfg?.shardsStart ?? base.shards ?? 0);
      return {
        ...base,
        coins: (base.coins ?? 0) + (cfg?.extraCoins ?? 0),
        supplies: (base.supplies ?? 0) + (cfg?.extraSupplies ?? 0),
        shards: shardsStart,
        goods: GOODS_TYPES.reduce(
          (acc, g) => ({ ...acc, [g]: (base.goods[g] ?? 0) + goodsStart }),
          {},
        ),
        units: {
          ...(base.units ?? {}),
          Katapult: ((base.units?.Katapult) ?? 0) + troopsStart,
        },
      };
    },
    [initialState.resources],
  );

  const configStartResources = useMemo(
    () => computeStartResources(config),
    [computeStartResources, config],
  );

  const adjustedInitialResources = configStartResources;

  const {
    resources,
    setResources,
    spendResources,
    refundResources,
    adjustGoods,
    adjustUnits,
  } = useResources(adjustedInitialResources);

  const configStartRef = useRef(configStartResources);
  const [configRevision, setConfigRevision] = useState(0);
  const hasMountedRef = useRef(false);

  useEffect(() => {
    const nextStart = computeStartResources(config);
    const prevStart = configStartRef.current;
    configStartRef.current = nextStart;
    if (!hasMountedRef.current) {
      hasMountedRef.current = true;
      return;
    }
    if (!prevStart) {
      setConfigRevision((prev) => prev + 1);
      return;
    }
    const coinDelta = (nextStart.coins ?? 0) - (prevStart.coins ?? 0);
    const supplyDelta =
      (nextStart.supplies ?? 0) - (prevStart.supplies ?? 0);
    const shardDelta = (nextStart.shards ?? 0) - (prevStart.shards ?? 0);
    const goodsDelta = GOODS_TYPES.reduce((acc, good) => {
      const diff =
        (nextStart.goods?.[good] ?? 0) - (prevStart.goods?.[good] ?? 0);
      if (diff) acc[good] = diff;
      return acc;
    }, {});
    const hasDelta =
      coinDelta !== 0 ||
      supplyDelta !== 0 ||
      shardDelta !== 0 ||
      Object.keys(goodsDelta).length > 0;
    if (hasDelta) {
      setResources((prev) => {
        const nextGoods = { ...(prev.goods ?? {}) };
        Object.entries(goodsDelta).forEach(([good, diff]) => {
          nextGoods[good] = (nextGoods[good] ?? 0) + diff;
        });
        return {
          ...prev,
          coins: (prev.coins ?? 0) + coinDelta,
          supplies: (prev.supplies ?? 0) + supplyDelta,
          shards: (prev.shards ?? 0) + shardDelta,
          goods: nextGoods,
        };
      });
    }
    setConfigRevision((prev) => prev + 1);
  }, [config, computeStartResources, setResources]);

  const [layout, setLayout] = useState(initialState.layout);
  const [unlockedRegions, setUnlockedRegions] = useState(
    initialState.unlockedRegions,
  );
  const [goodsUnlocks, setGoodsUnlocks] = useState(initialState.goodsUnlocks);
  const [shardUnlocks, setShardUnlocks] = useState(initialState.shardUnlocks);
  const [selectedCategory, setSelectedCategory] = useState(() => {
    if (typeof window === "undefined") return initialState.selectedCategory;
    try {
      const saved = localStorage.getItem(SHOP_TAB_STORAGE_KEY);
      if (saved && allowedCategoryKeys.has(saved)) return saved;
    } catch {
      // ignore localStorage errors
    }
    return initialState.selectedCategory;
  });
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
    } catch {
      // ignore localStorage errors
    }
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
  const [editGoodModal, setEditGoodModal] = useState(initialState.editGoodModal);
  const [editUnitModal, setEditUnitModal] = useState(null);
  const [autoSelectNew, setAutoSelectNew] = useState(false);
  const [worstModal, setWorstModal] = useState(null);
  const [exportModal, setExportModal] = useState(false);
  const [importModal, setImportModal] = useState(false);
  const [loadSavesModal, setLoadSavesModal] = useState(false);
  const [pastEditModal, setPastEditModal] = useState(false);
  const [timeStep, setTimeStep] = useState(initialState.timeStep ?? 1);
  const [loadName, setLoadName] = useState("");
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
  const [boardScale, setBoardScale] = useState(() => {
    if (typeof window === "undefined") return BOARD_SCALE_DEFAULT;
    const raw = parseFloat(localStorage.getItem(BOARD_SCALE_STORAGE_KEY));
    if (!Number.isNaN(raw) && raw >= BOARD_SCALE_MIN && raw <= BOARD_SCALE_MAX) {
      return raw;
    }
    return BOARD_SCALE_DEFAULT;
  });
  const [status, setStatus] = useState(initialState.status);
  const [readyMap, setReadyMap] = useState(initialState.readyMap);
  const [buildLocks, setBuildLocks] = useState(initialState.buildLocks || {});
  
  // Track actual board wrapper dimensions for dynamic scaling
  // Initial values calculated from window if available
  const [containerHeight, setContainerHeight] = useState(() => {
    if (typeof window === "undefined") return 600;
    // Estimate: viewport - estimated topbar (80px) - padding (24px)
    return window.innerHeight - 104;
  });
  
  const [containerWidth, setContainerWidth] = useState(() => {
    if (typeof window === "undefined") return 400;
    // Estimate: reasonable width for board cluster
    return Math.min(600, window.innerWidth - 48);
  });
  
  const [useShortNames, setUseShortNames] = useState(() => {
    if (typeof window === "undefined") return true;
    try {
      const raw = localStorage.getItem(SHORTNAME_STORAGE_KEY);
      // Default to true if not explicitly set to false
      return raw !== "false";
    } catch {
      return true;
    }
  });
  
  // Toolbar position: "left" (default) or "top"
  const [toolbarPosition, setToolbarPosition] = useState(() => {
    if (typeof window === "undefined") return "left";
    try {
      const saved = localStorage.getItem(TOOLBAR_POSITION_STORAGE_KEY);
      return saved === "top" ? "top" : "left";
    } catch {
      return "left";
    }
  });
  
  const [debugRegions, setDebugRegions] = useState(false);

  const lastStatusRef = useRef("");
  const updateStatus = useCallback((msg) => {
    setStatus(msg);
    lastStatusRef.current = msg || "";
  }, []);

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

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(SHOP_TAB_STORAGE_KEY, selectedCategory);
    } catch (e) {
      console.error("Failed to persist shop tab", e);
    }
  }, [selectedCategory]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(TOOLBAR_POSITION_STORAGE_KEY, toolbarPosition);
    } catch (e) {
      console.error("Failed to persist toolbar position", e);
    }
  }, [toolbarPosition]);

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

      let placement = fitsAt(
        TOWNHALL_START_POSITION.x,
        TOWNHALL_START_POSITION.y,
        prevLayout,
      )
        ? { ...TOWNHALL_START_POSITION }
        : null;
      if (!placement) {
        for (let y = 0; y <= BOARD_HEIGHT - townhallDef.height && !placement; y += 1) {
          for (let x = 0; x <= BOARD_WIDTH - townhallDef.width && !placement; x += 1) {
            if (fitsAt(x, y, prevLayout)) {
              placement = { x, y };
            }
          }
        }
      }
      if (!placement) return prevLayout;

      const maxId = prevLayout.reduce((max, b) => Math.max(max, b.id), 0);
      const id = Math.max(nextIdRef.current ?? 1, maxId + 1);
      nextIdRef.current = id + 1;
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
        [id]: isTierLocked(townhallDef.tier),
      }));
      return [...prevLayout, instance];
    });
  }, [townhallDef, carried, unlockedRegions, layout]);

  useEffect(() => {
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
              : isTierLocked(libraryMap[b.defId]?.tier);
        });
        return next;
      });
  }, [layout, libraryMap]);

  return {
    library,
    libraryMap,
    shortIdMap,
    categories,
    categoryColors,
    townhallDef,
    config,
    userConfig,
    activeSaveConfig,
    setActiveSaveConfig,
    configStartResources,
    configRevision,
    updateConfig,
    allowNegativeShards,
    resources,
    setResources,
    spendResources,
    refundResources,
    adjustGoods,
    adjustUnits,
    layout,
    setLayout,
    unlockedRegions,
    setUnlockedRegions,
    goodsUnlocks,
    setGoodsUnlocks,
    shardUnlocks,
    setShardUnlocks,
    selectedCategory,
    setSelectedCategory,
    selectedBuildingId,
    setSelectedBuildingId,
    selectedIds,
    setSelectedIds,
    hoverCell,
    setHoverCell,
    moveMode,
    setMoveMode,
    sellMode,
    setSellMode,
    refundMode,
    setRefundMode,
    boostMode,
    setBoostMode,
    notes,
    setNotes,
    infiniteResources,
    setInfiniteResources,
    carried,
    setCarried,
    moveSnapshot,
    setMoveSnapshot,
    harvestModal,
    setHarvestModal,
    smartHarvestModal,
    setSmartHarvestModal,
    smartInvestModal,
    setSmartInvestModal,
    smartInvestResults,
    setSmartInvestResults,
    smartInvestRunning,
    setSmartInvestRunning,
    goodsModal,
    setGoodsModal,
    unitModal,
    setUnitModal,
    fastBuyModal,
    setFastBuyModal,
    fastBuyTarget,
    setFastBuyTarget,
    helpModal,
    setHelpModal,
    configModal,
    setConfigModal,
    editResourceModal,
    setEditResourceModal,
    editGoodModal,
    setEditGoodModal,
    editUnitModal,
    setEditUnitModal,
    autoSelectNew,
    setAutoSelectNew,
    worstModal,
    setWorstModal,
    exportModal,
    setExportModal,
    importModal,
    setImportModal,
    loadSavesModal,
    setLoadSavesModal,
    pastEditModal,
    setPastEditModal,
    timeStep,
    setTimeStep,
    loadName,
    setLoadName,
    unlockChoice,
    setUnlockChoice,
    unlockGoodSelect,
    setUnlockGoodSelect,
    viewMode,
    setViewMode,
    boardScale,
    setBoardScale,
    containerHeight,
    setContainerHeight,
    containerWidth,
    setContainerWidth,
    status,
    setStatus,
    readyMap,
    setReadyMap,
    buildLocks,
    setBuildLocks,
    useShortNames,
    setUseShortNames,
    toolbarPosition,
    setToolbarPosition,
    replaceConfig,
    debugRegions,
    setDebugRegions,
    nextIdRef,
    smartInvestRunningRef,
    smartInvestStepResolveRef,
    lastStatusRef,
    updateStatus,
  };
};
