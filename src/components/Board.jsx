export function Board({
  viewRotation,
  boardTransform,
  viewWidth,
  viewHeight,
  viewColStart,
  viewRowStart,
  previewOrigin,
  isCellUnlocked,
  handleCellClick,
  setHoverCell,
  layout,
  libraryMap,
  categoryColors,
  boardTransformClass,
  readyMap = {},
}) {
  return (
    <div className="board-wrapper">
      <div
        className={`board-frame ${boardTransformClass}`}
        style={{ "--view-rotation": viewRotation, transform: boardTransform }}
      >
        <div className="board" style={{ "--board-cols": viewWidth }}>
          {Array.from({ length: viewHeight }).map((_, row) => (
            <div
              key={row}
              className="board-row"
              style={{ "--board-cols": viewWidth }}
            >
              {Array.from({ length: viewWidth }).map((_, col) => {
                const globalCol = viewColStart + col;
                const globalRow = viewRowStart + row;
                const inPreview =
                  previewOrigin &&
                  globalCol >= previewOrigin.x &&
                  globalCol < previewOrigin.x + previewOrigin.width &&
                  globalRow >= previewOrigin.y &&
                  globalRow < previewOrigin.y + previewOrigin.height;
                const cellLocked = !isCellUnlocked(globalCol, globalRow);
                return (
                  <div
                    key={`${globalCol}-${globalRow}`}
                    className={`cell ${cellLocked ? "locked" : ""} ${
                      inPreview ? "preview" : ""
                    }`}
                    onMouseEnter={() =>
                      setHoverCell({ x: globalCol, y: globalRow })
                    }
                    onClick={() => handleCellClick(globalCol, globalRow)}
                  />
                );
              })}
            </div>
          ))}
          <div className="building-layer" style={{ pointerEvents: "none" }}>
            {layout.map((b) => (
              <div
                key={b.id}
                className="building-rect"
                style={{
                  left: `calc(var(--cell-size) * ${b.x - viewColStart})`,
                  top: `calc(var(--cell-size) * ${b.y - viewRowStart})`,
                  width: `calc(var(--cell-size) * ${b.width})`,
                  height: `calc(var(--cell-size) * ${b.height})`,
                  backgroundColor: `${
                    categoryColors[libraryMap[b.defId].category]
                  }33`,
                  borderColor: categoryColors[libraryMap[b.defId].category],
                  pointerEvents: "none",
                }}
              >
                <div className="building-subgrid" />
                <div
                  className="building-label"
                  style={{ color: readyMap[b.id] ? "#ffeb3b" : "#ffffff" }}
                >
                  {libraryMap[b.defId].name}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
