import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Colors, BorderRadius, Spacing } from "../config/theme";

interface BadgeProps {
  label: string;
  variant?: "primary" | "secondary" | "success" | "warning" | "danger" | "info" | "neutral";
  color?: string;
  size?: "sm" | "md";
}

export function Badge({ label, variant = "primary", color, size = "md" }: BadgeProps) {
  let bgColor = Colors.primaryLight;
  let borderColor = Colors.primaryBorder;
  let textColor = Colors.primary;

  if (color) {
    bgColor = `${color}20`;
    borderColor = `${color}40`;
    textColor = color;
  } else {
    switch (variant) {
      case "secondary":
        bgColor = Colors.secondaryLight;
        borderColor = Colors.secondaryBorder;
        textColor = Colors.secondary;
        break;
      case "success":
        bgColor = Colors.successLight;
        borderColor = Colors.successBorder;
        textColor = Colors.success;
        break;
      case "warning":
        bgColor = Colors.warningLight;
        borderColor = Colors.warningBorder;
        textColor = Colors.warning;
        break;
      case "danger":
        bgColor = Colors.dangerLight;
        borderColor = Colors.dangerBorder;
        textColor = Colors.danger;
        break;
      case "info":
        bgColor = Colors.infoLight;
        borderColor = Colors.infoBorder;
        textColor = Colors.info;
        break;
      case "neutral":
        bgColor = "rgba(148, 163, 184, 0.15)";
        borderColor = "rgba(148, 163, 184, 0.3)";
        textColor = Colors.textSecondary;
        break;
    }
  }

  const isSmall = size === "sm";

  return (
    <View
      style={[
        styles.badge,
        { backgroundColor: bgColor, borderColor },
        isSmall && styles.badgeSm,
      ]}
    >
      <Text style={[styles.text, { color: textColor }, isSmall && styles.textSm]}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: Spacing.sm + 2,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    alignSelf: "flex-start",
  },
  badgeSm: {
    paddingHorizontal: Spacing.xs + 2,
    paddingVertical: 1,
  },
  text: {
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  textSm: {
    fontSize: 10,
  },
});
