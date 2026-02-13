export function PastEditWarningModal({
  open,
  onCopyAndContinue,
  onContinue,
  onCancel,
  currentName,
}) {
  if (!open) return null;

  return (
    <div className="modal">
      <div className="modal-card">
        <div className="help-header">
          <h3>Achtung</h3>
          <button onClick={onCancel}>Schliessen</button>
        </div>
        <div className="warning-body">
          <p>
            Achtung, Bearbeiten in der Vergangenheit schneidet alle zukuenftigen
            Checkpoints ab.
          </p>
        </div>
        <div className="warning-actions">
          <button
            className="warning-primary"
            onClick={onCopyAndContinue}
            style={{ width: "100%" }}
          >
            Erstelle Kopie und fahre fort
          </button>
          <button
            className="warning-secondary"
            onClick={onContinue}
            style={{ width: "100%" }}
          >
            Ohne Kopie fortfahren
          </button>
          <div className="warning-cancel-row">
            <button className="warning-cancel" onClick={onCancel}>
              Abbrechen
            </button>
          </div>
          {currentName ? (
            <div className="warning-note">
              Aktueller Save: <strong>{currentName}</strong>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
