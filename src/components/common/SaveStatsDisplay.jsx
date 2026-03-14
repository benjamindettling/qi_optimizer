import moneyIcon from "/money.webp";
import suppliesIcon from "/supplies.webp";
import goodsIcon from "/goods/Kupfer.webp";
import shardsIcon from "/shards.webp";
import attackIcon from "/fight/red_attack.webp";
import defenseIcon from "/fight/red_defense.webp";
import qaIcon from "/quantum_actions.webp";
import unitIcon from "/troop.webp";
import { useLang } from "../../context/LanguageContext";
import { T } from "../../i18n/translations";
import { formatNumber } from "../../utils/formatNumber";

function valueOrDash(value, suffix = "") {
  if (!Number.isFinite(Number(value))) return "-";
  return `${formatNumber(Number(value))}${suffix}`;
}

function formatUnits(units) {
  if (!units || typeof units !== "object") return "-";
  const k = Number(units.Katapult ?? 0);
  const b = Number(units.Blide ?? 0);
  const c = Number(units.Kanone ?? 0);
  if (!Number.isFinite(k) && !Number.isFinite(b) && !Number.isFinite(c))
    return "-";
  return `${k}/${b}/${c}`;
}

/**
 * Shared stats display for save cards.
 *
 * Minimum column: money, supplies, goods, shards
 * Final column: QA, attack, defense, units
 *
 * @param {object}  props
 * @param {object}  props.minimum — { money, supplies, goods, shardsUsed }
 * @param {object}  props.final   — { totalQaSetup | qaTotalDisplay, attack, defense, units }
 */
export function SaveStatsDisplay({
  minimum = {},
  final: finalStats = {},
  minimumViolations = {},
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
          <strong
            className={
              minimumViolations.money ? "load-saves-stat-value-violation" : ""
            }
          >
            {valueOrDash(minimum.money)}
          </strong>
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
          <strong
            className={
              minimumViolations.supplies
                ? "load-saves-stat-value-violation"
                : ""
            }
          >
            {valueOrDash(minimum.supplies)}
          </strong>
        </div>
        <div className="load-saves-stats-line" title={t("loadSavesStatsGoods")}>
          <img
            src={goodsIcon}
            alt={t("loadSavesStatsGoods")}
            className="load-saves-stat-icon"
          />
          <strong
            className={
              minimumViolations.goods ? "load-saves-stat-value-violation" : ""
            }
          >
            {valueOrDash(minimum.goods)}
          </strong>
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
          <strong
            className={
              minimumViolations.shardsUsed
                ? "load-saves-stat-value-violation"
                : ""
            }
          >
            {valueOrDash(minimum.shardsUsed)}
          </strong>
        </div>
      </div>
      <div className="load-saves-stats-col">
        <div className="load-saves-stats-title final">
          {t("loadSavesStatsFinal")}
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
        <div className="load-saves-stats-line" title={t("loadSavesStatsUnits")}>
          <img
            src={unitIcon}
            alt={t("loadSavesStatsUnits")}
            className="load-saves-stat-icon"
          />
          <strong>{formatUnits(finalStats.units)}</strong>
        </div>
      </div>
    </div>
  );
}
