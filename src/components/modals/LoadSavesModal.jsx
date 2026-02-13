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
import { SaveConfigModal } from "./SaveConfigModal";

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
}) {
  const [editingId, setEditingId] = useState(null);
  const [editingName, setEditingName] = useState("");
  const [deletingId, setDeletingId] = useState(null);
  const [configEditingName, setConfigEditingName] = useState(null);
  const [pendingLoadName, setPendingLoadName] = useState(null);
  const dropzoneRef = useRef(null);
  const fileInputRef = useRef(null);

  // Get sorted savefile names
  const sortedNames = Object.keys(saves)
    .filter((name) => !saves[name]?.meta?.isSnapshot)
    .sort();

  // Reset state when modal opens/closes
  useEffect(() => {
    if (!open) {
      // Use a microtask to avoid state update in effect body warning
      setTimeout(() => {
        setEditingId(null);
        setEditingName("");
        setDeletingId(null);
        setConfigEditingName(null);
        setPendingLoadName(null);
      }, 0);
    }
  }, [open]);

  // Handle load with unsaved changes check
  const handleLoad = (name) => {
    // Skip confirmation if loading the same savefile or if no unsaved changes
    if (name === loadName || !hasUnsavedChanges) {
      onLoad?.(name);
      return;
    }
    // Show confirmation dialog
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

  // Handle drag and drop
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
      alert("Datei konnte nicht importiert werden");
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

  if (!open) return null;

  return (
    <div className="modal">
      <div className="modal-card load-saves-modal">
        <div className="help-header">
          <h3>Spielstand laden</h3>
          <button onClick={onClose}>Schliessen</button>
        </div>

        {/* Savefiles list */}
        <div className="load-saves-list">
          {sortedNames.length === 0 ? (
            <div className="load-saves-empty">Keine Spielstaende gefunden</div>
          ) : (
            sortedNames.map((name) => (
              <div key={name} className="load-saves-row">
                <button
                  className={`load-saves-main-button ${
                    name === loadName ? "active" : ""
                  }`}
                  onClick={() => handleLoad(name)}
                >
                  {editingId === name ? (
                    <div
                      className="load-saves-edit-container"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input
                        type="text"
                        className="load-saves-edit-input"
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
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
                        title="Bestätigen"
                      >
                        <Check size={16} />
                      </button>
                      <button
                        className="load-saves-edit-cancel"
                        onClick={handleCancelEdit}
                        title="Abbrechen"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  ) : (
                    <span className="load-saves-name">{name}</span>
                  )}
                </button>

                {editingId !== name && (
                  <div className="load-saves-actions">
                    <button
                      className="load-saves-action-btn settings-btn"
                      onClick={() => setConfigEditingName(name)}
                      title="Savefile-Config"
                    >
                      <Settings size={16} />
                    </button>
                    <button
                      className="load-saves-action-btn edit-btn"
                      onClick={() => handleStartEdit(name)}
                      title="Umbenennen"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button
                      className="load-saves-action-btn export-btn"
                      onClick={() => handleExport(name)}
                      title="Exportieren"
                    >
                      <Share2 size={16} />
                    </button>
                    <button
                      className="load-saves-action-btn delete-btn"
                      onClick={() => setDeletingId(name)}
                      title="Löschen"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* Combined dropzone and import button */}
        <div
          ref={dropzoneRef}
          className="load-saves-dropzone"
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <Download size={20} />
          <div className="dropzone-content">
            Klicken oder Datei hierher ziehen zum Importieren
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json"
            style={{ display: "none" }}
            onChange={(e) => handleFiles(e.target.files)}
          />
        </div>
      </div>

      {/* Delete confirmation modal */}
      {deletingId && (
        <div className="modal modal-overlay">
          <div className="modal-card modal-confirm-delete">
            <div className="help-header">
              <h3>Spielstand löschen</h3>
            </div>
            <div className="modal-body">
              <p>Wirklich "{deletingId}" löschen?</p>
            </div>
            <div className="modal-actions">
              <button
                className="btn-confirm-delete"
                onClick={() => handleConfirmDelete(deletingId)}
              >
                Löschen
              </button>
              <button
                className="btn-cancel-delete"
                onClick={() => setDeletingId(null)}
              >
                Abbrechen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Unsaved changes confirmation modal */}
      {pendingLoadName && (
        <div className="modal modal-overlay">
          <div className="modal-card modal-confirm-delete">
            <div className="help-header">
              <h3>Ungespeicherte Änderungen</h3>
            </div>
            <div className="modal-body">
              <p>
                Es gibt ungespeicherte Änderungen. Wirklich zu "
                {pendingLoadName}" wechseln?
              </p>
            </div>
            <div className="modal-actions">
              <button className="btn-confirm-delete" onClick={confirmLoad}>
                Wechseln
              </button>
              <button className="btn-cancel-delete" onClick={cancelLoad}>
                Abbrechen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Savefile config modal */}
      <SaveConfigModal
        open={!!configEditingName}
        saveName={configEditingName}
        saveConfig={
          configEditingName ? saves[configEditingName]?.saveConfig : null
        }
        onClose={() => setConfigEditingName(null)}
        onSave={(newConfig) => {
          if (configEditingName) {
            onSaveConfig?.(configEditingName, newConfig);
          }
        }}
      />
    </div>
  );
}
