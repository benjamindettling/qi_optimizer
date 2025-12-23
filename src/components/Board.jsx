import { useMemo } from "react";

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
  onDropComplete,
  layout,
  libraryMap,
  categoryColors,
  boardTransformClass,
  cellSizePx,
  readyMap = {},
  buildLocks = {},
  useShortNames = false,
}) {
  const titleMap = useMemo(() => {
    const map = {};
    layout.forEach((b) => {
      const name = libraryMap[b.defId]?.name;
      if (!name) return;
      for (let yy = b.y; yy < b.y + b.height; yy += 1) {
        for (let xx = b.x; xx < b.x + b.width; xx += 1) {
          map[`${xx}-${yy}`] = name;
        }
      }
    });
    return map;
  }, [layout, libraryMap]);

  return (
    <div className="board-wrapper">
      <div
        className={`board-frame ${boardTransformClass}`}
        style={{
          "--view-rotation": viewRotation,
          "--cell-size": cellSizePx ? `${cellSizePx}px` : undefined,
          transform: boardTransform,
        }}
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
                    title={titleMap[`${globalCol}-${globalRow}`] || undefined}
                    onMouseEnter={() =>
                      setHoverCell({ x: globalCol, y: globalRow })
                    }
                    onClick={() => handleCellClick(globalCol, globalRow)}
                    onTouchMove={(e) => {
                      e.preventDefault();
                      setHoverCell({ x: globalCol, y: globalRow });
                    }}
                    onTouchEnd={(e) => {
                      e.preventDefault();
                      handleCellClick(globalCol, globalRow);
                      onDropComplete?.();
                    }}
                    onDragOver={(e) => {
                      e.preventDefault();
                      setHoverCell({ x: globalCol, y: globalRow });
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      handleCellClick(globalCol, globalRow);
                      onDropComplete?.();
                    }}
                  />
                );
              })}
            </div>
          ))}
          <div className="building-layer" style={{ pointerEvents: "none" }}>
            {layout.map((b) => (
              <div
                key={b.id}
                className={`building-rect ${
                  buildLocks[b.id] ? "building-locked" : ""
                }`}
                title={libraryMap[b.defId]?.name || ""}
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
                    style={{
                      color: buildLocks[b.id]
                        ? readyMap[b.id]
                          ? "#ffeb3b"
                          : "#9aa3b5"
                        : readyMap[b.id]
                        ? "#ffeb3b"
                        : "#ffffff",
                    }}
                  >
                  {useShortNames && libraryMap[b.defId]?.short
                    ? libraryMap[b.defId].short
                    : libraryMap[b.defId].name}
                  </div>
                </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
