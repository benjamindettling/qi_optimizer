import moneyIcon from "/money.webp";
import suppliesIcon from "/supplies.webp";
import chronosIcon from "/chronos.webp";
import populationIcon from "/population.webp";
import shardsIcon from "/shards.webp";
import qaIcon from "/quantum_actions.webp";
import {
  GOODS_TYPES,
  UNIT_TYPES,
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
  adminMode,
  onToggleAdmin,
  useShortNames = false,
  setUseShortNames,
  boardScale,
  setBoardScale,
  onEditResource,
  onEditGood,
  onEditUnit,
  onOpenHelp,
  onOpenConfig,
  editingLocked = false,
}) {
  const adminEnabled = adminMode && !editingLocked;

  const resourceEntries = [
    { key: "coins", label: "Muenzen", icon: moneyIcon, value: resources.coins },
    {
      key: "supplies",
      label: "Vorraete",
      icon: suppliesIcon,
      value: resources.supplies,
    },
    {
      key: "chronos",
      label: "Chronos",
      icon: chronosIcon,
      value: resources.chronos,
    },
    {
      key: "shards",
      label: "Scherben",
      icon: shardsIcon,
      value: resources.shards,
    },
    {
      key: "quantumActions",
      label: "QA",
      icon: qaIcon,
      value: resources.quantumActions,
      title: `QA/h: ${formatNumber(stats.qaPerHour ?? 0)}`,
    },
  ];

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
      <div className="topbar-stack">
        {resourceEntries.map((r) =>
          adminEnabled ? (
            <button
              key={r.key}
              className="resource-button"
              title={r.title || r.label}
              onClick={() =>
                onEditResource?.({ key: r.key, label: r.label, icon: r.icon })
              }
            >
              <img src={r.icon} alt={r.label} />
              <span>{formatNumber(r.value ?? 0)}</span>
            </button>
          ) : (
            <div
              key={r.key}
              className="resource-line"
              title={r.title || r.label}
            >
              <img src={r.icon} alt={r.label} />
              <span>{formatNumber(r.value ?? 0)}</span>
            </div>
          )
        )}
      </div>
      <div className="topbar-stack">
        {GOODS_TYPES.map((g) =>
          adminEnabled ? (
            <button
              key={g}
              className="resource-button"
              title={g}
              onClick={() => onEditGood?.(g)}
            >
              <img
                src={`/goods/${g === "Stein" ? "Backstein" : g}.webp`}
                alt={g}
              />
              <span>{formatNumber(resources.goods[g] ?? 0)}</span>
            </button>
          ) : (
            <div key={g} className="resource-line" title={g}>
              <img
                src={`/goods/${g === "Stein" ? "Backstein" : g}.webp`}
                alt={g}
              />
              <span>{formatNumber(resources.goods[g] ?? 0)}</span>
            </div>
          )
        )}
      </div>
      <div className="topbar-stack">
        {UNIT_TYPES.map((u) =>
          adminEnabled ? (
            <button
              key={u}
              className="resource-button"
              title={u}
              onClick={() => onEditUnit?.(u)}
            >
              <img src={`/units/${u}.webp`} alt={u} />
              <span>{formatNumber(resources.units?.[u] ?? 0)}</span>
            </button>
          ) : (
            <div key={u} className="resource-line" title={u}>
              <img src={`/units/${u}.webp`} alt={u} />
              <span>{formatNumber(resources.units?.[u] ?? 0)}</span>
            </div>
          )
        )}
      </div>
      <div className="topbar-stack boost-stack">
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
        <div className="resource-line" title="Totaler Muenzboost">
          <img src={moneyIcon} alt="coins" />
          <span className="happy-label"></span>
          <span className="happy-boost">x{coinMult}</span>
        </div>
        <div className="resource-line">
          <img src={suppliesIcon} alt="supplies" title="Totaler Vorratsboost" />
          <span className="happy-label"></span>
          <span className="happy-boost">x{supplyMult}</span>
        </div>
        <div className="resource-line" title="Totaler Chronosboost">
          <img src={chronosIcon} alt="chronos" />
          <span className="happy-label"></span>
          <span className="happy-boost">x{chronosMult}</span>
        </div>
        <div className="resource-line" title="Bevoelkerung">
          <img src={populationIcon} alt="population" />
          <div>
            <span className="total-pop" title="Totale Bevoelkerung">
              tot: {formatNumber(stats.people ?? 0)}
            </span>
            <br></br>
            <span title="Freie Bevoelkerung">
              free:{" "}
              {formatNumber(
                Math.max(0, (stats.people ?? 0) - (stats.peopleReq ?? 0))
              )}
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
                        color: row.delta <= 0 ? "#6de38f" : "#ff7676",
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
      <div className="actions actions-compact">
        <div className="actions-row">
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
                title="Groesse Stadtanzeige"
              />
            </div>
          </div>
          <div className="topbar-stack toggles-stack">
            <label
              className="infinite-toggle"
              title="Admin-Modus: freies Bauen, Region-Tools, Ressourcenbearbeitung"
            >
              <input
                type="checkbox"
                disabled={editingLocked}
                checked={!!adminMode}
                onChange={(e) =>
                  !editingLocked && onToggleAdmin?.(e.target.checked)
                }
              />
              Admin
            </label>
            <label className="infinite-toggle" title="Gebaeudenamen abkuerzen">
              <input
                type="checkbox"
                disabled={editingLocked}
                checked={!!useShortNames}
                onChange={(e) =>
                  !editingLocked && setUseShortNames?.(e.target.checked)
                }
              />
              Abkuerzen
            </label>
          </div>
        </div>
        <div className="actions-row">
          <button className="help-button" onClick={onOpenHelp} title="Hilfe">
            Hilfe
          </button>
          <button
            className="help-button"
            onClick={onOpenConfig}
            title="Konfiguration"
          >
            Config
          </button>
        </div>
      </div>
    </header>
  );
}
