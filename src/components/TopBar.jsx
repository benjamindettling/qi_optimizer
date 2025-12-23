import moneyIcon from "/money.webp";
import suppliesIcon from "/supplies.webp";
import chronosIcon from "/chronos.webp";
import populationIcon from "/population.webp";
import shardsIcon from "/shards.webp";
import {
  GOODS_TYPES,
  BOARD_SCALE_MIN,
  BOARD_SCALE_MAX,
} from "../config/boardConfig";
import { HAPPINESS_TIERS } from "../utils/gameMath";
import { formatNumber } from "../utils/formatNumber";

export function TopBar({
  resources,
  stats,
  happyInfo,
  viewMode,
  setViewMode,
  infiniteResources,
  onToggleInfinite,
  boardScale,
  setBoardScale,
  onEditResource,
  onEditGood,
  onOpenHelp,
  onOpenConfig,
}) {
  const percentColor = (pct) => {
    const hue = Math.min(120, Math.max(0, (pct / 200) * 120));
    return `hsl(${hue}, 70%, 60%)`;
  };

  const percent = (stats.happinessProvided / stats.happinessRequired) * 100;
  const tiers = HAPPINESS_TIERS.map((t, idx) => ({
    ...t,
    lower: idx === 0 ? 0 : HAPPINESS_TIERS[idx - 1].cap,
    labelPercent: Math.round(t.mult * 100),
  }));
  const currentTierIdx =
    tiers.findIndex((t) => percent < t.cap) !== -1
      ? tiers.findIndex((t) => percent < t.cap)
      : tiers.length - 1;

  const tierRows = tiers
    .map((t, idx) => ({ ...t, idx }))
    .filter((t) => t.idx !== currentTierIdx)
    .map((t) => {
      const isHigher = t.idx > currentTierIdx;
      const targetPercent = isHigher ? t.lower : t.cap;
      const targetProvided = (targetPercent * stats.happinessRequired) / 100;
      const delta = isHigher
        ? Math.ceil(targetProvided - stats.happinessProvided)
        : -Math.ceil(stats.happinessProvided - targetProvided);
      return {
        labelPercent: t.labelPercent,
        delta,
      };
    });
  const coinMult = (
    (stats.coinBoost ?? 0) +
    (happyInfo.ratio ?? 1) -
    1 +
    1
  ).toFixed(2);
  const supplyMult = (
    (stats.supplyBoost ?? 0) +
    (happyInfo.ratio ?? 1) -
    1 +
    1
  ).toFixed(2);
  const chronosMult = (happyInfo.ratio ?? 1).toFixed(2);

  return (
    <header className="topbar">
      <div className="resource-stack">
        <div
          className="resource-line"
          title="Münzen"
          onDoubleClick={() => onEditResource?.("coins")}
        >
          <img src={moneyIcon} alt="coins" />
          <span>
            {infiniteResources ? "\u221e" : formatNumber(resources.coins ?? 0)}
          </span>
        </div>
        <div
          className="resource-line"
          title="Vorräte"
          onDoubleClick={() => onEditResource?.("supplies")}
        >
          <img src={suppliesIcon} alt="supplies" />
          <span>
            {infiniteResources
              ? "\u221e"
              : formatNumber(resources.supplies ?? 0)}
          </span>
        </div>
        <div
          className="resource-line"
          title="Chronos"
          onDoubleClick={() => onEditResource?.("chronos")}
        >
          <img src={chronosIcon} alt="chronos" />
          <span>
            {infiniteResources
              ? "\u221e"
              : formatNumber(resources.chronos ?? 0)}
          </span>
        </div>
        <div className="resource-line" title="Scherben">
          <img src={shardsIcon} alt="shards" />
          <span onDoubleClick={() => onEditResource?.("shards")}>
            {infiniteResources ? "\u221e" : formatNumber(resources.shards ?? 0)}
          </span>
        </div>
      </div>
      <div className="goods-stack">
        {GOODS_TYPES.map((g) => (
          <div
            key={g}
            className="resource-line"
            title={g}
            onDoubleClick={() => onEditGood?.(g)}
          >
            <img
              src={`/goods/${g === "Stein" ? "Backstein" : g}.webp`}
              alt={g}
            />
            <span>
              {infiniteResources
                ? "\u221e"
                : formatNumber(resources.goods[g] ?? 0)}
            </span>
          </div>
        ))}
      </div>
      <div className="boost-stack">
        <div
          className="resource-line happiness"
          title={`Zufriedenheit: ${happyInfo.label}`}
        >
          <img src={happyInfo.icon} alt="happiness" />
          <div className="happy-summary">
            <div className="happy-row">
              <span className="happy-label"></span>
              <span
                className="happy-boost"
                style={{
                  color: percentColor((happyInfo.ratio ?? 1) * 100),
                }}
                title={`Zufriedenheit: ${happyInfo.label}`}
              >
                {Math.round((happyInfo.ratio ?? stats.happyMulti) * 100)}%
              </span>
            </div>
          </div>
        </div>
        <div className="resource-line" title="Totaler Münzboost">
          <img src={moneyIcon} alt="coins" />
          <span className="happy-label"></span>
          <span className="happy-boost">x{coinMult}</span>
        </div>
        <div className="resource-line">
          <img src={suppliesIcon} alt="supplies" title="Totaler Vorratsboost" />
          <span className="happy-label"></span>
          <span className="happy-boost">x{supplyMult}</span>
        </div>
        <div className="resource-line" title="Totaler Chronossboost">
          <img src={chronosIcon} alt="chronos" />
          <span className="happy-label"></span>
          <span className="happy-boost">x{chronosMult}</span>
        </div>
        <div className="resource-line population" title="Bevölkerung">
          <img src={populationIcon} alt="population" />
          <div>
            <span className="total-pop" title="Totale Bevölkerung">
              tot: {formatNumber(stats.people ?? 0)}
            </span>
            <br></br>
            <span title="Freie Bevölkerung">
              free: {formatNumber(Math.max(0, (stats.people ?? 0) - (stats.peopleReq ?? 0)))}
            </span>
          </div>
        </div>
      </div>
      <div className="happiness-block">
        <div className="happy-tabs">
          <div className="happy-tab happy-mults"></div>
          <div className="happy-tab happy-detail">
            <div className="happy-detail-grid">
              <div
                className="happy-table"
                title="Distanz zu anderen Zufriedenheitsstufen"
              >
                {tierRows.map((row) => (
                  <div className="happy-table-row" key={row.labelPercent}>
                    <span
                      className="happy-tier"
                      style={{ color: percentColor(row.labelPercent) }}
                    >
                      {row.labelPercent}%
                    </span>
                    <span
                      className="happy-delta"
                      style={{
                        color: row.delta < 0 ? "#6de38f" : "#ff7676",
                      }}
                    >
                      {row.delta > 0 ? "+" : row.delta < 0 ? "-" : ""}
                      {formatNumber(Math.abs(row.delta))}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="actions">
        <div className="view-switch">
          <div className="view-buttons">
            <button
              className={viewMode === "down" ? "active" : ""}
              onClick={() => setViewMode("down")}
              title="Down view"
            >
              &#8595;
            </button>
            <button
              className={viewMode === "diagonal" ? "active" : ""}
              onClick={() => setViewMode("diagonal")}
              title="Diagonal view"
            >
              &#8600;
            </button>
            <button
              className={viewMode === "right" ? "active" : ""}
              onClick={() => setViewMode("right")}
              title="Right view"
            >
              &#8594;
            </button>
          </div>

          <div className="board-scale">
            <input
              type="range"
              min={BOARD_SCALE_MIN}
              max={BOARD_SCALE_MAX}
              step={0.05}
              value={boardScale}
              onChange={(e) => setBoardScale?.(Number(e.target.value))}
              title="Grösse Stadtanzeige"
            />
          </div>
        </div>
        <label
          className="infinite-toggle"
          title="Unendliche Ressourcen, um einfacher Städte zu setuppen"
        >
          <input
            type="checkbox"
            checked={!!infiniteResources}
            onChange={(e) => onToggleInfinite?.(e.target.checked)}
          />
          &#8734;
        </label>

        <button className="help-button" onClick={onOpenHelp} title="Hilfe">
          Hilfe
        </button>
        <button className="help-button" onClick={onOpenConfig} title="Konfiguration">
          Config
        </button>
      </div>
    </header>
  );
}




