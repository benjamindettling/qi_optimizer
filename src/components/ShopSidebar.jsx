import { categories } from "../config/categories";
import { RegionsPanel } from "./RegionsPanel";

export function ShopSidebar({
  selectedCategory,
  setSelectedCategory,
  setSelectedBuildingId,
  resources,
  stats,
  viewMode,
  regionTransform,
  unlockedRegions,
  regionMask,
  neighborUnlocked,
  currentGoodsCost,
  currentShardCost,
  goodsUnlocks,
  shardUnlocks,
  onSetGoodsUnlocks,
  onSetShardUnlocks,
  canAnyUnlock,
  handleUnlockRegion,
  REGION_COLS,
  onResetModes,
  debugRegions,
  onToggleDebugRegions,
  onDebugUnlockRegion,
  onDebugLockRegion,
}) {
  const visibleCategories = categories.filter((c) => !c.hidden);
  const selectedCat =
    visibleCategories.find((c) => c.key === selectedCategory) ||
    visibleCategories[0];

  const canBuild = (item) =>
    (resources.coins ?? 0) >= (item.cost.coins ?? 0) &&
    (resources.supplies ?? 0) >= (item.cost.supplies ?? 0) &&
    (resources.chronos ?? 0) >= (item.cost.chronos ?? 0) &&
    stats.people - stats.peopleReq >= (item.requiresPeople ?? 0);

  return (
    <div className="sidebar">
      <div className="tabs">
        {visibleCategories.map((cat) => (
          <button
            key={cat.key}
            className={selectedCategory === cat.key ? "active" : ""}
            onClick={() => {
              setSelectedCategory(cat.key);
              setSelectedBuildingId(null);
              if (onResetModes) onResetModes();
            }}
            title={cat.label}
          >
            <img src={cat.icon} alt={cat.label} />
          </button>
        ))}
      </div>

      <div className="shop">
        {selectedCat?.data.map((item) => {
          const defId = `${selectedCat.key}:${item.id}`;
          const buildable = canBuild(item);
          const prod = item.production || {};
          const coinBoost =
            item.category === "housing" ? item.coinBoost ?? 0 : 0;
          const supplyBoost =
            item.category === "production" ? item.supplyBoost ?? 0 : 0;
          const prodText =
            (item.category === "housing" || item.category === "production") &&
            (prod.coins || prod.supplies || prod.chronos || coinBoost || supplyBoost)
              ? [
                  prod.coins ? `c:${prod.coins}` : null,
                  prod.supplies ? `s:${prod.supplies}` : null,
                  prod.chronos ? `t:${prod.chronos}` : null,
                  coinBoost ? `coin +${Math.round(coinBoost * 100)}%` : null,
                  supplyBoost
                    ? `supply +${Math.round(supplyBoost * 100)}%`
                    : null,
                ]
                  .filter(Boolean)
                  .join(" | ")
              : "";
          return (
            <button
              key={defId}
              className={`card ${!buildable ? "disabled" : ""}`}
              onClick={() => {
                if (!buildable) return;
                if (onResetModes) onResetModes();
                setSelectedBuildingId(defId);
              }}
            >
              <div className="card-title">{item.name}</div>
              <div className="card-meta">
                {item.size[0]}x{item.size[1]}
              </div>
              <div className="card-meta">
                {item.category === "housing" && item.people ? (
                  <span style={{ color: "#7ac25f" }}>+{item.people} people</span>
                ) : item.requiresPeople ? (
                  <span style={{ color: "#d84848" }}>
                    -{item.requiresPeople} people
                  </span>
                ) : null}
              </div>
              {prodText && (
                <div className="card-meta" style={{ color: "#70a7ff" }}>
                  {prodText}
                </div>
              )}
              <div className="card-cost">
                {item.cost.coins ?? 0} c / {item.cost.supplies ?? 0} s / {" "}
                {item.cost.chronos ?? 0} t
              </div>
            </button>
          );
        })}
      </div>

      <RegionsPanel
        viewMode={viewMode}
        regionTransform={regionTransform}
        unlockedRegions={unlockedRegions}
        regionMask={regionMask}
        neighborUnlocked={neighborUnlocked}
        currentGoodsCost={currentGoodsCost}
        currentShardCost={currentShardCost}
        goodsUnlocks={goodsUnlocks}
        shardUnlocks={shardUnlocks}
        onSetGoodsUnlocks={onSetGoodsUnlocks}
        onSetShardUnlocks={onSetShardUnlocks}
        canAnyUnlock={canAnyUnlock}
        handleUnlockRegion={handleUnlockRegion}
        REGION_COLS={REGION_COLS}
        debugRegions={debugRegions}
        onToggleDebugRegions={onToggleDebugRegions}
        onDebugUnlockRegion={onDebugUnlockRegion}
        onDebugLockRegion={onDebugLockRegion}
      />
    </div>
  );
}
