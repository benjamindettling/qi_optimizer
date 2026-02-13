import { flushSync } from "react-dom";

// Wait for the next animation frame to ensure DOM paint.
export const waitForFrame = () =>
  new Promise((resolve) => requestAnimationFrame(() => resolve()));

// Preload images to stabilize layout/canvas rendering.
export const preloadImages = async (urls, { timeoutMs = 5000 } = {}) => {
  const unique = Array.from(new Set((urls || []).filter(Boolean)));
  if (!unique.length) return;

  const withTimeout = (p) =>
    Promise.race([
      p,
      new Promise((resolve) => setTimeout(resolve, timeoutMs)),
    ]);

  await Promise.all(
    unique.map((url) =>
      withTimeout(
        new Promise((resolve) => {
          const img = new Image();
          img.crossOrigin = "anonymous";
          img.onload = () => {
            if (img.decode) {
              img
                .decode()
                .catch(() => {})
                .finally(resolve);
            } else {
              resolve();
            }
          };
          img.onerror = () => resolve();
          img.src = url;
        }),
      ),
    ),
  );
};

// Preload TopBar icons used in PDF exports.
export const preloadTopBarAssets = async ({ goodsTypes, unitTypes }) => {
  const baseIcons = [
    "/money.webp",
    "/supplies.webp",
    "/chronos.webp",
    "/population.webp",
    "/shards.webp",
    "/quantum_actions.webp",
  ];
  const goods = (goodsTypes || []).map(
    (g) => `/goods/${g === "Stein" ? "Backstein" : g}.webp`,
  );
  const units = (unitTypes || []).map((u) => `/units/${u}.webp`);
  await preloadImages([...baseIcons, ...goods, ...units]);
};

// Wait for the board/topbar to be idle before capturing.
export const waitForBoardReady = async (
  rootEl,
  { idleMs = 40, timeoutMs = 2000 } = {},
) => {
  if (!rootEl) {
    await waitForFrame();
    await waitForFrame();
    return;
  }

  try {
    if (document?.fonts?.ready) {
      await Promise.race([
        document.fonts.ready,
        new Promise((r) => setTimeout(r, 500)),
      ]);
    }
  } catch {
    // ignore font readiness errors
  }

  await new Promise((resolve) => {
    let done = false;
    let idleTimer = null;
    const finish = () => {
      if (done) return;
      done = true;
      if (idleTimer) clearTimeout(idleTimer);
      observer.disconnect();
      resolve();
    };

    const observer = new MutationObserver(() => {
      if (idleTimer) clearTimeout(idleTimer);
      idleTimer = setTimeout(finish, idleMs);
    });

    try {
      observer.observe(rootEl, {
        subtree: true,
        childList: true,
        attributes: true,
        characterData: true,
      });
    } catch {
      finish();
      return;
    }

    idleTimer = setTimeout(finish, idleMs);
    setTimeout(finish, timeoutMs);
  });

  await waitForFrame();
};

export const cropCanvasToDataUrl = (fullCanvas, rect) => {
  const cropCanvas = document.createElement("canvas");
  const scale = fullCanvas.width / document.body.scrollWidth;
  const cropWidth = Math.max(1, Math.floor(rect.width * scale));
  const cropHeight = Math.max(1, Math.floor(rect.height * scale));
  cropCanvas.width = cropWidth;
  cropCanvas.height = cropHeight;
  const ctx = cropCanvas.getContext("2d");

  const offsetX = (rect.left + window.scrollX) * scale;
  const offsetY = (rect.top + window.scrollY) * scale;

  ctx.drawImage(
    fullCanvas,
    offsetX,
    offsetY,
    rect.width * scale,
    rect.height * scale,
    0,
    0,
    cropWidth,
    cropHeight,
  );

  return {
    dataUrl: cropCanvas.toDataURL("image/png"),
    width: cropWidth,
    height: cropHeight,
  };
};

export const cropElementCanvasToDataUrl = (
  elementCanvas,
  rectWithinEl,
  elementRect,
) => {
  const cropCanvas = document.createElement("canvas");
  const scale = elementCanvas.width / Math.max(1, elementRect.width);
  const cropWidth = Math.max(1, Math.floor(rectWithinEl.width * scale));
  const cropHeight = Math.max(1, Math.floor(rectWithinEl.height * scale));
  cropCanvas.width = cropWidth;
  cropCanvas.height = cropHeight;
  const ctx = cropCanvas.getContext("2d");

  const offsetX = rectWithinEl.left * scale;
  const offsetY = rectWithinEl.top * scale;

  ctx.drawImage(
    elementCanvas,
    offsetX,
    offsetY,
    rectWithinEl.width * scale,
    rectWithinEl.height * scale,
    0,
    0,
    cropWidth,
    cropHeight,
  );

  return {
    dataUrl: cropCanvas.toDataURL("image/png"),
    width: cropWidth,
    height: cropHeight,
  };
};

// Builds capture helpers for board and topbar snapshots.
export const createBoardCapturer = ({
  boardRef,
  topBarRef,
  html2canvas,
  applySnapshot,
  setCheckpointIndex,
  harvestFullForPdf,
  pdfBgColor,
}) => {
  const captureBoardImage = async (snapshot) => {
    const target = boardRef.current;
    if (!target) return null;

    flushSync(() => {
      applySnapshot(snapshot);
      setCheckpointIndex(null);
    });

    await waitForBoardReady(target);

    const shouldIgnore = (el) =>
      !!(
        el?.classList?.contains("pdf-progress-modal") ||
        el?.closest?.(".pdf-progress-modal")
      );

    const fullCanvas = await html2canvas(document.body, {
      backgroundColor: pdfBgColor,
      scale: 1,
      useCORS: true,
      cacheBust: false,
      imageTimeout: 0,
      allowTaint: true,
      logging: false,
      ignoreElements: shouldIgnore,
    });

    return cropCanvasToDataUrl(fullCanvas, target.getBoundingClientRect());
  };

  const captureTopBarFiveCols = async (snapshot, { withFullHarvest } = {}) => {
    const root = topBarRef.current || document.querySelector("header.topbar");
    const header = root?.querySelector
      ? root.querySelector("header.topbar") || root
      : root;

    if (!header) return null;

    flushSync(() => {
      applySnapshot(snapshot);
      setCheckpointIndex(null);
    });
    await waitForBoardReady(header);

    if (withFullHarvest) {
      flushSync(() => {
        harvestFullForPdf?.(snapshot?.layout, snapshot?.buildLocks);
      });
      await waitForBoardReady(header);
    }

    const children = Array.from(header.children || []);
    const targets = children.slice(0, 5).filter(Boolean);
    if (!targets.length) return null;

    const rects = targets.map((el) => el.getBoundingClientRect());
    const rect = {
      left: Math.min(...rects.map((r) => r.left)),
      top: Math.min(...rects.map((r) => r.top)),
      width:
        Math.max(...rects.map((r) => r.right)) -
        Math.min(...rects.map((r) => r.left)),
      height:
        Math.max(...rects.map((r) => r.bottom)) -
        Math.min(...rects.map((r) => r.top)),
    };

    const headerRect = header.getBoundingClientRect();
    const headerCanvas = await html2canvas(header, {
      backgroundColor: pdfBgColor,
      scale: 1,
      useCORS: true,
      cacheBust: false,
      imageTimeout: 0,
      allowTaint: true,
      logging: false,
    });

    const relRect = {
      left: rect.left - headerRect.left,
      top: rect.top - headerRect.top,
      width: rect.width,
      height: rect.height,
    };

    return cropElementCanvasToDataUrl(headerCanvas, relRect, headerRect);
  };

  return { captureBoardImage, captureTopBarFiveCols };
};
