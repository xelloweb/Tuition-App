import React from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from "react-native";
import { Colors, BorderRadius, Spacing } from "../../config/theme";
import { Header } from "../../components/Header";
import { Card } from "../../components/Card";
import { Button } from "../../components/Button";
import { Badge } from "../../components/Badge";
import { useAuth } from "../../context/AuthContext";
import { User, Mail, Phone, BookOpen, ShieldCheck, LogOut } from "lucide-react-native";

export function TrainerProfileScreen() {
  const { trainer, logout } = useAuth();

  return (
    <View style={styles.container}>
      <Header title="My Profile" subtitle="Trainer Account & Settings" />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Profile Card */}
        <Card style={styles.profileCard}>
          <View style={styles.avatar}>
            <User size={36} color={Colors.primary} />
          </View>
          <Text style={styles.name}>{trainer?.name || "Trainer"}</Text>
          <Badge label="Academic Trainer" variant="primary" />

          <View style={styles.infoList}>
            <View style={styles.infoRow}>
              <Mail size={16} color={Colors.textMuted} style={styles.infoIcon} />
              <Text style={styles.infoText}>{trainer?.email || "No email"}</Text>
            </View>

            {trainer?.phone && (
              <View style={styles.infoRow}>
                <Phone size={16} color={Colors.textMuted} style={styles.infoIcon} />
                <Text style={styles.infoText}>{trainer.phone}</Text>
              </View>
            )}

            <View style={styles.infoRow}>
              <ShieldCheck size={16} color={Colors.textMuted} style={styles.infoIcon} />
              <Text style={styles.infoText}>Role: Academic Trainer (Subject-Restricted)</Text>
            </View>
          </View>
        </Card>

        {/* Operating Rules Card */}
        <Card style={styles.notesCard}>
          <Text style={styles.notesTitle}>Operational Guidelines</Text>
          <Text style={styles.notesText}>
            • Attendance is 100% manual. Always mark attendance promptly after each completed class.
          </Text>
          <Text style={styles.notesText}>
            • Marking attendance automatically deducts 1 class credit and updates your trainer working hours.
          </Text>
          <Text style={styles.notesText}>
            • Timetable slots are strictly for display and scheduling purposes.
          </Text>
        </Card>

        <Button
          title="Sign Out"
          variant="danger"
          onPress={logout}
          icon={<LogOut size={16} color={Colors.danger} />}
          style={{ marginTop: Spacing.xl }}
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    padding: Spacing.lg,
    paddingBottom: Spacing.xxxl,
  },
  profileCard: {
    alignItems: "center",
    paddingVertical: Spacing.xl,
    marginBottom: Spacing.lg,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 24,
    backgroundColor: Colors.primaryLight,
    borderWidth: 1,
    borderColor: Colors.primaryBorder,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.md,
  },
  name: {
    fontSize: 20,
    fontWeight: "900",
    color: Colors.text,
    marginBottom: Spacing.xs,
  },
  infoList: {
    width: "100%",
    marginTop: Spacing.lg,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.cardBorder,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 6,
  },
  infoIcon: {
    marginRight: Spacing.sm,
  },
  infoText: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  notesCard: {
    backgroundColor: "rgba(20, 184, 166, 0.05)",
    borderColor: "rgba(20, 184, 166, 0.2)",
  },
  notesTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: Colors.primary,
    marginBottom: Spacing.sm,
  },
  notesText: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginVertical: 3,
    lineHeight: 18,
  },
});
