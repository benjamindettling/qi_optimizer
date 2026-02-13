// Bauplan notes rendering helpers for PDF export.
export const stripHtml = (s) =>
  (s || "")
    .replace(/<\/?span[^>]*>/gi, "")
    .replace(/<br\s*\/?\s*>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trimEnd();

export const buildBauplanLines = (items) => {
  const parts = items?.length || 0;
  const lines = [];
  for (let idx = 0; idx < parts; idx += 1) {
    const cp = items[idx];
    if (idx > 0) lines.push({ type: "sep" });
    if (parts > 1) {
      lines.push({
        type: "title",
        text: `Teil ${idx + 1} von ${parts}`,
      });
    }
    const raw = stripHtml(cp?.snapshot?.notes || "");
    const rawLines = raw.split(/\n/).map((l) => l.trimEnd());
    const hasAny = rawLines.some((l) => l.trim().length > 0);
    if (!hasAny) {
      lines.push({ type: "text", text: "(keine Notizen)" });
    } else {
      rawLines.forEach((l) => {
        if (!l.trim()) return;
        lines.push({ type: "text", text: l });
      });
    }
  }
  return lines;
};

export const drawBauplanTextBlock = (
  pdf,
  lines,
  { x, y, width, maxHeight, lineHeight = 14, paddingX = 6, paddingY = 4 },
) => {
  const startY = y;
  const innerW = Math.max(10, width - paddingX * 2);
  let cursorY = y;

  const setMono = (weight = "bold", size = 11) => {
    pdf.setFont("courier", weight);
    pdf.setFontSize(size);
  };

  const bgForLine = (t) => {
    const s = (t || "").trimStart();
    if (s.startsWith("->")) return { r: 7, g: 95, b: 167 };
    if (s.startsWith("+")) return { r: 47, g: 138, b: 79 };
    if (s.startsWith("-")) return { r: 163, g: 41, b: 41 };
    return { r: 7, g: 95, b: 167 };
  };

  const highlightTokens = ["(1h)", "(boost)"];

  const drawLineWithInlineHighlights = (text, { bg }) => {
    if (!text) return;

    if (bg) {
      pdf.setFillColor(bg.r, bg.g, bg.b);
      pdf.rect(x, cursorY, width, lineHeight + paddingY, "F");
    }

    setMono("bold", 14);
    pdf.setTextColor(255, 255, 255);
    const textY = cursorY + lineHeight;
    pdf.text(text, x + paddingX, textY);

    setMono("bold", 14);
    const baseX = x + paddingX;
    const baseYTop = cursorY + 2;
    const rectH = lineHeight + 1;

    for (const token of highlightTokens) {
      let fromIndex = 0;
      while (true) {
        const pos = text.indexOf(token, fromIndex);
        if (pos === -1) break;
        const before = text.slice(0, pos);
        const wBefore = pdf.getTextWidth(before);
        const wTok = pdf.getTextWidth(token);
        pdf.setFillColor(184, 134, 11);
        pdf.rect(baseX + wBefore - 1, baseYTop, wTok + 2, rectH, "F");
        pdf.setTextColor(255, 255, 255);
        pdf.text(token, baseX + wBefore, textY);
        fromIndex = pos + token.length;
      }
    }

    cursorY += lineHeight + paddingY;
  };

  for (const ln of lines || []) {
    if (cursorY - startY > maxHeight - lineHeight * 1.5) {
      pdf.setTextColor(255, 255, 255);
      setMono("normal", 11);
      pdf.text("...", x + paddingX, cursorY + lineHeight);
      cursorY += lineHeight;
      break;
    }

    if (ln.type === "sep") {
      pdf.setDrawColor(240, 244, 255);
      pdf.setLineWidth(0.5);
      pdf.line(x, cursorY + 6, x + width, cursorY + 6);
      cursorY += 10;
      continue;
    }

    if (ln.type === "title") {
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(11);
      pdf.setTextColor(240, 244, 255);
      pdf.text(ln.text || "", x + paddingX, cursorY + lineHeight);
      cursorY += lineHeight + paddingY;
      continue;
    }

    const text = ln.text || "";
    const bg = bgForLine(text);

    setMono("normal", 11);
    const wrapped = pdf.splitTextToSize(text, innerW);
    wrapped.forEach((w) => drawLineWithInlineHighlights(w, { bg }));
  }

  return cursorY - startY;
};
