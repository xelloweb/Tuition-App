import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../../context/AuthContext";
import { theme } from "../../config/theme";
import { Header } from "../../components/Header";
import { Card } from "../../components/Card";
import { Button } from "../../components/Button";
import { Shield, Mail, LogOut, CheckCircle, Smartphone } from "lucide-react-native";

export function AdminProfileScreen() {
  const { user, logout } = useAuth();

  return (
    <SafeAreaView style={styles.container}>
      <Header title="Admin Profile" subtitle="System & Security Details" />

      <View style={styles.content}>
        {/* User Card */}
        <Card style={styles.userCard}>
          <View style={styles.avatar}>
            <Shield size={36} color={theme.colors.teal} />
          </View>
          <Text style={styles.userName}>{user?.name || "Administrator"}</Text>
          <Text style={styles.userRole}>
            {user?.role === "OWNER" ? "System Owner & Admin" : "Academic Coordinator"}
          </Text>

          <View style={styles.detailsList}>
            <View style={styles.detailRow}>
              <Mail size={16} color={theme.colors.textMuted} />
              <Text style={styles.detailText}>{user?.email || "admin@xellotuition.com"}</Text>
            </View>
            <View style={styles.detailRow}>
              <CheckCircle size={16} color={theme.colors.success} />
              <Text style={styles.detailText}>Platform Status: Active</Text>
            </View>
            <View style={styles.detailRow}>
              <Smartphone size={16} color={theme.colors.teal} />
              <Text style={styles.detailText}>App Version: 1.0.0 (Staff Build)</Text>
            </View>
          </View>
        </Card>

        {/* Operational Scope Card */}
        <Card style={styles.scopeCard}>
          <Text style={styles.scopeTitle}>OPERATIONAL ACCESS</Text>
          <Text style={styles.scopeDesc}>
            You have administrative privileges to view all academic student profiles, oversee trainer schedules, review attendance logs, and monitor teaching hours across Kerala and GCC operations.
          </Text>
        </Card>

        {/* Logout */}
        <Button
          title="Sign Out of Portal"
          variant="outline"
          onPress={logout}
          style={{ borderColor: theme.colors.danger, marginTop: "auto" }}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  content: {
    flex: 1,
    padding: theme.spacing.lg,
  },
  userCard: {
    alignItems: "center",
    padding: theme.spacing.xl,
    marginBottom: theme.spacing.lg,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "rgba(20, 184, 166, 0.12)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: theme.spacing.md,
    borderWidth: 1.5,
    borderColor: "rgba(20, 184, 166, 0.35)",
  },
  userName: {
    fontSize: theme.fontSize.lg,
    fontWeight: "700",
    color: theme.colors.text,
  },
  userRole: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.teal,
    fontWeight: "600",
    marginTop: 2,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  detailsList: {
    width: "100%",
    marginTop: theme.spacing.lg,
    paddingTop: theme.spacing.md,
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 255, 255, 0.05)",
    gap: theme.spacing.sm,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
  },
  detailText: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textSecondary,
  },
  scopeCard: {
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.lg,
  },
  scopeTitle: {
    fontSize: theme.fontSize.xs,
    fontWeight: "700",
    color: theme.colors.textSecondary,
    letterSpacing: 1,
    marginBottom: theme.spacing.xs,
  },
  scopeDesc: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textMuted,
    lineHeight: 18,
  },
});
