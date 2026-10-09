export const Colors = {
  // Official Xello Brand Colors
  brandNavy: "#222477",
  brandCyan: "#40aee3",
  brandLime: "#cbdc42",

  // Theme Core
  background: "#090e17",
  surface: "#0f172a",
  surfaceSubtle: "#131d33",
  card: "#111c30",
  cardBorder: "#1e293b",
  border: "#1e293b",
  cardBorderLight: "#334155",

  // Accents
  primary: "#40aee3", // Cyan / Sky Blue (Xello brand)
  primaryDark: "#0284c7",
  primaryLight: "rgba(64, 174, 227, 0.15)",
  primaryBorder: "rgba(64, 174, 227, 0.3)",

  secondary: "#cbdc42", // Lime Green (Xello brand)
  secondaryDark: "#a3b827",
  secondaryLight: "rgba(203, 220, 66, 0.15)",
  secondaryBorder: "rgba(203, 220, 66, 0.3)",

  teal: "#40aee3", // Mapped to brand cyan for backward compatibility
  lime: "#cbdc42",
  purple: "#8b5cf6",
  purpleLight: "rgba(139, 92, 246, 0.15)",

  success: "#10b981", // Emerald
  successLight: "rgba(16, 185, 129, 0.15)",
  successBorder: "rgba(16, 185, 129, 0.3)",

  warning: "#f59e0b", // Amber
  warningLight: "rgba(245, 158, 11, 0.15)",
  warningBorder: "rgba(245, 158, 11, 0.3)",

  danger: "#f43f5e", // Rose
  dangerLight: "rgba(244, 63, 94, 0.15)",
  dangerBorder: "rgba(244, 63, 94, 0.3)",

  info: "#38bdf8", // Sky blue
  infoLight: "rgba(56, 189, 248, 0.15)",
  infoBorder: "rgba(56, 189, 248, 0.3)",

  // Text
  text: "#ffffff",
  textSecondary: "#94a3b8",
  textMuted: "#64748b",
  textDark: "#0f172a",

  // Utilities
  inputBg: "#0b1220",
  inputBorder: "#27354f",
  activeTab: "#40aee3",
  inactiveTab: "#64748b",
  divider: "#1e293b",
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
};

export const BorderRadius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  full: 9999,
};

export const FontSize = {
  xs: 12,
  sm: 14,
  base: 16,
  lg: 18,
  xl: 20,
  "2xl": 24,
  "3xl": 30,
};

export const theme = {
  colors: Colors,
  spacing: Spacing,
  borderRadius: BorderRadius,
  fontSize: FontSize,
};
