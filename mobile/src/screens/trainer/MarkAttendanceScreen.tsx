import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Colors, BorderRadius, Spacing } from "../../config/theme";
import { Card } from "../../components/Card";
import { Button } from "../../components/Button";
import { Badge } from "../../components/Badge";
import { useAuth } from "../../context/AuthContext";
import { apiRequest } from "../../config/api";
import { ArrowLeft, CheckCircle2, UserCheck, BookOpen, Clock, FileText } from "lucide-react-native";

export function MarkAttendanceScreen({ route, navigation }: any) {
  const { sessionId, studentName, studentCode, subjectName, onSuccess } = route.params || {};
  const { token } = useAuth();

  const [studentAttendance, setStudentAttendance] = useState<"PRESENT" | "LATE" | "ABSENT">("PRESENT");
  const [sessionOutcome, setSessionOutcome] = useState<"COMPLETED" | "STUDENT_NO_SHOW" | "CANCELLED">("COMPLETED");
  const [actualDurationMinutes, setActualDurationMinutes] = useState("60");
  const [topicCovered, setTopicCovered] = useState("");
  const [homework, setHomework] = useState("");
  const [progressNote, setProgressNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!topicCovered.trim()) {
      Alert.alert("Topic Required", "Please enter the topic covered during this class.");
      return;
    }

    if (!sessionId) {
      // Opened without a scheduled class (e.g. from a student profile): there is nothing to save against.
      Alert.alert(
        "Choose the class first",
        "Attendance is saved against a scheduled class. Open today's class from your Dashboard and mark it there."
      );
      return;
    }

    setSubmitting(true);
    try {
      await apiRequest(`/api/sessions/${sessionId}/attendance`, {
        method: "POST",
        token,
        body: JSON.stringify({
          sessionOutcome,
          studentAttendance,
          actualDurationMinutes: parseInt(actualDurationMinutes, 10) || 60,
          topicCovered: topicCovered.trim(),
          homework: homework.trim() || undefined,
          studentProgressNote: progressNote.trim() || undefined,
        }),
      });

      Alert.alert(
        "Attendance Marked!",
        `Class for ${studentName || "student"} marked as ${studentAttendance}. 1 class credit deducted and trainer hours recorded.`,
        [
          {
            text: "OK",
            onPress: () => {
              if (onSuccess) onSuccess();
              navigation.goBack();
            },
          },
        ]
      );
    } catch (err: any) {
      // Stay on the form so nothing typed is lost; never report a failed save as saved.
      Alert.alert(
        "Attendance not saved",
        `${err?.message || "The server did not accept the attendance."}\n\nYou can mark this class on the website instead.`
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.container}
    >
      {/* Top Header */}
      <View style={styles.topBar}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
        >
          <ArrowLeft size={20} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.topBarTitle}>Mark Attendance</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {/* Class Context Card */}
        <Card style={styles.summaryCard}>
          <View style={styles.summaryRow}>
            <View>
              <Text style={styles.studentName}>{studentName || "Student"}</Text>
              <Text style={styles.studentCode}>({studentCode || "XST"})</Text>
            </View>
            <Badge label={subjectName || "Subject"} variant="primary" />
          </View>
        </Card>

        {/* 1. Student Attendance Status */}
        <Text style={styles.sectionHeading}>Student Attendance</Text>
        <View style={styles.pillsRow}>
          {(["PRESENT", "LATE", "ABSENT"] as const).map((status) => {
            const isSelected = studentAttendance === status;
            return (
              <TouchableOpacity
                key={status}
                style={[
                  styles.statusPill,
                  isSelected && styles.statusPillSelected,
                  isSelected && status === "PRESENT" && { borderColor: Colors.success, backgroundColor: Colors.successLight },
                  isSelected && status === "LATE" && { borderColor: Colors.warning, backgroundColor: Colors.warningLight },
                  isSelected && status === "ABSENT" && { borderColor: Colors.danger, backgroundColor: Colors.dangerLight },
                ]}
                onPress={() => setStudentAttendance(status)}
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    styles.statusText,
                    isSelected && { color: status === "PRESENT" ? Colors.success : status === "LATE" ? Colors.warning : Colors.danger },
                  ]}
                >
                  {status}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* 2. Duration */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Class Duration (Minutes)</Text>
          <View style={styles.inputWrapper}>
            <Clock size={16} color={Colors.textMuted} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              value={actualDurationMinutes}
              onChangeText={setActualDurationMinutes}
              keyboardType="number-pad"
              placeholder="60"
              placeholderTextColor={Colors.textMuted}
            />
          </View>
        </View>

        {/* 3. Topic Covered */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Topic Covered *</Text>
          <View style={[styles.inputWrapper, { height: 80, alignItems: "flex-start", paddingTop: 10 }]}>
            <BookOpen size={16} color={Colors.textMuted} style={styles.inputIcon} />
            <TextInput
              style={[styles.input, { height: 60, textAlignVertical: "top" }]}
              value={topicCovered}
              onChangeText={setTopicCovered}
              placeholder="e.g. Chapter 4: Quadratic Equations & Practice Set"
              placeholderTextColor={Colors.textMuted}
              multiline
            />
          </View>
        </View>

        {/* 4. Homework Assigned */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Homework Assigned (Optional)</Text>
          <View style={[styles.inputWrapper, { height: 80, alignItems: "flex-start", paddingTop: 10 }]}>
            <FileText size={16} color={Colors.textMuted} style={styles.inputIcon} />
            <TextInput
              style={[styles.input, { height: 60, textAlignVertical: "top" }]}
              value={homework}
              onChangeText={setHomework}
              placeholder="e.g. Solve textbook exercises 4.1 to 4.5"
              placeholderTextColor={Colors.textMuted}
              multiline
            />
          </View>
        </View>

        {/* 5. Progress Notes */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Student Progress Note (Optional)</Text>
          <View style={[styles.inputWrapper, { height: 80, alignItems: "flex-start", paddingTop: 10 }]}>
            <CheckCircle2 size={16} color={Colors.textMuted} style={styles.inputIcon} />
            <TextInput
              style={[styles.input, { height: 60, textAlignVertical: "top" }]}
              value={progressNote}
              onChangeText={setProgressNote}
              placeholder="e.g. Grasping concepts well, needs more practice in formulas"
              placeholderTextColor={Colors.textMuted}
              multiline
            />
          </View>
        </View>

        {/* Submit Button */}
        <Button
          title="Save & Deduct 1 Credit"
          onPress={handleSubmit}
          loading={submitting}
          size="lg"
          style={{ marginTop: Spacing.lg }}
        />
      </ScrollView>
    </KeyboardAvoidingView>
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
    paddingBottom: Spacing.xxxl * 2,
  },
  summaryCard: {
    marginBottom: Spacing.lg,
  },
  summaryRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  studentName: {
    fontSize: 18,
    fontWeight: "800",
    color: Colors.text,
  },
  studentCode: {
    fontSize: 12,
    fontWeight: "600",
    color: Colors.textMuted,
    marginTop: 2,
  },
  sectionHeading: {
    fontSize: 12,
    fontWeight: "700",
    color: Colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: Spacing.sm,
  },
  pillsRow: {
    flexDirection: "row",
    marginBottom: Spacing.lg,
  },
  statusPill: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md,
    marginHorizontal: 4,
  },
  statusPillSelected: {
    borderWidth: 1.5,
  },
  statusText: {
    fontSize: 13,
    fontWeight: "800",
    color: Colors.textSecondary,
  },
  inputGroup: {
    marginBottom: Spacing.md,
  },
  label: {
    fontSize: 12,
    fontWeight: "700",
    color: Colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.inputBg,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.inputBorder,
    paddingHorizontal: Spacing.md,
  },
  inputIcon: {
    marginRight: Spacing.sm,
  },
  input: {
    flex: 1,
    color: Colors.text,
    fontSize: 14,
    paddingVertical: Spacing.sm + 2,
  },
});
