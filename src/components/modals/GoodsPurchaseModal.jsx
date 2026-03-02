// src/components/modals/GoodsPurchaseModal.jsx
import { formatNumber } from "../../utils/formatNumber";
import moneyIcon from "/money.webp";
import suppliesIcon from "/supplies.webp";
import { getGoodIconPath } from "../../utils/goodsIconPath";
import { getBuildingName } from "../../utils/buildingName";
import { useLang } from "../../context/LanguageContext";
import { T } from "../../i18n/translations";
import { Infinity as InfinityIcon } from "lucide-react";

const isInfinityCost = (value) =>
  value === "Infinity" || value === Infinity || value === Number.POSITIVE_INFINITY;

const renderValue = (value) =>
  isInfinityCost(value) ? (
    <InfinityIcon className="inline-icon" aria-label="Infinity" title="Infinity" />
  ) : (
    formatNumber(value)
  );

/**
 * Modal for buying goods for a specific goods building.
 *
 * Props:
 * - goodsModal: { def: any } | null
 *     where def is the building definition with:
 *       - def.produces: string (good key)
 *       - def.goodsCost: Record<string, { coins?: number, supplies?: number }>
 * - goods: Record<string, number>
 * - currentGoodsCost: number
 * - libraryMap: Record<string, any>
 * - onPurchase: (def: any, amountKey: string) => void
 * - onClose: () => void
 */
export function GoodsPurchaseModal({
  goodsModal,
  goods = {},
  currentGoodsCost = 0,
  onPurchase,
  onClose,
}) {
  if (!goodsModal) return null;
  const { lang } = useLang();
  const t = (key) => T[key]?.[lang] ?? T[key]?.DE ?? key;

  const { def } = goodsModal;
  const goodKey = def.produces;
  const currentAmount = goods?.[goodKey] ?? 0;
  const costs = Object.entries(def.goodsCost || {});
  const amountLabel = t("goodsPurchaseOptionAmount");
  const buildingLabel = getBuildingName(def, lang, "name");

  return (
    <div className="modal" onClick={onClose}>
      <div
        className="modal-card goods-purchase-modal"
        onClick={(e) => {
          e.stopPropagation();
        }}
      >
        <div className="goods-purchase-header">
          <div className="goods-purchase-heading">
            <h3>{t("goodsPurchaseTitle")}</h3>
            <div className="goods-purchase-building">{buildingLabel}</div>
          </div>
          <span className="goods-purchase-stock">
            <img
              src={getGoodIconPath(goodKey)}
              alt={goodKey}
              className="inline-icon"
            />
            {formatNumber(currentAmount)}
          </span>
        </div>
        <div className="modal-body goods-purchase-options">
          {costs.map(([amt, cost]) => (
            <button
              key={amt}
              onClick={() => onPurchase(def, amt)}
              className="goods-purchase-option"
            >
              <span className="goods-purchase-option-amount">
                {amountLabel.replace("{amount}", formatNumber(Number(amt)))}
              </span>
              <span className="goods-purchase-option-costs">
                <span className="goods-purchase-option-cost">
                  <img src={moneyIcon} alt={t("resourceCoins")} className="inline-icon" />
                  {formatNumber(cost.coins ?? 0)}
                </span>
                <span className="goods-purchase-option-cost">
                  <img
                    src={suppliesIcon}
                    alt={t("resourceSupplies")}
                    className="inline-icon"
                  />
                  {formatNumber(cost.supplies ?? 0)}
                </span>
              </span>
            </button>
          ))}
        </div>
        <div className="modal-actions goods-purchase-footer">
          <span className="goods-purchase-next-region">
            <span>{t("goodsPurchaseNextRegion")}</span>
            <img src="/menu/goods.png" alt={t("goodsAlt")} className="inline-icon" />
            <span>{renderValue(currentGoodsCost)}</span>
          </span>
          <button onClick={onClose}>{t("loadSavesClose")}</button>
        </div>
      </div>
    </div>
  );
}
