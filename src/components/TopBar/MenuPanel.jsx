// Menu panel for TopBar - Save, Load, Admin, Help, Profile
import {
  Save,
  FolderOpen,
  Globe,
  Sparkle,
  User,
} from "lucide-react";
import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useLang } from "../../context/LanguageContext";
import { T } from "../../i18n/translations";
import { QiInput } from "../common/QiInput";

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
  adminMode,
  editingLocked,
  onToggleAdmin,
  onOpenAccount,
  onStartTutorial,
  hasUnsavedChanges,
}) {
  const { lang } = useLang();
  const t = (key) => T[key]?.[lang] ?? T[key]?.DE ?? key;
  const adminActive = adminMode && !editingLocked;
  const [saveModalOpen, setSaveModalOpen] = useState(false);
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

  return (
    <>
      <div className="menu-panel" data-tutorial-zone="topbar-buttons">
        <div className="menu-button-grid">
          <div className="menu-column">
            <button
              className={`menu-btn${hasUnsavedChanges ? " menu-btn--unsaved" : ""}`}
              onClick={openSaveModal}
              title={hasUnsavedChanges ? t("menuSaveUnsavedTitle") : t("btnSaveTitle")}
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
              onClick={() => {}}
              title={t("btnOnlineTitle")}
              aria-label={t("btnOnlineLabel")}
              data-help-id="btn-online"
            >
              <Globe size={18} />
              <span className="menu-btn-label">{t("btnOnlineLabel")}</span>
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
              onClick={onOpenAccount}
              title={t("btnProfileTitle")}
              aria-label={t("btnProfileLabel")}
              data-help-id="btn-profile"
            >
              <User size={18} />
              <span className="menu-btn-label">{t("btnProfileLabel")}</span>
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
                  <label className="menu-save-modal-label" htmlFor="topbar-save-name">
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
                  <button className="menu-save-modal-cancel" onClick={closeSaveModal}>
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
    </>
  );
}

