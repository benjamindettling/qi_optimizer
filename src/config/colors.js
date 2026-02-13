// Centralized color configuration for the entire application
// All color definitions should be imported from here to enable easy theming
// THIS IS THE SINGLE SOURCE OF TRUTH - no hex codes should exist elsewhere

// =============================================================================
// PRIMARY COLORS - Reused across actions, semantics, and themes
// =============================================================================
export const PRIMARY_COLORS = {
  // Core palette
  green: "#03d839",
  lightGreen: "#66ff99",
  blue: "#4C8BF5",
  turquoise: "#40e0d0",
  red: "#E5533D",
  lightRed: "#ff9b9b",
  yellow: "#F2B705",
  tealDark: "#004d4d",
  wood: "#deb887",
  gold: "#ac9652",
  gray: "#6b7280",
  darkGreen: "#007f20",
  adminMagenta: "#75002d",
  white: "#ffffff",
  black: "#000000",

  // Grayscale for light backgrounds
  grayDark: "#333", // google auth text
  grayLight: "#d1ccff", //google auth hover background

  // Selection/outline colors
  selectionBlue: "#74b0ff",
  selectionBlueBorder: "#4d8fd9",
};

// =============================================================================
// THEME BASE COLORS - 4-color system for each theme
// color1: Main body background (big surfaces)
// color2: Surface backgrounds (topbar, sidebars, panels, modals)
// color3: Button/input backgrounds
// color4: Borders, shadows, lines
// =============================================================================
export const BLUE_THEME = {
  blue1: "#0d1b2a", // main body background
  blue2: "#10253c", // topbar, panels, modals
  blue3: "#132f4c", // buttons, textfields
  blue4: "#1f3e63", // borders, shadows, lines
};

export const ADMIN_THEME = {
  admin1: "#1a0c16", // main body background
  admin2: "#241020", // topbar, panels, modals
  admin3: "#3a1a30", // buttons, textfields
  admin4: "#5d2a4d", // borders, shadows, lines
};

// =============================================================================
// THEME COLORS - Generated from base 4-color system
// =============================================================================
const createTheme = (colors, accent, textColors, extras = {}) => ({
  // Base colors
  bg: colors.color1,
  text: textColors.text,
  textStrong: textColors.textStrong,
  textMuted: textColors.textMuted,
  textSoft: textColors.textSoft,

  // Surface colors (all use color2)
  topbarBg: colors.color2,
  sidebarBg: colors.color2,
  panelBg: colors.color2,
  panelBgAlt: colors.color3,
  boardBg: colors.color1,
  statusBg: colors.color4,
  carryBg: colors.color4,

  // Border colors (all use color4)
  border: colors.color4,
  borderStrong: colors.color4,
  borderMuted: colors.color4,
  borderAccent: colors.color4,
  boardBorder: colors.color4,

  // Accent
  accent,

  // Button/input colors
  buttonBg: colors.color3,
  buttonBorder: colors.color4,

  // Misc
  tooltipBg: colors.color4,
  tooltipBorder: colors.color4,
  ...extras,
});

export const THEME_BLUE = createTheme(
  { color1: BLUE_THEME.blue1, color2: BLUE_THEME.blue2, color3: BLUE_THEME.blue3, color4: BLUE_THEME.blue4 },
  PRIMARY_COLORS.blue,
  { text: "#e9ecf1", textStrong: "#f3f6fb", textMuted: "#c3d2e5", textSoft: "#8797ad" },
  { regionNote: "#9bb6d6" }
);

export const THEME_ADMIN = createTheme(
  { color1: ADMIN_THEME.admin1, color2: ADMIN_THEME.admin2, color3: ADMIN_THEME.admin3, color4: ADMIN_THEME.admin4 },
  PRIMARY_COLORS.blue,
  { text: "#f2e9f0", textStrong: "#f7e8f2", textMuted: "#e9d2dd", textSoft: "#d2b9c7" },
  { regionNote: "#e9d2dd" }
);

// =============================================================================
// SEMANTIC COLORS - Common purpose colors
// =============================================================================
export const SEMANTIC_COLORS = {
  // Status colors
  success: PRIMARY_COLORS.green,
  warning: PRIMARY_COLORS.yellow,
  error: PRIMARY_COLORS.red,
  info: PRIMARY_COLORS.blue,

  // State colors
  negative: PRIMARY_COLORS.red, // For negative values (red)
  positive: PRIMARY_COLORS.green, // For positive values (green)
  neutral: PRIMARY_COLORS.gray, // Neutral/gray

  // Overlay colors
  overlayDark: "rgba(0, 0, 0, 0.35)",
  overlayLight: "rgba(255, 255, 255, 0.2)",
};

// =============================================================================
// CATEGORY COLORS - Building categories on the board
// =============================================================================
export const CATEGORY_COLORS = {
  housing: "#e2b93b", // Gold - residential buildings
  production: "#7ac25f", // Green - production buildings
  goods: "#4ab1ff", // Blue - goods buildings
  culture: "#a05cff", // Purple - culture buildings
  decoration: "#ff7f50", // Coral - decorations
  military: "#d84848", // Red - military buildings
  townhall: "#6c8da8", // Steel blue - townhall
};

// =============================================================================
// ACTION COLORS - Used in tree visualizer, buttons, and history actions
// =============================================================================
export const ACTION_COLORS = {
  // Primary actions
  build: PRIMARY_COLORS.green, // Green - building/placing
  move: PRIMARY_COLORS.blue, // Blue - moving buildings
  sell: PRIMARY_COLORS.red, // Red - selling/removing
  boostSingle: PRIMARY_COLORS.yellow, // Yellow - single boost
  collectSingle: PRIMARY_COLORS.gold, // Gold - collecting single

  // Bulk/system actions
  boostAll: PRIMARY_COLORS.tealDark, // Dark teal - boost all
  harvestPartial: PRIMARY_COLORS.wood, // Navy steel - partial harvest
  harvestFull: PRIMARY_COLORS.tealDark, // Dark teal - full harvest
  checkpoint: PRIMARY_COLORS.tealDark, // Dark teal - checkpoint marker

  // Special actions
  regionUnlock: PRIMARY_COLORS.darkGreen, // Dark green - unlocking regions
  admin: PRIMARY_COLORS.adminMagenta, // Brombeer/magenta - admin actions
  default: PRIMARY_COLORS.gray, // Gray - fallback/default
};

// =============================================================================
// UTILITY: Generate CSS custom properties from theme
// =============================================================================
export const themeToCssVars = (theme) => {
  return {
    // Background colors
    "--color-bg": theme.bg,
    "--color-topbar-bg": theme.topbarBg,
    "--color-sidebar-bg": theme.sidebarBg,
    "--color-panel-bg": theme.panelBg,
    "--color-panel-bg-alt": theme.panelBgAlt,
    "--color-board-bg": theme.boardBg,
    "--color-board-border": theme.boardBorder,
    "--color-status-bg": theme.statusBg,
    "--color-carry-bg": theme.carryBg,

    // Text colors
    "--color-text": theme.text,
    "--color-text-strong": theme.textStrong,
    "--color-text-muted": theme.textMuted,
    "--color-text-soft": theme.textSoft,

    // Border colors (all same)
    "--color-border": theme.border,
    "--color-border-strong": theme.borderStrong,
    "--color-border-muted": theme.borderMuted,
    "--color-border-accent": theme.borderAccent,

    // Accent & buttons
    "--color-accent": theme.accent,
    "--color-input-bg": theme.buttonBg,
    "--color-button-bg": theme.buttonBg,
    "--color-button-border": theme.buttonBorder,

    // Misc
    "--color-region-note": theme.regionNote,
    "--color-tooltip-bg": theme.tooltipBg,
    "--color-tooltip-border": theme.tooltipBorder,
  };
};

// =============================================================================
// UI COLORS - Additional CSS variables for component-specific colors
// These are theme-independent and exported as CSS custom properties
// =============================================================================
export const UI_COLORS = {
  // Selection/outline
  selectionBlue: PRIMARY_COLORS.selectionBlue,
  selectionBlueBorder: PRIMARY_COLORS.selectionBlueBorder,

  // Grayscale
  grayDark: PRIMARY_COLORS.grayDark,
  grayLight: PRIMARY_COLORS.grayLight,

  // Core
  white: PRIMARY_COLORS.white,
  black: PRIMARY_COLORS.black,

  // Region panel colors
  regionUnlocked: "#214a76",
  regionLocked: "#1b304a",
};

// Generate UI color CSS variables
export const uiColorsToCssVars = () => {
  return {
    "--ui-error-red": PRIMARY_COLORS.red,
    "--ui-error-red-soft": PRIMARY_COLORS.lightRed,
    "--ui-warning-orange": PRIMARY_COLORS.yellow,
    "--ui-warning-amber": PRIMARY_COLORS.yellow,
    "--ui-success-green": PRIMARY_COLORS.green,
    "--ui-success-green-dark": PRIMARY_COLORS.greenLight,
    "--ui-success-green-alt": PRIMARY_COLORS.green,
    "--ui-success-green-border": PRIMARY_COLORS.green,
    "--ui-success-green-light": PRIMARY_COLORS.lightGreen,
    "--ui-info-blue": PRIMARY_COLORS.blue,
    "--ui-info-blue-muted": PRIMARY_COLORS.blue,
    "--ui-info-blue-light": PRIMARY_COLORS.blue,
    "--ui-highlight-amber": PRIMARY_COLORS.yellow,
    "--ui-highlight-gold": PRIMARY_COLORS.yellow,
    "--ui-highlight-gold-border": PRIMARY_COLORS.yellow,
    "--ui-selection-blue": UI_COLORS.selectionBlue,
    "--ui-selection-blue-border": UI_COLORS.selectionBlueBorder,
    "--ui-gray-dark": UI_COLORS.grayDark,
    "--ui-gray-light": UI_COLORS.grayLight,
    "--ui-gray-muted": PRIMARY_COLORS.gray,
    "--ui-white": PRIMARY_COLORS.white,
    "--ui-black": PRIMARY_COLORS.black,
    "--ui-notes-green": PRIMARY_COLORS.green,
    "--ui-notes-red": PRIMARY_COLORS.red,
    "--ui-notes-yellow": PRIMARY_COLORS.yellow,
    "--ui-notes-turquoise": PRIMARY_COLORS.turquoise,
    "--ui-region-unlocked": UI_COLORS.regionUnlocked,
    "--ui-region-locked": UI_COLORS.regionLocked,
  };
};

// =============================================================================
// UTILITY: Apply theme CSS variables to the document root
// =============================================================================
export const applyThemeToDocument = (isAdmin = false) => {
  const root = document.documentElement;
  if (!root) return;

  // Apply theme colors
  const theme = isAdmin ? THEME_ADMIN : THEME_BLUE;
  const themeVars = themeToCssVars(theme);
  for (const [key, value] of Object.entries(themeVars)) {
    root.style.setProperty(key, value);
  }

  // Apply UI colors (theme-independent, only need to set once)
  const uiVars = uiColorsToCssVars();
  for (const [key, value] of Object.entries(uiVars)) {
    root.style.setProperty(key, value);
  }
};

// =============================================================================
// UTILITY: Initialize all CSS color variables on app load
// =============================================================================
export const initializeCssColors = () => {
  applyThemeToDocument(false); // Start with blue theme
};

// Legacy exports for backward compatibility
export const categoryColors = CATEGORY_COLORS;
