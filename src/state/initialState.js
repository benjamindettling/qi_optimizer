import { initialRegions, initialGoods } from "../config/boardConfig";
import { categories, categoryColors } from "../config/categories";

export const buildLibrary = () => {
  const library = categories.flatMap((cat) =>
    cat.data.map((item) => ({
      ...item,
      category: cat.key,
      defId: `${cat.key}:${item.id}`,
      width: item.size[0],
      height: item.size[1],
    }))
  );
  const libraryMap = Object.fromEntries(
    library.map((entry) => [entry.defId, entry])
  );
  const townhallDef = library.find((d) => d.category === "townhall");
  return { library, libraryMap, categories, categoryColors, townhallDef };
};

export const buildInitialGameState = ({ libraryMap, townhallDef }) => {
  const initialTownhall = townhallDef
    ? [
        {
          id: 1,
          defId: townhallDef.defId,
          x: 17,
          y: 4,
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
    carried: null,
    moveSnapshot: null,
    harvestModal: null,
    goodsModal: null,
    fastBuyModal: null,
    fastBuyTarget: null,
    unlockChoice: null,
    unlockGoodSelect: null,
    viewMode: "down",
    status: "",
    readyMap,
    notes: "",
    resources: {
      coins: 450000,
      supplies: 75000,
      chronos: 0,
      shards: 500,
      goods: initialGoods(),
    },
  };
};
