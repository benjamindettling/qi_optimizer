// Utilities for formatting notes text with inline highlight rules.
export const NOTE_RULES = [
  { regex: /\+/g, className: "notes-green" },
  { regex: /-/g, className: "notes-red" },
  { regex: />>/g, className: "notes-turquoise", fullLine: true },
  { regex: /\(1h\)/g, className: "notes-yellow" },
  { regex: /\(boost\)/g, className: "notes-yellow" },
];

const applyRuleToLineHtml = (lineHtml, rule) => {
  if (!lineHtml) return lineHtml;

  if (rule.fullLine) {
    const match = lineHtml.match(rule.regex);
    if (!match) return lineHtml;

    const plain = lineHtml
      .replace(/<span[^>]*>/g, "")
      .replace(/<\/span>/g, "");

    return `<span class="${rule.className}">${plain}</span>`;
  }

  const parts = lineHtml.split(/(<[^>]+>)/g);
  const processed = parts.map((part) => {
    if (part.startsWith("<")) return part;

    return part.replace(rule.regex, (match) => {
      return `<span class="${rule.className}">${match}</span>`;
    });
  });

  return processed.join("");
};

export const formatNotesHtml = (text, placeholder = "Fuege Notizen hinzu") => {
  const raw = text || "";
  let htmlLines = raw.split(/\n/);

  for (const rule of NOTE_RULES) {
    htmlLines = htmlLines.map((lineHtml) => applyRuleToLineHtml(lineHtml, rule));
  }

  const merged = htmlLines.join("<br />");
  return merged || `<span class="notes-placeholder">${placeholder}</span>`;
};
