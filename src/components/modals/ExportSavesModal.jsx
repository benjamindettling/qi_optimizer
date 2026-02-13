import { useEffect, useState } from "react";

export function ExportSavesModal({ open, saves = {}, onClose, onExport }) {
  // Version 2: We export the tree, not individual saves
  // The saves list is shown for reference only
  const names = Object.entries(saves || {})
    .filter(([, entry]) => !entry?.meta?.isSnapshot)
    .map(([name]) => name);

  if (!open) return null;

  const handleExport = () => {
    // Pass empty array - v2 export ignores the names and exports the tree
    onExport?.([]);
  };

  return (
    <div className="modal">
      <div className="modal-card">
        <div className="help-header">
          <h3>Export (Version 2)</h3>
          <button onClick={onClose}>Schliessen</button>
        </div>
        <div className="export-list">
          <div className="import-v2-info">
            <strong>Version 2 Export</strong>
            <p>Der gesamte Aktions-Baum wird exportiert.</p>
            <p>Der Spielzustand kann daraus vollstaendig rekonstruiert werden.</p>
            <p style={{ marginTop: "10px", fontSize: "0.9em", color: "#888" }}>
              Keine Snapshots oder Checkpoints werden gespeichert.
            </p>
          </div>
        </div>
        <div className="modal-actions">
          <button onClick={handleExport}>
            Export
          </button>
          <button onClick={onClose}>Abbrechen</button>
        </div>
      </div>
    </div>
  );
}
