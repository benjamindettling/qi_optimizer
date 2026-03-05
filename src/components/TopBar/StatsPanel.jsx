// Stats panel for TopBar - resources, goods, army, happiness
import { useRef, useState, useEffect, useCallback } from "react";
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
import { useLang } from "../../context/LanguageContext";
import { T } from "../../i18n/translations";
import { getDisplayedShards, isShardLimitExceeded } from "../../utils/shards";

export function StatsPanel({
  resources,
  stats,
  happyInfo,
  adminMode,
  editingLocked,
  onEditResource,
  onEditGood,
  onEditUnit,
  config,
}) {
  const { lang } = useLang();
  const t = (key) => T[key]?.[lang] ?? T[key]?.DE ?? key;

  const containerRef = useRef(null);
  const innerRef = useRef(null);
  const [scale, setScale] = useState(1);

  const updateScale = useCallback(() => {
    if (!containerRef.current || !innerRef.current) return;
    const containerWidth = containerRef.current.offsetWidth;
    const contentWidth = innerRef.current.scrollWidth;

    if (contentWidth > containerWidth && containerWidth > 0) {
      setScale(Math.max(0.5, containerWidth / contentWidth));
    } else {
      setScale(1);
    }
  }, []);

  useEffect(() => {
    updateScale();

    if (!containerRef.current || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(updateScale);
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [updateScale]);

  const adminEnabled = adminMode && !editingLocked;
  const valueClassFor = (value) => ((value ?? 0) < 0 ? "text-negative" : "");
  const displayedShards = getDisplayedShards(resources.shards, config);
  const shardValueClass = isShardLimitExceeded(resources.shards)
    ? "text-negative"
    : "";

  const resourceEntries = [
    {
      key: "coins",
      label: t("resourceCoins"),
      icon: moneyIcon,
      value: resources.coins,
      valueClass: valueClassFor(resources.coins),
      onEdit: () =>
        onEditResource?.({
          key: "coins",
          label: t("resourceCoins"),
          icon: moneyIcon,
        }),
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
      value: displayedShards,
      valueClass: shardValueClass,
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
    <div className="stats-panel-container" ref={containerRef} data-tutorial-zone="topbar-stats">
      <div
        className="stats-panel"
        ref={innerRef}
        style={{
          transform: `scale(${scale})`,
          transformOrigin: "left center",
        }}
      >
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
      </div>
    </div>
  );
}

