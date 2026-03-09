import { useEffect, useMemo, useRef, useState } from "react";
import "./QiInput.css";

const GROUP_SEPARATOR = "'";

const toFiniteNumber = (value, fallback = 0) => {
  const next = Number(value);
  return Number.isFinite(next) ? next : fallback;
};

const sanitizeNumberText = (rawValue, allowNegative) => {
  const raw = String(rawValue ?? "")
    .replaceAll(GROUP_SEPARATOR, "")
    .replace(/[`]/g, "")
    .replaceAll(" ", "");
  const cleaned = raw.replace(/[^0-9-]/g, "");
  if (!allowNegative) return cleaned.replace(/-/g, "");
  if (!cleaned) return "";
  const hasLeadingMinus = cleaned.startsWith("-");
  const digits = cleaned.replace(/-/g, "");
  if (!digits) return hasLeadingMinus ? "-" : "";
  return hasLeadingMinus ? `-${digits}` : digits;
};

const groupDigits = (digits) =>
  String(digits ?? "").replace(/\B(?=(\d{3})+(?!\d))/g, GROUP_SEPARATOR);

const formatNumberText = (raw) => {
  if (raw === "" || raw === "-") return raw;
  const negative = raw.startsWith("-");
  const digits = negative ? raw.slice(1) : raw;
  const grouped = groupDigits(digits);
  return negative ? `-${grouped}` : grouped;
};

const normalizeNumberValue = (value, { allowNegative, fallbackNumber }) => {
  const fallback = Math.trunc(toFiniteNumber(fallbackNumber, 0));
  const parsed = toFiniteNumber(
    typeof value === "string" ? value.replaceAll(GROUP_SEPARATOR, "") : value,
    fallback,
  );
  const rounded = Math.trunc(parsed);
  if (!allowNegative && rounded < 0) return "0";
  return String(rounded);
};

const countDigits = (value) => (String(value ?? "").match(/\d/g) || []).length;

const cursorFromDigitCount = (formatted, digitsBeforeCursor) => {
  if (digitsBeforeCursor <= 0) {
    return formatted.startsWith("-") ? 1 : 0;
  }
  let seenDigits = 0;
  for (let idx = 0; idx < formatted.length; idx += 1) {
    if (/\d/.test(formatted[idx])) {
      seenDigits += 1;
      if (seenDigits >= digitsBeforeCursor) {
        return idx + 1;
      }
    }
  }
  return formatted.length;
};

const clampNumber = (value, min, max) => {
  let next = value;
  if (Number.isFinite(min)) next = Math.max(min, next);
  if (Number.isFinite(max)) next = Math.min(max, next);
  return next;
};

export function QiInput({
  mode = "text",
  type = "text",
  value,
  onChange,
  className = "",
  fullWidth = false,
  selectOnFocus = true,
  fallbackNumber = 0,
  allowNegative = true,
  formatThousands = true,
  onFocus,
  onBlur,
  min,
  max,
  ...rest
}) {
  const isNumberMode = mode === "number";
  const inputRef = useRef(null);
  const [focused, setFocused] = useState(false);
  const [numberDraft, setNumberDraft] = useState(() => {
    if (!isNumberMode) return "";
    const normalized = normalizeNumberValue(value, {
      allowNegative,
      fallbackNumber,
    });
    return formatThousands ? formatNumberText(normalized) : normalized;
  });

  const inputClassName = useMemo(
    () =>
      [
        "qi-input",
        isNumberMode ? "qi-input--number" : "",
        fullWidth ? "qi-input--full" : "",
        className,
      ]
        .filter(Boolean)
        .join(" "),
    [className, fullWidth, isNumberMode],
  );

  useEffect(() => {
    if (!isNumberMode || focused) return;
    const normalized = normalizeNumberValue(value, {
      allowNegative,
      fallbackNumber,
    });
    setNumberDraft(formatThousands ? formatNumberText(normalized) : normalized);
  }, [value, allowNegative, fallbackNumber, focused, formatThousands, isNumberMode]);

  const handleFocus = (event) => {
    setFocused(true);
    if (selectOnFocus) {
      requestAnimationFrame(() => {
        event.target?.select?.();
      });
    }
    onFocus?.(event);
  };

  const handleTextChange = (event) => {
    onChange?.(event.target.value);
  };

  const handleNumberChange = (event) => {
    const raw = event.target.value;
    const cursor = event.target.selectionStart ?? raw.length;
    const digitsBeforeCursor = countDigits(raw.slice(0, cursor));

    const normalized = sanitizeNumberText(raw, allowNegative);
    const nextDisplay = formatThousands
      ? formatNumberText(normalized)
      : normalized;
    setNumberDraft(nextDisplay);

    if (normalized !== "" && normalized !== "-") {
      const parsed = toFiniteNumber(normalized, null);
      if (Number.isFinite(parsed)) {
        onChange?.(Math.trunc(parsed));
      }
    }

    requestAnimationFrame(() => {
      const node = inputRef.current;
      if (!node || document.activeElement !== node) return;
      const nextCursor = cursorFromDigitCount(nextDisplay, digitsBeforeCursor);
      node.setSelectionRange(nextCursor, nextCursor);
    });
  };

  const commitNumberValue = (raw) => {
    const normalized = sanitizeNumberText(raw, allowNegative);
    const fallback = Math.trunc(toFiniteNumber(fallbackNumber, 0));
    let committed;
    if (!normalized || normalized === "-") {
      committed = fallback;
    } else {
      committed = Math.trunc(toFiniteNumber(normalized, fallback));
    }
    if (!allowNegative && committed < 0) committed = 0;
    committed = Math.trunc(clampNumber(committed, min, max));
    onChange?.(committed);
    const display = formatThousands
      ? formatNumberText(String(committed))
      : String(committed);
    setNumberDraft(display);
  };

  const handleBlur = (event) => {
    setFocused(false);
    if (isNumberMode) {
      commitNumberValue(numberDraft);
    }
    onBlur?.(event);
  };

  if (isNumberMode) {
    return (
      <input
        {...rest}
        ref={inputRef}
        type="text"
        inputMode={rest.inputMode ?? "numeric"}
        className={inputClassName}
        value={numberDraft}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onChange={handleNumberChange}
      />
    );
  }

  return (
    <input
      {...rest}
      ref={inputRef}
      type={type}
      className={inputClassName}
      value={value ?? ""}
      onFocus={handleFocus}
      onBlur={handleBlur}
      onChange={handleTextChange}
    />
  );
}

