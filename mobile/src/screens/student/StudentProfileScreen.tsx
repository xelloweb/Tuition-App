import React from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";
import { Colors, BorderRadius, Spacing } from "../../config/theme";
import { Header } from "../../components/Header";
import { Card } from "../../components/Card";
import { Button } from "../../components/Button";
import { Badge } from "../../components/Badge";
import { useAuth } from "../../context/AuthContext";
import { GraduationCap, Phone, MapPin, Globe, BookOpen, LogOut } from "lucide-react-native";

export function StudentProfileScreen() {
  const { student, logout } = useAuth();

  return (
    <View style={styles.container}>
      <Header title="Student Profile" subtitle="Registration & Guardian Details" />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Profile Card */}
        <Card style={styles.profileCard}>
          <View style={styles.avatar}>
            <GraduationCap size={36} color={Colors.primary} />
          </View>
          <Text style={styles.name}>{student?.name || "Student"}</Text>
          <Badge label={student?.studentCode || "XST"} variant="primary" />

          <View style={styles.infoList}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Grade & Board:</Text>
              <Text style={styles.infoValue}>
                {student?.grade || "Grade"} • {student?.board || "CBSE"}
              </Text>
            </View>

            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Medium:</Text>
              <Text style={styles.infoValue}>{student?.medium || "English"}</Text>
            </View>

            {student?.guardianName && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Guardian:</Text>
                <Text style={styles.infoValue}>{student.guardianName}</Text>
              </View>
            )}

            {student?.whatsappNumber && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>WhatsApp:</Text>
                <Text style={styles.infoValue}>{student.whatsappNumber}</Text>
              </View>
            )}

            {student?.country && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Country / Time Zone:</Text>
                <Text style={styles.infoValue}>
                  {student.country} {student?.timeZone ? `(${student.timeZone})` : ""}
                </Text>
              </View>
            )}
          </View>
        </Card>

        {/* Enrolled Subjects */}
        {student?.enrolledSubjects && student.enrolledSubjects.length > 0 && (
          <Card style={styles.subjectsCard}>
            <Text style={styles.subjectsTitle}>Enrolled Subjects & Assigned Trainers</Text>
            {student.enrolledSubjects.map((sub) => (
              <View key={sub.subjectId} style={styles.subjectItem}>
                <Badge label={sub.subjectName} color={sub.subjectColor || Colors.primary} />
                <Text style={styles.trainerText}>{sub.teacherName || "Assigned soon"}</Text>
              </View>
            ))}
          </Card>
        )}

        <Button
          title="Sign Out / Switch Student"
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
    justifyContent: "space-between",
    marginVertical: 6,
  },
  infoLabel: {
    fontSize: 12,
    color: Colors.textMuted,
    fontWeight: "600",
  },
  infoValue: {
    fontSize: 13,
    color: Colors.text,
    fontWeight: "700",
  },
  subjectsCard: {
    marginBottom: Spacing.lg,
  },
  subjectsTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: Colors.text,
    marginBottom: Spacing.md,
  },
  subjectItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginVertical: 4,
    paddingVertical: 4,
  },
  trainerText: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontWeight: "600",
  },
});
