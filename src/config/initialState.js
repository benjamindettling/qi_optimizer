import { initialRegions, initialGoods, initialUnits } from "./boardConfig";
import { categories, categoryColors } from "./categories";
import { DEFAULT_START_RESOURCES, TOWNHALL_START_POSITION } from "./gameDefaults";

export const buildLibrary = () => {
  const library = categories.flatMap((cat) => {
    const prefix = (cat.key || "").slice(0, 1).toUpperCase();
    return cat.data.map((item, idx) => ({
      ...item,
      category: cat.key,
      defId: `${cat.key}:${item.id}`,
      shortId: `${prefix}${idx + 1}`,
      width: item.size[0],
      height: item.size[1],
    }));
  });
  const libraryMap = Object.fromEntries(
    library.map((entry) => [entry.defId, entry]),
  );
  const shortIdMap = Object.fromEntries(
    library.map((entry) => [entry.shortId, entry.defId]),
  );
  const townhallDef = library.find((d) => d.category === "townhall");
  return {
    library,
    libraryMap,
    shortIdMap,
    categories,
    categoryColors,
    townhallDef,
  };
};

export const buildInitialGameState = ({ libraryMap, townhallDef }) => {
  const initialTownhall = townhallDef
    ? [
        {
          id: 1,
          defId: townhallDef.defId,
          x: TOWNHALL_START_POSITION.x,
          y: TOWNHALL_START_POSITION.y,
          width: townhallDef.width,
          height: townhallDef.height,
        },
      ]
    : [];

  const readyMap = initialTownhall.reduce(
    (acc, b) => ({ ...acc, [b.id]: false }),
    {}
  );

  return {
    layout: initialTownhall,
    unlockedRegions: initialRegions(),
    goodsUnlocks: 0,
    shardUnlocks: 0,
    selectedCategory: "housing",
    selectedBuildingId: null,
    hoverCell: null,
    moveMode: false,
    sellMode: false,
    refundMode: false,
    boostMode: false,
    carried: null,
    moveSnapshot: null,
    harvestModal: null,
    goodsModal: null,
    fastBuyModal: null,
    fastBuyTarget: null,
    unitModal: null,
    helpModal: null,
    configModal: null,
    editGoodModal: null,
    unlockChoice: null,
    unlockGoodSelect: null,
    viewMode: "down",
    timeStep: 1,
    status: "",
    readyMap,
    buildLocks: {},
    selectedIds: [],
    infiniteResources: false,
    infiniteBackup: null,
    notes: "",
    resources: {
      ...DEFAULT_START_RESOURCES,
      goods: initialGoods(),
      units: initialUnits(),
    },
  };
};

// Convenience wrapper: return a complete initial game state without requiring
// callers to manually build and pass the library dependencies.
//
// The PDF exporter uses this to capture the "base" (freshly loaded) setup for
// Schritt 1.
export const buildInitialState = () => {
  const { libraryMap, townhallDef } = buildLibrary();
  return buildInitialGameState({ libraryMap, townhallDef });
};
