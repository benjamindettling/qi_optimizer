// Save controls with icon buttons for TopBar
import { Save, FolderOpen, Download, Upload } from "lucide-react";
import { useState, useRef, useEffect } from "react";
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
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  const saveNames = Object.keys(saves).sort();

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
    <div className="save-controls">
      <button className="save-btn" onClick={handleSave} title="Speichern">
        <Save size={18} />
      </button>

      <button
        className="save-btn"
        onClick={() => onOpenLoadSaves?.()}
        title="Laden"
      >
        <FolderOpen size={18} />
      </button>

      <div className="save-dropdown-wrapper" ref={dropdownRef}>
        <button
          className="save-btn"
          onClick={() => setDropdownOpen(!dropdownOpen)}
          title="Schnellmenü"
        >
          <Download size={18} />
        </button>

        {dropdownOpen && (
          <div className="save-dropdown">
            <div className="save-dropdown-header">Schnellzugriff</div>

            <div className="save-dropdown-divider" />

            <div
              className="save-dropdown-item action-item"
              onClick={() => {
                onOpenExport?.();
                setDropdownOpen(false);
              }}
            >
              <Download size={16} />
              <span>Export</span>
            </div>
            <div
              className="save-dropdown-item action-item"
              onClick={() => {
                onOpenImport?.();
                setDropdownOpen(false);
              }}
            >
              <Upload size={16} />
              <span>Import</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
