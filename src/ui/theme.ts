import { useColorScheme } from "react-native";

export interface Colors {
  background: string;
  card: string;
  text: string;
  muted: string;
  border: string;
  accent: string;
  live: string;
  banner: string;
  bannerText: string;
}

export const lightColors: Colors = {
  background: "#f2f3f5",
  card: "#ffffff",
  text: "#14171a",
  muted: "#6b7280",
  border: "#e2e4e8",
  accent: "#2563eb",
  live: "#dc2626",
  banner: "#fef3c7",
  bannerText: "#78350f",
};

export const darkColors: Colors = {
  background: "#0e0f11",
  card: "#1a1c20",
  text: "#f2f3f5",
  muted: "#9ca3af",
  border: "#2a2d33",
  accent: "#60a5fa",
  live: "#f87171",
  banner: "#3b2f12",
  bannerText: "#fde68a",
};

export function useColors(): Colors {
  return useColorScheme() === "dark" ? darkColors : lightColors;
}

/** Numbers that line up in columns. */
export const tabular = { fontVariant: ["tabular-nums" as const] };
