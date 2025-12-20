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

export function TopBar({
  resources,
  stats,
  happyInfo,
  viewMode,
  setViewMode,
  boardScale,
  setBoardScale,
  onEditResource,
  onEditGood,
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
    .filter((_, idx) => idx !== currentTierIdx)
    .map((t) => {
      const target = (t.lower * stats.happinessRequired) / 100;
      const delta = Math.ceil(target - stats.happinessProvided);
      return {
        labelPercent: t.labelPercent,
        delta,
      };
    });

  return (
    <header className="topbar">
      <div className="resource-stack">
        <div
          className="resource-line"
          title="Coins"
          onDoubleClick={() => onEditResource?.("coins")}
        >
          <img src={moneyIcon} alt="coins" />
          <span>{resources.coins}</span>
        </div>
        <div
          className="resource-line"
          title="Supplies"
          onDoubleClick={() => onEditResource?.("supplies")}
        >
          <img src={suppliesIcon} alt="supplies" />
          <span>{resources.supplies}</span>
        </div>
        <div
          className="resource-line"
          title="Chronos"
          onDoubleClick={() => onEditResource?.("chronos")}
        >
          <img src={chronosIcon} alt="chronos" />
          <span>{resources.chronos}</span>
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
            <span>{resources.goods[g] ?? 0}</span>
          </div>
        ))}
      </div>
      <div className="meta-row">
        <div className="resource-line population" title="Population">
          <img src={populationIcon} alt="population" />
          <div className="pop-numbers">
            <span title="Total population">tot: {stats.people}</span>
            <span title="Free population">
              free: {Math.max(0, stats.people - stats.peopleReq)}
            </span>
          </div>
        </div>
        <div className="happiness-block">
          <div
            className="resource-line happiness"
            title={`Happiness: ${happyInfo.label}`}
          >
            <img src={happyInfo.icon} alt="happiness" />
            <div className="happy-summary">
              <div className="happy-row">
                <span className="happy-label">Boost</span>
                <span
                  className="happy-boost"
                  style={{ color: percentColor((happyInfo.ratio ?? 1) * 100) }}
                  title={`Current tier: ${happyInfo.label}`}
                >
                  {Math.round((happyInfo.ratio ?? stats.happyMulti) * 100)}%
                </span>
              </div>
            </div>
          </div>
          <div
            className="happy-table"
            title="Distance to other happiness tiers"
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
                  {row.delta > 0 ? "+" : ""}
                  {row.delta}
                </span>
              </div>
            ))}
          </div>
        </div>
        <div className="resource-line" title="Shards">
          <img src={shardsIcon} alt="shards" />
          <span onDoubleClick={() => onEditResource?.("shards")}>
            {resources.shards}
          </span>
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
              title="Board size"
            />
          </div>
        </div>
        <span className="tips-text" title="">
          Doppelklick auf Ressource, um Wert anzupassen
        </span>
      </div>
    </header>
  );
}
