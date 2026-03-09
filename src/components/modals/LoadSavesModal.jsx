import { useState, useRef, useEffect } from "react";
import {
  Edit2,
  Share2,
  Trash2,
  Download,
  Check,
  X,
  Settings,
} from "lucide-react";
import moneyIcon from "/money.webp";
import suppliesIcon from "/supplies.webp";
import goodsIcon from "/goods/Kupfer.webp";
import shardsIcon from "/shards.webp";
import attackIcon from "/fight/red_attack.webp";
import defenseIcon from "/fight/red_defense.webp";
import qaIcon from "/quantum_actions.webp";
import { useMemo } from "react";
import { SaveConfigModal } from "./SaveConfigModal";
import { QiInput } from "../common/QiInput";
import { useLang } from "../../context/LanguageContext";
import { T } from "../../i18n/translations";
import { getSavefileStatusColor } from "../../config/colors";
import { getSavefileSyncState } from "../../utils/saveConfig";
import { formatNumber } from "../../utils/formatNumber";
import { getOutsideQaPerHour } from "../../utils/qaAccounting";

export function LoadSavesModal({
  open,
  saves = {},
  onClose,
  onLoad,
  onRename,
  onDelete,
  onExport,
  onImport,
  onSaveConfig,
  loadName = "",
  hasUnsavedChanges = false,
  userConfig,
}) {
  const FINAL_STEP = 23;
  const QA_HOURS_PER_STEP = 12;
  const { lang } = useLang();
  const t = (key) => T[key]?.[lang] ?? T[key]?.DE ?? key;

  const [editingId, setEditingId] = useState(null);
  const [editingName, setEditingName] = useState("");
  const [deletingId, setDeletingId] = useState(null);
  const [configEditingName, setConfigEditingName] = useState(null);
  const [pendingLoadName, setPendingLoadName] = useState(null);
  const [showStats, setShowStats] = useState(true);
  const [cardStatsOverrides, setCardStatsOverrides] = useState({});
  const [searchTerm, setSearchTerm] = useState("");
  const dropzoneRef = useRef(null);
  const fileInputRef = useRef(null);

  const sortedNames = Object.keys(saves)
    .filter((name) => !saves[name]?.meta?.isSnapshot)
    .sort();
  const saveStatuses = useMemo(() => {
    const next = {};
    sortedNames.forEach((name) => {
      next[name] = getSavefileSyncState({
        saveEntry: saves?.[name],
        userConfig,
      });
    });
    return next;
  }, [sortedNames, saves, userConfig]);
  const filteredNames = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLocaleLowerCase();
    if (!normalizedSearch) return sortedNames;
    return sortedNames.filter((name) =>
      name.toLocaleLowerCase().includes(normalizedSearch),
    );
  }, [searchTerm, sortedNames]);

  const outsideQaTotalForDisplay = useMemo(() => {
    const outsidePerHour = getOutsideQaPerHour(userConfig);
    return FINAL_STEP * QA_HOURS_PER_STEP * outsidePerHour;
  }, [userConfig]);

  const valueOrDash = (value, suffix = "") => {
    if (!Number.isFinite(Number(value))) return "-";
    return `${formatNumber(Number(value))}${suffix}`;
  };

  const getCardDisplayStats = (name) => {
    const stats = saves?.[name]?.tree?.stats;
    if (!stats || typeof stats !== "object") return null;
    const minimum = stats.minimum ?? {};
    const final = stats.final ?? {};
    const qaSetup = Number(final.totalQaSetup);
    const qaTotalDisplay = Number.isFinite(qaSetup)
      ? qaSetup + outsideQaTotalForDisplay
      : null;
    return {
      minimum,
      final: {
        ...final,
        qaTotalDisplay,
      },
    };
  };

  useEffect(() => {
    if (!open) {
      setTimeout(() => {
        setEditingId(null);
        setEditingName("");
        setDeletingId(null);
        setConfigEditingName(null);
        setPendingLoadName(null);
        setShowStats(true);
        setCardStatsOverrides({});
        setSearchTerm("");
      }, 0);
    }
  }, [open]);

  const handleLoad = (name) => {
    if (name === loadName || !hasUnsavedChanges) {
      onLoad?.(name);
      return;
    }
    setPendingLoadName(name);
  };

  const confirmLoad = () => {
    if (pendingLoadName) {
      onLoad?.(pendingLoadName);
      setPendingLoadName(null);
    }
  };

  const cancelLoad = () => {
    setPendingLoadName(null);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (dropzoneRef.current) {
      dropzoneRef.current.classList.add("drag-active");
    }
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (dropzoneRef.current) {
      dropzoneRef.current.classList.remove("drag-active");
    }
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (dropzoneRef.current) {
      dropzoneRef.current.classList.remove("drag-active");
    }
    const files = e.dataTransfer.files;
    await handleFiles(files);
  };

  const handleFiles = async (files) => {
    const jsonFiles = Array.from(files).filter(
      (f) => f.type === "application/json" || f.name.endsWith(".json"),
    );
    if (jsonFiles.length === 0) return;

    try {
      for (const file of jsonFiles) {
        const text = await file.text();
        const data = JSON.parse(text);
        onImport?.([], data);
      }
    } catch (e) {
      console.error("Failed to import file", e);
      alert(t("loadSavesImportError"));
    }
  };

  const handleStartEdit = (name) => {
    setEditingId(name);
    setEditingName(name);
  };

  const handleConfirmRename = (oldName) => {
    const newName = editingName.trim();
    if (newName && newName !== oldName) {
      onRename?.(oldName, newName);
    }
    setEditingId(null);
    setEditingName("");
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditingName("");
  };

  const handleConfirmDelete = (name) => {
    onDelete?.(name);
    setDeletingId(null);
  };

  const handleExport = (name) => {
    onExport?.(name);
  };

  const handleCardClick = (name, event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    if (target.closest("button, input, textarea, select, a, label")) return;
    setCardStatsOverrides((prev) => {
      const hasOverride = Object.prototype.hasOwnProperty.call(prev, name);
      const currentlyShown = hasOverride ? !!prev[name] : showStats;
      return {
        ...prev,
        [name]: !currentlyShown,
      };
    });
  };

  const isCardStatsVisible = (name) =>
    Object.prototype.hasOwnProperty.call(cardStatsOverrides, name)
      ? !!cardStatsOverrides[name]
      : showStats;

  if (!open) return null;

  return (
    <div className="modal">
      <div className="modal-card load-saves-modal">
        <div className="help-header">
          <h3>{t("loadSavesTitle")}</h3>
          <button onClick={onClose} data-tutorial-zone="load-modal-close-btn">
            {t("loadSavesClose")}
          </button>
        </div>
        <div className="load-saves-toolbar">
          <button
            className={`load-saves-show-stats-btn ${showStats ? "active" : ""}`}
            onClick={() => setShowStats((prev) => !prev)}
          >
            {t("loadSavesShowStats")}
          </button>
          <QiInput
            mode="text"
            fullWidth
            className="load-saves-search-input"
            value={searchTerm}
            onChange={(nextValue) => setSearchTerm(nextValue)}
            placeholder={t("loadSavesSearchPlaceholder")}
            aria-label={t("loadSavesSearchAria")}
          />
        </div>

        <div className="load-saves-list">
          {filteredNames.length === 0 ? (
            <div className="load-saves-empty">{t("loadSavesEmpty")}</div>
          ) : (
            filteredNames.map((name) => (
              <div
                key={name}
                className="load-saves-row"
                onClick={(event) => handleCardClick(name, event)}
              >
                <div className="load-saves-row-top">
                  <button
                    className={`load-saves-main-button ${
                      name === loadName ? "active" : ""
                    }`}
                    onClick={() => handleLoad(name)}
                    data-tutorial-zone={name === loadName ? "load-main-btn" : undefined}
                  >
                    {editingId === name ? (
                      <div
                        className="load-saves-edit-container"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <QiInput
                          mode="text"
                          fullWidth
                          className="load-saves-edit-input"
                          value={editingName}
                          onChange={(nextValue) => setEditingName(nextValue)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              handleConfirmRename(name);
                            } else if (e.key === "Escape") {
                              handleCancelEdit();
                            }
                          }}
                          autoFocus
                        />
                        <button
                          className="load-saves-edit-confirm"
                          onClick={() => handleConfirmRename(name)}
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
                      <span
                        className="load-saves-name"
                        style={{ color: getSavefileStatusColor(saveStatuses[name]) }}
                      >
                        {name}
                      </span>
                    )}
                  </button>

                  {editingId !== name && (
                    <div className="load-saves-actions">
                      <button
                        className="load-saves-action-btn settings-btn"
                        onClick={() => setConfigEditingName(name)}
                        title={t("loadSavesBtnSaveConfig")}
                        data-tutorial-zone={name === loadName ? "load-config-btn" : undefined}
                      >
                        <Settings size={16} />
                      </button>
                      <button
                        className="load-saves-action-btn edit-btn"
                        onClick={() => handleStartEdit(name)}
                        title={t("loadSavesBtnRename")}
                        data-tutorial-zone={name === loadName ? "load-rename-btn" : undefined}
                      >
                        <Edit2 size={16} />
                      </button>
                      <button
                        className="load-saves-action-btn export-btn"
                        onClick={() => handleExport(name)}
                        title={t("loadSavesBtnExport")}
                        data-tutorial-zone={name === loadName ? "load-export-btn" : undefined}
                      >
                        <Share2 size={16} />
                      </button>
                      <button
                        className="load-saves-action-btn delete-btn"
                        onClick={() => setDeletingId(name)}
                        title={t("loadSavesBtnDelete")}
                        data-tutorial-zone={name === loadName ? "load-delete-btn" : undefined}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  )}
                </div>
                {isCardStatsVisible(name) && (
                  <div className="load-saves-stats">
                    {(() => {
                      const cardStats = getCardDisplayStats(name);
                      const minimum = cardStats?.minimum ?? {};
                      const final = cardStats?.final ?? {};
                      return (
                        <>
                          <div className="load-saves-stats-col">
                            <div className="load-saves-stats-title minimum">
                              {t("loadSavesStatsMinimum")}
                            </div>
                            <div className="load-saves-stats-line" title={t("loadSavesStatsMoney")}>
                              <img src={moneyIcon} alt={t("loadSavesStatsMoney")} className="load-saves-stat-icon" />
                              <strong>{valueOrDash(minimum.money)}</strong>
                            </div>
                            <div className="load-saves-stats-line" title={t("loadSavesStatsSupplies")}>
                              <img src={suppliesIcon} alt={t("loadSavesStatsSupplies")} className="load-saves-stat-icon" />
                              <strong>{valueOrDash(minimum.supplies)}</strong>
                            </div>
                            <div className="load-saves-stats-line" title={t("loadSavesStatsGoods")}>
                              <img src={goodsIcon} alt={t("loadSavesStatsGoods")} className="load-saves-stat-icon" />
                              <strong>{valueOrDash(minimum.goods)}</strong>
                            </div>
                            <div className="load-saves-stats-line" title={t("loadSavesStatsShardsUsed")}>
                              <img src={shardsIcon} alt={t("loadSavesStatsShardsUsed")} className="load-saves-stat-icon" />
                              <strong>{valueOrDash(minimum.shardsUsed)}</strong>
                            </div>
                          </div>
                          <div className="load-saves-stats-col">
                            <div className="load-saves-stats-title final">
                              {t("loadSavesStatsFinal")}
                            </div>
                            <div className="load-saves-stats-line" title={t("loadSavesStatsAttack")}>
                              <img src={attackIcon} alt={t("loadSavesStatsAttack")} className="load-saves-stat-icon" />
                              <strong>{valueOrDash(final.attack, "%")}</strong>
                            </div>
                            <div className="load-saves-stats-line" title={t("loadSavesStatsDefense")}>
                              <img src={defenseIcon} alt={t("loadSavesStatsDefense")} className="load-saves-stat-icon" />
                              <strong>{valueOrDash(final.defense, "%")}</strong>
                            </div>
                            <div className="load-saves-stats-line" title={t("loadSavesStatsTotalQa")}>
                              <img src={qaIcon} alt={t("loadSavesStatsTotalQa")} className="load-saves-stat-icon" />
                              <strong>{valueOrDash(final.qaTotalDisplay)}</strong>
                            </div>
                          </div>
                        </>
                      );
                    })()}
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        <div
          ref={dropzoneRef}
          className="load-saves-dropzone"
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <Download size={20} />
          <div className="dropzone-content">{t("loadSavesImportHint")}</div>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json"
            style={{ display: "none" }}
            onChange={(e) => handleFiles(e.target.files)}
          />
        </div>
      </div>

      {deletingId && (
        <div className="modal modal-overlay">
          <div className="modal-card modal-confirm-delete">
            <div className="help-header">
              <h3>{t("loadSavesDeleteTitle")}</h3>
            </div>
            <div className="modal-body">
              <p>{t("loadSavesDeletePrompt").replace("{name}", deletingId)}</p>
            </div>
            <div className="modal-actions">
              <button
                className="btn-confirm-delete"
                onClick={() => handleConfirmDelete(deletingId)}
              >
                {t("loadSavesBtnDelete")}
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

      {pendingLoadName && (
        <div className="modal modal-overlay">
          <div className="modal-card modal-confirm-delete">
            <div className="help-header">
              <h3>{t("loadSavesUnsavedTitle")}</h3>
            </div>
            <div className="modal-body">
              <p>{t("loadSavesUnsavedPrompt").replace("{name}", pendingLoadName)}</p>
            </div>
            <div className="modal-actions">
              <button className="btn-confirm-delete" onClick={confirmLoad}>
                {t("loadSavesSwitch")}
              </button>
              <button className="btn-cancel-delete" onClick={cancelLoad}>
                {t("loadSavesBtnCancel")}
              </button>
            </div>
          </div>
        </div>
      )}

      <SaveConfigModal
        open={!!configEditingName}
        saveName={configEditingName}
        saveEntry={configEditingName ? saves[configEditingName] : null}
        saveConfig={
          configEditingName ? saves[configEditingName]?.saveConfig : null
        }
        userConfig={userConfig}
        onClose={() => setConfigEditingName(null)}
        onSave={(newConfig, options) => {
          if (configEditingName) {
            onSaveConfig?.(configEditingName, newConfig, options);
          }
        }}
      />
    </div>
  );
}

