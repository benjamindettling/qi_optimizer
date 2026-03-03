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
import { getGoodIconPath } from "../../utils/goodsIconPath";
import { HappinessPanel } from "./HappinessPanel";
import { ResourceStack } from "./ResourceStack";
import { ViewControls } from "./ViewControls";
import { SaveControls } from "./SaveControls";
import { useLang } from "../../context/LanguageContext";
import { T } from "../../i18n/translations";
import { useTutorialGate } from "../../hooks/useTutorialGate";
import "./TopBar.css";

export function TopBar({
  resources,
  stats,
  happyInfo,
  viewMode,
  setViewMode,
  adminMode,
  onToggleAdmin,
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
  void viewMode;
  void setViewMode;

  const { lang } = useLang();
  const t = (key) => T[key]?.[lang] ?? T[key]?.DE ?? key;
  const topbarLocked = useTutorialGate("topbar");

  const adminEnabled = adminMode && !editingLocked;
  const valueClassFor = (value) => ((value ?? 0) < 0 ? "text-negative" : "");

  const resourceEntries = [
    {
      key: "coins",
      label: t("resourceCoins"),
      icon: moneyIcon,
      value: resources.coins,
      valueClass: valueClassFor(resources.coins),
      onEdit: () =>
        onEditResource?.({ key: "coins", label: t("resourceCoins"), icon: moneyIcon }),
    },
    {
      key: "supplies",
      label: t("resourceSupplies"),
      icon: suppliesIcon,
      value: resources.supplies,
      valueClass: valueClassFor(resources.supplies),
      onEdit: () =>
        onEditResource?.({
          key: "supplies",
          label: t("resourceSupplies"),
          icon: suppliesIcon,
        }),
    },
    {
      key: "chronos",
      label: t("resourceChronos"),
      icon: chronosIcon,
      value: resources.chronos,
      valueClass: valueClassFor(resources.chronos),
      onEdit: () =>
        onEditResource?.({
          key: "chronos",
          label: t("resourceChronos"),
          icon: chronosIcon,
        }),
    },
    {
      key: "shards",
      label: t("resourceShards"),
      icon: shardsIcon,
      value: resources.shards,
      valueClass: valueClassFor(resources.shards),
      onEdit: () =>
        onEditResource?.({
          key: "shards",
          label: t("resourceShards"),
          icon: shardsIcon,
        }),
    },
    {
      key: "quantumActions",
      label: t("resourceQA"),
      icon: qaIcon,
      value: resources.quantumActions,
      valueClass: valueClassFor(resources.quantumActions),
      title: `QA/h: ${formatNumber(stats.qaPerHour ?? 0)}`,
      onEdit: () =>
        onEditResource?.({
          key: "quantumActions",
          label: t("resourceQA"),
          icon: qaIcon,
        }),
    },
  ];

  const goodsEntries = GOODS_TYPES.map((g) => ({
    key: g,
    label: g,
    icon: getGoodIconPath(g),
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

  const fightColor = config?.fightColor ?? "rot";
  const isBlue = fightColor === "blau";

  const decorationBoostRed = stats.armyBoostRed ?? 0;
  const decorationBoostBlue = stats.armyBoostBlue ?? 0;

  const redAttackCfg = Number(config?.redAttackBoost ?? 0) / 100;
  const redDefenseCfg = Number(config?.redDefenseBoost ?? 0) / 100;
  const blueAttackCfg = Number(config?.blueAttackBoost ?? 0) / 100;
  const blueDefenseCfg = Number(config?.blueDefenseBoost ?? 0) / 100;

  const redAttackTotal = decorationBoostRed + redAttackCfg;
  const redDefenseTotal = decorationBoostRed + redDefenseCfg;
  const blueAttackTotal = decorationBoostBlue + blueAttackCfg;
  const blueDefenseTotal = decorationBoostBlue + blueDefenseCfg;

  const attackPct = Math.round((isBlue ? blueAttackTotal : redAttackTotal) * 100);
  const defensePct = Math.round(
    (isBlue ? blueDefenseTotal : redDefenseTotal) * 100,
  );
  const attackIcon = isBlue ? blueAttackIcon : redAttackIcon;
  const defenseIcon = isBlue ? blueDefenseIcon : redDefenseIcon;

  return (
    <header className={`topbar${topbarLocked ? " tutorial-zone-locked" : ""}`}>
      <ResourceStack items={resourceEntries} adminEnabled={adminEnabled} />
      <ResourceStack items={goodsEntries} adminEnabled={adminEnabled} />
      <ResourceStack items={unitEntries} adminEnabled={adminEnabled}>
        <div className="resource-line" title={t("attackBoostLabel")}>
          <img src={attackIcon} alt="attack boost" />
          <span>{formatNumber(attackPct)}%</span>
        </div>
        <div className="resource-line" title={t("defenseBoostLabel")}>
          <img src={defenseIcon} alt="defense boost" />
          <span>{formatNumber(defensePct)}%</span>
        </div>
      </ResourceStack>

      <HappinessPanel stats={stats} happyInfo={happyInfo} />

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
            <button className="sync-config-btn" onClick={onSyncConfig} title={t("syncConfigTitle")}>
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

