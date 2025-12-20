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
        <div
          className="resource-line happiness"
          title={`Happiness: ${happyInfo.label}`}
        >
          <img src={happyInfo.icon} alt="happiness" />
          <div className="happy-numbers">
            <span title="Total happiness">tot: {stats.happinessProvided}</span>
            <span title="Required happiness">
              req: {stats.happinessRequired}
            </span>
            <span
              className="large"
              title="Happiness boost"
              style={{
                color: `hsl(${Math.min(
                  120,
                  ((happyInfo.percent ?? 0) / 200) * 120
                )}, 70%, 60%)`,
              }}
            >
              {Math.round((happyInfo.ratio ?? stats.happyMulti) * 100)}%
            </span>
            <span
              title={
                happyInfo.nextDelta > 0
                  ? "Happiness needed for next tier"
                  : "Extra happiness above top tier"
              }
              style={{
                color: happyInfo.nextDelta > 0 ? "#ff7676" : "#6de38f",
              }}
            >
              {happyInfo.nextDelta > 0
                ? `+${happyInfo.nextDelta}`
                : `${Math.abs(happyInfo.nextDelta)}`}
            </span>
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
