import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Colors, Spacing } from "../config/theme";

interface EmptyStateProps {
  title: string;
  message?: string;
  description?: string;
  icon?: React.ReactNode;
}

export function EmptyState({ title, message, description, icon }: EmptyStateProps) {
  const displayMessage = message || description;
  return (
    <View style={styles.container}>
      {icon && <View style={styles.iconContainer}>{icon}</View>}
      <Text style={styles.title}>{title}</Text>
      {displayMessage && <Text style={styles.message}>{displayMessage}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.xxxl,
    paddingHorizontal: Spacing.xl,
  },
  iconContainer: {
    marginBottom: Spacing.md,
    opacity: 0.8,
  },
  title: {
    fontSize: 15,
    fontWeight: "700",
    color: Colors.text,
    textAlign: "center",
  },
  message: {
    fontSize: 12,
    color: Colors.textSecondary,
    textAlign: "center",
    marginTop: Spacing.xs,
    lineHeight: 18,
  },
});
