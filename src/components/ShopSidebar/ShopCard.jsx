// Shop card for a single building or upgrade item.
import { useLayoutEffect, useRef, useState } from "react";
import moneyIcon from "/money.webp";
import suppliesIcon from "/supplies.webp";
import chronosIcon from "/chronos.webp";
import populationIcon from "/population.webp";
import happinessIcon from "/happiness/Neutral.webp";
import qaIcon from "/quantum_actions.webp";
import armyRedIcon from "/red_both_qi.webp";
import armyBlueIcon from "/blue_both_qi.webp";
import troopIcon from "/troop.webp";
import { formatNumber } from "../../utils/formatNumber";
import { getGoodIconPath } from "../../utils/goodsIconPath";
import { useLang } from "../../context/LanguageContext";
import { getBuildingName } from "../../utils/buildingName";

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
const TOUCH_TAP_THRESHOLD_PX = 12;

const isMhDefId = (defId) =>
  typeof defId === "string" &&
  (defId === "mehrgeschossiges_haus" ||
    defId.endsWith(":mehrgeschossiges_haus"));
const isGutshausDefId = (defId) =>
  typeof defId === "string" &&
  (defId === "gutshaus" || defId.endsWith(":gutshaus"));
const isChurchDefId = (defId) =>
  typeof defId === "string" &&
  (defId === "kirche" || defId.endsWith(":kirche"));

export function ShopCard({
  item,
  defId,
  buildable,
  isTouchDevice,
  onSelect,
  onResetModes,
  isFavorite,
  onToggleFavorite,
}) {
  const { lang } = useLang();
  const itemName = getBuildingName(item, lang, "name");
  const [showCosts, setShowCosts] = useState(false);
  const hasCostTable = !!item.goodsCost || !!item.unitCosts;
  const titleRef = useRef(null);
  const touchStartRef = useRef({ x: 0, y: 0 });
  const suppressClickUntilRef = useRef(0);

  useLayoutEffect(() => {
    const el = titleRef.current;
    if (!el) return;
    const storedSize = Number.parseFloat(el.dataset.baseFontSize);
    const computedSize = Number.parseFloat(getComputedStyle(el).fontSize) || 14;
    const baseSize = Number.isFinite(storedSize) ? storedSize : computedSize;
    if (!Number.isFinite(storedSize)) {
      el.dataset.baseFontSize = String(baseSize);
    }
    const minSize = Math.max(10, baseSize * 0.75);
    let size = baseSize;

    el.style.fontSize = `${size}px`;
    while (el.scrollWidth > el.clientWidth && size > minSize) {
      size = Math.max(minSize, size - 0.5);
      el.style.fontSize = `${size}px`;
      if (size === minSize) break;
    }
  }, [itemName]);
  const renderCostColumn = () => (
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

  const renderBenefits = () => {
    const prod = item.production || {};
    const rows = [];
    if (item.people)
      rows.push(
        <StatRow
          key="people"
          icon={populationIcon}
          label={`+${formatNumber(item.people)}`}
        />,
      );
    if (prod.coins)
      rows.push(
        <StatRow
          key="coins"
          icon={moneyIcon}
          label={formatNumber(prod.coins)}
        />,
      );
    if (prod.supplies)
      rows.push(
        <StatRow
          key="supplies"
          icon={suppliesIcon}
          label={formatNumber(prod.supplies)}
        />,
      );
    if (prod.chronos)
      rows.push(
        <StatRow
          key="chronos"
          icon={chronosIcon}
          label={formatNumber(prod.chronos)}
        />,
      );
    if (item.coinBoost)
      rows.push(
        <StatRow
          key="coinBoost"
          icon={moneyIcon}
          label={`+${formatNumber(Math.round((item.coinBoost ?? 0) * 100))}%`}
        />,
      );
    if (item.supplyBoost)
      rows.push(
        <StatRow
          key="supplyBoost"
          icon={suppliesIcon}
          label={`+${formatNumber(Math.round((item.supplyBoost ?? 0) * 100))}%`}
        />,
      );
    if (item.happiness)
      rows.push(
        <StatRow
          key="happy"
          icon={happinessIcon}
          label={formatNumber(item.happiness)}
        />,
      );
    if (item.happinessCost)
      rows.push(
        <CostRow
          key="happyCost"
          icon={happinessIcon}
          label={`-${formatNumber(item.happinessCost)}`}
          danger
        />,
      );
    if (item.quantumActions)
      rows.push(
        <StatRow
          key="qa"
          icon={qaIcon}
          label={`${formatNumber(item.quantumActions)}`}
        />,
      );
    if (item.attack)
      rows.push(
        <StatRow
          key="atk"
          icon={null}
          label={`Attack +${formatNumber(item.attack)}%`}
        />,
      );
    if (item.armyBoost) {
      Object.entries(item.armyBoost).forEach(([type, val]) => {
        rows.push(
          <StatRow
            key={`army-${type}`}
            icon={type === "red" ? armyRedIcon : armyBlueIcon}
            label={`+${formatNumber(Math.round((val ?? 0) * 100))}%`}
          />,
        );
      });
    }
    if (hasCostTable) {
      rows.push(
        <div key="cost-toggle" className="cost-toggle">
          <button
            type="button"
            className="cost-toggle-btn"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setShowCosts((prev) => !prev);
            }}
            draggable={false}
          >
            Kosten
          </button>
          {showCosts && (
            <div className="cost-flyout" onClick={(e) => e.stopPropagation()}>
              {item.goodsCost ? (
                <div className="goods-table">
                  <div className="goods-row header">
                    <span className="goods-amount">
                      <img
                        src={getGoodIconPath(item.produces || "Kupfer")}
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
                      <span className="goods-amount">
                        {formatNumber(Number(amt))}
                      </span>
                      <span className="goods-cost">
                        {formatNumber(cost.coins ?? 0)}
                      </span>
                      <span className="goods-cost">
                        {formatNumber(cost.supplies ?? 0)}
                      </span>
                    </div>
                  ))}
                </div>
              ) : null}
              {item.unitCosts ? (
                <div className="goods-table">
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
                      <span className="goods-amount">
                        {formatNumber(Number(amt))}
                      </span>
                      <span className="goods-cost">
                        {formatNumber(cost.coins ?? 0)}
                      </span>
                      <span className="goods-cost">
                        {formatNumber(cost.supplies ?? 0)}
                      </span>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          )}
        </div>,
      );
    }
    return rows.length ? <div className="card-benefits">{rows}</div> : null;
  };

  const handleSelect = () => {
    if (!buildable) return;
    if (Date.now() < suppressClickUntilRef.current) return;
    if (dragMoved) {
      dragMoved = false;
      return;
    }
    onResetModes?.();
    onSelect?.(defId);
  };

  return (
    <div
      className={`card card-grid ${!buildable ? "disabled" : ""}`}
      style={{ touchAction: "auto" }}
      data-tutorial-zone={
        isMhDefId(defId)
          ? "mh-card"
          : isGutshausDefId(defId)
            ? "gutshaus-card"
            : isChurchDefId(defId)
              ? "church-card"
              : undefined
      }
      role="button"
      tabIndex={0}
      onClick={handleSelect}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handleSelect();
        }
      }}
      draggable={!isTouchDevice && buildable}
      onDragStart={(e) => {
        if (!buildable) {
          e.preventDefault();
          return;
        }
        dragMoved = false;
        onResetModes?.();
        onSelect?.(defId);
        try {
          e.dataTransfer.effectAllowed = "move";
          e.dataTransfer.setDragImage(TRANSPARENT_IMG, 0, 0);
        } catch {
          return;
        }
      }}
      onDrag={() => {
        if (!buildable) return;
        dragMoved = true;
        onSelect?.(defId);
      }}
      onDragEnd={() => {
        dragMoved = false;
      }}
      onTouchStart={() => {
        touchMoved = false;
        dragMoved = false;
      }}
      onTouchStartCapture={(event) => {
        const touch = event.touches?.[0];
        if (!touch) return;
        touchStartRef.current = { x: touch.clientX, y: touch.clientY };
      }}
      onTouchMove={(event) => {
        const touch = event.touches?.[0];
        if (!touch) return;
        const dx = Math.abs(touch.clientX - touchStartRef.current.x);
        const dy = Math.abs(touch.clientY - touchStartRef.current.y);
        if (dx > TOUCH_TAP_THRESHOLD_PX || dy > TOUCH_TAP_THRESHOLD_PX) {
          touchMoved = true;
          dragMoved = true;
        }
      }}
      onTouchEnd={() => {
        suppressClickUntilRef.current = Date.now() + 400;
        if (!buildable) return;
        if (!touchMoved) {
          onResetModes?.();
          onSelect?.(defId);
        }
        touchMoved = false;
        dragMoved = false;
      }}
    >
      <div className="card-header">
        <div className="card-title" title={itemName} ref={titleRef}>
          {itemName}
        </div>
        <div className="card-meta">
          {item.size[0]}x{item.size[1]}
        </div>
        <button
          type="button"
          className={`card-favorite ${isFavorite ? "active" : ""}`}
          title={isFavorite ? "Aus Favoriten entfernen" : "Zu Favoriten"}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onToggleFavorite?.(defId);
          }}
        >
          {isFavorite ? "★" : "☆"}
        </button>
      </div>
      <div className="card-body">
        {renderCostColumn()}
        {renderBenefits()}
      </div>
    </div>
  );
}
