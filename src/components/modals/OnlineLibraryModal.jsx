import { useState, useEffect, useMemo, useCallback } from "react";
import {
  Download,
  Edit2,
  Trash2,
  Check,
  X,
  ChevronDown,
  ChevronUp,
  RefreshCw,
} from "lucide-react";
import { QiInput } from "../common/QiInput";
import { SaveStatsDisplay } from "../common/SaveStatsDisplay";
import { useLang } from "../../context/LanguageContext";
import { T } from "../../i18n/translations";
import { useAuth } from "../../auth/AuthProvider";
import {
  listNewestSharedSaves,
  downloadSharedSave,
  renameSharedSave,
  deleteSharedSave,
  findOwnSharedSaveByTitle,
} from "../../firebase/sharedSaves";
import "./OnlineLibraryModal.css";

const SORT_MODES = [
  { key: "newest", field: "uploadedAt", dir: "desc" },
  { key: "highestQa", field: "finalTotalQaSetup", dir: "desc" },
  { key: "lowestShards", field: "minShardsUsed", dir: "asc" },
  { key: "highestAttack", field: "finalAttack", dir: "desc" },
  { key: "highestDefense", field: "finalDefense", dir: "desc" },
];

const SORT_LABEL_KEYS = {
  newest: "onlineLibrarySortNewest",
  highestQa: "onlineLibrarySortHighestQa",
  lowestShards: "onlineLibrarySortLowestShards",
  highestAttack: "onlineLibrarySortHighestAttack",
  highestDefense: "onlineLibrarySortHighestDefense",
};

const MIN_FILTER_FIELDS = [
  { key: "minMoney", labelKey: "loadSavesStatsMoney" },
  { key: "minSupplies", labelKey: "loadSavesStatsSupplies" },
  { key: "minGoods", labelKey: "loadSavesStatsGoods" },
  { key: "minTroops", labelKey: "loadSavesStatsTroops" },
  { key: "minCoinBoost", labelKey: "loadSavesStatsCoinBoost" },
  { key: "minSupplyBoost", labelKey: "loadSavesStatsSupplyBoost" },
  { key: "minShardsUsed", labelKey: "loadSavesStatsShardsUsed" },
];

const FINAL_FILTER_FIELDS = [
  { key: "finalAttack", labelKey: "loadSavesStatsAttack" },
  { key: "finalDefense", labelKey: "loadSavesStatsDefense" },
  { key: "finalTotalQaSetup", labelKey: "loadSavesStatsTotalQa" },
];

function toFinite(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function formatDate(ts) {
  if (!ts) return "-";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  if (isNaN(d.getTime())) return "-";
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

export function OnlineLibraryModal({ open, onClose }) {
  const { lang } = useLang();
  const t = useCallback((key) => T[key]?.[lang] ?? T[key]?.DE ?? key, [lang]);
  const { user } = useAuth();
  const currentUid = user?.uid ?? null;

  // Data state
  const [saves, setSaves] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Sort & filter state
  const [sortMode, setSortMode] = useState("newest");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filters, setFilters] = useState({});

  // Card interaction state
  const [editingId, setEditingId] = useState(null);
  const [editingName, setEditingName] = useState("");
  const [deletingId, setDeletingId] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const setFilterValue = useCallback((key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }, []);

  // Fetch saves when modal opens
  const fetchSaves = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await listNewestSharedSaves(100);
      setSaves(result);
    } catch (err) {
      console.error("Failed to load shared saves", err);
      setError(err.message || "Unknown error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      fetchSaves();
    } else {
      // Reset state on close
      setTimeout(() => {
        setSaves([]);
        setError(null);
        setLoading(false);
        setSortMode("newest");
        setFiltersOpen(false);
        setSearchTerm("");
        setFilters({});
        setEditingId(null);
        setEditingName("");
        setDeletingId(null);
        setBusyId(null);
      }, 0);
    }
  }, [open, fetchSaves]);

  // Filtered + sorted saves
  const displaySaves = useMemo(() => {
    let list = [...saves];

    // Search by title or username
    const normalizedSearch = searchTerm.trim().toLowerCase();
    if (normalizedSearch) {
      list = list.filter(
        (s) =>
          (s.title ?? "").toLowerCase().includes(normalizedSearch) ||
          (s.ownerUsername ?? "").toLowerCase().includes(normalizedSearch),
      );
    }

    // Apply min-requirement filters (save visible if its value <= user threshold)
    for (const { key } of MIN_FILTER_FIELDS) {
      const threshold = toFinite(filters[key]);
      if (threshold !== null) {
        list = list.filter((s) => {
          const val = toFinite(s[key]);
          return val === null || val <= threshold;
        });
      }
    }

    // Apply final-stat filters (save visible if its value >= user threshold)
    for (const { key } of FINAL_FILTER_FIELDS) {
      const threshold = toFinite(filters[key]);
      if (threshold !== null) {
        list = list.filter((s) => {
          const val = toFinite(s[key]);
          return val !== null && val >= threshold;
        });
      }
    }

    // Sort
    const mode = SORT_MODES.find((m) => m.key === sortMode) ?? SORT_MODES[0];
    list.sort((a, b) => {
      let aVal, bVal;
      if (mode.field === "uploadedAt") {
        aVal = a.uploadedAt?.toMillis?.() ?? a.uploadedAt ?? 0;
        bVal = b.uploadedAt?.toMillis?.() ?? b.uploadedAt ?? 0;
      } else {
        aVal = toFinite(a[mode.field]) ?? 0;
        bVal = toFinite(b[mode.field]) ?? 0;
      }
      return mode.dir === "desc" ? bVal - aVal : aVal - bVal;
    });

    return list;
  }, [saves, searchTerm, filters, sortMode]);

  // ---- Actions ----

  const handleDownload = useCallback(
    async (save) => {
      if (busyId) return;
      setBusyId(save.id);
      try {
        const parsed = await downloadSharedSave(save.id);
        const blob = new Blob([JSON.stringify(parsed, null, 2)], {
          type: "application/json",
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${save.title || "setup"}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } catch (err) {
        console.error("Download failed", err);
        alert(t("onlineLibraryDownloadError"));
      } finally {
        setBusyId(null);
      }
    },
    [busyId, t],
  );

  const handleStartEdit = useCallback((save) => {
    setEditingId(save.id);
    setEditingName(save.title || "");
  }, []);

  const handleCancelEdit = useCallback(() => {
    setEditingId(null);
    setEditingName("");
  }, []);

  const handleConfirmRename = useCallback(
    async (save) => {
      const newTitle = editingName.trim();
      if (!newTitle || newTitle === save.title) {
        handleCancelEdit();
        return;
      }
      if (!currentUid) return;

      setBusyId(save.id);
      try {
        // Check for duplicate title
        const existing = await findOwnSharedSaveByTitle({
          ownerUid: currentUid,
          title: newTitle,
        });
        if (existing && existing.id !== save.id) {
          alert(t("onlineLibraryRenameExists"));
          setBusyId(null);
          return;
        }

        await renameSharedSave({
          saveId: save.id,
          ownerUid: currentUid,
          newTitle,
        });

        // Optimistic update
        setSaves((prev) =>
          prev.map((s) =>
            s.id === save.id
              ? { ...s, title: newTitle, titleLower: newTitle.toLowerCase() }
              : s,
          ),
        );
        handleCancelEdit();
      } catch (err) {
        console.error("Rename failed", err);
        alert(t("onlineLibraryRenameError"));
      } finally {
        setBusyId(null);
      }
    },
    [editingName, currentUid, handleCancelEdit, t],
  );

  const handleConfirmDelete = useCallback(
    async (save) => {
      if (!currentUid) return;
      setBusyId(save.id);
      try {
        await deleteSharedSave({ saveId: save.id, ownerUid: currentUid });
        setSaves((prev) => prev.filter((s) => s.id !== save.id));
        setDeletingId(null);
      } catch (err) {
        console.error("Delete failed", err);
        alert(t("onlineLibraryDeleteError"));
      } finally {
        setBusyId(null);
      }
    },
    [currentUid, t],
  );

  // ---- Helpers ----

  const isOwner = useCallback(
    (save) => currentUid && save.ownerUid === currentUid,
    [currentUid],
  );

  const statsForSave = useCallback((save) => {
    return {
      minimum: {
        money: save.minMoney,
        supplies: save.minSupplies,
        goods: save.minGoods,
        shardsUsed: save.minShardsUsed,
        troops: save.minTroops,
        coinBoost: save.minCoinBoost,
        supplyBoost: save.minSupplyBoost,
      },
      final: {
        attack: save.finalAttack,
        defense: save.finalDefense,
        totalQaSetup: save.finalTotalQaSetup,
      },
    };
  }, []);

  if (!open) return null;

  const deletingSave = deletingId
    ? saves.find((s) => s.id === deletingId)
    : null;

  return (
    <div className="modal">
      <div className="modal-card online-library-modal">
        {/* Header */}
        <div className="help-header">
          <h3>{t("onlineLibraryTitle")}</h3>
          <button onClick={onClose}>{t("onlineLibraryClose")}</button>
        </div>

        {/* Toolbar: search + sort + filter toggle */}
        <div className="online-library-toolbar">
          <QiInput
            mode="text"
            fullWidth
            className="online-library-search"
            value={searchTerm}
            onChange={setSearchTerm}
            placeholder={t("onlineLibrarySearchPlaceholder")}
            aria-label={t("onlineLibrarySearchPlaceholder")}
          />
          <div className="online-library-sort-group">
            <label className="online-library-sort-label" htmlFor="online-sort">
              {t("onlineLibrarySortLabel")}
            </label>
            <select
              id="online-sort"
              className="online-library-sort-select"
              value={sortMode}
              onChange={(e) => setSortMode(e.target.value)}
            >
              {SORT_MODES.map((m) => (
                <option key={m.key} value={m.key}>
                  {t(SORT_LABEL_KEYS[m.key])}
                </option>
              ))}
            </select>
          </div>
          <button
            className={`online-library-filter-toggle ${filtersOpen ? "active" : ""}`}
            onClick={() => setFiltersOpen((prev) => !prev)}
          >
            {t("onlineLibraryFilterTitle")}
            {filtersOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
          <button
            className="online-library-refresh-btn"
            onClick={fetchSaves}
            disabled={loading}
            title={t("onlineLibraryRetry")}
          >
            <RefreshCw size={16} className={loading ? "spinning" : ""} />
          </button>
        </div>

        {/* Filter section */}
        {filtersOpen && (
          <div className="online-library-filters">
            <div className="online-library-filter-group">
              <div className="online-library-filter-group-title">
                {t("onlineLibraryFilterMinLabel")}
              </div>
              <div className="online-library-filter-grid">
                {MIN_FILTER_FIELDS.map(({ key, labelKey }) => (
                  <div key={key} className="online-library-filter-field">
                    <label className="online-library-filter-label">
                      {t(labelKey)}
                    </label>
                    <QiInput
                      mode="number"
                      className="online-library-filter-input"
                      value={filters[key] ?? ""}
                      onChange={(v) =>
                        setFilterValue(key, v === 0 && !filters[key] ? "" : v)
                      }
                      min={0}
                      allowNegative={false}
                      placeholder="-"
                    />
                  </div>
                ))}
              </div>
            </div>
            <div className="online-library-filter-group">
              <div className="online-library-filter-group-title">
                {t("onlineLibraryFilterFinalLabel")}
              </div>
              <div className="online-library-filter-grid">
                {FINAL_FILTER_FIELDS.map(({ key, labelKey }) => (
                  <div key={key} className="online-library-filter-field">
                    <label className="online-library-filter-label">
                      {t(labelKey)}
                    </label>
                    <QiInput
                      mode="number"
                      className="online-library-filter-input"
                      value={filters[key] ?? ""}
                      onChange={(v) =>
                        setFilterValue(key, v === 0 && !filters[key] ? "" : v)
                      }
                      min={0}
                      allowNegative={false}
                      placeholder="-"
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Save list */}
        <div className="online-library-list">
          {loading && saves.length === 0 && (
            <div className="online-library-status">
              {t("onlineLibraryLoading")}
            </div>
          )}
          {error && (
            <div className="online-library-status online-library-error">
              <span>{t("onlineLibraryError")}</span>
              <button className="online-library-retry-btn" onClick={fetchSaves}>
                {t("onlineLibraryRetry")}
              </button>
            </div>
          )}
          {!loading && !error && displaySaves.length === 0 && (
            <div className="online-library-status">
              {t("onlineLibraryEmpty")}
            </div>
          )}
          {displaySaves.map((save) => {
            const owner = isOwner(save);
            const busy = busyId === save.id;
            const stats = statsForSave(save);
            return (
              <div key={save.id} className="online-library-card">
                <div className="online-library-card-top">
                  {editingId === save.id ? (
                    <div
                      className="load-saves-edit-container"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <QiInput
                        mode="text"
                        fullWidth
                        className="load-saves-edit-input"
                        value={editingName}
                        onChange={setEditingName}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleConfirmRename(save);
                          else if (e.key === "Escape") handleCancelEdit();
                        }}
                        autoFocus
                      />
                      <button
                        className="load-saves-edit-confirm"
                        onClick={() => handleConfirmRename(save)}
                        disabled={busy}
                        title={t("loadSavesBtnConfirm")}
                      >
                        <Check size={16} />
                      </button>
                      <button
                        className="load-saves-edit-cancel"
                        onClick={handleCancelEdit}
                        title={t("loadSavesBtnCancel")}
                      >
                        <X size={16} />
                      </button>
                    </div>
                  ) : (
                    <div className="online-library-card-info">
                      <span className="online-library-card-title">
                        {save.title}
                      </span>
                      <span className="online-library-card-meta">
                        {t("onlineLibraryUploadedBy")}{" "}
                        <strong>{save.ownerUsername || "?"}</strong>
                        {" · "}
                        {formatDate(save.updatedAt ?? save.uploadedAt)}
                      </span>
                    </div>
                  )}

                  {editingId !== save.id && (
                    <div className="online-library-card-actions">
                      <button
                        className="load-saves-action-btn export-btn"
                        onClick={() => handleDownload(save)}
                        disabled={busy}
                        title={t("onlineLibraryBtnDownload")}
                      >
                        <Download size={16} />
                      </button>
                      {owner && (
                        <>
                          <button
                            className="load-saves-action-btn edit-btn"
                            onClick={() => handleStartEdit(save)}
                            disabled={busy}
                            title={t("onlineLibraryBtnRename")}
                          >
                            <Edit2 size={16} />
                          </button>
                          <button
                            className="load-saves-action-btn delete-btn"
                            onClick={() => setDeletingId(save.id)}
                            disabled={busy}
                            title={t("onlineLibraryBtnDelete")}
                          >
                            <Trash2 size={16} />
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>
                <SaveStatsDisplay
                  minimum={stats.minimum}
                  final={stats.final}
                  showExtended
                />
              </div>
            );
          })}
        </div>
      </div>

      {/* Delete confirmation */}
      {deletingSave && (
        <div className="modal modal-overlay">
          <div className="modal-card modal-confirm-delete">
            <div className="help-header">
              <h3>{t("onlineLibraryBtnDelete")}</h3>
            </div>
            <div className="modal-body">
              <p>
                {t("onlineLibraryDeletePrompt").replace(
                  "{name}",
                  deletingSave.title,
                )}
              </p>
            </div>
            <div className="modal-actions">
              <button
                className="btn-confirm-delete"
                onClick={() => handleConfirmDelete(deletingSave)}
                disabled={busyId === deletingSave.id}
              >
                {t("onlineLibraryBtnDelete")}
              </button>
              <button
                className="btn-cancel-delete"
                onClick={() => setDeletingId(null)}
              >
                {t("loadSavesBtnCancel")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
