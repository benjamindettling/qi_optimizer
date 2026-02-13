import { useEffect, useRef, useState } from "react";

const parseFile = async (file) => {
  const text = await file.text();
  const data = JSON.parse(text);
  
  // Version 2: Tree-based, no saves array needed
  const isVersion2 = data.version === 2 || (data.tree && !data.saves?.length);
  
  if (isVersion2) {
    // V2: Return empty entries but with full import data
    return { entries: [], importData: data, isVersion2: true };
  }
  
  // Version 1: Legacy with saves array
  if (!data?.saves || !Array.isArray(data.saves)) return { entries: [], importData: null, isVersion2: false };
  const entries = data.saves.map((entry, idx) => ({
    id: `${file.name}-${idx}`,
    name: entry.name || `import-${idx + 1}`,
    snapshot: entry.snapshot,
    checkpoints: entry.checkpoints ?? [],
    meta: entry.meta ?? {},
    selected: true,
    editing: false,
  }));
  // Return both entries and full import data (including tree)
  return { entries, importData: data, isVersion2: false };
};

export function ImportSavesModal({ open, onClose, onImport }) {
  const [entries, setEntries] = useState([]);
  const [importData, setImportData] = useState(null);
  const [isVersion2, setIsVersion2] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (!open) {
      setEntries([]);
      setImportData(null);
      setIsVersion2(false);
      setError("");
    }
  }, [open]);

  if (!open) return null;

  const handleFiles = async (files) => {
    const list = Array.from(files || []);
    if (!list.length) return;
    try {
      const parsedArrays = await Promise.all(list.map(parseFile));
      
      // Check if any file is v2
      const v2File = parsedArrays.find((p) => p.isVersion2);
      if (v2File) {
        setEntries([]);
        setImportData(v2File.importData);
        setIsVersion2(true);
        setError("");
        return;
      }
      
      // V1: Process saves
      const flat = parsedArrays.flatMap((p) => p.entries).filter((e) => e.snapshot);
      const dataWithTree = parsedArrays.find((p) => p.importData?.tree)?.importData ?? null;
      setEntries(flat);
      setImportData(dataWithTree);
      setIsVersion2(false);
      setError(flat.length ? "" : "Keine gueltigen Saves gefunden.");
    } catch (e) {
      console.error(e);
      setError("Datei konnte nicht gelesen werden.");
    }
  };

  const toggle = (id) => {
    setEntries((prev) =>
      prev.map((e) => (e.id === id ? { ...e, selected: !e.selected } : e))
    );
  };

  const startEdit = (id) => {
    setEntries((prev) =>
      prev.map((e) => (e.id === id ? { ...e, editing: true } : e))
    );
  };

  const commitEdit = (id, name) => {
    const trimmed = name.trim();
    setEntries((prev) =>
      prev.map((e) =>
        e.id === id ? { ...e, editing: false, name: trimmed || e.name } : e
      )
    );
  };

  const handleConfirm = () => {
    if (isVersion2) {
      // V2: Just pass the import data, no entries needed
      onImport?.([], importData);
      return;
    }
    
    // V1: Pass selected entries
    const selectedEntries = entries
      .filter((e) => e.selected && e.snapshot)
      .map((e) => ({
        name: e.name,
        snapshot: e.snapshot,
        checkpoints: e.checkpoints ?? [],
        meta: e.meta ?? {},
      }));
    onImport?.(selectedEntries, importData);
  };

  return (
    <div className="modal">
      <div className="modal-card">
        <div className="help-header">
          <h3>Saves importieren</h3>
          <button onClick={onClose}>Schliessen</button>
        </div>

        <div
          className="import-dropzone"
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          onDrop={(e) => {
            e.preventDefault();
            handleFiles(e.dataTransfer.files);
          }}
        >
          Datei hier ablegen oder klicken zum Auswaehlen
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json"
            style={{ display: "none" }}
            onChange={(e) => handleFiles(e.target.files)}
          />
        </div>

        {error && <div className="import-error">{error}</div>}

        <div className="import-list">
          {isVersion2 ? (
            <div className="import-v2-info">
              <strong>Version 2 Datei erkannt</strong>
              <p>Tree mit {importData?.tree?.tree?.length ?? 0} Branches wird importiert.</p>
              <p>Der Zustand wird aus dem Aktions-Baum rekonstruiert.</p>
            </div>
          ) : entries.length === 0 ? (
            <div className="worst-empty">Noch keine Datei geladen</div>
          ) : (
            entries.map((entry) => (
              <div key={entry.id} className="import-row">
                <input
                  type="checkbox"
                  checked={entry.selected}
                  onChange={() => toggle(entry.id)}
                />
                {entry.editing ? (
                  <input
                    className="import-name-input"
                    defaultValue={entry.name}
                    autoFocus
                    onBlur={(e) => commitEdit(entry.id, e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        commitEdit(entry.id, e.currentTarget.value);
                      }
                    }}
                  />
                ) : (
                  <span onDoubleClick={() => startEdit(entry.id)}>
                    {entry.name}
                  </span>
                )}
              </div>
            ))
          )}
        </div>

        <div className="modal-actions">
          <button 
            onClick={handleConfirm} 
            disabled={!isVersion2 && !entries.some((e) => e.selected)}
          >
            Import
          </button>
          <button onClick={onClose}>Abbrechen</button>
        </div>
      </div>
    </div>
  );
}
