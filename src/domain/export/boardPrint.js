import {
  getSvgDimensions,
  serializeSvgNode,
  svgStringToPngDataUrl,
  waitForSvgReady,
} from "./svgExport";

// Export the board as PNG from the SVG node.
export const printBoardPng = async ({ boardRef, loadName }) => {
  try {
    const target = boardRef?.current;
    if (!target) return;

    await waitForSvgReady(target);

    const svgString = serializeSvgNode(target);
    const { width, height } = getSvgDimensions(target);
    const dataUrl = await svgStringToPngDataUrl(svgString, { width, height });

    const anchor = document.createElement("a");
    anchor.href = dataUrl;
    anchor.download = `${loadName || "current_setup"}.png`;
    anchor.click();
  } catch (error) {
    console.error("Failed to print board", error);
  }
};
