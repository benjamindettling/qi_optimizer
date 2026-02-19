// Main top bar showing resources, boosts, and view controls.
import { RefreshCw } from "lucide-react";
import moneyIcon from "/money.webp";
import suppliesIcon from "/supplies.webp";
import chronosIcon from "/chronos.webp";
import shardsIcon from "/shards.webp";
import qaIcon from "/quantum_actions.webp";
import redAttackIcon from "/fight/red_attack.webp";
import redDefenseIcon from "/fight/red_defense.webp";
import blueAttackIcon from "/fight/blue_attack.webp";
import blueDefenseIcon from "/fight/blue_defense.webp";
import { GOODS_TYPES, UNIT_TYPES } from "../../config/boardConfig";
import { formatNumber } from "../../utils/formatNumber";
import { HappinessPanel } from "./HappinessPanel";
import { ResourceStack } from "./ResourceStack";
import { ViewControls } from "./ViewControls";
import { SaveControls } from "./SaveControls";
import "./TopBar.css";

export function TopBar({
  resources,
  stats,
  happyInfo,
  viewMode,
  setViewMode,
  adminMode,
  onToggleAdmin,
  useShortNames,
  setUseShortNames,
  onEditResource,
  onEditGood,
  onEditUnit,
  onOpenHelp,
  onOpenAccount,
  editingLocked = false,
  config,
  userConfig,
  activeSaveConfig,
  onSyncConfig,
  // Save controls props
  onSave,
  onLoad,
  saves,
  loadName,
  setLoadName,
  onDeleteSave,
  onOpenExport,
  onOpenImport,
  onOpenLoadSaves,
}) {
  const adminEnabled = adminMode && !editingLocked;
  const valueClassFor = (value) => ((value ?? 0) < 0 ? "text-negative" : "");

  const resourceEntries = [
    {
      key: "coins",
      label: "Münzen",
      icon: moneyIcon,
      value: resources.coins,
      valueClass: valueClassFor(resources.coins),
      onEdit: () =>
        onEditResource?.({ key: "coins", label: "Münzen", icon: moneyIcon }),
    },
    {
      key: "supplies",
      label: "Vorräte",
      icon: suppliesIcon,
      value: resources.supplies,
      valueClass: valueClassFor(resources.supplies),
      onEdit: () =>
        onEditResource?.({
          key: "supplies",
          label: "Vorräte",
          icon: suppliesIcon,
        }),
    },
    {
      key: "chronos",
      label: "Chronos",
      icon: chronosIcon,
      value: resources.chronos,
      valueClass: valueClassFor(resources.chronos),
      onEdit: () =>
        onEditResource?.({
          key: "chronos",
          label: "Chronos",
          icon: chronosIcon,
        }),
    },
    {
      key: "shards",
      label: "Scherben",
      icon: shardsIcon,
      value: resources.shards,
      valueClass: valueClassFor(resources.shards),
      onEdit: () =>
        onEditResource?.({
          key: "shards",
          label: "Scherben",
          icon: shardsIcon,
        }),
    },
    {
      key: "quantumActions",
      label: "QA",
      icon: qaIcon,
      value: resources.quantumActions,
      valueClass: valueClassFor(resources.quantumActions),
      title: `QA/h: ${formatNumber(stats.qaPerHour ?? 0)}`,
      onEdit: () =>
        onEditResource?.({
          key: "quantumActions",
          label: "QA",
          icon: qaIcon,
        }),
    },
  ];

  const goodsEntries = GOODS_TYPES.map((g) => ({
    key: g,
    label: g,
    icon: `/goods/${g === "Stein" ? "Backstein" : g}.webp`,
    value: resources.goods[g],
    valueClass: valueClassFor(resources.goods[g]),
    onEdit: () => onEditGood?.(g),
  }));

  const unitEntries = UNIT_TYPES.map((u) => ({
    key: u,
    label: u,
    icon: `/units/${u}.webp`,
    value: resources.units?.[u],
    valueClass: valueClassFor(resources.units?.[u]),
    onEdit: () => onEditUnit?.(u),
  }));

  // Determine which color's attack/defense to show based on config
  const fightColor = config?.fightColor ?? "rot";
  const isBlue = fightColor === "blau";

  // Get decoration boosts from stats (decorations add to both attack and defense equally)
  const decorationBoostRed = stats.armyBoostRed ?? 0;
  const decorationBoostBlue = stats.armyBoostBlue ?? 0;

  // Get config boosts for attack/defense
  const redAttackCfg = Number(config?.redAttackBoost ?? 0) / 100;
  const redDefenseCfg = Number(config?.redDefenseBoost ?? 0) / 100;
  const blueAttackCfg = Number(config?.blueAttackBoost ?? 0) / 100;
  const blueDefenseCfg = Number(config?.blueDefenseBoost ?? 0) / 100;

  // Calculate total attack/defense for each color
  const redAttackTotal = decorationBoostRed + redAttackCfg;
  const redDefenseTotal = decorationBoostRed + redDefenseCfg;
  const blueAttackTotal = decorationBoostBlue + blueAttackCfg;
  const blueDefenseTotal = decorationBoostBlue + blueDefenseCfg;

  // Select values based on chosen fight color
  const attackPct = Math.round(
    (isBlue ? blueAttackTotal : redAttackTotal) * 100,
  );
  const defensePct = Math.round(
    (isBlue ? blueDefenseTotal : redDefenseTotal) * 100,
  );
  const attackIcon = isBlue ? blueAttackIcon : redAttackIcon;
  const defenseIcon = isBlue ? blueDefenseIcon : redDefenseIcon;

  return (
    <header className="topbar">
      <ResourceStack items={resourceEntries} adminEnabled={adminEnabled} />
      <ResourceStack items={goodsEntries} adminEnabled={adminEnabled} />
      <ResourceStack items={unitEntries} adminEnabled={adminEnabled}>
        <div className="resource-line" title="Angriff Boost">
          <img src={attackIcon} alt="attack boost" />
          <span>{formatNumber(attackPct)}%</span>
        </div>
        <div className="resource-line" title="Verteidigung Boost">
          <img src={defenseIcon} alt="defense boost" />
          <span>{formatNumber(defensePct)}%</span>
        </div>
      </ResourceStack>

      <HappinessPanel stats={stats} happyInfo={happyInfo} />

      {/* Sync Config button - show when savefile config differs from user config */}
      {activeSaveConfig &&
        loadName &&
        (() => {
          const fields = [
            "extraCoins",
            "extraSupplies",
            "goodsStartBonus",
            "troopsStartBonus",
            "coinBoost",
            "supplyBoost",
          ];
          const differs = fields.some(
            (f) => (activeSaveConfig[f] ?? 0) !== (userConfig?.[f] ?? 0),
          );
          return differs ? (
            <button
              className="sync-config-btn"
              onClick={onSyncConfig}
              title="Savefile-Config mit deiner Config synchronisieren"
            >
              <RefreshCw size={16} />
              <span>Sync Config</span>
            </button>
          ) : null;
        })()}

      <SaveControls
        onSave={onSave}
        onLoad={onLoad}
        saves={saves}
        loadName={loadName}
        setLoadName={setLoadName}
        onDeleteSave={onDeleteSave}
        onOpenExport={onOpenExport}
        onOpenImport={onOpenImport}
        onOpenLoadSaves={onOpenLoadSaves}
      />

      <ViewControls
        adminMode={adminMode}
        onToggleAdmin={onToggleAdmin}
        editingLocked={editingLocked}
        onOpenHelp={onOpenHelp}
        onOpenAccount={onOpenAccount}
      />
    </header>
  );
}
