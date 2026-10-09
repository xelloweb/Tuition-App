import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, Image } from "react-native";
import { Colors, Spacing } from "../config/theme";
import { LogOut } from "lucide-react-native";
import { useAuth } from "../context/AuthContext";

interface HeaderProps {
  title: string;
  subtitle?: string;
  showLogout?: boolean;
  rightElement?: React.ReactNode;
}

export function Header({
  title,
  subtitle,
  showLogout = true,
  rightElement,
}: HeaderProps) {
  const { logout, role, user, trainer } = useAuth();

  const userBadge = role === "TRAINER" ? "Trainer" : role === "COORDINATOR" ? "Coordinator" : "Admin";
  const userName = trainer?.name || user?.name;

  return (
    <View style={styles.container}>
      <View style={styles.brandingRow}>
        <Image
          source={require("../../assets/icon.png")}
          style={styles.brandIcon}
          resizeMode="contain"
        />
        <View style={styles.textContainer}>
          <View style={styles.badgeRow}>
            <View style={styles.dot} />
            <Text style={styles.badgeText}>
              {userBadge} {userName ? `• ${userName}` : ""}
            </Text>
          </View>
          <Text style={styles.title} numberOfLines={1}>{title}</Text>
          {subtitle && <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text>}
        </View>
      </View>

      <View style={styles.actions}>
        {rightElement}
        {showLogout && (
          <TouchableOpacity
            style={styles.logoutButton}
            onPress={logout}
            activeOpacity={0.7}
            accessibilityLabel="Sign out"
          >
            <LogOut size={18} color={Colors.textSecondary} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.md,
    backgroundColor: Colors.background,
    borderBottomWidth: 1,
    borderBottomColor: Colors.cardBorder,
  },
  brandingRow: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
  },
  brandIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    marginRight: 10,
    borderWidth: 1.5,
    borderColor: "rgba(64, 174, 227, 0.4)",
  },
  textContainer: {
    flex: 1,
  },
  badgeRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 2,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.primary,
    marginRight: 6,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: "700",
    color: Colors.primary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  title: {
    fontSize: 19,
    fontWeight: "800",
    color: Colors.text,
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
  },
  logoutButton: {
    padding: Spacing.sm,
    backgroundColor: Colors.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    marginLeft: Spacing.sm,
    minHeight: 40,
    minWidth: 40,
    alignItems: "center",
    justifyContent: "center",
  },
});
