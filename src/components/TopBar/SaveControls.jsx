import { Save, FolderOpen, Download, Upload } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { useLang } from "../../context/LanguageContext";
import { T } from "../../i18n/translations";
import "./SaveControls.css";

export function SaveControls({
  onSave,
  onLoad,
  saves = {},
  loadName,
  setLoadName,
  onDeleteSave,
  onOpenExport,
  onOpenImport,
  onOpenLoadSaves,
}) {
  const { lang } = useLang();
  const t = (key) => T[key]?.[lang] ?? T[key]?.DE ?? key;

  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  const saveNames = Object.keys(saves).sort();

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

  const handleDelete = (name, e) => {
    e.stopPropagation();
    if (confirm(`"${name}" ${t("confirmDeleteSave")}`)) {
      onDeleteSave?.(name);
    }
  };

  return (
    <div className="save-controls">
      <button className="save-btn" onClick={handleSave} title={t("btnSaveTitle")}>
        <Save size={18} />
      </button>

      <button
        className="save-btn"
        onClick={() => onOpenLoadSaves?.()}
        title={t("btnLoadTitle")}
      >
        <FolderOpen size={18} />
      </button>

      <div className="save-dropdown-wrapper" ref={dropdownRef}>
        <button
          className="save-btn"
          onClick={() => setDropdownOpen(!dropdownOpen)}
          title={t("btnQuickMenuTitle")}
        >
          <Download size={18} />
        </button>

        {dropdownOpen && (
          <div className="save-dropdown">
            <div className="save-dropdown-header">{t("quickMenuHeader")}</div>

            {saveNames.length > 0 && (
              <>
                <div className="save-dropdown-divider" />
                {saveNames.map((name) => (
                  <div
                    key={name}
                    className={`save-dropdown-item ${name === loadName ? "active" : ""}`}
                    onClick={() => {
                      setLoadName(name);
                      onLoad?.(name);
                      setDropdownOpen(false);
                    }}
                  >
                    <span className="save-name">{name}</span>
                    <button
                      className="save-delete-btn"
                      type="button"
                      title={t("loadSavesBtnDelete")}
                      onClick={(e) => handleDelete(name, e)}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </>
            )}

            <div className="save-dropdown-divider" />

            <div
              className="save-dropdown-item action-item"
              onClick={() => {
                onOpenExport?.();
                setDropdownOpen(false);
              }}
            >
              <Download size={16} />
              <span>{t("quickMenuExport")}</span>
            </div>
            <div
              className="save-dropdown-item action-item"
              onClick={() => {
                onOpenImport?.();
                setDropdownOpen(false);
              }}
            >
              <Upload size={16} />
              <span>{t("quickMenuImport")}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

