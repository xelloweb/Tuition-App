import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Colors, BorderRadius, Spacing } from "../config/theme";

interface StatCardProps {
  label?: string;
  title?: string;
  value: string | number;
  icon?: React.ReactNode;
  color?: string;
  subtext?: string;
}

export function StatCard({
  label,
  title,
  value,
  icon,
  color = Colors.primary,
  subtext,
}: StatCardProps) {
  const displayLabel = label || title || "";
  return (
    <View style={styles.card}>
      <View style={styles.topRow}>
        <Text style={styles.label}>{displayLabel}</Text>
        {icon && (
          <View style={[styles.iconContainer, { backgroundColor: `${color}15`, borderColor: `${color}30` }]}>
            {icon}
          </View>
        )}
      </View>
      <Text style={[styles.value, { color }]}>{value}</Text>
      {subtext && <Text style={styles.subtext}>{subtext}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    padding: Spacing.md,
    marginHorizontal: Spacing.xs,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.xs,
  },
  label: {
    fontSize: 11,
    fontWeight: "700",
    color: Colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  iconContainer: {
    padding: Spacing.xs,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  value: {
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: 0.5,
    marginVertical: 2,
  },
  subtext: {
    fontSize: 10,
    color: Colors.textMuted,
  },
});
