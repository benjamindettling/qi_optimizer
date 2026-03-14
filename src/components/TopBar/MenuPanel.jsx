// Menu panel for TopBar - Save, Load, Upload, Admin, Settings, Online
import {
  Save,
  FolderOpen,
  Upload,
  Sparkle,
  Settings,
  Globe,
} from "lucide-react";
import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useLang } from "../../context/LanguageContext";
import { T } from "../../i18n/translations";
import { QiInput } from "../common/QiInput";
import { SavefileCard } from "../common/SavefileCard";
import { getOutsideQaPerHour } from "../../utils/qaAccounting";

export function MenuPanel({
  onSave,
  onLoad,
  saves = {},
  loadName,
  setLoadName,
  onDeleteSave,
  onOpenExport,
  onOpenImport,
  onOpenLoadSaves,
  onOpenOnlineLibrary,
  onUploadShared,
  canUploadShared = false,
  userConfig,
  currentUsername = "",
  adminMode,
  editingLocked,
  onToggleAdmin,
  onOpenSettings,
  onStartTutorial,
  hasUnsavedChanges,
}) {
  const { lang } = useLang();
  const t = (key) => T[key]?.[lang] ?? T[key]?.DE ?? key;
  const adminActive = adminMode && !editingLocked;
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [uploadOverwriteOpen, setUploadOverwriteOpen] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);
  const [saveNameDraft, setSaveNameDraft] = useState("");

  const existingSaveNames = useMemo(
    () =>
      Object.keys(saves || {})
        .filter((name) => !saves?.[name]?.meta?.isSnapshot)
        .sort(),
    [saves],
  );
  const trimmedSaveName = saveNameDraft.trim();
  const saveNameExists = trimmedSaveName
    ? Object.prototype.hasOwnProperty.call(saves || {}, trimmedSaveName) &&
      !saves?.[trimmedSaveName]?.meta?.isSnapshot
    : false;

  const openSaveModal = () => {
    setSaveNameDraft(loadName || "");
    setSaveModalOpen(true);
  };

  const closeSaveModal = () => {
    setSaveModalOpen(false);
  };

  const handleConfirmSave = () => {
    if (!trimmedSaveName) return;
    onSave?.(trimmedSaveName);
    closeSaveModal();
  };

  const currentSaveEntry = loadName ? saves?.[loadName] : null;
  const currentSaveStats =
    currentSaveEntry?.stats ?? currentSaveEntry?.tree?.stats ?? null;
  const outsideQaPerHour = getOutsideQaPerHour(userConfig);
  const outsideQaTotal = 23 * 12 * outsideQaPerHour;
  const uploadPreviewStats = currentSaveStats
    ? {
        minimum: currentSaveStats.minimum ?? {},
        final: {
          ...(currentSaveStats.final ?? {}),
          qaTotalDisplay: Number.isFinite(
            Number(currentSaveStats?.final?.totalQaSetup),
          )
            ? Number(currentSaveStats.final.totalQaSetup) + outsideQaTotal
            : null,
        },
      }
    : { minimum: {}, final: {} };

  const openUploadModal = () => {
    if (!canUploadShared || !loadName) return;
    setUploadModalOpen(true);
  };

  const closeUploadModal = () => {
    setUploadModalOpen(false);
  };

  const closeUploadOverwriteModal = () => {
    setUploadOverwriteOpen(false);
  };

  const closeUploadResultModal = () => {
    setUploadResult(null);
  };

  const uploadErrorMessage = (code) => {
    switch (code) {
      case "AUTH_REQUIRED":
        return t("uploadErrorAuth");
      case "SAVE_NOT_FOUND":
      case "MISSING_NAME":
        return t("uploadErrorNoSave");
      case "USERNAME_MISSING":
        return t("uploadErrorNoUsername");
      default:
        return t("uploadErrorGeneric");
    }
  };

  const handleConfirmUpload = async () => {
    if (!loadName) return;
    const result = await onUploadShared?.(loadName, { overwrite: false });

    if (result?.status === "needs-overwrite") {
      setUploadModalOpen(false);
      setUploadOverwriteOpen(true);
      return;
    }

    setUploadModalOpen(false);

    if (result?.status === "success") {
      setUploadResult({
        title:
          result.action === "overwritten"
            ? t("uploadResultOverwrittenTitle")
            : t("uploadResultUploadedTitle"),
        body:
          result.action === "overwritten"
            ? t("uploadResultOverwrittenBody").replace("{name}", loadName)
            : t("uploadResultUploadedBody").replace("{name}", loadName),
      });
      return;
    }

    setUploadResult({
      title: t("uploadErrorTitle"),
      body: uploadErrorMessage(result?.code),
    });
  };

  const handleConfirmOverwriteUpload = async () => {
    if (!loadName) return;
    const result = await onUploadShared?.(loadName, { overwrite: true });
    setUploadOverwriteOpen(false);

    if (result?.status === "success") {
      setUploadResult({
        title: t("uploadResultOverwrittenTitle"),
        body: t("uploadResultOverwrittenBody").replace("{name}", loadName),
      });
      return;
    }

    setUploadResult({
      title: t("uploadErrorTitle"),
      body: uploadErrorMessage(result?.code),
    });
  };

  const handleDelete = (name, e) => {
    e.stopPropagation();
    if (confirm(`"${name}" ${t("confirmDeleteSave")}`)) {
      onDeleteSave?.(name);
    }
  };

  const confirmSaveLabel = trimmedSaveName
    ? saveNameExists
      ? t("saveModalUpdateAction").replace("{name}", trimmedSaveName)
      : t("saveModalCreateAction").replace("{name}", trimmedSaveName)
    : saveNameExists
      ? t("saveModalUpdateFallback")
      : t("saveModalCreateFallback");

  // Keep these props used for backward compatibility with previous menu variants.
  void onLoad;
  void onDeleteSave;
  void onOpenExport;
  void onOpenImport;
  void handleDelete;
  void setLoadName;
  void onStartTutorial;
  void adminMode;
  void onOpenSettings;

  return (
    <>
      <div className="menu-panel" data-tutorial-zone="topbar-buttons">
        <div className="menu-button-grid">
          <div className="menu-column">
            <button
              className={`menu-btn${hasUnsavedChanges ? " menu-btn--unsaved" : ""}`}
              onClick={openSaveModal}
              title={
                hasUnsavedChanges
                  ? t("menuSaveUnsavedTitle")
                  : t("btnSaveTitle")
              }
              aria-label={t("btnSaveTitle")}
              data-tutorial-zone="save-controls"
              data-help-id="btn-save"
            >
              <Save size={18} />
              <span className="menu-btn-label">{t("btnSaveTitle")}</span>
            </button>
            <button
              className="menu-btn"
              onClick={() => onOpenLoadSaves?.()}
              title={t("btnLoadTitle")}
              aria-label={t("btnLoadTitle")}
              data-tutorial-zone="load-open-btn"
              data-help-id="btn-load"
            >
              <FolderOpen size={18} />
              <span className="menu-btn-label">{t("btnLoadTitle")}</span>
            </button>
            <button
              className="menu-btn"
              onClick={openUploadModal}
              title={
                canUploadShared
                  ? t("btnUploadTitle")
                  : t("loadSavesBtnUploadDisabled")
              }
              aria-label={t("btnUploadLabel")}
              data-help-id="btn-upload"
              disabled={!canUploadShared || !loadName}
            >
              <Upload size={18} />
              <span className="menu-btn-label">{t("btnUploadLabel")}</span>
            </button>
          </div>
          <div className="menu-column">
            <button
              className={`menu-btn ${adminActive ? "active" : ""}`}
              onClick={() => !editingLocked && onToggleAdmin?.(!adminMode)}
              disabled={editingLocked}
              title={t("btnAdminTitle")}
              aria-label={t("btnAdminLabel")}
              data-help-id="btn-admin"
            >
              <Sparkle size={18} />
              <span className="menu-btn-label">{t("btnAdminLabel")}</span>
            </button>
            <button
              className="menu-btn"
              onClick={onOpenSettings}
              title={t("btnSettingsTitle")}
              aria-label={t("btnSettingsLabel")}
              data-help-id="btn-settings"
            >
              <Settings size={18} />
              <span className="menu-btn-label">{t("btnSettingsLabel")}</span>
            </button>
            <button
              className="menu-btn"
              onClick={() => onOpenOnlineLibrary?.()}
              title={t("btnOnlineTitle")}
              aria-label={t("btnOnlineLabel")}
              data-help-id="btn-online"
            >
              <Globe size={18} />
              <span className="menu-btn-label">{t("btnOnlineLabel")}</span>
            </button>
          </div>
        </div>
      </div>

      {saveModalOpen && typeof document !== "undefined"
        ? createPortal(
            <div className="modal">
              <div className="modal-card menu-save-modal">
                <div className="help-header">
                  <h3>{t("saveModalTitle")}</h3>
                </div>

                <div className="menu-save-modal-body">
                  <label
                    className="menu-save-modal-label"
                    htmlFor="topbar-save-name"
                  >
                    {t("saveModalNameLabel")}
                  </label>
                  <QiInput
                    id="topbar-save-name"
                    mode="text"
                    fullWidth
                    className="menu-save-modal-input"
                    value={saveNameDraft}
                    placeholder={t("saveModalNamePlaceholder")}
                    onChange={(nextValue) => setSaveNameDraft(nextValue)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && trimmedSaveName) {
                        handleConfirmSave();
                      }
                      if (event.key === "Escape") {
                        closeSaveModal();
                      }
                    }}
                    autoFocus
                    list="topbar-save-name-list"
                  />
                  {existingSaveNames.length > 0 && (
                    <datalist id="topbar-save-name-list">
                      {existingSaveNames.map((name) => (
                        <option key={name} value={name} />
                      ))}
                    </datalist>
                  )}
                </div>

                <div className="modal-actions">
                  <button
                    className="menu-save-modal-cancel"
                    onClick={closeSaveModal}
                  >
                    {t("startConfigCancel")}
                  </button>
                  <button
                    className="menu-save-modal-confirm"
                    onClick={handleConfirmSave}
                    disabled={!trimmedSaveName}
                  >
                    {confirmSaveLabel}
                  </button>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}

      {uploadModalOpen && typeof document !== "undefined"
        ? createPortal(
            <div className="modal">
              <div className="modal-card menu-save-modal">
                <div className="help-header">
                  <h3>{t("uploadWarningTitle")}</h3>
                </div>

                <div className="menu-save-modal-body">
                  <p>{t("uploadWarningBody")}</p>
                  <SavefileCard
                    title={loadName || "-"}
                    isOwned={false}
                    stats={uploadPreviewStats}
                    ownerUsername={currentUsername || "?"}
                    timestamp={new Date()}
                  />
                </div>

                <div className="modal-actions">
                  <button
                    className="menu-save-modal-cancel"
                    onClick={closeUploadModal}
                  >
                    {t("startConfigCancel")}
                  </button>
                  <button
                    className="menu-save-modal-confirm"
                    onClick={handleConfirmUpload}
                  >
                    {t("btnUploadLabel")}
                  </button>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}

      {uploadOverwriteOpen && typeof document !== "undefined"
        ? createPortal(
            <div className="modal">
              <div className="modal-card menu-save-modal">
                <div className="help-header">
                  <h3>{t("uploadOverwriteTitle")}</h3>
                </div>
                <div className="menu-save-modal-body">
                  <p>
                    {t("uploadOverwriteBody").replace(
                      "{name}",
                      loadName || "-",
                    )}
                  </p>
                </div>
                <div className="modal-actions">
                  <button
                    className="menu-save-modal-cancel"
                    onClick={closeUploadOverwriteModal}
                  >
                    {t("startConfigCancel")}
                  </button>
                  <button
                    className="menu-save-modal-confirm"
                    onClick={handleConfirmOverwriteUpload}
                  >
                    {t("uploadOverwriteConfirm")}
                  </button>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}

      {uploadResult && typeof document !== "undefined"
        ? createPortal(
            <div className="modal">
              <div className="modal-card menu-save-modal">
                <div className="help-header">
                  <h3>{uploadResult.title}</h3>
                </div>
                <div className="menu-save-modal-body">
                  <p>{uploadResult.body}</p>
                </div>
                <div className="modal-actions">
                  <button
                    className="menu-save-modal-confirm"
                    onClick={closeUploadResultModal}
                  >
                    {t("loadSavesBtnConfirm")}
                  </button>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
