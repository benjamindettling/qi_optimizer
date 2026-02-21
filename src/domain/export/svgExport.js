// SVG export helpers shared by PNG and PDF export pipelines.

export const waitForFrame = () =>
  new Promise((resolve) => requestAnimationFrame(() => resolve()));

export const waitForSvgReady = async (rootEl) => {
  if (!rootEl) {
    await waitForFrame();
    await waitForFrame();
    return;
  }

  try {
    if (document?.fonts?.ready) {
      await Promise.race([
        document.fonts.ready,
        new Promise((resolve) => setTimeout(resolve, 500)),
      ]);
    }
  } catch {
    // ignore
  }

  await waitForFrame();
  await waitForFrame();
};

export const getSvgDimensions = (svgEl) => {
  if (!svgEl) return { width: 1, height: 1 };

  const vb = svgEl.viewBox?.baseVal;
  if (vb && vb.width > 0 && vb.height > 0) {
    return { width: vb.width, height: vb.height };
  }

  const widthAttr = Number.parseFloat(svgEl.getAttribute("width") || "");
  const heightAttr = Number.parseFloat(svgEl.getAttribute("height") || "");

  return {
    width: Number.isFinite(widthAttr) && widthAttr > 0 ? widthAttr : 1,
    height: Number.isFinite(heightAttr) && heightAttr > 0 ? heightAttr : 1,
  };
};

const GEOMETRY_ATTRS = new Set([
  "x",
  "y",
  "x1",
  "y1",
  "x2",
  "y2",
  "cx",
  "cy",
  "r",
  "rx",
  "ry",
  "width",
  "height",
  "stroke-width",
  "stroke-dasharray",
  "font-size",
  "viewBox",
  "d",
  "transform",
  "points",
]);

const roundNumber = (value, decimals = 2) => {
  const num = Number(value);
  if (!Number.isFinite(num)) return value;
  const rounded = Number(num.toFixed(decimals));
  return Object.is(rounded, -0) ? "0" : `${rounded}`;
};

const reduceNumericPrecision = (input, decimals = 2) =>
  String(input).replace(
    /-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/gi,
    (match) => roundNumber(match, decimals),
  );

const reduceSvgPrecision = (svgRoot, decimals = 2) => {
  if (!svgRoot?.querySelectorAll) return;
  const all = [svgRoot, ...svgRoot.querySelectorAll("*")];
  all.forEach((node) => {
    if (!node?.attributes) return;
    Array.from(node.attributes).forEach((attr) => {
      if (!GEOMETRY_ATTRS.has(attr.name)) return;
      node.setAttribute(attr.name, reduceNumericPrecision(attr.value, decimals));
    });
  });
};

export const serializeSvgNode = (svgEl) => {
  if (!svgEl) return "";

  const clone = svgEl.cloneNode(true);
  const { width, height } = getSvgDimensions(svgEl);

  if (!clone.getAttribute("xmlns")) {
    clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  }
  if (!clone.getAttribute("xmlns:xlink")) {
    clone.setAttribute("xmlns:xlink", "http://www.w3.org/1999/xlink");
  }

  clone.setAttribute("width", roundNumber(width, 2));
  clone.setAttribute("height", roundNumber(height, 2));
  if (!clone.getAttribute("viewBox")) {
    clone.setAttribute("viewBox", `0 0 ${roundNumber(width, 2)} ${roundNumber(height, 2)}`);
  }

  reduceSvgPrecision(clone, 2);

  return new XMLSerializer().serializeToString(clone);
};

export const svgStringToElement = (svgString) => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(svgString, "image/svg+xml");
  const errorNode = doc.querySelector("parsererror");
  if (errorNode) {
    throw new Error("Failed to parse serialized SVG.");
  }

  const svgNode = doc.documentElement;
  if (!svgNode || svgNode.nodeName.toLowerCase() !== "svg") {
    throw new Error("Serialized board is not an SVG root element.");
  }

  return svgNode;
};

export const svgStringToPngDataUrl = async (
  svgString,
  { width, height, backgroundColor = null } = {},
) => {
  const blob = new Blob([svgString], {
    type: "image/svg+xml;charset=utf-8",
  });
  const objectUrl = URL.createObjectURL(blob);

  try {
    const image = await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("Failed to load serialized SVG."));
      img.src = objectUrl;
    });

    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(width || image.width || 1));
    canvas.height = Math.max(1, Math.round(height || image.height || 1));

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("Could not acquire canvas 2D context.");
    }

    if (backgroundColor) {
      ctx.fillStyle = backgroundColor;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/png");
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
};
