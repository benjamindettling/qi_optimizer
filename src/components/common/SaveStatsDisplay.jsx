import moneyIcon from "/money.webp";
import suppliesIcon from "/supplies.webp";
import goodsIcon from "/goods/Kupfer.webp";
import shardsIcon from "/shards.webp";
import attackIcon from "/fight/red_attack.webp";
import defenseIcon from "/fight/red_defense.webp";
import qaIcon from "/quantum_actions.webp";
import troopIcon from "/troop.webp";
import { useLang } from "../../context/LanguageContext";
import { T } from "../../i18n/translations";
import { formatNumber } from "../../utils/formatNumber";

function valueOrDash(value, suffix = "") {
  if (!Number.isFinite(Number(value))) return "-";
  return `${formatNumber(Number(value))}${suffix}`;
}

/**
 * Shared stats display for save cards (local + online).
 *
 * @param {object}  props
 * @param {object}  props.minimum        — { money, supplies, goods, shardsUsed, troops?, coinBoost?, supplyBoost? }
 * @param {object}  props.final          — { attack, defense, totalQaSetup | qaTotalDisplay }
 * @param {boolean} [props.showExtended] — show troops / coinBoost / supplyBoost rows (for online cards)
 */
export function SaveStatsDisplay({
  minimum = {},
  final: finalStats = {},
  showExtended = false,
}) {
  const { lang } = useLang();
  const t = (key) => T[key]?.[lang] ?? T[key]?.DE ?? key;

  const qaDisplay = finalStats.qaTotalDisplay ?? finalStats.totalQaSetup;

  return (
    <div className="load-saves-stats">
      <div className="load-saves-stats-col">
        <div className="load-saves-stats-title minimum">
          {t("loadSavesStatsMinimum")}
        </div>
        <div className="load-saves-stats-line" title={t("loadSavesStatsMoney")}>
          <img
            src={moneyIcon}
            alt={t("loadSavesStatsMoney")}
            className="load-saves-stat-icon"
          />
          <strong>{valueOrDash(minimum.money)}</strong>
        </div>
        <div
          className="load-saves-stats-line"
          title={t("loadSavesStatsSupplies")}
        >
          <img
            src={suppliesIcon}
            alt={t("loadSavesStatsSupplies")}
            className="load-saves-stat-icon"
          />
          <strong>{valueOrDash(minimum.supplies)}</strong>
        </div>
        <div className="load-saves-stats-line" title={t("loadSavesStatsGoods")}>
          <img
            src={goodsIcon}
            alt={t("loadSavesStatsGoods")}
            className="load-saves-stat-icon"
          />
          <strong>{valueOrDash(minimum.goods)}</strong>
        </div>
        <div
          className="load-saves-stats-line"
          title={t("loadSavesStatsShardsUsed")}
        >
          <img
            src={shardsIcon}
            alt={t("loadSavesStatsShardsUsed")}
            className="load-saves-stat-icon"
          />
          <strong>{valueOrDash(minimum.shardsUsed)}</strong>
        </div>
        {showExtended && (
          <>
            <div
              className="load-saves-stats-line"
              title={t("loadSavesStatsTroops")}
            >
              <img
                src={troopIcon}
                alt={t("loadSavesStatsTroops")}
                className="load-saves-stat-icon"
              />
              <strong>{valueOrDash(minimum.troops)}</strong>
            </div>
            <div
              className="load-saves-stats-line"
              title={t("loadSavesStatsCoinBoost")}
            >
              <img
                src={moneyIcon}
                alt={t("loadSavesStatsCoinBoost")}
                className="load-saves-stat-icon boost-icon"
              />
              <strong>{valueOrDash(minimum.coinBoost, "%")}</strong>
            </div>
            <div
              className="load-saves-stats-line"
              title={t("loadSavesStatsSupplyBoost")}
            >
              <img
                src={suppliesIcon}
                alt={t("loadSavesStatsSupplyBoost")}
                className="load-saves-stat-icon boost-icon"
              />
              <strong>{valueOrDash(minimum.supplyBoost, "%")}</strong>
            </div>
          </>
        )}
      </div>
      <div className="load-saves-stats-col">
        <div className="load-saves-stats-title final">
          {t("loadSavesStatsFinal")}
        </div>
        <div
          className="load-saves-stats-line"
          title={t("loadSavesStatsAttack")}
        >
          <img
            src={attackIcon}
            alt={t("loadSavesStatsAttack")}
            className="load-saves-stat-icon"
          />
          <strong>{valueOrDash(finalStats.attack, "%")}</strong>
        </div>
        <div
          className="load-saves-stats-line"
          title={t("loadSavesStatsDefense")}
        >
          <img
            src={defenseIcon}
            alt={t("loadSavesStatsDefense")}
            className="load-saves-stat-icon"
          />
          <strong>{valueOrDash(finalStats.defense, "%")}</strong>
        </div>
        <div
          className="load-saves-stats-line"
          title={t("loadSavesStatsTotalQa")}
        >
          <img
            src={qaIcon}
            alt={t("loadSavesStatsTotalQa")}
            className="load-saves-stat-icon"
          />
          <strong>{valueOrDash(qaDisplay)}</strong>
        </div>
      </div>
    </div>
  );
}
