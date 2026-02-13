import { cropCanvasToDataUrl } from "./pdfCapture";

// Export the board as a PNG by cropping the full-page capture.
export const printBoardPng = async ({ boardRef, loadName }) => {
  const body = document.body;
  body.classList.add("print-mode");

  try {
    const html2canvas = (await import("html2canvas")).default;
    const target = boardRef.current;
    if (!target) return;
    const shouldIgnore = (el) => el?.classList?.contains("pdf-progress-modal");

    const fullCanvas = await html2canvas(document.body, {
      backgroundColor: null,
      scale: 1,
      useCORS: true,
      cacheBust: false,
      imageTimeout: 0,
      allowTaint: true,
      logging: false,
      ignoreElements: shouldIgnore,
    });

    const cropped = cropCanvasToDataUrl(fullCanvas, target.getBoundingClientRect());
    const a = document.createElement("a");
    a.href = cropped.dataUrl;
    a.download = `${loadName || "current_setup"}.png`;
    a.click();
  } catch (e) {
    console.error("Failed to print board", e);
  } finally {
    body.classList.remove("print-mode");
  }
};
