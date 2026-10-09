import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Colors, Spacing } from "../config/theme";
import { Button } from "./Button";

interface EmptyStateProps {
  title: string;
  message?: string;
  description?: string;
  icon?: React.ReactNode;
  /** Optional button under the message, e.g. "Try again" after a failed load. */
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({ title, message, description, icon, actionLabel, onAction }: EmptyStateProps) {
  const displayMessage = message || description;
  return (
    <View style={styles.container}>
      {icon && <View style={styles.iconContainer}>{icon}</View>}
      <Text style={styles.title}>{title}</Text>
      {displayMessage && <Text style={styles.message}>{displayMessage}</Text>}
      {actionLabel && onAction && (
        <Button title={actionLabel} onPress={onAction} variant="outline" size="sm" style={styles.action} />
      )}
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
  action: {
    marginTop: Spacing.lg,
    minWidth: 140,
  },
  message: {
    fontSize: 12,
    color: Colors.textSecondary,
    textAlign: "center",
    marginTop: Spacing.xs,
    lineHeight: 18,
  },
});
