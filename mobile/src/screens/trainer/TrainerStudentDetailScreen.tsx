import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Linking,
  Alert,
} from "react-native";
import { Colors, BorderRadius, Spacing } from "../../config/theme";
import { Card } from "../../components/Card";
import { Badge } from "../../components/Badge";
import { Button } from "../../components/Button";
import {
  GraduationCap,
  Calendar,
  Clock,
  MessageSquare,
  ArrowLeft,
  Layers,
  BookOpen,
} from "lucide-react-native";

export function TrainerStudentDetailScreen({ route, navigation }: any) {
  const { student } = route.params || {};

  if (!student) {
    return (
      <View style={styles.container}>
        <Text style={{ color: "#fff", padding: 20 }}>Student details not found.</Text>
      </View>
    );
  }

  const handleWhatsApp = () => {
    if (!student.whatsappNumber) {
      Alert.alert("No Contact", "No phone number recorded for this student.");
      return;
    }
    const cleanPhone = student.whatsappNumber.replace(/[^\d]/g, "");
    Linking.openURL(`whatsapp://send?phone=${cleanPhone}`).catch(() => {
      Alert.alert("WhatsApp Unavailable", "Could not open WhatsApp on this device.");
    });
  };

  const weekdays = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

  return (
    <View style={styles.container}>
      {/* Top Bar with Back Button */}
      <View style={styles.topBar}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
        >
          <ArrowLeft size={20} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.topBarTitle}>Student Profile</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Student Overview Header Card */}
        <Card style={styles.profileCard}>
          <View style={styles.profileHeader}>
            <View style={styles.avatar}>
              <GraduationCap size={28} color={Colors.primary} />
            </View>
            <View style={{ flex: 1, marginLeft: Spacing.md }}>
              <View style={styles.nameRow}>
                <Text style={styles.studentName}>{student.name}</Text>
                <Badge label={student.studentCode} variant="primary" size="sm" />
              </View>
              <Text style={styles.gradeSubtitle}>
                {student.grade} • {student.board || "CBSE"}
              </Text>
            </View>
          </View>

          {student.whatsappNumber && (
            <TouchableOpacity
              style={styles.whatsappAction}
              onPress={handleWhatsApp}
              activeOpacity={0.8}
            >
              <MessageSquare size={16} color="#25D366" />
              <Text style={styles.whatsappActionText}>
                Chat on WhatsApp ({student.whatsappNumber})
              </Text>
            </TouchableOpacity>
          )}
        </Card>

        {/* Assigned Subjects & Class Credits */}
        <View style={styles.sectionHeader}>
          <BookOpen size={16} color={Colors.primary} />
          <Text style={styles.sectionTitle}>Assigned Subjects & Class Balance</Text>
        </View>

        {student.assignedSubjects?.map((sub: any) => (
          <Card key={sub.enrolmentId} style={styles.subjectCard}>
            <View style={styles.subjectTitleRow}>
              <Text style={styles.subjectName}>{sub.subjectName}</Text>
              <Badge label="Active Subject" variant="success" size="sm" />
            </View>

            <View style={styles.creditsGrid}>
              <View style={styles.creditStat}>
                <Text style={styles.statLabel}>Allocated</Text>
                <Text style={styles.statValue}>{sub.allocatedCredits}</Text>
                <Text style={styles.statSub}>Total classes</Text>
              </View>

              <View style={styles.creditStat}>
                <Text style={styles.statLabel}>Attended</Text>
                <Text style={[styles.statValue, { color: Colors.info }]}>{sub.consumedCredits}</Text>
                <Text style={styles.statSub}>Completed</Text>
              </View>

              <View style={styles.creditStat}>
                <Text style={styles.statLabel}>Remaining</Text>
                <Text style={[styles.statValue, { color: Colors.primary }]}>{sub.remainingCredits}</Text>
                <Text style={styles.statSub}>Classes left</Text>
              </View>
            </View>

            <Button
              title="Mark Attendance for Class"
              size="sm"
              onPress={() =>
                navigation.navigate("MarkAttendance", {
                  studentName: student.name,
                  studentCode: student.studentCode,
                  subjectName: sub.subjectName,
                })
              }
              style={{ marginTop: Spacing.md }}
            />
          </Card>
        ))}

        {/* Weekly Timetable Schedule */}
        <View style={[styles.sectionHeader, { marginTop: Spacing.xl }]}>
          <Calendar size={16} color={Colors.primary} />
          <Text style={styles.sectionTitle}>Weekly Schedule With You</Text>
        </View>

        {student.slots && student.slots.length > 0 ? (
          student.slots.map((slot: any) => (
            <Card key={slot.id} style={styles.slotCard}>
              <View style={styles.slotRow}>
                <View>
                  <Text style={styles.slotDay}>{weekdays[slot.weekday] || `Day ${slot.weekday}`}</Text>
                  <View style={styles.slotTimeRow}>
                    <Clock size={12} color={Colors.textSecondary} style={{ marginRight: 4 }} />
                    <Text style={styles.slotTime}>
                      {slot.start} – {slot.end} (IST)
                    </Text>
                  </View>
                </View>
                <Badge label={slot.subjectName} size="sm" />
              </View>
            </Card>
          ))
        ) : (
          <Card style={{ padding: Spacing.md }}>
            <Text style={{ color: Colors.textSecondary, fontSize: 12 }}>
              No timetable slots currently scheduled for this student.
            </Text>
          </Card>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.md,
    backgroundColor: Colors.background,
    borderBottomWidth: 1,
    borderBottomColor: Colors.cardBorder,
  },
  backButton: {
    padding: Spacing.sm,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.surface,
  },
  topBarTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: Colors.text,
  },
  scrollContent: {
    padding: Spacing.lg,
    paddingBottom: Spacing.xxxl,
  },
  profileCard: {
    marginBottom: Spacing.xl,
  },
  profileHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: Colors.primaryLight,
    borderWidth: 1,
    borderColor: Colors.primaryBorder,
    alignItems: "center",
    justifyContent: "center",
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  studentName: {
    fontSize: 18,
    fontWeight: "800",
    color: Colors.text,
  },
  gradeSubtitle: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  whatsappAction: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(37, 211, 102, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(37, 211, 102, 0.3)",
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.sm,
    marginTop: Spacing.md,
  },
  whatsappActionText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#25D366",
    marginLeft: 6,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: Colors.text,
    marginLeft: 6,
  },
  subjectCard: {
    marginBottom: Spacing.md,
  },
  subjectTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.md,
  },
  subjectName: {
    fontSize: 16,
    fontWeight: "800",
    color: Colors.text,
  },
  creditsGrid: {
    flexDirection: "row",
    backgroundColor: Colors.surfaceSubtle,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  creditStat: {
    flex: 1,
    alignItems: "center",
  },
  statLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: Colors.textMuted,
    textTransform: "uppercase",
  },
  statValue: {
    fontSize: 20,
    fontWeight: "900",
    color: Colors.text,
    marginVertical: 2,
  },
  statSub: {
    fontSize: 10,
    color: Colors.textSecondary,
  },
  slotCard: {
    marginBottom: Spacing.xs,
    padding: Spacing.md,
  },
  slotRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  slotDay: {
    fontSize: 14,
    fontWeight: "700",
    color: Colors.text,
  },
  slotTimeRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 2,
  },
  slotTime: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
});
