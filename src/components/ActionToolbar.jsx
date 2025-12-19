export function ActionToolbar({
  moveMode,
  sellMode,
  refundMode,
  onToggleMove,
  onToggleSell,
  onToggleRefund,
  onUndo,
  onRedo,
  finishProductions,
  harvestAll,
  canUndo,
  canRedo,
  onSave,
  onLoad,
  saves,
  loadName,
  setLoadName,
  toolbarOffset = 0,
  onDeleteSave,
}) {
  const saveKeys = Object.keys(saves);
  return (
    <div
      className="actions-column"
      style={{ marginLeft: `${toolbarOffset}px` }}
    >
      <div className="actions-row">
        <button
          onClick={onToggleMove}
          className={`mode-button move ${moveMode ? "active-mode" : ""}`}
          title="Move"
        >
          ↕↔
        </button>
        <button
          onClick={onToggleSell}
          className={`mode-button sell ${sellMode ? "active-mode" : ""}`}
          title="Sell"
        >
          🗑
        </button>
      </div>

      <div className="actions-row">
        <button
          className="action-button undo"
          onClick={onUndo}
          disabled={!canUndo}
        >
          Undo
        </button>
        <button
          className="action-button redo"
          onClick={onRedo}
          disabled={!canRedo}
        >
          Redo
        </button>
      </div>

      <button
        onClick={onToggleRefund}
        className={`mode-button refund ${refundMode ? "active-mode" : ""}`}
      >
        Refund
      </button>

      <button onClick={finishProductions} className="action-button finish">
        Finish Productions
      </button>
      <button onClick={harvestAll}>Harvest All</button>
      <button onClick={onSave}>Save</button>
      <div>
        <select
          value={loadName}
          onChange={(e) => setLoadName(e.target.value)}
          style={{ width: "100%" }}
        >
          <option value="">Load state...</option>
          {saveKeys.map((k) => (
            <option key={k} value={k}>
              {k}
            </option>
          ))}
        </select>
        <button
          onClick={() => {
            if (loadName) onLoad(loadName);
          }}
          disabled={!loadName}
          style={{ marginTop: 4 }}
        >
          Load
        </button>
        {saveKeys.map((k) => (
          <div
            key={`del-${k}`}
            style={{ marginTop: 4, display: "flex", gap: 6 }}
          >
            <span style={{ flex: 1 }}>{k}</span>
            <button
              className="action-button danger"
              onClick={() => onDeleteSave && onDeleteSave(k)}
              title={`Delete save ${k}`}
            >
              Delete
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
