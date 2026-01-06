import { useMemo } from "react";

export function Board({
  viewRotation,
  boardTransform,
  rotatedWidthPx,
  rotatedHeightPx,
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
  selectedIds = new Set(),
  boardRef,
}) {
  // Hue shift tiers by buildTime; edit to adjust look.
  const BUILD_TIME_HUE_SHIFT = {
    0: 0,
    1: 0,
    10: 0,
  };

  const HUE_SHIFT_PRODUCTION = {
    0: 0,
    1: 0,
    10: 0,
  };

  const clamp01 = (v) => Math.min(1, Math.max(0, v));

  const parseHexToHsl = (hex) => {
    if (!hex || typeof hex !== "string") return null;
    const cleaned = hex.replace("#", "");
    if (cleaned.length !== 6) return null;
    const r = Number.parseInt(cleaned.slice(0, 2), 16) / 255;
    const g = Number.parseInt(cleaned.slice(2, 4), 16) / 255;
    const b = Number.parseInt(cleaned.slice(4, 6), 16) / 255;
    if ([r, g, b].some((v) => Number.isNaN(v))) return null;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const l = (max + min) / 2;
    let h = 0;
    let s = 0;
    const d = max - min;
    if (d !== 0) {
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r:
          h = (g - b) / d + (g < b ? 6 : 0);
          break;
        case g:
          h = (b - r) / d + 2;
          break;
        default:
          h = (r - g) / d + 4;
      }
      h /= 6;
    }
    return { h, s, l };
  };

  const hslToRgba = (h, s, l, alpha = 1) => {
    const hue2rgb = (p, q, t) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };
    let r;
    let g;
    let b;
    if (s === 0) {
      r = g = b = l;
    } else {
      const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      const p = 2 * l - q;
      r = hue2rgb(p, q, h + 1 / 3);
      g = hue2rgb(p, q, h);
      b = hue2rgb(p, q, h - 1 / 3);
    }
    return `rgba(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(
      b * 255
    )}, ${alpha})`;
  };

  const tintColor = (
    baseHex,
    key,
    alphaBg = 0.22,
    alphaBorder = 1,
    hueShiftDeg = 0
  ) => {
    const hsl = parseHexToHsl(baseHex);
    if (!hsl) return { background: "rgba(255,255,255,0.2)", border: baseHex };
    const satDelta = 0;
    const lightDelta = 0;

    let h = (hsl.h * 360 + hueShiftDeg) % 360;
    if (h < 0) h += 360;
    const s = clamp01(hsl.s + satDelta);
    const l = clamp01(hsl.l + lightDelta);

    return {
      background: hslToRgba(h / 360, s, l, alphaBg),
      border: hslToRgba(h / 360, s, l, alphaBorder),
    };
  };

  const safeCols = Math.max(1, Math.floor(viewWidth || 0));
  const safeRows = Math.max(1, Math.floor(viewHeight || 0));

  if (!Number.isFinite(viewColStart) || !Number.isFinite(viewRowStart)) {
    return null;
  }

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
      {/*
        Important: CSS transforms do not affect layout. When the board is rotated,
        its visual bounding box becomes larger than its unrotated (layout) box.
        By sizing an untransformed wrapper to the rotated bounding box, flex/grid
        can place adjacent UI (like the ActionToolbar) correctly without hacks.
      */}
      <div
        className="board-transform-box"
        style={{
          width: Number.isFinite(rotatedWidthPx)
            ? `${rotatedWidthPx}px`
            : "auto",
          height: Number.isFinite(rotatedHeightPx)
            ? `${rotatedHeightPx}px`
            : "auto",
        }}
      >
        <div
          className={`board-frame ${boardTransformClass}`}
          style={{
            "--view-rotation": viewRotation,
            "--cell-size": cellSizePx ? `${cellSizePx}px` : undefined,
            transform: boardTransform,
          }}
        >
          <div
            className="board"
            style={{ "--board-cols": safeCols }}
            ref={boardRef}
          >
            {Array.from({ length: safeRows }).map((_, row) => (
              <div
                key={row}
                className="board-row"
                style={{ "--board-cols": safeCols }}
              >
                {Array.from({ length: safeCols }).map((_, col) => {
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
                  } ${selectedIds.has(b.id) ? "building-selected" : ""}`}
                  title={libraryMap[b.defId]?.name || ""}
                  style={(() => {
                    const baseColor =
                      categoryColors[libraryMap[b.defId].category] || "#ffffff";
                    const def = libraryMap[b.defId] || {};
                    const hueShift =
                      (def.category === "production"
                        ? HUE_SHIFT_PRODUCTION[def.buildTime]
                        : undefined) ??
                      BUILD_TIME_HUE_SHIFT[def.buildTime] ??
                      BUILD_TIME_HUE_SHIFT[0] ??
                      0;
                    const tinted = tintColor(
                      baseColor,
                      b.defId || String(b.id),
                      0.28,
                      1,
                      hueShift
                    );
                    return {
                      left: `calc(var(--cell-size) * ${b.x - viewColStart})`,
                      top: `calc(var(--cell-size) * ${b.y - viewRowStart})`,
                      width: `calc(var(--cell-size) * ${b.width})`,
                      height: `calc(var(--cell-size) * ${b.height})`,
                      pointerEvents: "none",
                      backgroundColor: tinted.background,
                      borderColor: tinted.border,
                    };
                  })()}
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
    </div>
  );
}
