// Menu panel for TopBar - Save, Load, Admin, Help, Profile
import {
  Save,
  FolderOpen,
  Sparkle,
  CircleHelp,
  User,
  RefreshCw,
} from "lucide-react";
import { useState, useRef, useEffect } from "react";

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
  // Sync config props
  showSyncConfig,
  onSyncConfig,
  // Unsaved changes
  hasUnsavedChanges,
}) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);
  const saveNames = Object.keys(saves).sort();
  const adminActive = adminMode && !editingLocked;

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSave = () => {
    const name = prompt("Save name?", loadName || "");
    if (!name) return;
    setLoadName(name);
    onSave?.(name);
  };

  const handleSelectAndLoad = (name) => {
    setLoadName(name);
    onLoad?.(name);
    setDropdownOpen(false);
  };

  const handleDelete = (name, e) => {
    e.stopPropagation();
    if (confirm(`"${name}" wirklich löschen?`)) {
      onDeleteSave?.(name);
    }
  };

  return (
    <div className="menu-panel">
      {/* Column 1: Save/Load/Sync */}
      <div className="menu-column">
        <button
          className={`menu-btn menu-btn--icon-only${hasUnsavedChanges ? " menu-btn--unsaved" : ""}`}
          onClick={handleSave}
          title={
            hasUnsavedChanges
              ? "Speichern (ungespeicherte Änderungen)"
              : "Speichern"
          }
          aria-label="Speichern"
        >
          <Save size={18} />
        </button>
        <button
          className="menu-btn menu-btn--icon-only"
          onClick={() => onOpenLoadSaves?.()}
          title="Laden"
          aria-label="Laden"
        >
          <FolderOpen size={18} />
        </button>
        {showSyncConfig && (
          <button
            className="menu-btn menu-btn--sync"
            onClick={onSyncConfig}
            title="Config mit Account synchronisieren"
            aria-label="Sync Config"
          >
            <RefreshCw size={18} />
            <span className="menu-btn-label">Sync</span>
          </button>
        )}
      </div>

      {/* Column 2: Admin, Help, Profile with labels */}
      <div className="menu-column">
        <button
          className={`menu-btn ${adminActive ? "active" : ""}`}
          onClick={() => !editingLocked && onToggleAdmin?.(!adminMode)}
          disabled={editingLocked}
          title="Admin-Modus: freies Bauen, Region-Tools, Ressourcenbearbeitung"
          aria-label="Admin"
        >
          <Sparkle size={18} />
          <span className="menu-btn-label">Admin</span>
        </button>
        <button
          className="menu-btn"
          onClick={onOpenHelp}
          title="Hilfe"
          aria-label="Hilfe"
        >
          <CircleHelp size={18} />
          <span className="menu-btn-label">Hilfe</span>
        </button>
        <button
          className="menu-btn"
          onClick={onOpenAccount}
          title="Profil"
          aria-label="Profil"
        >
          <User size={18} />
          <span className="menu-btn-label">Profil</span>
        </button>
      </div>
    </div>
  );
}
