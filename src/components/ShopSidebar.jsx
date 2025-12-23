import { categories } from "../config/categories";
import { RegionsPanel } from "./RegionsPanel";
import moneyIcon from "/money.webp";
import suppliesIcon from "/supplies.webp";
import chronosIcon from "/chronos.webp";
import populationIcon from "/population.webp";
import happinessIcon from "/happiness/Neutral.webp";
import qaIcon from "/quantum_actions.webp";
import armyRedIcon from "/red_both_qi.webp";
import armyBlueIcon from "/blue_both_qi.webp";
import troopIcon from "/troop.webp";
import { GOODS_TYPES } from "../config/boardConfig";
import { formatNumber } from "../utils/formatNumber";

const CostRow = ({ icon, label, danger }) => (
  <div className={`cost-row ${danger ? "cost" : ""}`}>
    {icon && <img src={icon} alt={label} />}
    <span>{label}</span>
  </div>
);

const StatRow = ({ icon, label }) => (
  <div className="cost-row gain">
    {icon && <img src={icon} alt={label} />}
    <span>{label}</span>
  </div>
);

// Single transparent pixel to hide the default drag preview.
const TRANSPARENT_IMG = (() => {
  const img = new Image();
  img.src =
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y0nZocAAAAASUVORK5CYII=";
  return img;
})();

let dragMoved = false;
let touchMoved = false;

export function ShopSidebar({
  selectedCategory,
  setSelectedCategory,
  setSelectedBuildingId,
  resources,
  stats,
  infiniteResources = false,
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
  const isTouchDevice =
    typeof window !== "undefined" && "ontouchstart" in window;
  const visibleCategories = categories.filter((c) => !c.hidden);
  const selectedCat =
    visibleCategories.find((c) => c.key === selectedCategory) ||
    visibleCategories[0];

  const canBuild = (item) =>
    (infiniteResources ||
      ((resources.coins ?? 0) >= (item.cost.coins ?? 0) &&
        (resources.supplies ?? 0) >= (item.cost.supplies ?? 0) &&
        (resources.chronos ?? 0) >= (item.cost.chronos ?? 0))) &&
    stats.people - stats.peopleReq >= (item.requiresPeople ?? 0);

  const renderCostColumn = (item) => (
    <div className="card-cost-col cost">
      <CostRow
        icon={moneyIcon}
        label={formatNumber(item.cost.coins ?? 0)}
        danger
      />
      <CostRow
        icon={suppliesIcon}
        label={formatNumber(item.cost.supplies ?? 0)}
        danger
      />
      <CostRow
        icon={chronosIcon}
        label={formatNumber(item.cost.chronos ?? 0)}
        danger
      />
      {item.requiresPeople ? (
        <CostRow
          icon={populationIcon}
          label={`-${formatNumber(item.requiresPeople)}`}
          danger
        />
      ) : null}
    </div>
  );

  const renderBenefits = (item) => {
    const prod = item.production || {};
    const rows = [];
    if (item.people)
      rows.push(
        <StatRow
          key="people"
          icon={populationIcon}
          label={`+${formatNumber(item.people)}`}
        />
      );
    if (prod.coins)
      rows.push(
        <StatRow
          key="coins"
          icon={moneyIcon}
          label={formatNumber(prod.coins)}
        />
      );
    if (prod.supplies)
      rows.push(
        <StatRow
          key="supplies"
          icon={suppliesIcon}
          label={formatNumber(prod.supplies)}
        />
      );
    if (prod.chronos)
      rows.push(
        <StatRow
          key="chronos"
          icon={chronosIcon}
          label={formatNumber(prod.chronos)}
        />
      );
    if (item.coinBoost)
      rows.push(
        <StatRow
          key="coinBoost"
          icon={moneyIcon}
          label={`+${formatNumber(Math.round((item.coinBoost ?? 0) * 100))}%`}
        />
      );
    if (item.supplyBoost)
      rows.push(
        <StatRow
          key="supplyBoost"
          icon={suppliesIcon}
          label={`+${formatNumber(
            Math.round((item.supplyBoost ?? 0) * 100)
          )}%`}
        />
      );
    if (item.happiness)
      rows.push(
        <StatRow
          key="happy"
          icon={happinessIcon}
          label={formatNumber(item.happiness)}
        />
      );
    if (item.happinessCost)
      rows.push(
        <CostRow
          key="happyCost"
          icon={happinessIcon}
          label={`-${formatNumber(item.happinessCost)}`}
          danger
        />
      );
    if (item.qunatumActions)
      rows.push(
        <StatRow
          key="qa"
          icon={qaIcon}
          label={`${formatNumber(item.qunatumActions)}`}
        />
      );
    if (item.attack)
      rows.push(
        <StatRow
          key="atk"
          icon={null}
          label={`Attack +${formatNumber(item.attack)}%`}
        />
      );
    if (item.armyBoost) {
      Object.entries(item.armyBoost).forEach(([type, val]) => {
        rows.push(
          <StatRow
            key={`army-${type}`}
            icon={type === "red" ? armyRedIcon : armyBlueIcon}
            label={`+${formatNumber(Math.round((val ?? 0) * 100))}%`}
          />
        );
      });
    }
    if (item.goodsCost) {
      rows.push(
        <div key="goods" className="goods-table">
          <div className="goods-row header">
            <span className="goods-amount">
              <img
                src={`/goods/${item.produces === "Stein" ? "Backstein" : item.produces || "Kupfer"}.webp`}
                alt={item.produces || "goods"}
              />
            </span>
            <span className="goods-cost">
              <img src={moneyIcon} alt="coins" />
            </span>
            <span className="goods-cost">
              <img src={suppliesIcon} alt="supplies" />
            </span>
          </div>
          {Object.entries(item.goodsCost).map(([amt, cost]) => (
            <div key={amt} className="goods-row">
            <span className="goods-amount">{formatNumber(Number(amt))}</span>
            <span className="goods-cost">
              {formatNumber(cost.coins ?? 0)}
            </span>
            <span className="goods-cost">
              {formatNumber(cost.supplies ?? 0)}
            </span>
            </div>
          ))}
        </div>
      );
    }
    if (item.unitCosts) {
      rows.push(
        <div key="units" className="goods-table">
          <div className="goods-row header">
            <span className="goods-amount">
              <img src={troopIcon} alt="units" />
            </span>
            <span className="goods-cost">
              <img src={moneyIcon} alt="coins" />
            </span>
            <span className="goods-cost">
              <img src={suppliesIcon} alt="supplies" />
            </span>
          </div>
          {Object.entries(item.unitCosts).map(([amt, cost]) => (
            <div key={amt} className="goods-row">
            <span className="goods-amount">{formatNumber(Number(amt))}</span>
            <span className="goods-cost">
              {formatNumber(cost.coins ?? 0)}
            </span>
            <span className="goods-cost">
              {formatNumber(cost.supplies ?? 0)}
            </span>
            </div>
          ))}
        </div>
      );
    }
    return rows.length ? <div className="card-benefits">{rows}</div> : null;
  };

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

          return (
            <button
              key={defId}
              className={`card card-grid ${!buildable ? "disabled" : ""}`}
              style={{ touchAction: "none" }}
              onClick={() => {
                if (!buildable) return;
                if (dragMoved) {
                  dragMoved = false;
                  return;
                }
                if (onResetModes) onResetModes();
                setSelectedBuildingId(defId);
              }}
              draggable={!isTouchDevice}
              onDragStart={(e) => {
                dragMoved = false;
                if (onResetModes) onResetModes();
                setSelectedBuildingId(defId);
                // Indicate a move operation for compatibility with browsers
                try {
                  e.dataTransfer.effectAllowed = "move";
                  // Hide the default ghost image; board hover/preview will guide placement.
                  e.dataTransfer.setDragImage(TRANSPARENT_IMG, 0, 0);
                } catch {}
              }}
              onDrag={(e) => {
                dragMoved = true;
                // keep selection while dragging
                setSelectedBuildingId(defId);
              }}
              onDragEnd={() => {
                dragMoved = false;
              }}
              onTouchStart={() => {
                touchMoved = false;
                dragMoved = false;
                if (onResetModes) onResetModes();
                setSelectedBuildingId(defId);
              }}
              onTouchMove={() => {
                touchMoved = true;
                dragMoved = true;
              }}
              onTouchEnd={(e) => {
                if (!touchMoved) {
                  // treat as tap to select
                  setSelectedBuildingId(defId);
                }
                touchMoved = false;
                dragMoved = false;
              }}
            >
              <div className="card-header">
                <div className="card-title">{item.name}</div>
                <div className="card-meta">
                  {item.size[0]}x{item.size[1]}
                </div>
              </div>
              <div className="card-body">
                {renderCostColumn(item)}
                {renderBenefits(item)}
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
        infiniteResources={infiniteResources}
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
