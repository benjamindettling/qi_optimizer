// Menu panel for TopBar - Save, Load, Admin, Help, Profile
import {
  Save,
  FolderOpen,
  Sparkle,
  CircleHelp,
  User,
  RefreshCw,
  GraduationCap,
} from "lucide-react";
import { LanguageToggle } from "../LanguageToggle/LanguageToggle";
import { useLang } from "../../context/LanguageContext";
import { T } from "../../i18n/translations";

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
  onOpenHelp,
  onOpenAccount,
  onStartTutorial,
  showSyncConfig,
  onSyncConfig,
  hasUnsavedChanges,
}) {
  const { lang } = useLang();
  const t = (key) => T[key]?.[lang] ?? T[key]?.DE ?? key;
  const adminActive = adminMode && !editingLocked;

  const handleSave = () => {
    const name = prompt("Save name?", loadName || "");
    if (!name) return;
    setLoadName(name);
    onSave?.(name);
  };

  const handleDelete = (name, e) => {
    e.stopPropagation();
    if (confirm(`"${name}" ${t("confirmDeleteSave")}`)) {
      onDeleteSave?.(name);
    }
  };

  // Keep these props used for backward compatibility with previous menu variants.
  void saves;
  void onLoad;
  void onDeleteSave;
  void onOpenExport;
  void onOpenImport;
  void handleDelete;

  return (
    <div className="menu-panel" data-tutorial-zone="topbar-buttons">
      <div className="menu-button-grid">
        <div className="menu-column">
          <button
            className={`menu-btn menu-btn--icon-only${hasUnsavedChanges ? " menu-btn--unsaved" : ""}`}
            onClick={handleSave}
            title={hasUnsavedChanges ? t("menuSaveUnsavedTitle") : t("btnSaveTitle")}
            aria-label={t("btnSaveTitle")}
            data-tutorial-zone="save-controls"
          >
            <Save size={18} />
          </button>
          <button
            className="menu-btn menu-btn--icon-only"
            onClick={() => onOpenLoadSaves?.()}
            title={t("btnLoadTitle")}
            aria-label={t("btnLoadTitle")}
            data-tutorial-zone="load-open-btn"
          >
            <FolderOpen size={18} />
          </button>
        </div>

        <div className="menu-column">
          <button
            className={`menu-btn ${adminActive ? "active" : ""}`}
            onClick={() => !editingLocked && onToggleAdmin?.(!adminMode)}
            disabled={editingLocked}
            title={t("btnAdminTitle")}
            aria-label={t("btnAdminLabel")}
          >
            <Sparkle size={18} />
            <span className="menu-btn-label">{t("btnAdminLabel")}</span>
          </button>
          <button
            className="menu-btn"
            onClick={onOpenAccount}
            title={t("btnProfileTitle")}
            aria-label={t("btnProfileLabel")}
          >
            <User size={18} />
            <span className="menu-btn-label">{t("btnProfileLabel")}</span>
          </button>
        </div>

        <div className="menu-column">
          <button
            className="menu-btn"
            onClick={onOpenHelp}
            title={t("btnHelpTitle")}
            aria-label={t("btnHelpLabel")}
            data-tutorial-zone="help-btn"
          >
            <CircleHelp size={18} />
            <span className="menu-btn-label">{t("btnHelpLabel")}</span>
          </button>
          <div className="menu-icon-row">
            <LanguageToggle className="menu-btn menu-btn--icon-only menu-lang-btn" />
            <button
              className="menu-btn menu-btn--icon-only"
              onClick={onStartTutorial}
              title={t("tutorialStart")}
              aria-label={t("tutorialStart")}
            >
              <GraduationCap size={18} />
            </button>
          </div>
        </div>
      </div>

      {showSyncConfig && (
        <button
          className="menu-btn menu-btn--sync"
          onClick={onSyncConfig}
          title={t("menuSyncTitle")}
          aria-label={t("menuSyncLabel")}
        >
          <RefreshCw size={18} />
          <span className="menu-btn-label">{t("menuSyncLabel")}</span>
        </button>
      )}
    </div>
  );
}

