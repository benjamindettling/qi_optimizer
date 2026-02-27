// Sidebar listing buildable items.
import { useEffect, useMemo, useState } from "react";
import { categories } from "../../config/categories";
import { ShopCard } from "./ShopCard";
import { useTutorialGate } from "../../hooks/useTutorialGate";
import "./ShopSidebar.css";

const FAVORITES_STORAGE_KEY = "qi_shopFavorites";

export function ShopSidebar({
  selectedCategory,
  setSelectedCategory,
  setSelectedBuildingId,
  resources,
  editingLocked = false,
  stats,
  infiniteResources = false,
  onResetModes,
  adminMode,
}) {
  const shopLocked = useTutorialGate("shop-panel");
  const [favorites, setFavorites] = useState(() => {
    if (typeof window === "undefined") return [];
    try {
      const raw = localStorage.getItem(FAVORITES_STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      console.error("Failed to read shop favorites", e);
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(favorites));
    } catch (e) {
      console.error("Failed to persist shop favorites", e);
    }
  }, [favorites]);

  const isTouchDevice =
    typeof window !== "undefined" && "ontouchstart" in window;
  const baseCategories = useMemo(
    () => categories.filter((c) => !c.hidden),
    [],
  );

  const catalogMap = useMemo(() => {
    const map = new Map();
    baseCategories.forEach((cat) => {
      cat.data.forEach((item) => {
        map.set(`${cat.key}:${item.id}`, item);
      });
    });
    return map;
  }, [baseCategories]);

  const favoriteEntries = favorites
    .map((defId) => ({ defId, item: catalogMap.get(defId) }))
    .filter((entry) => entry.item);

  const visibleCategories = [
    {
      key: "favorites",
      label: "Favoriten",
      iconEmoji: "?",
      entries: favoriteEntries,
    },
    ...baseCategories.map((cat) => ({
      ...cat,
      entries: cat.data.map((item) => ({
        item,
        defId: `${cat.key}:${item.id}`,
      })),
    })),
  ];

  const selectedCat =
    visibleCategories.find((c) => c.key === selectedCategory) ||
    visibleCategories[0];

  const favoriteSet = useMemo(() => new Set(favorites), [favorites]);

  const canBuild = (item) => {
    // Admin mode bypasses all checks
    if (adminMode || infiniteResources) return true;
    
    // Check resources
    const hasResources = 
      (resources.coins ?? 0) >= (item.cost.coins ?? 0) &&
      (resources.supplies ?? 0) >= (item.cost.supplies ?? 0) &&
      (resources.chronos ?? 0) >= (item.cost.chronos ?? 0);
    
    // Check population
    const hasPopulation = stats.people - stats.peopleReq >= (item.requiresPeople ?? 0);
    
    return hasResources && hasPopulation;
  };

  const handleSelect = (defId) => {
    setSelectedBuildingId?.(defId);
  };

  const handleToggleFavorite = (defId) => {
    setFavorites((prev) => {
      if (prev.includes(defId)) {
        return prev.filter((item) => item !== defId);
      }
      return [...prev, defId];
    });
  };

  return (
    <div className={`sidebar shop-sidebar${shopLocked ? " tutorial-zone-locked" : ""}`}>
      <div className="tabs">
        {visibleCategories.map((cat) => (
          <button
            key={cat.key}
            className={selectedCategory === cat.key ? "active" : ""}
            onClick={() => {
              setSelectedCategory(cat.key);
              setSelectedBuildingId(null);
              if (onResetModes) onResetModes();
            }}
            title={cat.label}
            aria-label={cat.label}
          >
            {cat.iconEmoji ? (
              <span className="tab-emoji" aria-hidden="true">
                {cat.iconEmoji}
              </span>
            ) : (
              <img src={cat.icon} alt={cat.label} />
            )}
          </button>
        ))}
      </div>

      <div className="shop">
        {selectedCat?.entries.map((entry) => {
          const buildable = !editingLocked && canBuild(entry.item);
          return (
            <ShopCard
              key={entry.defId}
              item={entry.item}
              defId={entry.defId}
              buildable={buildable}
              isTouchDevice={isTouchDevice}
              onSelect={handleSelect}
              onResetModes={onResetModes}
              isFavorite={favoriteSet.has(entry.defId)}
              onToggleFavorite={handleToggleFavorite}
            />
          );
        })}
      </div>
    </div>
  );
}
