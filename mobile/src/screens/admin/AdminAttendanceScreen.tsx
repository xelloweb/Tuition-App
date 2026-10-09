import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { apiRequest } from "../../config/api";
import { theme } from "../../config/theme";
import { Header } from "../../components/Header";
import { Badge } from "../../components/Badge";
import { EmptyState } from "../../components/EmptyState";
import { CheckCircle2, Clock, AlertTriangle, UserCheck } from "lucide-react-native";

export function AdminAttendanceScreen() {
  const [sessions, setSessions] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [filter, setFilter] = useState<"MISSING" | "TODAY" | "RECENT">("TODAY");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchAttendance = async () => {
    try {
      const res = await apiRequest(`/api/mobile/admin/attendance?filter=${filter}`);
      if (res.success) {
        setSessions(res.sessions);
        setStats(res.stats);
      }
    } catch (err: any) {
      console.log("Attendance fetch error:", err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchAttendance();
  }, [filter]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchAttendance();
  };

  const handleMarkOutcome = (sessionId: string, studentName: string) => {
    Alert.alert(
      "Mark Attendance",
      `Record attendance status for ${studentName}:`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Completed",
          onPress: async () => {
            try {
              await apiRequest("/api/mobile/admin/attendance", {
                method: "POST",
                body: JSON.stringify({
                  sessionId,
                  sessionOutcome: "COMPLETED",
                  studentAttendance: "PRESENT",
                  topicCovered: "Regular class covered",
                }),
              });
              Alert.alert("Success", "Class marked as Completed.");
              fetchAttendance();
            } catch (err: any) {
              Alert.alert("Error", err.message || "Failed to mark");
            }
          },
        },
        {
          text: "Student Absent",
          onPress: async () => {
            try {
              await apiRequest("/api/mobile/admin/attendance", {
                method: "POST",
                body: JSON.stringify({
                  sessionId,
                  sessionOutcome: "STUDENT_NO_SHOW",
                  studentAttendance: "ABSENT",
                  topicCovered: "Student absent",
                }),
              });
              Alert.alert("Success", "Recorded as Student Absent.");
              fetchAttendance();
            } catch (err: any) {
              Alert.alert("Error", err.message || "Failed to mark");
            }
          },
        },
      ]
    );
  };

  const renderSession = ({ item }: { item: any }) => {
    const isCompleted = item.attendanceOutcome === "COMPLETED";
    const isAbsent = item.attendanceOutcome === "STUDENT_NO_SHOW";

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.cardHeaderLeft}>
            <Text style={styles.studentName}>{item.studentName}</Text>
            <Text style={styles.teacherName}>Trainer: {item.teacherName}</Text>
          </View>
          <Badge
            label={item.isMarked ? (item.attendanceOutcome || "MARKED") : "UNMARKED"}
            variant={isCompleted ? "success" : isAbsent ? "warning" : "danger"}
          />
        </View>

        <View style={styles.metaRow}>
          <Text style={styles.subjectText}>{item.subjectName}</Text>
          <Text style={styles.timeText}>
            {new Date(item.startTime).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })} (IST)
          </Text>
        </View>

        {item.topicCovered && (
          <View style={styles.topicBox}>
            <Text style={styles.topicLabel}>Topic Covered:</Text>
            <Text style={styles.topicText}>{item.topicCovered}</Text>
          </View>
        )}

        <View style={styles.actionRow}>
          <TouchableOpacity
            style={styles.markBtn}
            onPress={() => handleMarkOutcome(item.id, item.studentName)}
            activeOpacity={0.7}
          >
            <UserCheck size={14} color="#000" />
            <Text style={styles.markBtnText}>{item.isMarked ? "Change Status" : "Mark Attendance"}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <Header title="Attendance Management" subtitle="Review & record session attendance" />

      {/* Filter Tabs */}
      <View style={styles.tabFilterRow}>
        {(["TODAY", "MISSING", "RECENT"] as const).map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.filterTab, filter === tab && styles.filterTabActive]}
            onPress={() => setFilter(tab)}
          >
            <Text style={[styles.filterTabText, filter === tab && styles.filterTabTextActive]}>
              {tab === "TODAY" ? "Today's Classes" : tab === "MISSING" ? `Missing (${stats?.missingAttendanceCount ?? 0})` : "Recent"}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={theme.colors.brandCyan} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={sessions}
          keyExtractor={(item) => item.id}
          renderItem={renderSession}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.brandCyan} />}
          ListEmptyComponent={
            <EmptyState
              title="No Attendance Records"
              message="No sessions match the selected view."
              icon={<CheckCircle2 size={40} color={theme.colors.textMuted} />}
            />
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  tabFilterRow: {
    flexDirection: "row",
    paddingHorizontal: theme.spacing.lg,
    marginTop: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    gap: 8,
  },
  filterTab: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.surface,
    alignItems: "center",
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  filterTabActive: {
    backgroundColor: "rgba(64, 174, 227, 0.15)",
    borderColor: theme.colors.brandCyan,
  },
  filterTabText: {
    fontSize: 12,
    fontWeight: "600",
    color: theme.colors.textMuted,
  },
  filterTabTextActive: {
    color: theme.colors.brandCyan,
    fontWeight: "700",
  },
  listContent: {
    padding: theme.spacing.lg,
    gap: theme.spacing.md,
  },
  card: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  cardHeaderLeft: {
    flex: 1,
  },
  studentName: {
    fontSize: 16,
    fontWeight: "700",
    color: theme.colors.text,
  },
  teacherName: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: theme.spacing.sm,
    paddingVertical: 4,
  },
  subjectText: {
    fontSize: 13,
    fontWeight: "700",
    color: theme.colors.brandLime,
  },
  timeText: {
    fontSize: 12,
    color: theme.colors.brandCyan,
    fontWeight: "600",
  },
  topicBox: {
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.sm,
    borderRadius: theme.borderRadius.sm,
    marginTop: theme.spacing.sm,
  },
  topicLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: theme.colors.textMuted,
    textTransform: "uppercase",
  },
  topicText: {
    fontSize: 12,
    color: theme.colors.text,
    marginTop: 2,
  },
  actionRow: {
    marginTop: theme.spacing.md,
    flexDirection: "row",
    justifyContent: "flex-end",
  },
  markBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.brandCyan,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: theme.borderRadius.md,
    gap: 6,
  },
  markBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#000",
  },
});
