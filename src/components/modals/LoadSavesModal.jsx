import { useState, useRef, useEffect, useMemo } from "react";
import { Download, Upload } from "lucide-react";
import { QiInput } from "../common/QiInput";
import { SavefileCard } from "../common/SavefileCard";
import { useLang } from "../../context/LanguageContext";
import { T } from "../../i18n/translations";
import {
  extractSaveConfig,
  getSavefileSyncState,
} from "../../utils/saveConfig";
import { getOutsideQaPerHour } from "../../utils/qaAccounting";

export function LoadSavesModal({
  open,
  saves = {},
  onClose,
  onLoad,
  onRename,
  onDelete,
  onExport,
  onUploadShared,
  canUploadShared = false,
  onImport,
  loadName = "",
  hasUnsavedChanges = false,
  userConfig,
}) {
  const FINAL_STEP = 23;
  const QA_HOURS_PER_STEP = 12;
  const { lang } = useLang();
  const t = (key) => T[key]?.[lang] ?? T[key]?.DE ?? key;

  const [deletingId, setDeletingId] = useState(null);
  const [pendingLoadName, setPendingLoadName] = useState(null);
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

  const minimumViolationsFor = useMemo(() => {
    const cfg = extractSaveConfig(userConfig);
    const result = {};
    sortedNames.forEach((name) => {
      const stats = saves?.[name]?.stats ?? saves?.[name]?.tree?.stats;
      const minimum = stats?.minimum ?? {};
      result[name] = {
        money: (cfg.extraCoins ?? 0) < (Number(minimum.money) || 0),
        supplies: (cfg.extraSupplies ?? 0) < (Number(minimum.supplies) || 0),
        goods: (cfg.goodsStartBonus ?? 0) < (Number(minimum.goods) || 0),
        shardsUsed: (cfg.shardsLimit ?? 0) < (Number(minimum.shardsUsed) || 0),
      };
    });
    return result;
  }, [sortedNames, saves, userConfig]);

  const getCardDisplayStats = (name) => {
    const stats = saves?.[name]?.stats ?? saves?.[name]?.tree?.stats;
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
        setDeletingId(null);
        setPendingLoadName(null);
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

  const handleConfirmDelete = (name) => {
    onDelete?.(name);
    setDeletingId(null);
  };

  const handleUploadShared = async (name) => {
    await onUploadShared?.(name);
  };

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
          <QiInput
            mode="text"
            fullWidth
            className="load-saves-search-input"
            value={searchTerm}
            onChange={(nextValue) => setSearchTerm(nextValue)}
            placeholder={t("loadSavesSearchPlaceholder")}
            aria-label={t("loadSavesSearchAria")}
          />
          {canUploadShared && (
            <button
              className="load-saves-upload-btn"
              onClick={() => {
                const active = sortedNames.find((n) => n === loadName);
                if (active) handleUploadShared(active);
              }}
              disabled={!loadName}
              title={t("loadSavesBtnUpload")}
            >
              <Upload size={16} />
            </button>
          )}
        </div>

        <div className="load-saves-list">
          {filteredNames.length === 0 ? (
            <div className="load-saves-empty">{t("loadSavesEmpty")}</div>
          ) : (
            filteredNames.map((name) => {
              const cardStats = getCardDisplayStats(name);
              return (
                <SavefileCard
                  key={name}
                  title={name}
                  isOwned
                  impossible={saveStatuses[name] === "impossible"}
                  stats={cardStats}
                  minimumViolations={minimumViolationsFor[name]}
                  onLoad={() => handleLoad(name)}
                  onRename={(newName) => onRename?.(name, newName)}
                  onExport={() => onExport?.(name)}
                  onDelete={() => setDeletingId(name)}
                />
              );
            })
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
              <p>
                {t("loadSavesUnsavedPrompt").replace("{name}", pendingLoadName)}
              </p>
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
    </div>
  );
}
